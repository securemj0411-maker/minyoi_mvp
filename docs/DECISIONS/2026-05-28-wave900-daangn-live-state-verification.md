# Wave 900 - Daangn Live State Verification

Date: 2026-05-28

## Decision

Daangn listings must be rechecked against the original listing status before user-facing exposure and before charging detail access.

The user reported a Daangn AirPods listing that was already `예약중` on the original page but still looked reachable in the product lifecycle. Root cause: Daangn rows entered storage with `Ongoing`/`Reserved`/`Closed` status, but later live verification branches treated Daangn as active without fetching the original listing again.

## Changes

- Added a shared Daangn live-state helper:
  - `Ongoing` -> `active` / `selling`
  - `Reserved` -> non-active `disappeared` / `reserved`
  - `Closed` -> `sold_confirmed` / `closed`
- Reused that mapping in Daangn preflight/raw ingestion so non-`Ongoing` rows cannot be pool-eligible.
- Detail access now fetches the Daangn original page before charging:
  - reserved listings are removed from ready pool with a reserved-specific message
  - closed/deleted listings are removed without spending credit
  - temporary fetch failures block charging but do not hard-invalidate
- `/me` live verification now rechecks Daangn rows and tombstones reserved/closed/deleted rows like other sources.
- Lifecycle worker and pool warmer now use Daangn original status instead of accidentally calling the Bunjang detail API with Daangn pid values.
- `/api/packs/pool` now performs a small final live status check for visible Daangn ready cards so stale reserved/closed rows are filtered from the current feed response.

## Deferred

- Daangn has no dedicated `reserved` lifecycle state in the current schema, so reserved rows are stored as non-active `disappeared` with `sale_status='reserved'`. A first-class reserved state can be added later if the UI needs a separate "예약중" tombstone.
- Final feed live checks are intentionally limited to visible Daangn ready cards. Full-pool verification remains the responsibility of lifecycle and pool warmer workers.
