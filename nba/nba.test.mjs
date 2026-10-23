import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  etDate,
  parseBoxScore,
  parseRoster,
  parseScoreboard,
  parseStandings,
  parseTeamSchedule,
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
