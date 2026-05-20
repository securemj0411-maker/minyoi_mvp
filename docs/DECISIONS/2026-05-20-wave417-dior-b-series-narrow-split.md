# 2026-05-20 Wave417 — Dior B-series narrow split

## 배경

Wave416 이후 남은 luxury shoe broad를 다시 샘플링했다.

- Prada broad는 `unknown_model`이 40건 이상이고 모델명이 너무 흩어져 있어 보류가 맞다.
- Hermes/Gucci/LV broad도 아직 모델/상품군 편차가 크다.
- Dior broad 안에서는 B25/B27/B57이 반복적으로 보였고, brand-bait false positive도 1건 확인됐다.

## 결정

- 아래 3개를 catalog-only narrow 후보로 추가했다.
  - `shoe-dior-b25`
  - `shoe-dior-b27`
  - `shoe-dior-b57`
- `shoe-dior-broad`는 B25/B27/B57을 `mustNotContain`에 넣어 narrow와 동시에 매칭되지 않게 했다.
- `shoe-dior-broad`는 다른 명품 브랜드 bait를 먹지 않게 보강했다.
  - 예: `구찌 꿀벌 스니커즈 신발 디올발렌`
- `shoe-dior-b23`에는 Cactus Jack/Travis collab noise를 추가했다.
  - plain B23 비교군에 `디올 X 캑터스 잭 B23` 같은 collab이 섞이지 않게 한다.

## DB 적용

현재 catalog 기준으로 luxury shoe target SKU만 제한적으로 rematch했다.

- scan: 257 rows
- applied: 11 rows
- migration:
  - `shoe-dior-broad -> shoe-dior-b27`: 4
  - `shoe-dior-broad -> shoe-dior-b25`: 3
  - `shoe-dior-broad -> shoe-dior-b57`: 3
  - `shoe-dior-broad -> null`: 1

## 검증

- `디올 B25 러너스니커즈 블랙` → `shoe-dior-b25`
- `디올 B27 미드탑 신발 40사이즈` → `shoe-dior-b27`
- `[42] 디올 B57 CD로고 스니커즈 신발` → `shoe-dior-b57`
- `구찌 꿀벌 스니커즈 신발 디올발렌` → `shoe-dior-broad` 아님
- `43 / 디올 X 캑터스 잭 B23 하이탑 스니커즈 3SH126ZOI` → plain `shoe-dior-b23` 아님

## 실행 결과

- `npx tsx --test tests/core-rules.test.ts tests/wave254-5-fashion-condition.test.ts tests/fashion-catalog-regression.test.ts tests/wave254-6-product-type-priority.test.ts tests/wave137-shoe-uk-size.test.ts tests/wave138-shoe-size-extension.test.ts tests/wave139-shoe-eu-us-size.test.ts`
  - pass: 245
  - fail: 0
- AI 비용 없이 score drain:
  - scored: 20
  - poolUpserted: 0
  - poolSkipped: 20
  - dirty cleared rows: 20
- 최종 리포트:
  - active fashion pool rows: 48
  - clothing: 29
  - shoe: 11
  - bag: 8
  - gate-blocked rows: 0
  - flagged rows: 0
  - actionable rows: 0
  - cleanup candidateRows: 0
  - dirty fashion rows: 0

## 보류

- Dior B25/B27/B57은 아직 public ready가 아니다.
- Dior B27 안에서도 그래피티/갤럭시 variant가 섞일 수 있어 ready 승격 전 추가 split이 필요하다.
- Prada는 이번 wave에서 narrow로 만들지 않았다.
  - `Downtown`, `Cloudbust`, `Monolith`, `America Cup`은 샘플 수가 부족하거나 가격 편차가 커서 보류한다.
