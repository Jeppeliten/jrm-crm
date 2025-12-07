# Rollhantering med Entra ID-grupper

Detta dokument beskriver hur du konfigurerar och implementerar rollhantering med Entra ID-grupper istället för hårdkodade roller.

## 🏗️ Azure Entra ID Setup

### 1. Skapa Säkerhetsgrupper i Entra ID

I Azure Portal → Azure Active Directory → Groups:

```
Gruppnamn: CRM-Admin
Beskrivning: CRM Administratörer - Full åtkomst
Typ: Security
Medlemskap: Assigned

Gruppnamn: CRM-Manager  
Beskrivning: CRM Managers - Rapporter och analys
Typ: Security
Medlemskap: Assigned

Gruppnamn: CRM-Sales
Beskrivning: CRM Säljare - Grundläggande CRM-funktioner
Typ: Security
Medlemskap: Assigned

Gruppnamn: CRM-Viewer
Beskrivning: CRM Läsare - Endast läsåtkomst
Typ: Security
Medlemskap: Assigned
```

### 2. Konfigurera App Registration

#### Backend App Registration (API):
1. Gå till **App registrations** → Din backend app
2. **Token configuration** → **Add groups claim**
3. Välj **Security groups**
4. **Group ID** format (rekommenderat för API)

#### Frontend App Registration:
1. Gå till **App registrations** → Din frontend app  
2. **Token configuration** → **Add groups claim**
3. Välj **Security groups**
4. **Group ID** format

### 3. Hämta Grupp-IDs

I Azure Portal → Azure Active Directory → Groups:
- Klicka på varje grupp
- Kopiera **Object ID** för varje grupp
- Anteckna mappningen:

```
CRM-Admin:   12345678-1234-1234-1234-123456789abc
CRM-Manager: 23456789-2345-2345-2345-234567890bcd  
CRM-Sales:   34567890-3456-3456-3456-345678901cde
CRM-Viewer:  45678901-4567-4567-4567-456789012def
```

## 🔧 Backend Implementation

### 1. Environment Variables

Lägg till i `server/.env`:

```env
# Azure AD Groups för rollhantering
AZURE_AD_GROUP_ADMIN=12345678-1234-1234-1234-123456789abc
AZURE_AD_GROUP_MANAGER=23456789-2345-2345-2345-234567890bcd
AZURE_AD_GROUP_SALES=34567890-3456-3456-3456-345678901cde
AZURE_AD_GROUP_VIEWER=45678901-4567-4567-4567-456789012def

# Enable group-based roles
USE_AZURE_AD_GROUPS=true
```

### 2. Uppdaterad Middleware

Skapa `server/auth-azure-groups-middleware.js`:

```javascript
/**
 * Azure AD Group-based Role Middleware
 * Mappar Azure AD-grupper till CRM-roller
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

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
// UTILITY FUNCTIONS
// ============================================

/**
 * Mappar Azure AD-grupper till CRM-roller
 */
function mapGroupsToRoles(groups = []) {
  const roles = new Set();
  
  groups.forEach(groupId => {
    const role = GROUP_ROLE_MAPPING[groupId];
    if (role) {
      // Lägg till denna roll och alla lägre roller
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

      // Validera token (använd befintlig validateToken-funktion)
      let user;
      try {
        user = await validateToken(token);
      } catch (validationError) {
        console.error('Token validation failed:', validationError.message);
        return res.status(401).json({
          error: 'Authentication failed',
          code: 'AUTH_FAILED'
        });
      }

      // Extrahera grupper från token
      const userGroups = user.groups || [];
      console.log('User groups:', userGroups);

      // Mappar grupper till roller
      const userRoles = mapGroupsToRoles(userGroups);
      const primaryRole = getPrimaryRole(userGroups);

      console.log('Mapped roles:', userRoles);
      console.log('Primary role:', primaryRole);

      // Kontrollera roller (om specificerat)
      if (options.roles && options.roles.length > 0) {
        const hasRequiredRole = hasAnyRole(userGroups, options.roles);
        
        if (!hasRequiredRole) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            requiredRoles: options.roles,
            userRoles: userRoles
          });
        }
      }

      // Lägg till user i request med rollhantering
      req.user = {
        id: user.oid || user.sub,
        email: user.emails?.[0] || user.email || user.preferred_username,
        name: user.name || `${user.given_name} ${user.family_name}`,
        firstName: user.given_name,
        lastName: user.family_name,
        
        // Gruppbaserad rollhantering
        groups: userGroups,
        roles: userRoles,
        primaryRole: primaryRole,
        
        // För kompatibilitet med befintlig kod
        roll: primaryRole,
        
        tokenClaims: user
      };

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
 * Require manager or higher
 */
function requireManager() {
  return requireRole('manager', 'admin');
}

/**
 * Require sales or higher  
 */
function requireSales() {
  return requireRole('sales', 'manager', 'admin');
}

// Export functions
module.exports = {
  requireAzureAuth,
  requireRole,
  requireAdmin,
  requireManager, 
  requireSales,
  mapGroupsToRoles,
  getPrimaryRole,
  hasRole,
  hasAnyRole,
  GROUP_ROLE_MAPPING,
  ROLE_HIERARCHY
};
```

### 3. Microsoft Graph API för Gruppmembership

Skapa `server/azure-groups-service.js`:

```javascript
/**
 * Azure Groups Service
 * Hanterar gruppmembership via Microsoft Graph API
 */

const https = require('https');

class AzureGroupsService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Hämta access token för Microsoft Graph
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiresAt > Date.now() + 60000) {
      return this.accessToken;
    }

    const tokenData = new URLSearchParams({
      'client_id': process.env.AZURE_B2C_GRAPH_CLIENT_ID,
      'client_secret': process.env.AZURE_B2C_GRAPH_CLIENT_SECRET,
      'scope': 'https://graph.microsoft.com/.default',
      'grant_type': 'client_credentials'
    });

    const response = await this.makeRequest({
      hostname: 'login.microsoftonline.com',
      path: `/${process.env.AZURE_B2C_TENANT_ID}/oauth2/v2.0/token`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenData)
      }
    }, tokenData);

    this.accessToken = response.access_token;
    this.tokenExpiresAt = Date.now() + (response.expires_in * 1000);

    return this.accessToken;
  }

  /**
   * Hämta användarens gruppmembership
   */
  async getUserGroups(userId) {
    const token = await this.getAccessToken();

    const response = await this.makeRequest({
      hostname: 'graph.microsoft.com',
      path: `/v1.0/users/${userId}/memberOf`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // Filtrera endast säkerhetsgrupper
    const securityGroups = response.value
      .filter(group => group['@odata.type'] === '#microsoft.graph.group')
      .filter(group => group.securityEnabled === true)
      .map(group => group.id);

    return securityGroups;
  }

  /**
   * Lägg till användare i grupp
   */
  async addUserToGroup(userId, groupId) {
    const token = await this.getAccessToken();

    const requestBody = JSON.stringify({
      '@odata.id': `https://graph.microsoft.com/v1.0/users/${userId}`
    });

    await this.makeRequest({
      hostname: 'graph.microsoft.com',
      path: `/v1.0/groups/${groupId}/members/$ref`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    }, requestBody);
  }

  /**
   * Ta bort användare från grupp
   */
  async removeUserFromGroup(userId, groupId) {
    const token = await this.getAccessToken();

    await this.makeRequest({
      hostname: 'graph.microsoft.com',
      path: `/v1.0/groups/${groupId}/members/${userId}/$ref`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  /**
   * Hjälpfunktion för HTTP-requests
   */
  makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const response = body ? JSON.parse(body) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${response.error?.message || body}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(data);
      }

      req.end();
    });
  }
}

module.exports = AzureGroupsService;
```

## 🎨 Frontend Implementation

### 1. Uppdatera Azure B2C Config

I `client/azure-b2c-config.js`:

```javascript
const AZURE_B2C_CONFIG = {
  // ... befintlig config

  // Lägg till groups scope
  apiScopes: [
    'openid',
    'profile',
    'email',
    'api://crm-backend/read',
    'api://crm-backend/write',
    'https://graph.microsoft.com/GroupMember.Read.All' // För gruppmembership
  ],

  // Group claims configuration
  optionalClaims: {
    idToken: [
      {
        name: 'groups',
        source: null,
        essential: false,
        additionalProperties: []
      }
    ],
    accessToken: [
      {
        name: 'groups', 
        source: null,
        essential: false,
        additionalProperties: []
      }
    ]
  }
};
```

### 2. Frontend Role Management

I `client/app.js`, lägg till grupphantering:

```javascript
// ============================================
// AZURE GROUPS ROLE MANAGEMENT
// ============================================

const AZURE_GROUP_ROLES = {
  '12345678-1234-1234-1234-123456789abc': 'admin',
  '23456789-2345-2345-2345-234567890bcd': 'manager',
  '34567890-3456-3456-3456-345678901cde': 'sales',
  '45678901-4567-4567-4567-456789012def': 'viewer'
};

const ROLE_HIERARCHY = {
  'admin': ['admin', 'manager', 'sales', 'viewer'],
  'manager': ['manager', 'sales', 'viewer'],
  'sales': ['sales', 'viewer'],
  'viewer': ['viewer']
};

/**
 * Mappar Azure AD-grupper till CRM-roller
 */
function mapGroupsToRoles(groups = []) {
  const roles = new Set();
  
  groups.forEach(groupId => {
    const role = AZURE_GROUP_ROLES[groupId];
    if (role) {
      ROLE_HIERARCHY[role].forEach(r => roles.add(r));
    }
  });
  
  return Array.from(roles);
}

/**
 * Hitta högsta rollen
 */
function getPrimaryRole(groups = []) {
  const priorities = { 'admin': 4, 'manager': 3, 'sales': 2, 'viewer': 1 };
  let highestRole = 'viewer';
  let highestPriority = 0;
  
  groups.forEach(groupId => {
    const role = AZURE_GROUP_ROLES[groupId];
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
function hasRole(requiredRole) {
  if (!AppState.currentUser) return false;
  
  const userRoles = AppState.currentUser.roles || [];
  return userRoles.includes(requiredRole);
}

/**
 * Uppdatera UI baserat på roller från Azure-grupper
 */
function updateUIForGroupRoles() {
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const isSales = hasRole('sales');
  
  // Admin-funktioner
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? 'block' : 'none';
  });
  
  // Manager+ funktioner
  document.querySelectorAll('.manager-plus').forEach(el => {
    el.style.display = (isAdmin || isManager) ? 'block' : 'none';
  });
  
  // Sales+ funktioner
  document.querySelectorAll('.sales-plus').forEach(el => {
    el.style.display = (isAdmin || isManager || isSales) ? 'block' : 'none';
  });
  
  // Disable knappar för otillräckliga behörigheter
  document.querySelectorAll('.require-admin').forEach(btn => {
    btn.disabled = !isAdmin;
    if (!isAdmin) {
      btn.title = 'Kräver administratörsbehörighet';
    }
  });
}

/**
 * Azure login success med grupphantering
 */
async function onAzureLoginSuccess() {
  const user = azureAuth.getUser();
  console.log('Azure login successful:', user);
  
  // Extrahera grupper från token
  const userGroups = user.groups || [];
  const userRoles = mapGroupsToRoles(userGroups);
  const primaryRole = getPrimaryRole(userGroups);
  
  AppState.currentUser = {
    id: user.oid || user.sub,
    username: user.email,
    name: user.name,
    email: user.email,
    
    // Gruppbaserad rollhantering
    groups: userGroups,
    roles: userRoles,
    roll: primaryRole, // För kompatibilitet
    primaryRole: primaryRole,
    
    azureId: user.oid || user.sub
  };
  
  console.log('User roles from groups:', userRoles);
  console.log('Primary role:', primaryRole);
  
  await loadState();
  showView('dashboard');
  updateUIForGroupRoles();
  
  showNotification(`Välkommen ${user.name}! (${primaryRole})`, 'success');
}
```

## 🔧 Backend Integration

### 1. Uppdatera index.js

```javascript
// Importera den nya gruppbaserade middlewaren
const {
  requireAzureAuth,
  requireRole,
  requireAdmin,
  requireManager,
  requireSales
} = require('./auth-azure-groups-middleware');

const AzureGroupsService = require('./azure-groups-service');
const groupsService = new AzureGroupsService();

// ============================================
// ROLL-BASERADE ENDPOINTS
// ============================================

// Alla autentiserade användare (viewer+)
app.get('/api/companies', requireAzureAuth(), (req, res) => {
  console.log(`User ${req.user.email} (${req.user.primaryRole}) accessing companies`);
  res.json(state.companies);
});

// Sales+ behörigheter
app.post('/api/companies', requireSales(), createCompany);
app.put('/api/companies/:id', requireSales(), updateCompany);

// Manager+ behörigheter  
app.get('/api/reports', requireManager(), getReports);
app.post('/api/enrich', requireManager(), enrichData);

// Admin-only behörigheter
app.delete('/api/companies/:id', requireAdmin(), deleteCompany);
app.get('/api/audit-log', requireAdmin(), getAuditLog);

// ============================================
// GROUP MANAGEMENT ENDPOINTS
// ============================================

// Hämta användarens grupper
app.get('/api/user/groups', requireAzureAuth(), async (req, res) => {
  try {
    const userGroups = await groupsService.getUserGroups(req.user.id);
    res.json({
      groups: userGroups,
      roles: mapGroupsToRoles(userGroups),
      primaryRole: getPrimaryRole(userGroups)
    });
  } catch (error) {
    console.error('Failed to get user groups:', error);
    res.status(500).json({ error: 'Failed to get groups' });
  }
});

// Lägg till användare i grupp (admin only)
app.post('/api/admin/users/:userId/groups/:groupId', requireAdmin(), async (req, res) => {
  try {
    await groupsService.addUserToGroup(req.params.userId, req.params.groupId);
    res.json({ success: true, message: 'User added to group' });
  } catch (error) {
    console.error('Failed to add user to group:', error);
    res.status(500).json({ error: 'Failed to add user to group' });
  }
});

// Ta bort användare från grupp (admin only)
app.delete('/api/admin/users/:userId/groups/:groupId', requireAdmin(), async (req, res) => {
  try {
    await groupsService.removeUserFromGroup(req.params.userId, req.params.groupId);
    res.json({ success: true, message: 'User removed from group' });
  } catch (error) {
    console.error('Failed to remove user from group:', error);
    res.status(500).json({ error: 'Failed to remove user from group' });
  }
});
```

## 📋 Sammanfattning

### Fördelar med Gruppbaserad Rollhantering:

1. **Centraliserad hantering** - Alla roller hanteras i Entra ID
2. **Automatisk synkronisering** - Gruppändringar träder i kraft omedelbart
3. **Säkerhet** - Roller inkluderas i JWT tokens
4. **Skalbarhet** - Enkelt att lägga till nya roller/grupper
5. **Audit trail** - Alla gruppändringar loggas i Entra ID

### Nästa Steg:

1. Skapa grupperna i Azure Portal
2. Implementera den uppdaterade middlewaren
3. Testa rollbaserade behörigheter
4. Migrera befintliga användare till grupperna
5. Implementera admin UI för grupphantering

Denna implementation ger dig företagsklass rollhantering med full integration mellan Azure Entra ID och ditt CRM-system!