const express = require('express');
const router = express.Router();

// 🧪 TEMPORARY: In-memory storage for testing
let mockAgents = [
  { _id: '1', name: 'Test Mäklare', email: 'test@test.se', phone: '08-123456', company: 'Test Företag', createdAt: new Date(), updatedAt: new Date() }
];

/**
 * GET /api/agents - Get all agents
 */
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    if (!db) {
      console.log('📦 Using mock agents data');
      return res.json(mockAgents);
    }
    
    const agents = await db.collection('agents_v2').find({}).toArray();
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
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
    const { name, email, phone, company } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Use mock storage if no database
    if (!db) {
      console.log('📦 Saving to mock agents storage');
      const agent = {
        name: name.trim(),
        email: email?.trim() || '',
        phone: phone?.trim() || '',
        company: company?.trim() || '',
        status: req.body.status?.trim() || 'aktiv',
        role: req.body.role?.trim() || '',
        licenseType: req.body.licenseType?.trim() || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockAgent = { ...agent, _id: Date.now().toString() };
      mockAgents.push(mockAgent);
      return res.status(201).json(mockAgent);
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
      name: name.trim(),
      email: email?.trim() || '',
      phone: phone?.trim() || '',
      company: company?.trim() || '',
      status: req.body.status?.trim() || 'aktiv',
      role: req.body.role?.trim() || '',
      licenseType: req.body.licenseType?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    try {
      const result = await db.collection('agents_v2').insertOne(agent);
      console.log('✅ Agent saved to DB with ID:', result.insertedId);
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
    
    const result = await db.collection('agents_v2').updateOne(
      query,
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Agent not found' });
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
    
    const result = await db.collection('agents_v2').deleteOne(query);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

module.exports = router;
