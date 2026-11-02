#!/usr/bin/env node
// Freeze one NBA date for the design/polish variants.
//
//   node design/polish/freeze.mjs 20261101            # featured game picked for you
//   node design/polish/freeze.mjs 20261101 401909905  # or name it
//
// Saves raw ESPN responses (nothing edited) into design/polish/fixtures/ and
// rewrites fixtures/manifest.js, which the variant pages read through shim.js:
// the scoreboard, a summary for every game on it, standings, all six leaders
// boards, statistics / schedule / roster for both featured teams, and the
// athlete pages of each featured team's top scorer. Needs network access to
// site.api.espn.com and site.web.api.espn.com. Files from an earlier freeze
// stay on disk but drop out of the manifest.
import { mkdir, writeFile } from 'node:fs/promises';
import { parseGameFlow, parseScoreboard } from '../../nba/nba.js';

const API = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const STANDINGS_API = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings';
const WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';
// Same boards, same query as LEADER_BOARDS in nba/index.html.
const BOARDS = [
  ['points', 'offensive', 'avgPoints'],
  ['rebounds', 'general', 'avgRebounds'],
  ['assists', 'offensive', 'avgAssists'],
  ['steals', 'defensive', 'avgSteals'],
  ['blocks', 'defensive', 'avgBlocks'],
  ['threes', 'offensive', 'avgThreePointFieldGoalsMade'],
];

const OUT = new URL(process.env.FREEZE_OUT ? 'file://' + process.env.FREEZE_OUT.replace(/\/?$/, '/') : './fixtures/', import.meta.url);
const [date, wanted] = process.argv.slice(2);
if (!/^\d{8}$/.test(date || '')) {
  console.error('usage: node design/polish/freeze.mjs YYYYMMDD [eventId]');
  process.exit(2);
}

const saved = [];
async function save(name, url, { optional = false } = {}) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    if (optional) {
      console.warn('skip', name, 'HTTP', res.status);
      return null;
    }
    throw new Error(name + ': HTTP ' + res.status + ' from ' + url);
  }
  const text = await res.text();
  const json = JSON.parse(text);
  await writeFile(new URL(name, OUT), text);
  saved.push(name);
  console.log('saved', name, Math.round(text.length / 1024) + 'KB');
  return json;
}

await mkdir(OUT, { recursive: true });
const board = await save('scoreboard-' + date + '.json', API + '/scoreboard?dates=' + date);
const games = parseScoreboard(board);
if (!games.length) throw new Error('No games on ' + date);

const summaries = new Map();
for (const game of games) {
  summaries.set(game.id, await save('summary-' + game.id + '.json', API + '/summary?event=' + game.id, { optional: true }));
}

// Featured game: the one named, else the final with the most lead changes,
// then the biggest lead overcome by the winner, then the closest margin.
function score(game) {
  const flow = summaries.get(game.id) ? parseGameFlow(summaries.get(game.id)) : null;
  const win = game.home.winner ? 'home' : 'away';
  const lose = win === 'home' ? 'away' : 'home';
  return [flow ? flow.leadChanges : -1, flow ? flow.largest[lose].lead : -1, -Math.abs((game.home.score || 0) - (game.away.score || 0))];
}
const finals = games.filter((g) => g.state === 'post');
const featured = games.find((g) => g.id === wanted) ||
  finals.slice().sort((a, b) => {
    const x = score(a);
    const y = score(b);
    return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
  })[0] || games[0];
console.log('featured', featured.id, featured.away.abbr, '@', featured.home.abbr);

await save('standings.json', STANDINGS_API);
for (const [key, category, stat] of BOARDS) {
  const url = WEB + '/statistics/byathlete?limit=50&category=' + category + '&sort=' + encodeURIComponent(category + '.' + stat + ':desc');
  await save('leaders-' + key + '.json', url, { optional: true });
}
for (const side of [featured.away, featured.home]) {
  for (const part of ['statistics', 'schedule', 'roster']) {
    await save('team-' + side.id + '-' + part + '.json', API + '/teams/' + side.id + '/' + part, { optional: true });
  }
}

// Each featured team's top scorer in this game, so the player view works too.
const summary = summaries.get(featured.id);
const scorers = new Set();
for (const block of summary?.leaders || []) {
  const points = (block.leaders || []).find((c) => c.name === 'points' || c.name === 'pointsPerGame');
  const id = points?.leaders?.[0]?.athlete?.id;
  if (id) scorers.add(String(id));
}
for (const id of scorers) {
  await save('athlete-' + id + '.json', WEB + '/athletes/' + id, { optional: true });
  await save('athlete-' + id + '-overview.json', WEB + '/athletes/' + id + '/overview', { optional: true });
  await save('athlete-' + id + '-gamelog.json', WEB + '/athletes/' + id + '/gamelog', { optional: true });
}

// 23:59 New York time on the frozen date, so the page's "today" is that day.
const noonUTC = new Date(Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8), 12));
const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })
  .formatToParts(noonUTC).find((p) => p.type === 'timeZoneName').value; // "GMT-4"
const hours = -Number(offset.replace('GMT', '') || 0);
const now = new Date(Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8), 23 + hours, 59)).toISOString().replace('.000', '');
const label = noonUTC.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const manifest = {
  date,
  now,
  featured: featured.id,
  away: featured.away.id,
  home: featured.home.id,
  label,
  note: 'Written by design/polish/freeze.mjs on ' + new Date().toISOString().slice(0, 10) + '.',
  files: saved,
};
await writeFile(new URL('manifest.js', OUT),
  '// Written by design/polish/freeze.mjs. Loaded by the variant pages before\n' +
  '// shim.js. Every file listed is a raw ESPN response saved as-is.\n' +
  'window.POLISH = ' + JSON.stringify(manifest, null, 2) + ';\n');
console.log('wrote manifest.js:', saved.length, 'files, featured', featured.id);
