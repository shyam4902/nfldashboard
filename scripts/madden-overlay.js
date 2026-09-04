// Madden OVR overlay: name normalisation plus the scored matcher that picks the
// right Madden entry for a roster player. Shared by sync_supabase_rosters.js
// (Supabase -> local JSON) and sync_rosters_from_espn_api.js (ESPN -> Supabase)
// so the two never drift apart.
const fs = require('fs');
const path = require('path');

const OFFENSIVE_POS = ['QB', 'RB', 'FB', 'HB', 'WR', 'TE', 'C', 'G', 'OG', 'OT', 'T', 'OL'];
const DEFENSIVE_POS = ['DE', 'EDGE', 'DT', 'NT', 'DL', 'LB', 'ILB', 'OLB', 'MLB', 'CB', 'DB', 'S', 'FS', 'SS'];
const SPECIAL_POS = ['PK', 'K', 'P', 'LS'];

function normalizeName(name) {
  if (!name) return "";
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['’.\\-]/g, "").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/\s+/g, " ").trim();
}

// Madden OVR overlay (same matcher as the app) so ratings stay current.
function loadMaddenMap() {
  try {
    const p = path.join(__dirname, '..', 'madden_official_ratings.json');
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

module.exports = { normalizeName, loadMaddenMap, matchMaddenPlayer, OFFENSIVE_POS, DEFENSIVE_POS, SPECIAL_POS };
