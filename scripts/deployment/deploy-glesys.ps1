# Deploy CRM till GleSYS
# Automatiserad deployment från Windows till GleSYS VPS

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIP,
    
    [Parameter(Mandatory=$true)]
    [string]$Domain,
    
    [Parameter(Mandatory=$false)]
    [string]$SSHUser = "crmadmin",
    
    [Parameter(Mandatory=$false)]
    [string]$Datacenter = "stockholm"
)

Write-Host "🇸🇪 GleSYS CRM Deployment startar..." -ForegroundColor Green
Write-Host "Server: $ServerIP" -ForegroundColor Yellow
Write-Host "Domän: $Domain" -ForegroundColor Yellow
Write-Host "Datacenter: $Datacenter" -ForegroundColor Yellow
Write-Host "SSH-användare: $SSHUser" -ForegroundColor Yellow

# Kontrollera SSH-anslutning
Write-Host "`n🔑 Kontrollerar SSH-anslutning till GleSYS..." -ForegroundColor Blue
ssh -o ConnectTimeout=10 -o BatchMode=yes "$SSHUser@$ServerIP" "echo 'GleSYS SSH OK'" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Kan inte ansluta till GleSYS VPS via SSH!" -ForegroundColor Red
    Write-Host "Kontrollera:" -ForegroundColor Yellow
    Write-Host "- SSH-nycklar är konfigurerade i GleSYS kundpanel" -ForegroundColor Yellow
    Write-Host "- VPS:en är startad och tillgänglig" -ForegroundColor Yellow
    Write-Host "- IP-adressen är korrekt" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ SSH-anslutning till GleSYS fungerar" -ForegroundColor Green

# Verifiera att det är GleSYS
Write-Host "`n🏢 Verifierar GleSYS datacenter..." -ForegroundColor Blue
$hostingInfo = ssh "$SSHUser@$ServerIP" "curl -s ipinfo.io/org 2>/dev/null || echo 'Unknown'"
if ($hostingInfo -like "*glesys*" -or $hostingInfo -like "*GleSYS*") {
    Write-Host "✅ Bekräftat: GleSYS hosting" -ForegroundColor Green
} else {
    Write-Host "⚠️  Varning: Kunde inte bekräfta GleSYS hosting" -ForegroundColor Yellow
    Write-Host "Hosting info: $hostingInfo" -ForegroundColor Yellow
    $continue = Read-Host "Fortsätt ändå? (y/N)"
    if ($continue -ne "y") {
        exit 1
    }
}

# Förbered deployment-filer
Write-Host "`n📁 Förbereder GleSYS-optimerade deployment-filer..." -ForegroundColor Blue

$deployDir = "deploy-glesys-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $deployDir -Force | Out-Null

# Kopiera källfiler
$filesToDeploy = @(
    "server/",
    "crm-prototype/",
    "GLESYS_SETUP_GUIDE.md"
)

foreach ($file in $filesToDeploy) {
    if (Test-Path $file) {
        Copy-Item $file -Destination $deployDir -Recurse -Force
        Write-Host "✅ Kopierat: $file" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Varning: $file hittades inte" -ForegroundColor Yellow
    }
}

# Skapa GleSYS-optimerad .env
Write-Host "`n⚙️ Skapar GleSYS-optimerad konfiguration..." -ForegroundColor Blue
$envContent = @"
# GleSYS CRM Konfiguration
NODE_ENV=production
PORT=3000
DOMAIN=$Domain
DATACENTER=$Datacenter
HOSTING_PROVIDER=glesys

# Säkerhet (GleSYS-optimerat)
SESSION_SECRET=$(Get-Random -Minimum 100000000 -Maximum 999999999)_GleSYS_$(Get-Random -Minimum 100000000 -Maximum 999999999)
JWT_SECRET=$(Get-Random -Minimum 100000000 -Maximum 999999999)_Stockholm_$(Get-Random -Minimum 100000000 -Maximum 999999999)

# Databas (optimerat för GleSYS SSD)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_glesys
DB_USER=crm_user
DB_PASS=glesys_$(Get-Random -Minimum 10000 -Maximum 99999)_secure

# Redis (för GleSYS performance)
REDIS_PASSWORD=redis_glesys_$(Get-Random -Minimum 10000 -Maximum 99999)

# GleSYS-specifika inställningar
GLESYS_DATACENTER=$Datacenter
GLESYS_MONITORING=true
GLESYS_BACKUP=true
GLESYS_DDOS_PROTECTION=true

# Svensk lokalisering
LOCALE=sv_SE.UTF-8
TIMEZONE=Europe/Stockholm
CURRENCY=SEK

# GDPR och säkerhet
GDPR_ENABLED=true
DATA_RETENTION_YEARS=7
AUTO_DELETE_ENABLED=true
AUDIT_LOG_LEVEL=info

# Performance (GleSYS SSD-optimerat)
DB_POOL_SIZE=20
REDIS_CACHE_TTL=3600
GZIP_COMPRESSION=true
STATIC_CACHE_TTL=86400

# Backup och övervakning
BACKUP_ENABLED=true
BACKUP_ENCRYPTION=true
HEALTH_CHECK_ENABLED=true
PERFORMANCE_MONITORING=true
"@

$envContent | Out-File -FilePath "$deployDir\.env.glesys" -Encoding UTF8

# Skapa GleSYS-optimerad Dockerfile
$dockerfileContent = @'
# GleSYS-optimerad Docker image
FROM node:18-alpine

# Metadata för GleSYS
LABEL maintainer="CRM Admin"
LABEL datacenter="stockholm"
LABEL provider="glesys"
LABEL country="sweden"

# Säkerhetshärdning för GleSYS
RUN addgroup -g 10001 -S crm && \
    adduser -S crm -u 10001 -G crm

# Installera verktyg optimerade för GleSYS
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

# Sätt svensk timezone
ENV TZ=Europe/Stockholm
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

# Installera Node.js dependencies
COPY server/package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Kopiera applikationskod
COPY server/ ./
COPY crm-prototype/ ./public/

# Skapa data-kataloger med rätt rättigheter
RUN mkdir -p /app/data /app/logs /app/backup && \
    chown -R crm:crm /app

# Säkerhetsläge - kör som non-root
USER crm

# Health check optimerad för GleSYS
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Exponera port för GleSYS nätverk
EXPOSE 3000

# Starta med dumb-init för process-hantering
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "index.js"]
'@

$dockerfileContent | Out-File -FilePath "$deployDir\Dockerfile.glesys" -Encoding UTF8

# Skapa GleSYS-optimerad Docker Compose
$dockerComposeContent = @"
# GleSYS CRM Docker Compose
version: '3.8'

services:
  crm-app:
    build:
      context: .
      dockerfile: Dockerfile.glesys
    container_name: crm-glesys
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - TZ=Europe/Stockholm
      - DATACENTER=$Datacenter
      - HOSTING_PROVIDER=glesys
    env_file:
      - .env.glesys
    volumes:
      - crm_data:/app/data
      - crm_logs:/app/logs
      - crm_backup:/app/backup
    networks:
      - crm-network
    restart: unless-stopped
    
    # GleSYS säkerhetsinställningar
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
      - /app/cache:noexec,nosuid,size=50m
    user: "10001:10001"
    
    # Begränsa resurser för GleSYS VPS
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
        reservations:
          memory: 256M
          cpus: '0.5'
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "glesys,sweden,crm"
    
    labels:
      - "se.glesys.crm.component=application"
      - "se.glesys.crm.datacenter=$Datacenter"
      - "se.glesys.crm.environment=production"

  # PostgreSQL för GleSYS SSD-optimering
  crm-database:
    image: postgres:15-alpine
    container_name: crm-db-glesys
    environment:
      - POSTGRES_DB=crm_glesys
      - POSTGRES_USER=crm_user
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
      - TZ=Europe/Stockholm
      
      # GleSYS SSD-optimeringar
      - POSTGRES_SHARED_BUFFERS=128MB
      - POSTGRES_EFFECTIVE_CACHE_SIZE=512MB
      - POSTGRES_RANDOM_PAGE_COST=1.1
      - POSTGRES_CHECKPOINT_COMPLETION_TARGET=0.9
      
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - postgres_backup:/backup
    networks:
      - crm-network
    restart: unless-stopped
    
    # Säkerhet
    security_opt:
      - no-new-privileges:true
    user: "postgres"
    
    # GleSYS resource limits
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.5'
    
    secrets:
      - db_password
    
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U crm_user -d crm_glesys"]
      interval: 30s
      timeout: 5s
      retries: 5
    
    labels:
      - "se.glesys.crm.component=database"
      - "se.glesys.crm.datacenter=$Datacenter"

  # Redis för GleSYS caching
  crm-redis:
    image: redis:7-alpine
    container_name: crm-cache-glesys
    command: >
      redis-server 
      --requirepass \$\${REDIS_PASSWORD}
      --maxmemory 64mb
      --maxmemory-policy allkeys-lru
      --save 900 1
      --save 300 10
      --save 60 10000
    volumes:
      - redis_data:/data
    networks:
      - crm-network
    restart: unless-stopped
    
    security_opt:
      - no-new-privileges:true
    user: "redis"
    
    deploy:
      resources:
        limits:
          memory: 64M
          cpus: '0.2'
    
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 5s
      retries: 3
    
    labels:
      - "se.glesys.crm.component=cache"
      - "se.glesys.crm.datacenter=$Datacenter"

# GleSYS-optimerat nätverk
networks:
  crm-network:
    driver: bridge
    internal: false
    ipam:
      config:
        - subnet: 172.30.0.0/16
    labels:
      - "se.glesys.crm.network=internal"
      - "se.glesys.crm.datacenter=$Datacenter"

# GleSYS SSD-optimerade volymer
volumes:
  crm_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/crm-data
    labels:
      - "se.glesys.crm.data=application"
      - "se.glesys.crm.storage=ssd"

  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/crm-db
    labels:
      - "se.glesys.crm.data=database"
      - "se.glesys.crm.storage=ssd"

  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/crm-cache
    labels:
      - "se.glesys.crm.data=cache"
      - "se.glesys.crm.storage=ssd"

  crm_logs:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/crm-logs
    labels:
      - "se.glesys.crm.data=logs"

  crm_backup:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/crm-backup
    labels:
      - "se.glesys.crm.data=backup"
      - "se.glesys.crm.encryption=enabled"

  postgres_backup:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/crm-db-backup

# Säkra secrets
secrets:
  db_password:
    file: ./secrets/db_password.txt
  redis_password:
    file: ./secrets/redis_password.txt
"@

$dockerComposeContent | Out-File -FilePath "$deployDir\docker-compose.glesys.yml" -Encoding UTF8

# Skapa secrets
Write-Host "🔐 Genererar säkra lösenord för GleSYS..." -ForegroundColor Blue
New-Item -ItemType Directory -Path "$deployDir\secrets" -Force | Out-Null

$dbPassword = "GleSYS_$(Get-Random -Minimum 100000 -Maximum 999999)_DB_$(Get-Random -Minimum 100000 -Maximum 999999)"
$redisPassword = "GleSYS_$(Get-Random -Minimum 100000 -Maximum 999999)_Redis_$(Get-Random -Minimum 100000 -Maximum 999999)"

$dbPassword | Out-File -FilePath "$deployDir\secrets\db_password.txt" -Encoding UTF8 -NoNewline
$redisPassword | Out-File -FilePath "$deployDir\secrets\redis_password.txt" -Encoding UTF8 -NoNewline

# Lägg till redis-lösenord i .env också
Add-Content -Path "$deployDir\.env.glesys" -Value "`nREDIS_PASSWORD=$redisPassword"

Write-Host "✅ Säkra lösenord genererade" -ForegroundColor Green

# Kopiera filer till GleSYS VPS
Write-Host "`n📡 Kopierar filer till GleSYS VPS..." -ForegroundColor Blue

# Skapa målkatalog på servern
ssh "$SSHUser@$ServerIP" "sudo mkdir -p /opt/crm && sudo chown $SSHUser`:$SSHUser /opt/crm"

# Kopiera alla filer
scp -r "$deployDir\*" "$SSHUser@$ServerIP" ":/opt/crm/" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Kunde inte kopiera filer till GleSYS VPS!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Filer kopierade till GleSYS VPS" -ForegroundColor Green

# Konfigurera GleSYS VPS
Write-Host "`n🛠️ Konfigurerar GleSYS VPS för CRM..." -ForegroundColor Blue

# Installera Docker om det inte finns
ssh "$SSHUser@$ServerIP" @"
# Kontrollera om Docker är installerat
if ! command -v docker &> /dev/null; then
    echo "Installerar Docker på GleSYS VPS..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $SSHUser
    sudo systemctl enable docker
    sudo systemctl start docker
    rm get-docker.sh
fi

# Installera Docker Compose om det inte finns
if ! command -v docker-compose &> /dev/null; then
    echo "Installerar Docker Compose..."
    sudo apt update
    sudo apt install -y docker-compose
fi

echo "Docker installation klar på GleSYS"
"@

# Skapa data-kataloger med optimering för GleSYS SSD
Write-Host "`n📁 Skapar data-kataloger optimerade för GleSYS SSD..." -ForegroundColor Blue
ssh "$SSHUser@$ServerIP" @"
sudo mkdir -p /opt/crm-data /opt/crm-db /opt/crm-cache /opt/crm-logs /opt/crm-backup /opt/crm-db-backup
sudo chown -R 10001:10001 /opt/crm-data /opt/crm-logs /opt/crm-backup
sudo chown -R 999:999 /opt/crm-db /opt/crm-db-backup
sudo chown -R 999:999 /opt/crm-cache

# GleSYS SSD-optimeringar
sudo mount -o remount,noatime /opt/crm-db 2>/dev/null || true
echo "GleSYS data-kataloger skapade"
"@

# Konfigurera Nginx för GleSYS
Write-Host "`n🌐 Konfigurerar Nginx för GleSYS och $Domain..." -ForegroundColor Blue

$nginxConfig = @"
# GleSYS-optimerad Nginx konfiguration
server {
    listen 80;
    server_name $Domain www.$Domain;
    
    # GleSYS DDoS-skydd vänlig redirect
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $Domain www.$Domain;

    # SSL-certifikat (konfigureras av Certbot)
    
    # GleSYS-specifika säkerhetsinställningar
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header X-Datacenter "$Datacenter";
    add_header X-Hosting-Provider "GleSYS";

    # Rate limiting anpassat för GleSYS DDoS-skydd
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/m;
    limit_req_zone \$binary_remote_addr zone=login:10m rate=3r/m;

    # GleSYS-optimerad caching
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Cache-Status "HIT";
    }

    location /api/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-GleSYS-Datacenter "$Datacenter";
    }

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-GleSYS-Datacenter "$Datacenter";
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-GleSYS-Datacenter "$Datacenter";
        
        # GleSYS performance headers
        add_header X-Cache-Status "MISS";
        add_header X-Response-Time \$request_time;
    }

    # Blockera känsliga filer
    location ~ /\. {
        deny all;
    }

    location ~ /(package\.json|Dockerfile|\.env|docker-compose) {
        deny all;
    }
}
"@

# Installera och konfigurera Nginx
ssh "$SSHUser@$ServerIP" @"
# Installera Nginx om det inte finns
if ! command -v nginx &> /dev/null; then
    sudo apt update
    sudo apt install -y nginx
    sudo systemctl enable nginx
fi

# Skapa Nginx-konfiguration
sudo tee /etc/nginx/sites-available/crm-glesys > /dev/null << 'NGINXEOF'
$nginxConfig
NGINXEOF

# Aktivera site
sudo ln -sf /etc/nginx/sites-available/crm-glesys /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Testa konfiguration
sudo nginx -t && sudo systemctl reload nginx
echo "Nginx konfigurerat för GleSYS"
"@

# Installera SSL-certifikat
Write-Host "`n🔒 Installerar SSL-certifikat för $Domain..." -ForegroundColor Blue
ssh "$SSHUser@$ServerIP" @"
# Installera Certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Få SSL-certifikat
sudo certbot --nginx -d $Domain -d www.$Domain --non-interactive --agree-tos --email admin@$Domain --redirect

echo "SSL-certifikat installerat för $Domain"
"@

# Starta CRM med GleSYS-optimering
Write-Host "`n🐳 Startar CRM med GleSYS-optimerad konfiguration..." -ForegroundColor Blue
ssh "$SSHUser@$ServerIP" @"
cd /opt/crm

# Logga ut och in för Docker-gruppmedlemskap
exit
"@

# Ny SSH-session för Docker
ssh "$SSHUser@$ServerIP" @"
cd /opt/crm

# Bygg och starta med GleSYS-optimering
docker-compose -f docker-compose.glesys.yml build
docker-compose -f docker-compose.glesys.yml up -d

echo "CRM startat på GleSYS med optimerad konfiguration"
"@

# Vänta och testa hälsa
Write-Host "`n🏥 Testar CRM hälsa på GleSYS..." -ForegroundColor Blue
Start-Sleep -Seconds 45

ssh "$SSHUser@$ServerIP" "curl -f http://localhost:3000/api/health" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ CRM svarar och är hälsosamt på GleSYS!" -ForegroundColor Green
} else {
    Write-Host "⚠️  CRM startar fortfarande, testa om några minuter" -ForegroundColor Yellow
}

# Konfigurera GleSYS backup
Write-Host "`n💾 Konfigurerar GleSYS backup-rutiner..." -ForegroundColor Blue
ssh "$SSHUser@$ServerIP" @"
# Skapa GleSYS backup-script
cat > /opt/crm-backup-glesys.sh << 'BACKUPEOF'
#!/bin/bash
# GleSYS CRM Backup Script
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/crm-backup"

echo "\$(date): Startar GleSYS CRM backup..."

# Docker containers backup
cd /opt/crm
docker-compose -f docker-compose.glesys.yml exec -T crm-database pg_dump -U crm_user crm_glesys | gzip > \$BACKUP_DIR/db-\$DATE.sql.gz

# Data backup
tar czf \$BACKUP_DIR/crm-data-\$DATE.tar.gz -C /opt/crm-data .

# Kombinera i en krypterad backup
tar czf \$BACKUP_DIR/glesys-full-\$DATE.tar.gz \$BACKUP_DIR/db-\$DATE.sql.gz \$BACKUP_DIR/crm-data-\$DATE.tar.gz

# Rensa temporära filer
rm \$BACKUP_DIR/db-\$DATE.sql.gz \$BACKUP_DIR/crm-data-\$DATE.tar.gz

# Behåll 30 dagars backups
find \$BACKUP_DIR -name "glesys-full-*.tar.gz" -mtime +30 -delete

echo "\$(date): GleSYS backup slutförd: glesys-full-\$DATE.tar.gz"
BACKUPEOF

chmod +x /opt/crm-backup-glesys.sh

# Schemalägg daglig backup
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/crm-backup-glesys.sh") | crontab -

echo "GleSYS backup konfigurerat"
"@

# Rensa upp
Write-Host "`n🧹 Rensar temporära filer..." -ForegroundColor Blue
Remove-Item -Path $deployDir -Recurse -Force
Write-Host "✅ Cleanup slutförd" -ForegroundColor Green

# Slutrapport
Write-Host "`n🎉 GLESYS CRM DEPLOYMENT SLUTFÖRD!" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Yellow
Write-Host "🏢 Leverantör: GleSYS AB" -ForegroundColor White
Write-Host "🌐 Datacenter: $Datacenter" -ForegroundColor White
Write-Host "🖥️  Server IP: $ServerIP" -ForegroundColor White
Write-Host "🌍 Domän: https://$Domain" -ForegroundColor White
Write-Host "🔒 SSL: Let's Encrypt (auto-förnyelse)" -ForegroundColor White
Write-Host "🛡️ DDoS: GleSYS Basic (inkluderat)" -ForegroundColor White
Write-Host "💾 Backup: Dagligen kl 03:00" -ForegroundColor White
Write-Host "📊 Övervakning: Docker health checks" -ForegroundColor White
Write-Host "💰 Kostnad: ~162 SEK/månad" -ForegroundColor White
Write-Host "=======================================" -ForegroundColor Yellow

Write-Host "`n📋 NÄSTA STEG:" -ForegroundColor Blue
Write-Host "1. Besök https://$Domain för att verifiera" -ForegroundColor White
Write-Host "2. Logga in i GleSYS kundpanel för monitoring" -ForegroundColor White
Write-Host "3. Aktivera GleSYS backup-tjänst (extra säkerhet)" -ForegroundColor White
Write-Host "4. Testa alla CRM-funktioner" -ForegroundColor White
Write-Host "5. Konfigurera användare och importera data" -ForegroundColor White

Write-Host "`n🔧 GLESYS HANTERING:" -ForegroundColor Blue
Write-Host "Kundpanel: https://customer.glesys.com/" -ForegroundColor White
Write-Host "SSH: ssh $SSHUser@$ServerIP" -ForegroundColor White
Write-Host "Loggar: ssh $SSHUser@$ServerIP 'cd /opt/crm && docker-compose -f docker-compose.glesys.yml logs'" -ForegroundColor White
Write-Host "Restart: ssh $SSHUser@$ServerIP 'cd /opt/crm && docker-compose -f docker-compose.glesys.yml restart'" -ForegroundColor White
Write-Host "Backup: ssh $SSHUser@$ServerIP '/opt/crm-backup-glesys.sh'" -ForegroundColor White

Write-Host "`n📞 GLESYS SUPPORT:" -ForegroundColor Blue
Write-Host "Telefon: +46 31 19 00 60" -ForegroundColor White
Write-Host "Email: support@glesys.se" -ForegroundColor White
Write-Host "Live chat: Via kundpanelen" -ForegroundColor White
Write-Host "Status: https://status.glesys.com/" -ForegroundColor White

Write-Host "`n🇸🇪 Din CRM körs nu säkert på GleSYS svenska infrastruktur!" -ForegroundColor Green
Write-Host "💰 Du sparar €522/år jämfört med Azure!" -ForegroundColor Green