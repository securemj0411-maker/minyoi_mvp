create table if not exists public.mvp_listings (
  pid bigint primary key,
  url text not null,
  name text not null,
  price integer not null check (price >= 0),
  sku_name text not null,
  sku_median integer not null check (sku_median >= 0),
  description_preview text not null default '',
  image_url_template text,
  image_count integer not null default 0 check (image_count >= 0),
  thumbnail_url text,
  shipping_fee integer not null default 0 check (shipping_fee >= 0),
  shipping_fee_general integer,
  shipping_source text not null default 'not_loaded',
  estimated_buy_cost integer not null default 0 check (estimated_buy_cost >= 0),
  gross_resell_gap integer not null default 0,
  net_gap_after_shipping integer not null default 0,
  source_json jsonb not null default '{}'::jsonb,
  generated_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mvp_listing_analysis (
  pid bigint primary key references public.mvp_listings(pid) on delete cascade,
  price_gap numeric not null default 0,
  num_faved integer not null default 0 check (num_faved >= 0),
  velocity numeric not null default 0,
  review_rating numeric,
  review_count integer not null default 0 check (review_count >= 0),
  safety numeric not null default 0,
  risk_hits integer not null default 0 check (risk_hits >= 0),
  score numeric not null default 0,
  score_flags text[] not null default '{}'::text[],
  candidate_rank integer,
  source_json jsonb not null default '{}'::jsonb,
  analyzed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mvp_user_candidate_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  pid bigint not null references public.mvp_listings(pid) on delete cascade,
  status text check (status in ('interested', 'hold', 'hidden')),
  opened_count integer not null default 0 check (opened_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pid)
);

create table if not exists public.mvp_listing_ai_classifications (
  pid bigint primary key references public.mvp_listings(pid) on delete cascade,
  content_hash text not null,
  listing_type text not null check (listing_type in (
    'normal',
    'counterfeit',
    'parts',
    'buying',
    'callout',
    'damaged',
    'accessory',
    'multi',
    'unknown'
  )),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  reason text not null default '',
  risk_keywords text[] not null default '{}'::text[],
  model text not null,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric,
  classified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.mvp_sellers (
  source text not null default 'bunjang',
  seller_uid text not null,
  review_rating numeric,
  review_count integer not null default 0 check (review_count >= 0),
  sales_count integer not null default 0 check (sales_count >= 0),
  follower_count integer not null default 0 check (follower_count >= 0),
  is_proshop boolean not null default false,
  is_official_seller boolean not null default false,
  joined_at timestamptz,
  listing_count integer not null default 0 check (listing_count >= 0),
  active_listing_count integer not null default 0 check (active_listing_count >= 0),
  comparable_key_listing_count jsonb not null default '{}'::jsonb,
  resurrection_count integer not null default 0 check (resurrection_count >= 0),
  resurrection_rate numeric not null default 0 check (resurrection_rate >= 0),
  relist_count integer not null default 0 check (relist_count >= 0),
  price_change_count integer not null default 0 check (price_change_count >= 0),
  price_change_rate numeric not null default 0 check (price_change_rate >= 0),
  source_json jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source, seller_uid)
);

create table if not exists public.mvp_raw_listings (
  pid bigint primary key,
  url text not null,
  name text not null,
  price integer not null check (price >= 0),
  num_faved integer not null default 0 check (num_faved >= 0),
  num_comment integer,
  qty integer,
  free_shipping boolean not null default false,
  query text not null default '',
  source text not null default 'bunjang',
  description_preview text not null default '',
  description_hash text,
  bunjang_condition_label text,
  sale_status text not null default '',
  shop_review_rating numeric,
  shop_review_count integer not null default 0 check (shop_review_count >= 0),
  seller_uid text,
  seller_source text not null default 'bunjang',
  trade_data jsonb,
  trades_data jsonb,
  listing_type text not null default 'unknown' check (listing_type in (
    'normal','counterfeit','parts','buying','callout','damaged','accessory','multi','commercial','unknown'
  )),
  sku_id text,
  sku_name text,
  detail_status text not null default 'pending' check (detail_status in ('pending','done','failed','skipped')),
  detail_enriched_at timestamptz,
  detail_error text,
  raw_json jsonb not null default '{}'::jsonb,
  image_url_template text,
  image_count integer not null default 0 check (image_count >= 0),
  thumbnail_url text,
  listing_state text not null default 'active' check (listing_state in (
    'active','missing_suspect','sold_confirmed','disappeared','archived'
  )),
  pool_eligible boolean not null default true,
  score_dirty boolean not null default true,
  missing_count integer not null default 0 check (missing_count >= 0),
  last_missing_at timestamptz,
  sold_detected_at timestamptz,
  disappeared_at timestamptz,
  source_uploaded_at timestamptz,
  source_updated_at timestamptz,
  daangn_region_id text,
  daangn_region_name text,
  daangn_boosted_at timestamptz,
  daangn_web_crawl_allowed boolean,
  daangn_shipping_inferred text,
  daangn_manner_temperature numeric,
  daangn_review_count integer,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mvp_raw_listings
  add column if not exists seller_uid text,
  add column if not exists seller_source text not null default 'bunjang',
  add column if not exists num_comment integer,
  add column if not exists qty integer,
  add column if not exists description_hash text,
  add column if not exists bunjang_condition_label text,
  add column if not exists daangn_region_id text,
  add column if not exists daangn_region_name text,
  add column if not exists daangn_boosted_at timestamptz,
  add column if not exists daangn_web_crawl_allowed boolean,
  add column if not exists daangn_shipping_inferred text,
  add column if not exists daangn_manner_temperature numeric,
  add column if not exists daangn_review_count integer,
  add column if not exists pool_eligible boolean not null default true,
  add column if not exists score_dirty boolean not null default true;

create table if not exists public.mvp_listing_parsed (
  pid bigint primary key references public.mvp_raw_listings(pid) on delete cascade,
  parser_version text not null default 'option_parser_v1',
  content_hash text not null default '',
  category text,
  family text,
  model text,
  variant_key text,
  comparable_key text,
  storage_gb integer check (storage_gb is null or storage_gb >= 0),
  ram_gb integer check (ram_gb is null or ram_gb >= 0),
  ssd_gb integer check (ssd_gb is null or ssd_gb >= 0),
  screen_size_in numeric,
  chip text,
  release_year integer,
  battery_health integer check (battery_health is null or (battery_health >= 0 and battery_health <= 100)),
  battery_cycles integer check (battery_cycles is null or battery_cycles >= 0),
  carrier text,
  connectivity text,
  condition_class text not null default 'normal',
  condition_score numeric not null default 0.5 check (condition_score >= 0 and condition_score <= 1),
  condition_notes text[] not null default '{}'::text[],
  parse_confidence numeric not null default 0 check (parse_confidence >= 0 and parse_confidence <= 1),
  needs_review boolean not null default true,
  parsed_json jsonb not null default '{}'::jsonb,
  parsed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mvp_listing_observations (
  id bigserial primary key,
  pid bigint not null references public.mvp_raw_listings(pid) on delete cascade,
  observed_at timestamptz not null default now(),
  run_id uuid,
  event_type text not null check (event_type in (
    'first_seen','search_seen','price_changed','faved_changed','title_changed',
    'detail_enriched','state_changed','daily_snapshot'
  )),
  listing_state text not null default 'active',
  price integer not null check (price >= 0),
  num_faved integer not null default 0 check (num_faved >= 0),
  name text not null,
  sale_status text not null default '',
  sku_id text,
  sku_name text,
  comparable_key text,
  parse_confidence numeric,
  seller_uid text,
  source text not null default 'bunjang'
  -- P2-2: raw_json column removed; payload moved to mvp_listing_observation_payloads (90d retention).
);

alter table public.mvp_listing_observations
  add column if not exists seller_uid text;

alter table public.mvp_listing_observations
  drop column if exists raw_json;

-- P2-2: raw_json split off into a separate 90d-retention table.
-- The fact table above (mvp_listing_observations) is permanent and powers velocity / price graphs.
-- This payload table keeps the heavy jsonb blob, purged by housekeeperStage on a daily cooldown.
-- observation_id is a soft pointer (no FK) so the retention DELETE is cheap and self-contained.
create table if not exists public.mvp_listing_observation_payloads (
  id             bigserial primary key,
  observation_id bigint      not null,
  pid            bigint      not null,
  observed_at    timestamptz not null,
  raw_json       jsonb       not null default '{}'::jsonb,
  inserted_at    timestamptz not null default now()
);

create index if not exists mvp_listing_observation_payloads_obs_idx
  on public.mvp_listing_observation_payloads(observation_id);

create index if not exists mvp_listing_observation_payloads_observed_at_idx
  on public.mvp_listing_observation_payloads(observed_at);

create index if not exists mvp_listing_observation_payloads_pid_seen_idx
  on public.mvp_listing_observation_payloads(pid, observed_at desc);

alter table public.mvp_listing_observation_payloads enable row level security;

-- Wave 130 (2026-05-15): condition_class별 분리 시세 (mint/clean/normal/worn/low_batt/unopened).
-- PK = (date, comparable_key, condition_class) — 같은 SKU·날짜에 condition별 row 따로 박힘.
-- legacy 'all' row는 5/16 incident에서 삭제됨 (해당 사건 로그 참고).
create table if not exists public.mvp_market_price_daily (
  date date not null,
  comparable_key text not null,
  condition_class text not null default 'all',
  category text,
  family text,
  model text,
  variant_key text,
  active_median_price integer,
  sold_median_price integer,
  blended_median_price integer,
  p25_price integer,
  p75_price integer,
  active_sample_count integer not null default 0,
  sold_sample_count integer not null default 0,
  disappeared_sample_count integer not null default 0,
  confidence text not null default 'low' check (confidence in ('high','medium','low')),
  computed_at timestamptz not null default now(),
  primary key (date, comparable_key, condition_class)
);

-- Wave 130 후속: velocity_daily도 condition_class 분리 PK로 migration됨.
-- 단 sync 로직은 현재 condition_class='all' 고정 박음 (P1: condition 분리 분석은 후속).
create table if not exists public.mvp_market_velocity_daily (
  date date not null,
  comparable_key text not null,
  condition_class text not null default 'all',
  category text,
  family text,
  model text,
  variant_key text,
  observed_sold_sample_count integer not null default 0,
  active_sample_count integer not null default 0,
  sold_24h_count integer not null default 0,
  sold_7d_count integer not null default 0,
  median_hours_to_sold numeric,
  p25_hours_to_sold numeric,
  p75_hours_to_sold numeric,
  confidence text not null default 'low' check (confidence in ('high','medium','low')),
  clock_basis text not null default 'first_seen_to_sold_detected'
    check (clock_basis in ('first_seen_to_sold_detected')),
  computed_at timestamptz not null default now(),
  primary key (date, comparable_key, condition_class)
);

create table if not exists public.mvp_source_health (
  id bigserial primary key,
  source text not null default 'bunjang',
  checked_at timestamptz not null default now(),
  window_minutes integer not null default 5 check (window_minutes > 0),
  status text not null default 'healthy' check (status in ('healthy','degraded','unhealthy')),
  previous_status text check (previous_status in ('healthy','degraded','unhealthy')),
  detail_success_rate numeric not null default 1 check (detail_success_rate >= 0 and detail_success_rate <= 1),
  detail_404_rate numeric not null default 0 check (detail_404_rate >= 0 and detail_404_rate <= 1),
  detail_5xx_rate numeric not null default 0 check (detail_5xx_rate >= 0 and detail_5xx_rate <= 1),
  sold_transition_rate numeric not null default 0 check (sold_transition_rate >= 0),
  disappeared_transition_rate numeric not null default 0 check (disappeared_transition_rate >= 0),
  search_result_count integer not null default 0 check (search_result_count >= 0),
  baseline_json jsonb not null default '{}'::jsonb,
  hysteresis_json jsonb not null default '{}'::jsonb,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.mvp_category_readiness (
  category text primary key,
  status text not null default 'blocked' check (status in ('ready', 'internal_only', 'blocked')),
  label text not null,
  note text not null default '',
  min_ready_pool integer not null default 6 check (min_ready_pool >= 0),
  min_parse_rate numeric not null default 0 check (min_parse_rate >= 0 and min_parse_rate <= 1),
  min_trusted_keys integer not null default 0 check (min_trusted_keys >= 0),
  last_measured_at timestamptz,
  measured_json jsonb not null default '{}'::jsonb,
  operator_note text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.mvp_category_readiness (
  category,
  status,
  label,
  note,
  min_ready_pool,
  min_parse_rate,
  min_trusted_keys
) values
  (
    'earphone',
    'ready',
    'Audio',
    'AirPods 계열은 SKU/노이즈/커넥터 파서가 후보팩 최소 기준을 통과했습니다.',
    6,
    0.85,
    5
  ),
  (
    'smartwatch',
    'ready',
    'Watch',
    'Apple Watch/Galaxy Watch는 사이즈·셀룰러·모델 파서가 후보팩 최소 기준을 통과했습니다.',
    6,
    0.80,
    5
  ),
  (
    'smartphone',
    'internal_only',
    'Mobile Phone',
    '용량·배터리효율·자급제/통신사·파손 상태 검증이 더 필요해 시세 학습만 허용합니다.',
    8,
    0.90,
    10
  ),
  (
    'tablet',
    'internal_only',
    'Tablet',
    '세대·용량·Wi-Fi/Cellular·펜/키보드 포함 여부 검증 전까지 시세 학습만 허용합니다.',
    8,
    0.88,
    8
  ),
  (
    'laptop',
    'internal_only',
    'PC/Laptop',
    '칩·연식·RAM·SSD·화면 크기·배터리 사이클 파서 검증 전까지 시세 학습만 허용합니다.',
    8,
    0.85,
    8
  ),
  (
    'small_appliance',
    'blocked',
    'Small Appliance',
    '카테고리별 SKU/옵션/노이즈 모델이 아직 없어 후보팩과 시세 학습 모두 보류합니다.',
    10,
    0.90,
    10
  )
on conflict (category) do update set
  label = excluded.label,
  note = case
    when public.mvp_category_readiness.note = '' then excluded.note
    else public.mvp_category_readiness.note
  end,
  min_ready_pool = greatest(public.mvp_category_readiness.min_ready_pool, excluded.min_ready_pool),
  min_parse_rate = greatest(public.mvp_category_readiness.min_parse_rate, excluded.min_parse_rate),
  min_trusted_keys = greatest(public.mvp_category_readiness.min_trusted_keys, excluded.min_trusted_keys),
  updated_at = now();

alter table public.mvp_category_readiness enable row level security;

create or replace function public.mvp_category_from_comparable_key(p_value text)
returns text
language sql
immutable
as $$
  select case split_part(coalesce(p_value, ''), '|', 1)
    when 'earphone' then 'earphone'
    when 'smartwatch' then 'smartwatch'
    when 'smartphone' then 'smartphone'
    when 'tablet' then 'tablet'
    when 'laptop' then 'laptop'
    when 'small_appliance' then 'small_appliance'
    when 'airpods' then 'earphone'
    when 'applewatch' then 'smartwatch'
    when 'galaxywatch' then 'smartwatch'
    when 'iphone' then 'smartphone'
    when 'galaxy_s' then 'smartphone'
    when 'ipad' then 'tablet'
    when 'galaxy_tab' then 'tablet'
    when 'macbook' then 'laptop'
    else null
  end;
$$;

create table if not exists public.mvp_lifecycle_checks (
  pid bigint primary key references public.mvp_raw_listings(pid) on delete cascade,
  source text not null default 'bunjang',
  status text not null default 'active' check (status in (
    'active','missing_suspect','sold_confirmed','disappeared','archived'
  )),
  priority_tier text not null default 'general' check (priority_tier in (
    'pool','near_pool','market_sample','general','exploration'
  )),
  next_check_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_check_result text check (last_check_result in (
    'active','sold','missing','error','skipped_source_degraded','skipped_budget'
  )),
  consecutive_missing_count integer not null default 0 check (consecutive_missing_count >= 0),
  consecutive_error_count integer not null default 0 check (consecutive_error_count >= 0),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 10 check (max_attempts >= 1),
  locked_at timestamptz,
  locked_until timestamptz,
  last_error text,
  detail_status_code integer,
  transition_confidence numeric not null default 0 check (transition_confidence >= 0 and transition_confidence <= 1),
  state_reason text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.mvp_lifecycle_checks
  add column if not exists attempts integer not null default 0 check (attempts >= 0),
  add column if not exists max_attempts integer not null default 10 check (max_attempts >= 1),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_until timestamptz;

create table if not exists public.mvp_market_key_invalidation (
  comparable_key text primary key,
  source text not null default 'bunjang',
  reason text not null default 'unknown',
  priority integer not null default 0,
  affected_pid bigint,
  old_comparable_key text,
  new_comparable_key text,
  parser_version text,
  event_count integer not null default 1 check (event_count >= 1),
  first_event_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  claimed_at timestamptz,
  locked_until timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_recomputed_at timestamptz,
  last_error text,
  status text not null default 'pending' check (status in ('pending','processing','done','failed'))
);

create table if not exists public.mvp_detail_queue (
  id uuid primary key default gen_random_uuid(),
  pid bigint not null references public.mvp_raw_listings(pid) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  priority integer not null default 0,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pid)
);

create table if not exists public.mvp_joongna_detail_queue (
  id uuid primary key default gen_random_uuid(),
  product_url text not null,
  external_id text,
  source_query text,
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  priority integer not null default 0,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_until timestamptz,
  last_error text,
  last_fetched_at timestamptz,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_url)
);

create table if not exists public.mvp_collect_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  trigger_source text not null default 'cron',
  request_method text,
  request_path text,
  request_host text,
  request_ip text,
  request_user_agent text,
  request_referer text,
  request_origin text,
  request_vercel_id text,
  request_country text,
  wait_mode boolean not null default false,
  auth_ok boolean not null default true,
  auth_reason text,
  response_mode text,
  request_meta jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  collected_count integer not null default 0,
  title_normal_count integer not null default 0,
  enriched_count integer not null default 0,
  scored_count integer not null default 0,
  ai_review_requested integer not null default 0,
  ai_cache_hits integer not null default 0,
  ai_api_calls integer not null default 0,
  ai_unavailable_count integer not null default 0,
  ai_filtered_count integer not null default 0,
  ai_kept_normal_count integer not null default 0,
  ai_kept_low_confidence_count integer not null default 0,
  upserted_count integer not null default 0,
  stage_stats jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists mvp_listing_analysis_rank_idx
  on public.mvp_listing_analysis(candidate_rank nulls last);

create index if not exists mvp_listing_analysis_score_idx
  on public.mvp_listing_analysis(score desc);

create index if not exists mvp_user_candidate_actions_pid_idx
  on public.mvp_user_candidate_actions(pid);

create index if not exists mvp_listing_ai_classifications_content_hash_idx
  on public.mvp_listing_ai_classifications(content_hash);

create index if not exists mvp_listing_ai_classifications_type_idx
  on public.mvp_listing_ai_classifications(listing_type, confidence);

create index if not exists mvp_sellers_seen_idx
  on public.mvp_sellers(source, last_seen_at desc);

create index if not exists mvp_sellers_resurrection_idx
  on public.mvp_sellers(resurrection_rate desc, last_seen_at desc);

create index if not exists mvp_raw_listings_seen_idx
  on public.mvp_raw_listings(last_seen_at desc);

create index if not exists mvp_raw_listings_detail_status_idx
  on public.mvp_raw_listings(detail_status, detail_enriched_at desc);

create index if not exists mvp_raw_listings_listing_type_idx
  on public.mvp_raw_listings(listing_type, sku_id);

create index if not exists mvp_raw_listings_state_idx
  on public.mvp_raw_listings(listing_state, last_seen_at desc);

create index if not exists mvp_raw_listings_seller_idx
  on public.mvp_raw_listings(seller_source, seller_uid, last_seen_at desc);

create index if not exists mvp_raw_listings_score_ready_idx
  on public.mvp_raw_listings(detail_status, listing_type, listing_state, last_seen_at desc)
  where sku_id is not null;

create index if not exists mvp_raw_listings_market_stats_idx
  on public.mvp_raw_listings(detail_status, listing_type, detail_enriched_at desc, last_seen_at desc)
  where sku_id is not null;

create index if not exists mvp_raw_listings_score_dirty_idx
  on public.mvp_raw_listings(last_seen_at desc)
  where score_dirty = true;

create index if not exists mvp_raw_listings_dirty_scorable_recent_idx
  on public.mvp_raw_listings(last_seen_at desc)
  where score_dirty = true
    and detail_status = 'done'
    and sku_id is not null
    and listing_state = 'active';

create index if not exists mvp_raw_listings_dirty_scorable_source_recent_idx
  on public.mvp_raw_listings(source, last_seen_at desc)
  where score_dirty = true
    and detail_status = 'done'
    and sku_id is not null
    and listing_state = 'active';

create index if not exists mvp_raw_listings_dirty_scorable_sku_recent_idx
  on public.mvp_raw_listings(sku_id text_pattern_ops, last_seen_at desc)
  where score_dirty = true
    and detail_status = 'done'
    and sku_id is not null
    and listing_state = 'active';

create index if not exists mvp_raw_listings_dirty_scorable_shoe_range_recent_idx
  on public.mvp_raw_listings(last_seen_at desc)
  include (pid, source)
  where score_dirty = true
    and detail_status = 'done'
    and sku_id is not null
    and listing_state = 'active'
    and sku_id >= 'shoe-'
    and sku_id < 'shoe.'
    and (
      listing_type = 'normal' or
      listing_type_override = 'normal'
    );

create index if not exists mvp_raw_listings_dirty_scorable_clothing_range_recent_idx
  on public.mvp_raw_listings(last_seen_at desc)
  include (pid, source)
  where score_dirty = true
    and detail_status = 'done'
    and sku_id is not null
    and listing_state = 'active'
    and sku_id >= 'clothing-'
    and sku_id < 'clothing.'
    and (
      listing_type = 'normal' or
      listing_type_override = 'normal'
    );

create index if not exists mvp_raw_listings_active_fashion_first_seen_idx
  on public.mvp_raw_listings(first_seen_at desc)
  where listing_state = 'active'
    and sku_id is not null
    and (
      sku_id like 'shoe-%' or
      sku_id like 'clothing-%' or
      sku_id like 'bag-%'
    );

create index if not exists mvp_raw_listings_active_description_seller_idx
  on public.mvp_raw_listings(description_hash, seller_uid)
  where description_hash is not null
    and seller_uid is not null
    and listing_state = 'active';

create table if not exists public.mvp_cron_locks (
  mode text primary key,
  owner text not null,
  acquired_at timestamptz not null default now(),
  lease_until timestamptz not null
);

create index if not exists mvp_cron_locks_lease_until_idx
  on public.mvp_cron_locks(lease_until);

-- P2-1: query registry + yield-based cadence
create table if not exists public.mvp_search_queries (
  query text primary key,
  category text not null default 'unknown',
  enabled boolean not null default true,
  cadence_minutes integer not null default 5 check (cadence_minutes in (5, 10, 30, 60)),
  mode text not null default 'gather' check (mode in ('harvest', 'gather')),
  reason text not null default 'seed',
  last_evaluated_at timestamptz,
  last_observed integer not null default 0,
  last_changed integer not null default 0,
  last_pool_any integer not null default 0,
  last_pool_ready integer not null default 0,
  last_scanned_at timestamptz,
  cadence_override integer check (cadence_override is null or cadence_override in (5, 10, 30, 60)),
  cadence_override_expires_at timestamptz,
  cadence_override_note text,
  priority smallint not null default 50,
  pack_contribution_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mvp_search_queries_due_idx
  on public.mvp_search_queries(last_scanned_at nulls first)
  where enabled = true;

create index if not exists mvp_search_queries_category_idx
  on public.mvp_search_queries(category, mode);

create table if not exists public.mvp_search_query_cadence_log (
  id bigserial primary key,
  query text not null,
  changed_at timestamptz not null default now(),
  before_cadence_minutes integer,
  after_cadence_minutes integer not null,
  before_mode text,
  after_mode text not null,
  reason text not null,
  measurement jsonb not null default '{}'::jsonb,
  source text not null default 'evaluator'
);

create index if not exists mvp_search_query_cadence_log_query_idx
  on public.mvp_search_query_cadence_log(query, changed_at desc);

create index if not exists mvp_search_query_cadence_log_changed_at_idx
  on public.mvp_search_query_cadence_log(changed_at desc);

create or replace view public.mvp_search_queries_due as
  select
    q.query,
    q.category,
    q.mode,
    q.reason,
    coalesce(q.cadence_override, q.cadence_minutes) as effective_cadence_minutes,
    q.last_scanned_at,
    q.priority,
    q.enabled
  from public.mvp_search_queries q
  where q.enabled = true
    and (
      q.last_scanned_at is null
      or q.last_scanned_at + make_interval(mins => coalesce(q.cadence_override, q.cadence_minutes)) <= now()
    );

create or replace function public.expire_search_query_cadence_overrides()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.mvp_search_queries
  set cadence_override = null,
      cadence_override_expires_at = null,
      cadence_override_note = null,
      updated_at = now()
  where cadence_override is not null
    and cadence_override_expires_at is not null
    and cadence_override_expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_search_query_cadence_overrides() from public;
revoke execute on function public.expire_search_query_cadence_overrides() from anon;
revoke execute on function public.expire_search_query_cadence_overrides() from authenticated;
grant execute on function public.expire_search_query_cadence_overrides() to service_role;

-- P2-2: observation payload 90일 retention. housekeeperStage가 daily cooldown으로 호출.
-- p_batch_limit으로 한 번에 지울 양 제한 → 락 짧게 유지. 잔여분은 다음 sweep에서 정리.
create or replace function public.prune_listing_observation_payloads(
  p_days integer default 90,
  p_batch_limit integer default 50000
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - make_interval(days => p_days);
  v_deleted bigint;
begin
  delete from public.mvp_listing_observation_payloads
  where id in (
    select id
    from public.mvp_listing_observation_payloads
    where observed_at < v_cutoff
    order by observed_at
    limit p_batch_limit
  );
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.prune_listing_observation_payloads(integer, integer) from public;
grant execute on function public.prune_listing_observation_payloads(integer, integer) to service_role;

create index if not exists mvp_listing_parsed_comparable_idx
  on public.mvp_listing_parsed(comparable_key, parse_confidence desc);

create index if not exists mvp_listing_parsed_needs_review_idx
  on public.mvp_listing_parsed(needs_review, parsed_at desc);

create index if not exists mvp_listing_observations_pid_seen_idx
  on public.mvp_listing_observations(pid, observed_at desc);

create index if not exists mvp_listing_observations_comparable_seen_idx
  on public.mvp_listing_observations(comparable_key, observed_at desc);

create index if not exists mvp_listing_observations_event_idx
  on public.mvp_listing_observations(event_type, observed_at desc);

create index if not exists mvp_listing_observations_seller_idx
  on public.mvp_listing_observations(source, seller_uid, observed_at desc);

create index if not exists mvp_market_price_daily_comparable_date_idx
  on public.mvp_market_price_daily(comparable_key, date desc);

create index if not exists mvp_market_velocity_daily_comparable_date_idx
  on public.mvp_market_velocity_daily(comparable_key, date desc);

create index if not exists mvp_source_health_source_checked_idx
  on public.mvp_source_health(source, checked_at desc);

create index if not exists mvp_lifecycle_checks_due_idx
  on public.mvp_lifecycle_checks(status, next_check_at, priority_tier);

create index if not exists mvp_lifecycle_checks_tier_idx
  on public.mvp_lifecycle_checks(priority_tier, next_check_at);

create index if not exists mvp_lifecycle_checks_locked_until_idx
  on public.mvp_lifecycle_checks(locked_until);

create index if not exists mvp_lifecycle_checks_claim_ready_idx
  on public.mvp_lifecycle_checks(next_check_at, priority_tier, updated_at)
  where status in ('active', 'missing_suspect');

create index if not exists mvp_market_key_invalidation_claim_idx
  on public.mvp_market_key_invalidation(status, priority desc, last_event_at asc);

create index if not exists mvp_market_key_invalidation_pending_oldest_idx
  on public.mvp_market_key_invalidation(last_event_at asc)
  where status = 'pending';

create index if not exists mvp_market_key_invalidation_locked_idx
  on public.mvp_market_key_invalidation(locked_until);

create index if not exists mvp_detail_queue_claim_idx
  on public.mvp_detail_queue(status, available_at, priority desc, created_at);

create index if not exists mvp_detail_queue_locked_until_idx
  on public.mvp_detail_queue(locked_until);

create index if not exists mvp_joongna_detail_queue_claim_idx
  on public.mvp_joongna_detail_queue(status, priority desc, available_at asc, created_at asc);

create index if not exists mvp_joongna_detail_queue_locked_until_idx
  on public.mvp_joongna_detail_queue(locked_until);

create index if not exists mvp_joongna_detail_queue_external_id_idx
  on public.mvp_joongna_detail_queue(external_id)
  where external_id is not null;

create index if not exists mvp_collect_runs_started_at_idx
  on public.mvp_collect_runs(started_at desc);

create index if not exists mvp_collect_runs_status_idx
  on public.mvp_collect_runs(status);

create index if not exists mvp_collect_runs_status_started_idx
  on public.mvp_collect_runs(status, started_at desc);

create index if not exists mvp_collect_runs_request_ip_idx
  on public.mvp_collect_runs(request_ip);

create index if not exists mvp_collect_runs_response_mode_idx
  on public.mvp_collect_runs(response_mode);

alter table public.mvp_listings enable row level security;
alter table public.mvp_listing_analysis enable row level security;
alter table public.mvp_user_candidate_actions enable row level security;
alter table public.mvp_listing_ai_classifications enable row level security;
alter table public.mvp_sellers enable row level security;
alter table public.mvp_raw_listings enable row level security;
alter table public.mvp_listing_parsed enable row level security;
alter table public.mvp_listing_observations enable row level security;
alter table public.mvp_market_price_daily enable row level security;
alter table public.mvp_market_velocity_daily enable row level security;
alter table public.mvp_source_health enable row level security;
alter table public.mvp_lifecycle_checks enable row level security;
alter table public.mvp_market_key_invalidation enable row level security;
alter table public.mvp_detail_queue enable row level security;
alter table public.mvp_joongna_detail_queue enable row level security;
revoke all on public.mvp_joongna_detail_queue from anon;
revoke all on public.mvp_joongna_detail_queue from authenticated;
grant select, insert, update, delete on public.mvp_joongna_detail_queue to service_role;
alter table public.mvp_collect_runs enable row level security;
alter table public.mvp_landing_showcases enable row level security;
alter table public.mvp_preview_showcases enable row level security;
revoke all on public.mvp_preview_showcases from anon;
revoke all on public.mvp_preview_showcases from authenticated;
grant select, insert, update, delete on public.mvp_preview_showcases to service_role;
grant usage, select on sequence public.mvp_preview_showcases_id_seq to service_role;
alter table public.mvp_membership_applications enable row level security;
revoke all on public.mvp_membership_applications from anon;
revoke all on public.mvp_membership_applications from authenticated;
grant select, insert, update, delete on public.mvp_membership_applications to service_role;
grant usage, select on sequence public.mvp_membership_applications_id_seq to service_role;

create or replace function public.claim_mvp_detail_queue(
  p_batch_size integer default 30,
  p_lease_seconds integer default 60
)
returns table (
  queue_id uuid,
  pid bigint,
  name text,
  price integer,
  num_faved integer,
  free_shipping boolean,
  url text,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select q.id
    from public.mvp_detail_queue q
    where (
      q.status = 'pending'
      or (q.status = 'processing' and q.locked_until < now())
      or (q.status = 'failed' and q.attempts < q.max_attempts and q.available_at <= now())
    )
    order by q.available_at asc, q.created_at asc, q.priority desc
    limit greatest(1, least(coalesce(p_batch_size, 30), 200))
    for update skip locked
  ), claimed as (
    update public.mvp_detail_queue q
    set status = 'processing',
        attempts = q.attempts + 1,
        locked_at = now(),
        locked_until = now() + (greatest(10, least(coalesce(p_lease_seconds, 60), 900)) || ' seconds')::interval,
        updated_at = now(),
        last_error = null
    from candidates c
    where q.id = c.id
    returning q.id, q.pid, q.attempts
  )
  select c.id as queue_id,
         r.pid,
         r.name,
         r.price,
         r.num_faved,
         r.free_shipping,
         r.url,
         c.attempts
  from claimed c
  join public.mvp_raw_listings r on r.pid = c.pid;
end;
$$;

revoke all on function public.claim_mvp_detail_queue(integer, integer) from public;
revoke execute on function public.claim_mvp_detail_queue(integer, integer) from anon;
revoke execute on function public.claim_mvp_detail_queue(integer, integer) from authenticated;
grant execute on function public.claim_mvp_detail_queue(integer, integer) to service_role;

create or replace function public.claim_mvp_joongna_detail_queue(
  p_batch_size integer default 30,
  p_lease_seconds integer default 90
)
returns table (
  queue_id uuid,
  product_url text,
  external_id text,
  source_query text,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select q.id
    from public.mvp_joongna_detail_queue q
    where (
      q.status = 'pending'
      or (q.status = 'processing' and q.locked_until < now())
      or (q.status = 'failed' and q.attempts < q.max_attempts and q.available_at <= now())
    )
    order by q.priority desc, q.available_at asc, q.created_at asc
    limit greatest(1, least(coalesce(p_batch_size, 30), 200))
    for update skip locked
  ), claimed as (
    update public.mvp_joongna_detail_queue q
    set status = 'processing',
        attempts = q.attempts + 1,
        locked_at = now(),
        locked_until = now() + (greatest(10, least(coalesce(p_lease_seconds, 90), 900)) || ' seconds')::interval,
        updated_at = now(),
        last_error = null
    from candidates c
    where q.id = c.id
    returning q.id, q.product_url, q.external_id, q.source_query, q.attempts
  )
  select c.id as queue_id,
         c.product_url,
         c.external_id,
         c.source_query,
         c.attempts
  from claimed c;
end;
$$;

revoke all on function public.claim_mvp_joongna_detail_queue(integer, integer) from public;
revoke execute on function public.claim_mvp_joongna_detail_queue(integer, integer) from anon;
revoke execute on function public.claim_mvp_joongna_detail_queue(integer, integer) from authenticated;
grant execute on function public.claim_mvp_joongna_detail_queue(integer, integer) to service_role;

drop function if exists public.claim_mvp_lifecycle_checks(integer, integer);

create or replace function public.claim_mvp_lifecycle_checks(
  p_batch_size integer default 30,
  p_lease_seconds integer default 120
)
returns table (
  pid bigint,
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
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select c.pid
    from public.mvp_lifecycle_checks c
    where c.status in ('active', 'missing_suspect')
      and c.next_check_at <= now()
      and c.attempts < c.max_attempts
      and (c.locked_until is null or c.locked_until < now())
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
    limit greatest(1, least(coalesce(p_batch_size, 30), 200))
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
              c.status,
              c.priority_tier,
              c.consecutive_missing_count,
              c.consecutive_error_count,
              c.attempts
  )
  select c.pid,
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
$$;

revoke all on function public.claim_mvp_lifecycle_checks(integer, integer) from public;
revoke execute on function public.claim_mvp_lifecycle_checks(integer, integer) from anon;
revoke execute on function public.claim_mvp_lifecycle_checks(integer, integer) from authenticated;
grant execute on function public.claim_mvp_lifecycle_checks(integer, integer) to service_role;

drop function if exists public.claim_mvp_terminal_lifecycle_rechecks(integer, integer);

create or replace function public.claim_mvp_terminal_lifecycle_rechecks(
  p_batch_size integer default 10,
  p_lease_seconds integer default 120
)
returns table (
  pid bigint,
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
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select c.pid
    from public.mvp_lifecycle_checks c
    join public.mvp_raw_listings r on r.pid = c.pid
    left join public.mvp_listing_parsed p on p.pid = c.pid
    left join public.mvp_category_readiness cr on cr.category = p.category
    left join public.mvp_candidate_pool cp
      on cp.pid = c.pid
     and cp.status in ('ready', 'reserved')
    where c.status in ('active', 'missing_suspect')
      and r.listing_state in ('sold_confirmed', 'disappeared', 'archived')
      and c.next_check_at <= now()
      and c.attempts < c.max_attempts
      and (c.locked_until is null or c.locked_until < now())
    order by
      case when cp.pid is not null then 0 else 1 end,
      case c.priority_tier
        when 'pool' then 0
        when 'near_pool' then 1
        when 'exploration' then 2
        when 'market_sample' then 3
        else 4
      end,
      case coalesce(cr.status, '')
        when 'ready' then 0
        else 1
      end,
      case coalesce(p.category, '')
        when 'smartwatch' then 0
        when 'earphone' then 1
        else 2
      end,
      c.next_check_at asc,
      c.updated_at asc
    limit greatest(1, least(coalesce(p_batch_size, 10), 50))
    for update of c skip locked
  ), claimed as (
    update public.mvp_lifecycle_checks c
    set locked_at = now(),
        locked_until = now() + (greatest(10, least(coalesce(p_lease_seconds, 120), 900)) || ' seconds')::interval,
        attempts = c.attempts + 1,
        updated_at = now()
    from candidates x
    where c.pid = x.pid
    returning c.pid,
              c.status,
              c.priority_tier,
              c.consecutive_missing_count,
              c.consecutive_error_count,
              c.attempts
  )
  select c.pid,
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
$$;

revoke all on function public.claim_mvp_terminal_lifecycle_rechecks(integer, integer) from public;
revoke execute on function public.claim_mvp_terminal_lifecycle_rechecks(integer, integer) from anon;
revoke execute on function public.claim_mvp_terminal_lifecycle_rechecks(integer, integer) from authenticated;
grant execute on function public.claim_mvp_terminal_lifecycle_rechecks(integer, integer) to service_role;

create table if not exists public.mvp_candidate_pool (
  pid bigint primary key references public.mvp_raw_listings(pid) on delete cascade,
  profit_band smallint not null check (profit_band in (1, 2, 3)),
  category text,
  expected_profit_min integer not null,
  expected_profit_max integer not null,
  score numeric not null default 0,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  comparable_key text,
  status text not null default 'ready' check (status in ('ready', 'reserved', 'spent', 'invalidated')),
  exposure_count integer not null default 0 check (exposure_count >= 0),
  max_exposure integer not null default 2 check (max_exposure >= 1),
  reserved_until timestamptz,
  last_verified_at timestamptz not null default now(),
  invalidated_reason text,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mvp_candidate_pool
  add column if not exists category text;

update public.mvp_candidate_pool
set category = public.mvp_category_from_comparable_key(comparable_key)
where public.mvp_category_from_comparable_key(comparable_key) is not null
  and (
    category is null or
    category not in ('earphone','smartwatch','smartphone','tablet','laptop','small_appliance')
  );

create table if not exists public.mvp_pack_opens (
  id bigserial primary key,
  user_ref text not null,
  band_requested smallint not null check (band_requested in (1, 2, 3)),
  tokens_spent integer not null check (tokens_spent >= 0),
  tokens_refunded integer not null default 0 check (tokens_refunded >= 0),
  result text not null check (result in ('success', 'refunded', 'failed')),
  attempted_pids bigint[] not null default '{}'::bigint[],
  revealed_pids bigint[] not null default '{}'::bigint[],
  duration_ms integer,
  opened_at timestamptz not null default now()
);

create table if not exists public.mvp_pack_reveals (
  id bigserial primary key,
  pack_open_id bigint not null references public.mvp_pack_opens(id) on delete cascade,
  pid bigint not null references public.mvp_raw_listings(pid) on delete cascade,
  user_ref text not null,
  expected_profit_min integer not null,
  expected_profit_max integer not null,
  confidence numeric not null,
  link_clicked_at timestamptz,
  revealed_at timestamptz not null default now(),
  hidden_at timestamptz,
  hidden_reason text,
  hidden_source text,
  unique (user_ref, pid)
);

create table if not exists public.mvp_user_credits (
  user_ref text primary key,
  auth_user_id uuid not null unique,
  balance integer not null default 0 check (balance >= 0),
  free_grant_tokens integer not null default 5 check (free_grant_tokens >= 0),
  free_granted_at timestamptz,
  -- Wave 338 (Phase 1a freemium): 무료 사용자가 /explore에서 새 30개 매물 받은 마지막 시각.
  -- /api/packs/pool에서 30min cooldown 체크.
  last_free_browse_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mvp_credit_ledger (
  id bigserial primary key,
  user_ref text not null,
  auth_user_id uuid not null,
  event_type text not null check (event_type in ('free_grant', 'pack_spend', 'pack_refund')),
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mvp_landing_showcases (
  id bigserial primary key,
  slot_index smallint not null check (slot_index between 1 and 10),
  pid bigint not null references public.mvp_raw_listings(pid) on delete cascade,
  name text not null,
  image_url text not null,
  buy_price integer not null check (buy_price >= 0),
  market_price integer not null check (market_price >= 0),
  expected_profit integer not null,
  confidence_percent integer not null check (confidence_percent between 0 and 100),
  sku_label text,
  sample_count integer not null default 0 check (sample_count >= 0),
  is_active boolean not null default true,
  source_snapshot jsonb not null default '{}'::jsonb,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (slot_index),
  unique (pid)
);

create table if not exists public.mvp_preview_showcases (
  id bigserial primary key,
  slot_index smallint not null check (slot_index between 1 and 10),
  payload jsonb not null,
  is_active boolean not null default true,
  source_snapshot jsonb not null default '{}'::jsonb,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (slot_index)
);

create index if not exists mvp_preview_showcases_active_slot_idx
  on public.mvp_preview_showcases (is_active, slot_index, updated_at desc);

create table if not exists public.mvp_membership_applications (
  id bigserial primary key,
  user_ref text not null,
  auth_user_id uuid not null,
  email text,
  display_name text,
  product_key text not null default 'limited_300_3mo',
  price_krw integer not null default 99000,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  applicant_note text,
  admin_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mvp_membership_applications_pending_user_idx
  on public.mvp_membership_applications (auth_user_id)
  where status = 'pending';

create index if not exists mvp_membership_applications_status_created_idx
  on public.mvp_membership_applications (status, created_at desc);

create table if not exists public.mvp_reveal_feedback (
  id bigserial primary key,
  user_ref text not null,
  pid bigint not null references public.mvp_raw_listings(pid) on delete cascade,
  pack_open_id bigint references public.mvp_pack_opens(id) on delete set null,
  feedback_type text not null check (feedback_type in (
    'interested',
    'bought',
    'missed_sold',
    'bad_pick',
    'watching',
    'contacted',
    'passed',
    'inspected',
    'listed',
    'resold',
    'loss_report',
    'inaccurate_report'
  )),
  note text not null default '',
  source text not null default 'reveal_modal',
  admin_status text check (admin_status is null or admin_status in ('pending', 'resolved', 'dismissed')),
  admin_response_note text,
  admin_responded_at timestamptz,
  compensation_granted_tokens integer not null default 0,
  user_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_ref, pid, feedback_type)
);

create index if not exists mvp_reveal_feedback_user_pid_type_idx
  on public.mvp_reveal_feedback(user_ref, pid, feedback_type);

create index if not exists mvp_reveal_feedback_admin_status_idx
  on public.mvp_reveal_feedback(admin_status, created_at desc)
  where feedback_type in ('loss_report', 'inaccurate_report');

create index if not exists mvp_reveal_feedback_user_unread_idx
  on public.mvp_reveal_feedback(user_ref, admin_responded_at desc)
  where feedback_type = 'inaccurate_report' and admin_responded_at is not null;

create index if not exists mvp_candidate_pool_band_status_idx
  on public.mvp_candidate_pool(profit_band, status, last_verified_at desc);

create index if not exists mvp_candidate_pool_category_status_idx
  on public.mvp_candidate_pool(category, profit_band, status);

create index if not exists mvp_candidate_pool_reserved_idx
  on public.mvp_candidate_pool(reserved_until)
  where status = 'reserved';

create index if not exists mvp_pack_opens_user_idx
  on public.mvp_pack_opens(user_ref, opened_at desc);

create index if not exists mvp_pack_reveals_user_idx
  on public.mvp_pack_reveals(user_ref, revealed_at desc);

create index if not exists mvp_pack_reveals_visible_user_idx
  on public.mvp_pack_reveals(user_ref, revealed_at desc)
  where hidden_at is null;

create index if not exists mvp_pack_reveals_hidden_user_idx
  on public.mvp_pack_reveals(user_ref, hidden_at desc)
  where hidden_at is not null;

create index if not exists mvp_pack_reveals_pack_idx
  on public.mvp_pack_reveals(pack_open_id);

create index if not exists mvp_user_credits_auth_user_idx
  on public.mvp_user_credits(auth_user_id);

create index if not exists mvp_credit_ledger_user_idx
  on public.mvp_credit_ledger(user_ref, created_at desc);

create index if not exists mvp_reveal_feedback_type_idx
  on public.mvp_reveal_feedback(feedback_type, updated_at desc);

create index if not exists mvp_reveal_feedback_pid_idx
  on public.mvp_reveal_feedback(pid, updated_at desc);

alter table public.mvp_candidate_pool enable row level security;
alter table public.mvp_pack_opens enable row level security;
alter table public.mvp_pack_reveals enable row level security;
alter table public.mvp_user_credits enable row level security;
alter table public.mvp_credit_ledger enable row level security;
alter table public.mvp_category_readiness enable row level security;
alter table public.mvp_reveal_feedback enable row level security;

create or replace function public.claim_mvp_user_credits(
  p_user_ref text,
  p_auth_user_id uuid,
  p_free_grant integer default 5
)
returns table (
  balance integer,
  free_granted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ref text;
  v_grant integer;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref, '')), 64), '');
  v_grant := greatest(0, coalesce(p_free_grant, 0));

  if v_user_ref is null then
    raise exception 'missing user ref';
  end if;

  insert into public.mvp_user_credits (
    user_ref,
    auth_user_id,
    balance,
    free_grant_tokens,
    free_granted_at
  )
  values (
    v_user_ref,
    p_auth_user_id,
    v_grant,
    v_grant,
    now()
  )
  on conflict (user_ref) do update
  set auth_user_id = excluded.auth_user_id,
      updated_at = now()
  returning public.mvp_user_credits.balance,
            public.mvp_user_credits.free_granted_at
  into balance, free_granted_at;

  if not exists (
    select 1
    from public.mvp_credit_ledger l
    where l.user_ref = v_user_ref
      and l.event_type = 'free_grant'
  ) then
    insert into public.mvp_credit_ledger (
      user_ref,
      auth_user_id,
      event_type,
      amount,
      balance_after,
      metadata
    )
    values (
      v_user_ref,
      p_auth_user_id,
      'free_grant',
      v_grant,
      balance,
      jsonb_build_object('source', 'claim_mvp_user_credits')
    );
  end if;

  return next;
end;
$$;

revoke all on function public.claim_mvp_user_credits(text, uuid, integer) from public;
revoke execute on function public.claim_mvp_user_credits(text, uuid, integer) from anon;
revoke execute on function public.claim_mvp_user_credits(text, uuid, integer) from authenticated;
grant execute on function public.claim_mvp_user_credits(text, uuid, integer) to service_role;

create or replace function public.spend_mvp_user_credits(
  p_user_ref text,
  p_auth_user_id uuid,
  p_amount integer,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  ok boolean,
  balance integer,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ref text;
  v_amount integer;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref, '')), 64), '');
  v_amount := greatest(0, coalesce(p_amount, 0));

  if v_user_ref is null then
    return query select false, 0, 'missing user ref';
    return;
  end if;

  if v_amount = 0 then
    return query
      select true, c.balance, 'ok'
      from public.mvp_user_credits c
      where c.user_ref = v_user_ref
        and c.auth_user_id = p_auth_user_id;
    return;
  end if;

  update public.mvp_user_credits c
  set balance = c.balance - v_amount,
      updated_at = now()
  where c.user_ref = v_user_ref
    and c.auth_user_id = p_auth_user_id
    and c.balance >= v_amount
  returning c.balance into balance;

  if balance is null then
    select c.balance
    into balance
    from public.mvp_user_credits c
    where c.user_ref = v_user_ref
      and c.auth_user_id = p_auth_user_id;

    return query select false, coalesce(balance, 0), 'insufficient credits';
    return;
  end if;

  insert into public.mvp_credit_ledger (
    user_ref,
    auth_user_id,
    event_type,
    amount,
    balance_after,
    metadata
  )
  values (
    v_user_ref,
    p_auth_user_id,
    'pack_spend',
    -v_amount,
    balance,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return query select true, balance, 'ok';
end;
$$;

revoke all on function public.spend_mvp_user_credits(text, uuid, integer, jsonb) from public;
revoke execute on function public.spend_mvp_user_credits(text, uuid, integer, jsonb) from anon;
revoke execute on function public.spend_mvp_user_credits(text, uuid, integer, jsonb) from authenticated;
grant execute on function public.spend_mvp_user_credits(text, uuid, integer, jsonb) to service_role;

create or replace function public.refund_mvp_user_credits(
  p_user_ref text,
  p_auth_user_id uuid,
  p_amount integer,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ref text;
  v_amount integer;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref, '')), 64), '');
  v_amount := greatest(0, coalesce(p_amount, 0));

  if v_user_ref is null then
    raise exception 'missing user ref';
  end if;

  update public.mvp_user_credits c
  set balance = c.balance + v_amount,
      updated_at = now()
  where c.user_ref = v_user_ref
    and c.auth_user_id = p_auth_user_id
  returning c.balance into balance;

  if balance is null then
    raise exception 'credit row not found';
  end if;

  insert into public.mvp_credit_ledger (
    user_ref,
    auth_user_id,
    event_type,
    amount,
    balance_after,
    metadata
  )
  values (
    v_user_ref,
    p_auth_user_id,
    'pack_refund',
    v_amount,
    balance,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return next;
end;
$$;

revoke all on function public.refund_mvp_user_credits(text, uuid, integer, jsonb) from public;
revoke execute on function public.refund_mvp_user_credits(text, uuid, integer, jsonb) from anon;
revoke execute on function public.refund_mvp_user_credits(text, uuid, integer, jsonb) from authenticated;
grant execute on function public.refund_mvp_user_credits(text, uuid, integer, jsonb) to service_role;

create or replace function public.review_mvp_reveal_feedback_report(
  p_report_id bigint,
  p_admin_status text,
  p_admin_response_note text default '',
  p_compensation_tokens integer default 3
)
returns setof public.mvp_reveal_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.mvp_reveal_feedback%rowtype;
  v_credit public.mvp_user_credits%rowtype;
  v_status text;
  v_response_note text;
  v_grant integer;
begin
  v_status := lower(trim(coalesce(p_admin_status, '')));
  v_response_note := left(coalesce(p_admin_response_note, ''), 2000);
  v_grant := greatest(0, coalesce(p_compensation_tokens, 0));

  if v_status not in ('pending', 'resolved', 'dismissed') then
    raise exception 'invalid status';
  end if;

  select *
    into v_report
  from public.mvp_reveal_feedback
  where id = p_report_id
    and feedback_type in ('loss_report', 'inaccurate_report')
  for update;

  if not found then
    raise exception 'report not found';
  end if;

  if v_status = 'resolved'
     and coalesce(v_report.compensation_granted_tokens, 0) <= 0
     and v_grant > 0 then
    select *
      into v_credit
    from public.mvp_user_credits
    where user_ref = v_report.user_ref
    for update;

    if not found then
      raise exception 'credit row not found for report user';
    end if;

    update public.mvp_user_credits
    set balance = balance + v_grant,
        updated_at = now()
    where user_ref = v_credit.user_ref
    returning * into v_credit;

    insert into public.mvp_credit_ledger (
      user_ref,
      auth_user_id,
      event_type,
      amount,
      balance_after,
      metadata
    )
    values (
      v_credit.user_ref,
      v_credit.auth_user_id,
      'pack_refund',
      v_grant,
      v_credit.balance,
      jsonb_build_object(
        'reason', v_report.feedback_type,
        'source', 'admin_report_review',
        'report_id', v_report.id,
        'pid', v_report.pid
      )
    );

    v_report.compensation_granted_tokens := v_grant;
  end if;

  update public.mvp_reveal_feedback
  set admin_status = case when v_status = 'pending' then 'pending' else v_status end,
      admin_response_note = v_response_note,
      admin_responded_at = case when v_status = 'pending' then admin_responded_at else now() end,
      compensation_granted_tokens = case
        when v_status = 'resolved'
          then greatest(coalesce(compensation_granted_tokens, 0), coalesce(v_report.compensation_granted_tokens, 0))
        else compensation_granted_tokens
      end,
      updated_at = now()
  where id = v_report.id
  returning * into v_report;

  return next v_report;
end;
$$;

revoke all on function public.review_mvp_reveal_feedback_report(bigint, text, text, integer) from public;
revoke execute on function public.review_mvp_reveal_feedback_report(bigint, text, text, integer) from anon;
revoke execute on function public.review_mvp_reveal_feedback_report(bigint, text, text, integer) from authenticated;
grant execute on function public.review_mvp_reveal_feedback_report(bigint, text, text, integer) to service_role;

create or replace function public.enqueue_mvp_market_key_invalidation(
  p_comparable_key text,
  p_reason text default 'unknown',
  p_priority integer default 0,
  p_affected_pid bigint default null,
  p_old_comparable_key text default null,
  p_new_comparable_key text default null,
  p_parser_version text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  v_key := nullif(trim(p_comparable_key), '');
  if v_key is null then
    return;
  end if;

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
  values (
    v_key,
    left(coalesce(p_reason, 'unknown'), 120),
    greatest(0, coalesce(p_priority, 0)),
    p_affected_pid,
    p_old_comparable_key,
    p_new_comparable_key,
    p_parser_version,
    'pending',
    1,
    now(),
    now()
  )
  on conflict (comparable_key) do update
  set reason = excluded.reason,
      priority = greatest(public.mvp_market_key_invalidation.priority, excluded.priority),
      affected_pid = coalesce(excluded.affected_pid, public.mvp_market_key_invalidation.affected_pid),
      old_comparable_key = coalesce(excluded.old_comparable_key, public.mvp_market_key_invalidation.old_comparable_key),
      new_comparable_key = coalesce(excluded.new_comparable_key, public.mvp_market_key_invalidation.new_comparable_key),
      parser_version = coalesce(excluded.parser_version, public.mvp_market_key_invalidation.parser_version),
      event_count = public.mvp_market_key_invalidation.event_count + 1,
      last_event_at = now(),
      last_error = null,
      status = case
        when public.mvp_market_key_invalidation.status in ('done', 'failed') then 'pending'
        else public.mvp_market_key_invalidation.status
      end;
end;
$$;

revoke all on function public.enqueue_mvp_market_key_invalidation(text, text, integer, bigint, text, text, text) from public;
revoke execute on function public.enqueue_mvp_market_key_invalidation(text, text, integer, bigint, text, text, text) from anon;
revoke execute on function public.enqueue_mvp_market_key_invalidation(text, text, integer, bigint, text, text, text) from authenticated;
grant execute on function public.enqueue_mvp_market_key_invalidation(text, text, integer, bigint, text, text, text) to service_role;

create or replace function public.reserve_mvp_pool_candidates(
  p_band smallint,
  p_user_ref text,
  p_limit integer default 5,
  p_lease_seconds integer default 300
)
returns table (
  pid bigint,
  profit_band smallint,
  expected_profit_min integer,
  expected_profit_max integer,
  score numeric,
  confidence numeric,
  comparable_key text,
  exposure_count integer,
  max_exposure integer,
  last_verified_at timestamptz,
  reserved_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with eligible_categories as (
    select
      coalesce(pp.category, public.mvp_category_from_comparable_key(pp.comparable_key)) as pool_category,
      count(*) as ready_count,
      cr.min_ready_pool
    from public.mvp_candidate_pool pp
    join public.mvp_category_readiness cr
      on cr.category = coalesce(pp.category, public.mvp_category_from_comparable_key(pp.comparable_key))
    where pp.profit_band = p_band
      and cr.status = 'ready'
      and (pp.status = 'ready' or (pp.status = 'reserved' and pp.reserved_until < now()))
      and pp.exposure_count < pp.max_exposure
      and not exists (
        select 1 from public.mvp_pack_reveals r
        where r.user_ref = p_user_ref and r.pid = pp.pid
      )
    group by pool_category, cr.min_ready_pool
    having count(*) >= cr.min_ready_pool
  ), quality_candidates as (
    select pp.pid
    from public.mvp_candidate_pool pp
    join eligible_categories ec
      on ec.pool_category = coalesce(pp.category, public.mvp_category_from_comparable_key(pp.comparable_key))
    -- 2026-05-15: 외부 경쟁 낮은 매물 우선 (num_faved + source_updated_at).
    -- 미뇨이 가치 = "발견 안 된 알짜 매물" → 찜 많은 hot 매물 후순위.
    left join public.mvp_raw_listings r on r.pid = pp.pid
    where pp.profit_band = p_band
      and (pp.status = 'ready' or (pp.status = 'reserved' and pp.reserved_until < now()))
      and pp.exposure_count < pp.max_exposure
      and not exists (
        select 1 from public.mvp_pack_reveals pr
        where pr.user_ref = p_user_ref and pr.pid = pp.pid
      )
    order by pp.exposure_count asc,
             least(coalesce(r.num_faved, 0), 50) asc,
             pp.confidence desc,
             pp.score desc,
             coalesce(r.source_updated_at, pp.last_verified_at) desc
    limit greatest(1, least(coalesce(p_limit, 5), 50)) * 8
    for update skip locked
  ), candidates as (
    select qc.pid
    from quality_candidates qc
    order by random()
    limit greatest(1, least(coalesce(p_limit, 5), 50))
  ), claimed as (
    update public.mvp_candidate_pool p
    set status = 'reserved',
        reserved_until = now() + (greatest(30, least(coalesce(p_lease_seconds, 300), 1800)) || ' seconds')::interval,
        updated_at = now()
    from candidates c
    where p.pid = c.pid
    returning p.pid,
              p.profit_band,
              p.expected_profit_min,
              p.expected_profit_max,
              p.score,
              p.confidence,
              p.comparable_key,
              p.exposure_count,
              p.max_exposure,
              p.last_verified_at,
              p.reserved_until
  )
  select * from claimed;
end;
$$;

revoke all on function public.reserve_mvp_pool_candidates(smallint, text, integer, integer) from public;
revoke execute on function public.reserve_mvp_pool_candidates(smallint, text, integer, integer) from anon;
revoke execute on function public.reserve_mvp_pool_candidates(smallint, text, integer, integer) from authenticated;
grant execute on function public.reserve_mvp_pool_candidates(smallint, text, integer, integer) to service_role;

drop function if exists public.commit_mvp_pool_reveal(bigint);

create or replace function public.commit_mvp_pool_reveal(
  p_pid bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  -- P0-4: status/reserved_until 검증. 같은 reservation이 살아있는 동안만 commit.
  update public.mvp_candidate_pool
  set exposure_count = exposure_count + 1,
      status = case
        when exposure_count + 1 >= max_exposure then 'spent'
        else 'ready'
      end,
      reserved_until = null,
      updated_at = now()
  where pid = p_pid
    and status = 'reserved'
    and reserved_until is not null
    and reserved_until > now();
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.commit_mvp_pool_reveal(bigint) from public;
revoke execute on function public.commit_mvp_pool_reveal(bigint) from anon;
revoke execute on function public.commit_mvp_pool_reveal(bigint) from authenticated;
grant execute on function public.commit_mvp_pool_reveal(bigint) to service_role;

create or replace function public.release_mvp_pool_reservation(
  p_pid bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mvp_candidate_pool
  set status = case
        when exposure_count >= max_exposure then 'spent'
        else 'ready'
      end,
      reserved_until = null,
      updated_at = now()
  where pid = p_pid and status = 'reserved';
end;
$$;

revoke all on function public.release_mvp_pool_reservation(bigint) from public;
revoke execute on function public.release_mvp_pool_reservation(bigint) from anon;
revoke execute on function public.release_mvp_pool_reservation(bigint) from authenticated;
grant execute on function public.release_mvp_pool_reservation(bigint) to service_role;

create or replace function public.invalidate_mvp_pool_entry(
  p_pid bigint,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mvp_candidate_pool
  set status = 'invalidated',
      invalidated_reason = p_reason,
      reserved_until = null,
      updated_at = now()
  where pid = p_pid;
end;
$$;

revoke all on function public.invalidate_mvp_pool_entry(bigint, text) from public;
revoke execute on function public.invalidate_mvp_pool_entry(bigint, text) from anon;
revoke execute on function public.invalidate_mvp_pool_entry(bigint, text) from authenticated;
grant execute on function public.invalidate_mvp_pool_entry(bigint, text) to service_role;

drop view if exists public.mvp_listing_candidates;
create view public.mvp_listing_candidates
with (security_invoker = true)
as
select
  l.pid,
  l.url,
  l.name,
  l.price,
  l.sku_name,
  l.sku_median,
  a.price_gap,
  a.num_faved,
  a.velocity,
  a.review_rating,
  a.review_count,
  a.safety,
  a.risk_hits,
  a.score,
  a.score_flags,
  l.description_preview,
  l.image_url_template,
  l.image_count,
  l.thumbnail_url,
  l.shipping_fee,
  l.shipping_fee_general,
  l.shipping_source,
  l.estimated_buy_cost,
  l.gross_resell_gap,
  l.net_gap_after_shipping,
  a.candidate_rank,
  l.generated_at
from public.mvp_listings l
join public.mvp_listing_analysis a on a.pid = l.pid
join public.mvp_raw_listings r on r.pid = l.pid
join public.mvp_listing_parsed p on p.pid = l.pid
left join public.mvp_candidate_pool cp on cp.pid = l.pid
where r.detail_status = 'done'
  and r.listing_type = 'normal'
  and r.listing_state = 'active'
  and p.category in ('earphone', 'smartwatch')
  and p.needs_review is false
  and coalesce(nullif(r.sale_status, ''), 'SELLING') in ('SELLING', 'AVAILABLE', 'ON_SALE', 'ACTIVE')
  and (cp.pid is null or cp.status in ('ready', 'reserved', 'spent'));
-- P0-3: rate limiter for user-facing paid endpoints (packs/open 등).
-- 단일 row per bucket. window roll 시 overwrite → cleanup 불필요.

create table if not exists public.mvp_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null,
  updated_at timestamptz not null default now()
);

alter table public.mvp_rate_limits enable row level security;

create or replace function public.check_mvp_rate_limit(
  p_bucket_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  current_count integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
  v_key text;
  v_max integer;
  v_window integer;
begin
  v_key := nullif(left(trim(coalesce(p_bucket_key, '')), 200), '');
  v_max := greatest(1, coalesce(p_max_requests, 1));
  v_window := greatest(1, coalesce(p_window_seconds, 1));

  if v_key is null then
    return query select true, 0, v_now;
    return;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now)::numeric / v_window) * v_window
  );

  insert into public.mvp_rate_limits (bucket_key, window_started_at, request_count, updated_at)
  values (v_key, v_window_start, 1, v_now)
  on conflict (bucket_key) do update set
    window_started_at = case
      when public.mvp_rate_limits.window_started_at = excluded.window_started_at
        then public.mvp_rate_limits.window_started_at
      else excluded.window_started_at
    end,
    request_count = case
      when public.mvp_rate_limits.window_started_at = excluded.window_started_at
        then public.mvp_rate_limits.request_count + 1
      else 1
    end,
    updated_at = v_now
  returning public.mvp_rate_limits.request_count into v_count;

  return query select
    v_count <= v_max,
    v_count,
    v_window_start + make_interval(secs => v_window);
end;
$$;

revoke all on function public.check_mvp_rate_limit(text, integer, integer) from public;
revoke execute on function public.check_mvp_rate_limit(text, integer, integer) from anon;
revoke execute on function public.check_mvp_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.check_mvp_rate_limit(text, integer, integer) to service_role;

-- =====================================================================
-- Compliance Wave 1.1 — raw_listings 텍스트 retention
-- =====================================================================
-- 분쟁 노출도 감소 목적. 매뉴얼 Layer 2 (잡코리아 패소 패턴 회피) 적용.
-- 시계열 fact column (mvp_listing_observations.price/num_faved 등),
-- 통계 테이블 (mvp_market_price_daily/velocity_daily),
-- 파싱 결과 (mvp_listing_parsed),
-- 점수 결과 (mvp_listing_analysis) 모두 영향 없음 — 본 함수는 raw text/json만 NULL/'' 처리.
--
-- Active 매물 (사용자 노출 가능 상태): 90일 후 description_preview, raw_json만 NULL.
--   name/thumbnail_url/image_url_template 보존 (사용자 노출에 필요).
-- Dead 매물 (sold_confirmed/disappeared/archived): 30일 후 name, description_preview, raw_json NULL.
--   이미지 URL 처리는 Wave 1.2에서 별도 검토 (이 wave 적용 X).
--
-- p_dry_run=true 시 update 없이 대상 row count만 반환 → 안전 dry-run 가능.

create or replace function public.prune_raw_listings_active_text(
  p_days integer default 90,
  p_batch_limit integer default 5000,
  p_dry_run boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - make_interval(days => greatest(1, p_days));
  v_count bigint;
begin
  if p_dry_run then
    select count(*) into v_count
    from public.mvp_raw_listings
    where coalesce(listing_state, '') = 'active'
      and last_changed_at < v_cutoff
      and (
        coalesce(description_preview, '') <> ''
        or coalesce(raw_json, '{}'::jsonb) <> '{}'::jsonb
      );
    return v_count;
  end if;

  with target as (
    select pid
    from public.mvp_raw_listings
    where coalesce(listing_state, '') = 'active'
      and last_changed_at < v_cutoff
      and (
        coalesce(description_preview, '') <> ''
        or coalesce(raw_json, '{}'::jsonb) <> '{}'::jsonb
      )
    order by last_changed_at
    limit greatest(1, p_batch_limit)
  )
  update public.mvp_raw_listings r
  set description_preview = '',
      raw_json = '{}'::jsonb,
      updated_at = now()
  from target t
  where r.pid = t.pid;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.prune_raw_listings_active_text(integer, integer, boolean) from public;
revoke execute on function public.prune_raw_listings_active_text(integer, integer, boolean) from anon;
revoke execute on function public.prune_raw_listings_active_text(integer, integer, boolean) from authenticated;
grant execute on function public.prune_raw_listings_active_text(integer, integer, boolean) to service_role;

create or replace function public.prune_raw_listings_dead_text(
  p_days integer default 30,
  p_batch_limit integer default 5000,
  p_dry_run boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - make_interval(days => greatest(1, p_days));
  v_count bigint;
begin
  if p_dry_run then
    select count(*) into v_count
    from public.mvp_raw_listings
    where coalesce(listing_state, '') in ('sold_confirmed', 'disappeared', 'archived')
      and last_changed_at < v_cutoff
      and (
        coalesce(name, '') <> ''
        or coalesce(description_preview, '') <> ''
        or coalesce(raw_json, '{}'::jsonb) <> '{}'::jsonb
      );
    return v_count;
  end if;

  with target as (
    select pid
    from public.mvp_raw_listings
    where coalesce(listing_state, '') in ('sold_confirmed', 'disappeared', 'archived')
      and last_changed_at < v_cutoff
      and (
        coalesce(name, '') <> ''
        or coalesce(description_preview, '') <> ''
        or coalesce(raw_json, '{}'::jsonb) <> '{}'::jsonb
      )
    order by last_changed_at
    limit greatest(1, p_batch_limit)
  )
  update public.mvp_raw_listings r
  set name = '',
      description_preview = '',
      raw_json = '{}'::jsonb,
      updated_at = now()
  from target t
  where r.pid = t.pid;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.prune_raw_listings_dead_text(integer, integer, boolean) from public;
revoke execute on function public.prune_raw_listings_dead_text(integer, integer, boolean) from anon;
revoke execute on function public.prune_raw_listings_dead_text(integer, integer, boolean) from authenticated;
grant execute on function public.prune_raw_listings_dead_text(integer, integer, boolean) to service_role;

-- =====================================================================
-- 크레딧 충전권/일일 안전 한도 (2026-05-15 추가)
-- Single (1크) / Trial (5크) / Starter (20크) / Plus (45크) / Pro (130크)
-- mock Toss 결제 — 실제 결제 연동 전까지 mvp_payment_events에 mock 기록.
-- =====================================================================

create table if not exists public.mvp_user_plans (
  user_ref text primary key,
  auth_user_id uuid not null unique,
  plan_key text not null default 'free' check (plan_key in ('free','single','trial','starter','plus','pro')),
  status text not null default 'active' check (status in ('active','cancelled')),
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  daily_used_count integer not null default 0 check (daily_used_count >= 0),
  daily_reset_on date not null default current_date,
  last_payment_at timestamptz,
  last_payment_amount integer,
  last_payment_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mvp_user_plans_auth_user_idx
  on public.mvp_user_plans(auth_user_id);

create table if not exists public.mvp_payment_events (
  id bigserial primary key,
  user_ref text not null,
  auth_user_id uuid not null,
  event_type text not null check (event_type in ('subscribe','renew','cancel','reactivate')),
  plan_key text not null,
  amount integer not null default 0,
  payment_method text not null default 'toss_mock',
  payment_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mvp_payment_events_user_idx
  on public.mvp_payment_events(user_ref, created_at desc);

alter table public.mvp_user_plans enable row level security;
alter table public.mvp_payment_events enable row level security;

-- credit_ledger event_type 확장 (plan_grant)
alter table public.mvp_credit_ledger drop constraint if exists mvp_credit_ledger_event_type_check;
alter table public.mvp_credit_ledger add constraint mvp_credit_ledger_event_type_check
  check (event_type in ('free_grant','pack_spend','pack_refund','plan_grant'));

create or replace function public.subscribe_mvp_plan(
  p_user_ref text,
  p_auth_user_id uuid,
  p_plan_key text,
  p_credits integer,
  p_amount integer,
  p_payment_key text,
  p_period_days integer default 30
)
returns table (
  plan_key text,
  balance integer,
  current_period_end timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ref text;
  v_now timestamptz := now();
  v_period_end timestamptz;
  v_balance integer;
  -- Wave launch-21 (audit HIGH): schema.sql 과 migration 20260515000300 sync.
  -- 멱등성 가드 누락 시 fresh deploy 에서 동일 payment_key 재호출 = 크레딧 이중 grant risk.
  v_existing record;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref,'')), 64), '');
  if v_user_ref is null then raise exception 'missing user ref'; end if;
  if p_plan_key not in ('single','trial','starter','plus','pro') then
    raise exception 'invalid plan: %', p_plan_key;
  end if;

  -- Wave launch-21: H3 멱등성 가드 — 동일 payment_key 재호출이면 기존 결과 반환.
  if p_payment_key is not null and length(trim(p_payment_key)) > 0 then
    select pe.user_ref, up.plan_key, up.current_period_end, uc.balance
      into v_existing
      from public.mvp_payment_events pe
      left join public.mvp_user_plans up on up.user_ref = pe.user_ref
      left join public.mvp_user_credits uc on uc.user_ref = pe.user_ref
     where pe.payment_key = p_payment_key
     limit 1;
    if found then
      if v_existing.user_ref != v_user_ref then
        raise exception 'payment_key already used by another user';
      end if;
      plan_key := coalesce(v_existing.plan_key, p_plan_key);
      balance := coalesce(v_existing.balance, 0);
      current_period_end := v_existing.current_period_end;
      return next;
      return;
    end if;
  end if;

  v_period_end := v_now + make_interval(days => greatest(1, coalesce(p_period_days, 30)));

  insert into public.mvp_user_plans (
    user_ref, auth_user_id, plan_key, status, cancel_at_period_end,
    current_period_start, current_period_end,
    daily_used_count, daily_reset_on,
    last_payment_at, last_payment_amount, last_payment_key, updated_at
  ) values (
    v_user_ref, p_auth_user_id, p_plan_key, 'active', false,
    v_now, v_period_end,
    0, current_date,
    v_now, p_amount, p_payment_key, v_now
  )
  on conflict (user_ref) do update set
    auth_user_id = excluded.auth_user_id,
    plan_key = excluded.plan_key,
    status = 'active',
    cancel_at_period_end = false,
    current_period_start = v_now,
    current_period_end = v_period_end,
    daily_used_count = 0,
    daily_reset_on = current_date,
    last_payment_at = v_now,
    last_payment_amount = p_amount,
    last_payment_key = p_payment_key,
    updated_at = v_now;

  insert into public.mvp_user_credits (user_ref, auth_user_id, balance, free_grant_tokens, free_granted_at)
  values (v_user_ref, p_auth_user_id, greatest(0, coalesce(p_credits,0)), 0, null)
  on conflict (user_ref) do update set
    balance = public.mvp_user_credits.balance + greatest(0, coalesce(p_credits,0)),
    auth_user_id = excluded.auth_user_id,
    updated_at = now()
  returning public.mvp_user_credits.balance into v_balance;

  insert into public.mvp_credit_ledger (user_ref, auth_user_id, event_type, amount, balance_after, metadata)
  values (v_user_ref, p_auth_user_id, 'plan_grant', greatest(0, coalesce(p_credits,0)), v_balance,
          jsonb_build_object('source','subscribe_mvp_plan','plan',p_plan_key,'payment_key',p_payment_key));

  -- Wave launch-21: payment_key UNIQUE 위반 시 race condition 안전망 (동시 두 번째 insert 자동 차단).
  insert into public.mvp_payment_events (user_ref, auth_user_id, event_type, plan_key, amount, payment_method, payment_key, metadata)
  values (v_user_ref, p_auth_user_id, 'subscribe', p_plan_key, coalesce(p_amount,0), 'toss_mock', p_payment_key,
          jsonb_build_object('credits',p_credits,'period_days',p_period_days));

  plan_key := p_plan_key;
  balance := v_balance;
  current_period_end := v_period_end;
  return next;
end;
$$;

-- Wave launch-21: payment_key UNIQUE index — migration 20260515000300 sync.
create unique index if not exists mvp_payment_events_payment_key_uniq
  on public.mvp_payment_events(payment_key) where payment_key is not null;

revoke all on function public.subscribe_mvp_plan(text, uuid, text, integer, integer, text, integer) from public;
revoke execute on function public.subscribe_mvp_plan(text, uuid, text, integer, integer, text, integer) from anon;
revoke execute on function public.subscribe_mvp_plan(text, uuid, text, integer, integer, text, integer) from authenticated;
grant execute on function public.subscribe_mvp_plan(text, uuid, text, integer, integer, text, integer) to service_role;

create or replace function public.cancel_mvp_plan(p_user_ref text, p_auth_user_id uuid)
returns table (plan_key text, status text, cancel_at_period_end boolean, current_period_end timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ref text;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref,'')), 64), '');
  if v_user_ref is null then raise exception 'missing user ref'; end if;

  update public.mvp_user_plans p
  set cancel_at_period_end = true, updated_at = now()
  where p.user_ref = v_user_ref and p.auth_user_id = p_auth_user_id
  returning p.plan_key, p.status, p.cancel_at_period_end, p.current_period_end
  into plan_key, status, cancel_at_period_end, current_period_end;

  if plan_key is null then raise exception 'no active plan'; end if;

  insert into public.mvp_payment_events (user_ref, auth_user_id, event_type, plan_key, amount, payment_method, metadata)
  values (v_user_ref, p_auth_user_id, 'cancel', plan_key, 0, 'toss_mock', jsonb_build_object('cancel_at_period_end', true));

  return next;
end;
$$;

revoke all on function public.cancel_mvp_plan(text, uuid) from public;
grant execute on function public.cancel_mvp_plan(text, uuid) to service_role;

create or replace function public.reactivate_mvp_plan(p_user_ref text, p_auth_user_id uuid)
returns table (plan_key text, cancel_at_period_end boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ref text;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref,'')), 64), '');
  if v_user_ref is null then raise exception 'missing user ref'; end if;

  update public.mvp_user_plans p
  set cancel_at_period_end = false, updated_at = now()
  where p.user_ref = v_user_ref and p.auth_user_id = p_auth_user_id
  returning p.plan_key, p.cancel_at_period_end
  into plan_key, cancel_at_period_end;

  if plan_key is null then raise exception 'no plan'; end if;

  insert into public.mvp_payment_events (user_ref, auth_user_id, event_type, plan_key, amount, payment_method, metadata)
  values (v_user_ref, p_auth_user_id, 'reactivate', plan_key, 0, 'toss_mock', '{}'::jsonb);

  return next;
end;
$$;

revoke all on function public.reactivate_mvp_plan(text, uuid) from public;
grant execute on function public.reactivate_mvp_plan(text, uuid) to service_role;

-- 일일 한도 차감 (pack open에서 호출). 어제 reset이면 0부터.
-- p_limit: -1 = 무제한, 0 = 차단 (no plan), >0 = 한도.
create or replace function public.consume_mvp_daily_quota(
  p_user_ref text,
  p_auth_user_id uuid,
  p_limit integer
)
returns table (ok boolean, used integer, daily_limit integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ref text;
  v_today date := current_date;
  v_current integer;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref,'')), 64), '');
  if v_user_ref is null then raise exception 'missing user ref'; end if;

  if p_limit < 0 then
    ok := true; used := 0; daily_limit := -1; message := 'unlimited';
    return next; return;
  end if;
  if p_limit = 0 then
    ok := false; used := 0; daily_limit := 0; message := 'no_plan';
    return next; return;
  end if;

  insert into public.mvp_user_plans (user_ref, auth_user_id, plan_key, status, daily_used_count, daily_reset_on)
  values (v_user_ref, p_auth_user_id, 'free', 'active', 0, v_today)
  on conflict (user_ref) do nothing;

  update public.mvp_user_plans p
  set daily_used_count = 0, daily_reset_on = v_today, updated_at = now()
  where p.user_ref = v_user_ref and p.daily_reset_on <> v_today;

  -- Wave 106: atomic conditional update — race fix (TOCTOU 차단).
  update public.mvp_user_plans p
  set daily_used_count = daily_used_count + 1, updated_at = now()
  where p.user_ref = v_user_ref
    and p.daily_used_count < p_limit
    and p.daily_reset_on = v_today
  returning p.daily_used_count into v_current;

  if not found then
    select daily_used_count into v_current
    from public.mvp_user_plans where user_ref = v_user_ref;
    ok := false;
    used := coalesce(v_current, 0);
    daily_limit := p_limit;
    message := 'daily_limit_reached';
    return next; return;
  end if;

  ok := true; used := v_current; daily_limit := p_limit; message := 'ok';
  return next;
end;
$$;

revoke all on function public.consume_mvp_daily_quota(text, uuid, integer) from public;
grant execute on function public.consume_mvp_daily_quota(text, uuid, integer) to service_role;

create or replace function public.refund_mvp_daily_quota(p_user_ref text, p_auth_user_id uuid)
returns table (used integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ref text;
begin
  v_user_ref := nullif(left(trim(coalesce(p_user_ref,'')), 64), '');
  if v_user_ref is null then raise exception 'missing user ref'; end if;

  update public.mvp_user_plans p
  set daily_used_count = greatest(0, daily_used_count - 1),
      updated_at = now()
  where p.user_ref = v_user_ref
    and p.auth_user_id = p_auth_user_id
    and p.daily_reset_on = current_date
  returning p.daily_used_count into used;

  if used is null then used := 0; end if;
  return next;
end;
$$;

revoke all on function public.refund_mvp_daily_quota(text, uuid) from public;
grant execute on function public.refund_mvp_daily_quota(text, uuid) to service_role;

-- 2026-05-15: lifecycle stale drain (사용자 코멘트 401500642/404643880/404436811).
-- lifecycle worker backlog 14k 누적으로 missing 매물이 시세에 잔존. tick 끝에서 호출.
create or replace function public.drain_stale_missing_suspect(
  p_stale_hours integer default 12,
  p_max_rows integer default 1000
)
returns table (drained_count integer, pool_invalidated_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pids bigint[];
  v_pool integer;
begin
  select coalesce(array_agg(c.pid), '{}'::bigint[]) into v_pids
  from (
    select pid from public.mvp_lifecycle_checks
    where status = 'missing_suspect'
      and consecutive_missing_count >= 2
      and last_checked_at < now() - make_interval(hours => greatest(1, coalesce(p_stale_hours, 12)))
    limit greatest(1, least(coalesce(p_max_rows, 1000), 5000))
  ) c;

  if array_length(v_pids, 1) is null then
    drained_count := 0; pool_invalidated_count := 0;
    return next; return;
  end if;

  update public.mvp_raw_listings
  set listing_state = 'disappeared',
      disappeared_at = now(),
      updated_at = now()
  where pid = any(v_pids) and listing_state = 'missing_suspect';

  update public.mvp_lifecycle_checks
  set status = 'disappeared',
      state_reason = 'auto_stale_drain',
      updated_at = now()
  where pid = any(v_pids) and status = 'missing_suspect';

  with pool_drain as (
    update public.mvp_candidate_pool
    set status = 'invalidated',
        invalidated_reason = 'lifecycle_stale_drain',
        updated_at = now()
    where pid = any(v_pids) and status in ('ready', 'reserved')
    returning pid
  )
  select count(*) into v_pool from pool_drain;

  drained_count := array_length(v_pids, 1);
  pool_invalidated_count := coalesce(v_pool, 0);
  return next;
end;
$$;

revoke all on function public.drain_stale_missing_suspect(integer, integer) from public;
grant execute on function public.drain_stale_missing_suspect(integer, integer) to service_role;
