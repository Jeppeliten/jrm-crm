const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function seed() {
    const uri = process.env.MONGODB_CONNECTION_STRING;
    if (!uri) {
        console.error('Please set MONGODB_CONNECTION_STRING in your environment');
        process.exit(1);
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log('Connected to database');
        const db = client.db();

        // Read the brokers.json generated from the Excel
        const dataPath = path.join(__dirname, '../src/data/brokers.json');
        const brokers = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        console.log(`Inserting ${brokers.length} brokers into Cosmos DB...`);

        const collection = db.collection('brokers');

        // Clear existing data
        await collection.deleteMany({});

        // Batch insert
        const result = await collection.insertMany(brokers);
        console.log(`Successfully inserted ${result.insertedCount} records!`);

        // Create indexes for search performance
        await collection.createIndex({ brokerage: 1 });
        await collection.createIndex({ brand: 1 });
        await collection.createIndex({ firstName: 'text', lastName: 'text' });

        console.log('Database seeded and indexed.');
    } catch (err) {
        console.error('Seed failed:', err);
    } finally {
        await client.close();
    }
}

seed();
