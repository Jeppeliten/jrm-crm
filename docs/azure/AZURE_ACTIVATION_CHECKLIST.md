# ✅ Azure Entra ID Activation Checklist

## Status: Delvis Implementerat
Koden finns på plats men är **inte aktiverad**. Följ denna checklista för att aktivera Azure Entra ID-integration.

## 📋 Förberedelser

### 1. Azure Portal Setup
- [ ] Skapa Azure B2C tenant (om inte redan gjort)
- [ ] Konfigurera App Registration för frontend
- [ ] Konfigurera App Registration för backend/Graph API
- [ ] Sätt upp User Flows (sign-up/sign-in policy)
- [ ] Konfigurera API permissions

### 2. Credentials och Konfiguration
- [ ] Hämta Client ID från Azure Portal
- [ ] Hämta Tenant ID/Domain
- [ ] Generera Client Secret för backend
- [ ] Anteckna Policy-namn

## 🔧 Backend Aktivering

### 3. Environment Variables
```bash
cd server
cp .env.example .env
```

Redigera `.env` och fyll i:
```env
# Azure B2C Configuration
AZURE_B2C_TENANT_NAME=varderingsdata
AZURE_B2C_TENANT_ID=your-tenant-guid
AZURE_B2C_CLIENT_ID=your-frontend-client-id
AZURE_B2C_CLIENT_SECRET=your-backend-client-secret
AZURE_B2C_POLICY_NAME=B2C_1_signup_signin

# User Sync
AZURE_B2C_GRAPH_CLIENT_ID=your-graph-client-id
AZURE_B2C_GRAPH_CLIENT_SECRET=your-graph-client-secret
ENABLE_AZURE_B2C_USER_SYNC=true

# Webhook
AZURE_B2C_WEBHOOK_SECRET=generate-random-32-char-string
```

- [ ] Miljövariabler konfigurerade
- [ ] Secrets säkert lagrade

### 4. Backend Code Changes

**server/index.js** - Lägg till imports:
```javascript
// Lägg till efter befintliga imports
const {
  requireAzureAuth,
  requireRole,
  optionalAzureAuth,
  getConfigCheckEndpoint
} = require('./auth-azure-b2c-middleware');
```

**server/index.js** - Lägg till endpoints:
```javascript
// Lägg till efter app setup
app.get('/api/auth/config', getConfigCheckEndpoint());
```

**server/index.js** - Ersätt auth middleware:
```javascript
// Ersätt alla instanser av 'requireAuth' med:
app.get('/api/companies', requireAzureAuth(), (req, res) => {
  // befintlig kod
});

// För admin-funktioner:
app.delete('/api/companies/:id', requireRole('admin'), (req, res) => {
  // befintlig kod
});

// För manager+ funktioner:
app.post('/api/enrich', requireRole('manager', 'admin'), (req, res) => {
  // befintlig kod
});
```

- [ ] Imports tillagda
- [ ] Config endpoint tillagt
- [ ] Auth middleware uppdaterat
- [ ] Rollbaserade behörigheter implementerade

## 🎨 Frontend Aktivering

### 5. Configuration Update

**client/azure-b2c-config.js** - Uppdatera:
```javascript
const AZURE_B2C_CONFIG = {
  tenantName: 'varderingsdata', // Din tenant
  clientId: 'your-frontend-client-id', // Från Azure Portal
  signUpSignInPolicy: 'B2C_1_signup_signin',
  // ... resten av config
};
```

- [ ] Tenant-namn uppdaterat
- [ ] Client ID uppdaterat
- [ ] Policy-namn korrekta

### 6. App.js Integration

**client/app.js** - Lägg till konstanter:
```javascript
// Lägg till i början av filen
const USE_AZURE_B2C = true; // Aktivera Azure B2C
```

**client/app.js** - Uppdatera login-funktion:
```javascript
async function login() {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  // Azure B2C Login
  if (USE_AZURE_B2C) {
    try {
      showNotification('Omdirigerar till Azure...', 'info');
      await azureAuth.login();
      return; // Azure hanterar redirect
    } catch (error) {
      showNotification('Azure-inloggning misslyckades: ' + error.message, 'error');
      return;
    }
  }

  // Fallback till lokal auth (för development)
  // ... befintlig kod ...
}
```

**client/app.js** - Lägg till Azure success handler:
```javascript
async function onAzureLoginSuccess() {
  const user = azureAuth.getUser();
  console.log('Azure login successful:', user.name);
  
  AppState.currentUser = {
    id: user.id,
    username: user.email,
    name: user.name,
    email: user.email,
    roll: user.roles?.[0] || 'viewer', // Från Azure claims
    azureId: user.objectId
  };
  
  await loadState();
  showView('dashboard');
  updateUIForRoles();
  
  showNotification(`Välkommen ${user.name}!`, 'success');
}
```

**client/app.js** - Uppdatera logout:
```javascript
async function logout() {
  if (USE_AZURE_B2C && azureAuth.isAuthenticated()) {
    await azureAuth.logout();
  }
  
  AppState.currentUser = null;
  localStorage.removeItem(LS_KEY);
  showView('login');
}
```

**client/app.js** - Uppdatera API calls:
```javascript
async function saveState() {
  if (!AppState.currentUser) return;

  try {
    let response;
    
    if (USE_AZURE_B2C) {
      // Använd Azure-autentiserade anrop
      response = await azureAuth.authenticatedFetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: AppState.users,
          brands: AppState.brands,
          companies: AppState.companies,
          agents: AppState.agents,
          contacts: AppState.contacts,
          tasks: AppState.tasks,
          notes: AppState.notes
        })
      });
    } else {
      // Befintlig kod för lokal auth
      response = await fetch('/api/save', {
        // ... befintlig kod
      });
    }
    
    // ... hantera response
  } catch (error) {
    console.error('Save error:', error);
    showNotification('Kunde inte spara: ' + error.message, 'error');
  }
}
```

- [ ] USE_AZURE_B2C konstant tillagd
- [ ] Login-funktion uppdaterad
- [ ] Azure success handler implementerad
- [ ] Logout uppdaterad
- [ ] API calls uppdaterade

### 7. Initialization

**client/app.js** - Uppdatera initialization:
```javascript
// Lägg till Azure-initialisering
async function initializeApp() {
  if (USE_AZURE_B2C) {
    const config = generateMsalConfig();
    const initialized = await azureAuth.initialize(config);
    
    if (initialized && azureAuth.isAuthenticated()) {
      await onAzureLoginSuccess();
    } else {
      showView('login');
    }
  } else {
    // Befintlig initialization
    loadState();
    if (AppState.currentUser) {
      showView('dashboard');
    } else {
      showView('login');
    }
  }
}

// Ersätt DOMContentLoaded
document.addEventListener('DOMContentLoaded', initializeApp);
```

- [ ] Azure-initialisering implementerad
- [ ] App startup uppdaterad

## 🗄️ Databas Migration

### 8. Users Collection Update

Uppdatera Users-datastrukturen för hybrid Azure/CRM:

```javascript
// Lägg till migration i backend
async function migrateUsersForAzure() {
  const users = await db.users.find({}).toArray();
  
  for (const user of users) {
    if (!user.azureObjectId) {
      await db.users.updateOne(
        { _id: user._id },
        {
          $set: {
            azureObjectId: null, // Fylls vid första Azure-login
            crmMetadata: {
              legacyUser: true,
              originalAuthMethod: 'local'
            },
            azureMetadata: {},
            syncedAt: null
          }
        }
      );
    }
  }
}
```

- [ ] Users collection uppdaterad
- [ ] Migration för befintliga användare

## 🧪 Testing

### 9. Grundläggande Test

1. **Backend Test:**
```bash
cd server
npm start
# Kontrollera att inga Azure-relaterade fel visas i konsolen
```

2. **Frontend Test:**
```bash
# Öppna http://localhost:3000
# Klicka "Logga in"
# Ska omdirigera till Azure B2C login
```

3. **API Test:**
```bash
# Utan token - ska få 401
curl http://localhost:3000/api/companies

# Testa config endpoint
curl http://localhost:3000/api/auth/config
```

- [ ] Backend startar utan fel
- [ ] Azure redirect fungerar
- [ ] API-skydd aktiverat
- [ ] Config endpoint svarar

### 10. Integration Test

- [ ] Skapa testanvändare i Azure B2C
- [ ] Logga in med testanvändare
- [ ] Kontrollera att CRM-användare skapas automatiskt
- [ ] Testa rollbaserade behörigheter
- [ ] Verifiera user sync fungerar

## 🔒 Security Checklist

- [ ] Client secrets inte i git/kod
- [ ] HTTPS används i production
- [ ] CORS korrekt konfigurerad
- [ ] Token expiration hanteras
- [ ] Error handling för auth failures

## 📊 Monitoring

### 11. Logging och Övervakning

- [ ] Azure-autentiseringsloggar
- [ ] User sync-loggar
- [ ] Performance-monitoring
- [ ] Error tracking för Azure-integration

## 🎉 Slutkontroll

När allt är klart:

- [ ] Användare kan logga in via Azure B2C
- [ ] CRM-funktionalitet fungerar med Azure-auth
- [ ] Rollbaserade behörigheter fungerar
- [ ] User sync mellan Azure och CRM fungerar
- [ ] Fallback till lokal auth (för development) fungerar

## 📚 Nästa Steg Efter Aktivering

1. **User Management UI** - Implementera gränssnitt för att hantera Azure-användare
2. **Advanced Roles** - Konfigurera fler detaljerade roller i Azure
3. **SSO Integration** - Utöka till andra Azure-tjänster
4. **Monitoring Dashboard** - Skapa övervakning för Azure-integration

---

## ⚠️ Viktiga Noter

- **Backup:** Ta backup av befintlig databas innan migration
- **Testing:** Testa grundligt i development före production
- **Rollback Plan:** Ha en plan för att återgå till lokal auth om nödvändigt
- **Documentation:** Uppdatera användarhandledning för Azure-login

## 🆘 Support

Om problem uppstår, kontrollera:
1. Azure Portal-konfiguration
2. Console-loggar (både frontend och backend)
3. Network-tabs för API-anrop
4. Azure B2C audit logs