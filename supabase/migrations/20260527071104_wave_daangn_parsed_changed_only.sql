-- Wave 791: Daangn raw no-op skip exposed changed pids.
--
-- The v1 raw RPC now skips repeated rows correctly, but the app still sent all
-- 500 candidate parsed rows after raw upsert. On production that kept
-- rawUpsert around 100s even when 488/500 raw rows were skipped.
--
-- Add a v2 RPC rather than changing v1's return type, so already-deployed code
-- that expects an integer stays safe during rollout.

create or replace function public.daangn_bulk_upsert_raw_listings_v2(rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  result jsonb;
begin
  with upserted as (
    insert into mvp_raw_listings (
      pid, source, url, name, price, num_faved, num_comment, free_shipping,
      thumbnail_url, description_preview, query, seller_uid, seller_source,
      listing_state, listing_type, sku_id, sku_name, sale_status,
      shop_review_count, image_count, missing_count, detail_status,
      detail_enriched_at, source_updated_at, last_seen_at, last_changed_at,
      updated_at, pool_eligible, score_dirty, raw_json,
      daangn_region_id, daangn_region_name, daangn_boosted_at,
      daangn_web_crawl_allowed, daangn_shipping_inferred,
      daangn_manner_temperature, daangn_review_count
    )
    select
      pid, source, url, name, price, num_faved, num_comment, free_shipping,
      thumbnail_url, description_preview, query, seller_uid, seller_source,
      listing_state, listing_type, sku_id, sku_name, sale_status,
      shop_review_count, image_count, missing_count, detail_status,
      detail_enriched_at, source_updated_at, last_seen_at, last_changed_at,
      updated_at, pool_eligible, score_dirty, raw_json,
      daangn_region_id, daangn_region_name, daangn_boosted_at,
      daangn_web_crawl_allowed, daangn_shipping_inferred,
      daangn_manner_temperature, daangn_review_count
    from jsonb_populate_recordset(null::mvp_raw_listings, rows)
    on conflict (pid) do update set
      name = excluded.name,
      price = excluded.price,
      num_faved = excluded.num_faved,
      num_comment = excluded.num_comment,
      thumbnail_url = excluded.thumbnail_url,
      description_preview = excluded.description_preview,
      sale_status = excluded.sale_status,
      sku_id = excluded.sku_id,
      sku_name = excluded.sku_name,
      listing_type = excluded.listing_type,
      listing_state = excluded.listing_state,
      source_updated_at = excluded.source_updated_at,
      last_seen_at = greatest(mvp_raw_listings.last_seen_at, excluded.last_seen_at),
      last_changed_at = case
        when (
          mvp_raw_listings.name is distinct from excluded.name or
          mvp_raw_listings.price is distinct from excluded.price or
          mvp_raw_listings.num_faved is distinct from excluded.num_faved or
          mvp_raw_listings.num_comment is distinct from excluded.num_comment or
          mvp_raw_listings.description_preview is distinct from excluded.description_preview or
          mvp_raw_listings.sale_status is distinct from excluded.sale_status or
          mvp_raw_listings.sku_id is distinct from excluded.sku_id or
          mvp_raw_listings.sku_name is distinct from excluded.sku_name or
          mvp_raw_listings.listing_type is distinct from excluded.listing_type or
          mvp_raw_listings.listing_state is distinct from excluded.listing_state or
          mvp_raw_listings.pool_eligible is distinct from excluded.pool_eligible or
          mvp_raw_listings.daangn_shipping_inferred is distinct from excluded.daangn_shipping_inferred
        )
        then excluded.last_changed_at
        else mvp_raw_listings.last_changed_at
      end,
      updated_at = excluded.updated_at,
      pool_eligible = excluded.pool_eligible,
      score_dirty = case
        when (
          mvp_raw_listings.name is distinct from excluded.name or
          mvp_raw_listings.price is distinct from excluded.price or
          mvp_raw_listings.num_faved is distinct from excluded.num_faved or
          mvp_raw_listings.num_comment is distinct from excluded.num_comment or
          mvp_raw_listings.description_preview is distinct from excluded.description_preview or
          mvp_raw_listings.sale_status is distinct from excluded.sale_status or
          mvp_raw_listings.sku_id is distinct from excluded.sku_id or
          mvp_raw_listings.sku_name is distinct from excluded.sku_name or
          mvp_raw_listings.listing_type is distinct from excluded.listing_type or
          mvp_raw_listings.listing_state is distinct from excluded.listing_state or
          mvp_raw_listings.pool_eligible is distinct from excluded.pool_eligible or
          mvp_raw_listings.daangn_shipping_inferred is distinct from excluded.daangn_shipping_inferred
        )
        then (mvp_raw_listings.score_dirty or excluded.pool_eligible)
        else mvp_raw_listings.score_dirty
      end,
      raw_json = excluded.raw_json,
      daangn_region_id = excluded.daangn_region_id,
      daangn_region_name = excluded.daangn_region_name,
      daangn_boosted_at = excluded.daangn_boosted_at,
      daangn_web_crawl_allowed = excluded.daangn_web_crawl_allowed,
      daangn_shipping_inferred = excluded.daangn_shipping_inferred,
      daangn_manner_temperature = coalesce(excluded.daangn_manner_temperature, mvp_raw_listings.daangn_manner_temperature),
      daangn_review_count = coalesce(excluded.daangn_review_count, mvp_raw_listings.daangn_review_count)
    where
      mvp_raw_listings.last_seen_at < excluded.last_seen_at - interval '2 hours' or
      mvp_raw_listings.name is distinct from excluded.name or
      mvp_raw_listings.price is distinct from excluded.price or
      mvp_raw_listings.num_faved is distinct from excluded.num_faved or
      mvp_raw_listings.num_comment is distinct from excluded.num_comment or
      mvp_raw_listings.thumbnail_url is distinct from excluded.thumbnail_url or
      mvp_raw_listings.description_preview is distinct from excluded.description_preview or
      mvp_raw_listings.sale_status is distinct from excluded.sale_status or
      mvp_raw_listings.sku_id is distinct from excluded.sku_id or
      mvp_raw_listings.sku_name is distinct from excluded.sku_name or
      mvp_raw_listings.listing_type is distinct from excluded.listing_type or
      mvp_raw_listings.listing_state is distinct from excluded.listing_state or
      mvp_raw_listings.source_updated_at is distinct from excluded.source_updated_at or
      mvp_raw_listings.pool_eligible is distinct from excluded.pool_eligible or
      mvp_raw_listings.raw_json is distinct from excluded.raw_json or
      mvp_raw_listings.daangn_region_id is distinct from excluded.daangn_region_id or
      mvp_raw_listings.daangn_region_name is distinct from excluded.daangn_region_name or
      mvp_raw_listings.daangn_boosted_at is distinct from excluded.daangn_boosted_at or
      mvp_raw_listings.daangn_web_crawl_allowed is distinct from excluded.daangn_web_crawl_allowed or
      mvp_raw_listings.daangn_shipping_inferred is distinct from excluded.daangn_shipping_inferred or
      (excluded.daangn_manner_temperature is not null and mvp_raw_listings.daangn_manner_temperature is distinct from excluded.daangn_manner_temperature) or
      (excluded.daangn_review_count is not null and mvp_raw_listings.daangn_review_count is distinct from excluded.daangn_review_count)
    returning pid
  )
  select jsonb_build_object(
    'affected', count(*),
    'affectedPids', coalesce(jsonb_agg(pid), '[]'::jsonb)
  )
  into result
  from upserted;

  return result;
end;
$function$;

revoke all on function public.daangn_bulk_upsert_raw_listings_v2(jsonb) from public;
revoke execute on function public.daangn_bulk_upsert_raw_listings_v2(jsonb) from anon;
revoke execute on function public.daangn_bulk_upsert_raw_listings_v2(jsonb) from authenticated;
grant execute on function public.daangn_bulk_upsert_raw_listings_v2(jsonb) to service_role;
