const fs = require('fs');
const path = require('path');

const ESPN_TRANSACTIONS_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/transactions?limit=250";

const TEAM_METADATA = {
  "Arizona Cardinals": { abbr: "ARI", division: "NFC West" },
  "Atlanta Falcons": { abbr: "ATL", division: "NFC South" },
  "Baltimore Ravens": { abbr: "BAL", division: "AFC North" },
  "Buffalo Bills": { abbr: "BUF", division: "AFC East" },
  "Carolina Panthers": { abbr: "CAR", division: "NFC South" },
  "Chicago Bears": { abbr: "CHI", division: "NFC North" },
  "Cincinnati Bengals": { abbr: "CIN", division: "AFC North" },
  "Cleveland Browns": { abbr: "CLE", division: "AFC North" },
  "Dallas Cowboys": { abbr: "DAL", division: "NFC East" },
  "Denver Broncos": { abbr: "DEN", division: "AFC West" },
  "Detroit Lions": { abbr: "DET", division: "NFC North" },
  "Green Bay Packers": { abbr: "GB", division: "NFC North" },
  "Houston Texans": { abbr: "HOU", division: "AFC South" },
  "Indianapolis Colts": { abbr: "IND", division: "AFC South" },
  "Jacksonville Jaguars": { abbr: "JAX", division: "AFC South" },
  "Kansas City Chiefs": { abbr: "KC", division: "AFC West" },
  "Las Vegas Raiders": { abbr: "LV", division: "AFC West" },
  "Los Angeles Chargers": { abbr: "LAC", division: "AFC West" },
  "Los Angeles Rams": { abbr: "LAR", division: "NFC West" },
  "Miami Dolphins": { abbr: "MIA", division: "AFC East" },
  "Minnesota Vikings": { abbr: "MIN", division: "NFC North" },
  "New England Patriots": { abbr: "NE", division: "AFC East" },
  "New Orleans Saints": { abbr: "NO", division: "NFC South" },
  "New York Giants": { abbr: "NYG", division: "NFC East" },
  "New York Jets": { abbr: "NYJ", division: "AFC East" },
  "Philadelphia Eagles": { abbr: "PHI", division: "NFC East" },
  "Pittsburgh Steelers": { abbr: "PIT", division: "AFC North" },
  "San Francisco 49ers": { abbr: "SF", division: "NFC West" },
  "Seattle Seahawks": { abbr: "SEA", division: "NFC West" },
  "Tampa Bay Buccaneers": { abbr: "TB", division: "NFC South" },
  "Tennessee Titans": { abbr: "TEN", division: "AFC South" },
  "Washington Commanders": { abbr: "WAS", division: "NFC East" }
};

const POS_TO_UNIT = {
  QB: 'OFFENSE', RB: 'OFFENSE', FB: 'OFFENSE', WR: 'OFFENSE', TE: 'OFFENSE',
  OT: 'OFFENSE', T: 'OFFENSE', G: 'OFFENSE', OG: 'OFFENSE', C: 'OFFENSE', OL: 'OFFENSE',
  DE: 'DEFENSE', DT: 'DEFENSE', NT: 'DEFENSE', LB: 'DEFENSE', ILB: 'DEFENSE',
  OLB: 'DEFENSE', CB: 'DEFENSE', S: 'DEFENSE', FS: 'DEFENSE', SS: 'DEFENSE',
  DB: 'DEFENSE', EDGE: 'DEFENSE',
  PK: 'SPECIAL', K: 'SPECIAL', P: 'SPECIAL', LS: 'SPECIAL'
};

const POSITIONS = Object.keys(POS_TO_UNIT);

function normalizeName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['’.\-]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanName(raw) {
  return raw
    .replace(/\s+(with an injury designation|from injured reserve|with a settlement|to a contract|to a \d+-year[^\.]*|\(injured\)|ending his season|after they cleared waivers|to practice squad|from practice squad).*$/i, "")
    .replace(/^and\s+/i, "")
    .replace(/,\s*and\s+/i, ", ")
    .replace(/\s*\([^)]*\)/g, "")
    .trim();
}

function parseTransactionSentence(desc, teamName) {
  const moves = [];
  const sentences = desc.split(/[.;]/).map(s => s.trim()).filter(Boolean);

  for (const s of sentences) {
    // 1. Signed
    let m = s.match(/^Signed\s+(?:(?:(?:QB|RB|FB|WR|TE|OT|T|G|OG|C|OL|DE|DT|NT|LB|ILB|OLB|CB|S|FS|SS|DB|K|PK|P|LS|EDGE)s?)\s+)?(.+)/i);
    if (m) {
      const rest = m[1];
      const names = rest.split(/,\s*|\s+and\s+/).map(cleanName).filter(Boolean);
      for (const name of names) {
        let pos = "";
        let clean = name;
        for (const p of POSITIONS) {
          if (clean.startsWith(p + " ")) {
            pos = p;
            clean = clean.slice(p.length + 1).trim();
            break;
          }
        }
        if (clean && clean.length > 2 && !clean.toLowerCase().includes("contract") && !clean.toLowerCase().includes("extension")) {
          moves.push({ type: "sign", player: clean, pos, team: teamName });
        }
      }
      continue;
    }

    // 2. Waived / Released
    m = s.match(/^(?:Waived|Released|Terminated the contract of|Terminated contract of)\s+(?:(?:(?:QB|RB|FB|WR|TE|OT|T|G|OG|C|OL|DE|DT|NT|LB|ILB|OLB|CB|S|FS|SS|DB|K|PK|P|LS|EDGE)s?)\s+)?(.+)/i);
    if (m) {
      const rest = m[1];
      const names = rest.split(/,\s*|\s+and\s+/).map(cleanName).filter(Boolean);
      for (const name of names) {
        let pos = "";
        let clean = name;
        for (const p of POSITIONS) {
          if (clean.startsWith(p + " ")) {
            pos = p;
            clean = clean.slice(p.length + 1).trim();
            break;
          }
        }
        if (clean && clean.length > 2) {
          moves.push({ type: "waive", player: clean, pos, team: "Free Agent" });
        }
      }
      continue;
    }

    // 3. Claimed off waivers
    m = s.match(/^Claimed\s+(?:(?:(?:QB|RB|FB|WR|TE|OT|T|G|OG|C|OL|DE|DT|NT|LB|ILB|OLB|CB|S|FS|SS|DB|K|PK|P|LS|EDGE)s?)\s+)?(.+?)\s+off waivers/i);
    if (m) {
      let clean = cleanName(m[1]);
      let pos = "";
      for (const p of POSITIONS) {
        if (clean.startsWith(p + " ")) {
          pos = p;
          clean = clean.slice(p.length + 1).trim();
          break;
        }
      }
      if (clean && clean.length > 2) {
        moves.push({ type: "claim", player: clean, pos, team: teamName });
      }
      continue;
    }

    // 4. Traded / Acquired
    m = s.match(/^(?:Traded|Acquired)\s+(?:(?:(?:QB|RB|FB|WR|TE|OT|T|G|OG|C|OL|DE|DT|NT|LB|ILB|OLB|CB|S|FS|SS|DB|K|PK|P|LS|EDGE)s?)\s+)?(.+?)\s+(?:to|from)\s+(.+)/i);
    if (m) {
      let clean = cleanName(m[1]);
      let dest = s.startsWith("Traded") ? m[2].trim() : teamName;
      if (clean && clean.length > 2) {
        moves.push({ type: "trade", player: clean, pos: "", team: dest });
      }
      continue;
    }
  }

  return moves;
}

async function updateRostersFromESPN() {
  console.log(`[${new Date().toISOString()}] Checking ESPN transactions (https://www.espn.com/nfl/transactions)...`);

  const rostersPath = path.join(__dirname, 'nfl_rosters_2026.json');
  if (!fs.existsSync(rostersPath)) {
    console.error("Error: nfl_rosters_2026.json not found.");
    return;
  }

  const players = JSON.parse(fs.readFileSync(rostersPath, 'utf8'));

  // Load history of processed transaction signatures to avoid duplicate moves
  const processedPath = path.join(__dirname, 'processed_transactions.json');
  let processedIds = new Set();
  if (fs.existsSync(processedPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(processedPath, 'utf8'));
      processedIds = new Set(existing.ids || []);
    } catch (e) {}
  }

  // Fetch transactions from ESPN
  let espnTransactions = [];
  try {
    const res = await fetch(ESPN_TRANSACTIONS_URL, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    espnTransactions = data.transactions || [];
  } catch (err) {
    console.error("Failed to fetch ESPN transactions:", err.message);
    return;
  }

  console.log(`Fetched ${espnTransactions.length} transactions from ESPN.`);

  let moveCount = 0;
  // Transactions are sorted newest first; iterate in chronological order (oldest to newest)
  const chronological = [...espnTransactions].reverse();

  for (const item of chronological) {
    const teamName = item.team?.displayName || '';
    const desc = item.description || '';
    const txKey = `${item.date || ''}_${teamName}_${desc}`;

    if (processedIds.has(txKey)) continue;

    const moves = parseTransactionSentence(desc, teamName);
    for (const move of moves) {
      const norm = normalizeName(move.player);
      let p = players.find(x => normalizeName(x.name) === norm);

      if (p) {
        // Move existing player
        const oldTeam = p.team_name;
        if (move.team === "Free Agent") {
          p.team_name = "Free Agent";
          p.team_abbr = "FA";
          p.division = "N/A";
          p.acquisition_type = "fa";
          console.log(` -> [WAIVED/RELEASED] ${p.name} from ${oldTeam} to Free Agency`);
        } else {
          const meta = TEAM_METADATA[move.team] || { abbr: move.team.slice(0, 3).toUpperCase(), division: "N/A" };
          p.team_name = move.team;
          p.team_abbr = meta.abbr;
          p.division = meta.division;
          p.acquisition_type = (move.type === 'trade') ? 'trade' : 'fa';
          console.log(` -> [MOVED] ${p.name} (${p.pos}) from ${oldTeam} -> ${move.team}`);
        }
        moveCount++;
      } else if (move.team !== "Free Agent") {
        // Add newly signed player to the team
        const meta = TEAM_METADATA[move.team] || { abbr: move.team.slice(0, 3).toUpperCase(), division: "N/A" };
        const unit = POS_TO_UNIT[move.pos] || 'OFFENSE';
        players.push({
          team_name: move.team,
          team_abbr: meta.abbr,
          division: meta.division,
          name: move.player,
          pos: move.pos || 'N/A',
          unit: unit,
          ovr: '',
          age: '',
          jersey: '',
          is_rookie: 'No',
          acquisition_type: move.type === 'trade' ? 'trade' : 'fa'
        });
        console.log(` -> [ADDED] ${move.player} (${move.pos || 'N/A'}) to ${move.team}`);
        moveCount++;
      }
    }

    processedIds.add(txKey);
  }

  // Save updated roster files
  if (moveCount > 0) {
    console.log(`Applying ${moveCount} updates to roster files...`);

    // Sort by Team Name, then Unit, then OVR
    const unitOrder = { 'OFFENSE': 1, 'DEFENSE': 2, 'SPECIAL': 3 };
    players.sort((a, b) => {
      if (a.team_name !== b.team_name) return a.team_name.localeCompare(b.team_name);
      const uA = unitOrder[a.unit] || 4;
      const uB = unitOrder[b.unit] || 4;
      if (uA !== uB) return uA - uB;
      return (Number(b.ovr) || 0) - (Number(a.ovr) || 0);
    });

    // 1. JSON
    fs.writeFileSync(rostersPath, JSON.stringify(players, null, 2), 'utf8');

    // 2. CSV
    const csvHeaders = ['Team Name', 'Abbr', 'Division', 'Player Name', 'Position', 'Unit', 'Overall Rating (OVR)', 'Age', 'Jersey #', 'Is Rookie', 'Acquisition Type'];
    const csvRows = [csvHeaders.join(',')];
    for (const p of players) {
      csvRows.push([
        `"${p.team_name.replace(/"/g, '""')}"`,
        `"${p.team_abbr}"`,
        `"${p.division}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.pos}"`,
        `"${p.unit}"`,
        p.ovr !== null && p.ovr !== undefined ? p.ovr : '',
        p.age !== null && p.age !== undefined ? p.age : '',
        p.jersey !== null && p.jersey !== undefined ? p.jersey : '',
        p.is_rookie,
        `"${p.acquisition_type}"`
      ].join(','));
    }
    const csvPath = path.join(__dirname, 'nfl_rosters_2026.csv');
    fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');

    // 3. TXT
    let txtContent = `================================================================================\n`;
    txtContent += `                      2026 NFL ROSTERS REFERENCE DIRECTORY                       \n`;
    txtContent += `================================================================================\n`;
    txtContent += `Total Players: ${players.length}\n`;
    txtContent += `Last Updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n`;
    txtContent += `================================================================================\n\n`;

    const divOrder = ['AFC East','AFC North','AFC South','AFC West','NFC East','NFC North','NFC South','NFC West'];
    const divTeamsMap = {};
    for (const team of Object.keys(TEAM_METADATA)) {
      const div = TEAM_METADATA[team].division;
      if (!divTeamsMap[div]) divTeamsMap[div] = [];
      divTeamsMap[div].push(team);
    }

    for (const div of divOrder) {
      if (!divTeamsMap[div]) continue;
      txtContent += `################################################################################\n`;
      txtContent += `DIVISION: ${div.toUpperCase()}\n`;
      txtContent += `################################################################################\n\n`;

      const sortedTeams = divTeamsMap[div].sort();
      for (const team of sortedTeams) {
        const abbr = TEAM_METADATA[team]?.abbr || '';
        txtContent += `--------------------------------------------------------------------------------\n`;
        txtContent += `TEAM: ${team} (${abbr})\n`;
        txtContent += `--------------------------------------------------------------------------------\n`;

        const teamPlayers = players.filter(p => p.team_name === team);
        ['OFFENSE', 'DEFENSE', 'SPECIAL'].forEach(unitName => {
          const unitPlayers = teamPlayers.filter(p => p.unit === unitName);
          if (unitPlayers.length === 0) return;
          txtContent += `  [${unitName}]\n`;
          for (const p of unitPlayers) {
            const numStr = (p.jersey !== '' && p.jersey !== null && p.jersey !== undefined) ? `#${String(p.jersey).padStart(2, ' ')}` : '   ';
            const posStr = (p.pos || '').padEnd(5, ' ');
            const nameStr = (p.name || '').padEnd(25, ' ');
            const ovrStr = (p.ovr !== '' && p.ovr !== null && p.ovr !== undefined) ? `OVR: ${p.ovr}` : '       ';
            const ageStr = (p.age !== '' && p.age !== null && p.age !== undefined) ? `Age: ${p.age}` : '      ';
            const rkStr = p.is_rookie === 'Yes' ? '[ROOKIE]' : '';
            const acqStr = p.acquisition_type && p.acquisition_type !== 'veteran' ? `(${p.acquisition_type.toUpperCase()})` : '';
            txtContent += `    ${numStr}  ${posStr} ${nameStr}  ${ovrStr}  ${ageStr}  ${rkStr} ${acqStr}\n`;
          }
          txtContent += `\n`;
        });
        txtContent += `\n`;
      }
    }
    const txtPath = path.join(__dirname, 'nfl_rosters_2026.txt');
    fs.writeFileSync(txtPath, txtContent, 'utf8');

    console.log(`Updated nfl_rosters_2026.json, .csv, and .txt successfully!`);
  } else {
    console.log("No new roster changes found.");
  }

  // Save processed IDs
  fs.writeFileSync(processedPath, JSON.stringify({
    last_sync: new Date().toISOString(),
    ids: Array.from(processedIds)
  }, null, 2), 'utf8');

  console.log(`Sync complete at ${new Date().toLocaleTimeString()}.`);
}

// Check for --schedule or --daemon flag
const isScheduled = process.argv.includes('--schedule') || process.argv.includes('--daemon');

if (isScheduled) {
  console.log("Starting 24-hour scheduled roster updater daemon...");
  updateRostersFromESPN();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    updateRostersFromESPN();
  }, TWENTY_FOUR_HOURS);
} else {
  updateRostersFromESPN();
}
