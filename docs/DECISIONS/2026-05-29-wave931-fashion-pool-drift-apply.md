# Wave 931 — Fashion/Shoe/Bag pool drift cleanup apply

Date: 2026-05-29

## Decision
- Applied the Wave 929 ready/reserved fashion drift plan to production data with a capped 27-row target list.
- Used `scripts/apply-cross-category-current-reparse-cleanup.ts` instead of writing a new DB mutator because it already implements the safe path: re-run current catalog/parser, patch raw SKU only when current catalog differs, upsert parsed rows, mark raw rows dirty, and invalidate pool rows whose comparable key/tier must be rebuilt.
- Did not mass-invalidate `shoe_unknown_condition` or `shoe_product_type_defaulted_to_sneaker`; those remain signal-quality audit queues, not hard blockers.

## Apply Summary
- target rows: 27
- raw rows fetched: 27
- parsed rows fetched: 27
- parsed rows refreshed/upserted: 27
- raw SKU reclassified: 8
- parser/key refresh without SKU change: 19
- current catalog rejects: 0
- pool rows invalidated before score rebuild: 23
- categories: shoe 22, clothing 5

## Score Rebuild
- Ran `scripts/run-score-stage-once.ts --limit=120 --budget-ms=120000` twice with AI shadow audit disabled.
- First run scored 120 rows, upserted 83 listing/analysis outputs, upserted 6 candidate pool rows, skipped 114.
- Second run scored 120 rows, upserted 66 listing/analysis outputs, upserted 3 candidate pool rows, skipped 117.
- Both runs had a non-fatal timeout in `clear non-scorable score_dirty`; scoreStage continued and completed.

## Verification
- Post-apply fashion ready/reserved sweep:
  - raw SKU differs from current catalog: 0
  - DB-clean rows that current catalog changes: 0
  - pool exposed with catalog/parser drift: 0
  - pool drift plan rows: 0
  - parsed stale version: 0
- Target 27 pool status after score:
  - ready: 9
  - invalidated: 18
- Target raw dirty state after two score passes:
  - rawDirty: 9
  - rawClean: 18
  - dirty leftovers are retry/cleanup queue residue, not exposed comparable-key drift.

## Current Read
- The original ready/reserved drift is fixed: exposed pool rows no longer carry stale raw SKU, stale parsed key, or stale comparable key for this fashion/shoe/bag target set.
- Rows that stayed/returned ready now use current comparable keys. Rows invalidated after scoring were removed because current scoring found negative resell gap, unavailable SKU median, low volume, non-positive profit, or condition-review blockers.
- Remaining quality work is next-wave parser/audit work: `shoe_unknown_condition` 119 and `shoe_product_type_defaulted_to_sneaker` 85 in the latest sweep.

## Deferred
- Do not blanket-clear the remaining rawDirty 9 by hand unless a later score queue audit proves they are stuck. Current behavior may be intentional stale-invalidated retry behavior.
- Do not hard-gate all `shoe_unknown_condition` rows yet. Sample and improve condition extraction first, otherwise ready pool may shrink for ambiguous but acceptable shoe listings.
- Investigate the recurring non-fatal score cleanup timeout separately; it is not blocking this cleanup, but it is operational noise.

## Artifacts
- `reports/cross-category-current-reparse-cleanup-dry-run-latest.json`
- `reports/cross-category-current-reparse-cleanup-apply-latest.json`
- `reports/fashion-shoe-db-sweep-latest.json`
- `reports/fashion-dirty-queue-latest.json`
