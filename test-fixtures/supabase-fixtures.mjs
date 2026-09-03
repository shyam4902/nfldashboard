// Node mirror of test-fixtures/browser_fixtures.py for props-smoke.mjs.
//
// Intercepts the dashboard's runtime DATA feeds (Supabase REST, nflverse
// games.csv, espncdn logos) with deterministic fixtures derived from committed
// repo data — see test-fixtures/README.md. CDN libraries still load from the
// network. Set LIVE_SMOKE=1 before running props-smoke.mjs to skip
// interception and hit real services.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SUPABASE_PATTERN = 'https://nedyoydylpbjvihaoexy.supabase.co/**';
const NFLVERSE_PATTERN = 'https://raw.githubusercontent.com/nflverse/**';
const ESPNCDN_PATTERN = 'https://a.espncdn.com/**';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

const TEAM_COLOR_OVERRIDES = {
  'New England Patriots': '#C60C30', 'Seattle Seahawks': '#69BE28',
  'Houston Texans': '#A71930', 'Cleveland Browns': '#FF3C00',
  'Dallas Cowboys': '#003594', 'Baltimore Ravens': '#6B3FA0',
  'Green Bay Packers': '#187A44', 'Indianapolis Colts': '#00529B',
  'New York Giants': '#0053A0', 'New York Jets': '#007A53',
  'Philadelphia Eagles': '#007A65', 'Washington Commanders': '#8C182A',
};
const DEFAULT_COLOR = '#3b82f6';

const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
};
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'apikey,authorization,content-type,prefer,x-client-info,range',
};

async function loadFixtureData(root) {
  const rosterRows = JSON.parse(await readFile(join(root, 'nfl_rosters_2026.json'), 'utf8'));
  const seen = new Map();
  for (const p of rosterRows) {
    if (p.team_name && !seen.has(p.team_name)) seen.set(p.team_name, p);
  }
  const teams = [...seen.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([name, p], i) => ({
      id: String(i + 1),
      name,
      abbr: p.team_abbr || '',
      division: p.division || '',
      primary_color: TEAM_COLOR_OVERRIDES[name] || DEFAULT_COLOR,
      // no cap fields: missing cap renders as "Unavailable", never a fake $0
    }));
  const teamId = new Map(teams.map(t => [t.name, t.id]));
  const players = rosterRows.map((p, i) => ({
    ...p,
    id: String(i + 1),
    team_id: teamId.get(p.team_name),
  }));
  const transactions = JSON.parse(
    await readFile(join(root, 'test-fixtures', 'nfl_transactions.json'), 'utf8'))
    .sort((a, b) => String(b.sort_date).localeCompare(String(a.sort_date)));

  const schedule = JSON.parse(await readFile(join(root, 'schedule.json'), 'utf8'));
  const abbrOf = new Map(teams.map(t => [t.name, t.abbr]));
  const header = ['season', 'game_type', 'week', 'away_team', 'home_team',
    'spread_line', 'total_line', 'away_moneyline', 'home_moneyline'];
  const rows = schedule.games.map((g, i) => [
    '2026', 'REG', String(g.week), abbrOf.get(g.away_team) || g.away_team,
    abbrOf.get(g.home_team) || g.home_team,
    String(-(i % 6) - 1), String(40 + (i % 14)), String(120 + i), String(-130 - i),
  ].join(','));
  const gamesCsv = [header.join(','), ...rows, ''].join('\n');

  return { teams, players, transactions, gamesCsv };
}

function tableResponse(data, url) {
  const u = new URL(url);
  const table = u.pathname.replace(/\/$/, '').split('/').pop();
  if (table === 'nfl_teams') return JSON.stringify(data.teams);
  if (table === 'nfl_players') {
    const offset = Number(u.searchParams.get('offset') || 0);
    const limit = Number(u.searchParams.get('limit') || 1000);
    return JSON.stringify(data.players.slice(offset, offset + limit));
  }
  if (table === 'nfl_transactions') return JSON.stringify(data.transactions);
  return '[]';
}

export async function installFixtures(page, root) {
  const data = await loadFixtureData(root);

  const handle = async (route, request) => {
    const url = request.url();
    if (url.includes('supabase.co')) {
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' });
        return;
      }
      await route.fulfill({ status: 200, headers: JSON_HEADERS, body: tableResponse(data, url) });
    } else if (url.includes('raw.githubusercontent.com/nflverse')) {
      await route.fulfill({ status: 200, headers: { 'content-type': 'text/csv' }, body: data.gamesCsv });
    } else {
      await route.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: TINY_PNG });
    }
  };

  await page.route(SUPABASE_PATTERN, handle);
  await page.route(NFLVERSE_PATTERN, handle);
  await page.route(ESPNCDN_PATTERN, handle);
  console.log('[browser fixtures] intercepting Supabase + nflverse + espncdn with committed-data fixtures');
}
