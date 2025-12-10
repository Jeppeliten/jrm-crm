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
        }
      },
      { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'companies',
          localField: 'companyId',
          foreignField: '_id',
          as: 'company'
        }
      },
      { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          entityType: {
            $cond: [{ $ne: ['$brandId', null] }, 'brand', 
              { $cond: [{ $ne: ['$companyId', null] }, 'company', 'general'] }
            ]
          },
          entityName: {
            $cond: [{ $ne: ['$brand.name', null] }, '$brand.name', '$company.name']
          }
        }
      }
    ];
    
    const tasks = await db.collection('tasks').aggregate(aggregation).toArray();
    let filteredTasks = applyTaskFilters(tasks, filter);
    
    if (entityType) {
      filteredTasks = filteredTasks.filter(t => t.entityType === entityType);
    }
    if (entityId) {
      filteredTasks = filteredTasks.filter(t => 
        (t.brandId && t.brandId.toString() === entityId) ||
        (t.companyId && t.companyId.toString() === entityId)
      );
    }
    if (done !== undefined) {
      const isDone = done === 'true';
      filteredTasks = filteredTasks.filter(t => t.done === isDone);
    }
    
    res.json(filteredTasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * GET /api/tasks/stats - Get task statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Use mock data if no database
    if (!db) {
      console.log('📦 Calculating task stats from mock data');
      const mockData = loadMockData();
      let allTasks = [];
      
      // Aggregate from all entities
      if (mockData.brands) {
        mockData.brands.forEach(brand => {
          if (brand.tasks) {
            allTasks.push(...brand.tasks.map(t => ({ ...t, entityType: 'brand' })));
          }
        });
      }
      if (mockData.companies) {
        mockData.companies.forEach(company => {
          if (company.tasks) {
            allTasks.push(...company.tasks.map(t => ({ ...t, entityType: 'company' })));
          }
        });
      }
      
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      const stats = {
        total: allTasks.length,
        completed: allTasks.filter(t => t.done).length,
        pending: allTasks.filter(t => !t.done).length,
        overdue: allTasks.filter(t => !t.done && new Date(t.dueDate) < now).length,
        today: allTasks.filter(t => {
          const dueDate = new Date(t.dueDate);
          return !t.done && dueDate >= todayStart && dueDate < todayEnd;
        }).length,
        thisWeek: allTasks.filter(t => !t.done && new Date(t.dueDate) <= weekEnd).length,
        byEntity: {
          brand: allTasks.filter(t => t.entityType === 'brand').length,
          company: allTasks.filter(t => t.entityType === 'company').length,
          agent: allTasks.filter(t => t.entityType === 'agent').length
        }
      };
      
      return res.json(stats);
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

module.exports = router;
