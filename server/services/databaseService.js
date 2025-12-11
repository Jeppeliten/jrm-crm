// Database Service Layer
// Säker databashantering med validering och transaktioner

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const ErrorHandler = require('../middleware/errorHandler');
const InputValidator = require('../middleware/validation');

class DatabaseService {
  constructor() {
    this.dataPath = path.join(process.cwd(), 'data');
    this.backupPath = path.join(process.cwd(), 'backups');
    this.encryption = {
      algorithm: 'aes-256-gcm',
      key: this.getEncryptionKey()
    };
    
    // Initialize backup directory
    this.initializeBackupDirectory();
  }

  // Initialize backup directory
  async initializeBackupDirectory() {
    try {
      await fs.mkdir(this.backupPath, { recursive: true });
    } catch (error) {
      console.warn('Could not create backup directory:', error.message);
    }
  }

  // Get encryption key from environment or generate
  getEncryptionKey() {
    if (process.env.DB_ENCRYPTION_KEY) {
      return Buffer.from(process.env.DB_ENCRYPTION_KEY, 'hex');
    }
    
    // In production, this should come from secure key management
    const keyPath = path.join(this.dataPath, '.encryption.key');
    try {
      const existingKey = require('fs').readFileSync(keyPath);
      return existingKey;
    } catch {
      const newKey = crypto.randomBytes(32);
      require('fs').writeFileSync(keyPath, newKey, { mode: 0o600 });
      return newKey;
    }
  }

  // Encrypt sensitive data
  encrypt(text) {
    if (!text) return text;
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.encryption.algorithm, this.encryption.key);
    cipher.setAAD(Buffer.from('crm-data'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  // Decrypt sensitive data
  decrypt(encryptedData) {
    if (!encryptedData || typeof encryptedData === 'string') return encryptedData;
    
    try {
      const decipher = crypto.createDecipher(this.encryption.algorithm, this.encryption.key);
      decipher.setAAD(Buffer.from('crm-data'));
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw ErrorHandler.DatabaseError('Dekrypteringsfel', { originalError: error.message });
    }
  }

  // Load JSON data with validation and error handling
  async loadData(filename, validator = null) {
    try {
      const filePath = path.join(this.dataPath, filename);
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data);
      
      // Validate data structure if validator provided
      if (validator && !validator(parsed)) {
        throw new Error('Data validation failed');
      }
      
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return default structure
        return this.getDefaultStructure(filename);
      }
      
      throw ErrorHandler.DatabaseError(`Kunde inte läsa ${filename}`, {
        filename,
        error: error.message
      });
    }
  }

  // Save JSON data with backup and validation
  async saveData(filename, data, validator = null) {
    try {
      // Validate data before saving
      if (validator && !validator(data)) {
        throw ErrorHandler.ValidationError('Data validation failed before save');
      }

      const filePath = path.join(this.dataPath, filename);
      
      // Create backup of existing file
      await this.createBackup(filename);
      
      // Prepare data for saving
      const dataToSave = {
        ...data,
        lastModified: new Date().toISOString(),
        version: (data.version || 0) + 1
      };
      
      // Write atomically (write to temp file, then rename)
      const tempPath = filePath + '.tmp';
      await fs.writeFile(tempPath, JSON.stringify(dataToSave, null, 2));
      await fs.rename(tempPath, filePath);
      
      return dataToSave;
    } catch (error) {
      throw ErrorHandler.DatabaseError(`Kunde inte spara ${filename}`, {
        filename,
        error: error.message
      });
    }
  }

  // Create backup of existing file
  async createBackup(filename) {
    try {
      const sourcePath = path.join(this.dataPath, filename);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `${filename}.${timestamp}.backup`;
      const backupFilePath = path.join(this.backupPath, backupFilename);
      
      try {
        await fs.copyFile(sourcePath, backupFilePath);
        
        // Keep only last 10 backups per file
        await this.cleanupBackups(filename);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`Backup creation failed for ${filename}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('Backup operation failed:', error.message);
    }
  }

  // Cleanup old backups
  async cleanupBackups(filename, keepCount = 10) {
    try {
      const files = await fs.readdir(this.backupPath);
      const backups = files
        .filter(file => file.startsWith(filename + '.'))
        .map(file => ({
          name: file,
          path: path.join(this.backupPath, file),
          stat: null
        }));

      // Get file stats
      for (const backup of backups) {
        try {
          backup.stat = await fs.stat(backup.path);
        } catch (error) {
          console.warn(`Could not stat backup file ${backup.name}`);
        }
      }

      // Sort by modification time (newest first)
      backups
        .filter(b => b.stat)
        .sort((a, b) => b.stat.mtime - a.stat.mtime)
        .slice(keepCount)
        .forEach(async (backup) => {
          try {
            await fs.unlink(backup.path);
          } catch (error) {
            console.warn(`Could not delete old backup ${backup.name}`);
          }
        });
    } catch (error) {
      console.warn('Backup cleanup failed:', error.message);
    }
  }

  // Get default data structure for new files
  getDefaultStructure(filename) {
    const defaults = {
      'state.json': {
        version: 1,
        customers: [],
        agents: [],
        companies: [],
        brands: [],
        lastImport: null,
        statistics: {
          totalCustomers: 0,
          totalAgents: 0,
          totalCompanies: 0
        }
      },
      'auth.json': {
        version: 1,
        users: [],
        sessions: [],
        passwordResets: []
      },
      'audit.log': []
    };
    
    return defaults[filename] || {};
  }

  // Transaction-like operations for data consistency
  async transaction(operations) {
    const backups = new Map();
    
    try {
      // Create backups before starting transaction
      for (const op of operations) {
        if (op.type === 'save') {
          const currentData = await this.loadData(op.filename);
          backups.set(op.filename, currentData);
        }
      }
      
      // Execute all operations
      const results = [];
      for (const op of operations) {
        switch (op.type) {
          case 'load':
            results.push(await this.loadData(op.filename, op.validator));
            break;
          case 'save':
            results.push(await this.saveData(op.filename, op.data, op.validator));
            break;
          default:
            throw new Error(`Unknown operation type: ${op.type}`);
        }
      }
      
      return results;
    } catch (error) {
      // Rollback on error
      console.error('Transaction failed, rolling back...', error);
      
      for (const [filename, backupData] of backups) {
        try {
          await this.saveData(filename, backupData);
        } catch (rollbackError) {
          console.error(`Rollback failed for ${filename}:`, rollbackError);
        }
      }
      
      throw error;
    }
  }

  // Customer data operations
  async getCustomers(filters = {}) {
    const state = await this.loadData('state.json', this.validateStateStructure);
    let customers = state.customers || [];
    
    // Apply filters
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      customers = customers.filter(customer => 
        customer.name?.toLowerCase().includes(searchTerm) ||
        customer.email?.toLowerCase().includes(searchTerm) ||
        customer.phone?.includes(searchTerm)
      );
    }
    
    if (filters.isCompany !== undefined) {
      customers = customers.filter(customer => 
        Boolean(customer.isCompany) === Boolean(filters.isCompany)
      );
    }
    
    if (filters.brand) {
      customers = customers.filter(customer => 
        customer.brand === filters.brand
      );
    }
    
    // Apply pagination
    if (filters.page && filters.limit) {
      const start = (filters.page - 1) * filters.limit;
      const end = start + filters.limit;
      customers = customers.slice(start, end);
    }
    
    return customers;
  }

  async saveCustomer(customerData) {
    // Validate customer data
    const validation = InputValidator.validateCustomer(customerData);
    if (!validation.isValid) {
      throw ErrorHandler.ValidationError('Ogiltig kunddata', validation.errors);
    }
    
    const state = await this.loadData('state.json', this.validateStateStructure);
    
    // Check for duplicates
    const existingIndex = state.customers.findIndex(c => 
      c.email === customerData.email || 
      (c.phone && c.phone === customerData.phone)
    );
    
    if (existingIndex !== -1 && (!customerData.id || state.customers[existingIndex].id !== customerData.id)) {
      throw ErrorHandler.ConflictError('Kund med denna e-post eller telefon finns redan');
    }
    
    // Add or update customer
    const customer = {
      ...customerData,
      id: customerData.id || this.generateId('customer'),
      updatedAt: new Date().toISOString()
    };
    
    if (existingIndex !== -1) {
      state.customers[existingIndex] = customer;
    } else {
      customer.createdAt = new Date().toISOString();
      state.customers.push(customer);
    }
    
    // Update statistics
    state.statistics.totalCustomers = state.customers.length;
    
    await this.saveData('state.json', state, this.validateStateStructure);
    return customer;
  }

  async deleteCustomer(customerId) {
    const state = await this.loadData('state.json');
    const customerIndex = state.customers.findIndex(c => c.id === customerId);
    
    if (customerIndex === -1) {
      throw ErrorHandler.ValidationError('Kund hittades inte');
    }
    
    // Remove customer
    const deletedCustomer = state.customers.splice(customerIndex, 1)[0];
    
    // Update statistics
    state.statistics.totalCustomers = state.customers.length;
    
    await this.saveData('state.json', state);
    return deletedCustomer;
  }

  // Agent data operations
  async getAgents(filters = {}) {
    const state = await this.loadData('state.json');
    let agents = state.agents || [];
    
    // Apply filters similar to customers
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      agents = agents.filter(agent => 
        agent.name?.toLowerCase().includes(searchTerm) ||
        agent.email?.toLowerCase().includes(searchTerm) ||
        agent.company?.toLowerCase().includes(searchTerm)
      );
    }
    
    return agents;
  }

  // Company data operations
  async getCompanies(filters = {}) {
    const state = await this.loadData('state.json');
    let companies = state.companies || [];
    
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      companies = companies.filter(company => 
        company.name?.toLowerCase().includes(searchTerm) ||
        company.website?.toLowerCase().includes(searchTerm)
      );
    }
    
    return companies;
  }

  // Audit logging
  async logAuditEvent(event) {
    try {
      const auditEntry = {
        id: this.generateId('audit'),
        timestamp: new Date().toISOString(),
        ...event
      };
      
      const auditLog = await this.loadData('audit.log') || [];
      auditLog.push(auditEntry);
      
      // Keep only last 10000 entries
      if (auditLog.length > 10000) {
        auditLog.splice(0, auditLog.length - 10000);
      }
      
      await this.saveData('audit.log', auditLog);
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  // Import operations with validation
  async importData(importType, data, userId) {
    const validator = this.getImportValidator(importType);
    
    if (!validator(data)) {
      throw ErrorHandler.ValidationError(`Ogiltig data för import av typ: ${importType}`);
    }
    
    const state = await this.loadData('state.json');
    const importResult = {
      type: importType,
      timestamp: new Date().toISOString(),
      userId,
      imported: 0,
      updated: 0,
      errors: []
    };
    
    try {
      switch (importType) {
        case 'customers':
          await this.importCustomers(data, state, importResult);
          break;
        case 'agents':
          await this.importAgents(data, state, importResult);
          break;
        case 'companies':
          await this.importCompanies(data, state, importResult);
          break;
        default:
          throw new Error(`Unknown import type: ${importType}`);
      }
      
      // Update last import timestamp
      state.lastImport = new Date().toISOString();
      
      // Save updated state
      await this.saveData('state.json', state);
      
      // Log audit event
      await this.logAuditEvent({
        type: 'data_import',
        userId,
        details: importResult
      });
      
      return importResult;
    } catch (error) {
      throw ErrorHandler.DatabaseError('Import misslyckades', {
        importType,
        error: error.message,
        partialResult: importResult
      });
    }
  }

  // Helper methods
  generateId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  validateStateStructure(state) {
    return state && 
           Array.isArray(state.customers) &&
           Array.isArray(state.agents) &&
           Array.isArray(state.companies) &&
           typeof state.statistics === 'object';
  }

  getImportValidator(importType) {
    const validators = {
      customers: (data) => Array.isArray(data) && data.every(item => 
        typeof item === 'object' && (item.name || item.email)
      ),
      agents: (data) => Array.isArray(data) && data.every(item =>
        typeof item === 'object' && item.name
      ),
      companies: (data) => Array.isArray(data) && data.every(item =>
        typeof item === 'object' && item.name
      )
    };
    
    return validators[importType] || (() => false);
  }

  async importCustomers(customers, state, result) {
    for (const customerData of customers) {
      try {
        const existingIndex = state.customers.findIndex(c => 
          c.email === customerData.email ||
          (c.phone && customerData.phone && c.phone === customerData.phone)
        );
        
        const customer = {
          ...customerData,
          id: customerData.id || this.generateId('customer'),
          updatedAt: new Date().toISOString()
        };
        
        if (existingIndex !== -1) {
          state.customers[existingIndex] = { ...state.customers[existingIndex], ...customer };
          result.updated++;
        } else {
          customer.createdAt = new Date().toISOString();
          state.customers.push(customer);
          result.imported++;
        }
      } catch (error) {
        result.errors.push({
          data: customerData,
          error: error.message
        });
      }
    }
    
    state.statistics.totalCustomers = state.customers.length;
  }

  async importAgents(agents, state, result) {
    for (const agentData of agents) {
      try {
        const existingIndex = state.agents.findIndex(a => 
          a.email === agentData.email ||
          (a.name === agentData.name && a.company === agentData.company)
        );
        
        const agent = {
          ...agentData,
          id: agentData.id || this.generateId('agent'),
          updatedAt: new Date().toISOString()
        };
        
        if (existingIndex !== -1) {
          state.agents[existingIndex] = { ...state.agents[existingIndex], ...agent };
          result.updated++;
        } else {
          agent.createdAt = new Date().toISOString();
          state.agents.push(agent);
          result.imported++;
        }
      } catch (error) {
        result.errors.push({
          data: agentData,
          error: error.message
        });
      }
    }
    
    state.statistics.totalAgents = state.agents.length;
  }

  async importCompanies(companies, state, result) {
    for (const companyData of companies) {
      try {
        const existingIndex = state.companies.findIndex(c => 
          c.name === companyData.name ||
          (c.website && companyData.website && c.website === companyData.website)
        );
        
        const company = {
          ...companyData,
          id: companyData.id || this.generateId('company'),
          updatedAt: new Date().toISOString()
        };
        
        if (existingIndex !== -1) {
          state.companies[existingIndex] = { ...state.companies[existingIndex], ...company };
          result.updated++;
        } else {
          company.createdAt = new Date().toISOString();
          state.companies.push(company);
          result.imported++;
        }
      } catch (error) {
        result.errors.push({
          data: companyData,
          error: error.message
        });
      }
    }
    
    state.statistics.totalCompanies = state.companies.length;
  }

  // Health check
  async getHealthStatus() {
    try {
      const state = await this.loadData('state.json');
      const stats = state.statistics || {};
      
      return {
        status: 'healthy',
        database: {
          customers: stats.totalCustomers || 0,
          agents: stats.totalAgents || 0,
          companies: stats.totalCompanies || 0,
          lastImport: state.lastImport
        },
        backups: {
          available: (await fs.readdir(this.backupPath)).length
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = new DatabaseService();