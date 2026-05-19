# Wave 252.C — Rematch trigger helper 자동화 (미래 보장)

- date: 2026-05-20
- status: applied
- type: additive infrastructure — 새 helper 모듈 + unit tests, DB 변경 X
- branch: fix/market-chart-honesty-2026-05-19 → push origin/main

## 배경

사용자 명시 root cause 3 의 fix:

> Wave 248/251 fix 후 영향 매물 자동 invalidate 안 됨
> 매번 SQL UPDATE 수동 (Wave 251.3 의 29건)

Wave 251.3 의 standard rematch trigger pattern (UPDATE detail_status='pending')
을 helper 모듈로 추출 → 다음 wave 부터 catalog/policy 변경 직후 자동 trigger.

## 구현

### `src/lib/rematch-helpers.ts` (신설)

3 helper:

1. **`triggerRematchForSkus(skuIds, reason, opts)`** — sku_id 집합 매물 reset.
   - 사용 시점: catalog mustNotContain 추가, narrow SKU split.
   - 예시: `await triggerRematchForSkus(['clothing-bape-tee'], 'wave252-collab')`.

2. **`triggerRematchForListings(pids, reason, opts)`** — pid 집합 reset.
   - 사용 시점: SQL audit / shadow audit alert.
   - batchSize 단위 분할 PATCH (PostgREST URL limit 회피).

3. **`triggerRematchForParserVersions(versions, reason, opts)`** — parser_version 집합.
   - 사용 시점: parser bump, Wave 252.B 의 v3 12k 강제 rematch.
   - 내부적으로 by_pid delegate.

### 안전장치

- **default `dryRun: true`** — 사용자 정책 (memory destructive_actions_require_explicit_confirm)
  준수. caller 가 명시적 `dryRun: false` 선언해야 실제 UPDATE.
- **additive only** — `detail_status` (Wave 251.3 패턴) + `score_dirty` 만 set.
  raw_json / name / price / sku_id 등 보존.
- **audit log** — console.log JSON (type, reason, count, samplePids, triggeredAt).
- **batch 분할** — PostgREST URL 길이 제한 회피.

## test:core 결과

`tests/wave252-c-rematch-helpers.test.ts` — 8 tests pass:

- `dryRun=true` default → PATCH 호출 X (count + sample 만).
- `dryRun=false` → PATCH 호출 detail_status + score_dirty set.
- `resetDetailStatus=false` → score_dirty 만 set.
- listing-based batch 분할 (5 pids / batchSize 2 → 3 PATCH).
- empty skuIds / pids → no-op (호출 0).
- parser_version dry-run → mvp_listing_parsed count 만 fetch.

전체 test:core 회귀: pre-existing 9 fails 그대로 (UI contract, 본 wave 무관).

## 사용자 정책 준수

- 비파괴 / additive only ✓
- decision log 필수 (memory feedback_decision_log_required) ✓
- destructive_actions_require_explicit_confirm — default dryRun=true ✓
- test:core 회귀 검증 ✓

## 후속 사용 예시 (다음 wave 부터)

```typescript
// wave 253 (가정) — catalog 새 mustNotContain 박기 직후:
import { triggerRematchForSkus } from "@/lib/rematch-helpers";

// step 1: dry-run 으로 영향 매물 측정 + 사용자 보고.
const measure = await triggerRematchForSkus(
  ["clothing-some-broad-sku"],
  "wave253-rematch-new-block",
  { dryRun: true },
);
console.log(`영향 매물: ${measure.count}건, sample: ${measure.samplePids}`);

// step 2: 사용자 confirm 후 실제 apply.
const apply = await triggerRematchForSkus(
  ["clothing-some-broad-sku"],
  "wave253-rematch-new-block",
  { dryRun: false },
);
```

## Wave 252.B 활용

```typescript
// v3 매물 12k 측정 (사용자 결정 도구).
const v3Count = await triggerRematchForParserVersions(
  ["wave216-clothing-v3", "wave92-fashion-mobility-v3"],
  "wave252-b-measure",
  { dryRun: true },
);
// → { count: ~12000, samplePids: [...], dryRun: true }
```

사용자 결정 후 chunk 분할 trigger:
```typescript
// 사용자 confirm 후, 분할 호출 (1k batch × 12) — cron 부하 분산.
// 한 번에 12k 대신 caller 가 chunk 호출 책임.
```

## 관련

- Wave 251.3 의 SQL UPDATE 패턴 → helper 의 reference 구현.
- Wave 252.A — band-aware median fetch (admin-pool-browser).
- Wave 252.B — pending (사용자 결정 보고).
