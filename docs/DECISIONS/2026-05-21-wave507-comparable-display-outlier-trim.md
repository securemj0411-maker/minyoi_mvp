# Wave 507 — 비교 매물 표시 outlier 정리

## 문제
- 시세 계산에서는 극단 고가/저가 outlier를 제거하지만, 사용자 상세/쉬운모드의 비교 매물 리스트에는 같은 outlier가 그대로 노출될 수 있었다.
- 예: 에어팟 맥스 비교 매물에 700만원대 dummy 호가가 보이면 사용자가 시세 기준 자체를 불신하게 된다.

## 결정
- `/api/listings/[pid]/market-source`에서 비교 매물 display rows에도 `madTrim` 기반 가격 outlier band를 적용한다.
- 위험 신호, 상태, 상품 타입 필터를 통과한 뒤 마지막 표시 단계에서 극단 가격 row를 제거한다.
- 시세 계산과 표시 리스트가 같은 “정상 가격대” 감각을 공유하도록 한다.

## 구현
- `trimComparableOutlierRows`를 추가해 가격 sample 5건 이상에서 MAD trim으로 제거된 범위 밖 row를 표시 목록에서 제외한다.
- 이 endpoint를 쓰는 쉬운모드/상세모드 비교 매물 UI가 함께 정리된다.

## 보류
- outlier 제거 사실을 사용자에게 별도 문구로 노출하는 것은 보류한다. 현재는 신뢰를 깨는 극단 row를 안 보여주는 것이 우선이다.
