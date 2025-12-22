const express = require('express');
const router = express.Router();
const { getCompanyAggregatedStats } = require('../services/aggregation-service');

// ...existing code...

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
 * GET /api/companies/pipeline/stats - Get pipeline statistics
 */
router.get('/pipeline/stats', async (req, res) => {
  try {
    const db = req.app.locals.db;

    if (!db) {
      // Mock mode - calculate from mockCompanies
      const stages = ['prospekt', 'kvalificerad', 'offert', 'forhandling', 'vunnit', 'forlorat'];
      const stats = stages.map(stage => {
        const companies = mockCompanies.filter(c => c.pipelineStage === stage);
        const totalValue = companies.reduce((sum, c) => sum + (c.pipelineValue || 0), 0);
        return {
          stage,
          count: companies.length,
          totalValue,
          companies: companies.map(c => ({
            _id: c._id,
            name: c.name,
            brand: c.brand,
            agentCount: c.agentCount,
            pipelineValue: c.pipelineValue || 0,
            lastContact: c.lastContact,
            nextAction: c.nextAction
          }))
        };
      });

      return res.json({
        stages: stats,
        totalCompanies: mockCompanies.length,
        totalValue: mockCompanies.reduce((sum, c) => sum + (c.pipelineValue || 0), 0)
      });
    }

    // Database mode
    const pipeline = [
      {
        $group: {
          _id: '$pipelineStage',
          count: { $sum: 1 },
          totalValue: { $sum: '$pipelineValue' },
          companies: {
            $push: {
              _id: '$_id',
              name: '$name',
              brand: '$brand',
              agentCount: '$agentCount',
              pipelineValue: '$pipelineValue',
              lastContact: '$lastContact',
              nextAction: '$nextAction'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const results = await db.collection('companies_v2').aggregate(pipeline).toArray();
    
    const stages = ['prospekt', 'kvalificerad', 'offert', 'forhandling', 'vunnit', 'forlorat'];
    const stats = stages.map(stage => {
      const stageData = results.find(r => r._id === stage);
      return {
        stage,
        count: stageData?.count || 0,
        totalValue: stageData?.totalValue || 0,
        companies: stageData?.companies || []
      };
    });

    const totalCompanies = results.reduce((sum, r) => sum + r.count, 0);
    const totalValue = results.reduce((sum, r) => sum + (r.totalValue || 0), 0);

    res.json({ stages: stats, totalCompanies, totalValue });
  } catch (error) {
    console.error('Error fetching pipeline stats:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline stats' });
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
      return res.status(503).json({ error: 'Database not available' });
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
 *   - mrrMin: Minimum MRR (payment field)
 *   - mrrMax: Maximum MRR
 *   - dateFrom: Filter lastContact from date (ISO format)
 *   - dateTo: Filter lastContact to date (ISO format)
 *   - agentMin: Minimum agent count
 *   - agentMax: Maximum agent count
 */
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { 
      status, brandId, search, sort = 'name', order = 'asc',
      mrrMin, mrrMax, dateFrom, dateTo, agentMin, agentMax
    } = req.query;
    
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
      
      // MRR filters
      if (mrrMin !== undefined) {
        const min = parseFloat(mrrMin);
        filtered = filtered.filter(c => (c.payment || 0) >= min);
      }
      if (mrrMax !== undefined) {
        const max = parseFloat(mrrMax);
        filtered = filtered.filter(c => (c.payment || 0) <= max);
      }
      
      // Date range filters
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        filtered = filtered.filter(c => c.lastContact && new Date(c.lastContact) >= fromDate);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        filtered = filtered.filter(c => c.lastContact && new Date(c.lastContact) <= toDate);
      }
      
      if (!db) {
        return res.status(503).json({ error: 'Database not available' });
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
 * PUT /api/companies/:id/pipeline - Update company pipeline stage
 * Body: { stage: 'prospekt'|'kvalificerad'|'offert'|'forhandling'|'vunnit'|'forlorat', value: number }
 */
router.put('/:id/pipeline', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const { stage, value } = req.body;

    // Validate stage
    const validStages = ['prospekt', 'kvalificerad', 'offert', 'forhandling', 'vunnit', 'forlorat'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({ error: 'Invalid pipeline stage' });
    }

    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Database mode
    const query = id.match(/^[0-9a-fA-F]{24}$/)
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };

    const update = {
      $set: {
        pipelineStage: stage,
        updatedAt: new Date()
      }
    };

    if (value !== undefined) {
      update.$set.pipelineValue = value;
    }

    // Auto-update status
    if (stage === 'vunnit') {
      update.$set.status = 'kund';
    } else if (stage === 'forlorat') {
      update.$set.status = 'prospekt';
    }

    const result = await db.collection('companies_v2').findOneAndUpdate(
      query,
      update,
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(result.value);
  } catch (error) {
    console.error('Error updating pipeline stage:', error);
    res.status(500).json({ error: 'Failed to update pipeline stage' });
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

// =============================================================================
// Filter Presets System
// =============================================================================

// ...existing code...

/**
 * GET /api/companies/filter-presets - Get all filter presets
 */
router.get('/filter-presets', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const presets = await db.collection('filter_presets')
      .find({ entity: 'companies' })
      .toArray();
    
    res.json(presets);
  } catch (error) {
    console.error('Error fetching filter presets:', error);
    res.status(500).json({ error: 'Failed to fetch filter presets' });
  }
});

/**
 * POST /api/companies/filter-presets - Save a new filter preset
 */
router.post('/filter-presets', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { name, filters } = req.body;
    
    if (!name || !filters) {
      return res.status(400).json({ error: 'Name and filters are required' });
    }
    
    const preset = {
      _id: Date.now().toString(),
      name,
      filters,
      entity: 'companies',
      createdAt: new Date(),
      userId: 'demo-user' // TODO: Get from auth
    };
    
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    await db.collection('filter_presets').insertOne(preset);
    res.status(201).json(preset);
  } catch (error) {
    console.error('Error saving filter preset:', error);
    res.status(500).json({ error: 'Failed to save filter preset' });
  }
});

/**
 * DELETE /api/companies/filter-presets/:id - Delete a filter preset
 */
router.delete('/filter-presets/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const result = await db.collection('filter_presets').deleteOne({ _id: id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }
    
    res.json({ message: 'Preset deleted' });
  } catch (error) {
    console.error('Error deleting filter preset:', error);
    res.status(500).json({ error: 'Failed to delete filter preset' });
  }
});

module.exports = router;



