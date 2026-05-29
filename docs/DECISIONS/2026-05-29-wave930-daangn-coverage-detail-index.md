# 2026-05-29 — Wave 930: Daangn dong coverage and detail-worker index

## Context

After expanding Daangn acquisition to A/B/C workers, ready pool increased sharply. User asked whether dong-level coverage is actually managed, where bottlenecks remain, and whether there is a more efficient path.

## Findings

- Runtime Daangn search seed file now contains **6,333** Daangn-supported region ids with parent mapping, not the earlier 200-range region set.
- Production snapshot around 2026-05-29 19:25 KST:
  - `mvp_raw_listings source=daangn`: **302,276**
  - New raw Daangn rows: **3,769 / 1h**, **26,877 / 6h**, **116,546 / 24h**
  - Candidate pool Daangn rows: **2,534 ready**, **706 invalidated**
  - Recent 6h raw region ids: **1,453**
  - Recent 6h SKU-matched region ids: **1,298**
  - Ready region ids: **1,355**
  - Ready rows with Daangn manner temperature: **2,520 / 2,534 = 99.4%**
- Current design is broad dong-level coverage plus adaptive rotation, not equal-frequency full sweep of all 6,333 dong/eup/myeon ids every cycle. This is intentional because equal sweeping all ids would waste requests on low-yield areas.

## Bottleneck Found

`daangn-detail-worker` B/C had repeated failures selecting missing-manner-temperature candidates:

```text
GET /mvp_raw_listings
  source=daangn
  listing_state=active
  sku_id=not.is.null
  daangn_manner_temperature=is.null
  order=last_seen_at.desc
  limit=1000
=> statement timeout
```

Before index:

```text
Index Scan using mvp_raw_daangn_last_seen_idx
Rows Removed by Filter: 36,747
Execution Time: 5,520 ms
```

The query used the broad Daangn last-seen index and filtered too many rows after the index scan.

## Production Change Applied

Added two non-destructive concurrent partial indexes:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS mvp_raw_daangn_active_sku_missing_manner_last_seen_idx
ON public.mvp_raw_listings (last_seen_at DESC)
INCLUDE (pid, url)
WHERE source = 'daangn'
  AND listing_state = 'active'
  AND sku_id IS NOT NULL
  AND daangn_manner_temperature IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS mvp_raw_daangn_active_sku_dirty_missing_manner_updated_idx
ON public.mvp_raw_listings (updated_at DESC)
INCLUDE (pid, url, score_dirty)
WHERE source = 'daangn'
  AND listing_state = 'active'
  AND sku_id IS NOT NULL
  AND daangn_manner_temperature IS NULL
  AND score_dirty = true;
```

Then ran:

```sql
ANALYZE public.mvp_raw_listings;
```

Schema history was recorded in:

```text
supabase/migrations/20260529193000_wave930_daangn_detail_missing_manner_indexes.sql
```

After index:

```text
mvp_raw_daangn_active_sku_missing_manner_last_seen_idx
Execution Time: 1.865 ms

mvp_raw_daangn_active_sku_dirty_missing_manner_updated_idx
Execution Time: 0.035 ms
```

Cron verification after index:

```text
10:25 daangn_detail_worker_a succeeded: selected 48, patched 48, duration 39.3s
10:25 daangn_detail_worker_b succeeded: selected 100, patched 99, duration 189.1s
10:25 daangn_detail_worker_c succeeded: selected 100, patched 100, duration 167.4s
```

Before the index, B/C were repeatedly failing at candidate SELECT after about 8.4s.

## Decision

- Keep A/B broad firehose + C category-target mode. It is currently producing strong volume.
- Keep adaptive rotation. It should not be replaced by equal-frequency all-dong sweeping.
- Treat detail-worker candidate selection as fixed by the new partial indexes.
- Next optimization target is not "more raw volume" first; it is:
  1. observe Daangn detail-worker success rate after the index,
  2. watch Daangn ingest failure rate and raw upsert latency,
  3. tune adaptive rotation so low-yield regions cool down while high-yield/user-relevant regions stay hot.

## Deferred

- Add a dedicated operational rollup table/view for Daangn coverage stats. Live REST scans over `mvp_raw_listings source=daangn` are already heavy at 300k+ rows.
- Consider adding `source` to `mvp_candidate_pool` long-term to avoid embedded joins for source-level admin stats.
