// Wave 151 (2026-05-16): parser 9개 누락 패턴
// Wave 152 (2026-05-16): 가품 detection v3 tier 3 (이미지 + desc 길이)

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseConditionTier } from "@/lib/parsers/wave92-fashion-mobility";
import { buildCandidatePoolRows } from "@/lib/candidate-pool-builder";
import type { Sku } from "@/lib/catalog";

describe("Wave 151 — parser 9개 추가", () => {
  it("A급: 시착 1회 / 시착 N회", () => {
    assert.equal(parseConditionTier("크림 구매, 시착 1회"), "a_grade");
    assert.equal(parseConditionTier("시착 2회"), "a_grade");
  });

  it("A급: 잠깐이지만 착용", () => {
    assert.equal(parseConditionTier("잠깐이지만 착용을 했던거라"), "a_grade");
  });

  it("A급: 잘 안 신게 / 안 신는", () => {
    assert.equal(parseConditionTier("잘 안 신게 되어서 판매"), "a_grade");
    assert.equal(parseConditionTier("안 신는 신발 처분"), "a_grade");
  });

  it("A급: 커서 팔아요 / 작아서 판매", () => {
    assert.equal(parseConditionTier("크림 구매 커서 팔아요"), "a_grade");
    assert.equal(parseConditionTier("사이즈 작아서 판매"), "a_grade");
  });

  it("B급: 상태는 좋 / 상태가 좋", () => {
    assert.equal(parseConditionTier("상태는 좋습니다"), "b_grade");
    assert.equal(parseConditionTier("상태가 좋아요"), "b_grade");
  });

  it("C급: 사용있 / 뒷굽 사용 / 밑창 지저분", () => {
    assert.equal(parseConditionTier("뒷굽 사용 있습니다"), "c_grade");
    assert.equal(parseConditionTier("밑창 지저분한건 닦았"), "c_grade");
  });

  it("reject: 본드로 붙여 / 깔창 분실", () => {
    assert.equal(parseConditionTier("본드로 붙여야 함"), "reject");
    assert.equal(parseConditionTier("내부 깔창 분실"), "reject");
  });
});

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

function makeBaseInput() {
  return {
    parsedByPid: new Map([
      [1, { comparable_key: "shoe|test|240", category: "shoe", parse_confidence: 0.9, needs_review: false } as any],
    ]),
    catalogById: new Map([[SHOE_SKU.id, SHOE_SKU]]),
    categoryReadiness: new Map() as any,
    laneReadiness: new Map() as any,
    now: "2026-05-16T00:00:00Z",
  };
}

function makeRow(opts: Partial<any> = {}) {
  return {
    pid: 1,
    price: 55000,  // 200k * 0.275 (tier 3 zone)
    skuId: SHOE_SKU.id,
    skuMedian: 150000,
    estimatedBuyCost: 55000,
    shippingFee: 3000,
    shippingFeeGeneral: 3000,
    saleStatus: "selling",
    score: 80,
    poolEligible: true,
    shopReviewCount: 3,  // 신뢰도 낮음
    shopReviewRating: 4.0,
    descriptionPreview: "230 사이즈",  // 짧음
    imageCount: 1,  // 이미지 1장
    ...opts,
  };
}

describe("Wave 152 — 가품 floor tier 3 (이미지 + desc 길이)", () => {
  it("Tier 3 차단: 30% 이하 + 이미지 1장 + 짧은 desc + 신뢰도 낮음", () => {
    const result = buildCandidatePoolRows({
      ...makeBaseInput(),
      rows: [makeRow()],
    });
    assert.match(result.invalidations[0].reason, /fake_suspect_t3/);
  });

  it("이미지 2장+ → 통과 (정상 매물 가능)", () => {
    const result = buildCandidatePoolRows({
      ...makeBaseInput(),
      rows: [makeRow({ imageCount: 5 })],
    });
    const fakeReason = result.invalidations.find((i) => i.reason.startsWith("fake_suspect_t3"));
    assert.equal(fakeReason, undefined);
  });

  it("긴 desc → 통과", () => {
    const result = buildCandidatePoolRows({
      ...makeBaseInput(),
      rows: [makeRow({
        descriptionPreview: "정성껏 신었고 상태 좋습니다. 박스도 있고 미세한 사용감만 있어요. 사진 참고 부탁드립니다",
      })],
    });
    const fakeReason = result.invalidations.find((i) => i.reason.startsWith("fake_suspect_t3"));
    assert.equal(fakeReason, undefined);
  });

  it("신뢰도 높은 셀러 → 통과", () => {
    const result = buildCandidatePoolRows({
      ...makeBaseInput(),
      rows: [makeRow({ shopReviewCount: 100, shopReviewRating: 4.9 })],
    });
    const fakeReason = result.invalidations.find((i) => i.reason.startsWith("fake_suspect_t3"));
    assert.equal(fakeReason, undefined);
  });
});
