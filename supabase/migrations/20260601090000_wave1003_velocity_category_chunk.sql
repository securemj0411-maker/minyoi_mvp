-- Wave 1003 (2026-06-01): velocity sync RPC category 단위 분할.
--
-- 배경: sync_market_velocity_daily 가 24h 내 4건 다 fail.
--   - 06-01 06:15 failed 120s RPC 57014 statement_timeout
--   - 06-01 00:15 failed 120s RPC 57014 statement_timeout
--   - 05-31 18:15 failed 196s stale 3m (wave 990 deploy 전)
--   - 05-31 12:15 failed 200s stale 3m
--   velocity_daily 마지막 computed_at = 2026-05-31 07:43 UTC = 27h 멈춤.
--   원인: RPC 가 모든 카테고리 (clothing 99k, shoe 83k, smartphone 35k 등 20+ category)
--         한 트랜잭션 안에서 처리 → mvp_raw_listings 더 커지면서 statement_timeout 120s 도달.
--   wave 981 위험 섹션에 정확히 예측: "raw_listings 더 커지면 더 늘려야".
--
-- Fix: 새 RPC sync_market_velocity_daily_for_category(p_category text) 신설.
--   - 한 category 만 처리 → 트랜잭션 작아짐
--   - statement_timeout 60s — 한 category 가 timeout 도달해도 그 category 만 skip, 나머지 살아남음
--   - 기존 sync_market_velocity_daily() 그대로 유지 (manual 호출용 / backwards compat)
--   - Route 가 category list loop 로 호출 (별도 wave commit)

CREATE OR REPLACE FUNCTION public.sync_market_velocity_daily_for_category(p_category text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET statement_timeout TO '60s'
AS $function$
declare
  result jsonb;
begin
  with eligible as (
    select
      r.pid,
      r.listing_state,
      r.listing_type,
      r.first_seen_at,
      r.sold_detected_at,
      p.category,
      p.family,
      p.model,
      p.variant_key,
      p.comparable_key,
      coalesce(nullif(p.condition_class, ''), 'normal') as condition_class,
      extract(epoch from (r.sold_detected_at - r.first_seen_at)) / 3600.0 as hours_to_sold
    from public.mvp_raw_listings r
    join public.mvp_listing_parsed p on p.pid = r.pid
    where p.category = p_category
      and p.comparable_key is not null
      and p.comparable_key <> ''
      and r.listing_type = 'normal'
  ),
  sold_rows as (
    select *
    from eligible
    where listing_state = 'sold_confirmed'
      and sold_detected_at is not null
      and sold_detected_at >= first_seen_at
  ),
  active_rows_by_cc as (
    select comparable_key, condition_class, count(*)::int as active_sample_count
    from eligible
    where listing_state = 'active'
    group by comparable_key, condition_class
  ),
  active_rows_all as (
    select comparable_key, 'all'::text as condition_class, count(*)::int as active_sample_count
    from eligible
    where listing_state = 'active'
    group by comparable_key
  ),
  key_velocity_cc as (
    select
      current_date as date,
      comparable_key,
      condition_class,
      max(category) as category,
      max(family) as family,
      max(model) as model,
      max(variant_key) as variant_key,
      count(*)::int as observed_sold_sample_count,
      count(*) filter (where sold_detected_at >= now() - interval '24 hours')::int as sold_24h_count,
      count(*) filter (where sold_detected_at >= now() - interval '7 days')::int as sold_7d_count,
      percentile_cont(0.25) within group (order by hours_to_sold) as p25_hours_to_sold,
      percentile_cont(0.50) within group (order by hours_to_sold) as median_hours_to_sold,
      percentile_cont(0.75) within group (order by hours_to_sold) as p75_hours_to_sold
    from sold_rows
    group by comparable_key, condition_class
  ),
  key_velocity_all as (
    select
      current_date as date,
      comparable_key,
      'all'::text as condition_class,
      max(category) as category,
      max(family) as family,
      max(model) as model,
      max(variant_key) as variant_key,
      count(*)::int as observed_sold_sample_count,
      count(*) filter (where sold_detected_at >= now() - interval '24 hours')::int as sold_24h_count,
      count(*) filter (where sold_detected_at >= now() - interval '7 days')::int as sold_7d_count,
      percentile_cont(0.25) within group (order by hours_to_sold) as p25_hours_to_sold,
      percentile_cont(0.50) within group (order by hours_to_sold) as median_hours_to_sold,
      percentile_cont(0.75) within group (order by hours_to_sold) as p75_hours_to_sold
    from sold_rows
    group by comparable_key
  ),
  key_velocity as (
    select * from key_velocity_cc
    union all
    select * from key_velocity_all
  ),
  daily_rows as (
    select
      k.*,
      coalesce(
        case when k.condition_class = 'all' then ar_all.active_sample_count else ar_cc.active_sample_count end,
        0
      )::int as active_sample_count,
      case
        when k.observed_sold_sample_count >= 20 then 'high'
        when k.observed_sold_sample_count >= 8 then 'medium'
        else 'low'
      end as confidence,
      'first_seen_to_sold_detected'::text as clock_basis,
      now() as computed_at
    from key_velocity k
    left join active_rows_by_cc ar_cc
      on ar_cc.comparable_key = k.comparable_key
      and ar_cc.condition_class = k.condition_class
    left join active_rows_all ar_all
      on ar_all.comparable_key = k.comparable_key
      and k.condition_class = 'all'
  ),
  upserted as (
    insert into public.mvp_market_velocity_daily (
      date,
      comparable_key,
      condition_class,
      category,
      family,
      model,
      variant_key,
      observed_sold_sample_count,
      active_sample_count,
      sold_24h_count,
      sold_7d_count,
      median_hours_to_sold,
      p25_hours_to_sold,
      p75_hours_to_sold,
      confidence,
      clock_basis,
      computed_at
    )
    select
      date,
      comparable_key,
      condition_class,
      category,
      family,
      model,
      variant_key,
      observed_sold_sample_count,
      active_sample_count,
      sold_24h_count,
      sold_7d_count,
      median_hours_to_sold,
      p25_hours_to_sold,
      p75_hours_to_sold,
      confidence,
      clock_basis,
      computed_at
    from daily_rows
    on conflict (date, comparable_key, condition_class) do update set
      category = excluded.category,
      family = excluded.family,
      model = excluded.model,
      variant_key = excluded.variant_key,
      observed_sold_sample_count = excluded.observed_sold_sample_count,
      active_sample_count = excluded.active_sample_count,
      sold_24h_count = excluded.sold_24h_count,
      sold_7d_count = excluded.sold_7d_count,
      median_hours_to_sold = excluded.median_hours_to_sold,
      p25_hours_to_sold = excluded.p25_hours_to_sold,
      p75_hours_to_sold = excluded.p75_hours_to_sold,
      confidence = excluded.confidence,
      clock_basis = excluded.clock_basis,
      computed_at = excluded.computed_at
    returning *
  )
  select jsonb_build_object(
    'category', p_category,
    'upserted_rows', (select count(*) from upserted),
    'condition_split_rows', (select count(*) from upserted where condition_class <> 'all'),
    'all_aggregate_rows', (select count(*) from upserted where condition_class = 'all'),
    'high', (select count(*) from upserted where confidence = 'high'),
    'medium', (select count(*) from upserted where confidence = 'medium'),
    'low', (select count(*) from upserted where confidence = 'low'),
    'sold_sample_total', (select coalesce(sum(observed_sold_sample_count), 0) from upserted),
    'computed_at', now()
  ) into result;

  return result;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.sync_market_velocity_daily_for_category(text) TO service_role;
