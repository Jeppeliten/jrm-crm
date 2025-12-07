# 🚀 Quick Start: Versionshantering och Development Workflow

## 📋 TL;DR - Snabbstart

### Första gången:
```bash
# Klona och sätt upp
git clone [ditt-repo]
cd crm-project
git checkout -b develop  # Skapa develop branch
cd server && npm install

# Skapa din .env fil
cp .env.example .env
# Redigera .env med dina värden
```

### Daglig utveckling:
```bash
# 1. Ny feature
git checkout develop
git pull origin develop
git checkout -b feature/min-nya-funktion

# 2. Utveckla
# ... kod här ...
git add .
git commit -m "feat: add new customer filtering"

# 3. Testa lokalt
npm run dev

# 4. Push och skapa PR
git push origin feature/min-nya-funktion
# Skapa Pull Request till develop via GitHub
```

### Deployment:
```bash
# Staging deployment (automatisk via CI/CD)
git checkout staging
git merge develop
git push origin staging

# Production deployment
git checkout main
git merge staging
git push origin main
```

## 🎯 Branch-strategi

```
main (produktion)
├── staging (test-miljö)
├── develop (utveckling)
├── feature/outlook-improvements
├── feature/new-dashboard
└── hotfix/critical-bug
```

## 📦 Versionshantering

### Automatisk versionering:
```bash
# Patch version (1.0.0 → 1.0.1)
npm run version:patch

# Minor version (1.0.0 → 1.1.0) 
npm run version:minor

# Major version (1.0.0 → 2.0.0)
npm run version:major
```

### Manuell deployment:
```powershell
# Windows PowerShell
.\deploy-versioned.ps1 -Environment staging -Version auto

# Eller specifik version
.\deploy-versioned.ps1 -Environment production -Version 1.2.0
```

## 🔍 Testing och Health Checks

```bash
# Kontrollera server health
npm run health-check

# Syntax check
node -c server/index.js

# Kör migrations
npm run migrate
```

## 🐳 Docker Commands

```bash
# Bygg image
docker build -t crm-app:latest .

# Starta staging
docker-compose -f docker-compose.staging.yml up -d

# Starta production
docker-compose -f docker-compose.production.yml up -d

# Logs
docker-compose logs -f crm-app
```

## 🚨 Hotfix Workflow

För kritiska buggar i produktion:

```bash
# 1. Skapa hotfix från main
git checkout main
git checkout -b hotfix/critical-security-fix

# 2. Fixa buggen
# ... kod här ...
git commit -m "fix: critical security vulnerability"

# 3. Merge till både main och develop
git checkout main
git merge hotfix/critical-security-fix
git push origin main

git checkout develop  
git merge hotfix/critical-security-fix
git push origin develop

# 4. Deploy direkt till produktion
.\deploy-versioned.ps1 -Environment production -Version patch
```

## 📊 Monitoring och Rollback

### Health check endpoints:
- **Development**: http://localhost:3000/api/health
- **Staging**: http://localhost:3001/api/health  
- **Production**: https://crm.ditt-företag.se/api/health

### Snabb rollback:
```bash
# Se senaste versioner
git tag -l | tail -5

# Rulla tillbaka till specifik version
git checkout v1.1.0
git checkout -b rollback-to-v1.1.0
git push origin rollback-to-v1.1.0

# Eller använd Docker
docker run -d -p 3000:3000 crm-app:1.1.0
```

## 🔐 Säkerhet

### Environment-specifika secrets:
- `.env.development` - Lokal utveckling
- `.env.staging` - Test-miljö  
- `.env.production` - Produktion (via Azure Key Vault)

### Obligatoriska checks:
- ✅ Code review för alla PRs
- ✅ Automatiska tester
- ✅ Security scan
- ✅ Health checks efter deployment

## 🎉 Release Process

1. **Feature development** → develop branch
2. **Testing** → staging branch (auto-deploy)
3. **Production release** → main branch (manual approval)
4. **Git tag** → Automatisk för production deploys
5. **Release notes** → GitHub Releases

## 🆘 Troubleshooting

### Server startar inte:
```bash
# Kontrollera syntax
node -c server/index.js

# Kontrollera dependencies  
cd server && npm install

# Kontrollera environment variables
cat .env
```

### Deployment failar:
```bash
# Kontrollera Docker
docker ps
docker logs crm-app

# Kontrollera health
curl http://localhost:3000/api/health
```

### Database issues:
```bash
# Backup och restore
cp server/state.json backups/state_backup.json
# Eller restore
cp backups/state_backup.json server/state.json
```

---

## 📞 Support

- **GitHub Issues**: För buggar och feature requests
- **Documentation**: README.md och andra .md filer
- **Health Checks**: /api/health endpoint
- **Logs**: Docker logs eller server/audit.log