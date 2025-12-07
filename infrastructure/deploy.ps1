# ==========================================
# Azure Deployment Script med Bicep
# ==========================================

param(
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "rg-jrm-crm-prod",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "westeurope",
    
    [Parameter(Mandatory=$false)]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [string]$AzureB2cClientId = ""
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 JRM CRM - Azure Bicep Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kontrollera Azure CLI
Write-Host "📋 Kontrollerar Azure CLI..." -ForegroundColor Yellow
try {
    $azVersion = az --version
    Write-Host "✅ Azure CLI installerad" -ForegroundColor Green
} catch {
    Write-Host "❌ Azure CLI saknas. Installera från: https://aka.ms/installazurecliwindows" -ForegroundColor Red
    exit 1
}

# Logga in om inte redan inloggad
Write-Host "🔐 Kontrollerar Azure-inloggning..." -ForegroundColor Yellow
$account = az account show 2>$null
if (!$account) {
    Write-Host "Loggar in på Azure..." -ForegroundColor Yellow
    az login
}

$accountInfo = az account show | ConvertFrom-Json
Write-Host "✅ Inloggad som: $($accountInfo.user.name)" -ForegroundColor Green
Write-Host "   Subscription: $($accountInfo.name)" -ForegroundColor Gray
Write-Host ""

# Skapa Resource Group om den inte finns
Write-Host "📦 Skapar/verifierar Resource Group..." -ForegroundColor Yellow
az group create --name $ResourceGroup --location $Location --output none
Write-Host "✅ Resource Group: $ResourceGroup" -ForegroundColor Green
Write-Host ""

# Fråga efter Azure B2C Client ID om inte angiven
if ([string]::IsNullOrWhiteSpace($AzureB2cClientId)) {
    Write-Host "⚠️  Azure B2C Client ID saknas!" -ForegroundColor Yellow
    Write-Host "   Hämta från: https://portal.azure.com → Azure B2C → App registrations" -ForegroundColor Gray
    $AzureB2cClientId = Read-Host "Ange Azure B2C Client ID (eller lämna tom för testdeploy)"
    
    if ([string]::IsNullOrWhiteSpace($AzureB2cClientId)) {
        $AzureB2cClientId = "00000000-0000-0000-0000-000000000000"
        Write-Host "⚠️  Använder placeholder. Uppdatera senare i Azure Portal!" -ForegroundColor Yellow
    }
}

# Deploya med Bicep
Write-Host "🚀 Deployar infrastruktur med Bicep..." -ForegroundColor Yellow
Write-Host "   Detta kan ta 5-10 minuter..." -ForegroundColor Gray
Write-Host ""

$deploymentName = "jrm-crm-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

try {
    $deployment = az deployment group create `
        --resource-group $ResourceGroup `
        --template-file "./infrastructure/main.bicep" `
        --parameters environment=$Environment `
        --parameters appName="jrm-crm" `
        --parameters azureB2cTenantName="varderingsdata" `
        --parameters azureB2cClientId=$AzureB2cClientId `
        --name $deploymentName `
        --output json | ConvertFrom-Json
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ DEPLOYMENT KLAR!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    # Visa outputs
    $outputs = $deployment.properties.outputs
    
    Write-Host "🌐 Backend API:  $($outputs.webAppUrl.value)" -ForegroundColor Cyan
    Write-Host "🌐 Frontend:     $($outputs.staticWebAppUrl.value)" -ForegroundColor Cyan
    Write-Host "📊 Cosmos DB:    $($outputs.cosmosDbEndpoint.value)" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "📝 NÄSTA STEG" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1️⃣  Uppdatera client/azure-b2c-config.js:" -ForegroundColor White
    Write-Host "    API_BASE_URL = '$($outputs.webAppUrl.value)'" -ForegroundColor Gray
    Write-Host "    redirectUri = '$($outputs.staticWebAppUrl.value)'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2️⃣  Uppdatera Azure B2C Redirect URIs:" -ForegroundColor White
    Write-Host "    https://portal.azure.com → Azure B2C" -ForegroundColor Gray
    Write-Host "    Lägg till: $($outputs.staticWebAppUrl.value)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3️⃣  Deploya backend-kod:" -ForegroundColor White
    Write-Host "    cd server" -ForegroundColor Gray
    Write-Host "    Compress-Archive -Path * -DestinationPath ../deploy.zip -Force" -ForegroundColor Gray
    Write-Host "    az webapp deployment source config-zip --resource-group $ResourceGroup --name [WEB_APP_NAME] --src ../deploy.zip" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4️⃣  Koppla GitHub för frontend:" -ForegroundColor White
    Write-Host "    Azure Portal → Static Web App → Deployment → GitHub" -ForegroundColor Gray
    Write-Host ""
    Write-Host "5️⃣  Testa deployment:" -ForegroundColor White
    Write-Host "    curl $($outputs.webAppUrl.value)/health" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "💰 Kostnad: ~€0-10/månad (Free tier)" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ Deployment misslyckades!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 Felsökning:" -ForegroundColor Yellow
    Write-Host "   - Kör: az deployment group show --resource-group $ResourceGroup --name $deploymentName" -ForegroundColor Gray
    Write-Host "   - Kontrollera Azure Portal för detaljer" -ForegroundColor Gray
    exit 1
}
