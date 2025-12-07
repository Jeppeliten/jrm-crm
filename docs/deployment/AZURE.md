# 🚀 Azure Deployment Guide - CRM System

## 📋 Innehållsförteckning
1. [Azure AD B2C Setup](#azure-ad-b2c-setup)
2. [Frontend Deployment](#frontend-deployment)
3. [Backend Deployment](#backend-deployment)
4. [Database Setup](#database-setup)
5. [Säkerhet & Konfiguration](#säkerhet--konfiguration)
6. [CI/CD Pipeline](#cicd-pipeline)

---

## 1. Azure AD B2C Setup

### Steg 1: Skapa Azure AD B2C Tenant

```bash
# Via Azure Portal:
# 1. Gå till portal.azure.com
# 2. Sök efter "Azure AD B2C"
# 3. Klicka "Create a tenant"
# 4. Välj "Azure AD B2C"
# 5. Fyll i:
#    - Organization name: "Värderingsdata CRM"
#    - Initial domain: "varderingsdata"
#    - Country: Sweden
```

### Steg 2: Registrera applikationen

**Frontend App Registration:**
```
Namn: CRM-Frontend
Application Type: Single Page Application (SPA)
Redirect URIs:
  - https://crm.varderingsdata.se/auth/callback
  - http://localhost:3000/auth/callback (för utveckling)
Implicit grant: ID tokens ✓
Supported account types: Accounts in this organizational directory only
```

**Backend App Registration:**
```
Namn: CRM-Backend-API
Application Type: Web API
App ID URI: api://crm-backend
Exposed API scopes:
  - api://crm-backend/read
  - api://crm-backend/write
  - api://crm-backend/admin
```

### Steg 3: User Flows (Användarflöden)

**Sign-up and sign-in flow:**
```
Namn: B2C_1_signup_signin
Identity providers: Email signup
User attributes:
  - Email Address ✓
  - Display Name ✓
  - Given Name ✓
  - Surname ✓
  - Job Title
Application claims (returnera i token):
  - Email Addresses ✓
  - Display Name ✓
  - Given Name ✓
  - Surname ✓
  - User's Object ID ✓
  - Job Title ✓
```

**Password reset flow:**
```
Namn: B2C_1_password_reset
```

**Profile editing flow:**
```
Namn: B2C_1_profile_edit
```

### Steg 4: App Roles (Roller)

Skapa roller i App Registration → Roles and administrators:

```json
{
  "appRoles": [
    {
      "allowedMemberTypes": ["User"],
      "description": "Administratörer har full åtkomst till systemet",
      "displayName": "Admin",
      "id": "guid-for-admin",
      "isEnabled": true,
      "value": "admin"
    },
    {
      "allowedMemberTypes": ["User"],
      "description": "Säljare har åtkomst till CRM-funktioner",
      "displayName": "Sales",
      "id": "guid-for-sales",
      "isEnabled": true,
      "value": "sales"
    },
    {
      "allowedMemberTypes": ["User"],
      "description": "Managers kan se rapporter och statistik",
      "displayName": "Manager",
      "id": "guid-for-manager",
      "isEnabled": true,
      "value": "manager"
    }
  ]
}
```

---

## 2. Frontend Deployment

### Alternativ A: Azure Static Web Apps (Rekommenderat för SPA)

**Fördelar:**
- ✅ Gratis SSL-certifikat
- ✅ Global CDN
- ✅ Automatisk CI/CD från GitHub
- ✅ Staging environments
- ✅ Serverless API-funktioner

**Setup:**

```bash
# 1. Installera Azure CLI
az login

# 2. Skapa Static Web App
az staticwebapp create \
  --name crm-frontend \
  --resource-group crm-rg \
  --source https://github.com/yourorg/crm \
  --location "West Europe" \
  --branch main \
  --app-location "/crm-prototype" \
  --api-location "/server" \
  --output-location "/"

# 3. Konfigurera custom domain
az staticwebapp hostname set \
  --name crm-frontend \
  --resource-group crm-rg \
  --hostname crm.varderingsdata.se
```

**staticwebapp.config.json:**
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "*.{css,scss,js,png,gif,ico,jpg,svg}"]
  },
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"]
    }
  ],
  "responseOverrides": {
    "401": {
      "redirect": "/login",
      "statusCode": 302
    }
  },
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self' https://*.b2clogin.com https://*.windows.net; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  }
}
```

### Alternativ B: Azure App Service

```bash
# Skapa App Service Plan
az appservice plan create \
  --name crm-plan \
  --resource-group crm-rg \
  --sku B1 \
  --is-linux

# Skapa Web App
az webapp create \
  --name crm-frontend \
  --resource-group crm-rg \
  --plan crm-plan \
  --runtime "NODE|18-lts"

# Konfigurera deployment från GitHub
az webapp deployment source config \
  --name crm-frontend \
  --resource-group crm-rg \
  --repo-url https://github.com/yourorg/crm \
  --branch main \
  --manual-integration
```

---

## 3. Backend Deployment

### Alternativ A: Azure App Service (Rekommenderat)

```bash
# Skapa App Service för backend
az webapp create \
  --name crm-backend \
  --resource-group crm-rg \
  --plan crm-plan \
  --runtime "NODE|18-lts"

# Konfigurera environment variables
az webapp config appsettings set \
  --name crm-backend \
  --resource-group crm-rg \
  --settings \
    NODE_ENV=production \
    PORT=8080 \
    AZURE_AD_B2C_TENANT_NAME=varderingsdata \
    AZURE_AD_B2C_CLIENT_ID=your-client-id \
    AZURE_AD_B2C_POLICY_NAME=B2C_1_signup_signin \
    DATABASE_CONNECTION_STRING=your-connection-string

# Enable HTTPS only
az webapp update \
  --name crm-backend \
  --resource-group crm-rg \
  --https-only true

# Configure CORS
az webapp cors add \
  --name crm-backend \
  --resource-group crm-rg \
  --allowed-origins https://crm.varderingsdata.se
```

### Alternativ B: Azure Container Apps (För Docker)

```bash
# Skapa Container Apps environment
az containerapp env create \
  --name crm-env \
  --resource-group crm-rg \
  --location "West Europe"

# Deploy container
az containerapp create \
  --name crm-backend \
  --resource-group crm-rg \
  --environment crm-env \
  --image ghcr.io/yourorg/crm-backend:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3
```

---

## 4. Database Setup

### Alternativ A: Azure Cosmos DB (NoSQL - Rekommenderat för flexibilitet)

```bash
# Skapa Cosmos DB account
az cosmosdb create \
  --name crm-cosmosdb \
  --resource-group crm-rg \
  --locations regionName="West Europe" failoverPriority=0 \
  --default-consistency-level Session

# Skapa database
az cosmosdb sql database create \
  --account-name crm-cosmosdb \
  --resource-group crm-rg \
  --name crmdb

# Skapa containers
az cosmosdb sql container create \
  --account-name crm-cosmosdb \
  --database-name crmdb \
  --name companies \
  --partition-key-path "/brandId" \
  --throughput 400

az cosmosdb sql container create \
  --account-name crm-cosmosdb \
  --database-name crmdb \
  --name agents \
  --partition-key-path "/companyId" \
  --throughput 400

az cosmosdb sql container create \
  --account-name crm-cosmosdb \
  --database-name crmdb \
  --name brands \
  --partition-key-path "/id" \
  --throughput 400
```

### Alternativ B: Azure SQL Database (Relational)

```bash
# Skapa SQL Server
az sql server create \
  --name crm-sqlserver \
  --resource-group crm-rg \
  --location "West Europe" \
  --admin-user crmadmin \
  --admin-password 'YourSecurePassword123!'

# Skapa database
az sql db create \
  --name crmdb \
  --server crm-sqlserver \
  --resource-group crm-rg \
  --service-objective S0

# Konfigurera firewall
az sql server firewall-rule create \
  --server crm-sqlserver \
  --resource-group crm-rg \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Alternativ C: Azure Blob Storage (För JSON-filer)

```bash
# Skapa Storage Account
az storage account create \
  --name crmstorageaccount \
  --resource-group crm-rg \
  --location "West Europe" \
  --sku Standard_LRS

# Skapa container
az storage container create \
  --name crm-data \
  --account-name crmstorageaccount \
  --public-access off
```

---

## 5. Säkerhet & Konfiguration

### Key Vault för secrets

```bash
# Skapa Key Vault
az keyvault create \
  --name crm-keyvault \
  --resource-group crm-rg \
  --location "West Europe"

# Lägg till secrets
az keyvault secret set \
  --vault-name crm-keyvault \
  --name "DatabaseConnectionString" \
  --value "your-connection-string"

az keyvault secret set \
  --vault-name crm-keyvault \
  --name "B2CClientSecret" \
  --value "your-client-secret"

# Ge App Service åtkomst till Key Vault
az webapp identity assign \
  --name crm-backend \
  --resource-group crm-rg

# Sätt access policy
az keyvault set-policy \
  --name crm-keyvault \
  --object-id $(az webapp identity show --name crm-backend --resource-group crm-rg --query principalId -o tsv) \
  --secret-permissions get list
```

### Application Insights (Monitoring)

```bash
# Skapa Application Insights
az monitor app-insights component create \
  --app crm-insights \
  --location "West Europe" \
  --resource-group crm-rg \
  --application-type web

# Koppla till App Service
az webapp config appsettings set \
  --name crm-backend \
  --resource-group crm-rg \
  --settings \
    APPINSIGHTS_INSTRUMENTATIONKEY=$(az monitor app-insights component show --app crm-insights --resource-group crm-rg --query instrumentationKey -o tsv)
```

---

## 6. CI/CD Pipeline

### GitHub Actions Workflow

**.github/workflows/deploy.yml:**

```yaml
name: Deploy CRM to Azure

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AZURE_WEBAPP_NAME: crm-backend
  NODE_VERSION: '18.x'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}
    
    - name: Install dependencies
      run: |
        cd server
        npm ci
    
    - name: Run tests
      run: |
        cd server
        npm test
    
    - name: Build
      run: |
        cd server
        npm run build --if-present
    
    - name: Deploy to Azure Web App
      uses: azure/webapps-deploy@v2
      with:
        app-name: ${{ env.AZURE_WEBAPP_NAME }}
        publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
        package: ./server
    
    - name: Deploy Static Web App
      uses: Azure/static-web-apps-deploy@v1
      with:
        azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
        repo_token: ${{ secrets.GITHUB_TOKEN }}
        action: "upload"
        app_location: "/crm-prototype"
        api_location: ""
        output_location: ""
```

---

## 💰 Kostnadskalkyl (ca priser SEK/månad)

### Liten organisation (10-50 användare):
- **Azure AD B2C:** Gratis (upp till 50,000 MAU)
- **Static Web App (Standard):** ~90 SEK
- **App Service (B1):** ~130 SEK
- **Cosmos DB (400 RU/s):** ~280 SEK
- **Application Insights:** ~50 SEK
- **TOTALT:** ~550 SEK/månad

### Medium organisation (50-200 användare):
- **Azure AD B2C:** ~500 SEK
- **Static Web App (Standard):** ~90 SEK
- **App Service (S1):** ~750 SEK
- **Cosmos DB (1000 RU/s):** ~700 SEK
- **Application Insights:** ~150 SEK
- **TOTALT:** ~2,190 SEK/månad

---

## 📝 Rekommendationer

### ✅ Bästa setup för er organisation:

1. **Frontend:** Azure Static Web Apps
   - Gratis HTTPS
   - Global CDN
   - Automatisk CI/CD
   
2. **Backend:** Azure App Service (B1 eller S1)
   - Enkel skalning
   - Inbyggd monitoring
   - Automatiska backups

3. **Database:** Azure Cosmos DB
   - Flexibel NoSQL
   - Automatisk skalning
   - Global distribution

4. **Auth:** Azure AD B2C
   - Enterprise-grade säkerhet
   - SSO-stöd
   - MFA inbyggt

5. **Secrets:** Azure Key Vault
   - Centraliserad secret management
   - Automatisk rotation

6. **Monitoring:** Application Insights
   - Real-time metrics
   - Error tracking
   - Performance monitoring

### 🔒 Säkerhetskonfiguration:

```javascript
// Rekommenderade headers i production
{
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Content-Security-Policy": "default-src 'self'; ..."
  "Referrer-Policy": "strict-origin-when-cross-origin"
}
```

---

## 🚀 Deployment Checklist

- [ ] Azure AD B2C tenant skapad
- [ ] App registrations konfigurerade
- [ ] User flows skapade
- [ ] Roller definierade
- [ ] Static Web App deployed
- [ ] Backend App Service deployed
- [ ] Database konfigurerad
- [ ] Key Vault setup
- [ ] Application Insights aktiverat
- [ ] Custom domain konfigurerad
- [ ] SSL-certifikat installerat
- [ ] CORS konfigurerat
- [ ] Environment variables satta
- [ ] CI/CD pipeline aktiv
- [ ] Backup policy konfigurerad
- [ ] Monitoring alerts satta

---

**Behöver du hjälp med implementationen? Jag kan skapa kodexempel för Azure B2C-integration!**
