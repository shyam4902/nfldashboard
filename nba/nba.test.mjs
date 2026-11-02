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
  parseCompetitorLeaders,
  parseOdds,
  parseScoreboard,
  parseSearch,
  parseStandings,
  parseTeams,
  parseTeamSchedule,
  parseTeamStats,
  shotPct,
  smallImg,
  contrastRatio,
  readableOn,
  teamFill,
  textOn,
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

function leaderCat(name, short, value) {
  return { name, leaders: [{ displayValue: value, athlete: { displayName: 'Full ' + short, shortName: short } }] };
}

function inlineEvent(state, leaders, extra = {}) {
  const side = (homeAway, abbr, id, lead, records) => ({
    homeAway,
    team: { id, abbreviation: abbr, displayName: abbr + ' Team' },
    score: state === 'pre' ? '0' : '50',
    records,
    leaders: lead,
  });
  return {
    id: 'g1',
    date: '2026-11-01T00:00Z',
    competitions: [{
      status: { type: { state } },
      competitors: [
        side('home', 'ORL', '19', leaders.home, [
          { name: 'overall', type: 'total', summary: '1-3' },
          { name: 'Home', type: 'home', summary: '0-2' },
          { name: 'Road', type: 'road', summary: '1-1' },
        ]),
        side('away', 'BOS', '2', leaders.away),
      ],
      ...extra,
    }],
  };
}

test('parseScoreboard reads season per-game leaders before tip-off', () => {
  const home = [leaderCat('pointsPerGame', 'F. Wagner', '19.5'), leaderCat('reboundsPerGame', 'W. Carter Jr.', '9.0'), leaderCat('assistsPerGame', 'F. Wagner', '6.0'), leaderCat('rating', 'F. Wagner', 'x')];
  const away = [leaderCat('pointsPerGame', 'J. Tatum', '28.0')];
  const [game] = parseScoreboard({ events: [inlineEvent('pre', { home, away })] });

  assert.equal(game.home.leaders.kind, 'season');
  assert.deepEqual(game.home.leaders.pts, { name: 'Full F. Wagner', short: 'F. Wagner', value: '19.5' });
  assert.equal(game.home.leaders.reb.short, 'W. Carter Jr.');
  assert.equal(game.home.leaders.ast.value, '6.0');
  // A side with only one category keeps the rest as null instead of inventing them.
  assert.equal(game.away.leaders.kind, 'season');
  assert.equal(game.away.leaders.pts.short, 'J. Tatum');
  assert.equal(game.away.leaders.reb, null);
  assert.equal(game.away.leaders.ast, null);
});

test('parseScoreboard reads in-game leaders once the game is live or final', () => {
  const both = [leaderCat('points', 'T. Maxey', '32'), leaderCat('rebounds', 'L. James', '10'), leaderCat('assists', 'T. Maxey', '6'), leaderCat('pointsPerGame', 'Old', '1.0')];
  for (const state of ['in', 'post']) {
    const [game] = parseScoreboard({ events: [inlineEvent(state, { home: both, away: both })] });
    assert.equal(game.home.leaders.kind, 'game', state);
    assert.equal(game.home.leaders.pts.value, '32', state);
    assert.equal(game.home.leaders.reb.short, 'L. James', state);
  }
});

test('parseScoreboard derives a short name and omits leaders that are missing', () => {
  const lead = [{ name: 'points', leaders: [{ displayValue: '20', athlete: { displayName: 'Jaylen Brown' } }] }];
  const [game] = parseScoreboard({ events: [inlineEvent('in', { home: lead, away: [] })] });
  assert.equal(game.home.leaders.pts.short, 'J. Brown');
  assert.equal(game.away.leaders, null);
  assert.equal(parseCompetitorLeaders({}, 'pre'), null);
  assert.equal(parseCompetitorLeaders({ leaders: [{ name: 'points', leaders: [{ displayValue: '9' }] }] }, 'in'), null);
});

test('parseScoreboard reads home and road records', () => {
  const [game] = parseScoreboard({ events: [inlineEvent('pre', { home: [], away: [] })] });
  assert.equal(game.home.record, '1-3');
  assert.equal(game.home.homeRecord, '0-2');
  assert.equal(game.home.roadRecord, '1-1');
  assert.equal(game.away.homeRecord, '');
  assert.equal(game.away.roadRecord, '');
});

test('parseOdds reads spread, total and moneyline', () => {
  const odds = parseOdds({
    odds: [{ details: 'CLE -3.5', overUnder: 215.5, homeTeamOdds: { moneyLine: 130 }, awayTeamOdds: { moneyLine: -150 } }],
  });
  assert.deepEqual(odds, { details: 'CLE -3.5', total: 215.5, moneyline: { home: '+130', away: '-150' } });

  const [game] = parseScoreboard({ events: [inlineEvent('pre', { home: [], away: [] }, { odds: [{ details: 'EVEN', overUnder: '221' }] })] });
  assert.deepEqual(game.odds, { details: 'EVEN', total: 221, moneyline: null });
});

test('parseOdds is null when the payload has no usable odds', () => {
  assert.equal(parseOdds({}), null);
  assert.equal(parseOdds({ odds: [] }), null);
  assert.equal(parseOdds({ odds: [{ provider: { name: 'x' } }] }), null);
  const [game] = parseScoreboard({ events: [inlineEvent('pre', { home: [], away: [] })] });
  assert.equal(game.odds, null);
  // The real fixtures carry no odds: nothing is invented.
  for (const g of parseScoreboard(fixture('scoreboard-20261101.json'))) assert.equal(g.odds, null);
});

test('parseScoreboard fixture leaders are season averages pre-game and game lines when final', () => {
  const pre = parseScoreboard(fixture('scoreboard-20261101.json'));
  assert.equal(pre[0].home.leaders.kind, 'season');
  assert.equal(pre[0].home.leaders.pts.short, 'F. Wagner');
  const post = parseScoreboard(fixture('scoreboard-20261022.json'));
  assert.equal(post[0].home.leaders.kind, 'game');
  assert.equal(post[0].away.leaders.reb.short, 'D. Mitchell');
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

const TEAMS_FIXTURE = {
  sports: [{
    leagues: [{
      teams: [
        { team: { id: '17', abbreviation: 'BKN', displayName: 'Brooklyn Nets', color: '000000', alternateColor: 'ffffff', logos: [{ href: 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png' }] } },
        { team: { id: '25', abbreviation: 'OKC', displayName: 'Oklahoma City Thunder', color: '007ac1', alternateColor: 'ef3b24', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png' } },
        { team: { id: '9', abbreviation: 'GS', displayName: 'Golden State Warriors', color: 'FDB927', alternateColor: 'zz' } },
        { team: null },
        { team: {} },
      ],
    }],
  }],
};

test('parseTeams indexes colours and logos by abbreviation and id', () => {
  const teams = parseTeams(TEAMS_FIXTURE);
  assert.deepEqual(Object.keys(teams.byAbbr).sort(), ['BKN', 'GS', 'OKC']);
  assert.deepEqual(teams.byAbbr.BKN, {
    id: '17', abbr: 'BKN', name: 'Brooklyn Nets', color: '#000000', alt: '#ffffff', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
  });
  assert.equal(teams.byId['25'].abbr, 'OKC');
  assert.equal(teams.byId['25'].logo, 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png');
  // Upper case is normalised, a malformed alternate becomes empty, no logo is ''.
  assert.equal(teams.byAbbr.GS.color, '#fdb927');
  assert.equal(teams.byAbbr.GS.alt, '');
  assert.equal(teams.byAbbr.GS.logo, '');
  assert.deepEqual(parseTeams({}), { byAbbr: {}, byId: {} });
});

test('teamFill swaps a near-black primary for its alternate and picks readable text', () => {
  const nets = teamFill({ color: '#000000', alt: '#ffffff' });
  assert.deepEqual(nets, { fill: '#ffffff', ink: '#0b0c0e', usedAlt: true });
  const thunder = teamFill({ color: '#007ac1', alt: '#ef3b24' });
  assert.equal(thunder.fill, '#007ac1');
  assert.equal(thunder.usedAlt, false);
  assert.equal(textOn('#fdb927'), '#0b0c0e');
  assert.equal(textOn('#1d428a'), '#ffffff');
  assert.equal(teamFill({}).fill, '#2b3037');
  assert.ok(contrastRatio('#000000', '#ffffff') > 20.9);
});

test('readableOn lifts a dark team colour until it reads on the panel', () => {
  assert.equal(readableOn('#fdb927'), '#fdb927');
  const lifted = readableOn('#0e2240');
  assert.notEqual(lifted, '#0e2240');
  assert.ok(contrastRatio(lifted, '#14161a') >= 4.5);
  assert.equal(readableOn(''), '#ffffff');
});
