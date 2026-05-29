-- Wave 931: batch market-key invalidation enqueue.
--
-- Daangn detail backfill can patch ~100 listings per shard run. Calling the
-- single-key enqueue RPC once per comparable_key creates unnecessary REST
-- round trips. This function keeps the same upsert/increment semantics while
-- accepting a JSONB array.

create or replace function public.enqueue_mvp_market_key_invalidations(
  p_events jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with raw_events as (
    select
      nullif(trim(comparable_key), '') as comparable_key,
      left(coalesce(reason, 'unknown'), 120) as reason,
      greatest(0, coalesce(priority, 0)) as priority,
      affected_pid,
      old_comparable_key,
      new_comparable_key,
      parser_version,
      greatest(1, coalesce(event_count, 1)) as event_count
    from jsonb_to_recordset(coalesce(p_events, '[]'::jsonb)) as event(
      comparable_key text,
      reason text,
      priority integer,
      affected_pid bigint,
      old_comparable_key text,
      new_comparable_key text,
      parser_version text,
      event_count integer
    )
  ), deduped as (
    select
      comparable_key,
      (array_agg(reason order by priority desc))[1] as reason,
      max(priority) as priority,
      (array_agg(affected_pid order by priority desc) filter (where affected_pid is not null))[1] as affected_pid,
      (array_agg(old_comparable_key order by priority desc) filter (where old_comparable_key is not null))[1] as old_comparable_key,
      (array_agg(new_comparable_key order by priority desc) filter (where new_comparable_key is not null))[1] as new_comparable_key,
      (array_agg(parser_version order by priority desc) filter (where parser_version is not null))[1] as parser_version,
      sum(event_count)::integer as event_count
    from raw_events
    where comparable_key is not null
    group by comparable_key
  ), upserted as (
    insert into public.mvp_market_key_invalidation (
      comparable_key,
      reason,
      priority,
      affected_pid,
      old_comparable_key,
      new_comparable_key,
      parser_version,
      status,
      event_count,
      first_event_at,
      last_event_at
    )
    select
      comparable_key,
      reason,
      priority,
      affected_pid,
      old_comparable_key,
      new_comparable_key,
      parser_version,
      'pending',
      event_count,
      now(),
      now()
    from deduped
    on conflict (comparable_key) do update
    set reason = excluded.reason,
        priority = greatest(public.mvp_market_key_invalidation.priority, excluded.priority),
        affected_pid = coalesce(excluded.affected_pid, public.mvp_market_key_invalidation.affected_pid),
        old_comparable_key = coalesce(excluded.old_comparable_key, public.mvp_market_key_invalidation.old_comparable_key),
        new_comparable_key = coalesce(excluded.new_comparable_key, public.mvp_market_key_invalidation.new_comparable_key),
        parser_version = coalesce(excluded.parser_version, public.mvp_market_key_invalidation.parser_version),
        event_count = public.mvp_market_key_invalidation.event_count + excluded.event_count,
        last_event_at = now(),
        last_error = null,
        status = case
          when public.mvp_market_key_invalidation.status in ('done', 'failed') then 'pending'
          else public.mvp_market_key_invalidation.status
        end
    returning 1
  )
  select count(*) into v_count from upserted;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.enqueue_mvp_market_key_invalidations(jsonb) from public;
revoke execute on function public.enqueue_mvp_market_key_invalidations(jsonb) from anon;
revoke execute on function public.enqueue_mvp_market_key_invalidations(jsonb) from authenticated;
grant execute on function public.enqueue_mvp_market_key_invalidations(jsonb) to service_role;
