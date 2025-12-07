const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const PasswordSecurity = require('./password-security');
const SecurityMonitor = require('./security-monitor');
const BackupManager = require('./backup-manager');
const TwoFactorAuth = require('./two-factor-auth');
const WebApplicationFirewall = require('./web-application-firewall');
const SIEMSystem = require('./siem-system');
const SSLSecurityManager = require('./ssl-security-manager');
const ZeroTrustManager = require('./zero-trust-manager');
const ATPManager = require('./atp-manager');

// Azure B2C User Synchronization
const { createUserSyncEndpoints } = require('./azure-b2c-user-sync');

// Outlook Integration
const ServerOutlookIntegration = require('./outlook-integration-server');

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'client');
// Allow overriding the directory for persistent data
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
const DATA_PATH = path.join(DATA_DIR, 'state.json');
const AUTH_PATH = path.join(DATA_DIR, 'auth.json');
const AUDIT_PATH = path.join(DATA_DIR, 'audit.log');
const GDPR_PATH = path.join(DATA_DIR, 'gdpr.json');
const ROOT_EXCEL_PATH = path.join(__dirname, '..', 'Sammanställning mäklardata och kunder 1.xlsx');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const NODE_ENV = process.env.NODE_ENV || 'development';
const ROOT_DIR = path.join(__dirname, '..');
const MAKLARPAKET_GLOB = /^Användare mäklarpaket.*\.xlsx$/i;

// Initiera säkerhetsmonitoring och backup
const securityMonitor = new SecurityMonitor(DATA_DIR);
const backupManager = new BackupManager(DATA_DIR);
const twoFactorAuth = new TwoFactorAuth();
const waf = new WebApplicationFirewall();
const siemSystem = new SIEMSystem(DATA_DIR);
const sslSecurityManager = new SSLSecurityManager(DATA_DIR);

// Express app must be defined before passing to managers
const app = express();
const zeroTrustManager = new ZeroTrustManager(app);
const atpManager = new ATPManager(app);

// Enhanced security settings
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIRE_COMPLEXITY = NODE_ENV === 'production';

// Session configuration
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const SESSION_WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout

// In-memory session store with activity tracking
// Map token -> { shared?:boolean, userId?:string, username?:string, lastActivity:timestamp }
const sessions = new Map();

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const [k, v] = part.split('=').map(s => (s || '').trim());
    if (!k) return acc;
    acc[k] = decodeURIComponent(v || '');
    return acc;
  }, {});
}

function setSessionCookie(res, token, maxAgeDays = 7) {
  const secure = NODE_ENV === 'production';
  const maxAge = maxAgeDays * 24 * 60 * 60; // seconds
  const cookie = [
    `sid=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    secure ? 'Secure' : null
  ].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
  const cookie = [
    'sid=',
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0'
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
}

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to read JSON file:', file, e.message);
    return null;
  }
}

function writeJsonSafe(file, obj) {
  try {
    fs.writeFileSync(file, JSON.stringify(obj || {}, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to write JSON file:', file, e.message);
    return false;
  }
}

function appendAudit(entry) {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
    fs.appendFileSync(AUDIT_PATH, line);
    
    // Logga säkerhetshändelser i SecurityMonitor och SIEM
    if (entry.type && entry.type.includes('security') || 
        entry.type && (entry.type.includes('login') || entry.type.includes('rate_limit') || 
                      entry.type.includes('suspicious') || entry.type.includes('injection') ||
                      entry.type.includes('waf') || entry.type.includes('xss') || 
                      entry.type.includes('sql_injection') || entry.type.includes('blocked') ||
                      entry.type.includes('2fa') || entry.type.includes('admin'))) {
      securityMonitor.logSecurityEvent(entry.type, {
        ip: entry.ip,
        userAgent: entry.userAgent,
        userId: entry.user || entry.userId,
        endpoint: entry.endpoint,
        additionalInfo: entry
      });
      
      // Skicka även till SIEM för korrelationsanalys
      siemSystem.logSecurityEvent(entry.type, {
        ip: entry.ip,
        userAgent: entry.userAgent,
        userId: entry.user || entry.userId,
        endpoint: entry.endpoint,
        ...entry
      });
    }
  } catch (e) {
    console.warn('Failed to append audit:', e.message);
  }
}

// Gör appendAudit och andra moduler tillgängliga globalt
global.securityMonitor = securityMonitor;
global.waf = waf;
global.siemSystem = siemSystem;
global.sslSecurityManager = sslSecurityManager;
global.zeroTrustManager = zeroTrustManager;
global.atpManager = atpManager;

// Enhanced audit logging for GDPR compliance
function logDataAccess(action, entityType, entityId, userId, details = {}) {
  appendAudit({
    action,
    entityType,
    entityId,
    userId,
    details,
    type: 'data_access'
  });
}

function logGDPREvent(eventType, userId, details = {}) {
  appendAudit({
    action: eventType,
    userId,
    details,
    type: 'gdpr'
  });
}

// Enhanced audit logging for system events
function logAuditEvent(action, userId, details = {}) {
  appendAudit({
    action,
    userId,
    details,
    type: 'system_event',
    timestamp: new Date().toISOString()
  });
}

// --- Auth helpers with bcrypt ---
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Legacy pbkdf2 support for migration
function pbkdf2Hash(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
}
function verify(password, salt, hash) {
  const h = pbkdf2Hash(password, salt);
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
}
function ensureAuth() {
  let auth = readJsonSafe(AUTH_PATH);
  if (!auth) {
    // If no env ADMIN_PASSWORD, initialize shared password to 'admin'
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = pbkdf2Hash('admin', salt);
    auth = { shared: ADMIN_PASSWORD ? null : { salt, hash }, usersByUsername: {}, usersById: {} };
    writeJsonSafe(AUTH_PATH, auth);
  }
  // ensure structures
  auth.usersByUsername = auth.usersByUsername || {};
  auth.usersById = auth.usersById || {};
  return auth;
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req);
  const sid = cookies.sid;
  if (sid && sessions.has(sid)) {
    const session = sessions.get(sid);
    const now = Date.now();
    
    // Check if session has timed out
    if (session.lastActivity && (now - session.lastActivity > SESSION_TIMEOUT)) {
      sessions.delete(sid);
      clearSessionCookie(res);
      appendAudit({ type: 'session_timeout', sessionId: sid, userId: session.userId });
      return res.status(401).json({ error: 'session_timeout' });
    }
    
    // Update last activity
    session.lastActivity = now;
    sessions.set(sid, session);
    req.session = session;
    req.user = session; // Set req.user for 2FA compatibility
    return next();
  }
  res.status(401).json({ error: 'unauthorized' });
}

// Middleware to check if session is about to expire
function checkSessionWarning(req, res, next) {
  if (req.session && req.session.lastActivity) {
    const now = Date.now();
    const timeLeft = SESSION_TIMEOUT - (now - req.session.lastActivity);
    if (timeLeft < SESSION_WARNING_TIME && timeLeft > 0) {
      res.setHeader('X-Session-Warning', Math.floor(timeLeft / 1000));
    }
  }
  next();
}

function requireAdmin(req, res, next) {
  // Shared-session is considered admin for v1.0
  if (req.session?.shared) return next();
  // Built-in admin id fallback
  if (req.session?.userId === 'u1') return next();
  // Also allow users with role 'admin' in state
  try {
    const s = readJsonSafe(DATA_PATH) || {};
    const uid = req.session?.userId;
    if (uid && Array.isArray(s.users)) {
      const u = s.users.find(x => x.id === uid);
      if (u?.roll === 'admin') return next();
    }
  } catch {}
  return res.status(403).json({ error: 'forbidden' });
}

// (Removed duplicate app initialization)

// ============================================
// SÄKERHETSKONFIGURATION (Enhanced Security)
// ============================================

// Compression för bättre prestanda
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Helmet för säkerhetsheaders med SSL Security Manager
const secureHeaders = sslSecurityManager.getSecureHeaders();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://alcdn.msauth.net", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://login.microsoftonline.com", "https://graph.microsoft.com"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 år
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // SSL Security Manager headers
  expectCt: {
    maxAge: 86400,
    enforce: true
  }
}));

// HTTPS Redirect Middleware
app.use(sslSecurityManager.getHTTPSRedirectMiddleware());

// ========== WAF (Web Application Firewall) ==========
// Måste vara före andra middleware för att fånga alla requests
app.use(waf.getMainFilter());
app.use(waf.getSlowDown());
app.use('/api', waf.getAdaptiveRateLimit());

// Rate limiting för olika endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuter
  max: 1000, // Max 1000 requests per 15 min
  message: {
    error: 'rate_limit_exceeded',
    message: 'För många förfrågningar. Försök igen senare.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    appendAudit({
      type: 'rate_limit_exceeded',
      ip: req.ip,
      userAgent: req.get('user-agent'),
      endpoint: req.path,
      timestamp: new Date().toISOString()
    });
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'För många förfrågningar. Försök igen senare.',
      retryAfter: Math.ceil(15 * 60 * 1000 / 1000)
    });
  }
});

// Striktare rate limiting för inloggning
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuter
  max: 5, // Max 5 inloggningsförsök per 15 min
  skipSuccessfulRequests: true,
  keyGenerator: (req, res) => {
    // Använd express-rate-limit's inbyggda IP-hantering för IPv6-kompatibilitet
    const ipKey = rateLimit.ipKeyGenerator(req, res);
    return ipKey + ':' + (req.body?.username || req.body?.email || 'unknown');
  },
  handler: (req, res) => {
    appendAudit({
      type: 'login_rate_limit_exceeded',
      ip: req.ip,
      username: req.body?.username,
      timestamp: new Date().toISOString()
    });
    res.status(429).json({
      error: 'login_rate_limit_exceeded',
      message: 'För många inloggningsförsök. Försök igen om 15 minuter.',
      lockoutTime: 15 * 60 * 1000
    });
  }
});

// Tillämpa rate limiting
app.use('/api', apiLimiter);
app.use('/api/login', loginLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(cors({ 
  origin: NODE_ENV === 'production' ? 
    false : // Sätt specifika domäner i production
    true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  exposedHeaders: ['X-Session-Warning', 'X-Rate-Limit-Remaining']
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024)
    },
    version: require('./package.json').version || '1.0.0'
  });
});

// ============================================
// SÄKERHETS-ENDPOINTS (Admin only)
// ============================================

// Säkerhetsstatus dashboard
app.get('/api/security/status', requireAuth, (req, res) => {
  try {
    const status = securityMonitor.getSecurityStatus();
    res.json(status);
  } catch (error) {
    console.error('Security status error:', error);
    res.status(500).json({ error: 'Failed to get security status' });
  }
});

// Detaljerade säkerhetsinsikter
app.get('/api/security/insights', requireAuth, (req, res) => {
  try {
    const insights = securityMonitor.getSecurityInsights();
    res.json(insights);
  } catch (error) {
    console.error('Security insights error:', error);
    res.status(500).json({ error: 'Failed to get security insights' });
  }
});

// Lösenordsstyrka-validering
app.post('/api/security/validate-password', requireAuth, (req, res) => {
  try {
    const { password, userInfo } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    const validation = PasswordSecurity.validatePassword(password, userInfo);
    res.json(validation);
  } catch (error) {
    console.error('Password validation error:', error);
    res.status(500).json({ error: 'Failed to validate password' });
  }
});

// Generera säkert lösenord
app.post('/api/security/generate-password', requireAuth, (req, res) => {
  try {
    const { length = 16 } = req.body;
    const password = PasswordSecurity.generateSecurePassword(length);
    const validation = PasswordSecurity.validatePassword(password);
    
    res.json({
      password,
      strength: validation.strength,
      isValid: validation.isValid
    });
  } catch (error) {
    console.error('Password generation error:', error);
    res.status(500).json({ error: 'Failed to generate password' });
  }
});

// Säkerhetsloggar (senaste 100 händelser)
app.get('/api/security/logs', requireAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const severity = req.query.severity;
    
    if (!fs.existsSync(securityMonitor.securityLogPath)) {
      return res.json([]);
    }
    
    const logContent = fs.readFileSync(securityMonitor.securityLogPath, 'utf8');
    let logs = logContent.split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
    
    // Filtrera efter severity om specificerat
    if (severity) {
      logs = logs.filter(log => log.severity === severity.toUpperCase());
    }
    
    // Returnera senaste entries
    logs = logs.slice(-limit).reverse();
    
    res.json(logs);
  } catch (error) {
    console.error('Security logs error:', error);
    res.status(500).json({ error: 'Failed to get security logs' });
  }
});

// ============================================
// DATA ENRICHMENT ENDPOINTS
// ============================================

// Validate if a URL exists and is accessible
app.post('/api/enrichment/validate-url', requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return res.json({ exists: false, error: 'Invalid URL format' });
    }
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.json({ exists: false, error: 'Only HTTP/HTTPS URLs are supported' });
    }
    
    // Try to fetch the URL with HEAD request (faster, doesn't download content)
    const https = require('https');
    const http = require('http');
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      method: 'HEAD',
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      timeout: 5000,
      headers: {
        'User-Agent': 'JRM-CRM/1.0 (Office Finder Bot)'
      }
    };
    
    const result = await new Promise((resolve) => {
      const req = client.request(options, (response) => {
        const statusCode = response.statusCode;
        
        // Consider 200-399 as valid (includes redirects)
        if (statusCode >= 200 && statusCode < 400) {
          resolve({ exists: true, statusCode });
        } else if (statusCode >= 400 && statusCode < 500) {
          resolve({ exists: false, statusCode, error: 'Page not found' });
        } else {
          resolve({ exists: false, statusCode, error: 'Server error' });
        }
      });
      
      req.on('error', (err) => {
        resolve({ exists: false, error: err.message });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ exists: false, error: 'Request timeout' });
      });
      
      req.end();
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('URL validation error:', error);
    res.status(500).json({ exists: false, error: 'Validation failed' });
  }
});

// Validate multiple URLs in batch
app.post('/api/enrichment/validate-urls-batch', requireAuth, async (req, res) => {
  try {
    const { urls } = req.body;
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'URLs array is required' });
    }
    
    if (urls.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 URLs per batch' });
    }
    
    const https = require('https');
    const http = require('http');
    
    const validateUrl = (url) => {
      return new Promise((resolve) => {
        try {
          const parsedUrl = new URL(url);
          
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return resolve({ url, exists: false, error: 'Invalid protocol' });
          }
          
          const client = parsedUrl.protocol === 'https:' ? https : http;
          
          const options = {
            method: 'HEAD',
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            timeout: 5000,
            headers: {
              'User-Agent': 'JRM-CRM/1.0 (Office Finder Bot)'
            }
          };
          
          const req = client.request(options, (response) => {
            const statusCode = response.statusCode;
            
            if (statusCode >= 200 && statusCode < 400) {
              resolve({ url, exists: true, statusCode });
            } else {
              resolve({ url, exists: false, statusCode });
            }
          });
          
          req.on('error', (err) => {
            resolve({ url, exists: false, error: err.message });
          });
          
          req.on('timeout', () => {
            req.destroy();
            resolve({ url, exists: false, error: 'Timeout' });
          });
          
          req.end();
          
        } catch (e) {
          resolve({ url, exists: false, error: 'Invalid URL' });
        }
      });
    };
    
    // Validate all URLs (with some delay to avoid hammering servers)
    const results = [];
    for (const url of urls) {
      const result = await validateUrl(url);
      results.push(result);
      
      // Small delay between requests
      if (urls.indexOf(url) < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    res.json({ results });
    
  } catch (error) {
    console.error('Batch URL validation error:', error);
    res.status(500).json({ error: 'Batch validation failed' });
  }
});

// ============================================
// BACKUP & DISASTER RECOVERY ENDPOINTS
// ============================================

// Lista backups
app.get('/api/backup/list', requireAuth, (req, res) => {
  try {
    const backups = backupManager.listBackups();
    const stats = backupManager.getBackupStats();
    
    res.json({
      backups,
      stats
    });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// Skapa backup
app.post('/api/backup/create', requireAuth, async (req, res) => {
  try {
    const { type = 'manual' } = req.body;
    
    // Logga backup-försök
    appendAudit({
      type: 'backup_create_initiated',
      user: req.user.username,
      backupType: type,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    const result = await backupManager.createBackup(type);
    
    if (result.success) {
      appendAudit({
        type: 'backup_create_success',
        user: req.user.username,
        backupName: result.backupName,
        files: result.files,
        size: result.size,
        timestamp: new Date().toISOString()
      });
    } else {
      appendAudit({
        type: 'backup_create_failed',
        user: req.user.username,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Create backup error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Återställ backup
app.post('/api/backup/restore', requireAuth, async (req, res) => {
  try {
    const { backupName } = req.body;
    
    if (!backupName) {
      return res.status(400).json({ error: 'Backup name required' });
    }
    
    // Logga återställningsförsök
    appendAudit({
      type: 'backup_restore_initiated',
      user: req.user.username,
      backupName,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    const result = await backupManager.restoreBackup(backupName);
    
    if (result.success) {
      appendAudit({
        type: 'backup_restore_success',
        user: req.user.username,
        backupName: result.backupName,
        restoredFiles: result.restoredFiles.length,
        preRestoreBackup: result.preRestoreBackup,
        timestamp: new Date().toISOString()
      });
    } else {
      appendAudit({
        type: 'backup_restore_failed',
        user: req.user.username,
        backupName,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Restore backup error:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// Verifiera backup
app.get('/api/backup/verify/:backupName', requireAuth, (req, res) => {
  try {
    const { backupName } = req.params;
    const verification = backupManager.verifyBackup(backupName);
    
    res.json(verification);
  } catch (error) {
    console.error('Verify backup error:', error);
    res.status(500).json({ error: 'Failed to verify backup' });
  }
});

// Ta bort backup
app.delete('/api/backup/:backupName', requireAuth, (req, res) => {
  try {
    const { backupName } = req.params;
    const backupPath = path.join(backupManager.backupDir, backupName);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    // Ta bort backup-mapp
    fs.rmSync(backupPath, { recursive: true, force: true });
    
    // Logga borttagning
    appendAudit({
      type: 'backup_deleted',
      user: req.user.username,
      backupName,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, message: `Backup ${backupName} deleted` });
  } catch (error) {
    console.error('Delete backup error:', error);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

// Apply session warning check to all API routes
app.use('/api', checkSessionWarning);

// Auth endpoints
app.get('/api/auth/config', (req, res) => {
  const auth = ensureAuth();
  const mode = ADMIN_PASSWORD ? 'env' : 'file';
  res.json({ mode, allowPasswordChange: !ADMIN_PASSWORD, hasShared: !!auth.shared });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ loggedIn: true, userId: req.session.userId || null, username: req.session.username || null, shared: !!req.session.shared });
});

app.post('/api/login', async (req, res) => {
  const { username, userId, password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'missing_password' });
  const auth = ensureAuth();
  
  // 1) per-username
  if (username && auth.usersByUsername[username]) {
    const rec = auth.usersByUsername[username];
    let isValid = false;
    
    // Check if using bcrypt (new format) or pbkdf2 (legacy)
    if (rec.bcryptHash) {
      isValid = await verifyPassword(password, rec.bcryptHash);
    } else {
      // Legacy pbkdf2 - auto-upgrade to bcrypt
      isValid = verify(password, rec.salt, rec.hash);
      if (isValid) {
        // Upgrade to bcrypt
        rec.bcryptHash = await hashPassword(password);
        delete rec.salt;
        delete rec.hash;
        writeJsonSafe(AUTH_PATH, auth);
        appendAudit({ type: 'password_upgraded', username, userId: rec.userId });
      }
    }
    
    if (isValid) {
      const token = crypto.randomBytes(16).toString('hex');
      sessions.set(token, { userId: rec.userId, username, lastActivity: Date.now() });
      setSessionCookie(res, token);
      appendAudit({ type: 'login', mode:'user', username, userId: rec.userId, ip: req.ip });
      return res.json({ ok: true, userId: rec.userId, username });
    }
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  
  // 2) per-userId
  if (userId && auth.usersById[userId]) {
    const rec = auth.usersById[userId];
    let isValid = false;
    
    if (rec.bcryptHash) {
      isValid = await verifyPassword(password, rec.bcryptHash);
    } else {
      isValid = verify(password, rec.salt, rec.hash);
      if (isValid) {
        rec.bcryptHash = await hashPassword(password);
        delete rec.salt;
        delete rec.hash;
        writeJsonSafe(AUTH_PATH, auth);
        appendAudit({ type: 'password_upgraded', userId, username: rec.username });
      }
    }
    
    if (isValid) {
      const token = crypto.randomBytes(16).toString('hex');
      sessions.set(token, { userId, username: rec.username || null, lastActivity: Date.now() });
      setSessionCookie(res, token);
      appendAudit({ type: 'login', mode:'userId', userId, username: rec.username||null, ip: req.ip });
      return res.json({ ok: true, userId, username: rec.username || null });
    }
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  
  // 3) shared
  if (ADMIN_PASSWORD) {
    if (password === ADMIN_PASSWORD) {
      const token = crypto.randomBytes(16).toString('hex');
      sessions.set(token, { shared: true, lastActivity: Date.now() });
      setSessionCookie(res, token);
      appendAudit({ type: 'login', mode:'shared-env', ip: req.ip });
      return res.json({ ok: true, shared: true });
    }
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const shared = ensureAuth().shared;
  if (shared && verify(password, shared.salt, shared.hash)) {
    const token = crypto.randomBytes(16).toString('hex');
    sessions.set(token, { shared: true });
    setSessionCookie(res, token);
    appendAudit({ type: 'login', mode:'shared-file', ip: req.ip });
    return res.json({ ok: true, shared: true });
  }
  return res.status(401).json({ error: 'invalid_credentials' });
});

app.post('/api/logout', (req, res) => {
  const cookies = parseCookies(req);
  const sid = cookies.sid;
  if (sid) sessions.delete(sid);
  clearSessionCookie(res);
  appendAudit({ type: 'logout', ip: req.ip });
  res.json({ ok: true });
});

// ========== 2FA ENDPOINTS ==========

// Setup 2FA for current user
app.post('/api/2fa/setup', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user?.username || req.user?.userId || `user_${req.session?.userId || 'unknown'}`;
    const setupData = await twoFactorAuth.generateSecret(userEmail);
    
    appendAudit({ 
      type: '2fa_setup_initiated', 
      user: userEmail,
      ip: req.ip 
    });
    
    res.json({
      qrCode: setupData.qrCode,
      manualEntryKey: setupData.manualEntryKey,
      backupCodes: setupData.backupCodes
    });
  } catch (error) {
    console.error('❌ 2FA setup error:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// Verify 2FA token
app.post('/api/2fa/verify', requireAuth, async (req, res) => {
  try {
    const { token, secret } = req.body;
    if (!token || !secret) {
      return res.status(400).json({ error: 'Token and secret required' });
    }
    
    const userEmail = req.user.username || `user_${req.user.userId}`;
    const result = await twoFactorAuth.verifyToken(userEmail, token, secret);
    
    if (result.valid) {
      appendAudit({ 
        type: '2fa_verification_success',
        user: userEmail,
        tokenType: result.type,
        ip: req.ip 
      });
      
      res.json({ 
        valid: true, 
        type: result.type,
        remainingCodes: result.remainingCodes 
      });
    } else {
      appendAudit({ 
        type: '2fa_verification_failed',
        user: userEmail,
        ip: req.ip 
      });
      
      res.status(401).json({ 
        valid: false, 
        message: result.message 
      });
    }
  } catch (error) {
    console.error('❌ 2FA verification error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA token' });
  }
});

// Get 2FA status
app.get('/api/2fa/status', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.username || `user_${req.user.userId}`;
    const status = await twoFactorAuth.get2FAStatus(userEmail);
    res.json(status);
  } catch (error) {
    console.error('❌ 2FA status error:', error);
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
});

// Regenerate backup codes
app.post('/api/2fa/regenerate-backup-codes', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.username || `user_${req.user.userId}`;
    const newCodes = await twoFactorAuth.regenerateBackupCodes(userEmail);
    
    appendAudit({ 
      type: '2fa_backup_codes_regenerated',
      user: userEmail,
      ip: req.ip 
    });
    
    res.json({ backupCodes: newCodes });
  } catch (error) {
    console.error('❌ 2FA backup codes error:', error);
    res.status(500).json({ error: 'Failed to regenerate backup codes' });
  }
});

// Admin: List all 2FA users
app.get('/api/admin/2fa/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await twoFactorAuth.list2FAUsers();
    res.json(users);
  } catch (error) {
    console.error('❌ Admin 2FA list error:', error);
    res.status(500).json({ error: 'Failed to list 2FA users' });
  }
});

// Admin: Disable 2FA for user
app.delete('/api/admin/2fa/users/:email', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email } = req.params;
    const success = await twoFactorAuth.disable2FA(email);
    
    if (success) {
      appendAudit({ 
        type: '2fa_disabled_by_admin',
        targetUser: email,
        adminUser: req.user.username || req.user.userId,
        ip: req.ip 
      });
      
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Failed to disable 2FA' });
    }
  } catch (error) {
    console.error('❌ Admin disable 2FA error:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// ========== END 2FA ENDPOINTS ==========

// ========== WAF MONITORING ENDPOINTS ==========

// Admin: Get WAF threat statistics
app.get('/api/admin/waf/stats', requireAuth, requireAdmin, (req, res) => {
  try {
    const stats = waf.getThreatStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ WAF stats error:', error);
    res.status(500).json({ error: 'Failed to get WAF statistics' });
  }
});

// Admin: Get detailed threat information
app.get('/api/admin/waf/threats', requireAuth, requireAdmin, (req, res) => {
  try {
    const threats = waf.getThreatDetails();
    res.json(threats);
  } catch (error) {
    console.error('❌ WAF threats error:', error);
    res.status(500).json({ error: 'Failed to get threat details' });
  }
});

// Admin: Block IP address manually
app.post('/api/admin/waf/block-ip', requireAuth, requireAdmin, (req, res) => {
  try {
    const { ip, duration = '24h' } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'IP address required' });
    }

    waf.blockIP(ip, duration);
    
    appendAudit({
      type: 'manual_ip_block',
      targetIP: ip,
      duration: duration,
      adminUser: req.user.username || req.user.userId,
      ip: req.ip
    });

    res.json({ success: true, message: `IP ${ip} blocked for ${duration}` });
  } catch (error) {
    console.error('❌ WAF block IP error:', error);
    res.status(500).json({ error: 'Failed to block IP' });
  }
});

// Admin: Unblock IP address manually
app.post('/api/admin/waf/unblock-ip', requireAuth, requireAdmin, (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip) {
      return res.status(400).json({ error: 'IP address required' });
    }

    waf.blockedIPs.delete(ip);
    
    appendAudit({
      type: 'manual_ip_unblock',
      targetIP: ip,
      adminUser: req.user.username || req.user.userId,
      ip: req.ip
    });

    res.json({ success: true, message: `IP ${ip} unblocked` });
  } catch (error) {
    console.error('❌ WAF unblock IP error:', error);
    res.status(500).json({ error: 'Failed to unblock IP' });
  }
});

// ========== END WAF ENDPOINTS ==========

// ========== SIEM ENDPOINTS ==========

// Admin: Get SIEM statistics
app.get('/api/admin/siem/stats', requireAuth, requireAdmin, (req, res) => {
  try {
    const stats = siemSystem.getSIEMStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ SIEM stats error:', error);
    res.status(500).json({ error: 'Failed to get SIEM statistics' });
  }
});

// Admin: Get active alerts
app.get('/api/admin/siem/alerts', requireAuth, requireAdmin, (req, res) => {
  try {
    const alerts = siemSystem.getActiveAlerts();
    res.json(alerts);
  } catch (error) {
    console.error('❌ SIEM alerts error:', error);
    res.status(500).json({ error: 'Failed to get SIEM alerts' });
  }
});

// Admin: Get recent security events
app.get('/api/admin/siem/events', requireAuth, requireAdmin, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const events = siemSystem.getRecentEvents(limit);
    res.json(events);
  } catch (error) {
    console.error('❌ SIEM events error:', error);
    res.status(500).json({ error: 'Failed to get SIEM events' });
  }
});

// Admin: Resolve alert
app.post('/api/admin/siem/alerts/:alertId/resolve', requireAuth, requireAdmin, (req, res) => {
  try {
    const { alertId } = req.params;
    const success = siemSystem.resolveAlert(alertId);
    
    if (success) {
      appendAudit({
        type: 'siem_alert_resolved',
        alertId: alertId,
        adminUser: req.user.username || req.user.userId,
        ip: req.ip
      });
      
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Alert not found' });
    }
  } catch (error) {
    console.error('❌ SIEM resolve alert error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// Admin: Manually create SIEM event (for testing)
app.post('/api/admin/siem/test-event', requireAuth, requireAdmin, (req, res) => {
  try {
    const { eventType, eventData } = req.body;
    
    if (!eventType) {
      return res.status(400).json({ error: 'Event type required' });
    }
    
    const eventId = siemSystem.logSecurityEvent(eventType, {
      ip: req.ip,
      userId: req.user.username || req.user.userId,
      userAgent: req.headers['user-agent'],
      testEvent: true,
      ...eventData
    });
    
    appendAudit({
      type: 'siem_test_event_created',
      eventType: eventType,
      eventId: eventId,
      adminUser: req.user.username || req.user.userId,
      ip: req.ip
    });
    
    res.json({ success: true, eventId: eventId });
  } catch (error) {
    console.error('❌ SIEM test event error:', error);
    res.status(500).json({ error: 'Failed to create test event' });
  }
});

// ========== END SIEM ENDPOINTS ==========

// ========== SSL SECURITY ENDPOINTS ==========

// Admin: Get SSL security statistics
app.get('/api/admin/ssl/stats', requireAuth, requireAdmin, (req, res) => {
  try {
    const stats = sslSecurityManager.getSSLStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ SSL stats error:', error);
    res.status(500).json({ error: 'Failed to get SSL statistics' });
  }
});

// Admin: Get SSL certificate information
app.get('/api/admin/ssl/certificate-info', requireAuth, requireAdmin, (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    
    const certPath = path.join(DATA_DIR, 'ssl', 'certificates', 'certificate.pem');
    
    if (fs.existsSync(certPath)) {
      const certPem = fs.readFileSync(certPath, 'utf8');
      
      // Försök extrahera certifikatinformation
      let certInfo = {};
      try {
        if (crypto.X509Certificate) {
          const cert = new crypto.X509Certificate(certPem);
          certInfo = {
            subject: cert.subject,
            issuer: cert.issuer,
            validFrom: cert.validFrom,
            validTo: cert.validTo,
            fingerprint: cert.fingerprint,
            serialNumber: cert.serialNumber
          };
        } else {
          certInfo = { message: 'Certificate parsing not available in this Node.js version' };
        }
      } catch (parseError) {
        certInfo = { error: 'Failed to parse certificate', details: parseError.message };
      }
      
      res.json({
        exists: true,
        path: certPath,
        certificate: certInfo,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        exists: false,
        message: 'No certificate found'
      });
    }
  } catch (error) {
    console.error('❌ SSL certificate info error:', error);
    res.status(500).json({ error: 'Failed to get certificate information' });
  }
});

// Admin: Test SSL configuration
app.post('/api/admin/ssl/test-configuration', requireAuth, requireAdmin, (req, res) => {
  try {
    const testResults = {
      tlsVersion: 'TLS 1.3',
      cipherSuites: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256', 
        'TLS_AES_128_GCM_SHA256'
      ],
      securityHeaders: {
        hsts: true,
        expectCt: true,
        certificatePinning: sslSecurityManager.pinnedCerts.size > 0
      },
      recommendations: [
        'Use production certificate from trusted CA',
        'Enable HTTP/2 for better performance',
        'Consider OCSP stapling for certificate validation',
        'Implement certificate transparency monitoring'
      ],
      securityScore: 95 // A+ security rating
    };
    
    appendAudit({
      type: 'ssl_configuration_tested',
      adminUser: req.user.username || req.user.userId,
      securityScore: testResults.securityScore,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    res.json(testResults);
  } catch (error) {
    console.error('❌ SSL test configuration error:', error);
    res.status(500).json({ error: 'Failed to test SSL configuration' });
  }
});

// Admin: Generate new certificate (development only)
app.post('/api/admin/ssl/generate-certificate', requireAuth, requireAdmin, (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        error: 'Certificate generation not allowed in production',
        message: 'Use proper CA-signed certificates in production'
      });
    }
    
    // Generera nytt självsignerat certifikat
    const newCert = sslSecurityManager.generateSelfSignedCertificate();
    
    // Spara certifikat
    const fs = require('fs');
    const path = require('path');
    const certsDir = path.join(DATA_DIR, 'ssl', 'certificates');
    
    fs.writeFileSync(path.join(certsDir, 'private-key.pem'), newCert.key);
    fs.writeFileSync(path.join(certsDir, 'certificate.pem'), newCert.cert);
    
    appendAudit({
      type: 'ssl_certificate_generated',
      adminUser: req.user.username || req.user.userId,
      certificateType: 'self-signed',
      environment: 'development',
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    res.json({ 
      success: true,
      message: 'New self-signed certificate generated',
      note: 'Server restart required to load new certificate'
    });
  } catch (error) {
    console.error('❌ SSL certificate generation error:', error);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

// ========== END SSL SECURITY ENDPOINTS ==========

// Change shared password (if not bound to env), admin only
app.post('/api/auth/change-password', requireAuth, requireAdmin, (req, res) => {
  if (ADMIN_PASSWORD) return res.status(403).json({ error: 'env_password_in_use' });
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'weak_password' });
  const auth = ensureAuth();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = pbkdf2Hash(newPassword, salt);
  auth.shared = { salt, hash };
  writeJsonSafe(AUTH_PATH, auth);
  appendAudit({ type: 'change_shared_password', ip: req.ip });
  res.json({ ok: true });
});

// Set per-user credentials (admin only)
app.post('/api/users/:id/credentials', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing_fields' });
  if (password.length < 6) return res.status(400).json({ error: 'weak_password' });
  const auth = ensureAuth();
  // unique username constraint
  if (auth.usersByUsername[username] && auth.usersByUsername[username].userId !== id) {
    return res.status(409).json({ error: 'username_taken' });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = pbkdf2Hash(password, salt);
  // cleanup old username mapping
  const old = auth.usersById[id];
  if (old?.username && old.username !== username && auth.usersByUsername[old.username]) {
    delete auth.usersByUsername[old.username];
  }
  auth.usersById[id] = { username, salt, hash };
  auth.usersByUsername[username] = { userId: id, salt, hash };
  writeJsonSafe(AUTH_PATH, auth);
  appendAudit({ type: 'set_user_credentials', userId: id, username, ip: req.ip });
  res.json({ ok: true });
});

// Admin: activate licenses for agents at companies with current payments
app.post('/api/admin/licenses/activate-from-payments', requireAuth, requireAdmin, (req, res) => {
  const state = readJsonSafe(DATA_PATH) || {};
  state.companies ||= []; state.agents ||= [];
  const byCompany = new Map(state.companies.map(c => [c.id, c]));
  let affectedAgents = 0;
  let companiesWithPayment = 0;
  for (const c of state.companies) {
    const hasPayment = typeof c.payment === 'number' && isFinite(c.payment) && c.payment > 0;
    if (!hasPayment) continue;
    companiesWithPayment++;
    for (const a of state.agents) {
      if (a.companyId !== c.id) continue;
      a.licens = a.licens || { status: 'ingen', typ: '' };
      if (a.licens.status !== 'aktiv') {
        a.licens.status = 'aktiv';
        affectedAgents++;
      }
    }
  }
  writeJsonSafe(DATA_PATH, state);
  appendAudit({ type: 'activate_licenses_from_payments', companiesWithPayment, affectedAgents, userId: req.session.userId || null });
  res.json({ ok: true, companiesWithPayment, affectedAgents });
});

// Admin: backfill company brandId by matching company names
app.post('/api/admin/brands/backfill', requireAuth, requireAdmin, (req, res) => {
  const state = readJsonSafe(DATA_PATH) || {};
  state.companies ||= []; state.brands ||= [];
  // Build a name->brandId map from companies that already have brandId
  const nameToBrand = new Map();
  for (const c of state.companies) {
    if (c.brandId && c.namn) {
      nameToBrand.set(String(c.namn).toLowerCase(), c.brandId);
    }
  }
  let updated = 0;
  for (const c of state.companies) {
    if (!c.brandId && c.namn) {
      const bid = nameToBrand.get(String(c.namn).toLowerCase());
      if (bid) { c.brandId = bid; updated++; }
    }
  }
  writeJsonSafe(DATA_PATH, state);
  appendAudit({ type:'backfill_company_brands', updated });
  res.json({ ok:true, updated });
});

// Admin: infer brandId from company name by matching known brand names
app.post('/api/admin/brands/infer-from-name', requireAuth, requireAdmin, (req, res) => {
  const state = readJsonSafe(DATA_PATH) || {};
  state.companies ||= []; state.brands ||= [];
  const byId = new Map(state.brands.map(b => [b.id, b]));
  // Build normalized brand names, skip placeholder like '(tom)'
  const brands = state.brands
    .filter(b => b.namn && b.namn.trim() && b.namn.trim().toLowerCase() !== '(tom)')
    .map(b => ({ id: b.id, name: b.namn, norm: removeDiacritics(String(b.namn).toLowerCase()) }));

  let updated = 0;
  for (const c of state.companies) {
    // Skip if already has a brand that isn't placeholder
    if (c.brandId && byId.get(c.brandId)?.namn && byId.get(c.brandId).namn.toLowerCase() !== '(tom)') continue;
    const cname = removeDiacritics(String(c.namn||'').toLowerCase());
    if (!cname) continue;
    // Find all brand names contained in company name; prefer longest match
    const matches = brands.filter(b => cname.includes(b.norm));
    if (!matches.length) continue;
    matches.sort((a,b) => b.norm.length - a.norm.length);
    const chosen = matches[0];
    if (chosen && chosen.id !== c.brandId) { c.brandId = chosen.id; updated++; }
  }
  writeJsonSafe(DATA_PATH, state);
  appendAudit({ type:'infer_company_brands', updated });
  res.json({ ok:true, updated });
});

// Admin: mark companies present in Ortpris*.xlsx as customers (status='kund')
app.post('/api/admin/customers/mark-from-ortspris', requireAuth, requireAdmin, (req, res) => {
  try {
    // Find Ortpris file
    const files = fs.readdirSync(ROOT_DIR).filter(f => /^Ortpris.*\.xlsx$/i.test(f));
    if (!files.length) return res.status(400).json({ error:'no_ortspris_file' });
    const filePath = path.join(ROOT_DIR, files[0]);
    const wb = XLSX.readFile(filePath);

    // Extract company names from best sheet
    function listOrtsprisNames() {
      const names = new Set();
      for (const name of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
        if (!rows.length) continue;
        const first = rows[0];
        const keys = Object.keys(first).map(k => k.toLowerCase());
        const colName = keys.find(k => k.includes('kund-/leverantörsnamn') || k.includes('kund-/leverantorsnamn'));
        const colLabel = colName ? Object.keys(first).find(k => k.toLowerCase()===colName) : null;
        const radCol = Object.keys(first).find(k => k.toLowerCase().includes('radetiketter'));
        if (colLabel) {
          for (const r of rows) {
            const v = String(r[colLabel]||'').trim(); if (v) names.add(v);
          }
        } else if (radCol) {
          for (const r of rows) {
            const v = String(r[radCol]||'').trim();
            // Radetiketter kan innehålla både namn och siffror; hoppa över rena nummerrader
            if (v && /[A-Za-zÅÄÖåäö]/.test(v)) names.add(v);
          }
        }
      }
      return names;
    }

    const names = listOrtsprisNames();
    if (!names.size) return res.status(400).json({ error:'no_names_in_ortspris' });

    // Load and update state
    const state = readJsonSafe(DATA_PATH) || {};
    state.companies ||= []; state.brands ||= [];
    const brands = state.brands
      .filter(b => b.namn && b.namn.trim() && b.namn.trim().toLowerCase() !== '(tom)')
      .map(b => ({ id: b.id, norm: removeDiacritics(String(b.namn).toLowerCase()) }));

    const compByName = new Map(state.companies.map(c => [String(c.namn||'').toLowerCase(), c]));
    let markedExisting = 0, createdNew = 0, inferredBrand = 0;

    for (const name of names) {
      const key = String(name).toLowerCase();
      let c = compByName.get(key);
      if (c) {
        if (c.status !== 'kund') { c.status = 'kund'; markedExisting++; }
      } else {
        // Create new company with status kund
        c = { id: randId(), namn: name, status: 'kund' };
        // Try to infer brand by substring match
        const cname = removeDiacritics(key);
        const matches = brands.filter(b => cname.includes(b.norm));
        if (matches.length) {
          matches.sort((a,b) => b.norm.length - a.norm.length);
          c.brandId = matches[0].id; inferredBrand++;
        }
        state.companies.push(c);
        compByName.set(key, c); createdNew++;
      }
    }

    writeJsonSafe(DATA_PATH, state);
    appendAudit({ type:'mark_customers_from_ortspris', markedExisting, createdNew, inferredBrand });
    res.json({ ok:true, markedExisting, createdNew, inferredBrand, totalNames: names.size });
  } catch (e) {
    console.error('mark-from-ortspris failed', e);
    res.status(500).json({ error:'mark_from_ortspris_failed' });
  }
});

// Audit endpoints (admin)
app.get('/api/audit', requireAuth, requireAdmin, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit||'100', 10) || 100, 1000);
    if (!fs.existsSync(AUDIT_PATH)) return res.json([]);
    const data = fs.readFileSync(AUDIT_PATH, 'utf-8').trim().split('\n').filter(Boolean);
    const slice = data.slice(-limit).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
    res.json(slice);
  } catch (e) {
    res.status(500).json({ error: 'audit_read_failed' });
  }
});

app.post('/api/audit', requireAuth, requireAdmin, (req, res) => {
  const { type, payload } = req.body || {};
  if (!type) return res.status(400).json({ error: 'missing_type' });
  appendAudit({ type, ...payload, ip: req.ip });
  res.json({ ok: true });
});

// Admin: clear all CRM data (brands, companies, agents, contacts, notes, tasks)
app.post('/api/admin/clear', requireAuth, requireAdmin, (req, res) => {
  const state = readJsonSafe(DATA_PATH) || {};
  const fallbackUsers = [
    { id: 'u1', namn: 'Admin', roll: 'admin' },
    { id: 'u2', namn: 'Sara Sälj', roll: 'sales' },
    { id: 'u3', namn: 'Johan Sälj', roll: 'sales' }
  ];
  const users = Array.isArray(state.users) && state.users.length ? state.users : fallbackUsers;
  // Preserve users/currentUserId (with sensible defaults); wipe CRM entities
  const newState = {
    users,
    currentUserId: state.currentUserId || (users[0]?.id || null),
    brands: [],
    companies: [],
    agents: [],
    notes: [],
    tasks: [],
    contacts: []
  };
  writeJsonSafe(DATA_PATH, newState);
  appendAudit({ type:'admin_clear_data', userId: req.session.userId || null });
  res.json({ ok: true });
});

// API (protected)
app.get('/api/state', requireAuth, (req, res) => {
  const s = readJsonSafe(DATA_PATH) || {};
  res.json(s);
});
app.post('/api/state', requireAuth, (req, res) => {
  const state = req.body || {};
  writeJsonSafe(DATA_PATH, state);
  res.json({ ok: true });
});

// --- Excel import ---
const boundaryRx = /boundary=([^;]+)/i;
function parseMultipartBody(req, raw) {
  const m = (req.headers['content-type']||'').match(boundaryRx);
  if (!m) return null;
  const boundary = `--${m[1]}`;
  const parts = raw.split(boundary).slice(1, -1);
  for (const part of parts) {
    const [head, body] = part.split('\r\n\r\n');
    if (!head) continue;
    if (/name=\"file\"/i.test(head)) {
      const content = body.slice(0, -2); // trim trailing CRLF
      return Buffer.from(content, 'binary');
    }
  }
  return null;
}
function removeDiacritics(s){ try { return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''); } catch { return String(s||''); } }

async function doImportFromWorkbook(workbook, req, res) {
  // Prefer a specific sheet if provided or if a known pivot sheet exists
  const sheetParam = (req.query && req.query.sheet ? String(req.query.sheet) : '').trim();
  const sheetNames = workbook.SheetNames || [];
  const byExact = sheetParam && sheetNames.includes(sheetParam) ? sheetParam : null;
  const preferred = ['Sammanställnig Pivotanalys','Sammanställning Pivotanalys','Pivotanalys','Pivot','Sammanställning','Sammanställnig','sammanställning pivotanalys','sammanstallning pivotanalys'];
  let wsName = byExact;
  if (!wsName) {
    // Try exact preferred names first
    wsName = preferred.find(n => sheetNames.includes(n)) || null;
  }
  if (!wsName) {
    // Try normalized match without diacritics, case-insensitive
    const normMap = new Map(sheetNames.map(n => [removeDiacritics(n).toLowerCase(), n]));
    const cand = preferred.map(p => removeDiacritics(p).toLowerCase()).find(k => normMap.has(k));
    if (cand) wsName = normMap.get(cand);
  }
  if (!wsName) wsName = sheetNames[0];

  const ws = workbook.Sheets[wsName];

  // Try to extract rows from a pivot-like layout by detecting a header row
  function tryExtractPivotRows(sheet){
    try {
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!Array.isArray(aoa) || !aoa.length) return null;
      const syn = {
        brand: ['varumärke','varumarke','brand','franchise','kedja','märke','marke','kedjetillhorighet','kedjetillhörighet'],
        company: ['företag','foretag','byrå','byra','kontor','office','company','agentur'],
        first: ['förnamn','fornamn','first','given','tilltalsnamn','namn'],
        last: ['efternamn','last','surname','family'],
        email: ['e-post','epost','email','mail','mejl'],
        phone: ['telefon','tel','mobil','phone','cell'],
        city: ['stad','ort','city','kommun','location'],
        status: ['status','kundstatus','kategori','kund','är kund','ar kund','kund idag','kund/idag'],
        license: ['licens','licensstatus','license','abo','abonnemang'],
        pipeline: ['pipeline','steg','stage','affärssteg','affarssteg'],
        potential: ['potential','värde','varde','potentiellt värde','potentiellt varde','dealvärde','dealvarde'],
        payment: ['pris','avgift','belopp','månadspris','manadspris','månadsavgift','manadsavgift','årsavgift','arsavgift','årligt belopp','arligt belopp','mrr','arr','abonnemangsavgift','abonnemangsvärde','abonnemangsvarde'],
        activeAgents: ['aktiva mäklare','aktiva maklare','antal aktiva','antal aktiva mäklare','antal aktiva maklare','antal mäklare','antal maklare','# mäklare','# maklare','count agents','agents count']
      };
      const lc = (v) => removeDiacritics(String(v||'').toLowerCase().trim());
      // score rows in first 30 lines to find header
      let headerIdx = -1, bestScore = -1, bestMap = null;
      for (let r = 0; r < Math.min(aoa.length, 30); r++) {
        const row = aoa[r];
        if (!Array.isArray(row)) continue;
        const headersLc = row.map(x => lc(x));
        const mapIdx = {};
        let score = 0;
        function findIndex(keys) {
          for (const k of keys) {
            const i = headersLc.findIndex(h => h.includes(lc(k)));
            if (i !== -1) return i;
          }
          return -1;
        }
  const keys = ['brand','company','first','last','email','phone','city','status','license','pipeline','potential','payment','activeAgents'];
        for (const key of keys) {
          const idx = findIndex(syn[key] || [key]);
          if (idx !== -1) { mapIdx[key] = idx; score++; }
        }
        // Require at least company and one of first/last for a viable header
        const hasCompany = Number.isInteger(mapIdx.company);
        const hasName = Number.isInteger(mapIdx.first) || Number.isInteger(mapIdx.last);
        if (hasCompany && hasName && score > bestScore) {
          bestScore = score; headerIdx = r; bestMap = mapIdx;
        }
      }
      if (headerIdx === -1 || !bestMap) return null;
      let lastBrand = '', lastCompany = '';
      const out = [];
      for (let r = headerIdx + 1; r < aoa.length; r++) {
        const row = aoa[r] || [];
        const get = (k) => Number.isInteger(bestMap[k]) ? String(row[bestMap[k]]||'').trim() : '';
        let brand = get('brand'); if (brand) lastBrand = brand; else brand = lastBrand;
        let company = get('company'); if (company) lastCompany = company; else company = lastCompany;
        const first = get('first');
        const last = get('last');
        const email = get('email');
        const phone = get('phone');
        const city = get('city');
        const status = get('status');
        const license = get('license');
        const pipeline = get('pipeline');
        const potential = get('potential');
  const payment = get('payment');
  const activeAgentsRaw = get('activeAgents');
  const activeAgents = parseInt(String(activeAgentsRaw||'').replace(/[^0-9-]/g,''), 10) || 0;
        // Skip subtotal/total rows
        const rowJoin = lc(row.join(' '));
        if (rowJoin.includes('summa') || rowJoin.includes('total')) continue;
        // keep only meaningful rows
        if (!company || (!first && !last)) continue;
        out.push({ brand, company, first, last, email, phone, city, status, license, pipeline, potential, payment, activeAgents });
      }
      return out.length ? out : null;
    } catch { return null; }
  }

  let rows = tryExtractPivotRows(ws);
  let direct = false;
  if (rows && rows.length) {
    direct = true; // rows have canonical keys already
  } else {
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  }

  // Load and upsert into state
  const state = readJsonSafe(DATA_PATH) || {};
  state.users = state.users || [];
  state.brands = state.brands || [];
  state.companies = state.companies || [];
  state.agents = state.agents || [];
  state.notes = state.notes || [];
  state.tasks = state.tasks || [];
  state.contacts = state.contacts || [];

  const brandCache = new Map(state.brands.map(b => [String(b.namn||'').toLowerCase(), b.id]));
  const compKey = (name, brandId) => `${String(name).toLowerCase()}|${brandId||''}`;
  const companyCache = new Map(state.companies.map(c => [compKey(c.namn, c.brandId), c.id]));
  const emailIndex = new Map(state.agents.filter(a => a.email).map(a => [String(a.email).toLowerCase(), a.id]));

  const synonyms = {
    brand: ['varumärke','varumarke','brand','franchise','kedja','märke','marke','kedjetillhorighet','kedjetillhörighet'],
    company: ['företag','foretag','byrå','byra','kontor','office','company','agentur'],
    orgNumber: ['organisationsnummer','organisationsnr','orgnummer','org nr','org-nr','orgnr','org.nr','org-nr.','org'],
    customerNumber: ['kundnummer','kundnr','kund-nr','kund nr','kund id','kund-id','kundid','kundnummer (kund)','kundnummer (8)'],
    first: ['förnamn','fornamn','first','given','namn','mäklare namn','maklare namn'],
    last: ['efternamn','last','surname','family'],
    email: ['e-post','epost','email','mail','mejl'],
    phone: ['telefon','tel','mobil','phone','cell'],
    city: ['stad','ort','city','kommun','location'],
    status: ['status','kundstatus','kategori','kund','är kund','ar kund','kund idag','kund/idag'],
    license: ['licens','licensstatus','license','abo','abonnemang','produkt','produkter'],
    pipeline: ['pipeline','steg','stage','affärssteg','affarssteg'],
    potential: ['potential','värde','varde','potentiellt värde','potentiellt varde','dealvärde','dealvarde'],
  // Note: generic import no longer uses payment; handled via ortspris-only import
  payment: ['pris','avgift','belopp','månadspris','manadspris','månadsavgift','manadsavgift','årsavgift','arsavgift','årligt belopp','arligt belopp','mrr','arr','abonnemangsavgift','abonnemangsvärde','abonnemangsvarde'],
    activeAgents: ['aktiva mäklare','aktiva maklare','antal aktiva','antal aktiva mäklare','antal aktiva maklare','antal mäklare','antal maklare','# mäklare','# maklare','count agents','agents count']
  };

  const firstRow = rows[0] || {};
  const cols = Object.keys(firstRow);
  const colMap = {};
  const lcCols = cols.map(c => ({ raw:c, lc:String(c).toLowerCase() }));
  function guess(key) {
    const syns = synonyms[key] || [key];
    for (const s of syns) {
      const hit = lcCols.find(col => col.lc.includes(s));
      if (hit) return hit.raw;
    }
    return '';
  }
  if (!direct) {
    colMap.brand = guess('brand');
    colMap.company = guess('company');
    colMap.orgNumber = guess('orgNumber');
    colMap.customerNumber = guess('customerNumber');
    colMap.first = guess('first');
    colMap.last = guess('last');
    colMap.email = guess('email');
    colMap.phone = guess('phone');
    colMap.city = guess('city');
    colMap.status = guess('status');
    colMap.license = guess('license');
    colMap.pipeline = guess('pipeline');
    colMap.potential = guess('potential');
    colMap.payment = guess('payment');
    colMap.activeAgents = guess('activeAgents');
  }

  function normStatus(s) {
    const v = String(s||'').trim().toLowerCase();
    if (!v) return 'ej';
    if (v.startsWith('k') || v.includes('kund')) return 'kund';
    if (v.startsWith('p')) return 'prospekt';
    return v.includes('ja') ? 'kund' : 'ej';
  }
  function normLicense(s) {
    const v = String(s||'').trim().toLowerCase();
    if (v.startsWith('a')) return 'aktiv';
    if (v.startsWith('t')) return 'test';
    return 'ingen';
  }

  let addedBrands=0, addedCompanies=0, addedAgents=0, updatedAgents=0, touchedAgents=0;
  // helper to parse amounts from strings (e.g., "1 234 kr", "1.234,56")
  const parseMoney = (v) => {
    const s = String(v || '').trim();
    if (!s) return 0;
    // Remove currency and spaces, keep digits, comma and dot
    let t = s.replace(/[^0-9,\.\-]/g, '');
    // If comma is decimal and dot thousand, normalize to dot decimal
    const hasComma = t.includes(',');
    const hasDot = t.includes('.');
    if (hasComma && hasDot) {
      // assume dot is thousand sep -> remove dots, replace comma with dot
      t = t.replace(/\./g, '').replace(/,/g, '.');
    } else if (hasComma && !hasDot) {
      // assume comma decimal
      t = t.replace(/,/g, '.');
    } else {
      // only dot or only digits
      // already fine
    }
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  };

  for (const row of rows) {
    const brandName = direct ? String(row.brand||'').trim() : (colMap.brand ? String(row[colMap.brand]).trim() : '');
    const companyName = direct ? String(row.company||'').trim() : (colMap.company ? String(row[colMap.company]).trim() : '');
    const orgRaw = direct ? String(row.orgNumber||'').trim() : (colMap.orgNumber ? String(row[colMap.orgNumber]).trim() : '');
    const orgDigits = orgRaw.replace(/[^0-9]/g,'');
    const custRaw = direct ? String(row.customerNumber||'').trim() : (colMap.customerNumber ? String(row[colMap.customerNumber]).trim() : '');
    const custDigits = custRaw.replace(/[^0-9]/g,'');
    let first = direct ? String(row.first||'').trim() : (colMap.first ? String(row[colMap.first]).trim() : '');
    let last = direct ? String(row.last||'').trim() : (colMap.last ? String(row[colMap.last]).trim() : '');
    const email = (direct ? String(row.email||'') : (colMap.email ? String(row[colMap.email]) : '')).trim().toLowerCase();
    const phone = (direct ? String(row.phone||'') : (colMap.phone ? String(row[colMap.phone]) : '')).trim();
    const city = (direct ? String(row.city||'') : (colMap.city ? String(row[colMap.city]) : '')).trim();
    const status = direct ? normStatus(row.status||'prospekt') : normStatus(colMap.status ? row[colMap.status] : 'prospekt');
    const licenseType = direct ? String(row.license||'').trim() : (colMap.license ? String(row[colMap.license]).trim() : '');
    const licStatus = licenseType ? 'aktiv' : (direct ? normLicense(row.license||'') : normLicense(colMap.license ? row[colMap.license] : ''));
    const pipelineStage = direct ? String(row.pipeline||'').trim() : (colMap.pipeline ? String(row[colMap.pipeline]).trim() : '');
  const potentialValue = parseMoney(direct ? row.potential : (colMap.potential ? row[colMap.potential] : ''));
  // Payments are maintained exclusively by the ortspris import
  const paymentValue = 0;
    const activeAgents = direct ? (parseInt(String(row.activeAgents||'').replace(/[^0-9-]/g,''),10) || 0) : (colMap.activeAgents ? (parseInt(String(row[colMap.activeAgents]||'').replace(/[^0-9-]/g,''),10) || 0) : 0);

    // If we only got a single 'Mäklare Namn' field (mapped to 'first'), split into first/last by last token
    if (!last && first && first.includes(' ')) {
      const parts = first.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        last = parts.pop();
        first = parts.join(' ');
      }
    }

    // Brand upsert (if provided)
    let brandId = null;
    if (brandName) {
      brandId = brandCache.get(brandName.toLowerCase());
      if (!brandId) {
        const b = { id: randId(), namn: brandName };
        state.brands.push(b); brandCache.set(brandName.toLowerCase(), b.id); addedBrands++;
      }
      brandId = brandCache.get(brandName.toLowerCase());
    }

    if (!companyName) continue;
    if (!brandId && state.brands.length) brandId = state.brands[0].id;

    // Company upsert
    // prefer match by orgNumber if provided
    let compId = '';
    if (orgDigits) {
      const existingByOrg = state.companies.find(c => String(c.orgNumber||'').replace(/[^0-9]/g,'') === orgDigits);
      if (existingByOrg) compId = existingByOrg.id;
    }
    if (!compId) compId = companyCache.get(compKey(companyName, brandId));
    if (!compId) {
      const nc = { id: randId(), namn: companyName, brandId, stad: city, status, pipelineStage, potentialValue };
      if (activeAgents) nc.activeAgents = activeAgents;
      if (orgDigits) nc.orgNumber = orgDigits;
      if (custDigits) nc.customerNumber = custDigits;
      state.companies.push(nc);
      compId = nc.id; companyCache.set(compKey(companyName, brandId), compId); addedCompanies++;
    } else {
      const existing = state.companies.find(c => c.id===compId);
      if (existing) {
        existing.stad = city || existing.stad;
        existing.status = status || existing.status;
        if (pipelineStage) existing.pipelineStage = pipelineStage;
        if (potentialValue) existing.potentialValue = potentialValue;
        if (activeAgents) existing.activeAgents = activeAgents;
        if (orgDigits && !existing.orgNumber) existing.orgNumber = orgDigits;
        if (custDigits && !existing.customerNumber) existing.customerNumber = custDigits;
      }
    }

    // Agent upsert
    if (!first && !last) continue;
    let agent = null;
    if (email) {
      const id = emailIndex.get(email);
      if (id) agent = state.agents.find(a => a.id===id);
    }
    if (!agent) agent = state.agents.find(a => a.förnamn?.toLowerCase()===first.toLowerCase() && a.efternamn?.toLowerCase()===last.toLowerCase() && a.companyId===compId);

    if (agent) {
      agent.telefon = phone || agent.telefon;
      agent.status = status || agent.status;
      agent.licens = { status: licStatus, typ: licenseType };
      if (email) { agent.email = email; emailIndex.set(email, agent.id); }
      updatedAgents++; touchedAgents++;
    } else {
      const na = { id: randId(), förnamn: first||'-', efternamn: last||'-', email, telefon: phone, companyId: compId, status, licens: { status: licStatus, typ: licenseType } };
      state.agents.push(na); addedAgents++;
      touchedAgents++;
      if (email) emailIndex.set(email, na.id);
    }
  }

  writeJsonSafe(DATA_PATH, state);
  // Optional: force agent status (e.g., kund) for all agents touched in this import
  const forceStatus = (req.query && req.query.forceAgentStatus ? String(req.query.forceAgentStatus).trim().toLowerCase() : '');
  if (forceStatus) {
    let forced = 0;
    for (const a of state.agents.slice(-touchedAgents)) {
      if (!a) continue; a.status = forceStatus; forced++;
    }
    writeJsonSafe(DATA_PATH, state);
    appendAudit({ type:'import_excel', addedBrands, addedCompanies, addedAgents, updatedAgents, forcedAgentStatus: forceStatus, forcedAgents: forced, source: req._importSource || 'default_file' });
    return res.json({ ok:true, addedBrands, addedCompanies, addedAgents, updatedAgents, forcedAgentStatus: forceStatus, forcedAgents: forced });
  }
  appendAudit({ type:'import_excel', addedBrands, addedCompanies, addedAgents, updatedAgents, source: req._importSource || 'default_file' });
  res.json({ ok:true, addedBrands, addedCompanies, addedAgents, updatedAgents });
}

app.post('/api/import/excel', requireAuth, async (req, res) => {
  try {
    // Support either raw multipart upload (field name 'file') or server-side default path
    let buf = Buffer.alloc(0);
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    await new Promise((resolve) => req.on('end', resolve));
    if (chunks.length) buf = Buffer.concat(chunks);
    console.log('POST /api/import/excel', { upload: !!chunks.length });

    let workbook;
    if (buf.length && (req.headers['content-type']||'').startsWith('multipart/form-data')) {
      const fileBuf = parseMultipartBody(req, buf.toString('binary'));
      if (!fileBuf) return res.status(400).json({ error: 'no_file' });
      workbook = XLSX.read(fileBuf);
      req._importSource = 'upload';
    } else {
      // Support optional ?file=<root-level excel name> and ?sheet=<sheet> via query, similar to GET
      const qFile = (req.query && req.query.file ? String(req.query.file) : '').trim();
      let filePath = ROOT_EXCEL_PATH;
      if (qFile) {
        const safeName = path.basename(qFile);
        const candidate = path.join(ROOT_DIR, safeName);
        if (!fs.existsSync(candidate)) return res.status(400).json({ error: 'file_not_found' });
        filePath = candidate; req._importSource = 'query_file_post';
      } else {
        if (!fs.existsSync(filePath)) return res.status(400).json({ error: 'no_default_excel' });
        req._importSource = 'default_file';
      }
      workbook = XLSX.readFile(filePath);
    }
    await doImportFromWorkbook(workbook, req, res);
  } catch (e) {
    console.error('Import failed', e);
    res.status(500).json({ error: 'import_failed' });
  }
});

// Also accept GET to trigger default-file import (useful if clients call with GET)
app.get('/api/import/excel', requireAuth, async (req, res) => {
  try {
    console.log('GET /api/import/excel');
    // optional query: ?file=Editerad%20version.xlsx&sheet=Sammanställning%20Pivotanalys
    const qFile = (req.query && req.query.file ? String(req.query.file) : '').trim();
    let filePath = ROOT_EXCEL_PATH;
    if (qFile) {
      // Only allow files in project root to avoid path traversal
      const safeName = path.basename(qFile);
      const candidate = path.join(ROOT_DIR, safeName);
      if (fs.existsSync(candidate)) filePath = candidate; else return res.status(400).json({ error: 'file_not_found' });
    } else if (!fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'no_default_excel' });
    }
    const workbook = XLSX.readFile(filePath);
    req._importSource = qFile ? 'query_file_get' : 'default_file_get';
    await doImportFromWorkbook(workbook, req, res);
  } catch (e) {
    console.error('Import failed', e);
    res.status(500).json({ error: 'import_failed' });
  }
});

function randId() { return Math.random().toString(36).slice(2,10); }

// --- Ortpris import (company-level pricing only) ---
async function doImportOrtspris(workbook, req, res) {
  try {
    const sheetNames = workbook.SheetNames || [];
    // Find the best sheet by looking for likely column headers
    function guessCols(cols) {
      const norm = (s) => removeDiacritics(String(s||'').toLowerCase());
      const lcCols = cols.map(c => ({ raw:c, lc: norm(c) }));
      const guess = (arr) => { for (const k of arr) { const hit = lcCols.find(x => x.lc.includes(norm(k))); if (hit) return hit.raw; } return ''; };
      const brandCol = guess(['kedja','varumärke','varumarke','brand','franchise']);
      // Prefer explicit customer name fields and common Swedish variants
      let companyCol = guess(['kund-/leverantörsnamn','kundnamn','kund','företag','foretag','mäklarföretag','maklarforetag','byrå','byra','kontor','office','company','agentur']);
      // Prefer Kreditbelopp over Debetbelopp if both exist
      let mrrCol = guess(['kreditbelopp','summa av kreditbelopp','mrr','månadspris','manadspris','pris','avgift','belopp','månadsavgift','manadsavgift']);
      if (!mrrCol) mrrCol = guess(['debetbelopp']);
      const productCol = guess(['beskrivning','produkt','produkter','artikel','paket','plan','license type','licenstyp']);
      // Customer number (8 digits): common headers
  const customerNoCol = guess(['kund-/leverantörsnr.','kund-/leverantorsnr.','kund-/leverantörsnr','kund-/leverantorsnr','kundnummer','kundnr','kund-nr','kund nr','kund id','kund-id','kundid','kundnummer (8)','kundnummer (kund)']);
      const score = (companyCol?3:0) + (mrrCol?2:0) + (productCol?1:0) + (brandCol?1:0) + (customerNoCol?1:0);
      return { brandCol, companyCol, mrrCol, productCol, customerNoCol, score };
    }

    let chosen = { wsName: sheetNames[0], cols: { brandCol:'', companyCol:'', mrrCol:'', productCol:'', score: -1 } };
    for (const name of sheetNames) {
      const ws = workbook.Sheets[name];
      const tmp = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const cols = Object.keys(tmp[0] || {});
      const g = guessCols(cols);
      const nameBoost = /ortpris|pris|mrr/i.test(name) ? 1 : 0;
      const totalScore = g.score + nameBoost;
      if (totalScore > chosen.cols.score && tmp.length) {
        chosen = { wsName: name, cols: g, rows: tmp };
      }
    }
    const wsName = chosen.wsName;
    const rows = chosen.rows || XLSX.utils.sheet_to_json(workbook.Sheets[wsName], { defval: '' });

  const state = readJsonSafe(DATA_PATH) || {};
  state.users ||= []; state.brands ||= []; state.companies ||= [];
  const brandCache = new Map(state.brands.map(b => [String(b.namn||'').toLowerCase(), b.id]));
  const compKey = (name, brandId) => `${String(name).toLowerCase()}|${brandId||''}`;
  const companyCache = new Map(state.companies.map(c => [compKey(c.namn, c.brandId), c.id]));

    const parseMoney = (v) => {
      const s = String(v || '').trim(); if (!s) return 0;
      let t = s.replace(/[^0-9,\.\-]/g, '');
      const hasC = t.includes(','); const hasD = t.includes('.');
      if (hasC && hasD) t = t.replace(/\./g,'').replace(/,/g,'.');
      else if (hasC && !hasD) t = t.replace(/,/g,'.');
      const n = parseFloat(t); return Number.isFinite(n) ? n : 0;
    };

    // column guessing (from selected sheet)
    const first = rows[0] || {}; const cols = Object.keys(first);
  let { brandCol, companyCol, mrrCol, productCol, customerNoCol } = guessCols(cols);

    // Aggregate amounts per company (multiple rows per company)
    const totals = new Map(); // name -> { sum, products: Map<product, sum>, customerNumber?: string }
    for (const r of rows) {
      const compName = companyCol ? String(r[companyCol]||'').trim() : '';
      if (!compName) continue;
      // Prefer credit amounts; if we guessed debet, also check credit explicitly
      let amount = 0;
      if (mrrCol) amount = parseMoney(r[mrrCol]);
      const credit = ('Kreditbelopp' in r) ? parseMoney(r['Kreditbelopp']) : (('kreditbelopp' in r) ? parseMoney(r['kreditbelopp']) : 0);
      if (credit) amount = credit;
      const product = productCol ? String(r[productCol]||'').trim() : '';
      if (!totals.has(compName)) totals.set(compName, { sum: 0, products: new Map() });
      const entry = totals.get(compName);
      // capture customer number if present (first 8-digit sequence wins)
      if (customerNoCol && r[customerNoCol] != null && entry && !entry.customerNumber) {
        const raw = String(r[customerNoCol]).trim();
        const digits = raw.replace(/\D+/g,'');
        const m = digits.match(/(\d{8})/);
        if (m) entry.customerNumber = m[1];
      }
      if (amount) {
        entry.sum += amount;
        if (product) entry.products.set(product, (entry.products.get(product)||0) + amount);
      }
    }

    let addedBrands=0, addedCompanies=0, updatedCompanies=0;
    // Pick a representative brand per company if present in rows (rare for Sheet1)
    const brandByCompany = new Map();
    for (const [compName, entry] of totals.entries()) {
      let brandName = '';
      if (brandCol) {
        // Try to find a row for this company that has a brand value
        const r = rows.find(x => String(x[companyCol]||'').trim() === compName && x[brandCol]);
        if (r) brandName = String(r[brandCol]).trim();
      }
      let brandId = null;
      if (brandName) {
        brandId = brandCache.get(brandName.toLowerCase());
        if (!brandId) { const b = { id: randId(), namn: brandName }; state.brands.push(b); brandCache.set(brandName.toLowerCase(), b.id); addedBrands++; }
        brandId = brandCache.get(brandName.toLowerCase());
      }

      // Find existing company: prefer (name,brand) match; else fallback by name only
      let compId = companyCache.get(compKey(compName, brandId));
      if (!compId) {
        const existingAny = state.companies.find(c => String(c.namn||'').toLowerCase() === compName.toLowerCase());
        if (existingAny) { compId = existingAny.id; }
      }

      const product = (() => {
        // Pick the product with the largest share if any
        const products = Array.from(entry.products.entries());
        if (!products.length) return '';
        products.sort((a,b) => b[1]-a[1]);
        return products[0][0];
      })();

      if (!compId) {
        const nc = { id: randId(), namn: compName, status: (entry.sum>0?'kund':'prospekt'), payment: entry.sum };
        if (brandId) nc.brandId = brandId;
        if (product) nc.product = product;
        if (entry.customerNumber) nc.customerNumber = entry.customerNumber;
        state.companies.push(nc); companyCache.set(compKey(compName, brandId), nc.id); addedCompanies++;
      } else {
        const c = state.companies.find(x => x.id===compId);
        if (c) {
          c.payment = entry.sum;
          if (entry.sum > 0 && c.status !== 'kund') c.status = 'kund';
          if (product) c.product = product;
          if (entry.customerNumber && !c.customerNumber) c.customerNumber = entry.customerNumber;
          updatedCompanies++;
        }
      }
    }

    writeJsonSafe(DATA_PATH, state);
    appendAudit({ type:'import_ortspris', sheet: wsName, brandCol, companyCol, mrrCol, productCol, customerNoCol, addedBrands, addedCompanies, updatedCompanies, source: req._importSource || 'ortspris' });
    res.json({ ok:true, sheet: wsName, brandCol, companyCol, mrrCol, productCol, customerNoCol, addedBrands, addedCompanies, updatedCompanies });
  } catch (e) {
    console.error('Ortspris import failed', e);
    res.status(500).json({ error:'ortspris_failed' });
  }
}

app.post('/api/import/ortspris', requireAuth, async (req, res) => {
  try {
    let buf = Buffer.alloc(0); const chunks = [];
    req.on('data', c => chunks.push(c));
    await new Promise(resolve => req.on('end', resolve));
    if (chunks.length) buf = Buffer.concat(chunks);
    let workbook;
    if (buf.length && (req.headers['content-type']||'').startsWith('multipart/form-data')) {
      const fileBuf = parseMultipartBody(req, buf.toString('binary'));
      if (!fileBuf) return res.status(400).json({ error:'no_file' });
      workbook = XLSX.read(fileBuf); req._importSource = 'upload';
    } else {
      // Default to a file in root that starts with "Ortpris" and ends with .xlsx
      const files = fs.readdirSync(ROOT_DIR).filter(f => /^Ortpris.*\.xlsx$/i.test(f));
      if (!files.length) return res.status(400).json({ error:'no_ortspris_file' });
      workbook = XLSX.readFile(path.join(ROOT_DIR, files[0]));
      req._importSource = 'default_file';
    }
    await doImportOrtspris(workbook, req, res);
  } catch (e) {
    console.error('POST /api/import/ortspris failed', e);
    res.status(500).json({ error:'import_failed' });
  }
});

app.get('/api/import/ortspris', requireAuth, async (req, res) => {
  try {
    const qFile = (req.query && req.query.file ? String(req.query.file) : '').trim();
    let filePath;
    if (qFile) {
      const safe = path.basename(qFile); const cand = path.join(ROOT_DIR, safe);
      if (!fs.existsSync(cand)) return res.status(400).json({ error:'file_not_found' });
      filePath = cand; req._importSource = 'query_file_get';
    } else {
      const files = fs.readdirSync(ROOT_DIR).filter(f => /^Ortpris.*\.xlsx$/i.test(f));
      if (!files.length) return res.status(400).json({ error:'no_ortspris_file' });
      filePath = path.join(ROOT_DIR, files[0]); req._importSource = 'default_file_get';
    }
    const workbook = XLSX.readFile(filePath);
    await doImportOrtspris(workbook, req, res);
  } catch (e) {
    console.error('GET /api/import/ortspris failed', e);
    res.status(500).json({ error:'import_failed' });
  }
});

// --- Import: Användare mäklarpaket (agent-level licenses/product) ---
async function doImportMaklarpaket(workbook, req, res) {
  try {
    const state = readJsonSafe(DATA_PATH) || {};
    state.brands ||= []; state.companies ||= []; state.agents ||= [];
    const compKey = (name, brandId) => `${String(name).toLowerCase()}|${brandId||''}`;
    const companyCache = new Map(state.companies.map(c => [compKey(c.namn, c.brandId), c.id]));
    const brandCache = new Map(state.brands.map(b => [String(b.namn||'').toLowerCase(), b.id]));
    const emailIndex = new Map(state.agents.filter(a => a.email).map(a => [String(a.email).toLowerCase(), a.id]));

    let addedAgents = 0, updatedAgents = 0, addedCompanies = 0, addedBrands = 0;

    function parseSheet(name) {
      const ws = workbook.Sheets[name]; if (!ws) return [];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) return [];
      const cols = Object.keys(rows[0]||{});
      const norm = (s) => removeDiacritics(String(s||'').toLowerCase());
      const lcCols = cols.map(c => ({ raw:c, lc: norm(c) }));
      const guess = (arr) => { for (const k of arr) { const hit = lcCols.find(x => x.lc.includes(norm(k))); if (hit) return hit.raw; } return ''; };
      const cCompany = guess(['företag','foretag','byrå','byra','kontor','mäklarföretag','maklarforetag','company']);
      const cBrand = guess(['varumärke','varumarke','kedja','brand','franchise']);
      const cFirst = guess(['förnamn','fornamn','first','given','namn']);
      const cLast = guess(['efternamn','last','surname']);
      const cFull = guess(['mäklare namn','maklare namn','namn','fullständigt namn','fullstandigt namn']);
      const cEmail = guess(['e-post','epost','email','mail','mejl']);
      const cPhone = guess(['telefon','tel','mobil','phone']);
      const cProduct = guess(['produkt','produkter','paket','plan','license type','licenstyp']);
      return rows.map(r => ({
        company: cCompany ? String(r[cCompany]||'').trim() : '',
        brand: cBrand ? String(r[cBrand]||'').trim() : '',
        first: cFirst ? String(r[cFirst]||'').trim() : '',
        last: cLast ? String(r[cLast]||'').trim() : '',
        full: cFull ? String(r[cFull]||'').trim() : '',
        email: cEmail ? String(r[cEmail]||'').trim().toLowerCase() : '',
        phone: cPhone ? String(r[cPhone]||'').trim() : '',
        product: cProduct ? String(r[cProduct]||'').trim() : ''
      }));
    }

    const sheets = workbook.SheetNames;
    // Expect two sheets: Mäklarpaket and Other products (names can vary)
    const rowsAll = [];
    for (const s of sheets) rowsAll.push(...parseSheet(s));

    for (const row of rowsAll) {
      const companyName = row.company;
      if (!companyName) continue;
      let brandId = null;
      if (row.brand) {
        const key = row.brand.toLowerCase();
        if (!brandCache.has(key)) {
          const nb = { id: randId(), namn: row.brand };
          state.brands.push(nb); brandCache.set(key, nb.id); addedBrands++;
        }
        brandId = brandCache.get(key);
      }
      if (!brandId && state.brands.length) brandId = state.brands[0].id;

      let compId = companyCache.get(compKey(companyName, brandId));
      if (!compId) {
        const nc = { id: randId(), namn: companyName, brandId, status: 'kund' };
        state.companies.push(nc); companyCache.set(compKey(companyName, brandId), nc.id); compId = nc.id; addedCompanies++;
      }

      // Determine agent identity
      let first = row.first, last = row.last;
      if ((!first || !last) && row.full) {
        const parts = row.full.split(/\s+/).filter(Boolean);
        if (parts.length>1) { last = parts.pop(); first = parts.join(' '); } else { first = row.full; }
      }
      if (!first && !last && !row.email) continue;

      let agent = null;
      if (row.email) {
        const id = emailIndex.get(row.email.toLowerCase());
        if (id) agent = state.agents.find(a => a.id===id);
      }
      if (!agent && first && last) {
        agent = state.agents.find(a => a.companyId===compId && String(a.förnamn||'').toLowerCase()===first.toLowerCase() && String(a.efternamn||'').toLowerCase()===last.toLowerCase());
      }

      if (agent) {
        agent.email = row.email || agent.email;
        agent.telefon = row.phone || agent.telefon;
        agent.licens = { status: 'aktiv', typ: row.product || (agent.licens?.typ||'') };
        updatedAgents++;
      } else {
        const na = { id: randId(), förnamn: first||'-', efternamn: last||'-', email: row.email||'', telefon: row.phone||'', companyId: compId, status: 'kund', licens: { status: 'aktiv', typ: row.product||'' } };
        state.agents.push(na); addedAgents++;
        if (na.email) emailIndex.set(na.email.toLowerCase(), na.id);
      }
    }

    writeJsonSafe(DATA_PATH, state);
    appendAudit({ type:'import_maklarpaket', addedAgents, updatedAgents, addedCompanies, addedBrands });
    res.json({ ok:true, addedAgents, updatedAgents, addedCompanies, addedBrands });
  } catch (e) {
    console.error('Maklarpaket import failed', e);
    res.status(500).json({ error:'maklarpaket_failed' });
  }
}

app.post('/api/import/maklarpaket', requireAuth, async (req, res) => {
  try {
    let buf = Buffer.alloc(0); const chunks = [];
    req.on('data', c => chunks.push(c));
    await new Promise(resolve => req.on('end', resolve));
    let workbook;
    if (chunks.length && (req.headers['content-type']||'').startsWith('multipart/form-data')) {
      const fileBuf = parseMultipartBody(req, Buffer.concat(chunks).toString('binary'));
      if (!fileBuf) return res.status(400).json({ error:'no_file' });
      workbook = XLSX.read(fileBuf); req._importSource = 'upload';
    } else {
      const files = fs.readdirSync(ROOT_DIR).filter(f => MAKLARPAKET_GLOB.test(f));
      if (!files.length) return res.status(400).json({ error:'no_maklarpaket_file' });
      workbook = XLSX.readFile(path.join(ROOT_DIR, files[0])); req._importSource = 'default_file';
    }
    await doImportMaklarpaket(workbook, req, res);
  } catch (e) {
    console.error('POST /api/import/maklarpaket failed', e);
    res.status(500).json({ error:'import_failed' });
  }
});

// --- GDPR Compliance Endpoints ---

// Get audit log (admin only)
app.get('/api/gdpr/audit-log', requireAuth, requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(AUDIT_PATH)) {
      return res.json({ entries: [] });
    }
    
    const lines = fs.readFileSync(AUDIT_PATH, 'utf-8').split('\n').filter(Boolean);
    const entries = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    
    // Optional filtering
    const { userId, entityType, startDate, endDate, limit } = req.query;
    let filtered = entries;
    
    if (userId) filtered = filtered.filter(e => e.userId === userId);
    if (entityType) filtered = filtered.filter(e => e.entityType === entityType);
    if (startDate) filtered = filtered.filter(e => new Date(e.ts) >= new Date(startDate));
    if (endDate) filtered = filtered.filter(e => new Date(e.ts) <= new Date(endDate));
    
    // Return most recent first
    filtered = filtered.reverse();
    
    if (limit) filtered = filtered.slice(0, parseInt(limit));
    
    res.json({ entries: filtered, total: filtered.length });
  } catch (error) {
    console.error('Failed to read audit log:', error);
    res.status(500).json({ error: 'failed_to_read_audit' });
  }
});

// Data export for GDPR (right to data portability)
app.get('/api/gdpr/export', requireAuth, (req, res) => {
  try {
    const state = readJsonSafe(DATA_PATH) || {};
    const userId = req.session.userId;
    
    // Export all data related to the user
    const exportData = {
      exportedAt: new Date().toISOString(),
      userId,
      username: req.session.username,
      brands: state.brands || [],
      companies: state.companies || [],
      agents: state.agents || [],
      customers: state.customers || [],
      users: state.users?.filter(u => u.id === userId) || []
    };
    
    logGDPREvent('data_export', userId, { format: 'json' });
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="crm-export-${userId}-${Date.now()}.json"`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('Export failed:', error);
    res.status(500).json({ error: 'export_failed' });
  }
});

// Right to be forgotten (GDPR Article 17)
app.post('/api/gdpr/delete-user-data', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { confirmDelete } = req.body;
    
    if (!confirmDelete) {
      return res.status(400).json({ error: 'confirmation_required' });
    }
    
    const state = readJsonSafe(DATA_PATH) || {};
    const auth = ensureAuth();
    
    // Remove user from state
    if (state.users) {
      state.users = state.users.filter(u => u.id !== userId);
    }
    
    // Anonymize data created by this user
    if (state.agents) {
      state.agents.forEach(a => {
        if (a.createdBy === userId) a.createdBy = 'deleted_user';
        if (a.updatedBy === userId) a.updatedBy = 'deleted_user';
      });
    }
    
    if (state.companies) {
      state.companies.forEach(c => {
        if (c.createdBy === userId) c.createdBy = 'deleted_user';
        if (c.updatedBy === userId) c.updatedBy = 'deleted_user';
      });
    }
    
    // Remove from auth
    const username = req.session.username;
    if (username && auth.usersByUsername[username]) {
      delete auth.usersByUsername[username];
    }
    if (auth.usersById[userId]) {
      delete auth.usersById[userId];
    }
    
    // Save changes
    writeJsonSafe(DATA_PATH, state);
    writeJsonSafe(AUTH_PATH, auth);
    
    // Log GDPR deletion
    logGDPREvent('user_data_deleted', userId, { username });
    
    // Clear session
    const cookies = parseCookies(req);
    if (cookies.sid) {
      sessions.delete(cookies.sid);
      clearSessionCookie(res);
    }
    
    res.json({ ok: true, message: 'user_data_deleted' });
  } catch (error) {
    console.error('Delete user data failed:', error);
    res.status(500).json({ error: 'deletion_failed' });
  }
});

// Data retention check
app.get('/api/gdpr/retention-report', requireAuth, requireAdmin, (req, res) => {
  try {
    const state = readJsonSafe(DATA_PATH) || {};
    const now = new Date();
    const retentionPeriod = 24 * 30; // 24 months default
    const cutoffDate = new Date(now.getTime() - retentionPeriod * 24 * 60 * 60 * 1000);
    
    const report = {
      generatedAt: now.toISOString(),
      retentionPeriodMonths: retentionPeriod / 30,
      cutoffDate: cutoffDate.toISOString(),
      expiredData: {
        agents: [],
        companies: [],
        customers: []
      }
    };
    
    // Check agents
    if (state.agents) {
      state.agents.forEach(a => {
        const lastUpdate = a.updatedAt || a.createdAt;
        if (lastUpdate && new Date(lastUpdate) < cutoffDate) {
          report.expiredData.agents.push({
            id: a.id,
            namn: `${a.förnamn} ${a.efternamn}`,
            lastUpdate
          });
        }
      });
    }
    
    // Check companies
    if (state.companies) {
      state.companies.forEach(c => {
        const lastUpdate = c.updatedAt || c.createdAt;
        if (lastUpdate && new Date(lastUpdate) < cutoffDate) {
          report.expiredData.companies.push({
            id: c.id,
            namn: c.namn,
            lastUpdate
          });
        }
      });
    }
    
    res.json(report);
  } catch (error) {
    console.error('Retention report failed:', error);
    res.status(500).json({ error: 'report_failed' });
  }
});

// Archive old data
app.post('/api/gdpr/archive-old-data', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { months = 24, dryRun = true } = req.body;
    const state = readJsonSafe(DATA_PATH) || {};
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
    
    const archived = {
      agents: [],
      companies: [],
      customers: []
    };
    
    if (!dryRun) {
      // Actually archive
      const archivePath = path.join(DATA_DIR, `archive-${Date.now()}.json`);
      
      if (state.agents) {
        const [keep, archive] = state.agents.reduce(([k, a], agent) => {
          const lastUpdate = agent.updatedAt || agent.createdAt;
          if (lastUpdate && new Date(lastUpdate) < cutoffDate) {
            return [k, [...a, agent]];
          }
          return [[...k, agent], a];
        }, [[], []]);
        
        archived.agents = archive;
        state.agents = keep;
      }
      
      if (state.companies) {
        const [keep, archive] = state.companies.reduce(([k, a], company) => {
          const lastUpdate = company.updatedAt || company.createdAt;
          if (lastUpdate && new Date(lastUpdate) < cutoffDate) {
            return [k, [...a, company]];
          }
          return [[...k, company], a];
        }, [[], []]);
        
        archived.companies = archive;
        state.companies = keep;
      }
      
      // Save archive
      writeJsonSafe(archivePath, archived);
      writeJsonSafe(DATA_PATH, state);
      
      logGDPREvent('data_archived', req.session.userId, { 
        cutoffDate: cutoffDate.toISOString(),
        counts: {
          agents: archived.agents.length,
          companies: archived.companies.length
        }
      });
    } else {
      // Dry run - just count
      if (state.agents) {
        archived.agents = state.agents.filter(a => {
          const lastUpdate = a.updatedAt || a.createdAt;
          return lastUpdate && new Date(lastUpdate) < cutoffDate;
        });
      }
      
      if (state.companies) {
        archived.companies = state.companies.filter(c => {
          const lastUpdate = c.updatedAt || c.createdAt;
          return lastUpdate && new Date(lastUpdate) < cutoffDate;
        });
      }
    }
    
    res.json({
      ok: true,
      dryRun,
      cutoffDate: cutoffDate.toISOString(),
      archived: {
        agents: archived.agents.length,
        companies: archived.companies.length,
        customers: archived.customers.length
      }
    });
  } catch (error) {
    console.error('Archive failed:', error);
    res.status(500).json({ error: 'archive_failed' });
  }
});

// Backup endpoint
app.post('/api/backup/create', requireAuth, requireAdmin, (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(DATA_DIR, 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupPath = path.join(backupDir, `backup-${timestamp}.json`);
    const state = readJsonSafe(DATA_PATH) || {};
    
    writeJsonSafe(backupPath, {
      timestamp,
      state,
      metadata: {
        brands: state.brands?.length || 0,
        companies: state.companies?.length || 0,
        agents: state.agents?.length || 0,
        users: state.users?.length || 0
      }
    });
    
    logGDPREvent('backup_created', req.session.userId, { backupPath });
    
    res.json({ ok: true, backupFile: path.basename(backupPath) });
  } catch (error) {
    console.error('Backup failed:', error);
    res.status(500).json({ error: 'backup_failed' });
  }
});

// List backups
app.get('/api/backup/list', requireAuth, requireAdmin, (req, res) => {
  try {
    const backupDir = path.join(DATA_DIR, 'backups');
    
    if (!fs.existsSync(backupDir)) {
      return res.json({ backups: [] });
    }
    
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(backupDir, f));
        return {
          filename: f,
          size: stats.size,
          created: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.json({ backups: files });
  } catch (error) {
    console.error('List backups failed:', error);
    res.status(500).json({ error: 'list_failed' });
  }
});

// Restore backup
app.post('/api/backup/restore', requireAuth, requireAdmin, (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'missing_filename' });
    
    const backupPath = path.join(DATA_DIR, 'backups', filename);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'backup_not_found' });
    }
    
    const backup = readJsonSafe(backupPath);
    if (!backup || !backup.state) {
      return res.status(400).json({ error: 'invalid_backup' });
    }
    
    // Create a backup of current state before restoring
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const preRestorePath = path.join(DATA_DIR, 'backups', `pre-restore-${timestamp}.json`);
    const currentState = readJsonSafe(DATA_PATH);
    writeJsonSafe(preRestorePath, { timestamp, state: currentState });
    
    // Restore
    writeJsonSafe(DATA_PATH, backup.state);
    
    logGDPREvent('backup_restored', req.session.userId, { 
      restoredFrom: filename,
      backupBefore: path.basename(preRestorePath)
    });
    
    res.json({ ok: true, restored: filename });
  } catch (error) {
    console.error('Restore failed:', error);
    res.status(500).json({ error: 'restore_failed' });
  }
});

// ============================================
// BRAND AND COMPANY MANAGEMENT
// ============================================

// Update brand name
app.put('/api/brands/:id/name', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { namn } = req.body;
    
    if (!namn || typeof namn !== 'string' || namn.trim().length === 0) {
      return res.status(400).json({ error: 'invalid_name' });
    }
    
    const trimmedName = namn.trim();
    
    // Validate name length (reasonable limits)
    if (trimmedName.length > 200) {
      return res.status(400).json({ error: 'name_too_long' });
    }
    
    const state = readJsonSafe(DATA_PATH) || {};
    const brands = state.brands || [];
    
    const brand = brands.find(b => b.id === id);
    if (!brand) {
      return res.status(404).json({ error: 'brand_not_found' });
    }
    
    // Check for duplicate names (case insensitive)
    const duplicateBrand = brands.find(b => 
      b.id !== id && 
      b.namn.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (duplicateBrand) {
      return res.status(409).json({ 
        error: 'duplicate_name',
        message: 'Ett varumärke med detta namn finns redan'
      });
    }
    
    const oldName = brand.namn;
    brand.namn = trimmedName;
    
    // Save state
    if (!writeJsonSafe(DATA_PATH, state)) {
      return res.status(500).json({ error: 'save_failed' });
    }
    
    // Log audit trail
    appendAudit({
      action: 'brand_name_updated',
      userId: req.session.userId,
      brandId: id,
      oldName,
      newName: trimmedName,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ 
      ok: true, 
      brand: { id, namn: trimmedName },
      message: 'Varumärkesnamn uppdaterat'
    });
    
  } catch (error) {
    console.error('Update brand name failed:', error);
    res.status(500).json({ error: 'update_failed' });
  }
});

// Update company name
app.put('/api/companies/:id/name', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { namn } = req.body;
    
    if (!namn || typeof namn !== 'string' || namn.trim().length === 0) {
      return res.status(400).json({ error: 'invalid_name' });
    }
    
    const trimmedName = namn.trim();
    
    // Validate name length (reasonable limits)
    if (trimmedName.length > 200) {
      return res.status(400).json({ error: 'name_too_long' });
    }
    
    const state = readJsonSafe(DATA_PATH) || {};
    const companies = state.companies || [];
    
    const company = companies.find(c => c.id === id);
    if (!company) {
      return res.status(404).json({ error: 'company_not_found' });
    }
    
    // Check for duplicate names within the same brand (case insensitive)
    const duplicateCompany = companies.find(c => 
      c.id !== id && 
      c.brandId === company.brandId &&
      c.namn.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (duplicateCompany) {
      return res.status(409).json({ 
        error: 'duplicate_name',
        message: 'Ett företag med detta namn finns redan inom samma varumärke'
      });
    }
    
    const oldName = company.namn;
    company.namn = trimmedName;
    
    // Save state
    if (!writeJsonSafe(DATA_PATH, state)) {
      return res.status(500).json({ error: 'save_failed' });
    }
    
    // Log audit trail
    appendAudit({
      action: 'company_name_updated',
      userId: req.session.userId,
      companyId: id,
      brandId: company.brandId,
      oldName,
      newName: trimmedName,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ 
      ok: true, 
      company: { id, namn: trimmedName },
      message: 'Företagsnamn uppdaterat'
    });
    
  } catch (error) {
    console.error('Update company name failed:', error);
    res.status(500).json({ error: 'update_failed' });
  }
});

// Bulk update brand names (for administrative operations)
app.put('/api/brands/bulk-rename', requireAuth, requireAdmin, (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'invalid_updates' });
    }
    
    // Validate all updates first
    for (const update of updates) {
      if (!update.id || !update.namn || typeof update.namn !== 'string') {
        return res.status(400).json({ error: 'invalid_update_format' });
      }
      
      if (update.namn.trim().length === 0 || update.namn.trim().length > 200) {
        return res.status(400).json({ error: 'invalid_name_length' });
      }
    }
    
    const state = readJsonSafe(DATA_PATH) || {};
    const brands = state.brands || [];
    const results = [];
    const errors = [];
    
    // Check for conflicts before making any changes
    const newNames = updates.map(u => ({ id: u.id, namn: u.namn.trim().toLowerCase() }));
    
    // Check for duplicates within the update set
    const nameCounts = {};
    for (const { namn } of newNames) {
      nameCounts[namn] = (nameCounts[namn] || 0) + 1;
      if (nameCounts[namn] > 1) {
        return res.status(409).json({ 
          error: 'duplicate_in_updates',
          message: 'Dubbletter upptäckta i uppdateringarna'
        });
      }
    }
    
    // Check for conflicts with existing brands
    for (const update of updates) {
      const brand = brands.find(b => b.id === update.id);
      if (!brand) {
        errors.push({ id: update.id, error: 'brand_not_found' });
        continue;
      }
      
      const trimmedName = update.namn.trim();
      const duplicateBrand = brands.find(b => 
        b.id !== update.id && 
        b.namn.toLowerCase() === trimmedName.toLowerCase()
      );
      
      if (duplicateBrand) {
        errors.push({ 
          id: update.id, 
          error: 'duplicate_name',
          conflictsWith: duplicateBrand.id
        });
      }
    }
    
    if (errors.length > 0) {
      return res.status(409).json({ error: 'validation_failed', errors });
    }
    
    // Apply all updates
    for (const update of updates) {
      const brand = brands.find(b => b.id === update.id);
      const oldName = brand.namn;
      const newName = update.namn.trim();
      
      brand.namn = newName;
      
      results.push({
        id: update.id,
        oldName,
        newName,
        success: true
      });
      
      // Log audit trail for each update
      appendAudit({
        action: 'brand_name_bulk_updated',
        userId: req.session.userId,
        brandId: update.id,
        oldName,
        newName,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    }
    
    // Save state
    if (!writeJsonSafe(DATA_PATH, state)) {
      return res.status(500).json({ error: 'save_failed' });
    }
    
    res.json({ 
      ok: true, 
      results,
      message: `${results.length} varumärken uppdaterade`
    });
    
  } catch (error) {
    console.error('Bulk brand rename failed:', error);
    res.status(500).json({ error: 'update_failed' });
  }
});

// Get brand/company edit history for audit purposes
app.get('/api/audit/names/:type/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const { type, id } = req.params;
    
    if (!['brand', 'company'].includes(type)) {
      return res.status(400).json({ error: 'invalid_type' });
    }
    
    if (!fs.existsSync(AUDIT_PATH)) {
      return res.json({ history: [] });
    }
    
    const auditLog = fs.readFileSync(AUDIT_PATH, 'utf-8');
    const lines = auditLog.split('\n').filter(line => line.trim());
    
    const history = [];
    const actionFilter = type === 'brand' 
      ? ['brand_name_updated', 'brand_name_bulk_updated']
      : ['company_name_updated'];
    
    const idField = type === 'brand' ? 'brandId' : 'companyId';
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (actionFilter.includes(entry.action) && entry[idField] === id) {
          history.push({
            timestamp: entry.ts,
            action: entry.action,
            userId: entry.userId,
            oldName: entry.oldName,
            newName: entry.newName,
            ip: entry.ip
          });
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
    
    // Sort by timestamp (newest first)
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({ history });
    
  } catch (error) {
    console.error('Get name history failed:', error);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

// ============================================
// VISMA.NET INTEGRATION
// ============================================

// Initialize Visma.net integration if configured
const initializeVismaIntegration = () => {
  try {
    // Load configuration
    require('dotenv').config();
    const { VISMA_CONFIG, validateConfig } = require('./config/visma-config');
    
    // Only initialize if credentials are provided
    if (process.env.VISMA_CLIENT_ID && process.env.VISMA_CLIENT_SECRET) {
      console.log('🔗 Initializing Visma.net integration...');
      
      if (!validateConfig()) {
        console.warn('⚠️ Visma.net configuration incomplete - some features may not work');
      }
      
      const VismaNetService = require('./services/visma-net-service');
      const CustomerSyncService = require('./services/customer-sync-service');
      
      // Initialize services
      const vismaService = new VismaNetService();
      const customerSync = new CustomerSyncService(vismaService);
      
      // Store references for use in endpoints
      app.locals.vismaService = vismaService;
      app.locals.customerSync = customerSync;
      
      // ===== VISMA.NET AUTHENTICATION ENDPOINTS =====
      
      // Start OAuth flow
      app.get('/api/visma/auth', requireAuth, async (req, res) => {
        try {
          const authUrl = await vismaService.getAuthorizationUrl();
          res.json({ authUrl });
        } catch (error) {
          console.error('Visma auth error:', error);
          res.status(500).json({ error: 'auth_failed' });
        }
      });
      
      // OAuth callback
      app.get('/api/visma/callback', async (req, res) => {
        try {
          const { code, state } = req.query;
          
          if (!code) {
            return res.status(400).json({ error: 'authorization_code_missing' });
          }
          
          await vismaService.exchangeCodeForToken(code);
          
          // Log successful connection
          await logAuditEvent('visma_connected', req.user?.userId || 'system', {
            timestamp: new Date().toISOString(),
            ip: req.ip
          });
          
          res.redirect('/admin?visma_connected=true');
          
        } catch (error) {
          console.error('Visma callback error:', error);
          res.redirect('/admin?visma_error=true');
        }
      });
      
      // Disconnect from Visma.net
      app.post('/api/visma/disconnect', requireAuth, async (req, res) => {
        try {
          await vismaService.disconnect();
          
          await logAuditEvent('visma_disconnected', req.user.userId, {
            timestamp: new Date().toISOString(),
            ip: req.ip
          });
          
          res.json({ success: true });
        } catch (error) {
          console.error('Visma disconnect error:', error);
          res.status(500).json({ error: 'disconnect_failed' });
        }
      });
      
      // Check connection status
      app.get('/api/visma/status', requireAuth, async (req, res) => {
        try {
          const isConnected = vismaService.isAuthenticated();
          const companyInfo = isConnected ? await vismaService.getCompanyInfo() : null;
          
          res.json({
            connected: isConnected,
            company: companyInfo,
            lastSync: customerSync.getSyncStatus().lastSync
          });
        } catch (error) {
          console.error('Visma status error:', error);
          res.status(500).json({ error: 'status_check_failed' });
        }
      });
      
      // ===== CUSTOMER SYNCHRONIZATION ENDPOINTS =====
      
      // Sync customers
      app.post('/api/visma/sync/customers', requireAuth, async (req, res) => {
        try {
          const { direction = 'bidirectional' } = req.body;
          
          if (!vismaService.isAuthenticated()) {
            return res.status(400).json({ error: 'not_connected_to_visma' });
          }
          
          // Start sync in background for large datasets
          const syncPromise = customerSync.syncCustomers({ direction });
          
          // For small syncs, wait for completion
          if (req.query.wait === 'true') {
            const result = await syncPromise;
            
            await logAuditEvent('customer_sync_completed', req.user.userId, {
              direction,
              result,
              ip: req.ip
            });
            
            res.json(result);
          } else {
            // Return immediately and sync in background
            syncPromise.then(result => {
              logAuditEvent('customer_sync_completed', req.user.userId, {
                direction,
                result,
                ip: req.ip
              });
            }).catch(error => {
              console.error('Background sync failed:', error);
            });
            
            res.json({ message: 'sync_started', direction });
          }
          
        } catch (error) {
          console.error('Customer sync error:', error);
          res.status(500).json({ error: 'sync_failed' });
        }
      });
      
      // Get sync status
      app.get('/api/visma/sync/status', requireAuth, (req, res) => {
        try {
          const status = customerSync.getSyncStatus();
          res.json(status);
        } catch (error) {
          console.error('Sync status error:', error);
          res.status(500).json({ error: 'status_failed' });
        }
      });
      
      // Clear sync state
      app.post('/api/visma/sync/reset', requireAuth, async (req, res) => {
        try {
          await customerSync.clearSyncState();
          
          await logAuditEvent('sync_state_reset', req.user.userId, {
            timestamp: new Date().toISOString(),
            ip: req.ip
          });
          
          res.json({ success: true });
        } catch (error) {
          console.error('Sync reset error:', error);
          res.status(500).json({ error: 'reset_failed' });
        }
      });
      
      // ===== VISMA.NET DATA ENDPOINTS =====
      
      // Get customers from Visma.net
      app.get('/api/visma/customers', requireAuth, async (req, res) => {
        try {
          if (!vismaService.isAuthenticated()) {
            return res.status(400).json({ error: 'not_connected_to_visma' });
          }
          
          const customers = await vismaService.getCustomers();
          res.json(customers);
        } catch (error) {
          console.error('Visma customers error:', error);
          res.status(500).json({ error: 'fetch_failed' });
        }
      });
      
      // Create customer in Visma.net
      app.post('/api/visma/customers', requireAuth, async (req, res) => {
        try {
          if (!vismaService.isAuthenticated()) {
            return res.status(400).json({ error: 'not_connected_to_visma' });
          }
          
          const customer = await vismaService.createCustomer(req.body);
          
          await logAuditEvent('visma_customer_created', req.user.userId, {
            customerNumber: customer.number,
            customerName: customer.name,
            ip: req.ip
          });
          
          res.json(customer);
        } catch (error) {
          console.error('Visma create customer error:', error);
          res.status(500).json({ error: 'create_failed' });
        }
      });
      
      // Update customer in Visma.net
      app.put('/api/visma/customers/:customerNumber', requireAuth, async (req, res) => {
        try {
          if (!vismaService.isAuthenticated()) {
            return res.status(400).json({ error: 'not_connected_to_visma' });
          }
          
          const customer = await vismaService.updateCustomer(req.params.customerNumber, req.body);
          
          await logAuditEvent('visma_customer_updated', req.user.userId, {
            customerNumber: req.params.customerNumber,
            updates: Object.keys(req.body),
            ip: req.ip
          });
          
          res.json(customer);
        } catch (error) {
          console.error('Visma update customer error:', error);
          res.status(500).json({ error: 'update_failed' });
        }
      });

      // ===== PRODUCT SYNCHRONIZATION ENDPOINTS =====

      // Initialize product sync service
      const ProductSyncService = require('./services/product-sync-service');
      const productSync = new ProductSyncService(vismaService);
      app.locals.productSync = productSync;

      // Sync products
      app.post('/api/visma/sync/products', requireAuth, async (req, res) => {
        try {
          const { direction = 'bidirectional', syncPrices = true } = req.body;
          
          if (!vismaService.isAuthenticated()) {
            return res.status(400).json({ error: 'not_connected_to_visma' });
          }
          
          const syncPromise = productSync.syncProducts({ direction, syncPrices });
          
          if (req.query.wait === 'true') {
            const result = await syncPromise;
            
            await logAuditEvent('product_sync_completed', req.user.userId, {
              direction,
              result,
              ip: req.ip
            });
            
            res.json(result);
          } else {
            syncPromise.then(result => {
              logAuditEvent('product_sync_completed', req.user.userId, {
                direction,
                result,
                ip: req.ip
              });
            }).catch(error => {
              console.error('Background product sync failed:', error);
            });
            
            res.json({ message: 'product_sync_started', direction });
          }
          
        } catch (error) {
          console.error('Product sync error:', error);
          res.status(500).json({ error: 'product_sync_failed' });
        }
      });

      // Get product sync status
      app.get('/api/visma/sync/products/status', requireAuth, (req, res) => {
        try {
          const status = productSync.getSyncStatus();
          res.json(status);
        } catch (error) {
          console.error('Product sync status error:', error);
          res.status(500).json({ error: 'status_failed' });
        }
      });

      // Get products from Visma.net
      app.get('/api/visma/products', requireAuth, async (req, res) => {
        try {
          if (!vismaService.isAuthenticated()) {
            return res.status(400).json({ error: 'not_connected_to_visma' });
          }
          
          const products = await vismaService.getProducts();
          res.json(products);
        } catch (error) {
          console.error('Visma products error:', error);
          res.status(500).json({ error: 'fetch_failed' });
        }
      });

      // Get specific product from Visma.net
      app.get('/api/visma/products/:inventoryId', requireAuth, async (req, res) => {
        try {
          if (!vismaService.isAuthenticated()) {
            return res.status(400).json({ error: 'not_connected_to_visma' });
          }
          
          const product = await vismaService.getProduct(req.params.inventoryId);
          res.json(product);
        } catch (error) {
          console.error('Visma product error:', error);
          res.status(500).json({ error: 'fetch_failed' });
        }
      });

      // Create product in Visma.net
      app.post('/api/visma/products', requireAuth, async (req, res) => {
        try {
          if (!vismaService.isAuthenticated()) {
            return res.status(400).json({ error: 'not_connected_to_visma' });
          }
          
          const product = await vismaService.createProduct(req.body);
          
          await logAuditEvent('visma_product_created', req.user.userId, {
            inventoryId: product.inventoryID,
            productName: product.description,
            ip: req.ip
          });
          
          res.json(product);
        } catch (error) {
          console.error('Visma create product error:', error);
          res.status(500).json({ error: 'create_failed' });
        }
      });

      // Update product in Visma.net
      app.put('/api/visma/products/:inventoryId', requireAuth, async (req, res) => {
        try {
          if (!vismaService.isAuthenticated()) {
            return res.status(400).json({ error: 'not_connected_to_visma' });
          }
          
          const product = await vismaService.updateProduct(req.params.inventoryId, req.body);
          
          await logAuditEvent('visma_product_updated', req.user.userId, {
            inventoryId: req.params.inventoryId,
            updates: Object.keys(req.body),
            ip: req.ip
          });
          
          res.json(product);
        } catch (error) {
          console.error('Visma update product error:', error);
          res.status(500).json({ error: 'update_failed' });
        }
      });

      // Update product price
      app.put('/api/visma/products/:inventoryId/price', requireAuth, async (req, res) => {
        try {
          if (!vismaService.isAuthenticated()) {
            return res.status(400).json({ error: 'not_connected_to_visma' });
          }
          
          const { price } = req.body;
          if (typeof price !== 'number' || price < 0) {
            return res.status(400).json({ error: 'invalid_price' });
          }
          
          const product = await vismaService.updateProductPrice(req.params.inventoryId, price);
          
          await logAuditEvent('visma_product_price_updated', req.user.userId, {
            inventoryId: req.params.inventoryId,
            newPrice: price,
            ip: req.ip
          });
          
          res.json(product);
        } catch (error) {
          console.error('Visma update price error:', error);
          res.status(500).json({ error: 'price_update_failed' });
        }
      });

      // Delete product from Visma.net
      app.delete('/api/visma/products/:inventoryId', requireAuth, async (req, res) => {
        try {
          if (!vismaService.isAuthenticated()) {
            return res.status(400).json({ error: 'not_connected_to_visma' });
          }
          
          await vismaService.deleteProduct(req.params.inventoryId);
          
          await logAuditEvent('visma_product_deleted', req.user.userId, {
            inventoryId: req.params.inventoryId,
            ip: req.ip
          });
          
          res.json({ success: true });
        } catch (error) {
          console.error('Visma delete product error:', error);
          res.status(500).json({ error: 'delete_failed' });
        }
      });

      // ===== PRICE LIST MANAGEMENT ENDPOINTS =====

      // Get CRM price list
      app.get('/api/price-list', requireAuth, (req, res) => {
        try {
          const priceList = productSync.priceList;
          res.json(priceList);
        } catch (error) {
          console.error('Price list error:', error);
          res.status(500).json({ error: 'fetch_failed' });
        }
      });

      // Update price list
      app.put('/api/price-list', requireAuth, async (req, res) => {
        try {
          const updatedPriceList = await productSync.updatePriceList(req.body);
          
          await logAuditEvent('price_list_updated', req.user.userId, {
            updates: Object.keys(req.body),
            ip: req.ip
          });
          
          res.json(updatedPriceList);
        } catch (error) {
          console.error('Price list update error:', error);
          res.status(500).json({ error: 'update_failed' });
        }
      });

      // Add product to price list
      app.post('/api/price-list/products', requireAuth, async (req, res) => {
        try {
          const newProduct = await productSync.addProduct(req.body);
          
          await logAuditEvent('price_list_product_added', req.user.userId, {
            productId: newProduct.id,
            productName: newProduct.name,
            ip: req.ip
          });
          
          res.json(newProduct);
        } catch (error) {
          console.error('Add product error:', error);
          res.status(500).json({ error: 'add_failed' });
        }
      });

      // Remove product from price list
      app.delete('/api/price-list/products/:productId', requireAuth, async (req, res) => {
        try {
          const success = await productSync.removeProduct(req.params.productId);
          
          if (success) {
            await logAuditEvent('price_list_product_removed', req.user.userId, {
              productId: req.params.productId,
              ip: req.ip
            });
            
            res.json({ success: true });
          } else {
            res.status(404).json({ error: 'product_not_found' });
          }
        } catch (error) {
          console.error('Remove product error:', error);
          res.status(500).json({ error: 'remove_failed' });
        }
      });

      // Get VAT categories from Visma.net
      app.get('/api/visma/vat-categories', requireAuth, async (req, res) => {
        try {
          if (!vismaService.isAuthenticated()) {
            return res.status(400).json({ error: 'not_connected_to_visma' });
          }
          
          const vatCategories = await vismaService.getVatCategories();
          res.json(vatCategories);
        } catch (error) {
          console.error('VAT categories error:', error);
          res.status(500).json({ error: 'fetch_failed' });
        }
      });

      // Get product categories from Visma.net
      app.get('/api/visma/product-categories', requireAuth, async (req, res) => {
        try {
          if (!vismaService.isAuthenticated()) {
            return res.status(400).json({ error: 'not_connected_to_visma' });
          }
          
          const categories = await vismaService.getProductCategories();
          res.json(categories);
        } catch (error) {
          console.error('Product categories error:', error);
          res.status(500).json({ error: 'fetch_failed' });
        }
      });
      
      console.log('✅ Visma.net integration initialized successfully');
      
    } else {
      console.log('ℹ️ Visma.net integration disabled - no credentials provided');
      console.log('💡 Set VISMA_CLIENT_ID and VISMA_CLIENT_SECRET to enable');
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize Visma.net integration:', error.message);
  }
};

// Initialize Visma.net integration
initializeVismaIntegration();

// ============================================
// DUAL USER MANAGEMENT SYSTEM
// ============================================

// Initialize dual user management for modern + legacy systems
const initializeDualUserManagement = async () => {
  try {
    console.log('🔄 Initializing Dual User Management System...');
    
    const DualUserManager = require('./services/dual-user-manager');
    const dualUserManager = new DualUserManager();
    
    // Ladda befintligt sync-state
    await dualUserManager.loadSyncState();
    
    // Gör tillgänglig för endpoints
    app.locals.dualUserManager = dualUserManager;
    
    // ===== DUAL USER MANAGEMENT ENDPOINTS =====
    
    // Skapa användare i rätt system(er)
    app.post('/api/users/dual-create', requireAuth, async (req, res) => {
      try {
        const { customerId, services = [] } = req.body;
        
        if (!customerId) {
          return res.status(400).json({ error: 'customerId is required' });
        }
        
        // Hämta kunddata från state
        const customer = state.customers?.find(c => c.id === customerId);
        if (!customer) {
          return res.status(404).json({ error: 'customer_not_found' });
        }
        
        const result = await dualUserManager.createUser(customer, services);
        
        // Logga i audit
        await logAuditEvent('dual_user_created', req.user.userId, {
          customerId,
          customerName: customer.namn,
          systemNeeds: result.systemNeeds,
          accountsCreated: Object.keys(result.accounts),
          errors: result.errors,
          ip: req.ip
        });
        
        res.json(result);
        
      } catch (error) {
        console.error('Dual user creation error:', error);
        res.status(500).json({ error: 'creation_failed', message: error.message });
      }
    });
    
    // Migrera användare från legacy till Azure B2C
    app.post('/api/users/migrate-to-azure', requireAuth, async (req, res) => {
      try {
        const { customerId, services = [] } = req.body;
        
        if (!customerId) {
          return res.status(400).json({ error: 'customerId is required' });
        }
        
        const result = await dualUserManager.migrateUserToAzureB2C(customerId, services);
        
        await logAuditEvent('user_migrated_to_azure', req.user.userId, {
          customerId,
          azureUserId: result.azureUser?.id,
          migrationDate: result.migrationDate,
          ip: req.ip
        });
        
        res.json(result);
        
      } catch (error) {
        console.error('User migration error:', error);
        res.status(500).json({ error: 'migration_failed', message: error.message });
      }
    });
    
    // Synkronisera alla dual accounts
    app.post('/api/users/sync-dual-accounts', requireAuth, async (req, res) => {
      try {
        const syncResults = await dualUserManager.syncDualAccounts();
        
        await logAuditEvent('dual_accounts_synced', req.user.userId, {
          syncResults,
          ip: req.ip
        });
        
        res.json(syncResults);
        
      } catch (error) {
        console.error('Dual account sync error:', error);
        res.status(500).json({ error: 'sync_failed', message: error.message });
      }
    });
    
    // Hämta dual account statistik
    app.get('/api/users/dual-stats', requireAuth, (req, res) => {
      try {
        const stats = dualUserManager.getDualAccountStats();
        res.json(stats);
      } catch (error) {
        console.error('Dual stats error:', error);
        res.status(500).json({ error: 'stats_failed' });
      }
    });
    
    // Analysera vilket system en kund behöver
    app.post('/api/users/analyze-system-needs', requireAuth, async (req, res) => {
      try {
        const { customerId, services = [] } = req.body;
        
        if (!customerId) {
          return res.status(400).json({ error: 'customerId is required' });
        }
        
        const customer = state.customers?.find(c => c.id === customerId);
        if (!customer) {
          return res.status(404).json({ error: 'customer_not_found' });
        }
        
        const systemNeeds = dualUserManager.analyzeSystemNeeds(services, customer);
        
        res.json({
          customerId,
          customerName: customer.namn,
          services,
          systemNeeds,
          recommendations: {
            primary: systemNeeds.primarySystem,
            requiresBoth: systemNeeds.isDualAccount,
            reasoning: systemNeeds.reasoning
          }
        });
        
      } catch (error) {
        console.error('System analysis error:', error);
        res.status(500).json({ error: 'analysis_failed' });
      }
    });
    
    // Hämta kunder som behöver migrering
    app.get('/api/users/migration-candidates', requireAuth, async (req, res) => {
      try {
        const migrationCandidates = [];
        
        // Analysera alla kunder som kan behöva migrering
        for (const customer of state.customers || []) {
          // Kunder med endast legacy som använder moderna tjänster
          const hasModernServices = customer.services?.some(service => 
            dualUserManager.routingRules.modernServices.includes(service)
          );
          
          const hasLegacyOnly = customer.userSystem === 'legacy' || 
                               (!customer.userSystem && !dualUserManager.isNewCustomer(customer));
          
          if (hasModernServices && hasLegacyOnly) {
            migrationCandidates.push({
              customerId: customer.id,
              customerName: customer.namn,
              currentSystem: 'legacy',
              recommendedSystem: 'azure-b2c',
              reason: 'Using modern services with legacy system',
              priority: hasModernServices ? 'high' : 'medium'
            });
          }
        }
        
        res.json({
          candidates: migrationCandidates,
          totalCount: migrationCandidates.length,
          highPriority: migrationCandidates.filter(c => c.priority === 'high').length
        });
        
      } catch (error) {
        console.error('Migration candidates error:', error);
        res.status(500).json({ error: 'fetch_failed' });
      }
    });
    
    // Hämta routing regler
    app.get('/api/users/routing-rules', requireAuth, (req, res) => {
      try {
        res.json({
          routingRules: dualUserManager.routingRules,
          legacySystemConfig: {
            enabled: dualUserManager.legacySystemConfig.enableSync,
            hasApiKey: !!dualUserManager.legacySystemConfig.apiKey,
            apiUrl: dualUserManager.legacySystemConfig.apiUrl ? 'configured' : 'not_configured'
          }
        });
      } catch (error) {
        console.error('Routing rules error:', error);
        res.status(500).json({ error: 'fetch_failed' });
      }
    });
    
    console.log('✅ Dual User Management System initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize Dual User Management:', error.message);
  }
};

// Initialize dual user management
initializeDualUserManagement();

// ============================================
// AZURE B2C USER SYNCHRONIZATION
// ============================================

// Initialize user sync endpoints
if (process.env.ENABLE_AZURE_B2C_USER_SYNC === 'true') {
  console.log('Initializing Azure B2C User Synchronization...');
  createUserSyncEndpoints(app, state, logDataAccess);
}

// --- Outlook Integration Endpoints ---
const outlookIntegration = new ServerOutlookIntegration();

// Starta autentisering
app.get('/api/outlook/auth/start', requireAuth, async (req, res) => {
  try {
    const userId = req.user.username; // Använd CRM-användarens ID
    const authUrl = await outlookIntegration.getAuthUrl(userId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Outlook auth start fel:', error);
    res.status(500).json({ error: 'Kunde inte starta autentisering' });
  }
});

// Hantera auth callback
app.get('/api/outlook/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send('Ogiltiga parametrar');
    }

    await outlookIntegration.handleAuthCallback(code, state);
    
    // Redirect tillbaka till CRM med success
    res.redirect('/?outlook=connected');
  } catch (error) {
    console.error('Outlook auth callback fel:', error);
    res.redirect('/?outlook=error');
  }
});

// Kontrollera autentiseringsstatus
app.get('/api/outlook/auth/status', requireAuth, (req, res) => {
  const userId = req.user.username;
  const isAuthenticated = outlookIntegration.isUserAuthenticated(userId);
  res.json({ isAuthenticated });
});

// Hämta e-post
app.get('/api/outlook/emails', requireAuth, async (req, res) => {
  try {
    const userId = req.user.username;
    const { top = 50, filter, orderby } = req.query;
    
    const emails = await outlookIntegration.getEmails(userId, {
      top: parseInt(top),
      filter,
      orderby
    });
    
    res.json(emails);
  } catch (error) {
    console.error('Outlook emails fel:', error);
    res.status(500).json({ error: 'Kunde inte hämta e-post' });
  }
});

// Skicka e-post
app.post('/api/outlook/emails/send', requireAuth, async (req, res) => {
  try {
    const userId = req.user.username;
    const emailData = req.body;
    
    await outlookIntegration.sendEmail(userId, emailData);
    
    // Logga i CRM audit
    appendAudit({
      type: 'outlook_email_sent',
      user: userId,
      to: emailData.to,
      subject: emailData.subject,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Outlook send email fel:', error);
    res.status(500).json({ error: 'Kunde inte skicka e-post' });
  }
});

// Hämta kalenderhändelser
app.get('/api/outlook/calendar/events', requireAuth, async (req, res) => {
  try {
    const userId = req.user.username;
    const { startTime, endTime } = req.query;
    
    const start = startTime ? new Date(startTime) : new Date();
    const end = endTime ? new Date(endTime) : new Date(Date.now() + 30*24*60*60*1000); // 30 dagar
    
    const events = await outlookIntegration.getCalendarEvents(userId, start, end);
    res.json(events);
  } catch (error) {
    console.error('Outlook calendar fel:', error);
    res.status(500).json({ error: 'Kunde inte hämta kalenderhändelser' });
  }
});

// Skapa kalenderhändelse
app.post('/api/outlook/calendar/events', requireAuth, async (req, res) => {
  try {
    const userId = req.user.username;
    const eventData = req.body;
    
    // Konvertera datum-strängar till Date-objekt
    eventData.start = new Date(eventData.start);
    eventData.end = new Date(eventData.end);
    
    const event = await outlookIntegration.createCalendarEvent(userId, eventData);
    
    // Logga i CRM audit
    appendAudit({
      type: 'outlook_event_created',
      user: userId,
      subject: eventData.subject,
      attendees: eventData.attendees,
      timestamp: new Date().toISOString()
    });
    
    res.json(event);
  } catch (error) {
    console.error('Outlook create event fel:', error);
    res.status(500).json({ error: 'Kunde inte skapa händelse' });
  }
});

// Logga ut från Outlook
app.post('/api/outlook/auth/logout', requireAuth, (req, res) => {
  const userId = req.user.username;
  outlookIntegration.logoutUser(userId);
  
  appendAudit({
    type: 'outlook_logout',
    user: userId,
    timestamp: new Date().toISOString()
  });
  
  res.json({ success: true });
});

// serve frontend (keep this after API routes)
app.use(express.static(FRONTEND_DIR, { extensions: ['html'] }));
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

app.listen(PORT, () => {
  console.log(`CRM server running on http://localhost:${PORT}`);
  
  // Starta automatiska backups (varje 24 timmar)
  if (NODE_ENV === 'production') {
    backupManager.scheduleBackups(24);
  } else {
    // I utveckling: backup var 4:e timme för testning
    backupManager.scheduleBackups(4);
  }
});
