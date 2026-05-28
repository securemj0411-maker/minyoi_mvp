# Wave 903 — Daangn ready throughput: source-aware pool cost

## Trigger

Owner asked why Daangn listings enter `ready` slowly and whether ready count can be increased.

## Production read-only diagnosis

- `daangn-worker` is healthy and not the current bottleneck:
  - latest runs fetch all 267 regions.
  - `catalogHintArticles` around 1,047-1,453 per run.
  - `upsertCandidateArticles` no longer capped at 500 in recent runs.
  - `rawSkippedExisting` around 990-1,382, meaning repeated firehose rows are being skipped cheaply.
  - latest durations around 10-20s.
- Current Daangn pool snapshot:
  - ready: 432
  - ready added/updated in last 24h: 370
  - invalidated: 312
- Current Daangn raw funnel:
  - total raw: 183,435
  - last 24h: 13,309
  - active scorable rows: 13,724
  - dirty scorable backlog: 62
- `score-worker` is processing, but only 2-9 rows per 100 scored rows enter pool. Recent skip reasons are dominated by:
  - `negative_resell_gap`
  - `profit_below_pack_band`
  - `sku_median_unavailable`
- Daangn source market basis is now strict by design. This preserves trust, but reduces ready volume compared with mixed-market fallback.

## Decision

Fix an internal policy mismatch before loosening quality gates.

Feed/detail profit paths already treat Daangn as direct-trade resale:

- selling fee: 0
- resell shipping fee: 0
- safety buffer remains

But `candidate-pool-builder` still used the generic marketplace formula:

- 3.5% selling fee
- 3,500원 resell shipping fee
- safety buffer

That made low-margin Daangn rows fail before they could reach the feed, even though the user-facing feed/detail would calculate them as profitable.

Updated `candidate-pool-builder` to use the same source-aware cost helpers as feed/detail:

- `sellingFeeForMarketPrice(row.skuMedian, row.source)`
- `resellShippingFeeForSource(row.source)`

## Deferred

- Do not reopen silent mixed-market fallback for Daangn as the primary basis.
- If more Daangn ready volume is still needed, add a separate “buy on Daangn, resell on Bunjang/Joongna” candidate strategy with explicit channel labeling instead of pretending mixed market is Daangn market.
- Lifecycle worker has intermittent statement timeouts and should be indexed/capped separately; it is not the primary Daangn ready bottleneck found here.

## Verification

- Added a pool-builder regression test proving a Daangn listing that would fail under generic marketplace costs enters pool under source-aware Daangn costs.
