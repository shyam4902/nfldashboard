# NFL Dashboard state

- Updated: 2026-09-15
- Live: https://nfldashboard.pages.dev/
- Repo: https://github.com/shyam4902/nfldashboard
- App: static `index.html`, tracked JSON assets, and Supabase roster/transaction data

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
- Add guarded daily publication of the producer's output and verify the live
  artifact after deployment. The runtime pipeline alone does not publish it.
- Dashboard favicon + Open Graph tags (Sept 4 blocker B4) still unsent.
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
