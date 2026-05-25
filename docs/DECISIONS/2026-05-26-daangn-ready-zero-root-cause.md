# 2026-05-26 — Daangn ready=0 root cause

## Context

Operator asked why Daangn has zero `ready` rows while Bunjang/Joongna rows are visible.

## Findings

- Daangn ingestion is not blocked. Live DB showed ~20k Daangn raws in the last 24h, with ~1k `pool_eligible=true` and SKU matched rows.
- `mvp_candidate_pool` ready rows by source were Bunjang + Joongna only; Daangn SKU rows sampled from live DB had no pool row.
- Recent `daangn-worker` collect logs showed repeated degraded runs at parsed upsert:
  - `null value in column "updated_at" of relation "mvp_listing_parsed" violates not-null constraint`
- Daangn raw rows used `sale_status='saling'`. The pool policy recognizes `selling` / `available` / `active`; `saling` can be treated as inactive once a pool row is built.

## Decision

- Make `toParsedListingRow()` include `updated_at` so both REST table upsert and the Daangn RPC bulk upsert satisfy the DB not-null contract.
- Store Daangn active rows as `sale_status='selling'`.
- Keep `SALING` accepted in pool/sold-out helpers as a legacy compatibility guard until existing rows are backfilled.

## Backfill Required

- Patch existing Daangn rows from `sale_status='saling'` to `selling`.
- Reparse/upsert missing `mvp_listing_parsed` rows for Daangn SKU matches.
- Mark affected Daangn rows `score_dirty=true`.
- Run score stage after backfill to create candidate pool rows.

## Applied / Verification

- Backfilled 1,118 Daangn SKU rows into `mvp_listing_parsed` with `updated_at`.
- Patched 19,124 existing Daangn rows from `saling` to `selling`.
- Marked 1,057 Daangn pool-eligible SKU rows `score_dirty=true`.
- Ran score stage once (`limit=800`, `budget-ms=240000`):
  - scored 796 rows
  - candidate pool upserted 29 rows
  - timedOut=false
- Full paginated pool verification after score stage:
  - fetched 6,816 pool rows
  - source status:
    - Bunjang: ready 539 / invalidated 5,608 / spent 21
    - Joongna: ready 89 / invalidated 547
    - Daangn: ready 12
- Important debugging note: a non-paginated Supabase REST query only returned the first page and falsely made Daangn still look like ready=0. Pool source audits must paginate `mvp_candidate_pool`.
- New Daangn rows kept appearing as `saling` while the old deployment was still running. Code deployment is required so future Daangn rows store `sale_status='selling'`.

### Second Pass Before Deploy

- Re-ran Daangn backfill after more old-deployment rows arrived:
  - parsed/upserted 1,140 Daangn SKU rows
  - patched 1,215 additional `saling` rows to `selling`
  - marked 1,079 pool-eligible Daangn SKU rows dirty
- Re-ran score stage (`limit=800`, `budget-ms=240000`):
  - scored 775 rows
  - candidate pool upserted 24 rows
  - timedOut=false
- Final full paginated verification:
  - fetched 6,826 pool rows
  - Daangn `saling` count: 0 at verification time
  - source status:
    - Bunjang: ready 543 / invalidated 5,604 / spent 21
    - Joongna: ready 98 / invalidated 547
    - Daangn: ready 13

## Deferred

- Daangn RPC bulk-upsert function should ideally set `updated_at=coalesce(row.updated_at, now())` inside SQL too. The application-level fix is sufficient for current writers, but the DB function can be hardened later.
