import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PLANS } from "../src/lib/plan-config";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("free and 200-credit package define the first paid entitlement boundary", () => {
  assert.equal(PLANS.free.dailyOpenLimit, 3);
  assert.match(PLANS.free.features.join(" "), /상세보기 하루 3회/);

  assert.equal(PLANS.plus.dailyOpenLimit, 200);
  assert.equal(PLANS.plus.name, "200 크레딧");
  assert.match(PLANS.plus.features.join(" "), /상세보기\/원본 확인 200회분/);
});

test("pool detail access consumes quota once per pid per day", () => {
  const helper = source("src/lib/detail-access.ts");
  const route = source("src/app/api/packs/pool/detail-access/route.ts");

  assert.match(helper, /consumeDailyQuota/);
  assert.match(helper, /refundDailyQuota/);
  assert.match(helper, /mvp_rate_limits/);
  assert.match(helper, /detail-access:\$\{userRef\}:\$\{pid\}/);

  assert.match(route, /consumeDetailAccess/);
  assert.match(route, /mvp_candidate_pool/);
  assert.match(route, /status=eq\.ready/);
});

test("explore opens the modal only after detail access is granted", () => {
  const explore = source("src/components/explore-client.tsx");

  assert.match(explore, /\/api\/packs\/pool\/detail-access/);
  assert.match(explore, /openedDetailPidsRef/);
  assert.match(explore, /DetailAccessPaywallModal/);
  assert.match(explore, /setDetailAccessLimit/);
  assert.match(explore, /크레딧 충전하고 계속 보기/);
  assert.doesNotMatch(explore, /Plus로 계속 보기/);
  assert.match(explore, /void openItemDetail\(item\)/);
});

test("detail modal keeps purchase decision and market evidence in the first fold", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const decisionIndex = modal.indexOf("<PurchaseDecisionHeader card={card} />");
  const comparableIndex = modal.indexOf("<ComparableListingsPanel card={card} mode={mode} />");

  assert.match(modal, /function PurchaseDecisionHeader/);
  assert.match(modal, /구매 판단/);
  assert.match(modal, /근거 있는 매입 후보/);
  assert.ok(decisionIndex > 0, "purchase decision header should render in the detail modal");
  assert.ok(comparableIndex > decisionIndex, "market comparables should stay directly after the decision/profit block");
});

test("related item clicks do not scroll before access is granted", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.doesNotMatch(modal, /onBeforeOpenRelatedItem/);
  assert.match(modal, /activeRevealPid/);
  assert.match(modal, /resetDetailScroll\("auto"\)/);
});

test("profit card detail toggle does not duplicate market comparables copy", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /수익 계산 근거 보기/);
  assert.match(modal, /data-profit-calculation-basis/);
  assert.match(modal, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.doesNotMatch(modal, /계산식 · 비교 매물/);
  assert.match(modal, /시세 비교 매물/);
});
