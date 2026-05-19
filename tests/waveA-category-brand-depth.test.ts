// Wave A (2026-05-20): category-brand-depth.ts (shoe) detect 헬퍼 회귀 보호.
//   - skuId prefix 매칭 우선
//   - skuName / name keyword 매칭 fallback
//   - 매칭 실패 시 null
//   - 후속 wave (B clothing, C bag, …)에서 같은 패턴 따를 수 있게 골격 고정.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { detectBrandDepth, CATEGORY_BRAND_DEPTH } from "../src/lib/category-brand-depth";

describe("category-brand-depth shoe", () => {
  it("skuId prefix matches nike jordan", () => {
    const match = detectBrandDepth("shoe", {
      skuId: "shoe-nike-jordan-1-low-bred",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "nike-jordan");
    assert.equal(match?.brand.counterfeitRisk, "high");
    assert.ok(match!.brand.counterfeitChecks.length >= 3, "must have multiple checks");
  });

  it("skuId prefix matches nike dunk", () => {
    const match = detectBrandDepth("shoe", {
      skuId: "shoe-nike-dunk-low-panda",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "nike-dunk");
  });

  it("skuId prefix matches new balance variants", () => {
    const match = detectBrandDepth("shoe", {
      skuId: "shoe-newbalance-990v6",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "newbalance");
    assert.equal(match?.brand.counterfeitRisk, "high");
  });

  it("keyword matches adidas yeezy in Korean name", () => {
    const match = detectBrandDepth("shoe", {
      skuId: null,
      skuName: null,
      name: "아디다스 이지 부스트 350 V2 자브라",
    });
    assert.equal(match?.brandKey, "adidas-yeezy");
  });

  it("keyword matches converse chuck in English skuName", () => {
    const match = detectBrandDepth("shoe", {
      skuId: null,
      skuName: "Converse Chuck 70 High Black",
      name: null,
    });
    assert.equal(match?.brandKey, "converse-chuck");
  });

  it("hoka classified as low risk (no fake market)", () => {
    const match = detectBrandDepth("shoe", {
      skuId: "shoe-hoka-bondi-9",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "hoka");
    assert.equal(match?.brand.counterfeitRisk, "low");
  });

  it("returns null when category is shoe but brand has no signal", () => {
    const match = detectBrandDepth("shoe", {
      skuId: null,
      skuName: "운동화 245",
      name: "운동화 245 사이즈",
    });
    assert.equal(match, null);
  });

  it("returns null when category is unknown", () => {
    const match = detectBrandDepth("monitor", {
      skuId: "monitor-lg-27ml600",
      skuName: "LG 27ML600",
      name: null,
    });
    assert.equal(match, null);
  });

  it("returns null when category is missing", () => {
    const match = detectBrandDepth(null, {
      skuId: "shoe-nike-jordan-1",
      skuName: null,
      name: null,
    });
    assert.equal(match, null);
  });

  it("shoe registry contains all Wave A brands", () => {
    const shoe = CATEGORY_BRAND_DEPTH.shoe;
    assert.ok(shoe, "shoe category registered");
    const required = [
      "nike-jordan",
      "nike-dunk",
      "nike-airforce",
      "nike-airmax",
      "nike-pegasus",
      "adidas-yeezy",
      "adidas-samba",
      "adidas-gazelle",
      "newbalance",
      "converse-chuck",
      "vans-oldskool",
      "ugg-classic",
      "drmartens-1460",
      "puma",
      "hoka",
      "asics",
    ];
    for (const key of required) {
      assert.ok(shoe.brands[key], `brand ${key} present`);
      assert.ok(shoe.brands[key].label.length > 0, `${key} has label`);
      assert.ok(shoe.brands[key].detectKeywords.length > 0, `${key} has detect keywords`);
    }
  });

  it("default fallback shape is intact (used when brand not detected)", () => {
    const shoe = CATEGORY_BRAND_DEPTH.shoe;
    assert.ok(shoe.default.counterfeitChecks.length >= 1);
    assert.ok(shoe.default.marketRisks.length >= 1);
    assert.ok(shoe.default.authentication.length >= 1);
  });
});
