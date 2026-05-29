# Wave 976 — User Action CSRF Guards

Date: 2026-05-30 KST

## Context

After admin mutation hardening, the next security pass checked first-party user POST routes that can spend credits or change account state.

The main risk was not API authentication itself: these routes already require Supabase auth. The risk was browser-side cross-site requests that could try to trigger state-changing actions through a logged-in session.

## Decision

Introduce a lightweight first-party user action header:

- header: `x-minyoi-user-action: 1`
- helper: `hasUserActionHeader(...)`

Protected routes:

- `/api/packs/pool/detail-access`
  - spends free detail allowance or 1 credit for a new exact detail
- `/api/me/account/delete`
  - destructive account deletion/anonymization
- `/api/packs/reveals/delete`
  - hides user-opened listings
- `/api/me/telegram/start-verify`
  - rotates Telegram verify code
- `/api/me/telegram/disconnect`
  - disconnects Telegram alerts
- `/api/billing/manual-deposit`
  - creates a manual deposit request and notifies operations
- `/api/user/home-region`
  - changes the user's home region used for local Daangn ranking

Updated first-party clients to send the header from the relevant UI flows.

## Verification

- Targeted tests:
  - `npx tsx --test tests/user-action-csrf-guards.test.ts tests/admin-action-csrf-guards.test.ts tests/credit-abuse-guards.test.ts tests/manual-deposit-abuse-guards.test.ts tests/manual-deposit-atomic-contract.test.ts`
  - Result: 20 pass, 0 fail.
- Build:
  - `npm run build`
  - Result: passed.

## Deferred / Not Changed

- Did not protect read-only endpoints with this header.
- Did not change deprecated/tombstoned POST endpoints that already return 410.
- Did not add this to old PortOne subscribe/cancel routes because the current production manual-deposit flow is active and those routes need a separate PG revival review before changing their client contract.
