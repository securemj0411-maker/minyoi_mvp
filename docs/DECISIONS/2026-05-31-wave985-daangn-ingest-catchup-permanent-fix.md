# Wave 985 — daangn-ingest catch-up 영구 fix

- 시간: 2026-05-31 18:15 KST
- 트리거: 사용자 "영구 결함이면 진짜 고쳐야지". wave 984 backfill cron 비활성화는 회피.

## 영구 결함 진단

### 1. lock 충돌
- backfill cron INSERT `mvp_lifecycle_checks` ↔ lifecycle worker a/b/c UPDATE/CLAIM (`claim_mvp_lifecycle_checks` RPC) 가 같은 테이블 lock 잡음.
- 별개 process (다른 cron route) 라 `pg_advisory_xact_lock` 도 양쪽 모두에 박혀야 충돌 차단 → lifecycle worker 코드 변경 필요.
- `lock_timeout = 0` (무한) — backfill RPC 가 lock 기다리느라 statement_timeout 55s 초과 → 55P03 cancel.

### 2. PostgREST timeout
- PG statement_timeout 55s 박았지만 PostgREST 자체 timeout 80~90s. PG cancel 응답 안 받고 timeout error.
- 매 backfill cron run fail (10:30, 10:35, 10:40, 10:45, 10:50 다 fail 확인).

### 3. 누락 매물 (영구 결함의 운영 영향)
- 측정: daangn active+sku_id 118,807 / lifecycle seeded 153,896 / **lifecycle 누락 65,917**.
- 65k 누락 = search 페이지에 안 보이는 옛 매물.
- 자연 시드 (daangn-ingest seedLifecycleChecks) 는 신규 매물만 시드 → 옛 매물 영구 누락.

## 영구 fix

### 변경: daangn-ingest 안 catch-up RPC 호출
- `src/lib/daangn-ingest.ts`: `upsertDaangnRawListings` 끝 (seedLifecycleChecks 직후) catch-up RPC 호출 추가.
- chunk 100 (lock 짧게 잡음).
- best-effort try/catch — fail 시 swallow, 다음 run 재시도.
- 같은 worker 안에서 호출 — 별개 cron 보다 lock 충돌 위험 ↓ (단 lifecycle worker 와는 여전히 별개 process).

### Capacity
- daangn-worker a/b/c 매 5분 (= 12회/h × 3 lane = **36회/h**)
- 36 × 100 = **3,600/h catch-up**
- 잔여 65k = **18h 안 영구 해소**. 신규 + 옛 매물 둘 다 cover.

## 위험

- chunk 100 도 lock 충돌 가능 (lifecycle worker 와 동시 작동). 단 100 INSERT 는 1~2초 안 끝남 → lock 짧음 → 충돌 빈도 낮음.
- catch-up fail 시 swallow → ingest primary path (raw upsert, parsed upsert) 영향 0.
- best-effort 라 매번 100% 시드 보장은 X. 단 자연 시드 + catch-up 합치면 영구 catch-up.

## 검증

- `npx tsc --noEmit` clean
- daangn-worker 다음 tick (~5분) 후 mvp_lifecycle_checks daangn count 증가 측정
- 24h 후 daangn_missing_from_lifecycle 0 도달 확인

## 다음

- 24h 후 측정 — 0 도달 안 하면 lifecycle worker advisory lock 박는 wave 추가.
- backfill cron 자체 (`/api/cron/daangn-lifecycle-backfill`) 는 vercel.json 에서 비활성 (wave 984). 코드/RPC/index 는 schema 유지.
