/**
 * Azure AD B2C User Synchronization Module
 * Automatiskt synkroniserar användare från Azure B2C till CRM
 * 
 * Funktioner:
 * 1. Webhook från Azure B2C vid ny användare
 * 2. Microsoft Graph API för att hämta användare
 * 3. Automatisk skapande av CRM-användare
 * 4. Rollsynkronisering
 */

'use strict';

const https = require('https');
const fs = require('fs');

// ============================================
// KONFIGURATION
// ============================================

const graphConfig = {
  tenantId: process.env.AZURE_B2C_TENANT_ID || 'your-tenant-id',
  clientId: process.env.AZURE_B2C_GRAPH_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.AZURE_B2C_GRAPH_CLIENT_SECRET || 'your-client-secret',
  
  // Microsoft Graph API endpoints
  tokenEndpoint: `https://login.microsoftonline.com/${process.env.AZURE_B2C_TENANT_ID}/oauth2/v2.0/token`,
  usersEndpoint: 'https://graph.microsoft.com/v1.0/users',
  
  // Polling interval (om inte webhooks används)
  pollingIntervalMinutes: 15
};

// ============================================
// MICROSOFT GRAPH API CLIENT
// ============================================

class GraphAPIClient {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Hämta access token för Microsoft Graph API
   */
  async getAccessToken() {
    // Återanvänd token om det fortfarande är giltigt
    if (this.accessToken && this.tokenExpiresAt) {
      const now = Date.now();
      if (this.tokenExpiresAt > now + 5 * 60 * 1000) {
        return this.accessToken;
      }
    }

    // Hämta nytt token
    const tokenUrl = new URL(graphConfig.tokenEndpoint);
    const params = new URLSearchParams({
      client_id: graphConfig.clientId,
      client_secret: graphConfig.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

      return this.accessToken;

    } catch (error) {
      console.error('Failed to get Graph API access token:', error);
      throw error;
    }
  }

  /**
   * Hämta alla användare från Azure B2C
   */
  async getUsers(filter = null) {
    const token = await this.getAccessToken();
    
    let url = graphConfig.usersEndpoint;
    if (filter) {
      url += `?$filter=${encodeURIComponent(filter)}`;
    }

    // Inkludera custom attributes (extensions)
    url += (url.includes('?') ? '&' : '?') + '$select=id,displayName,givenName,surname,mail,userPrincipalName,identities,createdDateTime,jobTitle,companyName,mobilePhone,businessPhones,extension_CompanyId,extension_Role,extension_IsActive';

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Graph API request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.value || [];

    } catch (error) {
      console.error('Failed to get users from Graph API:', error);
      throw error;
    }
  }

  /**
   * Hämta en specifik användare
   */
  async getUser(userId) {
    const token = await this.getAccessToken();
    
    const url = `${graphConfig.usersEndpoint}/${userId}?$select=id,displayName,givenName,surname,mail,userPrincipalName,identities,createdDateTime,jobTitle,companyName,mobilePhone,businessPhones,extension_CompanyId,extension_Role,extension_IsActive`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Graph API request failed: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error(`Failed to get user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Hämta nya användare sedan senaste synk
   */
  async getNewUsers(sinceDateTime) {
    const isoDateTime = sinceDateTime.toISOString();
    const filter = `createdDateTime ge ${isoDateTime}`;
    return await this.getUsers(filter);
  }

  /**
   * Uppdatera custom attributes på B2C användare
   */
  async updateUserExtensions(userId, extensions) {
    const token = await this.getAccessToken();
    
    const url = `${graphConfig.usersEndpoint}/${userId}`;

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(extensions)
      });

      if (!response.ok) {
        throw new Error(`Failed to update user: ${response.status}`);
      }

      return true;

    } catch (error) {
      console.error(`Failed to update user ${userId}:`, error);
      throw error;
    }
  }
}

// ============================================
// USER SYNCHRONIZATION
// ============================================

class UserSynchronizer {
  constructor(crmState, logFunction) {
    this.state = crmState;
    this.log = logFunction || console.log;
    this.graphClient = new GraphAPIClient();
    this.lastSyncTime = null;
    this.pollingInterval = null;
  }

  /**
   * Konvertera Azure B2C användare till CRM-format
   */
  mapB2CUserToCRM(b2cUser) {
    // Hämta email från identities array
    const emailIdentity = b2cUser.identities?.find(id => id.signInType === 'emailAddress');
    const email = emailIdentity?.issuerAssignedId || b2cUser.mail || b2cUser.userPrincipalName;

    return {
      id: `b2c-${b2cUser.id}`,
      azureB2CId: b2cUser.id,
      username: email,
      email: email,
      name: b2cUser.displayName || `${b2cUser.givenName} ${b2cUser.surname}`.trim(),
      firstName: b2cUser.givenName,
      lastName: b2cUser.surname,
      role: b2cUser.extension_Role || b2cUser.jobTitle || 'sales',
      companyId: b2cUser.extension_CompanyId || null,
      companyName: b2cUser.companyName || null,
      phone: b2cUser.mobilePhone || b2cUser.businessPhones?.[0] || null,
      isActive: b2cUser.extension_IsActive !== false,
      createdAt: b2cUser.createdDateTime,
      syncedAt: new Date().toISOString(),
      source: 'azure-b2c'
    };
  }

  /**
   * Lägg till eller uppdatera användare i CRM
   */
  addOrUpdateUser(crmUser) {
    // Kontrollera om användare redan finns
    if (!this.state.users) {
      this.state.users = [];
    }

    const existingIndex = this.state.users.findIndex(u => 
      u.azureB2CId === crmUser.azureB2CId || u.email === crmUser.email
    );

    if (existingIndex >= 0) {
      // Uppdatera befintlig användare
      const oldUser = this.state.users[existingIndex];
      this.state.users[existingIndex] = {
        ...oldUser,
        ...crmUser,
        updatedAt: new Date().toISOString()
      };
      
      this.log('User updated in CRM:', crmUser.email);
      return { action: 'updated', user: this.state.users[existingIndex] };
    } else {
      // Lägg till ny användare
      this.state.users.push(crmUser);
      
      this.log('New user added to CRM:', crmUser.email);
      return { action: 'created', user: crmUser };
    }
  }

  /**
   * Synkronisera alla användare från Azure B2C
   */
  async syncAllUsers() {
    try {
      this.log('Starting full user sync from Azure B2C...');

      const b2cUsers = await this.graphClient.getUsers();
      
      let created = 0;
      let updated = 0;

      for (const b2cUser of b2cUsers) {
        const crmUser = this.mapB2CUserToCRM(b2cUser);
        const result = this.addOrUpdateUser(crmUser);
        
        if (result.action === 'created') created++;
        if (result.action === 'updated') updated++;
      }

      this.lastSyncTime = new Date();

      this.log(`User sync completed: ${created} created, ${updated} updated, ${b2cUsers.length} total`);

      return {
        success: true,
        created,
        updated,
        total: b2cUsers.length,
        syncTime: this.lastSyncTime
      };

    } catch (error) {
      console.error('User sync failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Synkronisera endast nya användare
   */
  async syncNewUsers() {
    try {
      if (!this.lastSyncTime) {
        // Om aldrig synkat tidigare, gör full sync
        return await this.syncAllUsers();
      }

      this.log('Checking for new users since', this.lastSyncTime);

      const newB2CUsers = await this.graphClient.getNewUsers(this.lastSyncTime);
      
      let created = 0;

      for (const b2cUser of newB2CUsers) {
        const crmUser = this.mapB2CUserToCRM(b2cUser);
        const result = this.addOrUpdateUser(crmUser);
        
        if (result.action === 'created') created++;
      }

      this.lastSyncTime = new Date();

      this.log(`New user sync completed: ${created} new users`);

      return {
        success: true,
        created,
        total: newB2CUsers.length,
        syncTime: this.lastSyncTime
      };

    } catch (error) {
      console.error('New user sync failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Synkronisera en specifik användare
   */
  async syncUser(azureB2CId) {
    try {
      const b2cUser = await this.graphClient.getUser(azureB2CId);
      
      if (!b2cUser) {
        return {
          success: false,
          error: 'User not found in Azure B2C'
        };
      }

      const crmUser = this.mapB2CUserToCRM(b2cUser);
      const result = this.addOrUpdateUser(crmUser);

      return {
        success: true,
        action: result.action,
        user: result.user
      };

    } catch (error) {
      console.error(`Failed to sync user ${azureB2CId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Starta automatisk polling (om webhooks inte används)
   */
  startAutoSync(intervalMinutes = null) {
    if (this.pollingInterval) {
      this.stopAutoSync();
    }

    const interval = (intervalMinutes || graphConfig.pollingIntervalMinutes) * 60 * 1000;

    this.log(`Starting auto-sync with ${intervalMinutes || graphConfig.pollingIntervalMinutes} minute interval`);

    // Initial sync
    this.syncNewUsers();

    // Scheduled sync
    this.pollingInterval = setInterval(() => {
      this.syncNewUsers();
    }, interval);
  }

  /**
   * Stoppa automatisk polling
   */
  stopAutoSync() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.log('Auto-sync stopped');
    }
  }

  /**
   * Koppla CRM-användare till mäklarföretag automatiskt
   */
  async linkUsersToCompanies() {
    if (!this.state.users || !this.state.companies) return;

    let linked = 0;

    for (const user of this.state.users) {
      // Hoppa över om redan kopplad
      if (user.companyId) continue;

      // Försök hitta företag baserat på companyName
      if (user.companyName) {
        const company = this.state.companies.find(c => 
          c.name.toLowerCase().includes(user.companyName.toLowerCase()) ||
          user.companyName.toLowerCase().includes(c.name.toLowerCase())
        );

        if (company) {
          user.companyId = company.id;
          linked++;
          this.log(`Linked user ${user.email} to company ${company.name}`);
          
          // Uppdatera även i Azure B2C
          try {
            await this.graphClient.updateUserExtensions(user.azureB2CId, {
              extension_CompanyId: company.id
            });
          } catch (error) {
            console.warn(`Could not update B2C user extension for ${user.email}`);
          }
        }
      }
    }

    this.log(`Linked ${linked} users to companies`);
    return linked;
  }
}

// ============================================
// EXPRESS ENDPOINTS
// ============================================

/**
 * Skapa Express endpoints för user sync
 */
function createUserSyncEndpoints(app, state, logDataAccess) {
  const synchronizer = new UserSynchronizer(state, (msg) => {
    console.log('[UserSync]', msg);
  });

  /**
   * Webhook endpoint för Azure B2C
   * Azure B2C kan konfigureras att skicka webhooks när nya användare skapas
   */
  app.post('/api/webhooks/b2c/user-created', async (req, res) => {
    try {
      const { userId, eventType, eventTime } = req.body;

      // Verifiera webhook signature (viktigt för säkerhet!)
      const signature = req.headers['x-azure-signature'];
      if (!verifyWebhookSignature(req.body, signature)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      console.log('Received B2C webhook:', eventType, userId);

      // Synkronisera användaren
      const result = await synchronizer.syncUser(userId);

      if (result.success) {
        // Logga händelse
        if (logDataAccess) {
          logDataAccess('system', 'user', result.user.id, {
            action: 'b2c_user_synced',
            eventType,
            azureB2CId: userId
          });
        }

        res.json({
          success: true,
          action: result.action,
          user: result.user
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Manuell trigger för full sync (Admin only)
   */
  app.post('/api/users/sync-from-b2c', async (req, res) => {
    try {
      // Kräver admin-roll
      if (!req.user || !req.user.roles.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { mode } = req.body; // 'full' eller 'new'

      let result;
      if (mode === 'full') {
        result = await synchronizer.syncAllUsers();
      } else {
        result = await synchronizer.syncNewUsers();
      }

      // Logga
      if (logDataAccess) {
        logDataAccess(req.user.id, 'system', 'user_sync', {
          mode,
          result
        });
      }

      res.json(result);

    } catch (error) {
      console.error('Manual sync error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Hämta sync status
   */
  app.get('/api/users/sync-status', (req, res) => {
    res.json({
      lastSyncTime: synchronizer.lastSyncTime,
      autoSyncEnabled: !!synchronizer.pollingInterval,
      totalUsers: state.users?.length || 0,
      b2cUsers: state.users?.filter(u => u.source === 'azure-b2c').length || 0
    });
  });

  /**
   * Koppla användare till företag
   */
  app.post('/api/users/link-to-companies', async (req, res) => {
    try {
      if (!req.user || !req.user.roles.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const linked = await synchronizer.linkUsersToCompanies();

      res.json({
        success: true,
        linked
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Lista alla användare
   */
  app.get('/api/users', (req, res) => {
    const users = state.users || [];
    
    // Filtrera känslig info
    const sanitizedUsers = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      companyId: u.companyId,
      companyName: u.companyName,
      isActive: u.isActive,
      createdAt: u.createdAt,
      source: u.source
    }));

    res.json(sanitizedUsers);
  });

  // ============================================
  // USER MANAGEMENT (Create/Update/Delete)
  // ============================================

  const { AzureB2CUserManager } = require('./azure-b2c-user-management');
  const userManager = new AzureB2CUserManager(synchronizer.graphClient);

  /**
   * Skapa ny användare i Azure B2C från CRM
   * Användningsfall: Säljare har sålt tjänst och vill ge kunden tillgång
   */
  app.post('/api/users/create-in-b2c', async (req, res) => {
    try {
      // Kräver Sales+ roll
      if (!req.user || !['sales', 'manager', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const {
        email,
        firstName,
        lastName,
        displayName,
        companyId,
        companyName,
        role = 'sales',
        services = [],
        phone,
        sendInviteEmail = true
      } = req.body;

      // Validering
      if (!email || !firstName || !lastName) {
        return res.status(400).json({
          error: 'Email, firstName och lastName är obligatoriska'
        });
      }

      // Skapa användare i Azure B2C
      const result = await userManager.createUser({
        email,
        firstName,
        lastName,
        displayName,
        companyId,
        companyName,
        role,
        services,
        phone,
        sendInviteEmail
      });

      // Lägg även till i CRM
      const crmUser = {
        id: `b2c-${result.userId}`,
        azureB2CId: result.userId,
        username: email,
        email: email,
        name: displayName || `${firstName} ${lastName}`,
        firstName,
        lastName,
        role,
        companyId,
        companyName,
        phone,
        services,
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: req.user.id,
        source: 'crm-created'
      };

      if (!state.users) state.users = [];
      state.users.push(crmUser);

      // Logga händelse
      if (logDataAccess) {
        logDataAccess(req.user.id, 'user', crmUser.id, {
          action: 'user_created_in_b2c',
          email,
          services
        });
      }

      res.json({
        success: true,
        user: crmUser,
        temporaryPassword: result.temporaryPassword,
        message: result.message
      });

    } catch (error) {
      console.error('Failed to create user in B2C:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Ge användare tillgång till tjänst
   */
  app.post('/api/users/:userId/grant-service', async (req, res) => {
    try {
      // Kräver Sales+ roll
      if (!req.user || !['sales', 'manager', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { userId } = req.params;
      const { serviceName, expiresAt } = req.body;

      if (!serviceName) {
        return res.status(400).json({ error: 'serviceName är obligatoriskt' });
      }

      // Hitta användare i CRM
      const user = state.users?.find(u => u.id === userId || u.azureB2CId === userId);
      if (!user || !user.azureB2CId) {
        return res.status(404).json({ error: 'Användare inte hittad eller inte synkad med B2C' });
      }

      // Ge tillgång i Azure B2C
      const result = await userManager.grantServiceAccess(
        user.azureB2CId,
        serviceName,
        expiresAt
      );

      // Uppdatera i CRM
      if (!user.services) user.services = [];
      const existingService = user.services.find(s => s.name === serviceName);
      if (existingService) {
        existingService.grantedAt = new Date().toISOString();
        existingService.expiresAt = expiresAt;
      } else {
        user.services.push({
          name: serviceName,
          grantedAt: new Date().toISOString(),
          expiresAt: expiresAt,
          active: true
        });
      }

      // Logga
      if (logDataAccess) {
        logDataAccess(req.user.id, 'user', userId, {
          action: 'service_access_granted',
          service: serviceName,
          expiresAt
        });
      }

      res.json(result);

    } catch (error) {
      console.error('Failed to grant service access:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Ta bort tillgång till tjänst
   */
  app.post('/api/users/:userId/revoke-service', async (req, res) => {
    try {
      if (!req.user || !['manager', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Manager or Admin access required' });
      }

      const { userId } = req.params;
      const { serviceName } = req.body;

      const user = state.users?.find(u => u.id === userId || u.azureB2CId === userId);
      if (!user || !user.azureB2CId) {
        return res.status(404).json({ error: 'Användare inte hittad' });
      }

      // Ta bort i Azure B2C
      const result = await userManager.revokeServiceAccess(user.azureB2CId, serviceName);

      // Uppdatera i CRM
      if (user.services) {
        user.services = user.services.filter(s => s.name !== serviceName);
      }

      // Logga
      if (logDataAccess) {
        logDataAccess(req.user.id, 'user', userId, {
          action: 'service_access_revoked',
          service: serviceName
        });
      }

      res.json(result);

    } catch (error) {
      console.error('Failed to revoke service access:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Uppdatera användarroll
   */
  app.patch('/api/users/:userId/role', async (req, res) => {
    try {
      if (!req.user || !['manager', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Manager or Admin access required' });
      }

      const { userId } = req.params;
      const { role } = req.body;

      const validRoles = ['sales', 'manager', 'admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const user = state.users?.find(u => u.id === userId || u.azureB2CId === userId);
      if (!user) {
        return res.status(404).json({ error: 'Användare inte hittad' });
      }

      // Uppdatera i Azure B2C om användaren har B2C ID
      if (user.azureB2CId) {
        await userManager.updateUser(user.azureB2CId, { role });
      }

      // Uppdatera i CRM
      user.role = role;

      // Logga
      if (logDataAccess) {
        logDataAccess(req.user.id, 'user', userId, {
          action: 'role_updated',
          newRole: role
        });
      }

      res.json({
        success: true,
        message: 'Roll uppdaterad'
      });

    } catch (error) {
      console.error('Failed to update user role:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Inaktivera användare
   */
  app.post('/api/users/:userId/disable', async (req, res) => {
    try {
      if (!req.user || !['manager', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Manager or Admin access required' });
      }

      const { userId } = req.params;
      const user = state.users?.find(u => u.id === userId || u.azureB2CId === userId);
      
      if (!user) {
        return res.status(404).json({ error: 'Användare inte hittad' });
      }

      // Inaktivera i Azure B2C
      if (user.azureB2CId) {
        await userManager.disableUser(user.azureB2CId);
      }

      // Uppdatera i CRM
      user.isActive = false;

      // Logga
      if (logDataAccess) {
        logDataAccess(req.user.id, 'user', userId, {
          action: 'user_disabled'
        });
      }

      res.json({
        success: true,
        message: 'Användare inaktiverad'
      });

    } catch (error) {
      console.error('Failed to disable user:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Aktivera användare
   */
  app.post('/api/users/:userId/enable', async (req, res) => {
    try {
      if (!req.user || !['manager', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Manager or Admin access required' });
      }

      const { userId } = req.params;
      const user = state.users?.find(u => u.id === userId || u.azureB2CId === userId);
      
      if (!user) {
        return res.status(404).json({ error: 'Användare inte hittad' });
      }

      // Aktivera i Azure B2C
      if (user.azureB2CId) {
        await userManager.enableUser(user.azureB2CId);
      }

      // Uppdatera i CRM
      user.isActive = true;

      // Logga
      if (logDataAccess) {
        logDataAccess(req.user.id, 'user', userId, {
          action: 'user_enabled'
        });
      }

      res.json({
        success: true,
        message: 'Användare aktiverad'
      });

    } catch (error) {
      console.error('Failed to enable user:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Återställ lösenord
   */
  app.post('/api/users/:userId/reset-password', async (req, res) => {
    try {
      if (!req.user || !['manager', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Manager or Admin access required' });
      }

      const { userId } = req.params;
      const { sendEmail = true } = req.body;

      const user = state.users?.find(u => u.id === userId || u.azureB2CId === userId);
      
      if (!user || !user.azureB2CId) {
        return res.status(404).json({ error: 'Användare inte hittad eller inte synkad med B2C' });
      }

      // Återställ lösenord i Azure B2C
      const result = await userManager.resetPassword(user.azureB2CId);

      // Skicka mail med nytt lösenord
      if (sendEmail) {
        await userManager.sendWelcomeEmail(
          user.email,
          user.firstName,
          result.temporaryPassword,
          user.services?.map(s => s.name) || []
        );
      }

      // Logga
      if (logDataAccess) {
        logDataAccess(req.user.id, 'user', userId, {
          action: 'password_reset',
          emailSent: sendEmail
        });
      }

      res.json({
        success: true,
        temporaryPassword: sendEmail ? null : result.temporaryPassword,
        message: sendEmail ? 'Lösenord återställt och mail skickat' : 'Lösenord återställt'
      });

    } catch (error) {
      console.error('Failed to reset password:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Radera användare (endast Admin)
   */
  app.delete('/api/users/:userId', async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { userId } = req.params;
      const { deleteFromB2C = false } = req.body;

      const userIndex = state.users?.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        return res.status(404).json({ error: 'Användare inte hittad' });
      }

      const user = state.users[userIndex];

      // Radera från Azure B2C om önskat
      if (deleteFromB2C && user.azureB2CId) {
        await userManager.deleteUser(user.azureB2CId);
      }

      // Ta bort från CRM
      state.users.splice(userIndex, 1);

      // Logga
      if (logDataAccess) {
        logDataAccess(req.user.id, 'user', userId, {
          action: 'user_deleted',
          deletedFromB2C: deleteFromB2C
        });
      }

      res.json({
        success: true,
        message: deleteFromB2C ? 'Användare raderad från både CRM och Azure B2C' : 'Användare raderad från CRM'
      });

    } catch (error) {
      console.error('Failed to delete user:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Starta auto-sync om konfigurerat
  if (process.env.ENABLE_AUTO_USER_SYNC === 'true') {
    synchronizer.startAutoSync();
  }

  return synchronizer;
}

// ============================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================

function verifyWebhookSignature(payload, signature) {
  // Implementera HMAC signature verification
  // Azure kan skicka en HMAC-SHA256 signature i headers
  
  const webhookSecret = process.env.AZURE_B2C_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('No webhook secret configured, skipping signature verification');
    return true; // I development
  }

  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', webhookSecret);
  const calculatedSignature = hmac.update(JSON.stringify(payload)).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedSignature)
  );
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  GraphAPIClient,
  UserSynchronizer,
  createUserSyncEndpoints
};
