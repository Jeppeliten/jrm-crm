// API Configuration
// For local development: empty string (uses relative paths)
// For production: set to backend URL
const API_BASE = window.location.hostname === 'localhost' 
  ? '' 
  : 'https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net';

console.log('API Base URL:', API_BASE || 'relative (same origin)');

// Microsoft Graph / Outlook Configuration
// Registrera app i Azure AD: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
const MICROSOFT_CONFIG = {
  // Application (client) ID från Azure AD App Registration
  clientId: 'YOUR_MICROSOFT_CLIENT_ID',  // ← Uppdatera med din Client ID
  
  // 'common' för multi-tenant, eller specifikt tenant-id
  tenantId: 'common',
  
  // Redirect URI (måste matcha det som är konfigurerat i Azure AD)
  redirectUri: window.location.hostname === 'localhost'
    ? 'http://localhost:3000/auth/callback'
    : window.location.origin + '/auth/callback',
  
  // Scopes som krävs för Outlook-integration
  scopes: [
    'User.Read',
    'Mail.Read',
    'Mail.Send',
    'Calendars.ReadWrite',
    'Contacts.Read'
  ]
};

// Kontrollera om Microsoft-integration är konfigurerad
const MICROSOFT_CONFIGURED = MICROSOFT_CONFIG.clientId !== 'YOUR_MICROSOFT_CLIENT_ID';

console.log('Microsoft Integration:', MICROSOFT_CONFIGURED ? 'Configured' : 'Not configured (using mock)');

