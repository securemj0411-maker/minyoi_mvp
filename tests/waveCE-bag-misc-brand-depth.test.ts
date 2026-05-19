// Wave C + E (2026-05-20): bag + watch + perfume + camera + drone + earphone + smartwatch
// brand depth 회귀 보호. Wave A/B/D test 패턴 따라 detectBrandDepth() 매칭 검증.

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { detectBrandDepth, CATEGORY_BRAND_DEPTH } from "../src/lib/category-brand-depth.ts";

describe("Wave C — bag brand-depth detection", () => {
  it("matches LV by skuId prefix", () => {
    const m = detectBrandDepth("bag", { skuId: "bag-lv-neverfull-mm", skuName: "LV Neverfull MM", name: "Louis Vuitton Neverfull" });
    assert.equal(m?.brandKey, "louis-vuitton");
    assert.equal(m?.brand.counterfeitRisk, "high");
  });

  it("matches Chanel by keyword 샤넬", () => {
    const m = detectBrandDepth("bag", { skuId: null, skuName: "Chanel Classic Flap", name: "샤넬 클래식 플랩 black" });
    assert.equal(m?.brandKey, "chanel");
  });

  it("matches Gucci Marmont by keyword", () => {
    const m = detectBrandDepth("bag", { skuId: null, skuName: "Gucci Marmont Small", name: "구찌 마몬트 small" });
    assert.equal(m?.brandKey, "gucci");
  });

  it("matches Hermes Birkin by keyword", () => {
    const m = detectBrandDepth("bag", { skuId: null, skuName: "Hermes Birkin 30", name: "에르메스 버킨 30" });
    assert.equal(m?.brandKey, "hermes");
  });

  it("matches Margiela Glam Slam by skuId prefix", () => {
    const m = detectBrandDepth("bag", { skuId: "bag-margiela-glam-slam", skuName: "Margiela Glam Slam", name: "마르지엘라 글램슬램" });
    assert.equal(m?.brandKey, "margiela-bag");
  });

  it("matches Supreme bag", () => {
    const m = detectBrandDepth("bag", { skuId: "bag-supreme-backpack", skuName: "Supreme Backpack", name: "슈프림 백팩" });
    assert.equal(m?.brandKey, "supreme-bag");
  });

  it("matches TNF (North Face) bag", () => {
    const m = detectBrandDepth("bag", { skuId: "bag-tnf-borealis", skuName: "TNF Borealis", name: "노스페이스 보레알리스" });
    assert.equal(m?.brandKey, "tnf-bag");
  });

  it("returns null on no match", () => {
    const m = detectBrandDepth("bag", { skuId: null, skuName: "random bag", name: "랜덤 가방" });
    assert.equal(m, null);
  });
});

describe("Wave E — watch brand-depth", () => {
  it("matches Rolex by keyword", () => {
    const m = detectBrandDepth("watch", { skuId: null, skuName: "Rolex Submariner", name: "롤렉스 서브마리너" });
    assert.equal(m?.brandKey, "rolex");
    assert.equal(m?.brand.counterfeitRisk, "high");
  });

  it("matches G-Shock by skuId prefix (low risk)", () => {
    const m = detectBrandDepth("watch", { skuId: "watch-casio-gshock-dw5600", skuName: "G-Shock DW5600", name: "지샥 5600" });
    assert.equal(m?.brandKey, "casio-gshock");
    assert.equal(m?.brand.counterfeitRisk, "low");
  });

  it("matches Seiko 5 Sports", () => {
    const m = detectBrandDepth("watch", { skuId: "watch-seiko-5-sports-srpd", skuName: "Seiko 5 Sports", name: "세이코 5 SRPD" });
    assert.equal(m?.brandKey, "seiko");
  });

  it("matches Patek Philippe by keyword", () => {
    const m = detectBrandDepth("watch", { skuId: null, skuName: "Patek Philippe Nautilus 5711", name: "파텍필립 노틸러스" });
    assert.equal(m?.brandKey, "patek-philippe");
    assert.equal(m?.brand.counterfeitRisk, "high");
  });

  it("matches AP Royal Oak", () => {
    const m = detectBrandDepth("watch", { skuId: null, skuName: "AP Royal Oak 15400", name: "오데마피게 로열오크" });
    assert.equal(m?.brandKey, "audemars-piguet");
  });
});

describe("Wave E — perfume brand-depth", () => {
  it("matches Tom Ford by skuId prefix", () => {
    const m = detectBrandDepth("perfume", { skuId: "tom-ford-tobacco-vanille-50", skuName: "Tom Ford Tobacco Vanille", name: "톰포드 토바코바닐" });
    assert.equal(m?.brandKey, "tom-ford");
  });

  it("matches Jo Malone English Pear", () => {
    const m = detectBrandDepth("perfume", { skuId: "jo-malone-english-pear-freesia-100", skuName: "Jo Malone English Pear", name: "조말론 잉글리시 페어" });
    assert.equal(m?.brandKey, "jo-malone");
  });

  it("matches Diptyque Do Son", () => {
    const m = detectBrandDepth("perfume", { skuId: "diptyque-do-son-75", skuName: "Diptyque Do Son", name: "딥티크 도손" });
    assert.equal(m?.brandKey, "diptyque");
  });

  it("matches Chanel No.5 by keyword (high risk)", () => {
    const m = detectBrandDepth("perfume", { skuId: null, skuName: "Chanel No 5 EDP", name: "샤넬 넘버5 EDP" });
    assert.equal(m?.brandKey, "chanel-perfume");
    assert.equal(m?.brand.counterfeitRisk, "high");
  });

  it("matches Dior Sauvage by keyword", () => {
    const m = detectBrandDepth("perfume", { skuId: null, skuName: "Dior Sauvage EDT", name: "디올 사우바주 EDT" });
    assert.equal(m?.brandKey, "dior-perfume");
  });

  it("matches Le Labo Santal 33", () => {
    const m = detectBrandDepth("perfume", { skuId: "le-labo-santal-33-50", skuName: "Le Labo Santal 33", name: "르라보 산탈 33" });
    assert.equal(m?.brandKey, "le-labo");
  });
});

describe("Wave E — camera brand-depth (all low risk)", () => {
  it("matches Sony A7M3", () => {
    const m = detectBrandDepth("camera", { skuId: "camera-sony-a7m3", skuName: "Sony A7M3", name: "소니 a7m3" });
    assert.equal(m?.brandKey, "sony-camera");
    assert.equal(m?.brand.counterfeitRisk, "low");
  });

  it("matches Canon EOS R6", () => {
    const m = detectBrandDepth("camera", { skuId: "camera-canon-eos-r6-mark-ii", skuName: "Canon R6 Mark II", name: "캐논 R6 Mark II" });
    assert.equal(m?.brandKey, "canon-camera");
  });

  it("matches Nikon Z9", () => {
    const m = detectBrandDepth("camera", { skuId: "camera-nikon-z9", skuName: "Nikon Z9", name: "니콘 Z9" });
    assert.equal(m?.brandKey, "nikon-camera");
  });

  it("matches Fujifilm X-T4", () => {
    const m = detectBrandDepth("camera", { skuId: "camera-fujifilm-x-t4", skuName: "Fujifilm X-T4", name: "후지 X-T4" });
    assert.equal(m?.brandKey, "fujifilm-camera");
  });

  it("matches Leica M11 by keyword (moderate)", () => {
    const m = detectBrandDepth("camera", { skuId: null, skuName: "Leica M11", name: "라이카 M11" });
    assert.equal(m?.brandKey, "leica");
    assert.equal(m?.brand.counterfeitRisk, "moderate");
  });
});

describe("Wave E — drone brand-depth", () => {
  it("matches DJI Mavic by skuId prefix", () => {
    const m = detectBrandDepth("drone", { skuId: "dji-mavic-3-pro", skuName: "DJI Mavic 3 Pro", name: "DJI 매빅 3 프로" });
    assert.equal(m?.brandKey, "dji-drone");
    assert.equal(m?.brand.counterfeitRisk, "low");
  });

  it("matches GoPro Hero by skuId prefix", () => {
    const m = detectBrandDepth("drone", { skuId: "gopro-hero-12", skuName: "GoPro Hero 12", name: "고프로 hero 12" });
    assert.equal(m?.brandKey, "gopro");
  });
});

describe("Wave E — earphone brand-depth", () => {
  it("matches AirPods Pro 2 by skuId prefix", () => {
    const m = detectBrandDepth("earphone", { skuId: "airpods-pro-2", skuName: "AirPods Pro 2", name: "에어팟 프로 2" });
    assert.equal(m?.brandKey, "airpods-pro");
    assert.equal(m?.brand.counterfeitRisk, "high");
  });

  it("matches AirPods 4 (non-Pro)", () => {
    const m = detectBrandDepth("earphone", { skuId: "airpods-4", skuName: "AirPods 4", name: "에어팟 4" });
    assert.equal(m?.brandKey, "airpods-other");
  });

  it("matches AirPods Max", () => {
    const m = detectBrandDepth("earphone", { skuId: "airpods-max", skuName: "AirPods Max", name: "에어팟 맥스" });
    assert.equal(m?.brandKey, "airpods-max");
  });

  it("matches Galaxy Buds", () => {
    const m = detectBrandDepth("earphone", { skuId: "galaxy-buds-3-pro", skuName: "Galaxy Buds 3 Pro", name: "갤럭시 버즈 3 프로" });
    assert.equal(m?.brandKey, "galaxy-buds");
  });

  it("matches Sony WF-1000XM5", () => {
    const m = detectBrandDepth("earphone", { skuId: "sony-wf-1000xm5", skuName: "Sony WF-1000XM5", name: "소니 1000XM5" });
    assert.equal(m?.brandKey, "sony-earphone");
  });

  it("matches Bose QC Ultra", () => {
    const m = detectBrandDepth("earphone", { skuId: "bose-qc-ultra", skuName: "Bose QC Ultra", name: "보스 QC Ultra" });
    assert.equal(m?.brandKey, "bose-earphone");
  });

  it("matches Beats Studio Buds", () => {
    const m = detectBrandDepth("earphone", { skuId: "beats-studio-buds-plus", skuName: "Beats Studio Buds+", name: "비츠 스튜디오 버즈+" });
    assert.equal(m?.brandKey, "beats");
  });
});

describe("Wave E — smartwatch brand-depth (all low risk)", () => {
  it("matches Apple Watch Series 10", () => {
    const m = detectBrandDepth("smartwatch", { skuId: "applewatch-series10", skuName: "Apple Watch Series 10", name: "애플워치 시리즈 10" });
    assert.equal(m?.brandKey, "applewatch");
    assert.equal(m?.brand.counterfeitRisk, "low");
  });

  it("matches Apple Watch Ultra", () => {
    const m = detectBrandDepth("smartwatch", { skuId: "applewatch-ultra", skuName: "Apple Watch Ultra", name: "애플워치 울트라" });
    assert.equal(m?.brandKey, "applewatch");
  });

  it("matches Galaxy Watch", () => {
    const m = detectBrandDepth("smartwatch", { skuId: "galaxywatch-7", skuName: "Galaxy Watch 7", name: "갤럭시 워치 7" });
    assert.equal(m?.brandKey, "galaxywatch");
  });

  it("matches Garmin Fenix by keyword", () => {
    const m = detectBrandDepth("smartwatch", { skuId: null, skuName: "Garmin Fenix 7X", name: "가민 fenix 7X" });
    assert.equal(m?.brandKey, "garmin");
  });
});

describe("Wave C+E — cross-category leak protection", () => {
  it("shoe skuId does NOT leak to bag", () => {
    const m = detectBrandDepth("bag", { skuId: "shoe-nike-jordan", skuName: "Jordan 1", name: "조던 1" });
    assert.equal(m, null);
  });

  it("watch-casio does NOT leak to perfume", () => {
    const m = detectBrandDepth("perfume", { skuId: "watch-casio-gshock-dw5600", skuName: "G-Shock", name: "지샥" });
    assert.equal(m, null);
  });

  it("airpods does NOT leak to smartwatch", () => {
    const m = detectBrandDepth("smartwatch", { skuId: "airpods-pro-2", skuName: "AirPods Pro 2", name: "에어팟 프로" });
    assert.equal(m, null);
  });

  it("applewatch does NOT leak to earphone", () => {
    const m = detectBrandDepth("earphone", { skuId: "applewatch-series10", skuName: "Apple Watch", name: "애플워치" });
    assert.equal(m, null);
  });

  it("registry has 12 categories", () => {
    const keys = Object.keys(CATEGORY_BRAND_DEPTH).sort();
    assert.deepEqual(keys, [
      "bag", "camera", "clothing", "drone", "earphone", "laptop", "perfume",
      "shoe", "smartphone", "smartwatch", "tablet", "watch",
    ]);
  });
});
