-- Wave 238 (2026-05-19): AI L2 coverage gap + learning loop
-- Option A + 학습 통합. additive only (PITR 미박힘 — destructive 금지).
--
-- Applied to production via Supabase MCP 2026-05-19. Local mirror for repo audit.
--
-- 본 migration:
--   1. mvp_catalog_learning_queue 테이블 신설 — AI verdict reject/hold 매물 적재.
--   2. mvp_candidate_pool.ai_audit_status 컬럼 추가 — shadow audit 결과 박음.
--   3. v_mvp_ai_l2_coverage_daily / v_mvp_ai_l2_cost_daily views.
--
-- Memory 정책 준수:
--   - destructive_actions: additive only (PITR 미박힘)
--   - decision_log_required: docs/DECISIONS/2026-05-19-wave238-ai-l2-coverage-gap-and-learning-loop.md

CREATE TABLE IF NOT EXISTS public.mvp_catalog_learning_queue (
  id BIGSERIAL PRIMARY KEY,
  sku_id TEXT NOT NULL,
  pid BIGINT NOT NULL,
  ai_classification TEXT NOT NULL,
  ai_confidence NUMERIC,
  ai_reason TEXT,
  suggested_must_not_contain TEXT[] DEFAULT ARRAY[]::TEXT[],
  matched_text TEXT,
  frequency_count INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  applied_at TIMESTAMPTZ,
  applied_to_commit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_learning_queue_status CHECK (status IN ('pending','approved','rejected','applied','superseded')),
  CONSTRAINT ck_learning_queue_ai_classification CHECK (ai_classification IN ('reject','hold','pass'))
);

CREATE INDEX IF NOT EXISTS ix_learning_queue_status_freq
  ON public.mvp_catalog_learning_queue(status, frequency_count DESC);

CREATE INDEX IF NOT EXISTS ix_learning_queue_sku
  ON public.mvp_catalog_learning_queue(sku_id);

CREATE INDEX IF NOT EXISTS ix_learning_queue_pid
  ON public.mvp_catalog_learning_queue(pid);

CREATE INDEX IF NOT EXISTS ix_learning_queue_created
  ON public.mvp_catalog_learning_queue(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_queue_sku_matched_text
  ON public.mvp_catalog_learning_queue(sku_id, COALESCE(matched_text, ''));

CREATE OR REPLACE FUNCTION public.set_updated_at_on_learning_queue()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_learning_queue_updated_at ON public.mvp_catalog_learning_queue;
CREATE TRIGGER tg_learning_queue_updated_at
  BEFORE UPDATE ON public.mvp_catalog_learning_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_on_learning_queue();

ALTER TABLE public.mvp_candidate_pool
  ADD COLUMN IF NOT EXISTS ai_audit_status TEXT;

ALTER TABLE public.mvp_candidate_pool
  ADD COLUMN IF NOT EXISTS ai_audit_at TIMESTAMPTZ;

ALTER TABLE public.mvp_candidate_pool
  ADD COLUMN IF NOT EXISTS ai_audit_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_candidate_pool_ai_audit_status'
  ) THEN
    ALTER TABLE public.mvp_candidate_pool
      ADD CONSTRAINT ck_candidate_pool_ai_audit_status
      CHECK (ai_audit_status IS NULL OR ai_audit_status IN ('pending','pass','hold','reject','skipped_cap','skipped_unavailable'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_candidate_pool_ai_audit_status
  ON public.mvp_candidate_pool(ai_audit_status, last_verified_at DESC)
  WHERE ai_audit_status IS NOT NULL;

-- Frequency increment RPC (called by ai-l2-learning-queue.ts).
CREATE OR REPLACE FUNCTION public.increment_learning_queue_frequency(
  p_sku_id TEXT,
  p_matched_text TEXT
) RETURNS INT AS $$
DECLARE
  new_count INT;
BEGIN
  UPDATE public.mvp_catalog_learning_queue
  SET frequency_count = frequency_count + 1,
      updated_at = now()
  WHERE sku_id = p_sku_id
    AND COALESCE(matched_text, '') = COALESCE(p_matched_text, '')
    AND status = 'pending'
  RETURNING frequency_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.increment_learning_queue_frequency(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_learning_queue_frequency(TEXT, TEXT) TO authenticated, service_role;

-- AI L2 daily coverage view — wave238 측정 (baseline 91.1% → 6m 10% 목표).
CREATE OR REPLACE VIEW public.v_mvp_ai_l2_coverage_daily AS
WITH pool_day AS (
  SELECT
    date_trunc('day', last_verified_at) AS day,
    category,
    pid
  FROM public.mvp_candidate_pool
  WHERE status = 'ready'
    AND last_verified_at > now() - interval '30 days'
),
ai_day AS (
  SELECT DISTINCT date_trunc('day', p.last_verified_at) AS day, c.pid
  FROM public.mvp_candidate_pool p
  JOIN public.mvp_listing_ai_classifications c ON c.pid = p.pid
  WHERE p.status = 'ready'
    AND p.last_verified_at > now() - interval '30 days'
)
SELECT
  p.day,
  p.category,
  count(*) AS total_ready,
  count(a.pid) AS ai_seen,
  round(100.0 * count(a.pid) / NULLIF(count(*), 0), 1) AS ai_seen_pct
FROM pool_day p
LEFT JOIN ai_day a ON a.day = p.day AND a.pid = p.pid
GROUP BY p.day, p.category
ORDER BY p.day DESC, total_ready DESC;

CREATE OR REPLACE VIEW public.v_mvp_ai_l2_cost_daily AS
SELECT
  date_trunc('day', classified_at) AS day,
  model,
  count(*) AS calls,
  sum(input_tokens) AS input_tokens,
  sum(output_tokens) AS output_tokens,
  round(sum(cost_usd)::numeric, 4) AS cost_usd
FROM public.mvp_listing_ai_classifications
WHERE classified_at > now() - interval '30 days'
GROUP BY day, model
ORDER BY day DESC, calls DESC;

CREATE OR REPLACE VIEW public.v_mvp_ai_l2_coverage_monthly AS
WITH pool_month AS (
  SELECT
    date_trunc('month', last_verified_at) AS month,
    category,
    pid
  FROM public.mvp_candidate_pool
  WHERE status = 'ready'
    AND last_verified_at > now() - interval '12 months'
),
ai_month AS (
  SELECT DISTINCT date_trunc('month', p.last_verified_at) AS month, c.pid
  FROM public.mvp_candidate_pool p
  JOIN public.mvp_listing_ai_classifications c ON c.pid = p.pid
  WHERE p.status = 'ready'
    AND p.last_verified_at > now() - interval '12 months'
)
SELECT
  p.month,
  p.category,
  count(*) AS total_ready,
  count(a.pid) AS ai_seen,
  round(100.0 * count(a.pid) / NULLIF(count(*), 0), 1) AS ai_seen_pct
FROM pool_month p
LEFT JOIN ai_month a ON a.month = p.month AND a.pid = p.pid
GROUP BY p.month, p.category
ORDER BY p.month DESC, total_ready DESC;

CREATE OR REPLACE VIEW public.v_mvp_ai_l2_cache_hit_rate AS
WITH hash_counts AS (
  SELECT content_hash, count(*) AS hit_count
  FROM public.mvp_listing_ai_classifications
  WHERE classified_at > now() - interval '30 days'
    AND content_hash IS NOT NULL
  GROUP BY content_hash
)
SELECT
  count(*) AS unique_hashes,
  sum(hit_count) AS total_classifications,
  sum(CASE WHEN hit_count > 1 THEN hit_count - 1 ELSE 0 END) AS cache_hits,
  round(
    100.0 * sum(CASE WHEN hit_count > 1 THEN hit_count - 1 ELSE 0 END)
    / NULLIF(sum(hit_count), 0),
    2
  ) AS cache_hit_rate_pct
FROM hash_counts;

CREATE OR REPLACE VIEW public.v_mvp_catalog_learning_queue_summary AS
SELECT
  sku_id,
  status,
  count(*) AS pattern_count,
  sum(frequency_count) AS total_frequency,
  max(frequency_count) AS max_frequency,
  min(created_at) AS first_seen,
  max(updated_at) AS last_seen
FROM public.mvp_catalog_learning_queue
GROUP BY sku_id, status
ORDER BY total_frequency DESC, max_frequency DESC;

CREATE OR REPLACE VIEW public.v_mvp_candidate_pool_audit_status AS
SELECT
  category,
  COALESCE(ai_audit_status, 'unaudited') AS audit_status,
  count(*) AS row_count,
  round(
    100.0 * count(*) / sum(count(*)) OVER (PARTITION BY category),
    1
  ) AS pct_in_category
FROM public.mvp_candidate_pool
WHERE status = 'ready'
  AND last_verified_at > now() - interval '7 days'
GROUP BY category, ai_audit_status
ORDER BY category, row_count DESC;

COMMENT ON TABLE public.mvp_catalog_learning_queue IS
  'Wave 238 (2026-05-19) — AI L2 verdict reject/hold 매물 적재. Admin 매주 review → catalog mustNotContain patch. iPad/tech 패턴: AI=학습 catalyst, catalog=source-of-truth.';

COMMENT ON COLUMN public.mvp_candidate_pool.ai_audit_status IS
  'Wave 238 — Option A shadow audit 결과. NULL=AI 미검증, pending/pass/hold/reject/skipped_*. Phase 1=shadow only (status=ready 유지), Phase 2 별도 wave 에서 차단 활성화.';
