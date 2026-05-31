-- Wave 992 (2026-05-31): 진짜 ALL SECURITY DEFINER RPC statement_timeout 일괄 60s.
--   배경: wave 991 박은 후에도 26개 RPC default 8s 잔존:
--     - daangn_bulk_upsert_raw_listings / _v2 / _listing_parsed
--     - backfill_market_price_daily
--     - enqueue_mvp_market_key_invalidation(s)
--     - prune_listing_observation_payloads / prune_raw_listings_*
--     - cancel/subscribe/reactivate_mvp_plan / delete_user_account 등
--   daangn-price-sweep-worker fail 발견 → 통째 audit (prosecdef = true 전체).
--   trade-off 0. 정상 작업 1~2s, 60s emergency buffer.

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) AS cfg WHERE cfg LIKE 'statement_timeout=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET statement_timeout TO ''60s''', rec.sig);
  END LOOP;
END $$;
