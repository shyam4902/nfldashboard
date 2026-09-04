# NFL Dashboard state

- Updated: 2026-09-04
- Live: https://nfldashboard.pages.dev/
- Repo: https://github.com/shyam4902/nfldashboard
- App: static `index.html`, tracked JSON assets, and Supabase roster and transaction data

## Shipped recently

- Home view redesigned to the "2a" pregame-studio direction (from the Claude Design project "Home page UI mockups"). New `homeRedesign2aHtml()` / `initHomeCarousel()` / `home2a*` helpers replace the old hero + front door + showcase region: a 3-slide auto-rotating hero (featured matchup → transactions promo → Edge promo, 7s autoplay, hover-pause, dots + arrows), a Week 1 color-bar scorestrip, and a storylines + power-index row. Uses Geist/Archivo/Geist Mono (Archivo added to the font import) and a warm-dark/amber palette scoped under `.h2a-*` classes, so the rest of the app keeps its slate theme. The featured matchup, scorestrip, and power index read live data (`SCHEDULE_DATA` + `gameMarketLines`/`computeTeamOverall`/`winProb`, `CLAY_DATA.team_projections`); the two promo slides and storyline cards are editorial by design. No fabricated rank-movement arrows (no prior-week ranking exists). `projPowerHtml` was dropped from the spotlights fill to avoid duplicating the new power index. `homeHeroHtml`/`homeShowcaseHtml`/`todayInNflHtml` are now unused (left in place as a revert path). Verified in-browser over HTTP with real data (NE @ SEA featured, LAR 13.2 power index top). `home-redesign.html` at repo root is the standalone review mockup — scratch, deletable, not needed by the app.

- `_redirects` deny list added at repo root: Pages rules override physical files, so internal files (AGENTS/STATE/*.md, scripts/, tests, sync scripts, screenshots, migrations) now 302 to `/` instead of being served raw. Public surface is exactly `index.html` + the data JSONs the dashboard fetches (`data/shared/*` and root data copies). Verified by classifier over all 87 tracked files — 0 public assets blocked, 0 internal files uncovered. Ships on next `git push`.

- Local `main` now includes merge commit `8b75641` for the ESPN transaction persistence batch.
- `update_rosters_from_espn.js` defaults to dry run and writes to Supabase only with `--write`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and an explicit `--since` cutoff.
- The writer uses stable `tx_id` values, one PostgREST conflict-ignore insert, uniform row keys, exact source timestamps, and no public credential.
- Migration `20260903_espn_transactions_tx_id.sql` adds provenance columns, a unique `tx_id` index, RLS, public read-only access, and `service_role` writes.
- The first safe import boundary is `--since 2026-04-24`; 352 older rows retain null `tx_id` values.
- Backend validation covers 15 assets, duplicate deploy copies, freshness provenance, malformed inputs, and concurrent publishers.
- The shared roster deploy copy matches `nfl_rosters_2026.json` again.

## In flight

- Local `main` is six commits ahead of `origin/main`. Nothing from this batch has been pushed or deployed.
- The Supabase migration has not been applied and no live transaction write has run.
- Existing `screenshots_expansion/*.png` edits remain uncommitted and untouched.
- The transaction worktree and merged feature branch remain available as rollback references.

## Next

- Review and push local `main` when ready to deploy the dashboard changes.
- Apply the transaction migration before enabling the writer.
- Configure the server-only secret, run the first write with `--since 2026-04-24`, and inspect the inserted rows.
- Continue backend work in reversible batches after the persistence path is live.

## Blockers

- Live transaction persistence waits on the migration and a server-only Supabase secret.
- No code blocker: 44 tests pass and `scripts/validate-data.js` reports all 15 assets healthy.
