# 🚀 Azure Deployment Guide - Steg för Steg

## 📋 Förberedelser (5 minuter)

### 1. Installera Azure CLI

**Windows (PowerShell som Admin):**
```powershell
# Ladda ner och installera
Invoke-WebRequest -Uri https://aka.ms/installazurecliwindows -OutFile .\AzureCLI.msi
Start-Process msiexec.exe -Wait -ArgumentList '/I AzureCLI.msi /quiet'
```

**Eller ladda ner från:** https://aka.ms/installazurecliwindows

**Verifiera installation:**
```bash
az --version
```

### 2. Logga in på Azure
```bash
az login
```

---

## 🎯 Option 1: Automatisk Deployment (Snabbast - 10 min)

### Kör deployment-scriptet:
```powershell
cd C:\Repos\JRM
.\scripts\deploy-azure.ps1 -ResourceGroup "rg-crm-prod" -Location "westeurope" -AppName "crm-varderingsdata"
```

Scriptet kommer automatiskt skapa:
- ✅ Resource Group
- ✅ App Service Plan
- ✅ Web App för backend
- ✅ Static Web App för frontend
- ✅ Cosmos DB account (MongoDB API)
- ✅ Application Insights

---

## 🛠️ Option 2: Manuell Deployment via Azure Portal (30 min)

### STEG 1: Skapa Resource Group

1. Gå till **Azure Portal**: https://portal.azure.com
2. Klicka **"Create a resource"** → **"Resource group"**
3. Konfigurera:
   - **Name:** `rg-crm-prod`
   - **Region:** `West Europe`
4. Klicka **"Review + Create"** → **"Create"**

---

### STEG 2: Skapa Cosmos DB

1. **Create a resource** → Sök **"Azure Cosmos DB"**
2. Välj **"Azure Cosmos DB for MongoDB"**
3. Konfigurera:
   - **Resource group:** `rg-crm-prod`
   - **Account name:** `crm-cosmosdb-prod` (måste vara globalt unikt)
   - **Location:** `West Europe`
   - **Capacity mode:** `Provisioned throughput`
   - **Apply Free Tier Discount:** `Yes` (om tillgängligt)
4. Klicka **"Review + Create"** → **"Create"**
5. **Vänta ~5-10 min** för deployment
6. När klar, gå till resursen → **"Connection strings"** → Kopiera **Primary Connection String**

**Spara connection string för senare:**
```
mongodb://crm-cosmosdb-prod:KEY@crm-cosmosdb-prod.mongo.cosmos.azure.com:10255/?ssl=true...
```

---

### STEG 3: Skapa App Service för Backend API

1. **Create a resource** → Sök **"Web App"**
2. Konfigurera **Basics:**
   - **Resource group:** `rg-crm-prod`
   - **Name:** `crm-api-prod` (måste vara globalt unikt)
   - **Publish:** `Code`
   - **Runtime stack:** `Node 18 LTS`
   - **Operating System:** `Linux`
   - **Region:** `West Europe`
   
3. Konfigurera **Pricing:**
   - **Pricing plan:** `Basic B1` (eller `Free F1` för test)
   
4. Klicka **"Review + Create"** → **"Create"**

5. När klar, gå till resursen → **"Configuration"** → **"Application settings"**

6. Lägg till följande settings:
   ```
   NODE_ENV = production
   PORT = 8080
   COSMOS_DB_CONNECTION_STRING = [Din Cosmos DB connection string]
   COSMOS_DB_DATABASE_NAME = crm_database
   AZURE_B2C_TENANT_NAME = varderingsdata
   AZURE_B2C_TENANT_ID = varderingsdata.onmicrosoft.com
   AZURE_B2C_CLIENT_ID = [Kommer från B2C setup]
   AZURE_B2C_POLICY_NAME = B2C_1_signup_signin
   ```

7. Klicka **"Save"**

---

### STEG 4: Deploya Backend-kod

#### Option A: GitHub Actions (Rekommenderat)

1. I Azure Portal → Din Web App → **"Deployment Center"**
2. **Source:** `GitHub`
3. Auktorisera GitHub och välj repo: `JRM`
4. **Branch:** `main`
5. **Build provider:** `GitHub Actions`
6. Klicka **"Save"**

Azure skapar automatiskt en GitHub Actions workflow i `.github/workflows/`

#### Option B: Local Git

1. I Azure Portal → Din Web App → **"Deployment Center"**
2. **Source:** `Local Git`
3. Kopiera **Git Clone Uri**

4. I din lokala repo:
```bash
cd C:\Repos\JRM
git remote add azure <Git Clone Uri>

# Skapa en deployment branch
git checkout -b azure-deploy
git push azure azure-deploy:master
```

#### Option C: ZIP Deploy

1. Skapa deployment package:
```powershell
cd C:\Repos\JRM\server
# Ta bort node_modules och .env filer
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item .env* -Force -ErrorAction SilentlyContinue

# Skapa ZIP
Compress-Archive -Path * -DestinationPath ..\deploy-backend.zip -Force
```

2. Deploya via Azure CLI:
```bash
az webapp deployment source config-zip `
  --resource-group rg-crm-prod `
  --name crm-api-prod `
  --src deploy-backend.zip
```

---

### STEG 5: Skapa Static Web App för Frontend

1. **Create a resource** → Sök **"Static Web App"**
2. Konfigurera:
   - **Resource group:** `rg-crm-prod`
   - **Name:** `crm-frontend-prod`
   - **Plan type:** `Free`
   - **Region:** `West Europe`
   - **Deployment details:**
     - **Source:** `GitHub` (eller `Other` för manuell)
     - **Repository:** `JRM`
     - **Branch:** `main`
     - **Build presets:** `Custom`
     - **App location:** `/client`
     - **Api location:** (lämna tom)
     - **Output location:** (lämna tom)

3. Klicka **"Review + Create"** → **"Create"**

4. Efter deployment, hämta URL:en (t.ex. `https://blue-sea-123.azurestaticapps.net`)

---

### STEG 6: Uppdatera Frontend Config

1. Uppdatera `client/azure-b2c-config.js`:
```javascript
const API_BASE_URL = 'https://crm-api-prod.azurewebsites.net';

const msalConfig = {
  auth: {
    clientId: '[Frontend-Client-ID från B2C]',
    authority: 'https://varderingsdata.b2clogin.com/varderingsdata.onmicrosoft.com/B2C_1_signup_signin',
    knownAuthorities: ['varderingsdata.b2clogin.com'],
    redirectUri: 'https://crm-frontend-prod.azurestaticapps.net',
  }
};
```

2. Uppdatera CORS i Backend:
   - Gå till Azure Portal → Din Web App → **"CORS"**
   - Lägg till: `https://crm-frontend-prod.azurestaticapps.net`

---

### STEG 7: Konfigurera Azure B2C (Om inte redan gjort)

Följ: `AZURE_SETUP_GUIDE.md` → STEG 2

**Viktigt:** Uppdatera Redirect URIs med dina Azure-URLs:
- Backend: `https://crm-api-prod.azurewebsites.net`
- Frontend: `https://crm-frontend-prod.azurestaticapps.net`

---

### STEG 8: Konfigurera Application Insights (Monitoring)

1. **Create a resource** → Sök **"Application Insights"**
2. Konfigurera:
   - **Resource group:** `rg-crm-prod`
   - **Name:** `crm-appinsights`
   - **Region:** `West Europe`
   - **Resource Mode:** `Workspace-based`

3. Efter skapande, kopiera **Instrumentation Key**

4. Lägg till i Web App Configuration:
   ```
   APPINSIGHTS_INSTRUMENTATIONKEY = [Din Instrumentation Key]
   ```

---

## ✅ Verifiering

### Testa Backend API:
```bash
curl https://crm-api-prod.azurewebsites.net/health
curl https://crm-api-prod.azurewebsites.net/api/health
curl https://crm-api-prod.azurewebsites.net/api/health/cosmos
```

### Testa Frontend:
Öppna: `https://crm-frontend-prod.azurestaticapps.net`

### Testa Login:
1. Klicka "Logga in"
2. Kontrollera omdirigering till Azure B2C
3. Logga in med testanvändare
4. Verifiera att du kommer tillbaka till appen

---

## 🔧 Felsökning

### Backend startar inte:
1. Gå till Web App → **"Log stream"**
2. Kontrollera felmeddelanden
3. Verifiera att alla miljövariabler är korrekt satta

### Cosmos DB connection error:
1. Kontrollera connection string i Configuration
2. Verifiera att Cosmos DB firewall tillåter Azure services

### CORS error:
1. Lägg till frontend URL i backend CORS settings
2. Verifiera att `Access-Control-Allow-Origin` header finns

### B2C redirect error:
1. Kontrollera att Redirect URIs är korrekt konfigurerade i Azure B2C
2. Verifiera att Client ID matchar

---

## 💰 Kostnadskontroll

### Free Tier Resources:
- ✅ Static Web App: **Gratis**
- ✅ Cosmos DB: **Gratis tier** (5 GB, 400 RU/s)
- ✅ App Service: **F1 Free** (begränsad CPU/minne)
- ✅ Application Insights: **Gratis** (1 GB/månad)

### Production Resources (uppskattad kostnad):
- App Service B1: **~€50/månad**
- Cosmos DB (400 RU/s): **~€20/månad**
- Application Insights: **~€5/månad**
- **Total: ~€75/månad**

---

## 🎉 Klart!

Din CRM-app är nu deployad till Azure med:
- ✅ Backend API på Azure App Service
- ✅ Frontend på Azure Static Web Apps
- ✅ Databas på Cosmos DB (MongoDB API)
- ✅ Autentisering med Azure B2C
- ✅ Monitoring med Application Insights

**Nästa steg:**
1. Konfigurera custom domain
2. Sätt upp SSL-certifikat (gratis med Azure)
3. Konfigurera CI/CD pipeline
4. Lägg till användare i Azure B2C