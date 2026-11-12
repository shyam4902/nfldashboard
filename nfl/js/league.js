// ═══════════════════════════════════════════════════════════
// LEAGUE — actual standings, leaders and current-season statistics
// ═══════════════════════════════════════════════════════════
// Same grammar as /nba/#standings and /nba/#leaders: team colour on stripes,
// swatches and map tiles, gold only on controls and active states. Styles are
// in nfl/league.css (lg-*). Pure helpers live in nfl/league-lib.js (tests:
// node --test nfl/league-lib.test.mjs) and team colours come from
// nflLib.teamLook in nfl/nfl-lib.js; both load by dynamic import().
//
// Standings and stats read build-time artifacts written by
// scripts/build_league_data.js and published by scripts/publish-daily.js.
// Standings are computed from completed regular-season finals in
// schedule.json; statistics come from the free Sleeper weekly stats API.
// Leaders are live from ESPN. This is ACTUAL data only: no projection model is
// mixed in, and missing data renders as missing ("—" / "no completed weeks"),
// never as a zero.
let LEAGUE_STANDINGS = null;
let LEAGUE_STATS = null;
let LEAGUE_SNAPS = null; // nfl_snaps_2026.json, optional: formation + team Snaps tab
const LEAGUE_MISSING = {};
let currentLeagueSubTab = 'standings';
let leagueStatsCategory = 'passing';
let leagueStatsWeek = 'season';
let leagueStatsTeam = 'all';

// Same module instances views.js uses, so nothing loads twice.
let lgLib = null;
let lgNfl = null;
async function leagueLibLoad(){
  if (!lgLib || !lgNfl) {
    [lgLib, lgNfl] = await Promise.all([
      import('/nfl/league-lib.js?v=20261111b'),
      import('/nfl/nfl-lib.js?v=20261111b'),
    ]);
  }
  return lgLib;
}

async function fetchLeagueArtifact(urls, key){
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok || !isJsonResponse(res)) throw new Error('bad or non-JSON response');
      const data = await res.json();
      data.__source = url;
      return data;
    } catch (err) { /* try the next path */ }
  }
  LEAGUE_MISSING[key] = true;
  return null;
}

async function loadLeagueArtifacts(){
  if (!LEAGUE_STANDINGS && !LEAGUE_MISSING.standings) {
    LEAGUE_STANDINGS = await fetchLeagueArtifact(
      ['/data/shared/nfl_standings_2026.json', '/nfl_standings_2026.json'], 'standings');
  }
  if (!LEAGUE_STATS && !LEAGUE_MISSING.stats) {
    LEAGUE_STATS = await fetchLeagueArtifact(
      ['/data/shared/nfl_stats_2026.json', '/nfl_stats_2026.json'], 'stats');
  }
  if (!LEAGUE_SNAPS && !LEAGUE_MISSING.snaps) {
    LEAGUE_SNAPS = await fetchLeagueArtifact(['/data/shared/nfl_snaps_2026.json'], 'snaps');
  }
}

// "updated 3h ago (2026-09-16T08:42:32Z)": the artifact's own embedded
// timestamp, which survives every copy and checkout. Absent timestamp = said
// so, never invented.
function leagueUpdatedLabel(artifact){
  if (!artifact || !artifact.generated_at) return 'update time not recorded by the source';
  const ms = Date.parse(artifact.generated_at);
  if (!Number.isFinite(ms)) return `updated ${homeEsc(String(artifact.generated_at))}`;
  const hours = Math.floor((Date.now() - ms) / 3600000);
  const ago = hours < 1 ? '<1h' : hours < 48 ? hours + 'h' : Math.round(hours / 24) + 'd';
  return `updated ${ago} ago (${homeEsc(artifact.generated_at)})`;
}

function leagueMissingPanel(what, detail){
  return `<div class="lg-card lg-missing">
    <b>${homeEsc(what)} is not available</b>
    <span>${homeEsc(detail)}</span>
    <span class="lg-faint">Nothing is shown rather than an invented number.</span>
  </div>`;
}

function lgPrefRead(key, allowed, fallback){
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : fallback;
  } catch (err) { return fallback; }
}

function lgPrefSave(key, value){
  try { localStorage.setItem(key, value); } catch (err) { /* private mode */ }
}

// Team colour for one abbreviation. `line` is the colour lifted until it
// reads as a stripe on the dark card; `fill`/`ink` paint whole tiles.
function lgLook(abbr){
  const want = lgNfl ? lgNfl.localAbbr(abbr) : String(abbr || '').toUpperCase();
  const team = (DATA.teams || []).find(t => t.abbr === want);
  const look = lgNfl ? lgNfl.teamLook(team) : { fill: '#3b4261', ink: '#ffffff' };
  const line = lgNfl ? lgNfl.readableOn(look.fill, '#14161a', 2) : look.fill;
  return { ...look, line };
}

function lgOpenTeam(name){
  if (typeof openRoster === 'function') openRoster(name);
}

// Segmented control: gold marks the pressed button.
function lgSeg(label, items, current, onclick){
  return `<div class="lg-seg" role="group" aria-label="${homeEsc(label)}">` + items.map(([key, text]) =>
    `<button type="button" aria-pressed="${key === current}" onclick="${onclick}('${key}')">${homeEsc(text)}</button>`).join('') + '</div>';
}

// Sortable header cell. The sorted column gets a gold underline.
function lgTh(col, sort, fn){
  const active = sort.key === col.key;
  const aria = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return `<th class="${[col.cls, active ? 'sorted' : ''].filter(Boolean).join(' ')}" scope="col" aria-sort="${aria}"${col.title ? ` title="${homeEsc(col.title)}"` : ''}>` +
    `<button type="button" class="lg-sort" onclick="${fn}('${col.key}')">${homeEsc(col.label)}` +
    `<span class="lg-arrow" aria-hidden="true">${active && sort.dir === 'desc' ? '▼' : '▲'}</span></button></th>`;
}

function lgNextSort(sort, key, cols){
  const col = cols.find(c => c.key === key);
  if (!col) return sort;
  return sort.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: col.dir };
}

function renderLeagueSubTabs(){
  const c = document.getElementById('leagueSubTabs');
  if (!c) return;
  const tabs = [
    ['standings', 'Standings', '🏈'],
    ['leaders', 'Leaders', '🏆'],
    ['stats', 'Stats', '📈'],
  ];
  c.innerHTML = tabs.map(([key, label, icon]) =>
    `<button class="teams-subtab ${currentLeagueSubTab === key ? 'active' : ''}" onclick="showLeague('${key}')" title="${label}">` +
    `<span class="subtab-icon">${icon}</span>${label}</button>`
  ).join('');
}

async function showLeague(sub){
  currentLeagueSubTab = ['standings', 'leaders', 'stats'].includes(sub) ? sub : 'standings';
  renderLeagueSubTabs();
  const panels = { standings: 'leagueStandingsPanel', leaders: 'leagueLeadersPanel', stats: 'leagueStatsPanel' };
  Object.entries(panels).forEach(([key, id]) =>
    document.getElementById(id)?.classList.toggle('hidden', key !== currentLeagueSubTab));
  try {
    await leagueLibLoad();
  } catch (err) {
    const host = document.getElementById({ standings: 'leagueStandings', leaders: 'leagueLeaders', stats: 'leagueStatsTable' }[currentLeagueSubTab]);
    if (host) host.innerHTML = leagueMissingPanel('This view', 'The league code did not load. Reload to retry.');
    return;
  }
  if (currentLeagueSubTab === 'leaders') {
    const stamp = document.getElementById('leagueFreshness');
    if (stamp) stamp.textContent = 'live from ESPN';
    if (typeof renderNflSearchInto === 'function') renderNflSearchInto('leagueLeadersSearch', 'nvLeadersSearch');
    return renderLeagueLeaders();
  }
  const work = [loadLeagueArtifacts()];
  if (currentLeagueSubTab === 'standings' && typeof loadSchedule === 'function') work.push(loadSchedule());
  await Promise.all(work);
  const stamp = document.getElementById('leagueFreshness');
  if (stamp) {
    const a = currentLeagueSubTab === 'standings' ? LEAGUE_STANDINGS : LEAGUE_STATS;
    stamp.textContent = a ? leagueUpdatedLabel(a) : '';
  }
  if (currentLeagueSubTab === 'standings') renderLeagueStandings();
  else renderLeagueStats();
}


// ═══════════════════════════════════════════════════════════
// STANDINGS — division / conference tables and the map
// ═══════════════════════════════════════════════════════════
let lgStScope = lgPrefRead('mb.nfl.standings.scope', ['division', 'conference'], 'division');
let lgStView = lgPrefRead('mb.nfl.standings.view', ['table', 'map'], 'table');
let lgStSort = { key: 'rank', dir: 'asc' };
let lgMapMetric = 'wins';
let lgMapGroups = [];

const LG_ST_COLS = [
  { key: 'rank', label: '#', dir: 'asc', cls: 'rk', title: 'Place in the group, by win % then point differential' },
  { key: 'team', label: 'Team', dir: 'asc', cls: 'team' },
  { key: 'w', label: 'W', dir: 'desc' },
  { key: 'l', label: 'L', dir: 'asc' },
  { key: 't', label: 'T', dir: 'desc' },
  { key: 'pct', label: 'PCT', dir: 'desc' },
  { key: 'pf', label: 'PF', dir: 'desc' },
  { key: 'pa', label: 'PA', dir: 'asc' },
  { key: 'diff', label: 'DIFF', dir: 'desc' },
  { key: 'l5', label: 'L5', dir: 'desc', title: 'Record in the last five games' },
  { key: 'strk', label: 'STRK', dir: 'desc', title: 'Current streak' },
];

function lgStValue(entry, key){
  const t = entry.row;
  switch (key) {
    case 'rank': return entry.rank;
    case 'team': return t.team || null;
    case 'w': return t.wins;
    case 'l': return t.losses;
    case 't': return t.ties;
    case 'pct': return t.win_pct;
    case 'pf': return t.points_for;
    case 'pa': return t.points_against;
    case 'diff': return t.differential;
    case 'l5': {
      if (!entry.form || !entry.form.last5) return null;
      const [w, l] = entry.form.last5.split('-').map(Number);
      return w - l / 10;
    }
    case 'strk': return entry.form ? lgLib.streakValue(entry.form.streak) : null;
    default: return null;
  }
}

// Form (streak, last five) for each team, cached per standings artifact.
let lgFormCache = null;
function lgForms(a){
  const games = (typeof SCHEDULE_DATA !== 'undefined' && SCHEDULE_DATA && SCHEDULE_DATA.games) || [];
  if (lgFormCache && lgFormCache.a === a && lgFormCache.games === games) return lgFormCache.map;
  const map = new Map();
  if (games.length) {
    for (const d of a.divisions) for (const t of d.teams || []) {
      map.set(t.abbr, lgLib.teamForm(games, t.team, a.generated_at, t));
    }
  }
  lgFormCache = { a, games, map };
  return map;
}

function setLeagueStandingsSort(key){
  lgStSort = lgNextSort(lgStSort, key, LG_ST_COLS);
  lgRenderStandingsTables();
  document.querySelector('#lgStTable th.sorted .lg-sort')?.focus({ preventScroll: true });
}

function setLeagueStandingsScope(scope){
  lgStScope = scope === 'conference' ? 'conference' : 'division';
  lgPrefSave('mb.nfl.standings.scope', lgStScope);
  lgStSort = { key: 'rank', dir: 'asc' };
  renderLeagueStandings();
}

function setLeagueStandingsView(view){
  lgStView = view === 'map' ? 'map' : 'table';
  lgPrefSave('mb.nfl.standings.view', lgStView);
  renderLeagueStandings();
}

function setLeagueMapMetric(metric){
  lgMapMetric = LG_MAP_METRICS[metric] ? metric : 'wins';
  lgLayoutMap();
}

// One standings table. `cuts` maps a row index to the line drawn under it,
// shown only in the natural order (rank ascending), where a line means
// something: the division leader, or seeds 1-4 and the wild-card places.
function lgStandingsTable(title, entries, options){
  const sort = lgStSort;
  const ordered = lgLib.sortRows(entries, sort.key, sort.dir, lgStValue);
  const natural = sort.key === 'rank' && sort.dir === 'asc';
  const hot = key => sort.key === key ? ' sorted' : '';
  const td = (key, html, cls) => `<td class="${[cls, hot(key).trim()].filter(Boolean).join(' ')}">${html}</td>`;
  const body = ordered.map((entry, i) => {
    const t = entry.row;
    const look = lgLook(t.abbr);
    const cut = natural && options.cuts ? (options.cuts[i] || '') : '';
    const form = entry.form;
    const strk = form && form.streak ? form.streak : '';
    const diff = t.differential;
    const logo = `<img src="${homeEsc(lgNfl.smallImg(getNflTeamLogo(t.abbr), 40, 40))}" alt="" width="20" height="20" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">`;
    const nameEsc = homeEsc(t.team);
    const tag = options.tag ? options.tag(entry) : '';
    return `<tr class="lg-row${cut}" style="--c:${look.line}">` +
      td('rank', entry.rank, 'rk') +
      td('team', `<span class="lg-tc"><span class="sw" aria-hidden="true"></span>${logo}` +
        `<button type="button" class="lg-tn" data-team="${nameEsc}" onclick="lgOpenTeam(this.dataset.team)" title="${nameEsc}: roster and depth chart">` +
        `<span class="full">${nameEsc}</span><span class="ab">${homeEsc(t.abbr)}</span></button>` +
        (tag ? `<span class="lg-tag">${homeEsc(tag)}</span>` : '') + '</span>', 'team') +
      td('w', t.wins ?? '—') +
      td('l', t.losses ?? '—') +
      td('t', t.ties ?? '—', 'dim') +
      td('pct', lgLib.pctText(t.win_pct)) +
      td('pf', t.points_for ?? '—', 'dim') +
      td('pa', t.points_against ?? '—', 'dim') +
      td('diff', lgLib.signedText(diff), diff > 0 ? 'up' : diff < 0 ? 'down' : '') +
      td('l5', form && form.last5 ? form.last5 : '—', 'dim') +
      td('strk', strk || '—', /^W/.test(strk) ? 'up' : /^L/.test(strk) ? 'down' : '') +
      `</tr>`;
  }).join('');
  const head = LG_ST_COLS.map(col => lgTh(col, sort, 'setLeagueStandingsSort')).join('');
  const label = LG_ST_COLS.find(c => c.key === sort.key).label;
  return `<section class="lg-card lg-st-block">` +
    `<div class="lg-st-h"><h3>${homeEsc(title)}</h3>${natural && options.key ? options.key : ''}</div>` +
    `<div class="lg-scroll"><table class="lg-st"><caption class="sr-only">${homeEsc(title)} standings, sorted by ${homeEsc(label)} ${sort.dir === 'asc' ? 'ascending' : 'descending'}</caption>` +
    `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></section>`;
}

function lgRenderStandingsTables(){
  const host = document.getElementById('lgStTable');
  const a = LEAGUE_STANDINGS;
  if (!host || !a) return;
  const forms = lgForms(a);
  const played = (a.completed_games || 0) > 0;
  const entry = (t, rank) => ({ row: t, rank, form: forms.has(t.abbr) ? forms.get(t.abbr) : null });
  const conferences = ['AFC', 'NFC'].filter(c => a.divisions.some(d => d.conference === c));
  if (lgStScope === 'conference') {
    host.innerHTML = conferences.map(conf => {
      const seeds = lgLib.conferenceSeeds(a.divisions, conf);
      const leaders = seeds.filter(t => t.divisionLeader).length;
      const cuts = {};
      if (played) {
        cuts[leaders - 1] = ' cut';
        if (seeds.length > leaders + 3) cuts[leaders + 2] = ' cut wc';
      }
      const key = played ? `<span class="lg-key"><i></i>1-${leaders} division leaders <i class="wc"></i>${leaders + 1}-${leaders + 3} wild card</span>` : '';
      return lgStandingsTable(conf, seeds.map(t => entry(t, t.seed)), {
        cuts, key,
        tag: e => played && e.row.divisionLeader ? String(e.row.division || '').replace(/^(AFC|NFC)\s+/, '') : '',
      });
    }).join('') +
      `<p class="lg-note">Seeds here rank by win %, then point differential, then points scored. The NFL's tiebreakers (head-to-head, division and conference record, strength of victory) are not applied, so a tied race can order differently.</p>`;
    return;
  }
  host.innerHTML = conferences.map(conf => {
    const divs = a.divisions.filter(d => d.conference === conf);
    return `<div class="lg-conf"><h3 class="lg-conf-h">${homeEsc(conf)}</h3><div class="lg-div-grid">` +
      divs.map(d => {
        const teams = (d.teams || []).slice().sort(lgLib.compareTeams);
        return lgStandingsTable(d.division, teams.map((t, i) => entry(t, i + 1)), {
          cuts: played ? { 0: ' cut' } : null,
          key: played ? '<span class="lg-key"><i></i>division leader</span>' : '',
        });
      }).join('') + '</div></div>';
  }).join('');
}

function renderLeagueStandings(){
  const meta = document.getElementById('leagueStandingsMeta');
  const body = document.getElementById('leagueStandings');
  if (!meta || !body) return;
  const a = LEAGUE_STANDINGS;
  if (!a || !Array.isArray(a.divisions)) {
    meta.innerHTML = '';
    body.innerHTML = leagueMissingPanel('Actual standings',
      'nfl_standings_2026.json was not published or did not load.');
    return;
  }
  const playedLine = a.completed_games
    ? `${a.completed_games} completed game${a.completed_games === 1 ? '' : 's'}, through week ${a.through_week}`
    : 'no games completed yet';
  meta.innerHTML = `<b>${a.season} regular season</b> · ${playedLine} · source: ${homeEsc(a.source)} · ${leagueUpdatedLabel(a)}`;

  const forms = lgForms(a);
  const formNote = forms.size
    ? 'L5 and STRK come from schedule.json finals up to the standings build. A team whose schedule results do not match its standings record shows a dash there.'
    : 'L5 and STRK need schedule.json, which did not load.';
  body.innerHTML = `<div class="lg-bar">` +
    lgSeg('Standings grouping', [['division', 'Division'], ['conference', 'Conference']], lgStScope, 'setLeagueStandingsScope') +
    lgSeg('Standings display', [['table', 'Table'], ['map', 'Map']], lgStView, 'setLeagueStandingsView') + `</div>` +
    `<div id="lgStTable"${lgStView === 'table' ? '' : ' hidden'}></div>` +
    `<div id="lgStMap"${lgStView === 'map' ? '' : ' hidden'}>${lgMapHTML(a)}</div>` +
    // The artifact's ordering note says no seeds are implied; the Conference
    // view does show seeds, with its own note on how they are ranked.
    `<p class="lg-note">${homeEsc(formNote)} ${lgStScope === 'division' ? homeEsc(a.ordering_note || '') : ''} ${homeEsc(a.projection_note || '')}</p>`;
  lgRenderStandingsTables();
  if (lgStView === 'map') lgLayoutMap();
}

/* ── Map: a squarified treemap, conference > division > team ─────────── */
const LG_MAP_METRICS = {
  wins: {
    label: 'Wins',
    note: 'Tile area follows wins. Winless teams get a sliver (a third of a win) so they stay on the map.',
    value: t => t.wins == null ? null : t.wins + 0.35,
    show: (t, compact) => t.wins + (compact ? '' : ' W'),
  },
  diff: {
    label: 'Point diff',
    note: 'Tile area follows point differential, shifted so every area is positive: area = diff minus the lowest diff, plus 1. Labels show the real differential.',
    value: (t, ctx) => t.differential == null ? null : t.differential - ctx.minDiff + 1,
    show: t => lgLib.signedText(t.differential),
  },
  pf: {
    label: 'Points scored',
    note: 'Tile area follows total points scored.',
    value: t => t.points_for,
    show: (t, compact) => t.points_for + (compact ? '' : ' PF'),
  },
};

function lgRecord(t){
  if (t.wins == null || t.losses == null) return '';
  return t.ties ? `${t.wins}-${t.losses}-${t.ties}` : `${t.wins}-${t.losses}`;
}

function lgMapHTML(a){
  lgMapGroups = ['AFC', 'NFC'].map(conf => ({
    conf,
    divisions: a.divisions.filter(d => d.conference === conf && (d.teams || []).length)
      .map(d => ({ name: String(d.division || '').replace(/^(AFC|NFC)\s+/, ''), teams: d.teams })),
  })).filter(g => g.divisions.length);
  const forms = lgForms(a);
  const tiles = lgMapGroups.flatMap(g => g.divisions.flatMap(d => d.teams)).map(t => {
    const look = lgLook(t.abbr);
    const form = forms.get(t.abbr);
    const tip = [t.team, lgRecord(t), 'DIFF ' + lgLib.signedText(t.differential), form && form.streak ? 'STRK ' + form.streak : ''].filter(Boolean).join(' · ');
    return `<button type="button" class="lg-tile" data-t="${homeEsc(t.abbr)}" data-team="${homeEsc(t.team)}" onclick="lgOpenTeam(this.dataset.team)" title="${homeEsc(tip)}" aria-label="${homeEsc(tip)}">` +
      `<span class="lg-tin" style="background:${look.fill};color:${look.ink}"><span class="lg-ttop">` +
      `<img class="lg-tlogo" src="${homeEsc(lgNfl.smallImg(getNflTeamLogo(t.abbr), 72, 72))}" alt="" width="28" height="28" decoding="async" onerror="this.remove()">` +
      `<span class="ab" data-l="ab">${homeEsc(t.abbr)}</span></span><span class="lg-tbot">` +
      `<span class="v" data-l="v"></span><span class="rc" data-l="rc"></span>` +
      `<span class="x" data-l="dx"></span><span class="x" data-l="st"></span></span></span></button>`;
  }).join('');
  const labels = lgMapGroups.map(g => `<span class="lg-mlab conf" data-c="${g.conf}">${g.conf}</span>` +
    g.divisions.map(d => `<span class="lg-mlab" data-d="${g.conf}/${homeEsc(d.name)}">${homeEsc(d.name)}</span>`).join('')).join('');
  return `<section class="lg-card lg-map-card" aria-label="Standings map">` +
    `<div class="lg-bar">${lgSeg('Size tiles by', Object.entries(LG_MAP_METRICS).map(([k, m]) => [k, m.label]), lgMapMetric, 'setLeagueMapMetric')}</div>` +
    `<p class="lg-note" id="lgMapNote"></p><div class="lg-map" id="lgMap">${labels}${tiles}</div></section>`;
}

// Text on a tile is budgeted from the tile's own size: lines are added in
// priority order (abbreviation, record, size metric, point diff, streak) at a
// font scaled to the tile and shrunk to fit; the first line that cannot fit,
// and everything after it, is dropped. Nothing can overflow.
function lgClamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function lgFitTile(el, t, r, spec, form){
  const s = Math.min(r.w, r.h);
  const padX = lgClamp(r.w * 0.07, 3, 9);
  const padY = lgClamp(r.h * 0.07, 3, 9);
  el.querySelector('.lg-tin').style.padding = padY + 'px ' + padX + 'px';
  const innerW = r.w - 4 - padX * 2;
  let room = r.h - 4 - padY * 2;
  const gap = s < 70 ? 1 : 3;
  const logo = el.querySelector('.lg-tlogo');
  if (logo) {
    const size = lgClamp(s * 0.2, 20, 30);
    const show = s >= 110 && room > size + 80;
    logo.style.display = show ? '' : 'none';
    if (show) { logo.style.width = logo.style.height = size + 'px'; room -= size + 5; }
  }
  const small = lgClamp(s * 0.085, 8.5, 11.5);
  const lines = [
    { l: 'ab', text: t.abbr, font: lgClamp(s * 0.24, 11, 34), min: 8, k: 0.74, lh: 1 },
    { l: 'rc', text: lgRecord(t), font: lgClamp(s * 0.11, 9, 14), min: 7.5, k: 0.62, lh: 1.15 },
    { l: 'v', text: lgMapMetric === 'wins' ? '' : spec.show(t), alt: spec.show(t, true), font: lgClamp(s * 0.13, 9, 20), min: 7.5, k: 0.62, lh: 1.1 },
    { l: 'dx', text: lgMapMetric === 'diff' || t.differential == null ? '' : 'DIFF ' + lgLib.signedText(t.differential), font: small, min: 7.5, k: 0.62, lh: 1.15 },
    { l: 'st', text: form && form.streak ? 'STRK ' + form.streak : '', font: small, min: 7.5, k: 0.62, lh: 1.15 },
  ];
  let used = 0;
  let open = true;
  for (const line of lines) {
    const node = el.querySelector(`[data-l="${line.l}"]`);
    let text = line.text;
    let font = line.font;
    let ok = open && Boolean(text);
    if (ok) {
      if (text.length * font * line.k > innerW && line.alt) text = line.alt;
      if (text.length * font * line.k > innerW) font = innerW / (text.length * line.k);
      const need = font * line.lh + (used ? gap : 0);
      ok = font >= line.min && used + need <= room;
      if (ok) used += need;
    }
    if (!ok) {
      node.style.display = 'none';
      if (text) open = false;
      continue;
    }
    node.textContent = text;
    node.style.fontSize = font + 'px';
    node.style.display = '';
  }
}

function lgLayoutMap(){
  const map = document.getElementById('lgMap');
  const note = document.getElementById('lgMapNote');
  const a = LEAGUE_STANDINGS;
  if (!map || !note || !a || !lgLib || !map.offsetParent) return;
  const W = map.clientWidth;
  if (W <= 0) return;
  const spec = LG_MAP_METRICS[lgMapMetric];
  const forms = lgForms(a);
  const teams = lgMapGroups.flatMap(g => g.divisions.flatMap(d => d.teams));
  const diffs = teams.map(t => t.differential).filter(d => d != null);
  const ctx = { minDiff: diffs.length ? Math.min(...diffs) : 0 };
  const valueOf = t => { const v = spec.value(t, ctx); return v != null && v > 0 ? v : null; };
  const sumTeams = list => list.reduce((acc, t) => acc + (valueOf(t) || 0), 0);
  const byAbbr = new Map(teams.map(t => [t.abbr, t]));
  const tileOf = abbr => map.querySelector(`[data-t="${abbr}"]`);
  let placed = 0;
  byAbbr.forEach((t, abbr) => { const el = tileOf(abbr); if (el) el.style.display = 'none'; });
  map.querySelectorAll('.lg-mlab').forEach(el => { el.style.display = 'none'; });
  const place = (el, x, y) => { if (!el) return; el.style.display = ''; el.style.left = x + 'px'; el.style.top = y + 'px'; };
  const drawTeams = (list, x, y, w, h) => {
    const items = list.map(t => ({ id: t.abbr, v: valueOf(t) })).filter(i => i.v != null).sort((p, q) => q.v - p.v);
    for (const r of lgLib.squarify(items, x, y, w, h)) {
      const el = tileOf(r.id);
      if (!el) continue;
      placed += 1;
      Object.assign(el.style, { display: '', left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      lgFitTile(el, byAbbr.get(r.id), r, spec, forms.get(r.id));
    }
  };
  if (W > 640) {
    const H = Math.round(Math.min(720, Math.max(520, W * 0.6)));
    map.style.height = H + 'px';
    const confs = lgMapGroups.map(g => ({ id: g.conf, g, v: g.divisions.reduce((acc, d) => acc + sumTeams(d.teams), 0) })).filter(c => c.v > 0);
    for (const c of lgLib.squarify(confs, 0, 0, W, H)) {
      place(map.querySelector(`[data-c="${c.id}"]`), c.x + 8, c.y + 5);
      const divs = c.g.divisions.map(d => ({ id: d.name, d, v: sumTeams(d.teams) })).filter(d => d.v > 0).sort((p, q) => q.v - p.v);
      for (const d of lgLib.squarify(divs, c.x + 3, c.y + 26, c.w - 6, c.h - 29)) {
        place(map.querySelector(`[data-d="${c.id}/${d.id}"]`), d.x + 7, d.y + 4);
        drawTeams(d.d.teams, d.x + 3, d.y + 22, d.w - 6, d.h - 25);
      }
    }
  } else {
    // Phone: divisions two to a row, each block cut from [0, W], so nothing
    // can overflow sideways.
    let y = 0;
    const half = (W - 8) / 2;
    const blockH = Math.round(W * 0.62);
    for (const g of lgMapGroups) {
      const live = g.divisions.filter(d => sumTeams(d.teams) > 0);
      if (!live.length) continue;
      place(map.querySelector(`[data-c="${g.conf}"]`), 2, y + 2);
      y += 26;
      for (let i = 0; i < live.length; i += 2) {
        live.slice(i, i + 2).forEach((d, j) => {
          const x = j * (half + 8);
          place(map.querySelector(`[data-d="${g.conf}/${d.name}"]`), x + 2, y);
          drawTeams(d.teams, x, y + 18, half, blockH);
        });
        y += 18 + blockH + 10;
      }
    }
    map.style.height = Math.max(0, y) + 'px';
  }
  const missing = byAbbr.size - placed;
  note.textContent = spec.note + (missing > 0 ? ` ${missing} team${missing === 1 ? '' : 's'} without a value for this left out.` : '');
  document.querySelectorAll('#lgStMap .lg-seg button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.getAttribute('onclick') === `setLeagueMapMetric('${lgMapMetric}')`)));
}

let lgResizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(lgResizeTimer);
  lgResizeTimer = setTimeout(lgLayoutMap, 80);
});


// ═══════════════════════════════════════════════════════════
// STATS — player and team tables from the Sleeper artifact
// ═══════════════════════════════════════════════════════════
const LEAGUE_STAT_COLUMNS = {
  passing: [
    ['pass_yd', 'YDS'], ['pass_td', 'TD'], ['pass_int', 'INT'],
    ['pass_cmp', 'CMP'], ['pass_att', 'ATT'], ['pass_cmp_pct', 'CMP%'],
  ],
  rushing: [
    ['rush_yd', 'YDS'], ['rush_td', 'TD'], ['rush_att', 'ATT'], ['rush_avg', 'AVG'],
  ],
  receiving: [
    ['rec_yd', 'YDS'], ['rec_td', 'TD'], ['rec', 'REC'], ['rec_tgt', 'TGT'],
  ],
};
// Columns where the lower number is better sort ascending on first tap.
const LG_LOW_FIRST = new Set(['pass_int']);
let lgStatsSort = { key: 'pass_yd', dir: 'desc' };

const LG_TOTAL_COLS = [
  { key: 'team', label: 'Team', dir: 'asc', cls: 'l pl' },
  { key: 'games', label: 'G', dir: 'desc' },
  { key: 'points_for', label: 'PF', dir: 'desc' },
  { key: 'points_against', label: 'PA', dir: 'asc' },
  { key: 'differential', label: 'DIFF', dir: 'desc' },
  { key: 'pass_yards', label: 'Pass Yds', dir: 'desc' },
  { key: 'rush_yards', label: 'Rush Yds', dir: 'desc' },
  { key: 'total_yards', label: 'Total Yds', dir: 'desc' },
  { key: 'offensive_tds', label: 'Off TD', dir: 'desc' },
  { key: 'yards_allowed', label: 'Yds Allowed', dir: 'asc' },
];
let lgTotalsSort = { key: 'points_for', dir: 'desc' };

function lgStatCols(){
  return [
    { key: 'name', label: 'Player', dir: 'asc', cls: 'l pl' },
    { key: 'team', label: 'Team', dir: 'asc', cls: 'l' },
    { key: 'pos', label: 'Pos', dir: 'asc', cls: 'l' },
    { key: 'games', label: 'GP', dir: 'desc' },
    ...LEAGUE_STAT_COLUMNS[leagueStatsCategory].map(([key, label]) => ({ key, label, dir: LG_LOW_FIRST.has(key) ? 'asc' : 'desc' })),
  ];
}

function leagueStatsControls(){
  const c = document.getElementById('leagueStatsControls');
  if (!c) return;
  const a = LEAGUE_STATS;
  const weeks = (a && Array.isArray(a.completed_weeks)) ? a.completed_weeks : [];
  const teams = a && Array.isArray(a.team_totals) ? a.team_totals.map(t => t.abbr).sort() : [];
  c.innerHTML = lgSeg('Stat group', [['passing', 'Passing'], ['rushing', 'Rushing'], ['receiving', 'Receiving']], leagueStatsCategory, 'setLeagueStatsCategory') +
    `<label class="lg-pick"><span>Week</span>
      <select id="leagueStatsWeekSelect" onchange="setLeagueStatsWeek(this.value)">
        <option value="season"${leagueStatsWeek === 'season' ? ' selected' : ''}>Season to date</option>
        ${weeks.map(w => `<option value="${w}"${String(leagueStatsWeek) === String(w) ? ' selected' : ''}>Week ${w}</option>`).join('')}
      </select></label>
    <label class="lg-pick"><span>Team</span>
      <select id="leagueStatsTeamSelect" onchange="setLeagueStatsTeam(this.value)">
        <option value="all"${leagueStatsTeam === 'all' ? ' selected' : ''}>All teams</option>
        ${teams.map(t => `<option value="${t}"${leagueStatsTeam === t ? ' selected' : ''}>${t}</option>`).join('')}
      </select></label>`;
}

function setLeagueStatsCategory(key){
  leagueStatsCategory = ['passing', 'rushing', 'receiving'].includes(key) ? key : 'passing';
  lgStatsSort = { key: LEAGUE_STAT_COLUMNS[leagueStatsCategory][0][0], dir: 'desc' };
  renderLeagueStats();
}

function setLeagueStatsWeek(value){
  leagueStatsWeek = value === 'season' ? 'season' : Number(value);
  renderLeagueStats();
}

function setLeagueStatsTeam(value){
  leagueStatsTeam = value || 'all';
  renderLeagueStats();
}

function setLeagueStatsSort(key){
  lgStatsSort = lgNextSort(lgStatsSort, key, lgStatCols());
  renderLeagueStats();
  document.querySelector('#leagueStatsTable th.sorted .lg-sort')?.focus({ preventScroll: true });
}

function setLeagueTotalsSort(key){
  lgTotalsSort = lgNextSort(lgTotalsSort, key, LG_TOTAL_COLS);
  renderLeagueStats();
  document.querySelector('#leagueTeamTotals th.sorted .lg-sort')?.focus({ preventScroll: true });
}

function lgCell(value){
  return value == null ? '—' : homeEsc(String(value));
}

function lgStatsTable(rows){
  const cols = lgStatCols();
  if (!cols.some(c => c.key === lgStatsSort.key)) lgStatsSort = { key: cols[4].key, dir: 'desc' };
  const sort = lgStatsSort;
  const ordered = lgLib.sortRows(rows, sort.key, sort.dir, (r, k) => r[k] ?? null);
  const hot = key => sort.key === key ? ' sorted' : '';
  const statCols = cols.slice(4);
  const body = ordered.length ? ordered.map((r, i) => {
    const look = lgLook(r.team);
    return `<tr class="lg-row" style="--c:${look.line}">` +
      `<td class="rk">${i + 1}</td>` +
      `<td class="l pl${hot('name')}"><span class="sw" aria-hidden="true"></span>${homeEsc(r.name)}</td>` +
      `<td class="l tm${hot('team')}">${homeEsc(r.team || 'FA')}</td>` +
      `<td class="l dim${hot('pos')}">${homeEsc(r.pos || '—')}</td>` +
      `<td class="dim${hot('games')}">${lgCell(r.games)}</td>` +
      statCols.map((c, j) => `<td class="${[j === 0 ? 'big' : '', hot(c.key).trim()].filter(Boolean).join(' ')}">${lgCell(r[c.key])}</td>`).join('') +
      `</tr>`;
  }).join('')
    : `<tr><td colspan="${cols.length + 1}" class="lg-empty">No ${homeEsc(leagueStatsCategory)} rows for this filter.</td></tr>`;
  return `<div class="lg-tbox"><table class="lg-tbl">` +
    `<caption class="sr-only">${homeEsc(leagueStatsCategory)} statistics</caption>` +
    `<thead><tr><th class="rk" scope="col">#</th>${cols.map(c => lgTh(c, sort, 'setLeagueStatsSort')).join('')}</tr></thead>` +
    `<tbody>${body}</tbody></table></div>`;
}

function lgTotalsTable(rows){
  const sort = lgTotalsSort;
  const ordered = lgLib.sortRows(rows, sort.key, sort.dir, (r, k) => r[k] ?? null);
  const hot = key => sort.key === key ? ' sorted' : '';
  const body = ordered.map(r => {
    const look = lgLook(r.abbr);
    const diff = r.differential;
    return `<tr class="lg-row" style="--c:${look.line}">` +
      `<td class="l pl${hot('team')}"><span class="sw" aria-hidden="true"></span>` +
      `<img src="${homeEsc(lgNfl.smallImg(getNflTeamLogo(r.abbr), 36, 36))}" alt="" width="18" height="18" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">` +
      `<span class="ab">${homeEsc(r.abbr)}</span><span class="full">${homeEsc(r.team)}</span></td>` +
      LG_TOTAL_COLS.slice(1).map(c => {
        const tone = c.key === 'differential' ? (diff > 0 ? 'up' : diff < 0 ? 'down' : '') : c.key === 'games' ? 'dim' : '';
        const v = c.key === 'differential' ? lgLib.signedText(diff) : lgCell(r[c.key]);
        return `<td class="${[tone, hot(c.key).trim()].filter(Boolean).join(' ')}">${v}</td>`;
      }).join('') + `</tr>`;
  }).join('');
  return `<div class="lg-tbox"><table class="lg-tbl lg-totals">` +
    `<caption class="sr-only">Team offense and defense totals</caption>` +
    `<thead><tr>${LG_TOTAL_COLS.map(c => lgTh(c, sort, 'setLeagueTotalsSort')).join('')}</tr></thead>` +
    `<tbody>${body}</tbody></table></div>`;
}

function renderLeagueStats(){
  const meta = document.getElementById('leagueStatsMeta');
  const table = document.getElementById('leagueStatsTable');
  const totals = document.getElementById('leagueTeamTotals');
  if (!meta || !table) return;
  const a = LEAGUE_STATS;
  leagueStatsControls();
  if (!a || !a.season_to_date) {
    meta.innerHTML = '';
    table.innerHTML = leagueMissingPanel('Current-season statistics',
      'nfl_stats_2026.json was not published or did not load.');
    if (totals) totals.innerHTML = '';
    return;
  }

  const weeks = Array.isArray(a.completed_weeks) ? a.completed_weeks : [];
  const isSeason = leagueStatsWeek === 'season';
  const source = isSeason ? a.season_to_date : (a.weeks && a.weeks[String(leagueStatsWeek)]);
  const coverage = weeks.length
    ? `completed week${weeks.length > 1 ? 's' : ''} ${weeks[0]}–${weeks[weeks.length - 1]}`
    : 'no completed weeks yet';
  meta.innerHTML = `<b>${a.season} regular season</b> · ${coverage}`
    + ` · source: ${homeEsc(a.source)} · ${leagueUpdatedLabel(a)}`
    + (isSeason ? '' : ` · showing week ${homeEsc(String(leagueStatsWeek))} only`);

  if (!isSeason && !source) {
    table.innerHTML = leagueMissingPanel(`Week ${leagueStatsWeek} statistics`,
      'That week has not finished, so no stats are published for it.');
  } else if (weeks.length === 0) {
    table.innerHTML = leagueMissingPanel('Current-season statistics',
      'No week has finished yet this season.');
  } else {
    const rows = (source[leagueStatsCategory] || []).filter(r =>
      leagueStatsTeam === 'all' || r.team === leagueStatsTeam);
    table.innerHTML = lgStatsTable(rows) +
      `<p class="lg-note">${homeEsc(a.null_handling || '')} Tap a column header to sort.</p>`;
  }

  if (totals) {
    const t = Array.isArray(a.team_totals) ? a.team_totals : [];
    totals.innerHTML = !t.length ? ''
      : `<div class="lg-sec-h"><h3>Team offense &amp; defense totals</h3>` +
        `<span>Actual, completed weeks only · points from schedule.json results</span></div>` +
        lgTotalsTable(t);
  }
}


// ═══════════════════════════════════════════════════════════
// LEADERS — season totals live from ESPN (CORS open)
// ═══════════════════════════════════════════════════════════
// Same Boards layout as /nba/#leaders: top ten per stat, serif values, the
// top three larger, and each player's season line from the same payload. A
// stat ESPN does not send is left off the line, never filled in.
const NFL_LEADERS_API = 'https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete';
const NFL_LEADER_BOARDS = [
  { group: 'passing', label: 'Passing yards', category: 'passing', stat: 'passingYards', unit: 'YDS' },
  { group: 'passing', label: 'Passing touchdowns', category: 'passing', stat: 'passingTouchdowns', unit: 'TD' },
  { group: 'rushing', label: 'Rushing yards', category: 'rushing', stat: 'rushingYards', unit: 'YDS' },
  { group: 'rushing', label: 'Rushing touchdowns', category: 'rushing', stat: 'rushingTouchdowns', unit: 'TD' },
  { group: 'receiving', label: 'Receiving yards', category: 'receiving', stat: 'receivingYards', unit: 'YDS' },
  { group: 'receiving', label: 'Receptions', category: 'receiving', stat: 'receptions', unit: 'REC' },
  // ponytail: ESPN returns 400 when sorting by interceptions, so that board is left out.
  { group: 'scoring', label: 'Total touchdowns', category: 'scoring', stat: 'totalTouchdowns', unit: 'TD' },
  { group: 'defense', label: 'Sacks', category: 'defensive', stat: 'sacks', unit: 'SACK' },
  { group: 'defense', label: 'Tackles', category: 'defensive', stat: 'totalTackles', unit: 'TKL' },
];
const LG_LEADER_GROUPS = [['all', 'All'], ['passing', 'Passing'], ['rushing', 'Rushing'], ['receiving', 'Receiving'], ['scoring', 'Scoring'], ['defense', 'Defense']];
const LG_GP = { key: 'gp', label: 'GP', cat: 'general', name: 'gamesPlayed' };
// Season line under each board, by stat category. The board's own stat is
// dropped from its line.
const LG_LEADER_LINES = {
  passing: [LG_GP,
    { key: 'cmp', label: 'CMP', cat: 'passing', name: 'completions' },
    { key: 'att', label: 'ATT', cat: 'passing', name: 'passingAttempts' },
    { key: 'pct', label: 'CMP%', cat: 'passing', name: 'completionPct' },
    { key: 'yds', label: 'YDS', cat: 'passing', name: 'passingYards' },
    { key: 'td', label: 'TD', cat: 'passing', name: 'passingTouchdowns' },
    { key: 'int', label: 'INT', cat: 'passing', name: 'interceptions' },
    { key: 'ypa', label: 'Y/A', cat: 'passing', name: 'yardsPerPassAttempt' },
    { key: 'rtg', label: 'RTG', cat: 'passing', name: 'QBRating' }],
  rushing: [LG_GP,
    { key: 'att', label: 'ATT', cat: 'rushing', name: 'rushingAttempts' },
    { key: 'yds', label: 'YDS', cat: 'rushing', name: 'rushingYards' },
    { key: 'avg', label: 'AVG', cat: 'rushing', name: 'yardsPerRushAttempt' },
    { key: 'td', label: 'TD', cat: 'rushing', name: 'rushingTouchdowns' },
    { key: 'lng', label: 'LNG', cat: 'rushing', name: 'longRushing' }],
  receiving: [LG_GP,
    { key: 'rec', label: 'REC', cat: 'receiving', name: 'receptions' },
    { key: 'tgt', label: 'TGT', cat: 'receiving', name: 'receivingTargets' },
    { key: 'yds', label: 'YDS', cat: 'receiving', name: 'receivingYards' },
    { key: 'avg', label: 'AVG', cat: 'receiving', name: 'yardsPerReception' },
    { key: 'td', label: 'TD', cat: 'receiving', name: 'receivingTouchdowns' },
    { key: 'lng', label: 'LNG', cat: 'receiving', name: 'longReception' }],
  scoring: [LG_GP,
    { key: 'rushTd', label: 'RUSH TD', cat: 'rushing', name: 'rushingTouchdowns' },
    { key: 'recTd', label: 'REC TD', cat: 'receiving', name: 'receivingTouchdowns' },
    { key: 'pts', label: 'PTS', cat: 'scoring', name: 'totalPoints' }],
  defensive: [LG_GP,
    { key: 'tkl', label: 'TKL', cat: 'defensive', name: 'totalTackles' },
    { key: 'solo', label: 'SOLO', cat: 'defensive', name: 'soloTackles' },
    { key: 'sack', label: 'SACK', cat: 'defensive', name: 'sacks' },
    { key: 'tfl', label: 'TFL', cat: 'defensive', name: 'tacklesForLoss' },
    { key: 'pd', label: 'PD', cat: 'defensive', name: 'passesDefended' },
    { key: 'qbh', label: 'QBH', cat: 'defensive', name: 'QBHits' },
    { key: 'int', label: 'INT', cat: 'defensiveInterceptions', name: 'interceptions' }],
};
const nflLeadersCache = new Map();
let lgLeaderGroup = 'all';

function setLeagueLeaderGroup(group){
  lgLeaderGroup = LG_LEADER_GROUPS.some(([k]) => k === group) ? group : 'all';
  const host = document.getElementById('leagueLeaders');
  if (!host) return;
  host.querySelectorAll('.lg-seg button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.getAttribute('onclick') === `setLeagueLeaderGroup('${lgLeaderGroup}')`)));
  host.querySelectorAll('.lg-ld-board').forEach(el => {
    el.hidden = lgLeaderGroup !== 'all' && el.getAttribute('data-g') !== lgLeaderGroup;
  });
}

function lgLeaderCols(board){
  return (LG_LEADER_LINES[board.category] || [LG_GP]).filter(c => !(c.cat === board.category && c.name === board.stat));
}

function lgLeaderBoardHTML(board, rows){
  if (!rows) return '<div class="lg-ld-none">ESPN did not answer for this board. Reload to retry.</div>';
  if (!rows.length) return '<div class="lg-ld-none">No data for this board yet.</div>';
  const top = rows.slice(0, 10);
  const cols = lgLeaderCols(board).filter(c => top.some(r => r.line[c.key] != null));
  const [a, b] = top;
  const lede = `<p class="lg-ld-lede"><b>${homeEsc(a.name)}</b>${a.teamAbbr ? ` (${homeEsc(a.teamAbbr)})` : ''} leads with <b>${lgLib.statText(a.value)}</b>` +
    (a.line.gp != null ? ` in ${a.line.gp} game${a.line.gp === 1 ? '' : 's'}` : '') +
    (b ? `; ${homeEsc(b.name)} is next at ${lgLib.statText(b.value)}` : '') + '.</p>';
  const lineOf = row => `<div class="lg-ld-line" style="--n:${cols.length}">` +
    cols.map(c => `<span data-k="${homeEsc(c.label)}">${lgLib.statText(row.line[c.key])}</span>`).join('') + '</div>';
  const head = `<div class="lg-ld-r hd" aria-hidden="true"><span></span><span></span><span></span><span class="val">${homeEsc(board.unit)}</span>` +
    `<div class="lg-ld-line" style="--n:${cols.length}">${cols.map(c => `<span>${homeEsc(c.label)}</span>`).join('')}</div></div>`;
  const body = top.map(row => {
    const look = lgLook(row.teamAbbr);
    const size = row.rank <= 3 ? 56 : 40;
    const shot = row.headshot
      ? `<img src="${homeEsc(lgNfl.smallImg(row.headshot, size * 2, Math.round(size * 1.46)))}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async" onerror="this.remove()">`
      : '';
    const name = row.id
      ? `<a href="#player/${homeEsc(row.id)}">${homeEsc(row.name)}</a>`
      : `<b>${homeEsc(row.name)}</b>`;
    return `<div class="lg-ld-r${row.rank <= 3 ? ' top' : ''}" style="--c:${look.line}">` +
      `<span class="rk">${row.rank}</span><span class="hs">${shot}</span>` +
      `<span class="nm">${name}<span><i style="background:${look.line}"></i>${homeEsc([row.teamAbbr, row.pos].filter(Boolean).join(' · '))}</span></span>` +
      `<span class="val">${lgLib.statText(row.value)}</span>${lineOf(row)}</div>`;
  }).join('');
  return lede + head + body;
}

async function renderLeagueLeaders(){
  const host = document.getElementById('leagueLeaders');
  if (!host) return;
  host.innerHTML = `<div class="lg-bar">${lgSeg('Leader boards', LG_LEADER_GROUPS, lgLeaderGroup, 'setLeagueLeaderGroup')}</div>` +
    '<div class="lg-ld-boards">' + NFL_LEADER_BOARDS.map(board =>
      `<section class="lg-card lg-ld-board" data-g="${board.group}"><div class="lg-ld-bh"><h3>${homeEsc(board.label)}</h3><span>Season totals</span></div>` +
      `<div class="board-body"><div class="lg-ld-none">Loading…</div></div></section>`).join('') + '</div>';
  setLeagueLeaderGroup(lgLeaderGroup);
  const sections = host.querySelectorAll('.lg-ld-board');
  await Promise.all(NFL_LEADER_BOARDS.map(async (board, i) => {
    const key = board.category + '.' + board.stat;
    let rows = null;
    try {
      if (!nflLeadersCache.has(key)) {
        const res = await fetch(NFL_LEADERS_API + '?limit=50&sort=' + encodeURIComponent(key + ':desc'));
        if (!res.ok) throw new Error('HTTP ' + res.status);
        nflLeadersCache.set(key, lgLib.parseNflLeaderLines(await res.json(), board.category, board.stat, lgLeaderCols(board), 0));
      }
      rows = nflLeadersCache.get(key);
    } catch (err) { rows = null; }
    const section = sections[i];
    if (!section || !section.isConnected) return;
    section.querySelector('.board-body').innerHTML = lgLeaderBoardHTML(board, rows);
    if (rows && rows.length) section.querySelector('.lg-ld-bh span').textContent = `Season totals · top 10 of ${rows.length} in ESPN's list`;
  }));
}
