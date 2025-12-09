# Quick Backend Deployment Script
# Deploys server folder to Azure App Service

$resourceGroup = "rg-jrm-crm-prod"
$appName = "jrm-crm-api-prod-vsdmc5kbydcjc"
$serverPath = "C:\Repos\JRM\server"
$zipPath = "C:\Repos\JRM\server-deploy.zip"

Write-Host "Creating deployment zip..." -ForegroundColor Cyan
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$serverPath\*" -DestinationPath $zipPath -Force

Write-Host "Deploying to Azure App Service..." -ForegroundColor Cyan
az webapp deployment source config-zip `
    --resource-group $resourceGroup `
    --name $appName `
    --src $zipPath `
    --timeout 300

Write-Host "Cleaning up..." -ForegroundColor Cyan
Remove-Item $zipPath -Force

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Testing API..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
Invoke-RestMethod -Uri "https://$appName.azurewebsites.net/health"
