/**
 * Delete via Cosmos DB REST API
 * Direct deletion using Azure credentials
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function deleteDocuments() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   Azure Cosmos DB - Direct Delete                    ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  const resourceGroup = 'rg-jrm-crm-prod';
  const accountName = 'jrm-crm-cosmosdb-prod';
  const databaseName = 'jrm-crm-db';
  
  const itemsToDelete = [
    { collection: 'companies_v2', id: '1764936418689', name: 'Test AB' },
    { collection: 'brands_v2', id: '1765150139534', name: 'test' },
    { collection: 'agents_v2', id: '1765151362488', name: 'test' }
  ];

  try {
    console.log('🔑 Kontrollerar Azure CLI inloggning...\n');
    
    try {
      await execPromise('az account show');
      console.log('✅ Azure CLI är inloggad\n');
    } catch {
      console.log('❌ Du måste logga in med Azure CLI först:');
      console.log('   az login\n');
      process.exit(1);
    }

    for (const item of itemsToDelete) {
      console.log(`🗑️  Tar bort: ${item.name} från ${item.collection}...`);
      
      const cmd = `az cosmosdb mongodb collection show ` +
                  `--account-name ${accountName} ` +
                  `--database-name ${databaseName} ` +
                  `--name ${item.collection} ` +
                  `--resource-group ${resourceGroup}`;
      
      try {
        const { stdout } = await execPromise(cmd);
        console.log(`  ✅ Collection ${item.collection} finns`);
        
        // Use mongosh or REST API to delete specific document
        console.log(`  ℹ️  ID: ${item.id}`);
        console.log(`  ⚠️  Manuell borttagning krävs via Azure Portal Data Explorer`);
        
      } catch (error) {
        console.log(`  ⚠️  Collection ${item.collection} finns inte eller åtkomst nekad`);
      }
    }

    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║   MANUELL BORTTAGNING KRÄVS                          ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
    console.log('Azure Portal → Cosmos DB → Data Explorer:\n');
    
    itemsToDelete.forEach((item, i) => {
      console.log(`${i + 1}. ${item.collection}:`);
      console.log(`   - Sök efter _id: "${item.id}"`);
      console.log(`   - Högerklicka → Delete Document\n`);
    });

    console.log('ELLER skapa nya poster med unika namn i appen!\n');

  } catch (error) {
    console.error('❌ Fel:', error.message);
  }
}

deleteDocuments();
