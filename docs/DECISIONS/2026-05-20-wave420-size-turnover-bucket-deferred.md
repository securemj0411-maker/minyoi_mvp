# 2026-05-20 Wave420 - Size Turnover Bucket Deferred

## Context
- 패션/신발 비교매물 가격은 일반적으로 사이즈별로 크게 달라지지 않으므로, 현재 가격 median/comparable sample은 사이즈를 강하게 쪼개지 않는다.
- 다만 평균 수요 사이즈를 벗어나는 경우에는 판매 회전률이나 체감 유동성이 달라질 수 있다.

## Decision
- 이번 catalog/parser safety wave에서는 가격 비교 sample과 회전률 sample을 분리해서 취급한다.
- 가격 비교는 기존처럼 상품 모델/상태/거래 맥락 중심으로 좁히고, 사이즈별 가격 분리는 진행하지 않는다.

## Deferred
- 회전률 계산에는 별도 wave에서 size bucket을 추가 검토한다.
- 예: common size / small outlier / large outlier / unknown size 식으로 sample을 나누고, 평균 가격이 아니라 판매 속도와 confidence에만 반영한다.
- 해당 wave에서는 상품군별로 사이즈 영향이 큰 카테고리(신발, 의류)를 먼저 보고, 가방/지갑류는 제외한다.

## Risk Notes
- 지금 단계에서 사이즈를 가격 sample에 섞으면 catalog coverage가 더 줄어들 수 있다.
- 반대로 회전률에는 사이즈 영향이 있을 수 있으므로, 가격 로직과 분리된 confidence modifier로 설계하는 편이 안전하다.
