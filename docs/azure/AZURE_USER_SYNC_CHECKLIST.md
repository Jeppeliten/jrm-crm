# ✅ Azure B2C User Sync - Setup Checklist

Använd denna checklista för att konfigurera automatisk användarsynkronisering.

---

## 📋 Pre-requisites

- [ ] Azure AD B2C tenant skapad
- [ ] Backend körs på Node.js
- [ ] CRM använder Azure B2C för authentication

---

## 🔧 Backend Setup

### 1. Dependencies
- [ ] `npm install` körts i `server/` katalogen
- [ ] Paketen finns: `express`, `cors`, `dotenv`

### 2. Environment Variables

Öppna `server/.env` och lägg till:

```env
# Azure B2C User Sync
AZURE_B2C_TENANT_ID=your-tenant-id.onmicrosoft.com
AZURE_B2C_GRAPH_CLIENT_ID=your-graph-api-client-id
AZURE_B2C_GRAPH_CLIENT_SECRET=your-graph-api-client-secret
AZURE_B2C_WEBHOOK_SECRET=your-random-secret-min-32-chars

# Features
ENABLE_AZURE_B2C_USER_SYNC=true
ENABLE_AUTO_USER_SYNC=true
USER_SYNC_INTERVAL_MINUTES=15
```

Checklist:
- [ ] `AZURE_B2C_TENANT_ID` satt
- [ ] `AZURE_B2C_GRAPH_CLIENT_ID` satt
- [ ] `AZURE_B2C_GRAPH_CLIENT_SECRET` satt
- [ ] `AZURE_B2C_WEBHOOK_SECRET` genererad (min 32 chars)
- [ ] Features enabled

---

## 🔑 Azure Portal Setup

### 1. Skapa App Registration för Graph API

**Steg:**
1. [ ] Gå till Azure Portal → App registrations
2. [ ] Klicka "New registration"
3. [ ] Namn: "CRM-GraphAPI-Client"
4. [ ] Account type: "Single tenant"
5. [ ] Klicka "Register"

**API Permissions:**
6. [ ] Gå till "API permissions"
7. [ ] Klicka "Add a permission"
8. [ ] Välj "Microsoft Graph"
9. [ ] Välj "Application permissions"
10. [ ] Lägg till:
   - [ ] `User.Read.All`
   - [ ] `Directory.Read.All`
11. [ ] Klicka "Grant admin consent" ✓

**Client Secret:**
12. [ ] Gå till "Certificates & secrets"
13. [ ] Klicka "New client secret"
14. [ ] Description: "CRM User Sync"
15. [ ] Expires: 24 months
16. [ ] Klicka "Add"
17. [ ] **KOPIERA värdet omedelbart** (visas endast en gång!)

**Kopiera värden till .env:**
18. [ ] Client ID → `AZURE_B2C_GRAPH_CLIENT_ID`
19. [ ] Client Secret → `AZURE_B2C_GRAPH_CLIENT_SECRET`

---

### 2. Konfigurera Custom Attributes (Optional men rekommenderat)

**Steg:**
1. [ ] Gå till Azure AD B2C → User attributes
2. [ ] Klicka "Add"
3. [ ] Skapa attribut:
   - [ ] `CompanyId` (String)
   - [ ] `Role` (String)
   - [ ] `IsActive` (Boolean)

**Lägg till i User Flow:**
4. [ ] Gå till User flows → B2C_1_signup_signin
5. [ ] Klicka "User attributes"
6. [ ] Markera:
   - [ ] Given Name
   - [ ] Surname
   - [ ] Email Address
   - [ ] Job Title
   - [ ] Company Name (eller custom CompanyId)
7. [ ] Klicka "Application claims"
8. [ ] Markera samma attribut som ovan + User's Object ID
9. [ ] Klicka "Save"

---

### 3. Webhook Setup (Optional - för real-time sync)

**Endast om du vill ha webhook-baserad sync (avancerat):**

1. [ ] Skapa Custom Policy i Azure AD B2C
2. [ ] Lägg till webhook-anrop i SignUp orchestration
3. [ ] Konfigurera webhook URL: `https://your-backend.com/api/webhooks/b2c/user-created`
4. [ ] Lägg till API key header med `AZURE_B2C_WEBHOOK_SECRET`

**OBS:** Detta kräver Azure AD B2C Premium. Hoppa över detta steg om du använder polling-metoden.

---

## 🚀 Testing

### 1. Test Backend Connection

```bash
# Starta backend
cd server
npm start

# Kontrollera logs
# Du bör se: "Initializing Azure B2C User Synchronization..."
```

Checklist:
- [ ] Backend startar utan errors
- [ ] User sync initialiseras
- [ ] Polling startar (om `ENABLE_AUTO_USER_SYNC=true`)

### 2. Test Manual Sync

**Terminal:**
```bash
# Hämta admin token (från frontend efter login)
TOKEN="your-admin-jwt-token"

# Test manuell sync
curl -X POST http://localhost:3000/api/users/sync-from-b2c \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "full"}'
```

**Förväntat resultat:**
```json
{
  "success": true,
  "created": 5,
  "updated": 0,
  "total": 5,
  "syncTime": "2025-10-08T12:30:00Z"
}
```

Checklist:
- [ ] Sync körs utan errors
- [ ] Användare skapas i CRM
- [ ] `state.users[]` innehåller data

### 3. Test User Creation Flow

**Steg:**
1. [ ] Gå till Azure B2C signup-sida
2. [ ] Registrera en testanvändare:
   - Namn: Test Testsson
   - E-post: test@example.com
   - Företag: ERA Malmö (eller något som finns i CRM)
3. [ ] Slutför registreringen

**Vänta:**
- Med webhooks: < 1 sekund
- Med polling: < 15 minuter
- Manuellt: Kör sync manuellt

**Verifiera:**
4. [ ] Öppna CRM-gränssnittet
5. [ ] Navigera till "Användare"
6. [ ] Kontrollera att testanvändaren syns
7. [ ] Kontrollera att användaren är kopplad till rätt företag (om det finns)

---

## 🎨 Frontend Integration

### 1. Lägg till Users View

**I `app.js`:**

```javascript
// Lägg till i AppState
AppState.users = [];
AppState.currentView = 'companies'; // lägg till 'users' som option

// Lägg till funktioner (se AZURE_USER_SYNC_GUIDE.md)
async function loadUsers() { ... }
function renderUsersTable() { ... }
async function syncUsersFromB2C(mode) { ... }
async function linkUsersToCompanies() { ... }
```

Checklist:
- [ ] `loadUsers()` funktion tillagd
- [ ] `renderUsersTable()` funktion tillagd
- [ ] `syncUsersFromB2C()` funktion tillagd
- [ ] `linkUsersToCompanies()` funktion tillagd

### 2. Lägg till UI

**I `index.html`:**

```html
<div id="usersView" style="display: none;">
  <h2>👥 Användare</h2>
  
  <div class="action-buttons">
    <button class="admin-only" onclick="syncUsersFromB2C('new')">
      ↻ Synka nya
    </button>
    <button class="admin-only" onclick="syncUsersFromB2C('full')">
      ⟳ Full synk
    </button>
    <button class="admin-only" onclick="linkUsersToCompanies()">
      🔗 Koppla till företag
    </button>
  </div>
  
  <table id="usersTable">
    <thead>
      <tr>
        <th>Namn</th>
        <th>E-post</th>
        <th>Roll</th>
        <th>Företag</th>
        <th>Status</th>
        <th>Källa</th>
      </tr>
    </thead>
    <tbody id="usersTableBody"></tbody>
  </table>
</div>
```

Checklist:
- [ ] Users view tillagt
- [ ] Knappar för sync tillagda
- [ ] Tabell för användarlista tillagd
- [ ] Admin-only restriktioner satta

### 3. Lägg till Navigation

```javascript
// I navigation function
function showView(viewName) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  
  // Show selected view
  if (viewName === 'users') {
    document.getElementById('usersView').style.display = 'block';
    loadUsers();
  }
  // ... andra views
}
```

Checklist:
- [ ] Navigation uppdaterad
- [ ] "Användare" länk tillagd i menyn
- [ ] `showView('users')` fungerar

---

## 📊 Monitoring Setup

### 1. Kontrollera Sync Status

**URL:** `http://localhost:3000/api/users/sync-status`

**Förväntat resultat:**
```json
{
  "lastSyncTime": "2025-10-08T12:30:00Z",
  "autoSyncEnabled": true,
  "totalUsers": 50,
  "b2cUsers": 25
}
```

Checklist:
- [ ] Endpoint svarar
- [ ] `lastSyncTime` uppdateras efter sync
- [ ] `autoSyncEnabled` är `true` om polling är aktivt
- [ ] Antal användare stämmer

### 2. Kontrollera Audit Logs

**Fil:** `server/audit.log`

**Förväntat innehåll:**
```json
{"ts":"2025-10-08T12:30:00Z","action":"b2c_user_synced","entityType":"user",...}
```

Checklist:
- [ ] Audit logs skapas vid sync
- [ ] Innehåller rätt information
- [ ] Timestamps är korrekta

---

## 🔒 Security Checklist

- [ ] `AZURE_B2C_WEBHOOK_SECRET` är minst 32 tecken långt
- [ ] `AZURE_B2C_GRAPH_CLIENT_SECRET` är säkert lagrad (inte i git)
- [ ] `.env` fil är i `.gitignore`
- [ ] Webhook signature verification är aktiverad (om webhooks används)
- [ ] Admin-only endpoints kräver `requireRole('admin')` middleware
- [ ] HTTPS används i production
- [ ] CORS är korrekt konfigurerad

---

## 📈 Performance Checklist

- [ ] Polling interval är rimlig (15 min default)
- [ ] Graph API rate limiting övervakas
- [ ] Endast nya användare synkas vid polling (inte full sync varje gång)
- [ ] Database/state sparas effektivt
- [ ] Audit logs roteras regelbundet

---

## 🎯 Production Deployment

### Pre-deployment:

- [ ] Alla environment variables satta i production
- [ ] Graph API credentials verifierade
- [ ] Webhook URL uppdaterad till production URL
- [ ] HTTPS certifikat installerat
- [ ] Firewall tillåter Azure B2C IP-adresser

### Post-deployment:

- [ ] Test user creation flow i production
- [ ] Verifiera att användare synkas korrekt
- [ ] Kontrollera Application Insights för errors
- [ ] Sätt upp alerts för sync failures
- [ ] Dokumentera för team

---

## ❓ Troubleshooting

### Problem: "Failed to get Graph API access token"

**Lösning:**
- [ ] Kontrollera `AZURE_B2C_GRAPH_CLIENT_ID`
- [ ] Kontrollera `AZURE_B2C_GRAPH_CLIENT_SECRET`
- [ ] Verifiera API permissions i Azure Portal
- [ ] Kontrollera att admin consent är granted

### Problem: "No users synced"

**Lösning:**
- [ ] Kontrollera att användare finns i Azure B2C
- [ ] Kontrollera filter i Graph API query
- [ ] Verifiera att `lastSyncTime` är korrekt
- [ ] Testa med `mode: "full"` istället för `mode: "new"`

### Problem: "User not linked to company"

**Lösning:**
- [ ] Kontrollera att företag finns i `state.companies[]`
- [ ] Kontrollera att company name matchar
- [ ] Kör `POST /api/users/link-to-companies` manuellt
- [ ] Verifiera matchningslogik i `linkUsersToCompanies()`

### Problem: "Webhook not triggering"

**Lösning:**
- [ ] Kontrollera webhook URL är tillgänglig (testa med curl)
- [ ] Verifiera att custom policy är korrekt konfigurerad
- [ ] Kontrollera Azure B2C logs för webhook errors
- [ ] Fallback till polling-metoden

---

## ✅ Final Verification

**Backend:**
- [ ] Server startar utan errors
- [ ] User sync initialiseras
- [ ] Endpoints svarar korrekt

**Frontend:**
- [ ] Users view visas
- [ ] Användare listas korrekt
- [ ] Sync-knappar fungerar (för admin)

**Integration:**
- [ ] Ny användare i B2C → Syns i CRM
- [ ] Användare kopplas till företag automatiskt
- [ ] Audit logs skapas

**Production:**
- [ ] HTTPS aktivt
- [ ] Secrets säkrade
- [ ] Monitoring aktivt
- [ ] Team informerat

---

## 🎉 Success!

När alla checkboxar är markerade har du:

✅ Automatisk användarsynkronisering från Azure B2C  
✅ Real-time eller scheduled sync  
✅ Automatisk företagskoppling  
✅ Full audit trail  
✅ Production-ready implementation  

**Nästa steg:** Se [AZURE_USER_SYNC_GUIDE.md](AZURE_USER_SYNC_GUIDE.md) för användning och underhåll.
