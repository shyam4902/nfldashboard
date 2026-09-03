-- Smallest migration for ESPN transaction persistence.
--
-- update_rosters_from_espn.js --write inserts normalized ESPN rows into
-- public.nfl_transactions idempotently. It skips tx_ids that already exist
-- before inserting, and this partial unique index makes the database enforce
-- the same contract so a repeated scan can never duplicate a row.
--
-- Apply once before the first authorized --write run, via the Supabase SQL
-- editor or `supabase db push`. Safe to run twice (all statements guarded).
--
-- The display/provenance columns the dashboard already reads (player_name,
-- pos, type, from_team, to_team, sort_date, date_str, blockbuster, detail)
-- must exist on the live table; only the persistence-only columns are added
-- here.

alter table public.nfl_transactions
  add column if not exists tx_id text,
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists source_id text,
  add column if not exists source_key text,
  add column if not exists ingested_at timestamptz default now();

create unique index if not exists nfl_transactions_tx_id_idx
  on public.nfl_transactions (tx_id)
  where tx_id is not null;
