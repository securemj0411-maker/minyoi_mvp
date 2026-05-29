# Wave 977 — Admin Loss Report Action Guard

Date: 2026-05-30 KST

## Context

After broad admin mutation hardening, a follow-up scan found one older admin mutation route that was not included in the first list:

- `/api/admin/loss-reports` `PATCH`

The current main operator feedback screen uses `/api/admin/feedback/decide`, but the legacy loss-report review endpoint can still update report status and call the compensation RPC.

## Decision

Require the same-origin admin action header on the legacy loss-report `PATCH` route:

- `x-minyoi-admin-action: 1`

This keeps unused or rarely used admin mutation endpoints from remaining easier to trigger than the active operator surfaces.

## Verification

- Updated `tests/admin-action-csrf-guards.test.ts` so the legacy loss-report mutation is included in the admin action header contract.

## Deferred / Not Changed

- Did not remove the route because historical admin/review tooling may still reference it during operations.
- Did not add client wiring because no current client call to this legacy `PATCH` route was found; active feedback review already uses the protected feedback decision endpoint.
