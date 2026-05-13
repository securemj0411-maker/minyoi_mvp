# Wave 54b — 4-worker cron volume / parser health check

Status: **diagnosed + small runtime patch applied**. DB write 0, DDL 0, candidate_pool write 0, public promotion 0.

## Why this wave exists

Owner challenged the `192 collected` number because earlier AirPods/AirPods Max-only work moved thousands of rows/signals. The challenge was correct: `192` was being read too broadly.

## Metric clarification

`192` in `db-hotpaths-latest.md` is **not** total Bunjang API reach, total DB rows, or historical mining volume.

It is the recent 1-hour `mvp_collect_runs.collected_count` proxy for the natural `tick` worker under the currently enabled staged cron set and query cadence.

Earlier larger numbers came from different scopes:
- manual/no-write mining and replay waves with wider query sweeps,
- tick-write/raw-touch reports that count unique/touch/write activity across larger windows,
- broader worker sets or one-off scripts, not the same one-hour natural-cron collected counter.

## Why current volume looks lower than the old "thousands per run" memory

The old higher-volume window was not only the 4 currently enabled jobs.

Last 24h collect-runs snapshot:

| worker | runs | succeeded | collected |
|---|---:|---:|---:|
| tick | 145 | 135 | 209,760 |
| deep-crawl | 14 | 14 | 51,944 |
| detail-worker | 149 | 149 | 0 |
| lifecycle-worker | 30 | 30 | 0 |
| housekeeper | 15 | 15 | 0 |
| market-worker | 31 | 31 | 0 |
| pool-warmer | 16 | 16 | 0 |

Per-run collection from the historical/high-volume records:

| source | runs | collected / unique total | avg per run |
|---|---:|---:|---:|
| tick-write 2026-05-11 | 28 | 84,176 | 3,006 |
| tick-write 2026-05-12 | 128 | 217,076 | 1,696 |
| tick-write 2026-05-13 | 12 | 21,105 | 1,759 |
| collect-runs last 24h tick | 145 | 209,760 | 1,447 |
| collect-runs last 24h deep-crawl | 14 | 51,944 | 3,710 |

So the owner's memory is accurate: successful collection cycles were often **~1.7k–3.7k items/run**. The current staged 4-worker set excludes `deep-crawl`, and some tick runs are score/detail-only or fail early on seller-cache reads; that makes the recent apparent volume lower.

Interpretation:
- Current 4 enabled jobs are a safe/staged set, not the old broad collection set.
- `deep-crawl` is the big missing collector for extra pages; it contributed ~3.7k items per run in the latest 24h snapshot.
- `market-worker`/`pool-warmer` do not directly collect search rows, but they are part of the full production loop.
- Before re-enabling `deep-crawl`, confirm the seller-cache read URL patch is deployed and tick failures stop.

## Cron state after owner enabled 4 jobs

Enabled by owner:
- `/api/cron/tick?wait=1`
- `/api/cron/detail-worker?wait=1`
- `/api/cron/lifecycle-worker?wait=1`
- `/api/cron/housekeeper?wait=1`

Recent 30-minute direct DB check:

| worker | runs | succeeded | failed | collected | enriched | scored | upserted |
|---|---:|---:|---:|---:|---:|---:|---:|
| detail_worker | 8 | 8 | 0 | 0 | 152 | 0 | 86 |
| tick | 5 | 2 | 3 | 0 | 0 | 287 | 280 |
| lifecycle_worker | 2 | 2 | 0 | 0 | 27 | 0 | 9 |
| housekeeper | 1 | 1 | 0 | 0 | 0 | 0 | 133 |

Recent DB mutation/readiness signal:
- last 10m `mvp_raw_listings.updated_at`: **134 rows**
- last 10m `mvp_listing_parsed.updated_at`: **74 rows**
- last 5m `mvp_raw_listings.updated_at`: **95 rows**
- last 5m `mvp_listing_parsed.updated_at`: **35 rows**
- parsed samples are `option-parser-v31`; explicit storage/model examples parse normally, ambiguous rows remain `needs_review=true`.

Conclusion: the 4 enabled cron jobs are firing, details are being enriched, parsed rows are being written, and pack-open remains functional. This is not a total pipeline halt.

## Real issue found

`tick` partially fails on seller cache reads:

`Supabase REST fetch failed GET /rest/v1/mvp_sellers?select=seller_uid,is_proshop,last_seen_at,source_json&source=eq.bunjang&seller_uid=in.(sha256%3A...)`

The table and columns are valid. A direct short query succeeds. The failure pattern is consistent with oversized PostgREST GET URLs caused by `SELLER_READ_CHUNK_SIZE = 300` with long hashed `seller_uid` values.

This is separate from the seller-name privacy policy:
- `seller_name` still must not be stored.
- `raw_json.shop_name` still must not be stored.
- allowed identifiers remain `seller_uid`/hash, pro-shop flag, review stats.

## Patch

File: `src/lib/tick-pipeline.ts`

Change:
- `SELLER_READ_CHUNK_SIZE`: `300 -> 80`
- Added a short comment explaining that the cap keeps `seller_uid=in.(...)` URLs under common proxy/request-line limits.

This does not change schema, parsing policy, candidate-pool behavior, or public exposure.

## Verification

- `npm run test:core` → **133/133 pass**
- `npx eslint src/lib/tick-pipeline.ts --max-warnings=0` → pass
- `npm run report:pack-open-quality` → sourceHealth `healthy`, reveal **42/48**, activeReadyPool **333**
- `npm run report:db-hotpaths -- --window-hours=1 --run-limit=80 --queue-limit=300` → still shows recent seller-fetch failures from before/around patch; next natural ticks must confirm failure rate falls.

## Decision / next

1. Keep the 4 enabled cron jobs running.
2. Do **not** enable deep/market/pool-warmer yet until seller-cache read failures disappear for a short window.
3. Recheck after 2-3 natural tick cycles:
   - `tick` failure count should drop.
   - `mvp_raw_listings` and `mvp_listing_parsed` should continue updating.
   - pack-open should remain open-likely.
4. Then continue Wave 54 apply or Wave 55 PS5 alignment depending on operational health.

## Parser-health check for newly ready lanes

Owner correctly pointed out that "cron runs" is not enough. The important question is whether newly ready SKU/lane scope is actually entering DB and being parsed correctly.

Read-only report generated:
- `reports/recent-cron-parser-health-latest.md`
- `reports/recent-cron-parser-health-latest.json`

Last 2h parsed-row snapshot:

| metric | value |
|---|---:|
| parsed rows | 178 |
| normal parsed | 100 |
| needs_review | 78 |
| pool_eligible among joined raw | 0 |

Top natural-cron lanes:
- `airpods|airpods_pro_3`: 16 rows, 16 normal
- `macbook|macbook_pro`: 11 rows, 6 normal / 5 review
- `ipad|ipad_pro`: 11 rows, 8 normal / 3 review
- `ipad|ipad_air`: 8 rows, 7 normal / 1 review
- `airpods|airpods_pro_2_lightning`: 7 rows, 7 normal
- `airpods|airpods_pro_2_usbc`: 4 rows, 4 normal

Important finding:

Current `DEFAULT_SEARCH_QUERIES` still focuses on AirPods, watches, MacBook, iPhone, Galaxy, iPad, and Galaxy Tab. It does **not** include the newly promoted acquisition lanes such as monitor exact models, JBL Flip 6, PS5/Switch, Dyson/Roborock, desktop Mac mini/iMac, etc. Therefore those lanes cannot be validated by natural cron parser health unless they are added to `PIPELINE_SEARCH_QUERIES` or covered by a dedicated acquisition/deep worker.

Decision:
- Treat "new ready lane parser verification" as a separate gate from "cron endpoint fired".
- Next implementation unit should add/verify a cron search-query coverage map for all ready/internal owner-review lanes before claiming those lanes are naturally collected.
