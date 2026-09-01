# NFL Dashboard — State

- updated: 2026-09-01
- live: https://nfldashboard.pages.dev/ (Cloudflare Pages, **git-connected: auto-deploys on `git push origin main`**; verified 2026-09-01)
- repo: https://github.com/shyam4902/nfldashboard · single-file app in `index.html` + Supabase + static JSON
- deploy: commit → `git push origin main` → Pages builds (~1-2 min). The only step that ships the public site is the push.
- NOTE: `~/Library/Application Support/nfldashboard-props/nfldashboard/` is the launchd/local dev-preview copy, NOT the public deployment.

## Docs 2026-09-01 — source-of-truth rule + change-triggered refresh ticket (planning)
- **Data source of truth rule added to all agent guidance**: root
  `AGENTS.md`/`CLAUDE.md`, `docs/agents/repo-map.md` (Cross-project rules),
  `nfldashboard/AGENTS.md`/`CLAUDE.md`, and `fantasyfootball/AGENTS.md`/
  `CLAUDE.md`. Rule: the project's data (Supabase, `data/shared/`, exports) is
  authoritative for player-team assignments and rosters; never "correct" it
  from model training knowledge, which is always outdated. Example cited:
  Quinnen Williams on the Cowboys and Justin Fields on the Chiefs are correct
  in this project's 2026 data. If data seems wrong, check project sources or
  ask the user before touching it.
- **Launch ticket 15 filed** — `change-triggered-data-refresh`
  (`.scratch/launch/issues/15-change-triggered-data-refresh.md`): a source
  watch (`source-watch.json`) that polls upstream URLs (nflverse
  rosters/transactions, Sleeper NFL state, Kalshi/Polymarket markets,
  file-based artifacts), detects change by hash/timestamp, and triggers the
  existing daily-pipeline/rostersync within ~24h — so a trade appears in the
  app without waiting for the daily clock. Runtime (Go vs Node) left open;
  complements ticket 08 (stale → alert; 15 is change → refresh early).
  Added to `.scratch/launch/map.md` and the repo-map's scheduled-jobs
  section. NOT built yet.
- This session also logged the app-wide fabricated-numbers audit and the
  roster "scrambling" misdiagnosis correction below.

## Shipped 2026-09-01 — app-wide fabricated-numbers audit (follow-on to ticket 14)
- **Teams depth panel now shows the Supabase roster.** The team projections
  panel rendered a Clay `projected_starters` view; it now renders a
  **Roster Depth** grid from the Supabase roster (the runtime source of
  truth): grouped by position, sorted by depth, OVR badge. The unused
  `renderStarters` renderer in Projections was trimmed to an honest "depth
  charts live on the Teams tab" message.
- **Matchup hero banner market fallbacks removed.** Missing spread/total
  used to render invented "SEA -2.5" and "48.5 pts"; now honest "—".
- **Compare modal radar de-fabricated.** "Film Grade" renamed to "Clay
  Grade" (it was a 3-bucket estimate from Clay pos_rank, not film).
  Non-skill positions (DEF etc.) used to draw a radar of fabricated 7s;
  now they draw a real 3-axis radar (Clay Grade / OVR / Clay Rank). Skill
  positions use real Clay projection values scaled to /10; missing
  projection values render 0 rather than invented defaults (3000 yds, 20
  TDs, etc.).
- **Curated transaction overlay noted.** `applySummer2026Updates` is a
  hand-entered offseason-move list (13 additions, documented); it is
  curated real moves, not fabricated stats. Consider labeling it as
  "curated" in the UI later.
- Smoke test extended: asserts the Teams depth panel shows the Roster
  Depth view. PASSED, zero page errors.

## Correction 2026-09-01 — roster "scrambling" was a misdiagnosis (user)
- Earlier entries in this file claimed Clay `projected_starters` and the
  roster seed were "scrambled" because Quinnen Williams appeared on the
  Cowboys, Kenny Clark on the Cowboys, and Justin Fields on the Chiefs.
  **Those moves are correct.** Quinnen Williams is on the Cowboys, Kenny
  Clark went Packers→Cowboys, and Justin Fields went Jets→Chiefs in this
  project's 2026 data. The "scramble" claim came from agent training-data
  priors (pre-2026 rosters), not from the project's data.
- Lesson for agents: **the project's data is the source of truth. Do not
  "correct" roster/team assignments from model knowledge.** AI training
  data is always behind; if a player's team differs from what a model
  "knows", trust the data.
- The roster files were never actually changed (the correction attempt
  from this session was reverted). No Supabase changes are needed.

## Shipped 2026-09-01 — Matchup Center trust & polish (launch ticket 14, Option A)
- **Fabricated matchup numbers removed.** The Matchup Center was generating
  fake "Next Gen Stats" splits from a hash of the team name (30 of 32 teams;
  SF/LAR hardcoded), plus invented At-a-Glance columns (close record,
  margin of victory, turnover diff, penalties) and hardcoded story-card
  claims ("4.95 yards per route run", "2.9% pressure rate"). All gone.
- **Real 2025 efficiency data now powers the Matchup Center.**
  `team_season_efficiency.json` (nflverse/nflfastR, 2012-2025, off/def per
  team) is loaded by the app and ranked 1-32 per metric. Splits now show
  real EPA/play, EPA/att, success rate, yds/play, turnover rate, sack
  rate. Verified: Houston's defense correctly shows #1 in EPA/play (-0.131)
  — previously shown as ~average by the hash fabricator.
- **Honest gaps.** Missing verified data renders as "—" (never a fallback
  rank of 16). At-a-Glance shows real Clay ppg/diff + 2025 EPA/success;
  invented columns removed. Matchup Insights cards are built from real
  roster players, Clay unit grades, and real efficiency ranks; no invented
  story stats. Empty state says nothing is shown rather than inventing a
  narrative. Intro copy + Matchups 101 modal updated; a "Sources & Method"
  footnote names each data source.
- **Freshness trust-bar stamps restored** (regression from ticket 13):
  "data X ago" badges on Schedule, Projections, Teams, and Matchup headers,
  from the shared `freshness.json` manifest; stale-amber when >24h.
- **Home decluttered for the fan:** hero blurb no longer promises "prop
  market value reads"; "6 Sportsbooks" stat card is now "Value Reads"
  linking to the edge app; the Props feature card is "Value Reads · Edge
  Analytics" link-out.
- **Projections sub-tabs grouped** into Team / Offense / Defense / Model
  sections with divider labels instead of one flat row of 19 pills.
- **Data plumbing:** `team_season_efficiency.json` added to the dashboard
  repo, to `data/shared/` (sync script copies it), and stamped in
  `freshness.json` under `team_efficiency`. Schedule tab already read the
  shared layer — verified, no change needed.
- Smoke test extended: asserts real EPA in At-a-Glance, no fabricated
  columns, Sources & Method note, freshness stamps, projections groups.
  PASSED with zero page errors.

## Shipped 2026-09-01 — dashboard consolidation (launch ticket 13)
- **Props & Value and Win Totals tabs removed from the dashboard.** Both
  now live exclusively in the Edge Analytics app. The dashboard is a
  team/matchup/schedule hub for the browsing fan; the edge app owns all
  deep value analysis (props board, recommendations, line movement, model
  lab, win totals, alerts, parlay).
- **Nav reduced to 5 tabs:** Home, Schedule, Matchup, Teams, Projections.
- **Props presence on the dashboard is minimal:** the one-line prop insight
  under the game cards on Home (now links to the edge app), the Home feature
  card (opens the edge app), the Home stat card (opens edge app), and the
  Edge Analytics top-bar button. No filters, no trending strip, no all-odds
  expander on the dashboard anymore.
- **Win totals cross-link** added to the Schedule tab, pointing to
  `edgeplay-analytics.pages.dev/win-totals`.
- **Command palette** entries for Props and Win Totals now open the edge app
  in a new tab instead of switching to a removed tab.
- **Player modal** compare-odds button no longer switches to the removed
  Props tab; it just toggles the odds comparison inline.
- `renderPropsBoard()` and `renderWinTotals()` functions removed (~245
  lines). `loadPropsBoard()` kept because the Home insight line and the
  player modal still read the board data.
- Smoke test rewritten: no Props/Win Totals tab assertions; asserts nav
  buttons are gone, edge cross-links present, Home front door + Matchup Lab
  still work.

## Shipped 2026-09-01 — 53-man roster refresh
- Roster sync from Supabase ran clean: 2517 players fetched, 2523 after
  the summer overlay (13 trade/FA additions). 32 teams, 69-87 players
  each (53-man + practice squad + IR).
- Key players verified: Mahomes KC 97, Jaxson Dart Giants 73 (still
  correct), Myles Garrett Rams 99, A.J. Brown Patriots 89, Josh Allen
  Bills 99.
- File written to both `nfldashboard/nfl_rosters_2026.json` and
  `data/shared/nfl_rosters_2026.json` so both the dashboard and edge
  app read the same refreshed snapshot.
- Smoke test PASSED, zero page errors.

## Shipped 2026-09-01 — Homepage front door (launch ticket 03)
- **Today in the NFL front door**: New section between the hero and the
  showcase. Shows the next 4 upcoming games from `schedule.json` with
  team abbreviations, colors, kickoff time (Today/Tomorrow/date), TV
  network, and venue. Each game card links to the Matchup Center. When
  no games are scheduled, shows a season teaser.
- **One-line prop insight**: The top trust-scored play from the props
  board renders as a one-liner below the game cards: player, market,
  side/line, venue, and a plain-English read ("line looks generous" /
  "a lean" / "a slight edge"). Clicking opens the Props tab.
- **Edge Analytics cross-link on Props card**: The Props & Value feature
  card now has an "Edge Analytics" link in its footer, opening the edge
  app in a new tab. Same-house, different doors.
- **Smoke test**: extended to assert front door present, 4 game cards,
  prop insight visible. PASSED, zero page errors.

## Shipped 2026-09-01 — Data accuracy audit (launch ticket 10)
  **NOTE (corrected 2026-09-01):** this entry's "scrambled" claim about
  Quinnen Williams on the Cowboys and Justin Fields on the Chiefs was a
  misdiagnosis from agent training-data priors. Those assignments are
  correct in this project's 2026 data. The code changes below (removing
  the projected_starters fallback/sub-tab) still stand on their own
  merits — roster depth reads Supabase directly — but they were not a
  "scramble" fix. See the Correction entry at the top.
- **Clay projected_starters view removed from Projections**: The Clay
  `projected_starters` sub-tab and its fallback in `findPlayerData()`
  were removed; roster depth reads the Supabase roster directly. The
  render function shows a "depth charts moved to Teams tab" message.
- **Hardcoded Projections date fixed**: "Updated 8/19/2026" was a
  hardcoded string. Now reads from `CLAY_DATA.metadata.updated` on
  load.
- **Player modal Starter Rating badge removed**: Sourced from the Clay
  projected_starters view. Removed entirely.
- **Audit report**: `docs/launch/data-accuracy-audit.md` with error
  rates per panel, findings, and documented decisions.
- **Schedule, rosters, props, win totals, matchup lab**: all clean.
  Team names are 100% consistent across schedule, rosters, and Clay.
  272 games, 32 teams, no duplicates, no missing fields.
- **Smoke test**: PASSED, zero console errors.

## Shipped 2026-09-01 — Props board plain-English (launch ticket 02)
- **Value column replaces Edge + EV%**: The value board table and the player
  modal props table now show a single "Value" column with analyst-language
  labels (Generous, Lean over, Slight edge, Fair, Tight) instead of raw
  edge_pct in "pp" and EV% as a number. The math runs underneath; the screen
  speaks human. The All Odds expander keeps the raw Edge/EV% columns since
  that is a power-user deep-dive behind a button click.
- **Summary stats reworded**: "+EV plays" becomes "Value plays", "Avg edge"
  becomes "Model gap" (in pts not pp), "Best EV" becomes "Top value".
- **Section headers reworded**: "Best Lines by Model Edge" becomes "Best Lines",
  the subtitle now says "where the model sees the market gap". Value Board
  subtitle changed from "ranked by EV" to "ranked by value".
- **Filter label**: "Only +EV" becomes "Only value plays".
- **Landing cards reworded**: spotlight copy changed from "model X% vs market
  Y% · confidence Z/100" to "model sees the line generous/tight · trust Z/100".
  Value plays badge changed from raw edge% to a plain label (Generous/Lean/
  Slight/Fair). Footer changed from "+EV Prop Opportunities" to "Value Prop
  Reads". Home hero blurb and feature card de-jargoned.
- **Smoke test**: PASSED, zero console errors. 100 board rows render, player
  modal opens, all tabs clean.

## Shipped 2026-09-01 — Navigation Polish & Schedule Grid Fix
- **Schedule Full-Season Grid Fix**: Fixed container width constraint where the 32×18 table was locked inside a 3-column CSS grid card wrapper. The matrix now dynamically expands across 100% of the viewport width with all 18 weeks cleanly distributed, team colors, sticky team headers, and Home/Away badges.
- **Title and Branding Update**: Renamed header branding to `NFL 2026 Pro Hub` and page title to `NFL 2026 Season Hub · Live Intelligence & Analytics`. Updated Home hero badge from offseason to `2026 NFL Season`.
- **Top Bar Simplification**: Removed CSV export button from the top navigation bar. CSV export remains available via Home tools and Command Palette.
- **Button Styling Redesign**: Replaced the chunky high-contrast styling on `Player Compare`, `Edge Analytics`, and `Theme Selector` with subtle glass buttons, crisp SVG icons, live pulse indicator, and clean custom dropdown layout.

## Shipped 2026-08-31 (late) — Edge wrong-URL wipe + launcher redeploy
- The wrong `edge-analytics.pages.dev` link (an unrelated consultancy site) is
  gone everywhere. Live `shyamsapps.pages.dev` launcher redeployed from
  `~/Desktop/Live Apps/Home/` (Pages project `shyamsapps`, deployment
  `13967df4`, branch `main`) — its Edge card now links
  `edgeplay-analytics.pages.dev` (verified live; that destination serves the
  real EDGE//NFL app, and the dashboard's own cross-link was already correct).
- Wiped the wrong URL from all 11 in-repo docs: root `AGENTS.md`/`CLAUDE.md`,
  `docs/agents/edge-url-policy.md`, and `AGENTS.md`/`CLAUDE.md`/`README.md` in
  nfldashboard, fantasyfootball, and edgeplay-analytics. Also scrubbed 3
  second-brain files (EDGE-URL-POLICY.md, STATE.md, the launcher fix-plan).
- Machine-wide sweep (rg + plain grep, incl. dotdirs and runtime dirs, run
  twice) returns zero hits for the wrong string.

## Shipped 2026-08-31 — Next Gen Stats Pro Matchup Center
- **Pro Matchup Center & Advanced Comparisons**: Complete overhaul of the Matchup tab inspired by Next Gen Stats pro previews and player compare design patterns.
  - **Sub-navigation system**: `Pro Preview`, `At a Glance`, `Key Advantages`, `Passing`, `Rushing`, `Defense & Trenches`, `Matchup Insights`, and `Formation Lab`.
  - **Game Meta & Hero Banner**: High-impact away vs home banner with logos, projected records, playoff seeds, kickoff time, venue, TV network, model win probability bar, and live market lines.
  - **At a Glance Efficiency Table**: 3-column table comparing team PPG, Point Differential, Close Game Record, Avg Margin of Victory, Turnover Diff, and Total Penalties with NFL rankings.
  - **Side-by-Side Advantage Matrix**: Dual Offense vs Defense situational split tables with 1–5 star advantage badges styled in team colors with logos.
  - **Team Skill Dual Radar**: 5-axis visual radar comparing Passing Attack, Rushing Attack, Pass Defense, Rush Defense, and Trench Play.
  - **Matchup Insights**: Story cards with player spotlights, trench battles (OT vs Edge), unit matchups (TE vs Secondary), and coordinator scheme tendencies with deep links to player dossiers.
  - **Matchups 101 Guide Modal**: Interactive explainer modal detailing rank delta calculations and star ratings.
  - **Schedule & Command Palette Integration**: One-click jump from schedule game cards and Command Palette directly into the Pro Matchup Center.
  - Verified in headless Chromium with Playwright: 0 page errors.

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
  `DATA.teamById`) + `CLAY_DATA.unit_grades`; clay `projected_starters` is
  unused for starters (the Teams tab reads Supabase). Verified headless
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