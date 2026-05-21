# 2026-05-21 — Joongna source visibility in ready pool

## Context
- Joongna active ingest is already writing ready candidates into `mvp_candidate_pool`.
- DB check after deploy/env update showed `ready_total=365`, with `bunjang=361` and `joongna=4`.
- The UI/API path still treated candidate listings as Bunjang by default, so operators could not visually confirm whether a ready card came from Bunjang or Joongna.

## Decisions
- Add a shared marketplace source helper (`marketplace-source.ts`) for normalized source id, label, and listing URL fallback.
- Expose `marketplaceSource`, `marketplaceLabel`, and `listingUrl` from:
  - `/api/admin/pool-listings`
  - `/api/public/pool-listings`
  - `/api/packs/pool`
  - `/api/packs/pool/detail-access`
  - `/api/packs/me`
- Show source badges in:
  - admin/operator pool card rows and ready source stats
  - `/me` reveal cards
  - `/explore` cards
  - reveal detail modal header and original listing CTA
- Keep marketplace source labels separate from price-evidence labels. A candidate listing can be Joongna/Bunjang, while the market sample is still grouped by same product/status (`comparable_key` + condition), not by marketplace source.
- Make live verification source-aware:
  - Bunjang listings still use Bunjang detail API and comment-count checks.
  - Joongna listings use Joongna product detail URL and productStatus/text sold checks.
  - Joongna fetch/block failures release/keep the candidate instead of incorrectly calling Bunjang and marking it disappeared.

## Deferred
- Joongna comment-count based filtering is not implemented because the current Joongna parser does not extract comments.
- A real Joongna brand asset was not added; UI uses a compact text badge until an official/local asset is available.
- Market graph evidence remains Bunjang/Danawa based until Joongna sold/price history aggregation is added.

## Verification
- `npx eslint` on touched source files: passed with only pre-existing `<img>` warnings in `market-brand-logo.tsx`.
- `npm run build`: passed.
- DB spot check: 4 Joongna ready candidates are active and have `https://web.joongna.com/product/...` URLs.

## Follow-up — source filter
- A later production check showed Joongna is present in recent pool rows, but sparse enough to be visually buried in default mixed-source lists.
- Added `source` filtering to admin/public pool listing APIs and the operator pool UI.
- Operator can now click the source ready chip or use the source dropdown to view only Joongna/Bunjang rows.
- Production DB check at the time of this follow-up:
  - `ready_total=365`
  - recent ready by `added_at` top 80: `joongna=5`, `bunjang=75`
  - newest ready added row was Joongna: `아이패드 미니 7 a17 pro 준신동 팝니다`

## Follow-up — /me pool source selector
- Added the same source selector to the `/me` pool feed.
- `/api/packs/pool` now accepts `source=bunjang|joongna` and applies the source scope before category diversification, budget filtering, and response masking.
- `/me` UI now preserves `source` in the URL and reloads the feed when the operator selects `출처 전체`, `번개장터`, or `중고나라`.
- Verification:
  - `npx eslint src/app/api/packs/pool/route.ts src/components/explore-client.tsx`: passed.
  - `npm run build`: passed.

## Follow-up — admin source filter bug
- Operator reported selecting `중고나라 — 5건` in the admin candidate pool still showed the full mixed 365 ready rows.
- Root cause: admin/public pool APIs created a `pidScope` for `source`, but the paginated fetch path only treated price/SKU/search as external filters. Source-only filtering built the scope and then ignored it.
- Fix: include any `scopedPids` in the external filter path and reject rows not in the scoped pid set.
- Verification:
  - `npx eslint src/app/api/admin/pool-listings/route.ts src/app/api/public/pool-listings/route.ts`: passed.
  - `npm run build`: passed.

## Follow-up — source-agnostic market sample wording
- Operator corrected the product strategy: there is no separate “Joongna 시세” vs “Bunjang 시세” in the user-facing sample. The market price should be a social/common used-market price for the same product and condition.
- Decision: comparison sample/evidence remains source-agnostic (`comparable_key` + condition + safety filters). Marketplace source is only provenance for the original listing and optional operator filtering.
- Changed user/operator wording from `번개 ... 매물 기준/median/추이` to `통합 ... 매물 기준/median/추이` where it refers to the market sample.
- `/api/listings/[pid]/market-source` now returns `marketplaceSource`, `marketplaceLabel`, and source-aware `listingUrl` for the target listing and comparison rows, while preserving legacy `bunjangUrl` as a compatibility alias.
- Deferred: historical `mvp_market_price_daily` rows were not recomputed in this change; the code path already aggregates by product/condition, and Joongna volume will naturally join the same aggregate as source data grows.

## Follow-up — detail-access live verification parity
- Operator asked whether the `/me` product feed treats Joongna like Bunjang for live validation before users see details.
- Finding: already-opened `/api/packs/me` rows live-verify on page load, and pack-open reservation live-verifies before reveal. But `/api/packs/pool/detail-access` was only checking `ready` before consuming free/credit detail access.
- Fix: `detail-access` now loads the exact ready pool item and runs source-aware live verification before consuming the user's free view/credit.
- Bunjang path now checks raw/detail comment count >= 8, missing detail, sold-out signals, and live listing classification before detail access is granted.
- Joongna path now checks product detail fetch, 404 disappearance, `productStatus !== 0`, sold-out text signals, and live listing classification before detail access is granted.
- If live verification fails because the source is temporarily unstable, the route returns an error without spending the free view/credit.
- Deferred: Joongna comment-count blocking remains unavailable because current Joongna public product HTML does not expose a stable comment count field in the parser sample; `num_comment` remains `null` for Joongna rows until a reliable field/API is found.

## Follow-up — reveal modal source wording and Joongna images
- Operator found source drift inside the easy-view/detail modal: beginner copy and channel-profit cards still implied Bunjang-only comparison/resale even for Joongna listings.
- Fix: beginner trust, payment, market/channel copy now uses the listing marketplace label or generic `중고 마켓` wording instead of Bunjang-only text where the logic is source-agnostic.
- Fix: resale comparison now shows Bunjang, Joongna, and Daangn cards. Bunjang/Joongna use the same conservative marketplace-fee estimate; Daangn remains local/direct-trade upside with region/negotiation burden.
- Fix: detail-modal images are marked `unoptimized`, and `next.config.ts` now allows `**.joongna.com` image hosts so Joongna CDN thumbnails render in the detail modal and beginner view.
- Deferred: Joongna-specific exact payment/fee policy is not hardcoded. UI says to confirm 안전거래/수수료 in the original listing, while profit math keeps using the existing conservative marketplace-fee estimate.

## Follow-up — Joongna ready SKU crawl breadth
- Operator reported that Joongna ready pool stayed at only 4-5 rows after multiple hours.
- Finding: Joongna worker was healthy and not blocked, but it only scanned the static seed queries from env (`에어팟맥스, 아이폰 17 프로, 아이패드 프로, 애플워치, 맥북`) and `JOONGNA_INGEST_MAX_DETAILS=12`. It was a narrow probe, not a ready-SKU crawl.
- Fix: Joongna ingest now builds a source-specific rotating query pool from catalog SKUs that can enter the public pool under `evaluatePoolGate` + DB category readiness. Internal-only/blocked categories remain excluded.
- Fix: use one representative query per ready SKU for Joongna to avoid expanding every alias into a 1,900+ query backlog.
- Fix: legacy low env values are bounded for cron runs: query pool window defaults to 50 queries, details per query is capped at 2 unless an explicit request param overrides it, and max details is coerced to at least 32 unless explicitly overridden.
- Verification:
  - Recent production DB check before fix: Joongna worker succeeded every 15 minutes, source health was `healthy`, but ready pool was 4 rows.
  - Local production-mode ingest after fix: 50-query window, `queryPoolSize=680`, `searchUrls=32`, `fetchedDetails=32`, `parsedUpserted=20`, no block signals.
  - Forced score stage after ingest: `scored=72`, `poolUpserted=3`; many non-ready rows were correctly skipped for `sku_median_unavailable`, low profit, negative gap, or internal-only clothing.
- Deferred: Joongna volume will still not jump to every raw row immediately. Rows only become ready when the same product/condition has usable market median, profit band, volume, and risk gates.

## Follow-up — Joongna local no-write rate probe
- Operator asked for a local stress/rate-limit check similar to the earlier Bunjang calibration.
- Boundary decision: do not intentionally hammer Joongna until it blocks. Use a no-write, bounded, stop-on-first-block probe to estimate a conservative operating envelope.
- Added `scripts/report-joongna-rate-probe.ts` and npm alias `report:joongna-rate-probe`.
- Probe behavior:
  - Collects product URLs from normal search pages.
  - Fetches product detail HTML only; no Supabase writes.
  - Records latency, HTTP/block signals, 404s, and errors.
  - Stops immediately on 401/403/429/451/block-like response or thrown fetch error.
- Local results on 2026-05-21:
  - Smoke: 4 URLs, 2 detail reads at 1000ms delay, 0 blocks.
  - Conservative stair-step: 80 URLs collected; 40 detail reads across 1200/800/500/350/250ms delay, all 40 OK, 0 blocks, 0 errors.
  - Short burst check: 40 URLs collected; 12 detail reads across 200/150ms delay, all 12 OK, 0 blocks, 0 errors.
- Recommendation:
  - Production should stay materially below the fastest burst. Current worker settings (`queryLimit=50`, `detailsPerQuery=2`, `maxDetails=50`, `delayMs=450`) are within the observed no-block envelope, but source-health stop conditions must remain active.
  - Avoid parallel Joongna workers. Keep one worker lease/guard and back off immediately on `sourceHealthStatus != healthy` or any block signal.

## Follow-up — Joongna cadence moved closer to Bunjang
- Operator clarified that Joongna should be calibrated against the Bunjang operating envelope, not treated as a tiny probe.
- Production comparison before this change:
  - Bunjang `tick`: roughly 28k search rows/hour in the last 6h sample.
  - Bunjang `detail-worker`: roughly 436 enriched details/hour.
  - Joongna worker: roughly 30 fetched details/hour because it ran every 15 minutes and capped each run at a small batch.
- Local active ingest test after the safe probe:
  - `queryLimit=80`, `maxDetails=80`, `detailsPerQuery=2`, `delayMs=200`.
  - Result: `searchUrls=80`, `fetchedDetails=80`, `rawUpserted=80`, `parsedUpserted=40`, `blockedSignals=[]`, `sourceHealthStatus=healthy`.
- Decision:
  - Move `/api/cron/joongna-worker` from every 15 minutes to every minute.
  - Clamp non-param production defaults to at least `queryLimit=80` and `maxDetails=80`.
  - Clamp non-param production delay to max 250ms; env target is 200ms.
  - Keep `detailsPerQuery=2` to spread coverage across many ready SKU searches instead of over-sampling a few broad queries.
- Risk control:
  - Keep the cron guard/lease so overlapping minute ticks skip instead of parallelizing Joongna.
  - Keep source-health stop behavior; any block signal should degrade/unhealthy the source and stop worker admission.

## Follow-up — Joongna cadence normalized to market size
- Operator pointed out that Joongna should not simply run at the maximum safe local probe rate; it should roughly track market size versus Bunjang.
- Re-evaluation:
  - Bunjang acquisition gets many rows from one search API call, while Joongna currently needs a search page read plus product detail HTML reads to get usable fields.
  - Therefore `80 details every minute` is not equivalent to a Bunjang minute tick; it is heavier per accepted listing even though Joongna source volume is lower.
  - The safe local probe established headroom, not the desired steady-state cadence.
- Decision:
  - Keep Joongna batch breadth at `queryLimit=80`, `maxDetails=80`, `detailsPerQuery=2`, `delayMs=200` so each run spreads across many ready SKU searches.
  - Change `/api/cron/joongna-worker` from every minute to every 3 minutes.
  - This reduces Joongna request pressure to roughly one-third of the previous aggressive setting while still rotating the ~680 ready query pool in about 25-30 minutes.
- Deferred:
  - Re-check production after several hours. If Joongna ready pool still grows too slowly and source health stays clean, move to every 2 minutes before increasing per-run batch size.

## Follow-up — Joongna category-balanced query rotation
- Operator noticed Joongna appeared to bring almost no shoes/fashion rows.
- Finding:
  - Joongna raw/parsed had started to receive some `shoe` rows, but `candidate_pool` ready had no shoe/clothing rows in the latest sample.
  - The ready catalog query pool itself was not missing fashion: dry config showed `shoe=226`, `clothing=48`, `bag=41` ready catalog queries.
  - Root cause was query-window bias: the worker rotated a contiguous catalog-order slice, so a single 80-query run could be almost entirely smartwatch/phone/tablet/laptop. The rotation interval was also still 15 minutes, so the 3-minute cron repeated the same category-clumped window five times.
- Fix:
  - Change Joongna query rotation to 3 minutes to match the current Vercel cron cadence.
  - Replace contiguous catalog-order windows with category-balanced rotating windows.
  - Keep seed queries first, then fill the remaining batch with a round-robin category mix across ready catalog queries.
  - Record `readyCatalogCategoryPoolCounts` and `selectedReadyCatalogCategoryCounts` in Joongna result/source-health metadata so future operator checks can see category coverage directly.
- Verification:
  - Dry config with `JOONGNA_SOURCE_MODE=off` selected an 80-query batch with fashion represented every run: `shoe=4`, `clothing=4`, `bag=4` in the selected ready catalog portion, plus all other available categories.
  - `npx eslint src/lib/joongna-ingest.ts src/app/api/cron/joongna-worker/route.ts`: passed.
  - `npm run build`: passed.
- Deferred:
  - This fixes acquisition coverage, not the downstream ready gate itself. Shoe/clothing rows still need the normal market median, profit, risk, seller, and low-volume gates before users see them.

## Follow-up — Joongna seller trust enrichment
- Operator asked whether Joongna has seller review/rating/comment signals like Bunjang and why they were not appearing.
- Finding:
  - Joongna product-detail HTML only carries basic seller ids (`storeSeq`, `nickName`) plus product facts.
  - Joongna has a separate public seller profile API: `main-api.joongna.com/user/info/product-detail?storeSeq=...`.
  - Sample no-write check returned seller trust facts: `reviewCount=96`, `followerCount=11`, `activityScore=300`, `reliabilityScore=672`, profile image, and store intro.
  - Joongna safe-order transaction count is available via `boot.joongna.com/api-order/transactions/count?storeSeq=...`; sample returned `salesCount=97`, `purchasesCount=60`.
  - A product chat/comment count endpoint exists in the client bundle, but no-write probing returned 403 from public endpoints. Do not treat it as a reliable Bunjang-style public comment count yet.
- Fix:
  - Added Joongna seller-profile and order-transaction fetchers.
  - Joongna ingest now enriches writable details by unique `storeSeq`, writes seller facts into `mvp_sellers`, and stores per-listing seller review/trust facts on `mvp_raw_listings`.
  - `shop_review_count` now uses Joongna `reviewCount`.
  - `shop_review_rating` uses a source-tagged normalized trust score from `activityScore + reliabilityScore` on a 0-5 scale, with the original Joongna score components retained in `raw_json.seller` and `mvp_sellers.source_json`.
  - Cron run metadata records seller profile/transaction fetch counts.
- Verification:
  - No-write API check for store `5792829` returned the expected profile and transaction count JSON.
  - `npx eslint src/lib/joongna.ts src/lib/joongna-ingest.ts src/app/api/cron/joongna-worker/route.ts`: passed.
  - `npm run build`: passed.
- Deferred:
  - Do not implement Joongna comment-count gate until a stable public field/API is found. Current `num_comment` stays null for Joongna rows.

## Follow-up — Joongna ready count stall diagnosis and seller upsert fix
- Operator observed Joongna ready count stalled around low double digits and asked whether the source was dead or simply rotating slowly.
- Finding:
  - Joongna collection was not blocked by dead listings: current Joongna pool showed `ready=32`, `invalidated=2`.
  - Acquisition had worked earlier in the hour (`raw=646`, `parsed=349`), but recent Joongna worker runs started failing after seller trust enrichment.
  - Failure root cause: `mvp_sellers` upsert received duplicate `(source, seller_uid)` rows when multiple Joongna listings in the same batch belonged to the same seller. Postgres rejected the batch with `ON CONFLICT DO UPDATE command cannot affect row a second time`, so raw/listing writes after that point did not happen.
  - Downstream scoring was alive: `score-worker` continued every minute and had no Joongna scorable dirty backlog once it processed rows. Most parsed-but-not-ready rows were normal gate decisions (`coarse_market_price`, `market_confidence_low`, `market_stat_missing`, low profit/overpriced/deep-discount review), not lifecycle deaths.
- Fix:
  - Deduplicate Joongna `mvp_sellers` payload by `source:seller_uid` inside `runJoongnaIngest` before the upsert.
  - Keep the latest seller fact row from the current batch; this is safe because seller profile facts are store-level, not listing-level.
- Verification:
  - `npx eslint src/lib/joongna-ingest.ts src/app/api/cron/joongna-worker/route.ts`: passed.
  - Local active smoke ingest: `query=에어팟맥스`, `maxDetails=8` completed with `rawUpserted=8`, `parsedUpserted=6`, `sellerProfilesFetched=8`, `sellerTransactionsFetched=8`, `sourceHealthStatus=healthy`.
  - Manual score stage after the smoke ingest processed 39 rows and added 4 pool rows; top skips were expected business gates (`price_above_pool_max`, `sku_median_unavailable`, `negative_resell_gap`).
- Deferred:
  - Joongna fashion/shoe ready count is still limited mostly by market confidence and comparable-key sample availability. That is a pool-quality policy issue, not a crawler liveness issue.

## Follow-up — Cron watchdog false positive and Joongna sustainability patch
- Operator received Telegram incidents:
  - `deep-crawl 6시간+ 안 돎`
  - `housekeeper 6시간+ 안 돎`
  - `joongna_worker 63% failure`
- Findings:
  - `deep-crawl` was not actually down. Production `mvp_collect_runs` showed hourly successful runs at `2026-05-21T01:27Z` through `05:27Z`.
  - `housekeeper` was not actually down. Production showed successful runs at `05:07Z`, `05:37Z`, and `06:07Z`.
  - The watchdog issue was false-positive behavior: a transient Supabase/PostgREST lookup failure could return `null`, and the caller interpreted that the same as "no run in lookback."
  - Joongna failure-rate alert was real historical failure noise from the seller upsert duplicate bug fixed in commit `28be0a0`. After that fix, production Joongna runs succeeded with `fetchedDetails=80`, `parsedUpserted=39-49`, `blockedSignals=[]`.
  - Remaining sustainability concern: Joongna runs took roughly `79-115s` because each 80-detail batch also fetched seller profile/transaction facts for ~75 sellers. This is not a 60s cron limit and not a block signal, but it is too heavy as a steady-state pattern.
- Fix:
  - Changed cron watchdog lookup semantics: DB/REST lookup failure is now tracked as `lookupFailed` and does not send a stale-worker alert. A genuine empty lookback still alerts.
  - Added 6h TTL cache for Joongna seller profile/transaction facts using `mvp_sellers.source_json`.
  - Added `sellerCacheHits` to Joongna result/collect-run stage stats.
  - Adjusted Joongna source-health classification so a tiny search timeout rate does not mark the source degraded. Degrade now requires no writable details, a block, or search failure rate >= 15%.
  - Fixed detail-read timeout classification: a thrown fetch timeout is now counted as a transient detail failure, not as a block signal. Only an actual Joongna detail response block signal can mark the source `unhealthy`.
  - Added `joongna_worker` to source-health guard and made it read `source=joongna`; if Joongna ever becomes `unhealthy`, the worker will skip like the heavy Bunjang workers.
  - Lowered `joongna_worker` cron-guard cooldown from 10 minutes to 2 minutes so the 3-minute Vercel cron cadence is not silently throttled on warm instances.
- Verification:
  - `npx eslint src/lib/cron-watchdog.ts src/lib/cron-guard.ts src/lib/joongna.ts src/lib/joongna-ingest.ts src/app/api/cron/joongna-worker/route.ts tests/cron-guard.test.ts`: passed.
  - `npx tsx --test tests/cron-guard.test.ts`: passed.
  - `npm run build`: passed.
  - Local active smoke, `query=에어팟맥스`, `maxDetails=8`: first cache-aware run returned `sellerCacheHits=7`, `sellerProfilesFetched=1`, `sellerTransactionsFetched=1`, `blockedSignals=[]`, `sourceHealthStatus=healthy`.
  - Immediate second smoke returned `sellerCacheHits=8`, `sellerProfilesFetched=0`, `sellerTransactionsFetched=0`, `sourceHealthStatus=healthy`.
- Deferred:
  - Re-check production after deploy and one Joongna cron cycle. Expected result: `sellerCacheHits` appears in `/api/cron/joongna-worker` stage stats and run duration drops as repeated sellers are cached.
  - The 120-minute operational alert window may still mention old Joongna failures until those failed runs age out.
