/**
 * Entra ID Authentication Helper
 * Simple wrapper för MSAL.js authentication
 */

class EntraAuth {
  constructor() {
    if (!window.ENTRA_CONFIG) {
      console.error('ENTRA_CONFIG not loaded! Make sure entra-config.js is included.');
      return;
    }

    // Initialize MSAL
    this.msalInstance = new msal.PublicClientApplication(window.ENTRA_CONFIG);
    this.account = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      await this.msalInstance.initialize();
      this.isInitialized = true;
      
      // Check if user is already logged in or coming back from redirect
      const redirectResponse = await this.handleRedirectPromise();
      
      // If we got a redirect response, handleRedirectPromise already dispatched the event
      if (redirectResponse) {
        return true;
      }
      
      // Check for existing accounts (already logged in before)
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        this.account = accounts[0];
        console.log('User already logged in (existing session):', this.account.username);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error initializing MSAL:', error);
      return false;
    }
  }

  async handleRedirectPromise() {
    try {
      const response = await this.msalInstance.handleRedirectPromise();
      if (response) {
        this.account = response.account;
        console.log('Login successful after redirect:', this.account.username);
        
        // Call initializeApp directly since we're coming back from redirect
        if (typeof window.initializeApp === 'function') {
          window.initializeApp(this.account);
        }
        
        // Also dispatch event for any other listeners
        window.dispatchEvent(new CustomEvent('entra-login-success', {
          detail: { user: this.account }
        }));
        
        return response;
      }
      return null;
    } catch (error) {
      console.error('Error handling redirect:', error);
      throw error;
    }
  }

  async login() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const response = await this.msalInstance.loginPopup(window.LOGIN_REQUEST);
      this.account = response.account;
      console.log('Login successful:', this.account.username);
      return response;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async loginRedirect() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('Starting login redirect...');
      await this.msalInstance.loginRedirect(window.LOGIN_REQUEST);
      // This line won't execute as redirect happens immediately
    } catch (error) {
      console.error('Login redirect failed:', error);
      throw error;
    }
  }

  async logout() {
    try {
      // Use redirect instead of popup for cleaner logout
      await this.msalInstance.logoutRedirect({
        account: this.account,
        postLogoutRedirectUri: window.location.origin
      });
      this.account = null;
      console.log('Logout successful - redirecting to landing page');
    } catch (error) {
      console.error('Logout failed:', error);
      // Fallback: just reload the page to show landing page
      window.location.reload();
    }
  }

  async getAccessToken() {
    if (!this.account) {
      throw new Error('No account logged in');
    }

    try {
      const response = await this.msalInstance.acquireTokenSilent({
        ...window.TOKEN_REQUEST,
        account: this.account,
      });
      return response.accessToken;
    } catch (error) {
      // Token acquisition failed, try interactive
      if (error instanceof msal.InteractionRequiredAuthError) {
        const response = await this.msalInstance.acquireTokenPopup(window.TOKEN_REQUEST);
        return response.accessToken;
      }
      throw error;
    }
  }

  isLoggedIn() {
    return this.account !== null;
  }

  getUser() {
    return this.account;
  }

  getUserName() {
    return this.account?.name || this.account?.username || 'Unknown';
  }

  getUserEmail() {
    return this.account?.username || '';
  }
}

// Create global instance
window.entraAuth = new EntraAuth();

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initializing Entra ID authentication...');
  
  try {
    const isLoggedIn = await window.entraAuth.initialize();
    
    if (isLoggedIn) {
      console.log('User authenticated:', window.entraAuth.getUserName());
      
      // Dispatch custom event for app to handle
      window.dispatchEvent(new CustomEvent('entra-login-success', {
        detail: { user: window.entraAuth.getUser() }
      }));
    } else {
      console.log('User not authenticated - waiting for manual login');
      
      // Don't auto-redirect - let the user click the login button
      // This prevents the double redirect issue
    }
  } catch (error) {
    console.error('Authentication initialization failed:', error);
  }
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EntraAuth;
}
