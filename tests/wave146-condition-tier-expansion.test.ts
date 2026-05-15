// Wave 146 (2026-05-16): parseConditionTier 신발 흔한 표현 강화 검증.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseConditionTier } from "@/lib/parsers/wave92-fashion-mobility";

describe("Wave 146 — parseConditionTier 신발 표현 확장", () => {
  // S급 — 객관적 새상품
  it("S급: 박스 그대로", () => {
    assert.equal(parseConditionTier("박스 그대로 풀구성"), "s_grade");
    assert.equal(parseConditionTier("박스채로 드려요"), "s_grade");
  });

  it("S급: 신어본 적 없음", () => {
    assert.equal(parseConditionTier("신어본 적 없는 새상품"), "s_grade");
    assert.equal(parseConditionTier("신은 적 없음"), "s_grade");
  });

  it("S급: 풀박 새상품", () => {
    assert.equal(parseConditionTier("풀박 새상품"), "s_grade");
  });

  // A급 — 거의 새거
  it("A급: 시착만 (가게에서 신어봄)", () => {
    assert.equal(parseConditionTier("시착만 했어요"), "a_grade");
    assert.equal(parseConditionTier("시착함 한 번"), "a_grade");
  });

  it("A급: 실착 N회", () => {
    assert.equal(parseConditionTier("실착 1회"), "a_grade");
    assert.equal(parseConditionTier("실착 3회"), "a_grade");
    assert.equal(parseConditionTier("단 2회 착용"), "a_grade");
  });

  it("A급: 사이즈 미스/실패", () => {
    assert.equal(parseConditionTier("사이즈 미스로 판매"), "a_grade");
    assert.equal(parseConditionTier("사이즈 실패로 판매"), "a_grade");
    assert.equal(parseConditionTier("사이즈 안 맞아서"), "a_grade");
  });

  it("A급: 보관용 / 잠깐 신음", () => {
    assert.equal(parseConditionTier("보관만 했어요"), "a_grade");
    assert.equal(parseConditionTier("잠깐 신었어요"), "a_grade");
    assert.equal(parseConditionTier("잠깐 착용"), "a_grade");
  });

  it("A급: 한두번/한 두 번", () => {
    assert.equal(parseConditionTier("한 두 번 신었어요"), "a_grade");
    assert.equal(parseConditionTier("한두번 신은 것"), "a_grade");
  });

  // 셀러 표기 — 1단계 깎음
  it("셀러 S급 표기 → A급으로 깎음", () => {
    assert.equal(parseConditionTier("최상급 상품"), "a_grade");
    assert.equal(parseConditionTier("탑급 상품"), "a_grade");
    assert.equal(parseConditionTier("특A급"), "a_grade");
  });

  it("셀러 A급 표기 → B급 (상태 최상)", () => {
    assert.equal(parseConditionTier("상태 최상"), "b_grade");
  });

  // B급 — 사용감 적음
  it("B급: 상태 양호 / 9·10", () => {
    assert.equal(parseConditionTier("상태 양호합니다"), "b_grade");
    assert.equal(parseConditionTier("상태 양호 상태"), "b_grade");
    assert.equal(parseConditionTier("Condition: 9 / 10"), "b_grade");
  });

  it("B급: EXCELLENT / 컨디션 우수", () => {
    assert.equal(parseConditionTier("Condition: EXCELLENT"), "b_grade");
    assert.equal(parseConditionTier("컨디션 우수"), "b_grade");
  });

  it("B급: 4-9회 착용", () => {
    assert.equal(parseConditionTier("5회 정도 신었습니다"), "b_grade");
    assert.equal(parseConditionTier("4회 착용"), "b_grade");
  });

  it("B급: 깨끗", () => {
    assert.equal(parseConditionTier("깨끗하게 사용했어요"), "b_grade");
  });

  // C급 — 사용감 많음
  it("C급: 사용감 좀 있음", () => {
    assert.equal(parseConditionTier("사용감 좀 있는 편"), "c_grade");
  });

  it("C급: 약간의 오염/스크레치/앞코", () => {
    assert.equal(parseConditionTier("미드솔에 약간의 오염"), "c_grade");
    assert.equal(parseConditionTier("앞코 스크레치 조금"), "c_grade");
  });

  it("C급: 10회 이상 착용", () => {
    assert.equal(parseConditionTier("15회 정도 신은 것"), "c_grade");
    assert.equal(parseConditionTier("20회 착용"), "c_grade");
  });

  // reject — 손상
  it("reject: 수선 필요", () => {
    assert.equal(parseConditionTier("수선 필요한 상태"), "reject");
  });

  it("reject: 변형 심함", () => {
    assert.equal(parseConditionTier("변형 심함"), "reject");
  });

  // null — 표현 없음
  it("표현 없음 → null", () => {
    assert.equal(parseConditionTier("닥마 1460 블랙"), null);
    assert.equal(parseConditionTier("호카 본디 9 그레이"), null);
  });
});
