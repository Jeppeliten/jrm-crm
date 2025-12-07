# Deploy script för Windows till VPS
# Kör detta från din Windows-dator för att ladda upp CRM till VPS

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIP,
    
    [Parameter(Mandatory=$true)]
    [string]$Username = "crm",
    
    [string]$Domain = ""
)

Write-Host "🚀 Deploying CRM to VPS..." -ForegroundColor Green

# Kontrollera att vi är i rätt directory
if (!(Test-Path "server\index.js")) {
    Write-Error "Kör detta script från CRM root directory (där server\ finns)"
    exit 1
}

# Kontrollera SCP
if (!(Get-Command scp -ErrorAction SilentlyContinue)) {
    Write-Error "SCP inte tillgängligt. Installera OpenSSH eller använd WSL."
    exit 1
}

Write-Host "📦 Förbereder filer för upload..." -ForegroundColor Yellow

# Skapa temp directory för clean kod
$tempDir = "crm-deploy-temp"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}

# Kopiera endast nödvändiga filer
New-Item -ItemType Directory -Path $tempDir
Copy-Item "server" -Destination $tempDir -Recurse
Copy-Item "crm-prototype" -Destination $tempDir -Recurse
Copy-Item "docker-compose.production.yml" -Destination $tempDir
Copy-Item "Dockerfile" -Destination $tempDir

# Kopiera config-filer om de finns
$configFiles = @("package.json", "README.md")
foreach ($file in $configFiles) {
    if (Test-Path $file) {
        Copy-Item $file -Destination $tempDir
    }
}

Write-Host "📤 Laddar upp till VPS..." -ForegroundColor Yellow

# Upload med SCP
scp -r "$tempDir\*" "${Username}@${ServerIP}:~/crm/"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Upload misslyckades!"
    Remove-Item $tempDir -Recurse -Force
    exit 1
}

# Cleanup
Remove-Item $tempDir -Recurse -Force

Write-Host "🐳 Startar Docker på VPS..." -ForegroundColor Yellow

# Kör kommandon på VPS via SSH
$sshCommands = @(
    "cd ~/crm",
    "docker-compose -f docker-compose.production.yml down",
    "docker-compose -f docker-compose.production.yml build",
    "docker-compose -f docker-compose.production.yml up -d",
    "sleep 10",
    "docker ps",
    "curl -I http://localhost:3000 || echo 'Service not ready yet'"
)

foreach ($cmd in $sshCommands) {
    Write-Host "Kör: $cmd" -ForegroundColor Cyan
    ssh "${Username}@${ServerIP}" $cmd
}

Write-Host "✅ Deploy klar!" -ForegroundColor Green
Write-Host ""
Write-Host "NÄSTA STEG:" -ForegroundColor Yellow
Write-Host "1. Få SSL-certifikat:"
Write-Host "   ssh ${Username}@${ServerIP}"
if ($Domain) {
    Write-Host "   sudo certbot --nginx -d $Domain"
    Write-Host ""
    Write-Host "2. Testa din CRM:"
    Write-Host "   https://$Domain"
} else {
    Write-Host "   sudo certbot --nginx -d DIN_DOMÄN.se"
    Write-Host ""
    Write-Host "2. Testa din CRM:"
    Write-Host "   https://DIN_DOMÄN.se"
}
Write-Host ""
Write-Host "FELSÖKNING:"
Write-Host "- Loggar: ssh ${Username}@${ServerIP} 'docker logs crm-app'"
Write-Host "- Status: ssh ${Username}@${ServerIP} 'docker ps'"

# Exempel på användning:
Write-Host ""
Write-Host "EXEMPEL:" -ForegroundColor Gray
Write-Host ".\deploy.ps1 -ServerIP 1.2.3.4 -Username crm -Domain crm.dittföretag.se"