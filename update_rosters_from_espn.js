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
    // Roster-status clauses trail the name in the live feed ("to the practice
    // squad", "from the active/PUP list", "on injured reserve"). No player name
    // contains roster/squad/list/reserve/exempt, so cutting at the first one is safe.
    .replace(/\s+(?:with an injury designation|with a settlement|to a contract|to a \d+-year[^\.]*|\(injured\)|ending his season|after they cleared waivers|(?:to|from|on)\s+(?:the\s+)?[\w\/\- ]*?\b(?:roster|squad|list|reserve|exempt)\b).*$/i, "")
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
    source_date: String(item.date || ''),
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
  const requiredStrings = ['id', 'source', 'source_key', 'source_date', 'type', 'player_name', 'from_team', 'to_team', 'detail', 'sort_date'];
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
    if (typeof row.source_date === 'string' && Number.isNaN(Date.parse(row.source_date))) {
      errors.push(`row ${index}: source_date must be a valid timestamp`);
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

// ── CLI / pipeline ─────────────────────────────────────────────────────────
// Default mode is DRY-RUN: normalize, validate, and write only the inspect
// artifact espn_transactions_2026.json (atomically). No roster file or
// processed-log file is touched. Without --input it fetches the ESPN feed;
// persistence to the Supabase
// nfl_transactions table happens only with the explicit --write flag, which
// requires SUPABASE_URL / SUPABASE_SECRET_KEY in the environment and the tx_id
// migration applied (supabase/migrations/20260903_espn_transactions_tx_id.sql).
const { makeSupabaseClient, persistTransactions } = require('./espn_transaction_persistence.js');

function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
}

function filterItemsSince(items, since) {
  if (!since) return items;
  if (!isValidIsoDate(since)) throw new Error('--since must be a valid YYYY-MM-DD date');
  return items.filter(item => typeof item.date === 'string' && item.date.slice(0, 10) >= since);
}

async function loadEspnItems({ inputPath, fetchImpl = fetch, since = null } = {}) {
  if (inputPath) {
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const items = Array.isArray(data) ? data : data.transactions;
    if (!Array.isArray(items)) {
      throw new Error(`--input ${inputPath} must be an array or { "transactions": [...] }`);
    }
    return items;
  }
  const allItems = [];
  let page = 1;
  while (true) {
    const pageUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/transactions?limit=250&page=${page}`;
    const res = await fetchImpl(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`ESPN fetch failed: HTTP ${res.status}`);
    const data = await res.json();
    const txs = data.transactions || [];
    if (!txs.length) break;
    allItems.push(...txs);
    if (since) {
      const oldestInPage = txs[txs.length - 1];
      if (oldestInPage && typeof oldestInPage.date === 'string' && oldestInPage.date.slice(0, 10) < since) {
        break;
      }
    }
    const pageCount = data.pageCount || 1;
    if (page >= pageCount) break;
    page++;
  }
  return allItems;
}


// Normalize + validate + (dry) write artifact or (write) persist. Pure side
// effects are limited to the atomic dry-run artifact, so a partial persistence
// failure can never replace a valid local roster or transaction artifact.
async function processTransactions({ items, mode = 'dry', client = null, outputPath = NORMALIZED_TRANSACTIONS_PATH, sourceUrl = ESPN_TRANSACTIONS_URL }) {
  const rows = normalizeEspnTransactions(items);
  const validation = validateTransactions(rows);
  if (!validation.valid) {
    throw new Error(`refusing to proceed with malformed rows: ${validation.errors.join('; ')}`);
  }

  if (mode === 'write') {
    if (!client) throw new Error('write mode requires a persistence client');
    const summary = await persistTransactions(rows, client, { sourceUrl });
    return { mode: 'write', ...summary };
  }

  const envelope = {
    source: 'ESPN',
    source_url: sourceUrl,
    fetched_at: new Date().toISOString(),
    record_count: rows.length,
    transactions: rows,
  };
  const envelopeValidation = validateDryRunEnvelope(envelope);
  if (!envelopeValidation.valid) {
    throw new Error(`dry-run envelope failed validation: ${envelopeValidation.errors.join('; ')}`);
  }
  atomicWriteFileSync(outputPath, JSON.stringify(envelope, null, 2), 'utf8');
  return { mode: 'dry', record_count: rows.length, output_path: outputPath };
}

async function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const mode = write ? 'write' : 'dry'; // dry-run is the default
  const inputPath = flagValue(argv, '--input') || process.env.ESPN_TRANSACTIONS_INPUT || null;
  const since = flagValue(argv, '--since');
  const outputPath = process.env.ESPN_OUT_PATH || NORMALIZED_TRANSACTIONS_PATH;

  console.log(`[${new Date().toISOString()}] update_rosters_from_espn: ${mode} mode (ESPN transactions feed)`);
  try {
    if (mode === 'write' && !process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL is required for --write; set the project URL in the environment.');
    }
    const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (mode === 'write' && !secretKey) {
      throw new Error('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_KEY is required for --write; set it in the environment, not in source.');
    }
    if (mode === 'write' && !since) {
      throw new Error('--since YYYY-MM-DD is required for --write; choose the first date after the 352 legacy rows to avoid overlap.');
    }
    const items = filterItemsSince(await loadEspnItems({ inputPath, since }), since);
    console.log(`Loaded ${items.length} ESPN transaction items.`);
    let client = null;
    if (mode === 'write') {
      const url = process.env.SUPABASE_URL;
      client = makeSupabaseClient({ url, secretKey });
    }
    const result = await processTransactions({ items, mode, client, outputPath });
    if (mode === 'write') {
      console.log(`Persisted ESPN transactions: total ${result.total}, inserted ${result.inserted}, already present ${result.already_present}, intra-batch duplicates skipped ${result.duplicates_skipped}.`);
    } else {
      console.log(`Dry run: wrote ${result.record_count} normalized transactions to ${result.output_path} (no roster or database writes).`);
      console.log('Use --write to persist to Supabase (requires SUPABASE_URL, SUPABASE_SECRET_KEY, and the tx_id migration).');
    }
  } catch (err) {
    console.error(`update_rosters_from_espn failed: ${err.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

module.exports = {
  normalizeName,
  canonicalTeamName,
  parseTransactionSentence,
  normalizeEspnTransaction,
  normalizeEspnTransactions,
  validateTransactions,
  validateDryRunEnvelope,
  processTransactions,
  loadEspnItems,
  main,
};
