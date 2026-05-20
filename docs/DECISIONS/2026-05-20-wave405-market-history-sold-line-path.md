# 2026-05-20 Wave 405 — 시세 그래프 거래가 라인 path 수정

## 배경
- 사용자가 `/me` 상세 모달의 시세 그래프에서 초록 호가 라인은 그려지지만 파란 “번개장터 거래가” 라인은 오늘 점만 찍히고 선이 안 보인다고 지적했다.
- AirPods Max USB-C 미개봉 집계를 확인한 결과, `mvp_market_price_daily`에는 2026-05-17, 2026-05-18, 2026-05-19, 2026-05-20 거래가 표본이 존재했다.
- 따라서 원인은 최근 거래 부재가 아니라 SVG path 생성 버그였다.

## 결정
- `MarketHistoryChart`의 line path 생성 로직을 `i === 0 ? "M" : "L"` 기준에서 “첫 non-null point는 M, 이후 non-null point는 L” 기준으로 변경했다.
- `sold` 값이 날짜 배열 첫 칸에는 없고 중간부터 존재하는 경우에도 path가 유효하게 시작한다.
- 같은 문제가 active 라인에도 생길 수 있어 공통 `linePath` helper로 active/sold 모두 처리한다.
- 후속 확인 중 X축 라벨이 “sold 있는 날만” 찍혀 전체 기간의 왼쪽 구간이 무슨 날짜인지 알 수 없는 문제가 확인됐다.
- X축은 전체 timeline을 균등 샘플링해 표시하고, 거래가 관측일은 파란 점으로 별도 표시하도록 변경했다.

## 보류
- 그래프는 여전히 raw `last_seen_at` 이벤트를 직접 그리지 않고, daily aggregate인 `mvp_market_price_daily.sold_median_price`만 표시한다.
- 거래가 표본이 없는 날짜는 선을 건너뛰어 다음 거래가 있는 날짜와 연결한다. “표본 없는 날짜마다 선을 끊어 표시” 같은 더 엄격한 표현은 추후 UX 정책으로 결정한다.
