# 📚 Data Enrichment System - Användarguide

## 🎯 Översikt

Det förbättrade data enrichment-systemet hämtar automatiskt kontaktinformation för:
- 🏢 **Företag** (mäklarföretag)
- 👤 **Mäklare** (individuella fastighetsmäklare)
- 🏷️ **Varumärken** (mäklarkedjor och huvudkontor)

## 🚀 Hur det fungerar

### 1. **Företag (Mäklarföretag)**

#### Datakällor i prioritetsordning:
1. **Befintlig webbplats** → Scrapa kontaktinformation
2. **Organisationsnummer** → Bolagsverket/Allabolag API
3. **Google Places** → Telefon, adress, hemsida
4. **Varumärkesmönster** → Intelligent URL-generering

#### Exempel på varumärkesmönster:

**ERA Malmö**:
- `https://www.era.se/malmo`
- `https://malmo.era.se`
- `https://www.era.se/kontor/malmo`

**Svensk Fastighetsförmedling Stockholm**:
- `https://www.svenskfast.se/kontor/stockholm`
- `https://stockholm.svenskfast.se`

**Mäklarhuset Göteborg**:
- `https://www.maklarhuset.se/kontor/goteborg`

#### Data som hittas:
- ✅ Telefonnummer (huvudnummer)
- ✅ E-post (info@, kontakt@)
- ✅ Hemsida (med intelligent mönsterigenkänning)
- ✅ Besöksadress
- ✅ Postnummer och ort

### 2. **Mäklare (Individuella fastighetsmäklare)**

#### Sökstrategier:
1. **Företagets hemsida** → Leta efter mäklarsidor (/medarbetare, /team, /maklare)
2. **E-postmönster** → Generera från företagets domän
3. **LinkedIn** → Sök efter professionella profiler
4. **Företagets telefon** → Använd som fallback

#### E-postmönster (prioritetsordning):
- `fornamn.efternamn@domain.se` ⭐ (mest vanligt)
- `fornamnefternamn@domain.se`
- `f.efternamn@domain.se`
- `fefternamn@domain.se`

#### Exempel:
**Anna Svensson** på ERA Malmö:
- E-post: `anna.svensson@era.se`
- Telefon: (från företagets sida eller direktnummer)

### 3. **Varumärken (Mäklarkedjor)**

#### Kända svenska varumärken (inbyggd databas):

| Varumärke | Hemsida | Telefon | E-post | Huvudkontor |
|-----------|---------|---------|--------|-------------|
| ERA | era.se | 08-410 651 00 | info@era.se | Stockholm |
| Svensk Fastighetsförmedling | svenskfast.se | 08-400 22 500 | info@svenskfast.se | Stockholm |
| Mäklarhuset | maklarhuset.se | 08-695 57 00 | info@maklarhuset.se | Stockholm |
| Fastighetsbyrån | fastighetsbyran.com | 08-407 01 00 | info@fastighetsbyran.se | Stockholm |
| Notar | notar.se | 08-400 29 400 | info@notar.se | Stockholm |
| Länsförsäkringar Fastighet | lansfast.se | 08-588 400 00 | info@lansfast.se | Stockholm |
| Husman & Hagberg | husmanhagberg.se | 08-120 116 00 | info@husmanhagberg.se | Göteborg |
| Bjurfors | bjurfors.se | 031-81 86 00 | info@bjurfors.se | Göteborg |
| Skandiamäklarna | skandiamaklarna.se | 08-522 088 00 | info@skandiamaklarna.se | Stockholm |
| Hemverket | hemverket.se | 08-508 910 00 | info@hemverket.se | Stockholm |

## 🛠️ Användning

### Steg 1: Öppna Data Enrichment
Klicka på **"🔄 Uppdatera kontaktuppgifter"** i topbaren.

### Steg 2: Välj inställningar

#### Välj vad som ska uppdateras:
- ✅ **Alla företag** - Uppdaterar alla mäklarföretag
- ✅ **Alla mäklare** - Uppdaterar alla fastighetsmäklare
- ✅ **Alla varumärken** - Uppdaterar alla mäklarkedjor
- ✅ **Företag och mäklare** - Kombinerat
- ✅ **Allt** - Företag, mäklare och varumärken
- ⭐ **Endast poster med saknad information** - Rekommenderat!

#### Välj datakällor:
- ☑️ **Allabolag.se** - Företagsinformation
- ☑️ **Bolagsverket** - Offentliga register
- ☑️ **Google/LinkedIn** - Sökningar och profiler
- ☑️ **Företagens hemsidor** - Smart web scraping

#### Överskrivning:
- 🔲 **Skriv över befintlig information** - Standardval: NEJ (rekommenderat)
- Om avmarkerad: Fyller endast tomma fält

### Steg 3: Starta uppdatering
Klicka på **"🚀 Starta uppdatering"**.

### Steg 4: Följ processen
- Se realtidsprogress med procentuell indikator
- Se vilka poster som uppdateras i loggen
- Grön = uppdaterad, Grå = ingen ny info, Röd = fel

### Steg 5: Granska resultat
- Se sammanfattning av vad som uppdaterades
- Detaljerad lista över ändringar per post
- Data sparas automatiskt

## 🎓 Best Practices

### ✅ Rekommenderat:
1. **Kör först på "Endast poster med saknad information"**
2. **Låt "Skriv över befintlig information" vara avmarkerad**
3. **Aktivera alla datakällor** för bäst resultat
4. **Granska resultaten** efter varje körning
5. **Kör regelbundet** (t.ex. en gång i månaden)

### ❌ Undvik:
1. ❌ Skriva över manuellt inmatad korrekt data
2. ❌ Köra för ofta (belasta inte externa tjänster)
3. ❌ Lita blint på automatisk data - granska alltid!

## 🔧 Tekniska detaljer

### För produktion (när du implementerar riktiga API:er):

#### 1. Bolagsverket API
```javascript
const response = await fetch(`https://data.bolagsverket.se/api/v1/company/${orgNumber}`);
const data = await response.json();
// Hämta: adress, stad, postnummer
```

#### 2. Allabolag.se API
```javascript
const response = await fetch(`https://www.allabolag.se/api/companies/${orgNumber}`);
const data = await response.json();
// Hämta: telefon, email, website
```

#### 3. Google Places API
```javascript
const query = `${companyName} ${city} Sverige`;
const response = await fetch(
  `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?` +
  `input=${encodeURIComponent(query)}` +
  `&inputtype=textquery` +
  `&fields=formatted_phone_number,website,formatted_address` +
  `&key=YOUR_API_KEY`
);
```

#### 4. LinkedIn API
```javascript
const query = `${firstName} ${lastName} ${companyName} fastighetsmäklare`;
const response = await fetch(
  `https://api.linkedin.com/v2/people?q=${encodeURIComponent(query)}`,
  {
    headers: {
      'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`
    }
  }
);
```

#### 5. Web Scraping
```javascript
const response = await fetch(websiteUrl);
const html = await response.text();

// Extract phone numbers
const phoneRegex = /(?:(?:\+46|0)\s*(?:7[0-9]|[1-9][0-9])\s*[\d\s\-]{7,})/g;
const phones = html.match(phoneRegex);

// Extract emails
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const emails = html.match(emailRegex);
```

## 📊 Dataflöde

```
┌─────────────────┐
│  Företag        │
│  (Company)      │
└────────┬────────┘
         │
         ├──► 1. Har website? → Scrape contact info
         │
         ├──► 2. Har orgNumber? → Bolagsverket/Allabolag
         │
         ├──► 3. Google Places → Telefon, adress, website
         │
         └──► 4. Brand pattern → Generera URL från varumärke


┌─────────────────┐
│  Mäklare        │
│  (Agent)        │
└────────┬────────┘
         │
         ├──► 1. Company website → Leta på /medarbetare
         │
         ├──► 2. Generate email → firstname.lastname@domain
         │
         ├──► 3. LinkedIn → Professionell profil
         │
         └──► 4. Company phone → Fallback


┌─────────────────┐
│  Varumärke      │
│  (Brand)        │
└────────┬────────┘
         │
         ├──► 1. Known brands DB → ERA, Svensk Fast, etc.
         │
         ├──► 2. Google search → Huvudkontor
         │
         ├──► 3. Scrape website → Contact info
         │
         └──► 4. Generate email → info@domain
```

## 🔒 Säkerhet och GDPR

- ✅ All datahämtning loggas i audit log
- ✅ Användarens samtycke krävs innan körning
- ✅ Rate limiting för att inte belasta externa tjänster
- ✅ Data valideras innan det sparas
- ✅ Användare kan exportera och radera data

## 🆘 Felsökning

### Problem: Ingen data hittas
**Lösning:**
- Kontrollera att datakällor är aktiverade
- Verifiera att företaget har organisationsnummer
- Kontrollera internetanslutningen

### Problem: Fel data uppdateras
**Lösning:**
- Använd inte "Skriv över befintlig information"
- Granska manuellt innan du godkänner ändringar
- Använd Ångra-funktionen om fel data sparades

### Problem: För långsam körning
**Lösning:**
- Kör på "Endast poster med saknad information"
- Inaktivera vissa datakällor
- Kör i mindre batcher

## 📞 Support

Vid frågor eller problem, kontakta systemadministratören.

---

**Version:** 2.0  
**Senast uppdaterad:** 2025-10-08  
**Författare:** CRM Development Team
