# VPS Setup Checklista

## ✅ Pre-flight check

- [ ] **VPS skaffad**: Hetzner/DigitalOcean/Linode med Ubuntu 22.04
- [ ] **Domän registrerad**: .se/.com domän pekar till VPS IP
- [ ] **SSH-åtkomst**: Kan logga in på VPS via SSH
- [ ] **DNS propagerat**: `nslookup din-domän.se` visar VPS IP

---

## 🚀 Installation (15-30 minuter)

### Steg 1: Initial VPS setup
```bash
# SSH till VPS
ssh root@DIN_VPS_IP

# Skapa användare
adduser crm
usermod -aG sudo crm
# Kopiera SSH-nycklar till ny användare

# Logga in som crm-användare
ssh crm@DIN_VPS_IP
```

### Steg 2: Quick setup
```bash
# Ladda ner och kör setup-script
curl -L https://raw.githubusercontent.com/DITT_REPO/main/vps-setup.sh -o setup.sh
chmod +x setup.sh
./setup.sh

# ELLER manuellt (om script inte fungerar):
# Följ VPS_SETUP_GUIDE.md steg för steg
```

### Steg 3: Upload CRM-kod
```bash
# Från din Windows-dator:
cd C:\dev\jrm
.\deploy.ps1 -ServerIP DIN_VPS_IP -Username crm -Domain din-domän.se

# ELLER manuellt:
scp -r C:\dev\jrm crm@DIN_VPS_IP:~/crm
```

### Steg 4: Starta tjänsten
```bash
# På VPS:
cd ~/crm
docker-compose -f docker-compose.production.yml up -d
```

### Steg 5: SSL-certifikat
```bash
# På VPS:
sudo certbot --nginx -d din-domän.se -d www.din-domän.se
```

---

## 🧪 Testa installationen

### Grundläggande funktionalitet:
- [ ] **HTTP fungerar**: `curl -I http://din-domän.se` → 301/302 redirect
- [ ] **HTTPS fungerar**: `curl -I https://din-domän.se` → 200 OK
- [ ] **App svarar**: Kan öppna https://din-domän.se i webbläsare
- [ ] **Login fungerar**: Kan logga in med admin-lösenord
- [ ] **Data sparas**: Skapar test-företag, loggar ut/in → finns kvar

### Docker & tjänster:
- [ ] **Container körs**: `docker ps` visar `crm-app` som `Up`
- [ ] **Inga fel**: `docker logs crm-app` visar inga ERROR-meddelanden
- [ ] **Health check OK**: `curl localhost:3000/api/health` → status: ok
- [ ] **Nginx fungerar**: `sudo systemctl status nginx` → active (running)

### Säkerhet & backup:
- [ ] **Brandvägg aktiv**: `sudo ufw status` → Status: active
- [ ] **SSL-certifikat giltigt**: Webbläsare visar grön hänglås
- [ ] **Backup schemalagt**: `crontab -l` visar backup-jobb
- [ ] **Första backup klar**: `ls ~/crm/backups/` visar .tar.gz fil

---

## 🔧 Post-installation

### Första konfiguration:
1. **Byt admin-lösenord** (CRMAdmin123! → ditt eget)
2. **Skapa användare** via Inställningar → Användare
3. **Importera data** via Import-fliken
4. **Testa funktioner** (sökning, export, rapporter)

### Säkerhet:
- [ ] **Byt SSH-port** (valfritt): `/etc/ssh/sshd_config`
- [ ] **Installera fail2ban**: `sudo apt install fail2ban`
- [ ] **Konfigurera automatiska uppdateringar**
- [ ] **Dokumentera lösenord** säkert

### Övervakning:
- [ ] **Uptime monitoring**: Pingdom/UptimeRobot för https://din-domän.se
- [ ] **Logga viktiga kontakter**: IT-support, hosting-support
- [ ] **Testa backup-restore**: Återställ från backup en gång

---

## 🆘 Troubleshooting

### App startar inte:
```bash
docker logs crm-app              # Kolla app-loggar
docker-compose ps                # Status för alla containers
netstat -tlnp | grep :3000      # Kontrollera port 3000
```

### Nginx-fel:
```bash
sudo nginx -t                    # Testa konfiguration
sudo systemctl status nginx     # Service status
sudo tail -f /var/log/nginx/error.log  # Error logs
```

### SSL-problem:
```bash
sudo certbot certificates       # Lista certifikat
sudo certbot renew --dry-run   # Testa förnyelse
sudo nginx -t && sudo systemctl reload nginx  # Reload efter cert-uppdatering
```

### Performance:
```bash
htop                            # CPU/RAM-användning
df -h                           # Diskutrymme
docker stats                    # Container-statistik
```

---

## 📞 Support kontakter

- **Hosting**: [Din VPS-leverantör support]
- **Domän**: [Din domänregistrar support]  
- **IT-ansvarig**: [Din IT-person]
- **Backup**: Finns i `/home/crm/crm/backups/`

---

## 💰 Månadskostnader

- **VPS**: €3-6/månad (Hetzner CX11)
- **Domän**: €1/månad (~€15/år)
- **Total**: €4-7/månad = €48-84/år

**Jämfört med Azure**: €456/år → Spara €370+/år! 💰

---

## 🎯 Success criteria

✅ **CRM fungerar på https://din-domän.se**  
✅ **3-5 användare kan logga in samtidigt**  
✅ **Data sparas säkert**  
✅ **Automatiska backups fungerar**  
✅ **SSL-certifikat förnyas automatiskt**  
✅ **Kostar <€10/månad**

**Grattis! Din CRM är nu live! 🎉**