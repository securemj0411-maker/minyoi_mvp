create table if not exists public.mvp_listings (
  pid bigint primary key,
  url text not null,
  name text not null,
  price integer not null check (price >= 0),
  sku_name text not null,
  sku_median integer not null check (sku_median >= 0),
  description_preview text not null default '',
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
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
    order by q.priority desc, q.available_at asc, q.created_at asc
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
