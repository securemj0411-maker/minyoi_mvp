// Wave 254.6 (2026-05-20): parseClothingProductType / parseBagProductType regex 우선순위 정정.
//   사용자 발견 root cause — pid 331382713 "빔즈 노스페이스 눕시 쇼츠":
//     기존: 모델명 (눕시/nuptse) 이 product_type 키워드 (쇼츠/shorts) 보다 먼저 매칭 → down_jacket 잘못.
//     fix: 명시적 product_type 키워드 (쇼츠/모자/벨트/지갑/원피스/스커트) 가 모델명 기반 패턴보다 먼저.
//   systemic 영향: clothing-tnf-* / clothing-polo-rrl-* / clothing-fog-* + 쇼츠/모자/벨트 매물.
//   catalog 2차 safety: jacket/down_jacket/coat SKU 가 명백 product_type 키워드 매물 자동 reject.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseListingOptions } from "@/lib/option-parser";
import { ruleMatch } from "@/lib/catalog";

describe("Wave 254.6 — clothing product_type regex 우선순위", () => {
  describe("user-reported root case", () => {
    it("pid 331382713 — '빔즈 노스페이스 눕시 쇼츠 M' → shorts (down_jacket X)", () => {
      const result = parseListingOptions({
        title: "빔즈 노스페이스 눕시 쇼츠 M 사이즈 판매합니다",
        description: "제품 : 빔즈 노스페이스 Nuptse Short",
        skuId: null, // catalog mustNotContain 가 reject → skuId null 가능
        skuName: null,
        category: "clothing",
      });
      const productType = (result.parsedJson as any).clothing_product_type;
      assert.equal(productType, "shorts",
        `parseClothingProductType returned ${productType} for "눕시 쇼츠" (expected shorts)`);
    });
  });

  describe("systemic — 모델명 (jacket/down_jacket) + product_type 키워드", () => {
    const cases = [
      { title: "노스페이스 눕시 쇼츠 M", expected: "shorts", reason: "down_jacket 모델명 + shorts" },
      { title: "노스페이스 마운틴 자켓 쇼츠", expected: "shorts", reason: "jacket 모델명 + shorts" },
      { title: "노스페이스 데날리 모자", expected: "cap", reason: "jacket 모델명 + cap" },
      { title: "슈프림 노스페이스 모자", expected: "cap", reason: "supreme collab + cap" },
      { title: "폴로 RRL 데님 쇼츠", expected: "shorts", reason: "denim 모델명 + shorts" },
      { title: "폴로 랄프로렌 벨트", expected: "belt", reason: "폴로 + belt (polo_shirt 매칭 X)" },
      { title: "구찌 다운 베스트 지갑", expected: "wallet", reason: "down_jacket 키워드 + wallet" },
      { title: "프라다 스커트", expected: "skirt", reason: "skirt 정확 매칭" },
      { title: "샤넬 원피스", expected: "dress", reason: "dress 정확 매칭" },
    ];
    for (const { title, expected, reason } of cases) {
      it(`"${title}" → ${expected} (${reason})`, () => {
        const result = parseListingOptions({
          title,
          description: title,
          skuId: null,
          skuName: null,
          category: "clothing",
        });
        const productType = (result.parsedJson as any).clothing_product_type;
        assert.equal(productType, expected, `expected ${expected}, got ${productType}`);
      });
    }
  });

  describe("정상 매물 — 모델명 단독 매칭 (regression 검증)", () => {
    const cases = [
      { title: "노스페이스 눕시 1996", expected: "down_jacket" },
      { title: "노스페이스 마운틴 자켓 고어텍스", expected: "jacket" },
      { title: "노스페이스 데날리 플리스", expected: "jacket" },
      { title: "폴로 랄프로렌 옥스포드 셔츠", expected: "shirt" },
      { title: "스투시 후드", expected: "hoodie" },
      { title: "베이프 티셔츠", expected: "tee" },
      { title: "RRL 청바지", expected: "jeans" },
    ];
    for (const { title, expected } of cases) {
      it(`"${title}" → ${expected}`, () => {
        const result = parseListingOptions({
          title,
          description: title,
          skuId: null,
          skuName: null,
          category: "clothing",
        });
        const productType = (result.parsedJson as any).clothing_product_type;
        assert.equal(productType, expected);
      });
    }
  });

  describe("catalog 2차 safety — jacket SKU 가 mismatch 매물 reject", () => {
    it("tnf-nuptse-1996 SKU 가 '눕시 쇼츠' 매물에 매칭 안 됨 (catalog mustNotContain + Wave 254.6 노이즈)", () => {
      const text = "빔즈 노스페이스 눕시 쇼츠 M 판매합니다";
      const sku = ruleMatch(text, text);
      // SKU 가 매칭되어도 broad fallback 또는 null. tnf-nuptse-1996 narrow 는 매칭 X.
      assert.ok(
        sku === null || sku.id !== "clothing-tnf-nuptse-1996",
        `tnf-nuptse-1996 잘못 매칭됨: ${sku?.id}`,
      );
    });

    it("tnf-mountain-jacket SKU 가 '마운틴 자켓 모자' 매물에 매칭 안 됨", () => {
      const text = "노스페이스 마운틴 자켓 모자 새상품";
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.id !== "clothing-tnf-mountain-jacket",
        `mountain-jacket 잘못 매칭됨: ${sku?.id}`,
      );
    });

    it("arcteryx-beta SKU 가 '베타 벨트' 매물에 매칭 안 됨", () => {
      const text = "아크테릭스 베타 자켓 벨트 단품";
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.id !== "clothing-arcteryx-beta",
        `arcteryx-beta 잘못 매칭됨: ${sku?.id}`,
      );
    });

    it("정상 매물 — '노스페이스 1996 눕시' 다운자켓 → tnf-nuptse-1996 매칭 (regression)", () => {
      const text = "노스페이스 1996 눕시 다운자켓 M";
      const sku = ruleMatch(text, text);
      assert.equal(sku?.id, "clothing-tnf-nuptse-1996",
        `정상 nuptse 매물 매칭 실패: ${sku?.id}`);
    });
  });
});

describe("Wave 254.6 — bag 모델명 false positive 차단", () => {
  it("'Borealis 키링' → type_unknown (backpack 모델명 단독 false positive 차단)", () => {
    const result = parseListingOptions({
      title: "노스페이스 Borealis 키링",
      description: "보레알리스 키링",
      skuId: null,
      skuName: null,
      category: "bag",
    });
    const productType = (result.parsedJson as any).bag_product_type;
    // Wave 254.6 fix: 키링 단독 매물은 backpack 매칭 X.
    assert.notEqual(productType, "backpack",
      `bag_product_type 잘못 backpack 박힘: ${productType}`);
  });

  it("정상 — 'TNF Borealis 백팩' → backpack (regression)", () => {
    const result = parseListingOptions({
      title: "노스페이스 보레알리스 백팩",
      description: "보레알리스 백팩",
      skuId: null,
      skuName: null,
      category: "bag",
    });
    const productType = (result.parsedJson as any).bag_product_type;
    assert.equal(productType, "backpack");
  });
});
