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

create table if not exists public.mvp_raw_listings (
  pid bigint primary key,
  url text not null,
  name text not null,
  price integer not null check (price >= 0),
  num_faved integer not null default 0 check (num_faved >= 0),
  free_shipping boolean not null default false,
  query text not null default '',
  source text not null default 'bunjang',
  description_preview text not null default '',
  sale_status text not null default '',
  shop_review_rating numeric,
  shop_review_count integer not null default 0 check (shop_review_count >= 0),
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
  missing_count integer not null default 0 check (missing_count >= 0),
  last_missing_at timestamptz,
  sold_detected_at timestamptz,
  disappeared_at timestamptz,
  source_uploaded_at timestamptz,
  source_updated_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  source text not null default 'bunjang',
  raw_json jsonb not null default '{}'::jsonb
);

create table if not exists public.mvp_market_price_daily (
  date date not null,
  comparable_key text not null,
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
  primary key (date, comparable_key)
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

create index if not exists mvp_raw_listings_seen_idx
  on public.mvp_raw_listings(last_seen_at desc);

create index if not exists mvp_raw_listings_detail_status_idx
  on public.mvp_raw_listings(detail_status, detail_enriched_at desc);

create index if not exists mvp_raw_listings_listing_type_idx
  on public.mvp_raw_listings(listing_type, sku_id);

create index if not exists mvp_raw_listings_state_idx
  on public.mvp_raw_listings(listing_state, last_seen_at desc);

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

create index if not exists mvp_market_price_daily_comparable_date_idx
  on public.mvp_market_price_daily(comparable_key, date desc);

create index if not exists mvp_detail_queue_claim_idx
  on public.mvp_detail_queue(status, available_at, priority desc, created_at);

create index if not exists mvp_detail_queue_locked_until_idx
  on public.mvp_detail_queue(locked_until);

create index if not exists mvp_collect_runs_started_at_idx
  on public.mvp_collect_runs(started_at desc);

create index if not exists mvp_collect_runs_status_idx
  on public.mvp_collect_runs(status);

create index if not exists mvp_collect_runs_request_ip_idx
  on public.mvp_collect_runs(request_ip);

create index if not exists mvp_collect_runs_response_mode_idx
  on public.mvp_collect_runs(response_mode);

alter table public.mvp_listings enable row level security;
alter table public.mvp_listing_analysis enable row level security;
alter table public.mvp_user_candidate_actions enable row level security;
alter table public.mvp_listing_ai_classifications enable row level security;
alter table public.mvp_raw_listings enable row level security;
alter table public.mvp_listing_parsed enable row level security;
alter table public.mvp_listing_observations enable row level security;
alter table public.mvp_market_price_daily enable row level security;
alter table public.mvp_detail_queue enable row level security;
alter table public.mvp_collect_runs enable row level security;

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

create table if not exists public.mvp_candidate_pool (
  pid bigint primary key references public.mvp_raw_listings(pid) on delete cascade,
  profit_band smallint not null check (profit_band in (1, 2, 3)),
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
  unique (user_ref, pid)
);

create index if not exists mvp_candidate_pool_band_status_idx
  on public.mvp_candidate_pool(profit_band, status, last_verified_at desc);

create index if not exists mvp_candidate_pool_reserved_idx
  on public.mvp_candidate_pool(reserved_until)
  where status = 'reserved';

create index if not exists mvp_pack_opens_user_idx
  on public.mvp_pack_opens(user_ref, opened_at desc);

create index if not exists mvp_pack_reveals_user_idx
  on public.mvp_pack_reveals(user_ref, revealed_at desc);

create index if not exists mvp_pack_reveals_pack_idx
  on public.mvp_pack_reveals(pack_open_id);

alter table public.mvp_candidate_pool enable row level security;
alter table public.mvp_pack_opens enable row level security;
alter table public.mvp_pack_reveals enable row level security;

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
  with candidates as (
    select pp.pid
    from public.mvp_candidate_pool pp
    where pp.profit_band = p_band
      and (pp.status = 'ready' or (pp.status = 'reserved' and pp.reserved_until < now()))
      and pp.exposure_count < pp.max_exposure
      and not exists (
        select 1 from public.mvp_pack_reveals r
        where r.user_ref = p_user_ref and r.pid = pp.pid
      )
    order by pp.last_verified_at desc, pp.score desc
    limit greatest(1, least(coalesce(p_limit, 5), 50))
    for update skip locked
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

create or replace function public.commit_mvp_pool_reveal(
  p_pid bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mvp_candidate_pool
  set exposure_count = exposure_count + 1,
      status = case
        when exposure_count + 1 >= max_exposure then 'spent'
        else 'ready'
      end,
      reserved_until = null,
      updated_at = now()
  where pid = p_pid;
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
join public.mvp_listing_analysis a on a.pid = l.pid;
