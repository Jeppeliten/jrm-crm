/**
 * 🗃️ Azure Cosmos DB Service Layer
 * Hanterar all databaskommunikation mot Cosmos DB med MongoDB API
 */

const { MongoClient } = require('mongodb');

class CosmosService {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    
    // Cosmos DB connection string från environment
    this.connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
    this.databaseName = process.env.COSMOS_DB_DATABASE_NAME || 'crm_database';
    
    if (!this.connectionString) {
      throw new Error('COSMOS_DB_CONNECTION_STRING environment variable is required');
    }
  }

  /**
   * Anslut till Cosmos DB
   */
  async connect() {
    try {
      if (this.isConnected) {
        return this.db;
      }

      console.log('🔌 Connecting to Azure Cosmos DB...');
      
      // Fix connection string for Cosmos DB (disable retryWrites)
      let connStr = this.connectionString;
      if (connStr.includes('retryWrites=true')) {
        connStr = connStr.replace('retryWrites=true', 'retryWrites=false');
        console.log('✓ Fixed retryWrites=true to retryWrites=false');
      } else if (!connStr.includes('retryWrites=false')) {
        connStr += (connStr.includes('?') ? '&' : '?') + 'retryWrites=false';
        console.log('✓ Added retryWrites=false to connection string');
      }
      
      this.client = new MongoClient(connStr, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        retryWrites: false // Explicitly disable retryable writes
      });

      await this.client.connect();
      this.db = this.client.db(this.databaseName);
      this.isConnected = true;

      console.log('✅ Connected to Azure Cosmos DB');
      
      // Skapa indexes för optimal prestanda (non-blocking)
      this.createIndexes().catch(err => {
        console.warn('⚠️  Index creation failed (non-critical):', err.message);
      });
      
      return this.db;
    } catch (error) {
      console.error('❌ Failed to connect to Cosmos DB:', error);
      throw error;
    }
  }

  /**
   * Skapa optimala indexes för CRM-data
   */
  async createIndexes() {
    try {
      console.log('📋 Creating database indexes...');

      // Users collection indexes (without unique constraint on Cosmos DB sharded collection)
      await this.db.collection('users').createIndexes([
        { key: { email: 1 } },
        { key: { azureObjectId: 1 }, sparse: true },
        { key: { companyId: 1 } },
        { key: { role: 1 } },
        { key: { isActive: 1 } }
      ]);

      // Companies collection indexes  
      await this.db.collection('companies').createIndexes([
        { key: { name: 1 } },
        { key: { organizationNumber: 1 }, sparse: true },
        { key: { brandId: 1 } },
        { key: { isActive: 1 } },
        { key: { createdAt: 1 } }
      ]);

      // Contacts collection indexes
      await this.db.collection('contacts').createIndexes([
        { key: { email: 1 } },
        { key: { companyId: 1 } },
        { key: { agentId: 1 } },
        { key: { isActive: 1 } },
        { key: { lastContactDate: 1 } }
      ]);

      // Tasks collection indexes
      await this.db.collection('tasks').createIndexes([
        { key: { assignedTo: 1 } },
        { key: { companyId: 1 } },
        { key: { contactId: 1 } },
        { key: { dueDate: 1 } },
        { key: { status: 1 } },
        { key: { priority: 1 } }
      ]);

      // Notes collection indexes
      await this.db.collection('notes').createIndexes([
        { key: { entityType: 1, entityId: 1 } },
        { key: { authorId: 1 } },
        { key: { createdAt: 1 } }
      ]);

      // Agents collection indexes (without unique constraint)
      await this.db.collection('agents').createIndexes([
        { key: { email: 1 } },
        { key: { companyId: 1 } },
        { key: { isActive: 1 } }
      ]);

      // Brands collection indexes (without unique constraint)
      await this.db.collection('brands').createIndexes([
        { key: { name: 1 } },
        { key: { isActive: 1 } }
      ]);

      console.log('✅ Database indexes created successfully');
    } catch (error) {
      console.error('❌ Failed to create indexes:', error);
      // Fortsätt ändå - indexes är optimering, inte kritiskt
    }
  }

  /**
   * Stäng anslutningen
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        console.log('🔌 Disconnected from Cosmos DB');
      }
    } catch (error) {
      console.error('❌ Error disconnecting from Cosmos DB:', error);
    }
  }

  /**
   * Hämta en collection
   */
  getCollection(collectionName) {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db.collection(collectionName);
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      // Testa med en enkel ping
      const result = await this.db.admin().ping();
      return {
        status: 'healthy',
        database: this.databaseName,
        connected: this.isConnected,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generic CRUD operations
   */
  
  async findOne(collectionName, query, options = {}) {
    const collection = this.getCollection(collectionName);
    return await collection.findOne(query, options);
  }

  async find(collectionName, query = {}, options = {}) {
    const collection = this.getCollection(collectionName);
    return await collection.find(query, options).toArray();
  }

  async insertOne(collectionName, document) {
    const collection = this.getCollection(collectionName);
    const now = new Date();
    
    const docWithTimestamps = {
      ...document,
      createdAt: document.createdAt || now,
      updatedAt: now
    };
    
    const result = await collection.insertOne(docWithTimestamps);
    return result;
  }

  async insertMany(collectionName, documents) {
    const collection = this.getCollection(collectionName);
    const now = new Date();
    
    const docsWithTimestamps = documents.map(doc => ({
      ...doc,
      createdAt: doc.createdAt || now,
      updatedAt: now
    }));
    
    const result = await collection.insertMany(docsWithTimestamps);
    return result;
  }

  async updateOne(collectionName, filter, update, options = {}) {
    const collection = this.getCollection(collectionName);
    
    // Lägg till updatedAt automatiskt
    const updateWithTimestamp = {
      ...update,
      $set: {
        ...update.$set,
        updatedAt: new Date()
      }
    };
    
    const result = await collection.updateOne(filter, updateWithTimestamp, options);
    return result;
  }

  async updateMany(collectionName, filter, update, options = {}) {
    const collection = this.getCollection(collectionName);
    
    // Lägg till updatedAt automatiskt
    const updateWithTimestamp = {
      ...update,
      $set: {
        ...update.$set,
        updatedAt: new Date()
      }
    };
    
    const result = await collection.updateMany(filter, updateWithTimestamp, options);
    return result;
  }

  async deleteOne(collectionName, filter) {
    const collection = this.getCollection(collectionName);
    const result = await collection.deleteOne(filter);
    return result;
  }

  async deleteMany(collectionName, filter) {
    const collection = this.getCollection(collectionName);
    const result = await collection.deleteMany(filter);
    return result;
  }

  /**
   * Aggregation operations
   */
  async aggregate(collectionName, pipeline, options = {}) {
    const collection = this.getCollection(collectionName);
    return await collection.aggregate(pipeline, options).toArray();
  }

  /**
   * Count operations
   */
  async countDocuments(collectionName, filter = {}) {
    const collection = this.getCollection(collectionName);
    return await collection.countDocuments(filter);
  }
}

// Singleton instance
let cosmosService = null;

/**
 * Hämta Cosmos DB service instance
 */
function getCosmosService() {
  if (!cosmosService) {
    cosmosService = new CosmosService();
  }
  return cosmosService;
}

module.exports = {
  CosmosService,
  getCosmosService
};