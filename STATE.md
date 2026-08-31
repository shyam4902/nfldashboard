# NFL Dashboard — State

- updated: 2026-08-30
- live: https://nfldashboard.pages.dev/ (Cloudflare Pages, auto-deploys on push to main)
- repo: https://github.com/shyam4902/nfldashboard · single-file app in `index.html` + Supabase + static JSON

## Shipped 2026-08-30 — Win Totals tab + research repo
- **Win Totals tab** (index.html + props-smoke.mjs): reads `props-board.json`'s
  new `win_totals` section (32 teams) — model projection vs Kalshi line, live
  record, and a scoring badge (pending/live/won/lost) that auto-advances as
  games land. Nav button, command-palette entry, `renderWinTotals()`. Smoke
  extends to assert 32 rows + IND-over/CIN-under. All green.
- **`research/` became its own git repo** (`git init`, first commit `0cee250`):
  the R/nflverse work is deliberately separate from both apps; curated outputs
  publish to `data/shared/` and are consumed here. See `research/README.md`.

## Shipped this session (2026-08-29) — BettingPros-style insights UI
- **2024 Form column** on the value board: each play shows the producer's
  insights block — 2024 season total, per-game equivalent of the season line
  (line ÷ 17), weekly over rate, L10 rate, streak — rendered only when the
  producer supplies it (rookies/untracked markets honestly show "—").
- **Trending Props strip**: 12 chips of the most-active player/market pairs,
  ranked by venue count + line spread (producer `trending` list).
- **Stars column** on the value board: 1–5 stars from per-market
  discrimination trust (same thresholds as the landing card); 50/50 rows
  render in headless Chromium.
- **All Odds expander (Feature 4)**: per-row button reveals every venue
  quoting that player+market+side, sorted best-line-first with a BEST tag,
  per-venue edge/EV and quote age. The player modal's props table deep-links
  into it for the exact prop.
- **Player modal 2024 Form section (Feature 5)**: under the season-props
  table — season total, per-game avg, weekly/L10 over rates, streak, and an
  honest verdict on whether the current season line would have hit in 2024.
- Verified in headless Chromium (smoke + interactive probe): zero page errors.
- **Positioning (user direction)**: give away what BettingPros paywalls
  (cover probability, stars, splits) — our freshness/calibration/exchange
  data stays the differentiator.

## Shipped 2026-08-28
- **Props tab was silently dead in the browser**: `renderPropsBoard()` called an
  undefined `statChip()` and threw before rendering anything. Helper defined;
  the tab now renders (verified in headless Chromium).
- **Per-quote age badges (Part 2a consumer half)**: value board Age column,
  best-line cards, and board meta all show each quote's real `recorded_at` age
  plus per-venue ages from `summary.venue_recorded_at`. Missing timestamps
  render as "—", never the export time.
- **Mejores Apuestas de Hoy (Part 3)**: Home landing card ranking the few
  most-confident plays. Trust = 60% calibrated edge + 40% per-market
  discrimination evidence (2024/2025 AUC); longshot trap filtered
  (edge > 25pp or EV > 150%); markets the model cannot separate never rank.
- **Gated board data**: runtime producer was computing the props board
  ungated (missing calibration-gate.json deployment); now fixed at the source
  (fantasyfootball repo) and the board carries 16 markets of evidence with 5
  gated markets excluded from +EV.
- `props-smoke.mjs`: Playwright smoke test asserting the Props tab and landing
  card render with zero page errors.

## Shipped recently (2026-08-25/26)
- Roster modal redesign: player chips ~40% bigger with bold typography, fill every grid row
  (no dead right space); new summary strip (projected record, cap space, draft capital, top
  player); Madden ratings demoted to muted right-aligned badges (hover for value).
- Teams UI: sub-tabs are now large pill buttons with icons + live Moves count; division nav
  rebuilt as card-style buttons with conference color stripes and press feedback.
- Full-season schedule (weeks 1-18, 272 games) with week-chip selector defaulting to the
  current week; week-keyed live nflverse lines; home marquee follows current week.
- Draft capital extended to 2027/2028/2029 (incl. Wallace pick swap); comp-pick schema
  reserved; per-year pick counts on team tiles. Wallace trade added to Moves feed (373 moves).
- Earlier: Teams → Moves newswire, home showcase, Week 1 schedule, defense rebuild, STATE.md.

## Shipped 2026-08-29 (late) — Matchup Lab
- **Matchup Lab tab** (formation view, Part 1): pick any offense vs any defense,
  choose personnel (12/11/10) and defensive front (4-3/3-4/nickel). Renders
  X's-and-O's formation fields with real starters picked by highest Madden OVR
  per slot (KC vs PHI verified: Mahomes QB97, Kelce TE92, Humphrey C95,
  Carter DT90). Each chip shows pos, OVR badge, slot; click opens the player
  modal. Clay unit-grade matchup strip (QB vs Secondary, OL vs Pass rush,
  RB vs LB, WR vs CB, TE vs S) with +N advantage badges, plus an aggregate
  offense-vs-defense verdict pill. Data: `DATA.players` (team via
  `DATA.teamById`) + `CLAY_DATA.unit_grades`; clay `projected_starters` JSON
  is scrambled (Dallas => Quinnen Williams) so unused. Verified headless
  Chromium: 11 O + 11 X chips, 5 unit rows, verdict, personnel/front
  re-render, modal deep-link, zero page errors (`props-smoke.mjs` extended).

## Shipped 2026-08-29 (late) — roster source truth + weekly sync
- **Source-of-truth confirmed:** the live dashboard already loads `DATA.players`
  straight from Supabase (`sb.from('nfl_teams')` + `fetchAllPlayers()` in
  `loadAllData()`); the committed `nfl_rosters_2026.json` is only the deploy
  artifact/fallback. The agent-corrected rosters (e.g. Jaxson Dart is on the
  Giants, not Dallas) live in Supabase and the app reads them directly.
  `nfl_rosters_2026.json` already reflects this (Dart verified on Giants).
- **`sync_supabase_rosters.js`** (new): refreshes `nfl_rosters_2026.json` from
  the live Supabase tables (same anon-key reads + summer-update overlay as
  `generate_roster_files.js`), no CSV/TXT. Verified: 32 teams / 2523 players,
  Mahomes 97 KC, Dart Giants. Restored the pre-sync file afterward (identical).
- **Weekly cadence:** `com.nfldashboard.rostersync.plist` (launchd,
  `StartInterval` 604800 = weekly, matches existing `props-scan`/`rosterupdate`
  convention). Loaded and running alongside `com.nfldashboard.props-scan`.
  Runs the sync every 7 days so cuts/chart moves propagate. Log:
  `rostersync.log`. NOTE: plist points at `/Users/shyampatel/Desktop/NFL_Main/`
  (this checkout), while the old `rosterupdate` plist points at
  `/Users/shyampatel/Desktop/nfldashboard/` (older path).
- **ESPN depth chart deferred:** `site.api.espn.com` is access-denied from this
  machine; `site.web.api.espn.com/.../roster` works but carries NO depth order
  in the preseason, and `/depthchart` returns `{}`. In-season ESPN may expose
  real depth order; layer it as an overlay then, not now.

## In flight
- Nothing — working tree clean. Matchup Lab + roster sync landed; smoke green.

## Next
- **Matchup Lab game picker (shipped 2026-08-29):** new "Schedule game" select, fed from `schedule.json` (272 games, all 18 weeks). Picking a game sets offense = away, defense = home and re-renders; manually changing teams clears it. Default pair is now the current week's first game (NE @ SEA), replacing the arbitrary KC/PHI default. Smoke covers it (272 options, pick re-renders, chips 11/11; `gamePickOk` in the pass gate).
- **Cross-project docs (shipped 2026-08-29):** `docs/agents/repo-map.md` ties the stack together (producer/consumer topology, data sources, artifacts, launchd jobs). Per-project `AGENTS.md`/`CLAUDE.md` added in nfldashboard and fantasyfootball; root AGENTS.md/CLAUDE.md gained a `### Repo map` pointer.
- **Matchup Lab part 2 (optional polish):** front-7 vs OL trench bar; per-slot rating edge callouts (e.g. "Mahomes 97 vs S 74"); swap-in player sub picker; a swap button for the offense/defense sides. Formation placement/hardcoded depth charts could later move to a data file.
- **Madden demotion (user direction 2026-08-29):** Madden ratings currently dominate the app (rating badges, Madden-based power rankings, unit ratings, spotlight stats). User wants them demoted from the main pages; the Matchup Lab is an acceptable niche home where they stay visible. Follow-up: soften/mute ratings on Teams/Rosters, Schedule, Home, and Projections; keep them only where they add decisions (Matchup Lab). Clay grades become the headline.
## Shipped 2026-08-29 (late, part 2) — Madden ratings demoted to the Matchup Lab
- Per-player rating badges hidden app-wide via CSS (`.rating-badge{display:none}`, re-enabled only under `.formation-player`). Rosters, team tiles, player modal, compare panel and home show no OVR numbers anymore.
- All public copy de-Maddened: hero tagline/blurb, home stats, Teams feature desc, roster modal subtitle, schedule blurb, footer, matchup modal note, power-panel caption ("Unit power ratings"), consensus description. Internal math (power rankings, heatmap, consensus blend, Matchup Lab starters) untouched.
- Compare modal: Madden axis dropped from the 5-axis radar (all positions), "Madden 27" hero numbers removed, 'Madden 27 Rating' delta row removed.
- Consensus Power Index: "Madden Avg" column removed (still blended into the score, just not displayed).
- Verified headless Chromium: home 0 badges / 0 "Madden" text; roster modal renders (37 chips, 0 ratings) no errors; Matchup Lab still shows 11 ratings per side; compare modal + consensus clean; props-smoke PASSED.

## Shipped 2026-08-29 (late, part 3) — unified data layer (launch ticket 01)
- `data/shared/` at repo root is now the single read surface the dashboard
  consumes: `props-board.json`, `clay_projections_2026.json`,
  `nfl_rosters_2026.json`, `schedule.json`, plus a `freshness.json` manifest
  (per-source as_of, age_hours, max_age_hours, fresh/stale status).
- `scripts/sync_shared_data.sh` publishes the exports there; chained into
  `fantasyfootball/scripts/daily-pipeline.sh`. Data age is served from the
  unified layer, not hand-copied files.
- Dashboard `loadFreshness()` renders per-panel "data X ago" badges and a
  stale state (amber) once a source exceeds 24h; verified in smoke.
- Verified: 269 fantasy tests pass, `props-smoke.mjs` PASSED (zero page errors).

## In flight
- Ready to commit (docs + index + smoke svc + sync assets uncommitted this
  session): STATE.md, index.html (edge cross-link → edgeplay-analytics.pages.dev),
  props-smoke.mjs (serves ../data/shared), new AGENTS.md/CLAUDE.md,
  com.nfldashboard.rostersync.plist, sync_supabase_rosters.js.
- Launch-board tickets 02 (props-board plain-English) and 03 (homepage
  front-door) are PARTIAL: freshness badges + Edge cross-link shipped;
  plain-English rewording and front-door copy not. See `.scratch/launch/`.

## Next
- Commit/uncommit the session's uncommitted files (above).
- Ticket 02 remaining: hide raw edge_pct/sigma/EV behind a collapsible
  "raw data" panel; analyst-language copy.
- Ticket 03 remaining: "Today in the NFL" front door + entrance cards.

## Next
- **In-season ESPN depth-chart overlay:** once ESPN exposes real depth order
  (it's empty in the preseason), fetch it and layer true #1/#2 notes onto the
  Matchup Lab + rosters. Until then, Supabase roster is the source of truth and
  the weekly sync keeps it fresh.
- **After the above:** loosen the hard per-market AUC gate into a ranking input (8/13 markets fail AUC but still inform; hiding them makes the board look broken to new users). Then FanDuel/Betfair lines for breadth.
- Wire the games array from props-board.json into the Schedule tab (real nflverse
  kickoffs/spreads already exported; the tab still reads its own source).
- Add comp picks to draft capital when a reliable 2027+ source exists.
- In-season: weekly actuals vs Clay projections once games are played.

## Blockers
- None.