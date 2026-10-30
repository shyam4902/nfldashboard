# NFL Dashboard state

- Updated: 2026-10-30
- Live: https://matchupboard.com/ (also nfldashboard.pages.dev)
- Repo: https://github.com/shyam4902/nfldashboard
- App: static `index.html`, tracked JSON assets, and Supabase roster/transaction data

## Matchup Board rebrand + NBA matchups, 2026-10-30

- Both pages are branded **Matchup Board** now, with one `NFL | NBA` switch in the header. The old NBA nav link on the NFL page is gone, so there is one way to switch sports.
- Titles, descriptions, rel=icon, canonical, Open Graph and Twitter tags on `/` and `/nba/`. New root files: `favicon.svg`, `og-image.svg` (rendered to `og-image.png` out of band), `robots.txt`, `sitemap.xml`.
- NBA views: `#compare` and `#compare/<idA>/<idB>` (two team pickers, 13-row comp table with the better value in gold, each team's last five, head-to-head games), the pre-game matchup on `#game/<id>` when a game is `pre` and has no box score players (season series, last five, injuries, team leaders, full-comparison link), and `#player/<id>` (averages for season and career, game log). Box-score and roster names link to player pages, and the team page header links to `#compare/<id>`.
- `nba/nba.js` gained five parsers — `parseTeamStats`, `parsePreGame`, `parseAthlete`, `parsePlayerOverview`, `parseGameLog` — and standings rows now carry `ppg` / `oppPpg`. The pre-game parser reads only header, gameInfo, lastFiveGames, seasonseries, injuries and leaders; betting, prediction and news sections are never read. `nba/nba.test.mjs` is 14 tests against committed fixtures.
- Compare and pre-game share one compare-table renderer; standings are fetched once per page load and cached in memory. Only the scores view polls, and every view stops the timer before painting.

### NBA depth, same day

- `#leaders` (Leaders tab): six boards — Points, Rebounds, Assists, Steals, Blocks, 3PM — each fetched and painted independently, cached in memory for the page session. `parseLeaders(json, category, stat)` reads values by stat name from the matching category and ranks 1–10.
- Player search in the header: 250 ms debounce, 2-character minimum, `AbortController` on the previous request, up to 8 NBA-only results, arrow keys / Enter / Escape. `parseSearch` drops every non-NBA league the ESPN search returns.
- Live games: `#game/<id>` with state `in` refetches every 30 s and re-renders in place with no loading flash, and shows “Live · updates every 30s”. Polling stops on final, on error it re-arms, and any view change clears the timer.
- `parseGameLog` now returns `{ labels, seasons[], games }` split by `seasonTypes[].displayName` (Regular Season stays the top-level `games`). The player page shows Regular Season by default with a tab for the other types.
- Team statistics and schedules are cached for 5 minutes in one `teamData(id)` helper shared by compare, pre-game and the team page.
- Season-series rows bold the winner's abbreviation and score and mute the loser. Standings gained PPG / OPP / DIFF (signed, gold for positive, no new colours, table scrolls inside its wrapper). The scores date bar has a native date picker next to prev/next and Today.
- `nba/nba.test.mjs` is 18 tests.
- NFL moved to `/nfl/` (PACKET-2026-10-30-6): the 9,909-line NFL page is now `nfl/index.html` and every data URL it loads is root-absolute (`/data/shared/*`, `/schedule.json`, `/props-board.json`, `/nfl_stats_2026.json`, `/nfl_standings_2026.json`, `/clay_projections_2026.json`, `/team_season_efficiency.json`, `/draft-capital.json`, `/scripts/load_team_tendencies.js`), because the hourly score sync and the daily publish job keep writing those files at the repo root. `/` is now a two-card sport picker that redirects old `/#...` NFL deep links to `/nfl/`. `check_html_scripts.mjs` checks all three pages; `props-smoke.mjs`, `moves_filtering.test.js`, `scripts/production-health-check.mjs`, `scripts/publish-daily.js` and the Playwright suites read `nfl/index.html`.
- Polish pass (PACKET-2026-10-30-5): final and live score cards show each side's points leader, phone search opens as a row below the header so the brand and NFL | NBA switch stay reachable (outside tap closes it) and shows a “Searching…” state, the 3PM board is labelled per game with initials avatars as headshot fallbacks, `#team/<id>` has a season-stats card, and `#players/<idA>/<idB>` compares two players with the shared compare table (19 tests).

## NBA page + matchup fix, 2026-10-23

- New `/nba/` page (`nba/index.html`, `nba/nba.js`): scores by date, standings, team schedule and roster, box scores. Reads ESPN's keyless NBA API in the browser, no cron or Supabase. Tests: `node --test nba/nba.test.mjs` against `nba/fixtures/`.
- NBA link added to the NFL header nav.
- Ported the September matchup switching fix (opening a second matchup no longer shows the first). The rest of that September work, the Week 1 power rankings tab, is parked on local branch `wip/2026-09-power-rankings`.
- Gemini polish and review shipped as `1f9624c` (verdicts in `delegation/PACKET-2026-10-23-2-VERDICTS.md`, all checks re-run by Claude).
- 2026-10-30: matchupboard.com and www are custom domains on this Pages project. DNS moved from Vercel to Cloudflare (brady/treasure.ns.cloudflare.com).

## Daily publication + actual standings/stats, 2026-09-16

**The daily producer output now reaches the public dashboard automatically.**
The bottleneck was that `daily-pipeline.sh` writes into the launchd runtime tree
(`~/Library/Application Support/nfldashboard-props`), and the git push is what
ships Cloudflare Pages — the Mac's own checkout sits on the Desktop, which macOS
TCC denies to background jobs.

- New `scripts/publish-daily.sh` + `scripts/publish-daily.js`. The shell
  wrapper keeps an **isolated clone** at
  `~/Library/Application Support/nfldashboard-publish/nfldashboard` and hands off
  to the versioned publisher inside it (falling back to the installed copy
  before that commit reaches origin). The publisher: fetch/ff-or-rebase
  `origin/main` → copy **only producer-owned artifacts** → rebuild the
  standings/stats layer → `scripts/validate-data.js` (18 assets) → stage an
  explicit allow-list → commit → push → **verify the deployed bytes** over HTTPS
  (sha256 vs local, polled up to ~5 min for the Pages build).
- Artifacts the publisher copies, and nothing else: `props-board.json`,
  `team_season_efficiency.json`, `team_tendencies_2025.json`,
  `clay_projections_2026.json`, `data/shared/freshness.json`,
  `data/shared/pipeline-status.json`. **`schedule.json` and
  `nfl_rosters_2026.json` are never copied** — the score workflow and the roster
  sync own them, and copying the runtime versions would roll back newer
  published scores. A timestamped artifact is also never rolled backwards.
- Concurrency: never a force push. If the score workflow moves `main` between
  fetch and push, the publisher rebases its single commit and retries (3
  attempts); a pre-existing local commit ahead of origin is replayed the same
  way. Nothing is committed unless validation passed, so the last good output
  survives upstream/validation failures.
- **Cadence:** a separate launchd job, `com.nfldashboard.publish`, at **07:20**
  (20 minutes after `com.nfldashboard.props-scan` at 07:00). It is deliberately
  not a step inside `daily-pipeline.sh`: the pipeline's EXIT trap writes
  `pipeline-status.json` *after* its last step, so a publish step inside the
  pipeline would always publish the previous run's verdict — and a failed data
  step would stop the verdict from ever being published. Order in the 07:00
  run: syncs → refresh nfl results → export board → rebuild schedule → sync
  shared data. `npm run props:daily` from Desktop cannot publish.
- Failure reporting reuses the existing channel: any failing step sets the
  pipeline `failed_step`, the checkpoint-4 trap writes `pipeline-status.json`,
  and the 07:20 publisher carries that verdict to the public app — so a failed
  data run is owner-visible even though the board itself is unchanged. A
  publish failure does **not** ship a partial commit, and the last published
  output stays live; a standalone publisher run records the same status shape
  itself. A failed publish is visible in `logs/publish.log` and is recovered
  with `bash scripts/publish-daily.sh`.
- The broken 07:10 workspace-sync cron was retired once this replacement was
  verified: `crontab` no longer carries
  `10 7 * * * ... sync-shared-data.sh` (backup at
  `/tmp/crontab.backup.20260916-045232`; every other entry was preserved).
  Nothing scheduled now reads the Desktop tree.

**Actual standings and current-season statistics (`League` tab).**

- `scripts/build_league_data.js` writes two tracked artifacts, each with a
  `data/shared/` deploy copy and a root browser fallback:
  `nfl_standings_2026.json` and `nfl_stats_2026.json`. It is the only writer, so
  the copies cannot drift (`validate-data.js` checks byte identity).
- **Standings** come from completed regular-season finals already in
  `schedule.json` (the score workflow's output) — the roster snapshot supplies
  the 32-team/conference/division catalogue. W-L-T, win percentage (a tie is
  half a win), points for/against and differential for all 32 teams, grouped by
  conference → division. Ordering within a division is win percentage then point
  differential and the artifact/UI say so explicitly: it is **not** an official
  NFL tiebreaker and no playoff seeds are implied. Actual standings are separate
  from Clay projections (also stated in the panel).
- **Statistics** come from the free **Sleeper** weekly stats API
  (`api.sleeper.app/v1/stats/nfl/regular/<season>/<week>`, plus `/state/nfl` for
  the current week and `/players/nfl` once a day for names/teams, cached under
  `~/Library/Application Support/nfldashboard-publish/cache`). nflverse player
  stats for 2026 do not exist yet (its release URL 404s), which is why the
  current season reads Sleeper. Weekly and season-to-date passing/rushing/
  receiving leaders plus team offense/defense totals (PF/PA from the results,
  pass/rush/total yards, offensive TDs, yards allowed). Week and team filters,
  in the existing design.
- **Coverage honesty:** only finished weeks are published — the current week is
  omitted, never zeroed; a player with no stat line in a week is absent from
  that week rather than shown at 0; the panel labels season, completed-week
  coverage, source and update time. A partial/unknown-team upstream response
  fails the build, which keeps the last good artifact instead of shipping an
  incomplete table.

## Week 2 refresh, 2026-09-15

- All 16 Week 1 finals arrived through the score workflow. Pulled its 11
  commits, rebuilt the schedule to Week 2, and preserved every recorded result.
- The score workflow now runs the existing schedule builder before syncing
  scores. Tuesday rollover no longer depends on the Mac's daily pipeline.
  The builder retains score-sync provenance; a regression test covers rollover
  and result preservation. Cron minutes moved off the top of the hour.
- Refreshed the 1,699-player Supabase snapshot, the producer's 2026 game
  results, and the daily props pipeline. Board generated
  `2026-09-16T00:36:09.866Z`, 1,830 plays, 32 win-total rows, one game played
  per team. Exchange quotes refreshed; sportsbook quotes still date to August.
- Fixed the producer's runtime path handling, which had hidden all win totals
  under `Application Support`. The installed runtime has the fix too.
- Refreshed the live Moves feed with 163 validated ESPN transactions from
  Sept 4-15. Used the existing normalizer and transaction identity rules,
  inserted through the authenticated Supabase connector with conflict-ignore,
  and verified 2,131 total transactions, newest Sept 15, zero duplicate IDs.
  This updates transactions only, not the underlying player roster.
- Verification: all 16 data assets pass, schedule tests pass, 283 producer
  tests pass, Python browser suite has zero console/page errors, and the Node
  smoke works with the Python Playwright package via `PLAYWRIGHT_MODULE`.
- Audit and proposed next work: `results/2026-09-15-week2-automation-audit.md`.
- Removed the remaining hardcoded Week 1 home labels and navigation targets.
  The schedule story now uses the selected week's featured game's teams,
  venue, and kickoff. Home stats refresh after the schedule arrives.
- Sunday-night classification and schedule windows use Eastern kickoff hours,
  including games without TV metadata. Carousel labels use the supplied title.

## Checkpoint 6 (2026-09-10 → 09-12): in-season results, automated

Week 1 exposed the app as permanently pregame: `schedule.json` had `winner`
and score fields nothing ever wrote, and the "game of the week" was hardcoded
to the first game of the week, so it sat on a game already played.

- `sync_scores.js` pulls final/in-progress scores from the ESPN scoreboard
  into `schedule.json` and its `data/shared/` copy (`winner`, `away_score`,
  `home_score`, a `status` field, and top-level `scores_synced_at`). It keys
  on the game's **Eastern-time** date — Thursday/Sunday-night kickoffs are the
  next day in UTC, and a UTC key would silently miss every primetime game.
  `sync_scores.test.js` pins that. `--week N` and `--dry-run` supported.
- `pickFeaturedGames()` drops any game whose kickoff has passed or that carries
  a result, then ranks the rest with Sunday Night Football above other
  primetime. Home hero and Schedule carousel share it, and share
  `gameCategories()` (lifted out of the Schedule render loop).
- Played games render the result, not a stale line: `FINAL`/`LIVE` chip, score
  in place of spread and win %, score-split bar, outcome in the card footer.
- **Automated.** `.github/workflows/sync-scores.yml` runs hourly Sept-Feb and
  every 15 min over the Sunday 1-8pm ET slate (two UTC cron ranges — GitHub
  cron has no DST, so Eastern needs Sun 17:00-23:59Z plus Mon 00:00-01:59Z).
  It runs `sync_scores.test.js` and `scripts/validate-data.js` *before*
  pushing, and commits only when a score changed, so a bad or copy-drifted
  schedule never ships and a quiet hour triggers no rebuild. Pages is
  git-connected, so the workflow's push is the deploy. Two manual runs
  verified green end to end. The local command is the fallback.
- Week 1 results live: Seahawks 13-10 Patriots, 49ers 27-7 Rams.

## Shipped recently

- **Checkpoint 5 (09-08), release rehearsal** — Edge-promo buttons repointed
  from the dead custom domain to `edgeplay-analytics.pages.dev`; `_redirects`
  deny list extended and **now tracked and live** (internal files return 302,
  Sept 4 blocker B2 closed — verified 09-12); mobile horizontal overflow fixed
  on the Matchup tab (all 7 Matchup and 3 Teams subtabs measure exactly 390px
  at a 390px viewport); keyboard focus preserved across `renderMatchupPanels()`
  re-renders and Formation Lab chips made real controls.
  `checkpoint5_rehearsal.py` is the release probe.
- **Checkpoint 4 (09-07), failed-update banner** — the app reads
  `data/shared/pipeline-status.json` on load and shows an owner-visible banner
  with step, UTC run time, exit code and recovery command when it reports
  `failed`. `ok` or absent = no banner, no claim. Writer lives in the producer
  (`fantasyfootball/scripts/daily-pipeline.sh`).
- **Checkpoint 3 (09-07), season context** — matchup preview season labels are
  derived from the data (artifact `observation_period`, max EPA season,
  `schedule.json.season`), so a regenerated artifact flips every label with no
  code edit. The preview states the current season is in progress so 2025
  measured stats never read as current. Formation Lab and the source-credit
  row corrected to the sources actually used.
- Teams overview tile sizing and layout; Schedule featured carousel matching
  the home hero; simplified navigation; perf pass dropping the 1MB Madden
  fetch plus hash routing (`36a4120`); security headers via `_headers`
  (`e19a347`).

## In flight

- Checkpoint 2 (trustworthy evidence) on the local matchup preview:
  `scripts/load_team_tendencies.js` hardening (malformed records, duplicate
  `team|side|metric` identities, count-invariant breaks, rate/count
  disagreement, out-of-range values, unknown source keys) plus the expanded
  evidence disclosure; `index.html` question banner with real records, honest
  roster labels, and the unsupported log5 win-probability card removed. Tests
  green locally (`team_tendencies.test.js` 17, `validate_data.test.js` 18).
  Awaiting review of `results/checkpoint-2-completion.md`.

## Next

- Review `results/checkpoint-2-completion.md` (checkpoint 2 of
  `docs/superpowers/plans/2026-09-05-matchup-product/10-build-checkpoints.md`).
- Dashboard favicon + Open Graph tags (Sept 4 blocker B4) still unsent.
- Replace the dry-run-only 06:00 ESPN roster cron with a real upstream roster
  and transaction ingestion job (audit item 4). The publisher does not publish
  roster changes, so the deploy's roster snapshot only moves when someone
  commits it.
- Run cross-repo checks (`scripts/sync_shared_data.sh`,
  `scripts/check_repo_drift.sh`).

## Working tree (uncommitted, not on main)

- 18 modified PNGs under `screenshots_expansion/` — regenerated by every
  `test_all_extensions.py` run, not deliverables.
- 11 untracked: `.serena/`, `.superpowers/`, `supabase/.temp/`,
  `audit_mobile.py`, `home-redesign.html`, `mobile_audit_report.json`,
  `mobile_qa_report.json`, `screenshots_mobile/`, `scripts/debug_load.js`.

## Known limits

- The repo has no npm `playwright` install. The smoke passes with
  `PLAYWRIGHT_MODULE=/opt/homebrew/lib/python3.14/site-packages/playwright/driver/package`.
- The publisher pushes with the user's `osxkeychain` credential helper. The
  step was verified interactively; if launchd's non-interactive keychain access
  ever fails, the run fails at `publish dashboard` (visible in
  `pipeline-status.json` and the launchd log) and the last published output
  stays live. Recovery: `bash scripts/publish-daily.sh` from a logged-in shell.
- A failed publish is recorded in the local runtime status/log but cannot reach
  the deployed banner (the only way to update the banner is to publish). The
  deployed app therefore shows the last good data with no failure claim — by
  design, never a stale "ok".
- The publisher does not publish `nfl_rosters_2026.json`, `schedule.json`, or
  the research handoff files; those move only through their own syncs and a
  manual commit. `scripts/publish-daily.js` never touches them by design.
- Standings and statistics advance with the sources, not with a model: they are
  as fresh as the score workflow's results and Sleeper's ingestion, at most one
  daily publish behind at 07:00 ET. Both artifacts carry their own
  `generated_at`, which is what the League tab labels as the update time.
- GitHub's cron is delayed in practice. Sept 13 afternoon runs were about
  38-122 minutes apart; weekday baseline runs sometimes had gaps over 5 hours.
  There is no verified 30-minute upper bound. Moving cron minutes may help,
  but does not guarantee live-score latency.
- The 07:10 workspace sync cron fails with `Operation not permitted`. The
  07:00 props job succeeds in Application Support, but public props publication
  still needs a checked commit/push. The legacy 06:00 ESPN cron is dry-run-only
  and its output log has not advanced since Sept 3.

## Blockers

- None.
