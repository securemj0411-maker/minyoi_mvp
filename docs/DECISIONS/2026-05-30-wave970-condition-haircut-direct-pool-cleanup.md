# Wave 970 — Condition Haircut Direct Pool Cleanup

Date: 2026-05-30 KST

## Context

Wave 969 marked the 23 drop-to-zero condition-haircut rows as `mvp_raw_listings.score_dirty=true`. A local `scoreStage` run processed 100 dirty rows and reduced the stale ready/reserved drop-to-zero set from 23 to 9, later 10 as another stale row entered the same audit set.

However, some rows were still ready/reserved even after queue processing. The likely cause is score queue ordering plus production cron/deploy timing: some rows can have dirty cleared or sit behind the broader dirty backlog before the new pool outcome is visible.

## Decision

Extend `scripts/report-condition-profit-haircut-impact.ts` with `--apply-action`.

Supported actions:

- `score_dirty` (default): mark `mvp_raw_listings.score_dirty=true`
- `invalidate_pool`: only for audited rows whose adjusted profit drops to zero, mark `mvp_candidate_pool.status='invalidated'`

The direct invalidation action is intentionally narrow:

- requires `--apply=true`
- uses the existing audit scope (`drop_to_zero` by default)
- only touches `ready/reserved` pool rows
- writes reason `condition_haircut_profit_not_positive`
- verifies invalidated row count after patch

## Run Result

After a second score-stage observation, dry-run showed:

- affected rows: 60
- rows that would lose positive profit after haircut: 10

Apply:

```bash
npx tsx scripts/report-condition-profit-haircut-impact.ts --limit=10000 --statuses=ready,reserved --apply=true --apply-scope=drop_to_zero --apply-action=invalidate_pool --apply-limit=20
```

Result:

- candidates: 10
- planned rows: 10
- invalidated rows: 10
- verified invalidated rows: 10
- invalidation reason: `condition_haircut_profit_not_positive`

Final dry-run:

- affected rows: 49
- rows that would lose positive profit after haircut: 0
- drop-to-zero rate: 0%

## Why This Is Safe

This direct path does not broadly recalculate or delete anything. It only removes stale visible pool rows that the same condition haircut policy already proves no longer have positive profit.

Future normal score workers can still re-admit a row if later market data changes and the row is scored again through the usual pipeline.

## Deferred

- Decide whether positive-profit affected rows should be requeued in a slower `affected` scope later.
- Add a recurring watchdog if stale condition-haircut positive-to-zero rows reappear.
