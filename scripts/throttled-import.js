#!/usr/bin/env node
/**
 * Throttled importer: reads an Excel file and posts small JSON chunks to the API /api/import
 * Usage: node scripts/throttled-import.js --file "C:\\Users\\Public\\Final.xlsx" --url "https://jrm-crm-api-prod-vsdmc5kbydcjc.azurewebsites.net" --chunk 10 --delay 1000
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const args = require('minimist')(process.argv.slice(2));
const filePath = args.file || args.f;
const baseUrl = (args.url || args.u || process.env.API_URL || '').replace(/\/$/, '');
const chunkSize = parseInt(args.chunk || 10, 10);
const delayMs = parseInt(args.delay || 1000, 10);
const maxRetries = parseInt(args.retries || 8, 10);

if (!filePath || !baseUrl) {
  console.error('Usage: node throttled-import.js --file <path> --url <api_base> [--chunk 10] [--delay 1000] [--retries 8]');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRateLimit(res) {
  return res && res.status === 429;
}

async function postChunk(rows, attempt = 0) {
  const url = `${baseUrl}/api/import`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: rows, filename: path.basename(filePath) })
    });

    if (!res.ok) {
      if (isRateLimit(res) && attempt < maxRetries) {
        const backoff = Math.min(10000, delayMs * Math.pow(2, attempt));
        console.log(`429 on chunk (size ${rows.length}). Backing off ${backoff} ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(backoff);
        return postChunk(rows, attempt + 1);
      }
      const text = await res.text();
      throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
    }

    const json = await res.json();
    return json;
  } catch (err) {
    if (attempt < maxRetries) {
      const backoff = Math.min(10000, delayMs * Math.pow(2, attempt));
      console.log(`Error on chunk, retrying in ${backoff} ms (${attempt + 1}/${maxRetries}): ${err.message}`);
      await sleep(backoff);
      return postChunk(rows, attempt + 1);
    }
    throw err;
  }
}

(async () => {
  console.log(`Reading ${filePath} ...`);
  const workbook = xlsx.readFile(filePath);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(firstSheet);
  console.log(`Loaded ${rows.length} rows from ${workbook.SheetNames[0]}`);

  let sent = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    console.log(`Sending chunk ${Math.floor(i / chunkSize) + 1} (${chunk.length} rows)`);
    const result = await postChunk(chunk);
    sent += result?.imported || chunk.length;
    console.log(`Chunk done. Imported so far: ${sent}/${rows.length}`);
    await sleep(delayMs);
  }

  console.log('Done.');
})();
