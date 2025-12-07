/**
 * Azure AD B2C Authentication Module
 * Hanterar inloggning, utloggning och token-validering med Azure B2C
 */

'use strict';

// ============================================
// KONFIGURATION
// ============================================

// Configuration will be loaded dynamically from azure-b2c-config.js
let msalConfig = null;
let loginRequest = null;
let tokenRequest = null;
let passwordResetAuthority = null;
let profileEditAuthority = null;



// ============================================
// AZURE B2C AUTH CLASS
// ============================================

class AzureB2CAuth {
  constructor() {
    this.msalInstance = null;
    this.currentAccount = null;
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.initialized = false;
  }

  /**
   * Initialisera MSAL (Microsoft Authentication Library)
   */
  async initialize(config = {}) {
    try {
      // Load configuration from global scope
      if (typeof window !== 'undefined' && window.generateMsalConfig) {
        msalConfig = window.generateMsalConfig();
        loginRequest = window.generateLoginRequest();
        tokenRequest = window.generateTokenRequest();
        passwordResetAuthority = window.generatePasswordResetAuthority();
        profileEditAuthority = window.generateProfileEditAuthority();
      } else {
        console.error('Azure B2C configuration not found. Make sure azure-b2c-config.js is loaded.');
        return false;
      }

      // Merge custom config med defaults
      const finalConfig = {
        ...msalConfig,
        auth: { ...msalConfig.auth, ...config.auth },
        cache: { ...msalConfig.cache, ...config.cache }
      };

      // Skapa MSAL instance
      // I production, ladda MSAL från CDN:
      // <script src="https://alcdn.msauth.net/browser/2.38.0/js/msal-browser.min.js"></script>
      if (typeof msal === 'undefined') {
        console.warn('MSAL library not loaded. Include: <script src="https://alcdn.msauth.net/browser/2.38.0/js/msal-browser.min.js"></script>');
        return false;
      }

      this.msalInstance = new msal.PublicClientApplication(finalConfig);
      
      // Hantera redirect response
      const response = await this.msalInstance.handleRedirectPromise();
      if (response) {
        this.currentAccount = response.account;
        this.accessToken = response.accessToken;
        this.tokenExpiresAt = response.expiresOn;
        await this.onLoginSuccess(response);
      } else {
        // Försök hämta account från cache
        const accounts = this.msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          this.currentAccount = accounts[0];
          // Försök hämta token silent
          await this.acquireTokenSilent();
        }
      }

      this.initialized = true;
      return true;

    } catch (error) {
      console.error('Failed to initialize Azure B2C Auth:', error);
      
      // Hantera password reset
      if (error.errorMessage && error.errorMessage.indexOf('AADB2C90118') > -1) {
        await this.resetPassword();
      }
      
      return false;
    }
  }

  /**
   * Logga in användare
   */
  async login() {
    if (!this.initialized) {
      throw new Error('Auth not initialized. Call initialize() first.');
    }

    try {
      // Försök popup först (bättre UX)
      try {
        const response = await this.msalInstance.loginPopup(loginRequest);
        this.currentAccount = response.account;
        this.accessToken = response.accessToken;
        this.tokenExpiresAt = response.expiresOn;
        await this.onLoginSuccess(response);
        return response;
      } catch (popupError) {
        // Popup blockerad? Använd redirect
        console.log('Popup blocked, using redirect...');
        await this.msalInstance.loginRedirect(loginRequest);
      }

    } catch (error) {
      console.error('Login failed:', error);
      
      // Password reset?
      if (error.errorMessage && error.errorMessage.indexOf('AADB2C90118') > -1) {
        await this.resetPassword();
      } else {
        throw error;
      }
    }
  }

  /**
   * Logga ut användare
   */
  async logout() {
    if (!this.initialized) return;

    try {
      const logoutRequest = {
        account: this.currentAccount,
        postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri
      };

      // Rensa lokal data
      this.currentAccount = null;
      this.accessToken = null;
      this.tokenExpiresAt = null;

      // Logout från Azure B2C
      await this.msalInstance.logoutPopup(logoutRequest);

    } catch (error) {
      console.error('Logout failed:', error);
      // Fallback: redirect
      await this.msalInstance.logoutRedirect({
        account: this.currentAccount
      });
    }
  }

  /**
   * Hämta access token (silent)
   */
  async acquireTokenSilent() {
    if (!this.initialized || !this.currentAccount) {
      return null;
    }

    try {
      const request = {
        ...tokenRequest,
        account: this.currentAccount
      };

      const response = await this.msalInstance.acquireTokenSilent(request);
      this.accessToken = response.accessToken;
      this.tokenExpiresAt = response.expiresOn;
      return response.accessToken;

    } catch (error) {
      console.warn('Silent token acquisition failed:', error);
      
      // Token expired eller inte i cache? Använd interactive
      if (error.name === 'InteractionRequiredAuthError') {
        return await this.acquireTokenInteractive();
      }
      
      return null;
    }
  }

  /**
   * Hämta access token (interactive)
   */
  async acquireTokenInteractive() {
    try {
      const request = {
        ...tokenRequest,
        account: this.currentAccount
      };

      const response = await this.msalInstance.acquireTokenPopup(request);
      this.accessToken = response.accessToken;
      this.tokenExpiresAt = response.expiresOn;
      return response.accessToken;

    } catch (error) {
      console.error('Interactive token acquisition failed:', error);
      return null;
    }
  }

  /**
   * Hämta giltig access token (automatic refresh)
   */
  async getAccessToken() {
    // Finns token och är giltig?
    if (this.accessToken && this.tokenExpiresAt) {
      const now = new Date();
      const expiresAt = new Date(this.tokenExpiresAt);
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      
      // Token giltig i minst 5 minuter?
      if (timeUntilExpiry > 5 * 60 * 1000) {
        return this.accessToken;
      }
    }

    // Hämta ny token
    return await this.acquireTokenSilent();
  }

  /**
   * Kontrollera om användare är inloggad
   */
  isAuthenticated() {
    return this.initialized && this.currentAccount !== null;
  }

  /**
   * Hämta användarinformation
   */
  getUser() {
    if (!this.currentAccount) return null;

    return {
      id: this.currentAccount.homeAccountId,
      username: this.currentAccount.username,
      name: this.currentAccount.name,
      email: this.currentAccount.username,
      roles: this.getUserRoles(),
      claims: this.currentAccount.idTokenClaims
    };
  }

  /**
   * Hämta användarroller från token
   */
  getUserRoles() {
    if (!this.currentAccount || !this.currentAccount.idTokenClaims) {
      return [];
    }

    const claims = this.currentAccount.idTokenClaims;
    
    // Roller kan finnas i olika claims beroende på konfiguration
    return claims.roles || claims.extension_Role || claims.jobTitle || [];
  }

  /**
   * Kontrollera om användare har specifik roll
   */
  hasRole(role) {
    const roles = this.getUserRoles();
    return roles.includes(role);
  }

  /**
   * Återställ lösenord
   */
  async resetPassword() {
    try {
      const resetRequest = {
        authority: passwordResetAuthority,
        scopes: ['openid', 'profile']
      };

      await this.msalInstance.loginRedirect(resetRequest);

    } catch (error) {
      console.error('Password reset failed:', error);
      throw error;
    }
  }

  /**
   * Redigera profil
   */
  async editProfile() {
    try {
      const editRequest = {
        authority: profileEditAuthority,
        scopes: ['openid', 'profile']
      };

      const response = await this.msalInstance.acquireTokenPopup(editRequest);
      
      // Uppdatera account info
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        this.currentAccount = accounts[0];
      }

      return response;

    } catch (error) {
      console.error('Profile edit failed:', error);
      throw error;
    }
  }

  /**
   * Callback när login lyckas
   */
  async onLoginSuccess(response) {
    console.log('Login successful:', response.account.name);
    
    // Trigger custom event
    const event = new CustomEvent('azure-b2c-login', {
      detail: {
        account: response.account,
        accessToken: response.accessToken
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * Lägg till Authorization header till API-anrop
   */
  async getAuthHeaders() {
    const token = await this.getAccessToken();
    if (!token) return {};

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Fetch wrapper med automatisk auth
   */
  async authenticatedFetch(url, options = {}) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    });

    // 401 Unauthorized? Token kanske expired
    if (response.status === 401) {
      // Försök hämta nytt token och retry
      const newToken = await this.acquireTokenInteractive();
      if (newToken) {
        const retryHeaders = await this.getAuthHeaders();
        return fetch(url, {
          ...options,
          headers: {
            ...retryHeaders,
            ...options.headers
          }
        });
      }
    }

    return response;
  }
}

// ============================================
// EXPORT
// ============================================

// Global instance
const azureAuth = new AzureB2CAuth();

// Export för användning i andra moduler
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AzureB2CAuth, azureAuth };
}
