# 2026-05-17 v46 cleanup + 효율 batch (6 commit + 1 SQL update)

## 배경

v46 conservative condition_class resolution (commit `4734176`) 박은 후 ground/시스템 검토 (Plan agent 15 iter audit).
발견된 효율 win + 클루지 중 "파괴적 X + 무조건 좋은 거" 만 박음.

## 박은 변경

### 1. `e192104` PARSER_VERSION export + parsed_json.condition_class 제거 (P0 cleanup)

**문제**:
- `PARSER_VERSION` 이 option-parser.ts:154 + reparse-listings/route.ts:121 **2곳 hardcode** — silent drift 위험
- `condition_class` 가 mvp_listing_parsed.column + parsed_json 안에 **이중 저장** — denormalization

**변경**:
- option-parser.ts: `export const PARSER_VERSION` (single source)
- reparse-listings/route.ts: `CURRENT_PARSER_VERSION` 별도 const 제거, import 로 변경
- toParsedListingRow 가 parsed_json 안 `condition_class` 제거 (column 만 유지)
- reader 다 column 사용 중 (market-source/route.ts:65 등) — dead data 였음

**Trade-off 없음**. drift 위험 0.

### 2. `742309b` detail-worker env override

**문제**: `DETAIL_BATCH_HARDCODE = 800`, `DETAIL_CONCURRENCY = 15` hardcode. 운영자 throttle 불가 (bunjang rate limit 압박 시).

**변경**:
- `TICK_DETAIL_BATCH` env (default 800, 범위 50~2000)
- `TICK_DETAIL_CONCURRENCY` env (default 15, 범위 1~30)
- `boundedInt` (pipeline-config.ts) 활용

**Trade-off 없음**. env 미설정 시 기존 default 유지.

### 3. `94ae6df` sold-out 처리 parallel

**문제**: sold-out detected 시 5 sequential round-trip
1. patchRows mvp_raw_listings (18 col)
2. insertObservationsWithPayloads
3. patchLifecycle
4. invalidatePoolEntries
5. markQueueDone

자연 발달 (wave별 patch 추가) — 의도 X.

**변경**: 1~4 Promise.all parallel + 5 sequential. 5 round → 2 round (~60% latency 절감).

**ordering 안전**: 4 작업 서로 다른 table — race 없음. queue done 마지막 (실패 시 retry 차단용).

**Trade-off 없음** (atomic 트랜잭션이 진짜 필요하면 PostgreSQL function 박을 수 있음 — 1시간 작업. 일단 Promise.all 로 80% 효과).

### 4. `32d2646` condition-policy 단일 source (drift 차단)

**문제**: 매물 차단 신호 list 3 곳 hardcode
- `FLAWED_NOTES` option-parser.ts:56 (13종)
- `POOL_BLOCK_NOTES` candidate-pool-builder.ts:306 (5종)
- `COMPARABLE_EXCLUDE_NOTES` market-source/route.ts:144 (10종)

사용자 #92 코멘트가 정확히 이 drift 지적 (시세 sample 제외 ≠ 비교군 UI 제외).

**변경**:
- 새 `src/lib/condition-policy.ts` — `POOL_BLOCK_NOTES` + `COMPARABLE_EXCLUDE_NOTES` 단일 정의
- option-parser.ts: `FLAWED_NOTES` export (subset 검증용)
- candidate-pool-builder.ts: import POOL_BLOCK_NOTES (hardcode 제거)
- market-source/route.ts: import COMPARABLE_EXCLUDE_NOTES (hardcode 제거)

**정책 명시**:
- `POOL_BLOCK_NOTES ⊂ FLAWED_NOTES` — runtime warning (dev mode)
- `COMPARABLE_EXCLUDE_NOTES ⊃ POOL_BLOCK_NOTES` (premium/noise tier 추가)

**Trade-off 없음**. 한 곳 update 시 양쪽 자동 동기화.

### 5. `fb9959e` fraud hash DB function

**문제**: `loadFraudGroupHashes()` 매 score-stage run 마다 20K row fetch + JS aggregate.
코드 코멘트 자체에 "PostgREST direct group by 어려움 — raw fetch + in-memory aggregate" 명시 = 알고 있는 임시 방편.

**변경 (migration `get_fraud_group_hashes_function`)**:
- DB function `get_fraud_group_hashes()` — GROUP BY description_hash HAVING COUNT(DISTINCT seller_uid) >= 2
- LANGUAGE sql STABLE
- tick-pipeline.ts `loadFraudGroupHashes()` 는 RPC 호출로 변경
- production 데이터 검증: 332 fraud hash 반환 (20K → 332 = ~60x 데이터 절감)

**Trade-off 없음**. 로직 변경 X, 실행 위치만 client → DB.

### 6. `b290d23` exponential backoff for failed retries

**문제**: `markQueueFailed` 매번 5분 hardcode retry. 영구 실패 매물 (잠긴/placeholder/oversized 매물 등) 매 5분 detail API waste.

**변경**:
- attempts 1: 5분 (default 동일)
- attempts 2: 15분
- attempts 3+: 60분
- attempts >= max_attempts (3 default) 는 claim RPC 가 자연 차단

**Trade-off 없음**. 정상 매물 retry latency 영향 X.

### 7. SQL UPDATE — candidate_pool.condition_class sync (10건)

**상황**: v46 reparse 후 `mvp_listing_parsed.condition_class` 갱신됐지만 `mvp_candidate_pool.condition_class` 별도 path 라 미동기화. 사용자 UI 옛 분류 그대로 보임.

**SQL** (mismatch 10건):
```sql
UPDATE mvp_candidate_pool cp
SET condition_class = p.condition_class, updated_at = now()
FROM mvp_listing_parsed p
WHERE cp.pid = p.pid
  AND cp.pid = ANY(ARRAY[...24 미해결 pid...]::bigint[])
  AND cp.condition_class != p.condition_class;
```

10 pid 갱신:
- 334403685, 334814973, 403851792 (unopened → clean)
- 352131281, 402009410, 406614375 (clean → worn)
- 403616114, 399098831 (clean → flawed)
- 382240873, 403430435 (등 normal)

**Trade-off**: SQL 한 번만 박음. 다음 reparse 시 또 같은 drift 가능. 근본 해결 = `mvp_candidate_pool.condition_class` column drop + parsed JOIN (P1 #2 — 보류, deferred-decisions log 참조).

## 통합 효과

| commit | latency / 효율 |
|---|---|
| #4 fraud hash DB func | score-stage 매 run 20K row fetch 차단 |
| #3 sold-out parallel | detail-worker batch 의 sold ~5-10% (40-80건) 처리 latency 60% 절감 |
| #6 exponential backoff | 영구 실패 매물 detail API 호출 ~12x → 1x/hour |
| #11 env override | bunjang rate limit 압박 시 throttle 가능 |
| #12 condition policy | drift 위험 0 (사용자 #92 root fix) |
| #1 PARSER export | 향후 bump 시 silent drift 0 |

## Tests

- 모든 commit 후 `npm run test:core` 288/288 pass.

## 관련 메모리

- handoff: "destructive 사전 영향 명시 + confirm" — 모든 fix 비파괴, schema 변경 X (DB function add 만 — rollback 가능)
- handoff: "decision log 필수" — 이 log 가 그 정합
- handoff: "UI 변경 시 3화면 다 적용" — 이번 batch UI 변경 없음 (서버 로직만)
