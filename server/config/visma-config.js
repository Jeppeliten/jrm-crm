/**
 * Visma.net Integration Configuration
 * 
 * Konfiguration för Visma.net API-integration
 * Inkluderar OAuth-inställningar, fältmappning och synkroniseringsregler
 */

// Miljövariabler för säker konfiguration
const VISMA_CONFIG = {
  // OAuth 2.0 Credentials (MÅSTE sättas i miljövariabler för säkerhet)
  clientId: process.env.VISMA_CLIENT_ID || '',
  clientSecret: process.env.VISMA_CLIENT_SECRET || '',
  redirectUri: process.env.VISMA_REDIRECT_URI || 'http://localhost:3000/api/visma/callback',
  companyDatabaseId: process.env.VISMA_COMPANY_DB_ID || '',
  
  // API URLs
  baseUrl: 'https://integration.visma.net/API',
  authUrl: 'https://identity.visma.net/connect',
  
  // Synkroniseringsinställningar
  syncOptions: {
    autoSync: false, // Automatisk synkronisering (aktiveras senare)
    syncInterval: 5 * 60 * 1000, // 5 minuter
    batchSize: 50, // Antal poster per batch
    retryAttempts: 3,
    retryDelay: 1000, // ms
    
    // Konflikthantering
    conflictResolution: {
      customers: 'merge', // 'merge', 'visma_wins', 'crm_wins'
      invoices: 'visma_wins',
      products: 'visma_wins'
    }
  },
  
  // Fältmappning mellan CRM och Visma.net
  fieldMapping: {
    // Kundmappning: CRM-fält -> Visma.net-fält
    customer: {
      // Grundläggande information
      'id': 'number',
      'namn': 'name',
      'customerNumber': 'number',
      'orgNumber': 'corporateID',
      
      // Kontaktinformation
      'email': 'mainContact.email',
      'telefon': 'mainContact.phone',
      'website': 'webSite',
      
      // Adressinformation
      'adress': 'mainAddress.addressLine1',
      'adress2': 'mainAddress.addressLine2',
      'postnummer': 'mainAddress.postalCode',
      'stad': 'mainAddress.city',
      'land': 'mainAddress.country',
      
      // Ekonomisk information
      'payment': 'creditLimit',
      'paymentTerms': 'terms',
      'vatId': 'vatRegistrationID',
      
      // Metadata
      'createdDate': 'createdDateTime',
      'lastModified': 'lastModifiedDateTime'
    },
    
    // Fakturamappning
    invoice: {
      'id': 'referenceNumber',
      'customerId': 'customer.number',
      'customerName': 'customer.name',
      'amount': 'amount',
      'vatAmount': 'vatTaxableAmount',
      'totalAmount': 'invoiceTotal',
      'date': 'date',
      'dueDate': 'dueDate',
      'description': 'description',
      'status': 'status',
      'reference': 'customerRefNumber'
    },
    
    // Produktmappning
    product: {
      'id': 'inventoryID',
      'name': 'description',
      'price': 'basePrice',
      'unit': 'baseUnit',
      'vatCode': 'vatCategory',
      'category': 'itemClass'
    }
  },
  
  // Standardvärden för nya poster i Visma.net
  defaults: {
    customer: {
      currencyId: 'SEK',
      status: 'Active',
      terms: '30D', // 30 dagar betalningsvillkor
      vatRegistrationID: '', // Sätts baserat på orgNumber
      country: 'SE'
    },
    
    invoice: {
      currencyId: 'SEK',
      terms: '30D',
      vatCategory: 'NORMAL' // 25% moms
    },
    
    product: {
      status: 'Active',
      baseUnit: 'ST', // Styck
      vatCategory: 'NORMAL',
      type: 'Service' // Service vs StockItem
    }
  },
  
  // Webhook-konfiguration för realtidssynkronisering
  webhooks: {
    enabled: false, // Aktiveras senare
    endpoint: '/api/visma/webhook',
    events: [
      'Customer.Created',
      'Customer.Updated',
      'Invoice.Created',
      'Invoice.Updated',
      'Payment.Created'
    ]
  },
  
  // Loggning och felsökning
  logging: {
    level: 'info', // 'debug', 'info', 'warn', 'error'
    logRequests: true,
    logResponses: false, // Kan innehålla känslig data
    auditSync: true // Logga alla synkroniseringar
  },
  
  // Validationsregler
  validation: {
    customer: {
      required: ['namn', 'email'], // Obligatoriska fält från CRM
      orgNumberFormat: /^[0-9]{10}$/, // Svenskt organisationsnummer
      emailFormat: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    
    invoice: {
      required: ['customerId', 'amount', 'date'],
      minAmount: 0.01,
      maxAmount: 999999999
    }
  },
  
  // Felhantering
  errorHandling: {
    retryableErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'Rate limit exceeded',
      'Service unavailable'
    ],
    
    nonRetryableErrors: [
      'Invalid credentials',
      'Access denied',
      'Invalid data format'
    ],
    
    // Notifiering vid fel
    notifications: {
      email: process.env.ADMIN_EMAIL || '',
      webhook: process.env.ERROR_WEBHOOK_URL || ''
    }
  }
};

// Validera konfiguration
function validateConfig() {
  const errors = [];
  
  if (!VISMA_CONFIG.clientId) {
    errors.push('VISMA_CLIENT_ID environment variable is required');
  }
  
  if (!VISMA_CONFIG.clientSecret) {
    errors.push('VISMA_CLIENT_SECRET environment variable is required');
  }
  
  if (!VISMA_CONFIG.companyDatabaseId) {
    errors.push('VISMA_COMPANY_DB_ID environment variable is required');
  }
  
  if (errors.length > 0) {
    console.warn('⚠️ Visma.net configuration warnings:', errors);
  }
  
  return errors.length === 0;
}

// Hjälpfunktioner för mappning
const MappingHelpers = {
  /**
   * Mappa svenskt organisationsnummer till Visma.net-format
   */
  formatOrgNumber(orgNumber) {
    if (!orgNumber) return '';
    
    // Ta bort all formatering och behåll endast siffror
    const cleaned = orgNumber.replace(/\D/g, '');
    
    // Validera längd (10 siffror för svenskt orgnr)
    if (cleaned.length === 10) {
      return cleaned;
    }
    
    return orgNumber; // Returnera original om inte giltigt
  },
  
  /**
   * Generera VAT registration ID baserat på organisationsnummer
   */
  generateVatId(orgNumber) {
    const formatted = this.formatOrgNumber(orgNumber);
    if (formatted.length === 10) {
      return `SE${formatted}01`; // Svenska VAT-format
    }
    return '';
  },
  
  /**
   * Mappa svenska betalningsvillkor till Visma.net-format
   */
  mapPaymentTerms(crmTerms) {
    const mapping = {
      'kontant': 'CASH',
      'netto': 'NET',
      '30 dagar': '30D',
      '14 dagar': '14D',
      '10 dagar': '10D',
      'förskott': 'PREPAY'
    };
    
    return mapping[crmTerms?.toLowerCase()] || '30D';
  },
  
  /**
   * Konvertera svenska valutakoder
   */
  mapCurrency(currency) {
    const mapping = {
      'kr': 'SEK',
      'sek': 'SEK',
      'eur': 'EUR',
      'usd': 'USD',
      'nok': 'NOK',
      'dkk': 'DKK'
    };
    
    return mapping[currency?.toLowerCase()] || 'SEK';
  }
};

module.exports = {
  VISMA_CONFIG,
  validateConfig,
  MappingHelpers
};