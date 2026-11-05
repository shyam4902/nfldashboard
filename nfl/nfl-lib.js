// Pure helpers for the NFL compare and player views (/nfl/#compare, #player).
//
// No DOM, no network, no globals: every function reads the data it is given
// and returns plain objects, so `node --test nfl/nfl-lib.test.mjs` covers them.
// The page loads this file with a dynamic import() from nfl/js/views.js, the
// same way league.js borrows parseLeaders from /nba/nba.js. Missing keys and
// junk entries produce empty results or nulls, never invented numbers.

import { barShares, smallImg, parseLeaders, contrastRatio, textOn, readableOn, ordinal } from '../nba/nba.js?v=20261106b';

export { barShares, smallImg, parseLeaders, contrastRatio, textOn, readableOn, ordinal };

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function num(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(/^\+/, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function cell(value) {
  const text = str(value).trim();
  return text === '' ? null : text;
}

function timeOf(iso) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

/* ── Team codes ─────────────────────────────────────────────────────────── */

// ESPN and nflverse codes that differ from the site's team table
// (nfl_teams / nfl_standings_2026.json use WAS, LAR, JAX).
const TO_LOCAL = { WSH: 'WAS', LA: 'LAR', JAC: 'JAX' };

export function localAbbr(abbr) {
  const up = str(abbr).trim().toUpperCase();
  return TO_LOCAL[up] || up;
}

// team_season_efficiency.json (nflverse) calls the Rams LA.
function efficiencyAbbr(abbr) {
  const local = localAbbr(abbr);
  return local === 'LAR' ? 'LA' : local;
}

/* ── Player search and id matching ──────────────────────────────────────── */

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

// "D.J. Moore Jr." and "DJ Moore" both become "dj moore".
export function normName(name) {
  return str(name)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((part) => part && !NAME_SUFFIXES.has(part))
    .join(' ');
}

// ESPN search returns every sport; only NFL players are kept.
export function parseNflSearch(json) {
  const players = [];
  for (const item of arr(json?.items)) {
    if (str(item?.league).toLowerCase() !== 'nfl') continue;
    if (item?.type && str(item.type).toLowerCase() !== 'player') continue;
    const team = arr(item?.teamRelationships).find((relation) => relation?.type === 'team');
    const id = str(item?.id);
    if (!id) continue;
    players.push({
      id,
      name: str(item.displayName || item.fullName),
      teamAbbr: localAbbr(team?.core?.abbreviation),
      headshot: str(item?.headshot?.href),
    });
  }
  return players;
}

// Roster rows (Supabase nfl_players) carry no ESPN id, so a roster click is
// matched to an ESPN search result by normalised name. A same-name result on
// the same team wins; otherwise only a single same-name result is accepted.
// Anything less certain returns null rather than opening the wrong player.
export function matchSearchPlayer(results, name, teamAbbr) {
  const target = normName(name);
  if (!target) return null;
  const same = arr(results).filter((row) => normName(row?.name) === target);
  if (!same.length) return null;
  const team = localAbbr(teamAbbr);
  const onTeam = team ? same.filter((row) => localAbbr(row.teamAbbr) === team) : [];
  if (onTeam.length === 1) return onTeam[0];
  if (same.length === 1) return same[0];
  return null;
}

/* ── Player page ────────────────────────────────────────────────────────── */

export function parseNflAthlete(json) {
  const athlete = json?.athlete || {};
  const years = num(athlete.experience?.years);
  return {
    id: str(athlete.id),
    name: str(athlete.displayName || athlete.fullName),
    jersey: str(athlete.jersey),
    pos: str(athlete.position?.abbreviation),
    posName: str(athlete.position?.displayName || athlete.position?.name),
    height: str(athlete.displayHeight),
    weight: str(athlete.displayWeight),
    age: num(athlete.age),
    experience: str(athlete.displayExperience) || (years == null ? '' : years === 0 ? 'Rookie' : years + ' yrs'),
    college: str(athlete.college?.name || athlete.college?.shortName),
    status: str(athlete.status?.name),
    headshot: str(athlete.headshot?.href),
    team: {
      id: str(athlete.team?.id),
      abbr: localAbbr(athlete.team?.abbreviation),
      name: str(athlete.team?.displayName || athlete.team?.name),
    },
  };
}

// Columns as label + stable stat name. NFL labels repeat across groups
// (passing YDS, rushing YDS), so values stay index-aligned arrays.
function columnsOf(block) {
  const labels = arr(block?.labels).map(str);
  const names = arr(block?.names).map(str);
  return labels.map((label, i) => ({ label, name: names[i] || '' }));
}

// Overview averages: the Regular Season and Career splits only.
export function parseNflOverview(json) {
  const stats = json?.statistics || {};
  const columns = columnsOf(stats);
  const splits = arr(stats.splits);
  const find = (re) => splits.find((split) => re.test(str(split?.displayName)));
  const season = find(/regular season/i);
  const career = find(/^career$/i);
  const values = (split) => (split ? columns.map((_, i) => cell(arr(split.stats)[i])) : null);
  return {
    columns,
    season: values(season),
    career: values(career),
  };
}

// Column groups ("Passing" x11, "Rushing" x5). When the counts do not add up
// to the label list the whole row is one unnamed group.
function groupsOf(json, total) {
  const groups = arr(json?.categories)
    .map((c) => ({ name: str(c?.name), label: str(c?.displayName || c?.name), count: num(c?.count) }))
    .filter((g) => g.count && g.count > 0);
  const sum = groups.reduce((acc, g) => acc + g.count, 0);
  if (!groups.length || sum !== total) return total ? [{ name: '', label: '', count: total }] : [];
  let start = 0;
  return groups.map((g) => {
    const out = { ...g, start };
    start += g.count;
    return out;
  });
}

// Game log split by season type, newest first. Each game keeps its stats as an
// array aligned to `columns`; `totals` is the season-type summary row when
// ESPN sends one.
export function parseNflGameLog(json) {
  const columns = columnsOf(json);
  const groups = groupsOf(json, columns.length);
  const events = json?.events && typeof json.events === 'object' ? json.events : {};
  const seasons = [];

  for (const seasonType of arr(json?.seasonTypes)) {
    const name = str(seasonType?.displayName) || 'Season';
    const statsById = new Map();
    for (const category of arr(seasonType?.categories)) {
      for (const entry of arr(category?.events)) {
        const id = str(entry?.eventId);
        if (id && !statsById.has(id)) statsById.set(id, arr(entry?.stats));
      }
    }
    const games = [];
    for (const [id, stats] of statsById) {
      const event = events[id];
      if (!event || typeof event !== 'object') continue;
      games.push({
        id,
        week: num(event.week),
        date: str(event.gameDate),
        atVs: str(event.atVs),
        opponentAbbr: localAbbr(event?.opponent?.abbreviation),
        result: str(event.gameResult),
        score: str(event.score),
        stats: columns.map((_, i) => cell(stats[i])),
      });
    }
    if (!games.length) continue;
    games.sort((a, b) => timeOf(b.date) - timeOf(a.date));
    const total = arr(seasonType?.summary?.stats).find((row) => str(row?.type) === 'total');
    seasons.push({
      name,
      games,
      totals: total ? columns.map((_, i) => cell(arr(total.stats)[i])) : null,
    });
  }

  seasons.sort((a, b) => timeOf(b.games[0]?.date) - timeOf(a.games[0]?.date));
  return { columns, groups, seasons };
}

const DEFENSE = ['DE', 'DT', 'NT', 'DL', 'EDGE', 'LB', 'ILB', 'OLB', 'MLB', 'CB', 'S', 'FS', 'SS', 'DB'];

function positionKind(pos) {
  const p = str(pos).toUpperCase();
  if (p === 'QB') return 'qb';
  if (p === 'RB' || p === 'FB' || p === 'HB') return 'rb';
  if (p === 'WR' || p === 'TE') return 'rec';
  if (p === 'K' || p === 'PK') return 'k';
  if (p === 'P') return 'p';
  if (DEFENSE.includes(p)) return 'def';
  return '';
}

const GROUP_ORDER = {
  qb: ['passing', 'rushing'],
  rb: ['rushing', 'receiving'],
  rec: ['receiving', 'rushing'],
  def: ['defensive', 'defensiveInterceptions', 'interceptions'],
  k: ['kicking'],
  p: ['punting'],
};

// The player's own stat group first: a QB leads with passing, a corner with
// defense. Unlisted groups keep ESPN's order after the listed ones.
export function orderGroups(groups, pos) {
  const order = GROUP_ORDER[positionKind(pos)] || [];
  const rank = (g) => {
    const i = order.indexOf(g.name);
    return i < 0 ? order.length : i;
  };
  return arr(groups).map((g, i) => ({ g, i })).sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i).map((x) => x.g);
}

const HERO_KEYS = {
  qb: ['passingYards', 'passingTouchdowns', 'interceptions', 'completionPct', 'QBRating', 'rushingYards'],
  rb: ['rushingYards', 'rushingTouchdowns', 'yardsPerRushAttempt', 'rushingAttempts', 'receptions', 'receivingYards'],
  rec: ['receptions', 'receivingYards', 'receivingTouchdowns', 'yardsPerReception', 'receivingTargets'],
  def: ['totalTackles', 'sacks', 'tacklesForLoss', 'interceptions', 'passesDefended', 'fumblesForced'],
  k: ['fieldGoalsMade', 'fieldGoalPct', 'longFieldGoalMade', 'extraPointsMade', 'totalKickingPoints'],
  p: ['punts', 'grossAvgPuntYards', 'netAvgPuntYards', 'puntsInside20'],
};

// Hero tiles for the regular season, chosen by position from the overview
// stat names. With no name match it falls back to the first six columns that
// have a value. Values are ESPN's display strings, unchanged.
export function heroStats(overview, pos) {
  const columns = arr(overview?.columns);
  const season = arr(overview?.season);
  const has = (i) => season[i] != null;
  const keys = HERO_KEYS[positionKind(pos)] || [];
  const picked = [];
  for (const key of keys) {
    const i = columns.findIndex((c) => c.name === key);
    if (i >= 0 && has(i)) picked.push({ label: columns[i].label, value: season[i] });
  }
  if (picked.length) return picked;
  return columns.map((c, i) => ({ label: c.label, value: season[i] })).filter((_, i) => has(i)).slice(0, 6);
}

/* ── Team compare ───────────────────────────────────────────────────────── */

export function isFinalGame(game) {
  return Boolean(game) && (game.status === 'final' || Boolean(game.winner)) &&
    game.away_score != null && game.home_score != null;
}

// Default compare pick: the first kickoff of the current week. With no games
// in that week, the next game from `nowMs`, else the last game listed.
export function pickDefaultGame(games, week, nowMs = Date.now()) {
  const list = arr(games).filter((g) => g && g.away_team && g.home_team && g.kickoff_utc)
    .slice().sort((a, b) => timeOf(a.kickoff_utc) - timeOf(b.kickoff_utc));
  if (!list.length) return null;
  const inWeek = list.filter((g) => Number(g.week) === Number(week));
  if (inWeek.length) return inWeek[0];
  return list.find((g) => timeOf(g.kickoff_utc) >= nowMs) || list[list.length - 1];
}

// Completed games for one team, newest first, from that team's side.
export function lastResults(games, teamName, count = 5) {
  return arr(games).filter((g) => isFinalGame(g) && (g.home_team === teamName || g.away_team === teamName))
    .slice().sort((a, b) => timeOf(b.kickoff_utc) - timeOf(a.kickoff_utc))
    .slice(0, count)
    .map((g) => {
      const home = g.home_team === teamName;
      const us = home ? g.home_score : g.away_score;
      const them = home ? g.away_score : g.home_score;
      return {
        id: str(g.game_id),
        week: num(g.week),
        atVs: home ? 'vs' : '@',
        opponent: home ? g.away_team : g.home_team,
        result: us > them ? 'W' : us < them ? 'L' : 'T',
        score: us + '-' + them,
      };
    });
}

// Every meeting of the two teams in the schedule, oldest first.
export function headToHead(games, teamA, teamB) {
  return arr(games).filter((g) => (g.home_team === teamA && g.away_team === teamB) || (g.home_team === teamB && g.away_team === teamA))
    .slice().sort((a, b) => timeOf(a.kickoff_utc) - timeOf(b.kickoff_utc))
    .map((g) => {
      const final = isFinalGame(g);
      return {
        id: str(g.game_id),
        week: num(g.week),
        kickoff: str(g.kickoff_utc),
        away: g.away_team,
        home: g.home_team,
        awayScore: final ? g.away_score : null,
        homeScore: final ? g.home_score : null,
        final,
        winner: final ? (g.away_score > g.home_score ? g.away_team : g.home_score > g.away_score ? g.home_team : '') : '',
      };
    });
}

function perGame(total, games) {
  const t = num(total);
  const g = num(games);
  return t == null || !g ? null : t / g;
}

function fixed(value, digits) {
  return value == null ? '—' : value.toFixed(digits);
}

function signed(value, digits) {
  if (value == null) return '—';
  const text = value.toFixed(digits);
  return value > 0 ? '+' + text : text;
}

function percent(value) {
  return value == null ? '—' : (value * 100).toFixed(1) + '%';
}

// Tale-of-the-tape rows. `read` pulls one number from a team's sources;
// `lower` marks rows where the smaller value is better. Every row also gets a
// league rank across the teams that have the value.
export const NFL_COMPARE_ROWS = [
  { key: 'record', label: 'Record', read: (s) => s.standing?.win_pct ?? null,
    text: (s) => (s.standing ? s.standing.wins + '-' + s.standing.losses + (s.standing.ties ? '-' + s.standing.ties : '') : '—') },
  { key: 'ppg', label: 'Points / g', read: (s) => perGame(s.standing?.points_for, s.standing?.played), text: (v) => fixed(v, 1) },
  { key: 'oppPpg', label: 'Allowed / g', read: (s) => perGame(s.standing?.points_against, s.standing?.played), text: (v) => fixed(v, 1), lower: true },
  { key: 'diff', label: 'Margin / g', read: (s) => perGame(s.standing?.differential, s.standing?.played), text: (v) => signed(v, 1) },
  { key: 'ypg', label: 'Yards / g', read: (s) => perGame(s.totals?.total_yards, s.totals?.games), text: (v) => fixed(v, 1) },
  { key: 'passYpg', label: 'Pass yds / g', read: (s) => perGame(s.totals?.pass_yards, s.totals?.games), text: (v) => fixed(v, 1) },
  { key: 'rushYpg', label: 'Rush yds / g', read: (s) => perGame(s.totals?.rush_yards, s.totals?.games), text: (v) => fixed(v, 1) },
  { key: 'ydsAllowed', label: 'Yds allowed / g', read: (s) => perGame(s.totals?.yards_allowed, s.totals?.games), text: (v) => fixed(v, 1), lower: true },
  { key: 'offEpa', label: 'Off EPA / play', read: (s) => num(s.off?.epa_per_play), text: (v) => signed(v, 3) },
  { key: 'defEpa', label: 'Def EPA / play', read: (s) => num(s.def?.epa_per_play), text: (v) => signed(v, 3), lower: true },
  { key: 'offSr', label: 'Off success', read: (s) => num(s.off?.success_rate), text: percent },
  { key: 'defSr', label: 'Def success', read: (s) => num(s.def?.success_rate), text: percent, lower: true },
  { key: 'offYpp', label: 'Off yds / play', read: (s) => num(s.off?.yds_per_play), text: (v) => fixed(v, 2) },
  { key: 'defYpp', label: 'Def yds / play', read: (s) => num(s.def?.yds_per_play), text: (v) => fixed(v, 2), lower: true },
  { key: 'offSack', label: 'Sacked rate', read: (s) => num(s.off?.sack_rate), text: percent, lower: true },
  { key: 'defSack', label: 'Sack rate', read: (s) => num(s.def?.sack_rate), text: percent },
  { key: 'offTo', label: 'Giveaway rate', read: (s) => num(s.off?.turnover_rate), text: percent, lower: true },
  { key: 'defTo', label: 'Takeaway rate', read: (s) => num(s.def?.turnover_rate), text: percent },
];

function rankAmong(values, mine, lower) {
  if (mine == null) return null;
  const ahead = values.filter((v) => (lower ? v < mine : v > mine)).length;
  return ahead + 1;
}

// One team's sources out of the three committed artifacts: the standings row,
// the Sleeper team totals row and the nflverse efficiency rows (off and def)
// for the given season.
function sourcesFor(abbr, data, season) {
  const local = localAbbr(abbr);
  const eff = efficiencyAbbr(abbr);
  const effRows = arr(data.efficiency).filter((r) => r && Number(r.season) === Number(season) && r.team === eff);
  return {
    abbr: local,
    standing: arr(data.standings).find((t) => localAbbr(t?.abbr) === local) || null,
    totals: arr(data.totals).find((t) => localAbbr(t?.abbr) === local) || null,
    off: effRows.find((r) => r.side === 'off') || null,
    def: effRows.find((r) => r.side === 'def') || null,
  };
}

// Tale-of-the-tape rows for two teams. Each row carries both raw values (for
// the bars), display text, and each side's league rank among `allAbbrs`.
// Rows where neither team has a value are dropped.
export function compareRows(abbrA, abbrB, data, allAbbrs) {
  const season = data.season ?? Math.max(0, ...arr(data.efficiency).map((r) => Number(r?.season) || 0));
  const everyone = arr(allAbbrs).map((abbr) => sourcesFor(abbr, data, season));
  const a = sourcesFor(abbrA, data, season);
  const b = sourcesFor(abbrB, data, season);
  const rows = [];
  for (const row of NFL_COMPARE_ROWS) {
    const va = row.read(a);
    const vb = row.read(b);
    if (va == null && vb == null) continue;
    const all = everyone.map(row.read).filter((v) => v != null);
    const text = (src, v) => (row.key === 'record' ? row.text(src) : row.text(v));
    rows.push({
      key: row.key,
      label: row.label,
      lower: Boolean(row.lower),
      a: { value: va, text: text(a, va), rank: rankAmong(all, va, row.lower), of: all.length },
      b: { value: vb, text: text(b, vb), rank: rankAmong(all, vb, row.lower), of: all.length },
      share: barShares(va, vb, row.lower),
      lead: va != null && vb != null && va !== vb ? ((row.lower ? va < vb : va > vb) ? 'a' : 'b') : '',
    });
  }
  return rows;
}

/* ── Team colours ───────────────────────────────────────────────────────── */

function hexOf(value) {
  const text = str(value).trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(text);
  return m ? '#' + m[1].toLowerCase() : '';
}

const NEUTRAL = '#3b4261';

// Fill and text colour for a team block, from the nfl_teams row.
export function teamLook(team) {
  const fill = hexOf(team?.primary_color) || NEUTRAL;
  return { fill, ink: textOn(fill), alt: hexOf(team?.secondary_color) };
}

// Two near-identical colours make the bars unreadable, so the second team
// moves to its secondary colour when that separates them.
export function separateLooks(a, b) {
  if (contrastRatio(a.fill, b.fill) >= 1.35 || !b.alt) return [a, b];
  if (contrastRatio(a.fill, b.alt) < 1.35) return [a, b];
  return [a, { ...b, fill: b.alt, ink: textOn(b.alt) }];
}

/* ── Team page (#team/<ABBR>) and Teams grid ────────────────────────────── */

// "6-1" or "6-1-1". Ties only show when there is one.
export function recordText(rec) {
  if (!rec) return '';
  const w = num(rec.wins ?? rec.w);
  const l = num(rec.losses ?? rec.l);
  const t = num(rec.ties ?? rec.t) || 0;
  if (w == null || l == null) return '';
  return w + '-' + l + (t ? '-' + t : '');
}

function scoreOf(g, home) {
  return home ? [g.home_score, g.away_score] : [g.away_score, g.home_score];
}

// One team's season from schedule.json, in kickoff order. Weeks with no game
// up to `totalWeeks` become bye rows. `nextId` is the first game that is not
// final, so the page can mark it.
export function teamSchedule(games, teamName, totalWeeks) {
  const own = arr(games).filter((g) => g && (g.home_team === teamName || g.away_team === teamName))
    .slice().sort((a, b) => timeOf(a.kickoff_utc) - timeOf(b.kickoff_utc));
  const rows = own.map((g) => {
    const home = g.home_team === teamName;
    const final = isFinalGame(g);
    const [us, them] = scoreOf(g, home);
    return {
      id: str(g.game_id),
      week: num(g.week),
      kickoff: str(g.kickoff_utc),
      home,
      atVs: home ? 'vs' : '@',
      opponent: home ? g.away_team : g.home_team,
      final,
      live: !final && g.status === 'in_progress',
      result: final ? (us > them ? 'W' : us < them ? 'L' : 'T') : '',
      us: final ? us : null,
      them: final ? them : null,
      tv: str(g.tv),
    };
  });
  const weeks = new Set(rows.map((r) => r.week));
  const total = num(totalWeeks);
  if (total && rows.length) {
    for (let w = 1; w <= total; w++) {
      if (!weeks.has(w)) rows.push({ id: '', week: w, bye: true });
    }
    rows.sort((a, b) => (a.week ?? 99) - (b.week ?? 99) || timeOf(a.kickoff) - timeOf(b.kickoff));
  }
  const next = rows.find((r) => !r.bye && !r.final);
  return { rows, nextId: next ? next.id : '' };
}

// Home and road records, current streak ("W3") and last-five string, from
// completed finals only. No finals = empty strings, never "0-0".
export function teamSplits(games, teamName) {
  const finals = arr(games).filter((g) => isFinalGame(g) && (g.home_team === teamName || g.away_team === teamName))
    .slice().sort((a, b) => timeOf(a.kickoff_utc) - timeOf(b.kickoff_utc));
  const home = { w: 0, l: 0, t: 0 };
  const road = { w: 0, l: 0, t: 0 };
  const results = finals.map((g) => {
    const isHome = g.home_team === teamName;
    const [us, them] = scoreOf(g, isHome);
    const r = us > them ? 'W' : us < them ? 'L' : 'T';
    const side = isHome ? home : road;
    side[r === 'W' ? 'w' : r === 'L' ? 'l' : 't']++;
    return r;
  });
  let streak = '';
  if (results.length) {
    const last = results[results.length - 1];
    let n = 0;
    for (let i = results.length - 1; i >= 0 && results[i] === last; i--) n++;
    streak = last + n;
  }
  const played = (rec) => rec.w + rec.l + rec.t;
  return {
    played: results.length,
    home: played(home) ? recordText(home) : '',
    road: played(road) ? recordText(road) : '',
    streak,
    last5: results.slice(-5).join(''),
  };
}

// The season grid on the team page: one cell per stat with the team's league
// rank among the teams that have that number. Reuses the compare rows so both
// views read the same sources the same way. Cells with no value are dropped.
export const NFL_TEAM_STAT_KEYS = [
  ['ppg', 'Points / g'], ['oppPpg', 'Allowed / g'], ['diff', 'Margin / g'],
  ['ypg', 'Yards / g'], ['passYpg', 'Pass yds / g'], ['rushYpg', 'Rush yds / g'],
  ['ydsAllowed', 'Yds allowed / g'], ['offEpa', 'Off EPA / play'], ['defEpa', 'Def EPA / play'],
  ['offSr', 'Off success'], ['defSack', 'Sack rate'], ['defTo', 'Takeaway rate'],
];

export function teamStatCells(abbr, data, allAbbrs) {
  const season = data.season ?? Math.max(0, ...arr(data.efficiency).map((r) => Number(r?.season) || 0));
  const everyone = arr(allAbbrs).map((a) => sourcesFor(a, data, season));
  const mine = sourcesFor(abbr, data, season);
  const cells = [];
  for (const [key, label] of NFL_TEAM_STAT_KEYS) {
    const row = NFL_COMPARE_ROWS.find((r) => r.key === key);
    if (!row) continue;
    const value = row.read(mine);
    if (value == null) continue;
    const all = everyone.map(row.read).filter((v) => v != null);
    cells.push({ key, label, value, text: row.text(value), rank: rankAmong(all, value, row.lower), of: all.length });
  }
  return cells;
}

// ESPN site API team roster. `/teams/<id>/roster` groups athletes by unit
// ({ position, items }); `/teams/<id>?enable=roster` sends team.athletes flat.
// Both shapes become one flat list.
export function parseEspnRoster(json) {
  const raw = arr(json?.athletes).length ? arr(json.athletes) : arr(json?.team?.athletes);
  const flat = raw.flatMap((entry) => (Array.isArray(entry?.items) ? entry.items : [entry]));
  const out = [];
  for (const a of flat) {
    const id = str(a?.id);
    const name = str(a?.fullName || a?.displayName);
    if (!id || !name) continue;
    out.push({
      id,
      name,
      jersey: str(a.jersey),
      pos: str(a.position?.abbreviation),
      headshot: str(a.headshot?.href),
    });
  }
  return out;
}

// Supabase roster rows carry no ESPN id. Each row is matched to the ESPN team
// roster by normalised name; when two ESPN players share the name, the jersey
// number decides, and if that is not unique either the row stays unmatched.
// Unmatched rows come back with id '' so the page falls back to search.
export function attachEspnIds(rows, espnPlayers) {
  const byName = new Map();
  for (const p of arr(espnPlayers)) {
    const key = normName(p?.name);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(p);
  }
  return arr(rows).map((row) => {
    const same = byName.get(normName(row?.name)) || [];
    let hit = same.length === 1 ? same[0] : null;
    if (!hit && same.length > 1 && row?.num != null && row.num !== '') {
      const byJersey = same.filter((p) => str(p.jersey) === str(row.num));
      hit = byJersey.length === 1 ? byJersey[0] : null;
    }
    return { ...row, espnId: hit ? hit.id : '', headshot: hit ? hit.headshot : '' };
  });
}

// Position order for the roster grid, offense to special teams.
const POSITION_ORDER = ['QB', 'RB', 'HB', 'FB', 'WR', 'TE', 'OT', 'T', 'OL', 'G', 'OG', 'C',
  'EDGE', 'DE', 'DT', 'NT', 'DL', 'LB', 'OLB', 'ILB', 'MLB', 'CB', 'DB', 'S', 'FS', 'SS', 'K', 'PK', 'P', 'LS'];

export function sortRoster(rows) {
  const rank = (pos) => {
    const i = POSITION_ORDER.indexOf(str(pos).toUpperCase());
    return i < 0 ? POSITION_ORDER.length : i;
  };
  const jersey = (row) => {
    const n = num(row?.num);
    return n == null ? 1000 : n;
  };
  return arr(rows).slice().sort((a, b) => rank(a?.pos) - rank(b?.pos) || jersey(a) - jersey(b) ||
    str(a?.name).localeCompare(str(b?.name)));
}
