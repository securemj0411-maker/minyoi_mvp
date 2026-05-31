-- Wave 986 (2026-05-31): score-worker scorable claim RPC.
--   배경: lane a (sourceFilter 없음 = 모든 source) 매 5-10분 PostgREST timeout (57014).
--         wave 939 OR split 후에도 잔존. mvp_raw_listings 840k+ × 25 columns × scanLimit 1000 무거움.
--   fix: PG side dedicated RPC. SECURITY DEFINER + SET statement_timeout 60s.
--        PostgREST default 8s 우회. RPC 응답은 setof mvp_raw_listings.

CREATE OR REPLACE FUNCTION public.claim_scorable_raw_rows(
  p_limit integer DEFAULT 200,
  p_source_filter text DEFAULT NULL,
  p_daangn_shard_count integer DEFAULT 1,
  p_daangn_shard_index integer DEFAULT 0,
  p_listing_type_filter text DEFAULT 'normal'
)
RETURNS SETOF public.mvp_raw_listings
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout TO '60s'
SET search_path TO 'public'
AS $function$
  SELECT *
  FROM public.mvp_raw_listings
  WHERE score_dirty = true
    AND detail_status = 'done'
    AND sku_id IS NOT NULL
    AND listing_state = 'active'
    AND (
      p_listing_type_filter IS NULL
      OR listing_type = p_listing_type_filter
      OR listing_type_override = p_listing_type_filter
    )
    AND (p_source_filter IS NULL OR source = p_source_filter)
    AND (
      p_daangn_shard_count <= 1
      OR source <> 'daangn'
      OR ((pid % p_daangn_shard_count) = p_daangn_shard_index)
    )
  ORDER BY last_seen_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 5000));
$function$;
