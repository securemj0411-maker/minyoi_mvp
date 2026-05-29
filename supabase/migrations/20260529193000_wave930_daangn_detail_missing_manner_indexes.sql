-- Wave 930: Daangn detail-worker missing-manner candidate hot path.
--
-- Production saw repeated statement timeouts selecting active Daangn SKU rows
-- whose manner temperature had not been fetched yet. The live DB was patched
-- first with CONCURRENTLY; this migration records the same schema shape for
-- future environments.

create index if not exists mvp_raw_daangn_active_sku_missing_manner_last_seen_idx
  on public.mvp_raw_listings (last_seen_at desc)
  include (pid, url)
  where source = 'daangn'
    and listing_state = 'active'
    and sku_id is not null
    and daangn_manner_temperature is null;

create index if not exists mvp_raw_daangn_active_sku_dirty_missing_manner_updated_idx
  on public.mvp_raw_listings (updated_at desc)
  include (pid, url, score_dirty)
  where source = 'daangn'
    and listing_state = 'active'
    and sku_id is not null
    and daangn_manner_temperature is null
    and score_dirty = true;
