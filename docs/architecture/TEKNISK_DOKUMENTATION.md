# Teknisk Dokumentation - CRM-system

**Version:** 1.0  
**Datum:** 2025-10-10  
**Projekt:** Multi-segment CRM för fastighetsmäklare och banker

---

## Systemöversikt

### Arkitektur
- **Frontend:** Single-Page Application (SPA) i vanilla JavaScript
- **Backend:** Node.js Express server (frivillig - systemet fungerar även standalone)
- **Databas:** Ingen traditionell databas - JSON-baserad lagring
- **Deployment:** Statiska filer som kan serveras från vilken webbserver som helst

### Teknisk Stack
```
Frontend:
├── JavaScript (vanilla ES6+)
├── DaisyUI 4.12.10 (UI-komponenter)
├── Tailwind CSS (styling)
└── HTML5

Backend (optional):
├── Node.js
├── Express.js
├── bcryptjs (lösenordshashning)
├── XLSX (Excel-import)
└── cors (CORS-hantering)
```

---

## Datalagring

### 1. **Frontend-lagring (localStorage)**

**Nyckel:** `crm_prototype_state_v1`

**Datastruktur:**
```javascript
{
  users: [],           // Användare [{id, namn, roll}]
  currentUserId: null, // Inloggad användare
  brands: [],          // Varumärken [{id, namn, segmentId, centralContract}]
  companies: [],       // Företag [{id, namn, brandId, segmentId, stad, status, ...}]
  agents: [],          // Mäklare/rådgivare [{id, förnamn, efternamn, companyId, ...}]
  contacts: [],        // Beslutsfattare [{id, entityType, entityId, namn, ...}]
  tasks: [],           // Uppgifter [{id, title, ownerId, done, ...}]
  notes: [],           // Anteckningar [{id, entityType, entityId, text, ...}]
  segments: [],        // Segment [{id, name, icon, pricingModel, ...}]
  activeSegmentId: null // Aktivt filter-segment
}
```

**Lagringsstrategi:**
- All data lagras som JSON-sträng i `localStorage`
- Max storlek: ~5-10 MB (webbläsarbegränsning)
- Data persisteras automatiskt vid varje ändring via `saveState()`
- `undoStack` exkluderas från lagring för att spara utrymme

### 2. **Backend-lagring (optional)**

**Filer i `server/` katalogen:**

```
server/
├── state.json        # Huvuddata (synkroniserad med localStorage)
├── auth.json         # Autentiseringsdata (lösenordshashes)
├── audit.log         # Revisionslogg (GDPR-compliance)
└── gdpr.json         # GDPR-relaterad data
```

**state.json:**
- Samma struktur som localStorage
- Fungerar som central backup
- Synkroniseras automatiskt vid varje save

**auth.json:**
```javascript
{
  shared: {              // Delat admin-lösenord
    salt: "...",
    hash: "..."          // bcrypt hash
  },
  usersByUsername: {},   // Username -> credentials mapping
  usersById: {}          // UserId -> credentials mapping
}
```

**audit.log:**
- Append-only logg
- JSON Lines format (en JSON-rad per händelse)
- Innehåller: timestamp, action, userId, entityType, entityId
- Används för GDPR-compliance och säkerhetsgranskning

---

## Autentisering & Säkerhet

### 1. **Klient-autentisering (localStorage-mode)**

**Typ:** Enkel användarväxling (ingen lösenordsverifiering)

```javascript
function openLogin() {
  // Visar dropdown med tillgängliga användare
  // Användare väljer från lista
  AppState.currentUserId = selectedUserId;
  saveState();
}
```

**Standardanvändare:**
```javascript
[
  { id: 'u1', namn: 'Admin', roll: 'admin' },
  { id: 'u2', namn: 'Sara Sälj', roll: 'sales' },
  { id: 'u3', namn: 'Johan Sälj', roll: 'sales' }
]
```

**Begränsningar:**
- Ingen lösenordsskydd i standalone-mode
- Lämplig för: demo, prototyper, trusted environments
- Behörighetskontroll baserad på `roll` (admin/sales)

### 2. **Server-autentisering (när backend används)**

**Autentiseringsflöde:**

```
1. Client → POST /api/login
   {
     password: "...",
     username?: "...",  // Optional
     userId?: "..."     // Optional
   }

2. Server verifierar lösenord:
   - Delat lösenord (shared auth) ELLER
   - Användarspecifikt lösenord
   
3. Server skapar session:
   - Genererar session token (crypto.randomBytes)
   - Lagrar i in-memory Map
   - Returnerar HttpOnly cookie
   
4. Client lagrar cookie
   → Alla requests inkluderar cookie
   → Server validerar via requireAuth middleware
```

**Lösenordshantering:**

```javascript
// Hashning (bcrypt)
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

// Verifiering
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Legacy PBKDF2 (migration support)
function pbkdf2Hash(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
    .toString('hex');
}
```

**Standard credentials:**
- **Delat lösenord:** `admin`
- **Miljövariabel:** `ADMIN_PASSWORD` (production)

### 3. **Session Management**

**Konfiguration:**
```javascript
const SESSION_TIMEOUT = 30 * 60 * 1000;      // 30 minuter
const SESSION_WARNING_TIME = 5 * 60 * 1000;  // 5 minuters varning
```

**Session-struktur:**
```javascript
Map<token, {
  shared?: boolean,
  userId?: string,
  username?: string,
  lastActivity: timestamp
}>
```

**Features:**
- **Auto-timeout:** Sessions upphör efter 30 min inaktivitet
- **Activity tracking:** Varje request uppdaterar `lastActivity`
- **Warning header:** `X-Session-Warning` sätts 5 min före timeout
- **Automatic cleanup:** Timeout-sessions raderas automatiskt

**Cookie-konfiguration:**
```javascript
Set-Cookie: sid=<token>; 
  HttpOnly;           // XSS-skydd
  Path=/; 
  SameSite=Lax;       // CSRF-skydd
  Max-Age=604800;     // 7 dagar
  Secure              // Endast HTTPS (production)
```

### 4. **Behörighetskontroll**

**Middleware:**
```javascript
// Kräver autentisering
function requireAuth(req, res, next) {
  const sid = cookies.sid;
  if (!sid || !sessions.has(sid)) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  
  // Session timeout check
  if (now - session.lastActivity > SESSION_TIMEOUT) {
    return res.status(401).json({ error: 'session_timeout' });
  }
  
  next();
}

// Kräver admin-behörighet
function requireAdmin(req, res, next) {
  if (req.session?.shared) return next();        // Shared admin
  if (req.session?.userId === 'u1') return next(); // Built-in admin
  
  // Check user role in state
  const user = state.users.find(u => u.id === req.session.userId);
  if (user?.roll === 'admin') return next();
  
  return res.status(403).json({ error: 'forbidden' });
}
```

**Rollbaserad åtkomstkontroll:**
- **admin:** Full åtkomst, kan ta bort data, hantera användare
- **sales:** Läs/skriv till egen pipeline, begränsad deletion
- Kontrolleras i frontend via `currentUser()?.roll`

### 5. **XSS-skydd**

**Input sanitization:**
```javascript
function sanitizeHTML(input) {
  const temp = document.createElement('div');
  temp.textContent = input;  // Auto-escaping
  return temp.innerHTML;
}

function sanitizeInput(input) {
  return String(input || '').trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, ''); // Ta bort event handlers
}
```

**Output sanitization:**
- Använder DOM API istället för innerHTML där möjligt
- `textContent` för användardata
- Template literals escaped automatiskt i vissa kontexter

### 6. **CSRF-skydd**

**Åtgärder:**
- `SameSite=Lax` cookie attribute
- Credentials: 'include' i fetch requests
- Same-origin policy enforcement

### 7. **Audit Logging (GDPR)**

**Loggade händelser:**
```javascript
// Data access
logDataAccess('read', 'company', companyId, userId, { query });
logDataAccess('update', 'agent', agentId, userId, { fields });
logDataAccess('delete', 'brand', brandId, userId);

// Authentication
appendAudit({ type: 'login', userId, username });
appendAudit({ type: 'logout', userId });
appendAudit({ type: 'session_timeout', sessionId, userId });

// GDPR events
logGDPREvent('data_export', userId, { entities });
logGDPREvent('data_deletion', userId, { entityType, count });
```

**Audit log format:**
```json
{"ts":"2025-10-10T12:34:56.789Z","type":"data_access","action":"update","entityType":"company","entityId":"c123","userId":"u1","details":{}}
{"ts":"2025-10-10T12:35:12.345Z","type":"login","userId":"u2","username":"sara"}
```

---

## Dataintegritet & Validering

### 1. **Input Validation**

**Email:**
```javascript
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

**Telefon:**
```javascript
function validatePhone(phone) {
  return /^[\d\s\-\+\(\)]+$/.test(phone);
}
```

### 2. **Data Migrations**

**Automatiska migreringar vid laddning:**
```javascript
function runMigrations() {
  // 1. Skapa default segments om de saknas
  ensureDefaultSegments();
  
  // 2. Tilldela segmentId till brands utan
  assignSegmentsToBrands();
  
  // 3. Tilldela segmentId till companies (inherit från brand)
  assignSegmentsToCompanies();
  
  // 4. Seed banking data (first run)
  if (!AppState._bankingSeedDone) {
    seedBankingData();
    AppState._bankingSeedDone = true;
  }
}
```

### 3. **Referential Integrity**

**Cascade deletion:**
```javascript
// Ta bort brand → tar bort alla företag → tar bort alla mäklare
function deleteBrandCascade(brandId) {
  const companies = AppState.companies.filter(c => c.brandId === brandId);
  companies.forEach(c => deleteCompanyCascade(c.id));
  
  // Ta bort kontakter, tasks, notes
  AppState.contacts = AppState.contacts.filter(k => 
    !(k.entityType === 'brand' && k.entityId === brandId)
  );
  
  AppState.brands = AppState.brands.filter(b => b.id !== brandId);
}
```

---

## API-endpoints (Backend)

### Autentisering
```
POST   /api/login              # Logga in
POST   /api/logout             # Logga ut
POST   /api/change-password    # Byt lösenord
```

### Data CRUD
```
GET    /api/state              # Hämta all data (requireAuth)
POST   /api/state              # Spara data (requireAuth)
```

### Import/Export
```
POST   /api/import/excel       # Importera Excel-fil (requireAuth)
GET    /api/export/csv         # Exportera CSV
```

### Azure B2C Integration
```
POST   /api/azure-b2c/sync     # Synka användare från Azure B2C
GET    /api/azure-b2c/status   # Status för senaste sync
```

### GDPR
```
GET    /api/gdpr/export        # Exportera all användardata
POST   /api/gdpr/delete        # Radera användardata
GET    /api/audit              # Hämta audit log (requireAdmin)
```

---

## Prestanda & Skalbarhet

### Optimeringar

**1. DOM Caching:**
```javascript
const domCache = {
  modal: null,
  getModal() { return this.modal || (this.modal = document.getElementById('modal')); }
};
```

**2. Fragment Rendering:**
```javascript
const fragment = document.createDocumentFragment();
rows.forEach(row => fragment.appendChild(createRow(row)));
table.appendChild(fragment); // En reflow istället för N
```

**3. Lazy Pagination:**
- Default sidstorlek: 25 items
- Client-side paginering (ingen server roundtrip)

**4. Indexering:**
```javascript
// Pre-compute lookups för snabbare filtering
const companyIdToBrandId = new Map();
for (const c of AppState.companies) {
  companyIdToBrandId.set(c.id, c.brandId);
}
```

### Begränsningar

**localStorage:**
- Max: ~5-10 MB (varierar per webbläsare)
- Rekommenderad max: ~1000 företag, ~5000 mäklare
- För större datasets: använd backend med riktig databas

**In-memory sessions (backend):**
- Sessions lagras i minnet
- Förloras vid server-restart
- För production: använd Redis/Memcached

---

## Säkerhetsrekommendationer

### För Production

1. **Aktivera HTTPS**
   ```javascript
   const secure = NODE_ENV === 'production';
   ```

2. **Sätt ADMIN_PASSWORD**
   ```bash
   export ADMIN_PASSWORD="strong-random-password"
   ```

3. **Aktivera CORS whitelist**
   ```javascript
   app.use(cors({
     origin: 'https://yourdomain.com',
     credentials: true
   }));
   ```

4. **Lägg till rate limiting**
   ```javascript
   const rateLimit = require('express-rate-limit');
   app.use('/api/', rateLimit({
     windowMs: 15 * 60 * 1000,
     max: 100
   }));
   ```

5. **Använd persistent sessions**
   - Redis för session storage
   - JWT tokens som alternativ

6. **Kryptera känslig data**
   - Personuppgifter i vila
   - Använd encryption-at-rest

7. **Regelbunden backup**
   ```bash
   # Backup state.json dagligen
   cp server/state.json backups/state-$(date +%Y%m%d).json
   ```

---

## GDPR-compliance

### Implementerade åtgärder

1. **Audit logging:** All dataåtkomst loggas
2. **Right to access:** Export-funktionalitet
3. **Right to deletion:** Cascade deletion med audit trail
4. **Data minimization:** Endast nödvändig data lagras
5. **Consent tracking:** Kan läggas till via contacts/notes
6. **Data retention:** Gamla audit logs kan rensas automatiskt

### Rekommenderade tillägg

- [ ] Consent management UI
- [ ] Automated data retention policies
- [ ] Encryption för personuppgifter
- [ ] Privacy policy acceptance tracking
- [ ] Data processing agreements (DPA) management

---

## Deployment

### Standalone (endast frontend)

```bash
# Servera från vilken static file server som helst
python -m http.server 8000
# eller
npx serve crm-prototype
```

### Med backend

```bash
cd server
npm install
node index.js
# Server körs på port 3000
```

### Docker

```bash
docker-compose up -d
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  crm-server:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./docker-data:/app/server
    environment:
      - NODE_ENV=production
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
```

---

## Kontakt & Support

**Utvecklare:** CRM Team  
**Version:** 1.0  
**Senast uppdaterad:** 2025-10-10

---

## Appendix: Datamodell-schema

### Brand (Varumärke)
```typescript
interface Brand {
  id: string;
  namn: string;
  segmentId: string;
  centralContract?: {
    active: boolean;
    product?: string;
    mrr?: number;
  };
}
```

### Company (Företag)
```typescript
interface Company {
  id: string;
  namn: string;
  brandId?: string;
  segmentId: string;
  stad?: string;
  address?: string;
  postalCode?: string;
  postCity?: string;
  orgNumber?: string;
  status: 'kund' | 'prospekt' | 'ej';
  pipelineStage?: string;
  potentialValue: number;
  payment?: number;
  product?: string;
  customerNumber?: string;
  ansvarigSäljareId?: string;
  centralContract?: boolean;
  claudeSonnet4Enabled?: boolean;
}
```

### Agent (Mäklare/Rådgivare)
```typescript
interface Agent {
  id: string;
  förnamn: string;
  efternamn: string;
  email?: string;
  telefon?: string;
  companyId: string;
  officeName?: string;
  status: 'kund' | 'prospekt' | 'ej';
  licens?: {
    status: 'aktiv' | 'test' | 'ingen';
    typ?: string;
  };
  registrationType?: string;
  productsImported?: string;
  matchType?: string;
}
```

### Segment
```typescript
interface Segment {
  id: string;
  name: string;
  icon: string;
  color?: string;
  description?: string;
  pricingModel: 'per-agent' | 'enterprise' | 'custom';
  createdAt: number;
}
```
