/**
 * 👤 User Service för Azure Entra ID + Cosmos DB
 * Hanterar användardata mellan Azure AD och lokal CRM-databas
 */

const { getCosmosService } = require('./cosmos-service');
const { ObjectId } = require('mongodb');

class UserService {
  constructor() {
    this.cosmosService = getCosmosService();
    this.collection = 'users';
  }

  /**
   * Skapa eller uppdatera användare från Azure AD
   */
  async syncUserFromAzure(azureUser) {
    try {
      await this.cosmosService.connect();

      const existingUser = await this.cosmosService.findOne(this.collection, {
        azureObjectId: azureUser.id
      });

      const userData = {
        azureObjectId: azureUser.id,
        email: azureUser.email || azureUser.mail || azureUser.userPrincipalName,
        firstName: azureUser.givenName || azureUser.firstName || '',
        lastName: azureUser.surname || azureUser.lastName || '',
        displayName: azureUser.displayName || `${azureUser.givenName || ''} ${azureUser.surname || ''}`.trim(),
        azureMetadata: {
          userPrincipalName: azureUser.userPrincipalName,
          jobTitle: azureUser.jobTitle,
          department: azureUser.department,
          groups: azureUser.groups || [],
          lastSignIn: azureUser.signInActivity?.lastSignInDateTime,
          accountEnabled: azureUser.accountEnabled
        },
        isActive: azureUser.accountEnabled !== false,
        source: 'azure-ad'
      };

      if (existingUser) {
        // Uppdatera befintlig användare
        const result = await this.cosmosService.updateOne(
          this.collection,
          { azureObjectId: azureUser.id },
          { $set: userData }
        );
        
        const updatedUser = await this.cosmosService.findOne(this.collection, {
          azureObjectId: azureUser.id
        });
        
        return updatedUser;
      } else {
        // Skapa ny användare med defaults
        userData.crmMetadata = {
          role: 'viewer', // Default role
          companyId: null,
          companyName: null,
          permissions: ['read'],
          services: [],
          notes: []
        };

        const result = await this.cosmosService.insertOne(this.collection, userData);
        
        const newUser = await this.cosmosService.findOne(this.collection, {
          _id: result.insertedId
        });
        
        return newUser;
      }
    } catch (error) {
      console.error('❌ Error syncing user from Azure:', error);
      throw error;
    }
  }

  /**
   * Hämta användare med Azure Object ID
   */
  async getUserByAzureId(azureObjectId) {
    try {
      await this.cosmosService.connect();
      
      const user = await this.cosmosService.findOne(this.collection, {
        azureObjectId: azureObjectId
      });
      
      return user;
    } catch (error) {
      console.error('❌ Error getting user by Azure ID:', error);
      throw error;
    }
  }

  /**
   * Hämta användare med email
   */
  async getUserByEmail(email) {
    try {
      await this.cosmosService.connect();
      
      const user = await this.cosmosService.findOne(this.collection, {
        email: email.toLowerCase()
      });
      
      return user;
    } catch (error) {
      console.error('❌ Error getting user by email:', error);
      throw error;
    }
  }

  /**
   * Uppdatera CRM-metadata för användare
   */
  async updateCrmMetadata(userId, crmData) {
    try {
      await this.cosmosService.connect();
      
      const update = {
        $set: {
          'crmMetadata.role': crmData.role,
          'crmMetadata.companyId': crmData.companyId,
          'crmMetadata.companyName': crmData.companyName,
          'crmMetadata.permissions': crmData.permissions,
          'crmMetadata.services': crmData.services || []
        }
      };

      const result = await this.cosmosService.updateOne(
        this.collection,
        { _id: ObjectId(userId) },
        update
      );

      return result;
    } catch (error) {
      console.error('❌ Error updating CRM metadata:', error);
      throw error;
    }
  }

  /**
   * Lägg till notering för användare
   */
  async addNote(userId, note, authorId) {
    try {
      await this.cosmosService.connect();
      
      const noteData = {
        id: new ObjectId().toString(),
        content: note,
        authorId: authorId,
        createdAt: new Date(),
        type: 'user_note'
      };

      const result = await this.cosmosService.updateOne(
        this.collection,
        { _id: ObjectId(userId) },
        { 
          $push: { 
            'crmMetadata.notes': noteData 
          } 
        }
      );

      return result;
    } catch (error) {
      console.error('❌ Error adding note:', error);
      throw error;
    }
  }

  /**
   * Lista alla användare med filter
   */
  async listUsers(filters = {}) {
    try {
      await this.cosmosService.connect();
      
      const query = {};
      
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      
      if (filters.role) {
        query['crmMetadata.role'] = filters.role;
      }
      
      if (filters.companyId) {
        query['crmMetadata.companyId'] = filters.companyId;
      }

      if (filters.search) {
        query.$or = [
          { email: { $regex: filters.search, $options: 'i' } },
          { displayName: { $regex: filters.search, $options: 'i' } },
          { firstName: { $regex: filters.search, $options: 'i' } },
          { lastName: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const options = {};
      if (filters.limit) {
        options.limit = parseInt(filters.limit);
      }
      if (filters.skip) {
        options.skip = parseInt(filters.skip);
      }

      // Ingen sortering - Cosmos DB MongoDB API har begränsade index
      // Sortering sker efter hämtning istället

      const users = await this.cosmosService.find(this.collection, query, options);
      
      // Rensa känslig data för API response
      return users.map(user => this.sanitizeUserForResponse(user));
    } catch (error) {
      console.error('❌ Error listing users:', error);
      throw error;
    }
  }

  /**
   * Räkna användare
   */
  async countUsers(filters = {}) {
    try {
      await this.cosmosService.connect();
      
      const query = {};
      
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      
      if (filters.role) {
        query['crmMetadata.role'] = filters.role;
      }

      return await this.cosmosService.countDocuments(this.collection, query);
    } catch (error) {
      console.error('❌ Error counting users:', error);
      throw error;
    }
  }

  /**
   * Soft delete användare
   */
  async deactivateUser(userId) {
    try {
      await this.cosmosService.connect();
      
      const result = await this.cosmosService.updateOne(
        this.collection,
        { _id: ObjectId(userId) },
        { 
          $set: { 
            isActive: false,
            deactivatedAt: new Date()
          } 
        }
      );

      return result;
    } catch (error) {
      console.error('❌ Error deactivating user:', error);
      throw error;
    }
  }

  /**
   * Aktivera användare igen
   */
  async activateUser(userId) {
    try {
      await this.cosmosService.connect();
      
      const result = await this.cosmosService.updateOne(
        this.collection,
        { _id: ObjectId(userId) },
        { 
          $set: { 
            isActive: true 
          },
          $unset: {
            deactivatedAt: 1
          }
        }
      );

      return result;
    } catch (error) {
      console.error('❌ Error activating user:', error);
      throw error;
    }
  }

  /**
   * Ta bort känslig data från user object för API response
   */
  sanitizeUserForResponse(user) {
    const sanitized = {
      id: user._id,
      azureObjectId: user.azureObjectId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      isActive: user.isActive,
      role: user.crmMetadata?.role || 'viewer',
      companyId: user.crmMetadata?.companyId,
      companyName: user.crmMetadata?.companyName,
      permissions: user.crmMetadata?.permissions || ['read'],
      services: user.crmMetadata?.services || [],
      source: user.source,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastSignIn: user.azureMetadata?.lastSignIn
    };

    return sanitized;
  }

  /**
   * Hämta användare med fullständig data (för admin)
   */
  async getUserById(userId, includeMetadata = false) {
    try {
      await this.cosmosService.connect();
      
      const user = await this.cosmosService.findOne(this.collection, {
        _id: ObjectId(userId)
      });

      if (!user) {
        return null;
      }

      if (includeMetadata) {
        return user; // Full data för admin
      } else {
        return this.sanitizeUserForResponse(user);
      }
    } catch (error) {
      console.error('❌ Error getting user by ID:', error);
      throw error;
    }
  }
}

module.exports = UserService;