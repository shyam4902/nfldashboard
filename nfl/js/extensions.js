// ═══════════════════════════════════════════════════════════
// EXTENSIONS: THEMES, DUAL RADAR, PLAYER MODAL, COMPARE,
// COMMAND PALETTE
// ═══════════════════════════════════════════════════════════

// ── 1. THEME SWITCHER ──
function changeTheme(theme) {
  document.body.className = theme === 'default' ? 'min-h-screen' : `min-h-screen theme-${theme}`;
  localStorage.setItem('nfl_dashboard_theme', theme);
  const sel = document.getElementById('themeSelector');
  if (sel) sel.value = theme;
}

function initTheme() {
  const saved = localStorage.getItem('nfl_dashboard_theme') || 'default';
  changeTheme(saved);
}

// ── 3. UNIVERSAL PLAYER PROFILE MODAL ──
function findPlayerData(name, teamHint = '') {
  const norm = normName(name);

  let pRecord = DATA.players ? DATA.players.find(p => normName(p.name) === norm) : null;

  let playerTxs = DATA.transactions ? DATA.transactions.filter(t => {
    const tn = normName(t.player_name);
    return tn === norm;
  }) : [];

  let playerProps = [];
  if (PROPS_BOARD && PROPS_BOARD.plays) {
    playerProps = PROPS_BOARD.plays.filter(pl => {
      const pln = normName(pl.player);
      return pln === norm;
    });
  }

  return { name, norm, pRecord, playerTxs, playerProps };
}

async function openPlayerModal(name, teamHint = '') {
  if (!PROPS_BOARD) await loadPropsBoard();

  const data = findPlayerData(name, teamHint);
  const container = document.getElementById('playerModalContent');
  if (!container) return;

  const p = data.pRecord || {};
  const pos = p.pos || 'N/A';
  const team = p.team_id ? (DATA.teams.find(t=>t.id===p.team_id)?.name || p.team_id) : (teamHint || 'NFL');
  const jersey = p.jersey ? `#${p.jersey}` : '';
  const age = p.age ? `${p.age} yrs` : '';
  const ovr = p.ovr !== null && p.ovr !== undefined ? p.ovr : null;
  const ratingBadgeClass = ovr ? (ovr >= 90 ? 'rating-elite' : ovr >= 80 ? 'rating-star' : ovr >= 70 ? 'rating-solid' : 'rating-dev') : '';

  const isRookie = p.is_rookie === true || p.is_rookie === 'Yes';
  const isNew = p.isNew || isRookie || p.acquisition_type === 'fa' || p.acquisition_type === 'trade';

  let html = `
    <div class="flex items-start justify-between border-b border-slate-700/50 pb-4 mb-4">
      <div class="flex items-center gap-3">
        <div class="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center text-center">
          <span class="text-xs font-bold text-slate-400 font-mono">${pos}</span>
          <span class="text-sm font-semibold text-white font-mono">${jersey || '–'}</span>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-2xl font-bold text-white tracking-tight">${name}</h2>
            ${isRookie ? '<span class="badge-rook">ROOKIE</span>' : ''}
            ${isNew && !isRookie ? '<span class="badge-new">NEW</span>' : ''}
          </div>
          <div class="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
            <span class="font-semibold text-slate-300">${team}</span>
            <span>·</span>
            <span>${age || 'Age N/A'}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">

        <button onclick="openPlayerCompareModal('${name.replace(/'/g,"\\'")}')" class="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 transition flex items-center gap-1">
          <span>⚖</span> Compare
        </button>
      </div>
    </div>
  `;

  if (data.playerProps && data.playerProps.length > 0) {
    html += `
      <div class="mb-5 glass rounded-xl p-4">
        <div class="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
          <span>💰</span> Active Season Props & Value Reads
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-slate-500 border-b border-slate-700/50">
                <th class="text-left py-1.5 px-2">Market</th>
                <th class="text-center py-1.5 px-2">Side</th>
                <th class="text-center py-1.5 px-2">Line</th>
                <th class="text-center py-1.5 px-2">Venue</th>
                <th class="text-center py-1.5 px-2">Odds</th>
                <th class="text-center py-1.5 px-2" title="Analyst read on the model-to-market gap: Generous, Lean, Fair, Tight">Value</th>
                <th class="text-center py-1.5 px-2" title="All venues quoting this player+market+side">All Odds</th>
              </tr>
            </thead>
            <tbody>
    `;

    for (const pr of data.playerProps.slice(0, 8)) {
      const evColor = pr.ev_pct > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400';
      html += `
        <tr class="border-b border-slate-800/50 hover:bg-slate-800/30">
          <td class="py-1.5 px-2 font-medium text-slate-300">${propsMarketLabels[pr.market] || pr.market}</td>
          <td class="py-1.5 px-2 text-center uppercase font-medium font-mono text-[10px] ${pr.side==='over'?'text-emerald-400':'text-sky-400'}">${pr.side}</td>
          <td class="py-1.5 px-2 text-center font-mono font-medium text-white">${pr.line}</td>
          <td class="py-1.5 px-2 text-center font-mono text-[11px] text-slate-400">${pr.venue}</td>
          <td class="py-1.5 px-2 text-center font-mono font-medium text-slate-300">${pr.odds || '—'}</td>
          <td class="py-1.5 px-2 text-center">${valueLabelHtml(pr.edge_pct, pr.ev_pct)}</td>
          <td class="py-1.5 px-2 text-center"><button onclick="event.stopPropagation();toggleOddsCompare('${pr.player_id}|${pr.market}|${pr.side}', 0)" class="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-600 text-slate-300 hover:border-sky-400 hover:text-sky-300" title="Compare this line across all venues">⊞</button></td>
        </tr>
      `;
    }

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    // 2024 Game Log & Splits (Feature 5) — from the producer's insights block
    // + player_history game logs.
    const withLog = data.playerProps.find(pr => pr.insights && pr.insights.games_2024);
    if (withLog) {
      const ins = withLog.insights;
      const verdict = ins.season_line_would_have === 'over'
        ? '<span class="text-emerald-400 font-bold">went over</span>'
        : ins.season_line_would_have === 'under'
          ? '<span class="text-rose-400 font-bold">went under</span>'
          : 'pushed';
      const hist = PROPS_BOARD && PROPS_BOARD.player_history
        ? PROPS_BOARD.player_history[`${withLog.player_id}|${withLog.market}`]
        : null;
      let gameLogTable = '';
      if (hist && hist.log && hist.log.length) {
        const pg = ins.per_game_equivalent;
        gameLogTable = `
          <div class="mt-3">
            <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Weekly game log (vs per-game equivalent of today's line)</div>
            <div class="overflow-x-auto">
              <table class="w-full text-[11px]">
                <thead><tr class="text-slate-500 border-b border-slate-700/50">
                  <th class="py-1 px-2 text-left">Wk</th>
                  <th class="py-1 px-2 text-left">Opp</th>
                  <th class="py-1 px-2 text-right">Actual</th>
                  <th class="py-1 px-2 text-center">vs ${pg}</th>
                </tr></thead>
                <tbody>
                  ${hist.log.map(g => {
                    const dir = g.metric > pg ? 'over' : (g.metric < pg ? 'under' : 'push');
                    const cls = dir === 'over' ? 'text-emerald-400 font-bold' : dir === 'under' ? 'text-rose-400 font-bold' : 'text-slate-500';
                    const tag = dir === 'over' ? 'O' : dir === 'under' ? 'U' : '—';
                    return `<tr class="border-b border-slate-800/40">
                      <td class="py-1 px-2 text-slate-400">${g.week}</td>
                      <td class="py-1 px-2 text-slate-300">${g.opponent || '—'}${g.home ? '' : ' @'}</td>
                      <td class="py-1 px-2 text-right font-bold text-white">${g.metric}</td>
                      <td class="py-1 px-2 text-center ${cls}">${tag}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>`;
      }
      let oppSplits = '';
      if (hist && hist.opponents && hist.opponents.length) {
        oppSplits = `
          <div class="mt-3">
            <div class="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Best matchups (2024, by avg)</div>
            <div class="flex flex-wrap gap-1.5">
              ${hist.opponents.slice(0, 6).map(o => `<span class="text-[10px] px-1.5 py-0.5 rounded border border-slate-700/50 bg-slate-800/40 text-slate-300" title="${o.games} game(s)">vs ${o.opponent} · <b class="text-white">${o.avg}</b></span>`).join('')}
            </div>
          </div>`;
      }
      html += `
      <div class="mb-5 glass rounded-xl p-4">
        <div class="text-xs font-bold uppercase tracking-wider text-sky-400 mb-3 flex items-center gap-2">
          <span>📊</span> 2024 Form — ${propsMarketLabels[withLog.market] || withLog.market}
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
          <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">2024 total (${ins.games_2024} games)</div><div class="text-sm font-semibold font-mono text-white">${ins.season_total_2024}</div></div>
          <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Per-game avg</div><div class="text-sm font-semibold font-mono text-sky-400">${Math.round(ins.season_total_2024 / ins.games_2024)}</div></div>
          <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Weekly over rate</div><div class="text-sm font-semibold font-mono text-emerald-400">${ins.weekly_over_rate}%</div></div>
          <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Last-10 over rate</div><div class="text-sm font-semibold font-mono text-amber-400">${ins.weekly_over_rate_l10 != null ? ins.weekly_over_rate_l10 + '%' : '—'}</div></div>
        </div>
        <div class="text-[11px] text-slate-400">Current ${propsMarketLabels[withLog.market] || withLog.market} line: <b class="text-white">${withLog.line}</b> — in 2024 this player totalled ${ins.season_total_2024}, so the season line would have ${verdict}. Per-game equivalent of the line: <b class="text-slate-200">${ins.per_game_equivalent}</b>${ins.streak && ins.streak.count > 1 ? ` · finished 2024 on a ${ins.streak.count}-game ${ins.streak.type} streak` : ''}.</div>
        ${gameLogTable}
        ${oppSplits}
      </div>
      `;
    }
  }

  if (data.playerTxs && data.playerTxs.length > 0) {
    html += `
      <div class="glass rounded-xl p-4">
        <div class="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
          <span>📋</span> 2026 Transactions & Contract Details
        </div>
        <div class="space-y-2">
    `;
    for (const tx of data.playerTxs) {
      const isBb = tx.blockbuster;
      html += `
        <div class="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 flex items-start justify-between gap-3 text-xs ${isBb?'blockbuster':''}">
          <div>
            <div class="font-semibold text-slate-200">${tx.detail || tx.player_name}</div>
            <div class="text-[10px] text-slate-500 mt-0.5">${tx.date_str || tx.sort_date} · ${tx.from_team} &rarr; ${tx.to_team}</div>
          </div>
          <span class="tx-pill ${tx.type}">${tx.type}</span>
        </div>
      `;
    }
    html += `</div></div>`;
  }

  container.innerHTML = html;
  document.getElementById('playerModal').classList.add('active');
}

function closePlayerModal() {
  document.getElementById('playerModal')?.classList.remove('active');
}

// ── 4. DEEP HEAD-TO-HEAD PLAYER COMPARISON ──
let comparePlayer1 = null;
let comparePlayer2 = null;

async function openPlayerCompareModal(initialP1 = '', initialP2 = '') {
  const modal = document.getElementById('playerCompareModal');
  if (!modal) return;
  
  if (!PROPS_BOARD) await loadPropsBoard();

  if (initialP1) comparePlayer1 = initialP1;
  if (initialP2) comparePlayer2 = initialP2;
  if (!comparePlayer1 && DATA.players && DATA.players.length > 0) comparePlayer1 = "Josh Allen";
  if (!comparePlayer2 && DATA.players && DATA.players.length > 0) comparePlayer2 = "Lamar Jackson";

  renderPlayerCompare();
  modal.classList.add('active');
}

function closePlayerCompareModal() {
  document.getElementById('playerCompareModal')?.classList.remove('active');
}

function setCompareQuick(p1, p2) {
  if (p1) comparePlayer1 = p1;
  if (p2) comparePlayer2 = p2;
  renderPlayerCompare();
}

function renderPlayerCompare() {
  const container = document.getElementById('playerCompareContent');
  if (!container) return;

  const d1 = findPlayerData(comparePlayer1);
  const d2 = findPlayerData(comparePlayer2);

  const allNames = Array.from(new Set(
    (DATA.players || []).map(p => p.name)
  )).filter(Boolean).sort();

  const p1 = d1.pRecord || {};
  const p2 = d2.pRecord || {};

  const pos1 = p1.pos || 'QB';
  const pos2 = p2.pos || 'QB';

  const ovr1 = p1.ovr !== null && p1.ovr !== undefined ? p1.ovr : 75;
  const ovr2 = p2.ovr !== null && p2.ovr !== undefined ? p2.ovr : 75;

  const team1 = p1.team_id ? (DATA.teams?.find(t=>t.id===p1.team_id)?.name || p1.team_id) : 'NFL';
  const team2 = p2.team_id ? (DATA.teams?.find(t=>t.id===p2.team_id)?.name || p2.team_id) : 'NFL';


  const rivals = {
    'QB': ['Josh Allen', 'Lamar Jackson', 'Patrick Mahomes', 'Joe Burrow', 'Jalen Hurts', 'C.J. Stroud', 'Jayden Daniels', 'Jordan Love', 'Brock Purdy', 'Justin Herbert'],
    'RB': ['Christian McCaffrey', 'Bijan Robinson', 'Saquon Barkley', 'Breece Hall', 'Jahmyr Gibbs', 'Jonathan Taylor', 'Derrick Henry', 'Kyren Williams', 'De\'Von Achane', 'Josh Jacobs'],
    'WR': ['Justin Jefferson', 'CeeDee Lamb', 'Ja\'Marr Chase', 'Amon-Ra St. Brown', 'Tyreek Hill', 'A.J. Brown', 'Garrett Wilson', 'Marvin Harrison Jr.', 'Puka Nacua', 'Malik Nabers'],
    'TE': ['Sam LaPorta', 'Travis Kelce', 'Trey McBride', 'Mark Andrews', 'Brock Bowers', 'George Kittle', 'Dalton Kincaid', 'Kyle Pitts'],
    'DEF': ['Micah Parsons', 'Myles Garrett', 'T.J. Watt', 'Nick Bosa', 'Maxx Crosby', 'Fred Warner', 'Roquan Smith', 'Sauce Gardner', 'Patrick Surtain II', 'Kyle Hamilton']
  };

  const posRivals = rivals[pos1] || rivals['QB'];

  let html = `
    <!-- Top Search & Quick Selector -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div class="glass rounded-xl p-3 border-l-4 border-cyan-400">
        <div class="flex items-center justify-between mb-1">
          <label class="text-[10px] uppercase font-bold text-cyan-300">Player 1 (Cyan)</label>
          <span class="text-[10px] text-slate-400 font-mono">${pos1} · ${team1}</span>
        </div>
        <input list="pCompareList1" value="${comparePlayer1 || ''}" onchange="comparePlayer1=this.value;renderPlayerCompare()" placeholder="Search Player 1..." class="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs w-full text-white focus:outline-none focus:border-cyan-500">
        <datalist id="pCompareList1">
          ${allNames.map(n => `<option value="${n.replace(/"/g, '&quot;')}">`).join('')}
        </datalist>
      </div>

      <div class="glass rounded-xl p-3 border-l-4 border-amber-400">
        <div class="flex items-center justify-between mb-1">
          <label class="text-[10px] uppercase font-bold text-amber-300">Player 2 (Amber)</label>
          <span class="text-[10px] text-slate-400 font-mono">${pos2} · ${team2}</span>
        </div>
        <input list="pCompareList2" value="${comparePlayer2 || ''}" onchange="comparePlayer2=this.value;renderPlayerCompare()" placeholder="Search Player 2..." class="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs w-full text-white focus:outline-none focus:border-amber-500">
        <datalist id="pCompareList2">
          ${allNames.map(n => `<option value="${n.replace(/"/g, '&quot;')}">`).join('')}
        </datalist>
      </div>
    </div>

    <!-- Quick Swap Rivalry Bar -->
    <div class="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1 text-xs">
      <span class="text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">Quick Rivals:</span>
      ${posRivals.slice(0, 8).map(r => `
        <button onclick="setCompareQuick(null, '${r.replace(/'/g, "\\'")}')" class="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] whitespace-nowrap transition">
          vs ${r}
        </button>
      `).join('')}
    </div>

    <!-- Player Hero Summary -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
      <!-- Player 1 Hero Card -->
      <div class="glass rounded-xl p-4 flex flex-col justify-between border border-cyan-500/30">
        <div>
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="text-[10px] uppercase font-black tracking-wider text-cyan-400">Player 1</div>
              <h3 class="text-xl font-black text-white">${d1.name}</h3>
              <div class="text-xs text-slate-400 mt-0.5">${pos1} · ${team1} · ${p1.age ? p1.age+' yrs' : 'Age N/A'}</div>
            </div>

          </div>
          <div class="space-y-1.5 text-xs">
            <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Priced Prop Plays</span><strong class="text-slate-300">${d1.playerProps?.length || 0}</strong></div>
          </div>
        </div>
        <button onclick="openPlayerModal('${d1.name.replace(/'/g, "\\'")}')" class="mt-3 text-xs w-full py-1.5 rounded-lg bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition font-semibold">
          View Full Dossier
        </button>
      </div>

      <!-- Player 2 Hero Card -->
      <div class="glass rounded-xl p-4 flex flex-col justify-between border border-amber-500/30">
        <div>
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="text-[10px] uppercase font-black tracking-wider text-amber-400">Player 2</div>
              <h3 class="text-xl font-black text-white">${d2.name}</h3>
              <div class="text-xs text-slate-400 mt-0.5">${pos2} · ${team2} · ${p2.age ? p2.age+' yrs' : 'Age N/A'}</div>
            </div>

          </div>
          <div class="space-y-1.5 text-xs">
            <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Priced Prop Plays</span><strong class="text-slate-300">${d2.playerProps?.length || 0}</strong></div>
          </div>
        </div>
        <button onclick="openPlayerModal('${d2.name.replace(/'/g, "\\'")}')" class="mt-3 text-xs w-full py-1.5 rounded-lg bg-amber-600/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition font-semibold">
          View Full Dossier
        </button>
      </div>
    </div>
  `;



  const p1Props = d1.playerProps || [];
  const p2Props = d2.playerProps || [];

  if (p1Props.length > 0 || p2Props.length > 0) {
    html += `
      <div class="glass rounded-xl p-4">
        <div class="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
          <span>💰</span> Active Prop Markets & Sportsbook Valuation
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <div class="font-bold text-cyan-400 mb-2">${d1.name} Prop Markets (${p1Props.length})</div>
            ${p1Props.length ? `
              <div class="space-y-1.5">
                ${p1Props.slice(0, 5).map(pr => `
                  <div class="p-2 rounded bg-slate-800/50 border border-slate-700/40 flex items-center justify-between">
                    <div>
                      <span class="font-semibold text-slate-200">${propsMarketLabels[pr.market] || pr.market}</span>
                      <div class="text-[10px] text-slate-400">${pr.venue} · ${pr.odds || '–'}</div>
                    </div>
                    <div class="text-right">
                      <span class="font-bold text-white">${pr.line} (${pr.side.toUpperCase()})</span>
                      <div class="text-[10px] ${pr.ev_pct>0?'text-emerald-400 font-bold':'text-slate-500'}">${pr.ev_pct?'+'+pr.ev_pct.toFixed(1)+'% EV':'–'}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-slate-500 text-xs">No active props priced</p>'}
          </div>

          <div>
            <div class="font-bold text-amber-400 mb-2">${d2.name} Prop Markets (${p2Props.length})</div>
            ${p2Props.length ? `
              <div class="space-y-1.5">
                ${p2Props.slice(0, 5).map(pr => `
                  <div class="p-2 rounded bg-slate-800/50 border border-slate-700/40 flex items-center justify-between">
                    <div>
                      <span class="font-semibold text-slate-200">${propsMarketLabels[pr.market] || pr.market}</span>
                      <div class="text-[10px] text-slate-400">${pr.venue} · ${pr.odds || '–'}</div>
                    </div>
                    <div class="text-right">
                      <span class="font-bold text-white">${pr.line} (${pr.side.toUpperCase()})</span>
                      <div class="text-[10px] ${pr.ev_pct>0?'text-emerald-400 font-bold':'text-slate-500'}">${pr.ev_pct?'+'+pr.ev_pct.toFixed(1)+'% EV':'–'}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-slate-500 text-xs">No active props priced</p>'}
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// ── 5. GLOBAL COMMAND PALETTE ──
let cmdPaletteActiveIndex = 0;
let cmdPaletteItems = [];

function openCommandPalette() {
  const modal = document.getElementById('commandPaletteModal');
  const input = document.getElementById('cmdPaletteInput');
  if (!modal || !input) return;
  modal.classList.add('active');
  input.value = '';
  input.focus();
  handleCommandSearch('');
}

function closeCommandPalette() {
  document.getElementById('commandPaletteModal')?.classList.remove('active');
}

function handleCommandSearch(q) {
  const resultsContainer = document.getElementById('cmdPaletteResults');
  if (!resultsContainer) return;
  const query = (q || '').trim().toLowerCase();

  cmdPaletteItems = [];

  const tabs = [
    { label: 'Home Dashboard', type: 'Tab', icon: '🏠', action: () => { showTab('home'); closeCommandPalette(); } },
    { label: `Week ${currentScheduleWeek} Schedule`, type: 'Tab', icon: '📅', action: () => { showScheduleWeek(currentScheduleWeek); closeCommandPalette(); } },
    { label: 'Teams & Rosters', type: 'Tab', icon: '🛡', action: () => { showTab('teams'); closeCommandPalette(); } },
    { label: 'League Standings (actual)', type: 'Tab', icon: '🏈', action: () => { showTab('league'); showLeague('standings'); closeCommandPalette(); } },
    { label: 'Season Player Stats (actual)', type: 'Tab', icon: '📈', action: () => { showTab('league'); showLeague('stats'); closeCommandPalette(); } },
    { label: 'Player Compare', type: 'Feature', icon: '⚖️', action: () => { openPlayerCompareModal(); closeCommandPalette(); } },
    { label: 'Edge Analytics (Props & Value)', type: 'Tab', icon: '💰', action: () => { window.open('https://edgeplay-analytics.pages.dev/props','_blank'); closeCommandPalette(); } },
    { label: 'Win Totals (Edge Analytics)', type: 'Tab', icon: '🏆', action: () => { window.open('https://edgeplay-analytics.pages.dev/win-totals','_blank'); closeCommandPalette(); } },
    { label: 'Matchup Center (Pro Preview & Next Gen Stats)', type: 'Tab', icon: '⚔️', action: () => { showTab('matchup'); closeCommandPalette(); } },
    { label: 'Next Gen Matchups 101', type: 'Guide', icon: '💡', action: () => { openMatchups101Modal(); closeCommandPalette(); } },
  ];
  for (const t of tabs) {
    if (!query || t.label.toLowerCase().includes(query)) cmdPaletteItems.push(t);
  }

  if (DATA.teams) {
    for (const tm of DATA.teams) {
      if (!query || tm.name.toLowerCase().includes(query) || tm.abbr?.toLowerCase().includes(query)) {
        cmdPaletteItems.push({
          label: `${tm.name} (${tm.abbr})`,
          type: 'Team',
          icon: '🏈',
          action: () => { openRoster(tm.name, 'offense'); closeCommandPalette(); }
        });
      }
    }
  }

  if (DATA.players) {
    let matchCount = 0;
    for (const p of DATA.players) {
      if (query && p.name && p.name.toLowerCase().includes(query)) {
        cmdPaletteItems.push({
          label: `${p.name} · ${p.pos || ''} (${p.ovr ? p.ovr+' OVR' : ''})`,
          type: 'Player',
          icon: '👤',
          action: () => { openPlayerModal(p.name); closeCommandPalette(); }
        });
        matchCount++;
        if (matchCount >= 20) break;
      }
    }
  }

  cmdPaletteActiveIndex = 0;
  renderCommandPaletteItems();
}

function renderCommandPaletteItems() {
  const container = document.getElementById('cmdPaletteResults');
  if (!container) return;

  if (cmdPaletteItems.length === 0) {
    container.innerHTML = '<div class="p-4 text-center text-xs text-slate-500">No matching items found.</div>';
    return;
  }

  container.innerHTML = cmdPaletteItems.slice(0, 30).map((item, idx) => {
    const isSel = idx === cmdPaletteActiveIndex;
    return `
      <div class="cmd-item ${isSel ? 'selected' : ''}" onclick="cmdPaletteItems[${idx}].action()">
        <span class="text-base">${item.icon}</span>
        <div class="flex-1 text-xs font-semibold text-slate-200">${item.label}</div>
        <span class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">${item.type}</span>
      </div>
    `;
  }).join('');
}

function handleCommandKeydown(e) {
  if (e.key === 'Escape') {
    closeCommandPalette();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (cmdPaletteActiveIndex < Math.min(cmdPaletteItems.length - 1, 29)) {
      cmdPaletteActiveIndex++;
      renderCommandPaletteItems();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (cmdPaletteActiveIndex > 0) {
      cmdPaletteActiveIndex--;
      renderCommandPaletteItems();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (cmdPaletteItems[cmdPaletteActiveIndex]) {
      cmdPaletteItems[cmdPaletteActiveIndex].action();
    }
  }
}

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    const modal = document.getElementById('commandPaletteModal');
    if (modal && modal.classList.contains('active')) {
      closeCommandPalette();
    } else {
      openCommandPalette();
    }
  }
});

