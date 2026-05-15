import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildCandidatePoolRows } from "@/lib/candidate-pool-builder";

const baseRow = {
  pid: 1,
  price: 100000,
  skuMedian: 200000,
  estimatedBuyCost: 105000,
  shippingFee: 3000,
  shippingFeeGeneral: null,
  riskHits: 0,
  thumbnailUrl: null,
  poolEligible: true,
  skuId: "test-sku",
  score: 50,
  scoreFlags: [],
  saleStatus: "selling",
};

const baseParsed = new Map([[
  1,
  {
    category: "earphone" as const,
    comparable_key: "earphone|test",
    parse_confidence: 0.9,
    needs_review: false,
    parsed_json: {},
    condition_class: "normal",
  },
]]);

const catalogById = new Map();
const categoryReadiness = new Map([
  ["earphone", { canEnterPool: true, status: "ready", reason: null, laneKey: null }],
]) as unknown as Parameters<typeof buildCandidatePoolRows>[0]["categoryReadiness"];

describe("Wave 132 — num_comment >= 8 pool gate", () => {
  it("num_comment 0 → pool 통과", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, numComment: 0 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    // 다른 차단 사유(comparable_key/profit 등)에 의해 떨어질 수 있지만 num_comment_above 이유는 아니어야
    const ncSkip = result.invalidations.find((i) => i.reason.startsWith("num_comment_above"));
    assert.equal(ncSkip, undefined, "댓글 0인 매물은 num_comment gate 통과해야");
  });

  it("num_comment 7 → pool 통과 (threshold-1)", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, numComment: 7 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const ncSkip = result.invalidations.find((i) => i.reason.startsWith("num_comment_above"));
    assert.equal(ncSkip, undefined, "댓글 7 = threshold 미만 → 통과");
  });

  it("num_comment 8 → pool 차단", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, numComment: 8 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const ncSkip = result.invalidations.find((i) => i.reason.startsWith("num_comment_above"));
    assert.ok(ncSkip, `댓글 8 = threshold → 차단되어야. invalidations: ${JSON.stringify(result.invalidations)}`);
  });

  it("num_comment 912 (대량 판매업자) → pool 차단", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, numComment: 912 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const ncSkip = result.invalidations.find((i) => i.reason.startsWith("num_comment_above"));
    assert.ok(ncSkip, "댓글 912 = 대량 판매업자 → 차단");
  });

  it("num_comment null (detail 미수집) → 통과 (다음 tick에서 재평가)", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, numComment: null }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const ncSkip = result.invalidations.find((i) => i.reason.startsWith("num_comment_above"));
    assert.equal(ncSkip, undefined, "NULL은 통과 (gate에서 skip)");
  });

  it("num_comment undefined (PoolCandidateInput 옵셔널) → 통과", () => {
    const row = { ...baseRow };
    // numComment 안 박은 input
    const result = buildCandidatePoolRows({
      rows: [row],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const ncSkip = result.invalidations.find((i) => i.reason.startsWith("num_comment_above"));
    assert.equal(ncSkip, undefined, "undefined도 통과");
  });
});

// Wave 137 (2026-05-16): qty > 1 pool 진입 차단 (대량 판매업자).
// Wave 136 audit 발견: product.qty 88/35/26 = 대량 판매업자, 1 = 일반 매물.
describe("Wave 137 — qty > 1 pool gate (대량 판매업자 차단)", () => {
  it("qty 1 → pool 통과 (일반 매물)", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, qty: 1 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const qtySkip = result.invalidations.find((i) => i.reason.startsWith("qty_above"));
    assert.equal(qtySkip, undefined, "qty 1 = 일반 매물 → 통과");
  });

  it("qty 2 → pool 차단 (다수 보유)", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, qty: 2 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const qtySkip = result.invalidations.find((i) => i.reason.startsWith("qty_above"));
    assert.ok(qtySkip, "qty 2 = 차단되어야");
  });

  it("qty 88 (대량 판매업자) → pool 차단", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, qty: 88 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const qtySkip = result.invalidations.find((i) => i.reason.startsWith("qty_above"));
    assert.ok(qtySkip, "qty 88 = 대량 판매업자 차단");
  });

  it("qty null (detail 미수집) → 통과 (다음 tick 재평가)", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, qty: null }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const qtySkip = result.invalidations.find((i) => i.reason.startsWith("qty_above"));
    assert.equal(qtySkip, undefined, "NULL은 통과");
  });

  it("qty undefined (PoolCandidateInput 옵셔널) → 통과", () => {
    const row = { ...baseRow };
    const result = buildCandidatePoolRows({
      rows: [row],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const qtySkip = result.invalidations.find((i) => i.reason.startsWith("qty_above"));
    assert.equal(qtySkip, undefined, "undefined도 통과");
  });
});

// Wave 138 (2026-05-16): 같은 seller_uid 다수 매물 차단 (qty 위장 업자 탐지).
describe("Wave 138 — seller-level pool gate", () => {
  const sellerParsed = new Map([
    [1, { category: "earphone" as const, comparable_key: "earphone|test", parse_confidence: 0.9, needs_review: false, parsed_json: {}, condition_class: "normal" }],
    [2, { category: "earphone" as const, comparable_key: "earphone|test", parse_confidence: 0.9, needs_review: false, parsed_json: {}, condition_class: "normal" }],
    [3, { category: "earphone" as const, comparable_key: "earphone|test", parse_confidence: 0.9, needs_review: false, parsed_json: {}, condition_class: "normal" }],
  ]);

  it("같은 셀러 1개만 → 통과", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, sellerUid: "seller-a" }],
      parsedByPid: sellerParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const sellerSkip = result.invalidations.find((i) => i.reason.startsWith("seller_above"));
    assert.equal(sellerSkip, undefined, "1매물 → 통과");
  });

  it("같은 셀러 batch 3개 → 1개만 통과, 2개 차단", () => {
    const result = buildCandidatePoolRows({
      rows: [
        { ...baseRow, pid: 1, sellerUid: "seller-a", score: 50 },
        { ...baseRow, pid: 2, sellerUid: "seller-a", score: 70 },  // 가장 높음 → 통과
        { ...baseRow, pid: 3, sellerUid: "seller-a", score: 60 },
      ],
      parsedByPid: sellerParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const sellerSkips = result.invalidations.filter((i) => i.reason.startsWith("seller_above"));
    assert.equal(sellerSkips.length, 2, `2개 차단되어야. skips: ${JSON.stringify(sellerSkips)}`);
  });

  it("같은 셀러 이미 pool 1개 → 신규 매물 차단", () => {
    const existing = new Map<string, number>([["seller-a", 1]]);
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, sellerUid: "seller-a" }],
      parsedByPid: sellerParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
      existingPoolSellerCounts: existing,
    });
    const sellerSkip = result.invalidations.find((i) => i.reason.startsWith("seller_above"));
    assert.ok(sellerSkip, "existing 1 + 신규 = 차단");
  });

  it("다른 셀러 다수 → 모두 통과 (셀러별 1개씩)", () => {
    const result = buildCandidatePoolRows({
      rows: [
        { ...baseRow, pid: 1, sellerUid: "seller-a" },
        { ...baseRow, pid: 2, sellerUid: "seller-b" },
        { ...baseRow, pid: 3, sellerUid: "seller-c" },
      ],
      parsedByPid: sellerParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const sellerSkips = result.invalidations.filter((i) => i.reason.startsWith("seller_above"));
    assert.equal(sellerSkips.length, 0, "다른 셀러는 차단 안 됨");
  });

  it("sellerUid null → gate 통과 (정보 없음)", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, sellerUid: null }],
      parsedByPid: sellerParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const sellerSkip = result.invalidations.find((i) => i.reason.startsWith("seller_above"));
    assert.equal(sellerSkip, undefined, "null = 통과");
  });
});
