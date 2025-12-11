/**
 * 🌱 Database Seed Script
 * Populates Cosmos DB with initial CRM data matching app.js structure
 * Run with: node scripts/setup/seed-database.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

// Simple ID generator
const id = () => Math.random().toString(36).substr(2, 9);

async function seedDatabase() {
  let client = null;
  
  try {
    console.log('🌱 Starting database seed...\n');
    
    // Connect to Cosmos DB
    let connStr = process.env.COSMOS_DB_CONNECTION_STRING;
    if (!connStr) {
      throw new Error('COSMOS_DB_CONNECTION_STRING environment variable is required');
    }
    
    // Fix connection string for Cosmos DB
    if (connStr.includes('retryWrites=true')) {
      connStr = connStr.replace('retryWrites=true', 'retryWrites=false');
    } else if (!connStr.includes('retryWrites=false')) {
      connStr += (connStr.includes('?') ? '&' : '?') + 'retryWrites=false';
    }
    
    client = new MongoClient(connStr, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: false
    });
    
    await client.connect();
    const db = client.db(process.env.COSMOS_DB_DATABASE_NAME || 'crm_database');
    console.log('✅ Connected to Cosmos DB\n');
    
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      db.collection('brands').deleteMany({}),
      db.collection('companies').deleteMany({}),
      db.collection('agents').deleteMany({}),
      db.collection('tasks').deleteMany({}),
      db.collection('notes').deleteMany({})
    ]);
    console.log('✅ Cleared existing data\n');
    
    // Create real estate brands
    const b1 = { _id: id(), namn: 'Fristående mäklarföretag', segmentId: 'real-estate' };
    const b2 = { _id: id(), namn: 'Fastighetsbolaget Y', segmentId: 'real-estate' };
    
    // Create real estate companies
    const c1 = { 
      _id: id(), 
      namn: 'X Malmö', 
      brandId: b1._id, 
      segmentId: 'real-estate', 
      stad: 'Malmö', 
      status: 'kund', 
      pipelineStage: 'vunnit', 
      potentialValue: 120000 
    };
    const c2 = { 
      _id: id(), 
      namn: 'X Lund', 
      brandId: b1._id, 
      segmentId: 'real-estate', 
      stad: 'Lund', 
      status: 'prospekt', 
      pipelineStage: 'offert', 
      potentialValue: 60000 
    };
    const c3 = { 
      _id: id(), 
      namn: 'Y Stockholm', 
      brandId: b2._id, 
      segmentId: 'real-estate', 
      stad: 'Stockholm', 
      status: 'ej', 
      pipelineStage: 'kvalificerad', 
      potentialValue: 30000 
    };
    
    // Create real estate agents
    const a1 = { 
      _id: id(), 
      förnamn: 'Anna', 
      efternamn: 'Andersson', 
      email: 'anna@xmalmo.se', 
      telefon: '070-111111', 
      companyId: c1._id, 
      status: 'kund', 
      licens: { status: 'aktiv' } 
    };
    const a2 = { 
      _id: id(), 
      förnamn: 'Björn', 
      efternamn: 'Berg', 
      email: 'bjorn@xlund.se', 
      telefon: '070-222222', 
      companyId: c2._id, 
      status: 'prospekt', 
      licens: { status: 'ingen' } 
    };
    const a3 = { 
      _id: id(), 
      förnamn: 'Cecilia', 
      efternamn: 'Carlsson', 
      email: 'cecilia@y-sthlm.se', 
      telefon: '070-333333', 
      companyId: c3._id, 
      status: 'ej', 
      licens: { status: 'test' } 
    };
    
    // Create banking brands (7 banks)
    const swedbank = { _id: id(), namn: 'Swedbank', segmentId: 'banking', centralContract: { active: false } };
    const handelsbanken = { _id: id(), namn: 'Handelsbanken', segmentId: 'banking', centralContract: { active: false } };
    const seb = { _id: id(), namn: 'SEB', segmentId: 'banking', centralContract: { active: false } };
    const nordea = { _id: id(), namn: 'Nordea', segmentId: 'banking', centralContract: { active: false } };
    const danskeBank = { _id: id(), namn: 'Danske Bank', segmentId: 'banking', centralContract: { active: false } };
    const sbab = { _id: id(), namn: 'SBAB', segmentId: 'banking', centralContract: { active: false } };
    const lansforsakringar = { _id: id(), namn: 'Länsförsäkringar Bank', segmentId: 'banking', centralContract: { active: false } };
    
    const bankBrands = [swedbank, handelsbanken, seb, nordea, danskeBank, sbab, lansforsakringar];
    
    // Create banking offices (12 offices across banks)
    const bankCompanies = [
      { _id: id(), namn: 'Swedbank Stockholm City', brandId: swedbank._id, segmentId: 'banking', stad: 'Stockholm', status: 'kund', tier: 'gold', pipelineStage: 'vunnit', potentialValue: 50000 },
      { _id: id(), namn: 'Swedbank Göteborg', brandId: swedbank._id, segmentId: 'banking', stad: 'Göteborg', status: 'prospekt', tier: 'silver', pipelineStage: 'offert', potentialValue: 30000 },
      { _id: id(), namn: 'Swedbank Malmö', brandId: swedbank._id, segmentId: 'banking', stad: 'Malmö', status: 'ej', tier: 'bronze', pipelineStage: 'kvalificerad', potentialValue: 20000 },
      { _id: id(), namn: 'Handelsbanken Stockholm Sergels Torg', brandId: handelsbanken._id, segmentId: 'banking', stad: 'Stockholm', status: 'kund', tier: 'gold', pipelineStage: 'vunnit', potentialValue: 45000 },
      { _id: id(), namn: 'Handelsbanken Uppsala', brandId: handelsbanken._id, segmentId: 'banking', stad: 'Uppsala', status: 'prospekt', tier: 'silver', pipelineStage: 'demo', potentialValue: 25000 },
      { _id: id(), namn: 'SEB Stockholm Kungsträdgården', brandId: seb._id, segmentId: 'banking', stad: 'Stockholm', status: 'kund', tier: 'gold', pipelineStage: 'vunnit', potentialValue: 40000 },
      { _id: id(), namn: 'SEB Göteborg Nordstan', brandId: seb._id, segmentId: 'banking', stad: 'Göteborg', status: 'prospekt', tier: 'silver', pipelineStage: 'offert', potentialValue: 28000 },
      { _id: id(), namn: 'Nordea Stockholm Hamngatan', brandId: nordea._id, segmentId: 'banking', stad: 'Stockholm', status: 'kund', tier: 'gold', pipelineStage: 'vunnit', potentialValue: 38000 },
      { _id: id(), namn: 'Nordea Malmö Stortorget', brandId: nordea._id, segmentId: 'banking', stad: 'Malmö', status: 'prospekt', tier: 'silver', pipelineStage: 'kvalificerad', potentialValue: 22000 },
      { _id: id(), namn: 'Danske Bank Stockholm', brandId: danskeBank._id, segmentId: 'banking', stad: 'Stockholm', status: 'ej', tier: 'bronze', pipelineStage: 'identifierad', potentialValue: 15000 },
      { _id: id(), namn: 'SBAB Solna', brandId: sbab._id, segmentId: 'banking', stad: 'Solna', status: 'prospekt', tier: 'silver', pipelineStage: 'demo', potentialValue: 20000 },
      { _id: id(), namn: 'Länsförsäkringar Bank Stockholm', brandId: lansforsakringar._id, segmentId: 'banking', stad: 'Stockholm', status: 'kund', tier: 'gold', pipelineStage: 'vunnit', potentialValue: 35000 }
    ];
    
    // Create banking advisors (5 advisors across offices)
    const advisors = [
      { _id: id(), förnamn: 'David', efternamn: 'Danielsson', email: 'david.d@swedbank.se', telefon: '070-444444', companyId: bankCompanies[0]._id, status: 'kund', licens: { status: 'aktiv' } },
      { _id: id(), förnamn: 'Emma', efternamn: 'Eriksson', email: 'emma.e@handelsbanken.se', telefon: '070-555555', companyId: bankCompanies[3]._id, status: 'kund', licens: { status: 'aktiv' } },
      { _id: id(), förnamn: 'Fredrik', efternamn: 'Fransson', email: 'fredrik.f@seb.se', telefon: '070-666666', companyId: bankCompanies[5]._id, status: 'kund', licens: { status: 'aktiv' } },
      { _id: id(), förnamn: 'Gustav', efternamn: 'Gustafsson', email: 'gustav.g@nordea.se', telefon: '070-777777', companyId: bankCompanies[7]._id, status: 'kund', licens: { status: 'aktiv' } },
      { _id: id(), förnamn: 'Helena', efternamn: 'Henriksson', email: 'helena.h@lf.se', telefon: '070-888888', companyId: bankCompanies[11]._id, status: 'kund', licens: { status: 'aktiv' } }
    ];
    
    // Create sample tasks
    const tasks = [
      { _id: id(), text: 'Uppföljning Swedbank Stockholm', done: false, companyId: bankCompanies[0]._id },
      { _id: id(), text: 'Demo-möte Handelsbanken Uppsala', done: false, companyId: bankCompanies[4]._id },
      { _id: id(), text: 'Offert SEB Göteborg', done: false, companyId: bankCompanies[6]._id },
      { _id: id(), text: 'Ring X Lund', done: false, companyId: c2._id }
    ];
    
    // Insert all data into Cosmos DB
    console.log('📦 Inserting data...');
    
    const allBrands = [b1, b2, ...bankBrands];
    const allCompanies = [c1, c2, c3, ...bankCompanies];
    const allAgents = [a1, a2, a3, ...advisors];
    
    await db.collection('brands').insertMany(allBrands);
    console.log(`✅ Inserted ${allBrands.length} brands`);
    
    await db.collection('companies').insertMany(allCompanies);
    console.log(`✅ Inserted ${allCompanies.length} companies`);
    
    await db.collection('agents').insertMany(allAgents);
    console.log(`✅ Inserted ${allAgents.length} agents`);
    
    await db.collection('tasks').insertMany(tasks);
    console.log(`✅ Inserted ${tasks.length} tasks`);
    
    // Create notes collection (empty for now)
    await db.createCollection('notes');
    console.log(`✅ Created notes collection`);
    
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\nSummary:');
    console.log(`- Brands: ${allBrands.length} (${bankBrands.length} banks, 2 real estate)`);
    console.log(`- Companies: ${allCompanies.length} (${bankCompanies.length} bank offices, 3 real estate)`);
    console.log(`- Agents: ${allAgents.length} (${advisors.length} advisors, 3 real estate agents)`);
    console.log(`- Tasks: ${tasks.length}`);
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Disconnected from database');
    }
  }
}

// Run the seed
seedDatabase();
