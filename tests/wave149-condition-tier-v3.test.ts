// Wave 149 (2026-05-16): parseConditionTier 누락 패턴 11개 추가 검증.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseConditionTier } from "@/lib/parsers/wave92-fashion-mobility";

describe("Wave 149 — parseConditionTier 누락 패턴 11개", () => {
  // A급 누락
  it("A급: 한글 숫자 (두 번/세 번 신음)", () => {
    assert.equal(parseConditionTier("두 번 신었고 박스는 없어요"), "a_grade");
    assert.equal(parseConditionTier("세 번 신었어요"), "a_grade");
  });

  it("A급: 1회 착용 / 1번 신음 / 1번 착용", () => {
    assert.equal(parseConditionTier("1회 착용"), "a_grade");
    assert.equal(parseConditionTier("1번 신었어요"), "a_grade");
    assert.equal(parseConditionTier("2번 신었습니다"), "a_grade");
    assert.equal(parseConditionTier("3번 착용"), "a_grade");
  });

  it("A급: 집에서만 신어보고 (실내만)", () => {
    assert.equal(parseConditionTier("집에서만 신어보고 마음에 들지않아 판매"), "a_grade");
  });

  it("A급: 구매 후 N일", () => {
    assert.equal(parseConditionTier("구매 후 3일정도 신고 보관중"), "a_grade");
    assert.equal(parseConditionTier("구매 후 5일"), "a_grade");
  });

  it("A급: 발에 너무 맞지 않 / 선물받음 + 사이즈", () => {
    assert.equal(parseConditionTier("발에 너무 맞지 않아서 판매"), "a_grade");
    assert.equal(parseConditionTier("선물받았는데 발에 너무 맞지 않"), "a_grade");
  });

  // B급 누락
  it("B급: 상태 완전 좋 / 상태 정말 좋", () => {
    assert.equal(parseConditionTier("상태완전 좋구요"), "b_grade");
    assert.equal(parseConditionTier("상태 정말 좋은편입니다"), "b_grade");
  });

  it("B급: 상태 전반 양호 / 전반적으로 좋", () => {
    assert.equal(parseConditionTier("상태 전반 양호"), "b_grade");
    assert.equal(parseConditionTier("전반적으로 아주 좋은 상태"), "b_grade");
  });

  // C급 누락
  it("C급: 사용감 많/있", () => {
    assert.equal(parseConditionTier("사용감은 많습니다"), "c_grade");
    assert.equal(parseConditionTier("사용감이 많아"), "c_grade");
  });

  it("C급: 착용감 있/좀 있", () => {
    assert.equal(parseConditionTier("착용감 있음"), "c_grade");
    assert.equal(parseConditionTier("착용감 좀 있는 편"), "c_grade");
  });

  it("C급: 가죽 까짐 / 매쉬 해짐 / 바닥 까짐", () => {
    assert.equal(parseConditionTier("가죽 접히는 부분 까짐 조금"), "c_grade");
    assert.equal(parseConditionTier("앞 코 부분 매쉬 해짐"), "c_grade");
    assert.equal(parseConditionTier("내부 바닥 로고 지워짐"), "c_grade");
  });

  it("C급: 굽 슈구칠 (사용 흔적)", () => {
    assert.equal(parseConditionTier("굽도 슈구칠해서 거의그대로"), "c_grade");
  });

  // S급 누락
  it("S급: 박스 및 택째 그대로", () => {
    assert.equal(parseConditionTier("박스 및 택째 그대로 보관"), "s_grade");
    assert.equal(parseConditionTier("박스째 그대로"), "s_grade");
  });
});
