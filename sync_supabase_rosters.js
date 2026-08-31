#!/usr/bin/env node
// Sync nfl_rosters_2026.json from the live Supabase roster source.
// Mirrors generate_roster_files.js (same anon-key reads + applied updates)
// but only refreshes the JSON file the app reads, no CSV/TXT.
//
// Purpose: propagate weekly roster/depth changes (cuts, chart moves) into the
// dashboard without re-deriving from a stale local snapshot. During the
// preseason ESPN exposes no depth order, so this is the source of truth;
// in-season an ESPN depth-chart overlay can be layered on top later.
//
// Usage: node sync_supabase_rosters.js        (writes nfl_rosters_2026.json)
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || "https://nedyoydylpbjvihaoexy.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY is required; set it in the environment, not in source.');
}
const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`
};

// Known summer 2026 roster moves that the Supabase DB does NOT yet carry.
// Mirror of applySummer2026Updates in generate_roster_files.js. When the DB
// is authoritative for a move, remove it here.
const PLAYER_UPDATES = [
  { name: 'Myles Garrett', newTeam: 'Los Angeles Rams', acq: 'trade', pos: 'EDGE', unit: 'defense', ovr: 98, age: 30, jersey: 95 },
  { name: 'Jared Verse', newTeam: 'Cleveland Browns', acq: 'trade', pos: 'EDGE', unit: 'defense', ovr: 85, age: 25, jersey: 55 },
  { name: 'A.J. Brown', newTeam: 'New England Patriots', acq: 'trade', pos: 'WR', unit: 'offense', ovr: 92, age: 29, jersey: 11 },
  { name: 'Stefon Diggs', newTeam: 'Washington Commanders', acq: 'fa', pos: 'WR', unit: 'offense', ovr: 88, age: 32, jersey: 1 },
  { name: 'Tyler Linderbaum', newTeam: 'Las Vegas Raiders', acq: 'fa', pos: 'C', unit: 'offense', ovr: 89, age: 26, jersey: 64 },
  { name: 'Malik Willis', newTeam: 'Miami Dolphins', acq: 'fa', pos: 'QB', unit: 'offense', ovr: 71, age: 27, jersey: 7 },
  { name: 'DJ Reader', newTeam: 'New York Giants', acq: 'fa', pos: 'DT', unit: 'defense', ovr: 84, age: 32, jersey: 98 },
  { name: 'Dontayvion Wicks', newTeam: 'Philadelphia Eagles', acq: 'trade', pos: 'WR', unit: 'offense', ovr: 78, age: 25, jersey: 13 },
  { name: 'Ogbonnia Okoronkwo', newTeam: 'San Francisco 49ers', acq: 'fa', pos: 'EDGE', unit: 'defense', ovr: 77, age: 31, jersey: 94 },
  { name: 'Kristian Wilkerson', newTeam: 'Atlanta Falcons', acq: 'fa', pos: 'WR', unit: 'offense', ovr: 70, age: 29, jersey: 83 },
  { name: 'Tyrod Taylor', newTeam: 'Green Bay Packers', acq: 'fa', pos: 'QB', unit: 'offense', ovr: 71, age: 37, jersey: 2 },
  { name: 'Scott Miller', newTeam: 'Chicago Bears', acq: 'fa', pos: 'WR', unit: 'offense', ovr: 72, age: 29, jersey: 10 },
  { name: 'Irvin Charles', newTeam: 'Seattle Seahawks', acq: 'trade', pos: 'WR', unit: 'offense', ovr: 68, age: 29, jersey: 82 }
];

function normalizeName(name) {
  if (!name) return "";
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['’.\\-]/g, "").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/\s+/g, " ").trim();
}

function applyUpdates(data) {
  const teamIdByName = Object.fromEntries(data.teams.map(t => [t.name, t.id]));
  for (const item of PLAYER_UPDATES) {
    const targetTeamId = teamIdByName[item.newTeam];
    if (!targetTeamId) continue;
    let p = data.players.find(x => normalizeName(x.name) === normalizeName(item.name));
    if (p) {
      p.team_id = targetTeamId;
      p.acquisition_type = item.acq;
      p.unit = item.unit || p.unit;
    } else {
      data.players.push({
        id: `custom-p-${normalizeName(item.name).replace(/\s+/g, '-')}`,
        name: item.name, pos: item.pos, team_id: targetTeamId, ovr: item.ovr,
        unit: item.unit, jersey: item.jersey, age: item.age,
        is_rookie: false, acquisition_type: item.acq
      });
    }
  }
}

// Madden OVR overlay (same matcher as the app) so ratings stay current.
function loadMaddenMap() {
  try {
    const p = path.join(__dirname, 'madden_official_ratings.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { console.warn('No madden_official_ratings.json:', e.message); return {}; }
}

function matchMaddenPlayer(maddenMap, p, offensivePos, defensivePos, specialPos) {
  if (!p || !p.name) return null;
  const norm = normalizeName(p.name);
  const rawNorm = (p.name || '').toLowerCase().replace(/['’.\\-]/g, '').replace(/\s+/g, ' ').trim();
  const maddenObj = maddenMap[norm] || maddenMap[rawNorm];
  if (!maddenObj) return null;
  const entries = Array.isArray(maddenObj) ? maddenObj : (maddenObj.entries || [maddenObj]);
  if (!entries.length) return null;
  const pUnit = (p.unit || '').toUpperCase();
  const pPos = (p.pos || '').toUpperCase();
  const isRookie = p.is_rookie === true || p.is_rookie === 'Yes';
  const pJersey = p.jersey != null && p.jersey !== '' ? Number(p.jersey) : null;
  const pAge = p.age ? Number(p.age) : null;
  const pNameLower = p.name.toLowerCase();
  const scored = entries.map(cand => {
    let score = 0;
    const candUnit = (cand.inferred_unit || '').toUpperCase();
    const candJersey = cand.jersey != null ? Number(cand.jersey) : null;
    const candAge = cand.age ? Number(cand.age) : null;
    const candYears = cand.yearsPro != null ? Number(cand.yearsPro) : null;
    const candNameLower = (cand.name || '').toLowerCase();
    let mismatch = false;
    if (pUnit && candUnit) {
      if ((pUnit === 'DEFENSE' && candUnit === 'OFFENSE') || (pUnit === 'OFFENSE' && candUnit === 'DEFENSE')) mismatch = true;
    }
    if (pPos) {
      if (defensivePos.includes(pPos) && candUnit === 'OFFENSE') mismatch = true;
      if (offensivePos.includes(pPos) && candUnit === 'DEFENSE') mismatch = true;
      if (specialPos.includes(pPos) && candUnit !== 'SPECIAL' && cand.ovr > 70) mismatch = true;
    }
    if (mismatch) return { cand, score: -999 };
    if (isRookie && candYears !== null && candYears >= 2) return { cand, score: -999 };
    if (pUnit && candUnit && pUnit === candUnit) score += 30;
    if (pJersey != null && candJersey != null && pJersey === candJersey) score += 100;
    else if (pJersey != null && candJersey != null && pJersey !== candJersey && entries.length > 1) score -= 50;
    if (pNameLower.includes('jr') && candNameLower.includes('jr')) score += 50;
    if ((pNameLower.includes('ii') || pNameLower.includes(' 2')) && (candNameLower.includes('ii') || candNameLower.includes(' 2'))) score += 50;
    if (cand.weight) {
      if (['DT', 'NT', 'DL'].includes(pPos) && cand.weight >= 280) score += 40;
      if (['EDGE', 'DE', 'LB', 'OLB', 'ILB'].includes(pPos) && cand.weight >= 225 && cand.weight <= 285) score += 40;
      if (['CB', 'DB', 'S', 'FS', 'SS', 'WR'].includes(pPos) && cand.weight < 220) score += 40;
      if (['OT', 'OG', 'C', 'G', 'T', 'OL'].includes(pPos) && cand.weight >= 280) score += 40;
      if (['RB', 'HB'].includes(pPos) && cand.weight >= 190 && cand.weight <= 245) score += 40;
    }
    if (pAge != null && candAge != null) {
      const d = Math.abs(pAge - candAge);
      if (d <= 1) score += 20;
      else if (d <= 2) score += 10;
    }
    return { cand, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 0) return null;
  return best.cand;
}

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
  applyUpdates(data);

  const maddenMap = loadMaddenMap();
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
  const offensivePos = ['QB', 'RB', 'FB', 'HB', 'WR', 'TE', 'C', 'G', 'OG', 'OT', 'T', 'OL'];
  const defensivePos = ['DE', 'EDGE', 'DT', 'NT', 'DL', 'LB', 'ILB', 'OLB', 'MLB', 'CB', 'DB', 'S', 'FS', 'SS'];
  const specialPos = ['PK', 'K', 'P', 'LS'];

  const processed = data.players.map(p => {
    const team = teamById[p.team_id] || { name: 'Free Agent', abbr: 'FA', division: 'N/A' };
    const ea = matchMaddenPlayer(maddenMap, p, offensivePos, defensivePos, specialPos);
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
  fs.writeFileSync(outPath, JSON.stringify(processed, null, 2), 'utf8');
  console.log(`sync_supabase_rosters: wrote ${processed.length} players to ${outPath}`);
  console.log(`  teams: ${processed.filter(p => p.team_name !== 'Free Agent').length ? teams.length : 'n/a'}`);
}

main().catch(e => { console.error('sync_supabase_rosters failed:', e); process.exit(1); });