# Dual User Management Setup Guide

## Översikt

Detta system hanterar användarkonten för både:
- **Azure B2C** (moderna tjänster)
- **Legacy kundadminsystem** (befintliga klassiska tjänster)

Systemet gör automatisk routing baserat på tjänstetyp och kundprofil.

## Steg 1: Konfigurera miljövariabler

### 1.1 Kopiera template
```bash
cd server
cp .env.dual-user-template .env.dual-user
```

### 1.2 Konfigurera Azure B2C (om inte redan gjort)
```env
AZURE_B2C_TENANT_ID=dittföretag.onmicrosoft.com
AZURE_B2C_GRAPH_CLIENT_ID=12345678-1234-1234-1234-123456789abc
AZURE_B2C_GRAPH_CLIENT_SECRET=din_client_secret_här
ENABLE_AZURE_B2C_USER_SYNC=true
```

### 1.3 Konfigurera legacy system
```env
LEGACY_SYSTEM_URL=https://ditt-legacy-system.com/api
LEGACY_SYSTEM_API_KEY=din_api_nyckel_här
ENABLE_LEGACY_SYNC=true
```

## Steg 2: Konfigurera tjänsteklassificering

### 2.1 Definiera moderna tjänster
Tjänster som kräver Azure B2C:
```env
MODERN_SERVICES=CRM_MODERN,ANALYTICS_PLATFORM,MOBILE_APP,API_ACCESS,REAL_TIME_SYNC
```

### 2.2 Definiera legacy tjänster  
Tjänster som kräver egenbyggt system:
```env
LEGACY_SERVICES=CRM_CLASSIC,OLD_REPORTING,LEGACY_INTEGRATIONS,CUSTOM_MODULES
```

### 2.3 Konfigurera routing-regler
```env
DEFAULT_USER_SYSTEM=azure-b2c
NEW_CUSTOMER_THRESHOLD_MONTHS=6
AUTO_MIGRATE_MODERN_SERVICES=false
```

## Steg 3: Legacy System API-integration

### 3.1 API-krav för legacy system
Ditt legacy system behöver följande endpoints:

#### Skapa användare
```http
POST /api/users
Content-Type: application/json
Authorization: Bearer {API_KEY}

{
  "customer_id": "string",
  "customer_name": "string", 
  "email": "string",
  "phone": "string",
  "company": "string",
  "services": ["array", "of", "services"],
  "created_via": "crm_dual_manager"
}

Response:
{
  "success": true,
  "user_id": "string",
  "username": "string", 
  "status": "active",
  "login_url": "https://..."
}
```

#### Uppdatera användare
```http
PUT /api/users/{user_id}
Content-Type: application/json
Authorization: Bearer {API_KEY}

{
  "customer_name": "string",
  "email": "string", 
  "phone": "string",
  "services": ["updated", "services"]
}
```

#### Hämta användare
```http
GET /api/users/{user_id}
Authorization: Bearer {API_KEY}

Response:
{
  "user_id": "string",
  "username": "string",
  "email": "string",
  "status": "active",
  "last_login": "2024-01-01T00:00:00Z"
}
```

### 3.2 Implementera API i ditt legacy system

#### PHP exempel (Laravel)
```php
<?php
// routes/api.php
Route::middleware('auth:api')->group(function () {
    Route::post('/users', [LegacyUserController::class, 'create']);
    Route::put('/users/{id}', [LegacyUserController::class, 'update']);
    Route::get('/users/{id}', [LegacyUserController::class, 'show']);
});

// app/Http/Controllers/LegacyUserController.php
class LegacyUserController extends Controller {
    public function create(Request $request) {
        $userData = $request->validate([
            'customer_id' => 'required|string',
            'customer_name' => 'required|string',
            'email' => 'required|email',
            'services' => 'array'
        ]);
        
        $user = LegacyUser::create([
            'customer_id' => $userData['customer_id'],
            'name' => $userData['customer_name'],
            'email' => $userData['email'],
            'username' => $this->generateUsername($userData['email']),
            'password' => bcrypt(Str::random(16)),
            'services' => json_encode($userData['services']),
            'status' => 'active'
        ]);
        
        return response()->json([
            'success' => true,
            'user_id' => $user->id,
            'username' => $user->username,
            'status' => $user->status,
            'login_url' => config('app.url') . '/login'
        ]);
    }
}
```

#### .NET exempel
```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase {
    
    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request) {
        var user = new LegacyUser {
            CustomerId = request.CustomerId,
            Name = request.CustomerName,
            Email = request.Email,
            Username = GenerateUsername(request.Email),
            Services = JsonSerializer.Serialize(request.Services),
            Status = "active",
            CreatedAt = DateTime.UtcNow
        };
        
        await _context.Users.AddAsync(user);
        await _context.SaveChangesAsync();
        
        return Ok(new {
            success = true,
            user_id = user.Id,
            username = user.Username,
            status = user.Status,
            login_url = _configuration["App:BaseUrl"] + "/login"
        });
    }
}
```

## Steg 4: Testa integrationen

### 4.1 Testa Azure B2C-anslutning
```bash
# Starta CRM-servern
node server/index.js

# Testa via CRM-gränssnittet:
# 1. Logga in som admin
# 2. Gå till "Hybrid Användarhantering"
# 3. Klicka "Analysera systemkrav"
```

### 4.2 Testa legacy system-anslutning
```bash
# Verifiera API-anslutning
curl -X POST \
  'https://ditt-legacy-system.com/api/users' \
  -H 'Authorization: Bearer DIN_API_NYCKEL' \
  -H 'Content-Type: application/json' \
  -d '{
    "customer_id": "test123",
    "customer_name": "Test Kund",
    "email": "test@example.com",
    "services": ["CRM_CLASSIC"]
  }'
```

### 4.3 Testa dual user creation
Via CRM-gränssnittet:
1. Gå till "Hybrid Användarhantering"
2. Klicka "Skapa användare för kund"
3. Välj en kund och tjänster
4. Klicka "Analysera" för att se vilka system som används
5. Klicka "Skapa konton"

## Steg 5: Routing-regler och automatisering

### 5.1 Anpassa routing-regler
Redigera `server/services/dual-user-manager.js`:

```javascript
this.routingRules = {
  modernServices: [
    'DIN_MODERNA_TJÄNST_1',
    'DIN_MODERNA_TJÄNST_2',
    // Lägg till dina tjänster här
  ],
  legacyServices: [
    'DIN_LEGACY_TJÄNST_1', 
    'DIN_LEGACY_TJÄNST_2',
    // Lägg till dina legacy tjänster här
  ]
};
```

### 5.2 Aktivera automatisk synkronisering
```env
AUTO_SYNC_DUAL_ACCOUNTS=true
DUAL_SYNC_INTERVAL=60
```

### 5.3 Aktivera migreringsdetektering
```env
ENABLE_MIGRATION_DETECTION=true
SEND_MIGRATION_ALERTS=true
MIGRATION_ALERT_EMAIL=admin@dittföretag.se
```

## Steg 6: Migrering av befintliga kunder

### 6.1 Identifiera migreringskandidater
```bash
# Via CRM-gränssnittet:
# 1. Gå till "Hybrid Användarhantering"
# 2. Klicka "Visa migreringskandidater"
# 3. Se vilka kunder som rekommenderas för migrering
```

### 6.2 Migrera kunder till Azure B2C
```bash
# Manuell migrering via UI:
# 1. Välj kund i migreringslistan
# 2. Klicka "Migrera"

# Bulk-migrering:
# 1. Klicka "Migrera alla högprioriterade"
```

### 6.3 Verifiera migrering
```bash
# Kontrollera dual account statistik:
# 1. Gå till "Hybrid Användarhantering"
# 2. Se statistik över Azure B2C, Legacy och Hybrid-konton
```

## Steg 7: Säkerhet och övervakning

### 7.1 Aktivera audit logging
```env
ENABLE_DUAL_USER_AUDIT_LOG=true
ENCRYPT_DUAL_ACCOUNT_DATA=true
DUAL_ACCOUNT_ENCRYPTION_KEY=din_32_byte_krypteringsnyckel
```

### 7.2 Övervaka loggar
```bash
# Audit logs finns i:
tail -f server/dual-user-audit.log

# Sync state:
cat server/dual-user-sync-state.json
```

### 7.3 Säkerhetsrekommendationer
- Använd HTTPS för alla API-anrop
- Rotera API-nycklar regelbundet
- Begränsa nätverksåtkomst till legacy system
- Aktivera MFA för admin-konton
- Logga alla användaråtgärder

## Steg 8: Felsökning

### 8.1 Vanliga problem

#### "Legacy API connection failed"
- Kontrollera `LEGACY_SYSTEM_URL` och `LEGACY_SYSTEM_API_KEY`
- Verifiera att legacy systemet är tillgängligt
- Testa API-endpoint manuellt med curl

#### "Azure B2C user creation failed"
- Kontrollera Azure B2C-credentials
- Verifiera Graph API-behörigheter
- Se Azure B2C audit logs

#### "System analysis shows no recommendation"
- Kontrollera tjänsteklassificering i routing-regler
- Verifiera att kunddata innehåller rätt tjänster
- Kolla att tjänstnamnen matchar konfigurationen

### 8.2 Debug-tips
```env
# Aktivera debug-läge
LOG_LEVEL=debug
DEBUG_MODE=true

# Logga alla API-anrop
LOG_REQUESTS=true
LOG_RESPONSES=false
```

### 8.3 Återställning
```bash
# Rensa dual user sync state:
# Via CRM: Admin -> Hybrid Användarhantering -> Inställningar -> Rensa sync state

# Manuellt:
rm server/dual-user-sync-state.json
rm server/dual-user-audit.log
```

## Steg 9: Produktionsdeploy

### 9.1 Säkra konfiguration
- Använd miljövariabler istället för .env-filer
- Säkra API-nycklar i vault/secrets manager
- Konfigurera HTTPS och SSL-certifikat

### 9.2 Övervakning
- Implementera healthchecks för båda systemen
- Konfigurera alerting för misslyckade synkroniseringar
- Sätt upp dashboard för dual user-statistik

### 9.3 Backup och disaster recovery
- Backup av dual account mappings
- Rutiner för återställning av user sync state
- Redundans för kritiska användardata

## Support och underhåll

### Loggar att övervaka
- `server/dual-user-audit.log` - Alla användaråtgärder
- `server/dual-user-sync-state.json` - Sync-tillstånd
- Server console logs - System status

### Regelbundet underhåll
- Rensa gamla audit logs
- Uppdatera API-nycklar
- Verifiera sync-status
- Kontrollera migreringskandidater

### Kontakt
För teknisk support kontakta systemadministratör eller utvecklingsteamet.

---

*Senast uppdaterad: Oktober 2025*
*Version: 1.0*