// ═══════════════════════════════════════════════════════════
// LEAGUE — actual standings + current-season statistics
// ═══════════════════════════════════════════════════════════
// Both panels read build-time artifacts written by
// scripts/build_league_data.js and published by the daily publisher
// (scripts/publish-daily.js). Standings are computed from completed
// regular-season finals already in schedule.json; statistics come from the
// free Sleeper weekly stats API. This is ACTUAL data only — no projection
// model is mixed in. Missing data renders
// as missing ("—" / "no completed weeks"), never as a zero.
let LEAGUE_STANDINGS = null;
let LEAGUE_STATS = null;
const LEAGUE_MISSING = {};
let currentLeagueSubTab = 'standings';
let leagueStatsCategory = 'passing';
let leagueStatsWeek = 'season';
let leagueStatsTeam = 'all';

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
}

// "updated 3h ago (2026-09-16T08:42:32Z)" — the artifact's own embedded
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
  return `<div class="glass rounded-xl p-5 text-xs text-slate-400">
    <div class="font-bold text-slate-300 mb-1">${homeEsc(what)} is not available</div>
    <div>${homeEsc(detail)}</div>
    <div class="mt-2 text-slate-500">Nothing is shown rather than an invented number.</div>
  </div>`;
}

function renderLeagueSubTabs(){
  const c = document.getElementById('leagueSubTabs');
  if (!c) return;
  const tabs = [
    ['standings', 'Standings', '🏈'],
    ['stats', 'Stats', '📈'],
  ];
  c.innerHTML = tabs.map(([key, label, icon]) =>
    `<button class="teams-subtab ${currentLeagueSubTab === key ? 'active' : ''}" onclick="showLeague('${key}')" title="${label}">` +
    `<span class="subtab-icon">${icon}</span>${label}</button>`
  ).join('');
}

async function showLeague(sub){
  currentLeagueSubTab = ['standings', 'stats'].includes(sub) ? sub : 'standings';
  renderLeagueSubTabs();
  const panels = { standings: 'leagueStandingsPanel', stats: 'leagueStatsPanel' };
  Object.entries(panels).forEach(([key, id]) =>
    document.getElementById(id)?.classList.toggle('hidden', key !== currentLeagueSubTab));
  await loadLeagueArtifacts();
  const stamp = document.getElementById('leagueFreshness');
  if (stamp) {
    const a = currentLeagueSubTab === 'standings' ? LEAGUE_STANDINGS : LEAGUE_STATS;
    stamp.textContent = a ? leagueUpdatedLabel(a) : '';
  }
  if (currentLeagueSubTab === 'standings') renderLeagueStandings();
  else renderLeagueStats();
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
    ? `${a.completed_games} completed game(s), through week ${a.through_week}`
    : 'no games completed yet';
  meta.innerHTML = `<span class="text-slate-300 font-semibold">${a.season} regular season</span> · ${playedLine}`
    + ` · source: ${homeEsc(a.source)} · ${leagueUpdatedLabel(a)}`;

  const row = (t) => {
    const pct = t.win_pct === null || t.win_pct === undefined ? '—' : t.win_pct.toFixed(3).replace(/^0/, '');
    const diff = t.differential > 0 ? `+${t.differential}` : String(t.differential);
    const pctClass = t.win_pct === null ? 'text-slate-500' : t.win_pct >= 0.5 ? 'text-emerald-400' : 'text-slate-300';
    return `<tr class="border-t border-slate-800/60">
      <td class="py-1.5 pr-2">
        <div class="flex items-center gap-2 min-w-0">
          <img src="${getNflTeamLogo(t.abbr)}" alt="" class="w-5 h-5 shrink-0" loading="lazy">
          <span class="font-mono text-[10px] text-slate-400 shrink-0">${homeEsc(t.abbr)}</span>
          <span class="text-slate-200 truncate">${homeEsc(t.team)}</span>
        </div>
      </td>
      <td class="py-1.5 px-1 text-right tabular-nums text-slate-300">${t.wins}</td>
      <td class="py-1.5 px-1 text-right tabular-nums text-slate-300">${t.losses}</td>
      <td class="py-1.5 px-1 text-right tabular-nums text-slate-300">${t.ties}</td>
      <td class="py-1.5 px-1 text-right tabular-nums ${pctClass}">${pct}</td>
      <td class="py-1.5 px-1 text-right tabular-nums text-slate-400">${t.points_for}</td>
      <td class="py-1.5 px-1 text-right tabular-nums text-slate-400">${t.points_against}</td>
      <td class="py-1.5 pl-1 text-right tabular-nums ${t.differential >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${diff}</td>
    </tr>`;
  };

  const divisionCard = (d) => `<div class="glass rounded-xl p-3 overflow-x-auto">
    <div class="text-[10px] uppercase tracking-wider font-bold text-amber-400 mb-1.5">${homeEsc(d.division)}</div>
    <table class="w-full text-xs border-collapse min-w-[420px]">
      <thead><tr class="text-[9px] uppercase tracking-wider text-slate-500">
        <th class="text-left font-bold pb-1">Team</th>
        <th class="text-right font-bold pb-1 px-1">W</th>
        <th class="text-right font-bold pb-1 px-1">L</th>
        <th class="text-right font-bold pb-1 px-1">T</th>
        <th class="text-right font-bold pb-1 px-1">PCT</th>
        <th class="text-right font-bold pb-1 px-1">PF</th>
        <th class="text-right font-bold pb-1 px-1">PA</th>
        <th class="text-right font-bold pb-1 pl-1">DIFF</th>
      </tr></thead>
      <tbody>${d.teams.map(row).join('')}</tbody>
    </table>
  </div>`;

  const conference = (name) => {
    const divs = a.divisions.filter(d => d.conference === name);
    if (!divs.length) return '';
    return `<section>
      <div class="text-sm font-black text-slate-200 mb-2">${homeEsc(name)}</div>
      <div class="grid gap-3 lg:grid-cols-2">${divs.map(divisionCard).join('')}</div>
    </section>`;
  };

  body.innerHTML = conference('AFC') + conference('NFC')
    + `<div class="text-[10px] text-slate-500 leading-relaxed pt-1">
      ${homeEsc(a.ordering_note || '')}
      <span class="block mt-1">${homeEsc(a.projection_note || '')}</span>
    </div>`;
}

function leagueStatsControls(){
  const c = document.getElementById('leagueStatsControls');
  if (!c) return;
  const a = LEAGUE_STATS;
  const cats = [['passing', 'Passing'], ['rushing', 'Rushing'], ['receiving', 'Receiving']];
  const weeks = (a && Array.isArray(a.completed_weeks)) ? a.completed_weeks : [];
  const teams = a && Array.isArray(a.team_totals)
    ? a.team_totals.map(t => t.abbr).sort()
    : [];
  const chip = (active) => `px-3 py-1.5 rounded-lg text-xs font-bold transition ${active
    ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/50'
    : 'bg-slate-800/80 text-slate-400 border border-transparent hover:bg-slate-700'}`;
  c.innerHTML = `
    <div class="flex items-center gap-1.5 flex-wrap">
      <span class="text-[10px] uppercase tracking-wider font-bold text-slate-500 mr-1">Stat</span>
      ${cats.map(([key, label]) => `<button class="${chip(leagueStatsCategory === key)}" onclick="setLeagueStatsCategory('${key}')">${label}</button>`).join('')}
    </div>
    <div class="flex items-center gap-2">
      <label class="text-[10px] uppercase tracking-wider font-bold text-slate-500" for="leagueStatsWeekSelect">Week</label>
      <select id="leagueStatsWeekSelect" onchange="setLeagueStatsWeek(this.value)" class="text-xs px-2.5 py-1.5 rounded border border-subtle bg-slate-900 text-slate-200">
        <option value="season"${leagueStatsWeek === 'season' ? ' selected' : ''}>Season to date</option>
        ${weeks.map(w => `<option value="${w}"${String(leagueStatsWeek) === String(w) ? ' selected' : ''}>Week ${w}</option>`).join('')}
      </select>
    </div>
    <div class="flex items-center gap-2">
      <label class="text-[10px] uppercase tracking-wider font-bold text-slate-500" for="leagueStatsTeamSelect">Team</label>
      <select id="leagueStatsTeamSelect" onchange="setLeagueStatsTeam(this.value)" class="text-xs px-2.5 py-1.5 rounded border border-subtle bg-slate-900 text-slate-200">
        <option value="all"${leagueStatsTeam === 'all' ? ' selected' : ''}>All teams</option>
        ${teams.map(t => `<option value="${t}"${leagueStatsTeam === t ? ' selected' : ''}>${t}</option>`).join('')}
      </select>
    </div>`;
}

function setLeagueStatsCategory(key){
  leagueStatsCategory = ['passing', 'rushing', 'receiving'].includes(key) ? key : 'passing';
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

function renderLeagueStats(){
  const meta = document.getElementById('leagueStatsMeta');
  const table = document.getElementById('leagueStatsTable');
  const totals = document.getElementById('leagueTeamTotals');
  if (!meta || !table) return;
  const a = LEAGUE_STATS;
  if (!a || !a.season_to_date) {
    leagueStatsControls();
    meta.innerHTML = '';
    table.innerHTML = leagueMissingPanel('Current-season statistics',
      'nfl_stats_2026.json was not published or did not load.');
    if (totals) totals.innerHTML = '';
    return;
  }
  leagueStatsControls();

  const weeks = Array.isArray(a.completed_weeks) ? a.completed_weeks : [];
  const isSeason = leagueStatsWeek === 'season';
  const source = isSeason ? a.season_to_date : (a.weeks && a.weeks[String(leagueStatsWeek)]);
  const coverage = weeks.length
    ? `completed week${weeks.length > 1 ? 's' : ''} ${weeks[0]}–${weeks[weeks.length - 1]}`
    : 'no completed weeks yet';
  meta.innerHTML = `<span class="text-slate-300 font-semibold">${a.season} regular season</span> · ${coverage}`
    + ` · source: ${homeEsc(a.source)} · ${leagueUpdatedLabel(a)}`
    + (isSeason ? '' : ` · showing week ${homeEsc(String(leagueStatsWeek))} only`);

  if (!isSeason && !source) {
    table.innerHTML = leagueMissingPanel(`Week ${leagueStatsWeek} statistics`,
      'That week has not finished, so no stats are published for it.');
  } else if (weeks.length === 0) {
    table.innerHTML = leagueMissingPanel('Current-season statistics',
      'No week has finished yet this season.');
  } else {
    const columns = LEAGUE_STAT_COLUMNS[leagueStatsCategory];
    const rows = (source[leagueStatsCategory] || []).filter(r =>
      leagueStatsTeam === 'all' || r.team === leagueStatsTeam);
    const body = rows.length ? rows.map((r, i) => `<tr class="border-t border-slate-800/60">
        <td class="py-1.5 pr-2 text-slate-500 tabular-nums">${i + 1}</td>
        <td class="py-1.5 pr-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-slate-200 font-semibold truncate">${homeEsc(r.name)}</span>
            <span class="font-mono text-[10px] text-slate-500 shrink-0">${homeEsc(r.pos || '—')}</span>
            <span class="font-mono text-[10px] text-slate-400 shrink-0">${homeEsc(r.team || 'FA')}</span>
          </div>
        </td>
        <td class="py-1.5 px-1 text-right tabular-nums text-slate-500">${r.games == null ? '—' : r.games}</td>
        ${columns.map(([key]) => `<td class="py-1.5 px-1 text-right tabular-nums text-slate-300">${r[key] == null ? '—' : r[key]}</td>`).join('')}
      </tr>`).join('')
      : `<tr><td colspan="${columns.length + 3}" class="py-3 text-center text-xs text-slate-500">No ${homeEsc(leagueStatsCategory)} rows for this filter.</td></tr>`;
    table.innerHTML = `<table class="w-full text-xs border-collapse min-w-[560px]">
      <thead><tr class="text-[9px] uppercase tracking-wider text-slate-500">
        <th class="text-left font-bold pb-1 pr-2">#</th>
        <th class="text-left font-bold pb-1 pr-2">Player</th>
        <th class="text-right font-bold pb-1 px-1">GP</th>
        ${columns.map(([, label]) => `<th class="text-right font-bold pb-1 px-1">${label}</th>`).join('')}
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
    <div class="text-[10px] text-slate-500 mt-2 leading-relaxed">${homeEsc(a.null_handling || '')}</div>`;
  }

  if (totals) {
    const t = Array.isArray(a.team_totals) ? a.team_totals : [];
    totals.innerHTML = !t.length
      ? ''
      : `<div class="text-xs font-bold text-slate-300 mb-2 flex items-center gap-2">
          <span>🧮</span> Team offense & defense totals
          <span class="text-slate-500 font-normal">actual, completed weeks only · points from schedule.json results</span>
        </div>
        <div class="glass rounded-xl p-3 overflow-x-auto">
          <table class="w-full text-xs border-collapse min-w-[620px]">
            <thead><tr class="text-[9px] uppercase tracking-wider text-slate-500">
              <th class="text-left font-bold pb-1 pr-2">Team</th>
              <th class="text-right font-bold pb-1 px-1">G</th>
              <th class="text-right font-bold pb-1 px-1">PF</th>
              <th class="text-right font-bold pb-1 px-1">PA</th>
              <th class="text-right font-bold pb-1 px-1">Pass Yds</th>
              <th class="text-right font-bold pb-1 px-1">Rush Yds</th>
              <th class="text-right font-bold pb-1 px-1">Total Yds</th>
              <th class="text-right font-bold pb-1 px-1">Off TD</th>
              <th class="text-right font-bold pb-1 pl-1">Yds Allowed</th>
            </tr></thead>
            <tbody>${t.map(r => `<tr class="border-t border-slate-800/60">
              <td class="py-1.5 pr-2">
                <div class="flex items-center gap-2 min-w-0">
                  <img src="${getNflTeamLogo(r.abbr)}" alt="" class="w-5 h-5 shrink-0" loading="lazy">
                  <span class="font-mono text-[10px] text-slate-400 shrink-0">${homeEsc(r.abbr)}</span>
                  <span class="text-slate-200 truncate">${homeEsc(r.team)}</span>
                </div>
              </td>
              <td class="py-1.5 px-1 text-right tabular-nums text-slate-500">${r.games}</td>
              <td class="py-1.5 px-1 text-right tabular-nums text-slate-300">${r.points_for}</td>
              <td class="py-1.5 px-1 text-right tabular-nums text-slate-300">${r.points_against}</td>
              <td class="py-1.5 px-1 text-right tabular-nums text-slate-300">${r.pass_yards}</td>
              <td class="py-1.5 px-1 text-right tabular-nums text-slate-300">${r.rush_yards}</td>
              <td class="py-1.5 px-1 text-right tabular-nums text-slate-400">${r.total_yards}</td>
              <td class="py-1.5 px-1 text-right tabular-nums text-slate-300">${r.offensive_tds}</td>
              <td class="py-1.5 pl-1 text-right tabular-nums text-slate-400">${r.yards_allowed}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>`;
  }
}

