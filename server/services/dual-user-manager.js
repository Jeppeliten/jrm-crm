/**
 * Dual User Management System
 * 
 * Hanterar både moderna Azure B2C-kunder och legacy egenbyggt system
 * Automatisk routing baserat på kundtyp och tjänstekategori
 */

const AzureB2CUserManager = require('../azure-b2c-user-management');
const fs = require('fs').promises;
const path = require('path');

class DualUserManager {
  constructor() {
    this.azureB2C = null; // Initialiseras vid behov
    this.legacySystemConfig = {
      apiUrl: process.env.LEGACY_SYSTEM_URL || 'https://legacy-admin.yourdomain.com/api',
      apiKey: process.env.LEGACY_SYSTEM_API_KEY || '',
      enableSync: process.env.ENABLE_LEGACY_SYNC === 'true'
    };
    
    // Routing-regler för vilka kunder som ska gå till vilket system
    this.routingRules = {
      // Moderna tjänster → Azure B2C
      modernServices: [
        'CRM_MODERN',
        'ANALYTICS_PLATFORM', 
        'MOBILE_APP',
        'API_ACCESS',
        'REAL_TIME_SYNC'
      ],
      
      // Legacy tjänster → Egenbyggt system
      legacyServices: [
        'CRM_CLASSIC',
        'OLD_REPORTING',
        'LEGACY_INTEGRATIONS',
        'CUSTOM_MODULES'
      ],
      
      // Hybrid-kunder som behöver båda
      hybridMarkers: [
        'MIGRATION_IN_PROGRESS',
        'DUAL_ACCESS_REQUIRED',
        'GRADUAL_TRANSITION'
      ]
    };
    
    this.syncState = {
      lastSync: null,
      pendingMigrations: [],
      dualAccounts: new Map() // CRM customer ID -> { azureId, legacyId, status }
    };
  }

  /**
   * Huvudfunktion för att skapa användare
   * Automatisk routing baserat på kundens tjänster
   */
  async createUser(customerData, services = []) {
    try {
      console.log(`🔄 Creating user for customer: ${customerData.namn}`);
      
      // Analysera vilka system som behövs
      const systemNeeds = this.analyzeSystemNeeds(services, customerData);
      
      const result = {
        customerId: customerData.id,
        customerName: customerData.namn,
        services,
        systemNeeds,
        accounts: {},
        errors: []
      };

      // Skapa i Azure B2C om modern tjänst behövs
      if (systemNeeds.needsAzureB2C) {
        try {
          const azureUser = await this.createAzureB2CUser(customerData, services);
          result.accounts.azureB2C = azureUser;
          console.log(`✅ Azure B2C user created: ${azureUser.id}`);
        } catch (error) {
          result.errors.push(`Azure B2C creation failed: ${error.message}`);
          console.error('❌ Azure B2C creation failed:', error);
        }
      }

      // Skapa i legacy system om klassiska tjänster behövs
      if (systemNeeds.needsLegacy) {
        try {
          const legacyUser = await this.createLegacyUser(customerData, services);
          result.accounts.legacy = legacyUser;
          console.log(`✅ Legacy user created: ${legacyUser.id}`);
        } catch (error) {
          result.errors.push(`Legacy creation failed: ${error.message}`);
          console.error('❌ Legacy creation failed:', error);
        }
      }

      // Spara dual account mapping om båda skapades
      if (result.accounts.azureB2C && result.accounts.legacy) {
        await this.saveDualAccountMapping(customerData.id, result.accounts);
        console.log(`🔗 Dual account mapping saved for ${customerData.namn}`);
      }

      // Logga resultatet
      await this.logUserCreation(result);

      return result;

    } catch (error) {
      console.error('❌ Dual user creation failed:', error);
      throw error;
    }
  }

  /**
   * Analysera vilka system som behöver användarkonton
   */
  analyzeSystemNeeds(services, customerData) {
    const serviceNames = services.map(s => s.name || s);
    
    const needsAzureB2C = (
      // Modern tjänst behövs
      serviceNames.some(service => this.routingRules.modernServices.includes(service)) ||
      // Kunden har Azure B2C-kompatibel email
      (customerData.email && customerData.email.includes('@')) ||
      // Explicit förfrågan om modern användarhantering
      customerData.preferredUserSystem === 'azure-b2c' ||
      // Ny kund (skapad senaste 6 månaderna) får modern system som standard
      this.isNewCustomer(customerData)
    );

    const needsLegacy = (
      // Legacy tjänst behövs
      serviceNames.some(service => this.routingRules.legacyServices.includes(service)) ||
      // Kunden har redan legacy-användare
      customerData.hasLegacyAccounts ||
      // Explicit förfrågan om legacy system
      customerData.preferredUserSystem === 'legacy' ||
      // Hybrid-markers finns
      serviceNames.some(service => this.routingRules.hybridMarkers.includes(service))
    );

    return {
      needsAzureB2C,
      needsLegacy,
      isDualAccount: needsAzureB2C && needsLegacy,
      primarySystem: needsAzureB2C ? 'azure-b2c' : 'legacy',
      reasoning: {
        azureB2CReasons: this.getAzureB2CReasons(serviceNames, customerData),
        legacyReasons: this.getLegacyReasons(serviceNames, customerData)
      }
    };
  }

  /**
   * Kontrollera om kund är ny (senaste 6 månaderna)
   */
  isNewCustomer(customerData) {
    if (!customerData.createdDate) return true; // Default för saknad data
    
    const createdDate = new Date(customerData.createdDate);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    return createdDate > sixMonthsAgo;
  }

  /**
   * Skapa användare i Azure B2C
   */
  async createAzureB2CUser(customerData, services) {
    if (!this.azureB2C) {
      // Lazy initialization av Azure B2C
      const { GraphAPIClient } = require('./azure-b2c-user-sync');
      const graphClient = new GraphAPIClient();
      this.azureB2C = new AzureB2CUserManager(graphClient);
    }

    const userData = {
      email: customerData.email,
      firstName: customerData.firstName || customerData.namn?.split(' ')[0] || 'Användare',
      lastName: customerData.lastName || customerData.namn?.split(' ').slice(1).join(' ') || 'Kund',
      displayName: customerData.namn,
      companyId: customerData.id,
      companyName: customerData.företag || customerData.namn,
      phone: customerData.telefon,
      services: services.map(s => s.name || s),
      role: 'user', // Standard användarroll
      sendInviteEmail: true
    };

    return await this.azureB2C.createUser(userData);
  }

  /**
   * Skapa användare i legacy system
   */
  async createLegacyUser(customerData, services) {
    if (!this.legacySystemConfig.enableSync) {
      throw new Error('Legacy system sync is disabled');
    }

    const userData = {
      customer_id: customerData.id,
      customer_name: customerData.namn,
      email: customerData.email,
      phone: customerData.telefon,
      company: customerData.företag || customerData.namn,
      services: services.map(s => s.name || s),
      created_via: 'crm_dual_manager',
      created_at: new Date().toISOString()
    };

    // API-anrop till legacy system
    const response = await this.makeLegacyAPICall('POST', '/users', userData);
    
    if (!response.success) {
      throw new Error(`Legacy API error: ${response.error}`);
    }

    return {
      id: response.user_id,
      username: response.username,
      status: response.status,
      loginUrl: response.login_url
    };
  }

  /**
   * API-anrop till legacy system
   */
  async makeLegacyAPICall(method, endpoint, data = null) {
    const https = require('https');
    const url = new URL(this.legacySystemConfig.apiUrl + endpoint);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.legacySystemConfig.apiKey}`,
        'User-Agent': 'CRM-Dual-Manager/1.0'
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve(parsed);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${responseData}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  /**
   * Spara mapping mellan dual accounts
   */
  async saveDualAccountMapping(customerId, accounts) {
    this.syncState.dualAccounts.set(customerId, {
      customerId,
      azureId: accounts.azureB2C?.id,
      legacyId: accounts.legacy?.id,
      createdAt: new Date().toISOString(),
      status: 'active',
      lastSync: new Date().toISOString()
    });

    await this.saveSyncState();
  }

  /**
   * Migrera användare från legacy till Azure B2C
   */
  async migrateUserToAzureB2C(customerId, services = []) {
    try {
      console.log(`🔄 Starting migration for customer: ${customerId}`);
      
      // Hämta kunddata från CRM
      const customerData = await this.getCustomerData(customerId);
      if (!customerData) {
        throw new Error(`Customer ${customerId} not found`);
      }

      // Kontrollera om Azure B2C-användare redan finns
      const existingMapping = this.syncState.dualAccounts.get(customerId);
      if (existingMapping && existingMapping.azureId) {
        console.log(`ℹ️ Azure B2C account already exists for ${customerId}`);
        return existingMapping;
      }

      // Skapa Azure B2C-användare
      const azureUser = await this.createAzureB2CUser(customerData, services);

      // Uppdatera mapping
      if (existingMapping) {
        existingMapping.azureId = azureUser.id;
        existingMapping.lastSync = new Date().toISOString();
        existingMapping.status = 'migrated';
      } else {
        await this.saveDualAccountMapping(customerId, { 
          azureB2C: azureUser,
          legacy: { id: 'existing' }
        });
      }

      console.log(`✅ Migration completed for ${customerData.namn}`);
      
      return {
        customerId,
        azureUser,
        status: 'migrated',
        migrationDate: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Migration failed for ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Synkronisera användardata mellan systemen
   */
  async syncDualAccounts() {
    console.log('🔄 Starting dual account synchronization...');
    
    const syncResults = {
      processed: 0,
      updated: 0,
      errors: 0,
      migrations: 0
    };

    for (const [customerId, mapping] of this.syncState.dualAccounts) {
      try {
        syncResults.processed++;

        // Hämta uppdaterad kunddata från CRM
        const customerData = await this.getCustomerData(customerId);
        if (!customerData) {
          console.warn(`⚠️ Customer ${customerId} not found in CRM`);
          continue;
        }

        // Synkronisera till Azure B2C om användaren finns
        if (mapping.azureId) {
          await this.syncToAzureB2C(customerData, mapping.azureId);
          syncResults.updated++;
        }

        // Synkronisera till legacy system om användaren finns
        if (mapping.legacyId && mapping.legacyId !== 'existing') {
          await this.syncToLegacy(customerData, mapping.legacyId);
          syncResults.updated++;
        }

        // Uppdatera last sync timestamp
        mapping.lastSync = new Date().toISOString();

      } catch (error) {
        console.error(`❌ Sync failed for ${customerId}:`, error);
        syncResults.errors++;
      }
    }

    await this.saveSyncState();
    
    console.log('✅ Dual account sync completed:', syncResults);
    return syncResults;
  }

  /**
   * Hämta kunddata från CRM state
   */
  async getCustomerData(customerId) {
    try {
      const statePath = path.join(__dirname, 'state.json');
      const stateData = await fs.readFile(statePath, 'utf8');
      const state = JSON.parse(stateData);
      
      return state.customers?.find(c => c.id === customerId) || null;
    } catch (error) {
      console.error('Failed to load customer data:', error);
      return null;
    }
  }

  /**
   * Få anledningar för Azure B2C
   */
  getAzureB2CReasons(services, customerData) {
    const reasons = [];
    
    if (services.some(s => this.routingRules.modernServices.includes(s))) {
      reasons.push('Använder moderna tjänster');
    }
    
    if (this.isNewCustomer(customerData)) {
      reasons.push('Ny kund (standard för moderna system)');
    }
    
    if (customerData.preferredUserSystem === 'azure-b2c') {
      reasons.push('Explicit vald Azure B2C');
    }
    
    return reasons;
  }

  /**
   * Få anledningar för legacy system
   */
  getLegacyReasons(services, customerData) {
    const reasons = [];
    
    if (services.some(s => this.routingRules.legacyServices.includes(s))) {
      reasons.push('Använder legacy-tjänster');
    }
    
    if (customerData.hasLegacyAccounts) {
      reasons.push('Har redan legacy-konton');
    }
    
    if (customerData.preferredUserSystem === 'legacy') {
      reasons.push('Explicit vald legacy system');
    }
    
    return reasons;
  }

  /**
   * Logga användarresultat
   */
  async logUserCreation(result) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      customerId: result.customerId,
      customerName: result.customerName,
      systemNeeds: result.systemNeeds,
      accountsCreated: Object.keys(result.accounts),
      errors: result.errors
    };

    console.log('📝 User creation log:', logEntry);
    
    // Spara till audit log
    try {
      const auditPath = path.join(__dirname, 'dual-user-audit.log');
      await fs.appendFile(auditPath, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Spara sync state
   */
  async saveSyncState() {
    try {
      const statePath = path.join(__dirname, 'dual-user-sync-state.json');
      
      // Konvertera Map till objekt för JSON-serialisering
      const stateToSave = {
        ...this.syncState,
        dualAccounts: Object.fromEntries(this.syncState.dualAccounts)
      };
      
      await fs.writeFile(statePath, JSON.stringify(stateToSave, null, 2));
    } catch (error) {
      console.error('Failed to save sync state:', error);
    }
  }

  /**
   * Ladda sync state
   */
  async loadSyncState() {
    try {
      const statePath = path.join(__dirname, 'dual-user-sync-state.json');
      const data = await fs.readFile(statePath, 'utf8');
      const savedState = JSON.parse(data);
      
      this.syncState = {
        ...savedState,
        dualAccounts: new Map(Object.entries(savedState.dualAccounts || {}))
      };
    } catch (error) {
      // Filen finns inte än, använd default state
      console.log('No existing sync state found, using defaults');
    }
  }

  /**
   * Hämta statistik över dual accounts
   */
  getDualAccountStats() {
    let azureB2CCount = 0;
    let legacyCount = 0;
    let dualCount = 0;

    for (const mapping of this.syncState.dualAccounts.values()) {
      if (mapping.azureId && mapping.legacyId) {
        dualCount++;
      } else if (mapping.azureId) {
        azureB2CCount++;
      } else if (mapping.legacyId) {
        legacyCount++;
      }
    }

    return {
      total: this.syncState.dualAccounts.size,
      azureB2COnly: azureB2CCount,
      legacyOnly: legacyCount,
      dualAccounts: dualCount,
      lastSync: this.syncState.lastSync,
      pendingMigrations: this.syncState.pendingMigrations.length
    };
  }
}

module.exports = DualUserManager;