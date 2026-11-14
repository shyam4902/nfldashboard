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

function home2aFeaturedSlide(feat){
  if (!feat) return `<div class="h2a-slide-pad" style="display:flex;align-items:center;justify-content:center;min-height:200px"><span style="font:500 13px var(--font-sans);color:#8f9299">Featured matchup loads with the schedule…</span></div>`;
  feat.market = gameMarketLines(feat);
  const m = feat.market;
  const prob = marketWinProb(m);
  const hPct = prob === null ? 50 : Math.round(prob * 100);
  const aPct = 100 - hPct;
  const aColor = DATA.teamColors[feat.away_team] || '#b23a35';
  const hColor = DATA.teamColors[feat.home_team] || '#69BE28';
  const aAbbr = teamAbbrFor(feat.away_team) || feat.away_team;
  const hAbbr = teamAbbrFor(feat.home_team) || feat.home_team;
  const d = new Date(feat.kickoff_utc);
  const dateLine = [
    isNaN(d.getTime()) ? 'KICKOFF TBD' : d.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }).toUpperCase(),
    feat.venue ? feat.venue.toUpperCase() : null,
    feat.tv ? feat.tv.toUpperCase() : null,
  ].filter(Boolean).join(' · ');
  const aSpread = m && m.spread !== null ? ((m.spread > 0 ? '+' : '') + m.spread) : '—';
  const hSpread = m && m.spread !== null ? ((-m.spread > 0 ? '+' : '') + (-m.spread)) : '—';
  const aMl = m && m.away_ml != null ? (m.away_ml > 0 ? '+' + m.away_ml : String(m.away_ml)) : '—';
  const hMl = m && m.home_ml != null ? (m.home_ml > 0 ? '+' + m.home_ml : String(m.home_ml)) : '—';
  const total = m && m.total != null ? m.total : '—';
  const cut = (color, side, team) => {
    const logo = getNflTeamLogo(team);
    return `<div style="width:118px;height:150px;border-radius:10px;border:1px solid ${color}44;background:linear-gradient(180deg,rgba(255,255,255,.03) 0%,rgba(0,0,0,.35) 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;flex:none;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,${color}25 0%,transparent 70%);pointer-events:none"></div>
      <img src="${logo}" alt="${homeEsc(team)}" style="width:68px;height:68px;object-fit:contain;position:relative;z-index:1;filter:drop-shadow(0 4px 10px rgba(0,0,0,.6))" loading="lazy">
      <span class="h2a-mono" style="font:800 10px var(--font-mono);letter-spacing:.14em;color:${color};position:relative;z-index:1">${homeEsc(side)}</span>
    </div>`;
  };
  return `<div class="h2a-slide-pad">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap">
      <span class="h2a-kicker" style="color:#fff;background:${aColor}">FEATURED MATCHUP</span>
      <span class="h2a-mono" style="font:600 11px var(--font-mono);color:#b4b7bc">${homeEsc(dateLine)}</span>
    </div>
    <div class="h2a-matchup" style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:24px">
      <div style="display:flex;align-items:center;gap:18px">
        ${cut(aColor, aAbbr, feat.away_team)}
        <div>
          <div class="h2a-mono" style="font:800 10px var(--font-mono);letter-spacing:.14em;color:${aColor}">AWAY</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:7px">
            <img src="${getNflTeamLogo(feat.away_team)}" alt="" style="width:28px;height:28px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))" loading="lazy">
            <span class="h2a-arch" style="font:800 30px/1 'Archivo',sans-serif;letter-spacing:-.02em;color:#fff">${homeEsc((aAbbr||'').toUpperCase())}</span>
          </div>
          <div style="font:500 13px var(--font-sans);color:#c8ccd2;margin-top:4px">${homeEsc(feat.away_team)}</div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-top:14px">
            <span class="h2a-mono" style="font:900 40px/1 var(--font-mono);color:#fff">${prob === null ? '—' : aPct + '<span style="font-size:19px">%</span>'}</span>
            <span style="font:500 11px var(--font-sans);color:#9aa0a8">market win<br>probability</span>
          </div>
          <div class="h2a-mono" style="font:600 12px var(--font-mono);color:#dbd9d4;margin-top:10px;border:1px solid ${aColor}66;border-radius:5px;padding:5px 9px;display:inline-block">${homeEsc(aSpread)} &nbsp;·&nbsp; ML ${homeEsc(aMl)}</div>
        </div>
      </div>
      <div style="text-align:center">
        <div class="h2a-mono" style="font:800 11px var(--font-mono);letter-spacing:.2em;color:#8f9299">AT</div>
        <div style="width:1px;height:76px;background:linear-gradient(180deg,transparent,rgba(255,255,255,.2),transparent);margin:10px auto"></div>
        <div class="h2a-mono" style="font:600 11px var(--font-mono);color:#b4b7bc">O/U ${homeEsc(total)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:18px;justify-content:flex-end;text-align:right">
        <div>
          <div class="h2a-mono" style="font:800 10px var(--font-mono);letter-spacing:.14em;color:${hColor}">HOME</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:7px;justify-content:flex-end">
            <span class="h2a-arch" style="font:800 30px/1 'Archivo',sans-serif;letter-spacing:-.02em;color:#fff">${homeEsc((hAbbr||'').toUpperCase())}</span>
            <img src="${getNflTeamLogo(feat.home_team)}" alt="" style="width:28px;height:28px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))" loading="lazy">
          </div>
          <div style="font:500 13px var(--font-sans);color:#c8ccd2;margin-top:4px">${homeEsc(feat.home_team)}</div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-top:14px;justify-content:flex-end">
            <span style="font:500 11px var(--font-sans);color:#9aa0a8">market win<br>probability</span>
            <span class="h2a-mono" style="font:900 40px/1 var(--font-mono);color:${hColor}">${prob === null ? '—' : hPct + '<span style="font-size:19px">%</span>'}</span>
          </div>
          <div class="h2a-mono" style="font:600 12px var(--font-mono);color:#dbd9d4;margin-top:10px;border:1px solid ${hColor}66;border-radius:5px;padding:5px 9px;display:inline-block">${homeEsc(hSpread)} &nbsp;·&nbsp; ML ${homeEsc(hMl)}</div>
        </div>
        ${cut(hColor, hAbbr, feat.home_team)}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:2px;margin-top:20px;height:8px;border-radius:4px;overflow:hidden;background:rgba(255,255,255,.06)">
      <div style="width:${aPct}%;height:100%;background:${aColor}"></div><div style="width:${hPct}%;height:100%;background:${hColor}"></div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        <span class="h2a-btn-amber" onclick="openMatchup('${homeEsc(feat.game_id)}')">View matchup →</span>
        <span class="h2a-btn-ghost" onclick="openCompare('${homeEsc(feat.away_team)}','${homeEsc(feat.home_team)}')">Compare rosters</span>
        <button type="button" class="h2a-btn-ghost" data-away="${homeEsc(feat.away_team)}" data-home="${homeEsc(feat.home_team)}" onclick="openNflCompareTeams(this.dataset.away, this.dataset.home, event)">Compare teams</button>
      </div>
      <span class="h2a-mono" style="font:500 10px var(--font-mono);color:#8fa6bf">WIN % FROM THE MONEYLINES · NO-VIG</span>
    </div>
  </div>`;
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
      ? `<span class="h2a-mono" style="font:700 12px var(--font-mono);color:${awayWon ? '#fff' : '#868a91'}">${g.away_score}</span>`
      : `<span class="h2a-mono" style="font:600 11px var(--font-mono);color:${homeFav ? '#868a91' : '#7cc49b'}">${homeFav ? homeEsc(aSpread) : (prob === null ? '' : aPct + '%')}</span>`;
    const hRight = done && hasScore
      ? `<span class="h2a-mono" style="font:700 12px var(--font-mono);color:${awayWon ? '#868a91' : '#fff'}">${g.home_score}</span>`
      : `<span class="h2a-mono" style="font:700 11px var(--font-mono);color:${homeFav ? '#7cc49b' : '#868a91'}">${homeFav && prob !== null ? hPct + '%' : ''}</span>`;
    return `<div class="h2a-game" onclick="openMatchup('${homeEsc(g.game_id)}')">
      <div class="h2a-game-time" style="${done && hasScore ? 'color:#d9a441;font-weight:800' : ''}">${label}</div>
      <div class="h2a-team-row"><span class="h2a-team-name"><img src="${getNflTeamLogo(g.away_team)}" alt="" style="width:16px;height:16px;object-fit:contain;flex:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))" loading="lazy"><span style="font:700 12px var(--font-sans);color:${(done && hasScore) ? (awayWon ? '#fff' : '#868a91') : (homeFav ? '#c9ccd1' : '#fff')}">${homeEsc(aAbbr)}</span></span>${aRight}</div>
      <div class="h2a-team-row"><span class="h2a-team-name"><img src="${getNflTeamLogo(g.home_team)}" alt="" style="width:16px;height:16px;object-fit:contain;flex:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))" loading="lazy"><span style="font:700 12px var(--font-sans);color:${(done && hasScore) ? (awayWon ? '#868a91' : '#fff') : (homeFav ? '#fff' : '#c9ccd1')}">${homeEsc(hAbbr)}</span></span>${hRight}</div>
    </div>`;
  }).join('');
  return `<div class="h2a-strip">
    <div class="h2a-strip-lead">
      <div class="h2a-mono" style="font:800 9px var(--font-mono);letter-spacing:.12em;color:#d9a441">WEEK ${typeof currentScheduleWeek === 'number' ? currentScheduleWeek : 1}</div>
      <div style="font:600 11px var(--font-sans);color:#e9e7e3;white-space:nowrap">${games.length} games</div>
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
  return `<style>
    .h2a-wrap{background:#14161a;border:1px solid #2b3037;border-radius:16px;overflow:hidden}
    .h2a-mono{font-family:var(--font-mono)}.h2a-arch{font-family:'Archivo',sans-serif}
    .h2a-hero{position:relative;overflow:hidden;border-bottom:1px solid #2b3037;height:436px}
    .h2a-track{display:flex;width:300%;height:100%;transition:transform .8s cubic-bezier(.16,1,.3,1)}
    .h2a-slide{flex:0 0 33.3333%;position:relative;overflow:hidden}
    .h2a-slide-pad{position:relative;padding:26px 28px}
    .h2a-kicker{font:800 10px var(--font-mono);letter-spacing:.16em;border-radius:3px;padding:4px 8px}
    .h2a-btn-amber{font:700 12px var(--font-sans);color:#17140f;background:#d9a441;border-radius:6px;padding:10px 18px;cursor:pointer}
    .h2a-btn-amber:hover{background:#e6b556}
    .h2a-btn-ghost{font:700 12px var(--font-sans);color:#e9e7e3;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:10px 18px;cursor:pointer}
    .h2a-btn-ghost:hover{border-color:rgba(255,255,255,.4)}
    .h2a-dots{position:absolute;left:28px;bottom:14px;display:flex;align-items:center;gap:10px;z-index:2}
    .h2a-dot{width:8px;height:8px;border-radius:4px;cursor:pointer;transition:width .3s ease,background-color .3s ease;background:rgba(255,255,255,.22)}
    .h2a-dot.on{width:26px;background:#d9a441}
    .h2a-dot-label{font:500 10px var(--font-mono);color:#8f9299;margin-left:6px}
    .h2a-arrows{position:absolute;right:24px;bottom:12px;display:flex;gap:8px;z-index:2}
    .h2a-arrow{width:30px;height:30px;border-radius:6px;border:1px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;cursor:pointer;background:rgba(0,0,0,.25)}
    .h2a-arrow:hover{border-color:rgba(255,255,255,.45)}
    .h2a-strip{display:flex;align-items:center;background:#1a1d22;border-bottom:1px solid #2b3037}
    .h2a-strip-lead{display:flex;flex-direction:column;justify-content:center;padding:0 16px;border-right:1px solid #2b3037;height:66px;flex:none}
    .h2a-strip-games{flex:1;overflow-x:auto}
    .h2a-strip-inner{display:flex;width:100%;min-width:760px}
    .h2a-game{flex:1 1 0;min-width:0;padding:10px 14px;border-right:1px solid #262a31;cursor:pointer}
    .h2a-game:hover{background:rgba(255,255,255,.02)}
    .h2a-game-time{font:600 9px var(--font-mono);color:#868a91;margin-bottom:5px}
    .h2a-team-row{display:flex;justify-content:space-between;align-items:center}
    .h2a-team-row+.h2a-team-row{margin-top:3px}
    .h2a-team-name{display:flex;align-items:center;gap:6px}
    .h2a-cbar{width:3px;height:12px;border-radius:1px}
    .h2a-lower{display:block}
    .h2a-lower-l{padding:24px 26px}
    .h2a-stories{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    .h2a-pi-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #262a31;cursor:pointer}
    .h2a-pi-row:last-child{border-bottom:0}
    .h2a-pi-row:hover{background:rgba(255,255,255,.02)}
    .h2a-pi-badge{width:22px;height:22px;border-radius:4px;display:flex;align-items:center;justify-content:center;font:800 9px var(--font-mono);color:#fff}
    @media (max-width:960px){
      .h2a-hero{height:auto}.h2a-slide-pad{padding:20px 16px}
      .h2a-matchup{grid-template-columns:1fr!important;gap:16px!important}
      .h2a-split{grid-template-columns:1fr!important;gap:20px!important}
      .h2a-stories{grid-template-columns:1fr}
    }
  </style>
  <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <pattern id="h2aPh1" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#0f1826"></rect><rect width="3" height="8" fill="#152234"></rect></pattern>
    <pattern id="h2aPh2" width="7" height="7" patternTransform="rotate(60)" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="rgba(255,255,255,.03)"></rect><rect width="2.5" height="7" fill="rgba(255,255,255,.07)"></rect></pattern>
  </defs></svg>
  <div class="h2a-wrap">
    <div class="h2a-hero" id="h2aHero">
      <div class="h2a-track" id="h2aTrack">
        <!-- SLIDE 1 — FEATURED MATCHUP (data-driven) -->
        <div class="h2a-slide" style="background:linear-gradient(105deg,#2a1a1c 0%,#1e1b20 44%,#1b201c 100%)">
          <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 20% 0%,rgba(198,12,48,.16) 0%,transparent 55%),radial-gradient(ellipse at 82% 12%,rgba(105,190,40,.10) 0%,transparent 52%)"></div>
          ${home2aFeaturedSlide(feat)}
        </div>
        <!-- SLIDE 3 — EDGE PROMO (editorial) -->
        <div class="h2a-slide" style="background:linear-gradient(100deg,#1e241f 0%,#1b2126 52%,#191c21 100%)">
          <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 14% 18%,rgba(217,164,65,.09) 0%,transparent 55%)"></div>
          <div class="h2a-slide-pad h2a-split" style="display:grid;grid-template-columns:1fr 520px;gap:40px;align-items:center;height:100%">
            <div>
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
                <span class="h2a-kicker" style="color:#b4b7bc;border:1px solid rgba(255,255,255,.18)">FROM OUR OTHER APP</span>
                <span class="h2a-mono" style="font:600 11px var(--font-mono);color:#93a394">EDGE ANALYTICS · 6 SPORTSBOOKS</span>
              </div>
              <h2 class="h2a-arch" style="margin:0;font:800 38px/1.08 'Archivo',sans-serif;letter-spacing:-.028em;color:#fff;max-width:580px;text-wrap:pretty">Want the number behind the number? Edge grades every prop against the model.</h2>
              <p style="margin:14px 0 0;font:400 14px/1.65 var(--font-sans);color:#a9aeaa;max-width:540px;text-wrap:pretty">Calibrated edge, per-market backtest evidence, line movement and win totals across Kalshi, DraftKings, BetMGM, FanDuel, Caesars and Polymarket. This hub stays the reading room; Edge is the terminal.</p>
              <div style="display:flex;gap:10px;margin-top:20px">
                <a class="h2a-btn-amber" href="https://edgeplay-analytics.pages.dev" target="_blank" rel="noopener">Open Edge Analytics ↗</a>
                <span class="h2a-btn-ghost" onclick="window.open('https://edgeplay-analytics.pages.dev/model-lab','_blank')">How the model is graded</span>
              </div>
            </div>
            <div style="background:rgba(255,255,255,.03);border:1px solid #2b3037;border-radius:10px;padding:20px">
              <div style="display:flex;align-items:center;justify-content:space-between">
                <div style="font:500 11px var(--font-sans);color:#9fb08d">Deep value lives in Edge</div>
                <div class="h2a-mono" style="font:700 9px var(--font-mono);color:#d9a441;background:rgba(217,164,65,.1);border:1px solid rgba(217,164,65,.25);border-radius:3px;padding:2px 6px">LIVE TERMINAL</div>
              </div>
              <div class="h2a-arch" style="font:800 22px/1.2 'Archivo',sans-serif;color:#fff;margin-top:6px">Props · Win totals · Lines</div>
              <div style="font:500 12px var(--font-sans);color:#a9aeaa;margin-top:2px">Model edge vs six books, backtested per market</div>
              <div style="display:flex;align-items:flex-end;gap:4px;margin-top:18px;height:52px">
                <span style="flex:1;height:34%;background:rgba(255,255,255,.1);border-radius:1px"></span><span style="flex:1;height:52%;background:rgba(255,255,255,.1);border-radius:1px"></span><span style="flex:1;height:44%;background:rgba(255,255,255,.12);border-radius:1px"></span><span style="flex:1;height:66%;background:rgba(124,196,155,.35);border-radius:1px"></span><span style="flex:1;height:58%;background:rgba(124,196,155,.5);border-radius:1px"></span><span style="flex:1;height:80%;background:#7cc49b;border-radius:1px"></span><span style="flex:1;height:100%;background:#7cc49b;border-radius:1px"></span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px">
                <span class="h2a-mono" style="font:700 9px var(--font-mono);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:2px 6px;color:#c9ccd1">KALSHI</span>
                <span class="h2a-mono" style="font:700 9px var(--font-mono);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:2px 6px;color:#c9ccd1">POLYMARKET</span>
                <span class="h2a-mono" style="font:700 9px var(--font-mono);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:2px 6px;color:#c9ccd1">DRAFTKINGS</span>
                <span class="h2a-mono" style="font:700 9px var(--font-mono);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:2px 6px;color:#c9ccd1">FANDUEL</span>
                <span class="h2a-mono" style="font:700 9px var(--font-mono);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:2px 6px;color:#c9ccd1">BETMGM</span>
                <span class="h2a-mono" style="font:700 9px var(--font-mono);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:2px 6px;color:#c9ccd1">CAESARS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="h2a-dots">
        <span class="h2a-dot on" data-go="0"></span>
        <span class="h2a-dot" data-go="1"></span>
        <span class="h2a-dot-label" id="h2aDotLabel">1 / 2 · FEATURED MATCHUP</span>
      </div>
      <div class="h2a-arrows">
        <span class="h2a-arrow" id="h2aPrev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e9e7e3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"></path></svg></span>
        <span class="h2a-arrow" id="h2aNext"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e9e7e3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg></span>
      </div>
    </div>
    ${home2aScorestrip(games)}
    <div class="h2a-lower">
      <div class="h2a-lower-l">
        <div style="font:800 13px var(--font-sans);color:#fff;margin-bottom:16px">Storylines going into kickoff</div>
        <div class="h2a-stories">
          <div>
            <div style="height:150px;border-radius:8px;border:1px solid #2b3037;background:linear-gradient(135deg,#1b1417 0%,#191e28 100%);position:relative;overflow:hidden;padding:16px;display:flex;flex-direction:column;justify-content:space-between">
              <div style="display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1">
                <div style="display:flex;align-items:center;gap:8px">
                  <img src="${getNflTeamLogo(feat?.away_team)}" alt="${homeEsc(feat?.away_team)}" style="width:22px;height:22px;object-fit:contain">
                  <span class="h2a-mono" style="font:700 10px var(--font-mono);color:#868a91">AT</span>
                  <img src="${getNflTeamLogo(feat?.home_team)}" alt="${homeEsc(feat?.home_team)}" style="width:22px;height:22px;object-fit:contain">
                </div>
                <span class="h2a-mono" style="font:700 9px var(--font-mono);color:#e50914;background:rgba(229,9,20,.12);border:1px solid rgba(229,9,20,.3);border-radius:3px;padding:2px 6px">WEEK ${currentScheduleWeek}</span>
              </div>
              <div style="position:relative;z-index:1">
                <div class="h2a-arch" style="font:800 13px var(--font-sans);color:#fff">${homeEsc(feat?.venue || 'Full schedule')}</div>
                <div class="h2a-mono" style="font:500 11px var(--font-mono);color:#a2a5ab;margin-top:2px">${feat ? homeEsc(new Date(feat.kickoff_utc).toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })) : 'Kickoff times loading'}</div>
              </div>
            </div>
            <div class="h2a-mono" style="font:800 9px var(--font-mono);letter-spacing:.14em;color:#69BE28;margin-top:10px">SCHEDULE</div>
            <div style="font:700 16px/1.3 var(--font-sans);color:#fff;margin-top:6px;text-wrap:pretty">The full Week ${currentScheduleWeek} slate, with results and upcoming matchups</div>
            <div style="font:400 11px/1.6 var(--font-sans);color:#a2a5ab;margin-top:6px">Win percentages come from the live nflverse moneylines with the bookmaker margin removed.</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function initHomeCarousel(){
  const track = document.getElementById('h2aTrack');
  const heroEl = document.getElementById('h2aHero');
  if (!track || !heroEl) return;
  if (window.__h2aTimer) { clearInterval(window.__h2aTimer); window.__h2aTimer = null; }
  const dots = Array.prototype.slice.call(heroEl.querySelectorAll('.h2a-dot'));
  const label = document.getElementById('h2aDotLabel');
  const LABELS = ['FEATURED MATCHUP', 'EDGE ANALYTICS'];
  let i = 0, paused = false;
  const render = () => {
    track.style.transform = 'translateX(-' + (i * 50) + '%)';
    dots.forEach((d, n) => d.classList.toggle('on', n === i));
    if (label) label.textContent = (i + 1) + ' / 2 · ' + LABELS[i] + (paused ? ' · PAUSED' : '');
  };
  const go = n => { i = (n + 2) % 2; render(); };
  const nextBtn = document.getElementById('h2aNext');
  const prevBtn = document.getElementById('h2aPrev');
  if (nextBtn) nextBtn.addEventListener('click', () => go(i + 1));
  if (prevBtn) prevBtn.addEventListener('click', () => go(i + 1));
  dots.forEach(d => d.addEventListener('click', () => go(+d.dataset.go)));
  heroEl.addEventListener('mouseenter', () => { paused = true; render(); });
  heroEl.addEventListener('mouseleave', () => { paused = false; render(); });
  window.__h2aTimer = setInterval(() => { if (!paused) go(i + 1); }, 7000);
  render();
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
  initHomeCarousel();
  if (front) front.innerHTML = '';
  if (show) show.innerHTML = '';
  // Owner, 2026-11-05: home keeps the featured matchup and the week's key
  // matchups. Top Model Bets, Top Value Plays and the League Overview counters
  // are gone (Edge carries the betting reads).
  if (stats) stats.innerHTML = '';
  spots.innerHTML = '<div class="text-xs text-slate-500 p-4">Loading key matchups\u2026</div>';
  await loadSchedule().catch(() => null);
  // Re-render the 2a hero now that schedule data is in (featured matchup and
  // scorestrip read live data).
  hero.innerHTML = homeRedesign2aHtml();
  initHomeCarousel();
  const fill = () => {
    return marqueeHtml() || '<div class="text-xs text-slate-500">Key matchups unavailable right now.</div>';
  };
  spots.innerHTML = fill();
  // Game lines arrive after first paint; refresh the hero (spreads/ML) and spotlights once.
  loadGameLines().then(() => {
    if (SCHEDULE_DATA) {
      hero.innerHTML = homeRedesign2aHtml();
      initHomeCarousel();
      spots.innerHTML = fill();
    }
  });
}


