# 🎨 User Management UI - Användningsguide

## 📖 Översikt

Frontend UI för Azure B2C användarhantering är nu implementerat i CRM-prototypen. Säljare kan skapa och hantera kunder direkt från CRM-gränssnittet.

---

## 🚀 Hur man kommer åt användargränssnittet

### 1. Öppna CRM Prototypen

```bash
cd c:\dev\jrm\crm-prototype
# Öppna index.html i webbläsare
```

### 2. Navigera till Inställningar

- Klicka på **"Inställningar"** i sidomenyn
- Du ser nu två alternativ:
  - **Säljare (interna användare)** - Befintlig funktionalitet
  - **Kunder (Azure B2C användare)** - NYA funktionaliteten! ✨

### 3. Öppna Kundhantering

- Klicka på **"Hantera kunder"**
- En stor modal öppnas med kundtabellen

---

## 🎯 Funktioner & UI-komponenter

### Modal: Hantera Kunder

När du klickar "Hantera kunder" ser du:

```
┌─────────────────────────────────────────────────────────────┐
│  ✕                                                           │
│  Hantera kunder (Azure B2C användare)                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [Sök användare...] [Alla roller ▼] [Alla status ▼]  │  │
│  │                          [➕ Skapa användare]         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Namn │ E-post │ Företag │ Roll │ Tjänster │ Status  │  │
│  ├──────┼────────┼─────────┼──────┼──────────┼─────────┤  │
│  │ Anna │ anna@  │ ERA     │ Mäkl │ [Premium]│ Aktiv   │  │
│  │ And. │ era.se │ Malmö   │ are▼ │ [×]      │ [Aktiv] │  │
│  │      │        │         │      │          │ [➕🔑🗑] │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Komponenter:

1. **Sökfält** - Sök på namn, e-post eller företag
2. **Rollfilter** - Filtrera: Alla roller, Mäklare, Manager, Admin
3. **Statusfilter** - Filtrera: Alla, Aktiva, Inaktiva
4. **Skapa användare-knapp** - Öppnar formulär för ny användare

#### Tabellkolumner:

| Kolumn | Beskrivning |
|--------|-------------|
| **Namn** | Användarens fullständiga namn |
| **E-post** | Inloggnings-email |
| **Företag** | Kopplat mäklarföretag |
| **Roll** | Dropdown: Mäklare/Manager/Admin (Manager+ kan ändra) |
| **Tjänster** | Badges med tillgång till tjänster, × för att ta bort |
| **Status** | Badge: Aktiv (grön) / Inaktiv (grå) |
| **Actions** | Knappar baserat på roll |

---

### Modal: Skapa ny användare

Klicka **"➕ Skapa användare"**:

```
┌────────────────────────────────────────┐
│  ✕                                     │
│  ➕ Skapa ny användare i Azure B2C    │
│                                        │
│  Förnamn *                             │
│  [Anna                              ]  │
│                                        │
│  Efternamn *                           │
│  [Andersson                         ]  │
│                                        │
│  E-post *                              │
│  [anna@era.se                       ]  │
│                                        │
│  Telefon                               │
│  [+46701234567                      ]  │
│                                        │
│  Företag                               │
│  [Välj företag... ▼                 ]  │
│                                        │
│  Roll                                  │
│  [Mäklare (Sales) ▼                 ]  │
│                                        │
│  Tjänster                              │
│  ☑ Värderingsdata Premium              │
│  ☑ Rapport Pro                         │
│  ☐ API Access                          │
│  ☐ Ortpris                             │
│                                        │
│  ☑ Skicka välkomstmail med            │
│    inloggningsuppgifter                │
│                                        │
│     [Skapa användare] [Avbryt]        │
└────────────────────────────────────────┘
```

#### Vad händer när du klickar "Skapa användare":

1. **Validering** - Kontrollerar att alla obligatoriska fält är ifyllda
2. **API-anrop** - Skickar POST till `/api/users/create-in-b2c`
3. **Azure B2C** - Användare skapas med temporärt lösenord
4. **E-post** - Välkomstmail skickas (om markerat)
5. **CRM** - Användare läggs till i lokal state
6. **Bekräftelse** - Visa meddelande med resultat
7. **Stäng modal** - Återgå till kundlistan

#### Om "Skicka välkomstmail" är AVMARKERAT:

```
┌────────────────────────────────────────────┐
│  Användare skapad!                         │
│                                             │
│  E-post: anna@era.se                       │
│  Temporärt lösenord: xK9@mP2$vL4#qR7!      │
│                                             │
│  ⚠️ Spara detta lösenord nu!               │
│  Det visas inte igen.                      │
│                                             │
│               [OK]                          │
└────────────────────────────────────────────┘
```

---

### Modal: Lägg till tjänst

Klicka **➕** i Actions-kolumnen:

```
┌────────────────────────────────────────┐
│  ✕                                     │
│  ➕ Lägg till tjänst                   │
│                                        │
│  Tjänst *                              │
│  [Välj tjänst... ▼                  ]  │
│   - Värderingsdata Premium             │
│   - Rapport Pro                        │
│   - API Access                         │
│   - Ortpris                            │
│                                        │
│  Utgångsdatum (optional)               │
│  [2026-01-01                        ]  │
│  Lämna tomt för obegränsad tillgång    │
│                                        │
│     [Lägg till tjänst] [Avbryt]       │
└────────────────────────────────────────┘
```

#### Vad händer:

1. Välj tjänst från dropdown
2. (Optional) Sätt utgångsdatum
3. Klicka "Lägg till tjänst"
4. API-anrop till `/api/users/{userId}/grant-service`
5. Tjänst läggs till i både Azure B2C och CRM
6. Tabell uppdateras automatiskt
7. Ny badge visas i Tjänster-kolumnen

---

### Service Badges

Visar användares aktiva tjänster:

```
┌────────────────────────────────────────┐
│ Tjänster:                              │
│                                        │
│ [Värderingsdata Premium ×]             │
│ [Rapport Pro (utgår: 2026-01-01) ×]   │
│ [API Access ×]                         │
└────────────────────────────────────────┘
```

- **Grön badge** - Aktiv tjänst
- **Röd badge med opacity** - Utgången tjänst
- **× knapp** - Ta bort tjänst (endast Manager/Admin)
- **Hover** - Visa beviljningsdatum

---

### Action Knappar (baserat på roll)

#### Sales (Säljare):
```
[➕] - Lägg till tjänst
```

#### Manager:
```
[➕] - Lägg till tjänst
[⏸] - Inaktivera användare (om aktiv)
[▶] - Aktivera användare (om inaktiv)
[🔑] - Återställ lösenord
```

#### Admin:
```
[➕] - Lägg till tjänst
[⏸/▶] - Inaktivera/Aktivera
[🔑] - Återställ lösenord
[🗑] - Radera användare
```

---

## 🎨 Visuella element

### Status Badges

**Aktiv användare:**
```
┌─────────┐
│ Aktiv   │  (Grön bakgrund, grön border)
└─────────┘
```

**Inaktiv användare:**
```
┌─────────┐
│ Inaktiv │  (Grå bakgrund, grå border)
└─────────┘
```

### Service Badges

**Aktiv tjänst:**
```
┌──────────────────────────┐
│ Värderingsdata Premium × │  (Grön bakgrund)
└──────────────────────────┘
```

**Utgången tjänst:**
```
┌────────────────────────────────────┐
│ Rapport Pro (utgår: 2026-01-01) × │  (Röd bakgrund, opacity 0.7)
└────────────────────────────────────┘
```

### Roll Dropdown

```
Mäklare (Sales)  ▼
Manager          ▼
Admin            ▼
```

- **Aktiverad** - Manager/Admin kan ändra
- **Disabled** - Sales kan inte ändra roller
- **On Change** - Uppdaterar direkt via API

---

## 🔄 Arbetsflöden

### Scenario 1: Säljare säljer tjänst

```
1. Säljare loggar in i CRM
   ↓
2. Går till Inställningar → "Hantera kunder"
   ↓
3. Klickar "➕ Skapa användare"
   ↓
4. Fyller i formulär:
   - Namn: Anna Andersson
   - E-post: anna@era.se
   - Företag: ERA Malmö
   - Tjänster: ☑ Värderingsdata Premium
   - ☑ Skicka välkomstmail
   ↓
5. Klickar "Skapa användare"
   ↓
6. System:
   ✅ Skapar användare i Azure B2C
   ✅ Genererar temporärt lösenord
   ✅ Skickar välkomstmail
   ✅ Lägger till i CRM
   ↓
7. Bekräftelse: "Användare anna@era.se skapad! Välkomstmail skickat."
   ↓
8. Anna får mail och kan logga in direkt
```

### Scenario 2: Manager ger ytterligare tjänst

```
1. Manager söker upp användare "Anna Andersson"
   ↓
2. Klickar [➕] i Actions-kolumnen
   ↓
3. Väljer "Rapport Pro"
   ↓
4. Sätter utgångsdatum: 2026-01-01
   ↓
5. Klickar "Lägg till tjänst"
   ↓
6. System uppdaterar Azure B2C och CRM
   ↓
7. Ny badge syns: [Rapport Pro (utgår: 2026-01-01) ×]
```

### Scenario 3: Manager inaktiverar användare

```
1. Manager hittar användare som ska inaktiveras
   ↓
2. Klickar [⏸] (Pause-knapp)
   ↓
3. Bekräftar: "Är du säker?"
   ↓
4. System:
   ✅ Sätter accountEnabled=false i Azure B2C
   ✅ Uppdaterar IsActive=false i CRM
   ✅ Loggar händelse i audit log
   ↓
5. Status ändras till [Inaktiv] badge
   ↓
6. Knappen ändras till [▶] (Play) för att aktivera igen
```

### Scenario 4: Admin raderar användare

```
1. Admin hittar användare att radera
   ↓
2. Klickar [🗑] (Papperskorg)
   ↓
3. Bekräftelse-dialog visas:
   "Är du säker på att du vill radera anna@era.se?
    
    Detta kommer att:
    • Ta bort användaren från CRM
    • Ta bort användaren från Azure B2C
    • Denna åtgärd kan INTE ångras!
    
    Fortsätt?"
   ↓
4. Om "OK":
   ✅ DELETE API-anrop till /api/users/{userId}
   ✅ Permanent borttagning från Azure B2C
   ✅ Borttagning från CRM state
   ✅ Audit log skapas
   ↓
5. Användare försvinner från listan
```

---

## 🎯 Filtrering & Sökning

### Sökfält

Sök i:
- Namn
- E-post
- Företagsnamn

```javascript
Sökning: "anna"
Resultat:
  - Anna Andersson (anna@era.se)
  - Johan Annasson (johan@fast.se)
```

### Rollfilter

```
[Alla roller ▼]
  - Alla roller
  - Mäklare
  - Manager
  - Admin
```

### Statusfilter

```
[Alla status ▼]
  - Alla
  - Aktiva
  - Inaktiva
```

---

## 🔐 Säkerhet & Behörigheter

### UI-rendering baserat på roll:

```javascript
const currentUser = AppState.users.find(u => u.id === AppState.currentUserId);
const isSales = currentUser?.roll === 'sales';
const isManager = currentUser?.roll === 'manager';
const isAdmin = currentUser?.roll === 'admin';

// Endast Manager+ ser inaktivera-knapp
${(isManager || isAdmin) ? `<button>⏸</button>` : ''}

// Endast Admin ser radera-knapp
${isAdmin ? `<button>🗑</button>` : ''}
```

### Disabled states:

- **Roll dropdown** - Disabled för Sales
- **Ta bort tjänst (×)** - Dold för Sales
- **Alla knappar** - Disabled om servern returnerar 401/403

---

## 📱 Responsivitet

Modalen anpassar sig efter skärmstorlek:

```css
/* Desktop */
.modal-content.large {
  width: min(1200px, 95vw);
  max-height: 92vh;
}

/* Tablet/Mobile - automatisk scrollning */
.table-wrapper {
  overflow-x: auto;
}
```

---

## 🎨 Färgschema

### Status badges:

| Status | Bakgrund | Border | Text |
|--------|----------|--------|------|
| Aktiv | #ecfdf5 | #86efac | #166534 |
| Inaktiv | #f8fafc | #cbd5e1 | #334155 |

### Action buttons:

| Typ | Bakgrund | Border | Text |
|-----|----------|--------|------|
| Primary (➕) | #0ea5e9 | #0284c7 | #ffffff |
| Warning (⏸) | #fef3c7 | #fde68a | #92400e |
| Success (▶) | #d1fae5 | #86efac | #166534 |
| Secondary (🔑) | #e6f4ff | #c6e2ff | #0b3e66 |
| Danger (🗑) | #dc2626 | #b91c1c | #ffffff |

### Service badges:

| Status | Bakgrund | Border | Text |
|--------|----------|--------|------|
| Aktiv | #ecfdf5 | #86efac | #166534 |
| Utgången | #fef2f2 | #fecaca | #991b1b |

---

## 🧪 Testning

### Manuella tester:

1. **Test: Skapa användare**
   - Öppna "Hantera kunder"
   - Klicka "Skapa användare"
   - Fyll i alla fält
   - Klicka "Skapa användare"
   - Verifiera: Användare syns i listan

2. **Test: Lägg till tjänst**
   - Hitta en användare
   - Klicka [➕]
   - Välj tjänst
   - Sätt utgångsdatum
   - Klicka "Lägg till tjänst"
   - Verifiera: Ny badge syns

3. **Test: Inaktivera användare**
   - Som Manager/Admin
   - Klicka [⏸]
   - Bekräfta
   - Verifiera: Status blir "Inaktiv"

4. **Test: Sökning**
   - Skriv i sökfält
   - Verifiera: Filtrerad lista

5. **Test: Rollbaserad åtkomst**
   - Logga in som Sales
   - Verifiera: Ingen [🗑] knapp
   - Verifiera: Roll dropdown disabled

---

## 📝 Sammanfattning

✅ **Implementerade komponenter:**
- Modal för kundhantering
- Formulär för skapa användare
- Formulär för ge tjänst
- Kundtabell med filtrering
- Service badges
- Status badges
- Action buttons (rollbaserade)
- Sök & filter funktionalitet

✅ **Funktioner:**
- Skapa användare i Azure B2C
- Ge/ta bort tjänster
- Uppdatera roller
- Inaktivera/aktivera användare
- Återställ lösenord
- Radera användare
- Sök och filtrera

✅ **Styling:**
- Responsiv design
- Enhetligt färgschema
- Tydliga visuella indikatorer
- Hover states
- Disabled states

**Nu kan säljare hantera kunder direkt från CRM:et! 🎉**
