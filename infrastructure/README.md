# 🏗️ Azure Infrastructure med Bicep

Modern Infrastructure as Code för JRM CRM-systemet.

## 🎯 Vad Skapas

Bicep-filen skapar automatiskt:

- ✅ **Azure App Service** - Backend API (Node.js 18)
- ✅ **Static Web App** - Frontend (React/Vanilla JS)
- ✅ **Cosmos DB** - MongoDB API med collections
- ✅ **Application Insights** - Monitoring och logging
- ✅ **Log Analytics** - Centralized logging
- ✅ Automatisk CORS-konfiguration
- ✅ SSL/HTTPS enforcement
- ✅ Health checks
- ✅ Environment variables

## 🚀 Snabbstart

### 1. Förberedelser

```powershell
# Installera Azure CLI (om inte redan installerat)
# Windows: https://aka.ms/installazurecliwindows

# Logga in
az login

# Kontrollera subscription
az account show
```

### 2. Deploya

```powershell
# Kör deployment-scriptet
cd c:\Repos\JRM
.\infrastructure\deploy.ps1
```

**Alternativt med parametrar:**

```powershell
.\infrastructure\deploy.ps1 `
  -ResourceGroup "rg-jrm-crm-prod" `
  -Location "westeurope" `
  -Environment "prod" `
  -AzureB2cClientId "your-client-id"
```

### 3. Vänta 5-10 minuter

Scriptet skapar alla resurser automatiskt.

## 📋 Manuell Deployment

Om du föredrar manuell kontroll:

```bash
# Skapa resource group
az group create \
  --name rg-jrm-crm-prod \
  --location westeurope

# Deploya Bicep
az deployment group create \
  --resource-group rg-jrm-crm-prod \
  --template-file ./infrastructure/main.bicep \
  --parameters environment=prod \
  --parameters azureB2cClientId="YOUR-CLIENT-ID"
```

## 🔧 Parametrar

| Parameter | Beskrivning | Default | Värden |
|-----------|-------------|---------|---------|
| `environment` | Miljö | `prod` | `dev`, `staging`, `prod` |
| `location` | Azure region | `westeurope` | Any Azure region |
| `appName` | App prefix | `jrm-crm` | 3-20 tecken |
| `azureB2cTenantName` | B2C tenant | `varderingsdata` | Din tenant |
| `azureB2cClientId` | B2C Client ID | *(required)* | GUID från B2C |
| `cosmosDbThroughput` | Cosmos throughput | `400` | 400-10000 |

## 📁 Filstruktur

```
infrastructure/
├── main.bicep           # Huvudfil - all infrastruktur
├── parameters.json      # Parameter-template
├── deploy.ps1          # PowerShell deployment script
└── README.md           # Denna fil
```

## 🎯 Efter Deployment

### 1. Uppdatera Frontend Config

```javascript
// client/azure-b2c-config.js
const API_BASE_URL = 'https://jrm-crm-api-prod-xxx.azurewebsites.net';

const msalConfig = {
  auth: {
    redirectUri: 'https://jrm-crm-frontend-prod.azurestaticapps.net',
  }
};
```

### 2. Uppdatera Azure B2C

Lägg till Redirect URI i Azure B2C:
- Portal: https://portal.azure.com
- Azure B2C → App registrations
- Din app → Authentication
- Add URI: `https://jrm-crm-frontend-prod.azurestaticapps.net`

### 3. Deploya Backend-kod

```powershell
cd server
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
Compress-Archive -Path * -DestinationPath ../deploy.zip -Force

az webapp deployment source config-zip `
  --resource-group rg-jrm-crm-prod `
  --name jrm-crm-api-prod-xxx `
  --src ../deploy.zip
```

### 4. Koppla GitHub till Static Web App

1. Azure Portal → Static Web App
2. Deployment → GitHub
3. Authorize och välj repo
4. Build config:
   - App location: `/client`
   - Output location: *(tom)*

### 5. Testa

```bash
# Backend health
curl https://jrm-crm-api-prod-xxx.azurewebsites.net/health

# Frontend
# Öppna browser: https://jrm-crm-frontend-prod.azurestaticapps.net
```

## 🔍 Felsökning

### Deployment failed

```bash
# Se detaljer
az deployment group show \
  --resource-group rg-jrm-crm-prod \
  --name [DEPLOYMENT-NAME]

# Se operations
az deployment operation group list \
  --resource-group rg-jrm-crm-prod \
  --name [DEPLOYMENT-NAME]
```

### Backend startar inte

```bash
# Se logs
az webapp log tail \
  --resource-group rg-jrm-crm-prod \
  --name jrm-crm-api-prod-xxx

# Kontrollera config
az webapp config appsettings list \
  --resource-group rg-jrm-crm-prod \
  --name jrm-crm-api-prod-xxx
```

### Cosmos DB connection error

1. Verifiera connection string:
   ```bash
   az cosmosdb keys list \
     --resource-group rg-jrm-crm-prod \
     --name jrm-crm-cosmos-prod-xxx \
     --type connection-strings
   ```

2. Kontrollera firewall:
   - Azure Portal → Cosmos DB → Networking
   - Enable "Allow access from Azure services"

## 💰 Kostnader

### Free Tier (Dev/Test)
- Static Web App: **Gratis**
- App Service F1: **Gratis**
- Cosmos DB Free: **Gratis** (5 GB, 1000 RU/s)
- Application Insights: **Gratis** (5 GB/månad)
- **Total: €0/månad**

### Production
- App Service B1: **~€13/månad**
- Cosmos DB Serverless: **~€1-5/månad** (pay-per-use)
- Static Web App: **Gratis**
- Application Insights: **~€2/månad**
- **Total: ~€16-20/månad**

## 🧹 Rensa Resurser

```bash
# Ta bort allt
az group delete --name rg-jrm-crm-prod --yes --no-wait
```

## 📚 Mer Information

- [Azure Bicep Docs](https://learn.microsoft.com/azure/azure-resource-manager/bicep/)
- [App Service Docs](https://learn.microsoft.com/azure/app-service/)
- [Static Web Apps Docs](https://learn.microsoft.com/azure/static-web-apps/)
- [Cosmos DB Docs](https://learn.microsoft.com/azure/cosmos-db/)

## 🎉 Support

Problem? Öppna en issue eller kontakta teamet!
