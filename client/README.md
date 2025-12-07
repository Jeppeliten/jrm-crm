# CRM-prototyp för svenska mäklarmarknaden

En helt statisk, klickbar prototyp (ingen backend) som du kan öppna direkt i webbläsaren för att utvärdera flöden innan implementation.

## 🆕 NYA FUNKTIONER: Azure B2C User Management UI

**Nu med komplett användargränssnitt för att hantera kunder direkt från CRM:et!**

- ✅ **Skapa användare** i Azure B2C direkt från CRM
- ✅ **Ge/ta bort tjänster** (Värderingsdata Premium, Rapport Pro, API Access, Ortpris)
- ✅ **Hantera roller** (Mäklare, Manager, Admin)
- ✅ **Aktivera/inaktivera** användare
- ✅ **Återställ lösenord** med automatiska mail
- ✅ **Sök & filtrera** användare
- ✅ **Rollbaserad åtkomst** (Sales, Manager, Admin)

**Quick Start:**
1. Gå till `Inställningar` → `Hantera kunder`
2. Klicka `➕ Skapa användare`
3. Fyll i formulär och skapa användare i Azure B2C
4. Ge tjänster, hantera roller, etc.

**Dokumentation:**
- 📖 [QUICK_START_UI.md](QUICK_START_UI.md) - Kom igång på 5 minuter
- 🎨 [USER_MANAGEMENT_UI_GUIDE.md](USER_MANAGEMENT_UI_GUIDE.md) - Komplett UI-guide
- 📚 [AZURE_USER_CREATION_GUIDE.md](../AZURE_USER_CREATION_GUIDE.md) - API dokumentation

---

## Vad ingår
- Inloggning (mock): Ange namn för att logga in. Används för anteckningar och ägarskap.
- Hierarki: Varumärke → Mäklarföretag → Mäklare
- Statusar: Kund, Prospekt, Ej kontakt
- Licenser per mäklare: Aktiv, Test, Ingen
- Anteckningar/aktiviteter per entitet (loggas med användare och tid)
- Uppgifter med förfallodatum och ägare (koppla till varumärke/företag/mäklare eller fristående)
- Beslutsfattare (kontakter) på varumärke och företag
- Säljare/ansvarig: Tilldela intern säljare på företag/mäklare
- Dashboard: Täckningsgrad (% kunder), snabbstatistik, filter
  - Rapport per varumärke (företag, mäklare, aktiva licenser, täckning, pipeline-sammanställning, förväntat värde baserat på potential × sannolikhet)
- Import från Excel (lokalt i webbläsaren via XLSX/SheetJS): Mappning av kolumner
- Lokalt sparad data i `localStorage` (ingen server)
- Export till CSV för företag- och mäklarlistor (respektive filtrerade urval) samt uppgiftslista (Mina/Alla)
- **🆕 Azure B2C User Management UI** (kräver backend-integration)

## Öppna prototypen
1. Öppna filen `index.html` i valfri modern webbläsare.
   - Alternativt starta en enkel liveserver i VS Code och gå till `http://localhost:xxxx`.
2. För Azure B2C-funktioner: Kör backend (`cd ../server && node index.js`)

## Datamodell (förenklad)
- Varumärke
  - `id`, `namn`, `statusAgg` (beräknad), `anteckningar[]`
- Mäklarföretag
  - `id`, `namn`, `brandId`, `stad?`, `ansvarigSäljareId?`, `status`, `pipelineStage`, `anteckningar[]`
- Mäklare
  - `id`, `förnamn`, `efternamn`, `email?`, `telefon?`, `companyId`, `status`, `licens{status, start?, slut?}`, `ansvarigSäljareId?`, `anteckningar[]`
- Användare (interna säljare)
  - `id`, `namn`, `email?`, `roll?`
- **🆕 Kunder (Azure B2C användare)**
  - `id`, `azureB2CId`, `email`, `name`, `displayName`, `role`, `companyId`, `companyName`, `services[]`, `isActive`, `phone?`
- Anteckning
  - `id`, `entityType`, `entityId`, `text`, `authorId`, `createdAt`
- Uppgift
  - `id`, `title`, `dueAt?`, `ownerId?`, `done`, `entityType?`, `entityId?`
- Kontakt (beslutsfattare)
  - `id`, `entityType` (brand|company), `entityId`, `namn`, `roll?`, `email?`, `telefon?`

Statusvärden:
- `status`: `kund` | `prospekt` | `ej`
- `licens.status`: `aktiv` | `test` | `ingen`

## Import från Excel
- Klicka på Import i sidomenyn.
- Välj Excel-fil (`.xlsx`).
- Välj mappning: Varumärke, Företag, Förnamn, Efternamn, E-post, Telefon, Stad, Status.
- Systemet deduplicerar på `email` (om finns), annars namn + företag.
- Alla ändringar sparas i `localStorage`.

## Kända begränsningar i prototypen
- Ingen server, alla data sparas lokalt i webbläsaren (förutom Azure B2C-funktioner).
- Enkel behörighetsmodell (alla inloggade kan se allt i denna prototyp).
- Enkel felhantering vid import; vid komplexa Excel-format kan man behöva justera mappning.
- Uppgifter saknar påminnelser/notiser i denna prototyp.
- Pipeline-sannolikheter används endast för beräkning av förväntat värde (ex: kvalificerad 25%, offert 50%, förhandling 75%, vunnit 100%, förlorat 0%).
- Företag har ett fält "Potential (SEK)" som används i beräkningen; denna är manuell i prototypen.

## Nästa steg (för riktig produkt)
- ✅ **Azure B2C integration** för kundautentisering
- ✅ **User Management UI** för att hantera kunder
- Backend-API (auth, roller, data, ändringslogg, import-jobb)
- Rollbaserad åtkomst och notifikationssystem
- KPI/rapporter per säljare och varumärke
- Avtals- och fakturaflöden kopplade till licenser

## Filstruktur

```
crm-prototype/
├── index.html                      - Huvudfil med alla modaler
├── app.js                          - All JavaScript logik + Azure B2C functions
├── styles.css                      - All styling + Azure B2C UI styles
├── README.md                       - Denna fil
├── QUICK_START_UI.md              - Quick start guide för UI
├── USER_MANAGEMENT_UI_GUIDE.md    - Komplett UI dokumentation
└── public/                         - Statiska filer
```

---

Skapad: 2025-09-22
Senast uppdaterad: 2025-10-08 (Azure B2C UI)
