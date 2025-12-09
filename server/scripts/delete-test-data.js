/**
 * Delete Specific Records from Production
 * Simple script to remove known problematic records
 */

const https = require('https');

const API_BASE = 'https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net/api';

function apiRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = API_BASE + path;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`${method} ${path} -> ${res.statusCode}`);
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   Delete Production Test Data                        ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  try {
    // Get all companies
    console.log('📊 Hämtar alla företag...');
    const companiesResult = await apiRequest('/companies', 'GET');
    const companies = companiesResult.data;
    
    console.log(`\n✅ Hittade ${companies.length} företag:`);
    companies.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} (ID: ${c._id})`);
    });

    // Find and delete test companies
    const testCompanies = companies.filter(c => 
      c.name?.toLowerCase().includes('test') || 
      c.email?.toLowerCase().includes('test')
    );

    if (testCompanies.length > 0) {
      console.log(`\n🗑️  Tar bort ${testCompanies.length} test-företag...`);
      for (const company of testCompanies) {
        console.log(`\n  Raderar: ${company.name} (${company._id})`);
        const result = await apiRequest(`/companies/${company._id}`, 'DELETE');
        if (result.statusCode === 200) {
          console.log(`  ✅ Raderat!`);
        } else {
          console.log(`  ❌ Fel: ${result.statusCode} - ${JSON.stringify(result.data)}`);
        }
      }
    }

    // Get all brands
    console.log('\n📊 Hämtar alla varumärken...');
    const brandsResult = await apiRequest('/brands', 'GET');
    const brands = brandsResult.data;
    
    console.log(`\n✅ Hittade ${brands.length} varumärken:`);
    brands.forEach((b, i) => {
      console.log(`  ${i + 1}. ${b.name} (ID: ${b._id})`);
    });

    const testBrands = brands.filter(b => b.name?.toLowerCase().includes('test'));
    
    if (testBrands.length > 0) {
      console.log(`\n🗑️  Tar bort ${testBrands.length} test-varumärken...`);
      for (const brand of testBrands) {
        console.log(`\n  Raderar: ${brand.name} (${brand._id})`);
        const result = await apiRequest(`/brands/${brand._id}`, 'DELETE');
        if (result.statusCode === 200) {
          console.log(`  ✅ Raderat!`);
        } else {
          console.log(`  ❌ Fel: ${result.statusCode}`);
        }
      }
    }

    // Get all agents
    console.log('\n📊 Hämtar alla mäklare...');
    const agentsResult = await apiRequest('/agents', 'GET');
    const agents = agentsResult.data;
    
    console.log(`\n✅ Hittade ${agents.length} mäklare:`);
    agents.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.name} (ID: ${a._id})`);
    });

    const testAgents = agents.filter(a => 
      a.name?.toLowerCase().includes('test') || 
      a.email?.toLowerCase().includes('test')
    );
    
    if (testAgents.length > 0) {
      console.log(`\n🗑️  Tar bort ${testAgents.length} test-mäklare...`);
      for (const agent of testAgents) {
        console.log(`\n  Raderar: ${agent.name} (${agent._id})`);
        const result = await apiRequest(`/agents/${agent._id}`, 'DELETE');
        if (result.statusCode === 200) {
          console.log(`  ✅ Raderat!`);
        } else {
          console.log(`  ❌ Fel: ${result.statusCode}`);
        }
      }
    }

    console.log('\n✅ Cleanup klar!');
    console.log('\n💡 Nu kan du skapa nya företag/varumärken/mäklare utan duplicate errors!');

  } catch (error) {
    console.error('\n❌ Fel:', error.message);
    console.error(error.stack);
  }
}

main();
