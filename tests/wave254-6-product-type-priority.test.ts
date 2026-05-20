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
      { title: "아크테릭스 스쿼미시 후디 클로리스", expected: "jacket", reason: "outdoor Hoody = jacket line" },
      { title: "아크테릭스 감마LT 후디", expected: "jacket", reason: "Arc'teryx Hoody = jacket line" },
      { title: "아크테릭스 아톰 블랙 후드 달려있음", expected: "jacket", reason: "Arc'teryx hooded jacket description" },
      { title: "BAPE ABC Camo Shark Half Zip 베이프 반집업", expected: "hoodie_zip", reason: "BAPE Shark half zip = hoodie zip" },
      { title: "챔피온 리버스위브 후드티셔츠 판매합니다", expected: "hoodie", reason: "후드티셔츠 is hoodie, not tee" },
      { title: "라코스테 피케티셔츠 새상품", expected: "polo_shirt", reason: "pique tee = polo shirt" },
      { title: "폴로 랄프로렌 옥스포드 멀티포니 체크셔츠 M", expected: "shirt", reason: "Polo brand token should not beat explicit shirt" },
      { title: "톰브라운 반팔셔츠 100", expected: "shirt", reason: "반팔셔츠 is shirt, not tee" },
      { title: "톰브라운 스트라이프 반팔 카라티 1사이즈", expected: "polo_shirt", reason: "카라티 is polo shirt" },
      { title: "정품 톰브라운 화이트 후드 옥스포드 짚업셔츠 2", expected: "shirt", reason: "hooded oxford zip shirt is shirt, not hoodie" },
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

  describe("Wave 413 — clothing product_type title-first", () => {
    it("제목의 반팔 티셔츠가 설명 검색어의 팬츠/쇼츠에 오염되지 않음", () => {
      const result = parseListingOptions({
        title: "BAPE 베이프 타이거 카모 반팔 티셔츠",
        description: "검색용 팬츠 쇼츠 바지 데님 포함 아닙니다. 실물은 반팔 티셔츠입니다.",
        skuId: "clothing-bape-tee",
        skuName: "BAPE Basic Tee",
        category: "clothing",
        defaultProductType: "tee",
      });

      assert.equal(result.parsedJson.clothing_product_type, "tee");
      assert.equal(result.parsedJson.clothing_product_type_source, "title");
      assert.equal(result.parsedJson.clothing_product_type_from_catalog, false);
    });

    it("제목에서 타입을 못 잡으면 설명까지 fallback 함", () => {
      const result = parseListingOptions({
        title: "BAPE ABC Camo College ATS",
        description: "반팔 티셔츠 L 사이즈",
        skuId: "clothing-bape-tee",
        skuName: "BAPE Basic Tee",
        category: "clothing",
        defaultProductType: "tee",
      });

      assert.equal(result.parsedJson.clothing_product_type, "tee");
      assert.equal(result.parsedJson.clothing_product_type_source, "combined");
      assert.equal(result.parsedJson.clothing_product_type_from_catalog, false);
    });
  });

  describe("Wave 425 — clothing type_unknown cleanup", () => {
    const cases = [
      { title: "꼼데가르송 유니크한 크롭탑 볼레로 comme des garcons 컬렉션", expected: "tee" },
      { title: "챔피온 X 글로니 캐미솔 나시 탑 White", expected: "tee" },
      { title: "90s 빈티지 챔피온 리버스위브 멜란지 그레이 스웻 XL 버버진", expected: "crewneck" },
      { title: "[32x32] 칼하트 wip 스트레이드 데님 (34)", expected: "jeans" },
      { title: "칼하트 스티치 데님 31x32", expected: "jeans" },
    ];

    for (const { title, expected } of cases) {
      it(`${title} -> ${expected}`, () => {
        const result = parseListingOptions({
          title,
          description: title,
          skuId: "clothing-champion-apparel-broad",
          skuName: "Champion apparel",
          category: "clothing",
        });

        assert.equal(result.parsedJson.clothing_product_type, expected);
        assert.equal(result.needsReview, false);
      });
    }
  });

  describe("Wave 424 — Polo Oxford spacing variants", () => {
    for (const title of [
      "폴로 랄프로렌 옥스포드셔츠(XL)",
      "폴로 랄프로렌 블루 화이트 스트라이프 옥스포드셔츠(L)",
      "폴로 랄프로렌 클래식핏 옥스포드 깅엄 체크 셔츠 105 L 새제",
    ]) {
      it(`${title} -> clothing-polo-oxford-shirt`, () => {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, "clothing-polo-oxford-shirt");
      });
    }
  });

  describe("BAPE basic apparel catalog split", () => {
    const cases = [
      { title: "베이프 반팔 티셔츠 L", expectedSku: "clothing-bape-tee" },
      { title: "베이프 화이트 후드티 카모 후드", expectedSku: "clothing-bape-hoodie" },
      { title: "베이프 퍼플 카모 후드집업", expectedSku: "clothing-bape-hoodie-zip" },
      { title: "베이프 카모 맨투맨 크루넥", expectedSku: "clothing-bape-crewneck" },
      { title: "BAPE ABC Camo Shark Half Zip 베이프 반집업", expectedSku: "clothing-bape-shark-hoodie" },
    ];

    for (const { title, expectedSku } of cases) {
      it(`${title} -> ${expectedSku}`, () => {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, expectedSku, `${title} matched ${sku?.id}`);
      });
    }

    it("BAPE Shark non-hoodie product types do not enter Shark Hoodie lane", () => {
      for (const title of [
        "BAPE 샤크 티셔츠 L",
        "베이프 샤크 팬츠 M",
        "BAPE Shark shorts XL",
        "베이프 샤크 맨투맨",
      ]) {
        const sku = ruleMatch(title, title);
        assert.ok(
          sku === null || sku.id !== "clothing-bape-shark-hoodie",
          `${title} matched ${sku?.id}`,
        );
      }
    });
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

    it("tnf-denali-fleece SKU 가 '데날리 팬츠' 매물에 매칭 안 됨", () => {
      const text = "노스페이스 00s 윈드스토퍼 후리스 플리스 블랙 데날리 팬츠 바지 xxl";
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.id !== "clothing-tnf-denali-fleece",
        `tnf-denali-fleece 잘못 매칭됨: ${sku?.id}`,
      );
    });

    it("tnf-mountain-jacket SKU 가 Purple/High Mountain variants에 매칭 안 됨", () => {
      for (const text of [
        "THE NORTH FACE PURPLE Mountain Jacket",
        "노스페이스 하이마운틴자켓 xl",
      ]) {
        const sku = ruleMatch(text, text);
        assert.ok(
          sku === null || sku.id !== "clothing-tnf-mountain-jacket",
          `tnf-mountain-jacket variant 잘못 매칭됨: ${text} -> ${sku?.id}`,
        );
      }
    });

    it("정상 매물 — '노스페이스 1996 눕시' 다운자켓 → tnf-nuptse-1996 매칭 (regression)", () => {
      const text = "노스페이스 1996 눕시 다운자켓 M";
      const sku = ruleMatch(text, text);
      assert.equal(sku?.id, "clothing-tnf-nuptse-1996",
        `정상 nuptse 매물 매칭 실패: ${sku?.id}`);
    });

    it("RRL 데님 generic은 jeans fallback, 명시적 데님 셔츠는 shirt 유지", () => {
      const generic = parseListingOptions({
        title: "rrl 데님",
        description: "더블알엘 여성 하이보이핏 데님 29",
        skuId: "clothing-polo-rrl-denim",
        skuName: "Polo RRL Denim (jeans / shirt)",
        category: "clothing",
        defaultProductType: "jeans",
      });
      const shirt = parseListingOptions({
        title: "RRL 데님 셔츠 M",
        description: "더블알엘 데님 셔츠",
        skuId: "clothing-polo-rrl-denim",
        skuName: "Polo RRL Denim (jeans / shirt)",
        category: "clothing",
        defaultProductType: "jeans",
      });

      assert.equal(generic.parsedJson.clothing_product_type, "jeans");
      assert.equal(generic.needsReview, false);
      assert.equal(shirt.parsedJson.clothing_product_type, "shirt");
    });
  });
});

describe("Wave 254.6 — bag 모델명 false positive 차단", () => {
  describe("Wave 414 — shoe broad safety", () => {
    it("Prada Downtown sneaker is not rejected by bare down/down jacket noise", () => {
      const text = "급처! 정품 프라다 다운타운 스니커즈";
      const sku = ruleMatch(text, text);
      assert.equal(sku?.id, "shoe-prada-broad");
    });

    it("shoe box + dustbag accessory set does not match Gucci shoe broad", () => {
      const text = "구찌신발상자 + 더스트백 셋트";
      const sku = ruleMatch(text, text);
      assert.notEqual(sku?.id, "shoe-gucci-broad", `${text} matched ${sku?.id}`);
    });

    it("Louis Vuitton bootcut denim is not a shoe despite boot substring", () => {
      const text = "루이비통 패턴 플레어 부츠컷 데님";
      const sku = ruleMatch(text, text);
      assert.ok(sku === null || sku.category !== "shoe", `${text} matched ${sku?.id}`);
    });

    it("shoe dustbag-only listing does not match luxury shoe broad", () => {
      const text = "구찌 신발용 더스트백 상태최상 정품 가로21세로39";
      const sku = ruleMatch(text, text);
      assert.notEqual(sku?.id, "shoe-gucci-broad", `${text} matched ${sku?.id}`);
    });
  });

  describe("Wave 415 — luxury shoe broad repeated models split to narrow candidates", () => {
    const cases = [
      { title: "에르메스 바운싱 스니커즈 카프스킨 스웨이드 고트스킨 & 블랑", expectedSku: "shoe-hermes-bouncing" },
      { title: "[정품] 루이비통 LV 트레이너 데님 스니커즈 (8)", expectedSku: "shoe-louisvuitton-lv-trainer" },
      { title: "구찌 에이스 웹 스니커즈 빈티지 260", expectedSku: "shoe-gucci-ace" },
      { title: "디올 B23 오블리크 하이탑 스니커즈 신발 36사이즈 230 235", expectedSku: "shoe-dior-b23" },
      { title: "[S급/정품] 디올 B30 테크니컬 스니커즈 40", expectedSku: "shoe-dior-b30" },
    ];

    for (const { title, expectedSku } of cases) {
      it(`${title} -> ${expectedSku}`, () => {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, expectedSku, `${title} matched ${sku?.id}`);
      });
    }
  });

  describe("Wave 416 — short latin token boundary + next luxury narrow candidates", () => {
    const cases = [
      { title: "루이비통 런어웨이 스니커즈 36", expectedSku: "shoe-louisvuitton-runaway" },
      { title: "7 / 루이비통 LV 프리즘 런어웨이 스니커즈", expectedSku: "shoe-louisvuitton-runaway" },
      { title: "구찌 띠로고 라이톤 스니커즈 신발 6.5사이즈 255 260 판매", expectedSku: "shoe-gucci-rhyton" },
      { title: "구찌라이톤 스니커즈 245", expectedSku: "shoe-gucci-rhyton" },
    ];

    for (const { title, expectedSku } of cases) {
      it(`${title} -> ${expectedSku}`, () => {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, expectedSku, `${title} matched ${sku?.id}`);
      });
    }

    it("Nike LV8 does not leak into Louis Vuitton broad through bare lv token", () => {
      const title = "정품 새상품 나이키 에어 포스 107 LV8 235 운동화 스니커즈 남여";
      const sku = ruleMatch(title, title);
      assert.notEqual(sku?.id, "shoe-louisvuitton-broad", `${title} matched ${sku?.id}`);
      assert.notEqual(sku?.id, "shoe-louisvuitton-lv-trainer", `${title} matched ${sku?.id}`);
      assert.notEqual(sku?.id, "shoe-louisvuitton-runaway", `${title} matched ${sku?.id}`);
    });
  });

  describe("Wave 417 — Dior B-series split and brand-bait reject", () => {
    const cases = [
      { title: "[44사이즈]디올 오블리크 B25 러너 스니커즈", expectedSku: "shoe-dior-b25" },
      { title: "디올 B25 러너스니커즈 블랙", expectedSku: "shoe-dior-b25" },
      { title: "디올 B27 하이탑 스니커즈 신발 44사이즈 280 285 판매", expectedSku: "shoe-dior-b27" },
      { title: "디올 B27 미드탑 신발 40사이즈", expectedSku: "shoe-dior-b27" },
      { title: "[42] 디올 B57 CD로고 스니커즈 신발", expectedSku: "shoe-dior-b57" },
      { title: "{ 44 } 디올 B57 스니커즈", expectedSku: "shoe-dior-b57" },
    ];

    for (const { title, expectedSku } of cases) {
      it(`${title} -> ${expectedSku}`, () => {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, expectedSku, `${title} matched ${sku?.id}`);
      });
    }

    it("Dior broad does not absorb other-brand bait", () => {
      const title = "구찌 꿀벌 스니커즈 신발 디올발렌";
      const sku = ruleMatch(title, title);
      assert.notEqual(sku?.id, "shoe-dior-broad", `${title} matched ${sku?.id}`);
    });

    it("Cactus Jack B23 collab does not enter plain Dior B23 lane", () => {
      const title = "43 / 디올 X 캑터스 잭 B23 하이탑 스니커즈 3SH126ZOI";
      const sku = ruleMatch(title, title);
      assert.ok(
        sku === null || sku.id !== "shoe-dior-b23",
        `${title} matched ${sku?.id}`,
      );
    });
  });

  describe("Wave 418 — luxury shoe broad safety and repeated model splits", () => {
    const cases = [
      { title: "[42]발렌시아가 3XL 스니커즈 그레이 화이트 레드 42", expectedSku: "shoe-balenciaga-3xl" },
      { title: "발렌시아가 반짝이 3XL 체인 자물쇠 운동화사이즈:41", expectedSku: "shoe-balenciaga-3xl" },
      { title: "[43]발렌시아가 3xl 에그쉘 원아웃", expectedSku: "shoe-balenciaga-3xl" },
      { title: "구찌 롸이톤  띠로고 스니커즈 240 정품", expectedSku: "shoe-gucci-rhyton" },
      { title: "(W) 구찌 롸이톤 레더 스니커즈 입 모양 프린트", expectedSku: "shoe-gucci-rhyton" },
      { title: "구찌 테니스 1977  가죽 스니커즈", expectedSku: "shoe-gucci-tennis-1977" },
      { title: "프라다 아메리카컵 스니커즈 220-225", expectedSku: "shoe-prada-america-cup" },
      { title: "275) 프라다 스포츠 빈티지 아메리칸 컵 레더 스니커즈 신발", expectedSku: "shoe-prada-america-cup" },
      { title: "에르메스 에제리 슬리퍼 쪼리 35사이즈", expectedSku: "shoe-hermes-egerie" },
      { title: "에르메스 이즈미르 샌들 앱송 & 골드 [41 SIZE] 265MM", expectedSku: "shoe-hermes-izmir" },
    ];

    for (const { title, expectedSku } of cases) {
      it(`${title} -> ${expectedSku}`, () => {
        const sku = ruleMatch(title, title);
        assert.equal(sku?.id, expectedSku, `${title} matched ${sku?.id}`);
      });
    }

    it("Balenciaga Track broad does not absorb Track Sandal", () => {
      const title = "발렌시아가 트랙 샌들 블랙 41사이즈";
      const sku = ruleMatch(title, title);
      assert.notEqual(sku?.id, "shoe-balenciaga-track-broad", `${title} matched ${sku?.id}`);
    });

    it("Balenciaga Track broad does not absorb Tractor Chelsea boots", () => {
      const title = "유일 매물 백화점 정품 발렌시아가 트랙터 첼시부츠 36";
      const sku = ruleMatch(title, title);
      assert.notEqual(sku?.id, "shoe-balenciaga-track-broad", `${title} matched ${sku?.id}`);
    });

    it("Balenciaga 3XL clothing size does not enter 3XL sneaker lane", () => {
      const title = "발렌시아가 티셔츠 3XL";
      const sku = ruleMatch(title, title);
      assert.ok(sku === null || sku.id !== "shoe-balenciaga-3xl", `${title} matched ${sku?.id}`);
    });

    it("Gucci multi-item honeybee + Tennis description does not promote title to Tennis 1977", () => {
      const title = "Gucci 구찌 스니커즈 새상품 정품(260mm/245mm)";
      const description = [
        "구찌 벌꿀 화이트 스니커즈 정가1,270,000 원",
        "구찌 tennis 1977 스니커즈 정가 1,240,000 원",
      ].join("\n");
      const sku = ruleMatch(title, description);
      assert.notEqual(sku?.id, "shoe-gucci-tennis-1977", `${title} matched ${sku?.id}`);
    });
  });

  describe("Wave 422 — popular shoe broad safety tightening", () => {
    it("NB 530 color-specific narrow does not absorb black/grey variants", () => {
      const blackPhantom = ruleMatch("[택포/새상품] 뉴발 530 블랙팬텀 (MR530SMN)", "뉴발란스 530 블랙팬텀 240사이즈 MR530SMN");
      const vintageGrey = ruleMatch("뉴발 530 빈티지그레이 (260)", "뉴발란스 530 빈티지 그레이 색상 260사이즈");
      const naturalSpacing = ruleMatch("뉴발란스 남녀공용 530 그레이 실버 메탈릭 MR530LG", "사이즈 240");
      const bestSeller = ruleMatch("뉴발란스 530SG, 대한민국 베스트셀러 슈즈", "240 사이즈");

      assert.equal(blackPhantom?.id, "shoe-newbalance-530-broad");
      assert.equal(vintageGrey?.id, "shoe-newbalance-530-broad");
      assert.equal(naturalSpacing?.id, "shoe-newbalance-530-broad");
      assert.equal(bestSeller?.id, "shoe-newbalance-530-white-silver-navy");
    });

    it("NB 530 white/silver/navy lane still matches explicit color signals", () => {
      const sku = ruleMatch("뉴발란스 530 화이트 실버 네이비 240", "MR530SG 정품");
      assert.equal(sku?.id, "shoe-newbalance-530-white-silver-navy");
    });

    it("Sambae and Samba Rose do not enter plain Samba OG broad", () => {
      for (const title of [
        "아디다스 삼배(SAMBAE) W 블랙 -JI1350",
        "아디다스 삼바로즈(W) 스니커즈",
      ]) {
        const sku = ruleMatch(title, title);
        assert.notEqual(sku?.id, "shoe-adidas-samba-og-broad", `${title} matched ${sku?.id}`);
      }
    });

    it("Superstar apparel and mule derivatives do not enter plain Superstar broad", () => {
      for (const title of [
        "레어 공용 아디다스 레알마드리드 슈퍼스타 져지 파이어버드 M",
        "아디다스 아디폼 슈퍼스타 뮬 UK12",
      ]) {
        const sku = ruleMatch(title, title);
        assert.notEqual(sku?.id, "shoe-adidas-superstar-broad", `${title} matched ${sku?.id}`);
      }
    });

    it("shoe box listings do not enter New Balance narrow lanes", () => {
      const sku = ruleMatch("뉴발 신발박스 993 530 팝니다", "박스만 판매합니다");
      assert.ok(sku === null || sku.category !== "shoe", `box listing matched ${sku?.id}`);
    });

    it("Miu Miu x New Balance 530 does not enter plain NB 530 broad", () => {
      const sku = ruleMatch("(새제품) 뉴발란스 x 미우 미우 530 스웨이드 메쉬 스니커즈 에크루", "정품");
      assert.notEqual(sku?.id, "shoe-newbalance-530-broad", `Miu Miu collab matched ${sku?.id}`);
    });

    it("Salehe Bembury x New Balance 530 does not enter plain NB 530 broad", () => {
      for (const title of [
        "[260]뉴발란스 x 살레헤 벰버리 530 페일 골드",
        "New Balance x Salehe Bembury 530 Pale Gold",
      ]) {
        const sku = ruleMatch(title, title);
        assert.notEqual(sku?.id, "shoe-newbalance-530-broad", `${title} matched ${sku?.id}`);
      }
    });
  });

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

  it("BaoBao/Issey Miyake bag SKU 가 Issey Miyake sneaker 매물에 매칭 안 됨", () => {
    const text = "이세이 미야케 맨 ISSEY MIYAKE MEN 화이트 레더 스니커";
    const sku = ruleMatch(text, text);
    assert.ok(
      sku === null || sku.id !== "bag-baobao-issey-miyake-lucent",
      `baobao bag SKU가 sneaker 매물에 잘못 매칭됨: ${sku?.id}`,
    );
  });

  it("Coach broad SKU 가 Coccinelle/코치넬레 매물에 매칭 안 됨", () => {
    const text = "코치넬레 마빈 트위스트 스몰 숄더백";
    const sku = ruleMatch(text, text);
    assert.ok(
      sku === null || !sku.id.startsWith("bag-coach"),
      `coach SKU가 Coccinelle 매물에 잘못 매칭됨: ${sku?.id}`,
    );
  });

  it("Coach generic tote/shoulder는 signature narrow로 과승격하지 않음", () => {
    assert.equal(ruleMatch("코치 토트백", "코치 일반 토트백")?.id, "bag-coach-broad");
    assert.equal(ruleMatch("코치 시그니처 토트백", "코치 signature canvas tote")?.id, "bag-coach-signature-tote");
  });

  it("Bottega broad SKU 가 Cassette narrow 매칭을 가리지 않음", () => {
    const text = "[정품] 보테가베네타 카세트백 크로스백 풀구성";
    const sku = ruleMatch(text, text);
    assert.equal(sku?.id, "bag-bottega-cassette-mini");
  });

  it("구매인증 문구는 매입글로 오인하지 않고 Bottega Cassette narrow를 유지", () => {
    const text = "보테가베네타 카세트백 미니 블랙 (백화점구매인증가능)";
    const sku = ruleMatch(text, "신세계 백화점 구매인증 가능합니다.");
    assert.equal(sku?.id, "bag-bottega-cassette-mini");
  });

  it("Bottega Cassette 구성품 쇼핑백/파우치 문구가 product type을 tote/pouch로 오염시키지 않음", () => {
    const title = "[급처]네고많이가능 백화점판 [정품] 보테가베네타 카세트백 크로스백";
    const description = "풀구성이에요 백화점영수증 개런티카드 쇼핑백 파우치등 구성 다있습니다";
    const result = parseListingOptions({
      title,
      description,
      skuId: "bag-bottega-cassette-mini",
      skuName: "Cassette Mini Bag",
      category: "bag",
      defaultProductType: "crossbody",
    });
    assert.equal(result.parsedJson.bag_product_type, "crossbody");
    assert.equal(result.comparableKey, "bag|cassette_mini|crossbody|era_unknown|unknown_size_variant");
  });

  it("bag product type은 제목의 토트백을 설명 수납품보다 우선한다", () => {
    const result = parseListingOptions({
      title: "메종 마르지엘라 5AC 드로스트링 미니 토트백",
      description: "지갑, 휴대폰, 파우치 정도는 들어가고 스트랩으로 숄더나 크로스로도 연출 가능합니다.",
      skuId: "bag-margiela-5ac-mini",
      skuName: "5AC Mini/Micro Bag",
      category: "bag",
      defaultProductType: "crossbody",
    });

    assert.equal(result.parsedJson.bag_product_type, "tote");
    assert.equal(result.parsedJson.bag_product_type_source, "title");
    assert.equal(result.comparableKey, "bag|5ac_mini|tote|era_unknown|unknown_size_variant");
  });

  it("Margiela 5AC glued notation은 broad fallback이 아니라 5AC narrow로 간다", () => {
    assert.equal(ruleMatch("마르지엘라 5ac크로스백", "정품끈 보유")?.id, "bag-margiela-5ac-mini");
    assert.equal(ruleMatch("메종마르지엘라 5ac미니백", "브라운 가방")?.id, "bag-margiela-5ac-mini");
  });

  it("명품 종이 쇼핑백/패키지는 broad bag SKU로 매칭하지 않음", () => {
    for (const text of [
      "생로랑 쇼핑백",
      "[새것] 입생로랑 발렌타인 종이백 패키지 1개",
    ]) {
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.category !== "bag",
        `paper shopping bag이 bag SKU로 잘못 매칭됨: ${text} -> ${sku?.id}`,
      );
    }
  });

  it("paper shopping-bag accessory rows do not enter clothing broad, while included shopping bag remains allowed", () => {
    const accessory = ruleMatch(
      "톰브라운 쇼핑백 미사용 (중) 맨투맨,니트,가디건,후드,후드집업용",
      "쇼핑백 단품",
    );
    assert.ok(
      accessory === null || accessory.category !== "clothing",
      `shopping-bag accessory matched clothing SKU: ${accessory?.id}`,
    );

    const fullItem = ruleMatch(
      "톰브라운 밀라노스티치 가디건 쇼핑백 포함",
      "정품 가디건 본품",
    );
    assert.equal(fullItem?.id, "clothing-thombrowne-apparel-broad");
  });

  it("정상 명품 가방 표현은 broad bag fallback 유지", () => {
    const sku = ruleMatch("생로랑 케이트 크로커다일 태슬백 블랙 은장", "생로랑 케이트 숄더백");
    assert.equal(sku?.id, "bag-ysl-broad");
  });

  it("패션 broad fallback은 description 구성품 브랜드 때문에 다른 broad로 갈아타지 않음", () => {
    const sku = ruleMatch(
      "미우미우 토트백  정품",
      "전체적으로 상태 양호합니다. 본품과 스트랩 구성입니다. 디올 더스트백에 넣어드릴께요.",
    );
    assert.equal(sku?.id, "bag-miumiu-broad");
  });

  it("Supreme 5패널/스냅백 모자류는 bag SKU로 매칭하지 않음", () => {
    for (const text of [
      "슈프림 월드와이드 메쉬 백 5패널 블랙 20SS",
      "슈프림 사이드 스냅백",
    ]) {
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.category !== "bag",
        `Supreme cap이 bag SKU로 잘못 매칭됨: ${text} -> ${sku?.id}`,
      );
    }
  });

  it("Salomon ACS 크로스백/숄더백/웨이스트백은 shoe ACS Pro로 매칭하지 않음", () => {
    for (const text of [
      "[해외] 살로몬 ACS 리바이즈드 크로스백 26SS",
      "[해외] 살로몬 ACS 숄더백 26SS",
      "[해외] 살로몬 ACS 웨이스트백 3 26SS",
    ]) {
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.id !== "shoe-salomon-acs-pro",
        `Salomon ACS bag이 shoe SKU로 잘못 매칭됨: ${text} -> ${sku?.id}`,
      );
    }
  });

  it("뷰티/SPA/스타일 bait 가방 매물은 럭셔리 broad SKU로 매칭하지 않음", () => {
    for (const text of [
      "디올뷰티 리미티드 홀리데이 토드백 미듐 사이즈",
      "르메르 유니클로 유니클로U 드로우 스트링백 숄더백 크로스백 여행가방",
    ]) {
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.category !== "bag",
        `beauty/SPA bait가 bag SKU로 잘못 매칭됨: ${text} -> ${sku?.id}`,
      );
    }
  });

  it("백화점판 의류 문구는 bare 백 신호로 럭셔리 bag broad에 매칭하지 않음", () => {
    for (const text of [
      "디올 DIOR 로고 니트 L 백화점판 캐시미어 신형 팝니다",
      "급처 루이비통 모노그램 스케이트진 국내백화점",
      "M) [백화점판] 루이비통 그라디언트 니트",
    ]) {
      const sku = ruleMatch(text, text);
      assert.ok(
        sku === null || sku.category !== "bag",
        `백화점판/의류 매물이 bag SKU로 잘못 매칭됨: ${text} -> ${sku?.id}`,
      );
    }
  });

  it("톰브라운 스타일/룩 bait와 강아지 니트는 Thom Browne apparel broad에 매칭하지 않음", () => {
    const dogKnit = ruleMatch("톰브라운 스탈 강아지 니트L", "5kg 아가가 입으면 잘 맞아요");
    assert.ok(
      dogKnit === null || dogKnit.id !== "clothing-thombrowne-apparel-broad",
      `pet/style bait가 Thom Browne apparel broad로 잘못 매칭됨: ${dogKnit?.id}`,
    );

    const suspender = ruleMatch(
      "[정품] 장원영의 타미진스 빈티지 톰브라운 타미힐피거 서스펜더",
      "타미정품 박스풀. 톰브라운룩 코디용 서스펜더입니다.",
    );
    assert.ok(
      suspender === null || suspender.id !== "clothing-thombrowne-apparel-broad",
      `Tommy/style bait가 Thom Browne apparel broad로 잘못 매칭됨: ${suspender?.id}`,
    );
  });

  it("Thom Browne / Carhartt 별도 콜라보 라인은 broad apparel fallback에 섞지 않음", () => {
    for (const [title, blockedSku] of [
      ["톰브라운X코에 KOE 옥스포드 버튼다운 화이트 셔츠", "clothing-thombrowne-apparel-broad"],
      ["톰브라운 미스터톰 스웨트셔츠 백화점 한정판", "clothing-thombrowne-apparel-broad"],
      ["와코마리아 x 칼하트 레오파드 셔츠", "clothing-carhartt-apparel-broad"],
    ] as const) {
      const sku = ruleMatch(title, title);
      assert.ok(
        sku === null || sku.id !== blockedSku,
        `separate collab/limited line matched broad SKU: ${title} -> ${sku?.id}`,
      );
    }
  });

  it("Nike championship court shoe wording does not match Champion clothing broad", () => {
    const sku = ruleMatch("나이키 덩크 로우 레트로 챔피언쉽 코트 퍼플 275", "스니커즈");
    assert.ok(
      sku === null || sku.id !== "clothing-champion-apparel-broad",
      `Nike shoe colorway matched Champion clothing broad: ${sku?.id}`,
    );
  });

  it("CDG PLAY heart staples are split from generic Comme des Garcons broad", () => {
    assert.equal(
      ruleMatch("꼼데가르송 플레이 검정 하트 반팔 티셔츠", "정품")?.id,
      "clothing-cdg-play-tee",
    );
    assert.equal(
      ruleMatch("꼼데가르송 하트 와펜 가디건 S", "정품")?.id,
      "clothing-cdg-play-cardigan",
    );
    assert.equal(
      ruleMatch("꼼데가르송 플레이 블랙 하트 PK 반팔 카라티", "정품")?.id,
      "clothing-cdg-play-polo",
    );
    assert.equal(
      ruleMatch("꼼데가르송 플레이 스트라이프 셔츠", "정품")?.id,
      "clothing-cdg-play-shirt",
    );
    assert.equal(
      ruleMatch("꼼데가르송 플레이 하트 후드 집업", "정품")?.id,
      "clothing-cdg-play-hoodie",
    );
    assert.equal(
      ruleMatch("꼼데가르송 옴므 comme des garcons homme 셔츠", "정품")?.id,
      "clothing-cdg-apparel-broad",
    );
    for (const title of [
      "요지 재패니즈 하이웨스트 비대칭 스커트 꼼데가르송 맛",
      "꼼데가르송 구찌 홀리데이 PVC백",
      "나이키 플레이 꼼데가르송 콜라보 후드티 남성 사이즈 XL",
    ]) {
      const sku = ruleMatch(title, "정품");
      assert.ok(
        sku === null || !sku.id.startsWith("clothing-cdg-"),
        `CDG apparel bait should not match clothing CDG SKU: ${title} -> ${sku?.id}`,
      );
    }
  });

  it("Carhartt Detroit/Active jacket은 broad apparel이 아니라 실모델 lane으로 분리한다", () => {
    assert.equal(
      ruleMatch("칼하트 WIP 디트로이트 자켓 OG", "정품")?.id,
      "clothing-carhartt-detroit-jacket",
    );
    assert.equal(
      ruleMatch("(XL)칼하트 덕 액티브 후드자켓 J130 BRN 칼하트브라운", "정품")?.id,
      "clothing-carhartt-active-jacket",
    );
    assert.equal(
      ruleMatch("칼하트 wip 메디슨 자켓 네이비 L", "정품")?.id,
      "clothing-carhartt-apparel-broad",
    );
  });

  it("Dior J'ADIOR 슬링백 신발은 Dior bag broad로 매칭하지 않음", () => {
    const sku = ruleMatch("디올 J'ADIOR 39D 약250 슬링백", "디올 슬링백 슈즈");
    assert.ok(
      sku === null || sku.id !== "bag-dior-broad",
      `J'ADIOR shoe가 Dior bag broad로 잘못 매칭됨: ${sku?.id}`,
    );
  });

  it("백앤센스 이너백 액세서리는 Lemaire bag broad로 매칭하지 않음", () => {
    const sku = ruleMatch("백앤센스 르메르 크루아상 미니 포춘백 이너백", "이너백 액세서리");
    assert.ok(
      sku === null || sku.id !== "bag-lemaire-broad",
      `이너백 액세서리가 Lemaire bag broad로 잘못 매칭됨: ${sku?.id}`,
    );
  });

  it("Prada beauty gift crossbody는 Pocono narrow bag으로 매칭하지 않음", () => {
    const sku = ruleMatch("프라다뷰티 3단 크로스백", "프라다뷰티 기프트 포코노 천 소재");
    assert.ok(
      sku === null || sku.id !== "bag-prada-pocono-vintage",
      `beauty gift가 Prada Pocono bag으로 잘못 매칭됨: ${sku?.id}`,
    );
  });

  it("정상 Prada Pocono 본품은 vintage Pocono lane 유지", () => {
    const sku = ruleMatch("프라다 포코노 빈티지 숄더백", "프라다 포코노 나일론 본품 가방");
    assert.equal(sku?.id, "bag-prada-pocono-vintage");
  });

  it("Prada Re-Edition 2005 Tessuto/Hobo는 기존 nylon hobo narrow로 매칭", () => {
    const sku = ruleMatch("프라다 리에디션 2005 테수토 호보백 블랙 골드 1BH204 R064", "프라다 re-edition 2005 hobo");
    assert.equal(sku?.id, "bag-prada-nylon-hobo-vintage");
  });

  it("정상 Lemaire Croissant 본품은 이너백 포함 문구가 있어도 broad fallback 유지", () => {
    const sku = ruleMatch("르메르 크루아상 스몰 블랙+이너백드림", "본품 가방 판매합니다.");
    assert.equal(sku?.id, "bag-lemaire-broad");
  });

  it("Patagonia shell은 다른 outdoor brand-stuffed bait 매물에 매칭하지 않음", () => {
    const text = "나이키 ACG 바람막이 소프트쉘 블랙 XL 로아 몽벨 파타고니아";
    const sku = ruleMatch(text, text);
    assert.ok(
      sku === null || sku.id !== "clothing-patagonia-shell",
      `Patagonia style bait가 shell SKU로 잘못 매칭됨: ${sku?.id}`,
    );
  });
});
