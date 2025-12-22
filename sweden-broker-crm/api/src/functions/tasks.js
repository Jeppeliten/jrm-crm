const { app } = require('@azure/functions');
const { connectToDatabase } = require('../lib/db');
const { ObjectId } = require('mongodb');

// GET Tasks
app.http('getTasks', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const db = await connectToDatabase();
            const tasks = await db.collection('tasks').find({}).toArray();
            return { status: 200, body: JSON.stringify(tasks) };
        } catch (error) {
            return { status: 500, body: error.message };
        }
    }
});

// CREATE Task
app.http('createTask', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const task = await request.json();
            const db = await connectToDatabase();
            const result = await db.collection('tasks').insertOne({
                ...task,
                createdAt: new Date(),
                status: 'pending'
            });
            return { status: 201, body: JSON.stringify(result) };
        } catch (error) {
            return { status: 500, body: error.message };
        }
    }
});

// UPDATE Task (Complete/Edit)
app.http('updateTask', {
    methods: ['PATCH'],
    authLevel: 'anonymous',
    route: 'tasks/{id}',
    handler: async (request, context) => {
        try {
            const id = request.params.id;
            const updates = await request.json();
            const db = await connectToDatabase();
            await db.collection('tasks').updateOne(
                { _id: new ObjectId(id) },
                { $set: updates }
            );
            return { status: 200, body: 'Updated' };
        } catch (error) {
            return { status: 500, body: error.message };
        }
    }
});
