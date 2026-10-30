// ESPN NBA payload parsers.
//
// Pure and dependency-free: no DOM, no network, no globals. Each parser reads
// the ESPN JSON shape it was given and returns a plain, stable object the page
// can render. Missing keys, empty payloads and junk entries produce an empty
// result instead of a throw, so the UI can always show something.

const STAT_KEYS = ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', 'PF', '+/-'];

// ESPN serves the full-size original unless its resizer is asked for a copy: a
// headshot is ~207KB and a logo ~37KB at full size, versus ~8KB and ~2KB
// resized. `w`/`h` are the 2x sizes of what the page actually displays. Any
// non-espncdn URL, and any URL already going through the resizer, is untouched.
const ESPN_CDN = 'https://a.espncdn.com';

export function smallImg(url, w, h) {
  const value = str(url);
  if (!value) return '';
  if (!value.startsWith(ESPN_CDN + '/')) return value;
  const width = Math.round(Number(w) || 0);
  const height = Math.round(Number(h) || 0);
  if (!width || !height) return value;
  const path = value.slice(ESPN_CDN.length);
  if (path.startsWith('/combiner') || path.includes('?')) return value;
  return ESPN_CDN + '/combiner/i?img=' + path + '&w=' + width + '&h=' + height;
}

// Box-score totals arrive as made-attempted strings ("39-87") and carry no
// percentage field, so the percentage has to be computed from the shot line.
export function shotPct(value) {
  const match = /^(\d+)\s*-\s*(\d+)$/.exec(str(value).trim());
  if (!match) return null;
  const made = Number(match[1]);
  const attempted = Number(match[2]);
  if (!attempted) return null;
  return (made / attempted) * 100;
}

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
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(/^\+/, ''));
  return Number.isFinite(n) ? n : null;
}

function logoOf(team) {
  if (!team) return '';
  if (typeof team.logo === 'string' && team.logo) return team.logo;
  return str(arr(team.logos)[0]?.href);
}

function teamOf(raw, fallbackId) {
  const team = raw?.team || raw || {};
  return {
    id: str(team.id ?? fallbackId),
    abbr: str(team.abbreviation),
    name: str(team.displayName || team.name),
    logo: logoOf(team),
  };
}

function scoreOf(competitor) {
  if (!competitor) return null;
  const score = competitor.score;
  if (score && typeof score === 'object') return num(score.value ?? score.displayValue);
  return num(score);
}

function recordOf(competitor) {
  const records = arr(competitor?.records);
  const overall = records.find((r) => r?.name === 'overall' || r?.type === 'total');
  return str(overall?.summary || records[0]?.summary);
}

function stateOf(status) {
  const state = str(status?.type?.state);
  return state === 'in' || state === 'post' ? state : 'pre';
}

function statusTextOf(status) {
  return str(status?.type?.shortDetail || status?.type?.detail || status?.type?.description);
}

// ESPN's ?dates= is the Eastern date, so a 10:30pm ET tip-off is the next UTC
// day. Same approach as sync_scores.js: format in America/New_York, then pack.
export function etDate(dateOrIso) {
  const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  if (!d || Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}${parts.month}${parts.day}`;
}

function pointsLeader(competitor) {
  const points = arr(competitor?.leaders).find((category) => str(category?.name) === 'points');
  const top = arr(points?.leaders)[0];
  if (!top) return null;
  const name = str(top.athlete?.displayName || top.athlete?.fullName);
  if (!name) return null;
  return { name, line: str(top.displayValue) + ' PTS' };
}

export function parseScoreboard(json) {
  const games = [];
  for (const event of arr(json?.events)) {
    const competition = arr(event.competitions)[0];
    if (!competition) continue;

    const sides = { home: null, away: null };
    const raw = { home: null, away: null };
    for (const competitor of arr(competition.competitors)) {
      const side = {
        ...teamOf(competitor),
        score: scoreOf(competitor),
        record: recordOf(competitor),
        winner: competitor.winner === true,
      };
      if (competitor.homeAway === 'home') {
        sides.home = side;
        raw.home = competitor;
      } else if (competitor.homeAway === 'away') {
        sides.away = side;
        raw.away = competitor;
      }
    }
    if (!sides.home || !sides.away) continue;

    const status = competition.status || event.status || {};
    const broadcast = arr(competition.broadcasts)
      .flatMap((b) => arr(b?.names).map(str))
      .filter(Boolean)
      .join(', ');

    games.push({
      id: str(event.id ?? competition.id),
      state: stateOf(status),
      statusText: statusTextOf(status),
      startISO: str(event.date || competition.date),
      broadcast,
      away: sides.away,
      home: sides.home,
      leaders: pointsLeader(raw.away) || pointsLeader(raw.home)
        ? { away: pointsLeader(raw.away), home: pointsLeader(raw.home) }
        : null,
    });
  }
  return games;
}

function statsIndex(stats) {
  const byName = new Map();
  const byType = new Map();
  for (const stat of arr(stats)) {
    if (!stat || typeof stat !== 'object') continue;
    if (stat.name) byName.set(str(stat.name), stat);
    if (stat.type) byType.set(str(stat.type).toLowerCase(), stat);
  }
  return { byName, byType };
}

function statValue(index, names, types) {
  for (const name of names) {
    const stat = index.byName.get(name);
    if (stat) return stat;
  }
  for (const type of types) {
    const stat = index.byType.get(type);
    if (stat) return stat;
  }
  return null;
}

function statText(stat) {
  if (!stat) return '';
  if (stat.displayValue != null) return str(stat.displayValue);
  if (stat.value != null) return str(stat.value);
  return '';
}

function standingsRow(entry) {
  const team = entry?.team;
  if (!team) return null;
  const index = statsIndex(entry.stats);

  const seedStat = statValue(index, ['playoffSeed'], ['playoffseed']);
  const pctStat = statValue(index, ['winPercent'], ['winpercent']);
  const winsStat = statValue(index, ['wins'], ['wins']);
  const lossesStat = statValue(index, ['losses'], ['losses']);
  const gbStat = statValue(index, ['gamesBehind'], ['gamesbehind']);
  const streakStat = statValue(index, ['streak'], ['streak']);
  const last10Stat = statValue(index, ['Last Ten Games'], ['lasttengames']);
  const ppgStat = statValue(index, ['avgPointsFor'], ['avgpointsfor']);
  const oppPpgStat = statValue(index, ['avgPointsAgainst'], ['avgpointsagainst']);

  return {
    teamId: str(team.id),
    abbr: str(team.abbreviation),
    name: str(team.displayName || team.name),
    logo: logoOf(team),
    wins: num(winsStat?.value ?? winsStat?.displayValue),
    losses: num(lossesStat?.value ?? lossesStat?.displayValue),
    pct: num(pctStat?.value ?? pctStat?.displayValue),
    gb: statText(gbStat),
    streak: statText(streakStat),
    last10: statText(last10Stat),
    seed: num(seedStat?.value ?? seedStat?.displayValue),
    ppg: num(ppgStat?.value ?? ppgStat?.displayValue),
    oppPpg: num(oppPpgStat?.value ?? oppPpgStat?.displayValue),
  };
}

export function parseStandings(json) {
  const conferences = { East: [], West: [] };
  for (const child of arr(json?.children)) {
    const name = str(child?.name);
    const abbr = str(child?.abbreviation);
    let key = null;
    if (abbr === 'East' || /eastern/i.test(name)) key = 'East';
    else if (abbr === 'West' || /western/i.test(name)) key = 'West';
    if (!key) continue;

    const rows = arr(child?.standings?.entries).map(standingsRow).filter(Boolean);
    rows.sort((a, b) => {
      if (a.seed != null && b.seed != null && a.seed !== b.seed) return a.seed - b.seed;
      if (a.seed != null && b.seed == null) return -1;
      if (a.seed == null && b.seed != null) return 1;
      const pct = (b.pct ?? 0) - (a.pct ?? 0);
      return pct !== 0 ? pct : a.name.localeCompare(b.name);
    });
    conferences[key] = rows;
  }
  return conferences;
}

function statValueFor(label, raw) {
  if (raw == null) return null;
  if (label === 'FG' || label === '3PT' || label === 'FT') return str(raw) || null;
  return num(raw);
}

function mapStats(labels, values) {
  const stats = {};
  arr(labels).forEach((label, i) => {
    const key = str(label);
    if (STAT_KEYS.includes(key)) stats[key] = statValueFor(key, arr(values)[i]);
  });
  return stats;
}

export function parseBoxScore(json) {
  const boxscore = json?.boxscore;
  const headerCompetition = arr(json?.header?.competitions)[0] || arr(json?.header?.competition)[0];
  const teams = [];

  for (const side of arr(boxscore?.players)) {
    const block = arr(side?.statistics)[0];
    const labels = arr(block?.labels).map(str);
    const starters = [];
    const bench = [];
    const dnp = [];

    for (const entry of arr(block?.athletes)) {
      const player = {
        id: str(entry?.athlete?.id),
        name: str(entry?.athlete?.displayName || entry?.athlete?.fullName),
        pos: str(entry?.athlete?.position?.abbreviation),
        stats: mapStats(labels, entry?.stats),
      };
      if (entry?.didNotPlay === true) {
        dnp.push({ ...player, reason: str(entry?.reason) || 'Did not play' });
        continue;
      }
      if (entry?.starter === true) starters.push(player);
      else bench.push(player);
    }

    const team = teamOf(side?.team, side?.team?.id);
    const headerSide = arr(headerCompetition?.competitors).find((c) => str(c?.team?.id) === team.id);
    const totals = mapStats(labels, block?.totals);
    teams.push({
      abbr: team.abbr,
      name: team.name,
      logo: team.logo,
      score: scoreOf(headerSide),
      starters,
      bench,
      dnp,
      totals,
      shooting: {
        fg: shotPct(totals.FG),
        three: shotPct(totals['3PT']),
        ft: shotPct(totals.FT),
      },
    });
  }

  return {
    teams,
    statusText: statusTextOf(headerCompetition?.status),
    state: stateOf(headerCompetition?.status),
  };
}

export function parseTeamSchedule(json) {
  const rawTeam = json?.team || {};
  const team = {
    id: str(rawTeam.id),
    abbr: str(rawTeam.abbreviation),
    name: str(rawTeam.displayName || rawTeam.name),
    logo: str(rawTeam.logo) || str(arr(rawTeam.logos)[0]?.href),
    record: str(rawTeam.recordSummary),
  };

  const games = [];
  for (const event of arr(json?.events)) {
    const competition = arr(event?.competitions)[0];
    if (!competition) continue;
    const competitors = arr(competition.competitors);
    const mine = competitors.find((c) => str(c?.team?.id) === team.id);
    if (!mine) continue;
    const other = competitors.find((c) => str(c?.team?.id) !== team.id);
    if (!other) continue;

    const status = competition.status || event.status || {};
    const state = stateOf(status);
    games.push({
      id: str(event.id ?? competition.id),
      startISO: str(event.date || competition.date),
      opponent: teamOf(other),
      homeAway: str(mine.homeAway),
      result: state === 'post' ? (mine.winner === true ? 'W' : 'L') : null,
      score: scoreOf(mine),
      oppScore: scoreOf(other),
    });
  }

  return { team, games };
}

function flatStats(categories) {
  const index = new Map();
  for (const category of arr(categories)) {
    for (const stat of arr(category?.stats)) {
      if (!stat || typeof stat !== 'object') continue;
      const name = str(stat.name);
      if (name && !index.has(name)) index.set(name, stat);
    }
  }
  return index;
}

// Team season averages. Points for and against live in the standings payload,
// not here, so the caller fills ppg from parseStandings.
export function parseTeamStats(json) {
  const stats = flatStats(json?.results?.stats?.categories);
  const read = (name) => {
    const stat = stats.get(name);
    return stat ? num(stat.value ?? stat.displayValue) : null;
  };
  return {
    gamesPlayed: read('gamesPlayed'),
    ppg: null,
    fgPct: read('fieldGoalPct'),
    threePct: read('threePointPct'),
    ftPct: read('freeThrowPct'),
    reb: read('avgRebounds'),
    ast: read('avgAssists'),
    tov: read('avgTurnovers'),
    stl: read('avgSteals'),
    blk: read('avgBlocks'),
    astTo: read('assistTurnoverRatio'),
  };
}

function labelMap(labels, values) {
  const out = {};
  arr(labels).forEach((label, i) => {
    const key = str(label);
    if (!key) return;
    const raw = arr(values)[i];
    if (raw == null || raw === '') {
      out[key] = null;
      return;
    }
    const asNumber = num(raw);
    out[key] = asNumber == null ? str(raw) : asNumber;
  });
  return out;
}

function seriesRow(event) {
  const competitors = arr(event?.competitors);
  const away = competitors.find((c) => c?.homeAway === 'away');
  const home = competitors.find((c) => c?.homeAway === 'home');
  if (!away || !home) return null;
  const winner = competitors.find((c) => c?.winner === true);
  return {
    id: str(event.id),
    date: str(event.date),
    state: str(event?.statusType?.state || event?.status),
    away: str(away.team?.abbreviation),
    home: str(home.team?.abbreviation),
    awayScore: scoreOf(away),
    homeScore: scoreOf(home),
    winnerAbbr: str(winner?.team?.abbreviation),
  };
}

function preGameSide(competitor, fallbackId) {
  if (!competitor) return null;
  const team = competitor.team || {};
  return {
    id: str(team.id ?? fallbackId),
    abbr: str(team.abbreviation),
    name: str(team.displayName || team.name),
    logo: logoOf(team),
    record: str(competitor.record?.summary || arr(competitor.records)[0]?.summary),
  };
}

// Pre-tip-off summary. Reads only header, gameInfo, lastFiveGames, seasonseries,
// injuries and leaders; the payload's other sections are never touched.
export function parsePreGame(json) {
  const competition = arr(json?.header?.competitions)[0] || {};
  const competitors = arr(competition.competitors);

  const seasonSeries = [];
  for (const series of arr(json?.seasonseries)) {
    for (const event of arr(series?.events)) {
      const row = seriesRow(event);
      if (row) seasonSeries.push(row);
    }
  }

  const lastFive = {};
  for (const key of Object.keys(json?.lastFiveGames || {})) {
    const block = json.lastFiveGames[key];
    const abbr = str(block?.team?.abbreviation);
    if (!abbr) continue;
    lastFive[abbr] = arr(block.events).map((event) => ({
      id: str(event?.id),
      date: str(event?.gameDate),
      atVs: str(event?.atVs),
      opponentAbbr: str(event?.opponent?.abbreviation),
      result: str(event?.gameResult),
      score: str(event?.score),
    }));
  }

  const injuries = {};
  for (const key of Object.keys(json?.injuries || {})) {
    const block = json.injuries[key];
    const abbr = str(block?.team?.abbreviation);
    if (!abbr) continue;
    injuries[abbr] = arr(block.injuries).map((entry) => ({
      name: str(entry?.athlete?.displayName || entry?.athlete?.fullName),
      pos: str(entry?.athlete?.position?.abbreviation),
      status: str(entry?.status),
      detail: str(entry?.details?.type?.description || entry?.details?.detail),
    }));
  }

  const leaders = {};
  for (const block of arr(json?.leaders)) {
    const abbr = str(block?.team?.abbreviation);
    if (!abbr) continue;
    leaders[abbr] = arr(block.leaders).map((category) => {
      const top = arr(category?.leaders)[0];
      return {
        category: str(category?.displayName || category?.name),
        name: str(top?.athlete?.displayName || top?.athlete?.fullName),
        value: str(top?.displayValue ?? top?.value),
      };
    });
  }

  return {
    id: str(json?.header?.id || competition.id),
    startISO: str(competition.date),
    venue: str(json?.gameInfo?.venue?.fullName || json?.gameInfo?.venue?.shortName),
    broadcast: arr(competition.broadcasts).map((b) => str(b?.media?.shortName)).filter(Boolean).join(', '),
    status: statusTextOf(competition.status),
    away: preGameSide(competitors.find((c) => c?.homeAway === 'away')),
    home: preGameSide(competitors.find((c) => c?.homeAway === 'home')),
    seasonSeries,
    lastFive,
    injuries,
    leaders,
  };
}

export function parseAthlete(json) {
  const athlete = json?.athlete || {};
  return {
    id: str(athlete.id),
    name: str(athlete.displayName || athlete.fullName),
    jersey: str(athlete.jersey),
    pos: str(athlete.position?.abbreviation || athlete.position?.name),
    height: str(athlete.displayHeight),
    weight: str(athlete.displayWeight),
    age: num(athlete.age),
    headshot: str(athlete.headshot?.href),
    team: {
      id: str(athlete.team?.id),
      abbr: str(athlete.team?.abbreviation),
      name: str(athlete.team?.displayName || athlete.team?.name),
    },
  };
}

// Averages split by label. Only the statistics block is read.
export function parsePlayerOverview(json) {
  const labels = arr(json?.statistics?.labels).map(str);
  const splits = arr(json?.statistics?.splits);
  const findSplit = (name) => splits.find((split) => str(split?.displayName).toLowerCase() === name);
  const seasonSplit = findSplit('regular season') || splits.find((split) => /regular season/i.test(str(split?.displayName)));
  const careerSplit = findSplit('career');
  return {
    labels,
    season: seasonSplit ? labelMap(labels, seasonSplit.stats) : {},
    career: careerSplit ? labelMap(labels, careerSplit.stats) : {},
  };
}

function timeOf(iso) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

// Game log split by season type. `games` stays the Regular Season list so
// existing callers keep working; `seasons` carries every type, newest first.
export function parseGameLog(json) {
  const labels = arr(json?.labels).map(str);
  const events = json?.events && typeof json.events === 'object' ? json.events : {};
  const seasons = [];

  for (const seasonType of arr(json?.seasonTypes)) {
    const name = str(seasonType?.displayName) || 'Season';
    const statsById = new Map();
    for (const category of arr(seasonType?.categories)) {
      for (const entry of arr(category?.events)) {
        const id = str(entry?.eventId);
        if (id && !statsById.has(id)) statsById.set(id, entry?.stats);
      }
    }

    const games = [];
    for (const [id, stats] of statsById) {
      const event = events[id];
      if (!event || typeof event !== 'object') continue;
      games.push({
        id,
        date: str(event.gameDate),
        atVs: str(event.atVs),
        opponentAbbr: str(event?.opponent?.abbreviation),
        result: str(event.gameResult),
        score: str(event.score),
        stats: labelMap(labels, stats),
      });
    }
    if (!games.length) continue;
    games.sort((a, b) => timeOf(b.date) - timeOf(a.date));
    seasons.push({ name, games });
  }

  seasons.sort((a, b) => timeOf(b.games[0]?.date) - timeOf(a.games[0]?.date));
  const regular = seasons.find((season) => /regular season/i.test(season.name)) || seasons[0];
  return { labels, seasons, games: regular ? regular.games : [] };
}

// League leaderboard. Values are read by stat name out of the category whose
// `name` matches, then ranked 1..10 by value.
export function parseLeaders(json, category, stat) {
  const categories = arr(json?.categories);
  const names = arr(categories.find((entry) => str(entry?.name) === str(category))?.names).map(str);
  const index = names.indexOf(str(stat));
  if (index < 0) return [];

  const gpIndex = arr(categories.find((entry) => str(entry?.name) === 'general')?.names)
    .map(str)
    .indexOf('gamesPlayed');

  const rows = [];
  for (const entry of arr(json?.athletes)) {
    const block = arr(entry?.categories).find((value) => str(value?.name) === str(category));
    const value = num(arr(block?.totals)[index]);
    if (value == null) continue;
    const general = arr(entry?.categories).find((value) => str(value?.name) === 'general');
    const athlete = entry?.athlete || {};
    rows.push({
      rank: 0,
      id: str(athlete.id),
      name: str(athlete.displayName || athlete.fullName),
      teamAbbr: str(athlete.teamShortName || athlete.team?.abbreviation),
      headshot: str(athlete?.headshot?.href),
      value,
      gp: gpIndex >= 0 ? num(arr(general?.totals)[gpIndex]) : null,
    });
  }

  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, 10).map((row, i) => ({ ...row, rank: i + 1 }));
}

// ESPN search returns every sport; only NBA players are kept.
export function parseSearch(json) {
  const players = [];
  for (const item of arr(json?.items)) {
    if (str(item?.league).toLowerCase() !== 'nba') continue;
    const team = arr(item?.teamRelationships).find((relation) => relation?.type === 'team');
    players.push({
      id: str(item.id),
      name: str(item.displayName || item.fullName),
      teamAbbr: str(team?.core?.abbreviation),
      headshot: str(item?.headshot?.href),
    });
  }
  return players;
}

export function parseRoster(json) {
  const players = [];
  for (const athlete of arr(json?.athletes)) {
    if (!athlete) continue;
    const player = {
      id: str(athlete.id),
      name: str(athlete.fullName || athlete.displayName),
      jersey: str(athlete.jersey),
      pos: str(athlete.position?.abbreviation || athlete.position?.name),
      height: str(athlete.displayHeight),
      age: num(athlete.age),
    };
    if (player.id || player.name) players.push(player);
  }
  return players;
}
