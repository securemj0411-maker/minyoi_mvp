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

First production score run with the new timings showed a real hot path:

```text
score_build_batch_price_maps ~= 12.3s
score_load_pool_gate_inputs ~= 8.0s
score_row_loop ~= 6.1s
score_load_rows ~= 4.2s
```

`score_build_batch_price_maps` and `score_row_loop` both called `effectiveCatalogSkuForScorableRow()` repeatedly for the same raw rows. That can re-run expensive catalog matching, especially for fashion rows. Within a single score run, the effective SKU decision is stable, so Wave 918 now builds an `effectiveSkuByPid` map once and reuses it in the batch price map and row scoring loop.

## Expected effect

- More same-source Daangn sample rows for SKUs that currently fail `sku_median_unavailable` / Daangn volume gates.
- Less wasted runtime on blocked keyword query paths.
- Ready growth should improve indirectly after market invalidations and score-worker cycles pick up the new sample rows.

## Deferred

- Do not run this on B/C projects yet. First measure primary worker yield after deploy.
- Do not raise cadence from every 30 minutes yet. If `blockedCombos=0` and `matchedArticles/detailParsed` stay useful, increase cadence or add a dedicated sweep lane later.
- Do not loosen quality gates just to increase ready count. The current fix improves market basis without weakening pool safety.
- Do not split score-worker cleanup into another worker until the new timing fields identify the actual hot stage.

## Follow-up: score gate hot path

After deploying the effective-SKU reuse, production score timings changed materially:

```text
score_build_batch_price_maps ~= 2-4ms
score_row_loop ~= 8-11ms
score_build_effective_sku_map ~= 7.3-8.6s
score_load_pool_gate_inputs ~= 8.0-8.6s
```

So the previous repeated effective-SKU calls were fixed, but two hot paths remained.

The pool gate input load was not a generic DB slowdown. Local production measurement showed:

```text
rpc_get_fraud_group_hashes ~= 8136ms, rows=1000
pool_ready_pids ~= 75ms
recent_scorable_skus ~= 62ms
targeted description_hash fraud query, 100 hashes ~= 148ms
```

Decision:

- Stop loading the global `get_fraud_group_hashes` set for every score run when the current score batch has known `description_hash` values.
- Instead, query only the current batch hashes from `mvp_raw_listings`, count distinct `seller_uid` per hash, and return hashes with 2+ sellers.
- Also restrict existing ready-pool seller counts to the seller IDs present in the current score batch.
- Add nested timing keys inside `score_load_pool_gate_inputs`:
  - `score_load_existing_pool_seller_counts`
  - `score_load_fraud_group_hashes`
  - `score_load_low_volume_sku_ids`
  - `score_load_daangn_volume_by_sku`

This keeps the same gate semantics for rows being scored while removing the 8s global fraud hash scan from the critical path.

For `score_build_effective_sku_map`, add a bounded warm-process cache keyed by stored `sku_id`, title, and description preview. Catalog matching is deterministic per deploy, so reusing the result across repeated dirty rows in a warm function instance is safe. The cache is capped at 5,000 entries.

Deferred:

- Do not replace the DB RPC itself yet; the app no longer needs it on the score hot path, and a schema/function migration is a bigger operational step.
- Do not merge low-volume and Daangn-volume loaders until the new nested timing fields show which one is still meaningful.

## Follow-up: score volume gate threshold reads

First production run after targeted fraud hashes confirmed the fix on primary:

```text
score_load_fraud_group_hashes ~= 257ms
score_load_pool_gate_inputs ~= 5964ms
score_load_low_volume_sku_ids ~= 5962ms
score_load_daangn_volume_by_sku ~= 4657ms
```

But one B run had a batch with no `description_hash`; that still fell back to the old global fraud RPC and spent 8005ms. Fix: when the caller passes an explicit empty target-hash set, return an empty set instead of global fallback. No current row has a hash to compare, so no fraud hash can be applied to that batch.

The remaining volume gates do not need exact counts above the threshold:

- low-volume gate only needs `7d >= 3` and `2d >= 1`
- Daangn gate only needs `Daangn 7d >= 3`

Decision:

- For target SKU mode, fetch at most 3 rows per SKU with bounded concurrency instead of scanning all 7-day rows for a large `sku_id=in.(...)` window.
- Preserve the legacy global scan only for callers that do not pass target SKUs.
- Keep the old semantics that target SKUs with no 7-day raw rows are not added to `lowVolumeSkuIds`; Daangn volume still returns 0 and candidate policy blocks `<3`.
