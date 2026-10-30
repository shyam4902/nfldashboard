import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  etDate,
  parseAthlete,
  parseBoxScore,
  parseGameLog,
  parseLeaders,
  parsePlayerOverview,
  parsePreGame,
  parseRoster,
  parseScoreboard,
  parseSearch,
  parseStandings,
  parseTeamSchedule,
  parseTeamStats,
  shotPct,
  smallImg,
} from './nba.js';

function fixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

test('parseScoreboard reads the 2026-10-22 card', () => {
  const games = parseScoreboard(fixture('scoreboard-20261022.json'));

  assert.equal(games.length, 2);
  for (const game of games) {
    assert.equal(game.state, 'post');
    assert.equal(typeof game.away.score, 'number');
    assert.equal(typeof game.home.score, 'number');
    assert.equal([game.away.winner, game.home.winner].filter(Boolean).length, 1);
  }

  assert.equal(games[0].id, '401909093');
  assert.equal(games[0].away.abbr, 'CLE');
  assert.equal(games[0].home.abbr, 'PHI');
  assert.equal(games[0].statusText, 'Final');
  assert.equal(games[0].home.winner, true);
  assert.equal(games[0].away.winner, false);
});

test('parseScoreboard adds a points leader for each side', () => {
  const games = parseScoreboard(fixture('scoreboard-20261022.json'));

  assert.ok(games.length >= 1);
  for (const game of games) {
    assert.ok(game.leaders, `${game.id} leaders`);
    assert.ok(game.leaders.away && game.leaders.home, `${game.id} both sides`);
    assert.ok(game.leaders.away.name.length > 0, `${game.id} away name`);
    assert.ok(game.leaders.home.name.length > 0, `${game.id} home name`);
    assert.ok(/PTS$/.test(game.leaders.away.line), `${game.id} away line`);
    assert.ok(/PTS$/.test(game.leaders.home.line), `${game.id} home line`);
  }
});

test('parseStandings reads both conferences by stat name', () => {
  const standings = parseStandings(fixture('standings.json'));

  assert.equal(standings.East.length, 15);
  assert.equal(standings.West.length, 15);

  const ids = [...standings.East, ...standings.West].map((row) => row.teamId);
  assert.equal(new Set(ids).size, 30);

  for (const conference of [standings.East, standings.West]) {
    const seeds = conference.map((row) => row.seed);
    // The committed fixture gives several 0-1 teams the same ESPN seed (8), so
    // the shape we can guarantee is 15 rows ranked 1..15, not 15 distinct seeds.
    assert.equal(seeds[0], 1);
    assert.equal(seeds[seeds.length - 1], 15);
    assert.deepEqual([...seeds].sort((a, b) => a - b), seeds);
    for (const seed of seeds) assert.ok(Number.isInteger(seed) && seed >= 1 && seed <= 15);

    for (const row of conference) {
      assert.equal(typeof row.wins, 'number');
      assert.equal(typeof row.losses, 'number');
      assert.equal(typeof row.pct, 'number');
      assert.ok(row.abbr && row.name);
    }
  }
});

test('parseBoxScore splits starters, bench and DNP and adds up points', () => {
  const { teams } = parseBoxScore(fixture('summary-401909093.json'));

  assert.equal(teams.length, 2);
  for (const team of teams) {
    assert.ok(team.starters.length >= 5, `${team.abbr} starters`);
    assert.ok(team.bench.length >= 1, `${team.abbr} bench`);
    assert.ok(team.dnp.length >= 1, `${team.abbr} dnp`);
    for (const player of team.dnp) assert.ok(player.reason, `${player.name} dnp reason`);

    const starterPts = team.starters.reduce((sum, p) => sum + p.stats.PTS, 0);
    const benchPts = team.bench.reduce((sum, p) => sum + p.stats.PTS, 0);
    assert.equal(starterPts + benchPts, team.totals.PTS, `${team.abbr} points`);
    assert.equal(typeof team.totals.REB, 'number');
  }

  const cavs = teams.find((team) => team.abbr === 'CLE');
  assert.equal(cavs.totals.PTS, 106);
  const first = cavs.starters[0];
  assert.deepEqual(Object.keys(first.stats).sort(), ['+/-', '3PT', 'AST', 'BLK', 'FG', 'FT', 'MIN', 'PF', 'PTS', 'REB', 'STL', 'TO']);
  assert.equal(first.stats.FG.split('-').length, 2);
});

test('smallImg asks the ESPN resizer for 2x copies and leaves other URLs alone', () => {
  assert.equal(
    smallImg('https://a.espncdn.com/i/headshots/nba/players/full/3945274.png', 52, 52),
    'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/3945274.png&w=52&h=52',
  );
  assert.equal(smallImg('https://example.com/logo.png', 52, 52), 'https://example.com/logo.png');
  assert.equal(smallImg('', 52, 52), '');
  // A URL that already goes through the resizer is not wrapped twice.
  const already = 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/bos.png&w=40&h=40';
  assert.equal(smallImg(already, 52, 52), already);
});

test('box-score totals compute shooting percentages from made-attempted', () => {
  const { teams } = parseBoxScore(fixture('summary-401909093.json'));

  assert.equal(teams.length, 2);
  for (const team of teams) {
    const [made, attempted] = team.totals.FG.split('-').map(Number);
    const expected = Math.round((made / attempted) * 1000) / 10;
    assert.equal(Math.round(team.shooting.fg * 10) / 10, expected, team.abbr + ' FG%');
    assert.ok(team.shooting.three != null && team.shooting.ft != null, team.abbr + ' 3PT/FT');
  }

  const cle = teams.find((team) => team.abbr === 'CLE');
  assert.equal(Math.round(cle.shooting.fg * 10) / 10, 44.8);
  assert.equal(shotPct(''), null);
  assert.equal(shotPct('0-0'), null);
  assert.equal(shotPct('1-2'), 50);
});

test('parseTeamSchedule reads the 76ers season', () => {
  const schedule = parseTeamSchedule(fixture('team-20-schedule.json'));

  assert.equal(schedule.team.name, 'Philadelphia 76ers');
  assert.ok(schedule.games.length >= 80, `games: ${schedule.games.length}`);

  const finished = schedule.games.filter((game) => game.result !== null);
  assert.ok(finished.length >= 1);
  for (const game of finished) {
    assert.ok(game.result === 'W' || game.result === 'L');
    assert.equal(typeof game.score, 'number');
  }
  for (const game of schedule.games) {
    assert.ok(game.id);
    assert.ok(game.startISO);
    assert.ok(game.opponent.abbr);
    assert.ok(game.homeAway === 'home' || game.homeAway === 'away');
  }
});

test('parseRoster reads the 76ers roster', () => {
  const players = parseRoster(fixture('team-20-roster.json'));

  assert.equal(players.length, 17);
  for (const player of players) {
    assert.ok(player.id);
    assert.ok(player.name);
  }
});

test('etDate uses the Eastern date', () => {
  assert.equal(etDate('2026-10-23T02:30:00Z'), '20261022');
  assert.equal(etDate('2026-10-22T16:00:00Z'), '20261022');
});

test('every parser returns an empty result for {}', () => {
  assert.deepEqual(parseScoreboard({}), []);
  assert.deepEqual(parseStandings({}), { East: [], West: [] });
  assert.deepEqual(parseBoxScore({}).teams, []);
  assert.deepEqual(parseTeamSchedule({}).games, []);
  assert.deepEqual(parseRoster({}), []);
});

test('parseTeamStats reads the 76ers season averages', () => {
  const stats = parseTeamStats(fixture('team-20-statistics.json'));

  assert.equal(typeof stats.gamesPlayed, 'number');
  assert.ok(stats.gamesPlayed > 0, `gamesPlayed: ${stats.gamesPlayed}`);
  for (const key of ['fgPct', 'threePct', 'reb', 'ast']) {
    assert.equal(typeof stats[key], 'number', key);
  }
  assert.equal(stats.ppg, null);
});

test('standings rows carry points for and against', () => {
  const standings = parseStandings(fixture('standings.json'));
  const rows = [...standings.East, ...standings.West];

  assert.equal(rows.length, 30);
  for (const row of rows) {
    assert.equal(typeof row.ppg, 'number', `${row.abbr} ppg`);
    assert.equal(typeof row.oppPpg, 'number', `${row.abbr} oppPpg`);
  }
});

test('parsePreGame reads the BOS at ORL matchup before tip-off', () => {
  const game = parsePreGame(fixture('summary-401909903-pre.json'));

  assert.equal(game.away.abbr, 'BOS');
  assert.equal(game.home.abbr, 'ORL');
  assert.equal(game.id, '401909903');
  assert.ok(game.startISO);
  assert.ok(game.venue);
  assert.ok(game.seasonSeries.length >= 1);

  for (const abbr of [game.away.abbr, game.home.abbr]) {
    assert.ok(Array.isArray(game.lastFive[abbr]) && game.lastFive[abbr].length >= 1, `${abbr} last five`);
    for (const result of game.lastFive[abbr]) {
      assert.ok(result.id && result.date);
      assert.ok(result.result === 'W' || result.result === 'L');
    }
  }

  const forbidden = ['odds', 'pickcenter', 'predictor', 'winprobability'];
  const walk = (value, path) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!forbidden.includes(key), `forbidden key ${path}${key}`);
      walk(child, `${path}${key}.`);
    }
  };
  walk(game, '');
});

test('parseAthlete reads Tyrese Maxey', () => {
  const player = parseAthlete(fixture('athlete-4431678.json'));

  assert.equal(player.id, '4431678');
  assert.equal(player.name, 'Tyrese Maxey');
  assert.equal(player.team.abbr, 'PHI');
  assert.equal(player.team.id, '20');
  assert.ok(player.headshot);
  assert.equal(typeof player.age, 'number');
});

test('parsePlayerOverview lines up labels with season and career', () => {
  const overview = parsePlayerOverview(fixture('athlete-4431678-overview.json'));

  assert.ok(overview.labels.includes('PTS'));
  assert.ok('PTS' in overview.season, 'season PTS');
  assert.ok('PTS' in overview.career, 'career PTS');
  assert.equal(typeof overview.season.PTS, 'number');
  assert.equal(typeof overview.career.PTS, 'number');
  assert.equal(Object.keys(overview.season).length, overview.labels.length);
});

test('parseGameLog joins per-game stats to events, newest first', () => {
  const log = parseGameLog(fixture('athlete-4431678-gamelog.json'));

  assert.ok(log.labels.includes('PTS'));
  assert.ok(log.games.length >= 5, `games: ${log.games.length}`);
  for (let i = 1; i < log.games.length; i += 1) {
    assert.ok(
      new Date(log.games[i - 1].date).getTime() >= new Date(log.games[i].date).getTime(),
      `sorted newest first at ${i}`,
    );
  }
  for (const game of log.games) {
    assert.ok(game.opponentAbbr, `${game.id} opponent`);
    assert.equal(typeof game.stats.PTS, 'number', `${game.id} PTS`);
  }
});

test('parseSearch keeps only NBA players', () => {
  const players = parseSearch(fixture('search-maxey.json'));

  assert.equal(players.length, 1);
  assert.equal(players[0].id, '4431678');
  assert.equal(players[0].name, 'Tyrese Maxey');
  assert.equal(players[0].teamAbbr, 'PHI');
  assert.ok(players[0].headshot);
});

test('parseLeaders builds the points board', () => {
  const rows = parseLeaders(fixture('leaders-points.json'), 'offensive', 'avgPoints');

  assert.equal(rows.length, 10);
  assert.deepEqual(rows.map((row) => row.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const row of rows) {
    assert.equal(typeof row.value, 'number');
    assert.ok(row.id, 'id');
    assert.ok(row.name, 'name');
    assert.ok(row.teamAbbr, 'team');
  }
  const values = rows.map((row) => row.value);
  assert.deepEqual(values, [...values].sort((a, b) => b - a));
});

test('parseGameLog splits season types and keeps regular season as games', () => {
  const log = parseGameLog(fixture('athlete-4431678-gamelog.json'));

  assert.ok(log.seasons.length >= 1);
  const regular = log.seasons.find((season) => /regular season/i.test(season.name));
  assert.ok(regular, 'regular season block');
  assert.ok(regular.games.length >= 1);
  for (const game of regular.games) assert.equal(typeof game.stats.PTS, 'number');
  assert.deepEqual(log.games, regular.games);
});

test('parseLeaders and parseSearch return [] for {}', () => {
  assert.deepEqual(parseLeaders({}, 'offensive', 'avgPoints'), []);
  assert.deepEqual(parseSearch({}), []);
});

test('the new parsers return empty results for {}', () => {
  assert.deepEqual(parseTeamStats({}), {
    gamesPlayed: null,
    ppg: null,
    fgPct: null,
    threePct: null,
    ftPct: null,
    reb: null,
    ast: null,
    tov: null,
    stl: null,
    blk: null,
    astTo: null,
  });

  const pre = parsePreGame({});
  assert.equal(pre.away, null);
  assert.equal(pre.home, null);
  assert.deepEqual(pre.seasonSeries, []);
  assert.deepEqual(pre.lastFive, {});
  assert.deepEqual(pre.injuries, {});
  assert.deepEqual(pre.leaders, {});

  assert.deepEqual(parseAthlete({}), {
    id: '',
    name: '',
    jersey: '',
    pos: '',
    height: '',
    weight: '',
    age: null,
    headshot: '',
    team: { id: '', abbr: '', name: '' },
  });
  assert.deepEqual(parsePlayerOverview({}), { labels: [], season: {}, career: {} });
  assert.deepEqual(parseGameLog({}), { labels: [], seasons: [], games: [] });
});
