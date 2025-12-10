'use strict';

// CRM Prototyp â€“ enkel SPA utan backend
// Datamodell i localStorage. Import frÃ¥n Excel via SheetJS.

// DOM Cache for performance
const domCache = {
  modal: null,
  modalBody: null,
  globalSearch: null,
  currentUser: null,
  loginBtn: null,
  getModal() { return this.modal || (this.modal = document.getElementById('modal')); },
  getModalBody() { return this.modalBody || (this.modalBody = document.getElementById('modalBody')); },
  getGlobalSearch() { return this.globalSearch || (this.globalSearch = document.getElementById('globalSearch')); },
  getCurrentUser() { return this.currentUser || (this.currentUser = document.getElementById('currentUser')); },
  getLoginBtn() { return this.loginBtn || (this.loginBtn = document.getElementById('loginBtn')); }
};

const LS_KEY = 'crm_prototype_state_v1';
// API_BASE is now defined in config.js
const DEFAULT_USERS = [
  { id: 'u1', namn: 'Admin', roll: 'admin' },
  { id: 'u2', namn: 'Sara SÃ¤lj', roll: 'sales' },
  { id: 'u3', namn: 'Johan SÃ¤lj', roll: 'sales' },
];

// Prislista fÃ¶r butikslicenser baserat pÃ¥ antal medarbetare
const PRICING_TIERS = [
  { min: 4, max: 6, price: 849, name: '4-6 medarbetare' },
  { min: 7, max: 9, price: 1099, name: '7-9 medarbetare' },
  { min: 10, max: 15, price: 1649, name: '10-15 medarbetare' },
  { min: 16, max: 20, price: 2099, name: '16-20 medarbetare' },
  { min: 21, max: Infinity, price: 2449, name: '21+ medarbetare' }
];

/**
 * BerÃ¤knar pris baserat pÃ¥ antal medarbetare
 * @param {number} numAgents - Antal medarbetare/mÃ¤klare
 * @returns {number} MÃ¥nadspris i SEK
 */
function calculatePriceForAgents(numAgents) {
  if (numAgents < 4) return 0; // Under minimum
  const tier = PRICING_TIERS.find(t => numAgents >= t.min && numAgents <= t.max);
  return tier ? tier.price : 0;
}

/**
 * BerÃ¤knar potential fÃ¶r ett fÃ¶retag
 * @param {object} company - FÃ¶retagsobjekt
 * @returns {object} { potential: number, description: string, currentMRR: number, maxMRR: number, upsellMRR: number }
 */
function calculateCompanyPotential(company) {
  const agents = AppState.agents.filter(a => a.companyId === company.id);
  const totalAgents = agents.length;
  const activeAgents = agents.filter(a => a.licens?.status === 'aktiv').length;
  const currentMRR = Number(company.payment) || 0;
  const isCustomer = company.status === 'kund' || currentMRR > 0;
  
  // Kolla om fÃ¶retaget har centralt avtal via sitt varumÃ¤rke
  const brand = AppState.brands.find(b => b.id === company.brandId);
  const hasCentralContract = company.centralContract || (brand && brand.centralContract && brand.centralContract.active);
  
  // Om fÃ¶retaget tÃ¤cks av centralt avtal, ingen potential
  if (hasCentralContract) {
    return {
      potential: 0,
      description: 'TÃ¤cks av centralt avtal',
      currentMRR,
      maxMRR: 0,
      upsellMRR: 0,
      totalAgents,
      activeAgents,
      tier: 'Centralt avtal',
      isCentral: true
    };
  }
  
  // BerÃ¤kna maximal MRR baserat pÃ¥ totalt antal mÃ¤klare
  const maxMRR = calculatePriceForAgents(totalAgents);
  
  // BerÃ¤kna vad de betalar fÃ¶r aktiva licenser
  const currentShouldBeMRR = calculatePriceForAgents(activeAgents);
  
  let potential = 0;
  let description = '';
  let upsellMRR = 0;
  
  if (!isCustomer && totalAgents >= 4) {
    // Ej kund men har tillrÃ¤ckligt med mÃ¤klare - ny kund potential
    potential = maxMRR;
    description = `Ny kund: ${totalAgents} mÃ¤klare â†’ ${formatSek(maxMRR)}/mÃ¥n`;
  } else if (isCustomer && activeAgents < totalAgents && totalAgents >= 4) {
    // Befintlig kund med fler mÃ¤klare Ã¤n licenser - upsell potential
    upsellMRR = maxMRR - currentMRR;
    potential = upsellMRR;
    description = `Upsell: ${totalAgents - activeAgents} mÃ¤klare utan licens â†’ +${formatSek(upsellMRR)}/mÃ¥n`;
  } else if (isCustomer && currentMRR < maxMRR && totalAgents >= 4) {
    // Betalar mindre Ã¤n de borde fÃ¶r antalet mÃ¤klare
    upsellMRR = maxMRR - currentMRR;
    potential = upsellMRR;
    description = `Prisjustering: Borde betala ${formatSek(maxMRR)} â†’ +${formatSek(upsellMRR)}/mÃ¥n`;
  }
  
  return {
    potential,
    description,
    currentMRR,
    maxMRR,
    upsellMRR,
    totalAgents,
    activeAgents,
    tier: PRICING_TIERS.find(t => totalAgents >= t.min && totalAgents <= t.max)?.name || 'Under minimum',
    isCentral: false
  };
}

/**
 * Uppdaterar potentialValue fÃ¶r alla fÃ¶retag automatiskt
 */
function updateAllCompanyPotentials() {
  let updated = 0;
  AppState.companies.forEach(company => {
    const calc = calculateCompanyPotential(company);
    if (calc.potential !== company.potentialValue) {
      company.potentialValue = calc.potential;
      updated++;
    }
  });
  return updated;
}

const AppState = {
  users: [], // interna anvÃ¤ndare
  currentUserId: null,
  brands: [],
  companies: [],
  agents: [],
  notes: [], // {id, entityType, entityId, text, authorId, createdAt}
  tasks: [], // {id, title, dueAt?, ownerId?, done:boolean, entityType?, entityId?}
  contacts: [], // {id, entityType:'brand'|'company', entityId, namn, roll?, email?, telefon?}
  segments: [], // {id, name, icon, color, description, pricingModel, createdAt}
  activeSegmentId: null, // Vilket segment Ã¤r aktivt filtrerat (null = alla)
  undoStack: [] // Stack fÃ¶r Ã¥ngra-funktionalitet: [{type, description, snapshot, timestamp}]
};

async function loadState() {
  // 1) FÃ¶rsÃ¶k hÃ¤mta frÃ¥n server
  try {
    let r = await fetch(`${API_BASE}/api/state`, { credentials: 'include' });
    if (r.status === 401) {
      const ok = await promptServerLogin();
      if (ok) r = await fetch(`${API_BASE}/api/state`, { credentials: 'include' });
    }
    if (r.ok) {
      const data = await r.json();
      if (data && Object.keys(data).length) {
        Object.assign(AppState, data);
        // defensiv init
        AppState.users ||= [];
        AppState.brands ||= [];
        AppState.companies ||= [];
        AppState.agents ||= [];
        AppState.notes ||= [];
        AppState.tasks ||= [];
        AppState.contacts ||= [];
        AppState.segments ||= [];
        AppState.undoStack = []; // Always start fresh (not persisted)
        runMigrations();
        localStorage.setItem(LS_KEY, JSON.stringify(AppState));
        return;
      }
    }
  } catch (e) {
    console.warn('Serverstate kunde inte hÃ¤mtas, anvÃ¤nder cache eller seed.', e);
  }
  // 2) Cache i localStorage
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    try {
      const s = JSON.parse(raw);
      Object.assign(AppState, s);
      AppState.users ||= [];
      AppState.brands ||= [];
      AppState.companies ||= [];
      AppState.agents ||= [];
      AppState.notes ||= [];
      AppState.tasks ||= [];
      AppState.contacts ||= [];
      AppState.segments ||= [];
      runMigrations();
      localStorage.setItem(LS_KEY, JSON.stringify(AppState));
      return;
    } catch {}
  }
  // 3) Seed om inget finns
  AppState.users = DEFAULT_USERS;
  AppState.currentUserId = DEFAULT_USERS[0].id;
  seedExampleData();
  await saveState();
}

async function saveState() {
  // Create a copy without undoStack (to keep localStorage size reasonable)
  const { undoStack, ...stateToSave } = AppState;
  const payload = JSON.stringify(stateToSave);
  localStorage.setItem(LS_KEY, payload);
  try {
    const r = await fetch(`${API_BASE}/api/state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: payload });
    
    // Check for session timeout warning
    const sessionWarning = r.headers.get('X-Session-Warning');
    if (sessionWarning) {
      const secondsLeft = parseInt(sessionWarning);
      if (secondsLeft < 300 && !window.sessionWarningShown) { // 5 minutes
        window.sessionWarningShown = true;
        showNotification(`Din session gÃ¥r ut om ${Math.floor(secondsLeft / 60)} minuter. Spara ditt arbete!`, 'warning');
        setTimeout(() => { window.sessionWarningShown = false; }, 60000); // Reset after 1 minute
      }
    }
    
    if (r.status === 401) {
      const errorData = await r.json().catch(() => ({}));
      if (errorData.error === 'session_timeout') {
        showNotification('Din session har gÃ¥tt ut. Logga in igen.', 'danger');
        window.location.reload();
        return;
      }
      const ok = await promptServerLogin();
      if (ok) {
        await fetch(`${API_BASE}/api/state`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: payload });
      }
    }
  } catch (e) {
    console.warn('Kunde inte spara till server, behÃ¥ller lokalt.', e);
  }
}

function enforceCompanyStatusFromPayment(company) {
  if (!company) return;
  const payment = Number(company.payment) || 0;
  if (payment > 0 && company.status !== 'kund') {
    company.status = 'kund';
  }
}

function runMigrations() {
  if (!Array.isArray(AppState.brands)) return;
  const legacy = AppState.brands.find(b => String(b?.namn || '').trim().toLowerCase() === 'mÃ¤klarkedjan x');
  if (legacy) {
    legacy.namn = 'FristÃ¥ende mÃ¤klarfÃ¶retag';
  }
  if (Array.isArray(AppState.companies)) {
    for (const comp of AppState.companies) {
      enforceCompanyStatusFromPayment(comp);
      if (comp.claudeSonnet4Enabled === undefined) comp.claudeSonnet4Enabled = (comp.status === 'kund');
    }
  }
  
  // Skapa standardsegment om de inte finns
  if (!AppState.segments || AppState.segments.length === 0) {
    AppState.segments = [
      {
        id: 'real-estate',
        name: 'FastighetsmÃ¤klare',
        icon: 'ðŸ ',
        color: 'blue',
        description: 'FastighetsmÃ¤klarfÃ¶retag och mÃ¤klarkedjor',
        pricingModel: 'per-agent',
        createdAt: new Date().toISOString()
      },
      {
        id: 'banking',
        name: 'Banker',
        icon: 'ðŸ¦',
        color: 'green',
        description: 'Banker och finansiella institutioner',
        pricingModel: 'enterprise',
        createdAt: new Date().toISOString()
      },
      {
        id: 'other',
        name: 'Ã–vrigt',
        icon: 'ðŸ“Š',
        color: 'slate',
        description: 'Ã–vriga branscher och kunder',
        pricingModel: 'custom',
        createdAt: new Date().toISOString()
      }
    ];
    console.log('âœ… Skapade standardsegment: FastighetsmÃ¤klare, Banker, Ã–vrigt');
  }
  
  // SÃ¤tt standardsegment pÃ¥ befintliga brands och companies
  if (Array.isArray(AppState.brands)) {
    for (const brand of AppState.brands) {
      if (!brand.segmentId) {
        brand.segmentId = 'real-estate'; // Default till mÃ¤klare fÃ¶r befintlig data
      }
    }
  }
  if (Array.isArray(AppState.companies)) {
    for (const company of AppState.companies) {
      if (!company.segmentId) {
        // Ã„rv frÃ¥n brand om mÃ¶jligt, annars default till mÃ¤klare
        const brand = AppState.brands.find(b => b.id === company.brandId);
        company.segmentId = brand?.segmentId || 'real-estate';
      }
    }
  }
  
  // Auto-seed bankdata om banking-segment finns men inga banker
  const hasBankingSegment = AppState.segments.some(s => s.id === 'banking');
  const hasBankingData = AppState.brands.some(b => b.segmentId === 'banking');
  if (hasBankingSegment && !hasBankingData) {
    seedBankingData();
  }
  
  // Uppdatera alla fÃ¶retags potential automatiskt baserat pÃ¥ prislistan
  const updated = updateAllCompanyPotentials();
  if (updated > 0) {
    console.log(`âœ… Uppdaterade potential fÃ¶r ${updated} fÃ¶retag baserat pÃ¥ prislistan`);
  }
}

async function promptServerLogin() {
  // Ensure modal is initialized
  if (!modal.el) {
    console.warn('Modal not initialized, skipping server login prompt');
    return false;
  }
  
  return new Promise((resolve) => {
    modal.show(`
      <h3>Logga in (server)</h3>
      <div class="grid-2">
        <div class="field"><label>AnvÃ¤ndarnamn (valfritt)</label><input id="srvUser" /></div>
        <div class="field"><label>Eller vÃ¤lj app-anvÃ¤ndare</label>
          <select id="srvUserId"><option value="">â€”</option>${AppState.users.map(u => `<option value="${u.id}">${u.namn}</option>`).join('')}</select>
        </div>
        <div class="field"><label>LÃ¶senord</label><input id="srvPwd" type="password" /></div>
      </div>
      <div class="muted" style="margin-top:6px;">Tips: standardlÃ¶senord Ã¤r <code>admin</code> (om det inte har Ã¤ndrats).</div>
      <div style="margin-top:10px; display:flex; gap:8px;">
        <button class="primary" id="doSrvLogin">Logga in</button>
        <button class="secondary" id="cancelSrvLogin">Avbryt</button>
      </div>
    `);
    const doLogin = async () => {
      const password = document.getElementById('srvPwd').value;
      const username = document.getElementById('srvUser').value.trim();
      const userId = document.getElementById('srvUserId').value || undefined;
      try {
        const r = await fetch(`${API_BASE}/api/login`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ password, username: username||undefined, userId }) });
        if (r.ok) {
          const body = await r.json().catch(()=>({}));
          if (body.userId) { AppState.currentUserId = body.userId; }
          modal.hide(); resolve(true);
        }
        else { alert('Fel lÃ¶senord'); }
      } catch {
        alert('Kunde inte nÃ¥ servern');
      }
    };
    document.getElementById('doSrvLogin').addEventListener('click', doLogin);
    document.getElementById('cancelSrvLogin').addEventListener('click', () => { modal.hide(); resolve(false); });
  });
}

function seedExampleData() {
  // NÃ¥gra varumÃ¤rken
  const b1 = { id: id(), namn: 'FristÃ¥ende mÃ¤klarfÃ¶retag', segmentId: 'real-estate' };
  const b2 = { id: id(), namn: 'Fastighetsbolaget Y', segmentId: 'real-estate' };
  AppState.brands = [b1, b2];

  // NÃ¥gra fÃ¶retag
  const c1 = { id: id(), namn: 'X MalmÃ¶', brandId: b1.id, segmentId: 'real-estate', stad: 'MalmÃ¶', status: 'kund', pipelineStage:'vunnit', potentialValue: 120000 };
  const c2 = { id: id(), namn: 'X Lund', brandId: b1.id, segmentId: 'real-estate', stad: 'Lund', status: 'prospekt', pipelineStage:'offert', potentialValue: 60000 };
  const c3 = { id: id(), namn: 'Y Stockholm', brandId: b2.id, segmentId: 'real-estate', stad: 'Stockholm', status: 'ej', pipelineStage:'kvalificerad', potentialValue: 30000 };
  AppState.companies = [c1, c2, c3];

  // NÃ¥gra mÃ¤klare
  const a1 = { id: id(), fÃ¶rnamn: 'Anna', efternamn: 'Andersson', email: 'anna@xmalmo.se', telefon: '070-111111', companyId: c1.id, status: 'kund', licens: { status: 'aktiv' } };
  const a2 = { id: id(), fÃ¶rnamn: 'BjÃ¶rn', efternamn: 'Berg', email: 'bjorn@xlund.se', telefon: '070-222222', companyId: c2.id, status: 'prospekt', licens: { status: 'ingen' } };
  const a3 = { id: id(), fÃ¶rnamn: 'Cecilia', efternamn: 'Carlsson', email: 'cecilia@y-sthlm.se', telefon: '070-333333', companyId: c3.id, status: 'ej', licens: { status: 'test' } };
  AppState.agents = [a1, a2, a3];

  // Exempel-kontakter (beslutsfattare)
  AppState.contacts = [
    { id: id(), entityType:'company', entityId: c1.id, namn: 'Maria Chef', roll: 'VD', email: 'maria@xmalmo.se', telefon: '070-444444' },
    { id: id(), entityType:'brand', entityId: b1.id, namn: 'Ola Kedjeansvarig', roll: 'Franchisechef', email: 'ola@xkedja.se' }
  ];

  // Exempel-uppgifter
  const today = new Date();
  const tomorrow = new Date(Date.now()+86400000);
  AppState.tasks = [
    { id: id(), title: 'Ring X MalmÃ¶ om licenser', dueAt: tomorrow.toISOString(), ownerId: AppState.currentUserId, done:false, entityType:'company', entityId: c1.id },
    { id: id(), title: 'FÃ¶lj upp testperiod', dueAt: today.toISOString(), ownerId: AppState.users[1].id, done:false, entityType:'agent', entityId: a3.id }
  ];
}

function seedBankingData() {
  console.log('ðŸ¦ Skapar seed-data fÃ¶r svenska storbanker...');
  
  // Svenska storbanker som varumÃ¤rken
  const swedbank = { id: id(), namn: 'Swedbank', segmentId: 'banking', centralContract: { active: false } };
  const handelsbanken = { id: id(), namn: 'Handelsbanken', segmentId: 'banking', centralContract: { active: false } };
  const seb = { id: id(), namn: 'SEB', segmentId: 'banking', centralContract: { active: false } };
  const nordea = { id: id(), namn: 'Nordea', segmentId: 'banking', centralContract: { active: false } };
  const danskeBank = { id: id(), namn: 'Danske Bank', segmentId: 'banking', centralContract: { active: false } };
  const sbab = { id: id(), namn: 'SBAB', segmentId: 'banking', centralContract: { active: false } };
  const lansforsakringar = { id: id(), namn: 'LÃ¤nsfÃ¶rsÃ¤kringar Bank', segmentId: 'banking', centralContract: { active: false } };
  
  const bankBrands = [swedbank, handelsbanken, seb, nordea, danskeBank, sbab, lansforsakringar];
  AppState.brands.push(...bankBrands);
  
  // Swedbank - regionala kontor
  const swedbankStockholm = { 
    id: id(), namn: 'Swedbank Stockholm City', brandId: swedbank.id, segmentId: 'banking',
    stad: 'Stockholm', status: 'prospekt', pipelineStage: 'demo', 
    payment: 0, potentialValue: 25000
  };
  const swedbankGoteborg = { 
    id: id(), namn: 'Swedbank GÃ¶teborg', brandId: swedbank.id, segmentId: 'banking',
    stad: 'GÃ¶teborg', status: 'kund', pipelineStage: 'vunnit',
    payment: 18000, potentialValue: 0
  };
  const swedbankMalmo = { 
    id: id(), namn: 'Swedbank MalmÃ¶', brandId: swedbank.id, segmentId: 'banking',
    stad: 'MalmÃ¶', status: 'prospekt', pipelineStage: 'proposal',
    payment: 0, potentialValue: 22000
  };
  
  // Handelsbanken - kontor
  const handelsbankenStockholm = { 
    id: id(), namn: 'Handelsbanken Stureplan', brandId: handelsbanken.id, segmentId: 'banking',
    stad: 'Stockholm', status: 'kund', pipelineStage: 'vunnit',
    payment: 28000, potentialValue: 0
  };
  const handelsbankenUppsala = { 
    id: id(), namn: 'Handelsbanken Uppsala', brandId: handelsbanken.id, segmentId: 'banking',
    stad: 'Uppsala', status: 'prospekt', pipelineStage: 'qualified',
    payment: 0, potentialValue: 15000
  };
  
  // SEB - kontor
  const sebStockholm = { 
    id: id(), namn: 'SEB Stockholm', brandId: seb.id, segmentId: 'banking',
    stad: 'Stockholm', status: 'kund', pipelineStage: 'vunnit',
    payment: 35000, potentialValue: 0
  };
  const sebGoteborg = { 
    id: id(), namn: 'SEB GÃ¶teborg', brandId: seb.id, segmentId: 'banking',
    stad: 'GÃ¶teborg', status: 'ej', pipelineStage: 'lead',
    payment: 0, potentialValue: 30000
  };
  
  // Nordea - kontor
  const nordeaStockholm = { 
    id: id(), namn: 'Nordea Stockholm Norrmalmstorg', brandId: nordea.id, segmentId: 'banking',
    stad: 'Stockholm', status: 'prospekt', pipelineStage: 'negotiation',
    payment: 0, potentialValue: 40000
  };
  const nordeaMalmo = { 
    id: id(), namn: 'Nordea MalmÃ¶', brandId: nordea.id, segmentId: 'banking',
    stad: 'MalmÃ¶', status: 'kund', pipelineStage: 'vunnit',
    payment: 20000, potentialValue: 0
  };
  
  // Danske Bank
  const danskeBankStockholm = { 
    id: id(), namn: 'Danske Bank Stockholm', brandId: danskeBank.id, segmentId: 'banking',
    stad: 'Stockholm', status: 'ej', pipelineStage: 'lead',
    payment: 0, potentialValue: 25000
  };
  
  // SBAB
  const sbabSolna = { 
    id: id(), namn: 'SBAB Huvudkontor Solna', brandId: sbab.id, segmentId: 'banking',
    stad: 'Solna', status: 'prospekt', pipelineStage: 'demo',
    payment: 0, potentialValue: 18000
  };
  
  // LÃ¤nsfÃ¶rsÃ¤kringar Bank
  const lfStockholm = { 
    id: id(), namn: 'LÃ¤nsfÃ¶rsÃ¤kringar Bank Stockholm', brandId: lansforsakringar.id, segmentId: 'banking',
    stad: 'Stockholm', status: 'kund', pipelineStage: 'vunnit',
    payment: 22000, potentialValue: 0
  };
  
  const bankCompanies = [
    swedbankStockholm, swedbankGoteborg, swedbankMalmo,
    handelsbankenStockholm, handelsbankenUppsala,
    sebStockholm, sebGoteborg,
    nordeaStockholm, nordeaMalmo,
    danskeBankStockholm, sbabSolna, lfStockholm
  ];
  
  AppState.companies.push(...bankCompanies);
  
  // LÃ¤gg till nÃ¥gra bankrÃ¥dgivare (agents anvÃ¤nds fÃ¶r rÃ¥dgivare i bank-segmentet)
  const advisors = [
    { id: id(), fÃ¶rnamn: 'Erik', efternamn: 'Svensson', email: 'erik.svensson@swedbank.se', 
      telefon: '08-5859000', companyId: swedbankGoteborg.id, status: 'kund', 
      licens: { status: 'aktiv' }, roll: 'Privatekonom' },
    { id: id(), fÃ¶rnamn: 'Lisa', efternamn: 'Johansson', email: 'lisa.johansson@handelsbanken.se', 
      telefon: '08-7012000', companyId: handelsbankenStockholm.id, status: 'kund', 
      licens: { status: 'aktiv' }, roll: 'FÃ¶retagsrÃ¥dgivare' },
    { id: id(), fÃ¶rnamn: 'Anders', efternamn: 'BergstrÃ¶m', email: 'anders.bergstrom@seb.se', 
      telefon: '08-7631000', companyId: sebStockholm.id, status: 'kund', 
      licens: { status: 'aktiv' }, roll: 'Privatekonom' },
    { id: id(), fÃ¶rnamn: 'Maria', efternamn: 'Lindberg', email: 'maria.lindberg@nordea.se', 
      telefon: '010-1561000', companyId: nordeaMalmo.id, status: 'kund', 
      licens: { status: 'aktiv' }, roll: 'RÃ¥dgivare' },
    { id: id(), fÃ¶rnamn: 'Johan', efternamn: 'Karlsson', email: 'johan.karlsson@lf.se', 
      telefon: '08-5885000', companyId: lfStockholm.id, status: 'kund', 
      licens: { status: 'aktiv' }, roll: 'Senior rÃ¥dgivare' }
  ];
  
  AppState.agents.push(...advisors);
  
  // LÃ¤gg till kontakter
  const bankContacts = [
    { id: id(), entityType: 'company', entityId: swedbankGoteborg.id, 
      namn: 'Per-Olof Persson', roll: 'Kontorschef', 
      email: 'per-olof.persson@swedbank.se', telefon: '031-6305000' },
    { id: id(), entityType: 'company', entityId: handelsbankenStockholm.id, 
      namn: 'Anna Andersson', roll: 'Regional chef', 
      email: 'anna.andersson@handelsbanken.se', telefon: '08-7012100' },
    { id: id(), entityType: 'brand', entityId: seb.id, 
      namn: 'Magnus Holm', roll: 'Digitaliserings chef', 
      email: 'magnus.holm@seb.se', telefon: '08-7631500' }
  ];
  
  AppState.contacts.push(...bankContacts);
  
  console.log(`âœ… Skapade ${bankBrands.length} banker, ${bankCompanies.length} kontor, ${advisors.length} rÃ¥dgivare`);
}

/**
 * Generates a unique ID using random string
 * @returns {string} Unique identifier
 */
function id() { return Math.random().toString(36).slice(2, 10); }

/**
 * Formats a date to Swedish locale string
 * @param {string|number|Date} d - Date to format
 * @returns {string} Formatted date string
 */
function fmtDate(d) { return new Date(d).toLocaleString('sv-SE'); }

// --- UI Helpers ---
function $(sel, parent=document) { return parent.querySelector(sel); }
function $all(sel, parent=document) { return Array.from(parent.querySelectorAll(sel)); }

let highlightRequest = null;
function queueHighlight(type, id, options = {}) {
  highlightRequest = { type, id, ...options };
}

let modalNavStack = [];
let modalCurrent = null;
function resetModalNavigation() {
  modalNavStack = [];
  modalCurrent = null;
}

function reopenParentContext(parent) {
  if (!parent) return false;
  const opts = { fromStack: true };
  if (parent.childHighlight) opts.childHighlight = parent.childHighlight;
  if (parent.companyPage) opts.companyPage = parent.companyPage;
  if (parent.agentPage) opts.agentPage = parent.agentPage;
  if (parent.filters) opts.filters = parent.filters;
  switch (parent.type) {
    case 'brand': openBrand(parent.id, opts); break;
    case 'company': openCompany(parent.id, opts); break;
    case 'agent': openAgent(parent.id, opts); break;
    default: return false;
  }
  return true;
}

function setView(name) {
  $all('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $all('.view').forEach(v => v.classList.remove('visible'));
  const el = document.getElementById(`view-${name}`);
  el.classList.add('visible');
  renderView(name);
}

function renderTemplate(tplId, target) {
  const tpl = document.getElementById(tplId);
  if (!tpl) {
    console.error('Template not found:', tplId);
    return;
  }
  target.innerHTML = tpl.innerHTML;
}

function tagStatus(s) {
  return `<span class="tag ${s}">${s}</span>`;
}

function currentUser() { return AppState.users.find(u => u.id === AppState.currentUserId); }

function ensureLoggedIn() {
  if (!AppState.currentUserId) openLogin();
}

// --- Modal ---
const modal = {
  el: null,
  init() {
    this.el = document.getElementById('modal');
    if (!this.el) {
      console.warn('Modal element not found, creating fallback');
      return;
    }
    const closeBtn = document.getElementById('modalClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
    this.el.addEventListener('click', (e) => { 
      // Close if clicking on backdrop
      if (e.target === this.el || e.target.classList.contains('custom-modal-backdrop')) {
        this.hide(); 
      }
    });
  },
  show(html) { 
    if (!this.el) return;
    const body = document.getElementById('modalBody');
    if (body) body.innerHTML = html;
    this.el.classList.remove('hidden'); 
  },
  hide() { 
    if (!this.el) return;
    this.el.classList.add('hidden'); 
  }
};

// --- Render Views ---
function renderView(name) {
  switch (name) {
    case 'dashboard': return renderDashboard();
    case 'brands': return renderBrands();
    case 'companies': return renderCompanies();
    case 'agents': return renderAgents();
    case 'pipeline': return renderPipeline();
    case 'customer-success': return renderCustomerSuccess();
    case 'licenses': return renderLicenses();
    case 'import': return renderImport();
    case 'settings': return renderSettings();
  }
}

function renderDashboard() {
  const root = document.getElementById('view-dashboard');
  renderTemplate('tpl-dashboard', root);

  // Determine active segment for dashboard labels
  const activeSegmentId = AppState.activeSegmentId;
  const activeSegment = AppState.segments.find(s => s.id === activeSegmentId);
  const isBanking = activeSegmentId === 'banking';
  
  // Filter data by active segment
  const filteredBrands = activeSegmentId 
    ? AppState.brands.filter(b => b.segmentId === activeSegmentId)
    : AppState.brands;
  const filteredCompanies = activeSegmentId 
    ? AppState.companies.filter(c => c.segmentId === activeSegmentId)
    : AppState.companies;
  const filteredAgents = activeSegmentId 
    ? AppState.agents.filter(a => {
        const company = AppState.companies.find(c => c.id === a.companyId);
        return company && company.segmentId === activeSegmentId;
      })
    : AppState.agents;

  // Unique agents across multiple offices
  const personsMap = new Map();
  for (const a of filteredAgents) {
    const k = personKey(a);
    if (!personsMap.has(k)) personsMap.set(k, []);
    personsMap.get(k).push(a);
  }
  const totalAgents = personsMap.size || 1;
  
  // Normalize agent license status for counts
  function licStatus(a) {
    const s = String(a?.licens?.status||'').trim().toLowerCase();
    return normLicense(s);
  }
  function isActiveLicense(a) { return licStatus(a) === 'aktiv'; }
  // Active licenses counted per person (if any of their records is active)
  let activeLic = 0;
  for (const [k, list] of personsMap.entries()) {
    if (list.some(isActiveLicense)) activeLic++;
  }
  
  
  
  const totalCompanies = filteredCompanies.length || 1;
  const customerCompanies = filteredCompanies.filter(isCompanyCustomer).length;
  const coverage = Math.round((customerCompanies / totalCompanies) * 100);

  document.getElementById('metricCoverage').textContent = `${coverage}%`;
  document.getElementById('metricBrands').textContent = filteredBrands.length;
  document.getElementById('metricCompanies').textContent = filteredCompanies.length;
  
  // Segment-specific label for agents/advisors
  const agentsLabel = isBanking ? 'RÃ¥dgivare' : 'MÃ¤klare';
  const agentsMetric = document.getElementById('metricAgents');
  agentsMetric.textContent = totalAgents;
  const agentsTitle = agentsMetric.closest('.stat').querySelector('.stat-title');
  if (agentsTitle) agentsTitle.textContent = agentsLabel;
  
  document.getElementById('metricActiveLicenses').textContent = activeLic;
  
  // New metrics
  const companyCustomers = filteredCompanies.filter(isCompanyCustomer).length;
  const companyPotential = filteredCompanies.length - companyCustomers;
  const agentsWithLicense = filteredAgents.filter(isActiveLicense).length;
  const agentsPotential = filteredAgents.length - agentsWithLicense;
  const companyMRR = filteredCompanies.reduce((s,c)=> s + (Number(c.payment)||0), 0);
  const brandCentralMRR = filteredBrands.reduce((s,b)=> {
    if (!b?.centralContract?.active) return s;
    const val = Number(b.centralContract?.mrr)||0;
    return s + val;
  }, 0);
  const totalMRR = companyMRR + brandCentralMRR;
  const fmt = (n) => new Intl.NumberFormat('sv-SE').format(n);
  const fmtSek = (n) => {
    try { return new Intl.NumberFormat('sv-SE',{style:'currency', currency:'SEK', maximumFractionDigits:0}).format(n||0); } catch { return `${n||0} kr`; }
  };
  document.getElementById('metricCompanyCustomerPotential').textContent = `${fmt(companyCustomers)} / ${fmt(companyPotential)}`;
  
  // Update label for agents/advisors potential
  const agentPotentialMetric = document.getElementById('metricAgentLicensePotential');
  agentPotentialMetric.textContent = `${fmt(agentsWithLicense)} / ${fmt(agentsPotential)}`;
  const agentPotentialTitle = agentPotentialMetric.closest('.stat').querySelector('.stat-title');
  if (agentPotentialTitle) {
    agentPotentialTitle.textContent = isBanking ? 'RÃ¥dgivare: Licenser / Potential' : 'MÃ¤klare: Licenser / Potential';
  }
  
  document.getElementById('metricTotalMRR').textContent = fmtSek(totalMRR);

  // Tasks list
  const taskList = document.getElementById('taskList');
  const filterSel = document.getElementById('todoFilter');
  const drawTasks = () => {
    const filter = filterSel.value;
    const tasks = AppState.tasks
      .filter(t => filter==='all' || t.ownerId===AppState.currentUserId)
      .sort((a,b) => (a.done===b.done?0:a.done?1:-1) || (new Date(a.dueAt||0) - new Date(b.dueAt||0)));
    taskList.innerHTML = tasks.map(t => `
      <div class="list-item">
        <div>
          <div class="title">${t.title}</div>
          <div class="small">${t.dueAt?('<span class="'+(isOverdue(t)?'overdue':'')+'">FÃ¶rfallo: '+new Date(t.dueAt).toLocaleDateString('sv-SE')+'</span>'):'Ingen fÃ¶rfallodag'} Â· Ã„gare: ${userName(t.ownerId)} ${t.entityType?('Â· ' + entityLabel(t.entityType, t.entityId)) : ''}</div>
        </div>
        <div class="actions">
          ${t.done?'<span class="tag kund">Klar</span>':`<button class="primary" data-done="${t.id}">Markera klar</button>`}
        </div>
      </div>`).join('');
  };
  drawTasks();

  taskList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-done]'); if (!btn) return;
    const tid = btn.dataset.done;
    const t = AppState.tasks.find(x => x.id===tid); if (!t) return;
    t.done = true; saveState(); drawTasks();
  });

  filterSel.addEventListener('change', drawTasks);
  document.getElementById('addTask').addEventListener('click', () => openTaskModal());
  const exportBtn = document.getElementById('exportTasks');
  if (exportBtn) exportBtn.addEventListener('click', () => exportTasksToCsv());
  // Click-through to entity when clicking on a task item (excluding buttons)
  taskList.addEventListener('click', (e) => {
    if (e.target.closest('button')) return; // ignore button clicks
    const item = e.target.closest('.list-item'); if (!item) return;
    const idx = Array.from(taskList.children).indexOf(item);
    const filter = filterSel.value;
    const tasks = AppState.tasks
      .filter(t => filter==='all' || t.ownerId===AppState.currentUserId)
      .sort((a,b) => (a.done===b.done?0:a.done?1:-1) || (new Date(a.dueAt||0) - new Date(b.dueAt||0)));
    const t = tasks[idx]; if (!t) return;
    if (t.entityType==='brand' && t.entityId) openBrand(t.entityId);
    else if (t.entityType==='company' && t.entityId) openCompany(t.entityId);
    else if (t.entityType==='agent' && t.entityId) openAgent(t.entityId);
  });

  // Brand coverage report (group brandless and '(tom)' under 'FristÃ¥ende mÃ¤klarfÃ¶retag')
  const br = document.getElementById('brandReport');
  const placeholder = AppState.brands.find(x => (x.namn||'').trim().toLowerCase() === '(tom)');
  const placeholderId = placeholder?.id || null;

  // Filter by active segment
  const segmentId = AppState.activeSegmentId;
  const segmentFilteredBrands = segmentId 
    ? AppState.brands.filter(b => b.segmentId === segmentId)
    : AppState.brands;
  const segmentFilteredCompanies = segmentId 
    ? AppState.companies.filter(c => c.segmentId === segmentId)
    : AppState.companies;
  const segmentFilteredAgents = segmentId 
    ? AppState.agents.filter(a => {
        const company = AppState.companies.find(c => c.id === a.companyId);
        return company && company.segmentId === segmentId;
      })
    : AppState.agents;

  // Rows for real brands (excluding placeholder)
  const realBrandRows = segmentFilteredBrands
    .filter(b => b.id !== placeholderId)
    .map(b => {
      const comps = segmentFilteredCompanies.filter(c => c.brandId===b.id);
      const compCount = comps.length;
      const compCustomers = comps.filter(isCompanyCustomer).length;
      const compNonCustomers = compCount - compCustomers;
      const brandAgents = segmentFilteredAgents.filter(a => comps.some(c => c.id===a.companyId));
      // Unique by person within this brand
      const uniqueMap = new Map();
      for (const a of brandAgents) {
        const k = personKey(a); if (!uniqueMap.has(k)) uniqueMap.set(k, []);
        uniqueMap.get(k).push(a);
      }
      const agentCount = uniqueMap.size;
      let agentLicensed = 0;
      for (const list of uniqueMap.values()) { if (list.some(isActiveLicense)) agentLicensed++; }
      const agentWithoutLicense = agentCount - agentLicensed;
      const coveragePct = compCount ? Math.round((compCustomers/compCount)*100) : 0;
      return { b, compCount, compCustomers, compNonCustomers, agentCount, agentLicensed, agentWithoutLicense, coveragePct };
    });

  // Synthetic row for unaffiliated companies (no brandId or placeholder brand)
  const unaffCompanies = segmentFilteredCompanies.filter(c => !c.brandId || c.brandId === placeholderId);
  const unaffAgents = segmentFilteredAgents.filter(a => unaffCompanies.some(c => c.id===a.companyId));
  const unaffRow = (() => {
    const compCount = unaffCompanies.length;
    const compCustomers = unaffCompanies.filter(isCompanyCustomer).length;
    const compNonCustomers = compCount - compCustomers;
    const uniqueMap = new Map();
    for (const a of unaffAgents) { const k = personKey(a); if (!uniqueMap.has(k)) uniqueMap.set(k, []); uniqueMap.get(k).push(a); }
    const agentCount = uniqueMap.size;
    let agentLicensed = 0; for (const list of uniqueMap.values()) { if (list.some(isActiveLicense)) agentLicensed++; }
    const agentWithoutLicense = agentCount - agentLicensed;
    const coveragePct = compCount ? Math.round((compCustomers/compCount)*100) : 0;
    
    // Segment-specific label for unaffiliated
    const isBanking = segmentId === 'banking';
    const unaffName = isBanking ? 'FristÃ¥ende banker' : 'FristÃ¥ende mÃ¤klarfÃ¶retag';
    
    return { b: { id:'unaffiliated', namn: unaffName }, compCount, compCustomers, compNonCustomers, agentCount, agentLicensed, agentWithoutLicense, coveragePct };
  })();

  let brandRows = [...realBrandRows, unaffRow];

  // Totals row (include unaffiliated synthetic row)
  const totals = brandRows.reduce((acc, r) => {
    acc.compCount += r.compCount; acc.compCustomers += r.compCustomers; acc.agentCount += r.agentCount; acc.agentLicensed += r.agentLicensed; return acc;
  }, { compCount:0, compCustomers:0, agentCount:0, agentLicensed:0 });
  totals.compNonCustomers = totals.compCount - totals.compCustomers;
  totals.agentWithoutLicense = totals.agentCount - totals.agentLicensed;
  const totalsCoverage = totals.compCount ? Math.round((totals.compCustomers/totals.compCount)*100) : 0;

  let lastCoverageState = null;

  function drawCoverageTable(sortBy = 'companies') {
    const compare = {
      companies: (a,b) => b.compCount - a.compCount,
      agents: (a,b) => b.agentCount - a.agentCount,
      coverage: (a,b) => b.coveragePct - a.coveragePct,
      companies_non: (a,b) => b.compNonCustomers - a.compNonCustomers,
      agents_non: (a,b) => b.agentWithoutLicense - a.agentWithoutLicense
    }[sortBy] || ((a,b) => b.compCount - a.compCount);
    const rows = [...brandRows].sort(compare);
    // Check if state has changed to avoid unnecessary re-renders
    const currentState = {
      sortBy,
      totals: { ...totals, coverage: totalsCoverage },
      rows: rows.map(r => ({ id: r.b.id, compCount: r.compCount, compCustomers: r.compCustomers, compNonCustomers: r.compNonCustomers, agentCount: r.agentCount, agentLicensed: r.agentLicensed, agentWithoutLicense: r.agentWithoutLicense, coveragePct: r.coveragePct }))
    };
    if (lastCoverageState && JSON.stringify(lastCoverageState) === JSON.stringify(currentState)) {
      return; // No changes, skip re-render
    }
    lastCoverageState = currentState;
    // Use DOM methods instead of innerHTML for security and performance
    const fragment = document.createDocumentFragment();
    
    // Segment-specific labels
    const isBanking = segmentId === 'banking';
    const agentLabel = isBanking ? 'RÃ¥dgivare' : 'MÃ¤klare';
    const agentLicenseLabel = isBanking ? 'RÃ¥dgivare utan licens' : 'MÃ¤klare utan licens';
    
    // Header
    const header = document.createElement('div');
    header.className = 'row header';
    header.innerHTML = `<div>VarumÃ¤rke</div><div>FÃ¶retag</div><div>FÃ¶retag ej kund</div><div>${agentLabel}</div><div>${agentLicenseLabel}</div><div>TÃ¤ckning</div>`;
    fragment.appendChild(header);
    // Totals row
    const totalsRow = document.createElement('div');
    totalsRow.className = 'row';
    totalsRow.style.fontWeight = '600';
    totalsRow.style.background = '#f9fafb';
    totalsRow.innerHTML = `<div>Totalt</div><div>${totals.compCount}</div><div>${totals.compNonCustomers}</div><div>${totals.agentCount}</div><div>${totals.agentWithoutLicense}</div><div>${totalsCoverage}%</div>`;
    fragment.appendChild(totalsRow);
    // Data rows
    rows.forEach(r => {
      const row = document.createElement('div');
      row.className = 'row clickable';
      if (r.b.id && r.b.id !== 'unaffiliated') {
        row.dataset.brandId = r.b.id;
      } else {
        row.dataset.brandId = 'unaffiliated';
      }
      row.innerHTML = `<div>${r.b.namn}</div><div>${r.compCount}</div><div>${r.compNonCustomers}</div><div>${r.agentCount}</div><div>${r.agentWithoutLicense}</div><div>${r.coveragePct}%</div>`;
      fragment.appendChild(row);
    });
    br.innerHTML = '';
    br.appendChild(fragment);
  }
  drawCoverageTable('companies');

  const sortSel = document.getElementById('coverageSort');
  if (sortSel) sortSel.addEventListener('change', () => drawCoverageTable(sortSel.value));

  br.addEventListener('click', (e) => {
    const row = e.target.closest('.row[data-brand-id]');
    if (!row) return;
    const brandId = row.dataset.brandId;
    if (!brandId) return;
    if (brandId === 'unaffiliated') {
      // Show companies view filtered to show only companies without a brand
      setView('companies');
      const brandSelect = document.getElementById('companyBrandFilter');
      if (brandSelect) {
        brandSelect.value = 'unaffiliated';
        brandSelect.dispatchEvent(new Event('change'));
      }
    } else {
      openBrand(brandId);
    }
  });

  const exportBtn2 = document.getElementById('exportCoverage');
  if (exportBtn2) exportBtn2.addEventListener('click', () => {
    const rows = [...brandRows]
      .map(r => ({
        ...r,
        compCustomers: r.b.id==='unaffiliated'
          ? AppState.companies.filter(c => !c.brandId || c.brandId===placeholderId).filter(isCompanyCustomer).length
          : AppState.companies.filter(c => c.brandId===r.b.id).filter(isCompanyCustomer).length,
      }))
      .map(r => ({
        ...r,
        compNonCustomers: r.compCount - r.compCustomers,
        coveragePct: r.compCount ? Math.round((r.compCustomers/r.compCount)*100) : 0,
      }))
      .sort((a,b)=> b.compCount - a.compCount);
    const csv = [
      ['VarumÃ¤rke','FÃ¶retag','FÃ¶retag ej kund','MÃ¤klare','MÃ¤klare utan licens','TÃ¤ckning %'].join(',')
    ].concat(rows.map(r => [r.b.namn, r.compCount, r.compNonCustomers, r.agentCount, r.agentWithoutLicense, r.coveragePct]
      .map(v => `"${String(v).replaceAll('"','""')}"`).join(','))).join('\n');
    downloadCsv(csv, `kedjetackning_${Date.now()}.csv`);
  });
}

function isOverdue(t) {
  if (!t.dueAt || t.done) return false;
  return new Date(t.dueAt).setHours(23,59,59,999) < Date.now();
}

function userName(uid) { return AppState.users.find(u => u.id === uid)?.namn || 'OkÃ¤nd'; }

function renderBrands() {
  const root = document.getElementById('view-brands');
  renderTemplate('tpl-brands', root);
  const table = document.getElementById('brandTable');
  const isAdmin = (currentUser()?.roll === 'admin');
  const pageSizeSel = document.getElementById('brandPageSize');
  const pageInfo = document.getElementById('brandPageInfo');
  const prevBtn = document.getElementById('brandPrev');
  const nextBtn = document.getElementById('brandNext');
  let page = 1;
  let sortKey = 'name';
  let sortAsc = true;

  const highlightData = (highlightRequest && highlightRequest.type === 'brand') ? highlightRequest : null;
  let highlightApplied = false;

  // Pre-compute brand metrics once to avoid repeated filtering
  const brandMetrics = new Map();
  
  // Build company-to-brand index for fast lookups
  const companyIdToBrandId = new Map();
  for (const c of AppState.companies) {
    companyIdToBrandId.set(c.id, c.brandId);
  }
  
  // Group companies and agents by brand
  const companiesByBrand = new Map();
  const agentsByBrand = new Map();
  
  for (const b of AppState.brands) {
    companiesByBrand.set(b.id, []);
    agentsByBrand.set(b.id, []);
  }
  
  for (const c of AppState.companies) {
    if (c.brandId && companiesByBrand.has(c.brandId)) {
      companiesByBrand.get(c.brandId).push(c);
    }
  }
  
  for (const a of AppState.agents) {
    const brandId = companyIdToBrandId.get(a.companyId);
    if (brandId && agentsByBrand.has(brandId)) {
      agentsByBrand.get(brandId).push(a);
    }
  }
  
  // Calculate metrics for each brand
  for (const b of AppState.brands) {
    const comps = companiesByBrand.get(b.id) || [];
    const agents = agentsByBrand.get(b.id) || [];
    const customers = agents.filter(a => a.status === 'kund').length;
    const statusAgg = customers > agents.length/2 ? 'kund' : (customers>0 ? 'prospekt' : 'ej');
    const centralMrr = b.centralContract?.active ? (Number(b.centralContract?.mrr)||0) : 0;
    const mrr = comps.reduce((s,c) => s + (Number(c.payment)||0), 0) + centralMrr;
    const centralProduct = b.centralContract?.active ? (b.centralContract?.product||'~') : '';
    
    brandMetrics.set(b.id, {
      comps,
      agents,
      compCount: comps.length,
      agentCount: agents.length,
      customers,
      statusAgg,
      mrr,
      centralMrr,
      centralProduct
    });
  }

  function draw() {
    const size = Number(pageSizeSel.value)||25;
    const rank = { ej:0, prospekt:1, kund:2 };
    const activeSegmentId = AppState.activeSegmentId;
    
    // Filter brands by active segment
    const filteredBrands = activeSegmentId 
      ? AppState.brands.filter(b => b.segmentId === activeSegmentId)
      : AppState.brands;
    
    const sorter = (a,b) => {
      const metricsA = brandMetrics.get(a.id);
      const metricsB = brandMetrics.get(b.id);
      
      const map = {
        name: () => a.namn.localeCompare(b.namn, 'sv'),
        companies: () => metricsA.compCount - metricsB.compCount,
        agents: () => metricsA.agentCount - metricsB.agentCount,
        mrr: () => metricsA.mrr - metricsB.mrr,
        central: () => metricsA.centralProduct.localeCompare(metricsB.centralProduct, 'sv'),
        status: () => (rank[metricsA.statusAgg] - rank[metricsB.statusAgg])
      };
      const cmp = (map[sortKey]||map.name)();
      return sortAsc ? cmp : -cmp;
    };
    
    const sorted = [...filteredBrands].sort(sorter);
    if (highlightData && !highlightApplied) {
      const idx = sorted.findIndex(b => b.id === highlightData.id);
      if (idx >= 0) {
        const pageSize = size || 1;
        page = Math.floor(idx / pageSize) + 1;
      }
    }
    const total = filteredBrands.length;
    const maxPage = Math.max(1, Math.ceil(total/size));
    if (page>maxPage) page=maxPage;
    const start = (page-1)*size;
    const rows = sorted.slice(start, start+size);
    
    // Build modern layout
    const fragment = document.createDocumentFragment();
    
    // Header with sort indicators
    const header = document.createElement('div');
    header.className = 'row header';
    const sortIcon = (key) => sortKey === key ? (sortAsc ? ' â–²' : ' â–¼') : '';
    header.innerHTML = '<div data-sort="name" style="flex: 2; font-weight: 600;">VarumÃ¤rke' + sortIcon('name') + '</div><div data-sort="companies" style="flex: 1; text-align: center;">FÃ¶retag' + sortIcon('companies') + '</div><div data-sort="agents" style="flex: 1; text-align: center;">MÃ¤klare' + sortIcon('agents') + '</div><div data-sort="mrr" style="flex: 1; text-align: right;">MRR' + sortIcon('mrr') + '</div><div data-sort="status" style="flex: 1;">Status' + sortIcon('status') + '</div><div style="flex: 1; text-align: right;">Ã…tgÃ¤rder</div>';
    fragment.appendChild(header);
    
    // Data rows
    rows.forEach(b => {
      const metrics = brandMetrics.get(b.id);
      const row = document.createElement('div');
      row.className = 'row clickable';
      row.dataset.brandId = b.id;
      row.style.cssText = 'align-items: center; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; transition: background 0.15s; cursor: pointer;';
      
      // Brand name column
      const nameCol = document.createElement('div');
      nameCol.style.cssText = 'flex: 2; display: flex; flex-direction: column; gap: 4px;';
      const brandName = document.createElement('div');
      brandName.style.cssText = 'font-weight: 600; font-size: 15px; color: #111827;';
      brandName.textContent = b.namn;
      nameCol.appendChild(brandName);
      
      // Central contract info
      if (b.centralContract && b.centralContract.active) {
        const centralInfo = document.createElement('div');
        centralInfo.style.cssText = 'font-size: 13px; color: #6b7280; display: flex; gap: 8px; align-items: center;';
        const badge = document.createElement('span');
        badge.style.cssText = 'display: inline-block; padding: 2px 8px; background: #dbeafe; color: #1e40af; border-radius: 9999px; font-size: 11px; font-weight: 600;';
        badge.textContent = 'CENTRALT AVTAL';
        centralInfo.appendChild(badge);
        const parts = [];
        if (b.centralContract.product) parts.push(b.centralContract.product);
        if (b.centralContract.mrr) parts.push(formatSek(Number(b.centralContract.mrr)));
        if (parts.length > 0) {
          const text = document.createElement('span');
          text.textContent = parts.join(' Â· ');
          centralInfo.appendChild(text);
        }
        nameCol.appendChild(centralInfo);
      }
      row.appendChild(nameCol);
      
      // Companies count
      const compCol = document.createElement('div');
      compCol.style.cssText = 'flex: 1; text-align: center; font-size: 15px; font-weight: 600; color: #374151;';
      compCol.textContent = metrics.compCount || '0';
      row.appendChild(compCol);
      
      // Agents count
      const agentCol = document.createElement('div');
      agentCol.style.cssText = 'flex: 1; text-align: center; font-size: 15px; font-weight: 600; color: #374151;';
      agentCol.textContent = metrics.agentCount || '0';
      row.appendChild(agentCol);
      
      // MRR
      const mrrCol = document.createElement('div');
      mrrCol.style.cssText = 'flex: 1; text-align: right; font-weight: 600; font-size: 15px; color: #059669;';
      mrrCol.textContent = metrics.mrr ? formatSek(metrics.mrr) : 'â€“';
      row.appendChild(mrrCol);
      
      // Status with colored badge
      const statusCol = document.createElement('div');
      statusCol.style.cssText = 'flex: 1;';
      const statusBadge = document.createElement('span');
      const statusColors = {
        kund: { bg: '#d1fae5', text: '#065f46', icon: 'âœ“' },
        prospekt: { bg: '#fef3c7', text: '#92400e', icon: 'â³' },
        ej: { bg: '#f3f4f6', text: '#6b7280', icon: 'â—‹' }
      };
      const statusColor = statusColors[metrics.statusAgg] || statusColors.ej;
      statusBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; background: ' + statusColor.bg + '; color: ' + statusColor.text + '; border-radius: 9999px; font-size: 13px; font-weight: 600;';
      statusBadge.innerHTML = '<span>' + statusColor.icon + '</span> ' + (metrics.statusAgg === 'kund' ? 'Kund' : metrics.statusAgg === 'prospekt' ? 'Prospekt' : 'Ej kontakt');
      statusCol.appendChild(statusBadge);
      row.appendChild(statusCol);
      
      // Actions
      const actionsCol = document.createElement('div');
      actionsCol.className = 'actions';
      actionsCol.style.cssText = 'flex: 1; display: flex; gap: 6px; justify-content: flex-end;';
      const editButton = '<button class="secondary" data-action="edit-name" data-id="' + b.id + '" style="padding: 6px 12px; font-size: 13px;" title="Redigera varumÃ¤rkesnamn">âœï¸</button>';
      actionsCol.innerHTML = '<button class="secondary" data-action="open" data-id="' + b.id + '" style="padding: 6px 12px; font-size: 13px;">Ã–ppna</button>' + editButton + '<button class="secondary" data-action="note" data-id="' + b.id + '" style="padding: 6px 12px; font-size: 13px;">ðŸ“</button>';
      row.appendChild(actionsCol);
      
      fragment.appendChild(row);
    });
    
    table.innerHTML = '';
    table.appendChild(fragment);
    
    pageInfo.textContent = total ? `Sida ${page} av ${maxPage} Â· ${total} varumÃ¤rken` : 'Inga varumÃ¤rken';
    prevBtn.disabled = (page<=1);
    nextBtn.disabled = (page>=maxPage);

    if (highlightData && !highlightApplied) {
      const rowEl = table.querySelector(`.row[data-brand-id="${highlightData.id}"]`);
      highlightApplied = true;
      highlightRequest = null;
      if (rowEl) {
        rowEl.classList.add('highlight');
        rowEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => rowEl.classList.remove('highlight'), 1800);
      }
    }
  }

  draw();
  pageSizeSel.addEventListener('change', () => { page = 1; draw(); });
  prevBtn.addEventListener('click', () => { if (page>1) { page--; draw(); } });
  nextBtn.addEventListener('click', () => { page++; draw(); });

  // Sorting by clicking headers
  table.addEventListener('click', (e) => {
    const sortHeader = e.target.closest('.row.header [data-sort]');
    if (sortHeader) {
      const newKey = sortHeader.dataset.sort;
      if (sortKey === newKey) {
        sortAsc = !sortAsc;
      } else {
        sortKey = newKey;
        sortAsc = true;
      }
      draw();
      return;
    }
    
    // Row click to open brand (but not if clicking on buttons or actions)
    // Let button clicks bubble up to handleGlobalClick
    const clickedButton = e.target.closest('button');
    const clickedActions = e.target.closest('.actions');
    if (clickedButton || clickedActions) {
      // Don't handle row click, let global handler deal with buttons
      return;
    }
    
    const row = e.target.closest('.row[data-brand-id]');
    if (row && !row.classList.contains('header')) {
      const brandId = row.dataset.brandId;
      if (brandId) openBrand(brandId);
    }
  });

  document.getElementById('addBrand').addEventListener('click', () => openBrandModal());
}

function openBrand(id, options = {}) {
  const sameContext = modalCurrent && modalCurrent.type === 'brand' && modalCurrent.id === id;
  if (!options.fromStack && !sameContext) {
    resetModalNavigation();
  }
  modalCurrent = { type: 'brand', id };
  const b = AppState.brands.find(x => x.id === id);
  const compsAll = AppState.companies.filter(c => c.brandId === id);
  const agentsAll = AppState.agents.filter(a => compsAll.some(c => c.id === a.companyId));
  const childHighlightId = options.childHighlight?.type === 'company' ? options.childHighlight.id : null;
  let childHighlightApplied = false;
  const hasCentralMrr = b.centralContract?.mrr !== undefined && b.centralContract?.mrr !== null;
  const centralMrrDisplay = (b.centralContract?.active && hasCentralMrr) ? formatSek(Number(b.centralContract.mrr)||0) : '';
  modal.show(`
    <h3>${b.namn}</h3>
  <div class="modal-toolbar"><button class="secondary toolbar-back" id="brandBackLink" type="button">â€¹ Tillbaka till lista</button></div>
    <div class="muted">FÃ¶retag: ${compsAll.length} Â· MÃ¤klare: ${agentsAll.length}</div>
    ${centralMrrDisplay ? `<div class="muted">Central MRR: ${centralMrrDisplay}</div>` : ''}
    <h4 style="margin-top:12px;">Centralt avtal</h4>
    <div class="grid-2">
      <div class="field">
        <label>Aktivt centralt avtal</label>
        <input id="brandCentralActive" type="checkbox" ${b.centralContract?.active?'checked':''} />
      </div>
      <div class="field">
        <label>Produkt (centralt)</label>
        <input id="brandCentralProduct" value="${b.centralContract?.product||''}" />
      </div>
      <div class="field">
        <label>MRR (centralt, SEK/mÃ¥n)</label>
        <input id="brandCentralMrr" inputmode="decimal" value="${b.centralContract?.mrr ?? ''}" placeholder="t.ex. 25000" />
      </div>
    </div>
    <h4 style="margin-top:12px;">Beslutsfattare</h4>
    <div class="list" id="brandContacts">
      ${AppState.contacts.filter(c => c.entityType==='brand' && c.entityId===b.id).map(c => contactRow(c)).join('')}
    </div>
    <div style="margin:8px 0;">
      <button class="secondary" id="addBrandContact">LÃ¤gg till kontakt</button>
      <button class="secondary" id="addBrandTask">Ny uppgift</button>
    </div>
    <div class="list" style="margin-top:10px;" id="brandCompanies"></div>
    <div style="display:flex; align-items:center; gap:8px; justify-content:flex-end; margin-top:6px;">
      <span class="muted" id="brandCompaniesInfo"></span>
      <button class="secondary" id="brandCompaniesPrev">FÃ¶regÃ¥ende</button>
      <button class="secondary" id="brandCompaniesNext">NÃ¤sta</button>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px; justify-content:flex-end;">
      <button class="primary" id="saveBrandCentral">Spara</button>
      <button class="secondary" id="brandBackToList">Tillbaka till lista</button>
      <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
    </div>
  `);
  // Paginate brand companies list
  const listEl = $('#modalBody').querySelector('#brandCompanies');
  const infoEl = $('#modalBody').querySelector('#brandCompaniesInfo');
  const prevBtn = $('#modalBody').querySelector('#brandCompaniesPrev');
  const nextBtn = $('#modalBody').querySelector('#brandCompaniesNext');
  const size = 25;
  let page = Math.max(1, options.companyPage || 1);
  let pendingHighlightId = childHighlightId;
  function drawCompanies() {
    const total = compsAll.length;
    const maxPage = Math.max(1, Math.ceil(total/size));
    if (pendingHighlightId && !childHighlightApplied) {
      const highlightIndex = compsAll.findIndex(c => c.id === pendingHighlightId);
      if (highlightIndex >= 0) {
        page = Math.floor(highlightIndex / size) + 1;
      }
    }
    if (page > maxPage) page = maxPage;
    if (page < 1) page = 1;
    const start = (page-1)*size;
    const rows = compsAll.slice(start, start+size);
    listEl.innerHTML = rows.map(c => `<div class="list-item" data-company-row="${c.id}">
      <div>
        <div class="title">${c.namn}</div>
        <div class="subtitle">${c.stad||''} Â· ${tagStatus(c.status)}${c.centralContract?' Â· centralt':''}</div>
      </div>
      <div class="actions">
        <button class="secondary" data-open-company="${c.id}">Ã–ppna</button>
        <button class="secondary" data-add-task-company="${c.id}">Uppgift</button>
      </div>
    </div>`).join('');
    infoEl.textContent = total ? `Sida ${page} av ${maxPage} Â· ${total} fÃ¶retag` : 'Inga fÃ¶retag';
    prevBtn.disabled = (page<=1); nextBtn.disabled = (page>=maxPage);
    if (pendingHighlightId && !childHighlightApplied) {
      const rowEl = listEl.querySelector(`.list-item[data-company-row="${pendingHighlightId}"]`);
      if (rowEl) {
        rowEl.classList.add('highlight');
        rowEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => rowEl.classList.remove('highlight'), 1800);
        childHighlightApplied = true;
        pendingHighlightId = null;
      }
    }
  }
  drawCompanies();
  prevBtn.addEventListener('click', () => { if (page>1) { page--; drawCompanies(); } });
  nextBtn.addEventListener('click', () => { page++; drawCompanies(); });
  $('#modalBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const cid = btn.dataset.openCompany; if (cid) {
      modalNavStack.push({ type:'brand', id: b.id, childHighlight: { type:'company', id: cid }, companyPage: page });
      modal.hide();
      modalCurrent = null;
      openCompany(cid, { fromParent: true });
      return;
    }
    if (btn.id==='addBrandContact') openContactModal('brand', b.id);
    if (btn.id==='addBrandTask') openTaskModal({entityType:'brand', entityId:b.id});
    const addTaskForCompany = btn.dataset.addTaskCompany; if (addTaskForCompany) openTaskModal({entityType:'company', entityId:addTaskForCompany});
  });

  const activeInput = document.getElementById('brandCentralActive');
  const productInput = document.getElementById('brandCentralProduct');
  const mrrInput = document.getElementById('brandCentralMrr');
  const syncCentralInputs = () => {
    const enabled = !!activeInput?.checked;
    [productInput, mrrInput].forEach(el => { if (!el) return; el.disabled = !enabled; });
  };
  if (activeInput) {
    syncCentralInputs();
    activeInput.addEventListener('change', syncCentralInputs);
  }

  // Save central contract and propagate to companies
  const saveBtn = $('#modalBody').querySelector('#saveBrandCentral');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    const active = !!document.getElementById('brandCentralActive').checked;
    const product = document.getElementById('brandCentralProduct').value.trim();
    const rawMrr = mrrInput ? mrrInput.value.trim() : '';
    const parseMrr = (val) => {
      if (!val) return null;
      const normalized = val.replace(/\s+/g,'').replace(/,/g,'.').replace(/[^0-9+\-\.]/g,'');
      if (!normalized) return null;
      const num = Number(normalized);
      return Number.isFinite(num) ? num : null;
    };
    const mrr = parseMrr(rawMrr);
    b.centralContract = { active, product };
    if (mrr !== null) b.centralContract.mrr = mrr;
    if (active) {
      for (const c of compsAll) {
        c.status = 'kund';
        c.centralContract = true;
        if (!c.product && product) c.product = product;
      }
    } else {
      for (const c of compsAll) {
        if (c.centralContract) delete c.centralContract;
      }
    }
    saveState();
    modal.hide();
    renderBrands(); renderCompanies(); renderDashboard();
  });

  const brandBackBtn = $('#modalBody').querySelector('#brandBackToList');
  const brandBackLink = $('#modalBody').querySelector('#brandBackLink');
  const goBack = () => {
    const parent = modalNavStack.pop();
    if (parent) {
      modal.hide();
      modalCurrent = null;
      reopenParentContext(parent);
      return;
    }
    modal.hide();
    resetModalNavigation();
    queueHighlight('brand', b.id);
    setView('brands');
  };
  [brandBackBtn, brandBackLink].forEach(btn => btn && btn.addEventListener('click', goBack));

  // --- Brand tasks and notes (with delete/complete) ---
  const bodyEl = document.getElementById('modalBody');
  const brandTasksWrap = document.createElement('div');
  brandTasksWrap.className = 'subpanel';
  brandTasksWrap.innerHTML = `
    <div class="subpanel-header"><h3>Uppgifter (varumÃ¤rke)</h3></div>
    <div class="list" id="brandTasks"></div>
    <div style="margin:8px 0;"><button class="secondary" id="addBrandTask2">Ny uppgift</button></div>
  `;
  const brandNotesWrap = document.createElement('div');
  brandNotesWrap.className = 'subpanel';
  brandNotesWrap.innerHTML = `
    <div class="subpanel-header"><h3>Anteckningar</h3></div>
    <div class="list" id="brandNotes"></div>
    <div style="margin:8px 0;"><button class="secondary" id="addBrandNote2">Ny anteckning</button></div>
  `;
  bodyEl.appendChild(brandTasksWrap);
  bodyEl.appendChild(brandNotesWrap);
  const brandTasksList = document.getElementById('brandTasks');
  const brandNotesList = document.getElementById('brandNotes');
  const drawBrandTN = () => {
    brandTasksList.innerHTML = AppState.tasks.filter(t=>t.entityType==='brand'&&t.entityId===b.id).map(taskRow).join('');
    brandNotesList.innerHTML = AppState.notes.filter(n=>n.entityType==='brand'&&n.entityId===b.id).map(noteRow).join('');
  };
  drawBrandTN();
  brandTasksWrap.addEventListener('click',(e)=>{
    const del = e.target.closest('button[data-del-task]');
    if (del){ AppState.tasks = AppState.tasks.filter(t=>t.id!==del.dataset.delTask); saveState(); drawBrandTN(); return; }
    const done = e.target.closest('button[data-done]');
    if (done){ const t = AppState.tasks.find(x=>x.id===done.dataset.done); if(t){ t.done=true; saveState(); drawBrandTN(); } }
    const edit = e.target.closest('button[data-edit-task]');
    if (edit){ openTaskModal({ taskId: edit.dataset.editTask }); }
  });
  brandNotesWrap.addEventListener('click',(e)=>{
    const del=e.target.closest('button[data-del-note]');
    if (del){ AppState.notes = AppState.notes.filter(n=>n.id!==del.dataset.delNote); saveState(); drawBrandTN(); return; }
    const edit=e.target.closest('button[data-edit-note]');
    if (edit){ openNoteModal('brand', b.id, edit.dataset.editNote); }
  });
  document.getElementById('addBrandTask2').addEventListener('click',()=>openTaskModal({entityType:'brand', entityId:b.id}));
  document.getElementById('addBrandNote2').addEventListener('click',()=>openNoteModal('brand', b.id));
}

function openBrandModal() {
  const segmentOptions = (AppState.segments || []).map(s => 
    `<option value="${s.id}">${s.icon} ${s.name}</option>`
  ).join('');
  
  modal.show(`
    <h3>Nytt varumÃ¤rke</h3>
    <div class="field"><label>Namn</label><input id="brandName" /></div>
    <div class="field">
      <label>Segment</label>
      <select id="brandSegment">
        <option value="">VÃ¤lj segment...</option>
        ${segmentOptions}
      </select>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="primary" id="saveBrand">Spara</button>
      <button class="secondary" onclick="modal.hide()">Avbryt</button>
    </div>
  `);
  $('#saveBrand').addEventListener('click', () => {
    const namn = $('#brandName').value.trim(); 
    const segmentId = $('#brandSegment').value || 'real-estate'; // Default to real-estate
    if (!namn) return;
    AppState.brands.push({ id: id(), namn, segmentId });
    saveState(); modal.hide(); renderBrands();
  });
}

async function openEditBrandNameModal(brandId) {
  const brand = AppState.brands.find(b => b.id === brandId);
  if (!brand) {
    alert('VarumÃ¤rke hittades inte');
    return;
  }

  modal.show(`
    <h3>Redigera varumÃ¤rkesnamn</h3>
    <div class="field">
      <label>Nuvarande namn: <strong>${escapeHTML(brand.namn)}</strong></label>
      <label>Nytt namn</label>
      <input id="editBrandName" value="${escapeHTML(brand.namn)}" maxlength="200" />
      <div class="field-help">Maximal lÃ¤ngd: 200 tecken</div>
    </div>
    <div id="editBrandError" class="error-message" style="display: none;"></div>
    <div id="editBrandSpinner" class="spinner" style="display: none;">
      <div class="spinner-icon">â³</div>
      <span>Uppdaterar...</span>
    </div>
    <div style="margin-top:15px; display:flex; gap:8px;">
      <button class="primary" id="saveEditBrand">Spara Ã¤ndringar</button>
      <button class="secondary" onclick="modal.hide()">Avbryt</button>
    </div>
  `);

  const nameInput = $('#editBrandName');
  const errorDiv = $('#editBrandError');
  const spinner = $('#editBrandSpinner');
  
  // Focus and select text for easy editing
  nameInput.focus();
  nameInput.select();

  // Real-time validation
  nameInput.addEventListener('input', () => {
    const newName = nameInput.value.trim();
    if (newName.length === 0) {
      showFieldError(errorDiv, 'Namn kan inte vara tomt');
    } else if (newName.length > 200) {
      showFieldError(errorDiv, 'Namnet Ã¤r fÃ¶r lÃ¥ngt (max 200 tecken)');
    } else if (newName.toLowerCase() === brand.namn.toLowerCase()) {
      hideFieldError(errorDiv);
    } else {
      // Check for duplicates in real-time
      const duplicate = AppState.brands.find(b => 
        b.id !== brandId && 
        b.namn.toLowerCase() === newName.toLowerCase()
      );
      if (duplicate) {
        showFieldError(errorDiv, 'Ett varumÃ¤rke med detta namn finns redan');
      } else {
        hideFieldError(errorDiv);
      }
    }
  });

  $('#saveEditBrand').addEventListener('click', async () => {
    const newName = nameInput.value.trim();
    
    if (newName.length === 0) {
      showFieldError(errorDiv, 'Namn kan inte vara tomt');
      nameInput.focus();
      return;
    }
    
    if (newName.length > 200) {
      showFieldError(errorDiv, 'Namnet Ã¤r fÃ¶r lÃ¥ngt (max 200 tecken)');
      nameInput.focus();
      return;
    }
    
    if (newName === brand.namn) {
      modal.hide();
      return;
    }

    // Check for duplicates
    const duplicate = AppState.brands.find(b => 
      b.id !== brandId && 
      b.namn.toLowerCase() === newName.toLowerCase()
    );
    
    if (duplicate) {
      showFieldError(errorDiv, 'Ett varumÃ¤rke med detta namn finns redan');
      nameInput.focus();
      return;
    }

    try {
      spinner.style.display = 'flex';
      nameInput.disabled = true;
      
      const response = await fetch(`/api/brands/${brandId}/name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ namn: newName })
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        // Update local state
        brand.namn = newName;
        
        // Show success and close modal
        showSuccessMessage(result.message || 'VarumÃ¤rkesnamn uppdaterat');
        modal.hide();
        
        // Refresh views
        renderBrands();
        renderCompanies(); // May need to update company list with new brand name
        renderDashboard();
        
      } else {
        let errorMsg = 'Ett fel uppstod vid uppdatering';
        
        if (result.error === 'duplicate_name') {
          errorMsg = result.message || 'Ett varumÃ¤rke med detta namn finns redan';
        } else if (result.error === 'invalid_name') {
          errorMsg = 'Ogiltigt namn';
        } else if (result.error === 'name_too_long') {
          errorMsg = 'Namnet Ã¤r fÃ¶r lÃ¥ngt';
        } else if (result.error === 'brand_not_found') {
          errorMsg = 'VarumÃ¤rket hittades inte';
        }
        
        showFieldError(errorDiv, errorMsg);
      }
      
    } catch (error) {
      console.error('Edit brand name failed:', error);
      showFieldError(errorDiv, 'NÃ¤tverksfel - fÃ¶rsÃ¶k igen');
    } finally {
      spinner.style.display = 'none';
      nameInput.disabled = false;
      nameInput.focus();
    }
  });

  // Submit on Enter key
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#saveEditBrand').click();
    }
  });
}

async function openEditCompanyNameModal(companyId) {
  const company = AppState.companies.find(c => c.id === companyId);
  if (!company) {
    alert('FÃ¶retag hittades inte');
    return;
  }

  // Get brand name for context
  const brand = AppState.brands.find(b => b.id === company.brandId);
  const brandContext = brand ? brand.namn : 'FristÃ¥ende';

  modal.show(`
    <h3>Redigera fÃ¶retagsnamn</h3>
    <div class="field">
      <label>VarumÃ¤rke: <strong>${escapeHTML(brandContext)}</strong></label>
      <label>Nuvarande namn: <strong>${escapeHTML(company.namn)}</strong></label>
      <label>Nytt namn</label>
      <input id="editCompanyName" value="${escapeHTML(company.namn)}" maxlength="200" />
      <div class="field-help">Maximal lÃ¤ngd: 200 tecken</div>
    </div>
    <div id="editCompanyError" class="error-message" style="display: none;"></div>
    <div id="editCompanySpinner" class="spinner" style="display: none;">
      <div class="spinner-icon">â³</div>
      <span>Uppdaterar...</span>
    </div>
    <div style="margin-top:15px; display:flex; gap:8px;">
      <button class="primary" id="saveEditCompany">Spara Ã¤ndringar</button>
      <button class="secondary" onclick="modal.hide()">Avbryt</button>
    </div>
  `);

  const nameInput = $('#editCompanyName');
  const errorDiv = $('#editCompanyError');
  const spinner = $('#editCompanySpinner');
  
  // Focus and select text for easy editing
  nameInput.focus();
  nameInput.select();

  // Real-time validation
  nameInput.addEventListener('input', () => {
    const newName = nameInput.value.trim();
    if (newName.length === 0) {
      showFieldError(errorDiv, 'Namn kan inte vara tomt');
    } else if (newName.length > 200) {
      showFieldError(errorDiv, 'Namnet Ã¤r fÃ¶r lÃ¥ngt (max 200 tecken)');
    } else if (newName.toLowerCase() === company.namn.toLowerCase()) {
      hideFieldError(errorDiv);
    } else {
      // Check for duplicates within the same brand
      const duplicate = AppState.companies.find(c => 
        c.id !== companyId && 
        c.brandId === company.brandId &&
        c.namn.toLowerCase() === newName.toLowerCase()
      );
      if (duplicate) {
        showFieldError(errorDiv, 'Ett fÃ¶retag med detta namn finns redan inom samma varumÃ¤rke');
      } else {
        hideFieldError(errorDiv);
      }
    }
  });

  $('#saveEditCompany').addEventListener('click', async () => {
    const newName = nameInput.value.trim();
    
    if (newName.length === 0) {
      showFieldError(errorDiv, 'Namn kan inte vara tomt');
      nameInput.focus();
      return;
    }
    
    if (newName.length > 200) {
      showFieldError(errorDiv, 'Namnet Ã¤r fÃ¶r lÃ¥ngt (max 200 tecken)');
      nameInput.focus();
      return;
    }
    
    if (newName === company.namn) {
      modal.hide();
      return;
    }

    // Check for duplicates within the same brand
    const duplicate = AppState.companies.find(c => 
      c.id !== companyId && 
      c.brandId === company.brandId &&
      c.namn.toLowerCase() === newName.toLowerCase()
    );
    
    if (duplicate) {
      showFieldError(errorDiv, 'Ett fÃ¶retag med detta namn finns redan inom samma varumÃ¤rke');
      nameInput.focus();
      return;
    }

    try {
      spinner.style.display = 'flex';
      nameInput.disabled = true;
      
      const response = await fetch(`/api/companies/${companyId}/name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ namn: newName })
      });

      const result = await response.json();

      if (response.ok && result.ok) {
        // Update local state
        company.namn = newName;
        
        // Show success and close modal
        showSuccessMessage(result.message || 'FÃ¶retagsnamn uppdaterat');
        modal.hide();
        
        // Refresh views
        renderCompanies();
        renderAgents(); // May need to update agent list with new company name
        renderDashboard();
        
      } else {
        let errorMsg = 'Ett fel uppstod vid uppdatering';
        
        if (result.error === 'duplicate_name') {
          errorMsg = result.message || 'Ett fÃ¶retag med detta namn finns redan inom samma varumÃ¤rke';
        } else if (result.error === 'invalid_name') {
          errorMsg = 'Ogiltigt namn';
        } else if (result.error === 'name_too_long') {
          errorMsg = 'Namnet Ã¤r fÃ¶r lÃ¥ngt';
        } else if (result.error === 'company_not_found') {
          errorMsg = 'FÃ¶retaget hittades inte';
        }
        
        showFieldError(errorDiv, errorMsg);
      }
      
    } catch (error) {
      console.error('Edit company name failed:', error);
      showFieldError(errorDiv, 'NÃ¤tverksfel - fÃ¶rsÃ¶k igen');
    } finally {
      spinner.style.display = 'none';
      nameInput.disabled = false;
      nameInput.focus();
    }
  });

  // Submit on Enter key
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#saveEditCompany').click();
    }
  });
}

function renderCompanies() {
  const root = document.getElementById('view-companies');
  renderTemplate('tpl-companies', root);
  const brandSelect = document.getElementById('companyBrandFilter');
  brandSelect.innerHTML = `<option value="all">Alla varumÃ¤rken</option><option value="unaffiliated">FristÃ¥ende (utan kedja)</option>` + AppState.brands.map(b => `<option value="${b.id}">${b.namn}</option>`).join('');

  const table = document.getElementById('companyTable');
  const isAdmin = (currentUser()?.roll === 'admin');
  const pageSizeSel = document.getElementById('companyPageSize');
  const pageInfo = document.getElementById('companyPageInfo');
  const prevBtn = document.getElementById('companyPrev');
  const nextBtn = document.getElementById('companyNext');
  const statusSelect = document.getElementById('companyStatusFilter');
  const pipelineSelect = document.getElementById('companyPipelineFilter');
  const highlightData = (highlightRequest && highlightRequest.type === 'company') ? highlightRequest : null;
  let highlightApplied = false;
  if (highlightData?.filters) {
    if ('brandId' in highlightData.filters) {
      brandSelect.value = highlightData.filters.brandId ? highlightData.filters.brandId : 'all';
    }
    if ('status' in highlightData.filters && statusSelect) {
      statusSelect.value = highlightData.filters.status || 'all';
    }
    if ('pipeline' in highlightData.filters && pipelineSelect) {
      pipelineSelect.value = highlightData.filters.pipeline || 'all';
    }
  }
  let page = 1;
  let sortKey = 'name';
  let sortAsc = true;

  function draw() {
    const brandId = brandSelect.value;
    const status = statusSelect.value;
    const pipeline = pipelineSelect.value;
    const activeSegmentId = AppState.activeSegmentId;
    const placeholder = AppState.brands.find(x => (x.namn||'').trim().toLowerCase() === '(tom)');
    const placeholderId = placeholder?.id || null;
    const filtered = AppState.companies.filter(c => {
      // Segment filter
      if (activeSegmentId && c.segmentId !== activeSegmentId) {
        return false;
      }
      
      // Brand filter
      let brandMatch = false;
      if (brandId === 'all') {
        brandMatch = true;
      } else if (brandId === 'unaffiliated') {
        brandMatch = !c.brandId || c.brandId === placeholderId;
      } else {
        brandMatch = c.brandId === brandId;
      }
      // Status and pipeline filters
      const statusMatch = (status === 'all' || c.status === status);
      const pipelineMatch = (pipeline === 'all' || (c.pipelineStage || '') === pipeline);
      return brandMatch && statusMatch && pipelineMatch;
    });
    const size = Number(pageSizeSel.value)||25;
    const statusRank = { ej:0, prospekt:1, kund:2 };
    const productOf = (c) => {
      if (c.product) return String(c.product);
      if (c.centralContract) {
        const b = AppState.brands.find(x => x.id===c.brandId);
        if (b?.centralContract?.product) return String(b.centralContract.product);
      }
      return '';
    };
    const sorter = (a,b) => {
      const brandA = brandName(a.brandId), brandB = brandName(b.brandId);
      const pipelineA = String(a.pipelineStage||'');
      const pipelineB = String(b.pipelineStage||'');
      const productA = productOf(a); const productB = productOf(b);
      const map = {
        name: () => a.namn.localeCompare(b.namn,'sv'),
        brand: () => brandA.localeCompare(brandB,'sv'),
        city: () => String(a.stad||'').localeCompare(String(b.stad||''),'sv'),
        status: () => (statusRank[a.status||'ej'] - statusRank[b.status||'ej']),
        customerNumber: () => String(a.customerNumber||'').localeCompare(String(b.customerNumber||''),'sv'),
        org: () => String(a.orgNumber||'').localeCompare(String(b.orgNumber||''),'sv'),
        pipeline: () => pipelineA.localeCompare(pipelineB,'sv') || ((Number(b.potentialValue)||0) - (Number(a.potentialValue)||0)),
        mrr: () => (Number(a.payment)||0) - (Number(b.payment)||0),
        product: () => productA.localeCompare(productB,'sv')
      };
      const cmp = (map[sortKey]||map.name)();
      return sortAsc ? cmp : -cmp;
    };
    let sorted = [...filtered].sort(sorter);
    if (highlightData && !highlightApplied) {
      const idx = sorted.findIndex(c => c.id === highlightData.id);
      if (idx >= 0) {
        const pageSize = size || 1;
        page = Math.floor(idx / pageSize) + 1;
      }
    }
    const total = filtered.length;
    const maxPage = Math.max(1, Math.ceil(total/size));
    if (page>maxPage) page=maxPage;
    const start = (page-1)*size;
    const rows = sorted.slice(start, start+size);
    
    // Build modern card-based layout
    const fragment = document.createDocumentFragment();
    
    // Header with sort indicators
    const header = document.createElement('div');
    header.className = 'row header';
    const sortIcon = (key) => sortKey === key ? (sortAsc ? ' â–²' : ' â–¼') : '';
    header.innerHTML = `
      <div data-sort="name" style="flex: 2; font-weight: 600;">FÃ¶retag${sortIcon('name')}</div>
      <div data-sort="brand" style="flex: 1.5;">VarumÃ¤rke${sortIcon('brand')}</div>
      <div data-sort="status" style="flex: 1;">Status${sortIcon('status')}</div>
      <div data-sort="mrr" style="flex: 1; text-align: right;">MRR${sortIcon('mrr')}</div>
      <div data-sort="pipeline" style="flex: 1.5;">Pipeline${sortIcon('pipeline')}</div>
      <div style="flex: 1; text-align: right;">Ã…tgÃ¤rder</div>
    `;
    fragment.appendChild(header);
    
    // Data rows with improved styling
    rows.forEach(c => {
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.companyId = c.id;
      row.style.cssText = 'align-items: center; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; transition: background 0.15s;';
      
      // Company name column with contact info
      const companyCol = document.createElement('div');
      companyCol.style.cssText = 'flex: 2; display: flex; flex-direction: column; gap: 4px;';
      const companyName = document.createElement('div');
      companyName.style.cssText = 'font-weight: 600; font-size: 15px; color: #111827;';
      companyName.textContent = c.namn;
      companyCol.appendChild(companyName);
      
      const companyMeta = document.createElement('div');
      companyMeta.style.cssText = 'font-size: 13px; color: #6b7280; display: flex; gap: 12px; align-items: center;';
      const metaParts = [];
      if (c.stad) metaParts.push('ðŸ“ ' + c.stad);
      if (c.email) metaParts.push('<a href="mailto:' + c.email + '" style="color: #2563eb; text-decoration: none;">' + c.email + '</a>');
      if (c.customerNumber) metaParts.push('#' + c.customerNumber);
      companyMeta.innerHTML = metaParts.join(' Â· ');
      companyCol.appendChild(companyMeta);
      row.appendChild(companyCol);
      
      // Brand column
      const brandCol = document.createElement('div');
      brandCol.style.cssText = 'flex: 1.5; font-size: 14px; color: #374151;';
      const brand = brandName(c.brandId);
      brandCol.innerHTML = brand === 'â€“' ? '<span style="color: #9ca3af;">FristÃ¥ende</span>' : brand;
      if (c.centralContract) {
        const badge = document.createElement('span');
        badge.style.cssText = 'display: inline-block; margin-left: 6px; padding: 2px 8px; background: #dbeafe; color: #1e40af; border-radius: 9999px; font-size: 11px; font-weight: 600;';
        badge.textContent = 'CENTRAL';
        brandCol.appendChild(badge);
      }
      row.appendChild(brandCol);
      
      // Status column with colored badges
      const statusCol = document.createElement('div');
      statusCol.style.cssText = 'flex: 1;';
      const statusBadge = document.createElement('span');
      const statusColors = {
        kund: { bg: '#d1fae5', text: '#065f46', icon: 'âœ“' },
        prospekt: { bg: '#fef3c7', text: '#92400e', icon: 'â³' },
        ej: { bg: '#f3f4f6', text: '#6b7280', icon: 'â—‹' }
      };
      const statusColor = statusColors[c.status] || statusColors.ej;
      statusBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; background: ' + statusColor.bg + '; color: ' + statusColor.text + '; border-radius: 9999px; font-size: 13px; font-weight: 600;';
      statusBadge.innerHTML = '<span>' + statusColor.icon + '</span> ' + (c.status === 'kund' ? 'Kund' : c.status === 'prospekt' ? 'Prospekt' : 'Ej kontakt');
      statusCol.appendChild(statusBadge);
      row.appendChild(statusCol);
      
      // MRR column
      const mrrCol = document.createElement('div');
      mrrCol.style.cssText = 'flex: 1; text-align: right; font-weight: 600; font-size: 15px; color: #059669;';
      mrrCol.textContent = c.payment ? formatSek(c.payment) : 'â€“';
      row.appendChild(mrrCol);
      
      // Pipeline column
      const pipelineCol = document.createElement('div');
      pipelineCol.style.cssText = 'flex: 1.5; font-size: 13px;';
      if (c.pipelineStage) {
        const pipelineText = document.createElement('div');
        pipelineText.style.cssText = 'color: #374151; font-weight: 500;';
        pipelineText.textContent = c.pipelineStage.charAt(0).toUpperCase() + c.pipelineStage.slice(1);
        pipelineCol.appendChild(pipelineText);
        if (c.potentialValue) {
          const potential = document.createElement('div');
          potential.style.cssText = 'color: #6b7280; font-size: 12px; margin-top: 2px;';
          potential.textContent = 'Potential: ' + formatSek(c.potentialValue);
          pipelineCol.appendChild(potential);
        }
      } else {
        pipelineCol.innerHTML = '<span style="color: #9ca3af;">â€“</span>';
      }
      row.appendChild(pipelineCol);
      
      // Actions column
      const actionsCol = document.createElement('div');
      actionsCol.className = 'actions';
      actionsCol.style.cssText = 'flex: 1; display: flex; gap: 6px; justify-content: flex-end;';
      const editButton = '<button class="secondary" data-action="edit-company-name" data-id="' + c.id + '" style="padding: 6px 12px; font-size: 13px;" title="Redigera fÃ¶retagsnamn">âœï¸</button>';
      actionsCol.innerHTML = '<button class="secondary" data-open="' + c.id + '" style="padding: 6px 12px; font-size: 13px;">Ã–ppna</button>' + editButton + '<button class="secondary" data-note="' + c.id + '" style="padding: 6px 12px; font-size: 13px;">ðŸ“</button>';
      row.appendChild(actionsCol);
      
      fragment.appendChild(row);
    });
    
    table.innerHTML = '';
    table.appendChild(fragment);
    pageInfo.textContent = total ? `Sida ${page} av ${maxPage} Â· ${total} resultat` : 'Inga resultat';
    prevBtn.disabled = (page<=1);
    nextBtn.disabled = (page>=maxPage);

    if (highlightData && !highlightApplied) {
      highlightApplied = true;
      highlightRequest = null;
      const rowEl = table.querySelector(`.row[data-company-id="${highlightData.id}"]`);
      if (rowEl) {
        rowEl.classList.add('highlight');
        rowEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => rowEl.classList.remove('highlight'), 1800);
      }
    }
  }

  draw();
  
  // Add click handlers for sorting
  table.addEventListener('click', (e) => {
    const sortHeader = e.target.closest('[data-sort]');
    if (sortHeader) {
      const newKey = sortHeader.dataset.sort;
      if (sortKey === newKey) {
        sortAsc = !sortAsc;
      } else {
        sortKey = newKey;
        sortAsc = true;
      }
      draw();
    }
    
    const openBtn = e.target.closest('[data-open]');
    if (openBtn) {
      openCompany(openBtn.dataset.open);
      return;
    }
    
    const noteBtn = e.target.closest('[data-note]');
    if (noteBtn) {
      openNoteModal('company', noteBtn.dataset.note);
      return;
    }
  });
  
  brandSelect.addEventListener('change', draw);
  statusSelect.addEventListener('change', draw);
  pipelineSelect.addEventListener('change', draw);
  pageSizeSel.addEventListener('change', () => { page = 1; draw(); });
  prevBtn.addEventListener('click', () => { if (page>1) { page--; draw(); } });
  nextBtn.addEventListener('click', () => { page++; draw(); });
  document.getElementById('exportCompanies').addEventListener('click', () => exportCompaniesToCsv());

  document.getElementById('addCompany').addEventListener('click', () => openCompanyModal());
}

function brandName(id) { return AppState.brands.find(b => b.id===id)?.namn || 'â€“'; }
function companyName(id) { return AppState.companies.find(c => c.id===id)?.namn || 'â€“'; }
function agentName(id) { const a = AppState.agents.find(x => x.id===id); return a?`${a.fÃ¶rnamn} ${a.efternamn}`:'â€“'; }
function entityLabel(type, id) {
  if (type==='brand') return `VarumÃ¤rke: ${brandName(id)}`;
  if (type==='company') return `FÃ¶retag: ${companyName(id)}`;
  if (type==='agent') return `MÃ¤klare: ${agentName(id)}`;
  return '';
}

// --- Deletion helpers (admin) ---
function deleteBrandCascade(brandId) {
  // Remove companies under brand (with cascade)
  const comps = AppState.companies.filter(c => c.brandId===brandId).map(c => c.id);
  comps.forEach(deleteCompanyCascade);
  // Remove brand contacts, tasks, notes
  AppState.contacts = AppState.contacts.filter(k => !(k.entityType==='brand' && k.entityId===brandId));
  AppState.tasks = AppState.tasks.filter(t => !(t.entityType==='brand' && t.entityId===brandId));
  AppState.notes = AppState.notes.filter(n => !(n.entityType==='brand' && n.entityId===brandId));
  // Remove brand itself
  AppState.brands = AppState.brands.filter(b => b.id!==brandId);
  saveState();
}

function deleteCompanyCascade(companyId) {
  // Remove agents under company
  const agents = AppState.agents.filter(a => a.companyId===companyId).map(a => a.id);
  agents.forEach(deleteAgent);
  // Remove company contacts, tasks, notes
  AppState.contacts = AppState.contacts.filter(k => !(k.entityType==='company' && k.entityId===companyId));
  AppState.tasks = AppState.tasks.filter(t => !(t.entityType==='company' && t.entityId===companyId));
  AppState.notes = AppState.notes.filter(n => !(n.entityType==='company' && n.entityId===companyId));
  // Remove company itself
  AppState.companies = AppState.companies.filter(c => c.id!==companyId);
  saveState();
}

function deleteAgent(agentId) {
  // Remove tasks, notes for agent
  AppState.tasks = AppState.tasks.filter(t => !(t.entityType==='agent' && t.entityId===agentId));
  AppState.notes = AppState.notes.filter(n => !(n.entityType==='agent' && n.entityId===agentId));
  // Remove agent
  AppState.agents = AppState.agents.filter(a => a.id!==agentId);
  saveState();
}

// --- Undo functionality ---
function saveUndoSnapshot(type, description, snapshot) {
  AppState.undoStack = AppState.undoStack || [];
  AppState.undoStack.push({
    type,
    description,
    snapshot: JSON.parse(JSON.stringify(snapshot)), // Deep copy
    timestamp: Date.now()
  });
  // Keep only last 10 undo actions
  if (AppState.undoStack.length > 10) {
    AppState.undoStack.shift();
  }
  updateUndoButton();
}

function performUndo() {
  if (!AppState.undoStack || AppState.undoStack.length === 0) return;
  
  const undoItem = AppState.undoStack.pop();
  
  // Restore the snapshot
  if (undoItem.snapshot.brands) AppState.brands = undoItem.snapshot.brands;
  if (undoItem.snapshot.companies) AppState.companies = undoItem.snapshot.companies;
  if (undoItem.snapshot.agents) AppState.agents = undoItem.snapshot.agents;
  if (undoItem.snapshot.contacts) AppState.contacts = undoItem.snapshot.contacts;
  if (undoItem.snapshot.tasks) AppState.tasks = undoItem.snapshot.tasks;
  if (undoItem.snapshot.notes) AppState.notes = undoItem.snapshot.notes;
  
  saveState();
  updateUndoButton();
  
  // Show notification
  showNotification(`Ã…terstÃ¤llde: ${undoItem.description}`, 'success');
  
  // Refresh current view
  const currentView = document.querySelector('.view.active')?.id?.replace('view-', '') || 'dashboard';
  setView(currentView);
}

function updateUndoButton() {
  const undoBtn = document.getElementById('globalUndoBtn');
  if (!undoBtn) return;
  
  const hasUndo = AppState.undoStack && AppState.undoStack.length > 0;
  undoBtn.disabled = !hasUndo;
  undoBtn.style.display = hasUndo ? 'inline-block' : 'none';
  
  if (hasUndo) {
    const lastAction = AppState.undoStack[AppState.undoStack.length - 1];
    undoBtn.title = `Ã…ngra: ${lastAction.description}`;
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Updated delete functions with undo support
function deleteBrandCascadeWithUndo(brandId) {
  const brand = AppState.brands.find(b => b.id === brandId);
  if (!brand) return;
  
  // Save snapshot before deletion
  const snapshot = {
    brands: [...AppState.brands],
    companies: [...AppState.companies],
    agents: [...AppState.agents],
    contacts: [...AppState.contacts],
    tasks: [...AppState.tasks],
    notes: [...AppState.notes]
  };
  
  saveUndoSnapshot('brand', `VarumÃ¤rke: ${brand.namn}`, snapshot);
  deleteBrandCascade(brandId);
}

function deleteCompanyCascadeWithUndo(companyId) {
  const company = AppState.companies.find(c => c.id === companyId);
  if (!company) return;
  
  // Save snapshot before deletion
  const snapshot = {
    companies: [...AppState.companies],
    agents: [...AppState.agents],
    contacts: [...AppState.contacts],
    tasks: [...AppState.tasks],
    notes: [...AppState.notes]
  };
  
  saveUndoSnapshot('company', `FÃ¶retag: ${company.namn}`, snapshot);
  deleteCompanyCascade(companyId);
}

function deleteAgentWithUndo(agentId) {
  const agent = AppState.agents.find(a => a.id === agentId);
  if (!agent) return;
  
  // Save snapshot before deletion
  const snapshot = {
    agents: [...AppState.agents],
    tasks: [...AppState.tasks],
    notes: [...AppState.notes]
  };
  
  saveUndoSnapshot('agent', `MÃ¤klare: ${agent.fÃ¶rnamn} ${agent.efternamn}`, snapshot);
  deleteAgent(agentId);
}


function contactRow(c) {
  return `<div class="list-item">
    <div>
      <div class="title">${c.namn} ${c.roll?('Â· '+c.roll):''}</div>
      <div class="subtitle">${c.email||''} ${c.telefon?('Â· '+c.telefon):''}</div>
    </div>
    <div class="actions">
      <button class="secondary" data-edit-contact="${c.id}">Ã„ndra</button>
      <button class="danger" data-del-contact="${c.id}">Ta bort</button>
    </div>
  </div>`;
}

function taskRow(t) {
  return `<div class="list-item">
    <div>
      <div class="title">${t.title}</div>
      <div class="small">${t.dueAt?('FÃ¶rfallo: '+new Date(t.dueAt).toLocaleDateString('sv-SE')):'Ingen fÃ¶rfallodag'} Â· Ã„gare: ${userName(t.ownerId)}</div>
    </div>
    <div class="actions">
      <button class="secondary" data-edit-task="${t.id}">Ã„ndra</button>
      ${t.done?'<span class="tag kund">Klar</span>':`<button class="primary" data-done="${t.id}">Markera klar</button>`}
      <button class="danger" data-del-task="${t.id}">Ta bort</button>
    </div>
  </div>`;
}

function noteRow(n) {
  return `<div class="list-item">
    <div>
      <div class="title">${n.text}</div>
      <div class="small">${new Date(n.createdAt).toLocaleString('sv-SE')} Â· ${userName(n.authorId)}</div>
    </div>
    <div class="actions">
      <button class="secondary" data-edit-note="${n.id}">Ã„ndra</button>
      <button class="danger" data-del-note="${n.id}">Ta bort</button>
    </div>
  </div>`;
}

function openContactModal(entityType, entityId, contactId) {
  const existing = contactId ? AppState.contacts.find(c => c.id===contactId) : null;
  modal.show(`
    <h3>${existing?'Ã„ndra':'Ny'} kontakt</h3>
    <div class="grid-2">
      <div class="field"><label>Namn</label><input id="kName" value="${existing?.namn||''}"/></div>
      <div class="field"><label>Roll</label><input id="kRole" value="${existing?.roll||''}"/></div>
      <div class="field"><label>E-post</label><input id="kEmail" value="${existing?.email||''}"/></div>
      <div class="field"><label>Telefon</label><input id="kPhone" value="${existing?.telefon||''}"/></div>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="primary" id="saveContact">Spara</button>
      <button class="secondary" onclick="modal.hide()">Avbryt</button>
    </div>
  `);
  $('#saveContact').addEventListener('click', () => {
    const namn = sanitizeInput($('#kName').value);
    const roll = sanitizeInput($('#kRole').value);
    const email = sanitizeInput($('#kEmail').value);
    const telefon = sanitizeInput($('#kPhone').value);
    if (!namn) return;
    if (email && !validateEmail(email)) { alert('Ogiltig e-postadress'); return; }
    if (telefon && !validatePhone(telefon)) { alert('Ogiltigt telefonnummer'); return; }
    const rec = {
      id: existing?.id || id(), entityType, entityId,
      namn, roll, email, telefon
    };
    if (existing) {
      Object.assign(existing, rec);
    } else {
      AppState.contacts.push(rec);
    }
  saveState(); modal.hide();
  if (entityType==='company') openCompany(entityId, { fromStack: true });
  else if (entityType==='brand') openBrand(entityId, { fromStack: true });
  });
}

function openTaskModal(preset={}) {
  const editing = preset.taskId ? AppState.tasks.find(t => t.id===preset.taskId) : null;
  modal.show(`
    <h3>${editing?'Ã„ndra':'Ny'} uppgift</h3>
    <div class="grid-2">
      <div class="field"><label>Titel</label><input id="tTitle" value="${editing?editing.title:''}" /></div>
      <div class="field"><label>FÃ¶rfallodatum</label><input id="tDue" type="date" value="${editing && editing.dueAt ? new Date(editing.dueAt).toISOString().slice(0,10):''}" /></div>
      <div class="field"><label>Ã„gare</label>
        <select id="tOwner">${AppState.users.map(u => `<option value="${u.id}" ${(editing?editing.ownerId:AppState.currentUserId)===u.id?'selected':''}>${u.namn}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Koppla till</label>
        <select id="tEntityType">
          <option value="">(Ingen)</option>
          <option value="brand" ${(editing?.entityType||preset.entityType)==='brand'?'selected':''}>VarumÃ¤rke</option>
          <option value="company" ${(editing?.entityType||preset.entityType)==='company'?'selected':''}>FÃ¶retag</option>
          <option value="agent" ${(editing?.entityType||preset.entityType)==='agent'?'selected':''}>MÃ¤klare</option>
        </select>
      </div>
      <div class="field" id="tEntityPicker"></div>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="primary" id="saveTask">Spara</button>
      <button class="secondary" onclick="modal.hide()">Avbryt</button>
    </div>
  `);
  const picker = $('#tEntityPicker');
  const typeSel = $('#tEntityType');
  function drawPicker() {
    const t = typeSel.value || editing?.entityType || preset.entityType || '';
    let options = '';
    let label = '';
    let value = editing?.entityId || preset.entityId || '';
    if (t==='brand') { label='VarumÃ¤rke'; options = AppState.brands.map(b => `<option value="${b.id}" ${b.id===value?'selected':''}>${b.namn}</option>`).join(''); }
    else if (t==='company') { label='FÃ¶retag'; options = AppState.companies.map(c => `<option value="${c.id}" ${c.id===value?'selected':''}>${c.namn}</option>`).join(''); }
    else if (t==='agent') { label='MÃ¤klare'; options = AppState.agents.map(a => `<option value="${a.id}" ${a.id===value?'selected':''}>${a.fÃ¶rnamn} ${a.efternamn}</option>`).join(''); }
    picker.innerHTML = t ? `<label>${label}</label><select id="tEntity">${options}</select>` : '';
  }
  typeSel.addEventListener('change', drawPicker);
  drawPicker();
  $('#saveTask').addEventListener('click', () => {
    const title = $('#tTitle').value.trim(); if (!title) return;
    const dueStr = $('#tDue').value; const dueAt = dueStr ? new Date(dueStr).toISOString() : null;
    const ownerId = $('#tOwner').value;
    const entityType = $('#tEntityType').value || editing?.entityType || null;
    const entityId = entityType ? ($('#tEntity')?.value || editing?.entityId || preset.entityId || null) : null;
    if (editing) {
      editing.title = title; editing.dueAt = dueAt; editing.ownerId = ownerId; editing.entityType = entityType; editing.entityId = entityId;
    } else {
      AppState.tasks.push({ id: id(), title, dueAt, ownerId, done:false, entityType, entityId });
    }
  saveState(); modal.hide();
  // Reopen relevant context after saving
  if (entityType==='brand' && entityId) openBrand(entityId, { fromStack: true });
  else if (entityType==='company' && entityId) openCompany(entityId, { fromStack: true });
  else if (entityType==='agent' && entityId) openAgent(entityId, { fromStack: true });
  else renderDashboard();
  });
}

// Global handler for edit/delete contacts in open modal
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-edit-contact], button[data-del-contact]');
  if (!btn) return;
  const cid = btn.dataset.editContact || btn.dataset.delContact;
  const c = AppState.contacts.find(x => x.id===cid); if (!c) return;
  if (btn.dataset.editContact) return openContactModal(c.entityType, c.entityId, c.id);
  if (btn.dataset.delContact) {
    if (!confirm('Ta bort kontakt?')) return;
    AppState.contacts = AppState.contacts.filter(x => x.id!==cid);
  saveState();
  if (c.entityType==='company') openCompany(c.entityId, { fromStack: true });
  else if (c.entityType==='brand') openBrand(c.entityId, { fromStack: true });
  }
});

function openCompany(id, options = {}) {
  const sameContext = modalCurrent && modalCurrent.type === 'company' && modalCurrent.id === id;
  if (!options.fromStack && !options.fromParent && !sameContext) {
    resetModalNavigation();
  }
  modalCurrent = { type: 'company', id };
  const c = AppState.companies.find(x => x.id === id);
  const agentsAll = AppState.agents.filter(a => a.companyId === id);
  const agentHighlightId = options.childHighlight?.type === 'agent' ? options.childHighlight.id : null;
  let agentHighlightApplied = false;
  // Prefill product: company.product -> most common agent.licens.typ -> brand central product (if centrally covered)
  let productPrefill = c.product || '';
  if (!productPrefill) {
    const counts = new Map();
    for (const a of agentsAll) {
      const t = (a.licens?.typ||'').trim();
      if (!t) continue; counts.set(t, (counts.get(t)||0)+1);
    }
    if (counts.size) {
      productPrefill = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1])[0][0];
    }
  }
  if (!productPrefill && c.centralContract) {
    const brand = AppState.brands.find(b => b.id===c.brandId);
    if (brand?.centralContract?.product) productPrefill = brand.centralContract.product;
  }
  modal.show(`
    <h3>${c.namn}</h3>
  <div class="modal-toolbar"><button class="secondary toolbar-back" id="companyBackLink" type="button">â€¹ Tillbaka till lista</button></div>
    <div class="muted"><span id="companyBrandLabel">${brandName(c.brandId)}</span>${c.stad?(' Â· '+c.stad):''} Â· ${tagStatus(c.status)}${c.centralContract?' Â· centralt':''} ${c.customerNumber?('Â· Kundnr: '+c.customerNumber):''} ${c.payment?('Â· MRR: '+formatSek(c.payment)) : ''} ${c.product?('Â· Produkt: '+c.product):''}</div>
    ${(() => {
      const addressParts = [c.address, [c.postalCode, c.postCity].filter(Boolean).join(' ')].filter(Boolean);
      if (!addressParts.length) return '';
      return `<div class="muted">Adress: ${addressParts.join(' Â· ')}</div>`;
    })()}
    <div class="grid-2" style="margin-top: 10px;">
      <div class="field">
        <label>Ansvarig sÃ¤ljare</label>
        <select id="ownerSelect">${AppState.users.map(u => `<option value="${u.id}" ${u.id===c.ansvarigSÃ¤ljareId?'selected':''}>${u.namn}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>Status</label>
        <select id="statusSelect">
          <option value="kund" ${c.status==='kund'?'selected':''}>Kund</option>
          <option value="prospekt" ${c.status==='prospekt'?'selected':''}>Prospekt</option>
          <option value="ej" ${c.status==='ej'?'selected':''}>Ej kontakt</option>
        </select>
      </div>
      <div class="field">
        <label>KedjetillhÃ¶righet</label>
        <select id="companyBrandSelect">
          <option value="" ${c.brandId ? '' : 'selected'}>â€” Ingen kedja â€”</option>
          ${AppState.brands.map(b => `<option value="${b.id}" ${b.id===c.brandId?'selected':''}>${b.namn}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Segment/Kategori</label>
        <select id="companySegmentSelect">
          <option value="" ${!c.segmentId && c.brandId ? 'selected' : ''}>â€” Ã„rv frÃ¥n varumÃ¤rke â€”</option>
          ${AppState.segments.map(s => `<option value="${s.id}" ${s.id===c.segmentId?'selected':''}>${s.icon} ${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Kund?</label>
        <input id="isCustomer" type="checkbox" ${c.status==='kund'?'checked':''} />
      </div>
      <div class="field">
        <label>Produkt</label>
        <input id="productInput" value="${productPrefill||''}" />
      </div>
      <div class="field">
        <label>Claude Sonnet 4 Enabled</label>
        <input id="claudeEnabled" type="checkbox" ${c.claudeSonnet4Enabled ? 'checked' : ''} />
      </div>
      <div class="field">
        <label>Nuvarande betalning (SEK)</label>
        <input id="paymentInput" type="number" min="0" step="100" value="${c.payment||''}" />
      </div>
      <div class="field">
        <label>Pipeline</label>
        <select id="pipelineSelect">
          <option value="kvalificerad" ${(c.pipelineStage||'')==='kvalificerad'?'selected':''}>Kvalificerad</option>
          <option value="offert" ${(c.pipelineStage||'')==='offert'?'selected':''}>Offert</option>
          <option value="fÃ¶rhandling" ${(c.pipelineStage||'')==='fÃ¶rhandling'?'selected':''}>FÃ¶rhandling</option>
          <option value="vunnit" ${(c.pipelineStage||'')==='vunnit'?'selected':''}>Vunnit</option>
          <option value="fÃ¶rlorat" ${(c.pipelineStage||'')==='fÃ¶rlorat'?'selected':''}>FÃ¶rlorat</option>
        </select>
      </div>
      <div class="field">
        <label>Potential (SEK)</label>
        <input id="potentialInput" type="number" min="0" step="100" value="${c.potentialValue||''}" />
      </div>
      <div class="field">
        <label>Adress</label>
        <input id="companyAddressInput" value="${c.address||''}" />
      </div>
      <div class="field">
        <label>Postnummer</label>
        <input id="companyPostalCodeInput" value="${c.postalCode||''}" />
      </div>
      <div class="field">
        <label>Postort</label>
        <input id="companyPostCityInput" value="${c.postCity||''}" />
      </div>
    </div>

    <h4 style="margin-top:12px;">Beslutsfattare</h4>
    <div class="list" id="companyContacts">
      ${AppState.contacts.filter(k => k.entityType==='company' && k.entityId===c.id).map(k => contactRow(k)).join('')}
    </div>
    <div style="margin:8px 0; display:flex; gap:8px;">
      <button class="secondary" id="addCompanyContact">LÃ¤gg till kontakt</button>
      <button class="secondary" id="addCompanyTask">Ny uppgift</button>
      <button class="secondary" id="openOutlook" style="background: #0078d4; color: white;">ðŸ“§ Outlook</button>
    </div>

    <h4 style="margin-top:16px;">MÃ¤klare (${agentsAll.length})</h4>
    <div class="list" id="companyAgents"></div>
    <div style="display:flex; align-items:center; gap:8px; justify-content:flex-end; margin-top:6px;">
      <span class="muted" id="companyAgentsInfo"></span>
      <button class="secondary" id="companyAgentsPrev">FÃ¶regÃ¥ende</button>
      <button class="secondary" id="companyAgentsNext">NÃ¤sta</button>
    </div>

    <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="primary" id="saveCompany">Spara</button>
      <button class="secondary" id="companyBackToList">Tillbaka till lista</button>
      <button class="secondary" id="addAgentInCompany">Ny mÃ¤klare</button>
      <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
    </div>
  `);
  // Add AI Report button if enabled
  if (c.claudeSonnet4Enabled) {
    const toolbar = $('#modalBody').querySelector('.modal-toolbar');
    if (toolbar) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary btn-sm';
      btn.textContent = 'ðŸ¤– AI Market Report';
      btn.addEventListener('click', () => generateAIMarketReport(c));
      toolbar.appendChild(btn);
    }
  }
  // Paginate company agents list
  const agList = $('#modalBody').querySelector('#companyAgents');
  const agInfo = $('#modalBody').querySelector('#companyAgentsInfo');
  const agPrev = $('#modalBody').querySelector('#companyAgentsPrev');
  const agNext = $('#modalBody').querySelector('#companyAgentsNext');
  const agSize = 12;
  let agPage = Math.max(1, options.agentPage || 1);
  let pendingAgentHighlightId = agentHighlightId;
  function drawAgents() {
    const total = agentsAll.length;
    const maxPage = Math.max(1, Math.ceil(total/agSize));
    if (pendingAgentHighlightId && !agentHighlightApplied) {
      const highlightIndex = agentsAll.findIndex(a => a.id === pendingAgentHighlightId);
      if (highlightIndex >= 0) {
        agPage = Math.floor(highlightIndex / agSize) + 1;
      }
    }
    if (agPage>maxPage) agPage=maxPage;
    if (agPage<1) agPage=1;
    const start = (agPage-1)*agSize; const rows = agentsAll.slice(start, start+agSize);
    agList.innerHTML = rows.map(a => {
      const others = otherCompaniesForAgent(a);
      const multi = others.length>0;
      const tip = multi?`Arbetar Ã¤ven pÃ¥: ${others.map(c=>c.namn).join(', ')}`:'';
      return `<div class="list-item" data-agent-row="${a.id}">
      <div>
        <div class="title">${a.fÃ¶rnamn} ${a.efternamn}${multi?` <span class=\"multi-office\" title=\"${tip}\">â€¢</span>`:''}</div>
        <div class="subtitle">${a.email||''} Â· ${a.telefon||''} Â· ${tagStatus(a.status)} Â· licens: ${tagStatus(a.licens?.status||'ingen')}${a.licens?.typ?(' Â· typ: '+a.licens.typ):''}</div>
      </div>
      <div class="actions">
        <button class="secondary" data-open-agent="${a.id}">Ã–ppna</button>
        <button class="secondary" data-add-task-agent="${a.id}">Uppgift</button>
      </div>
    </div>`;
    }).join('');
    agInfo.textContent = total ? `Sida ${agPage} av ${maxPage} Â· ${total} mÃ¤klare` : 'Inga mÃ¤klare';
    agPrev.disabled = (agPage<=1); agNext.disabled = (agPage>=maxPage);
    if (pendingAgentHighlightId && !agentHighlightApplied) {
      const rowEl = agList.querySelector(`.list-item[data-agent-row="${pendingAgentHighlightId}"]`);
      if (rowEl) {
        rowEl.classList.add('highlight');
        rowEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => rowEl.classList.remove('highlight'), 1800);
        agentHighlightApplied = true;
        pendingAgentHighlightId = null;
      }
    }
  }
  drawAgents();
  agPrev.addEventListener('click', () => { if (agPage>1) { agPage--; drawAgents(); } });
  agNext.addEventListener('click', () => { agPage++; drawAgents(); });

  $('#modalBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const aid = btn.dataset.openAgent; if (aid) {
      modalNavStack.push({ type:'company', id: c.id, childHighlight: { type:'agent', id: aid }, agentPage: agPage });
      modal.hide();
      modalCurrent = null;
      openAgent(aid, { fromParent: true });
      return;
    }
    if (btn.id==='addCompanyContact') return openContactModal('company', c.id);
    if (btn.id==='addCompanyTask') return openTaskModal({entityType:'company', entityId:c.id});
    if (btn.id==='openOutlook') {
      console.log('Outlook-knapp klickad', c);
      if (typeof outlookIntegration === 'undefined') {
        console.error('outlookIntegration Ã¤r inte definierat!');
        showNotification('Outlook-integration laddas. FÃ¶rsÃ¶k igen om en sekund.', 'info');
        setTimeout(() => {
          if (typeof outlookIntegration !== 'undefined') {
            outlookIntegration.showOutlookDashboard(c);
          } else {
            showNotification('Outlook-integration kunde inte laddas. Kontrollera konsolen.', 'error');
          }
        }, 1000);
        return;
      }
      return outlookIntegration.showOutlookDashboard(c);
    }
    const addTaskForAgent = btn.dataset.addTaskAgent; if (addTaskForAgent) return openTaskModal({entityType:'agent', entityId:addTaskForAgent});
  });

  const brandSelectEl = $('#companyBrandSelect');
  const brandLabelEl = $('#companyBrandLabel');
  if (brandSelectEl && brandLabelEl) {
    const updateBrandLabel = () => {
      const selectedId = brandSelectEl.value;
      brandLabelEl.textContent = selectedId ? brandName(selectedId) : 'Ingen kedja';
    };
    brandSelectEl.addEventListener('change', updateBrandLabel);
    updateBrandLabel();
  }

  // Sync Kund?-checkbox med status-vÃ¤ljaren
  const statusSelEl = $('#statusSelect');
  const custChk = $('#isCustomer');
  if (custChk && statusSelEl) {
    custChk.addEventListener('change', () => {
      if (custChk.checked) statusSelEl.value = 'kund';
      else if (statusSelEl.value === 'kund') statusSelEl.value = 'ej';
    });
    statusSelEl.addEventListener('change', () => {
      custChk.checked = (statusSelEl.value === 'kund');
    });
  }

  $('#saveCompany').addEventListener('click', () => {
    c.ansvarigSÃ¤ljareId = $('#ownerSelect').value;
    c.status = $('#statusSelect').value;
    if (brandSelectEl) {
      const nextBrandId = brandSelectEl.value || null;
      c.brandId = nextBrandId;
    }
    // Save segment selection (empty = inherit from brand)
    const segmentSelectEl = $('#companySegmentSelect');
    if (segmentSelectEl) {
      const selectedSegmentId = segmentSelectEl.value || null;
      c.segmentId = selectedSegmentId;
    }
    c.product = $('#productInput').value.trim();
    c.payment = Number($('#paymentInput').value) || 0;
    enforceCompanyStatusFromPayment(c);
    c.pipelineStage = $('#pipelineSelect').value;
    c.potentialValue = Number($('#potentialInput').value) || 0;
    c.address = $('#companyAddressInput').value.trim();
    c.postalCode = $('#companyPostalCodeInput').value.trim();
    c.postCity = $('#companyPostCityInput').value.trim();
    c.claudeSonnet4Enabled = document.getElementById('claudeEnabled').checked;
    saveState(); modal.hide(); renderCompanies(); renderBrands(); renderDashboard(); renderAgents(); renderPipeline(); renderCustomerSuccess();
  });

  const companyBackBtn = $('#modalBody').querySelector('#companyBackToList');
  const companyBackLink = $('#modalBody').querySelector('#companyBackLink');
  const goBackCompany = () => {
    const parent = modalNavStack.pop();
    if (parent) {
      modal.hide();
      modalCurrent = null;
      reopenParentContext(parent);
      return;
    }
    queueHighlight('company', c.id, {
      filters: {
        brandId: c.brandId || null,
        status: c.status || null,
        pipeline: c.pipelineStage || null
      }
    });
    modal.hide();
    resetModalNavigation();
    setView('companies');
  };
  [companyBackBtn, companyBackLink].forEach(btn => btn && btn.addEventListener('click', goBackCompany));

  $('#addAgentInCompany').addEventListener('click', () => {
    openAgentModal({ companyId: c.id });
  });

  // --- Company tasks and notes (with delete/complete) ---
  const bodyEl = document.getElementById('modalBody');
  const companyTasksWrap = document.createElement('div'); companyTasksWrap.className='subpanel';
  companyTasksWrap.innerHTML = `
    <div class="subpanel-header"><h3>Uppgifter</h3></div>
    <div class="list" id="companyTasks"></div>
    <div style="margin:8px 0;"><button class="secondary" id="addCompanyTask2">Ny uppgift</button></div>
  `;
  const companyNotesWrap = document.createElement('div'); companyNotesWrap.className='subpanel';
  companyNotesWrap.innerHTML = `
    <div class="subpanel-header"><h3>Anteckningar</h3></div>
    <div class="list" id="companyNotes"></div>
    <div style="margin:8px 0;"><button class="secondary" id="addCompanyNote2">Ny anteckning</button></div>
  `;
  bodyEl.appendChild(companyTasksWrap);
  bodyEl.appendChild(companyNotesWrap);
  const companyTasksList = document.getElementById('companyTasks');
  const companyNotesList = document.getElementById('companyNotes');
  const drawCompanyTN = () => {
    companyTasksList.innerHTML = AppState.tasks.filter(t=>t.entityType==='company'&&t.entityId===c.id).map(taskRow).join('');
    companyNotesList.innerHTML = AppState.notes.filter(n=>n.entityType==='company'&&n.entityId===c.id).map(noteRow).join('');
  };
  drawCompanyTN();
  companyTasksWrap.addEventListener('click',(e)=>{
    const del=e.target.closest('button[data-del-task]'); if (del){ AppState.tasks = AppState.tasks.filter(t=>t.id!==del.dataset.delTask); saveState(); drawCompanyTN(); return; }
    const done=e.target.closest('button[data-done]'); if (done){ const t=AppState.tasks.find(x=>x.id===done.dataset.done); if(t){ t.done=true; saveState(); drawCompanyTN(); }}
    const edit=e.target.closest('button[data-edit-task]'); if (edit){ openTaskModal({ taskId: edit.dataset.editTask }); }
  });
  companyNotesWrap.addEventListener('click',(e)=>{ const del=e.target.closest('button[data-del-note]'); if (del){ AppState.notes = AppState.notes.filter(n=>n.id!==del.dataset.delNote); saveState(); drawCompanyTN(); return; } const edit=e.target.closest('button[data-edit-note]'); if (edit){ openNoteModal('company', c.id, edit.dataset.editNote); }});
  document.getElementById('addCompanyTask2').addEventListener('click',()=>openTaskModal({entityType:'company', entityId:c.id}));
  document.getElementById('addCompanyNote2').addEventListener('click',()=>openNoteModal('company', c.id));
}

function generateAIMarketReport(company) {
  if (!company) return;
  
  modal.show(`
    <h3>ðŸ¤– AI Market Report: ${company.namn}</h3>
    <div class="muted" style="margin-bottom: 16px;">Genererar marknadsrapport med Claude Sonnet 4...</div>
    
    <div id="aiReportContent" style="margin: 16px 0;">
      <div class="loading" style="text-align: center; padding: 40px;">
        <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <p style="margin-top: 16px; color: #6b7280;">Analyserar marknadsdata...</p>
      </div>
    </div>
    
    <div style="margin-top:10px; display:flex; gap:8px; justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="modal.hide()">StÃ¤ng</button>
    </div>
  `);
  
  // Add spinning animation
  const style = document.createElement('style');
  style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
  document.head.appendChild(style);
  
  // Simulate AI report generation (replace with actual API call)
  setTimeout(() => {
    const reportContent = document.getElementById('aiReportContent');
    if (!reportContent) return;
    
    // Mock report data - replace with actual Claude API call
    const agents = AppState.agents.filter(a => a.companyId === company.id);
    const activeAgents = agents.filter(a => a.licens?.status === 'aktiv').length;
    const brand = AppState.brands.find(b => b.id === company.brandId);
    
    reportContent.innerHTML = `
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
        <h4 style="margin: 0 0 12px 0; color: #1f2937;">ðŸ“Š FÃ¶retagsÃ¶versikt</h4>
        <div style="display: grid; gap: 8px;">
          <div><strong>FÃ¶retag:</strong> ${company.namn}</div>
          <div><strong>Kedja:</strong> ${brand?.namn || 'FristÃ¥ende'}</div>
          <div><strong>Ort:</strong> ${company.stad || 'Ej angivet'}</div>
          <div><strong>Antal mÃ¤klare:</strong> ${agents.length}</div>
          <div><strong>Aktiva licenser:</strong> ${activeAgents} av ${agents.length}</div>
          <div><strong>Status:</strong> ${company.status}</div>
          ${company.payment ? `<div><strong>MRR:</strong> ${formatSek(company.payment)}</div>` : ''}
        </div>
      </div>
      
      <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #3b82f6;">
        <h4 style="margin: 0 0 12px 0; color: #1e40af;">ðŸ’¡ AI-Insikter</h4>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
          ${activeAgents < agents.length ? `<li><strong>Licenspotential:</strong> ${agents.length - activeAgents} mÃ¤klare saknar aktiva licenser. Potential fÃ¶r merfÃ¶rsÃ¤ljning.</li>` : ''}
          ${company.status !== 'kund' ? '<li><strong>KonverteringsmÃ¶jlighet:</strong> FÃ¶retaget Ã¤r inte kund Ã¤nnu. Rekommenderar uppfÃ¶ljning med beslutsfattare.</li>' : ''}
          ${!company.payment || company.payment === 0 ? '<li><strong>PrisfÃ¶rhandling:</strong> Ingen nuvarande betalning registrerad. FÃ¶reslÃ¥ produktpaket baserat pÃ¥ antalet mÃ¤klare.</li>' : ''}
          ${agents.length > 10 ? '<li><strong>Stor organisation:</strong> Med ' + agents.length + ' mÃ¤klare finns potential fÃ¶r volymrabatt och lÃ¥ngsiktigt partnerskap.</li>' : ''}
          <li><strong>NÃ¤sta steg:</strong> ${company.status === 'kund' ? 'Boka in kvartalsgenomgÃ¥ng fÃ¶r att sÃ¤kerstÃ¤lla kundnÃ¶jdhet och identifiera up-sell mÃ¶jligheter.' : 'SchemalÃ¤gg demo och presentera ROI-kalkyl baserad pÃ¥ organisationens storlek.'}</li>
        </ul>
      </div>
      
      <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
        <h4 style="margin: 0 0 12px 0; color: #065f46;">ðŸŽ¯ Rekommenderade Ã¥tgÃ¤rder</h4>
        <ol style="margin: 0; padding-left: 20px; line-height: 1.6;">
          <li>Boka mÃ¶te med ansvarig beslutsfattare inom 14 dagar</li>
          <li>FÃ¶rbered anpassad offert baserad pÃ¥ ${agents.length} mÃ¤klare</li>
          <li>Skicka case studies frÃ¥n liknande ${brand?.namn ? 'kedjor' : 'fÃ¶retag'}</li>
          <li>UppfÃ¶ljning: SchemalÃ¤gg Ã¥terkoppling om 7 dagar</li>
        </ol>
      </div>
      
      <div style="margin-top: 16px; padding: 12px; background: #fef3c7; border-radius: 6px; font-size: 12px; color: #92400e;">
        <strong>ðŸ”’ AI-genererad rapport:</strong> Denna rapport Ã¤r genererad baserat pÃ¥ CRM-data och Ã¤r avsedd som beslutsstÃ¶d. Komplettera alltid med personlig bedÃ¶mning och kunddialog.
      </div>
    `;
  }, 1500); // Simulate API delay
}

function openCompanyModal() {
  const segmentOptions = (AppState.segments || []).map(s => 
    `<option value="${s.id}">${s.icon} ${s.name}</option>`
  ).join('');
  
  modal.show(`
    <h3>Nytt fÃ¶retag</h3>
    <div class="grid-2">
      <div class="field"><label>Namn</label><input id="cName" /></div>
      <div class="field"><label>VarumÃ¤rke</label><select id="cBrand">${AppState.brands.map(b => `<option value="${b.id}">${b.namn}</option>`).join('')}</select></div>
      <div class="field"><label>Stad</label><input id="cCity" /></div>
      <div class="field"><label>Segment</label>
        <select id="cSegment">
          <option value="">Ã„rv frÃ¥n varumÃ¤rke</option>
          ${segmentOptions}
        </select>
      </div>
      <div class="field"><label>Status</label>
        <select id="cStatus">
          <option value="kund">Kund</option>
          <option value="prospekt" selected>Prospekt</option>
          <option value="ej">Ej kontakt</option>
        </select>
      </div>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="primary" id="saveCompany2">Spara</button>
      <button class="secondary" onclick="modal.hide()">Avbryt</button>
    </div>
  `);
  
  // Auto-select segment from brand
  $('#cBrand').addEventListener('change', () => {
    const selectedBrand = AppState.brands.find(b => b.id === $('#cBrand').value);
    if (selectedBrand && selectedBrand.segmentId && !$('#cSegment').value) {
      // Show brand's segment as hint, user can still override
    }
  });
  
  $('#saveCompany2').addEventListener('click', () => {
    const brandId = $('#cBrand').value;
    const selectedBrand = AppState.brands.find(b => b.id === brandId);
    const segmentId = $('#cSegment').value || selectedBrand?.segmentId || 'real-estate';
    
    const rec = { 
      id: id(), 
      namn: $('#cName').value.trim(), 
      brandId, 
      segmentId,
      stad: $('#cCity').value.trim(), 
      status: $('#cStatus').value, 
      pipelineStage:'kvalificerad', 
      potentialValue: 0, 
      claudeSonnet4Enabled: false 
    };
    if (!rec.namn) return;
    AppState.companies.push(rec); saveState(); modal.hide(); renderCompanies();
  });
}

function renderAgents() {
  const root = document.getElementById('view-agents');
  renderTemplate('tpl-agents', root);
  const companySelect = document.getElementById('agentCompanyFilter');
  
  // Filter companies by active segment
  const activeSegmentId = AppState.activeSegmentId;
  const filteredCompanies = activeSegmentId 
    ? AppState.companies.filter(c => c.segmentId === activeSegmentId)
    : AppState.companies;
  
  companySelect.innerHTML = `<option value="all">Alla fÃ¶retag</option>` + 
    filteredCompanies.map(c => `<option value="${c.id}">${c.namn}</option>`).join('');

  const table = document.getElementById('agentTable');
  const isAdmin = (currentUser()?.roll === 'admin');
  const pageSizeSel = document.getElementById('agentPageSize');
  const pageInfo = document.getElementById('agentPageInfo');
  const prevBtn = document.getElementById('agentPrev');
  const nextBtn = document.getElementById('agentNext');
  const statusFilter = document.getElementById('agentStatusFilter');
  const highlightData = (highlightRequest && highlightRequest.type === 'agent') ? highlightRequest : null;
  let highlightApplied = false;
  if (highlightData?.filters) {
    if ('companyId' in highlightData.filters) {
      companySelect.value = highlightData.filters.companyId ? highlightData.filters.companyId : 'all';
    }
    if ('status' in highlightData.filters && statusFilter) {
      statusFilter.value = highlightData.filters.status || 'all';
    }
  }
  let page = 1;
  let sortKey = 'name';
  let sortAsc = true;

  function draw() {
    const companyId = companySelect.value;
    const status = statusFilter.value;
    const activeSegmentId = AppState.activeSegmentId;
    
    // Filter agents by segment (via their company's segment)
    const filtered = AppState.agents.filter(a => {
      const companyMatch = (companyId==='all'||a.companyId===companyId);
      const statusMatch = (status==='all'||a.status===status);
      
      // Segment filter
      if (activeSegmentId) {
        const company = AppState.companies.find(c => c.id === a.companyId);
        if (!company || company.segmentId !== activeSegmentId) {
          return false;
        }
      }
      
      return companyMatch && statusMatch;
    });
    
    const size = Number(pageSizeSel.value)||25;
    const statusRank = { ej:0, prospekt:1, kund:2 };
    const licRank = { ingen:0, test:1, aktiv:2 };
    const sorter = (a,b) => {
      const nameA = `${a.fÃ¶rnamn} ${a.efternamn}`.trim();
      const nameB = `${b.fÃ¶rnamn} ${b.efternamn}`.trim();
      const emailA = String(a.email||''); const emailB = String(b.email||'');
      const compA = companyName(a.companyId), compB = companyName(b.companyId);
      const map = {
        name: () => nameA.localeCompare(nameB,'sv'),
        company: () => compA.localeCompare(compB,'sv'),
        contact: () => emailA.localeCompare(emailB,'sv'),
        status: () => (statusRank[a.status||'ej'] - statusRank[b.status||'ej']) || (licRank[(a.licens?.status)||'ingen'] - licRank[(b.licens?.status)||'ingen'])
      };
      const cmp = (map[sortKey]||map.name)();
      return sortAsc ? cmp : -cmp;
    };
    let sorted = [...filtered].sort(sorter);
    if (highlightData && !highlightApplied) {
      const idx = sorted.findIndex(a => a.id === highlightData.id);
      if (idx >= 0) {
        const pageSize = size || 1;
        page = Math.floor(idx / pageSize) + 1;
      }
    }
    const total = filtered.length;
    const maxPage = Math.max(1, Math.ceil(total/size));
    if (page>maxPage) page=maxPage;
    const start = (page-1)*size;
    const rows = sorted.slice(start, start+size);
    
    // Build modern layout
    const fragment = document.createDocumentFragment();
    
    // Header with sort indicators
    const header = document.createElement('div');
    header.className = 'row header';
    const sortIcon = (key) => sortKey === key ? (sortAsc ? ' â–²' : ' â–¼') : '';
    header.innerHTML = '<div data-sort="name" style="flex: 2; font-weight: 600;">MÃ¤klare' + sortIcon('name') + '</div><div data-sort="company" style="flex: 1.5;">FÃ¶retag' + sortIcon('company') + '</div><div data-sort="status" style="flex: 1.2;">Status' + sortIcon('status') + '</div><div style="flex: 1; text-align: right;">Ã…tgÃ¤rder</div>';
    fragment.appendChild(header);
    
    // Data rows
    rows.forEach(a => {
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.agentId = a.id;
      row.style.cssText = 'align-items: center; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; transition: background 0.15s;';
      
      // Agent name column with contact info
      const nameCol = document.createElement('div');
      nameCol.style.cssText = 'flex: 2; display: flex; flex-direction: column; gap: 4px;';
      
      const agentName = document.createElement('div');
      agentName.style.cssText = 'font-weight: 600; font-size: 15px; color: #111827; display: flex; align-items: center; gap: 6px;';
      agentName.textContent = a.fÃ¶rnamn + ' ' + a.efternamn;
      
      // Multi-office indicator
      const others = otherCompaniesForAgent(a);
      if (others.length > 0) {
        const multiSpan = document.createElement('span');
        multiSpan.className = 'multi-office';
        multiSpan.title = 'Arbetar Ã¤ven pÃ¥: ' + others.map(c => c.namn).join(', ');
        multiSpan.style.cssText = 'color: #f59e0b; font-weight: 700;';
        multiSpan.textContent = 'â€¢';
        agentName.appendChild(multiSpan);
      }
      nameCol.appendChild(agentName);
      
      // Contact info
      const contactMeta = document.createElement('div');
      contactMeta.style.cssText = 'font-size: 13px; color: #6b7280; display: flex; gap: 12px; align-items: center;';
      const contactParts = [];
      if (a.email) contactParts.push('<a href="mailto:' + a.email + '" style="color: #2563eb; text-decoration: none;">ðŸ“§ ' + a.email + '</a>');
      if (a.telefon) contactParts.push('<a href="tel:' + a.telefon + '" style="color: #2563eb; text-decoration: none;">ðŸ“ž ' + a.telefon + '</a>');
      contactMeta.innerHTML = contactParts.join(' Â· ');
      nameCol.appendChild(contactMeta);
      row.appendChild(nameCol);
      
      // Company column
      const compCol = document.createElement('div');
      compCol.style.cssText = 'flex: 1.5; display: flex; flex-direction: column; gap: 2px;';
      const companyNameEl = document.createElement('div');
      companyNameEl.style.cssText = 'font-size: 14px; color: #374151; font-weight: 500;';
      companyNameEl.textContent = companyName(a.companyId);
      compCol.appendChild(companyNameEl);
      if (a.officeName) {
        const officeEl = document.createElement('div');
        officeEl.style.cssText = 'font-size: 12px; color: #9ca3af;';
        officeEl.textContent = 'Kontor: ' + a.officeName;
        compCol.appendChild(officeEl);
      }
      row.appendChild(compCol);
      
      // Status column with badges
      const statusCol = document.createElement('div');
      statusCol.style.cssText = 'flex: 1.2; display: flex; flex-direction: column; gap: 4px;';
      
      // Customer status badge
      const statusBadge = document.createElement('span');
      const statusColors = {
        kund: { bg: '#d1fae5', text: '#065f46', icon: 'âœ“' },
        prospekt: { bg: '#fef3c7', text: '#92400e', icon: 'â³' },
        ej: { bg: '#f3f4f6', text: '#6b7280', icon: 'â—‹' }
      };
      const statusColor = statusColors[a.status] || statusColors.ej;
      statusBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; background: ' + statusColor.bg + '; color: ' + statusColor.text + '; border-radius: 9999px; font-size: 12px; font-weight: 600; width: fit-content;';
      statusBadge.innerHTML = '<span>' + statusColor.icon + '</span> ' + (a.status === 'kund' ? 'Kund' : a.status === 'prospekt' ? 'Prospekt' : 'Ej kontakt');
      statusCol.appendChild(statusBadge);
      
      // License badge
      const licenseStatus = (a.licens && a.licens.status) || 'ingen';
      if (licenseStatus !== 'ingen') {
        const licenseBadge = document.createElement('span');
        const licColors = {
          aktiv: { bg: '#dcfce7', text: '#166534' },
          test: { bg: '#fef3c7', text: '#92400e' },
          ingen: { bg: '#f3f4f6', text: '#6b7280' }
        };
        const licColor = licColors[licenseStatus] || licColors.ingen;
        licenseBadge.style.cssText = 'display: inline-block; padding: 2px 8px; background: ' + licColor.bg + '; color: ' + licColor.text + '; border-radius: 9999px; font-size: 11px; font-weight: 600; width: fit-content;';
        licenseBadge.textContent = 'Licens: ' + licenseStatus;
        statusCol.appendChild(licenseBadge);
      }
      
      // Product type if available
      if (a.licens && a.licens.typ) {
        const productText = document.createElement('div');
        productText.style.cssText = 'font-size: 12px; color: #6b7280; margin-top: 2px;';
        productText.textContent = a.licens.typ;
        statusCol.appendChild(productText);
      }
      row.appendChild(statusCol);
      
      // Actions column
      const actionsCol = document.createElement('div');
      actionsCol.className = 'actions';
      actionsCol.style.cssText = 'flex: 1; display: flex; gap: 6px; justify-content: flex-end;';
      actionsCol.innerHTML = '<button class="secondary" data-open-agent="' + a.id + '" style="padding: 6px 12px; font-size: 13px;">Ã–ppna</button><button class="secondary" data-note-agent="' + a.id + '" style="padding: 6px 12px; font-size: 13px;">ðŸ“</button>';
      row.appendChild(actionsCol);
      
      fragment.appendChild(row);
    });
    
    table.innerHTML = '';
    table.appendChild(fragment);
    pageInfo.textContent = total ? `Sida ${page} av ${maxPage} Â· ${total} resultat` : 'Inga resultat';
    prevBtn.disabled = (page<=1);
    nextBtn.disabled = (page>=maxPage);

    if (highlightData && !highlightApplied) {
      highlightApplied = true;
      highlightRequest = null;
      const rowEl = table.querySelector(`.row[data-agent-id="${highlightData.id}"]`);
      if (rowEl) {
        rowEl.classList.add('highlight');
        rowEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => rowEl.classList.remove('highlight'), 1800);
      }
    }
  }

  draw();
  
  // Add click handlers for sorting and actions
  table.addEventListener('click', (e) => {
    const sortHeader = e.target.closest('[data-sort]');
    if (sortHeader) {
      const newKey = sortHeader.dataset.sort;
      if (sortKey === newKey) {
        sortAsc = !sortAsc;
      } else {
        sortKey = newKey;
        sortAsc = true;
      }
      draw();
      return;
    }
    
    const openBtn = e.target.closest('[data-open-agent]');
    if (openBtn) {
      openAgent(openBtn.dataset.openAgent);
      return;
    }
    
    const noteBtn = e.target.closest('[data-note-agent]');
    if (noteBtn) {
      openNoteModal('agent', noteBtn.dataset.noteAgent);
      return;
    }
  });
  
  companySelect.addEventListener('change', draw);
  statusFilter.addEventListener('change', draw);
  pageSizeSel.addEventListener('change', () => { page = 1; draw(); });
  prevBtn.addEventListener('click', () => { if (page>1) { page--; draw(); } });
  nextBtn.addEventListener('click', () => { page++; draw(); });

  document.getElementById('addAgent').addEventListener('click', () => openAgentModal());
  document.getElementById('exportAgents').addEventListener('click', () => exportAgentsToCsv());
}

function exportAgentsToCsv() {
  const companyId = document.getElementById('agentCompanyFilter').value;
  const status = document.getElementById('agentStatusFilter').value;
  const rows = AppState.agents.filter(a => (companyId==='all'||a.companyId===companyId) && (status==='all'||a.status===status));
  const csv = [
    ['FÃ¶rnamn','Efternamn','FÃ¶retag','E-post','Telefon','Status','Licens','Produkt'].join(',')
  ].concat(rows.map(a => [a.fÃ¶rnamn, a.efternamn, companyName(a.companyId), a.email||'', a.telefon||'', a.status, a.licens?.status||'ingen', a.licens?.typ||'']
    .map(v => `"${String(v).replaceAll('"','""')}"`).join(','))).join('\n');
  downloadCsv(csv, `maklare_export_${Date.now()}.csv`);
}

// --- Global export helpers ---
function exportTasksToCsv() {
  const filter = document.getElementById('todoFilter')?.value || 'all';
  const tasks = AppState.tasks
    .filter(t => filter==='all' || t.ownerId===AppState.currentUserId)
    .sort((a,b) => (a.done===b.done?0:a.done?1:-1) || (new Date(a.dueAt||0) - new Date(b.dueAt||0)));
  const rows = tasks.map(t => {
    const linkType = t.entityType||'';
    const linkName = t.entityType==='brand' ? brandName(t.entityId) : t.entityType==='company' ? companyName(t.entityId) : t.entityType==='agent' ? agentName(t.entityId) : '';
    return [
      t.title,
      t.dueAt ? new Date(t.dueAt).toLocaleDateString('sv-SE') : '',
      userName(t.ownerId),
      t.done ? 'ja' : 'nej',
      linkType,
      linkName
    ];
  });
  const csv = [
    ['Titel','FÃ¶rfallodatum','Ã„gare','Klar?','Kopplingstyp','Kopplingsnamn'].join(',')
  ].concat(rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(','))).join('\n');
  downloadCsv(csv, `uppgifter_export_${Date.now()}.csv`);
}

function formatSek(n) {
  try {
    return (new Intl.NumberFormat('sv-SE', { style:'currency', currency:'SEK', maximumFractionDigits:0 })).format(n||0);
  } catch (e) {
    return `${n||0} kr`;
  }
}

function exportCompaniesToCsv() {
  const brandId = document.getElementById('companyBrandFilter').value;
  const status = document.getElementById('companyStatusFilter').value;
  const pipeline = document.getElementById('companyPipelineFilter').value;
  const rows = AppState.companies.filter(c => (brandId==='all'||c.brandId===brandId) && (status==='all'||c.status===status) && (pipeline==='all'||(c.pipelineStage||'')===pipeline));
  const csv = [
    ['FÃ¶retag','VarumÃ¤rke','Stad','Status','Centralt avtal','Produkt','Kundnr','Orgnummer','Pipeline','Potential (SEK)','MRR (SEK)'].join(',')
  ].concat(rows.map(c => {
    const brand = AppState.brands.find(b => b.id===c.brandId);
    const product = c.product || (c.centralContract ? (brand?.centralContract?.product || '') : '');
    return [c.namn, brandName(c.brandId), c.stad||'', c.status, (c.centralContract?'ja':''), product, c.customerNumber||'', String(c.orgNumber||''), c.pipelineStage||'', c.potentialValue||0, c.payment||0]
      .map(v => `"${String(v).replaceAll('"','""')}"`).join(',');
  })).join('\n');
  downloadCsv(csv, `foretag_export_${Date.now()}.csv`);
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Format Swedish orgnummer (NNNNNN-XXXX) when possible
function formatOrg(v) {
  const s = String(v||'').replace(/[^0-9]/g,'');
  if (!s) return '';
  if (s.length === 10) return `${s.slice(0,6)}-${s.slice(6)}`;
  if (s.length === 12) return `${s.slice(2,8)}-${s.slice(8)}`; // support 12-digit with century
  return s; // fallback raw digits
}

// Consider a company a customer if:
// - status is 'kund' OR
// - payment (MRR) > 0 OR
// - centrally covered (centralContract flag) OR
// - brand has an active central contract
function isCompanyCustomer(c) {
  if (!c) return false;
  const status = String(c.status||'');
  const paying = Number(c.payment)||0;
  const central = !!c.centralContract;
  const brandCentral = !!(AppState.brands.find(b => b.id===c.brandId)?.centralContract?.active);
  return status==='kund' || paying>0 || central || brandCentral;
}

// Person identity helpers (dedupe agents across multiple offices)
function personKey(agent) {
  const email = String(agent?.email||'').trim().toLowerCase();
  if (email) return `em:${email}`;
  const first = String(agent?.fÃ¶rnamn||'').trim().toLowerCase();
  const last = String(agent?.efternamn||'').trim().toLowerCase();
  if (first || last) return `nm:${first} ${last}`.trim();
  const phone = String(agent?.telefon||'').replace(/\s+/g,'');
  if (phone) return `ph:${phone}`;
  return `id:${agent?.id||Math.random()}`; // fallback to avoid collapsing different unknowns
}
function otherCompaniesForAgent(agent) {
  const pk = personKey(agent);
  const compIds = new Set(
    AppState.agents
      .filter(a => personKey(a)===pk)
      .map(a => a.companyId)
      .filter(cid => cid && cid !== agent.companyId)
  );
  return Array.from(compIds).map(id => AppState.companies.find(c => c.id===id)).filter(Boolean);
}

function openAgent(id, options = {}) {
  const sameContext = modalCurrent && modalCurrent.type === 'agent' && modalCurrent.id === id;
  if (!options.fromStack && !options.fromParent && !sameContext) {
    resetModalNavigation();
  }
  modalCurrent = { type: 'agent', id };
  const a = AppState.agents.find(x => x.id === id);
  const mp = a.maklarpaket || {};
  const op = a.otherProducts || {};
  modal.show(`
    <h3>${a.fÃ¶rnamn} ${a.efternamn}</h3>
  <div class="modal-toolbar"><button class="secondary toolbar-back" id="agentBackLink" type="button">â€¹ Tillbaka till lista</button></div>
    <div class="muted"><span id="agentCompanyLabel">${companyName(a.companyId)}</span> Â· ${tagStatus(a.status)} Â· licens: ${tagStatus(a.licens?.status||'ingen')}${a.licens?.typ?(' Â· produkt: '+a.licens.typ):''}</div>
    ${(() => { const others = otherCompaniesForAgent(a); if (!others.length) return ''; return `<div class=\"muted\" style=\"margin-top:6px;\">Arbetar Ã¤ven pÃ¥: ${others.map(c => `<a href=\"#\" data-open-company=\"${c.id}\">${c.namn}</a>`).join(', ')}</div>`; })()}
    <div class="grid-2" style="margin-top:10px;">
      <div class="field"><label>E-post</label><input id="aEmail" value="${a.email||''}"/></div>
      <div class="field"><label>Telefon</label><input id="aPhone" value="${a.telefon||''}"/></div>
      <div class="field"><label>Status</label>
        <select id="aStatus">
          <option value="kund" ${a.status==='kund'?'selected':''}>Kund</option>
          <option value="prospekt" ${a.status==='prospekt'?'selected':''}>Prospekt</option>
          <option value="ej" ${a.status==='ej'?'selected':''}>Ej kontakt</option>
        </select>
      </div>
      <div class="field"><label>MÃ¤klarfÃ¶retag</label>
        <select id="aCompany">
          ${AppState.companies.map(co => {
            const brand = brandName(co.brandId);
            const extra = brand && brand !== 'â€“' ? ` Â· ${brand}` : '';
            return `<option value="${co.id}" ${co.id===a.companyId?'selected':''}>${co.namn}${extra}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="field"><label>Licens</label>
        <select id="aLicense">
          <option value="aktiv" ${a.licens?.status==='aktiv'?'selected':''}>Aktiv</option>
          <option value="test" ${a.licens?.status==='test'?'selected':''}>Test</option>
          <option value="ingen" ${(!a.licens||a.licens.status==='ingen')?'selected':''}>Ingen</option>
        </select>
      </div>
      <div class="field"><label>Produkt</label><input id="aProduct" value="${a.licens?.typ||''}"/></div>
      <div class="field"><label>Registreringstyp</label><input id="aRegistrationType" value="${a.registrationType||''}"/></div>
      <div class="field"><label>Kontor (import)</label><input id="aOffice" value="${a.officeName||''}"/></div>
    </div>
    <div class="field" style="margin-top:10px;"><label>Produkter (importerad text)</label><textarea id="aProducts" rows="2">${a.productsImported||''}</textarea></div>
    <div class="field" style="margin-top:10px;"><label>Matchtyp</label><input id="aMatchType" value="${a.matchType||''}"/></div>
    <h4 style="margin-top:12px;">MÃ¤klarpaket</h4>
    <div class="grid-2">
      <div class="field"><label>AnvÃ¤ndarID</label><input id="aMpUserId" value="${mp.userId||''}"/></div>
      <div class="field"><label>MS Namn</label><input id="aMpMsName" value="${mp.msName||''}"/></div>
      <div class="field"><label>UID</label><input id="aMpUid" value="${mp.uid||''}"/></div>
      <div class="field"><label>E-post</label><input id="aMpEmail" value="${mp.email||''}"/></div>
      <div class="field"><label>Kundnummer</label><input id="aMpCustomerNumber" value="${mp.customerNumber||''}"/></div>
      <div class="field"><label>Kontor</label><input id="aMpOffice" value="${mp.office||''}"/></div>
      <div class="field"><label>Kedja</label><input id="aMpBrand" value="${mp.brand||''}"/></div>
      <div class="field"><label>Produktnamn</label><input id="aMpProductName" value="${mp.productName||''}"/></div>
      <div class="field"><label>Totalkostnad (SEK)</label><input id="aMpTotalCost" type="number" step="100" value="${mp.totalCost!==undefined && mp.totalCost!==null ? mp.totalCost : ''}"/></div>
      <div class="field"><label>Rabatt</label><input id="aMpDiscount" type="number" step="1" value="${mp.discount!==undefined && mp.discount!==null ? mp.discount : ''}"/></div>
      <div class="field"><label>Aktiv</label>
        <select id="aMpActive">
          <option value="" ${(mp.active===undefined||mp.active===null)?'selected':''}>(okÃ¤nt)</option>
          <option value="true" ${mp.active===true?'selected':''}>Ja</option>
          <option value="false" ${mp.active===false?'selected':''}>Nej</option>
        </select>
      </div>
    </div>
    <h4 style="margin-top:12px;">Ã–vriga mÃ¤klarprodukter</h4>
    <div class="grid-2">
      <div class="field"><label>AnvÃ¤ndarID</label><input id="aOtherUserId" value="${op.userId||''}"/></div>
      <div class="field"><label>UID</label><input id="aOtherUid" value="${op.uid||''}"/></div>
      <div class="field"><label>E-post</label><input id="aOtherEmail" value="${op.email||''}"/></div>
      <div class="field"><label>Kundnummer</label><input id="aOtherCustomerNumber" value="${op.customerNumber||''}"/></div>
    </div>
    <h4 style="margin-top:12px;">Uppgifter</h4>
    <div class="list" id="agentTasks">
      ${AppState.tasks.filter(t => t.entityType==='agent' && t.entityId===a.id).map(taskRow).join('')}
    </div>
    <div style="margin:8px 0;">
      <button class="secondary" id="addAgentTask">Ny uppgift</button>
    </div>
    <h4>Anteckningar</h4>
    <div class="list" id="agentNotes"></div>
    <div style="margin:8px 0;">
      <button class="secondary" id="addAgentNote">Ny anteckning</button>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="primary" id="saveAgent">Spara</button>
      <button class="secondary" id="agentBackToList">Tillbaka till lista</button>
      <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
    </div>
  `);
  const agentCompanySelect = $('#aCompany');
  const agentCompanyLabel = $('#agentCompanyLabel');
  if (agentCompanySelect && agentCompanyLabel) {
    const updateAgentCompanyLabel = () => {
      agentCompanyLabel.textContent = companyName(agentCompanySelect.value);
    };
    agentCompanySelect.addEventListener('change', updateAgentCompanyLabel);
    updateAgentCompanyLabel();
  }
  $('#saveAgent').addEventListener('click', () => {
    a.email = $('#aEmail').value.trim();
    a.telefon = $('#aPhone').value.trim();
    a.status = $('#aStatus').value;
    if (agentCompanySelect) {
      const newCompanyId = agentCompanySelect.value;
      a.companyId = newCompanyId || null;
    }
    a.licens = { status: $('#aLicense').value, typ: $('#aProduct').value.trim() };
    const regType = $('#aRegistrationType')?.value.trim() || '';
    if (regType) a.registrationType = regType; else delete a.registrationType;
    const officeName = $('#aOffice')?.value.trim() || '';
    if (officeName) a.officeName = officeName; else delete a.officeName;
    const productsImported = $('#aProducts')?.value.trim() || '';
    if (productsImported) a.productsImported = productsImported; else delete a.productsImported;
    const matchType = $('#aMatchType')?.value.trim() || '';
    if (matchType) a.matchType = matchType; else delete a.matchType;
    const mpData = {};
    const mpUserId = $('#aMpUserId')?.value.trim() || '';
    if (mpUserId) mpData.userId = mpUserId;
    const mpMsName = $('#aMpMsName')?.value.trim() || '';
    if (mpMsName) mpData.msName = mpMsName;
    const mpUid = $('#aMpUid')?.value.trim() || '';
    if (mpUid) mpData.uid = mpUid;
    const mpEmail = $('#aMpEmail')?.value.trim() || '';
    if (mpEmail) mpData.email = mpEmail;
    const mpCustomerNumber = $('#aMpCustomerNumber')?.value.trim() || '';
    if (mpCustomerNumber) mpData.customerNumber = mpCustomerNumber;
    const mpOffice = $('#aMpOffice')?.value.trim() || '';
    if (mpOffice) mpData.office = mpOffice;
    const mpBrand = $('#aMpBrand')?.value.trim() || '';
    if (mpBrand) mpData.brand = mpBrand;
    const mpProductName = $('#aMpProductName')?.value.trim() || '';
    if (mpProductName) mpData.productName = mpProductName;
    const mpActiveRaw = $('#aMpActive')?.value ?? '';
    if (mpActiveRaw !== '') mpData.active = (mpActiveRaw === 'true');
    const mpTotalCostRaw = $('#aMpTotalCost')?.value ?? '';
    if (mpTotalCostRaw !== '') mpData.totalCost = Number(mpTotalCostRaw);
    const mpDiscountRaw = $('#aMpDiscount')?.value ?? '';
    if (mpDiscountRaw !== '') mpData.discount = Number(mpDiscountRaw);
    if (Object.keys(mpData).length) a.maklarpaket = mpData; else delete a.maklarpaket;
    const otherData = {};
    const otherUserId = $('#aOtherUserId')?.value.trim() || '';
    if (otherUserId) otherData.userId = otherUserId;
    const otherUid = $('#aOtherUid')?.value.trim() || '';
    if (otherUid) otherData.uid = otherUid;
    const otherEmail = $('#aOtherEmail')?.value.trim() || '';
    if (otherEmail) otherData.email = otherEmail;
    const otherCustomerNumber = $('#aOtherCustomerNumber')?.value.trim() || '';
    if (otherCustomerNumber) otherData.customerNumber = otherCustomerNumber;
    if (Object.keys(otherData).length) a.otherProducts = otherData; else delete a.otherProducts;
    saveState(); modal.hide(); renderAgents(); renderCompanies(); renderBrands(); renderDashboard();
  });
  const agentBackBtn = $('#modalBody').querySelector('#agentBackToList');
  const agentBackLink = $('#modalBody').querySelector('#agentBackLink');
  const goBackAgent = () => {
    const parent = modalNavStack.pop();
    if (parent) {
      modal.hide();
      modalCurrent = null;
      reopenParentContext(parent);
      return;
    }
    queueHighlight('agent', a.id, {
      filters: {
        companyId: a.companyId || null,
        status: a.status || null
      }
    });
    modal.hide();
    resetModalNavigation();
    setView('agents');
  };
  [agentBackBtn, agentBackLink].forEach(btn => btn && btn.addEventListener('click', goBackAgent));
  $('#addAgentTask').addEventListener('click', () => openTaskModal({entityType:'agent', entityId:a.id}));
  // Handle task completion and deletion within agent modal
  document.getElementById('agentTasks').addEventListener('click', (e) => {
    const del=e.target.closest('button[data-del-task]'); if (del){ AppState.tasks = AppState.tasks.filter(t=>t.id!==del.dataset.delTask); saveState(); openAgent(a.id, { fromStack: true }); return; }
    const done=e.target.closest('button[data-done]'); if (done){ const t=AppState.tasks.find(x=>x.id===done.dataset.done); if(t){ t.done=true; saveState(); openAgent(a.id, { fromStack: true }); }}
    const edit=e.target.closest('button[data-edit-task]'); if (edit){ openTaskModal({ taskId: edit.dataset.editTask }); }
  });
  // Draw notes and wire deletion
  const agentNotesList = document.getElementById('agentNotes');
  if (agentNotesList) {
    agentNotesList.innerHTML = AppState.notes.filter(n=>n.entityType==='agent'&&n.entityId===a.id).map(noteRow).join('');
    document.getElementById('addAgentNote').addEventListener('click', () => openNoteModal('agent', a.id));
    agentNotesList.addEventListener('click', (e) => {
      const del=e.target.closest('button[data-del-note]'); if (del){ AppState.notes = AppState.notes.filter(n=>n.id!==del.dataset.delNote); saveState(); openAgent(a.id, { fromStack: true }); return; }
      const edit=e.target.closest('button[data-edit-note]'); if (edit){ openNoteModal('agent', a.id, edit.dataset.editNote); }
    });
  }
  // Link handling for other offices
  document.getElementById('modalBody').addEventListener('click', (e) => {
    const link = e.target.closest('a[data-open-company]');
    if (link) {
      e.preventDefault();
      const cid = link.getAttribute('data-open-company');
      modalNavStack.push({ type:'agent', id: a.id, childHighlight: { type:'company', id: cid } });
      modal.hide();
      modalCurrent = null;
      openCompany(cid, { fromParent: true });
    }
  });
}

function openAgentModal(preset={}) {
  modal.show(`
    <h3>Ny mÃ¤klare</h3>
    <div class="grid-2">
      <div class="field"><label>FÃ¶rnamn</label><input id="nFirst" /></div>
      <div class="field"><label>Efternamn</label><input id="nLast" /></div>
      <div class="field"><label>FÃ¶retag</label><select id="nCompany">${AppState.companies.map(c => `<option value="${c.id}" ${preset.companyId===c.id?'selected':''}>${c.namn}</option>`).join('')}</select></div>
      <div class="field"><label>Status</label>
        <select id="nStatus">
          <option value="kund">Kund</option>
          <option value="prospekt" selected>Prospekt</option>
          <option value="ej">Ej kontakt</option>
        </select>
      </div>
      <div class="field"><label>E-post</label><input id="nEmail" /></div>
      <div class="field"><label>Telefon</label><input id="nPhone" /></div>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="primary" id="saveNewAgent">Spara</button>
      <button class="secondary" onclick="modal.hide()">Avbryt</button>
    </div>
  `);
  $('#saveNewAgent').addEventListener('click', () => {
    const rec = {
      id: id(), fÃ¶rnamn: $('#nFirst').value.trim(), efternamn: $('#nLast').value.trim(),
      companyId: $('#nCompany').value, status: $('#nStatus').value,
      email: $('#nEmail').value.trim(), telefon: $('#nPhone').value.trim(), licens: { status: 'ingen' }
    };
    if (!rec.fÃ¶rnamn || !rec.efternamn) return;
    AppState.agents.push(rec); saveState(); modal.hide(); renderAgents(); renderDashboard();
  });
}

function renderPipeline() {
  const root = document.getElementById('view-pipeline');
  renderTemplate('tpl-pipeline', root);
  
  console.log('renderPipeline called'); // Debug
  
  // Pipeline stages with probabilities
  const stages = [
    { id: 'lead', name: 'Lead', probability: 0.1, color: 'bg-slate-100', icon: 'ðŸŽ¯' },
    { id: 'qualified', name: 'Kvalificerad', probability: 0.2, color: 'bg-blue-100', icon: 'âœ“' },
    { id: 'demo', name: 'Demo/MÃ¶te', probability: 0.4, color: 'bg-indigo-100', icon: 'ðŸ‘¥' },
    { id: 'proposal', name: 'Offert', probability: 0.6, color: 'bg-purple-100', icon: 'ðŸ“„' },
    { id: 'negotiation', name: 'FÃ¶rhandling', probability: 0.8, color: 'bg-amber-100', icon: 'ðŸ¤' },
    { id: 'won', name: 'Vunnen', probability: 1.0, color: 'bg-green-100', icon: 'ðŸŽ‰' },
    { id: 'lost', name: 'FÃ¶rlorad', probability: 0, color: 'bg-red-100', icon: 'âŒ' }
  ];
  
  // Map old pipeline stages to new ones
  const stageMapping = {
    'kvalificerad': 'qualified',
    'offert': 'proposal',
    'fÃ¶rhandling': 'negotiation',
    'vunnit': 'won',
    'fÃ¶rlorat': 'lost'
  };
  
  // User filter
  const userFilter = document.getElementById('pipelineUserFilter');
  userFilter.innerHTML = '<option value="all">Alla sÃ¤ljare</option>' + 
    AppState.users.map(u => `<option value="${u.id}">${u.namn}</option>`).join('');
  
  // Stats toggle
  const statsToggle = document.getElementById('pipelineStatsToggle');
  const statsPanel = document.getElementById('pipelineStats');
  statsToggle.addEventListener('click', () => {
    statsPanel.classList.toggle('hidden');
  });
  
  // Add deal button
  document.getElementById('addDealBtn').addEventListener('click', () => openCompanyModal());
  
  function renderBoard() {
    const userId = userFilter.value;
    const activeSegmentId = AppState.activeSegmentId;
    const board = document.getElementById('pipelineBoard');
    
    // Get companies and categorize by stage
    let companies = AppState.companies.filter(c => {
      if (userId !== 'all' && c.ansvarigSÃ¤ljareId !== userId) return false;
      if (activeSegmentId && c.segmentId !== activeSegmentId) return false;
      return true;
    });
    
    // Separate customer care (existing customers with MRR)
    const customerCare = companies.filter(c => {
      const hasMRR = Number(c.payment) > 0;
      return c.status === 'kund' && hasMRR;
    });
    
    // Active deals (not customers yet, or customers without MRR)
    const activeDeals = companies.filter(c => {
      const hasMRR = Number(c.payment) > 0;
      return c.status !== 'kund' || !hasMRR;
    });
    
    board.innerHTML = '';
    
    stages.forEach(stage => {
      let stageCompanies = [];
      
      if (stage.id === 'customer_care') {
        stageCompanies = customerCare;
      } else if (stage.id === 'lead') {
        // Lead: companies without pipeline stage OR without MRR
        stageCompanies = activeDeals.filter(c => {
          const hasNoPipeline = !c.pipelineStage || c.pipelineStage === '';
          const hasNoMRR = !Number(c.payment) || Number(c.payment) === 0;
          return hasNoPipeline || hasNoMRR;
        });
      } else {
        const oldStage = Object.keys(stageMapping).find(k => stageMapping[k] === stage.id);
        stageCompanies = activeDeals.filter(c => {
          const mapped = stageMapping[c.pipelineStage];
          return mapped === stage.id || (!mapped && c.pipelineStage === stage.id);
        });
      }
      
      // Sort by value descending (highest first) - samma som kundvÃ¥rdstavlan!
      stageCompanies.sort((a, b) => {
        const valueA = Number(a.potentialValue) || Number(a.payment) || 0;
        const valueB = Number(b.potentialValue) || Number(b.payment) || 0;
        return valueB - valueA;
      });
      
      const stageValue = stageCompanies.reduce((sum, c) => sum + (Number(c.potentialValue) || 0), 0);
      const weightedValue = Math.round(stageValue * stage.probability);
      
      const column = document.createElement('div');
      column.className = 'flex-shrink-0 w-80';
      column.dataset.stage = stage.id;
      
      column.innerHTML = `
        <div class="card ${stage.color} shadow-lg">
          <div class="card-body p-3">
            <div class="flex justify-between items-center mb-3">
              <h3 class="font-bold text-lg flex items-center gap-2">
                <span>${stage.icon}</span>
                <span>${stage.name}</span>
              </h3>
              <div class="badge badge-lg">${stageCompanies.length}</div>
            </div>
            <div class="text-xs text-base-content/70">
              <div class="font-semibold">VÃ¤rde: ${formatSek(stageValue)}</div>
              ${stage.probability > 0 && stage.probability < 1 ? `<div class="mt-1">Viktat: ${formatSek(weightedValue)} (${Math.round(stage.probability * 100)}%)</div>` : ''}
            </div>
          </div>
        </div>
        <div class="space-y-3 mt-3 pipeline-drop-zone" data-stage="${stage.id}">
          ${stageCompanies.map(c => createDealCard(c, stage)).join('')}
        </div>
      `;
      
      board.appendChild(column);
    });
    
    // Enable drag and drop
    enableDragAndDrop();
    
    // Add click handlers for deal cards
    attachDealCardHandlers();
    
    // Update statistics
    updatePipelineStats(companies);
  }
  
  function attachDealCardHandlers() {
    // Open company buttons
    document.querySelectorAll('.deal-open-btn, .deal-open').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const companyId = btn.dataset.companyId;
        if (companyId) openCompany(companyId);
      });
    });
    
    // Task buttons
    document.querySelectorAll('.deal-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const companyId = btn.dataset.companyId;
        if (companyId) openTaskModal({entityType: 'company', entityId: companyId});
      });
    });
    
    // Note buttons
    document.querySelectorAll('.deal-note').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const companyId = btn.dataset.companyId;
        if (companyId) openNoteModal('company', companyId);
      });
    });
  }
  
  function createDealCard(company, stage) {
    const brand = AppState.brands.find(b => b.id === company.brandId);
    const agents = AppState.agents.filter(a => a.companyId === company.id);
    const activeAgents = agents.filter(a => a.licens?.status === 'aktiv').length;
    const owner = AppState.users.find(u => u.id === company.ansvarigSÃ¤ljareId);
    
    // AnvÃ¤nd automatisk potentialberÃ¤kning
    const potentialCalc = calculateCompanyPotential(company);
    const value = potentialCalc.potential || Number(company.payment) || 0;
    
    // Calculate days in stage (mock for now)
    const daysInStage = Math.floor(Math.random() * 30) + 1;
    
    // Calculate upsell/opportunities
    const potentialAgents = agents.length - activeAgents;
    const hasOpportunity = potentialAgents > 2;
    const isHighValue = value > 50000;
    
    return `
      <div class="card bg-base-100 shadow hover:shadow-xl transition-shadow cursor-move deal-card" 
           draggable="true" 
           data-company-id="${company.id}">
        <div class="card-body p-4">
          <div class="flex justify-between items-start mb-2">
            <h4 class="font-semibold text-sm">${company.namn}</h4>
            ${isHighValue ? '<span class="badge badge-warning badge-sm">HÃ¶g</span>' : ''}
            ${hasOpportunity ? '<span class="badge badge-info badge-sm">Potential</span>' : ''}
          </div>
          
          <div class="text-xs text-base-content/70 space-y-1">
            ${brand ? `<div>ðŸ¢ ${brand.namn}</div>` : ''}
            ${company.stad ? `<div>ðŸ“ ${company.stad}</div>` : ''}
            <div>ðŸ‘¥ ${agents.length} mÃ¤klare (${activeAgents} med licens)</div>
            ${potentialAgents > 0 ? `<div class="text-info">ðŸ’¡ ${potentialAgents} utan licens â†’ ${formatSek(potentialCalc.maxMRR)}/mÃ¥n mÃ¶jligt</div>` : ''}
            ${value > 0 ? `<div class="font-bold text-lg text-success">ðŸ’° ${formatSek(value)}</div>` : '<div class="font-bold text-sm text-base-content/50">ðŸ’° Inget vÃ¤rde</div>'}
            ${potentialCalc.tier && agents.length >= 4 ? `<div class="text-xs text-base-content/60">ðŸ“Š ${potentialCalc.tier}</div>` : ''}
            ${owner ? `<div>ðŸ‘¤ SÃ¤ljare: ${owner.namn}</div>` : ''}
            ${company.product ? `<div>ðŸ“¦ ${company.product}</div>` : ''}
            <div class="text-base-content/50">â±ï¸ ${daysInStage} dagar i steg</div>
          </div>
          
          <div class="card-actions justify-end mt-3">
            <button class="btn btn-primary btn-xs deal-open-btn" data-company-id="${company.id}">
              Ã–ppna â†’
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  function enableDragAndDrop() {
    const cards = document.querySelectorAll('.deal-card');
    const dropZones = document.querySelectorAll('.pipeline-drop-zone');
    
    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', card.innerHTML);
        e.dataTransfer.setData('companyId', card.dataset.companyId);
        card.classList.add('opacity-50');
      });
      
      card.addEventListener('dragend', (e) => {
        card.classList.remove('opacity-50');
      });
    });
    
    dropZones.forEach(zone => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('bg-base-200', 'rounded-lg');
      });
      
      zone.addEventListener('dragleave', (e) => {
        zone.classList.remove('bg-base-200', 'rounded-lg');
      });
      
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('bg-base-200', 'rounded-lg');
        
        const companyId = e.dataTransfer.getData('companyId');
        const newStage = zone.dataset.stage;
        
        if (companyId && newStage) {
          moveDealToStage(companyId, newStage);
        }
      });
    });
  }
  
  function moveDealToStage(companyId, newStage) {
    const company = AppState.companies.find(c => c.id === companyId);
    if (!company) return;
    
    // Map new stage back to old pipeline stages
    const reverseMapping = {
      'lead': '',
      'qualified': 'kvalificerad',
      'demo': 'demo',
      'proposal': 'offert',
      'negotiation': 'fÃ¶rhandling',
      'won': 'vunnit',
      'lost': 'fÃ¶rlorat',
      'customer_care': 'vunnit'
    };
    
    company.pipelineStage = reverseMapping[newStage] || newStage;
    
    // Update status based on stage
    if (newStage === 'won' || newStage === 'customer_care') {
      company.status = 'kund';
    } else if (newStage === 'lost') {
      company.status = 'ej';
    } else if (newStage === 'qualified' || newStage === 'demo' || newStage === 'proposal' || newStage === 'negotiation') {
      company.status = 'prospekt';
    }
    
    saveState();
    renderBoard();
    renderDashboard();
    
    const stageElement = document.querySelector('[data-stage="' + newStage + '"] h3');
    const stageName = stageElement ? stageElement.textContent : newStage;
    showNotification(company.namn + ' flyttad till ' + stageName, 'success');
  }
  
  function updatePipelineStats(companies) {
    // Total pipeline value
    const activeDeals = companies.filter(c => c.status !== 'kund');
    const totalValue = activeDeals.reduce((sum, c) => sum + (Number(c.potentialValue) || 0), 0);
    const totalDeals = activeDeals.length;
    
    // Weighted expected value
    const expectedValue = activeDeals.reduce((sum, c) => {
      const stage = stages.find(s => {
        const oldStage = Object.keys(stageMapping).find(k => stageMapping[k] === s.id);
        return oldStage === c.pipelineStage || s.id === c.pipelineStage;
      });
      const probability = stage?.probability || 0.1;
      return sum + ((Number(c.potentialValue) || 0) * probability);
    }, 0);
    
    // Conversion rate
    const won = companies.filter(c => c.pipelineStage === 'vunnit' || c.status === 'kund').length;
    const lost = companies.filter(c => c.pipelineStage === 'fÃ¶rlorat').length;
    const total = won + lost || 1;
    const conversionRate = Math.round((won / total) * 100);
    
    // Update DOM
    document.getElementById('statTotalValue').textContent = formatSek(totalValue);
    document.getElementById('statTotalDeals').textContent = `${totalDeals} aktiva affÃ¤rer`;
    document.getElementById('statExpectedValue').textContent = formatSek(expectedValue);
    document.getElementById('statConversionRate').textContent = `${conversionRate}%`;
    document.getElementById('statWonLost').textContent = `${won} vunna / ${lost} fÃ¶rlorade`;
    document.getElementById('statAvgDealTime').textContent = '45 dagar'; // Mock
  }
  
  userFilter.addEventListener('change', renderBoard);
  renderBoard();
}

function renderCustomerSuccess() {
  const root = document.getElementById('view-customer-success');
  renderTemplate('tpl-customer-success', root);
  
  console.log('renderCustomerSuccess called'); // Debug
  
  // Customer Success segments based on MRR
  const segments = [
    { id: 'enterprise', name: 'Enterprise', min: 10000, max: Infinity, color: 'bg-purple-100', icon: 'ðŸ‘‘', priority: 1 },
    { id: 'growth', name: 'Growth', min: 5000, max: 9999, color: 'bg-blue-100', icon: 'ðŸ“ˆ', priority: 2 },
    { id: 'standard', name: 'Standard', min: 1000, max: 4999, color: 'bg-green-100', icon: 'âœ“', priority: 3 },
    { id: 'starter', name: 'Starter', min: 1, max: 999, color: 'bg-yellow-100', icon: 'ðŸŒ±', priority: 4 },
    { id: 'at_risk', name: 'Churn Risk', min: 0, max: 0, color: 'bg-red-100', icon: 'âš ï¸', priority: 5 }
  ];
  
  // User filter
  const userFilter = document.getElementById('csUserFilter');
  userFilter.innerHTML = '<option value="all">Alla CSM:er</option>' + 
    AppState.users.map(u => `<option value="${u.id}">${u.namn}</option>`).join('');
  
  // Segment filter
  const segmentFilter = document.getElementById('csSegmentFilter');
  
  // Stats toggle
  const statsToggle = document.getElementById('csStatsToggle');
  const statsPanel = document.getElementById('csStats');
  statsToggle.addEventListener('click', () => {
    statsPanel.classList.toggle('hidden');
  });
  
  function renderCSBoard() {
    const userId = userFilter.value;
    const selectedSegment = segmentFilter.value;
    const activeSegmentId = AppState.activeSegmentId;
    const board = document.getElementById('csBoard');
    
    // Get all customers (companies with status 'kund' OR payment > 0)
    let customers = AppState.companies.filter(c => {
      if (userId !== 'all' && c.ansvarigSÃ¤ljareId !== userId) return false;
      if (activeSegmentId && c.segmentId !== activeSegmentId) return false;
      const hasMRR = Number(c.payment) > 0;
      const isCustomer = c.status === 'kund';
      return isCustomer || hasMRR;
    });
    
    // Calculate statistics
    const totalMRR = customers.reduce((sum, c) => sum + (Number(c.payment) || 0), 0);
    const avgMRR = customers.length > 0 ? totalMRR / customers.length : 0;
    
    // Churn risk: customers without payment or with very low activity
    const churnRisk = customers.filter(c => {
      const mrr = Number(c.payment) || 0;
      return mrr === 0 || c.status !== 'kund';
    }).length;
    
    // Upsell potential: customers with low MRR but many agents
    const upsellPotential = customers.filter(c => {
      const mrr = Number(c.payment) || 0;
      const agents = AppState.agents.filter(a => a.companyId === c.id);
      const activeAgents = agents.filter(a => a.licens?.status === 'aktiv').length;
      const potentialAgents = agents.length - activeAgents;
      return mrr > 0 && mrr < 5000 && potentialAgents > 2;
    }).length;
    
    // Health score (mock calculation)
    const healthyCustomers = customers.filter(c => Number(c.payment) > 0).length;
    const healthScore = customers.length > 0 ? Math.round((healthyCustomers / customers.length) * 100) : 0;
    
    // Update stats
    document.getElementById('csTotalMRR').textContent = formatSek(totalMRR);
    document.getElementById('csTotalCustomers').textContent = `${customers.length} kunder`;
    document.getElementById('csAvgMRR').textContent = formatSek(avgMRR);
    document.getElementById('csChurnRisk').textContent = churnRisk;
    document.getElementById('csUpsellPotential').textContent = upsellPotential;
    document.getElementById('csHealthScore').textContent = `${healthScore}%`;
    
    board.innerHTML = '';
    
    // Filter segments based on selection
    const displaySegments = selectedSegment === 'all' 
      ? segments 
      : segments.filter(s => s.id === selectedSegment);
    
    displaySegments.forEach(segment => {
      let segmentCustomers = [];
      
      if (segment.id === 'at_risk') {
        // At risk: customers without payment or status not 'kund'
        segmentCustomers = customers.filter(c => {
          const mrr = Number(c.payment) || 0;
          return mrr === 0 || c.status !== 'kund';
        });
      } else {
        // Normal segments based on MRR
        segmentCustomers = customers.filter(c => {
          const mrr = Number(c.payment) || 0;
          return mrr >= segment.min && mrr <= segment.max;
        });
      }
      
      // Sort by MRR descending (highest first)
      segmentCustomers.sort((a, b) => (Number(b.payment) || 0) - (Number(a.payment) || 0));
      
      const column = document.createElement('div');
      column.className = 'flex-shrink-0 w-80';
      column.innerHTML = `
        <div class="card ${segment.color} shadow-lg">
          <div class="card-body p-3">
            <div class="flex justify-between items-center mb-3">
              <h3 class="font-bold text-lg flex items-center gap-2">
                <span>${segment.icon}</span>
                <span>${segment.name}</span>
              </h3>
              <div class="badge badge-lg">${segmentCustomers.length}</div>
            </div>
            ${segment.min > 0 && segment.max !== Infinity ? `<p class="text-xs text-base-content/70 mb-2">${formatSek(segment.min)} - ${formatSek(segment.max)}</p>` : ''}
            ${segment.max === Infinity && segment.min > 0 ? `<p class="text-xs text-base-content/70 mb-2">Ã–ver ${formatSek(segment.min)}/mÃ¥n</p>` : ''}
            ${segment.id === 'at_risk' ? `<p class="text-xs text-base-content/70 mb-2">KrÃ¤ver omedelbar Ã¥tgÃ¤rd</p>` : ''}
          </div>
        </div>
        <div class="space-y-3 mt-3 cs-drop-zone" data-segment="${segment.id}">
          ${segmentCustomers.map(c => createCustomerCard(c, segment)).join('')}
        </div>
      `;
      
      board.appendChild(column);
    });
    
    // Enable interactions
    enableCustomerCardInteractions();
  }
  
  function createCustomerCard(company, segment) {
    const brand = AppState.brands.find(b => b.id === company.brandId);
    const agents = AppState.agents.filter(a => a.companyId === company.id);
    const activeAgents = agents.filter(a => a.licens?.status === 'aktiv').length;
    const owner = AppState.users.find(u => u.id === company.ansvarigSÃ¤ljareId);
    const mrr = Number(company.payment) || 0;
    
    // AnvÃ¤nd automatisk potentialberÃ¤kning
    const potentialCalc = calculateCompanyPotential(company);
    
    // Calculate upsell potential
    const potentialAgents = agents.length - activeAgents;
    const hasUpsellPotential = potentialCalc.upsellMRR > 0;
    
    // Calculate health indicators
    const hasActiveContract = mrr > 0;
    const isChurnRisk = !hasActiveContract || company.status !== 'kund';
    
    return `
      <div class="card bg-base-100 shadow hover:shadow-xl transition-shadow cursor-pointer customer-card" 
           data-company-id="${company.id}">
        <div class="card-body p-4">
          <div class="flex justify-between items-start mb-2">
            <h4 class="font-semibold text-sm">${company.namn}</h4>
            ${isChurnRisk ? '<span class="badge badge-error badge-sm">Risk</span>' : ''}
            ${hasUpsellPotential ? '<span class="badge badge-success badge-sm">+' + formatSek(potentialCalc.upsellMRR) + '</span>' : ''}
          </div>
          
          <div class="text-xs text-base-content/70 space-y-1">
            ${brand ? `<div>ðŸ¢ ${brand.namn}</div>` : ''}
            ${company.stad ? `<div>ðŸ“ ${company.stad}</div>` : ''}
            <div>ðŸ‘¥ ${agents.length} mÃ¤klare (${activeAgents} med licens)</div>
            ${potentialAgents > 0 ? `<div class="text-success">ðŸ’¡ ${potentialAgents} utan licens â†’ Max ${formatSek(potentialCalc.maxMRR)}/mÃ¥n</div>` : ''}
            <div class="font-bold text-lg ${mrr > 0 ? 'text-success' : 'text-error'}">
              ðŸ’° ${formatSek(mrr)}/mÃ¥n
            </div>
            ${potentialCalc.tier && agents.length >= 4 ? `<div class="text-xs text-base-content/60">ðŸ“Š ${potentialCalc.tier}</div>` : ''}
            ${owner ? `<div>ðŸ‘¤ CSM: ${owner.namn}</div>` : ''}
            ${company.product ? `<div>ðŸ“¦ ${company.product}</div>` : ''}
          </div>
          
          <div class="card-actions justify-end mt-3">
            <button class="btn btn-primary btn-xs customer-open-btn" data-company-id="${company.id}">
              Ã–ppna â†’
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  function enableCustomerCardInteractions() {
    // Open customer buttons
    document.querySelectorAll('.customer-open-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const companyId = btn.dataset.companyId;
        if (companyId) openCompany(companyId);
      });
    });
    
    // Click on card to open
    document.querySelectorAll('.customer-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; // Don't trigger if clicking button
        const companyId = card.dataset.companyId;
        if (companyId) openCompany(companyId);
      });
    });
  }
  
  userFilter.addEventListener('change', renderCSBoard);
  segmentFilter.addEventListener('change', renderCSBoard);
  renderCSBoard();
}

function renderLicenses() {
  const root = document.getElementById('view-licenses');
  renderTemplate('tpl-licenses', root);
  const table = document.getElementById('licenseTable');

  const statusSel = document.getElementById('licenseStatusFilter');
  const pageSizeSel = document.getElementById('licensePageSize');
  const pageInfo = document.getElementById('licensePageInfo');
  const prevBtn = document.getElementById('licensePrev');
  const nextBtn = document.getElementById('licenseNext');
  let page = 1;
  let sortKey = 'name';
  let sortAsc = true;

  function draw() {
    const filter = statusSel.value;
    const rowsAll = AppState.agents.filter(a => filter==='all' || (a.licens?.status||'ingen')===filter);
    const size = Number(pageSizeSel.value)||25;
    const total = rowsAll.length;
    const maxPage = Math.max(1, Math.ceil(total/size));
    if (page>maxPage) page=maxPage;
    const start = (page-1)*size;
    const licRank = { ingen:0, test:1, aktiv:2 };
    const sorter = (a,b) => {
      const nameA = `${a.fÃ¶rnamn} ${a.efternamn}`.trim();
      const nameB = `${b.fÃ¶rnamn} ${b.efternamn}`.trim();
      const compA = companyName(a.companyId), compB = companyName(b.companyId);
      const emailA = String(a.email||''); const emailB = String(b.email||'');
      const licA = (a.licens?.status)||'ingen'; const licB = (b.licens?.status)||'ingen';
      const prodA = String(a.licens?.typ||''); const prodB = String(b.licens?.typ||'');
      const map = {
        name: () => nameA.localeCompare(nameB,'sv'),
        company: () => compA.localeCompare(compB,'sv'),
        contact: () => emailA.localeCompare(emailB,'sv'),
        license: () => (licRank[licA] - licRank[licB]),
        product: () => prodA.localeCompare(prodB,'sv')
      };
      const cmp = (map[sortKey]||map.name)();
      return sortAsc ? cmp : -cmp;
    };
    const rows = [...rowsAll].sort(sorter).slice(start, start+size);
    table.innerHTML = `
      <div class="row header"><div data-sort="name">MÃ¤klare</div><div data-sort="company">FÃ¶retag (betalare)</div><div data-sort="contact">Kontakt</div><div data-sort="license">Licens (personlig)</div><div data-sort="product">Produkt</div><div></div></div>
      ${rows.map(a => `<div class="row">
        <div>${a.fÃ¶rnamn} ${a.efternamn}</div>
        <div>${companyName(a.companyId)}</div>
        <div>${a.email||''}<br/>${a.telefon||''}</div>
        <div>${tagStatus(a.licens?.status||'ingen')}</div>
        <div>${a.licens?.typ||''}</div>
        <div class="actions"><button class="secondary" data-open="${a.id}">Ã–ppna</button></div>
      </div>`).join('')}
    `;
    pageInfo.textContent = total ? `Sida ${page} av ${maxPage} Â· ${total} mÃ¤klare` : 'Inga poster';
    prevBtn.disabled = (page<=1); nextBtn.disabled = (page>=maxPage);
  }
  draw();
  statusSel.addEventListener('change', () => { page=1; draw(); });
  pageSizeSel.addEventListener('change', () => { page=1; draw(); });
  prevBtn.addEventListener('click', () => { if (page>1) { page--; draw(); } });
  nextBtn.addEventListener('click', () => { page++; draw(); });
}

// --- Import ---
function renderImport() {
  const root = document.getElementById('view-import');
  renderTemplate('tpl-import', root);
  const fileInput = document.getElementById('fileInput');
  const mappingArea = document.getElementById('mappingArea');
  const applyBtn = document.getElementById('applyImport');
  const applyServerBtn = document.getElementById('applyImportServer');
  const applyOrtsprisBtn = document.getElementById('applyImportOrtspris');
  const applyMaklarpaketBtn = document.getElementById('applyImportMaklarpaket');
  const importResult = document.getElementById('importResult');

  let parsed = [];
  let mapping = null;

  fileInput.addEventListener('change', async (e) => {
    importResult.textContent = '';
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    parsed = json;
    const cols = Object.keys(json[0]||{});

    const fields = [
      { key:'brand', label:'VarumÃ¤rke (kedja)' },
      { key:'company', label:'FÃ¶retag' },
      { key:'orgNumber', label:'Orgnummer' },
      { key:'customerNumber', label:'Kundnummer' },
      { key:'fullName', label:'MÃ¤klare Namn (fullstÃ¤ndigt)' },
      { key:'first', label:'FÃ¶rnamn' },
      { key:'last', label:'Efternamn' },
      { key:'email', label:'E-post' },
      { key:'phone', label:'Telefon' },
      { key:'city', label:'Ort/Stad' },
      { key:'status', label:'Status (kund/prospekt/ej)' },
      { key:'license', label:'Licensstatus (aktiv/test/ingen)' },
      { key:'licenseType', label:'Licenstyp (Produkter)' },
      { key:'payment', label:'MRR / mÃ¥nadsbelopp (SEK)' },
      { key:'registrationType', label:'Registreringstyp' },
      { key:'companyAddress', label:'FÃ¶retag adress' },
      { key:'companyPostalCode', label:'FÃ¶retag postnummer' },
      { key:'companyPostCity', label:'FÃ¶retag postort' },
      { key:'agentOffice', label:'Kontor dÃ¤r mÃ¤klaren Ã¤r verksam' },
      { key:'maklarpaketUserId', label:'MÃ¤klarpaket AnvÃ¤ndarID' },
      { key:'maklarpaketMsName', label:'MÃ¤klarpaket MS Namn' },
      { key:'maklarpaketUid', label:'MÃ¤klarpaket UID' },
      { key:'maklarpaketEmail', label:'MÃ¤klarpaket E-post' },
      { key:'maklarpaketActive', label:'MÃ¤klarpaket Aktiv' },
      { key:'maklarpaketCustomerNumber', label:'MÃ¤klarpaket Kundnummer' },
      { key:'maklarpaketOffice', label:'MÃ¤klarpaket Kontor' },
      { key:'maklarpaketBrand', label:'MÃ¤klarpaket Kedja' },
      { key:'maklarpaketProductName', label:'MÃ¤klarpaket Produktnamn' },
      { key:'maklarpaketTotalCost', label:'MÃ¤klarpaket Totalkostnad' },
      { key:'maklarpaketDiscount', label:'MÃ¤klarpaket Rabatt' },
      { key:'otherProductsUserId', label:'Ã–vriga produkter AnvÃ¤ndarID' },
      { key:'otherProductsUid', label:'Ã–vriga produkter UID' },
      { key:'otherProductsEmail', label:'Ã–vriga produkter E-post' },
      { key:'otherProductsCustomerNumber', label:'Ã–vriga produkter Kundnummer' },
      { key:'products', label:'Produkter (lista)' },
      { key:'matchType', label:'Matchtyp' },
    ];

    // FÃ¶rsÃ¶k mappa svenska kolumnnamn och variationer
    const synonyms = {
      brand: ['varumÃ¤rke','varumarke','brand','franchise','kedja','mÃ¤rke','marke','kedja- varumÃ¤rke','kedja-varumÃ¤rke','kedja varumÃ¤rke'],
      company: ['fÃ¶retag','foretag','byrÃ¥','byra','kontor','office','company','agentur','mÃ¤klarfÃ¶retag','maklarforetag'],
      orgNumber: ['organisationsnummer','organisationsnr','orgnummer','org nr','org-nr','orgnr','org.nr','org-nr.','org'],
      customerNumber: ['kundnummer','kundnr','kund-nr','kund nr','kund id','kund-id','kundid','kundnummer (kund)','kundnummer (8)'],
      fullName: ['mÃ¤klare namn','maklare namn','namn','fullstÃ¤ndigt namn','fullstandigt namn'],
      first: ['fÃ¶rnamn','fornamn','first','given'],
      last: ['efternamn','last','surname','family'],
      email: ['e-post','epost','email','mail','mejl'],
      phone: ['telefon','tel','mobil','phone','cell'],
      city: ['stad','ort','city','kommun','location'],
      status: ['status','kundstatus','kategori'],
      license: ['licens','licensstatus','license','abo','abonnemang'],
      licenseType: ['produkt','produkter','licenstyp','license type'],
      payment: ['mrr','mÃ¥nadspris','manadspris','mÃ¥nadsavgift','manadsavgift','pris','avgift','belopp'],
      registrationType: ['registreringstyp','registrering','registrering typ','registreringstyp (mÃ¤klare)','registreringstyp (maklare)'],
      companyAddress: ['adress','address','street','gata','fÃ¶retag - adress','foretag - adress','kontor adress','fÃ¶retag adress'],
      companyPostalCode: ['postnummer','post nr','post-nr','zip','zipcode','postkod','fÃ¶retag - postnummer','foretag - postnummer'],
      companyPostCity: ['postort','post ort','poststad','post stad','postort (stad)','fÃ¶retag - postort','foretag - postort'],
      agentOffice: ['kontor','kontor dÃ¤r mÃ¤klaren Ã¤r verksam','kontor maklare','office','arbetsstÃ¤lle','arbetsstalle','arbetsplats'],
      maklarpaketUserId: ['mÃ¤klarpaket.anvÃ¤ndarid','maklarpaket anvandarid','mÃ¤klarpaket anvÃ¤ndar id','maklarpaket user id'],
      maklarpaketMsName: ['mÃ¤klarpaket.msnamn','maklarpaket ms namn','mÃ¤klarpaket namn','msnamn'],
      maklarpaketUid: ['mÃ¤klarpaket.uid','maklarpaket uid'],
      maklarpaketEmail: ['mÃ¤klarpaket.epost','maklarpaket epost','mÃ¤klarpaket email','maklarpaket e-mail'],
      maklarpaketActive: ['mÃ¤klarpaket.aktiv','maklarpaket aktiv'],
      maklarpaketCustomerNumber: ['mÃ¤klarpaket.kundnr','mÃ¤klarpaket kundnr','mÃ¤klarpaket kundnummer'],
      maklarpaketOffice: ['mÃ¤klarpaket.kontor','mÃ¤klarpaket kontor'],
      maklarpaketBrand: ['mÃ¤klarpaket.kedja','mÃ¤klarpaket kedja','mÃ¤klarpaket varumÃ¤rke'],
      maklarpaketProductName: ['mÃ¤klarpaket.produktnamn','mÃ¤klarpaket produktnamn'],
      maklarpaketTotalCost: ['mÃ¤klarpaket.totalkostnad','mÃ¤klarpaket totalkostnad','mÃ¤klarpaket total kostnad'],
      maklarpaketDiscount: ['mÃ¤klarpaket.rabatt','mÃ¤klarpaket rabatt'],
      otherProductsUserId: ['Ã¶vriga mÃ¤klarprodukter.anvÃ¤ndarid','ovriga maklarprodukter anvandarid','Ã¶vriga produkter anvÃ¤ndarid'],
      otherProductsUid: ['Ã¶vriga mÃ¤klarprodukter.uid','ovriga maklarprodukter uid'],
      otherProductsEmail: ['Ã¶vriga mÃ¤klarprodukter.epost','ovriga maklarprodukter epost','Ã¶vriga produkter epost'],
      otherProductsCustomerNumber: ['Ã¶vriga mÃ¤klarprodukter.kundnr','ovriga maklarprodukter kundnr','Ã¶vriga produkter kundnummer'],
      products: ['produkter','produktlista','produkt lista','produktlist'],
      matchType: ['matchtyp','match typ','matchningstyp']
    };
    const lcCols = cols.map(c => ({ raw:c, lc:c.toLowerCase() }));
    const guess = (key) => {
      const syns = synonyms[key] || [key];
      for (const s of syns) {
        const hit = lcCols.find(col => col.lc.includes(s));
        if (hit) return hit.raw;
      }
      return '';
    };

    mapping = Object.fromEntries(fields.map(f => [f.key, guess(f.key)]));

    mappingArea.innerHTML = `
      <div class="grid-2">
        ${fields.map(f => `
          <div class="field">
            <label>${f.label}</label>
            <select data-map="${f.key}">
              <option value="">â€”</option>
              ${cols.map(c => `<option value="${c}" ${mapping[f.key]===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
        `).join('')}
      </div>
      <div class="muted" style="margin-top:8px;">VÃ¤lj rÃ¤tt kolumner. Minst FÃ¶retag och (MÃ¤klare Namn eller FÃ¶rnamn/Efternamn) krÃ¤vs.</div>
    `;

    mappingArea.addEventListener('change', (e) => {
      const sel = e.target.closest('select'); if (!sel) return;
      mapping[sel.dataset.map] = sel.value;
      validate();
    });

    validate();
  });

  function validate() {
    const ok = mapping && mapping.company && ((mapping.first || mapping.last) || mapping.fullName);
    applyBtn.disabled = !ok;
  }

  applyBtn.addEventListener('click', () => {
    const parseMoney = (v) => {
      const s = String(v||'').trim(); if (!s) return 0;
      let t = s.replace(/[^0-9,\.\-]/g,'');
      const hasC = t.includes(','); const hasD = t.includes('.');
      if (hasC && hasD) { t = t.replace(/\./g,'').replace(/,/g,'.'); }
      else if (hasC && !hasD) { t = t.replace(/,/g,'.'); }
      const n = parseFloat(t); return Number.isFinite(n) ? n : 0;
    };
    const parseBooleanish = (v) => {
      const s = String(v ?? '').trim().toLowerCase();
      if (!s) return null;
      if (['ja','yes','y','true','1','pÃ¥','on','aktiv'].includes(s)) return true;
      if (['nej','no','n','false','0','av','off','inaktiv'].includes(s)) return false;
      return null;
    };
    let addedAgents = 0, updatedAgents = 0, addedCompanies = 0, addedBrands = 0;
    const brandCache = new Map(AppState.brands.map(b => [b.namn.toLowerCase(), b.id]));
    const compKey = (name, brandId) => `${name.toLowerCase()}|${brandId}`;
    const companyCache = new Map(AppState.companies.map(c => [compKey(c.namn, c.brandId), c.id]));

    for (const row of parsed) {
      const brandNameVal = mapping.brand ? String(row[mapping.brand] ?? '').trim() : '';
      const companyNameVal = mapping.company ? String(row[mapping.company] ?? '').trim() : '';
      const orgRaw = mapping.orgNumber ? String(row[mapping.orgNumber] ?? '').trim() : '';
      const orgDigits = orgRaw.replace(/[^0-9]/g,'');
      const custRaw = mapping.customerNumber ? String(row[mapping.customerNumber] ?? '').trim() : '';
      const custDigits = custRaw.replace(/[^0-9]/g,'');
      let first = mapping.first ? String(row[mapping.first] ?? '').trim() : '';
      let last = mapping.last ? String(row[mapping.last] ?? '').trim() : '';
      const fullName = mapping.fullName ? String(row[mapping.fullName] ?? '').trim() : '';
      const email = mapping.email ? String(row[mapping.email] ?? '').trim().toLowerCase() : '';
      const phone = mapping.phone ? String(row[mapping.phone] ?? '').trim() : '';
      const city = mapping.city ? String(row[mapping.city] ?? '').trim() : '';
      const status = normStatus(mapping.status ? String(row[mapping.status] ?? '').trim().toLowerCase() : 'prospekt');
      const licenseTypeVal = mapping.licenseType ? String(row[mapping.licenseType] ?? '').trim() : '';
      let lic = normLicense(mapping.license ? String(row[mapping.license] ?? '').trim().toLowerCase() : (licenseTypeVal ? 'aktiv' : 'ingen'));
      const paymentVal = mapping.payment ? parseMoney(row[mapping.payment]) : 0;
      const registrationTypeVal = mapping.registrationType ? String(row[mapping.registrationType] ?? '').trim() : '';
      const companyAddressVal = mapping.companyAddress ? String(row[mapping.companyAddress] ?? '').trim() : '';
      const companyPostalCodeVal = mapping.companyPostalCode ? String(row[mapping.companyPostalCode] ?? '').trim() : '';
      const companyPostCityVal = mapping.companyPostCity ? String(row[mapping.companyPostCity] ?? '').trim() : '';
      const agentOfficeVal = mapping.agentOffice ? String(row[mapping.agentOffice] ?? '').trim() : '';
      const maklarpaketUserIdVal = mapping.maklarpaketUserId ? String(row[mapping.maklarpaketUserId] ?? '').trim() : '';
      const maklarpaketMsNameVal = mapping.maklarpaketMsName ? String(row[mapping.maklarpaketMsName] ?? '').trim() : '';
      const maklarpaketUidVal = mapping.maklarpaketUid ? String(row[mapping.maklarpaketUid] ?? '').trim() : '';
      const maklarpaketEmailVal = mapping.maklarpaketEmail ? String(row[mapping.maklarpaketEmail] ?? '').trim() : '';
      const maklarpaketActiveVal = mapping.maklarpaketActive ? parseBooleanish(row[mapping.maklarpaketActive]) : null;
      const maklarpaketCustomerNumberVal = mapping.maklarpaketCustomerNumber ? String(row[mapping.maklarpaketCustomerNumber] ?? '').trim() : '';
      const maklarpaketOfficeVal = mapping.maklarpaketOffice ? String(row[mapping.maklarpaketOffice] ?? '').trim() : '';
      const maklarpaketBrandVal = mapping.maklarpaketBrand ? String(row[mapping.maklarpaketBrand] ?? '').trim() : '';
      const maklarpaketProductNameVal = mapping.maklarpaketProductName ? String(row[mapping.maklarpaketProductName] ?? '').trim() : '';
      const maklarpaketTotalCostRaw = mapping.maklarpaketTotalCost ? String(row[mapping.maklarpaketTotalCost] ?? '').trim() : '';
      const maklarpaketDiscountRaw = mapping.maklarpaketDiscount ? String(row[mapping.maklarpaketDiscount] ?? '').trim() : '';
      const maklarpaketTotalCostVal = maklarpaketTotalCostRaw ? parseMoney(maklarpaketTotalCostRaw) : 0;
      const maklarpaketDiscountVal = maklarpaketDiscountRaw ? parseMoney(maklarpaketDiscountRaw) : 0;
      const otherProductsUserIdVal = mapping.otherProductsUserId ? String(row[mapping.otherProductsUserId] ?? '').trim() : '';
      const otherProductsUidVal = mapping.otherProductsUid ? String(row[mapping.otherProductsUid] ?? '').trim() : '';
      const otherProductsEmailVal = mapping.otherProductsEmail ? String(row[mapping.otherProductsEmail] ?? '').trim() : '';
      const otherProductsCustomerNumberVal = mapping.otherProductsCustomerNumber ? String(row[mapping.otherProductsCustomerNumber] ?? '').trim() : '';
      const productsVal = mapping.products ? String(row[mapping.products] ?? '').trim() : '';
      const matchTypeVal = mapping.matchType ? String(row[mapping.matchType] ?? '').trim() : '';
      const maklarpaketData = {};
      if (maklarpaketUserIdVal) maklarpaketData.userId = maklarpaketUserIdVal;
      if (maklarpaketMsNameVal) maklarpaketData.msName = maklarpaketMsNameVal;
      if (maklarpaketUidVal) maklarpaketData.uid = maklarpaketUidVal;
      if (maklarpaketEmailVal) maklarpaketData.email = maklarpaketEmailVal;
      if (maklarpaketActiveVal !== null) maklarpaketData.active = maklarpaketActiveVal;
      if (maklarpaketCustomerNumberVal) maklarpaketData.customerNumber = maklarpaketCustomerNumberVal;
      if (maklarpaketOfficeVal) maklarpaketData.office = maklarpaketOfficeVal;
      if (maklarpaketBrandVal) maklarpaketData.brand = maklarpaketBrandVal;
      if (maklarpaketProductNameVal) maklarpaketData.productName = maklarpaketProductNameVal;
      if (maklarpaketTotalCostRaw) maklarpaketData.totalCost = maklarpaketTotalCostVal;
      if (maklarpaketDiscountRaw) maklarpaketData.discount = maklarpaketDiscountVal;
      const hasMaklarpaketData = Object.keys(maklarpaketData).length > 0;
      const otherProductsData = {};
      if (otherProductsUserIdVal) otherProductsData.userId = otherProductsUserIdVal;
      if (otherProductsUidVal) otherProductsData.uid = otherProductsUidVal;
      if (otherProductsEmailVal) otherProductsData.email = otherProductsEmailVal;
      if (otherProductsCustomerNumberVal) otherProductsData.customerNumber = otherProductsCustomerNumberVal;
      const hasOtherProductsData = Object.keys(otherProductsData).length > 0;

      if (!last && !first && fullName) {
        const parts = fullName.split(/\s+/).filter(Boolean);
        if (parts.length>1) { last = parts.pop(); first = parts.join(' '); }
        else { first = fullName; }
      }

      let brandId = '';
      if (brandNameVal) {
        brandId = brandCache.get(brandNameVal.toLowerCase());
        if (!brandId) {
          const nb = { id: id(), namn: brandNameVal };
          AppState.brands.push(nb); brandCache.set(brandNameVal.toLowerCase(), nb.id); addedBrands++;
        }
        brandId = brandCache.get(brandNameVal.toLowerCase());
      }

      if (!companyNameVal) continue;
      if (!brandId && AppState.brands.length) brandId = AppState.brands[0].id; // fallback

      // Try find by orgNumber first
      let compId = '';
      if (orgDigits) {
        const byOrg = AppState.companies.find(c => String(c.orgNumber||'').replace(/[^0-9]/g,'') === orgDigits);
        if (byOrg) compId = byOrg.id;
      }
      if (!compId) compId = companyCache.get(compKey(companyNameVal, brandId));
      if (!compId) {
        const nc = { id: id(), namn: companyNameVal, brandId, stad: city, status };
        if (paymentVal) nc.payment = paymentVal;
        if (orgDigits) nc.orgNumber = orgDigits;
        if (custDigits) nc.customerNumber = custDigits;
        if (companyAddressVal) nc.address = companyAddressVal;
        if (companyPostalCodeVal) nc.postalCode = companyPostalCodeVal;
        if (companyPostCityVal) nc.postCity = companyPostCityVal;
        enforceCompanyStatusFromPayment(nc);
        AppState.companies.push(nc);
        compId = nc.id; companyCache.set(compKey(companyNameVal, brandId), compId); addedCompanies++;
      } else {
        const existing = AppState.companies.find(c => c.id===compId);
        if (existing) {
          if (city) existing.stad = city;
          if (paymentVal) existing.payment = paymentVal;
          if (orgDigits && !existing.orgNumber) existing.orgNumber = orgDigits;
          if (custDigits && !existing.customerNumber) existing.customerNumber = custDigits;
          if (companyAddressVal) existing.address = companyAddressVal;
          if (companyPostalCodeVal) existing.postalCode = companyPostalCodeVal;
          if (companyPostCityVal) existing.postCity = companyPostCityVal;
          enforceCompanyStatusFromPayment(existing);
        }
      }

      if (!first && !last) continue;

      let agent = null;
      if (email) agent = AppState.agents.find(a => (a.email||'').toLowerCase() === email);
      if (!agent) agent = AppState.agents.find(a => a.fÃ¶rnamn.toLowerCase()===first.toLowerCase() && a.efternamn.toLowerCase()===last.toLowerCase() && a.companyId===compId);

      if (agent) {
        // update
        agent.telefon = phone || agent.telefon;
        agent.status = status || agent.status;
        agent.licens = { status: lic, typ: licenseTypeVal };
        if (email) agent.email = email;
        if (registrationTypeVal) agent.registrationType = registrationTypeVal;
        if (agentOfficeVal) agent.officeName = agentOfficeVal;
        if (productsVal) agent.productsImported = productsVal;
        if (matchTypeVal) agent.matchType = matchTypeVal;
        if (hasMaklarpaketData) agent.maklarpaket = { ...(agent.maklarpaket||{}), ...maklarpaketData };
        if (hasOtherProductsData) agent.otherProducts = { ...(agent.otherProducts||{}), ...otherProductsData };
        updatedAgents++;
      } else {
        const newAgent = { id: id(), fÃ¶rnamn: first||'-', efternamn: last||'-', email, telefon: phone, companyId: compId, status, licens: { status: lic, typ: licenseTypeVal } };
        if (registrationTypeVal) newAgent.registrationType = registrationTypeVal;
        if (agentOfficeVal) newAgent.officeName = agentOfficeVal;
        if (productsVal) newAgent.productsImported = productsVal;
        if (matchTypeVal) newAgent.matchType = matchTypeVal;
        if (hasMaklarpaketData) newAgent.maklarpaket = maklarpaketData;
        if (hasOtherProductsData) newAgent.otherProducts = otherProductsData;
        AppState.agents.push(newAgent);
        addedAgents++;
      }
    }

    saveState();
    importResult.textContent = `Klart: +${addedBrands} varumÃ¤rken, +${addedCompanies} fÃ¶retag, +${addedAgents}/${updatedAgents} mÃ¤klare (nya/uppdaterade).`;
    renderDashboard();
  });

  // Server import (default root file)
  applyServerBtn.addEventListener('click', async () => {
    importResult.textContent = 'Importerar pÃ¥ servern...';
    try {
      // If user selected a file, upload to server; else, trigger default-file import
      const f = fileInput.files?.[0];
      let resp;
      if (f) {
        const fd = new FormData(); fd.append('file', f);
        resp = await fetch(`${API_BASE}/api/import/excel`, { method:'POST', credentials:'include', body: fd });
      } else {
        resp = await fetch(`${API_BASE}/api/import/excel`, { method:'POST', credentials:'include' });
      }
      if (!resp.ok) {
        if (resp.status===401) { const ok = await promptServerLogin(); if (ok) return applyServerBtn.click(); }
        let msg = '';
        try { const err = await resp.json(); msg = err?.error || ''; } catch {}
        if (resp.status === 404) {
          importResult.textContent = 'Fel vid serverimport: 404. Kontrollera att servern kÃ¶r den senaste versionen och starta om den.';
        } else {
          importResult.textContent = 'Fel vid serverimport: ' + (msg || resp.status);
        }
        return;
      }
      const summary = await resp.json();
      importResult.textContent = `Serverimport klar: +${summary.addedBrands} varumÃ¤rken, +${summary.addedCompanies} fÃ¶retag, +${summary.addedAgents}/${summary.updatedAgents} mÃ¤klare (nya/uppdaterade).`;
      // Ladda om state frÃ¥n server fÃ¶r att se resultat
      await loadState();
      renderDashboard();
    } catch (e) {
      importResult.textContent = 'Kunde inte nÃ¥ servern fÃ¶r import.';
    }
  });

  // Server Ortpris import (payments/products only)
  applyOrtsprisBtn?.addEventListener('click', async () => {
    importResult.textContent = 'Importerar Ortpris pÃ¥ servern...';
    try {
      const resp = await fetch(`${API_BASE}/api/import/ortspris`, { method:'POST', credentials:'include' });
      if (!resp.ok) {
        if (resp.status===401) { const ok = await promptServerLogin(); if (ok) return applyOrtsprisBtn.click(); }
        let msg=''; try { const err=await resp.json(); msg = err?.error||''; } catch {}
        importResult.textContent = 'Fel vid Ortpris-import: ' + (msg || resp.status);
        return;
      }
      const summary = await resp.json();
      importResult.textContent = `Ortpris klar: +${summary.addedBrands||0} varumÃ¤rken, +${summary.addedCompanies||0} fÃ¶retag, uppdaterade: ${summary.updatedCompanies||0}.`;
      await loadState();
      renderDashboard();
      // Optional: jump to brands to see MRR
    } catch (e) {
      importResult.textContent = 'Kunde inte nÃ¥ servern fÃ¶r Ortpris-import.';
    }
  });

  // Server MÃ¤klarpaket import (agent licenses + product)
  applyMaklarpaketBtn?.addEventListener('click', async () => {
    importResult.textContent = 'Importerar AnvÃ¤ndare mÃ¤klarpaket pÃ¥ servern...';
    try {
      const resp = await fetch(`${API_BASE}/api/import/maklarpaket`, { method:'POST', credentials:'include' });
      if (!resp.ok) {
        if (resp.status===401) { const ok = await promptServerLogin(); if (ok) return applyMaklarpaketBtn.click(); }
        let msg=''; try { const err=await resp.json(); msg = err?.error||''; } catch {}
        importResult.textContent = 'Fel vid MÃ¤klarpaket-import: ' + (msg || resp.status);
        return;
      }
  const summary = await resp.json();
  importResult.textContent = `MÃ¤klarpaket klar: +${summary.addedBrands||0} varumÃ¤rken, +${summary.addedCompanies||0} fÃ¶retag, +${summary.addedAgents||0}/${summary.updatedAgents||0} mÃ¤klare.`;
      await loadState();
      renderDashboard();
    } catch (e) {
      importResult.textContent = 'Kunde inte nÃ¥ servern fÃ¶r MÃ¤klarpaket-import.';
    }
  });
}

function normStatus(s) {
  if (s.startsWith('k')) return 'kund';
  if (s.startsWith('p')) return 'prospekt';
  return 'ej';
}
function normLicense(s) {
  if (s.startsWith('a')) return 'aktiv';
  if (s.startsWith('t')) return 'test';
  return 'ingen';
}

function openNoteModal(entityType, entityId, noteId) {
  ensureLoggedIn();
  const editing = noteId ? AppState.notes.find(n => n.id===noteId) : null;
  modal.show(`
    <h3>${editing?'Ã„ndra':'Ny'} anteckning</h3>
    <div class="field"><label>Text</label><textarea id="noteText" rows="4">${editing?editing.text:''}</textarea></div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="primary" id="saveNote">Spara</button>
      <button class="secondary" onclick="modal.hide()">Avbryt</button>
    </div>
  `);
  document.getElementById('saveNote').addEventListener('click', () => {
    const text = document.getElementById('noteText').value.trim(); if (!text) return;
    if (editing) {
      editing.text = text;
    } else {
      AppState.notes.push({ id: id(), entityType: entityType||'general', entityId: entityId||null, text, authorId: AppState.currentUserId, createdAt: Date.now() });
    }
    saveState(); modal.hide();
    const et = editing?.entityType || entityType; const eid = editing?.entityId || entityId;
  if (et==='brand' && eid) openBrand(eid, { fromStack: true });
  else if (et==='company' && eid) openCompany(eid, { fromStack: true });
  else if (et==='agent' && eid) openAgent(eid, { fromStack: true });
    else renderDashboard();
  });
}

function renderSettings() {
  const root = document.getElementById('view-settings');
  renderTemplate('tpl-settings', root);
  document.getElementById('manageUsers').addEventListener('click', () => openUsersModal());
  
  // Add event listener for Manage Customers button
  const manageCustomersBtn = document.getElementById('manageCustomers');
  if (manageCustomersBtn) {
    manageCustomersBtn.addEventListener('click', openManageCustomersModal);
  }
  
  const settingsList = document.getElementById('settingsList');
  if (!settingsList) return;
  
  // Add Manage Segments button
  const segmentsItem = document.createElement('li');
  segmentsItem.innerHTML = `
    <div class="flex justify-between items-center">
      <div>
        <div class="font-semibold">MÃ¥lgruppssegment</div>
        <div class="text-sm text-base-content/70">Hantera branschsegment (MÃ¤klare, Banker, m.m.)</div>
      </div>
      <button id="manageSegments" class="btn btn-ghost btn-sm">Hantera</button>
    </div>
  `;
  settingsList.insertBefore(segmentsItem, settingsList.firstChild);
  
  document.getElementById('manageSegments').addEventListener('click', () => openManageSegmentsModal());
  
  // Add server logout button
  const logoutItem = document.createElement('li');
  logoutItem.innerHTML = `
    <div class="flex justify-between items-center">
      <div>
        <div class="font-semibold">Logga ut frÃ¥n server</div>
        <div class="text-sm text-base-content/70">Logga ut frÃ¥n server-sessionen</div>
      </div>
      <button id="serverLogout" class="btn btn-ghost btn-sm">Logga ut</button>
    </div>
  `;
  settingsList.appendChild(logoutItem);
  
  document.getElementById('serverLogout').addEventListener('click', async () => {
    try { 
      await fetch(`${API_BASE}/api/logout`, { method:'POST', credentials:'include' }); 
      alert('Utloggad frÃ¥n server'); 
    } catch {
      alert('Kunde inte logga ut frÃ¥n server');
    }
  });

  // Fetch auth config to show change password UI when allowed
  fetch(`${API_BASE}/api/auth/config`, { credentials:'include' })
    .then(r => r.ok ? r.json() : null)
    .then(cfg => {
      if (cfg?.allowPasswordChange) {
        const pwdItem = document.createElement('li');
        pwdItem.innerHTML = `
          <div class="flex justify-between items-center">
            <div>
              <div class="font-semibold">Byt server-lÃ¶senord</div>
              <div class="text-sm text-base-content/70">GÃ¤ller delat admin-lÃ¶senord (inte env-varianten)</div>
            </div>
            <button id="changeSrvPwd" class="btn btn-ghost btn-sm">Byt</button>
          </div>
        `;
        settingsList.appendChild(pwdItem);
        document.getElementById('changeSrvPwd').addEventListener('click', () => openChangeServerPassword());
      }
      
      // Audit viewer button
      const auditItem = document.createElement('li');
      auditItem.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <div class="font-semibold">Audit logg</div>
            <div class="text-sm text-base-content/70">Visa senaste hÃ¤ndelser (inloggning, Ã¤ndringar, raderingar)</div>
          </div>
          <button id="viewAudit" class="btn btn-ghost btn-sm">Visa</button>
        </div>
      `;
      settingsList.appendChild(auditItem);
      document.getElementById('viewAudit').addEventListener('click', () => openAuditViewer());

      // Enable Claude Sonnet 4 for all clients
      const claudeItem = document.createElement('li');
      claudeItem.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <div class="font-semibold">Enable Claude Sonnet 4 for all clients</div>
            <div class="text-sm text-base-content/70">Grant access to Claude Sonnet 4 AI model for all customer companies</div>
          </div>
          <button id="enableClaudeForAll" class="btn btn-ghost btn-sm">Enable</button>
        </div>
      `;
      settingsList.appendChild(claudeItem);
      document.getElementById('enableClaudeForAll').addEventListener('click', () => {
        for (const comp of AppState.companies) {
          if (comp.status === 'kund') {
            comp.claudeSonnet4Enabled = true;
          }
        }
        saveState();
        alert('Claude Sonnet 4 enabled for all clients');
      });
    }).catch(()=>{});

  // Clear all data (admin)
  const clearBtn = document.getElementById('clearAllData');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (!confirm('Ã„r du sÃ¤ker att du vill rensa ALL CRM-data?')) return;
      if (!confirm('Detta gÃ¥r INTE att Ã¥ngra. BekrÃ¤fta igen.')) return;
      try {
        const r = await fetch(`${API_BASE}/api/admin/clear`, { method:'POST', credentials:'include' });
        if (r.status===401 || r.status===403) {
          const ok = await promptServerLogin();
          if (ok) return clearBtn.click();
        }
        if (!r.ok) {
          // Fallback: fÃ¶rsÃ¶k rensa via /api/state (krÃ¤ver bara inloggning)
          let msg = '';
          try { const err = await r.json(); msg = err?.error || ''; } catch {}
          try {
            // HÃ¤mta nuvarande state
            let gs = await fetch(`${API_BASE}/api/state`, { credentials:'include' });
            if (gs.status===401) {
              const ok2 = await promptServerLogin();
              if (ok2) gs = await fetch(`${API_BASE}/api/state`, { credentials:'include' });
            }
            if (gs.ok) {
              const cur = await gs.json();
              const users = Array.isArray(cur.users) && cur.users.length ? cur.users : DEFAULT_USERS;
              const newState = {
                users,
                currentUserId: cur.currentUserId || (users[0]?.id || null),
                brands: [], companies: [], agents: [], notes: [], tasks: [], contacts: []
              };
              const ps = await fetch(`${API_BASE}/api/state`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(newState) });
              if (ps.ok) {
                Object.assign(AppState, newState);
                localStorage.setItem(LS_KEY, JSON.stringify(AppState));
                alert('All data rensad');
                renderDashboard(); renderBrands(); renderCompanies(); renderAgents();
                return;
              }
            }
          } catch {}
          alert('Misslyckades att rensa' + (msg?`: ${msg}`:''));
          return;
        }
        await loadState();
        // fallback ensure current user is valid
        if (!AppState.currentUserId && AppState.users?.length) {
          AppState.currentUserId = AppState.users[0].id;
        }
        alert('All data rensad');
        renderDashboard();
        renderBrands();
        renderCompanies();
        renderAgents();
      } catch { alert('Serverfel vid rensning'); }
    });
  }
}

function openAuditViewer() {
  modal.show(`
    <h3>Audit logg</h3>
    <div id="auditList" class="list"></div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
    </div>
  `);
  fetch(`${API_BASE}/api/audit?limit=200`, { credentials:'include' })
    .then(r => r.ok ? r.json() : [])
    .then(rows => {
      const list = document.getElementById('auditList');
      list.innerHTML = rows.reverse().map(ev => `
        <div class="list-item">
          <div>
            <div class="title">${ev.type}</div>
            <div class="subtitle">${new Date(ev.ts).toLocaleString('sv-SE')} Â· ${ev.username||ev.userId||ev.mode||''}</div>
          </div>
        </div>
      `).join('');
    }).catch(() => {
      document.getElementById('auditList').innerHTML = '<div class="muted">Kunde inte lÃ¤sa audit</div>';
    });
}

function openChangeServerPassword() {
  modal.show(`
    <h3>Byt server-lÃ¶senord</h3>
    <div class="field"><label>Nytt lÃ¶senord</label><input id="newSrvPwd" type="password" /></div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="primary" id="saveSrvPwd">Spara</button>
      <button class="secondary" onclick="modal.hide()">Avbryt</button>
    </div>
  `);
  document.getElementById('saveSrvPwd').addEventListener('click', async () => {
    const newPassword = document.getElementById('newSrvPwd').value;
    if (!newPassword || newPassword.length < 6) { alert('Minst 6 tecken'); return; }
    try {
      const r = await fetch(`${API_BASE}/api/auth/change-password`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ newPassword }) });
      if (r.ok) { alert('LÃ¶senord uppdaterat'); modal.hide(); }
      else { alert('Misslyckades att uppdatera'); }
    } catch { alert('Serverfel'); }
  });
}

function openUsersModal() {
  modal.show(`
    <h3>AnvÃ¤ndare / SÃ¤ljare</h3>
    <div class="list" id="userList">${AppState.users.map(u => `
      <div class="list-item">
        <div><div class="title">${u.namn}</div><div class="subtitle">${u.roll||''}</div></div>
          <button class="secondary" data-creds="${u.id}">Inloggning</button>
        <div class="actions">
          <button class="secondary" data-edit="${u.id}">Byt namn</button>
          <button class="danger" data-del="${u.id}">Ta bort</button>
        </div>
      </div>
    `).join('')}</div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="primary" id="addUser">Ny anvÃ¤ndare</button>
      <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
    </div>
  `);
  const list = document.getElementById('userList');
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const id = btn.dataset.edit || btn.dataset.del;
    if (btn.dataset.edit) {
      const u = AppState.users.find(x => x.id===id);
      const namn = prompt('Nytt namn', u.namn); if (!namn) return;
      u.namn = namn; saveState(); openUsersModal();
    } else if (btn.dataset.del) {
      if (!confirm('Ta bort anvÃ¤ndare?')) return;
      AppState.users = AppState.users.filter(x => x.id!==id);
    } else if (btn.dataset.creds) {
      openSetUserCredentials(id);
      if (AppState.currentUserId===id) AppState.currentUserId = AppState.users[0]?.id || null;
      saveState(); openUsersModal();
    }
  });
  document.getElementById('addUser').addEventListener('click', () => {
    const namn = prompt('AnvÃ¤ndarnamn'); if (!namn) return;
    AppState.users.push({ id: id(), namn, roll: 'sales' }); saveState(); openUsersModal();
  });
}

function openManageSegmentsModal() {
  const segments = AppState.segments || [];
  
  modal.show(`
    <h3>Hantera mÃ¥lgruppssegment</h3>
    <p class="muted" style="margin-bottom:12px;">Segment lÃ¥ter dig kategorisera kunder efter bransch med olika prismodeller.</p>
    <div class="list" id="segmentList">${segments.map(s => `
      <div class="list-item">
        <div>
          <div class="title">${s.icon} ${s.name}</div>
          <div class="subtitle">${s.description || ''} â€¢ ${s.pricingModel}</div>
        </div>
        <div class="actions">
          <button class="secondary" data-edit="${s.id}">Redigera</button>
          <button class="danger" data-del="${s.id}">Ta bort</button>
        </div>
      </div>
    `).join('')}</div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="primary" id="addSegment">Nytt segment</button>
      <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
    </div>
  `);
  
  const list = document.getElementById('segmentList');
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('button'); 
    if (!btn) return;
    const id = btn.dataset.edit || btn.dataset.del;
    
    if (btn.dataset.edit) {
      openEditSegmentModal(id);
    } else if (btn.dataset.del) {
      // Kontrollera om segment anvÃ¤nds
      const usedByBrands = AppState.brands.filter(b => b.segmentId === id).length;
      const usedByCompanies = AppState.companies.filter(c => c.segmentId === id).length;
      
      if (usedByBrands > 0 || usedByCompanies > 0) {
        alert(`Kan inte ta bort segment som anvÃ¤nds av ${usedByBrands} varumÃ¤rken och ${usedByCompanies} fÃ¶retag.`);
        return;
      }
      
      if (!confirm('Ta bort segment?')) return;
      AppState.segments = AppState.segments.filter(x => x.id !== id);
      saveState(); 
      openManageSegmentsModal();
    }
  });
  
  document.getElementById('addSegment').addEventListener('click', () => {
    openEditSegmentModal(null);
  });
}

function openEditSegmentModal(segmentId) {
  const segment = segmentId ? AppState.segments.find(s => s.id === segmentId) : null;
  const isNew = !segment;
  
  modal.show(`
    <h3>${isNew ? 'Nytt segment' : 'Redigera segment'}</h3>
    <div class="grid-2">
      <div class="field">
        <label>Namn *</label>
        <input id="segName" value="${segment?.name || ''}" placeholder="t.ex. Banker" />
      </div>
      <div class="field">
        <label>Icon (emoji)</label>
        <input id="segIcon" value="${segment?.icon || 'ðŸ“Š'}" placeholder="ðŸ¦" maxlength="2" />
      </div>
      <div class="field">
        <label>FÃ¤rg</label>
        <select id="segColor">
          <option value="blue" ${segment?.color === 'blue' ? 'selected' : ''}>BlÃ¥</option>
          <option value="green" ${segment?.color === 'green' ? 'selected' : ''}>GrÃ¶n</option>
          <option value="purple" ${segment?.color === 'purple' ? 'selected' : ''}>Lila</option>
          <option value="red" ${segment?.color === 'red' ? 'selected' : ''}>RÃ¶d</option>
          <option value="yellow" ${segment?.color === 'yellow' ? 'selected' : ''}>Gul</option>
          <option value="slate" ${segment?.color === 'slate' ? 'selected' : ''}>GrÃ¥</option>
          <option value="orange" ${segment?.color === 'orange' ? 'selected' : ''}>Orange</option>
        </select>
      </div>
      <div class="field">
        <label>Prismodell</label>
        <select id="segPricing">
          <option value="per-agent" ${segment?.pricingModel === 'per-agent' ? 'selected' : ''}>Per agent/anvÃ¤ndare</option>
          <option value="enterprise" ${segment?.pricingModel === 'enterprise' ? 'selected' : ''}>Enterprise (fast pris)</option>
          <option value="custom" ${segment?.pricingModel === 'custom' ? 'selected' : ''}>Anpassad</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label>Beskrivning</label>
      <textarea id="segDesc" rows="2" placeholder="Kort beskrivning av segmentet...">${segment?.description || ''}</textarea>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="primary" id="saveSegment">Spara</button>
      <button class="secondary" onclick="modal.hide(); openManageSegmentsModal();">Avbryt</button>
    </div>
  `);
  
  document.getElementById('saveSegment').addEventListener('click', () => {
    const name = document.getElementById('segName').value.trim();
    const icon = document.getElementById('segIcon').value.trim();
    const color = document.getElementById('segColor').value;
    const pricingModel = document.getElementById('segPricing').value;
    const description = document.getElementById('segDesc').value.trim();
    
    if (!name) {
      alert('Namn krÃ¤vs');
      return;
    }
    
    if (isNew) {
      // Skapa nytt segment
      const newSegment = {
        id: name.toLowerCase().replace(/\s+/g, '-').replace(/Ã¥/g, 'a').replace(/Ã¤/g, 'a').replace(/Ã¶/g, 'o'),
        name,
        icon: icon || 'ðŸ“Š',
        color,
        description,
        pricingModel,
        createdAt: new Date().toISOString()
      };
      
      // Kolla om ID redan finns
      if (AppState.segments.find(s => s.id === newSegment.id)) {
        alert('Ett segment med detta namn finns redan (ID-konflikt)');
        return;
      }
      
      AppState.segments.push(newSegment);
    } else {
      // Uppdatera befintligt segment
      Object.assign(segment, {
        name,
        icon: icon || segment.icon,
        color,
        description,
        pricingModel
      });
    }
    
    saveState();
    if (window.updateSegmentFilter) window.updateSegmentFilter();
    openManageSegmentsModal();
  });
}

function openSetUserCredentials(userId) {
  const u = AppState.users.find(x => x.id===userId);
  modal.show(`
    <h3>Inloggning fÃ¶r ${u?.namn||userId}</h3>
    <div class="grid-2">
      <div class="field"><label>AnvÃ¤ndarnamn</label><input id="credUsername" /></div>
      <div class="field"><label>LÃ¶senord</label><input id="credPassword" type="password" /></div>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="primary" id="saveCreds">Spara</button>
      <button class="secondary" onclick="modal.hide()">Avbryt</button>
    </div>
  `);
  document.getElementById('saveCreds').addEventListener('click', async () => {
    const username = document.getElementById('credUsername').value.trim();
    const password = document.getElementById('credPassword').value;
    if (!username || !password) { alert('Fyll i bÃ¥da'); return; }
    if (password.length < 6) { alert('Minst 6 tecken'); return; }
    try {
      const r = await fetch(`${API_BASE}/api/users/${encodeURIComponent(userId)}/credentials`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ username, password }) });
      if (r.ok) { alert('Sparat'); modal.hide(); }
      else if (r.status===409) { alert('AnvÃ¤ndarnamn upptaget'); }
      else if (r.status===403) { alert('KrÃ¤ver admin (delad inloggning)'); }
      else { alert('Misslyckades'); }
    } catch { alert('Serverfel'); }
  });
}

function openLogin() {
  modal.show(`
    <h3>Logga in</h3>
    <div class="field"><label>VÃ¤lj anvÃ¤ndare</label>
      <select id="loginUser">${AppState.users.map(u => `<option value="${u.id}">${u.namn}</option>`).join('')}</select>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="primary" id="doLogin">Logga in</button>
      <button class="secondary" onclick="modal.hide()">Avbryt</button>
    </div>
  `);
  document.getElementById('doLogin').addEventListener('click', () => {
    AppState.currentUserId = document.getElementById('loginUser').value;
    saveState(); modal.hide(); updateUserBox();
  });
}

// Input validation helpers
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validatePhone(phone) {
  const re = /^[\d\s\-\+\(\)]+$/;
  return !phone || re.test(phone);
}

// Enhanced HTML sanitization for XSS protection
function sanitizeHTML(input) {
  if (!input) return '';
  const str = String(input);
  
  // Create a temporary div to leverage browser's HTML parser
  const temp = document.createElement('div');
  temp.textContent = str; // This automatically escapes HTML entities
  return temp.innerHTML;
}

function sanitizeInput(input) {
  // Remove script tags and sanitize HTML
  const cleaned = String(input || '').trim();
  return cleaned
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, ''); // Remove inline event handlers
}

// Safe way to set text content
function setTextContent(element, text) {
  if (!element) return;
  element.textContent = String(text || '');
}

// Safe way to create text nodes
function createTextNode(text) {
  return document.createTextNode(String(text || ''));
}
function setupGlobalSearch() {
  const input = document.getElementById('globalSearch');
  const list = document.getElementById('searchSuggest');

  function hide() { if (list) { list.classList.add('hidden'); list.innerHTML = ''; } }

  function showSuggestions(q) {
    if (!list) return;
    const query = q.trim().toLowerCase();
    if (!query) { hide(); return; }

    const out = [];
    const push = (label, subtitle, onClick) => out.push({ label, subtitle, onClick });

    // Companies: match by name, customer number, or orgnummer
    const qDigits = query.replace(/[^0-9]/g,'');
    for (const c of AppState.companies) {
      const name = String(c.namn||'');
      const cn = String(c.customerNumber||'');
      const cd = cn.replace(/[^0-9]/g,'');
      const onr = String(c.orgNumber||'');
      const od = onr.replace(/[^0-9]/g,'');
      const hit = name.toLowerCase().includes(query)
        || (cn && cn.toLowerCase().includes(query)) || (qDigits && cd.includes(qDigits))
        || (onr && onr.toLowerCase().includes(query)) || (qDigits && od.includes(qDigits));
      if (hit) {
        const parts = [brandName(c.brandId)];
        if (c.customerNumber) parts.push(`Kundnr: ${c.customerNumber}`);
        if (c.orgNumber) parts.push(`Orgnr: ${formatOrg(c.orgNumber)}`);
        push(`FÃ¶retag Â· ${name}`, parts.filter(Boolean).join(' Â· '), () => openCompany(c.id));
      }
      if (out.length>=8) break;
    }

    // Agents: name, email, phone
    if (out.length < 8) {
      for (const a of AppState.agents) {
        const full = `${a.fÃ¶rnamn} ${a.efternamn}`.trim().toLowerCase();
        const email = String(a.email||'').toLowerCase();
        const phone = String(a.telefon||'').toLowerCase();
        if (full.includes(query) || (email && email.includes(query)) || (phone && phone.includes(query))) {
          push(`MÃ¤klare Â· ${a.fÃ¶rnamn} ${a.efternamn}`, companyName(a.companyId), () => openAgent(a.id));
        }
        if (out.length>=8) break;
      }
    }

    // Brands: name
    if (out.length < 8) {
      for (const b of AppState.brands) {
        const name = String(b.namn||'');
        if (name.toLowerCase().includes(query)) push(`VarumÃ¤rke Â· ${name}`, '', () => openBrand(b.id));
        if (out.length>=8) break;
      }
    }

    if (!out.length) { hide(); return; }
    list.innerHTML = out.map((r, i) => `
      <div class="ac-item" data-idx="${i}">
        <div class="label">${r.label}</div>
        ${r.subtitle?`<div class="sub">${r.subtitle}</div>`:''}
      </div>
    `).join('');
    list.classList.remove('hidden');

    // Click handling
    list.onclick = (e) => {
      const el = e.target.closest('.ac-item'); if (!el) return;
      const idx = Number(el.dataset.idx||'-1'); const row = out[idx]; if (!row) return;
      hide(); input.blur(); row.onClick();
    };

    // Enter selects first
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = out[0]; if (first) { hide(); input.blur(); first.onClick(); }
      } else if (e.key === 'Escape') { hide(); }
    };
  }

  input.addEventListener('input', () => showSuggestions(input.value));
  input.addEventListener('focus', () => showSuggestions(input.value));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) hide();
  });
}

function setupSegmentFilter() {
  const select = document.getElementById('segmentFilter');
  if (!select) return;
  
  // Populera segment-filter
  function updateSegmentFilter() {
    const currentValue = AppState.activeSegmentId || '';
    select.innerHTML = '<option value="">Alla segment</option>';
    
    if (AppState.segments && AppState.segments.length > 0) {
      AppState.segments.forEach(seg => {
        const option = document.createElement('option');
        option.value = seg.id;
        option.textContent = `${seg.icon} ${seg.name}`;
        if (seg.id === currentValue) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    }
  }
  
  // Initial render
  updateSegmentFilter();
  
  // Hantera Ã¤ndringar
  select.addEventListener('change', () => {
    AppState.activeSegmentId = select.value || null;
    saveState();
    
    // Re-rendera aktiv vy fÃ¶r att tillÃ¤mpa filtret
    const activeView = document.querySelector('.view.visible');
    if (activeView) {
      const viewName = activeView.id.replace('view-', '');
      renderView(viewName);
    }
  });
  
  // GÃ¶r funktionen tillgÃ¤nglig globalt sÃ¥ att den kan kallas efter segment-Ã¤ndringar
  window.updateSegmentFilter = updateSegmentFilter;
}

function updateUserBox() {
  const cu = currentUser();
  const label = document.getElementById('currentUser');
  const btn = document.getElementById('loginBtn');
  label.textContent = cu ? `Inloggad: ${cu.namn}` : 'Inte inloggad';
  if (!btn) return;
  // reset any previous handler
  btn.replaceWith(btn.cloneNode(true));
  const btn2 = document.getElementById('loginBtn');
  if (cu) {
    btn2.textContent = 'Logga ut';
    btn2.classList.remove('secondary');
    btn2.classList.add('secondary');
    btn2.onclick = async () => {
      try { await fetch(`${API_BASE}/api/logout`, { method:'POST', credentials:'include' }); } catch {}
      AppState.currentUserId = null; saveState(); updateUserBox();
    };
  } else {
    btn2.textContent = 'Logga in';
    btn2.classList.remove('secondary');
    btn2.classList.add('secondary');
    btn2.onclick = openLogin;
  }
}

function setupNav() {
  // Find navigation menu (DaisyUI sidebar or original nav)
  const navElement = document.querySelector('.menu') || document.querySelector('nav');
  if (navElement) {
    navElement.addEventListener('click', (e) => {
      const btn = e.target.closest('button.nav-item');
      if (!btn) return;
      setView(btn.dataset.view);
      
      // Close mobile drawer after navigation
      const drawerToggle = document.getElementById('drawer-toggle');
      if (drawerToggle) {
        drawerToggle.checked = false;
      }
    });
  }
}

async function init() {
  // Initialize modal first, before loadState might need it
  modal.init();
  
  // CRITICAL FIX: Ensure modal is hidden on init
  modal.hide();
  
  // Close any stuck dialogs
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  
  await loadState();
  
  setupNav();
  setupGlobalSearch();
  setupSegmentFilter();
  setupUndoButton();
  setupUserManagementHandlers();
  updateUserBox();
  renderView('dashboard');
  updateCommunicationUI();
  
  // Double-check: Close any dialogs that opened during init
  setTimeout(() => {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
  }, 50);
}

function setupUserManagementHandlers() {
  // Note: manageCustomers button listener is added in renderSettings()
  // since the button is inside a template that's rendered later
  
  // Create user form
  const createUserForm = document.getElementById('createUserForm');
  if (createUserForm) {
    createUserForm.addEventListener('submit', createUserInB2C);
  }
  
  // Grant service form
  const grantServiceForm = document.getElementById('grantServiceForm');
  if (grantServiceForm) {
    grantServiceForm.addEventListener('submit', grantServiceAccess);
  }
  
  // Customer search and filters
  const customerSearch = document.getElementById('customerSearch');
  if (customerSearch) {
    customerSearch.addEventListener('input', renderCustomersTable);
  }
  
  const customerRoleFilter = document.getElementById('customerRoleFilter');
  if (customerRoleFilter) {
    customerRoleFilter.addEventListener('change', renderCustomersTable);
  }
  
  const customerStatusFilter = document.getElementById('customerStatusFilter');
  if (customerStatusFilter) {
    customerStatusFilter.addEventListener('change', renderCustomersTable);
  }
}

function setupUndoButton() {
  const undoBtn = document.getElementById('globalUndoBtn');
  if (undoBtn) {
    undoBtn.addEventListener('click', performUndo);
    updateUndoButton();
  }
}

// Global event delegation for performance
function handleGlobalClick(e) {
  const target = e.target;

  // NEW UNIFIED ACTION HANDLER - Handle all data-action buttons first
  const actionBtn = target.closest('button[data-action][data-id]');
  if (actionBtn) {
    const action = actionBtn.dataset.action;
    const id = actionBtn.dataset.id;
    e.preventDefault();
    
    if (action === 'open') {
      openBrand(id);
    } else if (action === 'edit-name') {
      openEditBrandNameModal(id);
    } else if (action === 'edit-company-name') {
      openEditCompanyNameModal(id);
    } else if (action === 'note') {
      openNoteModal('brand', id);
    } else if (action === 'del') {
      if (confirm('Ta bort varumÃ¤rket och alla tillhÃ¶rande fÃ¶retag, mÃ¤klare och uppgifter?')) {
        deleteBrandCascadeWithUndo(id);
        renderBrands();
        renderCompanies();
        renderAgents();
        renderDashboard();
      }
    }
    return;
  }

  // Agent actions (OLD STYLE - LEGACY) - CHECK FIRST because they use data-open too!
  const openAgentBtn = target.closest('button[data-open-agent]');
  if (openAgentBtn) {
    e.preventDefault();
    openAgent(openAgentBtn.dataset.openAgent);
    return;
  }

  const noteAgentBtn = target.closest('button[data-note-agent]');
  if (noteAgentBtn) {
    e.preventDefault();
    openNoteModal('agent', noteAgentBtn.dataset.noteAgent);
    return;
  }

  const delAgentBtn = target.closest('button[data-del-agent]');
  if (delAgentBtn) {
    e.preventDefault();
    if (confirm('Ta bort mÃ¤klare och tillhÃ¶rande uppgifter?')) {
      deleteAgentWithUndo(delAgentBtn.dataset.delAgent);
      renderAgents();
      renderDashboard();
    }
    return;
  }

  // Company actions (OLD STYLE - LEGACY)
  const openCompanyBtn = target.closest('button[data-open]');
  if (openCompanyBtn) {
    e.preventDefault();
    openCompany(openCompanyBtn.dataset.open);
    return;
  }

  const noteCompanyBtn = target.closest('button[data-note]');
  if (noteCompanyBtn) {
    e.preventDefault();
    openNoteModal('company', noteCompanyBtn.dataset.note);
    return;
  }

  const delCompanyBtn = target.closest('button[data-del]');
  if (delCompanyBtn) {
    e.preventDefault();
    if (confirm('Ta bort fÃ¶retaget och tillhÃ¶rande mÃ¤klare/uppgifter?')) {
      deleteCompanyCascadeWithUndo(delCompanyBtn.dataset.del);
      renderCompanies();
      renderAgents();
      renderDashboard();
    }
    return;
  }

  // Brand actions (OLD STYLE - LEGACY - kept for backwards compatibility)
  const openBrandBtn = target.closest('button[data-open-brand]');
  if (openBrandBtn) {
    e.preventDefault();
    openBrand(openBrandBtn.dataset.openBrand);
    return;
  }

  // Task actions
  const doneTaskBtn = target.closest('button[data-done]');
  if (doneTaskBtn) {
    e.preventDefault();
    const t = AppState.tasks.find(x => x.id === doneTaskBtn.dataset.done);
    if (t) {
      t.done = true;
      saveState();
      renderDashboard(); // Or specific re-render
    }
    return;
  }

  const editTaskBtn = target.closest('button[data-edit-task]');
  if (editTaskBtn) {
    e.preventDefault();
    openTaskModal({ taskId: editTaskBtn.dataset.editTask });
    return;
  }

  const delTaskBtn = target.closest('button[data-del-task]');
  if (delTaskBtn) {
    e.preventDefault();
    AppState.tasks = AppState.tasks.filter(t => t.id !== delTaskBtn.dataset.delTask);
    saveState();
    renderDashboard();
    return;
  }

  // Note actions
  const editNoteBtn = target.closest('button[data-edit-note]');
  if (editNoteBtn) {
    e.preventDefault();
    openNoteModal(null, null, editNoteBtn.dataset.editNote);
    return;
  }

  const delNoteBtn = target.closest('button[data-del-note]');
  if (delNoteBtn) {
    e.preventDefault();
    AppState.notes = AppState.notes.filter(n => n.id !== delNoteBtn.dataset.delNote);
    saveState();
    renderDashboard();
    return;
  }

  // Contact actions
  const editContactBtn = target.closest('button[data-edit-contact]');
  if (editContactBtn) {
    e.preventDefault();
    const c = AppState.contacts.find(x => x.id === editContactBtn.dataset.editContact);
    if (c) openContactModal(c.entityType, c.entityId, c.id);
    return;
  }

  const delContactBtn = target.closest('button[data-del-contact]');
  if (delContactBtn) {
    e.preventDefault();
    if (confirm('Ta bort kontakt?')) {
      AppState.contacts = AppState.contacts.filter(x => x.id !== delContactBtn.dataset.delContact);
      saveState();
      // Re-render relevant view
    }
    return;
  }
}

// Attach global click handler
document.addEventListener('click', handleGlobalClick);

// Also try mousedown as fallback
document.addEventListener('mousedown', function(e) {
  // Fallback for debugging if clicks don't work
  const btn = e.target.closest('button[data-action]');
  if (btn && !e.defaultPrevented) {
    // Click handler should have caught this
  }
});

// --- Communication System (Email & SMS) ---
const CommunicationState = {
  selectedRecipients: new Set(), // Set of {type:'company'|'agent', id, name, email?, phone?}
};

function openCommunicationModal(initialRecipients = []) {
  // Initialize with provided recipients or current selection
  CommunicationState.selectedRecipients.clear();
  initialRecipients.forEach(r => CommunicationState.selectedRecipients.add(r));
  
  const recipients = Array.from(CommunicationState.selectedRecipients);
  const emailRecipients = recipients.filter(r => r.email);
  const smsRecipients = recipients.filter(r => r.phone);
  
  modal.show(`
    <h3>Skicka meddelande</h3>
    <div class="muted" style="margin-bottom:12px;">VÃ¤lj mottagare och kommunikationskanal</div>
    
    <div class="tabs" style="display:flex; gap:8px; border-bottom:1px solid var(--border); margin-bottom:12px;">
      <button class="tab-btn active" data-tab="email">ðŸ“§ E-post (${emailRecipients.length})</button>
      <button class="tab-btn" data-tab="sms">ðŸ“± SMS (${smsRecipients.length})</button>
      <button class="tab-btn" data-tab="recipients">ðŸ‘¥ Mottagare (${recipients.length})</button>
    </div>
    
    <div class="tab-content active" id="tab-email">
      <div class="field">
        <label>Ã„mne</label>
        <input id="emailSubject" placeholder="Ange Ã¤mnesrad" />
      </div>
      <div class="field">
        <label>Meddelande</label>
        <textarea id="emailBody" rows="8" placeholder="Skriv ditt meddelande hÃ¤r..."></textarea>
      </div>
      <div class="field">
        <label>Meddelande-mall</label>
        <select id="emailTemplate">
          <option value="">-- VÃ¤lj mall --</option>
          <option value="welcome">VÃ¤lkomstmail</option>
          <option value="followup">UppfÃ¶ljning</option>
          <option value="offer">Erbjudande</option>
          <option value="reminder">PÃ¥minnelse</option>
        </select>
      </div>
      <div class="muted" style="margin-top:8px;">
        Mottagare: ${emailRecipients.map(r => r.email).join(', ') || 'Inga mottagare med e-post'}
      </div>
      <div style="margin-top:12px; display:flex; gap:8px;">
        <button class="primary" id="sendEmail" ${emailRecipients.length === 0 ? 'disabled' : ''}>Skicka e-post</button>
        <button class="secondary" id="previewEmail">FÃ¶rhandsgranska</button>
      </div>
    </div>
    
    <div class="tab-content" id="tab-sms">
      <div class="field">
        <label>SMS-meddelande (max 160 tecken)</label>
        <textarea id="smsBody" rows="4" maxlength="160" placeholder="Skriv ditt SMS..."></textarea>
        <div class="muted" id="smsCounter">0 / 160 tecken</div>
      </div>
      <div class="field">
        <label>SMS-mall</label>
        <select id="smsTemplate">
          <option value="">-- VÃ¤lj mall --</option>
          <option value="appointment">MÃ¶tesbokningsbekrÃ¤ftelse</option>
          <option value="reminder">PÃ¥minnelse</option>
          <option value="thankyou">Tack fÃ¶r mÃ¶tet</option>
        </select>
      </div>
      <div class="muted" style="margin-top:8px;">
        Mottagare: ${smsRecipients.map(r => r.phone).join(', ') || 'Inga mottagare med telefonnummer'}
      </div>
      <div style="margin-top:12px; display:flex; gap:8px;">
        <button class="primary" id="sendSMS" ${smsRecipients.length === 0 ? 'disabled' : ''}>Skicka SMS</button>
        <button class="secondary" id="previewSMS">FÃ¶rhandsgranska</button>
      </div>
    </div>
    
    <div class="tab-content" id="tab-recipients">
      <div class="list" style="max-height:300px; overflow:auto;">
        ${recipients.length === 0 ? '<div class="muted">Inga mottagare valda. LÃ¤gg till mottagare frÃ¥n fÃ¶retags- eller mÃ¤klarlistan.</div>' : ''}
        ${recipients.map(r => `
          <div class="list-item">
            <div>
              <div class="title">${r.name}</div>
              <div class="subtitle">
                ${r.email ? `ðŸ“§ ${r.email}` : ''}
                ${r.email && r.phone ? ' Â· ' : ''}
                ${r.phone ? `ðŸ“± ${r.phone}` : ''}
                ${!r.email && !r.phone ? 'Ingen kontaktinformation' : ''}
              </div>
            </div>
            <button class="danger" data-remove-recipient="${r.id}">Ta bort</button>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:12px;">
        <button class="secondary" id="addRecipientsFromCompanies">LÃ¤gg till frÃ¥n fÃ¶retag</button>
        <button class="secondary" id="addRecipientsFromAgents">LÃ¤gg till frÃ¥n mÃ¤klare</button>
      </div>
    </div>
    
    <div style="margin-top:16px; display:flex; gap:8px; justify-content:flex-end; border-top:1px solid var(--border); padding-top:12px;">
      <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
    </div>
  `);
  
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
  
  // SMS character counter
  const smsBody = document.getElementById('smsBody');
  const smsCounter = document.getElementById('smsCounter');
  if (smsBody && smsCounter) {
    smsBody.addEventListener('input', () => {
      smsCounter.textContent = `${smsBody.value.length} / 160 tecken`;
    });
  }
  
  // Email templates
  const emailTemplates = {
    welcome: {
      subject: 'VÃ¤lkommen till vÃ¥rt mÃ¤klarnÃ¤tverk!',
      body: 'Hej!\n\nVi vill hÃ¤lsa dig varmt vÃ¤lkommen till vÃ¥rt nÃ¤tverk. Vi ser fram emot ett gott samarbete.\n\nMed vÃ¤nliga hÃ¤lsningar,\n[Ditt namn]'
    },
    followup: {
      subject: 'UppfÃ¶ljning frÃ¥n vÃ¥rt senaste mÃ¶te',
      body: 'Hej!\n\nTack fÃ¶r ett trevligt mÃ¶te. Jag hoppas ni har haft tid att fundera pÃ¥ vÃ¥rt fÃ¶rslag.\n\nHÃ¶r gÃ¤rna av er om ni har nÃ¥gra frÃ¥gor.\n\nMed vÃ¤nliga hÃ¤lsningar,\n[Ditt namn]'
    },
    offer: {
      subject: 'Exklusivt erbjudande fÃ¶r er',
      body: 'Hej!\n\nVi har ett specialerbjudande som vi tror kan vara intressant fÃ¶r er verksamhet.\n\nKontakta oss fÃ¶r mer information.\n\nMed vÃ¤nliga hÃ¤lsningar,\n[Ditt namn]'
    },
    reminder: {
      subject: 'PÃ¥minnelse',
      body: 'Hej!\n\nDetta Ã¤r en vÃ¤nlig pÃ¥minnelse om vÃ¥rt kommande mÃ¶te.\n\nMed vÃ¤nliga hÃ¤lsningar,\n[Ditt namn]'
    }
  };
  
  const smsTemplates = {
    appointment: 'BekrÃ¤ftelse: MÃ¶te bokad [DATUM] kl [TID]. VÃ¤lkommen!',
    reminder: 'PÃ¥minnelse: MÃ¶te imorgon kl [TID]. Vi ses!',
    thankyou: 'Tack fÃ¶r ett trevligt mÃ¶te idag! HÃ¶r av dig om du har frÃ¥gor.'
  };
  
  // Template selection
  document.getElementById('emailTemplate')?.addEventListener('change', (e) => {
    const template = emailTemplates[e.target.value];
    if (template) {
      document.getElementById('emailSubject').value = template.subject;
      document.getElementById('emailBody').value = template.body;
    }
  });
  
  document.getElementById('smsTemplate')?.addEventListener('change', (e) => {
    const template = smsTemplates[e.target.value];
    if (template) {
      document.getElementById('smsBody').value = template;
      smsCounter.textContent = `${template.length} / 160 tecken`;
    }
  });
  
  // Send email
  document.getElementById('sendEmail')?.addEventListener('click', () => {
    const subject = document.getElementById('emailSubject').value.trim();
    const body = document.getElementById('emailBody').value.trim();
    
    if (!subject || !body) {
      alert('VÃ¤nligen fyll i bÃ¥de Ã¤mne och meddelande.');
      return;
    }
    
    const emails = emailRecipients.map(r => r.email).join(',');
    const mailtoLink = `mailto:${emails}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.location.href = mailtoLink;
    showNotification(`E-post Ã¶ppnad i din e-postklient (${emailRecipients.length} mottagare)`, 'success');
    modal.hide();
  });
  
  // Send SMS
  document.getElementById('sendSMS')?.addEventListener('click', () => {
    const body = document.getElementById('smsBody').value.trim();
    
    if (!body) {
      alert('VÃ¤nligen skriv ett meddelande.');
      return;
    }
    
    // For SMS, we'll show a dialog with instructions since SMS requires a gateway
    modal.show(`
      <h3>SMS-meddelande klart att skickas</h3>
      <div class="muted" style="margin-bottom:12px;">Meddelandet Ã¤r fÃ¶rberett. VÃ¤lj hur du vill skicka:</div>
      
      <div class="field">
        <label>Meddelande</label>
        <textarea readonly rows="4">${body}</textarea>
      </div>
      
      <div class="field">
        <label>Mottagare (${smsRecipients.length})</label>
        <div class="list" style="max-height:200px; overflow:auto;">
          ${smsRecipients.map(r => `<div class="list-item"><div><div class="title">${r.name}</div><div class="subtitle">${r.phone}</div></div></div>`).join('')}
        </div>
      </div>
      
      <div style="background:#fef3c7; border:1px solid #fbbf24; border-radius:8px; padding:12px; margin:12px 0;">
        <strong>OBS:</strong> FÃ¶r att skicka SMS behÃ¶ver du integrera en SMS-gateway som Twilio, 46elks eller liknande.
        Kontakta utvecklaren fÃ¶r att konfigurera SMS-integration.
      </div>
      
      <div style="margin-top:16px; display:flex; gap:8px;">
        <button class="primary" id="copySMSData">Kopiera data</button>
        <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
      </div>
    `);
    
    document.getElementById('copySMSData')?.addEventListener('click', () => {
      const data = JSON.stringify({
        message: body,
        recipients: smsRecipients.map(r => ({ name: r.name, phone: r.phone }))
      }, null, 2);
      navigator.clipboard.writeText(data);
      showNotification('SMS-data kopierad till urklipp', 'success');
    });
  });
  
  // Preview buttons
  document.getElementById('previewEmail')?.addEventListener('click', () => {
    const subject = document.getElementById('emailSubject').value.trim();
    const body = document.getElementById('emailBody').value.trim();
    alert(`FÃ–RHANDSVISNING\n\nÃ„mne: ${subject}\n\n${body}`);
  });
  
  document.getElementById('previewSMS')?.addEventListener('click', () => {
    const body = document.getElementById('smsBody').value.trim();
    alert(`SMS FÃ–RHANDSVISNING\n\n${body}\n\nLÃ¤ngd: ${body.length} tecken`);
  });
  
  // Remove recipient
  document.querySelectorAll('[data-remove-recipient]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idToRemove = btn.dataset.removeRecipient;
      CommunicationState.selectedRecipients = new Set(
        Array.from(CommunicationState.selectedRecipients).filter(r => r.id !== idToRemove)
      );
      openCommunicationModal(Array.from(CommunicationState.selectedRecipients));
    });
  });
  
  // Add recipients from lists
  document.getElementById('addRecipientsFromCompanies')?.addEventListener('click', () => {
    openRecipientSelectorModal('companies');
  });
  
  document.getElementById('addRecipientsFromAgents')?.addEventListener('click', () => {
    openRecipientSelectorModal('agents');
  });
}

function openRecipientSelectorModal(type) {
  const items = type === 'companies' ? AppState.companies : AppState.agents;
  
  modal.show(`
    <h3>VÃ¤lj ${type === 'companies' ? 'fÃ¶retag' : 'mÃ¤klare'}</h3>
    <div style="margin-bottom:12px;">
      <input type="search" id="recipientSearch" placeholder="SÃ¶k..." style="width:100%;" />
    </div>
    <div class="list" style="max-height:400px; overflow:auto;" id="recipientList">
      ${items.map(item => {
        const isCompany = type === 'companies';
        const name = isCompany ? item.namn : `${item.fÃ¶rnamn} ${item.efternamn}`;
        const email = isCompany ? '' : item.email;
        const phone = isCompany ? '' : item.telefon;
        const id = item.id;
        
        // For companies, get primary contact if available
        let companyEmail = '';
        let companyPhone = '';
        if (isCompany) {
          const primaryContact = AppState.contacts.find(c => c.entityType === 'company' && c.entityId === id);
          if (primaryContact) {
            companyEmail = primaryContact.email || '';
            companyPhone = primaryContact.telefon || '';
          }
        }
        
        const finalEmail = email || companyEmail;
        const finalPhone = phone || companyPhone;
        
        return `<div class="list-item recipient-item" data-searchable="${name.toLowerCase()}">
          <div>
            <div class="title">${name}</div>
            <div class="subtitle">
              ${finalEmail ? `ðŸ“§ ${finalEmail}` : ''}
              ${finalEmail && finalPhone ? ' Â· ' : ''}
              ${finalPhone ? `ðŸ“± ${finalPhone}` : ''}
              ${!finalEmail && !finalPhone ? 'Ingen kontaktinformation' : ''}
            </div>
          </div>
          <input type="checkbox" data-recipient-id="${id}" data-name="${name}" data-email="${finalEmail}" data-phone="${finalPhone}" />
        </div>`;
      }).join('')}
    </div>
    <div style="margin-top:16px; display:flex; gap:8px; justify-content:space-between;">
      <button class="secondary" id="selectAllRecipients">VÃ¤lj alla</button>
      <div style="display:flex; gap:8px;">
        <button class="primary" id="addSelectedRecipients">LÃ¤gg till valda</button>
        <button class="secondary" onclick="modal.hide()">Avbryt</button>
      </div>
    </div>
  `);
  
  // Search functionality
  document.getElementById('recipientSearch')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.recipient-item').forEach(item => {
      const searchable = item.dataset.searchable || '';
      item.style.display = searchable.includes(query) ? '' : 'none';
    });
  });
  
  // Select all
  document.getElementById('selectAllRecipients')?.addEventListener('click', () => {
    document.querySelectorAll('[data-recipient-id]').forEach(cb => {
      if (cb.closest('.recipient-item').style.display !== 'none') {
        cb.checked = true;
      }
    });
  });
  
  // Add selected
  document.getElementById('addSelectedRecipients')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('[data-recipient-id]:checked');
    checkboxes.forEach(cb => {
      CommunicationState.selectedRecipients.add({
        type,
        id: cb.dataset.recipientId,
        name: cb.dataset.name,
        email: cb.dataset.email,
        phone: cb.dataset.phone
      });
    });
    
    showNotification(`${checkboxes.length} mottagare tillagda`, 'success');
    openCommunicationModal(Array.from(CommunicationState.selectedRecipients));
  });
}

// Add communication button to companies view
function addCommunicationButtons() {
  // This will be called after render functions to add bulk action buttons
  updateCommunicationUI();
}

function updateCommunicationUI() {
  const undoBtn = document.getElementById('globalUndoBtn');
  if (undoBtn && !document.getElementById('globalCommBtn')) {
    const commBtn = document.createElement('button');
    commBtn.id = 'globalCommBtn';
    commBtn.className = 'secondary';
    commBtn.innerHTML = 'âœ‰ï¸ Skicka meddelande';
    commBtn.style.marginLeft = '12px';
    commBtn.addEventListener('click', () => openCommunicationModal());
    undoBtn.parentElement.appendChild(commBtn);
  }
  
  // Add data enrichment button
  if (undoBtn && !document.getElementById('globalEnrichBtn')) {
    const enrichBtn = document.createElement('button');
    enrichBtn.id = 'globalEnrichBtn';
    enrichBtn.className = 'secondary';
    enrichBtn.innerHTML = 'ðŸ”„ Uppdatera kontaktuppgifter';
    enrichBtn.style.marginLeft = '12px';
    enrichBtn.addEventListener('click', () => openDataEnrichmentModal());
    undoBtn.parentElement.appendChild(enrichBtn);
  }
  
  // Add GDPR button
  if (undoBtn && !document.getElementById('globalGDPRBtn')) {
    const gdprBtn = document.createElement('button');
    gdprBtn.id = 'globalGDPRBtn';
    gdprBtn.className = 'secondary';
    gdprBtn.innerHTML = 'ðŸ”’ GDPR & SÃ¤kerhet';
    gdprBtn.style.marginLeft = '12px';
    gdprBtn.addEventListener('click', () => openGDPRMenu());
    undoBtn.parentElement.appendChild(gdprBtn);
  }
}

// --- Data Enrichment System ---
const EnrichmentState = {
  inProgress: false,
  results: []
};

async function openDataEnrichmentModal() {
  modal.show(`
    <h3>ðŸ”„ Automatisk uppdatering av kontaktuppgifter</h3>
    <div class="muted" style="margin-bottom:16px;">
      Systemet hÃ¤mtar automatiskt uppdaterad information om fÃ¶retag, mÃ¤klare och varumÃ¤rken frÃ¥n olika kÃ¤llor.
    </div>
    
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-header">
        <h3>Vad uppdateras?</h3>
      </div>
      <div style="padding:12px;">
        <ul style="margin:0; padding-left:20px;">
          <li>ðŸ“ž <strong>Telefonnummer</strong> - FÃ¶retagets huvudnummer och mÃ¤klarnas direktnummer</li>
          <li>ðŸ“§ <strong>E-postadresser</strong> - Kontakt-email (info@, kontakt@) och mÃ¤klarnas professionella emails</li>
          <li>ðŸŒ <strong>Hemsidor</strong> - FÃ¶retagets webbadress med intelligenta mÃ¶nsterigenkÃ¤nning fÃ¶r kedjor</li>
          <li>ðŸ“ <strong>Adresser</strong> - BesÃ¶ksadress och postadress frÃ¥n offentliga register</li>
          <li>ðŸ¢ <strong>Organisationsnummer</strong> - Verifiering och datahÃ¤mtning frÃ¥n Bolagsverket</li>
        </ul>
      </div>
    </div>
    
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-header">
        <h3>Intelligenta funktioner</h3>
      </div>
      <div style="padding:12px;">
        <ul style="margin:0; padding-left:20px;">
          <li>ðŸŽ¯ <strong>VarumÃ¤rkesmÃ¶nster</strong> - KÃ¤nner igen ERA, Svensk FastighetsfÃ¶rmedling, MÃ¤klarhuset m.fl.</li>
          <li>ðŸ” <strong>Multi-kÃ¤lla verifiering</strong> - Korskontrollerar data frÃ¥n flera kÃ¤llor</li>
          <li>ðŸ“Š <strong>Prioritering</strong> - HÃ¤mtar frÃ¥n mest tillfÃ¶rlitliga kÃ¤llor fÃ¶rst</li>
          <li>âœ‰ï¸ <strong>Email-mÃ¶nsterigenkÃ¤nning</strong> - Genererar professionella emails baserat pÃ¥ fÃ¶retagets domÃ¤n</li>
        </ul>
      </div>
    </div>
    
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-header">
        <h3>DatakÃ¤llor</h3>
      </div>
      <div style="padding:12px;">
        <div class="grid-2" style="gap:8px;">
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="source-allabolag" checked />
            <span>Allabolag.se (FÃ¶retagsinformation)</span>
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="source-bolagsverket" checked />
            <span>Bolagsverket (Offentliga register)</span>
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="source-google" checked />
            <span>Google/LinkedIn (SÃ¶kningar & profiler)</span>
          </label>
          <label style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="source-website" checked />
            <span>FÃ¶retagens hemsidor (Smart scraping)</span>
          </label>
        </div>
      </div>
    </div>
    
    <div class="field">
      <label>Vilka entiteter ska uppdateras?</label>
      <select id="enrichTarget">
        <option value="companies">Alla fÃ¶retag (${AppState.companies.length})</option>
        <option value="agents">Alla mÃ¤klare (${AppState.agents.length})</option>
        <option value="brands">Alla varumÃ¤rken (${AppState.brands.length})</option>
        <option value="both">FÃ¶retag och mÃ¤klare</option>
        <option value="all">Allt (fÃ¶retag, mÃ¤klare, varumÃ¤rken)</option>
        <option value="missing">Endast poster med saknad information â­</option>
      </select>
    </div>
    
    <div class="field">
      <label style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="enrichOverwrite" />
        <span>Skriv Ã¶ver befintlig information</span>
      </label>
      <div class="muted">Om avmarkerad fylls endast tomma fÃ¤lt i (rekommenderat)</div>
    </div>
    
    <div id="enrichProgress" style="display:none; margin-top:16px; padding:12px; background:#f8fafc; border-radius:8px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span id="enrichStatus">FÃ¶rbereder...</span>
        <span id="enrichCounter">0 / 0</span>
      </div>
      <div style="background:#e2e8f0; height:8px; border-radius:4px; overflow:hidden;">
        <div id="enrichBar" style="background:var(--primary); height:100%; width:0%; transition:width 0.3s ease;"></div>
      </div>
      <div class="muted" style="margin-top:8px;" id="enrichLog"></div>
    </div>
    
    <div id="enrichResults" style="display:none; margin-top:16px;">
      <h4>Resultat</h4>
      <div class="list" style="max-height:300px; overflow:auto;" id="enrichResultsList"></div>
    </div>
    
    <div style="margin-top:16px; display:flex; gap:8px; justify-content:flex-end;">
      <button class="primary" id="startEnrichment">ðŸš€ Starta uppdatering</button>
      <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
    </div>
  `);
  
  document.getElementById('startEnrichment')?.addEventListener('click', async () => {
    const target = document.getElementById('enrichTarget').value;
    const overwrite = document.getElementById('enrichOverwrite').checked;
    const sources = {
      allabolag: document.getElementById('source-allabolag')?.checked,
      bolagsverket: document.getElementById('source-bolagsverket')?.checked,
      google: document.getElementById('source-google')?.checked,
      website: document.getElementById('source-website')?.checked
    };
    
    await performDataEnrichment(target, overwrite, sources);
  });
}

async function performDataEnrichment(target, overwrite, sources) {
  const progressDiv = document.getElementById('enrichProgress');
  const resultsDiv = document.getElementById('enrichResults');
  const statusEl = document.getElementById('enrichStatus');
  const counterEl = document.getElementById('enrichCounter');
  const barEl = document.getElementById('enrichBar');
  const logEl = document.getElementById('enrichLog');
  const resultsList = document.getElementById('enrichResultsList');
  const startBtn = document.getElementById('startEnrichment');
  
  if (startBtn) startBtn.disabled = true;
  progressDiv.style.display = 'block';
  
  EnrichmentState.inProgress = true;
  EnrichmentState.results = [];
  
  let items = [];
  
  if (target === 'companies' || target === 'both' || target === 'all') {
    items = items.concat(AppState.companies.map(c => ({ type: 'company', data: c })));
  }
  if (target === 'agents' || target === 'both' || target === 'all') {
    items = items.concat(AppState.agents.map(a => ({ type: 'agent', data: a })));
  }
  if (target === 'brands' || target === 'all') {
    items = items.concat(AppState.brands.map(b => ({ type: 'brand', data: b })));
  }
  if (target === 'missing') {
    items = AppState.companies.filter(c => !c.website || !c.telefon || !c.email).map(c => ({ type: 'company', data: c }));
    items = items.concat(AppState.agents.filter(a => !a.email || !a.telefon).map(a => ({ type: 'agent', data: a })));
    items = items.concat(AppState.brands.filter(b => !b.website || !b.telefon).map(b => ({ type: 'brand', data: b })));
  }
  
  const total = items.length;
  let completed = 0;
  let updated = 0;
  
  statusEl.textContent = 'Uppdaterar...';
  
  for (const item of items) {
    completed++;
    counterEl.textContent = `${completed} / ${total}`;
    barEl.style.width = `${(completed / total) * 100}%`;
    
    try {
      const result = await enrichEntity(item.type, item.data, overwrite, sources);
      
      if (result.updated) {
        updated++;
        EnrichmentState.results.push(result);
        logEl.innerHTML = `<div style="color:var(--accent);">âœ“ ${result.name} - ${result.updates.length} uppdateringar</div>`;
      } else {
        logEl.innerHTML = `<div style="color:var(--muted);">â—‹ ${result.name} - ingen ny information</div>`;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error('Enrichment error:', error);
      logEl.innerHTML = `<div style="color:var(--danger);">âœ— ${item.data.namn || item.data.fÃ¶rnamn} - fel uppstod</div>`;
    }
  }
  
  statusEl.textContent = `Klart! ${updated} av ${total} uppdaterade`;
  barEl.style.width = '100%';
  
  // Show results
  if (EnrichmentState.results.length > 0) {
    resultsDiv.style.display = 'block';
    resultsList.innerHTML = EnrichmentState.results.map(r => `
      <div class="list-item">
        <div>
          <div class="title">${r.name} ${r.type === 'brand' ? '(VarumÃ¤rke)' : r.type === 'company' ? '(FÃ¶retag)' : '(MÃ¤klare)'}</div>
          <div class="subtitle">${r.updates.join(', ')}</div>
        </div>
        <span class="tag accent">${r.updates.length} uppdateringar</span>
      </div>
    `).join('');
    
    saveState();
    showNotification(`${updated} poster uppdaterade med ny information!`, 'success');
    
    // Refresh current view to show updated data
    const currentView = AppState.currentView || 'dashboard';
    if (currentView === 'companies') {
      renderCompanies();
    } else if (currentView === 'agents') {
      renderAgents();
    } else if (currentView === 'brands') {
      renderBrands();
    } else if (currentView === 'dashboard') {
      renderDashboard();
    }
  } else {
    resultsDiv.style.display = 'block';
    resultsList.innerHTML = '<div class="muted">Ingen ny information hittades.</div>';
  }
  
  EnrichmentState.inProgress = false;
  if (startBtn) startBtn.disabled = false;
}

async function enrichEntity(type, entity, overwrite, sources) {
  const result = {
    type,
    id: entity.id,
    name: type === 'company' ? entity.namn : type === 'brand' ? entity.namn : `${entity.fÃ¶rnamn} ${entity.efternamn}`,
    updated: false,
    updates: []
  };
  
  if (type === 'company') {
    // Enrich company data
    const enrichedData = await enrichCompanyData(entity, sources);
    
    // Update phone
    if (enrichedData.phone && (overwrite || !entity.telefon)) {
      entity.telefon = enrichedData.phone;
      result.updates.push('Telefon');
      result.updated = true;
    }
    
    // Update email
    if (enrichedData.email && (overwrite || !entity.email)) {
      entity.email = enrichedData.email;
      result.updates.push('E-post');
      result.updated = true;
    }
    
    // Update website
    if (enrichedData.website && (overwrite || !entity.website)) {
      entity.website = enrichedData.website;
      result.updates.push('Hemsida');
      result.updated = true;
    }
    
    // Update address
    if (enrichedData.address && (overwrite || !entity.address)) {
      entity.address = enrichedData.address;
      result.updates.push('Adress');
      result.updated = true;
    }
    
    // Update postal code
    if (enrichedData.postalCode && (overwrite || !entity.postalCode)) {
      entity.postalCode = enrichedData.postalCode;
      result.updates.push('Postnummer');
      result.updated = true;
    }
    
    // Update city
    if (enrichedData.city && (overwrite || !entity.stad)) {
      entity.stad = enrichedData.city;
      result.updates.push('Ort');
      result.updated = true;
    }
    
  } else if (type === 'agent') {
    // Enrich agent data
    const enrichedData = await enrichAgentData(entity, sources);
    
    // Update email
    if (enrichedData.email && (overwrite || !entity.email)) {
      entity.email = enrichedData.email;
      result.updates.push('E-post');
      result.updated = true;
    }
    
    // Update phone
    if (enrichedData.phone && (overwrite || !entity.telefon)) {
      entity.telefon = enrichedData.phone;
      result.updates.push('Telefon');
      result.updated = true;
    }
    
  } else if (type === 'brand') {
    // Enrich brand data
    const enrichedData = await enrichBrandData(entity, sources);
    
    // Update website
    if (enrichedData.website && (overwrite || !entity.website)) {
      entity.website = enrichedData.website;
      result.updates.push('Hemsida');
      result.updated = true;
    }
    
    // Update phone
    if (enrichedData.phone && (overwrite || !entity.telefon)) {
      entity.telefon = enrichedData.phone;
      result.updates.push('Telefon');
      result.updated = true;
    }
    
    // Update email
    if (enrichedData.email && (overwrite || !entity.email)) {
      entity.email = enrichedData.email;
      result.updates.push('E-post');
      result.updated = true;
    }
    
    // Update headquarters address
    if (enrichedData.headquarters && (overwrite || !entity.headquarters)) {
      entity.headquarters = enrichedData.headquarters;
      result.updates.push('Huvudkontor');
      result.updated = true;
    }
  }
  
  return result;
}

async function enrichCompanyData(company, sources) {
  const data = {
    phone: null,
    email: null,
    website: null,
    address: null,
    postalCode: null,
    city: null
  };
  
  try {
    // PRIORITY 1: If company belongs to a brand chain, look for office subpage first
    if (company.brandId) {
      const brand = AppState.brands.find(b => b.id === company.brandId);
      if (brand && brand.website) {
        // This is the most reliable source for chain offices!
        const officePageData = await findOfficePageOnBrandSite(company, brand, sources);
        
        if (officePageData.url) {
          data.website = officePageData.url;
          
          // Scrape the office page for all contact info
          if (sources.website) {
            const officeInfo = await scrapeOfficePage(officePageData.url, company.namn);
            if (officeInfo.phone) data.phone = officeInfo.phone;
            if (officeInfo.email) data.email = officeInfo.email;
            if (officeInfo.address) data.address = officeInfo.address;
            if (officeInfo.postalCode) data.postalCode = officeInfo.postalCode;
            if (officeInfo.city) data.city = officeInfo.city;
          }
        }
      }
    }
    
    // PRIORITY 2: If we have a direct website (independent office), scrape it
    if (company.website && !data.phone) {
      if (sources.website) {
        const contactInfo = await scrapeWebsiteForContacts(company.website);
        if (contactInfo.phone && !data.phone) data.phone = contactInfo.phone;
        if (contactInfo.email && !data.email) data.email = contactInfo.email;
        if (contactInfo.address && !data.address) data.address = contactInfo.address;
      }
    }
    
    // PRIORITY 3: Organization number lookup (Bolagsverket/Allabolag)
    if (company.orgNumber && (sources.bolagsverket || sources.allabolag)) {
      const orgData = await lookupByOrgNumber(company.orgNumber, sources);
      
      if (orgData) {
        if (!data.phone && orgData.phone) data.phone = orgData.phone;
        if (!data.email && orgData.email) data.email = orgData.email;
        if (!data.website && orgData.website) data.website = orgData.website;
        if (!data.address && orgData.address) data.address = orgData.address;
        if (!data.postalCode && orgData.postalCode) data.postalCode = orgData.postalCode;
        if (!data.city && orgData.city) data.city = orgData.city;
      }
    }
    
    // PRIORITY 4: Google Places API (fallback)
    if (sources.google && (!data.phone || !data.website)) {
      const placesData = await searchGooglePlaces(company, sources);
      
      if (placesData) {
        if (!data.phone && placesData.phone) data.phone = placesData.phone;
        if (!data.website && placesData.website) data.website = placesData.website;
        if (!data.address && placesData.address) data.address = placesData.address;
      }
    }
    
  } catch (error) {
    console.error('Error enriching company:', error);
  }
  
  return data;
}

// Find the office page on brand's main website
async function findOfficePageOnBrandSite(company, brand, sources) {
  const result = {
    url: null,
    confidence: 0
  };
  
  if (!brand.website) return result;
  
  try {
    const brandUrl = new URL(brand.website);
    const brandDomain = brandUrl.hostname.replace('www.', '');
    const baseUrl = `${brandUrl.protocol}//${brandUrl.hostname}`;
    
    // Clean company and city names for URL generation
    const citySlug = company.stad ? cleanUrlSlug(company.stad) : '';
    const companySlug = cleanUrlSlug(company.namn.replace(brand.namn, '').trim());
    
    // Generate possible office page URLs based on known patterns
    const possibleUrls = [];
    
    // Pattern 1: /kontor/city-name (most common)
    if (citySlug) {
      possibleUrls.push({
        url: `${baseUrl}/kontor/${citySlug}`,
        pattern: 'kontor/city',
        confidence: 90
      });
      possibleUrls.push({
        url: `${baseUrl}/kontakt/kontor/${citySlug}`,
        pattern: 'kontakt/kontor/city',
        confidence: 85
      });
    }
    
    // Pattern 2: Subdomain with city (city.brand.se)
    if (citySlug) {
      possibleUrls.push({
        url: `https://${citySlug}.${brandDomain}`,
        pattern: 'city.brand',
        confidence: 80
      });
    }
    
    // Pattern 3: /city-name (simple structure)
    if (citySlug) {
      possibleUrls.push({
        url: `${baseUrl}/${citySlug}`,
        pattern: 'city',
        confidence: 75
      });
    }
    
    // Pattern 4: /om-oss/kontor/city or /vara-kontor/city
    if (citySlug) {
      possibleUrls.push({
        url: `${baseUrl}/om-oss/kontor/${citySlug}`,
        pattern: 'om-oss/kontor/city',
        confidence: 70
      });
      possibleUrls.push({
        url: `${baseUrl}/vara-kontor/${citySlug}`,
        pattern: 'vara-kontor/city',
        confidence: 70
      });
    }
    
    // Pattern 5: Brand-specific patterns
    const brandName = brand.namn.toLowerCase();
    
    if (brandName.includes('era') && citySlug) {
      possibleUrls.unshift({
        url: `https://www.era.se/kontor/${citySlug}`,
        pattern: 'ERA specific',
        confidence: 95
      });
    }
    
    if (brandName.includes('svensk fast') && citySlug) {
      possibleUrls.unshift({
        url: `https://www.svenskfast.se/kontor/${citySlug}`,
        pattern: 'Svensk Fast specific',
        confidence: 95
      });
    }
    
    if (brandName.includes('mÃ¤klarhuset') && citySlug) {
      possibleUrls.unshift({
        url: `https://www.maklarhuset.se/kontor/${citySlug}`,
        pattern: 'MÃ¤klarhuset specific',
        confidence: 95
      });
    }
    
    if (brandName.includes('fastighetsbyran') && citySlug) {
      possibleUrls.unshift({
        url: `https://www.fastighetsbyran.com/kontor/${citySlug}`,
        pattern: 'FastighetsbyrÃ¥n specific',
        confidence: 95
      });
      possibleUrls.unshift({
        url: `https://www.fastighetsbyran.com/hitta-kontor/${citySlug}`,
        pattern: 'FastighetsbyrÃ¥n specific v2',
        confidence: 95
      });
    }
    
    if (brandName.includes('husman') && citySlug) {
      possibleUrls.unshift({
        url: `https://www.husmanhagberg.se/${citySlug}`,
        pattern: 'Husman Hagberg specific',
        confidence: 95
      });
    }
    
    if (brandName.includes('notar') && citySlug) {
      possibleUrls.unshift({
        url: `https://www.notar.se/hitta-kontor/${citySlug}`,
        pattern: 'Notar specific',
        confidence: 95
      });
    }
    
    // Sort by confidence (highest first)
    possibleUrls.sort((a, b) => b.confidence - a.confidence);
    
    // In production: Try each URL with HEAD request to see if it exists
    // For now, return the most likely URL
    if (possibleUrls.length > 0) {
      result.url = possibleUrls[0].url;
      result.confidence = possibleUrls[0].confidence;
      result.pattern = possibleUrls[0].pattern;
      
      // In production, validate the URL exists:
      /*
      for (const candidate of possibleUrls) {
        const exists = await validateWebsite(candidate.url);
        if (exists) {
          result.url = candidate.url;
          result.confidence = candidate.confidence;
          result.pattern = candidate.pattern;
          break;
        }
      }
      */
    }
    
  } catch (error) {
    console.error('Error finding office page:', error);
  }
  
  return result;
}

// Scrape an office page for detailed information
async function scrapeOfficePage(url, officeName) {
  const info = {
    phone: null,
    email: null,
    address: null,
    postalCode: null,
    city: null,
    agents: [] // Array of agents found on the page
  };
  
  // In production, this would fetch and parse the page
  /*
  const response = await fetch(url);
  const html = await response.text();
  const dom = new DOMParser().parseFromString(html, 'text/html');
  
  // Look for structured data (JSON-LD)
  const jsonLdScripts = dom.querySelectorAll('script[type="application/ld+json"]');
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent);
      
      if (data['@type'] === 'RealEstateAgent' || data['@type'] === 'LocalBusiness') {
        if (data.telephone) info.phone = data.telephone;
        if (data.email) info.email = data.email;
        if (data.address) {
          if (data.address.streetAddress) info.address = data.address.streetAddress;
          if (data.address.postalCode) info.postalCode = data.address.postalCode;
          if (data.address.addressLocality) info.city = data.address.addressLocality;
        }
      }
    } catch {}
  }
  
  // Look for contact section
  const contactSection = dom.querySelector('.contact, .kontakt, [class*="contact"], [class*="kontakt"]');
  if (contactSection) {
    const text = contactSection.textContent;
    
    // Extract phone
    const phoneMatch = text.match(/(?:tel:|telefon:|phone:)?\s*((?:\+46|0)\s*(?:7[0-9]|[1-9][0-9])\s*[\d\s\-]{7,})/i);
    if (phoneMatch && !info.phone) {
      info.phone = phoneMatch[1].replace(/\s+/g, ' ').trim();
    }
    
    // Extract email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && !info.email) {
      info.email = emailMatch[0];
    }
    
    // Extract address
    const addressMatch = text.match(/([A-ZÃ…Ã„Ã–][a-zÃ¥Ã¤Ã¶]+(?:gatan|vÃ¤gen|atan|plan|grÃ¤nd|torg)\s+\d+[A-Z]?)/);
    if (addressMatch && !info.address) {
      info.address = addressMatch[1];
    }
    
    // Extract postal code
    const postalMatch = text.match(/(\d{3}\s?\d{2})/);
    if (postalMatch && !info.postalCode) {
      info.postalCode = postalMatch[1];
    }
  }
  
  // Look for agents/employees section
  const agentSection = dom.querySelector('.employees, .medarbetare, .team, [class*="agent"], [class*="broker"]');
  if (agentSection) {
    const agentCards = agentSection.querySelectorAll('.card, .person, .employee, [class*="agent-card"]');
    
    for (const card of agentCards) {
      const nameEl = card.querySelector('.name, h3, h4, [class*="name"]');
      const emailEl = card.querySelector('a[href^="mailto:"]');
      const phoneEl = card.querySelector('a[href^="tel:"]');
      
      if (nameEl) {
        const agent = {
          name: nameEl.textContent.trim(),
          email: emailEl ? emailEl.getAttribute('href').replace('mailto:', '') : null,
          phone: phoneEl ? phoneEl.getAttribute('href').replace('tel:', '') : null
        };
        info.agents.push(agent);
      }
    }
  }
  */
  
  return info;
}

// Clean text for URL slug
function cleanUrlSlug(text) {
  return text.toLowerCase()
    .replace(/Ã¥/g, 'a')
    .replace(/Ã¤/g, 'a')
    .replace(/Ã¶/g, 'o')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Find company website using multiple strategies
async function findCompanyWebsite(company, sources) {
  // Strategy 1: Brand website pattern (e.g., ERA SkÃ¥ne -> era.se/skane)
  if (company.brandId) {
    const brand = AppState.brands.find(b => b.id === company.brandId);
    if (brand && brand.website) {
      // Try common patterns
      const patterns = generateBrandWebsitePatterns(company, brand);
      for (const url of patterns) {
        if (await validateWebsite(url)) {
          return url;
        }
      }
    }
  }
  
  // Strategy 2: Direct company name search
  const directUrl = generateCompanyWebsite(company.namn);
  if (await validateWebsite(directUrl)) {
    return directUrl;
  }
  
  // Strategy 3: Google search simulation (in production, use real Google Custom Search API)
  if (sources.google) {
    const searchQuery = `${company.namn} ${company.stad || ''} fastighetsmÃ¤klare`;
    const googleResult = await simulateGoogleSearch(searchQuery);
    if (googleResult && await validateWebsite(googleResult)) {
      return googleResult;
    }
  }
  
  return null;
}

// Generate possible website patterns for companies under a brand
function generateBrandWebsitePatterns(company, brand) {
  const patterns = [];
  const brandDomain = brand.website ? new URL(brand.website).hostname.replace('www.', '') : null;
  
  if (!brandDomain) return patterns;
  
  const companySlug = cleanCompanyName(company.namn)
    .replace(brand.namn.toLowerCase(), '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  const citySlug = company.stad ? company.stad.toLowerCase()
    .replace(/Ã¥/g, 'a').replace(/Ã¤/g, 'a').replace(/Ã¶/g, 'o')
    .replace(/\s+/g, '-') : '';
  
  // Common patterns for franchise/chain websites
  if (citySlug) {
    patterns.push(`https://${brandDomain}/${citySlug}`);
    patterns.push(`https://${citySlug}.${brandDomain}`);
    patterns.push(`https://www.${brandDomain}/${citySlug}`);
  }
  
  if (companySlug) {
    patterns.push(`https://${brandDomain}/${companySlug}`);
    patterns.push(`https://${companySlug}.${brandDomain}`);
  }
  
  // ERA-specific patterns
  if (brandDomain.includes('era')) {
    patterns.push(`https://www.era.se/kontor/${citySlug || companySlug}`);
    patterns.push(`https://era.se/${citySlug || companySlug}`);
  }
  
  // Svensk FastighetsfÃ¶rmedling patterns
  if (brandDomain.includes('svenskfast')) {
    patterns.push(`https://www.svenskfast.se/kontor/${citySlug || companySlug}`);
  }
  
  // MÃ¤klarhuset patterns
  if (brandDomain.includes('maklarhuset')) {
    patterns.push(`https://www.maklarhuset.se/kontor/${citySlug || companySlug}`);
  }
  
  return patterns;
}

// Simulate Google search (in production, use Google Custom Search API)
async function simulateGoogleSearch(query) {
  // This would be a real API call in production
  // For now, generate a likely URL based on the query
  const words = query.toLowerCase().split(' ').filter(w => w.length > 3);
  
  // Try to build a domain from company name
  const companyWord = words.find(w => !['fastighetsmÃ¤klare', 'mÃ¤klare', 'fastighet'].includes(w));
  if (companyWord) {
    const domain = `https://www.${companyWord}.se`;
    return domain;
  }
  
  return null;
}

// Validate if a website exists and is accessible
async function validateWebsite(url) {
  if (!url) return false;
  
  try {
    // In production, you would do a HEAD request to check if site exists
    // For demo, we'll do basic validation
    const urlObj = new URL(url);
    
    // Check if it's a real-looking domain
    if (!urlObj.hostname.includes('.')) return false;
    
    // Simulate validation (in production: const response = await fetch(url, {method: 'HEAD'}))
    // For demo, return true for well-formed URLs
    return true;
  } catch {
    return false;
  }
}

// Lookup company by organization number
async function lookupByOrgNumber(orgNumber, sources) {
  // Clean org number
  const cleanedOrg = orgNumber.replace(/\D/g, '');
  if (cleanedOrg.length !== 10) return null;
  
  const data = {
    phone: null,
    email: null,
    website: null,
    address: null,
    postalCode: null,
    city: null
  };
  
  // In production, this would call real APIs:
  // - Bolagsverket API (official company registry)
  // - Allabolag.se API
  // - UC API (credit information)
  
  // For demo, we'll simulate finding data based on org number
  // Real implementation would look like:
  /*
  if (sources.bolagsverket) {
    const response = await fetch(`https://data.bolagsverket.se/api/v1/company/${cleanedOrg}`);
    const companyData = await response.json();
    data.address = companyData.registeredAddress?.street;
    data.postalCode = companyData.registeredAddress?.postalCode;
    data.city = companyData.registeredAddress?.city;
  }
  
  if (sources.allabolag) {
    const response = await fetch(`https://www.allabolag.se/api/companies/${cleanedOrg}`);
    const companyData = await response.json();
    data.phone = companyData.phone;
    data.email = companyData.email;
    data.website = companyData.website;
  }
  */
  
  return data;
}

// Search Google Places for the company
async function searchGooglePlaces(company, sources) {
  // In production, use Google Places API:
  /*
  const query = `${company.namn} ${company.stad || ''} Sverige`;
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=formatted_phone_number,website,formatted_address&key=YOUR_API_KEY`
  );
  const data = await response.json();
  
  if (data.candidates && data.candidates.length > 0) {
    const place = data.candidates[0];
    return {
      phone: place.formatted_phone_number,
      website: place.website,
      address: place.formatted_address
    };
  }
  */
  
  return null;
}

// Scrape website for contact information
async function scrapeWebsiteForContacts(url) {
  const contacts = {
    phone: null,
    email: null,
    address: null
  };
  
  // In production, you would:
  // 1. Fetch the website HTML
  // 2. Parse it with a library like cheerio or jsdom
  // 3. Look for contact patterns
  
  /*
  const response = await fetch(url);
  const html = await response.text();
  const dom = new DOMParser().parseFromString(html, 'text/html');
  
  // Extract phone numbers (Swedish patterns)
  const phoneRegex = /(?:(?:\+46|0)\s*(?:7[0-9]|[1-9][0-9])\s*[\d\s\-]{7,})/g;
  const phones = html.match(phoneRegex);
  if (phones && phones.length > 0) {
    contacts.phone = phones[0].replace(/\s+/g, ' ').trim();
  }
  
  // Extract emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = html.match(emailRegex);
  if (emails && emails.length > 0) {
    // Prefer info@, kontakt@, or company-specific emails
    const preferredEmail = emails.find(e => 
      e.startsWith('info@') || 
      e.startsWith('kontakt@') || 
      e.startsWith('mail@')
    ) || emails[0];
    contacts.email = preferredEmail;
  }
  
  // Extract address from contact page or footer
  const addressKeywords = ['besÃ¶ksadress', 'postadress', 'adress', 'address'];
  // Look for address patterns near these keywords
  */
  
  return contacts;
}

// Infer contact info from brand patterns
async function inferFromBrand(company, brand, sources) {
  const data = {
    website: null,
    email: null
  };
  
  // If brand has a website pattern, generate company-specific URL
  if (brand.website) {
    const patterns = generateBrandWebsitePatterns(company, brand);
    for (const url of patterns) {
      if (await validateWebsite(url)) {
        data.website = url;
        break;
      }
    }
  }
  
  // Generate email based on brand domain and company name
  if (brand.website && !data.email) {
    const domain = new URL(brand.website).hostname.replace('www.', '');
    const citySlug = company.stad ? cleanCompanyName(company.stad) : '';
    
    if (citySlug) {
      // Common patterns: malmo@era.se, info.malmo@svenskfast.se
      const emailPatterns = [
        `${citySlug}@${domain}`,
        `info.${citySlug}@${domain}`,
        `kontor.${citySlug}@${domain}`
      ];
      
      data.email = emailPatterns[0]; // Pick first pattern as most likely
    }
  }
  
  return data;
}

async function enrichAgentData(agent, sources) {
  const data = {
    email: null,
    phone: null
  };
  
  try {
    const companyData = AppState.companies.find(c => c.id === agent.companyId);
    
    if (!companyData) return data;
    
    // PRIORITY 1: If company belongs to a chain, look for agent on the office page
    if (companyData.brandId && sources.website) {
      const brand = AppState.brands.find(b => b.id === companyData.brandId);
      
      if (brand && brand.website) {
        // Find the office page first
        const officePage = await findOfficePageOnBrandSite(companyData, brand, sources);
        
        if (officePage.url) {
          // Search for this specific agent on the office page
          const agentInfo = await findAgentOnOfficePage(agent, officePage.url);
          if (agentInfo.email) data.email = agentInfo.email;
          if (agentInfo.phone) data.phone = agentInfo.phone;
        }
      }
    }
    
    // PRIORITY 2: Search on company's own website if it exists
    if (!data.email && companyData.website && sources.website) {
      const agentInfo = await findAgentOnWebsite(agent, companyData.website);
      if (agentInfo.email) data.email = agentInfo.email;
      if (agentInfo.phone) data.phone = agentInfo.phone;
    }
    
    // PRIORITY 3: Generate professional email from company domain
    if (!data.email && companyData.website) {
      data.email = generateProfessionalEmail(agent, companyData);
    }
    
    // PRIORITY 4: If company has email pattern, derive agent's email
    if (!data.email && companyData.email) {
      const domain = companyData.email.split('@')[1];
      if (domain) {
        const firstName = cleanUrlSlug(agent.fÃ¶rnamn);
        const lastName = cleanUrlSlug(agent.efternamn);
        
        // Most common pattern for Swedish real estate
        data.email = `${firstName}.${lastName}@${domain}`;
      }
    }
    
    // PRIORITY 5: Use company phone as fallback
    if (!data.phone && companyData.telefon) {
      data.phone = companyData.telefon;
    }
    
    // PRIORITY 6: Search LinkedIn (in production, use LinkedIn API)
    if (sources.google && (!data.email || !data.phone)) {
      const linkedInData = await searchLinkedIn(agent, companyData);
      if (linkedInData.email && !data.email) data.email = linkedInData.email;
      if (linkedInData.phone && !data.phone) data.phone = linkedInData.phone;
    }
    
  } catch (error) {
    console.error('Error enriching agent:', error);
  }
  
  return data;
}

// Find specific agent on an office page
async function findAgentOnOfficePage(agent, officeUrl) {
  const info = {
    email: null,
    phone: null,
    title: null,
    image: null
  };
  
  // In production, fetch and parse the office page
  /*
  const response = await fetch(officeUrl);
  const html = await response.text();
  const dom = new DOMParser().parseFromString(html, 'text/html');
  
  const fullName = `${agent.fÃ¶rnamn} ${agent.efternamn}`;
  const nameLower = fullName.toLowerCase();
  
  // Strategy 1: Look for agent cards/sections
  const agentSections = dom.querySelectorAll('.employee, .agent, .broker, .medarbetare, [class*="team-member"]');
  
  for (const section of agentSections) {
    const sectionText = section.textContent.toLowerCase();
    
    // Check if this section contains the agent's name
    if (sectionText.includes(nameLower) || 
        sectionText.includes(agent.fÃ¶rnamn.toLowerCase()) && sectionText.includes(agent.efternamn.toLowerCase())) {
      
      // Found the agent! Extract contact info
      const emailLink = section.querySelector('a[href^="mailto:"]');
      if (emailLink) {
        info.email = emailLink.getAttribute('href').replace('mailto:', '').split('?')[0];
      }
      
      const phoneLink = section.querySelector('a[href^="tel:"]');
      if (phoneLink) {
        info.phone = phoneLink.getAttribute('href').replace('tel:', '').replace(/\s+/g, ' ').trim();
      }
      
      // Extract from text if links not found
      if (!info.email) {
        const emailMatch = section.textContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) info.email = emailMatch[0];
      }
      
      if (!info.phone) {
        const phoneMatch = section.textContent.match(/(?:\+46|0)\s*(?:7[0-9]|[1-9][0-9])\s*[\d\s\-]{7,}/);
        if (phoneMatch) info.phone = phoneMatch[0].replace(/\s+/g, ' ').trim();
      }
      
      // Extract title
      const titleEl = section.querySelector('.title, .role, [class*="title"]');
      if (titleEl) info.title = titleEl.textContent.trim();
      
      // Extract image
      const imgEl = section.querySelector('img');
      if (imgEl) info.image = imgEl.getAttribute('src');
      
      break;
    }
  }
  
  // Strategy 2: Look in structured data (JSON-LD)
  const jsonLdScripts = dom.querySelectorAll('script[type="application/ld+json"]');
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent);
      
      if (data['@type'] === 'Person' || 
          (Array.isArray(data) && data.some(d => d['@type'] === 'Person'))) {
        
        const people = Array.isArray(data) ? data : [data];
        
        for (const person of people) {
          if (person.name && person.name.toLowerCase().includes(nameLower)) {
            if (person.email && !info.email) info.email = person.email;
            if (person.telephone && !info.phone) info.phone = person.telephone;
            if (person.jobTitle && !info.title) info.title = person.jobTitle;
            if (person.image && !info.image) info.image = person.image;
            break;
          }
        }
      }
    } catch {}
  }
  */
  
  return info;
}

// Find agent contact information on company website
async function findAgentOnWebsite(agent, websiteUrl) {
  const info = {
    email: null,
    phone: null
  };
  
  // In production, this would:
  // 1. Fetch the company website
  // 2. Look for /medarbetare, /kontakt, /team, /broker pages
  // 3. Search for agent's name
  // 4. Extract contact info near their name
  
  /*
  const response = await fetch(websiteUrl);
  const html = await response.text();
  
  // Common URLs for broker lists
  const brokerPages = [
    `${websiteUrl}/medarbetare`,
    `${websiteUrl}/maklare`,
    `${websiteUrl}/kontakt`,
    `${websiteUrl}/team`,
    `${websiteUrl}/om-oss`
  ];
  
  for (const pageUrl of brokerPages) {
    try {
      const pageResponse = await fetch(pageUrl);
      const pageHtml = await pageResponse.text();
      
      // Look for agent's name
      const fullName = `${agent.fÃ¶rnamn} ${agent.efternamn}`;
      if (pageHtml.toLowerCase().includes(fullName.toLowerCase())) {
        // Find email and phone near the name
        const section = extractSectionWithName(pageHtml, fullName);
        
        const emailMatch = section.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) info.email = emailMatch[0];
        
        const phoneMatch = section.match(/(?:(?:\+46|0)\s*(?:7[0-9]|[1-9][0-9])\s*[\d\s\-]{7,})/);
        if (phoneMatch) info.phone = phoneMatch[0].replace(/\s+/g, ' ').trim();
        
        break;
      }
    } catch (err) {
      // Page doesn't exist, continue
    }
  }
  */
  
  return info;
}

// Generate professional email based on common patterns
function generateProfessionalEmail(agent, company) {
  if (!company.website) return null;
  
  try {
    const domain = new URL(company.website).hostname.replace('www.', '');
    const firstName = agent.fÃ¶rnamn.toLowerCase()
      .replace(/Ã¥/g, 'a').replace(/Ã¤/g, 'a').replace(/Ã¶/g, 'o')
      .replace(/[^a-z]/g, '');
    const lastName = agent.efternamn.toLowerCase()
      .replace(/Ã¥/g, 'a').replace(/Ã¤/g, 'a').replace(/Ã¶/g, 'o')
      .replace(/[^a-z]/g, '');
    
    // Most common pattern in Swedish real estate: firstname.lastname@domain
    return `${firstName}.${lastName}@${domain}`;
  } catch {
    return null;
  }
}

// Search LinkedIn for agent (in production, use LinkedIn API)
async function searchLinkedIn(agent, company) {
  const data = {
    email: null,
    phone: null
  };
  
  // In production, use LinkedIn API or Sales Navigator:
  /*
  const query = `${agent.fÃ¶rnamn} ${agent.efternamn} ${company?.namn || ''} fastighetsmÃ¤klare`;
  const response = await fetch(`https://api.linkedin.com/v2/people?q=${encodeURIComponent(query)}`);
  const profiles = await response.json();
  
  if (profiles.elements && profiles.elements.length > 0) {
    const profile = profiles.elements[0];
    
    // LinkedIn often shows contact info for premium users
    if (profile.emailAddress) {
      data.email = profile.emailAddress;
    }
    
    if (profile.phoneNumbers && profile.phoneNumbers.length > 0) {
      data.phone = profile.phoneNumbers[0].number;
    }
  }
  */
  
  return data;
}

// Enrich brand/chain data
async function enrichBrandData(brand, sources) {
  const data = {
    website: null,
    phone: null,
    email: null,
    headquarters: null
  };
  
  try {
    // Known Swedish real estate brands and their info
    const knownBrands = {
      'era': {
        website: 'https://www.era.se',
        phone: '08-410 651 00',
        email: 'info@era.se',
        headquarters: 'Stockholm'
      },
      'svensk fastighetsfÃ¶rmedling': {
        website: 'https://www.svenskfast.se',
        phone: '08-400 22 500',
        email: 'info@svenskfast.se',
        headquarters: 'Stockholm'
      },
      'mÃ¤klarhuset': {
        website: 'https://www.maklarhuset.se',
        phone: '08-695 57 00',
        email: 'info@maklarhuset.se',
        headquarters: 'Stockholm'
      },
      'fastighetsbyrÃ¥n': {
        website: 'https://www.fastighetsbyran.com',
        phone: '08-407 01 00',
        email: 'info@fastighetsbyran.se',
        headquarters: 'Stockholm'
      },
      'notar': {
        website: 'https://www.notar.se',
        phone: '08-400 29 400',
        email: 'info@notar.se',
        headquarters: 'Stockholm'
      },
      'lÃ¤nsfÃ¶rsÃ¤kringar fastighetsfÃ¶rmedling': {
        website: 'https://www.lansfast.se',
        phone: '08-588 400 00',
        email: 'info@lansfast.se',
        headquarters: 'Stockholm'
      },
      'husman hagberg': {
        website: 'https://www.husmanhagberg.se',
        phone: '08-120 116 00',
        email: 'info@husmanhagberg.se',
        headquarters: 'GÃ¶teborg'
      },
      'bjurfors': {
        website: 'https://www.bjurfors.se',
        phone: '031-81 86 00',
        email: 'info@bjurfors.se',
        headquarters: 'GÃ¶teborg'
      },
      'skandiamÃ¤klarna': {
        website: 'https://www.skandiamaklarna.se',
        phone: '08-522 088 00',
        email: 'info@skandiamaklarna.se',
        headquarters: 'Stockholm'
      },
      'hemverket': {
        website: 'https://www.hemverket.se',
        phone: '08-508 910 00',
        email: 'info@hemverket.se',
        headquarters: 'Stockholm'
      }
    };
    
    // Check if brand name matches known brands
    const brandNameLower = brand.namn.toLowerCase();
    for (const [key, value] of Object.entries(knownBrands)) {
      if (brandNameLower.includes(key)) {
        if (!data.website) data.website = value.website;
        if (!data.phone) data.phone = value.phone;
        if (!data.email) data.email = value.email;
        if (!data.headquarters) data.headquarters = value.headquarters;
        break;
      }
    }
    
    // If not found in known brands, try to search
    if (!data.website && sources.google) {
      const searchQuery = `${brand.namn} fastighetsmÃ¤klare huvudkontor Sverige`;
      const searchResult = await simulateGoogleSearch(searchQuery);
      if (searchResult) data.website = searchResult;
    }
    
    // If we have a website, try to scrape contact info
    if (data.website && sources.website) {
      const contactInfo = await scrapeWebsiteForContacts(data.website);
      if (contactInfo.phone && !data.phone) data.phone = contactInfo.phone;
      if (contactInfo.email && !data.email) data.email = contactInfo.email;
    }
    
    // Generate email from website if not found
    if (data.website && !data.email) {
      try {
        const domain = new URL(data.website).hostname.replace('www.', '');
        data.email = `info@${domain}`;
      } catch {}
    }
    
  } catch (error) {
    console.error('Error enriching brand:', error);
  }
  
  return data;
}

// Helper functions
function generateRealisticPhone() {
  const areaCodes = ['08', '031', '040', '046', '010', '0771'];
  const area = areaCodes[Math.floor(Math.random() * areaCodes.length)];
  const number = Math.floor(Math.random() * 900000) + 100000;
  return `${area}-${number}`;
}

function generateWebsiteFromName(name) {
  const cleaned = cleanCompanyName(name);
  return `https://www.${cleaned}.se`;
}

function cleanCompanyName(name) {
  return name
    .toLowerCase()
    .replace(/\s+ab$/i, '')
    .replace(/\s+aktiebolag$/i, '')
    .replace(/[Ã¥Ã¤]/g, 'a')
    .replace(/Ã¶/g, 'o')
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 30);
}

// --- GDPR & Security Features ---

// GDPR Compliance Menu
async function openGDPRMenu() {
  const isAdmin = currentUser()?.roll === 'admin';
  
  modal.show(`
    <h3>ðŸ”’ GDPR & Dataskydd</h3>
    <div class="muted" style="margin-bottom:16px;">
      Hantera personuppgifter enligt GDPR-reglerna
    </div>
    
    <div class="panel" style="margin-bottom:12px;">
      <div class="panel-header">
        <h3>Dina rÃ¤ttigheter</h3>
      </div>
      <div style="padding:12px; display:flex; flex-direction:column; gap:8px;">
        <button class="secondary" onclick="exportMyData()">ðŸ“¥ Exportera min data (Dataportabilitet)</button>
        <button class="secondary" onclick="viewAuditLog()">ðŸ“‹ Visa Ã¥tkomstlogg</button>
        ${isAdmin ? '<button class="secondary" onclick="viewDataRetention()">ðŸ“… Datalagring & arkivering</button>' : ''}
        ${isAdmin ? '<button class="secondary" onclick="viewBackups()">ðŸ’¾ Backuper</button>' : ''}
        <button class="danger" onclick="requestDataDeletion()">ðŸ—‘ï¸ Radera min data (RÃ¤tten att bli glÃ¶md)</button>
      </div>
    </div>
    
    ${isAdmin ? `
    <div class="panel">
      <div class="panel-header">
        <h3>Admin: SÃ¤kerhet & Compliance</h3>
      </div>
      <div style="padding:12px; display:flex; flex-direction:column; gap:8px;">
        <button class="secondary" onclick="viewFullAuditLog()">ðŸ“Š Full revisionslogg</button>
        <button class="secondary" onclick="createBackup()">ðŸ’¾ Skapa backup nu</button>
        <button class="secondary" onclick="viewSecuritySettings()">âš™ï¸ SÃ¤kerhetsinstÃ¤llningar</button>
      </div>
    </div>
    
    <div class="panel">
      <div class="panel-header">
        <h3>Admin: Integrationer & AnvÃ¤ndarhantering</h3>
      </div>
      <div style="padding:12px; display:flex; flex-direction:column; gap:8px;">
        <button class="primary" onclick="console.log('Visma button clicked'); modal.hide(); setTimeout(() => vismaIntegration.showConfiguration(), 100)">ðŸ”— Visma.net Integration</button>
        <button class="primary" onclick="console.log('Dual user button clicked'); modal.hide(); setTimeout(() => dualUserManager.showDualUserManagement(), 100)">ðŸ‘¥ Hybrid AnvÃ¤ndarhantering</button>
      </div>
    </div>
    ` : ''}
    
    <div style="margin-top:16px; display:flex; gap:8px; justify-content:flex-end;">
      <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
    </div>
  `);
}

async function exportMyData() {
  try {
    const response = await fetch(`${API_BASE}/api/gdpr/export`, {
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `min-crm-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showNotification('Din data har exporterats!', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showNotification('Export misslyckades', 'danger');
  }
}

async function viewAuditLog() {
  try {
    const userId = currentUser()?.id;
    const response = await fetch(`${API_BASE}/api/gdpr/audit-log?userId=${userId}&limit=100`, {
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('Failed to fetch audit log');
    
    const data = await response.json();
    const entries = data.entries || [];
    
    modal.show(`
      <h3>ðŸ“‹ Min Ã¥tkomstlogg</h3>
      <div class="muted" style="margin-bottom:16px;">
        Senaste 100 aktiviteterna pÃ¥ ditt konto
      </div>
      
      <div class="list" style="max-height:400px; overflow:auto;">
        ${entries.length > 0 ? entries.map(e => `
          <div class="list-item">
            <div>
              <div class="title">${e.action || e.type}</div>
              <div class="subtitle">
                ${new Date(e.ts).toLocaleString('sv-SE')}
                ${e.entityType ? ` Â· ${e.entityType}` : ''}
                ${e.details ? ` Â· ${JSON.stringify(e.details)}` : ''}
              </div>
            </div>
          </div>
        `).join('') : '<div class="muted">Ingen aktivitet Ã¤nnu</div>'}
      </div>
      
      <div style="margin-top:16px; display:flex; gap:8px; justify-content:flex-end;">
        <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
      </div>
    `);
  } catch (error) {
    console.error('Audit log error:', error);
    showNotification('Kunde inte hÃ¤mta logg', 'danger');
  }
}

async function viewFullAuditLog() {
  try {
    const response = await fetch(`${API_BASE}/api/gdpr/audit-log?limit=500`, {
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('Failed to fetch audit log');
    
    const data = await response.json();
    const entries = data.entries || [];
    
    modal.show(`
      <h3>ðŸ“Š Full revisionslogg (Admin)</h3>
      <div class="muted" style="margin-bottom:16px;">
        ${entries.length} hÃ¤ndelser (senaste 500)
      </div>
      
      <div class="field">
        <input type="text" id="auditSearch" placeholder="SÃ¶k i loggen..." onkeyup="filterAuditLog()" />
      </div>
      
      <div class="list" id="auditLogList" style="max-height:500px; overflow:auto;">
        ${entries.map((e, i) => `
          <div class="list-item audit-entry" data-entry='${JSON.stringify(e).replace(/'/g, "&apos;")}'>
            <div>
              <div class="title">${e.action || e.type} ${e.userId ? `(User: ${e.userId})` : ''}</div>
              <div class="subtitle">
                ${new Date(e.ts).toLocaleString('sv-SE')}
                ${e.entityType ? ` Â· ${e.entityType}` : ''}
                ${e.entityId ? ` Â· ID: ${e.entityId}` : ''}
                ${e.ip ? ` Â· IP: ${e.ip}` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div style="margin-top:16px; display:flex; gap:8px; justify-content:flex-end;">
        <button class="primary" onclick="exportAuditLog()">ðŸ“¥ Exportera logg</button>
        <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
      </div>
    `);
  } catch (error) {
    console.error('Audit log error:', error);
    showNotification('Kunde inte hÃ¤mta logg', 'danger');
  }
}

function filterAuditLog() {
  const search = document.getElementById('auditSearch').value.toLowerCase();
  const entries = document.querySelectorAll('.audit-entry');
  
  entries.forEach(entry => {
    const data = entry.dataset.entry.toLowerCase();
    entry.style.display = data.includes(search) ? '' : 'none';
  });
}

async function exportAuditLog() {
  try {
    const response = await fetch(`${API_BASE}/api/gdpr/audit-log`, {
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showNotification('Revisionslogg exporterad!', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showNotification('Export misslyckades', 'danger');
  }
}

async function viewDataRetention() {
  try {
    const response = await fetch(`${API_BASE}/api/gdpr/retention-report`, {
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('Failed to fetch retention report');
    
    const report = await response.json();
    const total = report.expiredData.agents.length + report.expiredData.companies.length;
    
    modal.show(`
      <h3>ðŸ“… Datalagring & arkivering</h3>
      <div class="muted" style="margin-bottom:16px;">
        Enligt GDPR ska personuppgifter inte lagras lÃ¤ngre Ã¤n nÃ¶dvÃ¤ndigt
      </div>
      
      <div class="panel" style="margin-bottom:12px;">
        <div class="panel-header">
          <h3>Lagringstid: ${report.retentionPeriodMonths} mÃ¥nader</h3>
        </div>
        <div style="padding:12px;">
          <div>AvskÃ¤rningsdatum: ${new Date(report.cutoffDate).toLocaleDateString('sv-SE')}</div>
          <div style="margin-top:8px;">
            <strong>${total} poster</strong> Ã¤r Ã¤ldre Ã¤n ${report.retentionPeriodMonths} mÃ¥nader
          </div>
        </div>
      </div>
      
      <div class="panel" style="margin-bottom:12px;">
        <div class="panel-header">
          <h3>UtgÃ¥ngen data</h3>
        </div>
        <div style="padding:12px;">
          <ul style="margin:0; padding-left:20px;">
            <li>MÃ¤klare: ${report.expiredData.agents.length} st</li>
            <li>FÃ¶retag: ${report.expiredData.companies.length} st</li>
            <li>Kunder: ${report.expiredData.customers.length} st</li>
          </ul>
        </div>
      </div>
      
      ${total > 0 ? `
      <div class="panel warning" style="margin-bottom:12px;">
        <div style="padding:12px;">
          <strong>âš ï¸ Varning:</strong> Gammal data bÃ¶r arkiveras eller raderas enligt GDPR.
        </div>
      </div>
      ` : ''}
      
      <div style="margin-top:16px; display:flex; gap:8px; justify-content:flex-end;">
        ${total > 0 ? '<button class="primary" onclick="archiveOldData(false)">ðŸ—„ï¸ Arkivera gammal data</button>' : ''}
        <button class="secondary" onclick="archiveOldData(true)">ðŸ” TestkÃ¶ra arkivering</button>
        <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
      </div>
    `);
  } catch (error) {
    console.error('Retention report error:', error);
    showNotification('Kunde inte hÃ¤mta rapport', 'danger');
  }
}

async function archiveOldData(dryRun) {
  try {
    const response = await fetch(`${API_BASE}/api/gdpr/archive-old-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ months: 24, dryRun })
    });
    
    if (!response.ok) throw new Error('Archive failed');
    
    const result = await response.json();
    
    if (dryRun) {
      showNotification(`TestkÃ¶ring: ${result.archived.agents + result.archived.companies} poster skulle arkiveras`, 'info');
    } else {
      showNotification(`${result.archived.agents + result.archived.companies} poster arkiverade!`, 'success');
      await loadState(); // Reload data
    }
  } catch (error) {
    console.error('Archive error:', error);
    showNotification('Arkivering misslyckades', 'danger');
  }
}

async function requestDataDeletion() {
  const confirmed = confirm(
    'âš ï¸ VARNING: Detta raderar ALL din data permanent enligt GDPR:s "rÃ¤tt att bli glÃ¶md".\n\n' +
    'Detta inkluderar:\n' +
    '- Ditt anvÃ¤ndarkonto\n' +
    '- All data du skapat\n' +
    '- Din inloggning (du loggas ut)\n\n' +
    'Data anonymiseras dÃ¤r den inte kan raderas.\n\n' +
    'Ã„r du HELT SÃ„KER?'
  );
  
  if (!confirmed) return;
  
  const doubleCheck = prompt('Skriv "RADERA MIN DATA" fÃ¶r att bekrÃ¤fta:');
  if (doubleCheck !== 'RADERA MIN DATA') {
    showNotification('Radering avbruten', 'info');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/gdpr/delete-user-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ confirmDelete: true })
    });
    
    if (!response.ok) throw new Error('Deletion failed');
    
    showNotification('Din data har raderats. Du loggas ut...', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  } catch (error) {
    console.error('Deletion error:', error);
    showNotification('Radering misslyckades', 'danger');
  }
}

async function viewBackups() {
  try {
    const response = await fetch(`${API_BASE}/api/backup/list`, {
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('Failed to fetch backups');
    
    const data = await response.json();
    const backups = data.backups || [];
    
    modal.show(`
      <h3>ðŸ’¾ Backuper</h3>
      <div class="muted" style="margin-bottom:16px;">
        ${backups.length} backuper tillgÃ¤ngliga
      </div>
      
      <div class="list" style="max-height:400px; overflow:auto;">
        ${backups.length > 0 ? backups.map(b => `
          <div class="list-item">
            <div>
              <div class="title">${b.filename}</div>
              <div class="subtitle">
                Skapad: ${new Date(b.created).toLocaleString('sv-SE')}
                Â· Storlek: ${(b.size / 1024).toFixed(2)} KB
              </div>
            </div>
            <button class="secondary" onclick="restoreBackup('${b.filename}')">Ã…terstÃ¤ll</button>
          </div>
        `).join('') : '<div class="muted">Inga backuper Ã¤nnu</div>'}
      </div>
      
      <div style="margin-top:16px; display:flex; gap:8px; justify-content:flex-end;">
        <button class="primary" onclick="createBackup()">ðŸ’¾ Skapa ny backup</button>
        <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
      </div>
    `);
  } catch (error) {
    console.error('Backups error:', error);
    showNotification('Kunde inte hÃ¤mta backuper', 'danger');
  }
}

async function createBackup() {
  try {
    const response = await fetch(`${API_BASE}/api/backup/create`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) throw new Error('Backup failed');
    
    const result = await response.json();
    showNotification(`Backup skapad: ${result.backupFile}`, 'success');
    
    // Refresh backup list if modal is open
    if (modal.isOpen) {
      viewBackups();
    }
  } catch (error) {
    console.error('Backup error:', error);
    showNotification('Backup misslyckades', 'danger');
  }
}

async function restoreBackup(filename) {
  const confirmed = confirm(
    `âš ï¸ VARNING: Detta Ã¥terstÃ¤ller systemet till backupen:\n\n${filename}\n\n` +
    'All nuvarande data kommer att ersÃ¤ttas!\n' +
    'En backup av nuvarande data skapas fÃ¶rst.\n\n' +
    'FortsÃ¤tt?'
  );
  
  if (!confirmed) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/backup/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ filename })
    });
    
    if (!response.ok) throw new Error('Restore failed');
    
    showNotification('Backup Ã¥terstÃ¤lld! Laddar om...', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  } catch (error) {
    console.error('Restore error:', error);
    showNotification('Ã…terstÃ¤llning misslyckades', 'danger');
  }
}

async function viewSecuritySettings() {
  modal.show(`
    <h3>âš™ï¸ SÃ¤kerhetsinstÃ¤llningar</h3>
    <div class="muted" style="margin-bottom:16px;">
      Konfigurera sÃ¤kerhets- och GDPR-instÃ¤llningar
    </div>
    
    <div class="panel" style="margin-bottom:12px;">
      <div class="panel-header">
        <h3>Session</h3>
      </div>
      <div style="padding:12px;">
        <div>
          <strong>Timeout:</strong> 30 minuter inaktivitet
        </div>
        <div>
          <strong>Varning:</strong> 5 minuter fÃ¶re timeout
        </div>
      </div>
    </div>
    
    <div class="panel" style="margin-bottom:12px;">
      <div class="panel-header">
        <h3>LÃ¶senord</h3>
      </div>
      <div style="padding:12px;">
        <div>
          <strong>Hashning:</strong> bcrypt (10 rounds)
        </div>
        <div>
          <strong>Ã„ldre lÃ¶senord:</strong> Uppgraderas automatiskt vid nÃ¤sta inloggning
        </div>
      </div>
    </div>
    
    <div class="panel" style="margin-bottom:12px;">
      <div class="panel-header">
        <h3>Datalagring</h3>
      </div>
      <div style="padding:12px;">
        <div>
          <strong>Standard lagringstid:</strong> 24 mÃ¥nader
        </div>
        <div>
          <strong>Automatisk arkivering:</strong> Inaktiverad (kÃ¶r manuellt)
        </div>
      </div>
    </div>
    
    <div class="panel" style="margin-bottom:12px;">
      <div class="panel-header">
        <h3>Revisionslogg</h3>
      </div>
      <div style="padding:12px;">
        <div>
          <strong>Status:</strong> Aktiv
        </div>
        <div>
          <strong>Loggas:</strong> Inloggningar, dataÃ¥tkomst, GDPR-hÃ¤ndelser
        </div>
      </div>
    </div>
    
    <div style="margin-top:16px; display:flex; gap:8px; justify-content:flex-end;">
      <button class="secondary" onclick="modal.hide()">StÃ¤ng</button>
    </div>
  `);
}

// ============================================================
// AZURE B2C USER MANAGEMENT FUNCTIONS
// ============================================================

/**
 * Azure B2C anvÃ¤ndare - extend AppState
 */
AppState.customers = AppState.customers || []; // Azure B2C customer users

/**
 * Ã–ppna modal fÃ¶r att hantera kunder
 */
function openManageCustomersModal() {
  const modal = document.getElementById('manageCustomersModal');
  modal.showModal();
  renderCustomersTable();
}

function closeManageCustomersModal() {
  const modal = document.getElementById('manageCustomersModal');
  modal.close();
}

/**
 * Ã–ppna modal fÃ¶r att skapa anvÃ¤ndare
 */
function openCreateUserModal() {
  // Populera fÃ¶retag i dropdown
  const companySelect = document.getElementById('userCompany');
  companySelect.innerHTML = '<option value="">VÃ¤lj fÃ¶retag...</option>';
  
  AppState.companies.forEach(company => {
    const option = document.createElement('option');
    option.value = company.id;
    option.textContent = company.namn;
    option.dataset.companyName = company.namn;
    companySelect.appendChild(option);
  });
  
  const modal = document.getElementById('createUserModal');
  modal.showModal();
}

function closeCreateUserModal() {
  const modal = document.getElementById('createUserModal');
  modal.close();
  document.getElementById('createUserForm').reset();
}

/**
 * Ã–ppna modal fÃ¶r att ge tjÃ¤nst
 */
function openGrantServiceModal(userId) {
  document.getElementById('grantServiceUserId').value = userId;
  const modal = document.getElementById('grantServiceModal');
  modal.showModal();
}

function closeGrantServiceModal() {
  const modal = document.getElementById('grantServiceModal');
  modal.close();
  document.getElementById('grantServiceForm').reset();
}

function closeUserDetailsModal() {
  const modal = document.getElementById('userDetailsModal');
  modal.close();
}

/**
 * Skapa ny anvÃ¤ndare i Azure B2C
 */
async function createUserInB2C(event) {
  event.preventDefault();
  
  const firstName = document.getElementById('userFirstName').value;
  const lastName = document.getElementById('userLastName').value;
  const email = document.getElementById('userEmail').value;
  const phone = document.getElementById('userPhone').value;
  const companySelect = document.getElementById('userCompany');
  const role = document.getElementById('userRole').value;
  const sendInviteEmail = document.getElementById('sendInviteEmail').checked;
  
  // HÃ¤mta valda tjÃ¤nster
  const services = Array.from(document.querySelectorAll('input[name="service"]:checked'))
    .map(cb => cb.value);
  
  // Company info
  const companyId = companySelect.value;
  const companyName = companySelect.options[companySelect.selectedIndex]?.dataset.companyName;
  
  try {
    showNotification('Skapar anvÃ¤ndare i Azure B2C...', 'info');
    
    const response = await fetch(`${API_BASE}/api/users/create-in-b2c`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        email,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        companyId,
        companyName,
        role,
        services,
        phone,
        sendInviteEmail
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create user');
    }
    
    const result = await response.json();
    
    // LÃ¤gg till i lokal state
    if (!AppState.customers) AppState.customers = [];
    AppState.customers.push(result.user);
    await saveState();
    
    // Visa meddelande
    let message = `AnvÃ¤ndare ${email} skapad!`;
    if (sendInviteEmail) {
      message += ' VÃ¤lkomstmail skickat.';
    } else if (result.temporaryPassword) {
      message += `\n\nTemporÃ¤rt lÃ¶senord: ${result.temporaryPassword}\n\nâš ï¸ Spara detta nu! Det visas inte igen.`;
      // Show password in alert for copy
      setTimeout(() => {
        alert(`AnvÃ¤ndare skapad!\n\nE-post: ${email}\nTemporÃ¤rt lÃ¶senord: ${result.temporaryPassword}\n\nâš ï¸ Spara detta lÃ¶senord nu! Det visas inte igen.`);
      }, 100);
    }
    
    showNotification(message, 'success');
    
    // StÃ¤ng modal och Ã¥terstÃ¤ll formulÃ¤r
    closeCreateUserModal();
    
    // Uppdatera anvÃ¤ndarlistan
    renderCustomersTable();
    
  } catch (error) {
    console.error('Failed to create user:', error);
    showNotification('Kunde inte skapa anvÃ¤ndare: ' + error.message, 'error');
  }
}

/**
 * Ge anvÃ¤ndare tillgÃ¥ng till tjÃ¤nst
 */
async function grantServiceAccess(event) {
  event.preventDefault();
  
  const userId = document.getElementById('grantServiceUserId').value;
  const serviceName = document.getElementById('grantServiceName').value;
  const expiresAt = document.getElementById('grantServiceExpiry').value || null;
  
  try {
    showNotification(`Ger tillgÃ¥ng till ${serviceName}...`, 'info');
    
    const response = await fetch(`${API_BASE}/api/users/${userId}/grant-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        serviceName,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to grant service access');
    }
    
    const result = await response.json();
    
    // Uppdatera lokal state
    const user = AppState.customers?.find(u => u.id === userId);
    if (user) {
      if (!user.services) user.services = [];
      user.services.push({
        name: serviceName,
        grantedAt: new Date().toISOString(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        active: true
      });
      await saveState();
    }
    
    showNotification(result.message || 'TjÃ¤nst tillagd!', 'success');
    closeGrantServiceModal();
    renderCustomersTable();
    
  } catch (error) {
    console.error('Failed to grant service:', error);
    showNotification('Kunde inte ge tillgÃ¥ng till tjÃ¤nst: ' + error.message, 'error');
  }
}

/**
 * Ta bort tillgÃ¥ng till tjÃ¤nst
 */
async function revokeServiceAccess(userId, serviceName) {
  if (!confirm(`Ã„r du sÃ¤ker pÃ¥ att du vill ta bort tillgÃ¥ng till ${serviceName}?`)) {
    return;
  }
  
  try {
    showNotification('Tar bort tjÃ¤nst...', 'info');
    
    const response = await fetch(`${API_BASE}/api/users/${userId}/revoke-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ serviceName })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to revoke service access');
    }
    
    const result = await response.json();
    
    // Uppdatera lokal state
    const user = AppState.customers?.find(u => u.id === userId);
    if (user && user.services) {
      user.services = user.services.filter(s => s.name !== serviceName);
      await saveState();
    }
    
    showNotification(result.message || 'TjÃ¤nst borttagen!', 'success');
    renderCustomersTable();
    
  } catch (error) {
    console.error('Failed to revoke service:', error);
    showNotification('Kunde inte ta bort tjÃ¤nst: ' + error.message, 'error');
  }
}

/**
 * Inaktivera anvÃ¤ndare
 */
async function disableUser(userId) {
  if (!confirm('Ã„r du sÃ¤ker pÃ¥ att du vill inaktivera denna anvÃ¤ndare?')) {
    return;
  }
  
  try {
    showNotification('Inaktiverar anvÃ¤ndare...', 'info');
    
    const response = await fetch(`${API_BASE}/api/users/${userId}/disable`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to disable user');
    }
    
    const result = await response.json();
    
    // Uppdatera lokal state
    const user = AppState.customers?.find(u => u.id === userId);
    if (user) {
      user.isActive = false;
      await saveState();
    }
    
    showNotification(result.message || 'AnvÃ¤ndare inaktiverad!', 'success');
    renderCustomersTable();
    
  } catch (error) {
    console.error('Failed to disable user:', error);
    showNotification('Kunde inte inaktivera anvÃ¤ndare: ' + error.message, 'error');
  }
}

/**
 * Aktivera anvÃ¤ndare
 */
async function enableUser(userId) {
  try {
    showNotification('Aktiverar anvÃ¤ndare...', 'info');
    
    const response = await fetch(`${API_BASE}/api/users/${userId}/enable`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to enable user');
    }
    
    const result = await response.json();
    
    // Uppdatera lokal state
    const user = AppState.customers?.find(u => u.id === userId);
    if (user) {
      user.isActive = true;
      await saveState();
    }
    
    showNotification(result.message || 'AnvÃ¤ndare aktiverad!', 'success');
    renderCustomersTable();
    
  } catch (error) {
    console.error('Failed to enable user:', error);
    showNotification('Kunde inte aktivera anvÃ¤ndare: ' + error.message, 'error');
  }
}

/**
 * Uppdatera anvÃ¤ndarroll
 */
async function updateUserRole(userId, newRole) {
  try {
    showNotification('Uppdaterar roll...', 'info');
    
    const response = await fetch(`${API_BASE}/api/users/${userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ role: newRole })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update role');
    }
    
    const result = await response.json();
    
    // Uppdatera lokal state
    const user = AppState.customers?.find(u => u.id === userId);
    if (user) {
      user.role = newRole;
      await saveState();
    }
    
    showNotification(result.message || 'Roll uppdaterad!', 'success');
    renderCustomersTable();
    
  } catch (error) {
    console.error('Failed to update role:', error);
    showNotification('Kunde inte uppdatera roll: ' + error.message, 'error');
  }
}

/**
 * Ã…terstÃ¤ll lÃ¶senord
 */
async function resetUserPassword(userId, sendEmail = true) {
  if (!confirm('Ã„r du sÃ¤ker pÃ¥ att du vill Ã¥terstÃ¤lla lÃ¶senordet fÃ¶r denna anvÃ¤ndare?')) {
    return;
  }
  
  try {
    showNotification('Ã…terstÃ¤ller lÃ¶senord...', 'info');
    
    const response = await fetch(`${API_BASE}/api/users/${userId}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ sendEmail })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reset password');
    }
    
    const result = await response.json();
    
    if (result.temporaryPassword) {
      // Visa lÃ¶senordet om det inte skickades via mail
      alert(`Nytt temporÃ¤rt lÃ¶senord:\n\n${result.temporaryPassword}\n\nâš ï¸ Spara detta nu! Det visas inte igen.`);
    } else {
      showNotification('LÃ¶senord Ã¥terstÃ¤llt och mail skickat till anvÃ¤ndaren', 'success');
    }
    
  } catch (error) {
    console.error('Failed to reset password:', error);
    showNotification('Kunde inte Ã¥terstÃ¤lla lÃ¶senord: ' + error.message, 'error');
  }
}

/**
 * Radera anvÃ¤ndare
 */
async function deleteUserConfirm(userId) {
  const user = AppState.customers?.find(u => u.id === userId);
  if (!user) return;
  
  const confirmed = confirm(
    `Ã„r du sÃ¤ker pÃ¥ att du vill radera ${user.email}?\n\n` +
    `Detta kommer att:\n` +
    `â€¢ Ta bort anvÃ¤ndaren frÃ¥n CRM\n` +
    `â€¢ Ta bort anvÃ¤ndaren frÃ¥n Azure B2C\n` +
    `â€¢ Denna Ã¥tgÃ¤rd kan INTE Ã¥ngras!\n\n` +
    `FortsÃ¤tt?`
  );
  
  if (!confirmed) return;
  
  try {
    showNotification('Raderar anvÃ¤ndare...', 'info');
    
    const response = await fetch(`${API_BASE}/api/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ deleteFromB2C: true })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }
    
    const result = await response.json();
    
    // Ta bort frÃ¥n lokal state
    if (AppState.customers) {
      AppState.customers = AppState.customers.filter(u => u.id !== userId);
      await saveState();
    }
    
    showNotification(result.message || 'AnvÃ¤ndare raderad!', 'success');
    renderCustomersTable();
    
  } catch (error) {
    console.error('Failed to delete user:', error);
    showNotification('Kunde inte radera anvÃ¤ndare: ' + error.message, 'error');
  }
}

/**
 * Rendera kundtabell
 */
function renderCustomersTable() {
  const tbody = document.getElementById('customersTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  // Filtrera baserat pÃ¥ search och filters
  const searchTerm = document.getElementById('customerSearch')?.value?.toLowerCase() || '';
  const roleFilter = document.getElementById('customerRoleFilter')?.value || 'all';
  const statusFilter = document.getElementById('customerStatusFilter')?.value || 'all';
  
  let customers = AppState.customers || [];
  
  // Apply filters
  if (searchTerm) {
    customers = customers.filter(c => 
      c.name?.toLowerCase().includes(searchTerm) ||
      c.email?.toLowerCase().includes(searchTerm) ||
      c.companyName?.toLowerCase().includes(searchTerm)
    );
  }
  
  if (roleFilter !== 'all') {
    customers = customers.filter(c => c.role === roleFilter);
  }
  
  if (statusFilter !== 'all') {
    const isActive = statusFilter === 'active';
    customers = customers.filter(c => c.isActive === isActive);
  }
  
  // Check current user role
  const currentUser = AppState.users.find(u => u.id === AppState.currentUserId);
  const isSales = currentUser?.roll === 'sales';
  const isManager = currentUser?.roll === 'manager';
  const isAdmin = currentUser?.roll === 'admin';
  
  customers.forEach(user => {
    const tr = document.createElement('tr');
    
    // Services badges with DaisyUI
    const servicesHtml = user.services?.map(s => {
      const isExpired = s.expiresAt && new Date(s.expiresAt) < new Date();
      const expiryText = s.expiresAt ? ` (utgÃ¥r: ${new Date(s.expiresAt).toLocaleDateString()})` : '';
      
      return `
        <span class="badge ${isExpired ? 'badge-error' : 'badge-success'} gap-2" 
              title="Beviljad: ${new Date(s.grantedAt).toLocaleDateString()}${expiryText}">
          ${escapeHTML(s.name)}
          ${(isManager || isAdmin) ? 
            `<button class="btn btn-ghost btn-xs btn-circle" onclick="revokeServiceAccess('${user.id}', '${escapeHTML(s.name)}')">Ã—</button>` : 
            ''}
        </span>
      `;
    }).join(' ') || '<span class="text-base-content/50">-</span>';
    
    tr.innerHTML = `
      <td class="font-medium">${escapeHTML(user.name || user.displayName || '-')}</td>
      <td>${escapeHTML(user.email)}</td>
      <td>${escapeHTML(user.companyName || '-')}</td>
      <td>
        <select class="select select-bordered select-sm" onchange="updateUserRole('${user.id}', this.value)" 
                ${!(isManager || isAdmin) ? 'disabled' : ''}>
          <option value="sales" ${user.role === 'sales' ? 'selected' : ''}>MÃ¤klare</option>
          <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </td>
      <td>
        <div class="flex flex-wrap gap-2">
          ${servicesHtml}
        </div>
      </td>
      <td>
        <span class="badge ${user.isActive !== false ? 'badge-success' : 'badge-ghost'}">
          ${user.isActive !== false ? 'Aktiv' : 'Inaktiv'}
        </span>
      </td>
      <td>
        <div class="flex justify-end gap-1">
          ${(isSales || isManager || isAdmin) ? `
            <button class="btn btn-sm btn-circle btn-primary" 
                    onclick="openGrantServiceModal('${user.id}')"
                    title="LÃ¤gg till tjÃ¤nst">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          ` : ''}
          
          ${(isManager || isAdmin) ? `
            ${user.isActive !== false ? 
              `<button class="btn btn-sm btn-circle btn-warning" 
                       onclick="disableUser('${user.id}')"
                       title="Inaktivera">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>` :
              `<button class="btn btn-sm btn-circle btn-success" 
                       onclick="enableUser('${user.id}')"
                       title="Aktivera">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>`
            }
            
            <button class="btn btn-sm btn-circle btn-ghost" 
                    onclick="resetUserPassword('${user.id}', true)"
                    title="Ã…terstÃ¤ll lÃ¶senord">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </button>
          ` : ''}
          
          ${isAdmin ? `
            <button class="btn btn-sm btn-circle btn-error" 
                    onclick="deleteUserConfirm('${user.id}')"
                    title="Radera">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          ` : ''}
        </div>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  // Show "no results" if empty
  if (customers.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="7" class="text-center py-8 text-base-content/50">Inga anvÃ¤ndare hittades</td>';
    tbody.appendChild(tr);
  }
}

/**
 * Escape HTML fÃ¶r sÃ¤kerhet
 */
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Visa notifikation
 */
function showNotification(message, type = 'info') {
  // Simple alert for now - can be replaced with toast notifications
  if (type === 'error') {
    alert('âŒ ' + message);
  } else if (type === 'success') {
    alert('âœ… ' + message);
  } else {
    alert('â„¹ï¸ ' + message);
  }
}

/**
 * Visa fÃ¤ltfel i modal
 */
function showFieldError(errorDiv, message) {
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.style.color = '#dc2626';
    errorDiv.style.fontSize = '14px';
    errorDiv.style.marginTop = '8px';
    errorDiv.style.padding = '8px 12px';
    errorDiv.style.backgroundColor = '#fef2f2';
    errorDiv.style.border = '1px solid #fecaca';
    errorDiv.style.borderRadius = '6px';
  }
}

/**
 * DÃ¶lj fÃ¤ltfel i modal
 */
function hideFieldError(errorDiv) {
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

/**
 * Visa framgÃ¥ngsmeddelande
 */
function showSuccessMessage(message) {
  const successDiv = document.createElement('div');
  successDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-size: 14px;
    font-weight: 500;
  `;
  successDiv.textContent = message;
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    successDiv.remove();
  }, 3000);
}

// ============================================
// DUAL USER MANAGEMENT
// ============================================

/**
 * Dual User Management fÃ¶r Azure B2C + Legacy System
 */
class DualUserManager {
  constructor() {
    this.stats = null;
    this.routingRules = null;
    this.migrationCandidates = [];
    
    this.loadStats();
    this.loadRoutingRules();
  }

  /**
   * Ladda statistik Ã¶ver dual accounts
   */
  async loadStats() {
    try {
      const response = await fetch('/api/users/dual-stats');
      if (response.ok) {
        this.stats = await response.json();
      }
    } catch (error) {
      console.error('Failed to load dual user stats:', error);
    }
  }

  /**
   * Ladda routing-regler
   */
  async loadRoutingRules() {
    try {
      const response = await fetch('/api/users/routing-rules');
      if (response.ok) {
        this.routingRules = await response.json();
      }
    } catch (error) {
      console.error('Failed to load routing rules:', error);
    }
  }

  /**
   * Visa dual user management interface
   */
  showDualUserManagement() {
    modal.show(`
      <div class="space-y-6">
        <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div class="flex items-center mb-2">
            <span class="text-blue-600 text-lg">ðŸ”„</span>
            <h3 class="text-lg font-medium text-blue-900 ml-2">Hybrid AnvÃ¤ndarhantering</h3>
          </div>
          <p class="text-blue-700 text-sm">
            Hantera anvÃ¤ndare i bÃ¥de moderna Azure B2C-system och legacy kundadminsystem.
            Automatisk routing baserat pÃ¥ tjÃ¤nstetyp och kundprofil.
          </p>
        </div>

        ${this.stats ? this.renderStats() : '<div class="text-gray-500">Laddar statistik...</div>'}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-4">
            <h3 class="text-lg font-medium">Skapa anvÃ¤ndarkonton</h3>
            
            <div class="space-y-3">
              <button onclick="dualUserManager.showCreateUserDialog()" class="btn btn-primary w-full">
                ðŸ†• Skapa anvÃ¤ndare fÃ¶r kund
              </button>
              
              <button onclick="dualUserManager.analyzeCustomerNeeds()" class="btn btn-secondary w-full">
                ðŸ” Analysera systemkrav
              </button>
              
              <button onclick="dualUserManager.showMigrationCandidates()" class="btn btn-secondary w-full">
                ðŸ“ˆ Visa migreringskandidater
              </button>
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="text-lg font-medium">Synkronisering & Migrering</h3>
            
            <div class="space-y-3">
              <button onclick="dualUserManager.syncAllAccounts()" class="btn btn-primary w-full">
                ðŸ”„ Synka alla konton
              </button>
              
              <button onclick="dualUserManager.bulkMigrateToAzure()" class="btn btn-secondary w-full">
                â¬†ï¸ Migrera till Azure B2C
              </button>
              
              <button onclick="dualUserManager.showRoutingRules()" class="btn btn-secondary w-full">
                âš™ï¸ Routing-regler
              </button>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t">
          <div class="flex justify-between items-center">
            <div class="text-sm text-gray-600">
              Senast synkroniserad: ${this.stats?.lastSync ? new Date(this.stats.lastSync).toLocaleString('sv-SE') : 'Aldrig'}
            </div>
            <button onclick="dualUserManager.refreshStats()" class="btn btn-secondary">
              ðŸ”„ Uppdatera
            </button>
          </div>
        </div>
      </div>
    `);
  }

  /**
   * Rendera statistik
   */
  renderStats() {
    if (!this.stats) return '';

    return `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-green-50 p-4 rounded-lg text-center">
          <div class="text-2xl font-bold text-green-600">${this.stats.total}</div>
          <div class="text-sm text-green-700">Total konton</div>
        </div>
        
        <div class="bg-blue-50 p-4 rounded-lg text-center">
          <div class="text-2xl font-bold text-blue-600">${this.stats.azureB2COnly}</div>
          <div class="text-sm text-blue-700">Azure B2C</div>
        </div>
        
        <div class="bg-yellow-50 p-4 rounded-lg text-center">
          <div class="text-2xl font-bold text-yellow-600">${this.stats.legacyOnly}</div>
          <div class="text-sm text-yellow-700">Legacy system</div>
        </div>
        
        <div class="bg-purple-50 p-4 rounded-lg text-center">
          <div class="text-2xl font-bold text-purple-600">${this.stats.dualAccounts}</div>
          <div class="text-sm text-purple-700">Hybrid konton</div>
        </div>
      </div>
    `;
  }

  /**
   * Visa dialog fÃ¶r att skapa anvÃ¤ndare
   */
  async showCreateUserDialog() {
    // HÃ¤mta alla kunder fÃ¶r dropdown
    const customers = state.customers || [];
    
    openModal('Skapa anvÃ¤ndarkonto', `
      <form id="createUserForm" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">VÃ¤lj kund</label>
          <select id="customerId" class="w-full border border-gray-300 rounded-md px-3 py-2" required>
            <option value="">-- VÃ¤lj kund --</option>
            ${customers.map(customer => `
              <option value="${customer.id}">${escapeHTML(customer.namn)}</option>
            `).join('')}
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">TjÃ¤nster</label>
          <div class="space-y-2" id="servicesContainer">
            <label class="flex items-center">
              <input type="checkbox" value="CRM_MODERN" class="mr-2">
              <span class="text-sm">Modern CRM</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" value="CRM_CLASSIC" class="mr-2">
              <span class="text-sm">Klassisk CRM</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" value="ANALYTICS_PLATFORM" class="mr-2">
              <span class="text-sm">Analysplattform</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" value="MOBILE_APP" class="mr-2">
              <span class="text-sm">Mobilapp</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" value="API_ACCESS" class="mr-2">
              <span class="text-sm">API-Ã¥tkomst</span>
            </label>
          </div>
        </div>
        
        <div id="systemAnalysis" class="hidden bg-gray-50 p-4 rounded-lg">
          <h4 class="font-medium text-gray-900 mb-2">Systemanalys</h4>
          <div id="analysisResult"></div>
        </div>
        
        <div class="flex justify-end space-x-3 pt-4">
          <button type="button" onclick="closeModal()" class="btn btn-secondary">Avbryt</button>
          <button type="button" id="analyzeBtn" class="btn btn-secondary">Analysera</button>
          <button type="submit" class="btn btn-primary">Skapa konton</button>
        </div>
      </form>
    `);
    
    // Event listeners
    setTimeout(() => {
      const form = document.getElementById('createUserForm');
      const analyzeBtn = document.getElementById('analyzeBtn');
      const customerId = document.getElementById('customerId');
      
      // Analysera systemkrav
      analyzeBtn.addEventListener('click', async () => {
        const selectedCustomerId = customerId.value;
        const selectedServices = Array.from(document.querySelectorAll('#servicesContainer input:checked'))
          .map(input => input.value);
        
        if (!selectedCustomerId || selectedServices.length === 0) {
          showNotification('VÃ¤lj kund och minst en tjÃ¤nst fÃ¶rst', 'error');
          return;
        }
        
        await this.analyzeSystemNeedsForCustomer(selectedCustomerId, selectedServices);
      });
      
      // Skapa anvÃ¤ndare
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const selectedCustomerId = customerId.value;
        const selectedServices = Array.from(document.querySelectorAll('#servicesContainer input:checked'))
          .map(input => input.value);
        
        if (!selectedCustomerId || selectedServices.length === 0) {
          showNotification('VÃ¤lj kund och minst en tjÃ¤nst', 'error');
          return;
        }
        
        await this.createUserAccounts(selectedCustomerId, selectedServices);
      });
    }, 100);
  }

  /**
   * Analysera systemkrav fÃ¶r specifik kund
   */
  async analyzeSystemNeedsForCustomer(customerId, services) {
    try {
      const response = await fetch('/api/users/analyze-system-needs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, services })
      });
      
      if (response.ok) {
        const analysis = await response.json();
        this.displaySystemAnalysis(analysis);
      } else {
        throw new Error('Analysis failed');
      }
    } catch (error) {
      console.error('System analysis failed:', error);
      showNotification('Systemanalys misslyckades', 'error');
    }
  }

  /**
   * Visa systemanalys resultat
   */
  displaySystemAnalysis(analysis) {
    const analysisDiv = document.getElementById('systemAnalysis');
    const resultDiv = document.getElementById('analysisResult');
    
    if (analysisDiv && resultDiv) {
      const systemNeeds = analysis.systemNeeds;
      
      resultDiv.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="font-medium">PrimÃ¤rt system:</span>
            <span class="px-2 py-1 rounded text-sm ${systemNeeds.primarySystem === 'azure-b2c' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}">
              ${systemNeeds.primarySystem === 'azure-b2c' ? 'Azure B2C' : 'Legacy System'}
            </span>
          </div>
          
          <div class="flex items-center justify-between">
            <span class="font-medium">BehÃ¶ver bÃ¥da systemen:</span>
            <span class="px-2 py-1 rounded text-sm ${systemNeeds.isDualAccount ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
              ${systemNeeds.isDualAccount ? 'Ja' : 'Nej'}
            </span>
          </div>
          
          ${systemNeeds.reasoning.azureB2CReasons.length > 0 ? `
            <div>
              <div class="font-medium text-blue-700">Azure B2C anledningar:</div>
              <ul class="text-sm text-blue-600 ml-4">
                ${systemNeeds.reasoning.azureB2CReasons.map(reason => `<li>â€¢ ${reason}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${systemNeeds.reasoning.legacyReasons.length > 0 ? `
            <div>
              <div class="font-medium text-yellow-700">Legacy system anledningar:</div>
              <ul class="text-sm text-yellow-600 ml-4">
                ${systemNeeds.reasoning.legacyReasons.map(reason => `<li>â€¢ ${reason}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
      
      analysisDiv.classList.remove('hidden');
    }
  }

  /**
   * Skapa anvÃ¤ndarkonton
   */
  async createUserAccounts(customerId, services) {
    try {
      const response = await fetch('/api/users/dual-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, services })
      });
      
      if (response.ok) {
        const result = await response.json();
        closeModal();
        this.displayCreationResult(result);
        await this.refreshStats();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Creation failed');
      }
    } catch (error) {
      console.error('User creation failed:', error);
      showNotification(`Kunde inte skapa anvÃ¤ndarkonton: ${error.message}`, 'error');
    }
  }

  /**
   * Visa resultat av anvÃ¤ndarskapande
   */
  displayCreationResult(result) {
    const accountTypes = Object.keys(result.accounts);
    const hasErrors = result.errors.length > 0;
    
    let message = `AnvÃ¤ndarkonton skapade fÃ¶r ${result.customerName}!\n\n`;
    
    if (accountTypes.length > 0) {
      message += `Skapade konton:\n${accountTypes.map(type => `â€¢ ${type}`).join('\n')}\n\n`;
    }
    
    if (hasErrors) {
      message += `Fel som uppstod:\n${result.errors.join('\n')}`;
    }
    
    showNotification(message, hasErrors ? 'error' : 'success');
  }

  /**
   * Synkronisera alla konton
   */
  async syncAllAccounts() {
    try {
      showNotification('Startar synkronisering av alla konton...', 'info');
      
      const response = await fetch('/api/users/sync-dual-accounts', {
        method: 'POST'
      });
      
      if (response.ok) {
        const result = await response.json();
        
        const message = `
          Synkronisering slutfÃ¶rd!
          
          Processerade: ${result.processed}
          Uppdaterade: ${result.updated}
          Fel: ${result.errors}
        `;
        
        showNotification(message, 'success');
        await this.refreshStats();
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error('Account sync failed:', error);
      showNotification('Synkronisering misslyckades', 'error');
    }
  }

  /**
   * Uppdatera statistik
   */
  async refreshStats() {
    await this.loadStats();
    // Uppdatera UI om modalen Ã¤r Ã¶ppen
    const modal = document.getElementById('modal');
    if (modal && modal.style.display !== 'none') {
      this.showDualUserManagement();
    }
  }

  /**
   * Analysera kundens systemkrav
   */
  async analyzeCustomerNeeds() {
    try {
      // Visa en enkel analys av systemanvÃ¤ndning
      modal.show(`
        <div class="space-y-6">
          <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 class="text-lg font-medium text-blue-900 mb-2">ðŸ” Systemanalys</h3>
            <p class="text-blue-700 text-sm">
              Analyserar vilka system som passar bÃ¤st fÃ¶r olika kundtyper.
            </p>
          </div>
          
          <div class="space-y-4">
            <h4 class="font-medium">Rekommendationer baserat pÃ¥ tjÃ¤nstetyp:</h4>
            
            <div class="bg-green-50 p-3 rounded border border-green-200">
              <h5 class="font-medium text-green-800">Azure B2C (Moderna tjÃ¤nster)</h5>
              <ul class="text-sm text-green-700 mt-1 space-y-1">
                <li>â€¢ CRM Modern - Avancerade funktioner</li>
                <li>â€¢ Analytics Platform - Rapporter och dashboards</li>
                <li>â€¢ Mobile App - Mobil Ã¥tkomst</li>
                <li>â€¢ API Access - Integrationer</li>
              </ul>
            </div>
            
            <div class="bg-orange-50 p-3 rounded border border-orange-200">
              <h5 class="font-medium text-orange-800">Legacy System (Klassiska tjÃ¤nster)</h5>
              <ul class="text-sm text-orange-700 mt-1 space-y-1">
                <li>â€¢ CRM Classic - Grundfunktioner</li>
                <li>â€¢ Old Reporting - Basrapporter</li>
                <li>â€¢ Legacy Integrations - Ã„ldre system</li>
              </ul>
            </div>
            
            <div class="bg-purple-50 p-3 rounded border border-purple-200">
              <h5 class="font-medium text-purple-800">Hybrid (BÃ¥de system)</h5>
              <p class="text-sm text-purple-700 mt-1">
                Kunder som behÃ¶ver bÃ¥de moderna och klassiska tjÃ¤nster fÃ¥r automatiskt tillgÃ¥ng till bÃ¥da systemen.
              </p>
            </div>
          </div>
          
          <div class="flex justify-end space-x-3">
            <button onclick="modal.hide()" class="btn btn-secondary">StÃ¤ng</button>
            <button onclick="dualUserManager.showDualUserManagement()" class="btn btn-primary">Tillbaka till huvudmeny</button>
          </div>
        </div>
      `);
    } catch (error) {
      console.error('Customer needs analysis failed:', error);
      showNotification('Kunde inte analysera kundkrav', 'error');
    }
  }

  /**
   * Visa migreringskandidater
   */
  async showMigrationCandidates() {
    try {
      const response = await fetch('/api/users/migration-candidates');
      if (!response.ok) throw new Error('Failed to load migration candidates');
      
      const data = await response.json();
      this.migrationCandidates = data.candidates;
      
      openModal('Migreringskandidater', `
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-medium">Kunder som kan migreras till Azure B2C</h3>
            <div class="text-sm text-gray-600">
              ${data.totalCount} kandidater (${data.highPriority} hÃ¶g prioritet)
            </div>
          </div>
          
          ${data.candidates.length === 0 ? `
            <div class="text-center py-8 text-gray-500">
              <div class="text-4xl mb-4">ðŸŽ‰</div>
              <div>Inga migreringskandidater hittades!</div>
              <div class="text-sm">Alla kunder anvÃ¤nder redan rÃ¤tt system.</div>
            </div>
          ` : `
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kund</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nuvarande</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rekommenderat</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioritet</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ã…tgÃ¤rd</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  ${data.candidates.map(candidate => `
                    <tr>
                      <td class="px-6 py-4 text-sm font-medium text-gray-900">
                        ${escapeHTML(candidate.customerName)}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-500">
                        ${candidate.currentSystem}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-500">
                        ${candidate.recommendedSystem}
                      </td>
                      <td class="px-6 py-4">
                        <span class="px-2 py-1 text-xs rounded-full ${candidate.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
                          ${candidate.priority === 'high' ? 'HÃ¶g' : 'Medium'}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-sm">
                        <button onclick="dualUserManager.migrateCustomer('${candidate.customerId}')" 
                                class="text-blue-600 hover:text-blue-800">
                          Migrera
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <div class="flex justify-between items-center pt-4 border-t">
              <div class="text-sm text-gray-600">
                Migrering Ã¶verfÃ¶r kunder frÃ¥n legacy-system till Azure B2C fÃ¶r bÃ¤ttre sÃ¤kerhet och funktionalitet.
              </div>
              <button onclick="dualUserManager.bulkMigrateSelected()" class="btn btn-primary">
                Migrera alla hÃ¶gprioriterade
              </button>
            </div>
          `}
        </div>
      `);
      
    } catch (error) {
      console.error('Failed to load migration candidates:', error);
      showNotification('Kunde inte ladda migreringskandidater', 'error');
    }
  }

  /**
   * Migrera specifik kund
   */
  async migrateCustomer(customerId) {
    try {
      const response = await fetch('/api/users/migrate-to-azure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, services: ['CRM_MODERN'] })
      });
      
      if (response.ok) {
        const result = await response.json();
        showNotification(`Kund migrerad till Azure B2C!`, 'success');
        await this.refreshStats();
        
        // Uppdatera migreringslistan
        this.showMigrationCandidates();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Migration failed');
      }
    } catch (error) {
      console.error('Migration failed:', error);
      showNotification(`Migrering misslyckades: ${error.message}`, 'error');
    }
  }

  /**
   * Bulk migrera anvÃ¤ndare till Azure B2C
   */
  async bulkMigrateToAzure() {
    try {
      modal.show(`
        <div class="space-y-6">
          <div class="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <h3 class="text-lg font-medium text-orange-900 mb-2">â¬†ï¸ Bulk-migrering till Azure B2C</h3>
            <p class="text-orange-700 text-sm">
              Migrera flera anvÃ¤ndare frÃ¥n legacy-systemet till Azure B2C samtidigt.
            </p>
          </div>
          
          <div class="bg-yellow-50 p-4 rounded border border-yellow-200">
            <h4 class="font-medium text-yellow-800 mb-2">âš ï¸ Viktigt att veta:</h4>
            <ul class="text-sm text-yellow-700 space-y-1">
              <li>â€¢ AnvÃ¤ndare behÃ¥ller sina befintliga lÃ¶senord</li>
              <li>â€¢ Alla anvÃ¤ndardata Ã¶verfÃ¶rs sÃ¤kert</li>
              <li>â€¢ Processen kan ta flera minuter</li>
              <li>â€¢ Du fÃ¥r en detaljerad rapport efterÃ¥t</li>
            </ul>
          </div>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">VÃ¤lj migreringsstrategi:</label>
              <select id="migrationStrategy" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="priority">Bara hÃ¶ga prioritet-anvÃ¤ndare</option>
                <option value="all-eligible">Alla kvalificerade anvÃ¤ndare</option>
                <option value="custom">Anpassat urval</option>
              </select>
            </div>
            
            <div class="flex justify-end space-x-3">
              <button onclick="modal.hide()" class="btn btn-secondary">Avbryt</button>
              <button onclick="dualUserManager.executeBulkMigration()" class="btn btn-primary">Starta migrering</button>
            </div>
          </div>
        </div>
      `);
    } catch (error) {
      console.error('Bulk migration setup failed:', error);
      showNotification('Kunde inte fÃ¶rbereda bulk-migrering', 'error');
    }
  }

  /**
   * Visa routing-regler
   */
  async showRoutingRules() {
    try {
      modal.show(`
        <div class="space-y-6">
          <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h3 class="text-lg font-medium text-purple-900 mb-2">âš™ï¸ Routing-regler</h3>
            <p class="text-purple-700 text-sm">
              Konfigurera hur anvÃ¤ndare automatiskt dirigeras till rÃ¤tt system.
            </p>
          </div>
          
          <div class="space-y-4">
            <h4 class="font-medium">Aktuella routing-regler:</h4>
            
            <div class="bg-white border rounded-lg p-4 space-y-3">
              <div class="flex justify-between items-center p-3 bg-blue-50 rounded">
                <div>
                  <div class="font-medium">Moderna tjÃ¤nster â†’ Azure B2C</div>
                  <div class="text-sm text-gray-600">CRM_MODERN, ANALYTICS_PLATFORM, MOBILE_APP, API_ACCESS</div>
                </div>
                <span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Aktiv</span>
              </div>
              
              <div class="flex justify-between items-center p-3 bg-orange-50 rounded">
                <div>
                  <div class="font-medium">Klassiska tjÃ¤nster â†’ Legacy System</div>
                  <div class="text-sm text-gray-600">CRM_CLASSIC, OLD_REPORTING, LEGACY_INTEGRATIONS</div>
                </div>
                <span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Aktiv</span>
              </div>
              
              <div class="flex justify-between items-center p-3 bg-purple-50 rounded">
                <div>
                  <div class="font-medium">Hybrid â†’ BÃ¥da system</div>
                  <div class="text-sm text-gray-600">AnvÃ¤ndare som behÃ¶ver bÃ¥de moderna och klassiska tjÃ¤nster</div>
                </div>
                <span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Aktiv</span>
              </div>
            </div>
            
            <div class="bg-gray-50 p-4 rounded">
              <h5 class="font-medium mb-2">Routing-logik:</h5>
              <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li>Analysera vilka tjÃ¤nster kunden behÃ¶ver</li>
                <li>Kontrollera om kunden redan finns i nÃ¥got system</li>
                <li>VÃ¤lj lÃ¤mpligt system baserat pÃ¥ tjÃ¤nstekrav</li>
                <li>Skapa anvÃ¤ndarkonto i valt system</li>
                <li>Logga beslut fÃ¶r revision</li>
              </ol>
            </div>
          </div>
          
          <div class="flex justify-end space-x-3">
            <button onclick="modal.hide()" class="btn btn-secondary">StÃ¤ng</button>
            <button onclick="dualUserManager.showDualUserManagement()" class="btn btn-primary">Tillbaka</button>
          </div>
        </div>
      `);
    } catch (error) {
      console.error('Routing rules display failed:', error);
      showNotification('Kunde inte visa routing-regler', 'error');
    }
  }

  /**
   * KÃ¶r bulk-migrering
   */
  async executeBulkMigration() {
    const strategy = document.getElementById('migrationStrategy')?.value || 'priority';
    
    try {
      showNotification('Startar bulk-migrering...', 'info');
      modal.hide();
      
      const response = await fetch('/api/users/bulk-migrate-to-azure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy })
      });
      
      if (response.ok) {
        const result = await response.json();
        showNotification(`Bulk-migrering slutfÃ¶rd! Migrerade: ${result.migrated}, Fel: ${result.errors}`, 'success');
        await this.refreshStats();
      } else {
        throw new Error('Bulk migration failed');
      }
    } catch (error) {
      console.error('Bulk migration failed:', error);
      showNotification('Bulk-migrering misslyckades', 'error');
    }
  }
}

// Skapa global instans
const dualUserManager = new DualUserManager();

// ============================================
// VISMA.NET INTEGRATION
// ============================================

/**
 * Visma.net Integration Manager
 */
class VismaIntegration {
  constructor() {
    this.isConnected = false;
    this.companyInfo = null;
    this.syncInProgress = false;
    this.lastSyncResult = null;
    
    // Check connection status on initialization
    this.checkConnectionStatus();
  }

  /**
   * Kontrollera anslutningsstatus till Visma.net
   */
  async checkConnectionStatus() {
    try {
      const response = await fetch('/api/visma/status');
      if (response.ok) {
        const status = await response.json();
        this.isConnected = status.connected;
        this.companyInfo = status.company;
        this.updateUI();
      }
    } catch (error) {
      console.error('Failed to check Visma.net status:', error);
    }
  }

  /**
   * Starta anslutning till Visma.net
   */
  async connect() {
    try {
      const response = await fetch('/api/visma/auth');
      if (response.ok) {
        const { authUrl } = await response.json();
        
        // Ã–ppna OAuth-flÃ¶de i nytt fÃ¶nster
        const authWindow = window.open(authUrl, 'visma_auth', 'width=800,height=600');
        
        // Lyssna pÃ¥ nÃ¤r fÃ¶nstret stÃ¤ngs
        const checkClosed = setInterval(() => {
          if (authWindow.closed) {
            clearInterval(checkClosed);
            // Kontrollera anslutningsstatus efter OAuth
            setTimeout(() => this.checkConnectionStatus(), 1000);
          }
        }, 1000);
        
      }
    } catch (error) {
      console.error('Failed to start Visma.net connection:', error);
      showNotification('Kunde inte ansluta till Visma.net', 'error');
    }
  }

  /**
   * Koppla frÃ¥n Visma.net
   */
  async disconnect() {
    try {
      const response = await fetch('/api/visma/disconnect', {
        method: 'POST'
      });
      
      if (response.ok) {
        this.isConnected = false;
        this.companyInfo = null;
        this.updateUI();
        showNotification('FrÃ¥nkopplad frÃ¥n Visma.net', 'success');
      }
    } catch (error) {
      console.error('Failed to disconnect from Visma.net:', error);
      showNotification('Kunde inte koppla frÃ¥n Visma.net', 'error');
    }
  }

  /**
   * Synkronisera produkter
   */
  async syncProducts(direction = 'bidirectional', syncPrices = true) {
    if (this.syncInProgress) {
      showNotification('Synkronisering pÃ¥gÃ¥r redan', 'info');
      return;
    }

    this.syncInProgress = true;
    this.updateUI();

    try {
      const response = await fetch('/api/visma/sync/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ direction, syncPrices })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.message === 'product_sync_started') {
          showNotification('Produktsynkronisering startad i bakgrunden', 'info');
          this.pollProductSyncStatus();
        } else {
          this.displayProductSyncResult(result);
        }
      } else {
        throw new Error('Produktsynkronisering misslyckades');
      }
    } catch (error) {
      console.error('Product sync failed:', error);
      showNotification('Produktsynkronisering misslyckades', 'error');
    } finally {
      this.syncInProgress = false;
      this.updateUI();
    }
  }

  /**
   * Kontrollera produktsynkroniseringsstatus
   */
  async pollProductSyncStatus() {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/visma/sync/products/status');
        if (response.ok) {
          const status = await response.json();
          
          if (!status.isRunning && status.lastSync) {
            clearInterval(pollInterval);
            this.syncInProgress = false;
            this.updateUI();
            showNotification('Produktsynkronisering slutfÃ¶rd', 'success');
          }
        }
      } catch (error) {
        console.error('Failed to poll product sync status:', error);
        clearInterval(pollInterval);
        this.syncInProgress = false;
        this.updateUI();
      }
    }, 3000);

    setTimeout(() => {
      clearInterval(pollInterval);
      this.syncInProgress = false;
      this.updateUI();
    }, 5 * 60 * 1000);
  }

  /**
   * Visa produktsynkroniseringsresultat
   */
  displayProductSyncResult(result) {
    const message = `
      Produktsynkronisering slutfÃ¶rd!
      
      CRM â†’ Visma.net:
      - ${result.crmToVisma.created} produkter skapade
      - ${result.crmToVisma.updated} produkter uppdaterade
      
      Visma.net â†’ CRM:
      - ${result.vismaToCrm.created} produkter skapade
      - ${result.vismaToCrm.updated} produkter uppdaterade
      
      Prisuppdateringar: ${result.priceUpdates}
      Tid: ${Math.round(result.duration / 1000)}s
    `;
    
    showNotification(message, 'success');
  }

  /**
   * Hantera prislista
   */
  async showPriceListManager() {
    try {
      const response = await fetch('/api/price-list');
      if (!response.ok) throw new Error('Failed to load price list');
      
      const priceList = await response.json();
      
      openModal('Prislista - Produkthantering', `
        <div class="space-y-6">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-lg font-medium">Produktkatalog</h3>
              <p class="text-sm text-gray-600">Senast uppdaterad: ${new Date(priceList.lastUpdated).toLocaleString('sv-SE')}</p>
            </div>
            <button onclick="vismaIntegration.addNewProduct()" class="btn btn-primary">
              + Ny produkt
            </button>
          </div>
          
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produkt</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pris (SEK)</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Moms</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ã…tgÃ¤rder</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${priceList.products.map(product => `
                  <tr>
                    <td class="px-6 py-4">
                      <div>
                        <div class="text-sm font-medium text-gray-900">${escapeHTML(product.name)}</div>
                        <div class="text-sm text-gray-500">${escapeHTML(product.description || '')}</div>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">${escapeHTML(product.category)}</td>
                    <td class="px-6 py-4 text-sm text-gray-900">${product.basePrice.toLocaleString('sv-SE')} ${priceList.currency}</td>
                    <td class="px-6 py-4 text-sm text-gray-900">${product.vatCategory}</td>
                    <td class="px-6 py-4">
                      <span class="px-2 py-1 text-xs rounded-full ${product.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${product.active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-sm space-x-2">
                      <button onclick="vismaIntegration.editProduct('${product.id}')" class="text-blue-600 hover:text-blue-800">
                        Redigera
                      </button>
                      <button onclick="vismaIntegration.deleteProduct('${product.id}')" class="text-red-600 hover:text-red-800">
                        Ta bort
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="flex justify-between items-center pt-4 border-t">
            <div class="text-sm text-gray-600">
              ${priceList.products.length} produkter â€¢ Valuta: ${priceList.currency} â€¢ Moms: ${(priceList.vatRate * 100)}%
            </div>
            <div class="space-x-3">
              <button onclick="vismaIntegration.exportPriceList()" class="btn btn-secondary">
                Exportera prislista
              </button>
              <button onclick="vismaIntegration.syncProducts('crm-to-visma')" class="btn btn-primary">
                Synka till Visma.net
              </button>
            </div>
          </div>
        </div>
      `);
      
    } catch (error) {
      console.error('Failed to load price list:', error);
      showNotification('Kunde inte ladda prislista', 'error');
    }
  }

  /**
   * LÃ¤gg till ny produkt
   */
  async addNewProduct() {
    openModal('Ny produkt', `
      <form id="newProductForm" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Produktnamn</label>
          <input type="text" id="productName" class="w-full border border-gray-300 rounded-md px-3 py-2" required>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Beskrivning</label>
          <textarea id="productDescription" class="w-full border border-gray-300 rounded-md px-3 py-2" rows="3"></textarea>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Pris (SEK)</label>
            <input type="number" id="productPrice" class="w-full border border-gray-300 rounded-md px-3 py-2" step="0.01" min="0" required>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Enhet</label>
            <select id="productUnit" class="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="ST">Styck</option>
              <option value="HOUR">Timme</option>
              <option value="MONTH">MÃ¥nad</option>
              <option value="YEAR">Ã…r</option>
            </select>
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <select id="productCategory" class="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="Software License">Mjukvarulicens</option>
              <option value="Setup Service">InstallationstjÃ¤nst</option>
              <option value="Support Service">SupporttjÃ¤nst</option>
              <option value="Training">Utbildning</option>
              <option value="Consulting">KonsulttjÃ¤nst</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Momskategori</label>
            <select id="productVat" class="w-full border border-gray-300 rounded-md px-3 py-2">
              <option value="NORMAL">Normal (25%)</option>
              <option value="REDUCED_12">Reducerad (12%)</option>
              <option value="REDUCED_6">Reducerad (6%)</option>
              <option value="ZERO">Noll (0%)</option>
              <option value="EXEMPT">Befriad</option>
            </select>
          </div>
        </div>
        
        <div class="flex items-center">
          <input type="checkbox" id="productActive" checked class="mr-2">
          <label for="productActive" class="text-sm text-gray-700">Aktiv produkt</label>
        </div>
        
        <div class="flex justify-end space-x-3 pt-4">
          <button type="button" onclick="closeModal()" class="btn btn-secondary">Avbryt</button>
          <button type="submit" class="btn btn-primary">Skapa produkt</button>
        </div>
      </form>
    `);
    
    // Hantera formulÃ¤rinlÃ¤mning
    setTimeout(() => {
      const form = document.getElementById('newProductForm');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const productData = {
            name: document.getElementById('productName').value,
            description: document.getElementById('productDescription').value,
            basePrice: parseFloat(document.getElementById('productPrice').value),
            unit: document.getElementById('productUnit').value,
            category: document.getElementById('productCategory').value,
            vatCategory: document.getElementById('productVat').value,
            type: 'Service',
            active: document.getElementById('productActive').checked
          };
          
          try {
            const response = await fetch('/api/price-list/products', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(productData)
            });
            
            if (response.ok) {
              closeModal();
              showNotification('Produkt skapad', 'success');
              // Uppdatera prislistan
              this.showPriceListManager();
            } else {
              throw new Error('Failed to create product');
            }
          } catch (error) {
            console.error('Failed to create product:', error);
            showNotification('Kunde inte skapa produkt', 'error');
          }
        });
      }
    }, 100);
  }

  /**
   * Synkronisera kunder
   */
  async syncCustomers(direction = 'bidirectional') {
    if (this.syncInProgress) {
      showNotification('Synkronisering pÃ¥gÃ¥r redan', 'info');
      return;
    }

    this.syncInProgress = true;
    this.updateUI();

    try {
      const response = await fetch('/api/visma/sync/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ direction })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.message === 'sync_started') {
          showNotification('Synkronisering startad i bakgrunden', 'info');
          // Kontrollera status regelbundet
          this.pollSyncStatus();
        } else {
          this.lastSyncResult = result;
          this.displaySyncResult(result);
        }
      } else {
        throw new Error('Synkronisering misslyckades');
      }
    } catch (error) {
      console.error('Customer sync failed:', error);
      showNotification('Kundsynkronisering misslyckades', 'error');
    } finally {
      this.syncInProgress = false;
      this.updateUI();
    }
  }

  /**
   * Kontrollera synkroniseringsstatus regelbundet
   */
  async pollSyncStatus() {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/visma/sync/status');
        if (response.ok) {
          const status = await response.json();
          
          if (!status.isRunning && status.lastSync) {
            clearInterval(pollInterval);
            this.syncInProgress = false;
            this.updateUI();
            showNotification('Synkronisering slutfÃ¶rd', 'success');
            
            // Uppdatera kunddata
            await loadState();
          }
        }
      } catch (error) {
        console.error('Failed to poll sync status:', error);
        clearInterval(pollInterval);
        this.syncInProgress = false;
        this.updateUI();
      }
    }, 3000); // Kontrollera var 3:e sekund

    // Stoppa polling efter 5 minuter
    setTimeout(() => {
      clearInterval(pollInterval);
      this.syncInProgress = false;
      this.updateUI();
    }, 5 * 60 * 1000);
  }

  /**
   * Visa synkroniseringsresultat
   */
  displaySyncResult(result) {
    const message = `
      Synkronisering slutfÃ¶rd!
      
      CRM â†’ Visma.net:
      - ${result.crmToVisma.created} kunder skapade
      - ${result.crmToVisma.updated} kunder uppdaterade
      
      Visma.net â†’ CRM:
      - ${result.vismaToCrm.created} kunder skapade
      - ${result.vismaToCrm.updated} kunder uppdaterade
      
      Tid: ${Math.round(result.duration / 1000)}s
    `;
    
    showNotification(message, 'success');
  }

  /**
   * Uppdatera UI baserat pÃ¥ anslutningsstatus
   */
  updateUI() {
    const vismaStatus = document.getElementById('vismaStatus');
    const vismaConnect = document.getElementById('vismaConnect');
    const vismaDisconnect = document.getElementById('vismaDisconnect');
    const vismaSyncCustomers = document.getElementById('vismaSyncCustomers');
    const vismaCompanyInfo = document.getElementById('vismaCompanyInfo');

    if (vismaStatus) {
      if (this.isConnected) {
        vismaStatus.textContent = 'âœ… Ansluten till Visma.net';
        vismaStatus.className = 'text-green-600 font-medium';
      } else {
        vismaStatus.textContent = 'âŒ Inte ansluten till Visma.net';
        vismaStatus.className = 'text-red-600 font-medium';
      }
    }

    if (vismaConnect) {
      vismaConnect.style.display = this.isConnected ? 'none' : 'inline-block';
    }

    if (vismaDisconnect) {
      vismaDisconnect.style.display = this.isConnected ? 'inline-block' : 'none';
    }

    if (vismaSyncCustomers) {
      vismaSyncCustomers.disabled = !this.isConnected || this.syncInProgress;
      vismaSyncCustomers.textContent = this.syncInProgress ? 'Synkroniserar...' : 'Synkronisera kunder';
    }

    if (vismaCompanyInfo && this.companyInfo) {
      vismaCompanyInfo.innerHTML = `
        <div class="mt-2 p-3 bg-gray-50 rounded-lg">
          <div class="font-medium">${this.companyInfo.name}</div>
          <div class="text-sm text-gray-600">Org.nr: ${this.companyInfo.corporateID || 'N/A'}</div>
          <div class="text-sm text-gray-600">Databas: ${this.companyInfo.databaseId || 'N/A'}</div>
        </div>
      `;
    }
  }

  /**
   * Visa Visma.net-konfiguration
   */
  showConfiguration() {
    modal.show(`
      <div class="space-y-6">
        <div>
          <h3 class="text-lg font-medium mb-4">Anslutningsstatus</h3>
          <div id="vismaStatus"></div>
          <div id="vismaCompanyInfo"></div>
        </div>
        
        <div>
          <h3 class="text-lg font-medium mb-4">Anslutning</h3>
          <div class="space-x-3">
            <button id="vismaConnect" class="btn btn-primary">
              Anslut till Visma.net
            </button>
            <button id="vismaDisconnect" class="btn btn-secondary" style="display: none;">
              Koppla frÃ¥n
            </button>
          </div>
          <p class="text-sm text-gray-600 mt-2">
            Du kommer att omdirigeras till Visma.net fÃ¶r sÃ¤ker inloggning.
          </p>
        </div>
        
          <div>
            <h3 class="text-lg font-medium mb-4">Synkronisering</h3>
            <div class="space-y-3">
              <button id="vismaSyncCustomers" class="btn btn-primary">
                Synkronisera kunder
              </button>
              <button id="vismaSyncProducts" class="btn btn-primary">
                Synkronisera produkter
              </button>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button onclick="vismaIntegration.syncCustomers('crm-to-visma')" 
                        class="btn btn-secondary text-sm">
                  CRM â†’ Visma.net
                </button>
                <button onclick="vismaIntegration.syncCustomers('visma-to-crm')" 
                        class="btn btn-secondary text-sm">
                  Visma.net â†’ CRM
                </button>
                <button onclick="vismaIntegration.syncCustomers('bidirectional')" 
                        class="btn btn-secondary text-sm">
                  Bidirektionell
                </button>
              </div>
            </div>
            <p class="text-sm text-gray-600 mt-2">
              Synkronisera kund- och produktdata mellan CRM och Visma.net. Dubbletter hanteras automatiskt.
            </p>
          </div>
          
          <div>
            <h3 class="text-lg font-medium mb-4">Produkthantering</h3>
            <div class="space-y-3">
              <button onclick="vismaIntegration.showPriceListManager()" class="btn btn-primary" id="managePriceList">
                Hantera prislista
              </button>
              <button onclick="vismaIntegration.syncProducts('crm-to-visma')" 
                      class="btn btn-secondary" disabled>
                Synka produkter till Visma.net
              </button>
            </div>
            <p class="text-sm text-gray-600 mt-2">
              Hantera produktkatalog och priser. Synkronisera med Visma.net fÃ¶r korrekt fakturering.
            </p>
          </div>        <div>
          <h3 class="text-lg font-medium mb-4">Automatisering</h3>
          <div class="space-y-2">
            <label class="flex items-center">
              <input type="checkbox" class="mr-2" disabled>
              <span class="text-sm">Automatisk kundsynkronisering (kommer snart)</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" class="mr-2" disabled>
              <span class="text-sm">Automatisk fakturering (kommer snart)</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" class="mr-2" disabled>
              <span class="text-sm">BetalningsÃ¶vervakning (kommer snart)</span>
            </label>
          </div>
        </div>
      </div>
    `);

    // LÃ¤gg till event listeners
    setTimeout(() => {
      const connectBtn = document.getElementById('vismaConnect');
      const disconnectBtn = document.getElementById('vismaDisconnect');
      const syncBtn = document.getElementById('vismaSyncCustomers');

      if (connectBtn) {
        connectBtn.addEventListener('click', () => this.connect());
      }

      if (disconnectBtn) {
        disconnectBtn.addEventListener('click', () => this.disconnect());
      }

      if (syncBtn) {
        syncBtn.addEventListener('click', () => this.syncCustomers());
      }

      // Uppdatera UI
      this.updateUI();
    }, 100);
  }
}

// Skapa global instans av Visma.net-integration
const vismaIntegration = new VismaIntegration();

// Version och build information
async function loadVersionInfo() {
  try {
    const response = await fetch('/api/health');
    if (response.ok) {
      const data = await response.json();
      
      // Uppdatera version info
      const versionElement = document.getElementById('app-version');
      if (versionElement) {
        versionElement.textContent = `Version: ${data.version || 'Unknown'}`;
      }
      
      // Uppdatera build timestamp
      const buildElement = document.getElementById('build-timestamp');
      if (buildElement && data.timestamp) {
        const buildDate = new Date(data.timestamp);
        buildElement.textContent = buildDate.toLocaleDateString('sv-SE') + ' ' + 
                                  buildDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
      }
      
      console.log('ðŸ“Š System Info:', {
        version: data.version,
        status: data.status,
        uptime: Math.round(data.uptime || 0) + 's'
      });
    }
  } catch (error) {
    console.warn('âš ï¸ Could not load version info:', error);
    const versionElement = document.getElementById('app-version');
    if (versionElement) {
      versionElement.textContent = 'Version: Development';
    }
  }
}

// Ladda version info nÃ¤r sidan laddas
document.addEventListener('DOMContentLoaded', () => {
  loadVersionInfo();
});

// LÃ¤gg till Visma.net-knapp i admin-panelen
// Export fÃ¶r testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VismaIntegration };
}

// Auto-start disabled - now controlled by auth-init.js
window.initializeApp = init; // Expose for auth-init.js

