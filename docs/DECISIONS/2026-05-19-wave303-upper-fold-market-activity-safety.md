# 2026-05-19 Wave 303 — 상단 물량 신호와 안전 근거 CTA

## 배경
- 상세 상단의 할인율은 이미 차익/퍼센트 영역에서 보이기 때문에 trust tile에서 반복하면 정보 밀도가 떨어진다.
- 구매 직전 불안은 “이 SKU가 오늘도 활발한가”, “7일 기준으로 물량이 있는가”, “셀러/위험 근거를 바로 열 수 있는가”가 더 크다.

## 결정
- 상단 `시세/매물대` 타일을 `오늘 물량` 타일로 바꿨다.
- `skuListingFlow`가 있으면 오늘 등록 건수와 7일 평균 건수/일을 보여주고, 평소보다 많음/평소 수준/오늘은 조용함으로 tone을 정한다.
- flow가 없으면 기존 market sample 기준으로 판매중/거래완료 표본을 보여준다.
- `거래 안전` 타일은 이제 클릭 가능한 안전 근거 CTA다. 클릭 시 기존 `RiskScoreBar` portal detail을 그대로 연다.
- 셀러 평점이 4.8 이상이고 후기가 있으면 `평점 N.N 셀러`를 먼저 보여주고 Trophy SVG를 사용한다. 그 외에는 risk label과 Shield SVG를 보여준다.

## 보류
- `수요 높음/낮음`이라는 직접 문구는 이번에는 쓰지 않았다. 실제로는 공급/유입 신호이므로 오늘 물량과 7일 평균으로 표현하는 편이 더 정직하다.
- 다음 패스에서 판매완료 속도와 오늘 유입량을 조합한 “시장 활발함” 단일 스코어가 필요하면 별도 계산으로 올린다.

## 검증
- `npx eslint src/components/pack-reveal-modal.tsx src/components/risk-score-bar.tsx src/components/icons.tsx`
- `npm run build`
