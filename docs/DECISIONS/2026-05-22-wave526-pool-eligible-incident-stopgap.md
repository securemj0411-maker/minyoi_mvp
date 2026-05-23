# Wave 526 — Pool Eligible Incident Stopgap

## Context
- Production ready pool dropped sharply after local score-stage runs.
- Read-only audit showed `pool_eligible_false` / `pool_eligible_false_residue` invalidations were concentrated on Bunjang rows.
- These rows were mostly active/detail-done/normal/SKU-matched public marketplace listings, so the flag was not safe to interpret as a universal hard block.

## Decision
- Treat `mvp_raw_listings.pool_eligible=false` as a hard block unless it is a stale public Bunjang row.
- For Bunjang, legacy/stale `pool_eligible=false` values are ignored by pool-builder/runtime cleanup only when the row does not look like internal acquisition/boost observation (`query=internal_acquisition:*`, `query=wave*_boost:*`, or matching `raw_json.source`).
- Restore seller-rating semantics to the prior conservative rule: rating `< 3.5` blocks only when `shop_review_count > 0`.

## Implemented
- `candidate-pool-builder` now carries an explicit `poolEligibleFalseStale` boolean and ignores only that stale-public case.
- `scoreStage` now carries `source/query/raw_json` context, uses source/context-aware raw eligibility checks, and no longer invalidates stale-public Bunjang ready/reserved residues solely for `pool_eligible=false`.
- Low seller rating residue cleanup now requires a positive review count.
- Regression tests added for Bunjang stale false and zero-review low-rating rows.

## Verification
- `npx tsx --test tests/core-rules.test.ts tests/wave249-pool-builder-clamp-fix.test.ts tests/wave238-ai-l2-shadow-audit.test.ts`
  - 123/123 passing.

## Production Evidence
- Current ready pool during follow-up audit: 64.
- Invalidated by `pool_eligible_false` / `pool_eligible_false_residue`: 564.
- Active Bunjang/detail-done/normal/SKU candidates among those: 512.
- Internal acquisition/boost-looking rows among those active candidates: 0 in the count query.
- Invalidated by `seller_rating_below_3_5_review`: 104.
- Active Bunjang/detail-done/SKU with zero reviews among seller-rating invalidations: 0 in the count query.

## Deferred
- Do not blindly set candidate-pool rows back to `ready`.
- Safer recovery path: patch the 512 stale-public Bunjang raw rows to `pool_eligible=true, score_dirty=true`, then rerun score-stage so the current parser, market, seller, and profit gates decide re-entry.
- This is a production data restore and should be applied only after explicit confirmation.

## Applied Restore
- User confirmed production restore.
- First recovery pass found the incident was broader than the candidate-pool invalidation sample:
  - stale-public Bunjang active/detail-done/normal/SKU rows with `pool_eligible=false`: 20,000 fetched at cap.
  - patched: 20,000 rows to `pool_eligible=true`, `score_dirty=true`.
  - score-stage replay: 8 passes.
- Second recovery pass found remaining stale-public rows:
  - patched: 11,249 rows to `pool_eligible=true`, `score_dirty=true`.
  - score-stage replay: 12 high-limit passes.
- Final small cleanup:
  - patched: 28 remaining stale-public rows.
  - score-stage replay: 1 high-limit pass.
- Final counters:
  - ready pool: 271.
  - Bunjang active/detail-done/normal/SKU rows still `pool_eligible=false`: 0.
  - score-stage pool-eligible residue/pre-upsert blocks during replay: 0.
  - remaining `pool_eligible_false(_residue)` invalidated candidate_pool rows: 281, expected to be old invalidated records that can be overwritten by future scoring or reviewed separately.
- Re-entry was not forced directly. Rows re-entered only if current score-stage gates accepted them; common skip reasons were `negative_resell_gap`, `sku_median_unavailable`, `profit_below_pack_band`, `num_comment_above_8`, quantity, fraud-group, and internal-only lane gates.
