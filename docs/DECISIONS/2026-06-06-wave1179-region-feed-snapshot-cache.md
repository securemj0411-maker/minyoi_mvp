# 2026-06-06 Wave 1179 — Region feed snapshot cache

## 결정

- 회원 피드 `/api/packs/pool`에 지역/필터 단위 DB 스냅샷 캐시를 추가했다.
- 같은 `daangn_full_path`와 같은 source/budget/sort/preference/pageSize 조합이면, 한 사용자가 만든 피드 결과를 다음 같은 지역 사용자가 즉시 읽는다.
- 스냅샷은 기존 `buildItems()`가 만든 실제 카드 payload를 그대로 저장한다. 카드 필드 재해석/새 포맷 도입은 하지 않았다.
- 빈 결과는 저장하지 않는다. 지난 wave처럼 quick path 0건이 “없는 피드”로 고정되는 사고를 막기 위함이다.
- 스냅샷 hit라도 그대로 반환하지 않고, 반환 직전에 `mvp_candidate_pool` + `mvp_raw_listings`로 live 상태를 재검증한다.
  - 일반 카드는 `candidate_pool.status=ready`, `raw.listing_state=active`, `raw.detail_status=done`일 때만 유지한다.
  - 판매완료 카드는 raw 상태가 `sold_confirmed` 또는 `disappeared`일 때만 유지한다.
  - 캐시 안 카드가 하나라도 탈락하면 snapshot을 쓰지 않고 기존 live build 경로로 내려간다. 캐시 hit 때문에 유효 후보가 줄어 보이는 일을 막기 위함이다.
- 브라우저 localStorage 피드 스냅샷도 지역 단위로 묶었다. 서버 캐시는 지역 key가 있는데 클라이언트 캐시는 지역 key가 없으면, 사용자가 동네를 바꾼 직후 예전 동네 카드가 먼저 보일 수 있기 때문이다.

## 구현

- 새 테이블: `public.mvp_region_feed_snapshots`
  - `cache_key` primary key
  - `region_key`, `source_filter`, `budget_filter`, `sort_key`, `preference_key`, `extended_marketplaces`, `page_size`
  - `payload jsonb`, `item_count`, `pids`, `expires_at`
- TTL 기본값은 `REGION_FEED_SNAPSHOT_TTL_MS=90000`ms.
- `/api/packs/pool` 동작:
  1. refresh/excludePids가 없고 home region이 있으면 snapshot 조회
  2. hit면 기존 pool 조립을 건너뛰고 즉시 반환
  3. hit payload를 live 상태로 필터링하고, 모든 카드가 통과할 때만 반환
  4. miss 또는 live 필터 0건이면 기존 조립 로직으로 items 생성
  5. items가 1개 이상이면 snapshot upsert
- snapshot upsert는 `return=minimal`로 저장해서 응답 본문 비용을 줄인다.
- 클라이언트 snapshot key에 home region을 추가했고, home region을 아직 모르면 local snapshot을 읽거나 쓰지 않는다.
- 클라이언트 snapshot TTL은 2분에서 45초로 줄였다. 이 snapshot은 “첫 화면 체감 속도 힌트”일 뿐이고, 최종 데이터는 서버 응답으로 즉시 교체된다.
- 당근 예산 필터 raw lookup을 위해 `mvp_raw_daangn_active_done_region_price_last_seen_idx`를 추가했다.

## 보류

- cron이 주요 지역 스냅샷을 선제 warm 하는 구조는 보류했다.
  - 이번 wave는 request-path cache aside로 먼저 안전하게 붙였다.
  - 다음 단계는 `pool-warmer` 또는 별도 `feed-snapshot-warmer`가 인기 지역/가격대 조합을 미리 채우게 하는 것이다.
- 카드 단위 materialized table(`mvp_feed_cards`)은 보류했다.
  - 현재는 payload 배열 snapshot이라 변경 폭이 작고 안전하다.
  - 더 큰 성능 개선이 필요하면 candidate row별 card payload를 precompute 하는 방향으로 확장한다.

## 검증

- `npm run lint -- src/lib/feed-snapshot-cache.ts src/app/api/packs/pool/route.ts`
- `npm run build`
