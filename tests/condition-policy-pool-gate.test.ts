import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCandidatePoolRows } from "@/lib/candidate-pool-builder";

const baseRow = {
  pid: 9001,
  price: 100000,
  skuMedian: 200000,
  estimatedBuyCost: 100000,
  shippingFee: 0,
  shippingFeeGeneral: null,
  riskHits: 0,
  thumbnailUrl: "https://example.com/thumb.jpg",
  poolEligible: true,
  skuId: "test-phone",
  score: 90,
  scoreFlags: [],
  saleStatus: "selling",
};

const categoryReadiness = new Map([
  ["smartphone", { canEnterPool: true, status: "ready", reason: null, laneKey: null }],
]) as unknown as Parameters<typeof buildCandidatePoolRows>[0]["categoryReadiness"];

describe("condition policy pool gate", () => {
  it("POOL_BLOCK note가 condition_notes 컬럼에만 있어도 ready 진입을 막는다", () => {
    const result = buildCandidatePoolRows({
      rows: [baseRow],
      parsedByPid: new Map([[
        9001,
        {
          category: "smartphone" as const,
          comparable_key: "iphone|test|128gb",
          parse_confidence: 0.92,
          needs_review: false,
          parsed_json: {},
          condition_notes: ["locked_or_lost_signal"],
          condition_class: "worn",
        },
      ]]),
      catalogById: new Map(),
      categoryReadiness,
      now: new Date().toISOString(),
    });

    assert.equal(result.entries.length, 0);
    assert.ok(
      result.invalidations.some((item) => item.reason === "condition_note_locked_or_lost_signal"),
      JSON.stringify(result.invalidations),
    );
  });
});
