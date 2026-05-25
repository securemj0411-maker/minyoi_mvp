# Wave 884 - 14h master change log and handoff

## Why This Exists

- User asked whether the whole long-running work was logged, not just the final score hotpath follow-up.
- Answer at the moment of the ask: individual decision logs existed, but there was no single master handoff covering the whole 14h work span.
- This file is the master index and summary for another session to continue safely.
- Do not use `30일_실행계획.md` as the work log. Per project instruction, decision logs live under `docs/DECISIONS/`.

## Scope Covered

- Primary workstream:
  - Fashion/shoe DB and pool quality audit.
  - SKU/sample pollution cleanup.
  - `internal_only` / public-ready safety decisions.
  - Current parser/catalog replay against recent raws and pool samples.
  - All-category deep sweep after fashion/shoe work.
  - Runtime score/market drain after cleanup.
- Secondary but related workstream:
  - Joongna/shoe inflow diagnosis.
  - Pool ready drop diagnosis and recovery.
  - Score worker hotpath diagnosis.
- Not claimed as part of this fashion/sweep task:
  - Existing dirty billing/manual-deposit/credit UI files may be from other workstreams. They are visible in `git status`, but should not be assumed to be part of the fashion/shoe cleanup unless the owning session confirms.

## Existing Per-Wave Logs

- Fashion pool and systemic diagnosis:
  - `2026-05-24-wave801-fashion-pool-purity-diagnosis.md`
  - `2026-05-24-wave802-fashion-systemic-sample-cleanup.md`
  - `2026-05-24-wave803-fashion-extra-problems.md`
  - `2026-05-24-wave804-cross-category-db-deep-sweep.md`
  - `2026-05-24-wave805-systemic-cross-category-reinforcement.md`
  - `2026-05-24-wave806-fashion-shoe-axis-deepsweep.md`
- Fresh feedback / current pool / runtime readiness:
  - `2026-05-25-wave807-recent-feedback-pool-learning.md`
  - `2026-05-25-wave807-shoe-inflow-funnel.md`
  - `2026-05-25-wave808-all-category-parser-drift-sweep.md`
  - `2026-05-25-wave809-shoe-sku-safety-sample-audit.md`
  - `2026-05-25-wave810-shoe-sample-key-cleanup.md`
  - `2026-05-25-wave811-shoe-exact-axis-promotion.md`
  - `2026-05-25-wave812-clothing-sample-safety.md`
  - `2026-05-25-wave813-fashion-sku-safety-gate-fix.md`
  - `2026-05-25-wave814-all-category-runtime-readiness-and-sku-safety.md`
- Shoe cleanup and exact/internal decisions:
  - `2026-05-25-wave815-shoe-ready-sample-pollution-cleanup.md`
  - `2026-05-25-wave817-cdg-nike-exact-split.md`
  - `2026-05-25-wave818-shoe-broad-watch-pollution-cleanup.md`
  - `2026-05-25-wave819-mercurial-exact-split.md`
  - `2026-05-25-wave820-superstar-broad-pollution-cleanup.md`
  - `2026-05-25-wave821-dunk-broad-exact-and-pollution-cleanup.md`
  - `2026-05-25-wave822-gucci-rhyton-internal-only.md`
  - `2026-05-25-wave823-bape-sta-goods-and-internal-only.md`
  - `2026-05-25-wave824-yeezy-350-broad-pause.md`
  - `2026-05-25-wave825-vans-style36-mule-cleanup.md`
  - `2026-05-25-wave826-asics-metaspeed-apparel-spike-cleanup.md`
  - `2026-05-25-wave827-hoka-satisfy-mafate-clifton-split.md`
  - `2026-05-25-wave828-nb-casablanca-327-xc72-split.md`
  - `2026-05-25-wave851-shoe-top-broad-routing-cleanup.md`
  - `2026-05-25-wave852-mizuno-prophecy-axis-backfill.md`
  - `2026-05-25-wave853-shoe-next-broad-routing-cleanup.md`
  - `2026-05-25-wave854-adererror-converse-cap-backfill.md`
  - `2026-05-25-wave855-shoe-mid-broad-routing-cleanup.md`
  - `2026-05-25-wave856-shoe-next-mid-broad-and-puma-stale-fix.md`
  - `2026-05-25-wave857-shoe-lower-mid-broad-routing-cleanup.md`
  - `2026-05-25-wave858-shoe-high-eligible-broad-cleanup.md`
  - `2026-05-25-wave859-shoe-next-high-eligible-broad-cleanup.md`
  - `2026-05-25-wave860-shoe-nb-crocs-clarks-cleanup.md`
  - `2026-05-25-wave861-shoe-remaining-broad-cleanup.md`
  - `2026-05-25-wave862-shoe-mid-tail-broad-audit.md`
  - `2026-05-25-wave863-shoe-small-exact-and-broad-audit.md`
  - `2026-05-25-wave864-shoe-lower-tail-audit.md`
  - `2026-05-25-wave873-shoe-probably-safe-and-top-public-audit.md`
  - `2026-05-25-wave874-shoe-safe-public-mid-audit.md`
  - `2026-05-25-wave875-shoe-safe-public-lower-mid-audit.md`
  - `2026-05-25-wave876-shoe-safe-public-tail-audit.md`
  - `2026-05-25-wave878-shoe-safe-public-final-tail-audit.md`
- Clothing cleanup and audits:
  - `2026-05-25-wave816-clothing-ready-sample-spread-cleanup.md`
  - `2026-05-25-wave829-lacoste-pique-polo-narrow-cleanup.md`
  - `2026-05-25-wave830-fog-essentials-jacket-internal-only.md`
  - `2026-05-25-wave831-bape-hoodie-zip-axis-cleanup.md`
  - `2026-05-25-wave832-stussy-halfzip-special-axis-cleanup.md`
  - `2026-05-25-wave833-polo-brand-signal-and-subline-cleanup.md`
  - `2026-05-25-wave834-rrl-product-axis-cleanup.md`
  - `2026-05-25-wave835-acne-denim-model-axis-cleanup.md`
  - `2026-05-25-wave836-patagonia-subtype-product-key-cleanup.md`
  - `2026-05-25-wave837-lacoste-pique-tail-key-cleanup.md`
  - `2026-05-25-wave838-stussy-direct-axis-and-tail-key-cleanup.md`
  - `2026-05-25-wave839-polo-knit-oxford-brand-and-tail-cleanup.md`
  - `2026-05-25-wave840-rrl-denim-pants-shirt-tail-resweep.md`
  - `2026-05-25-wave841-acne-denim-and-broad-fallback-cleanup.md`
  - `2026-05-25-wave842-stussy-vintage-other-brand-fixnow-cleanup.md`
  - `2026-05-25-wave843-bape-zip-tail-refresh.md`
  - `2026-05-25-wave844-patagonia-retro-down-tail-resweep.md`
  - `2026-05-25-wave845-clothing-probably-safe-tail-resweep.md`
  - `2026-05-25-wave846-shoe-feedback-pid-routing-review.md`
  - `2026-05-25-wave847-clothing-feedback-pid-routing-review.md`
  - `2026-05-25-wave848-clothing-top-broad-routing-cleanup.md`
  - `2026-05-25-wave849-clothing-next-broad-routing-cleanup.md`
  - `2026-05-25-wave850-clothing-remaining-broad-and-salehe-cap-cleanup.md`
  - `2026-05-25-wave865-clothing-top-broad-audit.md`
  - `2026-05-25-wave866-clothing-next-broad-audit.md`
  - `2026-05-25-wave867-clothing-mid-broad-audit.md`
  - `2026-05-25-wave868-clothing-tail-watch-audit.md`
  - `2026-05-25-wave869-clothing-probably-safe-audit.md`
  - `2026-05-25-wave870-clothing-safe-public-top-audit.md`
  - `2026-05-25-wave871-clothing-safe-public-mid-audit.md`
  - `2026-05-25-wave872-clothing-safe-public-tail-audit.md`
  - `2026-05-25-wave877-moncler-broad-maya-cleanup.md`
- Final all-category / score handoff:
  - `2026-05-25-wave879-cross-category-visible-pool-and-short-condition.md`
  - `2026-05-25-wave880-recent-current-drift-and-internal-fashion-lanes.md`
  - `2026-05-25-wave881-current-replay-drain-y3-qasa-nb327.md`
  - `2026-05-25-wave882-all-category-current-sample-cleanup.md`
  - `2026-05-26-wave883-score-hotpath-and-handoff.md`
  - This file: `2026-05-26-wave884-14h-master-change-log.md`

## Main Code Areas Changed

- Catalog generated files:
  - Shoe and clothing catalogs were tightened across broad/narrow lanes.
  - New or adjusted generated files include:
    - `src/lib/generated/catalog-805-fashion-axis-splits.ts`
    - `src/lib/generated/catalog-806-fashion-shoe-axis-splits.ts`
    - `src/lib/generated/catalog-811-shoe-exact-axis-splits.ts`
    - `src/lib/generated/catalog-880-fashion-current-drift.ts`
  - Existing generated catalogs touched include:
    - `catalog-712b-bias-free.ts`
    - `catalog-712c-shoe-bulk.ts`
    - `catalog-715-clothing-narrow.ts`
    - `catalog-728-leak-fix.ts`
    - `catalog-729-carhartt-broad.ts`
    - `catalog-732-multi-brand.ts`
    - `catalog-733-shoe-broad.ts`
    - `catalog-734-mega-brand.ts`
    - `catalog-736-mm6-lacoste.ts`
    - `catalog-760-game-titles.ts`
    - shoe broad/narrow wave files and `catalog-wave266-*`.
- Parser and grading:
  - `src/lib/parsers/wave92-fashion-mobility.ts`
    - Fashion condition tier now drives comparable key even when condition is unknown.
  - `src/lib/option-parser.ts`
  - `src/lib/grading/shoe-condition.ts`
  - `src/lib/grading/shoe-axes.ts`
  - `src/lib/grading/clothing-condition.ts`
  - `src/lib/grading/clothing-axes.ts`
- Pool and runtime:
  - `src/lib/candidate-pool-builder.ts`
  - `src/lib/category-readiness.ts`
  - `src/lib/catalog.ts`
  - `src/lib/tick-pipeline.ts`
    - Low-volume SKU scan now supports `PIPELINE_LOW_VOLUME_MAX_ROWS`.
    - Low-volume scan is ordered by newest `first_seen_at`.
    - Fraud group hash timeout default reduced to avoid non-fatal 5s stalls.
- Diagnostics and apply scripts created:
  - `scripts/report-cross-category-db-deep-sweep.ts`
  - `scripts/report-fashion-ready-pool-systemic-audit.ts`
  - `scripts/report-shoe-sku-safety.ts`
  - `scripts/report-shoe-inflow-funnel.ts`
  - `scripts/report-all-category-funnel.ts`
  - `scripts/apply-cross-category-current-reparse-cleanup.ts`
  - `scripts/apply-cross-category-tier-backfill-batch.ts`
  - `scripts/apply-fashion-current-catalog-reclassify.ts`
  - `scripts/apply-fashion-parser-drift-requeue.ts`
  - `scripts/apply-all-category-parser-drift-requeue.ts`
  - `scripts/apply-wave809-shoe-sku-safety-cleanup.ts`
  - `scripts/apply-wave810-shoe-probably-safe-cleanup.ts`
  - `scripts/recover-ready-pool-current-safe.ts`
  - `scripts/run-market-stats-stage-once.ts`
  - `scripts/run-parser-drift-stage-once.ts`
  - `scripts/run-score-stage-once.ts`

## Major Behavioral Decisions

- Broad fashion/shoe SKUs are not automatically safe just because they have samples.
- SKUs with repeated weird sample pollution were either:
  - tightened by deterministic catalog/parser rules,
  - split into exact lanes,
  - or kept/returned to `internal_only` when evidence was insufficient.
- Product-axis separation was prioritized:
  - hoodie vs zip hoodie vs crewneck vs tee vs pants vs cap.
  - shoe sneaker vs mule/slide/football boot/running shoe/golf shoe, etc.
  - Arc'teryx-style sub-line splits are necessary but not the only issue.
- Current catalog rejection should override stale raw SKU fallback.
- `needs_review=true` rows should not be counted as actionable parser/catalog mismatch in diagnostics.
- Sample cleanup should invalidate/recompute market keys, not only edit parsed rows.
- LEGO physical sets must not pollute game-title samples.
- Unknown fashion condition should be explicit in comparable keys (`unknown_condition`) rather than hiding inside a normal tier.

## Important Specific Fixes

- Y-3 QASA:
  - Apparel matcher blocks QASA/Kaiwa/Adios/Takumi shoe terms.
  - Shoe QASA matcher broadened.
  - Backfilled PIDs `282211589` and `398751123`.
- NB327:
  - PID `172619812` corrected to `a_grade`.
- Mizuno:
  - Golf rows that were misparsed as shoes were found in current replay and backfilled.
- Game/goods:
  - Cyberpunk goods/accessories blocked from game-title SKU.
  - LEGO game SKU now requires explicit game/platform signals.
  - 67 physical LEGO rows removed from `switch-game-lego` samples.
- Shoes:
  - Multiple broad lane audits/splits/internal-only decisions were logged for CDG Nike, Mercurial, Superstar, Dunk, Gucci Rhyton, BAPE STA, Yeezy 350, Vans Style36 mule, Asics Metaspeed, Hoka Satisfy/Mafate/Clifton, NB Casablanca/327/XC72, Mizuno Prophecy, Adererror Converse, Puma and remaining broad/tail lanes.
- Clothing:
  - Multiple broad lane audits/splits/internal-only decisions were logged for Lacoste pique, FOG Essentials jacket, BAPE hoodie/zip, Stussy halfzip/direct/vintage, Polo, RRL, Acne denim, Patagonia, Moncler Maya and clothing safe-public tail audits.

## DB Actions That Matter

- 5k current replay:
  - Actionables found and backfilled.
  - Rerun ended with `actionableRows=0`, `poolActionableRows=0`.
- 20k all-category sweep:
  - Initial actionable rows: `128`.
  - Parsed current reparse upsert: `125`.
  - Current catalog rejects: `3`.
  - Market invalidations queued: `104`.
- LEGO cleanup:
  - `70` scanned.
  - `67` rejected from game samples.
  - Market invalidations queued: `1`.
- Desired current-key drift cleanup:
  - Raw-key drift candidates: `1213`.
  - Parsed key updated: `833`.
  - Raw SKU synchronized: `347`.
  - Current catalog rejects removed: `17`.
  - Dirty marked: `1166`.
  - Market invalidations queued: `1006`.
- Tail cleanup:
  - Residual tier mismatch fixed: `5`.
  - Remaining Cyberpunk goods rejected: `15`.
  - Market invalidations queued: `20`.
- Final all-category 20k sweep:
  - `auditedRows=20000`
  - `flaggedRows=67`
  - `actionableRows=0`
  - `poolRowsReadyOrReserved=67`
  - `poolActionableRows=0`
- Market stats runs:
  - Claimed invalidation keys: `500 + 500 + 86`.
  - Pool upserted: `1991 + 2756 + 924`.
- Pool snapshot after market drain:
  - `ready=538`
  - `invalidated=6106`
  - `spent=21`
  - Ready category highlights:
    - `shoe=169`
    - `clothing=146`
    - `earphone=59`
    - `smartphone=34`
    - `tablet=33`
    - `smartwatch=29`
    - `drone=20`

## Score / Runtime Work

- Large score runs initially timed out before scoring.
- Low-volume SKU scan was identified as a fixed-cost drag:
  - `low-volume-1000` timing probe took `5669ms`.
- `loadLowVolumeSkuIds()` now:
  - orders newest first,
  - caps default scan to `1000`,
  - allows override through `PIPELINE_LOW_VOLUME_MAX_ROWS`.
- `loadFraudGroupHashes()` default timeout reduced from `5000ms` to `1500ms`.
- Score verification:
  - 50-row run:
    - `scored=50`
    - `poolUpserted=5`
    - `timedOut=false`
  - 500-row backfill run:
    - `scored=449`
    - `upserted=364`
    - `poolUpserted=25`
    - `timedOut=false`
  - 300-row worker-budget run:
    - `scored=0`
    - `timedOut=true`
  - 100-row worker-budget run:
    - `scored=95`
    - `poolUpserted=1`
    - `timedOut=true`
- Conclusion:
  - Score can drain with small batches.
  - Production-like `tickScoreLimit=300` is still too aggressive under 55s.
  - Next session should lower score-worker effective limit or split cleanup/preload stages.

## Tests Run

- `npx tsx --test tests/fashion-catalog-regression.test.ts`
  - Result after latest catalog/test changes: `81/81 passed`.
- Deep sweep:
  - Final all-category 20k current replay: zero actionable rows.
- Score scripts:
  - Verified 50-row and 500-row score runs complete.
  - Verified 300-row worker-like run still fails before scoring.

## Current Git/Workspace Inventory

- Modified tracked files relevant to this work include:
  - `src/lib/tick-pipeline.ts`
  - `src/lib/parsers/wave92-fashion-mobility.ts`
  - `src/lib/option-parser.ts`
  - `src/lib/candidate-pool-builder.ts`
  - `src/lib/catalog.ts`
  - `src/lib/category-readiness.ts`
  - generated catalog files under `src/lib/generated/`
  - fashion/shoe grading files under `src/lib/grading/`
  - `tests/fashion-catalog-regression.test.ts`
  - `tests/wave254-5-fashion-condition.test.ts`
  - `tests/core-rules.test.ts`
- New files relevant to this work include:
  - many `docs/DECISIONS/2026-05-24-wave80*.md`
  - many `docs/DECISIONS/2026-05-25-wave80*.md` through `wave882`
  - `docs/DECISIONS/2026-05-26-wave883-score-hotpath-and-handoff.md`
  - this master log
  - reporting/apply scripts listed in the code area above
  - generated catalog split files `catalog-805`, `catalog-806`, `catalog-811`, `catalog-880`
  - `tests/cross-category-deepsweep-regression.test.ts`
  - `tests/fashion-parser-version-sync.test.ts`
- Current dirty workspace also contains billing/manual-deposit/credit UI files. Those should be treated as separate work unless confirmed.

## What Not To Do

- Do not roll back parser/catalog/current-sample cleanup to recover ready count.
- Do not blindly make all zero-sample SKUs `internal_only`.
- Do not assume `brand spread` alone is a misclassification signal.
  - Example: Polo brand spread can be misleading because SKU/product types differ.
- Do not use old raw SKU as stronger truth than current catalog rejection.
- Do not treat `needs_review=true` rows as safe public pool rows.
- Do not keep expanding one brand only; user explicitly wants all clothing/shoe and all-category systematic coverage.

## Next Session Checklist

- First, inspect this file plus:
  - `wave882`
  - `wave883`
  - latest shoe/clothing safety logs around `wave873`-`wave878`.
- Confirm no long-running script is active before starting.
- Consider immediate runtime patch:
  - lower score-worker effective `PIPELINE_TICK_SCORE_LIMIT` to `80-100`, or
  - add finer stage timings and split residue cleanup from scoring.
- Re-run:
  - score worker-like run with smaller limit and 55s budget,
  - pool snapshot by status/category,
  - all-category 20k current replay.
- Continue category sweeps only after runtime drain is stable.

## Last Known Process State

- At the time wave883 was written, `ps` showed no long-running `run-score-stage`, `report-cross-category`, or `market-stats` process.
- At the time this master log was written, only the `ps | rg` check process itself appeared.
