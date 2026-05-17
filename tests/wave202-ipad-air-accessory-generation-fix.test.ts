// Wave 202 (2026-05-18): "애플펜슬 N세대" 등 액세서리 generation 표기가
// iPad generation 으로 잘못 매칭되는 버그 fix regression test.
//
// 사용자 보고: "아이패드 에어 4 + 애플펜슬 2세대" → comparable_key 2_gen|a8x 잘못 박힘.
// 실제: Air 4 = a14. fix 후 4_gen|a14 박혀야.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseListingOptions } from "@/lib/option-parser";

function parse(title: string) {
  return parseListingOptions({
    title,
    description: "",
    category: "tablet",
    skuId: "ipad-air",
    skuName: "iPad Air",
  });
}

describe("Wave 202 — iPad generation parser: 액세서리 generation 노이즈 차단", () => {
  describe("iPad Air 4 + 애플펜슬 액세서리", () => {
    it("아이패드 에어4+애플펜슬2세대 → 4_gen|a14", () => {
      const r = parse("아이패드 에어4+애플펜슬2세대");
      assert.match(r.comparableKey ?? "", /\|4_gen\|a14\|/, `got: ${r.comparableKey}`);
    });

    it("아이패드 에어 4세대 64GB + 애플펜슬 2세대 → 4_gen|a14", () => {
      const r = parse("애플 아이패드 에어 4세대 64GB 실버 + 애플펜슬 2세대");
      assert.match(r.comparableKey ?? "", /\|4_gen\|a14\|/, `got: ${r.comparableKey}`);
    });

    it("아이패드 에어4 wifi 64gb 실버 + 애플펜슬 2세대 → 4_gen|a14", () => {
      const r = parse("아이패드 에어4 wifi 64gb 실버 + 애플펜슬 2세대");
      assert.match(r.comparableKey ?? "", /\|4_gen\|a14\|/, `got: ${r.comparableKey}`);
    });
  });

  describe("iPad Air 5 + 애플펜슬 액세서리", () => {
    it("아이패드 에어 5 +애플펜슬 2세대 → 5_gen|m1", () => {
      const r = parse("아이패드 에어 5 +애플펜슬 2세대 팔아요");
      assert.match(r.comparableKey ?? "", /\|5_gen\|m1\|/, `got: ${r.comparableKey}`);
    });

    it("아이패드 에어5 64GB 배터리 91% + 애플펜슬2세대 → 5_gen|m1", () => {
      const r = parse("아이패드 에어5 64GB 배터리 91% + 애플펜슬2세대");
      assert.match(r.comparableKey ?? "", /\|5_gen\|m1\|/, `got: ${r.comparableKey}`);
    });
  });

  describe("정상 매물 — 액세서리 없는 케이스 (회귀 검증)", () => {
    it("아이패드 에어4 64GB 스페이스 그레이 → 4_gen|a14", () => {
      const r = parse("아이패드 에어4 64GB 스페이스 그레이");
      assert.match(r.comparableKey ?? "", /\|4_gen\|a14\|/, `got: ${r.comparableKey}`);
    });

    it("아이패드 에어 5세대 명시 → 5_gen|m1", () => {
      const r = parse("아이패드 에어 5세대 64GB 스페이스그레이");
      assert.match(r.comparableKey ?? "", /\|5_gen\|m1\|/, `got: ${r.comparableKey}`);
    });

    it("진짜 iPad Air 2 → 2_gen|a8x (회귀 검증)", () => {
      const r = parse("아이패드 에어2 스페이스그레이 64기가/와이파이모델");
      assert.match(r.comparableKey ?? "", /\|2_gen\|a8x\|/, `got: ${r.comparableKey}`);
    });
  });

  describe("다른 액세서리 키워드", () => {
    it("아이패드 에어4 64GB + 매직 키보드 2세대 → 4_gen|a14", () => {
      const r = parse("아이패드 에어4 64GB + 매직 키보드 2세대");
      assert.match(r.comparableKey ?? "", /\|4_gen\|a14\|/, `got: ${r.comparableKey}`);
    });
  });
});
