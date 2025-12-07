# GleSYS CRM Setup Guide
# Komplett guide för svensk CRM-hosting hos GleSYS

## 🏢 **OM GLESYS**

GleSYS är en svensk molnleverantör grundad 2008, baserad i Göteborg med datacenter i:
- **Stockholm** (Tier 3+ datacenter)
- **Falkenberg** (Miljövänligt datacenter med havsvatten-kylning)

### **Certifieringar:**
- ✅ ISO 27001 (Informationssäkerhet)
- ✅ ISO 14001 (Miljöcertifiering)
- ✅ SOC 2 Type II
- ✅ GDPR-kompatibel
- ✅ 100% förnybar energi

---

## 💰 **KOSTNADSKALKYL GLESYS**

### **Rekommenderat VPS-paket för CRM:**
```
VPS: 2 vCPU, 4GB RAM, 50GB SSD
Kostnad: 129 SEK/månad (€11.50/månad)
Plats: Stockholm datacenter
OS: Ubuntu 22.04 LTS
```

### **Totalkostnad per månad:**
```
VPS (2 CPU, 4GB, 50GB):        129 SEK
Domän (.se via GleSYS):          8 SEK (99 SEK/år)
Backup (20GB):                  25 SEK
SSL-certifikat:                  0 SEK (Let's Encrypt)
DDoS-skydd Basic:               0 SEK (inkluderat)
IPv6:                           0 SEK (inkluderat)
-------------------------------------------
TOTALT:                       162 SEK/månad
ÅRSKOSTNAD:                  1,944 SEK/år
I EURO:                        €174/år
```

### **Jämförelse:**
- **Azure**: €696/år
- **GleSYS**: €174/år
- **Besparing**: €522/år (75% billigare!)

---

## 🚀 **STEG 1: REGISTRERA HOS GLESYS**

### **1.1 Gå till GleSYS:**
```
Website: https://glesys.se/
Telefon: +46 31 19 00 60
Email: support@glesys.se
```

### **1.2 Skapa konto:**
1. Klicka "Skapa konto"
2. Fyll i företagsinformation
3. Välj faktureringsadress (Sverige)
4. Verifiera med BankID/organisationsnummer

### **1.3 Välj VPS:**
```
Produkt: Cloud VPS
Datacenter: Stockholm
OS: Ubuntu 22.04 LTS
CPU: 2 vCPU
RAM: 4GB
Lagring: 50GB SSD
Nätverk: 1000 Mbit/s
```

### **1.4 Tilläggstjänster:**
```
✅ DDoS-skydd Basic (inkluderat)
✅ IPv6 (inkluderat)
✅ Backup 20GB (+25 SEK/månad)
✅ Monitoring (inkluderat)
❌ Managed services (ej nödvändigt)
❌ Load balancer (kan läggas till senare)
```

---

## 🔑 **STEG 2: SSH-NYCKLAR**

### **2.1 Generera SSH-nyckel (Windows):**
```powershell
# Öppna PowerShell som administrator
ssh-keygen -t ed25519 -C "admin@ditt-företag.se"
# Tryck Enter för standardplats
# Ange starkt lösenord för nyckeln
```

### **2.2 Kopiera publik nyckel:**
```powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | Set-Clipboard
```

### **2.3 Lägg till i GleSYS:**
1. Logga in på GleSYS kundpanel
2. Gå till "SSH-nycklar"
3. Klicka "Lägg till nyckel"
4. Klistra in din publika nyckel
5. Namnge nyckeln (t.ex. "CRM-Admin")

---

## 🌐 **STEG 3: DOMÄN**

### **3.1 Registrera .se domän hos GleSYS:**
```
Pris: 99 SEK/år
Inkluderat: WHOIS-skydd
Support: Svensk kundsupport
```

### **3.2 DNS-konfiguration:**
```
A-record: ditt-crm.se → VPS IP-adress
A-record: www.ditt-crm.se → VPS IP-adress
MX-record: (valfritt för email)
```

---

## 🛠️ **STEG 4: VPS-SETUP**

### **4.1 Första inloggning:**
```powershell
# Hämta IP-adress från GleSYS kundpanel
ssh root@DIN_VPS_IP
```

### **4.2 Grundläggande säkerhet:**
```bash
# Uppdatera system
apt update && apt upgrade -y

# Skapa admin-användare
adduser crmadmin
usermod -aG sudo crmadmin

# Konfigurera SSH
cp -r /root/.ssh /home/crmadmin/
chown -R crmadmin:crmadmin /home/crmadmin/.ssh

# Testa nya användaren
su - crmadmin
sudo whoami  # Ska svara "root"
```

---

## 🔒 **STEG 5: SÄKERHETSHÄRDNING**

### **5.1 Brandvägg:**
```bash
# UFW (Uncomplicated Firewall)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### **5.2 Fail2Ban:**
```bash
sudo apt install fail2ban -y

# Konfigurera för SSH-skydd
sudo cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### **5.3 Automatiska uppdateringar:**
```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 🐳 **STEG 6: DOCKER-INSTALLATION**

### **6.1 Installera Docker:**
```bash
# Lägg till Docker repo
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

# Installera
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose -y

# Lägg till användare i docker-gruppen
sudo usermod -aG docker crmadmin

# Starta och aktivera
sudo systemctl enable docker
sudo systemctl start docker
```

### **6.2 Testa Docker:**
```bash
# Logga ut och in igen för grupprättigheter
exit
ssh crmadmin@DIN_VPS_IP

# Testa Docker
docker --version
docker-compose --version
docker run hello-world
```

---

## 🌐 **STEG 7: NGINX OCH SSL**

### **7.1 Installera Nginx:**
```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

### **7.2 Konfigurera för CRM:**
```bash
sudo cat > /etc/nginx/sites-available/crm << 'EOF'
server {
    listen 80;
    server_name ditt-crm.se www.ditt-crm.se;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ditt-crm.se www.ditt-crm.se;

    # SSL-certifikat (kommer att konfigureras av Certbot)
    
    # Säkerhetsheaders
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### **7.3 SSL med Let's Encrypt:**
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d ditt-crm.se -d www.ditt-crm.se
```

---

## 📦 **STEG 8: DEPLOY CRM**

### **8.1 Förbered mappar:**
```bash
sudo mkdir -p /opt/crm
sudo chown crmadmin:crmadmin /opt/crm
cd /opt/crm
```

### **8.2 Från Windows (PowerShell):**
```powershell
# Anpassa och kör deployment-scriptet
.\deploy-glesys.ps1 -ServerIP "DIN_VPS_IP" -Domain "ditt-crm.se" -SSHUser "crmadmin"
```

### **8.3 Manuell deployment (alternativ):**
```bash
# På VPS:n
cd /opt/crm

# Skapa docker-compose.yml för GleSYS
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  crm-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - TZ=Europe/Stockholm
    volumes:
      - ./data:/app/data
    restart: unless-stopped
EOF

# Starta CRM
docker-compose up -d
```

---

## 💾 **STEG 9: BACKUP-KONFIGURATION**

### **9.1 GleSYS Backup-tjänst:**
```bash
# GleSYS erbjuder automatiska backups
# Konfigurera i kundpanelen:
# - Dagliga backups
# - 30 dagars retention
# - Automatisk restore-möjlighet
```

### **9.2 Lokal backup-script:**
```bash
mkdir -p /opt/backup
cat > /opt/backup/crm-backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backup"

# Backup av CRM-data
tar czf $BACKUP_DIR/crm-$DATE.tar.gz /opt/crm/data

# Behåll endast 7 dagars backups lokalt
find $BACKUP_DIR -name "crm-*.tar.gz" -mtime +7 -delete

echo "Backup slutförd: crm-$DATE.tar.gz"
EOF

chmod +x /opt/backup/crm-backup.sh

# Schemalägg daglig backup
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/backup/crm-backup.sh") | crontab -
```

---

## 📊 **STEG 10: ÖVERVAKNING**

### **10.1 GleSYS Monitoring:**
- Aktivera i kundpanelen
- CPU, RAM, disk, nätverk
- Automatiska alerts via email/SMS

### **10.2 Application monitoring:**
```bash
# Enkel health check
cat > /opt/crm/health-check.sh << 'EOF'
#!/bin/bash
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "CRM OK"
else
    echo "CRM DOWN - Restarting..."
    cd /opt/crm && docker-compose restart
fi
EOF

chmod +x /opt/crm/health-check.sh

# Kör var 5:e minut
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/crm/health-check.sh") | crontab -
```

---

## 🎯 **GLESYS-SPECIFIKA FÖRDELAR**

### **Säkerhet:**
- ✅ DDoS-skydd inkluderat
- ✅ ISO 27001 certifierat datacenter
- ✅ Nätverkssegmentering
- ✅ 24/7 fysisk säkerhet

### **Performance:**
- ✅ SSD-lagring standard
- ✅ 1 Gbit/s nätverk
- ✅ Låg latens inom Sverige
- ✅ IPv6-support

### **Support:**
- ✅ 24/7 svensk support
- ✅ Telefon: +46 31 19 00 60
- ✅ Email: support@glesys.se
- ✅ Live chat på svenska

### **Miljö:**
- ✅ 100% förnybar energi
- ✅ PUE 1.3 (mycket energieffektivt)
- ✅ Havsvatten-kylning i Falkenberg
- ✅ Koldioxidneutral drift

---

## 📞 **SUPPORT OCH HJÄLP**

### **GleSYS Support:**
```
Telefon: +46 31 19 00 60
Email: support@glesys.se
Live chat: Via kundpanelen
Kontor: Göteborg, Sverige
Språk: Svenska/Engelska
Tillgänglighet: 24/7
```

### **Teknisk dokumentation:**
```
API-dokumentation: https://github.com/GleSYS/API
Tutorials: https://docs.glesys.com/
Status: https://status.glesys.com/
Community: https://community.glesys.com/
```

---

## ✅ **CHECKLISTA FÖRE GO-LIVE**

### **Säkerhet:**
- [ ] SSH-nycklar konfigurerade
- [ ] Brandvägg aktiverad (UFW)
- [ ] Fail2Ban installerat
- [ ] SSL-certifikat installerat
- [ ] Automatiska uppdateringar aktiverade
- [ ] Backup-rutiner testade

### **Funktionalitet:**
- [ ] CRM startar utan fel
- [ ] Databasanslutning fungerar
- [ ] Webbgränssnitt tillgängligt
- [ ] Multi-office funktionalitet testad
- [ ] Health checks fungerar

### **Övervakning:**
- [ ] GleSYS monitoring aktiverat
- [ ] Log-rotation konfigurerad
- [ ] Disk space-övervakning
- [ ] Performance-monitoring

### **Dokumentation:**
- [ ] Admin-lösenord dokumenterade
- [ ] Backup-procedurer dokumenterade
- [ ] Incident response plan
- [ ] GDPR-dokumentation uppdaterad

---

## 🎉 **FRAMGÅNGSRIK DEPLOYMENT!**

Efter att ha följt denna guide har du:
- ✅ **Säker CRM** hos GleSYS
- ✅ **€522/år besparing** vs Azure
- ✅ **100% svensk hosting**
- ✅ **GDPR-kompatibel** lösning
- ✅ **24/7 svensk support**
- ✅ **ISO 27001 säkerhet**

**Din CRM är nu live på: https://ditt-crm.se**

### **Nästa steg:**
1. Testa alla funktioner
2. Konfigurera användare
3. Importera mäklardata
4. Utbilda team

**Lycka till med din svenska CRM-lösning! 🇸🇪**