#!/usr/bin/env node
// Rebuild Supabase nfl_players from ESPN's team roster API.
//
// This replaces update_rosters_from_espn.js, which parsed English sentences out
// of the transactions feed and applied them as deltas to a local JSON file the
// site never reads. Two things were wrong with that: the transactions feed only
// carries ~17 rows on cutdown day against ~1,100 real releases, so the deltas
// could never converge on a true roster; and nothing ever wrote the result back
// to Supabase, which is what index.html actually loads.
//
// Here the API states the roster outright. Every athlete carries status.name,
// and "Active" is the 53-man roster. Nothing is inferred from prose.
//
// Usage:
//   node sync_rosters_from_espn_api.js              # dry run, prints the delta
//   node sync_rosters_from_espn_api.js --apply      # replaces nfl_players
//   node sync_rosters_from_espn_api.js --apply --include-practice-squad
const {
  loadMaddenMap, matchMaddenPlayer,
  OFFENSIVE_POS, DEFENSIVE_POS, SPECIAL_POS
} = require('./scripts/madden-overlay.js');

const ESPN_TEAMS_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=40';
const espnRosterUrl = id =>
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${id}?enable=roster`;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nedyoydylpbjvihaoexy.supabase.co/rest/v1/';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_KEY) {
  throw new Error('SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY is required; set it in the environment, not in source.');
}
const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// ESPN spells Washington WSH; nfl_teams uses WAS. Only divergence across all 32.
const ABBR_ALIAS = { WSH: 'WAS' };

// "Active" is exactly the 53-man roster: Arizona returns 53 Active, 16 Practice
// Squad and 10 Day-To-Day, so Day-To-Day sits on top of the 53, not inside it.
const ACTIVE_STATUSES = new Set(['Active']);

function unitFor(pos) {
  const p = (pos || '').toUpperCase();
  if (SPECIAL_POS.includes(p)) return 'SPECIAL';
  if (DEFENSIVE_POS.includes(p)) return 'DEFENSE';
  return 'OFFENSE';
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function fetchEspnRosters(includePracticeSquad) {
  const teams = (await getJson(ESPN_TEAMS_URL)).sports[0].leagues[0].teams.map(t => t.team);
  if (teams.length !== 32) throw new Error(`expected 32 ESPN teams, got ${teams.length}`);

  const out = [];
  for (const t of teams) {
    const team = (await getJson(espnRosterUrl(t.id))).team;
    const athletes = team.athletes || [];
    if (!athletes.length) throw new Error(`${t.displayName}: roster came back empty`);

    const keep = athletes.filter(a => {
      const status = a.status && a.status.name;
      if (ACTIVE_STATUSES.has(status)) return true;
      return includePracticeSquad && status === 'Practice Squad';
    });

    out.push({
      abbr: ABBR_ALIAS[t.abbreviation] || t.abbreviation,
      name: t.displayName,
      players: keep.map(a => ({
        name: a.fullName || a.displayName,
        pos: (a.position && a.position.abbreviation) || 'N/A',
        age: a.age != null ? a.age : null,
        jersey: a.jersey != null && a.jersey !== '' ? Number(a.jersey) : null,
        // ESPN exposes experience.years; 0 means rookie season.
        is_rookie: !!(a.experience && Number(a.experience.years) === 0),
        status: (a.status && a.status.name) || 'Active'
      }))
    });
  }
  return out;
}

// PostgREST caps a page at 1000 rows regardless of the limit you ask for.
async function fetchAllPlayers() {
  const out = [];
  for (let page = 0; ; page++) {
    const chunk = await fetchSupabase(`nfl_players?select=name,ovr,ratings_source&offset=${page * 1000}&limit=1000`);
    out.push(...chunk);
    if (chunk.length < 1000) return out;
  }
}

async function fetchSupabase(pathAndQuery) {
  const res = await fetch(SUPABASE_URL + pathAndQuery, { headers: sbHeaders });
  if (!res.ok) throw new Error(`Supabase GET ${pathAndQuery} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

function buildRows(espnTeams, teamsByAbbr, maddenMap, existingByName) {
  const rows = [];
  const unmatched = [];
  for (const t of espnTeams) {
    const team = teamsByAbbr[t.abbr];
    if (!team) throw new Error(`no nfl_teams row for ESPN abbr ${t.abbr}`);
    for (const p of t.players) {
      const candidate = {
        name: p.name, pos: p.pos, age: p.age, jersey: p.jersey,
        is_rookie: p.is_rookie, unit: unitFor(p.pos)
      };
      const ea = matchMaddenPlayer(maddenMap, candidate, OFFENSIVE_POS, DEFENSIVE_POS, SPECIAL_POS);
      // No Madden entry is normal for depth players. Keep whatever rating the
      // row already carried rather than blanking a column the dashboard sorts on.
      const prior = existingByName.get(p.name);
      if (!ea && !prior) unmatched.push(`${p.name} (${t.abbr} ${p.pos})`);
      rows.push({
        team_id: team.id,
        name: p.name,
        pos: p.pos,
        unit: candidate.unit,
        age: ea && ea.age ? ea.age : p.age,
        jersey: p.jersey,
        is_rookie: p.is_rookie,
        ovr: ea ? ea.ovr : (prior && prior.ovr != null ? prior.ovr : null),
        ratings_source: ea ? 'madden27' : (prior && prior.ratings_source ? prior.ratings_source : 'unrated'),
        acquisition_type: p.is_rookie ? 'draft' : 'veteran'
      });
    }
  }
  return { rows, unmatched };
}

async function replacePlayers(rows) {
  const del = await fetch(SUPABASE_URL + 'nfl_players?id=not.is.null', {
    method: 'DELETE', headers: { ...sbHeaders, Prefer: 'return=minimal' }
  });
  if (!del.ok) throw new Error(`delete failed: ${del.status} ${del.statusText} ${await del.text()}`);

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const ins = await fetch(SUPABASE_URL + 'nfl_players', {
      method: 'POST',
      headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(chunk)
    });
    if (!ins.ok) throw new Error(`insert failed at row ${i}: ${ins.status} ${ins.statusText} ${await ins.text()}`);
    console.log(`  inserted ${Math.min(i + 500, rows.length)}/${rows.length}`);
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const includePracticeSquad = process.argv.includes('--include-practice-squad');

  console.log(`[${new Date().toISOString()}] Fetching 32 team rosters from ESPN...`);
  const espnTeams = await fetchEspnRosters(includePracticeSquad);
  const espnCount = espnTeams.reduce((s, t) => s + t.players.length, 0);
  const sizes = espnTeams.map(t => t.players.length);
  console.log(`  ${espnCount} players, ${Math.min(...sizes)}-${Math.max(...sizes)} per team`);

  const teams = await fetchSupabase('nfl_teams?select=id,name,abbr');
  const teamsByAbbr = Object.fromEntries(teams.map(t => [t.abbr, t]));
  const current = await fetchAllPlayers();

  const existingByName = new Map(current.map(p => [p.name, p]));
  const { rows, unmatched } = buildRows(espnTeams, teamsByAbbr, loadMaddenMap(), existingByName);

  const before = new Set(current.map(p => p.name));
  const after = new Set(rows.map(p => p.name));
  const added = [...after].filter(n => !before.has(n));
  const dropped = [...before].filter(n => !after.has(n));

  console.log(`\nSupabase nfl_players: ${current.length} -> ${rows.length}`);
  console.log(`  ${added.length} added, ${dropped.length} dropped`);
  console.log(`  ${unmatched.length} with no rating from either source (ovr null / ratings_source unrated)`);

  if (!apply) {
    console.log('\nDry run. Nothing written. Re-run with --apply to replace the table.');
    console.log('Sample added:  ' + added.slice(0, 5).join(', '));
    console.log('Sample dropped: ' + dropped.slice(0, 5).join(', '));
    return;
  }

  if (rows.length < 1600) throw new Error(`refusing to apply: only ${rows.length} rows, expected ~1700`);
  console.log('\nReplacing nfl_players...');
  await replacePlayers(rows);
  console.log(`Done. nfl_players now holds ${rows.length} players.`);
}

if (require.main === module) {
  main().catch(e => { console.error('sync_rosters_from_espn_api failed:', e.message); process.exit(1); });
}

module.exports = { unitFor, buildRows, ABBR_ALIAS, ACTIVE_STATUSES };
