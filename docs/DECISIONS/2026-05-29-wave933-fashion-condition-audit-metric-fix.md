# Wave 933 — Fashion condition audit metric fix

Date: 2026-05-29

## Decision
- Fixed `scripts/report-fashion-shoe-db-sweep.ts` so `shoe_unknown_condition` follows the current production condition source.
- The previous sweep counted `parsedJson.shoe_condition_tier == null`, which is the legacy `parseShoeOptions()` tier. Since Wave 763/Wave 882, shoe comparable keys and UI condition tiers are driven by `parsedJson.condition_grade.tier`.
- New audit rule: count unknown shoe condition only when `condition_grade.tier === UNKNOWN`, or when the comparable key still contains `unknown_condition` and no condition grade exists.

## Why
- Wave 931 initially reported `shoe_unknown_condition: 119`, but samples showed normal ready rows with current comparable keys like `...|b_grade`, `...|a_grade`, or `...|s_grade`.
- That was audit noise, not exposed status corruption.
- Without this fix, future sessions could mistakenly hard-gate healthy shoe rows and shrink the ready pool.

## Verification
- Re-ran pool-scope sweep after the metric fix:
  - raw SKU differs from current catalog: 0
  - DB-clean rows that current catalog changes: 0
  - pool exposed with catalog/parser drift: 0
  - shoe unknown condition: 0
  - shoe defaulted to sneaker: 87
  - shoe unknown size: 0
  - pool drift plan rows: 0
  - ready/reserved fashion pool rows sampled: 1,554

## Current Read
- The 27-row Wave 931 drift cleanup remains clean.
- Current ready/reserved shoe rows are not missing production condition tier under the current `condition_grade` system.
- `shoe_product_type_defaulted_to_sneaker` remains a signal-quality queue. It is not automatically wrong because many shoe SKUs are model-level sneaker lanes where product type can safely default.

## Deferred
- Do not treat `shoe_product_type_defaulted_to_sneaker` as a hard blocker without SKU-level sampling.
- Next useful audit is product-type default sampling: separate safe sneaker defaults from real boot/sandal/loafer/slipper misses.

## Artifacts
- `reports/fashion-shoe-db-sweep-latest.json`
- `reports/fashion-shoe-db-sweep-latest.md`
