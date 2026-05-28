-- Wave 924: Daangn ready growth created two DB hot paths:
-- 1) score workers repeatedly ask "does this sku have enough recent active volume?"
-- 2) ops/debug queries ask "which Daangn regions are being seen / promoted?"
--
-- This migration is intentionally index-only. It does not loosen pool gates and
-- does not mutate listing/candidate rows.

create index if not exists mvp_raw_active_sku_first_seen_idx
  on public.mvp_raw_listings (sku_id, first_seen_at desc)
  where listing_state = 'active'
    and sku_id is not null;

create index if not exists mvp_raw_daangn_active_sku_first_seen_idx
  on public.mvp_raw_listings (sku_id, first_seen_at desc)
  where source = 'daangn'
    and listing_state = 'active'
    and sku_id is not null;

create index if not exists mvp_raw_daangn_last_seen_idx
  on public.mvp_raw_listings (last_seen_at desc)
  where source = 'daangn';

create index if not exists mvp_raw_daangn_first_seen_idx
  on public.mvp_raw_listings (first_seen_at desc)
  where source = 'daangn';

create index if not exists mvp_raw_daangn_created_at_idx
  on public.mvp_raw_listings (created_at desc)
  where source = 'daangn';

create index if not exists mvp_raw_daangn_region_last_seen_idx
  on public.mvp_raw_listings (daangn_region_name, last_seen_at desc)
  where source = 'daangn'
    and daangn_region_name is not null;

create index if not exists mvp_candidate_pool_ready_added_idx
  on public.mvp_candidate_pool (added_at desc, pid)
  where status = 'ready';

create index if not exists mvp_candidate_pool_invalidated_updated_idx
  on public.mvp_candidate_pool (updated_at desc, pid)
  where status = 'invalidated';
