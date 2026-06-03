import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("/plans is a membership application page, not a credit package page", () => {
  const plans = source("src/app/plans/page.tsx");
  const plansLayout = source("src/app/plans/layout.tsx");
  const applyClient = source("src/components/membership-application-client.tsx");
  const planConfig = source("src/lib/membership-plans.ts");
  assert.match(plans, /선공개 300명 멤버십/);
  assert.match(plans, /선공개 300명/);
  assert.match(plans, /지역 티오 확인/);
  assert.match(plans, /운영자 입금 확인/);
  assert.match(plans, /SLOT_CAPACITY = 300/);
  assert.match(plans, /신청 가능/);
  assert.match(planConfig, /월 33,000원꼴/);
  assert.match(planConfig, /priceKrw: 99_000/);
  assert.match(planConfig, /limited_300_1mo/);
  assert.match(planConfig, /limited_300_upsell_3mo_59/);
  assert.match(plans, /loadPendingApplication/);
  assert.match(plans, /status=eq\.pending/);
  assert.match(plans, /pendingApplication/);
  assert.match(plans, /MEMBERSHIP_PLANS/);
  assert.doesNotMatch(plans, /결제 페이지가 아니라/);
  assert.match(plansLayout, /선공개 멤버십 신청/);
  assert.match(plans, /MembershipApplicationClient/);
  assert.match(applyClient, /신청하기|로그인하고 신청하기/);
  assert.match(applyClient, /telegramSent/);
  assert.match(applyClient, /운영자 알림은 확인 중/);
  assert.match(applyClient, /자리 예약 완료 · 입금 대기/);
  assert.match(applyClient, /ACCOUNT_NUMBER/);
  assert.match(applyClient, /입금 금액/);
  assert.match(applyClient, /PlanGrid/);
  assert.match(applyClient, /selectorOpen/);
  assert.match(applyClient, /신청 기간을 고르세요/);
  assert.match(applyClient, /UPSELL_PLANS_FROM_1MO/);
  assert.match(applyClient, /UPSELL_PLANS_FROM_3MO/);
  assert.match(applyClient, /selectedUpsellKey/);
  assert.match(applyClient, /setSelectedUpsellKey\(plan\.key\)/);
  assert.match(applyClient, /마지막 예약 버튼을 눌러야 입금 안내가 열립니다/);
  assert.doesNotMatch(applyClient, /onClick=\{\(\) => void submitApplication\(plan\)\}/);
  assert.doesNotMatch(applyClient, /운영자 검토 중입니다/);
  assert.doesNotMatch(applyClient, /localStorage/);
  assert.doesNotMatch(plans, /크레딧 충전|1크레딧|billing\/manual\?credits/);
  assert.doesNotMatch(plansLayout, /크레딧 충전|1크레딧|billing\/manual/);
  assert.doesNotMatch(applyClient, /결제하기|크레딧 충전|billing\/manual/);
});

test("/me gates non-members to the application page", () => {
  const mePage = source("src/app/me/page.tsx");
  const homePage = source("src/app/page.tsx");
  assert.match(mePage, /getProStatus/);
  assert.match(mePage, /hasMembershipAccess/);
  assert.match(mePage, /redirect\("\/plans\?from=me"\)/);
  assert.ok(mePage.indexOf("const membership = await getProStatus") < mePage.indexOf("const homeRegion = await loadUserHomeRegion"));

  assert.match(homePage, /getProStatus/);
  assert.match(homePage, /hasMembershipAccess/);
  assert.match(homePage, /redirect\("\/plans\?from=feed"\)/);
  assert.ok(homePage.indexOf("const membership = await getProStatus") < homePage.indexOf("const homeRegion = await loadUserHomeRegion"));
});

test("navigation and account panel expose membership language instead of credit balance", () => {
  const nav = source("src/components/app-nav.tsx");
  const accountPanel = source("src/components/account-panel.tsx");

  assert.match(nav, /멤버십 신청/);
  assert.match(nav, /선공개/);
  assert.doesNotMatch(nav, /내 대시보드/);
  assert.doesNotMatch(nav, /CreditIcon|loadClientCredits|크레딧 충전|보유 크레딧|Beta/);

  assert.match(accountPanel, /승인 대기|선공개 멤버십/);
  assert.doesNotMatch(accountPanel, /크레딧 충전|보유 크레딧|UsageBar/);
});

test("detail access uses membership status as the unlimited source of truth", () => {
  const poolRoute = source("src/app/api/packs/pool/route.ts");
  const meRoute = source("src/app/api/packs/me/route.ts");
  const detailRoute = source("src/app/api/packs/pool/detail-access/route.ts");
  const lookupPage = source("src/app/lookup/page.tsx");
  const lookupRoute = source("src/app/api/lookup/by-url/route.ts");

  assert.match(poolRoute, /getProStatus/);
  assert.match(poolRoute, /hasMembershipAccess/);
  assert.match(poolRoute, /membership_required/);
  assert.doesNotMatch(poolRoute, /isBetaTesterAuthId/);

  assert.match(meRoute, /hasMembershipAccess/);
  assert.match(meRoute, /membership_required/);

  assert.match(lookupPage, /redirect\("\/plans\?from=lookup"\)/);
  assert.match(lookupRoute, /hasMembershipAccess/);
  assert.match(lookupRoute, /membership_required/);
  assert.doesNotMatch(lookupRoute, /spendUserCredits|getUserCreditsReadOnly|chargeLookupCredit/);

  assert.match(detailRoute, /getProStatus/);
  assert.match(detailRoute, /membership_required/);
  assert.match(detailRoute, /consumeDetailAccess\(\{ user: auth\.user, userRef, pid, unlimited: unlimitedAccess \}\)/);
  assert.doesNotMatch(detailRoute, /isBetaTesterAuthId/);
  assert.doesNotMatch(detailRoute, /크레딧은 사용하지 않았어요/);
});
