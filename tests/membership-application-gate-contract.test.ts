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
  assert.doesNotMatch(plans, /크레딧 충전|1크레딧|billing\/manual\?credits/);
  assert.doesNotMatch(plansLayout, /크레딧 충전|1크레딧|billing\/manual/);
  assert.doesNotMatch(applyClient, /결제하기|크레딧 충전|billing\/manual/);
});

test("/me gates non-members to the application page", () => {
  const mePage = source("src/app/me/page.tsx");
  assert.match(mePage, /getProStatus/);
  assert.match(mePage, /redirect\("\/plans\?from=me"\)/);
  assert.match(mePage, /isPro/);
  assert.match(mePage, /isBetaTester/);
});

test("navigation and account panel expose membership language instead of credit balance", () => {
  const nav = source("src/components/app-nav.tsx");
  const accountPanel = source("src/components/account-panel.tsx");

  assert.match(nav, /멤버십 신청/);
  assert.match(nav, /선공개/);
  assert.doesNotMatch(nav, /CreditIcon|loadClientCredits|크레딧 충전|보유 크레딧|Beta/);

  assert.match(accountPanel, /승인 대기|선공개 멤버십/);
  assert.doesNotMatch(accountPanel, /크레딧 충전|보유 크레딧|UsageBar/);
});

test("detail access uses membership status as the unlimited source of truth", () => {
  const poolRoute = source("src/app/api/packs/pool/route.ts");
  const detailRoute = source("src/app/api/packs/pool/detail-access/route.ts");

  assert.match(poolRoute, /getProStatus/);
  assert.match(poolRoute, /membership\.isPro \|\| membership\.isAdmin \|\| membership\.isBetaTester/);
  assert.doesNotMatch(poolRoute, /isBetaTesterAuthId/);

  assert.match(detailRoute, /getProStatus/);
  assert.match(detailRoute, /membership_required/);
  assert.match(detailRoute, /consumeDetailAccess\(\{ user: auth\.user, userRef, pid, unlimited: unlimitedAccess \}\)/);
  assert.doesNotMatch(detailRoute, /isBetaTesterAuthId/);
  assert.doesNotMatch(detailRoute, /크레딧은 사용하지 않았어요/);
});
