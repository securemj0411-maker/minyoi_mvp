-- Wave 790: Daangn firehose recovered, but rawUpsert stayed near 100s/500 rows.
-- Root cause: repeated search hits updated every conflicting row and re-marked
-- score_dirty even when title/price/SKU/etc. did not change.
--
-- Policy:
-- - Insert new rows normally.
-- - Update existing rows only on meaningful changes or a coarse 2h active touch.
-- - Do not requeue score_dirty for a pure "seen again" touch.
-- - Skip parsed-row no-op updates.

alter table public.mvp_raw_listings
  add column if not exists num_comment integer,
  add column if not exists qty integer,
  add column if not exists description_hash text,
  add column if not exists bunjang_condition_label text,
  add column if not exists daangn_region_id text,
  add column if not exists daangn_region_name text,
  add column if not exists daangn_boosted_at timestamptz,
  add column if not exists daangn_web_crawl_allowed boolean,
  add column if not exists daangn_shipping_inferred text,
  add column if not exists daangn_manner_temperature numeric,
  add column if not exists daangn_review_count integer;

alter table public.mvp_listing_parsed
  add column if not exists condition_class text not null default 'normal';

create or replace function public.daangn_bulk_upsert_raw_listings(rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  affected integer;
begin
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
    (excluded.daangn_review_count is not null and mvp_raw_listings.daangn_review_count is distinct from excluded.daangn_review_count);

  get diagnostics affected = row_count;
  return affected;
end;
$function$;

revoke all on function public.daangn_bulk_upsert_raw_listings(jsonb) from public;
revoke execute on function public.daangn_bulk_upsert_raw_listings(jsonb) from anon;
revoke execute on function public.daangn_bulk_upsert_raw_listings(jsonb) from authenticated;
grant execute on function public.daangn_bulk_upsert_raw_listings(jsonb) to service_role;

create or replace function public.daangn_bulk_upsert_listing_parsed(rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  affected integer;
begin
  insert into mvp_listing_parsed
  select * from jsonb_populate_recordset(null::mvp_listing_parsed, rows)
  on conflict (pid) do update set
    parser_version = excluded.parser_version,
    content_hash = excluded.content_hash,
    category = excluded.category,
    family = excluded.family,
    model = excluded.model,
    variant_key = excluded.variant_key,
    comparable_key = excluded.comparable_key,
    parsed_json = excluded.parsed_json,
    parsed_at = excluded.parsed_at,
    updated_at = excluded.updated_at,
    needs_review = excluded.needs_review,
    parse_confidence = excluded.parse_confidence,
    condition_class = excluded.condition_class,
    condition_score = excluded.condition_score,
    condition_notes = excluded.condition_notes
  where
    mvp_listing_parsed.parser_version is distinct from excluded.parser_version or
    mvp_listing_parsed.content_hash is distinct from excluded.content_hash or
    mvp_listing_parsed.category is distinct from excluded.category or
    mvp_listing_parsed.family is distinct from excluded.family or
    mvp_listing_parsed.model is distinct from excluded.model or
    mvp_listing_parsed.variant_key is distinct from excluded.variant_key or
    mvp_listing_parsed.comparable_key is distinct from excluded.comparable_key or
    mvp_listing_parsed.parsed_json is distinct from excluded.parsed_json or
    mvp_listing_parsed.needs_review is distinct from excluded.needs_review or
    mvp_listing_parsed.parse_confidence is distinct from excluded.parse_confidence or
    mvp_listing_parsed.condition_class is distinct from excluded.condition_class or
    mvp_listing_parsed.condition_score is distinct from excluded.condition_score or
    mvp_listing_parsed.condition_notes is distinct from excluded.condition_notes;

  get diagnostics affected = row_count;
  return affected;
end;
$function$;

revoke all on function public.daangn_bulk_upsert_listing_parsed(jsonb) from public;
revoke execute on function public.daangn_bulk_upsert_listing_parsed(jsonb) from anon;
revoke execute on function public.daangn_bulk_upsert_listing_parsed(jsonb) from authenticated;
grant execute on function public.daangn_bulk_upsert_listing_parsed(jsonb) to service_role;
