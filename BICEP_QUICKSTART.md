# 🚀 Snabbstart: Azure Deployment med Bicep

## ⚡ 3 Steg till Production

### Steg 1: Kör Deployment (5 min)

```powershell
cd c:\Repos\JRM
.\infrastructure\deploy.ps1
```

Scriptet frågar efter:
- ✅ Azure B2C Client ID (hämta från Azure Portal)
- ✅ Skapar automatiskt alla resurser

### Steg 2: Deploya Kod (3 min)

```powershell
# Backend
cd server
Compress-Archive -Path * -DestinationPath ../deploy.zip -Force
az webapp deployment source config-zip --resource-group rg-jrm-crm-prod --name [DIN-APP-NAME] --src ../deploy.zip

# Frontend
# Koppla GitHub i Azure Portal → Static Web App → Deployment
```

### Steg 3: Uppdatera Config (2 min)

1. **client/azure-b2c-config.js** - byt ut URLs
2. **Azure B2C** - lägg till Redirect URI
3. **Testa**: `curl https://[DIN-APP].azurewebsites.net/health`

## ✅ Klart!

Total tid: **~10 minuter**

---

## 🆚 Varför Bicep istället för Docker?

| Feature | Bicep | Docker |
|---------|-------|--------|
| Setup-tid | 10 min | 30+ min |
| Kostnader | €0-20/mån | €50-100/mån |
| Auto-scaling | ✅ Ja | ❌ Manuellt |
| SSL/HTTPS | ✅ Automatiskt | ❌ Manuell config |
| Monitoring | ✅ Built-in | ❌ Extra setup |
| Database | ✅ Managed Cosmos | ❌ Separat setup |

## 🎯 Vad Skapas Automatiskt?

- ✅ Backend API (Node.js 18 på App Service)
- ✅ Frontend (Static Web App)
- ✅ Cosmos DB med MongoDB API
- ✅ Application Insights för monitoring
- ✅ CORS-konfiguration
- ✅ SSL-certifikat
- ✅ Health checks
- ✅ Environment variables

## 💰 Kostnad

**Free Tier (Dev):** €0/månad  
**Production:** ~€16-20/månad

## 🔧 Felsökning

### Azure CLI saknas?
```powershell
# Installera från: https://aka.ms/installazurecliwindows
```

### Deployment failar?
```bash
az deployment group show --resource-group rg-jrm-crm-prod --name [DEPLOYMENT-NAME]
```

### Backend startar inte?
```bash
az webapp log tail --resource-group rg-jrm-crm-prod --name [APP-NAME]
```

## 📚 Mer Info

Se `infrastructure/README.md` för detaljerad dokumentation.

## 🎉 Support

Problem? Fråga i chatten!
