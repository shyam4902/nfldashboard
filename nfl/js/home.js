// ═══════════════════════════════════════════════════════════
// HOME REDESIGN 2a — "Pregame studio" hero carousel + scorestrip
// + storylines + power index. Data-driven pieces (featured matchup,
// scorestrip, power index) read live repo data; the lead-story and
// Edge-promo slides plus the two storyline cards are editorial copy
// by design (they are promo/story slots in the mockup). No fabricated
// rank-movement arrows — there's no prior-week ranking in the data.
// ═══════════════════════════════════════════════════════════
// ── Shared game-state + featured-game helpers ──────────────────────────
// Used by both the home hero and the Schedule page so the "game of the
// week" never sits on a game that has already been played.

// A game is over once it carries a recorded result, or once its kickoff has
// passed (in progress counts — the featured slot should have moved on).
function gameIsOver(g){
  if (!g) return false;
  if (g.status === 'final' || g.status === 'in_progress' || g.winner) return true;
  const t = new Date(g.kickoff_utc).getTime();
  return !isNaN(t) && Date.now() >= t;
}

function gameEtDay(g){
  const d = new Date(g.kickoff_utc);
  return isNaN(d.getTime()) ? '' :
    d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' }).toUpperCase();
}

function gameEtHour(g){
  const d = new Date(g.kickoff_utc);
  if (isNaN(d.getTime())) return 13;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false
  }).formatToParts(d);
  const part = parts.find(p => p.type === 'hour');
  return part ? (parseInt(part.value, 10) % 24) : 13;
}

// Categories drive the Schedule filters and the featured ranking.
function gameCategories(game){
  if (!game.market) game.market = gameMarketLines(game);
  const tvUpper = String(game.tv || '').toUpperCase();
  const day = gameEtDay(game);
  const etHour = gameEtHour(game);

  // Sunday Night Football: Sunday ET kickoff that lands at or after 8pm ET (20:00+),
  // regardless of whether TV metadata says NBC or is empty/missing.
  const isSnf = (day === 'SUN' && etHour >= 20) || (day === 'SUN' && tvUpper.includes('NBC') && etHour >= 19);
  const isPrimetime = isSnf || tvUpper.includes('NBC') || tvUpper.includes('ESPN') || tvUpper.includes('ABC') ||
                      tvUpper.includes('NETFLIX') || tvUpper.includes('PRIME') || day === 'THU' || day === 'MON';

  const aDiv = (DATA.teams && DATA.teams[game.away_team] && DATA.teams[game.away_team].division) || '';
  const hDiv = (DATA.teams && DATA.teams[game.home_team] && DATA.teams[game.home_team].division) || '';
  const isDivisional = aDiv && hDiv && (aDiv === hDiv);

  const spreadVal = game.market && game.market.spread !== null ? Math.abs(game.market.spread) : null;
  const isClose = spreadVal !== null && spreadVal <= 3.0;
  const totalVal = game.market && game.market.total !== null ? game.market.total : null;
  const isHighTotal = totalVal !== null && totalVal >= 47.0;

  const cats = ['all'];
  if (isPrimetime) cats.push('primetime');
  if (isSnf) cats.push('snf');
  if (isDivisional) cats.push('divisional');
  if (isClose) cats.push('close');
  if (isHighTotal) cats.push('high-total');
  return cats;
}

// Sunday night is the league's marquee window, so it outranks other primetime.
function featuredScore(g){
  const c = g._categories || gameCategories(g);
  return (c.includes('snf') ? 4 : 0) + (c.includes('primetime') ? 3 : 0) +
         (c.includes('divisional') ? 2 : 0) + (c.includes('close') ? 2 : 0) +
         (c.includes('high-total') ? 1 : 0);
}

// Best n games still to be played, in kickoff order. Falls back to the whole
// slate once every game in the week is done (end of week — nothing upcoming).
function pickFeaturedGames(games, n){
  const live = games.filter(g => !gameIsOver(g));
  const pool = live.length ? live : games;
  return pool
    .map((g, i) => ({ g: g, i: i, s: featuredScore(g) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map(x => x.g);
}

function home2aWeekGames(){
  const games = (SCHEDULE_DATA && SCHEDULE_DATA.games) ? SCHEDULE_DATA.games : [];
  const wk = typeof currentScheduleWeek === 'number' ? currentScheduleWeek : 1;
  const inWeek = games.filter(g => (g.week || 1) === wk);
  const pool = inWeek.length ? inWeek : games;
  return pool.slice().sort((a, b) => String(a.kickoff_utc || '').localeCompare(String(b.kickoff_utc || '')));
}

function home2aScorestrip(games){
  const strip = games.slice(0, 7);
  if (!strip.length) return '';
  const cells = strip.map(g => {
    g.market = gameMarketLines(g);
    const m = g.market;
    const prob = marketWinProb(m);
    const hPct = prob === null ? 50 : Math.round(prob * 100);
    const aPct = 100 - hPct;
    const aColor = DATA.teamColors[g.away_team] || '#64748b';
    const hColor = DATA.teamColors[g.home_team] || '#64748b';
    const aAbbr = teamAbbrFor(g.away_team) || g.away_team;
    const hAbbr = teamAbbrFor(g.home_team) || g.home_team;
    const d = new Date(g.kickoff_utc);
    const when = isNaN(d.getTime()) ? 'TBD' : d.toLocaleString([], { weekday:'short', hour:'numeric', minute:'2-digit' }).toUpperCase();
    const tv = g.tv ? (' · ' + g.tv.split('/')[0].trim().toUpperCase()) : '';
    const aSpread = m && m.spread !== null ? ((m.spread > 0 ? '+' : '') + m.spread) : '';
    const homeFav = hPct >= aPct;
    // Played games show the result, not a pregame line.
    const done = g.status === 'final' || g.winner;
    const hasScore = g.away_score != null && g.home_score != null;
    const label = done && hasScore
      ? (g.status === 'in_progress' ? 'LIVE' : 'FINAL')
      : homeEsc(when) + homeEsc(tv);
    const awayWon = hasScore && g.away_score > g.home_score;
    const aRight = done && hasScore
      ? `<span style="font:700 16px/1 var(--font-serif);color:${awayWon ? '#fff' : '#868a91'}">${g.away_score}</span>`
      : `<span style="font:600 12px var(--font-sans);color:${homeFav ? '#868a91' : '#7cc49b'}">${homeFav ? homeEsc(aSpread) : (prob === null ? '' : aPct + '%')}</span>`;
    const hRight = done && hasScore
      ? `<span style="font:700 16px/1 var(--font-serif);color:${awayWon ? '#868a91' : '#fff'}">${g.home_score}</span>`
      : `<span style="font:700 12px var(--font-sans);color:${homeFav ? '#7cc49b' : '#868a91'}">${homeFav && prob !== null ? hPct + '%' : ''}</span>`;
    return `<div class="h2a-game" onclick="openMatchup('${homeEsc(g.game_id)}')">
      <div class="h2a-game-time" style="${done && hasScore ? 'color:#d9a441;font-weight:800' : ''}">${label}</div>
      <div class="h2a-team-row"><span class="h2a-team-name"><img src="${getNflTeamLogo(g.away_team)}" alt="" style="width:20px;height:20px;object-fit:contain;flex:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))" loading="lazy"><span style="font:700 14px var(--font-sans);color:${(done && hasScore) ? (awayWon ? '#fff' : '#868a91') : (homeFav ? '#c9ccd1' : '#fff')}">${homeEsc(aAbbr)}</span></span>${aRight}</div>
      <div class="h2a-team-row"><span class="h2a-team-name"><img src="${getNflTeamLogo(g.home_team)}" alt="" style="width:20px;height:20px;object-fit:contain;flex:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))" loading="lazy"><span style="font:700 14px var(--font-sans);color:${(done && hasScore) ? (awayWon ? '#868a91' : '#fff') : (homeFav ? '#fff' : '#c9ccd1')}">${homeEsc(hAbbr)}</span></span>${hRight}</div>
    </div>`;
  }).join('');
  return `<div class="h2a-strip">
    <div class="h2a-strip-lead">
      <div style="font:700 18px/1 var(--font-serif);color:#fff">Week ${typeof currentScheduleWeek === 'number' ? currentScheduleWeek : 1}</div>
      <div style="font:600 12px var(--font-sans);color:#868a91;white-space:nowrap;margin-top:4px">${games.length} games</div>
    </div>
    <div class="h2a-strip-games"><div class="h2a-strip-inner">${cells}
      <div class="h2a-game" style="flex:0 0 126px;display:flex;flex-direction:column;justify-content:center;gap:4px;border-right:0" onclick="showScheduleWeek(${currentScheduleWeek})">
        <div style="font:700 11px var(--font-sans);color:#d9a441">All ${games.length} games →</div>
        <div style="font:400 10px var(--font-sans);color:#868a91">Market win % + live lines</div>
      </div>
    </div></div>
  </div>`;
}

function homeRedesign2aHtml(){
  const games = home2aWeekGames();
  const feat = pickFeaturedGames(games, 1)[0];
  if (feat) feat.market = gameMarketLines(feat);
  const kicker = feat ? (gameIsOver(feat) ? 'Featured result' : 'Featured matchup') + ' · Week ' + homeEsc(feat.week || currentScheduleWeek) : '';
  const hero = feat
    ? `<div class="hm-kick"><span>${kicker}</span><span class="hm-src">Win % from the moneylines, no-vig</span></div>
      ${renderMatchupHeroBanner(feat, feat.away_team, feat.home_team)}
      <div class="hm-act">
        <button type="button" class="hm-btn hm-btn-gold" onclick="openMatchup('${homeEsc(feat.game_id)}')">View matchup →</button>
        <button type="button" class="hm-btn" onclick="openCompare('${homeEsc(feat.away_team)}','${homeEsc(feat.home_team)}')">Compare rosters</button>
      </div>`
    : '<div class="hm-empty">Featured matchup loads with the schedule…</div>';
  return `<div class="h2a-wrap hm">
    <div class="h2a-hero" id="h2aHero">${hero}</div>
    ${home2aScorestrip(games)}
  </div>
  <a class="hm-edge" href="https://edgeplay-analytics.pages.dev" target="_blank" rel="noopener"><b>Edge Analytics</b><span>Props, win totals and lines graded against six books</span><i aria-hidden="true">↗</i></a>`;
}

async function renderHome(){
  const hero = document.getElementById('homeHero');
  const front = document.getElementById('homeFrontDoor');
  const show = document.getElementById('homeShowcase');
  const spots = document.getElementById('homeSpotlights');
  const stats = document.getElementById('homeStats');
  if (!hero || !show || !spots) return;
  // Home redesign 2a owns the hero, front door and showcase region.
  hero.innerHTML = homeRedesign2aHtml();
  if (front) front.innerHTML = '';
  if (show) show.innerHTML = '';
  // Owner, 2026-11-05: home keeps the featured matchup and the week's key
  // matchups. Top Model Bets, Top Value Plays and the League Overview counters
  // are gone (Edge carries the betting reads).
  if (stats) stats.innerHTML = '';
  spots.innerHTML = '<div class="text-xs text-slate-500 p-4">Loading key matchups\u2026</div>';
  // The featured scorebug is the Matchup page's (nflLib + standings).
  await Promise.all([
    loadSchedule().catch(() => null),
    nflLibLoad().catch(() => null),
    (!LEAGUE_STANDINGS && !LEAGUE_MISSING.standings
      ? fetchLeagueArtifact(['/data/shared/nfl_standings_2026.json', '/nfl_standings_2026.json'], 'standings').then(d => { LEAGUE_STANDINGS = LEAGUE_STANDINGS || d; })
      : Promise.resolve()),
  ]);
  // Re-render the 2a hero now that schedule data is in (featured matchup and
  // scorestrip read live data).
  hero.innerHTML = homeRedesign2aHtml();
  const fill = () => {
    return marqueeHtml() || '<div class="text-xs text-slate-500">Key matchups unavailable right now.</div>';
  };
  spots.innerHTML = fill();
  // Game lines arrive after first paint; refresh the hero (spreads/ML) and spotlights once.
  loadGameLines().then(() => {
    if (SCHEDULE_DATA) {
      hero.innerHTML = homeRedesign2aHtml();
      spots.innerHTML = fill();
    }
  });
}


