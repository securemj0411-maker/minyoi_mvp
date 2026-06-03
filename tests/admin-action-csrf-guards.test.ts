import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { ADMIN_ACTION_HEADER, signAdminAction, verifyAdminActionToken } from "../src/lib/admin-action-token";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("admin action tokens are scoped to action, id, and decision", () => {
  process.env.ADMIN_ACTION_TOKEN_SECRET = "unit-test-admin-action-secret";

  const token = signAdminAction("manual_deposit", 123, "approve");

  assert.ok(token.length > 20);
  assert.equal(verifyAdminActionToken("manual_deposit", 123, "approve", token), true);
  assert.equal(verifyAdminActionToken("manual_deposit", 123, "reject", token), false);
  assert.equal(verifyAdminActionToken("membership_application", 123, "approve", token), false);
  assert.equal(verifyAdminActionToken("feedback", 123, "approve", token), false);
  assert.equal(verifyAdminActionToken("manual_deposit", 124, "approve", token), false);
  assert.equal(verifyAdminActionToken("manual_deposit", 123, "approve", null), false);
});

test("telegram GET admin decisions require signed action tokens", () => {
  const manualDecide = source("src/app/api/admin/manual-deposit/decide/route.ts");
  const membershipDecide = source("src/app/api/admin/membership-applications/decide/route.ts");
  const feedbackDecide = source("src/app/api/admin/feedback/decide/route.ts");
  const manualSubmit = source("src/app/api/billing/manual-deposit/route.ts");
  const membershipDepositNotify = source("src/app/api/membership/deposit-notify/route.ts");
  const feedbackSubmit = source("src/app/api/feedback/submit/route.ts");

  assert.match(manualDecide, /verifyAdminActionToken\("manual_deposit", id, decisionRaw, token\)/);
  assert.match(membershipDecide, /verifyAdminActionToken\("membership_application", id, decision, token\)/);
  assert.match(feedbackDecide, /verifyAdminActionToken\("feedback", id, decision, token\)/);
  assert.match(manualSubmit, /signAdminAction\("manual_deposit", requestId, "approve"\)/);
  assert.match(manualSubmit, /signAdminAction\("manual_deposit", requestId, "reject"\)/);
  assert.match(membershipDepositNotify, /signAdminAction\("membership_application", application\.id, "approve"\)/);
  assert.match(membershipDepositNotify, /signAdminAction\("membership_application", application\.id, "reject"\)/);
  assert.match(feedbackSubmit, /signAdminAction\("feedback", feedbackId, "approve"\)/);
  assert.match(feedbackSubmit, /signAdminAction\("feedback", feedbackId, "reject"\)/);
  assert.match(manualSubmit, /&token=\$\{encodeURIComponent\(approveToken\)\}/);
  assert.match(feedbackSubmit, /&token=\$\{encodeURIComponent\(approveToken\)\}/);
});

test("admin UI POST decisions require a custom same-origin header", () => {
  const manualDecide = source("src/app/api/admin/manual-deposit/decide/route.ts");
  const membershipDecide = source("src/app/api/admin/membership-applications/decide/route.ts");
  const feedbackDecide = source("src/app/api/admin/feedback/decide/route.ts");
  const manualPanel = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/manual-deposit-panel.tsx");
  const feedbackPanel = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/feedback-panel.tsx");
  const feedbackReview = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/loss-reports/feedback-review-full.tsx");

  assert.equal(ADMIN_ACTION_HEADER, "x-minyoi-admin-action");
  assert.match(manualDecide, /missing_admin_action_header/);
  assert.match(membershipDecide, /missing_admin_action_header/);
  assert.match(feedbackDecide, /missing_admin_action_header/);
  for (const panel of [manualPanel, feedbackPanel, feedbackReview]) {
    assert.match(panel, /headers: \{ "x-minyoi-admin-action": "1" \}/);
  }
});

test("feedback approval errors do not echo raw Supabase responses into HTML", () => {
  const feedbackDecide = source("src/app/api/admin/feedback/decide/route.ts");

  assert.match(feedbackDecide, /console\.error\("\[feedback\/decide\] grant failed"/);
  assert.match(feedbackDecide, /보상 지급 중 오류가 발생했어요\. 서버 로그를 확인해주세요\./);
  assert.doesNotMatch(feedbackDecide, /resultHtml\("크레딧 지급 실패", text\.slice\(0, 200\)\)/);
});

test("high-risk admin mutation APIs require the same-origin action header", () => {
  const routePaths = [
    "src/app/api/admin/credits/grant/route.ts",
    "src/app/api/admin/credits/revoke/route.ts",
    "src/app/api/admin/user/block/route.ts",
    "src/app/api/admin/users/delete/route.ts",
    "src/app/api/admin/beta-tester/route.ts",
    "src/app/api/admin/listing-type-override/route.ts",
    "src/app/api/admin/loss-reports/route.ts",
    "src/app/api/admin/learning-queue/[id]/approve/route.ts",
    "src/app/api/admin/learning-queue/[id]/reject/route.ts",
  ];
  for (const routePath of routePaths) {
    const route = source(routePath);
    assert.match(route, /hasAdminActionHeader\(req\.headers\)/, routePath);
    assert.match(route, /missing_admin_action_header/, routePath);
  }

  const membersTable = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/members-table.tsx");
  const classificationBrowser = source("src/components/admin-classification-browser.tsx");
  const learningQueue = source("src/components/learning-queue-admin.tsx");
  for (const client of [membersTable, classificationBrowser, learningQueue]) {
    assert.match(client, /"x-minyoi-admin-action": "1"/);
  }
});
