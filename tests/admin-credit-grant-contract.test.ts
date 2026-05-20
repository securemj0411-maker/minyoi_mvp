import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("operator members table can grant arbitrary positive credits", () => {
  const table = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/members-table.tsx");

  assert.match(table, /grantCredits/);
  assert.match(table, /\/api\/admin\/credits\/grant/);
  assert.match(table, /window\.confirm/);
  assert.match(table, /placeholder="개수"/);
  assert.match(table, /운영자 수동 크레딧 지급/);
  assert.match(table, /creditRowExists: true/);
});

test("manual credit grant API is admin-only and records an auditable ledger source", () => {
  const route = source("src/app/api/admin/credits/grant/route.ts");

  assert.match(route, /isAdminUser\(auth\.user\)/);
  assert.match(route, /claim_mvp_user_credits/);
  assert.match(route, /refund_mvp_user_credits/);
  assert.match(route, /source: "admin_manual_grant"/);
  assert.match(route, /admin_auth_user_id/);
  assert.match(route, /MAX_MANUAL_GRANT/);
  assert.match(route, /userRefForAuthUser\(targetAuthUserId\)/);
});
