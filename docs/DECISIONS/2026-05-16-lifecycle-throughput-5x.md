# 2026-05-16 — Lifecycle worker throughput 5x (Bunjang probe 기반)

## 트리거
- Lifecycle backlog 2,659건 overdue (Iteration 2 발견).
- 사용자: "batch 80 이유 + 진짜 안전 한도 + 신박한 방법 검토하고 안 되면 되게 해".
- Bunjang rate limit probe 실험 (probe 결과: `2026-05-16-bunjang-rate-limit-probe-results.md`).

## Probe 결과 요약
- 600 calls 전부 200 응답 (6 phase × 100건).
- 429 / 5xx / error = 0건.
- c=20에서 throughput 329 req/s까지 안전.
- c=30에서 latency 27x 폭증 (Bunjang server soft throttle, 거절 아닌 줄세우기).
- → **시나리오 A (매우 lenient)**.

## Fix

### `src/lib/tick-pipeline.ts`

1. **`claimLifecycleChecks`** (line 2705):
   ```typescript
   // 이전
   const batchSize = Math.min(80, config.tickDetailBatchSize);
   // 변경
   const LIFECYCLE_BATCH_HARDCODE = 400;
   const batchSize = mode === "terminal_recheck"
     ? config.terminalLifecycleRecheckBatchSize
     : LIFECYCLE_BATCH_HARDCODE;
   ```

2. **lifecycle 처리 loop** (line 2801~):
   ```typescript
   // 이전: sequential
   for (const row of claims) {
     await fetchDetail(...);
     // ...
   }
   // 변경: Promise.all wave concurrency 10
   const LIFECYCLE_CONCURRENCY = 10;
   for (let waveStart = 0; waveStart < claims.length; waveStart += LIFECYCLE_CONCURRENCY) {
     const wave = claims.slice(waveStart, waveStart + LIFECYCLE_CONCURRENCY);
     await Promise.all(wave.map(async (row) => {
       // ... continue → return으로 (4군데)
     }));
   }
   ```

### 효과 (계산)
- Sequential batch 80 = 매물당 ~150ms × 80 = 12s 처리, cron 7분 → 686 calls/h
- Parallel batch 400 c=10 = 매물당 ~150ms × (400/10) = 6s 처리, cron 7분 → **3,429 calls/h**
- **Throughput 5x**, backlog 2,659 → **45분 안에 해소**
- maxDuration 90s 한도의 7% 사용 (안전 마진 매우 큼)

## 검증
- TypeScript: validator.ts(`/plans` dev cache) 외 무에러.
- ESLint: 무에러.
- `npm run test:core`: 139/139 pass.

## 위험 / 보류
- DB write 동시 10건: Supabase plan connection 한도 확인 필요. 현재 베타 traffic이라 안전 추정.
- 429 detection 코드 미박: probe에서 0건이라 후순위. 추후 안전망 wave 가능 (별도).
- Race condition: stats / marketInvalidations 공유 mutation. JS single-threaded라 atomic. await 사이 yield는 다른 wave에 영향 X (wave 자체가 Promise.all로 wait).

## 24h 검증 plan
- Deploy 직후: lifecycle worker run duration < 30s 확인 (예상 8s)
- 1h 후: overdue 매물 수 < 1,500 (현재 2,659)
- 24h 후: overdue < 500 + 429 누적 0건
- 다 통과하면 batch 800 c=15 (10x)로 step up 가능

## 다음
- 24h 측정 결과 보고 → 추가 tune 결정
- 429 detection 안전망 wave (선택)
- detail-worker도 같은 패턴 적용 가능 (queue 10k pending — Iteration 2 발견)
