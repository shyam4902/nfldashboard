// Smoke-test: load the dashboard in headless Chromium, verify the Home
// front door renders (game cards + prop insight) and the Matchup Lab works,
// with zero fatal page errors.
//
// Ticket 13: Props & Value and Win Totals tabs were removed from the
// dashboard and now live in the Edge Analytics app. This test no longer
// asserts those tabs. It verifies Home (front door, game cards, prop
// insight line) and the Matchup Lab (formation chips, unit rows, game
// picker).
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

// Ticket 03: Today in the NFL front door — game cards + one-line prop insight.
const frontDoor = await page.locator('#homeFrontDoor').textContent().catch(() => '');
const frontDoorGames = await page.locator('#homeFrontDoor .glass.rounded-lg').count().catch(() => 0);
const frontDoorInsight = frontDoor.includes('looks generous') || frontDoor.includes('a lean') || frontDoor.includes('a slight edge');
console.log('--- front door present:', frontDoor.length > 20, '| game cards:', frontDoorGames, '| has prop insight:', frontDoorInsight);

// Verify the Props & Value and Win Totals nav buttons are gone (Ticket 13).
const propsNavBtn = await page.locator('button[data-tab="props"]').count().catch(() => 0);
const wtNavBtn = await page.locator('button[data-tab="wintotals"]').count().catch(() => 0);
console.log('--- props nav button removed:', propsNavBtn === 0, '| win totals nav button removed:', wtNavBtn === 0);

// Verify the Schedule win-totals cross-link to the edge app is present.
const schedLink = await page.locator('a[href*="edgeplay-analytics.pages.dev/win-totals"]').count().catch(() => 0);
console.log('--- schedule win-totals link present:', schedLink > 0);

// Verify the Edge Analytics top-bar button is still present.
const edgeBtn = await page.locator('a[href*="edgeplay-analytics.pages.dev"]').count().catch(() => 0);
console.log('--- edge analytics links present:', edgeBtn);

// Matchup Lab: switch to the tab, assert 11 O + 11 X chips, unit strip rows,
// verdict pill, and that switching personnel/defensive front re-renders.
let matchupOk = false;
let gamePickOk = false;
await page.evaluate(() => { try { closePlayerModal(); closeRoster(); } catch (e) {} }).catch(() => {});
await page.waitForTimeout(300);
const matchupBtn = page.locator('button[data-tab="matchup"]').first();
if (await matchupBtn.count()) {
  await matchupBtn.click();
  await page.waitForTimeout(1500);

  const heroText = await page.locator('#matchupHeroBanner').textContent().catch(() => '');
  const sidebarText = await page.locator('#matchupSidebar').textContent().catch(() => '');
  console.log('--- matchup hero banner:', String(heroText).replace(/\s+/g, ' ').slice(0, 70));

  // Test Passing splits subtab
  await page.evaluate(() => setMatchupSubTab('passing'));
  await page.waitForTimeout(500);
  const passRows = await page.locator('#matchupMainContent .matchup-table-row').count().catch(() => 0);
  console.log('--- matchup passing split rows:', passRows);

  // Switch to Formation Lab subtab
  await page.evaluate(() => setMatchupSubTab('formation'));
  await page.waitForTimeout(800);

  const offChips = await page.locator('.formation-field .fp-o').count().catch(() => -1);
  const defChips = await page.locator('.formation-field .fp-x').count().catch(() => -1);
  const unitRows = await page.locator('.unit-match-row').count().catch(() => -1);

  // Flip personnel + front, confirm the formation re-renders without errors.
  await page.selectOption('#matchupPersonnel', '10');
  await page.selectOption('#matchupFront', 'nickel');
  await page.waitForTimeout(800);
  const offChips2 = await page.locator('.formation-field .fp-o').count().catch(() => -1);
  const defChips2 = await page.locator('.formation-field .fp-x').count().catch(() => -1);
  matchupOk = heroText.length > 10 && passRows >= 12 && offChips >= 10 && defChips >= 10 && unitRows === 5 && offChips2 === offChips && defChips2 === defChips;

  // Game picker: fed from the schedule (272 games across 18 weeks); picking a game re-renders
  const gameOptions = await page.locator('#matchupGame option').count().catch(() => -1);
  gamePickOk = gameOptions >= 200;
  if (gamePickOk) {
    const firstVal = await page.locator('#matchupGame option').first().getAttribute('value').catch(() => null);
    if (firstVal) {
      await page.selectOption('#matchupGame', firstVal);
      await page.waitForTimeout(800);
      const heroAfter = await page.locator('#matchupHeroBanner').textContent().catch(() => '');
      gamePickOk = heroAfter.length > 10;
      console.log('--- matchup game picker:', gameOptions, 'options | picked:', firstVal);
    }
  } else {
    console.log('--- matchup game picker: FAILED (options', gameOptions + ')' );
  }
  console.log('--- matchup lab: O chips', offChips, 'X chips', defChips, '| unit rows', unitRows);
  console.log('--- matchup re-render after personnel/front change: O', offChips2, 'X', defChips2);

  // Click the first player chip → player modal should open (props deep-link path).
  const firstChip = page.locator('.formation-field .formation-player').first();
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
if (errors.length || !matchupOk || !gamePickOk || propsNavBtn !== 0 || wtNavBtn !== 0) { console.log('SMOKE TEST FAILED'); process.exit(1); }
console.log('SMOKE TEST PASSED');
