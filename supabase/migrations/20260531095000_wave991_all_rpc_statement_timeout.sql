-- Wave 991 (2026-05-31): 모든 SECURITY DEFINER RPC 에 statement_timeout 60s 일괄 박음.
--   배경: PostgREST default 8s. 매 wave 마다 다른 RPC 에서 57014 statement_timeout fail 발견.
--         (wave 980 backfill, 981 velocity, 986 score, 988 lifecycle claim).
--   통째 본질 fix: 12개 RPC default 8s → 60s. trade-off 0 (정상 작업 1~2s, 60s emergency buffer).
--   이미 timeout 박힌 RPC (wave 980/981/986/988 등) 는 skip (NOT EXISTS 조건).

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'claim_mvp_detail_queue',
        'claim_mvp_joongna_detail_queue',
        'claim_mvp_kakao_share_bonus',
        'claim_mvp_user_credits',
        'claim_next_hotdeal_for_alert',
        'commit_mvp_pool_reveal',
        'drain_stale_missing_suspect',
        'expire_mvp_plans',
        'expire_search_query_cadence_overrides',
        'expire_stale_hotdeal_reservations',
        'invalidate_mvp_pool_entry',
        'spend_and_record_pack_open',
        'reserve_mvp_pool_candidates',
        'release_mvp_pool_reservation'
      )
      AND NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) AS cfg WHERE cfg LIKE 'statement_timeout=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET statement_timeout TO ''60s''', rec.sig);
  END LOOP;
END $$;
