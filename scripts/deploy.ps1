#!/usr/bin/env pwsh
# Deploy server to Azure App Service using Azure CLI

param(
    [string]$AppName = "jrm-crm-api-prod-vsdmc5kbydcjc",
    [string]$ResourceGroup = "rg-jrm-crm-prod"
)

Write-Host "🚀 Deploying to $AppName..."

# Create zip of server folder
Write-Host "📦 Creating deployment package..."
$serverPath = Join-Path $PSScriptRoot "server"
$zipPath = Join-Path $PSScriptRoot "deploy.zip"

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Include only necessary files
$filesToZip = @(
    "index.js",
    "package.json",
    "package-lock.json",
    "routes",
    "middleware",
    "services",
    "config",
    "node_modules"
)

Push-Location $serverPath
try {
    # Create zip with only production files
    Compress-Archive -Path $filesToZip -DestinationPath $zipPath -Force
    Write-Host "✅ Package created: $zipPath"
    
    # Get file size
    $size = (Get-Item $zipPath).Length / 1MB
    Write-Host "📊 Size: $([math]::Round($size, 2)) MB"
    
    # Deploy using Azure CLI
    Write-Host "📤 Uploading to Azure..."
    az webapp deployment source config-zip `
        --resource-group $ResourceGroup `
        --name $AppName `
        --src $zipPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Deployment successful!"
    } else {
        Write-Host "❌ Deployment failed"
        exit 1
    }
}
finally {
    Pop-Location
}
