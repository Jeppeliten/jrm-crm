/**
 * Azure AD User Sync Routes
 * Synkroniserar användare med CRM-roller från Azure AD till CRM-databasen
 */

const express = require('express');
const router = express.Router();

// Azure AD App Registration config
const AZURE_CONFIG = {
  tenantId: process.env.AZURE_TENANT_ID || process.env.AZURE_B2C_TENANT_ID,
  clientId: process.env.AZURE_CLIENT_ID || process.env.AZURE_B2C_GRAPH_CLIENT_ID || '54121bc9-f692-40da-a114-cd3042ac46b2',
  clientSecret: process.env.AZURE_CLIENT_SECRET || process.env.AZURE_B2C_GRAPH_CLIENT_SECRET,
  // Service Principal ID för JRM-CRM-App
  servicePrincipalId: process.env.AZURE_SERVICE_PRINCIPAL_ID || 'fa705e5f-a801-43de-bc76-a266ab06b0a3',
  // App Role IDs
  appRoles: {
    admin: '2483cfc7-dadb-4a12-bd00-3c1be7b09a1a',
    salesperson: '945488b0-82eb-492b-93c1-febd81e9db81'
  }
};

let accessToken = null;
let tokenExpiresAt = null;

/**
 * Hämta access token för Microsoft Graph API
 */
async function getAccessToken() {
  // Återanvänd token om det fortfarande är giltigt
  if (accessToken && tokenExpiresAt && tokenExpiresAt > Date.now() + 5 * 60 * 1000) {
    return accessToken;
  }

  if (!AZURE_CONFIG.tenantId || !AZURE_CONFIG.clientSecret) {
    throw new Error('Azure AD credentials not configured. Set AZURE_TENANT_ID and AZURE_CLIENT_SECRET.');
  }

  const tokenUrl = `https://login.microsoftonline.com/${AZURE_CONFIG.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: AZURE_CONFIG.clientId,
    client_secret: AZURE_CONFIG.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${response.status} - ${error}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  return accessToken;
}

/**
 * Hämta alla användare med CRM app-roller
 */
async function getCrmRoleAssignments() {
  const token = await getAccessToken();
  
  const url = `https://graph.microsoft.com/v1.0/servicePrincipals/${AZURE_CONFIG.servicePrincipalId}/appRoleAssignedTo`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get role assignments: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Filtrera bort default role (00000000-...)
  return data.value.filter(assignment => 
    assignment.appRoleId === AZURE_CONFIG.appRoles.admin ||
    assignment.appRoleId === AZURE_CONFIG.appRoles.salesperson
  );
}

/**
 * Hämta användardetaljer från Azure AD
 */
async function getUserDetails(userId) {
  const token = await getAccessToken();
  
  const url = `https://graph.microsoft.com/v1.0/users/${userId}?$select=id,displayName,mail,givenName,surname,userPrincipalName`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    console.error(`Failed to get user ${userId}: ${response.status}`);
    return null;
  }

  return response.json();
}

/**
 * Synka användare till CRM-databasen
 */
async function syncUserToDatabase(db, userDetails, appRoleId) {
  const roleMapping = {
    [AZURE_CONFIG.appRoles.admin]: { role: 'admin', appRole: 'Admin' },
    [AZURE_CONFIG.appRoles.salesperson]: { role: 'user', appRole: 'Salesperson' }
  };

  const roleInfo = roleMapping[appRoleId] || { role: 'user', appRole: 'Unknown' };

  const user = {
    _id: userDetails.id,
    azureAdId: userDetails.id,
    email: userDetails.mail || userDetails.userPrincipalName,
    displayName: userDetails.displayName,
    firstName: userDetails.givenName || '',
    lastName: userDetails.surname || '',
    isActive: true,
    crmMetadata: {
      role: roleInfo.role,
      appRole: roleInfo.appRole,
      appRoleId: appRoleId
    },
    source: 'azure-ad',
    updatedAt: new Date()
  };

  // Upsert - uppdatera om finns, skapa om inte
  const result = await db.collection('users').updateOne(
    { _id: user._id },
    { 
      $set: user,
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );

  return {
    user: user.displayName,
    role: roleInfo.appRole,
    action: result.upsertedCount > 0 ? 'created' : 'updated'
  };
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/users/debug
 * Debug: Visa direkt vad som finns i users-collectionen
 */
router.get('/debug', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.json({ 
        error: 'No database connection',
        dbAvailable: false,
        hint: 'req.app.locals.db is not set'
      });
    }

    const dbName = db.databaseName;
    const users = await db.collection('users').find({}).limit(10).toArray();
    const count = await db.collection('users').countDocuments();

    // Lista alla collections
    const collections = await db.listCollections().toArray();

    res.json({
      dbAvailable: true,
      databaseName: dbName,
      totalUsers: count,
      collections: collections.map(c => c.name),
      users: users.map(u => ({
        _id: u._id,
        displayName: u.displayName,
        email: u.email,
        role: u.crmMetadata?.appRole
      }))
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /api/users/sync-status
 * Visa sync-status och konfiguration
 */
router.get('/sync-status', (req, res) => {
  res.json({
    configured: !!(AZURE_CONFIG.tenantId && AZURE_CONFIG.clientSecret),
    servicePrincipalId: AZURE_CONFIG.servicePrincipalId,
    appRoles: {
      admin: 'CRM Admin - Full access',
      salesperson: 'CRM Salesperson - Sales access'
    },
    tokenValid: !!(accessToken && tokenExpiresAt && tokenExpiresAt > Date.now())
  });
});

/**
 * POST /api/users/sync-from-azure
 * Synka alla användare med CRM-roller från Azure AD
 */
router.post('/sync-from-azure', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    console.log('🔄 Starting Azure AD user sync...');

    // Hämta alla CRM role assignments
    const roleAssignments = await getCrmRoleAssignments();
    console.log(`Found ${roleAssignments.length} users with CRM roles`);

    const results = [];

    for (const assignment of roleAssignments) {
      try {
        // Hämta full användarinfo
        const userDetails = await getUserDetails(assignment.principalId);
        
        if (userDetails) {
          // Synka till databasen
          const result = await syncUserToDatabase(db, userDetails, assignment.appRoleId);
          results.push(result);
          console.log(`✅ ${result.action}: ${result.user} (${result.role})`);
        }
      } catch (error) {
        console.error(`❌ Failed to sync user ${assignment.principalDisplayName}:`, error.message);
        results.push({
          user: assignment.principalDisplayName,
          error: error.message
        });
      }
    }

    // Hämta alla användare för att visa resultat
    const allUsers = await db.collection('users').find({}).toArray();

    res.json({
      success: true,
      message: `Synced ${results.filter(r => !r.error).length} users from Azure AD`,
      syncedUsers: results,
      totalUsersInDb: allUsers.length,
      users: allUsers.map(u => ({
        id: u._id,
        name: u.displayName,
        email: u.email,
        role: u.crmMetadata?.appRole || 'Unknown'
      }))
    });

  } catch (error) {
    console.error('❌ Azure AD sync failed:', error);
    res.status(500).json({
      error: 'Azure AD sync failed',
      message: error.message,
      hint: 'Make sure AZURE_TENANT_ID and AZURE_CLIENT_SECRET are configured'
    });
  }
});

/**
 * GET /api/users/azure-roles
 * Visa vilka användare som har CRM-roller i Azure AD (utan att synka)
 */
router.get('/azure-roles', async (req, res) => {
  try {
    const roleAssignments = await getCrmRoleAssignments();
    
    const users = roleAssignments.map(assignment => ({
      name: assignment.principalDisplayName,
      principalId: assignment.principalId,
      role: assignment.appRoleId === AZURE_CONFIG.appRoles.admin ? 'CRM Admin' : 'CRM Salesperson',
      assignedAt: assignment.createdDateTime
    }));

    res.json({
      totalWithCrmRoles: users.length,
      users
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch Azure AD roles',
      message: error.message
    });
  }
});

module.exports = router;
