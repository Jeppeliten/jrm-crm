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
  console.log('🔔 entra-login-success event received in app-simple.js', event.detail);
  
  if (appInitialized) {
    console.log('⏭️  App already initialized, skipping...');
    return;
  }
  
  // Wait for app-init.js to show main content, then initialize CRM
  setTimeout(() => {
    const mainApp = document.getElementById('app');
    const isVisible = mainApp && window.getComputedStyle(mainApp).visibility === 'visible';
    
    if (isVisible) {
      console.log('🚀 Starting CRM initialization after login...');
      initializeSimpleApp();
      appInitialized = true;
    } else {
      console.log('⏸️  Main app not yet visible, waiting...');
      // If not visible yet, wait a bit more
      setTimeout(() => {
        console.log('🚀 Starting CRM initialization (delayed)...');
        initializeSimpleApp();
        appInitialized = true;
      }, 500);
    }
  }, 200);
});

// Fallback: Initialize when DOM is ready AND user is already logged in
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 app-simple.js DOM ready');
  
  // Check if user is already authenticated (page refresh case)
  setTimeout(() => {
    const mainApp = document.getElementById('app');
    const isVisible = mainApp && window.getComputedStyle(mainApp).visibility === 'visible';
    
    if (isVisible && !appInitialized) {
      console.log('✅ User already authenticated, initializing CRM...');
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
  console.log(`\n🔄 ====== loadTemplate START ======`);
  console.log(`🔄 View: ${viewName}`);
  console.log(`🔄 Target element:`, targetElement);
  
  const template = document.getElementById(`tpl-${viewName}`);
  
  if (template) {
    console.log(`✅ Template "tpl-${viewName}" found!`);
    const content = template.content.cloneNode(true);
    console.log(`✅ Template cloned, content:`, content);
    
    targetElement.appendChild(content);
    console.log(`✅ Template content appended to target`);
    console.log(`✅ Target element now has ${targetElement.children.length} children`);
    
    // Set up event handlers for buttons in this view
    // Use a longer delay to ensure DOM is fully updated
    setTimeout(() => {
      console.log(`\n⏰ Timeout fired after 200ms - setting up handlers`);
      console.log(`⏰ Target element ID: ${targetElement.id}`);
      console.log(`⏰ Target element children: ${targetElement.children.length}`);
      setupViewEventHandlers(viewName, targetElement);
      console.log(`✅ setupViewEventHandlers completed\n`);
    }, 200);
  } else {
    console.warn(`❌ Template "tpl-${viewName}" not found in DOM`);
    // Add a placeholder message
    targetElement.innerHTML = `
      <div class="p-8">
        <h2 class="text-2xl font-bold mb-4">${formatViewName(viewName)}</h2>
        <p class="text-base-content/70">Innehåll för denna vy kommer snart...</p>
      </div>
    `;
  }
}

function formatViewName(viewName) {
  const names = {
    'dashboard': 'Dashboard',
    'brands': 'Varumärken',
    'companies': 'Företag',
    'agents': 'Mäklare',
    'pipeline': 'Säljtavla',
    'customer-success': 'Kundvård',
    'licenses': 'Licenser',
    'import': 'Import',
    'settings': 'Inställningar'
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
        { id: 2, name: 'Test Företag HB', email: 'info@test.se', phone: '070-654321' }
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
        { id: 1, title: 'Demo Affär 1', value: 50000, status: 'negotiation', customer: 'Demo Kund AB' },
        { id: 2, title: 'Demo Affär 2', value: 75000, status: 'proposal', customer: 'Test Företag HB' }
      ]);
    }
  } catch (error) {
    console.error('Error loading deals:', error);
    showDemoMessage('Affärer');
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
        { id: 1, title: 'Uppföljning Demo Kund', type: 'call', date: new Date().toISOString() },
        { id: 2, title: 'Möte Test Företag', type: 'meeting', date: new Date().toISOString() }
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
    welcomeEl.textContent = `Välkommen, ${user.name || 'användare'}! 👋`;
  }
}

function loadBrands() {
  console.log('Loading brands view...');
  // Brands template is already loaded, just log it
}

function loadCompanies() {
  console.log('Loading companies view...');
  // Companies template is already loaded
}

function loadAgents() {
  console.log('Loading agents view...');
  // Agents template is already loaded
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
          alert('Välj en fil först');
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
    importResult.textContent = 'Läser Excel-fil...';
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
          <span>✓ Läste ${jsonData.length} rader från ${workbook.SheetNames[0]}</span>
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
            <span>✓ Import lyckades! ${result.imported || 0} poster importerade.</span>
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
          <span>✗ Fel vid import: ${error.message}</span>
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
            <span>✓ Serverimport lyckades! ${result.imported || 0} poster importerade.</span>
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
          <span>✗ Fel vid serverimport: ${error.message}</span>
        </div>
      `;
    }
  }
}

function loadSettings() {
  console.log('Loading settings view...');
  // Settings template is already loaded
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
      <span>Kunde inte ladda ${entityType} från API. Visar demo-data.</span>
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
  console.log(`📋 ====== setupViewEventHandlers START ======`);
  console.log(`📋 View: ${viewName}`);
  console.log(`📋 ViewElement:`, viewElement);
  console.log(`📋 ViewElement ID:`, viewElement.id);
  console.log(`📋 ViewElement innerHTML length:`, viewElement.innerHTML.length);
  
  // Log all buttons in the view
  const allButtons = viewElement.querySelectorAll('button');
  console.log(`📋 Found ${allButtons.length} total buttons in view`);
  allButtons.forEach(btn => {
    console.log(`  📌 Button: id="${btn.id}", class="${btn.className}", text="${btn.textContent.trim().substring(0, 30)}"`);
  });
  
  // Find all buttons with data-action in this view
  const actionButtons = viewElement.querySelectorAll('[data-action]');
  console.log(`📋 Found ${actionButtons.length} buttons with data-action`);
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
    console.log(`🔍 Looking for button: #${buttonId} (${description})`);
    
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
      console.log(`✅ FOUND ${description} button (#${buttonId}) - Attaching listener`);
      // Remove any existing listeners by cloning
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      newButton.addEventListener('click', (e) => {
        e.preventDefault();
        console.log(`🖱️ ${description} button CLICKED!`);
        handler();
      });
    } else {
      console.error(`❌ Button #${buttonId} NOT FOUND for ${description}`);
    }
  };
  
  console.log(`🔧 Setting up button handlers...`);
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
  
  console.log(`✓ Event handlers set up for ${viewName}`);
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
  console.log('🎯 showAddBrandForm called!');
  const html = `
    <div class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">Lägg till nytt varumärke</h3>
        <form id="addBrandForm" class="space-y-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Varumärkesnamn *</span>
            </label>
            <input type="text" name="name" placeholder="Ange varumärkesnamn" class="input input-bordered w-full" required />
          </div>
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Beskrivning</span>
            </label>
            <textarea name="description" placeholder="Beskriv varumärket..." class="textarea textarea-bordered w-full" rows="4"></textarea>
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
            <button type="submit" class="btn btn-primary">Spara varumärke</button>
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
  console.log('🎯 showAddCompanyForm called!');
  const html = `
    <div class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">Lägg till nytt företag</h3>
        <form id="addCompanyForm" class="space-y-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Företagsnamn *</span>
            </label>
            <input type="text" name="name" placeholder="Ange företagsnamn" class="input input-bordered w-full" required />
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
  console.log('🎯 showAddAgentForm called!');
  const html = `
    <div class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">Lägg till ny mäklare</h3>
        <form id="addAgentForm" class="space-y-4">
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Namn *</span>
            </label>
            <input type="text" name="name" placeholder="För- och efternamn" class="input input-bordered w-full" required />
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
              <span class="label-text">Företag</span>
            </label>
            <input type="text" name="company" placeholder="Mäklarföretag AB" class="input input-bordered w-full" />
          </div>
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Avbryt</button>
            <button type="submit" class="btn btn-primary">Spara mäklare</button>
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
        <h3 class="font-bold text-lg mb-4">Skapa ny affär</h3>
        <form id="addDealForm" class="space-y-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Titel *</span></label>
            <input type="text" name="title" class="input input-bordered" required />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Värde (kr)</span></label>
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
              <option value="negotiation">Förhandling</option>
              <option value="won">Vunnen</option>
              <option value="lost">Förlorad</option>
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
  alert(`Redigera affär ${id} - funktion kommer snart!`);
};

window.editActivity = function(id) {
  console.log('Edit activity:', id);
  alert(`Redigera aktivitet ${id} - funktion kommer snart!`);
};

console.log('Simple CRM app script loaded');
