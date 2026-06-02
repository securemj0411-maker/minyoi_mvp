# 2026-06-02 Wave 1021 — Preview Pool Query Order

## Context

Production logs showed `/api/preview-pool` returning 500 or timing out for the guest main preview feed.

Direct timing found the first query was the bottleneck:

- `mvp_raw_listings` scan by `listing_state in (sold_confirmed, disappeared)` + `sold_detected_at >= 14d` + `order sold_detected_at desc`
- Result: PostgREST statement timeout before any preview rows could be assembled.

This is a public, first-screen endpoint, so waiting on a broad raw listing sold scan is too expensive.

## Decision

Change `/api/preview-pool` to start from recent `mvp_candidate_pool` rows:

- `status = invalidated`
- `expected_profit_max > 0`
- `updated_at >= 14d`
- ordered by `updated_at desc, expected_profit_max desc`

Then confirm `mvp_raw_listings.listing_state in (sold_confirmed, disappeared)` by pid.

This keeps public preview samples non-live while avoiding a broad `mvp_raw_listings` sold-date scan.

## Safety

- No deletes.
- No status changes.
- No schema changes.
- No public original links or source identifiers exposed.
- If the recent invalidated pool is empty, the endpoint returns the existing empty response shape.

## Verification

- Local direct timing for the new query order:
  - pool candidate query: ~302ms for 500 rows.
  - raw sold confirmation by pid: ~1107ms.
  - low-price listing join by pid: ~2119ms.
- `npm run build`: passed.
- `npx tsx --test tests/me-page-contract.test.ts`: overall suite still has unrelated pre-existing failures, but the preview API contract test passed.

## Follow-Up

If public preview freshness becomes a product priority, build a dedicated low-price preview snapshot table instead of relying on live assembly at request time.
