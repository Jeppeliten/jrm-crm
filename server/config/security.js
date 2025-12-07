// Enhanced Security Configuration
// Production-ready security settings för svensk CRM

const SECURITY_CONFIG = {
  // Session Management
  SESSION: {
    TIMEOUT: 30 * 60 * 1000, // 30 minutes
    WARNING_TIME: 5 * 60 * 1000, // 5 minutes warning
    MAX_CONCURRENT: 3, // Max concurrent sessions per user
    SECURE_COOKIES: process.env.NODE_ENV === 'production',
    HTTPONLY: true,
    SAMESITE: 'strict'
  },

  // Password Policy
  PASSWORD: {
    MIN_LENGTH: 12,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL: true,
    MAX_AGE_DAYS: 90, // Force password change
    PREVENT_REUSE: 5, // Last 5 passwords
    COMPLEXITY_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
  },

  // Rate Limiting
  RATE_LIMIT: {
    LOGIN: { window: 15 * 60 * 1000, max: 5 }, // 5 attempts per 15 min
    API: { window: 15 * 60 * 1000, max: 1000 }, // 1000 requests per 15 min
    DOWNLOAD: { window: 60 * 60 * 1000, max: 10 }, // 10 downloads per hour
    UPLOAD: { window: 60 * 60 * 1000, max: 20 } // 20 uploads per hour
  },

  // Input Validation
  INPUT: {
    MAX_STRING_LENGTH: 1000,
    MAX_JSON_SIZE: '10mb',
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_FILE_TYPES: ['.xlsx', '.xls', '.csv'],
    SANITIZE_HTML: true,
    ESCAPE_SQL: true
  },

  // Audit & GDPR
  AUDIT: {
    RETENTION_DAYS: 2555, // 7 years for Swedish compliance
    LOG_ALL_ACCESS: true,
    LOG_DATA_CHANGES: true,
    ANONYMIZE_AFTER_DAYS: 2555,
    BACKUP_FREQUENCY: 'daily'
  },

  // Security Headers
  HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  },

  // Database
  DB: {
    ENCRYPTION_AT_REST: true,
    CONNECTION_POOL_SIZE: 10,
    QUERY_TIMEOUT: 30000,
    BACKUP_ENCRYPTION: true,
    SENSITIVE_FIELDS: ['email', 'phone', 'personalNumber', 'bankAccount']
  }
};

module.exports = SECURITY_CONFIG;