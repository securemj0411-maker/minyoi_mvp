-- Wave 1019 (2026-06-02): market-worker score_dirty marking hotpath.
-- Non-destructive:
--   1) add a partial index for active/scorable/clean raw rows
--   2) add a SECURITY DEFINER RPC that marks only those rows by comparable_key

create index concurrently if not exists mvp_raw_scorable_clean_pid_last_seen_idx
  on public.mvp_raw_listings (pid)
  include (last_seen_at)
  where score_dirty is false
    and detail_status = 'done'
    and sku_id is not null
    and listing_state = 'active'
    and (listing_type = 'normal' or listing_type_override = 'normal');

create or replace function public.mark_scorable_score_dirty_by_comparable_keys(
  p_comparable_keys text[],
  p_limit integer default 1200
)
returns table(candidate_count integer, marked_count integer)
language plpgsql
security definer
set search_path = public
set statement_timeout = '60s'
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 1200), 5000));
begin
  return query
  with target as materialized (
    select r.pid
    from public.mvp_listing_parsed p
    join public.mvp_raw_listings r on r.pid = p.pid
    where p.comparable_key = any(p_comparable_keys)
      and p.parse_confidence >= 0.65
      and p.needs_review is false
      and r.score_dirty is false
      and r.detail_status = 'done'
      and r.sku_id is not null
      and r.listing_state = 'active'
      and (r.listing_type = 'normal' or r.listing_type_override = 'normal')
    order by r.last_seen_at desc nulls last, r.pid desc
    limit v_limit
  ),
  updated as (
    update public.mvp_raw_listings r
    set score_dirty = true
    from target t
    where r.pid = t.pid
      and r.score_dirty is false
    returning r.pid
  )
  select
    (select count(*) from target)::integer as candidate_count,
    (select count(*) from updated)::integer as marked_count;
end;
$$;

grant execute on function public.mark_scorable_score_dirty_by_comparable_keys(text[], integer) to service_role;
