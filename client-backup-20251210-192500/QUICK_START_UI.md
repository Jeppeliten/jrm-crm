# 🚀 Quick Start - Azure B2C User Management UI

## Setup och test i 5 minuter

### 1️⃣ Starta Backend (med mock data)

```powershell
cd c:\dev\jrm\server
node index.js
```

Du bör se:
```
Server running on port 3000
Azure B2C User Sync: ENABLED
Auto-sync: ENABLED (interval: 15 minutes)
```

### 2️⃣ Öppna Frontend

```powershell
cd c:\dev\jrm\crm-prototype
# Öppna index.html i webbläsare
# ELLER starta en lokal server:
python -m http.server 8080
# Surfa till: http://localhost:8080
```

### 3️⃣ Navigera till User Management

1. Klicka **"Inställningar"** i vänstermenyn
2. Klicka **"Hantera kunder"**
3. Du ser nu kundtabellen (tom till att börja med)

### 4️⃣ Skapa din första användare

1. Klicka **"➕ Skapa användare"**
2. Fyll i:
   ```
   Förnamn: Test
   Efternamn: Testsson
   E-post: test@example.com
   Roll: Mäklare (Sales)
   Tjänster: ☑ Värderingsdata Premium
   ☑ Skicka välkomstmail
   ```
3. Klicka **"Skapa användare"**

### 5️⃣ Vad händer?

**Med Azure B2C konfigurerat:**
```
✅ Användare skapas i Azure B2C
✅ Temporärt lösenord genereras
✅ Välkomstmail skickas
✅ Användare läggs till i CRM
✅ Audit log skapas
```

**Utan Azure B2C (test-läge):**
```
❌ API returnerar 500 (Azure inte konfigurerat)
💡 Frontend visar felmeddelande
💡 Användaren skapas INTE i state
```

---

## 🧪 Test utan Azure B2C

### Option A: Mock API responses

Lägg till i `app.js` (temporärt):

```javascript
// I createUserInB2C(), ersätt fetch med:
const response = {
  ok: true,
  json: async () => ({
    success: true,
    user: {
      id: 'mock-' + Date.now(),
      azureB2CId: 'mock-b2c-' + Date.now(),
      email: email,
      name: `${firstName} ${lastName}`,
      role: role,
      companyId: companyId,
      services: services.map(s => ({
        name: s,
        grantedAt: new Date().toISOString(),
        active: true
      })),
      isActive: true,
      source: 'mock-created'
    },
    message: 'Mock: Användare skapad'
  })
};
```

### Option B: Använd befintlig data

Lägg till mock-användare i `loadState()`:

```javascript
// I app.js, efter loadState():
AppState.customers = AppState.customers || [
  {
    id: 'customer-1',
    azureB2CId: 'mock-b2c-123',
    email: 'anna@era.se',
    name: 'Anna Andersson',
    displayName: 'Anna Andersson',
    role: 'sales',
    companyId: 'company-1',
    companyName: 'ERA Malmö',
    services: [
      {
        name: 'Värderingsdata Premium',
        grantedAt: '2025-01-01T00:00:00Z',
        active: true
      },
      {
        name: 'Rapport Pro',
        grantedAt: '2025-02-01T00:00:00Z',
        expiresAt: '2026-01-01T00:00:00Z',
        active: true
      }
    ],
    isActive: true,
    source: 'mock'
  },
  {
    id: 'customer-2',
    azureB2CId: 'mock-b2c-456',
    email: 'bjorn@fast.se',
    name: 'Björn Bergström',
    displayName: 'Björn Bergström',
    role: 'manager',
    companyId: 'company-2',
    companyName: 'Fastighetsbyrån',
    services: [
      {
        name: 'API Access',
        grantedAt: '2025-03-01T00:00:00Z',
        active: true
      }
    ],
    isActive: false, // Inaktiv användare
    source: 'mock'
  }
];
```

---

## 📸 Screenshots (vad du bör se)

### Inställningar-sidan:
```
┌────────────────────────────────────────────┐
│ Inställningar                              │
├────────────────────────────────────────────┤
│                                            │
│ Säljare (interna användare)               │
│ Hantera vilka som kan logga in...         │
│                               [Hantera]    │
│                                            │
│ Kunder (Azure B2C användare)  ⬅️ NYA!     │
│ Hantera kundanvändare, tjänster...        │
│                      [Hantera kunder]      │
│                                            │
│ Rensa all CRM-data                         │
│ Tar bort varumärken, företag...           │
│                          [Rensa allt]      │
└────────────────────────────────────────────┘
```

### Kundtabell (med mock data):
```
┌──────────────────────────────────────────────────────────┐
│ Hantera kunder (Azure B2C användare)                     │
│                                                           │
│ [Sök...] [Alla roller ▼] [Alla status ▼] [➕ Skapa]    │
│                                                           │
│ ┌─────────┬──────────┬──────────┬────────┬────────────┐ │
│ │ Namn    │ E-post   │ Företag  │ Roll   │ Tjänster   │ │
│ ├─────────┼──────────┼──────────┼────────┼────────────┤ │
│ │ Anna A. │ anna@... │ ERA      │ Mäkl▼  │ [Premium×] │ │
│ │         │          │ Malmö    │        │ [Rapport×] │ │
│ │         │          │          │        │ ➕ ⏸ 🔑 🗑│ │
│ ├─────────┼──────────┼──────────┼────────┼────────────┤ │
│ │ Björn B.│ bjorn@.. │ Fastigh. │ Mana▼  │ [API×]     │ │
│ │         │          │ byrån    │        │ [Inaktiv]  │ │
│ │         │          │          │        │ ➕ ▶ 🔑 🗑│ │
│ └─────────┴──────────┴──────────┴────────┴────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Skapa användare-modal:
```
┌─────────────────────────────────────┐
│ ✕                                   │
│ ➕ Skapa ny användare i Azure B2C  │
│                                     │
│ Förnamn *                           │
│ [_____________________________]     │
│                                     │
│ Efternamn *                         │
│ [_____________________________]     │
│                                     │
│ E-post *                            │
│ [_____________________________]     │
│                                     │
│ Tjänster                            │
│ ☑ Värderingsdata Premium            │
│ ☐ Rapport Pro                       │
│ ☐ API Access                        │
│                                     │
│ ☑ Skicka välkomstmail              │
│                                     │
│   [Skapa användare] [Avbryt]       │
└─────────────────────────────────────┘
```

---

## 🎯 Test Scenarios

### ✅ Test 1: UI rendering
- [ ] Öppna "Hantera kunder"
- [ ] Verifiera: Tabell visas
- [ ] Verifiera: Sökfält finns
- [ ] Verifiera: Filters finns
- [ ] Verifiera: "Skapa användare"-knapp finns

### ✅ Test 2: Mock data visas
- [ ] Mock-användare syns i tabellen
- [ ] Service badges visas korrekt
- [ ] Status badges visas (Aktiv/Inaktiv)
- [ ] Action-knappar renderas

### ✅ Test 3: Sökning fungerar
- [ ] Skriv "anna" i sökfält
- [ ] Verifiera: Endast Anna visas
- [ ] Skriv "bjorn"
- [ ] Verifiera: Endast Björn visas

### ✅ Test 4: Filtrering fungerar
- [ ] Välj "Mäklare" i rollfilter
- [ ] Verifiera: Endast mäklare visas
- [ ] Välj "Inaktiva" i statusfilter
- [ ] Verifiera: Endast inaktiva visas

### ✅ Test 5: Modaler öppnas
- [ ] Klicka "Skapa användare"
- [ ] Verifiera: Modal öppnas
- [ ] Klicka "Avbryt"
- [ ] Verifiera: Modal stängs
- [ ] Klicka [➕] på användare
- [ ] Verifiera: "Lägg till tjänst"-modal öppnas

### ✅ Test 6: Formulärvalidering
- [ ] Öppna "Skapa användare"
- [ ] Lämna fält tomma
- [ ] Klicka "Skapa användare"
- [ ] Verifiera: HTML5 validering (required)

---

## 🔧 Troubleshooting

### Problem: "Hantera kunder" knapp saknas

**Lösning:**
```javascript
// Kontrollera att index.html innehåller:
<div class="list-item">
  <div>
    <div class="title">Kunder (Azure B2C användare)</div>
    <div class="subtitle">Hantera kundanvändare, tjänster och roller i Azure B2C.</div>
  </div>
  <div>
    <button id="manageCustomers" class="secondary">Hantera kunder</button>
  </div>
</div>
```

### Problem: Modal öppnas inte

**Lösning:**
```javascript
// Kontrollera i browser console (F12):
// 1. Kolla om setupUserManagementHandlers() körs
console.log('setupUserManagementHandlers called');

// 2. Kolla om event listener är kopplad
const btn = document.getElementById('manageCustomers');
console.log('Button found:', btn);

// 3. Test öppna modal manuellt:
openManageCustomersModal();
```

### Problem: Tabellen är tom

**Lösning:**
```javascript
// Lägg till mock data:
AppState.customers = [
  {
    id: 'test-1',
    email: 'test@test.se',
    name: 'Test User',
    role: 'sales',
    services: [],
    isActive: true
  }
];

// Rendera tabell:
renderCustomersTable();
```

### Problem: CSS inte applicerad

**Lösning:**
```bash
# Kontrollera att styles.css är uppdaterad
# och länkad i index.html:
<link rel="stylesheet" href="styles.css" />

# Hard refresh i browser:
Ctrl + F5
```

---

## 🎉 Nästa steg

När UI:t fungerar, fortsätt med:

1. **Azure Portal Setup**
   - Följ `AZURE_USER_SYNC_CHECKLIST.md`
   - Konfigurera Azure B2C tenant
   - Registrera Graph API app

2. **Environment Variables**
   - Kopiera `.env.example` till `.env`
   - Fyll i Azure credentials

3. **Test med riktig Azure B2C**
   - Skapa användare
   - Verifiera i Azure Portal
   - Testa inloggning

4. **Email Integration**
   - Implementera sendWelcomeEmail()
   - Konfigurera SendGrid/Azure Communication Services

5. **Production Deployment**
   - Deploy frontend till Azure Static Web Apps
   - Deploy backend till Azure App Service

---

## 📚 Relaterade guider

- `USER_MANAGEMENT_UI_GUIDE.md` - Komplett UI-dokumentation
- `AZURE_USER_CREATION_GUIDE.md` - API & användningsfall
- `AZURE_USER_SYNC_GUIDE.md` - Synkronisering B2C ↔ CRM
- `AZURE_DEPLOYMENT_GUIDE.md` - Production deployment

**Lycka till! 🚀**
