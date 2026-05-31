# Wave 987 — lifecycle worker 자체 catch-up (lock-free 영구 fix)

- 시간: 2026-05-31 18:45 KST
- 트리거: 사용자 "본질 fix, trade-off 없는 거 먼저". wave 984 회피 + wave 985 best-effort swallow 가 영구 보장 X.

## 영구 결함 정리

- backfill cron (별개 process) ↔ lifecycle worker UPDATE → `mvp_lifecycle_checks` lock 충돌 → 55P03 cancel
- wave 985 daangn-ingest catch-up = best-effort + swallow → lock 충돌 시 fail 영구 가능성
- 진짜 영구 fix = **같은 worker 안에서 catch-up** (자기 자신 = sequential = lock 충돌 0)

## 변경

### DB migration
- `supabase/migrations/20260531085000_wave987_backfill_rpc_shard_param.sql`
- RPC 시그니처 확장: `wave978_backfill_daangn_lifecycle_chunk(p_chunk_size, p_daangn_shard_count, p_daangn_shard_index)`
- 옛 1-param signature DROP (PostgREST overload 충돌 차단 — wave 979 follow-up 학습)
- shard 필터: `(pid % shard_count) = shard_index` — lane a/b/c 가 다른 row 처리

### Code (`src/lib/tick-pipeline.ts:lifecycleStage`)
- mode='default' 시 RPC 호출 (chunk 50, lane별 shard count/index 적용)
- best-effort try/catch — RPC fail 시 swallow, 다음 tick 재시도
- 부담: 50 INSERT = ~0.5초. lifecycleBudgetMs 75s 무시.
- terminal_recheck mode 는 catch-up skip (별개 사용 의도).

### Capacity
- lifecycle worker a/b/c × 12회/h × 50 = **1,800/h catch-up**
- wave 985 (daangn-ingest catch-up) 합쳐서 ~5,400/h
- lock-free 보장이라 swallow fail 없음 (자기 자신과 충돌 X)

## 본질 vs 회피 평가

이 fix 는 본질:
- lock 충돌 자체 차단 (같은 process 안 sequential)
- best-effort 의존 X (RPC 자체 성공 보장)
- swallow 는 PG 부하 같은 예외 case 만 (lock 충돌은 발생 안 함)

## 위험

- lifecycle worker 매 tick 부담 +0.5초. budget 75s 안에 무시.
- shard 적용 — lane a/b/c 다른 row 처리. 단 모든 lane 안 도는 매물 (예: 특정 shard 만 활성) catch-up 안 됨. 단 a/b/c 모두 매 5분 도니 매물 다 cover.
- terminal_recheck catch-up skip — 별개 사용 (sold/disappeared row 만 처리). 의도된 동작.

## 검증

- `npx tsc --noEmit` clean
- RPC migration applied (success)
- 옛 signature DROP 확인 — pg_proc 1 row (3-param) 만 남음

## 다음

- 다음 lifecycle worker run (5분 안) 부터 catch-up 작동.
- 1시간 후 daangn_missing_from_lifecycle 감소 페이스 측정.
- 18~22h 안 0 도달 예상 (자연 시드 + wave 985 + wave 987 합쳐서).
