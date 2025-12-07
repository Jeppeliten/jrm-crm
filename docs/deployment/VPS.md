# VPS Setup Guide - Komplett installation

## Steg 1: Skaffa VPS och domän

### A. VPS-leverantörer (välj en):

**Hetzner Cloud (rekommenderat för Sverige):**
- Gå till: https://www.hetzner.com/cloud
- Välj: CX11 (1 vCPU, 2GB RAM) €3.29/månad
- Datacenter: Falkenberg (Sverige) eller Nürnberg (Tyskland)
- OS: Ubuntu 22.04 LTS

**DigitalOcean:**
- Gå till: https://www.digitalocean.com
- Välj: Basic Droplet $6/månad (1 vCPU, 1GB RAM)
- Region: Amsterdam 3 (närmast Sverige)
- OS: Ubuntu 22.04 LTS

**Linode:**
- Gå till: https://www.linode.com
- Välj: Nanode 1GB $5/månad
- Region: Stockholm (Sverige)
- OS: Ubuntu 22.04 LTS

### B. Domännamn:
- **Loopia** (svensk): ~€15/år för .se domän
- **Namecheap**: ~€10/år för .com domän
- **Cloudflare**: Registrering + gratis CDN/DDoS-skydd

---

## Steg 2: Initial server-setup

### A. Anslut via SSH:
```bash
# Från Windows (PowerShell):
ssh root@DIN_SERVER_IP

# Från Mac/Linux:
ssh root@YOUR_SERVER_IP
```

### B. Grundläggande säkerhet:
```bash
# Uppdatera systemet
apt update && apt upgrade -y

# Skapa användare istället för root
adduser crm
usermod -aG sudo crm

# Kopiera SSH-nycklar
rsync --archive --chown=crm:crm ~/.ssh /home/crm

# Säkerhetsinställningar
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Byt till ny användare
su - crm
```

---

## Steg 3: Installera Docker och dependencies

```bash
# Docker installation
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Nginx och Certbot för SSL
sudo apt install -y nginx certbot python3-certbot-nginx git

# Logga ut och in igen för Docker-permissions
exit
ssh crm@DIN_SERVER_IP
```

---

## Steg 4: Ladda upp din CRM-kod

### Option A: Git (rekommenderat)
```bash
# Om du har GitHub/GitLab repo:
git clone https://github.com/DITT_ANVÄNDARNAMN/DITT_REPO.git crm
cd crm
```

### Option B: SCP upload från din dator
```bash
# Från din Windows-dator (PowerShell):
scp -r C:\dev\jrm crm@DIN_SERVER_IP:~/crm

# Sedan på servern:
ssh crm@DIN_SERVER_IP
cd crm
```

---

## Steg 5: Konfigurera miljövariabler

```bash
# Skapa .env fil
nano .env
```

Lägg till detta innehåll:
```env
# Säkerhet
ADMIN_PASSWORD=DittStarkaLösenord123!
NODE_ENV=production
SESSION_SECRET=slumpmässig_sträng_här_minst_32_tecken

# Server
PORT=3000
DATA_DIR=/app/data

# Backup
BACKUP_RETENTION_DAYS=30
```

Generera säker session secret:
```bash
# Generera säker session secret
openssl rand -hex 32 >> .env.temp
echo "SESSION_SECRET=$(cat .env.temp)" >> .env
rm .env.temp
```

---

## Steg 6: Nginx-konfiguration

```bash
# Skapa Nginx config
sudo nano /etc/nginx/sites-available/crm
```

Innehåll (byt ut DIN_DOMÄN.se):
```nginx
server {
    listen 80;
    server_name DIN_DOMÄN.se www.DIN_DOMÄN.se;
    
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
    
    # Rate limiting för login
    location /api/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Rate limiting setup
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
```

Aktivera site:
```bash
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Steg 7: Starta CRM-applikationen

```bash
# Bygg och starta med Docker
docker-compose -f docker-compose.production.yml up -d

# Kontrollera att det fungerar
docker logs crm-app
curl -I http://localhost:3000

# Testa från internet
curl -I http://DIN_DOMÄN.se
```

---

## Steg 8: SSL-certifikat (HTTPS)

```bash
# Få gratis SSL från Let's Encrypt
sudo certbot --nginx -d DIN_DOMÄN.se -d www.DIN_DOMÄN.se

# Testa auto-renewal
sudo certbot renew --dry-run
```

---

## Steg 9: Backup-setup

```bash
# Skapa backup-script
sudo nano /home/crm/backup.sh
```

Innehåll:
```bash
#!/bin/bash
BACKUP_DIR="/home/crm/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/crm_backup_$DATE.tar.gz"

mkdir -p "$BACKUP_DIR"

# Backup av Docker volumes
docker run --rm -v crm_crm_data:/data -v "$BACKUP_DIR":/backup alpine tar czf "/backup/crm_backup_$DATE.tar.gz" -C /data .

# Ta bort gamla backups (behåll 30 dagar)
find "$BACKUP_DIR" -name "crm_backup_*.tar.gz" -mtime +30 -delete

echo "$(date): Backup created: $BACKUP_FILE" >> /home/crm/backup.log
```

Gör körbar och schemalägg:
```bash
chmod +x /home/crm/backup.sh
crontab -e

# Lägg till denna rad för daglig backup kl 02:00:
0 2 * * * /home/crm/backup.sh
```

---

## Steg 10: Testa och verifiera

```bash
# Kontrollera tjänster
docker ps
sudo systemctl status nginx

# Testa HTTPS
curl -I https://DIN_DOMÄN.se

# Testa inloggning
curl -X POST https://DIN_DOMÄN.se/api/login \
  -H "Content-Type: application/json" \
  -d '{"password":"DittStarkaLösenord123!"}'
```

---

## Steg 11: Monitoring (valfritt men rekommenderat)

```bash
# Uptime monitoring med systemd
sudo nano /etc/systemd/system/crm-monitor.service
```

```ini
[Unit]
Description=CRM Monitor
After=network.target

[Service]
Type=simple
User=crm
ExecStart=/home/crm/monitor.sh
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
```

---

## 🎉 Klart!

Din CRM körs nu säkert på:
- **HTTP**: http://DIN_DOMÄN.se (redirectar till HTTPS)
- **HTTPS**: https://DIN_DOMÄN.se

### Första inloggning:
1. Gå till https://DIN_DOMÄN.se
2. Klicka "Logga in"
3. Lösenord: `DittStarkaLösenord123!` (eller vad du satte i .env)
4. Skapa dina användare via Inställningar

### Underhåll:
- **Loggar**: `docker logs crm-app`
- **Restart**: `docker-compose -f docker-compose.production.yml restart`
- **Backups**: Finns i `/home/crm/backups/`
- **SSL renewal**: Automatisk via certbot

---

## Felsökning

### App startar inte:
```bash
docker logs crm-app
# Kolla portar
netstat -tlnp | grep :3000
```

### Nginx fel:
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### SSL-problem:
```bash
sudo certbot certificates
sudo certbot renew --force-renewal
```

---

## Säkerhet efter installation:

1. **Byt SSH-port** (valfritt): `sudo nano /etc/ssh/sshd_config`
2. **Fail2ban**: `sudo apt install fail2ban`
3. **Brandvägg**: Kontrollera `sudo ufw status`
4. **Uppdateringar**: `sudo apt update && sudo apt upgrade`

**Total kostnad**: €3-6/månad + €10-15/år för domän = **€50-87/år**

Vill du att jag hjälper dig med någon specifik del av installationen?