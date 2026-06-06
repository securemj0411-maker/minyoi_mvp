-- Wave 1185: nearby Daangn feed price-filter hot path.
-- The feed asks for active/done Daangn rows by region, last_seen, and sometimes price <= budget.
-- Wave 1051 indexed region + last_seen but did not include price, so budgeted scans can fall back to heap reads.
-- Keep this partial and covering; it is read-path only and does not change row semantics.

create index concurrently if not exists mvp_raw_daangn_active_done_region_last_seen_price_cover_idx
  on public.mvp_raw_listings (daangn_region_id, last_seen_at desc)
  include (pid, daangn_region_name, price)
  where source = 'daangn'
    and listing_state = 'active'
    and detail_status = 'done'
    and daangn_region_id is not null;
