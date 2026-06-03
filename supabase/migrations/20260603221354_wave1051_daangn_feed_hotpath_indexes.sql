-- Wave 1051: feed launch hot path indexes.
-- /api/packs/pool prefetches nearby Daangn rows by active/done + region + last_seen.
-- Keep these partial so old/sold/pending raws do not bloat the feed-facing index.

create index concurrently if not exists mvp_raw_daangn_active_done_region_last_seen_idx
  on public.mvp_raw_listings (daangn_region_id, last_seen_at desc)
  include (pid, daangn_region_name)
  where source = 'daangn'
    and listing_state = 'active'
    and detail_status = 'done'
    and daangn_region_id is not null;

create index concurrently if not exists mvp_raw_daangn_active_done_last_seen_idx
  on public.mvp_raw_listings (last_seen_at desc)
  include (pid, daangn_region_id, daangn_region_name)
  where source = 'daangn'
    and listing_state = 'active'
    and detail_status = 'done';
