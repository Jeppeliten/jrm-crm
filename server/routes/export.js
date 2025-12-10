const express = require('express');
const router = express.Router();

/**
 * GET /api/export/companies - Export companies to CSV/JSON
 * Query params:
 *   - format: csv or json (default: csv)
 *   - status: Filter by status
 *   - brandId: Filter by brand
 */
router.get('/companies', async (req, res) => {
  try {
    const { format = 'csv', status, brandId } = req.query;
    const db = req.app.locals.db;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (brandId) query.brandId = brandId;

    let companies;
    if (!db) {
      // Mock data
      const mockCompanies = require('./companies').mockCompanies || [];
      companies = mockCompanies.filter(c => {
        if (status && c.status !== status) return false;
        if (brandId && c.brandId !== brandId) return false;
        return true;
      });
    } else {
      companies = await db.collection('companies_v2').find(query).toArray();
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="companies_${new Date().toISOString().split('T')[0]}.json"`);
      return res.json(companies);
    }

    // CSV format
    const headers = ['Namn', 'Org.nr', 'E-post', 'Telefon', 'Status', 'Varumärke', 'Antal mäklare', 'MRR', 'Senaste kontakt'];
    const rows = companies.map(c => [
      escapeCSV(c.name),
      escapeCSV(c.orgNumber || ''),
      escapeCSV(c.email || ''),
      escapeCSV(c.phone || ''),
      escapeCSV(c.status || ''),
      escapeCSV(c.brand || ''),
      c.agentCount || 0,
      c.payment || 0,
      c.lastContact ? new Date(c.lastContact).toISOString().split('T')[0] : ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="companies_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 support

  } catch (error) {
    console.error('Error exporting companies:', error);
    res.status(500).json({ 
      error: 'Export failed',
      message: error.message 
    });
  }
});

/**
 * GET /api/export/agents - Export agents to CSV/JSON
 * Query params:
 *   - format: csv or json (default: csv)
 *   - status: Filter by status
 *   - companyId: Filter by company
 */
router.get('/agents', async (req, res) => {
  try {
    const { format = 'csv', status, companyId } = req.query;
    const db = req.app.locals.db;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (companyId) query.companyId = companyId;

    let agents;
    if (!db) {
      // Mock data
      const mockAgents = require('./agents').mockAgents || [];
      agents = mockAgents.filter(a => {
        if (status && a.status !== status) return false;
        if (companyId && a.companyId !== companyId) return false;
        return true;
      });
    } else {
      agents = await db.collection('agents_v2').find(query).toArray();
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="agents_${new Date().toISOString().split('T')[0]}.json"`);
      return res.json(agents);
    }

    // CSV format
    const headers = ['Förnamn', 'Efternamn', 'E-post', 'Telefon', 'Företag', 'Varumärke', 'Status', 'Registreringstyp'];
    const rows = agents.map(a => [
      escapeCSV(a.name),
      escapeCSV(a.lastName || ''),
      escapeCSV(a.email || ''),
      escapeCSV(a.phone || ''),
      escapeCSV(a.company || ''),
      escapeCSV(a.brand || ''),
      escapeCSV(a.status || ''),
      escapeCSV(a.registrationType || '')
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="agents_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv);

  } catch (error) {
    console.error('Error exporting agents:', error);
    res.status(500).json({ 
      error: 'Export failed',
      message: error.message 
    });
  }
});

/**
 * GET /api/export/dashboard-report - Export comprehensive dashboard report
 * Query params:
 *   - format: xlsx or pdf (default: xlsx)
 */
router.get('/dashboard-report', async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    const db = req.app.locals.db;

    // Get dashboard stats
    const statsResponse = await fetch('http://localhost:3000/api/stats/dashboard');
    const stats = await statsResponse.json();

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="dashboard_report_${new Date().toISOString().split('T')[0]}.json"`);
      return res.json(stats);
    }

    // CSV format - Brand breakdown table
    const headers = ['Varumärke', 'Företag', 'Mäklare', 'MRR (kr)', 'Status', 'Central avtal'];
    const rows = stats.brandBreakdown.map(b => [
      escapeCSV(b.brandName),
      b.companyCount,
      b.agentCount,
      Math.round(b.mrr),
      escapeCSV(b.status),
      b.centralContract ? 'Ja' : 'Nej'
    ]);

    const summaryRows = [
      ['SAMMANFATTNING'],
      ['Total varumärken', stats.totalBrands],
      ['Total företag', stats.totalCompanies],
      ['Total mäklare', stats.totalAgents],
      ['Aktiva licenser', stats.activeLicenses],
      ['Täckningsgrad', `${stats.coverage}%`],
      ['Total MRR', `${Math.round(stats.totalMRR)} kr`],
      ['Potential', `${Math.round(stats.potential)} kr`],
      [''],
      ['VARUMÄRKESÖVERSIKT']
    ];

    const csv = [
      ...summaryRows.map(r => r.join(',')),
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dashboard_report_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv);

  } catch (error) {
    console.error('Error exporting dashboard report:', error);
    res.status(500).json({ 
      error: 'Export failed',
      message: error.message 
    });
  }
});

/**
 * Helper function to escape CSV values
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

module.exports = router;
