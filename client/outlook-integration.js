/**
 * Outlook Integration med Microsoft Graph API
 * Hanterar e-postspårning, mötesbokning och kalendersynkronisering
 */

class OutlookIntegration {
  constructor() {
    this.accessToken = null;
    this.isAuthenticated = false;
    this.userProfile = null;
    this.emailCache = new Map();
    this.calendarCache = new Map();
    
    // Microsoft Graph API konfiguration
    this.graphConfig = {
      clientId: 'DIN_OUTLOOK_APP_ID', // Måste registreras i Azure AD
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: window.location.origin + '/crm-prototype/',
      scopes: [
        'User.Read',
        'Mail.Read',
        'Mail.Send', 
        'Calendars.ReadWrite',
        'Contacts.Read'
      ]
    };
    
    this.graphBaseUrl = 'https://graph.microsoft.com/v1.0';
  }

  /**
   * Autentisera med Microsoft Graph
   */
  async authenticate() {
    try {
      // I en riktig implementation skulle detta använda MSAL.js
      // För demonstration simulerar vi autentisering
      
      showNotification('Ansluter till Outlook...', 'info');
      
      // Simulera OAuth2-flöde
      await this.simulateAuth();
      
      this.isAuthenticated = true;
      
      // Hämta användarprofil
      await this.loadUserProfile();
      
      showNotification('Outlook-integrationen är aktiv!', 'success');
      
      return true;
    } catch (error) {
      console.error('Outlook-autentisering misslyckades:', error);
      showNotification('Kunde inte ansluta till Outlook', 'error');
      return false;
    }
  }

  /**
   * Simulera autentisering (för demonstration)
   */
  async simulateAuth() {
    return new Promise(resolve => {
      setTimeout(() => {
        this.accessToken = 'simulated_token_' + Date.now();
        this.userProfile = {
          displayName: 'Din Outlook-användare',
          mail: 'användare@företag.se',
          id: 'user123'
        };
        resolve();
      }, 1500);
    });
  }

  /**
   * Ladda användarprofil från Microsoft Graph
   */
  async loadUserProfile() {
    // I riktig implementation: GET /me
    console.log('Laddar användarprofil från Microsoft Graph...');
  }

  /**
   * Hämta e-posthistorik för en kund
   */
  async getEmailHistory(customerEmail, limit = 50) {
    if (!this.isAuthenticated) {
      throw new Error('Inte ansluten till Outlook');
    }

    try {
      // Simulera API-anrop för demonstration
      const emails = await this.simulateEmailFetch(customerEmail, limit);
      
      // Cacha resultatet
      this.emailCache.set(customerEmail, {
        emails: emails,
        lastUpdated: new Date()
      });

      return emails;
    } catch (error) {
      console.error('Kunde inte hämta e-posthistorik:', error);
      throw error;
    }
  }

  /**
   * Simulera e-posthämtning
   */
  async simulateEmailFetch(customerEmail, limit) {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const mockEmails = [
      {
        id: 'email1',
        subject: 'Uppföljning efter möte',
        from: this.userProfile.mail,
        to: customerEmail,
        sentDateTime: new Date(Date.now() - 2*24*60*60*1000).toISOString(),
        bodyPreview: 'Tack för ett bra möte igår. Som diskuterat bifogar jag...',
        isRead: true,
        direction: 'sent'
      },
      {
        id: 'email2', 
        subject: 'Frågor om er lösning',
        from: customerEmail,
        to: this.userProfile.mail,
        sentDateTime: new Date(Date.now() - 3*24*60*60*1000).toISOString(),
        bodyPreview: 'Hej! Vi har några frågor om den lösning ni presenterade...',
        isRead: true,
        direction: 'received'
      },
      {
        id: 'email3',
        subject: 'Offert - CRM-lösning',
        from: this.userProfile.mail,
        to: customerEmail,
        sentDateTime: new Date(Date.now() - 5*24*60*60*1000).toISOString(),
        bodyPreview: 'Bifogat finner ni vår offert för CRM-systemet...',
        isRead: true,
        direction: 'sent'
      }
    ];

    return mockEmails.slice(0, limit);
  }

  /**
   * Skicka e-post från CRM
   */
  async sendEmail(to, subject, body, customerCompany = null) {
    if (!this.isAuthenticated) {
      throw new Error('Inte ansluten till Outlook');
    }

    try {
      showNotification('Skickar e-post...', 'info');

      // I riktig implementation: POST /me/sendMail
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Logga aktivitet i CRM
      if (customerCompany) {
        logAuditEvent('email_sent', {
          to: to,
          subject: subject,
          company: customerCompany.name,
          timestamp: new Date().toISOString()
        });
      }

      showNotification('E-post skickad!', 'success');
      
      // Uppdatera e-postcache
      this.invalidateEmailCache(to);

      return true;
    } catch (error) {
      console.error('Kunde inte skicka e-post:', error);
      showNotification('Kunde inte skicka e-post', 'error');
      throw error;
    }
  }

  /**
   * Boka möte i Outlook
   */
  async scheduleMeeting(attendees, subject, startTime, endTime, body = '', location = '') {
    if (!this.isAuthenticated) {
      throw new Error('Inte ansluten till Outlook');
    }

    try {
      showNotification('Bokar möte i Outlook...', 'info');

      const meeting = {
        subject: subject,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'Europe/Stockholm'
        },
        end: {
          dateTime: endTime.toISOString(), 
          timeZone: 'Europe/Stockholm'
        },
        attendees: attendees.map(email => ({
          emailAddress: {
            address: email,
            name: email.split('@')[0]
          }
        })),
        body: {
          contentType: 'HTML',
          content: body
        },
        location: {
          displayName: location
        }
      };

      // I riktig implementation: POST /me/events
      await new Promise(resolve => setTimeout(resolve, 1200));

      showNotification('Möte bokat i Outlook!', 'success');

      // Logga aktivitet
      logAuditEvent('meeting_scheduled', {
        subject: subject,
        attendees: attendees,
        startTime: startTime.toISOString(),
        timestamp: new Date().toISOString()
      });

      return {
        id: 'meeting_' + Date.now(),
        webLink: 'https://outlook.live.com/calendar/...',
        ...meeting
      };
    } catch (error) {
      console.error('Kunde inte boka möte:', error);
      showNotification('Kunde inte boka möte', 'error');
      throw error;
    }
  }

  /**
   * Hämta kommande möten
   */
  async getUpcomingMeetings(days = 7) {
    if (!this.isAuthenticated) {
      throw new Error('Inte ansluten till Outlook');
    }

    try {
      // Simulera hämtning av kommande möten
      const meetings = await this.simulateMeetingsFetch(days);
      return meetings;
    } catch (error) {
      console.error('Kunde inte hämta möten:', error);
      throw error;
    }
  }

  /**
   * Simulera hämtning av möten
   */
  async simulateMeetingsFetch(days) {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const now = new Date();
    const mockMeetings = [
      {
        id: 'meeting1',
        subject: 'Kundmöte - Acme Corp',
        start: new Date(now.getTime() + 24*60*60*1000), // Imorgon
        end: new Date(now.getTime() + 24*60*60*1000 + 60*60*1000), // +1 timme
        attendees: ['acme@example.com'],
        location: 'Konferensrum A'
      },
      {
        id: 'meeting2',
        subject: 'Presentation - TechStart AB', 
        start: new Date(now.getTime() + 3*24*60*60*1000), // Om 3 dagar
        end: new Date(now.getTime() + 3*24*60*60*1000 + 2*60*60*1000), // +2 timmar
        attendees: ['info@techstart.se'],
        location: 'Teams-möte'
      }
    ];

    return mockMeetings;
  }

  /**
   * Visa Outlook-integration panel
   */
  showOutlookDashboard(company = null) {
    const isConnected = this.isAuthenticated;
    
    modal.show(`
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold text-gray-900">📧 Outlook Integration</h3>
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}"></div>
            <span class="text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}">
              ${isConnected ? 'Ansluten' : 'Inte ansluten'}
            </span>
          </div>
        </div>

        ${!isConnected ? this.renderConnectionSection() : this.renderConnectedDashboard(company)}
      </div>
    `);
  }

  /**
   * Render anslutningssektion
   */
  renderConnectionSection() {
    return `
      <div class="text-center py-8">
        <div class="text-6xl mb-4">📮</div>
        <h4 class="text-lg font-medium mb-2">Anslut till Outlook</h4>
        <p class="text-gray-600 mb-6">
          Få tillgång till e-posthistorik, skicka meddelanden och boka möten direkt från CRM
        </p>
        
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h5 class="font-medium mb-2">Funktioner som aktiveras:</h5>
          <ul class="text-sm text-gray-700 space-y-1">
            <li>✉️ E-posthistorik per kund</li>
            <li>📤 Skicka e-post från CRM</li>
            <li>📅 Boka möten i Outlook-kalender</li>
            <li>👥 Synka kontakter</li>
            <li>📊 E-post och mötesstatistik</li>
          </ul>
        </div>

        <div class="flex justify-center space-x-3">
          <button onclick="outlookIntegration.authenticate()" class="btn btn-primary">
            🔗 Anslut till Outlook
          </button>
          <button onclick="modal.hide()" class="btn btn-secondary">
            Avbryt
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render ansluten dashboard
   */
  renderConnectedDashboard(company) {
    return `
      <div class="space-y-6">
        <!-- Användarinfo -->
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
              ${this.userProfile.displayName.charAt(0)}
            </div>
            <div>
              <p class="font-medium">${this.userProfile.displayName}</p>
              <p class="text-sm text-gray-600">${this.userProfile.mail}</p>
            </div>
          </div>
        </div>

        ${company ? this.renderCustomerEmailSection(company) : this.renderGeneralActions()}

        <!-- Kommande möten -->
        <div class="border rounded-lg p-4">
          <h4 class="font-medium mb-3 flex items-center">
            📅 Kommande möten
            <button onclick="outlookIntegration.refreshMeetings()" class="ml-auto text-blue-600 text-sm">
              🔄 Uppdatera
            </button>
          </h4>
          <div id="upcomingMeetings">
            <div class="text-center text-gray-500 py-4">
              <div class="loading-spinner mx-auto mb-2"></div>
              Laddar möten...
            </div>
          </div>
        </div>

        <div class="flex justify-between">
          <button onclick="outlookIntegration.disconnect()" class="btn btn-outline text-red-600">
            🔌 Koppla från
          </button>
          <button onclick="modal.hide()" class="btn btn-secondary">
            Stäng
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render kundspecifik e-postsektion
   */
  renderCustomerEmailSection(company) {
    const customerEmail = company.email || `${company.name.toLowerCase().replace(/\s+/g, '')}@example.com`;
    
    return `
      <div class="border rounded-lg p-4">
        <h4 class="font-medium mb-3">📧 E-post med ${company.name}</h4>
        
        <!-- Snabbåtgärder -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <button onclick="outlookIntegration.quickEmail('${customerEmail}', '${company.name}')" 
                  class="btn btn-outline text-sm">
            ✉️ Skriv e-post
          </button>
          <button onclick="outlookIntegration.scheduleMeetingWith('${customerEmail}', '${company.name}')" 
                  class="btn btn-outline text-sm">
            📅 Boka möte
          </button>
        </div>

        <!-- E-posthistorik -->
        <div class="bg-gray-50 rounded p-3">
          <div class="flex justify-between items-center mb-2">
            <span class="text-sm font-medium">E-posthistorik</span>
            <button onclick="outlookIntegration.loadEmailHistory('${customerEmail}')" 
                    class="text-blue-600 text-sm">
              🔄 Ladda
            </button>
          </div>
          <div id="emailHistory_${customerEmail}" class="text-sm text-gray-600">
            Klicka "Ladda" för att se e-posthistorik
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render allmänna åtgärder
   */
  renderGeneralActions() {
    return `
      <div class="grid grid-cols-2 gap-4">
        <button onclick="outlookIntegration.showComposeEmail()" class="btn btn-outline">
          ✉️ Skriv e-post
        </button>
        <button onclick="outlookIntegration.showScheduleMeeting()" class="btn btn-outline">
          📅 Boka möte
        </button>
      </div>
    `;
  }

  /**
   * Ladda och visa e-posthistorik för kund
   */
  async loadEmailHistory(customerEmail) {
    const container = document.getElementById(`emailHistory_${customerEmail}`);
    if (!container) return;

    try {
      container.innerHTML = `
        <div class="flex items-center space-x-2 text-blue-600">
          <div class="loading-spinner"></div>
          <span>Laddar e-posthistorik...</span>
        </div>
      `;

      const emails = await this.getEmailHistory(customerEmail);
      
      if (emails.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">Ingen e-posthistorik hittad</p>';
        return;
      }

      container.innerHTML = `
        <div class="space-y-2 max-h-40 overflow-y-auto">
          ${emails.map(email => `
            <div class="flex items-start space-x-2 p-2 rounded border border-gray-200 hover:bg-gray-50">
              <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                email.direction === 'sent' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
              }">
                ${email.direction === 'sent' ? '📤' : '📥'}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">${email.subject}</p>
                <p class="text-xs text-gray-500 truncate">${email.bodyPreview}</p>
                <p class="text-xs text-gray-400">
                  ${new Date(email.sentDateTime).toLocaleDateString('sv-SE')} 
                  ${new Date(email.sentDateTime).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'})}
                </p>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="mt-3 text-center">
          <button onclick="outlookIntegration.showDetailedEmailHistory('${customerEmail}')" 
                  class="text-blue-600 text-sm hover:underline">
            Visa alla e-post (${emails.length})
          </button>
        </div>
      `;

    } catch (error) {
      container.innerHTML = '<p class="text-red-500 text-sm">Kunde inte ladda e-posthistorik</p>';
      console.error('Fel vid laddning av e-posthistorik:', error);
    }
  }

  /**
   * Visa detaljerad e-posthistorik i separat modal
   */
  showDetailedEmailHistory(customerEmail) {
    const emails = this.emailCache.get(customerEmail)?.emails || [];
    
    modal.show(`
      <div class="space-y-4">
        <h3 class="text-lg font-bold">📧 E-posthistorik - ${customerEmail}</h3>
        
        <div class="space-y-3 max-h-96 overflow-y-auto">
          ${emails.map(email => `
            <div class="border rounded-lg p-4 ${email.direction === 'sent' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}">
              <div class="flex justify-between items-start mb-2">
                <div class="flex items-center space-x-2">
                  <span class="text-lg">${email.direction === 'sent' ? '📤' : '📥'}</span>
                  <span class="font-medium">${email.subject}</span>
                </div>
                <span class="text-sm text-gray-500">
                  ${new Date(email.sentDateTime).toLocaleDateString('sv-SE')}
                </span>
              </div>
              
              <div class="text-sm text-gray-600 mb-2">
                <strong>${email.direction === 'sent' ? 'Till' : 'Från'}:</strong> 
                ${email.direction === 'sent' ? email.to : email.from}
              </div>
              
              <p class="text-sm text-gray-700">${email.bodyPreview}</p>
              
              <div class="mt-3 flex space-x-2">
                <button onclick="outlookIntegration.replyToEmail('${email.id}', '${customerEmail}')" 
                        class="text-blue-600 text-sm hover:underline">
                  ↩️ Svara
                </button>
                <button onclick="outlookIntegration.forwardEmail('${email.id}')" 
                        class="text-blue-600 text-sm hover:underline">
                  ↗️ Vidarebefordra
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="flex justify-between">
          <button onclick="outlookIntegration.exportEmailHistory('${customerEmail}')" 
                  class="btn btn-outline text-sm">
            📥 Exportera
          </button>
          <button onclick="modal.hide()" class="btn btn-secondary">
            Stäng
          </button>
        </div>
      </div>
    `);
  }

  /**
   * Svara på e-post
   */
  replyToEmail(emailId, customerEmail) {
    const originalEmail = this.findEmailById(emailId);
    if (!originalEmail) return;

    const replySubject = originalEmail.subject.startsWith('Re:') ? 
      originalEmail.subject : 'Re: ' + originalEmail.subject;

    modal.show(`
      <div class="space-y-4">
        <h3 class="text-lg font-bold">↩️ Svara på e-post</h3>
        
        <!-- Ursprungligt meddelande -->
        <div class="bg-gray-50 border rounded p-3">
          <div class="text-sm text-gray-600 mb-2">Ursprungligt meddelande:</div>
          <div class="text-sm">
            <strong>Från:</strong> ${originalEmail.from}<br>
            <strong>Ämne:</strong> ${originalEmail.subject}<br>
            <strong>Datum:</strong> ${new Date(originalEmail.sentDateTime).toLocaleString('sv-SE')}
          </div>
          <div class="mt-2 text-sm text-gray-700 italic">
            "${originalEmail.bodyPreview}"
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Till:</label>
            <input type="email" id="replyTo" value="${customerEmail}" 
                   class="w-full px-3 py-2 border rounded-md" readonly>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Ämne:</label>
            <input type="text" id="replySubject" value="${replySubject}" 
                   class="w-full px-3 py-2 border rounded-md">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Svar:</label>
            <textarea id="replyBody" rows="6" 
                      class="w-full px-3 py-2 border rounded-md"
                      placeholder="Skriv ditt svar här..."></textarea>
          </div>
        </div>

        <div class="flex justify-end space-x-3">
          <button onclick="modal.hide()" class="btn btn-secondary">Avbryt</button>
          <button onclick="outlookIntegration.sendReply()" class="btn btn-primary">
            📤 Skicka svar
          </button>
        </div>
      </div>
    `);
  }

  /**
   * Hitta e-post med ID
   */
  findEmailById(emailId) {
    for (const [email, data] of this.emailCache.entries()) {
      const found = data.emails.find(e => e.id === emailId);
      if (found) return found;
    }
    return null;
  }

  /**
   * Skicka svar
   */
  async sendReply() {
    const to = document.getElementById('replyTo').value;
    const subject = document.getElementById('replySubject').value;
    const body = document.getElementById('replyBody').value;

    if (!body.trim()) {
      showNotification('Skriv ett svar', 'error');
      return;
    }

    try {
      await this.sendEmail(to, subject, body);
      modal.hide();
      
      // Uppdatera e-posthistorik
      this.invalidateEmailCache(to);
      setTimeout(() => this.loadEmailHistory(to), 1000);
      
    } catch (error) {
      console.error('Kunde inte skicka svar:', error);
    }
  }

  /**
   * Hjälpfunktioner
   */
  invalidateEmailCache(email) {
    this.emailCache.delete(email);
  }

  disconnect() {
    this.isAuthenticated = false;
    this.accessToken = null;
    this.userProfile = null;
    this.emailCache.clear();
    showNotification('Outlook frånkopplad', 'info');
    this.showOutlookDashboard();
  }

  /**
   * Boka möte med specifik kund
   */
  scheduleMeetingWith(customerEmail, companyName) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const endTime = new Date(tomorrow);
    endTime.setHours(11, 0, 0, 0);

    modal.show(`
      <div class="space-y-4">
        <h3 class="text-lg font-bold">📅 Boka möte med ${companyName}</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Deltagare:</label>
            <input type="email" id="meetingAttendees" value="${customerEmail}" 
                   class="w-full px-3 py-2 border rounded-md"
                   placeholder="Lägg till fler e-postadresser separerade med komma">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Ämne:</label>
            <input type="text" id="meetingSubject" 
                   value="Möte med ${companyName}"
                   class="w-full px-3 py-2 border rounded-md">
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Startdatum:</label>
              <input type="date" id="meetingDate" 
                     value="${tomorrow.toISOString().split('T')[0]}"
                     class="w-full px-3 py-2 border rounded-md">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Starttid:</label>
              <input type="time" id="meetingStartTime" 
                     value="10:00"
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
            <input type="text" id="meetingLocation" 
                   placeholder="Konferensrum, Teams-länk, adress..."
                   class="w-full px-3 py-2 border rounded-md">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Beskrivning:</label>
            <textarea id="meetingDescription" rows="3" 
                      placeholder="Agenda och mötesdetaljer..."
                      class="w-full px-3 py-2 border rounded-md"></textarea>
          </div>
        </div>

        <div class="flex justify-end space-x-3">
          <button onclick="modal.hide()" class="btn btn-secondary">Avbryt</button>
          <button onclick="outlookIntegration.confirmMeetingBooking()" class="btn btn-primary">
            📅 Boka möte
          </button>
        </div>
      </div>
    `);
  }

  /**
   * Bekräfta mötesbokning
   */
  async confirmMeetingBooking() {
    const attendees = document.getElementById('meetingAttendees').value
      .split(',').map(email => email.trim()).filter(email => email);
    const subject = document.getElementById('meetingSubject').value;
    const date = document.getElementById('meetingDate').value;
    const startTime = document.getElementById('meetingStartTime').value;
    const duration = parseInt(document.getElementById('meetingDuration').value);
    const location = document.getElementById('meetingLocation').value;
    const description = document.getElementById('meetingDescription').value;

    if (!subject.trim() || !date || !startTime || attendees.length === 0) {
      showNotification('Fyll i alla obligatoriska fält', 'error');
      return;
    }

    // Skapa start- och slutdatum
    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    try {
      const meeting = await this.scheduleMeeting(
        attendees, subject, startDateTime, endDateTime, description, location
      );
      
      modal.hide();
      
      // Visa bekräftelse
      this.showMeetingConfirmation(meeting);
      
    } catch (error) {
      console.error('Kunde inte boka möte:', error);
    }
  }

  /**
   * Visa mötesbekräftelse
   */
  showMeetingConfirmation(meeting) {
    modal.show(`
      <div class="text-center space-y-4">
        <div class="text-6xl mb-4">✅</div>
        <h3 class="text-xl font-bold text-green-600">Möte bokat!</h3>
        
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
          <h4 class="font-medium mb-2">Mötesdetaljer:</h4>
          <div class="space-y-1 text-sm">
            <p><strong>Ämne:</strong> ${meeting.subject}</p>
            <p><strong>Datum:</strong> ${meeting.start.dateTime.split('T')[0]}</p>
            <p><strong>Tid:</strong> ${new Date(meeting.start.dateTime).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'})} - ${new Date(meeting.end.dateTime).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'})}</p>
            <p><strong>Deltagare:</strong> ${meeting.attendees.map(a => a.emailAddress.address).join(', ')}</p>
            ${meeting.location.displayName ? `<p><strong>Plats:</strong> ${meeting.location.displayName}</p>` : ''}
          </div>
        </div>
        
        <div class="flex justify-center space-x-3">
          <button onclick="window.open('${meeting.webLink || '#'}', '_blank')" class="btn btn-outline">
            🔗 Öppna i Outlook
          </button>
          <button onclick="modal.hide()" class="btn btn-primary">
            Stäng
          </button>
        </div>
      </div>
    `);
  }

  /**
   * Uppdatera och visa kommande möten
   */
  async refreshMeetings() {
    const container = document.getElementById('upcomingMeetings');
    if (!container) return;

    try {
      container.innerHTML = `
        <div class="flex items-center space-x-2 text-blue-600">
          <div class="loading-spinner"></div>
          <span>Uppdaterar möten...</span>
        </div>
      `;

      const meetings = await this.getUpcomingMeetings();
      
      if (meetings.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-4">Inga kommande möten</p>';
        return;
      }

      container.innerHTML = `
        <div class="space-y-2">
          ${meetings.map(meeting => `
            <div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  📅
                </div>
                <div>
                  <p class="font-medium text-sm">${meeting.subject}</p>
                  <p class="text-xs text-gray-600">
                    ${new Date(meeting.start).toLocaleDateString('sv-SE')} 
                    ${new Date(meeting.start).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'})}
                  </p>
                  <p class="text-xs text-gray-500">${meeting.location || 'Ingen plats angiven'}</p>
                </div>
              </div>
              <div class="flex space-x-1">
                <button onclick="outlookIntegration.editMeeting('${meeting.id}')" 
                        class="text-blue-600 text-xs hover:underline">
                  ✏️ Redigera
                </button>
                <button onclick="outlookIntegration.cancelMeeting('${meeting.id}')" 
                        class="text-red-600 text-xs hover:underline">
                  ❌ Avboka
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

    } catch (error) {
      container.innerHTML = '<p class="text-center text-red-500 py-4">Kunde inte ladda möten</p>';
      console.error('Fel vid laddning av möten:', error);
    }
  }

  /**
   * Allmän mötesbokning
   */
  showScheduleMeeting() {
    this.scheduleMeetingWith('', 'extern part');
  }

  /**
   * Allmän e-postskapning
   */
  showComposeEmail() {
    this.quickEmail('', 'mottagare');
  }

  /**
   * Redigera möte
   */
  editMeeting(meetingId) {
    showNotification('Öppnar möte för redigering...', 'info');
    setTimeout(() => {
      showNotification('Möte öppnat i Outlook för redigering', 'success');
    }, 1000);
  }

  /**
   * Avboka möte
   */
  async cancelMeeting(meetingId) {
    const confirmed = confirm('Är du säker på att du vill avboka detta möte?');
    if (!confirmed) return;

    try {
      showNotification('Avbokar möte...', 'info');
      
      // I riktig implementation: DELETE /me/events/{meetingId}
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      showNotification('Möte avbokat!', 'success');
      
      // Uppdatera möteslistan
      this.refreshMeetings();
      
    } catch (error) {
      console.error('Kunde inte avboka möte:', error);
      showNotification('Kunde inte avboka möte', 'error');
    }
  }

  /**
   * Vidarebefordra e-post
   */
  forwardEmail(emailId) {
    const originalEmail = this.findEmailById(emailId);
    if (!originalEmail) return;

    modal.show(`
      <div class="space-y-4">
        <h3 class="text-lg font-bold">↗️ Vidarebefordra e-post</h3>
        
        <div class="bg-gray-50 border rounded p-3">
          <div class="text-sm text-gray-600 mb-2">Ursprungligt meddelande:</div>
          <div class="text-sm">
            <strong>Från:</strong> ${originalEmail.from}<br>
            <strong>Ämne:</strong> ${originalEmail.subject}<br>
            <strong>Datum:</strong> ${new Date(originalEmail.sentDateTime).toLocaleString('sv-SE')}
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Till:</label>
            <input type="email" id="forwardTo" placeholder="mottagare@example.com" 
                   class="w-full px-3 py-2 border rounded-md">
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Meddelande:</label>
            <textarea id="forwardMessage" rows="4" 
                      placeholder="Lägg till ditt meddelande..."
                      class="w-full px-3 py-2 border rounded-md"></textarea>
          </div>
        </div>

        <div class="flex justify-end space-x-3">
          <button onclick="modal.hide()" class="btn btn-secondary">Avbryt</button>
          <button onclick="outlookIntegration.sendForward('${emailId}')" class="btn btn-primary">
            📤 Vidarebefordra
          </button>
        </div>
      </div>
    `);
  }

  /**
   * Skicka vidarebefordrad e-post
   */
  async sendForward(emailId) {
    const to = document.getElementById('forwardTo').value;
    const message = document.getElementById('forwardMessage').value;
    
    if (!to.trim()) {
      showNotification('Ange mottagare', 'error');
      return;
    }

    const originalEmail = this.findEmailById(emailId);
    if (!originalEmail) return;

    const subject = `Fwd: ${originalEmail.subject}`;
    const body = `${message}\n\n--- Vidarebefordrat meddelande ---\nFrån: ${originalEmail.from}\nDatum: ${new Date(originalEmail.sentDateTime).toLocaleString('sv-SE')}\nÄmne: ${originalEmail.subject}\n\n${originalEmail.bodyPreview}`;

    try {
      await this.sendEmail(to, subject, body);
      modal.hide();
    } catch (error) {
      console.error('Kunde inte vidarebefordra e-post:', error);
    }
  }

  /**
   * Starta automatisk e-postsynkronisering
   */
  startEmailSync() {
    if (!this.isAuthenticated) return;

    // Synka e-post var 5:e minut
    this.syncInterval = setInterval(async () => {
      try {
        console.log('Synkroniserar e-post...');
        // I riktig implementation: Hämta nya e-post sedan senaste synk
        
        // Invalidera cache för att tvinga refresh
        this.emailCache.clear();
        
      } catch (error) {
        console.error('Fel vid e-postsynkronisering:', error);
      }
    }, 5 * 60 * 1000); // 5 minuter
  }

  /**
   * Stoppa automatisk synkronisering
   */
  stopEmailSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Kontrollera anslutningsstatus
   */
  checkConnection() {
    return this.isAuthenticated && this.accessToken;
  }

  /**
   * Visa anslutningsstatus i UI
   */
  updateConnectionStatus() {
    const statusElements = document.querySelectorAll('[data-outlook-status]');
    statusElements.forEach(el => {
      if (this.isAuthenticated) {
        el.classList.remove('offline');
        el.classList.add('online');
        el.textContent = '🟢 Ansluten';
      } else {
        el.classList.remove('online');
        el.classList.add('offline');  
        el.textContent = '🔴 Inte ansluten';
      }
    });
  }

  /**
   * Exportera e-posthistorik
   */
  exportEmailHistory(customerEmail) {
    const emails = this.emailCache.get(customerEmail)?.emails || [];
    
    if (emails.length === 0) {
      showNotification('Ingen e-posthistorik att exportera', 'error');
      return;
    }

    // Skapa CSV-data
    const csvData = [
      ['Datum', 'Riktning', 'Ämne', 'Från', 'Till', 'Förhandsvisning'].join(','),
      ...emails.map(email => [
        new Date(email.sentDateTime).toLocaleDateString('sv-SE'),
        email.direction === 'sent' ? 'Skickat' : 'Mottaget',
        `"${email.subject}"`,
        email.from,
        email.to,
        `"${email.bodyPreview}"`
      ].join(','))
    ].join('\n');

    // Skapa och ladda ned fil
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `email_history_${customerEmail}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    showNotification('E-posthistorik exporterad!', 'success');
  }

  /**
   * Snabb e-post till kund
   */
  quickEmail(customerEmail, companyName) {
    modal.show(`
      <div class="space-y-4">
        <h3 class="text-lg font-bold">✉️ Skriv e-post till ${companyName}</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Till:</label>
            <input type="email" id="emailTo" value="${customerEmail}" 
                   class="w-full px-3 py-2 border rounded-md" readonly>
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
          <button onclick="outlookIntegration.sendQuickEmail()" class="btn btn-primary">
            📤 Skicka
          </button>
        </div>
      </div>
    `);
  }

  /**
   * Skicka snabb e-post
   */
  async sendQuickEmail() {
    const to = document.getElementById('emailTo').value;
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;

    if (!subject.trim() || !body.trim()) {
      showNotification('Fyll i ämne och meddelande', 'error');
      return;
    }

    try {
      await this.sendEmail(to, subject, body);
      modal.hide();
    } catch (error) {
      console.error('Kunde inte skicka e-post:', error);
    }
  }
}

// Skapa global instans
const outlookIntegration = new OutlookIntegration();