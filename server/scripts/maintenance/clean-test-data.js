/**
 * Clean Test Data Script
 * Removes test/duplicate data from the database
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function cleanTestData() {
  const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
  
  if (!connectionString) {
    console.error('❌ COSMOS_DB_CONNECTION_STRING not found in environment variables');
    console.log('\nPlease set the connection string first:');
    console.log('  $env:COSMOS_DB_CONNECTION_STRING="your-connection-string"');
    process.exit(1);
  }
  
  const client = new MongoClient(connectionString);
  
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    
    const db = client.db('jrm-crm-db');
    
    // List all companies
    console.log('\n📊 Current companies in database:');
    const companies = await db.collection('companies_v2').find({}).toArray();
    console.log(`Found ${companies.length} companies:`);
    companies.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} (ID: ${c._id})`);
    });
    
    // Find duplicates by name
    const nameGroups = {};
    companies.forEach(c => {
      const name = c.name?.toLowerCase().trim();
      if (!nameGroups[name]) {
        nameGroups[name] = [];
      }
      nameGroups[name].push(c);
    });
    
    const duplicates = Object.entries(nameGroups).filter(([name, items]) => items.length > 1);
    
    if (duplicates.length > 0) {
      console.log('\n⚠️  Found duplicate companies:');
      duplicates.forEach(([name, items]) => {
        console.log(`  "${name}": ${items.length} copies`);
        items.forEach((item, i) => {
          console.log(`    ${i + 1}. ID: ${item._id}, Created: ${item.createdAt}`);
        });
      });
      
      // Keep only the oldest copy of each duplicate
      for (const [name, items] of duplicates) {
        const sorted = items.sort((a, b) => a.createdAt - b.createdAt);
        const toDelete = sorted.slice(1); // All except the first (oldest)
        
        console.log(`\n🗑️  Deleting ${toDelete.length} duplicate(s) of "${name}"...`);
        for (const item of toDelete) {
          await db.collection('companies_v2').deleteOne({ _id: item._id });
          console.log(`  ✅ Deleted ID: ${item._id}`);
        }
      }
    } else {
      console.log('\n✅ No duplicate companies found');
    }
    
    // Show remaining companies
    console.log('\n📊 Companies after cleanup:');
    const remainingCompanies = await db.collection('companies_v2').find({}).toArray();
    console.log(`Total: ${remainingCompanies.length} companies`);
    remainingCompanies.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} (ID: ${c._id})`);
    });
    
    console.log('\n✅ Cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
cleanTestData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
