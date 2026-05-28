# Wave 925 — Daangn detail, score gate, and ops index optimization

## Context

Follow-up to Wave 924.

Clarification: Daangn users do have manner temperature. The bottleneck was our DB value `daangn_manner_temperature` being `null` until the detail worker opens the listing detail page and parses it. Candidate pool blocks Daangn rows with null manner temperature, so detail enrichment throughput directly controls ready promotion speed.

## Applied runtime changes

### 1. Daangn detail worker sharding

Changed `daangn-detail-worker` so A/B/C projects can process disjoint PID shards.

- default shard count for primary / `daangn_b` / `daangn_c`: `3`
- default shard index:
  - primary/empty/all: `0`
  - `daangn_b`: `1`
  - `daangn_c`: `2`
- each shard gets its own cron DB lock:
  - `daangn_detail_worker_a`
  - `daangn_detail_worker_b`
  - `daangn_detail_worker_c`
- default per-shard limit: `100`

Expected effect: detail enrichment capacity can move from about `150 rows / 5 min` to up to about `300 rows / 5 min` if A/B/C all run cleanly, without duplicate-processing the same PID shard.

Risk guard:

- still uses source-health guard for Daangn.
- still honors block detection from detail fetch.
- still logs `shardCount`, `shardIndex`, and `guardMode` in collect run metadata/stats.

### 2. Score volume gate hot-path tuning

Changed defaults:

- `PIPELINE_VOLUME_GATE_TARGET_READ_CONCURRENCY`: `16` -> `24`
- `PIPELINE_VOLUME_GATE_BULK_QUERY_THRESHOLD`: `48` -> `128`

Why: recent production score runs showed target SKU sets around `60-75`; those fell into the bulk scan path and could spend `4-8s` in `score_load_low_volume_sku_ids` / `score_load_daangn_volume_by_sku`. Keeping those medium batches in per-SKU threshold reads should reduce large raw-window scans while preserving the same gate semantics.

### 3. Ops / DB hot-path migration prepared

Created migration:

`supabase/migrations/20260528204438_wave924_daangn_ops_hotpath_indexes.sql`

Indexes prepared for:

- Daangn raw `last_seen_at`, `first_seen_at`, `created_at`
- Daangn region + `last_seen_at`
- active SKU + `first_seen_at`
- Daangn active SKU + `first_seen_at`
- candidate pool ready/invalidated time-window stats

Important: migration file was created but not applied to production in this wave. Applying indexes on the enlarged raw table should be done intentionally because it can add DB load while building.

## Verification

```text
npx tsx --test tests/cron-guard.test.ts tests/daangn-ingest.test.ts tests/core-rules.test.ts
=> 149 pass, 0 fail

npm run build
=> passed
```

Known build warnings remain unrelated:

- Next.js `middleware` convention deprecation warning
- `metadataBase` missing warning for social image resolution

## Deferred

- Production DB index application. Need explicit deploy/apply timing because raw table is large.
- Post-apply measurement of:
  - Daangn detail worker A/B/C actual runs
  - `daangn_manner_temperature_missing` invalidation drop
  - score `score_load_pool_gate_inputs` p50/p95
  - raw region count query timeout improvement
- Further detail worker concurrency increase beyond 3 shards. Do not raise until block signals stay clean.
