const express = require('express');
const router = express.Router();
const { getCompanyAggregatedStats } = require('../services/aggregation-service');

// 🧪 TEMPORARY: In-memory storage for testing (replace with real DB later)
let mockCompanies = [
  {
    _id: '1',
    name: 'ERA Sverige Fastighetsförmedling AB',
    orgNumber: '556123-4567',
    email: 'info@era.se',
    phone: '08-123 45 67',
    address: 'Storgatan 1, Stockholm',
    status: 'kund',
    brandId: 'mock1',
    brand: 'ERA Mäklare',
    agentCount: 12,
    payment: 1649,
    lastContact: new Date('2025-12-01'),
    nextAction: 'Uppföljning Q1 2026',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date()
  },
  {
    _id: '2',
    name: 'Mäklarhuset Stockholm Syd',
    orgNumber: '556789-0123',
    email: 'stockholm@maklarhuset.se',
    phone: '08-555 44 33',
    address: 'Södermalmsvägen 12, Stockholm',
    status: 'kund',
    brandId: 'mock2',
    brand: 'Mäklarhuset',
    agentCount: 8,
    payment: 1249,
    lastContact: new Date('2025-11-20'),
    nextAction: 'Kontraktsförnyelse i mars',
    createdAt: new Date('2023-08-10'),
    updatedAt: new Date()
  },
  {
    _id: '3',
    name: 'Svensk Fastighetsförmedling Göteborg',
    orgNumber: '559988-7766',
    email: 'goteborg@svenskfast.se',
    phone: '031-123 45 67',
    address: 'Avenyn 45, Göteborg',
    status: 'prospekt',
    brandId: 'mock3',
    brand: 'Svensk Fastighetsförmedling',
    agentCount: 15,
    payment: 0,
    lastContact: new Date('2025-11-15'),
    nextAction: 'Demo-möte bokad 15 dec',
    createdAt: new Date('2025-10-01'),
    updatedAt: new Date()
  },
  {
    _id: '4',
    name: 'Fastighetsbyrån Malmö City',
    orgNumber: '556234-5678',
    email: 'malmo@fastighetsbyran.se',
    phone: '040-789 12 34',
    address: 'Stortorget 8, Malmö',
    status: 'kund',
    brandId: 'mock4',
    brand: 'Fastighetsbyrån',
    agentCount: 6,
    payment: 849,
    lastContact: new Date('2025-12-05'),
    nextAction: null,
    createdAt: new Date('2024-06-20'),
    updatedAt: new Date()
  },
  {
    _id: '5',
    name: 'Notar Mäklare Uppsala',
    orgNumber: '559876-5432',
    email: 'uppsala@notar.se',
    phone: '018-456 78 90',
    address: 'Svartbäcksgatan 23, Uppsala',
    status: 'prospekt',
    brandId: 'mock5',
    brand: 'Notar',
    agentCount: 10,
    payment: 0,
    lastContact: new Date('2025-11-28'),
    nextAction: 'Skickat offert - väntar på svar',
    createdAt: new Date('2025-11-10'),
    updatedAt: new Date()
  }
];

/**
 * GET /api/companies/:id/stats - Get statistics for a specific company
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    
    if (!db) {
      return res.json({ agentCount: 0, brands: [] });
    }
    
    // Count agents for this company
    const agentCount = await db.collection('agents_v2')
      .countDocuments({ companyId: id });
    
    // Get unique brands from agents
    const agents = await db.collection('agents_v2')
      .find({ companyId: id })
      .toArray();
    
    const brandIds = [...new Set(agents.map(a => a.brandId).filter(Boolean))];
    
    res.json({ agentCount, brandIds, agentCount });
  } catch (error) {
    console.error('Error fetching company stats:', error);
    res.status(500).json({ error: 'Failed to fetch company stats' });
  }
});

/**
 * GET /api/companies/:id/stats - Get statistics for a specific company
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    
    if (!db) {
      return res.json({ agentCount: 0, brandIds: [] });
    }
    
    // Använd aggregation service för fullständig statistik
    const stats = await getCompanyAggregatedStats(db, id);
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching company stats:', error);
    res.status(500).json({ error: 'Failed to fetch company stats' });
  }
});

/**
 * GET /api/companies/:id/agents - Get agents for a specific company
 */
router.get('/:id/agents', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    
    if (!db) {
      return res.json([]);
    }
    
    const agents = await db.collection('agents_v2')
      .find({ companyId: id })
      .toArray();
    
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * GET /api/companies/:id - Get single company
 */
router.get('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    
    if (!db) {
      const company = mockCompanies.find(c => c._id === id);
      return company ? res.json(company) : res.status(404).json({ error: 'Company not found' });
    }
    
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    const company = await db.collection('companies_v2').findOne(query);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    res.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

/**
 * GET /api/companies - Get all companies with optional filtering
 * Query params:
 *   - status: Filter by status (kund, prospekt)
 *   - brandId: Filter by brand ID
 *   - search: Search by name
 *   - sort: Sort field (name, agentCount, lastContact)
 *   - order: Sort order (asc, desc)
 */
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { status, brandId, search, sort = 'name', order = 'asc' } = req.query;
    
    // Use mock data if no database
    if (!db) {
      console.log('📦 Using mock companies data');
      let filtered = [...mockCompanies];
      
      // Apply filters
      if (status) {
        filtered = filtered.filter(c => c.status === status);
      }
      if (brandId) {
        filtered = filtered.filter(c => c.brandId === brandId);
      }
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(c => 
          c.name.toLowerCase().includes(searchLower) ||
          c.email?.toLowerCase().includes(searchLower) ||
          c.orgNumber?.includes(search)
        );
      }
      
      // Apply sorting
      filtered.sort((a, b) => {
        let aVal = a[sort];
        let bVal = b[sort];
        
        if (sort === 'lastContact') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        } else if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal?.toLowerCase() || '';
        }
        
        const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        return order === 'desc' ? -comparison : comparison;
      });
      
      return res.json(filtered);
    }
    
    // Build database query
    const query = {};
    if (status) query.status = status;
    if (brandId) query.brandId = brandId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { orgNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Build sort
    const sortObj = {};
    sortObj[sort] = order === 'desc' ? -1 : 1;
    
    const companies = await db.collection('companies_v2')
      .find(query)
      .sort(sortObj)
      .toArray();
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

/**
 * POST /api/companies - Create new company
 */
router.post('/', async (req, res, next) => {
  try {
    console.log('ðŸ”¹ POST /api/companies called');
    console.log('ðŸ”¹ Request body:', req.body);
    console.log('ðŸ”¹ DB available:', !!req.app.locals.db);
    
    const db = req.app.locals.db;
    const { name, orgNumber, email, phone, address, lastContact, nextAction, brandIds } = req.body;
    
    if (!name || !name.trim()) {
      console.log('âŒ Validation failed: Name required');
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Use mock storage if no database
    if (!db) {
      console.log('📦 Saving to mock companies storage');
      const company = {
        name: name.trim(),
        orgNumber: orgNumber?.trim() || '',
        email: email?.trim() || '',
        phone: phone?.trim() || '',
        address: address?.trim() || '',
        brandIds: brandIds || [],
        agentCount: 0,
        lastContact: lastContact || null,
        nextAction: nextAction || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockCompany = { ...company, _id: Date.now().toString() };
      mockCompanies.push(mockCompany);
      console.log('âœ… Company saved to mock storage, total companies:', mockCompanies.length);
      return res.status(201).json(mockCompany);
    }
    
    // Escape special regex characters and check for existing company (case-insensitive)
    const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingCompany = await db.collection('companies_v2').findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') }
    });
    
    if (existingCompany) {
      console.log('âš ï¸  Company with this name already exists:', existingCompany.name);
      return res.status(409).json({ 
        error: 'Ett fÃ¶retag med detta namn finns redan',
        message: `FÃ¶retaget "${existingCompany.name}" Ã¤r redan registrerat. VÃ¤nligen anvÃ¤nd ett annat namn.`,
        suggestion: `FÃ¶rsÃ¶k med "${name.trim()} AB" eller lÃ¤gg till ett organisationsnummer fÃ¶r att skilja dem Ã¥t.`
      });
    }
    
    // Clean the incoming data - ensure no _id field
    const company = {
      name: name.trim(),
      orgNumber: orgNumber?.trim() || '',
      email: email?.trim() || '',
      phone: phone?.trim() || '',
      address: address?.trim() || '',
      brandIds: brandIds || [],
      agentCount: 0,
      lastContact: lastContact || null,
      nextAction: nextAction || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('ðŸ’¾ Saving to Cosmos DB...');
    console.log('ðŸ’¾ Document to insert:', company);
    
    try {
      const result = await db.collection('companies_v2').insertOne(company);
      console.log('âœ… Company saved to DB with ID:', result.insertedId);
      res.status(201).json({ ...company, _id: result.insertedId });
    } catch (insertError) {
      // Handle MongoDB duplicate key error specifically
      if (insertError.code === 11000) {
        console.error('âŒ Duplicate key error despite pre-check:', insertError);
        return res.status(409).json({ 
          error: 'Ett fÃ¶retag med denna information finns redan i databasen',
          message: 'Detta kan bero pÃ¥ att fÃ¶retaget just skapades av nÃ¥gon annan. FÃ¶rsÃ¶k uppdatera listan.'
        });
      }
      throw insertError; // Re-throw other errors
    }
    console.log('âœ… Company saved to DB with ID:', result.insertedId);
    res.status(201).json({ ...company, _id: result.insertedId });
  } catch (error) {
    console.error('âŒ Error creating company:', error);
    console.error('âŒ Error code:', error.code);
    console.error('âŒ Error message:', error.message);
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(409).json({ 
        error: 'Database constraint violation',
        message: 'This entry conflicts with existing data. Please try different values.'
      });
    }
    
    next(error); // Pass other errors to error handler
  }
});

/**
 * PUT /api/companies/:id - Update company
 */
router.put('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    
    // Clean update data
    const updateData = { ...req.body };
    delete updateData._id;
    updateData.updatedAt = new Date();
    
    // Trim string fields
    if (updateData.name) updateData.name = updateData.name.trim();
    if (updateData.orgNumber) updateData.orgNumber = updateData.orgNumber.trim();
    if (updateData.email) updateData.email = updateData.email.trim();
    if (updateData.phone) updateData.phone = updateData.phone.trim();
    if (updateData.brand) updateData.brand = updateData.brand.trim();
    if (updateData.city) updateData.city = updateData.city.trim();
    if (updateData.county) updateData.county = updateData.county.trim();
    
    // Handle both string IDs and ObjectIds
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    const result = await db.collection('companies_v2').updateOne(
      query,
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    res.json({ message: 'Company updated successfully', data: updateData });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

/**
 * DELETE /api/companies/:id - Delete company
 */
router.delete('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    
    // Handle both string IDs (from mock) and ObjectIds (from MongoDB)
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    const result = await db.collection('companies_v2').deleteOne(query);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

module.exports = router;



