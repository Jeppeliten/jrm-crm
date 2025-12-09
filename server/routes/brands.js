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
    
    const brands = await db.collection('brands_v2').find({}).toArray();
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
    console.log('🟣 DB available:', !!req.app.locals.db);
    
    const db = req.app.locals.db;
    const { name, description } = req.body;
    
    if (!name || !name.trim()) {
      console.log('❌ Name is missing');
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Use mock storage if no database
    if (!db) {
      console.log('📦 Saving to mock brands storage');
      const brand = {
        name: name.trim(),
        description: description?.trim() || '',
        category: req.body.category?.trim() || '',
        status: req.body.status?.trim() || 'aktiv',
        website: req.body.website?.trim() || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockBrand = { ...brand, _id: Date.now().toString() };
      mockBrands.push(mockBrand);
      console.log('✅ Mock brand created:', mockBrand);
      return res.status(201).json(mockBrand);
    }
    
    // Check for existing brand with same name (case-insensitive)
    const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingBrand = await db.collection('brands_v2').findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') }
    });
    
    if (existingBrand) {
      console.log('⚠️  Brand with this name already exists:', existingBrand.name);
      return res.status(409).json({ 
        error: 'Ett varumärke med detta namn finns redan',
        message: `Varumärket "${existingBrand.name}" är redan registrerat. Vänligen använd ett annat namn.`
      });
    }
    
    const brand = {
      name: name.trim(),
      description: description?.trim() || '',
      category: req.body.category?.trim() || '',
      status: req.body.status?.trim() || 'aktiv',
      website: req.body.website?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('📦 Saving to database...');
    
    try {
      const result = await db.collection('brands_v2').insertOne(brand);
      console.log('✅ Brand saved to DB with ID:', result.insertedId);
      res.status(201).json({ ...brand, _id: result.insertedId });
    } catch (insertError) {
      if (insertError.code === 11000) {
        console.error('❌ Duplicate key error despite pre-check:', insertError);
        return res.status(409).json({ 
          error: 'Ett varumärke med denna information finns redan',
          message: 'Detta kan bero på att varumärket just skapades av någon annan. Försök uppdatera listan.'
        });
      }
      throw insertError;
    }
  } catch (error) {
    console.error('❌ Error creating brand:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create brand',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
    
    // Handle both string IDs (from mock) and ObjectIds (from MongoDB)
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    const result = await db.collection('brands_v2').updateOne(
      query,
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
    
    // Handle both string IDs (from mock) and ObjectIds (from MongoDB)
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    const result = await db.collection('brands_v2').deleteOne(query);
    
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
