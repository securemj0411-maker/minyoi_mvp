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
  assert.match(plans, /선공개 300명 멤버십/);
  assert.match(plansLayout, /선공개 멤버십 신청/);
  assert.match(plans, /MembershipApplicationClient/);
  assert.match(applyClient, /신청하기|로그인하고 신청하기/);
  assert.match(applyClient, /telegramSent/);
  assert.match(applyClient, /운영자 알림은 확인 중/);
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
