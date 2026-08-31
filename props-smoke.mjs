// Smoke-test: load the dashboard in headless Chromium, switch to the Props tab,
// and verify the board renders with real rows and no fatal page errors.
// Also checks the Home "Mejores Apuestas de Hoy" landing card (Part 3).
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
    // Ticket 01: serve the unified data layer from the repo root (../data/shared)
    let full = join(root, path);
    if (path.startsWith('/data/shared/')) {
      full = join(root, '..', path);
    }
    const body = await readFile(full);
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
const trending = await page.locator('#propsTrending').innerHTML().catch(() => 'MISSING');
const boardTable = await page.locator('#propsBoard table').count().catch(() => 0);
const rowCount = await page.locator('#propsBoard tbody tr').count().catch(() => 0);
const formCells = await page.locator('#propsBoard tbody tr td:nth-child(9)').allTextContents().catch(() => []);
const homeCard = await page.locator('.spotlight-card', { hasText: 'Mejores Apuestas' }).count().catch(() => 0);
const homeCardRows = await page.locator('.spotlight-card .spotlight-row').count().catch(() => 0);
const meta = await page.locator('#propsMeta').textContent().catch(() => '');

console.log('--- propsSummary (first 500 chars):');
console.log(String(summary).slice(0, 500));
console.log('--- propsBestLines contains Over/Under:', /Over:/.test(String(bestLines)), '| contains age badge:', /\d+[mhd] ago|just now/.test(String(bestLines)));
console.log('--- trending strip chips:', (String(trending).match(/rounded-full/g) || []).length, '| has player link:', /player-link/.test(String(trending)));
console.log('--- 2024 Form column populated:', formCells.filter(t => t && !t.startsWith('—')).length, '/', formCells.length);
console.log('--- board table count:', boardTable, '| rows:', rowCount);
console.log('--- home landing card present:', homeCard > 0, '| spotlight rows:', homeCardRows);
console.log('--- propsMeta:', String(meta).slice(0, 300));

// Open the first player in the value board → verify the modal's 2024 Form
// section renders the game-log table + opponent splits (Feature 5).
let modalStatus = 'skipped';
let modalRows = -1;
if (rowCount > 0) {
  const playerLink = page.locator('#propsBoard .player-link').first();
  if (await playerLink.count()) {
    await playerLink.click();
    await page.waitForTimeout(1500);
    const modalText = await page.locator('#playerModalContent').textContent().catch(() => '');
    const hasForm = /2024 Form/.test(modalText);
    const hasLog = /Weekly game log/.test(modalText);
    const hasOpp = /Best matchups/.test(modalText);
    modalRows = hasLog ? await page.locator('#playerModalContent tbody tr').count().catch(() => -1) : -1;
    modalStatus = `form=${hasForm} log=${hasLog} opp=${hasOpp}`;
    console.log('--- player modal (2024 Form/game log/splits):', modalStatus, '| game-log rows:', modalRows);
  }
}
console.log('--- page errors:', errors.length ? errors.slice(0, 5) : 'none');

// Win Totals tab: switch to it and verify the board renders the model's team
// win-total projection vs the market line with live scoring states.
let winTotalsOk = false;
await page.evaluate(() => { try { closePlayerModal(); closeRoster(); } catch (e) {} }).catch(() => {});
await page.waitForTimeout(300);
const wtBtn = page.locator('button[data-tab="wintotals"]').first();
if (await wtBtn.count()) {
  await wtBtn.click();
  await page.waitForTimeout(1500);
  const summaryHtml = await page.locator('#winTotalsSummary').innerHTML().catch(() => 'MISSING');
  const boardRows = await page.locator('#winTotalsBoard tbody tr').count().catch(() => -1);
  const metaText = await page.locator('#winTotalsMeta').textContent().catch(() => '');
  const stateBadges = await page.locator('#winTotalsBoard tbody [class*=rounded-full]').count().catch(() => -1);
  // Verify the live record + a known pick (e.g. IND projected over, CIN under).
  const rowTexts = await page.locator('#winTotalsBoard tbody tr').allTextContents().catch(() => []);
  const hasIndOver = rowTexts.some(t => /IND/.test(t) && /over/i.test(t));
  const hasCinUnder = rowTexts.some(t => /CIN/.test(t) && /under/i.test(t));
  winTotalsOk = boardRows >= 28 && stateBadges >= 28 && hasIndOver && hasCinUnder;
  console.log('--- win totals summary:', String(summaryHtml).slice(0, 200));
  console.log('--- win totals board rows:', boardRows, '| score badges:', stateBadges, '| IND-over:', hasIndOver, 'CIN-under:', hasCinUnder);
  console.log('--- win totals meta:', String(metaText).slice(0, 200));
} else {
  console.log('--- win totals tab: MISSING (no [data-tab=wintotals] button)');
}
// Matchup Lab: switch to the tab, assert 11 O + 11 X chips, unit strip rows,
// verdict pill, and that switching personnel/defensive front re-renders.
let matchupOk = false;
let gamePickOk = false;
await page.evaluate(() => { try { closePlayerModal(); closeRoster(); } catch (e) {} }).catch(() => {});
await page.waitForTimeout(300);
const matchupBtn = page.locator('button', { hasText: /matchup/i }).first();
if (await matchupBtn.count()) {
  await matchupBtn.click();
  await page.waitForTimeout(1500);
  const offChips = await page.locator('#matchupOffense .formation-player').count().catch(() => -1);
  const defChips = await page.locator('#matchupDefense .formation-player').count().catch(() => -1);
  const unitRows = await page.locator('#matchupUnitStrip .unit-match-row').count().catch(() => -1);
  const verdictText = await page.locator('#matchupVerdict').textContent().catch(() => '');
  // Flip personnel + front, confirm the offense field re-renders without errors.
  await page.selectOption('#matchupPersonnel', '10');
  await page.selectOption('#matchupFront', 'nickel');
  await page.waitForTimeout(800);
  const offChips2 = await page.locator('#matchupOffense .formation-player').count().catch(() => -1);
  const defChips2 = await page.locator('#matchupDefense .formation-player').count().catch(() => -1);
  matchupOk = offChips >= 10 && defChips >= 10 && unitRows === 5 && /over|≈|grade/i.test(String(verdictText)) && offChips2 === offChips && defChips2 === defChips;
  // Game picker: fed from the schedule (272 games across 18 weeks); picking a
  // game sets offense = away, defense = home and re-renders without errors.
  const gameOptions = await page.locator('#matchupGame option').count().catch(() => -1);
  gamePickOk = gameOptions >= 200;
  if (gamePickOk) {
    const firstVal = await page.locator('#matchupGame option').first().getAttribute('value').catch(() => null);
    if (firstVal) {
      await page.selectOption('#matchupGame', firstVal);
      await page.waitForTimeout(800);
      const offHeader = await page.locator('#matchupOffense .text-xs.font-black').first().textContent().catch(() => '');
      const defHeader = await page.locator('#matchupDefense .text-xs.font-black').first().textContent().catch(() => '');
      const chipsAfter = await page.locator('#matchupOffense .formation-player').count().catch(() => -1);
      gamePickOk = offHeader.length > 0 && defHeader.length > 0 && chipsAfter === offChips;
      console.log('--- matchup game picker:', gameOptions, 'options | picked:', String(offHeader).trim(), 'vs', String(defHeader).trim(), '| chips', chipsAfter);
    }
  } else {
    console.log('--- matchup game picker: FAILED (options', gameOptions + ')' );
  }
  console.log('--- matchup lab: O chips', offChips, 'X chips', defChips, '| unit rows', unitRows, '| verdict:', String(verdictText).trim().slice(0, 70));
  console.log('--- matchup re-render after personnel/front change: O', offChips2, 'X', defChips2);
  // Click the first player chip → player modal should open (props deep-link path).
  const firstChip = page.locator('#matchupOffense .formation-player').first();
  if (await firstChip.count()) {
    await firstChip.click();
    await page.waitForTimeout(1200);
    const modalText = await page.locator('#playerModalContent').textContent().catch(() => '');
    console.log('--- matchup player modal opened:', String(modalText).length > 50 ? 'yes' : 'no');
    if (String(modalText).length <= 50) matchupOk = false;
  }
}
console.log('--- page errors:', errors.length ? errors.slice(0, 5) : 'none');

await browser.close();
server.close();
const modalOk = modalStatus === 'skipped' || (/log=true/.test(modalStatus) && modalRows > 0);
if (errors.length || !rowCount || !(String(trending).match(/rounded-full/g) || []).length || !modalOk || !matchupOk || !gamePickOk || !winTotalsOk) { console.log('SMOKE TEST FAILED'); process.exit(1); }
console.log('SMOKE TEST PASSED');
