# Wave 252.B — v3 매물 강제 rematch 사용자 보고 (agent 자율 X)

- date: 2026-05-20
- status: REPORT ONLY — apply 안 함, 사용자 결정 대기
- type: 측정 + 옵션 분석. UPDATE 없음.

## 사용자 명시 정책

> **agent 박지 마. 사용자 결정 보고만.**
> 1회성 SQL — 약 12,000건 reparse — cron 부하 검토 필요.
> 사용자 정책 (memory destructive_actions_require_explicit_confirm) — UPDATE 사전 명시 + 확인 필요.

## production 측정 (2026-05-20)

### v3 parser_version 매물 분포

| parser_version | category | pid_count | active | detail_done |
|---|---|---:|---:|---:|
| wave216-clothing-v3 | clothing | **2,392** | 2,336 | 1,883 |
| wave92-fashion-mobility-v3 | shoe | **9,419** | 9,095 | 5,143 |
| wave92-fashion-mobility-v3 | bag | **1,306** | 1,239 | 962 |
| wave92-fashion-mobility-v3 | bike | 9 | 9 | 9 |
| **총합** | | **13,126** | 12,679 | 7,997 |

(사용자 추정: clothing 1,541 / bag 1,311 / shoe 9,455 = 12,307 — 거의 일치, 실제 약간 더 많음. 사용자 측정 시점이 좀 더 옛이라 약간 차이.)

### detail-worker 처리 속도 (지난 24h)

- 시간당 평균: **약 350 row/h** (74 ~ 678 spike).
- 24h 총: 약 8,348 row.
- 현재 detail_status='pending' backlog: **12,063 건**.

### Wave 252.B 부하 추정

**옵션 1: 즉시 12,679 active 강제 rematch (한 번에)**
- 기존 backlog 12k + 새 12.7k = 약 25k pending.
- detail-worker 350 row/h → **72시간 (3일)** 처리.
- 위험: 3일간 시세 stale + 새 매물 분석 지연. Wave 252.A band-aware fallback 가 이미 admin-pool-browser 정합 — 시세 stale 영향은 사용자 카드 화면 (이미 marketBasis live) 보다 admin 검증 측에 한정.

**옵션 2: 분할 trigger (1,000건/h × 13 = 13시간)**
- Wave 252.C helper 의 batchSize + caller 가 chunk 호출.
- 매시간 detail-worker capacity 절반 (175 row/h 추가) 정도로 분산.
- detail-worker 처리 capacity 부족 → 실질 효과 옵션 1 과 비슷 (worker 가 bottleneck).

**옵션 3: 단계별 (가장 안전, 권장)**
- step 1: **clothing v3 (2,392)** 만 먼저 (가장 영향 큼 — Wave 236 v7 product_type 분리 효과 큼).
  - detail-worker 7시간 처리.
  - 사용자 화면 (BAPE/Stussy/RRL/Patagonia) 정합 확보.
- step 2: 1주일 후 effect 측정 → bag v3 (1,306) 추가.
- step 3: 2주 후 shoe v3 (9,419) 추가 (가장 많음 + Wave 92 가장 옛).

### 영향 매물 검증 SQL (사용자 직접 확인용)

```sql
-- 옵션 1 영향 매물 (전체):
SELECT pid FROM mvp_listing_parsed
WHERE parser_version IN ('wave216-clothing-v3', 'wave92-fashion-mobility-v3');

-- 옵션 3 step 1 (clothing v3만):
SELECT COUNT(*) FROM mvp_listing_parsed WHERE parser_version = 'wave216-clothing-v3';
-- → 2,392 (1,883 detail_done, 509 still pending)
```

## 권장 — 사용자 결정 필요

### A. 옵션 선택

- [ ] 옵션 1: 즉시 12.7k 전체 (3일 stale + 빠른 정합)
- [ ] 옵션 2: 분할 trigger (실효성 낮음, 권장 X)
- [x] **옵션 3 step 1: clothing v3 2,392 먼저** (가장 ROI 높음, 위험 낮음)

### B. apply 방법

```typescript
// Wave 252.C helper 사용 (이미 deploy 됨):
import { triggerRematchForParserVersions } from "@/lib/rematch-helpers";

// step 1: dry-run 측정 (사용자 confirm 받기 전 검증).
const measure = await triggerRematchForParserVersions(
  ['wave216-clothing-v3'],
  'wave252-b-step1-clothing',
  { dryRun: true },
);
console.log(measure); // { count: ~2400, samplePids: [...] }

// step 2: 사용자 explicit confirm 후 apply.
const apply = await triggerRematchForParserVersions(
  ['wave216-clothing-v3'],
  'wave252-b-step1-clothing',
  { dryRun: false },
);
```

또는 Supabase MCP 직접 SQL (Wave 251.3 패턴):
```sql
UPDATE mvp_raw_listings 
SET score_dirty = true, detail_status = 'pending'
WHERE pid IN (
  SELECT pid FROM mvp_listing_parsed 
  WHERE parser_version = 'wave216-clothing-v3'
)
AND listing_state = 'active';
-- 영향: ~2,336 row (active clothing v3).
```

### C. 모니터링 (apply 후)

```sql
-- 24h 후 효과 측정:
SELECT 
  COUNT(*) AS clothing_v3_remaining
FROM mvp_listing_parsed 
WHERE parser_version = 'wave216-clothing-v3';

-- pending backlog 감소 확인:
SELECT detail_status, COUNT(*) FROM mvp_raw_listings GROUP BY detail_status;
```

## 사용자 정책 준수

- agent 자율 apply X — 본 wave 는 측정 + 옵션 보고만 ✓
- destructive_actions_require_explicit_confirm — SQL UPDATE 사전 명시 + 확인 절차 명시 ✓
- decision log 필수 — 본 문서 ✓
- 미뇨이 PITR 미박힘 → 시점 복원 불가, additive 만 (detail_status reset 은 비파괴 — Wave 251.3 검증 패턴) ✓

## 후속

사용자가 옵션 선택 후 별도 wave (예: Wave 252.B.1) 로 실제 trigger 호출.
