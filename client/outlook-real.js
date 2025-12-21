/**
 * Riktig Microsoft Graph API-integration
 * Kräver Azure AD-app registrering och rätt konfiguration
 * Konfiguration sätts i config.js (MICROSOFT_CONFIG)
 */

// Microsoft Graph SDK för JavaScript
// Denna implementation använder officiella Microsoft bibliotek

class RealOutlookIntegration {
  constructor() {
    this.msalInstance = null;
    this.graphClient = null;
    this.isAuthenticated = false;
    this.accessToken = null;
    this.currentAccount = null;
    
    // Använd konfiguration från config.js
    const config = typeof MICROSOFT_CONFIG !== 'undefined' ? MICROSOFT_CONFIG : {};
    
    this.msalConfig = {
      auth: {
        clientId: config.clientId || 'YOUR_CLIENT_ID_HERE',
        authority: `https://login.microsoftonline.com/${config.tenantId || 'common'}`,
        redirectUri: config.redirectUri || window.location.origin + '/auth/callback'
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
      }
    };

    this.loginRequest = {
      scopes: config.scopes || [
        'User.Read',
        'Mail.Read', 
        'Mail.Send',
        'Calendars.ReadWrite',
        'Contacts.Read'
      ]
    };

    // Auto-initialisera om MSAL finns
    if (typeof msal !== 'undefined') {
      this.initializeMSAL();
    } else {
      console.warn('MSAL.js är inte laddat. Outlook-integration inaktiverad.');
    }
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

  /**
   * Visa Outlook Dashboard
   */
  async showOutlookDashboard() {
    if (!this.isLoggedIn()) {
      // Visa inloggningsdialog
      modal.show(`
        <div class="space-y-4 text-center">
          <div class="text-6xl mb-4">📧</div>
          <h3 class="text-xl font-bold">Outlook Integration</h3>
          <p class="text-gray-600">Anslut till Microsoft 365 för att se e-post, kalender och kontakter.</p>
          
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left text-sm">
            <h4 class="font-medium mb-2">Med Outlook-integrationen kan du:</h4>
            <ul class="list-disc list-inside space-y-1 text-gray-600">
              <li>Se e-posthistorik med kunder</li>
              <li>Boka möten direkt från CRM</li>
              <li>Synkronisera kalender</li>
              <li>Skicka e-post utan att lämna CRM</li>
            </ul>
          </div>

          <div class="flex justify-center space-x-3 pt-4">
            <button onclick="modal.hide()" class="btn btn-secondary">Avbryt</button>
            <button onclick="outlookIntegration.login().then(() => { modal.hide(); outlookIntegration.showOutlookDashboard(); })" class="btn btn-primary">
              🔐 Logga in med Microsoft
            </button>
          </div>
        </div>
      `);
      return;
    }

    // Hämta data
    showNotification('Laddar Outlook-data...', 'info');
    
    try {
      const [userInfo, emails, events] = await Promise.all([
        this.getUserInfo(),
        this.getEmails(10),
        this.getCalendarEvents()
      ]);

      modal.show(`
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold">📧 Outlook Dashboard</h3>
            <div class="flex items-center space-x-2">
              <span class="text-green-500">●</span>
              <span class="text-sm">${userInfo.displayName || userInfo.userPrincipalName}</span>
              <button onclick="outlookIntegration.logout().then(() => modal.hide())" class="btn btn-xs btn-ghost">
                Logga ut
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Senaste e-post -->
            <div class="border rounded-lg p-4">
              <h4 class="font-medium mb-3">📬 Senaste e-post</h4>
              <div class="space-y-2 max-h-60 overflow-y-auto">
                ${emails.length > 0 ? emails.map(email => `
                  <div class="p-2 bg-gray-50 rounded text-sm">
                    <div class="font-medium truncate">${email.subject || '(Inget ämne)'}</div>
                    <div class="text-xs text-gray-500">
                      ${email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Okänd'} • 
                      ${new Date(email.receivedDateTime).toLocaleDateString('sv-SE')}
                    </div>
                  </div>
                `).join('') : '<p class="text-gray-500 text-sm">Inga e-postmeddelanden</p>'}
              </div>
            </div>

            <!-- Kommande möten -->
            <div class="border rounded-lg p-4">
              <h4 class="font-medium mb-3">📅 Kommande möten</h4>
              <div class="space-y-2 max-h-60 overflow-y-auto">
                ${events.length > 0 ? events.map(event => `
                  <div class="p-2 bg-gray-50 rounded text-sm">
                    <div class="font-medium truncate">${event.subject}</div>
                    <div class="text-xs text-gray-500">
                      ${new Date(event.start.dateTime).toLocaleDateString('sv-SE')} 
                      ${new Date(event.start.dateTime).toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit'})}
                    </div>
                  </div>
                `).join('') : '<p class="text-gray-500 text-sm">Inga kommande möten</p>'}
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-2">
            <button onclick="outlookIntegration.showComposeEmail()" class="btn btn-outline btn-sm">
              ✉️ Ny e-post
            </button>
            <button onclick="outlookIntegration.showScheduleMeeting()" class="btn btn-outline btn-sm">
              📅 Boka möte
            </button>
            <button onclick="modal.hide()" class="btn btn-primary btn-sm">
              Stäng
            </button>
          </div>
        </div>
      `);
    } catch (error) {
      console.error('Fel vid laddning av Outlook-data:', error);
      showNotification('Kunde inte ladda Outlook-data: ' + error.message, 'error');
    }
  }

  /**
   * Visa e-post-composer
   */
  showComposeEmail() {
    modal.show(`
      <div class="space-y-4">
        <h3 class="text-lg font-bold">✉️ Ny e-post</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Till:</label>
            <input type="email" id="emailTo" placeholder="mottagare@example.com" 
                   class="w-full px-3 py-2 border rounded-md">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Ämne:</label>
            <input type="text" id="emailSubject" placeholder="Ämnesrad..." 
                   class="w-full px-3 py-2 border rounded-md">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Meddelande:</label>
            <textarea id="emailBody" rows="6" placeholder="Skriv ditt meddelande här..." 
                      class="w-full px-3 py-2 border rounded-md"></textarea>
          </div>
        </div>

        <div class="flex justify-end space-x-3">
          <button onclick="modal.hide()" class="btn btn-secondary">Avbryt</button>
          <button onclick="outlookIntegration.sendEmailFromComposer()" class="btn btn-primary">
            📤 Skicka
          </button>
        </div>
      </div>
    `);
  }

  /**
   * Skicka e-post från composer
   */
  async sendEmailFromComposer() {
    const to = document.getElementById('emailTo').value;
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;

    if (!to || !subject || !body) {
      showNotification('Fyll i alla fält', 'error');
      return;
    }

    try {
      await this.sendEmail(to, subject, body);
      modal.hide();
      showNotification('E-post skickad!', 'success');
    } catch (error) {
      showNotification('Kunde inte skicka e-post: ' + error.message, 'error');
    }
  }

  /**
   * Visa mötesbokning
   */
  showScheduleMeeting() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    modal.show(`
      <div class="space-y-4">
        <h3 class="text-lg font-bold">📅 Boka möte</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Deltagare (kommaseparerade):</label>
            <input type="text" id="meetingAttendees" placeholder="email1@example.com, email2@example.com" 
                   class="w-full px-3 py-2 border rounded-md">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Ämne:</label>
            <input type="text" id="meetingSubject" placeholder="Mötesämne" 
                   class="w-full px-3 py-2 border rounded-md">
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Datum:</label>
              <input type="date" id="meetingDate" value="${tomorrow.toISOString().split('T')[0]}"
                     class="w-full px-3 py-2 border rounded-md">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Tid:</label>
              <input type="time" id="meetingTime" value="10:00"
                     class="w-full px-3 py-2 border rounded-md">
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Längd:</label>
            <select id="meetingDuration" class="w-full px-3 py-2 border rounded-md">
              <option value="30">30 minuter</option>
              <option value="60" selected>1 timme</option>
              <option value="90">1,5 timmar</option>
              <option value="120">2 timmar</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Plats:</label>
            <input type="text" id="meetingLocation" placeholder="Konferensrum, Teams, etc." 
                   class="w-full px-3 py-2 border rounded-md">
          </div>
        </div>

        <div class="flex justify-end space-x-3">
          <button onclick="modal.hide()" class="btn btn-secondary">Avbryt</button>
          <button onclick="outlookIntegration.createMeetingFromForm()" class="btn btn-primary">
            📅 Boka möte
          </button>
        </div>
      </div>
    `);
  }

  /**
   * Skapa möte från formulär
   */
  async createMeetingFromForm() {
    const attendees = document.getElementById('meetingAttendees').value.split(',').map(e => e.trim()).filter(e => e);
    const subject = document.getElementById('meetingSubject').value;
    const date = document.getElementById('meetingDate').value;
    const time = document.getElementById('meetingTime').value;
    const duration = parseInt(document.getElementById('meetingDuration').value);
    const location = document.getElementById('meetingLocation').value;

    if (!subject || !date || !time) {
      showNotification('Fyll i ämne, datum och tid', 'error');
      return;
    }

    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + duration * 60000);

    try {
      await this.createCalendarEvent({
        subject,
        start,
        end,
        attendees,
        location
      });
      modal.hide();
      showNotification('Möte bokat!', 'success');
    } catch (error) {
      showNotification('Kunde inte boka möte: ' + error.message, 'error');
    }
  }
}

// Exportera för användning
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RealOutlookIntegration;
} else {
  window.RealOutlookIntegration = RealOutlookIntegration;
}