// ==================== Authentication Helper ====================
/**
 * Fetch with automatic authentication token
 * Uses Entra Auth to get access token and adds to Authorization header
 */
async function fetchWithAuth(url, options = {}) {
  // Get access token from Entra Auth
  let token = null;
  if (window.entraAuth && window.entraAuth.isLoggedIn()) {
    try {
      token = await window.entraAuth.getAccessToken();
    } catch (error) {
      console.error('Failed to get access token:', error);
      // Continue without token - API will return 401 if auth is required
    }
  }

  // Add token to headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  // Make the request
  const response = await fetch(API_BASE + url, {
    ...options,
    headers,
  });

  // Handle errors
  if (!response.ok) {
    if (response.status === 401) {
      console.error('Unauthorized - token may be expired');
      // Could trigger re-login here
    }
    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
  }

  return response.json();
}
