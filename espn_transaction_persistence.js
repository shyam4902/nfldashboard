// Persistence boundary for normalized ESPN transactions.
//
// Writes validated normalized rows into the Supabase `nfl_transactions` table
// idempotently: every row gets a stable `tx_id` (sha256 over the canonical
// normalized tuple), rows already present are skipped, and only the missing
// rows are inserted in one request. Applying the same ESPN input twice
// therefore inserts nothing the second time, and a repeated player or repeated
// description normalizes to the same `tx_id`.
//
// The Supabase client is injectable (fetch-based by default, pointed only at
// env-configured endpoints). Nothing in this module contacts Supabase unless a
// caller constructs the real client and calls persistTransactions. Tests pass
// a fake client, so the whole persistence path is exercisable hermetically.
//
// Schema note: upsert-safe behavior is achieved by checking existing tx_ids
// before insert, plus a partial unique index on tx_id added by
// supabase/migrations/20260903_espn_transactions_tx_id.sql. Apply the
// migration before the first authorized --write run so the database itself
// enforces the same contract.
'use strict';

const crypto = require('node:crypto');

const DEFAULT_SUPABASE_URL = 'https://nedyoydylpbjvihaoexy.supabase.co/rest/v1/';
const TRANSACTIONS_TABLE = 'nfl_transactions';

// Fields the dashboard's transaction reader renders and that provenance
// requires; everything else on a normalized row is dropped at the boundary.
const PERSISTED_FIELDS = [
  'tx_id', 'source', 'source_url', 'source_id', 'source_key',
  'type', 'blockbuster', 'player_name', 'pos', 'from_team', 'to_team',
  'sort_date', 'date_str', 'detail', 'ingested_at',
];

function normalizeKeyPart(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’.]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Stable identity for one normalized transaction. source_key already embeds
// the ESPN item date, team, and full description; type + player + direction
// distinguish multiple moves inside one ESPN item. Identical input (including
// ESPN repeating a player or description on a later scan) hashes identically.
function computeTxId(row) {
  const canonical = [
    row.source,
    row.source_id || '',
    row.type,
    row.sort_date || '',
    normalizeKeyPart(row.player_name),
    row.from_team,
    row.to_team,
    row.source_key || row.detail || '',
  ].join('|');
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function validatePersistInput(rows) {
  const errors = [];
  if (!Array.isArray(rows)) return { valid: false, errors: ['rows must be an array'] };
  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      errors.push(`row ${index}: must be an object`);
      return;
    }
    for (const field of ['source', 'type', 'player_name', 'from_team', 'to_team', 'sort_date']) {
      if (typeof row[field] !== 'string' || row[field].trim() === '') {
        errors.push(`row ${index}: ${field} is required and must be a non-empty string`);
      }
    }
  });
  return { valid: errors.length === 0, errors };
}

async function persistTransactions(rows, client, { now = new Date().toISOString(), sourceUrl = '' } = {}) {
  const check = validatePersistInput(rows);
  if (!check.valid) {
    throw new Error(`refusing to persist malformed rows: ${check.errors.join('; ')}`);
  }

  // Attach identity + provenance per row; drop intra-batch duplicates (ESPN can
  // repeat the same player or description inside one scan).
  const seen = new Set();
  const pending = [];
  let duplicatesSkipped = 0;
  for (const row of rows) {
    const txId = computeTxId(row);
    if (seen.has(txId)) {
      duplicatesSkipped += 1;
      continue;
    }
    seen.add(txId);
    const out = { tx_id: txId, source_url: sourceUrl, ingested_at: now };
    for (const f of PERSISTED_FIELDS) {
      if (f === 'tx_id' || f === 'source_url' || f === 'ingested_at') continue;
      if (row[f] !== undefined && row[f] !== null) out[f] = row[f];
    }
    pending.push(out);
  }

  const txIds = pending.map(r => r.tx_id);
  const existing = txIds.length
    ? new Set(await client.fetchExistingTxIds(txIds))
    : new Set();
  const toInsert = pending.filter(r => !existing.has(r.tx_id));

  if (toInsert.length > 0) {
    await client.insertRows(toInsert);
  }

  return {
    total: rows.length,
    duplicates_skipped: duplicatesSkipped,
    already_present: existing.size,
    inserted: toInsert.length,
  };
}

// Real client: postgrest select + bulk insert over fetch. URL and key come
// from the caller (CLI resolves them from the environment); nothing is hardcoded
// to a live project beyond the conventional default REST endpoint.
function makeSupabaseClient({ url, anonKey, fetchImpl = fetch } = {}) {
  if (!url) throw new Error('Supabase client requires a REST url');
  if (!anonKey) throw new Error('Supabase client requires an anon key');
  const base = url.replace(/\/+$/, '');
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'content-type': 'application/json',
  };

  return {
    async fetchExistingTxIds(txIds) {
      const inList = txIds.join(',');
      const res = await fetchImpl(
        `${base}/${TRANSACTIONS_TABLE}?select=tx_id&tx_id=in.(${encodeURIComponent(inList)})`,
        { headers: { ...headers, 'content-type': undefined } });
      if (!res.ok) {
        throw new Error(`Supabase select failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
      }
      const rows = await res.json();
      return rows.map(r => r.tx_id).filter(Boolean);
    },

    async insertRows(rows) {
      const res = await fetchImpl(`${base}/${TRANSACTIONS_TABLE}`, {
        method: 'POST',
        headers: { ...headers, prefer: 'return=minimal' },
        body: JSON.stringify(rows),
      });
      if (!res.ok) {
        throw new Error(`Supabase insert failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
      }
    },
  };
}

module.exports = {
  DEFAULT_SUPABASE_URL,
  computeTxId,
  persistTransactions,
  makeSupabaseClient,
};
