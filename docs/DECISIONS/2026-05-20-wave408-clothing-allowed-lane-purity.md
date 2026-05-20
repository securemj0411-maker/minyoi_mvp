# Wave 408 — Clothing Allowed Lane Purity Audit

Date: 2026-05-20

## Context

Wave 407에서 clothing category-wide ready를 닫고 broad/mixed lane을 대량 차단했다. 남은 문제는 "그래도 허용된 80여 개 clothing pool row 안에 아직 섞인 매물이 있는가"였다. 특히 의류는 같은 브랜드라도 티셔츠/롱슬리브/후디/집업/팬츠/자켓 가격대가 크게 다르기 때문에, ready lane을 유지하려면 lane별 sample purity를 따로 확인해야 한다.

## Decisions

1. read-only clothing pool purity 리포트를 추가했다.
   - `scripts/report-clothing-pool-purity.ts`
   - active/reserved clothing pool row를 현재 catalog/parser/gate 기준으로 재평가한다.
   - 결과는 `reports/clothing-pool-purity-latest.md`와 `reports/clothing-pool-purity-latest.json`에 남긴다.
   - `parsed_key_drift`, `raw_sku_now_*` 같은 stale DB drift와 실제 추가 조치가 필요한 lane 오염을 분리해서 본다.

2. 허용 lane에서 발견된 parser/catalog 오염을 보수적으로 막았다.
   - Arc'teryx `Hoody/후디/후드` 계열은 sweatshirt hoodie가 아니라 jacket line으로 판정한다.
   - BAPE Shark `Half Zip/반집업`은 pullover hoodie가 아니라 `hoodie_zip`으로 분리한다.
   - `피케티/피케셔츠/pique`는 generic tee가 아니라 `polo_shirt`로 우선 분류한다.
   - Polo/Ralph Lauren brand token이 명시적 `셔츠/옥스포드 셔츠`보다 먼저 이기지 못하게 shirt 우선순위를 올렸다.
   - TNF Mountain Jacket은 Purple Label / High Mountain / Nanamica variants를 흡수하지 않도록 차단했다.
   - RRL Denim generic row는 `jeans` 기본값을 갖게 했다. 단, 명시적 denim shirt/shorts/pants 키워드는 parser가 계속 우선한다.

3. 이번 wave에서도 DB mutation은 하지 않았다.
   - 이미 들어간 stale pool row는 다음 tick/score 평가 또는 별도 capped cleanup에서 빠질 수 있다.
   - 현재 작업의 목적은 public gate와 parser/catalog 기준선을 먼저 안정화하는 것이다.

## Read-Only Impact Check

최종 리포트 기준:

- activeClothingPoolRows: 230
- allowedAfterCurrentGate: 81
- blockedAfterCurrentGate: 149
- flaggedAllowedRows: 50
- actionableAllowedRows: 0

`flaggedAllowedRows` 50개는 대부분 기존 DB에 남은 parsed key/raw sku drift다. 현재 코드 기준으로 다시 파싱하면 허용 lane 내부에서 당장 추가 차단해야 하는 actionable 오염은 0개로 떨어졌다.

## Verification

```bash
npx tsx --test tests/core-rules.test.ts tests/wave254-5-fashion-condition.test.ts tests/fashion-catalog-regression.test.ts tests/wave254-6-product-type-priority.test.ts
npx tsx scripts/report-clothing-pool-purity.ts
```

Result: 170 pass / 0 fail.

Report totals:

- active: 230
- allowed: 81
- blocked: 149
- actionable allowed: 0

## Deferred

- 실제 `mvp_candidate_pool` row cleanup은 아직 실행하지 않았다.
- 다음 tick 이후 v11 reparse가 반영된 상태에서 clothing pool을 다시 확인한다.
- 남은 clothing ready lane은 계속 narrow lane 중심으로만 연다. Stussy basic/hoodie, BAPE tee, Polo Bear, Patagonia Retro-X/Down, Adidas Trefoil 같은 mixed lane은 enough clean sample이 확인되기 전까지 public ready로 올리지 않는다.
- 다음 audit 후보는 shoe/fashion compare sample purity와 bag category stale sku drift다.
