# 2026-05-18 Wave 261 — /me 추천 오픈 조건 hard-filter

## 문제
- 사용자가 `더 찾아보기`에서 `15만원 이하` 조건으로 검색했는데, 실제 reveal 결과에 매입가 125만원대 iPhone 16 Pro Max가 섞였다.
- 원인은 preview/inventory와 token cost 계산은 `priceMaxManwon` 등을 사용했지만, 실제 `/api/packs/open` → `openPack()` 확정 경로가 예약 후보를 reveal하기 직전에 가격/차익/신뢰도/카테고리 조건을 다시 검증하지 않았기 때문이다.

## 결정
- `/api/packs/open`에서 사용자 필터 payload를 정규화해 `openPack()`까지 전달한다.
- `openPack()`은 후보를 reveal/commit하기 전에 다음 조건을 hard-filter한다.
  - 매입가 상한(`priceMaxManwon`)
  - 최소 예상 차익(`minProfitManwon`)
  - 최소 신뢰도(`minConfidencePct`)
  - 선택 카테고리(`categories`)
- 조건 밖 후보는 invalidation하지 않고 reservation만 release한다. 상품 자체가 나쁜 것이 아니라 사용자의 이번 조건에 맞지 않는 것이기 때문이다.
- 필터가 있는 요청은 더 넓게 reserve해서 post-filter 후에도 목표 카드 수를 채울 확률을 높인다.
- 프론트 retry도 기존 필터를 보존한다.

## 보류
- DB RPC 자체에 price/profit/confidence/category 필터를 직접 추가하는 것은 더 근본적인 최적화다. 다만 함수 시그니처 변경은 배포/마이그레이션 순서와 race 검증이 필요하므로 이번 wave에서는 서버 commit 직전 hard-filter로 신뢰성부터 막았다.
- 필터 조건별 실제 후보 수와 reveal 성공률 메트릭은 추후 운영 대시보드에 붙일 수 있다.
