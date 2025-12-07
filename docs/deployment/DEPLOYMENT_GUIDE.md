# Deployment Guide - CRM System

## Systemöversikt

Detta CRM-system är en fullständig lösning för kundhantering, säljpipeline och affärsutveckling, byggd med Node.js/Express backend och vanilla JavaScript frontend.

### Teknisk stack

**Backend:**
- Node.js v22+ med Express
- Filbaserad datalagring (JSON)
- bcrypt för lösenordskryptering
- JWT för autentisering
- Säkerhetslager: Helmet, Rate Limiting, WAF, SIEM

**Frontend:**
- HTML5, CSS3, JavaScript (ES6+)
- Responsiv design
- Ingen extern frontend-framework

**Integrationer:**
- Azure AD B2C (autentisering)
- Microsoft Graph API (Outlook)
- Visma.net (ekonomidata)
- Externa API:er (Bolagsverket, Allabolag)

---

## Pre-deployment Checklista

### 1. Miljö och infrastruktur

- [ ] **Välj hosting-plattform**
  - Azure App Service (rekommenderat)
  - VPS (GleSYS, DigitalOcean, Linode)
  - Docker container

- [ ] **Domän och DNS**
  - Registrera domän (t.ex. `crm.varderingsdata.se`)
  - Konfigurera DNS A-record till server-IP
  - Konfigurera DNS för e-post (om Azure/Outlook används)

- [ ] **SSL/TLS-certifikat**
  - Skaffa Let's Encrypt certifikat (gratis)
  - Eller använd Azure/plattformens managed certificates

### 2. Backend-konfiguration

- [ ] **Skapa produktions `.env`-fil**
  - Kopiera `.env.production` till `.env`
  - Fyll i alla `Fyll_i_riktig_*` platshållare
  - Generera säkra secrets (se nedan)

- [ ] **Generera säkra secrets**
  ```powershell
  # Session secret (32 bytes hex)
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  
  # Webhook secret (32 bytes hex)
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- [ ] **Azure AD B2C setup**
  - Skapa B2C tenant i Azure Portal
  - Registrera app
  - Konfigurera user flows (sign-up/sign-in, password reset)
  - Notera: Tenant ID, Client ID, Client Secret
  - Uppdatera i `.env`

- [ ] **Microsoft Graph API (Outlook)**
  - Registrera app i Azure AD
  - Konfigurera API permissions (Mail.Read, Mail.Send, Calendars.ReadWrite)
  - Notera: Client ID, Tenant ID, Redirect URI
  - Uppdatera i `.env`

- [ ] **Databas (valfritt)**
  - Om du använder Azure Cosmos DB/SQL: Konfigurera anslutning
  - Annars: Filbaserad lagring fungerar (state.json, auth.json)

- [ ] **Säkerhet**
  - Sätt `NODE_ENV=production`
  - Sätt starkt `ADMIN_PASSWORD`
  - Konfigurera `CORS_ORIGINS` till din produktionsdomän

### 3. Frontend-konfiguration

- [ ] **API-endpoints**
  - Inga ändringar behövs om frontend och backend körs på samma domän
  - Om separat: Uppdatera API-bas-URL i frontend-koden

- [ ] **Azure B2C-konfiguration (frontend)**
  - Uppdatera `azure-b2c-config.js` med produktionsvärden
  - Tenant name, Client ID, Policies

### 4. Deployment

#### Option A: Azure App Service

- [ ] **Skapa App Service**
  ```bash
  az webapp create --resource-group <rg-name> --plan <plan-name> --name <app-name> --runtime "node|22-lts"
  ```

- [ ] **Konfigurera Environment Variables**
  - Gå till Azure Portal > App Service > Configuration
  - Lägg till alla variabler från `.env`

- [ ] **Deploy kod**
  ```bash
  # Från projektroten
  cd server
  az webapp up --name <app-name> --resource-group <rg-name>
  ```

- [ ] **Konfigurera Always On**
  - Azure Portal > App Service > Configuration > Always On: Enabled

#### Option B: VPS (GleSYS/DigitalOcean)

- [ ] **Provisionera server**
  - Ubuntu 22.04 LTS (rekommenderat)
  - Minst 2GB RAM, 2 CPU cores

- [ ] **Installera Node.js**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

- [ ] **Installera PM2 (process manager)**
  ```bash
  sudo npm install -g pm2
  ```

- [ ] **Klona repository**
  ```bash
  git clone https://github.com/your-repo/JRM.git
  cd JRM/server
  npm install --production
  ```

- [ ] **Konfigurera miljövariabler**
  ```bash
  cp .env.production .env
  nano .env  # Fyll i alla värden
  ```

- [ ] **Starta med PM2**
  ```bash
  pm2 start index.js --name crm-server
  pm2 save
  pm2 startup
  ```

- [ ] **Installera Nginx (reverse proxy)**
  ```bash
  sudo apt-get install nginx
  ```

- [ ] **Konfigurera Nginx**
  ```nginx
  server {
      listen 80;
      server_name crm.varderingsdata.se;
      
      location / {
          proxy_pass http://localhost:3000;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection 'upgrade';
          proxy_set_header Host $host;
          proxy_cache_bypass $http_upgrade;
      }
  }
  ```

- [ ] **Installera SSL med Certbot**
  ```bash
  sudo apt-get install certbot python3-certbot-nginx
  sudo certbot --nginx -d crm.varderingsdata.se
  ```

#### Option C: Docker

- [ ] **Skapa Dockerfile** (om inte finns)
  ```dockerfile
  FROM node:22-alpine
  WORKDIR /app
  COPY server/package*.json ./
  RUN npm ci --production
  COPY server/ ./
  EXPOSE 3000
  CMD ["node", "index.js"]
  ```

- [ ] **Bygg och kör**
  ```bash
  docker build -t crm-app .
  docker run -d -p 3000:3000 --env-file .env --name crm crm-app
  ```

### 5. Post-deployment

- [ ] **Testa endpoints**
  - GET /health (ska returnera 200 OK)
  - GET / (ska visa login-sida)
  - POST /api/login (testa inloggning)

- [ ] **Konfigurera monitoring**
  - Azure Application Insights (om Azure)
  - Eller Uptime Robot / Pingdom för basic monitoring

- [ ] **Sätt upp backups**
  - Automatiska backups körs var 4:e timme (development) / 24h (production)
  - Verifiera att backups skapas i `server/backups/`
  - Konfigurera extern backup till Azure Blob Storage / S3

- [ ] **Konfigurera larm**
  - Application Insights: Alerts för fel, svarstider
  - E-post/SMS notifieringar vid driftstörningar

- [ ] **Säkerhetsgranskning**
  - Kör `npm audit` och åtgärda sårbarheter
  - Verifiera att HTTPS fungerar
  - Testa rate limiting och WAF

- [ ] **Användardokumentation**
  - Skapa användarguide
  - Dokumentera admin-uppgifter

### 6. Löpande förvaltning

- [ ] **Uppdateringar**
  - Schemalägg månatliga uppdateringar av npm-paket
  - Testa i staging innan produktion

- [ ] **Loggning och övervakning**
  - Granska `audit.log` och `security.log` regelbundet
  - Övervaka diskutrymme för backups

- [ ] **Prestanda**
  - Övervaka serverbelastning (CPU, RAM)
  - Optimera databas/filer vid behov

---

## Viktiga miljövariabler (sammanfattning)

### Kritiska (måste fyllas i)
- `AZURE_B2C_TENANT_ID`
- `AZURE_B2C_CLIENT_ID`
- `AZURE_B2C_CLIENT_SECRET`
- `SESSION_SECRET`
- `CORS_ORIGINS`
- `NODE_ENV=production`

### Viktiga (rekommenderade)
- `ADMIN_PASSWORD`
- `MICROSOFT_CLIENT_ID` (Outlook)
- `MICROSOFT_TENANT_ID` (Outlook)
- `APPINSIGHTS_INSTRUMENTATIONKEY` (monitoring)

### Valfria (kan lämnas tomma)
- `VISMA_CLIENT_ID`
- `BOLAGSVERKET_API_KEY`
- `ALLABOLAG_API_KEY`

---

## Troubleshooting

### Problem: Servern startar inte
- Kontrollera att Node.js version är 22+
- Verifiera att alla npm-paket är installerade: `npm install`
- Granska loggar: `pm2 logs` eller `docker logs crm`

### Problem: Kan inte logga in
- Kontrollera Azure B2C-konfiguration
- Verifiera att `CORS_ORIGINS` inkluderar din domän
- Standardlösenord är `admin` / `admin` (byt omedelbart!)

### Problem: SSL-certifikat fungerar inte
- Verifiera DNS-inställningar
- Kör om Certbot: `sudo certbot renew`
- Kontrollera Nginx-konfiguration: `sudo nginx -t`

---

## Support och dokumentation

- **Teknisk dokumentation:** `CRM_Technical_Description.md`
- **API-dokumentation:** Se `/api/*` endpoints i `server/index.js`
- **Azure-guider:** `AZURE_*.md` filer i projektroten

---

**Skapad:** 2025-11-03  
**Version:** 1.0
