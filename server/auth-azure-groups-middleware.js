/**
 * Azure AD Group-based Role Middleware
 * Mappar Azure AD-grupper till CRM-roller
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// ============================================
// KONFIGURATION
// ============================================

const b2cConfig = {
  tenantName: process.env.AZURE_B2C_TENANT_NAME || 'yourtenantname',
  clientId: process.env.AZURE_B2C_CLIENT_ID || 'your-client-id',
  policyName: process.env.AZURE_B2C_POLICY_NAME || 'B2C_1_signup_signin',
  
  get authority() {
    return `https://${this.tenantName}.b2clogin.com/${this.tenantName}.onmicrosoft.com/${this.policyName}`;
  },
  
  get issuer() {
    return `https://${this.tenantName}.b2clogin.com/${this.getTenantId()}/v2.0/`;
  },
  
  get jwksUri() {
    return `https://${this.tenantName}.b2clogin.com/${this.tenantName}.onmicrosoft.com/${this.policyName}/discovery/v2.0/keys`;
  },
  
  getTenantId() {
    return process.env.AZURE_B2C_TENANT_ID || `${this.tenantName}.onmicrosoft.com`;
  }
};

// ============================================
// GROUP TO ROLE MAPPING
// ============================================

const GROUP_ROLE_MAPPING = {
  [process.env.AZURE_AD_GROUP_ADMIN]: 'admin',
  [process.env.AZURE_AD_GROUP_MANAGER]: 'manager', 
  [process.env.AZURE_AD_GROUP_SALES]: 'sales',
  [process.env.AZURE_AD_GROUP_VIEWER]: 'viewer'
};

const ROLE_HIERARCHY = {
  'admin': ['admin', 'manager', 'sales', 'viewer'],
  'manager': ['manager', 'sales', 'viewer'],
  'sales': ['sales', 'viewer'],
  'viewer': ['viewer']
};

// ============================================
// JWKS CLIENT
// ============================================

const jwksClientInstance = jwksClient({
  jwksUri: b2cConfig.jwksUri,
  cache: true,
  cacheMaxAge: 86400000, // 24 timmar
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

function getSigningKey(header, callback) {
  jwksClientInstance.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// ============================================
// TOKEN VALIDATION
// ============================================

function validateToken(token) {
  return new Promise((resolve, reject) => {
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded) {
      return reject(new Error('Invalid token format'));
    }

    getSigningKey(decoded.header, (err, signingKey) => {
      if (err) {
        return reject(err);
      }

      const verifyOptions = {
        audience: b2cConfig.clientId,
        issuer: b2cConfig.issuer,
        algorithms: ['RS256'],
        ignoreExpiration: false
      };

      jwt.verify(token, signingKey, verifyOptions, (err, verified) => {
        if (err) {
          return reject(err);
        }
        resolve(verified);
      });
    });
  });
}

// ============================================
// GROUP/ROLE UTILITY FUNCTIONS
// ============================================

/**
 * Mappar Azure AD-grupper till CRM-roller
 */
function mapGroupsToRoles(groups = []) {
  const roles = new Set();
  
  groups.forEach(groupId => {
    const role = GROUP_ROLE_MAPPING[groupId];
    if (role) {
      // Lägg till denna roll och alla lägre roller i hierarkin
      ROLE_HIERARCHY[role].forEach(r => roles.add(r));
    }
  });
  
  return Array.from(roles);
}

/**
 * Hitta högsta rollen för en användare
 */
function getPrimaryRole(groups = []) {
  const priorities = { 'admin': 4, 'manager': 3, 'sales': 2, 'viewer': 1 };
  let highestRole = 'viewer';
  let highestPriority = 0;
  
  groups.forEach(groupId => {
    const role = GROUP_ROLE_MAPPING[groupId];
    if (role && priorities[role] > highestPriority) {
      highestRole = role;
      highestPriority = priorities[role];
    }
  });
  
  return highestRole;
}

/**
 * Kontrollera om användare har specifik roll
 */
function hasRole(userGroups, requiredRole) {
  const userRoles = mapGroupsToRoles(userGroups);
  return userRoles.includes(requiredRole);
}

/**
 * Kontrollera om användare har någon av de angivna rollerna
 */
function hasAnyRole(userGroups, requiredRoles) {
  return requiredRoles.some(role => hasRole(userGroups, role));
}

/**
 * Logga gruppinformation för debugging
 */
function logGroupInfo(user, userGroups) {
  if (process.env.NODE_ENV === 'development') {
    console.log('=== Azure AD Group Debug Info ===');
    console.log('User:', user.name || user.email);
    console.log('Groups from token:', userGroups);
    console.log('Group mappings:', GROUP_ROLE_MAPPING);
    console.log('Mapped roles:', mapGroupsToRoles(userGroups));
    console.log('Primary role:', getPrimaryRole(userGroups));
    console.log('================================');
  }
}

// ============================================
// MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Require Azure AD authentication med gruppbaserade roller
 */
function requireAzureAuth(options = {}) {
  return async (req, res, next) => {
    try {
      // Hämta token från Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return res.status(401).json({
          error: 'No authorization header',
          code: 'NO_AUTH_HEADER'
        });
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
          error: 'Invalid authorization header format', 
          code: 'INVALID_AUTH_FORMAT'
        });
      }

      const token = parts[1];

      // Validera token
      let user;
      try {
        user = await validateToken(token);
      } catch (validationError) {
        console.error('Token validation failed:', validationError.message);
        
        if (validationError.name === 'TokenExpiredError') {
          return res.status(401).json({
            error: 'Token expired',
            code: 'TOKEN_EXPIRED'
          });
        } else if (validationError.name === 'JsonWebTokenError') {
          return res.status(401).json({
            error: 'Invalid token',
            code: 'INVALID_TOKEN'
          });
        } else {
          return res.status(401).json({
            error: 'Authentication failed',
            code: 'AUTH_FAILED',
            details: process.env.NODE_ENV === 'development' ? validationError.message : undefined
          });
        }
      }

      // Extrahera grupper från token
      const userGroups = user.groups || [];
      
      // Debug logging
      logGroupInfo(user, userGroups);

      // Mappar grupper till roller
      const userRoles = mapGroupsToRoles(userGroups);
      const primaryRole = getPrimaryRole(userGroups);

      // Kontrollera roller (om specificerat)
      if (options.roles && options.roles.length > 0) {
        const hasRequiredRole = hasAnyRole(userGroups, options.roles);
        
        if (!hasRequiredRole) {
          console.warn(`Access denied for ${user.email}: Required roles [${options.roles.join(', ')}], user has [${userRoles.join(', ')}]`);
          return res.status(403).json({
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            requiredRoles: options.roles,
            userRoles: userRoles,
            primaryRole: primaryRole
          });
        }
      }

      // Lägg till user i request med gruppbaserad rollhantering
      req.user = {
        id: user.oid || user.sub,
        email: user.emails?.[0] || user.email || user.preferred_username,
        name: user.name || `${user.given_name || ''} ${user.family_name || ''}`.trim(),
        firstName: user.given_name,
        lastName: user.family_name,
        
        // Gruppbaserad rollhantering
        groups: userGroups,
        roles: userRoles,
        primaryRole: primaryRole,
        
        // För kompatibilitet med befintlig kod
        roll: primaryRole,
        username: user.emails?.[0] || user.email || user.preferred_username,
        
        // Metadata
        jobTitle: user.jobTitle,
        department: user.department,
        tokenClaims: user
      };

      // Logga access med rollinfo
      if (req.logDataAccess) {
        req.logDataAccess(req.user.id, 'API_ACCESS', 'authenticated_request', {
          endpoint: req.path,
          method: req.method,
          primaryRole: primaryRole,
          allRoles: userRoles
        });
      }

      next();

    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Require specific role(s) - gruppbaserat
 */
function requireRole(...roles) {
  return requireAzureAuth({ roles });
}

/**
 * Require admin role
 */
function requireAdmin() {
  return requireRole('admin');
}

/**
 * Require manager or higher (manager, admin)
 */
function requireManager() {
  return requireRole('manager', 'admin');
}

/**
 * Require sales or higher (sales, manager, admin)
 */
function requireSales() {
  return requireRole('sales', 'manager', 'admin');
}

/**
 * Optional authentication med gruppbaserade roller
 */
function optionalAzureAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    req.user = null;
    return next();
  }

  const token = parts[1];

  validateToken(token)
    .then(user => {
      const userGroups = user.groups || [];
      const userRoles = mapGroupsToRoles(userGroups);
      const primaryRole = getPrimaryRole(userGroups);

      req.user = {
        id: user.oid || user.sub,
        email: user.emails?.[0] || user.email,
        name: user.name,
        groups: userGroups,
        roles: userRoles,
        primaryRole: primaryRole,
        roll: primaryRole,
        tokenClaims: user
      };
      next();
    })
    .catch(err => {
      console.warn('Optional auth failed:', err.message);
      req.user = null;
      next();
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Extrahera user ID från token utan att validera
 */
function extractUserId(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded?.oid || decoded?.sub || null;
  } catch {
    return null;
  }
}

/**
 * Kontrollera om token snart går ut
 */
function isTokenExpiringSoon(token, minutesThreshold = 5) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return false;
    
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    
    return timeUntilExpiry < (minutesThreshold * 60);
  } catch {
    return false;
  }
}

// ============================================
// CONFIGURATION CHECK
// ============================================

/**
 * Azure B2C configuration check endpoint
 */
function getConfigCheckEndpoint() {
  return (req, res) => {
    const config = {
      configured: !!(b2cConfig.tenantName && b2cConfig.clientId),
      tenantName: b2cConfig.tenantName,
      policyName: b2cConfig.policyName,
      authority: b2cConfig.authority,
      jwksUri: b2cConfig.jwksUri,
      groupsConfigured: !!(process.env.AZURE_AD_GROUP_ADMIN && process.env.AZURE_AD_GROUP_VIEWER),
      groupMappings: Object.keys(GROUP_ROLE_MAPPING).length > 0 ? 'configured' : 'missing'
    };

    res.json(config);
  };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  requireAzureAuth,
  requireRole,
  requireAdmin,
  requireManager,
  requireSales,
  optionalAzureAuth,
  
  // Group/Role utilities
  mapGroupsToRoles,
  getPrimaryRole,
  hasRole,
  hasAnyRole,
  
  // Token utilities
  extractUserId,
  isTokenExpiringSoon,
  validateToken,
  
  // Configuration
  getConfigCheckEndpoint,
  GROUP_ROLE_MAPPING,
  ROLE_HIERARCHY,
  
  // For testing/debugging
  logGroupInfo
};