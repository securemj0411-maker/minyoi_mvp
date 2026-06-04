# Wave 1063 — Comparable sold status label

## Decision

- 비교매물에 판매완료 매물이 안 보인다는 보고를 확인했다.
- `airpods|airpods_max_usbc|usbc` / `unopened` 비교군에는 판매완료 row가 실제로 존재했다.
  - 예: 당근 `listing_state=sold_confirmed`, `sale_status=closed` 18건.
- 원인은 fetch 누락이 아니라 UI 상태 판정 누락이었다.
  - 기존 UI는 `listingState === "sold"` 또는 `saleStatus === "SOLD_OUT" | "sold"`만 판매완료로 봤다.
  - DB의 실제 상태값인 `sold_confirmed`, `closed`, `JOONGNA_SOLD_PAGE`, `JOONGNA_STATUS_*` 등을 판매완료로 인식하지 못했다.
- `pack-reveal-modal`에 comparable status normalization helper를 추가하고 상세 비교매물/쉬운모드 비교매물 양쪽에 적용했다.

## Deferred

- `disappeared` 매물은 현재 비교 리스트에서 제외한다. 가격 추적/판매완료 증거로 별도 표시할지 여부는 후속 UX 결정으로 남긴다.
