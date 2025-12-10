# 🚀 Produktionsdriftsättning - JRM CRM

## Snabbstart (TL;DR)
1. **Azure-resurser** → Skapa App Service + Cosmos DB
2. **Environment** → Lägg till miljövariabler i Azure App Service
3. **Deploy** → `git push azure main` eller GitHub Actions
4. **Verifiera** → Testa endpoints och autentisering
5. **Frontend** → Uppdatera API-URL till produktion

**Beräknad tid:** 30-60 minuter för första driftsättningen

---

## 📋 Förberedelser

### 1. Azure-konto och resurser
Du behöver:
- [ ] Azure-prenumeration (aktivt konto)
- [ ] Azure CLI installerat lokalt (`az --version` för att verifiera)
- [ ] Inloggad i Azure: `az login`
- [ ] Resource Group (eller skapa ny)

### 2. Databas och autentisering
- [ ] Cosmos DB-konto (befintligt eller nytt)
- [ ] Azure AD B2C tenant (för användarautentisering)
- [ ] Application Insights (för loggning/monitoring)

---

## 🔧 Steg 1: Skapa Azure-resurser

### 1.1 Cosmos DB (om du inte har det redan)

```bash
# Variabler
RESOURCE_GROUP="jrm-crm-prod"
LOCATION="westeurope"
COSMOS_ACCOUNT="jrm-crm-cosmos"
DATABASE_NAME="jrm-crm-db"

# Skapa resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Skapa Cosmos DB-konto (tar 5-10 min)
az cosmosdb create \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --default-consistency-level Session \
  --locations regionName=$LOCATION failoverPriority=0 isZoneRedundant=False

# Skapa databas
az cosmosdb sql database create \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --name $DATABASE_NAME

# Skapa containers
az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --database-name $DATABASE_NAME \
  --resource-group $RESOURCE_GROUP \
  --name brands \
  --partition-key-path "/id" \
  --throughput 400

az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --database-name $DATABASE_NAME \
  --resource-group $RESOURCE_GROUP \
  --name companies \
  --partition-key-path "/id" \
  --throughput 400

az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --database-name $DATABASE_NAME \
  --resource-group $RESOURCE_GROUP \
  --name agents \
  --partition-key-path "/id" \
  --throughput 400

az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --database-name $DATABASE_NAME \
  --resource-group $RESOURCE_GROUP \
  --name deals \
  --partition-key-path "/id" \
  --throughput 400

az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --database-name $RESOURCE_GROUP \
  --name tasks \
  --partition-key-path "/id" \
  --throughput 400

# Hämta connection string
az cosmosdb keys list \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv
```

**Spara connection string!** Du behöver den i nästa steg.

### 1.2 App Service (Node.js hosting)

```bash
APP_SERVICE_PLAN="jrm-crm-plan"
WEB_APP_NAME="jrm-crm-api"  # Måste vara globalt unikt

# Skapa App Service Plan (Standard S1 för produktion)
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --sku S1 \
  --is-linux

# Skapa Web App
az webapp create \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --runtime "NODE:18-lts"

# Aktivera HTTPS endast
az webapp update \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --https-only true
```

### 1.3 Application Insights (monitoring)

```bash
APPINSIGHTS_NAME="jrm-crm-insights"

# Skapa Application Insights
az monitor app-insights component create \
  --app $APPINSIGHTS_NAME \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --application-type Node.JS

# Hämta instrumentation key
az monitor app-insights component show \
  --app $APPINSIGHTS_NAME \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey \
  --output tsv
```

---

## 🔐 Steg 2: Konfigurera miljövariabler

### 2.1 Lägg till i Azure App Service

```bash
# Sätt alla miljövariabler på en gång
az webapp config appsettings set \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    NODE_ENV="production" \
    PORT="8080" \
    COSMOS_ENDPOINT="https://jrm-crm-cosmos.documents.azure.com:443/" \
    COSMOS_KEY="<DIN_COSMOS_PRIMARY_KEY>" \
    COSMOS_DATABASE="jrm-crm-db" \
    AZURE_AD_B2C_TENANT_NAME="<DIN_B2C_TENANT>" \
    AZURE_AD_B2C_CLIENT_ID="<DIN_CLIENT_ID>" \
    AZURE_AD_B2C_CLIENT_SECRET="<DIN_CLIENT_SECRET>" \
    AZURE_AD_B2C_POLICY_NAME="B2C_1_signupsignin" \
    AZURE_AD_B2C_REDIRECT_URI="https://jrm-crm-api.azurewebsites.net/auth/callback" \
    SESSION_SECRET="<GENERERA_EN_STARK_RANDOM_STRÄNG>" \
    APPINSIGHTS_INSTRUMENTATIONKEY="<DIN_APPINSIGHTS_KEY>" \
    CORS_ORIGIN="https://jrm-crm-frontend.azurewebsites.net"
```

**Viktigt:** Ersätt alla `<DIN_...>` värden med faktiska credentials.

### 2.2 Generera säker SESSION_SECRET

```powershell
# PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

---

## 📦 Steg 3: Deploy backend

### Alternativ A: Git Deployment (enklast)

```bash
# Konfigurera deployment från lokal Git
az webapp deployment source config-local-git \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP

# Hämta Git URL och credentials
az webapp deployment list-publishing-credentials \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "{username:publishingUserName, password:publishingPassword}"

# Lägg till Azure som remote i ditt repo
cd c:\Repos\JRM\server
git remote add azure https://<username>@jrm-crm-api.scm.azurewebsites.net/jrm-crm-api.git

# Deploy!
git push azure main
```

### Alternativ B: GitHub Actions (rekommenderat för CI/CD)

1. Skapa `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to Azure

on:
  push:
    branches: [main]
    paths:
      - 'server/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd server
          npm ci --production
      
      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v2
        with:
          app-name: 'jrm-crm-api'
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: ./server
```

2. Hämta publish profile:
```bash
az webapp deployment list-publishing-profiles \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --xml
```

3. Lägg till som secret i GitHub: `Settings → Secrets → AZURE_WEBAPP_PUBLISH_PROFILE`

### Alternativ C: ZIP Deploy (snabbast för tester)

```bash
cd c:\Repos\JRM\server
npm ci --production
Compress-Archive -Path * -DestinationPath deploy.zip

az webapp deployment source config-zip \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --src deploy.zip
```

---

## 🔄 Steg 4: Initial dataimport

### 4.1 Migrera mock data till Cosmos DB

Kör detta script lokalt (med Cosmos DB credentials):

```javascript
// scripts/deployment/seed-production-data.js
const { CosmosClient } = require('@azure/cosmos');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database(process.env.COSMOS_DATABASE);

async function seedBrands() {
  const container = database.container('brands');
  
  const brands = [
    {
      id: 'brand-1',
      name: 'ERA',
      description: 'Ledande mäklarkedja i Sverige',
      status: 'kund',
      agentCount: 15,
      centralContract: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'brand-2',
      name: 'Mäklarhuset',
      description: 'En av Sveriges största mäklarkedjor',
      status: 'kund',
      agentCount: 12,
      centralContract: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'brand-3',
      name: 'Svensk Fast',
      description: 'Rikstäckande mäklarkedja',
      status: 'prospekt',
      agentCount: 10,
      centralContract: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'brand-4',
      name: 'Fastighetsbyrån',
      description: 'Traditionell mäklarkedja',
      status: 'prospekt',
      agentCount: 8,
      centralContract: false,
      createdAt: new Date().toISOString()
    },
    {
      id: 'brand-5',
      name: 'Notar',
      description: 'Modern mäklarkedja',
      status: 'kund',
      agentCount: 6,
      centralContract: true,
      createdAt: new Date().toISOString()
    }
  ];

  for (const brand of brands) {
    await container.items.upsert(brand);
    console.log(`✓ Skapade brand: ${brand.name}`);
  }
}

async function seedCompanies() {
  const container = database.container('companies');
  
  const companies = [
    {
      id: 'company-1',
      name: 'ERA Stockholm City',
      brandId: 'brand-1',
      status: 'kund',
      contactPerson: 'Anna Andersson',
      email: 'anna@erastockholm.se',
      phone: '08-123 45 67',
      agentCount: 8,
      licenseCount: 8,
      address: 'Stureplan 4, Stockholm',
      createdAt: new Date().toISOString()
    },
    {
      id: 'company-2',
      name: 'Mäklarhuset Göteborg',
      brandId: 'brand-2',
      status: 'kund',
      contactPerson: 'Bengt Bengtsson',
      email: 'bengt@maklarhusetgbg.se',
      phone: '031-123 45 67',
      agentCount: 6,
      licenseCount: 6,
      address: 'Avenyn 12, Göteborg',
      createdAt: new Date().toISOString()
    },
    {
      id: 'company-3',
      name: 'Svensk Fast Malmö',
      brandId: 'brand-3',
      status: 'prospekt',
      contactPerson: 'Cecilia Carlsson',
      email: 'cecilia@svenskfast.se',
      phone: '040-123 45 67',
      agentCount: 5,
      licenseCount: 0,
      address: 'Stortorget 8, Malmö',
      createdAt: new Date().toISOString()
    },
    {
      id: 'company-4',
      name: 'Notar Uppsala',
      brandId: 'brand-5',
      status: 'kund',
      contactPerson: 'David Davidsson',
      email: 'david@notaruppsala.se',
      phone: '018-123 45 67',
      agentCount: 4,
      licenseCount: 4,
      address: 'Dragarbrunnsgatan 30, Uppsala',
      createdAt: new Date().toISOString()
    },
    {
      id: 'company-5',
      name: 'Fastighetsbyrån Lund',
      brandId: 'brand-4',
      status: 'prospekt',
      contactPerson: 'Eva Eriksson',
      email: 'eva@fastighetsbyran.se',
      phone: '046-123 45 67',
      agentCount: 3,
      licenseCount: 0,
      address: 'Mårtenstorget 5, Lund',
      createdAt: new Date().toISOString()
    }
  ];

  for (const company of companies) {
    await container.items.upsert(company);
    console.log(`✓ Skapade company: ${company.name}`);
  }
}

async function seedAgents() {
  const container = database.container('agents');
  
  const agents = [
    {
      id: 'agent-1',
      firstName: 'Anna',
      lastName: 'Andersson',
      email: 'anna.andersson@era.se',
      phone: '070-111 11 11',
      companyId: 'company-1',
      brandId: 'brand-1',
      status: 'aktiv',
      licenseActive: true,
      role: 'Mäklare',
      createdAt: new Date().toISOString()
    },
    {
      id: 'agent-2',
      firstName: 'Bengt',
      lastName: 'Bengtsson',
      email: 'bengt.bengtsson@maklarhuset.se',
      phone: '070-222 22 22',
      companyId: 'company-2',
      brandId: 'brand-2',
      status: 'aktiv',
      licenseActive: true,
      role: 'Mäklare',
      createdAt: new Date().toISOString()
    },
    {
      id: 'agent-3',
      firstName: 'Cecilia',
      lastName: 'Carlsson',
      email: 'cecilia.carlsson@svenskfast.se',
      phone: '070-333 33 33',
      companyId: 'company-3',
      brandId: 'brand-3',
      status: 'prospekt',
      licenseActive: false,
      role: 'Mäklare',
      createdAt: new Date().toISOString()
    },
    {
      id: 'agent-4',
      firstName: 'David',
      lastName: 'Davidsson',
      email: 'david.davidsson@notar.se',
      phone: '070-444 44 44',
      companyId: 'company-4',
      brandId: 'brand-5',
      status: 'aktiv',
      licenseActive: true,
      role: 'Kontorschef',
      createdAt: new Date().toISOString()
    },
    {
      id: 'agent-5',
      firstName: 'Eva',
      lastName: 'Eriksson',
      email: 'eva.eriksson@fastighetsbyran.se',
      phone: '070-555 55 55',
      companyId: 'company-5',
      brandId: 'brand-4',
      status: 'prospekt',
      licenseActive: false,
      role: 'Mäklare',
      createdAt: new Date().toISOString()
    }
  ];

  for (const agent of agents) {
    await container.items.upsert(agent);
    console.log(`✓ Skapade agent: ${agent.firstName} ${agent.lastName}`);
  }
}

async function main() {
  console.log('🌱 Seeding production data...\n');
  
  await seedBrands();
  console.log('');
  await seedCompanies();
  console.log('');
  await seedAgents();
  
  console.log('\n✅ Production data seeded successfully!');
}

main().catch(console.error);
```

Kör scriptet:
```bash
cd c:\Repos\JRM\server
node scripts/deployment/seed-production-data.js
```

---

## ✅ Steg 5: Verifiera deployment

### 5.1 Testa backend endpoints

```powershell
# Health check
Invoke-RestMethod "https://jrm-crm-api.azurewebsites.net/health"

# Dashboard stats
Invoke-RestMethod "https://jrm-crm-api.azurewebsites.net/api/stats/dashboard"

# Brands
Invoke-RestMethod "https://jrm-crm-api.azurewebsites.net/api/brands"

# Companies
Invoke-RestMethod "https://jrm-crm-api.azurewebsites.net/api/companies"

# Agents
Invoke-RestMethod "https://jrm-crm-api.azurewebsites.net/api/agents"
```

### 5.2 Kontrollera logs

```bash
# Live log stream
az webapp log tail \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP

# Eller i Azure Portal: 
# App Service → Monitoring → Log Stream
```

### 5.3 Application Insights Dashboard

Öppna Azure Portal → Application Insights → jrm-crm-insights

- Performance metrics
- Failed requests
- Response times
- Dependencies (Cosmos DB queries)

---

## 🌐 Steg 6: Deploy och konfigurera frontend

### 6.1 Uppdatera API URL i frontend

I `client/app-simple.js`, ändra:

```javascript
// Före (lokal utveckling)
const API_BASE = 'http://localhost:3000/api';

// Efter (produktion)
const API_BASE = 'https://jrm-crm-api.azurewebsites.net/api';
```

**Bättre:** Använd environment-baserad konfiguration:

```javascript
const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api'
  : 'https://jrm-crm-api.azurewebsites.net/api';
```

### 6.2 Deploy frontend till Azure Static Web Apps

```bash
# Skapa Static Web App
az staticwebapp create \
  --name jrm-crm-frontend \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --source https://github.com/Jeppeliten/jrm-crm \
  --branch main \
  --app-location "/client" \
  --output-location "/"

# Eller använd Azure Portal: Static Web Apps → Create
```

**GitHub Actions deployment** skapas automatiskt.

---

## 🔒 Steg 7: Aktivera autentisering

### 7.1 Azure AD B2C setup

1. **Skapa B2C tenant** (om inte redan gjort)
2. **Registrera application:**
   - Namn: `JRM CRM`
   - Redirect URIs: `https://jrm-crm-api.azurewebsites.net/auth/callback`
   - API permissions: OpenID, profile, email
3. **Skapa User Flow:**
   - Typ: Sign up and sign in
   - Namn: `B2C_1_signupsignin`
4. **Kopiera credentials** till App Service settings (se Steg 2.1)

### 7.2 Testa autentisering

```powershell
# Ska redirecta till B2C login
Start-Process "https://jrm-crm-api.azurewebsites.net/auth/login"
```

---

## 📊 Steg 8: Monitoring och underhåll

### 8.1 Sätt upp alerts

```bash
# Alert vid hög responstid
az monitor metrics alert create \
  --name "High Response Time" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$WEB_APP_NAME" \
  --condition "avg ResponseTime > 2000" \
  --description "Response time är över 2 sekunder"

# Alert vid många errors
az monitor metrics alert create \
  --name "High Error Rate" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$WEB_APP_NAME" \
  --condition "total Http5xx > 10" \
  --description "Fler än 10 5xx errors på 5 minuter"
```

### 8.2 Backup-strategi

**Cosmos DB** har automatiska backups (default: 8 timmar).

För manuella backups:
```bash
# Point-in-time restore är tillgängligt de senaste 30 dagarna
az cosmosdb sql database restore \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --name $DATABASE_NAME \
  --restore-timestamp "2025-12-09T10:00:00Z"
```

### 8.3 Skalning

**Automatisk skalning:**
```bash
az webapp scale \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --instance-count 2  # Minst 2 för high availability
```

**Cosmos DB throughput:**
```bash
# Öka RU/s vid behov
az cosmosdb sql container throughput update \
  --account-name $COSMOS_ACCOUNT \
  --database-name $DATABASE_NAME \
  --name companies \
  --resource-group $RESOURCE_GROUP \
  --throughput 1000
```

---

## 🛠️ Troubleshooting

### Problem: "Application Error" efter deploy

**Lösning:**
```bash
# Kontrollera logs
az webapp log tail --name $WEB_APP_NAME --resource-group $RESOURCE_GROUP

# Vanliga orsaker:
# 1. Saknade miljövariabler → Dubbelkolla Steg 2.1
# 2. Node version mismatch → Sätt NODE_VERSION="18"
# 3. Missing dependencies → Kör npm ci --production före deploy
```

### Problem: CORS errors i frontend

**Lösning:**
```bash
# Uppdatera CORS_ORIGIN i App Service settings
az webapp config appsettings set \
  --name $WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings CORS_ORIGIN="https://jrm-crm-frontend.azurewebsites.net"
```

### Problem: Cosmos DB connection timeout

**Lösning:**
1. Verifiera att Cosmos DB endpoint och key är korrekta
2. Kontrollera firewall rules i Cosmos DB (tillåt Azure Services)
3. Öka connection timeout i kod om nödvändigt

### Problem: B2C autentisering fungerar inte

**Lösning:**
1. Kontrollera redirect URI matchar exakt (inklusive protocol)
2. Verifiera att client secret inte har löpt ut
3. Testa B2C policy manuellt i Azure Portal

---

## 📈 Kostnadsuppskattning

| Resurs | SKU | Kostnad/månad (SEK) |
|--------|-----|---------------------|
| App Service Plan S1 | 1 instance | ~600 kr |
| Cosmos DB | 400 RU/s × 5 containers | ~1,200 kr |
| Application Insights | First 5GB free | ~0-300 kr |
| Static Web App | Free tier | 0 kr |
| **Total** | | **~2,100 kr/mån** |

**Tips för att spara:**
- Använd Dev/Test pricing (B1 App Service: ~200 kr)
- Shared Cosmos DB throughput (400 RU/s total: ~240 kr)
- Azure reserved instances (30-70% rabatt)

---

## 🎯 Checklista: Go-Live

- [ ] Azure-resurser skapade (App Service, Cosmos DB, App Insights)
- [ ] Miljövariabler konfigurerade i App Service
- [ ] Backend deployad och health check fungerar
- [ ] Initial data importerad till Cosmos DB
- [ ] Frontend deployad och ansluter till produktion-API
- [ ] Azure B2C autentisering aktiverad och testad
- [ ] CORS konfigurerad korrekt för frontend-domän
- [ ] Monitoring och alerts uppsatta i Application Insights
- [ ] SSL/HTTPS fungerar (automatiskt med Azure)
- [ ] Backup-strategi dokumenterad
- [ ] Load testing utfört (minst 100 concurrent users)
- [ ] Dokumentation uppdaterad med produktions-URLs

---

## 🚀 Nästa steg efter go-live

1. **Performance optimization**
   - Implementera caching (Redis)
   - Optimera Cosmos DB queries med indexering
   - Använd CDN för statiska assets

2. **Säkerhet**
   - Implementera rate limiting per användare
   - Lägg till API key authentication för externa integrationer
   - Security audit med Azure Security Center

3. **Features**
   - Email notifications (SendGrid)
   - SMS notifications (Twilio)
   - Rapportering och analytics
   - Integration med Visma.net (redan förberedd)

4. **DevOps**
   - CI/CD pipeline för automatiska tester
   - Staging environment för testing före prod
   - Blue-green deployments för zero downtime

---

**Kontakt:** Har du frågor om deployment? Lägg till en GitHub Issue eller kontakta DevOps-teamet.

**Senast uppdaterad:** December 10, 2025
