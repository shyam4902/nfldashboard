const fs = require('fs');
const path = require('path');

const SUPABASE_URL = "https://nedyoydylpbjvihaoexy.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required');

const headers = {
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
};

async function main() {
  console.log("Fetching teams...");
  const teamsRes = await fetch(SUPABASE_URL + "nfl_teams?select=*", { headers });
  const teams = await teamsRes.json();

  console.log("Fetching players...");
  let players = [];
  let page = 0;
  while (true) {
    const res = await fetch(SUPABASE_URL + `nfl_players?select=*&offset=${page * 1000}&limit=1000`, { headers });
    const chunk = await res.json();
    players = players.concat(chunk);
    if (chunk.length < 1000) break;
    page++;
  }

  const data = { teams, players };
  // Load official Madden map if available
  let maddenMap = {};
  try {
    const maddenPath = path.join(__dirname, 'madden_official_ratings.json');
    if (fs.existsSync(maddenPath)) {
      maddenMap = JSON.parse(fs.readFileSync(maddenPath, 'utf8'));
    }
  } catch (e) {
    console.warn("Notice: Could not load madden_official_ratings.json:", e.message);
  }

  function normalizeName(name) {
    if (!name) return "";
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’.\-]/g, "").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "").replace(/\s+/g, " ").trim();
  }

  function matchMaddenPlayer(maddenMap, p) {
    if (!p || !p.name) return null;
    const norm = normalizeName(p.name);
    const rawNorm = p.name.toLowerCase().replace(/['’.\-]/g, "").replace(/\s+/g, " ").trim();
    const maddenObj = maddenMap[norm] || maddenMap[rawNorm];
    if (!maddenObj) return null;

    const entries = Array.isArray(maddenObj) ? maddenObj : (maddenObj.entries || [maddenObj]);
    if (!entries.length) return null;

    const pUnit = (p.unit || '').toUpperCase();
    const pPos = (p.pos || '').toUpperCase();
    const isRookie = p.is_rookie === true || p.is_rookie === 'Yes';
    const pJersey = p.jersey !== null && p.jersey !== undefined && p.jersey !== '' ? Number(p.jersey) : null;
    const pAge = p.age ? Number(p.age) : null;
    const pNameLower = p.name.toLowerCase();

    const offensivePos = ['QB', 'RB', 'FB', 'HB', 'WR', 'TE', 'C', 'G', 'OG', 'OT', 'T', 'OL'];
    const defensivePos = ['DE', 'EDGE', 'DT', 'NT', 'DL', 'LB', 'ILB', 'OLB', 'MLB', 'CB', 'DB', 'S', 'FS', 'SS'];
    const specialPos = ['PK', 'K', 'P', 'LS'];

    const scored = entries.map(cand => {
      let score = 0;
      const candUnit = (cand.inferred_unit || '').toUpperCase();
      const candJersey = cand.jersey !== null && cand.jersey !== undefined ? Number(cand.jersey) : null;
      const candAge = cand.age ? Number(cand.age) : null;
      const candYears = cand.yearsPro !== null && cand.yearsPro !== undefined ? Number(cand.yearsPro) : null;
      const candNameLower = (cand.name || '').toLowerCase();

      // Unit compatibility check
      let unitMismatch = false;
      if (pUnit && candUnit) {
        if (pUnit === 'DEFENSE' && candUnit === 'OFFENSE') unitMismatch = true;
        if (pUnit === 'OFFENSE' && candUnit === 'DEFENSE') unitMismatch = true;
      }
      if (pPos) {
        if (defensivePos.includes(pPos) && candUnit === 'OFFENSE') unitMismatch = true;
        if (offensivePos.includes(pPos) && candUnit === 'DEFENSE') unitMismatch = true;
        if (specialPos.includes(pPos) && candUnit !== 'SPECIAL' && cand.ovr > 70) unitMismatch = true;
      }
      if (unitMismatch) return { cand, score: -999 };

      // Rookie vs veteran check
      if (isRookie && candYears !== null && candYears >= 2) {
        return { cand, score: -999 };
      }

      // Base unit match
      if (pUnit && candUnit && pUnit === candUnit) {
        score += 30;
      }

      // Exact Jersey match
      if (pJersey !== null && candJersey !== null && pJersey === candJersey) {
        score += 100;
      } else if (pJersey !== null && candJersey !== null && pJersey !== candJersey && entries.length > 1) {
        score -= 50;
      }

      // Suffix match
      if (pNameLower.includes('jr') && candNameLower.includes('jr')) score += 50;
      if ((pNameLower.includes('ii') || pNameLower.includes(' 2')) && (candNameLower.includes('ii') || candNameLower.includes(' 2'))) score += 50;

      // Pos / Weight compatibility
      if (cand.weight) {
        if (['DT', 'NT', 'DL'].includes(pPos) && cand.weight >= 280) score += 40;
        if (['EDGE', 'DE', 'LB', 'OLB', 'ILB'].includes(pPos) && cand.weight >= 225 && cand.weight <= 285) score += 40;
        if (['CB', 'DB', 'S', 'FS', 'SS', 'WR'].includes(pPos) && cand.weight < 220) score += 40;
        if (['OT', 'OG', 'C', 'G', 'T', 'OL'].includes(pPos) && cand.weight >= 280) score += 40;
        if (['RB', 'HB'].includes(pPos) && cand.weight >= 190 && cand.weight <= 245) score += 40;
      }

      // Age proximity
      if (pAge !== null && candAge !== null) {
        const diff = Math.abs(pAge - candAge);
        if (diff <= 1) score += 20;
        else if (diff <= 2) score += 10;
      }

      return { cand, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best || best.score < 0) return null;
    return best.cand;
  }

  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));

  // Build normalized list of all players sorted by team, unit, position, rating
  const processedPlayers = data.players.map(p => {
    const team = teamById[p.team_id] || { name: 'Free Agent', abbr: 'FA', division: 'N/A', primary_color: '' };
    const eaMatch = matchMaddenPlayer(maddenMap, p);
    const finalOvr = eaMatch ? eaMatch.ovr : (p.ovr !== null && p.ovr !== undefined ? p.ovr : '');
    const finalAge = (eaMatch && eaMatch.age) ? eaMatch.age : (p.age !== null && p.age !== undefined ? p.age : '');
    const finalJersey = (eaMatch && eaMatch.jersey !== undefined && eaMatch.jersey !== null) ? eaMatch.jersey : (p.jersey !== null && p.jersey !== undefined ? p.jersey : '');

    return {
      team_name: team.name,
      team_abbr: team.abbr,
      division: team.division || 'N/A',
      name: p.name,
      pos: p.pos || 'N/A',
      unit: (p.unit || 'offense').toUpperCase(),
      ovr: finalOvr,
      age: finalAge,
      jersey: finalJersey,
      is_rookie: p.is_rookie ? 'Yes' : 'No',
      acquisition_type: p.acquisition_type || 'veteran'
    };
  });

  // Sort by Team Name, then Unit (OFFENSE, DEFENSE, SPECIAL), then OVR desc
  const unitOrder = { 'OFFENSE': 1, 'DEFENSE': 2, 'SPECIAL': 3 };
  processedPlayers.sort((a, b) => {
    if (a.team_name !== b.team_name) return a.team_name.localeCompare(b.team_name);
    const uA = unitOrder[a.unit] || 4;
    const uB = unitOrder[b.unit] || 4;
    if (uA !== uB) return uA - uB;
    return (Number(b.ovr) || 0) - (Number(a.ovr) || 0);
  });

  // 1. Generate CSV File
  console.log("Generating CSV...");
  const csvHeaders = ['Team Name', 'Abbr', 'Division', 'Player Name', 'Position', 'Unit', 'Overall Rating (OVR)', 'Age', 'Jersey #', 'Is Rookie', 'Acquisition Type'];
  const csvRows = [csvHeaders.join(',')];

  for (const p of processedPlayers) {
    const row = [
      `"${p.team_name.replace(/"/g, '""')}"`,
      `"${p.team_abbr}"`,
      `"${p.division}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.pos}"`,
      `"${p.unit}"`,
      p.ovr,
      p.age,
      p.jersey,
      p.is_rookie,
      `"${p.acquisition_type}"`
    ];
    csvRows.push(row.join(','));
  }

  const csvContent = csvRows.join('\n');
  const csvPath = path.join(__dirname, 'nfl_rosters_2026.csv');
  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log(`Saved CSV to ${csvPath} (${(fs.statSync(csvPath).size / 1024).toFixed(1)} KB)`);

  // 2. Generate Clean Plain Text Document (.txt)
  console.log("Generating TXT document...");
  let txtContent = `================================================================================\n`;
  txtContent += `                      2026 NFL ROSTERS REFERENCE DIRECTORY                       \n`;
  txtContent += `================================================================================\n`;
  txtContent += `Total Teams: ${teams.length}\n`;
  txtContent += `Total Players: ${processedPlayers.length}\n`;
  txtContent += `Updated: August 2026\n`;
  txtContent += `================================================================================\n\n`;

  // Group by Division -> Team
  const divTeamsMap = {};
  const divOrder = ['AFC East','AFC North','AFC South','AFC West','NFC East','NFC North','NFC South','NFC West'];

  for (const t of teams) {
    const div = t.division || 'Other';
    if (!divTeamsMap[div]) divTeamsMap[div] = [];
    divTeamsMap[div].push(t);
  }

  for (const div of divOrder) {
    if (!divTeamsMap[div]) continue;
    txtContent += `################################################################################\n`;
    txtContent += `DIVISION: ${div.toUpperCase()}\n`;
    txtContent += `################################################################################\n\n`;

    const sortedTeamsInDiv = divTeamsMap[div].sort((a,b) => a.name.localeCompare(b.name));
    for (const team of sortedTeamsInDiv) {
      txtContent += `--------------------------------------------------------------------------------\n`;
      txtContent += `TEAM: ${team.name} (${team.abbr}) - Cap Space: $${Number(team.cap_space).toLocaleString()}\n`;
      txtContent += `--------------------------------------------------------------------------------\n`;

      const teamPlayers = processedPlayers.filter(p => p.team_name === team.name);

      ['OFFENSE', 'DEFENSE', 'SPECIAL'].forEach(unitName => {
        const unitPlayers = teamPlayers.filter(p => p.unit === unitName);
        if (unitPlayers.length === 0) return;

        txtContent += `  [${unitName}]\n`;
        for (const p of unitPlayers) {
          const numStr = p.jersey !== '' ? `#${String(p.jersey).padStart(2, ' ')}` : '   ';
          const posStr = p.pos.padEnd(5, ' ');
          const nameStr = p.name.padEnd(25, ' ');
          const ovrStr = p.ovr !== '' ? `OVR: ${p.ovr}` : '       ';
          const ageStr = p.age !== '' ? `Age: ${p.age}` : '      ';
          const rkStr = p.is_rookie === 'Yes' ? '[ROOKIE]' : '';
          const acqStr = p.acquisition_type !== 'veteran' ? `(${p.acquisition_type.toUpperCase()})` : '';

          txtContent += `    ${numStr}  ${posStr} ${nameStr}  ${ovrStr}  ${ageStr}  ${rkStr} ${acqStr}\n`;
        }
        txtContent += `\n`;
      });
      txtContent += `\n`;
    }
  }

  const txtPath = path.join(__dirname, 'nfl_rosters_2026.txt');
  fs.writeFileSync(txtPath, txtContent, 'utf8');
  console.log(`Saved TXT to ${txtPath} (${(fs.statSync(txtPath).size / 1024).toFixed(1)} KB)`);

  // 3. Generate JSON File
  console.log("Generating JSON...");
  const jsonPath = path.join(__dirname, 'nfl_rosters_2026.json');
  fs.writeFileSync(jsonPath, JSON.stringify(processedPlayers, null, 2), 'utf8');
  console.log(`Saved JSON to ${jsonPath} (${(fs.statSync(jsonPath).size / 1024).toFixed(1)} KB)`);

  console.log("All roster files generated successfully!");
}

main().catch(err => console.error(err));
