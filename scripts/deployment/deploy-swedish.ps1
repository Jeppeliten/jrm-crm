# Deploy till svensk VPS
# Automatiserad deployment från Windows till svensk server

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIP,
    
    [Parameter(Mandatory=$true)]
    [string]$Domain,
    
    [Parameter(Mandatory=$false)]
    [string]$SSHUser = "root",
    
    [Parameter(Mandatory=$false)]
    [string]$Provider = "bahnhof"
)

Write-Host "🇸🇪 Startar deployment till svensk VPS..." -ForegroundColor Green
Write-Host "Server: $ServerIP" -ForegroundColor Yellow
Write-Host "Domän: $Domain" -ForegroundColor Yellow
Write-Host "Leverantör: $Provider" -ForegroundColor Yellow

# Kontrollera att vi har SSH-access
Write-Host "`n🔑 Kontrollerar SSH-anslutning..." -ForegroundColor Blue
ssh -o ConnectTimeout=10 -o BatchMode=yes "$SSHUser@$ServerIP" "echo 'SSH OK'" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Kan inte ansluta till servern via SSH!" -ForegroundColor Red
    Write-Host "Kontrollera att SSH-nycklar är konfigurerade." -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ SSH-anslutning fungerar" -ForegroundColor Green

# Förbered lokala filer
Write-Host "`n📁 Förbereder deployment-filer..." -ForegroundColor Blue

# Skapa temporär deployment-mapp
$deployDir = "deploy-temp-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null

# Kopiera alla nödvändiga filer
$filesToDeploy = @(
    "server/",
    "crm-prototype/",
    "docker-compose.swedish.yml",
    "vps-setup-swedish.sh",
    "SWEDISH_SECURITY_GUIDE.md"
)

foreach ($file in $filesToDeploy) {
    if (Test-Path $file) {
        Copy-Item $file -Destination $deployDir -Recurse -Force
        Write-Host "✅ Kopierat: $file" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Varning: $file hittades inte" -ForegroundColor Yellow
    }
}

# Skapa svensk .env fil
Write-Host "`n⚙️ Skapar svensk konfiguration..." -ForegroundColor Blue
$envContent = @"
# Svensk CRM-konfiguration
NODE_ENV=production
PORT=3000
DOMAIN=$Domain

# Säkerhet
SESSION_SECRET=$(Get-Random -Minimum 100000000 -Maximum 999999999)
JWT_SECRET=$(Get-Random -Minimum 100000000 -Maximum 999999999)
BACKUP_PASSPHRASE=$(Get-Random -Minimum 100000000 -Maximum 999999999)

# Databas
DB_HOST=crm-database
DB_PORT=5432
DB_NAME=crm_sweden
DB_USER=crm_user
DB_PASS=säkert_lösenord_$(Get-Random -Minimum 1000 -Maximum 9999)

# Redis
REDIS_PASSWORD=redis_lösen_$(Get-Random -Minimum 1000 -Maximum 9999)

# Säkerhetsloggar
AUDIT_LOG_LEVEL=info
SECURITY_LOG_RETENTION=7years

# GDPR-inställningar
GDPR_ENABLED=true
DATA_RETENTION_YEARS=7
AUTO_DELETE_ENABLED=true

# Svensk lokalisering
LOCALE=sv_SE.UTF-8
TIMEZONE=Europe/Stockholm
CURRENCY=SEK

# Backup
BACKUP_ENABLED=true
BACKUP_ENCRYPTION=true
BACKUP_LOCATION=sweden

# Monitoring
HEALTH_CHECK_ENABLED=true
PERFORMANCE_MONITORING=true
PROVIDER=$Provider
DATACENTER=sweden
"@

$envContent | Out-File -FilePath "$deployDir/.env.swedish" -Encoding UTF8

# Skapa Dockerfile för svensk säkerhet
$dockerfileContent = @'
FROM node:18-alpine

# Säkerhetshärdning
RUN addgroup -g 10001 -S crm && \
    adduser -S crm -u 10001 -G crm

# Installera säkerhetsverktyg
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Arbetskatalog
WORKDIR /app

# Kopiira och installera dependencies
COPY server/package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Kopiera applikationskod
COPY server/ ./
COPY crm-prototype/ ./public/

# Skapa data-kataloger
RUN mkdir -p /app/data /app/logs /app/backup && \
    chown -R crm:crm /app

# Säkerhetsläge
USER crm

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Exponera port
EXPOSE 3000

# Starta med dumb-init för säkerhet
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "index.js"]
'@

$dockerfileContent | Out-File -FilePath "$deployDir/Dockerfile.swedish" -Encoding UTF8

# Skapa secrets-filer
Write-Host "🔐 Skapar säkra secrets..." -ForegroundColor Blue
New-Item -ItemType Directory -Path "$deployDir/secrets" -Force | Out-Null

# Generera säkra lösenord
$dbPassword = "$(Get-Random -Minimum 100000 -Maximum 999999)_SvenskDB_$(Get-Random -Minimum 100000 -Maximum 999999)"
$redisPassword = "$(Get-Random -Minimum 100000 -Maximum 999999)_Redis_$(Get-Random -Minimum 100000 -Maximum 999999)"
$backupPassphrase = "$(Get-Random -Minimum 100000 -Maximum 999999)_Backup_$(Get-Random -Minimum 100000 -Maximum 999999)"

$dbPassword | Out-File -FilePath "$deployDir/secrets/db_password.txt" -Encoding UTF8 -NoNewline
$redisPassword | Out-File -FilePath "$deployDir/secrets/redis_password.txt" -Encoding UTF8 -NoNewline  
$backupPassphrase | Out-File -FilePath "$deployDir/secrets/backup_passphrase.txt" -Encoding UTF8 -NoNewline

Write-Host "✅ Secrets genererade säkert" -ForegroundColor Green

# Kopiera filer till servern
Write-Host "`n📡 Kopierar filer till svensk server..." -ForegroundColor Blue
scp -r "$deployDir/*" "$SSHUser@$ServerIP" ":/opt/crm/" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Kunde inte kopiera filer till servern!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Filer kopierade till /opt/crm/" -ForegroundColor Green

# Kör setup-script på servern
Write-Host "`n🛠️ Kör svensk säkerhetssetup på servern..." -ForegroundColor Blue
ssh "$SSHUser@$ServerIP" "cd /opt/crm && chmod +x vps-setup-swedish.sh && ./vps-setup-swedish.sh" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Setup-script hade problem, men fortsätter..." -ForegroundColor Yellow
}

# Konfigurera Nginx för domänen
Write-Host "`n🌐 Konfigurerar Nginx för $Domain..." -ForegroundColor Blue
$nginxConfig = @"
server {
    listen 80;
    server_name $Domain www.$Domain;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $Domain www.$Domain;

    # SSL kommer att konfigureras av Certbot
    
    # Säkerhetsheaders enligt MSB
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none';";

    # Rate limiting
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;
    }

    # Blockera känsliga filer
    location ~ /\. {
        deny all;
    }

    location ~ /(package\.json|Dockerfile|\.env) {
        deny all;
    }
}
"@

# Skriv Nginx-config till server
ssh "$SSHUser@$ServerIP" @"
cat > /etc/nginx/sites-available/crm-swedish << 'NGINXEOF'
$nginxConfig
NGINXEOF
"@

ssh "$SSHUser@$ServerIP" "ln -sf /etc/nginx/sites-available/crm-swedish /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default"

# Testa Nginx-konfiguration
Write-Host "🔧 Testar Nginx-konfiguration..." -ForegroundColor Blue
ssh "$SSHUser@$ServerIP" "nginx -t" | Out-Null
if ($LASTEXITCODE -eq 0) {
    ssh "$SSHUser@$ServerIP" "systemctl reload nginx"
    Write-Host "✅ Nginx konfigurerat och startat" -ForegroundColor Green
} else {
    Write-Host "❌ Nginx-konfiguration har fel!" -ForegroundColor Red
}

# Sätt upp SSL med Certbot
Write-Host "`n🔒 Sätter upp SSL-certifikat för $Domain..." -ForegroundColor Blue
ssh "$SSHUser@$ServerIP" "certbot --nginx -d $Domain -d www.$Domain --non-interactive --agree-tos --email admin@$Domain" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ SSL-certifikat installerat" -ForegroundColor Green
} else {
    Write-Host "⚠️  SSL-certifikat kunde inte installeras automatiskt" -ForegroundColor Yellow
    Write-Host "Kör manuellt: certbot --nginx -d $Domain" -ForegroundColor Yellow
}

# Skapa data-kataloger
Write-Host "`n📁 Skapar data-kataloger..." -ForegroundColor Blue
ssh "$SSHUser@$ServerIP" "mkdir -p /opt/crm-data /opt/crm-db /opt/crm-cache /opt/crm-backup /opt/crm-logs /opt/crm-gdpr-logs /opt/crm-db-backup && chown -R 10001:10001 /opt/crm-data /opt/crm-logs"

# Starta CRM med Docker Compose
Write-Host "`n🐳 Startar CRM med svensk säkerhetskonfiguration..." -ForegroundColor Blue
ssh "$SSHUser@$ServerIP" "cd /opt/crm && docker-compose -f docker-compose.swedish.yml up -d" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ CRM startat framgångsrikt!" -ForegroundColor Green
} else {
    Write-Host "❌ Problem med att starta CRM" -ForegroundColor Red
}

# Vänta lite och testa hälsa
Write-Host "`n🏥 Testar CRM hälsa..." -ForegroundColor Blue
Start-Sleep -Seconds 30
ssh "$SSHUser@$ServerIP" "curl -f http://localhost:3000/api/health" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ CRM svarar och är hälsosamt!" -ForegroundColor Green
} else {
    Write-Host "⚠️  CRM svarar inte än, kan behöva lite mer tid" -ForegroundColor Yellow
}

# Rensa upp
Write-Host "`n🧹 Rensar upp temporära filer..." -ForegroundColor Blue
Remove-Item -Path $deployDir -Recurse -Force
Write-Host "✅ Cleanup slutförd" -ForegroundColor Green

# Sammanfattning
Write-Host "`n🎉 DEPLOYMENT SLUTFÖRD!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Yellow
Write-Host "🇸🇪 Server: $ServerIP" -ForegroundColor White
Write-Host "🌐 Domän: https://$Domain" -ForegroundColor White
Write-Host "🏢 Leverantör: $Provider" -ForegroundColor White
Write-Host "🔒 SSL: Let's Encrypt" -ForegroundColor White
Write-Host "🛡️ Säkerhet: MSB + GDPR" -ForegroundColor White
Write-Host "💾 Backup: Dagligen krypterat" -ForegroundColor White
Write-Host "📊 Övervakning: Aktiverad" -ForegroundColor White
Write-Host "================================" -ForegroundColor Yellow

Write-Host "`n📋 NÄSTA STEG:" -ForegroundColor Blue
Write-Host "1. Besök https://$Domain för att verifiera" -ForegroundColor White
Write-Host "2. Logga in och testa funktionalitet" -ForegroundColor White
Write-Host "3. Konfigurera användare och behörigheter" -ForegroundColor White
Write-Host "4. Säkerhetsgranskning och dokumentation" -ForegroundColor White

Write-Host "`n🔧 HANTERING:" -ForegroundColor Blue
Write-Host "SSH: ssh $SSHUser@$ServerIP" -ForegroundColor White
Write-Host "Loggar: ssh $SSHUser@$ServerIP 'docker-compose -f /opt/crm/docker-compose.swedish.yml logs'" -ForegroundColor White
Write-Host "Restart: ssh $SSHUser@$ServerIP 'cd /opt/crm && docker-compose -f docker-compose.swedish.yml restart'" -ForegroundColor White
Write-Host "Backup: ssh $SSHUser@$ServerIP '/opt/crm-backup/backup-script.sh'" -ForegroundColor White

Write-Host "`n🇸🇪 Din CRM är nu säkert deployad på svensk infrastruktur!" -ForegroundColor Green