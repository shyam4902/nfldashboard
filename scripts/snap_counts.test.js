'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseCsv, buildSnaps } = require('./build_snap_counts.js');

const HEAD = 'game_id,pfr_game_id,season,game_type,week,player,pfr_player_id,position,team,opponent,offense_snaps,offense_pct,defense_snaps,defense_pct,st_snaps,st_pct';
const line = (g, w, name, id, pos, team, off, def, type = 'REG') =>
  [g, 'x', 2026, type, w, name, id, pos, team, 'OPP', off, 0, def, 0, 0, 0].join(',');

test('parseCsv handles quotes and CRLF', () => {
  const rows = parseCsv('a,b\r\n"x, y",2\r\n');
  assert.deepStrictEqual(rows, [{ a: 'x, y', b: '2' }]);
});

test('shares, last3, weekly, missed games count as 0, LA becomes LAR', () => {
  const csv = [HEAD,
    line('g1', 1, 'Line Man', 'L1', 'T', 'LA', 60, 0),
    line('g1', 1, 'Wide One', 'W1', 'WR', 'LA', 30, 0),
    line('g2', 2, 'Line Man', 'L1', 'T', 'LA', 50, 0),
    line('g3', 4, 'Line Man', 'L1', 'T', 'LA', 70, 0),
    line('g3', 4, 'Wide One', 'W1', 'WR', 'LA', 70, 0),
    line('g4', 5, 'Line Man', 'L1', 'T', 'LA', 40, 0),
    line('g4', 5, 'Wide One', 'W1', 'WR', 'LA', 40, 0),
    line('g4', 5, 'Corner', 'C1', 'CB', 'LA', 0, 65),
    line('p1', 19, 'Line Man', 'L1', 'T', 'LA', 80, 0, 'POST'),
  ].join('\n');
  const a = buildSnaps(parseCsv(csv), { generatedAt: 'T' });
  const t = a.teams.LAR;
  assert.ok(t && !a.teams.LA);
  assert.deepStrictEqual(t.weeks, [1, 2, 4, 5]);
  assert.strictEqual(a.through_week, 5);
  const wr = t.players.find(p => p.name === 'Wide One');
  assert.deepStrictEqual(wr.weekly, [50, 0, 100, 100]);
  assert.strictEqual(wr.season, Math.round(140 / 220 * 100)); // 64
  assert.strictEqual(wr.last3, Math.round(110 / 160 * 100));  // 69
  const cb = t.players.find(p => p.name === 'Corner');
  assert.strictEqual(cb.unit, 'def');
  assert.strictEqual(cb.season, 100);
  assert.strictEqual(t.players.find(p => p.name === 'Line Man').snaps, 220); // POST row ignored
});

test('special-teams-only players are dropped', () => {
  const csv = [HEAD, line('g1', 1, 'QB', 'Q', 'QB', 'KC', 60, 0), line('g1', 1, 'Kicker', 'K', 'K', 'KC', 0, 0)].join('\n');
  const names = buildSnaps(parseCsv(csv)).teams.KC.players.map(p => p.name);
  assert.deepStrictEqual(names, ['QB']);
});
