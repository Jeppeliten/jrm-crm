/**
 * Azure AD B2C User Management Module
 * Tvåvägssynkronisering: CRM ↔ Azure B2C
 * 
 * Funktioner:
 * 1. Skapa nya användare i Azure B2C från CRM
 * 2. Tilldela roller och åtkomst
 * 3. Ge tillgång till specifika tjänster
 * 4. Hantera användarstatus (aktivera/inaktivera)
 * 5. Återställ lösenord
 * 6. Uppdatera användarinformation
 */

'use strict';

const crypto = require('crypto');

// ============================================
// AZURE B2C USER CREATION
// ============================================

class AzureB2CUserManager {
  constructor(graphClient) {
    this.graphClient = graphClient;
  }

  /**
   * Skapa ny användare i Azure B2C
   * Kallas när säljare lägger till kund i CRM
   */
  async createUser(userData) {
    try {
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
        sendInviteEmail = true,
        temporaryPassword = null
      } = userData;

      // Validering
      if (!email || !firstName || !lastName) {
        throw new Error('Email, firstName och lastName är obligatoriska');
      }

      // Generera temporärt lösenord om inte angivet
      const password = temporaryPassword || this.generateTemporaryPassword();

      // Skapa user object för Azure B2C
      const b2cUser = {
        accountEnabled: true,
        displayName: displayName || `${firstName} ${lastName}`,
        givenName: firstName,
        surname: lastName,
        mailNickname: email.split('@')[0],
        
        // Identities (email-baserad login)
        identities: [
          {
            signInType: 'emailAddress',
            issuer: `${process.env.AZURE_B2C_TENANT_NAME}.onmicrosoft.com`,
            issuerAssignedId: email
          }
        ],

        // Password profile
        passwordProfile: {
          forceChangePasswordNextSignIn: true,
          password: password
        },

        // Contact info
        mobilePhone: phone,
        businessPhones: phone ? [phone] : [],
        mail: email,

        // Custom extensions (måste matcha er B2C konfiguration)
        // Format: extension_{app-id-without-dashes}_AttributeName
        [`extension_${this.getExtensionAttributePrefix()}_CompanyId`]: companyId,
        [`extension_${this.getExtensionAttributePrefix()}_CompanyName`]: companyName,
        [`extension_${this.getExtensionAttributePrefix()}_Role`]: role,
        [`extension_${this.getExtensionAttributePrefix()}_Services`]: JSON.stringify(services),
        [`extension_${this.getExtensionAttributePrefix()}_IsActive`]: true,
        [`extension_${this.getExtensionAttributePrefix()}_CreatedBy`]: 'CRM',
        [`extension_${this.getExtensionAttributePrefix()}_CreatedAt`]: new Date().toISOString()
      };

      // Skapa användare via Graph API
      const token = await this.graphClient.getAccessToken();
      
      const response = await fetch('https://graph.microsoft.com/v1.0/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(b2cUser)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create user in B2C: ${error.error?.message || response.statusText}`);
      }

      const createdUser = await response.json();

      // Skicka välkomstmail med inloggningsuppgifter
      if (sendInviteEmail) {
        await this.sendWelcomeEmail(email, firstName, password, services);
      }

      return {
        success: true,
        userId: createdUser.id,
        email: email,
        temporaryPassword: sendInviteEmail ? null : password, // Returnera endast om mail inte skickas
        message: 'Användare skapad i Azure B2C'
      };

    } catch (error) {
      console.error('Failed to create B2C user:', error);
      throw error;
    }
  }

  /**
   * Uppdatera befintlig användare i Azure B2C
   */
  async updateUser(userId, updates) {
    try {
      const token = await this.graphClient.getAccessToken();
      
      const updateData = {};

      // Standard fields
      if (updates.firstName) updateData.givenName = updates.firstName;
      if (updates.lastName) updateData.surname = updates.lastName;
      if (updates.displayName) updateData.displayName = updates.displayName;
      if (updates.phone) {
        updateData.mobilePhone = updates.phone;
        updateData.businessPhones = [updates.phone];
      }

      // Custom extensions
      const prefix = this.getExtensionAttributePrefix();
      if (updates.companyId) updateData[`extension_${prefix}_CompanyId`] = updates.companyId;
      if (updates.companyName) updateData[`extension_${prefix}_CompanyName`] = updates.companyName;
      if (updates.role) updateData[`extension_${prefix}_Role`] = updates.role;
      if (updates.services) updateData[`extension_${prefix}_Services`] = JSON.stringify(updates.services);
      if (updates.isActive !== undefined) updateData[`extension_${prefix}_IsActive`] = updates.isActive;

      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to update user: ${error.error?.message || response.statusText}`);
      }

      return {
        success: true,
        message: 'Användare uppdaterad i Azure B2C'
      };

    } catch (error) {
      console.error('Failed to update B2C user:', error);
      throw error;
    }
  }

  /**
   * Ge användare tillgång till specifik tjänst
   */
  async grantServiceAccess(userId, serviceName, expiresAt = null) {
    try {
      const token = await this.graphClient.getAccessToken();
      
      // Hämta nuvarande tjänster
      const user = await this.graphClient.getUser(userId);
      const prefix = this.getExtensionAttributePrefix();
      const servicesAttr = `extension_${prefix}_Services`;
      
      let services = [];
      try {
        services = JSON.parse(user[servicesAttr] || '[]');
      } catch {
        services = [];
      }

      // Lägg till ny tjänst om den inte redan finns
      const existingService = services.find(s => s.name === serviceName);
      if (existingService) {
        // Uppdatera expiry date
        existingService.grantedAt = new Date().toISOString();
        existingService.expiresAt = expiresAt;
      } else {
        services.push({
          name: serviceName,
          grantedAt: new Date().toISOString(),
          expiresAt: expiresAt,
          active: true
        });
      }

      // Uppdatera användare
      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [servicesAttr]: JSON.stringify(services)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to grant service access');
      }

      return {
        success: true,
        service: serviceName,
        expiresAt: expiresAt,
        message: `Tillgång till ${serviceName} beviljad`
      };

    } catch (error) {
      console.error('Failed to grant service access:', error);
      throw error;
    }
  }

  /**
   * Ta bort användares tillgång till tjänst
   */
  async revokeServiceAccess(userId, serviceName) {
    try {
      const token = await this.graphClient.getAccessToken();
      const user = await this.graphClient.getUser(userId);
      const prefix = this.getExtensionAttributePrefix();
      const servicesAttr = `extension_${prefix}_Services`;
      
      let services = [];
      try {
        services = JSON.parse(user[servicesAttr] || '[]');
      } catch {
        services = [];
      }

      // Ta bort tjänsten
      services = services.filter(s => s.name !== serviceName);

      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [servicesAttr]: JSON.stringify(services)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to revoke service access');
      }

      return {
        success: true,
        message: `Tillgång till ${serviceName} återkallad`
      };

    } catch (error) {
      console.error('Failed to revoke service access:', error);
      throw error;
    }
  }

  /**
   * Inaktivera användare (soft delete)
   */
  async disableUser(userId) {
    try {
      const token = await this.graphClient.getAccessToken();
      
      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountEnabled: false,
          [`extension_${this.getExtensionAttributePrefix()}_IsActive`]: false
        })
      });

      if (!response.ok) {
        throw new Error('Failed to disable user');
      }

      return {
        success: true,
        message: 'Användare inaktiverad'
      };

    } catch (error) {
      console.error('Failed to disable user:', error);
      throw error;
    }
  }

  /**
   * Aktivera användare
   */
  async enableUser(userId) {
    try {
      const token = await this.graphClient.getAccessToken();
      
      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountEnabled: true,
          [`extension_${this.getExtensionAttributePrefix()}_IsActive`]: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to enable user');
      }

      return {
        success: true,
        message: 'Användare aktiverad'
      };

    } catch (error) {
      console.error('Failed to enable user:', error);
      throw error;
    }
  }

  /**
   * Radera användare permanent
   */
  async deleteUser(userId) {
    try {
      const token = await this.graphClient.getAccessToken();
      
      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok && response.status !== 204) {
        throw new Error('Failed to delete user');
      }

      return {
        success: true,
        message: 'Användare raderad från Azure B2C'
      };

    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }

  /**
   * Återställ lösenord
   */
  async resetPassword(userId, newPassword = null, requireChange = true) {
    try {
      const password = newPassword || this.generateTemporaryPassword();
      const token = await this.graphClient.getAccessToken();
      
      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          passwordProfile: {
            forceChangePasswordNextSignIn: requireChange,
            password: password
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reset password');
      }

      return {
        success: true,
        temporaryPassword: password,
        message: 'Lösenord återställt'
      };

    } catch (error) {
      console.error('Failed to reset password:', error);
      throw error;
    }
  }

  /**
   * Generera säkert temporärt lösenord
   */
  generateTemporaryPassword(length = 16) {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    // Minst en av varje typ
    password += lowercase[crypto.randomInt(lowercase.length)];
    password += uppercase[crypto.randomInt(uppercase.length)];
    password += numbers[crypto.randomInt(numbers.length)];
    password += symbols[crypto.randomInt(symbols.length)];
    
    // Fyll på till önskad längd
    for (let i = password.length; i < length; i++) {
      password += allChars[crypto.randomInt(allChars.length)];
    }
    
    // Blanda
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Hämta extension attribute prefix
   * Detta är app ID för B2C extensions app (utan bindestreck)
   */
  getExtensionAttributePrefix() {
    // Hämta från environment eller konfig
    // Format: b2c-extensions-app. Do not modify. Used by AADB2C for storing user data.
    // Hitta i Azure Portal → App registrations → b2c-extensions-app → Application ID
    return process.env.AZURE_B2C_EXTENSIONS_APP_ID_PREFIX || 'your-app-id-without-dashes';
  }

  /**
   * Skicka välkomstmail till ny användare
   */
  async sendWelcomeEmail(email, firstName, temporaryPassword, services) {
    // Implementera med er mail-tjänst (SendGrid, Azure Communication Services, etc.)
    
    const emailBody = `
      Hej ${firstName}!
      
      Välkommen till Värderingsdata! Ditt konto har skapats.
      
      Inloggningsuppgifter:
      E-post: ${email}
      Temporärt lösenord: ${temporaryPassword}
      
      Logga in här: https://varderingsdata.se/login
      
      Du kommer att uppmanas att byta lösenord vid första inloggningen.
      
      Du har tillgång till följande tjänster:
      ${services.map(s => `- ${s}`).join('\n')}
      
      Vid frågor, kontakta oss på support@varderingsdata.se
      
      Med vänliga hälsningar,
      Värderingsdata Team
    `;

    console.log('Welcome email would be sent to:', email);
    console.log('Email body:', emailBody);

    // TODO: Implementera faktisk mail-sending
    // await sendEmail({
    //   to: email,
    //   subject: 'Välkommen till Värderingsdata',
    //   text: emailBody
    // });

    return true;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  AzureB2CUserManager
};
