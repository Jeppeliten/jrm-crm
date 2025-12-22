const express = require('express');
const router = express.Router();
const { getBrandAggregatedStats } = require('../services/aggregation-service');

// ...existing code...

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

/**
 * POST /api/brands/:id/contacts - Add contact to brand
 */
router.post('/:id/contacts', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const { name, role, email, phone } = req.body;
    
    
    const newContact = {
      id: `contact-${Date.now()}`,
      name,
      role,
      email,
      phone,
      createdAt: new Date()
    };
    
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    const result = await db.collection('brands_v2').updateOne(
      query,
      { 
        $push: { contacts: newContact },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.status(201).json(newContact);
  } catch (error) {
    console.error('Error adding contact:', error);
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

/**
 * DELETE /api/brands/:id/contacts/:contactId - Remove contact from brand
 */
router.delete('/:id/contacts/:contactId', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id, contactId } = req.params;
    
        if (!db) {
          return res.status(503).json({ error: 'Database not available' });
        }
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    const result = await db.collection('brands_v2').updateOne(
      query,
      { 
        $pull: { contacts: { id: contactId } },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

/**
 * POST /api/brands/:id/tasks - Add task to brand
 */
router.post('/:id/tasks', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const { title, description, dueAt, ownerId } = req.body;
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const newTask = {
      id: `task-${Date.now()}`,
      title,
      description,
      dueAt: dueAt ? new Date(dueAt) : null,
      done: false,
      ownerId,
      createdAt: new Date()
    };
    
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    const result = await db.collection('brands_v2').updateOne(
      query,
      { 
        $push: { tasks: newTask },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).json({ error: 'Failed to add task' });
  }
});

/**
 * PUT /api/brands/:id/tasks/:taskId - Update task
 */
router.put('/:id/tasks/:taskId', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id, taskId } = req.params;
    const { title, description, dueAt, done } = req.body;
    
    if (!db) {
      const brand = mockBrands.find(b => b._id === id);
      if (!db) {
        return res.status(503).json({ error: 'Database not available' });
      }
    }
    
    const updateFields = {};
    if (title !== undefined) updateFields['tasks.$.title'] = title;
    if (description !== undefined) updateFields['tasks.$.description'] = description;
    if (dueAt !== undefined) updateFields['tasks.$.dueAt'] = dueAt ? new Date(dueAt) : null;
    if (done !== undefined) updateFields['tasks.$.done'] = done;
    updateFields['tasks.$.updatedAt'] = new Date();
    updateFields['updatedAt'] = new Date();
    
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id), 'tasks.id': taskId }
      : { _id: id, 'tasks.id': taskId };
    
    const result = await db.collection('brands_v2').updateOne(
      query,
      { $set: updateFields }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Brand or task not found' });
    }
    
    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * DELETE /api/brands/:id/tasks/:taskId - Delete task
 */
router.delete('/:id/tasks/:taskId', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id, taskId } = req.params;
    
    if (!db) {
      const brand = mockBrands.find(b => b._id === id);
      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }
      
      brand.tasks = brand.tasks.filter(t => t.id !== taskId);
      brand.updatedAt = new Date();
      
      return res.json({ message: 'Task deleted successfully' });
    }
    
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    const result = await db.collection('brands_v2').updateOne(
      query,
      { 
        $pull: { tasks: { id: taskId } },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

/**
 * POST /api/brands/:id/notes - Add note to brand
 */
router.post('/:id/notes', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const { text, authorId } = req.body;
    
    if (!db) {
      const brand = mockBrands.find(b => b._id === id);
      if (!db) {
        return res.status(503).json({ error: 'Database not available' });
      }
    }
    
    const newNote = {
      id: `note-${Date.now()}`,
      text,
      authorId,
      createdAt: new Date()
    };
    
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    const result = await db.collection('brands_v2').updateOne(
      query,
      { 
        $push: { notes: newNote },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.status(201).json(newNote);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

/**
 * DELETE /api/brands/:id/notes/:noteId - Delete note
 */
router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id, noteId } = req.params;
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
      
      return res.json({ message: 'Note deleted successfully' });
    }
    
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    const result = await db.collection('brands_v2').updateOne(
      query,
      { 
        $pull: { notes: { id: noteId } },
        $set: { updatedAt: new Date() }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

/**
 * PUT /api/brands/:id/central-contract - Update central contract
 */
router.put('/:id/central-contract', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const { active, product, mrr } = req.body;
    
    if (!db) {
      const brand = mockBrands.find(b => b._id === id);
      if (!brand) {
        return res.status(404).json({ error: 'Brand not found' });
      }
      
      if (!brand.centralContract) brand.centralContract = {};
      if (active !== undefined) brand.centralContract.active = active;
      if (product !== undefined) brand.centralContract.product = product;
      if (mrr !== undefined) brand.centralContract.mrr = mrr;
      brand.updatedAt = new Date();
      
      return res.json(brand.centralContract);
    }
    
    const updateFields = { updatedAt: new Date() };
    if (active !== undefined) updateFields['centralContract.active'] = active;
    if (product !== undefined) updateFields['centralContract.product'] = product;
    if (mrr !== undefined) updateFields['centralContract.mrr'] = mrr;
    
    const query = id.match(/^[0-9a-fA-F]{24}$/) 
      ? { _id: require('mongodb').ObjectId(id) }
      : { _id: id };
    
    const result = await db.collection('brands_v2').updateOne(
      query,
      { $set: updateFields }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    
    res.json({ message: 'Central contract updated successfully' });
  } catch (error) {
    console.error('Error updating central contract:', error);
    res.status(500).json({ error: 'Failed to update central contract' });
  }
});

module.exports = router;
