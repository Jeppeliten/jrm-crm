const { app } = require('@azure/functions');
const { connectToDatabase } = require('../lib/db');

app.http('getBrokers', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const db = await connectToDatabase();
            const collection = db.collection('brokers');

            // For now, return a placeholder or actual data if DB is connected
            // In a real scenario, we'd fetch from Cosmos DB
            const brokers = await collection.find({}).limit(100).toArray();

            return {
                status: 200,
                body: JSON.stringify(brokers),
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        } catch (error) {
            context.log(`Error: ${error.message}`);
            return {
                status: 500,
                body: JSON.stringify({ error: 'Failed to fetch brokers', message: error.message })
            };
        }
    }
});
