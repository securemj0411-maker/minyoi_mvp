# 2026-05-28 Wave 912 — Daangn price-sweep and manner recovery

## Context

The operator asked why Daangn ready entries were not increasing after A/B/C worker expansion and why the SKU price-sweep had not filled enough samples.

The previous production `daangn-price-sweep-worker` shape was too aggressive and low-yield:

- latest logged production run selected 80 SKUs and 144 combos, but got `blockedCombos=144`, `fetchedArticles=0`, `rawUpserted=0`.
- local coverage before this wave was still weak: many ready-catalog SKUs had fewer than 3 Daangn samples.
- ready pool was also being cut by a separate Daangn trust gate: `daangn_manner_temperature_missing` had become the top invalidation reason.

## Decisions

1. Price sweep should be keyword-first, not category-firehose-first.
   - Category-only Daangn URLs can return empty loader payloads.
   - Search+region works reliably in local tests.
   - Region firehose remains the job of A/B/C ingest workers, not the price-sweep worker.

2. Price sweep must avoid duplicated identical search URLs.
   - The old loop built one URL per `region x category x query`, but the URL intentionally omitted category.
   - That meant the same `region x query` URL could be fetched multiple times for one SKU.
   - The sweep now uses category only as a local classifier hint and dedupes by `region:query`.

3. Price sweep should prioritize proven Daangn-signal SKUs first.
   - Lowest-total-first sorting burned early requests on rare long-tail SKUs.
   - The new order fills SKUs with existing Daangn signal and higher current sample counts first so they reach the target faster.

4. Production defaults should be block-safe.
   - Defaults changed to sequential, delayed keyword sweep:
     - `maxRegions=4`
     - `maxSearchCombos=40`
     - `maxCategoryCombos=0`
     - `searchConcurrency=1`
     - `detailConcurrency=2`
     - `requestDelayMs=350`
     - `abortOnBlockedCombo=true`

5. Price-sweep rows must be traceable in raw listings.
   - `upsertDaangnRawListings()` now preserves detail combo labels into `mvp_raw_listings.query`.
   - Future sweep rows should show `query='price_sweep:<sku_id>'` instead of being hidden under `daangn:<region>`.

6. Daangn ready growth is currently gated by seller/manner backfill too.
   - A scoped local backfill patched invalidated active rows blocked by `daangn_manner_temperature_missing`.
   - This is intentionally not a direct ready flip; rows are marked `score_dirty=true` and left for the score worker to re-evaluate.
   - `scripts/backfill-daangn-manner-temperature.ts` now supports `--scope=invalidated-missing` so this recovery path is reusable.

## Local verification

### Price-sweep dry runs

- Region-only firehose:
  - 16 combos, 2,748 fetched articles, 1 match, 0 blocked.
  - Conclusion: safe but too low-yield for sample fill.

- Keyword, 1 region:
  - 40 combos, 0 fetched articles for the then-selected rare targets.
  - Conclusion: one region is too narrow for long-tail selected SKUs.

- Keyword, 2 regions:
  - 40 combos, 119 fetched articles, 20 matched/detail parsed, 0 blocked.
  - Conclusion: good safe baseline for targeted sample fill.

### Actual local production DB writes

- First real price-sweep run:
  - `rawUpserted=20`
  - `marketInvalidationsQueued=9`
  - `blockedCombos=0`

- Second real price-sweep run after code changes:
  - `rawUpserted=8`
  - `marketInvalidationsQueued=7`
  - `blockedCombos=0`

- Recent `price_sweep:*` raw rows after the runs:
  - 26 rows visible in the last 3 hours.
  - Top filled SKUs included `bose-qc45`, `clothing-bape-shark-hoodie`, `clothing-barbour-quilted-jacket`, `ipad-9`, `iphone-air`.

### Sample coverage movement

Measured with a 5,000-row worker-like recent Daangn scan:

- zero-sample ready SKUs moved from 859-ish to 848.
- `<3` sample ready SKUs moved from 1192-ish to 1174.
- `>=3` sample SKUs stayed around 374 because only a small safe local batch was run.

### Manner backfill

Scoped invalidated-row backfill:

- selected: 40 active Daangn rows blocked by `daangn_manner_temperature_missing`
- patched: 36
- fetch 404: 4
- blocked: 0

Patched examples included Galaxy Buds, AirPods, iPhone, Galaxy S series, Adidas clothing, Bose headphones, Dyson Airwrap, and PS5 rows.

Follow-up scoped invalidated-row backfill:

- selected: 50
- patched: 37
- detail 404/410 marked as `daangn_detail_404_manner_backfill`: 13
- blocked: 0

After the first backfill batch and natural score/recovery processing:

- Daangn pool moved from roughly `ready=412 / invalidated=503` to `ready=433 / invalidated=482`.
- `daangn_manner_temperature_missing` moved from roughly 190 to 154.

After the second backfill batch and another score/recovery cycle:

- Daangn pool moved to `ready=442 / invalidated=473`.
- `daangn_manner_temperature_missing` moved to 104.
- `daangn_detail_404_manner_backfill` rose to 48 because stale/deleted Daangn originals are now labeled accurately instead of sitting in the generic missing-manner bucket.

## Deferred

1. Deploy the code changes only after checking unrelated dirty worktree state.
   - This wave intentionally did not deploy the whole dirty worktree.

2. Add a permanent invalidated-row Daangn manner backfill worker/script.
   - Script support exists via `--scope=invalidated-missing`.
   - A scheduled worker is still deferred.

3. Decide whether 40 keyword combos/run is enough.
   - It is safe locally, but slow.
   - If production duration and block rate stay healthy, consider 60-80 sequential keyword combos with the same delay.

4. Continue draining `daangn_manner_temperature_missing`.
   - The second manual batch started marking 404 rows accurately, but this should be encoded in a permanent worker/script.

## Verification

- `npx eslint src/lib/daangn-price-sweep.ts src/lib/daangn-ingest.ts src/app/api/cron/daangn-price-sweep-worker/route.ts scripts/backfill-daangn-manner-temperature.ts` passed.
- `npx tsx --env-file=.env.local scripts/backfill-daangn-manner-temperature.ts --scope=invalidated-missing --limit=1 --dry-run` passed.
- `npm run build` passed.
