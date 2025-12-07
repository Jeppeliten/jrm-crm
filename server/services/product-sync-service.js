/**
 * Product Synchronization Service
 * 
 * Hanterar synkronisering av produkter/artiklar mellan CRM och Visma.net
 * Inkluderar prissättning, momskategorier och lagerhantering
 */

const fs = require('fs').promises;
const path = require('path');
const { VISMA_CONFIG, MappingHelpers } = require('../config/visma-config');

class ProductSyncService {
  constructor(vismaService) {
    this.vismaService = vismaService;
    this.stateFile = path.join(__dirname, '..', 'product-sync-state.json');
    this.priceListFile = path.join(__dirname, '..', 'price-list.json');
    
    // Ladda synkroniseringstillstånd
    this.loadSyncState();
    this.loadPriceList();
  }

  /**
   * Ladda produktsynkroniseringstillstånd
   */
  async loadSyncState() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      this.syncState = JSON.parse(data);
    } catch (error) {
      this.syncState = {
        lastSync: null,
        syncStats: {
          productsFromCRM: 0,
          productsFromVisma: 0,
          priceUpdates: 0,
          errors: 0
        },
        mappings: {}, // CRM product ID -> Visma.net inventory ID
        conflicts: []
      };
    }
  }

  /**
   * Ladda prislista och produktkatalog
   */
  async loadPriceList() {
    try {
      const data = await fs.readFile(this.priceListFile, 'utf8');
      this.priceList = JSON.parse(data);
    } catch (error) {
      // Skapa standard prislista baserad på mäklarpaket
      this.priceList = this.createDefaultPriceList();
      await this.savePriceList();
    }
  }

  /**
   * Skapa standard prislista för mäklarpaket
   */
  createDefaultPriceList() {
    return {
      lastUpdated: new Date().toISOString(),
      currency: 'SEK',
      vatRate: 0.25, // 25% svensk moms
      products: [
        {
          id: 'maklarpaket_4_6',
          name: 'Mäklarpaket 4-6 medarbetare',
          description: 'CRM-licenser för mäklarföretag med 4-6 medarbetare',
          category: 'Software License',
          basePrice: 849,
          vatCategory: 'NORMAL',
          unit: 'ST',
          type: 'Service',
          active: true,
          vismaInventoryId: null
        },
        {
          id: 'maklarpaket_7_9',
          name: 'Mäklarpaket 7-9 medarbetare',
          description: 'CRM-licenser för mäklarföretag med 7-9 medarbetare',
          category: 'Software License',
          basePrice: 1099,
          vatCategory: 'NORMAL',
          unit: 'ST',
          type: 'Service',
          active: true,
          vismaInventoryId: null
        },
        {
          id: 'maklarpaket_10_15',
          name: 'Mäklarpaket 10-15 medarbetare',
          description: 'CRM-licenser för mäklarföretag med 10-15 medarbetare',
          category: 'Software License',
          basePrice: 1399,
          vatCategory: 'NORMAL',
          unit: 'ST',
          type: 'Service',
          active: true,
          vismaInventoryId: null
        },
        {
          id: 'setup_fee',
          name: 'Installationsavgift',
          description: 'Engångsavgift för installation och konfiguration',
          category: 'Setup Service',
          basePrice: 2500,
          vatCategory: 'NORMAL',
          unit: 'ST',
          type: 'Service',
          active: true,
          vismaInventoryId: null
        },
        {
          id: 'support_premium',
          name: 'Premium Support',
          description: 'Utökad support och underhåll per månad',
          category: 'Support Service',
          basePrice: 299,
          vatCategory: 'NORMAL',
          unit: 'ST',
          type: 'Service',
          active: true,
          vismaInventoryId: null
        }
      ]
    };
  }

  /**
   * Spara prislista
   */
  async savePriceList() {
    try {
      await fs.writeFile(this.priceListFile, JSON.stringify(this.priceList, null, 2));
    } catch (error) {
      console.error('❌ Failed to save price list:', error.message);
    }
  }

  /**
   * Spara synkroniseringstillstånd
   */
  async saveSyncState() {
    try {
      await fs.writeFile(this.stateFile, JSON.stringify(this.syncState, null, 2));
    } catch (error) {
      console.error('❌ Failed to save product sync state:', error.message);
    }
  }

  /**
   * Huvudfunktion för produktsynkronisering
   */
  async syncProducts(options = {}) {
    const startTime = Date.now();
    console.log('🔄 Starting product synchronization...');

    try {
      if (!this.vismaService.isAuthenticated()) {
        throw new Error('Not authenticated with Visma.net');
      }

      const result = {
        started: new Date().toISOString(),
        direction: options.direction || 'bidirectional',
        crmToVisma: { created: 0, updated: 0, errors: 0 },
        vismaToCrm: { created: 0, updated: 0, errors: 0 },
        priceUpdates: 0,
        conflicts: [],
        duration: 0
      };

      // Hämta produkter från båda systemen
      const [crmProducts, vismaProducts] = await Promise.all([
        this.getCrmProducts(),
        this.getVismaProducts()
      ]);

      console.log(`📊 Found ${crmProducts.length} CRM products, ${vismaProducts.length} Visma.net products`);

      // Synkronisera CRM -> Visma.net
      if (options.direction !== 'visma-to-crm') {
        const crmResult = await this.syncCrmToVisma(crmProducts, vismaProducts);
        result.crmToVisma = crmResult;
      }

      // Synkronisera Visma.net -> CRM
      if (options.direction !== 'crm-to-visma') {
        const vismaResult = await this.syncVismaToCrm(vismaProducts, crmProducts);
        result.vismaToCrm = vismaResult;
      }

      // Synkronisera priser separat
      if (options.syncPrices !== false) {
        result.priceUpdates = await this.syncPrices();
      }

      result.duration = Date.now() - startTime;
      this.updateSyncStats(result);

      console.log('✅ Product synchronization completed');
      console.log(`⏱️  Duration: ${result.duration}ms`);
      console.log(`📈 CRM->Visma: ${result.crmToVisma.created} created, ${result.crmToVisma.updated} updated`);
      console.log(`📉 Visma->CRM: ${result.vismaToCrm.created} created, ${result.vismaToCrm.updated} updated`);
      console.log(`💰 Price updates: ${result.priceUpdates}`);

      return result;

    } catch (error) {
      console.error('❌ Product synchronization failed:', error.message);
      throw error;
    }
  }

  /**
   * Synkronisera från CRM till Visma.net
   */
  async syncCrmToVisma(crmProducts, vismaProducts) {
    const result = { created: 0, updated: 0, errors: 0 };
    
    // Skapa map av Visma-produkter för snabb lookup
    const vismaMap = new Map();
    vismaProducts.forEach(product => {
      vismaMap.set(product.inventoryID, product);
      if (product.description) {
        vismaMap.set(product.description.toLowerCase(), product);
      }
    });

    for (const crmProduct of crmProducts) {
      try {
        // Kontrollera om produkten redan finns mappning
        let existingVismaProduct = null;
        
        if (this.syncState.mappings[crmProduct.id]) {
          const vismaId = this.syncState.mappings[crmProduct.id];
          existingVismaProduct = vismaMap.get(vismaId);
        }
        
        // Om ingen mappning finns, försök hitta baserat på namn
        if (!existingVismaProduct) {
          existingVismaProduct = vismaMap.get(crmProduct.name.toLowerCase());
        }

        if (existingVismaProduct) {
          // Uppdatera befintlig produkt om nödvändigt
          if (this.shouldUpdateVismaProduct(crmProduct, existingVismaProduct)) {
            await this.updateVismaProduct(crmProduct, existingVismaProduct);
            result.updated++;
            
            // Uppdatera mappning
            this.syncState.mappings[crmProduct.id] = existingVismaProduct.inventoryID;
          }
        } else {
          // Skapa ny produkt i Visma.net
          const newProduct = await this.createVismaProduct(crmProduct);
          if (newProduct) {
            result.created++;
            
            // Spara mappning
            this.syncState.mappings[crmProduct.id] = newProduct.inventoryID;
            
            console.log(`✅ Created product in Visma.net: ${crmProduct.name} (${newProduct.inventoryID})`);
          }
        }

      } catch (error) {
        console.error(`❌ Failed to sync product ${crmProduct.name}:`, error.message);
        result.errors++;
        await this.logSyncError('crm-to-visma', crmProduct, error);
      }
    }

    return result;
  }

  /**
   * Synkronisera från Visma.net till CRM
   */
  async syncVismaToCrm(vismaProducts, crmProducts) {
    const result = { created: 0, updated: 0, errors: 0 };
    
    // Skapa map av CRM-produkter
    const crmMap = new Map();
    crmProducts.forEach(product => {
      crmMap.set(product.name.toLowerCase(), product);
      if (product.id) {
        crmMap.set(product.id, product);
      }
    });

    for (const vismaProduct of vismaProducts) {
      try {
        // Hitta matchande CRM-produkt
        const existingCrmProduct = this.findMatchingCrmProduct(vismaProduct, crmMap);
        
        if (existingCrmProduct) {
          // Uppdatera befintlig produkt
          if (this.shouldUpdateCrmProduct(vismaProduct, existingCrmProduct)) {
            await this.updateCrmProduct(vismaProduct, existingCrmProduct);
            result.updated++;
          }
        } else {
          // Skapa ny produkt i CRM (endast om konfigurerat)
          if (VISMA_CONFIG.syncOptions.createNewProductsInCrm) {
            const newProduct = await this.createCrmProduct(vismaProduct);
            if (newProduct) {
              result.created++;
              console.log(`✅ Created product in CRM: ${vismaProduct.description}`);
            }
          }
        }

      } catch (error) {
        console.error(`❌ Failed to sync product ${vismaProduct.description}:`, error.message);
        result.errors++;
        await this.logSyncError('visma-to-crm', vismaProduct, error);
      }
    }

    return result;
  }

  /**
   * Synkronisera priser mellan systemen
   */
  async syncPrices() {
    let priceUpdates = 0;

    try {
      // Uppdatera priser i Visma.net baserat på prislista
      for (const product of this.priceList.products) {
        if (product.vismaInventoryId && product.active) {
          try {
            const vismaProduct = await this.vismaService.getProduct(product.vismaInventoryId);
            
            if (vismaProduct && vismaProduct.basePrice !== product.basePrice) {
              await this.vismaService.updateProductPrice(
                product.vismaInventoryId, 
                product.basePrice
              );
              priceUpdates++;
              
              console.log(`💰 Updated price for ${product.name}: ${product.basePrice} SEK`);
            }
          } catch (error) {
            console.error(`❌ Failed to update price for ${product.name}:`, error.message);
          }
        }
      }

    } catch (error) {
      console.error('❌ Price synchronization failed:', error.message);
    }

    return priceUpdates;
  }

  /**
   * Kontrollera om Visma.net-produkt behöver uppdateras
   */
  shouldUpdateVismaProduct(crmProduct, vismaProduct) {
    return (
      crmProduct.name !== vismaProduct.description ||
      crmProduct.basePrice !== vismaProduct.basePrice ||
      crmProduct.unit !== vismaProduct.baseUnit ||
      crmProduct.active !== (vismaProduct.status === 'Active')
    );
  }

  /**
   * Kontrollera om CRM-produkt behöver uppdateras
   */
  shouldUpdateCrmProduct(vismaProduct, crmProduct) {
    const vismaModified = new Date(vismaProduct.lastModifiedDateTime || 0);
    const crmModified = new Date(crmProduct.lastModified || 0);
    
    return vismaModified > crmModified;
  }

  /**
   * Skapa ny produkt i Visma.net
   */
  async createVismaProduct(crmProduct) {
    const vismaProductData = this.mapCrmToVismaProduct(crmProduct);
    
    // Validera produktdata
    const validation = this.validateVismaProductData(vismaProductData);
    if (!validation.valid) {
      throw new Error(`Invalid product data: ${validation.errors.join(', ')}`);
    }

    return await this.vismaService.createProduct(vismaProductData);
  }

  /**
   * Uppdatera befintlig produkt i Visma.net
   */
  async updateVismaProduct(crmProduct, existingVismaProduct) {
    const updates = this.mapCrmToVismaProduct(crmProduct);
    
    // Behåll vissa Visma.net-specifika fält
    updates.inventoryID = existingVismaProduct.inventoryID;
    updates.lastModifiedDateTime = existingVismaProduct.lastModifiedDateTime;
    
    return await this.vismaService.updateProduct(existingVismaProduct.inventoryID, updates);
  }

  /**
   * Hitta matchande CRM-produkt
   */
  findMatchingCrmProduct(vismaProduct, crmMap) {
    // Först: försök matcha på beskrivning/namn
    if (vismaProduct.description) {
      const match = crmMap.get(vismaProduct.description.toLowerCase());
      if (match) return match;
    }

    // Sedan: kolla befintlig mappning (omvänd lookup)
    for (const [crmId, vismaId] of Object.entries(this.syncState.mappings)) {
      if (vismaId === vismaProduct.inventoryID) {
        return crmMap.get(crmId);
      }
    }

    return null;
  }

  /**
   * Mappa CRM-produkt till Visma.net-format
   */
  mapCrmToVismaProduct(crmProduct) {
    const defaults = VISMA_CONFIG.defaults.product;
    
    return {
      inventoryID: this.generateInventoryId(crmProduct),
      description: crmProduct.name,
      basePrice: crmProduct.basePrice || 0,
      baseUnit: crmProduct.unit || defaults.baseUnit,
      vatCategory: this.mapVatCategory(crmProduct.vatCategory) || defaults.vatCategory,
      itemClass: crmProduct.category || 'SOFTWARE',
      type: crmProduct.type || defaults.type,
      status: crmProduct.active ? 'Active' : 'Inactive',
      
      // Svenska specifika fält
      costPrice: crmProduct.costPrice || 0,
      markup: crmProduct.markup || 0,
      
      // Metadata
      createdDateTime: crmProduct.createdDate || new Date().toISOString()
    };
  }

  /**
   * Mappa Visma.net-produkt till CRM-format
   */
  mapVismaToCrmProduct(vismaProduct) {
    return {
      name: vismaProduct.description,
      basePrice: vismaProduct.basePrice || 0,
      unit: vismaProduct.baseUnit || 'ST',
      vatCategory: vismaProduct.vatCategory || 'NORMAL',
      category: vismaProduct.itemClass || 'Other',
      type: vismaProduct.type || 'Service',
      active: vismaProduct.status === 'Active',
      costPrice: vismaProduct.costPrice || 0,
      markup: vismaProduct.markup || 0,
      
      // Metadata
      createdDate: vismaProduct.createdDateTime,
      lastModified: vismaProduct.lastModifiedDateTime,
      vismaInventoryId: vismaProduct.inventoryID
    };
  }

  /**
   * Generera Inventory ID för Visma.net
   */
  generateInventoryId(crmProduct) {
    // Skapa kort, läsbar ID baserat på produktnamn
    let id = crmProduct.name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toUpperCase()
      .substring(0, 20);
    
    // Lägg till suffix om det finns duplikater
    const existingIds = Object.values(this.syncState.mappings);
    let counter = 1;
    let finalId = id;
    
    while (existingIds.includes(finalId)) {
      finalId = `${id}_${counter}`;
      counter++;
    }
    
    return finalId;
  }

  /**
   * Mappa momskategori
   */
  mapVatCategory(vatCategory) {
    const mapping = {
      '25': 'NORMAL',    // 25% svensk standardmoms
      '12': 'REDUCED_12', // 12% reducerad moms
      '6': 'REDUCED_6',   // 6% reducerad moms
      '0': 'ZERO',        // 0% moms
      'exempt': 'EXEMPT'  // Momsbefriad
    };
    
    return mapping[vatCategory] || 'NORMAL';
  }

  /**
   * Validera Visma.net-produktdata
   */
  validateVismaProductData(productData) {
    const errors = [];

    if (!productData.inventoryID) {
      errors.push('Missing inventory ID');
    }
    
    if (!productData.description) {
      errors.push('Missing product description');
    }
    
    if (productData.basePrice < 0) {
      errors.push('Base price cannot be negative');
    }

    if (!['Service', 'StockItem'].includes(productData.type)) {
      errors.push('Invalid product type');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Hämta produkter från CRM (prislista)
   */
  async getCrmProducts() {
    return this.priceList.products.filter(p => p.active);
  }

  /**
   * Hämta produkter från Visma.net
   */
  async getVismaProducts() {
    try {
      return await this.vismaService.getProducts();
    } catch (error) {
      console.error('Failed to load Visma.net products:', error.message);
      return [];
    }
  }

  /**
   * Skapa ny produkt i CRM (uppdatera prislista)
   */
  async createCrmProduct(vismaProduct) {
    const crmProduct = this.mapVismaToCrmProduct(vismaProduct);
    crmProduct.id = `visma_${vismaProduct.inventoryID}`;
    
    this.priceList.products.push(crmProduct);
    await this.savePriceList();
    
    return crmProduct;
  }

  /**
   * Uppdatera befintlig produkt i CRM
   */
  async updateCrmProduct(vismaProduct, existingCrmProduct) {
    const updates = this.mapVismaToCrmProduct(vismaProduct);
    
    // Hitta och uppdatera produkten i prislistan
    const productIndex = this.priceList.products.findIndex(p => p.id === existingCrmProduct.id);
    if (productIndex !== -1) {
      this.priceList.products[productIndex] = { ...existingCrmProduct, ...updates };
      await this.savePriceList();
    }
    
    return this.priceList.products[productIndex];
  }

  /**
   * Logga synkroniseringsfel
   */
  async logSyncError(direction, product, error) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      direction,
      product: {
        id: product.id || product.inventoryID,
        name: product.name || product.description
      },
      error: error.message
    };

    this.syncState.conflicts.push(logEntry);
    await this.saveSyncState();
  }

  /**
   * Uppdatera synkroniseringsstatistik
   */
  updateSyncStats(result) {
    this.syncState.lastSync = result.started;
    this.syncState.syncStats.productsFromCRM += result.crmToVisma.created + result.crmToVisma.updated;
    this.syncState.syncStats.productsFromVisma += result.vismaToCrm.created + result.vismaToCrm.updated;
    this.syncState.syncStats.priceUpdates += result.priceUpdates;
    this.syncState.syncStats.errors += result.crmToVisma.errors + result.vismaToCrm.errors;

    this.saveSyncState();
  }

  /**
   * Hämta produktsynkroniseringsstatus
   */
  getSyncStatus() {
    return {
      ...this.syncState,
      priceListProducts: this.priceList.products.length,
      lastPriceUpdate: this.priceList.lastUpdated
    };
  }

  /**
   * Uppdatera prislista
   */
  async updatePriceList(updates) {
    this.priceList = { ...this.priceList, ...updates };
    this.priceList.lastUpdated = new Date().toISOString();
    await this.savePriceList();
    
    return this.priceList;
  }

  /**
   * Lägg till ny produkt till prislista
   */
  async addProduct(productData) {
    const newProduct = {
      id: productData.id || `product_${Date.now()}`,
      ...productData,
      active: true,
      vismaInventoryId: null
    };
    
    this.priceList.products.push(newProduct);
    this.priceList.lastUpdated = new Date().toISOString();
    await this.savePriceList();
    
    return newProduct;
  }

  /**
   * Ta bort produkt från prislista
   */
  async removeProduct(productId) {
    const productIndex = this.priceList.products.findIndex(p => p.id === productId);
    if (productIndex !== -1) {
      this.priceList.products.splice(productIndex, 1);
      this.priceList.lastUpdated = new Date().toISOString();
      await this.savePriceList();
      
      // Ta bort mappning
      delete this.syncState.mappings[productId];
      await this.saveSyncState();
      
      return true;
    }
    
    return false;
  }

  /**
   * Rensa synkroniseringsdata
   */
  async clearSyncState() {
    this.syncState = {
      lastSync: null,
      syncStats: {
        productsFromCRM: 0,
        productsFromVisma: 0,
        priceUpdates: 0,
        errors: 0
      },
      mappings: {},
      conflicts: []
    };

    await this.saveSyncState();
  }
}

module.exports = ProductSyncService;