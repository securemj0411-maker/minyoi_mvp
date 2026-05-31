-- Wave 980 (2026-05-31): daangn lifecycle backfill chunk RPC.
--   배경: mvp_raw_listings daangn active 363k 중 7k 만 lifecycle 시드.
--         MCP execute_sql 로 INSERT 1k 도 timeout (statement_timeout > 클라이언트 timeout).
--   설계: PG 안 단일 INSERT statement (LIMIT 5000) RPC. Vercel cron route 가 매 5분 호출 →
--         73 cycle ~ 6시간 안 전체 시드. spread: next_check_at = NOW() + RANDOM()*7d.

CREATE OR REPLACE FUNCTION public.wave978_backfill_daangn_lifecycle_chunk(p_chunk_size integer DEFAULT 5000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
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
