# Projektstruktur - Branschstandard

## Översikt

Detta projekt följer modern branschstandard för Node.js-projekt med tydlig separation mellan kod, dokumentation, konfiguration och data.

## Katalogstruktur

```
JRM/
├── .github/                    # GitHub-specifika filer
│   └── workflows/             # GitHub Actions CI/CD
│       └── deploy.yml         # Deployment workflow
│
├── client/                    # Frontend-applikation
│   ├── src/                   # Källkod
│   │   ├── components/       # UI-komponenter
│   │   ├── views/            # Vyer/sidor
│   │   ├── services/         # API-clients och services
│   │   └── utils/            # Hjälpfunktioner
│   ├── assets/               # Statiska filer (bilder, fonts)
│   ├── css/                  # Stylesheets
│   └── index.html            # Entry point
│
├── server/                    # Backend-applikation
│   ├── config/               # Konfigurationsfiler
│   ├── middleware/           # Express middleware
│   ├── routes/               # API routes (om strukturerat)
│   ├── services/             # Business logic
│   ├── utils/                # Hjälpfunktioner
│   ├── data/                 # Data-filer (state.json, auth.json)
│   ├── backups/              # Automatiska backups
│   ├── logs/                 # Loggfiler
│   ├── index.js              # Server entry point
│   ├── package.json          # Dependencies
│   └── .env.example          # Environment variables template
│
├── docs/                      # All dokumentation
│   ├── api/                  # API-dokumentation
│   ├── azure/                # Azure-specifik dokumentation
│   │   ├── B2C_SETUP.md
│   │   ├── DEPLOYMENT.md
│   │   └── USER_SYNC.md
│   ├── deployment/           # Deployment-guider
│   │   ├── AZURE.md
│   │   ├── VPS.md
│   │   ├── DOCKER.md
│   │   └── GLESYS.md
│   ├── guides/               # Användar- och utvecklingsguider
│   │   ├── DEVELOPMENT.md
│   │   ├── MAINTENANCE.md
│   │   └── TROUBLESHOOTING.md
│   ├── security/             # Säkerhetsdokumentation
│   │   ├── SECURITY_GUIDE.md
│   │   ├── GDPR.md
│   │   └── PENETRATION_TEST.md
│   └── architecture/         # Arkitekturdokumentation
│       ├── TECHNICAL_DESCRIPTION.md
│       ├── DATA_MODEL.md
│       └── INTEGRATIONS.md
│
├── scripts/                   # Utility scripts
│   ├── deployment/           # Deployment scripts
│   │   ├── deploy-azure.ps1
│   │   ├── deploy-vps.sh
│   │   └── rollback.sh
│   ├── setup/                # Setup scripts
│   │   ├── install-deps.sh
│   │   ├── init-database.js
│   │   └── generate-secrets.js
│   └── maintenance/          # Maintenance scripts
│       ├── backup.sh
│       └── cleanup-logs.sh
│
├── data/                      # Data och testdata
│   ├── sample/               # Sample/exempel-data
│   │   ├── sample-state.json
│   │   └── sample-customers.xlsx
│   └── .gitkeep              # Keep folder in git
│
├── tests/                     # Tests (om/när implementerat)
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .dockerignore             # Docker ignore rules
├── .gitignore                # Git ignore rules
├── .env.example              # Environment variables template (root)
├── docker-compose.yml        # Docker compose för development
├── docker-compose.prod.yml   # Docker compose för production
├── Dockerfile                # Docker image definition
├── LICENSE                   # License file
├── README.md                 # Projektöversikt och quick start
├── CHANGELOG.md              # Versionshistorik
└── package.json              # Root package.json (om monorepo)
```

---

## Fil-omorganisering (Från nuvarande struktur)

### 1. Flytta dokumentationsfiler

```powershell
# Azure-dokumentation
Move-Item "AZURE_*.md" "docs/azure/"
Move-Item "DUAL_USER_MANAGEMENT_SETUP.md" "docs/azure/"

# Deployment-dokumentation
Move-Item "DEPLOYMENT_GUIDE.md" "docs/deployment/"
Move-Item "GLESYS_*.md" "docs/deployment/"
Move-Item "VPS_*.md" "docs/deployment/"
Move-Item "PRODUCTION_*.md" "docs/deployment/"

# Guider
Move-Item "DEVELOPMENT_QUICKSTART.md" "docs/guides/DEVELOPMENT.md"
Move-Item "MAINTENANCE_GUIDE.md" "docs/guides/MAINTENANCE.md"
Move-Item "DATA_ENRICHMENT_GUIDE.md" "docs/guides/"
Move-Item "GITHUB_SETUP_GUIDE.md" "docs/guides/"
Move-Item "VERSION_MANAGEMENT_GUIDE.md" "docs/guides/"
Move-Item "OUTLOOK_REAL_SETUP.md" "docs/guides/"
Move-Item "VISMA_INTEGRATION_SETUP.md" "docs/guides/"

# Säkerhetsdokumentation
Move-Item "SECURITY_GUIDE.md" "docs/security/"
Move-Item "SWEDISH_*_SECURITY.md" "docs/security/"

# Arkitekturdokumentation
Move-Item "CRM_Technical_Description.md" "docs/architecture/TECHNICAL_DESCRIPTION.md"
Move-Item "TEKNISK_DOKUMENTATION.md" "docs/architecture/"
Move-Item "AI_FEATURES_O1.md" "docs/architecture/"
```

### 2. Flytta deployment scripts

```powershell
Move-Item "deploy*.ps1" "scripts/deployment/"
Move-Item "deploy*.sh" "scripts/deployment/"
Move-Item "vps-setup*.sh" "scripts/setup/"
```

### 3. Flytta data-filer

```powershell
Move-Item "*.xlsx" "data/sample/"
```

### 4. Flytta GitHub workflow

```powershell
Move-Item "azure-static-web-apps-*.yml" ".github/workflows/deploy.yml"
```

### 5. Döp om crm-prototype till client

```powershell
Move-Item "crm-prototype" "client"
```

### 6. Skapa saknade filer

Se nästa sektion för att skapa standard-filer.

---

## Standard-filer att skapa

### 1. Root README.md (uppdatera)

Bör innehålla:
- Projektbeskrivning
- Quick start
- Länk till dokumentation
- License
- Contributing guidelines

### 2. CHANGELOG.md

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [1.1.4] - 2025-11-03
### Added
- Complete security layer (WAF, SIEM, ATP)
- Automated backups
- Health check endpoint

### Changed
- Improved project structure

## [1.0.0] - Initial release
```

### 3. LICENSE

Välj lämplig licens (t.ex. MIT, Apache 2.0, eller proprietary)

### 4. CONTRIBUTING.md

Guidelines för contributors (om open source)

### 5. .editorconfig

```ini
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

---

## GitHub Actions Workflow Exempel

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          
      - name: Install dependencies
        run: |
          cd server
          npm ci
          
      - name: Run tests
        run: |
          cd server
          npm test
          
      - name: Deploy to Azure
        run: |
          # Azure deployment steps
```

---

## Fördelar med ny struktur

### ✅ Tydlighet
- Lätt att hitta dokumentation (allt i `docs/`)
- Lätt att hitta scripts (allt i `scripts/`)
- Separation av frontend (`client/`) och backend (`server/`)

### ✅ Skalbarhet
- Lätt att lägga till nya komponenter
- Modular struktur för växande projekt
- Förberedd för tests (`tests/`)

### ✅ Professionalism
- Följer branschstandard (Node.js, GitHub)
- CI/CD-ready (`.github/workflows/`)
- Tydlig dokumentationsstruktur

### ✅ Underhåll
- Enklare att navigera
- Mindre rörigt i root
- Tydliga kategorier

---

## Migration Checklist

- [ ] Skapa nya kataloger
- [ ] Flytta dokumentation till `docs/`
- [ ] Flytta scripts till `scripts/`
- [ ] Flytta data till `data/sample/`
- [ ] Döp om `crm-prototype/` till `client/`
- [ ] Uppdatera `README.md`
- [ ] Skapa `CHANGELOG.md`
- [ ] Skapa `LICENSE`
- [ ] Skapa `.editorconfig`
- [ ] Uppdatera `.gitignore` (exkludera `data/` men inte `data/sample/`)
- [ ] Uppdatera imports/paths i kod (om nödvändigt)
- [ ] Testa att projektet fortfarande fungerar
- [ ] Commit och push

---

## Efter migration - Root folder

```
JRM/
├── .github/
├── client/              (tidigare crm-prototype)
├── server/
├── docs/
├── scripts/
├── data/
├── .dockerignore
├── .editorconfig
├── .gitignore
├── CHANGELOG.md
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile
├── LICENSE
├── package.json         (om monorepo)
└── README.md
```

**Resultat: Ren, professionell och branschstandard-struktur! 🎯**

---

*Skapad: 2025-11-03*
