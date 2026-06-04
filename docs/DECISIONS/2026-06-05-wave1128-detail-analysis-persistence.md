# 2026-06-05 Wave 1128 - Detail Analysis Persistence

## Decision

- 상세 모달에서 lazy-load한 `marketBasis`, `velocityBasis`, `skuListingFlow`가 `/api/packs/me` 목록 재로딩으로 사라지지 않게 보존한다.
- 같은 pid 상세를 다시 열 때 이전 분석 요청 기록 때문에 재요청이 영구 차단되지 않도록, 분석 요청 ref는 in-flight guard로만 사용한다.

## Root Cause

- `/me` 목록은 가벼운 응답을 받고 상세에서 velocity/comparison 분석을 lazy-fill한다.
- 하지만 목록 silent reload가 `setItems(nextData.reveals)`로 기존 enriched item을 덮어써서, 상세 재진입 시 판매속도/비교매물 섹션이 빠질 수 있었다.
- 모달도 한 번 요청한 pid를 계속 skip해서, 분석값 없는 카드로 돌아온 뒤에는 다시 채울 기회가 없었다.

## Deferred

- `/api/packs/me` 자체에 velocity/comparison까지 항상 포함하는 방식은 응답 비용이 커서 보류한다.
