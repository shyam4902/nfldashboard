const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, 'update_rosters_from_espn.js');
const scriptSource = fs.readFileSync(scriptPath, 'utf8');
const {
  parseTransactionSentence: parser,
  normalizeEspnTransaction: normalizer,
  validateTransactions: validator,
  normalizeEspnTransactions: collectionNormalizer,
  canonicalTeamName,
  validateDryRunEnvelope
} = require(scriptPath);

test('exports the ESPN parser, normalizer, collection normalizer, and validator', () => {
  assert.equal(typeof parser, 'function');
  assert.equal(typeof normalizer, 'function');
  assert.equal(typeof collectionNormalizer, 'function');
  assert.equal(typeof validator, 'function');
  assert.match(scriptSource, /module\.exports\s*=\s*\{/);
});

test('parses signings and releases from a multi-action ESPN description', () => {
  const moves = parser('Signed WR Kristian Wilkerson to a contract. Released LB Troy Andersen.', 'Atlanta Falcons');
  assert.deepEqual(moves, [
    { type: 'sign', player: 'Kristian Wilkerson', pos: 'WR', team: 'Atlanta Falcons' },
    { type: 'waive', player: 'Troy Andersen', pos: 'LB', team: 'Free Agent' }
  ]);
});

test('parses waiver claims without retaining the source-team suffix in the player name', () => {
  const moves = parser('Claimed LB Yasir Abdullah off waivers from Jacksonville.', 'Las Vegas Raiders');
  assert.deepEqual(moves, [
    { type: 'claim', player: 'Yasir Abdullah', pos: 'LB', team: 'Las Vegas Raiders', fromTeam: 'Jacksonville' }
  ]);
});

test('parses a traded player without treating draft compensation as a player', () => {
  const moves = parser('Traded OL Caedan Wallace and a 2029 seventh-round pick to Miami in exchange for a 2028 sixth-round pick.', 'New England Patriots');
  assert.deepEqual(moves, [
    { type: 'trade', player: 'Caedan Wallace', pos: 'OL', team: 'Miami', fromTeam: 'New England Patriots' }
  ]);
});

test('normalizes an ESPN item into the dashboard transaction shape', () => {
  const normalized = normalizer({
    id: 'espn-1',
    date: '2026-08-10T07:00Z',
    team: { displayName: 'New England Patriots' },
    description: 'Traded OL Caedan Wallace and a 2029 seventh-round pick to Miami in exchange for a 2028 sixth-round pick.'
  });
  assert.deepEqual(normalized, [{
    id: 'espn-1:trade:caedan-wallace', source: 'ESPN', source_id: 'espn-1',
    source_key: '2026-08-10T07:00Z_New England Patriots_Traded OL Caedan Wallace and a 2029 seventh-round pick to Miami in exchange for a 2028 sixth-round pick.',
    type: 'trade', blockbuster: false, player_name: 'Caedan Wallace', pos: 'OL',
    from_team: 'New England Patriots', to_team: 'Miami Dolphins',
    detail: 'Traded OL Caedan Wallace and a 2029 seventh-round pick to Miami in exchange for a 2028 sixth-round pick.',
    date_str: 'Aug 10, 2026', sort_date: '2026-08-10'
  }]);
});

test('canonicalizes ESPN full, abbreviated, and unambiguous short team names', () => {
  assert.equal(canonicalTeamName(' Miami Dolphins '), 'Miami Dolphins');
  assert.equal(canonicalTeamName('MIA'), 'Miami Dolphins');
  assert.equal(canonicalTeamName('Miami'), 'Miami Dolphins');
  assert.equal(canonicalTeamName('JACKSONVILLE'), 'Jacksonville Jaguars');
  assert.equal(canonicalTeamName('Los Angeles'), 'Los Angeles');
});

test('normalizes canonical destination and waiver source names', () => {
  const trade = normalizer({
    id: 'short-team-trade', date: '2026-08-10T07:00Z',
    team: { displayName: 'New England Patriots' },
    description: 'Traded OL Caedan Wallace to Miami for a 2028 sixth-round pick.'
  });
  assert.equal(trade[0].from_team, 'New England Patriots');
  assert.equal(trade[0].to_team, 'Miami Dolphins');

  const claim = normalizer({
    id: 'short-team-claim', date: '2026-08-10T07:00Z',
    team: { displayName: 'Las Vegas Raiders' },
    description: 'Claimed LB Yasir Abdullah off waivers from Jacksonville'
  });
  assert.equal(claim[0].from_team, 'Jacksonville Jaguars');
  assert.equal(claim[0].to_team, 'Las Vegas Raiders');
});

test('normalizes a collection and rejects malformed records', () => {
  const rows = collectionNormalizer([
    { id: 'valid', date: '2026-08-07T07:00Z', team: { displayName: 'Atlanta Falcons' }, description: 'Signed WR Kristian Wilkerson to a contract.' },
    { id: 'unsupported', date: '2026-08-07T07:00Z', team: { displayName: 'Dallas Cowboys' }, description: 'Announced a coaching change.' }
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(validator(rows), { valid: true, errors: [] });
  assert.deepEqual(validator([{ ...rows[0], player_name: '' }]), { valid: false, errors: ['row 0: player_name is required and must be a non-empty string'] });
});

test('rejects invalid transaction types, dates, shapes, and duplicate IDs', () => {
  const valid = {
    id: 'one', source: 'ESPN', source_key: 'key', type: 'trade', player_name: 'Player',
    pos: '', from_team: 'A', to_team: 'B', detail: 'Trade', sort_date: '2026-08-07'
  };
  const result = validator([
    valid,
    { ...valid, id: 'one', source: 'Other', type: 'unknown', sort_date: 'not-a-date' },
    null
  ]);
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    'row 1: id must be unique',
    'row 1: source must be ESPN',
    'row 1: type is unsupported',
    'row 1: sort_date must be YYYY-MM-DD',
    'row 2: must be an object'
  ]);
});

test('validates the dry-run envelope metadata and record count', () => {
  assert.deepEqual(validateDryRunEnvelope({
    source: 'ESPN', source_url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/transactions?limit=250',
    fetched_at: '2026-08-10T07:00:00.000Z', record_count: 1, transactions: [{ id: 'one' }]
  }), { valid: true, errors: [] });
  const result = validateDryRunEnvelope({ source: 'Other', source_url: '', fetched_at: 'not-a-date', record_count: 2, transactions: [] });
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, [
    'source must be ESPN',
    'source_url is required',
    'source_url must match the ESPN transactions URL',
    'fetched_at must be a valid ISO timestamp',
    'record_count must equal transactions.length'
  ]);
});

test('skips descriptions with no supported player transaction instead of inventing a row', () => {
  assert.deepEqual(parser('Announced a coaching change.', 'Dallas Cowboys'), []);
});
