# 2026-05-29 Wave 940 - score_dirty cleanup indexed filters

## Context

- Daangn A/B/C ingestion can now push far more raw rows than the old BunJang-only pipeline.
- Production `mvp_raw_listings.score_dirty=true` backlog remains large because score-worker must skip rows that are not scoreable yet:
  - `detail_status != done`
  - `sku_id is null`
  - inactive/sold/missing rows
  - non-normal listing types
- The hot score load was already split into narrow `listing_type=normal` / `listing_type_override=normal` queries, but cleanup still used a broad:
  - `score_dirty=true`
  - `order=last_seen_at.desc`
  - JS-side `isScorableRawCandidate()` filtering
- That broad cleanup path scales badly once Daangn creates many dirty rows.

## Decision

- Replace broad unscorable dirty cleanup with reason-specific REST filters:
  - `detail_null`
  - `detail_not_done`
  - `sku_null`
  - `state_null`
  - `state_not_active`
  - `type_null`
  - `type_not_normal`
  - `override_not_normal`
- Keep the cleanup non-fatal: a failed reason logs a warning and does not fail the score-worker.
- Keep total per-run cleanup capped at the existing `rowLimit` to avoid turning score-worker into a background vacuum.
- Add structured console info when rows are cleared so production logs show which residue is actually draining.
- Increase only the `score_dirty=false` pid patch chunk from 50 to 200.
  - The general REST write chunk remains 50.
  - Cleanup patches are tiny `pid=in.(...)` updates, so 200 keeps URL size reasonable while cutting 1000-row cleanup from 20 PATCH requests to 5.

## Rationale

- This is a structural worker fix, not a one-off DB cleanup.
- It avoids fetching broad dirty rows only to discard most of them in JS.
- It keeps detail-pending rows safe: detail-worker owns `detail_status=pending`, and detail completion re-marks `score_dirty=true`.
- It keeps unmatched rows safe: parser/rematch paths re-mark `score_dirty=true` when `sku_id` becomes available.
- It keeps inactive rows safe: raw ingest/lifecycle changes re-mark dirty if a row becomes scoreable again.

## Verification

- `npx eslint src/lib/tick-pipeline.ts`
  - pass with existing warnings only:
    - `trimmedSellerMarket` unused
    - `MARKET_INVALIDATION_FAST_LANE_PREFIXES` unused
- `npx tsx --test tests/wave249-pool-builder-clamp-fix.test.ts`
  - 13 pass, 0 fail
- `npm run build`
  - passed
- Production Supabase REST smoke test for each new cleanup predicate:
  - all predicates returned `ok=true`
  - observed latencies were small except `type_not_normal` at ~1.4s for `limit=1`, still within worker budget.
- Tried direct `PATCH + filter + limit` as a more aggressive optimization.
  - Rejected: `order=last_seen_at` on PATCH returned a PostgREST/SQL column error, and no-order PATCH hit statement timeout.
  - Keep the pid-select + pid-patch path for correctness.
- Production post-deploy score-worker logs:
  - A/B/C score runs succeeded.
  - A cleanup-enabled run cleared 1000 unscorable dirty rows and still completed, but cleanup took ~22s before the chunk-size optimization.

## Deferred

- If `type_not_normal` becomes a recurring long tail, add a partial DB index dedicated to `score_dirty=true AND detail_status='done' AND sku_id IS NOT NULL AND listing_state='active' AND listing_type <> 'normal' AND listing_type_override IS NULL`.
- Do not add a DB-side cleanup RPC yet because the current code fix can deploy without a Supabase migration and avoids exposing new database functions.
- Continue watching A/B/C score-worker logs for:
  - `score_cleanup_clear_unscorable`
  - `score_unscorable_dirty_cleared_rows`
  - `score_load_rows`
  - score run duration
