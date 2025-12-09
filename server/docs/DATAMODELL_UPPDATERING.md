# Datamodell Uppdatering - Mäklare, Företag & Varumärken
**Datum:** 2025-12-09
**Status:** ✅ Implementerat

## 📋 Översikt

Uppdaterat alla datamodeller för att stödja fullständig mäklarinformation från Excel-import med:
- Kompletta mäklarfält (namn, efternamn, adress, etc.)
- Mäklarpaket-information (MSN, UID, kostnader, rabatter)
- Produkter och matchningstyp
- Relationer mellan mäklare, företag och varumärken
- Automatisk summering och aggregering

---

## 🔄 Ändringar per Modell

### 1. **Agents (Mäklare)** - `routes/agents.js`

#### Nya fält:
```javascript
{
  // Basic info
  name: String,              // Förnamn
  lastName: String,          // Efternamn (NYTT)
  email: String,
  phone: String,
  registrationType: String,  // Registreringstyp (NYTT)
  
  // Company and Brand references
  company: String,           // Företagsnamn
  companyId: ObjectId,       // Koppling till företag (NYTT)
  brand: String,             // Varumärkesnamn
  brandId: ObjectId,         // Koppling till varumärke (NYTT)
  
  // Address info (NYTT)
  address: String,           // Adress
  postalCode: String,        // Postnummer
  city: String,              // Postort
  office: String,            // Kontor där mäklaren är verksam
  
  // Mäklarpaket fields (NYTT)
  brokerPackage: {
    userId: String,          // AnvändarID
    msnName: String,         // MSNNamn
    uid: String,             // UID
    epost: String,           // Epost
    active: Boolean,         // Aktiv
    customerNumber: String,  // KundNr
    accountNumber: String,   // Kontor
    totalCost: Number,       // Totalkostnad
    discount: Number         // Rabatt
  },
  
  // Products and matching (NYTT)
  products: Array,           // Produkter (array)
  matchType: String,         // Matchtyp
  
  // Status and metadata
  status: String,            // 'aktiv', 'inaktiv', etc.
  role: String,
  licenseType: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Nya funktioner:
- **Automatisk aggregering** vid create/update/delete
- Uppdaterar företagets och varumärkets `agentCount`
- Uppdaterar företagets `brandIds` array

---

### 2. **Companies (Företag)** - `routes/companies.js`

#### Nya fält:
```javascript
{
  name: String,
  orgNumber: String,
  email: String,
  phone: String,
  address: String,
  brandIds: [ObjectId],      // Array av varumärkes-IDs (NYTT)
  agentCount: Number,        // Antal mäklare (NYTT)
  lastContact: Date,
  nextAction: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Nya endpoints:
- **GET `/api/companies/:id/stats`** - Fullständig statistik
  ```javascript
  {
    agentCount: Number,           // Totalt antal mäklare
    brandCount: Number,           // Antal unika varumärken
    brandIds: [ObjectId],         // Lista av varumärken
    totalProducts: Number,        // Totalt antal produkter från alla mäklare
    totalBrokerPackageCost: Number, // Total kostnad för mäklarpaket
    activeAgents: Number,         // Antal aktiva mäklare
    inactiveAgents: Number        // Antal inaktiva mäklare
  }
  ```

- **GET `/api/companies/:id/agents`** - Hämta alla mäklare för företaget

---

### 3. **Brands (Varumärken)** - `routes/brands.js`

#### Nya fält:
```javascript
{
  name: String,
  description: String,
  category: String,
  status: String,
  website: String,
  companyId: ObjectId,       // Koppling till företag (NYTT)
  agentCount: Number,        // Antal mäklare (NYTT)
  createdAt: Date,
  updatedAt: Date
}
```

#### Nya endpoints:
- **GET `/api/brands/:id/stats`** - Fullständig statistik
  ```javascript
  {
    agentCount: Number,             // Totalt antal mäklare
    companyId: ObjectId,            // Kopplat företag
    totalProducts: Number,          // Totalt antal produkter
    totalBrokerPackageCost: Number, // Total kostnad för mäklarpaket
    activeAgents: Number,           // Antal aktiva mäklare
    inactiveAgents: Number          // Antal inaktiva mäklare
  }
  ```

---

## 🔧 Ny Service: `aggregation-service.js`

Centraliserad service för att hantera all summering och aggregering.

### Funktioner:

#### Uppdatera counts:
- `updateCompanyAgentCount(db, companyId)` - Räknar och uppdaterar antal mäklare för företag
- `updateBrandAgentCount(db, brandId)` - Räknar och uppdaterar antal mäklare för varumärke
- `updateCompanyBrands(db, companyId)` - Uppdaterar lista av varumärken för företag

#### Beräkningar:
- `countAgentProducts(products)` - Räknar antal produkter
- `calculateBrokerPackageCost(brokerPackage)` - Beräknar total kostnad (totalCost - discount)

#### Aggregerad statistik:
- `getCompanyAggregatedStats(db, companyId)` - Fullständig företagsstatistik
- `getBrandAggregatedStats(db, brandId)` - Fullständig varumärkesstatistik

#### Automatisk uppdatering:
- `updateAllAggregations(db, companyId, brandId)` - Uppdaterar alla relevanta aggregeringar

---

## 🔗 Relationer och Kopplingar

```
Company (Företag)
│
├─► brandIds: [ObjectId]        → Varumärken som företaget har
├─► agentCount: Number          → Antal mäklare i företaget
│
└─► Agents (Mäklare)
    └─► companyId: ObjectId     → Koppling till företag

Brand (Varumärke)
│
├─► companyId: ObjectId         → Koppling till företag
├─► agentCount: Number          → Antal mäklare med varumärket
│
└─► Agents (Mäklare)
    └─► brandId: ObjectId       → Koppling till varumärke

Agent (Mäklare)
├─► companyId: ObjectId         → Koppling till företag
├─► brandId: ObjectId           → Koppling till varumärke
├─► brokerPackage: Object       → Mäklarpaket-info
└─► products: [String]          → Lista av produkter
```

---

## 📊 Excel-kolumner som nu stöds

Alla kolumner från bilden mappas nu till datamodellen:

| Excel-kolumn | Fält i Agent | Typ |
|--------------|--------------|-----|
| Mäklare - Namn | `name` | String |
| Efternamn | `lastName` | String |
| Registreringstyp | `registrationType` | String |
| Företag - namn | `company` | String |
| Företag - kedja/varumärke | `brand` | String |
| Företag - adress | `address` | String |
| Företag - postnummer | `postalCode` | String |
| Företag - postort | `city` | String |
| Kontor där mäklaren är verksam | `office` | String |
| Mäklarpaket.AnvändarID | `brokerPackage.userId` | String |
| Mäklarpaket.MSNNamn | `brokerPackage.msnName` | String |
| Mäklarpaket.UID | `brokerPackage.uid` | String |
| Mäklarpaket.Epost | `brokerPackage.epost` | String |
| Mäklarpaket.Aktiv | `brokerPackage.active` | Boolean |
| Mäklarpaket.KundNr | `brokerPackage.customerNumber` | String |
| Mäklarpaket.Kontor | `brokerPackage.accountNumber` | String |
| Mäklarpaket.Kedja | (mappas till `brandId`) | ObjectId |
| Mäklarpaket.ProduktNamn | (ingår i `products`) | Array |
| Mäklarpaket.Totalkostnad | `brokerPackage.totalCost` | Number |
| Mäklarpaket.Rabatt | `brokerPackage.discount` | Number |
| Produkter | `products` | Array |
| Matchtyp | `matchType` | String |

---

## 🚀 Användning

### Skapa mäklare med kopplingar:
```javascript
POST /api/agents
{
  "name": "Anna",
  "lastName": "Andersson",
  "email": "anna@example.com",
  "registrationType": "Franchisetagare",
  "companyId": "507f1f77bcf86cd799439011",
  "brandId": "507f1f77bcf86cd799439012",
  "address": "Storgatan 1",
  "postalCode": "12345",
  "city": "Stockholm",
  "office": "Stockholm City",
  "brokerPackage": {
    "userId": "USER123",
    "msnName": "Anna Andersson",
    "totalCost": 5000,
    "discount": 500
  },
  "products": ["Produkt A", "Produkt B"],
  "matchType": "Exakt"
}
```

### Hämta företagsstatistik:
```javascript
GET /api/companies/507f1f77bcf86cd799439011/stats

Response:
{
  "agentCount": 15,
  "brandCount": 3,
  "brandIds": ["507f...", "608f...", "709f..."],
  "totalProducts": 45,
  "totalBrokerPackageCost": 67500,
  "activeAgents": 14,
  "inactiveAgents": 1
}
```

### Hämta varumärkesstatistik:
```javascript
GET /api/brands/507f1f77bcf86cd799439012/stats

Response:
{
  "agentCount": 8,
  "companyId": "507f1f77bcf86cd799439011",
  "totalProducts": 24,
  "totalBrokerPackageCost": 36000,
  "activeAgents": 8,
  "inactiveAgents": 0
}
```

---

## ✅ Automatiska Uppdateringar

När en mäklare skapas/uppdateras/tas bort:
1. ✅ `agentCount` uppdateras automatiskt i företaget
2. ✅ `agentCount` uppdateras automatiskt i varumärket
3. ✅ `brandIds` array uppdateras i företaget
4. ✅ Alla ändringar timestampas med `updatedAt`

---

## 📝 Nästa Steg

### Rekommenderat:
1. **Excel Import Endpoint** - Skapa `/api/agents/import/excel` som kan läsa Excel-filer
2. **Bulk Operations** - Stöd för att skapa många mäklare samtidigt
3. **Validering** - Förbättrad validering av mäklarpaket-data
4. **Reporting** - Dashboard-endpoints för rapporter och visualiseringar

### Framtida förbättringar:
- Indexering i Cosmos DB för snabbare aggregeringar
- Caching av statistik med Redis
- Webhook-notifikationer vid uppdateringar
- Historik och audit log för ändringar

---

**Status:** ✅ Alla modeller och relationer implementerade och klara för användning!
