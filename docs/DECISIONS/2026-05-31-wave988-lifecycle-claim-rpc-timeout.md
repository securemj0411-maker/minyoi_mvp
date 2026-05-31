# Wave 988 — lifecycle claim RPC statement_timeout (trade-off 0)

- 시간: 2026-05-31 19:00 KST
- 트리거: 사용자 "D 측정 자체는 trade-off 0". 24h fail audit.

## 발견

24h timeout fail 분포:
| Cron | timeout fails |
|---|---:|
| score-worker (lane a) | 39 (wave 986 적용 후 측정 필요) |
| **lifecycle-worker (a)** | **24** |
| daangn-lifecycle-backfill | 15 (wave 984 비활성화) |
| **lifecycle-worker-b** | **12** |
| **lifecycle-worker-c** | **10** |
| score-worker-c | 9 |
| recovery-worker | 7 |

lifecycle-worker (a/b/c) timeout 합 **46건**. error message:
```
Supabase REST failed 500 POST /rest/v1/rpc/claim_mvp_lifecycle_checks: 
{"code":"57014","message":"canceling statement due to statement timeout"}
```

진단: `claim_mvp_lifecycle_checks` RPC proconfig 측정 → `search_path=public` 만, **statement_timeout 안 박힘**. PostgREST default 8s. mvp_lifecycle_checks 300k+ row claim 시 batch 800 + ORDER BY 처리 8s 초과.

## 변경

### DB migration
- `supabase/migrations/20260531092000_wave988_lifecycle_claim_rpc_timeout.sql`
- `ALTER FUNCTION claim_mvp_lifecycle_checks SET statement_timeout TO '60s'`
- `ALTER FUNCTION claim_mvp_terminal_lifecycle_rechecks SET statement_timeout TO '60s'`
- 단순 ALTER. function body 변경 X. signature/return type 변경 X.

### Code
- 변경 없음. 기존 호출 그대로 동작 (RPC 안에서 timeout 60s 적용).

## 검증

- proconfig 확인 — `[search_path=public, statement_timeout=60s]` ✅
- 다음 lifecycle worker tick (5분 안) 부터 효과

## 위험

- 진짜 trade-off 0. ALTER FUNCTION 만, 응답 호환성 0 변화.
- RPC 자체 무거우면 60s 초과 가능성 있지만 — wave 979 batch 800 + ORDER BY index 활용 가정. 측정 후 추가 fix 가능.

## 다음

- 1~2시간 후 lifecycle-worker timeout fail 감소 측정 (목표 0건).
- 잔존 시 batch size 줄임 또는 claim 효율 patch 별개 wave.
- recovery-worker / score-worker-c PATCH 큰 IN 절 timeout (7건/24h) 은 별개 wave — chunk 줄임 필요.
