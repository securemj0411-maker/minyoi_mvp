-- Wave 1017: speed up cron-run lookups by route.
-- Watchdog/operator checks commonly filter by request_path and recent
-- started_at. The table only had started_at/status indexes, so route-scoped
-- lookups could still scan too much history.

create index concurrently if not exists mvp_collect_runs_request_path_started_idx
  on public.mvp_collect_runs (request_path, started_at desc);
