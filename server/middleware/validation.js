// Input Validation & Sanitization
// Säker hantering av all input data

const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');
const { SECURITY_CONFIG } = require('./security');

class InputValidator {
  
  // Validate and sanitize user input
  static validateUser(data) {
    const errors = [];
    const sanitized = {};

    // Namn validation
    if (!data.namn || typeof data.namn !== 'string') {
      errors.push('Namn krävs');
    } else {
      sanitized.namn = this.sanitizeString(data.namn, 100);
      if (sanitized.namn.length < 1) errors.push('Namn kan inte vara tomt');
    }

    // Email validation (if provided)
    if (data.email) {
      if (!validator.isEmail(data.email)) {
        errors.push('Ogiltig email-adress');
      } else {
        sanitized.email = validator.normalizeEmail(data.email);
      }
    }

    // Phone validation (if provided)
    if (data.telefon) {
      const phone = data.telefon.replace(/\s+/g, '');
      if (!validator.isMobilePhone(phone, 'sv-SE')) {
        errors.push('Ogiltigt telefonnummer');
      } else {
        sanitized.telefon = phone;
      }
    }

    // Role validation
    if (data.roll && !['admin', 'sales', 'user'].includes(data.roll)) {
      errors.push('Ogiltig roll');
    } else {
      sanitized.roll = data.roll || 'user';
    }

    return { isValid: errors.length === 0, errors, data: sanitized };
  }

  // Validate company data
  static validateCompany(data) {
    const errors = [];
    const sanitized = {};

    // Company name
    if (!data.namn || typeof data.namn !== 'string') {
      errors.push('Företagsnamn krävs');
    } else {
      sanitized.namn = this.sanitizeString(data.namn, 200);
      if (sanitized.namn.length < 1) errors.push('Företagsnamn kan inte vara tomt');
    }

    // Organization number (Swedish format)
    if (data.orgNumber) {
      const cleaned = data.orgNumber.replace(/\D/g, '');
      if (cleaned.length !== 10) {
        errors.push('Organisationsnummer måste vara 10 siffror');
      } else {
        sanitized.orgNumber = cleaned;
      }
    }

    // Status validation
    const validStatuses = ['prospekt', 'kund', 'ej', 'avslutad'];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push('Ogiltig status');
    } else {
      sanitized.status = data.status || 'prospekt';
    }

    // Payment validation
    if (data.payment !== undefined) {
      const payment = parseFloat(data.payment);
      if (isNaN(payment) || payment < 0) {
        errors.push('Betalning måste vara ett positivt tal');
      } else {
        sanitized.payment = payment;
      }
    }

    // City
    if (data.stad) {
      sanitized.stad = this.sanitizeString(data.stad, 100);
    }

    return { isValid: errors.length === 0, errors, data: sanitized };
  }

  // Validate agent data
  static validateAgent(data) {
    const errors = [];
    const sanitized = {};

    // First name
    if (!data.förnamn || typeof data.förnamn !== 'string') {
      errors.push('Förnamn krävs');
    } else {
      sanitized.förnamn = this.sanitizeString(data.förnamn, 50);
      if (sanitized.förnamn.length < 1) errors.push('Förnamn kan inte vara tomt');
    }

    // Last name
    if (!data.efternamn || typeof data.efternamn !== 'string') {
      errors.push('Efternamn krävs');
    } else {
      sanitized.efternamn = this.sanitizeString(data.efternamn, 50);
      if (sanitized.efternamn.length < 1) errors.push('Efternamn kan inte vara tomt');
    }

    // Email validation
    if (data.email) {
      if (!validator.isEmail(data.email)) {
        errors.push('Ogiltig email-adress');
      } else {
        sanitized.email = validator.normalizeEmail(data.email);
      }
    }

    // Phone validation
    if (data.telefon) {
      const phone = data.telefon.replace(/\s+/g, '');
      if (!validator.isMobilePhone(phone, 'sv-SE')) {
        errors.push('Ogiltigt telefonnummer');
      } else {
        sanitized.telefon = phone;
      }
    }

    // License validation
    if (data.licens) {
      const validStatuses = ['aktiv', 'inaktiv', 'test', 'ingen'];
      if (data.licens.status && !validStatuses.includes(data.licens.status)) {
        errors.push('Ogiltig licensstatus');
      }
      sanitized.licens = {
        status: data.licens.status || 'ingen',
        typ: this.sanitizeString(data.licens.typ || '', 100)
      };
    }

    return { isValid: errors.length === 0, errors, data: sanitized };
  }

  // Validate brand data
  static validateBrand(data) {
    const errors = [];
    const sanitized = {};

    if (!data.namn || typeof data.namn !== 'string') {
      errors.push('Varumärkesnamn krävs');
    } else {
      sanitized.namn = this.sanitizeString(data.namn, 100);
      if (sanitized.namn.length < 1) errors.push('Varumärkesnamn kan inte vara tomt');
    }

    if (data.beskrivning) {
      sanitized.beskrivning = this.sanitizeString(data.beskrivning, 500);
    }

    return { isValid: errors.length === 0, errors, data: sanitized };
  }

  // Validate password
  static validatePassword(password) {
    const errors = [];
    
    if (!password || typeof password !== 'string') {
      errors.push('Lösenord krävs');
      return { isValid: false, errors };
    }

    if (password.length < SECURITY_CONFIG.PASSWORD.MIN_LENGTH) {
      errors.push(`Lösenord måste vara minst ${SECURITY_CONFIG.PASSWORD.MIN_LENGTH} tecken`);
    }

    if (SECURITY_CONFIG.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Lösenord måste innehålla minst en versal');
    }

    if (SECURITY_CONFIG.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Lösenord måste innehålla minst en gemen');
    }

    if (SECURITY_CONFIG.PASSWORD.REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push('Lösenord måste innehålla minst en siffra');
    }

    if (SECURITY_CONFIG.PASSWORD.REQUIRE_SPECIAL && !/[@$!%*?&]/.test(password)) {
      errors.push('Lösenord måste innehålla minst ett specialtecken (@$!%*?&)');
    }

    return { isValid: errors.length === 0, errors };
  }

  // Validate search query
  static validateSearchQuery(query) {
    if (!query || typeof query !== 'string') {
      return { isValid: false, error: 'Sökfråga krävs' };
    }

    const sanitized = this.sanitizeString(query, 100);
    
    if (sanitized.length < 2) {
      return { isValid: false, error: 'Sökfråga måste vara minst 2 tecken' };
    }

    // Prevent SQL injection patterns
    const dangerousPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(--|#|\/\*|\*\/)/,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitized)) {
        return { isValid: false, error: 'Ogiltig sökfråga' };
      }
    }

    return { isValid: true, data: sanitized };
  }

  // Validate pagination parameters
  static validatePagination(page, limit) {
    const errors = [];
    const sanitized = {};

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      sanitized.page = 1;
    } else if (pageNum > 10000) {
      errors.push('Sidnummer för stort');
    } else {
      sanitized.page = pageNum;
    }

    if (isNaN(limitNum) || limitNum < 1) {
      sanitized.limit = 50;
    } else if (limitNum > 1000) {
      errors.push('Gräns för stor (max 1000)');
    } else {
      sanitized.limit = limitNum;
    }

    return { isValid: errors.length === 0, errors, data: sanitized };
  }

  // Validate file upload
  static validateFileUpload(file, allowedTypes = ['.xlsx', '.xls']) {
    const errors = [];

    if (!file) {
      errors.push('Ingen fil uppladddad');
      return { isValid: false, errors };
    }

    // Check file size
    if (file.size > SECURITY_CONFIG.INPUT.MAX_FILE_SIZE) {
      errors.push(`Fil för stor (max ${SECURITY_CONFIG.INPUT.MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }

    // Check file type
    const fileExt = '.' + file.originalname.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      errors.push(`Otillåten filtyp. Tillåtna: ${allowedTypes.join(', ')}`);
    }

    // Basic filename validation
    if (!/^[a-zA-Z0-9._\-\s\u00C0-\u017F]+$/.test(file.originalname)) {
      errors.push('Ogiltigt filnamn');
    }

    return { isValid: errors.length === 0, errors };
  }

  // Sanitize string input
  static sanitizeString(input, maxLength = SECURITY_CONFIG.INPUT.MAX_STRING_LENGTH) {
    if (typeof input !== 'string') return '';
    
    // Remove HTML tags
    let sanitized = SECURITY_CONFIG.INPUT.SANITIZE_HTML ? 
      DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }) : input;
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    // Escape special characters for XSS prevention
    sanitized = sanitized
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    return sanitized;
  }

  // Validate JSON structure
  static validateJsonStructure(data, requiredFields = []) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      errors.push('Ogiltig JSON-struktur');
      return { isValid: false, errors };
    }

    for (const field of requiredFields) {
      if (!(field in data)) {
        errors.push(`Obligatoriskt fält saknas: ${field}`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  // Validate Swedish personal number (personnummer)
  static validatePersonalNumber(pnr) {
    if (!pnr) return { isValid: true }; // Optional field
    
    const cleaned = pnr.replace(/\D/g, '');
    
    // Swedish personal number should be 10 or 12 digits
    if (cleaned.length !== 10 && cleaned.length !== 12) {
      return { isValid: false, error: 'Personnummer måste vara 10 eller 12 siffror' };
    }

    // Basic Luhn algorithm check for Swedish personal numbers
    const digits = cleaned.slice(-10).split('').map(Number);
    let sum = 0;
    
    for (let i = 0; i < 9; i++) {
      let n = digits[i] * (2 - (i % 2));
      if (n > 9) n = Math.floor(n / 10) + (n % 10);
      sum += n;
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    
    if (checkDigit !== digits[9]) {
      return { isValid: false, error: 'Ogiltigt personnummer' };
    }

    return { isValid: true, data: cleaned };
  }

  // Rate limit check
  static checkRateLimit(identifier, type = 'API') {
    const config = SECURITY_CONFIG.RATE_LIMIT[type];
    if (!config) return { allowed: true };

    // In a real implementation, this would use Redis or similar
    // For now, we'll use a simple in-memory store
    const key = `${type}:${identifier}`;
    const now = Date.now();
    
    if (!this.rateLimitStore) this.rateLimitStore = new Map();
    
    const record = this.rateLimitStore.get(key) || { count: 0, resetTime: now + config.window };
    
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + config.window;
    } else {
      record.count++;
    }
    
    this.rateLimitStore.set(key, record);
    
    if (record.count > config.max) {
      return { 
        allowed: false, 
        resetTime: record.resetTime,
        error: `Rate limit överskriden. Försök igen om ${Math.ceil((record.resetTime - now) / 1000)} sekunder`
      };
    }
    
    return { allowed: true, remaining: config.max - record.count };
  }
}

// Clean up old rate limit entries
setInterval(() => {
  if (InputValidator.rateLimitStore) {
    const now = Date.now();
    for (const [key, record] of InputValidator.rateLimitStore.entries()) {
      if (now > record.resetTime) {
        InputValidator.rateLimitStore.delete(key);
      }
    }
  }
}, 60000); // Clean every minute

module.exports = InputValidator;