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
    
    const agents = await db.collection('agents').find({}).toArray();
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
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const agent = {
      _id: Date.now().toString(),
      name,
      email,
      phone,
      company,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (!db) {
      console.log('📦 Saving to mock agents storage:', agent);
      mockAgents.push(agent);
      return res.status(201).json(agent);
    }
    
    const result = await db.collection('agents').insertOne(agent);
    res.status(201).json({ ...agent, _id: result.insertedId });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Failed to create agent' });
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
    
    const result = await db.collection('agents').updateOne(
      { _id: require('mongodb').ObjectId(id) },
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
    
    const result = await db.collection('agents').deleteOne(
      { _id: require('mongodb').ObjectId(id) }
    );
    
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
