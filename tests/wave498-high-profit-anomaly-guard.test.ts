// Wave 498 (2026-05-21): high-profit anomaly guard.
//
// 너무 높은 수익률은 "대박"보다 모델/상태/sample 오분류 신호일 때가 많다.
// 사용자 노출 풀에서는 삭제 대신 invalidation reason 으로 보류해 운영자 검토에 남긴다.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildCandidatePoolRows } from "@/lib/candidate-pool-builder";
import type { Sku } from "@/lib/catalog";

const EARPHONE_SKU: Sku = {
  id: "earphone-test-airpods",
  brand: "Apple",
  category: "earphone",
  modelName: "Test AirPods",
  aliases: [],
  mustContain: [],
  mustNotContain: [],
};

const BAG_SKU: Sku = {
  id: "bag-test-cassette",
  brand: "Bottega Veneta",
  category: "bag",
  modelName: "Test Cassette",
  aliases: [],
  mustContain: [],
  mustNotContain: [],
};

const categoryReadiness = new Map([
  ["earphone", { canEnterPool: true, status: "ready", reason: null, laneKey: null }],
  ["bag", { canEnterPool: true, status: "ready", reason: null, laneKey: null }],
]) as unknown as Parameters<typeof buildCandidatePoolRows>[0]["categoryReadiness"];

function makeRow(overrides: Partial<Parameters<typeof buildCandidatePoolRows>[0]["rows"][number]> = {}) {
  return {
    pid: 1,
    price: 100_000,
    skuMedian: 148_000,
    estimatedBuyCost: 100_000,
    shippingFee: 0,
    shippingFeeGeneral: 0,
    riskHits: 0,
    thumbnailUrl: "https://example.com/thumb.jpg",
    poolEligible: true,
    skuId: EARPHONE_SKU.id,
    score: 80,
    scoreFlags: [],
    saleStatus: "selling",
    imageCount: 5,
    shopReviewCount: 20,
    ...overrides,
  };
}

function runBuild(input: {
  category: Sku["category"];
  sku: Sku;
  comparableKey: string;
  conditionClass?: string | null;
  parseConfidence?: number | null;
  row?: Partial<Parameters<typeof buildCandidatePoolRows>[0]["rows"][number]>;
}) {
  const row = makeRow({
    skuId: input.sku.id,
    ...input.row,
  });
  return buildCandidatePoolRows({
    rows: [row],
    parsedByPid: new Map([[
      1,
      {
        category: input.category,
        comparable_key: input.comparableKey,
        parse_confidence: input.parseConfidence ?? 0.95,
        needs_review: false,
        parsed_json: {},
        condition_class: input.conditionClass ?? "clean",
      },
    ]]),
    catalogById: new Map([[input.sku.id, input.sku]]),
    categoryReadiness,
    now: "2026-05-21T00:00:00Z",
  });
}

describe("Wave 498 — high-profit anomaly guard", () => {
  it("전자기기는 순수익률 40% 이상이면 사용자 풀 노출을 보류한다", () => {
    const result = runBuild({
      category: "earphone",
      sku: EARPHONE_SKU,
      comparableKey: "earphone|airpods|clean",
      row: { skuMedian: 160_000 },
    });

    assert.equal(result.entries.length, 0);
    assert.equal(result.invalidations[0]?.reason, "profit_roi_above_40pct_electronics_review");
  });

  it("전자기기도 40% 미만이면 기존 pool 기준대로 통과할 수 있다", () => {
    const result = runBuild({
      category: "earphone",
      sku: EARPHONE_SKU,
      comparableKey: "earphone|airpods|clean",
      row: { skuMedian: 148_000 },
    });

    assert.equal(result.entries.length, 1, JSON.stringify(result));
    assert.equal(result.invalidations.find((item) => item.reason.includes("profit_roi_above")), undefined);
  });

  it("가방/패션 고수익은 강한 신호가 있으면 70% 미만까지는 통과시킨다", () => {
    const result = runBuild({
      category: "bag",
      sku: BAG_SKU,
      comparableKey: "bag|cassette|clean",
      row: {
        skuMedian: 180_000,
        imageCount: 5,
        shopReviewCount: 20,
      },
    });

    assert.equal(result.entries.length, 1, JSON.stringify(result));
    assert.equal(result.invalidations.find((item) => item.reason.includes("profit_roi_above")), undefined);
  });

  it("가방/패션도 70% 이상이면 오분류 가능성으로 보류한다", () => {
    const result = runBuild({
      category: "bag",
      sku: BAG_SKU,
      comparableKey: "bag|cassette|clean",
      row: {
        skuMedian: 190_000,
        imageCount: 5,
        shopReviewCount: 20,
      },
    });

    assert.equal(result.entries.length, 0);
    assert.equal(result.invalidations[0]?.reason, "profit_roi_above_70pct_bag_review");
  });

  it("사진/후기/상태 신호가 약하면 45% 이상부터 보류한다", () => {
    const result = runBuild({
      category: "bag",
      sku: BAG_SKU,
      comparableKey: "bag|cassette|unknown_condition",
      conditionClass: null,
      row: {
        skuMedian: 165_000,
        imageCount: 1,
        shopReviewCount: 0,
      },
    });

    assert.equal(result.entries.length, 0);
    assert.equal(result.invalidations[0]?.reason, "profit_roi_above_45pct_weak_signal_review");
  });
});
