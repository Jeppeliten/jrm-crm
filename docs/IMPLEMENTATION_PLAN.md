# CRM Komplett Implementation Plan
**Datum:** 2025-12-10  
**Status:** PÅGÅENDE  
**Backup:** client/backups/20251210_103148

---

## 📋 Översikt

Vi bygger vidare på nuvarande `app-simple.js` (~1900 rader) och lägger till saknade funktioner steg för steg enligt COMPLETE_DESIGN_SPECIFICATION.md.

**Strategi:** Inkrementell utveckling - ingen funktionalitet går förlorad.

---

## ✅ FAS 1: Dashboard med KPI:er (PRIORITET 1)
**Estimerad tid:** 3-4 timmar  
**Mål:** Skapa insiktsfull översikt av försäljningsläget

### Funktioner att implementera:
- [ ] **Metrics Cards** (Täckning %, Varumärken, Företag, Mäklare, Aktiva licenser, Potential)
- [ ] **Brand Coverage Table** (Kedjetäckning med antal företag/mäklare per varumärke)
- [ ] **MRR-beräkningar** (Monthly Recurring Revenue baserat på agent-antal)
- [ ] **Filter-integration** (Respektera activeSegmentId från backend)

### Backend-ändringar:
```javascript
// Ny endpoint: GET /api/stats/dashboard
// Returnerar:
{
  totalBrands: number,
  totalCompanies: number,
  totalAgents: number,
  activeLicenses: number,
  coverage: number, // %
  totalMRR: number,
  potential: number,
  brandBreakdown: [{
    brandId, brandName, companyCount, agentCount, mrr, status
  }]
}
```

### Frontend-ändringar:
```javascript
// I app-simple.js:
async function loadDashboard() {
  const stats = await fetchWithAuth('/api/stats/dashboard');
  renderDashboardMetrics(stats);
  renderBrandCoverageTable(stats.brandBreakdown);
}

function renderDashboardMetrics(stats) {
  // 6 metrics cards: Täckning, Varumärken, Företag, Mäklare, Licenser, Potential
}

function renderBrandCoverageTable(brands) {
  // Tabell med varumärken, klickbara rader → öppnar brand details
}
```

---

## ✅ FAS 2: Enhanced Brand Details Modal (PRIORITET 2)
**Estimerad tid:** 2-3 timmar  
**Mål:** Detaljerad vy för varumärken med centrala avtal

### Funktioner:
- [ ] **Central Contract Management** (Checkbox + produkt + MRR-input)
- [ ] **Company List** (Alla företag under varumärket, paginerade)
- [ ] **Contact Persons** (Beslutsfattare med CRUD)
- [ ] **Tasks** (Uppgifter kopplade till varumärke)
- [ ] **Notes** (Anteckningar kopplade till varumärke)

### Backend-ändringar:
```javascript
// Uppdatera brands_v2 schema:
{
  ...existing,
  centralContract: {
    active: boolean,
    product: string,
    mrr: number
  },
  contacts: [{
    id, name, role, email, phone
  }],
  tasks: [{
    id, title, dueAt, done, ownerId
  }],
  notes: [{
    id, text, authorId, createdAt
  }]
}

// Nya endpoints:
POST /api/brands/:id/contacts
POST /api/brands/:id/tasks
POST /api/brands/:id/notes
```

### Frontend-ändringar:
```javascript
async function showBrandDetails(id) {
  // Hämta brand med nested data
  // Visa:
  // 1. Central avtal-sektion (checkbox + fields)
  // 2. Contacts lista med add/edit/delete
  // 3. Companies lista (paginerad)
  // 4. Tasks lista
  // 5. Notes lista
}
```

---

## ✅ FAS 3: Kanban Sales Pipeline (PRIORITET 3)
**Estimerad tid:** 3-4 timmar  
**Mål:** Visuell försäljningspipeline med drag-and-drop

### Funktioner:
- [ ] **Kanban Board** (Kolumner: Prospekt, Kvalificerad, Offert, Förhandling, Vunnit, Förlorat)
- [ ] **Drag & Drop** (Flytta företag mellan stages)
- [ ] **Pipeline Value** (Summerad potential per stage)
- [ ] **Quick Actions** (Klick på kort → company details)

### Backend-ändringar:
```javascript
// Lägg till i companies_v2:
{
  pipelineStage: 'prospekt' | 'kvalificerad' | 'offert' | 'förhandling' | 'vunnit' | 'förlorat',
  potentialValue: number,
  pipelineHistory: [{
    stage, changedAt, changedBy
  }]
}

// Ny endpoint:
PUT /api/companies/:id/pipeline
{ stage: string }
```

### Frontend-ändringar:
```javascript
function renderPipeline() {
  // 6 kolumner (stages)
  // Företagskort i varje kolumn
  // Sortable.js för drag-and-drop
  // Stage headers med summa potential
}

function updatePipelineStage(companyId, newStage) {
  await fetchWithAuth(`/api/companies/${companyId}/pipeline`, {
    method: 'PUT',
    body: JSON.stringify({ stage: newStage })
  });
}
```

---

## ✅ FAS 4: Customer Success Dashboard (PRIORITET 4)
**Estimerad tid:** 2-3 timmar  
**Mål:** Proaktiv kundvård med health scoring

### Funktioner:
- [ ] **Health Score** (Beräknad baserat på aktivitet, licenser, kontakt)
- [ ] **Risk Indicators** (Röda flaggor: inaktiva, saknar kontakt, etc)
- [ ] **Action Items** (Föreslagna åtgärder per kund)
- [ ] **Next Actions** (Schemalagda uppföljningar)

### Backend-ändringar:
```javascript
// Lägg till i companies_v2:
{
  healthScore: number, // 0-100
  lastContact: Date,
  nextAction: {
    type: string,
    scheduledAt: Date,
    ownerId: string
  },
  riskFactors: [string]
}

// Ny endpoint:
GET /api/customer-success
// Returnerar företag sorterade efter health score
```

### Frontend-ändringar:
```javascript
function renderCustomerSuccess() {
  // Health score cards (green/yellow/red)
  // Sorterad lista: högst risk först
  // Quick actions: "Ring", "Skicka email", "Boka möte"
}

function calculateHealthScore(company) {
  // Baserat på:
  // - Antal dagar sedan last contact
  // - Aktivitet (licenser aktiva)
  // - Avtal-status
  // - Antal mäklare vs förväntning
}
```

---

## ✅ FAS 5: Tasks & Notes System (PRIORITET 5)
**Estimerad tid:** 2-3 timmar  
**Mål:** Globalt tasks/notes system kopplat till alla entities

### Funktioner:
- [ ] **Global Tasks View** (Alla uppgifter, filtrera Mina/Alla)
- [ ] **Tasks på entities** (Brand, Company, Agent)
- [ ] **Notes på entities** (Tidsstämplad historik)
- [ ] **Påminnelser** (Due date notifications)

### Backend-ändringar:
```javascript
// Nya collections:
tasks {
  id, title, description, entityType, entityId, ownerId, 
  dueAt, done, createdAt, updatedAt
}

notes {
  id, text, entityType, entityId, authorId, createdAt
}

// Endpoints:
GET /api/tasks?filter=all|mine
POST /api/tasks
PUT /api/tasks/:id
DELETE /api/tasks/:id

GET /api/{brands|companies|agents}/:id/notes
POST /api/{brands|companies|agents}/:id/notes
```

---

## ✅ FAS 6: Segment Filtering (PRIORITET 6)
**Estimerad tid:** 1-2 timmar  
**Mål:** Filtrera CRM-data baserat på bransch

### Funktioner:
- [ ] **Segment Dropdown** (I topbar: Alla, Fastighet, Bank, Försäkring)
- [ ] **Global Filter State** (activeSegmentId påverkar alla vyer)
- [ ] **Segment Icons & Colors** (Visuell åtskillnad)

### Backend-ändringar:
```javascript
// Lägg till i alla entities:
{
  segmentId: string // 'real-estate', 'banking', 'insurance'
}

// Segments collection:
segments {
  id, name, icon, color, description, pricingModel
}
```

---

## ✅ FAS 7: Undo Functionality (PRIORITET 7)
**Estimerad tid:** 2 timmar  
**Mål:** Ångra borttagningar och ändringar

### Funktioner:
- [ ] **Undo Stack** (In-memory, max 10 actions)
- [ ] **Undo Button** (Topbar, synlig efter action)
- [ ] **Toast Notifications** ("Företag borttaget. Ångra?")

### Implementation:
```javascript
const undoStack = [];

function pushUndo(action) {
  undoStack.push({
    type: 'delete|update|create',
    entityType: 'brand|company|agent',
    data: originalData,
    timestamp: new Date()
  });
  if (undoStack.length > 10) undoStack.shift();
}

async function undo() {
  const action = undoStack.pop();
  if (!action) return;
  
  if (action.type === 'delete') {
    // Re-create entity
    await fetchWithAuth(`/api/${action.entityType}s`, {
      method: 'POST',
      body: JSON.stringify(action.data)
    });
  }
  // ...handle update/create
}
```

---

## ✅ FAS 8: MRR & Pricing Logic (PRIORITET 8)
**Estimerad tid:** 1-2 timmar  
**Mål:** Automatisk MRR-beräkning baserat på antal mäklare

### Prisstrategi:
```
4-6 mäklare:   849 kr/mån
7-10 mäklare:  1249 kr/mån
11-15 mäklare: 1649 kr/mån
16-20 mäklare: 1999 kr/mån
21+ mäklare:   2449 kr/mån
```

### Backend-ändringar:
```javascript
function calculateMRR(agentCount) {
  if (agentCount >= 21) return 2449;
  if (agentCount >= 16) return 1999;
  if (agentCount >= 11) return 1649;
  if (agentCount >= 7) return 1249;
  if (agentCount >= 4) return 849;
  return 0;
}

// Auto-update company.payment när agentCount ändras
```

---

## 📝 Implementation Checklist

### FAS 1 - Dashboard ✅
- [ ] Backend: GET /api/stats/dashboard endpoint
- [ ] Frontend: loadDashboard() function
- [ ] Frontend: renderDashboardMetrics()
- [ ] Frontend: renderBrandCoverageTable()
- [ ] Test: Verifiera metrics calculations
- [ ] Test: Klickbara brand-rader

### FAS 2 - Brand Details ✅
- [ ] Backend: Update brands_v2 schema
- [ ] Backend: POST /api/brands/:id/contacts
- [ ] Backend: POST /api/brands/:id/tasks
- [ ] Backend: POST /api/brands/:id/notes
- [ ] Frontend: showBrandDetails() enhanced
- [ ] Frontend: Central contract form
- [ ] Frontend: Contacts CRUD
- [ ] Frontend: Company list pagination
- [ ] Test: Central contract activation cascades to companies

### FAS 3 - Kanban Pipeline ✅
- [ ] Backend: Add pipelineStage to companies_v2
- [ ] Backend: PUT /api/companies/:id/pipeline
- [ ] Frontend: renderPipeline() with 6 columns
- [ ] Frontend: Integrate Sortable.js for drag-and-drop
- [ ] Frontend: Update pipeline stage on drop
- [ ] Test: Drag company between stages
- [ ] Test: Pipeline value calculations

### FAS 4 - Customer Success ✅
- [ ] Backend: Add healthScore fields to companies
- [ ] Backend: GET /api/customer-success endpoint
- [ ] Frontend: renderCustomerSuccess()
- [ ] Frontend: calculateHealthScore()
- [ ] Frontend: Risk indicator logic
- [ ] Test: Health score accuracy
- [ ] Test: Action items display

### FAS 5 - Tasks & Notes ✅
- [ ] Backend: Create tasks collection
- [ ] Backend: Create notes collection
- [ ] Backend: CRUD endpoints for tasks
- [ ] Backend: CRUD endpoints for notes
- [ ] Frontend: Global tasks view
- [ ] Frontend: Entity-specific tasks/notes
- [ ] Test: Create task on brand
- [ ] Test: Filter My/All tasks

### FAS 6 - Segment Filtering ✅
- [ ] Backend: Create segments collection
- [ ] Backend: Add segmentId to all entities
- [ ] Frontend: Segment dropdown in topbar
- [ ] Frontend: Global filter state
- [ ] Frontend: Apply filter to all views
- [ ] Test: Switch segment, verify filtering

### FAS 7 - Undo ✅
- [ ] Frontend: Implement undo stack
- [ ] Frontend: pushUndo() on delete/update
- [ ] Frontend: undo() function
- [ ] Frontend: Undo button in topbar
- [ ] Frontend: Toast notifications
- [ ] Test: Delete → Undo → Verify restored

### FAS 8 - MRR Pricing ✅
- [ ] Backend: calculateMRR() function
- [ ] Backend: Auto-update on agentCount change
- [ ] Frontend: Display MRR in company details
- [ ] Frontend: MRR summary in dashboard
- [ ] Test: Verify pricing tiers

---

## 🔄 Deployment Strategy

Efter varje fas:
1. **Testa lokalt** (localhost:3000)
2. **Commit med tydligt meddelande** (ex: "Fas 1: Dashboard implementation")
3. **Push till GitHub** (→ Auto-deploy till Azure)
4. **Verifiera i prod** (https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net)
5. **User Acceptance Test** (Bekräfta att allt fungerar)

---

## 🎯 Success Criteria

### Måste ha (Must Have):
- ✅ Dashboard med alla metrics
- ✅ Brand details med central contract
- ✅ Kanban pipeline med drag-and-drop
- ✅ Customer success med health scoring
- ✅ Tasks & Notes system

### Bra att ha (Nice to Have):
- ⏳ Undo functionality
- ⏳ Segment filtering
- ⏳ MRR auto-calculation

### Framtida förbättringar:
- 📧 Email-integration (Outlook)
- 📅 Calendar-integration
- 📊 Advanced reporting
- 🔔 Real-time notifications
- 🤖 AI-powered insights

---

## 📚 Referenser

- **Design Spec:** client/backups/20251210_103148/DESIGN_SPEC.md
- **Original Backup:** client/backups/20251210_103148/
- **Current Code:** client/app-simple.js (1900 lines)
- **Backend:** server/routes/*.js
- **Database:** Cosmos DB (MongoDB API)

---

## ⏰ Timeline

- **Fas 1-2:** Dag 1-2 (Dashboard + Brand Details)
- **Fas 3-4:** Dag 3-4 (Pipeline + Customer Success)
- **Fas 5-6:** Dag 5 (Tasks + Segments)
- **Fas 7-8:** Dag 6 (Undo + MRR)
- **Testing & Polish:** Dag 7

**Total estimerad tid:** 10-15 timmar arbete (1-2 veckor kalender)

---

## ✅ Nuläge

**Status:** Backup skapad, plan upprättad, redo att börja Fas 1  
**Nästa steg:** Implementera Dashboard (Fas 1)  
**Senast uppdaterad:** 2025-12-10 10:32
