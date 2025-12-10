/**
 * Simple CRM Application - Navigation and Basic Functionality
 * Simplified version without ES6 modules
 */

// Global state
const appState = {
  currentView: 'dashboard',
  customers: [],
  deals: [],
  activities: [],
  user: null
};

// Global flag to prevent double initialization
let appInitialized = false;

// Listen to the authentication event - this is the primary trigger
window.addEventListener('entra-login-success', (event) => {
  console.log('Ã°Å¸â€â€ entra-login-success event received in app-simple.js', event.detail);
  
  if (appInitialized) {
    console.log('Ã¢ÂÂ­Ã¯Â¸Â  App already initialized, skipping...');
    return;
  }
  
  // Wait for app-init.js to show main content, then initialize CRM
  setTimeout(() => {
    const mainApp = document.getElementById('app');
    const isVisible = mainApp && window.getComputedStyle(mainApp).visibility === 'visible';
    
    if (isVisible) {
      console.log('Ã°Å¸Å¡â‚¬ Starting CRM initialization after login...');
      initializeSimpleApp();
      appInitialized = true;
    } else {
      console.log('Ã¢ÂÂ¸Ã¯Â¸Â  Main app not yet visible, waiting...');
      // If not visible yet, wait a bit more
      setTimeout(() => {
        console.log('Ã°Å¸Å¡â‚¬ Starting CRM initialization (delayed)...');
        initializeSimpleApp();
        appInitialized = true;
      }, 500);
    }
  }, 200);
});

// Fallback: Initialize when DOM is ready AND user is already logged in
document.addEventListener('DOMContentLoaded', () => {
  console.log('Ã°Å¸Å½Â¯ app-simple.js DOM ready');
  
  // Check if user is already authenticated (page refresh case)
  setTimeout(() => {
    const mainApp = document.getElementById('app');
    const isVisible = mainApp && window.getComputedStyle(mainApp).visibility === 'visible';
    
    if (isVisible && !appInitialized) {
      console.log('Ã¢Å“â€¦ User already authenticated, initializing CRM...');
      initializeSimpleApp();
      appInitialized = true;
    }
  }, 1500); // Wait for app-init.js to finish
});

function initializeSimpleApp() {
  console.log('=== Simple app initialization started ===');
  
  // Check if DOM is ready
  console.log('Document ready state:', document.readyState);
  
  // Set up navigation
  setupNavigation();
  
  // Load initial view (dashboard should already be visible)
  const dashboardView = document.getElementById('view-dashboard');
  console.log('Dashboard view found:', !!dashboardView);
  
  if (dashboardView && dashboardView.children.length === 0) {
    console.log('Loading dashboard template...');
    loadTemplate('dashboard', dashboardView);
  }
  
  showView('dashboard');
  
  // Set up button handlers
  setupButtonHandlers();
  
  console.log('=== Simple app ready ===');
}

function setupNavigation() {
  console.log('Setting up navigation...');
  
  // Find all navigation buttons - try multiple selectors
  let navButtons = document.querySelectorAll('[data-view]');
  
  if (navButtons.length === 0) {
    console.warn('No navigation buttons found with [data-view], trying .nav-item');
    navButtons = document.querySelectorAll('.nav-item[data-view]');
  }
  
  if (navButtons.length === 0) {
    console.error('Still no navigation buttons found!');
    return;
  }
  
  navButtons.forEach(button => {
    const viewName = button.getAttribute('data-view');
    console.log('Found navigation button:', viewName);
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Navigation clicked:', viewName);
      showView(viewName);
      
      // Update active state
      navButtons.forEach(btn => {
        btn.classList.remove('active', 'btn-active');
      });
      button.classList.add('active', 'btn-active');
    });
  });
  
  console.log(`Set up ${navButtons.length} navigation buttons`);
}

function showView(viewName) {
  console.log('Showing view:', viewName);
  appState.currentView = viewName;
  
  // Hide all views
  const allViews = document.querySelectorAll('[id^="view-"]');
  allViews.forEach(view => {
    view.style.display = 'none';
    view.classList.remove('visible');
  });
  
  // Show requested view
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.style.display = 'block';
    targetView.classList.add('visible');
    console.log(`View "${viewName}" displayed`);
    console.log(`View has ${targetView.children.length} children`);
    
    // Load template content if view is empty
    if (targetView.children.length === 0) {
      console.log(`Loading template for "${viewName}"...`);
      loadTemplate(viewName, targetView);
    } else {
      console.log(`View "${viewName}" already has content, skipping template load`);
    }
    
    // Load data for this view
    loadViewData(viewName);
  } else {
    console.warn(`View "${viewName}" not found, showing dashboard`);
    const dashboardView = document.getElementById('view-dashboard');
    if (dashboardView) {
      dashboardView.style.display = 'block';
      dashboardView.classList.add('visible');
      if (dashboardView.children.length === 0) {
        loadTemplate('dashboard', dashboardView);
      }
    }
  }
}

function loadTemplate(viewName, targetElement) {
  console.log(`\nÃ°Å¸â€â€ž ====== loadTemplate START ======`);
  console.log(`Ã°Å¸â€â€ž View: ${viewName}`);
  console.log(`Ã°Å¸â€â€ž Target element:`, targetElement);
  
  const template = document.getElementById(`tpl-${viewName}`);
  
  if (template) {
    console.log(`Ã¢Å“â€¦ Template "tpl-${viewName}" found!`);
    const content = template.content.cloneNode(true);
    console.log(`Ã¢Å“â€¦ Template cloned, content:`, content);
    
    targetElement.appendChild(content);
    console.log(`Ã¢Å“â€¦ Template content appended to target`);
    console.log(`Ã¢Å“â€¦ Target element now has ${targetElement.children.length} children`);
    
    // Set up event handlers for buttons in this view
    // Use a longer delay to ensure DOM is fully updated
    setTimeout(() => {
      console.log(`\nÃ¢ÂÂ° Timeout fired after 200ms - setting up handlers`);
      console.log(`Ã¢ÂÂ° Target element ID: ${targetElement.id}`);
      console.log(`Ã¢ÂÂ° Target element children: ${targetElement.children.length}`);
      setupViewEventHandlers(viewName, targetElement);
      console.log(`Ã¢Å“â€¦ setupViewEventHandlers completed\n`);
    }, 200);
  } else {
    console.warn(`Ã¢ÂÅ’ Template "tpl-${viewName}" not found in DOM`);
    // Add a placeholder message
    targetElement.innerHTML = `
      <div class="p-8">
        <h2 class="text-2xl font-bold mb-4">${formatViewName(viewName)}</h2>
        <p class="text-base-content/70">InnehÃƒÂ¥ll fÃƒÂ¶r denna vy kommer snart...</p>
      </div>
    `;
  }
}

function formatViewName(viewName) {
  const names = {
    'dashboard': 'Dashboard',
    'brands': 'VarumÃƒÂ¤rken',
    'companies': 'FÃƒÂ¶retag',
    'agents': 'MÃƒÂ¤klare',
    'pipeline': 'SÃƒÂ¤ljtavla',
    'customer-success': 'KundvÃƒÂ¥rd',
    'licenses': 'Licenser',
    'import': 'Import',
    'settings': 'InstÃƒÂ¤llningar'
  };
  return names[viewName] || viewName;
}

function loadViewData(viewName) {
  console.log('Loading data for view:', viewName);
  
  switch(viewName) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'brands':
      loadBrands();
      break;
    case 'companies':
      loadCompanies();
      break;
    case 'agents':
      loadAgents();
      break;
    case 'pipeline':
      loadPipeline();
      break;
    case 'customer-success':
      loadCustomerSuccess();
      break;
    case 'licenses':
      loadLicenses();
      break;
    case 'import':
      loadImport();
      break;
    case 'settings':
      loadSettings();
      break;
    default:
      console.log('No data loader for view:', viewName);
  }
}

async function loadCustomers() {
  console.log('Loading customers...');
  
  try {
    const response = await fetchWithAuth('/api/customers');
    if (response.ok) {
      const customers = await response.json();
      appState.customers = customers;
      console.log(`Loaded ${customers.length} customers`);
      renderCustomers(customers);
    } else {
      console.log('Using demo data for customers');
      renderCustomers([
        { id: 1, name: 'Demo Kund AB', email: 'kontakt@demo.se', phone: '070-123456' },
        { id: 2, name: 'Test FÃƒÂ¶retag HB', email: 'info@test.se', phone: '070-654321' }
      ]);
    }
  } catch (error) {
    console.error('Error loading customers:', error);
    showDemoMessage('Kunder');
  }
}

async function loadDeals() {
  console.log('Loading deals...');
  
  try {
    const response = await fetchWithAuth('/api/deals');
    if (response.ok) {
      const deals = await response.json();
      appState.deals = deals;
      console.log(`Loaded ${deals.length} deals`);
      renderDeals(deals);
    } else {
      console.log('Using demo data for deals');
      renderDeals([
        { id: 1, title: 'Demo AffÃƒÂ¤r 1', value: 50000, status: 'negotiation', customer: 'Demo Kund AB' },
        { id: 2, title: 'Demo AffÃƒÂ¤r 2', value: 75000, status: 'proposal', customer: 'Test FÃƒÂ¶retag HB' }
      ]);
    }
  } catch (error) {
    console.error('Error loading deals:', error);
    showDemoMessage('AffÃƒÂ¤rer');
  }
}

async function loadActivities() {
  console.log('Loading activities...');
  
  try {
    const response = await fetchWithAuth('/api/activities');
    if (response.ok) {
      const activities = await response.json();
      appState.activities = activities;
      console.log(`Loaded ${activities.length} activities`);
      renderActivities(activities);
    } else {
      console.log('Using demo data for activities');
      renderActivities([
        { id: 1, title: 'UppfÃƒÂ¶ljning Demo Kund', type: 'call', date: new Date().toISOString() },
        { id: 2, title: 'MÃƒÂ¶te Test FÃƒÂ¶retag', type: 'meeting', date: new Date().toISOString() }
      ]);
    }
  } catch (error) {
    console.error('Error loading activities:', error);
    showDemoMessage('Aktiviteter');
  }
}

function loadDashboard() {
  console.log('Loading dashboard...');
  // Dashboard loaded, show welcome message
  const welcomeEl = document.querySelector('#view-dashboard .text-3xl');
  if (welcomeEl && window.entraAuth) {
    const user = window.entraAuth.getUser();
    welcomeEl.textContent = `VÃƒÂ¤lkommen, ${user.name || 'anvÃƒÂ¤ndare'}! Ã°Å¸â€˜â€¹`;
  }
}


async function fetchWithAuth(endpoint, options = {}) {
  const baseUrl = window.API_CONFIG?.baseUrl || 'https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net';
  const url = `${baseUrl}${endpoint}`;
  
  let token = null;
  if (window.entraAuth) {
    try {
      token = await window.entraAuth.getAccessToken();
    } catch (error) {
      console.log('Could not get access token:', error);
    }
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, { 
    ...options,
    headers 
  });
}

// ===== TABLE RENDERING FUNCTIONS =====

function renderCompaniesTable(companies) {
  const tableHtml = `
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FÃ¶retag</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VarumÃ¤rke</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Org.nr</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-post</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ã…tgÃ¤rder</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        ${companies.map(company => `
          <tr class="hover:bg-gray-50 cursor-pointer" onclick="showCompanyDetails('${company._id}')">
            <td class="px-6 py-4 whitespace-nowrap">${escapeHtml(company.name)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${escapeHtml(company.brand)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(company.status)}">
                ${company.status || 'prospekt'}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">${escapeHtml(company.pipeline)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${escapeHtml(company.orgNumber)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${escapeHtml(company.email)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${escapeHtml(company.phone)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium" onclick="event.stopPropagation()">
              <button onclick="editCompany('${company._id}')" class="text-indigo-600 hover:text-indigo-900 mr-3">Redigera</button>
              <button onclick="deleteCompany('${company._id}')" class="text-red-600 hover:text-red-900">Ta bort</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  document.getElementById('companyTable').innerHTML = tableHtml;
}

function renderBrandsTable(brands) {
  const tableHtml = `
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VarumÃ¤rke</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Webbplats</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beskrivning</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ã…tgÃ¤rder</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        ${brands.map(brand => `
          <tr class="hover:bg-gray-50 cursor-pointer" onclick="showBrandDetails('${brand._id}')">
            <td class="px-6 py-4 whitespace-nowrap font-medium">${escapeHtml(brand.name)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${escapeHtml(brand.category)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(brand.status)}">
                ${brand.status || 'aktiv'}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              ${brand.website ? `<a href="${brand.website}" target="_blank" class="text-indigo-600 hover:text-indigo-900">${brand.website}</a>` : ''}
            </td>
            <td class="px-6 py-4">${escapeHtml(brand.description)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium" onclick="event.stopPropagation()">
              <button onclick="editBrand('${brand._id}')" class="text-indigo-600 hover:text-indigo-900 mr-3">Redigera</button>
              <button onclick="deleteBrand('${brand._id}')" class="text-red-600 hover:text-red-900">Ta bort</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  document.getElementById('brandTable').innerHTML = tableHtml;
}

function renderAgentsTable(agents) {
  const tableHtml = `
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namn</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FÃ¶retag</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VarumÃ¤rke</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ort</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-post</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ã…tgÃ¤rder</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        ${agents.map(agent => `
          <tr class="hover:bg-gray-50 cursor-pointer" onclick="showAgentDetails('${agent._id}')">
            <td class="px-6 py-4 whitespace-nowrap font-medium">${agent.name || ''} ${agent.lastName || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">${escapeHtml(agent.company)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${escapeHtml(agent.brand)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${escapeHtml(agent.city)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(agent.status)}">
                ${agent.status || 'aktiv'}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">${escapeHtml(agent.email)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">${escapeHtml(agent.phone)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium" onclick="event.stopPropagation()">
              <button onclick="editAgent('${agent._id}')" class="text-indigo-600 hover:text-indigo-900 mr-3">Redigera</button>
              <button onclick="deleteAgent('${agent._id}')" class="text-red-600 hover:text-red-900">Ta bort</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  document.getElementById('agentTable').innerHTML = tableHtml;
}


// ===== DETAIL CARD FUNCTIONS =====

async function showCompanyDetails(id) {
  try {
    const response = await fetchWithAuth(`/api/companies/${id}`);
    const company = await response.json();
    
    const html = `
      <div class="modal modal-open">
        <div class="modal-box max-w-5xl max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-start mb-6">
            <div>
              <h3 class="font-bold text-3xl text-gray-800">${company.name}</h3>
              <p class="text-sm text-gray-500 mt-1">${company.orgNumber || 'Inget org.nr'}</p>
            </div>
            <button onclick="closeModal()" class="btn btn-sm btn-circle"></button>
          </div>
          
          <div class="divider my-4"></div>
          
          <div class="grid grid-cols-2 gap-8">
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">F?retagsinformation</h4>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Varum?rke</label>
                <p class="text-base mt-1 font-medium">${company.brand || '-'}</p>
              </div>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Kategori</label>
                <p class="text-base mt-1">${company.category || '-'}</p>
              </div>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Status</label>
                <div class="mt-1">
                  <span class="px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getStatusBadgeClass(company.status)}">
                    ${company.status || 'prospekt'}
                  </span>
                </div>
              </div>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Pipeline</label>
                <p class="text-base mt-1">${company.pipeline || '-'}</p>
              </div>
            </div>
            
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">Kontaktinformation</h4>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">E-post</label>
                <p class="text-base mt-1">${company.email ? '<a href="mailto:' + company.email + '" class="text-blue-600 hover:text-blue-800">' + company.email + '</a>' : '-'}</p>
              </div>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Telefon</label>
                <p class="text-base mt-1">${company.phone ? '<a href="tel:' + company.phone + '" class="text-blue-600 hover:text-blue-800">' + company.phone + '</a>' : '-'}</p>
              </div>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Ort</label>
                <p class="text-base mt-1">${company.city || '-'}</p>
              </div>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">L?n</label>
                <p class="text-base mt-1">${company.county || '-'}</p>
              </div>
            </div>
          </div>
          
          <div class="divider my-6"></div>
          
          <div class="grid grid-cols-2 gap-8">
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">Licensinformation</h4>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Antal licenser</label>
                <p class="text-base mt-1 font-semibold text-2xl text-blue-600">${company.licenseCount || '0'}</p>
              </div>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Produkt</label>
                <p class="text-base mt-1">${company.product || '-'}</p>
              </div>
            </div>
            
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">Betalning & Avtal</h4>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Betalningsinformation</label>
                <p class="text-base mt-1">${company.paymentInfo || '-'}</p>
              </div>
            </div>
          </div>
          
          <div class="modal-action mt-8 pt-4 border-t">
            <button onclick="closeModal()" class="btn btn-ghost">St?ng</button>
            <button onclick="closeModal(); editCompany('${company._id}')" class="btn btn-primary">Redigera f?retag</button>
          </div>
        </div>
        <div class="modal-backdrop bg-black bg-opacity-50" onclick="closeModal()"></div>
      </div>
    `;
    
    showModal(html);
  } catch (error) {
    console.error('Error loading company details:', error);
    alert('Kunde inte ladda f?retagsdetaljer');
  }
}

async function showBrandDetails(id) {
  try {
    const response = await fetchWithAuth(`/api/brands/${id}`);
    const brand = await response.json();
    
    const html = `
      <div class="modal modal-open">
        <div class="modal-box max-w-4xl max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-start mb-6">
            <div>
              <h3 class="font-bold text-3xl text-gray-800">${brand.name}</h3>
              <p class="text-sm text-gray-500 mt-1">${brand.category || 'Okategoriserad'}</p>
            </div>
            <button onclick="closeModal()" class="btn btn-sm btn-circle"></button>
          </div>
          
          <div class="divider my-4"></div>
          
          <div class="grid grid-cols-2 gap-8">
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">Information</h4>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Kategori</label>
                <p class="text-base mt-1 font-medium">${brand.category || '-'}</p>
              </div>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Status</label>
                <div class="mt-1">
                  <span class="px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getStatusBadgeClass(brand.status)}">
                    ${brand.status || 'aktiv'}
                  </span>
                </div>
              </div>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Webbplats</label>
                <p class="text-base mt-1">${brand.website ? '<a href="' + brand.website + '" target="_blank" class="text-blue-600 hover:text-blue-800 hover:underline">' + brand.website + ' </a>' : '-'}</p>
              </div>
            </div>
            
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">Beskrivning</h4>
              <div class="bg-gray-50 p-4 rounded-lg">
                <p class="text-base text-gray-700">${brand.description || 'Ingen beskrivning tillg?nglig'}</p>
              </div>
            </div>
          </div>
          
          <div class="modal-action mt-8 pt-4 border-t">
            <button onclick="closeModal()" class="btn btn-ghost">St?ng</button>
            <button onclick="closeModal(); editBrand('${brand._id}')" class="btn btn-primary">Redigera varum?rke</button>
          </div>
        </div>
        <div class="modal-backdrop bg-black bg-opacity-50" onclick="closeModal()"></div>
      </div>
    `;
    
    showModal(html);
  } catch (error) {
    console.error('Error loading brand details:', error);
    alert('Kunde inte ladda varum?rkesdetaljer');
  }
}

// Enhanced Agent Details Modal
// Replace the showAgentDetails function in app-simple.js with this version

async function showAgentDetails(id) {
  try {
    const response = await fetchWithAuth(`/api/agents/${id}`);
    const agent = await response.json();

    const html = `
      <div class="modal modal-open">
        <div class="modal-box max-w-5xl max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-start mb-6">
            <div>
              <h3 class="font-bold text-3xl text-gray-800">${agent.name || ''} ${agent.lastName || ''}</h3>
              <p class="text-sm text-gray-500 mt-1">${agent.role || 'MÃ¤klare'} ${agent.company ? 'pÃ¥ ' + agent.company : ''}</p>
              ${agent.brand ? `<p class="text-sm text-gray-400 mt-1">${agent.brand}</p>` : ''}
            </div>
            <button onclick="closeModal()" class="btn btn-sm btn-circle">âœ•</button>
          </div>

          <div class="divider my-4"></div>

          <div class="grid grid-cols-3 gap-6">
            <!-- Column 1: Basic Info -->
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">Grunduppgifter</h4>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Namn</label>
                <p class="text-base mt-1 font-medium">${agent.name || ''} ${agent.lastName || ''}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Registreringstyp</label>
                <p class="text-base mt-1">${agent.registrationType || '-'}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Roll</label>
                <p class="text-base mt-1">${agent.role || '-'}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Status</label>
                <div class="mt-1">
                  <span class="px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getStatusBadgeClass(agent.status)}">
                    ${agent.status || 'aktiv'}
                  </span>
                </div>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Licenstyp</label>
                <p class="text-base mt-1">${agent.licenseType || '-'}</p>
              </div>
            </div>

            <!-- Column 2: Company & Contact -->
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">FÃ¶retag & Kontakt</h4>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">FÃ¶retag</label>
                <p class="text-base mt-1 font-medium">${agent.company || '-'}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">VarumÃ¤rke</label>
                <p class="text-base mt-1">${agent.brand || '-'}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">E-post</label>
                <p class="text-base mt-1">${agent.email ? '<a href="mailto:' + agent.email + '" class="text-blue-600 hover:text-blue-800">' + agent.email + '</a>' : '-'}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Telefon</label>
                <p class="text-base mt-1">${agent.phone ? '<a href="tel:' + agent.phone + '" class="text-blue-600 hover:text-blue-800">' + agent.phone + '</a>' : '-'}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Adress</label>
                <p class="text-base mt-1">${escapeHtml(agent.address)}</p>
                <p class="text-sm text-gray-600">${agent.postalCode || ''} ${agent.city || ''}</p>
              </div>

              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Kontor</label>
                <p class="text-base mt-1">${agent.office || '-'}</p>
              </div>
            </div>

            <!-- Column 3: Broker Package & Products -->
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">MÃ¤klarpaket</h4>

              ${agent.brokerPackage ? `
                <div>
                  <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">AnvÃ¤ndare</label>
                  <p class="text-base mt-1">${agent.brokerPackage.userId || '-'}</p>
                </div>

                <div>
                  <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">MSN Namn</label>
                  <p class="text-base mt-1">${agent.brokerPackage.msnName || '-'}</p>
                </div>

                <div>
                  <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Aktiv</label>
                  <p class="text-base mt-1">
                    <span class="px-2 py-1 text-xs font-semibold rounded ${agent.brokerPackage.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                      ${agent.brokerPackage.active ? 'Ja' : 'Nej'}
                    </span>
                  </p>
                </div>

                <div>
                  <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Kostnad</label>
                  <p class="text-base mt-1 font-medium">${agent.brokerPackage.totalCost ? agent.brokerPackage.totalCost + ' kr' : '-'}</p>
                  ${agent.brokerPackage.discount ? `<p class="text-sm text-gray-600">Rabatt: ${agent.brokerPackage.discount} kr</p>` : ''}
                </div>
              ` : '<p class="text-gray-500 italic">Ingen mÃ¤klarpaket-information</p>'}

              ${agent.products && agent.products.length > 0 ? `
                <div class="mt-6">
                  <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Produkter</label>
                  <div class="mt-2 flex flex-wrap gap-2">
                    ${agent.products.map(p => `<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">${p}</span>`).join('')}
                  </div>
                </div>
              ` : ''}

              ${agent.matchType ? `
                <div>
                  <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Matchtyp</label>
                  <p class="text-base mt-1">${agent.matchType}</p>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="modal-action mt-8 pt-4 border-t">
            <button onclick="closeModal()" class="btn btn-ghost">StÃ¤ng</button>
            <button onclick="closeModal(); editAgent('${agent._id}')" class="btn btn-primary">Redigera mÃ¤klare</button>
          </div>
        </div>
        <div class="modal-backdrop bg-black bg-opacity-50" onclick="closeModal()"></div>
      </div>
    `;

    showModal(html);
  } catch (error) {
    console.error('Error loading agent details:', error);
    alert('Kunde inte ladda mÃ¤klardetaljer');
  }
}

window.closeModal = function() {
  const modal = document.querySelector('.modal-open');
  if (modal) {
    modal.remove();
  }
};

// ===== EDIT AND DELETE FUNCTIONS =====


// Helper function to safely escape HTML attribute values
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function editCompany(id) {
  try {
    const response = await fetchWithAuth(`/api/companies/${id}`);
    const company = await response.json();
    
    const html = `
      <div class="modal modal-open">
        <div class="modal-box max-w-3xl max-h-[90vh] overflow-y-auto">
          <h3 class="font-bold text-lg mb-4">Redigera f?retag</h3>
          <form id="editCompanyForm" class="space-y-3">
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text">F?retagsnamn *</span></label>
                <input type="text" name="name" value="${escapeHtml(company.name)}" class="input input-bordered w-full" required />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Organisationsnummer</span></label>
                <input type="text" name="orgNumber" value="${escapeHtml(company.orgNumber)}" class="input input-bordered w-full" />
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Varum?rke</span></label>
                <input type="text" name="brand" value="${escapeHtml(company.brand)}" class="input input-bordered w-full" />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Kategori</span></label>
                <input type="text" name="category" value="${escapeHtml(company.category)}" class="input input-bordered w-full" />
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Status</span></label>
                <select name="status" class="select select-bordered w-full">
                  <option value="prospekt" ${company.status === 'prospekt' ? 'selected' : ''}>Prospekt</option>
                  <option value="kund" ${company.status === 'kund' ? 'selected' : ''}>Kund</option>
                  <option value="inaktiv" ${company.status === 'inaktiv' ? 'selected' : ''}>Inaktiv</option>
                </select>
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Pipeline</span></label>
                <select name="pipeline" class="select select-bordered w-full">
                  <option value="prospect" ${company.pipeline === 'prospect' ? 'selected' : ''}>Prospekt</option>
                  <option value="active_customer" ${company.pipeline === 'active_customer' ? 'selected' : ''}>Aktiv kund</option>
                  <option value="churned" ${company.pipeline === 'churned' ? 'selected' : ''}>Avslutad</option>
                </select>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text">E-post</span></label>
                <input type="email" name="email" value="${escapeHtml(company.email)}" class="input input-bordered w-full" />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Telefon</span></label>
                <input type="tel" name="phone" value="${escapeHtml(company.phone)}" class="input input-bordered w-full" />
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Ort</span></label>
                <input type="text" name="city" value="${escapeHtml(company.city)}" class="input input-bordered w-full" />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">L?n</span></label>
                <input type="text" name="county" value="${escapeHtml(company.county)}" class="input input-bordered w-full" />
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Antal licenser</span></label>
                <input type="number" name="licenseCount" value="${company.licenseCount || 0}" class="input input-bordered w-full" />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Produkt</span></label>
                <input type="text" name="product" value="${escapeHtml(company.product)}" class="input input-bordered w-full" />
              </div>
            </div>
            
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Betalningsinformation</span></label>
              <input type="text" name="paymentInfo" value="${escapeHtml(company.paymentInfo)}" class="input input-bordered w-full" />
            </div>
            
            <div class="modal-action">
              <button type="button" class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
              <button type="submit" class="btn btn-primary">Spara ?ndringar</button>
            </div>
          </form>
        </div>
        <div class="modal-backdrop bg-black bg-opacity-50" onclick="closeModal()"></div>
      </div>
    `;
    
    showModal(html, async (formData) => {
      await updateEntity('companies', id, formData);
      loadCompanies();
    });
  } catch (error) {
    console.error('Error loading company for edit:', error);
    alert('Kunde inte ladda f?retag f?r redigering');
  }
}

async function editBrand(id) {
  try {
    const response = await fetchWithAuth(`/api/brands/${id}`);
    const brand = await response.json();
    
    const html = `
      <div class="modal modal-open">
        <div class="modal-box max-w-2xl">
          <h3 class="font-bold text-lg mb-4">Redigera varum?rke</h3>
          <form id="editBrandForm" class="space-y-4">
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Varum?rkesnamn *</span></label>
              <input type="text" name="name" value="${escapeHtml(brand.name)}" class="input input-bordered w-full" required />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Kategori</span></label>
              <input type="text" name="category" value="${escapeHtml(brand.category)}" class="input input-bordered w-full" />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Status</span></label>
              <select name="status" class="select select-bordered w-full">
                <option value="aktiv" ${brand.status === 'aktiv' ? 'selected' : ''}>Aktiv</option>
                <option value="inaktiv" ${brand.status === 'inaktiv' ? 'selected' : ''}>Inaktiv</option>
              </select>
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Webbplats</span></label>
              <input type="url" name="website" value="${escapeHtml(brand.website)}" class="input input-bordered w-full" />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Beskrivning</span></label>
              <textarea name="description" class="textarea textarea-bordered w-full" rows="4">${escapeHtml(brand.description)}</textarea>
            </div>
            
            <div class="modal-action">
              <button type="button" class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
              <button type="submit" class="btn btn-primary">Spara ?ndringar</button>
            </div>
          </form>
        </div>
        <div class="modal-backdrop bg-black bg-opacity-50" onclick="closeModal()"></div>
      </div>
    `;
    
    showModal(html, async (formData) => {
      await updateEntity('brands', id, formData);
      loadBrands();
    });
  } catch (error) {
    console.error('Error loading brand for edit:', error);
    alert('Kunde inte ladda varum?rke f?r redigering');
  }
}

async function editAgent(id) {
  try {
    const response = await fetchWithAuth(`/api/agents/${id}`);
    const agent = await response.json();
    
    const html = `
      <div class="modal modal-open">
        <div class="modal-box max-w-2xl">
          <h3 class="font-bold text-lg mb-4">Redigera m?klare</h3>
          <form id="editAgentForm" class="space-y-4">
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Namn *</span></label>
              <input type="text" name="name" value="${escapeHtml(agent.name)}" class="input input-bordered w-full" required />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">F?retag</span></label>
              <input type="text" name="company" value="${escapeHtml(agent.company)}" class="input input-bordered w-full" />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Roll</span></label>
              <input type="text" name="role" value="${escapeHtml(agent.role)}" class="input input-bordered w-full" />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Status</span></label>
              <select name="status" class="select select-bordered w-full">
                <option value="aktiv" ${agent.status === 'aktiv' ? 'selected' : ''}>Aktiv</option>
                <option value="inaktiv" ${agent.status === 'inaktiv' ? 'selected' : ''}>Inaktiv</option>
              </select>
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">E-post *</span></label>
              <input type="email" name="email" value="${escapeHtml(agent.email)}" class="input input-bordered w-full" required />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Telefon</span></label>
              <input type="tel" name="phone" value="${escapeHtml(agent.phone)}" class="input input-bordered w-full" />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Licenstyp</span></label>
              <input type="text" name="licenseType" value="${escapeHtml(agent.licenseType)}" class="input input-bordered w-full" />
            </div>
            
            <div class="modal-action">
              <button type="button" class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
              <button type="submit" class="btn btn-primary">Spara ?ndringar</button>
            </div>
          </form>
        </div>
        <div class="modal-backdrop bg-black bg-opacity-50" onclick="closeModal()"></div>
      </div>
    `;
    
    showModal(html, async (formData) => {
      await updateEntity('agents', id, formData);
      loadAgents();
    });
  } catch (error) {
    console.error('Error loading agent for edit:', error);
    alert('Kunde inte ladda m?klare f?r redigering');
  }
}

async function updateEntity(entityType, id, data) {
  try {
    const response = await fetchWithAuth(`/api/${entityType}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    
    if (!response.ok) throw new Error('Update failed');
    alert('Uppdaterat!');
    closeModal();
  } catch (error) {
    console.error(`Error updating ${entityType}:`, error);
    alert(`Kunde inte uppdatera ${entityType}`);
  }
}

async function deleteCompany(id) {
  if (!confirm('?r du s?ker p? att du vill ta bort detta f?retag?')) return;
  
  try {
    const response = await fetchWithAuth(`/api/companies/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Delete failed');
    alert('F?retaget har tagits bort');
    loadCompanies();
  } catch (error) {
    console.error('Error deleting company:', error);
    alert('Kunde inte ta bort f?retaget');
  }
}

async function deleteBrand(id) {
  if (!confirm('?r du s?ker p? att du vill ta bort detta varum?rke?')) return;
  
  try {
    const response = await fetchWithAuth(`/api/brands/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Delete failed');
    alert('Varum?rket har tagits bort');
    loadBrands();
  } catch (error) {
    console.error('Error deleting brand:', error);
    alert('Kunde inte ta bort varum?rket');
  }
}

async function deleteAgent(id) {
  if (!confirm('?r du s?ker p? att du vill ta bort denna m?klare?')) return;
  
  try {
    const response = await fetchWithAuth(`/api/agents/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Delete failed');
    alert('M?klaren har tagits bort');
    loadAgents();
  } catch (error) {
    console.error('Error deleting agent:', error);
    alert('Kunde inte ta bort m?klaren');
  }
}

// Make edit/delete functions globally available for onclick handlers
window.editCompany = editCompany;
window.editBrand = editBrand;
window.editAgent = editAgent;
window.deleteCompany = deleteCompany;
window.deleteBrand = deleteBrand;
window.deleteAgent = deleteAgent;


function getStatusBadgeClass(status) {
  const statusLower = (status || '').toLowerCase();
  if (statusLower === 'aktiv' || statusLower === 'kund') return 'bg-green-100 text-green-800';
  if (statusLower === 'prospekt' || statusLower === 'pending') return 'bg-yellow-100 text-yellow-800';
  if (statusLower === 'inaktiv' || statusLower === 'archived') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}
async function loadBrands() {
  console.log('Loading brands data...');
  try {
    const response = await fetchWithAuth('/api/brands');
    const brands = await response.json();
    renderBrandsTable(brands);
  } catch (error) {
    console.error('Error loading brands:', error);
    document.getElementById('brandTable').innerHTML = '<p class="text-red-500">Fel vid laddning av varumÃ¤rken</p>';
  }
}

async function loadCompanies() {
  console.log('Loading companies data...');
  try {
    const response = await fetchWithAuth('/api/companies');
    const companies = await response.json();
    renderCompaniesTable(companies);
  } catch (error) {
    console.error('Error loading companies:', error);
    document.getElementById('companyTable').innerHTML = '<p class="text-red-500">Fel vid laddning av fÃ¶retag</p>';
  }
}

async function loadAgents() {
  console.log('Loading agents data...');
  try {
    const response = await fetchWithAuth('/api/agents');
    const agents = await response.json();
    renderAgentsTable(agents);
  } catch (error) {
    console.error('Error loading agents:', error);
    document.getElementById('agentTable').innerHTML = '<p class="text-red-500">Fel vid laddning av mÃ¤klare</p>';
  }
}

function loadPipeline() {
  console.log('Loading pipeline view...');
  // Pipeline template is already loaded
}

function loadCustomerSuccess() {
  console.log('Loading customer success view...');
  // Customer success template is already loaded
}

function loadLicenses() {
  console.log('Loading licenses view...');
  // Licenses template is already loaded
}

function loadImport() {
  console.log('Loading import view...');
  
  // Set up file input handler
  setTimeout(() => {
    const fileInput = document.getElementById('fileInput');
    const applyImportBtn = document.getElementById('applyImport');
    const importResult = document.getElementById('importResult');
    
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          console.log('File selected:', file.name);
          if (applyImportBtn) {
            applyImportBtn.disabled = false;
          }
          if (importResult) {
            importResult.textContent = `Fil vald: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
          }
        }
      });
    }
    
    if (applyImportBtn) {
      applyImportBtn.addEventListener('click', async () => {
        const file = fileInput?.files[0];
        if (!file) {
          alert('VÃƒÂ¤lj en fil fÃƒÂ¶rst');
          return;
        }
        
        await handleExcelImport(file);
      });
    }
    
    // Server import buttons
    const serverImportBtn = document.getElementById('applyImportServer');
    const ortsprisBtn = document.getElementById('applyImportOrtspris');
    const maklarpaketBtn = document.getElementById('applyImportMaklarpaket');
    
    if (serverImportBtn) {
      serverImportBtn.addEventListener('click', () => handleServerImport('default'));
    }
    
    if (ortsprisBtn) {
      ortsprisBtn.addEventListener('click', () => handleServerImport('ortspris'));
    }
    
    if (maklarpaketBtn) {
      maklarpaketBtn.addEventListener('click', () => handleServerImport('maklarpaket'));
    }
  }, 100);
}

async function handleExcelImport(file) {
  console.log('Starting Excel import:', file.name);
  
  const importResult = document.getElementById('importResult');
  const applyImportBtn = document.getElementById('applyImport');
  
  if (importResult) {
    importResult.textContent = 'LÃƒÂ¤ser Excel-fil...';
  }
  
  if (applyImportBtn) {
    applyImportBtn.disabled = true;
  }
  
  try {
    // Check if XLSX library is loaded
    if (typeof XLSX === 'undefined') {
      throw new Error('XLSX-bibliotek inte laddat');
    }
    
    // Read file
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    
    console.log('Workbook loaded:', workbook.SheetNames);
    
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
    
    console.log('Parsed data:', jsonData.length, 'rows');
    
    if (importResult) {
      importResult.innerHTML = `
        <div class="alert alert-success">
          <span>Ã¢Å“â€œ LÃƒÂ¤ste ${jsonData.length} rader frÃƒÂ¥n ${workbook.SheetNames[0]}</span>
        </div>
        <div class="mt-2">
          <strong>Kolumner:</strong> ${Object.keys(jsonData[0] || {}).join(', ')}
        </div>
      `;
    }
    
    // Send to API
    const response = await fetchWithAuth('/api/import', {
      method: 'POST',
      body: JSON.stringify({
        type: 'excel',
        data: jsonData,
        filename: file.name
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (importResult) {
        importResult.innerHTML = `
          <div class="alert alert-success">
            <span>Ã¢Å“â€œ Import lyckades! ${result.imported || 0} poster importerade.</span>
          </div>
        `;
      }
    } else {
      throw new Error('Import misslyckades');
    }
    
  } catch (error) {
    console.error('Import error:', error);
    if (importResult) {
      importResult.innerHTML = `
        <div class="alert alert-error">
          <span>Ã¢Å“â€” Fel vid import: ${error.message}</span>
        </div>
      `;
    }
  } finally {
    if (applyImportBtn) {
      applyImportBtn.disabled = false;
    }
  }
}

async function handleServerImport(type) {
  console.log('Starting server import:', type);
  
  const importResult = document.getElementById('importResult');
  
  if (importResult) {
    importResult.textContent = 'Startar serverimport...';
  }
  
  try {
    const response = await fetchWithAuth(`/api/import/server?type=${type}`, {
      method: 'POST'
    });
    
    if (response.ok) {
      const result = await response.json();
      if (importResult) {
        importResult.innerHTML = `
          <div class="alert alert-success">
            <span>Ã¢Å“â€œ Serverimport lyckades! ${result.imported || 0} poster importerade.</span>
          </div>
        `;
      }
    } else {
      const error = await response.json();
      throw new Error(error.message || 'Serverimport misslyckades');
    }
  } catch (error) {
    console.error('Server import error:', error);
    if (importResult) {
      importResult.innerHTML = `
        <div class="alert alert-error">
          <span>Ã¢Å“â€” Fel vid serverimport: ${error.message}</span>
        </div>
      `;
    }
  }
}

function loadSettings() {
  console.log('Loading settings view...');
  // Settings template is already loaded
}



function renderCustomers(customers) {
  const table = document.querySelector('#customers-view table tbody');
  if (!table) {
    console.warn('Customer table not found');
    return;
  }
  
  table.innerHTML = customers.map(customer => `
    <tr>
      <td>${customer.name || 'N/A'}</td>
      <td>${customer.email || '-'}</td>
      <td>${customer.phone || '-'}</td>
      <td>
        <button class="btn btn-xs btn-primary" onclick="editCustomer(${customer.id})">Redigera</button>
      </td>
    </tr>
  `).join('');
}

function renderDeals(deals) {
  const table = document.querySelector('#deals-view table tbody');
  if (!table) {
    console.warn('Deals table not found');
    return;
  }
  
  table.innerHTML = deals.map(deal => `
    <tr>
      <td>${deal.title || 'N/A'}</td>
      <td>${deal.customer || '-'}</td>
      <td>${deal.value ? deal.value.toLocaleString('sv-SE') + ' kr' : '-'}</td>
      <td><span class="badge badge-sm">${deal.status || 'unknown'}</span></td>
      <td>
        <button class="btn btn-xs btn-primary" onclick="editDeal(${deal.id})">Redigera</button>
      </td>
    </tr>
  `).join('');
}

function renderActivities(activities) {
  const table = document.querySelector('#activities-view table tbody');
  if (!table) {
    console.warn('Activities table not found');
    return;
  }
  
  table.innerHTML = activities.map(activity => `
    <tr>
      <td>${activity.title || 'N/A'}</td>
      <td><span class="badge badge-sm">${activity.type || 'unknown'}</span></td>
      <td>${activity.date ? new Date(activity.date).toLocaleDateString('sv-SE') : '-'}</td>
      <td>
        <button class="btn btn-xs btn-primary" onclick="editActivity(${activity.id})">Redigera</button>
      </td>
    </tr>
  `).join('');
}

function showDemoMessage(entityType) {
  const currentViewEl = document.getElementById(`${appState.currentView}-view`);
  if (currentViewEl) {
    const messageEl = document.createElement('div');
    messageEl.className = 'alert alert-info mt-4';
    messageEl.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <span>Kunde inte ladda ${entityType} frÃƒÂ¥n API. Visar demo-data.</span>
    `;
    currentViewEl.insertBefore(messageEl, currentViewEl.firstChild);
  }
}

function setupButtonHandlers() {
  console.log('Setting up button handlers...');
  
  // Wait for buttons to be in DOM
  setTimeout(() => {
    // Add brand button
    const addBrandBtn = document.getElementById('addBrand');
    if (addBrandBtn) {
      addBrandBtn.addEventListener('click', () => showAddBrandForm());
    }
    
    // Add company button  
    const addCompanyBtn = document.getElementById('addCompany');
    if (addCompanyBtn) {
      addCompanyBtn.addEventListener('click', () => showAddCompanyForm());
    }
    
    // Add agent button
    const addAgentBtn = document.getElementById('addAgent');
    if (addAgentBtn) {
      addAgentBtn.addEventListener('click', () => showAddAgentForm());
    }
    
    // Add deal button
    const addDealBtn = document.getElementById('addDealBtn');
    if (addDealBtn) {
      addDealBtn.addEventListener('click', () => showAddDealForm());
    }
    
    // Add task button
    const addTaskBtn = document.getElementById('addTask');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => showAddTaskForm());
    }
    
    console.log('Button handlers set up');
  }, 200);
}

// Set up event handlers for a specific view
function setupViewEventHandlers(viewName, viewElement) {
  console.log(`Ã°Å¸â€œâ€¹ ====== setupViewEventHandlers START ======`);
  console.log(`Ã°Å¸â€œâ€¹ View: ${viewName}`);
  console.log(`Ã°Å¸â€œâ€¹ ViewElement:`, viewElement);
  console.log(`Ã°Å¸â€œâ€¹ ViewElement ID:`, viewElement.id);
  console.log(`Ã°Å¸â€œâ€¹ ViewElement innerHTML length:`, viewElement.innerHTML.length);
  
  // Log all buttons in the view
  const allButtons = viewElement.querySelectorAll('button');
  console.log(`Ã°Å¸â€œâ€¹ Found ${allButtons.length} total buttons in view`);
  allButtons.forEach(btn => {
    console.log(`  Ã°Å¸â€œÅ’ Button: id="${btn.id}", class="${btn.className}", text="${btn.textContent.trim().substring(0, 30)}"`);
  });
  
  // Find all buttons with data-action in this view
  const actionButtons = viewElement.querySelectorAll('[data-action]');
  console.log(`Ã°Å¸â€œâ€¹ Found ${actionButtons.length} buttons with data-action`);
  actionButtons.forEach(button => {
    const action = button.getAttribute('data-action');
    console.log(`Found button with action: ${action}`);
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      handleButtonAction(action, viewName);
    });
  });
  
  // Helper function to find and set up a button
  const setupButton = (buttonId, handler, description) => {
    console.log(`Ã°Å¸â€Â Looking for button: #${buttonId} (${description})`);
    
    // Try to find in viewElement first
    let button = viewElement.querySelector(`#${buttonId}`);
    console.log(`  viewElement.querySelector('#${buttonId}'):`, button);
    
    // If not found, try document (for cases where querySelector doesn't work)
    if (!button) {
      console.log(`  Trying document.getElementById...`);
      button = document.getElementById(buttonId);
      console.log(`  document.getElementById('${buttonId}'):`, button);
    }
    
    if (button) {
      console.log(`Ã¢Å“â€¦ FOUND ${description} button (#${buttonId}) - Attaching listener`);
      // Remove any existing listeners by cloning
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      newButton.addEventListener('click', (e) => {
        e.preventDefault();
        console.log(`Ã°Å¸â€“Â±Ã¯Â¸Â ${description} button CLICKED!`);
        handler();
      });
    } else {
      console.error(`Ã¢ÂÅ’ Button #${buttonId} NOT FOUND for ${description}`);
    }
  };
  
  console.log(`Ã°Å¸â€Â§ Setting up button handlers...`);
  setupButton('addBrand', showAddBrandForm, 'Add Brand');
  setupButton('addCompany', showAddCompanyForm, 'Add Company');
  setupButton('addAgent', showAddAgentForm, 'Add Agent');
  setupButton('addDealBtn', showAddDealForm, 'Add Deal');
  setupButton('addTask', showAddTaskForm, 'Add Task');
  
  // Set up dropdown handlers
  const dropdowns = viewElement.querySelectorAll('select');
  if (dropdowns.length === 0) {
    // Try document if not found in viewElement
    const allDropdowns = document.querySelectorAll(`#view-${viewName} select`);
    console.log(`Found ${allDropdowns.length} dropdowns in document for ${viewName}`);
    allDropdowns.forEach(dropdown => {
      dropdown.addEventListener('change', (e) => {
        console.log(`Dropdown changed: ${dropdown.id || 'unnamed'} = ${e.target.value}`);
        handleDropdownChange(dropdown, e.target.value, viewName);
      });
    });
  } else {
    console.log(`Found ${dropdowns.length} dropdowns in viewElement`);
    dropdowns.forEach(dropdown => {
      dropdown.addEventListener('change', (e) => {
        console.log(`Dropdown changed: ${dropdown.id || 'unnamed'} = ${e.target.value}`);
        handleDropdownChange(dropdown, e.target.value, viewName);
      });
    });
  }
  
  console.log(`Ã¢Å“â€œ Event handlers set up for ${viewName}`);
}

// Handle button actions
function handleButtonAction(action, viewName) {
  console.log(`Handling action: ${action} in view: ${viewName}`);
  
  switch(action) {
    case 'add-brand':
      showAddBrandForm();
      break;
    case 'add-company':
      showAddCompanyForm();
      break;
    case 'add-agent':
      showAddAgentForm();
      break;
    case 'add-deal':
      showAddDealForm();
      break;
    case 'add-task':
      showAddTaskForm();
      break;
    default:
      console.warn(`Unknown action: ${action}`);
  }
}

// Handle dropdown changes
function handleDropdownChange(dropdown, value, viewName) {
  const dropdownId = dropdown.id;
  
  // Handle specific dropdowns based on their ID
  if (dropdownId === 'segmentFilter') {
    console.log(`Filtering by segment: ${value}`);
    // Apply segment filter
  } else if (dropdownId === 'statusFilter') {
    console.log(`Filtering by status: ${value}`);
    // Apply status filter
  }
}

// Show forms for creating new entities
function showAddBrandForm() {
  console.log('Ã°Å¸Å½Â¯ showAddBrandForm called!');
  const html = `
    <div class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">LÃƒÂ¤gg till nytt varumÃƒÂ¤rke</h3>
        <form id="addBrandForm" class="space-y-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">VarumÃƒÂ¤rkesnamn *</span>
            </label>
            <input type="text" name="name" placeholder="Ange varumÃƒÂ¤rkesnamn" class="input input-bordered w-full" required />
          </div>
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Beskrivning</span>
            </label>
            <textarea name="description" placeholder="Beskriv varumÃƒÂ¤rket..." class="textarea textarea-bordered w-full" rows="4"></textarea>
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
            <button type="submit" class="btn btn-primary">Spara varumÃƒÂ¤rke</button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button onclick="closeModal()">close</button>
      </form>
    </div>
  `;
  
  showModal(html, async (formData) => {
    await createEntity('brands', formData);
    loadBrands();
  });
}

function showAddCompanyForm() {
  console.log('Ã°Å¸Å½Â¯ showAddCompanyForm called!');
  const html = `
    <div class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">LÃƒÂ¤gg till nytt fÃƒÂ¶retag</h3>
        <form id="addCompanyForm" class="space-y-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">FÃƒÂ¶retagsnamn *</span>
            </label>
            <input type="text" name="name" placeholder="Ange fÃƒÂ¶retagsnamn" class="input input-bordered w-full" required />
          </div>
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Organisationsnummer</span>
            </label>
            <input type="text" name="orgNumber" placeholder="XXXXXX-XXXX" class="input input-bordered w-full" />
          </div>
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">E-post</span>
            </label>
            <input type="email" name="email" placeholder="kontakt@foretag.se" class="input input-bordered w-full" />
          </div>
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Telefon</span>
            </label>
            <input type="tel" name="phone" placeholder="08-XXX XX XX" class="input input-bordered w-full" />
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
            <button type="submit" class="btn btn-primary">Spara fÃƒÂ¶retag</button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button onclick="closeModal()">close</button>
      </form>
    </div>
  `;
  
  showModal(html, async (formData) => {
    await createEntity('companies', formData);
    loadCompanies();
  });
}

function showAddAgentForm() {
  console.log('Ã°Å¸Å½Â¯ showAddAgentForm called!');
  const html = `
    <div class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">LÃƒÂ¤gg till ny mÃƒÂ¤klare</h3>
        <form id="addAgentForm" class="space-y-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Namn *</span>
            </label>
            <input type="text" name="name" placeholder="FÃƒÂ¶r- och efternamn" class="input input-bordered w-full" required />
          </div>
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">E-post *</span>
            </label>
            <input type="email" name="email" placeholder="namn@maklarforetag.se" class="input input-bordered w-full" required />
          </div>
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Telefon</span>
            </label>
            <input type="tel" name="phone" placeholder="070-XXX XX XX" class="input input-bordered w-full" />
          </div>
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">FÃƒÂ¶retag</span>
            </label>
            <input type="text" name="company" placeholder="MÃƒÂ¤klarfÃƒÂ¶retag AB" class="input input-bordered w-full" />
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
            <button type="submit" class="btn btn-primary">Spara mÃƒÂ¤klare</button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button onclick="closeModal()">close</button>
      </form>
    </div>
  `;
  
  showModal(html, async (formData) => {
    await createEntity('agents', formData);
    loadAgents();
  });
}

function showAddDealForm() {
  const html = `
    <div class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Skapa ny affÃƒÂ¤r</h3>
        <form id="addDealForm" class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Titel *</span></label>
            <input type="text" name="title" class="input input-bordered" required />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">VÃƒÂ¤rde (kr)</span></label>
            <input type="number" name="value" class="input input-bordered" />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Kund</span></label>
            <input type="text" name="customer" class="input input-bordered" />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Status</span></label>
            <select name="status" class="select select-bordered">
              <option value="lead">Lead</option>
              <option value="proposal">Offert</option>
              <option value="negotiation">FÃƒÂ¶rhandling</option>
              <option value="won">Vunnen</option>
              <option value="lost">FÃƒÂ¶rlorad</option>
            </select>
          </div>
          <div class="modal-action">
            <button type="button" class="btn" onclick="closeModal()">Avbryt</button>
            <button type="submit" class="btn btn-primary">Spara</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  showModal(html, async (formData) => {
    await createEntity('deals', formData);
    loadPipeline();
  });
}

function showAddTaskForm() {
  const html = `
    <div class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Ny uppgift</h3>
        <form id="addTaskForm" class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Titel *</span></label>
            <input type="text" name="title" class="input input-bordered" required />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Beskrivning</span></label>
            <textarea name="description" class="textarea textarea-bordered"></textarea>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Deadline</span></label>
            <input type="date" name="deadline" class="input input-bordered" />
          </div>
          <div class="modal-action">
            <button type="button" class="btn" onclick="closeModal()">Avbryt</button>
            <button type="submit" class="btn btn-primary">Spara</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  showModal(html, async (formData) => {
    await createEntity('tasks', formData);
    loadDashboard();
  });
}

function showModal(html, onSubmit) {
  // Remove existing modal if any
  const existingModal = document.querySelector('.modal-open');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', html);
  
  // Set up form submit handler
  const form = document.querySelector('.modal-open form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      try {
        await onSubmit(data);
        closeModal();
      } catch (error) {
        alert('Fel vid sparande: ' + error.message);
      }
    });
  }
}

window.closeModal = function() {
  const modal = document.querySelector('.modal-open');
  if (modal) {
    modal.remove();
  }
};

async function createEntity(entityType, data) {
  console.log('Creating', entityType, data);
  
  try {
    const response = await fetchWithAuth(`/api/${entityType}`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', errorText);
      throw new Error(`Failed to create ${entityType}: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Created:', result);
    
    // Show success message
    showNotification(`${entityType} skapad!`, 'success');
    
    return result;
  } catch (error) {
    console.error('Error creating entity:', error);
    showNotification(`Fel vid skapande: ${error.message}`, 'error');
    throw error;
  }
}

function showNotification(message, type = 'info') {
  const alertClass = type === 'success' ? 'alert-success' : type === 'error' ? 'alert-error' : 'alert-info';
  
  const notification = document.createElement('div');
  notification.className = `alert ${alertClass} fixed top-4 right-4 w-96 z-50 shadow-lg`;
  notification.innerHTML = `<span>${message}</span>`;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Global functions for inline onclick handlers
window.editCustomer = function(id) {
  console.log('Edit customer:', id);
  alert(`Redigera kund ${id} - funktion kommer snart!`);
};

window.editDeal = function(id) {
  console.log('Edit deal:', id);
  alert(`Redigera affÃƒÂ¤r ${id} - funktion kommer snart!`);
};

window.editActivity = function(id) {
  console.log('Edit activity:', id);
  alert(`Redigera aktivitet ${id} - funktion kommer snart!`);
};

console.log('Simple CRM app script loaded');












// Force deployment: 12/09/2025 17:00:13













// ============================================================================
// BRAND DETAILS MODAL - FAS 2: Enhanced Brand Details
// ============================================================================

let currentBrand = null;

// Open brand details modal
async function openBrandDetailsModal(brand) {
  currentBrand = brand;
  
  // Update title
  document.getElementById('brandDetailsTitle').textContent = brand.name || 'Varumärke';
  
  // Update stats
  document.getElementById('brandStatCompanies').textContent = (brand.companies?.length || 0).toString();
  document.getElementById('brandStatAgents').textContent = (brand.agentCount || 0).toString();
  document.getElementById('brandStatMRR').textContent = `${Math.round(brand.totalMRR || 0).toLocaleString('sv-SE')} kr`;
  
  // Load central contract
  loadCentralContract(brand.centralContract);
  
  // Load contacts
  renderContactsList(brand.contacts || []);
  
  // Load tasks
  renderTasksList(brand.tasks || []);
  
  // Load notes
  renderNotesList(brand.notes || []);
  
  // Load companies (with pagination)
  await loadBrandCompanies(brand.id);
  
  // Setup tabs
  setupBrandModalTabs();
  
  // Open modal
  document.getElementById('brandDetailsModal').showModal();
}

function closeBrandDetailsModal() {
  currentBrand = null;
  document.getElementById('brandDetailsModal').close();
}

// Tab switching
function setupBrandModalTabs() {
  const tabs = document.querySelectorAll('#brandDetailsModal .tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs
      tabs.forEach(t => t.classList.remove('tab-active'));
      // Add active to clicked tab
      tab.classList.add('tab-active');
      
      // Hide all tab contents
      document.querySelectorAll('#brandDetailsModal .tab-content').forEach(content => {
        content.classList.add('hidden');
      });
      
      // Show selected tab content
      const tabName = tab.dataset.tab;
      document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    });
  });
}

// ============================================================================
// CENTRAL CONTRACT
// ============================================================================

function loadCentralContract(contract) {
  const activeCheckbox = document.getElementById('ccActive');
  const detailsDiv = document.getElementById('ccDetails');
  
  if (contract && contract.active) {
    activeCheckbox.checked = true;
    detailsDiv.style.display = 'block';
    
    document.getElementById('ccProduct').value = contract.product || '';
    document.getElementById('ccMrr').value = contract.mrr || '';
    document.getElementById('ccStartDate').value = contract.startDate ? contract.startDate.split('T')[0] : '';
    document.getElementById('ccContactPerson').value = contract.contactPerson || '';
    document.getElementById('ccContactEmail').value = contract.contactEmail || '';
  } else {
    activeCheckbox.checked = false;
    detailsDiv.style.display = 'none';
  }
  
  // Toggle details on checkbox change
  activeCheckbox.onchange = () => {
    detailsDiv.style.display = activeCheckbox.checked ? 'block' : 'none';
  };
}

async function saveCentralContract() {
  if (!currentBrand) return;
  
  const active = document.getElementById('ccActive').checked;
  
  const contractData = {
    active,
    product: document.getElementById('ccProduct').value,
    mrr: parseFloat(document.getElementById('ccMrr').value) || 0,
    startDate: document.getElementById('ccStartDate').value,
    contactPerson: document.getElementById('ccContactPerson').value,
    contactEmail: document.getElementById('ccContactEmail').value
  };
  
  try {
    const updated = await fetchWithAuth(`/api/brands/${currentBrand.id}/central-contract`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contractData)
    });
    
    currentBrand.centralContract = updated.centralContract;
    showNotification('Central avtal uppdaterat', 'success');
  } catch (error) {
    console.error('Error saving central contract:', error);
    showNotification('Kunde inte spara central avtal', 'error');
  }
}

// ============================================================================
// CONTACTS
// ============================================================================

function renderContactsList(contacts) {
  const listEl = document.getElementById('contactsList');
  
  if (!contacts || contacts.length === 0) {
    listEl.innerHTML = '<p class="text-base-content/50">Inga kontakter ännu</p>';
    return;
  }
  
  listEl.innerHTML = contacts.map(contact => `
    <div class="card bg-base-200 shadow">
      <div class="card-body p-4">
        <div class="flex justify-between items-start">
          <div>
            <h4 class="font-bold">${contact.name}</h4>
            ${contact.role ? `<p class="text-sm text-base-content/70">${contact.role}</p>` : ''}
            ${contact.email ? `<p class="text-sm"><a href="mailto:${contact.email}" class="link">${contact.email}</a></p>` : ''}
            ${contact.phone ? `<p class="text-sm">${contact.phone}</p>` : ''}
            <p class="text-xs text-base-content/50 mt-2">Tillagd ${new Date(contact.createdAt).toLocaleDateString('sv-SE')}</p>
          </div>
          <button class="btn btn-ghost btn-sm btn-circle" onclick="deleteContact('${contact.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function addContactForm() {
  document.getElementById('addContactFormDiv').classList.remove('hidden');
  document.getElementById('newContactName').focus();
}

function cancelAddContact() {
  document.getElementById('addContactFormDiv').classList.add('hidden');
  // Clear form
  document.getElementById('newContactName').value = '';
  document.getElementById('newContactRole').value = '';
  document.getElementById('newContactEmail').value = '';
  document.getElementById('newContactPhone').value = '';
}

async function saveNewContact() {
  if (!currentBrand) return;
  
  const name = document.getElementById('newContactName').value.trim();
  if (!name) {
    showNotification('Namn är obligatoriskt', 'warning');
    return;
  }
  
  const contactData = {
    name,
    role: document.getElementById('newContactRole').value.trim(),
    email: document.getElementById('newContactEmail').value.trim(),
    phone: document.getElementById('newContactPhone').value.trim()
  };
  
  try {
    const updated = await fetchWithAuth(`/api/brands/${currentBrand.id}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactData)
    });
    
    currentBrand.contacts = updated.contacts;
    renderContactsList(currentBrand.contacts);
    cancelAddContact();
    showNotification('Kontakt tillagd', 'success');
  } catch (error) {
    console.error('Error adding contact:', error);
    showNotification('Kunde inte lägga till kontakt', 'error');
  }
}

async function deleteContact(contactId) {
  if (!currentBrand) return;
  if (!confirm('Är du säker på att du vill ta bort denna kontakt?')) return;
  
  try {
    const updated = await fetchWithAuth(`/api/brands/${currentBrand.id}/contacts/${contactId}`, {
      method: 'DELETE'
    });
    
    currentBrand.contacts = updated.contacts;
    renderContactsList(currentBrand.contacts);
    showNotification('Kontakt borttagen', 'success');
  } catch (error) {
    console.error('Error deleting contact:', error);
    showNotification('Kunde inte ta bort kontakt', 'error');
  }
}

// ============================================================================
// TASKS
// ============================================================================

function renderTasksList(tasks) {
  const listEl = document.getElementById('tasksList');
  
  if (!tasks || tasks.length === 0) {
    listEl.innerHTML = '<p class="text-base-content/50">Inga uppgifter ännu</p>';
    return;
  }
  
  // Sort by due date (upcoming first), then by done status
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.dueAt && b.dueAt) return new Date(a.dueAt) - new Date(b.dueAt);
    return 0;
  });
  
  listEl.innerHTML = sortedTasks.map(task => {
    const isOverdue = task.dueAt && new Date(task.dueAt) < new Date() && !task.done;
    
    return `
      <div class="card bg-base-200 shadow ${task.done ? 'opacity-60' : ''}">
        <div class="card-body p-4">
          <div class="flex items-start gap-3">
            <input type="checkbox" class="checkbox checkbox-primary" ${task.done ? 'checked' : ''} 
                   onchange="toggleTaskDone('${task.id}', this.checked)" />
            <div class="flex-1">
              <h4 class="font-bold ${task.done ? 'line-through' : ''}">${task.title}</h4>
              ${task.description ? `<p class="text-sm text-base-content/70 mt-1">${task.description}</p>` : ''}
              ${task.dueAt ? `
                <p class="text-xs mt-2 ${isOverdue ? 'text-error font-semibold' : 'text-base-content/50'}">
                   ${new Date(task.dueAt).toLocaleString('sv-SE')}
                </p>
              ` : ''}
            </div>
            <button class="btn btn-ghost btn-sm btn-circle" onclick="deleteTask('${task.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function addTaskForm() {
  document.getElementById('addTaskFormDiv').classList.remove('hidden');
  document.getElementById('newTaskTitle').focus();
}

function cancelAddTask() {
  document.getElementById('addTaskFormDiv').classList.add('hidden');
  document.getElementById('newTaskTitle').value = '';
  document.getElementById('newTaskDescription').value = '';
  document.getElementById('newTaskDueAt').value = '';
}

async function saveNewTask() {
  if (!currentBrand) return;
  
  const title = document.getElementById('newTaskTitle').value.trim();
  if (!title) {
    showNotification('Titel är obligatoriskt', 'warning');
    return;
  }
  
  const taskData = {
    title,
    description: document.getElementById('newTaskDescription').value.trim(),
    dueAt: document.getElementById('newTaskDueAt').value || null
  };
  
  try {
    const updated = await fetchWithAuth(`/api/brands/${currentBrand.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });
    
    currentBrand.tasks = updated.tasks;
    renderTasksList(currentBrand.tasks);
    cancelAddTask();
    showNotification('Uppgift tillagd', 'success');
  } catch (error) {
    console.error('Error adding task:', error);
    showNotification('Kunde inte lägga till uppgift', 'error');
  }
}

async function toggleTaskDone(taskId, done) {
  if (!currentBrand) return;
  
  try {
    const updated = await fetchWithAuth(`/api/brands/${currentBrand.id}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done })
    });
    
    currentBrand.tasks = updated.tasks;
    renderTasksList(currentBrand.tasks);
    showNotification(done ? 'Uppgift markerad som klar' : 'Uppgift markerad som ej klar', 'success');
  } catch (error) {
    console.error('Error updating task:', error);
    showNotification('Kunde inte uppdatera uppgift', 'error');
  }
}

async function deleteTask(taskId) {
  if (!currentBrand) return;
  if (!confirm('Är du säker på att du vill ta bort denna uppgift?')) return;
  
  try {
    const updated = await fetchWithAuth(`/api/brands/${currentBrand.id}/tasks/${taskId}`, {
      method: 'DELETE'
    });
    
    currentBrand.tasks = updated.tasks;
    renderTasksList(currentBrand.tasks);
    showNotification('Uppgift borttagen', 'success');
  } catch (error) {
    console.error('Error deleting task:', error);
    showNotification('Kunde inte ta bort uppgift', 'error');
  }
}

// ============================================================================
// NOTES
// ============================================================================

function renderNotesList(notes) {
  const listEl = document.getElementById('notesList');
  
  if (!notes || notes.length === 0) {
    listEl.innerHTML = '<p class="text-base-content/50">Inga anteckningar ännu</p>';
    return;
  }
  
  // Sort by date (newest first)
  const sortedNotes = [...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  listEl.innerHTML = sortedNotes.map(note => `
    <div class="card bg-base-200 shadow">
      <div class="card-body p-4">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <p class="whitespace-pre-wrap">${note.text}</p>
            <p class="text-xs text-base-content/50 mt-3">
              ${new Date(note.createdAt).toLocaleString('sv-SE')}
            </p>
          </div>
          <button class="btn btn-ghost btn-sm btn-circle ml-3" onclick="deleteNote('${note.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function addNoteForm() {
  document.getElementById('addNoteFormDiv').classList.remove('hidden');
  document.getElementById('newNoteText').focus();
}

function cancelAddNote() {
  document.getElementById('addNoteFormDiv').classList.add('hidden');
  document.getElementById('newNoteText').value = '';
}

async function saveNewNote() {
  if (!currentBrand) return;
  
  const text = document.getElementById('newNoteText').value.trim();
  if (!text) {
    showNotification('Text är obligatoriskt', 'warning');
    return;
  }
  
  try {
    const updated = await fetchWithAuth(`/api/brands/${currentBrand.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    currentBrand.notes = updated.notes;
    renderNotesList(currentBrand.notes);
    cancelAddNote();
    showNotification('Anteckning tillagd', 'success');
  } catch (error) {
    console.error('Error adding note:', error);
    showNotification('Kunde inte lägga till anteckning', 'error');
  }
}

async function deleteNote(noteId) {
  if (!currentBrand) return;
  if (!confirm('Är du säker på att du vill ta bort denna anteckning?')) return;
  
  try {
    const updated = await fetchWithAuth(`/api/brands/${currentBrand.id}/notes/${noteId}`, {
      method: 'DELETE'
    });
    
    currentBrand.notes = updated.notes;
    renderNotesList(currentBrand.notes);
    showNotification('Anteckning borttagen', 'success');
  } catch (error) {
    console.error('Error deleting note:', error);
    showNotification('Kunde inte ta bort anteckning', 'error');
  }
}

// ============================================================================
// BRAND COMPANIES
// ============================================================================

async function loadBrandCompanies(brandId) {
  const listEl = document.getElementById('brandCompaniesList');
  
  try {
    // Fetch all companies and filter by brand
    const allCompanies = await fetchWithAuth('/api/companies');
    const brandCompanies = allCompanies.filter(c => c.brandId === brandId);
    
    if (brandCompanies.length === 0) {
      listEl.innerHTML = '<p class="text-base-content/50">Inga företag med detta varumärke</p>';
      return;
    }
    
    listEl.innerHTML = `
      <div class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Företag</th>
              <th>Status</th>
              <th>Mäklare</th>
              <th>MRR</th>
            </tr>
          </thead>
          <tbody>
            ${brandCompanies.map(company => `
              <tr class="hover">
                <td class="font-medium">${company.name}</td>
                <td>
                  ${company.status === 'customer' 
                    ? '<span class="badge badge-success badge-sm">Kund</span>' 
                    : '<span class="badge badge-ghost badge-sm">Prospekt</span>'}
                </td>
                <td>${company.agentCount || 0}</td>
                <td class="font-mono">${Math.round(company.mrr || 0).toLocaleString('sv-SE')} kr</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    console.error('Error loading brand companies:', error);
    listEl.innerHTML = '<p class="text-error">Kunde inte ladda företag</p>';
  }
}


// ============================================================================
// KANBAN SALES PIPELINE - FAS 3
// ============================================================================

let pipelineData = null;
let sortableInstances = [];

// Load pipeline view
async function loadPipeline() {
  console.log('Loading pipeline...');
  
  try {
    // Fetch pipeline stats
    const stats = await fetchWithAuth('/api/companies/pipeline/stats');
    pipelineData = stats;
    
    // Render stats summary
    renderPipelineStats(stats);
    
    // Render Kanban board
    renderKanbanBoard(stats);
    
    // Initialize drag-and-drop
    initializeDragAndDrop();
    
  } catch (error) {
    console.error('Error loading pipeline:', error);
    showNotification('Kunde inte ladda pipeline', 'error');
  }
}

function renderPipelineStats(stats) {
  // Total stats
  document.getElementById('pipelineTotalValue').textContent = 
    `${Math.round(stats.totalValue / 1000)}k kr`;
  document.getElementById('pipelineTotalCompanies').textContent = 
    `${stats.totalCompanies} företag`;
  
  // Per-stage stats
  stats.stages.forEach(stageData => {
    const stage = stageData.stage;
    const valueEl = document.getElementById(`pipeline${capitalizeFirst(stage)}Value`);
    const countEl = document.getElementById(`pipeline${capitalizeFirst(stage)}Count`);
    
    if (valueEl) {
      valueEl.textContent = `${Math.round(stageData.totalValue / 1000)}k kr`;
    }
    if (countEl) {
      countEl.textContent = `${stageData.count} företag`;
    }
    
    // Update column badge counts
    const badgeEl = document.getElementById(`count-${stage}`);
    if (badgeEl) {
      badgeEl.textContent = stageData.count;
    }
  });
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function renderKanbanBoard(stats) {
  stats.stages.forEach(stageData => {
    const container = document.getElementById(`cards-${stageData.stage}`);
    if (!container) return;
    
    if (stageData.companies.length === 0) {
      container.innerHTML = '<p class="text-sm text-base-content/50 text-center py-4">Inga företag</p>';
      return;
    }
    
    container.innerHTML = stageData.companies.map(company => createCompanyCard(company, stageData.stage)).join('');
  });
}

function createCompanyCard(company, stage) {
  const value = company.pipelineValue || 0;
  const agents = company.agentCount || 0;
  
  // Card color based on stage
  let cardClass = 'bg-base-100';
  if (stage === 'vunnit') cardClass = 'bg-success/20';
  if (stage === 'forlorat') cardClass = 'bg-error/20';
  
  return `
    <div class="kanban-card card ${cardClass} shadow-sm cursor-move hover:shadow-md transition-shadow" 
         data-company-id="${company._id}" 
         data-stage="${stage}">
      <div class="card-body p-3">
        <h4 class="font-semibold text-sm line-clamp-2">${company.name}</h4>
        ${company.brand ? `<p class="text-xs text-base-content/60">${company.brand}</p>` : ''}
        <div class="flex items-center justify-between mt-2">
          <span class="text-xs font-mono text-primary">${Math.round(value).toLocaleString('sv-SE')} kr</span>
          <span class="badge badge-sm badge-ghost">${agents} mäklare</span>
        </div>
        ${company.nextAction ? `<p class="text-xs text-base-content/50 mt-2 line-clamp-1"> ${company.nextAction}</p>` : ''}
      </div>
    </div>
  `;
}

function initializeDragAndDrop() {
  // Destroy existing instances
  sortableInstances.forEach(instance => instance.destroy());
  sortableInstances = [];
  
  const stages = ['prospekt', 'kvalificerad', 'offert', 'forhandling', 'vunnit', 'forlorat'];
  
  stages.forEach(stage => {
    const container = document.getElementById(`cards-${stage}`);
    if (!container) return;
    
    const sortable = new Sortable(container, {
      group: 'kanban',
      animation: 150,
      ghostClass: 'opacity-50',
      dragClass: 'rotate-2',
      onEnd: async function (evt) {
        const companyId = evt.item.dataset.companyId;
        const newStage = evt.to.closest('.kanban-column').dataset.stage;
        const oldStage = evt.item.dataset.stage;
        
        if (newStage !== oldStage) {
          await handleStageChange(companyId, newStage, oldStage, evt);
        }
      }
    });
    
    sortableInstances.push(sortable);
  });
}

async function handleStageChange(companyId, newStage, oldStage, evt) {
  try {
    // Get company data to extract value
    const company = pipelineData.stages
      .flatMap(s => s.companies)
      .find(c => c._id === companyId);
    
    // Update pipeline stage via API
    await fetchWithAuth(`/api/companies/${companyId}/pipeline`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        stage: newStage,
        value: company?.pipelineValue || 0
      })
    });
    
    // Update card data attribute
    evt.item.dataset.stage = newStage;
    
    // Reload pipeline to update stats
    await loadPipeline();
    
    showNotification(`Företag flyttat till ${getStageDisplayName(newStage)}`, 'success');
    
  } catch (error) {
    console.error('Error updating pipeline stage:', error);
    showNotification('Kunde inte uppdatera pipeline-steg', 'error');
    
    // Revert the card position
    await loadPipeline();
  }
}

function getStageDisplayName(stage) {
  const names = {
    'prospekt': 'Prospekt',
    'kvalificerad': 'Kvalificerad',
    'offert': 'Offert',
    'forhandling': 'Förhandling',
    'vunnit': 'Vunnit',
    'forlorat': 'Förlorat'
  };
  return names[stage] || stage;
}


// ============================================================================
// CUSTOMER SUCCESS DASHBOARD - FAS 4
// ============================================================================

let customerSuccessData = null;

// Load customer success view
async function loadCustomerSuccess() {
  console.log('Loading customer success...');
  
  try {
    // Fetch customer success metrics
    const data = await fetchWithAuth('/api/stats/customer-success');
    customerSuccessData = data;
    
    // Render summary cards
    renderCustomerSuccessSummary(data.summary);
    
    // Render health distribution chart
    renderHealthDistribution(data.healthDistribution);
    
    // Render at-risk companies table
    renderAtRiskCompanies(data.atRiskCompanies);
    
  } catch (error) {
    console.error('Error loading customer success:', error);
    showNotification('Kunde inte ladda customer success-data', 'error');
  }
}

function renderCustomerSuccessSummary(summary) {
  // Total customers
  document.getElementById('csTotalCustomers').textContent = summary.totalCustomers;
  
  // Average health
  const avgHealthEl = document.getElementById('csAvgHealth');
  avgHealthEl.textContent = summary.avgHealthScore;
  
  // Color based on score
  if (summary.avgHealthScore >= 75) {
    avgHealthEl.className = 'stat-value text-2xl text-success';
  } else if (summary.avgHealthScore >= 50) {
    avgHealthEl.className = 'stat-value text-2xl text-warning';
  } else {
    avgHealthEl.className = 'stat-value text-2xl text-error';
  }
  
  // High risk
  document.getElementById('csHighRisk').textContent = summary.highRisk;
  document.getElementById('csHighRiskMRR').textContent = 
    `${Math.round(summary.atRiskMRR / 1000)}k kr i risk`;
  
  // Medium risk
  document.getElementById('csMediumRisk').textContent = summary.mediumRisk;
}

function renderHealthDistribution(distribution) {
  distribution.forEach(item => {
    let barId, countId;
    
    if (item.status === 'healthy') {
      barId = 'healthBarHealthy';
      countId = 'healthCountHealthy';
    } else if (item.status === 'medium') {
      barId = 'healthBarMedium';
      countId = 'healthCountMedium';
    } else if (item.status === 'high') {
      barId = 'healthBarHigh';
      countId = 'healthCountHigh';
    }
    
    if (barId && countId) {
      const barEl = document.getElementById(barId);
      const countEl = document.getElementById(countId);
      
      if (barEl) {
        // Animate height
        setTimeout(() => {
          barEl.style.height = `${item.percentage}%`;
        }, 100);
      }
      
      if (countEl) {
        countEl.textContent = item.count;
      }
    }
  });
}

function renderAtRiskCompanies(companies) {
  const tbody = document.getElementById('atRiskCompaniesList');
  
  if (!companies || companies.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-success"> Inga kunder i riskzonen!</td></tr>';
    return;
  }
  
  tbody.innerHTML = companies.map(company => {
    // Risk badge
    let riskBadge = '';
    if (company.churnRisk === 'high') {
      riskBadge = '<span class="badge badge-error">Hög</span>';
    } else if (company.churnRisk === 'medium') {
      riskBadge = '<span class="badge badge-warning">Medel</span>';
    } else {
      riskBadge = '<span class="badge badge-success">Låg</span>';
    }
    
    // Health score with color
    let scoreClass = 'text-success';
    if (company.healthScore < 50) scoreClass = 'text-error';
    else if (company.healthScore < 75) scoreClass = 'text-warning';
    
    // Last contact
    const lastContactStr = company.lastContact 
      ? new Date(company.lastContact).toLocaleDateString('sv-SE')
      : 'Aldrig';
    
    const daysSince = company.daysSinceContact < 999 
      ? `${company.daysSinceContact} dagar sedan`
      : 'Ingen data';
    
    // Risk factors
    const riskFactorsHtml = company.riskFactors && company.riskFactors.length > 0
      ? `<ul class="text-xs list-disc list-inside">${company.riskFactors.map(f => `<li>${f}</li>`).join('')}</ul>`
      : '<span class="text-xs text-base-content/50">Inga faktorer</span>';
    
    return `
      <tr class="hover">
        <td>
          <div class="font-semibold">${company.name}</div>
          <div class="text-xs text-base-content/60">${company.brand || 'Inget varumärke'}</div>
        </td>
        <td>
          <div class="font-mono text-lg font-bold ${scoreClass}">${company.healthScore}</div>
          <div class="text-xs text-base-content/60">av 100</div>
        </td>
        <td>${riskBadge}</td>
        <td class="font-mono">${Math.round(company.mrr / 1000)}k kr</td>
        <td>
          <div>${lastContactStr}</div>
          <div class="text-xs text-base-content/60">${daysSince}</div>
        </td>
        <td class="max-w-xs">${riskFactorsHtml}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="scheduleFollowUp('${company._id}', '${company.name}')">
             Följ upp
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function scheduleFollowUp(companyId, companyName) {
  // Simple prompt for now - could be enhanced with a modal
  const action = prompt(`Planera uppföljning för ${companyName}:`, 'Ring och boka möte');
  
  if (action) {
    // In a real implementation, this would update the company's nextAction
    showNotification(`Uppföljning schemalagd för ${companyName}`, 'success');
    // Reload the view to update
    loadCustomerSuccess();
  }
}


// =============================================================================
// Fas 5: Tasks & Notes System
// =============================================================================

let currentTaskFilter = 'all';
let currentEntityTypeFilter = '';

/**
 * Load and display all tasks
 */
async function loadTasks() {
  try {
    console.log(' Loading tasks with filter:', currentTaskFilter);
    
    const params = new URLSearchParams();
    if (currentTaskFilter && currentTaskFilter !== 'all') {
      params.append('filter', currentTaskFilter);
    }
    if (currentEntityTypeFilter) {
      params.append('entityType', currentEntityTypeFilter);
    }
    
    const url = `${API_BASE}/tasks?${params.toString()}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${getAccessToken()}` }
    });
    
    if (!response.ok) throw new Error('Failed to load tasks');
    
    const tasks = await response.json();
    console.log(' Loaded tasks:', tasks);
    
    // Also load stats
    await loadTaskStats();
    
    // Render tasks
    renderTasksList(tasks);
    
  } catch (error) {
    console.error('Error loading tasks:', error);
    showToast('Kunde inte ladda uppgifter', 'error');
  }
}

/**
 * Load task statistics
 */
async function loadTaskStats() {
  try {
    const response = await fetch(`${API_BASE}/tasks/stats`, {
      headers: { 'Authorization': `Bearer ${getAccessToken()}` }
    });
    
    if (!response.ok) throw new Error('Failed to load task stats');
    
    const stats = await response.json();
    console.log(' Task stats:', stats);
    
    // Update stat cards
    document.getElementById('stat-total-tasks').textContent = stats.total || 0;
    document.getElementById('stat-completed-tasks').textContent = stats.completed || 0;
    document.getElementById('stat-overdue-tasks').textContent = stats.overdue || 0;
    document.getElementById('stat-today-tasks').textContent = stats.today || 0;
    document.getElementById('stat-week-tasks').textContent = stats.thisWeek || 0;
    
  } catch (error) {
    console.error('Error loading task stats:', error);
  }
}

/**
 * Filter tasks by type
 */
function filterTasks(filter) {
  console.log(' Filtering tasks:', filter);
  currentTaskFilter = filter || 'all';
  
  // Update active tab
  document.querySelectorAll('.tabs .tab').forEach(tab => {
    tab.classList.remove('tab-active');
    if (tab.dataset.filter === currentTaskFilter) {
      tab.classList.add('tab-active');
    }
  });
  
  // Get entity type filter
  const entityTypeSelect = document.getElementById('entityTypeFilter');
  if (entityTypeSelect) {
    currentEntityTypeFilter = entityTypeSelect.value;
  }
  
  // Reload tasks
  loadTasks();
}

/**
 * Render tasks list
 */
function renderTasksList(tasks) {
  const container = document.getElementById('tasksList');
  const emptyState = document.getElementById('tasksEmptyState');
  
  if (!tasks || tasks.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  
  container.innerHTML = tasks.map(task => {
    const dueDate = new Date(task.dueDate);
    const isOverdue = !task.done && dueDate < new Date();
    const isToday = !task.done && dueDate.toDateString() === new Date().toDateString();
    
    let dueDateClass = 'text-base-content/50';
    let dueDateLabel = formatDate(dueDate);
    
    if (isOverdue) {
      dueDateClass = 'text-error font-semibold';
      dueDateLabel = ` Försenad - ${dueDateLabel}`;
    } else if (isToday) {
      dueDateClass = 'text-warning font-semibold';
      dueDateLabel = ` Idag - ${dueDateLabel}`;
    }
    
    const entityBadgeClass = task.entityType === 'brand' ? 'badge-primary' : 
                            task.entityType === 'company' ? 'badge-secondary' : 
                            'badge-accent';
    
    return `
      <div class="card bg-base-100 shadow-md ${task.done ? 'opacity-50' : ''}">
        <div class="card-body p-4">
          <div class="flex items-start gap-4">
            <!-- Checkbox -->
            <input type="checkbox" 
                   class="checkbox checkbox-primary mt-1" 
                   ${task.done ? 'checked' : ''}
                   onchange="toggleTaskDone('${task._id}', this.checked, '${task.entityType}', '${task.entityId}')">
            
            <!-- Content -->
            <div class="flex-1">
              <h3 class="font-semibold text-lg ${task.done ? 'line-through' : ''}">${escapeHtml(task.title)}</h3>
              
              ${task.description ? `<p class="text-sm text-base-content/70 mt-1">${escapeHtml(task.description)}</p>` : ''}
              
              <div class="flex flex-wrap gap-2 mt-3">
                <span class="badge ${entityBadgeClass}">${getEntityTypeName(task.entityType)}</span>
                ${task.entityName ? `<span class="badge badge-outline">${escapeHtml(task.entityName)}</span>` : ''}
                <span class="text-sm ${dueDateClass}">${dueDateLabel}</span>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-sm" 
                      onclick="viewTaskEntity('${task.entityType}', '${task.entityId}')"
                      title="Visa ${getEntityTypeName(task.entityType)}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Toggle task done status (via brand/company endpoint)
 */
async function toggleTaskDone(taskId, done, entityType, entityId) {
  try {
    console.log(' Toggling task:', taskId, 'done:', done);
    
    // Update via the entity endpoint (brand or company)
    const endpoint = entityType === 'brand' ? 
      `${API_BASE}/brands/${entityId}/tasks/${taskId}` :
      `${API_BASE}/companies/${entityId}/tasks/${taskId}`;
    
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`
      },
      body: JSON.stringify({ done })
    });
    
    if (!response.ok) throw new Error('Failed to update task');
    
    showToast(done ? 'Uppgift markerad som slutförd' : 'Uppgift markerad som ej slutförd', 'success');
    
    // Reload tasks
    setTimeout(() => loadTasks(), 300);
    
  } catch (error) {
    console.error('Error toggling task:', error);
    showToast('Kunde inte uppdatera uppgift', 'error');
  }
}

/**
 * View the entity that owns the task
 */
function viewTaskEntity(entityType, entityId) {
  if (entityType === 'brand') {
    // Find and open brand details modal
    openBrandDetailsModal(entityId);
  } else if (entityType === 'company') {
    // Switch to companies view and highlight the company
    showView('companies');
    setTimeout(() => {
      const companyRow = document.querySelector(`tr[data-company-id="${entityId}"]`);
      if (companyRow) {
        companyRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        companyRow.classList.add('bg-primary/10');
        setTimeout(() => companyRow.classList.remove('bg-primary/10'), 2000);
      }
    }, 100);
  } else if (entityType === 'agent') {
    // Switch to agents view
    showView('agents');
  }
}

/**
 * Get friendly entity type name
 */
function getEntityTypeName(entityType) {
  const names = {
    'brand': 'Varumärke',
    'company': 'Företag',
    'agent': 'Mäklare'
  };
  return names[entityType] || entityType;
}

// Auto-load tasks when view is shown
document.addEventListener('DOMContentLoaded', () => {
  const originalShowView = window.showView;
  window.showView = function(viewName) {
    originalShowView(viewName);
    if (viewName === 'tasks') {
      loadTasks();
    }
  };
});

// =============================================================================
// Fas 6: Segment Filtering
// =============================================================================

let currentCompanyFilters = {};
let filterPresets = [];

/**
 * Load filter presets from API
 */
async function loadFilterPresets() {
  try {
    const response = await fetch(`${API_BASE}/companies/filter-presets`, {
      headers: { 'Authorization': `Bearer ${getAccessToken()}` }
    });
    
    if (!response.ok) throw new Error('Failed to load presets');
    
    filterPresets = await response.json();
    
    // Populate dropdown
    const select = document.getElementById('filterPresets');
    if (select) {
      select.innerHTML = '<option value="">Välj sparat filter...</option>' +
        filterPresets.map(p => `<option value="${p._id}">${escapeHtml(p.name)}</option>`).join('');
      
      // Add change listener
      select.addEventListener('change', (e) => {
        if (e.target.value) {
          applyPreset(e.target.value);
        }
      });
    }
    
  } catch (error) {
    console.error('Error loading filter presets:', error);
  }
}

/**
 * Apply a saved preset
 */
function applyPreset(presetId) {
  const preset = filterPresets.find(p => p._id === presetId);
  if (!preset) return;
  
  // Populate filter fields
  const filters = preset.filters;
  
  if (filters.mrrMin !== undefined) {
    document.getElementById('filterMrrMin').value = filters.mrrMin;
  }
  if (filters.mrrMax !== undefined) {
    document.getElementById('filterMrrMax').value = filters.mrrMax;
  }
  if (filters.agentMin !== undefined) {
    document.getElementById('filterAgentMin').value = filters.agentMin;
  }
  if (filters.agentMax !== undefined) {
    document.getElementById('filterAgentMax').value = filters.agentMax;
  }
  if (filters.dateFrom) {
    document.getElementById('filterDateFrom').value = filters.dateFrom.split('T')[0];
  }
  if (filters.dateTo) {
    document.getElementById('filterDateTo').value = filters.dateTo.split('T')[0];
  }
  if (filters.status) {
    const statusSelect = document.getElementById('companyStatusFilter');
    if (statusSelect) statusSelect.value = filters.status;
  }
  if (filters.brandId) {
    const brandSelect = document.getElementById('companyBrandFilter');
    if (brandSelect) brandSelect.value = filters.brandId;
  }
  
  showToast(`Tillämpade filter: ${preset.name}`, 'success');
  
  // Apply filters
  applyAdvancedFilters();
}

/**
 * Apply advanced filters to companies list
 */
async function applyAdvancedFilters() {
  try {
    console.log(' Applying advanced filters');
    
    // Build filter object
    const filters = {};
    
    // Get values from filter inputs
    const mrrMin = document.getElementById('filterMrrMin')?.value;
    const mrrMax = document.getElementById('filterMrrMax')?.value;
    const agentMin = document.getElementById('filterAgentMin')?.value;
    const agentMax = document.getElementById('filterAgentMax')?.value;
    const dateFrom = document.getElementById('filterDateFrom')?.value;
    const dateTo = document.getElementById('filterDateTo')?.value;
    
    // Get basic filters
    const status = document.getElementById('companyStatusFilter')?.value;
    const brandId = document.getElementById('companyBrandFilter')?.value;
    
    if (mrrMin) filters.mrrMin = mrrMin;
    if (mrrMax) filters.mrrMax = mrrMax;
    if (agentMin) filters.agentMin = agentMin;
    if (agentMax) filters.agentMax = agentMax;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (status && status !== 'all') filters.status = status;
    if (brandId && brandId !== 'all') filters.brandId = brandId;
    
    // Store current filters
    currentCompanyFilters = filters;
    
    // Build query string
    const params = new URLSearchParams(filters);
    const url = `${API_BASE}/companies?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${getAccessToken()}` }
    });
    
    if (!response.ok) throw new Error('Failed to load companies');
    
    const companies = await response.json();
    renderCompaniesTable(companies);
    
    showToast(`Visar ${companies.length} företag`, 'success');
    
  } catch (error) {
    console.error('Error applying filters:', error);
    showToast('Kunde inte tillämpa filter', 'error');
  }
}

/**
 * Clear all advanced filters
 */
function clearAdvancedFilters() {
  document.getElementById('filterMrrMin').value = '';
  document.getElementById('filterMrrMax').value = '';
  document.getElementById('filterAgentMin').value = '';
  document.getElementById('filterAgentMax').value = '';
  document.getElementById('filterDateFrom').value = '';
  document.getElementById('filterDateTo').value = '';
  document.getElementById('filterPresets').value = '';
  
  currentCompanyFilters = {};
  
  // Reload companies without filters
  loadCompanies();
  
  showToast('Filter rensade', 'info');
}

/**
 * Save current filters as a preset
 */
async function saveCurrentFilters() {
  try {
    const name = prompt('Namn på filtret:');
    if (!name) return;
    
    // Get current filter values
    const filters = { ...currentCompanyFilters };
    
    const response = await fetch(`${API_BASE}/companies/filter-presets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`
      },
      body: JSON.stringify({ name, filters })
    });
    
    if (!response.ok) throw new Error('Failed to save preset');
    
    showToast('Filter sparat!', 'success');
    
    // Reload presets
    await loadFilterPresets();
    
  } catch (error) {
    console.error('Error saving filter preset:', error);
    showToast('Kunde inte spara filter', 'error');
  }
}

/**
 * Delete a filter preset
 */
async function deleteFilterPreset(presetId) {
  try {
    if (!confirm('Ta bort detta sparade filter?')) return;
    
    const response = await fetch(`${API_BASE}/companies/filter-presets/${presetId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getAccessToken()}` }
    });
    
    if (!response.ok) throw new Error('Failed to delete preset');
    
    showToast('Filter borttaget', 'success');
    await loadFilterPresets();
    
  } catch (error) {
    console.error('Error deleting filter preset:', error);
    showToast('Kunde inte ta bort filter', 'error');
  }
}

// Auto-load presets when companies view is shown
document.addEventListener('DOMContentLoaded', () => {
  const originalShowView = window.showView;
  if (originalShowView) {
    window.showView = function(viewName) {
      originalShowView(viewName);
      if (viewName === 'companies') {
        setTimeout(() => loadFilterPresets(), 100);
      }
    };
  }
});

// =================================================================
// Företagskort Modal (enligt spec)
// =================================================================

function openCompanyModal(companyId) {
  console.log('Opening company modal:', companyId);
  
  fetch(`${API_BASE}/companies/${companyId}`, {
    headers: { 'Authorization': `Bearer ${getAccessToken()}` }
  })
  .then(res => res.json())
  .then(company => {
    showCompanyModal(company);
  })
  .catch(error => {
    console.error('Error loading company:', error);
    showToast('Kunde inte ladda företag', 'error');
  });
}

function showCompanyModal(company) {
  const modalHTML = `
    <dialog id="companyModal" class="modal modal-open">
      <div class="modal-box w-11/12 max-w-3xl">
        <h3 class="font-bold text-lg mb-4">${escapeHtml(company.name)}</h3>
        
        <div class="grid grid-cols-2 gap-4">
          <!-- Left Column -->
          <div class="space-y-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Ansvarig säljare</span></label>
              <select id="companyAdmin" class="select select-bordered select-sm">
                <option value="Admin">Admin</option>
              </select>
            </div>
            
            <div class="form-control">
              <label class="label"><span class="label-text">Kedjetillhörighet</span></label>
              <select id="companyBrand" class="select select-bordered select-sm">
                <option value="${company.brandId || ''}">${escapeHtml(company.brand || 'Mäklarringen')}</option>
              </select>
            </div>
            
            <div class="form-control">
              <label class="label"><span class="label-text">Segment/Kategori</span></label>
              <div class="flex items-center gap-2">
                <span class="badge badge-primary"> Fastighetsmäklare</span>
              </div>
            </div>
            
            <div class="form-control">
              <label class="label"><span class="label-text">Kund?</span></label>
              <input type="checkbox" id="companyIsCustomer" class="checkbox" ${company.status === 'kund' ? 'checked' : ''} />
            </div>
            
            <div class="form-control">
              <label class="label"><span class="label-text">Produkt</span></label>
              <input type="text" class="input input-bordered input-sm" value="" placeholder="Ingen produkt vald" />
            </div>
            
            <div class="form-control">
              <label class="label"><span class="label-text">Nuvarande betalning (SEK)</span></label>
              <input type="text" id="companyPayment" class="input input-bordered input-sm" value="${company.payment || ''}" />
            </div>
          </div>
          
          <!-- Right Column -->
          <div class="space-y-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Status</span></label>
              <select id="companyStatus" class="select select-bordered select-sm">
                <option value="prospekt" ${company.status === 'prospekt' ? 'selected' : ''}>Prospekt</option>
                <option value="kund" ${company.status === 'kund' ? 'selected' : ''}>Kund</option>
              </select>
            </div>
            
            <div class="form-control">
              <label class="label"><span class="label-text">Pipeline</span></label>
              <select id="companyPipeline" class="select select-bordered select-sm">
                <option value="kvalificerad" ${company.pipelineStage === 'kvalificerad' ? 'selected' : ''}>Kvalificerad</option>
                <option value="offert" ${company.pipelineStage === 'offert' ? 'selected' : ''}>Offert</option>
                <option value="forhandling" ${company.pipelineStage === 'forhandling' ? 'selected' : ''}>Förhandling</option>
                <option value="vunnit" ${company.pipelineStage === 'vunnit' ? 'selected' : ''}>Vunnit</option>
              </select>
            </div>
            
            <div class="form-control">
              <label class="label"><span class="label-text">Potential (SEK)</span></label>
              <input type="text" id="companyPotential" class="input input-bordered input-sm" value="${company.pipelineValue || ''}" />
            </div>
            
            <div class="form-control">
              <label class="label"><span class="label-text">Adress</span></label>
              <input type="text" id="companyAddress" class="input input-bordered input-sm" value="${escapeHtml(company.address || '')}" />
            </div>
            
            <div class="form-control">
              <label class="label"><span class="label-text">Postnummer</span></label>
              <input type="text" id="companyPostcode" class="input input-bordered input-sm" value="" />
            </div>
          </div>
        </div>
        
        <!-- Beslutsfattare Section -->
        <div class="mt-6">
          <h4 class="font-semibold mb-2">Beslutsfattare</h4>
          <div class="space-y-2">
            <div class="flex gap-2">
              <button class="btn btn-sm btn-ghost">Lägg till kontakt</button>
              <button class="btn btn-sm btn-ghost">Ny uppgift</button>
              <button class="btn btn-sm btn-primary"> Outlook</button>
            </div>
          </div>
        </div>
        
        <!-- Mäklare Section -->
        <div class="mt-6">
          <h4 class="font-semibold mb-2">Mäklare (${company.agentCount || 0})</h4>
          <div class="text-sm text-base-content/50">Mäklarlista visas här...</div>
        </div>
        
        <!-- Bottom Actions -->
        <div class="modal-action">
          <button class="btn btn-sm" onclick="document.getElementById('companyModal').close()">Tillbaka till lista</button>
          <button class="btn btn-sm btn-ghost">Ny mäklare</button>
          <button class="btn btn-sm btn-primary" onclick="saveCompanyChanges('${company._id}')">Spara</button>
          <button class="btn btn-sm" onclick="document.getElementById('companyModal').close()">Stäng</button>
          <button class="btn btn-sm btn-ghost">Uppgifter</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  `;
  
  // Remove existing modal if any
  const existing = document.getElementById('companyModal');
  if (existing) existing.remove();
  
  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Show modal
  document.getElementById('companyModal').showModal();
}

function saveCompanyChanges(companyId) {
  const updates = {
    status: document.getElementById('companyStatus').value,
    pipelineStage: document.getElementById('companyPipeline').value,
    pipelineValue: parseFloat(document.getElementById('companyPotential').value) || 0,
    payment: parseFloat(document.getElementById('companyPayment').value) || 0,
    address: document.getElementById('companyAddress').value
  };
  
  fetch(`${API_BASE}/companies/${companyId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`
    },
    body: JSON.stringify(updates)
  })
  .then(res => res.json())
  .then(() => {
    showToast('Företag uppdaterat', 'success');
    document.getElementById('companyModal').close();
    loadCompanies();
  })
  .catch(error => {
    console.error('Error saving company:', error);
    showToast('Kunde inte spara ändringar', 'error');
  });
}

