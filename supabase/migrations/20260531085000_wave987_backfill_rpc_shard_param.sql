-- Wave 987 (2026-05-31): backfill RPC 시그니처 확장 + 옛 1-param DROP.
--   배경: lifecycle worker (자기 자신) 안에서 catch-up 호출 — lock-free 영구 fix (wave 987 docs).
--         lane a/b/c 별로 shard 분리 (a=0/3, b=1/3, c=2/3) → 동시 작동 시 다른 row → lock 충돌 0.
--   변경: 새 3-param signature 추가. 옛 1-param DROP (PostgREST overload 충돌 차단).

DROP FUNCTION IF EXISTS public.wave978_backfill_daangn_lifecycle_chunk(integer);

CREATE OR REPLACE FUNCTION public.wave978_backfill_daangn_lifecycle_chunk(
  p_chunk_size integer DEFAULT 5000,
  p_daangn_shard_count integer DEFAULT 1,
  p_daangn_shard_index integer DEFAULT 0
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '55s'
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted integer;
  v_shard_count integer := GREATEST(1, LEAST(COALESCE(p_daangn_shard_count, 1), 64));
  v_shard_index integer := GREATEST(0, LEAST(COALESCE(p_daangn_shard_index, 0), v_shard_count - 1));
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
      AND (v_shard_count <= 1 OR (r.pid % v_shard_count) = v_shard_index)
      AND NOT EXISTS (SELECT 1 FROM public.mvp_lifecycle_checks lc WHERE lc.pid = r.pid)
    LIMIT GREATEST(50, LEAST(COALESCE(p_chunk_size, 5000), 20000))
    ON CONFLICT (pid) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;
  RETURN COALESCE(v_inserted, 0);
END;
$function$;
