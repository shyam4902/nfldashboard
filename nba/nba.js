// ESPN NBA payload parsers.
//
// Pure and dependency-free: no DOM, no network, no globals. Each parser reads
// the ESPN JSON shape it was given and returns a plain, stable object the page
// can render. Missing keys, empty payloads and junk entries produce an empty
// result instead of a throw, so the UI can always show something.

const STAT_KEYS = ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', 'PF', '+/-'];

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

export function parseScoreboard(json) {
  const games = [];
  for (const event of arr(json?.events)) {
    const competition = arr(event.competitions)[0];
    if (!competition) continue;

    const sides = { home: null, away: null };
    for (const competitor of arr(competition.competitors)) {
      const side = {
        ...teamOf(competitor),
        score: scoreOf(competitor),
        record: recordOf(competitor),
        winner: competitor.winner === true,
      };
      if (competitor.homeAway === 'home') sides.home = side;
      else if (competitor.homeAway === 'away') sides.away = side;
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
    teams.push({
      abbr: team.abbr,
      name: team.name,
      logo: team.logo,
      score: scoreOf(headerSide),
      starters,
      bench,
      dnp,
      totals: mapStats(labels, block?.totals),
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
