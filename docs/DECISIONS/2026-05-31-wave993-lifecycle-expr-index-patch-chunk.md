# Wave 993 — lifecycle claim expression index + PATCH chunk 50→25

- 시간: 2026-05-31 20:30 KST
- 트리거: 운영 알림 — lifecycle 22~24% fail (REST timed out), tick PATCH 큰 IN 절 timeout, daangn-price-sweep 일부 (wave 992 후속).

## 발견 — 두 잔존 패턴

### 1. `REST timed out` (PostgREST proxy)
- error: `Supabase REST timed out POST /rest/v1/rpc/claim_mvp_lifecycle_checks`
- PG statement_timeout 60s (wave 988) 박혔지만 RPC 자체 60s+ 안 안 끝남
- 진단: 기존 partial index `mvp_lifecycle_checks_claim_ready_idx` column order = `(next_check_at, priority_tier, updated_at)` 
- ORDER BY: `CASE priority_tier rank ASC, next_check_at ASC, updated_at ASC`
- 첫 정렬 키 mismatch → index full scan + sort. 300k+ row 면 60s+

### 2. `PATCH 큰 IN 절 statement timeout` (PG side)
- recovery-worker / score-worker-c / tick fail
- error: `PATCH /rest/v1/mvp_raw_listings?pid=in.(409557509,...) 57014`
- PATCH 자체는 RPC 아니라 PostgREST 의 raw SQL — PG default 8s 적용
- mvp_raw_listings 840k+ row + 다수 partial index (wave 924/941/980/등) → 50 row PATCH 마다 index 다 갱신 → 8s 초과 가능

## Fix

### 1. Lifecycle expression partial index
- `supabase/migrations/20260531105000_wave993_lifecycle_claim_expr_index.sql`
- `CREATE INDEX CONCURRENTLY mvp_lifecycle_checks_claim_expr_idx`
- column: `(CASE priority_tier WHEN ... ELSE END, next_check_at, updated_at)` partial WHERE status IN (...)
- ORDER BY 정확히 match — index scan + 정렬 skip 가능
- 효과: claim RPC 60s+ → < 1s 예상 (300k row partial scan)

### 2. PATCH chunk 50 → 25 (`src/lib/tick-pipeline.ts`)
- `REST_WRITE_CHUNK_SIZE = 50` → `25`
- 효과: PATCH 마다 index 갱신 빨라짐 — 8s 안 끝남
- trade-off: PATCH 호출 2배 ↑ (단 각 빨라짐, 총 시간 비슷 또는 단축)

## 평가

**Trade-off**:
- Index 추가: storage +10~30MB / write 미세 무거움 (밀리초). 거의 0.
- chunk 25: PATCH 호출 빈도 ↑ but 빠르게 끝남. 거의 0.

## 검증

- index CREATE CONCURRENTLY (lock 없이 background build) — 적용 완료
- `npx tsc --noEmit` clean
- 다음 lifecycle worker tick (5분) 부터 새 index 활용
- 다음 PATCH 호출 부터 chunk 25 적용

## 다음

- 1h 후 lifecycle "REST timed out" fail 추세 측정 (목표 0)
- PATCH timeout (recovery/score-c/tick) 추세 측정
