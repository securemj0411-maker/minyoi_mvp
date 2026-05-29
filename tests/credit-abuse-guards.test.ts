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
