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

﻿function renderCompaniesTable(companies) {
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
            <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">${company.name || ''}</td>
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
}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(company.status)}">
                ${company.status || 'prospekt'}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">${company.pipeline || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">${company.orgNumber || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">${company.email || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap">${company.phone || ''}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
          <tr class="hover:bg-gray-50 cursor-pointer" onclick="showBrandDetails(${brand._id})">
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
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
          <tr class="hover:bg-gray-50 cursor-pointer" onclick="showAgentDetails(${agent._id})">
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
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
﻿// ===== DETAIL CARD FUNCTIONS =====

async function showCompanyDetails(id) {
  try {
    const response = await fetchWithAuth(`/api/companies/${id}`);
    const company = await response.json();
    
    const html = `
      <div class="modal modal-open">
        <div class="modal-box max-w-4xl max-h-[90vh] overflow-y-auto">
          <div class="flex justify-between items-start mb-4">
            <h3 class="font-bold text-2xl">${company.name}</h3>
            <button onclick="closeModal()" class="btn btn-sm btn-circle btn-ghost"></button>
          </div>
          
          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-3">
              <div>
                <label class="text-sm font-semibold text-gray-500">Organisationsnummer</label>
                <p class="text-base">${company.orgNumber || '-'}</p>
              </div>
              <div>
                <label class="text-sm font-semibold text-gray-500">Varumärke</label>
                <p class="text-base">${company.brand || '-'}</p>
              </div>
              <div>
                <label class="text-sm font-semibold text-gray-500">Kategori</label>
                <p class="text-base">${company.category || '-'}</p>
              </div>
              <div>
                <label class="text-sm font-semibold text-gray-500">Status</label>
                <p><span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(company.status)}">${company.status || 'prospekt'}</span></p>
              </div>
              <div>
                <label class="text-sm font-semibold text-gray-500">Pipeline</label>
                <p class="text-base">${company.pipeline || '-'}</p>
              </div>
            </div>
            
            <div class="space-y-3">
              <div>
                <label class="text-sm font-semibold text-gray-500">E-post</label>
                <p class="text-base">${company.email || '-'}</p>
              </div>
              <div>
                <label class="text-sm font-semibold text-gray-500">Telefon</label>
                <p class="text-base">${company.phone || '-'}</p>
              </div>
              <div>
                <label class="text-sm font-semibold text-gray-500">Ort</label>
                <p class="text-base">${company.city || '-'}</p>
              </div>
              <div>
                <label class="text-sm font-semibold text-gray-500">Län</label>
                <p class="text-base">${company.county || '-'}</p>
              </div>
            </div>
          </div>
          
          <div class="divider"></div>
          
          <div class="grid grid-cols-2 gap-6">
            <div>
              <label class="text-sm font-semibold text-gray-500">Antal licenser</label>
              <p class="text-base">${company.licenseCount || '0'}</p>
            </div>
            <div>
              <label class="text-sm font-semibold text-gray-500">Produkt</label>
              <p class="text-base">${company.product || '-'}</p>
            </div>
          </div>
          
          <div class="mt-3">
            <label class="text-sm font-semibold text-gray-500">Betalningsinformation</label>
            <p class="text-base">${company.paymentInfo || '-'}</p>
          </div>
          
          <div class="modal-action">
            <button onclick="editCompany('${company._id}')" class="btn btn-primary">Redigera</button>
            <button onclick="deleteCompany('${company._id}')" class="btn btn-error">Ta bort</button>
            <button onclick="closeModal()" class="btn btn-ghost">Stäng</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button onclick="closeModal()">close</button>
        </form>
      </div>
    `;
    
    showModal(html);
  } catch (error) {
    console.error('Error loading company details:', error);
    alert('Kunde inte ladda företagsdetaljer');
  }
}

async function editCompany(id) {
  try {
    const response = await fetchWithAuth(`/api/companies/${id}`);
    const company = await response.json();
    
    const html = `
      <div class="modal modal-open">
        <div class="modal-box max-w-3xl max-h-[90vh] overflow-y-auto">
          <h3 class="font-bold text-lg mb-4">Redigera företag</h3>
          <form id="editCompanyForm" class="space-y-3">
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Företagsnamn *</span></label>
                <input type="text" name="name" value="${company.name || ''}" class="input input-bordered w-full" required />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Organisationsnummer</span></label>
                <input type="text" name="orgNumber" value="${company.orgNumber || ''}" class="input input-bordered w-full" />
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Varumärke</span></label>
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
                <label class="label"><span class="label-text">Ort</span></label>
                <input type="text" name="city" value="${company.city || ''}" class="input input-bordered w-full" />
              </div>
              <div class="form-control w-full">
                <label class="label"><span class="label-text">Län</span></label>
                <input type="text" name="county" value="${company.county || ''}" class="input input-bordered w-full" />
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
              <button type="submit" class="btn btn-primary">Spara ändringar</button>
            </div>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button onclick="closeModal()">close</button>
        </form>
      </div>
    `;
    
    showModal(html, async (formData) => {
      await updateEntity('companies', id, formData);
      loadCompanies();
    });
  } catch (error) {
    console.error('Error loading company for edit:', error);
    alert('Kunde inte ladda företag för redigering');
  }
}

async function updateEntity(entityType, id, data) {
  try {
    const response = await fetchWithAuth(`/api/${entityType}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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




// ============================================
// BRAND DETAIL CARDS
// ============================================

async function showBrandDetails(id) {
  try {
    const brand = await fetchWithAuth(`/api/brands/${id}`);
    
    const modal = document.getElementById('modal');
    const statusBadge = getStatusBadgeClass(brand.status || 'aktiv');
    
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-start mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Varumärke: ${brand.name || 'N/A'}</h2>
          <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Namn</label>
            <p class="text-gray-900">${brand.name || 'N/A'}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <span class="${statusBadge}">${brand.status || 'aktiv'}</span>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
            <p class="text-gray-900">${brand.category || 'N/A'}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Webbplats</label>
            <p class="text-gray-900">${brand.website || 'N/A'}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Ramavtal</label>
            <p class="text-gray-900">${brand.hasCentralAgreement ? 'Ja' : 'Nej'}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Antal företag</label>
            <p class="text-gray-900">${brand.companyCount || 0}</p>
          </div>
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Beskrivning</label>
            <p class="text-gray-900">${brand.description || 'N/A'}</p>
          </div>
        </div>
        
        <div class="flex justify-end gap-2">
          <button onclick="deleteBrand('${brand._id}')" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Ta bort
          </button>
          <button onclick="editBrand('${brand._id}')" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Redigera
          </button>
          <button onclick="closeModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
            Stäng
          </button>
        </div>
      </div>
    `;
    
    showModal();
  } catch (error) {
    console.error('Error loading brand details:', error);
    alert('Kunde inte ladda varumärke');
  }
}

async function editBrand(id) {
  try {
    const brand = await fetchWithAuth(`/api/brands/${id}`);
    
    const modal = document.getElementById('modal');
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 class="text-2xl font-bold mb-6">Redigera varumärke</h2>
        <form id="editBrandForm" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Namn *</label>
              <input type="text" name="name" value="${brand.name || ''}" required
                     class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="status" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="aktiv" ${brand.status === 'aktiv' ? 'selected' : ''}>Aktiv</option>
                <option value="inaktiv" ${brand.status === 'inaktiv' ? 'selected' : ''}>Inaktiv</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <input type="text" name="category" value="${brand.category || ''}"
                     class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Webbplats</label>
              <input type="url" name="website" value="${brand.website || ''}"
                     class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Beskrivning</label>
              <textarea name="description" rows="3"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">${brand.description || ''}</textarea>
            </div>
            <div class="col-span-2">
              <label class="flex items-center">
                <input type="checkbox" name="hasCentralAgreement" ${brand.hasCentralAgreement ? 'checked' : ''}
                       class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                <span class="text-sm font-medium text-gray-700">Har ramavtal</span>
              </label>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-6">
            <button type="button" onclick="closeModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
              Avbryt
            </button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Spara
            </button>
          </div>
        </form>
      </div>
    `;
    
    document.getElementById('editBrandForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        name: formData.get('name'),
        status: formData.get('status'),
        category: formData.get('category'),
        website: formData.get('website'),
        description: formData.get('description'),
        hasCentralAgreement: formData.get('hasCentralAgreement') === 'on'
      };
      
      await updateEntity('brands', id, data);
    });
    
    showModal();
  } catch (error) {
    console.error('Error loading brand for edit:', error);
    alert('Kunde inte ladda varumärke för redigering');
  }
}

// ============================================
// AGENT DETAIL CARDS
// ============================================

async function showAgentDetails(id) {
  try {
    const agent = await fetchWithAuth(`/api/agents/${id}`);
    
    const modal = document.getElementById('modal');
    const statusBadge = getStatusBadgeClass(agent.status || 'aktiv');
    
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-start mb-6">
          <h2 class="text-2xl font-bold text-gray-900">Mäklare: ${agent.name || 'N/A'}</h2>
          <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Namn</label>
            <p class="text-gray-900">${agent.name || 'N/A'}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <span class="${statusBadge}">${agent.status || 'aktiv'}</span>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">E-post</label>
            <p class="text-gray-900">${agent.email || 'N/A'}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
            <p class="text-gray-900">${agent.phone || 'N/A'}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Företag</label>
            <p class="text-gray-900">${agent.company || 'N/A'}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Varumärke</label>
            <p class="text-gray-900">${agent.brand || 'N/A'}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Roll</label>
            <p class="text-gray-900">${agent.role || 'N/A'}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Licenstyp</label>
            <p class="text-gray-900">${agent.licenseType || 'N/A'}</p>
          </div>
        </div>
        
        <div class="flex justify-end gap-2">
          <button onclick="deleteAgent('${agent._id}')" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Ta bort
          </button>
          <button onclick="editAgent('${agent._id}')" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Redigera
          </button>
          <button onclick="closeModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
            Stäng
          </button>
        </div>
      </div>
    `;
    
    showModal();
  } catch (error) {
    console.error('Error loading agent details:', error);
    alert('Kunde inte ladda mäklare');
  }
}

async function editAgent(id) {
  try {
    const agent = await fetchWithAuth(`/api/agents/${id}`);
    
    const modal = document.getElementById('modal');
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 class="text-2xl font-bold mb-6">Redigera mäklare</h2>
        <form id="editAgentForm" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Namn *</label>
              <input type="text" name="name" value="${agent.name || ''}" required
                     class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="status" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="aktiv" ${agent.status === 'aktiv' ? 'selected' : ''}>Aktiv</option>
                <option value="inaktiv" ${agent.status === 'inaktiv' ? 'selected' : ''}>Inaktiv</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">E-post</label>
              <input type="email" name="email" value="${agent.email || ''}"
                     class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input type="tel" name="phone" value="${agent.phone || ''}"
                     class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Företag</label>
              <input type="text" name="company" value="${agent.company || ''}"
                     class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Varumärke</label>
              <input type="text" name="brand" value="${agent.brand || ''}"
                     class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Roll</label>
              <input type="text" name="role" value="${agent.role || ''}"
                     class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Licenstyp</label>
              <input type="text" name="licenseType" value="${agent.licenseType || ''}"
                     class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-6">
            <button type="button" onclick="closeModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
              Avbryt
            </button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Spara
            </button>
          </div>
        </form>
      </div>
    `;
    
    document.getElementById('editAgentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        name: formData.get('name'),
        status: formData.get('status'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        company: formData.get('company'),
        brand: formData.get('brand'),
        role: formData.get('role'),
        licenseType: formData.get('licenseType')
      };
      
      await updateEntity('agents', id, data);
    });
    
    showModal();
  } catch (error) {
    console.error('Error loading agent for edit:', error);
    alert('Kunde inte ladda mäklare för redigering');
  }
}


// ============================================
// SÄLJTAVLA (DEALS PIPELINE) - KANBAN VIEW
// ============================================

let dealsData = [];

async function showDealsSection() {
  try {
    dealsData = await fetchWithAuth('/api/deals');
    renderDealsKanban();
  } catch (error) {
    console.error('Error loading deals:', error);
    document.getElementById('content').innerHTML = '<div class="p-8 text-center text-red-600">Kunde inte ladda affärer</div>';
  }
}

function renderDealsKanban() {
  const stages = [
    { id: 'prospecting', name: 'Prospektering', color: 'bg-gray-100 border-gray-300' },
    { id: 'qualified', name: 'Kvalificerad', color: 'bg-blue-100 border-blue-300' },
    { id: 'proposal', name: 'Offert skickad', color: 'bg-yellow-100 border-yellow-300' },
    { id: 'negotiation', name: 'Förhandling', color: 'bg-orange-100 border-orange-300' },
    { id: 'closed_won', name: 'Vunnen 🎉', color: 'bg-green-100 border-green-300' },
    { id: 'closed_lost', name: 'Förlorad', color: 'bg-red-100 border-red-300' }
  ];

  const dealsByStage = {};
  stages.forEach(stage => {
    dealsByStage[stage.id] = dealsData.filter(d => (d.stage || 'prospecting') === stage.id);
  });

  const totalValue = dealsData
    .filter(d => d.stage !== 'closed_lost')
    .reduce((sum, d) => sum + (d.value || 0), 0);

  const wonValue = dealsByStage.closed_won.reduce((sum, d) => sum + (d.value || 0), 0);

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="p-8">
      <!-- Header med statistik -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Säljtavla</h1>
          <p class="text-gray-600 mt-1">Dra och släpp affärer mellan steg</p>
        </div>
        <div class="flex gap-4">
          <div class="bg-white rounded-lg shadow px-6 py-4 border-l-4 border-blue-500">
            <div class="text-sm text-gray-600">Pipelinevärde</div>
            <div class="text-2xl font-bold text-gray-900">${formatCurrency(totalValue)}</div>
          </div>
          <div class="bg-white rounded-lg shadow px-6 py-4 border-l-4 border-green-500">
            <div class="text-sm text-gray-600">Vunnet värde</div>
            <div class="text-2xl font-bold text-green-600">${formatCurrency(wonValue)}</div>
          </div>
          <button onclick="showAddDealForm()" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            + Ny affär
          </button>
        </div>
      </div>

      <!-- Kanban board -->
      <div class="grid grid-cols-6 gap-4 h-[calc(100vh-280px)]">
        ${stages.map(stage => `
          <div class="flex flex-col">
            <div class="${stage.color} border-2 rounded-lg px-4 py-3 mb-3">
              <h3 class="font-semibold text-gray-800">${stage.name}</h3>
              <p class="text-sm text-gray-600">${dealsByStage[stage.id].length} affärer</p>
              <p class="text-sm font-medium text-gray-800">${formatCurrency(dealsByStage[stage.id].reduce((sum, d) => sum + (d.value || 0), 0))}</p>
            </div>
            <div class="flex-1 space-y-3 overflow-y-auto" id="stage-${stage.id}" ondrop="dropDeal(event, '${stage.id}')" ondragover="allowDrop(event)">
              ${dealsByStage[stage.id].map(deal => renderDealCard(deal, stage.id)).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderDealCard(deal, stage) {
  const daysUntilClose = deal.expectedCloseDate ? 
    Math.ceil((new Date(deal.expectedCloseDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
  
  const urgencyClass = daysUntilClose !== null && daysUntilClose < 7 && stage !== 'closed_won' && stage !== 'closed_lost' ? 
    'border-red-500' : 'border-gray-200';

  return `
    <div class="bg-white rounded-lg shadow border-2 ${urgencyClass} p-4 cursor-move hover:shadow-lg transition-shadow"
         draggable="true" 
         ondragstart="dragDeal(event, '${deal._id}')"
         onclick="showDealDetails('${deal._id}')">
      <h4 class="font-semibold text-gray-900 mb-2">${deal.title || 'Ingen titel'}</h4>
      <p class="text-sm text-gray-600 mb-2">${deal.customer || 'Ingen kund'}</p>
      <div class="flex justify-between items-center">
        <span class="text-lg font-bold text-blue-600">${formatCurrency(deal.value || 0)}</span>
        ${daysUntilClose !== null ? `
          <span class="text-xs ${daysUntilClose < 7 ? 'text-red-600 font-semibold' : 'text-gray-500'}">
            ${daysUntilClose < 0 ? 'Försenad!' : daysUntilClose + ' dagar'}
          </span>
        ` : ''}
      </div>
    </div>
  `;
}

let draggedDealId = null;

function dragDeal(event, dealId) {
  draggedDealId = dealId;
  event.dataTransfer.effectAllowed = 'move';
}

function allowDrop(event) {
  event.preventDefault();
}

async function dropDeal(event, newStage) {
  event.preventDefault();
  
  if (!draggedDealId) return;

  const deal = dealsData.find(d => d._id === draggedDealId);
  if (!deal) return;

  const oldStage = deal.stage;
  if (oldStage === newStage) return;

  try {
    // Uppdatera i backend
    await fetchWithAuth(`/api/deals/${draggedDealId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...deal, stage: newStage })
    });

    // Uppdatera lokalt
    deal.stage = newStage;
    
    // Visa konfetti om affären vunnits
    if (newStage === 'closed_won') {
      showConfetti();
    }
    
    // Re-render
    renderDealsKanban();
  } catch (error) {
    console.error('Error updating deal stage:', error);
    alert('Kunde inte uppdatera affär');
  }
  
  draggedDealId = null;
}

function showConfetti() {
  // Enkel konfetti-effekt
  const confetti = document.createElement('div');
  confetti.className = 'fixed inset-0 pointer-events-none z-50';
  confetti.innerHTML = '🎉🎊✨💰🏆';
  confetti.style.fontSize = '100px';
  confetti.style.textAlign = 'center';
  confetti.style.paddingTop = '20vh';
  confetti.style.animation = 'fadeOut 2s ease-out';
  document.body.appendChild(confetti);
  setTimeout(() => confetti.remove(), 2000);
}

async function showDealDetails(dealId) {
  const deal = dealsData.find(d => d._id === dealId);
  if (!deal) return;

  const modal = document.getElementById('modal');
  const stageNames = {
    'prospecting': 'Prospektering',
    'qualified': 'Kvalificerad',
    'proposal': 'Offert skickad',
    'negotiation': 'Förhandling',
    'closed_won': 'Vunnen',
    'closed_lost': 'Förlorad'
  };

  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-2xl w-full">
      <div class="flex justify-between items-start mb-6">
        <h2 class="text-2xl font-bold text-gray-900">${deal.title || 'Affär'}</h2>
        <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Kund</label>
          <p class="text-gray-900">${deal.customer || 'N/A'}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Värde</label>
          <p class="text-2xl font-bold text-blue-600">${formatCurrency(deal.value || 0)}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <p class="text-gray-900">${stageNames[deal.stage] || deal.stage}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Förväntat avslut</label>
          <p class="text-gray-900">${deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('sv-SE') : 'N/A'}</p>
        </div>
      </div>
      
      <div class="flex justify-end gap-2">
        <button onclick="deleteDeal('${deal._id}')" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
          Ta bort
        </button>
        <button onclick="editDeal('${deal._id}')" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Redigera
        </button>
        <button onclick="closeModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
          Stäng
        </button>
      </div>
    </div>
  `;
  
  showModal();
}

function showAddDealForm() {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-2xl w-full">
      <h2 class="text-2xl font-bold mb-6">Ny affär</h2>
      <form id="addDealForm" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Affärsnamn *</label>
            <input type="text" name="title" required placeholder="T.ex. Mäklarhuset Stockholm - 50 licenser"
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kund *</label>
            <input type="text" name="customer" required placeholder="Företagsnamn"
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Värde (SEK) *</label>
            <input type="number" name="value" required placeholder="100000"
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="stage" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="prospecting">Prospektering</option>
              <option value="qualified">Kvalificerad</option>
              <option value="proposal">Offert skickad</option>
              <option value="negotiation">Förhandling</option>
              <option value="closed_won">Vunnen</option>
              <option value="closed_lost">Förlorad</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Förväntat avslut</label>
            <input type="date" name="expectedCloseDate"
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" onclick="closeModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
            Avbryt
          </button>
          <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Skapa affär
          </button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('addDealForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      title: formData.get('title'),
      customer: formData.get('customer'),
      value: parseFloat(formData.get('value')),
      stage: formData.get('stage'),
      expectedCloseDate: formData.get('expectedCloseDate') || null
    };

    try {
      await fetchWithAuth('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      closeModal();
      showDealsSection();
    } catch (error) {
      console.error('Error creating deal:', error);
      alert('Kunde inte skapa affär');
    }
  });

  showModal();
}

async function editDeal(dealId) {
  const deal = dealsData.find(d => d._id === dealId);
  if (!deal) return;

  const modal = document.getElementById('modal');
  const dateValue = deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split('T')[0] : '';
  
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-2xl w-full">
      <h2 class="text-2xl font-bold mb-6">Redigera affär</h2>
      <form id="editDealForm" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Affärsnamn *</label>
            <input type="text" name="title" value="${deal.title || ''}" required
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Kund *</label>
            <input type="text" name="customer" value="${deal.customer || ''}" required
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Värde (SEK) *</label>
            <input type="number" name="value" value="${deal.value || 0}" required
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="stage" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="prospecting" ${deal.stage === 'prospecting' ? 'selected' : ''}>Prospektering</option>
              <option value="qualified" ${deal.stage === 'qualified' ? 'selected' : ''}>Kvalificerad</option>
              <option value="proposal" ${deal.stage === 'proposal' ? 'selected' : ''}>Offert skickad</option>
              <option value="negotiation" ${deal.stage === 'negotiation' ? 'selected' : ''}>Förhandling</option>
              <option value="closed_won" ${deal.stage === 'closed_won' ? 'selected' : ''}>Vunnen</option>
              <option value="closed_lost" ${deal.stage === 'closed_lost' ? 'selected' : ''}>Förlorad</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Förväntat avslut</label>
            <input type="date" name="expectedCloseDate" value="${dateValue}"
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" onclick="closeModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
            Avbryt
          </button>
          <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Spara
          </button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('editDealForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      title: formData.get('title'),
      customer: formData.get('customer'),
      value: parseFloat(formData.get('value')),
      stage: formData.get('stage'),
      expectedCloseDate: formData.get('expectedCloseDate') || null
    };

    try {
      await fetchWithAuth(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      closeModal();
      showDealsSection();
    } catch (error) {
      console.error('Error updating deal:', error);
      alert('Kunde inte uppdatera affär');
    }
  });

  showModal();
}

async function deleteDeal(dealId) {
  if (!confirm('Är du säker på att du vill ta bort denna affär?')) return;

  try {
    await fetchWithAuth(`/api/deals/${dealId}`, { method: 'DELETE' });
    closeModal();
    showDealsSection();
  } catch (error) {
    console.error('Error deleting deal:', error);
    alert('Kunde inte ta bort affär');
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('sv-SE', { 
    style: 'currency', 
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// ============================================
// KUNDVÅRD (CUSTOMER SUCCESS)
// ============================================

let customerCareData = [];

async function showCustomerCareSection() {
  try {
    // Ladda företag och kontrakt
    const [companies, contracts] = await Promise.all([
      fetchWithAuth('/api/companies'),
      fetchWithAuth('/api/contracts').catch(() => [])
    ]);

    // Skapa kundvårdsdata med risk-scoring
    customerCareData = companies
      .filter(c => c.status === 'kund')
      .map(company => {
        const companyContracts = contracts.filter(ct => ct.company === company.name);
        const health = calculateCustomerHealth(company, companyContracts);
        
        return {
          ...company,
          contracts: companyContracts,
          health,
          lastContact: company.lastContact || null,
          nextAction: company.nextAction || null
        };
      })
      .sort((a, b) => a.health.score - b.health.score); // Högst risk först

    renderCustomerCare();
  } catch (error) {
    console.error('Error loading customer care data:', error);
    document.getElementById('content').innerHTML = '<div class="p-8 text-center text-red-600">Kunde inte ladda kundvård</div>';
  }
}

function calculateCustomerHealth(company, contracts) {
  let score = 100;
  const issues = [];

  // Kontroll 1: Har kontrakt?
  if (!contracts || contracts.length === 0) {
    score -= 30;
    issues.push('Inget kontrakt registrerat');
  }

  // Kontroll 2: Antal licenser vs agents
  const totalLicenses = contracts.reduce((sum, c) => sum + (c.licenseCount || 0), 0);
  if (totalLicenses === 0) {
    score -= 20;
    issues.push('Inga licenser registrerade');
  }

  // Kontroll 3: Senaste kontakt (om äldre än 90 dagar = risk)
  if (company.lastContact) {
    const daysSinceContact = Math.floor((new Date() - new Date(company.lastContact)) / (1000 * 60 * 60 * 24));
    if (daysSinceContact > 90) {
      score -= 25;
      issues.push(`${daysSinceContact} dagar sedan senaste kontakt`);
    }
  } else {
    score -= 15;
    issues.push('Ingen kontakthistorik');
  }

  // Kontroll 4: Pipeline status
  if (company.pipeline === 'churned') {
    score -= 40;
    issues.push('Markerad som churned');
  }

  return {
    score: Math.max(0, score),
    status: score >= 70 ? 'healthy' : score >= 40 ? 'at_risk' : 'critical',
    issues
  };
}

function renderCustomerCare() {
  const healthyCustomers = customerCareData.filter(c => c.health.status === 'healthy');
  const atRiskCustomers = customerCareData.filter(c => c.health.status === 'at_risk');
  const criticalCustomers = customerCareData.filter(c => c.health.status === 'critical');

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="p-8">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">Kundvård</h1>
        <p class="text-gray-600 mt-1">Övervaka kundhälsa och planera uppföljningar</p>
      </div>

      <!-- Statistik -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-gray-400">
          <div class="text-sm text-gray-600">Totalt antal kunder</div>
          <div class="text-3xl font-bold text-gray-900">${customerCareData.length}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div class="text-sm text-gray-600">Friska kunder</div>
          <div class="text-3xl font-bold text-green-600">${healthyCustomers.length}</div>
          <div class="text-xs text-gray-500 mt-1">${Math.round(healthyCustomers.length / customerCareData.length * 100)}%</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div class="text-sm text-gray-600">I riskzonen</div>
          <div class="text-3xl font-bold text-yellow-600">${atRiskCustomers.length}</div>
          <div class="text-xs text-gray-500 mt-1">Kräver uppmärksamhet</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div class="text-sm text-gray-600">Kritiska</div>
          <div class="text-3xl font-bold text-red-600">${criticalCustomers.length}</div>
          <div class="text-xs text-gray-500 mt-1">Akut åtgärd behövs!</div>
        </div>
      </div>

      <!-- Flikar -->
      <div class="bg-white rounded-lg shadow">
        <div class="border-b border-gray-200">
          <nav class="flex">
            <button onclick="showCustomerCareTab('critical')" id="tab-critical" 
                    class="px-6 py-4 text-sm font-medium border-b-2 border-red-500 text-red-600">
              Kritiska (${criticalCustomers.length})
            </button>
            <button onclick="showCustomerCareTab('at_risk')" id="tab-at_risk"
                    class="px-6 py-4 text-sm font-medium text-gray-600 hover:text-gray-800">
              I riskzonen (${atRiskCustomers.length})
            </button>
            <button onclick="showCustomerCareTab('healthy')" id="tab-healthy"
                    class="px-6 py-4 text-sm font-medium text-gray-600 hover:text-gray-800">
              Friska (${healthyCustomers.length})
            </button>
          </nav>
        </div>
        
        <div id="customerCareTabContent" class="p-6">
          ${renderCustomerCareTab('critical')}
        </div>
      </div>
    </div>
  `;
}

function showCustomerCareTab(tabName) {
  // Uppdatera flikar
  ['critical', 'at_risk', 'healthy'].forEach(tab => {
    const button = document.getElementById(`tab-${tab}`);
    if (tab === tabName) {
      button.className = 'px-6 py-4 text-sm font-medium border-b-2 border-blue-500 text-blue-600';
    } else {
      button.className = 'px-6 py-4 text-sm font-medium text-gray-600 hover:text-gray-800';
    }
  });

  // Uppdatera innehåll
  document.getElementById('customerCareTabContent').innerHTML = renderCustomerCareTab(tabName);
}

function renderCustomerCareTab(status) {
  const customers = customerCareData.filter(c => c.health.status === status);

  if (customers.length === 0) {
    return '<div class="text-center text-gray-500 py-12">Inga kunder i denna kategori 👍</div>';
  }

  return `
    <div class="space-y-4">
      ${customers.map(customer => `
        <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
             onclick="showCustomerCareDetails('${customer._id}')">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <h3 class="text-lg font-semibold text-gray-900">${customer.name}</h3>
                ${getHealthBadge(customer.health)}
              </div>
              
              ${customer.health.issues.length > 0 ? `
                <div class="mb-3 space-y-1">
                  ${customer.health.issues.map(issue => `
                    <div class="flex items-center gap-2 text-sm text-red-600">
                      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                      </svg>
                      ${issue}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              
              <div class="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span class="text-gray-600">Varumärke:</span>
                  <span class="font-medium ml-1">${customer.brand || 'N/A'}</span>
                </div>
                <div>
                  <span class="text-gray-600">Licenser:</span>
                  <span class="font-medium ml-1">${customer.licenseCount || 0}</span>
                </div>
                <div>
                  <span class="text-gray-600">Ort:</span>
                  <span class="font-medium ml-1">${customer.city || 'N/A'}</span>
                </div>
                <div>
                  <span class="text-gray-600">Senaste kontakt:</span>
                  <span class="font-medium ml-1">${customer.lastContact ? new Date(customer.lastContact).toLocaleDateString('sv-SE') : 'Aldrig'}</span>
                </div>
              </div>
            </div>
            
            <div class="ml-4">
              <button onclick="event.stopPropagation(); logCustomerContact('${customer._id}')" 
                      class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                Logga kontakt
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function getHealthBadge(health) {
  const badges = {
    healthy: '<span class="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Frisk ✓</span>',
    at_risk: '<span class="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Risk ⚠</span>',
    critical: '<span class="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Kritisk ⛔</span>'
  };
  return badges[health.status] || '';
}

function showCustomerCareDetails(companyId) {
  const customer = customerCareData.find(c => c._id === companyId);
  if (!customer) return;

  showCompanyDetails(companyId); // Använd befintlig detaljvy
}

function logCustomerContact(companyId) {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-lg w-full">
      <h2 class="text-2xl font-bold mb-6">Logga kundkontakt</h2>
      <form id="contactLogForm" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Typ av kontakt</label>
          <select name="contactType" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option value="call">Telefonsamtal</option>
            <option value="meeting">Möte</option>
            <option value="email">E-post</option>
            <option value="visit">Platsbesök</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Anteckningar</label>
          <textarea name="notes" rows="4" placeholder="Vad diskuterades? Nästa steg?"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nästa uppföljning</label>
          <input type="date" name="nextFollowUp"
                 class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button type="button" onclick="closeModal()" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
            Avbryt
          </button>
          <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Spara kontakt
          </button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('contactLogForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      // Uppdatera lastContact på företaget
      await fetchWithAuth(`/api/companies/${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastContact: new Date().toISOString() })
      });
      
      closeModal();
      showCustomerCareSection(); // Reload för att uppdatera health scores
    } catch (error) {
      console.error('Error logging contact:', error);
      alert('Kunde inte spara kontakt');
    }
  });

  showModal();
}


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

﻿function showAddCompanyForm() {
  console.log(' showAddCompanyForm called!');
  const html = `
    <div class="modal modal-open">
      <div class="modal-box max-w-3xl max-h-[90vh] overflow-y-auto">
        <h3 class="font-bold text-lg mb-4">Lägg till nytt företag</h3>
        <form id="addCompanyForm" class="space-y-3">
          <div class="grid grid-cols-2 gap-4">
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Företagsnamn *</span></label>
              <input type="text" name="name" placeholder="Ange företagsnamn" class="input input-bordered w-full" required />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Organisationsnummer</span></label>
              <input type="text" name="orgNumber" placeholder="XXXXXX-XXXX" class="input input-bordered w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Varumärke</span></label>
              <input type="text" name="brand" placeholder="T.ex. Mäklarhuset" class="input input-bordered w-full" />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Kategori</span></label>
              <input type="text" name="category" placeholder="T.ex. Nyckelkund" class="input input-bordered w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Status</span></label>
              <select name="status" class="select select-bordered w-full">
                <option value="prospekt">Prospekt</option>
                <option value="kund" selected>Kund</option>
                <option value="inaktiv">Inaktiv</option>
              </select>
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Pipeline</span></label>
              <select name="pipeline" class="select select-bordered w-full">
                <option value="prospect">Prospekt</option>
                <option value="active_customer" selected>Aktiv kund</option>
                <option value="churned">Avslutad</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Ort</span></label>
              <input type="text" name="city" placeholder="Stockholm" class="input input-bordered w-full" />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Län</span></label>
              <input type="text" name="county" placeholder="Stockholms län" class="input input-bordered w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="form-control w-full">
              <label class="label"><span class="label-text">E-post</span></label>
              <input type="email" name="email" placeholder="kontakt@foretag.se" class="input input-bordered w-full" />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Telefon</span></label>
              <input type="tel" name="phone" placeholder="08-XXX XX XX" class="input input-bordered w-full" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Antal licenser</span></label>
              <input type="number" name="licenseCount" placeholder="0" class="input input-bordered w-full" />
            </div>
            <div class="form-control w-full">
              <label class="label"><span class="label-text">Produkt</span></label>
              <input type="text" name="product" placeholder="T.ex. Booli Pro" class="input input-bordered w-full" />
            </div>
          </div>
          <div class="form-control w-full">
            <label class="label"><span class="label-text">Betalningsinformation</span></label>
            <input type="text" name="paymentInfo" placeholder="Fakturaadress, avtalsnummer etc." class="input input-bordered w-full" />
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
            <button type="submit" class="btn btn-primary">Spara företag</button>
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








