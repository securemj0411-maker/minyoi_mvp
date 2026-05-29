# Wave 943 — Earphone Condition Pool Cleanup

## Context

After the tech-device condition sweep, we continued with the dedicated earphone
condition gate. A parsed-table sweep over 3,000 earphone rows showed the current
runtime parser catches all hard earphone condition candidates:

- `missedByCurrentEvidence`: 0
- `reparsedConditionStillNormal`: 0

However, the ready/reserved pool still had stale `option-parser-v62` rows that
were parsed before the `pool_gate_v1` earphone evidence existed.

## Decisions

- Keep earphone condition evidence as the source of truth for audio/mic/pairing,
  battery, physical damage, one-side unit, charging-case-only, and protective
  case-only gates.
- Fix the generic visible-glass damage guard. The old pattern allowed bare
  `금 있`, which misread Korean phrases like `조금 있어서` as display damage.
  This caused normal earphone cosmetic-wear rows to become `display_defect`.
- Bump `PARSER_VERSION` from `option-parser-v69` to `option-parser-v70` so the
  normal parser drift path can reparse stale generic categories.
- Extend `apply-cross-category-current-reparse-cleanup.ts` so a current reparse
  that produces a pool-block note or `earphone_condition_*` policy becomes an
  actionable cleanup candidate, not just an ignored condition-class drift.

## Production DB Action

Ran a scoped apply for earphone ready/reserved rows:

```bash
npx tsx scripts/apply-cross-category-current-reparse-cleanup.ts \
  --categories=earphone \
  --statuses=ready,reserved \
  --reason=wave942_earphone_condition_reparse_cleanup \
  --apply
```

Result:

- scanned pool rows: 488
- candidate rows: 6
- invalidated pool rows: 5
- refreshed/reparsed rows: 5
- reclassified SKU-only rows: 1

The invalidated rows were stale ready earphone rows with hard current evidence:
mic issue, audio output issue, physical damage, and battery degradation.

## Verification

Post-apply ready/reserved earphone sweep:

- analyzed rows: 483
- candidate rows: 0
- missed by current evidence: 0
- stored condition still normal: 0
- reparsed condition still normal: 0

Post-apply cleanup dry-run:

- scanned pool rows: 483
- candidate rows: 0
- invalidate pool rows: 0

Tests:

```bash
npx tsx --test \
  tests/option-parser-visible-damage-regression.test.ts \
  tests/earphone-condition-evidence.test.ts \
  tests/core-rules.test.ts
```

Result: 159 pass, 0 fail.

## Deferred

- Existing parsed-table history can still contain stale non-pool rows. The pool
  is clean after this scoped apply, and the `option-parser-v70` drift path should
  naturally refresh remaining historical rows.
- The generated deepsweep reports are operational artifacts and were not added
  to source control.
