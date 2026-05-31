# Wave 979 — lifecycle worker source/shard 분산 (lane a/b/c)

- 시간: 2026-05-31 14:50 KST
- 트리거: wave 978 phase 1 backfill (1k daangn) 측정 결과 `last_check_result` null 999/1000 — claim RPC `ORDER BY priority+next_check_at+updated_at`에서 bunjang/joongna 옛 매물 12만+ 백로그에 밀려 처리 안 됨. 사용자 지시 "근본적으로 항상 sold 잘 체크 + velocity 잘 기록".

## 발견

- `mvp_lifecycle_checks` claimable (next_check_at <= NOW & locked_until OK):
  - bunjang exploration 10k, general 38k, market_sample 48k, pool 2k = ~98k
  - joongna exploration 0.9k, general 7k, market_sample 6k, pool 0.2k = ~14k
  - daangn (방금 backfill) 1k
- batch 800/run × 12 runs/h = 시간당 9,600 매물 sweep — backlog 12만+ 누적
- score-worker 는 이미 lane a/b/c 3 shard 분산 구조 (`scoreStageScope`: `pid % shardCount === shardIndex`). lifecycle 만 단일 lane → bottleneck.

## 변경

### DB migration
- `claim_mvp_lifecycle_checks` RPC 시그니처 확장:
  - `p_source_filter text DEFAULT NULL` (NULL=모든 source)
  - `p_daangn_shard_count integer DEFAULT 1`
  - `p_daangn_shard_index integer DEFAULT 0`
  - WHERE 절: `(p_source_filter IS NULL OR c.source = p_source_filter) AND (shard_count <= 1 OR c.source <> 'daangn' OR (c.pid % shard_count) = shard_index)`
  - backward compat: 기존 caller (param 미지정) 동일 동작
- `supabase/migrations/20260531055000_wave979_lifecycle_claim_source_shard.sql`

### tick-pipeline
- `LifecycleClaimOptions` type 신설 (sourceFilter / daangnShardCount / daangnShardIndex)
- `claimLifecycleChecks(mode, options)` 옵션 받음 — terminal_recheck 는 default RPC 무관 (그대로)
- `lifecycleStage(deadline, mode, claimOptions)` 전달
- `runLifecycleWorkerPipeline({terminalRecheck, ...claimOptions})` 전달
- timingsMs 에 source/shard 측정값 박음

### Routes
- `src/app/api/cron/lifecycle-worker/route.ts` (lane a): env 기반 sourceFilter=NULL, daangnShardCount=3, daangnShardIndex=0
- `src/app/api/cron/lifecycle-worker-b/route.ts` 신설 (lane b): daangn-only shard 1/3
- `src/app/api/cron/lifecycle-worker-c/route.ts` 신설 (lane c): daangn-only shard 2/3
- `src/lib/cron-guard.ts`: CronWorkerMode 에 `lifecycle_worker_b`/`lifecycle_worker_c` 추가, COOLDOWN/LEASE 2분 default

### Cron schedule
- `vercel.json`:
  - lifecycle-worker: 분 1+5k (기존)
  - lifecycle-worker-b: 분 2+5k (12/h)
  - lifecycle-worker-c: 분 3+5k (12/h)

## 효과

- capacity 시간당 9,600 → **28,800 (3x)**
- backlog 12만+ 4-5시간 안 해소
- daangn 363k active backfill 가능 — 7일 cycle 안 균등 분산
- 신규 ingest 시드 매물도 자연 cycle (lane a daangn shard 0, b shard 1, c shard 2)

## 검증

- `npx tsc --noEmit` clean (lifecycle/cron/pipeline 변경 파일 에러 0)
- migration applied via supabase MCP `apply_migration` (success)

## 위험

- daangn HTML fetch 부하 3 lane 동시 → c=10 × 3 = 동시 30 fetch. probe (wave 904) c=20까지 lenient 확인 — daangn 의 경우 별도 probe 없지만 detail-worker 평소 fail rate 0% 라 cushion 있음.
- 신규 cron 3개 (lifecycle-worker-b/c는 신설) 동시 시작 시 DB write 부하. cron guard 로 동시 실행 차단. 분당 1 cron 분산 (1,2,3).
- terminal_recheck claim RPC 는 source/shard param 미지원 — wave 979 scope 안. 별도 필요 시 추가.

## 다음

- commit + push → Vercel deploy
- 신규 cron registration 대기 (Vercel 다음 deploy)
- 5-10분 후 lifecycle-worker-b/c run 결과 측정 — 1k daangn backfill 처리율
- 양호 시 phase 2 (10k), phase 3 (100k), phase 4 (잔여 ~252k) 진행
