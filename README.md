# NFL Dashboard

Static NFL dashboard served from `index.html` and repository data assets.

> The Edge app uses `https://edgeplay-analytics.pages.dev`. The `edge.shyamsapps.qzz.io` custom domain is not serving. Lovable references are historical only.

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

## Matchup preview: season labels and update rules

The matchup preview never invents a season: every measured label comes from the
data's own metadata, and the app keeps the current season (from the schedule)
separate from the season the numbers actually measure.

| Source | When it can update | How its season is determined | What the app shows before it arrives |
|---|---|---|---|
| Team tendencies (`team_tendencies_2025.json`) | Only by rerunning `research/nfl-stickiness/01-team-tendencies-producer.py` against a refreshed nflverse cache. Static 2025 reference today; 2026 charting (participation-style coverage) arrives after the 2026 postseason per the nflverse data schedule. | The artifact's `observation_period.season` (2025 today). The disclosure and banner label every tendency from this field — never from the current date or schedule. | Honest unavailable copy ("tendency unavailable… EPA and the field remain available"). No invented numbers; EPA bars and the Formation Lab still render. |
| Team efficiency / EPA (`team_season_efficiency_2012_2025.csv` → `team_season_efficiency.json`) | Rebuilt by the research R scripts (`01_build_dataset.R`) at season end. Through 2025 today. | The CSV's own `season` column; the app reads the maximum season present (2025 today) for every EPA lookup and label. | EPA cells show "—" where rows are missing; labels show the season the data actually covers. No silent blending with the current season. |
| Schedule (`schedule.json`) | Full-season build; refreshed in-season by the daily pipeline. 2026 today. | `schedule.json.season`. When it differs from the measured season, the preview says "{current} season in progress — these numbers measure the {measured} regular season (last completed)". | Schedule loads with its own freshness stamp; absent schedule data means the matchup picker stays empty rather than guessing games. |
| Rosters (`nfl_rosters_2026.json` / Supabase) | Weekly roster snapshot during the season. 2026 today. | Current season by construction (snapshot file name + schedule). | The field renders as illustrative alignments from the snapshot, labeled as not-a-verified-game-day-lineup and not-a-weekly-injury-report. |
| Clay projections (`clay_projections_2026.json`) | Season static. 2026 today. | File name + metadata. Always labeled `PROJECTIONS`, never measured. | Projection panels show an unavailable message when the file is absent. |

**Recorded limitation (2026 current-season measured data):** this pipeline has
no 2026 measured EPA or tendencies today — the app shows 2025 as the last
completed season. Enabling a current-season transition requires (a) rebuilding
team-season efficiency from in-season nflverse PBP (published weekly) by
updating the research cache and rerunning `01_build_dataset.R`, and (b)
rebuilding the tendency producer from 2026 PBP + FTN charting when that
coverage is available. Until then, a 2026 regenerated artifact is not expected,
and the season-transition mechanics (labels driven by `observation_period` and
the efficiency CSV's `season` column) are covered by fixture tests, not live
2026 data.

## Data assets and validation

`scripts/data-assets.json` inventories every dashboard data asset — canonical copy, duplicated deploy copies, required/optional status, freshness key and threshold, browser fallbacks, and producer. One boring validator enforces it:

```bash
node scripts/validate-data.js
```

It checks that each JSON parses and has its required fields and shapes, that every duplicated deploy copy is byte-identical to the canonical file, that browser fallbacks exist, that props-board's embedded `generated_at` matches its manifest `as_of`, and that every other freshness entry is internally consistent (`as_of` parseable and never postdating `generated_at`; `age_hours`/`status` derived from it; thresholds matching the inventory). File mtimes are deliberately not provenance: Git discards them on checkout, so a clean clone must validate. Exact source vintages are verified producer-side by the fantasyfootball freshness-provenance test. Runtime dependencies (Supabase tables, the nflverse games feed) are inventoried with required status, failure behavior, and fallback policy; the validator never contacts the network. Exit 0 means the data layer is consistent; run it before deploying data changes.

Every nfldashboard copy of the shared layer is written by one path: `fantasyfootball/scripts/sync-shared-data.sh` (root `scripts/sync_shared_data.sh` is a shim). Publishing writes are atomic (same-dir temp plus rename, temp names unique per process), so an interrupted sync, or two concurrent syncs, cannot corrupt a tracked artifact. Edge's `src/data/props-board.json` is intentionally separate: it is refreshed only via `refresh-props-board.ts`.

## ESPN transaction ingestion

`update_rosters_from_espn.js` parses supported ESPN signings, releases, waiver claims, and trades into the dashboard transaction shape. It canonicalizes unambiguous full, abbreviated, and ESPN short team names, validates normalized record fields, preserves source identifiers and descriptions, and skips unsupported descriptions rather than converting them into invented rows.

Dry run is the default. It fetches the live ESPN feed unless `--input` is supplied, and writes only the inspect artifact:

```bash
node update_rosters_from_espn.js --dry-run                    # live ESPN feed to espn_transactions_2026.json
node update_rosters_from_espn.js --input <saved-feed.json>    # same, from a saved feed (no network)
```

Persistence to Supabase is explicit and opt-in. The first write, and every later write, requires `--since`. The verified legacy boundary is `2026-04-23`, so the first safe import date is `2026-04-24`:

```bash
node update_rosters_from_espn.js --write --since 2026-04-24  # requires SUPABASE_URL and SUPABASE_SECRET_KEY
```

Writes are idempotent: every row carries a stable `tx_id` from the normalized source, exact ESPN timestamp, move type, player, and both teams. The writer sends one PostgREST bulk insert with `on_conflict=tx_id` and conflict-ignore handling, so concurrent runs do not race. Apply `supabase/migrations/20260903_espn_transactions_tx_id.sql` first. A failed write exits nonzero and never touches a local artifact.

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
node --test persist_espn_transactions.test.js
node --test validate_data.test.js
node --test concurrent_publish.test.js
PLAYWRIGHT_MODULE=/path/to/installed/playwright node props-smoke.mjs
python3 test_all_extensions.py
python3 test_projections.py
python3 test_schedule_data.py
python3 -m py_compile test_all_extensions.py test_projections.py test_schedule_data.py
```

`check_html_scripts.mjs` extracts the inline JavaScript from `index.html` and runs Node syntax validation on it. `node --check index.html` is not a valid HTML check.

The browser tests exercise the main flows and fail on content assertions or console errors. They are deterministic data-feed tests by default: Supabase and nflverse requests are intercepted with fixtures derived from committed data (see `test-fixtures/README.md`). They are not fully offline tests: Tailwind, supabase-js, and fonts still load from their CDNs. Real-network runs are explicit opt-ins (`DASH_LIVE_NETWORK=1` for the Python suites, `LIVE_SMOKE=1` for `props-smoke.mjs`). `props-smoke.mjs` uses normal Node module resolution or the `PLAYWRIGHT_MODULE` environment override when Playwright is installed outside the repository.

Generated screenshots are test artifacts and should not be included in a source/docs commit unless intentionally refreshed.

## Local preview and automation

Serve the checkout directly for a local preview:

```bash
python3 -m http.server 8080
```

The checked-in launchd plists are templates. Replace `/absolute/path/to/NFL_Main` with the checkout location and provide credentials through the machine's secret manager before loading them. This repository does not install or modify live launchd jobs. The local launchd runtime copy under `~/Library/Application Support/nfldashboard-props/nfldashboard/` is not the public deployment.
