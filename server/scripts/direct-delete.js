/**
 * Direct MongoDB Delete via Connection String
 * Run this with: COSMOS_CONNECTION="your-string" node scripts/direct-delete.js
 */

const { MongoClient } = require('mongodb');

async function deleteTestData() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   Direct Cosmos DB Cleanup                           ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Get connection string from environment or Azure App Service
  const connectionString = process.env.COSMOS_CONNECTION || process.env.COSMOS_DB_CONNECTION_STRING;

  if (!connectionString) {
    console.log('❌ Connection string saknas!\n');
    console.log('Kör scriptet så här:');
    console.log('  $env:COSMOS_CONNECTION="din-connection-string"');
    console.log('  node scripts/direct-delete.js\n');
    console.log('Eller hämta connection string från Azure Portal:');
    console.log('  Cosmos DB → Connection strings → Copy Primary Connection String\n');
    return;
  }

  const client = new MongoClient(connectionString);

  try {
    console.log('🔌 Ansluter till Cosmos DB...\n');
    await client.connect();
    console.log('✅ Ansluten!\n');

    const db = client.db('jrm-crm-db');

    // Items to delete
    const deletions = [
      { collection: 'companies_v2', id: '1764936418689', name: 'Test AB' },
      { collection: 'brands_v2', id: '1765150139534', name: 'test' },
      { collection: 'agents_v2', id: '1765151362488', name: 'test' }
    ];

    for (const item of deletions) {
      console.log(`🗑️  Raderar: ${item.name} från ${item.collection}...`);
      
      try {
        const result = await db.collection(item.collection).deleteOne({ _id: item.id });
        
        if (result.deletedCount > 0) {
          console.log(`  ✅ Raderad!\n`);
        } else {
          console.log(`  ⚠️  Hittades inte (kanske redan borttagen)\n`);
        }
      } catch (error) {
        console.log(`  ❌ Fel: ${error.message}\n`);
      }
    }

    // Verify cleanup
    console.log('📊 Verifierar...\n');
    
    const companies = await db.collection('companies_v2').find({}).toArray();
    const brands = await db.collection('brands_v2').find({}).toArray();
    const agents = await db.collection('agents_v2').find({}).toArray();

    console.log(`Företag kvar: ${companies.length}`);
    companies.forEach(c => console.log(`  - ${c.name}`));
    
    console.log(`\nVarumärken kvar: ${brands.length}`);
    brands.forEach(b => console.log(`  - ${b.name}`));
    
    console.log(`\nMäklare kvar: ${agents.length}`);
    agents.forEach(a => console.log(`  - ${a.name}`));

    console.log('\n✅ Cleanup klar!');
    console.log('💡 Nu kan du skapa nya företag/varumärken/mäklare utan problem!\n');

  } catch (error) {
    console.error('\n❌ Fel vid anslutning:', error.message);
    console.log('\nKontrollera att connection string är korrekt.');
    console.log('Hämta den från: Azure Portal → Cosmos DB → Connection strings\n');
  } finally {
    await client.close();
  }
}

deleteTestData();
