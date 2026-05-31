-- Wave 980 follow-up (2026-05-31): backfill RPC statement_timeout 추가.
--   발견: daangn-lifecycle-backfill cron 4/4 fail (PostgREST 57014 statement timeout).
--   원인: PostgREST default statement_timeout ~8s. INSERT 5000 row + index 9개+ 갱신이 초과.
--   fix: function level SET statement_timeout TO '55s'. route maxDuration 60s 안에서 OK.

CREATE OR REPLACE FUNCTION public.wave978_backfill_daangn_lifecycle_chunk(p_chunk_size integer DEFAULT 5000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '55s'
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted integer;
BEGIN
  WITH ins AS (
    INSERT INTO public.mvp_lifecycle_checks (pid, source, status, priority_tier, next_check_at, state_reason, updated_at)
    SELECT r.pid, 'daangn', 'active',
      COALESCE(CASE
        WHEN p.parse_confidence >= 0.65 AND p.needs_review = false THEN 'market_sample'
        WHEN p.comparable_key IS NOT NULL THEN 'exploration'
        ELSE 'general'
      END, 'general'),
      NOW() + (RANDOM() * INTERVAL '7 days'),
      'wave978_backfill', NOW()
    FROM public.mvp_raw_listings r
    LEFT JOIN public.mvp_listing_parsed p ON p.pid = r.pid
    WHERE r.source = 'daangn'
      AND r.listing_state = 'active'
      AND NOT EXISTS (SELECT 1 FROM public.mvp_lifecycle_checks lc WHERE lc.pid = r.pid)
    LIMIT GREATEST(100, LEAST(COALESCE(p_chunk_size, 5000), 20000))
    ON CONFLICT (pid) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;
  RETURN COALESCE(v_inserted, 0);
END;
$function$;
