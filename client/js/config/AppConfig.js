// Application Configuration
// Centralized configuration management with environment-specific settings

/**
 * Application Configuration Class
 * Manages all application settings with proper defaults and validation
 */
export class AppConfig {
  // Application metadata
  static VERSION = '2.0.0';
  static APP_NAME = 'CRM Professional';
  static ENVIRONMENT = this.detectEnvironment();
  
  // Storage configuration
  static STORAGE_KEY = 'crm_professional_v2';
  static BACKUP_KEY = 'crm_professional_backup_v2';
  static MAX_BACKUPS = 5;
  
  // Session and security
  static SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  static CSRF_TOKEN_LENGTH = 32;
  static ENCRYPTION_KEY_LENGTH = 32;
  static PASSWORD_MIN_LENGTH = 8;
  
  // UI and UX
  static ANIMATION_DURATION = 300; // milliseconds
  static DEBOUNCE_DELAY = 300; // milliseconds
  static NOTIFICATION_DURATION = 5000; // milliseconds
  static MODAL_STACK_LIMIT = 5;
  
  // Performance
  static MAX_SEARCH_RESULTS = 100;
  static PAGINATION_SIZE = 20;
  static AUTO_SAVE_INTERVAL = 30000; // 30 seconds
  static PERFORMANCE_SAMPLE_RATE = 0.1; // 10%
  
  // API configuration
  static API_BASE_URL = this.getApiBaseUrl();
  static API_TIMEOUT = 10000; // 10 seconds
  static RETRY_ATTEMPTS = 3;
  static RETRY_DELAY = 1000; // 1 second
  
  // Feature flags
  static FEATURES = {
    ADVANCED_ANALYTICS: this.ENVIRONMENT === 'development',
    REAL_TIME_SYNC: false,
    EXPORT_FORMATS: ['json', 'csv', 'xlsx'],
    IMPORT_FORMATS: ['json', 'csv', 'xlsx'],
    OFFLINE_MODE: true,
    AUDIT_LOGGING: true,
    PERFORMANCE_MONITORING: true,
    ERROR_REPORTING: this.ENVIRONMENT === 'production'
  };
  
  // Pricing configuration
  static PRICING_TIERS = [
    { min: 4, max: 6, price: 849, name: '4-6 medarbetare' },
    { min: 7, max: 9, price: 1099, name: '7-9 medarbetare' },
    { min: 10, max: 15, price: 1649, name: '10-15 medarbetare' },
    { min: 16, max: 20, price: 2099, name: '16-20 medarbetare' },
    { min: 21, max: Infinity, price: 2449, name: '21+ medarbetare' }
  ];
  
  // User roles and permissions
  static USER_ROLES = {
    VIEWER: {
      name: 'Viewer',
      permissions: ['read']
    },
    USER: {
      name: 'User',
      permissions: ['read', 'write']
    },
    MODERATOR: {
      name: 'Moderator',
      permissions: ['read', 'write', 'moderate']
    },
    ADMIN: {
      name: 'Admin',
      permissions: ['read', 'write', 'moderate', 'admin']
    },
    SUPERADMIN: {
      name: 'Super Admin',
      permissions: ['read', 'write', 'moderate', 'admin', 'superadmin']
    }
  };
  
  // Default users for initial setup
  static DEFAULT_USERS = [
    {
      id: 'u1',
      name: 'Administrator',
      username: 'admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      active: true,
      created: new Date().toISOString()
    },
    {
      id: 'u2',
      name: 'Sara Säljare',
      username: 'sara',
      email: 'sara@example.com',
      role: 'USER',
      active: true,
      created: new Date().toISOString()
    },
    {
      id: 'u3',
      name: 'Johan Säljare',
      username: 'johan',
      email: 'johan@example.com',
      role: 'USER',
      active: true,
      created: new Date().toISOString()
    }
  ];
  
  // Validation rules
  static VALIDATION_RULES = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE: /^(\+46|0)[1-9]\d{7,9}$/,
    PERSONNUMMER: /^(19|20)\d{6}-\d{4}$/,
    ORGANISATIONSNUMMER: /^\d{6}-\d{4}$/,
    WEBSITE: /^https?:\/\/.+\..+/,
    PASSWORD_STRENGTH: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false
    }
  };
  
  // Localization
  static LOCALE = 'sv-SE';
  static TIMEZONE = 'Europe/Stockholm';
  static CURRENCY = 'SEK';
  static DATE_FORMAT = 'YYYY-MM-DD';
  static TIME_FORMAT = 'HH:mm';
  static DATETIME_FORMAT = 'YYYY-MM-DD HH:mm';
  
  // Error messages
  static ERROR_MESSAGES = {
    NETWORK_ERROR: 'Nätverksfel. Kontrollera din anslutning.',
    VALIDATION_ERROR: 'Ogiltiga data. Kontrollera dina inmatningar.',
    AUTH_ERROR: 'Autentiseringsfel. Logga in igen.',
    PERMISSION_ERROR: 'Otillräcklig behörighet för denna åtgärd.',
    STORAGE_ERROR: 'Fel vid lagring av data.',
    IMPORT_ERROR: 'Fel vid import av data.',
    EXPORT_ERROR: 'Fel vid export av data.',
    UNKNOWN_ERROR: 'Ett oväntat fel inträffade.'
  };
  
  // Logging configuration
  static LOG_LEVEL = this.ENVIRONMENT === 'production' ? 'warn' : 'debug';
  static LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  
  /**
   * Detect current environment
   * @returns {string} Environment name
   */
  static detectEnvironment() {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      } else if (hostname.includes('staging') || hostname.includes('test')) {
        return 'staging';
      } else {
        return 'production';
      }
    }
    
    return 'development';
  }
  
  /**
   * Get API base URL based on environment
   * @returns {string} API base URL
   */
  static getApiBaseUrl() {
    switch (this.ENVIRONMENT) {
      case 'development':
        return 'http://localhost:3000/api';
      case 'staging':
        return 'https://staging-api.example.com/api';
      case 'production':
        return 'https://api.example.com/api';
      default:
        return '/api';
    }
  }
  
  /**
   * Get configuration value with environment override
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Configuration value
   */
  static get(key, defaultValue = null) {
    // Check for environment-specific override
    const envKey = `${this.ENVIRONMENT.toUpperCase()}_${key}`;
    
    if (typeof window !== 'undefined' && window.CRM_CONFIG) {
      if (window.CRM_CONFIG[envKey] !== undefined) {
        return window.CRM_CONFIG[envKey];
      }
      if (window.CRM_CONFIG[key] !== undefined) {
        return window.CRM_CONFIG[key];
      }
    }
    
    // Check for runtime configuration
    if (this[key] !== undefined) {
      return this[key];
    }
    
    return defaultValue;
  }
  
  /**
   * Set configuration value
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   */
  static set(key, value) {
    if (typeof window !== 'undefined') {
      window.CRM_CONFIG = window.CRM_CONFIG || {};
      window.CRM_CONFIG[key] = value;
    }
  }
  
  /**
   * Validate configuration
   * @returns {object} Validation result
   */
  static validate() {
    const errors = [];
    const warnings = [];
    
    // Check required settings
    if (!this.STORAGE_KEY) {
      errors.push('STORAGE_KEY is required');
    }
    
    if (this.SESSION_TIMEOUT < 60000) {
      warnings.push('SESSION_TIMEOUT is very short (< 1 minute)');
    }
    
    if (this.ENVIRONMENT === 'production' && this.LOG_LEVEL === 'debug') {
      warnings.push('Debug logging enabled in production');
    }
    
    // Validate pricing tiers
    const tierErrors = this.validatePricingTiers();
    errors.push(...tierErrors);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate pricing tiers configuration
   * @returns {Array} Array of error messages
   * @private
   */
  static validatePricingTiers() {
    const errors = [];
    
    if (!Array.isArray(this.PRICING_TIERS) || this.PRICING_TIERS.length === 0) {
      errors.push('PRICING_TIERS must be a non-empty array');
      return errors;
    }
    
    for (let i = 0; i < this.PRICING_TIERS.length; i++) {
      const tier = this.PRICING_TIERS[i];
      
      if (typeof tier.min !== 'number' || tier.min < 0) {
        errors.push(`Pricing tier ${i}: min must be a positive number`);
      }
      
      if (typeof tier.max !== 'number' || tier.max < tier.min) {
        errors.push(`Pricing tier ${i}: max must be >= min`);
      }
      
      if (typeof tier.price !== 'number' || tier.price < 0) {
        errors.push(`Pricing tier ${i}: price must be a positive number`);
      }
      
      if (!tier.name || typeof tier.name !== 'string') {
        errors.push(`Pricing tier ${i}: name is required`);
      }
    }
    
    return errors;
  }
  
  /**
   * Get user role permissions
   * @param {string} role - User role
   * @returns {Array} Array of permissions
   */
  static getUserPermissions(role) {
    const roleConfig = this.USER_ROLES[role];
    return roleConfig ? roleConfig.permissions : [];
  }
  
  /**
   * Check if user has permission
   * @param {string} userRole - User role
   * @param {string} permission - Required permission
   * @returns {boolean} Has permission
   */
  static hasPermission(userRole, permission) {
    const permissions = this.getUserPermissions(userRole);
    return permissions.includes(permission);
  }
  
  /**
   * Get feature flag value
   * @param {string} feature - Feature name
   * @returns {boolean} Feature enabled
   */
  static isFeatureEnabled(feature) {
    return Boolean(this.FEATURES[feature]);
  }
  
  /**
   * Get all configuration as object
   * @returns {object} Complete configuration
   */
  static toObject() {
    return {
      VERSION: this.VERSION,
      APP_NAME: this.APP_NAME,
      ENVIRONMENT: this.ENVIRONMENT,
      STORAGE_KEY: this.STORAGE_KEY,
      SESSION_TIMEOUT: this.SESSION_TIMEOUT,
      FEATURES: this.FEATURES,
      USER_ROLES: this.USER_ROLES,
      VALIDATION_RULES: this.VALIDATION_RULES,
      PRICING_TIERS: this.PRICING_TIERS,
      LOCALE: this.LOCALE,
      TIMEZONE: this.TIMEZONE,
      CURRENCY: this.CURRENCY
    };
  }
  
  /**
   * Generate configuration report
   * @returns {string} Configuration report
   */
  static generateReport() {
    const validation = this.validate();
    const config = this.toObject();
    
    return `
=== CRM Application Configuration ===
Version: ${this.VERSION}
Environment: ${this.ENVIRONMENT}
Valid: ${validation.isValid ? '✅' : '❌'}

${validation.errors.length > 0 ? `
Errors:
${validation.errors.map(e => `- ${e}`).join('\n')}
` : ''}

${validation.warnings.length > 0 ? `
Warnings:
${validation.warnings.map(w => `- ${w}`).join('\n')}
` : ''}

Configuration:
${JSON.stringify(config, null, 2)}
    `.trim();
  }
}

// Validate configuration on load
const validation = AppConfig.validate();
if (!validation.isValid) {
  console.error('Configuration validation failed:', validation.errors);
}
if (validation.warnings.length > 0) {
  console.warn('Configuration warnings:', validation.warnings);
}

export default AppConfig;