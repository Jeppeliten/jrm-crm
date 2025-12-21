# JRM CRM
## Vår gemensamma plattform för kund- och uppdragshantering

---

# Säljande pitch

> **Ett modernt CRM byggt för våra behov – av oss, för oss.**

### Vad är JRM CRM?

JRM CRM är vår interna plattform som samlar **kunder, uppdrag, ekonomi och systemhälsa** i ett gemensamt gränssnitt. Systemet är byggt för att ge sälj, delivery och support en **realtidsvy** över hela verksamheten – utan manuell handpåläggning.

---

## Fördelar för organisationen

| Område | Nytta |
|--------|-------|
| **Effektivitet** | Automatiserade statuskontroller (Visma, Outlook) och smarta rapporter sparar tid |
| **Beslutsunderlag** | Dual-user stats, routing rules och version/status-endpoints ger färska data direkt |
| **Säkerhet** | Rollstyrning via Entra/Azure AD, loggning för revision och compliance |
| **Skalbarhet** | Modulär arkitektur – lätt att lägga till nya vyer eller integrationer |
| **Driftsäkerhet** | Molndrift i Azure med CI/CD för snabba, spårbara releaser |

---

## Vad ger detta oss konkret?

✅ **Kortare ledtid** från idé till produktionssatt förbättring  
✅ **Färre driftincidenter** tack vare inbyggda hälsokontroller och loggar  
✅ **Enklare efterlevnad** och access-hygien via central identitet (Entra)  
✅ **Lägre kostnad per release** genom automatiserad pipeline och containerdrift  

---

# Teknisk beskrivning

## Arkitekturöversikt

```
┌─────────────────────────────────────────────────────────────────┐
│                        KLIENT (Browser)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Kundvyer    │  │  Rapporter   │  │  Statusvy    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                           │                                     │
│                    MSAL / Entra Auth                            │
└───────────────────────────┼─────────────────────────────────────┘
                            │ HTTPS + Bearer Token
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXPRESS API (Node.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Routes     │  │   Auth       │  │   Services   │          │
│  │  /customers  │  │  JWT verify  │  │  Outlook     │          │
│  │  /stats      │  │  Role check  │  │  Visma       │          │
│  │  /version    │  │  Groups      │  │  Reporting   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATALAGER                                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              MongoDB Atlas                            │      │
│  │   Collections: customers, tasks, stats, routing       │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Komponentöversikt

### Frontend (client/)
- **Teknologi:** Vanilla JavaScript, CSS, HTML
- **Hosting:** Azure Static Web Apps
- **Funktioner:**
  - Kundlistor och detaljvyer
  - Försäljningsrapporter
  - Systemstatuspanel
  - Kalenderintegration (Outlook)

### Backend (server/)
- **Teknologi:** Node.js, Express
- **Hosting:** Azure Web App (Container)
- **API-rutter:**
  - `/api/customers` – CRUD för kunder
  - `/api/users/dual-stats` – Användarstatistik
  - `/api/version` – Versionsinformation
  - `/api/status` – Systemhälsa
  - `/api/outlook` – Kalenderintegration

### Datalager
- **Databas:** MongoDB Atlas
- **Collections:** customers, tasks, stats, routing_rules
- **Säkerhet:** IP-whitelisting, TLS, autentiserade anslutningar

### Integrationer
- **Microsoft Entra ID** – Autentisering och rollstyrning
- **Microsoft Outlook** – Kalender och mailintegration
- **Visma.net** – Ekonomistatuskontroller

---

## Systemflöden

### Autentiseringsflöde

```
┌────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Användare│────▶│ Klient  │────▶│ Entra   │────▶│  API    │
└────────┘     └─────────┘     └─────────┘     └─────────┘
     │              │               │               │
     │  1. Öppnar   │               │               │
     │     app      │               │               │
     │              │  2. Redirect  │               │
     │              │─────────────▶│               │
     │              │               │               │
     │              │  3. Login +   │               │
     │              │     MFA       │               │
     │              │◀─────────────│               │
     │              │               │               │
     │              │  4. Token     │               │
     │              │─────────────────────────────▶│
     │              │               │               │
     │              │  5. Verify +  │               │
     │              │     authorize │               │
     │              │◀─────────────────────────────│
     │              │               │               │
     │  6. Data     │               │               │
     │◀────────────│               │               │
```

### Dataflöde (Kundlista)

```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│   Klient   │───▶│    API     │───▶│  MongoDB   │───▶│   Klient   │
│            │    │            │    │            │    │            │
│ GET request│    │ Auth check │    │ Query      │    │ Render     │
│ + Bearer   │    │ + validate │    │ customers  │    │ resultat   │
└────────────┘    └────────────┘    └────────────┘    └────────────┘
```

---

## CI/CD Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Commit    │───▶│   Build &   │───▶│   Docker    │───▶│   Deploy    │
│   till main │    │   Test      │    │   Image     │    │   Azure     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                         │                   │                  │
                   ┌─────▼─────┐       ┌─────▼─────┐      ┌─────▼─────┐
                   │ Lint      │       │ Push till │      │ Web App   │
                   │ Unit tests│       │ Registry  │      │ restart   │
                   └───────────┘       └───────────┘      └───────────┘
```

---

## Säkerhetsarkitektur

| Lager | Skydd |
|-------|-------|
| **Transport** | HTTPS/TLS 1.3 |
| **Autentisering** | Microsoft Entra ID (OAuth 2.0 / OIDC) |
| **Auktorisering** | JWT-validering + rollgrupper |
| **Data** | MongoDB Atlas med TLS + IP-whitelist |
| **Loggning** | Azure App Service logs + strukturerad logging |
| **Secrets** | Azure Key Vault / miljövariabler |

---

## Teknisk stack

| Komponent | Teknologi |
|-----------|-----------|
| Frontend | JavaScript (ES6+), HTML5, CSS3 |
| Backend | Node.js 18+, Express 4.x |
| Databas | MongoDB Atlas |
| Auth | Microsoft Entra ID, MSAL.js |
| Hosting | Azure Static Web Apps, Azure Web App |
| Container | Docker |
| CI/CD | Azure DevOps / GitHub Actions |
| Monitoring | Azure Monitor, App Service Logs |

---

## Kontakt & support

**Repository:** github.com/Jeppeliten/jrm-crm  
**Branch:** main  
**Dokumentation:** Se `/docs` i repot  

---

*Senast uppdaterad: December 2025*
