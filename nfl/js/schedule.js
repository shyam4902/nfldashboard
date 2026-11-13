// ═══════════════════════════════════════════════════════════
// SCHEDULE TAB
// ═══════════════════════════════════════════════════════════
let SCHEDULE_DATA = null;
let currentScheduleWeek = 1;

async function loadSchedule(){
  if (SCHEDULE_DATA && SCHEDULE_DATA.games && SCHEDULE_DATA.games.length) return SCHEDULE_DATA;
  for (const url of ['/data/shared/schedule.json', '/schedule.json']) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok && isJsonResponse(res)) {
        SCHEDULE_DATA = await res.json();
        currentScheduleWeek = SCHEDULE_DATA.week || 1;
        return SCHEDULE_DATA;
      }
    } catch (e) {}
  }
  const el = document.getElementById('scheduleGrid');
  if (el) el.innerHTML = '<p class="text-xs text-red-400">Could not load schedule data</p>';
  SCHEDULE_DATA = { games: [] };
  currentScheduleWeek = 1;
  return SCHEDULE_DATA;
}

function scheduleWeeks(){
  return [...new Set((SCHEDULE_DATA?.games || []).map(g => g.week || 1))].sort((a,b) => a - b);
}

function setScheduleWeek(wk){
  currentScheduleWeek = wk;
  renderScheduleWeekChips();
  renderSchedule();
}

function showScheduleWeek(week){
  currentScheduleWeek = week;
  scheduleActiveFilter = 'all';
  scheduleView = 'cards';
  document.querySelectorAll('#scheduleFilterRow .sch-f-chip').forEach((chip, index) => chip.classList.toggle('on', index === 0));
  setScheduleView('cards');
  showTab('schedule');
}

// Cards ⇄ Grid toggle for the Schedule tab. The grid is the classic
// full-season matrix (32 teams × 18 weeks, BYE cells, home/away tint,
// clickable matchups) — the view that used to be the only Schedule view.
let scheduleView = 'cards';
function setScheduleView(v){
  scheduleView = v;
  const setBtn = (id, on) => {
    const b = document.getElementById(id);
    if (b) {
      b.className = 'sch-v-btn ' + (on ? 'on' : '');
    }
  };
  setBtn('schViewCards', v === 'cards');
  setBtn('schViewGrid', v === 'grid');
  const chips = document.getElementById('scheduleWeekChips')?.closest('.sch-week-pills-row');
  const filterRow = document.getElementById('scheduleFilterRow');
  const title = document.getElementById('scheduleTitle');
  if (chips) chips.style.display = v === 'cards' ? '' : 'none';
  if (filterRow) filterRow.style.display = v === 'cards' ? '' : 'none';
  if (title){
    if (v === 'grid') title.textContent = '2026 Full-Season Grid';
    else title.innerHTML = 'Week <span id="scheduleWeekNum">' + currentScheduleWeek + '</span> Matchups';
  }
  const badge = document.getElementById('scheduleWeekBadge');
  if (badge) badge.textContent = currentScheduleWeek;
  if (v === 'grid') renderScheduleGrid(); else renderSchedule();
}

// Full-season 32×18 matrix built from schedule.json's 272 games. Each cell
// is the opponent's abbreviation (home games tinted), BYE cells are blank,
// and every non-bye cell deep-links to the Matchup page.
function renderScheduleGrid(){
  const c = document.getElementById('scheduleGrid');
  if (!c) return;
  c.className = 'w-full';
  const data = SCHEDULE_DATA;
  if (!data || !data.games || !data.games.length){
    c.innerHTML = '<p class="text-xs text-slate-500">No schedule data.</p>';
    return;
  }
  const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const teams = new Set();
  const matrix = {};
  for (const g of data.games){
    teams.add(g.away_team); teams.add(g.home_team);
    const wk = g.week || 1;
    (matrix[g.away_team] = matrix[g.away_team] || {})[wk] = { opp: g.home_team, home: false, gid: g.game_id };
    (matrix[g.home_team] = matrix[g.home_team] || {})[wk] = { opp: g.away_team, home: true, gid: g.game_id };
  }
  const weeks = scheduleWeeks();
  const teamList = [...teams].sort();
  let h = '<div class="sch-matrix-wrap">' +
    '<div class="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[#2b3037]">' +
      '<div class="text-xs text-[#8f9299] font-medium">All 32 teams across 18 regular season weeks. Shaded blocks = Home games. Click any cell to open Matchup Center.</div>' +
      '<div class="flex items-center gap-3 text-[11px] text-[#8f9299]">' +
        '<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded bg-[#1e232c] border border-[#2e3542]"></span> Home (vs)</span>' +
        '<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded bg-transparent border border-[#2b3037]"></span> Away (@)</span>' +
      '</div>' +
    '</div>' +
    '<div class="overflow-x-auto w-full">' +
    '<table class="sch-matrix-tbl">' +
      '<thead><tr>' +
        '<th class="t-col">Team</th>';
  for (const w of weeks) h += '<th>W' + w + '</th>';
  h += '</tr></thead><tbody>';
  for (const name of teamList){
    const abbr = esc(teamAbbrFor(name) || name);
    const color = DATA.teamColors[name] || '#d9a441';
    h += '<tr>' +
      '<td class="t-cell">' +
        '<div class="flex items-center gap-2">' +
          '<span class="w-1 h-3.5 rounded-xs shrink-0" style="background:' + color + '"></span>' +
          '<span class="font-bold text-white text-[11px] font-archivo shrink-0">' + abbr + '</span>' +
          '<span class="text-[#8f9299] text-[11px] truncate">' + esc(name) + '</span>' +
        '</div>' +
      '</td>';
    for (const w of weeks){
      const cell = matrix[name] && matrix[name][w];
      if (!cell){
        h += '<td><span class="sch-m-bye">BYE</span></td>';
      } else {
        const opp = esc(teamAbbrFor(cell.opp) || cell.opp);
        const label = (cell.home ? '' : '@') + opp;
        const cls = cell.home ? 'home' : 'away';
        h += '<td class="p-0.5">' +
          '<button onclick="openMatchup(\'' + esc(cell.gid) + '\')" class="sch-m-btn ' + cls + '" title="WK ' + w + ': ' + (cell.home ? 'vs ' : 'at ') + esc(cell.opp) + ' — click for analysis">' +
            label +
          '</button>' +
        '</td>';
      }
    }
    h += '</tr>';
  }
  h += '</tbody></table></div></div>';
  c.innerHTML = h;
}

let scheduleActiveFilter = 'all';
function filterScheduleSlate(el, cat){
  scheduleActiveFilter = cat;
  if (el && el.parentElement){
    el.parentElement.querySelectorAll('.sch-f-chip').forEach(c => c.classList.remove('on'));
    el.classList.add('on');
  }
  renderSchedule();
}

function renderScheduleWeekChips(){
  const c = document.getElementById('scheduleWeekChips');
  if (!c) return;
  const weeks = scheduleWeeks();
  c.innerHTML = weeks.map(wk =>
    '<button onclick="setScheduleWeek(' + wk + ')" class="sch-wk-pill ' +
    (wk === currentScheduleWeek ? 'on' : '') +
    '">WK ' + wk + '</button>'
  ).join('');
}

// ── Live game lines (spread / total / moneyline) from nflverse's public
//    games.csv — the same free, keyless source the analytics server used.
const NFLVERSE_GAMES_URL = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv';
let MARKET_LINES = null;                 // map 'AWY|HOM' -> {spread,total,away_ml,home_ml}
let MARKET_LINES_ERR = null;

function csvParse(text){
  const out = [];
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return out;
  const split = (line) => {
    const vals = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++){
      const ch = line[i];
      if (ch === '"'){ if (inQ && line[i+1] === '"'){ cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === ',' && !inQ){ vals.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    vals.push(cur.trim());
    return vals;
  };
  const headers = split(lines[0]);
  for (let i = 1; i < lines.length; i++){
    const v = split(lines[i]);
    const row = {};
    headers.forEach((h, idx) => row[h] = v[idx] !== undefined ? v[idx] : '');
    out.push(row);
  }
  return out;
}

function num(v){ return (v === '' || v === undefined || v === null || Number.isNaN(Number(v))) ? null : Number(v); }

async function loadGameLines(){
  if (MARKET_LINES) return MARKET_LINES;
  if (MARKET_LINES_ERR) return {};
  try {
    const res = await fetch(NFLVERSE_GAMES_URL, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const map = {};
    for (const r of csvParse(text)){
      if (String(r.season) !== '2026' || String(r.game_type) !== 'REG') continue;
      if (!r.away_team || !r.home_team) continue;
      map[r.week + '|' + (r.away_team + '|' + r.home_team).toUpperCase()] = {
        spread: num(r.spread_line),          // from the home team's perspective
        total: num(r.total_line),
        away_ml: num(r.away_moneyline),
        home_ml: num(r.home_moneyline),
        source: 'nflverse'
      };
    }
    MARKET_LINES = map;
  } catch (err) {
    MARKET_LINES_ERR = err.message;
    MARKET_LINES = {};
  }
  return MARKET_LINES || {};
}

// Resolve real market lines for a game (matched by team abbreviation pair).
// Abbreviation resolves from the loaded team table first, then from the
// built-in ABBR_TO_TEAM map (so lines still render even before Supabase rows load).
let TEAM_TO_ABBR = null;
// Canonical nflverse game.csv abbreviations; maps the app's alternate spellings
// (e.g. ARZ/ARI, LAR/LA, JAC/JAX, KAN/KC, GNB/GB, NWE/NE, TAM/TB, WSH/WAS, SFO/SF, LVR/LV)
// onto the single form that nflverse uses so market lookups always match.
const CANON_ABBR = { ARZ:'ARI', ARI:'ARI', ARIZ:'ARI',
  LAR:'LA', LVR:'LV', KAN:'KC', GNB:'GB', NWE:'NE', NOS:'NO',
  TAM:'TB', WSH:'WAS', SFO:'SF', JAC:'JAX', OAK:'LV', SD:'LAC', STL:'LA' };
function canonicalAbbr(abbr){
  const up = String(abbr || '').toUpperCase();
  if (up === 'LA') return 'LA';
  return CANON_ABBR[up] || up;
}
function teamAbbrFor(name){
  const fromData = DATA.teamAbbr?.[name];
  if (fromData) return canonicalAbbr(fromData);
  if (!TEAM_TO_ABBR){
    TEAM_TO_ABBR = {};
    for (const [abbr, full] of Object.entries(ABBR_TO_TEAM)) TEAM_TO_ABBR[full] = TEAM_TO_ABBR[full] || abbr;
  }
  return canonicalAbbr(TEAM_TO_ABBR[name] || '');
}
function gameMarketLines(game){
  const line = MARKET_LINES || {};
  const a = teamAbbrFor(game.away_team);
  const h = teamAbbrFor(game.home_team);
  const key = (game.week || 1) + '|' + a + '|' + h;
  return (a && h) ? (line[key] || null) : null;
}

// Home win probability implied by the two moneylines, with the bookmaker's
// margin removed. The old projection model (and its fake 50/50 fallback) went
// with the week-9 cleanup; this is a real number or null.
function mlImplied(ml){
  if (ml === null || ml === undefined || !Number.isFinite(ml) || ml === 0) return null;
  return ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100);
}
function marketWinProb(market){
  const h = mlImplied(market && market.home_ml);
  const a = mlImplied(market && market.away_ml);
  return h === null || a === null ? null : h / (h + a);
}
// "62%" or "—" when the lines are missing; never a made-up 50.
function pctText(p){ return p === null || p === undefined ? '—' : Math.round(p * 100) + '%'; }

/* ── Game tile (Schedule and Home) ─────────────────────────────────────────
   The /nba/ scores frame (owner, 2026-11-14: port old NFL views to the NBA
   design). A header line (kickoff or result, TV, the line), one team-colour
   band per team (logo, abbr and name, record, then win % or the score), and a
   foot with Compare and the matchup link. `.sch-card`, `data-game` and the
   hidden `.sch-lines` row are what the browser tests select on. */
function gtInk(hex){
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.18 ? '#111' : '#fff';
}

// W-L(-T) from schedule.json finals, rebuilt when the schedule object changes.
let gtRecordCache = null;
function gtRecord(team){
  if (!gtRecordCache || gtRecordCache.src !== SCHEDULE_DATA) {
    const map = new Map();
    for (const g of (SCHEDULE_DATA && SCHEDULE_DATA.games) || []) {
      if (!(g.status === 'final' || g.winner) || g.away_score == null || g.home_score == null) continue;
      for (const [t, us, them] of [[g.away_team, g.away_score, g.home_score], [g.home_team, g.home_score, g.away_score]]) {
        const r = map.get(t) || [0, 0, 0];
        r[us > them ? 0 : us < them ? 1 : 2]++;
        map.set(t, r);
      }
    }
    gtRecordCache = { src: SCHEDULE_DATA, map };
  }
  const r = gtRecordCache.map.get(team);
  return r ? r[0] + '-' + r[1] + (r[2] ? '-' + r[2] : '') : '';
}

function nflGameTile(game, cls){
  const esc = homeEsc;
  const m = game.market || (game.market = gameMarketLines(game));
  const p = marketWinProb(m); // home team
  const isFinal = (game.status === 'final' || !!game.winner) && game.away_score != null && game.home_score != null;
  const isLive = game.status === 'in_progress';
  const d = new Date(game.kickoff_utc);
  const when = isNaN(d.getTime()) ? 'Kickoff TBD' : d.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  const day = isNaN(d.getTime()) ? '' : d.toLocaleString([], { weekday:'short', month:'short', day:'numeric' });
  const tv = game.tv ? String(game.tv).split(',')[0].trim() : '';
  const status = (isLive ? 'Live' : isFinal ? 'Final' + (day ? ' · ' + day : '') : when) + (tv ? ' · ' + tv : '');
  // nflverse spread_line is the home team's expected margin.
  const fav = m && m.spread != null ? (m.spread === 0 ? 'PK' : (teamAbbrFor(m.spread > 0 ? game.home_team : game.away_team) || '') + ' -' + Math.abs(m.spread)) : '';
  const line = [fav ? '<b>' + esc(fav) + '</b>' : '', m && m.total != null ? 'O/U ' + esc(m.total) : ''].filter(Boolean).join(' · ');
  const cap = !isFinal && !isLive && p !== null ? '<span class="gt-cap">Market win %</span>' : '<span class="gt-cap"></span>';

  const band = (team, which) => {
    const fill = DATA.teamColors[team] || '#3a3f47';
    const mine = which === 'away' ? game.away_score : game.home_score;
    const theirs = which === 'away' ? game.home_score : game.away_score;
    const lost = isFinal && mine < theirs;
    const prob = p === null ? null : (which === 'home' ? p : 1 - p);
    const mlv = m ? m[which + '_ml'] : null;
    const ml = mlv != null ? (mlv > 0 ? '+' + mlv : String(mlv)) : '';
    const right = isFinal || isLive
      ? '<span class="gt-sc">' + esc(mine == null ? '' : mine) + '</span>'
      : (prob === null ? '' : '<span class="gt-pct">' + Math.round(prob * 100) + '<small>%</small></span>') +
        (ml ? '<span class="gt-ml">ML ' + esc(ml) + '</span>' : '');
    return '<div class="gt-band' + (lost ? ' lost' : '') + '" style="background:' + fill + ';color:' + gtInk(fill) + '">' +
      '<span class="gt-logo"><img src="' + esc(getNflTeamLogo(team)) + '" alt="" width="24" height="24" loading="lazy" decoding="async"></span>' +
      '<span class="gt-id"><span class="gt-ab">' + esc(teamAbbrFor(team) || team) + '</span><span class="gt-nm">' + esc(team) + '</span></span>' +
      '<span class="gt-rc">' + esc(gtRecord(team)) + '</span>' +
      '<span class="gt-r">' + right + '</span></div>';
  };

  const pct = v => v === null ? '—' : Math.round(v * 100) + '%';
  const testLines = '<div class="sch-lines hidden">' +
    '<div class="sch-line"><b>' + esc(m && m.spread != null ? m.spread : '—') + '</b></div>' +
    '<div class="sch-line"><b>' + esc(m && m.total != null ? m.total : '—') + '</b></div>' +
    '<div class="sch-line"><b>' + pct(p === null ? null : 1 - p) + '</b></div></div>';
  const id = esc(game.game_id);
  return '<article class="gt ' + (cls || 'sch-card') + '" tabindex="0" role="button" data-game="' + id + '" ' +
    'aria-label="View analysis for ' + esc(game.away_team) + ' at ' + esc(game.home_team) + '" ' +
    'onclick="openMatchup(\'' + id + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openMatchup(\'' + id + '\');}">' +
    '<div class="gt-hd"><span class="gt-st' + (isLive ? ' live' : '') + '">' + (isLive ? '<i class="dot"></i>' : '') + esc(status) + '</span>' +
      cap + (line ? '<span class="gt-ln">' + line + '</span>' : '') + '</div>' +
    '<div class="gt-body">' + band(game.away_team, 'away') + band(game.home_team, 'home') + '</div>' +
    testLines +
    '<div class="gt-ft"><button type="button" class="sch-cmp" data-away="' + esc(game.away_team) + '" data-home="' + esc(game.home_team) + '" ' +
      'onclick="openNflCompareTeams(this.dataset.away, this.dataset.home, event)" onkeydown="event.stopPropagation()" ' +
      'title="Compare ' + esc(game.away_team) + ' and ' + esc(game.home_team) + '">Compare teams</button>' +
      '<span class="sch-cta">View matchup →</span></div>' +
    '</article>';
}

// Featured-matchup carousel on the Schedule page. Same rotation as the home
// hero: 7s auto-advance, pause on hover, dots + arrows.
function initScheduleMarquee(){
  const track = document.getElementById('schMarqTrack');
  const wrap = document.getElementById('schMarquee');
  if (window.__schMarqTimer) { clearInterval(window.__schMarqTimer); window.__schMarqTimer = null; }
  if (!track || !wrap) return;
  const n = track.children.length;
  if (n < 2) return;
  const dots = Array.prototype.slice.call(wrap.querySelectorAll('.sch-marq-dot'));
  const label = document.getElementById('schMarqLabel');
  let i = 0, paused = false;
  const render = () => {
    track.style.transform = 'translateX(-' + (i * (100 / n)) + '%)';
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    if (label) label.textContent = (i + 1) + ' / ' + n + ' \u00b7 ' +
      ((dots[i] && dots[i].dataset.label) || '') + (paused ? ' \u00b7 PAUSED' : '');
  };
  const go = k => { i = (k + n) % n; render(); };
  const prev = document.getElementById('schMarqPrev');
  const next = document.getElementById('schMarqNext');
  if (prev) prev.addEventListener('click', () => go(i - 1));
  if (next) next.addEventListener('click', () => go(i + 1));
  dots.forEach(d => d.addEventListener('click', () => go(+d.dataset.go)));
  wrap.addEventListener('mouseenter', () => { paused = true; render(); });
  wrap.addEventListener('mouseleave', () => { paused = false; render(); });
  window.__schMarqTimer = setInterval(() => { if (!paused) go(i + 1); }, 7000);
  render();
}


async function renderSchedule(){
  if (scheduleView === 'grid') return renderScheduleGrid();
  const c = document.getElementById('scheduleGrid');
  if (!c) return;
  c.className = 'w-full';
  await Promise.all([
    loadGameLines(),
    nflLibLoad().catch(() => null),
    (!LEAGUE_STANDINGS && !LEAGUE_MISSING.standings
      ? fetchLeagueArtifact(['/data/shared/nfl_standings_2026.json', '/nfl_standings_2026.json'], 'standings').then(d => { LEAGUE_STANDINGS = LEAGUE_STANDINGS || d; })
      : Promise.resolve()),
  ]);
  const data = SCHEDULE_DATA;
  if (!data || !data.games || !data.games.length) {
    c.innerHTML = '<p class="text-xs text-slate-500">No schedule data.</p>';
    return;
  }
  renderScheduleWeekChips();
  const weekNumEl = document.getElementById('scheduleWeekNum');
  if (weekNumEl) weekNumEl.textContent = currentScheduleWeek;
  const weekBadgeEl = document.getElementById('scheduleWeekBadge');
  if (weekBadgeEl) weekBadgeEl.textContent = currentScheduleWeek;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  
  const weekGames = data.games.filter(g => (g.week || 1) === currentScheduleWeek);
  const sorted = weekGames.slice().sort((a,b)=>String(a.kickoff_utc||'').localeCompare(String(b.kickoff_utc||'')));
  
  // Categorize games for filtering
  sorted.forEach(game => {
    game.market = gameMarketLines(game);
    const prob = marketWinProb(game.market);
    game._hProb = prob;
    game._aProb = prob === null ? null : (1 - prob);
    game._categories = gameCategories(game);
  });

  const activeFilter = typeof scheduleActiveFilter !== 'undefined' ? scheduleActiveFilter : 'all';
  const filtered = activeFilter === 'all' ? sorted : sorted.filter(g => g._categories.includes(activeFilter));

  const buildGameCard = (game) => nflGameTile(game, 'sch-card');

  // Featured matchups — rotating carousel of this week's best games, same
  // mechanic as the home hero except every slide is a real game.
  let marqueeHtml = '';
  // Each slide is the Matchup page's team-colour scorebug (nfl/js/matchup.js).
  const marqueeSlide = (feat, kicker) =>
    '<div class="sch-marq-slide"><div class="sch-marquee-pad">' +
      '<div class="hm-kick"><span>' + esc(kicker) + '</span><span class="hm-src">Win % from the moneylines, no-vig</span></div>' +
      renderMatchupHeroBanner(feat, feat.away_team, feat.home_team) +
      '<div class="hm-act"><button type="button" class="hm-btn hm-btn-gold" onclick="openMatchup(\'' + esc(feat.game_id) + '\')">Open matchup →</button>' + '</div>' +
    '</div></div>';
  const featKicker = (g) => {
    const c = g._categories || [];
    if (c.includes('snf')) return 'Sunday night';
    if (c.includes('primetime')) return 'Primetime';
    if (c.includes('close')) return 'Toss-up of the week';
    if (c.includes('divisional')) return 'Division game';
    if (c.includes('high-total')) return 'Highest total';
    return 'Featured matchup';
  };
  const featured = pickFeaturedGames(sorted, 3);
  if (featured.length && activeFilter === 'all') {
    const nSlides = featured.length;
    const slides = featured.map(g => marqueeSlide(g, featKicker(g))).join('');
    const dots = featured.map((g, i) => '<span class="sch-marq-dot' + (i === 0 ? ' on' : '') +
      '" data-go="' + i + '" data-label="' + esc(featKicker(g)) + '"></span>').join('');
    marqueeHtml = '<div class="sch-marquee" id="schMarquee">' +
      '<div class="sch-marq-viewport"><div class="sch-marq-track" id="schMarqTrack" style="width:' +
        (nSlides * 100) + '%;--marq-w:' + (100 / nSlides) + '%">' + slides + '</div></div>' +
      (nSlides > 1 ?
        '<div class="sch-marq-nav">' + dots +
          '<span class="sch-marq-label" id="schMarqLabel"></span>' +
          '<span class="sch-marq-arrows">' +
            '<span class="sch-marq-arrow" id="schMarqPrev" role="button" tabindex="0" aria-label="Previous featured game">\u2039</span>' +
            '<span class="sch-marq-arrow" id="schMarqNext" role="button" tabindex="0" aria-label="Next featured game">\u203a</span>' +
          '</span></div>' : '') +
      '</div>';
  }

  // Partition games into chronological broadcast windows
  const windows = [];
  const earlyGames = [];
  const lateGames = [];
  const primeGames = [];
  const otherGames = [];

  sorted.forEach(g => {
    const day = gameEtDay(g);
    const etHour = gameEtHour(g);
    const tv = String(g.tv || '').toUpperCase();

    if (day === 'THU' || day === 'FRI' || day === 'WED' || tv.includes('NETFLIX')) {
      windows.push({ title: 'Thursday / Special Kickoff Showcase', meta: 'INTERNATIONAL & OPENING SHOWCASES', games: [g] });
    } else if (day === 'MON' || (day === 'SUN' && etHour >= 20) || tv.includes('NBC') || tv.includes('ESPN')) {
      primeGames.push(g);
    } else if (day === 'SUN' && etHour >= 16) {
      lateGames.push(g);
    } else if (day === 'SUN') {
      earlyGames.push(g);
    } else {
      otherGames.push(g);
    }
  });

  if (earlyGames.length) {
    windows.push({ title: 'Sunday Afternoon Slate · 1:00 PM ET', meta: 'REGIONAL CBS & FOX BROADCASTS', games: earlyGames });
  }
  if (lateGames.length) {
    windows.push({ title: 'Sunday Late Window · 4:25 PM ET', meta: 'NATIONAL GAME OF THE WEEK', games: lateGames });
  }
  if (primeGames.length) {
    windows.push({ title: 'Primetime Showdowns', meta: 'SUNDAY NIGHT & MONDAY NIGHT FOOTBALL', games: primeGames });
  }
  if (otherGames.length) {
    windows.push({ title: 'Additional Matchups', meta: 'REGULAR SEASON WINDOW', games: otherGames });
  }

  let html = marqueeHtml;

  // Render broadcast sections
  if (activeFilter === 'all') {
    windows.forEach(w => {
      const windowCards = w.games.map(buildGameCard).join('');
      if (windowCards) {
        html += '<section class="sch-window-sec">' +
          '<div class="sch-window-hd">' +
            '<div class="sch-window-title">' +
              '<h3>' + esc(w.title) + '</h3>' +
              '<span class="sch-tv-badge bg-[#2b3037] text-white">' + w.games.length + ' ' + (w.games.length === 1 ? 'MATCHUP' : 'MATCHUPS') + '</span>' +
            '</div>' +
            '<div class="sch-window-meta">' + esc(w.meta) + '</div>' +
          '</div>' +
          '<div class="sch-game-grid">' + windowCards + '</div>' +
          '</section>';
      }
    });
  } else {
    // Filtered view renders directly in game-grid
    html += '<div class="sch-game-grid mb-6">' + filtered.map(buildGameCard).join('') + '</div>';
  }

  c.innerHTML = html;
  initScheduleMarquee();

}

function openMatchup(gameId){
  const game = (SCHEDULE_DATA && SCHEDULE_DATA.games) ? SCHEDULE_DATA.games.find(candidate => candidate.game_id === gameId) : undefined;
  if (!game) {
    if (gameId) console.error(`[openMatchup] Game not found: ${gameId}`);
    return false;
  }
  MATCHUP_STATE.teamA = game.away_team;
  MATCHUP_STATE.teamB = game.home_team;
  MATCHUP_STATE.gameId = game.game_id;
  // A finished game opens on its box score; any other game on the preview.
  MATCHUP_STATE.subtab = nflGameFinal(game) ? 'box' : (MATCHUP_STATE.subtab === 'box' ? 'preview' : MATCHUP_STATE.subtab);
  document.querySelectorAll('.matchup-subtab-pill').forEach(btn => btn.classList.toggle('active', btn.id === 'subtab-' + MATCHUP_STATE.subtab));
  const selA = document.getElementById('matchupTeamA');
  const selB = document.getElementById('matchupTeamB');
  if (selA) selA.value = game.away_team;
  if (selB) selB.value = game.home_team;
  const selGame = document.getElementById('matchupGame');
  if (selGame && selGame.options.length) {
    const want = `${game.away_team}__${game.home_team}`;
    selGame.value = Array.from(selGame.options).some(o => o.value === want) ? want : '';
  }
  showTab('matchup');
  return true;
}

async function loadPropsBoard(){
  if (PROPS_BOARD) return PROPS_BOARD;
  // Ticket 01: read from the unified shared-data layer first (data/shared/),
  // fall back to the legacy hand-copied path so the deploy never breaks.
  for (const url of ['/data/shared/props-board.json', '/props-board.json']) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok || !isJsonResponse(res)) throw new Error('bad or non-JSON response');
      PROPS_BOARD = await res.json();
      PROPS_BOARD.__source = url;
      return PROPS_BOARD;
    } catch (err) { /* try next path */ }
  }
  PROPS_BOARD = { error: 'props board unavailable', summary: {}, plays: [], best_lines: [], alerts: [] };
  return PROPS_BOARD;
}

// Ticket 01/02: freshness manifest from the unified data layer.
let FRESHNESS = null;
async function loadFreshness(){
  if (FRESHNESS) return FRESHNESS;
  try {
    const res = await fetch('/data/shared/freshness.json', { cache: 'no-store' });
    if (res.ok && isJsonResponse(res)) FRESHNESS = await res.json();
  } catch (err) { /* absent manifest = no stamps, never block rendering */ }
  return FRESHNESS;
}

// Checkpoint 4: the pipeline run signal. daily-pipeline.sh writes
// pipeline-status.json on EVERY run (ok or failed) into data/shared and the
// deploy layer, so a failed automatic update is owner-visible in the app — an
// unread launchd log alone is not a signal. Absent file = no claim; ok =
// nothing to show; failed = a visible banner with the failing step, the run
// time, and how to recover. Nothing is ever invented from model knowledge.
let PIPELINE_STATUS = null;
let PIPELINE_STATUS_LOADED = false;
async function loadPipelineStatus(){
  if (PIPELINE_STATUS_LOADED) return PIPELINE_STATUS;
  PIPELINE_STATUS_LOADED = true;
  try {
    const res = await fetch('/data/shared/pipeline-status.json', { cache: 'no-store' });
    if (res.ok && isJsonResponse(res)) PIPELINE_STATUS = await res.json();
  } catch (err) { /* absent status file = no banner, never block rendering */ }
  renderPipelineStatusBanner();
  return PIPELINE_STATUS;
}

function renderPipelineStatusBanner(){
  const el = document.getElementById('pipelineStatusBanner');
  if (!el) return;
  if (!PIPELINE_STATUS || PIPELINE_STATUS.status !== 'failed') {
    el.className = 'hidden';
    el.innerHTML = '';
    return;
  }
  const failedAt = PIPELINE_STATUS.finished_at || PIPELINE_STATUS.started_at || '';
  const step = PIPELINE_STATUS.failed_step || 'an unknown step';
  const when = failedAt ? ' on ' + homeEsc(String(failedAt).slice(0, 16).replace('T', ' ')) + ' UTC' : '';
  const exitNote = Number.isFinite(Number(PIPELINE_STATUS.exit_code)) ? ` (exit ${PIPELINE_STATUS.exit_code})` : '';
  el.className = 'bg-red-950/70 border-b border-red-500/40 text-red-200 text-[11px] font-mono px-4 py-2';
  el.innerHTML = `<div class="max-w-[1600px] mx-auto flex flex-wrap items-center gap-x-2 gap-y-1">`
    + `<span class="font-bold uppercase tracking-wider text-red-300">⚠ Last automatic data update failed</span>`
    + `<span>at step <b>${attrEsc(step)}</b>${when}${exitNote}.</span>`
    + `<span class="text-red-300/70">The preview below is the last published data.</span>`
    + `<span class="ml-auto">Recovery: <code>npm run props:daily</code> in <code>fantasyfootball/</code> (or <code>launchctl kickstart -k gui/$(id -u)/com.nfldashboard.props-scan</code>).</span>`
    + `</div>`;
}

// Human-readable "data from Xh ago" for a panel, or '' when unknown.
function dataAgeBadge(sourceKey){
  if (!FRESHNESS || !FRESHNESS.sources || !FRESHNESS.sources[sourceKey]) return '';
  const asOf = Date.parse(FRESHNESS.sources[sourceKey].as_of);
  if (!Number.isFinite(asOf)) return '';
  const hours = Math.floor((Date.now() - asOf) / 3600000);
  const label = hours < 1 ? '<1h' : hours < 48 ? hours + 'h' : Math.round(hours / 24) + 'd';
  const stale = hours >= 24;
  const status = FRESHNESS.sources[sourceKey].status;
  const statusLabel = status && status !== 'fresh' ? ` · ${homeEsc(status)}` : '';
  return `<span class="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${stale || status !== 'fresh' ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' : 'text-slate-500 border-slate-700/60 bg-slate-800/40'}" title="data as of ${homeEsc(FRESHNESS.sources[sourceKey].as_of)}">data ${label} ago${statusLabel}</span>`;
}

// Ticket 14: stamp a tab header with its data source age/status. Safe no-op
// when the manifest is absent (freshness.json missing = no stamps, never blocks).
function stampFreshness(id, sourceKey){
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = dataAgeBadge(sourceKey);
}

// Single shared name normalizer (collapses the 9 inline copies that used to
// live in this file). Strips diacritics, punctuation, and generational
// suffixes so roster names and prop-board names can be joined.
function normName(n) {
  return (n || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/['’.\-]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi,"").replace(/\s+/g," ").trim();
}

// Cloudflare Pages serves an SPA-fallback index.html (HTTP 200, text/html)
// for missing paths, so res.ok alone cannot be trusted for data fetches.
// Verify the response is actually JSON before parsing it.
function isJsonResponse(res) {
  const ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
  if (ct.includes('application/json')) return true;
  return false; // HTML fallback or unknown → treat as a miss, try next path
}

const propsMarketLabels = {
  passing_yards: 'Pass Yds', passing_tds: 'Pass TDs', rushing_yards: 'Rush Yds',
  rushing_tds: 'Rush TDs', receiving_yards: 'Rec Yds', receiving_tds: 'Rec TDs',
  receptions: 'Rec', carries: 'Carries', scrimmage_yards: 'Scrim Yds',
  total_tds: 'Total TDs', fantasy_points: 'Fantasy Pts',
};

// Human-readable age for a quote timestamp: null-safe, never invents a time.
// "just now" < 5m, then minutes/hours/days; beyond 7d it stops counting.
function quoteAge(recordedAt, nowMs) {
  if (!recordedAt) return null;
  const then = Date.parse(recordedAt);
  if (!Number.isFinite(then)) return null;
  const reference = Number.isFinite(nowMs) ? nowMs : Date.now();
  const minutes = Math.max(0, Math.round((reference - then) / 60000));
  if (minutes < 5) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return null;
}

function venueAgeBadge(venue, recordedAt, nowMs) {
  const age = quoteAge(recordedAt, nowMs);
  if (!age) return '';
  const stale = /d ago$/.test(age);
  const color = stale ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' : 'text-slate-400 border-slate-600/60 bg-slate-800/60';
  return `<span class="text-[9px] font-bold px-1 py-0.5 rounded border ${color}" title="${venue} quotes last read ${age}">${age}</span>`;
}

// Plain-English value label from raw edge/EV numbers.
// edge_pct = how far the model thinks the line is off (in percentage points).
// ev_pct    = expected value as a percentage (positive = the bet pays back more than it costs).
function valueLabelHtml(edgePct, evPct) {
  if (!edgePct && !evPct) return '<span class="text-slate-500">—</span>';
  const e = Number(edgePct) || 0, ev = Number(evPct) || 0;
  if (ev > 0 && e >= 8) return '<span class="text-emerald-400 font-bold">Generous</span><div class="text-[9px] text-slate-500">+' + ev.toFixed(0) + '% return</div>';
  if (ev > 0 && e >= 3) return '<span class="text-emerald-400">Lean over</span><div class="text-[9px] text-slate-500">+' + ev.toFixed(0) + '% return</div>';
  if (ev > 0) return '<span class="text-slate-300">Slight edge</span><div class="text-[9px] text-slate-500">+' + ev.toFixed(0) + '% return</div>';
  if (e <= 1 && Math.abs(ev) <= 2) return '<span class="text-slate-400">Fair</span>';
  if (ev < 0 && e < 3) return '<span class="text-slate-500">Tight</span>';
  return '<span class="text-slate-500">No edge</span>';
}

// Feature 4: full odds comparison per prop — every venue quoting the same
// player+market+side, side by side, with the best line highlighted and each
// quote's own age. Data source: the plays array (one row per venue quote).
function toggleOddsCompare(key, rowIndex) {
  const row = document.getElementById(`oddsCompareRow-${rowIndex}`);
  const body = document.getElementById(`oddsCompareBody-${rowIndex}`);
  if (!row || !body) return;
  if (!row.classList.contains('hidden')) {
    row.classList.add('hidden');
    return;
  }
  const [playerId, market, side] = key.split('|');
  const quotes = (PROPS_BOARD.plays || []).filter(q =>
    q.player_id === playerId && q.market === market && (q.side === side));
  if (!quotes.length) {
    body.innerHTML = '<span class="text-slate-500">No comparable quotes</span>';
  } else {
    const nowMs = Date.parse(PROPS_BOARD.generated_at) || Date.now();
    // Best line for the chosen side: over → lowest line; under → highest line;
    // ties broken by best (highest) American odds.
    const americanValue = (o) => {
      if (!o) return -Infinity;
      const s = String(o).replace('+', '');
      return Number(s) || -Infinity;
    };
    const sorted = [...quotes].sort((a, b) => {
      const la = Number(a.line), lb = Number(b.line);
      if (side === 'over') {
        if (la !== lb) return la - lb;
      } else {
        if (la !== lb) return lb - la;
      }
      return americanValue(b.odds) - americanValue(a.odds);
    });
    const best = sorted[0];
    body.innerHTML = `
      <div class="font-bold text-slate-300 mb-1">${homeEsc(best.player)} · ${homeEsc(propsMarketLabels[market] || market)} · ${homeEsc(side.toUpperCase())} — all venues</div>
      <table class="w-full text-[11px]">
        <thead><tr class="text-slate-500 border-b border-slate-700/50">
          <th class="py-1 px-2 text-left">Venue</th>
          <th class="py-1 px-2 text-center">Line</th>
          <th class="py-1 px-2 text-center">Odds</th>
          <th class="py-1 px-2 text-center">Edge</th>
          <th class="py-1 px-2 text-center">EV%</th>
          <th class="py-1 px-2 text-center">Quote age</th>
        </tr></thead>
        <tbody>
          ${sorted.map((q, qi) => `
            <tr class="border-b border-slate-800/30 ${qi === 0 ? 'bg-emerald-500/10' : ''}">
              <td class="py-1 px-2 text-slate-300">${homeEsc(q.venue || 'unknown')}${qi === 0 ? ' <span class="text-[9px] font-bold text-emerald-400">BEST</span>' : ''}</td>
              <td class="py-1 px-2 text-center font-bold text-white">${homeEsc(q.line)}</td>
              <td class="py-1 px-2 text-center font-bold ${qi === 0 ? 'text-emerald-400' : 'text-slate-300'}">${homeEsc(q.odds || '—')}</td>
              <td class="py-1 px-2 text-center text-cyan-400">${q.edge_pct != null ? q.edge_pct.toFixed(1)+'pp' : '—'}</td>
              <td class="py-1 px-2 text-center ${q.ev_pct>0?'text-emerald-400':'text-slate-400'}">${q.ev_pct != null ? (q.ev_pct>0?'+':'')+q.ev_pct.toFixed(1)+'%' : '—'}</td>
              <td class="py-1 px-2 text-center">${venueAgeBadge(q.venue, q.recorded_at, nowMs) || '<span class="text-slate-500">—</span>'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    `;
  }
  row.classList.remove('hidden');
}

// ── WIN TOTALS TAB ──────────────────────────────────────────────
// Renders the model's 2026 team win-total projection vs the Kalshi line,
// reconciled live against in-season results (board.win_totals). Each row shows
// the pick, the market expectation, and a live scoring badge (pending / live /
// won / lost) that advances automatically as games land in the DB and the board
// is re-exported.

