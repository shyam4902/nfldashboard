#!/usr/bin/env node
// Sync nfl_rosters_2026.json from the live Supabase roster source.
// Fetches teams and players, applies the local Madden rating overlay, and
// writes only the JSON artifact consumed by the app.
//
// Purpose: propagate the current Supabase roster snapshot into the dashboard
// without re-deriving it from a stale local artifact.
//
// Usage: node sync_supabase_rosters.js        (writes nfl_rosters_2026.json)
const fs = require('fs');
const path = require('path');
const { atomicWriteFileSync } = require('./scripts/atomic-write.js');

const SUPABASE_URL = process.env.SUPABASE_URL || "https://nedyoydylpbjvihaoexy.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY is required; set it in the environment, not in source.');
}
const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`
};

const { loadMaddenMap, matchMaddenPlayer, OFFENSIVE_POS, DEFENSIVE_POS, SPECIAL_POS } = require('./scripts/madden-overlay.js');

async function main() {
  console.log('sync_supabase_rosters: fetching teams...');
  const teamsRes = await fetch(SUPABASE_URL + 'nfl_teams?select=*', { headers });
  if (!teamsRes.ok) throw new Error(`teams request failed: ${teamsRes.status} ${teamsRes.statusText}`);
  const teams = await teamsRes.json();
  console.log(`  ${teams.length} teams`);

  console.log('sync_supabase_rosters: fetching players...');
  let players = [];
  let page = 0;
  while (true) {
    const res = await fetch(SUPABASE_URL + `nfl_players?select=*&offset=${page * 1000}&limit=1000`, { headers });
    if (!res.ok) throw new Error(`players request failed: ${res.status} ${res.statusText}`);
    const chunk = await res.json();
    players = players.concat(chunk);
    if (chunk.length < 1000) break;
    page++;
  }
  console.log(`  ${players.length} players`);

  const data = { teams, players };

  const maddenMap = loadMaddenMap();
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));

  const processed = data.players.map(p => {
    const team = teamById[p.team_id] || { name: 'Free Agent', abbr: 'FA', division: 'N/A' };
    const ea = matchMaddenPlayer(maddenMap, p, OFFENSIVE_POS, DEFENSIVE_POS, SPECIAL_POS);
    return {
      team_name: team.name,
      team_abbr: team.abbr,
      division: team.division || 'N/A',
      name: p.name,
      pos: p.pos || 'N/A',
      unit: (p.unit || 'offense').toUpperCase(),
      ovr: ea ? ea.ovr : (p.ovr != null ? p.ovr : ''),
      age: (ea && ea.age) ? ea.age : (p.age != null ? p.age : ''),
      jersey: (ea && ea.jersey != null) ? ea.jersey : (p.jersey != null ? p.jersey : ''),
      is_rookie: p.is_rookie ? 'Yes' : 'No',
      acquisition_type: p.acquisition_type || 'veteran'
    };
  });

  const unitOrder = { 'OFFENSE': 1, 'DEFENSE': 2, 'SPECIAL': 3 };
  processed.sort((a, b) => {
    if (a.team_name !== b.team_name) return a.team_name.localeCompare(b.team_name);
    const uA = unitOrder[a.unit] || 4, uB = unitOrder[b.unit] || 4;
    if (uA !== uB) return uA - uB;
    return (Number(b.ovr) || 0) - (Number(a.ovr) || 0);
  });

  const outPath = path.join(__dirname, 'nfl_rosters_2026.json');
  atomicWriteFileSync(outPath, JSON.stringify(processed, null, 2), 'utf8');
  console.log(`sync_supabase_rosters: wrote ${processed.length} players to ${outPath}`);
  console.log(`  teams: ${processed.filter(p => p.team_name !== 'Free Agent').length ? teams.length : 'n/a'}`);
}

main().catch(e => { console.error('sync_supabase_rosters failed:', e); process.exit(1); });