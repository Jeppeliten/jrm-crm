# Säker Production Setup för CRM

## 1. Miljövariabler (.env fil)

Skapa en `.env` fil i server-mappen:

```bash
# Säkerhet
ADMIN_PASSWORD=ditt_starka_admin_lösenord_här
NODE_ENV=production
SESSION_SECRET=slumpmässig_64_tecken_sträng_för_session_säkerhet

# Server
PORT=3000
DATA_DIR=/app/data

# TLS/SSL (för HTTPS)
SSL_CERT_PATH=/app/certs/cert.pem
SSL_KEY_PATH=/app/certs/key.pem

# Backup
BACKUP_DIR=/app/backups
BACKUP_RETENTION_DAYS=30

# Logging
LOG_LEVEL=info
AUDIT_RETENTION_DAYS=365
```

## 2. Användarroller och behörigheter

Systemet har redan stöd för:
- **admin**: Full åtkomst, kan hantera användare
- **sales**: Normal användare, kan redigera data
- **readonly**: Endast läsåtkomst (kan läggas till)

## 3. Hosting-alternativ

### A. VPS/Cloud Server (Rekommenderat)
- **DigitalOcean Droplet** (€10-20/månad)
- **Linode** (€10-20/månad) 
- **Hetzner Cloud** (€5-15/månad)
- **Azure/AWS** (€15-30/månad)

### B. Lokal server med VPN
- Dedikerad server/NUC hemma
- WireGuard VPN för säker åtkomst

## 4. Säkerhetsåtgärder

### Obligatoriska:
- ✅ HTTPS med giltigt SSL-certifikat
- ✅ Stark lösenordspolicy
- ✅ Session timeout (30 min)
- ✅ Audit logging
- ✅ Automatiska backups

### Rekommenderade tillägg:
- Fail2ban för brute-force skydd
- Automatiska säkerhetsuppdateringar
- Brandvägg (UFW/iptables)
- Övervakning (Uptime monitoring)

## 5. Backup-strategi

- **Dagliga automatiska backups** av state.json och auth.json
- **Veckovisa fulla backups** 
- **Offsite backup** (olika plats/molntjänst)
- **Testade återställningsrutiner**

## 6. SSL/TLS Setup

För produktionsmiljö behöver du HTTPS. Alternativ:
- **Let's Encrypt** (gratis, automatiskt förnyande)
- **Cloudflare** (gratis SSL + CDN + DDoS-skydd)
- **Reverse proxy** med Nginx/Apache

## 7. Monitoring och underhåll

- **Loggar**: Centraliserad loggning
- **Uptime**: Extern övervakning (UptimeRobot, Pingdom)
- **Performance**: CPU/RAM/disk-användning
- **Säkerhetsuppdateringar**: Automatiska OS-uppdateringar