-- Wave 940: Daangn scale made score_dirty cleanup residues large enough that
-- generic score_dirty(last_seen_at) scans became expensive for unscorable rows.
-- These indexes back the reason-specific cleanup filters in tick-pipeline.ts.
--
-- Use CONCURRENTLY because production raw listings are hot while A/B/C workers run.

create index concurrently if not exists mvp_raw_listings_dirty_detail_not_done_recent_idx
  on public.mvp_raw_listings(last_seen_at desc) include (pid)
  where score_dirty = true
    and detail_status <> 'done';

create index concurrently if not exists mvp_raw_listings_dirty_done_sku_null_recent_idx
  on public.mvp_raw_listings(last_seen_at desc) include (pid)
  where score_dirty = true
    and detail_status = 'done'
    and sku_id is null;

create index concurrently if not exists mvp_raw_listings_dirty_done_not_active_recent_idx
  on public.mvp_raw_listings(last_seen_at desc) include (pid)
  where score_dirty = true
    and detail_status = 'done'
    and sku_id is not null
    and listing_state <> 'active';

create index concurrently if not exists mvp_raw_listings_dirty_done_non_normal_recent_idx
  on public.mvp_raw_listings(last_seen_at desc) include (pid)
  where score_dirty = true
    and detail_status = 'done'
    and sku_id is not null
    and listing_state = 'active'
    and listing_type <> 'normal'
    and listing_type_override is null;
