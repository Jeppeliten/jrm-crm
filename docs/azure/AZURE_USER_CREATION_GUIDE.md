# 👤 Azure B2C User Creation från CRM

## 📖 Översikt

Detta system låter säljare **skapa nya användare direkt i Azure B2C från CRM:et**. Perfekt för när en säljare har sålt en tjänst och vill ge kunden omedelbar tillgång.

---

## 🎯 Användningsfall

### Scenario 1: Säljare säljer tjänst till ny kund

```
1. Säljare pratar med mäklare Anna Andersson från ERA Malmö
2. Anna vill ha tillgång till "Värderingsdata Premium"
3. Säljare loggar in i CRM
4. Klickar "➕ Ny användare"
5. Fyller i formulär:
   - Namn: Anna Andersson
   - E-post: anna@era.se
   - Företag: ERA Malmö (välj från dropdown)
   - Tjänster: [✓] Värderingsdata Premium
   - Roll: Mäklare
6. Klickar "Skapa användare"

   ↓ AUTOMATISKT:

   ✅ Användare skapas i Azure B2C
   ✅ Temporärt lösenord genereras
   ✅ Välkomstmail skickas till anna@era.se
   ✅ Användare läggs till i CRM
   ✅ Kopplas till ERA Malmö
   ✅ Audit log skapas

7. Anna får mail med inloggningsuppgifter
8. Anna loggar in och börjar använda tjänsten
```

### Scenario 2: Ge befintlig användare tillgång till ny tjänst

```
1. Användare Johan har redan konto
2. Han köper "Rapport Pro" tillägg
3. Säljare går till Johans profil i CRM
4. Klickar "➕ Lägg till tjänst"
5. Väljer "Rapport Pro"
6. Sätter utgångsdatum (optional): 2026-01-01

   ↓ AUTOMATISKT:

   ✅ Tjänst läggs till i Azure B2C
   ✅ Tjänst läggs till i CRM
   ✅ Notifikation skickas till Johan
   ✅ Johan ser ny tjänst nästa gång han loggar in
```

### Scenario 3: Inaktivera användare (kunden avslutar)

```
1. Kund vill avsluta sitt konto
2. Manager går till användarens profil
3. Klickar "Inaktivera användare"

   ↓ AUTOMATISKT:

   ✅ Användare inaktiveras i Azure B2C (kan inte logga in)
   ✅ Status uppdateras i CRM
   ✅ Alla tjänster stannar
   ✅ Audit log skapas
```

---

## 🔌 API Endpoints

### 1. Skapa ny användare

```javascript
POST /api/users/create-in-b2c
Authorization: Bearer <sales-or-higher-jwt-token>

Request Body:
{
  "email": "anna@era.se",
  "firstName": "Anna",
  "lastName": "Andersson",
  "displayName": "Anna Andersson",
  "companyId": "company-123",
  "companyName": "ERA Malmö",
  "role": "sales",
  "services": ["Värderingsdata Premium", "Rapport Pro"],
  "phone": "+46701234567",
  "sendInviteEmail": true
}

Response (Success):
{
  "success": true,
  "user": {
    "id": "b2c-abc-123-def",
    "azureB2CId": "abc-123-def",
    "email": "anna@era.se",
    "name": "Anna Andersson",
    "role": "sales",
    "companyId": "company-123",
    "services": [
      {
        "name": "Värderingsdata Premium",
        "grantedAt": "2025-10-08T12:00:00Z",
        "active": true
      }
    ],
    "isActive": true,
    "source": "crm-created"
  },
  "temporaryPassword": null,  // null om sendInviteEmail=true
  "message": "Användare skapad i Azure B2C"
}

Response (Error):
{
  "success": false,
  "error": "Email already exists in Azure B2C"
}
```

**Permissions:** Sales, Manager, Admin

---

### 2. Ge tillgång till tjänst

```javascript
POST /api/users/:userId/grant-service
Authorization: Bearer <sales-or-higher-jwt-token>

Request Body:
{
  "serviceName": "Rapport Pro",
  "expiresAt": "2026-01-01T00:00:00Z"  // Optional
}

Response:
{
  "success": true,
  "service": "Rapport Pro",
  "expiresAt": "2026-01-01T00:00:00Z",
  "message": "Tillgång till Rapport Pro beviljad"
}
```

**Permissions:** Sales, Manager, Admin

---

### 3. Ta bort tillgång till tjänst

```javascript
POST /api/users/:userId/revoke-service
Authorization: Bearer <manager-or-admin-jwt-token>

Request Body:
{
  "serviceName": "Rapport Pro"
}

Response:
{
  "success": true,
  "message": "Tillgång till Rapport Pro återkallad"
}
```

**Permissions:** Manager, Admin

---

### 4. Uppdatera användarroll

```javascript
PATCH /api/users/:userId/role
Authorization: Bearer <manager-or-admin-jwt-token>

Request Body:
{
  "role": "manager"  // sales, manager, admin
}

Response:
{
  "success": true,
  "message": "Roll uppdaterad"
}
```

**Permissions:** Manager, Admin

---

### 5. Inaktivera användare

```javascript
POST /api/users/:userId/disable
Authorization: Bearer <manager-or-admin-jwt-token>

Response:
{
  "success": true,
  "message": "Användare inaktiverad"
}
```

**Permissions:** Manager, Admin

---

### 6. Aktivera användare

```javascript
POST /api/users/:userId/enable
Authorization: Bearer <manager-or-admin-jwt-token>

Response:
{
  "success": true,
  "message": "Användare aktiverad"
}
```

**Permissions:** Manager, Admin

---

### 7. Återställ lösenord

```javascript
POST /api/users/:userId/reset-password
Authorization: Bearer <manager-or-admin-jwt-token>

Request Body:
{
  "sendEmail": true  // Om false, returneras lösenordet i response
}

Response (sendEmail=true):
{
  "success": true,
  "temporaryPassword": null,
  "message": "Lösenord återställt och mail skickat"
}

Response (sendEmail=false):
{
  "success": true,
  "temporaryPassword": "xK9@mP2$vL4#qR7!",
  "message": "Lösenord återställt"
}
```

**Permissions:** Manager, Admin

---

### 8. Radera användare

```javascript
DELETE /api/users/:userId
Authorization: Bearer <admin-jwt-token>

Request Body:
{
  "deleteFromB2C": true  // Om true, raderas även från Azure B2C
}

Response:
{
  "success": true,
  "message": "Användare raderad från både CRM och Azure B2C"
}
```

**Permissions:** Admin only

---

## 🎨 Frontend Integration

### Formulär för att skapa användare

```html
<!-- index.html -->

<div id="createUserModal" class="modal">
  <div class="modal-content">
    <h2>➕ Skapa ny användare</h2>
    
    <form id="createUserForm">
      <div class="form-group">
        <label>Förnamn *</label>
        <input type="text" id="userFirstName" required>
      </div>
      
      <div class="form-group">
        <label>Efternamn *</label>
        <input type="text" id="userLastName" required>
      </div>
      
      <div class="form-group">
        <label>E-post *</label>
        <input type="email" id="userEmail" required>
      </div>
      
      <div class="form-group">
        <label>Telefon</label>
        <input type="tel" id="userPhone">
      </div>
      
      <div class="form-group">
        <label>Företag</label>
        <select id="userCompany">
          <option value="">Välj företag...</option>
          <!-- Populated from state.companies -->
        </select>
      </div>
      
      <div class="form-group">
        <label>Roll</label>
        <select id="userRole">
          <option value="sales">Mäklare (Sales)</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>Tjänster</label>
        <div class="checkbox-group">
          <label>
            <input type="checkbox" name="service" value="Värderingsdata Premium">
            Värderingsdata Premium
          </label>
          <label>
            <input type="checkbox" name="service" value="Rapport Pro">
            Rapport Pro
          </label>
          <label>
            <input type="checkbox" name="service" value="API Access">
            API Access
          </label>
        </div>
      </div>
      
      <div class="form-group">
        <label>
          <input type="checkbox" id="sendInviteEmail" checked>
          Skicka välkomstmail med inloggningsuppgifter
        </label>
      </div>
      
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Skapa användare</button>
        <button type="button" class="btn btn-secondary" onclick="closeCreateUserModal()">
          Avbryt
        </button>
      </div>
    </form>
  </div>
</div>
```

### JavaScript funktioner

```javascript
// app.js

/**
 * Öppna modal för att skapa användare
 */
function openCreateUserModal() {
  // Populera företag i dropdown
  const companySelect = document.getElementById('userCompany');
  companySelect.innerHTML = '<option value="">Välj företag...</option>';
  
  state.companies.forEach(company => {
    const option = document.createElement('option');
    option.value = company.id;
    option.textContent = company.name;
    option.dataset.companyName = company.name;
    companySelect.appendChild(option);
  });
  
  document.getElementById('createUserModal').style.display = 'block';
}

/**
 * Skapa ny användare i Azure B2C
 */
async function createUserInB2C(event) {
  event.preventDefault();
  
  const firstName = document.getElementById('userFirstName').value;
  const lastName = document.getElementById('userLastName').value;
  const email = document.getElementById('userEmail').value;
  const phone = document.getElementById('userPhone').value;
  const companySelect = document.getElementById('userCompany');
  const role = document.getElementById('userRole').value;
  const sendInviteEmail = document.getElementById('sendInviteEmail').checked;
  
  // Hämta valda tjänster
  const services = Array.from(document.querySelectorAll('input[name="service"]:checked'))
    .map(cb => cb.value);
  
  // Company info
  const companyId = companySelect.value;
  const companyName = companySelect.options[companySelect.selectedIndex]?.dataset.companyName;
  
  try {
    showNotification('Skapar användare i Azure B2C...', 'info');
    
    const response = await azureAuth.authenticatedFetch('/api/users/create-in-b2c', {
      method: 'POST',
      body: JSON.stringify({
        email,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        companyId,
        companyName,
        role,
        services,
        phone,
        sendInviteEmail
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create user');
    }
    
    const result = await response.json();
    
    // Lägg till i lokal state
    AppState.users.push(result.user);
    
    // Visa meddelande
    let message = `Användare ${email} skapad!`;
    if (sendInviteEmail) {
      message += ' Välkomstmail skickat.';
    } else if (result.temporaryPassword) {
      message += `\n\nTemporärt lösenord: ${result.temporaryPassword}\n\n⚠️ Spara detta nu! Det visas inte igen.`;
    }
    
    showNotification(message, 'success');
    
    // Stäng modal och återställ formulär
    closeCreateUserModal();
    document.getElementById('createUserForm').reset();
    
    // Uppdatera användarlistan
    renderUsersTable();
    
  } catch (error) {
    console.error('Failed to create user:', error);
    showNotification('Kunde inte skapa användare: ' + error.message, 'error');
  }
}

// Bind form submit
document.getElementById('createUserForm').addEventListener('submit', createUserInB2C);

/**
 * Ge användare tillgång till tjänst
 */
async function grantServiceAccess(userId, serviceName, expiresAt = null) {
  try {
    showNotification(`Ger tillgång till ${serviceName}...`, 'info');
    
    const response = await azureAuth.authenticatedFetch(`/api/users/${userId}/grant-service`, {
      method: 'POST',
      body: JSON.stringify({
        serviceName,
        expiresAt
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to grant service access');
    }
    
    const result = await response.json();
    
    // Uppdatera lokal state
    const user = AppState.users.find(u => u.id === userId);
    if (user) {
      if (!user.services) user.services = [];
      user.services.push({
        name: serviceName,
        grantedAt: new Date().toISOString(),
        expiresAt: expiresAt,
        active: true
      });
    }
    
    showNotification(result.message, 'success');
    renderUsersTable();
    
  } catch (error) {
    console.error('Failed to grant service:', error);
    showNotification('Kunde inte ge tillgång till tjänst', 'error');
  }
}

/**
 * Ta bort tillgång till tjänst
 */
async function revokeServiceAccess(userId, serviceName) {
  if (!confirm(`Är du säker på att du vill ta bort tillgång till ${serviceName}?`)) {
    return;
  }
  
  try {
    const response = await azureAuth.authenticatedFetch(`/api/users/${userId}/revoke-service`, {
      method: 'POST',
      body: JSON.stringify({ serviceName })
    });
    
    if (!response.ok) {
      throw new Error('Failed to revoke service access');
    }
    
    const result = await response.json();
    
    // Uppdatera lokal state
    const user = AppState.users.find(u => u.id === userId);
    if (user && user.services) {
      user.services = user.services.filter(s => s.name !== serviceName);
    }
    
    showNotification(result.message, 'success');
    renderUsersTable();
    
  } catch (error) {
    console.error('Failed to revoke service:', error);
    showNotification('Kunde inte ta bort tjänst', 'error');
  }
}

/**
 * Inaktivera användare
 */
async function disableUser(userId) {
  if (!confirm('Är du säker på att du vill inaktivera denna användare?')) {
    return;
  }
  
  try {
    const response = await azureAuth.authenticatedFetch(`/api/users/${userId}/disable`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Failed to disable user');
    }
    
    const result = await response.json();
    
    // Uppdatera lokal state
    const user = AppState.users.find(u => u.id === userId);
    if (user) {
      user.isActive = false;
    }
    
    showNotification(result.message, 'success');
    renderUsersTable();
    
  } catch (error) {
    console.error('Failed to disable user:', error);
    showNotification('Kunde inte inaktivera användare', 'error');
  }
}

/**
 * Aktivera användare
 */
async function enableUser(userId) {
  try {
    const response = await azureAuth.authenticatedFetch(`/api/users/${userId}/enable`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Failed to enable user');
    }
    
    const result = await response.json();
    
    // Uppdatera lokal state
    const user = AppState.users.find(u => u.id === userId);
    if (user) {
      user.isActive = true;
    }
    
    showNotification(result.message, 'success');
    renderUsersTable();
    
  } catch (error) {
    console.error('Failed to enable user:', error);
    showNotification('Kunde inte aktivera användare', 'error');
  }
}

/**
 * Återställ lösenord
 */
async function resetUserPassword(userId, sendEmail = true) {
  if (!confirm('Är du säker på att du vill återställa lösenordet för denna användare?')) {
    return;
  }
  
  try {
    showNotification('Återställer lösenord...', 'info');
    
    const response = await azureAuth.authenticatedFetch(`/api/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ sendEmail })
    });
    
    if (!response.ok) {
      throw new Error('Failed to reset password');
    }
    
    const result = await response.json();
    
    if (result.temporaryPassword) {
      // Visa lösenordet om det inte skickades via mail
      alert(`Nytt temporärt lösenord:\n\n${result.temporaryPassword}\n\n⚠️ Spara detta nu! Det visas inte igen.`);
    } else {
      showNotification('Lösenord återställt och mail skickat till användaren', 'success');
    }
    
  } catch (error) {
    console.error('Failed to reset password:', error);
    showNotification('Kunde inte återställa lösenord', 'error');
  }
}

/**
 * Uppdatera användartabell med actions
 */
function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';
  
  AppState.users.forEach(user => {
    const tr = document.createElement('tr');
    
    const servicesHtml = user.services?.map(s => `
      <span class="service-badge" title="Beviljad: ${new Date(s.grantedAt).toLocaleDateString()}">
        ${s.name}
        ${hasRole('manager') || hasRole('admin') ? 
          `<button class="btn-icon" onclick="revokeServiceAccess('${user.id}', '${s.name}')">×</button>` : 
          ''}
      </span>
    `).join('') || '-';
    
    tr.innerHTML = `
      <td>${sanitizeHTML(user.name)}</td>
      <td>${sanitizeHTML(user.email)}</td>
      <td>${sanitizeHTML(user.role)}</td>
      <td>${user.companyName || '-'}</td>
      <td class="services-cell">${servicesHtml}</td>
      <td>
        <span class="badge ${user.isActive ? 'badge-success' : 'badge-inactive'}">
          ${user.isActive ? 'Aktiv' : 'Inaktiv'}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          ${(hasRole('sales') || hasRole('manager') || hasRole('admin')) ? `
            <button class="btn btn-sm btn-primary" 
                    onclick="openGrantServiceModal('${user.id}')">
              ➕ Lägg till tjänst
            </button>
          ` : ''}
          
          ${(hasRole('manager') || hasRole('admin')) ? `
            ${user.isActive ? 
              `<button class="btn btn-sm btn-warning" onclick="disableUser('${user.id}')">
                Inaktivera
              </button>` :
              `<button class="btn btn-sm btn-success" onclick="enableUser('${user.id}')">
                Aktivera
              </button>`
            }
            
            <button class="btn btn-sm btn-secondary" 
                    onclick="resetUserPassword('${user.id}', true)">
              🔑 Återställ lösenord
            </button>
          ` : ''}
          
          ${hasRole('admin') ? `
            <button class="btn btn-sm btn-danger" 
                    onclick="deleteUserConfirm('${user.id}')">
              Radera
            </button>
          ` : ''}
        </div>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
}
```

---

## 📧 Välkomstmail

När en användare skapas med `sendInviteEmail: true` skickas ett automatiskt mail:

```
Till: anna@era.se
Ämne: Välkommen till Värderingsdata!

Hej Anna!

Välkommen till Värderingsdata! Ditt konto har skapats.

Inloggningsuppgifter:
E-post: anna@era.se
Temporärt lösenord: xK9@mP2$vL4#qR7!

Logga in här: https://varderingsdata.se/login

Du kommer att uppmanas att byta lösenord vid första inloggningen.

Du har tillgång till följande tjänster:
- Värderingsdata Premium
- Rapport Pro

Vid frågor, kontakta oss på support@varderingsdata.se

Med vänliga hälsningar,
Värderingsdata Team
```

---

## 🔒 Säkerhet & Permissions

### Rollbaserad åtkomst:

| Action | Sales | Manager | Admin |
|--------|-------|---------|-------|
| Skapa användare | ✅ | ✅ | ✅ |
| Ge tjänst | ✅ | ✅ | ✅ |
| Ta bort tjänst | ❌ | ✅ | ✅ |
| Uppdatera roll | ❌ | ✅ | ✅ |
| Inaktivera | ❌ | ✅ | ✅ |
| Återställ lösenord | ❌ | ✅ | ✅ |
| Radera | ❌ | ❌ | ✅ |

### Lösenordsregler:

- Minst 16 tecken
- Minst 1 gemener
- Minst 1 versal
- Minst 1 siffra
- Minst 1 specialtecken (!@#$%^&*)
- Kryptografiskt säker generering

---

## 📊 Audit Logging

Alla user management actions loggas:

```json
{
  "ts": "2025-10-08T12:30:00Z",
  "action": "user_created_in_b2c",
  "entityType": "user",
  "entityId": "b2c-abc-123",
  "userId": "sales-user-456",
  "details": {
    "email": "anna@era.se",
    "services": ["Värderingsdata Premium"],
    "createdBy": "sales-user-456"
  }
}
```

---

## 🧪 Testing

### Test 1: Skapa användare

```bash
curl -X POST http://localhost:3000/api/users/create-in-b2c \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "Testsson",
    "companyId": "company-123",
    "companyName": "Test AB",
    "role": "sales",
    "services": ["Värderingsdata Premium"],
    "sendInviteEmail": false
  }'
```

### Test 2: Ge tjänst

```bash
curl -X POST http://localhost:3000/api/users/USER_ID/grant-service \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "Rapport Pro",
    "expiresAt": "2026-01-01T00:00:00Z"
  }'
```

---

## 🎯 Sammanfattning

Nu kan säljare:

✅ **Skapa nya användare** direkt i Azure B2C från CRM  
✅ **Ge tillgång till tjänster** omedelbart efter försäljning  
✅ **Hantera användare** (inaktivera, återställ lösenord, etc.)  
✅ **Automatiska välkomstmail** med inloggningsuppgifter  
✅ **Full audit trail** för alla ändringar  
✅ **Rollbaserad åtkomst** för säkerhet  

**Säljaren kan nu ge kunden tillgång direkt när affären är klar! 🎉**
