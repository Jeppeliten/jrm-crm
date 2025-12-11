'use strict';

// Azure-compatible API wrapper
// Automatically uses fetchWithAuth (with Bearer token) when available,
// falls back to regular fetch for backwards compatibility
const apiFetch = async (url, options = {}) => {
  // Use fetchWithAuth if available (Azure Entra ID authentication)
  if (typeof fetchWithAuth === 'function') {
    return await fetchWithAuth(url, options);
  }
  
  // Fallback to regular fetch with credentials
  const defaultOptions = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  
  const response = await fetch(url, { ...defaultOptions, ...options });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  // Return response object for flexibility
  return response;
};


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
// API_BASE is defined in config.js
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
  // Azure backend doesnt have /api/state endpoint - use localStorage only
  console.log("Loading state from localStorage (Azure mode)...");

window.initializeApp = init;
