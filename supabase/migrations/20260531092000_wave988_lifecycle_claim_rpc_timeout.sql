-- Wave 988 (2026-05-31): lifecycle claim RPC statement_timeout 박음.
--   배경: 24h fail audit — lifecycle-worker (a/b/c) timeout 46건. claim_mvp_lifecycle_checks RPC 자체
--         PostgREST default 8s 초과. mvp_lifecycle_checks (300k+ row) claim query 가 부담 큼.
--   fix: ALTER FUNCTION SET statement_timeout TO '60s'. 단순 ALTER, trade-off 0.
--   wave 981/986 동일 패턴.

ALTER FUNCTION public.claim_mvp_lifecycle_checks(integer, integer, text, integer, integer) SET statement_timeout TO '60s';
ALTER FUNCTION public.claim_mvp_terminal_lifecycle_rechecks(integer, integer) SET statement_timeout TO '60s';
