# Azure Deployment Checklist

## ✅ Förhandscheck

- [ ] Azure account med aktiv subscription
- [ ] Azure CLI installerad (`az --version`)
- [ ] Git repository uppdaterat (commit alla ändringar)
- [ ] .env.production fylld med riktiga credentials
- [ ] Server testad lokalt (`node index.js`)

---

## STEG 1: Skapa Azure Resources (15 min)

### 1.1 Logga in på Azure
```powershell
az login
az account show  # Verifiera rätt subscription
```

### 1.2 Skapa Resource Group
```powershell
az group create --name jrm-crm-prod --location westeurope
```

### 1.3 Skapa App Service Plan (B1 tier = €40/mån)
```powershell
az appservice plan create `
  --name jrm-crm-plan `
  --resource-group jrm-crm-prod `
  --sku B1 `
  --is-linux
```

### 1.4 Skapa Web App för Backend
```powershell
az webapp create `
  --name jrm-crm-backend `
  --resource-group jrm-crm-prod `
  --plan jrm-crm-plan `
  --runtime "NODE:22-lts"
```

### 1.5 Skapa Static Web App för Frontend
```powershell
az staticwebapp create `
  --name jrm-crm-frontend `
  --resource-group jrm-crm-prod `
  --source https://github.com/DIN-GITHUB-USER/JRM `
  --location westeurope `
  --branch main `
  --app-location "/crm-prototype" `
  --output-location "/"
```

### 1.6 Skapa Cosmos DB (Optional - €25/mån)
```powershell
# Om du vill använda Cosmos DB istället för file storage
az cosmosdb create `
  --name jrm-crm-db `
  --resource-group jrm-crm-prod `
  --kind MongoDB `
  --server-version 4.2 `
  --default-consistency-level Session
```

### 1.7 Skapa Storage Account för Backups (€5/mån)
```powershell
az storage account create `
  --name jrmcrmbackups `
  --resource-group jrm-crm-prod `
  --location westeurope `
  --sku Standard_LRS
```

---

## STEG 2: Konfigurera Environment Variables (10 min)

### 2.1 Ladda upp .env.production till App Service
```powershell
# Först, konvertera .env till Azure format
cd c:\Repos\JRM\server

# Sätt varje variabel individuellt (exempel):
az webapp config appsettings set `
  --name jrm-crm-backend `
  --resource-group jrm-crm-prod `
  --settings `
    NODE_ENV=production `
    PORT=3000 `
    SESSION_SECRET="DIN_STARKA_SECRET" `
    ENABLE_AZURE_B2C=true `
    ENABLE_WAF=true `
    ENABLE_SIEM=true
```

**ELLER använd vår automatiska script:**
```powershell
# Vi skapar ett deploy-script som läser .env.production och sätter alla
node ..\scripts\upload-env-to-azure.js
```

### 2.2 Hämta Connection Strings
```powershell
# Cosmos DB connection string (om du skapade den)
az cosmosdb keys list `
  --name jrm-crm-db `
  --resource-group jrm-crm-prod `
  --type connection-strings

# Storage Account connection string
az storage account show-connection-string `
  --name jrmcrmbackups `
  --resource-group jrm-crm-prod
```

### 2.3 Uppdatera .env.production med Azure-specifika värden
- Lägg till connection strings från steg 2.2
- Uppdatera CORS_ORIGINS till din Azure URL
- Verifiera alla secrets är satta

---

## STEG 3: Deploy Backend (5 min)

### 3.1 Konfigurera deployment från Git
```powershell
cd c:\Repos\JRM

# Sätt deployment source
az webapp deployment source config `
  --name jrm-crm-backend `
  --resource-group jrm-crm-prod `
  --repo-url https://github.com/DIN-GITHUB-USER/JRM `
  --branch main `
  --manual-integration
```

### 3.2 ELLER använd ZIP deployment (snabbare)
```powershell
cd server

# Skapa deployment package
npm install --production
Compress-Archive -Path * -DestinationPath ..\deploy.zip -Force

# Deploy
az webapp deployment source config-zip `
  --name jrm-crm-backend `
  --resource-group jrm-crm-prod `
  --src ..\deploy.zip
```

### 3.3 Konfigurera startup command
```powershell
az webapp config set `
  --name jrm-crm-backend `
  --resource-group jrm-crm-prod `
  --startup-file "node index.js"
```

---

## STEG 4: Deploy Frontend (5 min)

### 4.1 Uppdatera API endpoint i frontend
```javascript
// I crm-prototype/app.js, hitta API_BASE_URL och ändra till:
const API_BASE_URL = 'https://jrm-crm-backend.azurewebsites.net';
```

### 4.2 Commit och push (Static Web App deploys automatiskt)
```powershell
cd c:\Repos\JRM
git add crm-prototype/app.js
git commit -m "feat: Update API endpoint for Azure production"
git push origin main
```

Static Web App kommer automatiskt bygga och deploya från GitHub.

---

## STEG 5: Konfigurera Custom Domain (Optional - 10 min)

### 5.1 Lägg till custom domain
```powershell
# Backend
az webapp config hostname add `
  --webapp-name jrm-crm-backend `
  --resource-group jrm-crm-prod `
  --hostname api.varderingsdata.se

# Frontend
az staticwebapp hostname set `
  --name jrm-crm-frontend `
  --resource-group jrm-crm-prod `
  --hostname crm.varderingsdata.se
```

### 5.2 SSL Certificate (gratis med Azure)
```powershell
# Azure hanterar automatiskt Let's Encrypt certifikat
# Vänta 5-10 min efter domain setup
```

---

## STEG 6: Konfigurera Azure AD B2C (15 min)

### 6.1 Skapa B2C Tenant
1. Gå till portal.azure.com
2. Sök efter "Azure AD B2C"
3. Create → Create new tenant
4. Tenant name: `varderingsdata`
5. Domain: `varderingsdata.onmicrosoft.com`

### 6.2 Skapa App Registration
1. I B2C tenant → App registrations → New registration
2. Name: `JRM-CRM-Production`
3. Redirect URI: `https://crm.varderingsdata.se/auth/callback`
4. Kopiera Client ID och skapa Client Secret
5. Uppdatera .env.production med värden

### 6.3 Skapa User Flows
1. User flows → New user flow
2. Sign up and sign in → Recommended
3. Name: `B2C_1_signup_signin`
4. Identity providers: Email signup
5. User attributes: Email, Display Name

---

## STEG 7: Sätt upp Monitoring (5 min)

### 7.1 Application Insights
```powershell
az monitor app-insights component create `
  --app jrm-crm-insights `
  --location westeurope `
  --resource-group jrm-crm-prod `
  --application-type web
```

### 7.2 Lägg till Instrumentation Key i App Settings
```powershell
$INSIGHTS_KEY = az monitor app-insights component show `
  --app jrm-crm-insights `
  --resource-group jrm-crm-prod `
  --query instrumentationKey -o tsv

az webapp config appsettings set `
  --name jrm-crm-backend `
  --resource-group jrm-crm-prod `
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=$INSIGHTS_KEY
```

---

## STEG 8: Konfigurera Backups (5 min)

### 8.1 Automatiska App Service backups
```powershell
# Skapa storage container
az storage container create `
  --name backups `
  --account-name jrmcrmbackups

# Konfigurera backup schedule
az webapp config backup update `
  --resource-group jrm-crm-prod `
  --webapp-name jrm-crm-backend `
  --container-url "https://jrmcrmbackups.blob.core.windows.net/backups" `
  --frequency 1 `
  --frequency-unit Day `
  --retain-one true `
  --retention 30
```

---

## STEG 9: Verifiera Deployment (10 min)

### 9.1 Check backend health
```powershell
curl https://jrm-crm-backend.azurewebsites.net/health
```

### 9.2 Check frontend
```powershell
start https://jrm-crm-frontend.azurewebsites.net
```

### 9.3 Test login flow
1. Öppna frontend URL
2. Logga in med admin/admin (eller B2C)
3. Verifiera att data laddas
4. Testa skapa/redigera kund

### 9.4 Check logs
```powershell
az webapp log tail `
  --name jrm-crm-backend `
  --resource-group jrm-crm-prod
```

---

## STEG 10: Security Hardening (5 min)

### 10.1 Aktivera HTTPS only
```powershell
az webapp update `
  --name jrm-crm-backend `
  --resource-group jrm-crm-prod `
  --https-only true
```

### 10.2 Konfigurera CORS
```powershell
az webapp cors add `
  --name jrm-crm-backend `
  --resource-group jrm-crm-prod `
  --allowed-origins https://jrm-crm-frontend.azurewebsites.net
```

### 10.3 Aktivera Managed Identity
```powershell
az webapp identity assign `
  --name jrm-crm-backend `
  --resource-group jrm-crm-prod
```

---

## ⏱️ Total Tid: ~90 minuter

## 💰 Total Kostnad (månad):
- App Service Plan B1: €40
- Static Web App: €0 (free tier)
- Cosmos DB: €25 (optional)
- Storage Account: €5
- Application Insights: €5
- **Total: €50-€75/mån**

---

## 🆘 Troubleshooting

### Backend startar inte
```powershell
# Check logs
az webapp log tail --name jrm-crm-backend --resource-group jrm-crm-prod

# Restart app
az webapp restart --name jrm-crm-backend --resource-group jrm-crm-prod
```

### Environment variables saknas
```powershell
# Lista alla settings
az webapp config appsettings list `
  --name jrm-crm-backend `
  --resource-group jrm-crm-prod
```

### Deployment failed
```powershell
# Check deployment logs
az webapp log deployment show `
  --name jrm-crm-backend `
  --resource-group jrm-crm-prod
```

---

## 📞 Support

**Azure Support:** https://portal.azure.com → Help + support
**Dokumentation:** AZURE_DEPLOYMENT_GUIDE.md (mer detaljerad)

---

## ✅ Post-Deployment Checklist

- [ ] Backend är tillgänglig på https://jrm-crm-backend.azurewebsites.net
- [ ] Frontend är tillgänglig på https://jrm-crm-frontend.azurewebsites.net
- [ ] Login fungerar (Azure B2C eller basic auth)
- [ ] Data laddas korrekt
- [ ] Backups körs dagligen
- [ ] Application Insights samlar telemetri
- [ ] SSL certifikat är aktivt
- [ ] CORS är korrekt konfigurerat
- [ ] Environment variables är satta
- [ ] Logs är tillgängliga

**Status:** 🟢 Production Ready
