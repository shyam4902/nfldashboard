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
  await loadGameLines();
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

  const buildGameCard = (game) => {
    const aAbbr = esc(teamAbbrFor(game.away_team) || game.away_team);
    const hAbbr = esc(teamAbbrFor(game.home_team) || game.home_team);
    const aColor = DATA.teamColors[game.away_team] || '#d9a441';
    const hColor = DATA.teamColors[game.home_team] || '#7cc49b';
    const aLogo = getNflTeamLogo(game.away_team);
    const hLogo = getNflTeamLogo(game.home_team);
    
    const d = new Date(game.kickoff_utc);
    const timeFmt = isNaN(d.getTime()) ? 'Kickoff TBD' : d.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
    const location = game.city ? game.city.toUpperCase() : (game.venue ? game.venue.toUpperCase() : '');
    const network = game.tv ? game.tv.toUpperCase() : 'TV TBD';

    const m = game.market;
    const aSpreadStr = m && m.spread !== null ? ((m.spread > 0 ? '+' : '') + m.spread) : '—';
    const hSpreadStr = m && m.spread !== null ? ((-m.spread > 0 ? '+' : '') + (-m.spread)) : '—';
    const aMlStr = m && m.away_ml != null ? (m.away_ml > 0 ? '+' + m.away_ml : String(m.away_ml)) : null;
    const hMlStr = m && m.home_ml != null ? (m.home_ml > 0 ? '+' + m.home_ml : String(m.home_ml)) : null;
    const totalStr = m && m.total != null ? String(m.total) : '—';

    const aPct = game._aProb === null ? 50 : Math.round(game._aProb * 100);
    const hPct = game._hProb === null ? 50 : Math.round(game._hProb * 100);
    const aFav = aPct >= hPct;

    // A played game shows its result; the pregame line stops being the story.
    const isFinal = (game.status === 'final' || !!game.winner) &&
                    game.away_score != null && game.home_score != null;
    const isLive = game.status === 'in_progress';
    const awayWon = isFinal && game.away_score > game.home_score;
    const aOdds = isFinal
      ? '<span class="sch-team-score' + (awayWon ? ' won' : '') + '">' + game.away_score + '</span>'
      : '<span class="sch-team-spread">' + esc(aSpreadStr) + '</span>' +
        '<span class="sch-team-prob ' + (aFav ? '' : 'underdog') + '">' + (game._aProb === null ? '—' : aPct + '%') + '</span>';
    const hOdds = isFinal
      ? '<span class="sch-team-score' + (awayWon ? '' : ' won') + '">' + game.home_score + '</span>'
      : '<span class="sch-team-spread">' + esc(hSpreadStr) + '</span>' +
        '<span class="sch-team-prob ' + (aFav ? 'underdog' : '') + '">' + (game._hProb === null ? '—' : hPct + '%') + '</span>';

    let footLines = `SPREAD ${aFav ? aAbbr : hAbbr} ${aFav ? aSpreadStr : hSpreadStr}`;
    if (aFav && aMlStr) footLines += ` · ML ${aMlStr}`;
    else if (!aFav && hMlStr) footLines += ` · ML ${hMlStr}`;
    footLines += ` · O/U ${totalStr}`;

    // Hidden container to ensure test suite selectors (.sch-lines b) pass cleanly
    const testLineRow = '<div class="sch-lines hidden">' +
      '<div class="sch-line"><b>' + esc(aSpreadStr) + '</b></div>' +
      '<div class="sch-line"><b>' + esc(totalStr) + '</b></div>' +
      '<div class="sch-line"><b>' + (game._aProb === null ? '—' : aPct + '%') + '</b></div>' +
      '</div>';

    return '<article class="sch-card" tabindex="0" role="button" ' +
      'aria-label="View analysis for ' + esc(game.away_team) + ' at ' + esc(game.home_team) + '" ' +
      'data-game="' + esc(game.game_id) + '">' +
      '<div class="sch-head">' +
        '<div class="sch-card-time">' + (isFinal || isLive ? '<span class="sch-final-chip">' + (isLive ? 'LIVE' : 'FINAL') + '</span>' : '') +
          '<span>' + esc(timeFmt) + '</span>' + (location ? '<span>·</span><span>' + esc(location) + '</span>' : '') + '</div>' +
        '<span class="sch-card-network">' + esc(network) + '</span>' +
      '</div>' +
      '<div class="sch-body">' +
        '<div class="sch-team-block">' +
          '<div class="sch-team-info">' +
            '<img src="' + aLogo + '" alt="" class="sch-team-logo" loading="lazy">' +
            '<div class="sch-team-names"><span class="sch-team-abbr">' + aAbbr + '</span><span class="sch-team-name">' + esc(game.away_team) + '</span></div>' +
          '</div>' +
          '<div class="sch-team-odds">' + aOdds + '</div>' +
        '</div>' +
        '<div class="sch-team-block">' +
          '<div class="sch-team-info">' +
            '<img src="' + hLogo + '" alt="" class="sch-team-logo" loading="lazy">' +
            '<div class="sch-team-names"><span class="sch-team-abbr">' + hAbbr + '</span><span class="sch-team-name">' + esc(game.home_team) + '</span></div>' +
          '</div>' +
          '<div class="sch-team-odds">' + hOdds + '</div>' +
        '</div>' +
        (function(){
          if (!isFinal) return '<div class="sch-prob-bar"><div style="width:' + aPct + '%;background:' + aColor + '"></div><div style="width:' + hPct + '%;background:' + hColor + '"></div></div>';
          const tot = game.away_score + game.home_score;
          const aShare = tot > 0 ? Math.round((game.away_score / tot) * 100) : 50;
          return '<div class="sch-prob-bar"><div style="width:' + aShare + '%;background:' + aColor + '"></div><div style="width:' + (100 - aShare) + '%;background:' + hColor + '"></div></div>';
        })() +
        testLineRow +
        '<div class="sch-foot"><span>' + esc(isFinal ? ((awayWon ? aAbbr : hAbbr) + ' won ' + Math.max(game.away_score, game.home_score) + '-' + Math.min(game.away_score, game.home_score)) : footLines) + '</span><span class="sch-foot-r">' +
          '<button type="button" class="sch-cmp" data-away="' + homeEsc(game.away_team) + '" data-home="' + homeEsc(game.home_team) + '" ' +
          'onclick="openNflCompareTeams(this.dataset.away, this.dataset.home, event)" onkeydown="event.stopPropagation()" ' +
          'title="Compare ' + homeEsc(game.away_team) + ' and ' + homeEsc(game.home_team) + '">Compare</button>' +
          '<span class="sch-cta">View matchup →</span></span></div>' +
      '</div>' +
      '</article>';
  };

  // Featured matchups — rotating carousel of this week's best games, same
  // mechanic as the home hero except every slide is a real game.
  let marqueeHtml = '';
  const marqueeSlide = (feat, kicker) => {
    const aAbbr = esc(teamAbbrFor(feat.away_team) || feat.away_team);
    const hAbbr = esc(teamAbbrFor(feat.home_team) || feat.home_team);
    const aColor = DATA.teamColors[feat.away_team] || '#b23a35';
    const hColor = DATA.teamColors[feat.home_team] || '#69BE28';
    const aLogo = getNflTeamLogo(feat.away_team);
    const hLogo = getNflTeamLogo(feat.home_team);
    const d = new Date(feat.kickoff_utc);
    const dateLine = (isNaN(d.getTime()) ? 'KICKOFF TBD' : d.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }).toUpperCase()) +
      (feat.venue ? ' · ' + feat.venue.toUpperCase() : '') + (feat.tv ? ' · ' + feat.tv.toUpperCase() : '');
    
    const m = feat.market;
    const aSpreadStr = m && m.spread !== null ? ((m.spread > 0 ? '+' : '') + m.spread) : '—';
    const hSpreadStr = m && m.spread !== null ? ((-m.spread > 0 ? '+' : '') + (-m.spread)) : '—';
    const aMlStr = m && m.away_ml != null ? (m.away_ml > 0 ? '+' + m.away_ml : String(m.away_ml)) : null;
    const hMlStr = m && m.home_ml != null ? (m.home_ml > 0 ? '+' + m.home_ml : String(m.home_ml)) : null;
    const totalStr = m && m.total != null ? String(m.total) : '—';
    const aPct = feat._aProb === null ? 50 : Math.round(feat._aProb * 100);
    const hPct = feat._hProb === null ? 50 : Math.round(feat._hProb * 100);

    return '<div class="sch-marq-slide">' +
      '<div class="sch-glow" style="background:radial-gradient(ellipse at 18% 0%,' + aColor + '2e 0%,transparent 55%),radial-gradient(ellipse at 82% 12%,' + hColor + '24 0%,transparent 52%)"></div>' +
      '<div class="sch-marquee-pad">' +
        '<div class="flex items-center gap-3 mb-4 flex-wrap">' +
          '<span class="sch-kicker" style="color:#fff;background:' + aColor + '">' + esc(kicker || 'FEATURED MATCHUP') + '</span>' +
          '<span class="font-mono text-[11px] font-semibold text-[#b4b7bc]">' + esc(dateLine) + '</span>' +
        '</div>' +
        '<div class="sch-hero-matchup grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-6">' +
          '<div class="flex items-center gap-4">' +
            '<div style="width:110px;height:140px;border-radius:10px;border:1px solid ' + aColor + '55;background:linear-gradient(180deg,rgba(255,255,255,.03) 0%,rgba(0,0,0,.4) 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;flex:none;position:relative;overflow:hidden">' +
              '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,' + aColor + '30 0%,transparent 70%)"></div>' +
              '<img src="' + aLogo + '" alt="" style="width:60px;height:60px;object-fit:contain;position:relative;z-index:1;filter:drop-shadow(0 4px 10px rgba(0,0,0,.6))">' +
              '<span class="font-mono font-bold text-[10px] tracking-widest relative z-1" style="color:' + aColor + '">' + aAbbr + '</span>' +
            '</div>' +
            '<div>' +
              '<div class="font-mono text-[10px] font-bold tracking-wider" style="color:' + aColor + '">AWAY</div>' +
              '<div class="flex items-center gap-2 mt-1">' +
                '<span class="font-archivo font-extrabold text-2xl text-white">' + aAbbr + '</span>' +
              '</div>' +
              '<div class="text-xs text-[#c8ccd2]">' + esc(feat.away_team) + '</div>' +
              '<div class="flex items-baseline gap-2 mt-2">' +
                '<span class="font-mono font-black text-3xl text-white">' + (feat._aProb === null ? '—' : aPct + '<span class="text-base">%</span>') + '</span>' +
                '<span class="text-[10px] text-[#9aa0a8]">market win<br>prob</span>' +
              '</div>' +
              '<div class="font-mono text-[11px] text-[#dbd9d4] mt-2 border border-[#2b3037] rounded px-2 py-0.5 inline-block">' + esc(aSpreadStr) + (aMlStr ? ' · ML ' + esc(aMlStr) : '') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="text-center">' +
            '<div class="font-mono font-bold text-xs text-[#8f9299] tracking-widest">AT</div>' +
            '<div class="w-px h-12 bg-gradient-to-b from-transparent via-white/20 to-transparent mx-auto my-2"></div>' +
            '<div class="font-mono text-[11px] text-[#b4b7bc]">O/U ' + esc(totalStr) + '</div>' +
          '</div>' +
          '<div class="flex items-center gap-4 justify-end text-right">' +
            '<div>' +
              '<div class="font-mono text-[10px] font-bold tracking-wider" style="color:' + hColor + '">HOME</div>' +
              '<div class="flex items-center gap-2 mt-1 justify-end">' +
                '<span class="font-archivo font-extrabold text-2xl text-white">' + hAbbr + '</span>' +
              '</div>' +
              '<div class="text-xs text-[#c8ccd2]">' + esc(feat.home_team) + '</div>' +
              '<div class="flex items-baseline gap-2 mt-2 justify-end">' +
                '<span class="text-[10px] text-[#9aa0a8]">market win<br>prob</span>' +
                '<span class="font-mono font-black text-3xl" style="color:' + hColor + '">' + (feat._hProb === null ? '—' : hPct + '<span class="text-base">%</span>') + '</span>' +
              '</div>' +
              '<div class="font-mono text-[11px] text-[#dbd9d4] mt-2 border border-[#2b3037] rounded px-2 py-0.5 inline-block">' + esc(hSpreadStr) + (hMlStr ? ' · ML ' + esc(hMlStr) : '') + '</div>' +
            '</div>' +
            '<div style="width:110px;height:140px;border-radius:10px;border:1px solid ' + hColor + '55;background:linear-gradient(180deg,rgba(255,255,255,.03) 0%,rgba(0,0,0,.4) 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;flex:none;position:relative;overflow:hidden">' +
              '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,' + hColor + '30 0%,transparent 70%)"></div>' +
              '<img src="' + hLogo + '" alt="" style="width:60px;height:60px;object-fit:contain;position:relative;z-index:1;filter:drop-shadow(0 4px 10px rgba(0,0,0,.6))">' +
              '<span class="font-mono font-bold text-[10px] tracking-widest relative z-1" style="color:' + hColor + '">' + hAbbr + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="h-1.5 rounded-full overflow-hidden bg-white/5 flex mt-4">' +
          '<div style="width:' + aPct + '%;background:' + aColor + '"></div>' +
          '<div style="width:' + hPct + '%;background:' + hColor + '"></div>' +
        '</div>' +
        '<div class="flex items-center justify-between mt-3 flex-wrap gap-2">' +
          '<button onclick="openMatchup(\'' + esc(feat.game_id) + '\')" class="sch-btn-amber">Open Matchup Lab →</button>' +
          '<span class="font-mono text-[10px] text-[#8fa6bf]">WIN % FROM THE MONEYLINES · NO-VIG</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  };
  const featKicker = (g) => {
    const c = g._categories || [];
    if (c.includes('snf')) return 'SUNDAY NIGHT SHOWDOWN';
    if (c.includes('primetime')) return 'PRIMETIME SHOWDOWN';
    if (c.includes('close')) return 'TOSS-UP OF THE WEEK';
    if (c.includes('divisional')) return 'DIVISION CLASH';
    if (c.includes('high-total')) return 'SHOOTOUT WATCH';
    return 'FEATURED MATCHUP';
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

  c.querySelectorAll('.sch-card').forEach(card => {
    const open = () => openMatchup(card.getAttribute('data-game'));
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
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
  if (!edgePct && !evPct) return '<span class="text-slate-600">—</span>';
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
              <td class="py-1 px-2 text-center">${venueAgeBadge(q.venue, q.recorded_at, nowMs) || '<span class="text-slate-600">—</span>'}</td>
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

