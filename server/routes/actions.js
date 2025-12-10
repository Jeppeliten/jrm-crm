const express = require('express');
const router = express.Router();

// Mock action history storage
let mockActionHistory = [];

/**
 * Action types and their undo logic
 */
const ACTION_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete'
};

const ENTITY_TYPES = {
  COMPANY: 'company',
  BRAND: 'brand',
  AGENT: 'agent',
  TASK: 'task',
  CONTACT: 'contact',
  NOTE: 'note'
};

/**
 * POST /api/actions/history - Record an action
 * Body: { type, entity, entityId, data, previousData }
 */
router.post('/history', async (req, res) => {
  try {
    const { type, entity, entityId, data, previousData } = req.body;
    
    if (!type || !entity || !entityId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const action = {
      _id: Date.now().toString(),
      type,
      entity,
      entityId,
      data,
      previousData,
      timestamp: new Date(),
      userId: 'demo-user', // TODO: Get from auth
      undone: false
    };
    
    const db = req.app.locals.db;
    
    if (!db) {
      // Mock mode
      mockActionHistory.unshift(action);
      // Keep only last 100 actions
      if (mockActionHistory.length > 100) {
        mockActionHistory = mockActionHistory.slice(0, 100);
      }
      return res.status(201).json(action);
    }
    
    // Database mode
    await db.collection('action_history').insertOne(action);
    res.status(201).json(action);
    
  } catch (error) {
    console.error('Error recording action:', error);
    res.status(500).json({ error: 'Failed to record action' });
  }
});

/**
 * GET /api/actions/history - Get action history
 * Query params: limit, entity, entityId
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 50, entity, entityId } = req.query;
    const db = req.app.locals.db;
    
    if (!db) {
      // Mock mode
      let filtered = [...mockActionHistory];
      
      if (entity) {
        filtered = filtered.filter(a => a.entity === entity);
      }
      if (entityId) {
        filtered = filtered.filter(a => a.entityId === entityId);
      }
      
      return res.json(filtered.slice(0, parseInt(limit)));
    }
    
    // Database mode
    const query = {};
    if (entity) query.entity = entity;
    if (entityId) query.entityId = entityId;
    
    const actions = await db.collection('action_history')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    res.json(actions);
    
  } catch (error) {
    console.error('Error fetching action history:', error);
    res.status(500).json({ error: 'Failed to fetch action history' });
  }
});

/**
 * POST /api/actions/undo/:id - Undo an action
 */
router.post('/undo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = req.app.locals.db;
    
    // Find the action
    let action;
    if (!db) {
      action = mockActionHistory.find(a => a._id === id);
      if (!action) {
        return res.status(404).json({ error: 'Action not found' });
      }
      if (action.undone) {
        return res.status(400).json({ error: 'Action already undone' });
      }
    } else {
      action = await db.collection('action_history').findOne({ _id: id });
      if (!action) {
        return res.status(404).json({ error: 'Action not found' });
      }
      if (action.undone) {
        return res.status(400).json({ error: 'Action already undone' });
      }
    }
    
    // Perform undo based on action type
    const undoResult = await performUndo(action, db, req.app);
    
    // Mark action as undone
    if (!db) {
      action.undone = true;
      action.undoneAt = new Date();
    } else {
      await db.collection('action_history').updateOne(
        { _id: id },
        { $set: { undone: true, undoneAt: new Date() } }
      );
    }
    
    res.json({ 
      message: 'Action undone successfully', 
      action,
      undoResult 
    });
    
  } catch (error) {
    console.error('Error undoing action:', error);
    res.status(500).json({ error: 'Failed to undo action: ' + error.message });
  }
});

/**
 * Perform the actual undo operation
 */
async function performUndo(action, db, app) {
  const { type, entity, entityId, previousData, data } = action;
  
  // Get the appropriate collection/mock data
  let collection, mockData;
  
  switch(entity) {
    case ENTITY_TYPES.COMPANY:
      collection = 'companies_v2';
      // Access mock data from routes
      break;
    case ENTITY_TYPES.BRAND:
      collection = 'brands';
      break;
    case ENTITY_TYPES.AGENT:
      collection = 'agents_v2';
      break;
    default:
      throw new Error(`Unknown entity type: ${entity}`);
  }
  
  // Perform undo based on action type
  switch(type) {
    case ACTION_TYPES.CREATE:
      // Undo create = delete the entity
      if (db) {
        const query = entityId.match(/^[0-9a-fA-F]{24}$/)
          ? { _id: require('mongodb').ObjectId(entityId) }
          : { _id: entityId };
        await db.collection(collection).deleteOne(query);
      } else {
        // For mock mode, we'd need to remove from the mock arrays
        // This requires access to the route's mock data
        console.log(`Mock undo: Would delete ${entity} ${entityId}`);
      }
      return { operation: 'deleted', entityId };
      
    case ACTION_TYPES.UPDATE:
      // Undo update = restore previous data
      if (db) {
        const query = entityId.match(/^[0-9a-fA-F]{24}$/)
          ? { _id: require('mongodb').ObjectId(entityId) }
          : { _id: entityId };
        await db.collection(collection).updateOne(
          query,
          { $set: { ...previousData, updatedAt: new Date() } }
        );
      } else {
        console.log(`Mock undo: Would restore ${entity} ${entityId} to:`, previousData);
      }
      return { operation: 'restored', entityId, previousData };
      
    case ACTION_TYPES.DELETE:
      // Undo delete = recreate the entity
      if (db) {
        await db.collection(collection).insertOne({
          ...previousData,
          _id: previousData._id,
          restoredAt: new Date()
        });
      } else {
        console.log(`Mock undo: Would restore deleted ${entity}:`, previousData);
      }
      return { operation: 'recreated', entityId, previousData };
      
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

/**
 * GET /api/actions/stats - Get action statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    if (!db) {
      // Mock mode stats
      const stats = {
        total: mockActionHistory.length,
        byType: {
          create: mockActionHistory.filter(a => a.type === ACTION_TYPES.CREATE).length,
          update: mockActionHistory.filter(a => a.type === ACTION_TYPES.UPDATE).length,
          delete: mockActionHistory.filter(a => a.type === ACTION_TYPES.DELETE).length
        },
        byEntity: {
          company: mockActionHistory.filter(a => a.entity === ENTITY_TYPES.COMPANY).length,
          brand: mockActionHistory.filter(a => a.entity === ENTITY_TYPES.BRAND).length,
          agent: mockActionHistory.filter(a => a.entity === ENTITY_TYPES.AGENT).length,
          task: mockActionHistory.filter(a => a.entity === ENTITY_TYPES.TASK).length
        },
        undoable: mockActionHistory.filter(a => !a.undone).length
      };
      return res.json(stats);
    }
    
    // Database mode
    const [total, byType, byEntity, undoable] = await Promise.all([
      db.collection('action_history').countDocuments(),
      db.collection('action_history').aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]).toArray(),
      db.collection('action_history').aggregate([
        { $group: { _id: '$entity', count: { $sum: 1 } } }
      ]).toArray(),
      db.collection('action_history').countDocuments({ undone: { $ne: true } })
    ]);
    
    const stats = {
      total,
      byType: byType.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      byEntity: byEntity.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      undoable
    };
    
    res.json(stats);
    
  } catch (error) {
    console.error('Error fetching action stats:', error);
    res.status(500).json({ error: 'Failed to fetch action stats' });
  }
});

module.exports = router;
module.exports.ACTION_TYPES = ACTION_TYPES;
module.exports.ENTITY_TYPES = ENTITY_TYPES;
