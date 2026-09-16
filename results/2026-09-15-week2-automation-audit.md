# Week 2 update and automation audit

Checked September 15, 2026, Eastern time. Current files, GitHub runs, launchd
state, logs, and public JSON were inspected. Older state notes were not treated
as proof that a job still works.

## Updated

- Week 1 has all 16 finals. The public schedule already had those finals but
  still selected Week 1. The schedule now selects Week 2.
- Added the existing schedule builder to the score workflow. It retains
  recorded results and their sync timestamp. This handles future weekly rollovers.
- Refreshed the Supabase snapshot, 1,699 players across 32 teams. Snapshot
  contents were unchanged. This reads Supabase; it does not update its rosters.
- Updated the live Moves feed with 163 normalized ESPN transactions dated
  Sept 4-15. Reused the existing normalizer, validation, and identity logic;
  inserted through the authenticated Supabase connector with conflict-ignore.
  Verified 2,131 total rows, latest Sept 15, and no duplicate transaction IDs.
  Existing rows and player roster assignments were preserved.
- Refreshed the producer database with all 272 regular-season games, including
  16 scored Week 1 games, after taking a SQLite backup.
- Ran the full daily props pipeline. It finished at 20:36 ET. The board has
  1,830 plays and all 32 win-total rows, each with one game played.
- Fixed the producer's use of an encoded URL pathname as a filesystem path.
  The space in `Application Support` prevented its win-total CSVs from loading.
  The source and installed runtime now use `fileURLToPath`.

## What is actually running

| Automation | Verified state | Evidence and decision |
| --- | --- | --- |
| GitHub score sync and Pages publish | Working, irregular timing | All 30 recorded runs succeeded, including the unattended Sunday slate. Eleven score commits published all finals. Keep. |
| Weekly schedule rollover | Added to the score workflow | Existing builder computes the current week; new regression checks preserve finals and provenance. Keep with score sync. |
| 07:00 launchd props pipeline | Working locally | Sept 15 log ends with `pipeline status: ok` at 07:01:44 ET. Path bug repaired and installed. Keep. |
| Weekly launchd roster snapshot | Loaded, latest logged run succeeded | `launchctl print` reports interval 604800 seconds, two runs, exit 0. Log modified Sept 12 and reports 1,699 players. Keep as a snapshot job. |
| 07:10 workspace shared-data cron | Broken | `shared-sync.log` repeatedly reports `Operation not permitted`; file updated Sept 15. Replace with a publish path outside Desktop. |
| 06:00 ESPN roster cron | Not a working live updater | Current command defaults to dry-run and only normalizes transactions. `update.log` last changed Sept 3. Retire or replace after selecting the real upstream ingestion path. |
| Public daily props publication | Missing | The public/repo board was still dated Sept 8 while the runtime had Sept 15 output. A local copy step would still need commit/push. Build next. |
| Codex automations for these repos | None found | No installed automation TOML referenced NFL or fantasy. No Codex jobs were added. |

Recent score-run proof:
[successful scheduled run](https://github.com/shyam4902/nfldashboard/actions/runs/35031735349)
and [first Sunday afternoon run](https://github.com/shyam4902/nfldashboard/actions/runs/34770743045).

Sunday afternoon start times were 17:09, 19:11, 20:04, 21:26, 22:44, and
23:22 UTC. A 15-minute cron expression did not produce 15-minute updates.
Moved the cron minutes to 7/22/37/52. GitHub documents that scheduled jobs
can be delayed or dropped under load, particularly at the start of the hour.
This change reduces that exposure, not the need to check freshness.
[GitHub schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Build next

1. A guarded daily publisher. Use an isolated checkout outside Desktop so the
   Mac's existing runtime can publish without touching the user's working tree.
   Pull current main, copy only producer-owned artifacts, preserve the score
   workflow's schedule, validate, commit changed data, push, then compare public
   artifact timestamps and contents. Notify only on failure or stale delivery.
   Reuse the current pipeline and validator. A new agent system is unnecessary.
2. Add game-result ingestion to the producer's daily pipeline before export.
   The dashboard's score sync updates JSON, while win-total records read SQLite.
   Both need current results. This session refreshed SQLite manually.
3. Add a Tuesday completion check. Confirm the previous week has every final,
   the selected week advanced, the next slate exists, and the public board is
   under 24 hours old. Thursday and Sunday checks can reuse it for readiness.
4. Replace the misleading ESPN cron with an explicit upstream roster and
   transaction ingestion job. Verify permissions and idempotent writes before
   enabling it. The existing Supabase snapshot does not ingest upstream changes.

## Data that remains historical

- Sportsbook quote timestamps still date to August 23. Kalshi and Polymarket
  refreshed during this run. A fresh export does not make every quote fresh.
- Clay projections and 2025 efficiency/tendency analysis retain their source
  vintage. This refresh does not create 2026 weekly performance analytics.
- The Edge app has its own deployment. This task updates the NFL dashboard
  and producer artifacts, not Edge's deployed board.

## Validation

- 283 producer tests and syntax checks passed.
- Dashboard data validator passed all 16 assets.
- 21 score/data/concurrent-publish Node checks passed.
- All 24 transaction normalization/persistence tests passed.
- Live production health check passed all 7 checks after the Moves refresh.
- Schedule invariants and the new rollover/result-preservation check passed.
- Python browser suite passed with zero console and uncaught page errors.
- Node smoke passed using the installed Python Playwright package.
- Browser-test screenshots went to `/tmp/nfl-week2-screenshots`; existing
  uncommitted screenshots and other user files were excluded from the release.
