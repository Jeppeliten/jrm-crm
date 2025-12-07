# 🏢 Värderingsdata CRM

## 📖 Översikt

Ett internt CRM-system för Värderingsdata med **enterprise-grade säkerhet** och moderna integrationer. Systemet hanterar fastighetsmäklare, mäklarföretag och mäklarkedjor med automatisk datahämtning, Azure AD B2C-autentisering och omfattande säkerhetsfunktioner.

### Nyckelkomponenter
- ✅ **Azure AD B2C Authentication** - SSO med MFA-stöd
- ✅ **Advanced Security** - WAF, SIEM, ATP, Zero Trust
- ✅ **Microsoft Integrations** - Outlook, Graph API
- ✅ **Data Enrichment** - Automatisk kontaktinformationshämtning
- ✅ **GDPR Compliance** - Fullständig efterlevnad med audit logging
- ✅ **Minimal Maintenance** - ~8 timmar/år förvaltning

---

## 🚀 Quick Start

### Lokal utveckling

```powershell
# 1. Installera backend-dependencies
cd server
npm install

# 2. Starta servern
node index.js

# 3. Öppna applikationen
# Navigera till http://localhost:3000
# Default: admin/admin
```

### Production Deployment

Se **[docs/deployment/](docs/deployment/)** för kompletta deployment-guider:
- **Azure:** [docs/deployment/AZURE.md](docs/deployment/AZURE.md)
- **VPS:** [docs/deployment/VPS.md](docs/deployment/VPS.md)  
- **Docker:** [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md)

---

## 📁 Projektstruktur

```
JRM/
├── client/                    # Frontend (SPA)
│   ├── app.js                # Main application
│   ├── index.html            # Entry point
│   ├── styles.css            # Styling
│   └── js/                   # JavaScript modules
│
├── server/                    # Backend API
│   ├── index.js              # Express server
│   ├── package.json          # Dependencies
│   ├── .env.production       # Production config template
│   ├── data/                 # Data storage (state.json, auth.json)
│   ├── backups/              # Automated backups
│   └── logs/                 # Application logs
│
├── docs/                      # Dokumentation
│   ├── architecture/         # Teknisk arkitektur
│   ├── azure/                # Azure-specifik dokumentation
│   ├── deployment/           # Deployment-guider
│   ├── guides/               # Användar- och utvecklingsguider
│   └── security/             # Säkerhetsdokumentation
│
├── scripts/                   # Utility scripts
│   ├── deployment/           # Deploy-skript (Azure, VPS, Docker)
│   └── setup/                # Setup-skript
│
├── data/                      # Data och exempel
│   └── sample/               # Exempeldata
│
├── .github/                   # GitHub-specifika filer
│   └── workflows/            # CI/CD pipelines
│
├── CHANGELOG.md              # Versionshistorik
├── LICENSE                   # MIT License
└── README.md                 # Detta dokument
```

---

## 🔐 Säkerhetsfunktioner

### Autentisering & Auktorisering
- ✅ **Azure AD B2C** - Enterprise SSO med MFA-stöd
- ✅ **JWT Token Validation** - JWKS-baserad validering
- ✅ **Session Management** - 30 min timeout med varningar
- ✅ **Role-Based Access Control (RBAC)** - Admin, Manager, Sales

### Säkerhetslager
- ✅ **WAF (Web Application Firewall)** - SQL injection & XSS protection
- ✅ **SIEM (Security Information Event Management)** - Real-time threat detection
- ✅ **ATP (Advanced Threat Protection)** - AI-baserad anomaly detection
- ✅ **Zero Trust Manager** - Nätverkssäkerhet med least privilege
- ✅ **SSL Security Manager** - Certifikatövervakning

### Compliance
- ✅ **GDPR Compliance** - Right to be forgotten, data export, audit logging
- ✅ **Audit Logging** - Alla säkerhetsrelevanta händelser loggas
- ✅ **Automated Backups** - 4h (dev) / 24h (prod) med rotation
- ✅ **2FA Support** - TOTP-baserad tvåfaktorsautentisering

Se **[docs/security/](docs/security/)** för detaljerad säkerhetsdokumentation.

---

## 🔌 API Endpoints

### Authentication
```javascript
POST /api/login                // Login
POST /api/logout               // Logout
GET  /api/health               // Health check
```

### Data Management
```javascript
GET    /api/companies          // Hämta alla företag
POST   /api/companies          // Skapa företag
PUT    /api/companies/:id      // Uppdatera företag
DELETE /api/companies/:id      // Radera företag (Admin only)

GET    /api/agents             // Hämta alla mäklare
POST   /api/agents             // Skapa mäklare
PUT    /api/agents/:id         // Uppdatera mäklare
DELETE /api/agents/:id         // Radera mäklare (Admin only)
```

### Integrations
```javascript
POST /api/outlook/auth         // Outlook-autentisering
GET  /api/outlook/emails       // Hämta emails
POST /api/enrich               // Data enrichment (Manager+)
```

### GDPR
```javascript
GET  /api/gdpr/audit-log       // Audit log (Admin only)
GET  /api/gdpr/export          // Exportera egen data
POST /api/gdpr/delete-user-data // Radera egen data
```

Fullständig API-dokumentation: **[docs/api/](docs/api/)**

---

## 📊 Funktioner

### Data Enrichment
Automatisk hämtning av kontaktinformation:
- Mäklarkedjor: hemsida, telefon, e-post, org.nummer
- Företag: kontorssida, adress, telefon
- Mäklare: e-post, telefon, LinkedIn-profil

Se **[docs/architecture/DATA_ENRICHMENT_GUIDE.md](docs/architecture/DATA_ENRICHMENT_GUIDE.md)**

### Microsoft Outlook Integration
- Automatisk synk av emails och kalenderhändelser
- OAuth2-baserad autentisering via Microsoft Graph
- Real-time updates

Se **[docs/guides/OUTLOOK_REAL_SETUP.md](docs/guides/OUTLOOK_REAL_SETUP.md)**

### Visma.net Integration
- Automatisk fakturahantering
- Kundregistersynkronisering
- Fakturakoppling

Se **[docs/guides/VISMA_INTEGRATION_SETUP.md](docs/guides/VISMA_INTEGRATION_SETUP.md)**

---

## 📚 Dokumentation

| Kategori | Beskrivning |
|----------|-------------|
| **[Architecture](docs/architecture/)** | Teknisk beskrivning, datamodell, AI-features |
| **[Azure](docs/azure/)** | Azure AD B2C setup, user sync, dual management |
| **[Deployment](docs/deployment/)** | Azure, VPS, Docker deployment-guider |
| **[Guides](docs/guides/)** | Development, maintenance, integrations |
| **[Security](docs/security/)** | Säkerhetsguider, GDPR, penetration testing |

### Viktiga dokument
- **Teknisk beskrivning:** [docs/architecture/TECHNICAL_DESCRIPTION.md](docs/architecture/TECHNICAL_DESCRIPTION.md)
- **Deployment:** [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md)
- **Maintenance:** [docs/guides/MAINTENANCE_GUIDE.md](docs/guides/MAINTENANCE_GUIDE.md)
- **Azure B2C:** [docs/azure/AZURE_B2C_SETUP.md](docs/azure/AZURE_B2C_SETUP.md)

---

## 🔧 Förvaltning

### Minimal Maintenance Strategy (~8 timmar/år)

**Automatiserat:**
- ✅ Dagliga backups (cron)
- ✅ Log rotation (logrotate)
- ✅ Security monitoring (SIEM)
- ✅ Certifikatövervakning (SSL Manager)

**Manuellt:**
- 📅 Månatligt: Granska säkerhetsloggar (15 min)
- 📅 Kvartalsvis: Uppdatera dependencies (30 min)
- 📅 Årligt: Security audit (2 timmar)

Se **[docs/guides/MAINTENANCE_GUIDE.md](docs/guides/MAINTENANCE_GUIDE.md)** för detaljerad plan.

---

## 🧪 Testing

### Backend
```powershell
# Health check
curl http://localhost:3000/api/health

# Test API med authentication
curl -X POST http://localhost:3000/api/login `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"admin"}'
```

### Frontend
1. Öppna http://localhost:3000
2. Logga in (default: admin/admin)
3. Testa CRUD-operationer
4. Verifiera säkerhetsfunktioner

---

## 🚢 Deployment

### Produktionsmiljö (Rekommenderat)

**Option 1: Full Azure Stack**
```
Azure AD B2C → Azure Static Web Apps → Azure App Service → Cosmos DB
```
**Kostnad:** ~550-2,200 SEK/månad

**Option 2: VPS (GleSYS/DigitalOcean)**
```
NGINX → PM2 → Node.js → File-based storage
```
**Kostnad:** ~100-300 SEK/månad

**Option 3: Docker**
```powershell
cd scripts/deployment
docker-compose -f docker-compose.production.yml up -d
```

Se **[docs/deployment/](docs/deployment/)** för kompletta guider.

---

## 📈 Monitoring & Logging

### Application Insights (Azure)
```javascript
const appInsights = require('applicationinsights');
appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY).start();
```

### Loggning
- **audit.log** - GDPR & säkerhetshändelser
- **security.log** - WAF, SIEM, ATP händelser
- **application.log** - Applikationsloggar
- **error.log** - Fel och exceptions

### Health Monitoring
```bash
GET /api/health
{
  "status": "healthy",
  "uptime": 123456,
  "timestamp": "2025-11-03T10:00:00Z",
  "environment": "production"
}
```

---

## 🛣️ Roadmap

### v1.2.0 (Q1 2026)
- [ ] Migrera från file-based storage till Azure Cosmos DB
- [ ] GraphQL API implementation
- [ ] Real-time WebSocket updates
- [ ] Advanced analytics dashboard

### v1.3.0 (Q2 2026)
- [ ] AI-powered lead scoring
- [ ] Predictive analytics
- [ ] Mobile app (React Native)
- [ ] Multi-tenant support

Se **[CHANGELOG.md](CHANGELOG.md)** för versionshistorik.

---

## ❓ FAQ (Vanliga frågor)

**Q: Måste jag använda Azure?**  
A: Nej, systemet kan köras på vilken Node.js-kompatibel miljö som helst (VPS, Docker, etc.)

**Q: Kostar Azure B2C pengar?**  
A: Första 50,000 användare/månad är gratis. Därefter ~0.10 SEK/användare.

**Q: Hur hanteras backups?**  
A: Automatiska backups var 4:e timme (dev) eller dagligen (prod) med 30 dagars retention.

**Q: Vad är förvaltningskostnaden?**  
A: ~8 timmar/år för ett internt verktyg med automatiserad övervakning.

---

## 👥 Support

### Dokumentation
Fullständig dokumentation finns i **[docs/](docs/)** mappen.

### Troubleshooting
Se **[docs/guides/MAINTENANCE_GUIDE.md](docs/guides/MAINTENANCE_GUIDE.md)** för vanliga problem och lösningar.

---

## 📄 License

MIT License - Se **[LICENSE](LICENSE)** för detaljer.

Copyright (c) 2025 Värderingsdata AB

---

**🎉 Systemet är production-ready!**

För deployment, börja med: **[docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md)**
#   T r i g g e r   d e p l o y m e n t  
 