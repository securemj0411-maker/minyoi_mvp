# Wave 969 — Condition Haircut Score-Dirty Propagation

Date: 2026-05-30 KST

## Context

Wave 966/967 made soft condition chips affect expected profit and detail cost UI. Wave 968 showed the impact is narrow, but existing ready/reserved candidate_pool rows may stay stale until score workers revisit them.

The existing score pipeline already treats `mvp_raw_listings.score_dirty=true` as the safe additive trigger for recalculation.

## Decision

Extend `scripts/report-condition-profit-haircut-impact.ts` with an optional apply mode.

Default remains dry-run:

```bash
npx tsx scripts/report-condition-profit-haircut-impact.ts --limit=10000 --statuses=ready,reserved --apply=false
```

Apply mode only marks raw rows dirty:

```bash
npx tsx scripts/report-condition-profit-haircut-impact.ts --limit=10000 --statuses=ready,reserved --apply=true --apply-scope=drop_to_zero --apply-limit=30
```

It does not directly mutate `mvp_candidate_pool`. The next score tick owns the final ready/reserved/invalidated outcome.

## Run Result

Dry-run:

- affected rows: 69
- affected rate: 1.6%
- rows that would lose positive profit after haircut: 23
- drop-to-zero rate: 0.5%
- total max-profit drop across affected rows: 690,357 KRW
- average max-profit drop among affected rows: 10,005 KRW

Apply:

- scope: `drop_to_zero`
- candidates: 23
- planned rows: 23
- marked `mvp_raw_listings.score_dirty=true`: 23
- verified `score_dirty=true`: 23

## Why This Is Safe

- Only sets a recalculation flag on raw rows.
- Does not delete, invalidate, or rewrite pool rows directly.
- Leaves source/category/pool policy to the existing score worker.
- Keeps `--apply=false` as default so future audits are non-mutating unless explicitly requested.

## Deferred

- Recheck the ready/reserved pool after one or two score ticks to confirm the 23 rows naturally reclassify.
- Decide later whether the remaining affected rows that still keep positive profit should also be requeued in a wider apply scope.
