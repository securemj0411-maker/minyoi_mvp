-- Wave 979 follow-up (2026-05-31): 옛 claim_mvp_lifecycle_checks (2-param) DROP.
--   배경: 이전 migration 의 CREATE OR REPLACE 가 signature 다른 신규 function 추가만 함 →
--         PG function overload 충돌 → PostgREST PGRST203 "Could not choose the best candidate".
--   fix: 옛 (p_batch_size, p_lease_seconds) DROP. 새 5-param function 만 남김. idempotent.

DROP FUNCTION IF EXISTS public.claim_mvp_lifecycle_checks(integer, integer);
