#!/bin/bash

# Production deployment script för CRM
# Kör detta på din server för att sätta upp produktionsmiljön

set -e

echo "🚀 Setting up CRM production environment..."

# 1. Skapa systemanvändare
sudo useradd -r -s /bin/false crm-app || true
sudo mkdir -p /app/{data,backups,logs,certs}
sudo chown -R crm-app:crm-app /app

# 2. Säkerhetskonfiguration
echo "🔒 Configuring security..."

# Brandvägg
sudo ufw allow ssh
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 80/tcp   # HTTP (för Let's Encrypt)
sudo ufw --force enable

# Fail2ban för brute-force skydd
sudo apt update
sudo apt install -y fail2ban nginx certbot python3-certbot-nginx

# 3. Nginx reverse proxy
sudo tee /etc/nginx/sites-available/crm > /dev/null << 'EOF'
server {
    listen 80;
    server_name ditt_domännamn.se;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ditt_domännamn.se;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/ditt_domännamn.se/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ditt_domännamn.se/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Rate limit login attempts
    location /api/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# 4. Systemd service
sudo tee /etc/systemd/system/crm.service > /dev/null << 'EOF'
[Unit]
Description=CRM Application
After=network.target

[Service]
Type=simple
User=crm-app
Group=crm-app
WorkingDirectory=/app
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=DATA_DIR=/app/data
EnvironmentFile=/app/.env

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/app/data /app/logs /app/backups

[Install]
WantedBy=multi-user.target
EOF

# 5. Backup script
sudo tee /app/backup.sh > /dev/null << 'EOF'
#!/bin/bash
BACKUP_DIR="/app/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/crm_backup_$DATE.tar.gz"

# Skapa backup
tar -czf "$BACKUP_FILE" -C /app data/

# Ta bort gamla backups (behåll 30 dagar)
find "$BACKUP_DIR" -name "crm_backup_*.tar.gz" -mtime +30 -delete

# Logga
echo "$(date): Backup created: $BACKUP_FILE" >> /app/logs/backup.log
EOF

sudo chmod +x /app/backup.sh
sudo chown crm-app:crm-app /app/backup.sh

# 6. Cron för automatiska backups
echo "0 2 * * * /app/backup.sh" | sudo crontab -u crm-app -

echo "✅ Production setup complete!"
echo ""
echo "Next steps:"
echo "1. Kopiera din CRM-kod till /app/"
echo "2. Installera Node.js dependencies: cd /app && npm install --production"
echo "3. Skapa .env fil med dina konfigurationer"
echo "4. Få SSL-certifikat: sudo certbot --nginx -d ditt_domännamn.se"
echo "5. Starta tjänsten: sudo systemctl enable crm && sudo systemctl start crm"
echo "6. Testa: curl -I https://ditt_domännamn.se"