const express = require('express');
const router = express.Router();

// Mock data loader
const { loadMockData } = require('../services/databaseService');

/**
 * Apply task filters based on query parameters
 */
function applyTaskFilters(tasks, filter) {
  const now = new Date();
  
  switch (filter) {
    case 'overdue':
      return tasks.filter(t => !t.done && new Date(t.dueDate) < now);
    
    case 'today':
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      return tasks.filter(t => {
        const dueDate = new Date(t.dueDate);
        return !t.done && dueDate >= todayStart && dueDate < todayEnd;
      });
    
    case 'week':
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return tasks.filter(t => !t.done && new Date(t.dueDate) <= weekEnd);
    
    case 'my':
      // Would filter by current user - for now return all undone
      return tasks.filter(t => !t.done);
    
    case 'all':
    default:
      return tasks;
  }
}

/**
 * GET /api/tasks - Get all tasks aggregated from brands, companies, agents
 * Query params:
 *   - filter: all | my | overdue | today | week
 *   - entityType: brand | company | agent (optional filter)
 *   - entityId: specific entity ID (optional)
 *   - done: true | false (optional)
 */
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { filter = 'all', entityType, entityId, done } = req.query;
    
    // Use mock data if no database
    if (!db) {
      console.log('📦 Aggregating tasks from mock data');
      const mockData = loadMockData();
      let allTasks = [];
      
      // Aggregate tasks from brands
      if (mockData.brands) {
        mockData.brands.forEach(brand => {
          if (brand.tasks && Array.isArray(brand.tasks)) {
            brand.tasks.forEach(task => {
              allTasks.push({
                ...task,
                entityType: 'brand',
                entityId: brand._id,
                entityName: brand.name
              });
            });
          }
        });
      }
      
      // Aggregate tasks from companies (if they have tasks)
      if (mockData.companies) {
        mockData.companies.forEach(company => {
          if (company.tasks && Array.isArray(company.tasks)) {
            company.tasks.forEach(task => {
              allTasks.push({
                ...task,
                entityType: 'company',
                entityId: company._id,
                entityName: company.name
              });
            });
          }
        });
      }
      
      // Apply filters
      if (entityType) {
        allTasks = allTasks.filter(t => t.entityType === entityType);
      }
      if (entityId) {
        allTasks = allTasks.filter(t => t.entityId === entityId);
      }
      if (done !== undefined) {
        const isDone = done === 'true';
        allTasks = allTasks.filter(t => t.done === isDone);
      }
      
      // Apply time-based filters
      allTasks = applyTaskFilters(allTasks, filter);
      
      // Sort by due date (earliest first)
      allTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      
      return res.json(allTasks);
    }
    
    // Database aggregation
    const aggregation = [
      {
        $lookup: {
          from: 'brands',
          localField: 'brandId',
          foreignField: '_id',
          as: 'brand'
              if (!db) {
                return res.status(503).json({ error: 'Database not available' });
              }
 */
router.get('/stats', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
      if (!db) {
        return res.status(503).json({ error: 'Database not available' });
      }
    
    // Database aggregation
    const tasks = await db.collection('tasks').find({}).toArray();
    const now = new Date();
    
    const stats = {
      total: tasks.length,
      completed: tasks.filter(t => t.done).length,
      pending: tasks.filter(t => !t.done).length,
      overdue: tasks.filter(t => !t.done && new Date(t.dueDate) < now).length,
      today: tasks.filter(t => {
        const dueDate = new Date(t.dueDate);
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        return !t.done && dueDate >= todayStart && dueDate < todayEnd;
      }).length,
      thisWeek: tasks.filter(t => {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return !t.done && new Date(t.dueDate) <= weekEnd;
      }).length
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error calculating task stats:', error);
    res.status(500).json({ error: 'Failed to calculate task stats' });
  }
});

/**
 * POST /api/tasks - Create a new task
 */
router.post('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { title, dueAt, ownerId, entityType, entityId, done } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const task = {
      title,
      dueAt: dueAt ? new Date(dueAt) : null,
      dueDate: dueAt ? new Date(dueAt) : null, // For compatibility
      ownerId: ownerId || null,
      entityType: entityType || null,
      entityId: entityId || null,
      done: done || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('tasks').insertOne(task);
    
    res.status(201).json({
      success: true,
      task: { ...task, _id: result.insertedId, id: result.insertedId.toString() }
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * PUT /api/tasks/:id - Update a task
 */
router.put('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { ObjectId } = require('mongodb');
    const taskId = req.params.id;
    const { title, dueAt, ownerId, entityType, entityId, done } = req.body;

    const updateData = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (dueAt !== undefined) {
      updateData.dueAt = dueAt ? new Date(dueAt) : null;
      updateData.dueDate = dueAt ? new Date(dueAt) : null;
    }
    if (ownerId !== undefined) updateData.ownerId = ownerId;
    if (entityType !== undefined) updateData.entityType = entityType;
    if (entityId !== undefined) updateData.entityId = entityId;
    if (done !== undefined) updateData.done = done;

    let filter;
    try {
      filter = { _id: new ObjectId(taskId) };
    } catch {
      filter = { _id: taskId };
    }

    const result = await db.collection('tasks').updateOne(filter, { $set: updateData });
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true, modified: result.modifiedCount });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * DELETE /api/tasks/:id - Delete a task
 */
router.delete('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const { ObjectId } = require('mongodb');
    const taskId = req.params.id;

    let filter;
    try {
      filter = { _id: new ObjectId(taskId) };
    } catch {
      filter = { _id: taskId };
    }

    const result = await db.collection('tasks').deleteOne(filter);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
