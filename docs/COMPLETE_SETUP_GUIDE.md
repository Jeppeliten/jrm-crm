# 🚀 Komplett Setup Guide - CRM med Avtalhantering

## Översikt

Ett modernt CRM-system med integrerad avtalhantering där säljare kan skicka digitala avtal som automatiskt aktiverar tjänster när de signeras.

**Tidsestimat:** 2-3 veckor  
**Komplexitet:** Medium  
**ROI:** 45x (2,200 kr kostnad → 99,900 kr intäkt vid 100 avtal/mån)

---

## 📋 Fas 1: Grundläggande Setup (Vecka 1)

### Dag 1-2: Azure & Infrastructure

#### ☑️ 1.1 Azure Deployment
```powershell
# Måndagsmorgon: Deployment till Azure
cd c:\Repos\JRM
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
az login
az account list --output table

# Kontrollera att du har Contributor-roll
az role assignment list --assignee jesper.liten@varderingsdata.se -o table

# Kör deployment
echo "yes" | .\scripts\deploy-azure.ps1 -Location "swedencentral"
```

**Resultat:**
- ✅ Resource Group: jrm-crm-prod
- ✅ App Service (Backend): jrm-crm-backend.azurewebsites.net
- ✅ Cosmos DB: jrm-crm-db
- ✅ Storage Account: jrmcrmstorage
- ✅ Application Insights: jrm-crm-insights

**Kostnad:** ~75€/månad

#### ☑️ 1.2 Azure B2C Setup
```bash
# Skapa B2C tenant
1. Gå till portal.azure.com
2. "Create a resource" → "Azure Active Directory B2C"
3. Namn: "jrmcrm" → jrmcrm.onmicrosoft.com
4. Länka till subscription: Marketing-Test-1
```

**Konfigurera User Flows:**
```
Sign up and sign in:
- Email signup
- Display name required
- Custom attributes: 
  * CompanyName (string)
  * OrgNumber (string)
  * CustomerRole (string: Admin, User)
  * CustomerId (string)
```

**App Registration:**
```
1. Register app: "JRM-CRM-Client"
2. Redirect URIs: 
   - https://jrm-crm-backend.azurewebsites.net/auth/callback
   - http://localhost:3000/auth/callback (dev)
3. Generate client secret
4. API Permissions:
   - User.ReadWrite.All
   - Directory.ReadWrite.All
```

#### ☑️ 1.3 Environment Variables
```bash
# Uppdatera i Azure App Service
az webapp config appsettings set \
  --name jrm-crm-backend \
  --resource-group jrm-crm-prod \
  --settings \
    AZURE_B2C_TENANT_NAME=jrmcrm \
    AZURE_B2C_CLIENT_ID=<från app registration> \
    AZURE_B2C_CLIENT_SECRET=<från app registration> \
    AZURE_B2C_POLICY_NAME=B2C_1_signupsignin \
    COSMOS_DB_CONNECTION_STRING=<från cosmos> \
    SESSION_SECRET=<generera random string> \
    SCRIVE_API_KEY=<kommer senare> \
    NODE_ENV=production
```

**Tidsåtgång:** 4-6 timmar

---

### Dag 3-5: Databas & Core Services

#### ☑️ 2.1 Cosmos DB Collections

Skapa dessa collections i Cosmos DB:

```javascript
// 1. customers - Kundföretag
{
  id: "CUST-123",
  customerId: "CUST-123",
  companyName: "Företag AB",
  orgNumber: "556677-8899",
  status: "active", // pending, active, suspended, cancelled
  
  contract: {
    id: "CNT-456",
    signedDate: "2025-11-09",
    documentUrl: "https://...",
    validFrom: "2025-11-09",
    validUntil: "2026-11-09"
  },
  
  service: {
    type: "vardering",
    name: "Värderingstjänst",
    price: 1499,
    billingInterval: "monthly",
    maxUsers: 10
  },
  
  billing: {
    status: "active",
    currentUsers: 3,
    nextBillingDate: "2025-12-01",
    lastInvoiceDate: "2025-11-01"
  },
  
  adminEmail: "admin@foretagab.se",
  createdAt: "2025-11-01"
}

// 2. contracts - Avtal
{
  id: "CNT-456",
  dealId: "DEAL-789",
  customerId: "CUST-123",
  
  companyName: "Företag AB",
  orgNumber: "556677-8899",
  email: "admin@foretagab.se",
  contactPerson: "Anna Andersson",
  
  serviceType: "vardering",
  service: { /* tjänstedetaljer */ },
  
  status: "signed", // pending, sent, signed, active, cancelled
  
  signing: {
    sentDate: "2025-11-01",
    signedDate: "2025-11-02",
    scriveId: "12345",
    documentUrl: "https://..."
  },
  
  createdBy: "USER-salesrep",
  createdAt: "2025-11-01"
}

// 3. deals - CRM Deals
{
  id: "DEAL-789",
  title: "Företag AB - Värdering",
  
  customer: {
    companyName: "Företag AB",
    email: "admin@foretagab.se",
    phone: "070-1234567",
    orgNumber: "556677-8899"
  },
  
  value: 17988, // 1499 × 12 månader
  status: "won", // lead, qualification, proposal, negotiation, contract_sent, won, lost
  
  assignedTo: "USER-salesrep",
  
  contractId: "CNT-456", // Länk till avtal
  wonDate: "2025-11-02",
  
  notes: [],
  activities: [],
  
  createdAt: "2025-10-15",
  updatedAt: "2025-11-02"
}

// 4. audit_logs - Händelselogg
{
  id: "LOG-001",
  type: "contract_event",
  event: "signed", // sent, signed, activated, cancelled
  contractId: "CNT-456",
  userId: "USER-123",
  timestamp: "2025-11-02T10:30:00Z",
  details: { /* extra info */ }
}
```

**Skapa containers via Azure Portal eller CLI:**
```bash
az cosmosdb mongodb collection create \
  --account-name jrm-crm-db \
  --database-name crm \
  --name customers \
  --resource-group jrm-crm-prod

# Upprepa för contracts, deals, audit_logs
```

#### ☑️ 2.2 Service Definitions

```bash
# Skapa fil för tjänstedefinitioner
cat > server/config/service-definitions.js << 'EOF'
module.exports = {
  vardering: {
    name: 'Värderingstjänst',
    type: 'vardering',
    description: 'Professionell värdering av fastigheter',
    price: 1499,
    billingInterval: 'monthly',
    maxUsers: 5,
    contractTemplate: 'vardering.html',
    features: [
      'Automatisk värdering',
      'Historiska data',
      'PDF-rapporter',
      'API-åtkomst'
    ]
  },
  
  konsultation: {
    name: 'Konsultationstjänst',
    type: 'konsultation',
    description: 'Expert konsultation inom fastighet',
    price: 2999,
    billingInterval: 'monthly',
    maxUsers: 10,
    contractTemplate: 'konsultation.html',
    features: [
      'Personlig rådgivning',
      'Prioriterad support',
      'Marknadsanalyser',
      'Investeringsråd'
    ]
  },
  
  crm_access: {
    name: 'CRM Åtkomst',
    type: 'crm_access',
    description: 'Tillgång till vårt CRM-system',
    price: 999,
    billingInterval: 'monthly',
    maxUsers: 20,
    contractTemplate: 'crm-access.html',
    features: [
      'Komplett CRM',
      'Lead management',
      'Rapporter',
      'Integrationer'
    ]
  }
};
EOF
```

**Tidsåtgång:** 6-8 timmar

---

## 📋 Fas 2: Scrive Integration (Vecka 1-2)

### Dag 6-7: Scrive Setup

#### ☑️ 3.1 Scrive Account
```
1. Gå till https://scrive.com/sv
2. Registrera företagskonto
3. Välj plan: 
   - Starter (1995 kr/mån, 20 signeringar)
   - Professional (2995 kr/mån, 50 signeringar)
4. Verifiera företag (BankID)
```

#### ☑️ 3.2 API Credentials
```
1. Logga in på Scrive
2. Settings → API
3. Generera API key
4. Spara säkert!
```

#### ☑️ 3.3 Webhook Configuration
```
Callback URLs:
- Success: https://jrm-crm-backend.azurewebsites.net/api/webhooks/scrive/signed
- Cancel: https://jrm-crm-backend.azurewebsites.net/api/webhooks/scrive/cancelled

Webhook Secret: <generera och spara>
```

#### ☑️ 3.4 Scrive Service Implementation

**Skapa fil:** `server/services/scrive-service.js`

```javascript
const axios = require('axios');

class ScriveService {
  constructor() {
    this.apiKey = process.env.SCRIVE_API_KEY;
    this.apiUrl = 'https://scrive.com/api/v2/documents/new';
  }

  async createDocument(contract, pdfBuffer) {
    const auth = Buffer.from(`${this.apiKey}:`).toString('base64');
    
    const document = {
      title: `Avtal - ${contract.service.name} - ${contract.companyName}`,
      parties: [
        {
          // Er firma
          signatory_role: 'signing_party',
          fields: [
            { type: 'name', value: 'Ert Företag AB', placements: [] }
          ]
        },
        {
          // Kunden
          signatory_role: 'signing_party',
          fields: [
            { type: 'name', value: contract.contactPerson, placements: [] },
            { type: 'email', value: contract.email, placements: [] },
            { type: 'company', value: contract.companyName, placements: [] }
          ],
          delivery_method: 'email'
        }
      ],
      file: {
        name: 'avtal.pdf',
        content: pdfBuffer.toString('base64')
      }
    };

    const response = await axios.post(this.apiUrl, document, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      id: response.data.id,
      signUrl: response.data.signing_url
    };
  }

  verifyWebhook(headers, body) {
    const crypto = require('crypto');
    const signature = headers['x-scrive-signature'];
    const payload = JSON.stringify(body);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.SCRIVE_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  }
}

module.exports = ScriveService;
```

**Installera dependencies:**
```bash
cd server
npm install axios puppeteer
```

**Tidsåtgång:** 4-6 timmar

---

### Dag 8-10: Email & PDF Generation

#### ☑️ 4.1 Email Service

**Konfigurera SendGrid eller Mailgun:**
```bash
# SendGrid (gratis upp till 100 email/dag)
npm install @sendgrid/mail

# Eller Outlook/Microsoft 365
npm install nodemailer
```

**Skapa fil:** `server/services/email-service.js`

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

class EmailService {
  async send({ to, subject, html }) {
    const msg = {
      to,
      from: 'avtal@ertforetag.se', // Verifierad avsändare
      subject,
      html
    };

    try {
      await sgMail.send(msg);
      console.log(`Email sent to ${to}`);
    } catch (error) {
      console.error('Email error:', error);
      throw error;
    }
  }

  async sendContractEmail(customer, signUrl) {
    await this.send({
      to: customer.email,
      subject: `Avtal för ${customer.companyName} - Vänligen signera`,
      html: this.getContractEmailTemplate(customer, signUrl)
    });
  }

  getContractEmailTemplate(customer, signUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0066cc; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { 
            display: inline-block; 
            padding: 14px 28px; 
            background: #0066cc; 
            color: white !important; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Ditt Avtal är Klart</h1>
          </div>
          <div class="content">
            <h2>Hej ${customer.contactPerson}!</h2>
            <p>Tack för ditt intresse för våra tjänster.</p>
            <p>Ditt avtal är nu klart för digital signering med BankID.</p>
            <p style="text-align: center;">
              <a href="${signUrl}" class="button">Signera Avtal med BankID</a>
            </p>
            <p><strong>Vad händer sen?</strong></p>
            <ol>
              <li>Klicka på knappen ovan</li>
              <li>Signera med BankID</li>
              <li>Din tjänst aktiveras automatiskt</li>
              <li>Du får inloggningsuppgifter via email</li>
            </ol>
            <p>Har du frågor? Svara på detta email eller ring 0XX-XXX XX XX.</p>
            <p>Med vänliga hälsningar,<br>Ert Företag AB</p>
          </div>
          <div class="footer">
            <p>Detta email skickades till ${customer.email}</p>
            <p>Ert Företag AB | Adress | Org.nr 556XXX-XXXX</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = EmailService;
```

#### ☑️ 4.2 PDF Generation

**Skapa avtalsmall:** `server/templates/contracts/vardering.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 2cm; }
    body { 
      font-family: 'Arial', sans-serif; 
      line-height: 1.6;
      color: #333;
    }
    h1 { 
      color: #0066cc; 
      border-bottom: 3px solid #0066cc;
      padding-bottom: 10px;
    }
    h2 { 
      color: #0066cc;
      margin-top: 30px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .parties {
      background: #f5f5f5;
      padding: 20px;
      border-left: 4px solid #0066cc;
      margin: 20px 0;
    }
    .terms { margin: 20px 0; }
    .signature-box {
      margin-top: 60px;
      page-break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    table td {
      padding: 8px;
      border: 1px solid #ddd;
    }
    .footer {
      position: fixed;
      bottom: 0;
      width: 100%;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>TJÄNSTEAVTAL</h1>
    <p><strong>Avtalsnummer:</strong> {{contractId}}</p>
    <p><strong>Datum:</strong> {{date}}</p>
  </div>

  <div class="parties">
    <h3>PARTER</h3>
    <table>
      <tr>
        <td><strong>Leverantör:</strong></td>
        <td>
          Ert Företag AB<br>
          Org.nr: 556XXX-XXXX<br>
          Adress: Din Gata 1, 123 45 Stad<br>
          Email: avtal@ertforetag.se
        </td>
      </tr>
      <tr>
        <td><strong>Kund:</strong></td>
        <td>
          {{companyName}}<br>
          Org.nr: {{orgNumber}}<br>
          Kontaktperson: {{contactPerson}}<br>
          Email: {{email}}
        </td>
      </tr>
    </table>
  </div>

  <h2>1. AVTALETS OMFATTNING</h2>
  <div class="terms">
    <p>Detta avtal reglerar leverans av följande tjänst:</p>
    <table>
      <tr>
        <td><strong>Tjänst:</strong></td>
        <td>{{service.name}}</td>
      </tr>
      <tr>
        <td><strong>Beskrivning:</strong></td>
        <td>{{service.description}}</td>
      </tr>
      <tr>
        <td><strong>Pris:</strong></td>
        <td>{{service.price}} SEK per {{service.billingIntervalText}}</td>
      </tr>
      <tr>
        <td><strong>Max användare:</strong></td>
        <td>{{service.maxUsers}} st</td>
      </tr>
    </table>
    
    <p><strong>Inkluderade funktioner:</strong></p>
    <ul>
      {{#each service.features}}
        <li>{{this}}</li>
      {{/each}}
    </ul>
  </div>

  <h2>2. AVTALSPERIOD</h2>
  <p>Avtalet gäller från {{validFrom}} till {{validUntil}}.</p>
  <p>Avtalet förlängs automatiskt med 12 månader i taget om det inte sägs upp senast 30 dagar före avtalsperiodens utgång.</p>

  <h2>3. PRIS OCH BETALNING</h2>
  <p>Kunden betalar {{service.price}} SEK per {{service.billingIntervalText}} för upp till {{service.maxUsers}} användare.</p>
  <p>Fakturering sker månadsvis i förskott. Betalningsvillkor 30 dagar netto.</p>
  <p>Vid försenad betalning utgår dröjsmålsränta enligt räntelagen samt påminnelseavgift 60 SEK.</p>

  <h2>4. LEVERANS OCH SUPPORT</h2>
  <p>Tjänsten tillhandahålls via webbläsare på adressen som anges av leverantören.</p>
  <p>Support tillhandahålls via email och telefon vardagar kl. 09:00-17:00.</p>
  <p>Svarstid för supportärenden är max 24 timmar under kontorstid.</p>

  <h2>5. ANVÄNDARHANTERING</h2>
  <p>Kunden kan själv lägga till och ta bort användare via tjänstens adminpanel.</p>
  <p>Varje användare får unika inloggningsuppgifter som inte får delas.</p>
  <p>Kunden ansvarar för alla aktiviteter som utförs under kundens användarkonton.</p>

  <h2>6. PERSONUPPGIFTSBEHANDLING</h2>
  <p>Leverantören behandlar personuppgifter för kundens räkning enligt gällande dataskyddslagstiftning (GDPR).</p>
  <p>Fullständig information om personuppgiftsbehandling finns på: www.ertforetag.se/gdpr</p>

  <h2>7. ANSVARSBEGRÄNSNING</h2>
  <p>Leverantörens totala ansvar gentemot kunden är begränsat till det belopp som kunden betalat under de senaste 12 månaderna.</p>
  <p>Leverantören ansvarar inte för indirekta skador eller följdskador.</p>

  <h2>8. UPPSÄGNING</h2>
  <p>Avtalet kan sägas upp av båda parter med 30 dagars varsel till avtalsperiodens utgång.</p>
  <p>Vid uppsägning i förtid utgår ingen återbetalning av redan fakturerade belopp.</p>
  <p>Vid kund's väsentliga avtalsbrott har leverantören rätt att säga upp avtalet med omedelbar verkan.</p>

  <h2>9. ÖVRIGT</h2>
  <p>På detta avtal tillämpas svensk rätt.</p>
  <p>Tvister ska avgöras av svensk domstol med [Stad] tingsrätt som första instans.</p>

  <div class="signature-box">
    <p>Detta avtal har upprättats och signerats digitalt.</p>
    <table>
      <tr>
        <td style="width: 50%;">
          <p><strong>För leverantören:</strong></p>
          <p>Ert Företag AB</p>
          <br>
          <p>_______________________________</p>
          <p>Namn och titel</p>
          <p>Datum: {{date}}</p>
        </td>
        <td style="width: 50%;">
          <p><strong>För kunden:</strong></p>
          <p>{{companyName}}</p>
          <br>
          <p>_______________________________</p>
          <p>{{contactPerson}}</p>
          <p>Datum: _______________</p>
        </td>
      </tr>
    </table>
  </div>

  <div class="footer">
    <p>Avtal genererat {{date}} | Ert Företag AB | www.ertforetag.se</p>
  </div>
</body>
</html>
```

**PDF Generator:**

```javascript
// server/services/pdf-service.js
const puppeteer = require('puppeteer');
const Handlebars = require('handlebars');
const fs = require('fs').promises;

class PDFService {
  async generateFromTemplate(templatePath, data) {
    // Läs mall
    const template = await fs.readFile(templatePath, 'utf-8');
    
    // Kompilera Handlebars
    const compile = Handlebars.compile(template);
    const html = compile(data);
    
    // Generera PDF med Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    
    await browser.close();
    
    return pdf;
  }
}

module.exports = PDFService;
```

**Installera dependencies:**
```bash
npm install handlebars
```

**Tidsåtgång:** 8-10 timmar

---

## 📋 Fas 3: CRM UI Implementation (Vecka 2)

### Dag 11-14: Frontend Development

#### ☑️ 5.1 Deal Management UI

**Uppdatera:** `client/views/deals.html`

```html
<!DOCTYPE html>
<html>
<head>
  <title>Deals - JRM CRM</title>
  <link rel="stylesheet" href="/css/styles-modern.css">
  <link rel="stylesheet" href="/css/contract-management.css">
</head>
<body>
  <div class="container">
    <h1>📊 Deals Pipeline</h1>
    
    <!-- Kanban Board -->
    <div class="pipeline">
      <div class="pipeline-stage" data-stage="lead">
        <h3>🔍 Leads (5)</h3>
        <div class="deal-cards" id="stage-lead"></div>
      </div>
      
      <div class="pipeline-stage" data-stage="qualification">
        <h3>✅ Kvalificering (3)</h3>
        <div class="deal-cards" id="stage-qualification"></div>
      </div>
      
      <div class="pipeline-stage" data-stage="proposal">
        <h3>📄 Förslag (4)</h3>
        <div class="deal-cards" id="stage-proposal"></div>
      </div>
      
      <div class="pipeline-stage" data-stage="negotiation">
        <h3>🤝 Förhandling (2)</h3>
        <div class="deal-cards" id="stage-negotiation"></div>
      </div>
      
      <div class="pipeline-stage" data-stage="contract_sent">
        <h3>📤 Avtal skickat (6)</h3>
        <div class="deal-cards" id="stage-contract-sent"></div>
      </div>
      
      <div class="pipeline-stage won" data-stage="won">
        <h3>🎉 Vunna (12)</h3>
        <div class="deal-cards" id="stage-won"></div>
      </div>
    </div>
  </div>
  
  <script src="/js/deals-manager.js"></script>
</body>
</html>
```

#### ☑️ 5.2 Deal Detail View

**Skapa:** `client/views/deal-detail.html`

```html
<!DOCTYPE html>
<html>
<head>
  <title>Deal Details - JRM CRM</title>
  <link rel="stylesheet" href="/css/styles-modern.css">
  <link rel="stylesheet" href="/css/contract-management.css">
</head>
<body>
  <div class="container">
    <div class="deal-header">
      <h1 id="deal-title"></h1>
      <div class="deal-meta" id="deal-meta"></div>
    </div>
    
    <div class="deal-content">
      <!-- Vänster kolumn: Deal info -->
      <div class="deal-info">
        <div class="card">
          <h2>Företagsinformation</h2>
          <div id="customer-info"></div>
        </div>
        
        <div class="card">
          <h2>Aktiviteter</h2>
          <div id="activities"></div>
        </div>
      </div>
      
      <!-- Höger kolumn: Avtal -->
      <div class="deal-contract">
        <div id="contract-section">
          <!-- Avtalkomponenten laddas här -->
        </div>
      </div>
    </div>
  </div>
  
  <script src="/js/deal-contract-manager.js"></script>
</body>
</html>
```

**Tidsåtgång:** 12-16 timmar

---

## 📋 Fas 4: Testing & Launch (Vecka 3)

### Dag 15-17: Testing

#### ☑️ 6.1 End-to-End Test

**Test scenario:**

```javascript
// Test script
async function testCompleteFlow() {
  // 1. Skapa deal
  const deal = await createDeal({
    title: 'Test AB - Värdering',
    customer: {
      companyName: 'Test AB',
      orgNumber: '556123-4567',
      email: 'test@testab.se',
      contactPerson: 'Test Testsson'
    },
    value: 17988,
    status: 'negotiation'
  });
  
  // 2. Skicka avtal
  const contract = await sendContract(deal.id, {
    serviceType: 'vardering'
  });
  
  assert(contract.status === 'sent');
  assert(contract.signing.sentDate);
  
  // 3. Simulera signering (via Scrive webhook)
  await simulateWebhook({
    document_id: contract.signing.scriveId,
    status: 'signed',
    signed_at: new Date()
  });
  
  // 4. Verifiera att tjänsten aktiverats
  const customer = await getCustomer(contract.customerId);
  assert(customer.status === 'active');
  
  // 5. Verifiera att användare skapats i Azure B2C
  const user = await getAzureUser(customer.adminEmail);
  assert(user.customAttributes.customerId === customer.customerId);
  
  // 6. Verifiera att deal är Won
  const updatedDeal = await getDeal(deal.id);
  assert(updatedDeal.status === 'won');
  
  console.log('✅ All tests passed!');
}
```

#### ☑️ 6.2 Manual Testing Checklist

```
□ Skapa deal manuellt
□ Fyll i kundinfo
□ Välj tjänst
□ Skicka avtal
□ Kolla att email kommer fram
□ Öppna signeringslänk
□ Signera med BankID (test)
□ Vänta på webhook
□ Kontrollera att tjänst aktiveras
□ Kontrollera att användare skapas
□ Logga in med ny användare
□ Verifiera access till tjänst
□ Testa påminnelsemail
□ Testa avbruten signering
```

**Tidsåtgång:** 8-12 timmar

---

### Dag 18-21: Launch Preparation

#### ☑️ 7.1 Production Checklist

```bash
# Säkerhetskontroller
□ HTTPS aktiverat
□ CORS konfigurerat korrekt
□ Rate limiting aktivt
□ API keys roterade
□ Webhook secrets satta
□ CSP headers konfigurerade

# Monitoring
□ Application Insights aktiverat
□ Error tracking setup
□ Performance monitoring
□ Custom events för avtalsflöde

# Backup
□ Cosmos DB backup aktiverat (Point-in-time restore)
□ Blob storage backup
□ Azure B2C export schedule

# Dokumentation
□ API dokumentation klar
□ Användarguider klara
□ Support-processer definierade
□ Eskalering definierad
```

#### ☑️ 7.2 Soft Launch

**Vecka 1: Intern testning**
- 5 test-deals med riktiga kollegor
- Samla feedback
- Fixa buggar

**Vecka 2: Beta-kunder**
- 3-5 pilotakunder
- Extra support
- Täta uppföljningar

**Vecka 3: Full launch**
- Öppna för alla säljare
- Kommunikation till teamet
- Support bemanning

**Tidsåtgång:** 6-8 timmar setup + löpande

---

## 📊 Sammanfattning Timeline

### Vecka 1: Foundation
- **Dag 1-2:** Azure deployment (6h)
- **Dag 3-5:** Database & services (8h)
- **Dag 6-7:** Scrive integration (6h)
- **Dag 8-10:** Email & PDF (10h)
- **Total:** ~30 timmar

### Vecka 2: Development
- **Dag 11-14:** CRM UI (16h)
- **Dag 15-17:** Testing (12h)
- **Total:** ~28 timmar

### Vecka 3: Launch
- **Dag 18-21:** Preparation & soft launch (8h + löpande)
- **Total:** ~8 timmar

**TOTAL UTVECKLINGSTID:** ~66 timmar (≈ 2.5 veckor)

---

## 💰 Kostnadskalkyl

### Engångskostnader
- **Scrive setup:** 0 kr (ingår)
- **SendGrid:** 0 kr (gratis tier)
- **Utveckling:** 66h × egen tid

### Månadskostnader
- **Azure:**
  - App Service (B1): 320 kr
  - Cosmos DB: 500 kr
  - Storage: 50 kr
  - Application Insights: 100 kr
  - **Subtotal:** ~970 kr
  
- **Scrive:**
  - Starter plan: 1,995 kr
  - (eller 99 kr per signering)
  
- **SendGrid:**
  - Gratis upp till 100 email/dag
  - Sen från 140 kr/mån

**TOTAL MÅNADSKOSTNAD:** ~3,100 kr

### Intäktspotential
- **100 avtal/mån × 999 kr = 99,900 kr**
- **Kostnad:** 3,100 kr
- **Vinst:** 96,800 kr/mån
- **ROI:** 3,122% 🚀

---

## 🎯 Success Metrics

### KPIs att följa
```javascript
{
  // Conversion funnel
  deals_created: 50,
  contracts_sent: 40,        // 80% conversion
  contracts_signed: 32,      // 80% conversion
  services_activated: 32,    // 100% (automatiskt)
  
  // Tidsåtgång
  avg_time_to_send: '5 min',
  avg_time_to_sign: '2 dagar',
  avg_deal_cycle: '14 dagar',
  
  // Revenue
  mrr: 99900,                // Monthly Recurring Revenue
  arr: 1198800,              // Annual Recurring Revenue
  ltv: 17988,                // Lifetime Value per kund (12 mån)
  cac: 500,                  // Customer Acquisition Cost
  
  // Efficiency
  contracts_per_salesperson: 20,
  time_saved_per_contract: '2 timmar'
}
```

---

## 🚨 Risk Management

### Potentiella problem

#### Problem 1: Scrive API går ner
**Lösning:** 
- Fallback till manuell signering
- Queue system för att skicka om
- Status-sida för att informera

#### Problem 2: Email hamnar i spam
**Lösning:**
- SPF/DKIM konfigurerat
- DMARC policy
- Varmt upp avsändare-IP
- Personliga emails från säljare

#### Problem 3: Kund signerar inte
**Lösning:**
- Automatisk påminnelse dag 3, 7, 14
- Notis till säljare
- Telefon-uppföljning

#### Problem 4: Azure B2C ner
**Lösning:**
- Status page
- Backup auth system
- SLA garantier från Microsoft

---

## 📞 Support Plan

### Level 1: Säljare
- FAQ dokument
- Video tutorials
- Slack channel för snabba frågor

### Level 2: Tech Support
- Email: support@ertforetag.se
- Telefon: 0XX-XXX XX XX
- SLA: Svar inom 4h

### Level 3: Utvecklare
- Kritiska buggar: Omedelbar eskalering
- Scrive integration issues
- Azure problem

---

## ✅ Go-Live Checklist

```bash
# Pre-launch
□ Alla tester godkända
□ Security audit klar
□ Performance test >1000 RPS
□ Backup & recovery testat
□ Monitoring alerts konfigurerade
□ Dokumentation klar
□ Support team tränade

# Launch day
□ Deploy till production
□ Smoke tests körda
□ Monitoring aktiv
□ Support redo
□ Kommunikation skickad

# Post-launch
□ Monitor errors första 24h
□ Daily check-ins första veckan
□ Samla feedback
□ Snabba bugfixar vid behov
```

---

## 🎓 Training Material

### För säljare
1. **Video 1:** "Skapa och skicka avtal" (5 min)
2. **Video 2:** "Följa upp osignerade avtal" (3 min)
3. **Video 3:** "Hantera vunna deals" (4 min)
4. **PDF guide:** Quick reference

### För admin
1. **Video:** "Övervaka avtalsstatus" (10 min)
2. **Video:** "Hantera fakturering" (8 min)
3. **Manual:** Troubleshooting guide

---

## 🚀 Quick Start Commands

```powershell
# Komplett setup från början
git clone <repo>
cd c:\Repos\JRM

# 1. Deploy Azure
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
az login
echo "yes" | .\scripts\deploy-azure.ps1 -Location "swedencentral"

# 2. Install dependencies
cd server
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your keys

# 4. Deploy code
npm run build
az webapp deployment source config-zip `
  --name jrm-crm-backend `
  --resource-group jrm-crm-prod `
  --src deploy.zip

# 5. Test
curl https://jrm-crm-backend.azurewebsites.net/health
```

---

## 📈 Next Steps After Launch

### Month 1: Stabilize
- Monitor errors
- Fix bugs
- Optimize performance
- Gather feedback

### Month 2: Improve
- Add analytics dashboard
- Automated reminders
- Better email templates
- Mobile optimization

### Month 3: Scale
- Multi-tenant improvements
- API för partners
- Integration med ekonomisystem
- Advanced reporting

---

**🎯 Redo att börja? Kör igång med Fas 1, Dag 1!**
