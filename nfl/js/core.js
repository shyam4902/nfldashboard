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


// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// HOME TAB — first-run showcase of everything the app does
function homeEsc(s){
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function marqueeGameHtml(g){ return nflGameTile(g, 'home-sch-card'); }

// Home: the next six games of the week (finished ones fill in once fewer
// than six are left), in the same tiles as the Schedule page.
function marqueeHtml(){
  if (!SCHEDULE_DATA || !SCHEDULE_DATA.games || !SCHEDULE_DATA.games.length) return null;
  const marqueeWeek = SCHEDULE_DATA.week || 1;
  const sorted = SCHEDULE_DATA.games
    .filter(g => (g.week || 1) === marqueeWeek)
    .sort((a, b) => String(a.kickoff_utc || '').localeCompare(String(b.kickoff_utc || '')));
  const ahead = sorted.filter(g => !gameIsOver(g));
  const picks = ahead.concat(sorted.filter(g => gameIsOver(g)).reverse()).slice(0, 6);
  return `<section class="hm-week">
    <div class="hm-week-hd">
      <h2>Week ${marqueeWeek}</h2>
      <span>${ahead.length ? ahead.length + ' of ' + sorted.length + ' games to play' : 'All ' + sorted.length + ' games final'}</span>
      <a href="javascript:showTab('schedule')">All ${sorted.length} games →</a>
    </div>
    <div class="sch-game-grid">${picks.map(marqueeGameHtml).join('')}</div>
  </section>`;
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

