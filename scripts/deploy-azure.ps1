# Azure One-Click Deployment Script
# Kör detta för att deploya till Azure på ~10 minuter

param(
    [string]$ResourceGroup = "jrm-crm-prod",
    [string]$Location = "westeurope",
    [string]$AppName = "jrm-crm",
    [switch]$SkipCosmosDB,
    [switch]$DryRun
)

Write-Host "🚀 JRM CRM Azure Deployment" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check Azure CLI
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Azure CLI is not installed!" -ForegroundColor Red
    Write-Host "Install from: https://aka.ms/InstallAzureCLIDirect" -ForegroundColor Yellow
    exit 1
}

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "❌ Not logged in to Azure!" -ForegroundColor Red
    Write-Host "Running: az login" -ForegroundColor Yellow
    az login
}

Write-Host "✅ Logged in as: $($account.user.name)" -ForegroundColor Green
Write-Host "✅ Subscription: $($account.name)" -ForegroundColor Green
Write-Host ""

# Confirm deployment
Write-Host "Deployment Configuration:" -ForegroundColor Cyan
Write-Host "  Resource Group: $ResourceGroup" -ForegroundColor White
Write-Host "  Location: $Location" -ForegroundColor White
Write-Host "  App Name: $AppName" -ForegroundColor White
Write-Host "  Cosmos DB: $(-not $SkipCosmosDB)" -ForegroundColor White
Write-Host ""

if (-not $DryRun) {
    $confirm = Read-Host "Continue with deployment? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "❌ Deployment cancelled" -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "Starting deployment..." -ForegroundColor Green
Write-Host ""

# Step 1: Create Resource Group
Write-Host "[1/10] Creating Resource Group..." -ForegroundColor Yellow
if (-not $DryRun) {
    az group create --name $ResourceGroup --location $Location --output none
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create resource group" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Resource Group created: $ResourceGroup" -ForegroundColor Green
Write-Host ""

# Step 2: Create App Service Plan
Write-Host "[2/10] Creating App Service Plan (B1)..." -ForegroundColor Yellow
$planName = "$AppName-plan"
if (-not $DryRun) {
    az appservice plan create `
        --name $planName `
        --resource-group $ResourceGroup `
        --sku B1 `
        --is-linux `
        --output none
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create App Service Plan" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ App Service Plan created: $planName (€40/month)" -ForegroundColor Green
Write-Host ""

# Step 3: Create Web App for Backend
Write-Host "[3/10] Creating Backend Web App..." -ForegroundColor Yellow
$backendName = "$AppName-backend"
if (-not $DryRun) {
    az webapp create `
        --name $backendName `
        --resource-group $ResourceGroup `
        --plan $planName `
        --runtime "NODE:22-lts" `
        --output none
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create Web App" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Backend Web App created: https://$backendName.azurewebsites.net" -ForegroundColor Green
Write-Host ""

# Step 4: Create Storage Account
Write-Host "[4/10] Creating Storage Account for backups..." -ForegroundColor Yellow
$storageName = $AppName.Replace("-", "") + "storage"
if (-not $DryRun) {
    az storage account create `
        --name $storageName `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku Standard_LRS `
        --output none
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create Storage Account" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Storage Account created: $storageName (€5/month)" -ForegroundColor Green
Write-Host ""

# Step 5: Create Cosmos DB (optional)
if (-not $SkipCosmosDB) {
    Write-Host "[5/10] Creating Cosmos DB (MongoDB API)..." -ForegroundColor Yellow
    $cosmosName = "$AppName-db"
    if (-not $DryRun) {
        az cosmosdb create `
            --name $cosmosName `
            --resource-group $ResourceGroup `
            --kind MongoDB `
            --server-version 4.2 `
            --default-consistency-level Session `
            --output none
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️  Failed to create Cosmos DB (continuing without it)" -ForegroundColor Yellow
        } else {
            Write-Host "✅ Cosmos DB created: $cosmosName (€25/month)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "[5/10] Skipping Cosmos DB (using file storage)" -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Create Application Insights
Write-Host "[6/10] Creating Application Insights..." -ForegroundColor Yellow
$insightsName = "$AppName-insights"
if (-not $DryRun) {
    az monitor app-insights component create `
        --app $insightsName `
        --location $Location `
        --resource-group $ResourceGroup `
        --application-type web `
        --output none 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Failed to create Application Insights (continuing without it)" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Application Insights created: $insightsName (€5/month)" -ForegroundColor Green
    }
}
Write-Host ""

# Step 7: Configure App Settings
Write-Host "[7/10] Configuring App Settings..." -ForegroundColor Yellow
if (-not $DryRun) {
    # Generate session secret
    $sessionSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
    
    # Get Application Insights key
    $insightsKey = az monitor app-insights component show `
        --app $insightsName `
        --resource-group $ResourceGroup `
        --query instrumentationKey -o tsv 2>$null
    
    # Get Storage connection string
    $storageConnectionString = az storage account show-connection-string `
        --name $storageName `
        --resource-group $ResourceGroup `
        --query connectionString -o tsv
    
    # Set app settings
    az webapp config appsettings set `
        --name $backendName `
        --resource-group $ResourceGroup `
        --settings `
            NODE_ENV=production `
            PORT=3000 `
            SESSION_SECRET=$sessionSecret `
            ENABLE_AZURE_B2C=false `
            ENABLE_WAF=true `
            ENABLE_SIEM=true `
            ENABLE_ATP=true `
            ENABLE_2FA=false `
            ENABLE_GDPR_FEATURES=true `
            ENABLE_AUDIT_LOGGING=true `
            BACKUP_ENABLED=true `
            BACKUP_INTERVAL_HOURS=24 `
            APPINSIGHTS_INSTRUMENTATIONKEY=$insightsKey `
            AZURE_STORAGE_CONNECTION_STRING=$storageConnectionString `
            LOG_LEVEL=info `
            DEBUG=false `
        --output none
}
Write-Host "✅ App Settings configured" -ForegroundColor Green
Write-Host ""

# Step 8: Enable HTTPS Only
Write-Host "[8/10] Enabling HTTPS Only..." -ForegroundColor Yellow
if (-not $DryRun) {
    az webapp update `
        --name $backendName `
        --resource-group $ResourceGroup `
        --https-only true `
        --output none
}
Write-Host "✅ HTTPS enforced" -ForegroundColor Green
Write-Host ""

# Step 9: Deploy Backend Code
Write-Host "[9/10] Deploying Backend Code..." -ForegroundColor Yellow
if (-not $DryRun) {
    Push-Location server
    
    # Install production dependencies
    npm install --production --silent
    
    # Create deployment package
    $zipPath = Join-Path $env:TEMP "deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
    Compress-Archive -Path * -DestinationPath $zipPath -Force
    
    # Deploy
    az webapp deployment source config-zip `
        --name $backendName `
        --resource-group $ResourceGroup `
        --src $zipPath `
        --output none
    
    # Cleanup
    Remove-Item $zipPath
    
    Pop-Location
}
Write-Host "✅ Backend deployed" -ForegroundColor Green
Write-Host ""

# Step 10: Restart and verify
Write-Host "[10/10] Restarting app..." -ForegroundColor Yellow
if (-not $DryRun) {
    az webapp restart `
        --name $backendName `
        --resource-group $ResourceGroup `
        --output none
    
    # Wait for startup
    Write-Host "Waiting for app to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
}
Write-Host "✅ App restarted" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend URL: https://$backendName.azurewebsites.net" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update frontend API endpoint to: https://$backendName.azurewebsites.net" -ForegroundColor White
Write-Host "2. Deploy frontend to Azure Static Web Apps or Azure Storage" -ForegroundColor White
Write-Host "3. Configure custom domain (optional)" -ForegroundColor White
Write-Host "4. Set up Azure AD B2C for authentication (optional)" -ForegroundColor White
Write-Host "5. Test the application: https://$backendName.azurewebsites.net/health" -ForegroundColor White
Write-Host ""
Write-Host "Monthly Cost Estimate:" -ForegroundColor Yellow
Write-Host "  App Service Plan (B1): €40" -ForegroundColor White
Write-Host "  Storage Account: €5" -ForegroundColor White
if (-not $SkipCosmosDB) {
    Write-Host "  Cosmos DB: €25" -ForegroundColor White
}
Write-Host "  Application Insights: €5" -ForegroundColor White
$totalCost = if ($SkipCosmosDB) { 50 } else { 75 }
Write-Host "  Total: ~€$totalCost/month" -ForegroundColor Green
Write-Host ""
Write-Host "View resources: https://portal.azure.com/#@/resource/subscriptions/$($account.id)/resourceGroups/$ResourceGroup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Logs: az webapp log tail --name $backendName --resource-group $ResourceGroup" -ForegroundColor Cyan
Write-Host ""
