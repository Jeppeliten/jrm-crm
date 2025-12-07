/**
 * Azure AD B2C Token Validation Middleware
 * Validerar JWT tokens från Azure B2C på backend
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
  
  // Konstruerade URIs
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
    // Tenant ID är vanligtvis samma som tenant name men kan vara ett GUID
    // Hämta från process.env.AZURE_B2C_TENANT_ID om du har det
    return process.env.AZURE_B2C_TENANT_ID || `${this.tenantName}.onmicrosoft.com`;
  }
};

// ============================================
// JWKS CLIENT (för att hämta public keys)
// ============================================

const jwksClientInstance = jwksClient({
  jwksUri: b2cConfig.jwksUri,
  cache: true,
  cacheMaxAge: 86400000, // 24 timmar
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

/**
 * Hämta signing key från JWKS
 */
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

/**
 * Validera Azure B2C JWT token
 */
function validateToken(token) {
  return new Promise((resolve, reject) => {
    // Decode utan att validera först (för att få header)
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded) {
      return reject(new Error('Invalid token format'));
    }

    // Hämta signing key baserat på kid i header
    getSigningKey(decoded.header, (err, signingKey) => {
      if (err) {
        return reject(err);
      }

      // Validation options
      const verifyOptions = {
        audience: b2cConfig.clientId,
        issuer: b2cConfig.issuer,
        algorithms: ['RS256'],
        ignoreExpiration: false
      };

      // Validera token
      jwt.verify(token, signingKey, verifyOptions, (err, verified) => {
        if (err) {
          return reject(err);
        }
        resolve(verified);
      });
    });
  });
}

/**
 * Alternativ validering med manuell kontroll (om jwks-rsa inte fungerar)
 */
async function validateTokenManual(token) {
  try {
    // Decode token
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const payload = decoded.payload;
    const now = Math.floor(Date.now() / 1000);

    // Manuella kontroller
    
    // 1. Expiration
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }

    // 2. Not before
    if (payload.nbf && payload.nbf > now) {
      throw new Error('Token not yet valid');
    }

    // 3. Audience (clientId)
    if (payload.aud !== b2cConfig.clientId) {
      throw new Error('Invalid audience');
    }

    // 4. Issuer
    const validIssuers = [
      b2cConfig.issuer,
      `https://${b2cConfig.tenantName}.b2clogin.com/${b2cConfig.getTenantId()}/v2.0/`,
      `https://login.microsoftonline.com/${b2cConfig.getTenantId()}/v2.0/`
    ];
    
    if (!validIssuers.includes(payload.iss)) {
      throw new Error('Invalid issuer');
    }

    return payload;

  } catch (error) {
    throw error;
  }
}

// ============================================
// EXPRESS MIDDLEWARE
// ============================================

/**
 * Require Azure B2C authentication middleware
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

      // Extract token (format: "Bearer <token>")
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
        
        // Olika felmeddelanden beroende på vad som gick fel
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

      // Kontrollera roller (om specificerat)
      if (options.roles && options.roles.length > 0) {
        const userRoles = user.roles || user.extension_Role || [];
        const hasRequiredRole = options.roles.some(role => userRoles.includes(role));
        
        if (!hasRequiredRole) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            requiredRoles: options.roles,
            userRoles: userRoles
          });
        }
      }

      // Lägg till user i request
      req.user = {
        id: user.oid || user.sub, // Object ID
        email: user.emails?.[0] || user.email || user.preferred_username,
        name: user.name || user.given_name + ' ' + user.family_name,
        firstName: user.given_name,
        lastName: user.family_name,
        roles: user.roles || user.extension_Role || [],
        jobTitle: user.jobTitle,
        tokenClaims: user
      };

      // Logga access
      if (req.logDataAccess) {
        req.logDataAccess(req.user.id, 'API_ACCESS', 'authenticated_request', {
          endpoint: req.path,
          method: req.method
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
 * Require specific role(s)
 */
function requireRole(...roles) {
  return requireAzureAuth({ roles });
}

/**
 * Optional authentication (sätter req.user om token finns, men kräver det inte)
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
      req.user = {
        id: user.oid || user.sub,
        email: user.emails?.[0] || user.email,
        name: user.name,
        roles: user.roles || [],
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
 * Extrahera user ID från token utan att validera (för logging etc)
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
// HEALTH CHECK ENDPOINT
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
      jwksUri: b2cConfig.jwksUri
    };

    res.json({
      azureB2C: config,
      status: config.configured ? 'configured' : 'not_configured'
    });
  };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Middleware
  requireAzureAuth,
  requireRole,
  optionalAzureAuth,
  
  // Functions
  validateToken,
  validateTokenManual,
  extractUserId,
  isTokenExpiringSoon,
  
  // Config
  b2cConfig,
  
  // Endpoints
  getConfigCheckEndpoint
};
