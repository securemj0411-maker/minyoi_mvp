# Wave 986 — score-worker scorable claim RPC (lane a fix)

- 시간: 2026-05-31 18:30 KST
- 트리거: 사용자 "병목 걱정 안 해도 되냐" — audit 결과 score-worker (lane a) 매 5-10분 PostgREST 57014 timeout. wave 939 deferred plan 잔존.

## 발견

- score-worker (lane a) 24h ok 1,364 / fail 30 (2.2%) — 매 5-10분 fail 패턴
- error: `Supabase REST failed 500 GET /rest/v1/mvp_raw_listings?select=...&qty: code 57014 canceling statement due to statement timeout`
- 원인: PostgREST default statement_timeout 8s. lane a 가 sourceFilter 없음 = 모든 source (bunjang+joongna+daangn shard 0) × 25 columns × scanLimit 1000 — 8s 초과
- lane b/c 는 sourceFilter='daangn' (작은 set) → timeout 없음

wave 939 (2026-05-29) OR split 박았지만 lane a 부담 자체 큼 — split 효과 제한적.

## 변경

### DB migration
- `supabase/migrations/20260531082000_wave986_claim_scorable_raw_rows.sql`
- RPC `claim_scorable_raw_rows(p_limit, p_source_filter, p_daangn_shard_count, p_daangn_shard_index, p_listing_type_filter)`
  - SECURITY DEFINER + `SET statement_timeout TO '60s'` (PostgREST 8s 우회)
  - listing_type / listing_type_override 통합 OR 절 (RPC 안 OR — index-friendly)
  - source filter + daangn shard filter
  - returns SETOF mvp_raw_listings (25 columns 전부)

### Code (`src/lib/tick-pipeline.ts:2267-2300`)
- `fetchScorableRows` 안에서 PostgREST GET 대신 RPC 호출.
- listing_type='normal' RPC 한 번이면 normal/override 둘 다 cover (wave 939 두 query 필요 X).
- RPC 실패 시 기존 GET path fallback (best-effort).

## 검증

- `npx tsc --noEmit` clean
- migration applied via MCP `apply_migration` (success)
- 다음 score-worker run (1분 안) 부터 RPC 호출. fail rate 측정으로 효과 검증.

## 위험

- RPC 응답 setof mvp_raw_listings — 모든 column. PostgREST POST 응답 큼 (단 GET 도 동일 column 였음).
- RPC 안 OR (`listing_type = X OR listing_type_override = X`) — wave 939 split 의도 (OR 무거움) 와 반대. 단 RPC 내 statement_timeout 60s 라 무거워도 OK.
- RPC fail 시 fallback. 응답 호환성 동일 (`SETOF mvp_raw_listings` = REST GET 결과).

## 다음

- 1시간 후 score-worker (lane a) fail rate 측정. 0~1% 도달 시 wave 986 종결.
- 잔존 fail 있으면 추가 진단 (RPC 자체 timeout? 인덱스 미스?).
