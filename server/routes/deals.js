const express = require('express');
const router = express.Router();

/**
 * GET /api/deals - Get all deals
 */
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
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
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const deal = {
      title,
      customer,
      value: value || 0,
      stage: stage || 'Prospecting',
      expectedCloseDate,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
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
    
    const result = await db.collection('deals').updateOne(
      { _id: require('mongodb').ObjectId(id) },
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
    
    const result = await db.collection('deals').deleteOne(
      { _id: require('mongodb').ObjectId(id) }
    );
    
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
