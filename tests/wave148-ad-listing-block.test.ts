// Wave 148 (2026-05-16): 광고/소매 매물 차단 검증.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCandidatePoolRows } from "@/lib/candidate-pool-builder";
import type { Sku } from "@/lib/catalog";

const SHOE_SKU: Sku = {
  id: "shoe-test",
  brand: "Nike",
  category: "shoe",
  modelName: "Test",
  aliases: [],
  mustContain: [],
  mustNotContain: [],
  msrpKrw: 200000,
};

const baseInput = {
  parsedByPid: new Map([
    [1, { comparable_key: "shoe|test|240|s_grade", category: "shoe", parse_confidence: 0.9, needs_review: false, condition_class: "mint" } as any],
  ]),
  catalogById: new Map([[SHOE_SKU.id, SHOE_SKU]]),
  categoryReadiness: new Map() as any,
  laneReadiness: new Map() as any,
  now: "2026-05-16T00:00:00Z",
};

function makeRow(opts: Partial<any> = {}) {
  return {
    pid: 1,
    price: 150000,
    skuId: SHOE_SKU.id,
    skuMedian: 150000,
    estimatedBuyCost: 150000,
    shippingFee: 3000,
    shippingFeeGeneral: 3000,
    saleStatus: "selling",
    score: 80,
    poolEligible: true,
    shopReviewCount: 100,
    shopReviewRating: 4.8,
    ...opts,
  };
}

describe("Wave 148 — 광고/소매 매물 차단", () => {
  it("'[구매하기] 클릭' 광고문 → 차단", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow({ descriptionPreview: "사이즈 : 230,235,240,245 [구매하기] 클릭하여 요청사항에 사이즈" })],
    });
    assert.match(result.invalidations[0].reason, /ad_or_retail/);
  });

  it("'행사할인특가 행사기간' → 차단", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow({ descriptionPreview: "뉴발란스 행사할인특가! 행사기간 후 가격 변동 있을 수 있음" })],
    });
    assert.match(result.invalidations[0].reason, /ad_or_retail/);
  });

  it("'배송 평균 3-7일' → 차단 (소매)", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow({ descriptionPreview: "배송 평균 3-7일 / 주문방법" })],
    });
    assert.match(result.invalidations[0].reason, /ad_or_retail/);
  });

  it("사이즈 4개+ 다중 표기 → 차단", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow({ descriptionPreview: "사이즈 220,225,230,235,240,245 모두 보유" })],
    });
    assert.match(result.invalidations[0].reason, /ad_or_retail/);
  });

  it("개인 매물 description (광고 패턴 없음) → 통과", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow({ descriptionPreview: "닥마 1460 블랙 270 사이즈 실착 1회. 박스 있어요" })],
    });
    const adReason = result.invalidations.find((i) => i.reason === "ad_or_retail_listing");
    assert.equal(adReason, undefined);
  });

  it("description null → 통과 (data 없으면 차단 X)", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow({ descriptionPreview: null })],
    });
    const adReason = result.invalidations.find((i) => i.reason === "ad_or_retail_listing");
    assert.equal(adReason, undefined);
  });

  it("사이즈 2-3개만 표기 → 통과 (정상 매물 가능)", () => {
    const result = buildCandidatePoolRows({
      ...baseInput,
      rows: [makeRow({ descriptionPreview: "사이즈 240, 245 보유 중. 개인 정리" })],
    });
    const adReason = result.invalidations.find((i) => i.reason === "ad_or_retail_listing");
    assert.equal(adReason, undefined);
  });
});
