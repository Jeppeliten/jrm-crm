# 🏢 CRM System - Azure Entra ID + Cosmos DB

> **Rensad och fokuserad version med endast Azure Entra ID autentisering och Cosmos DB MongoDB API**

## 🎯 Teknisk Stack

### Backend
- **Node.js** med Express.js
- **Azure Cosmos DB** (MongoDB API)
- **Azure Entra ID (B2C)** för autentisering
- **Microsoft Graph API** för användarhantering

### Frontend  
- **Vanilla JavaScript** (modern ES6+)
- **Azure MSAL** för B2C-integration
- **Responsiv CSS** med modern design

## 🚀 Snabbstart

### 1. Klona och installera
```bash
git clone <repo-url>
cd JRM
cd server
npm install
```

### 2. Konfigurera Azure Cosmos DB
```bash
# Skapa Cosmos DB i Azure Portal:
# 1. Gå till Azure Portal > Create Resource > Cosmos DB
# 2. Välj MongoDB API
# 3. Kopiera connection string från Portal > Settings > Connection String
cp .env.cosmos-example .env
# Uppdatera COSMOS_DB_CONNECTION_STRING i .env
```

### 3. Konfigurera Azure Entra ID B2C
```bash
# Se detaljerad guide: docs/azure/AZURE_B2C_SETUP.md
# Uppdatera Azure B2C-inställningar i .env
```

### 4. Starta servern
```bash
npm start
# Server startar på http://localhost:3000
```

## 📁 Projektstruktur (Rensad)

```
JRM/
├── server/                                    # Backend (Node.js)
│   ├── index.js                               # Huvudserver
│   ├── package.json                           # Dependencies (endast nödvändiga)
│   ├── .env.cosmos-example                    # Konfiguration template
│   ├── auth-azure-b2c-middleware.js           # Azure B2C auth middleware
│   ├── auth-azure-groups-middleware.js        # Gruppbaserad rollhantering
│   ├── azure-b2c-user-management.js           # Användarhantering via Graph API
│   ├── azure-b2c-user-sync.js                # Synkronisering mot Azure
│   ├── azure-groups-service.js                # Azure AD Groups service
│   └── services/
│       ├── cosmos-service.js                  # Cosmos DB service layer
│       └── user-service.js                    # Användarhantering
├── client/                                    # Frontend
│   ├── index.html                             # Huvudsida
│   ├── app-modern.js                          # Modern app logic
│   ├── auth-azure-b2c.js                     # Azure B2C frontend auth
│   ├── azure-b2c-config.js                   # Azure config
│   ├── azure-groups-helper.js                # Gruppbaserad UI
│   ├── styles-modern.css                     # Modern styling
│   ├── staticwebapp.config.json              # Azure Static Web Apps config
│   ├── css/                                  # Styling komponenter
│   └── js/                                   # JavaScript utilities
├── docs/                                      # Dokumentation
│   ├── azure/                                # Azure-specifik dokumentation
│   └── guides/                               # Setup-guider
└── data/                                      # Sample data
```

## 🗃️ Databas (Cosmos DB MongoDB API)

### Collections:
- **users** - Azure AD-användare med CRM-metadata
- **companies** - Företagsinformation
- **contacts** - Kontaktpersoner
- **agents** - Mäklare/agenter
- **brands** - Varumärken
- **tasks** - Uppgifter
- **notes** - Anteckningar

### Schema:
Se `database_structure.md` och `database_structure_entra_id.md` för detaljerade schemas.

## 🔐 Autentisering & Auktorisering

### Azure Entra ID B2C
- **JWT Token Validation** med JWKS
- **Gruppbaserad rollhantering** via Azure AD Security Groups
- **Automatisk användarsynkronisering** från Azure AD

### Roller (Azure AD Groups):
- **Admin** - Full åtkomst
- **Manager** - Rapporter och analys
- **Sales** - CRM-funktioner
- **Viewer** - Endast läsåtkomst

## 🔌 API Endpoints

### Auth
- `GET /api/auth/config` - Auth-konfiguration
- `POST /api/auth/logout` - Logga ut

### Users
- `GET /api/users` - Lista användare
- `GET /api/users/:id` - Hämta användare
- `PUT /api/users/:id` - Uppdatera användare
- `POST /api/users/sync` - Synkronisera från Azure

### Companies
- `GET /api/companies` - Lista företag
- `POST /api/companies` - Skapa företag (Sales+)
- `PUT /api/companies/:id` - Uppdatera företag (Sales+)
- `DELETE /api/companies/:id` - Ta bort företag (Admin)

### Health
- `GET /health` - Health check
- `GET /api/health/cosmos` - Cosmos DB status

## 🛠️ Dependencies (Minimala)

### Server
```json
{
  "@azure/msal-node": "^3.8.0",
  "@microsoft/microsoft-graph-client": "^3.0.7",
  "compression": "^1.8.1",
  "cors": "^2.8.5",
  "dotenv": "^16.4.5",
  "express": "^4.19.2",
  "express-rate-limit": "^8.1.0",
  "helmet": "^8.1.0",
  "jsonwebtoken": "^9.0.2",
  "jwks-rsa": "^3.1.0",
  "mongodb": "^6.0.0",
  "validator": "^13.15.15"
}
```

### Frontend
- Inga npm-dependencies (MSAL via CDN)

## 📋 Setup Checklist

### ✅ Cosmos DB
- [ ] Skapa Cosmos DB account i Azure Portal
- [ ] Välj MongoDB API
- [ ] Kopiera connection string till .env
- [ ] Testa anslutning med `npm start`

### ✅ Azure Entra ID B2C
- [ ] Skapa B2C tenant
- [ ] Konfigurera App Registrations (frontend + backend)
- [ ] Skapa User Flows (signup/signin)
- [ ] Uppdatera .env med B2C-inställningar

### ✅ Azure AD Groups (Roller)
- [ ] Skapa Security Groups: CRM-Admin, CRM-Manager, CRM-Sales, CRM-Viewer
- [ ] Kopiera Group Object IDs till .env
- [ ] Tilldela användare till grupper

## 🆔 Utveckling & Test

### Starta lokalt:
```bash
cd server
npm start
# Öppna http://localhost:3000
```

### Test auth:
1. Klicka "Logga in"
2. Omdirigeras till Azure B2C
3. Logga in med testanvändare
4. Kontrollera att rätt roller visas

### Cosmos DB test:
```bash
# Kontrollera connection
curl http://localhost:3000/api/health/cosmos
```

## 📚 Dokumentation

- **[Azure B2C Setup](docs/azure/AZURE_B2C_SETUP.md)** - Detaljerad B2C-konfiguration
- **[Database Structure](database_structure_entra_id.md)** - Databasschema med Azure AD
- **[API Documentation](docs/api/)** - Komplett API-dokumentation

## 🔄 Migration från tidigare version

Vi har tagit bort:
- ❌ Legacy authentication (auth.json, password-security.js)
- ❌ Säkerhetssystem (SIEM, WAF, ATP, Zero Trust)
- ❌ Outlook-integration
- ❌ Legacy import/export scripts
- ❌ Backup-system
- ❌ 2FA (hanteras av Azure)

Vi har behållit:
- ✅ Azure Entra ID B2C autentisering
- ✅ Gruppbaserad rollhantering  
- ✅ Cosmos DB MongoDB API
- ✅ Modern UI-komponenter
- ✅ User management via Graph API

---

## 🤔 Nästa steg: C# Migration?

Se **C# Migration Analys** nedan för utvärdering av att byta från Node.js till C#/.NET.