// Wave 141 (2026-05-16): 시세 floor 가품 detection 검증.
// pool 진입 시 price < max(msrp, skuMedian) * 0.15 → 신발/가방 차단.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCandidatePoolRows } from "@/lib/candidate-pool-builder";
import type { Sku } from "@/lib/catalog";

const SHOE_SKU: Sku = {
  id: "shoe-test-990v5",
  brand: "New Balance",
  category: "shoe",
  modelName: "Test 990v5",
  aliases: [],
  mustContain: [],
  mustNotContain: [],
  msrpKrw: 269000,
};

const EARPHONE_SKU: Sku = {
  id: "airpods-test",
  brand: "Apple",
  category: "earphone",
  modelName: "Test Airpods",
  aliases: [],
  mustContain: [],
  mustNotContain: [],
  msrpKrw: 359000,
};

const baseCategoryReadiness = new Map() as any;
const baseLaneReadiness = new Map() as any;

const baseInput = {
  parsedByPid: new Map([
    [1, { comparable_key: "shoe|990v5|240|unknown_condition", category: "shoe", parse_confidence: 0.9, needs_review: false } as any],
  ]),
  catalogById: new Map([[SHOE_SKU.id, SHOE_SKU]]),
  categoryReadiness: baseCategoryReadiness,
  laneReadiness: baseLaneReadiness,
  now: "2026-05-16T00:00:00Z",
};

function makeRow(price: number, opts: Partial<any> = {}) {
  return {
    pid: 1,
    price,
    skuId: SHOE_SKU.id,
    skuMedian: 150000,  // 시세 15만
    estimatedBuyCost: price,
    shippingFee: 3000,
    shippingFeeGeneral: 3000,
    saleStatus: "selling",
    score: 80,
    poolEligible: true,
    ...opts,
  };
}

describe("Wave 141 — 가품 floor detection", () => {
  it("신발 price < msrp * 0.15 차단 (9k vs 269k msrp = 3.3%)", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow(9000)],
    });
    assert.equal(result.entries.length, 0);
    assert.equal(result.skipped, 1);
    assert.match(result.invalidations[0].reason, /fake_suspect/);
  });

  it("신발 price = msrp * 0.20 통과 (54k = 20%)", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow(54000)],
    });
    // 시세 다른 gate 차단 가능성 있지만 fake floor에는 안 걸림
    const fakeReasonHit = result.invalidations.find((i) => i.reason.startsWith("fake_suspect"));
    assert.equal(fakeReasonHit, undefined);
  });

  it("신발 한정판 (skuMedian > msrp): 시세 기준으로 가품 차단", () => {
    // 한정판: msrp 269k, 시세 1,000k → reference = 1,000k.
    // price 50k < 1,000k * 0.15 = 150k → 차단
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow(50000, { skuMedian: 1_000_000 })],
    });
    assert.equal(result.entries.length, 0);
    assert.match(result.invalidations[0].reason, /fake_suspect/);
  });

  it("이어폰 카테고리: 가품 floor 적용 안 됨 (10k airpods도 pool 진입 가능)", () => {
    const earphoneInput = {
      ...baseInput,
      parsedByPid: new Map([
        [1, { comparable_key: "airpods|airpods_pro_2", category: "earphone", parse_confidence: 0.9, needs_review: false } as any],
      ]),
      catalogById: new Map([[EARPHONE_SKU.id, EARPHONE_SKU]]),
    };
    const result = buildCandidatePoolRows({
      ...earphoneInput,
      rows: [{
        pid: 1,
        price: 10000,
        skuId: EARPHONE_SKU.id,
        skuMedian: 200000,
        estimatedBuyCost: 10000,
        shippingFee: 3000,
        shippingFeeGeneral: 3000,
        saleStatus: "selling",
        score: 80,
        poolEligible: true,
      }],
    });
    // 가품 floor 차단 안 됨 (earphone 카테고리는 fake_suspect skip)
    const fakeReasonHit = result.invalidations.find((i) => i.reason.startsWith("fake_suspect"));
    assert.equal(fakeReasonHit, undefined);
  });

  it("msrp 없으면 차단 안 됨", () => {
    const noMsrpSku: Sku = { ...SHOE_SKU, msrpKrw: undefined as any };
    const result = buildCandidatePoolRows({
      ...baseInput,
      catalogById: new Map([[noMsrpSku.id, noMsrpSku]]),
      rows: [makeRow(5000)],
    });
    const fakeReasonHit = result.invalidations.find((i) => i.reason.startsWith("fake_suspect"));
    assert.equal(fakeReasonHit, undefined);
  });
});
