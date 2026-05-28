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

Initial note: migration file was created first, then production indexes were applied manually with `CREATE INDEX CONCURRENTLY` one by one after checking table size and existing indexes.

Production table check before apply:

- `mvp_raw_listings`: about `678k` estimated rows / `1674 MB`
- `mvp_candidate_pool`: about `9k` estimated rows / `5312 kB`
- none of the eight prepared indexes existed yet

Production apply result:

| index | result | duration |
| --- | --- | --- |
| `mvp_raw_active_sku_first_seen_idx` | ok | 21.0s |
| `mvp_raw_daangn_active_sku_first_seen_idx` | ok | 21.1s |
| `mvp_raw_daangn_last_seen_idx` | ok | 20.6s |
| `mvp_raw_daangn_first_seen_idx` | ok | 20.0s |
| `mvp_raw_daangn_created_at_idx` | ok | 23.3s |
| `mvp_raw_daangn_region_last_seen_idx` | ok | 19.7s |
| `mvp_candidate_pool_ready_added_idx` | ok | 0.1s |
| `mvp_candidate_pool_invalidated_updated_idx` | ok | 0.1s |

The migration remains in repo so future schema deploys have the same index definitions; because indexes already exist, the migration's `if not exists` statements should be no-ops if applied later.

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

- Post-apply measurement of:
  - Daangn detail worker A/B/C actual runs
  - `daangn_manner_temperature_missing` invalidation drop
  - score `score_load_pool_gate_inputs` p50/p95
  - raw region count query timeout improvement
- Further detail worker concurrency increase beyond 3 shards. Do not raise until block signals stay clean.

## Follow-up — B/C detail shard route unblocked

Post-deploy observation showed only A detail shard (`daangn_detail_worker_a`) was starting. B/C ingestion crons were alive, but B/C detail shard runs were absent.

Root cause:

- B/C projects intentionally block frontend and unrelated cron routes in `src/middleware.ts`.
- The allowlist included `daangn-worker-b`, `daangn-worker-c`, and `score-worker-b`, but not `/api/cron/daangn-detail-worker`.
- Even after middleware, `cronProjectRoleSkip()` allowed `daangn_b` only for `daangn_worker_b` / `score_worker_b`, and `daangn_c` only for `daangn_worker_c`.

Fix:

- Allow `/api/cron/daangn-detail-worker` through B/C middleware.
- Allow `daangn_detail_worker_b` for `CRON_PROJECT_ROLE=daangn_b`.
- Allow `daangn_detail_worker_c` for `CRON_PROJECT_ROLE=daangn_c`.

Expected effect: the previous 3-shard detail worker change can actually run across all A/B/C projects instead of silently staying A-only.

Post-fix verification:

- A shard: `daangn_detail_worker_a`, shard `0/3`, `selected=100`, `patched=99`, `blocked=false`.
- B shard: `daangn_detail_worker_b`, shard `1/3`, `selected=100`, `patched=88`, `blocked=false`.
- C shard: `daangn_detail_worker_c`, shard `2/3`, `selected=100`, `patched=100`, `blocked=false`.
- Index existence verified after production apply; all eight indexes exist.
- Current ready pool after the fix/checkpoint:
  - Daangn `942`
  - Bunjang `865`
  - Joongna `112`
  - last 1h ready additions: Daangn `144`, Bunjang `3`, Joongna `1`
