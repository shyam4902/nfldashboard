# NFL Dashboard state

- Updated: 2026-09-04
- Live: https://nfldashboard.pages.dev/
- Repo: https://github.com/shyam4902/nfldashboard
- App: static `index.html`, tracked JSON assets, and Supabase roster and transaction data

## Shipped recently

- Repaired Teams experience across live Supabase data, tracked static JSONs, and dashboard UI logic.
- Applied database migrations to Supabase (`nedyoydylpbjvihaoexy`) via Management API:
  - `supabase/migrations/20260903_espn_transactions_tx_id.sql`: Targets `nfl_dashboard.transactions`, allows `'waiver'` transaction type, creates unique index on `tx_id`, recreates public view with provenance columns (`tx_id`, `raw_text`, `source_date`, `created_at`), and sets RLS with public read and service_role write.
  - `supabase/migrations/20260904_atomic_roster_replacement.sql`: Implements atomic RPC `public.replace_nfl_players(p_rows jsonb)` on `nfl_dashboard.players` with transaction-level advisory lock `pg_advisory_xact_lock(7492026)`, minimum row check (1,600 rows), and RLS.
- Synchronized canonical live rosters:
  - Replaced 2,517 stale rows in Supabase with a validated 32-team snapshot of 1,699 active players (52 to 54 players per team) fetched directly from ESPN core API.
  - Regenerated `nfl_rosters_2026.json` and deploy copy `data/shared/nfl_rosters_2026.json` with pure ESPN identity fields, removing corrupted Madden age/jersey overwrites.
  - Updated `sync_supabase_rosters.js` and `sync_rosters_from_espn_api.js` to support both `sb_secret_` (header `apikey`) and legacy JWT service keys.
- Synchronized live transactions:
  - Added multi-page pagination to `update_rosters_from_espn.js` (pages 1-4, 855 items after 2026-04-23).
  - Inserted 1,616 fresh transaction rows with deterministic `tx_id` values and source timestamps into Supabase. Total transaction count increased from 352 to 1,968, with the latest transaction dated 2026-09-03. Verified idempotent on re-run (0 rows inserted).
- Hardened dashboard UI (`index.html`):
  - Isolated Madden rating overlays in `mergeMadden()`: Madden data only provides `maddenRating`, `maddenSpeed`, and related ratings; it no longer overwrites verified ESPN player age or jersey numbers.
  - Updated Teams "Moves" page: defaults to "Roster Moves" filter (trades, signings, waivers, cuts), filtering out 2026 NFL draft picks while keeping them accessible via an explicit "Draft" filter.
  - Improved date parsing in the Moves table to prioritize `source_date` before falling back to `date` or `created_at`, ensuring proper chronological sorting.
  - Updated Moves subtab badge and summary metrics to reflect active roster moves count.
- Added comprehensive verification suites:
  - Unit tests: `moves_filtering.test.js` (6 deterministic tests verifying filter behavior, draft exclusion, sorting, and edge cases). Total test suite now at 50/50 passing (`node --test *.test.js`).
  - Production health check: `scripts/production-health-check.mjs` (7 checks verifying remote Supabase contracts, row counts, and schema columns).
  - Browser extensions suite: `python3 test_all_extensions.py` (verified 0 console errors and clean rendering).

- Home view redesigned to the "2a" pregame-studio direction:
  - `homeRedesign2aHtml()` / `initHomeCarousel()` / `home2a*` helpers: 3-slide auto-rotating hero, Week 1 color-bar scorestrip, storylines and power-index row. Scoped under `.h2a-*` classes.
  - Team logos and visual assets integrated across the homepage UI.
  - `_redirects` deny list added at repo root.

## Backup and rollback artifacts

- Supabase table snapshots before migration and data replacement:
  - Directory: `~/.nfldashboard-backups/20260904_repair/`
  - Players (2,517 rows): `nfl_players_2026-09-04T10-13-34-968Z.json` (SHA-256: `e2a402367c667a756b5fc06312f67c6e4c2f978fc79c4d6c27cb1ebd767cec14`)
  - Transactions (352 rows): `nfl_transactions_2026-09-04T10-13-34-968Z.json` (SHA-256: `8d9596ab2f88c239118521ec319e67ef00bc33c23a26bf9244f779947b470b3c`)
- Rollback instructions:
  - Supabase players: restore using `public.replace_nfl_players()` RPC with backup JSON rows.
  - Supabase transactions: truncate `nfl_dashboard.transactions` and re-insert backup JSON rows.
  - Git: revert commit `a2dc55a` or reset to `962c915`.

## In flight

- Local `main` is merged with `fix/teams-roster-moves-repair`.
- Untracked `screenshots_expansion/*.png` edits remain untouched.
- Ready to push to `origin/main` to trigger Cloudflare Pages deployment.

## Next

- Push `main` to `origin/main`.
- Verify live production deployment at `https://nfldashboard.pages.dev` via browser and automated checks.
- Clean up temporary worktree `nfldashboard-teams-repair`.
