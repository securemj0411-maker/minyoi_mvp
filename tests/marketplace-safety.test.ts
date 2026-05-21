import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarketplaceSafetyDisplay,
} from "../src/lib/marketplace-safety";
import { buildVerdicts } from "../src/lib/listing-verdicts";

test("joongna seller trust is displayed as trust score, not rating", () => {
  const display = buildMarketplaceSafetyDisplay({
    marketplaceSource: "joongna",
    marketplaceLabel: "중고나라",
    sellerReviewRating: 3.82,
    sellerReviewCount: 2,
    joongnaTrustScore: 764,
    joongnaSafeOrderSalesCount: 1,
    tradeLabels: ["직거래", "배송비 포함"],
    freeShipping: true,
  });

  const text = [
    display.sellerTrust.metric,
    display.sellerTrust.metricLabel,
    display.sellerTrust.body,
    display.sellerTrust.note,
  ].join(" ");

  assert.match(text, /중고나라 신뢰지수|신뢰지수 760점대/);
  assert.match(text, /거래후기 2건/);
  assert.match(text, /안심거래 판매 1건/);
  assert.doesNotMatch(text, /평점\s*\d|우수 셀러|평점 양호/);
});

test("joongna low trust score with tiny review count is interpreted conservatively", () => {
  const display = buildMarketplaceSafetyDisplay({
    marketplaceSource: "joongna",
    marketplaceLabel: "중고나라",
    sellerReviewCount: 1,
    joongnaTrustScore: 442,
    joongnaSafeOrderSalesCount: 1,
  });

  const text = [
    display.sellerTrust.metric,
    display.sellerTrust.metricLabel,
    display.sellerTrust.assessmentLabel,
    display.sellerTrust.assessment,
    display.sellerTrust.tileSub,
  ].join(" ");

  assert.match(text, /신뢰지수 440점대/);
  assert.match(text, /거래후기 1건/);
  assert.match(text, /안심거래 판매 1건/);
  assert.match(text, /표본 적음|강한 신뢰 신호라기보다|보수 확인/);
  assert.doesNotMatch(text, /믿을 만|우수 셀러|평점/);
});

test("joongna direct-only shipping is not treated as free shipping", () => {
  const display = buildMarketplaceSafetyDisplay({
    marketplaceSource: "joongna",
    marketplaceLabel: "중고나라",
    sellerReviewCount: 3,
    tradeLabels: ["직거래"],
    freeShipping: false,
  });

  assert.equal(display.shipping.transactionMode, "direct_only");
  assert.equal(display.shipping.assumption, "direct_only");
  assert.equal(display.shipping.buyerShippingHigh, 0);
  assert.equal(display.shipping.valueLabel, "0원");
  assert.equal(display.shipping.allowFreeShippingBadge, false);
  assert.match(display.shipping.label, /직거래 전제/);
});

test("joongna included shipping says shipping included, not free shipping", () => {
  const display = buildMarketplaceSafetyDisplay({
    marketplaceSource: "joongna",
    marketplaceLabel: "중고나라",
    tradeLabels: ["택배거래", "배송비 포함"],
    freeShipping: true,
  });

  assert.equal(display.shipping.assumption, "included");
  assert.equal(display.shipping.valueLabel, "배송비 포함");
  assert.equal(display.shipping.allowFreeShippingBadge, false);
});

test("source-aware verdicts do not emit joongna rating or free-shipping badges", () => {
  const verdicts = buildVerdicts({
    marketplaceSource: "joongna",
    sellerReviewRating: 3.8,
    sellerReviewCount: 2,
    joongnaTrustScore: 760,
    joongnaSafeOrderSalesCount: 1,
    freeShipping: true,
    tradeLabels: ["직거래", "배송비 포함"],
  }).map((v) => v.label).join(" ");

  assert.match(verdicts, /신뢰지수 760점대/);
  assert.match(verdicts, /안심거래 판매 1건/);
  assert.match(verdicts, /배송비 포함/);
  assert.doesNotMatch(verdicts, /★|우수 셀러|무료배송/);
});
