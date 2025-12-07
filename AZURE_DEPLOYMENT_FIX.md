# 🚀 AZURE DEPLOYMENT - SNABBGUIDE

## Problem
Backend deployar inte automatiskt från Azure DevOps. Servern visar 503 eller gammal version.

## Lösning: Manual Azure Portal Setup (5 minuter)

### Steg 1: Rensa Gammal Deployment
1. Öppna Azure Portal: https://portal.azure.com
2. Sök: `jrm-crm-api-prod-vsdmc5kbydcjc`
3. Gå till **Deployment Center**
4. Om det finns en source konfigurerad:
   - Klicka **Disconnect** (om knappen finns)
   - Bekräfta

### Steg 2: Konfigurera Ny Deployment
1. Fortfarande i **Deployment Center**
2. Klicka **Settings** (överst)
3. Under **Source**, välj: **External Git**
4. Fyll i:
   ```
   Repository: https://varderingsdata.visualstudio.com/VD%20Laboratory/_git/JRM
   Branch: master
   Repository Type: Git
   ```
5. Klicka **Save**

### Steg 3: Verifiera App Settings
1. Gå till **Configuration** (vänster meny)
2. Under **Application settings**, verifiera att dessa finns:
   ```
   PROJECT = server
   SCM_DO_BUILD_DURING_DEPLOYMENT = true
   WEBSITE_NODE_DEFAULT_VERSION = ~20
   NODE_ENV = production
   COSMOS_DB_CONNECTION_STRING = (ska redan finnas)
   COSMOS_DB_DATABASE_NAME = crm_database
   ```
3. Om någon saknas, lägg till den
4. Klicka **Save** längst upp

### Steg 4: Manuell Sync (Första Deploy)
1. Gå tillbaka till **Deployment Center**
2. Klicka **Sync** (eller **Refresh** om Sync inte finns)
3. Vänta 3-5 minuter

### Steg 5: Övervaka Deployment
1. I **Deployment Center**, klicka **Logs**
2. Se att deployment körs och lyckas
3. Leta efter:
   - ✅ "Deployment successful"
   - ✅ "Build: Successful"

### Steg 6: Testa Backend
```powershell
# Health check
curl https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net/health

# Brands endpoint
curl https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net/api/brands
```

## Om det fortfarande inte fungerar:

### Alternativ: Manual File Upload via Kudu
1. Gå till: https://jrm-crm-api-prod-vsdmc5kbydcjc.scm.azurewebsites.net
2. Logga in (samma credentials som Azure Portal)
3. Klicka **Debug console** → **PowerShell**
4. Navigera till: `/home/site/wwwroot`
5. Radera allt i mappen
6. Dra och släpp alla filer från `C:\Repos\JRM\server` (utom node_modules)
7. Gå tillbaka till Azure Portal
8. Starta om App Service

### Alternativ: Använd VS Code Azure Extension
1. Installera "Azure App Service" extension i VS Code
2. Högerklicka på `server` mappen
3. Välj "Deploy to Web App"
4. Välj `jrm-crm-api-prod-vsdmc5kbydcjc`

## Förväntat Resultat

Efter lyckad deployment:

```json
// GET /health
{
  "status": "healthy",
  "timestamp": "2025-11-13T...",
  "version": "2.0.0",
  "environment": "production"
}

// GET /api/brands
[]  // Tom array (inga brands skapade än)
```

## Felsökning

### 503 Error
- App Service är inte startad eller kraschar
- Kolla **Log stream** i Azure Portal för felmeddelanden
- Verifiera att Cosmos DB connection fungerar

### 404 Error på /api/brands
- Gamla filer är deployade (2.0.0-clean)
- Nya routes finns inte
- Kör Sync/Deployment igen

### Build Failed
- Node version fel (ska vara 20)
- PROJECT setting saknas (ska vara "server")
- .deployment fil kan saknas

## Snabb Verifiering

Om deployment lyckades ser du i **Deployment Center → Logs**:
```
✅ Deployment successful
📦 Package: JRM/master (commit: 6e1185f)
🏗️  Build: Successful
🚀 Started successfully
```

Och i **Log stream**:
```
✅ Connected to Azure Cosmos DB
🚀 CRM Server Started Successfully!
📍 Server running on: http://...
```

---

**TID:** Max 10 minuter  
**SVÅRIGHET:** Låg (Point & Click)  
**ALTERNATIV:** 3 olika metoder

Lycka till! 🚀
