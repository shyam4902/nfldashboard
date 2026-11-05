// node --test nfl/league-lib.test.mjs
// Inline fixtures in the nfl_standings_2026.json, schedule.json and ESPN
// common/v3 byathlete shapes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pctText, signedText, teamForm, streakValue, compareTeams, conferenceSeeds,
  sortRows, squarify, parseNflLeaderLines, statText,
} from './league-lib.js';

test('pctText and signedText format real values and dash missing ones', () => {
  assert.equal(pctText(0.857), '.857');
  assert.equal(pctText(1), '1.000');
  assert.equal(pctText(0), '.000');
  assert.equal(pctText(null), '—');
  assert.equal(signedText(52), '+52');
  assert.equal(signedText(-18), '-18');
  assert.equal(signedText(0), '0');
  assert.equal(signedText(undefined), '—');
});

const g = (week, away, home, as, hs, kickoff, extra = {}) => ({
  game_id: `${week}-${away}-${home}`, week, away_team: away, home_team: home,
  away_score: as, home_score: hs, kickoff_utc: kickoff, status: 'final',
  winner: as > hs ? away : hs > as ? home : 'TIE', ...extra,
});

const GAMES = [
  g(1, 'Bills', 'Jets', 20, 10, '2026-09-13T17:00:00Z'),
  g(2, 'Dolphins', 'Bills', 24, 17, '2026-09-20T17:00:00Z'),
  g(3, 'Bills', 'Patriots', 27, 27, '2026-09-27T17:00:00Z'),
  g(4, 'Jets', 'Bills', 3, 30, '2026-10-04T17:00:00Z'),
  g(5, 'Bills', 'Dolphins', 21, 14, '2026-10-11T17:00:00Z'),
  // Played after the standings were built: not counted.
  g(6, 'Patriots', 'Bills', 31, 7, '2026-10-19T00:15:00Z'),
  // Not final: ignored.
  { game_id: 'x', week: 7, away_team: 'Bills', home_team: 'Jets', kickoff_utc: '2026-10-25T17:00:00Z' },
];

test('teamForm reads streak and last five up to the standings cutoff', () => {
  const form = teamForm(GAMES, 'Bills', '2026-10-15T12:00:00Z', { wins: 3, losses: 1, ties: 1 });
  assert.deepEqual(form, { streak: 'W2', last5: '3-1-1', results: ['W', 'W', 'T', 'L', 'W'] });
});

test('teamForm withholds form when the schedule disagrees with the standings record', () => {
  assert.equal(teamForm(GAMES, 'Bills', '2026-10-15T12:00:00Z', { wins: 4, losses: 1, ties: 1 }), null);
  // Without the cutoff the late loss counts, so the record no longer matches.
  assert.equal(teamForm(GAMES, 'Bills', null, { wins: 3, losses: 1, ties: 1 }), null);
  assert.deepEqual(teamForm(GAMES, 'Bills', null, { wins: 3, losses: 2, ties: 1 }).streak, 'L1');
});

test('teamForm gives an empty form for a team with no finals', () => {
  assert.deepEqual(teamForm(GAMES, 'Chiefs', '2026-10-15T12:00:00Z', { wins: 0, losses: 0, ties: 0 }),
    { streak: '', last5: '', results: [] });
});

test('streakValue orders wins above ties above losses', () => {
  assert.equal(streakValue('W3'), 3);
  assert.equal(streakValue('T1'), 0);
  assert.equal(streakValue('L2'), -2);
  assert.equal(streakValue(''), null);
  assert.equal(streakValue('—'), null);
});

const team = (abbr, division, conference, w, l, pct, diff, pf = 100) => ({
  team: abbr + ' team', abbr, division, conference, wins: w, losses: l, ties: 0,
  win_pct: pct, differential: diff, points_for: pf,
});

test('compareTeams sorts by pct, then differential, then points, null pct last', () => {
  const rows = [
    team('A', 'X', 'AFC', 4, 4, 0.5, 10),
    team('B', 'X', 'AFC', 0, 0, null, 0),
    team('C', 'X', 'AFC', 5, 3, 0.625, -5),
    team('D', 'X', 'AFC', 4, 4, 0.5, 30),
    team('E', 'X', 'AFC', 4, 4, 0.5, 30, 140),
  ];
  assert.deepEqual(rows.slice().sort(compareTeams).map((t) => t.abbr), ['C', 'E', 'D', 'A', 'B']);
});

test('conferenceSeeds puts division leaders 1-4 and the rest from 5', () => {
  const divisions = [
    { conference: 'AFC', division: 'East', teams: [team('E1', 'East', 'AFC', 6, 1, 0.857, 50), team('E2', 'East', 'AFC', 6, 2, 0.75, 40)] },
    { conference: 'AFC', division: 'North', teams: [team('N1', 'North', 'AFC', 4, 4, 0.5, 0), team('N2', 'North', 'AFC', 1, 7, 0.125, -90)] },
    { conference: 'AFC', division: 'South', teams: [team('S1', 'South', 'AFC', 5, 3, 0.625, 5)] },
    { conference: 'AFC', division: 'West', teams: [team('W2', 'West', 'AFC', 5, 3, 0.625, 1), team('W1', 'West', 'AFC', 5, 3, 0.625, 20)] },
    { conference: 'NFC', division: 'East', teams: [team('X', 'East', 'NFC', 8, 0, 1, 99)] },
  ];
  const seeds = conferenceSeeds(divisions, 'AFC');
  assert.deepEqual(seeds.map((t) => t.abbr), ['E1', 'W1', 'S1', 'N1', 'E2', 'W2', 'N2']);
  assert.deepEqual(seeds.map((t) => t.seed), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(seeds.map((t) => t.divisionLeader), [true, true, true, true, false, false, false]);
  assert.deepEqual(conferenceSeeds(divisions, 'XFL'), []);
  assert.deepEqual(conferenceSeeds(null, 'AFC'), []);
});

test('sortRows is stable, flips direction and keeps missing values last', () => {
  const rows = [{ n: 'a', v: 2 }, { n: 'b', v: null }, { n: 'c', v: 5 }, { n: 'd', v: 2 }];
  const read = (row, key) => row[key];
  assert.deepEqual(sortRows(rows, 'v', 'desc', read).map((r) => r.n), ['c', 'a', 'd', 'b']);
  assert.deepEqual(sortRows(rows, 'v', 'asc', read).map((r) => r.n), ['a', 'd', 'c', 'b']);
  assert.deepEqual(sortRows(rows, 'n', 'asc', read).map((r) => r.n), ['a', 'b', 'c', 'd']);
  assert.deepEqual(sortRows(null, 'v', 'asc', read), []);
});

test('squarify fills the box with areas in proportion and drops empty items', () => {
  const out = squarify([{ id: 'a', v: 6 }, { id: 'b', v: 3 }, { id: 'c', v: 1 }, { id: 'z', v: 0 }], 0, 0, 100, 50);
  assert.deepEqual(out.map((r) => r.id), ['a', 'b', 'c']);
  const area = (id) => { const r = out.find((x) => x.id === id); return r.w * r.h; };
  assert.ok(Math.abs(area('a') - 3000) < 1e-6);
  assert.ok(Math.abs(area('b') - 1500) < 1e-6);
  assert.ok(Math.abs(area('c') - 500) < 1e-6);
  for (const r of out) {
    assert.ok(r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= 100 + 1e-9 && r.y + r.h <= 50 + 1e-9);
  }
  assert.deepEqual(squarify([], 0, 0, 10, 10), []);
  assert.deepEqual(squarify([{ v: 1 }], 0, 0, 0, 10), []);
});

const BYATHLETE = {
  categories: [
    { name: 'general', names: ['fumbles', 'gamesPlayed'] },
    { name: 'passing', names: ['completions', 'passingAttempts', 'passingYards', 'passingTouchdowns', 'interceptions'] },
    { name: 'rushing', names: ['rushingAttempts', 'rushingYards'] },
  ],
  athletes: [
    {
      athlete: { id: '10', displayName: 'Second Passer', teamShortName: 'WSH', position: { abbreviation: 'QB' }, headshot: { href: 'https://a.espncdn.com/x/10.png' } },
      categories: [
        { name: 'general', totals: ['1', '7'] },
        { name: 'passing', totals: ['150', '230', '1,700', '11', '4'] },
        { name: 'rushing', totals: ['20', '80'] },
      ],
    },
    {
      athlete: { id: '11', displayName: 'Top Passer', teamShortName: 'DAL', position: { abbreviation: 'QB' } },
      categories: [
        { name: 'general', totals: ['0', '7'] },
        { name: 'passing', totals: ['178', '273', '1851', '13', '5'] },
      ],
    },
    { athlete: { id: '12', displayName: 'No Passing' }, categories: [{ name: 'rushing', totals: ['5', '9'] }] },
  ],
};

const COLS = [
  { key: 'gp', cat: 'general', name: 'gamesPlayed' },
  { key: 'cmp', cat: 'passing', name: 'completions' },
  { key: 'rate', cat: 'passing', name: 'QBRating' },
  { key: 'rush', cat: 'rushing', name: 'rushingYards' },
];

test('parseNflLeaderLines ranks by the board stat and reads the season line', () => {
  const rows = parseNflLeaderLines(BYATHLETE, 'passing', 'passingYards', COLS);
  assert.deepEqual(rows.map((r) => [r.rank, r.id, r.value]), [[1, '11', 1851], [2, '10', 1700]]);
  assert.equal(rows[1].teamAbbr, 'WAS');
  assert.equal(rows[0].pos, 'QB');
  assert.equal(rows[1].headshot, 'https://a.espncdn.com/x/10.png');
  // QBRating is not in the payload, so it is never filled in.
  assert.deepEqual(rows[0].line, { gp: 7, cmp: 178 });
  assert.deepEqual(rows[1].line, { gp: 7, cmp: 150, rush: 80 });
});

test('parseNflLeaderLines returns nothing for an unknown stat and honours limit', () => {
  assert.deepEqual(parseNflLeaderLines(BYATHLETE, 'passing', 'nope', COLS), []);
  assert.deepEqual(parseNflLeaderLines(null, 'passing', 'passingYards', COLS), []);
  assert.equal(parseNflLeaderLines(BYATHLETE, 'passing', 'passingYards', COLS, 1).length, 1);
});

test('statText shows counts with separators and rates with one decimal', () => {
  assert.equal(statText(1851), '1,851');
  assert.equal(statText(65.24), '65.2');
  assert.equal(statText(null), '—');
});
