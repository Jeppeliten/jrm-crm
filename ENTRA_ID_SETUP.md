# 🔐 Azure Entra ID Setup Guide

## Vi använder Entra ID (inte B2C)!

Din JRM CRM använder **Azure Entra ID (Azure AD)** för autentisering, inte B2C.

---

## 🚀 Snabbstart - Konfigurera Entra ID App

### Steg 1: Skapa App Registration

1. **Öppna Azure Portal**: https://portal.azure.com
2. Sök efter **"Microsoft Entra ID"** (tidigare Azure Active Directory)
3. **App registrations** → **New registration**
4. Fyll i:
   - **Name**: `JRM-CRM-App`
   - **Supported account types**: `Accounts in this organizational directory only (varderingsdata only)`
   - **Redirect URI**: 
     - Platform: `Single-page application (SPA)`
     - URL: `https://lively-grass-0a14e0d03.3.azurestaticapps.net`
5. **Register**

### Steg 2: Kopiera Application ID

1. På Overview-sidan, kopiera:
   - **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Steg 3: Konfigurera Authentication

1. Gå till **Authentication**
2. **Single-page application** → Lägg till:
   ```
   https://lively-grass-0a14e0d03.3.azurestaticapps.net
   https://lively-grass-0a14e0d03.3.azurestaticapps.net/callback
   http://localhost:5500 (för lokal utveckling)
   ```
3. **Implicit grant and hybrid flows**: 
   - ✅ Access tokens
   - ✅ ID tokens
4. **Save**

### Steg 4: Konfigurera API Permissions

1. Gå till **API permissions**
2. **Add a permission** → **Microsoft Graph**
3. **Delegated permissions**, lägg till:
   - ✅ `User.Read`
   - ✅ `email`
   - ✅ `openid`
   - ✅ `profile`
   - ✅ `GroupMember.Read.All` (för groups)
4. **Grant admin consent** för alla permissions

### Steg 5: Expose an API (för backend)

1. Gå till **Expose an API**
2. **Add a scope**:
   - **Scope name**: `access_as_user`
   - **Who can consent**: `Admins and users`
   - **Admin consent display name**: `Access JRM CRM API`
   - **Admin consent description**: `Allows the app to access JRM CRM API on behalf of the signed-in user`
3. **Add scope**

---

## 🔧 Uppdatera Backend Environment Variables

### I Azure Portal → Web App → Configuration:

Uppdatera/lägg till dessa settings:

```env
# Entra ID Configuration
AZURE_AD_TENANT_ID=varderingsdata.onmicrosoft.com
AZURE_AD_CLIENT_ID=[DIN-APPLICATION-CLIENT-ID]
AZURE_AD_CLIENT_SECRET=[Om du behöver backend-to-backend auth]

# API Scope (från Expose an API)
AZURE_AD_SCOPE=api://[DIN-CLIENT-ID]/access_as_user

# Groups (om du använder role-based access)
AZURE_AD_GROUP_ADMIN=[Group Object ID för admin]
AZURE_AD_GROUP_MANAGER=[Group Object ID för manager]
AZURE_AD_GROUP_SALES=[Group Object ID för sales]
AZURE_AD_GROUP_VIEWER=[Group Object ID för viewer]
```

### Eller via PowerShell:

```powershell
$clientId = "DIN-APPLICATION-CLIENT-ID"
$tenantId = "DIN-TENANT-ID"

& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp config appsettings set `
  --resource-group rg-jrm-crm-prod `
  --name jrm-crm-api-prod-vsdmc5kbydcjc `
  --settings `
    AZURE_AD_TENANT_ID="$tenantId" `
    AZURE_AD_CLIENT_ID="$clientId" `
    AZURE_AD_SCOPE="api://$clientId/access_as_user"
```

---

## 🎨 Uppdatera Frontend Config

### Skapa `client/entra-id-config.js`:

```javascript
const ENTRA_CONFIG = {
  auth: {
    clientId: 'DIN-APPLICATION-CLIENT-ID',
    authority: 'https://login.microsoftonline.com/varderingsdata.onmicrosoft.com',
    redirectUri: 'https://lively-grass-0a14e0d03.3.azurestaticapps.net',
    postLogoutRedirectUri: 'https://lively-grass-0a14e0d03.3.azurestaticapps.net',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        console.log(message);
      },
      logLevel: 3, // Verbose
    },
  },
};

const LOGIN_REQUEST = {
  scopes: ['User.Read', 'api://DIN-CLIENT-ID/access_as_user'],
};

const TOKEN_REQUEST = {
  scopes: ['api://DIN-CLIENT-ID/access_as_user'],
  forceRefresh: false,
};

const API_BASE_URL = 'https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net/api';
```

---

## 👥 Skapa Groups för Role-Based Access (Valfritt)

### I Entra ID → Groups:

1. **New group**:
   - **Group type**: `Security`
   - **Group name**: `JRM-CRM-Admins`
   - **Group description**: `CRM System Administrators`
   - **Members**: Lägg till användare
   - **Create**

2. Repetera för:
   - `JRM-CRM-Managers`
   - `JRM-CRM-Sales`
   - `JRM-CRM-Viewers`

3. **Kopiera Object ID** för varje grupp och lägg till i backend environment variables.

---

## 🧪 Testa Entra ID Integration

### 1. Testa Backend Auth Endpoint:

```powershell
# Hämta token först (kräver login)
$token = "DIN-ACCESS-TOKEN-FRÅN-FRONTEND"

# Testa protected endpoint
curl https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net/api/customers `
  -H "Authorization: Bearer $token"
```

### 2. Testa Frontend:

1. Öppna: https://lively-grass-0a14e0d03.3.azurestaticapps.net
2. Klicka **Login**
3. Logga in med Entra ID (varderingsdata.onmicrosoft.com)
4. Ge consent för permissions
5. Du bör redirectas tillbaka till appen

---

## 📋 Checklista

- [ ] App Registration skapad i Entra ID
- [ ] Application ID och Tenant ID kopierade
- [ ] Redirect URIs konfigurerade
- [ ] API Permissions tillagda och consent given
- [ ] API Scope exponerad (Expose an API)
- [ ] Backend environment variables uppdaterade
- [ ] Frontend config uppdaterad med rätt IDs
- [ ] Groups skapade (om role-based access används)
- [ ] Testat login flow

---

## 🔗 Användbara Länkar

- **Entra ID Admin Center**: https://entra.microsoft.com
- **Azure Portal**: https://portal.azure.com
- **App Registrations**: https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps
- **MSAL.js Docs**: https://learn.microsoft.com/entra/identity-platform/tutorial-v2-javascript-spa

---

## 💡 Skillnader: Entra ID vs B2C

| Feature | Entra ID (Azure AD) | Azure AD B2C |
|---------|---------------------|--------------|
| **Användare** | Organisationens anställda | Externa kunder |
| **Authentication** | Work/School accounts | Social + Local accounts |
| **Branding** | Standard Microsoft | Fullt anpassningsbar |
| **Kostnad** | Inkluderat i Azure | Per-user pricing |
| **Användarflöden** | Standard login | Custom user journeys |

---

## ✅ Klart!

Nu är din JRM CRM konfigurerad för **Entra ID authentication** med:
- ✅ Single Sign-On (SSO)
- ✅ Role-based access via Groups
- ✅ Secure token-based API authentication
- ✅ Integration med din organisation's directory
