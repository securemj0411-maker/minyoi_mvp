# 2026-05-22 Wave 533 — pool recovery + shoe title product-type priority

## Context

- User asked whether there was anything left to continue after recent fashion/shoe/bag parser hardening and the pool shrink incident.
- Prior audit had recovered a small recent subset, but a wider stale/accident reason scan still showed remaining invalidated pool rows.

## Decisions / Changes

- Treat only clear accident/stale invalidation reasons as recovery candidates:
  - `pool_eligible_false_residue`
  - `pool_eligible_false`
  - `stale_parser_version_clothing_residue`
  - `stale_parser_version_shoe_residue`
  - `stale_parser_version_bag_residue`
- Do **not** directly flip invalidated rows back to ready. Instead:
  - upsert current parser output into `mvp_listing_parsed`;
  - mark currently scorable rows `mvp_raw_listings.score_dirty=true`;
  - let `scoreStage` re-run candidate-pool gates.
- Added an Arc'teryx Vertex/Squamish clothing guard so trail/running/등산화 Vertex shoe listings cannot enter the clothing lane.
- Fixed shoe parser priority:
  - shoe `product_type` now prefers title-level signals before description text;
  - this prevents descriptions such as "Heel height" from turning a title-level sneaker listing into `pump`.

## Production DB Actions

- Rewrote current parser output for 302 pool rows carrying the accident/stale invalidation reasons.
- Marked 232 currently scorable rows `score_dirty=true`.
- Ran one local `scoreStage` pass:
  - scored 72 rows;
  - upserted 61 analysis rows;
  - inserted/updated 28 ready pool rows;
  - skipped 44 rows through normal pool gates.
- Post-run pool count:
  - ready total: 259
  - ready with `expected_profit_min <= 150000`: 236
- Replayed the 302-row recovery scope:
  - dirty missing: 0
  - parser DB drift: 0
  - current null SKU: 3
  - current needs-review: 14

## Sample Replay

- Recent ready fashion/shoe/bag targets:
  - 13 ready rows
  - 12 comparable keys
  - target drift: 0
- Comparable sample replay initially found 16 stale parsed sample rows.
  - Updated those rows to current parser output and marked 13 scorable rows dirty.
  - Notable corrected sample pollution:
    - RRL denim jacket rows moved away from generic `polo_rrl_jacket_coat`.
    - BAPE/FoG/TNF/Dr. Martens samples had stale condition-tier keys rewritten.

## Risk / Follow-up

- Local parser is now `wave216-clothing-v20`, but production cron appears capable of writing older `wave216-clothing-v13` rows if the code is not deployed.
- Follow-up check over latest 200 fashion/shoe/bag parsed rows showed most rows still on deployed/old parser versions:
  - `shoe:wave92-shoe-v11`: 150
  - `clothing:wave216-clothing-v13`: 41
  - `bag:wave92-bag-v11`: 6
  - current local versions appeared only sparsely (`clothing:v20` 2, `shoe:v16` 1).
- Therefore DB-only cleanup is not durable until the parser/catalog changes are deployed.
- Deployment should be scoped carefully because the current worktree contains many unrelated dirty files from parallel UI/payment/legal/admin work.
- Verification after this note:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts` passed 261 tests.
  - `npm run build` passed.
  - `git diff --check` on the touched parser/catalog/test/log scope passed.
- Further `scoreStage` runs may invoke AI shadow audit/cost. One local score run reported AI shadow audit activity; do not repeatedly run broad score passes without owner awareness.
- Deferred:
  - size-specific turnover grouping / velocity sample separation remains a later wave.
  - broad condition-tier policy remains conservative; some rows now move from `a_grade` to `b_grade`/`c_grade` rather than being blocked.
