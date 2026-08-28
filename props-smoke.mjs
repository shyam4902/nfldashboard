// Smoke-test: load the dashboard in headless Chromium, switch to the Props tab,
// and verify the board renders with real rows and no fatal page errors.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/shyampatel/.hermes/hermes-agent/node_modules/playwright');
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise(r => server.listen(8123, r));

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://localhost:8123/', { waitUntil: 'load' });
await page.waitForTimeout(2500);

// Click the Props tab (button containing text "Props")
const propsBtn = page.locator('button', { hasText: /props/i }).first();
if (await propsBtn.count()) await propsBtn.click().catch(() => {});
await page.waitForTimeout(1500);

const summary = await page.locator('#propsSummary').innerHTML().catch(() => 'MISSING');
const bestLines = await page.locator('#propsBestLines').innerHTML().catch(() => 'MISSING');
const boardTable = await page.locator('#propsBoard table').count().catch(() => 0);
const rowCount = await page.locator('#propsBoard tbody tr').count().catch(() => 0);
const meta = await page.locator('#propsMeta').textContent().catch(() => '');

console.log('--- propsSummary (first 500 chars):');
console.log(String(summary).slice(0, 500));
console.log('--- propsBestLines contains Over/Under:', /Over:/.test(String(bestLines)), '| contains age badge:', /\d+[mhd] ago|just now/.test(String(bestLines)));
console.log('--- board table count:', boardTable, '| rows:', rowCount);
console.log('--- propsMeta:', String(meta).slice(0, 300));
console.log('--- page errors:', errors.length ? errors.slice(0, 5) : 'none');

await browser.close();
server.close();
if (errors.length || !rowCount) { console.log('SMOKE TEST FAILED'); process.exit(1); }
console.log('SMOKE TEST PASSED');
