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
  const depositNotifyRoute = source("src/app/api/membership/deposit-notify/route.ts");
  const decideRoute = source("src/app/api/admin/membership-applications/decide/route.ts");

  assert.match(page, /MembershipApplicationsPanel/);
  assert.match(page, /mvp_membership_applications/);
  assert.doesNotMatch(page, /ManualDepositPanel/);

  assert.match(applications, /APPROVE/);
  assert.match(applications, /REJECT/);
  assert.match(applications, /\/api\/admin\/membership-applications\/decide/);
  assert.match(applications, /선택한 기간만큼 pro 멤버십/);
  assert.match(applications, /입금 확인 후/);
  assert.match(applications, /getMembershipPlan/);
  assert.match(applications, /plan\.label/);
  assert.match(applications, /statusLabel/);
  assert.match(applications, /user_cancelled_reservation/);
  assert.doesNotMatch(applications, /\/ 3개월/);

  assert.match(applyRoute, /mvp_membership_applications/);
  assert.match(applyRoute, /notifyResult/);
  assert.match(applyRoute, /telegramSent/);
  assert.match(applyRoute, /telegram_notify_failed/);
  assert.match(applyRoute, /admin_note/);
  assert.match(applyRoute, /parseMode: null/);
  assert.match(applyRoute, /productKey/);
  assert.match(applyRoute, /selectedPlan/);
  assert.match(applyRoute, /price_krw: selectedPlan\.priceKrw/);
  assert.match(applyRoute, /자리 예약 \/ 입금 대기/);
  assert.match(applyRoute, /자리 예약 취소/);
  assert.match(applyRoute, /user_cancelled_reservation/);
  assert.match(applyRoute, /내 지역 티오: 신청자 기준 mock 확인 완료/);
  assert.match(depositNotifyRoute, /멤버십 입금 확인 요청/);
  assert.match(depositNotifyRoute, /user_deposit_confirmed/);
  assert.match(depositNotifyRoute, /cau 운영자 페이지에서 입금 확인 후 승인/);
  assert.match(decideRoute, /mvp_user_plans/);
  assert.match(decideRoute, /getMembershipPlan/);
  assert.match(decideRoute, /periodEndMonths\(selectedPlan\.months\)/);
  assert.match(decideRoute, /plan_months: selectedPlan\.months/);
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
