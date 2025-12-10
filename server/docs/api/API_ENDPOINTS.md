# API Endpoints Documentation

## Overview
Complete API reference for the JRM CRM system. All endpoints support JSON format and return appropriate HTTP status codes.

---

## Stats Endpoints

### GET /api/stats/dashboard
Returns comprehensive dashboard statistics with brand breakdown.

**Response:**
```json
{
  "totalBrands": 5,
  "totalCompanies": 5,
  "totalAgents": 51,
  "activeLicenses": 26,
  "coverage": 60,
  "totalMRR": 211249,
  "potential": 140833,
  "brandBreakdown": [
    {
      "brandId": "mock1",
      "brandName": "ERA Mäklare",
      "companyCount": 1,
      "agentCount": 12,
      "mrr": 125000,
      "status": "kund",
      "centralContract": true
    }
  ],
  "timestamp": "2025-12-10T..."
}
```

### GET /api/stats/overview
Quick overview statistics for header/summary displays.

**Response:**
```json
{
  "companies": {
    "total": 5,
    "customers": 3,
    "prospects": 2
  },
  "agents": {
    "total": 51,
    "active": 26
  },
  "brands": {
    "total": 5,
    "withCentralContract": 2
  },
  "mrr": {
    "total": 211249,
    "growth": 12.5
  }
}
```

### GET /api/stats/activity
Returns recent contacts and upcoming actions.

**Response:**
```json
{
  "recentContacts": [
    {
      "companyId": "4",
      "companyName": "Fastighetsbyrån Malmö City",
      "date": "2025-12-05T...",
      "type": "meeting"
    }
  ],
  "upcomingActions": [
    {
      "companyId": "3",
      "companyName": "Svensk Fastighetsförmedling Göteborg",
      "action": "Demo-möte bokad 15 dec",
      "date": "2025-12-15T..."
    }
  ]
}
```

### GET /api/stats/mrr-breakdown
MRR distribution across pricing tiers.

**Response:**
```json
{
  "tiers": [
    {
      "range": "4-6",
      "price": 849,
      "companies": 1,
      "total": 849
    },
    {
      "range": "11-15",
      "price": 1649,
      "companies": 1,
      "total": 1649
    }
  ]
}
```

---

## Companies Endpoints

### GET /api/companies
Get all companies with optional filtering and sorting.

**Query Parameters:**
- `status` - Filter by status: `kund` or `prospekt`
- `brandId` - Filter by brand ID
- `search` - Search by name, email, or org number
- `sort` - Sort field: `name`, `agentCount`, `lastContact` (default: `name`)
- `order` - Sort order: `asc` or `desc` (default: `asc`)

**Examples:**
```bash
GET /api/companies?status=kund
GET /api/companies?search=ERA
GET /api/companies?brandId=mock1&sort=agentCount&order=desc
```

**Response:**
```json
[
  {
    "_id": "1",
    "name": "ERA Sverige Fastighetsförmedling AB",
    "orgNumber": "556123-4567",
    "email": "info@era.se",
    "phone": "08-123 45 67",
    "address": "Storgatan 1, Stockholm",
    "status": "kund",
    "brandId": "mock1",
    "brand": "ERA Mäklare",
    "agentCount": 12,
    "payment": 1649,
    "lastContact": "2025-12-01T...",
    "nextAction": "Uppföljning Q1 2026",
    "createdAt": "2024-01-15T...",
    "updatedAt": "2025-12-10T..."
  }
]
```

### GET /api/companies/:id
Get specific company by ID.

**Response:** Single company object (same structure as above)

### GET /api/companies/:id/stats
Get statistics for a specific company.

**Response:**
```json
{
  "agentCount": 12,
  "brandIds": ["mock1"],
  "mrr": 1649
}
```

### GET /api/companies/:id/agents
Get all agents for a specific company.

**Response:** Array of agent objects

### POST /api/companies
Create new company.

**Request Body:**
```json
{
  "name": "New Company AB",
  "orgNumber": "556999-8888",
  "email": "info@newcompany.se",
  "phone": "08-999 88 77",
  "address": "Address 1, City",
  "brandIds": ["mock1"],
  "status": "prospekt"
}
```

**Response:** Created company object with `_id`

### PUT /api/companies/:id
Update existing company.

**Request Body:** Same as POST (partial updates supported)

**Response:**
```json
{
  "message": "Company updated successfully"
}
```

### DELETE /api/companies/:id
Delete company.

**Response:**
```json
{
  "message": "Company deleted successfully"
}
```

---

## Agents Endpoints

### GET /api/agents
Get all agents with optional filtering and sorting.

**Query Parameters:**
- `status` - Filter by status: `aktiv` or `inaktiv`
- `companyId` - Filter by company ID
- `brandId` - Filter by brand ID
- `search` - Search by name, email, or company name
- `sort` - Sort field: `name`, `company`, `createdAt` (default: `name`)
- `order` - Sort order: `asc` or `desc` (default: `asc`)

**Examples:**
```bash
GET /api/agents?status=aktiv
GET /api/agents?companyId=1
GET /api/agents?search=Anna&sort=createdAt&order=desc
```

**Response:**
```json
[
  {
    "_id": "1",
    "name": "Anna",
    "lastName": "Andersson",
    "email": "anna.andersson@era.se",
    "phone": "070-123 45 67",
    "registrationType": "Fastighetsmäklare",
    "company": "ERA Sverige Fastighetsförmedling AB",
    "companyId": "1",
    "brand": "ERA Mäklare",
    "brandId": "mock1",
    "status": "aktiv",
    "brokerPackage": {
      "active": true,
      "startDate": "2024-01-15T..."
    },
    "createdAt": "2024-01-15T...",
    "updatedAt": "2025-12-10T..."
  }
]
```

### GET /api/agents/:id
Get specific agent by ID.

**Response:** Single agent object (same structure as above)

### POST /api/agents
Create new agent.

**Request Body:**
```json
{
  "name": "New",
  "lastName": "Agent",
  "email": "new.agent@company.se",
  "phone": "070-999 88 77",
  "registrationType": "Fastighetsmäklare",
  "companyId": "1",
  "brandId": "mock1",
  "status": "aktiv"
}
```

**Response:** Created agent object with `_id`

### PUT /api/agents/:id
Update existing agent.

**Request Body:** Same as POST (partial updates supported)

**Response:**
```json
{
  "message": "Agent updated successfully"
}
```

### DELETE /api/agents/:id
Delete agent.

**Response:**
```json
{
  "message": "Agent deleted successfully"
}
```

---

## Brands Endpoints

### GET /api/brands
Get all brands.

**Response:**
```json
[
  {
    "_id": "mock1",
    "name": "ERA Mäklare",
    "description": "Internationellt fastighetsmäklarnätverk",
    "website": "https://www.era.se",
    "centralContract": {
      "active": true,
      "mrr": 125000,
      "startDate": "2024-01-01T...",
      "contactPerson": "Anders Svensson",
      "contactEmail": "anders@era.se"
    },
    "createdAt": "2024-01-01T...",
    "updatedAt": "2025-12-10T..."
  }
]
```

### GET /api/brands/:id
Get specific brand by ID.

**Response:** Single brand object (same structure as above)

### GET /api/brands/:id/stats
Get statistics for a specific brand.

**Response:**
```json
{
  "agentCount": 12,
  "companyCount": 1,
  "mrr": 125000,
  "companyId": null
}
```

### POST /api/brands
Create new brand.

**Request Body:**
```json
{
  "name": "New Brand",
  "description": "Description here",
  "website": "https://www.newbrand.se",
  "centralContract": {
    "active": false
  }
}
```

**Response:** Created brand object with `_id`

### PUT /api/brands/:id
Update existing brand.

**Request Body:** Same as POST (partial updates supported)

### DELETE /api/brands/:id
Delete brand.

---

## Search Endpoints

### GET /api/search
Global search across all entities (companies, agents, brands, deals).

**Query Parameters:**
- `q` - Search query (required, min 2 characters)
- `type` - Filter by entity type: `companies`, `agents`, `brands`, `deals`
- `limit` - Max results per type (default: 5)

**Examples:**
```bash
GET /api/search?q=ERA
GET /api/search?q=Anna&type=agents
GET /api/search?q=Mäklare&limit=10
```

**Response:**
```json
{
  "query": "era",
  "totalResults": 3,
  "companies": [
    {
      "_id": "1",
      "name": "ERA Sverige Fastighetsförmedling AB",
      "type": "company",
      "status": "kund",
      "email": "info@era.se",
      "phone": "08-123 45 67",
      "highlight": "<mark>ERA</mark> Sverige Fastighetsförmedling AB"
    }
  ],
  "agents": [
    {
      "_id": "1",
      "name": "Anna Andersson",
      "type": "agent",
      "company": "ERA Sverige Fastighetsförmedling AB",
      "status": "aktiv",
      "highlight": "Anna Andersson"
    }
  ],
  "brands": [
    {
      "_id": "mock1",
      "name": "ERA Mäklare",
      "type": "brand",
      "description": "Internationellt fastighetsmäklarnätverk",
      "highlight": "<mark>ERA</mark> Mäklare"
    }
  ],
  "deals": []
}
```

### GET /api/search/suggestions
Get search suggestions as user types (autocomplete).

**Query Parameters:**
- `q` - Partial search query (required, min 2 characters)
- `limit` - Max suggestions (default: 10)

**Examples:**
```bash
GET /api/search/suggestions?q=An
GET /api/search/suggestions?q=ERA&limit=5
```

**Response:**
```json
{
  "suggestions": [
    "Anna Andersson",
    "ERA Sverige",
    "ERA Mäklare"
  ]
}
```

---

## Export Endpoints

### GET /api/export/companies
Export companies to CSV or JSON format.

**Query Parameters:**
- `format` - Export format: `csv` or `json` (default: `csv`)
- `status` - Filter by status
- `brandId` - Filter by brand

**Examples:**
```bash
GET /api/export/companies
GET /api/export/companies?format=json
GET /api/export/companies?status=kund&format=csv
```

**Response:** File download
- CSV: `companies_2025-12-10.csv`
- JSON: `companies_2025-12-10.json`

**CSV Format:**
```csv
Namn,Org.nr,E-post,Telefon,Status,Varumärke,Antal mäklare,MRR,Senaste kontakt
ERA Sverige Fastighetsförmedling AB,556123-4567,info@era.se,08-123 45 67,kund,ERA Mäklare,12,1649,2025-12-01
```

### GET /api/export/agents
Export agents to CSV or JSON format.

**Query Parameters:**
- `format` - Export format: `csv` or `json` (default: `csv`)
- `status` - Filter by status
- `companyId` - Filter by company

**Examples:**
```bash
GET /api/export/agents
GET /api/export/agents?format=json
GET /api/export/agents?status=aktiv
```

**Response:** File download
- CSV: `agents_2025-12-10.csv`
- JSON: `agents_2025-12-10.json`

**CSV Format:**
```csv
Förnamn,Efternamn,E-post,Telefon,Företag,Varumärke,Status,Registreringstyp
Anna,Andersson,anna.andersson@era.se,070-123 45 67,ERA Sverige Fastighetsförmedling AB,ERA Mäklare,aktiv,Fastighetsmäklare
```

### GET /api/export/dashboard-report
Export comprehensive dashboard report.

**Query Parameters:**
- `format` - Export format: `csv` or `json` (default: `csv`)

**Response:** File download with dashboard summary and brand breakdown

---

## Batch Operations Endpoints

### POST /api/batch/companies/update-status
Update status for multiple companies at once.

**Request Body:**
```json
{
  "companyIds": ["1", "2", "3"],
  "status": "kund"
}
```

**Response:**
```json
{
  "success": true,
  "updated": 3,
  "message": "3 företag uppdaterade till kund"
}
```

### POST /api/batch/agents/update-status
Update status for multiple agents at once.

**Request Body:**
```json
{
  "agentIds": ["1", "2", "3"],
  "status": "aktiv"
}
```

**Response:**
```json
{
  "success": true,
  "updated": 3,
  "message": "3 mäklare uppdaterade till aktiv"
}
```

### POST /api/batch/companies/assign-brand
Assign brand to multiple companies.

**Request Body:**
```json
{
  "companyIds": ["1", "2", "3"],
  "brandId": "mock1"
}
```

**Response:**
```json
{
  "success": true,
  "updated": 3,
  "brandName": "ERA Mäklare",
  "message": "3 företag tilldelade ERA Mäklare"
}
```

### DELETE /api/batch/companies
Delete multiple companies at once.

**Request Body:**
```json
{
  "companyIds": ["1", "2", "3"]
}
```

**Response:**
```json
{
  "success": true,
  "deleted": 3,
  "message": "3 företag borttagna"
}
```

**Note:** Cannot delete companies with associated agents.

### DELETE /api/batch/agents
Delete multiple agents at once.

**Request Body:**
```json
{
  "agentIds": ["1", "2", "3"]
}
```

**Response:**
```json
{
  "success": true,
  "deleted": 3,
  "message": "3 mäklare borttagna"
}
```

---

## Error Responses

All endpoints may return error responses:

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "message": "Name is required"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found",
  "message": "Company not found"
}
```

### 409 Conflict
```json
{
  "error": "Duplicate entry",
  "message": "Ett företag med detta namn finns redan"
}
```

### 500 Internal Server Error
```json
{
  "error": "Server error",
  "message": "Failed to fetch data"
}
```

---

## Authentication

> **Note:** Authentication endpoints will be added when Azure B2C is configured.

Planned endpoints:
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/user`

---

## Pagination

> **Coming Soon:** Large result sets will support pagination.

Planned query parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)

---

## Rate Limiting

> **Coming Soon:** Rate limiting will be implemented for production.

Planned limits:
- 100 requests per minute per IP
- 1000 requests per hour per user

---

## Testing Mode

When `COSMOS_DB_CONNECTION_STRING` is not configured, all endpoints use mock data:
- 5 brands
- 5 companies (3 customers, 2 prospects)
- 5 agents (4 active, 1 inactive)

This allows full testing of the API without database connection.

---

**Last Updated:** December 10, 2025
**API Version:** 1.0
**Base URL:** `http://localhost:3000/api`
