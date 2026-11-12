// ═══════════════════════════════════════════════════════════
// TEAMS GRID (#teams) and TEAM PAGE (#team/<ABBR>[/roster|/moves])
// ═══════════════════════════════════════════════════════════
// Same grammar as the /nba/ team page (tm-* classes): a team-colour hero,
// a season grid with league ranks, the schedule with opponent swatches and
// W/L chips, and the roster with headshots. Styles: nfl/teams.css.
//
// Sources, all already used elsewhere on the page:
//   records, home/road, streak, schedule  schedule.json finals
//   division place, points                nfl_standings_2026.json
//   yards                                 nfl_stats_2026.json team_totals
//   EPA, success, sack, takeaway rates    team_season_efficiency.json
//   roster, cap space                     Supabase nfl_players / nfl_teams
//   transactions                          Supabase nfl_transactions
//   ESPN ids and headshots                ESPN team roster, matched by name
// Pure helpers live in /nfl/nfl-lib.js (loaded through nflLibLoad() in
// views.js). A missing source leaves its block out; nothing is filled in.
const NFL_ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const nflEspnRosterCache = {};
let nflTeamPanel = 'schedule';
let nflTeamsGridToken = 0;

const ABBR_TO_TEAM = {
  'ARZ': 'Arizona Cardinals', 'ARI': 'Arizona Cardinals',
  'ATL': 'Atlanta Falcons',
  'BAL': 'Baltimore Ravens',
  'BUF': 'Buffalo Bills',
  'CAR': 'Carolina Panthers',
  'CHI': 'Chicago Bears',
  'CIN': 'Cincinnati Bengals',
  'CLE': 'Cleveland Browns',
  'DAL': 'Dallas Cowboys',
  'DEN': 'Denver Broncos',
  'DET': 'Detroit Lions',
  'GB': 'Green Bay Packers', 'GNB': 'Green Bay Packers',
  'HOU': 'Houston Texans',
  'IND': 'Indianapolis Colts',
  'JAX': 'Jacksonville Jaguars', 'JAC': 'Jacksonville Jaguars',
  'KC': 'Kansas City Chiefs', 'KAN': 'Kansas City Chiefs',
  'LV': 'Las Vegas Raiders', 'LVR': 'Las Vegas Raiders',
  'LAC': 'Los Angeles Chargers',
  'LAR': 'Los Angeles Rams', 'LA': 'Los Angeles Rams',
  'MIA': 'Miami Dolphins',
  'MIN': 'Minnesota Vikings',
  'NE': 'New England Patriots', 'NWE': 'New England Patriots',
  'NO': 'New Orleans Saints', 'NOR': 'New Orleans Saints',
  'NYG': 'New York Giants',
  'NYJ': 'New York Jets',
  'PHI': 'Philadelphia Eagles',
  'PIT': 'Pittsburgh Steelers',
  'SF': 'San Francisco 49ers', 'SFO': 'San Francisco 49ers',
  'SEA': 'Seattle Seahawks',
  'TB': 'Tampa Bay Buccaneers', 'TAM': 'Tampa Bay Buccaneers',
  'TEN': 'Tennessee Titans',
  'WAS': 'Washington Commanders', 'WSH': 'Washington Commanders'
};

/* ── Entry points kept for existing callers ─────────────────────────────── */

function openRosterFromAbbr(abbr, side = 'offense') {
  if (!abbr) return;
  const clean = String(abbr).trim().toUpperCase();
  const teamName = ABBR_TO_TEAM[clean] || (DATA?.teams?.find(t => t.abbr === clean || t.name.toLowerCase() === String(abbr).toLowerCase())?.name);
  if (teamName) openRoster(teamName, side);
}

// Older callers (command palette, quick chips, compare and player views)
// ask for "the roster". It is now the Roster tab of the team page.
function openRoster(team, side) {
  const row = (DATA.teams || []).find(t => t.name === team || t.abbr === team);
  if (!row) return;
  const target = '#team/' + row.abbr + '/roster';
  if (location.hash === target) showNflTeam(row.abbr, 'roster');
  else location.hash = target;
}

// The roster modal is gone; kept so ESC handlers and views.js can still call it.
function closeRoster() {
  const modal = document.getElementById('rosterModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

/* ── Small shared bits ──────────────────────────────────────────────────── */

function nflNickname(name) {
  const parts = String(name || '').split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : String(name || '');
}

function nflAbbrOf(name) {
  return (DATA.teamAbbr && DATA.teamAbbr[name]) || name;
}

function nflSigned(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const v = Number(n);
  return v > 0 ? '+' + v : String(v);
}

function nflPct(p) {
  if (p == null || !Number.isFinite(Number(p))) return '';
  return Number(p).toFixed(3).replace(/^0/, '');
}

function nflStandingFor(abbr) {
  return nflStandingRows().find(t => nflLib.localAbbr(t.abbr) === abbr) || null;
}

function nflShortKick(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function nflKickTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/* ── Teams grid (#tab-teams) ────────────────────────────────────────────── */

function nflTeamsGridRowHTML(team, place, standing, games) {
  const look = nflLib.teamLook(team);
  const splits = nflLib.teamSplits(games, team.name);
  const sched = nflLib.teamSchedule(games, team.name);
  const next = sched.rows.find(r => r.id && r.id === sched.nextId);
  const rec = standing ? nflLib.recordText(standing) : '';
  const diff = standing && standing.played ? Number(standing.differential) : null;
  const diffCls = diff == null ? '' : diff > 0 ? ' pos' : diff < 0 ? ' neg' : '';
  const nextText = next ? next.atVs + ' ' + nflAbbrOf(next.opponent) : '';
  const nextTitle = next ? 'Next: week ' + next.week + ' ' + next.atVs + ' ' + next.opponent : '';
  return '<a class="tg-row" href="#team/' + homeEsc(team.abbr) + '" data-team-search="' + homeEsc(team.name + ' ' + team.abbr) + '" style="--c:' + look.fill + '">' +
    '<span class="tg-pl">' + (place ? place : '') + '</span>' +
    '<span class="tg-logo"><img src="' + homeEsc(nflLib.smallImg(getNflTeamLogo(team.abbr), 48, 48)) + '" alt="" width="22" height="22" loading="lazy" decoding="async"></span>' +
    '<span class="tg-nm"><b>' + homeEsc(team.abbr) + '</b><span>' + homeEsc(nflNickname(team.name)) + '</span></span>' +
    '<span class="tg-n tg-rec">' + homeEsc(rec || '—') + '</span>' +
    '<span class="tg-n tg-df' + diffCls + '">' + homeEsc(diff == null ? '—' : nflSigned(diff)) + '</span>' +
    '<span class="tg-n tg-sk' + (splits.streak ? ' ' + splits.streak[0] : '') + '">' + homeEsc(splits.streak || '—') + '</span>' +
    '<span class="tg-n tg-nx" title="' + homeEsc(nextTitle) + '">' + homeEsc(nextText || '—') + '</span>' +
    '</a>';
}

function nflTeamsGridHTML(games) {
  const standingsDivs = (LEAGUE_STANDINGS && LEAGUE_STANDINGS.divisions) || [];
  const played = LEAGUE_STANDINGS && LEAGUE_STANDINGS.completed_games > 0;
  const divCard = (divName, names) => {
    const listed = (standingsDivs.find(d => d.division === divName) || {}).teams || [];
    const ordered = listed.map(s => ({ team: nflTeamByAbbr(s.abbr), standing: s })).filter(x => x.team);
    names.forEach(n => {
      if (!ordered.some(x => x.team.name === n)) {
        const team = nflTeamByName(n);
        if (team) ordered.push({ team, standing: null });
      }
    });
    const rows = ordered.map((x, i) => nflTeamsGridRowHTML(x.team, played && x.standing ? i + 1 : 0, x.standing, games)).join('');
    return '<section class="card tg-div" data-division="' + homeEsc(divName) + '">' +
      '<div class="tg-dh"><h3>' + homeEsc(divName.replace(/^(AFC|NFC) /, '')) + '</h3>' +
      '<span class="tg-n">W-L</span><span class="tg-n">Diff</span><span class="tg-n">Strk</span><span class="tg-n">Next</span></div>' +
      rows + '</section>';
  };
  const conf = name => {
    const divs = Object.entries(DATA.divisions || {}).filter(([d]) => d.startsWith(name));
    if (!divs.length) return '';
    return '<div class="tg-conf"><h2>' + name + '</h2><div class="tg-grid">' + divs.map(([d, names]) => divCard(d, names)).join('') + '</div></div>';
  };
  const week = LEAGUE_STANDINGS && LEAGUE_STANDINGS.through_week;
  const note = played
    ? 'Ordered by win percentage, then point differential, through week ' + homeEsc(week) + '. Not an official tiebreaker. Records, streaks and next games come from completed finals in schedule.json.'
    : 'No completed games yet, so records and differentials are blank.';
  return conf('AFC') + conf('NFC') + '<p class="nv-note">' + note + '</p>';
}

async function renderTeams() {
  const host = document.getElementById('teamsContainer');
  if (!host) return;
  const token = ++nflTeamsGridToken;
  if (!host.innerHTML.trim()) host.innerHTML = '<div class="nv-state">Loading teams…</div>';
  try {
    await nflLibLoad();
    await Promise.all([loadSchedule(), loadLeagueArtifacts()]);
  } catch (err) {
    if (token === nflTeamsGridToken) host.innerHTML = '<div class="nv-state">The Teams view did not load.</div>';
    return;
  }
  if (token !== nflTeamsGridToken) return;
  const games = (SCHEDULE_DATA && SCHEDULE_DATA.games) || [];
  host.innerHTML = nflTeamsGridHTML(games);
  const q = document.getElementById('searchBox');
  if (q && q.value && typeof filterDashboard === 'function') filterDashboard(q.value);
}

/* ── Team page (#tab-team) ──────────────────────────────────────────────── */

async function nflEspnRoster(team) {
  const key = team.abbr;
  if (nflEspnRosterCache[key]) return nflEspnRosterCache[key];
  const slug = (typeof NFL_ABBR_ESPN_MAP !== 'undefined' && NFL_ABBR_ESPN_MAP[key]) || key.toLowerCase();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const json = await nflFetchJson(NFL_ESPN_SITE + '/teams/' + encodeURIComponent(slug) + '/roster', ctrl.signal);
    const players = nflLib.parseEspnRoster(json);
    if (players.length) nflEspnRosterCache[key] = players;
    return players;
  } finally {
    clearTimeout(timer);
  }
}

function nflTeamHeroHTML(team, standing, splits, look) {
  const record = standing ? nflLib.recordText(standing) : '';
  const place = nflDivisionPlace(team.abbr);
  const chips = [];
  if (place) chips.push(['Division', place]);
  if (splits.streak) chips.push(['Streak', splits.streak]);
  if (splits.home) chips.push(['Home', splits.home]);
  if (splits.road) chips.push(['Road', splits.road]);
  if (splits.last5) chips.push(['Last 5', splits.last5.split('').join(' ')]);
  if (standing && standing.played) chips.push(['Points', standing.points_for + '-' + standing.points_against]);
  const cap = DATA.capData && DATA.capData[team.name];
  if (cap && Number.isFinite(cap.space) && team.cap_space != null) chips.push(['Cap space', formatCap(cap.space)]);
  const chip = nflLib.contrastRatio(look.fill, '#ffffff') >= nflLib.contrastRatio(look.fill, '#000000') ? 'rgba(0,0,0,0.24)' : 'rgba(255,255,255,0.4)';
  const logo = nflLib.smallImg(getNflTeamLogo(team.abbr), 112, 112);
  return '<div class="tm-hero" style="background:' + look.fill + ';color:' + look.ink + ';--chip:' + chip + '">' +
    '<div class="tm-id"><span class="tm-logo"><img src="' + homeEsc(logo) + '" alt="" width="46" height="46" decoding="async"></span>' +
    '<div class="tm-nm"><h1>' + homeEsc(team.name) + '</h1>' +
    (record ? '<span class="tm-rec"><b>' + homeEsc(record) + '</b>' + (standing && standing.played ? '<i>' + homeEsc(nflPct(standing.win_pct)) + '</i>' : '') + '</span>'
      : '<span class="tm-rec"><i>No games played yet</i></span>') +
    '</div><a class="tm-cmp" href="#compare/' + homeEsc(team.abbr) + '">Compare</a></div>' +
    (chips.length ? '<div class="tm-chips">' + chips.map(([k, v]) => '<span><i>' + homeEsc(k) + '</i><b>' + homeEsc(v) + '</b></span>').join('') + '</div>' : '') +
    '</div>';
}

function nflTeamStatsHTML(team, look) {
  const cells = nflLib.teamStatCells(team.abbr, {
    standings: nflStandingRows(),
    totals: (LEAGUE_STATS && LEAGUE_STATS.team_totals) || [],
    efficiency: EFFICIENCY_DATA || [],
  }, (DATA.teams || []).map(t => t.abbr));
  if (!cells.length) return '';
  const rk = nflLib.readableOn(look.fill, '#14161a');
  const of = Math.max(...cells.map(c => c.of));
  return '<section class="card tm-stats"><div class="ld-h"><h2>Season stats</h2><span>Rank of ' + of + '</span></div><div class="tm-grid">' +
    cells.map(c => '<div class="tm-c"><span class="k">' + homeEsc(c.label) + '</span><b>' + homeEsc(c.text) + '</b>' +
      (c.rank ? '<span class="rk" style="color:' + rk + '" title="League rank among ' + c.of + ' teams with data">' + homeEsc(nflLib.ordinal(c.rank)) + '</span>' : '') + '</div>').join('') +
    '</div><p class="nv-note">Points: completed finals. Yards: Sleeper weekly stats. EPA, success, sack and takeaway rates: nflverse play-by-play, 2026 to date. 1st = best.</p></section>';
}

function nflTeamGameRowHTML(row, next) {
  if (row.bye) {
    return '<div class="tm-g bye"><span class="tm-d">Wk ' + homeEsc(row.week) + '</span><span class="tm-o"><b>Bye</b></span><span class="tm-r"></span></div>';
  }
  const opp = nflTeamByName(row.opponent);
  const oppAbbr = opp ? opp.abbr : row.opponent;
  const fill = nflLib.teamLook(opp).fill;
  const right = row.final
    ? '<span class="tm-wl ' + row.result + '">' + row.result + '</span><span class="tm-sc">' + homeEsc(row.us + '-' + row.them) + '</span>'
    : '<span class="tm-up">' + (row.live ? 'Live' : homeEsc(nflKickTime(row.kickoff) || 'TBD')) + '</span>';
  return '<a class="tm-g' + (next ? ' next' : '') + '" href="#matchup/' + homeEsc(row.id) + '" style="--c:' + fill + '" title="Week ' + homeEsc(row.week) + ' ' + homeEsc(row.atVs + ' ' + row.opponent) + '">' +
    '<span class="tm-d">Wk ' + homeEsc(row.week) + '<small>' + homeEsc(nflShortKick(row.kickoff)) + '</small></span>' +
    '<span class="tm-o"><i class="tm-sw" style="background:' + fill + '"></i><span class="ha">' + row.atVs + '</span>' +
    '<img src="' + homeEsc(nflLib.smallImg(getNflTeamLogo(oppAbbr), 36, 36)) + '" alt="" width="18" height="18" loading="lazy" decoding="async">' +
    '<b>' + homeEsc(oppAbbr) + '</b></span>' +
    '<span class="tm-r">' + (next ? '<em>Next</em>' : '') + right + '</span></a>';
}

function nflTeamScheduleHTML(team, games) {
  const sched = nflLib.teamSchedule(games, team.name, SCHEDULE_DATA && SCHEDULE_DATA.total_weeks);
  if (!sched.rows.length) return nflState('No 2026 games on the schedule for this team.');
  const nextRow = sched.rows.find(r => r.id && r.id === sched.nextId);
  const cut = nextRow ? nextRow.week : Infinity;
  const upcoming = sched.rows.filter(r => (r.bye ? r.week >= cut : !r.final));
  const played = sched.rows.filter(r => (r.bye ? r.week < cut : r.final)).reverse();
  const count = list => list.filter(r => !r.bye).length;
  const col = (title, list, empty) => '<div class="tm-col"><div class="ld-h"><h2>' + title + '</h2><span>' + count(list) + ' games</span></div>' +
    (list.length ? list.map(r => nflTeamGameRowHTML(r, r.id && r.id === sched.nextId)).join('') : '<div class="nv-state">' + empty + '</div>') + '</div>';
  return '<div class="card tm-sched">' + col('Upcoming', upcoming, 'No games left.') + col('Results', played, 'No games played yet.') + '</div>';
}

function nflRosterCardHTML(team, p, look) {
  const shot = p.headshot
    ? '<img src="' + homeEsc(nflLib.smallImg(p.headshot, 96, 70)) + '" alt="" width="44" height="44" loading="lazy" decoding="async" onerror="this.remove()">'
    : '';
  const num = p.num != null && p.num !== '' ? '#' + p.num : '';
  const sub = [num, p.age ? p.age + ' yrs' : ''].filter(Boolean).join(' · ');
  const name = p.espnId
    ? '<a href="#player/' + homeEsc(p.espnId) + '">' + homeEsc(p.name) + '</a>'
    : '<button type="button" data-name="' + homeEsc(p.name) + '" data-team="' + homeEsc(team.name) + '" onclick="openNflPlayerFromEl(this, event)" title="Find ' + homeEsc(p.name) + ' on ESPN">' + homeEsc(p.name) + '</button>';
  const tag = p.isRookie ? '<i class="tm-tag">Rookie</i>' : (p.acquisitionType === 'fa' || p.acquisitionType === 'trade') ? '<i class="tm-tag">New</i>' : '';
  return '<div class="tm-p" data-rookie="' + (p.isRookie ? 1 : 0) + '" data-new="' + (p.isNew ? 1 : 0) + '">' +
    '<span class="tm-hs" style="--c:' + look.fill + ';color:' + look.ink + '"><b>' + homeEsc(p.num ?? '') + '</b>' + shot + '</span>' +
    '<span class="tm-pw"><span class="tm-pn">' + name + '</span><span class="tm-ps">' + homeEsc(sub) + '</span></span>' +
    '<span class="tm-pp"><b>' + homeEsc(p.pos || '—') + '</b>' + tag + '</span></div>';
}

function nflTeamRosterHTML(team, espn, look) {
  const roster = DATA.fullRosters && DATA.fullRosters[team.name];
  if (!roster) return nflState('No roster rows for this team in the Supabase snapshot.');
  const units = [['offense', 'Offense'], ['defense', 'Defense'], ['special', 'Special teams']];
  const known = new Set(units.map(u => u[0]));
  Object.keys(roster).forEach(k => { if (!known.has(k)) units.push([k, k]); });
  let total = 0;
  let matched = 0;
  let rookies = 0;
  let arrivals = 0;
  const blocks = units.map(([key, label]) => {
    const rows = nflLib.sortRoster(nflLib.attachEspnIds(roster[key] || [], espn));
    if (!rows.length) return '';
    total += rows.length;
    rows.forEach(r => { if (r.espnId) matched++; if (r.isRookie) rookies++; if (r.isNew) arrivals++; });
    return '<div class="tm-unit"><h3 class="nv-sub">' + homeEsc(label) + ' <span>' + rows.length + '</span></h3>' +
      '<div class="tm-roster">' + rows.map(p => nflRosterCardHTML(team, p, look)).join('') + '</div></div>';
  }).join('');
  if (!total) return nflState('No roster rows for this team in the Supabase snapshot.');
  const filters = '<div class="nv-tabs tm-filter" role="group" aria-label="Filter roster">' +
    '<button type="button" class="nv-tab" aria-pressed="true" data-filter="all" onclick="nflRosterFilter(this)">All ' + total + '</button>' +
    (rookies ? '<button type="button" class="nv-tab" aria-pressed="false" data-filter="rookie" onclick="nflRosterFilter(this)">Rookies ' + rookies + '</button>' : '') +
    (arrivals > rookies ? '<button type="button" class="nv-tab" aria-pressed="false" data-filter="new" onclick="nflRosterFilter(this)">Rookies and new ' + arrivals + '</button>' : '') +
    '</div>';
  const note = espn.length
    ? matched + ' of ' + total + ' players matched to ESPN by name for headshots and player pages. The rest open an ESPN search.'
    : 'ESPN headshots did not load. Player names open an ESPN search.';
  return filters + blocks + '<p class="nv-note">Roster: Supabase snapshot. ' + note + '</p>';
}

function nflRosterFilter(btn) {
  const host = btn.closest('[data-view="roster"]');
  if (!host) return;
  const f = btn.getAttribute('data-filter');
  host.querySelectorAll('.tm-filter .nv-tab').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
  host.querySelectorAll('.tm-p').forEach(card => {
    card.hidden = f === 'rookie' ? card.dataset.rookie !== '1' : f === 'new' ? card.dataset.new !== '1' : false;
  });
  host.querySelectorAll('.tm-unit').forEach(u => { u.hidden = !u.querySelector('.tm-p:not([hidden])'); });
}

function nflTeamMovesHTML(team) {
  const gains = typeof getTeamGains === 'function' ? getTeamGains(team.name) : [];
  const losses = typeof getTeamLosses === 'function' ? getTeamLosses(team.name) : [];
  const row = (t, other, arrow) => {
    const otherTeam = other ? nflTeamByName(other) : null;
    const sw = otherTeam ? '<i class="tm-sw" style="background:' + nflLib.teamLook(otherTeam).fill + '"></i>' : '';
    return '<div class="tm-mv"><span class="tm-d">' + homeEsc(t.date_str || '') + '</span>' +
      '<span class="tm-mn"><b>' + homeEsc(t.player_name || '') + '</b><small>' + homeEsc([t.pos, t.type].filter(Boolean).join(' · ')) + '</small></span>' +
      '<span class="tm-mo">' + (other ? sw + arrow + ' ' + homeEsc(otherTeam ? otherTeam.abbr : other) : '') + '</span></div>';
  };
  const col = (title, list, other, arrow) => '<div class="tm-col"><div class="ld-h"><h2>' + title + '</h2><span>' + list.length + '</span></div>' +
    (list.length ? list.map(t => row(t, t[other], arrow)).join('') : '<div class="nv-state">None recorded.</div>') + '</div>';
  const dc = DATA.draftCapital && DATA.draftCapital.capital && DATA.draftCapital.capital[team.name];
  const picks = dc ? '<section class="card tm-picks"><div class="ld-h"><h2>Draft picks</h2><span>draft-capital.json</span></div><div class="tm-grid">' +
    DATA.draftCapital.years.map(y => {
      const list = dc[String(y)] || [];
      return '<div class="tm-c"><span class="k">' + homeEsc(y) + '</span><b>' + list.length + '</b><span class="rk">' + homeEsc(list.length ? 'Rd ' + list.join(', ') : 'none') + '</span></div>';
    }).join('') + '</div></section>' : '';
  return '<div class="card tm-sched">' + col('Acquired', gains, 'from_team', '←') + col('Lost', losses, 'to_team', '→') + '</div>' + picks;
}

// Snaps tab: who is on the field, from nfl_snaps_2026.json. Each row is one
// player: a bar per game (his % of the unit's snaps), last-3-games share, the
// season share, and an arrow when his role moved 8+ points. Players under 10%
// over the last three games and 25% on the season are left out.
function nflTeamSnapsHTML(team, look) {
  const t = LEAGUE_SNAPS && LEAGUE_SNAPS.teams && LEAGUE_SNAPS.teams[team.abbr];
  if (!t) return '';
  const bar = nflLib.readableOn(look.fill, '#14161a', 3);
  const keep = p => p.last3 >= 10 || p.season >= 25;
  const arrow = p => {
    const tr = nflLib.snapTrend(p);
    return tr.dir === 'flat' ? '' : '<i class="sn-tr ' + tr.dir + '" title="' + (tr.delta > 0 ? '+' : '') + tr.delta + ' points vs season">' + (tr.dir === 'up' ? '▲' : '▼') + Math.abs(tr.delta) + '</i>';
  };
  const row = p => '<div class="sn-row"><span class="tm-mn"><b>' + homeEsc(p.name) + '</b><small>' + homeEsc(p.pos) + ' · ' + homeEsc(p.snaps) + ' snaps</small></span>' +
    '<span class="sn-bars" aria-hidden="true">' + p.weekly.map((v, i) => '<i style="height:' + Math.max(v, 2) + '%" title="Week ' + t.weeks[i] + ': ' + v + '%"></i>').join('') + '</span>' +
    '<span class="sn-v"><b>' + p.last3 + '%</b><small>' + p.season + '% season</small></span>' + arrow(p) + '</div>';
  const col = (title, unit) => {
    const list = t.players.filter(p => p.unit === unit && keep(p));
    return '<div class="tm-col"><div class="ld-h"><h2>' + title + '</h2><span>last 3 games</span></div>' + (list.length ? list.map(row).join('') : '<div class="nv-state">No snaps recorded.</div>') + '</div>';
  };
  const movers = t.players.filter(p => nflLib.snapTrend(p).dir !== 'flat' && (p.last3 >= 20 || p.season >= 20))
    .sort((a, b) => Math.abs(nflLib.snapTrend(b).delta) - Math.abs(nflLib.snapTrend(a).delta)).slice(0, 6);
  const moverChip = p => '<span class="sn-m ' + nflLib.snapTrend(p).dir + '"><b>' + homeEsc(p.name) + '</b> ' + homeEsc(p.pos) + ' ' + p.season + '% → ' + p.last3 + '%</span>';
  return (movers.length ? '<section class="card sn-movers"><div class="ld-h"><h2>Role changes</h2><span>season → last 3 games</span></div><div class="sn-mlist">' + movers.map(moverChip).join('') + '</div></section>' : '') +
    '<div class="card tm-sched sn" style="--c:' + bar + '">' + col('Offense', 'off') + col('Defense', 'def') + '</div>' +
    '<p class="nv-note">Snap counts: nflverse (Pro Football Reference box scores), regular season through week ' + homeEsc(LEAGUE_SNAPS.through_week) + '. A missed game counts as 0% in the season share. Bars are each game in order, weeks ' + homeEsc(t.weeks.join(', ')) + '.</p>';
}

// Injury report from the team's ESPN roster: each listed player's status and
// when it was posted. Out and injured reserve read red, the rest amber.
function nflInjuryCardHTML(espn) {
  const hurt = (espn || []).filter(p => p.injury);
  if (!espn || !espn.length) return '';
  const day = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  const sev = st => (/out|reserve|suspend|pup/i.test(st) ? 'out' : 'q');
  return '<section class="card inj"><div class="ld-h"><h2>Injury report</h2><span>' + (hurt.length ? hurt.length + ' listed' : 'No one listed') + ' · ESPN</span></div>' +
    (hurt.length ? '<div class="inj-l">' + hurt.map(p => '<div class="inj-r"><a href="#player/' + homeEsc(p.id) + '">' + homeEsc(p.name) + '</a><span class="inj-p">' + homeEsc(p.pos) + '</span>' +
      '<span class="inj-s ' + sev(p.injury.status) + '">' + homeEsc(p.injury.status) + '</span><span class="inj-d">' + homeEsc(day(p.injury.date)) + '</span></div>').join('') + '</div>' : '') + '</section>';
}

// Stats tab: every player's season line by group, from ESPN's team athlete
// statistics (the table ESPN shows on a team's Stats page). Loaded the first
// time the tab opens. Tables sort on a header click and scroll inside their
// card on a phone.
const nflTeamStatsCache = {};
const NFL_STAT_GROUPS = [
  ['passing', 'Passing', [['GP', 'gamesPlayed'], ['CMP', 'completions'], ['ATT', 'passingAttempts'], ['CMP%', 'completionPct', 1], ['YDS', 'passingYards'], ['Y/A', 'yardsPerPassAttempt', 1], ['TD', 'passingTouchdowns'], ['INT', 'interceptions'], ['SCK', 'sacks'], ['RTG', 'QBRating', 1], ['QBR', 'adjQBR', 1]]],
  ['rushing', 'Rushing', [['GP', 'gamesPlayed'], ['CAR', 'rushingAttempts'], ['YDS', 'rushingYards'], ['AVG', 'yardsPerRushAttempt', 1], ['TD', 'rushingTouchdowns'], ['LNG', 'longRushing'], ['Y/G', 'rushingYardsPerGame', 1], ['FUM', 'rushingFumbles']]],
  ['receiving', 'Receiving', [['GP', 'gamesPlayed'], ['REC', 'receptions'], ['TGT', 'receivingTargets'], ['YDS', 'receivingYards'], ['AVG', 'yardsPerReception', 1], ['TD', 'receivingTouchdowns'], ['LNG', 'longReception'], ['YAC', 'receivingYardsAfterCatch'], ['Y/G', 'receivingYardsPerGame', 1]]],
  ['defensive', 'Defense', [['GP', 'gamesPlayed'], ['TOT', 'totalTackles'], ['SOLO', 'soloTackles'], ['AST', 'assistTackles'], ['SACK', 'sacks', 1], ['TFL', 'tacklesForLoss'], ['PD', 'passesDefended'], ['INT', 'interceptions'], ['FF', 'fumblesForced']]],
  ['kicking', 'Kicking', [['GP', 'gamesPlayed'], ['FGM', 'fieldGoalsMade'], ['FGA', 'fieldGoalAttempts'], ['FG%', 'fieldGoalPct', 1], ['LNG', 'longFieldGoalMade'], ['XPM', 'extraPointsMade'], ['XPA', 'extraPointAttempts'], ['PTS', 'totalKickingPoints']]],
];

function nflSortable(table) {
  table.querySelectorAll('thead th[data-sort]').forEach(th => th.addEventListener('click', () => {
    const idx = Array.prototype.indexOf.call(th.parentNode.children, th);
    const desc = th.getAttribute('aria-sort') !== 'descending';
    table.querySelectorAll('thead th').forEach(h => h.removeAttribute('aria-sort'));
    th.setAttribute('aria-sort', desc ? 'descending' : 'ascending');
    const text = th.getAttribute('data-sort') === 'text';
    const body = table.tBodies[0];
    Array.from(body.rows).sort((a, b) => {
      const x = a.cells[idx].getAttribute('data-v'), y = b.cells[idx].getAttribute('data-v');
      if (x === '' || y === '') return x === y ? 0 : x === '' ? 1 : -1;
      const c = text ? x.localeCompare(y) : Number(x) - Number(y);
      return desc ? -c : c;
    }).forEach(r => body.appendChild(r));
  }));
}

function nflTeamStatsGroupsHTML(data, look) {
  const cards = NFL_STAT_GROUPS.map(([key, title, cols]) => {
    const rows = (data.groups[key] || []).filter(p => p.s.gamesPlayed);
    if (!rows.length) return '';
    const sortKey = cols[2] ? cols[2][1] : cols[1][1];
    const body = rows.map(p => '<tr><td class="ps-n" data-v="' + homeEsc(p.name) + '"><i class="tm-sw" style="background:' + look.fill + '"></i>' +
      '<a href="#player/' + homeEsc(p.id) + '">' + homeEsc(p.name) + '</a></td><td class="ps-p" data-v="' + homeEsc(p.pos) + '">' + homeEsc(p.pos || '—') + '</td>' +
      cols.map(([, k, dec]) => {
        const v = p.s[k];
        return '<td data-v="' + (v == null ? '' : v) + '">' + (v == null ? '—' : dec ? Number(v).toFixed(1) : Math.round(v)) + '</td>';
      }).join('') + '</tr>').join('');
    return '<section class="card ps-card"><div class="ld-h"><h2>' + title + '</h2><span>' + rows.length + ' players</span></div>' +
      '<div class="ps-scroll"><table class="ps-t"><caption class="sr-only">' + homeEsc(data.team.name) + ' ' + title.toLowerCase() + ' stats</caption><thead><tr>' +
      '<th class="ps-n" data-sort="text" scope="col">Player</th><th class="ps-p" data-sort="text" scope="col">Pos</th>' +
      cols.map(([label, k]) => '<th data-sort="num" scope="col"' + (k === sortKey ? ' aria-sort="descending"' : '') + '>' + label + '</th>').join('') +
      '</tr></thead><tbody>' + body + '</tbody></table></div></section>';
  }).join('');
  return (cards || nflState('No player stats yet this season.')) +
    '<p class="nv-note">' + homeEsc(data.season || '') + ' regular season · ESPN. Click a column to sort.</p>';
}

async function nflFillTeamStats(host, team, look) {
  if (!host || host.getAttribute('data-filled')) return;
  host.setAttribute('data-filled', '1');
  host.innerHTML = nflState('Loading player stats…');
  try {
    let data = nflTeamStatsCache[team.abbr];
    if (!data) {
      const slug = (typeof NFL_ABBR_ESPN_MAP !== 'undefined' && NFL_ABBR_ESPN_MAP[team.abbr]) || team.abbr.toLowerCase();
      const json = await nflFetchJson('https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/teams/' + encodeURIComponent(slug) + '/athletes/statistics');
      data = nflLib.parseNflTeamPlayerStats(json);
      nflTeamStatsCache[team.abbr] = data;
    }
    if (!host.isConnected) return;
    host.innerHTML = nflTeamStatsGroupsHTML(data, look);
    host.querySelectorAll('.ps-t').forEach(nflSortable);
  } catch (err) {
    host.removeAttribute('data-filled');
    host.innerHTML = nflState('Player stats did not load. Open the tab again to retry.');
  }
}

function nflTeamTab(btn) {
  const page = btn.closest('.tm');
  if (!page) return;
  const panel = btn.getAttribute('data-panel');
  nflTeamPanel = panel;
  page.querySelectorAll('.tm-tabs .nv-tab').forEach(t => t.setAttribute('aria-selected', String(t === btn)));
  page.querySelectorAll('section[data-view]').forEach(p => { p.hidden = p.getAttribute('data-view') !== panel; });
  const abbr = page.getAttribute('data-abbr');
  if (panel === 'stats') {
    const team = nflTeamByAbbr(abbr);
    if (team) nflFillTeamStats(page.querySelector('section[data-view="stats"]'), team, nflLib.teamLook(team));
  }
  NFL_VIEW_HASH.team = '#team/' + abbr + (panel === 'schedule' ? '' : '/' + panel);
  if (location.hash !== NFL_VIEW_HASH.team) history.replaceState(null, '', NFL_VIEW_HASH.team);
}

async function showNflTeam(arg, panelArg) {
  const token = ++nflViewToken;
  const panel = ['schedule', 'roster', 'stats', 'snaps', 'moves'].includes(panelArg) ? panelArg : 'schedule';
  const clean = String(arg || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  NFL_VIEW_HASH.team = clean ? '#team/' + clean + (panel === 'schedule' ? '' : '/' + panel) : '#teams';
  showTab('team');
  const host = document.getElementById('nflTeam');
  if (!host) return;
  host.innerHTML = nflState('Loading team…');
  try {
    await nflLibLoad();
    await Promise.all([loadSchedule(), loadLeagueArtifacts(), loadEfficiency()]);
  } catch (err) {
    if (token === nflViewToken) host.innerHTML = nflState('The team page did not load.');
    return;
  }
  if (token !== nflViewToken) return;
  const team = nflTeamByAbbr(clean);
  if (!team) {
    document.title = 'Teams · Matchup Board';
    host.innerHTML = nflState('No NFL team with the code "' + clean + '".') + '<p class="nv-state"><a class="tm-back" href="#teams">All teams</a></p>';
    return;
  }
  let espn = [];
  try { espn = await nflEspnRoster(team); } catch (err) { espn = []; }
  if (token !== nflViewToken) return;

  const games = (SCHEDULE_DATA && SCHEDULE_DATA.games) || [];
  const look = nflLib.teamLook(team);
  const standing = nflStandingFor(team.abbr);
  const splits = nflLib.teamSplits(games, team.name);
  nflTeamPanel = panel;
  document.title = team.name + ' · Matchup Board';
  const tab = (key, label) => '<button type="button" role="tab" class="nv-tab" data-panel="' + key + '" aria-selected="' + (key === panel) + '" onclick="nflTeamTab(this)">' + label + '</button>';
  const view = (key, html) => '<section data-view="' + key + '"' + (key === panel ? '' : ' hidden') + '>' + html + '</section>';
  const snaps = nflTeamSnapsHTML(team, look);
  host.innerHTML = '<div class="tm" data-abbr="' + homeEsc(team.abbr) + '">' +
    '<a class="tm-back" href="#teams">← All teams</a>' +
    nflTeamHeroHTML(team, standing, splits, look) + nflTeamStatsHTML(team, look) + nflInjuryCardHTML(espn) +
    '<div class="nv-tabs tm-tabs" role="tablist">' + tab('schedule', 'Schedule') + tab('roster', 'Roster') + tab('stats', 'Stats') + (snaps ? tab('snaps', 'Snaps') : '') + tab('moves', 'Moves') + '</div>' +
    view('schedule', nflTeamScheduleHTML(team, games)) +
    view('roster', nflTeamRosterHTML(team, espn, look)) +
    view('stats', '') +
    (snaps ? view('snaps', snaps) : '') +
    view('moves', nflTeamMovesHTML(team)) + '</div>';
  if (panel === 'stats') nflFillTeamStats(host.querySelector('section[data-view="stats"]'), team, look);
}
