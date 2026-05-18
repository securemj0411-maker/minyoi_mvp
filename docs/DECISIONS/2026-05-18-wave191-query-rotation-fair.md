# Wave 191 — 신규 카테고리 0건 scan 진짜 원인 (2026-05-18)

## 사용자 질문

> "우리 5분마다 가져오는 tick 크론에서 우리 새 카테고리 가져오는건 맞지? 설마 그거부터 제대로 처리 안한건 아니지?"

## 답: 안 가져오고 있었음. 사용자 의심 정당.

DB sweep 결과:

| category | total | never_scanned | scanned_24h |
|----------|-------|---------------|-------------|
| **perfume** | 32 | **32 (100%)** | 0 |
| **lego** | 27 | **27 (100%)** | 0 |
| **kickboard** | 25 | **25 (100%)** | 0 |
| drone | 63 | 57 (90%) | 6 |
| smartwatch | 78 | 66 (85%) | 12 |
| home_appliance | 39 | 22 (56%) | 17 |
| laptop | 57 | 32 (56%) | 25 |
| **합계** | 1,358 | **1,016 (75%)** | — |

raw_listings에 신규 카테고리 매물 들어온 건 `category:610` (가전) / `category:600300` (카메라) / `category:600720` (워치) 등 category sweep에서 우연히 캡처된 것. **텍스트 query 자체는 cron에서 안 돌고 있었음**.

## 원인

`tick-pipeline.ts:3509 filterDueSearchQueries()` 가 envQueries 순서 그대로 반환 (정렬 X).

envQueries 순서 (`pipeline-config.ts:envQueries()`):
1. `categoryQueries` (category:XXX 14개)
2. `DEFAULT_SEARCH_QUERIES` (perfume/lego/kickboard 포함)
3. `buildCatalogSearchQueries()` (catalog SKU별 자동 1,000+ query)

`tickSearchBudgetMs` 안에 1,358 query 전부 처리 불가. 매번 앞쪽만 처리되고 중간/뒤쪽 신규 카테고리 query는 다음 tick으로 밀려 영영 0회 scan.

`filterDueSearchQueries`가 NULL last_scanned_at 모두 due로 push하지만 **반환 순서가 envQueries 순서 그대로** — 후순위 query는 매 tick 마지막에 위치해서 budget 초과로 break.

## fix

`filterDueSearchQueries` 결과를 `last_scanned_at` 오래된 순으로 정렬:

```ts
const due: { query: string; lastMs: number }[] = [];
// ... 채움 ...
// NULL (never_scanned) → lastMs=0 → 가장 우선
due.sort((a, b) => a.lastMs - b.lastMs);
return due.map((d) => d.query);
```

효과: 다음 tick부터 lego/kickboard/perfume 같은 never_scanned query가 가장 먼저 처리됨. 한 번 scan되면 last_scanned_at 박혀서 다른 query에 자리 양보. fair rotation 보장.

## 영향

- 다음 tick부터 신규 카테고리 query가 실제로 검색됨
- raw_listings에 신규 카테고리 매물 증가
- Wave 190 (trustedMarketMedian total>=2) + Wave 189 (normalize) 효과 실측 가능
- 기존 ready 카테고리도 fair rotation 혜택 (never_scanned 줄어듦)

## verify / commit

- typecheck clean
- test:core 446/447 (사전 wave159h 1건 무관)
- commit `8702f28`

## 자기 평가

또 잘못된 진단 — Wave 190에서 "fix 박았으니 다음 tick부터 들어감" 답했는데 **신규 카테고리 query 자체가 cron에서 안 돌고 있었음**. 사용자 한 번 더 의심 → 진짜 root cause 발견.

같은 실수 재발 방지:
- 매물 진입 0건 진단 시 5단계 모두 확인 필수:
  1. search query DB 등록 + last_scanned_at 갱신
  2. raw_listings 매물 수집
  3. detail_queue 진입
  4. parsed
  5. candidate_pool
- Wave 190의 "다음 tick부터 들어감" 같은 단정적 답변 X — 측정 후 확인.

## 다음 액션

5~10분 후 production sweep:
1. perfume/lego/kickboard query last_scanned_at 갱신 확인
2. raw_listings 신규 카테고리 매물 증가 확인
3. candidate_pool 진입 시작 확인
