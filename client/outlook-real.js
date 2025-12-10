/**
 * Riktig Microsoft Graph API-integration
 * Kräver Azure AD-app registrering och rätt konfiguration
 */

// Microsoft Graph SDK för JavaScript
// Denna implementation använder officiella Microsoft bibliotek

class RealOutlookIntegration {
  constructor() {
    this.msalInstance = null;
    this.graphClient = null;
    this.isAuthenticated = false;
    this.accessToken = null;
    
    // Konfiguration - uppdatera med dina riktiga värden från Azure AD
    this.msalConfig = {
      auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}`,
        redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/crm-prototype/auth/callback'
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
      }
    };

    this.loginRequest = {
      scopes: [
        'User.Read',
        'Mail.Read', 
        'Mail.Send',
        'Calendars.ReadWrite',
        'Contacts.Read'
      ]
    };

    this.initializeMSAL();
  }

  /**
   * Initialisera Microsoft Authentication Library
   */
  async initializeMSAL() {
    try {
      // Kontrollera om MSAL finns (laddas externt)
      if (typeof msal === 'undefined') {
        console.warn('MSAL.js är inte laddat. Ladda från CDN först.');
        return;
      }

      this.msalInstance = new msal.PublicClientApplication(this.msalConfig);
      await this.msalInstance.initialize();
      
      // Kontrollera om användaren redan är inloggad
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        this.currentAccount = accounts[0];
        await this.acquireTokenSilent();
      }

    } catch (error) {
      console.error('MSAL initialisering misslyckades:', error);
    }
  }

  /**
   * Logga in användare
   */
  async login() {
    try {
      showNotification('Ansluter till Microsoft...', 'info');
      
      const loginResponse = await this.msalInstance.loginPopup(this.loginRequest);
      this.currentAccount = loginResponse.account;
      this.accessToken = loginResponse.accessToken;
      
      await this.initializeGraphClient();
      this.isAuthenticated = true;
      
      showNotification('Ansluten till Outlook!', 'success');
      return true;

    } catch (error) {
      console.error('Inloggning misslyckades:', error);
      showNotification('Kunde inte ansluta till Outlook', 'error');
      return false;
    }
  }

  /**
   * Hämta token tyst (för redan inloggade användare)
   */
  async acquireTokenSilent() {
    try {
      const silentRequest = {
        scopes: this.loginRequest.scopes,
        account: this.currentAccount
      };

      const response = await this.msalInstance.acquireTokenSilent(silentRequest);
      this.accessToken = response.accessToken;
      
      await this.initializeGraphClient();
      this.isAuthenticated = true;
      
      return true;

    } catch (error) {
      console.warn('Tyst token-hämtning misslyckades:', error);
      return false;
    }
  }

  /**
   * Initialisera Microsoft Graph-klient
   */
  async initializeGraphClient() {
    if (typeof MicrosoftGraph === 'undefined') {
      console.error('Microsoft Graph SDK är inte laddat');
      return;
    }

    const authProvider = {
      getAccessToken: async () => {
        return this.accessToken;
      }
    };

    this.graphClient = MicrosoftGraph.Client.initWithMiddleware({ authProvider });
  }

  /**
   * Hämta användarens e-post
   */
  async getEmails(top = 50, filter = null) {
    if (!this.graphClient) {
      throw new Error('Graph client inte initialiserad');
    }

    try {
      let request = this.graphClient.api('/me/messages').top(top);
      
      if (filter) {
        request = request.filter(filter);
      }

      const response = await request.get();
      return response.value;

    } catch (error) {
      console.error('Kunde inte hämta e-post:', error);
      throw error;
    }
  }

  /**
   * Skicka e-post
   */
  async sendEmail(to, subject, content, isHtml = false) {
    if (!this.graphClient) {
      throw new Error('Graph client inte initialiserad');
    }

    const message = {
      subject: subject,
      body: {
        contentType: isHtml ? 'HTML' : 'Text',
        content: content
      },
      toRecipients: [
        {
          emailAddress: {
            address: to
          }
        }
      ]
    };

    try {
      await this.graphClient.api('/me/sendMail').post({ message });
      return true;

    } catch (error) {
      console.error('Kunde inte skicka e-post:', error);
      throw error;
    }
  }

  /**
   * Hämta kalenderhändelser
   */
  async getCalendarEvents(startTime = null, endTime = null) {
    if (!this.graphClient) {
      throw new Error('Graph client inte initialiserad');
    }

    try {
      let request = this.graphClient.api('/me/events');

      if (startTime && endTime) {
        const filter = `start/dateTime ge '${startTime.toISOString()}' and end/dateTime le '${endTime.toISOString()}'`;
        request = request.filter(filter);
      }

      const response = await request.get();
      return response.value;

    } catch (error) {
      console.error('Kunde inte hämta kalenderhändelser:', error);
      throw error;
    }
  }

  /**
   * Skapa kalenderhändelse
   */
  async createCalendarEvent(eventData) {
    if (!this.graphClient) {
      throw new Error('Graph client inte initialiserad');
    }

    const event = {
      subject: eventData.subject,
      start: {
        dateTime: eventData.start.toISOString(),
        timeZone: 'Europe/Stockholm'
      },
      end: {
        dateTime: eventData.end.toISOString(),
        timeZone: 'Europe/Stockholm'
      },
      attendees: eventData.attendees?.map(email => ({
        emailAddress: {
          address: email,
          name: email.split('@')[0]
        }
      })) || [],
      location: eventData.location ? {
        displayName: eventData.location
      } : undefined,
      body: eventData.body ? {
        contentType: 'HTML',
        content: eventData.body
      } : undefined
    };

    try {
      const response = await this.graphClient.api('/me/events').post(event);
      return response;

    } catch (error) {
      console.error('Kunde inte skapa kalenderhändelse:', error);
      throw error;
    }
  }

  /**
   * Hämta kontakter
   */
  async getContacts() {
    if (!this.graphClient) {
      throw new Error('Graph client inte initialiserad');
    }

    try {
      const response = await this.graphClient.api('/me/contacts').get();
      return response.value;

    } catch (error) {
      console.error('Kunde inte hämta kontakter:', error);
      throw error;
    }
  }

  /**
   * Logga ut
   */
  async logout() {
    if (this.msalInstance && this.currentAccount) {
      await this.msalInstance.logoutPopup({
        account: this.currentAccount
      });
    }
    
    this.isAuthenticated = false;
    this.accessToken = null;
    this.currentAccount = null;
    this.graphClient = null;
    
    showNotification('Utloggad från Outlook', 'info');
  }

  /**
   * Kontrollera autentiseringsstatus
   */
  isLoggedIn() {
    return this.isAuthenticated && this.accessToken && this.graphClient;
  }

  /**
   * Hämta användarinfo
   */
  async getUserInfo() {
    if (!this.graphClient) {
      throw new Error('Graph client inte initialiserad');
    }

    try {
      const user = await this.graphClient.api('/me').get();
      return user;

    } catch (error) {
      console.error('Kunde inte hämta användarinfo:', error);
      throw error;
    }
  }
}

// Exportera för användning
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RealOutlookIntegration;
} else {
  window.RealOutlookIntegration = RealOutlookIntegration;
}