/**
 * Simple Application Initializer
 * Updates UI when user is authenticated
 */

// Listen for authentication events
window.addEventListener('entra-login-success', (event) => {
  console.log('Login success event received:', event.detail);
  initializeApp(event.detail.user);
});

// Initialize app if user is already logged in
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for entra-auth to initialize
  setTimeout(() => {
    if (window.entraAuth && window.entraAuth.isLoggedIn()) {
      console.log('User already authenticated, initializing app...');
      initializeApp(window.entraAuth.getUser());
    } else {
      console.log('User not authenticated, showing login button...');
      showLoginButton();
    }
  }, 1000);
});

function initializeApp(user) {
  console.log('Initializing application for user:', user);
  
  // Update version info
  const versionEl = document.getElementById('app-version');
  if (versionEl) {
    versionEl.textContent = 'v2.0.0';
  }
  
  // Update build timestamp
  const buildEl = document.getElementById('build-timestamp');
  if (buildEl) {
    buildEl.textContent = new Date().toLocaleDateString('sv-SE');
  }
  
  // Update user menu
  updateUserMenu(user);
  
  // Get user roles from ID token
  const account = window.entraAuth.getUser();
  const roles = account?.idTokenClaims?.roles || [];
  console.log('User roles:', roles);
  
  // Store roles for later use
  window.userRoles = roles;
  
  // Show role-based UI elements
  updateUIBasedOnRoles(roles);
  
  // Hide loading, show content
  showMainContent();
  
  // Initialize the main CRM app (app.js)
  // Wait a bit to ensure app.js is fully loaded
  setTimeout(() => {
    if (typeof window.initializeApp === 'function' && window.initializeApp !== initializeApp) {
      console.log('✅ Calling window.initializeApp() from app.js...');
      window.initializeApp();
    } else {
      console.error('❌ window.initializeApp not found or not ready - app.js might not be loaded');
      // Retry after another delay
      setTimeout(() => {
        if (typeof window.initializeApp === 'function' && window.initializeApp !== initializeApp) {
          console.log('✅ Retry: Calling window.initializeApp() from app.js...');
          window.initializeApp();
        }
      }, 1000);
    }
  }, 500);
  
  console.log('Application initialization started!');
}

// Expose globally so entra-auth.js can call it
window.initializeApp = initializeApp;

function updateUserMenu(user) {
  console.log('Updating user menu for:', user);
  
  // Header user menu elements
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userInitials = document.getElementById('userInitials');
  const userNameEl = document.getElementById('userName');
  
  // Sidebar elements
  const currentUserEl = document.getElementById('currentUser');
  
  // All login buttons (both in header and sidebar)
  const loginButtons = document.querySelectorAll('#loginBtn');
  
  // Update header user menu
  if (userMenuBtn) {
    userMenuBtn.style.display = 'flex';
    // Add click handler for dropdown toggle
    userMenuBtn.addEventListener('click', () => {
      const dropdown = userMenuBtn.nextElementSibling;
      if (dropdown && dropdown.tagName === 'UL') {
        dropdown.classList.toggle('hidden');
      }
    });
  }
  
  if (userInitials && user.name) {
    // Get initials from name
    const initials = user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
    userInitials.textContent = initials;
  }
  
  if (userNameEl) {
    userNameEl.textContent = user.name || user.username || 'User';
  }
  
  // Update sidebar current user
  if (currentUserEl) {
    currentUserEl.textContent = user.name || user.username || 'Inloggad';
    currentUserEl.classList.remove('text-base-content/70');
    currentUserEl.classList.add('text-success', 'font-semibold');
  }
  
  // Hide all login buttons, show logout button in sidebar
  loginButtons.forEach(btn => {
    if (btn) {
      btn.style.display = 'none';
    }
  });
  
  const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.style.display = 'block';
  }
  
  console.log('User menu updated successfully');
}

function updateUIBasedOnRoles(roles) {
  console.log('Updating UI based on roles:', roles);
  
  const isAdmin = roles.includes('Admin');
  const isSalesperson = roles.includes('Salesperson');
  
  // Admin-only elements (System Status, Security Dashboard)
  const adminElements = document.querySelectorAll('[data-role="admin"]');
  adminElements.forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  
  // Show role badge in sidebar
  const currentUserEl = document.getElementById('currentUser');
  if (currentUserEl && isAdmin) {
    currentUserEl.innerHTML += ' <span class="badge badge-error badge-xs ml-2">Admin</span>';
  } else if (currentUserEl && isSalesperson) {
    currentUserEl.innerHTML += ' <span class="badge badge-success badge-xs ml-2">Säljare</span>';
  }
  
  console.log('UI updated for roles:', { isAdmin, isSalesperson });
}

function showMainContent() {
  // Hide landing page
  const landingPage = document.getElementById('landing-page');
  if (landingPage) {
    landingPage.style.display = 'none';
  }
  
  // Show main app - restore visibility and position
  const mainApp = document.getElementById('app');
  if (mainApp) {
    mainApp.style.visibility = 'visible';
    mainApp.style.position = 'relative';
  }
  
  console.log('Main content displayed');
}

function showLoginButton() {
  // Hide loading spinner
  const authStatus = document.getElementById('auth-status');
  if (authStatus) {
    authStatus.style.display = 'none';
  }
  
  // Show login button
  const loginBtn = document.getElementById('landing-login-btn');
  if (loginBtn) {
    loginBtn.style.display = 'inline-block';
    loginBtn.addEventListener('click', async () => {
      console.log('Login button clicked');
      if (window.entraAuth) {
        try {
          await window.entraAuth.loginRedirect();
        } catch (error) {
          console.error('Login failed:', error);
        }
      }
    });
  }
}

// Handle logout
window.addEventListener('click', async (e) => {
  if (e.target.id === 'logoutBtn' || 
      e.target.id === 'sidebarLogoutBtn' || 
      e.target.closest('#logoutBtn') || 
      e.target.closest('#sidebarLogoutBtn')) {
    e.preventDefault();
    console.log('Logging out...');
    
    if (window.entraAuth) {
      try {
        await window.entraAuth.logout();
        // Logout will redirect back to landing page automatically
      } catch (error) {
        console.error('Logout failed:', error);
        // Fallback: reload page to show landing
        window.location.reload();
      }
    }
  }
  
  // Handle login button clicks (if shown before auth completes)
  if (e.target.id === 'loginBtn' || e.target.closest('#loginBtn')) {
    e.preventDefault();
    console.log('Login button clicked, redirecting...');
    
    if (window.entraAuth) {
      try {
        await window.entraAuth.loginRedirect();
      } catch (error) {
        console.error('Login failed:', error);
      }
    }
  }
});

console.log('App initializer loaded');
