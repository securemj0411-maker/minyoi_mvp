-- Wave 714 (2026-05-23): 신발/의류 5-tier condition grading column.
--
-- 배경: 기존 `condition_class` text NOT NULL default 'normal' 은 전자기기용 grouping key
-- (unopened/mint/clean/normal/worn/low_batt/flawed). 신발/의류 raw 표현 기반 grading
-- (S/A/B/C/D + UNKNOWN) 은 별도 axis — column 분리.
--
-- 출처:
--   - 신발 5-axis cross-tab agent ac955968c16adba21 (n=11,087, 2026-05-23)
--   - 의류 5-axis cross-tab agent a2d7c17a34f40235e (n=11,543, 2026-05-23)
--   - Decision log: mvp/docs/DECISIONS/2026-05-23-wave714-condition-grading-shoe.md
--
-- 영향 분석:
--   - ALTER TABLE ADD COLUMN (NULL 허용, default null) — 기존 row 영향 X (NULL 채워짐)
--   - 기존 query 영향 X (column SELECT 안 하는 query 변화 없음)
--   - CREATE INDEX CONCURRENTLY — 백그라운드 build (production read 차단 X)
--   - parsedJson.condition_grade 에 동일 데이터 박혀 있음 → backfill 별도 wave에서 진행
--
-- Rollback: column DROP 안전 (downstream 코드 nullable read).
-- 단 backfill 진행 후엔 데이터 손실 → drop 전 export 권고.

ALTER TABLE public.mvp_listing_parsed
  ADD COLUMN IF NOT EXISTS condition_tier text NULL,
  ADD COLUMN IF NOT EXISTS condition_cluster text NULL,
  ADD COLUMN IF NOT EXISTS condition_confidence numeric NULL,
  ADD COLUMN IF NOT EXISTS condition_flags jsonb NULL;

COMMENT ON COLUMN public.mvp_listing_parsed.condition_tier IS
  'Wave 714: 신발/의류 5-tier S/A/B/C/D/UNKNOWN. raw 텍스트 기반 grading. 전자기기는 NULL.';

COMMENT ON COLUMN public.mvp_listing_parsed.condition_cluster IS
  'Wave 714: brand cluster. 신발=premium_snk/run_tech/volume_vintage/casual_parts. 의류=premium_archive/volume_vintage_cloth/collab_heavy/casual_mass. cluster-relative pricing 용.';

COMMENT ON COLUMN public.mvp_listing_parsed.condition_confidence IS
  'Wave 714: grading confidence 0~1. <0.4 = UI 신뢰도 낮음 표시. raw description 매칭 수 + length 기반.';

COMMENT ON COLUMN public.mvp_listing_parsed.condition_flags IS
  'Wave 714: 의류 A+ flag (등급 가산 X, multiplier). { tailored, seasonAnchor, collab }.';

-- 시세 query 효율 — (category, condition_tier) composite filter.
-- CONCURRENTLY 는 transaction 안에서 사용 불가 — IF NOT EXISTS + CREATE INDEX 만 (small data 86K rows 라 빠름).
CREATE INDEX IF NOT EXISTS idx_mvp_listing_parsed_condition_tier
  ON public.mvp_listing_parsed (category, condition_tier)
  WHERE condition_tier IS NOT NULL;
