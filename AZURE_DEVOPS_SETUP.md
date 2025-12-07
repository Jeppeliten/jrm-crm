# 🚀 Azure DevOps Deployment Setup

## Din Konfiguration

**Azure DevOps Organization**: `varderingsdata`  
**Project**: `VD Laboratory`  
**Repository**: `JRM`  
**Branch**: `master`  
**Azure App**: `jrm-crm-api-prod-vsdmc5kbydcjc`

---

## ⚡ Snabbstart (5 minuter)

### Metod 1: Via Azure Portal (Enklast!)

1. **Öppna Azure Portal** (redan öppet i din browser)
2. Gå till din Web App: `jrm-crm-api-prod-vsdmc5kbydcjc`
3. **Deployment Center** → **Settings**
4. **Source**: `Azure Repos`
5. Fyll i:
   - **Organization**: `varderingsdata`
   - **Project**: `VD Laboratory`
   - **Repository**: `JRM`
   - **Branch**: `master`
6. **Build Provider**: `App Service build service` (enklast)
7. **Save**

✅ Klart! Deployment sker automatiskt vid push till master.

---

### Metod 2: Via Azure DevOps Pipelines

#### Steg 1: Skapa Service Connection

1. Gå till: https://dev.azure.com/varderingsdata/VD%20Laboratory/_settings/adminservices
2. **New service connection** → **Azure Resource Manager**
3. **Authentication method**: `Service principal (automatic)`
4. **Scope level**: `Subscription`
5. **Subscription**: Välj din Azure subscription
6. **Resource group**: `rg-jrm-crm-prod`
7. **Service connection name**: `Azure-Production`
8. **Grant access to all pipelines**: ✅
9. **Save**

#### Steg 2: Skapa Pipeline

1. Gå till: https://dev.azure.com/varderingsdata/VD%20Laboratory/_build
2. **New pipeline**
3. **Azure Repos Git** → **JRM**
4. **Existing Azure Pipelines YAML file**
5. **Path**: `/azure-pipelines.yml`
6. **Run**

#### Steg 3: Commit och Push

```powershell
cd c:\Repos\JRM
git add azure-pipelines.yml
git commit -m "Add Azure DevOps pipeline"
git push origin master
```

Pipeline körs automatiskt!

---

## 🔍 Alternativ: Manuell Deploy (Tills pipeline är klar)

### Via Azure DevOps Repos

1. **Push din kod till Azure DevOps**:
```powershell
cd c:\Repos\JRM
git add .
git commit -m "Ready for deployment"
git push origin master
```

2. **I Azure Portal → Deployment Center**:
   - Välj **External Git** om Azure Repos inte fungerar
   - **Repository URL**: `https://varderingsdata.visualstudio.com/VD%20Laboratory/_git/JRM`
   - **Branch**: `master`
   - **Kräver Personal Access Token** (PAT)

### Skapa PAT (Personal Access Token)

1. Azure DevOps → User Settings (högst upp till höger) → **Personal access tokens**
2. **New Token**
3. **Name**: `Azure-Deployment`
4. **Organization**: `varderingsdata`
5. **Expiration**: 90 days
6. **Scopes**: 
   - ✅ Code (Read)
   - ✅ Build (Read & execute)
7. **Create**
8. **Kopiera token** (visas bara en gång!)

---

## 📋 Checklista

- [ ] Service Connection skapad i Azure DevOps
- [ ] azure-pipelines.yml commitad till repo
- [ ] Pipeline körd första gången
- [ ] Deployment lyckad (kontrollera logs)
- [ ] App fungerar: https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net/health

---

## 🎯 Rekommendation

**Använd Metod 1 (Azure Portal)** - det är snabbast och Azure konfigurerar allt automatiskt!

Om du vill ha mer kontroll, använd Metod 2 med Azure Pipelines.

---

## 🔧 Troubleshooting

### "Could not find repo"
→ Kolla att du har access till projektet i Azure DevOps

### "Authentication failed"
→ Skapa en PAT och använd den istället

### "Build failed"
→ Kontrollera att `azure-pipelines.yml` är korrekt
→ Se logs i Azure DevOps: https://dev.azure.com/varderingsdata/VD%20Laboratory/_build

### "Deployment succeeded but app not working"
→ Kontrollera app settings i Azure Portal
→ Se logs: Deployment Center → Logs

---

## 📚 Länkar

- **Azure DevOps Project**: https://dev.azure.com/varderingsdata/VD%20Laboratory
- **Azure Portal Web App**: https://portal.azure.com → jrm-crm-api-prod-vsdmc5kbydcjc
- **App URL**: https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net
- **Frontend**: https://lively-grass-0a14e0d03.3.azurestaticapps.net

---

## ✅ Nästa Steg Efter Deployment

1. Testa backend: `curl https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net/health`
2. Uppdatera frontend config med backend URL
3. Koppla frontend till Azure Static Web Apps via GitHub/Azure DevOps
4. Uppdatera Azure B2C redirect URIs
