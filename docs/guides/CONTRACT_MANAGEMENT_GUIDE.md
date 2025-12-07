# 📋 CRM Avtalhantering - Implementation Guide

## Översikt

Detta system låter dina säljare hantera kundavtal direkt från CRM:et. När en deal är redo skickas ett digitalt avtal som kunden signerar, varefter tjänsten aktiveras automatiskt.

## Flöde

```
1. Säljare: Deal klar för avtal
   ↓
2. Säljare: Klickar "Skicka Avtal" i CRM
   ↓
3. Kund: Får email med signeringslänk
   ↓
4. Kund: Signerar avtalet digitalt (Scrive)
   ↓
5. System: Aktiverar tjänsten automatiskt
   ↓
6. System: Skapar användare i Azure B2C
   ↓
7. Kund: Får välkomstmail med inloggning
   ↓
8. CRM: Deal markeras som "Won"
   ↓
9. Säljare: Får notis om signerat avtal
```

## Installation

### 1. Installera dependencies

```bash
cd server
npm install puppeteer    # För PDF-generering
npm install nodemailer   # För email
```

### 2. Konfigurera Scrive

Skapa konto på https://scrive.com och hämta API-nyckel.

```env
# server/.env
SCRIVE_API_KEY=your_api_key_here
SCRIVE_API_URL=https://scrive.com/api/v2
```

### 3. Lägg till routes

```javascript
// server/index.js
const contractRoutes = require('./routes/contracts');
app.use('/api', contractRoutes);
```

### 4. Skapa avtalsmaller

```bash
mkdir -p server/templates/contracts
```

Skapa HTML-mallar för olika tjänster:

```html
<!-- server/templates/contracts/vardering.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Avtal - Värderingstjänst</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #0066cc; }
    .terms { margin: 20px 0; }
  </style>
</head>
<body>
  <h1>AVTAL - VÄRDERINGSTJÄNST</h1>
  
  <p><strong>Mellan:</strong></p>
  <p>Ert Företag AB, org.nr 556XXX-XXXX</p>
  <p>och</p>
  <p>{{companyName}}, org.nr {{orgNumber}}</p>
  
  <h2>1. OMFATTNING</h2>
  <div class="terms">
    <p>Detta avtal avser tillhandahållande av värderingstjänst enligt följande:</p>
    <ul>
      <li>Tjänst: {{service.name}}</li>
      <li>Pris: {{service.price}} kr/{{service.billingInterval}}</li>
      <li>Max användare: {{service.maxUsers}}</li>
    </ul>
  </div>
  
  <h2>2. AVTALSPERIOD</h2>
  <p>Avtalet gäller från {{validFrom}} till {{validUntil}} med automatisk förlängning.</p>
  
  <h2>3. UPPSÄGNING</h2>
  <p>Avtalet kan sägas upp med 30 dagars varsel.</p>
  
  <h2>4. BETALNINGSVILLKOR</h2>
  <p>Fakturering sker månadsvis i förskott. Betalningsvillkor 30 dagar.</p>
  
  <h2>5. SUPPORT</h2>
  <p>Inkluderar email-support vardagar 09:00-17:00.</p>
  
  <h2>6. PERSONUPPGIFTER</h2>
  <p>Personuppgifter behandlas enligt vår dataskyddspolicy tillgänglig på www.ertforetag.se/gdpr</p>
  
  <div style="margin-top: 60px; page-break-inside: avoid;">
    <p>Datum: {{date}}</p>
    <br><br>
    <p>_______________________________</p>
    <p>{{contactPerson}}</p>
    <p>{{companyName}}</p>
  </div>
</body>
</html>
```

### 5. Uppdatera CRM UI

Lägg till i deal-vyn:

```html
<!-- client/views/deal-detail.html -->
<link rel="stylesheet" href="/css/contract-management.css">

<div id="contract-section">
  <!-- Avtalkomponent laddas här -->
</div>

<script src="/js/deal-contract-manager.js"></script>
```

## Användning

### För Säljare

1. **Öppna en deal** som är i status "Negotiation" eller "Proposal"

2. **Scrolla till Avtalssektionen**

3. **Välj tjänst** från dropdown:
   - Värderingstjänst - 1499 kr/mån
   - Konsultation - 2999 kr/mån
   - CRM Åtkomst - 999 kr/mån
   - Anpassat avtal

4. **Anpassa** (vid behov):
   - Pris
   - Max användare
   - Särskilda villkor

5. **Klicka "Skicka Avtal"**

6. **Kunden får email** med signeringslänk

7. **Vänta på signering** (du får notis)

8. **När signerat:**
   - Deal markeras som "Won"
   - Kunden får inloggning
   - Tjänsten är aktiv

### För Kunder

1. **Får email** med rubrik "Avtal för [Företag] - Vänligen signera"

2. **Klickar på länken** → öppnas i Scrive

3. **Läser avtalet**

4. **Signerar digitalt** med BankID/eID

5. **Får bekräftelse** → avtalet är signerat

6. **Får välkomstmail** med:
   - Inloggningslänk
   - Temporärt lösenord
   - Instruktioner

7. **Loggar in** och börjar använda tjänsten

## Scrive Integration

### Webhook Setup

Konfigurera webhook i Scrive:
- Success URL: `https://yourapi.se/webhooks/scrive/signed`
- Cancel URL: `https://yourapi.se/webhooks/scrive/cancelled`

### Webhook-säkerhet

```javascript
// Verifiera Scrive webhook
function verifySignature(req) {
  const signature = req.headers['x-scrive-signature'];
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', process.env.SCRIVE_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  return signature === expectedSignature;
}
```

## Tjänstedefinitioner

Skapa fil för tjänster:

```javascript
// server/config/service-definitions.js
module.exports = {
  vardering: {
    name: 'Värderingstjänst',
    type: 'vardering',
    description: 'Professionell värdering av fastigheter',
    price: 1499,
    billingInterval: 'monthly',
    maxUsers: 5,
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
    features: [
      'Komplett CRM',
      'Lead management',
      'Rapporter',
      'Integrationer'
    ]
  }
};
```

## Notifikationer

### För Säljare

Skicka notis när avtal signeras:

```javascript
// Via email
await emailService.send({
  to: salesperson.email,
  subject: '🎉 Avtal signerat!',
  html: `
    <h2>Grattis!</h2>
    <p>${customer.companyName} har signerat avtalet!</p>
    <p>Dealen är nu Won och tjänsten är aktiverad.</p>
    <a href="${process.env.CRM_URL}/deals/${dealId}">Visa deal</a>
  `
});

// Via push notification (om implementerat)
await pushService.send(salesperson.id, {
  title: 'Avtal signerat!',
  body: `${customer.companyName} signerade avtalet`,
  action: `/deals/${dealId}`
});
```

## Monitorering

### Logga avtalshändelser

```javascript
// server/services/audit-log.js
async function logContractEvent(event) {
  await cosmosService.createDocument('audit_logs', {
    type: 'contract_event',
    event: event.type, // sent, signed, cancelled, activated
    contractId: event.contractId,
    dealId: event.dealId,
    customerId: event.customerId,
    userId: event.userId,
    timestamp: new Date(),
    details: event.details
  });
}
```

### Dashboard för admin

Skapa översikt:
- Skickade avtal (väntar på signering)
- Signerade avtal (senaste 30 dagarna)
- Avbrutna avtal
- Aktiva tjänster
- MRR (Monthly Recurring Revenue)

## Fakturering

### Automatisk fakturering

```javascript
// Kör varje dag
async function checkBillingDates() {
  const dueAccounts = await cosmosService.query(`
    SELECT * FROM serviceAccounts 
    WHERE billing.nextBillingDate <= GETDATE()
    AND billing.status = 'active'
  `);
  
  for (const account of dueAccounts) {
    await createInvoice(account);
  }
}

async function createInvoice(account) {
  const invoice = {
    customerId: account.customerId,
    amount: account.billing.pricePerUser * account.billing.currentUsers,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    items: [{
      description: `${account.service.name} - ${account.billing.currentUsers} användare`,
      quantity: account.billing.currentUsers,
      unitPrice: account.billing.pricePerUser,
      total: account.billing.pricePerUser * account.billing.currentUsers
    }]
  };
  
  // Integrera med Fortnox/annat faktureringssystem
  await fortnoxService.createInvoice(invoice);
  
  // Skicka email
  await emailService.sendInvoice(account.adminEmail, invoice);
  
  // Uppdatera nästa faktureringsdatum
  account.billing.nextBillingDate = calculateNextBilling();
  await cosmosService.updateDocument(account);
}
```

## Säkerhet

### Kontrollera åtkomst

```javascript
// Middleware: Kräv aktivt avtal
app.use('/api/service/*', async (req, res, next) => {
  const customer = await getCustomer(req.user.customerId);
  
  if (customer.status !== 'active') {
    return res.status(403).json({ 
      error: 'Service not active',
      reason: customer.status 
    });
  }
  
  if (customer.billing.status === 'overdue') {
    return res.status(403).json({ 
      error: 'Payment overdue' 
    });
  }
  
  next();
});
```

## Support

### Vanliga frågor

**Q: Vad händer om kunden inte signerar?**
A: Säljaren kan skicka påminnelse via CRM. Efter 7 dagar utan signering får säljaren notis.

**Q: Kan man ändra avtalet efter signering?**
A: Nej, man måste skapa ett nytt avtal. Det gamla kan stängas av.

**Q: Hur hanteras uppsägning?**
A: Kunden kan säga upp via sin portal, eller ni kan stänga av kontot manuellt i admin.

**Q: Vad händer vid utebliven betalning?**
A: Efter 30 dagar stängs tjänsten av automatiskt tills betalning sker.

## Nästa steg

1. ✅ Implementera Scrive-integration
2. ✅ Skapa avtalsmaller
3. ⏳ Sätt upp webhook-endpoints
4. ⏳ Konfigurera email-tjänst
5. ⏳ Testa hela flödet
6. ⏳ Gå live!

## Kostnad

**Scrive:**
- 99 SEK per signerat avtal
- Eller fast månadsavgift från 1995 SEK/mån

**Azure B2C:**
- Gratis upp till 50,000 MAU (Monthly Active Users)
- Sen 0.0125 SEK per användare

**Total estimerad kostnad:**
- Scrive: ~2000 kr/mån (20 avtal/mån)
- Azure: ~200 kr/mån (1000 användare)
- **Totalt: ~2200 kr/mån**

Med 100 avtal = 100 × 999 kr = 99,900 kr/mån i intäkter!
ROI: 99,900 / 2,200 = 45x 🚀
