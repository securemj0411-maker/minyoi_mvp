import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("manual deposit approval is delegated to the atomic database RPC", () => {
  const helper = source("src/lib/manual-deposit-grant.ts");

  assert.match(helper, /rpcUrl\("approve_mvp_manual_deposit_request"\)/);
  assert.match(helper, /p_request_id: request\.id/);
  assert.match(helper, /p_decided_by: decidedBy/);
  assert.match(helper, /if \(approval\.granted\)/);
  assert.match(helper, /grantReferralPaymentBonus/);
  assert.doesNotMatch(helper, /select=balance/);
  assert.doesNotMatch(helper, /on_conflict=user_ref/);
  assert.doesNotMatch(helper, /manual_deposit_admin_approved/);
  assert.doesNotMatch(helper, /manual_deposit_auto_approved/);
});

test("manual deposit reject only updates pending rows", () => {
  const helper = source("src/lib/manual-deposit-grant.ts");
  const route = source("src/app/api/admin/manual-deposit/decide/route.ts");

  assert.match(helper, /mvp_manual_deposit_requests"\)\}\?id=eq\.\$\{request\.id\}&status=eq\.pending/);
  assert.match(helper, /Prefer: "return=representation"/);
  assert.match(helper, /return \{ ok: rows\.length > 0 \}/);
  assert.match(route, /const result = await rejectManualDeposit\(request\)/);
  assert.match(route, /신청 #\$\{id\} 는 방금 다른 경로에서 처리됐어요/);
});

test("manual deposit approval RPC claims one pending row and increments balance", () => {
  const migration = source("supabase/migrations/20260529200018_manual_deposit_atomic_approval.sql");

  assert.match(migration, /create or replace function public\.approve_mvp_manual_deposit_request/);
  assert.match(migration, /and r\.status = 'pending'/);
  assert.match(migration, /returning r\.\* into v_request/);
  assert.match(migration, /balance = public\.mvp_user_credits\.balance \+ excluded\.balance/);
  assert.match(migration, /manual_deposit_admin_approved/);
  assert.match(migration, /manual_deposit_auto_approved/);
  assert.match(migration, /grant execute on function public\.approve_mvp_manual_deposit_request\(bigint, text\) to service_role/);
  assert.match(migration, /revoke execute on function public\.approve_mvp_manual_deposit_request\(bigint, text\) from anon/);
  assert.match(migration, /revoke execute on function public\.approve_mvp_manual_deposit_request\(bigint, text\) from authenticated/);
});
