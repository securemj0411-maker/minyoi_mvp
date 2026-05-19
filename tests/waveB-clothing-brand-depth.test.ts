// Wave B (2026-05-20): category-brand-depth.ts (clothing) detect 헬퍼 회귀 보호.
//   - shoe Wave A 와 동일 헬퍼 (detectBrandDepth) 사용 — UI 변경 0
//   - clothing 카테고리 16 브랜드 매칭 + 분류 확인
//   - 외부 review 직접 인용된 Arcteryx Bird-aid / GORE-TEX 4면 박음질 포함

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { detectBrandDepth, CATEGORY_BRAND_DEPTH } from "../src/lib/category-brand-depth";

describe("category-brand-depth clothing", () => {
  it("skuId prefix matches arcteryx", () => {
    const match = detectBrandDepth("clothing", {
      skuId: "clothing-arcteryx-beta",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "arcteryx");
    assert.equal(match?.brand.counterfeitRisk, "high");
  });

  it("arcteryx checks include Bird-aid label (외부 review 직접 인용)", () => {
    const match = detectBrandDepth("clothing", {
      skuId: "clothing-arcteryx",
      skuName: null,
      name: null,
    });
    assert.ok(match);
    const checksText = match!.brand.counterfeitChecks.join(" ");
    assert.ok(checksText.includes("Bird-aid") || checksText.includes("BIRD AID"), "must mention Bird-aid label");
    assert.ok(checksText.includes("GORE-TEX") && checksText.includes("4면"), "must mention GORE-TEX 4면 박음질");
  });

  it("stoneisland checks include Certilogo verification", () => {
    const match = detectBrandDepth("clothing", {
      skuId: "clothing-stoneisland-shadow",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "stoneisland");
    const allText = [
      ...match!.brand.counterfeitChecks,
      ...match!.brand.authentication,
    ].join(" ");
    assert.ok(allText.toLowerCase().includes("certilogo"), "must mention Certilogo");
  });

  it("supreme checks include BOX logo + Futura font", () => {
    const match = detectBrandDepth("clothing", {
      skuId: null,
      skuName: null,
      name: "슈프림 박스로고 티셔츠",
    });
    assert.equal(match?.brandKey, "supreme");
    const checksText = match!.brand.counterfeitChecks.join(" ");
    assert.ok(checksText.includes("BOX") || checksText.includes("Box"), "must mention BOX logo");
  });

  it("bape detects shark hoodie + camo pattern", () => {
    const match = detectBrandDepth("clothing", {
      skuId: "clothing-bape-shark-hoodie",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "bape");
    const checksText = match!.brand.counterfeitChecks.join(" ");
    assert.ok(checksText.includes("Shark") || checksText.includes("샤크") || checksText.includes("카모"), "must mention shark/카모");
  });

  it("keyword matches stussy in Korean name", () => {
    const match = detectBrandDepth("clothing", {
      skuId: null,
      skuName: null,
      name: "스투시 기본 티셔츠 검정 L",
    });
    assert.equal(match?.brandKey, "stussy");
  });

  it("fog essentials matches both skuId variants", () => {
    const a = detectBrandDepth("clothing", { skuId: "clothing-fog-essentials-hoodie", skuName: null, name: null });
    const b = detectBrandDepth("clothing", { skuId: "clothing-fog-essentials", skuName: null, name: null });
    assert.equal(a?.brandKey, "fog-essentials");
    assert.equal(b?.brandKey, "fog-essentials");
  });

  it("patagonia detects Retro-X / Deep Pile", () => {
    const match = detectBrandDepth("clothing", {
      skuId: "clothing-patagonia-retro-x",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "patagonia");
  });

  it("tnf detects supreme collab", () => {
    const match = detectBrandDepth("clothing", {
      skuId: "clothing-tnf-supreme-mountain-jacket",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "tnf");
    const checksText = match!.brand.counterfeitChecks.join(" ");
    assert.ok(checksText.includes("Supreme") || checksText.includes("콜라보"), "should mention Supreme collab risk");
  });

  it("polo ralph lauren detects pony + RRL prefix", () => {
    const polo = detectBrandDepth("clothing", { skuId: "clothing-polo-pony-tee", skuName: null, name: null });
    const rrl = detectBrandDepth("clothing", { skuId: "clothing-polo-rrl-denim", skuName: null, name: null });
    assert.equal(polo?.brandKey, "polo-ralph-lauren");
    assert.equal(rrl?.brandKey, "polo-ralph-lauren");
  });

  it("mlb cap detects Korean+English keywords", () => {
    const a = detectBrandDepth("clothing", { skuId: "clothing-mlb-cap", skuName: null, name: null });
    const b = detectBrandDepth("clothing", { skuId: null, skuName: null, name: "MLB 양키스 NY 캡 블랙" });
    assert.equal(a?.brandKey, "mlb-cap");
    assert.equal(b?.brandKey, "mlb-cap");
  });

  it("maison margiela detects MM6 + main line", () => {
    const a = detectBrandDepth("clothing", { skuId: null, skuName: null, name: "메종 마르지엘라 데님 셔츠" });
    const b = detectBrandDepth("clothing", { skuId: null, skuName: null, name: "MM6 후드티 그레이" });
    assert.equal(a?.brandKey, "maison-margiela");
    assert.equal(b?.brandKey, "maison-margiela");
  });

  it("acne studios detects face scarf", () => {
    const match = detectBrandDepth("clothing", {
      skuId: "clothing-acne-jacket-coat",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "acne");
  });

  it("returns null when clothing brand has no signal", () => {
    const match = detectBrandDepth("clothing", {
      skuId: null,
      skuName: "남성 면 티셔츠",
      name: "남성 면 티셔츠 L",
    });
    assert.equal(match, null);
  });

  it("clothing registry contains all Wave B brands", () => {
    const clothing = CATEGORY_BRAND_DEPTH.clothing;
    assert.ok(clothing, "clothing category registered");
    const required = [
      "arcteryx",
      "stoneisland",
      "moncler",
      "supreme",
      "stussy",
      "bape",
      "palace",
      "carhartt",
      "fog-essentials",
      "patagonia",
      "tnf",
      "polo-ralph-lauren",
      "lacoste",
      "mlb-cap",
      "acne",
      "maison-margiela",
    ];
    for (const key of required) {
      assert.ok(clothing.brands[key], `brand ${key} present`);
      assert.ok(clothing.brands[key].label.length > 0, `${key} has label`);
      assert.ok(clothing.brands[key].counterfeitChecks.length >= 3, `${key} has at least 3 checks`);
    }
  });

  it("clothing default fallback shape is intact", () => {
    const clothing = CATEGORY_BRAND_DEPTH.clothing;
    assert.ok(clothing.default.counterfeitChecks.length >= 1);
    assert.ok(clothing.default.marketRisks.length >= 1);
    assert.ok(clothing.default.authentication.length >= 1);
  });

  it("shoe + clothing cross-category — same helper, no leak", () => {
    // shoe skuId 가 clothing 으로 false-match 되면 안 됨
    const wrong = detectBrandDepth("clothing", {
      skuId: "shoe-nike-jordan-1",
      skuName: null,
      name: null,
    });
    assert.equal(wrong, null, "shoe skuId must not match in clothing category");

    // clothing skuId 가 shoe 로 false-match 되면 안 됨
    const wrong2 = detectBrandDepth("shoe", {
      skuId: "clothing-arcteryx-beta",
      skuName: null,
      name: null,
    });
    assert.equal(wrong2, null, "clothing skuId must not match in shoe category");
  });
});
