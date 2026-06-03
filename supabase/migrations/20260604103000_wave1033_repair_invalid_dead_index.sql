-- Wave 1033 (2026-06-04): repair invalid raw dead-row prune index.
-- Production audit found mvp_raw_listings_dead_last_changed_idx with
-- indisvalid=false. Rebuild concurrently so prune_raw_listings_dead_rows can
-- keep using last_changed_at without blocking raw-listing writes.

drop index concurrently if exists public.mvp_raw_listings_dead_last_changed_idx;

create index concurrently if not exists mvp_raw_listings_dead_last_changed_idx
  on public.mvp_raw_listings(last_changed_at)
  where listing_state in ('sold_confirmed', 'disappeared', 'archived');
