const fs = require('fs');
const path = require('path');

const SUPABASE_URL = "https://nedyoydylpbjvihaoexy.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_cQOHCiQh2kZQQUn5sEEfIA_t9NScNZz";

const headers = {
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
};

function normalizeName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/['’.\-]/g, "") // remove apostrophes, dots, hyphens
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "") // remove suffixes
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchDbPlayers() {
  let players = [];
  let page = 0;
  while (true) {
    const res = await fetch(SUPABASE_URL + `nfl_players?select=*&offset=${page * 1000}&limit=1000`, { headers });
    const chunk = await res.json();
    players = players.concat(chunk);
    if (chunk.length < 1000) break;
    page++;
  }
  return players;
}

async function fetchDbTeams() {
  const res = await fetch(SUPABASE_URL + "nfl_teams?select=*", { headers });
  return await res.json();
}

async function fetchEaMaddenPlayers() {
  let eaPlayers = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const url = `https://drop-api.ea.com/rating/madden-nfl?limit=${limit}&offset=${offset}`;
    const res = await fetch(url);
    const data = await res.json();
    const items = data.items || [];
    eaPlayers = eaPlayers.concat(items);
    console.log(`Fetched ${eaPlayers.length} / ${data.totalItems || '?'}`);
    if (items.length < limit || eaPlayers.length >= (data.totalItems || 2000)) break;
    offset += limit;
  }
  return eaPlayers;
}

async function updatePlayerOvrInSupabase(updates) {
  console.log(`Updating ${updates.length} players in Supabase...`);
  // Update in chunks of 50
  const chunkSize = 50;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(chunk.map(u => 
      fetch(`${SUPABASE_URL}nfl_players?id=eq.${u.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ovr: u.newOvr, ratings_source: "madden_official" })
      })
    ));
  }
  console.log("Supabase update completed successfully!");
}

async function main() {
  console.log("=== Madden Ratings Comparison & Sync Script ===");
  
  const [dbTeams, dbPlayers, eaPlayers] = await Promise.all([
    fetchDbTeams(),
    fetchDbPlayers(),
    fetchEaMaddenPlayers()
  ]);

  const teamById = Object.fromEntries(dbTeams.map(t => [t.id, t]));

  // Build EA lookup by normalized name
  const eaLookup = new Map();
  for (const ea of eaPlayers) {
    const fullName = `${ea.firstName || ''} ${ea.lastName || ''}`.trim();
    const norm = normalizeName(fullName);
    if (norm) {
      eaLookup.set(norm, ea);
    }
  }

  const diffRows = [];
  const dbUpdates = [];

  let matchedCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;
  let notFoundCount = 0;

  for (const p of dbPlayers) {
    const team = teamById[p.team_id] || { name: "Free Agent", abbr: "FA" };
    const normName = normalizeName(p.name);
    const eaMatch = eaLookup.get(normName);

    if (eaMatch) {
      matchedCount++;
      const oldOvr = p.ovr !== null && p.ovr !== undefined ? p.ovr : "N/A";
      const newOvr = eaMatch.overallRating;
      const delta = (typeof oldOvr === 'number' && typeof newOvr === 'number') ? newOvr - oldOvr : 0;

      if (oldOvr !== newOvr) {
        changedCount++;
        dbUpdates.push({ id: p.id, newOvr });
        diffRows.push({
          playerName: p.name,
          team: team.name,
          pos: p.pos || "N/A",
          oldOvr,
          newOvr,
          delta: delta > 0 ? `+${delta}` : `${delta}`,
          status: "UPDATED"
        });
      } else {
        unchangedCount++;
        diffRows.push({
          playerName: p.name,
          team: team.name,
          pos: p.pos || "N/A",
          oldOvr,
          newOvr,
          delta: "0",
          status: "UNCHANGED"
        });
      }
    } else {
      notFoundCount++;
      diffRows.push({
        playerName: p.name,
        team: team.name,
        pos: p.pos || "N/A",
        oldOvr: p.ovr !== null && p.ovr !== undefined ? p.ovr : "N/A",
        newOvr: "N/A",
        delta: "N/A",
        status: "NOT_FOUND_IN_EA"
      });
    }
  }

  // Write comparison report CSV
  diffRows.sort((a, b) => {
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    return Math.abs(Number(b.delta) || 0) - Math.abs(Number(a.delta) || 0);
  });

  const csvHeader = ["Player Name", "Team", "Position", "Previous DB OVR", "Madden Official OVR", "Rating Delta", "Status"];
  const csvLines = [csvHeader.join(",")];
  for (const r of diffRows) {
    csvLines.push([
      `"${r.playerName.replace(/"/g, '""')}"`,
      `"${r.team.replace(/"/g, '""')}"`,
      `"${r.pos}"`,
      r.oldOvr,
      r.newOvr,
      `"${r.delta}"`,
      `"${r.status}"`
    ].join(","));
  }

  const reportPath = path.join(__dirname, "madden_rating_diffs.csv");
  fs.writeFileSync(reportPath, csvLines.join("\n"), "utf8");

  console.log("\n==============================================");
  console.log(`Comparison Complete!`);
  console.log(`Total DB Players: ${dbPlayers.length}`);
  console.log(`Total EA Madden Players Fetched: ${eaPlayers.length}`);
  console.log(`Matched Players: ${matchedCount}`);
  console.log(`Rating Changes Detected: ${changedCount}`);
  console.log(`Unchanged Ratings: ${unchangedCount}`);
  console.log(`Unmatched / Rookies Not In EA: ${notFoundCount}`);
  console.log(`Comparison report saved to: ${reportPath}`);
  console.log("==============================================\n");

  // Perform database updates
  if (dbUpdates.length > 0) {
    await updatePlayerOvrInSupabase(dbUpdates);
    console.log("Re-generating roster export files (CSV, TXT, JSON)...");
    require('./generate_roster_files.js');
  }
}

main().catch(err => console.error(err));
