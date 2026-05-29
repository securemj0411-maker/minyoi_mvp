# Wave 962 — Credit/Admin Security Guard Review

Status: implemented and production DB RPC applied.

## Context

User asked for a bug/security review after recent credit, manual deposit, Kakao share reward, and paywall changes. The review prioritized flows that can move credits or expose paid listing data.

## Decisions / Changes

1. Admin approval links now require signed action tokens.
   - Manual deposit and feedback Telegram links include an HMAC token scoped by action type, id, and decision.
   - GET decision endpoints reject missing/invalid tokens before performing side effects.
   - Admin UI POST decisions now require `x-minyoi-admin-action: 1` to reduce cross-site form/CSRF risk.

2. Feedback reward failures no longer echo raw Supabase response bodies into HTML.
   - Raw response is still logged server-side for debugging.

3. Kakao share reward grants now use an atomic DB RPC.
   - Added `public.claim_mvp_kakao_share_bonus(...)`.
   - The RPC updates `balance + last_share_bonus_at` only when the row is outside cooldown and writes the ledger in the same transaction.
   - Production also refuses reward grants if `KAKAO_ADMIN_KEY` is missing.
   - Because Supabase migration history is drifted, `supabase db push --dry-run` cannot run cleanly. The SQL was applied directly with the production `DATABASE_URL`, then verified through REST RPC.

4. Market proof API is no longer public by pid.
   - `/api/listings/[pid]/market-source` returns original listing/comparable URLs, so it now requires an authenticated user with detail access to that pid, or admin/beta unlimited access.
   - This closes a likely paywall bypass where a pid could be enumerated or reused to fetch source links without spending a credit.

## Verification

- Production DB direct SQL apply: succeeded.
- Production REST RPC probe:
  - `/rest/v1/rpc/claim_mvp_kakao_share_bonus`
  - null-user probe returned `200` with `missing_auth_user_id`, confirming function exposure to service role.
- Targeted tests:
  - `npx tsx --test tests/admin-action-csrf-guards.test.ts tests/credit-abuse-guards.test.ts tests/daangn-market-basis-contract.test.ts tests/kakao-memo-contract.test.ts tests/manual-deposit-abuse-guards.test.ts tests/manual-deposit-atomic-contract.test.ts`
  - Result: 20 pass, 0 fail.
- Targeted ESLint:
  - Result: 0 errors.
  - Existing warnings remain in files that already had unused debug/helper code.

## Deferred / Not Changed

- Supabase migration history drift remains. Avoid full `db push` until remote/local migration history is repaired or consciously pulled/reconciled.
- `tests/detail-beginner-guide-contract.test.ts` currently fails on existing UI copy/dark-mode expectations unrelated to this security patch. It was not changed in this wave.
- Admin-only credit revoke still uses a read-modify-write pattern. Lower risk than public/admin-link flows, but it can be revisited with an atomic revoke RPC if admin double-click/race becomes a real operational issue.
