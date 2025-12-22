#!/usr/bin/env node
/**
 * Direct Cosmos DB import - bypasses API throttling
 * Reads Excel and writes directly to Cosmos DB via MongoDB driver
 * 
 * Usage: node scripts/direct-import.js --file "C:\Users\Public\Final.xlsx"
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });

const { MongoClient } = require('mongodb');
const xlsx = require('xlsx');
const path = require('path');

const args = require('minimist')(process.argv.slice(2));
const filePath = args.file || args.f;

if (!filePath) {
  console.error('Usage: node direct-import.js --file <path-to-excel>');
  process.exit(1);
}

const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
const databaseName = process.env.COSMOS_DB_DATABASE_NAME || 'crm_database';

if (!connectionString) {
  console.error('Missing COSMOS_DB_CONNECTION_STRING in environment');
  process.exit(1);
}

// Helper to detect column presence
function hasColumn(columns, searchTerms) {
  return searchTerms.some(term =>
    columns.some(col => col.toLowerCase().includes(term.toLowerCase()))
  );
}

async function main() {
  console.log(`Reading ${filePath}...`);
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  console.log(`Loaded ${data.length} rows from "${sheetName}"`);

  const columns = Object.keys(data[0] || {});
  console.log('Columns:', columns.slice(0, 10).join(', '), columns.length > 10 ? '...' : '');

  console.log('Connecting to Cosmos DB...');
  const client = new MongoClient(connectionString);
  await client.connect();
  const db = client.db(databaseName);
  console.log(`Connected to database: ${databaseName}`);

  const stats = { brands: 0, companies: 0, agents: 0, contracts: 0, skipped: 0 };

  // Process each row
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (i % 500 === 0) {
      console.log(`Processing row ${i + 1}/${data.length}...`);
    }

    try {
      // Extract fields with multiple column name variants
      const brand = row['Företag - kedja/varumärke'] || row['Varumärke'] || row['Brand'] || row['varumärke'] || '';
      const company = row['Företag - namn'] || row['Kund'] || row['Företag'] || row['Company'] || row['företag'] || '';
      const orgNumber = row['Org nr'] || row['Org.nr'] || row['OrgNr'] || row['organisationsnummer'] || '';
      const category = row['Kundkategori'] || row['Kategori'] || row['Category'] || '';
      const status = row['Status'] || row['status'] || '';
      const address = row['Företag - adress'] || row['Adress'] || '';
      const postalCode = row['Företag - postnummer'] || row['Postnummer'] || '';
      const city = row['Företag - postort'] || row['Ort'] || row['City'] || '';
      const county = row['Län'] || row['County'] || '';
      const licenseCount = row['Antal licenser'] || row['Licenses'] || row['antal_licenser'] || 0;
      const product = row['Produkt'] || row['Product'] || '';
      const payment = row['Betalning'] || row['Payment'] || '';

      // Agent fields
      const agentName = row['Mäklare - Namn'] || row['Namn'] || row['Name'] || row['name'] || '';
      const agentEmail = row['Email'] || row['email'] || row['E-post'] || '';
      const agentPhone = row['Telefon'] || row['Phone'] || row['phone'] || '';

      // 1. Upsert Brand
      if (brand && brand.trim()) {
        await db.collection('brands_v2').updateOne(
          { name: brand.trim() },
          {
            $set: {
              name: brand.trim(),
              category: 'varumärke',
              status: 'aktiv',
              updatedAt: new Date(),
              hasCentralAgreement: category && category.toLowerCase().includes('central')
            },
            $setOnInsert: { createdAt: new Date(), companyCount: 0, agentCount: 0 }
          },
          { upsert: true }
        );
        stats.brands++;
      }

      // 2. Upsert Company
      if (company && company.trim()) {
        let mappedStatus = 'prospekt';
        if (status) {
          const s = status.toLowerCase();
          if (s.includes('aktiv') || s === 'active') mappedStatus = 'kund';
          else if (s.includes('avstängd') || s === 'inactive') mappedStatus = 'inaktiv';
        }

        await db.collection('companies_v2').updateOne(
          { name: company.trim() },
          {
            $set: {
              name: company.trim(),
              orgNumber: orgNumber ? orgNumber.toString().trim() : '',
              email: row['E-post företag'] || row['Email'] || '',
              phone: row['Telefon företag'] || row['Phone'] || '',
              address,
              city,
              county: county || null,
              brand: brand ? brand.trim() : null,
              category: category || null,
              status: mappedStatus,
              licenseCount: parseInt(licenseCount) || 0,
              product: product || null,
              paymentInfo: payment || null,
              pipeline: mappedStatus === 'kund' ? 'active_customer' : 'prospect',
              updatedAt: new Date()
            },
            $setOnInsert: { createdAt: new Date(), brandIds: [], agentCount: 0 }
          },
          { upsert: true }
        );
        stats.companies++;

        // 3. Upsert Contract if product/payment info
        if (product || payment) {
          await db.collection('contracts').updateOne(
            { company: company.trim(), brand: brand ? brand.trim() : null },
            {
              $set: {
                company: company.trim(),
                brand: brand ? brand.trim() : null,
                type: (category && category.toLowerCase().includes('central')) ? 'central' : 'direct',
                product: product || null,
                paymentInfo: payment || null,
                licenseCount: parseInt(licenseCount) || 0,
                status: mappedStatus === 'kund' ? 'active' : 'inactive',
                updatedAt: new Date()
              },
              $setOnInsert: { createdAt: new Date(), startDate: new Date() }
            },
            { upsert: true }
          );
          stats.contracts++;
        }
      }

      // 4. Upsert Agent
      if (agentName && agentName.trim()) {
        const nameParts = agentName.trim().split(' ');
        const firstName = nameParts[0] || agentName;
        const lastName = nameParts.slice(1).join(' ') || '';

        const query = agentEmail
          ? { email: { $regex: new RegExp(`^${agentEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
          : { name: firstName, lastName };

        await db.collection('agents_v2').updateOne(
          query,
          {
            $set: {
              name: firstName,
              lastName,
              email: agentEmail || '',
              phone: agentPhone || '',
              company: company ? company.trim() : '',
              brand: brand ? brand.trim() : '',
              status: 'aktiv',
              role: 'Mäklare',
              updatedAt: new Date()
            },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );
        stats.agents++;
      }

    } catch (err) {
      console.error(`Error on row ${i + 1}:`, err.message);
      stats.skipped++;
    }
  }

  // Update brand company counts
  console.log('Updating brand company counts...');
  const brands = await db.collection('brands_v2').find({}).toArray();
  for (const brand of brands) {
    const companyCount = await db.collection('companies_v2').countDocuments({ brand: brand.name });
    const agentCount = await db.collection('agents_v2').countDocuments({ brand: brand.name });
    await db.collection('brands_v2').updateOne(
      { _id: brand._id },
      { $set: { companyCount, agentCount } }
    );
  }

  await client.close();

  console.log('\n=== Import Complete ===');
  console.log(`Brands:    ${stats.brands}`);
  console.log(`Companies: ${stats.companies}`);
  console.log(`Agents:    ${stats.agents}`);
  console.log(`Contracts: ${stats.contracts}`);
  console.log(`Skipped:   ${stats.skipped}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
