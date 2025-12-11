/**
 * Azure Entra ID Configuration för JRM CRM
 * Production-ready configuration
 */

const ENTRA_CONFIG = {
  auth: {
    clientId: '54121bc9-f692-40da-a114-cd3042ac46b2',
    authority: 'https://login.microsoftonline.com/401d3cf2-f075-4920-b118-ccbb47008d45',
    redirectUri: 'https://lively-grass-0a14e0d03.3.azurestaticapps.net',
    postLogoutRedirectUri: 'https://lively-grass-0a14e0d03.3.azurestaticapps.net',
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case 0: console.error('[MSAL]', message); break;
          case 1: console.warn('[MSAL]', message); break;
          case 2: console.info('[MSAL]', message); break;
          case 3: console.debug('[MSAL]', message); break;
        }
      },
      logLevel: 2, // Info level
      piiLoggingEnabled: false,
    },
  },
};

// Login request scopes
const LOGIN_REQUEST = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
  prompt: 'select_account',
};

// Token request for API calls (includes roles claim)
const TOKEN_REQUEST = {
  scopes: [
    'User.Read',
    'openid',
    'profile',
    'email'
  ],
  forceRefresh: false,
};

// API Configuration
const API_CONFIG = {
  baseUrl: 'https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net',
  endpoints: {
    customers: '/api/customers',
    deals: '/api/deals',
    activities: '/api/activities',
    users: '/api/users',
    health: '/api/health',
  },
};

// Export for use in app
if (typeof window !== 'undefined') {
  window.ENTRA_CONFIG = ENTRA_CONFIG;
  window.LOGIN_REQUEST = LOGIN_REQUEST;
  window.TOKEN_REQUEST = TOKEN_REQUEST;
  window.API_CONFIG = API_CONFIG;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ENTRA_CONFIG,
    LOGIN_REQUEST,
    TOKEN_REQUEST,
    API_CONFIG,
  };
}
