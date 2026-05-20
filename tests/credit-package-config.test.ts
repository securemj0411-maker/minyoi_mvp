import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PLANS, formatKrw } from "../src/lib/plan-config";
import { FREE_CREDIT_GRANT } from "../src/lib/user-credits";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("credit top-up package prices and grants stay aligned", () => {
  assert.equal(FREE_CREDIT_GRANT, 0);

  assert.equal(PLANS.starter.priceKrw, 3_900);
  assert.equal(PLANS.starter.monthlyCredits, 20);
  assert.equal(PLANS.starter.dailyOpenLimit, 20);

  assert.equal(PLANS.plus.priceKrw, 19_900);
  assert.equal(PLANS.plus.monthlyCredits, 200);
  assert.equal(PLANS.plus.dailyOpenLimit, 200);

  assert.equal(PLANS.pro.priceKrw, 39_900);
  assert.equal(PLANS.pro.monthlyCredits, 500);
  assert.equal(PLANS.pro.dailyOpenLimit, 500);

  assert.equal(formatKrw(3_900), "3,900원");
});

test("plans page is a compact credit top-up menu", () => {
  const plans = source("src/app/plans/page.tsx");

  assert.match(plans, /크레딧 충전/);
  assert.match(plans, /3가지 충전권/);
  assert.match(plans, /상세보기 1회 = 1크레딧/);
  assert.match(plans, /자동 갱신 없이 한 번만 결제/);
  assert.match(plans, /여러 모델을 비교하며 살 만한 후보 추리기/);
  assert.match(plans, /예상 순익, 시세 그래프, 비교 매물, 원본 링크/);
  assert.match(plans, /실제 거래 결과는 가격·상태·거래 조건에 따라 달라집니다/);
  assert.match(plans, /"starter", "plus", "pro"/);
  assert.match(plans, /<CreditIcon size=\{22\}/);
  assert.match(plans, /<span className="text-\[15px\] sm:text-\[16px\]">크레딧<\/span>/);
  assert.match(plans, /원\/1크레딧/);
  assert.match(plans, /font-bold leading-none/);
  assert.match(plans, /formatKrw\(plan\.priceKrw\)/);
  assert.match(plans, /credits=\$\{plan\.monthlyCredits\}/);
  assert.match(plans, /충전하기/);
  assert.match(plans, /환불정책 확인/);
  assert.doesNotMatch(plans, /요금제|구독|플랜|Plus로|PRO|최근 충전 상품|열람 안전 한도|충전권 비교/);
  assert.doesNotMatch(plans, /무조건|본전|평균 수익|수익 보장|돈을 벌|얼마를 벌/);
});

test("checkout accepts credit package URLs while keeping legacy plan keys compatible", () => {
  const checkout = source("src/app/billing/checkout/checkout-client.tsx");

  assert.match(checkout, /CREDIT_PACKAGE_TO_PLAN/);
  assert.match(checkout, /"200": "plus"/);
  assert.match(checkout, /params\.get\("credits"\)/);
  assert.match(checkout, /params\.get\("plan"\)/);
});
