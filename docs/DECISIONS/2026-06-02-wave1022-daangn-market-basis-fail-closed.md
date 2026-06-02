# Wave 1022 - Daangn market basis fail-closed

Date: 2026-06-02 KST

## Context

User asked to audit whether main/feed/detail/easy-mode prices are calculated correctly, with Daangn as the highest priority. Daangn is cheaper and local-first, so Daangn listings must not use Bunjang/Joongna/mixed market medians as the actual buy decision basis.

## Findings

- `/api/packs/pool` intended to use Daangn source-specific median only, but if `skuMedianFinal` became `0`, it left stale positive `candidate_pool.expected_profit_*` in place. That allowed old ready rows with missing Daangn basis to survive into the feed response.
- `/api/packs/pool/detail-access` had an older fallback that reused DB `sku_median` when Daangn source basis was missing. This could resurrect mixed/batch fallback residue in detail/easy calculations.
- `marketBasisForCandidate` returned mixed/reference fallback for Daangn when same-source samples were insufficient. Downstream guards caught some paths, but the function itself was too permissive for the current policy.
- `scoreStage` could create new Daangn `sku_median` values from in-tick batch fallback or reference price even when Daangn per-source daily stats were missing.
- Score-stage market stat maps were still keyed by `condition_class` only. Existing daily tables include `condition_tier`, so shoe/clothing/golf-style tiered pricing could be selected incorrectly.
- Market daily blended price is not sold-only. It uses sold median with increasing weight when sold samples exist; when sold samples are missing, active median is discounted by 0.92. This is intentional for sparse Daangn sold data, but the source must be Daangn-only.

## Decisions / Changes

- Daangn market basis is now fail-closed:
  - same-source `sourceSampleUsed` must be true;
  - active + sold same-source samples must be at least 3;
  - otherwise median/profit is not used for feed/detail/easy mode.
- `/api/packs/pool` now sets recomputed profit to `0` when `skuMedianFinal <= 0`, so stale `candidate_pool.expected_profit_*` cannot leak to the feed.
- Detail access no longer revives Daangn items using stale DB `sku_median` when same-source market basis is missing.
- `/me` reveal dashboard now treats Daangn source fallback as stale/zero current profit.
- `scoreStage` no longer uses batch fallback or reference price to score Daangn rows without source-specific market stats.
- Market stat maps in feed and score-stage now include `condition_tier` in the key.
- Contract tests were updated to lock the fail-closed policy.

## Verification

- `npx tsx --test tests/daangn-market-basis-contract.test.ts`
- `npx tsx --test tests/condition-profit-adjustment.test.ts tests/daangn-ingest.test.ts`
- `npm run build`
- `git diff --check`

## Deferred

- Existing stale Daangn ready rows in `candidate_pool` are not bulk-invalidated in this wave. User-facing APIs now filter them, and score/recovery paths should stop creating new ones. A later cleanup/recovery sweep can remove existing stale rows if admin pool count needs to be cosmetically aligned.
- No change to the daily blended pricing formula. Sold-vs-active weighting should be evaluated separately with real Daangn lifecycle data.
