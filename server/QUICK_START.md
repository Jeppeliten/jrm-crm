# JRM CRM - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js v16+ installed
- PowerShell (Windows) or Bash (Linux/Mac)

### Installation
```bash
cd C:\Repos\JRM\server
npm install
```

### Starting the Server
```bash
node index.js
```

Server starts on **http://localhost:3000**

### Testing Mode
The server runs in **test mode** with mock data when no database is configured. This allows you to:
- Test all API endpoints
- Develop frontend features
- Demo the system
- No database setup required!

---

## 📊 Key Endpoints

### Dashboard Stats
```bash
GET http://localhost:3000/api/stats/dashboard
```
Returns: Comprehensive statistics with brand breakdown

### Overview Stats
```bash
GET http://localhost:3000/api/stats/overview
```
Returns: Quick summary (companies, agents, brands, MRR)

### Recent Activity
```bash
GET http://localhost:3000/api/stats/activity
```
Returns: Recent contacts and upcoming actions

### Companies (with filtering)
```bash
GET http://localhost:3000/api/companies
GET http://localhost:3000/api/companies?status=kund
GET http://localhost:3000/api/companies?search=ERA
GET http://localhost:3000/api/companies?sort=agentCount&order=desc
```

### Agents (with filtering)
```bash
GET http://localhost:3000/api/agents
GET http://localhost:3000/api/agents?status=aktiv
GET http://localhost:3000/api/agents?companyId=1
GET http://localhost:3000/api/agents?search=Anna
```

### Brands
```bash
GET http://localhost:3000/api/brands
GET http://localhost:3000/api/brands/:id
GET http://localhost:3000/api/brands/:id/stats
```

---

## 🧪 Mock Data

### Brands (5)
- ERA Mäklare (central contract, MRR: 125k)
- Mäklarhuset
- Svensk Fastighetsförmedling
- Fastighetsbyrån (central contract, MRR: 85k)
- Notar

### Companies (5)
- 3 customers (kund)
- 2 prospects (prospekt)
- Total agents: 51
- Total MRR: 211,249 kr/mån

### Agents (5)
- 4 active agents
- 1 inactive agent
- Linked to companies and brands

---

## 🔧 Testing with PowerShell

### Test All Endpoints
```powershell
# Dashboard
Invoke-RestMethod "http://localhost:3000/api/stats/dashboard" | ConvertTo-Json

# Overview
Invoke-RestMethod "http://localhost:3000/api/stats/overview" | ConvertTo-Json

# Companies
Invoke-RestMethod "http://localhost:3000/api/companies" | Select-Object name, status, agentCount | Format-Table

# Filter companies
Invoke-RestMethod "http://localhost:3000/api/companies?status=kund" | Format-Table

# Agents
Invoke-RestMethod "http://localhost:3000/api/agents" | Select-Object name, lastName, company | Format-Table

# Search
Invoke-RestMethod "http://localhost:3000/api/companies?search=ERA" | Format-Table
```

### Create New Company
```powershell
$body = @{
    name = "Test Företag AB"
    email = "info@test.se"
    status = "prospekt"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/companies" -Method POST -Body $body -ContentType "application/json"
```

---

## 📱 Client Integration

### Fetch Dashboard Data
```javascript
async function loadDashboard() {
  const stats = await fetchWithAuth('/api/stats/dashboard');
  
  // Update UI
  document.getElementById('metricCoverage').textContent = `${stats.coverage}%`;
  document.getElementById('metricBrands').textContent = stats.totalBrands;
  document.getElementById('metricCompanies').textContent = stats.totalCompanies;
  document.getElementById('metricAgents').textContent = stats.totalAgents;
  document.getElementById('metricTotalMRR').textContent = `${Math.round(stats.totalMRR / 1000)}k kr/mån`;
}
```

### Fetch Companies with Filter
```javascript
async function loadCompanies(status) {
  const url = status 
    ? `/api/companies?status=${status}` 
    : '/api/companies';
  
  const companies = await fetchWithAuth(url);
  renderCompaniesTable(companies);
}
```

### Search Companies
```javascript
async function searchCompanies(searchTerm) {
  const companies = await fetchWithAuth(`/api/companies?search=${searchTerm}`);
  renderCompaniesTable(companies);
}
```

---

## 🔄 Database Configuration (Optional)

To use real database instead of mock data:

1. Create `.env` file:
```env
COSMOS_DB_CONNECTION_STRING=your_connection_string_here
AZURE_B2C_CLIENT_ID=your_client_id
AZURE_B2C_TENANT_NAME=your_tenant
```

2. Restart server:
```bash
node index.js
```

Server will automatically switch from mock data to database.

---

## 📚 Documentation

Detailed documentation available in:

- **API Endpoints:** `docs/api/API_ENDPOINTS.md`
- **Dashboard Implementation:** `docs/DASHBOARD_IMPLEMENTATION.md`
- **Architecture:** `docs/architecture/`
- **Security:** `docs/security/`

---

## 🧪 Health Check

Check if server is running:
```bash
GET http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-10T10:00:00.000Z",
  "database": "mock",
  "version": "1.0.0"
}
```

---

## 🎯 Next Steps

### Immediate
1. ✅ Test all endpoints with Postman or browser
2. ✅ Integrate with frontend client
3. ✅ Customize mock data as needed

### Future
1. Configure Azure Cosmos DB
2. Set up Azure B2C authentication
3. Deploy to Azure App Service
4. Configure CI/CD pipeline

---

## 🆘 Troubleshooting

### Port Already in Use
```powershell
# Stop all node processes
Get-Process -Name node | Stop-Process -Force

# Restart server
node index.js
```

### Server Won't Start
1. Check Node.js version: `node --version` (should be v16+)
2. Reinstall dependencies: `npm install`
3. Check for syntax errors: `npm run lint` (if configured)

### Mock Data Not Loading
- Verify you're NOT using `.env` file (for test mode)
- Check console output for "running in test mode" message
- Try `http://localhost:3000/api/test` endpoint

---

## 💡 Tips

1. **Use PowerShell ISE** for easier testing with multi-line commands
2. **Keep server running** in separate terminal while developing
3. **Check console logs** for detailed request/response info
4. **Use browser DevTools** Network tab to debug API calls
5. **Test filters** with different combinations for robust UI

---

## 📞 Support

For questions or issues:
1. Check documentation in `docs/` folder
2. Review console logs for errors
3. Test endpoints with Postman/curl
4. Verify mock data is loaded correctly

---

**Happy coding! 🚀**

---

**Last Updated:** December 10, 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready (Test Mode)
