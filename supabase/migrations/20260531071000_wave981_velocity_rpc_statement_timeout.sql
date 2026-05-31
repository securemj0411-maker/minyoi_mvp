-- Wave 981 (2026-05-31): sync_market_velocity_daily RPC statement_timeout 박음.
--   배경: PostgREST default 8s 안 안 끝나 silent fail. velocity_daily 하루 멈춤 (사용자 짚음).
--   fix: function level SET statement_timeout TO '120s'. route maxDuration 90s 안 OK.

ALTER FUNCTION public.sync_market_velocity_daily() SET statement_timeout TO '120s';
