// Hermetic tests for the ESPN persistence boundary.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const UPDATER = path.join(__dirname, 'update_rosters_from_espn.js');
const { loadEspnItems, normalizeEspnTransactions, processTransactions } = require(UPDATER);
const { computeTxId, makePayload, persistTransactions, makeSupabaseClient } = require('./espn_transaction_persistence.js');

const ESPN_ITEMS = [
  { id: 'espn-trade-1', date: '2026-08-10T07:00Z', team: { displayName: 'New England Patriots' }, description: 'Traded OL Caedan Wallace and a 2029 seventh-round pick to Miami in exchange for a 2028 sixth-round pick.' },
  { id: 'espn-sign-1', date: '2026-08-12T07:00Z', team: { displayName: 'Atlanta Falcons' }, description: 'Signed WR Kristian Wilkerson to a contract. Released LB Troy Andersen.' },
  { id: 'espn-unsupported-1', date: '2026-08-12T07:00Z', team: { displayName: 'Dallas Cowboys' }, description: 'Announced a coaching change.' },
  { id: 'espn-dup-1', date: '2026-08-29T07:00Z', team: { displayName: 'Pittsburgh Steelers' }, description: 'Released DB Tamon Lynum. Released DB Tamon Lynum.' },
];
const EXPECTED_ROWS = 4;

function fakeClient({ delay = 0 } = {}) {
  const store = new Map();
  return {
    store,
    async insertRows(rows) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      const inserted = [];
      for (const row of rows) {
        if (!store.has(row.tx_id)) {
          store.set(row.tx_id, row);
          inserted.push(row);
        }
      }
      return inserted;
    },
  };
}

test('same normalized transaction keeps identity when ESPN id and wording change', () => {
  const [first] = normalizeEspnTransactions([ESPN_ITEMS[0]]);
  const [second] = normalizeEspnTransactions([{
    ...ESPN_ITEMS[0],
    id: 'mutable-id',
    description: 'Traded OL Caedan Wallace to Miami for a 2028 sixth-round pick.',
  }]);
  assert.equal(first.source_date, '2026-08-10T07:00Z');
  assert.equal(computeTxId(first), computeTxId(second));
});

test('dry-run performs no persistence writes and only writes the inspect artifact', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'espn-dryrun-'));
  try {
    const client = fakeClient();
    const outputPath = path.join(dir, 'espn_transactions_2026.json');
    const result = await processTransactions({ items: ESPN_ITEMS, mode: 'dry', client, outputPath });
    assert.equal(result.record_count, EXPECTED_ROWS);
    assert.equal(client.store.size, 0);
    assert.ok(fs.existsSync(outputPath));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('one repeated input inserts once and then reports conflicts without a prefetch', async () => {
  const client = fakeClient();
  const first = await processTransactions({ items: ESPN_ITEMS, mode: 'write', client });
  assert.equal(first.inserted, EXPECTED_ROWS);
  const second = await processTransactions({ items: ESPN_ITEMS, mode: 'write', client });
  assert.equal(second.inserted, 0);
  assert.equal(second.already_present, EXPECTED_ROWS);
  assert.equal(client.store.size, EXPECTED_ROWS);
});

test('payload gives every row identical keys and nulls absent optional fields', () => {
  const row = normalizeEspnTransactions([ESPN_ITEMS[1]])[0];
  const { payload } = makePayload([row, { ...row, player_name: 'Other', source_id: undefined, detail: undefined }], { now: '2026-09-03T00:00:00.000Z', sourceUrl: 'https://espn.example/feed' });
  assert.equal(new Set(payload.map(item => Object.keys(item).join('|'))).size, 1);
  assert.equal(payload[1].source_id, null);
  assert.equal(payload[1].detail, null);
});

test('concurrent duplicate writes are safe at the persistence boundary', async () => {
  const client = fakeClient({ delay: 5 });
  const rows = normalizeEspnTransactions([ESPN_ITEMS[0]]);
  const [a, b] = await Promise.all([
    persistTransactions(rows, client),
    persistTransactions(rows, client),
  ]);
  assert.equal(client.store.size, 1);
  assert.equal(a.inserted + b.inserted, 1);
});

test('real client sends one conflict-ignore request with apikey-only auth', async () => {
  const requests = [];
  const client = makeSupabaseClient({
    url: 'https://project.supabase.co/',
    secretKey: 'sb_secret_test',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 201, json: async () => JSON.parse(options.body) };
    },
  });
  const row = normalizeEspnTransactions([ESPN_ITEMS[0]])[0];
  await persistTransactions([row, { ...row, player_name: 'Other' }], client);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://project.supabase.co/rest/v1/nfl_transactions?on_conflict=tx_id');
  assert.equal(requests[0].options.headers.apikey, 'sb_secret_test');
  assert.equal('Authorization' in requests[0].options.headers, false);
  assert.equal(requests[0].options.headers.Prefer, 'resolution=ignore-duplicates,return=representation,handling=strict');
  const body = JSON.parse(requests[0].options.body);
  assert.equal(new Set(body.map(item => Object.keys(item).join('|'))).size, 1);
  assert.ok(body.every(item => item.source_date === '2026-08-10T07:00Z'));
});

test('real client appends rest endpoint once and reports HTTP failures', async () => {
  const calls = [];
  const client = makeSupabaseClient({
    url: 'https://project.supabase.co/rest/v1', secretKey: 'k',
    fetchImpl: async (url) => { calls.push(url); return { ok: false, status: 503, text: async () => 'offline' }; },
  });
  await assert.rejects(() => client.insertRows([{ tx_id: 'x' }]), /HTTP 503 offline/);
  assert.deepEqual(calls, ['https://project.supabase.co/rest/v1/nfl_transactions?on_conflict=tx_id']);
});

test('write mode requires both project URL and secret key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'espn-cli-credentials-'));
  try {
    const inputPath = path.join(dir, 'input.json');
    fs.writeFileSync(inputPath, JSON.stringify(ESPN_ITEMS));
    for (const [name, value] of [['SUPABASE_URL', ''], ['SUPABASE_SECRET_KEY', '']]) {
      const env = { ...process.env, SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'k' };
      env[name] = value;
      const run = spawnSync(process.execPath, [UPDATER, '--write', '--since', '2026-09-03', '--input', inputPath], { env, encoding: 'utf8' });
      assert.notEqual(run.status, 0);
      assert.match(run.stdout + run.stderr, new RegExp(name));
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('write mode requires an explicit legacy-safe date cutoff', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'espn-cli-cutoff-'));
  try {
    const inputPath = path.join(dir, 'input.json');
    fs.writeFileSync(inputPath, JSON.stringify(ESPN_ITEMS));
    const run = spawnSync(process.execPath, [UPDATER, '--write', '--input', inputPath], {
      env: { ...process.env, SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'k' },
      encoding: 'utf8',
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stdout + run.stderr, /--since/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CLI default (no flags) is a dry run and contacts ESPN only without --input', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'espn-cli-dry-'));
  try {
    const inputPath = path.join(dir, 'input.json');
    fs.writeFileSync(inputPath, JSON.stringify(ESPN_ITEMS));
    const outPath = path.join(dir, 'out.json');
    const run = spawnSync(process.execPath, [UPDATER, '--input', inputPath], { env: { ...process.env, ESPN_OUT_PATH: outPath }, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.ok(fs.existsSync(outPath));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
