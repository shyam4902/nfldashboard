#!/usr/bin/env node
// Build the dashboard's actual-results artifacts: real NFL standings and
// current-season player/team statistics.
//
// Two artifacts, both tracked deploy assets:
//   nfl_standings_2026.json  — 32 teams grouped by conference/division, built
//                              from completed regular-season games already in
//                              schedule.json (the score workflow's output).
//   nfl_stats_2026.json      — weekly + season-to-date passing/rushing/
//                              receiving leaders and team offense/defense
//                              totals, from the free Sleeper stats API.
//
// Design rules this file follows:
//   * The project's own data is the source of truth. Standings come from
//     schedule.json results, never from model knowledge; divisions come from
//     the committed roster snapshot, not a hardcoded table.
//   * Actual results only. Nothing here is a projection; the artifact says so
//     in its own metadata so the UI cannot blur the two.
//   * Missing data is not zero. A week that has not finished is omitted from
//     the artifact entirely; a player with no stat line for a week is omitted
//     from that week's leaders rather than listed with zeros.
//   * A build either produces a complete, validated artifact or writes
//     nothing — the last good file survives any upstream failure.
//
// Usage:
//   node scripts/build_league_data.js [--root <dir>] [--season 2026]
//        [--weeks 1,2] [--dry-run] [--no-network]
//
// --weeks is an explicit override for tests/backfill; otherwise completed
// weeks are derived from the Sleeper season state.
'use strict';

const fs = require('fs');
const path = require('path');
const { atomicWriteFileSync } = require('./atomic-write.js');

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const LEADER_LIMIT_WEEK = 25;
const LEADER_LIMIT_SEASON = 50;
const DEFAULT_SEASON = 2026;
const MAX_WEEKS = 18;

const CONFERENCE_ORDER = ['AFC', 'NFC'];
const DIVISION_ORDER = [
  'AFC East', 'AFC North', 'AFC South', 'AFC West',
  'NFC East', 'NFC North', 'NFC South', 'NFC West',
];

// ── helpers ─────────────────────────────────────────────────────────────────

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

// Sleeper omits zero-valued keys, so an absent key inside an existing player
// row means zero production, not missing data. Missing data is the absence of
// the row itself, handled by the callers' filters.
function n(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ── standings ───────────────────────────────────────────────────────────────

// Division/conference catalogue from the committed roster snapshot: one row
// per team, so the 32-team set and its alignment come from project data.
function teamCatalog(rosterRows) {
  const byName = new Map();
  const byAbbr = new Map();
  for (const row of rosterRows || []) {
    const name = row.team_name;
    const abbr = row.team_abbr;
    if (!name || !abbr || byName.has(name)) continue;
    const entry = { team: name, abbr, division: row.division || null };
    byName.set(name, entry);
    if (!byAbbr.has(abbr)) byAbbr.set(abbr, entry);
  }
  return { byName, byAbbr };
}

// A game counts only when it is a completed regular-season result carrying
// both scores. status === 'final' is what sync_scores.js writes; the score
// comparison is the tie test (never the winner label alone).
function isCompleted(game) {
  return game
    && game.status === 'final'
    && Number.isFinite(Number(game.home_score))
    && Number.isFinite(Number(game.away_score));
}

function computeStandings({ schedule, rosterRows, season = DEFAULT_SEASON, generatedAt = utcNow() } = {}) {
  const games = (schedule && Array.isArray(schedule.games)) ? schedule.games : [];
  const { byName, byAbbr } = teamCatalog(rosterRows);
  if (byName.size !== 32) {
    throw new Error(`standings: roster snapshot yielded ${byName.size} teams, expected 32`);
  }

  const blank = () => ({
    wins: 0, losses: 0, ties: 0, played: 0, points_for: 0, points_against: 0,
  });
  const records = new Map();
  for (const name of byName.keys()) records.set(name, blank());

  const unmatched = new Set();
  const completedGames = [];
  const weeksWithResults = new Set();

  for (const game of games) {
    // schedule.json carries the season at the top level; a per-game season, when
    // present, is honoured so a mixed-season file cannot leak in.
    const gameSeason = game.season === undefined || game.season === null ? schedule.season : game.season;
    if (Number(gameSeason) !== Number(season)) continue;
    if (!isCompleted(game)) continue;
    const home = resolve(game.home_team);
    const away = resolve(game.away_team);
    if (!home || !away) {
      if (!home) unmatched.add(game.home_team);
      if (!away) unmatched.add(game.away_team);
      continue;
    }
    const homeScore = Number(game.home_score);
    const awayScore = Number(game.away_score);
    completedGames.push(game.game_id || `${away}@${home}`);
    if (Number.isFinite(Number(game.week))) weeksWithResults.add(Number(game.week));

    apply(home, homeScore, awayScore);
    apply(away, awayScore, homeScore);
  }

  function resolve(teamName) {
    if (!teamName) return null;
    if (byName.has(teamName)) return teamName;
    // Defensive: a schedule producer using an abbreviation instead of the
    // full name still resolves through the same project catalogue.
    const hit = byAbbr.get(teamName);
    return hit ? hit.team : null;
  }

  function apply(team, scored, allowed) {
    const rec = records.get(team);
    if (!rec) return;
    rec.played += 1;
    rec.points_for += scored;
    rec.points_against += allowed;
    if (scored > allowed) rec.wins += 1;
    else if (scored < allowed) rec.losses += 1;
    else rec.ties += 1;
  }

  const teams = [...records.entries()].map(([team, rec]) => {
    const info = byName.get(team);
    return {
      team,
      abbr: info.abbr,
      division: info.division,
      conference: String(info.division || '').split(' ')[0] || null,
      wins: rec.wins,
      losses: rec.losses,
      ties: rec.ties,
      played: rec.played,
      // NFL formula: a tie counts as half a win.
      win_pct: rec.played ? round((rec.wins + 0.5 * rec.ties) / rec.played) : null,
      points_for: rec.points_for,
      points_against: rec.points_against,
      differential: rec.points_for - rec.points_against,
      source: 'actual',
    };
  });

  const sortDivision = (a, b) => {
    const pctA = a.win_pct === null ? -1 : a.win_pct;
    const pctB = b.win_pct === null ? -1 : b.win_pct;
    if (pctA !== pctB) return pctB - pctA;
    if (a.differential !== b.differential) return b.differential - a.differential;
    return a.team.localeCompare(b.team);
  };

  const divisions = DIVISION_ORDER.map((division) => ({
    conference: division.split(' ')[0],
    division,
    teams: teams.filter((t) => t.division === division).sort(sortDivision),
  })).filter((d) => d.teams.length);

  return {
    artifact: 'nfl_standings',
    season: Number(season),
    generated_at: generatedAt,
    through_week: weeksWithResults.size ? Math.max(...weeksWithResults) : 0,
    completed_games: completedGames.length,
    completed_weeks: [...weeksWithResults].sort((a, b) => a - b),
    source: 'schedule.json completed regular-season results (final scores synced from ESPN by the score workflow)',
    source_of_teams: 'nfl_rosters_2026.json team/division catalogue',
    season_kind: 'actual',
    ordering_note: 'Divisions are ordered by win percentage, then point differential. That is a display order, not an official NFL tiebreaker, and no playoff seeds are implied.',
    projection_note: 'Actual results only. Clay projections live on the Projections tab and are a separate model, never blended in here.',
    null_handling: 'An unplayed team shows 0-0-0 with a null win percentage rather than a fabricated rate.',
    unmatched_teams: [...unmatched].sort(),
    divisions,
    teams: teams.sort((a, b) => a.team.localeCompare(b.team)),
  };
}

// ── statistics ──────────────────────────────────────────────────────────────

// The Sleeper player catalogue is a ~14 MB map; keep a local copy so a daily
// run does not re-download it more than once a day.
function readPlayerIndexCache(cacheFile, maxAgeMs) {
  try {
    const stat = fs.statSync(cacheFile);
    if (Date.now() - stat.mtimeMs > maxAgeMs) return null;
    return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch {
    return null;
  }
}

function writePlayerIndexCache(cacheFile, data) {
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    atomicWriteFileSync(cacheFile, JSON.stringify(data));
  } catch { /* a cache miss only costs a re-download */ }
}

async function fetchJson(url, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': 'nfldashboard/1.0 (+league-data)' },
    signal: AbortSignal.timeout(45000),
  });
  if (!res || !res.ok) throw new Error(`${url}: HTTP ${res ? res.status : 'no response'}`);
  return res.json();
}

// id -> { name, pos, team } for every NFL player in the Sleeper catalogue.
function slimPlayerIndex(catalog) {
  const index = new Map();
  for (const [id, p] of Object.entries(catalog || {})) {
    if (!p || typeof p !== 'object') continue;
    if (!/^(QB|RB|WR|TE|FB|K)$/.test(String(p.position || ''))) continue;
    const name = p.full_name
      || [p.first_name, p.last_name].filter(Boolean).join(' ');
    if (!name) continue;
    index.set(String(id), {
      name,
      pos: p.position || null,
      team: p.team || null,
    });
  }
  return index;
}

function playerRow(id, index, values, sortKey) {
  const meta = index.get(String(id)) || {};
  return {
    player_id: String(id),
    name: meta.name || null,
    pos: meta.pos || null,
    team: meta.team || null,
    ...values,
    _sort: n(values[sortKey]),
  };
}

function stripSort(rows) {
  return rows.map(({ _sort, ...rest }) => rest);
}

// One week's leaders for the three skill categories.
function weekLeaders(weekStats, index) {
  const entries = Object.entries(weekStats || {}).filter(([id]) => !id.startsWith('TEAM_'));
  const passing = [];
  const rushing = [];
  const receiving = [];
  for (const [id, v] of entries) {
    if (!v || typeof v !== 'object') continue;
    const games = n(v.gp) || 1;
    if (n(v.pass_att) > 0) {
      passing.push(playerRow(id, index, {
        games,
        pass_yd: n(v.pass_yd),
        pass_td: n(v.pass_td),
        pass_int: n(v.pass_int),
        pass_cmp: n(v.pass_cmp),
        pass_att: n(v.pass_att),
        pass_cmp_pct: n(v.pass_att) ? round((n(v.pass_cmp) / n(v.pass_att)) * 100, 1) : null,
      }, 'pass_yd'));
    }
    if (n(v.rush_att) > 0) {
      rushing.push(playerRow(id, index, {
        games,
        rush_yd: n(v.rush_yd),
        rush_td: n(v.rush_td),
        rush_att: n(v.rush_att),
        rush_avg: n(v.rush_att) ? round(n(v.rush_yd) / n(v.rush_att), 1) : null,
      }, 'rush_yd'));
    }
    if (n(v.rec_tgt) > 0 || n(v.rec) > 0) {
      receiving.push(playerRow(id, index, {
        games,
        rec_yd: n(v.rec_yd),
        rec_td: n(v.rec_td),
        rec: n(v.rec),
        rec_tgt: n(v.rec_tgt),
      }, 'rec_yd'));
    }
  }
  const top = (rows, limit) => stripSort(
    rows.sort((a, b) => b._sort - a._sort || String(a.player_id).localeCompare(String(b.player_id)))
      .slice(0, limit),
  );
  return {
    passing: top(passing, LEADER_LIMIT_WEEK),
    rushing: top(rushing, LEADER_LIMIT_WEEK),
    receiving: top(receiving, LEADER_LIMIT_WEEK),
  };
}

// Sum each player's weeks into season-to-date totals. A player with no stat
// line in a week is absent for that week — never counted as a zero game.
function seasonToDate(weekly, index) {
  const acc = new Map();
  for (const [week, stats] of Object.entries(weekly)) {
    for (const [category, rows] of Object.entries(stats)) {
      for (const row of rows) {
        let entry = acc.get(row.player_id);
        if (!entry) {
          entry = { player_id: row.player_id, name: row.name, pos: row.pos, team: row.team, weeks: [], categories: new Set() };
          acc.set(row.player_id, entry);
        }
        entry.categories.add(category);
        entry.weeks.push(Number(week));
        if (row.team) entry.team = row.team;
        for (const [key, value] of Object.entries(row)) {
          if (key === 'player_id' || key === 'name' || key === 'pos' || key === 'team') continue;
          if (key === 'games') { entry.games = n(entry.games) + n(value); continue; }
          if (key.endsWith('_pct') || key === 'rush_avg') continue; // rates are recomputed below
          entry[key] = n(entry[key]) + n(value);
        }
      }
    }
  }
  const list = [...acc.values()].map((entry) => {
    const row = {
      player_id: entry.player_id,
      name: entry.name,
      pos: entry.pos,
      team: entry.team,
    };
    for (const [key, value] of Object.entries(entry)) {
      if (['player_id', 'name', 'pos', 'team', 'weeks', 'categories'].includes(key)) continue;
      row[key] = value;
    }
    row.games = n(entry.games);
    if (row.pass_att) row.pass_cmp_pct = round((n(row.pass_cmp) / n(row.pass_att)) * 100, 1);
    if (row.rush_att) row.rush_avg = round(n(row.rush_yd) / n(row.rush_att), 1);
    return row;
  });
  const byCategory = (category, key) => list
    .filter((row) => row[key] > 0)
    .sort((a, b) => b[key] - a[key] || String(a.player_id).localeCompare(String(b.player_id)))
    .slice(0, LEADER_LIMIT_SEASON);
  return {
    passing: byCategory('passing', 'pass_yd'),
    rushing: byCategory('rushing', 'rush_yd'),
    receiving: byCategory('receiving', 'rec_yd'),
  };
}

// Team offense/defense totals. Yards come from Sleeper's team-level weekly
// aggregates; points come from the actual completed-game results.
function teamTotals({ weekly, standings, rosterRows }) {
  const catalog = teamCatalog(rosterRows);
  const byAbbr = new Map();
  for (const [week, stats] of Object.entries(weekly)) {
    for (const [id, v] of Object.entries(stats.teams || {})) {
      const abbr = id.replace(/^TEAM_/, '');
      let entry = byAbbr.get(abbr);
      if (!entry) {
        entry = {
          off_yd: 0, pass_yd: 0, rush_yd: 0, td: 0, opp_off_yd: 0, games: 0,
          _weeks: [],
        };
        byAbbr.set(abbr, entry);
      }
      entry.off_yd += n(v.off_yd);
      entry.pass_yd += n(v.pass_yd);
      entry.rush_yd += n(v.rush_yd);
      entry.td += n(v.td);
      entry.opp_off_yd += n(v.opp_off_yd);
      entry.games += n(v.gp) || 1;
      entry._weeks.push(Number(week));
    }
  }
  const standingByName = new Map((standings.teams || []).map((t) => [t.team, t]));
  const rows = [];
  const unmatched = [];
  for (const [abbr, entry] of byAbbr.entries()) {
    const info = catalog.byAbbr.get(abbr);
    if (!info) { unmatched.push(abbr); continue; }
    const rec = standingByName.get(info.team) || {};
    rows.push({
      team: info.team,
      abbr: info.abbr,
      division: info.division,
      games: entry.games,
      pass_yards: entry.pass_yd,
      rush_yards: entry.rush_yd,
      total_yards: entry.pass_yd + entry.rush_yd,
      offensive_tds: entry.td,
      points_for: n(rec.points_for),
      points_against: n(rec.points_against),
      yards_allowed: entry.opp_off_yd,
      differential: n(rec.differential),
    });
  }
  rows.sort((a, b) => b.points_for - a.points_for || a.team.localeCompare(b.team));
  return { rows, unmatched };
}

// ── assembly ────────────────────────────────────────────────────────────────

function buildStatsArtifact({
  weekly, index, standings, rosterRows, season, currentWeek, completedWeeks, generatedAt = utcNow(),
}) {
  const weeks = {};
  for (const week of completedWeeks) {
    const stats = weekly[week];
    if (!stats) continue;
    weeks[String(week)] = {
      passing: stats.leaders.passing,
      rushing: stats.leaders.rushing,
      receiving: stats.leaders.receiving,
    };
  }
  const totals = teamTotals({ weekly, standings, rosterRows });
  return {
    artifact: 'nfl_stats',
    season: Number(season),
    generated_at: generatedAt,
    source: 'Sleeper weekly stats API (api.sleeper.app/v1/stats/nfl/regular) — free, no key; names and team from the Sleeper player catalogue',
    source_of_points: 'schedule.json completed regular-season results',
    season_kind: 'actual',
    current_week: Number(currentWeek),
    completed_weeks: completedWeeks,
    coverage_note: 'Only weeks that have finished are included. An unfinished week is omitted, never rendered as zeros.',
    null_handling: 'A player with no stat line in a week is omitted from that week entirely; inside a present row, absent counting stats are zero.',
    source_vintage_note: 'Sleeper stats reflect its own ingestion; the weekly file is not amended after the fact, and the generated_at below is when this artifact was assembled.',
    season_to_date: seasonToDate(weeks, index),
    weeks,
    team_totals: totals.rows,
    unmatched_team_codes: totals.unmatched.sort(),
  };
}

// Shape gate: an artifact is written only when it is complete and internally
// consistent, so a partial upstream response can never replace a good file.
function assertStandings(artifact) {
  if (artifact.teams.length !== 32) throw new Error(`standings: ${artifact.teams.length} teams, expected 32`);
  if (artifact.divisions.length !== 8) throw new Error(`standings: ${artifact.divisions.length} divisions, expected 8`);
  for (const d of artifact.divisions) {
    if (d.teams.length !== 4) throw new Error(`standings: ${d.division} has ${d.teams.length} teams, expected 4`);
  }
  for (const t of artifact.teams) {
    for (const key of ['wins', 'losses', 'ties', 'played', 'points_for', 'points_against', 'differential']) {
      if (!Number.isFinite(t[key])) throw new Error(`standings: ${t.team} has non-numeric ${key}`);
    }
    if (t.wins + t.losses + t.ties !== t.played) {
      throw new Error(`standings: ${t.team} record ${t.wins}-${t.losses}-${t.ties} != ${t.played} played`);
    }
  }
  if (artifact.unmatched_teams.length) {
    throw new Error(`standings: schedule references unknown teams: ${artifact.unmatched_teams.join(', ')}`);
  }
}

function assertStats(artifact) {
  for (const [week, cats] of Object.entries(artifact.weeks)) {
    for (const [category, rows] of Object.entries(cats)) {
      const ids = new Set();
      for (const row of rows) {
        if (ids.has(row.player_id)) throw new Error(`stats: week ${week} ${category} duplicate ${row.player_id}`);
        ids.add(row.player_id);
        if (!row.name) throw new Error(`stats: week ${week} ${category} row ${row.player_id} has no name`);
      }
    }
  }
  // Diagnose the most specific failure first: an unrecognised team code both
  // drops a team and adds a phantom, so report it before the row count.
  if (artifact.unmatched_team_codes.length) {
    throw new Error(`stats: unknown Sleeper team codes: ${artifact.unmatched_team_codes.join(', ')}`);
  }
  const abbrs = new Set(artifact.team_totals.map((t) => t.abbr));
  if (abbrs.size !== artifact.team_totals.length) throw new Error('stats: duplicate team abbr in team_totals');
  if (artifact.team_totals.length && artifact.team_totals.length !== 32) {
    throw new Error(`stats: team_totals has ${artifact.team_totals.length} teams, expected 32 or none`);
  }
  for (const t of artifact.team_totals) {
    if (t.total_yards !== t.pass_yards + t.rush_yards) {
      throw new Error(`stats: ${t.team} total_yards != pass + rush`);
    }
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(args) {
  const opts = { root: path.join(__dirname, '..'), season: DEFAULT_SEASON, weeks: null, dryRun: false, noNetwork: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--root') opts.root = path.resolve(args[++i]);
    else if (arg === '--season') opts.season = Number(args[++i]);
    else if (arg === '--weeks') opts.weeks = String(args[++i]).split(',').map(Number).filter(Number.isFinite);
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--no-network') opts.noNetwork = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

function artifactPaths(root, season) {
  const file = `nfl_standings_${season}.json`;
  const statsFile = `nfl_stats_${season}.json`;
  return {
    standings: path.join(root, file),
    standingsShared: path.join(root, 'data', 'shared', file),
    stats: path.join(root, statsFile),
    statsShared: path.join(root, 'data', 'shared', statsFile),
  };
}

async function build({ root, season, weeks, fetchImpl = fetch, cacheDir = null } = {}) {
  const schedule = JSON.parse(fs.readFileSync(path.join(root, 'schedule.json'), 'utf8'));
  const rosterRows = JSON.parse(fs.readFileSync(path.join(root, 'nfl_rosters_2026.json'), 'utf8'));

  const generatedAt = utcNow();
  const standings = computeStandings({ schedule, rosterRows, season, generatedAt });
  assertStandings(standings);

  const state = await fetchJson(`${SLEEPER_BASE}/state/nfl`, fetchImpl);
  const currentWeek = Number(state.week) || 0;
  const completedWeeks = (weeks && weeks.length
    ? weeks
    : Array.from({ length: Math.max(currentWeek - 1, 0) }, (_, i) => i + 1))
    .filter((w) => w >= 1 && w <= MAX_WEEKS)
    .sort((a, b) => a - b);

  const cacheFile = cacheDir
    ? path.join(cacheDir, `sleeper-players-${season}.json`)
    : null;
  let catalog = cacheFile ? readPlayerIndexCache(cacheFile, 24 * 3600 * 1000) : null;
  if (!catalog) {
    catalog = await fetchJson(`${SLEEPER_BASE}/players/nfl`, fetchImpl);
    if (cacheFile) writePlayerIndexCache(cacheFile, catalog);
  }
  const index = slimPlayerIndex(catalog);

  const weekly = {};
  for (const week of completedWeeks) {
    const raw = await fetchJson(`${SLEEPER_BASE}/stats/nfl/regular/${season}/${week}`, fetchImpl);
    const stats = {};
    for (const [id, v] of Object.entries(raw || {})) {
      if (id.startsWith('TEAM_')) stats[id] = v;
    }
    weekly[week] = {
      leaders: weekLeaders(raw, index),
      teams: stats,
    };
  }

  const stats = buildStatsArtifact({
    weekly, index, standings, rosterRows, season, currentWeek, completedWeeks, generatedAt,
  });
  assertStats(stats);
  return { standings, stats };
}

function writeArtifacts(root, season, artifacts) {
  const paths = artifactPaths(root, season);
  fs.mkdirSync(path.dirname(paths.standingsShared), { recursive: true });
  const payload = (obj) => JSON.stringify(obj, null, 2) + '\n';
  if (artifacts.standings) {
    const standingsJson = payload(artifacts.standings);
    for (const file of [paths.standings, paths.standingsShared]) atomicWriteFileSync(file, standingsJson);
  }
  if (artifacts.stats) {
    const statsJson = payload(artifacts.stats);
    for (const file of [paths.stats, paths.statsShared]) atomicWriteFileSync(file, statsJson);
  }
  return paths;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.noNetwork) {
    const schedule = JSON.parse(fs.readFileSync(path.join(opts.root, 'schedule.json'), 'utf8'));
    const rosterRows = JSON.parse(fs.readFileSync(path.join(opts.root, 'nfl_rosters_2026.json'), 'utf8'));
    const standings = computeStandings({ schedule, rosterRows, season: opts.season });
    assertStandings(standings);
    console.log(`standings only: ${standings.teams.length} teams, ${standings.completed_games} completed games, through week ${standings.through_week}`);
    if (!opts.dryRun) writeArtifacts(opts.root, opts.season, { standings, stats: null });
    return;
  }
  const cacheDir = process.env.LEAGUE_CACHE_DIR
    || path.join(process.env.HOME || '.', 'Library', 'Application Support', 'nfldashboard-publish', 'cache');
  const artifacts = await build({ root: opts.root, season: opts.season, weeks: opts.weeks, cacheDir });
  console.log(`standings: ${artifacts.standings.completed_games} completed games, through week ${artifacts.standings.through_week}`);
  console.log(`stats: completed weeks [${artifacts.stats.completed_weeks.join(', ')}], ${artifacts.stats.team_totals.length} team totals`);
  if (opts.dryRun) {
    console.log('--dry-run: nothing written');
    return;
  }
  const paths = writeArtifacts(opts.root, opts.season, artifacts);
  console.log(`wrote ${paths.standings}`);
  console.log(`wrote ${paths.stats}`);
}

module.exports = {
  computeStandings,
  buildStatsArtifact,
  seasonToDate,
  weekLeaders,
  teamTotals,
  slimPlayerIndex,
  assertStandings,
  assertStats,
  artifactPaths,
  stripSort,
  build,
  writeArtifacts,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`build_league_data: ${err.message}`);
    process.exit(1);
  });
}
