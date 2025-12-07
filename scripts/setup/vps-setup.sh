#!/bin/bash

# Quick setup script för CRM på VPS
# Kör detta script på din VPS efter grundinstallation

set -e

echo "🚀 CRM VPS Quick Setup Starting..."

# Färger för output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funktion för att logga
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Kontrollera att vi kör som rätt användare
if [ "$EUID" -eq 0 ]; then
    error "Kör inte detta script som root! Använd en vanlig användare med sudo."
fi

# Kontrollera att vi har sudo
if ! sudo -n true 2>/dev/null; then
    error "Du behöver sudo-rättigheter för detta script."
fi

log "Kontrollerar systemkrav..."

# Kontrollera Ubuntu version
if ! grep -q "Ubuntu 22.04\|Ubuntu 20.04" /etc/os-release; then
    warn "Detta script är testat på Ubuntu 22.04/20.04. Din version kanske inte fungerar."
fi

# 1. Systemuppdatering
log "Uppdaterar systemet..."
sudo apt update && sudo apt upgrade -y

# 2. Installera dependencies
log "Installerar Docker och dependencies..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    log "Docker installerat"
else
    log "Docker redan installerat"
fi

if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    log "Docker Compose installerat"
else
    log "Docker Compose redan installerat"
fi

# 3. Installera Nginx och Certbot
log "Installerar Nginx och Certbot..."
sudo apt install -y nginx certbot python3-certbot-nginx git curl

# 4. Brandväggsinställningar
log "Konfigurerar brandvägg..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# 5. Skapa CRM-directory
log "Skapar CRM-directories..."
mkdir -p ~/crm/{backups,logs}
mkdir -p ~/crm-data

# 6. Fråga efter domännamn
echo
read -p "Ange ditt domännamn (t.ex. crm.dittföretag.se): " DOMAIN
if [ -z "$DOMAIN" ]; then
    error "Domännamn måste anges!"
fi

# 7. Generera säker session secret
log "Genererar säkra nycklar..."
SESSION_SECRET=$(openssl rand -hex 32)

# 8. Skapa .env fil
log "Skapar .env konfiguration..."
cat > ~/crm/.env << EOF
# Säkerhet
ADMIN_PASSWORD=CRMAdmin123!
NODE_ENV=production
SESSION_SECRET=$SESSION_SECRET

# Server
PORT=3000
DATA_DIR=/app/data

# Backup
BACKUP_RETENTION_DAYS=30

# Domain för denna installation
DOMAIN=$DOMAIN
EOF

echo
warn "VIKTIGT: Ditt admin-lösenord är: CRMAdmin123!"
warn "Ändra detta direkt efter första inloggning!"
echo

# 9. Skapa Nginx-konfiguration
log "Konfigurerar Nginx för $DOMAIN..."
sudo tee /etc/nginx/sites-available/crm > /dev/null << EOF
# Rate limiting
limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;

server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Rate limit login attempts
    location /api/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://127.0.0.1:3000/api/health;
    }
}
EOF

# Aktivera site
sudo ln -sf /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

log "Nginx konfigurerat för $DOMAIN"

# 10. Skapa backup script
log "Skapar backup-script..."
cat > ~/crm/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/$USER/crm/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/crm_backup_$DATE.tar.gz"

mkdir -p "$BACKUP_DIR"

# Backup från Docker volume
cd ~/crm
docker run --rm \
    -v crm_crm_data:/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine:latest \
    tar czf "/backup/crm_backup_$DATE.tar.gz" -C /data .

# Ta bort gamla backups (behåll 30 dagar)
find "$BACKUP_DIR" -name "crm_backup_*.tar.gz" -mtime +30 -delete

echo "$(date): Backup created: $BACKUP_FILE" >> ~/crm/logs/backup.log
EOF

chmod +x ~/crm/backup.sh

# 11. Schemalägg backup
log "Schemaläggning av automatiska backups..."
(crontab -l 2>/dev/null; echo "0 2 * * * /home/$USER/crm/backup.sh") | crontab -

# 12. Skapa systemd service (valfritt)
log "Skapar systemd service..."
sudo tee /etc/systemd/system/crm-backup.service > /dev/null << EOF
[Unit]
Description=CRM Daily Backup
After=network.target

[Service]
Type=oneshot
User=$USER
ExecStart=/home/$USER/crm/backup.sh
EOF

sudo tee /etc/systemd/system/crm-backup.timer > /dev/null << EOF
[Unit]
Description=Run CRM backup daily
Requires=crm-backup.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl enable crm-backup.timer
sudo systemctl start crm-backup.timer

log "✅ VPS setup klar!"
echo
echo "NÄSTA STEG:"
echo "1. Ladda upp din CRM-kod till ~/crm/"
echo "2. Kör: cd ~/crm && docker-compose -f docker-compose.production.yml up -d"
echo "3. Få SSL: sudo certbot --nginx -d $DOMAIN"
echo "4. Testa: https://$DOMAIN"
echo
echo "SÄKERHETSINFO:"
echo "- Admin-lösenord: CRMAdmin123! (ÄNDRA DETTA!)"
echo "- Backup körs dagligen kl 02:00"
echo "- Backups sparas i: ~/crm/backups/"
echo
echo "LOGGAR:"
echo "- CRM: docker logs crm-app"
echo "- Nginx: sudo tail -f /var/log/nginx/error.log"
echo "- Backup: tail -f ~/crm/logs/backup.log"

if [ "$USER" != "crm" ]; then
    echo
    warn "Du behöver logga ut och in igen för Docker-rättigheter:"
    echo "  exit"
    echo "  ssh $USER@$(hostname -I | awk '{print $1}')"
fi