/**
 * Contract Service - Hantera kundavtal direkt från CRM
 */

class ContractService {
  constructor() {
    this.scriveApiKey = process.env.SCRIVE_API_KEY;
    this.scriveApiUrl = 'https://scrive.com/api/v2';
  }

  /**
   * Skapa och skicka avtal till kund från CRM
   */
  async createAndSendContract(deal, service) {
    const customer = deal.customer;
    
    // 1. Skapa avtalsdokument
    const contract = {
      id: this.generateContractId(),
      dealId: deal.id,
      customerId: customer.id,
      serviceType: service.type, // 'vardering', 'konsultation', etc.
      
      // Avtalsinformation
      companyName: customer.companyName,
      orgNumber: customer.orgNumber,
      contactPerson: customer.contactPerson,
      email: customer.email,
      phone: customer.phone,
      
      // Tjänstedetaljer
      service: {
        name: service.name,
        description: service.description,
        price: service.price,
        billingInterval: service.billingInterval, // 'monthly', 'yearly'
        maxUsers: service.maxUsers || 10,
        features: service.features
      },
      
      // Status
      status: 'pending', // pending → sent → signed → active
      createdAt: new Date(),
      createdBy: deal.assignedTo, // Säljaren som skapade avtalet
      
      // Signeringsinformation (fylls i senare)
      signing: {
        sentDate: null,
        signedDate: null,
        signedBy: null,
        scriveId: null,
        documentUrl: null
      }
    };
    
    // 2. Spara i databasen
    await this.saveContract(contract);
    
    // 3. Skapa signeringslänk via Scrive
    const scriveDoc = await this.createScriveDocument(contract);
    
    // 4. Uppdatera med Scrive-info
    contract.signing.scriveId = scriveDoc.id;
    contract.signing.sentDate = new Date();
    contract.status = 'sent';
    await this.updateContract(contract);
    
    // 5. Skicka email till kund med signeringslänk
    await this.sendContractEmail(customer, scriveDoc.signUrl);
    
    // 6. Logga aktivitet i CRM
    await this.logCrmActivity(deal.id, {
      type: 'contract_sent',
      description: `Avtal skickat till ${customer.email}`,
      contractId: contract.id
    });
    
    return contract;
  }

  /**
   * Skapa dokument i Scrive för e-signering
   */
  async createScriveDocument(contract) {
    // Välj rätt avtalsmall baserat på tjänst
    const template = this.getContractTemplate(contract.service.type);
    
    // Fyll i avtalsdata
    const documentData = {
      title: `Avtal - ${contract.service.name} - ${contract.companyName}`,
      parties: [
        {
          // Er firma
          email: 'avtal@ertforetag.se',
          name: 'Ert Företag AB',
          orgNumber: '556XXX-XXXX',
          signatory: true
        },
        {
          // Kunden
          email: contract.email,
          name: contract.companyName,
          orgNumber: contract.orgNumber,
          signatory: true,
          fields: [
            { type: 'name', value: contract.contactPerson },
            { type: 'company', value: contract.companyName },
            { type: 'org_number', value: contract.orgNumber }
          ]
        }
      ],
      file: await this.generatePdfFromTemplate(template, contract),
      
      // Webhook för att få notis när avtalet signeras
      callbacks: {
        success: `${process.env.API_URL}/webhooks/scrive/signed`,
        cancel: `${process.env.API_URL}/webhooks/scrive/cancelled`
      }
    };
    
    // Anropa Scrive API (pseudo-kod, verklig implementation beror på Scrive SDK)
    const response = await this.scriveApi.createDocument(documentData);
    
    return {
      id: response.id,
      signUrl: response.signing_url,
      status: response.status
    };
  }

  /**
   * Webhook när avtal signeras i Scrive
   */
  async handleScriveWebhook(data) {
    const { document_id, status, signed_at, pdf_url } = data;
    
    if (status !== 'signed') {
      return;
    }
    
    // 1. Hitta avtalet
    const contract = await this.findContractByScriveId(document_id);
    
    if (!contract) {
      console.error('Contract not found for Scrive ID:', document_id);
      return;
    }
    
    // 2. Uppdatera avtalsstatus
    contract.status = 'signed';
    contract.signing.signedDate = new Date(signed_at);
    contract.signing.documentUrl = pdf_url;
    await this.updateContract(contract);
    
    // 3. Aktivera tjänsten automatiskt!
    await this.activateService(contract);
    
    // 4. Skapa användare i Azure B2C
    await this.setupCustomerAccess(contract);
    
    // 5. Skicka välkomstmail med inloggningsinfo
    await this.sendWelcomeEmail(contract);
    
    // 6. Uppdatera CRM-dealen
    await this.updateCrmDeal(contract.dealId, {
      status: 'won',
      wonDate: new Date(),
      note: 'Avtal signerat och tjänst aktiverad'
    });
    
    // 7. Logga i CRM
    await this.logCrmActivity(contract.dealId, {
      type: 'contract_signed',
      description: `Avtal signerat av ${contract.companyName}`,
      contractId: contract.id
    });
    
    return contract;
  }

  /**
   * Aktivera tjänsten efter signering
   */
  async activateService(contract) {
    const serviceAccount = {
      customerId: this.generateCustomerId(),
      companyName: contract.companyName,
      orgNumber: contract.orgNumber,
      
      // Avtalsinformation
      contract: {
        id: contract.id,
        signedDate: contract.signing.signedDate,
        documentUrl: contract.signing.documentUrl,
        validFrom: new Date(),
        validUntil: this.calculateValidUntil(contract.service.billingInterval)
      },
      
      // Tjänsteinställningar
      service: contract.service,
      
      // Fakturering
      billing: {
        status: 'active',
        pricePerUser: contract.service.price,
        maxUsers: contract.service.maxUsers,
        currentUsers: 0,
        billingInterval: contract.service.billingInterval,
        nextBillingDate: this.calculateNextBilling()
      },
      
      // Admin användare
      adminEmail: contract.email,
      
      status: 'active',
      activatedAt: new Date()
    };
    
    // Spara i Cosmos DB
    await this.cosmosService.createServiceAccount(serviceAccount);
    
    return serviceAccount;
  }

  /**
   * Skapa admin-användare i Azure B2C för kunden
   */
  async setupCustomerAccess(contract) {
    const tempPassword = this.generateTempPassword();
    
    // Skapa användare i Azure B2C
    const user = await this.azureB2CService.createUser({
      email: contract.email,
      displayName: contract.contactPerson,
      companyName: contract.companyName,
      customerId: contract.customerId,
      role: 'CustomerAdmin', // Kan bjuda in andra användare
      tempPassword: tempPassword,
      forcePasswordChange: true
    });
    
    return { user, tempPassword };
  }

  /**
   * Hämta rätt avtalsmall
   */
  getContractTemplate(serviceType) {
    const templates = {
      'vardering': 'templates/contracts/vardering.html',
      'konsultation': 'templates/contracts/konsultation.html',
      'crm_access': 'templates/contracts/crm-access.html',
      'default': 'templates/contracts/standard.html'
    };
    
    return templates[serviceType] || templates.default;
  }

  /**
   * Generera PDF från HTML-mall
   */
  async generatePdfFromTemplate(template, contract) {
    // Använd puppeteer eller liknande för PDF-generering
    const html = await this.renderTemplate(template, {
      companyName: contract.companyName,
      orgNumber: contract.orgNumber,
      contactPerson: contract.contactPerson,
      service: contract.service,
      date: new Date().toLocaleDateString('sv-SE'),
      validFrom: new Date().toLocaleDateString('sv-SE'),
      validUntil: this.calculateValidUntil(contract.service.billingInterval).toLocaleDateString('sv-SE')
    });
    
    // Konvertera till PDF (pseudo-kod)
    const pdf = await this.htmlToPdf(html);
    return pdf;
  }

  /**
   * Skicka avtalsemail till kund
   */
  async sendContractEmail(customer, signUrl) {
    const emailData = {
      to: customer.email,
      subject: `Avtal för ${customer.companyName} - Vänligen signera`,
      html: `
        <h2>Hej ${customer.contactPerson}!</h2>
        <p>Tack för ditt intresse för våra tjänster.</p>
        <p>Ditt avtal är klart för signering. Klicka på länken nedan för att läsa och signera avtalet digitalt:</p>
        <p><a href="${signUrl}" style="display:inline-block;padding:12px 24px;background:#0066cc;color:white;text-decoration:none;border-radius:4px;">Signera Avtal</a></p>
        <p>När avtalet är signerat aktiveras din tjänst automatiskt och du får inloggningsuppgifter via email.</p>
        <p>Har du frågor? Kontakta din säljare eller vår support.</p>
        <p>Med vänliga hälsningar,<br>Ert Företag AB</p>
      `
    };
    
    await this.emailService.send(emailData);
  }

  /**
   * Skicka välkomstmail med inloggningsinfo
   */
  async sendWelcomeEmail(contract) {
    const loginUrl = `${process.env.CLIENT_URL}/login`;
    
    const emailData = {
      to: contract.email,
      subject: `Välkommen! Din tjänst är nu aktiverad`,
      html: `
        <h2>Välkommen till ${contract.service.name}!</h2>
        <p>Hej ${contract.contactPerson}!</p>
        <p>Tack för att du signerat avtalet. Din tjänst är nu aktiverad! 🎉</p>
        
        <h3>Inloggningsuppgifter</h3>
        <p><strong>URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
        <p><strong>Email:</strong> ${contract.email}</p>
        <p><strong>Lösenord:</strong> Kommer i separat email</p>
        
        <h3>Nästa steg</h3>
        <ol>
          <li>Logga in med dina uppgifter</li>
          <li>Byt ditt temporära lösenord</li>
          <li>Bjud in dina kollegor (max ${contract.service.maxUsers} användare)</li>
        </ol>
        
        <h3>Support</h3>
        <p>Har du frågor? Kontakta oss på support@ertforetag.se</p>
        
        <p>Med vänliga hälsningar,<br>Ert Företag AB</p>
      `
    };
    
    await this.emailService.send(emailData);
  }

  /**
   * Hjälpfunktioner
   */
  generateContractId() {
    return `CNT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateCustomerId() {
    return `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  generateTempPassword() {
    // Generera säkert temporärt lösenord
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  calculateValidUntil(billingInterval) {
    const date = new Date();
    if (billingInterval === 'monthly') {
      date.setMonth(date.getMonth() + 1);
    } else if (billingInterval === 'yearly') {
      date.setFullYear(date.getFullYear() + 1);
    }
    return date;
  }

  calculateNextBilling() {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date;
  }
}

module.exports = ContractService;
