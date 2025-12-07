# 🔐 Azure AD B2C Integration - Setup Guide

## 📦 Installation

### Backend Dependencies

```bash
cd server
npm install jsonwebtoken jwks-rsa
```

### Frontend Dependencies

Inget npm-paket behövs! MSAL läses in via CDN.

---

## ⚙️ Konfiguration

### 1. Environment Variables (Backend)

Skapa `.env` fil i `server/` katalogen:

```env
# Azure AD B2C Configuration
AZURE_B2C_TENANT_NAME=varderingsdata
AZURE_B2C_TENANT_ID=your-tenant-guid-or-domain
AZURE_B2C_CLIENT_ID=your-backend-client-id
AZURE_B2C_POLICY_NAME=B2C_1_signup_signin

# Optional: Password reset policy
AZURE_B2C_PASSWORD_RESET_POLICY=B2C_1_password_reset

# Optional: Profile edit policy
AZURE_B2C_PROFILE_EDIT_POLICY=B2C_1_profile_edit

# Node environment
NODE_ENV=production
PORT=3000
```

### 2. Frontend Configuration

Uppdatera `auth-azure-b2c.js`:

```javascript
const msalConfig = {
  auth: {
    clientId: 'your-frontend-client-id', // Från Azure Portal
    authority: 'https://varderingsdata.b2clogin.com/varderingsdata.onmicrosoft.com/B2C_1_signup_signin',
    knownAuthorities: ['varderingsdata.b2clogin.com'],
    redirectUri: window.location.origin + '/auth/callback',
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
    secureCookies: true
  }
};

const loginRequest = {
  scopes: [
    'openid',
    'profile', 
    'email',
    'api://your-backend-api-client-id/read',
    'api://your-backend-api-client-id/write'
  ]
};
```

---

## 🚀 Integration i befintlig kod

### Backend (server/index.js)

```javascript
// 1. Importera middleware
const {
  requireAzureAuth,
  requireRole,
  optionalAzureAuth,
  getConfigCheckEndpoint
} = require('./auth-azure-b2c-middleware');

// 2. Lägg till config check endpoint
app.get('/api/auth/config', getConfigCheckEndpoint());

// 3. Skydda API endpoints
// Alla autentiserade användare:
app.get('/api/companies', requireAzureAuth(), (req, res) => {
  // req.user innehåller användarinfo
  console.log('User:', req.user.name, req.user.email);
  res.json(state.companies);
});

// Endast admins:
app.delete('/api/companies/:id', requireRole('admin'), (req, res) => {
  // Endast användare med 'admin' roll kan komma åt
  // ...
});

// Admins eller managers:
app.get('/api/reports', requireRole('admin', 'manager'), (req, res) => {
  // ...
});

// Optional auth (publik endpoint men log om användare är inloggad):
app.get('/api/public-data', optionalAzureAuth, (req, res) => {
  if (req.user) {
    console.log('Authenticated user accessed public data:', req.user.name);
  }
  res.json({ data: 'public' });
});

// 4. Uppdatera CORS för Azure B2C
const cors = require('cors');
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://crm.varderingsdata.se',
    'https://varderingsdata.b2clogin.com'
  ],
  credentials: true,
  exposedHeaders: ['X-Session-Warning']
}));
```

### Frontend (app.js)

**1. Lägg till MSAL i index.html:**

```html
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>Värderingsdata CRM</title>
  
  <!-- Azure AD B2C MSAL Library -->
  <script src="https://alcdn.msauth.net/browser/2.38.0/js/msal-browser.min.js"></script>
  
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <!-- UI här -->
  
  <!-- Auth module -->
  <script src="auth-azure-b2c.js"></script>
  
  <!-- Main app -->
  <script src="app.js"></script>
  
  <script>
    // Initialisera Azure B2C vid sidladdning
    initializeAzureAuth();
  </script>
</body>
</html>
```

**2. Uppdatera app.js:**

```javascript
// ============================================
// AZURE B2C INITIALIZATION
// ============================================

async function initializeAzureAuth() {
  // Konfiguration från backend eller hårdkodat
  const config = {
    auth: {
      clientId: 'your-frontend-client-id',
      authority: 'https://varderingsdata.b2clogin.com/varderingsdata.onmicrosoft.com/B2C_1_signup_signin',
      knownAuthorities: ['varderingsdata.b2clogin.com']
    }
  };

  const initialized = await azureAuth.initialize(config);
  
  if (initialized && azureAuth.isAuthenticated()) {
    // Användare redan inloggad
    await onAzureLoginSuccess();
  } else {
    // Visa login-sida
    showLoginPage();
  }
}

// Lysssna på login events
window.addEventListener('azure-b2c-login', async (event) => {
  await onAzureLoginSuccess();
});

async function onAzureLoginSuccess() {
  const user = azureAuth.getUser();
  console.log('Logged in as:', user.name, user.email);
  
  // Sätt användare i AppState
  AppState.currentUser = {
    username: user.email,
    name: user.name,
    email: user.email,
    roles: user.roles,
    azureId: user.id
  };
  
  // Ladda data
  await loadState();
  
  // Visa main UI
  showMainUI();
}

// ============================================
// UPPDATERA LOGIN/LOGOUT FUNCTIONS
// ============================================

// Ersätt befintlig login() funktion:
async function login() {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  // Alternativ 1: Azure B2C Login (rekommenderat)
  if (USE_AZURE_B2C) {
    try {
      await azureAuth.login();
      // onAzureLoginSuccess() körs automatiskt efter lyckad login
    } catch (error) {
      showNotification('Inloggning misslyckades: ' + error.message, 'error');
    }
    return;
  }

  // Alternativ 2: Legacy local auth (backup)
  // ... befintlig kod ...
}

// Ersätt befintlig logout() funktion:
async function logout() {
  if (USE_AZURE_B2C && azureAuth.isAuthenticated()) {
    await azureAuth.logout();
  }
  
  // Rensa local state
  AppState.currentUser = null;
  localStorage.removeItem('authToken');
  sessionStorage.clear();
  
  showLoginPage();
}

// ============================================
// UPPDATERA API CALLS
// ============================================

// Ersätt befintlig saveState() och andra API-anrop:

async function saveState() {
  if (!AppState.currentUser) return;

  try {
    // Använd Azure B2C authenticated fetch
    const response = await azureAuth.authenticatedFetch(API_BASE_URL + '/save', {
      method: 'POST',
      body: JSON.stringify({
        companies: state.companies,
        agents: state.agents,
        brands: state.brands
      })
    });

    if (!response.ok) {
      throw new Error('Save failed: ' + response.statusText);
    }

    const data = await response.json();
    console.log('State saved:', data);

    // Kontrollera session warning
    const sessionWarning = response.headers.get('X-Session-Warning');
    if (sessionWarning) {
      const minutesLeft = parseInt(sessionWarning);
      showNotification(`Din session går ut om ${minutesLeft} minuter`, 'warning');
    }

  } catch (error) {
    console.error('Save error:', error);
    showNotification('Kunde inte spara: ' + error.message, 'error');
  }
}

async function loadState() {
  try {
    const response = await azureAuth.authenticatedFetch(API_BASE_URL + '/state');
    
    if (!response.ok) {
      throw new Error('Load failed');
    }

    const data = await response.json();
    
    state.companies = data.companies || [];
    state.agents = data.agents || [];
    state.brands = data.brands || [];
    
    renderCurrentView();

  } catch (error) {
    console.error('Load error:', error);
    showNotification('Kunde inte ladda data: ' + error.message, 'error');
  }
}

// Helper för att göra authenticated API calls
async function apiCall(endpoint, options = {}) {
  try {
    const response = await azureAuth.authenticatedFetch(
      API_BASE_URL + endpoint,
      options
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();

  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// ============================================
// ROLLBASERAD ÅTKOMSTKONTROLL
// ============================================

// Kontrollera om användare har roll
function hasRole(role) {
  return azureAuth.hasRole(role);
}

// Visa/dölj UI baserat på roller
function updateUIForRoles() {
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const isSales = hasRole('sales');

  // Exempel: Visa admin-knappar endast för admins
  const adminButtons = document.querySelectorAll('.admin-only');
  adminButtons.forEach(btn => {
    btn.style.display = isAdmin ? 'block' : 'none';
  });

  // GDPR menu: alla inloggade
  const gdprMenu = document.getElementById('gdprMenu');
  if (gdprMenu) {
    gdprMenu.style.display = azureAuth.isAuthenticated() ? 'block' : 'none';
  }

  // Data enrichment: endast admin eller manager
  const enrichButton = document.getElementById('enrichButton');
  if (enrichButton) {
    enrichButton.style.display = (isAdmin || isManager) ? 'block' : 'none';
  }

  // Delete operations: endast admin
  document.querySelectorAll('.delete-button').forEach(btn => {
    btn.disabled = !isAdmin;
    if (!isAdmin) {
      btn.title = 'Endast administratörer kan radera';
    }
  });
}

// Kör vid login
async function onAzureLoginSuccess() {
  const user = azureAuth.getUser();
  
  AppState.currentUser = {
    username: user.email,
    name: user.name,
    email: user.email,
    roles: user.roles,
    azureId: user.id
  };
  
  await loadState();
  updateUIForRoles(); // Uppdatera UI baserat på roller
  showMainUI();
}
```

---

## 🎯 Användarroller (Best Practices)

### Definiera roller i Azure AD B2C:

1. **Admin**
   - Full åtkomst
   - Kan radera data
   - Kan hantera användare
   - Kan se audit logs

2. **Manager**
   - Kan se alla data
   - Kan köra data enrichment
   - Kan exportera rapporter
   - Kan INTE radera

3. **Sales**
   - Kan se och redigera companies/agents
   - Kan INTE radera
   - Kan INTE se GDPR-funktioner
   - Kan INTE köra enrichment

### Backend exempel:

```javascript
// Alla autentiserade
app.get('/api/companies', requireAzureAuth(), getCompanies);

// Endast Sales+
app.post('/api/companies', requireRole('sales', 'manager', 'admin'), createCompany);
app.put('/api/companies/:id', requireRole('sales', 'manager', 'admin'), updateCompany);

// Endast Manager+
app.post('/api/enrich', requireRole('manager', 'admin'), enrichData);
app.get('/api/reports', requireRole('manager', 'admin'), getReports);

// Endast Admin
app.delete('/api/companies/:id', requireRole('admin'), deleteCompany);
app.get('/api/gdpr/audit-log', requireRole('admin'), getAuditLog);
app.post('/api/users/assign-role', requireRole('admin'), assignRole);
```

---

## 🧪 Testing

### Test Login Flow:

1. Öppna `http://localhost:3000`
2. Klicka "Logga in"
3. Omdirigeras till Azure B2C login-sida
4. Logga in med testanvändare
5. Omdirigeras tillbaka till app
6. Kontrollera att `req.user` finns på backend

### Test API Protection:

```bash
# Utan token - ska få 401
curl http://localhost:3000/api/companies

# Med token - ska fungera
curl -H "Authorization: Bearer <your-token>" http://localhost:3000/api/companies

# Med fel token - ska få 401
curl -H "Authorization: Bearer invalid-token" http://localhost:3000/api/companies
```

---

## 🔄 Migration från Local Auth till Azure B2C

### Steg 1: Dual Mode (rekommenderat för övergång)

```javascript
const USE_AZURE_B2C = true; // Sätt till true för Azure B2C

async function login() {
  if (USE_AZURE_B2C) {
    await azureAuth.login();
  } else {
    // Legacy local auth
    await loginLocal();
  }
}

// Backend: Stöd båda auth methods
app.use((req, res, next) => {
  // Försök Azure B2C först
  requireAzureAuth()(req, res, (err) => {
    if (req.user) {
      return next();
    }
    
    // Fallback: local auth
    requireAuth(req, res, next);
  });
});
```

### Steg 2: Migrera användare

```javascript
// Skapa användare i Azure B2C från befintliga
async function migrateUsersToAzureB2C() {
  // Hämta lokala användare från auth.json
  const localUsers = JSON.parse(fs.readFileSync('auth.json', 'utf8'));
  
  for (const user of localUsers.users) {
    console.log(`Migrera ${user.username}...`);
    // Skicka mail med instruktioner att registrera sig i Azure B2C
    // ELLER använd Azure B2C Graph API för att skapa användare programmatiskt
  }
}
```

### Steg 3: Full cutover

När alla användare migrerat:

```javascript
// Ta bort USE_AZURE_B2C flag
// Ta bort local auth kod
// Ta bort auth.json
```

---

## 📊 Monitoring & Logs

### Application Insights

```javascript
const appInsights = require('applicationinsights');
appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY);
appInsights.start();

// Logga autentiseringar
appInsights.defaultClient.trackEvent({
  name: 'UserLogin',
  properties: {
    userId: req.user.id,
    email: req.user.email,
    roles: req.user.roles.join(',')
  }
});

// Logga API calls
appInsights.defaultClient.trackRequest({
  name: req.method + ' ' + req.path,
  url: req.url,
  duration: duration,
  resultCode: res.statusCode,
  success: res.statusCode < 400,
  properties: {
    userId: req.user?.id
  }
});
```

---

## ❓ Felsökning

### Problem: "MSAL is not defined"

**Lösning:** Lägg till MSAL script i `index.html`:
```html
<script src="https://alcdn.msauth.net/browser/2.38.0/js/msal-browser.min.js"></script>
```

### Problem: "Invalid issuer"

**Lösning:** Kontrollera att `issuer` i backend matchar Azure B2C tenant:
```javascript
// Rätt format:
https://yourtenantname.b2clogin.com/tenant-guid/v2.0/
```

### Problem: "CORS error"

**Lösning:** Lägg till Azure B2C domain i CORS:
```javascript
app.use(cors({
  origin: ['https://yourtenantname.b2clogin.com', 'http://localhost:3000']
}));
```

### Problem: "Token validation failed"

**Lösning:** 
1. Kontrollera att `clientId` matchar backend app registration
2. Kontrollera att scopes är korrekt konfigurerade
3. Kontrollera att token inte har gått ut

---

## 🎉 Klart!

Nu har du:
- ✅ Azure AD B2C authentication
- ✅ JWT token validation
- ✅ Rollbaserad åtkomstkontroll
- ✅ Säker session management
- ✅ Production-ready deployment

Behöver du hjälp? Kolla AZURE_DEPLOYMENT_GUIDE.md för deployment till Azure!
