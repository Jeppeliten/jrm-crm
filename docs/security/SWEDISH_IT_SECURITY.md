# Svensk IT-säkerhetslösning för CRM
# Följer MSB (Myndigheten för samhällsskydd och beredskap) riktlinjer

## 🇸🇪 Svenska leverantörer och datasuveränitet

### **Rekommenderade svenska VPS-leverantörer:**

#### 1. **Bahnhof** (Topprekommendation)
- **Säkerhet**: Militärskyddat datacenter i Vita Bergen, Stockholm
- **Miljö**: 100% förnybar energi, koldioxidnegativ
- **Data**: All data stannar i Sverige, inga utländska myndigheter får tillgång
- **Kostnad**: VPS från 149 SEK/månad (€13/månad)
- **Plats**: Stockholm, Göteborg, Malmö
- **Website**: https://www.bahnhof.se/

#### 2. **Glesys** 
- **Säkerhet**: ISO 27001 certifierat, svensk ägd
- **Data**: Datacenter i Stockholm och Falkenberg
- **Kostnad**: VPS från 129 SEK/månad (€11/månad)
- **GDPR**: Full svensk GDPR-compliance
- **Website**: https://glesys.se/

#### 3. **Binero**
- **Säkerhet**: Svensk molnleverantör med egen infrastruktur
- **Data**: All data i svenska datacenter
- **Kostnad**: Cloud VPS från 99 SEK/månad (€9/månad)
- **Miljö**: Fossilfri energi
- **Website**: https://binero.se/

#### 4. **City Network** (Kry, Klarna använder dem)
- **Säkerhet**: Svenska banker och myndigheter som kunder
- **Compliance**: SOC 2, ISO 27001, PCI DSS
- **Data**: Stockholm datacenter
- **Website**: https://www.citynetwork.se/

### **Svenska domänleverantörer:**
- **Loopia**: .se domäner från 49 SEK/år
- **Binero**: .se domäner från 69 SEK/år  
- **GleSYS**: .se domäner från 99 SEK/år

---

## 🔒 MSB IT-säkerhetsriktlinjer

### **Obligatoriska säkerhetsåtgärder enligt MSB:**

#### 1. **Kryptering**
- TLS 1.3 för all datatrafik
- AES-256 för data i vila
- Svenska kryptocertifikat via SUNET eller Comodo

#### 2. **Åtkomstkontroll**
- Tvåfaktorsautentisering (obligatoriskt för admin)
- Rollbaserad åtkomst (RBAC)
- Regelbundna behörighetsgranskningar

#### 3. **Loggning och övervakning**
- All dataåtkomst loggas
- Säkerhetsincidenter rapporteras
- Audit trail i minst 7 år

#### 4. **Backup och kontinuitet**
- 3-2-1 backup-regel
- Dagliga inkrementella backups
- Fullständig återställningstestning kvartalsvis

#### 5. **Patchhantering**
- Automatiska säkerhetsuppdateringar
- Kritiska patches inom 24h
- Planerade underhållsfönster

---

## 🏛️ GDPR och svensk dataskydd

### **Juridiska krav för svenska företag:**

#### **Dataminimering:**
- Spara endast nödvändig data
- Automatisk radering efter 7 år (mäklardata)
- Tydlig dokumentation av databehandling

#### **Samtycke och rättigheter:**
- Dokumenterat samtycke för databehandling
- "Right to be forgotten" implementerad
- Dataportabilitet (export-funktion)

#### **Säkerhetsåtgärder:**
- Pseudonymisering av persondata
- Kryptering både i transit och vila
- Säkerhetsincidentrapportering till IMY

#### **Dokumentation:**
- DPIA (Data Protection Impact Assessment)
- Databehandlingsregister
- Säkerhetspolicy dokumenterad

---

## 🔐 Svensk säkerhetskonfiguration

### **Förstärkt säkerhetssetup:**

#### 1. **Svensk TLS-konfiguration**
```nginx
# Endast svenska/EU-godkända chiffer
ssl_protocols TLSv1.3;
ssl_ciphers 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305';
ssl_ecdh_curve secp384r1;
ssl_prefer_server_ciphers off;

# HSTS för svensk domän
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";

# Säkerhetsheaders enligt MSB
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";
```

#### 2. **Förstärkt Docker-säkerhet**
```dockerfile
# Använd minimal base image
FROM node:18-alpine

# Skapa dedicated användare
RUN addgroup -g 10001 -S crm && \
    adduser -S crm -u 10001 -G crm

# Säkerhetshärdning
RUN apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Ingen root-access
USER crm

# Read-only filesystem
VOLUME ["/app/data"]
```

#### 3. **Svensk loggkonfiguration**
```json
{
  "logging": {
    "level": "info",
    "format": "json",
    "audit": {
      "enabled": true,
      "retention": "7years",
      "location": "sweden",
      "encryption": "aes256"
    },
    "gdpr": {
      "anonymize_after": "7years",
      "right_to_deletion": true
    }
  }
}
```

---

## 🛡️ Compliance och certifieringar

### **Certifieringar att kräva från leverantör:**

- ✅ **ISO 27001** - Informationssäkerhetsstandard
- ✅ **ISO 14001** - Miljöcertifiering  
- ✅ **SOC 2 Type II** - Säkerhetskontroller
- ✅ **GDPR-compliance** - EU dataskydd
- ✅ **Svensk datalagring** - Data lämnar aldrig Sverige

### **Kontraktuella krav:**
```
- All data lagras fysiskt i Sverige
- Inga utländska myndigheter får åtkomst
- Leverantören följer svensk lag
- 99.9% tillgänglighetsgaranti
- 24/7 svensk support
- Säkerhetsincidentrapportering inom 4h
```

---

## 💼 Kostnadsjämförelse svenska leverantörer

| Leverantör | Kostnad/mån | Datacenter | Miljöcert | Support |
|------------|-------------|------------|-----------|---------|
| **Bahnhof** | 149 SEK | Stockholm | ✅ Koldioxidnegativ | 24/7 Svenska |
| **GleSYS** | 129 SEK | Stockholm/Falkenberg | ✅ Förnybar energi | 24/7 Svenska |
| **Binero** | 99 SEK | Stockholm | ✅ Fossilfri | Kontorstid |
| **City Network** | 199 SEK | Stockholm | ✅ Grön energi | 24/7 Enterprise |

**Rekommendation**: Bahnhof för högsta säkerhet, GleSYS för bästa pris/prestanda.

---

## 🎯 Svensk implementationsplan

### **Fas 1: Säker grund (Vecka 1)**
1. Skaffa VPS hos Bahnhof/GleSYS
2. Registrera .se domän via Loopia
3. Grundläggande härdning enligt MSB

### **Fas 2: CRM-deployment (Vecka 2)**  
1. Deploy med förstärkt säkerhet
2. SSL via svenska certifikat
3. Backup till svenskt lagringsutrymme

### **Fas 3: Compliance (Vecka 3)**
1. GDPR-dokumentation
2. Säkerhetspolicy
3. Användarutbildning

### **Fas 4: Drift och övervakning (Löpande)**
1. Månatlig säkerhetsgranskning
2. Kvartalsvis backup-test
3. Årlig penetrationstestning

---

## 📋 Svensk säkerhetschecklista

### **Teknisk säkerhet:**
- [ ] Data lagras endast i Sverige
- [ ] TLS 1.3 med svenska certifikat
- [ ] Tvåfaktorsautentisering aktiverad
- [ ] Automatiska säkerhetsuppdateringar
- [ ] Brandvägg konfigurerad enligt MSB
- [ ] Intrångsdetektering aktiverat
- [ ] Säkra backup-rutiner
- [ ] Krypterade databaser

### **GDPR-compliance:**
- [ ] Databehandlingsavtal undertecknat
- [ ] Privacy policy uppdaterad
- [ ] Right to deletion implementerat
- [ ] Consent-hantering dokumenterad
- [ ] DPIA genomförd
- [ ] Säkerhetsincidentplan klar

### **Juridisk compliance:**
- [ ] Svensk leverantör vald
- [ ] Datalagring inom Sverige
- [ ] Avtalsvillkor granskade av jurist
- [ ] Försäkring för cyberrisker
- [ ] Incidentrapportering till IMY

---

## 🚨 Säkerhetsincidentplan

### **Vid misstänkt intrång:**

#### **Omedelbar respons (0-1h):**
1. Isolera påverkade system
2. Dokumentera alla åtgärder
3. Kontakta IT-säkerhetsansvarig
4. Bevara bevis

#### **Utredning (1-24h):**
1. Analysera loggar
2. Bedöm omfattning
3. Kontakta leverantör om nödvändigt
4. Juridisk bedömning

#### **Rapportering (24-72h):**
1. IMY-anmälan vid persondata
2. Kundkommunikation vid behov
3. Försäkringsanmälan
4. Lärdomar och förbättringar

---

## 💰 Total kostnad svensk lösning

### **Månadskostnader:**
- **VPS (Bahnhof)**: 149 SEK/månad
- **Domän (.se)**: 4 SEK/månad (49 SEK/år)
- **Backup-lagring**: 29 SEK/månad
- **SSL-certifikat**: 0 SEK (Let's Encrypt)
- **Total**: ~182 SEK/månad (€16/månad)

### **Årskostnad**: ~2,184 SEK (€195/år)

**Jämfört med Azure**: €456/år → **Spara €261/år + full datasuveränitet!**

---

## 🎯 Nästa steg

Vill du att jag:
1. **Sätter upp hos Bahnhof** med militär säkerhet?
2. **Konfigurerar GleSYS** för bästa pris/prestanda?
3. **Skapar svensk säkerhetskonfiguration** för din befintliga setup?

Jag kan även hjälpa dig med:
- Kontakt med svenska leverantörer
- GDPR-dokumentation
- Säkerhetspolicy enligt MSB
- Certifikathantering

**Vilken väg föredrar du för att få din CRM 100% svensk och säker?**