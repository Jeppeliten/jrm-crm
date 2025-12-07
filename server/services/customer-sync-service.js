/**
 * Customer Synchronization Service
 * 
 * Hanterar synkronisering av kunder mellan CRM och Visma.net
 * Inkluderar bidirektionell synk, konflikthantering och validering
 */

const fs = require('fs').promises;
const path = require('path');
const { VISMA_CONFIG, MappingHelpers } = require('../config/visma-config');

class CustomerSyncService {
  constructor(vismaService) {
    this.vismaService = vismaService;
    this.stateFile = path.join(__dirname, '..', 'sync-state.json');
    this.conflictLog = path.join(__dirname, '..', 'sync-conflicts.log');
    
    // Ladda synkroniseringstillstånd
    this.loadSyncState();
  }

  /**
   * Ladda synkroniseringstillstånd från fil
   */
  async loadSyncState() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      this.syncState = JSON.parse(data);
    } catch (error) {
      // Skapa nytt tillstånd om filen inte finns
      this.syncState = {
        lastSync: null,
        syncStats: {
          customersFromCRM: 0,
          customersFromVisma: 0,
          conflicts: 0,
          errors: 0
        },
        conflicts: [],
        mappings: {} // CRM ID -> Visma.net customer number
      };
    }
  }

  /**
   * Spara synkroniseringstillstånd
   */
  async saveSyncState() {
    try {
      await fs.writeFile(this.stateFile, JSON.stringify(this.syncState, null, 2));
    } catch (error) {
      console.error('❌ Failed to save sync state:', error.message);
    }
  }

  /**
   * Huvudfunktion för kundsynkronisering
   */
  async syncCustomers(options = {}) {
    const startTime = Date.now();
    console.log('🔄 Starting customer synchronization...');

    try {
      // Kontrollera Visma.net-anslutning
      if (!this.vismaService.isAuthenticated()) {
        throw new Error('Not authenticated with Visma.net');
      }

      const result = {
        started: new Date().toISOString(),
        direction: options.direction || 'bidirectional',
        crmToVisma: { created: 0, updated: 0, errors: 0 },
        vismaToCrm: { created: 0, updated: 0, errors: 0 },
        conflicts: [],
        duration: 0
      };

      // Hämta data från båda systemen
      const [crmCustomers, vismaCustomers] = await Promise.all([
        this.getCrmCustomers(),
        this.getVismaCustomers()
      ]);

      console.log(`📊 Found ${crmCustomers.length} CRM customers, ${vismaCustomers.length} Visma.net customers`);

      // Synkronisera CRM -> Visma.net
      if (options.direction !== 'visma-to-crm') {
        const crmResult = await this.syncCrmToVisma(crmCustomers, vismaCustomers);
        result.crmToVisma = crmResult;
      }

      // Synkronisera Visma.net -> CRM
      if (options.direction !== 'crm-to-visma') {
        const vismaResult = await this.syncVismaToCrm(vismaCustomers, crmCustomers);
        result.vismaToCrm = vismaResult;
      }

      // Uppdatera statistik
      result.duration = Date.now() - startTime;
      this.updateSyncStats(result);

      console.log('✅ Customer synchronization completed');
      console.log(`⏱️  Duration: ${result.duration}ms`);
      console.log(`📈 CRM->Visma: ${result.crmToVisma.created} created, ${result.crmToVisma.updated} updated`);
      console.log(`📉 Visma->CRM: ${result.vismaToCrm.created} created, ${result.vismaToCrm.updated} updated`);

      return result;

    } catch (error) {
      console.error('❌ Customer synchronization failed:', error.message);
      throw error;
    }
  }

  /**
   * Synkronisera från CRM till Visma.net
   */
  async syncCrmToVisma(crmCustomers, vismaCustomers) {
    const result = { created: 0, updated: 0, errors: 0 };
    
    // Skapa map av Visma-kunder för snabb lookup
    const vismaMap = new Map();
    vismaCustomers.forEach(customer => {
      // Mappa på org.nummer eller email
      if (customer.corporateID) {
        vismaMap.set(customer.corporateID, customer);
      }
      if (customer.mainContact?.email) {
        vismaMap.set(customer.mainContact.email.toLowerCase(), customer);
      }
    });

    for (const crmCustomer of crmCustomers) {
      try {
        // Försök hitta matchande kund i Visma.net
        const existingVismaCustomer = this.findMatchingVismaCustomer(crmCustomer, vismaMap);
        
        if (existingVismaCustomer) {
          // Uppdatera befintlig kund om nödvändigt
          if (this.shouldUpdateVismaCustomer(crmCustomer, existingVismaCustomer)) {
            await this.updateVismaCustomer(crmCustomer, existingVismaCustomer);
            result.updated++;
            
            // Spara mappning
            this.syncState.mappings[crmCustomer.id] = existingVismaCustomer.number;
          }
        } else {
          // Skapa ny kund i Visma.net
          const newCustomer = await this.createVismaCustomer(crmCustomer);
          if (newCustomer) {
            result.created++;
            
            // Spara mappning
            this.syncState.mappings[crmCustomer.id] = newCustomer.number;
            
            console.log(`✅ Created customer in Visma.net: ${crmCustomer.namn} (${newCustomer.number})`);
          }
        }

      } catch (error) {
        console.error(`❌ Failed to sync customer ${crmCustomer.namn}:`, error.message);
        result.errors++;
        
        // Logga felet för senare granskning
        await this.logSyncError('crm-to-visma', crmCustomer, error);
      }
    }

    return result;
  }

  /**
   * Synkronisera från Visma.net till CRM
   */
  async syncVismaToCrm(vismaCustomers, crmCustomers) {
    const result = { created: 0, updated: 0, errors: 0 };
    
    // Skapa map av CRM-kunder för snabb lookup
    const crmMap = new Map();
    crmCustomers.forEach(customer => {
      if (customer.orgNumber) {
        crmMap.set(customer.orgNumber, customer);
      }
      if (customer.email) {
        crmMap.set(customer.email.toLowerCase(), customer);
      }
    });

    for (const vismaCustomer of vismaCustomers) {
      try {
        // Försök hitta matchande kund i CRM
        const existingCrmCustomer = this.findMatchingCrmCustomer(vismaCustomer, crmMap);
        
        if (existingCrmCustomer) {
          // Uppdatera befintlig kund om nödvändigt
          if (this.shouldUpdateCrmCustomer(vismaCustomer, existingCrmCustomer)) {
            await this.updateCrmCustomer(vismaCustomer, existingCrmCustomer);
            result.updated++;
          }
        } else {
          // Skapa ny kund i CRM (endast om konfigurerat)
          if (VISMA_CONFIG.syncOptions.createNewCustomersInCrm) {
            const newCustomer = await this.createCrmCustomer(vismaCustomer);
            if (newCustomer) {
              result.created++;
              console.log(`✅ Created customer in CRM: ${vismaCustomer.name}`);
            }
          }
        }

      } catch (error) {
        console.error(`❌ Failed to sync customer ${vismaCustomer.name}:`, error.message);
        result.errors++;
        
        await this.logSyncError('visma-to-crm', vismaCustomer, error);
      }
    }

    return result;
  }

  /**
   * Hitta matchande Visma.net-kund
   */
  findMatchingVismaCustomer(crmCustomer, vismaMap) {
    // Först: försök matcha på organisationsnummer
    if (crmCustomer.orgNumber) {
      const formatted = MappingHelpers.formatOrgNumber(crmCustomer.orgNumber);
      const match = vismaMap.get(formatted);
      if (match) return match;
    }

    // Sedan: försök matcha på email
    if (crmCustomer.email) {
      const match = vismaMap.get(crmCustomer.email.toLowerCase());
      if (match) return match;
    }

    // Kolla befintlig mappning
    if (this.syncState.mappings[crmCustomer.id]) {
      // Hitta kund med detta customer number
      for (const [key, customer] of vismaMap) {
        if (customer.number === this.syncState.mappings[crmCustomer.id]) {
          return customer;
        }
      }
    }

    return null;
  }

  /**
   * Hitta matchande CRM-kund
   */
  findMatchingCrmCustomer(vismaCustomer, crmMap) {
    // Matcha på organisationsnummer
    if (vismaCustomer.corporateID) {
      const match = crmMap.get(vismaCustomer.corporateID);
      if (match) return match;
    }

    // Matcha på email
    if (vismaCustomer.mainContact?.email) {
      const match = crmMap.get(vismaCustomer.mainContact.email.toLowerCase());
      if (match) return match;
    }

    return null;
  }

  /**
   * Kontrollera om Visma.net-kund behöver uppdateras
   */
  shouldUpdateVismaCustomer(crmCustomer, vismaCustomer) {
    // Jämför viktiga fält och se om uppdatering behövs
    const crmModified = new Date(crmCustomer.lastModified || 0);
    const vismaModified = new Date(vismaCustomer.lastModifiedDateTime || 0);
    
    // Om CRM-data är nyare, uppdatera Visma.net
    if (crmModified > vismaModified) {
      return true;
    }

    // Kontrollera specifika fält som kan ha ändrats
    return (
      crmCustomer.namn !== vismaCustomer.name ||
      crmCustomer.email !== vismaCustomer.mainContact?.email ||
      crmCustomer.telefon !== vismaCustomer.mainContact?.phone ||
      crmCustomer.adress !== vismaCustomer.mainAddress?.addressLine1
    );
  }

  /**
   * Kontrollera om CRM-kund behöver uppdateras
   */
  shouldUpdateCrmCustomer(vismaCustomer, crmCustomer) {
    const vismaModified = new Date(vismaCustomer.lastModifiedDateTime || 0);
    const crmModified = new Date(crmCustomer.lastModified || 0);
    
    // Om Visma.net-data är nyare, uppdatera CRM
    if (vismaModified > crmModified) {
      return true;
    }

    return false;
  }

  /**
   * Skapa ny kund i Visma.net
   */
  async createVismaCustomer(crmCustomer) {
    const vismaCustomerData = this.mapCrmToVismaCustomer(crmCustomer);
    
    // Validera data innan skapande
    const validation = this.validateVismaCustomerData(vismaCustomerData);
    if (!validation.valid) {
      throw new Error(`Invalid customer data: ${validation.errors.join(', ')}`);
    }

    return await this.vismaService.createCustomer(vismaCustomerData);
  }

  /**
   * Uppdatera befintlig kund i Visma.net
   */
  async updateVismaCustomer(crmCustomer, existingVismaCustomer) {
    const updates = this.mapCrmToVismaCustomer(crmCustomer);
    
    // Behåll vissa Visma.net-specifika fält
    updates.number = existingVismaCustomer.number;
    updates.lastModifiedDateTime = existingVismaCustomer.lastModifiedDateTime;
    
    return await this.vismaService.updateCustomer(existingVismaCustomer.number, updates);
  }

  /**
   * Skapa ny kund i CRM baserat på Visma.net-data
   */
  async createCrmCustomer(vismaCustomer) {
    const crmCustomerData = this.mapVismaToCrmCustomer(vismaCustomer);
    
    // Implementera CRM API-anrop här
    // För nu returnerar vi bara mappade data
    return crmCustomerData;
  }

  /**
   * Uppdatera befintlig kund i CRM
   */
  async updateCrmCustomer(vismaCustomer, existingCrmCustomer) {
    const updates = this.mapVismaToCrmCustomer(vismaCustomer);
    
    // Implementera CRM API-anrop här
    // För nu returnerar vi bara mappade data
    return { ...existingCrmCustomer, ...updates };
  }

  /**
   * Mappa CRM-kund till Visma.net-format
   */
  mapCrmToVismaCustomer(crmCustomer) {
    const mapping = VISMA_CONFIG.fieldMapping.customer;
    const defaults = VISMA_CONFIG.defaults.customer;
    
    const vismaCustomer = { ...defaults };

    // Grundläggande mappning
    if (crmCustomer.customerNumber) vismaCustomer.number = crmCustomer.customerNumber;
    if (crmCustomer.namn) vismaCustomer.name = crmCustomer.namn;
    
    // Organisationsnummer och VAT
    if (crmCustomer.orgNumber) {
      vismaCustomer.corporateID = MappingHelpers.formatOrgNumber(crmCustomer.orgNumber);
      if (!crmCustomer.vatId) {
        vismaCustomer.vatRegistrationID = MappingHelpers.generateVatId(crmCustomer.orgNumber);
      }
    }

    // Kontaktinformation
    vismaCustomer.mainContact = {
      email: crmCustomer.email || '',
      phone: crmCustomer.telefon || ''
    };

    // Adressinformation
    vismaCustomer.mainAddress = {
      addressLine1: crmCustomer.adress || '',
      addressLine2: crmCustomer.adress2 || '',
      postalCode: crmCustomer.postnummer || '',
      city: crmCustomer.stad || '',
      country: crmCustomer.land || defaults.country
    };

    // Ekonomisk information
    if (crmCustomer.payment) {
      vismaCustomer.creditLimit = parseFloat(crmCustomer.payment) || 0;
    }
    
    if (crmCustomer.paymentTerms) {
      vismaCustomer.terms = MappingHelpers.mapPaymentTerms(crmCustomer.paymentTerms);
    }

    // Metadata
    vismaCustomer.createdDateTime = crmCustomer.createdDate || new Date().toISOString();

    return vismaCustomer;
  }

  /**
   * Mappa Visma.net-kund till CRM-format
   */
  mapVismaToCrmCustomer(vismaCustomer) {
    return {
      customerNumber: vismaCustomer.number,
      namn: vismaCustomer.name,
      orgNumber: vismaCustomer.corporateID,
      vatId: vismaCustomer.vatRegistrationID,
      email: vismaCustomer.mainContact?.email || '',
      telefon: vismaCustomer.mainContact?.phone || '',
      website: vismaCustomer.webSite || '',
      adress: vismaCustomer.mainAddress?.addressLine1 || '',
      adress2: vismaCustomer.mainAddress?.addressLine2 || '',
      postnummer: vismaCustomer.mainAddress?.postalCode || '',
      stad: vismaCustomer.mainAddress?.city || '',
      land: vismaCustomer.mainAddress?.country || 'SE',
      payment: vismaCustomer.creditLimit || 0,
      paymentTerms: vismaCustomer.terms || '30D',
      createdDate: vismaCustomer.createdDateTime,
      lastModified: vismaCustomer.lastModifiedDateTime,
      vismaCustomerNumber: vismaCustomer.number // Behåll referens
    };
  }

  /**
   * Validera Visma.net-kunddata
   */
  validateVismaCustomerData(customerData) {
    const errors = [];
    const validation = VISMA_CONFIG.validation.customer;

    // Kontrollera obligatoriska fält
    validation.required.forEach(field => {
      if (!customerData[field] && !customerData.mainContact?.[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Validera email-format
    if (customerData.mainContact?.email) {
      if (!validation.emailFormat.test(customerData.mainContact.email)) {
        errors.push('Invalid email format');
      }
    }

    // Validera organisationsnummer
    if (customerData.corporateID) {
      if (!validation.orgNumberFormat.test(customerData.corporateID)) {
        errors.push('Invalid organization number format');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Hämta kunder från CRM
   */
  async getCrmCustomers() {
    // Implementera baserat på CRM:s datastruktur
    // För nu läser vi från state.json
    try {
      const statePath = path.join(__dirname, '..', 'state.json');
      const stateData = await fs.readFile(statePath, 'utf8');
      const state = JSON.parse(stateData);
      
      return state.customers || [];
    } catch (error) {
      console.error('Failed to load CRM customers:', error.message);
      return [];
    }
  }

  /**
   * Hämta kunder från Visma.net
   */
  async getVismaCustomers() {
    try {
      return await this.vismaService.getCustomers();
    } catch (error) {
      console.error('Failed to load Visma.net customers:', error.message);
      return [];
    }
  }

  /**
   * Logga synkroniseringsfel
   */
  async logSyncError(direction, customer, error) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      direction,
      customer: {
        id: customer.id || customer.number,
        name: customer.namn || customer.name
      },
      error: error.message,
      stack: error.stack
    };

    try {
      await fs.appendFile(this.conflictLog, JSON.stringify(logEntry) + '\n');
    } catch (logError) {
      console.error('Failed to write to conflict log:', logError.message);
    }
  }

  /**
   * Uppdatera synkroniseringsstatistik
   */
  updateSyncStats(result) {
    this.syncState.lastSync = result.started;
    this.syncState.syncStats.customersFromCRM += result.crmToVisma.created + result.crmToVisma.updated;
    this.syncState.syncStats.customersFromVisma += result.vismaToCrm.created + result.vismaToCrm.updated;
    this.syncState.syncStats.errors += result.crmToVisma.errors + result.vismaToCrm.errors;
    this.syncState.syncStats.conflicts += result.conflicts.length;

    this.saveSyncState();
  }

  /**
   * Hämta synkroniseringstatus
   */
  getSyncStatus() {
    return {
      ...this.syncState,
      isRunning: this.syncInProgress || false,
      nextScheduledSync: this.nextSyncTime || null
    };
  }

  /**
   * Rensa synkroniseringsdata
   */
  async clearSyncState() {
    this.syncState = {
      lastSync: null,
      syncStats: {
        customersFromCRM: 0,
        customersFromVisma: 0,
        conflicts: 0,
        errors: 0
      },
      conflicts: [],
      mappings: {}
    };

    await this.saveSyncState();
  }
}

module.exports = CustomerSyncService;