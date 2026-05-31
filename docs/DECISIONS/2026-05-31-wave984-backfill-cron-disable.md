# Wave 984 — daangn-lifecycle-backfill cron 비활성화

- 시간: 2026-05-31 17:55 KST
- 트리거: wave 980/982 fix 후에도 backfill cron 매 5분 fail. RPC timeout (80~90s) + lock 충돌 (55P03).

## 발견

```
Supabase REST timed out POST /rest/v1/rpc/wave978_backfill_daangn_lifecycle_chunk
Supabase REST failed 500 ... 55P03 canceling statement due to lock timeout
```

- statement_timeout 55s 설정했는데도 RPC 80~90s 소요 (PostgREST 측 timeout 더 빠름)
- `mvp_lifecycle_checks` INSERT 가 lifecycle worker a/b/c 의 동시 UPDATE/CLAIM 과 lock 충돌
- chunk 2000 → 500 까지 줄여도 같은 패턴 예상 (lifecycle worker 동시 lock 잡음)

## 결정

backfill cron 자체 비활성화. 자연 시드로 진행.

### 자연 시드 (daangn-ingest seedLifecycleChecks) 페이스
- daangn-worker a/b/c 매 5분 collect → 신규 매물 시드
- 측정 (오늘 6h 안): seeded_from_pipeline ~10k/h
- 잔여 ~220k → **약 22~24h 안 100% 도달 예상**

### 비활성화 변경
- `vercel.json` 에서 `/api/cron/daangn-lifecycle-backfill` cron entry 제거
- route 코드 + RPC 는 keep (수동 호출 가능, 추후 필요 시)

## 위험

- 옛 daangn 매물 (search 페이지 안 보임) 은 자연 시드 도달 못 함 — 즉 last_seen_at 옛 매물 lifecycle 영구 누락 가능.
- 단 사용자에게 노출되는 매물은 fresh (3d 이내). 옛 매물 미시드는 시세/velocity 기여 없음 — 의미 작음.

## 다음

- 24h 후 daangn lifecycle 시드율 측정. 90%+ 도달 시 wave 984 종결.
- 시드율 정체 (예: 80% stop) 시 backfill cron 재활성화 + lock 충돌 fix (lifecycle worker advisory lock 또는 별도 chunk window 박기).
- backfill RPC + 인덱스 (wave 980) 는 schema 유지 — 코드 측 cleanup 별도 wave.
