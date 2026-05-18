alter table public.mvp_pack_reveals
  add column if not exists current_profit_min integer default null,
  add column if not exists current_profit_max integer default null,
  add column if not exists market_invalidated_at timestamptz default null;

create index if not exists mvp_pack_reveals_market_invalidated_idx
  on public.mvp_pack_reveals(market_invalidated_at)
  where market_invalidated_at is not null;

create or replace function public.sync_reveal_current_profits_from_json(p_updates jsonb)
returns table(updated_count integer, invalidated_count integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with input_rows as (
    select distinct on (x.pid)
      x.pid,
      x.current_profit_min,
      x.current_profit_max,
      coalesce(x.market_invalidated, false) as market_invalidated
    from jsonb_to_recordset(coalesce(p_updates, '[]'::jsonb)) as x(
      pid bigint,
      current_profit_min integer,
      current_profit_max integer,
      market_invalidated boolean
    )
    where x.pid is not null
      and x.current_profit_min is not null
      and x.current_profit_max is not null
    order by x.pid
  ),
  updated as (
    update public.mvp_pack_reveals r
    set
      current_profit_min = i.current_profit_min,
      current_profit_max = i.current_profit_max,
      market_invalidated_at = case
        when i.market_invalidated then coalesce(r.market_invalidated_at, now())
        else null
      end
    from input_rows i
    where r.pid = i.pid
      and (
        r.current_profit_min is distinct from i.current_profit_min
        or r.current_profit_max is distinct from i.current_profit_max
        or (i.market_invalidated and r.market_invalidated_at is null)
        or (not i.market_invalidated and r.market_invalidated_at is not null)
      )
    returning i.market_invalidated
  )
  select
    count(*)::integer as updated_count,
    count(*) filter (where market_invalidated)::integer as invalidated_count
  from updated;
end;
$$;

grant execute on function public.sync_reveal_current_profits_from_json(jsonb) to service_role;

notify pgrst, 'reload schema';
