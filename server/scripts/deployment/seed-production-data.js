/**
 * Cosmos DB Setup & Data Seeding Script
 * 
 * Detta script:
 * 1. Skapar Cosmos DB containers om de inte finns
 * 2. Seedar initial produktionsdata (brands, companies, agents)
 * 3. Verifierar att allt fungerar korrekt
 * 
 * Kör med: node scripts/deployment/seed-production-data.js
 * 
 * VIKTIGT: Sätt environment variabler först:
 * - COSMOS_ENDPOINT
 * - COSMOS_KEY
 * - COSMOS_DATABASE
 */

require('dotenv').config();
const { CosmosClient } = require('@azure/cosmos');

// Validera environment variabler
if (!process.env.COSMOS_ENDPOINT || !process.env.COSMOS_KEY || !process.env.COSMOS_DATABASE) {
  console.error('❌ Saknade environment variabler!');
  console.error('Behöver: COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DATABASE');
  console.error('Se .env.example för exempel');
  process.exit(1);
}

// Cosmos DB client
const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database(process.env.COSMOS_DATABASE);

// Container definitions
const CONTAINERS = [
  { id: 'brands', partitionKey: '/id' },
  { id: 'companies', partitionKey: '/id' },
  { id: 'agents', partitionKey: '/id' },
  { id: 'deals', partitionKey: '/id' },
  { id: 'tasks', partitionKey: '/id' },
  { id: 'contracts', partitionKey: '/id' }
];

/**
 * Skapa containers om de inte finns
 */
async function ensureContainers() {
  console.log('📦 Kontrollerar containers...\n');

  for (const containerDef of CONTAINERS) {
    try {
      const { container } = await database.containers.createIfNotExists({
        id: containerDef.id,
        partitionKey: { paths: [containerDef.partitionKey] }
      });
      console.log(`  ✓ Container '${containerDef.id}' redo`);
    } catch (error) {
      console.error(`  ✗ Fel vid skapande av '${containerDef.id}':`, error.message);
      throw error;
    }
  }

  console.log('\n✅ Alla containers redo!\n');
}

/**
 * Seed brands data
 */
async function seedBrands() {
  console.log('🏷️  Seedar brands...\n');
  const container = database.container('brands');

  const brands = [
    {
      id: 'brand-1',
      name: 'ERA',
      description: 'Ledande mäklarkedja i Sverige med över 200 mäklarkontor',
      status: 'kund',
      agentCount: 15,
      centralContract: true,
      contactPerson: 'Anna Svensson',
      email: 'anna.svensson@era.se',
      phone: '08-123 45 67',
      website: 'https://www.era.se',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'brand-2',
      name: 'Mäklarhuset',
      description: 'En av Sveriges största mäklarkedjor med verksamhet i hela landet',
      status: 'kund',
      agentCount: 12,
      centralContract: true,
      contactPerson: 'Bengt Andersson',
      email: 'bengt.andersson@maklarhuset.se',
      phone: '08-234 56 78',
      website: 'https://www.maklarhuset.se',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'brand-3',
      name: 'Svensk Fast',
      description: 'Rikstäckande mäklarkedja med fokus på personlig service',
      status: 'prospekt',
      agentCount: 10,
      centralContract: false,
      contactPerson: 'Cecilia Nilsson',
      email: 'cecilia.nilsson@svenskfast.se',
      phone: '08-345 67 89',
      website: 'https://www.svenskfast.se',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'brand-4',
      name: 'Fastighetsbyrån',
      description: 'Traditionell mäklarkedja med lång erfarenhet',
      status: 'prospekt',
      agentCount: 8,
      centralContract: false,
      contactPerson: 'David Karlsson',
      email: 'david.karlsson@fastighetsbyran.se',
      phone: '08-456 78 90',
      website: 'https://www.fastighetsbyran.se',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'brand-5',
      name: 'Notar',
      description: 'Modern mäklarkedja med digital profil',
      status: 'kund',
      agentCount: 6,
      centralContract: true,
      contactPerson: 'Eva Johansson',
      email: 'eva.johansson@notar.se',
      phone: '08-567 89 01',
      website: 'https://www.notar.se',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  for (const brand of brands) {
    try {
      await container.items.upsert(brand);
      console.log(`  ✓ ${brand.name} (${brand.status})`);
    } catch (error) {
      console.error(`  ✗ Fel vid skapande av ${brand.name}:`, error.message);
    }
  }

  console.log('\n✅ Brands seedade!\n');
}

/**
 * Seed companies data
 */
async function seedCompanies() {
  console.log('🏢 Seedar companies...\n');
  const container = database.container('companies');

  const companies = [
    {
      id: 'company-1',
      name: 'ERA Stockholm City',
      brandId: 'brand-1',
      brandName: 'ERA',
      status: 'kund',
      contactPerson: 'Anna Andersson',
      email: 'anna@erastockholm.se',
      phone: '08-123 45 67',
      agentCount: 8,
      licenseCount: 8,
      address: {
        street: 'Stureplan 4',
        postalCode: '114 35',
        city: 'Stockholm',
        country: 'Sverige'
      },
      notes: 'Stort kontor i centrala Stockholm, mycket aktivt',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'company-2',
      name: 'Mäklarhuset Göteborg',
      brandId: 'brand-2',
      brandName: 'Mäklarhuset',
      status: 'kund',
      contactPerson: 'Bengt Bengtsson',
      email: 'bengt@maklarhusetgbg.se',
      phone: '031-123 45 67',
      agentCount: 6,
      licenseCount: 6,
      address: {
        street: 'Avenyn 12',
        postalCode: '411 36',
        city: 'Göteborg',
        country: 'Sverige'
      },
      notes: 'Etablerat kontor på Avenyn',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'company-3',
      name: 'Svensk Fast Malmö',
      brandId: 'brand-3',
      brandName: 'Svensk Fast',
      status: 'prospekt',
      contactPerson: 'Cecilia Carlsson',
      email: 'cecilia@svenskfast.se',
      phone: '040-123 45 67',
      agentCount: 5,
      licenseCount: 0,
      address: {
        street: 'Stortorget 8',
        postalCode: '211 22',
        city: 'Malmö',
        country: 'Sverige'
      },
      notes: 'Intresserade av centralavtal, förhandling pågår',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'company-4',
      name: 'Notar Uppsala',
      brandId: 'brand-5',
      brandName: 'Notar',
      status: 'kund',
      contactPerson: 'David Davidsson',
      email: 'david@notaruppsala.se',
      phone: '018-123 45 67',
      agentCount: 4,
      licenseCount: 4,
      address: {
        street: 'Dragarbrunnsgatan 30',
        postalCode: '753 20',
        city: 'Uppsala',
        country: 'Sverige'
      },
      notes: 'Nöjda kunder, expansion planerad',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'company-5',
      name: 'Fastighetsbyrån Lund',
      brandId: 'brand-4',
      brandName: 'Fastighetsbyrån',
      status: 'prospekt',
      contactPerson: 'Eva Eriksson',
      email: 'eva@fastighetsbyran.se',
      phone: '046-123 45 67',
      agentCount: 3,
      licenseCount: 0,
      address: {
        street: 'Mårtenstorget 5',
        postalCode: '223 51',
        city: 'Lund',
        country: 'Sverige'
      },
      notes: 'Initial kontakt, demo bokat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  for (const company of companies) {
    try {
      await container.items.upsert(company);
      console.log(`  ✓ ${company.name} (${company.status})`);
    } catch (error) {
      console.error(`  ✗ Fel vid skapande av ${company.name}:`, error.message);
    }
  }

  console.log('\n✅ Companies seedade!\n');
}

/**
 * Seed agents data
 */
async function seedAgents() {
  console.log('👤 Seedar agents...\n');
  const container = database.container('agents');

  const agents = [
    {
      id: 'agent-1',
      firstName: 'Anna',
      lastName: 'Andersson',
      email: 'anna.andersson@era.se',
      phone: '070-111 11 11',
      companyId: 'company-1',
      companyName: 'ERA Stockholm City',
      brandId: 'brand-1',
      brandName: 'ERA',
      status: 'aktiv',
      licenseActive: true,
      licenseType: 'full',
      role: 'Mäklare',
      startDate: '2023-01-15',
      bio: 'Erfaren mäklare med specialisering på Stockholms innerstad',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'agent-2',
      firstName: 'Bengt',
      lastName: 'Bengtsson',
      email: 'bengt.bengtsson@maklarhuset.se',
      phone: '070-222 22 22',
      companyId: 'company-2',
      companyName: 'Mäklarhuset Göteborg',
      brandId: 'brand-2',
      brandName: 'Mäklarhuset',
      status: 'aktiv',
      licenseActive: true,
      licenseType: 'full',
      role: 'Mäklare',
      startDate: '2022-06-01',
      bio: 'Specialist på Göteborgs västra delar',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'agent-3',
      firstName: 'Cecilia',
      lastName: 'Carlsson',
      email: 'cecilia.carlsson@svenskfast.se',
      phone: '070-333 33 33',
      companyId: 'company-3',
      companyName: 'Svensk Fast Malmö',
      brandId: 'brand-3',
      brandName: 'Svensk Fast',
      status: 'prospekt',
      licenseActive: false,
      licenseType: null,
      role: 'Mäklare',
      startDate: '2023-03-01',
      bio: 'Mäklare i Malmö',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'agent-4',
      firstName: 'David',
      lastName: 'Davidsson',
      email: 'david.davidsson@notar.se',
      phone: '070-444 44 44',
      companyId: 'company-4',
      companyName: 'Notar Uppsala',
      brandId: 'brand-5',
      brandName: 'Notar',
      status: 'aktiv',
      licenseActive: true,
      licenseType: 'full',
      role: 'Kontorschef',
      startDate: '2021-09-15',
      bio: 'Kontorschef och mäklare med fokus på Uppsala centrum',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'agent-5',
      firstName: 'Eva',
      lastName: 'Eriksson',
      email: 'eva.eriksson@fastighetsbyran.se',
      phone: '070-555 55 55',
      companyId: 'company-5',
      companyName: 'Fastighetsbyrån Lund',
      brandId: 'brand-4',
      brandName: 'Fastighetsbyrån',
      status: 'prospekt',
      licenseActive: false,
      licenseType: null,
      role: 'Mäklare',
      startDate: '2023-08-01',
      bio: 'Mäklare i Lund',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  for (const agent of agents) {
    try {
      await container.items.upsert(agent);
      console.log(`  ✓ ${agent.firstName} ${agent.lastName} (${agent.role})`);
    } catch (error) {
      console.error(`  ✗ Fel vid skapande av ${agent.firstName} ${agent.lastName}:`, error.message);
    }
  }

  console.log('\n✅ Agents seedade!\n');
}

/**
 * Verifiera att allt fungerar
 */
async function verifyData() {
  console.log('🔍 Verifierar data...\n');

  try {
    // Count brands
    const brandsContainer = database.container('brands');
    const brandsQuery = brandsContainer.items.query('SELECT VALUE COUNT(1) FROM c');
    const brandsResult = await brandsQuery.fetchAll();
    const brandsCount = brandsResult.resources[0];
    console.log(`  ✓ Brands: ${brandsCount}`);

    // Count companies
    const companiesContainer = database.container('companies');
    const companiesQuery = companiesContainer.items.query('SELECT VALUE COUNT(1) FROM c');
    const companiesResult = await companiesQuery.fetchAll();
    const companiesCount = companiesResult.resources[0];
    console.log(`  ✓ Companies: ${companiesCount}`);

    // Count agents
    const agentsContainer = database.container('agents');
    const agentsQuery = agentsContainer.items.query('SELECT VALUE COUNT(1) FROM c');
    const agentsResult = await agentsQuery.fetchAll();
    const agentsCount = agentsResult.resources[0];
    console.log(`  ✓ Agents: ${agentsCount}`);

    // Verify expected counts
    if (brandsCount === 5 && companiesCount === 5 && agentsCount === 5) {
      console.log('\n✅ All data verifierad - redo för produktion!\n');
    } else {
      console.warn('\n⚠️  Antal entities matchar inte förväntade värden');
      console.warn(`   Förväntat: 5 brands, 5 companies, 5 agents`);
      console.warn(`   Faktiskt: ${brandsCount} brands, ${companiesCount} companies, ${agentsCount} agents\n`);
    }

  } catch (error) {
    console.error('❌ Fel vid verifiering:', error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('   JRM CRM - Cosmos DB Setup & Data Seeding');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`Database: ${process.env.COSMOS_DATABASE}`);
  console.log(`Endpoint: ${process.env.COSMOS_ENDPOINT}`);
  console.log('');
  console.log('Detta script kommer att:');
  console.log('  1. Skapa containers om de inte finns');
  console.log('  2. Seeda initial produktionsdata');
  console.log('  3. Verifiera att allt fungerar');
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  try {
    await ensureContainers();
    await seedBrands();
    await seedCompanies();
    await seedAgents();
    await verifyData();

    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('   🎉 KLART! Produktion är redo!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('Nästa steg:');
    console.log('  1. Verifiera data i Azure Portal → Cosmos DB → Data Explorer');
    console.log('  2. Testa API endpoints mot produktionsdatabasen');
    console.log('  3. Deploy backend till Azure App Service');
    console.log('');

  } catch (error) {
    console.error('\n❌ Ett fel inträffade:', error);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  ensureContainers,
  seedBrands,
  seedCompanies,
  seedAgents,
  verifyData
};
