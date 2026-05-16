// Wave 150 (2026-05-16): parseConditionTier 추가 8개 누락 패턴.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseConditionTier } from "@/lib/parsers/wave92-fashion-mobility";

describe("Wave 150 — parseConditionTier 추가 8개", () => {
  // A급
  it("A급: 새제품 단독", () => {
    assert.equal(parseConditionTier("245사이즈 새제품입니다"), "a_grade");
  });

  it("A급: 1-2회 착용제품", () => {
    assert.equal(parseConditionTier("1-2회 착용제품으로 바닥 그대로"), "a_grade");
  });

  // B급
  it("B급: 상태 괜찮", () => {
    assert.equal(parseConditionTier("상태 괜찮고 색상 사진 확인"), "b_grade");
  });

  it("B급: 거의 그대로 / 거이 그대로", () => {
    assert.equal(parseConditionTier("바닥 거이 그대로"), "b_grade");
    assert.equal(parseConditionTier("거의 그대로 입니다"), "b_grade");
  });

  it("B급: 쿠션감/착화감/착용감 좋", () => {
    assert.equal(parseConditionTier("쿠션감 좋습니다"), "b_grade");
    assert.equal(parseConditionTier("착화감 좋아서"), "b_grade");
    assert.equal(parseConditionTier("착용감 좋"), "b_grade");
  });

  it("B급: 95% 수준", () => {
    assert.equal(parseConditionTier("새 상품 대비 95% 수준"), "b_grade");
  });

  // C급
  it("C급: 튿어짐 / 갈라짐", () => {
    assert.equal(parseConditionTier("안쪽 튿어짐"), "c_grade");
    assert.equal(parseConditionTier("앞코 주름 가죽 갈라짐"), "c_grade");
  });

  it("C급: 미세 황변", () => {
    assert.equal(parseConditionTier("미세 황변이 군데 군데 작게"), "c_grade");
  });

  it("C급: 사용감 많음 (단독) / 얼룩과 사용감", () => {
    assert.equal(parseConditionTier("사용감 많음 305사이즈"), "c_grade");
    assert.equal(parseConditionTier("적당한 얼룩과 사용감이 있습니다"), "c_grade");
  });

  it("C급: 경련변화", () => {
    assert.equal(parseConditionTier("경련변화가 많이 들어간 신발"), "c_grade");
  });
});
