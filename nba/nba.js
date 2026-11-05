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
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(/^\+/, '').replace(/,/g, ''));
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

// Home and road splits ride along on the same records array.
function splitRecord(competitor, name, type) {
  const hit = arr(competitor?.records).find((r) => r?.name === name || r?.type === type);
  return str(hit?.summary);
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

// The player with the most of one box-score count (STL, BLK, ...) on a team,
// from parseBoxScore's starters and bench. Ties go to the earlier row (starters
// first, in ESPN's order). null when nobody has one: a "leader" on 0 says nothing.
export function boxLeader(team, key) {
  let best = null;
  for (const p of [...arr(team?.starters), ...arr(team?.bench)]) {
    const value = num(p?.stats?.[key]);
    if (value == null || value <= 0) continue;
    if (!best || value > best.value) best = { id: str(p.id), name: str(p.name), pos: str(p.pos), value };
  }
  return best;
}

function pointsLeader(competitor) {
  const points = arr(competitor?.leaders).find((category) => str(category?.name) === 'points');
  const top = arr(points?.leaders)[0];
  if (!top) return null;
  const name = str(top.athlete?.displayName || top.athlete?.fullName);
  if (!name) return null;
  return { name, line: str(top.displayValue) + ' PTS' };
}

// Short "F. Wagner" form. ESPN sends shortName on leaders; when it is missing
// fall back to first initial plus the rest of the display name.
function shortNameOf(athlete) {
  const short = str(athlete?.shortName);
  if (short) return short;
  const full = str(athlete?.displayName || athlete?.fullName).trim();
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return full;
  return parts[0][0] + '. ' + parts.slice(1).join(' ');
}

// Points, rebounds and assists leader of one competitor. Before tip-off ESPN
// sends season per-game leaders (pointsPerGame, ...); once the game starts the
// same slots are the game's own counts (points, rebounds, assists). `kind` says
// which one it is so the page can label it. Anything missing stays null.
const LEADER_KEYS = {
  season: { pts: 'pointsPerGame', reb: 'reboundsPerGame', ast: 'assistsPerGame' },
  game: { pts: 'points', reb: 'rebounds', ast: 'assists' },
};

function leaderEntry(competitor, name) {
  const category = arr(competitor?.leaders).find((c) => str(c?.name) === name);
  const top = arr(category?.leaders)[0];
  if (!top) return null;
  const athlete = top.athlete || {};
  const fullName = str(athlete.displayName || athlete.fullName);
  const value = str(top.displayValue ?? top.value);
  if (!fullName || !value) return null;
  return { name: fullName, short: shortNameOf(athlete), value };
}

export function parseCompetitorLeaders(competitor, state) {
  const order = state === 'pre' ? ['season', 'game'] : ['game', 'season'];
  for (const kind of order) {
    const keys = LEADER_KEYS[kind];
    const pts = leaderEntry(competitor, keys.pts);
    const reb = leaderEntry(competitor, keys.reb);
    const ast = leaderEntry(competitor, keys.ast);
    if (pts || reb || ast) return { kind, pts, reb, ast };
  }
  return null;
}

function signedLine(value) {
  const n = num(value);
  if (n == null) return '';
  if (n === 0) return 'EVEN';
  return n > 0 ? '+' + n : String(n);
}

// competitions[0].odds[0]: `details` ("CLE -3.5") and `overUnder` are the
// spread and total. The moneyline is on homeTeamOdds / awayTeamOdds, or on a
// moneyline.{home,away}.close.odds block on some payloads.
export function parseOdds(competition) {
  const odds = arr(competition?.odds)[0];
  if (!odds || typeof odds !== 'object') return null;
  const details = str(odds.details).trim();
  const total = num(odds.overUnder);
  const home = signedLine(odds.homeTeamOdds?.moneyLine ?? odds.moneyline?.home?.close?.odds ?? odds.moneyline?.home?.open?.odds);
  const away = signedLine(odds.awayTeamOdds?.moneyLine ?? odds.moneyline?.away?.close?.odds ?? odds.moneyline?.away?.open?.odds);
  if (!details && total == null && !home && !away) return null;
  return {
    details,
    total,
    moneyline: home || away ? { home, away } : null,
  };
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
        homeRecord: splitRecord(competitor, 'Home', 'home'),
        roadRecord: splitRecord(competitor, 'Road', 'road'),
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
    const gameState = stateOf(status);
    sides.home.leaders = parseCompetitorLeaders(raw.home, gameState);
    sides.away.leaders = parseCompetitorLeaders(raw.away, gameState);
    const broadcast = arr(competition.broadcasts)
      .flatMap((b) => arr(b?.names).map(str))
      .filter(Boolean)
      .join(', ');

    games.push({
      id: str(event.id ?? competition.id),
      state: gameState,
      statusText: statusTextOf(status),
      odds: parseOdds(competition),
      startISO: str(event.date || competition.date),
      venue: str(competition.venue?.fullName),
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
  const homeStat = statValue(index, ['Home'], ['home']);
  const roadStat = statValue(index, ['Road'], ['road']);
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
    home: statText(homeStat),
    road: statText(roadStat),
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
    rows.forEach((row) => { row.conf = key; });
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
      // A postponed or cancelled date was never played, so restInfo skips it.
      postponed: /POSTPONED|CANCEL/.test(str(status?.type?.name)),
    });
  }

  return { team, games };
}

// Day number of an ET calendar date (YYYYMMDD). Counting from the date string,
// not from timestamps, keeps the DST change out of the arithmetic.
function etDayNumber(yyyymmdd) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(yyyymmdd || ''));
  return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
}

// Rest going into one game, from that team's parseTeamSchedule output (or its
// games array). gameDate is the game's start (ISO or Date) or its ET YYYYMMDD.
// Days are ET calendar days, the way the league counts them: a 10:30pm ET tip
// and a 7pm ET tip the next evening are a back-to-back even though both start
// on the same UTC day. Returns null unless the schedule has a game on that ET
// date and an earlier one to count from, so nothing is guessed:
//   daysSince  calendar days since the previous game (1 = back-to-back)
//   restDays   days off in between (daysSince - 1)
//   b2b        second night of a back-to-back
//   threeInFour third game in four nights (this one included)
//   label      'B2B', '3 in 4', 'B2B · 3 in 4', '1 day rest', 'N days rest'
export function restInfo(schedule, gameDate) {
  const games = Array.isArray(schedule) ? schedule : arr(schedule?.games);
  const target = /^\d{8}$/.test(String(gameDate)) ? String(gameDate) : etDate(gameDate);
  const day = etDayNumber(target);
  if (day == null) return null;

  const days = new Set();
  for (const game of games) {
    if (!game || game.postponed) continue;
    const n = etDayNumber(etDate(game.startISO));
    if (n != null) days.add(n);
  }
  if (!days.has(day)) return null;

  let prev = null;
  for (const n of days) if (n < day && (prev == null || n > prev)) prev = n;
  if (prev == null) return null;

  const daysSince = day - prev;
  const b2b = daysSince === 1;
  let recent = 0;
  for (let n = day - 3; n < day; n++) if (days.has(n)) recent++;
  const threeInFour = recent >= 2;
  const restDays = daysSince - 1;
  const label = b2b && threeInFour ? 'B2B · 3 in 4'
    : b2b ? 'B2B'
      : threeInFour ? '3 in 4'
        : restDays + (restDays === 1 ? ' day rest' : ' days rest');
  return { daysSince, restDays, b2b, threeInFour, label };
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

// ── Game page extras ────────────────────────────────────────────────────────
// Everything the game page shows beyond the box score, read from one summary
// payload: header sides, odds, BPI, win probability, leaders with headshots,
// injuries, ATS records, line score and the extra team counts. Any block ESPN
// leaves empty comes back null or [] so the page can drop it.

function recordOfType(competitor, type) {
  const hit = arr(competitor?.record).concat(arr(competitor?.records)).find((r) => r?.type === type || r?.name === type);
  return str(hit?.summary || hit?.displayValue);
}

function headerSide(competitor) {
  if (!competitor) return null;
  const team = teamOf(competitor);
  return {
    ...team,
    record: recordOfType(competitor, 'total') || recordOfType(competitor, 'overall'),
    homeRecord: recordOfType(competitor, 'home'),
    roadRecord: recordOfType(competitor, 'road'),
    score: scoreOf(competitor),
    winner: competitor.winner === true,
    linescores: arr(competitor.linescores).map((l) => num(l?.displayValue ?? l?.value)),
  };
}

function lineText(value) {
  const n = num(value);
  if (n == null) return '';
  if (n === 0) return 'PK';
  return n > 0 ? '+' + n : String(n);
}

function openTotal(block) {
  return num(str(block?.over?.open?.line || block?.under?.open?.line).replace(/^[a-z]/i, ''));
}

// Spread, total and moneyline from pickcenter (or odds when pickcenter is
// empty). `spread` on ESPN is the home team's line, so the away line is its
// negation; the per-side pointSpread block wins when it is present.
export function parseGameOdds(json) {
  const pc = arr(json?.pickcenter)[0] || arr(json?.odds)[0];
  if (!pc || typeof pc !== 'object') return null;
  const home = pc.homeTeamOdds || {};
  const away = pc.awayTeamOdds || {};
  const spreadNum = num(pc.spread);
  const homeLine = str(pc.pointSpread?.home?.close?.line) || lineText(spreadNum);
  const awayLine = str(pc.pointSpread?.away?.close?.line) || (spreadNum == null ? '' : lineText(spreadNum === 0 ? 0 : -spreadNum));
  const mlHome = signedLine(home.moneyLine ?? pc.moneyline?.home?.close?.odds);
  const mlAway = signedLine(away.moneyLine ?? pc.moneyline?.away?.close?.odds);
  const total = num(pc.overUnder);
  const out = {
    provider: str(pc.provider?.name),
    details: str(pc.details).trim(),
    total,
    totalOpen: openTotal(pc.total),
    overOdds: signedLine(pc.overOdds ?? pc.total?.over?.close?.odds),
    underOdds: signedLine(pc.underOdds ?? pc.total?.under?.close?.odds),
    spread: {
      away: { line: awayLine, odds: signedLine(away.spreadOdds ?? pc.pointSpread?.away?.close?.odds) },
      home: { line: homeLine, odds: signedLine(home.spreadOdds ?? pc.pointSpread?.home?.close?.odds) },
    },
    spreadOpen: {
      away: str(pc.pointSpread?.away?.open?.line),
      home: str(pc.pointSpread?.home?.open?.line),
    },
    moneyline: mlAway || mlHome ? { away: mlAway, home: mlHome } : null,
  };
  if (!out.details && total == null && !out.spread.home.line && !out.moneyline) return null;
  return out;
}

// ESPN BPI win chance, pre-game only. Values are percentages as strings.
export function parsePredictor(json) {
  const p = json?.predictor;
  const home = num(p?.homeTeam?.gameProjection);
  const away = num(p?.awayTeam?.gameProjection);
  if (home == null || away == null) return null;
  return { home, away };
}

// Latest in-game win probability (home side, 0-1 in the payload).
function parseWinProb(json) {
  const list = arr(json?.winprobability);
  const last = list[list.length - 1];
  const home = num(last?.homeWinPercentage);
  if (home == null) return null;
  return { home: home * 100, away: (1 - home) * 100 };
}

// One leader per category with the headshot and position, for the game page.
function richLeader(block, name) {
  const category = arr(block?.leaders).find((c) => str(c?.name) === name);
  const top = arr(category?.leaders)[0];
  if (!top) return null;
  const athlete = top.athlete || {};
  const fullName = str(athlete.displayName || athlete.fullName);
  const value = str(top.displayValue ?? top.value);
  if (!fullName || !value) return null;
  return {
    id: str(athlete.id),
    name: fullName,
    short: shortNameOf(athlete),
    value,
    pos: str(athlete.position?.abbreviation),
    jersey: str(athlete.jersey),
    headshot: str(athlete.headshot?.href),
    line: str(top.summary),
  };
}

export function parseSummaryLeaders(block, state) {
  const order = state === 'pre' ? ['season', 'game'] : ['game', 'season'];
  for (const kind of order) {
    const keys = LEADER_KEYS[kind];
    const pts = richLeader(block, keys.pts);
    const reb = richLeader(block, keys.reb);
    const ast = richLeader(block, keys.ast);
    if (pts || reb || ast) return { kind, pts, reb, ast };
  }
  return null;
}

function injuryEntry(entry) {
  const athlete = entry?.athlete || {};
  const name = str(athlete.displayName || athlete.fullName);
  if (!name) return null;
  const details = entry?.details || {};
  const what = [str(details.type), str(details.detail)].filter(Boolean).join(' ').replace(/\s*Not Specified/i, '').trim();
  return {
    name,
    pos: str(athlete.position?.abbreviation),
    status: str(entry?.status || entry?.type?.description),
    detail: what,
    returnDate: str(details.returnDate),
  };
}

// ATS records have come back empty on every payload checked so far, so the
// shape is read tolerantly: any record with a summary becomes a labelled line.
function atsRecords(block) {
  return arr(block?.records).map((r) => ({
    label: str(r?.displayName || r?.shortDisplayName || r?.abbreviation || r?.description || r?.type?.text || r?.type),
    summary: str(r?.summary || r?.displayValue),
  })).filter((r) => r.summary);
}

const TEAM_COUNTS = {
  paint: 'pointsInPaint',
  fastBreak: 'fastBreakPoints',
  offTurnovers: 'turnoverPoints',
  largestLead: 'largestLead',
  leadChanges: 'leadChanges',
};

function teamCounts(boxTeam) {
  const stats = arr(boxTeam?.statistics);
  const out = {};
  let any = false;
  for (const [key, name] of Object.entries(TEAM_COUNTS)) {
    const hit = stats.find((s) => str(s?.name) === name);
    out[key] = hit ? num(hit.displayValue ?? hit.value) : null;
    if (out[key] != null) any = true;
  }
  return any ? out : null;
}

export function parseGameExtras(json) {
  const competition = arr(json?.header?.competitions)[0] || {};
  const competitors = arr(competition.competitors);
  const away = headerSide(competitors.find((c) => c?.homeAway === 'away'));
  const home = headerSide(competitors.find((c) => c?.homeAway === 'home'));
  const state = stateOf(competition.status);

  const sideOf = (team) => {
    const id = str(team?.id);
    const abbr = str(team?.abbreviation);
    if (away && ((id && id === away.id) || (!id && abbr === away.abbr))) return 'away';
    if (home && ((id && id === home.id) || (!id && abbr === home.abbr))) return 'home';
    return '';
  };
  const bySide = (list, pick) => {
    const out = { away: null, home: null };
    for (const block of arr(list)) {
      const side = sideOf(block?.team);
      if (side) out[side] = pick(block);
    }
    return out;
  };

  const leaders = bySide(json?.leaders, (block) => parseSummaryLeaders(block, state));
  const injuries = bySide(json?.injuries, (block) => arr(block?.injuries).map(injuryEntry).filter(Boolean));
  const ats = bySide(json?.againstTheSpread, atsRecords);
  const counts = bySide(arr(json?.boxscore?.teams), teamCounts);

  const nationals = arr(competition.broadcasts).filter((b) => b?.isNational).map((b) => str(b?.media?.shortName)).filter(Boolean);
  const locals = arr(competition.broadcasts).map((b) => str(b?.media?.shortName)).filter(Boolean);

  return {
    id: str(json?.header?.id || competition.id),
    state,
    statusText: statusTextOf(competition.status),
    startISO: str(competition.date),
    venue: str(json?.gameInfo?.venue?.fullName || json?.gameInfo?.venue?.shortName),
    broadcast: (nationals.length ? nationals : locals.slice(0, 2)).join(', '),
    away,
    home,
    odds: parseGameOdds(json),
    predictor: parsePredictor(json),
    winProb: parseWinProb(json),
    leaders: leaders.away || leaders.home ? leaders : null,
    injuries: injuries.away?.length || injuries.home?.length ? { away: injuries.away || [], home: injuries.home || [] } : null,
    ats: ats.away?.length || ats.home?.length ? { away: ats.away || [], home: ats.home || [] } : null,
    counts: counts.away || counts.home ? counts : null,
  };
}

// Centre-out bar lengths (0 to 1) for one tale-of-the-tape row. The better
// value gets the full bar; the other gets the ratio of the two when both are
// positive, or a linear spread (floor 0.15) when a value is zero or negative.
// `lower` flips which side is better (turnovers, points allowed).
export function barShares(a, b, lower = false) {
  if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return { a: 0, b: 0 };
  if (a === b) return { a: 1, b: 1 };
  if (a > 0 && b > 0) {
    const ratio = Math.max(0.08, Math.min(a, b) / Math.max(a, b));
    const aBetter = lower ? a < b : a > b;
    return aBetter ? { a: 1, b: ratio } : { a: ratio, b: 1 };
  }
  const sa = lower ? -a : a;
  const sb = lower ? -b : b;
  const lo = Math.min(sa, sb);
  const hi = Math.max(sa, sb);
  const share = (s) => 0.15 + 0.85 * ((s - lo) / (hi - lo));
  return { a: share(sa), b: share(sb) };
}

// League rank of one team on a value taken from every standings row. Rows with
// no value are skipped; `lower` ranks the smallest first. Ties share a rank.
// Returns null when the team has no value, so the caller can omit the badge.
export function leagueRank(rows, teamId, read, lower = false) {
  const scored = arr(rows).map((row) => ({ id: str(row?.teamId), v: read(row) }))
    .filter((row) => row.v != null && !Number.isNaN(row.v));
  const mine = scored.find((row) => row.id === str(teamId));
  if (!mine) return null;
  const ahead = scored.filter((row) => (lower ? row.v < mine.v : row.v > mine.v)).length;
  return { rank: ahead + 1, of: scored.length };
}

export function ordinal(n) {
  if (!Number.isFinite(n)) return '';
  const tail = Math.abs(n) % 100;
  if (tail >= 11 && tail <= 13) return n + 'th';
  return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[Math.abs(n) % 10] || 'th');
}

// Default game for the compare page, from one day's scoreboard games: the first
// tip-off of the day, or (which = 'last') the latest one for a past day.
export function pickCompareGame(games, which = 'first') {
  const list = arr(games).filter((game) => game?.away?.id && game?.home?.id && game.startISO);
  if (!list.length) return null;
  const time = (game) => new Date(game.startISO).getTime();
  return list.slice().sort((a, b) => (which === 'last' ? time(b) - time(a) : time(a) - time(b)))[0];
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
      headshot: str(athlete.headshot?.href),
    };
    if (player.id || player.name) players.push(player);
  }
  return players;
}

// ── Team colours ────────────────────────────────────────────────────────────
// The standings payload carries no colours; the teams endpoint does. ESPN sends
// hex without the "#", so it is normalised here and a malformed value becomes ''.
function hexOf(value) {
  const hex = str(value).trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(hex) ? '#' + hex.toLowerCase() : '';
}

// Site API shape: sports[0].leagues[0].teams[].team. Indexed by both
// abbreviation and id so a scoreboard side, a standings row or a team page can
// each find its entry.
export function parseTeams(json) {
  const league = arr(arr(json?.sports)[0]?.leagues)[0];
  const byAbbr = {};
  const byId = {};
  for (const entry of arr(league?.teams)) {
    const team = entry?.team;
    if (!team) continue;
    const abbr = str(team.abbreviation);
    const id = str(team.id);
    if (!abbr && !id) continue;
    const value = { id, abbr, name: str(team.displayName || team.name), color: hexOf(team.color), alt: hexOf(team.alternateColor), logo: logoOf(team) };
    if (abbr) byAbbr[abbr] = value;
    if (id) byId[id] = value;
  }
  return { byAbbr, byId };
}

function channels(hex) {
  return [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
}

function luminance(hex) {
  const [r, g, b] = channels(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG contrast ratio between two #rrggbb colours (1 to 21).
export function contrastRatio(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const INK_LIGHT = '#ffffff';
const INK_DARK = '#0b0c0e';

// Text colour that reads on a given fill: white or near-black, whichever has
// the higher contrast.
export function textOn(fill) {
  return contrastRatio(fill, INK_LIGHT) >= contrastRatio(fill, INK_DARK) ? INK_LIGHT : INK_DARK;
}

// Fill for a team tile on the dark page. A primary that nearly disappears
// against the page (Nets, Spurs, Clippers...) falls back to the alternate when
// the alternate stands out more. No colours at all gives a neutral grey.
export function teamFill(colors, page = '#0b0d10', minContrast = 1.5) {
  const primary = hexOf(colors?.color);
  const alt = hexOf(colors?.alt);
  let fill = primary;
  let usedAlt = false;
  if (!primary) {
    fill = alt || '#2b3037';
    usedAlt = Boolean(alt);
  } else if (alt && contrastRatio(primary, page) < minContrast && contrastRatio(alt, page) > contrastRatio(primary, page)) {
    fill = alt;
    usedAlt = true;
  }
  return { fill, ink: textOn(fill), usedAlt };
}

// A team colour made legible as text or a stroke on a dark panel: mixed toward
// white in 10% steps until it reaches the target contrast, so a navy keeps its
// hue instead of jumping to grey.
export function readableOn(color, panel = '#14161a', target = 4.5) {
  const base = hexOf(color);
  if (!base) return INK_LIGHT;
  if (contrastRatio(base, panel) >= target) return base;
  const rgb = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16));
  for (let step = 1; step <= 10; step++) {
    const t = step / 10;
    const mixed = '#' + rgb.map((c) => Math.round(c + (255 - c) * t).toString(16).padStart(2, '0')).join('');
    if (contrastRatio(mixed, panel) >= target) return mixed;
  }
  return INK_LIGHT;
}

// ── Play-by-play helpers (design/polish variants) ──────────────────────────
// Seconds from tip-off: four 12-minute quarters, then 5-minute overtimes.
function periodLength(period) {
  return period <= 4 ? 720 : 300;
}

export function periodStart(period) {
  const p = Math.max(1, Math.floor(Number(period) || 1));
  return p <= 4 ? (p - 1) * 720 : 2880 + (p - 5) * 300;
}

// "11:41" is 701 seconds left; "45.2" (the last minute) is 45.2.
function clockLeft(text) {
  const value = str(text).trim();
  const match = /^(\d+):(\d+(?:\.\d+)?)$/.exec(value);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  const n = num(value);
  return n == null ? null : n;
}

function sidesOf(json) {
  const competition = arr(json?.header?.competitions)[0] || {};
  const competitors = arr(competition.competitors);
  const id = (where) => str(competitors.find((c) => c?.homeAway === where)?.team?.id || competitors.find((c) => c?.homeAway === where)?.id);
  return { away: id('away'), home: id('home') };
}

// The score as it moved through the game, read from the play-by-play. Every
// number comes from the payload: margins, lead changes, ties, the biggest lead
// and the longest unanswered run for each side, seconds spent ahead, and the
// win-probability line where ESPN sends one. Returns null with no plays.
export function parseGameFlow(json) {
  const sides = sidesOf(json);
  const plays = arr(json?.plays);
  const points = [{ t: 0, away: 0, home: 0, period: 1 }];
  const wpById = new Map(arr(json?.winprobability).map((w) => [str(w?.playId), num(w?.homeWinPercentage)]));
  const wp = [];
  let periods = 0;
  let end = 0;

  for (const play of plays) {
    const period = num(play?.period?.number);
    const left = clockLeft(play?.clock?.displayValue);
    if (period == null || left == null) continue;
    periods = Math.max(periods, period);
    const t = periodStart(period) + periodLength(period) - left;
    end = Math.max(end, t);
    const home = wpById.get(str(play?.id));
    if (home != null) wp.push({ t, home: home * 100 });
    const a = num(play?.awayScore);
    const h = num(play?.homeScore);
    if (a == null || h == null) continue;
    const last = points[points.length - 1];
    if (a !== last.away || h !== last.home) points.push({ t, away: a, home: h, period });
  }
  if (!periods) return null;
  if (periods >= 4) end = Math.max(end, periodStart(periods) + periodLength(periods));

  let leadChanges = 0;
  let ties = 0;
  let leader = 0;
  const largest = { away: { lead: 0, t: null }, home: { lead: 0, t: null } };
  const leadTime = { away: 0, home: 0, tied: 0 };
  const runs = { away: null, home: null };
  let run = null;

  points.forEach((p, i) => {
    const margin = p.home - p.away;
    const now = Math.sign(margin);
    if (i > 0) {
      if (now !== 0 && leader !== 0 && now !== leader) leadChanges += 1;
      if (now === 0 && Math.sign(points[i - 1].home - points[i - 1].away) !== 0) ties += 1;
      const prev = points[i - 1];
      const side = p.home > prev.home ? 'home' : p.away > prev.away ? 'away' : '';
      const gained = side ? p[side] - prev[side] : 0;
      if (side && run && run.side === side) {
        run.pts += gained;
        run.end = p.t;
      } else if (side) {
        run = { side, pts: gained, start: prev.t, end: p.t, from: { away: prev.away, home: prev.home } };
      }
      if (run && (!runs[run.side] || run.pts > runs[run.side].pts)) runs[run.side] = { ...run, from: { ...run.from } };
    }
    if (now !== 0) leader = now;
    if (margin > largest.home.lead) largest.home = { lead: margin, t: p.t };
    if (-margin > largest.away.lead) largest.away = { lead: -margin, t: p.t };
    const next = i + 1 < points.length ? points[i + 1].t : end;
    const span = Math.max(0, next - p.t);
    leadTime[now > 0 ? 'home' : now < 0 ? 'away' : 'tied'] += span;
  });

  return {
    awayId: sides.away,
    homeId: sides.home,
    periods,
    end,
    points,
    wp,
    leadChanges,
    ties,
    largest,
    runs: {
      away: runs.away && { pts: runs.away.pts, start: runs.away.start, end: runs.away.end, from: runs.away.from },
      home: runs.home && { pts: runs.home.pts, start: runs.home.start, end: runs.home.end, from: runs.home.from },
    },
    leadTime,
  };
}

// Field-goal attempts with a court location, split by side. ESPN puts every
// shot on one half court: x 0-50 across the baseline, y up the floor from
// the baseline (a few shots sit just below 0), basket near (25, 0). Free throws
// and ESPN's sentinel coordinates (about -2.1e8) are dropped. The
// distance comes from the play text ("26-foot") when ESPN wrote one.
export function parseShots(json) {
  const sides = sidesOf(json);
  const out = { away: [], home: [] };
  for (const play of arr(json?.plays)) {
    if (play?.shootingPlay !== true) continue;
    const pts = num(play?.pointsAttempted);
    if (pts !== 2 && pts !== 3) continue;
    const x = num(play?.coordinate?.x);
    const y = num(play?.coordinate?.y);
    if (x == null || y == null || x < 0 || x > 50 || y < -5 || y > 47) continue;
    const team = str(play?.team?.id);
    const side = team && team === sides.away ? 'away' : team && team === sides.home ? 'home' : '';
    if (!side) continue;
    const feet = /(\d+)-foot/.exec(str(play?.text));
    const dist = feet ? Number(feet[1]) : Math.round(Math.hypot(x - 25, y));
    const zone = pts === 3 ? 'three' : dist <= 4 ? 'rim' : dist <= 14 ? 'short' : 'mid';
    out[side].push({
      x, y, made: play?.scoringPlay === true, three: pts === 3, dist, zone,
      period: num(play?.period?.number), player: str(arr(play?.participants)[0]?.athlete?.id),
    });
  }
  return out;
}

// Made / attempted by zone for one side's shots from parseShots.
export function shotZones(shots) {
  const zones = { rim: [0, 0], short: [0, 0], mid: [0, 0], three: [0, 0] };
  for (const s of arr(shots)) {
    const z = zones[s?.zone];
    if (!z) continue;
    z[1] += 1;
    if (s.made) z[0] += 1;
  }
  return Object.fromEntries(Object.entries(zones).map(([k, [made, att]]) => [k, { made, att, pct: att ? (made / att) * 100 : null }]));
}

// Points by quarter for each side and each scorer, read from the scoring plays.
// The first participant on a scoring play is the scorer. Names come from the
// box score. Period totals match the line score when the play-by-play is whole.
export function parsePeriodScoring(json) {
  const sides = sidesOf(json);
  const names = new Map();
  for (const block of arr(json?.boxscore?.players)) {
    for (const entry of arr(arr(block?.statistics)[0]?.athletes)) {
      const athlete = entry?.athlete;
      if (athlete?.id) names.set(str(athlete.id), { name: str(athlete.displayName || athlete.fullName), short: str(athlete.shortName) || shortNameOf(athlete) });
    }
  }
  const periods = [];
  const blank = () => ({ pts: 0, players: new Map() });
  for (const play of arr(json?.plays)) {
    if (play?.scoringPlay !== true) continue;
    const period = num(play?.period?.number);
    const pts = num(play?.scoreValue);
    if (!period || !pts) continue;
    const team = str(play?.team?.id);
    const side = team && team === sides.away ? 'away' : team && team === sides.home ? 'home' : '';
    if (!side) continue;
    while (periods.length < period) periods.push({ period: periods.length + 1, away: blank(), home: blank() });
    const bucket = periods[period - 1][side];
    bucket.pts += pts;
    const who = str(arr(play?.participants)[0]?.athlete?.id);
    if (who) bucket.players.set(who, (bucket.players.get(who) || 0) + pts);
  }
  const done = (bucket) => ({
    pts: bucket.pts,
    scorers: [...bucket.players.entries()]
      .map(([id, pts]) => ({ id, name: names.get(id)?.name || '', short: names.get(id)?.short || '', pts }))
      .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name)),
  });
  return periods.map((p) => ({ period: p.period, away: done(p.away), home: done(p.home) }));
}

// League leaderboard with each player's full per-game line from the same
// payload (games, minutes, shooting splits, rebounds, assists...). Same ranking
// as parseLeaders; `limit` 0 keeps every athlete in the payload.
const LINE_STATS = {
  general: { gp: 'gamesPlayed', min: 'avgMinutes', reb: 'avgRebounds' },
  offensive: {
    pts: 'avgPoints', fgPct: 'fieldGoalPct', threePct: 'threePointFieldGoalPct', ftPct: 'freeThrowPct',
    ast: 'avgAssists', to: 'avgTurnovers', fga: 'avgFieldGoalsAttempted',
    tpm: 'avgThreePointFieldGoalsMade', tpa: 'avgThreePointFieldGoalsAttempted', fta: 'avgFreeThrowsAttempted',
  },
  defensive: { stl: 'avgSteals', blk: 'avgBlocks' },
};

export function parseLeaderLines(json, category, stat, limit = 10) {
  const categories = arr(json?.categories);
  const namesOf = (name) => arr(categories.find((entry) => str(entry?.name) === name)?.names).map(str);
  const index = namesOf(str(category)).indexOf(str(stat));
  if (index < 0) return [];
  const columns = Object.entries(LINE_STATS).flatMap(([cat, map]) => {
    const names = namesOf(cat);
    return Object.entries(map).map(([key, name]) => ({ cat, key, at: names.indexOf(name) })).filter((c) => c.at >= 0);
  });
  const rows = [];
  for (const entry of arr(json?.athletes)) {
    const blocks = new Map(arr(entry?.categories).map((b) => [str(b?.name), arr(b?.totals)]));
    const value = num((blocks.get(str(category)) || [])[index]);
    if (value == null) continue;
    const athlete = entry?.athlete || {};
    const line = {};
    for (const c of columns) {
      const v = num((blocks.get(c.cat) || [])[c.at]);
      if (v != null) line[c.key] = v;
    }
    rows.push({
      rank: 0,
      id: str(athlete.id),
      name: str(athlete.displayName || athlete.fullName),
      teamAbbr: str(athlete.teamShortName || athlete.team?.abbreviation),
      headshot: str(athlete?.headshot?.href),
      pos: str(athlete?.position?.abbreviation),
      value,
      line,
    });
  }
  rows.sort((a, b) => b.value - a.value);
  return (limit ? rows.slice(0, limit) : rows).map((row, i) => ({ ...row, rank: i + 1 }));
}

// ── Home page (/) helpers ───────────────────────────────────────────────────
// The two-sport home page reads the same feeds as the league pages. NFL cards
// join three sources: schedule.json (the week's slate, same-origin), the NFL
// standings artifact (abbreviation and record for all 32 teams) and the ESPN
// football scoreboard (live state, scores, spread and total). Full team names
// are the join key: schedule.json and ESPN's displayName spell them the same.

const NFL_ALIAS = { WSH: 'WAS', LA: 'LAR' };

function nflAbbr(value) {
  const abbr = str(value).toUpperCase();
  return NFL_ALIAS[abbr] || abbr;
}

function wlt(wins, losses, ties) {
  if (wins == null || losses == null) return '';
  return ties ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

// One lookup for every NFL team: abbreviation, record and colour, keyed by
// full name and by abbreviation. `standings` is nfl_standings_2026.json;
// `colorRows` are nfl_teams rows ({ name, abbr, primary_color }). Either may be
// missing, so a team can come back without a record or without a colour.
export function nflTeamIndex(standings, colorRows) {
  const byName = {};
  const byAbbr = {};
  const put = (name, abbr, fields) => {
    const key = nflAbbr(abbr);
    const existing = (key && byAbbr[key]) || (name && byName[name.toLowerCase()]) || { name: '', abbr: '', record: '', color: '' };
    Object.assign(existing, fields);
    if (name && !existing.name) existing.name = name;
    if (key && !existing.abbr) existing.abbr = key;
    if (existing.abbr) byAbbr[existing.abbr] = existing;
    if (existing.name) byName[existing.name.toLowerCase()] = existing;
  };
  for (const row of arr(standings?.teams)) {
    if (!row) continue;
    put(str(row.team), row.abbr, {
      record: wlt(num(row.wins), num(row.losses), num(row.ties)),
      conference: str(row.conference),
      division: str(row.division),
    });
  }
  for (const row of arr(colorRows)) {
    if (!row) continue;
    put(str(row.name), row.abbr, { color: hexOf(row.primary_color) });
  }
  return { byName, byAbbr };
}

// Index entry for a full name or an abbreviation (ESPN's WSH and nflverse's LA
// included). Unknown teams give null.
export function nflTeam(index, key) {
  if (!index) return null;
  const value = str(key);
  return index.byName[value.toLowerCase()] || index.byAbbr[nflAbbr(value)] || null;
}

function nflSide(name, score, index) {
  const team = nflTeam(index, name);
  return {
    name,
    abbr: team?.abbr || '',
    record: team?.record || '',
    color: team?.color || '',
    score: num(score),
    winner: false,
  };
}

// The week's NFL games, in kickoff order. Each schedule.json game is one card;
// a matching ESPN scoreboard game (parseScoreboard output) supplies live state,
// scores, ESPN's fresher record and the spread/total. Without ESPN the card
// still shows the matchup, kickoff and any synced final score.
export function nflWeekGames(schedule, espnGames, index, week) {
  const wk = num(week ?? schedule?.week);
  const espn = new Map();
  for (const game of arr(espnGames)) {
    if (!game?.away?.name || !game?.home?.name) continue;
    espn.set(`${game.away.name}@${game.home.name}`.toLowerCase(), game);
  }

  const games = [];
  for (const raw of arr(schedule?.games)) {
    if (!raw || num(raw.week) !== wk) continue;
    const awayName = str(raw.away_team);
    const homeName = str(raw.home_team);
    if (!awayName || !homeName) continue;

    const away = nflSide(awayName, raw.away_score, index);
    const home = nflSide(homeName, raw.home_score, index);
    // nflverse ids end in AWAY-HOME ("2026-11-05-JAX-BAL"); used when the
    // team index is missing.
    const idTeams = /-([A-Z]{2,3})-([A-Z]{2,3})$/.exec(str(raw.game_id));
    if (idTeams) {
      if (!away.abbr) away.abbr = nflAbbr(idTeams[1]);
      if (!home.abbr) home.abbr = nflAbbr(idTeams[2]);
    }
    const final = str(raw.status) === 'final' || (away.score != null && home.score != null && Boolean(raw.winner));
    const game = {
      id: str(raw.game_id),
      week: wk,
      startISO: str(raw.kickoff_utc),
      venue: str(raw.venue),
      tv: str(raw.tv),
      state: final ? 'post' : 'pre',
      statusText: final ? 'Final' : '',
      odds: null,
      away,
      home,
    };
    if (final) {
      away.winner = str(raw.winner) === awayName;
      home.winner = str(raw.winner) === homeName;
    }

    const live = espn.get(`${awayName}@${homeName}`.toLowerCase());
    if (live) {
      game.state = live.state;
      game.statusText = live.statusText || game.statusText;
      game.odds = live.odds || null;
      if (!game.tv && live.broadcast) game.tv = live.broadcast;
      for (const which of ['away', 'home']) {
        const side = game[which];
        const from = live[which];
        if (from.record) side.record = from.record;
        if (live.state !== 'pre' && from.score != null) side.score = from.score;
        if (live.state === 'post') side.winner = from.winner;
        if (!side.abbr && from.abbr) side.abbr = nflAbbr(from.abbr);
      }
    }
    games.push(game);
  }

  const timeOf = (iso) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : Infinity;
  };
  return games.sort((a, b) => timeOf(a.startISO) - timeOf(b.startISO) || a.id.localeCompare(b.id));
}

// Leader of each NFL division plus the runner-up and its games back. The
// standings artifact already orders each division (win percentage, then point
// differential), so the first row is the leader. AFC first, then NFC.
export function nflDivisionLeaders(standings) {
  const out = [];
  for (const division of arr(standings?.divisions)) {
    const teams = arr(division?.teams).filter((team) => team && team.abbr);
    if (!teams.length) continue;
    const row = (team) => ({
      abbr: nflAbbr(team.abbr),
      name: str(team.team),
      record: wlt(num(team.wins), num(team.losses), num(team.ties)),
      differential: num(team.differential),
    });
    const lead = teams[0];
    const second = teams[1];
    let gb = null;
    if (second) {
      const value = ((num(lead.wins) ?? 0) - (num(second.wins) ?? 0) + (num(second.losses) ?? 0) - (num(lead.losses) ?? 0)) / 2;
      gb = Number.isFinite(value) ? value : null;
    }
    out.push({
      conference: str(division.conference || lead.conference),
      division: str(division.division || lead.division),
      leader: row(lead),
      next: second ? { ...row(second), gb } : null,
    });
  }
  const confOrder = (c) => (c === 'AFC' ? 0 : c === 'NFC' ? 1 : 2);
  return out.sort((a, b) => confOrder(a.conference) - confOrder(b.conference) || a.division.localeCompare(b.division));
}

// "BAL -3.5" and "O/U 47.5" from parseOdds output; empty when there is none.
export function oddsBits(odds) {
  if (!odds) return [];
  const bits = [];
  if (odds.details) bits.push(odds.details);
  if (odds.total != null) bits.push('O/U ' + odds.total);
  return bits;
}

// Counts for a slate header: how many games, how many final, how many live.
export function slateCounts(games) {
  const list = arr(games);
  return {
    total: list.length,
    final: list.filter((g) => g?.state === 'post').length,
    live: list.filter((g) => g?.state === 'in').length,
  };
}

// Kickoff or tip-off as "Thu 8:15 PM ET". An unparseable time gives ''.
export function etKickoff(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit',
  }).replace(',', '') + ' ET';
}

function shiftYmd(yyyymmdd, days) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(str(yyyymmdd));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days, 12));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

// The NBA day the home page shows. It is the Eastern date of (now - 3h), so
// the slate flips at midnight Pacific, not midnight Eastern. Past that point
// it stays on yesterday while any of yesterday's games is still live
// (`yesterdayLive`), so a late West Coast game never drops off the page.
export function slateDay(now, yesterdayLive = false) {
  const d = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(d.getTime())) return null;
  const today = etDate(d);
  const shifted = etDate(new Date(d.getTime() - 3 * 3600000));
  if (shifted !== today) return shifted;
  return yesterdayLive ? shiftYmd(today, -1) : today;
}

function etParts(date) {
  const parts = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(date)) parts[part.type] = part.value;
  return parts;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 6am Eastern on the first Tuesday after `iso`, as epoch ms. DST-safe: try
// 10:00 UTC (6am EDT) and step to 11:00 UTC when that lands at 5am EST.
export function nflWeekCutoff(iso) {
  const start = new Date(iso);
  if (!iso || Number.isNaN(start.getTime())) return null;
  const p = etParts(start);
  let days = (2 - WEEKDAYS.indexOf(p.weekday) + 7) % 7;
  if (days === 0) days = 7;
  let t = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) + days, 10);
  if (Number(etParts(new Date(t)).hour) !== 6) t += 3600000;
  return t;
}

// The NFL week the home page shows: the earliest week whose last game was not
// yet followed by a Tuesday 6am ET, so Monday night stays up until Tuesday
// morning. Falls back to schedule.week when kickoffs are missing, and to the
// last week once the season is over.
export function nflSlateWeek(schedule, now) {
  const fallback = num(schedule?.week);
  const nowMs = (now instanceof Date ? now : new Date(now)).getTime();
  if (!Number.isFinite(nowMs)) return fallback;
  const last = new Map();
  for (const game of arr(schedule?.games)) {
    const week = num(game?.week);
    const t = Date.parse(str(game?.kickoff_utc));
    if (week == null || !Number.isFinite(t)) continue;
    if (!last.has(week) || t > last.get(week)) last.set(week, t);
  }
  if (!last.size) return fallback;
  const weeks = [...last.keys()].sort((a, b) => a - b);
  for (const week of weeks) {
    const cutoff = nflWeekCutoff(new Date(last.get(week)).toISOString());
    if (cutoff != null && nowMs < cutoff) return week;
  }
  return weeks[weeks.length - 1];
}

// ── Home page cards: NFL market lines, win %, leader captions ─────────────

// One CSV line, split on commas outside double quotes ("" is a literal quote).
function csvRow(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i += 1; } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// nflverse games.csv, the file nfl/js/schedule.js reads its market lines from,
// as a map keyed `week|AWAY|HOME` in the site's abbreviations (nflverse LA is
// LAR here). Only `season`'s regular-season rows. `spread` is nflverse's
// spread_line: points the home team is favoured by, negative when the away
// team is. Blank cells stay null.
export function parseNflLines(csv, season) {
  const rows = str(csv).split(/\r?\n/).filter((line) => line.trim());
  if (rows.length < 2) return {};
  const head = csvRow(rows[0]);
  const at = (name) => head.indexOf(name);
  const col = {
    season: at('season'), type: at('game_type'), week: at('week'), away: at('away_team'), home: at('home_team'),
    spread: at('spread_line'), total: at('total_line'), awayMl: at('away_moneyline'), homeMl: at('home_moneyline'),
  };
  if (col.week < 0 || col.away < 0 || col.home < 0) return {};
  const want = str(season);
  const map = {};
  for (let i = 1; i < rows.length; i += 1) {
    const v = csvRow(rows[i]);
    if (want && col.season >= 0 && v[col.season] !== want) continue;
    if (col.type >= 0 && v[col.type] !== 'REG') continue;
    const week = num(v[col.week]);
    const away = nflAbbr(v[col.away]);
    const home = nflAbbr(v[col.home]);
    if (week == null || !away || !home) continue;
    const cell = (index) => (index < 0 ? null : num(v[index]));
    map[`${week}|${away}|${home}`] = {
      spread: cell(col.spread),
      total: cell(col.total),
      awayMl: cell(col.awayMl),
      homeMl: cell(col.homeMl),
    };
  }
  return map;
}

// American odds as a probability with the vig still in. Takes -155, "+130"
// or "EVEN". null for anything that is not a price.
function mlImplied(ml) {
  const n = str(ml).trim().toUpperCase() === 'EVEN' ? 100 : num(ml);
  if (n == null || n === 0) return null;
  return n < 0 ? -n / (-n + 100) : 100 / (n + 100);
}

// Home win probability from the two moneylines with the bookmaker's margin
// removed: the same number as marketWinProb in nfl/js/schedule.js. null when
// either price is missing, never a made-up 50.
export function mlWinProb(homeMl, awayMl) {
  const h = mlImplied(homeMl);
  const a = mlImplied(awayMl);
  return h == null || a == null ? null : h / (h + a);
}

// Spread, total and no-vig win % for one nflWeekGames card. The nflverse row
// (parseNflLines) comes first, because the NFL page shows those numbers; ESPN's
// scoreboard odds fill whatever it lacks. null when neither has anything.
export function nflMarket(game, lines) {
  if (!game?.away || !game?.home) return null;
  const awayAbbr = nflAbbr(game.away.abbr);
  const homeAbbr = nflAbbr(game.home.abbr);
  const row = (lines && lines[`${num(game.week)}|${awayAbbr}|${homeAbbr}`]) || null;
  const espn = game.odds || null;

  let spread = '';
  if (row && row.spread != null) {
    if (row.spread === 0) spread = 'PK';
    else spread = row.spread > 0 ? `${homeAbbr} -${row.spread}` : `${awayAbbr} -${-row.spread}`;
  } else if (espn?.details) spread = espn.details;

  const total = row?.total ?? espn?.total ?? null;
  let home = row ? mlWinProb(row.homeMl, row.awayMl) : null;
  if (home == null && espn?.moneyline) home = mlWinProb(espn.moneyline.home, espn.moneyline.away);
  if (!spread && total == null && home == null) return null;
  return { spread, total, home, away: home == null ? null : 1 - home };
}

// 0.623 as "62%", '' for null.
export function pctText(p) {
  return p == null || !Number.isFinite(p) ? '' : Math.round(p * 100) + '%';
}

// ESPN's 500px team logo for an NFL abbreviation, for cards ESPN did not answer.
export function nflLogo(abbr) {
  const key = nflAbbr(abbr);
  if (!key) return '';
  return `${ESPN_CDN}/i/teamlogos/nfl/500/${key === 'WAS' ? 'wsh' : key.toLowerCase()}.png`;
}

// "J. Embiid" as "Embiid": cards are narrow, the full short name is the title.
export function leaderSurname(short) {
  const value = str(short).trim();
  return value.replace(/^(?:[A-Z]\.)+\s*/, '') || value;
}

// Caption over a card's PTS/REB/AST leaders (parseCompetitorLeaders `kind`).
// Season per-game numbers before tip-off; the game's own counts after, called
// "Tonight" on the slate being shown and "In this game" on any other day.
export function leaderCaption(kind, state, startISO, slate) {
  if (kind === 'season') return 'Season avg';
  if (state === 'in' || (slate && etDate(startISO) === slate)) return 'Tonight';
  return 'In this game';
}

// The game a league tile names: the first live game, else the next one to
// start (earliest startISO), else null once the slate is all final.
export function slateNext(games) {
  const list = arr(games).filter(Boolean);
  const live = list.find((g) => g.state === 'in');
  if (live) return live;
  const time = (g) => {
    const t = Date.parse(str(g.startISO));
    return Number.isFinite(t) ? t : Infinity;
  };
  return list.filter((g) => g.state === 'pre').sort((a, b) => time(a) - time(b))[0] || null;
}
