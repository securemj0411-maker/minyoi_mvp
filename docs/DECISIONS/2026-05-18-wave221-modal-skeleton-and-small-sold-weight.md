# 2026-05-18 Wave 221 — 모달 스켈레톤과 소표본 sold 가중치 완화

## 문제
- `/me` 상품 보기/시세 근거 모달에서 그래프와 비교 매물 내용이 비동기로 늦게 붙으면서 빈 영역 또는 짧은 텍스트가 보이다가 갑자기 큰 UI로 바뀌었다.
- `sold 1건 + active 소표본` 구간에서 sold 거래가를 50%로 섞어 저가 거래 1건이 blended 시세를 과하게 끌어내렸다. 예: active median 120,000원, sold 1건 70,000원 → blended 95,000원.

## 결정
- pack reveal 로딩 상태, 시세 30일 그래프 로딩 상태, 시세 근거 디버그 모달 로딩 상태에 구조 스켈레톤을 먼저 표시한다.
- `mvp_market_price_daily.blended_median_price` 계산 시 sold 표본 수가 작을수록 active anchor를 강하게 유지한다. sold 1건은 active 표본 3건 이상일 때 25%, active 5건 이상일 때 30%만 반영한다.

## 보류
- 기존 `mvp_market_price_daily` 값은 다음 market/tick 집계부터 새 가중치로 갱신된다. 즉시 과거 row 전체를 backfill하는 작업은 별도 운영 판단 후 진행한다.
