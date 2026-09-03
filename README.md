# NFL Dashboard

Static NFL dashboard served from `index.html` and repository data assets.

> The Edge app uses `https://edge.shyamsapps.qzz.io`. Its `pages.dev` URL remains a valid fallback. Lovable references are historical only.

## Production deployment

`https://nfldashboard.pages.dev/` is git-connected to `shyam4902/nfldashboard` on `main`. Push a verified commit to publish through Cloudflare Pages:

```bash
git push origin main
```

Allow roughly 1–2 minutes for the Pages build. Verify the deployed page in a browser and check the console for errors when a release changes runtime behavior.

## Current dashboard

Primary views:

- **Home** — current schedule cards, source-backed prop insight, highlights, and navigation.
- **Schedule** — 18-week schedule with market-line and freshness context when available.
- **Matchup** — schedule-backed game picker, team efficiency comparisons, formation views, and source-scoped disclosures.
- **Teams** — roster overview, `Moves` newswire, Power Index, roster depth, player profiles, and draft capital.
- **Projections** — Clay standings, leaders, schedule, team projections, positional projections, defense, unit grades, coaching, and model comparison views.

Props and win totals are owned by the Edge Analytics app; the dashboard keeps only the links and source-backed Home integration that remain part of its contract.

## Data contract

The browser does not apply summer roster, transaction, or cap-space overrides. Teams, players, and dashboard transactions come from the Supabase-backed data path. Static artifacts such as `schedule.json`, `clay_projections_2026.json`, `draft-capital.json`, `madden_official_ratings.json`, and the shared data layer are loaded from the repository where the page requires them.

Missing cap-space values and missing or malformed weekly win probabilities render as `Unavailable`; explicit zero values remain valid. Freshness badges show source age and non-fresh manifest status when `data/shared/freshness.json` provides it.

## Data assets and validation

`scripts/data-assets.json` inventories every dashboard data asset — canonical copy, duplicated deploy copies, required/optional status, freshness key and threshold, browser fallbacks, and producer. One boring validator enforces it:

```bash
node scripts/validate-data.js
```

It checks that each JSON parses and has its required fields and shapes, that every duplicated deploy copy is byte-identical to the canonical file, that browser fallbacks exist, that props-board's embedded `generated_at` matches its manifest `as_of`, and that every other freshness entry is internally consistent (`as_of` parseable and never postdating `generated_at`; `age_hours`/`status` derived from it; thresholds matching the inventory). File mtimes are deliberately not provenance — Git discards them on checkout, so a clean clone must validate — and exact source vintages are verified producer-side by the fantasyfootball freshness-provenance test. Runtime dependencies (Supabase tables, the nflverse games feed) are inventoried with required status, failure behavior, and fallback policy; the validator never contacts the network. Exit 0 means the data layer is consistent; run it before deploying data changes.

Every nfldashboard copy of the shared layer is written by one path: `fantasyfootball/scripts/sync-shared-data.sh` (root `scripts/sync_shared_data.sh` is a shim). Publishing writes are atomic — same-dir temp plus rename, with temp names unique per process — so an interrupted sync, or two concurrent syncs, cannot corrupt a tracked artifact. Edge's `src/data/props-board.json` is intentionally separate — it is refreshed only via `refresh-props-board.ts`.

## ESPN transaction ingestion

`update_rosters_from_espn.js` parses supported ESPN signings, releases, waiver claims, and trades into the dashboard transaction shape. It canonicalizes unambiguous full, abbreviated, and ESPN short team names, validates normalized record fields and dry-run metadata, preserves source identifiers and descriptions, and skips unsupported descriptions rather than converting them into invented rows.

Use the dry-run path for inspection only:

```bash
node update_rosters_from_espn.js --dry-run
```

This writes `espn_transactions_2026.json` with source metadata and normalized records. It does not write roster files or Supabase. The dashboard still reads its live transaction view from Supabase; persistence of normalized ESPN transactions is a separate follow-up.

The roster generator and Supabase roster export no longer inject synthetic summer moves. Do not run live sync commands unless the task explicitly requires a remote write.

## Verification

Run from `nfldashboard/`:

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

`check_html_scripts.mjs` extracts the inline JavaScript from `index.html` and runs Node syntax validation on it. `node --check index.html` is not a valid HTML check.

The browser tests exercise the main flows and fail on content assertions or console errors. They are hermetic against project data by default: Supabase and nflverse requests are intercepted with deterministic fixtures derived from committed data (see `test-fixtures/README.md`). Real-network runs are explicit opt-ins — `DASH_LIVE_NETWORK=1` for the Python suites, `LIVE_SMOKE=1` for `props-smoke.mjs`. `props-smoke.mjs` uses normal Node module resolution or the `PLAYWRIGHT_MODULE` environment override when Playwright is installed outside the repository.

Generated screenshots are test artifacts and should not be included in a source/docs commit unless intentionally refreshed.

## Local preview and automation

Serve the checkout directly for a local preview:

```bash
python3 -m http.server 8080
```

The checked-in launchd plists are templates. Replace `/absolute/path/to/NFL_Main` with the checkout location and provide credentials through the machine's secret manager before loading them. This repository does not install or modify live launchd jobs. The local launchd runtime copy under `~/Library/Application Support/nfldashboard-props/nfldashboard/` is not the public deployment.
