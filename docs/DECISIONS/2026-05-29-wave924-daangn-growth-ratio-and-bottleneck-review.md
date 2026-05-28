# Wave 924 — Daangn ready growth ratio and bottleneck review

## Context

User asked why Daangn ready pool is suddenly growing fast, whether Sangdo-dong being only one ready item is expected, and what bottlenecks remain after the A/B/C Daangn worker and score hot-path optimizations.

This wave is read-only investigation plus ops logging. No schema or runtime code changes were applied.

## Latest production snapshot

Generated around `2026-05-28T20:36Z` (`2026-05-29 05:36 KST`).

### Ready pool mix

Current ready pool:

| source | ready rows |
|---|---:|
| bunjang | 863 |
| daangn | 845 |
| joongna | 113 |
| total | 1,821 |

Daangn is now `46.4%` of the whole ready pool.

Recent ready additions:

| window | total ready added | Daangn ready added | Daangn share |
|---|---:|---:|---:|
| 1h | 97 | 83 | 85.6% |
| 6h | 445 | 383 | 86.1% |
| 24h | 810 | 569 | 70.2% |

Interpretation: the sudden visible growth is real and mostly Daangn.

### Raw Daangn activity

Daangn raw `last_seen_at` count:

| window | raw Daangn last_seen |
|---|---:|
| 1h | 18,630 |
| 6h | 48,805 |
| 24h | 59,355 |

Daangn raw `created_at` exact counts for 1h/6h timed out through PostgREST, while 24h returned `52,618`. `first_seen_at` exact counts timed out for 1h/6h/24h. This is an ops-observability bottleneck: raw Daangn time-window analytics need an index, RPC aggregate, or rollup table before they are reliable dashboard metrics.

## Why Daangn is growing fast

The growth looks like the combined effect of:

1. A/B/C Daangn workers are all running and upserting a lot of rows.
2. Wave 914 changed collection from gu/city representative regions to `6,333` Daangn dong/eup/myeon leaf regions.
3. Score worker hot-path work removed the previous global fraud hash scan from the score critical path.
4. Existing Daangn raw rows are being re-seen, enriched, and re-scored into ready; this is not only brand-new first-seen rows.

Last 6h collect-run totals:

| worker | runs | collected | upserted | avg duration |
|---|---:|---:|---:|---:|
| daangn-worker | 21 | 1,938,288 | 10,500 | 49.9s |
| daangn-worker-b | 20 done + 1 running | 2,219,249 | 15,606 | 85.8s |
| daangn-worker-c | 21 | 1,167,841 | 6,194 | 41.8s |
| daangn-detail-worker | 20 done + 1 running | 3,000 selected | 2,961 enriched | 123.5s |

The ready ratio is still selective. Roughly comparing recent ready adds to raw last_seen:

- 1h: `83 / 18,630 ~= 0.45%`
- 6h: `383 / 48,805 ~= 0.78%`

This is not an exact funnel because `last_seen_at` and `candidate_pool.added_at` are not the same denominator, but it shows the quality gates are still filtering aggressively.

## Quality gate check

Recent invalidated sample (`status=invalidated`, updated within 24h, sample 1,000):

| source | rows |
|---|---:|
| bunjang | 508 |
| daangn | 410 |
| joongna | 82 |

Top Daangn invalidation reasons:

| reason | rows |
|---|---:|
| negative_resell_gap | 91 |
| daangn_detail_404_manner_backfill | 75 |
| sku_median_unavailable | 56 |
| profit_roi_above_45pct_weak_signal_review | 48 |
| pool_eligible_false_residue | 39 |
| sku_low_volume_below_2d1_or_7d3 | 19 |
| daangn_volume_below_3 | 13 |
| profit_not_positive_after_costs | 9 |
| profit_roi_above_40pct_electronics_review | 8 |
| pool_daangn_live_reserved | 7 |
| daangn_manner_temperature_missing | 7 |

Decision: do not loosen gates just to chase count. The current growth is high but still filtered by profitability, median availability, Daangn volume, live-state, and manner-temperature gates.

## Sangdo status

Current Daangn ready rows containing Sangdo:

| pid | region | sku | added_at | profit |
|---:|---|---|---|---:|
| 9000389107771 | 상도동 | airpods-4 | 2026-05-28T18:02:55Z | 22,290 |

So the user's observation is correct: ready has only one Sangdo item right now.

Latest Daangn raw sample by `last_seen_at` did not include Sangdo rows. Top latest regions were spread across many leaf regions such as `태평로1가`, `중앙동`, `중학동`, `동대신제2동`, `항동7가`, `영운동`, etc.

Interpretation:

- The old 대표동 problem was real and Wave 914 fixed the collection seed direction from gu-level representative regions to leaf dong/eup/myeon regions.
- Sangdo being only one ready item now is likely a timing/supply + filtering effect, not proof that the old mapper bug remains.
- However, direct raw-region exact queries like `source=daangn & daangn_region_name=상도동` timed out through PostgREST, so local-region monitoring needs a faster aggregate/index path.

## Remaining bottlenecks

### 1. Score worker volume gates

Recent score worker timings still show spikes:

- `score_build_effective_sku_map`: about `5.5s ~ 8.5s`
- `score_load_pool_gate_inputs`: about `1.6s ~ 7.7s`
- inside pool gate:
  - `score_load_low_volume_sku_ids`: up to about `7.8s`
  - `score_load_daangn_volume_by_sku`: up to about `7.2s`
  - `score_load_existing_pool_seller_counts`: can spike around `4.6s`

The previous global fraud hash issue is largely fixed; fraud hash loads are now often `11ms ~ 268ms`.

### 2. Daangn detail worker

Detail worker is now a likely throughput ceiling:

- limit: `150`
- avg duration: `123.5s`
- many ready candidates require manner temperature before pool entry.

This worker is intentionally slow because it fetches detail pages with delay and block protection. Increasing it needs care.

### 3. Raw analytics queries

PostgREST exact counts on raw Daangn by `created_at`, `first_seen_at`, or `daangn_region_name` timed out in multiple cases. This does not block user-facing feed directly, but it makes operations blind and slow.

## Next candidates

1. Add a lightweight rollup/RPC for Daangn raw counts by region/source/window, or add targeted indexes after checking Supabase advisors.
2. Replace score volume gates with a precomputed SKU volume table or DB-side threshold RPC so score workers stop scanning raw rows on every run.
3. Split Daangn detail enrichment into safe shards only if block signals remain clean.
4. Add local-region monitoring for user home dong coverage: raw seen, detail done, ready, invalidated reasons.
5. Keep observing Sangdo specifically for a few cycles; do not hard-code only Sangdo again because Wave 914 already fixed the broader representative-region issue.

## Deferred

- No schema/index was applied in this wave.
- No gate threshold was loosened.
- No worker concurrency was raised yet, because detail fetch block risk and Supabase query load need one more measurement round.
