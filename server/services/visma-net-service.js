/**
 * Visma.net Integration Service
 * 
 * Hanterar all kommunikation med Visma.net API
 * Inkluderar OAuth 2.0 autentisering, kundsynkronisering, fakturahantering
 * och ekonomisk data-synkronisering
 * 
 * API Documentation: https://integration.visma.net/API-index/
 */

const https = require('https');
const crypto = require('crypto');

class VismaNetService {
  constructor(config = {}) {
    this.config = {
      // Visma.net API Base URLs
      baseUrl: config.baseUrl || 'https://integration.visma.net/API',
      authUrl: config.authUrl || 'https://identity.visma.net/connect',
      
      // OAuth 2.0 Credentials (ska sättas via miljövariabler)
      clientId: config.clientId || process.env.VISMA_CLIENT_ID,
      clientSecret: config.clientSecret || process.env.VISMA_CLIENT_SECRET,
      redirectUri: config.redirectUri || process.env.VISMA_REDIRECT_URI,
      
      // Företagsdatabase i Visma.net
      companyDatabaseId: config.companyDatabaseId || process.env.VISMA_COMPANY_DB_ID,
      
      // Synkroniseringsinställningar
      syncOptions: {
        autoSync: config.autoSync || false,
        syncInterval: config.syncInterval || 300000, // 5 minuter
        batchSize: config.batchSize || 50,
        retryAttempts: config.retryAttempts || 3,
        retryDelay: config.retryDelay || 1000
      },
      
      // Mappning mellan CRM-fält och Visma.net-fält
      fieldMapping: {
        customer: {
          // CRM -> Visma.net
          'id': 'number',
          'namn': 'name',
          'email': 'mainContact.email',
          'telefon': 'mainContact.phone',
          'adress': 'mainAddress.addressLine1',
          'postnummer': 'mainAddress.postalCode',
          'stad': 'mainAddress.city',
          'orgNumber': 'corporateID',
          'customerNumber': 'number'
        },
        invoice: {
          'customerId': 'customer.number',
          'amount': 'amount',
          'dueDate': 'dueDate',
          'description': 'description',
          'date': 'date'
        }
      },
      
      ...config
    };
    
    // OAuth tokens
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    
    // API rate limiting
    this.lastRequestTime = 0;
    this.rateLimitDelay = 100; // ms mellan requests
    
    // Event handlers
    this.eventHandlers = new Map();
    
    console.log('🔌 Visma.net Service initialized');
  }
  
  /**
   * Event system för integration
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }
  
  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Event handler error for ${event}:`, error);
      }
    });
  }
  
  /**
   * OAuth 2.0 Authorization Code Flow
   * Steg 1: Generera authorization URL
   */
  generateAuthUrl(state = null) {
    if (!this.config.clientId || !this.config.redirectUri) {
      throw new Error('Client ID and Redirect URI required for OAuth');
    }
    
    const stateParam = state || crypto.randomBytes(16).toString('hex');
    const scopes = [
      'VismaNetApi',
      'offline_access'
    ].join(' ');
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes,
      state: stateParam
    });
    
    const authUrl = `${this.config.authUrl}/authorize?${params.toString()}`;
    
    console.log('📋 Generated Visma.net auth URL:', authUrl);
    
    return {
      authUrl,
      state: stateParam
    };
  }
  
  /**
   * OAuth 2.0 Authorization Code Flow
   * Steg 2: Byt authorization code mot access token
   */
  async exchangeCodeForTokens(authCode, state = null) {
    try {
      const tokenData = {
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: authCode,
        redirect_uri: this.config.redirectUri
      };
      
      const response = await this.makeRequest(
        'POST',
        `${this.config.authUrl}/token`,
        tokenData,
        {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        false // Ingen authorization header
      );
      
      if (response.access_token) {
        this.accessToken = response.access_token;
        this.refreshToken = response.refresh_token;
        this.tokenExpiry = Date.now() + (response.expires_in * 1000);
        
        console.log('✅ Successfully obtained Visma.net tokens');
        this.emit('auth:success', response);
        
        return {
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          expiresIn: response.expires_in,
          tokenType: response.token_type
        };
      } else {
        throw new Error('No access token received');
      }
      
    } catch (error) {
      console.error('❌ Token exchange failed:', error);
      this.emit('auth:error', error);
      throw error;
    }
  }
  
  /**
   * Förnya access token med refresh token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      const tokenData = {
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.refreshToken
      };
      
      const response = await this.makeRequest(
        'POST',
        `${this.config.authUrl}/token`,
        tokenData,
        {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        false
      );
      
      if (response.access_token) {
        this.accessToken = response.access_token;
        this.tokenExpiry = Date.now() + (response.expires_in * 1000);
        
        // Refresh token kan också förnyas
        if (response.refresh_token) {
          this.refreshToken = response.refresh_token;
        }
        
        console.log('🔄 Successfully refreshed Visma.net token');
        this.emit('auth:refreshed', response);
        
        return true;
      } else {
        throw new Error('No access token in refresh response');
      }
      
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      this.emit('auth:refresh_error', error);
      throw error;
    }
  }
  
  /**
   * Kontrollera om token behöver förnyas
   */
  async ensureValidToken() {
    if (!this.accessToken) {
      throw new Error('No access token available. Please authenticate first.');
    }
    
    // Förnya token 5 minuter innan det går ut
    const renewalBuffer = 5 * 60 * 1000; // 5 minuter
    if (this.tokenExpiry && (Date.now() + renewalBuffer) >= this.tokenExpiry) {
      await this.refreshAccessToken();
    }
  }
  
  /**
   * Generisk HTTP request-metod med rate limiting och error handling
   */
  async makeRequest(method, url, data = null, headers = {}, useAuth = true) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => 
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
    
    return new Promise((resolve, reject) => {
      let requestBody = '';
      let contentType = 'application/json';
      
      // Hantera olika dataformat
      if (data) {
        if (headers['Content-Type'] === 'application/x-www-form-urlencoded') {
          requestBody = new URLSearchParams(data).toString();
          contentType = 'application/x-www-form-urlencoded';
        } else {
          requestBody = JSON.stringify(data);
        }
      }
      
      // Sätt headers
      const requestHeaders = {
        'Content-Type': contentType,
        'User-Agent': 'CRM-Visma-Integration/1.0',
        ...headers
      };
      
      if (useAuth && this.accessToken) {
        requestHeaders['Authorization'] = `Bearer ${this.accessToken}`;
      }
      
      if (requestBody) {
        requestHeaders['Content-Length'] = Buffer.byteLength(requestBody);
      }
      
      // Parsa URL
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: requestHeaders,
        timeout: 30000 // 30 sekunder timeout
      };
      
      const req = https.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          try {
            let parsedResponse;
            
            // Försök parsa JSON, annars returnera raw text
            try {
              parsedResponse = JSON.parse(responseBody);
            } catch (e) {
              parsedResponse = responseBody;
            }
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsedResponse);
            } else {
              const error = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
              error.statusCode = res.statusCode;
              error.response = parsedResponse;
              reject(error);
            }
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      // Skicka data om det finns
      if (requestBody) {
        req.write(requestBody);
      }
      
      req.end();
    });
  }
  
  /**
   * Testa API-anslutningen
   */
  async testConnection() {
    try {
      await this.ensureValidToken();
      
      // Testa genom att hämta företagsinformation
      const companyInfo = await this.getCompanyInfo();
      
      console.log('✅ Visma.net connection test successful');
      this.emit('connection:success', companyInfo);
      
      return {
        success: true,
        companyInfo,
        message: 'Anslutningen till Visma.net fungerar'
      };
      
    } catch (error) {
      console.error('❌ Visma.net connection test failed:', error);
      this.emit('connection:error', error);
      
      return {
        success: false,
        error: error.message,
        message: 'Kunde inte ansluta till Visma.net'
      };
    }
  }
  
  /**
   * Hämta företagsinformation från Visma.net
   */
  async getCompanyInfo() {
    await this.ensureValidToken();
    
    const url = `${this.config.baseUrl}/controller/api/v1/company/${this.config.companyDatabaseId}`;
    
    try {
      const response = await this.makeRequest('GET', url);
      return response;
    } catch (error) {
      console.error('Failed to get company info:', error);
      throw new Error(`Kunde inte hämta företagsinformation: ${error.message}`);
    }
  }
  
  /**
   * Hämta alla kunder från Visma.net
   */
  async getCustomers(options = {}) {
    await this.ensureValidToken();
    
    const params = new URLSearchParams({
      pageNumber: options.page || 0,
      pageSize: options.pageSize || this.config.syncOptions.batchSize
    });
    
    if (options.lastModified) {
      params.append('lastModifiedDateTime', options.lastModified);
    }
    
    const url = `${this.config.baseUrl}/controller/api/v1/customer/${this.config.companyDatabaseId}?${params}`;
    
    try {
      const response = await this.makeRequest('GET', url);
      console.log(`📥 Retrieved ${response.length || 0} customers from Visma.net`);
      return response;
    } catch (error) {
      console.error('Failed to get customers:', error);
      throw new Error(`Kunde inte hämta kunder: ${error.message}`);
    }
  }
  
  /**
   * Skapa eller uppdatera kund i Visma.net
   */
  async upsertCustomer(customerData) {
    await this.ensureValidToken();
    
    try {
      // Mappa CRM-data till Visma.net-format
      const vismaCustomer = this.mapCrmToVismaCustomer(customerData);
      
      // Kontrollera om kund redan finns
      const existingCustomer = await this.findCustomerByNumber(customerData.customerNumber);
      
      if (existingCustomer) {
        // Uppdatera befintlig kund
        return await this.updateCustomer(existingCustomer.number, vismaCustomer);
      } else {
        // Skapa ny kund
        return await this.createCustomer(vismaCustomer);
      }
      
    } catch (error) {
      console.error('Failed to upsert customer:', error);
      throw error;
    }
  }
  
  /**
   * Hitta kund baserat på kundnummer
   */
  async findCustomerByNumber(customerNumber) {
    if (!customerNumber) return null;
    
    try {
      await this.ensureValidToken();
      
      const url = `${this.config.baseUrl}/controller/api/v1/customer/${this.config.companyDatabaseId}/${customerNumber}`;
      const response = await this.makeRequest('GET', url);
      
      return response;
    } catch (error) {
      if (error.statusCode === 404) {
        return null; // Kund finns inte
      }
      throw error;
    }
  }
  
  /**
   * Mappa CRM-kunddata till Visma.net-format
   */
  mapCrmToVismaCustomer(crmCustomer) {
    const mapping = this.config.fieldMapping.customer;
    const vismaCustomer = {};
    
    // Grundläggande mappning
    for (const [crmField, vismaField] of Object.entries(mapping)) {
      if (crmCustomer[crmField] !== undefined) {
        this.setNestedProperty(vismaCustomer, vismaField, crmCustomer[crmField]);
      }
    }
    
    // Specialhantering för svenska fält
    if (crmCustomer.namn) {
      vismaCustomer.name = crmCustomer.namn;
    }
    
    // Sätt standard currency och andra obligatoriska fält
    vismaCustomer.currencyId = vismaCustomer.currencyId || 'SEK';
    vismaCustomer.status = vismaCustomer.status || 'Active';
    
    return vismaCustomer;
  }
  
  /**
   * Hjälpfunktion för att sätta nested properties
   */
  setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }
  
  /**
   * Skapa ny kund i Visma.net
   */
  async createCustomer(customerData) {
    await this.ensureValidToken();
    
    const url = `${this.config.baseUrl}/controller/api/v1/customer/${this.config.companyDatabaseId}`;
    
    try {
      const response = await this.makeRequest('POST', url, customerData);
      console.log('✅ Created customer in Visma.net:', response.number);
      this.emit('customer:created', response);
      return response;
    } catch (error) {
      console.error('Failed to create customer:', error);
      throw new Error(`Kunde inte skapa kund: ${error.message}`);
    }
  }
  
  /**
   * Uppdatera befintlig kund i Visma.net
   */
  async updateCustomer(customerNumber, customerData) {
    await this.ensureValidToken();
    
    const url = `${this.config.baseUrl}/controller/api/v1/customer/${this.config.companyDatabaseId}/${customerNumber}`;
    
    try {
      const response = await this.makeRequest('PUT', url, customerData);
      console.log('✅ Updated customer in Visma.net:', customerNumber);
      this.emit('customer:updated', response);
      return response;
    } catch (error) {
      console.error('Failed to update customer:', error);
      throw new Error(`Kunde inte uppdatera kund: ${error.message}`);
    }
  }
  
  /**
   * Hämta alla artiklar/produkter från Visma.net
   */
  async getInventoryItems(options = {}) {
    await this.ensureValidToken();
    
    const params = new URLSearchParams({
      pageNumber: options.page || 0,
      pageSize: options.pageSize || this.config.syncOptions.batchSize
    });
    
    const url = `${this.config.baseUrl}/controller/api/v1/inventoryitem/${this.config.companyDatabaseId}?${params}`;
    
    try {
      const response = await this.makeRequest('GET', url);
      console.log(`📦 Retrieved ${response.length || 0} inventory items from Visma.net`);
      return response;
    } catch (error) {
      console.error('Failed to get inventory items:', error);
      throw new Error(`Kunde inte hämta artiklar: ${error.message}`);
    }
  }

  /**
   * Alias för getInventoryItems (för kompatibilitet)
   */
  async getProducts(options = {}) {
    return await this.getInventoryItems(options);
  }

  /**
   * Hämta specifik produkt/artikel från Visma.net
   */
  async getProduct(inventoryId) {
    await this.ensureValidToken();
    
    const url = `${this.config.baseUrl}/controller/api/v1/inventoryitem/${this.config.companyDatabaseId}/${inventoryId}`;
    
    try {
      const response = await this.makeRequest('GET', url);
      return response;
    } catch (error) {
      console.error(`Failed to get product ${inventoryId}:`, error);
      throw new Error(`Kunde inte hämta produkt: ${error.message}`);
    }
  }

  /**
   * Skapa ny produkt/artikel i Visma.net
   */
  async createProduct(productData) {
    await this.ensureValidToken();
    
    const url = `${this.config.baseUrl}/controller/api/v1/inventoryitem/${this.config.companyDatabaseId}`;
    
    try {
      // Validera och förbereda data
      const validatedData = this.validateProductData(productData);
      
      const response = await this.makeRequest('POST', url, validatedData);
      
      console.log(`✅ Created product in Visma.net: ${productData.description} (${response.inventoryID})`);
      this.emit('product:created', response);
      
      return response;
    } catch (error) {
      console.error('Failed to create product:', error);
      throw new Error(`Kunde inte skapa produkt: ${error.message}`);
    }
  }

  /**
   * Uppdatera befintlig produkt i Visma.net
   */
  async updateProduct(inventoryId, productData) {
    await this.ensureValidToken();
    
    const url = `${this.config.baseUrl}/controller/api/v1/inventoryitem/${this.config.companyDatabaseId}/${inventoryId}`;
    
    try {
      const validatedData = this.validateProductData(productData);
      
      const response = await this.makeRequest('PUT', url, validatedData);
      
      console.log(`✅ Updated product in Visma.net: ${inventoryId}`);
      this.emit('product:updated', response);
      
      return response;
    } catch (error) {
      console.error(`Failed to update product ${inventoryId}:`, error);
      throw new Error(`Kunde inte uppdatera produkt: ${error.message}`);
    }
  }

  /**
   * Uppdatera produktpris
   */
  async updateProductPrice(inventoryId, newPrice) {
    await this.ensureValidToken();
    
    try {
      // Hämta nuvarande produktdata
      const currentProduct = await this.getProduct(inventoryId);
      
      // Uppdatera endast prisfältet
      const updateData = {
        inventoryID: currentProduct.inventoryID,
        description: currentProduct.description,
        basePrice: newPrice,
        baseUnit: currentProduct.baseUnit,
        vatCategory: currentProduct.vatCategory,
        type: currentProduct.type,
        status: currentProduct.status
      };
      
      return await this.updateProduct(inventoryId, updateData);
    } catch (error) {
      console.error(`Failed to update product price ${inventoryId}:`, error);
      throw new Error(`Kunde inte uppdatera produktpris: ${error.message}`);
    }
  }

  /**
   * Ta bort produkt från Visma.net
   */
  async deleteProduct(inventoryId) {
    await this.ensureValidToken();
    
    const url = `${this.config.baseUrl}/controller/api/v1/inventoryitem/${this.config.companyDatabaseId}/${inventoryId}`;
    
    try {
      await this.makeRequest('DELETE', url);
      
      console.log(`✅ Deleted product from Visma.net: ${inventoryId}`);
      this.emit('product:deleted', { inventoryID: inventoryId });
      
      return true;
    } catch (error) {
      console.error(`Failed to delete product ${inventoryId}:`, error);
      throw new Error(`Kunde inte ta bort produkt: ${error.message}`);
    }
  }

  /**
   * Validera produktdata före API-anrop
   */
  validateProductData(productData) {
    const required = ['inventoryID', 'description'];
    const missing = required.filter(field => !productData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Sätt standardvärden
    return {
      inventoryID: productData.inventoryID,
      description: productData.description,
      basePrice: productData.basePrice || 0,
      baseUnit: productData.baseUnit || 'ST',
      vatCategory: productData.vatCategory || 'NORMAL',
      itemClass: productData.itemClass || 'SOFTWARE',
      type: productData.type || 'Service',
      status: productData.status || 'Active',
      
      // Kostnadsinformation
      costPrice: productData.costPrice || 0,
      markup: productData.markup || 0,
      
      // Ytterligare fält för svenska krav
      defaultWarehouse: productData.defaultWarehouse || 'MAIN',
      lastModifiedDateTime: productData.lastModifiedDateTime || new Date().toISOString()
    };
  }

  /**
   * Hämta produktkategorier från Visma.net
   */
  async getProductCategories() {
    await this.ensureValidToken();
    
    const url = `${this.config.baseUrl}/controller/api/v1/itemclass/${this.config.companyDatabaseId}`;
    
    try {
      const response = await this.makeRequest('GET', url);
      return response;
    } catch (error) {
      console.error('Failed to get product categories:', error);
      throw new Error(`Kunde inte hämta produktkategorier: ${error.message}`);
    }
  }

  /**
   * Hämta VAT-kategorier från Visma.net
   */
  async getVatCategories() {
    await this.ensureValidToken();
    
    const url = `${this.config.baseUrl}/controller/api/v1/vatcategory/${this.config.companyDatabaseId}`;
    
    try {
      const response = await this.makeRequest('GET', url);
      return response;
    } catch (error) {
      console.error('Failed to get VAT categories:', error);
      throw new Error(`Kunde inte hämta momskategorier: ${error.message}`);
    }
  }
  
  /**
   * Rensa tokens och autentisering
   */
  clearAuth() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    console.log('🔐 Cleared Visma.net authentication');
  }
  
  /**
   * Hämta aktuell autentiseringsstatus
   */
  getAuthStatus() {
    return {
      isAuthenticated: !!this.accessToken,
      tokenExpiry: this.tokenExpiry,
      timeUntilExpiry: this.tokenExpiry ? Math.max(0, this.tokenExpiry - Date.now()) : 0,
      hasRefreshToken: !!this.refreshToken
    };
  }
}

module.exports = VismaNetService;