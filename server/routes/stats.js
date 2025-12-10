/**
 * Stats Routes
 * Endpoints for dashboard statistics and analytics
 */

const express = require('express');
const router = express.Router();

/**
 * Calculate MRR based on agent count
 * Pricing tiers:
 * 4-6 agents: 849 kr/mån
 * 7-10 agents: 1249 kr/mån
 * 11-15 agents: 1649 kr/mån
 * 16-20 agents: 1999 kr/mån
 * 21+ agents: 2449 kr/mån
 */
function calculateMRR(agentCount) {
  if (agentCount >= 21) return 2449;
  if (agentCount >= 16) return 1999;
  if (agentCount >= 11) return 1649;
  if (agentCount >= 7) return 1249;
  if (agentCount >= 4) return 849;
  return 0;
}

/**
 * GET /api/stats/dashboard
 * Returns comprehensive dashboard statistics
 */
router.get('/dashboard', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    if (!db) {
      // Mock data for testing without database - now with realistic data
      const mockBrands = [
        { _id: 'mock1', name: 'ERA Mäklare', centralContract: { active: true, mrr: 125000 } },
        { _id: 'mock2', name: 'Mäklarhuset', centralContract: { active: false } },
        { _id: 'mock3', name: 'Svensk Fastighetsförmedling', centralContract: { active: false } },
        { _id: 'mock4', name: 'Fastighetsbyrån', centralContract: { active: true, mrr: 85000 } },
        { _id: 'mock5', name: 'Notar', centralContract: { active: false } }
      ];
      
      const mockCompanies = [
        { _id: '1', status: 'kund', brandId: 'mock1', payment: 1649, agentCount: 12 },
        { _id: '2', status: 'kund', brandId: 'mock2', payment: 1249, agentCount: 8 },
        { _id: '3', status: 'prospekt', brandId: 'mock3', payment: 0, agentCount: 15 },
        { _id: '4', status: 'kund', brandId: 'mock4', payment: 849, agentCount: 6 },
        { _id: '5', status: 'prospekt', brandId: 'mock5', payment: 0, agentCount: 10 }
      ];
      
      const totalBrands = mockBrands.length;
      const totalCompanies = mockCompanies.length;
      const totalAgents = mockCompanies.reduce((sum, c) => sum + c.agentCount, 0);
      const customerCompanies = mockCompanies.filter(c => c.status === 'kund').length;
      const activeLicenses = mockCompanies.filter(c => c.status === 'kund').reduce((sum, c) => sum + c.agentCount, 0);
      const coverage = Math.round((customerCompanies / totalCompanies) * 100);
      
      // Calculate brand breakdown
      const brandBreakdown = mockBrands.map(brand => {
        const brandCompanies = mockCompanies.filter(c => c.brandId === brand._id);
        const companyCount = brandCompanies.length;
        const agentCount = brandCompanies.reduce((sum, c) => sum + c.agentCount, 0);
        
        // Calculate MRR
        let mrr = 0;
        if (brand.centralContract?.active && brand.centralContract?.mrr) {
          mrr = brand.centralContract.mrr;
        } else {
          mrr = brandCompanies.reduce((sum, c) => sum + c.payment, 0);
        }
        
        // Determine status
        const customerCount = brandCompanies.filter(c => c.status === 'kund').length;
        let status = 'prospekt';
        if (brand.centralContract?.active) {
          status = 'kund';
        } else if (customerCount === companyCount && companyCount > 0) {
          status = 'kund';
        } else if (customerCount > 0) {
          status = 'blandad';
        }
        
        return {
          brandId: brand._id,
          brandName: brand.name,
          companyCount,
          agentCount,
          mrr,
          status,
          centralContract: brand.centralContract?.active || false
        };
      });
      
      const totalMRR = brandBreakdown.reduce((sum, b) => sum + b.mrr, 0);
      const prospektCompanies = mockCompanies.filter(c => c.status === 'prospekt').length;
      const avgMRRPerCompany = customerCompanies > 0 ? totalMRR / customerCompanies : 1649;
      const potential = Math.round(prospektCompanies * avgMRRPerCompany);
      
      return res.json({
        totalBrands,
        totalCompanies,
        totalAgents,
        activeLicenses,
        coverage,
        totalMRR,
        potential,
        brandBreakdown: brandBreakdown.sort((a, b) => b.agentCount - a.agentCount),
        timestamp: new Date()
      });
    }

    // Fetch data from collections
    const [brands, companies, agents] = await Promise.all([
      db.collection('brands_v2').find({}).toArray(),
      db.collection('companies_v2').find({}).toArray(),
      db.collection('agents_v2').find({}).toArray()
    ]);

    // Calculate metrics
    const totalBrands = brands.length;
    const totalCompanies = companies.length;
    const totalAgents = agents.length;
    
    // Active licenses = agents with active status
    const activeLicenses = agents.filter(a => 
      a.status === 'aktiv' || 
      a.status === 'active' ||
      a.brokerPackage?.active === true
    ).length;

    // Customer companies (status = kund)
    const customerCompanies = companies.filter(c => 
      c.status === 'kund' || c.status === 'customer'
    ).length;

    // Coverage percentage
    const coverage = totalCompanies > 0 
      ? Math.round((customerCompanies / totalCompanies) * 100) 
      : 0;

    // Brand breakdown with aggregated stats
    const brandBreakdown = brands.map(brand => {
      // Companies under this brand
      const brandCompanies = companies.filter(c => 
        c.brandId === brand._id || 
        c.brand === brand.name
      );
      
      const companyCount = brandCompanies.length;
      
      // Agents under these companies
      const brandAgents = agents.filter(a => {
        return brandCompanies.some(c => 
          a.companyId === c._id || 
          a.company === c.name
        );
      });
      
      const agentCount = brandAgents.length;
      
      // Calculate MRR for this brand
      // If central contract exists, use that. Otherwise sum up company MRRs
      let mrr = 0;
      if (brand.centralContract?.active && brand.centralContract?.mrr) {
        mrr = brand.centralContract.mrr;
      } else {
        // Sum up MRR from all companies under brand
        mrr = brandCompanies.reduce((sum, company) => {
          // Use company's payment field or calculate from agents
          if (company.payment) {
            return sum + company.payment;
          }
          // Calculate based on agent count for this company
          const companyAgents = brandAgents.filter(a => 
            a.companyId === company._id || a.company === company.name
          );
          return sum + calculateMRR(companyAgents.length);
        }, 0);
      }

      // Determine overall status
      const customerCount = brandCompanies.filter(c => 
        c.status === 'kund' || c.status === 'customer'
      ).length;
      
      let status = 'prospekt';
      if (brand.centralContract?.active) {
        status = 'kund';
      } else if (customerCount === companyCount && companyCount > 0) {
        status = 'kund';
      } else if (customerCount > 0) {
        status = 'blandad';
      }

      return {
        brandId: brand._id,
        brandName: brand.name,
        companyCount,
        agentCount,
        mrr,
        status,
        centralContract: brand.centralContract?.active || false
      };
    });

    // Sort by agent count descending
    brandBreakdown.sort((a, b) => b.agentCount - a.agentCount);

    // Calculate total MRR
    const totalMRR = brandBreakdown.reduce((sum, b) => sum + b.mrr, 0);

    // Calculate potential (prospekt companies * average MRR)
    const prospektCompanies = companies.filter(c => 
      c.status === 'prospekt' || c.status === 'prospect'
    ).length;
    const avgMRRPerCompany = customerCompanies > 0 ? totalMRR / customerCompanies : 1649;
    const potential = Math.round(prospektCompanies * avgMRRPerCompany);

    res.json({
      totalBrands,
      totalCompanies,
      totalAgents,
      activeLicenses,
      coverage,
      totalMRR,
      potential,
      brandBreakdown,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics',
      message: error.message 
    });
  }
});

/**
 * GET /api/stats/mrr-breakdown
 * Returns MRR breakdown by pricing tier
 */
router.get('/mrr-breakdown', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    if (!db) {
      return res.json({
        tiers: [
          { range: '4-6', price: 849, companies: 5, total: 4245 },
          { range: '7-10', price: 1249, companies: 8, total: 9992 },
          { range: '11-15', price: 1649, companies: 12, total: 19788 },
          { range: '16-20', price: 1999, companies: 7, total: 13993 },
          { range: '21+', price: 2449, companies: 3, total: 7347 }
        ]
      });
    }

    const companies = await db.collection('companies_v2').find({}).toArray();
    const agents = await db.collection('agents_v2').find({}).toArray();

    const tiers = [
      { range: '4-6', price: 849, companies: [], total: 0 },
      { range: '7-10', price: 1249, companies: [], total: 0 },
      { range: '11-15', price: 1649, companies: [], total: 0 },
      { range: '16-20', price: 1999, companies: [], total: 0 },
      { range: '21+', price: 2449, companies: [], total: 0 }
    ];

    // Calculate for each company
    companies.forEach(company => {
      const companyAgents = agents.filter(a => 
        a.companyId === company._id || a.company === company.name
      );
      const agentCount = companyAgents.length;
      const mrr = calculateMRR(agentCount);

      if (mrr > 0) {
        let tierIndex = 0;
        if (agentCount >= 21) tierIndex = 4;
        else if (agentCount >= 16) tierIndex = 3;
        else if (agentCount >= 11) tierIndex = 2;
        else if (agentCount >= 7) tierIndex = 1;
        else if (agentCount >= 4) tierIndex = 0;

        tiers[tierIndex].companies.push(company.name);
        tiers[tierIndex].total += mrr;
      }
    });

    // Format response
    const breakdown = tiers.map(tier => ({
      range: tier.range,
      price: tier.price,
      companies: tier.companies.length,
      total: tier.total
    }));

    res.json({ tiers: breakdown });

  } catch (error) {
    console.error('Error fetching MRR breakdown:', error);
    res.status(500).json({ 
      error: 'Failed to fetch MRR breakdown',
      message: error.message 
    });
  }
});

/**
 * GET /api/stats/overview
 * Returns quick overview stats for header/summary display
 */
router.get('/overview', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    if (!db) {
      return res.json({
        companies: { total: 5, customers: 3, prospects: 2 },
        agents: { total: 51, active: 26 },
        brands: { total: 5, withCentralContract: 2 },
        mrr: { total: 211249, growth: 12.5 }
      });
    }

    const [companies, agents, brands] = await Promise.all([
      db.collection('companies_v2').find({}).toArray(),
      db.collection('agents_v2').find({}).toArray(),
      db.collection('brands_v2').find({}).toArray()
    ]);

    const totalCompanies = companies.length;
    const customerCompanies = companies.filter(c => c.status === 'kund' || c.status === 'customer').length;
    const prospectCompanies = totalCompanies - customerCompanies;

    const totalAgents = agents.length;
    const activeAgents = agents.filter(a => 
      a.status === 'aktiv' || a.status === 'active' || a.brokerPackage?.active === true
    ).length;

    const totalBrands = brands.length;
    const brandsWithCentralContract = brands.filter(b => b.centralContract?.active).length;

    // Calculate total MRR
    let totalMRR = 0;
    brands.forEach(brand => {
      if (brand.centralContract?.active && brand.centralContract?.mrr) {
        totalMRR += brand.centralContract.mrr;
      }
    });
    companies.forEach(company => {
      if (company.payment && !company.brandCentralContract) {
        totalMRR += company.payment;
      }
    });

    res.json({
      companies: { total: totalCompanies, customers: customerCompanies, prospects: prospectCompanies },
      agents: { total: totalAgents, active: activeAgents },
      brands: { total: totalBrands, withCentralContract: brandsWithCentralContract },
      mrr: { total: totalMRR, growth: 0 }
    });

  } catch (error) {
    console.error('Error fetching overview stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch overview stats',
      message: error.message 
    });
  }
});

/**
 * GET /api/stats/activity
 * Returns recent activity and upcoming actions
 */
router.get('/activity', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    if (!db) {
      return res.json({
        recentContacts: [
          { companyName: 'Fastighetsbyrån Malmö City', date: new Date('2025-12-05'), type: 'meeting' },
          { companyName: 'ERA Sverige Fastighetsförmedling AB', date: new Date('2025-12-01'), type: 'call' }
        ],
        upcomingActions: [
          { companyName: 'Svensk Fastighetsförmedling Göteborg', action: 'Demo-möte bokad 15 dec', date: new Date('2025-12-15') },
          { companyName: 'ERA Sverige Fastighetsförmedling AB', action: 'Uppföljning Q1 2026', date: new Date('2026-01-15') }
        ]
      });
    }

    const companies = await db.collection('companies_v2')
      .find({ lastContact: { $exists: true } })
      .sort({ lastContact: -1 })
      .limit(10)
      .toArray();

    const recentContacts = companies.map(c => ({
      companyId: c._id,
      companyName: c.name,
      date: c.lastContact,
      type: c.lastContactType || 'contact'
    }));

    const upcomingCompanies = await db.collection('companies_v2')
      .find({ nextAction: { $exists: true, $ne: null } })
      .sort({ nextActionDate: 1 })
      .limit(10)
      .toArray();

    const upcomingActions = upcomingCompanies.map(c => ({
      companyId: c._id,
      companyName: c.name,
      action: c.nextAction,
      date: c.nextActionDate
    }));

    res.json({ recentContacts, upcomingActions });

  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({
      error: 'Failed to fetch activity',
      message: error.message
    });
  }
});

/**
 * GET /api/stats/customer-success - Customer Success Dashboard metrics
 * Returns churn risk, health scores, adoption tracking, at-risk customers
 */
router.get('/customer-success', async (req, res) => {
  try {
    const db = req.app.locals.db;

    if (!db) {
      // Mock mode - calculate from mock companies
      const mockCompanies = require('./companies').mockCompanies || [];
      
      // Calculate health scores for each company
      const companiesWithHealth = mockCompanies
        .filter(c => c.status === 'kund')
        .map(company => {
          const health = calculateHealthScore(company);
          return {
            _id: company._id,
            name: company.name,
            brand: company.brand,
            agentCount: company.agentCount,
            mrr: company.payment * company.agentCount * 12 || 0,
            lastContact: company.lastContact,
            healthScore: health.score,
            healthStatus: health.status,
            churnRisk: health.churnRisk,
            riskFactors: health.riskFactors,
            daysSinceContact: health.daysSinceContact
          };
        });

      // Sort by health score (lowest first - most at risk)
      const atRiskCompanies = companiesWithHealth
        .filter(c => c.churnRisk === 'high' || c.churnRisk === 'medium')
        .sort((a, b) => a.healthScore - b.healthScore)
        .slice(0, 10);

      // Calculate summary metrics
      const totalCustomers = companiesWithHealth.length;
      const highRisk = companiesWithHealth.filter(c => c.churnRisk === 'high').length;
      const mediumRisk = companiesWithHealth.filter(c => c.churnRisk === 'medium').length;
      const healthy = companiesWithHealth.filter(c => c.churnRisk === 'low').length;
      
      const avgHealthScore = Math.round(
        companiesWithHealth.reduce((sum, c) => sum + c.healthScore, 0) / totalCustomers
      );

      const totalMRR = companiesWithHealth.reduce((sum, c) => sum + c.mrr, 0);
      const atRiskMRR = atRiskCompanies.reduce((sum, c) => sum + c.mrr, 0);

      return res.json({
        summary: {
          totalCustomers,
          highRisk,
          mediumRisk,
          healthy,
          avgHealthScore,
          totalMRR: Math.round(totalMRR),
          atRiskMRR: Math.round(atRiskMRR)
        },
        atRiskCompanies,
        healthDistribution: [
          { status: 'healthy', count: healthy, percentage: Math.round((healthy / totalCustomers) * 100) },
          { status: 'medium', count: mediumRisk, percentage: Math.round((mediumRisk / totalCustomers) * 100) },
          { status: 'high', count: highRisk, percentage: Math.round((highRisk / totalCustomers) * 100) }
        ]
      });
    }

    // Database mode
    const customers = await db.collection('companies_v2')
      .find({ status: 'kund' })
      .toArray();

    const companiesWithHealth = customers.map(company => {
      const health = calculateHealthScore(company);
      return {
        _id: company._id,
        name: company.name,
        brand: company.brand,
        agentCount: company.agentCount,
        mrr: company.mrr || 0,
        lastContact: company.lastContact,
        healthScore: health.score,
        healthStatus: health.status,
        churnRisk: health.churnRisk,
        riskFactors: health.riskFactors,
        daysSinceContact: health.daysSinceContact
      };
    });

    const atRiskCompanies = companiesWithHealth
      .filter(c => c.churnRisk === 'high' || c.churnRisk === 'medium')
      .sort((a, b) => a.healthScore - b.healthScore)
      .slice(0, 10);

    const totalCustomers = companiesWithHealth.length;
    const highRisk = companiesWithHealth.filter(c => c.churnRisk === 'high').length;
    const mediumRisk = companiesWithHealth.filter(c => c.churnRisk === 'medium').length;
    const healthy = companiesWithHealth.filter(c => c.churnRisk === 'low').length;
    
    const avgHealthScore = Math.round(
      companiesWithHealth.reduce((sum, c) => sum + c.healthScore, 0) / totalCustomers
    );

    const totalMRR = companiesWithHealth.reduce((sum, c) => sum + c.mrr, 0);
    const atRiskMRR = atRiskCompanies.reduce((sum, c) => sum + c.mrr, 0);

    res.json({
      summary: {
        totalCustomers,
        highRisk,
        mediumRisk,
        healthy,
        avgHealthScore,
        totalMRR: Math.round(totalMRR),
        atRiskMRR: Math.round(atRiskMRR)
      },
      atRiskCompanies,
      healthDistribution: [
        { status: 'healthy', count: healthy, percentage: Math.round((healthy / totalCustomers) * 100) },
        { status: 'medium', count: mediumRisk, percentage: Math.round((mediumRisk / totalCustomers) * 100) },
        { status: 'high', count: highRisk, percentage: Math.round((highRisk / totalCustomers) * 100) }
      ]
    });

  } catch (error) {
    console.error('Error fetching customer success metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch customer success metrics',
      message: error.message
    });
  }
});

/**
 * Calculate health score for a company
 * Factors: last contact date, agent count, MRR, next action presence
 */
function calculateHealthScore(company) {
  let score = 100;
  const riskFactors = [];
  
  // Factor 1: Days since last contact
  const now = new Date();
  const lastContact = company.lastContact ? new Date(company.lastContact) : null;
  const daysSinceContact = lastContact 
    ? Math.floor((now - lastContact) / (1000 * 60 * 60 * 24))
    : 999;
  
  if (daysSinceContact > 90) {
    score -= 40;
    riskFactors.push('Ingen kontakt på >90 dagar');
  } else if (daysSinceContact > 60) {
    score -= 25;
    riskFactors.push('Ingen kontakt på >60 dagar');
  } else if (daysSinceContact > 30) {
    score -= 10;
    riskFactors.push('Ingen kontakt på >30 dagar');
  }
  
  // Factor 2: No next action scheduled
  if (!company.nextAction) {
    score -= 15;
    riskFactors.push('Ingen uppföljning planerad');
  }
  
  // Factor 3: Low agent count
  if (company.agentCount && company.agentCount < 3) {
    score -= 10;
    riskFactors.push('Lågt antal mäklare (<3)');
  }
  
  // Factor 4: No MRR data
  const mrr = company.mrr || (company.payment * company.agentCount * 12) || 0;
  if (mrr === 0) {
    score -= 10;
    riskFactors.push('Ingen MRR-data');
  }
  
  // Determine churn risk and status
  let churnRisk, status;
  if (score >= 75) {
    churnRisk = 'low';
    status = 'healthy';
  } else if (score >= 50) {
    churnRisk = 'medium';
    status = 'warning';
  } else {
    churnRisk = 'high';
    status = 'critical';
  }
  
  return {
    score: Math.max(0, score),
    status,
    churnRisk,
    riskFactors,
    daysSinceContact
  };
}

module.exports = router;