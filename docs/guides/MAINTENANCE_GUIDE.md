# Förvaltningsplan - Minimal Maintenance Strategy

## Filosofi: "Set and Forget"

För interna system är målet att minimera förvaltningsbördan samtidigt som systemet förblir säkert och stabilt. Denna plan fokuserar på automation och proaktiv övervakning.

---

## 1. Automatisering (En gång - sedan glöm)

### 1.1 Automatiska säkerhetsuppdateringar

**För VPS/Server:**
```bash
# Ubuntu: Aktivera automatiska säkerhetsuppdateringar
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Konfigurera att endast säkerhetsuppdateringar körs automatiskt
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades
```

**För Docker:**
- Använd Watchtower för automatiska container-uppdateringar:
```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --schedule "0 0 4 * * *"  # Kör kl 04:00 varje natt
```

**För Azure App Service:**
- Inbyggt: Azure uppdaterar automatiskt plattformen
- Aktivera "Always On" för att undvika cold starts

### 1.2 Automatiska backups

✅ **Redan implementerat i systemet:**
- Produktionsmiljö: Backup var 24:e timme
- Development: Backup var 4:e timme
- Automatisk rotation (behåller senaste 30 backups)

**Extra: Offsite backup (rekommenderat)**

**Azure Blob Storage:**
```bash
# Installera azcopy
curl -L https://aka.ms/downloadazcopy-v10-linux -o azcopy.tar.gz
tar -xvf azcopy.tar.gz
sudo mv azcopy*/azcopy /usr/local/bin/

# Cron-job för daglig offsite backup
0 5 * * * azcopy copy "c:\Repos\JRM\server\backups\*" "https://storageaccount.blob.core.windows.net/backups?SAS_TOKEN" --recursive
```

**Eller enklare: Azure Backup för hela VM**
- Sätt upp en gång i Azure Portal
- Automatisk snapshot varje natt
- Retention: 30 dagar
- Kostnad: ~$5-10/månad

### 1.3 Automatisk övervakning och larm

**Option A: Azure Application Insights (rekommenderat för Azure)**

En gångs-setup i Azure Portal:
1. Skapa Application Insights-resurs
2. Lägg till instrumentation key i `.env`
3. Konfigurera alerts:
   - Server ner > 5 minuter → SMS/email
   - Fel > 10 per timme → E-post
   - Responstid > 2 sekunder → E-post
4. **Klart!** Inget mer att göra.

**Option B: UptimeRobot (gratis, enkelt)**

1. Gå till https://uptimerobot.com (gratis för 50 monitors)
2. Lägg till monitor för `https://din-domän.se/health`
3. Intervall: 5 minuter
4. Notifiering: Email/SMS vid down
5. **Klart!**

**Option C: Healthchecks.io (minimalistiskt)**

```bash
# Lägg till i crontab för att pinga varje timme
0 * * * * curl -fsS -m 10 --retry 5 https://hc-ping.com/YOUR-UUID-HERE > /dev/null
```

### 1.4 Automatisk SSL-certifikat förnyelse

**Let's Encrypt med Certbot:**
```bash
# Installera certbot
sudo apt install certbot python3-certbot-nginx

# Hämta certifikat (en gång)
sudo certbot --nginx -d crm.varderingsdata.se

# Verifiera auto-renewal
sudo certbot renew --dry-run

# Certbot förnyar automatiskt via systemd timer
# Inget mer behöver göras!
```

**Azure App Service:**
- Managed certificates förnyas automatiskt
- Noll arbete

---

## 2. Minimal Recurring Maintenance

### 2.1 Månatliga uppgifter (15 minuter/månad)

**Dag 1 varje månad:**

1. **Kontrollera säkerhetsuppdateringar för npm-paket** (5 min)
   ```bash
   cd /path/to/server
   npm audit
   
   # Om critical/high vulnerabilities:
   npm audit fix
   
   # Om breaking changes krävs:
   npm outdated  # Se vilka paket
   # Uppdatera manuellt och testa
   ```

2. **Granska loggar** (5 min)
   ```bash
   # Kolla efter ovanliga mönster
   tail -100 audit.log | grep -i "error\|failed\|unauthorized"
   tail -100 security.log | grep -i "blocked\|threat\|suspicious"
   ```

3. **Kontrollera diskutrymme** (2 min)
   ```bash
   df -h
   
   # Om backups tar för mycket plats:
   cd backups
   ls -lt | tail -20  # Ta bort gamla backups manuellt om behövs
   ```

4. **Verifiera monitoring** (3 min)
   - Logga in på UptimeRobot/Azure Insights
   - Kolla att inga larm missats
   - Kolla uptime (bör vara >99.5%)

### 2.2 Kvartalsvis (30 minuter/kvartal)

**Varje Q1, Q2, Q3, Q4:**

1. **Större säkerhetsuppdateringar** (15 min)
   ```bash
   # Uppdatera alla dependencies
   npm update
   npm audit fix --force  # Om nödvändigt
   
   # Testa systemet
   npm start
   # Logga in, kolla att allt fungerar
   ```

2. **Granska användaråtkomst** (10 min)
   - Finns inaktiva användare? Ta bort
   - Behöver någon admin-behörighet? Lägg till/ta bort
   - Uppdatera lösenord om nödvändigt

3. **Backup-test** (5 min)
   ```bash
   # Testa att återställa en backup
   cp state.json state.json.backup
   cp backups/backup_latest_*/state.json ./
   # Starta om server och verifiera
   # Återställ original
   ```

### 2.3 Årligt (2 timmar/år)

**En gång per år:**

1. **Säkerhetsgranskning** (1 timme)
   - Kör `npm audit`
   - Uppdatera Node.js till senaste LTS
   - Granska säkerhetsinställningar (CORS, rate limits)
   - Kontrollera att HTTPS och certifikat fungerar
   
2. **Prestandagranskning** (30 min)
   - Kolla server metrics (CPU, RAM)
   - Granska responstider
   - Optimera om nödvändigt

3. **Dokumentationsuppdatering** (30 min)
   - Uppdatera README om något ändrats
   - Dokumentera nya features
   - Uppdatera användarguide

---

## 3. "Zero Touch" Setup (Rekommenderad minimal förvaltning)

### Setup en gång - glöm sedan:

```bash
# 1. Automatiska OS-uppdateringar
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades

# 2. Automatisk SSL-förnyelse (redan aktivt med certbot)
# Inget att göra

# 3. Automatisk monitoring med UptimeRobot
# Sätt upp på https://uptimerobot.com (5 min)

# 4. Automatiska backups till Azure Blob
# Sätt upp cron-job (se ovan)

# 5. Automatisk logrotation
sudo nano /etc/logrotate.d/crm-app
```

Lägg till:
```
/path/to/server/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
}
```

**Resultat: Systemet kör sig självt**

---

## 4. Incident Response (När något går fel)

### 4.1 Systemet är nere

**Snabb diagnos (2 minuter):**
```bash
# 1. Är servern igång?
systemctl status pm2-<user>  # Om PM2
docker ps  # Om Docker

# 2. Är processen igång?
pm2 status  # PM2
docker logs crm  # Docker

# 3. Kolla loggar
tail -50 /path/to/server/*.log
```

**Fix (5 minuter):**
```bash
# Restart
pm2 restart crm-server  # PM2
docker restart crm  # Docker
sudo systemctl restart <app-name>  # Azure/Systemd
```

**Om det inte hjälper:**
```bash
# Återställ från backup
cd /path/to/server
cp state.json state.json.broken
cp backups/backup_latest_*/state.json ./
pm2 restart crm-server
```

### 4.2 Långsam prestanda

```bash
# Kolla server-resurser
htop
df -h

# Kolla Node.js-process
pm2 monit

# Öka resurser om behövs (Azure/VPS)
# Eller optimera kod
```

### 4.3 Säkerhetshot

```bash
# Kolla security.log
tail -100 security.log

# Blockera IP manuellt om behövs
# (WAF gör detta automatiskt)

# Granska audit.log för ovanlig aktivitet
grep "unauthorized\|failed" audit.log
```

---

## 5. Kostnadsuppskattning

### Tid per år (Minimal förvaltning)

| Aktivitet | Frekvens | Tid | Total/år |
|-----------|----------|-----|----------|
| Månatlig kontroll | 12x/år | 15 min | 3 timmar |
| Kvartalsvis granskning | 4x/år | 30 min | 2 timmar |
| Årlig översyn | 1x/år | 2 timmar | 2 timmar |
| **Total förvaltning** | | | **7 timmar/år** |
| Incidenter (uppskattning) | 2x/år | 30 min | 1 timme |
| **TOTAL** | | | **~8 timmar/år** |

**= Mindre än 1 timme per månad i genomsnitt**

### Kostnad (hosting)

| Plattform | Månadskostnad | Årskostnad |
|-----------|---------------|------------|
| Azure App Service (Basic) | $55 | $660 |
| VPS (2GB RAM) | $10-20 | $120-240 |
| Docker på egen server | $0 (om server finns) | $0 |

**Rekommendation: VPS för lägsta kostnad + minimal förvaltning**

---

## 6. Best Practices för Minimal Maintenance

### ✅ DO (Gör)

1. **Automatisera allt som går**
   - Backups
   - Säkerhetsuppdateringar
   - Monitoring
   - SSL-förnyelse

2. **Använd managed services när möjligt**
   - Azure App Service (managed platform)
   - Azure Blob Storage (managed backups)
   - Application Insights (managed monitoring)

3. **Håll det enkelt**
   - Filbaserad databas (state.json) är OK för interna system
   - Inga komplexa dependencies
   - Standard Node.js utan extras

4. **Sätt upp alerts proaktivt**
   - Server down → SMS/email
   - Disk nästan full → Email
   - Kritiska fel → Email

5. **Dokumentera kritiska processer**
   - Hur återställer man från backup?
   - Hur startar man om systemet?
   - Vem kontaktar man vid problem?

### ❌ DON'T (Undvik)

1. **Manuella processer**
   - Manuella backups
   - Manuell SSL-förnyelse
   - Manuell övervakning

2. **Överkomplex infrastruktur**
   - Kubernetes för ett internt verktyg (overkill)
   - Microservices (onödigt komplext)
   - Många externa dependencies

3. **Glömma monitoring**
   - Systemet kan vara nere utan att ni vet om det
   - Sätt upp UptimeRobot (5 min, gratis)

4. **Ignorera säkerhetsuppdateringar**
   - Kör `npm audit` minst månatligen
   - Aktivera automatiska OS-uppdateringar

---

## 7. Emergency Contact Card

**Skriv ut och sätt på väggen:**

```
┌─────────────────────────────────────────┐
│     CRM SYSTEM - EMERGENCY GUIDE        │
├─────────────────────────────────────────┤
│ URL: https://crm.varderingsdata.se      │
│ Health check: /health                   │
│                                         │
│ Server: [IP/hostname]                   │
│ Login: SSH user@server                  │
│                                         │
│ RESTART APP:                            │
│   pm2 restart crm-server                │
│   (or) docker restart crm               │
│                                         │
│ VIEW LOGS:                              │
│   pm2 logs                              │
│   tail -f /path/to/server/*.log         │
│                                         │
│ RESTORE BACKUP:                         │
│   cd /path/to/server                    │
│   cp backups/backup_latest_*/state.json │
│   pm2 restart crm-server                │
│                                         │
│ SUPPORT:                                │
│   IT-ansvarig: [Namn] [Tel]             │
│   Leverantör: [Om extern]               │
└─────────────────────────────────────────┘
```

---

## 8. Sammanfattning: Minimal Maintenance Checklist

### Initial Setup (En gång)
- [ ] Aktivera automatiska säkerhetsuppdateringar
- [ ] Konfigurera automatiska backups
- [ ] Sätt upp monitoring (UptimeRobot/Azure Insights)
- [ ] Aktivera automatisk SSL-förnyelse
- [ ] Konfigurera logrotation
- [ ] Skriv ut Emergency Contact Card

### Återkommande (Månatligt - 15 min)
- [ ] Kör `npm audit` och fixa critical/high
- [ ] Granska loggar för fel
- [ ] Kontrollera diskutrymme
- [ ] Verifiera monitoring

### Kvartalsvis (30 min)
- [ ] Uppdatera dependencies
- [ ] Granska användaråtkomst
- [ ] Testa backup-återställning

### Årligt (2 timmar)
- [ ] Säkerhetsgranskning
- [ ] Prestandagranskning
- [ ] Uppdatera dokumentation

---

**Resultat: Ett system som "kör sig självt" med minimal insats**

*Senast uppdaterad: 2025-11-03*
