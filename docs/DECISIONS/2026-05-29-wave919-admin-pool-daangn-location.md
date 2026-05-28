# Wave 919 — 운영자 풀 당근 위치 표시

## 문제
- `/caule.../pool` 운영자 풀에서 당근 매물의 거래 동네가 보이지 않았다.
- 당근은 직거래 실행성이 핵심이라 운영자 검수 화면에서도 동네를 바로 확인해야 한다.

## 결정
- 운영자 풀 API도 사용자 피드와 같은 위치 해석 헬퍼를 사용한다.
- 당근 매물에만 위치 칩을 표시한다.

## 구현
- `src/app/api/admin/pool-listings/route.ts`
  - `mvp_raw_listings` select에 `description_preview`, `raw_json`, `daangn_region_id`, `daangn_region_name`을 추가했다.
  - `marketplaceLocationCombinedWithRegion` + `resolveDaangnFullRegion`으로 `directTradeLocation`을 계산해 응답에 포함했다.
- `src/components/admin-pool-browser.tsx`
  - `PoolItem.directTradeLocation` 타입을 추가했다.
  - 당근 매물 메타 줄에 `📍 거래 동네` 칩을 노출했다.

## 보류
- 운영자 풀의 거리 km/사용자 home region 기준 정렬은 이번 변경에 포함하지 않았다.
