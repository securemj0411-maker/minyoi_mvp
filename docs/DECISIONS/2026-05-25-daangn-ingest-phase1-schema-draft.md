# Daangn Ingest Phase 3 — Schema Migration Draft

**날짜**: 2026-05-25
**Wave**: daangn-ingest Phase 3 (Phase 1=skeleton 완료, Phase 2=rate limit test 완료)
**상태**: **DRAFT — 사용자 confirm 후 apply**

## 변경 범위 (additive only — 기존 데이터 영향 X)

### 1. `mvp_raw_listings` 컬럼 추가

```sql
ALTER TABLE mvp_raw_listings
  ADD COLUMN IF NOT EXISTS daangn_region_id text,
  ADD COLUMN IF NOT EXISTS daangn_region_name text,
  ADD COLUMN IF NOT EXISTS daangn_boosted_at timestamptz,
  ADD COLUMN IF NOT EXISTS daangn_web_crawl_allowed boolean,
  ADD COLUMN IF NOT EXISTS daangn_shipping_inferred text;

-- 검증 helper: shipping_inferred CHECK constraint
ALTER TABLE mvp_raw_listings
  ADD CONSTRAINT mvp_raw_listings_daangn_shipping_inferred_check
  CHECK (daangn_shipping_inferred IS NULL OR
         daangn_shipping_inferred IN ('shipping_possible','direct_only','unknown'));

-- 인덱스 (당근 매물만 한정 partial index)
CREATE INDEX IF NOT EXISTS idx_mvp_raw_listings_daangn_boosted
  ON mvp_raw_listings (daangn_boosted_at DESC)
  WHERE source = 'daangn';

CREATE INDEX IF NOT EXISTS idx_mvp_raw_listings_daangn_region
  ON mvp_raw_listings (daangn_region_id)
  WHERE source = 'daangn';
```

### 2. `mvp_source_health` 에 'daangn' row 추가

```sql
INSERT INTO mvp_source_health (source, status, checked_at, baseline_json, reason)
VALUES (
  'daangn',
  'healthy',
  NOW(),
  jsonb_build_object(
    'mode', 'probe',
    'description', 'Daangn source onboarding (Phase 1 shadow)',
    'rate_limit_test', jsonb_build_object(
      'delay_ms', 600,
      'combos_per_cron', 12,
      'detail_samples_per_cron', 8,
      'block_rate', 0
    )
  ),
  'within_operating_bounds'
)
ON CONFLICT (source) DO NOTHING;  -- 이미 있으면 skip
```

### 3. `mvp_daangn_detail_queue` 신규 (선택 — Phase 5 까지 미루어도 됨)

joongna 패턴 모방. Phase 1 (Shadow) 까진 in-memory 처리도 가능. queue 는 scale 늘리면서 필요.

```sql
CREATE TABLE IF NOT EXISTS mvp_daangn_detail_queue (
  queue_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL,
  product_url text NOT NULL,
  region_id text,
  region_name text,
  search_query text,
  category_id integer,
  enqueued_at timestamptz DEFAULT NOW(),
  claimed_at timestamptz,
  claimed_by text,
  attempts integer DEFAULT 0,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','claimed','done','failed','released')),
  last_error text,
  done_at timestamptz,
  UNIQUE (external_id)
);

CREATE INDEX IF NOT EXISTS idx_mvp_daangn_detail_queue_pending
  ON mvp_daangn_detail_queue (enqueued_at)
  WHERE status = 'pending';
```

## Rollback Plan (위험 시)

```sql
-- 컬럼 제거 (모든 raw_listings 의 daangn_* 데이터 손실)
ALTER TABLE mvp_raw_listings
  DROP COLUMN IF EXISTS daangn_region_id,
  DROP COLUMN IF EXISTS daangn_region_name,
  DROP COLUMN IF EXISTS daangn_boosted_at,
  DROP COLUMN IF EXISTS daangn_web_crawl_allowed,
  DROP COLUMN IF EXISTS daangn_shipping_inferred;

-- source_health row 제거
DELETE FROM mvp_source_health WHERE source = 'daangn';

-- queue table 제거
DROP TABLE IF EXISTS mvp_daangn_detail_queue;
```

## 안전성 평가

| 측면 | 평가 | 근거 |
|---|---|---|
| 기존 데이터 영향 | ✅ 없음 | `ADD COLUMN IF NOT EXISTS` (additive) |
| 기존 query 영향 | ✅ 없음 | 새 컬럼은 기존 코드 모름 (NULL default) |
| 기존 cron 영향 | ✅ 없음 | source='bunjang'/'joongna' 분기 그대로 |
| 인덱스 부하 | ✅ 작음 | partial index (source='daangn' 만), 현재 0건 |
| score-worker 사고 영향 | ✅ 무관 | 당근 데이터 없으니 score 영향 X |
| Rollback | ✅ 가능 | 데이터 손실 가능 but 컬럼만 |

## 실행 순서

1. ✅ Migration draft 작성 (이번 turn)
2. ⏸ **사용자 confirm 대기**
3. ⏳ Supabase MCP `apply_migration` 으로 적용
4. ⏳ 검증 SQL (컬럼 존재, source_health row 확인)
5. ⏳ daangn-ingest.ts dryRun=false 활성화 (다음 phase)

## 다음 Phase 미리보기

**Phase 4 — Cron Route**:
- `src/app/api/cron/daangn-worker/route.ts`
- vercel.json `*/5 * * * *` 추가
- DB lock (daangn_worker)

**Phase 5 — DB Write 활성화**:
- daangn-ingest.ts 의 `// TODO Phase 1: schema migration 후 활성화` 채우기
- `upsertDaangnRawListings()` 구현
- mode='active' 시 실제 write

**Phase 6 — Source 분기 + UX**:
- tick-pipeline source union 'daangn' 추가
- candidate-pool-builder 당근 gate (shipping_possible 만)
- 매물 카드 3화면 라벨/지역/shipping 표시

## 한 줄 결정

**Migration apply 진행? (additive only, 안전)**
