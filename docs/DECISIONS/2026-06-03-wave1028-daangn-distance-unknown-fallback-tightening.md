# Wave 1028 — Daangn distance unknown fallback tightening

Date: 2026-06-03

## Context

Daangn feed quality depends on local execution distance. The known-coordinate path already limits actionable listings to near/reachable regions (up to 10km). The remaining weak spot was the unknown-coordinate fallback: when both paths were in the same first-level region (for example Seoul), the listing could remain actionable even if district-level locality was not verified.

## Decision

- Keep known-coordinate behavior unchanged:
  - near: up to 6km
  - reachable: up to 10km
  - far / too_far: not actionable
- If the user has no home region yet, do not mark listings as far. Onboarding can still complete without premature blocking.
- If the user has a home region but the listing has no region path, fail closed.
- If coordinates cannot be computed, allow fallback only when first-level and second-level administrative areas both match, such as `서울특별시 동작구 ...`.
- Remove broad same-city fallback such as `서울특별시 동작구` user allowing unknown `서울특별시 강남구 ...` listing.

## Deferred

- Additional DB sweep to find Daangn rows with missing/invalid region path and backfill them from raw payload where possible.
- Admin pool region filter can later expose rows by first/second/third-level region for manual QA.

## Verification target

- `npx tsx --test tests/daangn-region-distance.test.ts`
- `npm run build`
