// ═══════════════════════════════════════════════════════════
// ROSTER & TEAM PROJECTIONS MODAL
// ═══════════════════════════════════════════════════════════
let currentRosterTeam = null;
let currentRosterSide = 'offense';
let rookiesOnlyFilter = false;

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

function openRosterFromAbbr(abbr, side = 'offense') {
  if (!abbr) return;
  const clean = String(abbr).trim().toUpperCase();
  const teamName = ABBR_TO_TEAM[clean] || (DATA?.teams?.find(t => t.abbr === clean || t.name.toLowerCase() === String(abbr).toLowerCase())?.name);
  if (teamName) {
    openRoster(teamName, side);
  }
}

function toggleRookiesFilter() {
  rookiesOnlyFilter = !rookiesOnlyFilter;
  const chip = document.getElementById('rookiesOnlyChip');
  if (chip) chip.classList.toggle('active', rookiesOnlyFilter);
  if (currentRosterTeam) renderRosterBody(currentRosterTeam, currentRosterSide);
}

async function openRoster(team, defaultSide = 'offense') {
  currentRosterTeam = team;
  currentRosterSide = defaultSide;
  rookiesOnlyFilter = false;
  const chip = document.getElementById('rookiesOnlyChip');
  if (chip) chip.classList.remove('active');
  const modal = document.getElementById('rosterModal');
  const color = (DATA.teamColors && DATA.teamColors[team]) || '#3b82f6';
  const headerEl = document.getElementById('rosterHeader');
  if (headerEl) headerEl.style.background = `linear-gradient(90deg,${color},transparent)`;
  const titleEl = document.getElementById('rosterTitle');
  if (titleEl) titleEl.textContent = team;
  renderRosterSummary(team);
  const cap = DATA.capData && DATA.capData[team];
  const subEl = document.getElementById('rosterSubtitle');
  if (subEl) {
    const capLabel = cap && Number.isFinite(Number(cap.space)) ? formatCap(Number(cap.space)) : 'Unavailable';
    const capStatus = cap?.status ? `<span class="${getStatusColor(cap.status)} font-semibold">${homeEsc(cap.status)}</span> &middot; ` : '';
    subEl.innerHTML = `${capStatus}Cap: <span class="${cap && Number(cap.space) >= 0 ? 'cap-positive' : 'text-slate-400'} font-bold">${capLabel}</span>`;
  }

  // Highlight tab
  const tabOff = document.getElementById('rosterTabOff');
  const tabDef = document.getElementById('rosterTabDef');
  const tabSt = document.getElementById('rosterTabSt');

  let activeEl = tabOff;
  if (defaultSide === 'defense') activeEl = tabDef;
  else if (defaultSide === 'special') activeEl = tabSt;

  await showRosterSide(defaultSide, activeEl);
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeRoster() {
  document.getElementById('rosterModal').classList.remove('active');
  document.body.style.overflow = '';
}

async function showRosterSide(side, el) {
  currentRosterSide = side;
  document.querySelectorAll('.roster-tab').forEach(t => {
    t.classList.remove('active-off', 'active-def', 'active-st');
  });
  const cls = side === 'defense' ? 'active-def' : side === 'special' ? 'active-st' : 'active-off';
  if (el) el.classList.add(cls);

  const filterRow = document.getElementById('rosterFilterRow');
  const changesEl = document.getElementById('rosterChanges');

  {
    if (filterRow) filterRow.style.display = 'flex';
    if (changesEl) changesEl.style.display = 'block';
    renderRosterBody(currentRosterTeam, side);
    renderRosterChanges(currentRosterTeam);
  }
}

async function renderRosterSummary(team){
  const el = document.getElementById('rosterSummary');
  if (!el) return;
  const cap = DATA.capData && DATA.capData[team];

  // Top-rated player on the roster
  let top = null;
  const roster = DATA.fullRosters && DATA.fullRosters[team];
  if (roster) {
    for (const unit of Object.keys(roster)) {
      for (const p of (roster[unit] || [])) {
        if (p.ovr != null && (!top || p.ovr > top.ovr)) top = p;
      }
    }
  }

  // Future draft capital per year
  const dc = DATA.draftCapital && DATA.draftCapital.capital && DATA.draftCapital.capital[team];
  let dcVal = null, dcSub = null;
  if (dc) {
    dcVal = DATA.draftCapital.years.map(y => (dc[String(y)] || []).length).join(' \u00b7 ');
    dcSub = DATA.draftCapital.years.join(' \u00b7 ') + ' picks';
  }

  const card = (label, value, sub, valCls) =>
    `<div class="rs-card"><div class="rs-label">${label}</div>` +
    `<div class="rs-value ${valCls || ''}">${value}</div>` +
    (sub ? `<div class="rs-sub">${sub}</div>` : '') + `</div>`;

  el.innerHTML =
    card('Cap Space', cap && Number.isFinite(Number(cap.space)) ? formatCap(Number(cap.space)) : '\u2014', cap?.status || 'Cap data unavailable', cap && Number(cap.space) >= 0 ? 'cap-positive' : 'text-slate-400') +
    card('Draft Capital', dcVal || '\u2014', dcSub || '', 'text-violet-300') +
    card('Top Player', top ? top.name : '\u2014', top ? `Highest rated \u00b7 ${top.pos}` : '', 'text-amber-300');
}

function renderRosterBody(team,side){
  const roster=DATA.fullRosters[team];
  if(!roster){document.getElementById('rosterBody').innerHTML='<div class="text-sm text-slate-500">No roster data available.</div>';return;}
  const sideKey = (side || 'offense').toLowerCase();
  let players = roster[sideKey] || [];
  if(rookiesOnlyFilter) players = players.filter(p => p.isRookie);
  if(!players.length){document.getElementById('rosterBody').innerHTML=`<div class="text-sm text-slate-500 py-8 text-center">${rookiesOnlyFilter ? 'No rookies on this unit' : 'No data for this unit'}</div>`;return;}

  const matched = new Set();
  function getPlayersFor(posList) {
    return players.filter(p => {
      const pos = (p.pos || '').toUpperCase();
      if (posList.includes(pos)) {
        matched.add(p);
        return true;
      }
      return false;
    });
  }

  let groups=[];
  if(sideKey==='offense'){
    groups=[
      {label:'Quarterbacks',players:getPlayersFor(['QB']),color:'#3b82f6'},
      {label:'Running Backs',players:getPlayersFor(['RB','FB','HB']),color:'#22c55e'},
      {label:'Wide Receivers',players:getPlayersFor(['WR']),color:'#f59e0b'},
      {label:'Tight Ends',players:getPlayersFor(['TE']),color:'#8b5cf6'},
      {label:'Centers',players:getPlayersFor(['C']),color:'#64748b'},
      {label:'Guards',players:getPlayersFor(['G','OG']),color:'#64748b'},
      {label:'Offensive Tackles',players:getPlayersFor(['OT','T','OL']),color:'#64748b'}
    ];
  } else if(sideKey==='defense'){
    groups=[
      {label:'Defensive Ends / EDGE',players:getPlayersFor(['DE','EDGE']),color:'#ef4444'},
      {label:'Defensive Tackles',players:getPlayersFor(['DT','NT','DL']),color:'#f97316'},
      {label:'Linebackers',players:getPlayersFor(['LB','ILB','OLB','MLB']),color:'#eab308'},
      {label:'Cornerbacks',players:getPlayersFor(['CB','DB']),color:'#06b6d4'},
      {label:'Safeties',players:getPlayersFor(['S','FS','SS']),color:'#8b5cf6'}
    ];
  } else {
    groups=[
      {label:'Kickers',players:getPlayersFor(['PK','K']),color:'#f59e0b'},
      {label:'Punters',players:getPlayersFor(['P']),color:'#f59e0b'},
      {label:'Long Snappers',players:getPlayersFor(['LS']),color:'#f59e0b'}
    ];
  }

  // Fallback for any unrecognized position so no players are dropped
  const otherPlayers = players.filter(p => !matched.has(p));
  if (otherPlayers.length > 0) {
    groups.push({label:'Other',players:otherPlayers,color:'#94a3b8'});
  }

  let h='';
  groups.forEach(grp=>{
    if(!grp.players.length)return;
    h+=`<div class="pos-group">
      <div class="pos-group-header" onclick="this.classList.toggle('collapsed')">
        <span style="width:3px;height:14px;border-radius:2px;background:${grp.color};display:inline-block"></span>
        <span class="pg-label" style="color:${grp.color}">${grp.label}</span>
        <span class="pg-count">${grp.players.length}</span>
        <span class="pg-chevron">&#9660;</span>
      </div>
      <div class="pos-group-list">`;
    grp.players.sort((a,b) => (b.ovr ?? -1) - (a.ovr ?? -1));
    grp.players.forEach(p=>{
      const tier = (p.ovr === null || p.ovr === undefined) ? 'rating-dev' : ratingClass(p.ovr);
      const ovrDisplay = (p.ovr === null || p.ovr === undefined) ? '—' : p.ovr;
      let badge = '';
      if (p.isRookie) badge = `<span class="badge-rook">ROOK</span>`;
      else if (p.acquisitionType === 'fa' || p.acquisitionType === 'trade') badge = `<span class="badge-new">NEW</span>`;
      const rowCls = p.isRookie ? 'is-rookie' : (p.isNew ? 'is-new' : '');
      const nameEsc = (p.name||'').replace(/'/g,"\\'");
      h+=`<div class="compact-player ${rowCls}" onclick="openPlayerModal('${nameEsc}','${(team||'').replace(/'/g,"\\'")}')" role="button" title="Open ${p.name}">
        <span class="cp-num">${p.num||'-'}</span>
        <span class="cp-name" title="${p.name}">${p.name}</span>
        <span class="cp-pos">${p.pos}</span>
        <span class="cp-age">${p.age||''}</span>
        ${badge}
        <span class="rating-badge ${tier}" title="Player rating: ${ovrDisplay}">${ovrDisplay}</span>
        <button type="button" class="cp-stats" data-name="${homeEsc(p.name || '')}" data-team="${homeEsc(team || '')}" onclick="openNflPlayerFromEl(this, event)" title="Season stats and game log from ESPN" aria-label="${homeEsc(p.name || '')}: season stats and game log">Stats</button>
      </div>`;
    });
    h+=`</div></div>`;
  });
  document.getElementById('rosterBody').innerHTML=h;
}

function renderRosterChanges(team){
  const gains=getTeamGains(team);const losses=getTeamLosses(team);
  let h='<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
  // Gains
  h+=`<div><div class="text-xs font-bold text-emerald-400 mb-2">&#x2B06; ACQUIRED (${gains.length})</div>`;
  if(gains.length){
    gains.forEach(g=>{
      h+=`<div class="flex items-center gap-2 text-xs py-1 border-b border-slate-800">
        <span class="new-badge text-[9px] px-1.5 py-0 rounded-full font-bold text-white">NEW</span>
        <span class="text-white font-medium">${g.player_name}</span>
        <span class="text-slate-500">${g.pos}</span>
        <span class="text-slate-600">&larr; ${g.from_team}</span>
      </div>`;
    });
  } else { h+='<div class="text-xs text-slate-600">No acquisitions</div>'; }
  h+='</div>';
  // Losses
  h+=`<div><div class="text-xs font-bold text-red-400 mb-2">&#x2B07; LOST (${losses.length})</div>`;
  if(losses.length){
    losses.forEach(l=>{
      h+=`<div class="flex items-center gap-2 text-xs py-1 border-b border-slate-800">
        <span class="lost-badge text-[9px] px-1.5 py-0 rounded-full font-bold text-white">OUT</span>
        <span class="text-slate-400 font-medium">${l.player_name}</span>
        <span class="text-slate-500">${l.pos}</span>
        <span class="text-slate-600">&rarr; ${l.to_team}</span>
      </div>`;
    });
  } else { h+='<div class="text-xs text-slate-600">No losses</div>'; }
  h+='</div></div>';
  document.getElementById('rosterChanges').innerHTML=h;
}

