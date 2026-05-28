# Wave 923 — 운영자 풀 당근 지역 필터

Date: 2026-05-29

## 결정

- `/caule...` 운영자 풀 전체 페이지에 당근마켓 ready 매물 지역 필터를 추가한다.
- 지역은 `시/도 -> 시/군/구 -> 동/읍/면` 순서로 선택한다.
- 별도 DB 스키마를 추가하지 않고, `mvp_raw_listings.daangn_region_id / daangn_region_name`을 `resolveDaangnFullRegion()`으로 풀어 admin API에서 집계한다.
- 지역 필터를 선택하면 출처 필터는 당근마켓으로 자동 고정한다. 다른 출처를 선택하면 지역 필터는 초기화한다.

## 구현

- `GET /api/admin/pool-listings`
  - `daangnRegion1`, `daangnRegion2`, `daangnRegion3` query param을 지원한다.
  - region filter는 candidate pool pid scope로 먼저 좁힌 뒤 기존 status/category/price/sku/search filter와 교집합 처리한다.
  - stats 응답에 `byDaangnRegion`을 추가한다.
- `AdminPoolBrowser`
  - 출처/가격/카테고리 stats 아래에 `당근 지역별 ready` quick filter를 추가한다.
  - filter bar에 당근 시/도, 시/군/구, 동/읍/면 select를 추가한다.

## 보류

- 거리 반경 기반 필터는 이번 wave에서 구현하지 않는다.
- 지도/좌표 기반 distance 계산은 당근 원문 지역 정규화와 별도 설계가 필요하므로 다음 wave로 남긴다.
- `기타/미상`으로 떨어지는 region id는 운영자 확인용으로만 노출하고, region parent dictionary 보강은 별도 작업으로 둔다.
