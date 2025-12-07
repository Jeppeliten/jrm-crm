# Azure Deployment Fix Script - PowerShell Version
# Kör detta i PowerShell med admin-rättigheter

Write-Host "🚀 Starting Azure Deployment Fix..." -ForegroundColor Green

# Variables
$resourceGroup = "rg-jrm-crm-prod"
$appName = "jrm-crm-api-prod-vsdmc5kbydcjc"
$repoUrl = "https://varderingsdata.visualstudio.com/VD%20Laboratory/_git/JRM"
$branch = "master"
$azCmd = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"

Write-Host "📋 Step 1: Configuring App Settings..." -ForegroundColor Yellow
& $azCmd webapp config appsettings set `
  --name $appName `
  --resource-group $resourceGroup `
  --settings `
    PROJECT=server `
    SCM_DO_BUILD_DURING_DEPLOYMENT=true `
    WEBSITE_NODE_DEFAULT_VERSION=~20 `
    NODE_ENV=production

Write-Host "📋 Step 2: Configuring deployment source..." -ForegroundColor Yellow
& $azCmd webapp deployment source config `
  --name $appName `
  --resource-group $resourceGroup `
  --repo-url $repoUrl `
  --branch $branch `
  --manual-integration

Write-Host "📋 Step 3: Syncing deployment..." -ForegroundColor Yellow
& $azCmd webapp deployment source sync `
  --name $appName `
  --resource-group $resourceGroup

Write-Host "⏳ Waiting 60 seconds for deployment..." -ForegroundColor Cyan
Start-Sleep -Seconds 60

Write-Host "🧪 Testing health endpoint..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "https://$appName.azurewebsites.net/health"
    Write-Host "✅ Health: $($health | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
}

Write-Host "🧪 Testing brands endpoint..." -ForegroundColor Cyan
try {
    $brands = Invoke-RestMethod -Uri "https://$appName.azurewebsites.net/api/brands"
    Write-Host "✅ Brands: $($brands | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Brands check failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ Deployment script completed!" -ForegroundColor Green
Write-Host "📍 Frontend: https://lively-grass-0a14e0d03.3.azurestaticapps.net" -ForegroundColor Cyan
Write-Host "📍 Backend: https://$appName.azurewebsites.net" -ForegroundColor Cyan
