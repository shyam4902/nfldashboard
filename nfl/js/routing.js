// ═══════════════════════════════════════════════════════════
// INTERACTIONS
// ═══════════════════════════════════════════════════════════
function showTab(tab){
  document.querySelectorAll('[id^="tab-"]').forEach(el=>{
    if(el.id==='tab-'+tab){el.classList.remove('hidden');el.style.animation='fadeIn 0.25s ease';}
    else{el.classList.add('hidden');el.style.animation='';}
  });
  document.querySelectorAll('.tab-btn').forEach(btn=>{btn.classList.remove('active');});
  const navTab = { matchup: 'schedule', compare: 'teams', team: 'teams', player: 'league' }[tab] || tab;
  const activeTab = document.querySelector(`[data-tab="${navTab}"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }
  if (tab === 'home') {
    renderHome();
  }
  if (tab === 'teams') {
    stampFreshness('teamsFreshness', 'rosters');
  }
  if (tab === 'league') {
    showLeague(currentLeagueSubTab);
  }
  if (tab === 'schedule') {
    loadSchedule().then(renderSchedule);
    stampFreshness('scheduleFreshness', 'schedule');
  }
  if (tab === 'matchup') {
    renderMatchup();
    stampFreshness('matchupFreshness', 'team_efficiency');
  }
  writeHash(tab);
}

// ═══════════════════════════════════════════════════════════
// URL HASH ROUTING - shareable tabs, working back button
// ═══════════════════════════════════════════════════════════
const ROUTABLE_TABS = ['home', 'schedule', 'teams', 'team', 'league', 'matchup', 'compare', 'player'];
let suppressHashRoute = false;

// Mirror the current tab into the address bar. Matchup carries its game id
// so a preview can be linked directly.
function writeHash(tab) {
  const target = (tab === 'matchup' && MATCHUP_STATE.gameId)
    ? `#matchup/${MATCHUP_STATE.gameId}`
    : (typeof nflViewHash === 'function' && nflViewHash(tab)) || `#${tab}`;
  if (location.hash === target) return;
  suppressHashRoute = true;              // our own write, not a back/forward
  location.hash = target;
  setTimeout(() => { suppressHashRoute = false; }, 0);
}

// Read the address bar and show whatever it points at.
async function applyHash() {
  const [tab, arg, arg2] = (location.hash || '').replace(/^#/, '').split('/');
  if (tab === 'compare') return showNflCompare(arg, arg2);
  if (tab === 'player') return showNflPlayer(arg);
  if (tab === 'team') return showNflTeam(arg, arg2);
  if (tab === 'matchup' && arg) {
    await loadSchedule();                // deep link needs the game list first
    if (openMatchup(arg)) return;        // openMatchup calls showTab itself
  }
  showTab(ROUTABLE_TABS.includes(tab) ? tab : 'home');
}

window.addEventListener('hashchange', () => {
  if (!suppressHashRoute) applyHash();
});

function filterDashboard(q){
  q = (q || '').toLowerCase().trim();
  // Filter the Teams grid rows (nfl/js/roster.js); a division card with no
  // matching team hides, and so does a conference with no visible card.
  let teamVisible = 0;
  document.querySelectorAll('#teamsContainer .tg-row').forEach(el => {
    const txt = (el.getAttribute('data-team-search') || el.textContent).toLowerCase();
    const show = !q || txt.includes(q);
    el.hidden = !show;
    if (show) teamVisible++;
  });
  document.querySelectorAll('#teamsContainer .tg-div').forEach(card => {
    card.hidden = !card.querySelector('.tg-row:not([hidden])');
  });
  document.querySelectorAll('#teamsContainer .tg-conf').forEach(conf => {
    conf.hidden = !conf.querySelector('.tg-div:not([hidden])');
  });

  const old = document.getElementById('teamsEmpty');
  if (old) old.remove();
  if (q && teamVisible === 0) {
    const el = document.createElement('div');
    el.id = 'teamsEmpty';
    el.className = 'nv-state';
    el.textContent = 'No teams match "' + q + '"';
    document.getElementById('teamsContainer').appendChild(el);
  }
}

// ESC to close modal
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeRoster();});

// Back to top button visibility
window.addEventListener('scroll',()=>{
  const btn=document.getElementById('backToTop');
  if(window.scrollY>400){btn.style.opacity='1';btn.style.transform='translateY(0)';btn.style.pointerEvents='auto';}
  else{btn.style.opacity='0';btn.style.transform='translateY(1rem)';btn.style.pointerEvents='none';}
});

// PROPS BOARD LOADER & RENDERING
// ═══════════════════════════════════════════════════════════
let PROPS_BOARD = null;

// ═══════════════════════════════════════════════════════════
// TEAM EFFICIENCY (real nflverse 2012-2026 EPA/efficiency rates)
// Source: research/nfl-stickiness/team_season_efficiency.json (nflfastR
// play-by-play). One row per (season, team, side). Used by the Matchup
// Center to show real measured season-to-date efficiency ranks instead of
// fabricated "Next Gen Stats" splits. This is verified measured data,
// not a model estimate.
// ═══════════════════════════════════════════════════════════
let EFFICIENCY_DATA = null;

async function loadEfficiency(){
  if (EFFICIENCY_DATA) return EFFICIENCY_DATA;
  for (const url of ['/data/shared/team_season_efficiency.json', '/team_season_efficiency.json']) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok && isJsonResponse(res)) {
        EFFICIENCY_DATA = await res.json();
        return EFFICIENCY_DATA;
      }
    } catch (e) { /* try next path */ }
  }
  EFFICIENCY_DATA = [];
  return EFFICIENCY_DATA;
}

// Real 1-32 rank for (team, side, metric) in the given season (default
// most recent season present). Returns null when the team has
// no row for that season/side, or when the metric is absent.
// Direction: for defense, lower epa_per_play is better; the caller
// passes a comparator so ranks always mean "1 = best in the league".
// Normalize a team name ("Houston Texans", "HOU") to the abbreviation used
// in the efficiency dataset ("HOU"). Falls back to the raw name so a team
// we cannot map still looks up honestly (and misses are null, never 16).
function effTeamAbbr(team){
  if (!team) return team;
  if (typeof teamAbbrFor === 'function') {
    const a = teamAbbrFor(team);
    if (a) return a;
  }
  if (typeof canonicalAbbr === 'function') {
    const c = canonicalAbbr(team);
    if (c) return c;
  }
  return team;
}

function isMetricHigherBetter(side, metric) {
  if (side === 'def') {
    return metric === 'sack_rate' || metric === 'turnover_rate';
  }
  return metric !== 'sack_rate' && metric !== 'turnover_rate';
}

function efficiencyRank(team, side, metric, season){
  if (!EFFICIENCY_DATA || !EFFICIENCY_DATA.length) return null;
  const t = effTeamAbbr(team);
  const targetSeason = season || measuredEpaSeason();
  const rows = EFFICIENCY_DATA.filter(r => r.season === targetSeason && r.side === side);
  if (!rows.length) return null;
  const has = rows.some(r => r[metric] != null && Number.isFinite(Number(r[metric])));
  if (!has) return null;
  const higherBetter = isMetricHigherBetter(side, metric);
  const sorted = rows.filter(r => r[metric] != null && Number.isFinite(Number(r[metric])))
    .sort((a, b) => higherBetter ? Number(b[metric]) - Number(a[metric]) : Number(a[metric]) - Number(b[metric]));
  const idx = sorted.findIndex(r => r.team === t);
  if (idx < 0) return null;
  return idx + 1;
}

function efficiencyValue(team, side, metric, season){
  if (!EFFICIENCY_DATA) return null;
  const t = effTeamAbbr(team);
  const targetSeason = season || measuredEpaSeason();
  const row = EFFICIENCY_DATA.find(r => r.season === targetSeason && r.side === side && r.team === t);
  if (!row || row[metric] == null) return null;
  const v = Number(row[metric]);
  return Number.isFinite(v) ? v : null;
}

