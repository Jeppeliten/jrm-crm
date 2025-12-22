const { app } = require('@azure/functions');
const { connectToDatabase } = require('../lib/db');

app.http('updatePipeline', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const { entityName, newStage } = await request.json();
            const db = await connectToDatabase();

            // Update the lead status in Cosmos DB
            await db.collection('pipeline').updateOne(
                { entityName: entityName },
                { $set: { stage: newStage, updatedAt: new Date() } },
                { upsert: true }
            );

            return { status: 200, body: JSON.stringify({ message: "Pipeline updated" }) };
        } catch (error) {
            return { status: 500, body: error.message };
        }
    }
});
