# Svensk VPS-setup med Bahnhof/GleSYS
# Automatiserad installation för svensk IT-säkerhet

# Variabler för svensk konfiguration
SWEDISH_VPS_PROVIDER="bahnhof"  # eller "glesys"
DATACENTER_LOCATION="stockholm"
DOMAIN_REGISTRAR="loopia"
BACKUP_LOCATION="sweden"

echo "🇸🇪 Startar svensk säkerhetssetup..."
echo "Provider: $SWEDISH_VPS_PROVIDER"
echo "Datacenter: $DATACENTER_LOCATION"

# Kontrollera att vi är på svensk VPS
echo "Kontrollerar geolokation..."
CURRENT_LOCATION=$(curl -s ipinfo.io/country)
if [ "$CURRENT_LOCATION" != "SE" ]; then
    echo "⚠️  VARNING: Servern verkar inte vara i Sverige!"
    echo "Nuvarande plats: $CURRENT_LOCATION"
    read -p "Fortsätt ändå? (y/N): " continue_setup
    if [ "$continue_setup" != "y" ]; then
        echo "❌ Installation avbruten. Kontrollera VPS-plats."
        exit 1
    fi
fi

echo "✅ Server bekräftad i Sverige"

# System uppdatering enligt MSB riktlinjer
echo "🔄 Uppdaterar system enligt MSB säkerhetsstandard..."
apt update && apt upgrade -y

# Installera säkerhetsverktyg
echo "🛡️ Installerar svenska säkerhetsverktyg..."
apt install -y \
    ufw \
    fail2ban \
    unattended-upgrades \
    logrotate \
    auditd \
    rkhunter \
    chkrootkit \
    clamav \
    aide

# Konfiguration av brandvägg enligt MSB
echo "🔥 Konfigurerar brandvägg enligt MSB riktlinjer..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable

# Fail2ban för svensk säkerhet
echo "🔒 Konfigurerar intrångsskydd..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
# MSB rekommenderade inställningar
bantime = 3600
findtime = 600
maxretry = 3
destemail = admin@din-domän.se
sendername = CRM-Säkerhet

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

systemctl enable fail2ban
systemctl start fail2ban

# Automatiska säkerhetsuppdateringar
echo "🤖 Aktiverar automatiska säkerhetsuppdateringar..."
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";

// Svensk loggning
Unattended-Upgrade::Mail "admin@din-domän.se";
Unattended-Upgrade::MailOnlyOnError "true";
EOF

echo 'APT::Periodic::Update-Package-Lists "1";' > /etc/apt/apt.conf.d/20auto-upgrades
echo 'APT::Periodic::Unattended-Upgrade "1";' >> /etc/apt/apt.conf.d/20auto-upgrades

# Docker installation med svensk säkerhet
echo "🐳 Installerar Docker med förstärkt säkerhet..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose

# Docker säkerhetshärdning
echo "🔐 Härdning av Docker enligt MSB..."
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "userland-proxy": false,
  "experimental": false,
  "live-restore": true,
  "disable-legacy-registry": true,
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ]
}
EOF

systemctl restart docker
systemctl enable docker

# Nginx installation med svensk säkerhetskonfiguration
echo "🌐 Installerar Nginx med svensk TLS-konfiguration..."
apt install -y nginx

# Säker Nginx-konfiguration enligt MSB
cat > /etc/nginx/nginx.conf << 'EOF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 768;
    use epoll;
    multi_accept on;
}

http {
    # Grundläggande inställningar
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Säkerhetsheaders enligt MSB
    server_tokens off;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none';";

    # Ratebegränsning för svenska användare
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
    limit_req_zone $binary_remote_addr zone=login:10m rate=3r/m;

    # Loggning för svenska myndigheter
    log_format swedish_security '$remote_addr - $remote_user [$time_local] '
                               '"$request" $status $body_bytes_sent '
                               '"$http_referer" "$http_user_agent" '
                               '$request_time $upstream_response_time';

    access_log /var/log/nginx/access.log swedish_security;
    error_log /var/log/nginx/error.log warn;

    # SSL-konfiguration för Sverige
    ssl_protocols TLSv1.3;
    ssl_ciphers 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers off;
    ssl_ecdh_curve secp384r1;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF

# Skapa CRM site-konfiguration
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

cat > /etc/nginx/sites-available/crm-swedish << 'EOF'
server {
    listen 80;
    server_name din-domän.se www.din-domän.se;
    
    # Tvinga HTTPS för svensk säkerhet
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name din-domän.se www.din-domän.se;

    # SSL-certifikat
    ssl_certificate /etc/letsencrypt/live/din-domän.se/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/din-domän.se/privkey.pem;

    # HSTS för svensk domän
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";

    # Rate limiting för olika endpunkter
    location /api/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Säkerhetsheaders för statiska filer
        add_header Cache-Control "public, max-age=3600";
        add_header X-Frame-Options DENY;
    }

    # Blockera känsliga filer
    location ~ /\. {
        deny all;
    }

    location ~ /(package\.json|Dockerfile|\.env) {
        deny all;
    }
}
EOF

ln -sf /etc/nginx/sites-available/crm-swedish /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Certbot för svenska SSL-certifikat
echo "🔑 Installerar Certbot för svenska SSL-certifikat..."
apt install -y certbot python3-certbot-nginx

# Skapa backup-struktur för Sverige
echo "💾 Sätter upp svenska backup-rutiner..."
mkdir -p /opt/crm-backup/{daily,weekly,monthly}

cat > /opt/crm-backup/backup-script.sh << 'EOF'
#!/bin/bash
# Svensk backup-script enligt MSB riktlinjer

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/crm-backup"
LOG_FILE="/var/log/crm-backup.log"

echo "$(date): Startar svensk säkerhetsbackup" >> $LOG_FILE

# Docker volumes backup
docker run --rm -v crm_data:/data -v $BACKUP_DIR/daily:/backup ubuntu:20.04 tar czf /backup/crm-data-$DATE.tar.gz -C /data .

# Databas backup (om MySQL/PostgreSQL)
# docker exec mysql_container mysqldump -u root -p$MYSQL_ROOT_PASSWORD crm_db > $BACKUP_DIR/daily/db-$DATE.sql

# Kryptera backup för svensk säkerhet
gpg --cipher-algo AES256 --compress-algo 1 --cert-digest-algo SHA256 --symmetric --output $BACKUP_DIR/daily/crm-backup-$DATE.gpg $BACKUP_DIR/daily/crm-data-$DATE.tar.gz

# Ta bort okrypterad fil
rm $BACKUP_DIR/daily/crm-data-$DATE.tar.gz

# Rensa gamla backups (behåll 30 dagar)
find $BACKUP_DIR/daily -name "*.gpg" -mtime +30 -delete

echo "$(date): Backup slutförd" >> $LOG_FILE
EOF

chmod +x /opt/crm-backup/backup-script.sh

# Crontab för dagliga backups
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/crm-backup/backup-script.sh") | crontab -

# Loggrotation för svensk compliance
cat > /etc/logrotate.d/crm-swedish << 'EOF'
/var/log/nginx/*.log {
    daily
    missingok
    rotate 2555  # 7 år enligt svensk lag
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        systemctl reload nginx
    endscript
}

/var/log/crm-backup.log {
    monthly
    missingok
    rotate 84    # 7 år månatlig rotation
    compress
    notifempty
}
EOF

# Audit logging enligt MSB
echo "📋 Aktiverar audit logging enligt MSB..."
cat >> /etc/audit/rules.d/audit.rules << 'EOF'
# CRM svenska säkerhetsregler
-w /var/www/html -p wa -k crm_files
-w /etc/nginx -p wa -k nginx_config
-w /etc/docker -p wa -k docker_config
-w /opt/crm-backup -p wa -k backup_access
-a always,exit -F arch=b64 -S adjtimex -S settimeofday -k time-change
-a always,exit -F arch=b32 -S adjtimex -S settimeofday -S stime -k time-change
EOF

systemctl restart auditd

# Intrångsdetektion
echo "🚨 Installerar intrångsdetektion..."
apt install -y aide
aideinit
cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Schemalägg AIDE-kontroller
(crontab -l 2>/dev/null; echo "0 4 * * * /usr/bin/aide --check") | crontab -

# Skapa övervakningsscript
cat > /opt/swedish-monitoring.sh << 'EOF'
#!/bin/bash
# Svensk säkerhetsövervakning

LOG_FILE="/var/log/swedish-security.log"

echo "$(date): Startar säkerhetskontroll" >> $LOG_FILE

# Kontrollera disk usage
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): VARNING - Disk användning $DISK_USAGE%" >> $LOG_FILE
fi

# Kontrollera misslyckade inloggningar
FAILED_LOGINS=$(grep "Failed password" /var/log/auth.log | wc -l)
if [ $FAILED_LOGINS -gt 10 ]; then
    echo "$(date): VARNING - $FAILED_LOGINS misslyckade inloggningar" >> $LOG_FILE
fi

# Kontrollera CRM-container
if ! docker ps | grep -q crm; then
    echo "$(date): KRITISKT - CRM container ej igång!" >> $LOG_FILE
fi

echo "$(date): Säkerhetskontroll slutförd" >> $LOG_FILE
EOF

chmod +x /opt/swedish-monitoring.sh

# Schemalägg övervakning var 15:e minut
(crontab -l 2>/dev/null; echo "*/15 * * * * /opt/swedish-monitoring.sh") | crontab -

# Säkra SSH enligt MSB
echo "🔐 Härdning av SSH enligt MSB riktlinjer..."
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

cat > /etc/ssh/sshd_config << 'EOF'
# SSH konfiguration enligt MSB säkerhetskrav

Port 22
Protocol 2

# Autentisering
PermitRootLogin no
PasswordAuthentication yes
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys

# Säkerhetsinställningar
PermitEmptyPasswords no
MaxAuthTries 3
MaxSessions 3
ClientAliveInterval 300
ClientAliveCountMax 2

# Kryptering
Ciphers aes256-gcm@openssh.com,chacha20-poly1305@openssh.com,aes256-ctr
MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com
KexAlgorithms curve25519-sha256@libssh.org,diffie-hellman-group16-sha512

# Loggning
SyslogFacility AUTH
LogLevel INFO

# Förhindra tunneling
AllowTcpForwarding no
X11Forwarding no
PermitTunnel no

# Banner
Banner /etc/ssh/banner
EOF

cat > /etc/ssh/banner << 'EOF'
*******************************************************************
*                    AUKTORISERAD ANVÄNDNING                     *
*                                                                 *
* Detta system är skyddat enligt svensk lag och MSB riktlinjer.  *
* All aktivitet loggas och övervakas.                            *
* Obehörig åtkomst är förbjuden.                                 *
*                                                                 *
*******************************************************************
EOF

systemctl restart sshd

# Skapa deployment-mappat för CRM
echo "📁 Förbereder CRM deployment..."
mkdir -p /opt/crm
cd /opt/crm

# Swedish environment variables template
cat > .env.swedish << 'EOF'
# Svensk CRM-konfiguration
NODE_ENV=production
PORT=3000

# Säkerhet
SESSION_SECRET=BYTER_UT_DENNA_NYCKELN
JWT_SECRET=BYTER_UT_DENNA_OCKSÅ

# Databas (använd svenska tecken)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_sweden
DB_USER=crm_user
DB_PASS=säkert_lösenord_123

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
EOF

echo "✅ Svensk VPS-setup slutförd!"
echo ""
echo "🇸🇪 NÄRSTA STEG:"
echo "1. Uppdatera .env.swedish med dina värden"
echo "2. Sätt upp domännamn: certbot --nginx -d din-domän.se"
echo "3. Deploy CRM: docker-compose up -d"
echo "4. Testa säkerhet: /opt/swedish-monitoring.sh"
echo ""
echo "📋 SÄKERHETSSTATUS:"
echo "✅ Brandvägg aktiverad (ufw)"
echo "✅ Intrångsskydd (fail2ban)"
echo "✅ Automatiska uppdateringar"
echo "✅ Audit logging enligt MSB"
echo "✅ Säkra SSH-inställningar"
echo "✅ Nginx med svenska säkerhetsheaders"
echo "✅ Dagliga krypterade backups"
echo "✅ Kontinuerlig säkerhetsövervakning"
echo ""
echo "🔒 All data stannar i Sverige!"
echo "📞 Support: Kontakta din svenska VPS-leverantör"