// Wave 154 (2026-05-16): condition_tier 추가 7개 누락 패턴

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseConditionTier } from "@/lib/parsers/wave92-fashion-mobility";

describe("Wave 154 — parseConditionTier 추가 7개", () => {
  it("A급: 1회사용 / N회 사용 (띄어쓰기 없음)", () => {
    assert.equal(parseConditionTier("1회사용 공홈 구매"), "a_grade");
    assert.equal(parseConditionTier("2회 사용"), "a_grade");
  });

  it("A급: 거의 신지 않 / 거의 신은 적 없", () => {
    assert.equal(parseConditionTier("거의 신지 않았습니다"), "a_grade");
    assert.equal(parseConditionTier("거의 신은 적 없"), "a_grade");
  });

  it("A급: 한번밖에 안 신 / 딱 한번밖에 안 신", () => {
    assert.equal(parseConditionTier("한번밖에 안신고"), "a_grade");
    assert.equal(parseConditionTier("딱 한번밖에 안신고"), "a_grade");
  });

  it("A급: 시착했던 / 시신했", () => {
    assert.equal(parseConditionTier("시착했던 제품"), "a_grade");
  });

  it("A급: 안 신어서 처분/판매", () => {
    assert.equal(parseConditionTier("흰 컨버스 안 신어서 처분"), "a_grade");
    assert.equal(parseConditionTier("안 신어서 판매"), "a_grade");
  });

  it("A급: 길들이기 위해 실내에서", () => {
    assert.equal(parseConditionTier("길들이기 위해 실내에서만 시착했던"), "a_grade");
  });

  it("C급: 사용감은 있 (조사 변형)", () => {
    assert.equal(parseConditionTier("사용감은 있습니다"), "c_grade");
    assert.equal(parseConditionTier("사용감이 있"), "c_grade");
  });

  it("C급: 헤짐 일부 / 헤짐 있", () => {
    assert.equal(parseConditionTier("뒤꿈치 쪽 헤짐 일부 있고"), "c_grade");
  });

  it("C급: 기스나 자국 / 이염 / 쓸린자국", () => {
    assert.equal(parseConditionTier("기스나 자국 등 사용감"), "c_grade");
    assert.equal(parseConditionTier("이염 있음"), "c_grade");
    assert.equal(parseConditionTier("앞코 쓸린자국"), "c_grade");
  });
});
