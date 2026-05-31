# Wave 994 — payload retention 별도 cron + daangn lock retry

- 시간: 2026-05-31 20:50 KST
- 트리거: 알림 — housekeeper 33% fail (stale 6m), daangn-price-sweep 55P03 lock timeout.

## 발견 — 2 잔존 패턴

### 1. Housekeeper stale 6m (진짜 maxDuration 초과)
- error: `stale running run auto-marked after 6m`
- wave 989 staleRunMinutes 3→6 박은 후 새 threshold = 6m
- housekeeper maxDuration 180s (wave 982 회피 박은 거) 도 초과
- 진단: 3 stage 누적 무거움 — expire_mvp_plans + cadence evaluator + **payload retention 90일** (가장 큼)

### 2. daangn-price-sweep 55P03 lock timeout
- error: `daangn_bulk_upsert_raw_listings_v2: 55P03 canceling statement due to lock timeout`
- statement_timeout 60s (wave 992) 박혔지만 lock 충돌은 별개
- 다른 daangn worker (a/b/c) 가 같은 mvp_raw_listings row UPDATE 중 → lock 충돌
- statement_timeout 안 lock 기다리다 cancel

## Fix

### 1. payload retention 별도 cron
- `src/app/api/cron/payload-retention/route.ts` 신설
- housekeeper 의 retention block 제거 → housekeeper maxDuration 180s 안 끝남 보장
- vercel.json cron daily 1번 (UTC 19:30, KST 04:30 새벽)
- shouldRunPayloadRetention cooldown marker 동일 활용 (`mode=payload_retention_sweep`)
- maxDuration 180s (retention 무거우면 별도 cron 자체 시간)

### 2. daangn lock retry
- `daangn_bulk_upsert_raw_listings_v2` RPC 호출 시 55P03 lock timeout 발생하면 200ms 대기 후 1회 retry
- 다른 daangn worker 끝나길 기다림 (best-effort)
- 단순 try 2번. 두 번째도 fail 이면 throw

## 평가

**Trade-off**:
- payload retention 분리: 신규 cron 1개 (Vercel 22→23 / Pro 40 한도). 운영 위험 0 (분리만, 코드 동일).
- daangn retry: 추가 RPC 호출 1번 (lock 충돌 경우만). 정상은 영향 0.

## 검증

- `npx tsc --noEmit` clean (변경 파일 에러 0)
- 다음 housekeeper run 부터 retention block 없음 → maxDuration 안 끝남 보장
- 다음 daangn-price-sweep run 부터 lock timeout 시 retry

## 다음

- 1~6h 후 housekeeper fail rate 0~5% 도달 측정
- daangn 55P03 fail 감소 측정 (retry 성공율)
- 잔존 시 worker 간 advisory lock 등 추가 fix
