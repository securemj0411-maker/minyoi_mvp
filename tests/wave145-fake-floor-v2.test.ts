/* eslint-disable @typescript-eslint/no-explicit-any */
// Wave 145 (2026-05-16): 가품 detection v2 — 셀러 신뢰도 + 가격 floor 결합.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCandidatePoolRows } from "@/lib/candidate-pool-builder";
import type { Sku } from "@/lib/catalog";

const SHOE_SKU: Sku = {
  id: "shoe-test",
  brand: "Nike",
  category: "shoe",
  modelName: "Test Shoe",
  aliases: [],
  mustContain: [],
  mustNotContain: [],
  msrpKrw: 200000,
};

const baseInput = {
  parsedByPid: new Map([
    [1, { comparable_key: "shoe|test|240|unknown_condition", category: "shoe", parse_confidence: 0.9, needs_review: false } as any],
  ]),
  catalogById: new Map([[SHOE_SKU.id, SHOE_SKU]]),
  categoryReadiness: new Map() as any,
  laneReadiness: new Map() as any,
  now: "2026-05-16T00:00:00Z",
};

function makeRow(price: number, opts: Partial<any> = {}) {
  return {
    pid: 1,
    price,
    skuId: SHOE_SKU.id,
    skuMedian: 150000,
    estimatedBuyCost: price,
    shippingFee: 3000,
    shippingFeeGeneral: 3000,
    saleStatus: "selling",
    score: 80,
    poolEligible: true,
    ...opts,
  };
}

describe("Wave 145 — 가품 floor v2 (셀러 신뢰도 결합)", () => {
  it("Tier 1 (15% 이하): 신뢰도 무관 차단 (review 999건이라도)", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow(20000, { shopReviewCount: 999, shopReviewRating: 5.0 })],
      // msrp 200k * 0.15 = 30k → 20k 차단
    });
    assert.equal(result.entries.length, 0);
    assert.match(result.invalidations[0].reason, /fake_suspect_t1/);
  });

  it("Tier 2 (25% 이하 + 셀러 신뢰도 낮음): 차단", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow(40000, { shopReviewCount: 2, shopReviewRating: 5.0 })],
      // 200k * 0.25 = 50k → 40k < 50k + review 2 < 5 → 차단
    });
    assert.equal(result.entries.length, 0);
    assert.match(result.invalidations[0].reason, /fake_suspect_t2/);
  });

  it("Tier 2 (25% 이하 + rating 낮음): 차단", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow(45000, { shopReviewCount: 50, shopReviewRating: 4.3 })],
      // 200k * 0.25 = 50k → 45k < 50k + rating 4.3 < 4.5 → 차단
    });
    assert.equal(result.entries.length, 0);
    assert.match(result.invalidations[0].reason, /fake_suspect_t2/);
  });

  it("Tier 2 (25% 이하지만 신뢰도 높음): 통과 (false positive 차단)", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow(45000, { shopReviewCount: 100, shopReviewRating: 4.8 })],
      // 200k * 0.25 = 50k → 45k < 50k이지만 review 100 + rating 4.8 → 통과
    });
    const fakeReasonHit = result.invalidations.find((i) => i.reason.startsWith("fake_suspect"));
    assert.equal(fakeReasonHit, undefined);
  });

  it("Tier 2 (가격 25% 초과 + 신뢰도 낮음): 통과 (false positive 차단)", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow(60000, { shopReviewCount: 2, shopReviewRating: 5.0 })],
      // 200k * 0.25 = 50k → 60k > 50k → tier 2 적용 안 됨
    });
    const fakeReasonHit = result.invalidations.find((i) => i.reason.startsWith("fake_suspect"));
    assert.equal(fakeReasonHit, undefined);
  });

  it("Tier 2 (review/rating 둘 다 null): 차단 안 됨 (data 부족 → benefit of doubt)", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow(40000, { shopReviewCount: null, shopReviewRating: null })],
    });
    const fakeReasonHit = result.invalidations.find((i) => i.reason.startsWith("fake_suspect_t2"));
    assert.equal(fakeReasonHit, undefined);
  });
});
