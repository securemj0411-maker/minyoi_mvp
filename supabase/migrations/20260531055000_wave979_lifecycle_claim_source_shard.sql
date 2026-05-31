-- Wave 979 (2026-05-31): claim_mvp_lifecycle_checks 에 source/shard 필터 추가.
--   배경: lifecycle worker 백로그 12만+ 누적, daangn backfill 1k 가 batch 800 capacity 안에서
--         bunjang/joongna 옛 매물에 밀려 처리 안 됨. 단일 worker 로는 capacity 부족.
--   설계: score-worker 패턴 동일 적용 — lifecycle-worker (lane a, daangn shard 0/3 + 다른 source),
--         lifecycle-worker-b (daangn shard 1/3), lifecycle-worker-c (daangn shard 2/3). 시간당
--         9,600 → 28,800 (3배). 백로그 4시간 안 해소 + daangn 자연 sweep.
--   backward compat: param 모두 default 값. 기존 caller (param 미지정) 동일 동작.

CREATE OR REPLACE FUNCTION public.claim_mvp_lifecycle_checks(
  p_batch_size integer DEFAULT 30,
  p_lease_seconds integer DEFAULT 120,
  p_source_filter text DEFAULT NULL,
  p_daangn_shard_count integer DEFAULT 1,
  p_daangn_shard_index integer DEFAULT 0
)
RETURNS TABLE(
  pid bigint,
  source text,
  url text,
  lifecycle_status text,
  priority_tier text,
  consecutive_missing_count integer,
  consecutive_error_count integer,
  attempts integer,
  price integer,
  name text,
  num_faved integer,
  listing_state text,
  sku_id text,
  sku_name text,
  seller_uid text,
  comparable_key text,
  parser_version text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_shard_count integer := greatest(1, least(coalesce(p_daangn_shard_count, 1), 64));
  v_shard_index integer := greatest(0, least(coalesce(p_daangn_shard_index, 0), v_shard_count - 1));
begin
  return query
  with candidates as (
    select c.pid
    from public.mvp_lifecycle_checks c
    where c.status in ('active', 'missing_suspect')
      and c.next_check_at <= now()
      and c.attempts < c.max_attempts
      and (c.locked_until is null or c.locked_until < now())
      and (p_source_filter is null or c.source = p_source_filter)
      and (
        v_shard_count <= 1
        or c.source <> 'daangn'
        or ((c.pid % v_shard_count) = v_shard_index)
      )
    order by
      case c.priority_tier
        when 'pool' then 0
        when 'near_pool' then 1
        when 'exploration' then 2
        when 'market_sample' then 3
        else 4
      end,
      c.next_check_at asc,
      c.updated_at asc
    limit greatest(1, least(coalesce(p_batch_size, 30), 1000))
    for update skip locked
  ), claimed as (
    update public.mvp_lifecycle_checks c
    set locked_at = now(),
        locked_until = now() + (greatest(10, least(coalesce(p_lease_seconds, 120), 900)) || ' seconds')::interval,
        attempts = c.attempts + 1,
        updated_at = now()
    from candidates x
    where c.pid = x.pid
    returning c.pid,
              c.source,
              c.status,
              c.priority_tier,
              c.consecutive_missing_count,
              c.consecutive_error_count,
              c.attempts
  )
  select c.pid,
         c.source,
         r.url,
         c.status as lifecycle_status,
         c.priority_tier,
         c.consecutive_missing_count,
         c.consecutive_error_count,
         c.attempts,
         r.price,
         r.name,
         r.num_faved,
         r.listing_state,
         r.sku_id,
         r.sku_name,
         r.seller_uid,
         p.comparable_key,
         p.parser_version
  from claimed c
  join public.mvp_raw_listings r on r.pid = c.pid
  left join public.mvp_listing_parsed p on p.pid = c.pid;
end;
$function$;
