# 2026-05-22 — launch-44: recovery cron 별도 worker 분리

## 사용자 짚음
> "아니 뭐하냐?? 지금 revalidated to ready 크론 하는건데 뭐 딴걸로 센서야?? 뭐하는거야? 그거 해결책 찾아야지"

→ launch-43 에서 "무 변경 + 측정 더" 결정한 거 사용자 거부. 진짜 fix 박기.

## 진단 (이전 wave 들)
- launch-42b: recovery cron whitelist 확장 + 카테고리 필터 제거 (작동 중)
- launch-43 측정: score_worker avg 40s / p95 72s / max 88s / 33% timeout (90s lease 한계)
- recovery cron 가치 = 매 분 200+ 마킹, 1h 115건 ready 전환
- 단 score_worker 의 책임 7가지 묶임 (scoring + 4종 residue + 2종 recovery)
- → recovery cron 분리 = score_worker 부담 ↓ + recovery 처리량 ↑

## fix (4 변경)

### Step 1: `src/lib/cron-guard.ts`
- `CronWorkerMode` 에 `"recovery_worker"` 추가
- `DEFAULT_COOLDOWN_MS.recovery_worker = 60_000` (1분)
- `DEFAULT_LEASE_MS.recovery_worker = 60_000` (1분, 가벼움)

### Step 2: `src/lib/tick-pipeline.ts`
- `scoreStage` 에서 `markRecoveredMarketInvalidatedPoolRowsDirty` 호출 제거 (line 5508)
- `timingsMs.score_recovered_market_invalidated_pool_dirty_marked_rows` 키 제거
- 새 함수 `recoveryStage()` — limit 250 → **500** (별 worker 라 시간 여유)
- 새 wrapper `runRecoveryWorkerPipeline()` — TickResult 반환

### Step 3: `src/app/api/cron/recovery-worker/route.ts` (신규)
- score-worker route 패턴 따라
- `acquireCronGuardWithSourceHealth("recovery_worker", req)`
- `recoveryStage()` 호출
- maxDuration 60 (score-worker 90 보다 짧음 — 가벼움 보장)
- mvp_collect_runs 에 mode="recovery_worker" 로깅

### Step 4: `vercel.json`
- `/api/cron/recovery-worker` schedule `"* * * * *"` (매 1분)
- score-worker 와 같은 schedule but 별 worker 라 병렬 작동

## 예상 효과

### score_worker 부담 ↓
- recovery cron 5-10초 추정 제거
- 평균 40s → 30-35s (정확 측정 후 검증)
- 33% timeout → 20-25% 추정 (감소, but root 다른 문제 — score_unscorable_dirty_cleared 979 같은 큰 cleanup 여전)

### recovery 처리량 ↑
- limit 250 → 500 (2x)
- 매 분 500 후보 검증 → 매 시간 30,000 후보 → 24h 720,000 (실제 후보 풀 ~2,800 이라 즉시 다 처리)
- score_dirty 마킹 빈도 ↑ → ready 전환 ↑

### Vercel function 부담
- 새 cron 1개 추가 — 매 분 작동, lease 60s
- 다른 cron 과 schedule 겹침 (tick, detail_worker, score_worker 모두 매 분)
- 4 worker 동시 작동 가능 — Supabase connection pool 부담 가능. 단 lease 자체 분리, source health guard 적용.

## 향후 (별 wave) — root 해결

이번 fix 는 부분 fix. 진짜 root 해결:

**옵션 E (event-driven scheduled retry)**:
- `mvp_raw_listings.next_score_check_at` 컬럼 추가
- invalidate 시점 미래 시간 박음 (사유별: 시세 6h, parser 24h)
- score-worker 가 score_dirty=true OR next_score_check_at 만료 매물 처리
- recovery cron 자체 폐기
- 비용: migration + invalidatePoolEntries 호출처 10-15곳 수정

**옵션 F 추가 (전체 worker split)**:
- score-worker 의 cleanup/residue 도 별 worker 분리
- score-worker = scoring 본업만

→ traffic 5-10x 도달 전 박기.

## 검증 plan

deploy 직후 (~2분 후):
1. score-worker stage_stats 에서 recovery 카운터 제거 확인
2. recovery-worker 첫 run 의 stats.upserted (마킹 카운트) > 0 확인
3. score-worker 평균 duration 측정 — 40s → 감소 확인

24h 후:
- score-worker 33% 실패율 → 추세 측정
- ready 풀 증가 추세 vs launch-42b 시점 비교

## 영향
- 코드: 3 파일 (cron-guard.ts, tick-pipeline.ts, vercel.json) + 1 신규 (recovery-worker/route.ts)
- DB: 무 변경
- 사용자: invisible (백엔드 효율 개선만)
- 메모리: 별도 worker 분리 패턴 — 향후 cleanup/residue 도 동일 패턴 적용 가능

## 메모리 룰
- 사용자 의도 = 진짜 fix. "무 변경" 결정 박지 말 것.
- 측정 후 결정도 좋지만 사용자가 결과 원하면 박기
- decision log: 이 파일
