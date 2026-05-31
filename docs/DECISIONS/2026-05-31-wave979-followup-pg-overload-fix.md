# Wave 979 follow-up — PG function overload fix

- 시간: 2026-05-31 15:02 KST (06:02 UTC)
- 트리거: wave 979 commit 직후 lifecycle-worker 05:56 / 06:01 UTC 2 run 연속 fail.

## 발견

`mvp_collect_runs.error_message`:
```
Supabase REST failed 300 POST /rest/v1/rpc/claim_mvp_lifecycle_checks: {
  "code":"PGRST203",
  "message":"Could not choose the best candidate function between:
    public.claim_mvp_lifecycle_checks(p_batch_size => integer, p_lease_seconds => integer),
    public.claim_mvp_lifecycle_checks(p_batch_size => integer, p_lease_seconds => integer, p_source_filter => text, p_daangn_shard_count => integer, p_daangn_shard_index => integer)"
}
```

원인: wave 979 migration 의 `CREATE OR REPLACE FUNCTION` 은 같은 signature 만 replace. param 5개 신규 function 추가했지만 옛 2-param function 잔존 → PostgREST 가 어느 거 호출할지 못 정함.

## 변경

### Production DB (MCP 즉시 적용)
```sql
DROP FUNCTION IF EXISTS public.claim_mvp_lifecycle_checks(integer, integer);
```

### Migration 파일 (재발 방지)
- `supabase/migrations/20260531060500_wave979_drop_old_lifecycle_claim.sql` 추가
- 내용: 같은 DROP. idempotent (IF EXISTS).

## 검증

- DROP 후 `pg_get_function_identity_arguments(claim_mvp_lifecycle_checks)` 1 row (5 param) 만 반환 ✅
- 06:06 UTC tick 부터 정상 재개 예상

## 위험

- DROP 시점에 옛 2-param 호출 중인 caller 있었으면 fail 가능. 단 코드 검색 (grep `claim_mvp_lifecycle_checks`) 결과 caller 는 `src/lib/tick-pipeline.ts` 1곳뿐 — 신규 5-param 호출. 안전.
- terminal-recheck RPC (`claim_mvp_terminal_lifecycle_rechecks`) 는 별개 function — 영향 없음.

## 교훈

PG function signature 변경 시 `CREATE OR REPLACE` 만으로 부족. **param 추가/제거하면 DROP + CREATE 또는 별도 DROP migration 필수.** 다음 wave 에서 같은 패턴 — sub-agent 가 RPC migration 작성 시 강조.
