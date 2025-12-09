/**
 * Clean Production Database - Interactive
 * Removes test/duplicate data from production Cosmos DB
 */

const readline = require('readline');
const https = require('https');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const API_BASE = 'https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net/api';

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function apiRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function listCompanies() {
  console.log('\n📊 Hämtar företag från production...');
  const result = await apiRequest('/companies');
  const data = Array.isArray(result.data) ? result.data : [];
  return data;
}

async function listBrands() {
  console.log('\n📊 Hämtar varumärken från production...');
  const result = await apiRequest('/brands');
  const data = Array.isArray(result.data) ? result.data : [];
  return data;
}

async function listAgents() {
  console.log('\n📊 Hämtar mäklare från production...');
  const result = await apiRequest('/agents');
  const data = Array.isArray(result.data) ? result.data : [];
  return data;
}

async function deleteRecord(collection, id) {
  const result = await apiRequest(`/${collection}/${id}`, 'DELETE');
  return result.statusCode === 200;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   JRM CRM - Production Database Cleanup              ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  try {
    // List all companies
    const companies = await listCompanies();
    console.log(`\n✅ Hittade ${companies.length} företag:`);
    companies.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} (ID: ${c._id})`);
    });

    // Find duplicates
    const nameMap = {};
    companies.forEach(c => {
      const name = c.name?.toLowerCase().trim();
      if (!nameMap[name]) nameMap[name] = [];
      nameMap[name].push(c);
    });

    const duplicates = Object.entries(nameMap).filter(([_, items]) => items.length > 1);
    
    if (duplicates.length > 0) {
      console.log('\n⚠️  Hittade duplicerade företag:');
      duplicates.forEach(([name, items]) => {
        console.log(`\n  "${name}" (${items.length} kopior):`);
        items.forEach((item, i) => {
          console.log(`    ${i + 1}. ID: ${item._id}, Skapad: ${item.createdAt}`);
        });
      });
    }

    // Ask about test entries
    console.log('\n🔍 Letar efter test-entries...');
    const testCompanies = companies.filter(c => 
      c.name?.toLowerCase().includes('test') || 
      c.orgNumber?.includes('test') ||
      c.email?.includes('test')
    );

    if (testCompanies.length > 0) {
      console.log(`\n⚠️  Hittade ${testCompanies.length} test-företag:`);
      testCompanies.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.name} (${c.email || 'ingen email'})`);
      });

      const answer = await question('\nVill du ta bort alla test-företag? (ja/nej): ');
      if (answer.toLowerCase() === 'ja') {
        console.log('\n🗑️  Tar bort test-företag...');
        for (const company of testCompanies) {
          const success = await deleteRecord('companies', company._id);
          if (success) {
            console.log(`  ✅ Raderade: ${company.name}`);
          } else {
            console.log(`  ❌ Kunde inte radera: ${company.name}`);
          }
        }
      }
    } else {
      console.log('✅ Inga test-företag hittades');
    }

    // Check brands
    const brands = await listBrands();
    console.log(`\n✅ Hittade ${brands.length} varumärken:`);
    brands.forEach((b, i) => {
      console.log(`  ${i + 1}. ${b.name} (ID: ${b._id})`);
    });

    const testBrands = brands.filter(b => b.name?.toLowerCase().includes('test'));
    if (testBrands.length > 0) {
      console.log(`\n⚠️  Hittade ${testBrands.length} test-varumärken:`);
      testBrands.forEach((b, i) => {
        console.log(`  ${i + 1}. ${b.name}`);
      });

      const answer = await question('\nVill du ta bort alla test-varumärken? (ja/nej): ');
      if (answer.toLowerCase() === 'ja') {
        console.log('\n🗑️  Tar bort test-varumärken...');
        for (const brand of testBrands) {
          const success = await deleteRecord('brands', brand._id);
          if (success) {
            console.log(`  ✅ Raderade: ${brand.name}`);
          } else {
            console.log(`  ❌ Kunde inte radera: ${brand.name}`);
          }
        }
      }
    } else {
      console.log('✅ Inga test-varumärken hittades');
    }

    // Check agents
    const agents = await listAgents();
    console.log(`\n✅ Hittade ${agents.length} mäklare:`);
    agents.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.name} (${a.email || 'ingen email'})`);
    });

    const testAgents = agents.filter(a => 
      a.name?.toLowerCase().includes('test') || 
      a.email?.includes('test')
    );

    if (testAgents.length > 0) {
      console.log(`\n⚠️  Hittade ${testAgents.length} test-mäklare:`);
      testAgents.forEach((a, i) => {
        console.log(`  ${i + 1}. ${a.name} (${a.email || 'ingen email'})`);
      });

      const answer = await question('\nVill du ta bort alla test-mäklare? (ja/nej): ');
      if (answer.toLowerCase() === 'ja') {
        console.log('\n🗑️  Tar bort test-mäklare...');
        for (const agent of testAgents) {
          const success = await deleteRecord('agents', agent._id);
          if (success) {
            console.log(`  ✅ Raderade: ${agent.name}`);
          } else {
            console.log(`  ❌ Kunde inte radera: ${agent.name}`);
          }
        }
      }
    } else {
      console.log('✅ Inga test-mäklare hittades');
    }

    console.log('\n✅ Cleanup klar!');
    console.log('\n💡 Tips: Testa nu att skapa nya företag/varumärken/mäklare i appen!');

  } catch (error) {
    console.error('\n❌ Ett fel uppstod:', error.message);
  } finally {
    rl.close();
  }
}

main();
