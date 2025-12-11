# 🔧 Fix: "Hantera kunder" knappen fungerar inte

## Problem
Knappen "Hantera kunder" i Inställningar går inte att klicka på.

## Orsak
Event listenern för `#manageCustomers` kördes i `setupUserManagementHandlers()` vid sidladdning, men knappen finns **inte i DOM:en än** eftersom den är inne i en `<template>` som renderas senare när användaren går till Settings-vyn.

## Lösning ✅

Event listenern flyttades till `renderSettings()` där knappen faktiskt finns i DOM:en.

### Ändring i app.js:

```javascript
function renderSettings() {
  const root = document.getElementById('view-settings');
  renderTemplate('tpl-settings', root);
  document.getElementById('manageUsers').addEventListener('click', () => openUsersModal());
  
  // ✅ TILLAGT: Add event listener for Manage Customers button
  const manageCustomersBtn = document.getElementById('manageCustomers');
  if (manageCustomersBtn) {
    manageCustomersBtn.addEventListener('click', openManageCustomersModal);
  }
  
  const btn = document.createElement('button');
  // ... rest of function
}
```

## Test

1. Öppna `index.html` i webbläsare
2. Klicka på **"Inställningar"** i sidomenyn
3. Klicka på **"Hantera kunder"** knappen
4. ✅ Modal ska öppnas!

## Verifierat
- ✅ Syntax validerad: `node --check app.js`
- ✅ Event listener kopplas när Settings renderas
- ✅ Knappen är nu klickbar

**Nu fungerar det! 🎉**
