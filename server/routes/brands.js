const express = require('express');
const router = express.Router();

// 🧪 TEMPORARY: In-memory storage for testing
let mockBrands = [
  { _id: '1', name: 'Test Varumärke', description: 'Test beskrivning', createdAt: new Date(), updatedAt: new Date() }
];

/**
 * GET /api/brands - Get all brands
 */
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    if (!db) {
      console.log('📦 Using mock brands data');
      return res.json(mockBrands);
    }
    
    const brands = await db.collection('brands').find({}).toArray();
    res.json(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

/**
 * POST /api/brands - Create new brand
 */
router.post('/', async (req, res) => {
  try {
    console.log('🟣 POST /api/brands called');
    console.log('🟣 Request body:', req.body);
    
    const db = req.app.locals.db;
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const brand = {
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (!db) {
      console.log('📦 Saving to mock brands storage');
      const mockBrand = { ...brand, _id: Date.now().toString() };
      mockBrands.push(mockBrand);
      return res.status(201).json(mockBrand);
    }
    
    const result = await db.collection('brands').insertOne(brand);
    console.log('✅ Brand saved to DB with ID:', result.insertedId);
    res.status(201).json({ ...brand, _id: result.insertedId });
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ error: 'Failed to create brand' });
  }
});

/**
 * PUT /api/brands/:id - Update brand
 */
router.put('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const { name, description } = req.body;
    
    const updateData = {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      updatedAt: new Date()
    };
    
    const result = await db.collection('brands').updateOne(
      { _id: require('mongodb').ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.json({ message: 'Brand updated successfully' });
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ error: 'Failed to update brand' });
  }
});

/**
 * DELETE /api/brands/:id - Delete brand
 */
router.delete('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    
    const result = await db.collection('brands').deleteOne(
      { _id: require('mongodb').ObjectId(id) }
    );
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.json({ message: 'Brand deleted successfully' });
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({ error: 'Failed to delete brand' });
  }
});

module.exports = router;
