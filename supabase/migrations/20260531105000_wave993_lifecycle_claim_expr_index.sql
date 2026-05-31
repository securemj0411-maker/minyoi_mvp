-- Wave 993 (2026-05-31): claim_mvp_lifecycle_checks ORDER BY 와 정합 expression partial index.
--   배경: 알림 — lifecycle 22~24% fail "REST timed out POST claim_mvp_lifecycle_checks".
--         PG statement_timeout 60s (wave 988) 박혔지만 60s+ 안 안 끝남.
--   진단: 기존 partial index `mvp_lifecycle_checks_claim_ready_idx (next_check_at, priority_tier, updated_at)`
--         column order 가 ORDER BY (priority_tier CASE rank, next_check_at, updated_at) 와 다름.
--         priority_tier 는 첫 정렬 키지만 index 는 next_check_at 이 첫 → index scan 효율 ↓.
--   fix: ORDER BY 정확히 match 하는 expression partial index 추가.
--   trade-off: storage +10~30MB / write (INSERT/UPDATE) 약간 무거움 (밀리초). 거의 0.

CREATE INDEX CONCURRENTLY IF NOT EXISTS mvp_lifecycle_checks_claim_expr_idx
ON public.mvp_lifecycle_checks
(
  (CASE priority_tier
    WHEN 'pool' THEN 0
    WHEN 'near_pool' THEN 1
    WHEN 'exploration' THEN 2
    WHEN 'market_sample' THEN 3
    ELSE 4
  END),
  next_check_at,
  updated_at
)
WHERE status IN ('active', 'missing_suspect');
