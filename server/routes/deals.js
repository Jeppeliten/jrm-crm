const express = require('express');
const router = express.Router();

// 🧪 TEMPORARY: In-memory storage for testing
let mockDeals = [
  { 
    _id: '1', 
    title: 'Test Affär', 
    customer: 'Test Kund AB', 
    value: 100000, 
    stage: 'Prospecting',
    expectedCloseDate: new Date('2025-12-31'),
    createdAt: new Date(), 
    updatedAt: new Date() 
  }
];

/**
 * GET /api/deals - Get all deals
 */
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    if (!db) {
      console.log('📦 Using mock deals data');
      return res.json(mockDeals);
    }
    
    const deals = await db.collection('deals').find({}).toArray();
    res.json(deals);
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

/**
 * POST /api/deals - Create new deal
 */
router.post('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { title, customer, value, stage, expectedCloseDate } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const deal = {
      title: title.trim(),
      customer: customer?.trim() || '',
      value: value || 0,
      stage: stage || 'Prospecting',
      expectedCloseDate,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (!db) {
      console.log('📦 Saving to mock deals storage');
      const mockDeal = { ...deal, _id: Date.now().toString() };
      mockDeals.push(mockDeal);
      return res.status(201).json(mockDeal);
    }
    
    const result = await db.collection('deals').insertOne(deal);
    res.status(201).json({ ...deal, _id: result.insertedId });
  } catch (error) {
    console.error('Error creating deal:', error);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

/**
 * PUT /api/deals/:id - Update deal
 */
router.put('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData._id;
    
    if (!db) {
      console.log('📦 Updating mock deal');
      const index = mockDeals.findIndex(d => d._id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Deal not found' });
      }
      mockDeals[index] = { ...mockDeals[index], ...updateData };
      return res.json({ message: 'Deal updated successfully' });
    }
    
    const { ObjectId } = require('mongodb');
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    
    const result = await db.collection('deals').updateOne(
      query,
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    res.json({ message: 'Deal updated successfully' });
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

/**
 * DELETE /api/deals/:id - Delete deal
 */
router.delete('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    
    if (!db) {
      console.log('📦 Deleting mock deal');
      const index = mockDeals.findIndex(d => d._id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Deal not found' });
      }
      mockDeals.splice(index, 1);
      return res.json({ message: 'Deal deleted successfully' });
    }
    
    const { ObjectId } = require('mongodb');
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    
    const result = await db.collection('deals').deleteOne(query);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

module.exports = router;
