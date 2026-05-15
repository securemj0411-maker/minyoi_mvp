# Wave 117d — Apple Watch Series 11 + Ultra 3 + 3-6 catalog (837건 복구 ⭐ 단일 wave 최대)

## 1. 진단
- 시간: 2026-05-15
- 발견: Apple Watch 72% null (3,393/4,712건). Series 11 (2025-09 신상) 136, Ultra 3 125, Series 4 115, Series 6 54, Series 3 49, Series 5 21. catalog는 SE1-3 + Series 7-10 + Ultra/Ultra 2만.

## 2. catalog 추가 — 6개
- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)**
  - applewatch-series11 (2025-09, msrp 649k)
  - applewatch-ultra3 (2025-09, msrp 1,199k)
  - applewatch-series6 (2020, msrp 539k)
  - applewatch-series5 (2019, msrp 539k)
  - applewatch-series4 (2018, msrp 539k)
  - applewatch-series3 (2017, msrp 459k) — 8년 전이지만 매물 49건이라 추가
- 검증: 139/139 test pass.

## 3. Production reclassify — **837건 ⭐**
- 실행: scripts/reclassify-wave117d-applewatch.ts (2 iter)
- 결과: 527 + 310 = **837건 복구** (단일 wave 최대)
  - series11 91, ultra2 106, se2 127, ultra 94, series10 90, series4 47, se3 45, ultra3 45 등

## 4. 거론 금지
- Apple Watch Nike Edition — HW 동일 (밴드만 다름), 시세 lane 동일 → 별도 SKU X.
