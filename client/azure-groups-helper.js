/**
 * Azure AD Groups Frontend Helper
 * Hjälpfunktioner för gruppbaserad rollhantering på frontend
 */

'use strict';

// ============================================
// GROUP-ROLE MAPPINGS (matcha backend)
// ============================================

const AZURE_GROUP_ROLES = {
  // Uppdatera dessa med dina faktiska Group IDs från Azure Portal
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

const ROLE_NAMES = {
  'admin': 'Administratör',
  'manager': 'Manager',
  'sales': 'Säljare',
  'viewer': 'Läsare'
};

const ROLE_DESCRIPTIONS = {
  'admin': 'Full åtkomst till alla funktioner',
  'manager': 'Rapporter, analys och teamhantering',
  'sales': 'Grundläggande CRM-funktioner',
  'viewer': 'Endast läsåtkomst'
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
    const role = AZURE_GROUP_ROLES[groupId];
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
 * Kontrollera om användare har någon av de angivna rollerna
 */
function hasAnyRole(requiredRoles) {
  if (!AppState.currentUser) return false;
  
  return requiredRoles.some(role => hasRole(role));
}

/**
 * Få användarens primära roll
 */
function getUserPrimaryRole() {
  return AppState.currentUser?.primaryRole || 'viewer';
}

/**
 * Få alla användarens roller
 */
function getUserRoles() {
  return AppState.currentUser?.roles || ['viewer'];
}

/**
 * Få användarens grupper
 */
function getUserGroups() {
  return AppState.currentUser?.groups || [];
}

/**
 * Formatera rollnamn för visning
 */
function formatRoleName(role) {
  return ROLE_NAMES[role] || role;
}

/**
 * Få rollbeskrivning
 */
function getRoleDescription(role) {
  return ROLE_DESCRIPTIONS[role] || '';
}

/**
 * Skapa rollbadge HTML
 */
function createRoleBadge(role) {
  const colors = {
    'admin': 'bg-red-100 text-red-800',
    'manager': 'bg-blue-100 text-blue-800',
    'sales': 'bg-green-100 text-green-800',
    'viewer': 'bg-gray-100 text-gray-800'
  };

  const colorClass = colors[role] || colors['viewer'];
  
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}">
    ${formatRoleName(role)}
  </span>`;
}

// ============================================
// UI MANAGEMENT
// ============================================

/**
 * Uppdatera UI baserat på roller från Azure-grupper
 */
function updateUIForGroupRoles() {
  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const isSales = hasRole('sales');
  const isViewer = hasRole('viewer');
  
  console.log('Updating UI for roles:', {
    admin: isAdmin,
    manager: isManager,
    sales: isSales,
    viewer: isViewer,
    primaryRole: getUserPrimaryRole()
  });

  // Admin-endast funktioner
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? 'block' : 'none';
  });
  
  // Manager+ funktioner (manager, admin)
  document.querySelectorAll('.manager-plus').forEach(el => {
    el.style.display = (isAdmin || isManager) ? 'block' : 'none';
  });
  
  // Sales+ funktioner (sales, manager, admin)
  document.querySelectorAll('.sales-plus').forEach(el => {
    el.style.display = (isAdmin || isManager || isSales) ? 'block' : 'none';
  });

  // Viewer+ funktioner (alla)
  document.querySelectorAll('.viewer-plus').forEach(el => {
    el.style.display = isViewer ? 'block' : 'none';
  });
  
  // Disable knappar för otillräckliga behörigheter
  document.querySelectorAll('.require-admin').forEach(btn => {
    btn.disabled = !isAdmin;
    if (!isAdmin) {
      btn.title = 'Kräver administratörsbehörighet';
      btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  });

  document.querySelectorAll('.require-manager').forEach(btn => {
    const hasPermission = isAdmin || isManager;
    btn.disabled = !hasPermission;
    if (!hasPermission) {
      btn.title = 'Kräver manager-behörighet eller högre';
      btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  });

  document.querySelectorAll('.require-sales').forEach(btn => {
    const hasPermission = isAdmin || isManager || isSales;
    btn.disabled = !hasPermission;
    if (!hasPermission) {
      btn.title = 'Kräver sales-behörighet eller högre';
      btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  });

  // Uppdatera användarinfo i UI
  updateUserRoleDisplay();
}

/**
 * Uppdatera användarens rollvisning i UI
 */
function updateUserRoleDisplay() {
  // Uppdatera huvudmeny användarinfo
  const userRoleEl = document.getElementById('userRole');
  if (userRoleEl) {
    const primaryRole = getUserPrimaryRole();
    userRoleEl.innerHTML = createRoleBadge(primaryRole);
  }

  // Uppdatera användarmenyn med alla roller
  const userRolesEl = document.getElementById('userRoles');
  if (userRolesEl) {
    const roles = getUserRoles();
    userRolesEl.innerHTML = roles.map(role => createRoleBadge(role)).join(' ');
  }

  // Uppdatera användarnamn och roll i header
  const userNameEl = document.getElementById('userName');
  if (userNameEl && AppState.currentUser) {
    const primaryRole = getUserPrimaryRole();
    userNameEl.textContent = `${AppState.currentUser.name} (${formatRoleName(primaryRole)})`;
  }
}

/**
 * Visa rollhanteringsmodal (admin-only)
 */
function showUserRoleManagement() {
  if (!hasRole('admin')) {
    showNotification('Endast administratörer kan hantera roller', 'error');
    return;
  }

  // Implementera modal för rollhantering
  // Detta kan utökas med fullständig användarhantering
  console.log('Show user role management modal');
}

// ============================================
// AZURE LOGIN INTEGRATION
// ============================================

/**
 * Azure login success med grupphantering
 */
async function onAzureLoginSuccessWithGroups() {
  const user = azureAuth.getUser();
  console.log('Azure login successful:', user);
  
  // Extrahera grupper från token
  const userGroups = user.groups || [];
  const userRoles = mapGroupsToRoles(userGroups);
  const primaryRole = getPrimaryRole(userGroups);
  
  console.log('User groups from token:', userGroups);
  console.log('Mapped roles:', userRoles);
  console.log('Primary role:', primaryRole);
  
  AppState.currentUser = {
    id: user.oid || user.sub,
    username: user.email,
    name: user.name,
    email: user.email,
    
    // Gruppbaserad rollhantering
    groups: userGroups,
    roles: userRoles,
    roll: primaryRole, // För kompatibilitet med befintlig kod
    primaryRole: primaryRole,
    
    // Metadata
    firstName: user.given_name,
    lastName: user.family_name,
    azureId: user.oid || user.sub
  };
  
  await loadState();
  showView('dashboard');
  updateUIForGroupRoles();
  
  const roleText = formatRoleName(primaryRole);
  showNotification(`Välkommen ${user.name}! (${roleText})`, 'success');
}

// ============================================
// API HELPERS
// ============================================

/**
 * Hämta användarens grupper från backend
 */
async function fetchUserGroups() {
  try {
    const response = await azureAuth.authenticatedFetch('/api/user/groups');
    if (!response.ok) {
      throw new Error('Failed to fetch user groups');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch user groups:', error);
    throw error;
  }
}

/**
 * Lägg till användare i grupp (admin-only)
 */
async function addUserToGroup(userId, groupId) {
  if (!hasRole('admin')) {
    throw new Error('Insufficient permissions');
  }

  try {
    const response = await azureAuth.authenticatedFetch(`/api/admin/users/${userId}/groups/${groupId}`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Failed to add user to group');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to add user to group:', error);
    throw error;
  }
}

/**
 * Ta bort användare från grupp (admin-only)
 */
async function removeUserFromGroup(userId, groupId) {
  if (!hasRole('admin')) {
    throw new Error('Insufficient permissions');
  }

  try {
    const response = await azureAuth.authenticatedFetch(`/api/admin/users/${userId}/groups/${groupId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to remove user from group');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to remove user from group:', error);
    throw error;
  }
}

// ============================================
// DEBUG HELPERS
// ============================================

/**
 * Logga grupperinformation för debugging
 */
function debugUserGroups() {
  if (!AppState.currentUser) {
    console.log('No current user');
    return;
  }

  console.group('=== Azure AD Groups Debug ===');
  console.log('User:', AppState.currentUser.name);
  console.log('Groups:', AppState.currentUser.groups);
  console.log('Mapped roles:', AppState.currentUser.roles);
  console.log('Primary role:', AppState.currentUser.primaryRole);
  console.log('Group mappings:', AZURE_GROUP_ROLES);
  console.groupEnd();
}

// ============================================
// EXPORTS (för testing)
// ============================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mapGroupsToRoles,
    getPrimaryRole,
    hasRole,
    hasAnyRole,
    formatRoleName,
    createRoleBadge,
    updateUIForGroupRoles,
    AZURE_GROUP_ROLES,
    ROLE_HIERARCHY,
    ROLE_NAMES
  };
}