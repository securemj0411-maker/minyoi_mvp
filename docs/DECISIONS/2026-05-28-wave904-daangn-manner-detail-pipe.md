# 2026-05-28 — Wave 904 Daangn manner temperature detail pipe fix

- Trigger: detail modal showed "당근 매너온도 정보 없음" even after Daangn manner temperature support had been added.
- Root cause: `daangn_manner_temperature` / `daangn_review_count` were selected and mapped in the pool list path, but were missing from two detail-facing paths:
  - `/api/packs/pool/detail-access`
  - `/api/packs/me`
- Decision: keep the existing DB/schema/scraper model and fix the response plumbing only. This avoids widening crawl/backfill work while ensuring stored values reach the modal.

## Changes

- Added `daangn_manner_temperature` and `daangn_review_count` to detail-access raw listing SELECT, facts construction, and returned item fields.
- Added the same fields to `/api/packs/me` raw SELECT, server `RevealItem` type, facts construction, and response fields.
- Added the same fields to `ExploreClient` `PoolItem` and RevealCard conversion.
- Added the same fields to `UserRevealDashboard` `RevealItem`, pack reveal event conversion, and modal conversion.
- Added the same fields to `/api/packs/pool` item response so the feed path also preserves the stored values.

## Follow-up Finding

- User checked a concrete Daangn row: `pid=9002247724635`, title `폴로 랄프로렌 블랙 반팔`.
- DB row had `daangn_manner_temperature=NULL`, `daangn_review_count=NULL`.
- Live Daangn detail parse for the same URL returned `score=42.4`, `reviewCount=68`.
- Recent Polo Daangn rows also showed the same pattern: many rows were `detail_status=done` but manner columns were NULL.
- Root cause: `buildRawListingRow` marked search-only Daangn rows as `detail_status='done'` even when the row did not come from a parsed detail HTML payload. Search result payloads do not include `user.score`.

## Extra Changes

- Patched `src/lib/daangn-ingest.ts` so search-only rows become `detail_status='pending'`; only parsed detail payloads become `done` and carry manner temperature/review count.
- Added migration `20260528070600_wave_daangn_detail_status_manner_fix.sql` to update `daangn_bulk_upsert_raw_listings_v2`:
  - pending search-only rows cannot downgrade existing done detail rows.
  - later detail payloads can promote a row to `done` and set `detail_enriched_at`.
  - manner temperature/review count continue to coalesce instead of being erased by NULL search payloads.
- Patched the concrete reported row in production DB:
  - `pid=9002247724635`
  - `daangn_manner_temperature=42.4`
  - `daangn_review_count=68`

## Verification

- Applied `20260528070600_wave_daangn_detail_status_manner_fix.sql` directly to production DB because Supabase CLI migration history did not match local migrations.
  - Verified `daangn_bulk_upsert_raw_listings_v2` function exists and includes the `excluded.detail_status='done'` promotion guard.
- Ran targeted ready-pool Daangn manner-temperature backfill.
  - Initial ready Daangn state: 280 rows, 259 rows had `daangn_manner_temperature=NULL`.
  - Backfill pass: 224 rows filled, 35 rows returned Daangn 404.
  - 404 cleanup: invalidated 37 deleted/private rows from `mvp_candidate_pool` and marked raw rows `listing_state='disappeared'`.
  - Follow-up pass filled newly surfaced ready rows during the run.
  - Final ready Daangn state: 268 rows, 268 with manner temperature, 0 NULL.
- Re-checked concrete reported row:
  - `pid=9002247724635`
  - `daangn_manner_temperature=42.4`
  - `daangn_review_count=68`
  - `listing_state=active`
- Follow-up reported row: `pid=9000506293605`, title `오니츠카타이거 멕시코66 실버 운동화 235`.
  - DB had `daangn_manner_temperature=NULL`, `daangn_review_count=NULL`.
  - Live Daangn detail parse returned `score=43.3`, `reviewCount=26`.
  - Patched production raw row to `43.3 / 26`.
  - Added on-demand recovery in `/api/packs/pool/detail-access` and `/api/packs/me`: when Daangn live verification returns seller score/review count, the API now patches DB and returns the live values even if old raw columns were NULL.
- `npx tsc --noEmit --pretty false 2>&1 | rg "src/(app/api/packs/(me|pool)|components/(explore-client|user-reveal-dashboard))" || true`
  - Result: no output for touched routes/components.
- `npx tsc --noEmit --pretty false 2>&1 | rg "src/app/api/packs/(me|pool/detail-access)/route.ts" || true`
  - Result: no output for the on-demand Daangn manner recovery paths.
- `npx tsx --test tests/marketplace-safety.test.ts`
  - Result: 5 pass / 1 fail.
  - Existing unrelated failure: `joongna direct-only shipping is not treated as free shipping` expects `/직거래 전제/`, current output is `0원 · 직거래만`.
- `npx tsx --test tests/daangn-ingest.test.ts tests/daangn-source-probe.test.ts`
  - Result: 27 pass / 0 fail.
- `npx tsc --noEmit --pretty false 2>&1 | rg "src/lib/daangn-ingest|20260528070600" || true`
  - Result: no output for touched ingest/migration paths.

## Deferred

- Normal migration history reconciliation is still separate because `supabase db push --dry-run` reported remote migration versions missing locally. The production RPC was applied directly for this incident.
- Broad non-ready historical Daangn rows can still have NULL manner temperature. User-facing ready pool was cleaned to 0 NULL.

## Follow-up Investigation 2

- User reported that the `오니츠카타이거 멕시코66 실버 운동화 235` fix did not answer the real question: why rows still missed manner temperature after the backfill/root fix.
- DB audit found the earlier backfill claim was too narrow/stale:
  - At the time of this follow-up, `mvp_candidate_pool.status='ready'` had 414 Daangn rows; 144 still had `daangn_manner_temperature=NULL`.
  - Broad historical raw data still had many bad old rows: `source='daangn' AND listing_state='active' AND detail_status='done' AND daangn_manner_temperature IS NULL` returned 168,131 rows.
  - Rows created after the first migration cutoff also contained `detail_status='done' + NULL`, so the running pipeline was not yet practically safe.
- Additional root gaps found:
  - `canSkipDaangnClassify` ignored `detail_status`, `daangn_manner_temperature`, and `daangn_review_count`, so an old unchanged row could skip the write even when the current run had a detail payload with score.
  - The detail-payload detector was too broad. It could treat seller profile-shaped fields as "detail enriched"; now it keys on real detail-only fields (`recommendedCount`/`commentCount`) or `score`/`reviewCount`.
  - `scripts/backfill-daangn-manner-temperature.ts` used 500-pid URL chunks and only found 25 candidates while 125 ready-null rows still existed. The script now paginates ready rows and uses 100-pid raw lookup chunks.

## Follow-up Fix 2

- Patched `src/lib/daangn-ingest.ts`:
  - Added `hasDaangnDetailPayload`.
  - Search-only rows no longer become `detail_status='done'`.
  - Preflight skip now refuses to skip when an incoming detail payload has a score/review count that differs from, or is missing in, the existing raw row.
  - Existing-row preflight SELECT now includes `detail_status`, `daangn_manner_temperature`, and `daangn_review_count`.
- Patched `scripts/backfill-daangn-manner-temperature.ts`:
  - Ready pool pagination.
  - Smaller raw lookup chunks.
  - 404/410 rows are invalidated from the ready pool with `invalidated_reason='daangn_manner_backfill_http_404'`.
- Patched candidate-pool promotion:
  - `tick-pipeline` now carries `daangn_manner_temperature` into `PipelineRow`.
  - `candidate-pool-builder` blocks Daangn rows with missing manner temperature using `invalidated_reason='daangn_manner_temperature_missing'`.
  - This prevents broad historical `done+NULL` raw rows from being promoted back into ready after the ready-pool backfill.
- Re-ran ready-pool backfill:
  - Second pass target count: 125 ready Daangn rows with NULL manner temperature.
  - Filled 106 rows with live parsed manner temperature/review count.
  - Invalidated 19 Daangn 404 rows from ready pool.
  - Final verification: `readyDaangn=395`, `readyNull=0`, `readyWithTemp=395`.
- Re-verified reported row:
  - `pid=9000506293605`
  - `daangn_manner_temperature=43.3`
  - `daangn_review_count=26`

## Follow-up Verification 2

- `npx tsx --test tests/daangn-ingest.test.ts tests/wave249-pool-builder-clamp-fix.test.ts`
  - Result: 36 pass / 0 fail.
- `npx tsc --noEmit --pretty false 2>&1 | rg "src/lib/(daangn-ingest|candidate-pool-builder|tick-pipeline|pipeline)\\.ts|tests/(daangn-ingest|wave249-pool-builder-clamp-fix)\\.test\\.ts|scripts/backfill-daangn-manner-temperature.ts|src/app/api/packs/(me|pool/detail-access)/route.ts" || true`
  - Result: no output for touched paths.
