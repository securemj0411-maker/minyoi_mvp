# Wave 781-782 — eligible→pool 변환 누락 systemic fix

**날짜**: 2026-05-24
**Wave**: 781 (진단) + 782 (RPC 확장)

## 발견

Wave 778-780 pool_eligible fix 후 측정:

| Category | eligible | ready_in_pool | 손실율 |
|---|---|---|---|
| sport_golf | 1,243 | 0 | 100% |
| game_console | 908 | 2 | 99.8% |

= **2,151건 eligible 인데 풀 진입 0~소수**. 두 번째 stage gate 실패.

## Root cause (2단)

### 1. mvp_category_readiness.status='internal_only'

```sql
SELECT category, status FROM mvp_category_readiness 
WHERE category IN ('sport_golf','game_console');
→ sport_golf: internal_only
→ game_console: internal_only
```

→ Wave 778 RPC `WHERE c.status='ready'` 가 **이들 카테고리 자체를 skip**.
→ pool_eligible flag 자체가 안 박힘 (Wave 778 backfill 누락).

But! `LANE_READINESS` 는 sport_golf_*/switch_game_*/ps5_* 등 lane 별로 `ready`.
candidate-pool-builder `evaluatePoolGate` 는 lane 우선 → category=internal_only 도 lane=ready 면 통과.

→ Wave 778 RPC 가 너무 좁게 filter. **internal_only 카테고리도 포함해야 함**.

### 2. score_dirty=false 정체

885 sport_golf 매물 pool_eligible=true 이지만 score_dirty=false.
= 이전에 한 번 scored 되었지만 candidate_pool entry 생성 못 했고, 그 후 limbo.

원인 추정: Wave 772 manual SQL 이 pool_eligible 만 박았고 score_dirty=true 동시 박지 못한 시점에서 처리됨. 또는 score-worker batch 한도 도달.

→ 한 번 score_dirty 안 박힌 매물은 score-worker 가 다시 안 뽑음 → 영원히 limbo.

## Fix

### Wave 781 immediate (manual SQL)

```sql
UPDATE mvp_raw_listings r
SET score_dirty = true, updated_at = NOW()
FROM (
  SELECT r.pid
  FROM mvp_raw_listings r
  JOIN mvp_listing_parsed p ON p.pid = r.pid
  LEFT JOIN mvp_candidate_pool cp ON cp.pid = r.pid
  WHERE p.category IN ('sport_golf', 'game_console')
    AND r.detail_status = 'done' AND r.listing_state = 'active' AND r.listing_type = 'normal'
    AND r.pool_eligible = true
    AND (r.num_comment IS NULL OR r.num_comment < 8) AND (r.qty IS NULL OR r.qty <= 1)
    AND r.score_dirty IS DISTINCT FROM true
    AND cp.pid IS NULL
) s WHERE r.pid = s.pid;
→ game_console: 871 / sport_golf: 1,217 = 2,088건 재 dirty.
```

### Wave 782 systemic (RPC 확장)

```sql
-- 변경: c.status IN ('ready', 'internal_only')
-- internal_only 도 포함 — downstream evaluatePoolGate 가 lane 별 정밀 gate
CREATE OR REPLACE FUNCTION public.ensure_pool_eligible_for_ready_categories() ...
WHERE c.status IN ('ready', 'internal_only')
  AND ... pool_eligible IS DISTINCT FROM true
```

migration: `wave782_ensure_pool_eligible_include_internal_only` (applied).
첫 실행: **715건 추가 flag** (Wave 778 첫 backfill 후 internal_only 카테고리 누락분).

## 안전성

- blocked 카테고리 skip (admin 명시 차단 존중)
- NULL category status skip (안전 보수)
- num_comment>=8 / qty>1 skip (pack-open 존중)
- additive only (false → true)
- downstream `evaluatePoolGate` (LANE_READINESS map) 가 lane 별 lane_blocked_* 차단

## 효과

다음 score-worker cycle 후 예상:
- sport_golf candidate_pool ready entry: 0 → 수십~수백건
- game_console: 2 → 수백건

(downstream 추가 gate: num_comment, qty, low_volume_sku, ad_pattern, fake_suspect, lane_blocked, negative_resell_gap 등에서 추가 invalidate 가능)

## 누적 (Wave 771-782)

| Wave | 내용 |
|---|---|
| 771-773 | AI hold + game/golf pool_eligible manual fix |
| 774-777 | sport_golf 5 axes 추출 |
| 778-780 | pool_eligible RPC + cron + source fix + 정밀화 (3-layer) |
| **781-782** | **eligible→pool 두 번째 stage gate fix (lane-ready 포함 + limbo 해소)** |

= bunjang ingest → detail done → pool_eligible → score_dirty → score-worker → candidate_pool 까지 6-stage pipeline 전부 fix.
