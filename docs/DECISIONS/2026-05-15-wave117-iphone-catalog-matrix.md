# Wave 117 — iPhone 누락 모델 일괄 catalog 추가 (413건 복구)

> Status: **applied (code + production).** 사용자 통찰: "reject 많은 sku 단어 하나로 확 끌어올릴거 없음?". 카테고리별 sku_id null 비율 측정 → iPhone 91% null 발견.

CLAUDE.md 6 필드 포맷.

## 1. 진단

- 시간: 2026-05-15
- 발견: 14일 raw sku_id null 비율
  - iPhone 91% (10,258건), Galaxy 83% (10,978건), Switch 97%, Apple Watch 72%, iPad 58%
  - iPhone null sample: 13 mini 772건, SE 시리즈 493건, 17 시리즈 276건, 12 mini 167건
- 변경: 측정만.
- 다음: 누락 SKU 일괄 추가.

## 2. iPhone 10개 SKU 추가

- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** 추가:
  - iphone-12-mini, iphone-13-mini (mini 시리즈)
  - iphone-se, iphone-se2, iphone-se3 (SE 1/2/3세대)
  - iphone-17, iphone-17-pro, iphone-17-pro-max (2025-09 출시 — Wave 111f "미출시" 가정 틀림)
  - iphone-17e (2026 신상)
- 검증: 139/139 test pass
- 위험: 매우 낮음. broad SKU 변형 흡수만.

## 3. Production reclassify — 413건 복구

- 시간: 2026-05-15
- 실행: scripts/reclassify-wave117-iphone.ts (2회 sweep, hours 14d)
- 결과: 1차 288건 + 2차 125건 = **413건 catalog 복구**
  - iphone-se 71건, iphone-13-mini 104건, iphone-17-pro 19건, iphone-12-mini 17건 등

## 4. 거론 금지

- Wave 111f 가정 "iPhone 17 미출시" — 실제 2025-09 출시됨. 시점 가정 오류 학습.
- audit-precision-wave114.ts M3 narrow expected 수정 (Wave 106 #48 RAM 강제 반영).
