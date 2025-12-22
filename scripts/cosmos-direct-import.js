// Direktimport till Cosmos DB (Mongo API) utan API-throttling
// Kör: node scripts/cosmos-direct-import.js --file "C:/Users/Public/Final.xlsx" --conn "<COSMOS_CONN_STRING>" --db crm_database

const { MongoClient } = require('mongodb');
const xlsx = require('xlsx');
const minimist = require('minimist');

const args = minimist(process.argv.slice(2));
const filePath = args.file;
const connStr = args.conn;
const dbName = args.db || 'crm_database';
const chunkSize = parseInt(args.chunk || 100, 10);

if (!filePath || !connStr) {
  console.error('Usage: node cosmos-direct-import.js --file <path> --conn <COSMOS_CONN_STRING> [--db crm_database] [--chunk 100]');
  process.exit(1);
}

(async () => {
  const workbook = xlsx.readFile(filePath);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(firstSheet);
  console.log(`Loaded ${rows.length} rows from ${workbook.SheetNames[0]}`);

  const client = new MongoClient(connStr, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  const db = client.db(dbName);

  // Exempel: importera till companies_v2 (byt till rätt collection för agents/brands)
  const collection = db.collection('companies_v2');

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await collection.insertMany(chunk, { ordered: false }).catch(e => console.log('Insert error (dubblett eller validering):', e.message));
    console.log(`Inserted ${Math.min(i + chunkSize, rows.length)}/${rows.length}`);
  }

  await client.close();
  console.log('Import done.');
})();
