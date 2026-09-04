# NFL Dashboard state

- Updated: 2026-09-04
- Live: https://nfldashboard.pages.dev/
- Repo: https://github.com/shyam4902/nfldashboard
- App: static `index.html`, tracked JSON assets, and Supabase roster and transaction data

## Shipped recently

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
