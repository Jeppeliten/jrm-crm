# Visma.net Integration Setup Guide

## Översikt
Denna guide hjälper dig att sätta upp fullständig integration mellan CRM-systemet och Visma.net ekonomisystem.

## Steg 1: Registrera applikation i Visma.net

### 1.1 Skapa Developer Account
1. Gå till [Visma.net Developer Portal](https://integration.visma.net/)
2. Registrera ett konto eller logga in
3. Navigera till "My Applications"

### 1.2 Skapa ny applikation
1. Klicka "Create Application"
2. Fyll i applikationsinfo:
   - **Name**: CRM Visma Integration
   - **Description**: Integration between CRM system and Visma.net
   - **Website**: http://localhost:3000 (för utveckling)
   - **Redirect URI**: http://localhost:3000/api/visma/callback

### 1.3 Konfigurera behörigheter
Aktivera följande scopes:
- `financialsforcustomers:read` - Läsa kunddata
- `financialsforcustomers:write` - Skriva kunddata
- `financialsinvoice:read` - Läsa fakturor
- `financialsinvoice:write` - Skapa fakturor
- `financialsproduct:read` - Läsa produkter
- `financialsproduct:write` - Hantera produkter

### 1.4 Hämta credentials
Efter skapande får du:
- **Client ID**: Unik identifierare för din app
- **Client Secret**: Hemlig nyckel (förvara säkert!)

## Steg 2: Konfigurera miljövariabler

### 2.1 Skapa .env-fil
```bash
cd server
cp .env.template .env
```

### 2.2 Fyll i Visma.net credentials
Redigera `.env` och lägg till:
```env
VISMA_CLIENT_ID=din_client_id_här
VISMA_CLIENT_SECRET=din_client_secret_här
VISMA_COMPANY_DB_ID=ditt_företags_databas_id
```

### 2.3 Hitta Company Database ID
1. Logga in på Visma.net
2. Gå till "Company Settings" -> "Integration"
3. Kopiera "Database ID"

### 2.4 Generera säkerhetsnycklar
```bash
# Generera JWT Secret (32+ tecken)
node -p "require('crypto').randomBytes(32).toString('hex')"

# Generera Encryption Key (32 bytes)
node -p "require('crypto').randomBytes(32).toString('base64')"
```

Lägg till i `.env`:
```env
JWT_SECRET=din_genererade_jwt_secret
ENCRYPTION_KEY=din_genererade_encryption_key
```

## Steg 3: Installera dependencies

### 3.1 Installera npm packages
```bash
cd server
npm install dotenv axios crypto-js node-cron
```

### 3.2 Verifiera installation
```bash
npm list --depth=0
```

## Steg 4: Testa anslutning

### 4.1 Starta server
```bash
cd server
node index.js
```

### 4.2 Testa OAuth-flöde
1. Gå till: http://localhost:3000/api/visma/auth
2. Du ska omdirigeras till Visma.net för inloggning
3. Efter godkännande ska du komma tillbaka med authorization code

### 4.3 Kontrollera logs
Leta efter meddelanden som:
```
✅ Visma.net service initialized
🔗 OAuth authorization URL generated
✅ Successfully connected to Visma.net
```

## Steg 5: Konfigurera synkronisering

### 5.1 Aktivera automatisk synk (valfritt)
I `.env`:
```env
VISMA_AUTO_SYNC=true
VISMA_SYNC_INTERVAL=5
```

### 5.2 Testa manuell synk
Använd CRM-gränssnittet för att:
1. Synkronisera kunder
2. Skapa testfaktura
3. Kontrollera i Visma.net

## Steg 6: Säkerhetskonfiguration

### 6.1 Konfigurera HTTPS (produktion)
```env
SECURE_COOKIES=true
CORS_ORIGINS=https://yourdomain.com
```

### 6.2 Aktivera audit logging
```env
AUDIT_LOGGING=true
LOG_LEVEL=info
```

### 6.3 Konfigurera rate limiting
```env
VISMA_RATE_LIMIT=60
API_RATE_LIMIT=100
```

## Steg 7: Produktionsdeploy

### 7.1 Uppdatera Redirect URI
I Visma.net Developer Portal:
- Lägg till: `https://yourdomain.com/api/visma/callback`

### 7.2 Säkra miljövariabler
Använd hosting-plattformens miljövariabler istället för `.env`

### 7.3 Konfigurera monitoring
```env
ADMIN_EMAIL=admin@yourdomain.com
ERROR_WEBHOOK_URL=https://hooks.slack.com/...
```

## Felsökning

### Vanliga problem

#### 1. "Invalid client credentials"
- Kontrollera CLIENT_ID och CLIENT_SECRET
- Verifiera att appen är aktiv i Visma.net

#### 2. "Redirect URI mismatch"
- Kontrollera att VISMA_REDIRECT_URI matchar Visma.net-inställningar
- Inga avslutande snedstreck i URI

#### 3. "Company database not found"
- Kontrollera VISMA_COMPANY_DB_ID
- Verifiera användarens åtkomst till företaget

#### 4. Rate limiting errors
- Minska VISMA_RATE_LIMIT
- Implementera exponential backoff

### Debug tips

#### Aktivera debug mode
```env
DEBUG_MODE=true
LOG_REQUESTS=true
LOG_RESPONSES=true
```

#### Testa med mock API
```env
MOCK_VISMA_API=true
```

#### Kontrollera token-status
```bash
curl -H "Authorization: Bearer TOKEN" \
  https://integration.visma.net/API/controller/api/v2/company/COMPANY_ID/customer
```

## API-dokumentation

### Endpoints som skapas

#### Autentisering
- `GET /api/visma/auth` - Starta OAuth-flöde
- `GET /api/visma/callback` - OAuth callback
- `POST /api/visma/disconnect` - Koppla från Visma.net

#### Synkronisering
- `POST /api/visma/sync/customers` - Synka kunder
- `POST /api/visma/sync/invoices` - Synka fakturor
- `GET /api/visma/sync/status` - Synkroniseringsstatus

#### Kunder
- `GET /api/visma/customers` - Lista kunder från Visma.net
- `POST /api/visma/customers` - Skapa kund i Visma.net
- `PUT /api/visma/customers/:id` - Uppdatera kund

#### Fakturor
- `GET /api/visma/invoices` - Lista fakturor
- `POST /api/visma/invoices` - Skapa faktura
- `GET /api/visma/invoices/:id` - Hämta specifik faktura

## Säkerhetshänsyn

### Dataskydd
- All känslig data krypteras i vila
- API-kommunikation över HTTPS
- Tokens förvaras säkert med kort livslängd

### Åtkomstkontroll
- OAuth 2.0 med limited scope
- Användarbaserad autentisering
- Audit logging av alla ändringar

### Compliance
- GDPR-kompatibel datahantering
- Svensk bokföringslagstiftning
- Revisionsspår för alla transaktioner

## Support och resurser

### Visma.net dokumentation
- [API Reference](https://integration.visma.net/API-index/)
- [Developer Guide](https://integration.visma.net/getting-started/)
- [OAuth 2.0 Guide](https://integration.visma.net/oauth2/)

### CRM-specifik dokumentation
- Se `server/services/visma-net-service.js` för implementation
- Kontrollera `server/config/visma-config.js` för konfiguration
- Audit logs i `server/audit.log`

### Kontakt
För teknisk support kontakta systemadministratör eller utvecklingsteamet.

---

*Senast uppdaterad: [Dagens datum]*
*Version: 1.0*