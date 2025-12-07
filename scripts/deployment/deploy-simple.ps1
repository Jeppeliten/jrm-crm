# Simplified deployment för development utan Docker
# Användning: .\deploy-simple.ps1 -Environment development

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("staging", "production", "development")]
    [string]$Environment = "development"
)

function Write-Info { Write-Host "INFO: $args" -ForegroundColor Blue }
function Write-Success { Write-Host "SUCCESS: $args" -ForegroundColor Green }
function Write-Warning { Write-Host "WARNING: $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "ERROR: $args" -ForegroundColor Red }

$BackupDir = ".\backups" have
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Info "Starting simple CRM deployment to $Environment"

# Kontrollera att vi är i rätt directory
if (-not (Test-Path "server\package.json")) {
    Write-Error "Must be run from project root directory"
    exit 1
}

# Skapa backup
Write-Info "Creating backup..."
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

if (Test-Path "server\state.json") {
    Copy-Item "server\state.json" "$BackupDir\state_$Timestamp.json"
    Write-Success "Backup created: $BackupDir\state_$Timestamp.json"
}

# Version management
Push-Location server
try {
    # Auto-increment patch version för development
    npm version patch --no-git-tag-version
    $NewVersion = (Get-Content package.json | ConvertFrom-Json).version
    Write-Success "Auto-incremented version to: $NewVersion"
    
    # Install dependencies
    Write-Info "Installing dependencies..."
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed"
    }
    Write-Success "Dependencies installed"
} finally {
    Pop-Location
}

# Syntax check
Write-Info "Running syntax checks..."
node -c server\index.js
if ($LASTEXITCODE -ne 0) {
    Write-Error "Syntax error in server\index.js"
    exit 1
}

node -c server\outlook-integration-server.js
if ($LASTEXITCODE -ne 0) {
    Write-Error "Syntax error in server\outlook-integration-server.js"
    exit 1
}
Write-Success "Syntax checks passed"

# Stoppa befintliga processer
Write-Info "Stopping existing Node processes..."
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2

# Starta servern
Write-Info "Starting CRM server..."
Start-Process -FilePath "node" -ArgumentList "server/index.js" -WorkingDirectory (Get-Location) -WindowStyle Hidden

# Health check
Write-Info "Running health check..."
Start-Sleep 5

$HealthUrl = "http://localhost:3000/api/health"

for ($i = 1; $i -le 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Success "Health check passed"
            $healthData = $response.Content | ConvertFrom-Json
            Write-Info "Server version: $($healthData.version)"
            break
        }
    } catch {
        if ($i -eq 10) {
            Write-Error "Health check failed after 10 attempts"
            Write-Warning "Server might not have started properly"
            Write-Info "Check manually at: $HealthUrl"
            exit 1
        }
        Write-Info "Health check attempt $i/10..."
        Start-Sleep 2
    }
}

# Git commit för version update
git add server\package.json
git commit -m "chore: bump version to $NewVersion [auto-deployment]"

Write-Success "Deployment completed successfully!"
Write-Info "Version: $NewVersion"
Write-Info "Environment: $Environment"
Write-Info "CRM running at: http://localhost:3000"
Write-Info "Health check: $HealthUrl"

Write-Success "Deployment complete! CRM is running on $Environment"