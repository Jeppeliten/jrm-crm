const express = require('express');
const router = express.Router();

/**
 * POST /api/admin/cleanup - Remove test data
 * WARNING: This endpoint should be protected in production!
 */
router.post('/cleanup', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    console.log('🧹 Starting cleanup of test data...');

    const results = {
      companies: { deleted: 0, errors: [] },
      brands: { deleted: 0, errors: [] },
      agents: { deleted: 0, errors: [] }
    };

    // Delete test companies
    try {
      const companyResult = await db.collection('companies_v2').deleteMany({
        $or: [
          { name: { $regex: /test/i } },
          { email: { $regex: /test/i } }
        ]
      });
      results.companies.deleted = companyResult.deletedCount;
      console.log(`✅ Deleted ${companyResult.deletedCount} test companies`);
    } catch (error) {
      results.companies.errors.push(error.message);
      console.error('❌ Error deleting companies:', error);
    }

    // Delete test brands
    try {
      const brandResult = await db.collection('brands_v2').deleteMany({
        name: { $regex: /test/i }
      });
      results.brands.deleted = brandResult.deletedCount;
      console.log(`✅ Deleted ${brandResult.deletedCount} test brands`);
    } catch (error) {
      results.brands.errors.push(error.message);
      console.error('❌ Error deleting brands:', error);
    }

    // Delete test agents
    try {
      const agentResult = await db.collection('agents_v2').deleteMany({
        $or: [
          { name: { $regex: /test/i } },
          { email: { $regex: /test/i } }
        ]
      });
      results.agents.deleted = agentResult.deletedCount;
      console.log(`✅ Deleted ${agentResult.deletedCount} test agents`);
    } catch (error) {
      results.agents.errors.push(error.message);
      console.error('❌ Error deleting agents:', error);
    }

    console.log('✅ Cleanup complete!');

    res.json({
      success: true,
      message: 'Test data cleanup completed',
      results
    });

  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({ 
      error: 'Cleanup failed',
      message: error.message 
    });
  }
});

/**
 * GET /api/admin/stats - Get database statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const stats = {
      companies: await db.collection('companies_v2').countDocuments(),
      brands: await db.collection('brands_v2').countDocuments(),
      agents: await db.collection('agents_v2').countDocuments(),
      deals: await db.collection('deals').countDocuments(),
      tasks: await db.collection('tasks').countDocuments()
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
