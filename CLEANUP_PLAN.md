# 🧹 Cleanup Plan - Azure Entra ID + Cosmos MongoDB

## 📋 Beslut: Behåll endast Azure Entra ID + Cosmos MongoDB

### ✅ Server-filer att BEHÅLLA:

#### Auth & Azure
- `auth-azure-b2c-middleware.js` - Azure Entra ID autentisering
- `auth-azure-groups-middleware.js` - Gruppbaserad rollhantering
- `azure-b2c-user-management.js` - Användarhantering via Graph API
- `azure-b2c-user-sync.js` - Synkronisering mot Azure
- `azure-groups-service.js` - Azure AD Groups service
- `index.js` - Huvudserver (rensa upp endpoints)
- `package.json` - Dependencies (rensa upp)

#### Config & Environment
- `.env.example` - Template för Azure + Cosmos config
- `.env.production` - Production config

#### Core funktionalitet
- `config/` - Konfigurationsfiler
- `services/` - Service classes för Cosmos DB
- `middleware/` - Auth middleware

### ❌ Server-filer att TA BORT:

#### Legacy Auth (inte Azure)
- `auth.json` - Lokal auth (ersätts av Azure)
- `password-security.js` - Lösenordshantering (Azure hanterar)
- `two-factor-auth.js` - 2FA (Azure hanterar)

#### Säkerhetssystem (för komplicerat för denna setup)
- `atp-manager.js` - Advanced Threat Protection
- `security-monitor.js` - Säkerhetsmonitoring  
- `siem-system.js` - SIEM system
- `ssl-security-manager.js` - SSL management
- `web-application-firewall.js` - WAF
- `zero-trust-manager.js` - Zero Trust
- `siem/` katalog
- `ssl/` katalog

#### Outlook Integration (optional feature)
- `outlook-integration-server.js` - Outlook integration

#### Legacy import/export scripts
- `run_*.js` filer - Legacy import scripts
- `diagnose_customers.js`
- `peek_ortspris.js`
- `sync_*.js` filer
- `summarize_state.js`
- `backup-manager.js`
- `backups/` katalog

#### Test data
- `state.json` - Legacy state
- `price-list.json` - Legacy price list
- `tests/` katalog (kommer återskapa senare)

### ✅ Client-filer att BEHÅLLA:

#### Modern UI & Auth
- `index.html` - Huvudsida
- `app-modern.js` - Modern app logic
- `auth-azure-b2c.js` - Azure B2C frontend auth
- `azure-b2c-config.js` - Azure config
- `azure-groups-helper.js` - Gruppbaserad UI
- `styles-modern.css` - Modern styling
- `staticwebapp.config.json` - Azure Static Web Apps config

#### Core UI komponenter
- `css/` katalog - Styling
- `js/` katalog - JavaScript utilities

### ❌ Client-filer att TA BORT:

#### Legacy UI
- `app.js` - Legacy app (ersätts av app-modern.js)
- `styles.css` - Legacy styling
- `test-*.html` - Test pages

#### Dashboard features (för komplicerat)
- `*-dashboard.js` filer (atp, security, siem, ssl, waf, zerotrust)
- `system-status.js`
- `predictive-analytics.js`

#### Optional integrations
- `outlook-*.js` filer
- `calendar-view.js`
- `sales-reports.js`
- `two-factor-auth-ui.js`

#### Documentation (flytta till docs/)
- `*.md` filer i client/

## 🎯 Mål efter cleanup:

### Server (~15 filer istället för 50+):
```
server/
├── index.js                           # Main server
├── package.json                       # Dependencies
├── .env.example                       # Config template
├── auth-azure-b2c-middleware.js       # Azure auth
├── auth-azure-groups-middleware.js    # Group roles
├── azure-b2c-user-management.js       # User management
├── azure-b2c-user-sync.js            # User sync
├── azure-groups-service.js           # Groups service
├── config/
│   └── cosmos-config.js              # Cosmos DB config
├── services/
│   ├── cosmos-service.js             # Cosmos DB service
│   └── user-service.js               # User management
└── middleware/
    └── validation.js                 # Input validation
```

### Client (~10 filer istället för 25+):
```
client/
├── index.html                        # Main page
├── app-modern.js                     # Modern app
├── auth-azure-b2c.js                # Azure auth
├── azure-b2c-config.js              # Azure config
├── azure-groups-helper.js           # Group roles UI
├── styles-modern.css                # Modern styling
├── staticwebapp.config.json         # Azure config
├── css/                             # Styling
├── js/                              # Utilities
└── data/
    └── sample-data.json             # Sample data
```

## 🚀 Nästa steg:
1. Rensa server-filer
2. Rensa client-filer  
3. Uppdatera package.json dependencies
4. Skapa Cosmos DB service layer
5. Dokumentera ny struktur