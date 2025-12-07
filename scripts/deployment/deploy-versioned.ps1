# PowerShell deployment script för Windows
# Användning: .\deploy-versioned.ps1 -Environment staging -Version auto

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("staging", "production", "development")]
    [string]$Environment = "staging",
    
    [Parameter(Mandatory=$false)]
    [string]$Version = "auto"
)

# Färger för output
function Write-Info { Write-Host "INFO: $args" -ForegroundColor Blue }
function Write-Success { Write-Host "SUCCESS: $args" -ForegroundColor Green }
function Write-Warning { Write-Host "WARNING: $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "ERROR: $args" -ForegroundColor Red }

# Varibler
$BackupDir = ".\backups"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

Write-Info "Starting CRM deployment to $Environment"

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

# Git status check för production
if ($Environment -eq "production") {
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Write-Error "You have uncommitted changes. Commit or stash before production deployment."
        exit 1
    }
    
    $currentBranch = git rev-parse --abbrev-ref HEAD
    if ($currentBranch -ne "main") {
        Write-Error "Production deployment must be from 'main' branch. Current: $currentBranch"
        exit 1
    }
}

# Version management
Push-Location server
try {
    if ($Version -eq "auto") {
        if ($Environment -eq "production") {
            npm version minor --no-git-tag-version
        } else {
            npm version patch --no-git-tag-version
        }
        $NewVersion = (Get-Content package.json | ConvertFrom-Json).version
        Write-Success "Auto-incremented version to: $NewVersion"
    } else {
        npm version $Version --no-git-tag-version
        $NewVersion = $Version
        Write-Success "Set version to: $NewVersion"
    }
    
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

# Build Docker image
Write-Info "Building Docker image..."
docker build -t "crm-app:$NewVersion" -t "crm-app:latest" .
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build failed"
    exit 1
}
Write-Success "Docker image built: crm-app:$NewVersion"

# Environment-specific deployment
switch ($Environment) {
    "staging" {
        Write-Info "Deploying to staging..."
        docker-compose -f docker-compose.staging.yml down
        docker-compose -f docker-compose.staging.yml up -d
        $HealthUrl = "http://localhost:3001/api/health"
    }
    "production" {
        Write-Info "Deploying to production..."
        docker-compose -f docker-compose.production.yml down
        docker-compose -f docker-compose.production.yml up -d
        $HealthUrl = "http://localhost:3000/api/health"
    }
    "development" {
        Write-Info "Starting development environment..."
        docker-compose down
        docker-compose up -d
        $HealthUrl = "http://localhost:3000/api/health"
    }
}

# Health check
Write-Info "Running health check..."
Start-Sleep 10

for ($i = 1; $i -le 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Success "Health check passed"
            break
        }
    } catch {
        if ($i -eq 30) {
            Write-Error "Health check failed after 30 attempts"
            Write-Warning "Rolling back..."
            docker-compose down
            exit 1
        }
        Write-Info "Health check attempt $i/30..."
        Start-Sleep 2
    }
}

# Success message
Write-Success "Deployment completed successfully!"
Write-Info "Version: $NewVersion"
Write-Info "Environment: $Environment"
Write-Info "Health check URL: $HealthUrl"

# Git tag för production
if ($Environment -eq "production") {
    git add server\package.json
    git commit -m "chore: bump version to $NewVersion"
    git tag "v$NewVersion"
    Write-Success "Created git tag: v$NewVersion"
    Write-Info "Push with: git push origin main --tags"
}

Write-Success "Deployment complete! CRM is running on $Environment"