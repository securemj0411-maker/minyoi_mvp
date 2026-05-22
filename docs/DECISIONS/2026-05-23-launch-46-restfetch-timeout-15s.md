# 2026-05-23 — launch-46: restFetch timeout 8s → 15s (score_worker 89% timeout 해결)

## 사용자 짚음
> "score_worker failed 32/36 (89%) — 이전 33% 보다 큼!! 다른 부담 추가? joongna depth 영향?"

## 진단

### 24h status 분포
- succeeded: 762
- **failed: 232 (23%)** — 24h 평균
- running: 1

→ 평균 23% timeout. 최근 1h spike **89%** (joongna depth ↑ 박은 후).

### error pattern (10/10 동일)
모든 failed = `Supabase REST timed out GET /rest/v1/mvp_raw_listings?...` 또는 `mvp_listing_parsed?...`

- 8s timeout (restFetch 안 hardcoded)
- joongna depth 10 박은 후 raw_listings 매물 ↑ → query 더 무거움 → 8s timeout

## fix

`src/lib/supabase-rest.ts`:
- restFetch timeout `8_000` → `REST_FETCH_TIMEOUT_MS = env.SUPABASE_REST_TIMEOUT_MS ?? 15_000`
- env override 가능 (Vercel 에 박으면 production 조정)
- Vercel function maxDuration 90s 안 안전 마진 (15s × retry 3 = 45s 최악)

## 예상 효과
- score_worker timeout 비율 23% (평균) → 5-10% 추정
- 1h spike 89% → 정상화

## Trade-off
- 장점: 큰 query (pid in.(N개)) 도 응답 받을 시간 확보
- 단점: 진짜 hang 한 query 도 15s 기다림 (전: 8s). retry × 3 = 최악 45s 대기.
- 안전: maxDuration 90s 안.

## 향후 (별 wave)
- pid=in.(N) 의 N 줄이기 (chunk 더 작게)
- supabase pgbouncer/connection pool 조정
- query 인덱스 audit

## 검증 (다음 측정)
- 1-2h 후 score_worker status 분포
- failed 비율 23% → ?%
- joongna ingest 1h 누적 증가 추세

## 영향
- 코드: src/lib/supabase-rest.ts (1 곳 + env)
- DB: X
- 사용자: invisible (백엔드 안정성)
- decision log: 이 파일
