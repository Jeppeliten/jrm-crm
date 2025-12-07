# 👥 Azure B2C User Synchronization Guide

## 📖 Översikt

Detta system synkroniserar automatiskt användare från Azure AD B2C till CRM:et när nya fastighetsmäklare registrerar sig för er tjänst.

## 🎯 Användningsfall

### Scenario: Ny mäklare registrerar sig
```
1. Mäklare går till er tjänst → Klickar "Registrera"
2. Omdirigeras till Azure B2C signup-sida
3. Fyller i: Namn, E-post, Företag, Telefon
4. Skapar konto i Azure B2C
   ↓
5. AUTOMATISK SYNKRONISERING:
   - Webhook triggas → CRM får meddelande
   - Användare läggs till i CRM.users[]
   - Försök koppla till befintligt företag i CRM
   - Användaren syns direkt i CRM-gränssnittet
```

---

## 🔄 Tre synkroniseringsmetoder

### **Metod 1: Webhooks (Rekommenderat) - Real-time**

Azure B2C skickar en webhook när ny användare skapas.

**Fördelar:**
- ✅ Omedelbar synkronisering (< 1 sekund)
- ✅ Ingen polling behövs
- ✅ Minimal belastning

**Setup:**

1. **Azure Portal → Azure AD B2C → Custom policies**

Skapa custom policy för att trigga webhook vid user creation:

```xml
<TechnicalProfile Id="SendUserCreatedWebhook">
  <DisplayName>Send webhook on user creation</DisplayName>
  <Protocol Name="Proprietary" Handler="Web.TPEngine.Providers.RestfulProvider, Web.TPEngine, Version=1.0.0.0" />
  <Metadata>
    <Item Key="ServiceUrl">https://your-crm-backend.azurewebsites.net/api/webhooks/b2c/user-created</Item>
    <Item Key="SendClaimsIn">Body</Item>
    <Item Key="AuthenticationType">ApiKeyHeader</Item>
    <Item Key="ApiKey">your-webhook-secret-key</Item>
  </Metadata>
  <InputClaims>
    <InputClaim ClaimTypeReferenceId="objectId" PartnerClaimType="userId" />
    <InputClaim ClaimTypeReferenceId="email" />
    <InputClaim ClaimTypeReferenceId="givenName" />
    <InputClaim ClaimTypeReferenceId="surname" />
  </InputClaims>
</TechnicalProfile>
```

2. **Backend (.env):**

```env
AZURE_B2C_WEBHOOK_SECRET=your-random-secret-key-here
```

3. **Test webhook:**

```bash
curl -X POST https://your-backend.com/api/webhooks/b2c/user-created \
  -H "Content-Type: application/json" \
  -H "x-azure-signature: test-signature" \
  -d '{
    "userId": "test-user-id",
    "eventType": "user.created",
    "eventTime": "2025-10-08T12:00:00Z"
  }'
```

---

### **Metod 2: Microsoft Graph API Polling - Scheduled**

Backend kontrollerar med jämna mellanrum om det finns nya användare.

**Fördelar:**
- ✅ Enkel setup (ingen custom policy behövs)
- ✅ Fungerar utan webhook-konfiguration
- ✅ Automatisk background sync

**Nackdelar:**
- ❌ Fördröjning (15 minuter default)
- ❌ Mer API-anrop

**Setup:**

1. **Skapa App Registration för Graph API:**

```bash
# Azure Portal → App registrations → New registration
Namn: "CRM-GraphAPI-Client"
Supported account types: "Single tenant"
```

2. **API Permissions:**

```
Microsoft Graph:
  - User.Read.All (Application)
  - Directory.Read.All (Application)

Grant admin consent ✓
```

3. **Client Secret:**

```bash
# Certificates & secrets → New client secret
Description: "CRM User Sync"
Expires: 24 months
→ Kopiera värdet (visas endast en gång!)
```

4. **Environment Variables (.env):**

```env
# Graph API Credentials
AZURE_B2C_GRAPH_CLIENT_ID=your-graph-app-client-id
AZURE_B2C_GRAPH_CLIENT_SECRET=your-graph-app-client-secret

# Enable auto-sync
ENABLE_AUTO_USER_SYNC=true

# Polling interval (minuter)
USER_SYNC_INTERVAL_MINUTES=15
```

5. **Starta server:**

```bash
cd server
npm start

# Output:
# Starting auto-sync with 15 minute interval
# Checking for new users since 2025-10-08T10:00:00Z
```

---

### **Metod 3: Manuell Sync - On-demand**

Admin triggar synkronisering manuellt via CRM-gränssnittet.

**Användning:**

```javascript
// Full sync - hämta alla användare
POST /api/users/sync-from-b2c
{
  "mode": "full"
}

// New users only - endast nya sedan senaste sync
POST /api/users/sync-from-b2c
{
  "mode": "new"
}
```

---

## 🔧 Installation & Konfiguration

### 1. Backend Setup

```bash
cd server

# Installera dependencies (redan inkluderade)
npm install

# Konfigurera .env
nano .env
```

**Lägg till i .env:**

```env
# ============================================
# Azure B2C User Synchronization
# ============================================

# Graph API (för att hämta användare)
AZURE_B2C_TENANT_ID=your-tenant-guid.onmicrosoft.com
AZURE_B2C_GRAPH_CLIENT_ID=your-graph-api-client-id
AZURE_B2C_GRAPH_CLIENT_SECRET=your-graph-api-client-secret

# Webhook (optional, för real-time sync)
AZURE_B2C_WEBHOOK_SECRET=your-random-webhook-secret

# Enable features
ENABLE_AZURE_B2C_USER_SYNC=true
ENABLE_AUTO_USER_SYNC=true

# Polling interval (om inte webhooks används)
USER_SYNC_INTERVAL_MINUTES=15
```

### 2. Azure B2C Custom Attributes

För att lagra extra information om användare i B2C:

```bash
# Azure Portal → Azure AD B2C → User attributes → Add

Custom attributes:
  - CompanyId (string)
  - Role (string)
  - IsActive (boolean)
```

**Inkludera i User Flow:**

```bash
# Azure Portal → User flows → B2C_1_signup_signin → User attributes

Collect attributes:
  - Given Name ✓
  - Surname ✓
  - Email Address ✓
  - Job Title
  - Company Name (custom: CompanyId)
  
Return claims:
  - Given Name ✓
  - Surname ✓
  - Email Addresses ✓
  - Job Title ✓
  - User's Object ID ✓
  - CompanyId ✓
  - Role ✓
```

---

## 📊 API Endpoints

### Webhook Endpoint (för Azure B2C)

```javascript
POST /api/webhooks/b2c/user-created

Headers:
  x-azure-signature: <hmac-sha256-signature>

Body:
{
  "userId": "azure-b2c-object-id",
  "eventType": "user.created",
  "eventTime": "2025-10-08T12:00:00Z"
}

Response:
{
  "success": true,
  "action": "created",  // or "updated"
  "user": {
    "id": "b2c-xxx",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "sales"
  }
}
```

### Manuell Synkronisering (Admin only)

```javascript
POST /api/users/sync-from-b2c
Authorization: Bearer <admin-jwt-token>

Body:
{
  "mode": "full"  // or "new"
}

Response:
{
  "success": true,
  "created": 5,
  "updated": 2,
  "total": 7,
  "syncTime": "2025-10-08T12:30:00Z"
}
```

### Sync Status

```javascript
GET /api/users/sync-status

Response:
{
  "lastSyncTime": "2025-10-08T12:30:00Z",
  "autoSyncEnabled": true,
  "totalUsers": 150,
  "b2cUsers": 75
}
```

### Koppla användare till företag

```javascript
POST /api/users/link-to-companies
Authorization: Bearer <admin-jwt-token>

Response:
{
  "success": true,
  "linked": 12
}
```

### Lista användare

```javascript
GET /api/users

Response:
[
  {
    "id": "b2c-abc123",
    "name": "Anna Andersson",
    "email": "anna@era.se",
    "role": "sales",
    "companyId": "company-123",
    "companyName": "ERA Malmö",
    "isActive": true,
    "createdAt": "2025-10-08T10:00:00Z",
    "source": "azure-b2c"
  },
  ...
]
```

---

## 🎨 Frontend Integration

### Visa användare i CRM

```javascript
// app.js

// Ladda användare
async function loadUsers() {
  const response = await azureAuth.authenticatedFetch('/api/users');
  const users = await response.json();
  
  AppState.users = users;
  renderUsersTable();
}

// Rendera användartabell
function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';
  
  AppState.users.forEach(user => {
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
      <td>${sanitizeHTML(user.name)}</td>
      <td>${sanitizeHTML(user.email)}</td>
      <td>${sanitizeHTML(user.role)}</td>
      <td>${user.companyName || '-'}</td>
      <td>
        <span class="badge ${user.isActive ? 'badge-success' : 'badge-inactive'}">
          ${user.isActive ? 'Aktiv' : 'Inaktiv'}
        </span>
      </td>
      <td>
        <span class="badge badge-info">${user.source}</span>
      </td>
      <td>${new Date(user.createdAt).toLocaleDateString('sv-SE')}</td>
    `;
    
    tbody.appendChild(tr);
  });
}

// Admin: Synkronisera användare
async function syncUsersFromB2C(mode = 'new') {
  if (!hasRole('admin')) {
    showNotification('Endast administratörer kan synkronisera användare', 'error');
    return;
  }
  
  showNotification('Synkroniserar användare från Azure B2C...', 'info');
  
  try {
    const response = await azureAuth.authenticatedFetch('/api/users/sync-from-b2c', {
      method: 'POST',
      body: JSON.stringify({ mode })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification(
        `Synkronisering klar: ${result.created} nya, ${result.updated || 0} uppdaterade`,
        'success'
      );
      
      // Ladda om användarlistan
      await loadUsers();
    } else {
      showNotification('Synkronisering misslyckades: ' + result.error, 'error');
    }
    
  } catch (error) {
    console.error('Sync error:', error);
    showNotification('Synkronisering misslyckades', 'error');
  }
}

// Admin: Koppla användare till företag
async function linkUsersToCompanies() {
  if (!hasRole('admin')) return;
  
  showNotification('Kopplar användare till företag...', 'info');
  
  try {
    const response = await azureAuth.authenticatedFetch('/api/users/link-to-companies', {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.success) {
      showNotification(`${result.linked} användare kopplade till företag`, 'success');
      await loadUsers();
    }
    
  } catch (error) {
    console.error('Link error:', error);
    showNotification('Koppling misslyckades', 'error');
  }
}
```

### UI för user management

```html
<!-- Lägg till i index.html -->

<div id="usersView" style="display: none;">
  <div class="header-bar">
    <h2>👥 Användare</h2>
    
    <div class="action-buttons">
      <!-- Visa endast för Admin -->
      <button id="syncUsersBtn" class="btn btn-primary admin-only" onclick="syncUsersFromB2C('new')">
        ↻ Synkronisera nya användare
      </button>
      
      <button id="syncAllUsersBtn" class="btn btn-secondary admin-only" onclick="syncUsersFromB2C('full')">
        ⟳ Full synkronisering
      </button>
      
      <button id="linkUsersBtn" class="btn btn-info admin-only" onclick="linkUsersToCompanies()">
        🔗 Koppla till företag
      </button>
    </div>
  </div>
  
  <!-- Sync status -->
  <div id="syncStatus" class="info-box">
    <strong>Senaste synk:</strong> <span id="lastSyncTime">Aldrig</span> |
    <strong>Auto-synk:</strong> <span id="autoSyncStatus">Inaktiverad</span> |
    <strong>B2C-användare:</strong> <span id="b2cUserCount">0</span>
  </div>
  
  <!-- Users table -->
  <table class="data-table">
    <thead>
      <tr>
        <th>Namn</th>
        <th>E-post</th>
        <th>Roll</th>
        <th>Företag</th>
        <th>Status</th>
        <th>Källa</th>
        <th>Skapad</th>
      </tr>
    </thead>
    <tbody id="usersTableBody">
      <!-- Populated by JavaScript -->
    </tbody>
  </table>
</div>
```

### Visa sync status

```javascript
// Hämta och visa sync status
async function updateSyncStatus() {
  try {
    const response = await fetch('/api/users/sync-status');
    const status = await response.json();
    
    document.getElementById('lastSyncTime').textContent = 
      status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleString('sv-SE') : 'Aldrig';
    
    document.getElementById('autoSyncStatus').textContent = 
      status.autoSyncEnabled ? 'Aktiv (var 15:e minut)' : 'Inaktiverad';
    
    document.getElementById('b2cUserCount').textContent = status.b2cUsers;
    
  } catch (error) {
    console.error('Failed to get sync status:', error);
  }
}

// Uppdatera status var 30:e sekund
setInterval(updateSyncStatus, 30000);
```

---

## 🔗 Automatisk koppling till företag

Systemet försöker automatiskt koppla nya användare till befintliga företag i CRM baserat på företagsnamn.

### Matchningslogik:

```javascript
// Användare fyller i "ERA Malmö" vid registrering
// System hittar företag med name="ERA Malmö" i CRM
// → Sätter user.companyId = company.id
// → Uppdaterar även extension_CompanyId i Azure B2C
```

### Manuell koppling:

Om automatisk koppling misslyckas kan admin köra:

```javascript
POST /api/users/link-to-companies
```

Detta försöker koppla alla användare som saknar companyId till matchande företag.

---

## 📈 Monitoring & Logs

### Audit Logging

Alla user sync events loggas automatiskt:

```json
{
  "ts": "2025-10-08T12:30:00Z",
  "action": "b2c_user_synced",
  "entityType": "user",
  "entityId": "b2c-abc123",
  "userId": "system",
  "details": {
    "eventType": "user.created",
    "azureB2CId": "azure-object-id"
  }
}
```

### Application Insights

```javascript
// Tracked automatiskt om Application Insights är konfigurerat
appInsights.defaultClient.trackEvent({
  name: 'B2C_UserSynced',
  properties: {
    userId: user.id,
    email: user.email,
    companyId: user.companyId,
    source: 'webhook'  // eller 'polling' eller 'manual'
  }
});
```

---

## 🧪 Testing

### Test Webhook Lokalt

```bash
# 1. Starta ngrok (för att exponera localhost)
ngrok http 3000

# 2. Använd ngrok URL i Azure B2C webhook config
https://your-ngrok-url.ngrok.io/api/webhooks/b2c/user-created

# 3. Registrera testanvändare i Azure B2C
# 4. Kontrollera logs i terminalen
```

### Test Graph API

```bash
# Test manuell sync
curl -X POST http://localhost:3000/api/users/sync-from-b2c \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"mode": "full"}'

# Kontrollera status
curl http://localhost:3000/api/users/sync-status

# Lista användare
curl http://localhost:3000/api/users
```

---

## ⚙️ Avancerad konfiguration

### Custom User Mapping

Om du vill mappa fler fält från B2C till CRM:

```javascript
// server/azure-b2c-user-sync.js

mapB2CUserToCRM(b2cUser) {
  return {
    id: `b2c-${b2cUser.id}`,
    azureB2CId: b2cUser.id,
    
    // Standard fields
    username: email,
    email: email,
    name: b2cUser.displayName,
    
    // Custom extensions
    department: b2cUser.extension_Department,
    licenseNumber: b2cUser.extension_MaklareLicenseNumber,
    region: b2cUser.extension_Region,
    
    // Your custom logic
    isActive: b2cUser.extension_IsActive !== false,
    createdAt: b2cUser.createdDateTime
  };
}
```

### Filtering Users

Synkronisera endast användare med specifika villkor:

```javascript
// Endast aktiva användare
const activeUsers = await graphClient.getUsers(
  "extension_IsActive eq true"
);

// Endast användare från specifikt företag
const companyUsers = await graphClient.getUsers(
  "extension_CompanyId eq 'company-123'"
);
```

---

## 🔒 Säkerhet

### Webhook Signature Verification

**VIKTIGT:** Verifiera alltid webhook signatures i production!

```javascript
// .env
AZURE_B2C_WEBHOOK_SECRET=your-random-secret-min-32-chars

// Webhook måste inkludera HMAC-SHA256 signature i header
x-azure-signature: <signature>

// Backend verifierar automatiskt
```

### Rate Limiting

Implementera rate limiting för sync endpoints:

```javascript
const rateLimit = require('express-rate-limit');

const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 sync requests per 15 min
  message: 'Too many sync requests'
});

app.post('/api/users/sync-from-b2c', syncLimiter, ...);
```

---

## 📝 Sammanfattning

### ✅ Fördelar med automatisk användarsynk:

1. **Real-time registrering** - Nya mäklare syns direkt i CRM
2. **Automatisk företagskoppling** - Kopplas till befintliga företag
3. **Centraliserad hantering** - En enda källa för användare (Azure B2C)
4. **Enkel onboarding** - Mäklare registrerar sig själva
5. **Rollbaserad åtkomst** - Roller synkas från B2C

### 🎯 Rekommenderad setup:

- **Production:** Webhooks (real-time)
- **Staging:** Graph API polling (enklare test)
- **Development:** Manuell sync (full kontroll)

### 📊 Förväntat flöde:

```
Ny mäklare registrerar sig
  ↓ (< 1 sekund med webhook)
Användare skapas i CRM
  ↓ (automatisk matchning)
Kopplas till företag
  ↓
Synlig i CRM-gränssnittet
  ↓
Admin kan tilldela roller/åtkomst
```

---

**🎉 Nu har ni automatisk användarsynkronisering från Azure B2C till CRM!**

Användare som registrerar sig för er tjänst läggs automatiskt till i CRM-systemet.
