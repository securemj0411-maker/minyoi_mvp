import { strict as assert } from "node:assert";
import { test } from "node:test";
import { teaserBudgetRangeLabel, teaserProfitLabel } from "../src/lib/feed-price-display";

test("teaser budget ranges widen by price level without becoming vague", () => {
  assert.equal(teaserBudgetRangeLabel(40_000), "15만원 이하");
  assert.equal(teaserBudgetRangeLabel(200_000), "15~30만원");
  assert.equal(teaserBudgetRangeLabel(300_000), "20~40만원");
  assert.equal(teaserBudgetRangeLabel(900_000), "70~100만원");
  assert.equal(teaserBudgetRangeLabel(1_100_000), "90~120만원");
  assert.equal(teaserBudgetRangeLabel(2_500_000), "220~280만원");
});

test("teaser profit stays concrete without exposing exact cents-like calculation", () => {
  assert.equal(teaserProfitLabel(0), "수익 후보");
  assert.equal(teaserProfitLabel(8_900), "약 +1만원 미만");
  assert.equal(teaserProfitLabel(148_000), "약 +15만원");
  assert.equal(teaserProfitLabel(1_480_000), "약 +148만원");
});
