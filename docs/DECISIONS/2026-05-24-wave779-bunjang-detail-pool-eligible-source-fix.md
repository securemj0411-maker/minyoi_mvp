# Wave 779 — bunjang detail-worker pool_eligible source-level fix

**날짜**: 2026-05-24
**Wave**: 779 (Wave 778 RPC backfill 의 root cause source fix)

## 발견 root

Wave 778 RPC backfill 이 20,969건 박은 root cause:
- `joongna-ingest.ts:897` 은 `pool_eligible: true` 박음 ✓
- `tick-pipeline.ts:1831` (bunjang detail-worker 완료 patch) **누락** ✗

→ bunjang 매물 detail=done + normal 분류 + sku 매칭 까지 다 끝났는데도
   `pool_eligible` 컬럼이 DB default (false/NULL) 그대로 유지.
→ candidate-pool-builder gate 통과 못 함 → 영원히 stuck.

Wave 778 RPC 는 이미 stuck 된 매물 cron 마다 fix 하는 safety net.
Wave 779 는 **신규 매물 처음부터 안 stuck 되게** source fix.

## Fix

`src/lib/tick-pipeline.ts:1831` detail-worker 완료 patch 에 추가:

```typescript
// Wave 778: bunjang detail 완료 + normal 분류 + sku 매칭 → pool_eligible 즉시 true.
...(storageListingType === "normal" && sku?.id ? { pool_eligible: true } : {}),
```

### 조건

- `storageListingType === "normal"`: multi/accessory/...는 제외
- `sku?.id`: catalog 매칭된 매물만 (unknown_brand 등 noise 차단)

### 안전성

- non-normal 시 아래 line 1869 `invalidatePoolEntries` 가 candidate_pool 에서 제거 → pool_eligible 박혀있어도 무해
- sold path (line 1755 별도 patch) 는 pool_eligible 박지 않음 → 안전
- additive only (false → true 만, true → false 없음)

## 효과

- 신규 bunjang 매물: detail 완료 즉시 pool_eligible=true (Wave 778 RPC 의존 불필요)
- Wave 778 RPC: 잔여 backfill 만 처리 (drift 감소 — 매 cron 5분 0건 reported 예상)
- "bunjang ingest 누락" 본질 해소

## 검증

다음 cron 부터:
- Wave 778 RPC `flagged N` log → N 점차 감소
- bunjang detail-worker 통과 매물 pool 진입 시간 < 5분 (이전: 영원히 stuck)

## 누적 (Wave 771-779)

| Wave | 내용 |
|---|---|
| 771-773 | AI hold + game/golf pool_eligible manual fix |
| 774-777 | sport_golf 5 axes 추출 (loft/shaft/sex/iron_set/generation) |
| 778 | systemic safety net RPC + cron hook (20,969 backfill) |
| **779** | **source-level fix — bunjang detail-worker 직접 박기** |

= bunjang/joongna ingest pool_eligible parity 완성.
