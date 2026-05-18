# 2026-05-18 Wave 215 — `/me` cost field source hotfix

## Problem
- Wave 213 fixed `/me` current profit to use fee-aware net profit.
- The implementation selected `shipping_fee`, `shipping_fee_general`, and `estimated_buy_cost` from `mvp_raw_listings`.
- Those columns live on `mvp_listings`, not `mvp_raw_listings`, so `/api/packs/me` failed its PostgREST select and the dashboard showed 0 rows plus the generic load error.

## Decision
- `/api/packs/me` now fetches display/lifecycle fields from `mvp_raw_listings`.
- It fetches cost fields from `mvp_listings` in a separate batch:
  - `price`
  - `shipping_fee`
  - `shipping_fee_general`
  - `estimated_buy_cost`
- Net current profit uses `mvp_listings` cost fields, with raw listing price as a fallback if the listing cost row is missing.

## Deferred
- A shared read model/view for `/me` could prevent table-source drift. This hotfix keeps the change narrow to restore the dashboard quickly.
