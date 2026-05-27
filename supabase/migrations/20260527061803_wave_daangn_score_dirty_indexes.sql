-- Wave 789: Daangn firehose made score_dirty rows much wider.
-- score-worker only needs rows that are already detail-enriched, SKU-matched,
-- and active; keep that hot path index-backed, especially for source quotas.

create index if not exists mvp_raw_listings_dirty_scorable_recent_idx
  on public.mvp_raw_listings(last_seen_at desc)
  where score_dirty = true
    and detail_status = 'done'
    and sku_id is not null
    and listing_state = 'active';

create index if not exists mvp_raw_listings_dirty_scorable_source_recent_idx
  on public.mvp_raw_listings(source, last_seen_at desc)
  where score_dirty = true
    and detail_status = 'done'
    and sku_id is not null
    and listing_state = 'active';

create index if not exists mvp_raw_listings_dirty_scorable_sku_recent_idx
  on public.mvp_raw_listings(sku_id text_pattern_ops, last_seen_at desc)
  where score_dirty = true
    and detail_status = 'done'
    and sku_id is not null
    and listing_state = 'active';

-- Keep the per-run fashion low-volume guard from scanning the enlarged raw table.
create index if not exists mvp_raw_listings_active_fashion_first_seen_idx
  on public.mvp_raw_listings(first_seen_at desc)
  where listing_state = 'active'
    and sku_id is not null
    and (
      sku_id like 'shoe-%' or
      sku_id like 'clothing-%' or
      sku_id like 'bag-%'
    );

-- Support get_fraud_group_hashes(), which groups active rows by description hash.
alter table public.mvp_raw_listings
  add column if not exists description_hash text;

create index if not exists mvp_raw_listings_active_description_seller_idx
  on public.mvp_raw_listings(description_hash, seller_uid)
  where description_hash is not null
    and seller_uid is not null
    and listing_state = 'active';
