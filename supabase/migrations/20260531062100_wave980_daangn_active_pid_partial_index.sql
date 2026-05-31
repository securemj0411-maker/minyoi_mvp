-- Wave 980 partial index for backfill NOT EXISTS efficiency
CREATE INDEX IF NOT EXISTS mvp_raw_listings_daangn_active_pid_idx
ON public.mvp_raw_listings (pid)
WHERE source = 'daangn' AND listing_state = 'active';
