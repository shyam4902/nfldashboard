// Persistence boundary for normalized ESPN transactions.
'use strict';

const crypto = require('node:crypto');

const TRANSACTIONS_TABLE = 'nfl_transactions';
const PERSISTED_FIELDS = [
  'tx_id', 'source', 'source_url', 'source_id', 'source_key', 'source_date',
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

// ESPN IDs and descriptions can change while the transaction itself does not.
// Keep identity tied only to source, exact source timestamp, normalized move,
// and both ends of the move.
function computeTxId(row) {
  const canonical = [
    normalizeKeyPart(row.source),
    row.source_date,
    row.type,
    normalizeKeyPart(row.player_name),
    normalizeKeyPart(row.from_team),
    normalizeKeyPart(row.to_team),
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
    for (const field of ['source', 'source_date', 'type', 'player_name', 'from_team', 'to_team', 'sort_date']) {
      if (typeof row[field] !== 'string' || row[field].trim() === '') {
        errors.push(`row ${index}: ${field} is required and must be a non-empty string`);
      }
    }
    if (typeof row.source_date === 'string' && Number.isNaN(Date.parse(row.source_date))) {
      errors.push(`row ${index}: source_date must be a valid timestamp`);
    }
  });
  return { valid: errors.length === 0, errors };
}

function makePayload(rows, { now, sourceUrl }) {
  const seen = new Set();
  const payload = [];
  let duplicatesSkipped = 0;
  for (const row of rows) {
    const txId = computeTxId(row);
    if (seen.has(txId)) {
      duplicatesSkipped += 1;
      continue;
    }
    seen.add(txId);
    const out = Object.fromEntries(PERSISTED_FIELDS.map(field => [field, null]));
    out.tx_id = txId;
    out.source_url = sourceUrl || null;
    out.ingested_at = now;
    for (const field of PERSISTED_FIELDS) {
      if (field !== 'tx_id' && field !== 'source_url' && field !== 'ingested_at') {
        out[field] = row[field] ?? null;
      }
    }
    payload.push(out);
  }
  return { payload, duplicatesSkipped };
}

async function persistTransactions(rows, client, { now = new Date().toISOString(), sourceUrl = '' } = {}) {
  const check = validatePersistInput(rows);
  if (!check.valid) throw new Error(`refusing to persist malformed rows: ${check.errors.join('; ')}`);
  const { payload, duplicatesSkipped } = makePayload(rows, { now, sourceUrl });
  const inserted = payload.length ? await client.insertRows(payload) : [];
  return {
    total: rows.length,
    duplicates_skipped: duplicatesSkipped,
    already_present: payload.length - inserted.length,
    inserted: inserted.length,
  };
}

function restUrl(url) {
  const base = String(url || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('Supabase client requires a project URL');
  return /\/rest\/v1$/i.test(base) ? base : `${base}/rest/v1`;
}

function makeSupabaseClient({ url, secretKey, fetchImpl = fetch } = {}) {
  if (!url) throw new Error('Supabase client requires a project URL');
  if (!secretKey) throw new Error('Supabase client requires a secret key');
  const base = restUrl(url);
  const headers = {
    apikey: secretKey,
    'content-type': 'application/json',
  };
  if (!secretKey.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${secretKey}`;
  }

  return {
    async insertRows(rows) {
      const res = await fetchImpl(`${base}/${TRANSACTIONS_TABLE}?on_conflict=tx_id`, {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'resolution=ignore-duplicates,return=representation,handling=strict',
        },
        body: JSON.stringify(rows),
      });
      if (!res.ok) {
        throw new Error(`Supabase insert failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
      }
      const inserted = await res.json();
      if (!Array.isArray(inserted)) throw new Error('Supabase insert returned a non-array representation');
      return inserted;
    },
  };
}

module.exports = {
  computeTxId,
  makePayload,
  persistTransactions,
  makeSupabaseClient,
};
