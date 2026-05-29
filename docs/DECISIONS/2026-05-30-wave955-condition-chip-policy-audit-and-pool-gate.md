# Wave 955 — Condition Chip Policy Audit And Pool Gate

## Context

User asked whether condition chips should become a stricter comparison axis, but only if the trade-off improves over time rather than permanently shrinking usable market samples.

## Decision

Do not enable exact chip-set comparison globally yet.

The right policy is staged:
1. Keep `comparable_key + condition_class / condition_tier` as the main price grouping.
2. Treat hard chips as an audit/exclusion axis first.
3. Only allow exact hard-chip grouping when both the broader condition lane and the specific hard-chip lane have enough samples.
4. Keep soft/premium chips as visible evidence and future price modifiers until per-SKU density is proven.

This gives us an improving system:
- as data grows, exact hard-chip lanes automatically become candidates;
- until then, sparse chip sets do not collapse the market basis;
- audit reports keep showing where AI ambiguity review should focus.

## Implemented

- Added `src/lib/condition-chip-policy.ts`.
  - Classifies chips into `hard_split`, `soft_adjustment`, `premium_signal`, and `neutral`.
  - Adds a sample-density gate for exact hard-chip comparison.
- Added `scripts/report-condition-chip-policy-audit.ts`.
  - No-write audit over ready/reserved pool rows.
  - Measures chip density, hard chip residue, suspicious high-grade rows, and exact hard-chip sparsity.
- Updated `/api/listings/[pid]/market-source`.
  - Comparison proof rows now merge `condition_notes` with grading chips, matching feed/detail-access/admin paths.
- Updated `candidate-pool-builder`.
  - Pool block checks now read both `mvp_listing_parsed.condition_notes` and `parsed_json.condition_notes`.
  - This closes a drift where hard notes stored in the column could remain ready.

## DB Audit Result

Command:

```bash
npx tsx scripts/report-condition-chip-policy-audit.ts --limit=5000 --statuses=ready,reserved
```

Result over 3,995 ready/reserved rows:
- rowsWithChips: 1,331 (33.3%)
- hardSplitRows: 13 (0.3%)
- softAdjustmentRows: 681 (17.0%)
- premiumSignalRows: 632 (15.8%)
- suspiciousHighGradeRows: 25
- exactHardChipSparseRows: 10
- exactHardChipReadyRows: 3

Interpretation:
- Hard chip residue is small but important.
- Exact hard-chip comparison is not dense enough globally; only 3 rows currently pass the sample-density gate.
- 10 rows would lose useful comparison support if exact chip matching were forced today.
- The 25 suspicious high-grade rows should feed the ambiguity/AI audit queue, not immediate bulk invalidation.

## Trade-off

Accepted:
- Additional audit complexity and a stricter future gate.

Rejected for now:
- Global exact chip equality in comparison lists.
- Bulk invalidation of all suspicious chip rows without reviewing ambiguity/negation context.

Reason:
- Hard chips are rare and operationally valuable, but exact chip sets are still sparse.
- The policy should become stricter as sample density improves, not make current MVP comparisons brittle.

## Verification

```bash
npx tsx --test tests/condition-chip-policy.test.ts tests/condition-display.test.ts tests/condition-policy-pool-gate.test.ts
npm run build
```

Both passed.
