/**
 * CRM Deal View - Avtalhantering integrerat
 */

class DealContractManager {
  constructor(dealId) {
    this.dealId = dealId;
    this.init();
  }

  async init() {
    await this.loadDealData();
    await this.checkContractStatus();
    this.setupEventListeners();
  }

  async loadDealData() {
    const response = await fetch(`/api/deals/${this.dealId}`);
    this.deal = await response.json();
    this.renderDealInfo();
  }

  async checkContractStatus() {
    try {
      const response = await fetch(`/api/deals/${this.dealId}/contract`);
      if (response.ok) {
        this.contract = await response.json().contract;
        this.renderContractStatus();
      }
    } catch (error) {
      // Inget avtal skickat än
      this.renderSendContractButton();
    }
  }

  renderSendContractButton() {
    const container = document.getElementById('contract-section');
    container.innerHTML = `
      <div class="contract-card">
        <h3>📄 Avtalhantering</h3>
        <p>Redo att skicka avtal till ${this.deal.customer.companyName}?</p>
        
        <div class="service-selector">
          <label>Välj tjänst:</label>
          <select id="serviceType">
            <option value="vardering">Värderingstjänst - 1499 kr/mån</option>
            <option value="konsultation">Konsultation - 2999 kr/mån</option>
            <option value="crm_access">CRM Åtkomst - 999 kr/mån</option>
            <option value="custom">Anpassat avtal...</option>
          </select>
        </div>
        
        <div id="customization-panel" style="display:none;" class="customization">
          <h4>Anpassa avtal</h4>
          <label>Pris per månad (kr):</label>
          <input type="number" id="customPrice" placeholder="1999">
          
          <label>Max antal användare:</label>
          <input type="number" id="maxUsers" value="10">
          
          <label>Särskilda villkor:</label>
          <textarea id="specialTerms" placeholder="T.ex. rabatt första 3 månaderna..."></textarea>
        </div>
        
        <button id="sendContractBtn" class="btn-primary">
          ✉️ Skicka Avtal till Kund
        </button>
        
        <div class="info-box">
          <strong>Vad händer sen?</strong>
          <ol>
            <li>Kunden får email med signeringslänk</li>
            <li>Avtalet signeras digitalt via Scrive</li>
            <li>Tjänsten aktiveras automatiskt</li>
            <li>Kunden får inloggningsuppgifter</li>
            <li>Dealen markeras som "Won" i CRM</li>
          </ol>
        </div>
      </div>
    `;
  }

  renderContractStatus() {
    const container = document.getElementById('contract-section');
    const statusIcons = {
      'pending': '⏳',
      'sent': '📤',
      'signed': '✅',
      'active': '🎉',
      'cancelled': '❌'
    };
    
    const statusColors = {
      'pending': '#ffa500',
      'sent': '#0066cc',
      'signed': '#00aa00',
      'active': '#00cc00',
      'cancelled': '#cc0000'
    };
    
    const statusTexts = {
      'pending': 'Förbereds',
      'sent': 'Skickat - Väntar på signering',
      'signed': 'Signerat',
      'active': 'Aktiv tjänst',
      'cancelled': 'Avbrutet'
    };
    
    container.innerHTML = `
      <div class="contract-card">
        <h3>📄 Avtalsstatus</h3>
        
        <div class="status-badge" style="background-color: ${statusColors[this.contract.status]};">
          ${statusIcons[this.contract.status]} ${statusTexts[this.contract.status]}
        </div>
        
        <div class="contract-details">
          <h4>${this.contract.service.name}</h4>
          <p><strong>Pris:</strong> ${this.contract.service.price} kr/${this.contract.service.billingInterval === 'monthly' ? 'mån' : 'år'}</p>
          <p><strong>Max användare:</strong> ${this.contract.service.maxUsers}</p>
          
          ${this.contract.sentDate ? `
            <p><strong>Skickat:</strong> ${new Date(this.contract.sentDate).toLocaleDateString('sv-SE')}</p>
          ` : ''}
          
          ${this.contract.signedDate ? `
            <p><strong>Signerat:</strong> ${new Date(this.contract.signedDate).toLocaleDateString('sv-SE')}</p>
            <p><a href="${this.contract.documentUrl}" target="_blank" class="btn-secondary">📥 Ladda ner signerat avtal</a></p>
          ` : ''}
        </div>
        
        ${this.contract.status === 'sent' ? `
          <div class="actions">
            <button id="sendReminderBtn" class="btn-secondary">
              🔔 Skicka Påminnelse
            </button>
            <p class="help-text">Kunden har inte signerat än. Skicka en påminnelse?</p>
          </div>
        ` : ''}
        
        ${this.contract.status === 'signed' ? `
          <div class="success-message">
            <h4>🎉 Gratulerar!</h4>
            <p>Avtalet är signerat och tjänsten är aktiverad.</p>
            <p>Kunden har fått inloggningsuppgifter via email.</p>
          </div>
        ` : ''}
        
        <div class="timeline">
          <h4>Tidslinje</h4>
          <ul>
            <li class="completed">
              <span class="date">${new Date(this.contract.createdAt).toLocaleDateString('sv-SE')}</span>
              <span class="event">Avtal skapat av dig</span>
            </li>
            ${this.contract.sentDate ? `
              <li class="completed">
                <span class="date">${new Date(this.contract.sentDate).toLocaleDateString('sv-SE')}</span>
                <span class="event">Skickat till ${this.deal.customer.email}</span>
              </li>
            ` : ''}
            ${this.contract.signedDate ? `
              <li class="completed">
                <span class="date">${new Date(this.contract.signedDate).toLocaleDateString('sv-SE')}</span>
                <span class="event">Signerat av ${this.deal.customer.companyName}</span>
              </li>
              <li class="completed">
                <span class="date">${new Date(this.contract.signedDate).toLocaleDateString('sv-SE')}</span>
                <span class="event">Tjänst aktiverad automatiskt</span>
              </li>
            ` : ''}
          </ul>
        </div>
      </div>
    `;
    
    if (this.contract.status === 'sent') {
      document.getElementById('sendReminderBtn').addEventListener('click', 
        () => this.sendReminder()
      );
    }
  }

  setupEventListeners() {
    const serviceSelect = document.getElementById('serviceType');
    const sendBtn = document.getElementById('sendContractBtn');
    const customPanel = document.getElementById('customization-panel');
    
    if (serviceSelect) {
      serviceSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          customPanel.style.display = 'block';
        } else {
          customPanel.style.display = 'none';
        }
      });
    }
    
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendContract());
    }
  }

  async sendContract() {
    const serviceType = document.getElementById('serviceType').value;
    const customPrice = document.getElementById('customPrice')?.value;
    const maxUsers = document.getElementById('maxUsers')?.value;
    const specialTerms = document.getElementById('specialTerms')?.value;
    
    // Bekräfta innan skickning
    const confirmed = confirm(
      `Skicka avtal för ${serviceType} till ${this.deal.customer.email}?\n\n` +
      `Kunden kommer att få ett email med signeringslänk.`
    );
    
    if (!confirmed) return;
    
    const btn = document.getElementById('sendContractBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Skickar avtal...';
    
    try {
      const response = await fetch(`/api/deals/${this.dealId}/send-contract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          serviceType,
          customizations: serviceType === 'custom' ? {
            price: parseInt(customPrice),
            maxUsers: parseInt(maxUsers),
            specialTerms
          } : null
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send contract');
      }
      
      const result = await response.json();
      
      // Visa success-meddelande
      this.showNotification('✅ Avtal skickat!', 
        `Avtalet har skickats till ${this.deal.customer.email}. ` +
        `Du får notis när det signeras.`, 
        'success'
      );
      
      // Uppdatera vyn
      setTimeout(() => {
        this.checkContractStatus();
      }, 1000);
      
    } catch (error) {
      console.error('Error sending contract:', error);
      this.showNotification('❌ Fel', 
        'Kunde inte skicka avtalet. Försök igen.', 
        'error'
      );
      btn.disabled = false;
      btn.textContent = '✉️ Skicka Avtal till Kund';
    }
  }

  async sendReminder() {
    const confirmed = confirm(
      `Skicka påminnelse till ${this.deal.customer.email} om att signera avtalet?`
    );
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/contracts/${this.contract.id}/remind`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to send reminder');
      }
      
      this.showNotification('✅ Påminnelse skickad!', 
        `Email skickat till ${this.deal.customer.email}`, 
        'success'
      );
      
    } catch (error) {
      console.error('Error sending reminder:', error);
      this.showNotification('❌ Fel', 
        'Kunde inte skicka påminnelse. Försök igen.', 
        'error'
      );
    }
  }

  showNotification(title, message, type) {
    // Implementera notification system
    alert(`${title}\n\n${message}`);
  }

  getAuthToken() {
    return localStorage.getItem('authToken');
  }
}

// Initiera när sidan laddas
document.addEventListener('DOMContentLoaded', () => {
  const dealId = new URLSearchParams(window.location.search).get('id');
  if (dealId) {
    new DealContractManager(dealId);
  }
});
