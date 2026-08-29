# NFL Dashboard — State

- updated: 2026-08-29
- live: https://nfldashboard.pages.dev/ (Cloudflare Pages, auto-deploys on push to main)
- repo: https://github.com/shyam4902/nfldashboard · single-file app in `index.html` + Supabase + static JSON

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

## In flight
- Nothing — working tree clean aside from test-runner screenshot regenerations
  (`f628b5b` on main, 11 commits ahead of origin, not pushed). All seven
  BettingPros-style features shipped (hit rate, matchup, streaks, all-venue
  odds compare, profile game log, trending, stars).

## Next
- **Formation view (user's idea):** Madden ratings move off the main pages into a football
  formation graphic (X's and O's) with each player + rating placed by position — for offense
  and defense. The killer use case: open two tabs, one team's offense vs the other's defense,
  for next week's matchup, to see where the advantage is. This is the intended long-term home
  for ratings.
- Wire the games array from props-board.json into the Schedule tab (real nflverse
  kickoffs/spreads already exported; the tab still reads its own source).
- Add comp picks to draft capital when a reliable 2027+ source exists.
- In-season: weekly actuals vs Clay projections once games are played.

## Blockers
- None.