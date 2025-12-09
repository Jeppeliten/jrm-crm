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
  console.log('ðŸ”” entra-login-success event received in app-simple.js', event.detail);
  
  if (appInitialized) {
    console.log('â­ï¸  App already initialized, skipping...');
    return;
  }
  
  // Wait for app-init.js to show main content, then initialize CRM
  setTimeout(() => {
    const mainApp = document.getElementById('app');
    const isVisible = mainApp && window.getComputedStyle(mainApp).visibility === 'visible';
    
    if (isVisible) {
      console.log('ðŸš€ Starting CRM initialization after login...');
      initializeSimpleApp();
      appInitialized = true;
    } else {
      console.log('â¸ï¸  Main app not yet visible, waiting...');
      // If not visible yet, wait a bit more
      setTimeout(() => {
        console.log('ðŸš€ Starting CRM initialization (delayed)...');
        initializeSimpleApp();
        appInitialized = true;
      }, 500);
    }
  }, 200);
});

// Fallback: Initialize when DOM is ready AND user is already logged in
document.addEventListener('DOMContentLoaded', () => {
  console.log('ðŸŽ¯ app-simple.js DOM ready');
  
  // Check if user is already authenticated (page refresh case)
  setTimeout(() => {
    const mainApp = document.getElementById('app');
    const isVisible = mainApp && window.getComputedStyle(mainApp).visibility === 'visible';
    
    if (isVisible && !appInitialized) {
      console.log('âœ… User already authenticated, initializing CRM...');
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
  console.log(`\nðŸ”„ ====== loadTemplate START ======`);
  console.log(`ðŸ”„ View: ${viewName}`);
  console.log(`ðŸ”„ Target element:`, targetElement);
  
  const template = document.getElementById(`tpl-${viewName}`);
  
  if (template) {
    console.log(`âœ… Template "tpl-${viewName}" found!`);
    const content = template.content.cloneNode(true);
    console.log(`âœ… Template cloned, content:`, content);
    
    targetElement.appendChild(content);
    console.log(`âœ… Template content appended to target`);
    console.log(`âœ… Target element now has ${targetElement.children.length} children`);
    
    // Set up event handlers for buttons in this view
    // Use a longer delay to ensure DOM is fully updated
    setTimeout(() => {
      console.log(`\nâ° Timeout fired after 200ms - setting up handlers`);
      console.log(`â° Target element ID: ${targetElement.id}`);
      console.log(`â° Target element children: ${targetElement.children.length}`);
      setupViewEventHandlers(viewName, targetElement);
      console.log(`âœ… setupViewEventHandlers completed\n`);
    }, 200);
  } else {
    console.warn(`âŒ Template "tpl-${viewName}" not found in DOM`);
    // Add a placeholder message
    targetElement.innerHTML = `
      <div class="p-8">
        <h2 class="text-2xl font-bold mb-4">${formatViewName(viewName)}</h2>
        <p class="text-base-content/70">InnehÃ¥ll fÃ¶r denna vy kommer snart...</p>
      </div>
    `;
  }
}

function formatViewName(viewName) {
  const names = {
    'dashboard': 'Dashboard',
    'brands': 'VarumÃ¤rken',
    'companies': 'FÃ¶retag',
    'agents': 'MÃ¤klare',
    'pipeline': 'SÃ¤ljtavla',
    'customer-success': 'KundvÃ¥rd',
    'licenses': 'Licenser',
    'import': 'Import',
    'settings': 'InstÃ¤llningar'
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
        { id: 2, name: 'Test FÃ¶retag HB', email: 'info@test.se', phone: '070-654321' }
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
        { id: 1, title: 'Demo AffÃ¤r 1', value: 50000, status: 'negotiation', customer: 'Demo Kund AB' },
        { id: 2, title: 'Demo AffÃ¤r 2', value: 75000, status: 'proposal', customer: 'Test FÃ¶retag HB' }
      ]);
    }
  } catch (error) {
    console.error('Error loading deals:', error);
    showDemoMessage('AffÃ¤rer');
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
        { id: 1, title: 'UppfÃ¶ljning Demo Kund', type: 'call', date: new Date().toISOString() },
        { id: 2, title: 'MÃ¶te Test FÃ¶retag', type: 'meeting', date: new Date().toISOString() }
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
    welcomeEl.textContent = `VÃ¤lkommen, ${user.name || 'anvÃ¤ndare'}! ðŸ‘‹`;
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
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Företag</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Varumärke</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Org.nr</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-post</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärder</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        ${companies.map(company => `
          <tr class="hover:bg-gray-50 cursor-pointer" onclick="showCompanyDetails('${company._id}')">
            <td class="px-6 py-4 whitespace-nowrap">${company.name || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">${company.brand || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(company.status)}">
                ${company.status || 'prospekt'}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">${company.pipeline || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">${company.orgNumber || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">${company.email || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">${company.phone || ''}</td>
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
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Varumärke</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Webbplats</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beskrivning</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärder</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        ${brands.map(brand => `
          <tr class="hover:bg-gray-50 cursor-pointer" onclick="showBrandDetails('${brand._id}')">
            <td class="px-6 py-4 whitespace-nowrap font-medium">${brand.name || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">${brand.category || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(brand.status)}">
                ${brand.status || 'aktiv'}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              ${brand.website ? `<a href="${brand.website}" target="_blank" class="text-indigo-600 hover:text-indigo-900">${brand.website}</a>` : ''}
            </td>
            <td class="px-6 py-4">${brand.description || ''}</td>
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
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Företag</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Licens</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-post</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärder</th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        ${agents.map(agent => `
          <tr class="hover:bg-gray-50 cursor-pointer" onclick="showAgentDetails('${agent._id}')">
            <td class="px-6 py-4 whitespace-nowrap font-medium">${agent.name || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">${agent.company || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">${agent.role || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(agent.status)}">
                ${agent.status || 'aktiv'}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">${agent.licenseType || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">${agent.email || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">${agent.phone || ''}</td>
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

async function showAgentDetails(id) {
  try {
    const response = await fetchWithAuth(`/api/agents/${id}`);
    const agent = await response.json();
    
    const html = `
      <div class="modal modal-open">
        <div class="modal-box max-w-4xl max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-start mb-6">
            <div>
              <h3 class="font-bold text-3xl text-gray-800">${agent.name}</h3>
              <p class="text-sm text-gray-500 mt-1">${agent.role || 'M?klare'} ${agent.company ? 'p? ' + agent.company : ''}</p>
            </div>
            <button onclick="closeModal()" class="btn btn-sm btn-circle"></button>
          </div>
          
          <div class="divider my-4"></div>
          
          <div class="grid grid-cols-2 gap-8">
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">F?retagsinformation</h4>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">F?retag</label>
                <p class="text-base mt-1 font-medium">${agent.company || '-'}</p>
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
            </div>
            
            <div class="space-y-4">
              <h4 class="font-semibold text-lg text-gray-700 mb-3">Kontaktinformation</h4>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">E-post</label>
                <p class="text-base mt-1">${agent.email ? '<a href="mailto:' + agent.email + '" class="text-blue-600 hover:text-blue-800">' + agent.email + '</a>' : '-'}</p>
              </div>
              
              <div>
                <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Telefon</label>
                <p class="text-base mt-1">${agent.phone ? '<a href="tel:' + agent.phone + '" class="text-blue-600 hover:text-blue-800">' + agent.phone + '</a>' : '-'}</p>
              </div>
            </div>
          </div>
          
          <div class="divider my-6"></div>
          
          <div class="space-y-4">
            <h4 class="font-semibold text-lg text-gray-700 mb-3">Licensinformation</h4>
            
            <div>
              <label class="text-sm font-medium text-gray-500 uppercase tracking-wide">Licenstyp</label>
              <p class="text-base mt-1 font-medium">${agent.licenseType || 'Ej angiven'}</p>
            </div>
          </div>
          
          <div class="modal-action mt-8 pt-4 border-t">
            <button onclick="closeModal()" class="btn btn-ghost">St?ng</button>
            <button onclick="closeModal(); editAgent('${agent._id}')" class="btn btn-primary">Redigera m?klare</button>
          </div>
        </div>
        <div class="modal-backdrop bg-black bg-opacity-50" onclick="closeModal()"></div>
      </div>
    `;
    
    showModal(html);
  } catch (error) {
    console.error('Error loading agent details:', error);
    alert('Kunde inte ladda m?klardetaljer');
  }
}

window.closeModal = function() {
  const modal = document.querySelector('.modal-open');
  if (modal) {
    modal.remove();
  }
};

// ===== EDIT AND DELETE FUNCTIONS =====

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
                <input type="text" name="name" value="${company.name || ''}" class="input input-bordered w-full" required />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Organisationsnummer</span></label>
                <input type="text" name="orgNumber" value="${company.orgNumber || ''}" class="input input-bordered w-full" />
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Varum?rke</span></label>
                <input type="text" name="brand" value="${company.brand || ''}" class="input input-bordered w-full" />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Kategori</span></label>
                <input type="text" name="category" value="${company.category || ''}" class="input input-bordered w-full" />
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
                <input type="email" name="email" value="${company.email || ''}" class="input input-bordered w-full" />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Telefon</span></label>
                <input type="tel" name="phone" value="${company.phone || ''}" class="input input-bordered w-full" />
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Ort</span></label>
                <input type="text" name="city" value="${company.city || ''}" class="input input-bordered w-full" />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">L?n</span></label>
                <input type="text" name="county" value="${company.county || ''}" class="input input-bordered w-full" />
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Antal licenser</span></label>
                <input type="number" name="licenseCount" value="${company.licenseCount || 0}" class="input input-bordered w-full" />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Produkt</span></label>
                <input type="text" name="product" value="${company.product || ''}" class="input input-bordered w-full" />
              </div>
            </div>
            
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Betalningsinformation</span></label>
              <input type="text" name="paymentInfo" value="${company.paymentInfo || ''}" class="input input-bordered w-full" />
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
              <input type="text" name="name" value="${brand.name || ''}" class="input input-bordered w-full" required />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Kategori</span></label>
              <input type="text" name="category" value="${brand.category || ''}" class="input input-bordered w-full" />
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
              <input type="url" name="website" value="${brand.website || ''}" class="input input-bordered w-full" />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Beskrivning</span></label>
              <textarea name="description" class="textarea textarea-bordered w-full" rows="4">${brand.description || ''}</textarea>
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
              <input type="text" name="name" value="${agent.name || ''}" class="input input-bordered w-full" required />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">F?retag</span></label>
              <input type="text" name="company" value="${agent.company || ''}" class="input input-bordered w-full" />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Roll</span></label>
              <input type="text" name="role" value="${agent.role || ''}" class="input input-bordered w-full" />
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
              <input type="email" name="email" value="${agent.email || ''}" class="input input-bordered w-full" required />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Telefon</span></label>
              <input type="tel" name="phone" value="${agent.phone || ''}" class="input input-bordered w-full" />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Licenstyp</span></label>
              <input type="text" name="licenseType" value="${agent.licenseType || ''}" class="input input-bordered w-full" />
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
    document.getElementById('brandTable').innerHTML = '<p class="text-red-500">Fel vid laddning av varumärken</p>';
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
    document.getElementById('companyTable').innerHTML = '<p class="text-red-500">Fel vid laddning av företag</p>';
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
    document.getElementById('agentTable').innerHTML = '<p class="text-red-500">Fel vid laddning av mäklare</p>';
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
          alert('VÃ¤lj en fil fÃ¶rst');
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
    importResult.textContent = 'LÃ¤ser Excel-fil...';
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
          <span>âœ“ LÃ¤ste ${jsonData.length} rader frÃ¥n ${workbook.SheetNames[0]}</span>
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
            <span>âœ“ Import lyckades! ${result.imported || 0} poster importerade.</span>
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
          <span>âœ— Fel vid import: ${error.message}</span>
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
            <span>âœ“ Serverimport lyckades! ${result.imported || 0} poster importerade.</span>
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
          <span>âœ— Fel vid serverimport: ${error.message}</span>
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
      <span>Kunde inte ladda ${entityType} frÃ¥n API. Visar demo-data.</span>
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
  console.log(`ðŸ“‹ ====== setupViewEventHandlers START ======`);
  console.log(`ðŸ“‹ View: ${viewName}`);
  console.log(`ðŸ“‹ ViewElement:`, viewElement);
  console.log(`ðŸ“‹ ViewElement ID:`, viewElement.id);
  console.log(`ðŸ“‹ ViewElement innerHTML length:`, viewElement.innerHTML.length);
  
  // Log all buttons in the view
  const allButtons = viewElement.querySelectorAll('button');
  console.log(`ðŸ“‹ Found ${allButtons.length} total buttons in view`);
  allButtons.forEach(btn => {
    console.log(`  ðŸ“Œ Button: id="${btn.id}", class="${btn.className}", text="${btn.textContent.trim().substring(0, 30)}"`);
  });
  
  // Find all buttons with data-action in this view
  const actionButtons = viewElement.querySelectorAll('[data-action]');
  console.log(`ðŸ“‹ Found ${actionButtons.length} buttons with data-action`);
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
    console.log(`ðŸ” Looking for button: #${buttonId} (${description})`);
    
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
      console.log(`âœ… FOUND ${description} button (#${buttonId}) - Attaching listener`);
      // Remove any existing listeners by cloning
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      newButton.addEventListener('click', (e) => {
        e.preventDefault();
        console.log(`ðŸ–±ï¸ ${description} button CLICKED!`);
        handler();
      });
    } else {
      console.error(`âŒ Button #${buttonId} NOT FOUND for ${description}`);
    }
  };
  
  console.log(`ðŸ”§ Setting up button handlers...`);
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
  
  console.log(`âœ“ Event handlers set up for ${viewName}`);
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
  console.log('ðŸŽ¯ showAddBrandForm called!');
  const html = `
    <div class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">LÃ¤gg till nytt varumÃ¤rke</h3>
        <form id="addBrandForm" class="space-y-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">VarumÃ¤rkesnamn *</span>
            </label>
            <input type="text" name="name" placeholder="Ange varumÃ¤rkesnamn" class="input input-bordered w-full" required />
          </div>
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Beskrivning</span>
            </label>
            <textarea name="description" placeholder="Beskriv varumÃ¤rket..." class="textarea textarea-bordered w-full" rows="4"></textarea>
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
            <button type="submit" class="btn btn-primary">Spara varumÃ¤rke</button>
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
  console.log('ðŸŽ¯ showAddCompanyForm called!');
  const html = `
    <div class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">LÃ¤gg till nytt fÃ¶retag</h3>
        <form id="addCompanyForm" class="space-y-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">FÃ¶retagsnamn *</span>
            </label>
            <input type="text" name="name" placeholder="Ange fÃ¶retagsnamn" class="input input-bordered w-full" required />
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
            <button type="submit" class="btn btn-primary">Spara fÃ¶retag</button>
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
  console.log('ðŸŽ¯ showAddAgentForm called!');
  const html = `
    <div class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">LÃ¤gg till ny mÃ¤klare</h3>
        <form id="addAgentForm" class="space-y-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Namn *</span>
            </label>
            <input type="text" name="name" placeholder="FÃ¶r- och efternamn" class="input input-bordered w-full" required />
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
              <span class="label-text">FÃ¶retag</span>
            </label>
            <input type="text" name="company" placeholder="MÃ¤klarfÃ¶retag AB" class="input input-bordered w-full" />
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
            <button type="submit" class="btn btn-primary">Spara mÃ¤klare</button>
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
        <h3 class="font-bold text-lg mb-4">Skapa ny affÃ¤r</h3>
        <form id="addDealForm" class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Titel *</span></label>
            <input type="text" name="title" class="input input-bordered" required />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">VÃ¤rde (kr)</span></label>
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
              <option value="negotiation">FÃ¶rhandling</option>
              <option value="won">Vunnen</option>
              <option value="lost">FÃ¶rlorad</option>
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
  alert(`Redigera affÃ¤r ${id} - funktion kommer snart!`);
};

window.editActivity = function(id) {
  console.log('Edit activity:', id);
  alert(`Redigera aktivitet ${id} - funktion kommer snart!`);
};

console.log('Simple CRM app script loaded');












// Force deployment: 12/09/2025 17:00:13








