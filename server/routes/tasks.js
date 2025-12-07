const express = require('express');
const router = express.Router();

// 🧪 TEMPORARY: In-memory storage for testing
let mockTasks = [
  {
    _id: '1',
    title: 'Test uppgift',
    description: 'Detta är en test',
    assignedTo: 'Test User',
    dueDate: new Date(),
    priority: 'medium',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

/**
 * GET /api/tasks - Get all tasks
 */
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Use mock data if no database
    if (!db) {
      console.log('📦 Using mock tasks data');
      return res.json(mockTasks);
    }
    
    const tasks = await db.collection('tasks').find({}).toArray();
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * POST /api/tasks - Create new task
 */
router.post('/', async (req, res) => {
  try {
    console.log('🔵 POST /api/tasks called');
    console.log('🔵 Request body:', req.body);
    
    const db = req.app.locals.db;
    const { title, description, assignedTo, dueDate, priority } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const task = {
      _id: Date.now().toString(),
      title,
      description,
      assignedTo,
      dueDate,
      priority: priority || 'medium',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Use mock storage if no database
    if (!db) {
      console.log('📦 Saving to mock tasks storage:', task);
      mockTasks.push(task);
      return res.status(201).json(task);
    }
    
    const result = await db.collection('tasks').insertOne(task);
    res.status(201).json({ ...task, _id: result.insertedId });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * PUT /api/tasks/:id - Update task
 */
router.put('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData._id;
    
    const result = await db.collection('tasks').updateOne(
      { _id: require('mongodb').ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * DELETE /api/tasks/:id - Delete task
 */
router.delete('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    
    const result = await db.collection('tasks').deleteOne(
      { _id: require('mongodb').ObjectId(id) }
    );
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
