// The one thing in sync_scores.js that can silently mismatch a game: the
// ESPN date key. A Sunday-night or Thursday-night kickoff is the NEXT day in
// UTC, so a naive UTC date would query the wrong scoreboard and drop the
// biggest games of the week.
const test = require('node:test');
const assert = require('node:assert');
const { etDate } = require('./sync_scores.js');

test('etDate uses the Eastern-time game date, not the UTC date', () => {
  assert.strictEqual(etDate('2026-09-14T00:20:00Z'), '20260913'); // SNF
  assert.strictEqual(etDate('2026-09-10T00:20:00Z'), '20260909'); // kickoff game
  assert.strictEqual(etDate('2026-09-13T17:00:00Z'), '20260913'); // Sunday 1pm
  assert.strictEqual(etDate('not a date'), null);
});
