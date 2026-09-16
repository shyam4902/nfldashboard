// Hermetic tests for scripts/build_league_data.js.
//
// No network, no live workspace, no Supabase: every input is a fixture under
// the OS tmpdir and every fetch is an injected stub. The fixture teams are
// synthetic on purpose — this test must never encode a real roster or a real
// team assignment, only the arithmetic the artifacts promise.
//
// Covered contracts:
//   * standings: W-L-T (ties counted as half a win), PF/PA/differential,
//     completed-games-only, division grouping, no playoff seeding
//   * statistics: week rows are omitted (not zeroed) for players with no stat
//     line, season totals sum the completed weeks, rates are recomputed
//   * duplicate-free, idempotent rebuilds
//   * a failed upstream fetch leaves the previous validated artifact intact
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const builder = require('./build_league_data.js');

const DIVISIONS = [
  'AFC East', 'AFC North', 'AFC South', 'AFC West',
  'NFC East', 'NFC North', 'NFC South', 'NFC West',
];

// 32 synthetic teams — 4 per division, names and abbrs invented here.
function fixtureRoster() {
  const rows = [];
  DIVISIONS.forEach((division, d) => {
    for (let i = 0; i < 4; i++) {
      rows.push({
        team_name: `${division} Club ${i}`,
        team_abbr: `X${d}${i}`,
        division,
        name: `Player ${d}${i}`,
        pos: 'QB',
        unit: 'OFFENSE',
      });
    }
  });
  return rows;
}

function teamNamed(division, index) {
  return `${division} Club ${index}`;
}

function game(week, home, away, homeScore, awayScore, extra = {}) {
  return {
    game_id: `2026-w${week}-${home}-${away}`,
    week,
    home_team: home,
    away_team: away,
    home_score: homeScore,
    away_score: awayScore,
    status: 'final',
    ...extra,
  };
}

// ── standings ───────────────────────────────────────────────────────────────

test('standings count wins, losses and ties from the scores, never the winner label', () => {
  const roster = fixtureRoster();
  const schedule = {
    season: 2026,
    games: [
      // winner label is wrong on purpose: the scores decide.
      game(1, teamNamed('AFC East', 0), teamNamed('AFC East', 1), 24, 17, { winner: 'TIE' }),
      game(1, teamNamed('AFC East', 2), teamNamed('AFC East', 3), 20, 20, { winner: 'TIE' }),
      // not played yet — must not count
      { game_id: 'future', week: 2, home_team: teamNamed('AFC East', 0), away_team: teamNamed('AFC East', 2) },
    ],
  };
  const out = builder.computeStandings({ schedule, rosterRows: roster, season: 2026 });

  const byName = Object.fromEntries(out.teams.map(t => [t.team, t]));
  const winner = byName[teamNamed('AFC East', 0)];
  assert.deepEqual(
    [winner.wins, winner.losses, winner.ties, winner.played],
    [1, 0, 0, 1],
  );
  assert.equal(winner.points_for, 24);
  assert.equal(winner.points_against, 17);
  assert.equal(winner.differential, 7);
  assert.equal(winner.win_pct, 1);

  const tied = byName[teamNamed('AFC East', 2)];
  assert.deepEqual([tied.wins, tied.losses, tied.ties], [0, 0, 1]);
  assert.equal(tied.win_pct, 0.5, 'a tie is half a win');
  assert.equal(tied.differential, 0);

  assert.equal(out.completed_games, 2);
  assert.equal(out.through_week, 1);
  assert.deepEqual(out.completed_weeks, [1]);
  assert.equal(out.teams.length, 32);
  assert.equal(out.divisions.length, 8);
  for (const d of out.divisions) assert.equal(d.teams.length, 4, d.division);
});

test('standings order divisions by win percentage then differential, and say so', () => {
  const roster = fixtureRoster();
  const schedule = {
    season: 2026,
    games: [
      game(1, teamNamed('AFC East', 0), teamNamed('AFC East', 1), 30, 3),
      game(1, teamNamed('AFC East', 2), teamNamed('AFC East', 3), 21, 20),
    ],
  };
  const out = builder.computeStandings({ schedule, rosterRows: roster, season: 2026 });
  const order = out.divisions.find(d => d.division === 'AFC East').teams.map(t => t.team);
  assert.deepEqual(order.slice(0, 2), [teamNamed('AFC East', 0), teamNamed('AFC East', 2)]);
  assert.ok(/not an official NFL tiebreaker/i.test(out.ordering_note));
  assert.ok(/no playoff seeds/i.test(out.ordering_note));
  assert.equal(out.season_kind, 'actual');
  assert.ok(/Clay projections/i.test(out.projection_note));
});

test('an unplayed team reads 0-0-0 with a null win percentage, not a fabricated rate', () => {
  const out = builder.computeStandings({
    schedule: { season: 2026, games: [] }, rosterRows: fixtureRoster(), season: 2026,
  });
  assert.equal(out.completed_games, 0);
  assert.equal(out.through_week, 0);
  for (const t of out.teams) {
    assert.equal(t.played, 0);
    assert.equal(t.win_pct, null);
  }
});

test('a schedule team that is not in the project catalogue fails the shape gate', () => {
  const schedule = {
    season: 2026,
    games: [game(1, teamNamed('AFC East', 0), 'Invented Team', 10, 7)],
  };
  const out = builder.computeStandings({ schedule, rosterRows: fixtureRoster(), season: 2026 });
  assert.deepEqual(out.unmatched_teams, ['Invented Team']);
  assert.throws(() => builder.assertStandings(out), /unknown teams: Invented Team/);
});

// ── statistics ──────────────────────────────────────────────────────────────

function statFixtures() {
  const index = builder.slimPlayerIndex({
    '111': { full_name: 'Alpha Passer', position: 'QB', team: 'X00' },
    '222': { full_name: 'Bravo Runner', position: 'RB', team: 'X00' },
    '333': { full_name: 'Charlie Catcher', position: 'WR', team: 'X01' },
  });
  const weekly = {
    1: {
      leaders: builder.weekLeaders({
        '111': { gp: 1, pass_att: 30, pass_cmp: 20, pass_yd: 300, pass_td: 2 },
        '222': { gp: 1, rush_att: 15, rush_yd: 80, rush_td: 1 },
        '333': { gp: 1, rec_tgt: 9, rec: 7, rec_yd: 110, rec_td: 1 },
        'TEAM_X00': { gp: 1 },
      }, index),
      teams: { TEAM_X00: { gp: 1, off_yd: 380, pass_yd: 300, rush_yd: 80, td: 3, opp_off_yd: 250 } },
    },
    2: {
      leaders: builder.weekLeaders({
        '111': { gp: 1, pass_att: 20, pass_cmp: 10, pass_yd: 200, pass_int: 1 },
        '222': { gp: 1, rush_att: 10, rush_yd: 40 },
        'TEAM_X00': { gp: 1 },
      }, index),
      teams: { TEAM_X00: { gp: 1, off_yd: 240, pass_yd: 200, rush_yd: 40, td: 1, opp_off_yd: 300 } },
    },
  };
  return { index, weekly };
}

// Every team code the artifact reports must resolve to a catalogue team, and a
// non-empty table must be complete — 32 rows.
function teamBlob(abbr) {
  return { gp: 1, off_yd: 300, pass_yd: 200, rush_yd: 100, td: 2, opp_off_yd: 280 };
}

function fullTeamStats() {
  const teams = {};
  for (const row of fixtureRoster()) teams[`TEAM_${row.team_abbr}`] = teamBlob(row.team_abbr);
  return teams;
}

test('weekly leaders include only players with a stat line, and never duplicate a player', () => {
  const { index, weekly } = statFixtures();
  const week1 = weekly[1].leaders;
  assert.deepEqual(week1.passing.map(r => r.name), ['Alpha Passer']);
  assert.deepEqual(week1.rushing.map(r => r.name), ['Bravo Runner']);
  assert.deepEqual(week1.receiving.map(r => r.name), ['Charlie Catcher']);
  assert.equal(week1.passing[0].pass_cmp_pct, 66.7, 'completion rate is derived from the counts');

  // No receiving line in week 2 means the player is absent from week 2, not
  // present with zeros.
  assert.deepEqual(weekly[2].leaders.receiving, []);
  for (const rows of Object.values(week1)) {
    assert.equal(new Set(rows.map(r => r.player_id)).size, rows.length);
  }
});

test('season-to-date sums the completed weeks and recomputes rates', () => {
  const { index, weekly } = statFixtures();
  const weeks = { '1': weekly[1].leaders, '2': weekly[2].leaders };
  const season = builder.seasonToDate(weeks, index);
  const passer = season.passing[0];
  assert.equal(passer.pass_yd, 500);
  assert.equal(passer.pass_td, 2);
  assert.equal(passer.pass_int, 1);
  assert.equal(passer.pass_cmp, 30);
  assert.equal(passer.pass_att, 50);
  assert.equal(passer.pass_cmp_pct, 60);
  assert.equal(passer.games, 2);
  const runner = season.rushing[0];
  assert.equal(runner.rush_yd, 120);
  assert.equal(runner.rush_avg, 4.8);
});

test('the stats artifact keeps unfinished weeks out and records its own coverage', () => {
  const { index, weekly } = statFixtures();
  weekly[1].teams = fullTeamStats();
  weekly[2].teams = fullTeamStats();
  const standings = builder.computeStandings({
    schedule: {
      season: 2026,
      games: [game(1, teamNamed('AFC East', 0), teamNamed('AFC East', 1), 21, 0)],
    },
    rosterRows: fixtureRoster(),
    season: 2026,
  });
  const artifact = builder.buildStatsArtifact({
    weekly,
    index,
    standings,
    rosterRows: fixtureRoster(),
    season: 2026,
    currentWeek: 3,
    completedWeeks: [1, 2],
    generatedAt: '2026-09-16T09:00:00Z',
  });
  builder.assertStats(artifact);
  assert.deepEqual(artifact.completed_weeks, [1, 2]);
  assert.deepEqual(Object.keys(artifact.weeks), ['1', '2']);
  assert.equal(artifact.weeks['3'], undefined, 'an unfinished week is absent, not zeroed');
  assert.equal(artifact.season_kind, 'actual');
  assert.equal(artifact.team_totals.length, 32);
  assert.match(artifact.coverage_note, /omitted/);
  assert.match(artifact.null_handling, /omitted/);
  const x00 = artifact.team_totals.find(t => t.abbr === 'X00');
  assert.equal(x00.pass_yards, 400, 'team totals sum the completed weeks');
  assert.equal(x00.rush_yards, 200);
  assert.equal(x00.total_yards, x00.pass_yards + x00.rush_yards);
});

test('a partial or unknown team-coded stats response fails the shape gate', () => {
  const { index, weekly } = statFixtures();
  const standings = builder.computeStandings({
    schedule: { season: 2026, games: [] }, rosterRows: fixtureRoster(), season: 2026,
  });
  const build = (teams) => builder.buildStatsArtifact({
    weekly: { 1: { leaders: weekly[1].leaders, teams } },
    index,
    standings,
    rosterRows: fixtureRoster(),
    season: 2026,
    currentWeek: 2,
    completedWeeks: [1],
  });
  // a partial team table is refused rather than published incomplete
  assert.throws(() => builder.assertStats(build({ TEAM_X00: teamBlob('X00') })),
    /team_totals has 1 teams, expected 32 or none/);

  // a repeated team row is refused
  const duplicated = build(fullTeamStats());
  duplicated.team_totals.push({ ...duplicated.team_totals[0] });
  duplicated.team_totals.sort((a, b) => a.abbr.localeCompare(b.abbr));
  assert.throws(() => builder.assertStats(duplicated), /duplicate team abbr/);
});

test('an unrecognised upstream team code fails instead of silently dropping a team', () => {
  const { index, weekly } = statFixtures();
  const standings = builder.computeStandings({
    schedule: { season: 2026, games: [] }, rosterRows: fixtureRoster(), season: 2026,
  });
  const teams = fullTeamStats();
  delete teams.TEAM_X00;
  teams.TEAM_ZZZ = teamBlob('ZZZ');
  const artifact = builder.buildStatsArtifact({
    weekly: { 1: { leaders: weekly[1].leaders, teams } },
    index,
    standings,
    rosterRows: fixtureRoster(),
    season: 2026,
    currentWeek: 2,
    completedWeeks: [1],
  });
  assert.deepEqual(artifact.unmatched_team_codes, ['ZZZ']);
  assert.throws(() => builder.assertStats(artifact), /unknown Sleeper team codes: ZZZ/);
});

// ── end-to-end build + last-good behaviour ──────────────────────────────────

function makeRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'league-data-'));
  fs.mkdirSync(path.join(dir, 'data', 'shared'), { recursive: true });
  const roster = fixtureRoster();
  const games = [game(1, teamNamed('AFC East', 0), teamNamed('AFC East', 1), 24, 17)];
  fs.writeFileSync(path.join(dir, 'schedule.json'),
    JSON.stringify({ season: 2026, week: 2, total_weeks: 18, games }));
  fs.writeFileSync(path.join(dir, 'nfl_rosters_2026.json'), JSON.stringify(roster));
  return dir;
}

// A stub cache of the real feed shape: one catalog entry per fixture team (so
// the 32-row team-totals gate is exercised) plus the named skill players.
function stubCatalog() {
  const catalog = { '111': { full_name: 'Alpha Passer', position: 'QB', team: 'X00' } };
  fixtureRoster().forEach((row, i) => {
    catalog[String(9000 + i)] = { full_name: row.name, position: 'QB', team: row.team_abbr };
  });
  return catalog;
}

function stubFetch(rawWeeks) {
  const catalog = stubCatalog();
  const index = builder.slimPlayerIndex(catalog);
  const full = {};
  for (const team of new Set([...index.values()].map(p => p.team))) {
    full[`TEAM_${team}`] = teamBlob(team);
  }
  return async (url) => {
    const body = url.includes('/state/nfl') ? { season: '2026', week: 3, season_type: 'regular' }
      : url.includes('/players/nfl') ? catalog
      : url.includes('/stats/nfl/regular/2026/1') ? { ...rawWeeks[1], ...full }
      : url.includes('/stats/nfl/regular/2026/2') ? { ...rawWeeks[2], ...full }
      : {};
    return { ok: true, status: 200, json: async () => body };
  };
}

test('a full build writes both artifacts and a rerun is byte-identical apart from its timestamp', async () => {
  const root = makeRoot();
  try {
    const rawWeeks = {
      1: { '111': { gp: 1, pass_att: 30, pass_cmp: 20, pass_yd: 300, pass_td: 2 } },
      2: { '111': { gp: 1, pass_att: 20, pass_cmp: 10, pass_yd: 200, pass_int: 1 } },
    };
    const artifacts = await builder.build({ root, season: 2026, fetchImpl: stubFetch(rawWeeks) });
    builder.writeArtifacts(root, 2026, artifacts);
    const paths = builder.artifactPaths(root, 2026);
    const first = fs.readFileSync(paths.standings, 'utf8');
    const firstStats = JSON.parse(fs.readFileSync(paths.stats, 'utf8'));
    assert.equal(JSON.parse(first).completed_games, 1);
    assert.deepEqual(firstStats.completed_weeks, [1, 2]);
    assert.deepEqual(firstStats.season_to_date.passing.map(r => [r.name, r.pass_yd]), [['Alpha Passer', 500]]);
    // the data/shared copy is byte-identical to the canonical root file
    assert.equal(fs.readFileSync(paths.standingsShared, 'utf8'), first);
    assert.equal(fs.readFileSync(paths.statsShared, 'utf8'), fs.readFileSync(paths.stats, 'utf8'));

    const again = await builder.build({ root, season: 2026, fetchImpl: stubFetch(rawWeeks) });
    builder.writeArtifacts(root, 2026, again);
    const secondStats = JSON.parse(fs.readFileSync(paths.stats, 'utf8'));
    secondStats.generated_at = firstStats.generated_at;
    const comparable = { ...firstStats, generated_at: null };
    assert.deepEqual({ ...secondStats, generated_at: null }, comparable,
      'a rerun must not accumulate rows or reorder leaders');
    assert.equal(new Set(secondStats.season_to_date.passing.map(r => r.player_id)).size,
      secondStats.season_to_date.passing.length);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an upstream failure keeps the last good artifacts untouched', async () => {
  const root = makeRoot();
  try {
    const good = await builder.build({
      root, season: 2026,
      fetchImpl: stubFetch({ 1: { '111': { gp: 1, pass_att: 30, pass_yd: 300 } }, 2: {} }),
    });
    builder.writeArtifacts(root, 2026, good);
    const paths = builder.artifactPaths(root, 2026);
    const before = fs.readFileSync(paths.stats, 'utf8');

    await assert.rejects(
      builder.build({ root, season: 2026, fetchImpl: async () => { throw new Error('upstream down'); } }),
      /upstream down/,
    );
    assert.equal(fs.readFileSync(paths.stats, 'utf8'), before,
      'a failed build must leave the published artifact exactly as it was');
    assert.deepEqual(
      fs.readdirSync(path.join(root, 'data', 'shared')).filter(f => f.includes('.tmp')),
      [], 'no temp files may be left behind',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
