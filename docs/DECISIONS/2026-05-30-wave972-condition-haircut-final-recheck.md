# Wave 972 — Condition Haircut Final Recheck

Date: 2026-05-30 KST

## Context

After Wave 971 was committed, a final dry-run found one newly surfaced ready/reserved row whose condition haircut dropped profit to zero.

## Decision

Run the same narrow direct invalidation action from Wave 970:

```bash
npx tsx scripts/report-condition-profit-haircut-impact.ts --limit=10000 --statuses=ready,reserved --apply=true --apply-scope=drop_to_zero --apply-action=invalidate_pool --apply-limit=10
```

## Run Result

- candidates: 1
- invalidated rows: 1
- verified invalidated rows: 1
- pid: `9000797622122`
- reason: `condition_haircut_profit_not_positive`

Final dry-run:

- affected rows: 26
- drop-to-zero rows: 0
- stale pool profit rows: 0
- total pool profit overstatement: 0 KRW

## Deferred

If condition policies keep changing quickly, add a scheduled watchdog/report instead of manual rechecks.
