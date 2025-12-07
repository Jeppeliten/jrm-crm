# GitHub Actions Deployment Setup

## Översikt
Automatisk deployment av både backend och frontend till Azure via GitHub Actions.

## Steg 1: Skapa GitHub Repository (om inte redan gjort)

```powershell
cd C:\Repos\JRM
git init
git add .
git commit -m "Initial commit with Azure deployment setup"
git branch -M main
git remote add origin https://github.com/DITT-ANVÄNDARNAMN/JRM.git
git push -u origin main
```

## Steg 2: Hämta Azure Publish Profile för Backend

Kör detta kommando för att få publish profile:

```powershell
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp deployment list-publishing-profiles `
  --name jrm-crm-api-prod-vsdmc5kbydcjc `
  --resource-group jrm-crm-rg-prod `
  --xml
```

**Alternativt via Azure Portal:**
1. Gå till Azure Portal
2. Navigera till App Service: `jrm-crm-api-prod-vsdmc5kbydcjc`
3. Klicka på **"Get publish profile"** överst
4. Spara XML-filen

## Steg 3: Lägg till GitHub Secrets

Gå till din GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Klicka på **"New repository secret"** och lägg till:

### Secret 1: AZURE_WEBAPP_PUBLISH_PROFILE
- **Name:** `AZURE_WEBAPP_PUBLISH_PROFILE`
- **Value:** Hela innehållet från publish profile XML-filen

### Secret 2: AZURE_STATIC_WEB_APPS_API_TOKEN
- **Name:** `AZURE_STATIC_WEB_APPS_API_TOKEN`
- **Value:** 
```
f688194be795e9e49577b4c93b7f6bf972b2cb1fc3f2aefca5e706f9b4d0d84703-38ee00b6-22f0-4607-8bdf-5518bb2e130b00323150a14e0d03
```

## Steg 4: Testa Deployment

### Automatisk deployment vid push:
```powershell
git add .
git commit -m "Test deployment"
git push
```

### Manuell deployment via GitHub:
1. Gå till din repository på GitHub
2. Klicka på **Actions**
3. Välj **"Deploy to Azure"**
4. Klicka **"Run workflow"**
5. Välj branch `main`
6. Klicka **"Run workflow"**

## Steg 5: Verifiera Deployment

Efter några minuter, testa:

**Backend API:**
```powershell
curl https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net/health
```

**Frontend:**
```
https://lively-grass-0a14e0d03.3.azurestaticapps.net
```

## Workflow Detaljer

### Backend Deployment
- Kör på: `ubuntu-latest`
- Node version: 18.x
- Steg:
  1. Checkout kod
  2. Setup Node.js med cache
  3. Installera dependencies (`npm ci`)
  4. Kör tester
  5. Deploy till Azure App Service

### Frontend Deployment
- Kör på: `ubuntu-latest`
- Steg:
  1. Checkout kod
  2. Deploy till Static Web App (ingen build behövs)

## Troubleshooting

### Om deployment misslyckas:

1. **Kontrollera secrets:**
   - Settings → Secrets → Actions
   - Verifiera att båda secrets finns

2. **Kontrollera workflow logs:**
   - Actions → Välj senaste run
   - Klicka på jobbet som misslyckades
   - Läs loggarna

3. **Publish Profile fel:**
   ```powershell
   # Hämta ny publish profile
   & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp deployment list-publishing-profiles `
     --name jrm-crm-api-prod-vsdmc5kbydcjc `
     --resource-group jrm-crm-rg-prod `
     --xml
   ```
   Uppdatera secret på GitHub.

4. **Static Web App token fel:**
   Om token är ogiltig, hämta ny från Azure Portal:
   - Static Web Apps → lively-grass-0a14e0d03
   - Manage deployment token
   - Copy

### Kontrollera deployment status:

```powershell
# Backend
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" webapp deployment list `
  --name jrm-crm-api-prod-vsdmc5kbydcjc `
  --resource-group jrm-crm-rg-prod

# Frontend
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" staticwebapp show `
  --name lively-grass-0a14e0d03 `
  --query "defaultHostname" -o tsv
```

## Fördelar med GitHub Actions

✅ Automatisk deployment vid varje push till `main`  
✅ Ingen lokal Azure CLI behörighet behövs  
✅ Konsistent build-miljö  
✅ Historik och logs för alla deployments  
✅ Kan köras manuellt när som helst  
✅ Parallell deployment av frontend och backend  
✅ Automatiska tester innan deployment

## Nästa Steg

När GitHub Actions är uppsatt:
1. ✅ Pusha din kod till GitHub
2. ✅ Lägg till secrets enligt ovan
3. ✅ Kör workflow manuellt första gången
4. ✅ Testa att CRUD-operationer fungerar
5. ✅ Testa Excel-import

## Support

Om du behöver hjälp:
- Kontrollera Actions-logs på GitHub
- Verifiera secrets är korrekta
- Kontrollera Azure Portal för felmeddelanden
