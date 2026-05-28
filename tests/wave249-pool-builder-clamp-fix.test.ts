// Wave 249 (2026-05-19): candidate-pool-builder Option 3 — 차익 음수 + sku_median 부재 매물 pool 진입 차단.
//
// 배경: candidates.ts:103-104 `Math.max(0, sku_median - price)` clamp 정책 root fix.
//   기존: 차익 음수/시세 부재 매물 모두 `profit_below_pack_band` 한 reason 으로 묶여 가시성 낮음.
//   신규: 명시적 invalidation reason 분리 → admin SQL 측정 + 사용자 친화.
//
// 사용자 정책:
//   - 미뇨이 핵심 = 차익 매물 추천. 차익 음수 자명히 차단.
//   - 일반인 친화 — 차익 음수 매물 추천 시 혼란.
//   - 시세 sample 정확 — 음수 매물 비교군 제외.
//
// 동작 정렬:
//   1. sku_median_unavailable 먼저 (skuMedian 신호 자체 없을 때)
//   2. negative_resell_gap (skuMedian > 0 + price >= skuMedian)
//   3. bandFromProfit (profitMin/Max 모두 0이면 profit_not_positive_after_costs)
//   4. poolSkipReason (price_gte_market 등 후순위 — 위 2개 가드로 이미 차단됨)

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
  thumbnailUrl: "https://example.com/thumb.jpg",
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

describe("Wave 249 — sku_median_unavailable gate", () => {
  it("skuMedian = 0 → invalidation `sku_median_unavailable`", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, skuMedian: 0 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const skip = result.invalidations.find((i) => i.reason === "sku_median_unavailable");
    assert.ok(skip, `skuMedian=0 차단 reason 매칭. invalidations: ${JSON.stringify(result.invalidations)}`);
    assert.equal(result.entries.length, 0, "pool entries에 안 들어가야");
  });

  it("skuMedian = null (cast 불가) → invalidation `sku_median_unavailable`", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, skuMedian: null as unknown as number }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const skip = result.invalidations.find((i) => i.reason === "sku_median_unavailable");
    assert.ok(skip, "null 차단");
  });

  it("skuMedian = NaN → invalidation `sku_median_unavailable`", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, skuMedian: NaN }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const skip = result.invalidations.find((i) => i.reason === "sku_median_unavailable");
    assert.ok(skip, "NaN 차단");
  });

  it("skuMedian = -1 (이상치) → invalidation `sku_median_unavailable`", () => {
    // <= 0 모두 차단 — sku_median 정의상 양수.
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, skuMedian: -1 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const skip = result.invalidations.find((i) => i.reason === "sku_median_unavailable");
    assert.ok(skip, "음수 skuMedian 차단");
  });
});

describe("Wave 249 — negative_resell_gap gate", () => {
  it("차익 음수 (skuMedian=100K, listing=150K) → invalidation `negative_resell_gap`", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, price: 150000, skuMedian: 100000 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const skip = result.invalidations.find((i) => i.reason === "negative_resell_gap");
    assert.ok(skip, `negative_resell_gap 차단 reason 매칭. invalidations: ${JSON.stringify(result.invalidations)}`);
    assert.equal(result.entries.length, 0, "pool entries에 안 들어가야");
  });

  it("차익 0 (skuMedian=100K, listing=100K) → invalidation `negative_resell_gap` (>= check)", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, price: 100000, skuMedian: 100000 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const skip = result.invalidations.find((i) => i.reason === "negative_resell_gap");
    assert.ok(skip, "price = skuMedian → 차익 0 = 추천 가치 없음 → 차단");
  });

  it("차익 양수 미세 (skuMedian=200K, listing=199K) → negative_resell_gap 차단 안 됨", () => {
    // price < skuMedian → negative_resell_gap gate 통과 (다른 gate 에서 떨어질 수는 있음).
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, price: 199000, skuMedian: 200000 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const skip = result.invalidations.find((i) => i.reason === "negative_resell_gap");
    assert.equal(skip, undefined, "price < skuMedian 은 negative_resell_gap 차단 X (profit band 가 잡을 수도 있음)");
  });

  it("차익 양수 (skuMedian=148K, listing=100K) → pool 진입 정상 (negative_resell_gap 통과)", () => {
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, price: 100000, skuMedian: 148000 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const skip = result.invalidations.find(
      (i) => i.reason === "negative_resell_gap" || i.reason === "sku_median_unavailable",
    );
    assert.equal(skip, undefined, "차익 양수 매물은 두 gate 통과해야");
    // baseRow 의 다른 gate 도 모두 통과되도록 신경 썼으므로 entries 에 박혀야.
    assert.equal(result.entries.length, 1, `pool entries 1건. result: ${JSON.stringify(result)}`);
  });

  it("Daangn 매물은 pool 진입 계산에서도 수수료/재배송비 0원 기준을 쓴다", () => {
    // 일반 marketplace 비용(3.5% + 재배송비 + 안전버퍼)을 빼면 0원 이하가 되지만,
    // 당근 직거래 재판매 기준이면 source-aware 비용이 0원이라 ready 후보로 남아야 한다.
    const result = buildCandidatePoolRows({
      rows: [{
        ...baseRow,
        source: "daangn",
        daangnMannerTemperature: 43.3,
        price: 100000,
        estimatedBuyCost: 100000,
        shippingFee: 5000,
        shippingFeeGeneral: null,
        skuMedian: 112000,
      }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });

    assert.equal(result.entries.length, 1, `Daangn source-aware 비용이면 pool 진입. result: ${JSON.stringify(result)}`);
    assert.equal(result.entries[0]?.expected_profit_min, 7000);
    assert.equal(result.entries[0]?.expected_profit_max, 12000);
  });

  it("Daangn 매너온도 없는 row는 ready pool 진입 차단", () => {
    const result = buildCandidatePoolRows({
      rows: [{
        ...baseRow,
        source: "daangn",
        daangnMannerTemperature: null,
        price: 100000,
        estimatedBuyCost: 100000,
        shippingFee: 5000,
        shippingFeeGeneral: null,
        skuMedian: 112000,
      }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });

    assert.equal(result.entries.length, 0);
    assert.ok(
      result.invalidations.find((i) => i.reason === "daangn_manner_temperature_missing"),
      `Daangn manner missing invalidation expected. result: ${JSON.stringify(result)}`,
    );
  });

  it("price = 0 (placeholder) → negative_resell_gap gate 통과 (price>0 가드)", () => {
    // price 0 이나 placeholder 가격은 위쪽 `isPoolPlaceholderPrice` 에서 잡힘.
    // negative_resell_gap gate 는 price > 0 일 때만 검사.
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, price: 0, skuMedian: 200000 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    // placeholder gate 가 먼저 잡음.
    const placeholderSkip = result.invalidations.find((i) => i.reason === "placeholder_price");
    const negSkip = result.invalidations.find((i) => i.reason === "negative_resell_gap");
    assert.ok(placeholderSkip, "placeholder_price 가 먼저 차단");
    assert.equal(negSkip, undefined, "negative_resell_gap 까지 못 가야 (placeholder 가 차단)");
  });
});

describe("Wave 249 — gate 순서: sku_median_unavailable 우선", () => {
  it("skuMedian=0 + price>skuMedian (둘 다 해당) → sku_median_unavailable 먼저 박힘", () => {
    // price=100K, skuMedian=0 → 정의상 price > skuMedian 이지만 → sku_median_unavailable 가 우선.
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, price: 100000, skuMedian: 0 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    const noMedian = result.invalidations.find((i) => i.reason === "sku_median_unavailable");
    const negGap = result.invalidations.find((i) => i.reason === "negative_resell_gap");
    assert.ok(noMedian, "sku_median_unavailable 먼저 — '비교 불가능' 신호");
    assert.equal(negGap, undefined, "negative_resell_gap 까지 못 가야");
  });
});

describe("Wave 249 — band-aware fallback 후 정상 매물 처리 (Wave 247.2 연동)", () => {
  it("Wave 247.2 band-aware fallback 으로 skuMedian 채워진 매물 → 정상 pool 진입", () => {
    // Wave 247.2 (band-aware) 후 production 의 16% sku_median=0 → 0% 감소.
    // 그 fallback 으로 채워진 skuMedian 가 양수 & price < skuMedian 인 매물은 정상 pool 진입.
    const result = buildCandidatePoolRows({
      rows: [{ ...baseRow, price: 100000, skuMedian: 148000 }],
      parsedByPid: baseParsed,
      catalogById,
      categoryReadiness,
      now: new Date().toISOString(),
    });
    assert.equal(result.entries.length, 1, "정상 매물 pool 진입");
    assert.equal(
      result.invalidations.filter(
        (i) => i.reason === "sku_median_unavailable" || i.reason === "negative_resell_gap",
      ).length,
      0,
      "두 신규 gate 차단 X",
    );
  });
});
