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
  normalizeEspnTransactions: collectionNormalizer
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
    from_team: 'New England Patriots', to_team: 'Miami',
    detail: 'Traded OL Caedan Wallace and a 2029 seventh-round pick to Miami in exchange for a 2028 sixth-round pick.',
    date_str: 'Aug 10, 2026', sort_date: '2026-08-10'
  }]);
});

test('normalizes a collection and rejects malformed records', () => {
  const rows = collectionNormalizer([
    { id: 'valid', date: '2026-08-07T07:00Z', team: { displayName: 'Atlanta Falcons' }, description: 'Signed WR Kristian Wilkerson to a contract.' },
    { id: 'unsupported', date: '2026-08-07T07:00Z', team: { displayName: 'Dallas Cowboys' }, description: 'Announced a coaching change.' }
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(validator(rows), { valid: true, errors: [] });
  assert.deepEqual(validator([{ ...rows[0], player_name: '' }]), { valid: false, errors: ['row 0: player_name is required'] });
});

test('skips descriptions with no supported player transaction instead of inventing a row', () => {
  assert.deepEqual(parser('Announced a coaching change.', 'Dallas Cowboys'), []);
});
