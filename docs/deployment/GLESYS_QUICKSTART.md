# GleSYS CRM - Snabbstart Guide
# Komplett guide för att komma igång med GleSYS hosting

## 🚀 **SNABBSTART - GÅ LIVE PÅ 30 MINUTER**

### **Steg 1: Registrera GleSYS (5 min)**
1. Gå till **https://glesys.se/**
2. Klicka "**Beställ VPS**"
3. Välj:
   - **Datacenter**: Stockholm
   - **CPU**: 2 vCPU
   - **RAM**: 4GB
   - **Disk**: 50GB SSD
   - **OS**: Ubuntu 22.04 LTS
4. Lägg till:
   - ✅ **Backup 20GB** (+25 SEK/månad)
   - ✅ **Domän .se** (+99 SEK/år)
5. **Totalkostnad**: 162 SEK/månad

### **Steg 2: SSH-nycklar (5 min)**
```powershell
# Generera SSH-nyckel i PowerShell
ssh-keygen -t ed25519 -C "admin@ditt-företag.se"

# Kopiera publik nyckel
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | Set-Clipboard
```

**Lägg till i GleSYS:**
1. Logga in på **customer.glesys.com**
2. Gå till "**SSH-nycklar**"
3. Klistra in din publika nyckel

### **Steg 3: Deploy CRM (15 min)**
```powershell
# Kör detta från din Windows-dator:
.\deploy-glesys.ps1 -ServerIP "DIN_VPS_IP" -Domain "ditt-crm.se"
```

**Det här händer automatiskt:**
- ✅ Kopierar alla CRM-filer
- ✅ Installerar Docker
- ✅ Konfigurerar säkerhet
- ✅ Installerar SSL-certifikat
- ✅ Startar CRM-applikationen
- ✅ Konfigurerar backup

### **Steg 4: Testa (5 min)**
1. Besök **https://ditt-crm.se**
2. Verifiera att CRM laddar
3. Logga in och testa funktioner

**🎉 KLART! Din CRM körs nu på GleSYS!**

---

## 💰 **KOSTNADSJÄMFÖRELSE**

| Tjänst | Azure | GleSYS | Besparing |
|--------|-------|--------|-----------|
| **Månad** | €58 | €14.50 | €43.50 |
| **År** | €696 | €174 | **€522** |
| **5 år** | €3,892 | €870 | **€3,022** |

**GleSYS är 75% billigare än Azure!**

---

## 🏢 **VARFÖR GLESYS?**

### **🇸🇪 Helt svenskt:**
- ✅ Datacenter i Stockholm
- ✅ Svensk personal och support
- ✅ Data lämnar aldrig Sverige
- ✅ GDPR by design

### **🔒 Säkerhet i världsklass:**
- ✅ ISO 27001 certifierat
- ✅ DDoS-skydd inkluderat
- ✅ 24/7 övervakning
- ✅ Fysisk säkerhet Tier 3+

### **🌱 Miljövänligt:**
- ✅ 100% förnybar energi
- ✅ PUE 1.3 (energieffektivt)
- ✅ Koldioxidneutral drift
- ✅ Havsvatten-kylning

### **💪 Prestanda:**
- ✅ SSD-lagring standard
- ✅ 1 Gbit/s nätverk
- ✅ Låg latens inom Sverige
- ✅ 99.9% uptime-garanti

---

## 🔧 **GLESYS KUNDPANEL**

### **Inloggning:**
```
URL: https://customer.glesys.com/
Användarnamn: Din email
Lösenord: Som du satte vid registrering
```

### **Viktiga funktioner:**
- 📊 **Övervakning**: CPU, RAM, disk, nätverk
- 💾 **Backup**: Hantera automatiska backups
- 🔒 **SSH-nycklar**: Lägg till/ta bort nycklar
- 🌐 **DNS**: Hantera domäner och DNS-poster
- 💳 **Fakturering**: Se kostnader och betala

---

## 📞 **GLESYS SUPPORT**

### **Kontaktinfo:**
```
Telefon: +46 31 19 00 60
Email: support@glesys.se
Live chat: Via kundpanelen
Öppettider: 24/7
Språk: Svenska/Engelska
```

### **Support-nivåer:**
- 🆓 **Basic**: Inkluderat i alla paket
- 💼 **Priority**: Snabbare svar
- 🏢 **Enterprise**: Dedikerad kontakt

---

## 🛠️ **HANTERING AV CRM**

### **SSH-åtkomst:**
```powershell
# Logga in på din VPS
ssh crmadmin@DIN_VPS_IP
```

### **Starta/stoppa CRM:**
```bash
# Gå till CRM-katalogen
cd /opt/crm

# Se status
docker-compose -f docker-compose.glesys.yml ps

# Starta
docker-compose -f docker-compose.glesys.yml up -d

# Stoppa
docker-compose -f docker-compose.glesys.yml down

# Restart
docker-compose -f docker-compose.glesys.yml restart
```

### **Se loggar:**
```bash
# Alla loggar
docker-compose -f docker-compose.glesys.yml logs

# Endast app-loggar
docker-compose -f docker-compose.glesys.yml logs crm-app

# Live loggar
docker-compose -f docker-compose.glesys.yml logs -f
```

### **Backup:**
```bash
# Manuell backup
/opt/crm-backup-glesys.sh

# Se backup-filer
ls -la /opt/crm-backup/

# Återställ från backup
# (följ GleSYS backup-guide)
```

---

## 🔍 **ÖVERVAKNING**

### **GleSYS Monitoring:**
1. Logga in på **customer.glesys.com**
2. Gå till "**Servrar**"
3. Klicka på din VPS
4. Se **Graphs** för:
   - CPU-användning
   - RAM-användning
   - Disk I/O
   - Nätverkstrafik

### **CRM Health Check:**
```bash
# Kontrollera CRM hälsa
curl http://localhost:3000/api/health

# Eller via webben
curl https://ditt-crm.se/api/health
```

### **Disk-användning:**
```bash
# Se diskutrymme
df -h

# Se största filer
du -sh /opt/* | sort -hr
```

---

## 🚨 **FELSÖKNING**

### **CRM startar inte:**
```bash
# Kolla loggar
docker-compose -f docker-compose.glesys.yml logs

# Kolla om portarna är upptagna
sudo netstat -tulpn | grep :3000

# Restart all containers
docker-compose -f docker-compose.glesys.yml down
docker-compose -f docker-compose.glesys.yml up -d
```

### **SSL-problem:**
```bash
# Förnya SSL-certifikat
sudo certbot renew

# Testa SSL-konfiguration
sudo nginx -t
sudo systemctl reload nginx
```

### **Prestanda-problem:**
```bash
# Kolla resursanvändning
htop

# Kolla Docker-stats
docker stats

# Optimera databas
docker-compose -f docker-compose.glesys.yml exec crm-database psql -U crm_user -d crm_glesys -c "VACUUM ANALYZE;"
```

---

## 📈 **SKALNING**

### **Uppgradera VPS:**
1. Logga in på **customer.glesys.com**
2. Gå till din VPS
3. Klicka "**Upgrade**"
4. Välj större paket
5. Restart VPS

### **Rekommenderade uppgraderingar:**
```
Vid 10+ samtidiga användare:
- CPU: 4 vCPU
- RAM: 8GB
- Kostnad: +50 SEK/månad

Vid 50+ samtidiga användare:
- CPU: 6 vCPU  
- RAM: 16GB
- Kostnad: +150 SEK/månad
```

### **Load Balancer:**
```
För hög tillgänglighet:
- 2x VPS med load balancer
- GleSYS Load Balancer: +79 SEK/månad
- Total redundans
```

---

## 🔐 **SÄKERHET**

### **Grundläggande säkerhet (inkluderat):**
- ✅ Brandvägg (UFW)
- ✅ Fail2Ban mot brute force
- ✅ SSL/TLS-kryptering
- ✅ Automatiska säkerhetsuppdateringar
- ✅ Docker säkerhetshärdning

### **Extra säkerhet (tillval):**
```
GleSYS Security Plus: +99 SEK/månad
- Advanced DDoS-skydd
- Intrusion detection
- Security scanning
- Managed firewall
```

### **Best practices:**
```bash
# Ändra SSH-port
sudo sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Aktivera Google Authenticator
sudo apt install libpam-google-authenticator
google-authenticator

# Regelbundna säkerhetsupdateringar
sudo apt update && sudo apt upgrade -y
```

---

## 📋 **CHECKLISTA VID PROBLEM**

### **🔧 Tekniska problem:**
- [ ] Kolla GleSYS status: **status.glesys.com**
- [ ] Testa SSH-anslutning
- [ ] Kolla Docker containers: `docker ps`
- [ ] Kolla Nginx: `sudo nginx -t`
- [ ] Kolla diskutrymme: `df -h`
- [ ] Kolla loggar: `docker-compose logs`

### **📞 Kontakta support om:**
- [ ] VPS svarar inte
- [ ] Nätverksproblem
- [ ] Prestanda-problem
- [ ] Backup-problem
- [ ] Säkerhetsproblem

---

## 🎯 **SUCCESS METRICS**

### **Efter framgångsrik deployment:**
- ✅ CRM tillgängligt på **https://ditt-crm.se**
- ✅ SSL-certifikat grönt i webbläsaren
- ✅ Alla funktioner fungerar
- ✅ Backup körs dagligen
- ✅ Övervakning aktiv i GleSYS panel
- ✅ €522/år besparing vs Azure

### **Performance targets:**
- 🎯 Laddningstid: < 2 sekunder
- 🎯 Uptime: > 99.9%
- 🎯 Response time: < 500ms
- 🎯 Backup: 100% framgångsrikt

---

## 🇸🇪 **GRATULATIONER!**

**Du har nu en professionell CRM-lösning som:**
- 💰 Sparar **€522/år** jämfört med Azure
- 🔒 Följer **svensk säkerhetsstandard**
- 🌱 Är **miljövänlig** och hållbar
- 📞 Har **24/7 svensk support**
- 🚀 Kan **skalas** när verksamheten växer

**Din CRM på GleSYS är redo för produktion! 🎉**