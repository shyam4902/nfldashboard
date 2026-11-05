import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  barShares,
  leagueRank,
  ordinal,
  pickCompareGame,
  etDate,
  parseAthlete,
  parseBoxScore,
  parseGameLog,
  parseLeaders,
  parsePlayerOverview,
  parsePreGame,
  parseRoster,
  parseCompetitorLeaders,
  parseGameExtras,
  parseGameOdds,
  parseGameFlow,
  parseLeaderLines,
  parsePeriodScoring,
  parseShots,
  periodStart,
  shotZones,
  slateDay,
  boxLeader,
  parsePredictor,
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
  nflTeamIndex,
  nflTeam,
  nflWeekGames,
  nflDivisionLeaders,
  oddsBits,
  slateCounts,
  etKickoff,
  nflWeekCutoff,
  nflSlateWeek,
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

test('parseLeaders reads totals with thousands separators (NFL feed)', () => {
  const json = {
    categories: [{ name: 'general', names: ['gamesPlayed'] }, { name: 'passing', names: ['passingYards'] }],
    athletes: [
      { athlete: { id: '1', displayName: 'A', teamShortName: 'GB' }, categories: [{ name: 'general', totals: ['8'] }, { name: 'passing', totals: ['2,246'] }] },
      { athlete: { id: '2', displayName: 'B', teamShortName: 'LAR' }, categories: [{ name: 'general', totals: ['8'] }, { name: 'passing', totals: ['2,146'] }] },
    ],
  };
  const rows = parseLeaders(json, 'passing', 'passingYards');
  assert.deepEqual(rows.map((row) => [row.name, row.value, row.gp]), [['A', 2246, 8], ['B', 2146, 8]]);
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

// ── Game page extras: small inline summary payloads ────────────────────────
function summaryFixture(state) {
  const team = (id, abbr) => ({ id, abbreviation: abbr, displayName: abbr + ' Team' });
  const started = state !== 'pre';
  const athlete = (id, name, pos) => ({
    id, displayName: name, shortName: name[0] + '. ' + name.split(' ')[1], jersey: '7',
    position: { abbreviation: pos }, headshot: { href: 'https://a.espncdn.com/i/headshots/nba/players/full/' + id + '.png' },
  });
  const cat = (name, who, value, summary) => ({ name, leaders: [{ displayValue: value, athlete: who, summary }] });
  const k = state === 'pre'
    ? ['pointsPerGame', 'reboundsPerGame', 'assistsPerGame']
    : ['points', 'rebounds', 'assists'];
  return {
    header: {
      id: '9',
      competitions: [{
        id: '9',
        date: '2026-11-03T00:30Z',
        status: { type: { state, shortDetail: state === 'pre' ? '11/2 - 7:30 PM EST' : 'Final' } },
        broadcasts: [{ isNational: false, media: { shortName: 'League Pass' } }, { isNational: true, media: { shortName: 'ESPN' } }],
        competitors: [
          { homeAway: 'home', team: team('18', 'NY'), ...(started ? { score: '101' } : {}), winner: started, record: [{ type: 'total', summary: '2-4' }, { type: 'home', summary: '1-2' }], linescores: [{ displayValue: '25' }, { displayValue: '30' }] },
          { homeAway: 'away', team: team('17', 'BKN'), ...(started ? { score: '99' } : {}), winner: false, record: [{ type: 'total', summary: '1-5' }, { type: 'road', summary: '1-2' }], linescores: [{ displayValue: '20' }, { displayValue: '31' }] },
        ],
      }],
    },
    gameInfo: { venue: { fullName: 'Madison Square Garden' } },
    pickcenter: [{
      provider: { name: 'DraftKings' }, details: 'NY -14.5', overUnder: 218.5, spread: -14.5, overOdds: -108, underOdds: -112,
      awayTeamOdds: { moneyLine: 650, spreadOdds: -106 }, homeTeamOdds: { moneyLine: -980, spreadOdds: -114 },
      pointSpread: { home: { close: { line: '-14.5', odds: '-114' }, open: { line: '-13.5' } }, away: { close: { line: '+14.5', odds: '-106' }, open: { line: '+13.5' } } },
      total: { over: { open: { line: 'o222.5' } } },
    }],
    predictor: { homeTeam: { id: '18', gameProjection: '86.2' }, awayTeam: { id: '17', gameProjection: '13.8' } },
    leaders: [
      { team: team('18', 'NY'), leaders: [cat(k[0], athlete('1', 'Jalen Brunson', 'G'), '25.5', '39.5 FG%'), cat(k[1], athlete('2', 'Karl Towns', 'C'), '13.5'), cat(k[2], athlete('3', 'Tyler Kolek', 'G'), '6.2')] },
      { team: team('17', 'BKN'), leaders: [cat(k[0], athlete('4', 'Michael Porter', 'F'), '21.2')] },
    ],
    injuries: [
      { team: team('17', 'BKN'), injuries: [{ status: 'Out', athlete: athlete('5', 'Egor Demin', 'G'), details: { type: 'Leg', detail: 'Bruise Not Specified', returnDate: '2026-11-07' } }, { athlete: {} }] },
      { team: team('18', 'NY'), injuries: [] },
    ],
    againstTheSpread: [{ team: team('17', 'BKN'), records: [] }, { team: team('18', 'NY'), records: [] }],
    boxscore: { teams: [{ team: team('18', 'NY'), statistics: [{ name: 'pointsInPaint', displayValue: '38' }, { name: 'fastBreakPoints', displayValue: '9' }] }] },
    winprobability: [{ homeWinPercentage: 0.4 }, { homeWinPercentage: 0.75 }],
  };
}

test('parseGameExtras reads the sides, odds, BPI and leaders with headshots', () => {
  const g = parseGameExtras(summaryFixture('pre'));
  assert.equal(g.state, 'pre');
  assert.equal(g.away.abbr, 'BKN');
  assert.equal(g.home.record, '2-4');
  assert.equal(g.home.homeRecord, '1-2');
  assert.equal(g.away.roadRecord, '1-2');
  assert.equal(g.away.score, null);
  assert.equal(g.venue, 'Madison Square Garden');
  assert.equal(g.broadcast, 'ESPN');
  assert.deepEqual(g.predictor, { home: 86.2, away: 13.8 });
  assert.equal(g.leaders.home.kind, 'season');
  assert.equal(g.leaders.home.pts.name, 'Jalen Brunson');
  assert.equal(g.leaders.home.pts.headshot, 'https://a.espncdn.com/i/headshots/nba/players/full/1.png');
  assert.equal(g.leaders.home.pts.pos, 'G');
  assert.equal(g.leaders.away.reb, null);
  assert.equal(g.leaders.away.pts.value, '21.2');
});

test('parseGameExtras reads started games: scores, game leaders, line score, team counts', () => {
  const g = parseGameExtras(summaryFixture('post'));
  assert.equal(g.state, 'post');
  assert.equal(g.home.score, 101);
  assert.equal(g.home.winner, true);
  assert.deepEqual(g.away.linescores, [20, 31]);
  assert.equal(g.leaders.home.kind, 'game');
  assert.equal(g.counts.home.paint, 38);
  assert.equal(g.counts.home.fastBreak, 9);
  assert.equal(g.counts.home.largestLead, null);
  assert.equal(g.counts.away, null);
  assert.deepEqual(g.winProb, { home: 75, away: 25 });
});

test('parseGameOdds reads spread, total, moneyline and line movement', () => {
  const odds = parseGameOdds(summaryFixture('pre'));
  assert.equal(odds.provider, 'DraftKings');
  assert.equal(odds.details, 'NY -14.5');
  assert.equal(odds.total, 218.5);
  assert.equal(odds.totalOpen, 222.5);
  assert.equal(odds.overOdds, '-108');
  assert.deepEqual(odds.spread.home, { line: '-14.5', odds: '-114' });
  assert.deepEqual(odds.spread.away, { line: '+14.5', odds: '-106' });
  assert.deepEqual(odds.spreadOpen, { away: '+13.5', home: '-13.5' });
  assert.deepEqual(odds.moneyline, { away: '+650', home: '-980' });
});

test('parseGameOdds derives the away line from the home spread and drops empty odds', () => {
  const odds = parseGameOdds({ pickcenter: [{ details: 'BOS -6.5', overUnder: 221.5, spread: 6.5 }] });
  assert.equal(odds.spread.home.line, '+6.5');
  assert.equal(odds.spread.away.line, '-6.5');
  assert.equal(odds.moneyline, null);
  assert.equal(parseGameOdds({ pickcenter: [], odds: [] }), null);
  assert.equal(parseGameOdds({}), null);
});

test('parseGameExtras keeps injuries per side, cleans the detail, and nulls empty ATS', () => {
  const g = parseGameExtras(summaryFixture('pre'));
  assert.equal(g.injuries.home.length, 0);
  assert.equal(g.injuries.away.length, 1);
  assert.deepEqual(g.injuries.away[0], { name: 'Egor Demin', pos: 'G', status: 'Out', detail: 'Leg Bruise', returnDate: '2026-11-07' });
  assert.equal(g.ats, null);

  const withAts = summaryFixture('pre');
  withAts.againstTheSpread[0].records = [{ displayName: 'Overall ATS', summary: '3-2-1' }, { type: 'home', displayValue: '' }];
  assert.deepEqual(parseGameExtras(withAts).ats.away, [{ label: 'Overall ATS', summary: '3-2-1' }]);
});

test('parseGameExtras and parsePredictor survive an empty payload', () => {
  const g = parseGameExtras({});
  assert.equal(g.away, null);
  assert.equal(g.odds, null);
  assert.equal(g.predictor, null);
  assert.equal(g.leaders, null);
  assert.equal(g.injuries, null);
  assert.equal(g.winProb, null);
  assert.equal(parsePredictor({ predictor: { homeTeam: {} } }), null);
});

test('barShares gives the better side the full bar and respects lower-is-better', () => {
  assert.deepEqual(barShares(120, 100), { a: 1, b: 100 / 120 });
  assert.deepEqual(barShares(100, 120), { a: 100 / 120, b: 1 });
  // Fewer turnovers is better, so the lower number gets the full bar.
  assert.deepEqual(barShares(12, 16, true), { a: 1, b: 0.75 });
  assert.deepEqual(barShares(16, 12, true), { a: 0.75, b: 1 });
  assert.deepEqual(barShares(7, 7), { a: 1, b: 1 });
  // Zero or negative values spread linearly with a floor.
  assert.deepEqual(barShares(5, -3), { a: 1, b: 0.15 });
  assert.deepEqual(barShares(0, 7), { a: 0.15, b: 1 });
  assert.deepEqual(barShares(null, 7), { a: 0, b: 0 });
  assert.equal(barShares(1, 1000).a, 0.08);
});

test('leagueRank ranks a team on a value, ties share a rank, lower flips order', () => {
  const rows = [
    { teamId: '1', ppg: 120 }, { teamId: '2', ppg: 110 }, { teamId: '3', ppg: 110 }, { teamId: '4', ppg: null },
  ];
  assert.deepEqual(leagueRank(rows, '1', (r) => r.ppg), { rank: 1, of: 3 });
  assert.deepEqual(leagueRank(rows, '3', (r) => r.ppg), { rank: 2, of: 3 });
  assert.deepEqual(leagueRank(rows, '1', (r) => r.ppg, true), { rank: 3, of: 3 });
  assert.equal(leagueRank(rows, '4', (r) => r.ppg), null);
  assert.equal(leagueRank(rows, '9', (r) => r.ppg), null);
  assert.equal(leagueRank({}, '1', (r) => r.ppg), null);
});

test('ordinal handles teens and suffixes', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  assert.equal(ordinal(NaN), '');
});

test('pickCompareGame takes the first or last tip-off and skips unusable games', () => {
  const game = (id, startISO, away = 'a' + id, home = 'h' + id) => ({ id, startISO, away: { id: away }, home: { id: home } });
  const games = [game('2', '2026-11-02T02:00:00Z'), game('1', '2026-11-01T23:30:00Z'), { id: 'x', startISO: '2026-11-01T20:00:00Z', away: {}, home: {} }];
  assert.equal(pickCompareGame(games).id, '1');
  assert.equal(pickCompareGame(games, 'last').id, '2');
  assert.equal(pickCompareGame([]), null);
  assert.equal(pickCompareGame(undefined), null);
});

test('standings rows carry home, road and conference; roster rows carry headshots', () => {
  const standings = parseStandings(fixture('standings.json'));
  const row = standings.East[0];
  assert.equal(row.conf, 'East');
  assert.equal(standings.West[0].conf, 'West');
  assert.match(row.home, /^\d+-\d+$/);
  assert.match(row.road, /^\d+-\d+$/);
  const roster = parseRoster(fixture('team-20-roster.json'));
  assert.ok(roster.some((p) => /^https:\/\//.test(p.headshot)));
});

test('parseGameFlow rebuilds the CLE at PHI comeback from the play-by-play', () => {
  const json = fixture('summary-401909093.json');
  const flow = parseGameFlow(json);
  assert.equal(flow.awayId, '5');
  assert.equal(flow.homeId, '20');
  assert.equal(flow.periods, 4);
  assert.equal(flow.end, 2880);
  assert.deepEqual(flow.points[0], { t: 0, away: 0, home: 0, period: 1 });
  const last = flow.points[flow.points.length - 1];
  assert.equal(last.away, 106);
  assert.equal(last.home, 114);
  // ESPN's own team counts for this game: one lead change, CLE up 29, PHI up 9.
  const espn = (abbr, name) => Number(json.boxscore.teams.find((t) => t.team.abbreviation === abbr).statistics.find((s) => s.name === name).displayValue);
  assert.equal(flow.leadChanges, espn('CLE', 'leadChanges'));
  assert.equal(flow.largest.away.lead, espn('CLE', 'largestLead'));
  assert.equal(flow.largest.home.lead, espn('PHI', 'largestLead'));
  assert.equal(Math.round(flow.leadTime.away / flow.end * 100), espn('CLE', 'leadPercentage'));
  assert.equal(Math.round(flow.leadTime.home / flow.end * 100), espn('PHI', 'leadPercentage'));
  assert.equal(flow.leadTime.away + flow.leadTime.home + flow.leadTime.tied, flow.end);
  assert.equal(flow.ties, 3);
  assert.deepEqual(flow.runs.home, { pts: 16, start: 1368, end: 1518, from: { away: 69, home: 40 } });
  assert.equal(flow.runs.away.pts, 12);
  assert.equal(flow.wp.length, json.winprobability.length);
  assert.ok(flow.wp.every((w) => w.home >= 0 && w.home <= 100));
  assert.equal(parseGameFlow({}), null);
  assert.equal(periodStart(1), 0);
  assert.equal(periodStart(4), 2160);
  assert.equal(periodStart(5), 2880);
  assert.equal(periodStart(6), 3180);
});

test('parseShots places every field-goal attempt and matches the box score', () => {
  const json = fixture('summary-401909093.json');
  const shots = parseShots(json);
  const box = parseBoxScore(json);
  for (const [side, abbr] of [['away', 'CLE'], ['home', 'PHI']]) {
    const totals = box.teams.find((t) => t.abbr === abbr).totals;
    const [fgm, fga] = totals.FG.split('-').map(Number);
    const [tpm, tpa] = totals['3PT'].split('-').map(Number);
    assert.equal(shots[side].length, fga);
    assert.equal(shots[side].filter((s) => s.made).length, fgm);
    assert.equal(shots[side].filter((s) => s.three).length, tpa);
    assert.equal(shots[side].filter((s) => s.three && s.made).length, tpm);
    const zones = shotZones(shots[side]);
    assert.equal(Object.values(zones).reduce((n, z) => n + z.att, 0), fga);
    assert.equal(zones.three.att, tpa);
  }
  assert.deepEqual(parseShots({}), { away: [], home: [] });
  assert.equal(shotZones([]).rim.pct, null);
});

test('parsePeriodScoring splits points by quarter and scorer, matching the box score', () => {
  const json = fixture('summary-401909093.json');
  const periods = parsePeriodScoring(json);
  assert.deepEqual(periods.map((p) => [p.away.pts, p.home.pts]), [[35, 18], [34, 27], [21, 37], [16, 32]]);
  assert.deepEqual(periods[0].away.scorers[0], { id: '3908809', name: 'Donovan Mitchell', short: 'D. Mitchell', pts: 12 });
  const box = parseBoxScore(json);
  const totals = new Map();
  periods.forEach((p) => ['away', 'home'].forEach((side) => p[side].scorers.forEach((s) => totals.set(s.id, (totals.get(s.id) || 0) + s.pts))));
  for (const team of box.teams) {
    for (const player of [...team.starters, ...team.bench]) {
      assert.equal(totals.get(player.id) || 0, Number(player.stats.PTS), player.name);
    }
  }
  assert.deepEqual(parsePeriodScoring({}), []);
});

test('parseLeaderLines ranks like parseLeaders and carries each full line', () => {
  const json = fixture('leaders-points.json');
  const rows = parseLeaderLines(json, 'offensive', 'avgPoints');
  const plain = parseLeaders(json, 'offensive', 'avgPoints');
  assert.deepEqual(rows.map((r) => [r.id, r.rank, r.value]), plain.map((r) => [r.id, r.rank, r.value]));
  assert.equal(rows[0].name, 'Luka Doncic');
  assert.deepEqual(
    { gp: rows[0].line.gp, min: rows[0].line.min, fgPct: rows[0].line.fgPct, threePct: rows[0].line.threePct, ast: rows[0].line.ast, reb: rows[0].line.reb },
    { gp: 4, min: 35.5, fgPct: 48.4, threePct: 39.6, ast: 8.3, reb: 6.8 },
  );
  assert.equal(parseLeaderLines(json, 'offensive', 'avgPoints', 0).length, json.athletes.length);
  assert.deepEqual(parseLeaderLines(json, 'offensive', 'nope'), []);
  assert.deepEqual(parseLeaderLines({}, 'offensive', 'avgPoints'), []);
});

test('slateDay: the slate turns over at midnight Pacific, not midnight Eastern', () => {
  // 00:30 ET on Nov 5 is 21:30 PT on Nov 4: still the Nov 4 slate.
  assert.equal(slateDay(new Date('2026-11-05T05:30:00Z')), '20261104');
  // 02:59 ET is still Nov 4; 03:00 ET (midnight Pacific) is Nov 5.
  assert.equal(slateDay(new Date('2026-11-05T07:59:00Z')), '20261104');
  assert.equal(slateDay(new Date('2026-11-05T08:00:00Z')), '20261105');
  // Afternoon ET is plainly that day.
  assert.equal(slateDay('2026-11-05T19:00:00Z'), '20261105');
});

test('slateDay: holds on yesterday while one of its games is still live', () => {
  // 03:30 ET Nov 5, a Nov 4 game in double overtime.
  assert.equal(slateDay(new Date('2026-11-05T08:30:00Z'), true), '20261104');
  assert.equal(slateDay(new Date('2026-11-05T08:30:00Z'), false), '20261105');
  // Across a month boundary and the DST change (Nov 1 2026, 2am EDT -> EST).
  assert.equal(slateDay(new Date('2026-12-01T09:00:00Z'), true), '20261130');
  assert.equal(slateDay(new Date('2026-11-01T06:30:00Z')), '20261031');
  assert.equal(slateDay('not a date'), null);
});

test('boxLeader: the top steals and blocks on each side, from the box score', () => {
  const box = parseBoxScore(fixture('summary-401909093.json'));
  for (const team of box.teams) {
    const players = [...team.starters, ...team.bench];
    for (const key of ['STL', 'BLK']) {
      const top = Math.max(...players.map((p) => Number(p.stats[key]) || 0));
      const lead = boxLeader(team, key);
      if (top > 0) {
        assert.equal(lead.value, top);
        assert.equal(players.find((p) => p.id === lead.id).stats[key], top);
      } else {
        assert.equal(lead, null);
      }
    }
  }
  assert.equal(boxLeader({ starters: [{ id: '1', name: 'A', stats: { STL: 0 } }], bench: [] }, 'STL'), null);
  assert.deepEqual(boxLeader({ starters: [{ id: '1', name: 'A', pos: 'G', stats: { STL: 2 } }], bench: [{ id: '2', name: 'B', stats: { STL: 2 } }] }, 'STL'), { id: '1', name: 'A', pos: 'G', value: 2 });
});

// ── Home page helpers ───────────────────────────────────────────────────────
const HOME_STANDINGS = {
  divisions: [
    { conference: 'NFC', division: 'NFC East', teams: [
      { team: 'New York Giants', abbr: 'NYG', wins: 4, losses: 2, ties: 1, differential: 20 },
      { team: 'Washington Commanders', abbr: 'WAS', wins: 2, losses: 4, ties: 1, differential: -30 },
    ] },
    { conference: 'AFC', division: 'AFC South', teams: [
      { team: 'Jacksonville Jaguars', abbr: 'JAX', wins: 5, losses: 2, ties: 0, differential: 41 },
      { team: 'Houston Texans', abbr: 'HOU', wins: 2, losses: 5, ties: 0, differential: -12 },
    ] },
    { conference: 'AFC', division: 'AFC North', teams: [
      { team: 'Baltimore Ravens', abbr: 'BAL', wins: 4, losses: 4, ties: 0, differential: 5 },
    ] },
  ],
  teams: [
    { team: 'New York Giants', abbr: 'NYG', wins: 4, losses: 2, ties: 1, conference: 'NFC', division: 'NFC East' },
    { team: 'Washington Commanders', abbr: 'WAS', wins: 2, losses: 4, ties: 1, conference: 'NFC', division: 'NFC East' },
    { team: 'Jacksonville Jaguars', abbr: 'JAX', wins: 5, losses: 2, ties: 0, conference: 'AFC', division: 'AFC South' },
    { team: 'Baltimore Ravens', abbr: 'BAL', wins: 4, losses: 4, ties: 0, conference: 'AFC', division: 'AFC North' },
    { team: 'Los Angeles Rams', abbr: 'LAR', wins: 4, losses: 4, ties: 0, conference: 'NFC', division: 'NFC West' },
  ],
};
const HOME_COLORS = [
  { name: 'Jacksonville Jaguars', abbr: 'JAX', primary_color: '#006778' },
  { name: 'Washington Commanders', abbr: 'WAS', primary_color: '#5A1414' },
  { name: 'Broken Colour', abbr: 'BRK', primary_color: 'teal' },
];

test('nflTeamIndex joins standings records with colours by name and abbreviation', () => {
  const index = nflTeamIndex(HOME_STANDINGS, HOME_COLORS);
  assert.deepEqual(
    { ...nflTeam(index, 'Jacksonville Jaguars') },
    { name: 'Jacksonville Jaguars', abbr: 'JAX', record: '5-2', color: '#006778', conference: 'AFC', division: 'AFC South' },
  );
  assert.equal(nflTeam(index, 'WSH').record, '2-4-1');
  assert.equal(nflTeam(index, 'WSH').color, '#5a1414');
  assert.equal(nflTeam(index, 'LA').abbr, 'LAR');
  assert.equal(nflTeam(index, 'BRK').color, '');
  assert.equal(nflTeam(index, 'Nobody FC'), null);
  assert.equal(nflTeam(null, 'JAX'), null);
  assert.deepEqual(nflTeamIndex(null, null), { byName: {}, byAbbr: {} });
});

test('nflWeekGames keeps the schedule slate and overlays ESPN live state and odds', () => {
  const schedule = {
    week: 9,
    games: [
      { game_id: '2026-11-08-LA-WAS', week: 9, away_team: 'Los Angeles Rams', home_team: 'Washington Commanders', kickoff_utc: '2026-11-08T18:00:00Z', tv: '', venue: 'Northwest Stadium' },
      { game_id: '2026-11-05-JAX-BAL', week: 9, away_team: 'Jacksonville Jaguars', home_team: 'Baltimore Ravens', kickoff_utc: '2026-11-06T01:15:00Z', tv: 'Prime Video' },
      { game_id: '2026-11-01-X-Y', week: 8, away_team: 'Jacksonville Jaguars', home_team: 'Houston Texans', kickoff_utc: '2026-11-01T18:00:00Z', status: 'final', winner: 'Houston Texans', away_score: 10, home_score: 20 },
      { game_id: 'junk', week: 9 },
    ],
  };
  const espn = [{
    state: 'in',
    statusText: 'Q3 4:12',
    odds: { details: 'BAL -3.5', total: 47.5, moneyline: null },
    broadcast: 'Prime Video',
    away: { name: 'Jacksonville Jaguars', abbr: 'JAX', score: 17, record: '6-2', winner: false },
    home: { name: 'Baltimore Ravens', abbr: 'BAL', score: 10, record: '4-4', winner: false },
  }];
  const index = nflTeamIndex(HOME_STANDINGS, HOME_COLORS);
  const games = nflWeekGames(schedule, espn, index);

  assert.deepEqual(games.map((g) => g.id), ['2026-11-05-JAX-BAL', '2026-11-08-LA-WAS']);
  const [live, pre] = games;
  assert.equal(live.state, 'in');
  assert.equal(live.statusText, 'Q3 4:12');
  assert.deepEqual(live.odds, { details: 'BAL -3.5', total: 47.5, moneyline: null });
  assert.equal(live.away.score, 17);
  assert.equal(live.away.record, '6-2', 'ESPN record wins over the standings artifact');
  assert.equal(live.away.color, '#006778');

  assert.equal(pre.state, 'pre');
  assert.equal(pre.odds, null);
  assert.equal(pre.away.abbr, 'LAR');
  assert.equal(pre.away.record, '4-4');
  assert.equal(pre.home.score, null);
});

test('nflWeekGames reads synced finals without ESPN and honours an explicit week', () => {
  const schedule = {
    week: 9,
    games: [{ game_id: 'g8', week: 8, away_team: 'Jacksonville Jaguars', home_team: 'Houston Texans', kickoff_utc: '2026-11-01T18:00:00Z', status: 'final', winner: 'Houston Texans', away_score: 10, home_score: 20 }],
  };
  const [game] = nflWeekGames(schedule, null, null, 8);
  assert.equal(game.state, 'post');
  assert.equal(game.statusText, 'Final');
  assert.equal(game.home.winner, true);
  assert.equal(game.away.winner, false);
  assert.equal(game.away.abbr, '', 'no index and no id abbreviations means none is invented');
  const [fromId] = nflWeekGames({ week: 9, games: [{ game_id: '2026-11-08-LA-WAS', week: 9, away_team: 'Los Angeles Rams', home_team: 'Washington Commanders' }] }, [], null);
  assert.deepEqual([fromId.away.abbr, fromId.home.abbr], ['LAR', 'WAS']);
  assert.deepEqual(nflWeekGames(null, null, null), []);
});

test('nflDivisionLeaders takes each division leader, runner-up games back, AFC first', () => {
  const rows = nflDivisionLeaders(HOME_STANDINGS);
  assert.deepEqual(rows.map((r) => r.division), ['AFC North', 'AFC South', 'NFC East']);
  assert.deepEqual(rows[1].leader, { abbr: 'JAX', name: 'Jacksonville Jaguars', record: '5-2', differential: 41 });
  assert.equal(rows[1].next.gb, 3);
  assert.equal(rows[2].leader.record, '4-2-1');
  assert.equal(rows[2].next.gb, 2);
  assert.equal(rows[0].next, null);
  assert.deepEqual(nflDivisionLeaders({}), []);
});

test('oddsBits and slateCounts summarise a card and a slate', () => {
  assert.deepEqual(oddsBits({ details: 'BAL -3.5', total: 47.5 }), ['BAL -3.5', 'O/U 47.5']);
  assert.deepEqual(oddsBits({ details: '', total: null }), []);
  assert.deepEqual(oddsBits(null), []);
  assert.deepEqual(slateCounts([{ state: 'post' }, { state: 'in' }, { state: 'pre' }, null]), { total: 4, final: 1, live: 1 });
  assert.deepEqual(slateCounts(undefined), { total: 0, final: 0, live: 0 });
});

test('etKickoff formats in Eastern time and rejects junk', () => {
  assert.equal(etKickoff('2026-11-06T01:15:00Z'), 'Thu 8:15 PM ET');
  assert.equal(etKickoff('2026-11-08T18:00:00Z'), 'Sun 1:00 PM ET');
  assert.equal(etKickoff('not a date'), '');
  assert.equal(etKickoff(''), '');
});

test('slateDay flips at midnight Pacific and holds yesterday while it is live', () => {
  // 11:30pm ET Nov 4: still Nov 4.
  assert.equal(slateDay(new Date('2026-11-05T04:30:00Z')), '20261104');
  // 1:30am ET Nov 5 (10:30pm PT Nov 4): still Nov 4, live or not.
  assert.equal(slateDay(new Date('2026-11-05T06:30:00Z')), '20261104');
  assert.equal(slateDay(new Date('2026-11-05T06:30:00Z'), true), '20261104');
  // 3:30am ET Nov 5: Nov 5, unless a Nov 4 game is still going.
  assert.equal(slateDay(new Date('2026-11-05T08:30:00Z')), '20261105');
  assert.equal(slateDay(new Date('2026-11-05T08:30:00Z'), true), '20261104');
  // Month boundary on the held day.
  assert.equal(slateDay(new Date('2026-12-01T09:00:00Z'), true), '20261130');
  assert.equal(slateDay('junk'), null);
});

test('nflWeekCutoff is 6am ET the Tuesday after, across DST', () => {
  // Monday night game, EST: Tue Nov 10 06:00 EST = 11:00 UTC.
  assert.equal(new Date(nflWeekCutoff('2026-11-10T01:15:00Z')).toISOString(), '2026-11-10T11:00:00.000Z');
  // Sunday game in EDT: Tue Sep 15 06:00 EDT = 10:00 UTC.
  assert.equal(new Date(nflWeekCutoff('2026-09-13T17:00:00Z')).toISOString(), '2026-09-15T10:00:00.000Z');
  assert.equal(nflWeekCutoff(''), null);
});

test('nflSlateWeek keeps a week up until Tuesday 6am ET after its last game', () => {
  const schedule = {
    week: 9,
    games: [
      { week: 8, kickoff_utc: '2026-11-01T18:00:00Z' },
      { week: 8, kickoff_utc: '2026-11-03T01:15:00Z' }, // Mon Nov 2, 8:15pm ET
      { week: 9, kickoff_utc: '2026-11-06T01:15:00Z' },
      { week: 9, kickoff_utc: '2026-11-10T01:15:00Z' },
    ],
  };
  assert.equal(nflSlateWeek(schedule, new Date('2026-11-03T04:00:00Z')), 8, 'Monday night, game just ended');
  assert.equal(nflSlateWeek(schedule, new Date('2026-11-03T10:59:00Z')), 8, '5:59am ET Tuesday');
  assert.equal(nflSlateWeek(schedule, new Date('2026-11-03T11:00:00Z')), 9, '6am ET Tuesday');
  assert.equal(nflSlateWeek(schedule, new Date('2027-02-01T00:00:00Z')), 9, 'after the season: last week');
  assert.equal(nflSlateWeek({ week: 4, games: [] }, new Date()), 4);
  assert.equal(nflSlateWeek(null, new Date()), null);
});
