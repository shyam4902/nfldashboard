// ═══════════════════════════════════════════════════════════
// TEAM COMPARE (#compare/<A>/<B>) and PLAYER PAGE (#player/<espnId>)
// ═══════════════════════════════════════════════════════════
// Same grammar as /nba/: dark chrome, team colour on the hero blocks, bars
// and chips, gold only on tabs. The rest of the NFL page keeps its theme.
// Pure parsers live in /nfl/nfl-lib.js (tests: node --test nfl/nfl-lib.test.mjs),
// loaded by dynamic import() like league.js loads /nba/nba.js.
//
// Compare reads only data the page already loads: nfl_standings_2026.json,
// nfl_stats_2026.json team totals, team_season_efficiency.json and
// schedule.json. The player page reads ESPN's keyless common/v3 athlete,
// overview and gamelog endpoints in the browser. A failed request leaves its
// block out or says it could not load; nothing is filled in.
const NFL_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/football/nfl';
const NFL_SEARCH_API = 'https://site.web.api.espn.com/apis/common/v3/search';
const NFL_VIEW_HASH = { compare: '#compare', player: '#player' };
let nflLib = null;
let nflViewToken = 0;

function nflViewHash(tab){
  return NFL_VIEW_HASH[tab] || null;
}

async function nflLibLoad(){
  nflLib = nflLib || await import('/nfl/nfl-lib.js?v=20261106c');
  return nflLib;
}

async function nflFetchJson(url, signal){
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function nflState(text){
  return '<div class="nv-state">' + homeEsc(text) + '</div>';
}

function nflTeamByAbbr(abbr){
  const want = nflLib ? nflLib.localAbbr(abbr) : String(abbr || '').toUpperCase();
  return (DATA.teams || []).find(t => String(t.abbr).toUpperCase() === want) || null;
}

function nflTeamByName(name){
  return (DATA.teams || []).find(t => t.name === name) || null;
}

/* ── Compare ────────────────────────────────────────────────────────────── */

function openNflCompareTeams(awayName, homeName, ev){
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const a = nflTeamByName(awayName);
  const b = nflTeamByName(homeName);
  location.hash = '#compare' + (a ? '/' + a.abbr : '') + (a && b ? '/' + b.abbr : '');
}

function nflCompareGo(){
  const a = document.getElementById('nvCmpA');
  const b = document.getElementById('nvCmpB');
  if (!a || !b) return;
  location.hash = '#compare' + (a.value ? '/' + a.value : '') + (a.value && b.value ? '/' + b.value : '');
}

function nflCompareSwap(){
  const a = document.getElementById('nvCmpA');
  const b = document.getElementById('nvCmpB');
  if (!a || !b || !a.value || !b.value) return;
  location.hash = '#compare/' + b.value + '/' + a.value;
}

function nflComparePickerHTML(teams, a, b){
  const options = sel => '<option value="">Select team…</option>' + teams.map(t =>
    '<option value="' + homeEsc(t.abbr) + '"' + (t.abbr === sel ? ' selected' : '') + '>' + homeEsc(t.name) + '</option>').join('');
  return '<div class="nv-pick">' +
    '<label>Team A<select id="nvCmpA" onchange="nflCompareGo()">' + options(a) + '</select></label>' +
    '<button type="button" class="nv-swap" onclick="nflCompareSwap()" title="Swap teams" aria-label="Swap teams">⇄</button>' +
    '<label>Team B<select id="nvCmpB" onchange="nflCompareGo()">' + options(b) + '</select></label></div>';
}

function nflStandingRows(){
  const a = LEAGUE_STANDINGS;
  if (!a) return [];
  if (Array.isArray(a.teams)) return a.teams;
  return (a.divisions || []).flatMap(d => d.teams || []);
}

// "2nd AFC East" from the artifact's own division order. Absent = ''.
function nflDivisionPlace(abbr){
  const divs = (LEAGUE_STANDINGS && LEAGUE_STANDINGS.divisions) || [];
  for (const d of divs) {
    const i = (d.teams || []).findIndex(t => t.abbr === abbr);
    if (i >= 0 && (LEAGUE_STANDINGS.completed_games || 0) > 0) return nflLib.ordinal(i + 1) + ' ' + d.division;
  }
  return '';
}

function nflKickoff(iso){
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function nflBlockHTML(team, standing, look, which){
  const logo = nflLib.smallImg(getNflTeamLogo(team.abbr), 72, 72);
  const record = standing ? standing.wins + '-' + standing.losses + (standing.ties ? '-' + standing.ties : '') : '';
  const place = nflDivisionPlace(team.abbr);
  return '<button type="button" class="gm-team ' + which + '" style="background:' + look.fill + ';color:' + look.ink + '" ' +
    'onclick="openRosterFromAbbr(\'' + homeEsc(team.abbr) + '\')" title="Open the ' + homeEsc(team.name) + ' roster">' +
    '<span class="gm-id"><span class="gm-logo"><img src="' + homeEsc(logo) + '" alt="" width="36" height="36" decoding="async"></span>' +
    '<span class="gm-ab">' + homeEsc(team.abbr) + '</span></span>' +
    '<span class="gm-nm">' + homeEsc(team.name) + '</span>' +
    (record || place ? '<span class="gm-rec">' + homeEsc(record) + (place ? '<i>' + homeEsc(place) + '</i>' : '') + '</span>' : '') +
    '</button>';
}

function nflMidHTML(game, series){
  const played = series.filter(g => g.final).length;
  if (!game) {
    return '<div class="gm-mid"><span class="gm-day">Season series</span><span class="gm-st">vs</span>' +
      '<span class="gm-meta">' + (series.length ? played + ' of ' + series.length + ' meetings played' : 'No meetings on the 2026 schedule') + '</span></div>';
  }
  const final = nflLib.isFinalGame(game);
  const status = final
    ? 'Final · ' + game.away_score + '-' + game.home_score
    : (game.status === 'in_progress' ? 'Live' : (nflKickoff(game.kickoff_utc) || 'Kickoff TBD'));
  return '<div class="gm-mid">' +
    '<span class="gm-day">Week ' + homeEsc(game.week) + '</span>' +
    '<span class="gm-st">' + homeEsc(status) + '</span>' +
    (game.venue ? '<span class="gm-meta">' + homeEsc(game.venue) + '</span>' : '') +
    (game.tv ? '<span class="gm-meta">' + homeEsc(game.tv) + '</span>' : '') +
    '<button type="button" class="cp-open" onclick="openMatchup(\'' + homeEsc(game.game_id) + '\')">Matchup preview →</button></div>';
}

function nflTapeHTML(rows, a, b, looks, rankOf){
  if (!rows.length) return '';
  const val = (side, which, lead) => '<b class="gm-v ' + which + (lead === which ? ' lead' : '') + '">' + homeEsc(side.text) +
    (side.rank ? '<small>' + homeEsc(nflLib.ordinal(side.rank)) + '</small>' : '') + '</b>';
  const bar = (which, amount, fill, lead) => '<span class="gm-bar ' + which + (lead === which ? ' lead' : '') + '"><i style="width:' +
    Math.round(amount * 100) + '%;background:' + fill + '"></i></span>';
  const body = rows.map(r => '<div class="gm-tr">' + val(r.a, 'a', r.lead) + bar('a', r.share.a, looks[0].fill, r.lead) +
    '<span class="gm-k">' + homeEsc(r.label) + '</span>' + bar('b', r.share.b, looks[1].fill, r.lead) + val(r.b, 'b', r.lead) + '</div>').join('');
  const abbr = (team, look) => '<span class="gm-abbr" style="color:' + nflLib.readableOn(look.fill, '#14161a') + '">' + homeEsc(team.abbr) + '</span>';
  return '<section class="card gm-card gm-tape" aria-label="Season comparison">' +
    '<div class="gm-th"><span class="a">' + abbr(a, looks[0]) + '</span><h2>Tale of the tape · 2026</h2><span class="b">' + abbr(b, looks[1]) + '</span></div>' +
    body +
    '<p class="nv-note">Small numbers are league ranks (1st = best) among the ' + rankOf + ' teams with data. ' +
    'Record and points: completed finals in schedule.json. Yards: Sleeper weekly stats. EPA, success, sack and turnover rates: nflverse play-by-play, 2026 season to date.</p>' +
    '</section>';
}

function nflSeriesHTML(series){
  if (!series.length) return '';
  const ab = name => (nflTeamByName(name) || {}).abbr || name;
  const rows = series.map(g => {
    const side = (name, score) => '<span class="gm-st2' + (!g.final ? '' : g.winner === name ? ' w' : g.winner ? ' l' : '') + '">' +
      homeEsc(ab(name)) + (g.final ? ' <b>' + homeEsc(score) + '</b>' : '') + '</span>';
    return '<button type="button" class="gm-sr" onclick="openMatchup(\'' + homeEsc(g.id) + '\')">' +
      '<span class="d">Week ' + homeEsc(g.week) + '</span>' +
      '<span class="m">' + side(g.away, g.awayScore) + '<i>@</i>' + side(g.home, g.homeScore) + '</span>' +
      '<span class="r' + (g.final ? '' : ' up') + '">' + (g.final ? 'Final' : homeEsc(nflKickoff(g.kickoff) || 'Upcoming')) + '</span></button>';
  }).join('');
  return '<section class="card gm-card"><div class="gm-ch"><h2>Season series</h2></div>' + rows + '</section>';
}

function nflLastFiveHTML(teams, looks){
  const games = SCHEDULE_DATA ? SCHEDULE_DATA.games || [] : [];
  const col = (team, look) => {
    const rows = nflLib.lastResults(games, team.name, 5);
    if (!rows.length) return '';
    const chips = rows.map(g => {
      const opp = (nflTeamByName(g.opponent) || {}).abbr || g.opponent;
      return '<button type="button" class="gm-g ' + g.result + '" onclick="openMatchup(\'' + homeEsc(g.id) + '\')" title="Week ' + homeEsc(g.week) + '">' +
        '<b>' + homeEsc(g.result) + '</b><span>' + homeEsc(g.atVs + ' ' + opp) + '</span><span>' + homeEsc(g.score) + '</span><span class="dt">Wk ' + homeEsc(g.week) + '</span></button>';
    }).join('');
    return '<div class="gm-l5c"><div class="gm-lh" style="--c:' + look.fill + '"><span class="gm-abbr" style="color:' +
      nflLib.readableOn(look.fill, '#14161a') + '">' + homeEsc(team.abbr) + '</span></div><div class="gm-chips">' + chips + '</div></div>';
  };
  const cols = col(teams[0], looks[0]) + col(teams[1], looks[1]);
  if (!cols) return '';
  return '<section class="card gm-card"><div class="gm-ch"><h2>Last 5</h2></div><div class="gm-l5">' + cols + '</div></section>';
}

async function showNflCompare(argA, argB){
  const token = ++nflViewToken;
  NFL_VIEW_HASH.compare = '#compare' + (argA ? '/' + argA : '') + (argA && argB ? '/' + argB : '');
  showTab('compare');
  const host = document.getElementById('nflCompare');
  if (!host) return;
  host.innerHTML = nflState('Loading…');
  try {
    await nflLibLoad();
    await Promise.all([loadSchedule(), loadLeagueArtifacts(), loadEfficiency()]);
  } catch (err) {
    if (token === nflViewToken) host.innerHTML = nflState('The compare view did not load.');
    return;
  }
  if (token !== nflViewToken) return;

  const teams = (DATA.teams || []).slice().sort((x, y) => x.name.localeCompare(y.name));
  const valid = abbr => (abbr && nflTeamByAbbr(abbr) ? nflTeamByAbbr(abbr).abbr : '');
  const games = (SCHEDULE_DATA && SCHEDULE_DATA.games) || [];
  let a = valid(argA);
  let b = valid(argB);
  let game = null;
  if (!a && !b) {
    game = nflLib.pickDefaultGame(games, SCHEDULE_DATA && SCHEDULE_DATA.week);
    if (game) {
      a = (nflTeamByName(game.away_team) || {}).abbr || '';
      b = (nflTeamByName(game.home_team) || {}).abbr || '';
    }
  }
  NFL_VIEW_HASH.compare = '#compare' + (a ? '/' + a : '') + (a && b ? '/' + b : '');
  writeHash('compare');

  if (!a || !b || a === b) {
    host.innerHTML = nflComparePickerHTML(teams, a, a === b ? '' : b) +
      nflState(a ? 'Pick a second team to compare.' : 'Pick two teams to compare their 2026 season.');
    return;
  }

  const teamA = nflTeamByAbbr(a);
  const teamB = nflTeamByAbbr(b);
  const series = nflLib.headToHead(games, teamA.name, teamB.name);
  // The game header shows this week's meeting, or the game that opened the page.
  if (!game) {
    const week = SCHEDULE_DATA && SCHEDULE_DATA.week;
    game = games.find(g => g.week === week && ((g.away_team === teamA.name && g.home_team === teamB.name) || (g.away_team === teamB.name && g.home_team === teamA.name))) || null;
  }
  const looks = nflLib.separateLooks(nflLib.teamLook(teamA), nflLib.teamLook(teamB));
  const standings = nflStandingRows();
  const rows = nflLib.compareRows(a, b, {
    standings,
    totals: (LEAGUE_STATS && LEAGUE_STATS.team_totals) || [],
    efficiency: EFFICIENCY_DATA || [],
  }, teams.map(t => t.abbr));
  const rankOf = rows.length ? Math.max(...rows.map(r => r.a.of)) : 0;
  const standingOf = abbr => standings.find(t => t.abbr === abbr) || null;

  const tape = nflTapeHTML(rows, teamA, teamB, looks, rankOf);
  const right = nflSeriesHTML(series) + nflLastFiveHTML([teamA, teamB], looks);
  document.title = teamA.abbr + ' vs ' + teamB.abbr + ' · Compare · Matchup Board';
  host.innerHTML = nflComparePickerHTML(teams, a, b) +
    '<div class="gm-bug">' + nflBlockHTML(teamA, standingOf(a), looks[0], 'away') + nflMidHTML(game, series) +
    nflBlockHTML(teamB, standingOf(b), looks[1], 'home') + '</div>' +
    (tape || right
      ? '<div class="gm-cols' + (tape && right ? ' two' : '') + '">' +
        (tape ? '<div class="gm-col">' + tape + '</div>' : '') + (right ? '<div class="gm-col">' + right + '</div>' : '') + '</div>'
      : nflState('No 2026 numbers have loaded for these teams yet.'));
}

/* ── Player search (ESPN search, NFL only) ──────────────────────────────── */

const nflSearchState = {};

function nflSearchHTML(prefix, value){
  return '<div class="nv-search" id="' + prefix + 'Wrap">' +
    '<label class="sr-only" for="' + prefix + 'Input">Find an NFL player</label>' +
    '<input id="' + prefix + 'Input" class="nv-search-input" type="search" autocomplete="off" placeholder="Find an NFL player…" ' +
    'role="combobox" aria-expanded="false" aria-controls="' + prefix + 'List" aria-autocomplete="list" value="' + homeEsc(value || '') + '">' +
    '<div id="' + prefix + 'List" class="nv-results" role="listbox" hidden></div></div>';
}

function nflSearchPaint(prefix, html){
  const list = document.getElementById(prefix + 'List');
  const input = document.getElementById(prefix + 'Input');
  if (!list || !input) return;
  list.innerHTML = html;
  list.hidden = !html;
  input.setAttribute('aria-expanded', String(!!html));
}

async function nflSearchRun(prefix, query){
  const st = nflSearchState[prefix] || (nflSearchState[prefix] = {});
  if (st.abort) st.abort.abort();
  const q = query.trim();
  if (q.length < 2) { nflSearchPaint(prefix, ''); return; }
  st.abort = new AbortController();
  nflSearchPaint(prefix, '<div class="nv-msg">Searching…</div>');
  try {
    await nflLibLoad();
    const json = await nflFetchJson(NFL_SEARCH_API + '?query=' + encodeURIComponent(q) + '&limit=25&type=player', st.abort.signal);
    const players = nflLib.parseNflSearch(json).slice(0, 8);
    st.index = -1;
    nflSearchPaint(prefix, players.length ? players.map(p => {
      const team = nflTeamByAbbr(p.teamAbbr);
      const shot = p.headshot ? '<img src="' + homeEsc(nflLib.smallImg(p.headshot, 56, 42)) + '" alt="" width="28" height="28" loading="lazy" decoding="async" onerror="this.remove()">' : '';
      return '<a class="nv-opt" role="option" href="#player/' + homeEsc(p.id) + '" style="--c:' + homeEsc((team && team.primary_color) || '#3b4261') + '">' +
        '<span class="hs">' + shot + '</span><span class="nm">' + homeEsc(p.name) + '</span><span class="tm">' + homeEsc(p.teamAbbr || 'FA') + '</span></a>';
    }).join('') : '<div class="nv-msg">No NFL players match "' + homeEsc(q) + '".</div>');
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    nflSearchPaint(prefix, '<div class="nv-msg">Search is unavailable right now.</div>');
  }
}

function wireNflSearch(prefix){
  const input = document.getElementById(prefix + 'Input');
  const wrap = document.getElementById(prefix + 'Wrap');
  if (!input || !wrap) return;
  const st = nflSearchState[prefix] || (nflSearchState[prefix] = {});
  input.addEventListener('input', () => {
    clearTimeout(st.timer);
    st.timer = setTimeout(() => nflSearchRun(prefix, input.value), 250);
  });
  input.addEventListener('keydown', e => {
    const opts = [...wrap.querySelectorAll('.nv-opt')];
    if (e.key === 'Escape') { nflSearchPaint(prefix, ''); return; }
    if (!opts.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      st.index = ((st.index ?? -1) + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
      opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === st.index)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = opts[st.index >= 0 ? st.index : 0];
      if (pick) location.hash = pick.getAttribute('href');
    }
  });
  if (input.value.trim().length >= 2) nflSearchRun(prefix, input.value);
}

// One outside-click handler for every search box, so re-renders add nothing.
document.addEventListener('click', e => {
  Object.keys(nflSearchState).forEach(prefix => {
    const wrap = document.getElementById(prefix + 'Wrap');
    if (wrap && !wrap.contains(e.target)) nflSearchPaint(prefix, '');
  });
});

function renderNflSearchInto(id, prefix){
  const el = document.getElementById(id);
  if (!el || el.dataset.ready) return;
  el.innerHTML = nflSearchHTML(prefix);
  el.dataset.ready = '1';
  wireNflSearch(prefix);
}

/* ── Player page ────────────────────────────────────────────────────────── */

// Roster rows carry no ESPN id: the name and team are matched against ESPN
// search (nflLib.matchSearchPlayer). An uncertain match shows the search
// results instead of guessing.
async function openNflPlayerFromEl(el, ev){
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const name = el.getAttribute('data-name') || '';
  const team = nflTeamByName(el.getAttribute('data-team') || '');
  if (typeof closeRoster === 'function') closeRoster();
  const token = ++nflViewToken;
  NFL_VIEW_HASH.player = '#player';
  showTab('player');
  const host = document.getElementById('nflPlayer');
  if (!host) return;
  host.innerHTML = nflState('Finding ' + name + ' on ESPN…');
  let match = null;
  try {
    await nflLibLoad();
    const json = await nflFetchJson(NFL_SEARCH_API + '?query=' + encodeURIComponent(name) + '&limit=25&type=player');
    match = nflLib.matchSearchPlayer(nflLib.parseNflSearch(json), name, team && team.abbr);
  } catch (err) { match = null; }
  if (token !== nflViewToken) return;
  if (match) {
    const target = '#player/' + match.id;
    if (location.hash === target) showNflPlayer(match.id);   // no hashchange fires for the same hash
    else location.hash = target;
    return;
  }
  host.innerHTML = nflSearchHTML('nvPlayerSearch', name) +
    nflState('ESPN search has no single NFL match for ' + name + (team ? ' (' + team.abbr + ')' : '') + '. Pick from the results above.');
  wireNflSearch('nvPlayerSearch');
}

function nflPlayerHeroHTML(athlete, look, tiles){
  const facts = [
    athlete.jersey ? '#' + athlete.jersey : '', athlete.pos, athlete.height, athlete.weight,
    athlete.age == null ? '' : athlete.age + ' yrs', athlete.experience, athlete.college,
  ].filter(Boolean).map(homeEsc).join(' · ');
  const chip = nflLib.contrastRatio(look.fill, '#ffffff') >= nflLib.contrastRatio(look.fill, '#000000') ? 'rgba(0,0,0,0.24)' : 'rgba(255,255,255,0.4)';
  const shot = athlete.headshot
    ? '<span class="pl-shot"><img src="' + homeEsc(nflLib.smallImg(athlete.headshot, 240, 175)) + '" alt="' + homeEsc(athlete.name) + '" width="120" height="88" decoding="async" onerror="this.remove()"></span>'
    : '';
  const team = nflTeamByAbbr(athlete.team.abbr);
  const tileHTML = tiles.map(t => '<span><i>' + homeEsc(t.label) + '</i><b>' + homeEsc(t.value) + '</b></span>').join('');
  return '<div class="pl-hero" style="background:' + look.fill + ';color:' + look.ink + ';--chip:' + chip + '">' +
    '<div class="pl-top"><div class="pl-who"><h1>' + homeEsc(athlete.name || 'Player') + '</h1>' +
    (team ? '<button type="button" class="pl-team" onclick="openRosterFromAbbr(\'' + homeEsc(team.abbr) + '\')">' + homeEsc(team.name) + '</button>'
      : (athlete.team.name ? '<span class="pl-team">' + homeEsc(athlete.team.name) + '</span>' : '')) +
    (facts ? '<div class="pl-facts">' + facts + '</div>' : '') +
    (athlete.status && athlete.status !== 'Active' ? '<div class="pl-facts">' + homeEsc(athlete.status) + '</div>' : '') +
    '</div>' + shot + '</div>' +
    (tileHTML ? '<div class="pl-tiles" aria-label="Regular season">' + tileHTML + '</div>' : '') + '</div>';
}

// Season totals by stat group, the player's own group first.
function nflSeasonTotalsHTML(log, season, pos){
  if (!season || !season.totals) return '';
  const groups = nflLib.orderGroups(log.groups, pos);
  const blocks = groups.map(g => {
    const cells = [];
    for (let i = g.start; i < g.start + g.count; i++) {
      const v = season.totals[i];
      if (v == null) continue;
      cells.push('<div class="tm-c"><span class="k">' + homeEsc(log.columns[i].label) + '</span><b>' + homeEsc(v) + '</b></div>');
    }
    if (!cells.length) return '';
    return (g.label ? '<h3 class="nv-sub">' + homeEsc(g.label) + '</h3>' : '') + '<div class="tm-sg">' + cells.join('') + '</div>';
  }).join('');
  if (!blocks) return '';
  return '<section class="card pl-card"><div class="ld-h"><h2>' + homeEsc(season.name) + ' totals</h2></div>' + blocks + '</section>';
}

function nflAveragesHTML(overview){
  if (!overview || !overview.columns.length || (!overview.season && !overview.career)) return '';
  const row = (title, values) => values ? '<tr><td class="sticky-col">' + homeEsc(title) + '</td>' +
    overview.columns.map((_, i) => '<td>' + (values[i] == null ? '—' : homeEsc(values[i])) + '</td>').join('') + '</tr>' : '';
  return '<section class="card pl-card"><div class="ld-h"><h2>Season and career</h2><span>ESPN</span></div>' +
    '<div class="nv-table"><table class="nv-log"><caption class="sr-only">Season and career statistics</caption><thead><tr><th class="sticky-col">Split</th>' +
    overview.columns.map(c => '<th>' + homeEsc(c.label) + '</th>').join('') + '</tr></thead><tbody>' +
    row('Season', overview.season) + row('Career', overview.career) + '</tbody></table></div></section>';
}

function nflGameTableHTML(log, season, pos){
  const groups = nflLib.orderGroups(log.groups, pos);
  const order = groups.flatMap(g => Array.from({ length: g.count }, (_, k) => g.start + k));
  const named = groups.some(g => g.label);
  const groupRow = named
    ? '<tr class="grp"><th class="sticky-col" colspan="1"></th><th colspan="2"></th>' +
      groups.map(g => '<th colspan="' + g.count + '">' + homeEsc(g.label) + '</th>').join('') + '</tr>'
    : '';
  const head = '<tr><th class="sticky-col">Wk</th><th class="l">Opp</th><th class="l">Result</th>' + order.map(i => '<th>' + homeEsc(log.columns[i].label) + '</th>').join('') + '</tr>';
  const body = season.games.map(g => {
    const opp = nflTeamByAbbr(g.opponentAbbr);
    const sw = '<i class="tm-sw" style="background:' + homeEsc((opp && opp.primary_color) || '#3b4261') + '"></i>';
    const res = g.result === 'W' || g.result === 'L' || g.result === 'T' ? '<span class="tm-wl ' + g.result + '">' + g.result + '</span>' : '';
    return '<tr><td class="sticky-col">' + homeEsc(g.week == null ? '' : g.week) + '</td>' +
      '<td class="opp">' + sw + homeEsc((g.atVs ? g.atVs + ' ' : '') + g.opponentAbbr) + '</td>' +
      '<td class="res">' + res + homeEsc(g.score) + '</td>' +
      order.map(i => '<td>' + (g.stats[i] == null ? '—' : homeEsc(g.stats[i])) + '</td>').join('') + '</tr>';
  }).join('');
  return '<div class="nv-table"><table class="nv-log pl-log"><caption class="sr-only">Game log</caption><thead>' + groupRow + head + '</thead><tbody>' + body + '</tbody></table></div>';
}

function nflGameLogHTML(log, pos){
  if (!log || !log.seasons.length) return '';
  const found = log.seasons.findIndex(s => /regular season/i.test(s.name));
  const active = found >= 0 ? found : 0;
  const tabs = log.seasons.length > 1
    ? '<div class="nv-tabs" role="tablist">' + log.seasons.map((s, i) =>
      '<button type="button" role="tab" class="nv-tab" data-season="' + i + '" aria-selected="' + (i === active) + '" onclick="nflSeasonTab(this)">' + homeEsc(s.name) + '</button>').join('') + '</div>'
    : '';
  const panels = log.seasons.map((s, i) => '<div data-season-panel="' + i + '"' + (i === active ? '' : ' hidden') + '>' + nflGameTableHTML(log, s, pos) + '</div>').join('');
  return '<section class="card pl-card"><div class="ld-h"><h2>Game log</h2><span>ESPN</span></div>' + tabs + panels + '</section>';
}

function nflSeasonTab(btn){
  const card = btn.closest('.pl-card');
  if (!card) return;
  card.querySelectorAll('.nv-tab').forEach(t => t.setAttribute('aria-selected', String(t === btn)));
  card.querySelectorAll('[data-season-panel]').forEach(p => { p.hidden = p.getAttribute('data-season-panel') !== btn.getAttribute('data-season'); });
}

async function showNflPlayer(id){
  const token = ++nflViewToken;
  const clean = String(id || '').replace(/[^0-9]/g, '');
  NFL_VIEW_HASH.player = clean ? '#player/' + clean : '#player';
  showTab('player');
  const host = document.getElementById('nflPlayer');
  if (!host) return;
  if (!clean) {
    document.title = 'Players · Matchup Board';
    host.innerHTML = nflSearchHTML('nvPlayerSearch') + nflState('Search ESPN for any NFL player, or open one from League > Leaders or a team roster.');
    wireNflSearch('nvPlayerSearch');
    return;
  }
  host.innerHTML = nflState('Loading player…');
  let results;
  try {
    await nflLibLoad();
    const base = NFL_WEB + '/athletes/' + clean;
    results = await Promise.allSettled([nflFetchJson(base), nflFetchJson(base + '/overview'), nflFetchJson(base + '/gamelog')]);
  } catch (err) {
    results = [{ status: 'rejected' }];
  }
  if (token !== nflViewToken) return;
  const athlete = results[0].status === 'fulfilled' ? nflLib.parseNflAthlete(results[0].value) : null;
  if (!athlete || !athlete.name) {
    host.innerHTML = nflSearchHTML('nvPlayerSearch') + nflState('This player did not load from ESPN. Try again, or search for another player.');
    wireNflSearch('nvPlayerSearch');
    return;
  }
  const overview = results[1] && results[1].status === 'fulfilled' ? nflLib.parseNflOverview(results[1].value) : null;
  const log = results[2] && results[2].status === 'fulfilled' ? nflLib.parseNflGameLog(results[2].value) : null;
  const regular = log ? (log.seasons.find(s => /regular season/i.test(s.name)) || log.seasons[0]) : null;
  const look = nflLib.teamLook(nflTeamByAbbr(athlete.team.abbr));
  const tiles = overview ? nflLib.heroStats(overview, athlete.pos) : [];

  document.title = athlete.name + ' · Matchup Board';
  const sections = nflSeasonTotalsHTML(log, regular, athlete.pos) + nflAveragesHTML(overview) + nflGameLogHTML(log, athlete.pos);
  const missing = [results[1].status === 'rejected' ? 'season stats' : '', results[2].status === 'rejected' ? 'game log' : ''].filter(Boolean);
  host.innerHTML = nflSearchHTML('nvPlayerSearch') + nflPlayerHeroHTML(athlete, look, tiles) +
    (sections || nflState('ESPN has no 2026 statistics for this player yet.')) +
    (missing.length ? '<p class="nv-note">The ' + missing.join(' and ') + ' did not load from ESPN.</p>' : '');
  wireNflSearch('nvPlayerSearch');
}
