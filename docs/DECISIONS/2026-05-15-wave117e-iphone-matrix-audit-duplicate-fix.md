# Wave 117e — iPhone 행렬 audit + GENERATED_CATALOG duplicate fix

> 사용자 통찰: "단순히 발견 하나하나 추가하지 말고 시리즈 전체 행렬 점검해. GENERATED_CATALOG 확인 안 함?"

## 1. 진단
- 시간: 2026-05-15
- 발견: 사용자 지적 후 GENERATED_CATALOG 점검 → **duplicate 6개 발견**:
  - iphone-12, iphone-13, iphone-14, iphone-15, iphone-15-pro, iphone-16 — 다 GENERATED에 있는데 내가 CORE에 추가
- 영향: duplicate SKU → ruleMatch chooseUniqueCandidate 헷갈림 → test fail
- 변경: 측정 + 문서화.

## 2. duplicate 제거 + 진짜 누락만 추가
- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)**
  - 제거: iphone-12, iphone-13, iphone-14, iphone-15, iphone-15-pro, iphone-16 (CORE에서)
  - 진짜 추가 (GENERATED에 없는 거만):
    - iphone-11, iphone-11-pro, iphone-11-pro-max
    - iphone-12-pro, iphone-12-pro-max
    - iphone-14-plus, iphone-15-plus, iphone-16-plus
    - iphone-17-plus
- 검증: 139/139 test pass.

## 3. pipeline.ts 액세서리 regex 강화
- 시간: 2026-05-15
- 변경: accessoryStandaloneTextSignal regex에 "입니다/이에요/에요" 어미 추가:
  ```typescript
  /(케이스|...필름).{0,12}(단독|단품|만|판매|팝니다|새상품|미개봉|급처|처분|입니다|이에요|에요)/
  ```
  → "강화유리 필름입니다" 같은 desc 매물 accessory 분류 가능.

## 4. 거론 금지
- 같은 실수 방지: 다음 catalog 추가 전 GENERATED_CATALOG/CORE 둘 다 grep 확인 필수.
- iPhone 11 Pro Max 매물 5건만 — sample 부족하지만 일관성 위해 추가.
