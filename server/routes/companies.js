const express = require('express');
const router = express.Router();

// 🧪 TEMPORARY: In-memory storage for testing (replace with real DB later)
let mockCompanies = [
  {
    _id: '1',
    name: 'Test Företag AB',
    orgNumber: '556123-4567',
    email: 'info@test.se',
    phone: '08-123 45 67',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

/**
 * GET /api/companies - Get all companies
 */
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Use mock data if no database
    if (!db) {
      console.log('📦 Using mock companies data');
      return res.json(mockCompanies);
    }
    
    const companies = await db.collection('companies_v2').find({}).toArray();
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
    console.log('🔹 POST /api/companies called');
    console.log('🔹 Request body:', req.body);
    console.log('🔹 DB available:', !!req.app.locals.db);
    
    const db = req.app.locals.db;
    const { name, orgNumber, email, phone, address } = req.body;
    
    if (!name || !name.trim()) {
      console.log('❌ Validation failed: Name required');
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
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockCompany = { ...company, _id: Date.now().toString() };
      mockCompanies.push(mockCompany);
      console.log('✅ Company saved to mock storage, total companies:', mockCompanies.length);
      return res.status(201).json(mockCompany);
    }
    
    // Escape special regex characters and check for existing company (case-insensitive)
    const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingCompany = await db.collection('companies_v2').findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') }
    });
    
    if (existingCompany) {
      console.log('⚠️  Company with this name already exists:', existingCompany.name);
      return res.status(409).json({ 
        error: 'Ett företag med detta namn finns redan',
        message: `Företaget "${existingCompany.name}" är redan registrerat. Vänligen använd ett annat namn.`,
        suggestion: `Försök med "${name.trim()} AB" eller lägg till ett organisationsnummer för att skilja dem åt.`
      });
    }
    
    // Clean the incoming data - ensure no _id field
    const company = {
      name: name.trim(),
      orgNumber: orgNumber?.trim() || '',
      email: email?.trim() || '',
      phone: phone?.trim() || '',
      address: address?.trim() || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('💾 Saving to Cosmos DB...');
    console.log('💾 Document to insert:', company);
    
    try {
      const result = await db.collection('companies_v2').insertOne(company);
      console.log('✅ Company saved to DB with ID:', result.insertedId);
      res.status(201).json({ ...company, _id: result.insertedId });
    } catch (insertError) {
      // Handle MongoDB duplicate key error specifically
      if (insertError.code === 11000) {
        console.error('❌ Duplicate key error despite pre-check:', insertError);
        return res.status(409).json({ 
          error: 'Ett företag med denna information finns redan i databasen',
          message: 'Detta kan bero på att företaget just skapades av någon annan. Försök uppdatera listan.'
        });
      }
      throw insertError; // Re-throw other errors
    }
    console.log('✅ Company saved to DB with ID:', result.insertedId);
    res.status(201).json({ ...company, _id: result.insertedId });
  } catch (error) {
    console.error('❌ Error creating company:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    
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
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData._id;
    
    const result = await db.collection('companies').updateOne(
      { _id: require('mongodb').ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    res.json({ message: 'Company updated successfully' });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Failed to update company' });
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

module.exports = router;
