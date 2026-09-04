# Navigation Flow Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Home and Schedule action open the page or view named by the action in one click, without changing the dashboard's visual design.

**Architecture:** Keep the existing single-file app and state model. Replace the matchup summary modal with one shared game-opening function, add small deterministic helpers for named Schedule and Projections destinations, and rewire existing buttons to those functions. Extend the current Playwright smoke test instead of adding a test framework or another test file.

**Tech Stack:** Static HTML, inline JavaScript, Tailwind classes, Playwright smoke testing, Python browser extension checks

---

## Working rules

- Work only in `/Users/shyampatel/Desktop/NFL_Main/nfldashboard`.
- Read `AGENTS.md`, `CLAUDE.md`, `STATE.md`, and `docs/superpowers/specs/2026-09-04-navigation-flow-design.md` before editing.
- Preserve the existing modified screenshot files and the untracked `.superpowers/`, `_redirects`, `home-redesign.html`, and `supabase/.temp/` paths. Do not stage them.
- Do not change page styling, data files, routes, browser history, or dependencies.
- Keep `Matchup` as the existing full page. Remove only its header button and the redundant summary modal.
- Commit only the files named in each task.
- Do not deploy or push. This plan ends with a locally verified branch.
- The repository does not install Playwright locally. Use the bundled module at `/Users/shyampatel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright` for every `props-smoke.mjs` run.

## File map

- Modify `index.html`: shared navigation actions, header labels, Home mappings, Projections subtab labels, command palette actions, and removal of the dead matchup modal code.
- Modify `props-smoke.mjs`: one focused browser regression section for direct game opening, deterministic named destinations, header ownership, and Home button mappings.
- Modify `STATE.md`: record the behavior change and verification commands.

### Task 1: Replace the matchup modal with direct page navigation

**Files:**

- Modify: `props-smoke.mjs:111-192`
- Modify: `props-smoke.mjs:247-253`
- Modify: `index.html:1359-1362`
- Modify: `index.html:5724-5757`
- Modify: `index.html:5843-5909`
- Modify: `index.html:6374-6403`
- Modify: `index.html:6949-7019`

- [ ] **Step 1: Update the stale Home smoke selector**

The current Home redesign renders into `#homeHero`, while the smoke test still inspects the now-empty `#homeFrontDoor`. In `props-smoke.mjs`, replace the old front-door block with:

```js
const homeHero = await page.locator('#homeHero').textContent().catch(() => '');
const homeScorestripGames = await page.locator('#homeHero .h2a-strip-games .h2a-game').count().catch(() => 0);
console.log('--- current Home present:', homeHero.length > 20, '| scorestrip items:', homeScorestripGames);
```

Replace the final `homeOk` assignment with:

```js
const homeOk = homeHero.length > 20 && homeScorestripGames > 0;
```

This is test maintenance for the already-shipped Home redesign. Do not restore the old front-door content or prop-insight assertion.

- [ ] **Step 2: Change the Matchup smoke path to use a selected game**

In `props-smoke.mjs`, replace the header-button setup at the start of the Matchup section with this focused navigation check. Keep the existing Matchup content assertions that follow it.

```js
// Navigation regression: a game opens the full Matchup page directly, named
// collection links reset their nested state, and a missing game preserves state.
const navigationCheck = await page.evaluate(async () => {
  const game = SCHEDULE_DATA?.games?.[0];
  if (!game) return { opened: false, error: 'No schedule game was available' };

  const opened = openMatchup(game.game_id);
  await new Promise(resolve => setTimeout(resolve, 900));
  const selectedTeams = MATCHUP_STATE.teamA === game.away_team && MATCHUP_STATE.teamB === game.home_team;
  const matchupVisible = !document.getElementById('tab-matchup')?.classList.contains('hidden');
  const scheduleOwnsActiveState = document.querySelector('[data-tab="schedule"]')?.classList.contains('active') === true;
  const noSummaryModal = !document.getElementById('matchupModal');

  const beforeMissing = {
    teamA: MATCHUP_STATE.teamA,
    teamB: MATCHUP_STATE.teamB,
    matchupHidden: document.getElementById('tab-matchup')?.classList.contains('hidden')
  };
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  const missingResult = openMatchup('__missing_game__');
  console.error = originalError;
  const missingStayedPut = missingResult === false
    && MATCHUP_STATE.teamA === beforeMissing.teamA
    && MATCHUP_STATE.teamB === beforeMissing.teamB
    && document.getElementById('tab-matchup')?.classList.contains('hidden') === beforeMissing.matchupHidden
    && logged.length === 1
    && logged[0].includes('__missing_game__');

  currentScheduleWeek = 9;
  scheduleView = 'grid';
  scheduleActiveFilter = 'primetime';
  showScheduleWeek(1);
  await new Promise(resolve => setTimeout(resolve, 300));
  const scheduleReset = currentScheduleWeek === 1
    && scheduleView === 'cards'
    && scheduleActiveFilter === 'all'
    && !document.getElementById('tab-schedule')?.classList.contains('hidden');

  currentProjSubTab = 'qb';
  showProjectionsTab('standings');
  await new Promise(resolve => setTimeout(resolve, 300));
  const projectionsReset = currentProjSubTab === 'standings'
    && !document.getElementById('tab-projections')?.classList.contains('hidden');

  openMatchup(game.game_id);
  await new Promise(resolve => setTimeout(resolve, 900));
  return {
    opened,
    selectedTeams,
    matchupVisible,
    scheduleOwnsActiveState,
    noSummaryModal,
    missingStayedPut,
    scheduleReset,
    projectionsReset,
    error: null
  };
});
const navigationOk = navigationCheck.opened === true
  && navigationCheck.selectedTeams
  && navigationCheck.matchupVisible
  && navigationCheck.scheduleOwnsActiveState
  && navigationCheck.noSummaryModal
  && navigationCheck.missingStayedPut
  && navigationCheck.scheduleReset
  && navigationCheck.projectionsReset;
console.log('--- direct navigation:', navigationOk, navigationCheck.error || '');

// Matchup Lab: assert the existing content still renders after contextual entry.
let matchupOk = false;
let gamePickOk = false;
let trustOk = false;
await page.evaluate(() => { try { closePlayerModal(); closeRoster(); } catch (e) {} }).catch(() => {});
await page.waitForTimeout(300);
if (navigationCheck.opened) {
```

Delete these obsolete lines from the old setup:

```js
const matchupBtn = page.locator('button[data-tab="matchup"]').first();
if (await matchupBtn.count()) {
  await matchupBtn.click();
  await page.waitForTimeout(1500);
```

Add `!navigationOk` to the final failure condition:

```js
if (errors.length || hasBrowserSummerOverride || hasLegacyRosterOverride || !homeOk || !navigationOk || !matchupOk || !gamePickOk || !trustOk || !freshnessOk || !rosterDepthOk || !probabilityOk || !capOk || propsNavBtn !== 0 || wtNavBtn !== 0) {
```

- [ ] **Step 3: Run the smoke test and confirm the new check fails**

Run:

```bash
PLAYWRIGHT_MODULE=/Users/shyampatel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node props-smoke.mjs
```

Expected: a nonzero exit because `showScheduleWeek` or `showProjectionsTab` is not defined, or `--- direct navigation: false` because the old matchup modal still intercepts the action.

- [ ] **Step 4: Add deterministic named-destination helpers**

In `index.html`, add `showScheduleWeek` immediately after `setScheduleWeek`:

```js
function showScheduleWeek(week){
  currentScheduleWeek = week;
  scheduleActiveFilter = 'all';
  scheduleView = 'cards';
  document.querySelectorAll('#scheduleFilterRow .sch-f-chip').forEach((chip, index) => chip.classList.toggle('on', index === 0));
  setScheduleView('cards');
  showTab('schedule');
}
```

Add `showProjectionsTab` immediately after `switchProjSubTab`:

```js
function showProjectionsTab(id) {
  currentProjSubTab = id;
  showTab('projections');
}
```

These helpers set state before displaying the page. Do not add URL routing or another state object.

- [ ] **Step 5: Make Matchup a Schedule-owned detail page**

In `showTab`, map Matchup to the Schedule header button for active-state purposes:

```js
  const navTab = tab === 'matchup' ? 'schedule' : tab;
  const activeTab = document.querySelector(`[data-tab="${navTab}"]`);
```

This replaces the existing `activeTab` lookup. Leave the page visibility and render branches unchanged.

- [ ] **Step 6: Replace the summary modal implementation**

Delete `closeMatchupModal`, `marketBlock`, and the full old `openMatchup` body. Replace them with:

```js
function openMatchup(gameId){
  const game = SCHEDULE_DATA?.games?.find(candidate => candidate.game_id === gameId);
  if (!game) {
    console.error(`[openMatchup] Game not found: ${gameId}`);
    return false;
  }
  MATCHUP_STATE.teamA = game.away_team;
  MATCHUP_STATE.teamB = game.home_team;
  showTab('matchup');
  return true;
}
```

Delete the now-unused CSS rule:

```css
/* Modal model win probability numbers, bright with a glow for contrast on dark bg */
#matchupModal .mp-num {
  text-shadow: 0 0 16px rgba(125, 211, 252, 0.5), 0 0 3px rgba(255, 255, 255, 0.45);
}
```

Update the two Schedule comments that still say a grid cell opens a modal. They should say it opens the Matchup page.

- [ ] **Step 7: Run the focused smoke test**

Run:

```bash
PLAYWRIGHT_MODULE=/Users/shyampatel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node props-smoke.mjs
```

Expected: exit code `0`, `--- direct navigation: true`, and `SMOKE TEST PASSED`.

- [ ] **Step 8: Commit the direct-navigation change**

```bash
git add index.html props-smoke.mjs
git commit -m "fix: open scheduled games in matchup directly"
```

### Task 2: Rewire visible navigation and Home actions

**Files:**

- Modify: `props-smoke.mjs:80-109`
- Modify: `props-smoke.mjs:247-253`
- Modify: `index.html:1435-1454`
- Modify: `index.html:2191-2198`
- Modify: `index.html:2898-2968`
- Modify: `index.html:3044-3099`
- Modify: `index.html:5846-5866`
- Modify: `index.html:8079-8092`

- [ ] **Step 1: Add browser assertions for page ownership and button mappings**

In `props-smoke.mjs`, after the existing Home front-door assertions and before navigating away from Home, add:

```js
const matchupNavBtn = await page.locator('button[data-tab="matchup"]').count().catch(() => -1);
const playerCompareLabel = (await page.locator('button[onclick="openPlayerCompareModal()"] span').last().textContent().catch(() => '')).trim();
const homeMappings = await page.evaluate(() => {
  const actions = Array.from(document.querySelectorAll('#tab-home [onclick]'));
  const actionFor = text => actions.find(element => element.textContent.includes(text))?.getAttribute('onclick') || '';
  return {
    compareRosters: actionFor('Compare rosters').includes('openCompare('),
    scorestripGames: document.querySelectorAll('.h2a-strip-games .h2a-game[onclick^="openMatchup"]').length > 0,
    allWeekOneGames: actionFor('All 16 games').includes('showScheduleWeek(1)'),
    projectedStandings: actionFor('Projected standings').includes("showProjectionsTab('standings')"),
    modelLab: actionFor('How the model is graded').includes('/model-lab')
  };
});
const homeMappingsOk = matchupNavBtn === 0
  && playerCompareLabel === 'Player Compare'
  && Object.values(homeMappings).every(Boolean);
console.log('--- owned header and Home mappings:', homeMappingsOk, homeMappings);
```

After the Projections page renders, add:

```js
const projTabText = await page.locator('#projSubTabs').textContent().catch(() => '');
const projectionLabelsOk = projTabText.includes('Strength of Schedule')
  && projTabText.includes('Team Projections')
  && !/📅\s*Schedule\b/.test(projTabText)
  && !/🏟\s*Teams\b/.test(projTabText);
console.log('--- projection labels are specific:', projectionLabelsOk);
```

Add `!homeMappingsOk || !projectionLabelsOk` to the final failure condition:

```js
if (errors.length || hasBrowserSummerOverride || hasLegacyRosterOverride || !homeOk || !homeMappingsOk || !projectionLabelsOk || !navigationOk || !matchupOk || !gamePickOk || !trustOk || !freshnessOk || !rosterDepthOk || !probabilityOk || !capOk || propsNavBtn !== 0 || wtNavBtn !== 0) {
```

- [ ] **Step 2: Run the smoke test and confirm the mapping assertions fail**

Run:

```bash
PLAYWRIGHT_MODULE=/Users/shyampatel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node props-smoke.mjs
```

Expected: `--- owned header and Home mappings: false`, `--- projection labels are specific: false`, and `SMOKE TEST FAILED`.

- [ ] **Step 3: Clarify the header without changing its layout**

In `index.html`:

- Delete the `Matchup` header button with `data-tab="matchup"`.
- Keep the existing Matchup page markup intact.
- Change the visible utility label from `Compare` to `Player Compare`.
- Keep the existing Edge Analytics link in the same utility area.

The resulting visible label must be:

```html
<span class="hidden sm:inline">Player Compare</span>
```

- [ ] **Step 4: Give the featured Home buttons different actions**

In `home2aFeaturedSlide`, replace the duplicate second action with the existing team comparison modal:

```html
<span class="h2a-btn-amber" onclick="openMatchup('${homeEsc(feat.game_id)}')">View matchup →</span>
<span class="h2a-btn-ghost" onclick="openCompare('${homeEsc(feat.away_team)}','${homeEsc(feat.home_team)}')">Compare rosters</span>
```

Do not create another comparison UI. `openCompare(t1, t2)` already renders the two roster panels.

- [ ] **Step 5: Rewire the Home scorestrip and named destinations**

Change each scorestrip game cell from Schedule to its selected game:

```js
return `<div class="h2a-game" onclick="openMatchup('${homeEsc(g.game_id)}')">
```

Change the collection tile to reset Schedule to Week 1:

```html
<div class="h2a-game" style="flex:0 0 126px;display:flex;flex-direction:column;justify-content:center;gap:4px;border-right:0" onclick="showScheduleWeek(1)">
```

Change the Home stat card whose label is `16 Week 1 Games` to:

```js
{ label: '16 Week 1 Games', sub: 'odds & win probabilities', icon: '📅', color: '#10b981', action: "showScheduleWeek(1)" },
```

Change every Home power-index row, `All 32`, and `Projected standings` action from broad Projections navigation to:

```js
showProjectionsTab('standings')
```

Change the grading action to the existing Edge Model Lab route:

```html
<span class="h2a-btn-ghost" onclick="window.open('https://edge.shyamsapps.qzz.io/model-lab','_blank')">How the model is graded</span>
```

Leave `Open Edge Analytics` pointed at the Edge home page.

- [ ] **Step 6: Rename the ambiguous Projections subtabs**

In `PROJ_SUB_TABS`, change labels only. Keep the ids and render branches unchanged:

```js
{ id: 'sos', label: 'Strength of Schedule', icon: '📅', group: 'Team' },
{ id: 'teamproj', label: 'Team Projections', icon: '🏟', group: 'Team' },
```

- [ ] **Step 7: Make command-palette destinations match the visible names**

Update the command-palette `tabs` entries to use deterministic helpers and add the missing Player Compare action:

```js
const tabs = [
  { label: 'Home Dashboard', type: 'Tab', icon: '🏠', action: () => { showTab('home'); closeCommandPalette(); } },
  { label: 'Week 1 Schedule', type: 'Tab', icon: '📅', action: () => { showScheduleWeek(1); closeCommandPalette(); } },
  { label: 'Transactions / Moves', type: 'Tab', icon: '⚡', action: () => { showMovesTab(); closeCommandPalette(); } },
  { label: 'Teams & Rosters', type: 'Tab', icon: '🛡', action: () => { showTab('teams'); closeCommandPalette(); } },
  { label: 'Mike Clay Projections', type: 'Tab', icon: '📊', action: () => { showProjectionsTab('standings'); closeCommandPalette(); } },
  { label: 'Player Compare', type: 'Feature', icon: '⚖️', action: () => { openPlayerCompareModal(); closeCommandPalette(); } },
  { label: 'Edge Analytics (Props & Value)', type: 'Tab', icon: '💰', action: () => { window.open('https://edgeplay-analytics.pages.dev/props','_blank'); closeCommandPalette(); } },
  { label: 'Win Totals (Edge Analytics)', type: 'Tab', icon: '🏆', action: () => { window.open('https://edgeplay-analytics.pages.dev/win-totals','_blank'); closeCommandPalette(); } },
  { label: 'Matchup Center (Pro Preview & Next Gen Stats)', type: 'Tab', icon: '⚔️', action: () => { showTab('matchup'); closeCommandPalette(); } },
  { label: 'Next Gen Matchups 101', type: 'Guide', icon: '💡', action: () => { openMatchups101Modal(); closeCommandPalette(); } },
  { label: 'Clay vs Market Delta', type: 'Feature', icon: '⚡', action: () => { showProjectionsTab('clay_delta'); closeCommandPalette(); } },
  { label: 'Opponent Matchup Matrix', type: 'Feature', icon: '🎯', action: () => { showProjectionsTab('matchup_matrix'); closeCommandPalette(); } },
  { label: 'Consensus Power Index', type: 'Feature', icon: '🏆', action: () => { showProjectionsTab('consensus'); closeCommandPalette(); } },
];
```

Keep the command-palette Matchup entry. It is the advanced direct entry allowed by the approved design.

- [ ] **Step 8: Run the smoke test**

Run:

```bash
PLAYWRIGHT_MODULE=/Users/shyampatel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node props-smoke.mjs
```

Expected: exit code `0`, both new mapping logs end in `true`, and `SMOKE TEST PASSED`.

- [ ] **Step 9: Commit the visible mappings**

```bash
git add index.html props-smoke.mjs
git commit -m "fix: align dashboard buttons with page ownership"
```

### Task 3: Verify the complete flow and update project state

**Files:**

- Modify: `STATE.md:1-60`

- [ ] **Step 1: Run the automated UI checks**

Run:

```bash
PLAYWRIGHT_MODULE=/Users/shyampatel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node props-smoke.mjs
python3 test_all_extensions.py
git diff --check
```

Expected:

- `props-smoke.mjs` exits `0` and prints `SMOKE TEST PASSED`.
- `test_all_extensions.py` exits `0` with no console errors.
- `git diff --check` prints nothing and exits `0`.

- [ ] **Step 2: Verify the direct game flows in the in-app browser**

Open the local dashboard in the in-app browser. Use the current local server URL if one is already running. Otherwise start the repository's static preview and open its reported localhost URL.

Check these actions in order:

1. Home `View matchup` opens the featured teams in the full Matchup page with no modal.
2. Home `Compare rosters` opens the existing two-team comparison with the featured teams.
3. A scorestrip game opens its selected Matchup in one click.
4. `All 16 games` opens Schedule, Week 1, Broadcast Slate, All Games.
5. A Schedule card and a full-season grid cell each open the selected Matchup directly.
6. `Projected standings`, a power row, and `All 32` each open Projections with Standings active.
7. Projections shows `Strength of Schedule` and `Team Projections`, and each retains its old content.
8. `How the model is graded` targets `https://edge.shyamsapps.qzz.io/model-lab`.
9. The command palette has `Player Compare` and retains `Matchup Center`.
10. The browser console has no unexpected errors or warnings during valid flows.

Expected: every named action reaches its owner in one click, and Schedule stays active in the header while the Matchup detail page is open.

- [ ] **Step 3: Record the behavior change in STATE.md**

Under `## Shipped recently`, add:

```markdown
- Simplified dashboard navigation and page ownership:
  - Removed Matchup from the header while keeping the full Matchup page available through selected games and the command palette.
  - Routed Home and Schedule game actions directly to the selected Matchup with no summary modal.
  - Gave named Home links deterministic Week 1 and Projections Standings destinations.
  - Renamed Compare to Player Compare, Both depth charts to Compare rosters, and the ambiguous Projections subtabs to Strength of Schedule and Team Projections.
  - Pointed How the model is graded to the Edge Analytics Model Lab.
  - Verified with `node props-smoke.mjs` and `python3 test_all_extensions.py`.
```

Do not rewrite the unrelated roster, data, backup, or deployment notes.

- [ ] **Step 4: Review the final diff for scope**

Run:

```bash
git diff -- index.html props-smoke.mjs STATE.md
git status --short
```

Expected: only the planned navigation, smoke-test, and state changes appear in the diff. The pre-existing screenshot modifications and untracked paths remain untouched and unstaged.

- [ ] **Step 5: Commit the verified state note**

```bash
git add STATE.md
git commit -m "docs: record navigation flow cleanup"
```

- [ ] **Step 6: Report the local result**

Report the three commit hashes, the automated check results, and the local browser flows checked. State plainly that no push or deployment was performed.

## Completion conditions

- `Matchup` is absent from the header and still available through selected games and the command palette.
- Every specific-game action reaches the selected full Matchup page without a modal.
- Missing game ids log once and preserve the current view and teams.
- Schedule-owned Matchup keeps Schedule active in the header.
- Week 1 collection actions reset the week, view, and filter.
- Named Projections actions open Standings regardless of prior subtab state.
- Player Compare and roster comparison are visibly distinct actions.
- The old Projections content remains under clearer labels.
- Automated checks and the in-app browser pass with no unexpected console errors.
- No unrelated files are staged, pushed, or deployed.
