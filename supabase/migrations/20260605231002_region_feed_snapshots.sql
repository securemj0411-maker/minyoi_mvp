-- Region-level member feed snapshots.
--
-- The live /api/packs/pool path is intentionally rich: it joins candidate pool,
-- raw listings, market bands, velocity, parsed condition, images, and Daangn
-- distance. That is expensive and can make the first feed paint feel broken.
-- This table stores the already-renderable feed payload for one region/filter
-- combination so users in the same area can share the same hot feed result.

create table if not exists public.mvp_region_feed_snapshots (
  cache_key text primary key,
  region_key text not null,
  source_filter text not null default 'all',
  budget_filter text not null default 'unlimited',
  sort_key text not null default 'profit_desc',
  preference_key text not null default 'balanced',
  extended_marketplaces boolean not null default false,
  page_size integer not null default 30 check (page_size between 1 and 500),
  payload jsonb not null,
  item_count integer not null default 0 check (item_count >= 0),
  pids bigint[] not null default '{}'::bigint[],
  params_snapshot jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists mvp_region_feed_snapshots_hot_idx
  on public.mvp_region_feed_snapshots
  (region_key, source_filter, budget_filter, sort_key, preference_key, extended_marketplaces, page_size, expires_at desc);

create index if not exists mvp_region_feed_snapshots_expires_idx
  on public.mvp_region_feed_snapshots (expires_at);

-- Current Daangn feed prefetch applies a price filter before pool lookup when
-- the user selects a budget. The older hotpath index did not carry price, so
-- budgeted local feeds could still scan too much raw listing data.
create index concurrently if not exists mvp_raw_daangn_active_done_region_price_last_seen_idx
  on public.mvp_raw_listings (daangn_region_id, price, last_seen_at desc)
  include (pid, daangn_region_name)
  where source = 'daangn'
    and listing_state = 'active'
    and detail_status = 'done'
    and daangn_region_id is not null
    and price is not null;

alter table public.mvp_region_feed_snapshots enable row level security;

revoke all on public.mvp_region_feed_snapshots from anon;
revoke all on public.mvp_region_feed_snapshots from authenticated;
grant select, insert, update, delete on public.mvp_region_feed_snapshots to service_role;

notify pgrst, 'reload schema';
