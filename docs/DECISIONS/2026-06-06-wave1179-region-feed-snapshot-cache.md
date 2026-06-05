# 2026-06-06 Wave 1179 — Region feed snapshot cache

## 결정

- 회원 피드 `/api/packs/pool`에 지역/필터 단위 DB 스냅샷 캐시를 추가했다.
- 같은 `daangn_full_path`와 같은 source/budget/sort/preference/pageSize 조합이면, 한 사용자가 만든 피드 결과를 다음 같은 지역 사용자가 즉시 읽는다.
- 스냅샷은 기존 `buildItems()`가 만든 실제 카드 payload를 그대로 저장한다. 카드 필드 재해석/새 포맷 도입은 하지 않았다.
- 빈 결과는 저장하지 않는다. 지난 wave처럼 quick path 0건이 “없는 피드”로 고정되는 사고를 막기 위함이다.

## 구현

- 새 테이블: `public.mvp_region_feed_snapshots`
  - `cache_key` primary key
  - `region_key`, `source_filter`, `budget_filter`, `sort_key`, `preference_key`, `extended_marketplaces`, `page_size`
  - `payload jsonb`, `item_count`, `pids`, `expires_at`
- TTL 기본값은 `REGION_FEED_SNAPSHOT_TTL_MS=90000`ms.
- `/api/packs/pool` 동작:
  1. refresh/excludePids가 없고 home region이 있으면 snapshot 조회
  2. hit면 기존 pool 조립을 건너뛰고 즉시 반환
  3. miss면 기존 조립 로직으로 items 생성
  4. items가 1개 이상이면 snapshot upsert
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
