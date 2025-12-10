const express = require('express');
const router = express.Router();
const { getBrandAggregatedStats } = require('../services/aggregation-service');

// 🧪 TEMPORARY: In-memory storage for testing
let mockBrands = [
  { 
    _id: 'mock1', 
    name: 'ERA Mäklare', 
    description: 'Internationellt fastighetsmäklarnätverk',
    website: 'https://www.era.se',
    centralContract: {
      active: true,
      mrr: 125000,
      startDate: new Date('2024-01-01'),
      contactPerson: 'Anders Svensson',
      contactEmail: 'anders@era.se'
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },
  { 
    _id: 'mock2', 
    name: 'Mäklarhuset', 
    description: 'Sveriges största mäklarkedja',
    website: 'https://www.maklarhuset.se',
    centralContract: {
      active: false
    },
    createdAt: new Date('2023-06-15'),
    updatedAt: new Date()
  },
  { 
    _id: 'mock3', 
    name: 'Svensk Fastighetsförmedling', 
    description: 'Rikstäckande fastighetsmäklare',
    website: 'https://www.svenskfast.se',
    centralContract: {
      active: false
    },
    createdAt: new Date('2023-08-20'),
    updatedAt: new Date()
  },
  { 
    _id: 'mock4', 
    name: 'Fastighetsbyrån', 
    description: 'Premiumfastigheter i storstadsregioner',
    website: 'https://www.fastighetsbyran.se',
    centralContract: {
      active: true,
      mrr: 85000,
      startDate: new Date('2024-06-01'),
      contactPerson: 'Maria Karlsson',
      contactEmail: 'maria@fastighetsbyran.se'
    },
    createdAt: new Date('2024-05-10'),
    updatedAt: new Date()
  },
  { 
    _id: 'mock5', 
    name: 'Notar', 
    description: 'Familjeägd mäklarkedja',
    website: 'https://www.notar.se',
    centralContract: {
      active: false
    },
    createdAt: new Date('2023-11-05'),
    updatedAt: new Date()
  }
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
 * GET /api/brands/:id/stats - Get statistics for a specific brand
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    
    if (!db) {
      return res.json({ agentCount: 0, companyId: null });
    }
    
    // Använd aggregation service för fullständig statistik
    const stats = await getBrandAggregatedStats(db, id);
    
    // Hämta brand för att få companyId
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    const brand = await db.collection('brands_v2').findOne(query);
    
    res.json({ ...stats, companyId: brand?.companyId || null });
  } catch (error) {
    console.error('Error fetching brand stats:', error);
    res.status(500).json({ error: 'Failed to fetch brand stats' });
  }
});

/**
 * GET /api/brands/:id - Get brand by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { ObjectId } = require('mongodb');
    
    if (!db) {
      const brand = mockBrands.find(b => b._id === req.params.id);
      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }
      return res.json(brand);
    }
    
    let query;
    try {
      query = { _id: new ObjectId(req.params.id) };
    } catch (e) {
      query = { _id: req.params.id };
    }
    
    const brand = await db.collection('brands_v2').findOne(query);
    
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.json(brand);
  } catch (error) {
    console.error('Error fetching brand:', error);
    res.status(500).json({ error: 'Failed to fetch brand' });
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
      companyId: companyId || null,
      agentCount: 0,
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
