const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_CONNECTION_STRING;
let client;

async function connectToDatabase() {
    if (client) return client.db();

    if (!uri) {
        throw new Error('MONGODB_CONNECTION_STRING is not defined');
    }

    client = new MongoClient(uri);
    await client.connect();
    return client.db();
}

module.exports = { connectToDatabase };
