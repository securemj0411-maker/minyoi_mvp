-- Wave 502 — Joongna search/detail queue split
-- Additive only. Allows Joongna search discovery to persist product URLs before
-- detail fetching, so a route timeout does not lose discovered work.

CREATE TABLE IF NOT EXISTS public.mvp_joongna_detail_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_url TEXT NOT NULL,
  external_id TEXT,
  source_query TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  last_error TEXT,
  last_fetched_at TIMESTAMPTZ,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_mvp_joongna_detail_queue_status
    CHECK (status IN ('pending','processing','done','failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS mvp_joongna_detail_queue_product_url_key
  ON public.mvp_joongna_detail_queue(product_url);

CREATE INDEX IF NOT EXISTS mvp_joongna_detail_queue_claim_idx
  ON public.mvp_joongna_detail_queue(status, priority DESC, available_at ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS mvp_joongna_detail_queue_locked_until_idx
  ON public.mvp_joongna_detail_queue(locked_until);

CREATE INDEX IF NOT EXISTS mvp_joongna_detail_queue_external_id_idx
  ON public.mvp_joongna_detail_queue(external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE public.mvp_joongna_detail_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mvp_joongna_detail_queue FROM anon;
REVOKE ALL ON public.mvp_joongna_detail_queue FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mvp_joongna_detail_queue TO service_role;

CREATE OR REPLACE FUNCTION public.claim_mvp_joongna_detail_queue(
  p_batch_size INTEGER DEFAULT 30,
  p_lease_seconds INTEGER DEFAULT 90
)
RETURNS TABLE (
  queue_id UUID,
  product_url TEXT,
  external_id TEXT,
  source_query TEXT,
  attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
    FROM public.mvp_joongna_detail_queue q
    WHERE (
      q.status = 'pending'
      OR (q.status = 'processing' AND q.locked_until < now())
      OR (q.status = 'failed' AND q.attempts < q.max_attempts AND q.available_at <= now())
    )
    ORDER BY q.priority DESC, q.available_at ASC, q.created_at ASC
    LIMIT greatest(1, least(coalesce(p_batch_size, 30), 200))
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.mvp_joongna_detail_queue q
    SET status = 'processing',
        attempts = q.attempts + 1,
        locked_at = now(),
        locked_until = now() + (greatest(10, least(coalesce(p_lease_seconds, 90), 900)) || ' seconds')::interval,
        updated_at = now(),
        last_error = NULL
    FROM candidates c
    WHERE q.id = c.id
    RETURNING q.id, q.product_url, q.external_id, q.source_query, q.attempts
  )
  SELECT c.id AS queue_id,
         c.product_url,
         c.external_id,
         c.source_query,
         c.attempts
  FROM claimed c;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_mvp_joongna_detail_queue(INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_mvp_joongna_detail_queue(INTEGER, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_mvp_joongna_detail_queue(INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mvp_joongna_detail_queue(INTEGER, INTEGER) TO service_role;
