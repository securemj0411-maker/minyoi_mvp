-- Wave 1032 (2026-06-04): score-worker fashion reserve range hotpath.
-- Production PostgREST timed out on:
--   sku_id=like.shoe-* / clothing-* + listing_type=normal + limit=120
-- The worker now uses bounded lexicographic ranges; this partial index keeps
-- that reserve lane ordered by recent rows without scanning unrelated dirty rows.

create index concurrently if not exists mvp_raw_listings_dirty_scorable_shoe_range_recent_idx
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

create index concurrently if not exists mvp_raw_listings_dirty_scorable_clothing_range_recent_idx
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
