// Wave 208 (2026-05-18): "X용 + 액세서리" 호환 매물 일반 차단.
//
// 사용자 코멘트 #157 (pid 398121430): "DJI 오즈모 액션6 용 pov 렌즈" → Action 6 본체 SKU 매칭.
// 기존: catalog.ts DRONE_FILTER_ACCESSORY_NOISE drone-only — 다른 카테고리 누락.
// 근본 fix: parser detection 일반화 → 모든 카테고리 (camera/drone/tablet/laptop) 자동.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseListingOptions, FLAWED_NOTES } from "@/lib/option-parser";
import { POOL_BLOCK_NOTES } from "@/lib/condition-policy";

function parse(title: string, description = "", category: "drone" | "tablet" | "earphone" | "smartwatch" = "drone", skuId = "dji-osmo-action-6", skuName = "DJI Osmo Action 6") {
  return parseListingOptions({
    title,
    description,
    category,
    skuId,
    skuName,
  });
}

describe("Wave 208 — 호환 액세서리 매물 일반 차단", () => {
  describe("accessory_compatible_for_other_product 박힘 + flawed (모든 카테고리)", () => {
    it("'DJI 오즈모 액션6 용 pov 렌즈' → accessory + flawed (사용자 보고 매물)", () => {
      const r = parse("DJI 오즈모 액션6 용 pov 렌즈", "액션6 호환 렌즈입니다.");
      assert.ok(r.conditionNotes?.includes("accessory_compatible_for_other_product"), `accessory_compatible 박혀야 — got: ${JSON.stringify(r.conditionNotes)}`);
      assert.equal(r.conditionClass, "flawed");
    });

    it("'아이패드 프로 11 용 케이스' → accessory (드론 외 카테고리도 잡힘)", () => {
      const r = parse("아이패드 프로 11 용 케이스", "케이스 단품.", "tablet", "ipad-pro-11", "iPad Pro 11");
      assert.ok(r.conditionNotes?.includes("accessory_compatible_for_other_product"));
    });

    it("'갤럭시 워치6 용 충전기' → accessory", () => {
      const r = parse("갤럭시 워치6 용 충전기", "정품 충전기 단품.", "smartwatch", "galaxy-watch-6", "Galaxy Watch 6");
      assert.ok(r.conditionNotes?.includes("accessory_compatible_for_other_product"));
    });

    it("'아이폰 15 용 보호필름' → accessory", () => {
      const r = parse("아이폰 15 용 보호필름", "강화유리 보호필름.", "tablet", "iphone-15", "iPhone 15");
      assert.ok(r.conditionNotes?.includes("accessory_compatible_for_other_product"));
    });

    it("'에어팟 프로 2 용 케이블' → accessory (earphone도 적용)", () => {
      const r = parse("에어팟 프로 2 용 케이블", "USB-C 케이블.", "earphone", "airpods-pro-2-usbc", "AirPods Pro 2 USB-C");
      assert.ok(r.conditionNotes?.includes("accessory_compatible_for_other_product"));
    });
  });

  describe("regression — 본품 매물 false positive 차단", () => {
    it("'DJI 오즈모 액션6' (본품만) → accessory 박지 X", () => {
      const r = parse("DJI 오즈모 액션6 풀구성", "본체 + 박스 + 케이블.");
      assert.ok(!r.conditionNotes?.includes("accessory_compatible_for_other_product"));
    });

    it("'DJI 액션6 + 렌즈 포함' (본품 + 액세서리 묶음) → accessory 박지 X", () => {
      const r = parse("DJI 오즈모 액션6 (렌즈 포함)", "본체 + 렌즈 같이 드림.");
      assert.ok(!r.conditionNotes?.includes("accessory_compatible_for_other_product"), `본품 + 액세서리는 차단 X — got: ${JSON.stringify(r.conditionNotes)}`);
    });

    it("description '용 케이스 추가 증정' (title 안 잡힘) → accessory 박지 X (title-only)", () => {
      const r = parse("DJI 오즈모 액션6", "본체 + 가죽 용 케이스 추가 증정.");
      assert.ok(!r.conditionNotes?.includes("accessory_compatible_for_other_product"));
    });
  });

  describe("정책 검증", () => {
    it("accessory_compatible_for_other_product 는 FLAWED_NOTES 에 있음", () => {
      assert.ok((FLAWED_NOTES as readonly string[]).includes("accessory_compatible_for_other_product"));
    });
    it("accessory_compatible_for_other_product 는 POOL_BLOCK_NOTES 에 있음", () => {
      assert.ok((POOL_BLOCK_NOTES as readonly string[]).includes("accessory_compatible_for_other_product"));
    });
  });
});
