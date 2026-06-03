import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("operator members page is membership-application led, not manual-credit led", () => {
  const page = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/page.tsx");
  const table = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/members-table.tsx");
  const applications = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/membership-applications-panel.tsx");
  const applyRoute = source("src/app/api/membership/apply/route.ts");
  const decideRoute = source("src/app/api/admin/membership-applications/decide/route.ts");

  assert.match(page, /MembershipApplicationsPanel/);
  assert.match(page, /mvp_membership_applications/);
  assert.doesNotMatch(page, /ManualDepositPanel/);

  assert.match(applications, /APPROVE/);
  assert.match(applications, /REJECT/);
  assert.match(applications, /\/api\/admin\/membership-applications\/decide/);
  assert.match(applications, /90일 pro 멤버십/);

  assert.match(applyRoute, /mvp_membership_applications/);
  assert.match(decideRoute, /mvp_user_plans/);
  assert.match(decideRoute, /plan_key: "pro"/);
  assert.match(decideRoute, /"approved"/);
  assert.match(decideRoute, /"rejected"/);

  assert.doesNotMatch(table, /grantCredits|revokeCredits|\/api\/admin\/credits\/grant|\/api\/admin\/credits\/revoke|▌GRANT CREDIT|▌REVOKE CREDIT/);
});

test("manual credit grant API is admin-only and records an auditable ledger source", () => {
  const route = source("src/app/api/admin/credits/grant/route.ts");

  assert.match(route, /isAdminUser\(auth\.user\)/);
  assert.match(route, /hasAdminActionHeader\(req\.headers\)/);
  assert.match(route, /claim_mvp_user_credits/);
  assert.match(route, /refund_mvp_user_credits/);
  assert.match(route, /source: "admin_manual_grant"/);
  assert.match(route, /admin_auth_user_id/);
  assert.match(route, /MAX_MANUAL_GRANT/);
  assert.match(route, /userRefForAuthUser\(targetAuthUserId\)/);
});
