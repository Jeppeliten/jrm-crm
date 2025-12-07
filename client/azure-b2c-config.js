/**
 * Azure B2C Configuration för Frontend
 * Anpassa dessa värden enligt din Azure B2C-tenant
 */

const AZURE_B2C_CONFIG = {
  // Tenant information - ersätt med dina värden
  tenantName: 'varderingsdata', // Din tenant-namn
  clientId: '54121bc9-f692-40da-a114-cd3042ac46b2', // Din Application (client) ID
  
  // User flows (policies) - ersätt med dina policy-namn
  signUpSignInPolicy: 'B2C_1_signup_signin',
  passwordResetPolicy: 'B2C_1_password_reset',
  profileEditPolicy: 'B2C_1_profile_edit',
  
  // Scopes for your backend API
  apiScopes: ['api://crm-backend/read', 'api://crm-backend/write'],
  
  // Development/Production URLs
  redirectUri: 'https://lively-grass-0a14e0d03.3.azurestaticapps.net',
  postLogoutRedirectUri: 'https://lively-grass-0a14e0d03.3.azurestaticapps.net',
  
  // Backend API base URL
  apiBaseUrl: 'https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net'
};

// Generate the full configuration for MSAL
const generateMsalConfig = () => {
  const authority = `https://${AZURE_B2C_CONFIG.tenantName}.b2clogin.com/${AZURE_B2C_CONFIG.tenantName}.onmicrosoft.com/${AZURE_B2C_CONFIG.signUpSignInPolicy}`;
  
  return {
    auth: {
      clientId: AZURE_B2C_CONFIG.clientId,
      authority: authority,
      knownAuthorities: [`${AZURE_B2C_CONFIG.tenantName}.b2clogin.com`],
      redirectUri: AZURE_B2C_CONFIG.redirectUri,
      postLogoutRedirectUri: AZURE_B2C_CONFIG.postLogoutRedirectUri,
      navigateToLoginRequestUrl: true
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
      secureCookies: true
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
        piiLoggingEnabled: false
      },
      windowHashTimeout: 60000,
      iframeHashTimeout: 6000,
      loadFrameTimeout: 0,
      asyncPopups: false
    }
  };
};

// Login request configuration
const generateLoginRequest = () => ({
  scopes: ['openid', 'profile', 'email', ...AZURE_B2C_CONFIG.apiScopes],
  prompt: 'select_account'
});

// Token request för API-anrop
const generateTokenRequest = () => ({
  scopes: AZURE_B2C_CONFIG.apiScopes,
  forceRefresh: false
});

// Password reset authority
const generatePasswordResetAuthority = () => 
  `https://${AZURE_B2C_CONFIG.tenantName}.b2clogin.com/${AZURE_B2C_CONFIG.tenantName}.onmicrosoft.com/${AZURE_B2C_CONFIG.passwordResetPolicy}`;

// Profile edit authority  
const generateProfileEditAuthority = () => 
  `https://${AZURE_B2C_CONFIG.tenantName}.b2clogin.com/${AZURE_B2C_CONFIG.tenantName}.onmicrosoft.com/${AZURE_B2C_CONFIG.profileEditPolicy}`;

// Export configuration
if (typeof window !== 'undefined') {
  window.AZURE_B2C_CONFIG = AZURE_B2C_CONFIG;
  window.generateMsalConfig = generateMsalConfig;
  window.generateLoginRequest = generateLoginRequest;
  window.generateTokenRequest = generateTokenRequest;
  window.generatePasswordResetAuthority = generatePasswordResetAuthority;
  window.generateProfileEditAuthority = generateProfileEditAuthority;
}