# 2026-05-28 — Wave 908 Daangn SKU Price Sweep Worker

## Context

Daangn listings are now source-strict for market basis. A Daangn candidate should not silently use mixed Bunjang/Joongna market stats. This improves trust, but it means Daangn ready volume is gated by Daangn-specific sample counts.

User clarification: use the ready SKU catalog itself. Exclude internal-only/blocked SKUs, then sweep Daangn so each ready SKU with missing/low samples gets toward 5-10 Daangn samples. Prefer recent rows and `Closed` rows when available, but active rows also count as same-source market basis.

## Decision

Implemented a separate market-sample sweep, not mixed into the ready firehose.

Worker:

- `src/lib/daangn-price-sweep.ts`
- `src/app/api/cron/daangn-price-sweep-worker/route.ts`
- Vercel cron: `24,54 * * * *`

Behavior:

- Load ready SKUs from catalog/category/lane readiness.
- Exclude internal-only/blocked lanes.
- Count existing Daangn `detail_status='done'` samples per SKU.
- Target SKUs below `DAANGN_PRICE_SWEEP_TARGET_SAMPLES` (default 10).
- Try SKU keyword URLs first, then category pages plus local classifier fallback.
- Parse `Ongoing` and `Closed` rows.
- Fetch detail pages before writing so sweep samples count in market stats.
- Store matched rows as Daangn source samples, but keep sweep rows market-sample-first:
  - `Closed` → `listing_state='sold_confirmed'`
  - `Ongoing` → active market comp only if classifier confirms the same comparable key
  - no direct pool promotion from the sweep itself
- Enqueue market invalidation for affected comparable keys so per-source market rows refresh quickly.

## Important Finding

Live probe on 2026-05-28 showed Daangn keyword URLs work when category is omitted:

- `/search/맥북` redirects to `/kr/buy-sell/?search=맥북` and returns ~266 rows.
- `/kr/buy-sell/?in=381&search=맥북` returns ~280 rows.

Earlier probes with `category_id` plus `search` were unreliable/empty. Therefore keyword combos intentionally omit `category_id` in the URL, while the combo still carries the expected category for local classifier scoping.

Category pages without `search` still return articles and include some `Closed` rows. They remain the fallback when exact keyword searches do not hit a SKU.

Implementation therefore supports both paths. Keyword URL hits are used if Daangn returns them. Category pages are the reliable fallback.

## Deferred

- Do not increase normal Daangn ready firehose solely for historical price samples.
- Do not use search-sweep rows for velocity. Closed search rows generally do not provide reliable first-seen to sold elapsed time.
- Do not trust keyword hits without classifier-confirmed `comparable_key` and condition grouping.

## Runtime Defaults

- `DAANGN_PRICE_SWEEP_TARGET_SAMPLES=10`
- `DAANGN_PRICE_SWEEP_MAX_SKUS=80`
- `DAANGN_PRICE_SWEEP_MAX_REGIONS=24`
- `DAANGN_PRICE_SWEEP_MAX_SEARCH_COMBOS=120`
- `DAANGN_PRICE_SWEEP_MAX_CATEGORY_COMBOS=180`
- `DAANGN_PRICE_SWEEP_MAX_DETAIL_FETCHES=140`
- `DAANGN_PRICE_SWEEP_SEARCH_CONCURRENCY=36`
- `DAANGN_PRICE_SWEEP_DETAIL_CONCURRENCY=10`
- `DAANGN_PRICE_SWEEP_SAMPLE_COUNT_SCAN_ROWS=5000`

Dry-run is available via `?dryRun=1` or `DAANGN_PRICE_SWEEP_DRY_RUN=true`.

## Verification

- `npx eslint src/lib/daangn-price-sweep.ts src/lib/daangn-ingest.ts src/lib/cron-guard.ts src/app/api/cron/daangn-price-sweep-worker/route.ts` passed.
- `npm run build` passed.
- Local dry-run with `maxSkus=8/maxRegions=2/maxSearchCombos=12/maxCategoryCombos=4`:
  - ready SKUs: 1,566
  - deficient SKUs: 1,436
  - fetched articles: 1,059
  - matched/detail parsed: 1
  - matched row was `Closed`.
- Local small real run with the same limits:
  - raw upserted: 1
  - market invalidations queued: 1
  - sample count scan still took ~24s, so the worker uses keyset pagination and stops early on count-scan timeout instead of failing the whole sweep.

## 2026-05-28 follow-up — local sweep actually filled samples

User corrected the execution plan: do not wait for production cron to fill Daangn market samples. Run local, slow, rate-limited sweeps against production DB so ready SKUs can reach useful Daangn sample depth faster.

Findings:

- Daangn `search=` and `category_id=` URLs currently return HTTP 200 but empty `fleamarketArticles` in the Remix loader for many tested URLs.
- Region-only firehose URLs (`/kr/buy-sell/?in=<region>`) still return 260+ rows and are the same primitive used by the healthy Daangn ingest worker.
- Therefore the price sweep fallback was changed from category-filter URLs to region-only firehose URLs, then local classifier decides whether each row belongs to the target SKU.
- Target selection was also changed to prioritize SKUs recently blocked by Daangn-specific pool reasons (`daangn_volume_below_3`, missing source market basis, etc.), instead of wasting early batches on zero-sample long-tail catalog SKUs.
- Search query ordering was changed to prefer Korean aliases/searchQueries before `modelName`, because many catalog `modelName` values are English or too verbose for Daangn.
- Added local safety controls:
  - `requestDelayMs`
  - `abortOnBlockedCombo`
  - `regionRotationOffset`

Local production writes completed:

- Warm-up firehose round: 8 regions, 2,134 fetched, 8 matched/detail parsed, 8 raw upserted, 0 blocked.
- Main round: 32 regions, 6,781 fetched, 46 matched/detail parsed, 42 raw upserted, 0 blocked.
- Rotated round: 40 regions, 2,961 fetched, 13 matched/detail parsed, 13 raw upserted, 0 blocked.
- Three additional rotated rounds:
  - offset 80: 2,218 fetched, 19 raw upserted, 0 blocked.
  - offset 120: 3,337 fetched, 25 raw upserted, 0 blocked.
  - offset 160: 1,917 fetched, 7 raw upserted, 0 blocked.

Additional continuation after user asked whether the job was actually done:

- offset 200: 4,029 fetched, 10 detail parsed, 7 raw upserted, 0 blocked.
- offset 235: 6,283 fetched, 28 detail parsed, 28 raw upserted, 0 blocked.
- offset 15: 4,813 fetched, 44 detail parsed, 44 raw upserted, 0 blocked.

Total from the local follow-up runs so far: **193 new Daangn raw rows** inserted and market invalidations queued for affected comparable keys.

Post-run spot check:

- Recent 2h Daangn `detail_status=done` rows: 590
- State split: active 569 / disappeared 13 / sold_confirmed 8
- After continuation, recent 3h Daangn `detail_status=done` rows exceeded 1,000 scanned rows (963 active / 11 sold_confirmed / 26 disappeared in the first 1,000 returned by API).
- Daangn ready count moved around 403 → 409 during the run. Additional improvement depends on score/market invalidation workers consuming the queued keys and the active-volume gate.

Remaining note:

- Filling every ready SKU to 10-15 samples is not a “minutes” job. With safe region-only firehose, the observed local pace is roughly 7-42 new usable rows per 1.5-3.3 minute round depending on region yield. It is realistic to keep running local batches, but the production-safe code path must stay region-only and block-aware.

## 2026-05-28 follow-up — recover invalidated rows after sample fill

User asked whether previously invalidated Daangn rows can be recovered once missing samples are filled, excluding sold/reserved items.

Decision:

- Yes, but only as a scoped re-score. Do not bulk flip `candidate_pool.status` manually.
- Mark the original raw rows dirty only when they are:
  - `source = daangn`
  - currently active/selling (`listing_state = active`, `sale_status = selling`)
  - invalidated for recoverable market/sample reasons:
    - `sku_median_unavailable`
    - `daangn_volume_below_3`
    - `daangn_market_basis_missing`
    - `blocked_market_stat_missing`
- Sold/reserved rows remain excluded from recovery.

Execution:

- Found 194 active/selling recoverable invalidated Daangn rows:
  - `daangn_volume_below_3`: 175
  - `sku_median_unavailable`: 7
  - `daangn_market_basis_missing`: 4
  - `blocked_market_stat_missing`: 8
- Marked all 194 source rows `score_dirty = true`.
- Ran five local score-stage passes against production DB:
  - scored 494 rows
  - pool upserted/recovered 26 rows
  - remaining skips were mostly non-sample blockers:
    - `daangn_manner_temperature_missing`
    - `negative_resell_gap`
    - `profit_not_positive_after_costs`
    - still-missing median/volume for some long-tail keys
- Final spot count after the local recovery passes:
  - ready: 408
  - invalidated: 430
  - score dirty: 214

Implication:

- The sample-fill recovery path works, but filled market samples do not automatically make every old invalidated row ready.
- The next recovery bottleneck is Daangn seller/manner metadata. Existing backfill scripts focus on ready rows; a follow-up should add a scoped backfill for active invalidated recovery candidates blocked by `daangn_manner_temperature_missing`.

## 2026-05-28 follow-up — Daangn ready/day measurement

Measured current production throughput after the region-only sweep and recovery work.

Current pool stock:

- Current Daangn ready rows: 412
- Current Daangn invalidated rows: 430

Daangn ready rows currently in ready status by `added_at`:

- last 1h: 27
- last 3h: 76
- last 6h: 86
- last 12h: 136
- last 24h: 238

Daangn worker logs:

- last 24h worker runs: 202
- last 24h collected: 5,449,977 article observations
- last 24h upserted raw rows: 26,572
- last 24h enriched rows: 1,010

Score worker logs:

- last 24h score-worker runs: 873
- last 24h scored rows: 86,001
- last 24h gross poolUpserted: 2,261 across all sources
- top skip reasons remain:
  - `negative_resell_gap`
  - `profit_below_pack_band`
  - `sku_median_unavailable`
  - `sku_low_volume_below_2d1_or_7d3`
  - `daangn_volume_below_3`

Projection:

- Actual trailing 24h Daangn ready-add baseline: ~238/day.
- Recent post-tuning 3h pace: ~600/day gross Daangn ready-add if it holds, but this is inflated by fresh sample/recovery work.
- Practical near-term expectation: ~250-450 Daangn ready additions/day without another policy relaxation.
- Net ready stock growth will be lower than gross additions because lifecycle/re-score invalidations remove rows at the same time.

Next measurement:

- Re-measure after 12-24h of steady production runtime. If Daangn ready-add stays above 400/day and invalidation quality is acceptable, no immediate gate relaxation is needed.
- If it falls back toward 200/day, next bottlenecks to attack are seller/manner backfill and remaining source-specific sample gates, not raw firehose volume.

## 2026-05-28 follow-up — multi-user ready capacity strategy

User concern: if Daangn ready additions are only a few hundred/day, multiple users may exhaust or crowd the same ready inventory.

Decision:

- Do not make IP rotation / multi-deployment scraping the primary plan. It increases block/ToS/ops risk and does not fix the main measured bottleneck.
- Add capacity by improving conversion and inventory buffering:
  1. Daangn-specific scoring/recovery worker so Daangn dirty rows do not compete with global score workload.
  2. Daangn manner/detail backfill for invalidated recovery candidates blocked by `daangn_manner_temperature_missing`.
  3. Demand-aware ready buffer by category/price bucket. When ready stock drops below a target, trigger more sweep/backfill for that bucket.
  4. Increase `daangn-price-sweep-worker` cadence cautiously only if blockedCombos stays 0 and quality metrics hold.
  5. User-facing feed should be treated as a renewable shared inventory, not a permanently consumed list. Detailed opens consume credits; feed browsing should not drain global ready rows.

Rejected as primary:

- Multiple Vercel projects/functions solely to obtain different outbound IPs.
- Blindly raising Daangn search concurrency beyond the current block-aware path.

Near-term capacity target:

- Stock target: keep Daangn ready inventory above 1,000 current rows before broad promotion.
- Throughput target: sustain 400+ Daangn ready additions/day for 24h without quality regression.

## 2026-05-28 follow-up — Daangn worker B lane

User clarified the requested IP/parallelism strategy is not unlimited rotation, but one extra lane to roughly double Daangn collection capacity.

Implemented:

- Added `/api/cron/daangn-worker-b`.
- Added separate cron guard mode `daangn_worker_b` so it does not skip behind the primary `daangn_worker` lock.
- Added Vercel cron schedule:
  - primary A: `3,8,13,18,23,28,33,38,43,48,53,58 * * * *`
  - B lane: `1,6,11,16,21,26,31,36,41,46,51,56 * * * *`
- B lane uses the same full-region firehose default but separate env overrides:
  - `DAANGN_WORKER_B_ENABLED` (default true)
  - `DAANGN_INGEST_B_MAX_COMBOS`
  - `DAANGN_INGEST_B_MAX_UPSERT_ARTICLES`
  - `DAANGN_INGEST_B_MAX_DETAIL_SAMPLES`
  - `DAANGN_INGEST_B_SEARCH_CONCURRENCY`
  - `DAANGN_INGEST_B_CATEGORY_BOOST_REGIONS` (default 0)
- B lane logs separately as `pipelineMode = daangn_worker_b`, with detail `lane = b`.

Important:

- Same Vercel project/function set does not guarantee a distinct outbound IP. The immediate benefit is a second ingest/upsert lane with a separate cron/lock. If hard IP separation becomes necessary, run the B endpoint from a second deployment/project or external scheduler, but keep the same block-aware guard and source-health checks.
- B default leaves category boost off to reduce extra request pressure. It is intended to raise the raw/upsert cap first, not to blindly double every query dimension.

User correction:

- The intended strategy is a second Vercel project in a Japan compute region, not merely a second route inside the same project.
- A separate Japan project should materially separate the execution/egress path from the primary `iad1` project, though Vercel only guarantees fixed/dedicated outbound IPs with Static IPs or Secure Compute.
- Important deployment caveat: connecting the same repo to a second Vercel project would run every `vercel.json` cron twice unless gated.

Additional implementation:

- Added `CRON_PROJECT_ROLE=daangn_b` gate.
- When a deployment has `CRON_PROJECT_ROLE=daangn_b`, guarded cron routes skip unless the mode is `daangn_worker_b`.
- Added explicit 200 no-op skips to scheduled cron routes that did not use `cron-guard`:
  - daily backup
  - manual deposit auto approve
  - safety stats warmer
  - sync market velocity
  - operator brief
  - incident watch
- This lets a second Japan Vercel project use the same repo safely: all scheduled crons may fire, but only `/api/cron/daangn-worker-b` mutates data.

Japan project setup requirement:

- Create a second Vercel project from the same repo.
- Set function region to Japan (`hnd1` Tokyo preferred, `kix1` Osaka acceptable) in that project only.
- Set `CRON_PROJECT_ROLE=daangn_b`.
- Copy production env vars required for Daangn ingest and Supabase writes.

Verification:

- `npx eslint src/lib/cron-guard.ts src/app/api/cron/daangn-worker-b/route.ts src/app/api/cron/daangn-worker/route.ts` passed.
- `npx eslint` on the new project-role-gated scheduled cron routes passed.
- `npx tsx --test tests/daangn-ingest.test.ts` passed.
- `npm run build` passed.

## 2026-05-28 follow-up — Daangn-B project runtime cost lock

User concern:

- If the Japan Vercel project connects to the same repo, the frontend and unrelated API routes still deploy. That could look wasteful or accidentally serve traffic.

Decision:

- Keep one GitHub repo for code sync, but make the second Vercel project runtime-only for Daangn-B.
- Added a middleware gate for `CRON_PROJECT_ROLE=daangn_b`:
  - `/api/cron/daangn-worker-b` passes through.
  - Other `/api/cron/*` paths return immediate 200 skip JSON.
  - Frontend and non-cron API paths return 404 before reaching page/API handlers.

Cost implication:

- The second project still pays the cost of building the full Next app during deploy because it is the same repo.
- Runtime/render/API execution is locked to the B worker path, so accidental public frontend traffic or other cron/API execution should not create meaningful compute work.
- If build cost becomes material later, the cleaner next step is a small worker-only project/repo or monorepo sub-app. That is not necessary for the immediate two-lane Daangn ingest test.

Verification:

- `npx eslint src/middleware.ts src/lib/cron-guard.ts src/app/api/cron/daangn-worker-b/route.ts` passed.
- `npm run build` passed.

## 2026-05-28 follow-up — A/B Daangn lane split for ready growth

User concern:

- A/B 를 단순 복제하면 같은 전국 firehose 를 또 긁어서 중복이 커지고, ready 가 2배까지 늘지 않을 수 있다.
- 목표는 raw request 2배가 아니라 user-visible ready stock 을 최대한 2배에 가깝게 늘리는 것.

Decision:

- Add deterministic Daangn region sharding.
- Existing A lane remains broad by default for safety, but can be made shard A with:
  - `DAANGN_INGEST_REGION_SHARD_COUNT=2`
  - `DAANGN_INGEST_REGION_SHARD_INDEX=0`
- B lane defaults to shard B:
  - `DAANGN_INGEST_B_REGION_SHARD_COUNT=2`
  - `DAANGN_INGEST_B_REGION_SHARD_INDEX=1`
- This avoids A/B both spending classify/upsert budget on the same region set.

B lane tuning:

- B default detail samples: `8` (A default `5`)
- B default upsert/classify cap: `800` (A default `500`)
- B default category-depth boost: `30` regions (A default `15`)
- Rationale: B should not be just another broad firehose copy. It should spend more of its budget on target categories and changed candidates that are more likely to become ready rows.

Expected effect:

- With A left unsharded and B sharded, expected ready uplift is roughly 1.3-1.7x because A still covers all regions and B adds a lower-duplicate half-lane.
- With A and B both configured as shard count 2 / index 0 and 1, expected ready uplift can get closer to 2x if score-worker/lifecycle gates are not the next bottleneck.
- If logs show high `rawSkippedExisting` or low `upsertCandidateArticles`, next step is not adding C/D/E immediately. First tune per-lane category boost, upsert cap, and recovery/score throughput.

Deployment caveat discovered:

- The Daangn-B frontend lock was local-only until pushed. If the Japan Vercel project was deployed from GitHub before this commit, frontend routes would still work.
- After deploying the commit containing the middleware gate, `CRON_PROJECT_ROLE=daangn_b` must also be set in that project's Production environment. If either is missing, the frontend lock will not apply.
