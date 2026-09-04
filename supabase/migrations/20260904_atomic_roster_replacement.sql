-- Atomic roster replacement RPC and player table RLS policies.
-- Replaces nfl_dashboard.players within a single database transaction under
-- an advisory lock. Rejects payloads under 1600 rows to prevent partial wipes.

-- RLS on nfl_dashboard.players
alter table nfl_dashboard.players enable row level security;
revoke all on table nfl_dashboard.players from anon, authenticated;
grant select on table nfl_dashboard.players to anon, authenticated;
grant all on table nfl_dashboard.players to service_role;

revoke all on table public.nfl_players from anon, authenticated;
grant select on table public.nfl_players to anon, authenticated;
grant all on table public.nfl_players to service_role;

drop policy if exists "Public can read players" on nfl_dashboard.players;
create policy "Public can read players"
  on nfl_dashboard.players
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Service role can write players" on nfl_dashboard.players;
create policy "Service role can write players"
  on nfl_dashboard.players
  for all
  to service_role
  using (true)
  with check (true);

-- Team grants for service_role
grant select on table nfl_dashboard.teams to service_role;
grant select on table public.nfl_teams to service_role;

-- Atomic replacement RPC
create or replace function public.replace_nfl_players(p_rows jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_count integer;
  v_inserted integer;
begin
  -- Advisory transaction lock ensures only one replacement runs at a time
  perform pg_advisory_xact_lock(7492026);

  v_count := jsonb_array_length(p_rows);
  if v_count < 1600 then
    raise exception 'Roster replacement rejected: row count % is below safety threshold of 1600', v_count;
  end if;

  -- Atomic replace within this transaction (WHERE true satisfies safeupdate)
  delete from nfl_dashboard.players where true;

  insert into nfl_dashboard.players (
    id, team_id, jersey, name, pos, age, ovr, is_rookie, ratings_source, acquisition_type, unit
  )
  select
    coalesce((r->>'id')::uuid, gen_random_uuid()),
    (r->>'team_id')::uuid,
    nullif(r->>'jersey', '')::integer,
    r->>'name',
    r->>'pos',
    nullif(r->>'age', '')::integer,
    nullif(r->>'ovr', '')::integer,
    coalesce((r->>'is_rookie')::boolean, false),
    coalesce(r->>'ratings_source', 'unrated'),
    coalesce(r->>'acquisition_type', 'veteran'),
    lower(coalesce(r->>'unit', 'offense'))
  from jsonb_array_elements(p_rows) as r;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'status', 'success',
    'input_count', v_count,
    'inserted_count', v_inserted
  );
end;
$$;

-- Security: reserve function execution exclusively for service_role
revoke all on function public.replace_nfl_players(jsonb) from public, anon, authenticated;
grant execute on function public.replace_nfl_players(jsonb) to service_role;
