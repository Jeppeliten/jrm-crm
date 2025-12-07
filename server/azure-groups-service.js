/**
 * Azure Groups Service
 * Hanterar gruppmembership via Microsoft Graph API
 * Används för att administrera användarroller genom Azure AD-grupper
 */

const https = require('https');

class AzureGroupsService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    
    // Validera konfiguration
    this.validateConfig();
  }

  /**
   * Validera att nödvändiga environment variabler finns
   */
  validateConfig() {
    const required = [
      'AZURE_B2C_TENANT_ID',
      'AZURE_B2C_GRAPH_CLIENT_ID', 
      'AZURE_B2C_GRAPH_CLIENT_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      console.warn(`Azure Groups Service: Missing environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Hämta access token för Microsoft Graph
   */
  async getAccessToken() {
    // Återanvänd token om det fortfarande är giltigt (med 1 min marginal)
    if (this.accessToken && this.tokenExpiresAt > Date.now() + 60000) {
      return this.accessToken;
    }

    const tokenData = new URLSearchParams({
      'client_id': process.env.AZURE_B2C_GRAPH_CLIENT_ID,
      'client_secret': process.env.AZURE_B2C_GRAPH_CLIENT_SECRET,
      'scope': 'https://graph.microsoft.com/.default',
      'grant_type': 'client_credentials'
    });

    try {
      const response = await this.makeRequest({
        hostname: 'login.microsoftonline.com',
        path: `/${process.env.AZURE_B2C_TENANT_ID}/oauth2/v2.0/token`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(tokenData)
        }
      }, tokenData);

      this.accessToken = response.access_token;
      this.tokenExpiresAt = Date.now() + (response.expires_in * 1000);

      console.log('Azure Groups Service: Successfully obtained access token');
      return this.accessToken;

    } catch (error) {
      console.error('Azure Groups Service: Failed to get access token:', error.message);
      throw new Error('Failed to authenticate with Microsoft Graph API');
    }
  }

  /**
   * Hämta användarens gruppmembership
   */
  async getUserGroups(userId) {
    try {
      const token = await this.getAccessToken();

      const response = await this.makeRequest({
        hostname: 'graph.microsoft.com',
        path: `/v1.0/users/${userId}/memberOf?$select=id,displayName,securityEnabled`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Filtrera endast säkerhetsgrupper och returnera IDs
      const securityGroups = response.value
        .filter(group => group['@odata.type'] === '#microsoft.graph.group')
        .filter(group => group.securityEnabled === true)
        .map(group => ({
          id: group.id,
          displayName: group.displayName
        }));

      console.log(`Azure Groups Service: User ${userId} is member of ${securityGroups.length} security groups`);
      return securityGroups.map(g => g.id); // Returnera endast IDs för kompatibilitet

    } catch (error) {
      console.error(`Azure Groups Service: Failed to get groups for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Hämta detaljerad information om användarens grupper
   */
  async getUserGroupsDetailed(userId) {
    try {
      const token = await this.getAccessToken();

      const response = await this.makeRequest({
        hostname: 'graph.microsoft.com',
        path: `/v1.0/users/${userId}/memberOf?$select=id,displayName,description,securityEnabled`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const securityGroups = response.value
        .filter(group => group['@odata.type'] === '#microsoft.graph.group')
        .filter(group => group.securityEnabled === true)
        .map(group => ({
          id: group.id,
          displayName: group.displayName,
          description: group.description || ''
        }));

      return securityGroups;

    } catch (error) {
      console.error(`Azure Groups Service: Failed to get detailed groups for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Hämta alla säkerhetsgrupper i tenanten
   */
  async getAllSecurityGroups() {
    try {
      const token = await this.getAccessToken();

      const response = await this.makeRequest({
        hostname: 'graph.microsoft.com',
        path: `/v1.0/groups?$filter=securityEnabled eq true&$select=id,displayName,description`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const groups = response.value.map(group => ({
        id: group.id,
        displayName: group.displayName,
        description: group.description || ''
      }));

      console.log(`Azure Groups Service: Found ${groups.length} security groups in tenant`);
      return groups;

    } catch (error) {
      console.error('Azure Groups Service: Failed to get all security groups:', error.message);
      throw error;
    }
  }

  /**
   * Lägg till användare i grupp
   */
  async addUserToGroup(userId, groupId) {
    try {
      const token = await this.getAccessToken();

      const requestBody = JSON.stringify({
        '@odata.id': `https://graph.microsoft.com/v1.0/users/${userId}`
      });

      await this.makeRequest({
        hostname: 'graph.microsoft.com',
        path: `/v1.0/groups/${groupId}/members/$ref`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      }, requestBody);

      console.log(`Azure Groups Service: Added user ${userId} to group ${groupId}`);

    } catch (error) {
      if (error.message.includes('One or more added object references already exist')) {
        console.log(`Azure Groups Service: User ${userId} is already member of group ${groupId}`);
        return; // Inte ett fel om användaren redan är medlem
      }
      
      console.error(`Azure Groups Service: Failed to add user ${userId} to group ${groupId}:`, error.message);
      throw error;
    }
  }

  /**
   * Ta bort användare från grupp
   */
  async removeUserFromGroup(userId, groupId) {
    try {
      const token = await this.getAccessToken();

      await this.makeRequest({
        hostname: 'graph.microsoft.com',
        path: `/v1.0/groups/${groupId}/members/${userId}/$ref`,
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log(`Azure Groups Service: Removed user ${userId} from group ${groupId}`);

    } catch (error) {
      if (error.message.includes('does not exist or one of its queried reference-property objects are not present')) {
        console.log(`Azure Groups Service: User ${userId} is not member of group ${groupId}`);
        return; // Inte ett fel om användaren inte är medlem
      }

      console.error(`Azure Groups Service: Failed to remove user ${userId} from group ${groupId}:`, error.message);
      throw error;
    }
  }

  /**
   * Kontrollera om användare är medlem i specifik grupp
   */
  async isUserInGroup(userId, groupId) {
    try {
      const userGroups = await this.getUserGroups(userId);
      return userGroups.includes(groupId);
    } catch (error) {
      console.error(`Azure Groups Service: Failed to check group membership for user ${userId}:`, error.message);
      return false;
    }
  }

  /**
   * Hämta alla medlemmar i en grupp
   */
  async getGroupMembers(groupId) {
    try {
      const token = await this.getAccessToken();

      const response = await this.makeRequest({
        hostname: 'graph.microsoft.com',
        path: `/v1.0/groups/${groupId}/members?$select=id,displayName,mail,userPrincipalName`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const members = response.value
        .filter(member => member['@odata.type'] === '#microsoft.graph.user')
        .map(member => ({
          id: member.id,
          displayName: member.displayName,
          email: member.mail || member.userPrincipalName,
          userPrincipalName: member.userPrincipalName
        }));

      console.log(`Azure Groups Service: Group ${groupId} has ${members.length} members`);
      return members;

    } catch (error) {
      console.error(`Azure Groups Service: Failed to get members for group ${groupId}:`, error.message);
      throw error;
    }
  }

  /**
   * Synkronisera användarens grupper från Azure AD
   * Används för att uppdatera CRM-användare med senaste gruppmembership
   */
  async syncUserRoles(userId) {
    try {
      const groups = await this.getUserGroups(userId);
      const groupsDetailed = await this.getUserGroupsDetailed(userId);
      
      // Här kan du lägga till logik för att uppdatera CRM-användarens roller
      const roleMapping = {
        [process.env.AZURE_AD_GROUP_ADMIN]: 'admin',
        [process.env.AZURE_AD_GROUP_MANAGER]: 'manager',
        [process.env.AZURE_AD_GROUP_SALES]: 'sales',
        [process.env.AZURE_AD_GROUP_VIEWER]: 'viewer'
      };

      const userRoles = groups
        .map(groupId => roleMapping[groupId])
        .filter(role => role); // Ta bort undefined värden

      return {
        groups: groups,
        groupsDetailed: groupsDetailed,
        roles: userRoles,
        primaryRole: this.getPrimaryRole(userRoles)
      };

    } catch (error) {
      console.error(`Azure Groups Service: Failed to sync roles for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Hitta primär roll baserat på rollhierarki
   */
  getPrimaryRole(roles) {
    const priorities = { 'admin': 4, 'manager': 3, 'sales': 2, 'viewer': 1 };
    let highestRole = 'viewer';
    let highestPriority = 0;

    roles.forEach(role => {
      if (priorities[role] > highestPriority) {
        highestRole = role;
        highestPriority = priorities[role];
      }
    });

    return highestRole;
  }

  /**
   * Hjälpfunktion för HTTP-requests till Microsoft Graph
   */
  makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const response = body ? JSON.parse(body) : {};
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              const errorMessage = response.error?.message || 
                                 response.error_description || 
                                 `HTTP ${res.statusCode}: ${body}`;
              reject(new Error(errorMessage));
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      // Timeout efter 30 sekunder
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.write(data);
      }

      req.end();
    });
  }

  /**
   * Testa anslutningen till Microsoft Graph
   */
  async testConnection() {
    try {
      const token = await this.getAccessToken();
      
      // Testa med en enkel förfrågan
      await this.makeRequest({
        hostname: 'graph.microsoft.com',
        path: '/v1.0/me',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Azure Groups Service: Connection test successful');
      return true;

    } catch (error) {
      console.error('Azure Groups Service: Connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = AzureGroupsService;