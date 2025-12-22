const express = require('express');
const router = express.Router();
const { updateAllAggregations } = require('../services/aggregation-service');

// ...existing code...

/**
 * GET /api/agents - Get all agents with optional filtering
 * Query params:
 *   - status: Filter by status (aktiv, inaktiv)
 *   - companyId: Filter by company ID
 *   - brandId: Filter by brand ID
 *   - search: Search by name or email
 *   - sort: Sort field (name, company, createdAt)
 *   - order: Sort order (asc, desc)
 */
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { status, companyId, brandId, search, sort = 'name', order = 'asc' } = req.query;
    
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Build database query
    const query = {};
    if (status) query.status = status;
    if (companyId) query.companyId = companyId;
    if (brandId) query.brandId = brandId;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Build sort
    const sortObj = {};
    sortObj[sort] = order === 'desc' ? -1 : 1;
    
    const agents = await db.collection('agents_v2')
      .find(query)
      .sort(sortObj)
      .toArray();
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

/**
 * GET /api/agents/:id - Get agent by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { ObjectId } = require('mongodb');
    
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    let query;
    try {
      query = { _id: new ObjectId(req.params.id) };
    } catch (e) {
      query = { _id: req.params.id };
    }
    
    const agent = await db.collection('agents_v2').findOne(query);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json(agent);
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

/**
 * POST /api/agents - Create new agent
 */
router.post('/', async (req, res) => {
  try {
    console.log('🟠 POST /api/agents called');
    console.log('🟠 Request body:', req.body);
    
    const db = req.app.locals.db;
    const { name, lastName, email, phone, registrationType, company, companyId, brand, brandId } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Check for existing agent with same email (if email provided)
    if (email && email.trim()) {
      const existingAgent = await db.collection('agents_v2').findOne({
        email: { $regex: new RegExp(`^${email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      
      if (existingAgent) {
        console.log('⚠️  Agent with this email already exists:', existingAgent.email);
        return res.status(409).json({ 
          error: 'En mäklare med denna e-postadress finns redan',
          message: `Mäklaren "${existingAgent.name}" (${existingAgent.email}) är redan registrerad.`
        });
      }
    }
    
    const agent = {
      // Basic info
      name: name.trim(),
      lastName: lastName?.trim() || '',
      email: email?.trim() || '',
      phone: phone?.trim() || '',
      registrationType: registrationType?.trim() || '',
      
      // Company and Brand references
      company: company?.trim() || '',
      companyId: companyId || null,
      brand: brand?.trim() || '',
      brandId: brandId || null,
      
      // Address info
      address: req.body.address?.trim() || '',
      postalCode: req.body.postalCode?.trim() || '',
      city: req.body.city?.trim() || '',
      office: req.body.office?.trim() || '',
      
      // Mäklarpaket fields
      brokerPackage: {
        userId: req.body.brokerPackageUserId?.trim() || '',
        msnName: req.body.brokerPackageMsnName?.trim() || '',
        uid: req.body.brokerPackageUid?.trim() || '',
        epost: req.body.brokerPackageEpost?.trim() || '',
        active: req.body.brokerPackageActive || false,
        customerNumber: req.body.brokerPackageCustomerNumber?.trim() || '',
        accountNumber: req.body.brokerPackageAccountNumber?.trim() || '',
        totalCost: parseFloat(req.body.brokerPackageTotalCost) || 0,
        discount: parseFloat(req.body.brokerPackageDiscount) || 0
      },
      
      // Products and matching
      products: req.body.products || [],
      matchType: req.body.matchType?.trim() || '',
      
      // Status and metadata
      status: req.body.status?.trim() || 'aktiv',
      role: req.body.role?.trim() || '',
      licenseType: req.body.licenseType?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    try {
      const result = await db.collection('agents_v2').insertOne(agent);
      console.log('✅ Agent saved to DB with ID:', result.insertedId);
      
      // Uppdatera aggregeringar för företag och varumärke
      await updateAllAggregations(db, companyId, brandId);
      
      res.status(201).json({ ...agent, _id: result.insertedId });
    } catch (insertError) {
      if (insertError.code === 11000) {
        console.error('❌ Duplicate key error despite pre-check:', insertError);
        return res.status(409).json({ 
          error: 'En mäklare med denna information finns redan',
          message: 'Detta kan bero på att mäklaren just skapades av någon annan. Försök uppdatera listan.'
        });
      }
      throw insertError;
    }
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Failed to create agent', message: error.message });
  }
});

/**
 * PUT /api/agents/:id - Update agent
 */
router.put('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData._id;
    
    // Handle both string IDs (from mock) and ObjectIds (from MongoDB)
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    // Hämta gamla värden för att veta vilka aggregeringar som ska uppdateras
    const oldAgent = await db.collection('agents_v2').findOne(query);
    
    const result = await db.collection('agents_v2').updateOne(
      query,
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Uppdatera aggregeringar för både gamla och nya företag/varumärken
    const oldCompanyId = oldAgent?.companyId;
    const oldBrandId = oldAgent?.brandId;
    const newCompanyId = updateData.companyId;
    const newBrandId = updateData.brandId;
    
    if (oldCompanyId) await updateAllAggregations(db, oldCompanyId, null);
    if (oldBrandId) await updateAllAggregations(db, null, oldBrandId);
    if (newCompanyId && newCompanyId !== oldCompanyId) {
      await updateAllAggregations(db, newCompanyId, null);
    }
    if (newBrandId && newBrandId !== oldBrandId) {
      await updateAllAggregations(db, null, newBrandId);
    }
    
    res.json({ message: 'Agent updated successfully' });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

/**
 * DELETE /api/agents/:id - Delete agent
 */
router.delete('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    
    // Handle both string IDs (from mock) and ObjectIds (from MongoDB)
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    // Hämta mäklaren först för att få companyId och brandId
    const agent = await db.collection('agents_v2').findOne(query);
    
    const result = await db.collection('agents_v2').deleteOne(query);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Uppdatera aggregeringar efter borttagning
    if (agent) {
      await updateAllAggregations(db, agent.companyId, agent.brandId);
    }
    
    res.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

module.exports = router;
