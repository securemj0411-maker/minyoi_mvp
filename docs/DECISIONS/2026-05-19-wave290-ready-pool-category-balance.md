# 2026-05-19 Wave 290 — ready pool category balance

## Context

최근 ready pool 체감이 신발 위주로 보인다는 사용자 보고가 있었다. DB 확인 결과 전체 사용자 노출 가능 ready pool은 테크/신발이 섞여 있었지만, 최근 2~6시간 added 기준은 신발이 80~90%까지 올라갔다.

원인은 시장 cadence만이 아니라 운영 설정 편향이 컸다.

- `category:405` 신발 sweep이 public tick에서 15페이지로 돌고 있었다. 이는 학습용 deep sweep 설정이 사용자 노출 fresh loop에 남아 있던 것.
- catalog alias query가 category metadata 없이 string으로만 registry에 들어가 `unknown` gather 5m로 빠지는 케이스가 많았다.
- due query ordering과 pack reveal ordering 모두 카테고리 다양성 없이 전역 순서/품질순에 가까워, lane 수가 많은 카테고리가 화면을 먹기 쉬웠다.

## Decisions

1. Public tick의 신발 sweep을 15페이지에서 3페이지로 줄였다.
   - 신발 공급 자체를 끄지 않고, 학습용 deep crawl이 일반 ready 유입을 과증폭하지 않게 했다.
   - deep 학습은 추후 별도 job/report로 분리한다.

2. Catalog-derived search query에 category lookup을 붙였다.
   - `buildCatalogSearchQueryEntries()` / `catalogCategoryForSearchQuery()`를 추가했다.
   - `queryFamily()`가 catalog exact match를 먼저 보고, 이후 휴리스틱을 적용한다.
   - 기본 query 중 `WH-1000XM`, `PS5 슬림`, `로보락 S8`, English iPad/MacBook 등도 category로 잡히게 보강했다.

3. Due search query를 category family별 round-robin으로 interleave한다.
   - 기존에는 오래된 query 순서라 한 family query가 많으면 tick budget을 더 많이 먹었다.
   - 이제 같은 오래됨 조건에서 family별로 한 개씩 섞어 스캔한다.

4. Pack open에서 reserve된 후보를 category별 round-robin으로 섞은 뒤 reveal 처리한다.
   - DB RPC를 즉시 대수술하지 않고, 앱 레벨에서 같은 카테고리 연속 노출을 줄인다.
   - 사용자 필터/중복/라이브 검증 로직은 그대로 유지한다.

5. `categoryFromComparableKey()`가 새 public categories도 인식하게 했다.
   - `shoe`, `bag`, `bike`, `drone`, `perfume`, `kickboard`, `lego`, `clothing`.
   - pack diversity와 category filter가 comparable key만 받은 경우에도 동작한다.

## Verification

- `npx tsx --test tests/query-cadence-balance.test.ts tests/pack-open-race.test.ts`
- `npm run test:core`

추가 로컬 검산:

- `loadPipelineRuntimeConfig().searchQueries` 기준 unknown query family가 0건으로 내려갔다.
- `category:405` page override는 3페이지로 확인했다.

## Deferred

- Production DB의 `reserve_mvp_pool_candidates` RPC 자체에 category quota를 넣는 작업은 보류했다. 현재 앱 레벨 interleave로 즉시 체감 문제를 낮추고, 다음 운영 데이터로 DB-level quota 필요성을 판단한다.
- 신발 deep learning sweep은 별도 cron/stage로 분리할지 결정이 필요하다.
- 카테고리별 target share 정책(예: tech 70%, fashion 30%)은 개인화 설문/선호 카테고리와 함께 설계해야 한다.
