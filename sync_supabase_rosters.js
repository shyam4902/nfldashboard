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

function normalizeName(name) {
  if (!name) return "";
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['’.\\-]/g, "").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/\s+/g, " ").trim();
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
  atomicWriteFileSync(outPath, JSON.stringify(processed, null, 2), 'utf8');
  console.log(`sync_supabase_rosters: wrote ${processed.length} players to ${outPath}`);
  console.log(`  teams: ${processed.filter(p => p.team_name !== 'Free Agent').length ? teams.length : 'n/a'}`);
}

main().catch(e => { console.error('sync_supabase_rosters failed:', e); process.exit(1); });