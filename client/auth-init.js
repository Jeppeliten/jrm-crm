/**
 * Authentication Initialization
 * Handles login flow and app initialization
 */

let entraAuth = null;
let appInitialized = false;

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing authentication...');

  // Create auth instance
  entraAuth = new EntraAuth();
  window.entraAuth = entraAuth;

  try {
    // Initialize MSAL and check if user is logged in
    const isLoggedIn = await entraAuth.initialize();

    if (isLoggedIn) {
      console.log('User is logged in, showing app...');
      // Small delay to ensure redirect is complete
      setTimeout(() => showApp(), 100);
    } else {
      console.log('User not logged in, showing landing page...');
      showLandingPage();
    }
  } catch (error) {
    console.error('Error during initialization:', error);
    showLandingPage();
  }
});// Show landing page and set up login button
function showLandingPage() {
  console.log('Showing landing page...');
  document.getElementById('landingPage').style.display = 'block';
  document.getElementById('app').style.display = 'none';
  
  // Try both button IDs (landingLoginBtn for new landing page, loginBtn for legacy)
  const loginBtn = document.getElementById('landingLoginBtn') || document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const loginErrorText = document.getElementById('loginErrorText');
  
  if (!loginBtn) {
    console.error('Login button not found!');
    return;
  }
  
  console.log('Login button ready, adding click handler...');
  loginBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Login button clicked!');
    
    loginBtn.disabled = true;
    const originalHTML = loginBtn.innerHTML;
    loginBtn.innerHTML = '<span class="inline-block animate-spin mr-2">⏳</span> Loggar in...';
    if (loginError) loginError.classList.add('hidden');
    
    try {
      console.log('Starting login redirect...');
      await entraAuth.loginRedirect();
      // After redirect, page will reload and user will be logged in
    } catch (error) {
      console.error('Login failed:', error);
      if (loginErrorText) loginErrorText.textContent = 'Inloggning misslyckades. Försök igen.';
      if (loginError) loginError.classList.remove('hidden');
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalHTML;
    }
  });
  
  console.log('Click handler attached to login button');
}

// Show main app after successful login
function showApp() {
  if (appInitialized) {
    console.log('App already showing, preventing duplicate initialization...');
    return;
  }
  
  console.log('Showing app container...');
  document.getElementById('landingPage').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  // Display user name if element exists
  const user = entraAuth.getUser();
  const userDisplayEl = document.getElementById('userDisplayName');
  if (userDisplayEl && user) {
    userDisplayEl.textContent = user.name || user.username || 'Användare';
  }

  // Set up logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Vill du logga ut?')) {
        await entraAuth.logout();
      }
    });
  }

  // Initialize the main CRM app (from app.js) - only once
  if (typeof initializeApp === 'function') {
    console.log('Initializing CRM app...');
    appInitialized = true;
    initializeApp();
  } else {
    console.warn('initializeApp() not found, app.js may not be loaded yet');
    // Fallback: wait a bit and try again
    setTimeout(() => {
      if (typeof initializeApp === 'function' && !appInitialized) {
        appInitialized = true;
        initializeApp();
      } else if (!appInitialized) {
        console.error('Could not initialize app - initializeApp() function not found');
      }
    }, 500);
  }
}// Listen for successful login (after redirect)
window.addEventListener('entra-login-success', (event) => {
  console.log('Login success event received:', event.detail);
  // Don't call showApp here - it's already called from initialize()
  // This event is just for logging/monitoring
});
