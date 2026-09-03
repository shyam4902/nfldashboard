# NFL Dashboard — State

- updated: 2026-09-03
- live: https://nfldashboard.pages.dev/ (Cloudflare Pages; git-connected and published by `git push origin main`)
- repo: https://github.com/shyam4902/nfldashboard
- app: static `index.html` with repository JSON assets and Supabase-backed roster/transaction data
- local preview copy: `~/Library/Application Support/nfldashboard-props/nfldashboard/` is used by launchd and is not the public deployment

## Current state

- The dashboard is a five-view static app: Home, Schedule, Matchup, Teams, and Projections.
- Matchup Center uses a three-column modular quant layout (Variant B): Left rail displays win probability, consensus market lines (NFLverse), 2025 situational efficiency strip, and game kickoff telemetry. Center rail renders Passing and Rushing efficiency matrices with live EPA/att rankings and edge indicators. Right rail renders Clay 2026 unit matchup power, dual skill radar, verified matchup insights, and tactical launchers.
- Teams contains Overview, Moves, and Power Index. The former top-level Transactions route redirects to Teams → Moves for compatibility.
- Props and win totals are linked to the Edge Analytics app; they are not dashboard tabs.
- Clay projected starters remain in the extraction artifact but are not a dashboard view. Current roster depth is shown through Teams.
- The browser contains no summer roster, transaction, cap-space, or synthetic-player override.
- Missing cap-space values render as `Unavailable`; missing or malformed weekly win probabilities render as `Unavailable` while explicit zero values remain valid.
- Freshness badges use `data/shared/freshness.json` when available.
- Madden ratings are used in the Matchup Lab only; they do not replace source roster data or appear as a general dashboard roster rating source.

## Data and ingestion

- Supabase-backed `nfl_teams`, player pages, and `nfl_transactions` supply the live dashboard data path.
- Repository artifacts provide schedule, Clay projections, draft capital, official Madden ratings, props-board integration, and shared freshness metadata.
- `update_rosters_from_espn.js` normalizes supported ESPN transaction descriptions, canonicalizes unambiguous team names, validates normalized records, and skips unsupported descriptions.
- `node update_rosters_from_espn.js --dry-run` produces a source-tagged normalized inspection artifact without roster-file or database writes.
- Normalized ESPN transaction persistence to Supabase is not implemented; the dashboard continues to read transactions from Supabase.

## Backend hardening (2026-09-03)

- `scripts/data-assets.json` is the single inventory of dashboard data assets: canonical copy, duplicated deploy copies, required/optional status, freshness key and threshold, browser fallbacks, and producer for each asset (including the research handoffs that are freshness-tracked but not deployed).
- `scripts/validate-data.js` is the one boring validator: `node scripts/validate-data.js` checks JSON parsing, required fields and shapes, byte-identity of every duplicated deploy copy, browser-fallback presence, freshness provenance (props-board's embedded `generated_at` matched exactly; everything else verified for internal manifest consistency), and the bidirectional manifest ⇄ inventory contract. File mtimes are not provenance — Git discards them on checkout, so a clean clone must validate; exact source vintages are verified producer-side (fantasyfootball freshness-provenance test). `validate_data.test.js` covers it hermetically, including clean-checkout semantics and malformed-shape fixtures.
- Publishing writes are atomic with temp names unique per process: `scripts/atomic-write.js` (pid + counter) backs the roster writers; the schedule/draft-capital/Clay builders use pid-suffixed temps + `os.replace`; `fantasyfootball/scripts/sync-shared-data.sh` uses `$$`-suffixed temps. Concurrent publishers cannot collide, and an interrupted run cannot leave a truncated tracked artifact. `concurrent_publish.test.js` runs two concurrent publishers of each kind hermetically.
- The inventory records the runtime dependencies (Supabase `nfl_teams`/`nfl_players`/`nfl_transactions`, the nflverse games feed) with required status, failure behavior, fallback policy, and test-fixture mapping. The validator never contacts the network.
- Browser tests are hermetic against project data: Supabase REST, nflverse games.csv, and espncdn logos are intercepted with deterministic fixtures derived from committed data (`test-fixtures/README.md`). Real-network runs are explicit opt-ins (`DASH_LIVE_NETWORK=1`, `LIVE_SMOKE=1`).
- The sync script is the sole writer of every nfldashboard deploy copy, including the root `props-board.json` and `team_season_efficiency.json` browser fallbacks whose sources live outside the dashboard — the root props fallback had silently drifted one export behind; the validator now catches any future drift.
- `props-smoke.mjs` serves the versioned `data/shared/` deploy copies (not the unversioned workspace handoff), so the browser test exercises the same bytes the Pages deploy ships.
- Removed dead `scripts/inseason_sync.py` (zero consumers, fabricated `last_updated`) and the legacy `com.nfldashboard.rosterupdate.plist` template (job never installed; only `props-scan` and `rostersync` are loaded). `update_rosters_from_espn.js` stays as the dry-run normalization tool.
- `extract_clay_projections.py` derives its PDF/output paths from the script location instead of hardcoded `/Users/shyampatel/Desktop/NFL_Main` paths.

## Shipped cleanup

- Browser-side summer roster, transaction, cap-space, and synthetic-player overrides were removed.
- The stale global “Top WR” walkthrough claim was relabeled as a source-scoped Clay example.
- Dashboard tests use repository-relative paths for their dashboard files and runtime transaction data rather than a named player fixture.
- `check_html_scripts.mjs` validates inline JavaScript extracted from `index.html`; `node --check index.html` is not a valid command.
- Browser tests now fail on content assertions and console errors instead of only printing them.
- `props-smoke.mjs` uses normal Node module resolution or the explicit `PLAYWRIGHT_MODULE` environment override and cleans up its HTTP server in `finally`.
- The dated Teams → Moves design and implementation plan remain under `docs/superpowers/` as historical records.

## Verification

The current checks are:

```bash
node scripts/validate-data.js
node check_html_scripts.mjs
node --check generate_roster_files.js
node --check sync_supabase_rosters.js
node --check update_rosters_from_espn.js
node --test update_rosters_from_espn.test.js
node --test validate_data.test.js
node --test concurrent_publish.test.js
PLAYWRIGHT_MODULE=/path/to/installed/playwright node props-smoke.mjs
python3 test_all_extensions.py
python3 test_projections.py
python3 test_schedule_data.py
python3 -m py_compile test_all_extensions.py test_projections.py test_schedule_data.py
```

`scripts/validate-data.js` is the data-layer gate (run it before any deploy that changes data). The HTML checker is required because Node does not syntax-check `.html` files directly. The review-finding implementation plan is complete; the remaining limitations below are separate follow-up work.

## Known limitations

- ESPN normalization supports the transaction forms covered by the parser fixtures; unsupported descriptions are intentionally omitted.
- ESPN dry-run output is inspectable but is not yet persisted to the Supabase transaction table.
- Some Clay extraction sections remain available only in JSON, including returners, kickers, unit ranks, and projected starters.
- Launchd plists are portable templates and require a machine-specific checkout path and credentials before installation.
- The app remains intentionally single-file and has no build step; a module split would be a separate migration requiring browser regression coverage.
- Browser tests are hermetic against project data feeds but still load third-party CDN libraries (Tailwind, supabase-js, fonts) from the network; full offline hermeticity would require vendoring those.

## Next work

- Decide and implement the server-side persistence path for normalized ESPN transactions.
- Continue the source-backed trust audit as new unsupported claims or fallbacks are identified.
- Revisit freshness coverage and module extraction only when they can be changed without weakening the static deployment contract.

## Blockers

- None recorded.
