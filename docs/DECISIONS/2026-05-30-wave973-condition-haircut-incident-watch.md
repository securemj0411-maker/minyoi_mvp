# Wave 973 — Condition Haircut Incident Watch

Date: 2026-05-30 KST

## Context

Manual cleanup fixed condition-haircut stale rows, but fresh ready/reserved rows can continue to surface as normal score workers process the backlog. The final recheck found new drop-to-zero rows after the previous wave, so relying only on manual checks is brittle.

## Decision

Add a condition-haircut stale-pool check to `/api/cron/incident-watch`.

The check runs on the existing incident-watch cadence and reuses the existing incident dedup/recovery flow:

- scans current ready/reserved pool rows
- recomputes condition-haircut adjusted profit
- alerts if any row has positive pool profit but adjusted profit is zero
- alerts if any row has positive adjusted profit but pool expected profit is overstated

Incident key:

- `condition_haircut_stale_pool`

## Current Cleanup

After adding the check, another dry-run found 4 fresh drop-to-zero rows.

Applied:

```bash
npx tsx scripts/report-condition-profit-haircut-impact.ts --limit=10000 --statuses=ready,reserved --apply=true --apply-scope=drop_to_zero --apply-action=invalidate_pool --apply-limit=20
```

Result:

- invalidated rows: 4
- verified invalidated rows: 4
- reason: `condition_haircut_profit_not_positive`
- pids: `9002256078366`, `9003820726791`, `9000703268619`, `9000146148438`

Final dry-run:

- drop-to-zero rows: 0
- stale pool profit rows: 0
- total pool profit overstatement: 0 KRW

## Deferred

- If this alert recurs often, move from alert-only to a guarded automatic cleanup route.
- Keep broader condition-specific median modelling separate.
