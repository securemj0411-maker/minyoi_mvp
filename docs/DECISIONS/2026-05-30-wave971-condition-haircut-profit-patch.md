# Wave 971 — Condition Haircut Profit Patch

Date: 2026-05-30 KST

## Context

Wave 970 removed ready/reserved rows whose condition haircut made expected profit drop to zero. After that, some rows still had positive profit after haircut but their `mvp_candidate_pool.expected_profit_min/max` remained higher than the adjusted value.

This is not a pool eligibility problem, but it is a user-trust problem: visible cards can show overstated profit until the score queue catches up.

## Decision

Extend `scripts/report-condition-profit-haircut-impact.ts` with:

- metric: `stalePoolProfitRows`
- metric: `totalPoolProfitOverstatement`
- apply scope: `stale_profit`
- apply action: `patch_profit`

`patch_profit` only updates:

- `mvp_candidate_pool.expected_profit_min`
- `mvp_candidate_pool.expected_profit_max`
- `mvp_candidate_pool.profit_band` when a positive band exists
- `mvp_candidate_pool.updated_at`

It does not change source data, listing parsing, status, invalidation reason, or visibility.

## Run Result

After score queue attempts, dry-run showed:

- affected rows: 29
- drop-to-zero rows: 0
- stale pool profit rows: 8
- total pool profit overstatement: 96,114 KRW

Apply:

```bash
npx tsx scripts/report-condition-profit-haircut-impact.ts --limit=10000 --statuses=ready,reserved --apply=true --apply-scope=stale_profit --apply-action=patch_profit --apply-limit=50
```

Result:

- candidates: 8
- planned rows: 8
- patched rows: 8
- verified patched rows: 8

Final dry-run:

- affected rows: 29
- drop-to-zero rows: 0
- stale pool profit rows: 0
- total pool profit overstatement: 0 KRW

## Why This Is Safe

Rows with positive adjusted profit remain visible. Only the displayed/served expected profit is corrected to the same condition-haircut calculation used by runtime detail and pool builder.

`patch_profit` is restricted to `--apply-scope=stale_profit` so it cannot be used accidentally as a broad pool rewrite.

## Deferred

- Consider a periodic stale-profit audit if condition policies keep changing often.
- Broader condition-specific median modelling remains deferred.
