/**
 * Authentication Initialization
 * Handles login flow and app initialization
 */

let entraAuth = null;

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
      showApp();
    } else {
      console.log('User not logged in, showing landing page...');
      showLandingPage();
    }
  } catch (error) {
    console.error('Error during initialization:', error);
    showLandingPage();
  }
});

// Show landing page and set up login button
function showLandingPage() {
  document.getElementById('landingPage').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const loginErrorText = document.getElementById('loginErrorText');
  
  loginBtn.addEventListener('click', async () => {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="loading loading-spinner"></span> Loggar in...';
    loginError.style.display = 'none';
    
    try {
      await entraAuth.loginRedirect();
      // After redirect, page will reload and user will be logged in
    } catch (error) {
      console.error('Login failed:', error);
      loginErrorText.textContent = 'Inloggning misslyckades. Försök igen.';
      loginError.style.display = 'block';
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'Logga in med Microsoft';
    }
  });
}

// Show main app after successful login
function showApp() {
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
  
  // Initialize the main CRM app (from app.js)
  if (typeof initializeApp === 'function') {
    console.log('Initializing CRM app...');
    initializeApp();
  } else {
    console.warn('initializeApp() not found, app.js may not be loaded yet');
    // Fallback: wait a bit and try again
    setTimeout(() => {
      if (typeof initializeApp === 'function') {
        initializeApp();
      } else {
        console.error('Could not initialize app - initializeApp() function not found');
      }
    }, 500);
  }
}

// Listen for successful login (after redirect)
window.addEventListener('entra-login-success', (event) => {
  console.log('Login success event received:', event.detail);
  showApp();
});
