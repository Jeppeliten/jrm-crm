// Enhanced Security Middleware
// Säkerhetslager för alla API-requests

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const { SECURITY_CONFIG } = require('../config/security');
const InputValidator = require('./validation');

class SecurityMiddleware {
  
  // Initialize all security middleware
  static init(app) {
    // Compression for better performance
    app.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      }
    }));

    // Security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // CORS configuration
    app.use(cors({
      origin: process.env.NODE_ENV === 'production' ? 
        ['https://yourdomain.se', 'https://www.yourdomain.se'] : 
        ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Session-Warning', 'X-Rate-Limit-Remaining'],
      maxAge: 86400 // 24 hours
    }));

    // Rate limiting
    this.setupRateLimiting(app);

    // Request logging
    app.use(this.requestLogger);

    // Input validation middleware
    app.use(this.inputValidation);

    // CSRF protection
    app.use(this.csrfProtection);

    // Session security
    app.use(this.sessionSecurity);
  }

  // Setup rate limiting for different endpoints
  static setupRateLimiting(app) {
    // General API rate limiting
    const apiLimiter = rateLimit({
      windowMs: SECURITY_CONFIG.RATE_LIMIT.API.window,
      max: SECURITY_CONFIG.RATE_LIMIT.API.max,
      message: {
        error: 'api_rate_limit_exceeded',
        message: 'För många förfrågningar. Försök igen senare.'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.logSecurityEvent('rate_limit_exceeded', req, { type: 'api' });
        res.status(429).json({
          error: 'rate_limit_exceeded',
          message: 'För många förfrågningar. Försök igen senare.',
          retryAfter: Math.ceil(SECURITY_CONFIG.RATE_LIMIT.API.window / 1000)
        });
      }
    });

    // Login rate limiting (stricter)
    const loginLimiter = rateLimit({
      windowMs: SECURITY_CONFIG.RATE_LIMIT.LOGIN.window,
      max: SECURITY_CONFIG.RATE_LIMIT.LOGIN.max,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => {
        return req.ip + ':' + (req.body?.username || req.body?.email || 'unknown');
      },
      handler: (req, res) => {
        this.logSecurityEvent('login_rate_limit_exceeded', req, { 
          username: req.body?.username,
          email: req.body?.email 
        });
        res.status(429).json({
          error: 'login_rate_limit_exceeded',
          message: 'För många inloggningsförsök. Försök igen om 15 minuter.',
          lockoutTime: SECURITY_CONFIG.RATE_LIMIT.LOGIN.window
        });
      }
    });

    // File upload rate limiting
    const uploadLimiter = rateLimit({
      windowMs: SECURITY_CONFIG.RATE_LIMIT.UPLOAD.window,
      max: SECURITY_CONFIG.RATE_LIMIT.UPLOAD.max,
      handler: (req, res) => {
        this.logSecurityEvent('upload_rate_limit_exceeded', req);
        res.status(429).json({
          error: 'upload_rate_limit_exceeded',
          message: 'För många filer uppladdade. Försök igen senare.'
        });
      }
    });

    // Apply rate limiting
    app.use('/api', apiLimiter);
    app.use('/api/login', loginLimiter);
    app.use('/api/import', uploadLimiter);
  }

  // Request logging middleware
  static requestLogger(req, res, next) {
    const start = Date.now();
    const originalSend = res.send;

    res.send = function(data) {
      const duration = Date.now() - start;
      
      // Log suspicious requests
      if (duration > 10000 || res.statusCode >= 400) {
        SecurityMiddleware.logSecurityEvent('slow_or_error_request', req, {
          duration,
          statusCode: res.statusCode,
          contentLength: res.get('content-length'),
          userAgent: req.get('user-agent')
        });
      }

      return originalSend.call(this, data);
    };

    // Log all API requests in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${new Date().toISOString()} ${req.method} ${req.url} - ${req.ip}`);
    }

    next();
  }

  // Input validation middleware
  static inputValidation(req, res, next) {
    // Skip validation for certain routes
    if (req.path.startsWith('/api/health') || req.method === 'GET') {
      return next();
    }

    // Validate content type for POST requests
    if (req.method === 'POST' && !req.path.includes('/import/')) {
      const contentType = req.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return res.status(400).json({
          error: 'invalid_content_type',
          message: 'Content-Type måste vara application/json'
        });
      }
    }

    // Validate JSON size
    if (req.body && JSON.stringify(req.body).length > 10 * 1024 * 1024) {
      return res.status(413).json({
        error: 'payload_too_large',
        message: 'Request för stor'
      });
    }

    // Validate common injection attempts
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /onload=/i,
      /onerror=/i,
      /\bunion\b.*\bselect\b/i,
      /\bdrop\b.*\btable\b/i
    ];

    const requestString = JSON.stringify(req.body || {}) + (req.query ? JSON.stringify(req.query) : '');
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestString)) {
        this.logSecurityEvent('injection_attempt', req, { pattern: pattern.toString() });
        return res.status(400).json({
          error: 'invalid_input',
          message: 'Ogiltig indata upptäckt'
        });
      }
    }

    next();
  }

  // CSRF protection middleware
  static csrfProtection(req, res, next) {
    // Skip CSRF for GET requests and health checks
    if (req.method === 'GET' || req.path === '/api/health') {
      return next();
    }

    // Check for valid CSRF token in headers or body
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
      // Log potential CSRF attack
      this.logSecurityEvent('csrf_violation', req, {
        hasToken: !!token,
        hasSessionToken: !!sessionToken,
        tokensMatch: token === sessionToken
      });

      return res.status(403).json({
        error: 'csrf_token_invalid',
        message: 'Ogiltig säkerhetstoken'
      });
    }

    next();
  }

  // Session security middleware
  static sessionSecurity(req, res, next) {
    // Add security headers to all responses
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Check for session hijacking attempts
    if (req.session && req.session.userAgent && req.session.userAgent !== req.get('user-agent')) {
      this.logSecurityEvent('session_hijack_attempt', req, {
        sessionUserAgent: req.session.userAgent,
        requestUserAgent: req.get('user-agent')
      });
      
      // Destroy potentially hijacked session
      req.session.destroy();
      return res.status(401).json({
        error: 'session_invalid',
        message: 'Session ogiltig, logga in igen'
      });
    }

    // Add user agent to new sessions
    if (req.session && !req.session.userAgent) {
      req.session.userAgent = req.get('user-agent');
    }

    next();
  }

  // Log security events
  static logSecurityEvent(type, req, details = {}) {
    const event = {
      timestamp: new Date().toISOString(),
      type,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      method: req.method,
      url: req.url,
      userId: req.session?.userId,
      details,
      severity: this.getEventSeverity(type)
    };

    // In production, this should go to a security log file or SIEM system
    if (event.severity === 'high') {
      console.error('SECURITY ALERT:', JSON.stringify(event, null, 2));
    } else {
      console.warn('Security event:', JSON.stringify(event));
    }

    // Store in security log (implement based on your logging system)
    this.appendSecurityLog(event);
  }

  // Get event severity
  static getEventSeverity(type) {
    const highSeverity = [
      'injection_attempt',
      'session_hijack_attempt',
      'csrf_violation',
      'authentication_bypass_attempt'
    ];

    const mediumSeverity = [
      'login_rate_limit_exceeded',
      'upload_rate_limit_exceeded',
      'rate_limit_exceeded'
    ];

    if (highSeverity.includes(type)) return 'high';
    if (mediumSeverity.includes(type)) return 'medium';
    return 'low';
  }

  // Append to security log
  static appendSecurityLog(event) {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logFile = path.join(logDir, `security-${new Date().toISOString().split('T')[0]}.log`);
      const logLine = JSON.stringify(event) + '\n';
      
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Failed to write security log:', error);
    }
  }

  // Validate API key (if using API keys)
  static validateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];

    if (req.path.startsWith('/api/public/') && validApiKeys.length > 0) {
      if (!apiKey || !validApiKeys.includes(apiKey)) {
        this.logSecurityEvent('invalid_api_key', req, { apiKey: apiKey ? 'present' : 'missing' });
        return res.status(401).json({
          error: 'invalid_api_key',
          message: 'Ogiltig API-nyckel'
        });
      }
    }

    next();
  }

  // Sanitize response data
  static sanitizeResponse(data) {
    if (typeof data === 'string') {
      return InputValidator.sanitizeString(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeResponse(item));
    }
    
    if (data && typeof data === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeResponse(value);
      }
      return sanitized;
    }
    
    return data;
  }

  // Check for suspicious patterns in requests
  static checkSuspiciousPatterns(req, res, next) {
    const suspiciousIndicators = [
      /\b(eval|exec|system|shell_exec)\b/i,
      /\b(base64_decode|gzinflate|str_rot13)\b/i,
      /\b(document\.cookie|document\.write)\b/i,
      /\b(XMLHttpRequest|fetch)\b.*\b(eval|Function)\b/i,
      /(union.*select|select.*from|insert.*into|delete.*from)/i
    ];

    const userAgent = req.get('user-agent') || '';
    const referer = req.get('referer') || '';
    const body = JSON.stringify(req.body || {});
    const query = JSON.stringify(req.query || {});
    
    const checkString = `${userAgent} ${referer} ${body} ${query}`;
    
    for (const pattern of suspiciousIndicators) {
      if (pattern.test(checkString)) {
        this.logSecurityEvent('suspicious_pattern_detected', req, {
          pattern: pattern.toString(),
          userAgent,
          referer
        });
        
        return res.status(400).json({
          error: 'suspicious_request',
          message: 'Misstänkt aktivitet upptäckt'
        });
      }
    }

    next();
  }
}

module.exports = SecurityMiddleware;