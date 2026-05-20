# 2026-05-20 Wave416 — LV token boundary and next luxury shoe split

## 배경

Wave415에서 Hermes Bouncing, LV Trainer, Gucci Ace, Dior B23/B30을 catalog-only narrow 후보로 분리했다.
다음 샘플 sweep에서 두 가지가 추가로 보였다.

- `LV8` 나이키 에어포스가 bare `lv` 토큰 때문에 `shoe-louisvuitton-broad`로 들어간다.
- luxury shoe broad 안에서 LV Run Away, Gucci Rhyton이 반복적으로 보인다.

## 결정

- `tokenHit`에서 1~3자 영문/숫자 토큰은 단어 경계가 있을 때만 매칭하게 했다.
  - 예: `lv`는 `LV 트레이너`에는 맞지만 `LV8` 안에서는 맞지 않는다.
  - 같은 정책이 `nb`, `ps`, `se` 같은 짧은 토큰에도 적용된다.
- 아래 2개를 catalog-only narrow 후보로 추가했다.
  - `shoe-louisvuitton-runaway`
  - `shoe-gucci-rhyton`
- 기존 brand-broad fallback에는 해당 모델명과 `lv8`을 `mustNotContain`으로 추가했다.
- public pool release는 하지 않았다.
  - 새 후보는 `LANE_READINESS`에 추가하지 않았고, shoe category internal-only 정책을 유지했다.

## DB 적용

현재 catalog 기준으로 luxury shoe target SKU만 제한적으로 rematch했다.

- scan: 339 rows
- applied: 82 rows
- 주요 migration:
  - `shoe-louisvuitton-broad -> shoe-louisvuitton-lv-trainer`: 16
  - `shoe-hermes-broad -> shoe-hermes-bouncing`: 15
  - `shoe-hermes-broad -> null`: 13
  - `shoe-louisvuitton-broad -> null`: 8
  - `shoe-dior-broad -> null`: 5
  - `shoe-dior-broad -> shoe-dior-b23`: 5
  - `shoe-gucci-broad -> shoe-gucci-ace`: 4
  - `shoe-louisvuitton-broad -> shoe-louisvuitton-runaway`: 4
  - `shoe-gucci-broad -> shoe-gucci-rhyton`: 3
  - `shoe-dior-broad -> shoe-dior-b30`: 3
  - `shoe-prada-broad -> null`: 3

## 검증

- `루이비통 런어웨이 스니커즈 36` → `shoe-louisvuitton-runaway`
- `7 / 루이비통 LV 프리즘 런어웨이 스니커즈` → `shoe-louisvuitton-runaway`
- `구찌 띠로고 라이톤 스니커즈 신발 6.5사이즈 255 260 판매` → `shoe-gucci-rhyton`
- `구찌라이톤 스니커즈 245` → `shoe-gucci-rhyton`
- `정품 새상품 나이키 에어 포스 107 LV8 235 운동화 스니커즈 남여` → Louis Vuitton 계열 아님

## 실행 결과

- `npx tsx --test tests/core-rules.test.ts tests/wave254-5-fashion-condition.test.ts tests/fashion-catalog-regression.test.ts tests/wave254-6-product-type-priority.test.ts tests/wave137-shoe-uk-size.test.ts tests/wave138-shoe-size-extension.test.ts tests/wave139-shoe-eu-us-size.test.ts`
  - pass: 237
  - fail: 0
- AI 비용 없이 score drain:
  - scored: 57
  - poolUpserted: 2
  - poolSkipped: 55
  - dirty cleared rows: 74
- pool cleanup:
  - internal-only `lv_trainer` pool row 1건 invalidated
- 최종 리포트:
  - active fashion pool rows: 47
  - clothing: 28
  - shoe: 11
  - bag: 8
  - gate-blocked rows: 0
  - flagged rows: 0
  - actionable rows: 0
  - cleanup candidateRows: 0
  - dirty fashion rows: 0

## 보류

- `shoe-louisvuitton-runaway`, `shoe-gucci-rhyton`은 아직 public ready가 아니다.
- LV Run Away는 price spread가 아직 크다. 실제 ready 승격 전 variant/color/collab split을 더 봐야 한다.
- Prada broad는 아직 `unknown_model` 비중이 높다. `Downtown`, `America Cup`, `Monolith`, `Cloudbust`는 샘플 수가 부족하거나 가격 편차가 커서 이번 wave에서는 narrow로 만들지 않았다.
