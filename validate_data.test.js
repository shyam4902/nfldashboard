// Hermetic tests for scripts/validate-data.js.
//
// Builds a throwaway dashboard-shaped fixture workspace under the OS tmpdir,
// writes controlled JSON artifacts, and runs the REAL validator module against
// it. No live data, App Support, Supabase, network access, or current-workspace
// state is read — everything lives in the temp fixture. The real inventory
// (scripts/data-assets.json) is copied so the schema contract under test is
// the shipped one.
//
// Provenance model under test: file mtimes are NOT provenance (Git discards
// them on checkout — a clean clone must validate). The manifest is checked for
// internal consistency only (as_of <= generated_at, age/status derived from
// as_of, max_age matches the inventory) plus the exact embedded generated_at
// comparison for props-board.json, whose timestamp lives in file content and
// survives any copy or checkout.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { validate } = require('./scripts/validate-data.js');

const HERE = __dirname;
const GENERATED_AT = '2026-09-03T08:47:13Z';

// Manifest-declared vintages. For embedded assets this equals the file's
// generated_at; for the rest it is an internal consistency anchor the manifest
// must honor (parseable, never postdating generated_at).
const VINTAGES = {
  props_board: '2026-09-02T11:02:09.751Z',   // embedded generated_at (content check)
  rosters: '2026-09-01T08:48:31Z',            // internal only
  schedule: '2026-08-26T05:09:28Z',           // internal only (stale)
  clay_projections: '2026-08-26T00:53:55Z',   // internal only
  team_efficiency: '2026-08-30T19:28:25Z',    // internal (research-sourced)
  stickiness: '2026-08-30T19:28:41Z',
  win_projection: '2026-08-30T19:28:42Z',
  market_comparison: '2026-08-30T19:28:50Z',
};

// Same arithmetic as the validator / producer stamp(): floor on epoch seconds.
function ageHours(asOfIso) {
  const gen = Math.floor(Date.parse(GENERATED_AT) / 1000);
  const as = Math.floor(Date.parse(asOfIso) / 1000);
  return Math.floor((gen - as) / 3600);
}

function statusOf(asOfIso, max) {
  return ageHours(asOfIso) > max ? 'stale' : 'fresh';
}

function fixtureRows(n, make) {
  return Array.from({ length: n }, (_, i) => make(i));
}

function buildWorkspace(dir) {
  const shared = path.join(dir, 'data', 'shared');
  fs.mkdirSync(shared, { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(HERE, 'scripts', 'data-assets.json'),
    path.join(dir, 'scripts', 'data-assets.json'));

  // props_board: embedded generated_at wins (canonical + root fallback copy)
  const board = JSON.stringify({
    generated_at: VINTAGES.props_board, summary: {}, plays: [], best_lines: []
  });
  fs.writeFileSync(path.join(shared, 'props-board.json'), board);
  fs.writeFileSync(path.join(dir, 'props-board.json'), board);

  // clay: canonical root + data/shared copy (no mtime dependence)
  const clay = JSON.stringify({ team_projections: {}, metadata: {}, strength_of_schedule: {} });
  fs.writeFileSync(path.join(dir, 'clay_projections_2026.json'), clay);
  fs.writeFileSync(path.join(shared, 'clay_projections_2026.json'), clay);

  // schedule: canonical root + data/shared copy; 272 valid games
  const games = fixtureRows(272, i => ({
    game_id: `2026-g${i}`, away_team: 'Kansas City Chiefs', home_team: 'Buffalo Bills',
    kickoff_utc: '2026-09-10T00:20:00Z', week: ((i % 18) + 1)
  }));
  const sched = JSON.stringify({ season: 2026, week: 1, total_weeks: 18, games });
  fs.writeFileSync(path.join(dir, 'schedule.json'), sched);
  fs.writeFileSync(path.join(shared, 'schedule.json'), sched);

  // rosters: canonical root + data/shared copy; 1000 players
  const rosters = fixtureRows(1000, i => ({
    team_name: 'Kansas City Chiefs', team_abbr: 'KC', division: 'AFC West',
    name: `Player ${i}`, pos: 'QB', unit: 'OFFENSE', ovr: 90, age: 25, jersey: i,
    is_rookie: 'No', acquisition_type: 'veteran'
  }));
  fs.writeFileSync(path.join(dir, 'nfl_rosters_2026.json'), JSON.stringify(rosters));
  fs.writeFileSync(path.join(shared, 'nfl_rosters_2026.json'), JSON.stringify(rosters));

  // team_efficiency: canonical data/shared + root fallback copy; 100 rows
  const eff = fixtureRows(100, i => ({
    season: 2025, team: i % 2 ? 'KC' : 'BUF', side: 'off', plays: 1000,
    epa_per_play: 0.1, success_rate: 0.45
  }));
  fs.writeFileSync(path.join(shared, 'team_season_efficiency.json'), JSON.stringify(eff));
  fs.writeFileSync(path.join(dir, 'team_season_efficiency.json'), JSON.stringify(eff));

  // optional asset present in the clean workspace
  fs.writeFileSync(path.join(dir, 'draft-capital.json'), JSON.stringify({ capital: {} }));

  // freshness manifest: all 8 sources, internally consistent by construction.
  // No file mtime was set — the manifest must hold on its own.
  const sources = {};
  for (const [key, asOf] of Object.entries(VINTAGES)) {
    const max = key === 'props_board' ? 24
      : (key === 'schedule' || key === 'rosters') ? 168
      : key === 'clay_projections' ? 720
      : 262980;
    sources[key] = {
      as_of: asOf,
      status: statusOf(asOf, max),
      age_hours: ageHours(asOf),
      max_age_hours: max
    };
  }
  fs.writeFileSync(path.join(shared, 'freshness.json'),
    JSON.stringify({ generated_at: GENERATED_AT, sources }));
}

function makeWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-data-fixture-'));
  buildWorkspace(dir);
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function problemsFor(result, id) {
  const r = result.results.find(x => x.id === id);
  return r ? r.problems : [];
}

test('clean fixture workspace passes all checks', () => {
  const dir = makeWorkspace();
  try {
    const result = validate(dir);
    assert.equal(result.ok, true, result.problems.join('\n'));
    assert.equal(result.results.length, 15); // 8 file assets + 3 'none' + 4 runtime
    for (const r of result.results) assert.equal(r.ok, true, `${r.id}: ${r.problems.join('; ')}`);
  } finally { cleanup(dir); }
});

test('clean checkout: fresh file mtimes (as git writes them) never affect provenance', () => {
  const dir = makeWorkspace();
  try {
    // Simulate `git clone`: every tracked file gets checkout-time mtimes.
    const now = Date.now() / 1000;
    for (const rel of ['schedule.json', 'clay_projections_2026.json', 'nfl_rosters_2026.json',
      'data/shared/schedule.json', 'data/shared/clay_projections_2026.json',
      'data/shared/nfl_rosters_2026.json', 'props-board.json', 'data/shared/props-board.json',
      'data/shared/team_season_efficiency.json', 'team_season_efficiency.json',
      'data/shared/freshness.json']) {
      fs.utimesSync(path.join(dir, rel), now, now);
    }
    const result = validate(dir);
    assert.equal(result.ok, true, result.problems.join('\n'));
  } finally { cleanup(dir); }
});

test('duplicate deploy copy drift fails consistency', () => {
  const dir = makeWorkspace();
  try {
    fs.writeFileSync(path.join(dir, 'props-board.json'),
      JSON.stringify({ generated_at: VINTAGES.props_board, summary: {}, plays: [], best_lines: [], extra: true }));
    const result = validate(dir);
    assert.equal(result.ok, false);
    assert.ok(problemsFor(result, 'props_board').some(p => /differs from canonical/.test(p)));
  } finally { cleanup(dir); }
});

test('corrupt JSON fails parse check', () => {
  const dir = makeWorkspace();
  try {
    fs.writeFileSync(path.join(dir, 'schedule.json'), '{ not json');
    const result = validate(dir);
    assert.equal(result.ok, false);
    assert.ok(problemsFor(result, 'schedule').some(p => /not valid JSON/.test(p)));
  } finally { cleanup(dir); }
});

test('missing required asset fails; missing optional asset passes', () => {
  const dir = makeWorkspace();
  try {
    fs.rmSync(path.join(dir, 'data', 'shared', 'clay_projections_2026.json'));
    fs.rmSync(path.join(dir, 'draft-capital.json')); // optional — must not fail
    const result = validate(dir);
    assert.equal(result.ok, false);
    assert.ok(problemsFor(result, 'clay_projections').some(p => /copy .* is missing/.test(p)), JSON.stringify(problemsFor(result, 'clay_projections')));
    assert.equal(problemsFor(result, 'draft_capital').some(p => /missing required/.test(p)), false);
  } finally { cleanup(dir); }
});

test('short required array fails min-length check', () => {
  const dir = makeWorkspace();
  try {
    fs.writeFileSync(path.join(dir, 'nfl_rosters_2026.json'), JSON.stringify([
      { team_name: 'KC', name: 'P1', pos: 'QB', unit: 'OFFENSE' }
    ]));
    const result = validate(dir);
    assert.equal(result.ok, false);
    assert.ok(problemsFor(result, 'rosters').some(p => /expected >= 1000/.test(p)));
  } finally { cleanup(dir); }
});

test('manifest as_of that is not the embedded generated_at fails provenance', () => {
  const dir = makeWorkspace();
  try {
    const mPath = path.join(dir, 'data', 'shared', 'freshness.json');
    const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
    m.sources.props_board.as_of = '2026-09-02T10:00:00Z'; // not the embedded value
    fs.writeFileSync(mPath, JSON.stringify(m));
    const result = validate(dir);
    assert.equal(result.ok, false);
    assert.ok(problemsFor(result, 'props_board').some(p => /as_of .* != true vintage/.test(p)));
  } finally { cleanup(dir); }
});

test('status contradicting the age threshold fails', () => {
  const dir = makeWorkspace();
  try {
    const mPath = path.join(dir, 'data', 'shared', 'freshness.json');
    const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
    m.sources.schedule.status = 'fresh'; // schedule is >168h old; must be stale
    fs.writeFileSync(mPath, JSON.stringify(m));
    const result = validate(dir);
    assert.equal(result.ok, false);
    assert.ok(problemsFor(result, 'schedule').some(p => /status/.test(p)));
  } finally { cleanup(dir); }
});

test('manifest missing a source and unknown source both fail the contract', () => {
  const dir = makeWorkspace();
  try {
    const mPath = path.join(dir, 'data', 'shared', 'freshness.json');
    const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
    delete m.sources.stickiness;
    m.sources.bogus_source = { as_of: VINTAGES.props_board, status: 'fresh', age_hours: 0, max_age_hours: 24 };
    fs.writeFileSync(mPath, JSON.stringify(m));
    const result = validate(dir);
    assert.equal(result.ok, false);
    assert.ok(result.problems.some(p => /missing source "stickiness"/.test(p)));
    assert.ok(result.problems.some(p => /unknown source "bogus_source"/.test(p)));
  } finally { cleanup(dir); }
});

test('absent freshness manifest is acceptable (optional by design)', () => {
  const dir = makeWorkspace();
  try {
    fs.rmSync(path.join(dir, 'data', 'shared', 'freshness.json'));
    const result = validate(dir);
    assert.equal(result.ok, true, result.problems.join('\n'));
  } finally { cleanup(dir); }
});

// ── malformed shapes: null / primitives / arrays where objects are required,
//    and non-object array entries — all must be normal validation messages,
//    never uncaught exceptions. ─────────────────────────────────────────────

test('null, primitive, and wrong-container data are rejected cleanly', () => {
  const cases = [
    // object-required assets receiving null / primitives / arrays
    { rel: 'schedule.json', write: 'null', asset: 'schedule', expect: 'must be a JSON object' },
    { rel: 'schedule.json', write: JSON.stringify('plain string'), asset: 'schedule', expect: 'must be a JSON object' },
    { rel: 'schedule.json', write: JSON.stringify(42), asset: 'schedule', expect: 'must be a JSON object' },
    { rel: 'schedule.json', write: JSON.stringify([1, 2, 3]), asset: 'schedule', expect: 'must be a JSON object' },
    { rel: 'clay_projections_2026.json', write: JSON.stringify([1, 2, 3]), asset: 'clay_projections', expect: 'must be a JSON object' },
    { rel: 'data/shared/props-board.json', write: JSON.stringify('board-as-string'), asset: 'props_board', expect: 'must be a JSON object' },
    { rel: 'data/shared/freshness.json', write: 'null', asset: 'freshness', expect: 'must be a JSON object' },
    // array-required asset receiving an object
    { rel: 'nfl_rosters_2026.json', write: JSON.stringify({ nope: true }), asset: 'rosters', expect: 'must be an array' },
  ];
  for (const c of cases) {
    const dir = makeWorkspace();
    try {
      fs.writeFileSync(path.join(dir, c.rel), c.write);
      const result = validate(dir); // must not throw
      assert.equal(result.ok, false, `${c.rel}: expected failure`);
      assert.ok(problemsFor(result, c.asset).some(p => p.includes(c.expect)),
        `${c.rel} -> ${JSON.stringify(problemsFor(result, c.asset))}`);
    } finally { cleanup(dir); }
  }
});

test('array asset containing non-object entries is rejected with item messages', () => {
  const dir = makeWorkspace();
  try {
    const valid = fixtureRows(996, i => ({
      team_name: 'Kansas City Chiefs', team_abbr: 'KC', division: 'AFC West',
      name: `Player ${i}`, pos: 'QB', unit: 'OFFENSE', ovr: 90, age: 25, jersey: i,
      is_rookie: 'No', acquisition_type: 'veteran'
    }));
    const junk = [null, 'a string', 7, [1, 2]];
    fs.writeFileSync(path.join(dir, 'nfl_rosters_2026.json'),
      JSON.stringify([...junk, ...valid]));
    const result = validate(dir);
    assert.equal(result.ok, false);
    const problems = problemsFor(result, 'rosters');
    for (const i of [0, 1, 2, 3]) {
      assert.ok(problems.some(p => p.includes(`item ${i} must be an object`)),
        `expected item ${i} message, got ${JSON.stringify(problems)}`);
    }
  } finally { cleanup(dir); }
});

test('nested array (schedule.games) with non-object entries is rejected with item messages', () => {
  const dir = makeWorkspace();
  try {
    const games = fixtureRows(270, i => ({
      game_id: `2026-g${i}`, away_team: 'Kansas City Chiefs', home_team: 'Buffalo Bills',
      kickoff_utc: '2026-09-10T00:20:00Z', week: ((i % 18) + 1)
    }));
    games.unshift(null, 'junk string');
    fs.writeFileSync(path.join(dir, 'schedule.json'),
      JSON.stringify({ season: 2026, week: 1, total_weeks: 18, games }));
    const result = validate(dir);
    assert.equal(result.ok, false);
    const problems = problemsFor(result, 'schedule');
    assert.ok(problems.some(p => p.includes('games item 0 must be an object')), JSON.stringify(problems));
    assert.ok(problems.some(p => p.includes('games item 1 must be an object')), JSON.stringify(problems));
  } finally { cleanup(dir); }
});

test('manifest source entry that is not an object is rejected cleanly', () => {
  const dir = makeWorkspace();
  try {
    const mPath = path.join(dir, 'data', 'shared', 'freshness.json');
    const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
    m.sources.props_board = 'not an object';
    fs.writeFileSync(mPath, JSON.stringify(m));
    const result = validate(dir); // must not throw
    assert.equal(result.ok, false);
    assert.ok(problemsFor(result, 'props_board').some(p => /manifest source is not an object/.test(p)));
  } finally { cleanup(dir); }
});

// ── runtime asset contract (Supabase tables + nflverse feed): documented in
//    the inventory, never contacted by the validator. ───────────────────────

test('runtime assets are inventoried with required status, failure behavior, and fallback policy', () => {
  const dir = makeWorkspace();
  try {
    const inventory = JSON.parse(
      fs.readFileSync(path.join(dir, 'scripts', 'data-assets.json'), 'utf8'));
    const runtimes = inventory.assets.filter(a => a.kind === 'runtime');
    assert.deepEqual(
      runtimes.map(a => a.id).sort(),
      ['nflverse_games_feed', 'supabase_nfl_players', 'supabase_nfl_teams', 'supabase_nfl_transactions']);
    for (const a of runtimes) {
      assert.equal(typeof a.required, 'boolean', `${a.id}.required`);
      assert.ok(a.failure_behavior && typeof a.failure_behavior === 'string', `${a.id}.failure_behavior`);
      assert.ok(a.fallback_policy && typeof a.fallback_policy === 'string', `${a.id}.fallback_policy`);
      assert.ok(a.test_fixture && typeof a.test_fixture === 'string', `${a.id}.test_fixture`);
    }
    // And they validate as clean (validator does not touch the network).
    const result = validate(dir);
    assert.equal(result.ok, true, result.problems.join('\n'));
  } finally { cleanup(dir); }
});

test('runtime asset missing failure behavior is a normal validation problem', () => {
  const dir = makeWorkspace();
  try {
    const invPath = path.join(dir, 'scripts', 'data-assets.json');
    const inv = JSON.parse(fs.readFileSync(invPath, 'utf8'));
    delete inv.assets.find(a => a.id === 'supabase_nfl_teams').failure_behavior;
    fs.writeFileSync(invPath, JSON.stringify(inv));
    const result = validate(dir); // must not throw
    assert.equal(result.ok, false);
    assert.ok(result.problems.some(p =>
      /supabase_nfl_teams.*must record "failure_behavior"/.test(p)), result.problems.join('; '));
  } finally { cleanup(dir); }
});

test('CLI exits 0 on a clean workspace and 1 on a broken one', () => {
  const dir = makeWorkspace();
  try {
    const clean = spawnSync(process.execPath,
      [path.join(HERE, 'scripts', 'validate-data.js'), '--root', dir],
      { encoding: 'utf8' });
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);

    fs.writeFileSync(path.join(dir, 'schedule.json'), 'broken{');
    const broken = spawnSync(process.execPath,
      [path.join(HERE, 'scripts', 'validate-data.js'), '--root', dir],
      { encoding: 'utf8' });
    assert.equal(broken.status, 1);
    assert.match(broken.stdout, /FAIL schedule/);
  } finally { cleanup(dir); }
});
