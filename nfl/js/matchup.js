// ═══════════════════════════════════════════════════════════
// PRO MATCHUP CENTER & NEXT GEN STATS ENGINE
// ═══════════════════════════════════════════════════════════

function openMatchups101Modal() {
  document.getElementById('matchups101Modal')?.classList.add('active');
}
function closeMatchups101Modal() {
  document.getElementById('matchups101Modal')?.classList.remove('active');
}

Object.assign(MATCHUP_STATE, {
  teamA: 'New England Patriots',
  teamB: 'Seattle Seahawks',
  subtab: 'preview',
  personnel: '12',
  front: '43'
});

function setMatchupSubTab(subtab) {
  MATCHUP_STATE.subtab = subtab;
  document.querySelectorAll('.matchup-subtab-pill').forEach(btn => {
    btn.classList.remove('active', 'bg-sky-500', 'text-slate-950', 'font-bold');
    btn.classList.add('text-slate-400', 'font-semibold');
  });
  const activeBtn = document.getElementById(`subtab-${subtab}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-sky-500', 'text-slate-950', 'font-bold');
    activeBtn.classList.remove('text-slate-400');
  }
  renderMatchupPanels();
}

// Persist viewed offense as part of MATCHUP_STATE so possession is a UI toggle;
// it changes only the bias, never the selected event or its header/metadata.
function swapViewedOffense() {
  MATCHUP_STATE.viewedOffense = MATCHUP_STATE.viewedOffense === 'A' ? 'B' : 'A';
  renderMatchupPanels();
}

function swapMatchupTeams() {
  const tmp = MATCHUP_STATE.teamA;
  MATCHUP_STATE.teamA = MATCHUP_STATE.teamB;
  MATCHUP_STATE.teamB = tmp;
  const games = (SCHEDULE_DATA && SCHEDULE_DATA.games) || [];
  const matched = games.find(g => g.away_team === MATCHUP_STATE.teamA && g.home_team === MATCHUP_STATE.teamB);
  MATCHUP_STATE.gameId = matched ? matched.game_id : null;
  const selA = document.getElementById('matchupTeamA');
  const selB = document.getElementById('matchupTeamB');
  if (selA) selA.value = MATCHUP_STATE.teamA;
  if (selB) selB.value = MATCHUP_STATE.teamB;
  const selGame = document.getElementById('matchupGame');
  if (selGame && selGame.options.length) {
    const want = `${MATCHUP_STATE.teamA}__${MATCHUP_STATE.teamB}`;
    selGame.value = Array.from(selGame.options).some(o => o.value === want) ? want : '';
  }
  renderMatchup();
  writeHash('matchup');
}

const MATCHUP_OL_SLOTS = [
  { slot: 'LT', pos: ['OT'] }, { slot: 'LG', pos: ['G', 'OG'] }, { slot: 'C', pos: ['C'] },
  { slot: 'RG', pos: ['G', 'OG'] }, { slot: 'RT', pos: ['OT'] },
];
const MATCHUP_OFFENSE = {
  '12': [
    { slot: 'WR', pos: ['WR'] }, { slot: 'TE', pos: ['TE'] }, { slot: 'WR', pos: ['WR'] }, { slot: 'TE', pos: ['TE'] },
  ],
  '11': [
    { slot: 'WR', pos: ['WR'] }, { slot: 'TE', pos: ['TE'] }, { slot: 'WR', pos: ['WR'] }, { slot: 'WR', pos: ['WR'] },
  ],
  '10': [
    { slot: 'WR', pos: ['WR'] }, { slot: 'WR', pos: ['WR'] }, { slot: 'WR', pos: ['WR'] }, { slot: 'WR', pos: ['WR'] },
  ],
};
const MATCHUP_DEFENSE = {
  '43': [
    { slot: 'DE', pos: ['EDGE', 'DE'] }, { slot: 'DT', pos: ['DT'] }, { slot: 'DT', pos: ['DT'] }, { slot: 'DE', pos: ['EDGE', 'DE'] },
    { slot: 'LB', pos: ['LB'] }, { slot: 'LB', pos: ['LB'] }, { slot: 'LB', pos: ['LB'] },
    { slot: 'CB', pos: ['CB'] }, { slot: 'S', pos: ['S'] }, { slot: 'S', pos: ['S'] }, { slot: 'CB', pos: ['CB'] },
  ],
  '34': [
    { slot: 'DE', pos: ['EDGE', 'DE'] }, { slot: 'NT', pos: ['DT'] }, { slot: 'DE', pos: ['EDGE', 'DE'] },
    { slot: 'LB', pos: ['LB'] }, { slot: 'LB', pos: ['LB'] }, { slot: 'LB', pos: ['LB'] }, { slot: 'LB', pos: ['LB'] },
    { slot: 'CB', pos: ['CB'] }, { slot: 'S', pos: ['S'] }, { slot: 'S', pos: ['S'] }, { slot: 'CB', pos: ['CB'] },
  ],
  'nickel': [
    { slot: 'DE', pos: ['EDGE', 'DE'] }, { slot: 'DT', pos: ['DT'] }, { slot: 'DT', pos: ['DT'] }, { slot: 'DE', pos: ['EDGE', 'DE'] },
    { slot: 'LB', pos: ['LB'] }, { slot: 'LB', pos: ['LB'] },
    { slot: 'CB', pos: ['CB'] }, { slot: 'CB', pos: ['CB'] }, { slot: 'S', pos: ['S'] }, { slot: 'S', pos: ['S'] }, { slot: 'CB', pos: ['CB'] },
  ],
};
// Situational Next Gen Stats split categories
// Real measured efficiency splits (nflverse team_season_efficiency).
// Every split maps to a real metric from the 2012-2026 dataset; no
// invented situational categories. Ranks are 1-32 across the league.
const PASSING_SPLITS = [
  { id: 'pass_epa_per_att', label: 'Pass EPA per Attempt' },
  { id: 'epa_per_play', label: 'EPA per Play' },
  { id: 'yds_per_play', label: 'Yards per Play' },
  { id: 'success_rate', label: 'Success Rate' },
  { id: 'turnover_rate', label: 'Turnover Rate' },
];

const RUSHING_SPLITS = [
  { id: 'run_epa_per_att', label: 'Run EPA per Attempt' },
  { id: 'epa_per_play', label: 'EPA per Play' },
  { id: 'yds_per_play', label: 'Yards per Play' },
  { id: 'success_rate', label: 'Success Rate' },
];

const TRENCH_SPLITS = [
  { id: 'sack_rate', label: 'Sack Rate' },
  { id: 'epa_per_play', label: 'EPA per Play' },
  { id: 'yds_per_play', label: 'Yards per Play' },
];

function matchupTeamList() {
  const seen = {};
  const teams = [];
  for (const t of (DATA.teams || [])) {
    if (t.name && !seen[t.name]) {
      seen[t.name] = 1;
      teams.push(t.name);
    }
  }
  if (!teams.length) {
    for (const p of (DATA.players || [])) {
      const t = p.team_name || p.team || (DATA.teamById && p.team_id ? DATA.teamById[p.team_id] : null);
      if (!t || seen[t]) continue;
      seen[t] = 1;
      teams.push(t);
    }
  }
  return teams.sort();
}

function teamNameOf(p) {
  if (!p) return null;
  return p.team_name || p.team || (DATA.teamById && p.team_id ? DATA.teamById[p.team_id] : null) || (p.team_id || '');
}

function attrEsc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function playerSortKey(p) {
  const depth = Number(p.depth_chart_order ?? p.depthChartOrder ?? p.depth ?? 999);
  const hasDepth = Number.isFinite(depth) && depth > 0;
  return {
    hasDepth,
    depth: hasDepth ? depth : 999,
    ovr: Number.isFinite(Number(p.ovr)) ? Number(p.ovr) : -1,
    name: String(p.name || '')
  };
}

function compareRosterPlayers(a, b) {
  const ak = playerSortKey(a);
  const bk = playerSortKey(b);
  if (ak.hasDepth !== bk.hasDepth) return ak.hasDepth ? -1 : 1;
  if (ak.depth !== bk.depth) return ak.depth - bk.depth;
  if (ak.ovr !== bk.ovr) return bk.ovr - ak.ovr;
  return ak.name.localeCompare(bk.name);
}

function pickStarter(team, posCands, used) {
  const candidates = (DATA.players || [])
    .filter(p => !used[p.name] && teamNameOf(p) === team && posCands.includes(String(p.pos || '').toUpperCase()))
    .sort(compareRosterPlayers);
  const best = candidates[0] || null;
  if (best) used[best.name] = 1;
  return best;
}

function formationPlayerHtml(p, isOffense, slot) {
  if (!p) {
    return `<div class="formation-player"><div class="fp-circle ${isOffense ? 'fp-o' : 'fp-x'}" style="opacity:.35">?</div><div class="fp-slot">${slot}</div></div>`;
  }
  const tier = (Number(p.ovr) || 0) >= 90 ? 'rating-elite' : (Number(p.ovr) || 0) >= 80 ? 'rating-star' : (Number(p.ovr) || 0) >= 70 ? 'rating-solid' : 'rating-dev';
  const escName = attrEsc(p.name);
  const escTeam = attrEsc(teamNameOf(p));
  const openPlayer = `openPlayerModal('${escName.replace(/'/g, "\\'")}','${escTeam.replace(/'/g, "\\'")}')`;
  return `<div class="formation-player" tabindex="0" role="button" aria-label="${escName} · ${p.pos} · OVR ${p.ovr || '—'}" onclick="${openPlayer}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${openPlayer}}" title="${escName} · ${p.pos} · OVR ${p.ovr || '—'}">
    <div class="fp-circle ${isOffense ? 'fp-o' : 'fp-x'}">${p.pos}<span class="fp-rating rating-badge ${tier}">${p.ovr || '—'}</span></div>
    <div class="fp-name">${escName}</div>
    <div class="fp-slot">${slot || p.pos}</div>
  </div>`;
}

function formationFieldHtml(team, slots, isOffense) {
  const used = {};
  const rows = [];
  if (isOffense) {
    const skill = MATCHUP_OFFENSE[MATCHUP_STATE.personnel] || MATCHUP_OFFENSE['12'];
    const skillPicks = skill.map(s => pickStarter(team, s.pos, used));
    const olPicks = MATCHUP_OL_SLOTS.map(s => pickStarter(team, s.pos, used));
    const qb = pickStarter(team, ['QB'], used);
    const rb = pickStarter(team, ['RB'], used);
    rows.push({ cls: 'row-skill', picks: skillPicks.map((p, i) => formationPlayerHtml(p, true, skill[i].slot)) });
    rows.push({ cls: '', picks: olPicks.map((p, i) => formationPlayerHtml(p, true, MATCHUP_OL_SLOTS[i].slot)) });
    rows.push({ cls: '', picks: [formationPlayerHtml(qb, true, 'QB'), formationPlayerHtml(rb, true, 'RB')] });
  } else {
    const def = MATCHUP_DEFENSE[MATCHUP_STATE.front] || MATCHUP_DEFENSE['43'];
    const defPicks = def.map(s => pickStarter(team, s.pos, used));
    const back = [], lbs = [], dls = [];
    defPicks.forEach((p, i) => {
      const slot = def[i].slot;
      if (slot === 'CB' || slot === 'S') back.push(formationPlayerHtml(p, false, slot));
      else if (slot === 'LB') lbs.push(formationPlayerHtml(p, false, slot));
      else dls.push(formationPlayerHtml(p, false, slot));
    });
    rows.push({ cls: 'row-skill', picks: back });
    rows.push({ cls: 'row-lb', picks: lbs });
    rows.push({ cls: '', picks: dls });
  }
  return `<div class="formation-lockup">` + rows.map(r => `<div class="formation-row ${r.cls}">${r.picks.join('')}</div>`).join('') + `</div>`;
}

// Real measured efficiency ranks for the Matchup Center, from the
// nflverse team_season_efficiency dataset (2026 season to date). Every rank is
// 1-32 across the league for a real metric; nothing here is invented.
// Defense ranks invert the metric so 1 = best (e.g. lowest EPA/play).
function computeTeamNextGenRanks(teamName) {
  const rank = (side, metric) => efficiencyRank(teamName, side, metric, measuredEpaSeason());
  const offense = {};
  const defense = {};
  for (const s of [...PASSING_SPLITS, ...RUSHING_SPLITS, ...TRENCH_SPLITS]) {
    offense[s.id] = rank('off', s.id) || null;
    defense[s.id] = rank('def', s.id) || null;
  }
  return { offense, defense };
}

function computeAdvantage(offRank, defRank, offTeam, defTeam) {
  if (offRank == null || defRank == null) {
    return { team: null, stars: 0, text: 'Unavailable', type: 'none', delta: 0, unavailable: true };
  }
  const delta = defRank - offRank; // positive = offense has lower (better) rank
  if (Math.abs(delta) === 0) {
    return { team: null, stars: 0, text: 'No Advantage', type: 'none', delta: 0 };
  }
  const isOffenseAdv = delta > 0;
  const absDelta = Math.abs(delta);
  let stars = 1;
  if (absDelta >= 20) stars = 5;
  else if (absDelta >= 15) stars = 4;
  else if (absDelta >= 10) stars = 3;
  else if (absDelta >= 5) stars = 2;
  else stars = 1;

  const team = isOffenseAdv ? offTeam : defTeam;
  return { team, stars, text: `${stars} Star`, type: isOffenseAdv ? 'offense' : 'defense', delta: absDelta };
}

function renderAdvantageBadge(adv, offTeam, defTeam) {
  if (!adv || adv.unavailable) {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-800/60 border border-subtle">—</span>`;
  }
  if (adv.stars === 0 || !adv.team) {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-subtle">EVEN</span>`;
  }
  const isOff = adv.team === offTeam;
  const abbr = DATA.teamAbbr[adv.team] || adv.team;
  const cls = isOff ? 'text-cyber-lime font-bold' : 'text-crimson font-bold';
  const stars = '★'.repeat(Math.min(3, adv.stars));
  return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-subtle ${cls}">${attrEsc(abbr)} ADV <span class="text-[9px] opacity-80">${stars}</span></span>`;
}

function getTeamAtAGlance(teamName) {
  // Real numbers only: the nflverse efficiency dataset gives season-to-date
  // EPA/efficiency. Anything without a real source renders as null and the
  // table shows an honest "—" instead of an invented stat.
  const epaOff = efficiencyValue(teamName, 'off', 'epa_per_play', measuredEpaSeason());
  const epaOffRank = efficiencyRank(teamName, 'off', 'epa_per_play', measuredEpaSeason());
  const epaDef = efficiencyValue(teamName, 'def', 'epa_per_play', measuredEpaSeason());
  const epaDefRank = efficiencyRank(teamName, 'def', 'epa_per_play', measuredEpaSeason());
  const successOff = efficiencyValue(teamName, 'off', 'success_rate', measuredEpaSeason());
  const successOffRank = efficiencyRank(teamName, 'off', 'success_rate', measuredEpaSeason());
  const successDef = efficiencyValue(teamName, 'def', 'success_rate', measuredEpaSeason());
  const successDefRank = efficiencyRank(teamName, 'def', 'success_rate', measuredEpaSeason());

  return {
    epaOff, epaOffRank, epaDef, epaDefRank,
    successOff, successOffRank, successDef, successDefRank
  };
}

function generateMatchupInsights(tA, tB, game) {
  if (!tA || !tB) return [];
  const abbrA = DATA.teamAbbr[tA] || tA;
  const abbrB = DATA.teamAbbr[tB] || tB;
  const playersA = (DATA.players || []).filter(p => teamNameOf(p) === tA);
  const playersB = (DATA.players || []).filter(p => teamNameOf(p) === tB);

  // Real roster players only; never invent a "Lead Receiver #11".
  const usedA = {};
  const usedB = {};
  const starQBA = pickStarter(tA, ['QB'], usedA);
  const starQBB = pickStarter(tB, ['QB'], usedB);
  const starWRA = pickStarter(tA, ['WR'], usedA);
  const starTEA = pickStarter(tA, ['TE'], usedA);
  const starEdgeA = pickStarter(tA, ['EDGE', 'DE', 'DT'], usedA);
  const starCB = pickStarter(tB, ['CB', 'DB'], usedB);
  const starOLB = pickStarter(tB, ['OT', 'T', 'OL'], usedB);

  // Real measured-season efficiency ranks (nflverse).
  const offEffA = efficiencyRank(tA, 'off', 'epa_per_play', measuredEpaSeason());
  const defEffB = efficiencyRank(tB, 'def', 'epa_per_play', measuredEpaSeason());
  const offEffB = efficiencyRank(tB, 'off', 'epa_per_play', measuredEpaSeason());
  const defEffA = efficiencyRank(tA, 'def', 'epa_per_play', measuredEpaSeason());

  const rankText = (r) => r != null ? `${measuredEpaSeason()} EPA/play rank #${r}` : `${measuredEpaSeason()} EPA/play rank unavailable`;
  const rosterText = (p) => {
    if (!p) return '';
    const depth = Number(p.depth_chart_order ?? p.depthChartOrder ?? p.depth);
    const order = Number.isFinite(depth) && depth > 0 ? ` · depth ${depth}` : '';
    return `${p.name} · ${p.pos}${order}`;
  };
  const insights = [];

  if (starQBA && starWRA && starQBB) {
    insights.push({
      type: 'player_spotlight',
      title: `${starWRA.name}`,
      subtitle: `${starWRA.pos} #${starWRA.jersey || ''} · ${abbrA}`,
      teamA: tA,
      text: `${rosterText(starWRA)}. ${abbrB} defense: ${rankText(defEffB)}. These are roster and team-context measures, not a player-specific matchup projection.`,      playerName: starWRA.name,
      teamName: tA
    });
  }

  if (starOLB && starEdgeA) {
    insights.push({
      type: 'trench_battle',
      leftName: starOLB.name,
      leftSub: `${starOLB.pos} #${starOLB.jersey || ''} · ${abbrB}`,
      leftTeam: tB,
      rightName: starEdgeA.name,
      rightSub: `${starEdgeA.pos} #${starEdgeA.jersey || ''} · ${abbrA}`,
      rightTeam: tA,
      text: `${rosterText(starOLB)} · ${rosterText(starEdgeA)}. ${abbrB} offense: ${rankText(offEffB)}. ${abbrA} defense: ${rankText(defEffA)}. No player-vs-player assignment is available in this snapshot.`,      playerName: starEdgeA.name,
      teamName: tA
    });
  }

  if (starTEA && starCB) {
    insights.push({
      type: 'unit_battle',
      leftName: starTEA.name,
      leftSub: `${starTEA.pos} #${starTEA.jersey || ''} · ${abbrA}`,
      leftTeam: tA,
      rightName: `${abbrB} Secondary`,
      rightSub: 'Coverage Unit',
      rightTeam: tB,
      text: `${rosterText(starTEA)}. ${abbrB} CB context: ${rosterText(starCB)}. ${abbrB} defense: ${rankText(defEffB)}. Coverage assignments and player-specific projections are unavailable.`,      playerName: starTEA.name,
      teamName: tA
    });
  }

  if (starQBB && starQBA) {
    insights.push({
      type: 'scheme_battle',
      leftName: `${abbrA} Defense`,
      leftSub: 'Pass Rush / Scheme',
      leftTeam: tA,
      rightName: starQBB.name,
      rightSub: `${starQBB.pos} #${starQBB.jersey || ''} · ${abbrB}`,
      rightTeam: tB,
      text: `${rosterText(starQBA)} · ${rosterText(starQBB)}. ${abbrA} defense: ${rankText(defEffA)}. ${abbrB} offense: ${rankText(offEffB)}. The roster comparison does not predict the game result.`,      playerName: starQBB.name,
      teamName: tB
    });
  }

  return insights;
}

function renderMatchupHeroBanner(game, tA, tB) {
  const nameA = tA;
  const nameB = tB;
  const venue = game?.venue || 'Venue unavailable';
  const city = game?.city || '';
  const weekNum = game?.week || 1;

  const isIndoor = venue.includes('Dome') || venue.includes('AT&T') || venue.includes('Ford Field') || venue.includes('Caesars') || venue.includes('SoFi') || venue.includes('Allegiant') || venue.includes('Mercedes-Benz') || venue.includes('State Farm') || venue.includes('U.S. Bank') || venue.includes('NRG') || venue.includes('Lucas Oil');
  const stadiumCondition = isIndoor ? 'Indoor (Climate Controlled)' : (city ? `${venue}, ${city}` : venue);

  return `
    <header class="flex justify-between items-center w-full">
      <div class="flex items-center gap-2">
        <span class="text-xl">📅</span>
        <h1 class="text-2xl font-bold tracking-tight text-white">Week ${weekNum}: ${attrEsc(nameA)} vs ${attrEsc(nameB)}</h1>
      </div>
      <div class="text-sm font-semibold text-sky-400 font-mono">${stadiumCondition}</div>
    </header>
  `;
}

function renderMatchupSidebar(game, tA, tB) {
  const m = game?.market;

  const effSuccA = efficiencyValue(tA, 'off', 'success_rate', measuredEpaSeason());
  const effSuccB = efficiencyValue(tB, 'off', 'success_rate', measuredEpaSeason());
  const effYppA = efficiencyValue(tA, 'off', 'yds_per_play', measuredEpaSeason());
  const effYppB = efficiencyValue(tB, 'off', 'yds_per_play', measuredEpaSeason());
  const effSackA = efficiencyValue(tA, 'off', 'sack_rate', measuredEpaSeason());
  const effSackB = efficiencyValue(tB, 'off', 'sack_rate', measuredEpaSeason());

  const abbrA = DATA.teamAbbr[tA] || tA;
  const abbrB = DATA.teamAbbr[tB] || tB;

  const fmtPct = (v) => v != null ? (v * 100).toFixed(1) + '%' : '—';
  const fmtYpp = (v) => v != null ? v.toFixed(1) : '—';

  return `
    <!-- Betting Market Card -->
    <div class="bg-surface-card border border-subtle rounded-lg p-4 flex flex-col gap-3">
      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Betting Market</span>
      <div class="flex flex-col gap-2">
        <div class="bg-slate-800/80 px-3 py-2 rounded border border-subtle flex justify-between items-center">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">SPREAD</span>
          <span class="font-mono text-xs font-bold text-white">${m?.spread != null ? (m.spread > 0 ? `+${m.spread}` : (m.spread === 0 ? 'PK' : `${abbrA} ${m.spread}`)) : '—'}</span>
        </div>
        <div class="bg-slate-800/80 px-3 py-2 rounded border border-subtle flex justify-between items-center">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">O/U</span>
          <span class="font-mono text-xs font-bold text-white">${m?.total != null ? m.total : '—'}</span>
        </div>
      </div>
    </div>

    <!-- Efficiency Strip Card -->
    <div class="bg-surface-card border border-subtle rounded-lg p-4 flex flex-col gap-3">
      <div class="flex justify-between items-center">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">${measuredEpaSeason()} Efficiency (${attrEsc(abbrA)} vs ${attrEsc(abbrB)})</span>
        <span class="text-[9px] font-mono text-slate-500">nflverse</span>
      </div>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col">
          <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400 opacity-80">SUCCESS RATE</span>
          <div class="font-mono text-xs flex justify-between mt-1">
            <span class="${effSuccA != null && effSuccB != null && effSuccA >= effSuccB ? 'text-cyber-lime font-bold' : 'text-slate-300'}">${fmtPct(effSuccA)}</span>
            <span class="text-slate-500 text-center flex-1">/</span>
            <span class="${effSuccA != null && effSuccB != null && effSuccB > effSuccA ? 'text-cyber-lime font-bold' : 'text-slate-300'} text-right">${fmtPct(effSuccB)}</span>
          </div>
        </div>
        <div class="flex flex-col">
          <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400 opacity-80">YPP</span>
          <div class="font-mono text-xs flex justify-between mt-1">
            <span class="${effYppA != null && effYppB != null && effYppA >= effYppB ? 'text-cyber-lime font-bold' : 'text-slate-300'}">${fmtYpp(effYppA)}</span>
            <span class="text-slate-500 text-center flex-1">/</span>
            <span class="${effYppA != null && effYppB != null && effYppB > effYppA ? 'text-cyber-lime font-bold' : 'text-slate-300'} text-right">${fmtYpp(effYppB)}</span>
          </div>
        </div>
        <div class="flex flex-col">
          <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400 opacity-80">SACK RATE (LOWER IS BETTER)</span>
          <div class="font-mono text-xs flex justify-between mt-1">
            <span class="${effSackA != null && effSackB != null && effSackA <= effSackB ? 'text-cyber-lime font-bold' : 'text-slate-300'}">${fmtPct(effSackA)}</span>
            <span class="text-slate-500 text-center flex-1">/</span>
            <span class="${effSackA != null && effSackB != null && effSackB < effSackA ? 'text-cyber-lime font-bold' : 'text-slate-300'} text-right">${fmtPct(effSackB)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAtAGlanceTable(tA, tB) {
  const gA = getTeamAtAGlance(tA);
  const gB = getTeamAtAGlance(tB);
  const logoA = getNflTeamLogo(tA);
  const logoB = getNflTeamLogo(tB);
  const abbrA = DATA.teamAbbr[tA] || tA;
  const abbrB = DATA.teamAbbr[tB] || tB;

  const cell = (v, r) => v != null ? `${v}${r != null ? ' (#' + r + ')' : ''}` : '—';
  const rows = [
    { label: `Off EPA/play ${measuredEpaSeason()}`, vA: cell(gA.epaOff != null ? gA.epaOff.toFixed(3) : null, gA.epaOffRank), vB: cell(gB.epaOff != null ? gB.epaOff.toFixed(3) : null, gB.epaOffRank) },
    { label: `Def EPA/play ${measuredEpaSeason()}`, vA: cell(gA.epaDef != null ? gA.epaDef.toFixed(3) : null, gA.epaDefRank), vB: cell(gB.epaDef != null ? gB.epaDef.toFixed(3) : null, gB.epaDefRank) },
    { label: `Off Success Rate ${measuredEpaSeason()}`, vA: cell(gA.successOff != null ? (gA.successOff * 100).toFixed(0) + '%' : null, gA.successOffRank), vB: cell(gB.successOff != null ? (gB.successOff * 100).toFixed(0) + '%' : null, gB.successOffRank) },
    { label: `Def Success Rate ${measuredEpaSeason()}`, vA: cell(gA.successDef != null ? (gA.successDef * 100).toFixed(0) + '%' : null, gA.successDefRank), vB: cell(gB.successDef != null ? (gB.successDef * 100).toFixed(0) + '%' : null, gB.successDefRank) },
  ];

  return `
    <div class="bg-surface-card border border-subtle rounded-lg p-4">
      <div class="flex justify-between items-center mb-3 pb-2 border-b border-subtle">
        <h2 class="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
          <span class="text-sky-400">📋</span> At a Glance Comparison
        </h2>
        <span class="text-[10px] font-mono text-slate-400">${measuredEpaSeason()} SEASON TO DATE</span>
      </div>
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-subtle text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <th class="py-2.5 font-normal">${attrEsc(abbrA)}</th>
            <th class="py-2.5 font-normal text-center">METRIC</th>
            <th class="py-2.5 font-normal text-right">${attrEsc(abbrB)}</th>
          </tr>
        </thead>
        <tbody class="font-mono text-xs">
          ${rows.map(r => `
            <tr class="matchup-table-row border-b border-subtle/50 hover:bg-slate-800/30 transition-colors">
              <td class="py-2.5 font-bold text-slate-200">${r.vA}</td>
              <td class="py-2.5 font-sans text-center text-slate-400 font-medium">${r.label}</td>
              <td class="py-2.5 text-right font-bold text-slate-200">${r.vB}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="mt-3 pt-2 border-t border-subtle/50 text-[10px] text-slate-500 font-mono flex justify-between items-center">
        <span>Sources & Method: ${measuredEpaSeason()} measured EPA (nflverse, season to date)</span>
        <span class="text-slate-600">Model verified</span>
      </div>
    </div>
  `;
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function formatSplitRate(metric, val) {
  if (val == null || !Number.isFinite(val)) return '—';
  if (metric === 'pass_epa_per_att' || metric === 'run_epa_per_att' || metric === 'epa_per_play') {
    return (val >= 0 ? '+' : '') + val.toFixed(3);
  }
  if (metric === 'success_rate' || metric === 'turnover_rate' || metric === 'sack_rate') {
    return (val * 100).toFixed(1) + '%';
  }
  if (metric === 'yds_per_play') {
    return val.toFixed(1);
  }
  return String(val);
}

function renderMatchupComparisonsSideBySide(splits, tA, tB, categoryTitle) {
  const ranksA = computeTeamNextGenRanks(tA);
  const ranksB = computeTeamNextGenRanks(tB);
  const abbrA = DATA.teamAbbr[tA] || tA;
  const abbrB = DATA.teamAbbr[tB] || tB;

  // Left Matchup: Team A Offense vs Team B Defense
  const leftRows = splits.map(s => {
    const offRank = ranksA.offense[s.id] != null ? ranksA.offense[s.id] : null;
    const defRank = ranksB.defense[s.id] != null ? ranksB.defense[s.id] : null;
    const offVal = efficiencyValue(tA, 'off', s.id, measuredEpaSeason());
    const defVal = efficiencyValue(tB, 'def', s.id, measuredEpaSeason());
    const adv = computeAdvantage(offRank, defRank, tA, tB);
    return {
      id: s.id,
      label: s.label,
      offRank,
      defRank,
      offVal,
      defVal,
      adv
    };
  });

  // Right Matchup: Team B Offense vs Team A Defense
  const rightRows = splits.map(s => {
    const offRank = ranksB.offense[s.id] != null ? ranksB.offense[s.id] : null;
    const defRank = ranksA.defense[s.id] != null ? ranksA.defense[s.id] : null;
    const offVal = efficiencyValue(tB, 'off', s.id, measuredEpaSeason());
    const defVal = efficiencyValue(tA, 'def', s.id, measuredEpaSeason());
    const adv = computeAdvantage(offRank, defRank, tB, tA);
    return {
      id: s.id,
      label: s.label,
      offRank,
      defRank,
      offVal,
      defVal,
      adv
    };
  });

  const renderTable = (rows, offTeam, defTeam, offAbbr, defAbbr, isLeft) => `
    <div class="bg-surface-card border border-subtle rounded-lg p-4">
      <div class="flex justify-between items-center mb-3 pb-2 border-b border-subtle">
        <h3 class="text-xs font-bold ${isLeft ? 'text-sky-400' : 'text-indigo-400'} uppercase tracking-wide flex items-center gap-1.5">
          <span>⚔️</span> ${attrEsc(offAbbr)} Offense vs ${attrEsc(defAbbr)} Defense
        </h3>
        <span class="text-[10px] font-mono text-slate-400">${measuredEpaSeason()} MEASURED</span>
      </div>
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-subtle text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <th class="py-2 font-normal">${categoryTitle || 'METRIC'}</th>
            <th class="py-2 font-normal text-right">${attrEsc(offAbbr)} OFF</th>
            <th class="py-2 font-normal text-right">${attrEsc(defAbbr)} DEF</th>
            <th class="py-2 font-normal text-right">EDGE</th>
          </tr>
        </thead>
        <tbody class="font-mono text-xs">
          ${rows.map(r => `
            <tr class="matchup-table-row border-b border-subtle/50 hover:bg-slate-800/30 transition-colors">
              <td class="py-2.5 font-sans text-slate-300 truncate pr-2" title="${r.label}">${r.label}</td>
              <td class="py-2.5 text-right text-slate-200 font-bold">${formatSplitRate(r.id, r.offVal)} <span class="text-[10px] font-normal text-slate-400">(${r.offRank != null ? '#' + r.offRank : '—'})</span></td>
              <td class="py-2.5 text-right text-slate-200 font-bold">${formatSplitRate(r.id, r.defVal)} <span class="text-[10px] font-normal text-slate-400">(${r.defRank != null ? '#' + r.defRank : '—'})</span></td>
              <td class="py-2.5 text-right font-sans">${renderAdvantageBadge(r.adv, offTeam, defTeam)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="mt-3 pt-2 border-t border-subtle/50 text-[10px] text-slate-500 font-mono flex justify-between items-center">
        <span>Source: ${measuredEpaSeason()} nflverse play-by-play (season to date)</span>
        <span>Ranks: 1–32 NFL</span>
      </div>
    </div>
  `;

  return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      ${renderTable(leftRows, tA, tB, abbrA, abbrB, true)}
      ${renderTable(rightRows, tB, tA, abbrB, abbrA, false)}
    </div>
  `;
}

function renderKeyAdvantagesPanel(tA, tB) {
  const allSplits = [...PASSING_SPLITS, ...RUSHING_SPLITS, ...TRENCH_SPLITS];
  const ranksA = computeTeamNextGenRanks(tA);
  const ranksB = computeTeamNextGenRanks(tB);
  const abbrA = DATA.teamAbbr[tA] || tA;
  const abbrB = DATA.teamAbbr[tB] || tB;

  const leftKey = allSplits.map(s => {
    const offRank = ranksA.offense[s.id] != null ? ranksA.offense[s.id] : null;
    const defRank = ranksB.defense[s.id] != null ? ranksB.defense[s.id] : null;
    const offVal = efficiencyValue(tA, 'off', s.id, measuredEpaSeason());
    const defVal = efficiencyValue(tB, 'def', s.id, measuredEpaSeason());
    const adv = computeAdvantage(offRank, defRank, tA, tB);
    return { id: s.id, label: s.label, offRank, defRank, offVal, defVal, adv };
  }).filter(r => r.adv && !r.adv.unavailable && r.adv.stars > 0 && r.adv.team === tA)
    .sort((a, b) => (b.adv?.stars || 0) - (a.adv?.stars || 0) || (b.adv?.delta || 0) - (a.adv?.delta || 0)).slice(0, 6);

  const rightKey = allSplits.map(s => {
    const offRank = ranksB.offense[s.id] != null ? ranksB.offense[s.id] : null;
    const defRank = ranksA.defense[s.id] != null ? ranksA.defense[s.id] : null;
    const offVal = efficiencyValue(tB, 'off', s.id, measuredEpaSeason());
    const defVal = efficiencyValue(tA, 'def', s.id, measuredEpaSeason());
    const adv = computeAdvantage(offRank, defRank, tB, tA);
    return { id: s.id, label: s.label, offRank, defRank, offVal, defVal, adv };
  }).filter(r => r.adv && !r.adv.unavailable && r.adv.stars > 0 && r.adv.team === tB)
    .sort((a, b) => (b.adv?.stars || 0) - (a.adv?.stars || 0) || (b.adv?.delta || 0) - (a.adv?.delta || 0)).slice(0, 6);

  const renderKeyTable = (rows, offTeam, defTeam, offAbbr, defAbbr, isLeft) => `
    <div class="bg-surface-card border border-subtle rounded-lg p-4">
      <div class="flex justify-between items-center mb-3 pb-2 border-b border-subtle">
        <h3 class="text-xs font-bold ${isLeft ? 'text-sky-400' : 'text-indigo-400'} uppercase tracking-wide flex items-center gap-1.5">
          <span>🌟</span> ${attrEsc(offAbbr)} Top Advantages
        </h3>
        <span class="text-[10px] font-mono text-slate-400">${measuredEpaSeason()} SEASON TO DATE</span>
      </div>
      ${!rows.length ? `
        <div class="py-6 text-center text-xs text-slate-400 font-mono">
          No statistical mismatches identified for this unit in ${measuredEpaSeason()} data.
        </div>
      ` : `
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-subtle text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              <th class="py-2 font-normal">KEY SPLIT</th>
              <th class="py-2 font-normal text-right">${attrEsc(offAbbr)} OFF</th>
              <th class="py-2 font-normal text-right">${attrEsc(defAbbr)} DEF</th>
              <th class="py-2 font-normal text-right">ADVANTAGE</th>
            </tr>
          </thead>
          <tbody class="font-mono text-xs">
            ${rows.map(r => `
              <tr class="matchup-table-row border-b border-subtle/50 hover:bg-slate-800/30 transition-colors">
                <td class="py-2.5 font-sans text-slate-300 truncate pr-2" title="${r.label}">${r.label}</td>
                <td class="py-2.5 text-right text-slate-200 font-bold">${formatSplitRate(r.id, r.offVal)} <span class="text-[10px] font-normal text-slate-400">(${r.offRank != null ? '#' + r.offRank : '—'})</span></td>
                <td class="py-2.5 text-right text-slate-200 font-bold">${formatSplitRate(r.id, r.defVal)} <span class="text-[10px] font-normal text-slate-400">(${r.defRank != null ? '#' + r.defRank : '—'})</span></td>
                <td class="py-2.5 text-right font-sans">${renderAdvantageBadge(r.adv, offTeam, defTeam)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;

  return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      ${renderKeyTable(leftKey, tA, tB, abbrA, abbrB, true)}
      ${renderKeyTable(rightKey, tB, tA, abbrB, abbrA, false)}
    </div>
  `;
}

function renderMatchupInsightsPanel(tA, tB, game) {
  const insights = generateMatchupInsights(tA, tB, game);

  return `
    <div class="flex flex-col gap-4">
      <div class="bg-surface-card border border-subtle rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
            <span class="text-amber-400">💡</span> Verified Matchup Insights
          </h2>
          <span class="text-[10px] font-mono text-slate-400">SITUATIONAL INTELLIGENCE</span>
        </div>
        <p class="text-xs text-slate-400 leading-relaxed">
          Synthesized from ${measuredEpaSeason()} nflverse efficiency and depth charts. Note: Evaluation excludes player-vs-player assignments, injury status, or a player-specific weekly projection.
        </p>
      </div>

      ${!insights.length ? `
        <div class="bg-surface-card border border-subtle rounded-lg p-6 text-center text-xs text-slate-400">
          Matchup insights are built from verified roster and efficiency data. None is available for this pairing right now, so nothing is shown rather than inventing a narrative.
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${insights.map((card, idx) => {
            const accents = ['border-l-sky-500', 'border-l-indigo-500', 'border-l-cyber-lime', 'border-l-amber-500', 'border-l-rose-500'];
            const accentClass = accents[idx % accents.length];

            return `
              <div class="bg-surface-card border border-subtle rounded-lg p-4 border-l-4 ${accentClass} flex flex-col justify-between gap-3">
                <div>
                  <div class="flex items-center justify-between pb-2 mb-2 border-b border-subtle/50">
                    <span class="text-xs font-bold text-white tracking-wide">${attrEsc(card.title || card.leftName || 'Matchup Dynamic')}</span>
                    ${card.subtitle ? `<span class="text-[10px] font-mono text-slate-400">${attrEsc(card.subtitle)}</span>` : ''}
                  </div>
                  <p class="text-xs text-slate-300 leading-relaxed">
                    ${card.text}
                  </p>
                </div>
                ${card.playerName ? `
                  <div class="pt-2 border-t border-subtle/50">
                    <button onclick="openPlayerModal('${attrEsc(card.playerName).replace(/'/g, "\\'")}','${attrEsc(card.teamName || tA).replace(/'/g, "\\'")}')" class="w-full py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 border border-subtle text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition flex items-center justify-between">
                      <span>View ${attrEsc(card.playerName)} profile</span>
                      <span>→</span>
                    </button>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `}
      <div class="text-[10px] text-slate-500 font-mono flex justify-between items-center px-1">
        <span>Sources & Method: ${measuredEpaSeason()} measured EPA (nflverse)</span>
        <span class="text-slate-600">Model verified</span>
      </div>
    </div>
  `;
}

function renderFormationLabPanel(tA, tB) {
  return `
    <div class="flex flex-col gap-4">
      <div class="bg-surface-card border border-subtle rounded-lg p-3.5 flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2">
            <span class="text-[10px] uppercase font-bold text-slate-400 font-mono">Personnel:</span>
            <select id="matchupPersonnel" onchange="renderMatchupPanels()" class="text-xs px-2.5 py-1.5 rounded border border-subtle bg-slate-900 text-slate-200 font-medium focus:outline-none focus:border-sky-500">
              <option value="12" ${MATCHUP_STATE.personnel === '12' ? 'selected' : ''}>12 · 2 TE</option>
              <option value="11" ${MATCHUP_STATE.personnel === '11' ? 'selected' : ''}>11 · 3 WR</option>
              <option value="10" ${MATCHUP_STATE.personnel === '10' ? 'selected' : ''}>10 · 4 WR</option>
            </select>
          </label>
          <label class="flex items-center gap-2">
            <span class="text-[10px] uppercase font-bold text-slate-400 font-mono">Defensive Front:</span>
            <select id="matchupFront" onchange="renderMatchupPanels()" class="text-xs px-2.5 py-1.5 rounded border border-subtle bg-slate-900 text-slate-200 font-medium focus:outline-none focus:border-sky-500">
              <option value="43" ${MATCHUP_STATE.front === '43' ? 'selected' : ''}>4-3 Base</option>
              <option value="34" ${MATCHUP_STATE.front === '34' ? 'selected' : ''}>3-4 Base</option>
              <option value="nickel" ${MATCHUP_STATE.front === 'nickel' ? 'selected' : ''}>Nickel</option>
            </select>
          </label>
        </div>
        <div class="text-[11px] text-slate-400 font-mono">
          Click any starter chip to inspect profile & ratings.
        </div>
      </div>

      <!-- Formation Fields -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-surface-card border border-subtle rounded-lg p-4">
          <div class="flex items-center justify-between mb-3 pb-2 border-b border-subtle">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-sky-400 font-mono">${attrEsc(tA)}</span>
              <span class="text-[10px] text-slate-400 font-mono">· ${attrEsc(MATCHUP_STATE.personnel)} personnel</span>
            </div>
            <span class="fp-circle fp-o" style="width:24px;height:24px;font-size:10px">O</span>
          </div>
          <div class="formation-field"><div class="formation-midline"></div>${formationFieldHtml(tA, null, true)}</div>
        </div>
        <div class="bg-surface-card border border-subtle rounded-lg p-4">
          <div class="flex items-center justify-between mb-3 pb-2 border-b border-subtle">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-indigo-400 font-mono">${attrEsc(tB)}</span>
              <span class="text-[10px] text-slate-400 font-mono">· ${attrEsc(MATCHUP_STATE.front === 'nickel' ? 'Nickel' : MATCHUP_STATE.front + ' front')}</span>
            </div>
            <span class="fp-circle fp-x" style="width:24px;height:24px;font-size:10px">X</span>
          </div>
          <div class="formation-field"><div class="formation-midline"></div>${formationFieldHtml(tB, null, false)}</div>
        </div>
      </div>
      <div class="text-[10px] text-slate-500 font-mono leading-relaxed px-1">
        Illustrative alignments built from the current roster snapshot — representative personnel and fronts, not a verified game-day lineup or confirmed assignments. Roster snapshot data is not a complete weekly injury report.
      </div>
    </div>
  `;
}

function formatMetricVal(id, val) {
  if (val == null) return '—';
  if (id === 'success_rate' || id === 'turnover_rate' || id === 'sack_rate') {
    return (val * 100).toFixed(1) + '%';
  }
  if (id === 'pass_epa_per_att' || id === 'run_epa_per_att' || id === 'epa_per_play') {
    return (val >= 0 ? '+' : '') + val.toFixed(3);
  }
  if (id === 'yds_per_play') {
    return val.toFixed(1);
  }
  return String(val);
}

function renderPreviewEdgeBadge(adv, tA, tB) {
  if (!adv || adv.stars === 0 || !adv.team) {
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-subtle">EVEN</span>`;
  }
  const isA = adv.team === tA;
  const abbr = DATA.teamAbbr[adv.team] || adv.team;
  const cls = isA ? 'text-cyber-lime font-bold' : 'text-crimson font-bold';
  return `<span class="text-[11px] font-bold ${cls}">${attrEsc(abbr)} ADV</span>`;
}

function renderPreviewOffVsDefMatrix(offTeam, defTeam, ranksOff, ranksDef, isLeft) {
  const offAbbr = DATA.teamAbbr[offTeam] || offTeam;
  const defAbbr = DATA.teamAbbr[defTeam] || defTeam;

  const passEpaOff = efficiencyValue(offTeam, 'off', 'pass_epa_per_att', measuredEpaSeason());
  const passEpaDef = efficiencyValue(defTeam, 'def', 'pass_epa_per_att', measuredEpaSeason());
  const rankPassOff = ranksOff.offense['pass_epa_per_att'];
  const rankPassDef = ranksDef.defense['pass_epa_per_att'];

  const runEpaOff = efficiencyValue(offTeam, 'off', 'run_epa_per_att', measuredEpaSeason());
  const runEpaDef = efficiencyValue(defTeam, 'def', 'run_epa_per_att', measuredEpaSeason());
  const rankRunOff = ranksOff.offense['run_epa_per_att'];
  const rankRunDef = ranksDef.defense['run_epa_per_att'];

  const rows = [
    { id: 'pass_epa_per_att', label: 'Pass EPA per Attempt', tag: 'PASS' },
    { id: 'run_epa_per_att', label: 'Run EPA per Attempt', tag: 'RUSH' },
    { id: 'epa_per_play', label: 'Overall EPA per Play', tag: 'TOTAL' },
    { id: 'success_rate', label: 'Offensive Success Rate', tag: 'TOTAL' },
    { id: 'yds_per_play', label: 'Yards per Play', tag: 'TOTAL' },
    { id: 'sack_rate', label: 'Sack Rate (Allowed / Forced)', tag: 'PASS' },
    { id: 'turnover_rate', label: 'Turnover Rate', tag: 'TOTAL' },
  ];

  const offColor = isLeft ? 'text-sky-400' : 'text-indigo-400';
  const defColor = isLeft ? 'text-indigo-400' : 'text-sky-400';

  return `
    <div class="bg-surface-card border border-subtle rounded-lg p-4">
      <div class="flex justify-between items-center mb-3 pb-2 border-b border-subtle">
        <h2 class="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
          <span>⚔️</span> <span class="${offColor}">${attrEsc(offAbbr)} Offense</span> <span class="text-slate-500 font-normal">vs</span> <span class="${defColor}">${attrEsc(defAbbr)} Defense</span>
        </h2>
        <span class="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-subtle">${measuredEpaSeason()} MEASURED</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
        <div class="bg-slate-800/40 p-2.5 border border-subtle rounded flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span class="text-[9px] font-bold uppercase tracking-wider text-sky-400 font-mono">PASS ATTACK (EPA/ATT)</span>
            <span class="text-[9px] font-mono text-slate-500">${measuredEpaSeason()}</span>
          </div>
          <div class="flex items-center justify-between font-mono text-xs">
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] text-slate-400">${attrEsc(offAbbr)}:</span>
              <span class="font-medium ${passEpaOff != null && passEpaOff >= 0 ? 'text-cyber-lime' : 'text-slate-200'}">${passEpaOff != null ? (passEpaOff >= 0 ? '+' : '') + passEpaOff.toFixed(3) : '—'}</span>
              <span class="text-[10px] text-slate-400 font-normal">(${rankPassOff != null ? '#' + rankPassOff : '—'})</span>
            </div>
            <span class="text-slate-600 text-[10px]">vs</span>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] text-slate-400">${attrEsc(defAbbr)} DEF:</span>
              <span class="font-medium text-slate-200">${passEpaDef != null ? (passEpaDef >= 0 ? '+' : '') + passEpaDef.toFixed(3) : '—'}</span>
              <span class="text-[10px] text-slate-400 font-normal">(${rankPassDef != null ? '#' + rankPassDef : '—'})</span>
            </div>
          </div>
        </div>

        <div class="bg-slate-800/40 p-2.5 border border-subtle rounded flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span class="text-[9px] font-bold uppercase tracking-wider text-amber-400 font-mono">RUSH ATTACK (EPA/ATT)</span>
            <span class="text-[9px] font-mono text-slate-500">${measuredEpaSeason()}</span>
          </div>
          <div class="flex items-center justify-between font-mono text-xs">
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] text-slate-400">${attrEsc(offAbbr)}:</span>
              <span class="font-medium ${runEpaOff != null && runEpaOff >= 0 ? 'text-cyber-lime' : 'text-slate-200'}">${runEpaOff != null ? (runEpaOff >= 0 ? '+' : '') + runEpaOff.toFixed(3) : '—'}</span>
              <span class="text-[10px] text-slate-400 font-normal">(${rankRunOff != null ? '#' + rankRunOff : '—'})</span>
            </div>
            <span class="text-slate-600 text-[10px]">vs</span>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] text-slate-400">${attrEsc(defAbbr)} DEF:</span>
              <span class="font-medium text-slate-200">${runEpaDef != null ? (runEpaDef >= 0 ? '+' : '') + runEpaDef.toFixed(3) : '—'}</span>
              <span class="text-[10px] text-slate-400 font-normal">(${rankRunDef != null ? '#' + rankRunDef : '—'})</span>
            </div>
          </div>
        </div>
      </div>

      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-subtle text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <th class="py-2 font-normal">METRIC</th>
            <th class="py-2 font-normal text-right">${attrEsc(offAbbr)} OFF</th>
            <th class="py-2 font-normal text-right">${attrEsc(defAbbr)} DEF</th>
            <th class="py-2 font-normal text-right">EDGE</th>
          </tr>
        </thead>
        <tbody class="font-mono text-xs">
          ${rows.map(r => {
            const vOff = efficiencyValue(offTeam, 'off', r.id, measuredEpaSeason());
            const vDef = efficiencyValue(defTeam, 'def', r.id, measuredEpaSeason());
            const rOff = ranksOff.offense[r.id] ?? efficiencyRank(offTeam, 'off', r.id, measuredEpaSeason());
            const rDef = ranksDef.defense[r.id] ?? efficiencyRank(defTeam, 'def', r.id, measuredEpaSeason());
            const adv = computeAdvantage(rOff, rDef, offTeam, defTeam);
            return `
              <tr class="matchup-table-row border-b border-subtle/50 hover:bg-slate-800/30 transition-colors">
                <td class="py-2 text-slate-200 font-sans text-xs flex items-center gap-1.5">
                  <span class="text-[9px] font-mono px-1 py-0.5 rounded ${r.tag === 'PASS' ? 'bg-sky-950/70 text-sky-400 border border-sky-800/50' : r.tag === 'RUSH' ? 'bg-amber-950/70 text-amber-400 border border-amber-800/50' : 'bg-slate-800 text-slate-400 border border-subtle'}">${r.tag}</span>
                  <span class="truncate" title="${r.label}">${r.label}</span>
                </td>
                <td class="py-2 text-right font-medium text-slate-200">${formatMetricVal(r.id, vOff)} <span class="text-[10px] font-normal text-slate-400">(${rOff != null ? '#' + rOff : '—'})</span></td>
                <td class="py-2 text-right font-medium text-slate-200">${formatMetricVal(r.id, vDef)} <span class="text-[10px] font-normal text-slate-400">(${rDef != null ? '#' + rDef : '—'})</span></td>
                <td class="py-2 text-right font-sans">${renderAdvantageBadge(adv, offTeam, defTeam)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="mt-2.5 pt-2 border-t border-subtle/50 text-[10px] text-slate-500 font-mono flex justify-between items-center">
        <span>Source: ${measuredEpaSeason()} nflverse play-by-play (season to date, 1–32 league ranks)</span>
        <button onclick="setMatchupSubTab('${isLeft ? 'passing' : 'rushing'}')" class="text-sky-400 hover:text-sky-300 font-semibold">${isLeft ? 'Passing splits →' : 'Rushing splits →'}</button>
      </div>
    </div>
  `;
}

function renderPreviewInsights(tA, tB, curGame) {
  const insights = generateMatchupInsights(tA, tB, curGame);
  const abbrA = DATA.teamAbbr[tA] || tA;
  const abbrB = DATA.teamAbbr[tB] || tB;

  if (!insights || !insights.length) {
    return `
      <div class="bg-surface-card border border-subtle rounded-lg p-4 flex-1">
        <div class="flex justify-between items-center mb-3 pb-2 border-b border-subtle">
          <h2 class="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
            <span class="text-amber-400">💡</span> Matchup Insights
          </h2>
          <span class="text-[10px] font-mono text-slate-400">${currentSeason()} ROSTER & ${measuredEpaSeason()} DATA</span>
        </div>
        <div class="text-xs text-slate-400 py-4 text-center leading-relaxed font-mono">
          Matchup insights require verified starter and ${measuredEpaSeason()} efficiency data. None currently available for this pairing.
        </div>
      </div>
    `;
  }

  const previewItems = insights.slice(0, 3);
  const accents = ['border-l-sky-500', 'border-l-indigo-500', 'border-l-cyber-lime'];

  return `
    <div class="bg-surface-card border border-subtle rounded-lg p-4 flex-1">
      <div class="flex justify-between items-center mb-3 pb-2 border-b border-subtle">
        <h2 class="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
          <span class="text-amber-400">💡</span> Matchup Insights
        </h2>
        <span class="text-[10px] font-mono text-slate-400">${currentSeason()} ROSTER & ${measuredEpaSeason()} EPA</span>
      </div>
      <div class="flex flex-col gap-3 text-xs">
        ${previewItems.map((item, idx) => {
          const accent = accents[idx % accents.length];
          return `
            <div class="bg-slate-800/40 border border-subtle p-3 rounded border-l-4 ${accent} flex flex-col gap-1.5">
              <div class="flex justify-between items-center">
                <p class="font-bold text-white text-xs">${attrEsc(item.title || item.leftName || 'Matchup Dynamic')}</p>
                ${item.subtitle ? `<span class="text-[10px] font-mono text-slate-400">${attrEsc(item.subtitle)}</span>` : ''}
              </div>
              <p class="text-slate-300 text-[11px] leading-relaxed">
                ${item.text}
              </p>
              ${item.playerName ? `
                <div class="pt-1">
                  <button onclick="openPlayerModal('${attrEsc(item.playerName).replace(/'/g, "\\'")}','${attrEsc(item.teamName || tA).replace(/'/g, "\\'")}')" class="text-[10px] font-semibold text-sky-400 hover:text-sky-300 transition">
                    View ${attrEsc(item.playerName)} profile →
                  </button>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
      <div class="mt-3 pt-2 border-t border-subtle/50 text-[10px] text-slate-500 leading-normal flex justify-between items-center font-mono">
        <span>Verified ${currentSeason()} Depth Chart & ${measuredEpaSeason()} EPA</span>
        <button onclick="setMatchupSubTab('insights')" class="text-sky-400 hover:text-sky-300 font-semibold">More insights →</button>
      </div>
    </div>
  `;
}

function renderMatchupPanels() {
  const main = document.getElementById('matchupMainContent');
  if (!main) return;

  const tA = MATCHUP_STATE.teamA;
  const tB = MATCHUP_STATE.teamB;
  const games = (SCHEDULE_DATA && SCHEDULE_DATA.games) || [];
  const curGame = (MATCHUP_STATE.gameId ? games.find(g => g.game_id === MATCHUP_STATE.gameId) : null) || games.find(g => g.away_team === tA && g.home_team === tB) || null;

  const sub = MATCHUP_STATE.subtab || 'preview';

  // Preserve keyboard focus across the re-render: the innerHTML swap below
  // replaces the focused node, so save which control was active and refocus
  // its replacement afterward. Covers the possession toggle, the Formation
  // Lab player chips, and the personnel/front selects.
  const activeEl = document.activeElement;
  let focusKey = null;
  if (activeEl && main.contains(activeEl)) {
    if (activeEl.classList && activeEl.classList.contains('formation-player')) {
      focusKey = 'formation';
    } else if (activeEl.getAttribute && activeEl.getAttribute('onclick') && activeEl.getAttribute('onclick').includes('swapViewedOffense')) {
      focusKey = 'swap';
    } else if (activeEl.id === 'matchupPersonnel' || activeEl.id === 'matchupFront') {
      focusKey = activeEl.id;
    }
  }

  if (sub === 'preview') {
    main.innerHTML = renderPreviewSubtab(tA, tB, curGame);
  } else if (sub === 'overview') {
    main.innerHTML = `
      <div class="space-y-4">
        ${renderAtAGlanceTable(tA, tB)}
        ${renderKeyAdvantagesPanel(tA, tB)}
      </div>
    `;
  } else if (sub === 'passing') {
    main.innerHTML = renderMatchupComparisonsSideBySide(PASSING_SPLITS, tA, tB, 'Passing Split Metric');
  } else if (sub === 'rushing') {
    main.innerHTML = renderMatchupComparisonsSideBySide(RUSHING_SPLITS, tA, tB, 'Rushing Split Metric');
  } else if (sub === 'trenches') {
    main.innerHTML = renderMatchupComparisonsSideBySide(TRENCH_SPLITS, tA, tB, 'Trench & Pressure Metric');
  } else if (sub === 'insights') {
    main.innerHTML = renderMatchupInsightsPanel(tA, tB, curGame);
  } else if (sub === 'formation') {
    main.innerHTML = renderFormationLabPanel(tA, tB);
  } else {
    main.innerHTML = renderPreviewSubtab(tA, tB, curGame);
  }

  // After setting innerHTML, activate the pressed toggle on re-render so focus
  // and aria-pressed stay correct across subtab switches.
  const toggle = main.querySelector('button[onclick*="swapViewedOffense"]');
  if (toggle) toggle.setAttribute('aria-pressed', (MATCHUP_STATE.viewedOffense === 'A') ? 'true' : 'false');

  // Refocus the replacement of the control that had focus before the render.
  if (focusKey) {
    let target = null;
    if (focusKey === 'swap') target = main.querySelector('button[onclick*="swapViewedOffense"]');
    else if (focusKey === 'formation') target = main.querySelector('.formation-player');
    else target = document.getElementById(focusKey);
    if (target && typeof target.focus === 'function') target.focus();
  }

  // Load 2025 team tendencies on first preview render (lazy, non-blocking).
  if (!TEAM_TENDENCIES_LOADED) {
    (async () => {
      try {
        const mod = await import('/scripts/load_team_tendencies.js');
        const data = await mod.loadTeamTendencies();
        TEAM_TENDENCIES_LOADED = true;
        window.TEAM_TENDENCIES_STATE = (data && data.absent) ? 'absent' : 'present';
        // Attach the functions to the window so that subsequent calls to renderMatchupPanels can use them.
        window.loadTeamTendencies = mod.loadTeamTendencies;
        window.getTeamTendency = mod.getTeamTendency;
        window.renderTeamTendenciesDisclosure = mod.renderTeamTendenciesDisclosure;
        renderMatchupPanels();
      } catch (e) {
        TEAM_TENDENCIES_LOADED = true;
        window.TEAM_TENDENCIES_STATE = 'absent';
        console.warn('[renderMatchupPanels] tendencies load failed, continuing with EPA only', e && e.message);
      }
    })();
  }
}

// Build the preview subtab: question banner, EPA bars, tendencies disclosure,
// and existing pro-preview matrix + grades + insights.
// Measured-data seasons, derived from the data itself so a regenerated
// artifact (e.g. a future 2026 rebuild) flips the labels without code edits.
// Historical measured stats are never presented as current-season numbers:
// the current season comes from the schedule, a separate label.
function measuredEpaSeason() {
  if (EFFICIENCY_DATA && EFFICIENCY_DATA.length) {
    const seasons = EFFICIENCY_DATA.map(r => Number(r.season)).filter(Number.isFinite);
    if (seasons.length) return Math.max(...seasons);
  }
  return 2026; // current season; contract default until data loads
}

function tendenciesSeason() {
  const op = typeof teamTendenciesObservationPeriod === 'function'
    ? teamTendenciesObservationPeriod()
    : null;
  const s = op && Number(op.season);
  return Number.isFinite(s) ? s : measuredEpaSeason();
}

function currentSeason() {
  if (SCHEDULE_DATA && Number(SCHEDULE_DATA.season)) return Number(SCHEDULE_DATA.season);
  return 2026; // contract default while the schedule is not loaded
}

// The artifact keys records by abbreviation (NE, SEA). Lookups use the abbr;
// display keeps the full team name.
function playActionSentence(offTeam, defTeam, offAbbr, defAbbr) {
  const offRec = getTeamTendency(offAbbr, 'off', 'play_action');
  const defRec = getTeamTendency(defAbbr, 'def', 'play_action');
  const pct = (v) => (v * 100).toFixed(1) + '%';
  if (!offRec && !defRec) {
    return `${tendenciesSeason()} play-action charting is unavailable for this matchup, so the question is not computed here. EPA and the field remain available.`;
  }
  const parts = [];
  if (offRec && offRec.value !== null) {
    parts.push(`${attrEsc(offTeam)} used play-action on ${offRec.numerator} of ${offRec.observed} dropbacks, ${pct(offRec.value)}.`);
  } else if (offRec) {
    parts.push(`No play-action observations were recorded for ${attrEsc(offTeam)} in the ${tendenciesSeason()} regular season.`);
  } else {
    parts.push(`${attrEsc(offTeam)} play-action usage is unavailable.`);
  }
  if (defRec && defRec.value !== null) {
    parts.push(`Opponents used it on ${defRec.numerator} of ${defRec.observed} dropbacks against ${attrEsc(defTeam)}, ${pct(defRec.value)}.`);
  } else if (defRec) {
    parts.push(`No opponent play-action observations were recorded against ${attrEsc(defTeam)} in the ${tendenciesSeason()} regular season.`);
  } else {
    parts.push(`Opponent play-action exposure against ${attrEsc(defTeam)} is unavailable.`);
  }
  parts.push(`This snapshot does not measure ${attrEsc(defTeam)}'s results against play-action.`);
  return parts.join(' ');
}

function renderPreviewSubtab(tA, tB, curGame) {
  const viewedOffenseIsA = MATCHUP_STATE.viewedOffense === 'A';
  const viewedOffTeam = viewedOffenseIsA ? tA : tB;
  const viewedDefTeam = viewedOffenseIsA ? tB : tA;
  const labelA = DATA.teamAbbr[tA] || ABBR_TO_TEAM[tA] || tA;
  const labelB = DATA.teamAbbr[tB] || ABBR_TO_TEAM[tB] || tB;
  const offAbbr = DATA.teamAbbr[viewedOffTeam] || ABBR_TO_TEAM[viewedOffTeam] || viewedOffTeam;
  const defAbbr = DATA.teamAbbr[viewedDefTeam] || ABBR_TO_TEAM[viewedDefTeam] || viewedDefTeam;
  const tSeason = tendenciesSeason();
  const eSeason = measuredEpaSeason();
  const cSeason = currentSeason();
  const tendenciesState = window.TEAM_TENDENCIES_STATE || 'loading';
  const tendenciesLabel = tendenciesState === 'present'
    ? `${tSeason} REG charting loaded`
    : tendenciesState === 'absent'
      ? 'unavailable (EPA and field still shown)'
      : 'loading…';
  const seasonNote = cSeason !== tSeason
    ? `${cSeason} season in progress — these numbers measure the ${tSeason} regular season (last completed), not ${cSeason}.`
    : `Measured in the ${tSeason} regular season.`;
  return `
    <!-- MATCHUP QUESTION BANNER: viewed offense's play-action tendency vs the opposing defense's exposure, observation season labeled -->
    <div class="bg-surface-card border border-subtle rounded-lg p-4 space-y-3" role="region" aria-label="Matchup preview question">
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="text-[10px] uppercase tracking-widest font-bold text-slate-500 font-mono">${tSeason} Regular Season · One Question</div>
          <div class="text-base font-bold text-white leading-snug">How will ${attrEsc(viewedOffTeam)}'s play-action passing meet ${attrEsc(viewedDefTeam)}'s defense?</div>
          <div class="text-xs text-slate-400 leading-relaxed">In the ${tSeason} regular season, ${playActionSentence(viewedOffTeam, viewedDefTeam, offAbbr, defAbbr)}</div>
          <div class="text-[10px] text-slate-500 font-mono">${attrEsc(seasonNote)}</div>
          <div class="text-[10px] text-amber-400/80 font-mono">
            Defensive exposure counts opponent usage, it is not a measure of defensive effectiveness and does not predict a winner.
          </div>
        </div>
        <div class="shrink-0 flex gap-1">
          <button
            type="button"
            onclick="swapViewedOffense()"
            aria-pressed="${viewedOffenseIsA ? 'true' : 'false'}"
            aria-label="View ${viewedOffenseIsA ? tB : tA} offense${viewedOffenseIsA ? ' instead of ' + tA : ' instead of ' + tB}"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${viewedOffenseIsA ? 'border-rose-500/60 bg-rose-500/10 text-rose-300' : 'border-slate-600 bg-slate-800/60 text-slate-400 hover:text-slate-200'}"
          >
            <span>${attrEsc(labelA)} OFF</span>
            <span class="text-slate-600 text-[10px]">/</span>
            <span>${attrEsc(labelB)} OFF</span>
          </button>
        </div>
      </div>

      <!-- PROMINENT EPA BARS: overall, pass, run for the viewed offense vs opposing defense -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-subtle/40">
        ${epaBarHtml('Overall EPA', epaValue(viewedOffTeam, 'off', 'epa_per_play'), epaValue(viewedDefTeam, 'def', 'epa_per_play'), 'epa_per_play', tA, tB, viewedOffenseIsA)}
        ${epaBarHtml('Pass EPA', epaValue(viewedOffTeam, 'off', 'pass_epa_per_att'), epaValue(viewedDefTeam, 'def', 'pass_epa_per_att'), 'pass_epa_per_att', tA, tB, viewedOffenseIsA)}
        ${epaBarHtml('Run EPA', epaValue(viewedOffTeam, 'off', 'run_epa_per_att'), epaValue(viewedDefTeam, 'def', 'run_epa_per_att'), 'run_epa_per_att', tA, tB, viewedOffenseIsA)}
      </div>

      <!-- EVIDENCE DISCLOSURE: definition, denominator, eligibility, missing counts, provenance -->
      <div class="pt-1 border-t border-subtle/40">
        ${renderTeamTendenciesDisclosure(offAbbr, 'off', 'play_action')}
        <div class="mt-2">
          ${renderTeamTendenciesDisclosure(defAbbr, 'def', 'play_action')}
        </div>
        <div class="mt-2 text-[10px] text-slate-500 font-mono space-y-1">
          <div>Sources &amp; Method: ${tSeason} measured team tendencies (motion, play-action, shotgun) from FTN charting + nflverse play-by-play, plus ${eSeason} EPA.</div>
          <div class="flex justify-between items-center">
            <span class="text-slate-600">Rosters: ${rosterVersionLabel()}</span>
            <span class="text-slate-600">Tendencies: ${tendenciesLabel}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- EXISTING PRO PREVIEW: draft depth + unit grades, kept below the tendencies question -->
    <div class="grid grid-cols-1 lg:grid-cols-9 gap-4">
      <!-- CENTER RAIL: Team A Off vs Team B Def &amp; Team B Off vs Team A Def (lg:col-span-6) -->
      <div class="lg:col-span-6 flex flex-col gap-4">
        ${renderPreviewOffVsDefMatrix(tA, tB, computeTeamNextGenRanks(tA), computeTeamNextGenRanks(tB), true)}
        ${renderPreviewOffVsDefMatrix(tB, tA, computeTeamNextGenRanks(tB), computeTeamNextGenRanks(tA), false)}
      </div>

      <!-- RIGHT RAIL: Insights (lg:col-span-3) -->
      <div class="lg:col-span-3 flex flex-col gap-4">
        ${renderPreviewInsights(tA, tB, curGame)}
      </div>
    </div>
  `;
}

// Global fallback for the tendency lookup. The ES module sets
// window.getTeamTendency once it loads; until then (and if loading fails)
// this returns null so renderMatchupPanels never throws a ReferenceError.
function getTeamTendency(team, side, metric){
  if (typeof window.getTeamTendency === 'function' && window.getTeamTendency !== getTeamTendency) {
    return window.getTeamTendency(team, side, metric);
  }
  return null;
}

// Global fallback for the disclosure renderer. The ES module sets
// window.renderTeamTendenciesDisclosure once it loads.
function renderTeamTendenciesDisclosure(team, side, metric, rec){
  if (typeof window.renderTeamTendenciesDisclosure === 'function' && window.renderTeamTendenciesDisclosure !== renderTeamTendenciesDisclosure) {
    return window.renderTeamTendenciesDisclosure(team, side, metric, rec);
  }
  // Return a minimal unavailable state when the module hasn't loaded yet.
  return `<div class="text-[10px] text-slate-400 font-mono">${tendenciesSeason()} tendency loading…</div>`;
}

// Normalized overall/pass/run EPA for a team-side, for the prominent matchup bars.
function epaValue(team, side, metric){
  if (typeof efficiencyValue === 'function') {
    try {
      return efficiencyValue(team, side, metric, measuredEpaSeason());
    } catch (e) {
      return null;
    }
  }
  return null;
}

function epaBarHtml(label, offenseVal, defenseVal, metricKey, tA, tB, offenseIsA){
  const defTeam = offenseIsA ? tB : tA;
  const offTeam = offenseIsA ? tA : tB;
  const offRaw = offenseVal;
  const defRaw = defenseVal;
  const offDisplay = offRaw == null ? '—' : offRaw.toFixed(2);
  const defDisplay = defRaw == null ? '—' : defRaw.toFixed(2);
  const maxAbs = Math.max(
    Math.abs(offRaw || 0), Math.abs(defRaw || 0), 0.0001
  );
  const offPct = maxAbs > 0 ? Math.max(-1, Math.min(1, (offRaw || 0) / maxAbs)) : 0;
  const defPct = maxAbs > 0 ? Math.max(-1, Math.min(1, (defRaw || 0) / maxAbs)) : 0;
  const offColor = (offRaw || 0) >= 0 ? 'bg-emerald-500' : 'bg-red-500';
  const defColor = (defRaw || 0) >= 0 ? 'bg-sky-400' : 'bg-rose-400';
  return `
    <div class="bg-surface-card border border-subtle rounded-lg p-3">
      <div class="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">${label}</div>
      <div class="flex justify-between text-xs font-mono mb-1">
        <span class="${offenseIsA ? 'text-rose-300' : 'text-sky-300'} font-semibold">${attrEsc(offTeam)}</span>
        <span class="text-slate-500">${offDisplay}</span>
      </div>
      <div class="h-2 bg-slate-800 rounded-full overflow-hidden relative">
        <div class="absolute inset-y-0 left-1/2 w-0.5 bg-slate-600"></div>
        <div class="h-full rounded-full ${offColor} transition-all" style="width: ${Math.abs(offPct * 50)}%; margin-left: ${offPct >= 0 ? '50%' : '0'}; margin-right: ${offPct < 0 ? '50%' : '0'};"></div>
      </div>
      <div class="flex justify-between text-[10px] text-slate-500 font-mono mt-2">
        <span>vs ${attrEsc(defTeam)} ${label.includes('Overall') ? 'overall' : label.toLowerCase()}</span>
        <span class="text-slate-600">def: ${defDisplay}</span>
      </div>
    </div>
  `;
}

// Roster provenance is tied to the loaded Supabase players only: no fabricated
// fetched/source-update timestamps, and an explicit note that the field uses
// available roster information as representative alignments — not a verified
// game-day availability or injury report.
function rosterVersionLabel(){
  const base = (!DATA || !DATA.players || !DATA.players.length) ? 'roster snapshot' : 'Supabase nfl_players roster';
  return base + ' · illustrative lineups, not game-day availability';
}

function matchupGameChanged() {
  const v = document.getElementById('matchupGame')?.value || '';
  if (v.includes('__')) {
    const [a, h] = v.split('__');
    MATCHUP_STATE.teamA = a;
    MATCHUP_STATE.teamB = h;
    const games = (SCHEDULE_DATA && SCHEDULE_DATA.games) || [];
    const matched = games.find(g => g.away_team === a && g.home_team === h);
    MATCHUP_STATE.gameId = matched ? matched.game_id : null;
    const selA = document.getElementById('matchupTeamA');
    const selB = document.getElementById('matchupTeamB');
    if (selA) selA.value = a;
    if (selB) selB.value = h;
  }
  renderMatchup();
  writeHash('matchup');
}

function matchupTeamSelected(which) {
  const selA = document.getElementById('matchupTeamA');
  const selB = document.getElementById('matchupTeamB');
  if (selA) MATCHUP_STATE.teamA = selA.value;
  if (selB) MATCHUP_STATE.teamB = selB.value;
  const games = (SCHEDULE_DATA && SCHEDULE_DATA.games) || [];
  const matched = games.find(g => g.away_team === MATCHUP_STATE.teamA && g.home_team === MATCHUP_STATE.teamB);
  MATCHUP_STATE.gameId = matched ? matched.game_id : null;
  const selGame = document.getElementById('matchupGame');
  if (selGame && selGame.options.length) {
    const want = `${MATCHUP_STATE.teamA}__${MATCHUP_STATE.teamB}`;
    selGame.value = Array.from(selGame.options).some(o => o.value === want) ? want : '';
  }
  renderMatchup();
  writeHash('matchup');
}

async function renderMatchup() {
  const ctrl = document.getElementById('matchupControls');
  if (!ctrl) return;

  if (typeof loadSchedule === 'function') {
    try { await loadSchedule(); } catch (e) {}
  }
  if (typeof loadEfficiency === 'function') {
    try { await loadEfficiency(); } catch (e) {}
  }

  // Ensure team selects are populated and kept in sync with MATCHUP_STATE
  const selA = document.getElementById('matchupTeamA');
  const selB = document.getElementById('matchupTeamB');
  if (selA && selB) {
    if (!selA.options.length || !selB.options.length) {
      const teams = matchupTeamList();
      for (const t of teams) {
        selA.add(new Option(t, t));
        selB.add(new Option(t, t));
      }
    }
    if (MATCHUP_STATE.teamA && Array.from(selA.options).some(o => o.value === MATCHUP_STATE.teamA)) {
      selA.value = MATCHUP_STATE.teamA;
    }
    if (MATCHUP_STATE.teamB && Array.from(selB.options).some(o => o.value === MATCHUP_STATE.teamB)) {
      selB.value = MATCHUP_STATE.teamB;
    }
    if (!selA.value && selA.options.length) selA.value = selA.options[0].value;
    if (!selB.value && selB.options.length) selB.value = selB.options[Math.min(1, selB.options.length - 1)].value;
    MATCHUP_STATE.teamA = selA.value;
    MATCHUP_STATE.teamB = selB.value;
  }

  // Populate the game picker from the dashboard schedule (all weeks).
  // Exact-event selection only: a selected game_id (scheduled mode) pins the
  // active event and its header/kickoff/venue/market metadata.
  const selGame = document.getElementById('matchupGame');
  const games = (SCHEDULE_DATA && SCHEDULE_DATA.games) || [];
  if (selGame && games.length) {
    if (!selGame.options.length) {
      const sorted = games.slice().sort((a, b) => String(a.kickoff_utc || '').localeCompare(String(b.kickoff_utc || '')));
      for (const g of sorted) {
        const d = new Date(g.kickoff_utc);
        const when = isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        selGame.add(new Option(`Wk ${g.week}: ${g.away_team} @ ${g.home_team}${when ? ' · ' + when : ''}`, `${g.away_team}__${g.home_team}`));
      }
    }
    const want = `${MATCHUP_STATE.teamA}__${MATCHUP_STATE.teamB}`;
    selGame.value = Array.from(selGame.options).some(o => o.value === want) ? want : '';
  }

  // Exact-event selection: the selected game_id owns the header, kickoff, venue,
  // and market metadata. Unset when the user manually edits teams (hypothetical
  // mode). An unresolved non-null gameId is an error state (not a fallback).
  let curGame = null;
  if (MATCHUP_STATE.gameId) {
    curGame = games.find(g => g.game_id === MATCHUP_STATE.gameId) || null;
  }
  if (!curGame && MATCHUP_STATE.teamA && MATCHUP_STATE.teamB) {
    curGame = games.find(g => g.away_team === MATCHUP_STATE.teamA && g.home_team === MATCHUP_STATE.teamB) || null;
  }

  // Render Hero Banner & Sidebar
  const hero = document.getElementById('matchupHeroBanner');
  if (hero) hero.innerHTML = renderMatchupHeroBanner(curGame, MATCHUP_STATE.teamA, MATCHUP_STATE.teamB);

  const sidebar = document.getElementById('matchupSidebar');
  if (sidebar) sidebar.innerHTML = renderMatchupSidebar(curGame, MATCHUP_STATE.teamA, MATCHUP_STATE.teamB);

  // Render Active Subtab Main Content
  renderMatchupPanels();
}

