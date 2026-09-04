-- Add the provenance and identity fields used by the ESPN writer.
-- Existing rows intentionally keep a NULL tx_id. The first import must use an
-- explicit date cutoff that starts after the legacy feed's coverage. The
-- verified legacy boundary is 2026-04-23, making 2026-04-24 the first safe
-- import date. This avoids silently duplicating legacy rows whose source
-- timestamp is unknown.
--
-- Inspection note: public.nfl_transactions is a view over nfl_dashboard.transactions.
-- The underlying table is nfl_dashboard.transactions.

-- Ensure schema usage is granted
grant usage on schema nfl_dashboard to anon, authenticated, service_role;

alter table nfl_dashboard.transactions
  add column if not exists tx_id text,
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists source_id text,
  add column if not exists source_key text,
  add column if not exists source_date timestamptz,
  add column if not exists ingested_at timestamptz default now();

-- Update constraint to permit 'waiver' in addition to trade, signing, draft
alter table nfl_dashboard.transactions drop constraint if exists transactions_type_check;
alter table nfl_dashboard.transactions add constraint transactions_type_check
  check (type = any (array['trade'::text, 'signing'::text, 'draft'::text, 'waiver'::text]));

-- PostgREST on_conflict requires a normal unique constraint or index. A
-- nullable unique column still permits the legacy NULL rows.
drop index if exists nfl_dashboard.transactions_tx_id_idx;
create unique index if not exists transactions_tx_id_idx
  on nfl_dashboard.transactions (tx_id);

-- Recreate the public view to expose the new columns
create or replace view public.nfl_transactions as
  select
    id,
    type,
    blockbuster,
    player_name,
    pos,
    from_team,
    to_team,
    detail,
    date_str,
    sort_date,
    tx_id,
    source,
    source_url,
    source_id,
    source_key,
    source_date,
    ingested_at
  from nfl_dashboard.transactions;

alter table nfl_dashboard.transactions enable row level security;
revoke all on table nfl_dashboard.transactions from anon, authenticated;
grant select on table nfl_dashboard.transactions to anon, authenticated;
grant all on table nfl_dashboard.transactions to service_role;

revoke all on table public.nfl_transactions from anon, authenticated;
grant select on table public.nfl_transactions to anon, authenticated;
grant all on table public.nfl_transactions to service_role;

drop policy if exists "Public can read transactions" on nfl_dashboard.transactions;
create policy "Public can read transactions"
  on nfl_dashboard.transactions
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Service role can write transactions" on nfl_dashboard.transactions;
create policy "Service role can write transactions"
  on nfl_dashboard.transactions
  for all
  to service_role
  using (true)
  with check (true);
