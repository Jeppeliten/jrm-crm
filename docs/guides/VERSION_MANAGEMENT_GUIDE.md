# Versionshantering och Continuous Deployment Guide

## 🎯 Översikt
För att säkert vidareutveckla CRM-tjänsten efter deployment behöver du en strukturerad versionshantering som gör det möjligt att:
- Utveckla nya funktioner utan att påverka produktion
- Snabbt fixa buggar
- Enkelt rulla tillbaka vid problem
- Automatisera deployment-processen

## 📂 Git Branch-strategi

### Huvudgrenar:
- **`main`** - Produktionskod (alltid stabil)
- **`develop`** - Utvecklingsbranch (kommande release)
- **`staging`** - Test-miljö före produktion

### Feature-branches:
- **`feature/outlook-improvements`** - Nya Outlook-funktioner
- **`feature/sales-dashboard-v2`** - Förbättringar av sales reports
- **`hotfix/critical-bug-fix`** - Akuta bugfixar

```bash
# Exempel på workflow:
git checkout develop
git pull origin develop
git checkout -b feature/new-customer-filters
# ... utveckla funktionalitet
git add .
git commit -m "feat: add advanced customer filtering"
git push origin feature/new-customer-filters
# ... skapa Pull Request till develop
```

## 🏷️ Semantic Versioning

Använd [SemVer](https://semver.org/) för versionsnummer: **MAJOR.MINOR.PATCH**

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): Nya funktioner (bakåtkompatibla)
- **PATCH** (1.0.0 → 1.0.1): Bugfixar

### Exempel på versionshistorik:
- `1.0.0` - Initial release med grundfunktionalitet
- `1.1.0` - Outlook integration tillagd
- `1.2.0` - Advanced sales reporting
- `1.2.1` - Bugfix för kalendersystem
- `2.0.0` - Ny användarautentisering (breaking change)

## 🔄 CI/CD Pipeline med GitHub Actions

### 1. Skapa `.github/workflows/ci-cd.yml`:

```yaml
name: CRM CI/CD Pipeline

on:
  push:
    branches: [ main, develop, staging ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd server && npm install
      - name: Run tests
        run: cd server && npm test
      - name: Lint code
        run: cd server && npm run lint

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Staging
        run: |
          echo "Deploying to staging environment..."
          # Lägg till staging deployment script här

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Production
        run: |
          echo "Deploying to production..."
          # Lägg till production deployment script här
```

## 🚀 Deployment-strategier

### 1. Blue-Green Deployment
- Kör två identiska miljöer (Blue/Green)
- Växla trafik mellan dem vid deployment
- Möjliggör snabb rollback

### 2. Rolling Deployment
- Uppdatera servrar en i taget
- Ingen downtime
- Gradvis utrullning

### 3. Feature Flags
- Aktivera/inaktivera funktioner utan deployment
- A/B-testning
- Säker utrullning av nya funktioner

## 📦 Package.json versionshantering

Uppdatera automatiskt med npm:

```bash
# Patch version (1.0.0 → 1.0.1)
npm version patch

# Minor version (1.0.0 → 1.1.0)
npm version minor

# Major version (1.0.0 → 2.0.0)
npm version major
```

## 🔧 Automation Scripts

### Auto-deployment script (`deploy-auto.sh`):

```bash
#!/bin/bash
set -e

ENVIRONMENT=$1
BRANCH=$2

if [ "$ENVIRONMENT" = "staging" ]; then
    git checkout staging
    git pull origin staging
    docker-compose -f docker-compose.staging.yml up -d --build
elif [ "$ENVIRONMENT" = "production" ]; then
    git checkout main
    git pull origin main
    docker-compose -f docker-compose.production.yml up -d --build
fi

echo "✅ Deployment to $ENVIRONMENT completed!"
```

### Database migration script:

```bash
#!/bin/bash
# run-migrations.sh
echo "🔄 Running database migrations..."
node server/migrations/migrate.js
echo "✅ Migrations completed!"
```

## 📊 Monitoring och Rollback

### Health checks:
```javascript
// server/health-check.js
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: process.env.npm_package_version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

### Rollback-strategi:
```bash
# Snabb rollback till förra versionen
git checkout main
git reset --hard HEAD~1
git push --force-with-lease origin main

# Eller använd tagged version
git checkout v1.2.0
git checkout -b hotfix/rollback-v1.2.0
```

## 🛡️ Säkerhet och Best Practices

### 1. Environment-specifika konfigurationer:
```
.env.development
.env.staging
.env.production
```

### 2. Secrets management:
- Använd GitHub Secrets för CI/CD
- Azure Key Vault för produktion
- Aldrig checka in secrets i git

### 3. Code review process:
- Obligatoriska Pull Requests
- Minst en reviewer
- Automatiska tester måste passa

## 📝 Release Notes Template

```markdown
## Release v1.2.0 - 2025-10-22

### 🆕 New Features
- Advanced Outlook integration with real-time sync
- Calendar system with meeting booking
- Enhanced sales reporting with filtering

### 🐛 Bug Fixes
- Fixed user authentication timeout
- Resolved calendar display issues

### 🔧 Improvements
- Better error handling in API endpoints
- Optimized database queries
- Enhanced mobile responsiveness

### ⚠️ Breaking Changes
- None

### 🔄 Migration Notes
- Run `npm run migrate` after deployment
- Update environment variables (see .env.example)
```

## 🎯 Rekommenderad Workflow

1. **Utveckling**: Feature branch → develop
2. **Testing**: develop → staging (automatisk deployment)
3. **Release**: staging → main (efter manual verifiering)
4. **Hotfix**: main → hotfix branch → main (för kritiska buggar)

Vill du att jag hjälper dig sätta upp någon av dessa komponenter?