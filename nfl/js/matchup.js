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
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`subtab-${subtab}`);
  if (activeBtn) activeBtn.classList.add('active');
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

// One starter on the Formation Lab field. The disc carries the slot (LT, WR,
// CB) in the team's colour, filled for the offense and outlined for the
// defense; the name and "position · Madden OVR" sit under it. An empty slot
// means the roster snapshot has no player for it.
// The snap-count team for a roster team name, or null when the artifact is
// missing or has no row for it.
function snapTeamFor(teamName) {
  const t = typeof nflTeamByName === 'function' ? nflTeamByName(teamName) : null;
  return (t && LEAGUE_SNAPS && LEAGUE_SNAPS.teams && LEAGUE_SNAPS.teams[t.abbr]) || null;
}

// One starter on the Formation Lab field. The disc carries the slot (LT, WR,
// CB) in the team's colour, filled for the offense and outlined for the
// defense. Under the name: the share of snaps he played over the team's last
// three games when snap counts are loaded, else the Madden overall.
function formationPlayerHtml(p, isOffense, slot, look, teamName) {
  const side = isOffense ? 'fp-o' : 'fp-x';
  const tint = look ? ` style="--c:${look.fill};--ci:${isOffense ? look.on : look.ink}"` : '';
  if (!p) {
    return `<div class="formation-player empty" title="No ${attrEsc(slot)} found"><span class="fp-circle ${side}">${attrEsc(slot)}</span><span class="fp-name">—</span><span class="fp-meta">no player</span></div>`;
  }
  const escName = attrEsc(p.name);
  const escTeam = attrEsc(teamName || teamNameOf(p));
  const pos = String(p.pos || '');
  const snap = p.last3 != null;
  const value = snap ? p.last3 + '%' : (p.ovr || '—');
  const meta = (pos && pos !== slot ? attrEsc(pos) + ' · ' : '') + attrEsc(value);
  const label = snap ? `${p.name} · ${pos} · ${p.last3}% of snaps, last 3 games (${p.season}% season)` : `${p.name} · ${pos} · OVR ${value}`;
  const openPlayer = `openPlayerModal('${escName.replace(/'/g, "\\'")}','${escTeam.replace(/'/g, "\\'")}')`;
  return `<div class="formation-player" tabindex="0" role="button" aria-label="${attrEsc(label)}" onclick="${openPlayer}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${openPlayer}}" title="${attrEsc(label)}">
    <span class="fp-circle ${side}"${tint}>${attrEsc(slot || pos)}</span>
    <span class="fp-name">${escName}</span>
    <span class="fp-meta">${meta}</span>
  </div>`;
}

function formationFieldHtml(team, look, isOffense) {
  const used = {};
  const rows = [];
  const row = (picks) => rows.push(`<div class="mu-fr" style="--n:${picks.length}">${picks.join('')}</div>`);
  const snaps = snapTeamFor(team);
  const chip = (p, slot) => formationPlayerHtml(p, isOffense, slot, look, team);
  if (isOffense) {
    const skill = MATCHUP_OFFENSE[MATCHUP_STATE.personnel] || MATCHUP_OFFENSE['12'];
    const slots = [...skill, ...MATCHUP_OL_SLOTS, { slot: 'QB', pos: ['QB'] }, { slot: 'RB', pos: ['RB'] }];
    const picks = snaps ? nflLib.snapStarters(snaps, slots, 'off') : slots.map(s => pickStarter(team, s.pos, used));
    const n = skill.length, ol = MATCHUP_OL_SLOTS.length;
    row(picks.slice(0, n).map((p, i) => chip(p, slots[i].slot)));
    row(picks.slice(n, n + ol).map((p, i) => chip(p, slots[n + i].slot)));
    row([chip(picks[n + ol], 'QB'), chip(picks[n + ol + 1], 'RB')]);
  } else {
    const def = MATCHUP_DEFENSE[MATCHUP_STATE.front] || MATCHUP_DEFENSE['43'];
    const defPicks = snaps ? nflLib.snapStarters(snaps, def, 'def') : def.map(s => pickStarter(team, s.pos, used));
    const back = [], lbs = [], dls = [];
    defPicks.forEach((p, i) => {
      const slot = def[i].slot;
      if (slot === 'CB' || slot === 'S') back.push(chip(p, slot));
      else if (slot === 'LB') lbs.push(chip(p, slot));
      else dls.push(chip(p, slot));
    });
    row(back);
    row(lbs);
    row(dls);
  }
  return `<div class="mu-frs ${isOffense ? 'off' : 'def'}">${rows.join('')}</div>`;
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

// ── Shared pieces for the seven sub-tabs ──────────────────────────────────
// The /nba/ game-page grammar (styles in nfl/matchup.css): values on the
// outside, bars that grow from the centre in each team's colour, league ranks
// as small grey ordinals, and a quiet chip in the leading team's colour for
// the edge. Gold stays on controls.

// Team name, abbreviation and colours for both pickers. `fill` paints bars,
// discs and chips, `on` is text on that fill, `ink` is the team colour lifted
// until it reads on the dark card.
function muLooks(tA, tB) {
  const find = name => (typeof nflTeamByName === 'function' ? nflTeamByName(name) : null);
  const teamA = find(tA);
  const teamB = find(tB);
  const lib = typeof nflLib !== 'undefined' && nflLib ? nflLib : null;
  let looks;
  if (lib && teamA && teamB) {
    looks = lib.separateLooks(lib.teamLook(teamA), lib.teamLook(teamB));
  } else {
    const plain = name => ({ fill: (DATA.teamColors && DATA.teamColors[name]) || '#3b4261', ink: '#ffffff' });
    looks = [plain(tA), plain(tB)];
  }
  const side = (name, team, look) => ({
    name,
    abbr: (team && team.abbr) || DATA.teamAbbr[name] || name,
    fill: look.fill,
    on: look.ink,
    ink: lib ? lib.readableOn(look.fill, '#14161a') : 'var(--text-main)',
  });
  const a = side(tA, teamA, looks[0]);
  const b = side(tB, teamB, looks[1]);
  return { a, b, [tB]: b, [tA]: a };
}

function muOrd(rank) {
  if (rank == null) return '';
  return typeof nflLib !== 'undefined' && nflLib ? nflLib.ordinal(rank) : rank + getOrdinal(rank);
}

function muAbbr(t) {
  return `<span class="mu-ab" style="color:${t.ink}">${attrEsc(t.abbr)}</span>`;
}

// How many teams carry this metric in the measured season (the rank's "of").
function muRankCount(side, metric) {
  const season = measuredEpaSeason();
  const n = (EFFICIENCY_DATA || []).filter(r => r.season === season && r.side === side &&
    r[metric] != null && Number.isFinite(Number(r[metric]))).length;
  return n || 32;
}

// Bar length from a league rank: 1st fills the half, last keeps a sliver.
function muRankShare(rank, count) {
  if (rank == null || !count) return 0;
  return Math.max(0.08, (count - rank + 1) / count);
}

function muVal(side, text, rank, lead) {
  return `<b class="mu-v ${side}${lead ? ' lead' : ''}">${attrEsc(text)}${rank != null ? `<small>${muOrd(rank)}</small>` : ''}</b>`;
}

function muBar(side, share, fill, lead) {
  return `<span class="mu-bar ${side}${lead ? ' lead' : ''}"><i style="width:${Math.round(share * 100)}%;background:${fill}"></i></span>`;
}

// The edge from computeAdvantage as a chip in the leading team's colour:
// abbreviation plus the star tier (capped at three, as before).
function renderAdvantageBadge(adv, L) {
  if (!adv || adv.unavailable) {
    return `<span class="mu-edge none" title="Edge unavailable: one of the two ranks is missing">—</span>`;
  }
  if (adv.stars === 0 || !adv.team || !L[adv.team]) {
    return `<span class="mu-edge none" title="Same league rank">Even</span>`;
  }
  const t = L[adv.team];
  const stars = '★'.repeat(Math.min(3, adv.stars));
  return `<span class="mu-edge" style="--c:${t.fill};color:${t.ink}" title="${attrEsc(t.abbr)} advantage: ${adv.delta} places apart in the league ranks" aria-label="${attrEsc(t.abbr)} advantage, ${Math.min(3, adv.stars)} of 3 stars">${attrEsc(t.abbr)}<span class="w"> ADV</span> <i>${stars}</i></span>`;
}

// Offense-vs-defense rows for a list of metrics: values, league ranks and the
// edge, all from the measured nflverse season.
function muDuelRows(splits, offTeam, defTeam) {
  const season = measuredEpaSeason();
  return splits.map(s => {
    const offRank = efficiencyRank(offTeam, 'off', s.id, season);
    const defRank = efficiencyRank(defTeam, 'def', s.id, season);
    return {
      id: s.id,
      label: s.label,
      tag: s.tag || '',
      offRank,
      defRank,
      offVal: efficiencyValue(offTeam, 'off', s.id, season),
      defVal: efficiencyValue(defTeam, 'def', s.id, season),
      adv: computeAdvantage(offRank, defRank, offTeam, defTeam),
    };
  });
}

// One row: offense value and bar on the left, defense on the right. Bars are
// each unit's league standing (1st = full), so the longer bar is the edge.
function muDuelRowHtml(r, L, offTeam, defTeam) {
  const off = L[offTeam];
  const def = L[defTeam];
  const lead = r.adv && r.adv.team ? (r.adv.team === offTeam ? 'a' : 'b') : '';
  return `<div class="mu-tr matchup-table-row">` +
    muVal('a', formatSplitRate(r.id, r.offVal), r.offRank, lead === 'a') +
    muBar('a', muRankShare(r.offRank, muRankCount('off', r.id)), off.fill, lead === 'a') +
    `<span class="mu-k"><span>${r.tag ? `<em>${attrEsc(r.tag)}</em>` : ''}${attrEsc(r.label)}</span>${renderAdvantageBadge(r.adv, L)}</span>` +
    muBar('b', muRankShare(r.defRank, muRankCount('def', r.id)), def.fill, lead === 'b') +
    muVal('b', formatSplitRate(r.id, r.defVal), r.defRank, lead === 'b') +
    `</div>`;
}

function muDuelHeadHtml(L, offTeam, defTeam, middle) {
  return `<div class="mu-th"><span class="a">${muAbbr(L[offTeam])} off</span><span class="k">${middle}</span><span class="b">${muAbbr(L[defTeam])} def</span></div>`;
}

function muDuelTitle(L, offTeam, defTeam) {
  return `${muAbbr(L[offTeam])} Offense <span class="vs">vs</span> ${muAbbr(L[defTeam])} Defense`;
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

// Team-colour scorebug shared with #compare (views.js). Falls back to the plain
// header if nfl-lib has not loaded.
function renderMatchupHeroBanner(game, tA, tB) {
  const teamA = typeof nflTeamByName === 'function' ? nflTeamByName(tA) : null;
  const teamB = typeof nflTeamByName === 'function' ? nflTeamByName(tB) : null;
  if (typeof nflLib !== 'undefined' && nflLib && teamA && teamB) {
    const looks = nflLib.separateLooks(nflLib.teamLook(teamA), nflLib.teamLook(teamB));
    const standings = nflStandingRows();
    const standingOf = abbr => standings.find(t => t.abbr === abbr) || null;
    const m = game && game.market;
    const p = m ? marketWinProb(m) : null;
    // nflverse spread_line is the home team's expected margin.
    const favAbbr = m && m.spread != null ? teamAbbrFor(m.spread > 0 ? game.home_team : game.away_team) : '';
    const spread = m && m.spread != null ? (m.spread === 0 ? 'PK' : favAbbr + ' -' + Math.abs(m.spread)) : '';
    const homeIsB = !game || game.home_team === teamB.name;
    const final = game && nflLib.isFinalGame(game);
    const status = !game ? 'Hypothetical matchup'
      : final ? 'Final · ' + game.away_score + '-' + game.home_score
      : (nflKickoff(game.kickoff_utc) || 'Kickoff TBD');
    const line = [spread, m && m.total != null ? 'O/U ' + m.total : ''].filter(Boolean).join(' · ');
    const mid = '<div class="gm-mid">' +
      (game ? '<span class="gm-day">Week ' + attrEsc(game.week) + '</span>' : '') +
      '<span class="gm-st">' + attrEsc(status) + '</span>' +
      (game && game.venue ? '<span class="gm-meta">' + attrEsc(game.venue) + '</span>' : '') +
      (game && game.tv ? '<span class="gm-meta">' + attrEsc(game.tv) + '</span>' : '') +
      (line ? '<span class="gm-line">' + attrEsc(line) + '</span>' : '') +
      (p !== null && !final ? '<span class="gm-meta">Market win % · ' + attrEsc(teamA.abbr) + ' ' + pctText(homeIsB ? 1 - p : p) + ' · ' + attrEsc(teamB.abbr) + ' ' + pctText(homeIsB ? p : 1 - p) + '</span>' : '') +
      '<a class="cp-open" href="#compare/' + attrEsc(teamA.abbr) + '/' + attrEsc(teamB.abbr) + '">Compare teams →</a></div>';
    return '<div class="nv"><div class="gm-bug mu-bug">' + nflBlockHTML(teamA, standingOf(teamA.abbr), looks[0], 'away') + mid +
      nflBlockHTML(teamB, standingOf(teamB.abbr), looks[1], 'home') + '</div></div>';
  }
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
  const teamA = typeof nflTeamByName === 'function' ? nflTeamByName(tA) : null;
  const teamB = typeof nflTeamByName === 'function' ? nflTeamByName(tB) : null;
  if (typeof nflLib !== 'undefined' && nflLib && teamA && teamB) {
    const looks = nflLib.separateLooks(nflLib.teamLook(teamA), nflLib.teamLook(teamB));
    const teams = (DATA.teams || []).map(t => t.abbr);
    const rows = nflLib.compareRows(teamA.abbr, teamB.abbr, {
      standings: nflStandingRows(),
      totals: (LEAGUE_STATS && LEAGUE_STATS.team_totals) || [],
      efficiency: EFFICIENCY_DATA || [],
    }, teams);
    const rankOf = rows.length ? Math.max(...rows.map(r => r.a.of)) : 0;
    const p = m ? marketWinProb(m) : null;
    const ml = v => v == null ? '—' : (v > 0 ? '+' + v : String(v));
    // Columns follow the pickers (A, B); the lines belong to the game's away/home.
    const flip = game && game.away_team !== teamA.name;
    const kv = (k, away, home) => '<span class="k">' + k + '</span><b>' + (flip ? home : away) + '</b><b>' + (flip ? away : home) + '</b>';
    const market = m ? '<section class="card gm-card mu-market"><div class="gm-th"><h2>Market</h2></div><div class="mu-kv">' +
      '<span class="k"></span><b class="hd">' + attrEsc(teamA.abbr) + '</b><b class="hd">' + attrEsc(teamB.abbr) + '</b>' +
      kv('Spread', m.spread == null ? '—' : (m.spread === 0 ? 'PK' : (m.spread > 0 ? '+' + m.spread : String(m.spread))),
        m.spread == null ? '—' : (m.spread === 0 ? 'PK' : (m.spread > 0 ? String(-m.spread) : '+' + Math.abs(m.spread)))) +
      kv('Moneyline', ml(m.away_ml), ml(m.home_ml)) +
      kv('Win %', pctText(p === null ? null : 1 - p), pctText(p)) +
      (m.total == null ? '' : '<span class="k">Total</span><b class="span">' + m.total + '</b>') +
      '</div><p class="nv-note">nflverse lines. Win % is the moneyline price with the bookmaker margin removed.</p></section>' : '';
    return '<div class="nv mu-side">' + market + nflTapeHTML(rows, teamA, teamB, looks, rankOf) + '</div>';
  }

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

// At a Glance: both teams on the same four measured rates, tale-of-the-tape
// rows (bars sized against each other, lower is better on defense).
function renderAtAGlanceTable(tA, tB) {
  const gA = getTeamAtAGlance(tA);
  const gB = getTeamAtAGlance(tB);
  const L = muLooks(tA, tB);
  const season = measuredEpaSeason();
  const lib = typeof nflLib !== 'undefined' && nflLib ? nflLib : null;
  const epa = v => v != null ? v.toFixed(3) : '—';
  const pct = v => v != null ? (v * 100).toFixed(0) + '%' : '—';
  const rows = [
    { label: `Off EPA/play ${season}`, a: gA.epaOff, b: gB.epaOff, ra: gA.epaOffRank, rb: gB.epaOffRank, fmt: epa },
    { label: `Def EPA/play ${season}`, a: gA.epaDef, b: gB.epaDef, ra: gA.epaDefRank, rb: gB.epaDefRank, fmt: epa, lower: true },
    { label: `Off Success Rate ${season}`, a: gA.successOff, b: gB.successOff, ra: gA.successOffRank, rb: gB.successOffRank, fmt: pct },
    { label: `Def Success Rate ${season}`, a: gA.successDef, b: gB.successDef, ra: gA.successDefRank, rb: gB.successDefRank, fmt: pct, lower: true },
  ];
  const body = rows.map(r => {
    const share = lib ? lib.barShares(r.a, r.b, r.lower) : { a: r.a != null ? 1 : 0, b: r.b != null ? 1 : 0 };
    const lead = r.a != null && r.b != null && r.a !== r.b ? ((r.lower ? r.a < r.b : r.a > r.b) ? 'a' : 'b') : '';
    return `<div class="mu-tr matchup-table-row">` +
      muVal('a', r.fmt(r.a), r.ra, lead === 'a') + muBar('a', share.a, L.a.fill, lead === 'a') +
      `<span class="mu-k"><span>${attrEsc(r.label)}</span></span>` +
      muBar('b', share.b, L.b.fill, lead === 'b') + muVal('b', r.fmt(r.b), r.rb, lead === 'b') + `</div>`;
  }).join('');
  return `
    <section class="mu-card" aria-label="At a glance comparison">
      <div class="mu-ch"><h2>At a Glance Comparison</h2><span class="mu-kick">${season} season to date</span></div>
      <div class="mu-th"><span class="a">${muAbbr(L.a)}</span><span class="k">Metric</span><span class="b">${muAbbr(L.b)}</span></div>
      ${body}
      <div class="mu-note"><span>Sources & Method: ${season} measured EPA (nflverse, season to date)</span><span>Small numbers are league ranks (1st = best).</span><span>Model verified</span></div>
    </section>
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

// Passing, Rushing and Defense & Trenches: both offense-vs-defense pairings
// side by side for one group of measured splits.
function renderMatchupComparisonsSideBySide(splits, tA, tB, categoryTitle) {
  const L = muLooks(tA, tB);
  const season = measuredEpaSeason();
  const card = (offTeam, defTeam) => `
    <section class="mu-card">
      <div class="mu-ch"><h3>${muDuelTitle(L, offTeam, defTeam)}</h3><span class="mu-kick">${season} measured</span></div>
      ${muDuelHeadHtml(L, offTeam, defTeam, attrEsc(categoryTitle || 'Metric'))}
      ${muDuelRows(splits, offTeam, defTeam).map(r => muDuelRowHtml(r, L, offTeam, defTeam)).join('')}
      <div class="mu-note"><span>Source: ${season} nflverse play-by-play (season to date)</span><span>Ranks: 1–32 NFL</span></div>
    </section>
  `;
  return `<div class="mu-two">${card(tA, tB)}${card(tB, tA)}</div>`;
}

// Each offense's biggest rank gaps over the other defense, at most six.
function renderKeyAdvantagesPanel(tA, tB) {
  const seen = {};
  const allSplits = [...PASSING_SPLITS, ...RUSHING_SPLITS, ...TRENCH_SPLITS].filter(s => !seen[s.id] && (seen[s.id] = 1));
  const L = muLooks(tA, tB);
  const season = measuredEpaSeason();
  const top = (offTeam, defTeam) => muDuelRows(allSplits, offTeam, defTeam)
    .filter(r => r.adv && !r.adv.unavailable && r.adv.stars > 0 && r.adv.team === offTeam)
    .sort((a, b) => (b.adv.stars - a.adv.stars) || (b.adv.delta - a.adv.delta))
    .slice(0, 6);
  const card = (offTeam, defTeam) => {
    const rows = top(offTeam, defTeam);
    return `
      <section class="mu-card">
        <div class="mu-ch"><h3>${muAbbr(L[offTeam])} Top Advantages</h3><span class="mu-kick">${season} season to date</span></div>
        ${!rows.length
          ? `<p class="mu-empty">No statistical mismatches identified for this unit in ${season} data.</p>`
          : muDuelHeadHtml(L, offTeam, defTeam, 'Key split') + rows.map(r => muDuelRowHtml(r, L, offTeam, defTeam)).join('')}
      </section>
    `;
  };
  return `<div class="mu-two">${card(tA, tB)}${card(tB, tA)}</div>`;
}

// One insight card. The accent is the colour of the team its title names
// (the spotlight player's team, or the left side of a battle card).
function muInsightHtml(card, L, tA) {
  const team = L[card.title ? card.teamA : card.leftTeam] || L[card.teamName] || L.a;
  const player = card.playerName
    ? `<button type="button" class="mu-btn" onclick="openPlayerModal('${attrEsc(card.playerName).replace(/'/g, "\\'")}','${attrEsc(card.teamName || tA).replace(/'/g, "\\'")}')"><span>View ${attrEsc(card.playerName)} profile</span><span aria-hidden="true">→</span></button>`
    : '';
  return `
    <article class="mu-in" style="--c:${team.fill}">
      <div>
        <div class="mu-in-h"><h4>${attrEsc(card.title || card.leftName || 'Matchup Dynamic')}</h4>${card.subtitle ? `<span>${attrEsc(card.subtitle)}</span>` : ''}</div>
        <p>${card.text}</p>
      </div>
      ${player}
    </article>
  `;
}

function renderMatchupInsightsPanel(tA, tB, game) {
  const insights = generateMatchupInsights(tA, tB, game);
  const L = muLooks(tA, tB);
  return `
    <div class="mu">
      <section class="mu-card">
        <div class="mu-ch"><h2>Verified Matchup Insights</h2><span class="mu-kick">Situational intelligence</span></div>
        <p class="mu-lede">
          Synthesized from ${measuredEpaSeason()} nflverse efficiency and depth charts. Note: Evaluation excludes player-vs-player assignments, injury status, or a player-specific weekly projection.
        </p>
      </section>
      ${!insights.length ? `
        <section class="mu-card"><p class="mu-empty">
          Matchup insights are built from verified roster and efficiency data. None is available for this pairing right now, so nothing is shown rather than inventing a narrative.
        </p></section>
      ` : `<div class="mu-ins grid">${insights.map(card => muInsightHtml(card, L, tA)).join('')}</div>`}
      <div class="mu-note bare"><span>Sources & Method: ${measuredEpaSeason()} measured EPA (nflverse)</span><span>Model verified</span></div>
    </div>
  `;
}

function renderFormationLabPanel(tA, tB) {
  const L = muLooks(tA, tB);
  const front = MATCHUP_STATE.front === 'nickel' ? 'Nickel' : MATCHUP_STATE.front + ' front';
  const field = (team, isOffense) => `
    <section class="mu-card">
      <div class="mu-ch">
        <h3>${muAbbr(L[team])} <span class="nm">${attrEsc(team)}</span></h3>
        <span class="mu-kick">${isOffense ? 'Offense · ' + attrEsc(MATCHUP_STATE.personnel) + ' personnel' : 'Defense · ' + attrEsc(front)}</span>
      </div>
      <div class="formation-field ${isOffense ? 'off' : 'def'}">${formationFieldHtml(team, L[team], isOffense)}</div>
    </section>
  `;
  return `
    <div class="mu">
      <div class="mu-card mu-ctl">
        <div class="mu-ctl-sel">
          <label>
            <span>Personnel</span>
            <select id="matchupPersonnel" onchange="MATCHUP_STATE.personnel = this.value; renderMatchupPanels()">
              <option value="12" ${MATCHUP_STATE.personnel === '12' ? 'selected' : ''}>12 · 2 TE</option>
              <option value="11" ${MATCHUP_STATE.personnel === '11' ? 'selected' : ''}>11 · 3 WR</option>
              <option value="10" ${MATCHUP_STATE.personnel === '10' ? 'selected' : ''}>10 · 4 WR</option>
            </select>
          </label>
          <label>
            <span>Defensive Front</span>
            <select id="matchupFront" onchange="MATCHUP_STATE.front = this.value; renderMatchupPanels()">
              <option value="43" ${MATCHUP_STATE.front === '43' ? 'selected' : ''}>4-3 Base</option>
              <option value="34" ${MATCHUP_STATE.front === '34' ? 'selected' : ''}>3-4 Base</option>
              <option value="nickel" ${MATCHUP_STATE.front === 'nickel' ? 'selected' : ''}>Nickel</option>
            </select>
          </label>
        </div>
        <p>${LEAGUE_SNAPS ? `Starters are the players with the most snaps over each team's last three games. The number under each name is that share. Click a player for his profile.` : `Click any starter chip to inspect profile & ratings. The number under each name is the player's Madden overall rating.`}</p>
      </div>
      <div class="mu-two">${field(tA, true)}${field(tB, false)}</div>
      <div class="mu-note bare">
        <span>${LEAGUE_SNAPS ? `Snap counts: nflverse (Pro Football Reference box scores), through week ${attrEsc(LEAGUE_SNAPS.through_week)}. Slots show who has been playing, not a confirmed game-day lineup or injury report; left and right sides are not tracked.` : `Illustrative alignments built from the current roster snapshot — representative personnel and fronts, not a verified game-day lineup or confirmed assignments. Roster snapshot data is not a complete weekly injury report.`}</span>
      </div>
    </div>
  `;
}

// Pro Preview: one offense against the other defense on seven measured rates.
function renderPreviewOffVsDefMatrix(offTeam, defTeam, L, isLeft) {
  const season = measuredEpaSeason();
  const rows = muDuelRows([
    { id: 'pass_epa_per_att', label: 'Pass EPA per Attempt', tag: 'Pass' },
    { id: 'run_epa_per_att', label: 'Run EPA per Attempt', tag: 'Rush' },
    { id: 'epa_per_play', label: 'Overall EPA per Play', tag: 'Total' },
    { id: 'success_rate', label: 'Offensive Success Rate', tag: 'Total' },
    { id: 'yds_per_play', label: 'Yards per Play', tag: 'Total' },
    { id: 'sack_rate', label: 'Sack Rate (Allowed / Forced)', tag: 'Pass' },
    { id: 'turnover_rate', label: 'Turnover Rate', tag: 'Total' },
  ], offTeam, defTeam);
  return `
    <section class="mu-card">
      <div class="mu-ch"><h2>${muDuelTitle(L, offTeam, defTeam)}</h2><span class="mu-kick">${season} measured</span></div>
      ${muDuelHeadHtml(L, offTeam, defTeam, 'Metric')}
      ${rows.map(r => muDuelRowHtml(r, L, offTeam, defTeam)).join('')}
      <div class="mu-note">
        <span>Source: ${season} nflverse play-by-play (season to date, 1–32 league ranks)</span>
        <button type="button" class="mu-link" onclick="setMatchupSubTab('${isLeft ? 'passing' : 'rushing'}')">${isLeft ? 'Passing splits →' : 'Rushing splits →'}</button>
      </div>
    </section>
  `;
}

function renderPreviewInsights(tA, tB, curGame, L) {
  const insights = generateMatchupInsights(tA, tB, curGame);
  if (!insights || !insights.length) {
    return `
      <section class="mu-card">
        <div class="mu-ch"><h2>Matchup Insights</h2><span class="mu-kick">${currentSeason()} roster & ${measuredEpaSeason()} data</span></div>
        <p class="mu-empty">Matchup insights require verified starter and ${measuredEpaSeason()} efficiency data. None currently available for this pairing.</p>
      </section>
    `;
  }
  return `
    <section class="mu-card">
      <div class="mu-ch"><h2>Matchup Insights</h2><span class="mu-kick">${currentSeason()} roster & ${measuredEpaSeason()} EPA</span></div>
      <div class="mu-ins">${insights.slice(0, 3).map(card => muInsightHtml(card, L, tA)).join('')}</div>
      <div class="mu-note">
        <span>Verified ${currentSeason()} Depth Chart & ${measuredEpaSeason()} EPA</span>
        <button type="button" class="mu-link" onclick="setMatchupSubTab('insights')">More insights →</button>
      </div>
    </section>
  `;
}

/* ── Box Score (games that have kicked off) ─────────────────────────────────
   ESPN's scoreboard for the game's Eastern date gives the event id; its
   summary gives the score by quarter, team stats, each side's box score and
   the scoring plays. Finished games are cached for the page's life; a live
   game is fetched fresh each time the tab opens. */
const BOX_CACHE = {};
let BOX_TOKEN = 0;

function nflGameFinal(g) {
  return !!g && (g.status === 'final' || g.winner != null || (g.home_score != null && g.away_score != null && Date.parse(g.kickoff_utc) < Date.now() - 5 * 3600000));
}
function nflGameStarted(g) {
  return !!g && (nflGameFinal(g) || (Date.parse(g.kickoff_utc) || Infinity) <= Date.now());
}

async function nflGameSummary(game) {
  if (BOX_CACHE[game.game_id]) return BOX_CACHE[game.game_id];
  const away = nflTeamByName(game.away_team), home = nflTeamByName(game.home_team);
  if (!away || !home) throw new Error('team not found');
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(game.kickoff_utc)).replace(/-/g, '');
  const base = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
  const board = await nflFetchJson(base + '/scoreboard?dates=' + day);
  const id = nflLib.findEspnEvent(board, away.abbr, home.abbr);
  if (!id) throw new Error('game not on ESPN scoreboard');
  const g = nflLib.parseNflSummary(await nflFetchJson(base + '/summary?event=' + encodeURIComponent(id)));
  if (g.completed) BOX_CACHE[game.game_id] = g;
  return g;
}

function boxScoreHTML(g, L, tA, tB) {
  const side = k => (g.teams[k] && g.teams[k].abbr === L[tA].abbr ? L[tA] : L[tB]);
  const sw = k => '<i class="bx-sw" style="background:' + side(k).fill + '"></i>';
  const periods = Math.max((g.teams.away || {}).lines?.length || 0, (g.teams.home || {}).lines?.length || 0);
  const pLabel = i => (i < 4 ? String(i + 1) : i === 4 ? 'OT' : 'OT' + (i - 3));
  const lineRow = k => {
    const t = g.teams[k] || {};
    return '<tr><td class="bx-tm">' + sw(k) + attrEsc(t.abbr || '') + '</td>' + Array.from({ length: periods }, (_, i) => '<td>' + (t.lines && t.lines[i] != null ? t.lines[i] : '') + '</td>').join('') + '<td class="bx-tot">' + (t.score ?? '') + '</td></tr>';
  };
  const lines = '<section class="mu-card"><div class="mu-ch"><h3>' + attrEsc((g.teams.away || {}).abbr) + ' <span class="vs">at</span> ' + attrEsc((g.teams.home || {}).abbr) + '</h3><span class="mu-kick">' + attrEsc(g.detail) + '</span></div>' +
    '<table class="bx-ls"><thead><tr><th></th>' + Array.from({ length: periods }, (_, i) => '<th>' + pLabel(i) + '</th>').join('') + '<th>T</th></tr></thead><tbody>' + lineRow('away') + lineRow('home') + '</tbody></table></section>';
  const scoring = g.scoring.length ? '<section class="mu-card"><div class="mu-ch"><h3>Scoring plays</h3><span class="mu-kick">' + g.scoring.length + '</span></div><ol class="bx-sp">' +
    g.scoring.map(p => '<li><span class="bx-q">' + attrEsc(pLabel((p.q || 1) - 1)) + ' ' + attrEsc(p.clock) + '</span><span class="bx-tx">' + attrEsc(p.abbr) + ' · ' + attrEsc(p.text) + '</span><span class="bx-sc">' + attrEsc(p.away) + '-' + attrEsc(p.home) + '</span></li>').join('') + '</ol></section>' : '';
  const teamStats = g.teamStats.length ? '<section class="mu-card"><div class="mu-ch"><h3>Team stats</h3><span class="mu-kick">' + attrEsc((g.teams.away || {}).abbr) + ' · ' + attrEsc((g.teams.home || {}).abbr) + '</span></div><table class="bx-ts"><tbody>' +
    g.teamStats.map(r => '<tr><td>' + attrEsc(r.away) + '</td><th scope="row">' + attrEsc(r.label) + '</th><td>' + attrEsc(r.home) + '</td></tr>').join('') + '</tbody></table></section>' : '';
  const groupTable = (k, grp) => '<div class="bx-col"><div class="bx-gh">' + sw(k) + attrEsc((g.teams[k] || {}).abbr) + '</div><div class="bx-scroll"><table class="bx-pt"><thead><tr><th class="bx-pn">' + attrEsc(grp.title) + '</th>' +
    grp.labels.map(l => '<th>' + attrEsc(l) + '</th>').join('') + '</tr></thead><tbody>' +
    grp.rows.map(r => '<tr><td class="bx-pn">' + (r.id ? '<a href="#player/' + attrEsc(r.id) + '">' + attrEsc(r.name) + '</a>' : attrEsc(r.name)) + '</td>' + r.stats.map(v => '<td>' + attrEsc(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div></div>';
  const keys = [];
  for (const k of ['away', 'home']) for (const grp of g.players[k]) if (!keys.includes(grp.key)) keys.push(grp.key);
  const box = keys.length ? '<section class="mu-card"><div class="mu-ch"><h3>Box score</h3></div>' + keys.map(key => {
    const a = g.players.away.find(x => x.key === key), h = g.players.home.find(x => x.key === key);
    return '<div class="bx-grp">' + (a ? groupTable('away', a) : '<div></div>') + (h ? groupTable('home', h) : '<div></div>') + '</div>';
  }).join('') + '</section>' : '';
  return '<div class="mu bx">' + lines + '<div class="mu-two">' + teamStats + scoring + '</div>' + box +
    '<div class="mu-note bare"><span>Box score: ESPN game summary.' + (g.state === 'in' ? ' Live: open the tab again for the latest numbers.' : '') + '</span></div></div>';
}

async function renderBoxScoreInto(main, game, tA, tB) {
  const token = ++BOX_TOKEN;
  main.innerHTML = '<div class="mu"><div class="mu-card"><div class="mu-note bare"><span>Loading the box score…</span></div></div></div>';
  try {
    const g = await nflGameSummary(game);
    if (token !== BOX_TOKEN || MATCHUP_STATE.subtab !== 'box') return;
    main.innerHTML = boxScoreHTML(g, muLooks(tA, tB), tA, tB);
  } catch (err) {
    if (token !== BOX_TOKEN) return;
    main.innerHTML = '<div class="mu"><div class="mu-card"><div class="mu-note bare"><span>The box score did not load from ESPN. Pick the tab again to retry.</span></div></div></div>';
  }
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

  const boxBtn = document.getElementById('subtab-box');
  const started = nflGameStarted(curGame);
  if (boxBtn) boxBtn.hidden = !started;
  if (sub === 'box' && started) {
    renderBoxScoreInto(main, curGame, tA, tB);
  } else if (sub === 'preview' || sub === 'box') {
    main.innerHTML = renderPreviewSubtab(tA, tB, curGame);
  } else if (sub === 'overview') {
    main.innerHTML = `<div class="mu">${renderAtAGlanceTable(tA, tB)}${renderKeyAdvantagesPanel(tA, tB)}</div>`;
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
  const L = muLooks(tA, tB);
  const labelA = L.a.abbr;
  const labelB = L.b.abbr;
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
    <div class="mu">
    <!-- The question: the viewed offense's play-action use against the other defense's exposure, observation season labelled -->
    <section class="mu-card mu-q" role="region" aria-label="Matchup preview question">
      <div class="mu-q-top">
        <div class="mu-q-text">
          <div class="mu-kick">${tSeason} Regular Season · One Question</div>
          <h2>How will ${attrEsc(viewedOffTeam)}'s play-action passing meet ${attrEsc(viewedDefTeam)}'s defense?</h2>
          <p>In the ${tSeason} regular season, ${playActionSentence(viewedOffTeam, viewedDefTeam, offAbbr, defAbbr)}</p>
          <p class="mu-fine">${attrEsc(seasonNote)}</p>
          <p class="mu-fine mu-caveat">Defensive exposure counts opponent usage, it is not a measure of defensive effectiveness and does not predict a winner.</p>
        </div>
        <button
          type="button"
          class="mu-seg"
          onclick="swapViewedOffense()"
          aria-pressed="${viewedOffenseIsA ? 'true' : 'false'}"
          aria-label="View ${viewedOffenseIsA ? tB : tA} offense${viewedOffenseIsA ? ' instead of ' + tA : ' instead of ' + tB}"
        ><span class="${viewedOffenseIsA ? 'on' : ''}">${attrEsc(labelA)} OFF</span><span class="${viewedOffenseIsA ? '' : 'on'}">${attrEsc(labelB)} OFF</span></button>
      </div>

      <!-- Overall, pass and run EPA: the viewed offense against the other defense -->
      <div class="mu-epas">
        ${epaBarHtml('Overall EPA', epaValue(viewedOffTeam, 'off', 'epa_per_play'), epaValue(viewedDefTeam, 'def', 'epa_per_play'), 'epa_per_play', tA, tB, viewedOffenseIsA, L)}
        ${epaBarHtml('Pass EPA', epaValue(viewedOffTeam, 'off', 'pass_epa_per_att'), epaValue(viewedDefTeam, 'def', 'pass_epa_per_att'), 'pass_epa_per_att', tA, tB, viewedOffenseIsA, L)}
        ${epaBarHtml('Run EPA', epaValue(viewedOffTeam, 'off', 'run_epa_per_att'), epaValue(viewedDefTeam, 'def', 'run_epa_per_att'), 'run_epa_per_att', tA, tB, viewedOffenseIsA, L)}
      </div>

      <!-- Evidence: definition, denominator, eligibility, missing counts, provenance -->
      <div class="mu-ev">
        ${renderTeamTendenciesDisclosure(offAbbr, 'off', 'play_action')}
        ${renderTeamTendenciesDisclosure(defAbbr, 'def', 'play_action')}
        <div class="mu-note">
          <span>Sources &amp; Method: ${tSeason} measured team tendencies (motion, play-action, shotgun) from FTN charting + nflverse play-by-play, plus ${eSeason} EPA.</span>
        </div>
        <div class="mu-note tight">
          <span>Rosters: ${rosterVersionLabel()}</span>
          <span>Tendencies: ${tendenciesLabel}</span>
        </div>
      </div>
    </section>

    <div class="mu-pv">
      <div class="mu">
        ${renderPreviewOffVsDefMatrix(tA, tB, L, true)}
        ${renderPreviewOffVsDefMatrix(tB, tA, L, false)}
      </div>
      <div class="mu">
        ${renderPreviewInsights(tA, tB, curGame, L)}
      </div>
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
  return `<p class="mu-fine">${tendenciesSeason()} tendency loading…</p>`;
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

// One Pro Preview EPA tile: the viewed offense's value against the other
// defense's value allowed, with league ranks, and centre-out bars sized by
// those ranks so the longer bar is the unit with the edge.
function epaBarHtml(label, offenseVal, defenseVal, metricKey, tA, tB, offenseIsA, L){
  const defTeam = offenseIsA ? tB : tA;
  const offTeam = offenseIsA ? tA : tB;
  L = L || muLooks(tA, tB);
  const off = L[offTeam];
  const def = L[defTeam];
  const season = measuredEpaSeason();
  const offRank = efficiencyRank(offTeam, 'off', metricKey, season);
  const defRank = efficiencyRank(defTeam, 'def', metricKey, season);
  const adv = computeAdvantage(offRank, defRank, offTeam, defTeam);
  const lead = adv.team ? (adv.team === offTeam ? 'a' : 'b') : '';
  const offDisplay = offenseVal == null ? '—' : offenseVal.toFixed(2);
  const defDisplay = defenseVal == null ? '—' : defenseVal.toFixed(2);
  const side = (cls, t, unit, text, rank) => `<span class="${cls}${lead === cls ? ' lead' : ''}">` +
    `<i style="color:${t.ink}">${attrEsc(t.abbr)} ${unit}</i><b>${attrEsc(text)}</b>` +
    (rank != null ? `<small>${muOrd(rank)}</small>` : '') + `</span>`;
  return `
    <div class="mu-epa">
      <div class="mu-kick">${label}</div>
      <div class="mu-epa-n">${side('a', off, 'off', offDisplay, offRank)}${side('b', def, 'def', defDisplay, defRank)}</div>
      <div class="mu-epa-bars">${muBar('a', muRankShare(offRank, muRankCount('off', metricKey)), off.fill, lead === 'a')}${muBar('b', muRankShare(defRank, muRankCount('def', metricKey)), def.fill, lead === 'b')}</div>
      <div class="mu-epa-cap">${attrEsc(offTeam)} vs ${attrEsc(defTeam)} ${label.includes('Overall') ? 'overall' : label.toLowerCase()}</div>
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
  try { await Promise.all([nflLibLoad(), loadLeagueArtifacts(), loadGameLines()]); } catch (e) {}

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

  if (curGame) curGame.market = gameMarketLines(curGame);

  // Render Hero Banner & Sidebar
  const hero = document.getElementById('matchupHeroBanner');
  if (hero) hero.innerHTML = renderMatchupHeroBanner(curGame, MATCHUP_STATE.teamA, MATCHUP_STATE.teamB);

  const sidebar = document.getElementById('matchupSidebar');
  if (sidebar) sidebar.innerHTML = renderMatchupSidebar(curGame, MATCHUP_STATE.teamA, MATCHUP_STATE.teamB);

  // Render Active Subtab Main Content
  renderMatchupPanels();
}

