# Azure Behörighetsguide för JRM CRM Deployment

## Problem
Du har inte behörighet att skapa resources i Azure-prenumerationen "Marketing-Test-1".

## Nuvarande situation
- **Prenumeration**: Marketing-Test-1
- **Användare**: jesper.liten@varderingsdata.se
- **Fel**: `AuthorizationFailed` - ingen behörighet att skapa resource groups

## Lösningar

### Alternativ 1: Be om Contributor-rättigheter (REKOMMENDERAT)

Kontakta din Azure-administratör och be om **Contributor**-rollen på prenumerationen.

**Skicka detta till din Azure-admin:**

```
Hej!

Jag behöver deploya JRM CRM-systemet till Azure och behöver följande behörigheter:

Prenumeration: Marketing-Test-1 (80c19c59-1b0a-4fc7-b482-2cb49e7a1bb4)
Användare: jesper.liten@varderingsdata.se
Roll: Contributor (eller Owner)
Scope: Hela prenumerationen ELLER en dedikerad Resource Group

Resurser som ska skapas:
- Resource Group: jrm-crm-prod
- App Service Plan (B1): ~€40/mån
- Web App (Backend)
- Storage Account: ~€5/mån
- Cosmos DB (MongoDB): ~€25/mån
- Application Insights: ~€5/mån
Total kostnad: ~€75/månad

Tack!
```

### Alternativ 2: Använd en annan prenumeration

Om du har tillgång till en annan Azure-prenumeration där du har rättigheter:

```powershell
# Lista alla prenumerationer
az account list --output table

# Byt till rätt prenumeration
az account set --subscription "PRENUMERATIONS-ID"

# Kör deployment igen
.\scripts\deploy-azure.ps1 -Location "swedencentral"
```

### Alternativ 3: Skapa en Trial-prenumeration

Skapa en gratis Azure-prenumeration (12 månader gratis + 200 USD kredit):

1. Gå till: https://azure.microsoft.com/free/
2. Logga in med ditt Microsoft-konto
3. Aktivera gratis trial
4. Byt till den nya prenumerationen:
   ```powershell
   az account set --subscription "Azure for Students" # eller vad den heter
   ```

## Verifiera dina behörigheter

Kör detta för att se vilka rättigheter du har:

```powershell
# Ladda PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Visa nuvarande prenumeration
az account show

# Lista alla roller du har
az role assignment list --assignee jesper.liten@varderingsdata.se --output table

# Testa om du kan lista resources
az resource list --output table
```

## När du fått rätt behörigheter

Kör deployment-scriptet:

```powershell
cd c:\Repos\JRM

# Ladda PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Kör deployment
echo "yes" | .\scripts\deploy-azure.ps1 -Location "swedencentral"
```

## Temporär lösning: Lokal development

Medans du väntar på Azure-rättigheter kan du köra systemet lokalt:

```powershell
cd c:\Repos\JRM\server
node index.js
```

Sedan öppna: http://localhost:3000

## Nästa steg

1. ✅ Azure CLI är installerat och fungerar
2. ⏳ **Väntar på Contributor-rättigheter**
3. ⏳ Kör deployment när rättigheter finns
4. ⏳ Konfigurera custom domain
5. ⏳ Sätt upp Azure AD B2C

## Support

Om du har frågor, kontakta:
- Azure-admin för behörigheter
- DevOps-team för deployment-hjälp
