# 2026-05-22 Wave 529 — 직거래 전용 매물 차감 전 확인

## 결정
- `/me` 피드에서 직거래 전용 매물을 열 때, 상세 접근 API 호출 전에 확인 바텀시트를 띄운다.
- 사용자가 무료 상세보기 잔여분 또는 크레딧을 보유한 경우에만 직거래 위치와 진행 여부를 보여준다.
- 열람권이 없는 사용자는 위치 힌트를 먼저 보지 않고 기존 크레딧 부족 안내를 먼저 보게 둔다.
- 직거래 위치는 저장된 원본 raw metadata에서 가능한 범위로 추출한다. 번개장터는 `raw_json.searchMeta.location`을 우선 사용한다.
- 무료/크레딧 차감은 기존처럼 서버의 `/api/packs/pool/detail-access`에서만 수행한다.

## 구현
- `marketplaceLocationFromRawJson` 헬퍼를 추가해 raw metadata에서 거래 가능 지역을 안전하게 추출한다.
- pool API와 detail-access API 응답에 `directTradeLocation`을 포함한다.
- 무료 상세보기 소진 후 마스킹 피드에서는 `directTradeLocation`을 `null`로 내려 위치 누출을 막는다.
- `ExploreClient`에 `DirectTradeConfirmModal`을 추가했다.

## 보류
- 중고나라의 상세 위치 필드는 현재 파서가 안정적으로 수집하지 않는다. 다음 wave에서 중고나라 detail payload의 지역 필드를 확인해 파서에 반영한다.
- 직거래 전용 매물 자체를 pool에서 제외할지, 또는 지역 기반 필터를 둘지는 데이터가 더 쌓인 뒤 결정한다.
