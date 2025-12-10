# 🚀 Produktionsdriftsättning - Checklista

**Projekt:** JRM CRM  
**Datum:** _________  
**Ansvarig:** _________  
**Beräknad tid:** 30-60 minuter

---

## 📋 Före deployment

### Azure-förberedelser
- [ ] Azure-prenumeration aktiverad och verifierad
- [ ] Azure CLI installerat och fungerar (`az --version`)
- [ ] Inloggad i Azure CLI (`az login`)
- [ ] Valt korrekt subscription (`az account set --subscription <name>`)
- [ ] Resource Group skapad eller identifierad
- [ ] Namnkonvention bestämd (t.ex. `jrm-crm-prod`)

### Lokala förberedelser
- [ ] Git repository är uppdaterat (senaste commits pushade)
- [ ] All kod testad lokalt och fungerar
- [ ] Dependencies uppdaterade (`npm audit fix`)
- [ ] `.gitignore` innehåller `.env` och känsliga filer
- [ ] Dokumentation uppdaterad (README, API docs)

---

## 🔧 Steg 1: Skapa Azure-resurser (15-20 min)

### Cosmos DB
- [ ] Cosmos DB-konto skapat
  ```bash
  az cosmosdb create --name jrm-crm-cosmos --resource-group jrm-crm-prod
  ```
- [ ] Databas skapad (`jrm-crm-db`)
- [ ] Containers skapade:
  - [ ] `brands` (partition key: `/id`)
  - [ ] `companies` (partition key: `/id`)
  - [ ] `agents` (partition key: `/id`)
  - [ ] `deals` (partition key: `/id`)
  - [ ] `tasks` (partition key: `/id`)
- [ ] Connection string sparad säkert (använd password manager)

### App Service
- [ ] App Service Plan skapad (S1 eller högre för produktion)
  ```bash
  az appservice plan create --name jrm-crm-plan --sku S1
  ```
- [ ] Web App skapad (Node 18)
  ```bash
  az webapp create --name jrm-crm-api --runtime "NODE:18-lts"
  ```
- [ ] HTTPS-only aktiverat
- [ ] Deployment credentials skapade

### Application Insights
- [ ] Application Insights-resurs skapad
- [ ] Instrumentation key kopierad
- [ ] Länkad till App Service

---

## 🔐 Steg 2: Miljövariabler (5-10 min)

### Generera secrets
- [ ] SESSION_SECRET genererad (minst 32 tecken)
  ```powershell
  [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
  ```

### Azure AD B2C (om autentisering ska aktiveras)
- [ ] B2C tenant skapad/identifierad
- [ ] App registration skapad
- [ ] Client ID kopierad
- [ ] Client Secret genererad och kopierad
- [ ] Redirect URI konfigurerad
- [ ] User flow skapad (`B2C_1_signupsignin`)

### Sätt miljövariabler i Azure
- [ ] Alla variabler från `.env.example` konfigurerade i App Service
  ```bash
  az webapp config appsettings set --name jrm-crm-api --settings KEY=VALUE
  ```
- [ ] CORS_ORIGIN satt till frontend-URL
- [ ] NODE_ENV=production
- [ ] Verifierat att inga variabler saknas

---

## 📦 Steg 3: Deploy backend (5-10 min)

### Val av deployment-metod
Markera vald metod:
- [ ] **Git Deployment** (push direkt från lokal Git)
- [ ] **GitHub Actions** (CI/CD pipeline)
- [ ] **ZIP Deploy** (snabb manuell deploy)

### Git Deployment
- [ ] Azure Git remote konfigurerad
  ```bash
  git remote add azure https://...
  ```
- [ ] Första deployment genomförd
  ```bash
  git push azure main
  ```
- [ ] Build lyckades (kontrollera logs)

### GitHub Actions (om vald)
- [ ] Workflow-fil skapad (`.github/workflows/deploy-backend.yml`)
- [ ] Publish profile hämtad från Azure
- [ ] Secret lagd till i GitHub (`AZURE_WEBAPP_PUBLISH_PROFILE`)
- [ ] Första workflow körning lyckades

### ZIP Deploy (om vald)
- [ ] Dependencies installerade (`npm ci --production`)
- [ ] ZIP-fil skapad
- [ ] Deployad till Azure
  ```bash
  az webapp deployment source config-zip --src deploy.zip
  ```

---

## ✅ Steg 4: Verifiera backend (5 min)

### Health checks
- [ ] Health endpoint svarar
  ```powershell
  Invoke-RestMethod "https://jrm-crm-api.azurewebsites.net/health"
  ```
- [ ] Status: "healthy"
- [ ] Cosmos DB connection: OK
- [ ] Application Insights: logging

### API endpoints
Testa minst dessa:
- [ ] `/api/stats/dashboard` - returnerar korrekt data
- [ ] `/api/brands` - returnerar brands list
- [ ] `/api/companies` - returnerar companies list
- [ ] `/api/agents` - returnerar agents list

### Logs
- [ ] Log stream öppnad och visar output
  ```bash
  az webapp log tail --name jrm-crm-api
  ```
- [ ] Inga error messages i startup
- [ ] Connection till Cosmos DB lyckad

---

## 🔄 Steg 5: Initial data (10-15 min)

### Cosmos DB seed
- [ ] Seed-script förberett (`scripts/deployment/seed-production-data.js`)
- [ ] Environment variabler satta lokalt för seed-script
- [ ] Script kört framgångsrikt
  ```bash
  node scripts/deployment/seed-production-data.js
  ```

### Dataverifiering
- [ ] Brands finns i databasen (5 st)
- [ ] Companies finns i databasen (5 st)
- [ ] Agents finns i databasen (5 st)
- [ ] Relations mellan entities är korrekta
- [ ] Dashboard visar korrekt aggregerad data

---

## 🌐 Steg 6: Frontend deployment (10 min)

### Konfigurera frontend
- [ ] API_BASE URL uppdaterad till produktion
  ```javascript
  const API_BASE = 'https://jrm-crm-api.azurewebsites.net/api';
  ```
- [ ] Environment detection implementerad (localhost vs production)
- [ ] CORS testad från frontend-domän

### Deploy frontend
- [ ] Static Web App skapad
  ```bash
  az staticwebapp create --name jrm-crm-frontend
  ```
- [ ] GitHub Actions deployment konfigurerad
- [ ] Frontend tillgänglig på URL
- [ ] SSL-certifikat aktiverat (automatiskt)

### Integration test
- [ ] Frontend kan anropa backend API
- [ ] Dashboard laddas korrekt
- [ ] Data visas från produktion-API
- [ ] Inga CORS-errors i console

---

## 🔒 Steg 7: Autentisering (5 min)

### Azure AD B2C aktivering
- [ ] Login-flöde testat
  ```
  https://jrm-crm-api.azurewebsites.net/auth/login
  ```
- [ ] Redirect till B2C fungerar
- [ ] Callback efter login fungerar
- [ ] Session sparas korrekt
- [ ] Logout fungerar

### Skyddade endpoints
- [ ] Oskyddade endpoints fungerar utan auth
- [ ] Skyddade endpoints kräver inloggning
- [ ] Token validering fungerar
- [ ] User claims är tillgängliga i backend

---

## 📊 Steg 8: Monitoring (5 min)

### Application Insights
- [ ] Dashboard öppnad i Azure Portal
- [ ] Real-time data flödar in
- [ ] Request rates visas
- [ ] Response times loggas
- [ ] Dependencies (Cosmos DB) visas

### Alerts konfigurerade
- [ ] High response time alert (> 2s)
- [ ] High error rate alert (> 10 errors/5min)
- [ ] Cosmos DB throttling alert
- [ ] Email notifications konfigurerade

### Backups
- [ ] Cosmos DB automatic backup verifierad (default: var 8:e timme)
- [ ] Point-in-time restore testad (optional)
- [ ] Backup retention satt (30 dagar default)

---

## 🧪 Steg 9: Load testing (10 min)

### Basic performance test
- [ ] 10 concurrent users - OK
- [ ] 50 concurrent users - OK
- [ ] 100 concurrent users - OK
- [ ] Response times < 500ms för 95% av requests

### Stress test (optional)
- [ ] Identifierat max load innan scale-up behövs
- [ ] Auto-scaling konfigurerat (om behövs)
- [ ] Cosmos DB RU/s justerad efter load

---

## 📝 Steg 10: Dokumentation (5 min)

### Uppdatera dokumentation
- [ ] README.md - produktions-URL tillagd
- [ ] API_ENDPOINTS.md - base URL uppdaterad
- [ ] PRODUCTION_DEPLOYMENT.md - actual values ifyllda
- [ ] Runbook skapad för vanliga operations tasks

### Team handover
- [ ] Produktions-URLs delad med team
- [ ] Azure Portal access delad
- [ ] Cosmos DB connection strings säkert lagrade
- [ ] On-call rutiner dokumenterade

---

## 🎉 Go-Live!

### Final checks (innan du meddelar users)
- [ ] All funktionalitet testad end-to-end
- [ ] Performance acceptable
- [ ] Monitoring fungerar
- [ ] Backups konfigurerade
- [ ] Team är informerat
- [ ] Support-rutin på plats

### Communication
- [ ] Stakeholders informerade om go-live
- [ ] URL delad med användare
- [ ] User guide/training material distribuerat
- [ ] Feedback-kanal etablerad

---

## 🚨 Rollback plan (för säkerhets skull)

Om något går fel:
- [ ] Rollback-procedure dokumenterad
- [ ] Backup av data före go-live
- [ ] Kan rollbacka till förra versionen på < 5 min

### Rollback steg
1. Stopp traffic till nya versionen
2. Deploy förra versionen:
   ```bash
   git push azure previous-stable-branch:main --force
   ```
3. Restore Cosmos DB till före-migration backup (om data ändrats)
4. Informera users om downtime

---

## 📈 Post-deployment (dag 1-7)

### Dag 1
- [ ] Monitor logs för errors (första 24h)
- [ ] Kontrollera Application Insights metrics
- [ ] Samla in user feedback
- [ ] Quick fixes för akuta issues

### Vecka 1
- [ ] Performance review
- [ ] Kostnadsanalys (Azure costs)
- [ ] Identifiera optimeringsmöjligheter
- [ ] Planera nästa iteration

---

## ✅ Sign-off

**Backend deployment:**  
☐ Godkänd av: _____________ Datum: _______

**Frontend deployment:**  
☐ Godkänd av: _____________ Datum: _______

**Security review:**  
☐ Godkänd av: _____________ Datum: _______

**Go-live approval:**  
☐ Godkänd av: _____________ Datum: _______

---

**Status:** ☐ Planerad | ☐ Pågående | ☐ Klar | ☐ Rollback

**Anteckningar:**
```
_______________________________________________
_______________________________________________
_______________________________________________
```

---

**Senast uppdaterad:** December 10, 2025  
**Version:** 1.0  
**Nästa review:** _________
