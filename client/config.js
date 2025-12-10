// API Configuration
// For local development: empty string (uses relative paths)
// For production: set to backend URL
const API_BASE = window.location.hostname === 'localhost' 
  ? '' 
  : 'https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net';

console.log('API Base URL:', API_BASE || 'relative (same origin)');
