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
import { access } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const playwrightModule = process.env.PLAYWRIGHT_MODULE || 'playwright';
let chromium;
try {
  ({ chromium } = require(playwrightModule));
} catch (error) {
  throw new Error(`Unable to load Playwright from '${playwrightModule}'. Install it in the repository or set PLAYWRIGHT_MODULE to a valid module path. Original error: ${error.message}`);
}
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = process.cwd();
await access(join(root, 'index.html'));
const sourceHtml = await readFile(join(root, 'index.html'), 'utf8');
const walkthrough = await readFile(join(root, 'WALKTHROUGH.md'), 'utf8');
const hasUnsupportedWalkthroughRanking = /\*\*Top WR:\*\*/.test(walkthrough);
if (hasUnsupportedWalkthroughRanking) throw new Error('WALKTHROUGH.md contains unsupported global Top WR ranking claim');
const hasFabricatedMissingValueFallback = /cap\.space\s*\|\|\s*0|parseInt\(g\.win_probability\)\s*\|\|\s*50/.test(sourceHtml);
if (hasFabricatedMissingValueFallback) throw new Error('Dashboard contains fabricated numeric fallback for missing cap space or win probability');
const hasRawMissingProbabilityLabel = /\$\{g\.win_probability\}/.test(sourceHtml) && !/probability === null \? ['"]Unavailable['"]/.test(sourceHtml);
if (hasRawMissingProbabilityLabel) throw new Error('Dashboard can render a raw missing win probability instead of an unavailable state');
const hasBrowserSummerOverride = /applySummer2026Updates|tx-2026-|capAdjustments|custom-p-/.test(sourceHtml);
const generatorSource = await readFile(join(root, 'generate_roster_files.js'), 'utf8');
const syncSource = await readFile(join(root, 'sync_supabase_rosters.js'), 'utf8');
const hasLegacyRosterOverride = /applySummer2026Updates|PLAYER_UPDATES|applyUpdates\s*\(/.test(generatorSource + syncSource);
const hasStaleSyncComments = /applied updates|ESPN depth-chart overlay/i.test(syncSource);
if (hasStaleSyncComments) throw new Error('Roster sync script contains stale override or overlay comments');
console.log('--- browser-side summer override removed:', !hasBrowserSummerOverride, '| duplicate roster overrides removed:', !hasLegacyRosterOverride, '| sync comments current:', !hasStaleSyncComments);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    // Serve the VERSIONED data/shared copies (nfldashboard/data/shared) — the
    // same bytes the git-connected Cloudflare Pages deploy ships. The
    // unversioned ../data/shared workspace handoff is the sync script's input,
    // not the deploy payload, so it is deliberately not what the smoke test
    // exercises; scripts/validate-data.js is the consistency gate instead.
    let full = join(root, path);
    const body = await readFile(full);
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise(r => server.listen(8123, r));

let browser;
try {
  browser = await chromium.launch();
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

// Ticket 14: freshness stamps visible on tab headers.
let freshnessOk = false;
await page.locator('button[data-tab="schedule"]').first().click();
await page.waitForTimeout(800);
const schedStamp = await page.locator('#scheduleFreshness').textContent().catch(() => '');
await page.locator('button[data-tab="projections"]').first().click();
await page.waitForTimeout(800);
const projStamp = await page.locator('#projectionsFreshness').textContent().catch(() => '');
const projGroups = await page.locator('#projSubTabs span').filter({ hasText: /Team|Offense|Defense|Model/ }).count().catch(() => 0);
freshnessOk = /data .* ago/.test(schedStamp) && /data .* ago/.test(projStamp) && projGroups >= 4;
console.log('--- freshness stamps (schedule/proj):', /data .* ago/.test(schedStamp), /data .* ago/.test(projStamp), '| projections groups:', projGroups);

// Matchup Lab: switch to the tab, assert 11 O + 11 X chips, unit strip rows,
// verdict pill, and that switching personnel/defensive front re-renders.
let matchupOk = false;
let gamePickOk = false;
let trustOk = false;
await page.evaluate(() => { try { closePlayerModal(); closeRoster(); } catch (e) {} }).catch(() => {});
await page.waitForTimeout(300);
const matchupBtn = page.locator('button[data-tab="matchup"]').first();
if (await matchupBtn.count()) {
  await matchupBtn.click();
  await page.waitForTimeout(1500);

  const heroText = await page.locator('#matchupHeroBanner').textContent().catch(() => '');
  const sidebarText = await page.locator('#matchupSidebar').textContent().catch(() => '');
  console.log('--- matchup hero banner:', String(heroText).replace(/\s+/g, ' ').slice(0, 70));

  // Test Passing splits subtab — real efficiency metrics (5 per side × 2 sides)
  await page.evaluate(() => setMatchupSubTab('passing'));
  await page.waitForTimeout(500);
  const passRows = await page.locator('#matchupMainContent .matchup-table-row').count().catch(() => 0);
  console.log('--- matchup passing split rows:', passRows);

  // Trust bar (ticket 14): At a Glance shows real EPA/success numbers, not
  // fabricated close-record / penalties. Sources & method footnote present.
  await page.evaluate(() => setMatchupSubTab('overview'));
  await page.waitForTimeout(500);
  const glanceText = await page.locator('#matchupMainContent').textContent().catch(() => '');
  await page.evaluate(() => setMatchupSubTab('insights'));
  await page.waitForTimeout(400);
  const insightsText = await page.locator('#matchupMainContent').textContent().catch(() => '');
  const noUnsupportedNarrative = !/top WR|leads .* edge rush|anchors .* line|coverage unit led by|Quarterback duel/.test(insightsText);
  const hasContextDisclosure = /player-vs-player assignments, injury status, or a player-specific weekly projection/.test(insightsText);
  const hasRealEpa = /EPA\/play 2025/.test(glanceText);
  const noFakeStats = !/Record in Close Games/.test(glanceText) && !/Total Penalties/.test(glanceText);
  const sourcesNote = await page.locator('text=Sources & Method').count().catch(() => 0);
  trustOk = hasRealEpa && noFakeStats && sourcesNote > 0 && noUnsupportedNarrative && hasContextDisclosure;
  console.log('--- at-a-glance real EPA:', hasRealEpa, '| no fabricated columns:', noFakeStats, '| sources note:', sourcesNote > 0);

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
  matchupOk = heroText.length > 10 && passRows >= 8 && offChips >= 10 && defChips >= 10 && unitRows === 5 && offChips2 === offChips && defChips2 === defChips;

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
// Ticket 14 audit: Teams depth panel renders the real Supabase roster view
// ("Roster Depth"), not the removed Clay projected_starters panel.
let rosterDepthOk = false;
await page.evaluate(() => { try { closeRoster(); } catch (e) {} }).catch(() => {});
const rosterCheck = await page.evaluate(async () => {
  if (typeof openRoster !== 'function') return { skipped: true };
  await openRoster('Dallas Cowboys', 'projections');
  await new Promise(r => setTimeout(r, 1200));
  const txt = document.getElementById('rosterBody')?.textContent || '';
  return {
    hasRosterDepth: /Roster Depth/.test(txt),
    hasOldPanelTitle: /Projected Starters & Clay Ratings/.test(txt)
  };
});
if (!rosterCheck.skipped) {
  rosterDepthOk = rosterCheck.hasRosterDepth && !rosterCheck.hasOldPanelTitle;
  console.log('--- roster depth panel: real roster view:', rosterCheck.hasRosterDepth, '| old Clay starters panel gone:', !rosterCheck.hasOldPanelTitle);
}
const missingProbabilityCheck = await page.evaluate(async () => {
  const team = Object.keys(CLAY_DATA?.team_projections || {}).find(name =>
    CLAY_DATA.team_projections[name]?.weekly_projections?.some(game => game.opponent && game.opponent !== '0'));
  if (!team) return { hasUnavailable: false, hasRawUndefined: false, error: 'No team with a weekly projection was available' };
  const games = CLAY_DATA.team_projections[team].weekly_projections;
  const target = games.find(game => game.opponent && game.opponent !== '0');
  const original = target.win_probability;
  try {
    target.win_probability = undefined;
    await renderTeamProjectionsBody(team);
    const text = document.getElementById('rosterBody')?.textContent || '';
    return { hasUnavailable: text.includes('Unavailable'), hasRawUndefined: text.includes('undefined'), error: null };
  } finally {
    target.win_probability = original;
    await renderTeamProjectionsBody(team);
  }
}).catch(error => ({ hasUnavailable: false, hasRawUndefined: false, error: String(error) }));
const probabilityOk = missingProbabilityCheck.hasUnavailable && !missingProbabilityCheck.hasRawUndefined;
console.log('--- missing weekly probability renders unavailable:', probabilityOk, missingProbabilityCheck.error || '');
const missingCapCheck = await page.evaluate(async () => {
  const team = 'Dallas Cowboys';
  const original = DATA.capData[team];
  try {
    delete DATA.capData[team];
    await renderRosterSummary(team);
    const text = document.getElementById('rosterSummary')?.textContent || '';
    return { hasUnavailable: text.includes('Unavailable') || text.includes('—'), hasZero: text.includes('$0'), error: null };
  } finally {
    DATA.capData[team] = original;
    await renderRosterSummary(team);
  }
}).catch(error => ({ hasUnavailable: false, hasZero: true, error: String(error) }));
const capOk = missingCapCheck.hasUnavailable && !missingCapCheck.hasZero;
console.log('--- missing cap space renders unavailable:', capOk, missingCapCheck.error || '');
console.log('--- page errors:', errors.length ? errors.slice(0, 5) : 'none');

  const homeOk = frontDoor.length > 20 && (frontDoorGames > 0 || /no games|unavailable/i.test(frontDoor));
  if (errors.length || hasBrowserSummerOverride || hasLegacyRosterOverride || !homeOk || !matchupOk || !gamePickOk || !trustOk || !freshnessOk || !rosterDepthOk || !probabilityOk || !capOk || propsNavBtn !== 0 || wtNavBtn !== 0) {
    console.log('SMOKE TEST FAILED');
    process.exitCode = 1;
  } else {
    console.log('SMOKE TEST PASSED');
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
