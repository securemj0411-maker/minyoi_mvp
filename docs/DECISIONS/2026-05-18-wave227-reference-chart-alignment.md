# 2026-05-18 Wave 227 — 미개봉 상세 그래프 기준 정렬

## 배경
- `/me` 상품 보기 모달에서 미개봉/새상품 카드의 시세 숫자는 다나와 reference price를 쓰는데, 그래프는 `mvp_market_price_daily`의 번개 active/sold median을 그렸다.
- 그래프 API는 `cc=unopened`를 받아도 날짜별 미개봉 표본이 없으면 `mint/clean/normal/all`로 fallback했다.
- 이 때문에 사용자 눈에는 "다나와 시세라고 써 있는데 그래프는 새상품/미개봉 그래프가 아닌 것 같다"는 괴리가 생겼다.

## 결정
- `GET /api/market/history`에 `strict=1` 옵션을 추가했다.
- 미개봉 + reference price 카드의 그래프는 `cc=unopened&strict=1`로 호출해 다른 등급 fallback을 차단한다.
- 차트 UI는 reference 카드에서 `다나와` 기준선을 별도로 그리고, 번개 데이터는 `미개봉 호가/미개봉 거래가`로 명시한다.
- 미개봉 history가 부족하면 일반/중고 그래프를 대신 보여주지 않고, 다나와 기준가와 "번개 미개봉 표본 누적 중" 안내를 보여준다.

## 보류
- 다나와 가격 자체의 30일 추이 그래프는 현재 `mvp_reference_prices`에 latest `effective_price`만 있어 바로 구현하지 않았다.
- 장기적으로는 `mvp_reference_price_daily` 또는 reference price snapshot 테이블을 추가해 다나와 가격 변동선도 별도 축으로 누적해야 한다.
