# 2026-05-21 Wave 427 — Carhartt/CDG conservative lane tightening

## Decisions
- Carhartt broad jacket samples were split only for high-confidence repeated model lanes:
  - `clothing-carhartt-detroit-jacket`
  - `clothing-carhartt-active-jacket`
- Champion clothing broad now rejects Nike/Dunk/championship-court shoe wording so Nike Dunk `챔피언쉽 코트` does not enter Champion apparel.
- CDG broad was narrowed by adding PLAY heart staple lanes:
  - `clothing-cdg-play-tee`
  - `clothing-cdg-play-cardigan`
  - `clothing-cdg-play-hoodie`
  - `clothing-cdg-play-polo`
  - `clothing-cdg-play-shirt`
- CDG apparel now blocks Korean/English cross-brand and bait terms (`나이키`, `컨버스`, `뉴발란스`, `반스`, `구찌`, `pvc`, `맛`, `스타일`, etc.) to avoid pulling style-bait or bag/shoe/collab rows into clothing broad.
- Clothing parser now treats denim + waist/inseam sizing like `31x32` as `jeans`, fixing `칼하트 스티치 데님 31x32` type_unknown.
- Diagnostic category conflict ignores included-paper shopping-bag phrasing and narrows English `shoulder` to `shoulder bag`.

## DB writes
- Cleared a Nike Dunk `챔피언쉽 코트` row from Champion clothing.
- Reclassified CDG PLAY tee/cardigan/hoodie/polo/shirt rows out of CDG broad.
- Reverted over-broad CDG recovery rows such as CDG/Nike collab clothing, PVC bag, and style-bait rows back out of CDG clothing.
- Reclassified Carhartt Detroit/Active rows into their new lanes.
- Repatched parsed rows with `return=representation`; residual stale rows still appear in the sweep and need another focused pass.

## Verification
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts` passed: 161 pass, 0 fail.
- `scripts/report-fashion-pool-purity.ts` remains clean: active 60, gateBlocked 0, flagged 0, actionable 0.
- Latest targeted sweep after this wave:
  - rawSkuRejectedByCurrentCatalog: 0
  - rawSkuDiffersFromCurrentCatalog: 0
  - dbCleanButCurrentCatalogRejects: 0
  - poolExposedWithDrift: 0
  - dbProductTypeUnknown: 1
  - parsedStaleVersion: 22
  - flaggedComparableGroups: 25

## Deferred
- Finish residual parsed stale convergence. The residual rows are not pool-exposed, but the DB sweep still reports stale samples.
- Champion broad remains price-spread heavy because Reverse Weave/vintage/basic rows are mixed; split Reverse Weave/vintage lanes in a later wave.
- Carhartt pants still mix single-knee/double-knee/cargo/work pants; split only if repeated evidence remains strong.
- Size/rotation-rate bucketing remains deferred as a separate wave; current work intentionally did not change velocity grouping.
- Avoid scoreStage unless necessary. If forced later, set `AI_L2_SHADOW_AUDIT_ENABLED=0`, `PIPELINE_AI_REVIEW_TOP_N=0`, and `PIPELINE_SCORE_AI_CONDITION_DAILY_LIMIT=0`.
