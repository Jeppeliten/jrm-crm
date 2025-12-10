const express = require('express');
const router = express.Router();

/**
 * GET /api/search - Global search across all entities
 * Query params:
 *   - q: Search query (required)
 *   - type: Entity type filter (companies, agents, brands, deals)
 *   - limit: Max results per type (default: 5)
 */
router.get('/', async (req, res) => {
  try {
    const { q, type, limit = 5 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Search query must be at least 2 characters',
        message: 'Sökfrågan måste vara minst 2 tecken' 
      });
    }

    const db = req.app.locals.db;
    const searchQuery = q.trim().toLowerCase();
    const maxResults = parseInt(limit, 10);

    // Mock data search if no database
    if (!db) {
      const mockResults = {
        companies: [
          {
            _id: '1',
            name: 'ERA Sverige Fastighetsförmedling AB',
            type: 'company',
            status: 'kund',
            highlight: 'ERA Sverige Fastighetsförmedling AB'
          }
        ].filter(c => 
          !type || type === 'companies'
        ).filter(c => 
          c.name.toLowerCase().includes(searchQuery)
        ).slice(0, maxResults),
        
        agents: [
          {
            _id: '1',
            name: 'Anna Andersson',
            type: 'agent',
            company: 'ERA Sverige Fastighetsförmedling AB',
            status: 'aktiv',
            highlight: 'Anna Andersson'
          }
        ].filter(a => 
          !type || type === 'agents'
        ).filter(a => 
          a.name.toLowerCase().includes(searchQuery) ||
          a.company?.toLowerCase().includes(searchQuery)
        ).slice(0, maxResults),
        
        brands: [
          {
            _id: 'mock1',
            name: 'ERA Mäklare',
            type: 'brand',
            highlight: 'ERA Mäklare'
          }
        ].filter(b => 
          !type || type === 'brands'
        ).filter(b => 
          b.name.toLowerCase().includes(searchQuery)
        ).slice(0, maxResults),
        
        query: searchQuery,
        totalResults: 0
      };
      
      mockResults.totalResults = 
        mockResults.companies.length + 
        mockResults.agents.length + 
        mockResults.brands.length;
      
      return res.json(mockResults);
    }

    // Database search
    const results = {
      companies: [],
      agents: [],
      brands: [],
      deals: [],
      query: searchQuery,
      totalResults: 0
    };

    // Search companies
    if (!type || type === 'companies') {
      const companies = await db.collection('companies_v2')
        .find({
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } },
            { orgNumber: { $regex: searchQuery, $options: 'i' } }
          ]
        })
        .limit(maxResults)
        .toArray();

      results.companies = companies.map(c => ({
        _id: c._id,
        name: c.name,
        type: 'company',
        status: c.status,
        email: c.email,
        phone: c.phone,
        highlight: highlightMatch(c.name, searchQuery)
      }));
    }

    // Search agents
    if (!type || type === 'agents') {
      const agents = await db.collection('agents_v2')
        .find({
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { lastName: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } },
            { company: { $regex: searchQuery, $options: 'i' } }
          ]
        })
        .limit(maxResults)
        .toArray();

      results.agents = agents.map(a => ({
        _id: a._id,
        name: `${a.name} ${a.lastName || ''}`.trim(),
        type: 'agent',
        company: a.company,
        status: a.status,
        email: a.email,
        phone: a.phone,
        highlight: highlightMatch(`${a.name} ${a.lastName || ''}`, searchQuery)
      }));
    }

    // Search brands
    if (!type || type === 'brands') {
      const brands = await db.collection('brands_v2')
        .find({
          $or: [
            { name: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } }
          ]
        })
        .limit(maxResults)
        .toArray();

      results.brands = brands.map(b => ({
        _id: b._id,
        name: b.name,
        type: 'brand',
        description: b.description,
        highlight: highlightMatch(b.name, searchQuery)
      }));
    }

    // Search deals
    if (!type || type === 'deals') {
      const deals = await db.collection('deals')
        .find({
          $or: [
            { title: { $regex: searchQuery, $options: 'i' } },
            { companyName: { $regex: searchQuery, $options: 'i' } },
            { contactPerson: { $regex: searchQuery, $options: 'i' } }
          ]
        })
        .limit(maxResults)
        .toArray();

      results.deals = deals.map(d => ({
        _id: d._id,
        title: d.title,
        type: 'deal',
        companyName: d.companyName,
        status: d.status,
        value: d.value,
        highlight: highlightMatch(d.title, searchQuery)
      }));
    }

    results.totalResults = 
      results.companies.length + 
      results.agents.length + 
      results.brands.length + 
      results.deals.length;

    res.json(results);

  } catch (error) {
    console.error('Error performing search:', error);
    res.status(500).json({ 
      error: 'Search failed',
      message: error.message 
    });
  }
});

/**
 * Helper function to highlight matching text
 */
function highlightMatch(text, query) {
  if (!text) return '';
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * GET /api/search/suggestions - Get search suggestions as user types
 * Query params:
 *   - q: Partial search query (min 2 chars)
 *   - limit: Max suggestions (default: 10)
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    const db = req.app.locals.db;
    const searchQuery = q.trim().toLowerCase();
    const maxResults = parseInt(limit, 10);

    if (!db) {
      // Mock suggestions
      const mockSuggestions = [
        'ERA Sverige',
        'Mäklarhuset',
        'Anna Andersson'
      ].filter(s => s.toLowerCase().includes(searchQuery))
       .slice(0, maxResults);
      
      return res.json({ suggestions: mockSuggestions });
    }

    // Get suggestions from database
    const suggestions = new Set();

    // Company names
    const companies = await db.collection('companies_v2')
      .find({ name: { $regex: `^${searchQuery}`, $options: 'i' } })
      .limit(5)
      .project({ name: 1 })
      .toArray();
    companies.forEach(c => suggestions.add(c.name));

    // Agent names
    const agents = await db.collection('agents_v2')
      .find({
        $or: [
          { name: { $regex: `^${searchQuery}`, $options: 'i' } },
          { lastName: { $regex: `^${searchQuery}`, $options: 'i' } }
        ]
      })
      .limit(5)
      .project({ name: 1, lastName: 1 })
      .toArray();
    agents.forEach(a => suggestions.add(`${a.name} ${a.lastName || ''}`.trim()));

    // Brand names
    const brands = await db.collection('brands_v2')
      .find({ name: { $regex: `^${searchQuery}`, $options: 'i' } })
      .limit(3)
      .project({ name: 1 })
      .toArray();
    brands.forEach(b => suggestions.add(b.name));

    const suggestionArray = Array.from(suggestions).slice(0, maxResults);
    res.json({ suggestions: suggestionArray });

  } catch (error) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({ 
      error: 'Failed to get suggestions',
      message: error.message 
    });
  }
});

module.exports = router;
