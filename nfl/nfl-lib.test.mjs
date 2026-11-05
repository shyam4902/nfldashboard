// node --test nfl/nfl-lib.test.mjs
// Small inline fixtures in the ESPN common/v3 and committed-artifact shapes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localAbbr, normName, parseNflSearch, matchSearchPlayer, parseNflAthlete,
  parseNflOverview, parseNflGameLog, orderGroups, heroStats, isFinalGame,
  pickDefaultGame, lastResults, headToHead, compareRows, teamLook, separateLooks,
  recordText, teamSchedule, teamSplits, teamStatCells, parseEspnRoster, attachEspnIds, sortRoster,
} from './nfl-lib.js';

test('localAbbr maps ESPN and nflverse codes to the site team table', () => {
  assert.equal(localAbbr('WSH'), 'WAS');
  assert.equal(localAbbr('la'), 'LAR');
  assert.equal(localAbbr('JAC'), 'JAX');
  assert.equal(localAbbr('KC'), 'KC');
  assert.equal(localAbbr(null), '');
});

test('normName drops punctuation, accents and suffixes', () => {
  assert.equal(normName('D.J. Moore Jr.'), 'dj moore');
  assert.equal(normName('DJ Moore'), 'dj moore');
  assert.equal(normName("Ja'Marr Chase"), 'jamarr chase');
  assert.equal(normName('Kenneth Walker III'), 'kenneth walker');
  assert.equal(normName('José Ramírez'), 'jose ramirez');
  assert.equal(normName(''), '');
});

const SEARCH = {
  items: [
    { id: '1', type: 'player', league: 'nfl', displayName: 'DJ Moore', teamRelationships: [{ type: 'team', core: { abbreviation: 'CHI' } }], headshot: { href: 'https://a.espncdn.com/i/headshots/nfl/players/full/1.png' } },
    { id: '2', type: 'player', league: 'nfl', displayName: 'D.J. Moore', teamRelationships: [{ type: 'team', core: { abbreviation: 'WSH' } }] },
    { id: '3', type: 'player', league: 'nba', displayName: 'DJ Moore' },
    { id: '4', type: 'team', league: 'nfl', displayName: 'Chicago Bears' },
    { id: '', type: 'player', league: 'nfl', displayName: 'No Id' },
  ],
};

test('parseNflSearch keeps NFL players only', () => {
  const rows = parseNflSearch(SEARCH);
  assert.deepEqual(rows.map((r) => r.id), ['1', '2']);
  assert.equal(rows[1].teamAbbr, 'WAS');
  assert.equal(rows[0].headshot, 'https://a.espncdn.com/i/headshots/nfl/players/full/1.png');
  assert.deepEqual(parseNflSearch({}), []);
});

test('matchSearchPlayer prefers the same team and refuses ambiguity', () => {
  const rows = parseNflSearch(SEARCH);
  assert.equal(matchSearchPlayer(rows, 'D.J. Moore', 'CHI').id, '1');
  assert.equal(matchSearchPlayer(rows, 'DJ Moore', 'WAS').id, '2');
  assert.equal(matchSearchPlayer(rows, 'DJ Moore', 'BUF'), null, 'two same-name players, neither on BUF');
  assert.equal(matchSearchPlayer(rows.slice(0, 1), 'DJ Moore', 'BUF').id, '1', 'one same-name result is accepted');
  assert.equal(matchSearchPlayer(rows, 'Someone Else', 'CHI'), null);
  assert.equal(matchSearchPlayer(rows, '', 'CHI'), null);
});

test('parseNflAthlete reads the hero fields', () => {
  const a = parseNflAthlete({
    athlete: {
      id: '77', displayName: 'Test Passer', jersey: '9', position: { abbreviation: 'QB', displayName: 'Quarterback' },
      displayHeight: "6' 3\"", displayWeight: '220 lbs', age: 27, experience: { years: 0 },
      college: { name: 'State' }, status: { name: 'Active' }, headshot: { href: 'h.png' },
      team: { id: '28', abbreviation: 'WSH', displayName: 'Washington Commanders' },
    },
  });
  assert.equal(a.id, '77');
  assert.equal(a.pos, 'QB');
  assert.equal(a.experience, 'Rookie');
  assert.equal(a.team.abbr, 'WAS');
  assert.equal(a.college, 'State');
  const empty = parseNflAthlete({});
  assert.equal(empty.name, '');
  assert.equal(empty.age, null);
});

const OVERVIEW = {
  statistics: {
    labels: ['CMP', 'ATT', 'YDS', 'TD', 'INT', 'RTG'],
    names: ['completions', 'passingAttempts', 'passingYards', 'passingTouchdowns', 'interceptions', 'QBRating'],
    splits: [
      { displayName: 'Regular Season', stats: ['150', '230', '1,812', '12', '', '101.4'] },
      { displayName: 'Career', stats: ['900', '1400', '10,100', '70', '25', '95.0'] },
    ],
  },
};

test('parseNflOverview keeps season and career aligned to columns', () => {
  const o = parseNflOverview(OVERVIEW);
  assert.equal(o.columns.length, 6);
  assert.deepEqual(o.columns[2], { label: 'YDS', name: 'passingYards' });
  assert.equal(o.season[2], '1,812');
  assert.equal(o.season[4], null, 'blank stays missing');
  assert.equal(o.career[3], '70');
  const none = parseNflOverview({});
  assert.deepEqual(none, { columns: [], season: null, career: null });
});

test('heroStats picks position keys and skips missing values', () => {
  const o = parseNflOverview(OVERVIEW);
  assert.deepEqual(heroStats(o, 'QB').map((t) => t.label), ['YDS', 'TD', 'RTG']);
  // A corner with passing columns has no key match: first columns with values.
  assert.deepEqual(heroStats(o, 'CB').map((t) => t.label), ['CMP', 'ATT', 'YDS', 'TD', 'RTG']);
  assert.deepEqual(heroStats({ columns: [], season: null }, 'QB'), []);
});

const GAMELOG = {
  labels: ['CMP', 'YDS', 'TD', 'CAR', 'YDS', 'TD'],
  names: ['completions', 'passingYards', 'passingTouchdowns', 'rushingAttempts', 'rushingYards', 'rushingTouchdowns'],
  categories: [{ name: 'passing', displayName: 'Passing', count: 3 }, { name: 'rushing', displayName: 'Rushing', count: 3 }],
  events: {
    e1: { week: 1, gameDate: '2026-09-13T17:00:00.000+00:00', atVs: 'vs', opponent: { abbreviation: 'WSH' }, gameResult: 'W', score: '24-17' },
    e2: { week: 2, gameDate: '2026-09-20T17:00:00.000+00:00', atVs: '@', opponent: { abbreviation: 'LA' }, gameResult: 'L', score: '10-20' },
    p1: { week: 1, gameDate: '2026-08-10T17:00:00.000+00:00', atVs: 'vs', opponent: { abbreviation: 'NE' }, gameResult: 'W', score: '3-0' },
  },
  seasonTypes: [
    {
      displayName: '2026 Regular Season',
      categories: [{ events: [{ eventId: 'e1', stats: ['20', '250', '2', '3', '12', '0'] }, { eventId: 'e2', stats: ['18', '190', '0', '5', '', '1'] }, { eventId: 'missing', stats: [] }] }],
      summary: { stats: [{ type: 'avg', stats: [] }, { type: 'total', stats: ['38', '440', '2', '8', '12', '1'] }] },
    },
    { displayName: '2026 Preseason', categories: [{ events: [{ eventId: 'p1', stats: ['5', '40', '0', '1', '2', '0'] }] }] },
    { displayName: 'Empty', categories: [] },
  ],
};

test('parseNflGameLog groups columns and splits season types', () => {
  const log = parseNflGameLog(GAMELOG);
  assert.deepEqual(log.groups.map((g) => [g.name, g.start, g.count]), [['passing', 0, 3], ['rushing', 3, 3]]);
  assert.deepEqual(log.seasons.map((s) => s.name), ['2026 Regular Season', '2026 Preseason']);
  const reg = log.seasons[0];
  assert.deepEqual(reg.games.map((g) => g.id), ['e2', 'e1'], 'newest first, unknown event dropped');
  assert.equal(reg.games[0].opponentAbbr, 'LAR');
  assert.equal(reg.games[0].stats[4], null);
  assert.equal(reg.games[1].stats[1], '250');
  assert.equal(reg.totals[1], '440');
  assert.equal(log.seasons[1].totals, null);
});

test('parseNflGameLog falls back to one group when counts do not add up', () => {
  const log = parseNflGameLog({ ...GAMELOG, categories: [{ name: 'passing', count: 2 }] });
  assert.deepEqual(log.groups, [{ name: '', label: '', count: 6 }]);
  assert.deepEqual(parseNflGameLog({}), { columns: [], groups: [], seasons: [] });
});

test('orderGroups leads with the position group', () => {
  const groups = parseNflGameLog(GAMELOG).groups;
  assert.deepEqual(orderGroups(groups, 'RB').map((g) => g.name), ['rushing', 'passing']);
  assert.deepEqual(orderGroups(groups, 'QB').map((g) => g.name), ['passing', 'rushing']);
  assert.deepEqual(orderGroups(groups, 'LS').map((g) => g.name), ['passing', 'rushing']);
});

const GAMES = [
  { game_id: 'g1', week: 1, away_team: 'A', home_team: 'B', kickoff_utc: '2026-09-10T00:20:00Z', status: 'final', winner: 'B', away_score: 10, home_score: 13 },
  { game_id: 'g2', week: 2, away_team: 'C', home_team: 'A', kickoff_utc: '2026-09-17T17:00:00Z', winner: 'A', away_score: 7, home_score: 21 },
  { game_id: 'g3', week: 3, away_team: 'A', home_team: 'D', kickoff_utc: '2026-09-24T17:00:00Z', away_score: 17, home_score: 17, status: 'final' },
  { game_id: 'g4', week: 9, away_team: 'B', home_team: 'A', kickoff_utc: '2026-11-08T18:00:00Z', winner: null, away_score: null, home_score: null },
  { game_id: 'g5', week: 9, away_team: 'C', home_team: 'D', kickoff_utc: '2026-11-06T01:15:00Z', winner: null, away_score: null, home_score: null },
];

test('isFinalGame needs both scores', () => {
  assert.equal(isFinalGame(GAMES[0]), true);
  assert.equal(isFinalGame(GAMES[1]), true, 'a winner with scores counts');
  assert.equal(isFinalGame(GAMES[3]), false);
});

test('pickDefaultGame takes the first kickoff of the week', () => {
  assert.equal(pickDefaultGame(GAMES, 9).game_id, 'g5');
  assert.equal(pickDefaultGame(GAMES, 12, Date.parse('2026-09-15T00:00:00Z')).game_id, 'g2');
  assert.equal(pickDefaultGame(GAMES, 12, Date.parse('2027-01-01T00:00:00Z')).game_id, 'g4');
  assert.equal(pickDefaultGame([], 9), null);
});

test('lastResults reads results from the team side, newest first', () => {
  const rows = lastResults(GAMES, 'A');
  assert.deepEqual(rows.map((r) => [r.id, r.atVs, r.opponent, r.result, r.score]), [
    ['g3', '@', 'D', 'T', '17-17'],
    ['g2', 'vs', 'C', 'W', '21-7'],
    ['g1', '@', 'B', 'L', '10-13'],
  ]);
  assert.equal(lastResults(GAMES, 'A', 1).length, 1);
});

test('headToHead lists both meetings with scores only when final', () => {
  const rows = headToHead(GAMES, 'B', 'A');
  assert.deepEqual(rows.map((r) => [r.id, r.final, r.winner, r.awayScore]), [['g1', true, 'B', 10], ['g4', false, '', null]]);
});

const STANDINGS = [
  { abbr: 'BUF', wins: 6, losses: 1, ties: 0, played: 7, win_pct: 0.857, points_for: 233, points_against: 181, differential: 52 },
  { abbr: 'MIA', wins: 2, losses: 5, ties: 0, played: 7, win_pct: 0.286, points_for: 140, points_against: 200, differential: -60 },
  { abbr: 'LAR', wins: 4, losses: 3, ties: 0, played: 7, win_pct: 0.571, points_for: 170, points_against: 150, differential: 20 },
];
const TOTALS = [
  { abbr: 'BUF', games: 6, pass_yards: 1504, rush_yards: 893, total_yards: 2397, yards_allowed: 2321 },
  { abbr: 'MIA', games: 6, pass_yards: 1200, rush_yards: 600, total_yards: 1800, yards_allowed: 2600 },
];
const EFFICIENCY = [
  { season: 2026, team: 'BUF', side: 'off', epa_per_play: 0.1, success_rate: 0.48, yds_per_play: 6.1, sack_rate: 0.05, turnover_rate: 0.01 },
  { season: 2026, team: 'BUF', side: 'def', epa_per_play: -0.05, success_rate: 0.41, yds_per_play: 5.0, sack_rate: 0.07, turnover_rate: 0.02 },
  { season: 2026, team: 'LA', side: 'off', epa_per_play: 0.2, success_rate: 0.5, yds_per_play: 6.5, sack_rate: 0.04, turnover_rate: 0.01 },
  { season: 2025, team: 'MIA', side: 'off', epa_per_play: 0.3 },
];

test('compareRows builds real rows with ranks and drops empty ones', () => {
  const rows = compareRows('BUF', 'MIA', { standings: STANDINGS, totals: TOTALS, efficiency: EFFICIENCY }, ['BUF', 'MIA', 'LAR']);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.equal(byKey.record.a.text, '6-1');
  assert.equal(byKey.record.lead, 'a');
  assert.equal(byKey.ppg.a.text, '33.3');
  assert.equal(byKey.oppPpg.lead, 'a', 'fewer points allowed is better');
  assert.equal(byKey.diff.b.text, '-8.6');
  assert.equal(byKey.ypg.a.text, '399.5');
  assert.equal(byKey.ypg.a.of, 2, 'LAR has no totals row');
  // Off EPA: MIA has only a 2025 row, so its value is missing, not 0.3.
  assert.equal(byKey.offEpa.b.value, null);
  assert.equal(byKey.offEpa.b.text, '—');
  assert.equal(byKey.offEpa.a.rank, 2, 'LA (Rams) ranks first on 2026 off EPA');
  assert.equal(byKey.offEpa.lead, '');
  assert.equal(byKey.offSack.a.text, '5.0%');
  assert.deepEqual(byKey.record.share, { a: 1, b: 0.286 / 0.857 });
  const none = compareRows('BUF', 'MIA', { standings: [], totals: [], efficiency: [] }, []);
  assert.deepEqual(none, []);
});

test('teamLook and separateLooks pick readable fills', () => {
  const a = teamLook({ primary_color: '#00338D' });
  assert.equal(a.fill, '#00338d');
  assert.equal(a.ink, '#ffffff');
  assert.equal(teamLook({}).fill, '#3b4261');
  const b = teamLook({ primary_color: '#00338e', secondary_color: '#FFB612' });
  const [, b2] = separateLooks(a, b);
  assert.equal(b2.fill, '#ffb612');
  const c = teamLook({ primary_color: '#C60C30' });
  assert.equal(separateLooks(a, c)[1].fill, '#c60c30');
});

/* ── Team page ──────────────────────────────────────────────────────────── */

const SEASON = [
  { game_id: 'g1', week: 1, kickoff_utc: '2026-09-13T17:00:00Z', away_team: 'Kansas City Chiefs', home_team: 'Denver Broncos', away_score: 20, home_score: 17, status: 'final' },
  { game_id: 'g2', week: 2, kickoff_utc: '2026-09-20T17:00:00Z', away_team: 'Buffalo Bills', home_team: 'Kansas City Chiefs', away_score: 24, home_score: 21, winner: 'Buffalo Bills' },
  { game_id: 'g4', week: 4, kickoff_utc: '2026-10-04T17:00:00Z', away_team: 'Kansas City Chiefs', home_team: 'Las Vegas Raiders', away_score: 10, home_score: 13, status: 'final' },
  { game_id: 'g5', week: 5, kickoff_utc: '2026-10-11T17:00:00Z', away_team: 'Los Angeles Chargers', home_team: 'Kansas City Chiefs', away_score: null, home_score: null, status: 'in_progress' },
  { game_id: 'g6', week: 6, kickoff_utc: '2026-10-18T17:00:00Z', away_team: 'Kansas City Chiefs', home_team: 'Denver Broncos', away_score: null, home_score: null },
  { game_id: 'x', week: 1, kickoff_utc: '2026-09-13T17:00:00Z', away_team: 'Miami Dolphins', home_team: 'New York Jets', away_score: 3, home_score: 7, status: 'final' },
];

test('recordText shows ties only when there are some', () => {
  assert.equal(recordText({ wins: 6, losses: 1, ties: 0 }), '6-1');
  assert.equal(recordText({ w: 4, l: 3, t: 1 }), '4-3-1');
  assert.equal(recordText({ wins: null, losses: 2 }), '');
  assert.equal(recordText(null), '');
});

test('teamSchedule orders games, fills byes and marks the next game', () => {
  const { rows, nextId } = teamSchedule(SEASON, 'Kansas City Chiefs', 6);
  assert.deepEqual(rows.map((r) => (r.bye ? 'bye' + r.week : r.id)), ['g1', 'g2', 'bye3', 'g4', 'g5', 'g6']);
  assert.equal(nextId, 'g5');
  const [g1, g2] = rows;
  assert.deepEqual([g1.atVs, g1.opponent, g1.result, g1.us, g1.them], ['@', 'Denver Broncos', 'W', 20, 17]);
  assert.deepEqual([g2.atVs, g2.result, g2.us, g2.them], ['vs', 'L', 21, 24]);
  assert.equal(rows[4].live, true);
  assert.equal(rows[4].result, '');
  assert.equal(rows[4].us, null);
});

test('teamSchedule adds no byes without a week count or games', () => {
  assert.equal(teamSchedule(SEASON, 'Kansas City Chiefs').rows.length, 5);
  assert.deepEqual(teamSchedule(SEASON, 'Nobody', 18), { rows: [], nextId: '' });
  assert.deepEqual(teamSchedule(null, 'Kansas City Chiefs', 18), { rows: [], nextId: '' });
});

test('teamSplits reads home, road and streak from finals only', () => {
  assert.deepEqual(teamSplits(SEASON, 'Kansas City Chiefs'), { played: 3, home: '0-1', road: '1-1', streak: 'L2', last5: 'WLL' });
  assert.deepEqual(teamSplits(SEASON, 'New York Jets'), { played: 1, home: '1-0', road: '', streak: 'W1', last5: 'W' });
  assert.deepEqual(teamSplits([], 'Kansas City Chiefs'), { played: 0, home: '', road: '', streak: '', last5: '' });
});

test('teamStatCells ranks a team and drops stats it has no number for', () => {
  const data = {
    standings: [
      { abbr: 'KC', played: 2, points_for: 60, points_against: 40, differential: 20 },
      { abbr: 'DEN', played: 2, points_for: 40, points_against: 30, differential: 10 },
      { abbr: 'LV', played: 2, points_for: 30, points_against: 50, differential: -20 },
    ],
    totals: [{ abbr: 'KC', games: 2, total_yards: 700, pass_yards: 500, rush_yards: 200, yards_allowed: 600 }],
    efficiency: [
      { season: 2026, team: 'KC', side: 'def', epa_per_play: -0.1, sack_rate: 0.08, turnover_rate: 0.02 },
      { season: 2026, team: 'DEN', side: 'def', epa_per_play: -0.2, sack_rate: 0.09, turnover_rate: 0.01 },
    ],
  };
  const cells = teamStatCells('KC', data, ['KC', 'DEN', 'LV']);
  const by = Object.fromEntries(cells.map((c) => [c.key, c]));
  assert.equal(by.ppg.text, '30.0');
  assert.deepEqual([by.ppg.rank, by.ppg.of], [1, 3]);
  assert.deepEqual([by.oppPpg.rank, by.oppPpg.text], [2, '20.0']);
  assert.equal(by.diff.text, '+10.0');
  assert.deepEqual([by.ypg.rank, by.ypg.of], [1, 1]);
  assert.deepEqual([by.defEpa.rank, by.defEpa.of], [2, 2]);
  assert.deepEqual([by.defSack.rank, by.defTo.rank], [2, 1]);
  assert.equal(by.offEpa, undefined);
  assert.equal(by.offSr, undefined);
  assert.deepEqual(teamStatCells('NYJ', data, ['KC']), []);
});

test('parseEspnRoster flattens both ESPN roster shapes', () => {
  const grouped = { athletes: [
    { position: 'offense', items: [{ id: '10', fullName: 'Patrick Mahomes', jersey: '15', position: { abbreviation: 'QB' }, headshot: { href: 'h10' } }] },
    { position: 'defense', items: [{ id: '11', displayName: 'Chris Jones', jersey: '95', position: { abbreviation: 'DT' } }, { id: '', fullName: 'No Id' }] },
  ] };
  assert.deepEqual(parseEspnRoster(grouped), [
    { id: '10', name: 'Patrick Mahomes', jersey: '15', pos: 'QB', headshot: 'h10' },
    { id: '11', name: 'Chris Jones', jersey: '95', pos: 'DT', headshot: '' },
  ]);
  const flat = { team: { athletes: [{ id: '12', fullName: 'Travis Kelce', jersey: '87', position: { abbreviation: 'TE' } }] } };
  assert.deepEqual(parseEspnRoster(flat).map((p) => p.id), ['12']);
  assert.deepEqual(parseEspnRoster({}), []);
  assert.deepEqual(parseEspnRoster(null), []);
});

test('attachEspnIds matches by name, uses jersey to split twins, else leaves the id empty', () => {
  const espn = [
    { id: '1', name: 'D.J. Moore Jr.', jersey: '2', headshot: 'h1' },
    { id: '2', name: 'Josh Allen', jersey: '17', headshot: 'h2' },
    { id: '3', name: 'Josh Allen', jersey: '41', headshot: 'h3' },
    { id: '4', name: 'Sam Smith', jersey: '10', headshot: '' },
    { id: '5', name: 'Sam Smith', jersey: '10', headshot: '' },
  ];
  const rows = attachEspnIds([
    { name: 'DJ Moore', num: 2 },
    { name: 'Josh Allen', num: 41 },
    { name: 'Josh Allen', num: null },
    { name: 'Sam Smith', num: 10 },
    { name: 'Unknown Guy', num: 1 },
  ], espn);
  assert.deepEqual(rows.map((r) => r.espnId), ['1', '3', '', '', '']);
  assert.equal(rows[0].headshot, 'h1');
  assert.equal(rows[0].num, 2);
  assert.deepEqual(attachEspnIds([{ name: 'A' }], null).map((r) => r.espnId), ['']);
});

test('sortRoster orders by position group, then jersey', () => {
  const rows = sortRoster([
    { name: 'K1', pos: 'K', num: 7 }, { name: 'WR2', pos: 'WR', num: 88 }, { name: 'QB', pos: 'QB', num: 15 },
    { name: 'WR1', pos: 'WR', num: 10 }, { name: 'X', pos: 'ATH', num: 1 }, { name: 'CB', pos: 'CB', num: null },
  ]);
  assert.deepEqual(rows.map((r) => r.name), ['QB', 'WR1', 'WR2', 'CB', 'K1', 'X']);
});
