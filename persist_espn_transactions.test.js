// Hermetic tests for the ESPN transaction persistence path. Nothing here
// contacts Supabase, ESPN, or any network: persistence runs against a fake
// in-memory client, and the CLI write-failure path points at a closed
// localhost port. All fixture inputs are committed inline.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const UPDATER = path.join(__dirname, 'update_rosters_from_espn.js');
const {
  processTransactions,
  loadEspnItems,
} = require(UPDATER);
const {
  computeTxId,
  persistTransactions,
  makeSupabaseClient,
} = require('./espn_transaction_persistence.js');

// Two valid ESPN items plus an unsupported description and a player ESPN
// repeats inside one sentence.
const ESPN_ITEMS = [
  {
    id: 'espn-trade-1',
    date: '2026-08-10T07:00Z',
    team: { displayName: 'New England Patriots' },
    description: 'Traded OL Caedan Wallace and a 2029 seventh-round pick to Miami in exchange for a 2028 sixth-round pick.'
  },
  {
    id: 'espn-sign-1',
    date: '2026-08-12T07:00Z',
    team: { displayName: 'Atlanta Falcons' },
    description: 'Signed WR Kristian Wilkerson to a contract. Released LB Troy Andersen.'
  },
  {
    id: 'espn-unsupported-1',
    date: '2026-08-12T07:00Z',
    team: { displayName: 'Dallas Cowboys' },
    description: 'Announced a coaching change.'
  },
  {
    id: 'espn-dup-1',
    date: '2026-08-29T07:00Z',
    team: { displayName: 'Pittsburgh Steelers' },
    description: 'Released DB Tamon Lynum. Released DB Tamon Lynum.'
  },
];

// Supported rows the four items above normalize to: trade (1) + signed/released
// from the Falcons item (2) + the repeated release collapsing to one (1) = 4.
// The unsupported item contributes nothing. Keep EXPECTED_ROWS in lockstep with
// ESPN_ITEMS so a parser change surfaces here as a count failure.
const EXPECTED_ROWS = 4;

function fakeClient() {
  const store = new Map(); // tx_id -> row
  return {
    store,
    fetchExistingTxIds: async (txIds) => txIds.filter((id) => store.has(id)),
    insertRows: async (rows) => { for (const r of rows) store.set(r.tx_id, r); },
  };
}

test('normalized rows for the same ESPN input hash to stable, identical tx_ids', async () => {
  const items = await loadEspnItems({ inputPath: null, fetchImpl: async () => ({ ok: true, json: async () => ({ transactions: ESPN_ITEMS }) }) });
  const { normalizeEspnTransactions } = require(UPDATER);
  const rows = normalizeEspnTransactions(items);
  assert.equal(rows.length, EXPECTED_ROWS, `expected ${EXPECTED_ROWS} supported moves, got ${rows.length}`);
  const first = rows.map(computeTxId);
  const second = rows.map(computeTxId);
  assert.deepEqual(first, second, 'tx_id must be deterministic for identical input');
  assert.equal(new Set(first).size, first.length, 'tx_ids unique within one scan');
});

test('dry-run performs no persistence writes and only writes the inspect artifact', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'espn-dryrun-'));
  try {
    const client = fakeClient();
    const outputPath = path.join(dir, 'espn_transactions_2026.json');
    const result = await processTransactions({ items: ESPN_ITEMS, mode: 'dry', client, outputPath });
    assert.equal(result.mode, 'dry');
    assert.equal(result.record_count, EXPECTED_ROWS); // unsupported and repeated rows excluded
    assert.equal(client.store.size, 0, 'persistence client must never be called in dry-run');
    assert.ok(fs.existsSync(outputPath), 'dry-run writes the inspect artifact');
    const envelope = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.equal(envelope.source, 'ESPN');
    assert.equal(envelope.transactions.length, EXPECTED_ROWS);
    // No roster or processed-log artifact anywhere near the temp tree.
    assert.ok(!fs.existsSync(path.join(dir, 'nfl_rosters_2026.json')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('applying the same input twice creates no duplicates', async () => {
  const client = fakeClient();
  const first = await processTransactions({ items: ESPN_ITEMS, mode: 'write', client });
  assert.equal(first.mode, 'write');
  assert.equal(first.inserted, EXPECTED_ROWS, 'first write inserts every supported row');
  assert.equal(client.store.size, EXPECTED_ROWS);

  const second = await processTransactions({ items: ESPN_ITEMS, mode: 'write', client });
  assert.equal(second.inserted, 0, 'second write inserts nothing');
  assert.equal(second.already_present, EXPECTED_ROWS);
  assert.equal(client.store.size, EXPECTED_ROWS, 'store does not grow on repeat input');
});

test('malformed and unsupported records are skipped before any write', async () => {
  const client = fakeClient();
  const bad = { id: 'bad', date: 'not-a-date', team: {}, description: '' };
  const result = await processTransactions({ items: [...ESPN_ITEMS, bad, { id: 'x', date: '2026-08-01T07:00Z', team: { displayName: 'Chicago Bears' }, description: 'Signed RB David Montgomery to a contract.' }], mode: 'write', client });
  assert.equal(result.inserted, EXPECTED_ROWS + 1); // supported fixtures + the Bears signing; bad + unsupported contribute nothing
  for (const row of client.store.values()) {
    assert.ok(row.player_name && row.type && row.sort_date, 'only fully valid rows reach the client');
    assert.ok(!row.detail.includes('coaching change'));
  }
  assert.equal(client.store.size, result.total);
});

test('persistTransactions refuses malformed rows with an error, not a partial write', async () => {
  const client = fakeClient();
  await assert.rejects(
    () => persistTransactions([{ player_name: 'Only Name' }], client),
    /refusing to persist malformed rows/);
  assert.equal(client.store.size, 0);
});

test('a write failure surfaces as a rejection and the CLI exits nonzero', async () => {
  // Unit level: client throws mid-write.
  const failing = {
    fetchExistingTxIds: async () => [],
    insertRows: async () => { throw new Error('insert rejected (mock)'); },
  };
  await assert.rejects(() => persistTransactions([
    { source: 'ESPN', source_id: '1', source_key: 'k1', type: 'signing', player_name: 'P', from_team: 'A', to_team: 'B', sort_date: '2026-08-01' },
  ], failing), /insert rejected/);

  // CLI level: real fetch-based client pointed at a closed localhost port.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'espn-cli-fail-'));
  try {
    const inputPath = path.join(dir, 'input.json');
    fs.writeFileSync(inputPath, JSON.stringify(ESPN_ITEMS));
    const env = {
      ...process.env,
      SUPABASE_URL: 'http://127.0.0.1:1/rest/v1/', // nothing listens here
      SUPABASE_ANON_KEY: 'test-key',
    };
    const run = spawnSync(process.execPath, [UPDATER, '--write', '--input', inputPath], { env, encoding: 'utf8' });
    assert.notEqual(run.status, 0, `expected nonzero exit, got ${run.status}: ${run.stdout} ${run.stderr}`);
    assert.match(run.stdout + run.stderr, /failed/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CLI default (no flags) is a dry run: no credentials needed, exit 0', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'espn-cli-dry-'));
  try {
    const inputPath = path.join(dir, 'input.json');
    fs.writeFileSync(inputPath, JSON.stringify(ESPN_ITEMS));
    const outPath = path.join(dir, 'out.json');
    const env = { ...process.env, ESPN_OUT_PATH: outPath };
    const run = spawnSync(process.execPath, [UPDATER, '--input', inputPath], { env, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /Dry run/);
    assert.ok(fs.existsSync(outPath));
    const envelope = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.equal(envelope.transactions.length, EXPECTED_ROWS);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('makeSupabaseClient requires credentials and builds postgrest endpoints', () => {
  assert.throws(() => makeSupabaseClient({ url: 'http://x/rest/v1/' }), /anon key/);
  const client = makeSupabaseClient({ url: 'http://x/rest/v1/', anonKey: 'k' });
  assert.equal(typeof client.fetchExistingTxIds, 'function');
  assert.equal(typeof client.insertRows, 'function');
});
