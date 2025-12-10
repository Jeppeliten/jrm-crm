const express = require('express');
const router = express.Router();

/**
 * POST /api/batch/companies/update-status
 * Update status for multiple companies at once
 * Body: { companyIds: [], status: 'kund' | 'prospekt' }
 */
router.post('/companies/update-status', async (req, res) => {
  try {
    const { companyIds, status } = req.body;

    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid company IDs',
        message: 'Måste ange minst ett företags-ID' 
      });
    }

    if (!['kund', 'prospekt'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        message: 'Status måste vara "kund" eller "prospekt"' 
      });
    }

    const db = req.app.locals.db;

    if (!db) {
      return res.json({
        success: true,
        updated: companyIds.length,
        message: `${companyIds.length} företag uppdaterade till ${status} (mock mode)`
      });
    }

    const result = await db.collection('companies_v2').updateMany(
      { _id: { $in: companyIds.map(id => {
        try {
          return require('mongodb').ObjectId(id);
        } catch {
          return id;
        }
      })}},
      { $set: { status, updatedAt: new Date() } }
    );

    res.json({
      success: true,
      updated: result.modifiedCount,
      message: `${result.modifiedCount} företag uppdaterade till ${status}`
    });

  } catch (error) {
    console.error('Error batch updating companies:', error);
    res.status(500).json({ 
      error: 'Batch update failed',
      message: error.message 
    });
  }
});

/**
 * POST /api/batch/agents/update-status
 * Update status for multiple agents at once
 * Body: { agentIds: [], status: 'aktiv' | 'inaktiv' }
 */
router.post('/agents/update-status', async (req, res) => {
  try {
    const { agentIds, status } = req.body;

    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid agent IDs',
        message: 'Måste ange minst ett mäklar-ID' 
      });
    }

    if (!['aktiv', 'inaktiv'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        message: 'Status måste vara "aktiv" eller "inaktiv"' 
      });
    }

    const db = req.app.locals.db;

    if (!db) {
      return res.json({
        success: true,
        updated: agentIds.length,
        message: `${agentIds.length} mäklare uppdaterade till ${status} (mock mode)`
      });
    }

    const result = await db.collection('agents_v2').updateMany(
      { _id: { $in: agentIds.map(id => {
        try {
          return require('mongodb').ObjectId(id);
        } catch {
          return id;
        }
      })}},
      { 
        $set: { 
          status, 
          'brokerPackage.active': status === 'aktiv',
          updatedAt: new Date() 
        } 
      }
    );

    res.json({
      success: true,
      updated: result.modifiedCount,
      message: `${result.modifiedCount} mäklare uppdaterade till ${status}`
    });

  } catch (error) {
    console.error('Error batch updating agents:', error);
    res.status(500).json({ 
      error: 'Batch update failed',
      message: error.message 
    });
  }
});

/**
 * POST /api/batch/companies/assign-brand
 * Assign brand to multiple companies
 * Body: { companyIds: [], brandId: 'xxx' }
 */
router.post('/companies/assign-brand', async (req, res) => {
  try {
    const { companyIds, brandId } = req.body;

    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid company IDs',
        message: 'Måste ange minst ett företags-ID' 
      });
    }

    if (!brandId) {
      return res.status(400).json({ 
        error: 'Invalid brand ID',
        message: 'Måste ange varumärkes-ID' 
      });
    }

    const db = req.app.locals.db;

    if (!db) {
      return res.json({
        success: true,
        updated: companyIds.length,
        message: `${companyIds.length} företag tilldelade varumärke (mock mode)`
      });
    }

    // Get brand name
    const brand = await db.collection('brands_v2').findOne({
      _id: brandId.match(/^[0-9a-fA-F]{24}$/) 
        ? require('mongodb').ObjectId(brandId)
        : brandId
    });

    if (!brand) {
      return res.status(404).json({ 
        error: 'Brand not found',
        message: 'Varumärke hittades inte' 
      });
    }

    const result = await db.collection('companies_v2').updateMany(
      { _id: { $in: companyIds.map(id => {
        try {
          return require('mongodb').ObjectId(id);
        } catch {
          return id;
        }
      })}},
      { 
        $set: { 
          brandId: brand._id,
          brand: brand.name,
          updatedAt: new Date() 
        } 
      }
    );

    res.json({
      success: true,
      updated: result.modifiedCount,
      brandName: brand.name,
      message: `${result.modifiedCount} företag tilldelade ${brand.name}`
    });

  } catch (error) {
    console.error('Error batch assigning brand:', error);
    res.status(500).json({ 
      error: 'Batch assign failed',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/batch/companies
 * Delete multiple companies at once
 * Body: { companyIds: [] }
 */
router.delete('/companies', async (req, res) => {
  try {
    const { companyIds } = req.body;

    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid company IDs',
        message: 'Måste ange minst ett företags-ID' 
      });
    }

    const db = req.app.locals.db;

    if (!db) {
      return res.json({
        success: true,
        deleted: companyIds.length,
        message: `${companyIds.length} företag borttagna (mock mode)`
      });
    }

    // Check for associated agents
    const agentCount = await db.collection('agents_v2').countDocuments({
      companyId: { $in: companyIds }
    });

    if (agentCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete companies with agents',
        message: `${agentCount} mäklare är kopplade till dessa företag. Ta bort mäklarna först.`,
        agentCount
      });
    }

    const result = await db.collection('companies_v2').deleteMany({
      _id: { $in: companyIds.map(id => {
        try {
          return require('mongodb').ObjectId(id);
        } catch {
          return id;
        }
      })}
    });

    res.json({
      success: true,
      deleted: result.deletedCount,
      message: `${result.deletedCount} företag borttagna`
    });

  } catch (error) {
    console.error('Error batch deleting companies:', error);
    res.status(500).json({ 
      error: 'Batch delete failed',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/batch/agents
 * Delete multiple agents at once
 * Body: { agentIds: [] }
 */
router.delete('/agents', async (req, res) => {
  try {
    const { agentIds } = req.body;

    if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid agent IDs',
        message: 'Måste ange minst ett mäklar-ID' 
      });
    }

    const db = req.app.locals.db;

    if (!db) {
      return res.json({
        success: true,
        deleted: agentIds.length,
        message: `${agentIds.length} mäklare borttagna (mock mode)`
      });
    }

    const result = await db.collection('agents_v2').deleteMany({
      _id: { $in: agentIds.map(id => {
        try {
          return require('mongodb').ObjectId(id);
        } catch {
          return id;
        }
      })}
    });

    // Update aggregations for affected companies
    const { updateAllAggregations } = require('../services/aggregation-service');
    // This is simplified - in production, track which companies were affected
    
    res.json({
      success: true,
      deleted: result.deletedCount,
      message: `${result.deletedCount} mäklare borttagna`
    });

  } catch (error) {
    console.error('Error batch deleting agents:', error);
    res.status(500).json({ 
      error: 'Batch delete failed',
      message: error.message 
    });
  }
});

module.exports = router;
