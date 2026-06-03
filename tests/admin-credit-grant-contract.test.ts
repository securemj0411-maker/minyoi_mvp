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
  const approvalHelper = source("src/lib/membership-application-approval.ts");
  const migration = source("supabase/migrations/20260603222750_wave1052_membership_deposit_approval_flow.sql");
  const renewalMigration = source("supabase/migrations/20260603224240_wave1053_membership_renewal_flow.sql");
  const approvalFixMigration = source("supabase/migrations/20260603225314_wave1054_membership_approval_rpc_ambiguity_fix.sql");
  const membershipAutoCron = source("src/app/api/cron/membership-auto-approve/route.ts");

  assert.match(page, /MembershipApplicationsPanel/);
  assert.match(page, /mvp_membership_applications/);
  assert.doesNotMatch(page, /ManualDepositPanel/);

  assert.match(applications, /APPROVE/);
  assert.match(applications, /REJECT/);
  assert.match(applications, /\/api\/admin\/membership-applications\/decide/);
  assert.match(applications, /신규는 pro 멤버십이 열리고, 연장은 기존 만료일 뒤에 기간이 붙습니다/);
  assert.match(applications, /applicationKind/);
  assert.match(applications, /RENEWAL/);
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
  assert.match(applyRoute, /intent/);
  assert.match(applyRoute, /isRenewal/);
  assert.match(applyRoute, /application_kind: isRenewal \? "renewal" : "new"/);
  assert.match(applyRoute, /selectedPlan/);
  assert.match(applyRoute, /price_krw: selectedPlan\.priceKrw/);
  assert.match(applyRoute, /자리 예약 \/ 입금 대기/);
  assert.match(applyRoute, /멤버십 연장 예약 \/ 입금 대기/);
  assert.match(applyRoute, /자리 예약 취소/);
  assert.match(applyRoute, /user_cancelled_reservation/);
  assert.match(applyRoute, /내 지역 티오: 신청자 기준 mock 확인 완료/);
  assert.match(depositNotifyRoute, /멤버십 입금 확인 요청/);
  assert.match(depositNotifyRoute, /멤버십 연장 입금 확인 요청/);
  assert.match(depositNotifyRoute, /user_deposit_confirmed/);
  assert.match(depositNotifyRoute, /signAdminAction\("membership_application", application\.id, "approve"\)/);
  assert.match(depositNotifyRoute, /운영자 세션 없이 즉시 승인/);
  assert.match(depositNotifyRoute, /scheduled_auto_approve_at/);
  assert.match(decideRoute, /verifyAdminActionToken\("membership_application", id, decision, token\)/);
  assert.match(decideRoute, /approveMembershipApplication/);
  assert.match(decideRoute, /rejectMembershipApplication/);
  assert.match(approvalHelper, /rpcUrl\("approve_mvp_membership_application"\)/);
  assert.match(approvalHelper, /lookup failed/);
  assert.match(approvalHelper, /rpc failed/);
  assert.match(approvalHelper, /error: "rpc_failed"/);
  assert.match(migration, /create or replace function public\.approve_mvp_membership_application/);
  assert.match(migration, /insert into public\.mvp_user_plans/);
  assert.match(migration, /payment_key[\s\S]*membership_application_/);
  assert.match(migration, /grant execute on function public\.approve_mvp_membership_application/);
  assert.match(renewalMigration, /add column if not exists application_kind/);
  assert.match(renewalMigration, /application_kind in \('new', 'renewal'\)/);
  assert.match(renewalMigration, /v_period_base := v_existing_plan\.current_period_end/);
  assert.match(renewalMigration, /v_period_end := v_period_base \+ make_interval/);
  assert.match(renewalMigration, /'application_kind', v_application\.application_kind/);
  assert.match(approvalFixMigration, /on conflict on constraint mvp_user_plans_pkey/);
  assert.match(approvalFixMigration, /ambiguous user_ref/);
  assert.match(membershipAutoCron, /membership_auto_approve/);
  assert.match(membershipAutoCron, /approveMembershipApplication\(row\.id, "auto"/);
  assert.match(approvalHelper, /status: "rejected"/);
  assert.match(migration, /set status = 'approved'/);

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
