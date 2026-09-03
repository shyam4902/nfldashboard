const fs = require('fs');
const path = require('path');
const { atomicWriteFileSync } = require('./scripts/atomic-write.js');

const ESPN_TRANSACTIONS_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/transactions?limit=250";
const NORMALIZED_TRANSACTIONS_PATH = path.join(__dirname, 'espn_transactions_2026.json');

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
const NORMALIZED_TRANSACTION_TYPES = new Set(['signing', 'waiver', 'trade', 'draft']);
// parseTransactionSentence speaks in verbs; the stored contract is the four
// NORMALIZED_TRANSACTION_TYPES above. A claim is a waiver-wire move, so it
// stores as 'waiver' and from_team/to_team carry which way the player went.
const CANONICAL_MOVE_TYPES = { sign: 'signing', waive: 'waiver', claim: 'waiver' };

const TEAM_SHORT_NAMES = {
  Arizona: 'Arizona Cardinals', Atlanta: 'Atlanta Falcons', Baltimore: 'Baltimore Ravens',
  Buffalo: 'Buffalo Bills', Carolina: 'Carolina Panthers', Chicago: 'Chicago Bears',
  Cincinnati: 'Cincinnati Bengals', Cleveland: 'Cleveland Browns', Dallas: 'Dallas Cowboys',
  Denver: 'Denver Broncos', Detroit: 'Detroit Lions', 'Green Bay': 'Green Bay Packers',
  Houston: 'Houston Texans', Indianapolis: 'Indianapolis Colts', Jacksonville: 'Jacksonville Jaguars',
  'Kansas City': 'Kansas City Chiefs', 'Las Vegas': 'Las Vegas Raiders', Miami: 'Miami Dolphins',
  Minnesota: 'Minnesota Vikings', 'New England': 'New England Patriots', 'New Orleans': 'New Orleans Saints',
  Philadelphia: 'Philadelphia Eagles', Pittsburgh: 'Pittsburgh Steelers', 'San Francisco': 'San Francisco 49ers',
  Seattle: 'Seattle Seahawks', 'Tampa Bay': 'Tampa Bay Buccaneers', Tennessee: 'Tennessee Titans',
  Washington: 'Washington Commanders'
};

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

function canonicalTeamName(name) {
  const value = String(name || '').trim();
  if (!value) return '';
  const exact = Object.keys(TEAM_METADATA).find(team => team.toLowerCase() === value.toLowerCase());
  if (exact) return exact;
  const abbreviation = Object.entries(TEAM_METADATA).find(([, meta]) => meta.abbr.toLowerCase() === value.toLowerCase());
  if (abbreviation) return abbreviation[0];
  const shortMatch = Object.entries(TEAM_SHORT_NAMES).find(([short]) => short.toLowerCase() === value.toLowerCase());
  return shortMatch ? shortMatch[1] : value;
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
      const leadingPos = s.match(new RegExp(`^Signed\\s+(${POSITIONS.join('|')})\\s+`, 'i'));
      const restWithoutPos = leadingPos ? rest.replace(new RegExp(`^${leadingPos[1]}\\s+`, 'i'), '') : rest;
      const posName = leadingPos ? leadingPos[1].toUpperCase() : '';
      const names = restWithoutPos.split(/,\s*|\s+and\s+/).map(cleanName).filter(Boolean);
      for (const name of names) {
        let pos = posName;
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
      const leadingPos = s.match(new RegExp(`^(?:Waived|Released|Terminated the contract of|Terminated contract of)\\s+(${POSITIONS.join('|')})\\s+`, 'i'));
      const restWithoutPos = leadingPos ? rest.replace(new RegExp(`^${leadingPos[1]}\\s+`, 'i'), '') : rest;
      const posName = leadingPos ? leadingPos[1].toUpperCase() : '';
      const names = restWithoutPos.split(/,\s*|\s+and\s+/).map(cleanName).filter(Boolean);
      for (const name of names) {
        let pos = posName;
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
    m = s.match(/^Claimed\s+(?:(?:(?:QB|RB|FB|WR|TE|OT|T|G|OG|C|OL|DE|DT|NT|LB|ILB|OLB|CB|S|FS|SS|DB|K|PK|P|LS|EDGE)s?)\s+)?(.+?)\s+off waivers(?:\s+from\s+(.+?))?$/i);
    if (m) {
      let clean = cleanName(m[1]);
      let pos = "";
      const leadingPos = s.match(new RegExp(`^Claimed\\s+(${POSITIONS.join('|')})\\s+`, 'i'));
      if (leadingPos) { pos = leadingPos[1].toUpperCase(); clean = clean.replace(new RegExp(`^${leadingPos[1]}\\s+`, 'i'), ''); }
      if (clean && clean.length > 2) {
        moves.push({ type: "claim", player: clean, pos, team: teamName, ...(m[2] ? { fromTeam: m[2].trim() } : {}) });
      }
      continue;
    }

    // 4. Traded / Acquired. Ignore draft compensation after the player name.
    m = s.match(/^Traded\s+(.+?)\s+to\s+(.+?)(?:\s+in exchange for|\s+for|$)/i);
    if (m) {
      let clean = cleanName(m[1].replace(/\s+and\s+a\s+\d+\s+.*?round pick.*$/i, '').replace(/\s+and\s+\d+\s+.*?round pick.*$/i, ''));
      let pos = '';
      const leadingPos = clean.match(new RegExp(`^(${POSITIONS.join('|')})\\s+(.+)$`, 'i'));
      if (leadingPos) { pos = leadingPos[1].toUpperCase(); clean = leadingPos[2]; }
      if (clean && clean.length > 2) {
        moves.push({ type: "trade", player: clean, pos, team: m[2].trim(), fromTeam: teamName });
      }
      continue;
    }

    m = s.match(/^Acquired\s+(?:(?:(?:QB|RB|FB|WR|TE|OT|T|G|OG|C|OL|DE|DT|NT|LB|ILB|OLB|CB|S|FS|SS|DB|K|PK|P|LS|EDGE)s?)\s+)?(.+?)\s+from\s+(.+)$/i);
    if (m) {
      let clean = cleanName(m[1]);
      if (clean && clean.length > 2) moves.push({ type: "trade", player: clean, pos: "", team: teamName, fromTeam: m[2].trim() });
      continue;
    }
  }

  return moves;
}

function formatDate(date) {
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function normalizeEspnTransaction(item) {
  const teamName = item.team?.displayName || '';
  const desc = item.description || '';
  const sourceKey = `${item.date || ''}_${teamName}_${desc}`;
  const moves = parseTransactionSentence(desc, teamName);
  return moves.map(move => ({
    id: `${item.id || sourceKey}:${move.type}:${normalizeName(move.player).replace(/\s+/g, '-')}`,
    source: 'ESPN',
    source_id: item.id || null,
    source_key: sourceKey,
    type: CANONICAL_MOVE_TYPES[move.type] || move.type,
    blockbuster: false,
    player_name: move.player,
    pos: move.pos || '',
    from_team: canonicalTeamName(move.fromTeam || (move.type === 'waive' ? teamName : 'Free Agent')),
    to_team: canonicalTeamName(move.team),
    detail: desc,
    date_str: formatDate(item.date),
    sort_date: String(item.date || '').slice(0, 10)
  }));
}

function normalizeEspnTransactions(items) {
  // ESPN repeats players inside a single release sentence (the 2026-08-29
  // Steelers row lists two DBs twice), which would break the unique-id rule.
  const seen = new Set();
  return items.flatMap(normalizeEspnTransaction).filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function validateTransactions(rows) {
  const errors = [];
  const requiredStrings = ['id', 'source', 'source_key', 'type', 'player_name', 'from_team', 'to_team', 'detail', 'sort_date'];
  const ids = new Set();
  if (!Array.isArray(rows)) return { valid: false, errors: ['transactions must be an array'] };
  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push(`row ${index}: must be an object`);
      return;
    }
    for (const field of requiredStrings) {
      if (typeof row[field] !== 'string' || row[field].trim() === '') {
        errors.push(`row ${index}: ${field} is required and must be a non-empty string`);
      }
    }
    if (typeof row.id === 'string' && ids.has(row.id)) errors.push(`row ${index}: id must be unique`);
    if (typeof row.id === 'string') ids.add(row.id);
    if (row.source !== 'ESPN') errors.push(`row ${index}: source must be ESPN`);
    if (!NORMALIZED_TRANSACTION_TYPES.has(row.type)) errors.push(`row ${index}: type is unsupported`);
    if (typeof row.sort_date === 'string' && !isValidIsoDate(row.sort_date)) {
      errors.push(`row ${index}: sort_date must be YYYY-MM-DD`);
    }
    if (row.pos !== undefined && typeof row.pos !== 'string') errors.push(`row ${index}: pos must be a string`);
  });
  return { valid: errors.length === 0, errors };
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateDryRunEnvelope(envelope) {
  const errors = [];
  if (!envelope || typeof envelope !== 'object') return { valid: false, errors: ['envelope must be an object'] };
  if (envelope.source !== 'ESPN') errors.push('source must be ESPN');
  if (typeof envelope.source_url !== 'string' || envelope.source_url.trim() === '') errors.push('source_url is required');
  if (envelope.source_url !== ESPN_TRANSACTIONS_URL) errors.push('source_url must match the ESPN transactions URL');
  if (typeof envelope.fetched_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(envelope.fetched_at) || Number.isNaN(Date.parse(envelope.fetched_at))) {
    errors.push('fetched_at must be a valid ISO timestamp');
  }
  if (!Array.isArray(envelope.transactions)) errors.push('transactions must be an array');
  if (!Number.isInteger(envelope.record_count) || envelope.record_count !== (Array.isArray(envelope.transactions) ? envelope.transactions.length : -1)) {
    errors.push('record_count must equal transactions.length');
  }
  return { valid: errors.length === 0, errors };
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

  const normalizedTransactions = normalizeEspnTransactions(espnTransactions);
  const validation = validateTransactions(normalizedTransactions);
  if (!validation.valid) {
    console.error('Normalized ESPN transaction validation failed:', validation.errors.join('; '));
    return;
  }
  if (process.argv.includes('--dry-run')) {
    const envelope = {
      source: 'ESPN',
      source_url: ESPN_TRANSACTIONS_URL,
      fetched_at: new Date().toISOString(),
      record_count: normalizedTransactions.length,
      transactions: normalizedTransactions
    };
    const envelopeValidation = validateDryRunEnvelope(envelope);
    if (!envelopeValidation.valid) {
      console.error('ESPN dry-run envelope validation failed:', envelopeValidation.errors.join('; '));
      return;
    }
    fs.writeFileSync(NORMALIZED_TRANSACTIONS_PATH, JSON.stringify(envelope, null, 2), 'utf8');
    console.log(`Dry run wrote ${normalizedTransactions.length} normalized transactions to ${NORMALIZED_TRANSACTIONS_PATH}`);
    return;
  }

  let moveCount = 0;
  // Transactions are sorted newest first; iterate in chronological order (oldest to newest)
  const chronological = [...espnTransactions].reverse();

  for (const item of chronological) {
    const teamName = canonicalTeamName(item.team?.displayName || '');
    const desc = item.description || '';
    const txKey = `${item.date || ''}_${teamName}_${desc}`;

    if (processedIds.has(txKey)) continue;

    const moves = parseTransactionSentence(desc, teamName);
    for (const move of moves) {
      const destinationTeam = canonicalTeamName(move.team);
      const norm = normalizeName(move.player);
      let p = players.find(x => normalizeName(x.name) === norm);

      if (p) {
        // Move existing player
        const oldTeam = p.team_name;
        if (destinationTeam === "Free Agent") {
          p.team_name = "Free Agent";
          p.team_abbr = "FA";
          p.division = "N/A";
          p.acquisition_type = "fa";
          console.log(` -> [WAIVED/RELEASED] ${p.name} from ${oldTeam} to Free Agency`);
        } else {
          const meta = TEAM_METADATA[destinationTeam] || { abbr: destinationTeam.slice(0, 3).toUpperCase(), division: "N/A" };
          p.team_name = destinationTeam;
          p.team_abbr = meta.abbr;
          p.division = meta.division;
          p.acquisition_type = (move.type === 'trade') ? 'trade' : 'fa';
          console.log(` -> [MOVED] ${p.name} (${p.pos}) from ${oldTeam} -> ${destinationTeam}`);
        }
        moveCount++;
      } else if (destinationTeam !== "Free Agent") {
        // Add newly signed player to the team
        const meta = TEAM_METADATA[destinationTeam] || { abbr: destinationTeam.slice(0, 3).toUpperCase(), division: "N/A" };
        const unit = POS_TO_UNIT[move.pos] || 'OFFENSE';
        players.push({
          team_name: destinationTeam,
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
        console.log(` -> [ADDED] ${move.player} (${move.pos || 'N/A'}) to ${destinationTeam}`);
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
    atomicWriteFileSync(rostersPath, JSON.stringify(players, null, 2), 'utf8');

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
    atomicWriteFileSync(csvPath, csvRows.join('\n'), 'utf8');

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
    atomicWriteFileSync(txtPath, txtContent, 'utf8');

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

if (require.main === module) {
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
}

module.exports = { normalizeName, canonicalTeamName, parseTransactionSentence, normalizeEspnTransaction, normalizeEspnTransactions, validateTransactions, validateDryRunEnvelope };
