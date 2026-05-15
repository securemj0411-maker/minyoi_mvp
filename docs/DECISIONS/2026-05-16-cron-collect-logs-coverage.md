# 2026-05-16 — Cron route 4개 collect-logs 박기 (watchdog 추적 정확화)

## 트리거
Iteration 3 DB 무결성 검토 중 발견:
- `mvp_reference_prices` 48 row 정상 박혀있음 (5/15 21:39 KST 1회 run됨).
- 그런데 `mvp_collect_runs`에 reference-price-refresh 호출 기록 **0건**.
- → route가 collect-logs 미사용 → watchdog 추적 불가능 → false positive.

## 진단
`grep startCollectRun src/app/api/cron/*/route.ts`로 전체 cron route 확인:

| Route | collect-logs | watchdog target | 비고 |
|---|---|---|---|
| collect | ✓ | (다른 cron 흡수) | OK |
| deep-crawl | ✓ | ✓ | OK |
| detail-worker | ✓ | ✓ | OK |
| housekeeper | ✓ | ✓ | OK |
| lifecycle-worker | ✓ | ✓ | OK |
| market-worker | ✓ | ✓ | OK |
| pool-warmer | ✓ | ✓ | OK |
| tick | ✓ | ✓ | OK |
| hotdeal-worker | ✗ | (다른 cron 흡수) | 추적 X (의도) |
| **compliance-retention** | **✗** | ✓ | **🚨 watchdog blind** |
| **housekeeper-ai-cache-prune** | **✗** | ✓ | **🚨 watchdog blind** |
| **landing-showcases** | **✗** | ✓ | **🚨 watchdog blind** |
| **reference-price-refresh** | **✗** | ✓ | **🚨 watchdog blind** (DB 증거로 정상 작동 확인) |

## Fix

### 1. `src/lib/collect-logs.ts` — 공통 helper 2개 추가
- `buildCronRequestMeta(req, authOk, authReason, mode)`: NextRequest → CollectRunRequestMeta (housekeeper 패턴 압축).
- `finishCollectRunMinimal(id, startedAt, partial, stageStats)`: PipelineResult 13개 필드 중 작업과 무관한 건 0으로 채우는 wrapper.

### 2. 4개 cron route patch (동일 패턴)
```typescript
const meta = buildCronRequestMeta(req, authOk, authReason, "<mode-name>");
const run = await startCollectRun(meta);
try {
  // ... 작업
  await finishCollectRunMinimal(run.id, run.startedAt, { upserted: count }, { mode, ... });
} catch (err) {
  await failCollectRun(run.id, run.startedAt, err);
}
```

영향받는 파일:
- `src/app/api/cron/landing-showcases/route.ts`
- `src/app/api/cron/housekeeper-ai-cache-prune/route.ts`
- `src/app/api/cron/compliance-retention/route.ts`
- `src/app/api/cron/reference-price-refresh/route.ts`

## 검증
- TypeScript: validator.ts(`/plans` dev cache) 외 무에러.
- ESLint: 5 파일 무에러.
- watchdog (직전 commit `884b142`)이 이미 prefix matching이라 새 row가 박히면 자동으로 잡힘.

## 영향
- **즉시**: 다음 cron 호출부터 `mvp_collect_runs`에 row 박힘 → watchdog false positive 정지.
- **운영 관측**: `/admin` 또는 `loadCollectRuns` 호출 시 이 4개 worker도 표시됨 (이전엔 안 보였음).

## 보류 / 다음
- 사용자 QStash 등록 여부는 별개로 확인 필요 (이 fix는 "route가 호출되면 박힌다" 까지만 해결. 호출 자체가 안 오면 여전히 alert 발동 — 정상).
- hotdeal-worker는 watchdog 추적 안 함 (다른 cron 흡수 의도) → collect-logs 미박 그대로 유지.
