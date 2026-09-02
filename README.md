# NFL Dashboard

> Edge app URL policy: use `https://edge.shyamsapps.qzz.io`, the live custom
> domain. `https://edgeplay-analytics.pages.dev` is the fallback for the same
> deployment. Lovable is historical only.

Static dashboard app, single-file (`index.html` + JSON assets).

## Deploy (confirmed 2026-09-01)

`https://nfldashboard.pages.dev/` is **git-connected to the GitHub repo
(`shyam4902/nfldashboard`, branch `main`) and auto-deploys on push**. To ship a
change:

```bash
git push origin main
```

Cloudflare Pages builds the pushed commit and publishes it (takes ~1–2 min).
Verified 2026-09-01: live site matched `origin/main` byte-for-byte before a
push, and the new build appeared ~1 min after `c805bff..503f3d2` landed.

Verification after deploy:

```bash
curl -s https://nfldashboard.pages.dev/ | grep -o "<marker text>"
# or load the URL in a browser and check console for errors
```

## Data files

The dashboard fetches its data from the repo itself: `props-board.json`
(copied from the fantasyfootball export), `schedule.json`, `nfl_rosters_2026.json`,
`clay_projections_2026.json`, `team_season_efficiency.json`, and the
`data/shared/` unified layer. Keep every JSON the page fetches committed, or
the deployed page 404s on it.

> The Props & Value tab is gone (ticket 13); props live in the Edge Analytics
> app. The dashboard reads `props-board.json` only for the Home insight line,
> the player modal, and the Schedule cross-link.

## Data and verification status

The browser does not apply summer roster, transaction, or cap-space overrides. The dashboard reads roster and transaction state from Supabase-backed data populated by the ESPN ingestion workflow. Missing values render as unavailable instead of being guessed, including cap-space and matchup win-probability fields. Freshness badges also surface non-fresh source status when provided by the manifest.

The current verification suite passes:

```bash
node props-smoke.mjs
python3 test_all_extensions.py
python3 test_projections.py
```

The Moves test searches for a transaction returned by the source at runtime. It does not require a particular player or hardcoded transaction. The projections test follows the current UI, where the Clay projected-starters view is retired and roster depth is covered through the Teams flow.

## Verification status

For HTML syntax validation, use the repository-aware checker rather than `node --check index.html` (Node does not accept `.html` files directly):

```bash
node check_html_scripts.mjs
```

The source and test cleanup is complete. The dashboard no longer applies browser-side summer roster, transaction, or cap-space overrides. Transactions and roster state come from the Supabase-backed data populated by the ESPN ingestion workflow. Missing values render as unavailable rather than being guessed.

Run the current checks with:

```bash
node props-smoke.mjs
python3 test_all_extensions.py
python3 test_projections.py
```

The Moves check uses a transaction returned at runtime instead of requiring a named player. The projections check follows the current UI and does not target the retired Clay projected-starters view.

## ESPN transaction ingestion

`update_rosters_from_espn.js` is the ESPN ingestion script. It normalizes supported signings, waivers, claims, and trades into the dashboard transaction shape, validates required fields, and skips unsupported descriptions without creating records. Use `--dry-run` to write `espn_transactions_2026.json` for inspection without changing roster files or a database:

```bash
node update_rosters_from_espn.js --dry-run
```

The output includes the ESPN source URL, fetch timestamp, record count, stable source keys, and normalized transactions. The script does not write Supabase transactions yet. The dashboard continues to read its transaction data from Supabase. No live sync or database write is part of the dry-run path.

## Automation and source status

The checked-in launchd plists are templates only: replace `/absolute/path/to/NFL_Main` with the checkout location and provide Supabase credentials through the machine's secret manager before loading them. This cleanup does not install or modify live launchd jobs. Publishing remains the repository's Cloudflare Pages push workflow; producer/shared-data synchronization is handled outside this repository.

## Local dev preview

`~/Library/Application Support/nfldashboard-props/nfldashboard/` is a *local*
runtime copy maintained by `fantasyfootball/scripts/install-launchd.sh` (used
by the launchd pipeline jobs). It is **not** the public deployment — editing it
does not ship anything. For a quick local preview, either serve this checkout
(`python3 -m http.server`) or refresh that runtime copy; neither touches
pages.dev.