# 2026-05-16 — detail-worker throughput 5x (lifecycle 패턴 적용)

## 트리거
- detail-worker queue 10,224 pending (Iteration 2 발견).
- lifecycle 5x 효과 측정 결과: 처리량 20 → 170건/run (10배 증가). Bunjang probe 시나리오 A 검증 완료.
- 같은 sequential bottleneck을 detail-worker도 가지고 있어 같은 패턴 적용.

## Fix

### `src/lib/tick-pipeline.ts`

1. **`claimDetailQueue`** (line 1453):
   ```typescript
   // 이전: config.tickDetailBatchSize (default 20, env max 200)
   // 변경: DETAIL_BATCH_HARDCODE = 400
   ```

2. **`detailStage` 처리 loop** (line 1501~):
   ```typescript
   // 이전: sequential
   for (const claim of claims) {
     await fetchDetail(...);
   }
   // 변경: Promise.all wave concurrency 10
   const DETAIL_CONCURRENCY = 10;
   let detailDeadlineHit = false;
   for (let waveStart = 0; waveStart < claims.length; waveStart += DETAIL_CONCURRENCY) {
     if (Date.now() >= deadlineMs) {
       detailDeadlineHit = true;
       break;
     }
     const wave = claims.slice(waveStart, waveStart + DETAIL_CONCURRENCY);
     await Promise.all(wave.map(async (claim) => {
       // continue → return (closure 안에서)
     }));
   }
   if (detailDeadlineHit) stats.timedOut = true;
   ```

### 효과 (계산)
- Sequential batch 20 = 매물당 ~200ms × 20 = 4s 처리, cron 2분 → 600 calls/h
- Parallel batch 400 c=10 = 매물당 ~200ms × (400/10) = 8s 처리, cron 2분 → **12,000 calls/h**
- **Throughput 20x** (이전 600 → 12,000)
- queue 10,224 → **51분 안 해소**

## 검증
- TypeScript: validator.ts(`/plans` dev cache) 외 무에러.
- ESLint: 무에러.
- `npm run test:core`: 139/139 pass.

## 위험 / 보류
- DB write 동시 10건: lifecycle과 같은 패턴. Supabase 안전.
- Bunjang concurrency 10: probe에서 검증된 lenient 한도.
- detail-worker는 lifecycle보다 detail-stage 처리 복잡 (sold detection + parsing + lifecycle seed). wave 안 매물 처리 시간 길어질 수 있음. cron 2분 안 12s 처리는 안전.

## 다음 / 검증 plan
- Deploy 직후: detail-worker run duration < 30s 확인 (예상 8s)
- 1h 후: queue pending 감소 측정 (10,224 → 5,000 이하)
- 24h 후: 새 매물 유입 vs 처리 속도 비교
- lifecycle backlog가 처리 throughput 부족이면 batch 800 c=15 (10x) step up
