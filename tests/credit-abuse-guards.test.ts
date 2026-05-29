import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("detail access spends before marking opened when free quota is disabled", () => {
  const helper = source("src/lib/detail-access.ts");

  assert.match(helper, /FREE_DETAIL_ACCESS_LIMIT = 0/);
  const spendIndex = helper.indexOf("const spend = await spendUserCredits");
  const markAfterSpendIndex = helper.indexOf("const mark = await markOpenedPid(bucketKey).catch", spendIndex);
  assert.ok(spendIndex > 0, "detail access must spend a credit on first paid open");
  assert.ok(markAfterSpendIndex > spendIndex, "pid should be marked opened only after paid spend succeeds");
  assert.match(helper, /detail_access_duplicate_refund/);
  assert.match(helper, /detail_access_mark_failed_refund/);
});

test("legacy share-bonus POST cannot grant credits directly", () => {
  const route = source("src/app/api/packs/pool/share-bonus/route.ts");

  assert.match(route, /export async function POST/);
  assert.match(route, /error: "deprecated"/);
  assert.match(route, /status: 410/);
  assert.doesNotMatch(route, /balance: newBalance/);
  assert.doesNotMatch(route, /last_share_bonus_at: now/);
});

test("kakao share webhook delegates reward grant to atomic cooldown RPC", () => {
  const route = source("src/app/api/kakao/share-webhook/route.ts");
  const migration = source("supabase/migrations/20260529223947_kakao_share_bonus_atomic_claim.sql");

  assert.match(route, /rpcUrl\("claim_mvp_kakao_share_bonus"\)/);
  assert.match(route, /p_auth_user_id: userId/);
  assert.match(route, /p_cooldown_hours: COOLDOWN_HOURS/);
  assert.match(route, /KAKAO_ADMIN_KEY missing in production/);
  assert.doesNotMatch(route, /balance: newBalance/);
  assert.doesNotMatch(route, /tableUrl\("mvp_credit_ledger"\)/);

  assert.match(migration, /create or replace function public\.claim_mvp_kakao_share_bonus/);
  assert.match(migration, /c\.last_share_bonus_at <= now\(\) - v_cooldown/);
  assert.match(migration, /set balance = c\.balance \+ v_amount/);
  assert.match(migration, /'kakao_share_webhook'/);
  assert.match(migration, /grant execute on function public\.claim_mvp_kakao_share_bonus\(uuid, integer, text, text, integer\) to service_role/);
});

test("market-source proof API requires paid detail access before returning URLs", () => {
  const route = source("src/app/api/listings/[pid]/market-source/route.ts");

  assert.match(route, /requireSupabaseUser\(req\)/);
  assert.match(route, /hasDetailAccess\(\{ user: auth\.user, userRef, pid, unlimited \}\)/);
  assert.match(route, /detail_access_required/);
  assert.match(route, /isAdminUser\(auth\.user\) \|\| \(await isBetaTesterAuthId\(auth\.user\.id\)\)/);
  assert.match(route, /listingUrl: ourListingUrl/);
  assert.doesNotMatch(route, /pid 알면 누구나 접근/);
});
