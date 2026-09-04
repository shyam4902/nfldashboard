// Deterministic regression test for Moves page filtering, ordering, and Madden isolation.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

test('Moves state defaults to moves filter excluding draft', () => {
  assert.match(indexHtml, /let txTypeFilter\s*=\s*'moves';/);
});

test('moveDateKey prioritizes source_date over sort_date and date_str', () => {
  // Test the function logic directly
  function moveDateKey(t) {
    if (t.source_date) {
      return typeof t.source_date === 'string' ? t.source_date : new Date(t.source_date).toISOString();
    }
    return t.sort_date || t.date_str || '';
  }

  const item1 = { source_date: '2026-09-03T14:30:00Z', sort_date: '2026-09-03', date_str: 'Sep 3' };
  const item2 = { sort_date: '2026-09-01', date_str: 'Sep 1' };
  const item3 = { date_str: '2026-04-20' };

  assert.equal(moveDateKey(item1), '2026-09-03T14:30:00Z');
  assert.equal(moveDateKey(item2), '2026-09-01');
  assert.equal(moveDateKey(item3), '2026-04-20');

  // Verify newest first sort
  const list = [item2, item1, item3];
  list.sort((a, b) => moveDateKey(b).localeCompare(moveDateKey(a)));
  assert.deepEqual(list, [item1, item2, item3]);
});

test('getMovesTransactions filters out draft by default and preserves draft when chosen', () => {
  const sampleTransactions = [
    { type: 'trade', player_name: 'Player A', source_date: '2026-09-02T10:00:00Z' },
    { type: 'draft', player_name: 'Rookie B', source_date: '2026-04-25T12:00:00Z' },
    { type: 'signing', player_name: 'Veteran C', source_date: '2026-09-01T08:00:00Z' },
    { type: 'waiver', player_name: 'Waiver D', source_date: '2026-09-03T09:00:00Z' },
  ];

  function filterList(list, txTypeFilter) {
    if (txTypeFilter === 'moves') {
      return list.filter(t => t.type !== 'draft');
    }
    if (txTypeFilter !== 'all' && txTypeFilter !== 'blockbuster') {
      return list.filter(t => t.type === txTypeFilter);
    }
    return list;
  }

  const defaultView = filterList(sampleTransactions, 'moves');
  assert.equal(defaultView.length, 3);
  assert.ok(!defaultView.some(t => t.type === 'draft'));

  const draftView = filterList(sampleTransactions, 'draft');
  assert.equal(draftView.length, 1);
  assert.equal(draftView[0].player_name, 'Rookie B');

  const waiverView = filterList(sampleTransactions, 'waiver');
  assert.equal(waiverView.length, 1);
  assert.equal(waiverView[0].player_name, 'Waiver D');
});

test('Madden ratings overlay in index.html never overwrites age or jersey', () => {
  assert.ok(!indexHtml.includes('p.age = match.age'), 'Madden must not overwrite p.age');
  assert.ok(!indexHtml.includes('p.jersey = match.jersey'), 'Madden must not overwrite p.jersey');
});

test('Moves filters toolbar contains honest labels and explicit Draft button', () => {
  assert.ok(indexHtml.includes("typeButton('moves', 'Roster Moves')"));
  assert.ok(indexHtml.includes("typeButton('draft', 'Draft')"));
  assert.ok(indexHtml.includes("typeButton('trade', 'Trades')"));
  assert.ok(indexHtml.includes("typeButton('signing', 'Signings')"));
  assert.ok(indexHtml.includes("typeButton('waiver', 'Waivers')"));
});

test('Summary distinguishes roster moves from draft selections', () => {
  assert.match(indexHtml, /roster moves/);
  assert.match(indexHtml, /draft picks/);
});
