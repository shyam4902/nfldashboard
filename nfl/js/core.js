// ═══════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════
const SUPABASE_URL = "https://nedyoydylpbjvihaoexy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_cQOHCiQh2kZQQUn5sEEfIA_t9NScNZz";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Loaded asynchronously from Supabase. Render functions read from DATA.* fields.
let DATA = { teams: [], players: [], transactions: [] };
var TEAM_TENDENCIES_LOADED = false;
var MATCHUP_STATE = { teamA: 'New England Patriots', teamB: 'Seattle Seahawks', subtab: 'preview', personnel: '12', front: '43', gameId: null, viewedOffense: 'A' };

async function fetchAllPlayers() {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const { data, error } = await sb.from('nfl_players').select('*').range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function fetchAllTransactions() {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const { data, error } = await sb.from('nfl_transactions').select('*').order('sort_date', { ascending: false }).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/* ESPN-ingested transactions and Supabase rosters are authoritative. */

async function loadAllData() {
  const [teams, players, transactions] = await Promise.all([
    sb.from('nfl_teams').select('*'),
    fetchAllPlayers(),
    fetchAllTransactions()
  ]);
  if (teams.error) throw new Error(teams.error.message);
  DATA.teams = teams.data;
  DATA.players = players;
  DATA.transactions = transactions || [];
  try {
    const capRes = await fetch('/draft-capital.json');
    DATA.draftCapital = capRes.ok ? await capRes.json() : null;
  } catch { DATA.draftCapital = null; }

  // High-contrast primary display colors for UI badges & borders across all themes
  const TEAM_COLOR_OVERRIDES = {
    'New England Patriots': '#C60C30',   // Patriots Red (was dark navy #002244)
    'Seattle Seahawks': '#69BE28',       // Action Green (was dark navy #002244)
    'Houston Texans': '#A71930',         // Battle Red (was dark steel blue #03202F)
    'Cleveland Browns': '#FF3C00',       // Browns Orange (was dark brown #311D00)
    'Dallas Cowboys': '#003594',         // Cowboys Royal Blue (was dark navy #041E42)
    'Baltimore Ravens': '#6B3FA0',       // Ravens Vivid Purple (was dark purple #241773)
    'Green Bay Packers': '#187A44',      // Packers Green (was dark green #203731)
    'Indianapolis Colts': '#00529B',     // Colts Speed Blue (was dark blue #002C5F)
    'New York Giants': '#0053A0',        // Giants Royal Blue (was dark navy #0B2265)
    'New York Jets': '#007A53',          // Jets Green (was dark green #125740)
    'Philadelphia Eagles': '#007A65',    // Eagles Kelly/Midnight Green (was #004C54)
    'Washington Commanders': '#8C182A',  // Commanders Burgundy (was #5A1414)
  };
  for (const t of DATA.teams) {
    if (TEAM_COLOR_OVERRIDES[t.name]) {
      t.primary_color = TEAM_COLOR_OVERRIDES[t.name];
    }
  }

  // Build legacy-shaped lookups so render functions need minimal changes
  DATA.teamColors = Object.fromEntries(DATA.teams.map(t => [t.name, t.primary_color]));
  DATA.teamAbbr = Object.fromEntries(DATA.teams.map(t => [t.name, t.abbr]));
  DATA.capData = Object.fromEntries(DATA.teams.map(t => [t.name,
    { space: Number(t.cap_space), dead: Number(t.dead_money), status: t.status }
  ]));
  const divOrder = ['AFC East','AFC North','AFC South','AFC West','NFC East','NFC North','NFC South','NFC West'];
  const divMap = {};
  for (const t of DATA.teams) {
    if (!divMap[t.division]) divMap[t.division] = [];
    divMap[t.division].push(t.name);
  }
  DATA.divisions = Object.fromEntries(divOrder.filter(d => divMap[d]).map(d => [d, divMap[d]]));

  const teamById = Object.fromEntries(DATA.teams.map(t => [t.id, t.name]));
  DATA.teamById = teamById;

  DATA.fullRosters = {};
  for (const p of DATA.players) {
    const teamName = teamById[p.team_id];
    if (!teamName) continue;
    if (!DATA.fullRosters[teamName]) DATA.fullRosters[teamName] = { offense: [], defense: [], special: [] };
    const unitKey = (p.unit || 'offense').toLowerCase();
    if (!DATA.fullRosters[teamName][unitKey]) DATA.fullRosters[teamName][unitKey] = [];
    DATA.fullRosters[teamName][unitKey].push({
      num: p.jersey,
      name: p.name,
      pos: p.pos,
      age: p.age,
      ovr: p.ovr,
      isRookie: p.is_rookie === true || p.is_rookie === 'Yes',
      acquisitionType: p.acquisition_type,
      isNew: (p.is_rookie === true || p.is_rookie === 'Yes') || p.acquisition_type === 'fa' || p.acquisition_type === 'trade'
    });
  }
}

function exportRostersCSV() {
  if (!DATA || !DATA.players || DATA.players.length === 0) {
    alert("Roster data is still loading, please try again in a moment.");
    return;
  }
  const teamById = Object.fromEntries(DATA.teams.map(t => [t.id, t]));
  const csvHeaders = ['Team Name', 'Abbr', 'Division', 'Player Name', 'Position', 'Unit', 'Overall Rating (OVR)', 'Age', 'Jersey #', 'Is Rookie', 'Acquisition Type'];
  const rows = [csvHeaders.join(',')];

  const processed = DATA.players.map(p => {
    const team = teamById[p.team_id] || { name: 'Free Agent', abbr: 'FA', division: 'N/A' };
    return {
      team_name: team.name,
      team_abbr: team.abbr,
      division: team.division || 'N/A',
      name: p.name,
      pos: p.pos || '',
      unit: (p.unit || 'offense').toUpperCase(),
      ovr: p.ovr !== null && p.ovr !== undefined ? p.ovr : '',
      age: p.age !== null && p.age !== undefined ? p.age : '',
      jersey: p.jersey !== null && p.jersey !== undefined ? p.jersey : '',
      is_rookie: p.is_rookie ? 'Yes' : 'No',
      acquisition_type: p.acquisition_type || 'veteran'
    };
  });

  const unitOrder = { 'OFFENSE': 1, 'DEFENSE': 2, 'SPECIAL': 3 };
  processed.sort((a, b) => {
    if (a.team_name !== b.team_name) return a.team_name.localeCompare(b.team_name);
    const uA = unitOrder[a.unit] || 4;
    const uB = unitOrder[b.unit] || 4;
    if (uA !== uB) return uA - uB;
    return (Number(b.ovr) || 0) - (Number(a.ovr) || 0);
  });

  for (const p of processed) {
    const row = [
      `"${p.team_name.replace(/"/g, '""')}"`,
      `"${p.team_abbr}"`,
      `"${p.division}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.pos}"`,
      `"${p.unit}"`,
      p.ovr,
      p.age,
      p.jersey,
      p.is_rookie,
      `"${p.acquisition_type}"`
    ];
    rows.push(row.join(','));
  }

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'nfl_rosters_2026.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// HOME TAB — first-run showcase of everything the app does
function homeEsc(s){
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function quickTeamPillsHtml(){
  if (!DATA || !DATA.teams) return '';
  return DATA.teams.map(t => {
    const color = t.primary_color || '#3b82f6';
    const nameEsc = t.name.replace(/'/g, "\\'");
    return `<span class="team-quick-chip shrink-0" onclick="openRoster('${nameEsc}')" title="View ${t.name} depth chart">
      <span class="w-2 h-2 rounded-full shrink-0" style="background:${color}"></span>
      <span>${homeEsc(t.abbr)}</span>
    </span>`;
  }).join('');
}

function todayInNflHtml(){
  const now = new Date();
  const games = (SCHEDULE_DATA && SCHEDULE_DATA.games) ? SCHEDULE_DATA.games : [];
  const upcoming = games
    .filter(g => { const d = new Date(g.kickoff_utc); return !isNaN(d.getTime()) && d >= now; })
    .sort((a, b) => String(a.kickoff_utc || '').localeCompare(String(b.kickoff_utc || '')))
    .slice(0, 4);
  if (!upcoming.length && !games.length) return '';

  // One-line prop insight: the top trust-scored play from the board.
  let insightHtml = '';
  if (PROPS_BOARD && PROPS_BOARD.plays && PROPS_BOARD.plays.length) {
    const evidenceByMarket = new Map();
    (PROPS_BOARD.market_evidence || []).forEach(e => evidenceByMarket.set(e.market_id, e));
    const candidates = [];
    for (const p of PROPS_BOARD.plays) {
      if (!p.ev_pct || p.ev_pct <= 0) continue;
      if (!p.edge_pct || p.edge_pct < 2) continue;
      if (p.edge_pct > 25 || p.ev_pct > 150) continue;
      const market = p.market_id || p.market;
      const evidence = evidenceByMarket.get(market);
      const trust = discriminationTrust(evidence);
      if (trust <= 0) continue;
      const score = 60 * Math.min(1, p.edge_pct / 12) + 40 * trust;
      candidates.push({ play: p, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length) {
      const p = candidates[0].play;
      const marketLabel = propsMarketLabels[p.market] || p.market;
      const valueWord = p.edge_pct >= 8 ? 'generous' : p.edge_pct >= 3 ? 'a lean' : 'a slight edge';
      insightHtml = `<a href="https://edgeplay-analytics.pages.dev/props" target="_blank" rel="noopener" class="text-left w-full mt-3 pt-3 border-t border-slate-700 hover:text-amber-400 transition group block">
        <div class="flex items-center gap-2 text-[11px] text-slate-300">
          <span class="text-amber-400">\u{1F448}</span>
          <span class="font-bold text-white">${homeEsc(p.player)}</span>
          <span class="text-slate-400">${homeEsc(marketLabel)}</span>
          <span class="font-bold ${p.side === 'over' ? 'text-emerald-400' : 'text-cyan-400'}">${homeEsc(p.side)} ${homeEsc(p.line)}</span>
          <span class="text-slate-400">at ${homeEsc(p.venue)}</span>
          <span class="text-slate-500 group-hover:text-slate-300 transition">line looks ${valueWord}</span>
          <span class="studio-link shrink-0">view board \u2192</span>
        </div>
      </a>`;
    }
  }

  // If no upcoming games (all in the past or no schedule), show a season teaser.
  if (!upcoming.length) {
    return `<div class="studio-card">
      <div class="studio-card-hd">
        <div class="studio-title"><span>\u{1F4C5}</span> Today in the NFL</div>
        <button onclick="showTab('schedule')" class="studio-link">full schedule \u2192</button>
      </div>
      <p class="text-xs text-slate-400">No games scheduled today. The 2026 season kicks off ${games.length ? 'Sep 9' : 'soon'}.</p>
      ${insightHtml}
    </div>`;
  }

  const gameCards = upcoming.map(g => {
    const d = new Date(g.kickoff_utc);
    const days = Math.round((d - now) / 86400000);
    const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const colorA = DATA.teamColors[g.away_team] || '#3b4261';
    const colorH = DATA.teamColors[g.home_team] || '#3b4261';
    const aAbbr = teamAbbrFor(g.away_team) || g.away_team.slice(0, 3).toUpperCase();
    const hAbbr = teamAbbrFor(g.home_team) || g.home_team.slice(0, 3).toUpperCase();
    return `<div class="studio-tile" onclick="openMatchup('${homeEsc(g.game_id)}')" title="${homeEsc(g.away_team)} at ${homeEsc(g.home_team)} - click for matchup analysis">
      <div class="mb-1.5 flex items-center justify-between gap-2">
        <span class="studio-kicker" style="color:#c9ccd1">${when} ${time}</span>
        <span class="studio-kicker">${homeEsc(g.tv || '')}</span>
      </div>
      <div class="flex items-center gap-2 py-0.5">
        <span class="text-[10px] font-black w-7 h-5 rounded flex items-center justify-center shrink-0" style="background:${colorA}33;color:${colorA};border:1px solid ${colorA}">${homeEsc(aAbbr)}</span>
        <span class="text-xs font-bold text-white truncate">${homeEsc(g.away_team)}</span>
      </div>
      <div class="flex items-center gap-2 py-0.5">
        <span class="text-[10px] font-black w-7 h-5 rounded flex items-center justify-center shrink-0" style="background:${colorH}33;color:${colorH};border:1px solid ${colorH}">${homeEsc(hAbbr)}</span>
        <span class="text-xs font-bold text-white truncate">${homeEsc(g.home_team)}</span>
      </div>
      <div class="flex items-center justify-between gap-2 mt-1 min-w-0">
        <span class="text-[10px] text-slate-500 truncate">${homeEsc(g.venue || '')}</span>
        <button type="button" class="sch-cmp shrink-0" data-away="${homeEsc(g.away_team)}" data-home="${homeEsc(g.home_team)}" onclick="openNflCompareTeams(this.dataset.away, this.dataset.home, event)" title="Compare ${homeEsc(g.away_team)} and ${homeEsc(g.home_team)}">Compare</button>
      </div>
    </div>`;
  }).join('');

  return `<div class="studio-card relative overflow-hidden">
    <div class="absolute inset-0 home-hero-glow pointer-events-none opacity-50"></div>
    <div class="relative">
      <div class="studio-card-hd">
        <div class="studio-title">
          <span>\u{1F4C5}</span> Today in the NFL
          <span class="studio-title-note">${upcoming.length} upcoming games</span>
        </div>
        <button onclick="showTab('schedule')" class="studio-link">full schedule \u2192</button>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">${gameCards}</div>
      ${insightHtml}
    </div>
  </div>`;
}

function homeHeroHtml(){
  return `
  <div class="glass rounded-2xl p-6 md:p-8 relative overflow-hidden border border-slate-700/60 shadow-2xl mb-6">
    <div class="absolute inset-0 home-hero-glow pointer-events-none"></div>
    <div class="relative">
      <div class="flex items-center gap-2 flex-wrap mb-2.5">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-blue-500/15 text-blue-400 border border-blue-500/30">
          2026 NFL Season
        </span>
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> LIVE INTELLIGENCE
        </span>
        <span class="text-[11px] text-slate-400 font-medium">Composite Power · Live Odds</span>
      </div>
      <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white flex items-center gap-3">
        <span>League Command Center</span>
      </h1>
      <p class="text-sm text-slate-300 mt-2.5 max-w-4xl leading-relaxed">
        The complete NFL season command center. Explore the current weekly slate with live odds and market win probabilities, standings, depth charts and rosters. For deep value and prop analysis, open Edge Analytics.
      </p>
      <div class="flex items-center gap-3 mt-4 pt-3.5 border-t border-slate-700/40">
        <span class="text-[10px] uppercase font-black text-slate-400 tracking-wider shrink-0 px-2 py-1 rounded bg-slate-800/80 border border-slate-700/70">Teams</span>
        <div class="team-marquee-mask flex-1 overflow-hidden relative">
          <div class="team-marquee-track">
            ${quickTeamPillsHtml()}
            ${quickTeamPillsHtml()}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

const HOME_FEATURES = [
  { icon:'📅', title:'Schedule', tab:'schedule', accent:'#3b82f6', stat:() => `Week ${currentScheduleWeek}`, desc:'Every matchup in the selected week with live spreads, totals, moneylines and market win probabilities. Click any game for deep matchup analytics.' },
  { icon:'⚔️', title:'Matchup Lab', tab:'matchup', accent:'#f43f5e', stat:'offense vs defense', desc:"X's and O's formation preview for any matchup. Pick personnel and defensive front, scan efficiency advantages, click a player for their full profile." },
  { icon:'💰', title:'Value Reads', tab:null, extUrl:'https://edgeplay-analytics.pages.dev/props', accent:'#10b981', stat:'Edge Analytics', desc:'Player props, win totals, line movement and model diagnostics live in the Edge Analytics app. Deep value analysis opens in a new tab.' },
  { icon:'🛡️', title:'Teams & Rosters', tab:'teams', accent:'#f59e0b', stat:() => DATA.teams.length + ' teams', desc:'Depth charts, rosters and division navigation for every team, plus head-to-head player comparison.' },
];

const HOME_TOOLS = [
  { icon:'⚖️', title:'Player Compare', action:'openPlayerCompareModal()', badge:'PRO RADAR', desc:'Side-by-side stats, dual SVG radar charts and head-to-head deltas for any two players.' },
  { icon:'🔍', title:'Command Palette', action:'openCommandPalette()', badge:'⌘K SHORTCUT', desc:'Universal search across all players, teams, tabs and betting markets in real-time.' },
  { icon:'🎨', title:'Visual Themes', action:"document.getElementById('themeSelector').focus(); window.scrollTo({top:0,behavior:'smooth'})", badge:'5 THEMES', desc:'Switch between Stadium Lights, ESPN Broadcast, Retro Scoreboard, Clean Analyst and Dark.' },
  { icon:'📤', title:'CSV Export', action:'exportRostersCSV()', badge:'EXPORT DATA', desc:'Download clean roster, depth chart and ratings datasets for Excel and Google Sheets.' },
];

function homeShowcaseHtml(){
  const feats = HOME_FEATURES.map(f => {
    const statVal = typeof f.stat === 'function' ? f.stat() : f.stat;
    const isExt = !f.tab && f.extUrl;
    const openAttr = isExt ? `onclick="window.open('${f.extUrl}','_blank')"` : `onclick="showTab('${f.tab}')"`;
    return `
    <div class="feature-card glass rounded-xl p-5 cursor-pointer border border-slate-700/60 hover:border-slate-500 transition relative overflow-hidden group flex flex-col justify-between" style="border-top:3px solid ${f.accent}" ${openAttr} title="Open ${f.title}">
      <div>
        <div class="flex items-start justify-between gap-2 mb-2.5">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style="background:${f.accent}20;border:1px solid ${f.accent}40;color:${f.accent}">${f.icon}</div>
          <span class="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full" style="background:${f.accent}15;color:${f.accent};border:1px solid ${f.accent}35">${statVal}</span>
        </div>
        <div class="text-sm font-extrabold text-white group-hover:text-blue-300 transition flex items-center justify-between">
          <span>${f.title}</span>
          <span class="text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition text-xs font-bold">→</span>
        </div>
        <div class="text-[11px] text-slate-400 mt-1.5 leading-relaxed">${f.desc}</div>
      </div>
      <div class="mt-3.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
        <span class="text-slate-500 font-medium">${isExt ? 'Opens Edge Analytics' : 'Click to navigate'}</span>
        ${f.extLink ? `<a href="${f.extLink}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="text-fuchsia-400 font-semibold hover:underline shrink-0">${f.extLabel} \u2192</a>` : ''}
        ${!isExt ? `<span class="text-blue-400 font-semibold group-hover:underline ${f.extLink ? 'hidden' : ''}">Open tab \u2192</span>` : `<span class="text-emerald-400 font-semibold group-hover:underline">Open app \u2192</span>`}
      </div>
    </div>`;
  }).join('');

  const tools = HOME_TOOLS.map(t => `
    <div class="feature-card glass rounded-xl p-3.5 cursor-pointer border border-slate-700/50 hover:border-slate-500 transition group flex flex-col justify-between" onclick="${t.action}" title="${t.title}">
      <div>
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <div class="flex items-center gap-2">
            <span class="text-base">${t.icon}</span>
            <span class="text-xs font-extrabold text-white group-hover:text-blue-300 transition">${t.title}</span>
          </div>
          <span class="text-[8px] font-black text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono">${t.badge}</span>
        </div>
        <div class="text-[10px] text-slate-400 leading-relaxed">${t.desc}</div>
      </div>
    </div>`).join('');

  return `
    <div class="flex items-center justify-between mb-3">
      <div class="text-xs font-extrabold text-slate-200 flex items-center gap-2">
        <svg class="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/></svg>
        <span>What's Inside</span>
        <span class="text-slate-500 font-normal text-[11px]">— core modules and analytics engines</span>
      </div>
      <span class="text-[10px] text-slate-500 hidden sm:inline font-medium">9 Core Tools & Features</span>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 mb-4">${feats}</div>
    <div class="text-xs font-extrabold text-slate-300 mb-2.5 flex items-center gap-2">
      <span>🛠</span> Analyst Toolkit & Quick Actions
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">${tools}</div>`;
}

function marqueeGameHtml(g){
  g.market = gameMarketLines(g);
  const prob = marketWinProb(g.market);
  const aProb = prob === null ? null : 1 - prob;
  const hProb = prob;
  const aPct = aProb === null ? 50 : Math.round(aProb * 100);
  const hPct = hProb === null ? 50 : Math.round(hProb * 100);
  const aFav = aPct >= hPct;
  const aAbbr = homeEsc(teamAbbrFor(g.away_team) || g.away_team);
  const hAbbr = homeEsc(teamAbbrFor(g.home_team) || g.home_team);
  const aColor = DATA.teamColors[g.away_team] || '#d9a441';
  const hColor = DATA.teamColors[g.home_team] || '#7cc49b';
  const aLogo = getNflTeamLogo(g.away_team);
  const hLogo = getNflTeamLogo(g.home_team);

  const d = new Date(g.kickoff_utc);
  const timeFmt = isNaN(d.getTime()) ? 'Kickoff TBD' : d.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  const network = g.tv ? (g.tv.includes(',') ? g.tv.split(',')[0].trim().toUpperCase() : g.tv.toUpperCase()) : 'TV';

  const m = g.market;
  const aSpreadStr = m && m.spread !== null ? ((m.spread > 0 ? '+' : '') + m.spread) : '—';
  const hSpreadStr = m && m.spread !== null ? ((-m.spread > 0 ? '+' : '') + (-m.spread)) : '—';
  const totalStr = m && m.total != null ? String(m.total) : '—';

  let footLines = `${aFav ? aAbbr : hAbbr} ${aFav ? aSpreadStr : hSpreadStr}`;
  if (totalStr !== '—') footLines += ` · O/U ${totalStr}`;

  return `<article class="home-sch-card" tabindex="0" role="button" aria-label="View analysis for ${homeEsc(g.away_team)} at ${homeEsc(g.home_team)}" data-game="${homeEsc(g.game_id)}" onclick="openMatchup('${homeEsc(g.game_id)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openMatchup('${homeEsc(g.game_id)}');}">
    <div class="sch-head">
      <div class="sch-card-time truncate"><span>${homeEsc(timeFmt)}</span></div>
      <span class="sch-card-network shrink-0">${homeEsc(network)}</span>
    </div>
    <div class="sch-body">
      <div class="sch-team-block">
        <div class="sch-team-info">
          <img src="${aLogo}" alt="" class="sch-team-logo" loading="lazy">
          <div class="sch-team-names"><span class="sch-team-abbr">${aAbbr}</span><span class="sch-team-name">${homeEsc(g.away_team)}</span></div>
        </div>
        <div class="sch-team-odds">
          <span class="sch-team-spread">${homeEsc(aSpreadStr)}</span>
          <span class="sch-team-prob ${aFav ? '' : 'underdog'}">${prob === null ? '—' : aPct + '%'}</span>
        </div>
      </div>
      <div class="sch-team-block">
        <div class="sch-team-info">
          <img src="${hLogo}" alt="" class="sch-team-logo" loading="lazy">
          <div class="sch-team-names"><span class="sch-team-abbr">${hAbbr}</span><span class="sch-team-name">${homeEsc(g.home_team)}</span></div>
        </div>
        <div class="sch-team-odds">
          <span class="sch-team-spread">${homeEsc(hSpreadStr)}</span>
          <span class="sch-team-prob ${aFav ? 'underdog' : ''}">${prob === null ? '—' : hPct + '%'}</span>
        </div>
      </div>
      <div class="sch-prob-bar">
        <div style="width:${aPct}%;background:${aColor}"></div>
        <div style="width:${hPct}%;background:${hColor}"></div>
      </div>
      <div class="sch-foot">
        <span>${homeEsc(footLines)}</span>
        <span class="sch-foot-r">
          <button type="button" class="sch-cmp" data-away="${homeEsc(g.away_team)}" data-home="${homeEsc(g.home_team)}" onclick="openNflCompareTeams(this.dataset.away, this.dataset.home, event)" onkeydown="event.stopPropagation()" title="Compare ${homeEsc(g.away_team)} and ${homeEsc(g.home_team)}">Compare</button>
          <span class="sch-cta">View matchup →</span>
        </span>
      </div>
    </div>
  </article>`;
}

function marqueeHtml(){
  if (!SCHEDULE_DATA || !SCHEDULE_DATA.games || !SCHEDULE_DATA.games.length) return null;
  const marqueeWeek = SCHEDULE_DATA.week || 1;
  const sorted = SCHEDULE_DATA.games
    .filter(g => (g.week || 1) === marqueeWeek)
    .sort((a, b) => String(a.kickoff_utc || '').localeCompare(String(b.kickoff_utc || '')));
  const pick = (g) => {
    const d = new Date(g.kickoff_utc);
    return isNaN(d.getTime()) ? '' : d.toLocaleString([], { weekday:'short' });
  };
  let picks = sorted.filter(g => ['Wed', 'Thu', 'Mon'].includes(pick(g)));
  if (picks.length < 3) picks = sorted.slice(0, 3);
  picks = picks.slice(0, 3);
  return `<div class="studio-card h-full flex flex-col justify-between">
    <div>
      <div class="studio-card-hd">
        <div class="studio-title"><span>📅</span> Week ${marqueeWeek} Marquee <span class="studio-title-note">live lines</span></div>
        <a href="javascript:showTab('schedule')" class="studio-link">full schedule →</a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">${picks.map(marqueeGameHtml).join('')}</div>
    </div>
    <div class="studio-foot">
      <span>Odds source: nflverse / sportsbooks</span>
      <span class="text-slate-300">${sorted.length} Games Scheduled</span>
    </div>
  </div>`;
}

// Part 3: human-first landing. Ranks the most-confident plays by combining
// calibrated edge with per-market model evidence from the backtest gate.
// Trust score (0-100): 60 * min(1, edge/12) + 40 * discrimination quality.
// Plays in markets whose model cannot tell players apart (low AUC) never rank
// as "best bet" even when their EV looks big — that is the longshot trap.
function discriminationTrust(evidence) {
  if (!evidence) return 0;
  let score = 0;
  let checked = 0;
  for (const aucKey of ['auc_2025', 'auc_2024']) {
    const auc = evidence[aucKey];
    if (Number.isFinite(auc) && auc > 0) {
      checked++;
      score += Math.max(0, Math.min(1, (auc - 0.5) / 0.25)); // 0.5->0, 0.75+->1
    }
  }
  if (!checked) return 0;
  return score / checked;
}

// Star rating from a 0-1 trust score (Feature 7). Same thresholds as the
// producer-side trustToStars: <0.2 -> 1, <0.4 -> 2, <0.6 -> 3, <0.8 -> 4, >=0.8 -> 5.
function trustToStarsUi(trust) {
  if (trust == null || Number.isNaN(trust)) return null;
  const t = Math.min(1, Math.max(0, trust));
  if (t >= 0.8) return 5;
  if (t >= 0.6) return 4;
  if (t >= 0.4) return 3;
  if (t >= 0.2) return 2;
  return 1;
}

function starsHtml(stars, color = 'text-amber-400') {
  if (!stars) return '';
  const full = '\u2605'.repeat(stars);
  const empty = '\u2606'.repeat(5 - stars);
  return `<span class="${color} text-[10px] tracking-tight" title="${stars}/5 star rating">${full}${empty}</span>`;
}

// Part 3: human-first landing. Ranks the most-confident plays by combining
// calibrated edge with per-market model evidence from the backtest gate.
// Trust score (0-100): 60 * min(1, edge/12) + 40 * discrimination quality.
// Plays in markets whose model cannot tell players apart (low AUC) never rank
// as "best bet" even when their EV looks big — that is the longshot trap.
function discriminationTrust(evidence) {
  if (!evidence) return 0;
  let score = 0;
  let checked = 0;
  for (const aucKey of ['auc_2025', 'auc_2024']) {
    const auc = evidence[aucKey];
    if (Number.isFinite(auc) && auc > 0) {
      checked++;
      score += Math.max(0, Math.min(1, (auc - 0.5) / 0.25)); // 0.5->0, 0.75+->1
    }
  }
  if (!checked) return 0;
  return score / checked;
}

// Star rating from a 0-1 trust score (Feature 7). Same thresholds as the
// producer-side trustToStars: <0.2 -> 1, <0.4 -> 2, <0.6 -> 3, <0.8 -> 4, >=0.8 -> 5.
function trustToStarsUi(trust) {
  if (trust == null || Number.isNaN(trust)) return null;
  const t = Math.min(1, Math.max(0, trust));
  if (t >= 0.8) return 5;
  if (t >= 0.6) return 4;
  if (t >= 0.4) return 3;
  if (t >= 0.2) return 2;
  return 1;
}

function starsHtml(stars, color = 'text-amber-400') {
  if (!stars) return '';
  const full = '\u2605'.repeat(stars);
  const empty = '\u2606'.repeat(5 - stars);
  return `<span class="${color} text-[10px] tracking-tight" title="${stars}/5 star rating">${full}${empty}</span>`;
}

const NFL_ABBR_ESPN_MAP = {
  'ARI': 'ari', 'ARZ': 'ari', 'Arizona Cardinals': 'ari',
  'ATL': 'atl', 'Atlanta Falcons': 'atl',
  'BAL': 'bal', 'BLT': 'bal', 'Baltimore Ravens': 'bal',
  'BUF': 'buf', 'Buffalo Bills': 'buf',
  'CAR': 'car', 'Carolina Panthers': 'car',
  'CHI': 'chi', 'Chicago Bears': 'chi',
  'CIN': 'cin', 'Cincinnati Bengals': 'cin',
  'CLE': 'cle', 'CLV': 'cle', 'Cleveland Browns': 'cle',
  'DAL': 'dal', 'Dallas Cowboys': 'dal',
  'DEN': 'den', 'Denver Broncos': 'den',
  'DET': 'det', 'Detroit Lions': 'det',
  'GB': 'gb', 'Green Bay Packers': 'gb',
  'HOU': 'hou', 'HST': 'hou', 'Houston Texans': 'hou',
  'IND': 'ind', 'Indianapolis Colts': 'ind',
  'JAX': 'jax', 'Jacksonville Jaguars': 'jax',
  'KC': 'kc', 'Kansas City Chiefs': 'kc',
  'LV': 'lv', 'Las Vegas Raiders': 'lv',
  'LAC': 'lac', 'Los Angeles Chargers': 'lac',
  'LAR': 'lar', 'LA': 'lar', 'Los Angeles Rams': 'lar',
  'MIA': 'mia', 'Miami Dolphins': 'mia',
  'MIN': 'min', 'Minnesota Vikings': 'min',
  'NE': 'ne', 'New England Patriots': 'ne',
  'NO': 'no', 'New Orleans Saints': 'no',
  'NYG': 'nyg', 'New York Giants': 'nyg',
  'NYJ': 'nyj', 'New York Jets': 'nyj',
  'PHI': 'phi', 'Philadelphia Eagles': 'phi',
  'PIT': 'pit', 'Pittsburgh Steelers': 'pit',
  'SF': 'sf', 'San Francisco 49ers': 'sf',
  'SEA': 'sea', 'Seattle Seahawks': 'sea',
  'TB': 'tb', 'Tampa Bay Buccaneers': 'tb',
  'TEN': 'ten', 'Tennessee Titans': 'ten',
  'WAS': 'wsh', 'WSH': 'wsh', 'Washington Commanders': 'wsh'
};

function getNflTeamLogo(teamOrAbbr) {
  if (!teamOrAbbr) return 'https://a.espncdn.com/i/teamlogos/nfl/500/nfl.png';
  const abbr = DATA.teamAbbr?.[teamOrAbbr] || teamOrAbbr;
  const key = NFL_ABBR_ESPN_MAP[teamOrAbbr] || NFL_ABBR_ESPN_MAP[abbr] || String(abbr).toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${key}.png`;
}

