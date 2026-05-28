# Wave 918 — Daangn price-sweep firehose default

## Context

After Wave 915-917 deploys, Daangn A/B/C collection was healthy, but ready growth was still mostly limited by pool gates:

- `negative_resell_gap`
- `sku_median_unavailable`
- `profit_not_positive_after_costs`
- Daangn-specific volume/sample gates

The separate `daangn-price-sweep-worker` is supposed to fill same-source Daangn market samples for ready SKUs, but recent production runs were nearly useless:

- `2026-05-28T19:24Z`: `searchCombos=40`, `categoryCombos=0`, `blockedCombos=1`, `fetchedArticles=0`
- `2026-05-28T18:54Z`: `searchCombos=40`, `categoryCombos=0`, `fetchedArticles=1`, `matchedArticles=0`
- `2026-05-28T18:24Z`: `fetchedArticles=3`, `matchedArticles=1`

This contradicted the earlier decision that keyword/category-specific Daangn search can be brittle, while region-only firehose is the stable path.

## Verification

Local dry-run against production data, with no writes:

```text
maxSearchCombos=0
maxCategoryCombos=8
maxRegions=8
dryRun=true
```

Result:

```text
durationMs=21043
fetchedArticles=2134
matchedArticles=4
selectedArticles=4
detailParsed=4
blockedCombos=0
failedCombos=0
```

That is materially better than the live keyword-sweep runs and stays within the worker budget.

## Decision

Change Daangn price sweep defaults from blocked keyword sweep to stable region firehose sample fill:

- `DEFAULT_MAX_SEARCH_COMBOS`: `40` -> `0`
- `DEFAULT_MAX_CATEGORY_COMBOS`: `0` -> `8`
- `DEFAULT_MAX_REGIONS`: `4` -> `8`
- `DEFAULT_SEARCH_CONCURRENCY`: `1` -> `2`
- `DEFAULT_REQUEST_DELAY_MS`: `350` -> `250`

The cron route fallback values were updated to match, and route request metadata now records `maxSearchCombos` / `maxCategoryCombos`.

Also added score-stage sub-timings under `stage_stats.stages.score.timingsMs` so the next score-worker optimization is based on real production runtime:

- cleanup residue steps
- row loading
- parser/market stat loading
- row scoring loop
- output upserts
- pool gate input loading
- pool upsert / invalidation
- shadow audit
- dirty clearing

## Expected effect

- More same-source Daangn sample rows for SKUs that currently fail `sku_median_unavailable` / Daangn volume gates.
- Less wasted runtime on blocked keyword query paths.
- Ready growth should improve indirectly after market invalidations and score-worker cycles pick up the new sample rows.

## Deferred

- Do not run this on B/C projects yet. First measure primary worker yield after deploy.
- Do not raise cadence from every 30 minutes yet. If `blockedCombos=0` and `matchedArticles/detailParsed` stay useful, increase cadence or add a dedicated sweep lane later.
- Do not loosen quality gates just to increase ready count. The current fix improves market basis without weakening pool safety.
- Do not split score-worker cleanup into another worker until the new timing fields identify the actual hot stage.
