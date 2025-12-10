# Feature Guide - JRM CRM

## 🎯 Complete Feature List

### 1. Dashboard & Analytics
- **Real-time Statistics**: Total brands, companies, agents, MRR
- **Coverage Metrics**: Customer penetration tracking
- **Brand Breakdown**: Detailed per-brand analysis
- **Activity Feed**: Recent contacts and upcoming actions
- **MRR Breakdown**: Revenue distribution by pricing tier

**Endpoints:**
- `GET /api/stats/dashboard`
- `GET /api/stats/overview`
- `GET /api/stats/activity`
- `GET /api/stats/mrr-breakdown`

---

### 2. Company Management
- **CRUD Operations**: Create, read, update, delete companies
- **Advanced Filtering**: By status, brand, search term
- **Sorting**: By name, agent count, last contact
- **Statistics**: Per-company metrics
- **Agent Listing**: View all agents per company

**Endpoints:**
- `GET /api/companies` - List with filters
- `GET /api/companies/:id` - Get single company
- `POST /api/companies` - Create company
- `PUT /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company
- `GET /api/companies/:id/stats` - Company statistics
- `GET /api/companies/:id/agents` - Company's agents

**Filter Examples:**
```bash
# Get all customers
GET /api/companies?status=kund

# Search by name
GET /api/companies?search=ERA

# Filter by brand and sort
GET /api/companies?brandId=mock1&sort=agentCount&order=desc
```

---

### 3. Agent Management
- **CRUD Operations**: Full agent lifecycle management
- **Advanced Filtering**: By status, company, brand
- **Search**: By name, email, or company
- **Broker Package Tracking**: Active/inactive status
- **Company Association**: Automatic linking to companies

**Endpoints:**
- `GET /api/agents` - List with filters
- `GET /api/agents/:id` - Get single agent
- `POST /api/agents` - Create agent
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent

**Filter Examples:**
```bash
# Get active agents only
GET /api/agents?status=aktiv

# Get agents by company
GET /api/agents?companyId=1

# Search agents
GET /api/agents?search=Anna
```

---

### 4. Brand Management
- **Brand Listing**: All registered brands
- **Brand Details**: Individual brand information
- **Central Contracts**: Track central agreements
- **Statistics**: Per-brand metrics
- **Company Count**: How many companies per brand

**Endpoints:**
- `GET /api/brands` - List all brands
- `GET /api/brands/:id` - Get single brand
- `GET /api/brands/:id/stats` - Brand statistics
- `POST /api/brands` - Create brand
- `PUT /api/brands/:id` - Update brand
- `DELETE /api/brands/:id` - Delete brand

---

### 5. Global Search 🆕
- **Multi-Entity Search**: Search across companies, agents, brands, deals
- **Highlighting**: Visual indicators of matched terms
- **Type Filtering**: Narrow results to specific entity types
- **Result Limits**: Control number of results per type

**Endpoints:**
- `GET /api/search?q={query}` - Main search
- `GET /api/search/suggestions?q={query}` - Autocomplete

**Examples:**
```bash
# Search everything
GET /api/search?q=ERA

# Search only agents
GET /api/search?q=Anna&type=agents

# Get autocomplete suggestions
GET /api/search/suggestions?q=Er
```

**Response Structure:**
```json
{
  "query": "era",
  "totalResults": 3,
  "companies": [...],
  "agents": [...],
  "brands": [...],
  "deals": []
}
```

---

### 6. Data Export 🆕
- **CSV Export**: Excel-compatible format with UTF-8 BOM
- **JSON Export**: Structured data for integration
- **Filtered Export**: Export specific subsets
- **Dashboard Reports**: Complete analytics export

**Endpoints:**
- `GET /api/export/companies` - Export companies
- `GET /api/export/agents` - Export agents
- `GET /api/export/dashboard-report` - Export full report

**Examples:**
```bash
# Export all companies to CSV
GET /api/export/companies

# Export customers only to JSON
GET /api/export/companies?status=kund&format=json

# Export active agents
GET /api/export/agents?status=aktiv

# Export dashboard report
GET /api/export/dashboard-report
```

**CSV Features:**
- UTF-8 encoding with BOM (Excel compatible)
- Automatic escaping of special characters
- Swedish headers
- Date formatting

---

### 7. Batch Operations 🆕
- **Mass Status Updates**: Update multiple entities at once
- **Bulk Brand Assignment**: Assign brand to multiple companies
- **Mass Deletion**: Delete multiple entities (with safety checks)
- **Efficiency**: Single API call for multiple changes

**Endpoints:**
- `POST /api/batch/companies/update-status`
- `POST /api/batch/agents/update-status`
- `POST /api/batch/companies/assign-brand`
- `DELETE /api/batch/companies`
- `DELETE /api/batch/agents`

**Examples:**

**Update multiple companies to customer status:**
```bash
POST /api/batch/companies/update-status
{
  "companyIds": ["1", "2", "3"],
  "status": "kund"
}
```

**Activate multiple agents:**
```bash
POST /api/batch/agents/update-status
{
  "agentIds": ["1", "2", "3"],
  "status": "aktiv"
}
```

**Assign brand to multiple companies:**
```bash
POST /api/batch/companies/assign-brand
{
  "companyIds": ["1", "2", "3"],
  "brandId": "mock1"
}
```

**Delete multiple agents:**
```bash
DELETE /api/batch/agents
{
  "agentIds": ["1", "2", "3"]
}
```

**Safety Features:**
- Cannot delete companies with agents
- Validation of all IDs
- Rollback on errors
- Clear success/failure messages

---

### 8. Deals Management
- **Pipeline Tracking**: Deal stages and progress
- **Value Tracking**: Deal amounts and forecasting
- **Contact Information**: Associated contacts per deal
- **Status Management**: Open, won, lost deals

**Endpoints:**
- `GET /api/deals`
- `POST /api/deals`
- `PUT /api/deals/:id`
- `DELETE /api/deals/:id`

---

### 9. Tasks Management
- **Task Creation**: Assign tasks to users
- **Due Dates**: Track deadlines
- **Status Updates**: Todo, in progress, done
- **Priority Levels**: High, medium, low

**Endpoints:**
- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

---

### 10. Import & Sync
- **Data Import**: Bulk import from external sources
- **Server Import**: Import from Visma.net
- **Validation**: Data quality checks
- **Conflict Resolution**: Handle duplicates

**Endpoints:**
- `POST /api/import`
- `POST /api/import/server`

---

## 🔄 Common Workflows

### Workflow 1: Onboarding New Customer
1. Create company: `POST /api/companies`
2. Create agents: `POST /api/agents` (for each agent)
3. Assign brand: `POST /api/batch/companies/assign-brand`
4. Update status: `POST /api/batch/companies/update-status`
5. View dashboard: `GET /api/stats/dashboard`

### Workflow 2: Bulk Status Update
1. Search companies: `GET /api/companies?status=prospekt`
2. Select companies in UI
3. Update status: `POST /api/batch/companies/update-status`
4. Verify changes: `GET /api/companies?status=kund`

### Workflow 3: Export Customer List
1. Filter customers: `GET /api/companies?status=kund`
2. Export to CSV: `GET /api/export/companies?status=kund`
3. Open in Excel
4. Send to stakeholders

### Workflow 4: Search and Edit
1. Search: `GET /api/search?q=ERA`
2. Get details: `GET /api/companies/:id`
3. Update: `PUT /api/companies/:id`
4. Verify: `GET /api/companies/:id`

---

## 🎨 Frontend Integration Examples

### Dashboard Widget
```javascript
async function loadDashboardWidget() {
  const stats = await fetch('/api/stats/overview').then(r => r.json());
  
  document.getElementById('totalCompanies').textContent = stats.companies.total;
  document.getElementById('totalAgents').textContent = stats.agents.total;
  document.getElementById('totalMRR').textContent = `${Math.round(stats.mrr.total / 1000)}k kr`;
}
```

### Search Bar with Autocomplete
```javascript
const searchInput = document.getElementById('search');
searchInput.addEventListener('input', async (e) => {
  const query = e.target.value;
  if (query.length < 2) return;
  
  const { suggestions } = await fetch(`/api/search/suggestions?q=${query}`)
    .then(r => r.json());
  
  showSuggestions(suggestions);
});
```

### Export Button
```javascript
function exportCompanies() {
  const status = document.getElementById('statusFilter').value;
  const url = `/api/export/companies?status=${status}`;
  window.open(url, '_blank');
}
```

### Batch Selection
```javascript
function updateSelectedCompanies() {
  const selectedIds = getSelectedCompanyIds();
  const newStatus = document.getElementById('newStatus').value;
  
  fetch('/api/batch/companies/update-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyIds: selectedIds, status: newStatus })
  })
  .then(r => r.json())
  .then(result => {
    showNotification(result.message, 'success');
    refreshCompanyList();
  });
}
```

---

## 📊 Data Model Reference

### Company Object
```json
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
  "lastContact": "2025-12-01T00:00:00.000Z",
  "nextAction": "Uppföljning Q1 2026",
  "createdAt": "2024-01-15T00:00:00.000Z",
  "updatedAt": "2025-12-10T00:00:00.000Z"
}
```

### Agent Object
```json
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
    "startDate": "2024-01-15T00:00:00.000Z"
  },
  "createdAt": "2024-01-15T00:00:00.000Z",
  "updatedAt": "2025-12-10T00:00:00.000Z"
}
```

### Brand Object
```json
{
  "_id": "mock1",
  "name": "ERA Mäklare",
  "description": "Internationellt fastighetsmäklarnätverk",
  "website": "https://www.era.se",
  "centralContract": {
    "active": true,
    "mrr": 125000,
    "startDate": "2024-01-01T00:00:00.000Z",
    "contactPerson": "Anders Svensson",
    "contactEmail": "anders@era.se"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2025-12-10T00:00:00.000Z"
}
```

---

## 🚀 Performance Tips

1. **Use Filtering**: Always filter on backend, not frontend
2. **Limit Results**: Use `limit` parameter for large datasets
3. **Batch Operations**: Use batch endpoints instead of loops
4. **Export Wisely**: Export only needed data with filters
5. **Cache Stats**: Dashboard stats can be cached for 5-15 minutes

---

## 🔐 Security Notes

- All endpoints require authentication (when Azure B2C is configured)
- Rate limiting is applied (100 req/min per IP)
- Input validation on all POST/PUT requests
- SQL injection protection via parameterized queries
- XSS protection via output escaping

---

**Last Updated:** December 10, 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
