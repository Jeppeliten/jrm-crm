/**
 * Import Routes
 * Handles Excel file imports from client and server
 */

const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');

// In-memory file uploads for Excel imports
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Import data from client-provided JSON payload (legacy)
router.post('/', async (req, res) => {
  try {
    const { data, filename = 'payload' } = req.body;
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ 
        error: 'Invalid data format',
        message: 'Data must be an array of objects' 
      });
    }

    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ 
        error: 'Database not available',
        message: 'Database connection not configured' 
      });
    }

    const result = await processImport(data, filename, db);
    res.json(result);
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: 'Import failed',
      message: error.message 
    });
  }
});

// Import Excel file uploaded from client
router.post('/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ 
        error: 'Database not available',
        message: 'Database connection not configured' 
      });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(firstSheet);

    const result = await processImport(data, req.file.originalname, db);
    res.json(result);
  } catch (error) {
    console.error('Excel import error:', error);
    res.status(500).json({ 
      error: 'Excel import failed',
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

// Shared import processor used by JSON payloads and uploaded Excel files
async function processImport(data, filename, db) {
  console.log(`Processing import: ${filename} (${data.length} rows)`);

  const columns = Object.keys(data[0] || {});
  console.log('Columns found:', columns);

  let imported = 0;
  const errors = [];

  // Process based on data type
  if (hasColumn(columns, ['kund', 'varumärke', 'org']) || 
      hasColumn(columns, ['company', 'brand', 'org'])) {
    console.log('Detected comprehensive customer data file');
    const companyCount = await importBrandsAndCompanies(data, db);
    console.log(`Imported ${companyCount} brands/companies/contracts`);
    const agentCount = await importAgents(data, db);
    console.log(`Imported ${agentCount} agents`);
    imported = companyCount + agentCount;
  } else if (hasColumn(columns, ['varumärke', 'företag', 'brand', 'company'])) {
    imported = await importBrandsAndCompanies(data, db);
  } else if (hasColumn(columns, ['mäklare', 'agent', 'email'])) {
    imported = await importAgents(data, db);
  } else if (hasColumn(columns, ['licens', 'license', 'product'])) {
    imported = await importLicenses(data, db);
  } else {
    imported = await importGeneric(data, db);
  }

  return {
    success: true,
    imported,
    total: data.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `Importerade ${imported} av ${data.length} poster`,
    summary: await getImportSummary(db)
  };
}

async function importBrandsAndCompanies(data, db) {
  let count = 0;
  const stats = { brands: 0, companies: 0, agents: 0, contracts: 0 };
  
  for (const row of data) {
    try {
      // Extract all relevant fields with multiple column name variants
      const brand = row['Företag - kedja/varumärke'] || row['Varumärke'] || row['Brand'] || row['varumärke'];
      const company = row['Företag - namn'] || row['Kund'] || row['Företag'] || row['Company'] || row['företag'];
      const orgNumber = row['Org nr'] || row['Org.nr'] || row['OrgNr'] || row['organisationsnummer'];
      const category = row['Kundkategori'] || row['Kategori'] || row['Category'];
      const status = row['Status'] || row['status'];
      const address = row['Företag - adress'] || row['Adress'] || '';
      const postalCode = row['Företag - postnummer'] || row['Postnummer'] || '';
      const city = row['Företag - postort'] || row['Ort'] || row['City'] || '';
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
          description: '',
          website: '',
          companyId: null, // Will be set if we find parent company
          agentCount: 0,
          updatedAt: new Date(),
          // Track if this brand has central agreement
          hasCentralAgreement: category && category.toLowerCase().includes('central')
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
          orgNumber: orgNumber ? orgNumber.trim() : '',
          email: row['E-post företag'] || row['Email'] || '',
          phone: row['Telefon företag'] || row['Phone'] || '',
          address: address,
          brandIds: [], // Will be updated by aggregation service
          agentCount: 0, // Will be updated by aggregation service
          category: category || null,
          status: mappedStatus,
          city: city,
          county: county || null,
          licenseCount: licenseCount ? parseInt(licenseCount) : 0,
          product: product || null,
          paymentInfo: payment || null,
          lastContact: null,
          nextAction: null,
          updatedAt: new Date(),
          // Determine pipeline stage based on status
          pipeline: mappedStatus === 'kund' ? 'active_customer' : 'prospect'
        };
        
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
      } // End of if (company && company.trim())
    } catch (error) {
      console.error('Error importing row:', error);
      // Continue with next row
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
  const { updateAllAggregations } = require('../services/aggregation-service');
  let count = 0;
  
  for (const row of data) {
    try {
      // Extract agent name and last name
      const fullName = row['Mäklare - Namn'] || row['Namn'] || row['Name'] || row['name'];
      if (!fullName) continue; // Skip if no name
      
      const nameParts = fullName.trim().split(' ');
      const name = nameParts[0] || fullName;
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Basic info
      const email = row['Email'] || row['email'] || row['E-post'];
      const phone = row['Telefon'] || row['Phone'] || row['phone'];
      const registrationType = row['Registreringstyp'] || '';
      
      // Company and Brand
      const companyName = row['Företag - namn'] || row['Kund'] || row['Företag'] || row['Company'] || '';
      const brandName = row['Företag - kedja/varumärke'] || row['Varumärke'] || row['Brand'] || '';
      
      // Address info
      const address = row['Företag - adress'] || row['Adress'] || '';
      const postalCode = row['Företag - postnummer'] || row['Postnummer'] || '';
      const city = row['Företag - postort'] || row['Postort'] || '';
      const office = row['Kontor där mäklaren är verksam'] || '';
      
      // Mäklarpaket fields
      const brokerPackage = {
        userId: row['Mäklarpaket.AnvändarID'] || '',
        msnName: row['Mäklarpaket.MSNNamn'] || '',
        uid: row['Mäklarpaket.UID'] || '',
        epost: row['Mäklarpaket.Epost'] || email || '',
        active: row['Mäklarpaket.Aktiv'] === true || row['Mäklarpaket.Aktiv'] === 'true' || row['Mäklarpaket.Aktiv'] === 'True',
        customerNumber: row['Mäklarpaket.KundNr'] || '',
        accountNumber: row['Mäklarpaket.Kontor'] || '',
        totalCost: parseFloat(row['Mäklarpaket.Totalkostnad']) || 0,
        discount: parseFloat(row['Mäklarpaket.Rabatt']) || 0
      };
      
      // Products - handle both single and comma-separated
      let products = [];
      const produkter = row['Produkter'] || row['Mäklarpaket.ProduktNamn'] || '';
      if (produkter) {
        products = produkter.split(',').map(p => p.trim()).filter(Boolean);
      }
      
      const matchType = row['Matchtyp'] || '';
      
      // Find company and brand IDs
      let companyId = null;
      let brandId = null;
      
      if (companyName) {
        const company = await db.collection('companies_v2').findOne({
          name: { $regex: new RegExp(`^${companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        companyId = company?._id || null;
      }
      
      if (brandName) {
        const brand = await db.collection('brands_v2').findOne({
          name: { $regex: new RegExp(`^${brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        brandId = brand?._id || null;
      }
      
      const agentData = {
        // Basic info
        name: name,
        lastName: lastName,
        email: email || '',
        phone: phone || '',
        registrationType: registrationType,
        
        // Company and Brand references
        company: companyName,
        companyId: companyId,
        brand: brandName,
        brandId: brandId,
        
        // Address info
        address: address,
        postalCode: postalCode,
        city: city,
        office: office,
        
        // Mäklarpaket
        brokerPackage: brokerPackage,
        
        // Products and matching
        products: products,
        matchType: matchType,
        
        // Status and metadata
        status: 'aktiv',
        role: 'Mäklare',
        licenseType: row['Licenstyp'] || row['License Type'] || '',
        updatedAt: new Date()
      };
      
      // Use email as unique key if available, otherwise use name
      const query = email ? 
        { email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } } : 
        { name: name, lastName: lastName };
      
      const result = await db.collection('agents_v2').updateOne(
        query,
        {
          $set: agentData,
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
      
      // Update aggregations if agent was inserted or company/brand changed
      if (result.upsertedCount > 0 || result.modifiedCount > 0) {
        await updateAllAggregations(db, companyId, brandId);
      }
      
      count++;
    } catch (error) {
      console.error('Error importing agent:', error);
      // Continue with next agent
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
