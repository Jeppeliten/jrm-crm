/**
 * Test Script - Verify All API Endpoints
 * Tests both local and production servers
 */

const https = require('https');
const http = require('http');

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Test configuration
const LOCAL_URL = 'http://localhost:3000';
const PROD_URL = 'https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net';

const endpoints = [
  { method: 'GET', path: '/health', name: 'Health Check' },
  { method: 'GET', path: '/api/health', name: 'API Health' },
  { method: 'GET', path: '/api/test', name: 'API Test' },
  { method: 'GET', path: '/api/companies', name: 'Get Companies' },
  { method: 'GET', path: '/api/brands', name: 'Get Brands' },
  { method: 'GET', path: '/api/agents', name: 'Get Agents' },
  { method: 'GET', path: '/api/deals', name: 'Get Deals' },
  { method: 'GET', path: '/api/tasks', name: 'Get Tasks' }
];

function makeRequest(baseUrl, endpoint) {
  return new Promise((resolve) => {
    const url = new URL(endpoint.path, baseUrl);
    const client = url.protocol === 'https:' ? https : http;
    
    const startTime = Date.now();
    const req = client.get(url, { timeout: 10000 }, (res) => {
      const duration = Date.now() - startTime;
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          success: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          duration,
          data: data.substring(0, 200) // First 200 chars
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Timeout',
        duration: Date.now() - startTime
      });
    });
  });
}

async function testEndpoints(baseUrl, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${COLORS.blue}Testing ${label}: ${baseUrl}${COLORS.reset}`);
  console.log('='.repeat(60));
  
  const results = [];
  
  for (const endpoint of endpoints) {
    process.stdout.write(`${endpoint.name.padEnd(30)} ... `);
    
    const result = await makeRequest(baseUrl, endpoint);
    
    if (result.success) {
      console.log(`${COLORS.green}✓ ${result.statusCode} (${result.duration}ms)${COLORS.reset}`);
      results.push({ ...endpoint, status: 'PASS', ...result });
    } else {
      console.log(`${COLORS.red}✗ ${result.error || result.statusCode} (${result.duration}ms)${COLORS.reset}`);
      results.push({ ...endpoint, status: 'FAIL', ...result });
    }
  }
  
  return results;
}

function printSummary(localResults, prodResults) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${COLORS.blue}SUMMARY${COLORS.reset}`);
  console.log('='.repeat(60));
  
  const localPass = localResults.filter(r => r.status === 'PASS').length;
  const prodPass = prodResults.filter(r => r.status === 'PASS').length;
  const total = endpoints.length;
  
  console.log(`\nLocal:      ${localPass}/${total} passing`);
  console.log(`Production: ${prodPass}/${total} passing`);
  
  // Compare differences
  console.log(`\n${COLORS.yellow}Differences between Local and Production:${COLORS.reset}`);
  let hasDifferences = false;
  
  for (let i = 0; i < endpoints.length; i++) {
    const local = localResults[i];
    const prod = prodResults[i];
    
    if (local.status !== prod.status) {
      hasDifferences = true;
      console.log(`\n${endpoints[i].name}:`);
      console.log(`  Local:      ${local.status === 'PASS' ? COLORS.green : COLORS.red}${local.status}${COLORS.reset} (${local.statusCode || local.error})`);
      console.log(`  Production: ${prod.status === 'PASS' ? COLORS.green : COLORS.red}${prod.status}${COLORS.reset} (${prod.statusCode || prod.error})`);
    }
  }
  
  if (!hasDifferences) {
    console.log(`${COLORS.green}✓ No differences - both environments working identically${COLORS.reset}`);
  }
  
  // Performance comparison
  console.log(`\n${COLORS.yellow}Average Response Times:${COLORS.reset}`);
  const localAvg = localResults.reduce((sum, r) => sum + r.duration, 0) / localResults.length;
  const prodAvg = prodResults.reduce((sum, r) => sum + r.duration, 0) / prodResults.length;
  console.log(`  Local:      ${localAvg.toFixed(0)}ms`);
  console.log(`  Production: ${prodAvg.toFixed(0)}ms`);
  
  console.log('\n' + '='.repeat(60) + '\n');
}

async function main() {
  console.log(`${COLORS.blue}╔═══════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.blue}║   JRM CRM - API Endpoint Test Suite                  ║${COLORS.reset}`);
  console.log(`${COLORS.blue}╚═══════════════════════════════════════════════════════╝${COLORS.reset}`);
  
  try {
    const localResults = await testEndpoints(LOCAL_URL, 'LOCAL SERVER');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
    const prodResults = await testEndpoints(PROD_URL, 'PRODUCTION SERVER');
    
    printSummary(localResults, prodResults);
    
    // Exit with error code if any tests failed
    const allPass = [...localResults, ...prodResults].every(r => r.status === 'PASS');
    process.exit(allPass ? 0 : 1);
    
  } catch (error) {
    console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
    process.exit(1);
  }
}

main();
