/**
 * Import Routes
 * Handles Excel file imports from client and server
 */

const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs').promises;

// Import data from client-uploaded Excel file
router.post('/', async (req, res) => {
  try {
    const { type, data, filename } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ 
        error: 'Invalid data format',
        message: 'Data must be an array of objects' 
      });
    }
    
    console.log(`Processing import: ${filename} (${data.length} rows)`);
    
    // Determine what type of data this is based on columns
    const columns = Object.keys(data[0] || {});
    console.log('Columns found:', columns);
    
    let imported = 0;
    const errors = [];
    
    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ 
        error: 'Database not available',
        message: 'Database connection not configured' 
      });
    }
    
    // Process based on data type
    // Check if this is a comprehensive customer data file (brands, companies, agents)
    if (hasColumn(columns, ['kund', 'varumärke', 'org']) || 
        hasColumn(columns, ['company', 'brand', 'org'])) {
      // This is a complete customer data export - import everything
      console.log('Detected comprehensive customer data file');
      
      // First pass: Brands and Companies
      const companyCount = await importBrandsAndCompanies(data, db);
      console.log(`Imported ${companyCount} brands/companies/contracts`);
      
      // Second pass: Agents
      const agentCount = await importAgents(data, db);
      console.log(`Imported ${agentCount} agents`);
      
      imported = companyCount + agentCount;
      
    } else if (hasColumn(columns, ['varumärke', 'företag', 'brand', 'company'])) {
      // Brand/Company data only
      imported = await importBrandsAndCompanies(data, db);
    } else if (hasColumn(columns, ['mäklare', 'agent', 'email'])) {
      // Agent data only
      imported = await importAgents(data, db);
    } else if (hasColumn(columns, ['licens', 'license', 'product'])) {
      // License data
      imported = await importLicenses(data, db);
    } else {
      // Generic import - try to match to existing collections
      imported = await importGeneric(data, db);
    }
    
    res.json({
      success: true,
      imported,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Importerade ${imported} av ${data.length} poster`,
      summary: await getImportSummary(db)
    });
    
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: 'Import failed',
      message: error.message 
    });
  }
});

// Get summary of imported data
async function getImportSummary(db) {
  try {
    const [brands, companies, agents, contracts] = await Promise.all([
      db.collection('brands_v2').countDocuments(),
      db.collection('companies_v2').countDocuments(),
      db.collection('agents_v2').countDocuments(),
      db.collection('contracts').countDocuments()
    ]);
    
    return {
      brands,
      companies,
      agents,
      contracts,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error getting summary:', error);
    return null;
  }
}

// Import from server file
router.post('/server', async (req, res) => {
  try {
    const { type = 'default' } = req.query;
    
    let filename;
    switch(type) {
      case 'ortspris':
        filename = 'Ortpris*.xlsx';
        break;
      case 'maklarpaket':
        filename = 'Användare mäklarpaket*.xlsx';
        break;
      default:
        filename = 'Sammanställning mäklardata och kunder 1.xlsx';
    }
    
    console.log(`Server import requested: ${type} (${filename})`);
    
    // Try to find file in common locations
    const possiblePaths = [
      path.join(process.cwd(), filename),
      path.join(process.cwd(), 'data', filename),
      path.join(process.cwd(), '..', filename),
    ];
    
    let filePath = null;
    for (const testPath of possiblePaths) {
      try {
        // Handle wildcards for Ortpris and Maklarpaket
        if (filename.includes('*')) {
          const dir = path.dirname(testPath);
          const pattern = path.basename(testPath).replace('*', '');
          const files = await fs.readdir(dir);
          const match = files.find(f => f.includes(pattern.replace('.xlsx', '')));
          if (match) {
            filePath = path.join(dir, match);
            break;
          }
        } else {
          await fs.access(testPath);
          filePath = testPath;
          break;
        }
      } catch (err) {
        // File not found, try next path
      }
    }
    
    if (!filePath) {
      return res.status(404).json({
        error: 'File not found',
        message: `Kunde inte hitta filen: ${filename}`,
        searchedPaths: possiblePaths
      });
    }
    
    console.log(`Reading file: ${filePath}`);
    
    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(firstSheet);
    
    console.log(`Read ${data.length} rows from ${workbook.SheetNames[0]}`);
    
    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ 
        error: 'Database not available',
        message: 'Database connection not configured' 
      });
    }
    
    // Process import based on type
    let imported = 0;
    if (type === 'ortspris') {
      imported = await importOrtsprisData(data, db);
    } else if (type === 'maklarpaket') {
      imported = await importMaklarpaketData(data, db);
    } else {
      imported = await importDefaultData(data, db);
    }
    
    res.json({
      success: true,
      imported,
      total: data.length,
      filename: path.basename(filePath),
      message: `Importerade ${imported} av ${data.length} poster från server`
    });
    
  } catch (error) {
    console.error('Server import error:', error);
    res.status(500).json({
      error: 'Server import failed',
      message: error.message
    });
  }
});

// Helper functions

function hasColumn(columns, searchTerms) {
  return searchTerms.some(term => 
    columns.some(col => col.toLowerCase().includes(term.toLowerCase()))
  );
}

async function importBrandsAndCompanies(data, db) {
  let count = 0;
  const stats = { brands: 0, companies: 0, agents: 0, contracts: 0 };
  
  for (const row of data) {
    // Extract all relevant fields with multiple column name variants
    const brand = row['Varumärke'] || row['Brand'] || row['varumärke'];
    const company = row['Kund'] || row['Företag'] || row['Company'] || row['företag'];
    const orgNumber = row['Org nr'] || row['Org.nr'] || row['OrgNr'] || row['organisationsnummer'];
    const category = row['Kundkategori'] || row['Kategori'] || row['Category'];
    const status = row['Status'] || row['status'];
    const city = row['Ort'] || row['City'];
    const county = row['Län'] || row['County'];
    const licenseCount = row['Antal licenser'] || row['Licenses'] || row['antal_licenser'];
    const product = row['Produkt'] || row['Product'];
    const payment = row['Betalning'] || row['Payment'];
    
    // 1. Import/Update Brand (if exists)
    if (brand && brand.trim()) {
      const brandData = {
        name: brand.trim(),
        category: 'varumärke',
        status: 'aktiv',
        updatedAt: new Date(),
        // Track if this brand has central agreement
        hasCentralAgreement: category && category.toLowerCase().includes('central'),
        companyCount: 0 // Will be calculated
      };
      
      await db.collection('brands_v2').updateOne(
        { name: brand.trim() },
        { 
          $set: brandData,
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
      stats.brands++;
    }
    
    // 2. Import/Update Company
    if (company && company.trim()) {
      // Map status from Excel (aktiv/avstängd) to our system
      let mappedStatus = 'prospekt';
      if (status) {
        const statusLower = status.toLowerCase();
        if (statusLower.includes('aktiv') || statusLower === 'active') {
          mappedStatus = 'kund';
        } else if (statusLower.includes('avstängd') || statusLower === 'inactive') {
          mappedStatus = 'inaktiv';
        }
      }
      
      const companyData = {
        name: company.trim(),
        brand: brand ? brand.trim() : null,
        orgNumber: orgNumber ? orgNumber.trim() : null,
        category: category || null,
        status: mappedStatus,
        city: city || null,
        county: county || null,
        licenseCount: licenseCount ? parseInt(licenseCount) : 0,
        product: product || null,
        paymentInfo: payment || null,
        updatedAt: new Date(),
        // Determine pipeline stage based on status
        pipeline: mappedStatus === 'kund' ? 'active_customer' : 'prospect'
      };
      
      // Add email and phone if available
      if (row['E-post företag'] || row['Email']) {
        companyData.email = row['E-post företag'] || row['Email'];
      }
      if (row['Telefon företag'] || row['Phone']) {
        companyData.phone = row['Telefon företag'] || row['Phone'];
      }
      
      await db.collection('companies_v2').updateOne(
        { name: company.trim() },
        { 
          $set: companyData,
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
      stats.companies++;
      
      // 3. Create/Update Contract if relevant info exists
      if (product || payment) {
        const contractData = {
          company: company.trim(),
          brand: brand ? brand.trim() : null,
          type: (category && category.toLowerCase().includes('central')) ? 'central' : 'direct',
          product: product || null,
          paymentInfo: payment || null,
          licenseCount: licenseCount ? parseInt(licenseCount) : 0,
          status: mappedStatus === 'kund' ? 'active' : 'inactive',
          startDate: new Date(), // You may want to extract from Excel
          updatedAt: new Date()
        };
        
        // Check if contract exists
        const existingContract = await db.collection('contracts').findOne({
          company: company.trim(),
          brand: brand ? brand.trim() : null
        });
        
        if (!existingContract) {
          await db.collection('contracts').insertOne({
            ...contractData,
            createdAt: new Date()
          });
          stats.contracts++;
        } else {
          await db.collection('contracts').updateOne(
            { _id: existingContract._id },
            { $set: contractData }
          );
        }
      }
    }
  }
  
  // Update brand company counts
  const brands = await db.collection('brands_v2').find({}).toArray();
  for (const brand of brands) {
    const companyCount = await db.collection('companies_v2').countDocuments({ brand: brand.name });
    await db.collection('brands_v2').updateOne(
      { _id: brand._id },
      { $set: { companyCount } }
    );
  }
  
  console.log('Import stats:', stats);
  return stats.brands + stats.companies + stats.contracts;
}

async function importAgents(data, db) {
  let count = 0;
  
  for (const row of data) {
    // Multiple agent columns in Excel (Mäklare 1, Mäklare 2, etc.)
    const agents = [];
    
    // Try to find agent columns dynamically
    const agentColumns = Object.keys(row).filter(key => 
      key.toLowerCase().includes('mäklare') || key.toLowerCase().includes('agent')
    );
    
    for (const col of agentColumns) {
      const agentInfo = row[col];
      if (agentInfo && agentInfo.trim()) {
        // Parse agent info (could be "Name <email>" or just name)
        const emailMatch = agentInfo.match(/([^<]+)<([^>]+)>/);
        const name = emailMatch ? emailMatch[1].trim() : agentInfo.trim();
        const email = emailMatch ? emailMatch[2].trim() : null;
        
        // Also check for separate email column
        const emailCol = col.replace('Mäklare', 'Email').replace('mäklare', 'email');
        const phoneCol = col.replace('Mäklare', 'Telefon').replace('mäklare', 'telefon');
        
        const agentEmail = email || row[emailCol] || row[col + ' Email'];
        const agentPhone = row[phoneCol] || row[col + ' Telefon'];
        
        if (agentEmail || name) {
          agents.push({
            name,
            email: agentEmail,
            phone: agentPhone
          });
        }
      }
    }
    
    // Fallback to standard fields
    if (agents.length === 0) {
      const email = row['Email'] || row['email'] || row['E-post'];
      const name = row['Namn'] || row['Name'] || row['name'];
      if (email || name) {
        agents.push({
          name: name || email,
          email,
          phone: row['Telefon'] || row['Phone']
        });
      }
    }
    
    // Get company info
    const company = row['Kund'] || row['Företag'] || row['Company'] || row['företag'];
    const brand = row['Varumärke'] || row['Brand'] || row['varumärke'];
    const product = row['Produkt'] || row['Product'];
    const licenseType = row['Licenstyp'] || row['License Type'] || product;
    
    // Import each agent
    for (const agent of agents) {
      if (agent.email || agent.name) {
        const agentData = {
          name: agent.name || agent.email,
          email: agent.email,
          phone: agent.phone,
          company: company || null,
          brand: brand || null,
          status: 'aktiv',
          licenseType: licenseType || null,
          role: 'Mäklare',
          updatedAt: new Date()
        };
        
        // Use email as unique key if available, otherwise name
        const query = agent.email ? { email: agent.email } : { name: agent.name };
        
        await db.collection('agents_v2').updateOne(
          query,
          {
            $set: agentData,
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );
        count++;
      }
    }
  }
  
  return count;
}

async function importLicenses(data, db) {
  let count = 0;
  
  for (const row of data) {
    const agentEmail = row['Email'] || row['email'];
    const license = row['Licens'] || row['License'];
    const product = row['Produkt'] || row['Product'];
    
    if (agentEmail && (license || product)) {
      await db.collection('licenses').updateOne(
        { agentEmail },
        {
          $set: {
            agentEmail,
            license,
            product,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      count++;
    }
  }
  
  return count;
}

async function importGeneric(data, db) {
  // Try to import to a generic "imports" collection
  const result = await db.collection('imports').insertMany(
    data.map(row => ({
      ...row,
      importedAt: new Date()
    }))
  );
  
  return result.insertedCount;
}

async function importOrtsprisData(data, db) {
  let count = 0;
  
  for (const row of data) {
    // Ortpris specific logic
    const company = row['Företag'] || row['Company'];
    const payment = row['Betalning'] || row['Payment'];
    const product = row['Produkt'] || row['Product'];
    
    if (company) {
      await db.collection('companies_v2').updateOne(
        { name: company },
        {
          $set: {
            name: company,
            payment,
            product,
            source: 'ortspris',
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      count++;
    }
  }
  
  return count;
}

async function importMaklarpaketData(data, db) {
  let count = 0;
  
  for (const row of data) {
    const email = row['Email'] || row['email'];
    const license = row['Licens'] || row['License'];
    const product = row['Produkt'] || row['Product'];
    
    if (email) {
      await db.collection('agents_v2').updateOne(
        { email },
        {
          $set: {
            license,
            product,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      count++;
    }
  }
  
  return count;
}

async function importDefaultData(data, db) {
  // Default import - process all data types
  let count = 0;
  
  count += await importBrandsAndCompanies(data, db);
  count += await importAgents(data, db);
  count += await importLicenses(data, db);
  
  return count;
}

module.exports = router;
