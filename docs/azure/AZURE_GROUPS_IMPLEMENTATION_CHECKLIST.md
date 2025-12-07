# ✅ Azure AD Groups Implementation Checklista

## Status: Kod implementerad - Klar för konfiguration

Alla nödvändiga filer är skapade. Följ denna checklista för att aktivera gruppbaserad rollhantering.

## 📋 Azure Portal Setup

### 1. Skapa Säkerhetsgrupper

I Azure Portal → Azure Active Directory → Groups:

- [ ] **CRM-Admin** 
  - Typ: Security
  - Beskrivning: "CRM Administratörer - Full åtkomst"
  - Kopiera Object ID: `_________________`

- [ ] **CRM-Manager**
  - Typ: Security  
  - Beskrivning: "CRM Managers - Rapporter och analys"
  - Kopiera Object ID: `_________________`

- [ ] **CRM-Sales**
  - Typ: Security
  - Beskrivning: "CRM Säljare - Grundläggande funktioner"
  - Kopiera Object ID: `_________________`

- [ ] **CRM-Viewer**
  - Typ: Security
  - Beskrivning: "CRM Läsare - Endast läsåtkomst"
  - Kopiera Object ID: `_________________`

### 2. Lägg till Testanvändare i Grupper

- [ ] Lägg till dig själv i CRM-Admin gruppen
- [ ] Lägg till testanvändare i olika grupper för testing
- [ ] Verifiera medlemskap i Azure Portal

### 3. Konfigurera App Registration för Groups Claims

#### Backend App Registration:
- [ ] Azure Portal → App registrations → [Din backend app]
- [ ] Token configuration → Add groups claim
- [ ] Välj "Security groups"
- [ ] Format: "Group ID" 
- [ ] Spara

#### Frontend App Registration:
- [ ] Azure Portal → App registrations → [Din frontend app]
- [ ] Token configuration → Add groups claim  
- [ ] Välj "Security groups"
- [ ] Format: "Group ID"
- [ ] Spara

### 4. Graph API Permissions (om inte redan gjort)

Backend App Registration:
- [ ] API permissions → Add permission
- [ ] Microsoft Graph → Application permissions
- [ ] Group.Read.All ✓
- [ ] User.Read.All ✓
- [ ] Grant admin consent

## 🔧 Backend Konfiguration

### 5. Environment Variables

```bash
cd server
cp .env.example .env
```

Redigera `.env` och lägg till dina Group IDs:

```env
# Azure AD Groups för Rollhantering
AZURE_AD_GROUP_ADMIN=12345678-1234-1234-1234-123456789abc
AZURE_AD_GROUP_MANAGER=23456789-2345-2345-2345-234567890bcd
AZURE_AD_GROUP_SALES=34567890-3456-3456-3456-345678901cde
AZURE_AD_GROUP_VIEWER=45678901-4567-4567-4567-456789012def

# Enable group-based roles
USE_AZURE_AD_GROUPS=true

# Befintliga Azure B2C settings
AZURE_B2C_TENANT_NAME=varderingsdata
AZURE_B2C_TENANT_ID=your-tenant-id
AZURE_B2C_CLIENT_ID=your-client-id
AZURE_B2C_CLIENT_SECRET=your-client-secret

# Graph API (för grupphantering)
AZURE_B2C_GRAPH_CLIENT_ID=your-graph-client-id
AZURE_B2C_GRAPH_CLIENT_SECRET=your-graph-client-secret
```

- [ ] Group IDs uppdaterade med rätt värden
- [ ] USE_AZURE_AD_GROUPS=true satt
- [ ] Graph API credentials konfigurerade

### 6. Uppdatera Backend Code

**server/index.js** - Ersätt auth middleware:

```javascript
// Byt från gamla middleware till gruppbaserade:
const {
  requireAzureAuth,
  requireRole,
  requireAdmin,
  requireManager,
  requireSales
} = require('./auth-azure-groups-middleware');

const AzureGroupsService = require('./azure-groups-service');
const groupsService = new AzureGroupsService();
```

**server/index.js** - Uppdatera API endpoints:

```javascript
// Alla autentiserade (viewer+)
app.get('/api/companies', requireAzureAuth(), (req, res) => {
  res.json(state.companies);
});

// Sales+ behörigheter
app.post('/api/companies', requireSales(), (req, res) => { /*...*/ });
app.put('/api/companies/:id', requireSales(), (req, res) => { /*...*/ });

// Manager+ behörigheter
app.get('/api/reports', requireManager(), (req, res) => { /*...*/ });
app.post('/api/enrich', requireManager(), (req, res) => { /*...*/ });

// Admin-only behörigheter
app.delete('/api/companies/:id', requireAdmin(), (req, res) => { /*...*/ });
app.get('/api/audit-log', requireAdmin(), (req, res) => { /*...*/ });

// Group management endpoints
app.get('/api/user/groups', requireAzureAuth(), async (req, res) => {
  try {
    const userGroups = await groupsService.getUserGroups(req.user.id);
    res.json({ groups: userGroups });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get groups' });
  }
});

app.post('/api/admin/users/:userId/groups/:groupId', requireAdmin(), async (req, res) => {
  try {
    await groupsService.addUserToGroup(req.params.userId, req.params.groupId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add user to group' });
  }
});
```

- [ ] Gamla auth middleware ersatt med gruppbaserad
- [ ] AzureGroupsService importerad
- [ ] API endpoints uppdaterade med rollbaserade behörigheter
- [ ] Group management endpoints tillagda

### 7. Testa Backend

```bash
cd server
npm start
```

Kontrollera konsolen för:
- [ ] "Azure Groups Service: Successfully obtained access token"
- [ ] Inga gruppkonfigurationsfel
- [ ] Server startar utan fel

## 🎨 Frontend Konfiguration

### 8. Uppdatera Group Mappings

**client/azure-groups-helper.js** - Uppdatera Group IDs:

```javascript
const AZURE_GROUP_ROLES = {
  // Ersätt med dina faktiska Group IDs:
  '12345678-1234-1234-1234-123456789abc': 'admin',
  '23456789-2345-2345-2345-234567890bcd': 'manager',
  '34567890-3456-3456-3456-345678901cde': 'sales',
  '45678901-4567-4567-4567-456789012def': 'viewer'
};
```

- [ ] Group IDs uppdaterade att matcha backend

### 9. Lägg till Script i HTML

**client/index.html** - Lägg till efter auth-azure-b2c.js:

```html
<!-- Azure B2C Authentication -->
<script src="auth-azure-b2c.js"></script>

<!-- Azure Groups Helper (🆕) -->
<script src="azure-groups-helper.js"></script>

<!-- Main application script -->
<script src="app.js"></script>
```

- [ ] azure-groups-helper.js tillagd i index.html

### 10. Uppdatera App.js

**client/app.js** - Ersätt Azure login success handler:

```javascript
// Ersätt befintlig onAzureLoginSuccess() med:
async function onAzureLoginSuccess() {
  await onAzureLoginSuccessWithGroups();
}

// Ersätt updateUIForRoles() med:
function updateUIForRoles() {
  updateUIForGroupRoles();
}
```

- [ ] onAzureLoginSuccess uppdaterad
- [ ] updateUIForRoles ersatt med gruppbaserad version

### 11. Lägg till HTML Classes för Rollbaserat UI

Lägg till CSS-klasser på element som ska vara rollbaserade:

```html
<!-- Admin-endast funktioner -->
<button class="admin-only">Ta bort</button>
<div class="admin-only">Admin-panel</div>

<!-- Manager+ funktioner -->
<button class="manager-plus">Rapporter</button>
<div class="manager-plus">Analys</div>

<!-- Sales+ funktioner -->
<button class="sales-plus">Skapa företag</button>
<div class="sales-plus">Redigera kontakter</div>

<!-- Require specific permissions -->
<button class="require-admin">Admin-funktion</button>
<button class="require-manager">Manager-funktion</button>
<button class="require-sales">Sales-funktion</button>
```

- [ ] CSS-klasser tillagda på relevanta element
- [ ] UI uppdateras baserat på roller

## 🧪 Testing

### 12. Grundläggande Test

1. **Backend Connection Test:**
```bash
cd server
node -e "
const AzureGroupsService = require('./azure-groups-service');
const service = new AzureGroupsService();
service.testConnection().then(result => console.log('Connection:', result));
"
```

- [ ] Connection test returnerar true

2. **Token Groups Test:**
- [ ] Logga in via frontend
- [ ] Öppna browser developer console
- [ ] Kör: `debugUserGroups()`
- [ ] Verifiera att grupper mappas till rätt roller

3. **API Authorization Test:**
```bash
# Test med token från inloggad användare
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/user/groups
```

- [ ] API returnerar användarens grupper
- [ ] Rollbaserade endpoints fungerar

### 13. Rollbaserat UI Test

- [ ] Logga in som Admin - se alla funktioner
- [ ] Logga in som Manager - se manager+ funktioner
- [ ] Logga in som Sales - se sales+ funktioner  
- [ ] Logga in som Viewer - se endast läsfunktioner

### 14. Group Management Test (Admin)

- [ ] Logga in som Admin
- [ ] Testa API för att lägga till användare i grupp
- [ ] Testa API för att ta bort användare från grupp
- [ ] Verifiera ändringar i Azure Portal

## 🔒 Security Validation

### 15. Security Checklist

- [ ] Token innehåller groups claim
- [ ] Backend validerar gruppmedlemskap
- [ ] Frontend döljer/visar UI baserat på roller
- [ ] API-endpoints skyddade med rätt rollkrav
- [ ] Felhantering för otillräckliga behörigheter
- [ ] Logging av behörighetsfel

### 16. Error Handling Test

- [ ] Försök komma åt admin-endpoint som Sales - får 403
- [ ] Försök komma åt manager-endpoint som Viewer - får 403
- [ ] Ogiltig token - får 401
- [ ] Ingen token - får 401

## 📊 Monitoring & Logs

### 17. Logging Setup

Backend loggar att kontrollera:
- [ ] "User groups from token: [...]"
- [ ] "Mapped roles: [...]" 
- [ ] "Primary role: [...]"
- [ ] Behörighetsfel loggas med användare och endpoint

Frontend console loggar:
- [ ] "Azure login successful"
- [ ] "User groups from token: [...]"
- [ ] "Mapped roles: [...]"
- [ ] "Updating UI for roles"

## 🎉 Production Deployment

### 18. Production Checklist

- [ ] Environment variables konfigurerade i production
- [ ] Azure B2C konfigurerad för production domain
- [ ] Group claims aktiverade i production app registrations
- [ ] HTTPS aktiverat
- [ ] Error handling och logging aktiverat
- [ ] Performance monitoring för Graph API calls

### 19. User Training

- [ ] Dokumentera nya rollsystem för användare
- [ ] Instruktioner för administratörer om grupphantering
- [ ] Fallback-procedurer om Azure är nere

## 🔄 Maintenance

### 20. Ongoing Tasks

- [ ] Övervaka Graph API rate limits
- [ ] Regelbunden synkronisering av gruppmedlemskap
- [ ] Uppdatera gruppkonfiguration vid organisationsändringar
- [ ] Audit trail för gruppändringar

---

## ⚠️ Viktiga Noter

1. **Group IDs:** Dubbelkolla att Group IDs är rätt i både backend och frontend
2. **Token Claims:** Groups claims måste vara aktiverade i båda app registrations
3. **Permissions:** Graph API permissions måste ha admin consent
4. **Testing:** Testa med användare i olika grupper
5. **Fallback:** Ha en plan om Azure är otillgängligt

## 📞 Support

Om problem uppstår:
1. Kontrollera Azure Portal-konfiguration
2. Verifiera Group IDs i environment variables
3. Kontrollera console-loggar för gruppinformation
4. Testa Graph API permissions med Graph Explorer
5. Verifiera token innehåll på jwt.ms

---

**Status:** ✅ Kod implementerad - Redo för konfiguration
**Nästa steg:** Konfigurera Azure Portal och uppdatera environment variables