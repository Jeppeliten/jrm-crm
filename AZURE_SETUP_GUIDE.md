# 🔧 Azure Konfigurationsguide - Steg för Steg

## 🎯 Översikt
Vi kommer konfigurera:
1. **Azure Cosmos DB** (MongoDB API) för datalagring
2. **Azure Entra ID B2C** för användarautentisering
3. **Azure AD Groups** för rollhantering

---

## 📋 **STEG 1: Azure Cosmos DB Setup**

### 1.1 Skapa Cosmos DB Account

1. **Gå till Azure Portal:** https://portal.azure.com
2. **Skapa ny resurs:** "Create a resource" > "Azure Cosmos DB"
3. **Välj API:** "Azure Cosmos DB for MongoDB"
4. **Konfigurera:**
   ```
   Subscription: Din Azure-prenumeration
   Resource Group: Skapa ny "rg-crm-prod" (eller använd befintlig)
   Account Name: crm-cosmosdb-[ditt-namn] (måste vara unikt)
   Location: West Europe (eller närmaste)
   Capacity mode: Provisioned throughput (för utveckling)
   ```

5. **Klicka:** "Review + Create" → "Create"
6. **Vänta:** 5-10 minuter för deployment

### 1.2 Hämta Connection String

1. **Gå till:** Din Cosmos DB account → "Connection strings" (vänster meny)
2. **Kopiera:** "Primary Connection String"
3. **Spara:** Connection string (behövs för .env)

**Exempel på connection string:**
```
mongodb://crm-cosmosdb:LongBase64Key==@crm-cosmosdb.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@crm-cosmosdb@
```

### 1.3 Testa Cosmos DB

1. **Uppdatera .env:**
   ```env
   COSMOS_DB_CONNECTION_STRING=mongodb://[din-connection-string]
   COSMOS_DB_DATABASE_NAME=crm_database
   ```

2. **Starta om servern:**
   ```bash
   # Stoppa server (Ctrl+C)
   # Starta igen:
   npm start
   ```

3. **Testa connection:**
   ```bash
   curl http://localhost:3000/api/health/cosmos
   ```

   **Förväntat svar:**
   ```json
   {
     "status": "healthy",
     "database": "crm_database",
     "connected": true
   }
   ```

---

## 🔐 **STEG 2: Azure Entra ID B2C Setup**

### 2.1 Skapa B2C Tenant

1. **Gå till:** Azure Portal → "Create a resource"
2. **Sök:** "Azure Active Directory B2C"
3. **Klicka:** "Create a new Azure AD B2C Tenant"
4. **Konfigurera:**
   ```
   Organization name: Värderingsdata CRM
   Initial domain name: varderingsdata (eller ditt företagsnamn)
   Country/Region: Sweden
   ```

5. **Klicka:** "Create"
6. **Växla till B2C tenant:** Efter skapande, klicka "Switch to your new tenant"

### 2.2 Registrera Backend API Application

1. **I B2C tenant:** "App registrations" → "New registration"
2. **Konfigurera:**
   ```
   Name: CRM-Backend-API
   Supported account types: Accounts in any identity provider or organizational directory
   Redirect URI: Leave empty for now
   ```

3. **Efter skapning:**
   - **Kopiera:** Application (client) ID
   - **Gå till:** "Expose an API" → "Set" application ID URI → Acceptera default
   - **Lägg till scope:**
     ```
     Scope name: access
     Admin consent display name: Access CRM API
     Admin consent description: Allow access to CRM backend API
     State: Enabled
     ```

### 2.3 Registrera Frontend Application

1. **Ny app registration:**
   ```
   Name: CRM-Frontend
   Supported account types: Accounts in any identity provider or organizational directory
   Redirect URI: Single-page application (SPA) → http://localhost:3000
   ```

2. **Efter skapning:**
   - **Kopiera:** Application (client) ID
   - **Gå till:** "API permissions" → "Add a permission"
   - **My APIs:** Välj "CRM-Backend-API"
   - **Permissions:** Välj "access" scope
   - **Grant admin consent** för permissions

### 2.4 Skapa User Flow

1. **Gå till:** "User flows" → "New user flow"
2. **Välj:** "Sign up and sign in" → "Recommended"
3. **Konfigurera:**
   ```
   Name: B2C_1_signup_signin
   Identity providers: Email signup
   User attributes and claims:
     - Collect: Email Address, Given Name, Surname, Display Name
     - Return: Email Addresses, Given Name, Surname, Display Name, User's Object ID
   ```

4. **Klicka:** "Create"

### 2.5 Uppdatera .env med B2C Settings

```env
# Azure B2C Configuration
AZURE_B2C_TENANT_NAME=varderingsdata
AZURE_B2C_TENANT_ID=varderingsdata.onmicrosoft.com
AZURE_B2C_CLIENT_ID=[Backend-API-Client-ID]
AZURE_B2C_POLICY_NAME=B2C_1_signup_signin
```

---

## 👥 **STEG 3: Azure AD Groups för Roller**

### 3.1 Skapa Security Groups

1. **Gå till:** Azure AD (huvud-tenant, inte B2C) → "Groups"
2. **Skapa groups:**
   ```
   Group name: CRM-Admin
   Group type: Security
   Description: CRM Administratörer - full åtkomst
   
   Group name: CRM-Manager  
   Group type: Security
   Description: CRM Managers - rapporter och analys
   
   Group name: CRM-Sales
   Group type: Security
   Description: CRM Säljare - CRM-funktioner
   
   Group name: CRM-Viewer
   Group type: Security
   Description: CRM Viewer - endast läsåtkomst
   ```

### 3.2 Kopiera Group Object IDs

1. **För varje grupp:** Klicka på gruppen → Kopiera "Object ID"
2. **Uppdatera .env:**
   ```env
   # Azure AD Groups för Rollhantering
   AZURE_AD_GROUP_ADMIN=[CRM-Admin Object ID]
   AZURE_AD_GROUP_MANAGER=[CRM-Manager Object ID]  
   AZURE_AD_GROUP_SALES=[CRM-Sales Object ID]
   AZURE_AD_GROUP_VIEWER=[CRM-Viewer Object ID]
   USE_AZURE_AD_GROUPS=true
   ```

---

## 🧪 **STEG 4: Testa Full Konfiguration**

### 4.1 Starta om server med full config

```bash
# Stoppa server (Ctrl+C)
npm start
```

**Förväntat output:**
```
🔌 Connecting to Cosmos DB...
✅ Cosmos DB connected successfully
✅ Azure B2C middleware loaded
🚀 CRM Server Started Successfully!
```

### 4.2 Testa endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# Cosmos DB health  
curl http://localhost:3000/api/health/cosmos

# Azure B2C config
curl http://localhost:3000/api/auth/config
```

### 4.3 Testa frontend

1. **Öppna:** http://localhost:3000
2. **Klicka:** "Logga in" (om det finns)
3. **Kontrollera:** Omdirigering till Azure B2C

---

## 📁 **STEG 5: Uppdatera Frontend Config**

### 5.1 Uppdatera azure-b2c-config.js

```javascript
const msalConfig = {
  auth: {
    clientId: '[Frontend-Client-ID]',
    authority: 'https://varderingsdata.b2clogin.com/varderingsdata.onmicrosoft.com/B2C_1_signup_signin',
    knownAuthorities: ['varderingsdata.b2clogin.com'],
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin
  }
};
```

---

## ✅ **Checkpoint: Vad du ska ha efter alla steg**

### .env fil ska innehålla:
```env
# Cosmos DB
COSMOS_DB_CONNECTION_STRING=mongodb://[din-connection-string]
COSMOS_DB_DATABASE_NAME=crm_database

# Azure B2C  
AZURE_B2C_TENANT_NAME=varderingsdata
AZURE_B2C_TENANT_ID=varderingsdata.onmicrosoft.com
AZURE_B2C_CLIENT_ID=[Backend-Client-ID]
AZURE_B2C_POLICY_NAME=B2C_1_signup_signin

# Azure AD Groups
AZURE_AD_GROUP_ADMIN=[Admin-Group-ID]
AZURE_AD_GROUP_MANAGER=[Manager-Group-ID]
AZURE_AD_GROUP_SALES=[Sales-Group-ID]
AZURE_AD_GROUP_VIEWER=[Viewer-Group-ID]
USE_AZURE_AD_GROUPS=true

# Server
NODE_ENV=development
PORT=3000
```

### API endpoints ska svara:
- ✅ `/health` - Server healthy
- ✅ `/api/health/cosmos` - Database connected
- ✅ `/api/auth/config` - Azure B2C configured
- ✅ `/api/users` - User management ready

---

## 🆘 **Hjälp & Felsökning**

### Cosmos DB Problem:
- **Connection timeout:** Kontrollera firewall-regler i Cosmos DB
- **Authentication error:** Verifiera connection string

### Azure B2C Problem:
- **Redirect error:** Kontrollera redirect URI i app registration
- **Token validation error:** Verifiera client ID och tenant

### Groups Problem:
- **Groups not found:** Kontrollera Object IDs
- **Permission denied:** Kontrollera app permissions för Graph API

---

## 🚀 **Nästa: Vilken steg vill du börja med?**

1. **Cosmos DB** (rekommenderat att börja här)
2. **Azure B2C**  
3. **Azure AD Groups**
4. **Frontend integration**

Säg till vilket steg du vill att jag hjälper dig med först! 🎯