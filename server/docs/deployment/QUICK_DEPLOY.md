# 🚀 SNABBSTART: Produktionsdriftsättning på 30 minuter

**För dig som vill komma igång FORT!**

---

## ⚡ Vad du behöver

- [ ] Azure-konto (aktivt)
- [ ] Azure CLI installerat (`az --version`)
- [ ] PowerShell/Terminal öppen
- [ ] 30-60 minuter

---

## 📝 Steg-för-steg (kopiera och kör!)

### 1️⃣ Logga in Azure (1 min)

```bash
az login
az account set --subscription "Din Subscription"
```

### 2️⃣ Skapa alla resurser (15 min)

```bash
# Sätt variabler
$RG="jrm-crm-prod"
$LOCATION="westeurope"
$COSMOS="jrm-crm-cosmos"
$APP_PLAN="jrm-crm-plan"
$APP_NAME="jrm-crm-api"  # Måste vara unikt!
$INSIGHTS="jrm-crm-insights"
$DB="jrm-crm-db"

# Resource Group
az group create --name $RG --location $LOCATION

# Cosmos DB (tar 5-10 min)
az cosmosdb create --name $COSMOS --resource-group $RG --default-consistency-level Session --locations regionName=$LOCATION

# Databas & Containers
az cosmosdb sql database create --account-name $COSMOS --resource-group $RG --name $DB

az cosmosdb sql container create --account-name $COSMOS --database-name $DB --resource-group $RG --name brands --partition-key-path "/id" --throughput 400
az cosmosdb sql container create --account-name $COSMOS --database-name $DB --resource-group $RG --name companies --partition-key-path "/id" --throughput 400
az cosmosdb sql container create --account-name $COSMOS --database-name $DB --resource-group $RG --name agents --partition-key-path "/id" --throughput 400
az cosmosdb sql container create --account-name $COSMOS --database-name $DB --resource-group $RG --name deals --partition-key-path "/id" --throughput 400
az cosmosdb sql container create --account-name $COSMOS --database-name $DB --resource-group $RG --name tasks --partition-key-path "/id" --throughput 400

# App Service
az appservice plan create --name $APP_PLAN --resource-group $RG --sku S1 --is-linux
az webapp create --name $APP_NAME --resource-group $RG --plan $APP_PLAN --runtime "NODE:18-lts"
az webapp update --name $APP_NAME --resource-group $RG --https-only true

# Application Insights
az monitor app-insights component create --app $INSIGHTS --location $LOCATION --resource-group $RG --application-type Node.JS
```

### 3️⃣ Hämta credentials (2 min)

```bash
# Cosmos DB connection string
$COSMOS_CONN = az cosmosdb keys list --name $COSMOS --resource-group $RG --type connection-strings --query "connectionStrings[0].connectionString" -o tsv

# Cosmos Key
$COSMOS_KEY = az cosmosdb keys list --name $COSMOS --resource-group $RG --query "primaryMasterKey" -o tsv

# App Insights Key
$INSIGHTS_KEY = az monitor app-insights component show --app $INSIGHTS --resource-group $RG --query instrumentationKey -o tsv

# Spara dessa!
Write-Host "COSMOS_ENDPOINT: https://$COSMOS.documents.azure.com:443/"
Write-Host "COSMOS_KEY: $COSMOS_KEY"
Write-Host "APPINSIGHTS_KEY: $INSIGHTS_KEY"
```

### 4️⃣ Generera SESSION_SECRET (1 min)

```powershell
$SESSION_SECRET = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
Write-Host "SESSION_SECRET: $SESSION_SECRET"
```

### 5️⃣ Konfigurera miljövariabler (3 min)

```bash
az webapp config appsettings set --name $APP_NAME --resource-group $RG --settings `
  NODE_ENV="production" `
  PORT="8080" `
  COSMOS_ENDPOINT="https://$COSMOS.documents.azure.com:443/" `
  COSMOS_KEY="$COSMOS_KEY" `
  COSMOS_DATABASE="$DB" `
  SESSION_SECRET="$SESSION_SECRET" `
  APPINSIGHTS_INSTRUMENTATIONKEY="$INSIGHTS_KEY" `
  CORS_ORIGIN="*"
```

> **OBS:** Byt `CORS_ORIGIN="*"` till din frontend-URL senare!

### 6️⃣ Seeda initial data (2 min)

```bash
cd c:\Repos\JRM\server

# Sätt env lokalt för seed-script
$env:COSMOS_ENDPOINT="https://$COSMOS.documents.azure.com:443/"
$env:COSMOS_KEY="$COSMOS_KEY"
$env:COSMOS_DATABASE="$DB"

# Kör seed
node scripts/deployment/seed-production-data.js
```

### 7️⃣ Deploy backend (5 min)

**Alternativ A: ZIP Deploy (snabbast)**

```bash
cd c:\Repos\JRM\server
npm ci --production
Compress-Archive -Path * -DestinationPath deploy.zip -Force
az webapp deployment source config-zip --name $APP_NAME --resource-group $RG --src deploy.zip
```

**Alternativ B: Git Deploy**

```bash
az webapp deployment source config-local-git --name $APP_NAME --resource-group $RG

# Lägg till remote
git remote add azure https://$APP_NAME.scm.azurewebsites.net/$APP_NAME.git

# Deploy
git push azure main
```

### 8️⃣ Testa! (2 min)

```powershell
# Health check
Invoke-RestMethod "https://$APP_NAME.azurewebsites.net/health"

# Dashboard
Invoke-RestMethod "https://$APP_NAME.azurewebsites.net/api/stats/dashboard"

# Brands
Invoke-RestMethod "https://$APP_NAME.azurewebsites.net/api/brands"
```

**Ser du data? 🎉 KLART!**

---

## 📊 Din produktion är nu live på:

```
Backend API: https://jrm-crm-api.azurewebsites.net
Health: https://jrm-crm-api.azurewebsites.net/health
Dashboard: https://jrm-crm-api.azurewebsites.net/api/stats/dashboard
```

---

## 🔧 Nästa steg

### Frontend
1. Uppdatera `client/app-simple.js`:
   ```javascript
   const API_BASE = 'https://jrm-crm-api.azurewebsites.net/api';
   ```

2. Deploy frontend till Static Web App:
   ```bash
   az staticwebapp create --name jrm-crm-frontend --resource-group $RG --location $LOCATION
   ```

### Autentisering (optional)
Om du vill aktivera Azure B2C:
1. Skapa B2C tenant i Azure Portal
2. Registrera app
3. Lägg till B2C-variabler i App Service settings
4. Se `PRODUCTION_DEPLOYMENT.md` för detaljer

---

## 🚨 Troubleshooting

### "Application Error"
```bash
# Kolla logs
az webapp log tail --name $APP_NAME --resource-group $RG
```

### Kan inte ansluta till Cosmos DB
- Kontrollera att Cosmos DB har skapats klart (tar 5-10 min)
- Verifiera connection string är korrekt

### CORS errors
```bash
# Uppdatera CORS
az webapp config appsettings set --name $APP_NAME --resource-group $RG --settings CORS_ORIGIN="https://din-frontend.com"
```

---

## 💰 Kostnad

**~2,100 kr/månad:**
- App Service S1: ~600 kr
- Cosmos DB (2000 RU/s): ~1,200 kr
- Application Insights: ~300 kr

**Spara pengar:**
```bash
# Använd B1 istället för S1 (dev/test)
az appservice plan create --name $APP_PLAN --resource-group $RG --sku B1

# Minska Cosmos DB throughput
az cosmosdb sql container throughput update --account-name $COSMOS --database-name $DB --name brands --resource-group $RG --throughput 400
```

---

## 📚 Mer dokumentation

- **Fullständig guide:** `docs/deployment/PRODUCTION_DEPLOYMENT.md`
- **Checklista:** `docs/deployment/DEPLOYMENT_CHECKLIST.md`
- **Environment:** `.env.example`

---

**Lycka till! 🚀**
