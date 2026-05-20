# Wave 407 — Clothing Pool Ready Gate Reset

Date: 2026-05-20

## Context

운영자 코멘트와 DB sweep에서 의류 pool 품질 문제가 반복 확인됐다. 신발은 인기종 위주로 검수 후 열었지만, 의류는 category-wide ready + broad apparel lane 조합 때문에 티셔츠/롱슬리브/후디/베스트/팬츠/가방성 매물이 같은 비교군으로 섞였다.

## Decisions

1. `clothing` category-wide ready를 폐쇄했다.
   - static `CATEGORY_READINESS.clothing.status`를 `internal_only`로 되돌렸다.
   - `evaluatePoolGate()`에는 DB/operator override가 실수로 clothing ready를 내려도, lane-ready가 아닌 clothing SKU는 pool에 못 들어가게 hard guard를 추가했다.

2. 위험한 clothing lane을 보수적으로 blocked 처리했다.
   - broad/fallback: `polo_rrl`, `polo_rrl_broad`, `tnf_supreme_collab(_broad)`, `arcteryx_broad`, `patagonia_apparel`, `mlb_apparel`, `adidas_trefoil` 등.
   - product-type mixed: `stussy_basic_tee`, `stussy_hoodie`, `bape_tee`, `polo_bear_collab`, `polo_rrl_tee`, `tnf_purple_label`, `stussy_nike_collab`, `patagonia_retro_x`, `patagonia_down` 등.
   - exact/model lane으로 판단 가능한 일부는 유지: `tnf_nuptse_1996`, `tnf_mountain_jacket`, `arcteryx_beta/alpha/gamma/atom`, `bape_shark_hoodie`, `fog_essentials_* product-type lanes`, `polo_rrl_shirt/pants/denim/jacket_coat` 등.

3. score 단계에서 stale raw `sku_id`를 그대로 믿지 않도록 바꿨다.
   - clothing raw row는 매번 현재 catalog `ruleMatch(title, description)`로 재평가한다.
   - 예: 과거 raw에 `clothing-polo-pique-classic`이 박혀 있어도 현재 catalog가 로어즈/세터/라코스테 매물을 Polo로 인정하지 않으면 pool/score에 재사용하지 않는다.

4. legacy `scripts/backfill-pool.mjs`는 clothing을 전부 pool 제외하도록 막았다.
   - 이 스크립트는 lane readiness를 평가하지 못하는 category-only backfill이다.
   - audited clothing narrow lane은 `tick-pipeline`의 lane-aware gate에서만 공개 pool로 들어가야 한다.

5. TNF Denali fleece catalog에 pants/bottoms 차단을 추가했다.
   - `데날리 팬츠/바지`가 fleece jacket SKU로 들어오는 오염을 차단했다.

## Read-Only Impact Check

Supabase read-only impact script 기준, 현재 active/reserved clothing pool 230개 중:

- 유지 가능: 83
- 다음 평가에서 차단 예상: 147

대표 차단군:

- `bape_tee`: 26
- `stussy_hoodie`: 19
- `tnf_nuptse_broad`: 14
- `patagonia_retro_x`: 11
- `patagonia_down`: 6
- `polo_bear_collab`: 6
- stale raw SKU 기반 오염: Polo pique / TNF Nuptse vest / Supreme TNF pants/bag 등

DB mutation은 하지 않았다. 실제 `mvp_candidate_pool` invalidation은 다음 score/tick 평가 또는 별도 capped cleanup으로 실행된다.

## Verification

```bash
npx tsx --test tests/core-rules.test.ts tests/wave254-5-fashion-condition.test.ts tests/fashion-catalog-regression.test.ts tests/wave254-6-product-type-priority.test.ts
```

Result: 162 pass / 0 fail.

## Deferred

- 남은 83개 allowed lane도 완전 확정은 아니다. 다음 pass에서 `polo_rrl_jacket_coat`, `polo_rrl_denim`, `arcteryx_*`, `acne_*`, `fog_essentials_*`를 lane별 sample purity로 추가 audit한다.
- `polo_rrl_jacket_leather_suede`, `polo_rrl_knit`, Patagonia Synchilla/Retro-X split 등은 enough clean sample이 확인되기 전까지 public ready로 올리지 않는다.
- 이미 pool에 들어간 147개 예상 차단 row는 다음 tick에서 자연 invalidation되며, 즉시 제거가 필요하면 capped cleanup script를 별도 실행한다.
