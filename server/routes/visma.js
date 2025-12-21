/**
 * Visma.net Integration Routes
 * 
 * API-endpoints för Visma.net-integration
 * Hanterar OAuth 2.0 flöde, kundsynkronisering och statusövervakning
 */

const express = require('express');
const router = express.Router();
const VismaNetService = require('../services/visma-net-service');
const { VISMA_CONFIG, validateConfig } = require('../config/visma-config');

// Singleton-instans av Visma-service
let vismaService = null;

// In-memory state för OAuth-flöde (i produktion: använd session/database)
const oauthStates = new Map();

/**
 * Initialisera Visma-service (lazy loading)
 */
function getVismaService() {
  if (!vismaService) {
    vismaService = new VismaNetService(VISMA_CONFIG);
    
    // Logga events för debugging
    vismaService.on('auth:success', (data) => {
      console.log('🔐 Visma.net: Autentisering lyckades');
    });
    
    vismaService.on('auth:error', (error) => {
      console.error('❌ Visma.net: Autentiseringsfel:', error.message);
    });
    
    vismaService.on('customer:created', (customer) => {
      console.log(`✅ Visma.net: Kund skapad - ${customer.name}`);
    });
    
    vismaService.on('customer:updated', (customer) => {
      console.log(`✅ Visma.net: Kund uppdaterad - ${customer.name || customer.number}`);
    });
  }
  return vismaService;
}

// ============================================
// STATUS & CONFIGURATION
// ============================================

/**
 * GET /api/visma/status
 * Hämta aktuell status för Visma.net-integration
 */
router.get('/status', async (req, res) => {
  try {
    const service = getVismaService();
    const authStatus = service.getAuthStatus();
    const configValid = validateConfig();
    
    // Om vi har en giltig token, testa anslutningen
    let connectionStatus = null;
    if (authStatus.isAuthenticated) {
      try {
        connectionStatus = await service.testConnection();
      } catch (error) {
        connectionStatus = { success: false, error: error.message };
      }
    }
    
    res.json({
      configured: configValid,
      connected: authStatus.isAuthenticated && connectionStatus?.success,
      authentication: {
        isAuthenticated: authStatus.isAuthenticated,
        tokenExpiry: authStatus.tokenExpiry ? new Date(authStatus.tokenExpiry).toISOString() : null,
        timeUntilExpiry: authStatus.timeUntilExpiry,
        hasRefreshToken: authStatus.hasRefreshToken
      },
      company: connectionStatus?.companyInfo || null,
      message: !configValid 
        ? 'Visma.net är inte konfigurerat. Sätt miljövariabler för VISMA_CLIENT_ID, VISMA_CLIENT_SECRET och VISMA_COMPANY_DB_ID.'
        : (!authStatus.isAuthenticated 
            ? 'Inte autentiserad. Starta OAuth-flöde via /api/visma/auth/start'
            : (connectionStatus?.success 
                ? 'Ansluten till Visma.net' 
                : `Anslutningsfel: ${connectionStatus?.error}`)),
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking Visma status:', error);
    res.status(500).json({ 
      error: 'Failed to check Visma status',
      message: error.message 
    });
  }
});

/**
 * GET /api/visma/config
 * Hämta konfigurationsstatus (utan känsliga uppgifter)
 */
router.get('/config', (req, res) => {
  const configValid = validateConfig();
  
  res.json({
    configured: configValid,
    hasClientId: !!VISMA_CONFIG.clientId,
    hasClientSecret: !!VISMA_CONFIG.clientSecret,
    hasCompanyDbId: !!VISMA_CONFIG.companyDatabaseId,
    redirectUri: VISMA_CONFIG.redirectUri,
    baseUrl: VISMA_CONFIG.baseUrl,
    syncOptions: VISMA_CONFIG.syncOptions,
    fieldMapping: {
      customerFields: Object.keys(VISMA_CONFIG.fieldMapping?.customer || {}),
      invoiceFields: Object.keys(VISMA_CONFIG.fieldMapping?.invoice || {}),
      productFields: Object.keys(VISMA_CONFIG.fieldMapping?.product || {})
    }
  });
});

// ============================================
// OAUTH 2.0 AUTHENTICATION
// ============================================

/**
 * GET /api/visma/auth/start
 * Starta OAuth 2.0 Authorization Code Flow
 * Returnerar URL som användaren ska omdirigeras till
 */
router.get('/auth/start', (req, res) => {
  try {
    const service = getVismaService();
    
    if (!VISMA_CONFIG.clientId) {
      return res.status(400).json({
        error: 'Visma.net är inte konfigurerat',
        message: 'Sätt VISMA_CLIENT_ID, VISMA_CLIENT_SECRET och VISMA_COMPANY_DB_ID som miljövariabler'
      });
    }
    
    const { authUrl, state } = service.generateAuthUrl();
    
    // Spara state för verifiering vid callback (TTL: 10 minuter)
    oauthStates.set(state, {
      createdAt: Date.now(),
      returnUrl: req.query.returnUrl || '/'
    });
    
    // Rensa gamla states (äldre än 10 minuter)
    const now = Date.now();
    for (const [key, value] of oauthStates.entries()) {
      if (now - value.createdAt > 10 * 60 * 1000) {
        oauthStates.delete(key);
      }
    }
    
    res.json({
      authUrl,
      state,
      message: 'Omdirigera användaren till authUrl för att starta inloggning'
    });
  } catch (error) {
    console.error('Error starting Visma auth:', error);
    res.status(500).json({ 
      error: 'Failed to start authentication',
      message: error.message 
    });
  }
});

/**
 * GET /api/visma/auth/redirect
 * Redirect endpoint för att automatiskt starta OAuth
 * Användaren omdirigeras direkt till Visma.net login
 */
router.get('/auth/redirect', (req, res) => {
  try {
    const service = getVismaService();
    
    if (!VISMA_CONFIG.clientId) {
      return res.status(400).send(`
        <html>
          <body>
            <h1>Konfigurationsfel</h1>
            <p>Visma.net är inte konfigurerat. Kontakta systemadministratör.</p>
          </body>
        </html>
      `);
    }
    
    const { authUrl, state } = service.generateAuthUrl();
    
    // Spara state
    oauthStates.set(state, {
      createdAt: Date.now(),
      returnUrl: req.query.returnUrl || '/'
    });
    
    // Omdirigera till Visma.net login
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error redirecting to Visma auth:', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>Fel</h1>
          <p>Kunde inte starta autentisering: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

/**
 * GET /api/visma/callback
 * OAuth 2.0 Callback - Visma.net omdirigerar hit efter login
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    // Hantera fel från Visma.net
    if (error) {
      console.error('Visma OAuth error:', error, error_description);
      return res.status(400).send(`
        <html>
          <head>
            <title>Autentiseringsfel</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
              .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #d32f2f; }
              .error { background: #ffebee; padding: 15px; border-radius: 4px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Autentiseringsfel</h1>
              <div class="error">
                <strong>${error}</strong><br>
                ${error_description || 'Ingen ytterligare information'}
              </div>
              <p><a href="/">Tillbaka till startsidan</a></p>
            </div>
          </body>
        </html>
      `);
    }
    
    // Validera att vi har code och state
    if (!code || !state) {
      return res.status(400).send(`
        <html>
          <body>
            <h1>Ogiltigt anrop</h1>
            <p>Saknar authorization code eller state.</p>
          </body>
        </html>
      `);
    }
    
    // Verifiera state
    const savedState = oauthStates.get(state);
    if (!savedState) {
      return res.status(400).send(`
        <html>
          <body>
            <h1>Ogiltigt state</h1>
            <p>State kunde inte verifieras. Försök logga in igen.</p>
          </body>
        </html>
      `);
    }
    
    // Ta bort använd state
    oauthStates.delete(state);
    
    // Byt authorization code mot tokens
    const service = getVismaService();
    const tokens = await service.exchangeCodeForTokens(code, state);
    
    // Testa anslutningen
    const connectionTest = await service.testConnection();
    
    // Visa framgångssida
    res.send(`
      <html>
        <head>
          <title>Visma.net Ansluten</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #4caf50; }
            .success { background: #e8f5e9; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .info { background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .btn { display: inline-block; padding: 10px 20px; background: #1976d2; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Ansluten till Visma.net!</h1>
            <div class="success">
              <strong>Autentisering lyckades</strong><br>
              Token gäller i ${Math.round(tokens.expiresIn / 60)} minuter
            </div>
            ${connectionTest.companyInfo ? `
              <div class="info">
                <strong>Företag:</strong> ${connectionTest.companyInfo.name || 'Okänt'}<br>
                <strong>Database ID:</strong> ${connectionTest.companyInfo.number || VISMA_CONFIG.companyDatabaseId}
              </div>
            ` : ''}
            <a href="${savedState.returnUrl}" class="btn">Fortsätt till CRM</a>
          </div>
          <script>
            // Meddela parent window om vi är i popup
            if (window.opener) {
              window.opener.postMessage({ type: 'visma-auth-success', data: { connected: true } }, '*');
              setTimeout(() => window.close(), 3000);
            }
          </script>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Error in Visma callback:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Fel</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #d32f2f; }
            .error { background: #ffebee; padding: 15px; border-radius: 4px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Fel vid tokenutbyte</h1>
            <div class="error">${error.message}</div>
            <p><a href="/api/visma/auth/redirect">Försök igen</a></p>
          </div>
        </body>
      </html>
    `);
  }
});

/**
 * POST /api/visma/auth/logout
 * Logga ut från Visma.net (rensa tokens)
 */
router.post('/auth/logout', (req, res) => {
  try {
    const service = getVismaService();
    service.clearAuth();
    
    res.json({
      success: true,
      message: 'Utloggad från Visma.net'
    });
  } catch (error) {
    console.error('Error logging out from Visma:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// ============================================
// CUSTOMER OPERATIONS
// ============================================

/**
 * GET /api/visma/customers
 * Hämta alla kunder från Visma.net
 */
router.get('/customers', async (req, res) => {
  try {
    const service = getVismaService();
    
    if (!service.getAuthStatus().isAuthenticated) {
      return res.status(401).json({
        error: 'Inte autentiserad',
        message: 'Logga in på Visma.net först via /api/visma/auth/start'
      });
    }
    
    const { page = 0, pageSize = 50, lastModified } = req.query;
    
    const customers = await service.getCustomers({
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      lastModified
    });
    
    res.json({
      success: true,
      count: customers.length,
      customers
    });
  } catch (error) {
    console.error('Error fetching Visma customers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch customers',
      message: error.message 
    });
  }
});

/**
 * GET /api/visma/customers/:customerNumber
 * Hämta specifik kund från Visma.net
 */
router.get('/customers/:customerNumber', async (req, res) => {
  try {
    const service = getVismaService();
    
    if (!service.getAuthStatus().isAuthenticated) {
      return res.status(401).json({ error: 'Inte autentiserad' });
    }
    
    const customer = await service.findCustomerByNumber(req.params.customerNumber);
    
    if (!customer) {
      return res.status(404).json({ 
        error: 'Kund finns inte',
        customerNumber: req.params.customerNumber 
      });
    }
    
    res.json(customer);
  } catch (error) {
    console.error('Error fetching Visma customer:', error);
    res.status(500).json({ 
      error: 'Failed to fetch customer',
      message: error.message 
    });
  }
});

/**
 * POST /api/visma/customers/sync
 * Synkronisera kund från CRM till Visma.net
 */
router.post('/customers/sync', async (req, res) => {
  try {
    const service = getVismaService();
    
    if (!service.getAuthStatus().isAuthenticated) {
      return res.status(401).json({ error: 'Inte autentiserad' });
    }
    
    const customerData = req.body;
    
    if (!customerData || !customerData.namn) {
      return res.status(400).json({
        error: 'Ogiltig kunddata',
        message: 'Fältet "namn" är obligatoriskt'
      });
    }
    
    const result = await service.upsertCustomer(customerData);
    
    res.json({
      success: true,
      message: 'Kund synkroniserad till Visma.net',
      customer: result
    });
  } catch (error) {
    console.error('Error syncing customer to Visma:', error);
    res.status(500).json({ 
      error: 'Failed to sync customer',
      message: error.message 
    });
  }
});

// ============================================
// PRODUCT OPERATIONS
// ============================================

/**
 * GET /api/visma/products
 * Hämta alla produkter/artiklar från Visma.net
 */
router.get('/products', async (req, res) => {
  try {
    const service = getVismaService();
    
    if (!service.getAuthStatus().isAuthenticated) {
      return res.status(401).json({ error: 'Inte autentiserad' });
    }
    
    const { page = 0, pageSize = 50 } = req.query;
    
    const products = await service.getProducts({
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
    
    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Error fetching Visma products:', error);
    res.status(500).json({ 
      error: 'Failed to fetch products',
      message: error.message 
    });
  }
});

/**
 * GET /api/visma/products/:inventoryId
 * Hämta specifik produkt från Visma.net
 */
router.get('/products/:inventoryId', async (req, res) => {
  try {
    const service = getVismaService();
    
    if (!service.getAuthStatus().isAuthenticated) {
      return res.status(401).json({ error: 'Inte autentiserad' });
    }
    
    const product = await service.getProduct(req.params.inventoryId);
    res.json(product);
  } catch (error) {
    console.error('Error fetching Visma product:', error);
    res.status(500).json({ 
      error: 'Failed to fetch product',
      message: error.message 
    });
  }
});

/**
 * POST /api/visma/products
 * Skapa ny produkt i Visma.net
 */
router.post('/products', async (req, res) => {
  try {
    const service = getVismaService();
    
    if (!service.getAuthStatus().isAuthenticated) {
      return res.status(401).json({ error: 'Inte autentiserad' });
    }
    
    const productData = req.body;
    
    if (!productData || !productData.inventoryID || !productData.description) {
      return res.status(400).json({
        error: 'Ogiltig produktdata',
        message: 'Fälten "inventoryID" och "description" är obligatoriska'
      });
    }
    
    const result = await service.createProduct(productData);
    
    res.status(201).json({
      success: true,
      message: 'Produkt skapad i Visma.net',
      product: result
    });
  } catch (error) {
    console.error('Error creating Visma product:', error);
    res.status(500).json({ 
      error: 'Failed to create product',
      message: error.message 
    });
  }
});

/**
 * PUT /api/visma/products/:inventoryId
 * Uppdatera produkt i Visma.net
 */
router.put('/products/:inventoryId', async (req, res) => {
  try {
    const service = getVismaService();
    
    if (!service.getAuthStatus().isAuthenticated) {
      return res.status(401).json({ error: 'Inte autentiserad' });
    }
    
    const result = await service.updateProduct(req.params.inventoryId, req.body);
    
    res.json({
      success: true,
      message: 'Produkt uppdaterad i Visma.net',
      product: result
    });
  } catch (error) {
    console.error('Error updating Visma product:', error);
    res.status(500).json({ 
      error: 'Failed to update product',
      message: error.message 
    });
  }
});

/**
 * PATCH /api/visma/products/:inventoryId/price
 * Uppdatera enbart produktpris
 */
router.patch('/products/:inventoryId/price', async (req, res) => {
  try {
    const service = getVismaService();
    
    if (!service.getAuthStatus().isAuthenticated) {
      return res.status(401).json({ error: 'Inte autentiserad' });
    }
    
    const { price } = req.body;
    
    if (price === undefined || price === null) {
      return res.status(400).json({
        error: 'Ogiltigt pris',
        message: 'Fältet "price" är obligatoriskt'
      });
    }
    
    const result = await service.updateProductPrice(req.params.inventoryId, price);
    
    res.json({
      success: true,
      message: 'Produktpris uppdaterat',
      product: result
    });
  } catch (error) {
    console.error('Error updating product price:', error);
    res.status(500).json({ 
      error: 'Failed to update product price',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/visma/products/:inventoryId
 * Ta bort produkt från Visma.net
 */
router.delete('/products/:inventoryId', async (req, res) => {
  try {
    const service = getVismaService();
    
    if (!service.getAuthStatus().isAuthenticated) {
      return res.status(401).json({ error: 'Inte autentiserad' });
    }
    
    await service.deleteProduct(req.params.inventoryId);
    
    res.json({
      success: true,
      message: 'Produkt borttagen från Visma.net'
    });
  } catch (error) {
    console.error('Error deleting Visma product:', error);
    res.status(500).json({ 
      error: 'Failed to delete product',
      message: error.message 
    });
  }
});

// ============================================
// LOOKUP DATA
// ============================================

/**
 * GET /api/visma/company
 * Hämta företagsinformation från Visma.net
 */
router.get('/company', async (req, res) => {
  try {
    const service = getVismaService();
    
    if (!service.getAuthStatus().isAuthenticated) {
      return res.status(401).json({ error: 'Inte autentiserad' });
    }
    
    const companyInfo = await service.getCompanyInfo();
    res.json(companyInfo);
  } catch (error) {
    console.error('Error fetching company info:', error);
    res.status(500).json({ 
      error: 'Failed to fetch company info',
      message: error.message 
    });
  }
});

/**
 * GET /api/visma/categories
 * Hämta produktkategorier
 */
router.get('/categories', async (req, res) => {
  try {
    const service = getVismaService();
    
    if (!service.getAuthStatus().isAuthenticated) {
      return res.status(401).json({ error: 'Inte autentiserad' });
    }
    
    const categories = await service.getProductCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ 
      error: 'Failed to fetch categories',
      message: error.message 
    });
  }
});

/**
 * GET /api/visma/vat-categories
 * Hämta momskategorier
 */
router.get('/vat-categories', async (req, res) => {
  try {
    const service = getVismaService();
    
    if (!service.getAuthStatus().isAuthenticated) {
      return res.status(401).json({ error: 'Inte autentiserad' });
    }
    
    const vatCategories = await service.getVatCategories();
    res.json(vatCategories);
  } catch (error) {
    console.error('Error fetching VAT categories:', error);
    res.status(500).json({ 
      error: 'Failed to fetch VAT categories',
      message: error.message 
    });
  }
});

// ============================================
// TEST ENDPOINT
// ============================================

/**
 * GET /api/visma/test
 * Testa Visma.net-anslutningen
 */
router.get('/test', async (req, res) => {
  try {
    const service = getVismaService();
    
    if (!service.getAuthStatus().isAuthenticated) {
      return res.status(401).json({ 
        error: 'Inte autentiserad',
        message: 'Logga in först via /api/visma/auth/redirect'
      });
    }
    
    const result = await service.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Error testing Visma connection:', error);
    res.status(500).json({ 
      error: 'Connection test failed',
      message: error.message 
    });
  }
});

module.exports = router;
