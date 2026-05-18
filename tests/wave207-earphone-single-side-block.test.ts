// Wave 207 (2026-05-18): earphone single-side 매물 차단.
//
// 사용자 코멘트 #153 (pid 343583659): "에어팟프로2세대 C타입 왼쪽, A-급" → AirPods Pro 2 본체 SKU 매칭.
// 무선 이어폰류 한쪽만 매물 = 단품 = 정상 거래 X (페어 시세 sample 부풀림).
// 근본 fix: earphone single_side_only note → FLAWED + POOL_BLOCK.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseListingOptions, FLAWED_NOTES } from "@/lib/option-parser";
import { POOL_BLOCK_NOTES } from "@/lib/condition-policy";

function parse(title: string, description = "", category: "earphone" | "smartphone" = "earphone") {
  return parseListingOptions({
    title,
    description,
    category,
    skuId: "airpods-pro-2-usbc",
    skuName: "AirPods Pro 2 (USB-C)",
  });
}

describe("Wave 207 — earphone single-side 매물 차단", () => {
  describe("single_side_only 박힘 + flawed 분류", () => {
    it("'에어팟프로2세대 C타입 왼쪽, A-급' → single_side_only + flawed (사용자 보고 매물)", () => {
      const r = parse("에어팟프로2세대 C타입 왼쪽, A-급", "왼쪽 한쪽만 판매.");
      assert.ok(r.conditionNotes?.includes("single_side_only"), `single_side_only 박혀야 — got: ${JSON.stringify(r.conditionNotes)}`);
      assert.equal(r.conditionClass, "flawed");
    });

    it("'에어팟 오른쪽' → single_side_only", () => {
      const r = parse("에어팟 프로 2 오른쪽", "");
      assert.ok(r.conditionNotes?.includes("single_side_only"));
    });

    it("'에어팟 왼쪽만' → single_side_only", () => {
      const r = parse("에어팟 프로 왼쪽만 팝니다", "");
      assert.ok(r.conditionNotes?.includes("single_side_only"));
    });

    it("'에어팟 R 유닛' → single_side_only", () => {
      const r = parse("에어팟 프로 R 유닛", "");
      assert.ok(r.conditionNotes?.includes("single_side_only"));
    });

    it("'한쪽만 판매' → single_side_only", () => {
      const r = parse("에어팟 프로 2 한쪽만 판매", "");
      assert.ok(r.conditionNotes?.includes("single_side_only"));
    });
  });

  describe("regression — 정상 페어 매물 false positive 차단", () => {
    it("'에어팟 프로 2 풀구성' → single_side_only 박지 X", () => {
      const r = parse("에어팟 프로 2 USB-C 풀구성", "양쪽 다 정상.");
      assert.ok(!r.conditionNotes?.includes("single_side_only"));
    });

    it("description '왼쪽 이어폰 잘 됨' (title 없음) → false positive X (title-only)", () => {
      const r = parse("에어팟 프로 2 USB-C 풀세트", "왼쪽 이어폰 잘 들립니다. 페어링 정상.");
      assert.ok(!r.conditionNotes?.includes("single_side_only"), `description-only 매칭 차단 — got: ${JSON.stringify(r.conditionNotes)}`);
    });

    it("smartphone 카테고리 'X 왼쪽 단추' (다른 의미) → single_side_only 박지 X (earphone-only)", () => {
      const r = parse("아이폰 15 왼쪽 단추", "왼쪽 단추 약간 흠집.", "smartphone");
      assert.ok(!r.conditionNotes?.includes("single_side_only"));
    });
  });

  describe("정책 검증", () => {
    it("single_side_only 는 FLAWED_NOTES 에 있음", () => {
      assert.ok((FLAWED_NOTES as readonly string[]).includes("single_side_only"));
    });
    it("single_side_only 는 POOL_BLOCK_NOTES 에 있음", () => {
      assert.ok((POOL_BLOCK_NOTES as readonly string[]).includes("single_side_only"));
    });
  });
});
