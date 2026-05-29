# Wave 964 — Condition Chip Comparison Proof

Date: 2026-05-30 KST

## Context

Wave 963 tightened condition chip parsing, but the visible detail-page comparison proof still mainly used broad axes:

- `condition_class`
- fashion `condition_tier`
- fashion product type
- source-aware Daangn proof filtering
- price outlier trimming

That meant newly detected hard defects such as display damage, lock/SIM issues, parts-only signals, one-side earphone units, or structural fashion damage could still leak into the user-visible "same condition" comparison list when the broader condition bucket matched.

## Decision

Use hard condition chips as a final visible-proof filter in `market-source`:

- If the target listing has no hard condition chip, exclude comparison rows that do have a definite hard chip.
- If the target listing has a hard chip signature, only enable exact hard-chip matching when `shouldUseExactHardChipComparison` says the slice has enough density.
- Keep soft adjustment chips and premium chips as display/evidence signals for now. They are not exact comparison split keys yet.

This keeps the user-facing proof cleaner without changing the market median schema or the worker aggregation tables.

## Why Not Global Chip Median Yet

The latest ready/reserved audit showed hard-chip density is still low:

- pool rows audited: 4,197
- rows with chips: 1,402
- hard split rows: 7
- exact hard-chip ready rows: 3

So global chip-set market medians would over-split sparse data today. Visible proof filtering is a safer intermediate step.

## Verification

Local targeted verification:

```bash
npx tsx --test --test-name-pattern "market source API|condition chip policy" tests/detail-beginner-guide-contract.test.ts tests/condition-chip-policy.test.ts
npm run build
```

Result:

- targeted tests: 6 pass, 0 fail
- production build: passed

Note: running the full `tests/detail-beginner-guide-contract.test.ts` file still fails on pre-existing detail modal string contracts unrelated to this market-source change. The newly added market-source contracts pass under the targeted test pattern.

## Deferred

- Soft chip comparison penalties, such as missing accessories, low battery health, stains, and hygiene warnings, remain display-first until per-SKU density is proven.
- DB market aggregation still groups by comparable key and broad condition axes. Exact chip-set market rows require a separate density/backfill design.
- UI display of comparable-row chip labels can be improved in a follow-up; this wave only changes which rows are eligible as visible proof.
