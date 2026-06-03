-- Wave 1031 (2026-06-04): market invalidation stale-lane claim support.
-- The market worker now claims a small oldest-pending lane alongside the
-- priority lane, so low-priority keys cannot starve behind fresh high-priority
-- invalidations. Keep that oldest-pending read index-backed.

create index concurrently if not exists mvp_market_key_invalidation_pending_oldest_idx
  on public.mvp_market_key_invalidation(last_event_at asc)
  where status = 'pending';
