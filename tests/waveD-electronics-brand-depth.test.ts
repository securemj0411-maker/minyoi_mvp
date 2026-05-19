// Wave D (2026-05-20): category-brand-depth.ts (smartphone/tablet/laptop) detect 헬퍼 회귀 보호.
//   - shoe Wave A / clothing Wave B 와 동일 헬퍼 (detectBrandDepth) 사용 — UI 변경 0
//   - 전자제품 특성: 가품 거의 X. counterfeitChecks 는 "부품/잠금/IMEI 변별" 용도
//   - galaxy- prefix 가 smartphone / tablet (tab) / laptop (book) 에 모두 등장 →
//     skuId prefix 가 cross-category 로 잘못 매칭되면 안 됨 (회귀 보호 케이스 포함)

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { detectBrandDepth, CATEGORY_BRAND_DEPTH } from "../src/lib/category-brand-depth";

describe("category-brand-depth smartphone", () => {
  it("skuId prefix matches Apple iPhone", () => {
    const match = detectBrandDepth("smartphone", {
      skuId: "iphone-15-pro-max-256-self",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "apple-iphone");
    assert.equal(match?.brand.counterfeitRisk, "low");
    assert.ok(match!.brand.counterfeitChecks.length >= 3, "must have multiple part/lock checks");
  });

  it("iphone checks mention '부품 및 서비스 이력' (iOS 16.4+)", () => {
    const match = detectBrandDepth("smartphone", {
      skuId: "iphone-16-pro",
      skuName: null,
      name: null,
    });
    assert.ok(match);
    const checksText = match!.brand.counterfeitChecks.join(" ");
    assert.ok(checksText.includes("부품 및 서비스 이력"), "must mention 부품 및 서비스 이력");
    assert.ok(checksText.includes("checkcoverage.apple.com"), "must mention Apple official check site");
    assert.ok(checksText.includes("*#06#"), "must mention IMEI dial code");
  });

  it("iphone marketRisks mention iCloud Activation Lock", () => {
    const match = detectBrandDepth("smartphone", {
      skuId: "iphone-15-pro",
      skuName: null,
      name: null,
    });
    assert.ok(match);
    const text = match!.brand.marketRisks.join(" ");
    assert.ok(text.includes("iCloud") && text.includes("Activation Lock"), "must mention iCloud Activation Lock");
  });

  it("skuId prefix matches Samsung Galaxy S / Z / Note", () => {
    const s = detectBrandDepth("smartphone", { skuId: "galaxy-s24-ultra", skuName: null, name: null });
    const z = detectBrandDepth("smartphone", { skuId: "galaxy-z-flip-6", skuName: null, name: null });
    const n = detectBrandDepth("smartphone", { skuId: "galaxy-note20-ultra", skuName: null, name: null });
    assert.equal(s?.brandKey, "samsung-galaxy");
    assert.equal(z?.brandKey, "samsung-galaxy");
    assert.equal(n?.brandKey, "samsung-galaxy");
  });

  it("galaxy checks mention FRP lock", () => {
    const match = detectBrandDepth("smartphone", {
      skuId: "galaxy-s24-ultra",
      skuName: null,
      name: null,
    });
    assert.ok(match);
    const text = [
      ...match!.brand.counterfeitChecks,
      ...match!.brand.marketRisks,
    ].join(" ");
    assert.ok(text.includes("FRP"), "must mention FRP (Factory Reset Protection)");
  });

  it("keyword matches iPhone in Korean name", () => {
    const match = detectBrandDepth("smartphone", {
      skuId: null,
      skuName: null,
      name: "아이폰 15 프로 256 자급제",
    });
    assert.equal(match?.brandKey, "apple-iphone");
  });

  it("keyword matches Galaxy in Korean name", () => {
    const match = detectBrandDepth("smartphone", {
      skuId: null,
      skuName: null,
      name: "갤럭시 S24 울트라 256 자급제",
    });
    assert.equal(match?.brandKey, "samsung-galaxy");
  });

  it("returns null when smartphone brand has no signal", () => {
    const match = detectBrandDepth("smartphone", {
      skuId: null,
      skuName: "스마트폰 256GB",
      name: "스마트폰 단말",
    });
    assert.equal(match, null);
  });
});

describe("category-brand-depth tablet", () => {
  it("skuId prefix matches Apple iPad", () => {
    const match = detectBrandDepth("tablet", {
      skuId: "ipad-pro-13-m4-256-wifi",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "apple-ipad");
    assert.equal(match?.brand.counterfeitRisk, "low");
  });

  it("ipad marketRisks mention Apple Pencil compatibility", () => {
    const match = detectBrandDepth("tablet", {
      skuId: "ipad-air-m2-11-256-wifi",
      skuName: null,
      name: null,
    });
    assert.ok(match);
    const text = match!.brand.marketRisks.join(" ");
    assert.ok(text.includes("Pencil"), "must mention Apple Pencil compatibility");
  });

  it("ipad checks mention Activation Lock", () => {
    const match = detectBrandDepth("tablet", {
      skuId: "ipad-pro-11-m4-256-wifi",
      skuName: null,
      name: null,
    });
    assert.ok(match);
    const text = match!.brand.counterfeitChecks.join(" ");
    assert.ok(text.includes("Activation Lock"), "must mention Activation Lock");
  });

  it("skuId prefix matches Galaxy Tab", () => {
    const match = detectBrandDepth("tablet", {
      skuId: "galaxy-tab-s10-ultra-256-self",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "samsung-tab");
  });

  it("galaxy tab checks mention S펜", () => {
    const match = detectBrandDepth("tablet", {
      skuId: "galaxy-tab-s9-ultra",
      skuName: null,
      name: null,
    });
    assert.ok(match);
    const text = [
      ...match!.brand.counterfeitChecks,
      ...match!.brand.marketRisks,
    ].join(" ");
    assert.ok(text.includes("S펜"), "must mention S펜");
  });

  it("keyword matches iPad in Korean name", () => {
    const match = detectBrandDepth("tablet", {
      skuId: null,
      skuName: null,
      name: "아이패드 프로 M4 11인치 와이파이",
    });
    assert.equal(match?.brandKey, "apple-ipad");
  });

  it("keyword matches galaxy tab in Korean name", () => {
    const match = detectBrandDepth("tablet", {
      skuId: null,
      skuName: null,
      name: "갤럭시탭 S10 울트라 256",
    });
    assert.equal(match?.brandKey, "samsung-tab");
  });
});

describe("category-brand-depth laptop", () => {
  it("skuId prefix matches MacBook Air / Pro", () => {
    const air = detectBrandDepth("laptop", { skuId: "macbook-air-m3-13-256", skuName: null, name: null });
    const pro = detectBrandDepth("laptop", { skuId: "macbook-pro-14-m4-pro-24-512", skuName: null, name: null });
    assert.equal(air?.brandKey, "apple-macbook");
    assert.equal(pro?.brandKey, "apple-macbook");
  });

  it("macbook checks mention Coconut Battery + 부품 및 서비스 이력", () => {
    const match = detectBrandDepth("laptop", {
      skuId: "macbook-pro-14-m4-pro-24-512",
      skuName: null,
      name: null,
    });
    assert.ok(match);
    const checksText = match!.brand.counterfeitChecks.join(" ");
    assert.ok(checksText.includes("Coconut Battery"), "must mention Coconut Battery for cycle check");
    assert.ok(checksText.includes("부품 및 서비스 이력"), "must mention macOS Sonoma+ parts history");
  });

  it("macbook marketRisks mention 통합 메모리 (M1+ 램/SSD 자체 교체 불가)", () => {
    const match = detectBrandDepth("laptop", {
      skuId: "macbook-air-m2-13-256",
      skuName: null,
      name: null,
    });
    assert.ok(match);
    const text = match!.brand.marketRisks.join(" ");
    assert.ok(text.includes("통합 메모리") || text.includes("교체 불가"), "must mention unified memory (no self-upgrade)");
  });

  it("skuId prefix matches Galaxy Book", () => {
    const match = detectBrandDepth("laptop", {
      skuId: "galaxy-book-5-pro",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "samsung-book");
  });

  it("skuId prefix matches LG gram", () => {
    const match = detectBrandDepth("laptop", {
      skuId: "lg-gram-17-2024",
      skuName: null,
      name: null,
    });
    assert.equal(match?.brandKey, "lg-gram");
  });

  it("keyword matches MacBook in Korean name", () => {
    const match = detectBrandDepth("laptop", {
      skuId: null,
      skuName: null,
      name: "맥북 프로 14인치 M4 Pro 24GB",
    });
    assert.equal(match?.brandKey, "apple-macbook");
  });

  it("keyword matches LG gram in Korean name", () => {
    const match = detectBrandDepth("laptop", {
      skuId: null,
      skuName: null,
      name: "LG 그램 17인치 2024",
    });
    assert.equal(match?.brandKey, "lg-gram");
  });

  it("keyword matches gaming laptop (ASUS ROG)", () => {
    const match = detectBrandDepth("laptop", {
      skuId: null,
      skuName: null,
      name: "ASUS ROG Strix RTX 4070 게이밍 노트북",
    });
    assert.equal(match?.brandKey, "gaming-laptop");
  });

  it("gaming laptop checks mention GPU-Z + 발열/팬 + 사이클", () => {
    const match = detectBrandDepth("laptop", {
      skuId: null,
      skuName: null,
      name: "MSI RTX 4080 게이밍 노트북",
    });
    assert.ok(match);
    const text = [
      ...match!.brand.counterfeitChecks,
      ...match!.brand.marketRisks,
    ].join(" ");
    assert.ok(text.includes("GPU-Z"), "must mention GPU-Z verification");
    assert.ok(text.includes("팬") || text.includes("쿨링") || text.includes("발열"), "must mention cooling/thermal risk");
  });

  it("keyword matches ThinkPad", () => {
    const match = detectBrandDepth("laptop", {
      skuId: null,
      skuName: null,
      name: "레노보 ThinkPad X1 Carbon Gen 12",
    });
    assert.equal(match?.brandKey, "lenovo-thinkpad");
  });

  it("keyword matches Surface", () => {
    const match = detectBrandDepth("laptop", {
      skuId: null,
      skuName: null,
      name: "Microsoft Surface Pro 9 i7",
    });
    assert.equal(match?.brandKey, "microsoft-surface");
  });
});

describe("category-brand-depth Wave D registry + cross-category", () => {
  it("smartphone registry contains both brands", () => {
    const sp = CATEGORY_BRAND_DEPTH.smartphone;
    assert.ok(sp, "smartphone category registered");
    const required = ["apple-iphone", "samsung-galaxy"];
    for (const key of required) {
      assert.ok(sp.brands[key], `brand ${key} present`);
      assert.ok(sp.brands[key].label.length > 0, `${key} has label`);
      assert.ok(sp.brands[key].counterfeitChecks.length >= 3, `${key} has at least 3 checks`);
      assert.ok(sp.brands[key].marketRisks.length >= 2, `${key} has at least 2 market risks`);
    }
  });

  it("tablet registry contains both brands", () => {
    const tb = CATEGORY_BRAND_DEPTH.tablet;
    assert.ok(tb, "tablet category registered");
    const required = ["apple-ipad", "samsung-tab"];
    for (const key of required) {
      assert.ok(tb.brands[key], `brand ${key} present`);
      assert.ok(tb.brands[key].label.length > 0, `${key} has label`);
      assert.ok(tb.brands[key].counterfeitChecks.length >= 3, `${key} has at least 3 checks`);
    }
  });

  it("laptop registry contains all Wave D laptop brands", () => {
    const lp = CATEGORY_BRAND_DEPTH.laptop;
    assert.ok(lp, "laptop category registered");
    const required = [
      "apple-macbook",
      "samsung-book",
      "lg-gram",
      "microsoft-surface",
      "lenovo-thinkpad",
      "gaming-laptop",
    ];
    for (const key of required) {
      assert.ok(lp.brands[key], `brand ${key} present`);
      assert.ok(lp.brands[key].label.length > 0, `${key} has label`);
      assert.ok(lp.brands[key].counterfeitChecks.length >= 3, `${key} has at least 3 checks`);
    }
  });

  it("smartphone / tablet / laptop default fallback shapes are intact", () => {
    for (const cat of ["smartphone", "tablet", "laptop"] as const) {
      const data = CATEGORY_BRAND_DEPTH[cat];
      assert.ok(data.default.counterfeitChecks.length >= 1, `${cat} default has checks`);
      assert.ok(data.default.marketRisks.length >= 1, `${cat} default has market risks`);
      assert.ok(data.default.authentication.length >= 1, `${cat} default has authentication`);
    }
  });

  it("galaxy- prefix is split correctly across smartphone/tablet/laptop (no cross-category leak)", () => {
    // galaxy-tab-* must not match samsung-galaxy in smartphone category
    const tabInPhone = detectBrandDepth("smartphone", {
      skuId: "galaxy-tab-s10-ultra-256-self",
      skuName: null,
      name: null,
    });
    assert.equal(tabInPhone, null, "galaxy-tab-* must NOT match in smartphone");

    // galaxy-book-* must not match samsung-galaxy in smartphone category
    const bookInPhone = detectBrandDepth("smartphone", {
      skuId: "galaxy-book-5-pro",
      skuName: null,
      name: null,
    });
    assert.equal(bookInPhone, null, "galaxy-book-* must NOT match in smartphone");

    // galaxy-s* must not match samsung-tab in tablet category
    const phoneInTab = detectBrandDepth("tablet", {
      skuId: "galaxy-s24-ultra",
      skuName: null,
      name: null,
    });
    assert.equal(phoneInTab, null, "galaxy-s* must NOT match in tablet");

    // galaxy-z-* must not match anything in laptop category
    const flipInLaptop = detectBrandDepth("laptop", {
      skuId: "galaxy-z-flip-6",
      skuName: null,
      name: null,
    });
    assert.equal(flipInLaptop, null, "galaxy-z-* must NOT match in laptop");
  });

  it("Apple skuId prefixes split correctly (iphone/ipad/macbook stay in their lanes)", () => {
    // iphone-* in tablet → null
    assert.equal(
      detectBrandDepth("tablet", { skuId: "iphone-15-pro", skuName: null, name: null }),
      null,
      "iphone-* must NOT match in tablet",
    );
    // ipad-* in smartphone → null
    assert.equal(
      detectBrandDepth("smartphone", { skuId: "ipad-pro-13-m4-256-wifi", skuName: null, name: null }),
      null,
      "ipad-* must NOT match in smartphone",
    );
    // macbook-* in tablet → null
    assert.equal(
      detectBrandDepth("laptop", { skuId: "macbook-air-m3-13-256", skuName: null, name: null })?.brandKey,
      "apple-macbook",
      "macbook-* should match in laptop",
    );
    assert.equal(
      detectBrandDepth("tablet", { skuId: "macbook-air-m3-13-256", skuName: null, name: null }),
      null,
      "macbook-* must NOT match in tablet",
    );
  });

  it("shoe + clothing skuIds must not match in any Wave D category", () => {
    // Cross-wave: shoe/clothing SKUs must not leak into Wave D
    for (const cat of ["smartphone", "tablet", "laptop"] as const) {
      assert.equal(
        detectBrandDepth(cat, { skuId: "shoe-nike-jordan-1", skuName: null, name: null }),
        null,
        `shoe-nike-jordan-1 must NOT match in ${cat}`,
      );
      assert.equal(
        detectBrandDepth(cat, { skuId: "clothing-arcteryx-beta", skuName: null, name: null }),
        null,
        `clothing-arcteryx-beta must NOT match in ${cat}`,
      );
    }
  });

  it("Wave D categories all classified as low counterfeit risk (electronics rarely faked)", () => {
    for (const cat of ["smartphone", "tablet", "laptop"] as const) {
      const data = CATEGORY_BRAND_DEPTH[cat];
      assert.equal(data.default.counterfeitRisk, "low", `${cat} default risk should be low`);
      for (const [key, brand] of Object.entries(data.brands)) {
        assert.equal(brand.counterfeitRisk, "low", `${cat}.${key} risk should be low (electronics)`);
      }
    }
  });
});
