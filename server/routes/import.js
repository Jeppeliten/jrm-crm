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
    if (hasColumn(columns, ['varumärke', 'företag', 'brand', 'company'])) {
      // Brand/Company data
      imported = await importBrandsAndCompanies(data, db);
    } else if (hasColumn(columns, ['mäklare', 'agent', 'email'])) {
      // Agent data
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
      message: `Importerade ${imported} av ${data.length} poster`
    });
    
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: 'Import failed',
      message: error.message 
    });
  }
});

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
  
  for (const row of data) {
    // Extract brand and company info
    const brand = row['Varumärke'] || row['Brand'] || row['varumärke'];
    const company = row['Företag'] || row['Company'] || row['företag'];
    
    if (brand) {
      // Upsert brand
      await db.collection('brands_v2').updateOne(
        { name: brand },
        { $set: { name: brand, updatedAt: new Date() } },
        { upsert: true }
      );
      count++;
    }
    
    if (company) {
      // Upsert company
      await db.collection('companies_v2').updateOne(
        { name: company },
        { 
          $set: { 
            name: company,
            brand: brand || null,
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

async function importAgents(data, db) {
  let count = 0;
  
  for (const row of data) {
    const email = row['Email'] || row['email'] || row['E-post'];
    const name = row['Namn'] || row['Name'] || row['name'];
    
    if (email) {
      await db.collection('agents_v2').updateOne(
        { email },
        {
          $set: {
            email,
            name: name || email,
            company: row['Företag'] || row['Company'],
            phone: row['Telefon'] || row['Phone'],
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
