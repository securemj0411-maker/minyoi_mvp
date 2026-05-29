# Wave 975 — Admin Mutation And Legacy Pack Guards

Date: 2026-05-30 KST

## Context

After Wave 962 closed the highest-risk credit and paywall leaks, a second pass reviewed older mutation and reveal paths that could still be callable by direct HTTP requests.

The current product contract is:

- feed browsing is free when the user has at least one credit
- each new detail analysis costs 1 credit
- same listing can be reopened without another credit

Legacy endpoints from the old pack/welcome model must not reveal exact listings outside that contract.

## Decisions / Changes

1. High-risk admin mutation APIs now require the same-origin action header.
   - credit grant/revoke
   - account block
   - account delete
   - beta tester toggle
   - listing type override
   - learning queue approve/reject

   These routes already required an authenticated admin user, but they now also require `x-minyoi-admin-action: 1` so cross-site form-style POSTs cannot trigger operator side effects.

2. Admin client surfaces were updated to send the header.
   - member drawer grant/revoke/block/delete
   - classification browser listing override
   - learning queue approve/reject

3. Direct-trade location lookup is no longer open to any logged-in user by pid.
   - Pre-open direct-only warnings still work through the signed feed `accessToken`.
   - Plain `pid` fallback is limited to users who already have detail access, or admin/beta unlimited access.
   - Invalid access tokens now return a hard error instead of silently falling back.

4. Legacy pack endpoints are explicit tombstones.
   - `/api/packs/open` returns 410.
   - `/api/packs/welcome` returns 410.

   Keeping them active would preserve old multi-reveal/welcome behavior and risk bypassing the current per-detail credit model.

## Verification

- Targeted security tests:
  - `npx tsx --test tests/admin-action-csrf-guards.test.ts tests/admin-credit-grant-contract.test.ts tests/credit-abuse-guards.test.ts tests/manual-deposit-abuse-guards.test.ts tests/manual-deposit-atomic-contract.test.ts`
  - Result: 19 pass, 0 fail.
- Build:
  - `npm run build`
  - Result: passed.

## Known Test Noise

`tests/me-page-contract.test.ts` still has unrelated stale UI-contract failures around old detail/reveal copy and a missing historical loss-report client path. The new legacy-pack tombstone assertion inside that file passes, but the full file is not green yet.

## Deferred / Not Changed

- Did not remove `openPack` internals because tests and historical code paths still reference the library.
- Did not rewrite unused `RecommendationWorkspace`; `me-dashboard-client.tsx` already documents it as an unused legacy component after the current `/me` feed flow.
- Did not change public preview/count endpoints because they return aggregate inventory hints, not exact source URLs or unlocked listing details.
