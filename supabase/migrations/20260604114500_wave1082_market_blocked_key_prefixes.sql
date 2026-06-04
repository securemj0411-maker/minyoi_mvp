-- Wave 1082 (2026-06-04): market sample blocked comparable_key prefixes.
-- Pool gate alone is not enough: sold/terminal rows still feed
-- mvp_market_price_daily and mvp_market_velocity_daily through parsed facts.
-- Keep raw/parsed history, but exclude broad/family keys from market stats.

create table if not exists public.mvp_market_blocked_key_prefixes (
  comparable_key_prefix text primary key,
  category text,
  reason text not null,
  created_at timestamptz not null default now()
);

insert into public.mvp_market_blocked_key_prefixes (comparable_key_prefix, category, reason)
values
  ('sport_golf|odyssey_putter', 'sport_golf', 'wave1080_golf_family_lane_mixes_putter_models'),
  ('sport_golf|vokey_sm_wedge', 'sport_golf', 'wave1080_golf_family_lane_mixes_sm_generation_loft_set'),
  ('sport_golf|taylormade_iron_set', 'sport_golf', 'wave1080_golf_family_lane_mixes_sets_single_driving_iron'),
  ('sport_golf|taylormade_driver', 'sport_golf', 'wave1080_golf_family_lane_mixes_driver_generations'),
  ('sport_golf|taylormade_wedge', 'sport_golf', 'wave1080_golf_family_lane_mixes_wedge_models'),
  ('sport_golf|taylormade_hybrid', 'sport_golf', 'wave1080_golf_family_lane_mixes_hybrid_generations'),
  ('sport_golf|callaway_driver', 'sport_golf', 'wave1080_golf_family_lane_mixes_driver_generations_head_only'),
  ('sport_golf|callaway_wedge', 'sport_golf', 'wave1080_golf_family_lane_mixes_wedge_models_lofts'),
  ('sport_golf|callaway_hybrid', 'sport_golf', 'wave1080_golf_family_lane_mixes_hybrid_generations'),
  ('sport_golf|골프_풀세트', 'sport_golf', 'wave1080_golf_full_set_mixes_brand_gender_composition'),
  ('sport_golf|mizuno_mx_골프', 'sport_golf', 'wave1080_golf_legacy_mizuno_mx_family_lane'),
  ('sport_golf|mizuno_jpx_골프_아이언', 'sport_golf', 'wave1080_golf_legacy_mizuno_jpx_family_lane'),
  ('sport_golf|mizuno_iron_set', 'sport_golf', 'wave1080_golf_family_lane_mixes_mizuno_generations'),
  ('sport_golf|srixon_driver', 'sport_golf', 'wave1080_golf_family_lane_mixes_driver_generations_head_only'),
  ('titleist|titleist_iron_set', 'sport_golf', 'wave1080_golf_family_lane_mixes_titleist_iron_generations'),
  ('clothing|polo_pony_tee', 'clothing', 'wave1081_clothing_family_lane_mixes_tee_shirt_polo_shirt'),
  ('clothing|polo_shirt_pattern', 'clothing', 'wave1081_clothing_family_lane_mixes_pattern_shirt_variants'),
  ('clothing|polo_knit_sweater', 'clothing', 'wave1081_clothing_family_lane_mixes_knit_subbrands_stale_rows'),
  ('clothing|adidas_trefoil', 'clothing', 'wave1081_clothing_family_lane_mixes_jacket_pants_archive'),
  ('clothing|patagonia', 'clothing', 'wave1081_clothing_brand_apparel_broad'),
  ('clothing|mlb_cap', 'clothing', 'wave1081_clothing_cap_team_bundle_broad')
on conflict (comparable_key_prefix) do update
set category = excluded.category,
    reason = excluded.reason;

create index if not exists mvp_market_blocked_key_prefixes_category_idx
  on public.mvp_market_blocked_key_prefixes(category);

delete from public.mvp_market_price_daily d
using public.mvp_market_blocked_key_prefixes b
where d.comparable_key like b.comparable_key_prefix || '%';

delete from public.mvp_market_velocity_daily d
using public.mvp_market_blocked_key_prefixes b
where d.comparable_key like b.comparable_key_prefix || '%';

do $$
begin
  if to_regclass('public.mvp_market_price_daily_per_source') is not null then
    delete from public.mvp_market_price_daily_per_source d
    using public.mvp_market_blocked_key_prefixes b
    where d.comparable_key like b.comparable_key_prefix || '%';
  end if;
end $$;

create or replace function public.sync_market_velocity_daily_for_category(p_category text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
set statement_timeout to '60s'
as $function$
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
      and not exists (
        select 1
        from public.mvp_market_blocked_key_prefixes b
        where p.comparable_key like b.comparable_key_prefix || '%'
      )
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

grant execute on function public.sync_market_velocity_daily_for_category(text) to service_role;
