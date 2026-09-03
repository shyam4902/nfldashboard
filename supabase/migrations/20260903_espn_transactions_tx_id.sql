-- Add the provenance and identity fields used by the ESPN writer.
-- Existing rows intentionally keep a NULL tx_id. The first import must use an
-- explicit date cutoff that starts after the legacy feed's coverage. The
-- verified legacy boundary is 2026-04-23, making 2026-04-24 the first safe
-- import date. This avoids silently duplicating legacy rows whose source
-- timestamp is unknown.

alter table public.nfl_transactions
  add column if not exists tx_id text,
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists source_id text,
  add column if not exists source_key text,
  add column if not exists source_date timestamptz,
  add column if not exists ingested_at timestamptz default now();

-- PostgREST on_conflict requires a normal unique constraint or index. A
-- nullable unique column still permits the legacy NULL rows.
drop index if exists public.nfl_transactions_tx_id_idx;
create unique index nfl_transactions_tx_id_idx
  on public.nfl_transactions (tx_id);

alter table public.nfl_transactions enable row level security;
revoke all on table public.nfl_transactions from anon, authenticated;
grant select on table public.nfl_transactions to anon, authenticated;
grant all on table public.nfl_transactions to service_role;

drop policy if exists "Public can read transactions" on public.nfl_transactions;
create policy "Public can read transactions"
  on public.nfl_transactions
  for select
  to anon, authenticated
  using (true);
