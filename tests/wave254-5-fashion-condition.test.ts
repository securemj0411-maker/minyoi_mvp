// Wave 254.5 step 1 (2026-05-20): conditionFromTextFashion + shoe 통합 회귀.
//   사용자 결정 (옵션 a, 점진 rollout): shoe → bag → clothing.
//   step 1 검증 — shoe 카테고리 한정.
//   pid 408858108 가젤 볼드 "새상품 + 약간 하자가있어" → mint 잘못 root fix.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { conditionFromTextFashion, extractConditionClass, parseListingOptions } from "@/lib/option-parser";

describe("Wave 254.5 step 1 — conditionFromTextFashion (shoe)", () => {
  describe("Wave 203~209 base 정책 통합", () => {
    it("repair_or_defect_signal 감지 — '약간 하자가있어'", () => {
      // pid 408858108 가젤 볼드 케이스 — 기존 parseConditionTier 가 '새상품' a_grade match → mint.
      // fix 후: conditionFromText 의 '하자' 패턴 감지 → repair_or_defect_signal.
      const { conditionNotes } = conditionFromTextFashion(
        "아디다스 가젤 볼드 새상품 약간 하자가있어",
        "shoe",
      );
      assert.ok(conditionNotes.includes("repair_or_defect_signal"),
        `repair_or_defect_signal 없음: ${conditionNotes.join(",")}`);
    });

    it("negation — '하자 없' 은 repair_or_defect_signal 박지 않음", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "나이키 페가수스 41 하자 없습니다",
        "shoe",
      );
      assert.ok(!conditionNotes.includes("repair_or_defect_signal"),
        `negation 실패 — repair_or_defect_signal 잘못 박힘: ${conditionNotes.join(",")}`);
    });

    it("cosmetic_wear — '사용감 있' 만 박고 '사용감 적음' 은 무시 (Wave 209)", () => {
      const r1 = conditionFromTextFashion("나이키 페가수스 사용감 적음", "shoe");
      assert.ok(!r1.conditionNotes.includes("cosmetic_wear"),
        `'사용감 적음' 에 cosmetic_wear 잘못 박힘`);
      const r2 = conditionFromTextFashion("나이키 페가수스 사용감 있음", "shoe");
      assert.ok(r2.conditionNotes.includes("cosmetic_wear"),
        `'사용감 있음' 에 cosmetic_wear 안 박힘`);
    });

    it("buying_post 감지 — title-only", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "나이키 페가수스 41 270mm 구합니다",
        "shoe",
      );
      assert.ok(conditionNotes.includes("buying_post"),
        `buying_post 없음: ${conditionNotes.join(",")}`);
    });

    it("exchange_only 감지 — 교환 전용 글만 flawed로 보냄", () => {
      const exchange = conditionFromTextFashion(
        "아이폰15프로 128기가 화이트 -> 아이폰 17 일반 교환해요!",
        "clothing",
      );
      assert.ok(exchange.conditionNotes.includes("exchange_only"),
        `exchange_only 없음: ${exchange.conditionNotes.join(",")}`);
      assert.equal(extractConditionClass(exchange.conditionNotes), "flawed");

      const saleDisclaimer = conditionFromTextFashion(
        "아이폰 15 프로 128기가 정상 판매합니다 교환/환불 불가",
        "clothing",
      );
      assert.ok(!saleDisclaimer.conditionNotes.includes("exchange_only"),
        `판매 disclaimer를 exchange_only로 잘못 잡음: ${saleDisclaimer.conditionNotes.join(",")}`);

      const bracketed = parseListingOptions({
        title: "[교환] 아이폰15프로맥스 512 애케플 -> 아이폰15프로 1테라",
        description: "컬러 무관하게 1테라로 구합니다.",
        skuId: "iphone-15-pro-max",
        skuName: "iPhone 15 Pro Max",
        category: "smartphone",
      });
      assert.ok(bracketed.conditionNotes.includes("exchange_only"),
        `[교환] title exchange_only 없음: ${bracketed.conditionNotes.join(",")}`);
      assert.ok(bracketed.needsReview);
    });

    it("parts_only 감지 — 부속품/Type-C 베이스 단품은 본체 비교군에서 제외", () => {
      const accessory = parseListingOptions({
        title: "다이슨 에어랩 부속품 팝니다",
        description: "",
        skuId: "dyson-airwrap-hs05",
        skuName: "Dyson Airwrap Multi-styler Complete (HS05)",
        category: "home_appliance",
      });
      assert.ok(accessory.conditionNotes.includes("parts_only"),
        `parts_only 없음: ${accessory.conditionNotes.join(",")}`);
      assert.ok(accessory.needsReview);
      assert.equal(accessory.conditionClass, "flawed");

      const typeCBase = parseListingOptions({
        title: "Ulanzi DJI 오즈모 포켓3 Type-C 베이스",
        description: "",
        skuId: "dji-osmo-pocket-3",
        skuName: "DJI Osmo Pocket 3",
        category: "drone",
      });
      assert.ok(typeCBase.conditionNotes.includes("parts_only"),
        `Type-C 베이스 parts_only 없음: ${typeCBase.conditionNotes.join(",")}`);

      const fullSet = parseListingOptions({
        title: "[새상품] 다이슨 에어랩 스타일러 풀세트 + 케이스",
        description: "",
        skuId: "dyson-airwrap-hs05",
        skuName: "Dyson Airwrap Multi-styler Complete (HS05)",
        category: "home_appliance",
      });
      assert.ok(!fullSet.conditionNotes.includes("parts_only"),
        `풀세트+케이스를 parts_only로 잘못 잡음: ${fullSet.conditionNotes.join(",")}`);

      const fullUnitWithAccessories = parseListingOptions({
        title: "다이슨 에어랩 스타일러 오렌지 + 부속품",
        description: "",
        skuId: "dyson-airwrap-hs05",
        skuName: "Dyson Airwrap Multi-styler Complete (HS05)",
        category: "home_appliance",
      });
      assert.ok(!fullUnitWithAccessories.conditionNotes.includes("parts_only"),
        `본체+부속품 포함 매물을 parts_only로 잘못 잡음: ${fullUnitWithAccessories.conditionNotes.join(",")}`);
    });

    it("good_condition 감지 — '상태 좋'", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "나이키 덩크 로우 상태 좋아요",
        "shoe",
      );
      assert.ok(conditionNotes.includes("good_condition"));
    });
  });

  describe("shoe-specific signals (Wave 254.5 step 1 신규)", () => {
    it("솔 가루 — shoe_sole_crumbling + repair_or_defect_signal piggy-back", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "조던 1 미드솔 가루 떨어집니다",
        "shoe",
      );
      assert.ok(conditionNotes.includes("shoe_sole_crumbling"));
      assert.ok(conditionNotes.includes("repair_or_defect_signal"),
        `piggy-back 안 됨: ${conditionNotes.join(",")}`);
      // FLAWED 분류 보장
      assert.equal(extractConditionClass(conditionNotes), "flawed");
    });

    it("솔 가루 — negation '솔 가루 없음' 무시", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "조던 1 솔 가루 없습니다 깨끗합니다",
        "shoe",
      );
      assert.ok(!conditionNotes.includes("shoe_sole_crumbling"),
        `negation 실패: ${conditionNotes.join(",")}`);
    });

    it("가수분해 — shoe_hydrolysis + repair_or_defect_signal", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "에어맥스 95 밑창 가수분해 시작됨",
        "shoe",
      );
      assert.ok(conditionNotes.includes("shoe_hydrolysis"));
      assert.ok(conditionNotes.includes("repair_or_defect_signal"));
      assert.equal(extractConditionClass(conditionNotes), "flawed");
    });

    it("인솔 없음 — shoe_insole_missing (worn-level)", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "나이키 덩크 인솔 분실되어 새거 끼움",
        "shoe",
      );
      assert.ok(conditionNotes.includes("shoe_insole_missing"));
    });

    it("굽창 마모 심함 — shoe_heel_worn_severe", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "스탠스미스 뒷굽 다 닳음 사용감 많음",
        "shoe",
      );
      assert.ok(conditionNotes.includes("shoe_heel_worn_severe"));
    });

    it("밑창 분리 — shoe_sole_separation + repair_or_defect_signal", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "컨버스 척테일러 밑창 벗겨져서 본드로 붙여 사용",
        "shoe",
      );
      assert.ok(conditionNotes.includes("shoe_sole_separation"));
      assert.ok(conditionNotes.includes("repair_or_defect_signal"));
    });
  });

  describe("integration via parseListingOptions (shoe 분기)", () => {
    it("pid 408858108 시뮬레이션 — '새상품 + 약간 하자' → flawed (mint X)", () => {
      const result = parseListingOptions({
        title: "아디다스 가젤 볼드 270",
        description: "새상품 같은데 약간 하자가있어요",
        skuId: "shoe-adidas-gazelle-bold",
        skuName: "Adidas Gazelle Bold",
        category: "shoe",
      });
      // tier-only: a_grade ('새상품') → mint. fix 후: fashion notes 의 repair_or_defect_signal → flawed.
      assert.equal(result.conditionClass, "flawed",
        `expected flawed, got ${result.conditionClass} (notes: ${result.conditionNotes.join(",")})`);
      // conditionScore worst-of (tier 0.95 vs fashion ~0.55) → 0.55 이하
      assert.ok(result.conditionScore < 0.7,
        `worst-of 실패 — conditionScore=${result.conditionScore}`);
    });

    it("정상 매물 — '상태 좋' → clean 유지", () => {
      const result = parseListingOptions({
        title: "나이키 페가수스 41 블랙 270",
        description: "상태 좋습니다 거의 새것",
        skuId: "shoe-nike-pegasus-41",
        skuName: "Nike Pegasus 41",
        category: "shoe",
      });
      // 'good_condition' note + 'a_grade' tier → 양쪽 모두 positive. clean 이상 유지.
      assert.ok(
        result.conditionClass === "clean" || result.conditionClass === "mint" || result.conditionClass === "unopened",
        `정상 매물 demote: ${result.conditionClass} (notes: ${result.conditionNotes.join(",")})`,
      );
    });

    it("conditionNotes 비어있지 않음 (shoe) — Wave 254.5 fix 확인", () => {
      const result = parseListingOptions({
        title: "조던 1 로우 블랙",
        description: "상태 좋습니다",
        skuId: "shoe-nike-jordan-1-low",
        skuName: "Jordan 1 Low",
        category: "shoe",
      });
      // 기존 (Wave 130): conditionNotes: [] 박힘. fix: shoe 만 fashion notes 채움.
      assert.ok(Array.isArray(result.conditionNotes));
      assert.ok(result.conditionNotes.length > 0,
        `shoe conditionNotes 비어있음: ${JSON.stringify(result.conditionNotes)}`);
    });

    it("parser_version shoe = wave92-shoe-v41 (Wave 763 tier/key sync)", () => {
      const result = parseListingOptions({
        title: "나이키 덩크 로우",
        description: "270",
        skuId: "shoe-nike-dunk-low",
        skuName: "Nike Dunk Low",
        category: "shoe",
      });
      assert.equal(result.parserVersion, "wave92-shoe-v41",
        `parser_version mismatch: ${result.parserVersion}`);
    });

    it("parser_version bag = wave92-bag-v24 (Wave 756 size variant policy)", () => {
      const result = parseListingOptions({
        title: "구찌 마몬트 토트백",
        description: "정품",
        skuId: "bag-gucci-marmont",
        skuName: "Gucci Marmont",
        category: "bag",
      });
      assert.equal(result.parserVersion, "wave92-bag-v24",
        `bag parser_version mismatch: ${result.parserVersion}`);
    });

    it("parser_version clothing = wave216-clothing-v52 (Wave 801 pool purity follow-up)", () => {
      const result = parseListingOptions({
        title: "스투시 후드",
        description: "L 사이즈",
        skuId: "clothing-stussy-hoodie",
        skuName: "Stussy Hoodie",
        category: "clothing",
      });
      assert.equal(result.parserVersion, "wave216-clothing-v52",
        `clothing parser_version mismatch: ${result.parserVersion}`);
    });

    it("clothing broad fallback → needsReview=true", () => {
      const result = parseListingOptions({
        title: "아크네스튜디오 반집업 긴팔 XL 블랙",
        description: "정품",
        skuId: "clothing-acne-apparel",
        skuName: "Acne Studios Apparel (broad)",
        category: "clothing",
      });
      assert.ok(result.needsReview,
        `broad fallback needsReview 안 박힘: ${JSON.stringify(result.parsedJson)}`);
      assert.deepEqual(result.parsedJson.clothing_broad_fallback, true);
      assert.ok((result.parsedJson.critical_unknown as string[]).includes("clothing_broad_fallback"));
    });

    it("clothing title multi-item bundle → needsReview=true", () => {
      const result = parseListingOptions({
        title: "아크네 반바지 두개",
        description: "정품",
        skuId: "clothing-acne-apparel",
        skuName: "Acne Studios Apparel (broad)",
        category: "clothing",
      });
      assert.ok(result.needsReview,
        `multi-item bundle needsReview 안 박힘: ${JSON.stringify(result.parsedJson)}`);
      assert.deepEqual(result.parsedJson.clothing_multi_item_bundle, true);
      assert.ok((result.parsedJson.critical_unknown as string[]).includes("clothing_multi_item_bundle"));
    });

    it("strong negative signal (buying_post) → needsReview=true", () => {
      const result = parseListingOptions({
        title: "조던 1 270 구합니다",
        description: "270mm 구해요",
        skuId: "shoe-nike-jordan-1-high",
        skuName: "Jordan 1 High",
        category: "shoe",
      });
      assert.ok(result.needsReview,
        `buying_post → needsReview 안 박힘 (notes: ${result.conditionNotes.join(",")})`);
    });
  });

  describe("bag-specific signals (Wave 254.5 step 2 신규)", () => {
    it("내피 끈적 → bag_lining_damage + flawed", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "구찌 마몬트 토트 내피 끈적해요 사용감 있어요",
        "bag",
      );
      assert.ok(conditionNotes.includes("bag_lining_damage"),
        `bag_lining_damage 없음: ${conditionNotes.join(",")}`);
      assert.equal(extractConditionClass(conditionNotes), "flawed");
    });

    it("가죽 까짐 → bag_leather_damage + flawed", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "샤넬 클래식 플랩 가죽 까짐 살짝",
        "bag",
      );
      assert.ok(conditionNotes.includes("bag_leather_damage"));
      assert.equal(extractConditionClass(conditionNotes), "flawed");
    });

    it("손잡이 마모 → bag_handle_worn", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "프라다 나일론 호보 손잡이 마모 있음",
        "bag",
      );
      assert.ok(conditionNotes.includes("bag_handle_worn"));
    });

    it("코너 닳음 → bag_corner_worn", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "루이비통 스피디 25 모서리 닳음",
        "bag",
      );
      assert.ok(conditionNotes.includes("bag_corner_worn"));
    });

    it("페인팅 벗겨짐 → bag_paint_peeling", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "셀린느 카바백 페인팅 벗겨짐",
        "bag",
      );
      assert.ok(conditionNotes.includes("bag_paint_peeling"));
    });

    it("곰팡이 → bag_mold + flawed", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "루이비통 스피디 곰팡이 있어요",
        "bag",
      );
      assert.ok(conditionNotes.includes("bag_mold"));
      assert.equal(extractConditionClass(conditionNotes), "flawed");
    });

    it("bag integration — conditionNotes 채워짐 (Wave 254.5 step 2 fix 확인)", () => {
      const result = parseListingOptions({
        title: "구찌 마몬트 토트백",
        description: "내피 끈적합니다",
        skuId: "bag-gucci-marmont",
        skuName: "Gucci Marmont",
        category: "bag",
      });
      assert.ok(Array.isArray(result.conditionNotes));
      assert.ok(result.conditionNotes.length > 0,
        `bag conditionNotes 비어있음: ${JSON.stringify(result.conditionNotes)}`);
      assert.ok(result.conditionNotes.includes("bag_lining_damage"));
    });
  });

  describe("clothing-specific signals (Wave 254.5 step 3 신규)", () => {
    it("Wave 406: 폴로베어 티셔츠와 롱슬리브를 다른 comparable_key로 분리", () => {
      const tee = parseListingOptions({
        title: "폴로베어 슬림핏 네이비 티셔츠",
        description: "정품 상태 좋음",
        skuId: "clothing-polo-bear-collab",
        skuName: "Polo Bear Print",
        category: "clothing",
      });
      const longSleeve = parseListingOptions({
        title: "a418) 폴로랄프로렌 베어 와플 롱슬리브",
        description: "정품 상태 좋음",
        skuId: "clothing-polo-bear-collab",
        skuName: "Polo Bear Print",
        category: "clothing",
      });

      assert.equal(tee.parsedJson.clothing_product_type, "tee");
      assert.equal(longSleeve.parsedJson.clothing_product_type, "long_sleeve_tee");
      assert.notEqual(tee.comparableKey, longSleeve.comparableKey);
    });

    it("Wave 406: 스투시 후드와 후드집업을 다른 comparable_key로 분리", () => {
      const hoodie = parseListingOptions({
        title: "스투시 후드 L 팝니다",
        description: "정품 상태 좋음",
        skuId: "clothing-stussy-hoodie",
        skuName: "Stussy Hoodie / Crewneck",
        category: "clothing",
      });
      const zipHoodie = parseListingOptions({
        title: "스투시 후드집업 급처 정품",
        description: "정품 상태 좋음",
        skuId: "clothing-stussy-hoodie",
        skuName: "Stussy Hoodie / Crewneck",
        category: "clothing",
      });

      assert.equal(hoodie.parsedJson.clothing_product_type, "hoodie");
      assert.equal(zipHoodie.parsedJson.clothing_product_type, "hoodie_zip");
      assert.notEqual(hoodie.comparableKey, zipHoodie.comparableKey);
    });

    it("보풀 → clothing_pilling", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "스투시 후드 보풀 있어요",
        "clothing",
      );
      assert.ok(conditionNotes.includes("clothing_pilling"));
    });

    it("보풀 negation '보풀 없음'", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "스투시 후드 보풀 없습니다",
        "clothing",
      );
      assert.ok(!conditionNotes.includes("clothing_pilling"));
    });

    it("색바램 → clothing_fading", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "베이프 티 색바램 있음",
        "clothing",
      );
      assert.ok(conditionNotes.includes("clothing_fading"));
    });

    it("늘어남 → clothing_stretched", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "랄프로렌 니트 넥 늘어남",
        "clothing",
      );
      assert.ok(conditionNotes.includes("clothing_stretched"));
    });

    it("봉제 풀림 → clothing_seam_damage + flawed", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "캠퍼 자켓 봉제 풀림 있음",
        "clothing",
      );
      assert.ok(conditionNotes.includes("clothing_seam_damage"));
      assert.equal(extractConditionClass(conditionNotes), "flawed");
    });

    it("데미지/보강 필요 → clothing_structural_damage + flawed", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "RRL 빈티지파이브포켓 뒷 다리에 작은 데미지 2개, 엉덩이 포켓 보강이 좀 필요한 것 같아요",
        "clothing",
      );
      assert.ok(conditionNotes.includes("clothing_structural_damage"),
        `clothing_structural_damage 없음: ${conditionNotes.join(",")}`);
      assert.ok(conditionNotes.includes("repair_or_defect_signal"),
        `repair_or_defect_signal 없음: ${conditionNotes.join(",")}`);
      assert.equal(extractConditionClass(conditionNotes), "flawed");
    });

    it("RRL denim integration — structural damage wins over a_grade", () => {
      const result = parseListingOptions({
        title: "RRL 빈티지파이브포켓 기빈스 데님 청바지 28x30",
        description: "뒷 다리에 작은 데미지 2개, 엉덩이 포켓 보강이 좀 필요한 것 같아요",
        skuId: "clothing-polo-rrl-denim",
        skuName: "Polo RRL Denim (jeans / shirt)",
        category: "clothing",
        defaultProductType: "jeans",
      });
      assert.equal(result.conditionClass, "flawed",
        `expected flawed, got ${result.conditionClass} (notes: ${result.conditionNotes.join(",")})`);
      assert.ok(result.comparableKey);
      assert.ok(!result.comparableKey.endsWith("|a_grade"),
        `damaged RRL denim stayed in a_grade key: ${result.comparableKey}`);
    });

    it("RRL denim integration — metadata a_grade is rewritten by structural damage", () => {
      const result = parseListingOptions({
        title: "RRL 빈티지파이브포켓 기빈스 데님 청바지 28x30",
        description: "뒷 다리에 작은 데미지 2개, 엉덩이 포켓 보강이 좀 필요한 것 같아요",
        skuId: "clothing-polo-rrl-denim",
        skuName: "Polo RRL Denim (jeans / shirt)",
        category: "clothing",
        defaultProductType: "jeans",
        bunjangConditionLabel: "새상품급",
      });
      assert.equal(result.conditionClass, "flawed",
        `expected flawed, got ${result.conditionClass} (notes: ${result.conditionNotes.join(",")})`);
      assert.equal(result.comparableKey, "clothing|polo_rrl_denim|jeans|b_grade");
    });

    it("디자인 트임은 무시 ('사이드 트임')", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "유니클로 셔츠 사이드 트임 디자인",
        "clothing",
      );
      assert.ok(!conditionNotes.includes("clothing_slit_damage"),
        `디자인 트임 false positive: ${conditionNotes.join(",")}`);
    });

    it("인쇄 갈라짐 → clothing_print_cracked", () => {
      const { conditionNotes } = conditionFromTextFashion(
        "베이프 티 인쇄 갈라짐",
        "clothing",
      );
      assert.ok(conditionNotes.includes("clothing_print_cracked"));
    });

	    it("얼룩 negation '얼룩 없음'", () => {
	      const { conditionNotes } = conditionFromTextFashion(
	        "폴로 셔츠 얼룩 없습니다 깨끗",
	        "clothing",
	      );
	      assert.ok(!conditionNotes.includes("clothing_stain"));
	    });

	    it("ready sweep: 살짝/미세/작은 오염 변형은 clothing_stain + worn signal", () => {
	      for (const text of [
	        "4번째 사진에 살짝 오염있지만 크게 표시나진 않아요",
	        "미세 오염 있는데 티는 안나요.",
	        "뒷면 작은 오염 있습니다.",
	      ]) {
	        const { conditionNotes } = conditionFromTextFashion(text, "clothing");
	        assert.ok(conditionNotes.includes("clothing_stain"),
	          `clothing_stain 없음 (${text}): ${conditionNotes.join(",")}`);
	        assert.ok(conditionNotes.includes("cosmetic_wear"),
	          `cosmetic_wear 없음 (${text}): ${conditionNotes.join(",")}`);
	      }
	    });

	    it("ready sweep: 색 바램없고/늘어남 심하지 않음/오염 및 하자 없음은 negation", () => {
	      const fading = conditionFromTextFashion("색 바램없고 카라 깨끗해요", "clothing");
	      assert.ok(!fading.conditionNotes.includes("clothing_fading"),
	        `색 바램없고 false positive: ${fading.conditionNotes.join(",")}`);

	      const stretch = conditionFromTextFashion("목 늘어남 심하지 않음 큰 오염 및 하자 없음", "clothing");
	      assert.ok(!stretch.conditionNotes.includes("clothing_stretched"),
	        `늘어남 심하지 않음 false positive: ${stretch.conditionNotes.join(",")}`);
	      assert.ok(!stretch.conditionNotes.includes("clothing_stain"),
	        `오염 및 하자 없음 false positive: ${stretch.conditionNotes.join(",")}`);
	      assert.ok(!stretch.conditionNotes.includes("repair_or_defect_signal"),
	        `하자 없음 false positive: ${stretch.conditionNotes.join(",")}`);
	    });

	    it("ready sweep integration: 의류 미세 오염은 A/S급이 아니라 C급 damage chip", () => {
	      const result = parseListingOptions({
	        title: "스투시 베이직 백로고 반팔 블랙 L",
	        description: "상태 좋고 미세 오염 있는데 티는 안나요.",
	        skuId: "clothing-stussy-basic-tee",
	        skuName: "Stussy Tee",
	        category: "clothing",
	      });
	      const grade = result.parsedJson.condition_grade as { tier?: string; chips?: string[] } | undefined;
	      assert.equal(result.conditionClass, "worn",
	        `conditionClass=${result.conditionClass}, notes=${result.conditionNotes.join(",")}`);
	      assert.equal(grade?.tier, "C", `grade=${JSON.stringify(grade)}`);
	      assert.ok(grade?.chips?.includes("damage:minor"),
	        `damage:minor chip 없음: ${JSON.stringify(grade?.chips)}`);
	    });

	    it("ready sweep integration: 색 바램없고는 grade damage로 떨어뜨리지 않음", () => {
	      const result = parseListingOptions({
	        title: "폴로 랄프로렌 셔츠",
	        description: "색 바램없고 카라 깨끗해요",
	        skuId: "clothing-polo-oxford-shirt",
	        skuName: "Polo Oxford Shirt",
	        category: "clothing",
	      });
	      const grade = result.parsedJson.condition_grade as { tier?: string; chips?: string[] } | undefined;
	      assert.notEqual(grade?.tier, "D", `색 바램없고가 D로 떨어짐: ${JSON.stringify(grade)}`);
	      assert.ok(!grade?.chips?.includes("damage:major"),
	        `damage:major false positive: ${JSON.stringify(grade?.chips)}`);
	    });

	    it("clothing integration — conditionNotes 채워짐 + flawed demote", () => {
	      const result = parseListingOptions({
        title: "스투시 후드 새상품",
        description: "보풀 있어요 색바램 있음",
        skuId: "clothing-stussy-hoodie",
        skuName: "Stussy Hoodie",
        category: "clothing",
      });
      assert.ok(result.conditionNotes.length > 0,
        `clothing conditionNotes 비어있음: ${JSON.stringify(result.conditionNotes)}`);
      assert.ok(result.conditionNotes.includes("clothing_pilling"));
	      assert.ok(result.conditionNotes.includes("clothing_fading"));
	    });
	  });

	  describe("Wave 948 — fashion condition deepsweep real phrases", () => {
	    it("신발 약간의 얼룩/이염 변형은 condition note + grade damage로 반영", () => {
	      const stain = conditionFromTextFashion("뒷쪽 약간의 얼룩있어 저렴하게팝니다", "shoe");
	      assert.ok(stain.conditionNotes.includes("shoe_stain_or_discoloration"),
	        `shoe_stain_or_discoloration 없음: ${stain.conditionNotes.join(",")}`);
	      assert.ok(stain.conditionNotes.includes("cosmetic_wear"),
	        `cosmetic_wear 없음: ${stain.conditionNotes.join(",")}`);

	      const yellowing = conditionFromTextFashion("신발장 보관하다 황변이 생김", "shoe");
	      assert.ok(yellowing.conditionNotes.includes("shoe_stain_or_discoloration"),
	        `황변 생김 shoe_stain_or_discoloration 없음: ${yellowing.conditionNotes.join(",")}`);

	      for (const text of [
	        "신발끈 오염 살짝잇음",
	        "앞코 부분에 얼룩 조금 있는 편입니다",
	        "새제품 이지만 밑창 부분이 살짝 변색되어있어요",
	        "스웨이드 재질 특성 상 얼룩 조금 있음",
	        "고무로 인한 검은 이염은 존재합니다",
	        "패브릭소재특성상 이염이 생깁니다.",
	        "보관하면서 변색이 온 듯 하나 세탁 맡기면 제거 가능하다 합니다.",
	        "1회 착용 이염 사진 참고해주세요!",
	        "마지막 사진 참고해주세요 (각각 이염, 스티커떨어짐, 사이즈 헐떡거려서 낡음)",
	      ]) {
	        const { conditionNotes } = conditionFromTextFashion(text, "shoe");
	        assert.ok(conditionNotes.includes("shoe_stain_or_discoloration"),
	          `shoe_stain_or_discoloration 없음 (${text}): ${conditionNotes.join(",")}`);
	      }

	      const boxStain = conditionFromTextFashion("박스만 변색이 좀 있고 신발은 완전 신품입니다", "shoe");
	      assert.ok(!boxStain.conditionNotes.includes("shoe_stain_or_discoloration"),
	        `박스 변색을 신발 오염으로 잘못 잡음: ${boxStain.conditionNotes.join(",")}`);
	      const notStain = conditionFromTextFashion("이건 이염도 아니고 제조과정 문제 같아요", "shoe");
	      assert.ok(!notStain.conditionNotes.includes("shoe_stain_or_discoloration"),
	        `이염도 아니고 negation 실패: ${notStain.conditionNotes.join(",")}`);

	      const hygiene = conditionFromTextFashion("가죽냄새 외에 악취(발냄새)가 조금 있습니다", "shoe");
	      assert.ok(hygiene.conditionNotes.includes("shoe_hygiene_warning"),
	        `shoe_hygiene_warning 없음: ${hygiene.conditionNotes.join(",")}`);

	      const result = parseListingOptions({
	        title: "[300]뉴발란스 992 메이드 인 USA 그레이",
	        description: "한두번 신다가 신발장 보관했습니다. 데님이랑 접하는 곳 이염 있습니다. 박스랑 신발택 그대로 있습니다.",
	        skuId: "shoe-newbalance-992",
	        skuName: "NB 992",
	        category: "shoe",
	      });
	      const grade = result.parsedJson.condition_grade as { tier?: string; chips?: string[] } | undefined;
	      assert.equal(result.conditionClass, "worn",
	        `conditionClass=${result.conditionClass}, notes=${result.conditionNotes.join(",")}`);
	      assert.equal(grade?.tier, "D", `grade=${JSON.stringify(grade)}`);
	      assert.ok(grade?.chips?.includes("damage:major"),
	        `damage:major chip 없음: ${JSON.stringify(grade?.chips)}`);
	    });
	  });

	  describe("Wave 960 — historical parsed fashion condition sweep regressions", () => {
	    it("신발 앞/갑피 찢김과 수선 가능 표현은 structural damage로 잡는다", () => {
	      const result = parseListingOptions({
	        title: "루이비통 뮬 슬리퍼",
	        description: "앞에 찢김이 있는데 이건 수선 가능하다고 합니다. 그외 상태 좋아요.",
	        skuId: "shoe-louis-vuitton-trainer",
	        skuName: "Louis Vuitton LV Trainer",
	        category: "shoe",
	      });
	      assert.ok(result.conditionNotes.includes("shoe_upper_structural_damage"),
	        `shoe_upper_structural_damage 없음: ${result.conditionNotes.join(",")}`);
	      assert.ok(result.conditionNotes.includes("repair_or_defect_signal"),
	        `repair_or_defect_signal 없음: ${result.conditionNotes.join(",")}`);
	      assert.equal(result.conditionClass, "flawed");
	    });

	    it("신발 당근식 찢김/뜯어짐 표현은 structural damage로 잡고 박스 하자는 제외한다", () => {
	      for (const text of [
	        "왼쪽신발 새끼발가락에 조금 찢어진거랑 밑창보강 하시는거를 추천드립니다",
	        "찢어진부분이 있어요",
	        "사놓고 두번신었는데 옆에가 살짝 찢어져버렸어요",
	        "측면에 조금 찢어졌습니다 그래도 깨끗하고 착용하는데 문제 없습니다",
	        "마지막사진보시면 뜯어짐있습니다",
	        "왼쪽안쪽 0.5미리정도 튿어져서 복원해놓았습니다",
	        "뒷축깨짐 쪼금 있습니다",
	        "왼쪽 뒷꿈치 걸이부분 뜯어짐 있으나 착용 문제 없습니다",
	      ]) {
	        const { conditionNotes } = conditionFromTextFashion(text, "shoe");
	        assert.ok(conditionNotes.includes("shoe_upper_structural_damage"),
	          `shoe_upper_structural_damage 없음 (${text}): ${conditionNotes.join(",")}`);
	      }

	      const boxOnly = conditionFromTextFashion("새상품이고 박스 살짝 찢어진 부분 있습니다", "shoe");
	      assert.ok(!boxOnly.conditionNotes.includes("shoe_upper_structural_damage"),
	        `박스 하자를 신발 하자로 잘못 잡음: ${boxOnly.conditionNotes.join(",")}`);
	      const noDamage = conditionFromTextFashion("찢어진대나 하자 없습니다", "shoe");
	      assert.ok(!noDamage.conditionNotes.includes("shoe_upper_structural_damage"),
	        `하자 없음 negation 실패: ${noDamage.conditionNotes.join(",")}`);
	    });

	    it("신발 AS 안내 문구만으로는 수선/하자 신호를 만들지 않는다", () => {
	      const { conditionNotes } = conditionFromTextFashion(
	        "새제품 시착도 안함. 유상 AS 수선 맡길 때 필요해서 보증서 같이 드려요.",
	        "shoe",
	      );
	      assert.ok(!conditionNotes.includes("shoe_upper_structural_damage"),
	        `AS 안내를 갑피 하자로 잘못 잡음: ${conditionNotes.join(",")}`);
	      assert.ok(!conditionNotes.includes("repair_or_defect_signal"),
	        `AS 안내를 수선 필요로 잘못 잡음: ${conditionNotes.join(",")}`);
	    });

	    it("의류 커피 이염같다/목택이염 표현은 stain chip으로 잡는다", () => {
	      for (const text of [
	        "사진상 커피 이염같은데 세탁은 안해봤어요.",
	        "카라는 깨끗한 편이고 목택이염 조금 있습니다.",
	        "사이즈 W28 L30 미세 이염 존재합니다.",
	        "옅은 이염 가슴, 팔쪽에 조금 있습니다.",
	        "생활이염 조금 있어요.",
	        "허벅지 연한이염 사진참조.",
	        "4번째 사진 이염 참고해주세요.",
	        "생활 오염 엉덩이 부분에 살짝 있습니다.",
	        "이염 좀 있어서 싸게 팝니다.",
	        "오염으로 상대방 구매거절 상품입니다.",
	        "전면부 약간 오염으로 저렴하게 올립니다.",
	        "미세 이염을 제외한 깔끔한 컨디션입니다.",
	      ]) {
	        const { conditionNotes } = conditionFromTextFashion(text, "clothing");
	        assert.ok(conditionNotes.includes("clothing_stain"),
	          `clothing_stain 없음 (${text}): ${conditionNotes.join(",")}`);
	        assert.ok(conditionNotes.includes("cosmetic_wear"),
	          `cosmetic_wear 없음 (${text}): ${conditionNotes.join(",")}`);
	      }
	    });

	    it("의류 안감 튿어짐/터진곳/올풀림은 structural damage로 잡는다", () => {
	      for (const text of [
	        "제품 상태는 양호하지만 안감 아랫부분에 튿어짐이 있습니다.",
	        "가슴쪽 주머니 아래 터진곳있습니다. 다시 박음질만 하시면 됩니다.",
	        "이염 및 미세구멍, 올풀림 등 있어서 확인 필요합니다.",
	      ]) {
	        const { conditionNotes } = conditionFromTextFashion(text, "clothing");
	        assert.ok(conditionNotes.includes("clothing_structural_damage"),
	          `clothing_structural_damage 없음 (${text}): ${conditionNotes.join(",")}`);
	        assert.ok(conditionNotes.includes("repair_or_defect_signal"),
	          `repair_or_defect_signal 없음 (${text}): ${conditionNotes.join(",")}`);
	      }
	    });

	    it("의류 로고 부분의 약한 벗겨짐도 print damage로 잡는다", () => {
	      const { conditionNotes } = conditionFromTextFashion(
	        "전체적으로 상태 좋지만 로고 부분에 약간의 벗겨짐 있습니다.",
	        "clothing",
	      );
	      assert.ok(conditionNotes.includes("clothing_print_cracked"),
	        `clothing_print_cracked 없음: ${conditionNotes.join(",")}`);
	    });

	    it("가방 안감/내부/이너백 얼룩과 태닝은 stain/discoloration으로 잡는다", () => {
	      for (const text of [
	        "이너백에 오염 조금 있습니다. 외관은 깨끗해요.",
	        "안감에 얼룩 있음.",
	        "사용감 적으나 내부 약간 노랗게 이염 있습니다.",
	        "태닝 진행된 상태이고 물 얼룩이 조금 있습니다.",
	        "각 모서리랑 앞판은 빈티지 가죽특성상 색바램은 조금 있습니다.",
	        "화장품등 이염이 느껴져서 싸게 올립니다.",
	        "생활 이염 다소 있습니다.",
	        "바닥에 이염 좀 있는데 사진 확인해주세요.",
	        "내부에 펜 자국이 많아요.",
	        "볼펜잉크자욱.이염.부분데미지 있습니다.",
	        "자크부분이 살짝변색되서 저렴하게 판매합니다.",
	        "손잡이 등 손떼 탄 부분 일부 있으며 이염부분은 사진 확인해 보세요.",
	        "화이트라 생활오염정도 있습니다.",
	        "오염도 많고 지퍼 부분 색바램도 있습니다.",
	        "살짝 이염이 보이는거 같아 싸게 팝니다.",
	        "이염이 좀 있지만 데일리로 들기 좋습니다.",
	        "화이트라 이염은 좀 있어요.",
	        "보관 관리를 잘 못해서 변색들이 존재해요.",
	        "9, 10번 사진에서 이염상태 확인하시면 됩니다.",
	      ]) {
	        const { conditionNotes } = conditionFromTextFashion(text, "bag");
	        assert.ok(conditionNotes.includes("bag_stain_or_discoloration"),
	          `bag_stain_or_discoloration 없음 (${text}): ${conditionNotes.join(",")}`);
	        assert.ok(conditionNotes.includes("cosmetic_wear"),
	          `cosmetic_wear 없음 (${text}): ${conditionNotes.join(",")}`);
	      }
	    });

	    it("가방 오타성 벚겨짐과 핸들/스트랩/그물 하자도 감가 신호로 잡는다", () => {
	      const peeling = conditionFromTextFashion("코팅 벚겨짐 조금 있고 내부 약간 노랗게 이염 있습니다.", "bag");
	      assert.ok(peeling.conditionNotes.includes("bag_leather_damage"),
	        `bag_leather_damage 없음: ${peeling.conditionNotes.join(",")}`);
	      assert.ok(peeling.conditionNotes.includes("bag_stain_or_discoloration"),
	        `bag_stain_or_discoloration 없음: ${peeling.conditionNotes.join(",")}`);

	      const handle = conditionFromTextFashion("발렌시아가 백 핸들부분 미세한 찢김 있음.", "bag");
	      assert.ok(handle.conditionNotes.includes("bag_handle_worn"),
	        `bag_handle_worn 없음: ${handle.conditionNotes.join(",")}`);

	      for (const text of [
	        "옆 그물에 볼펜을 넣고 다녔더니 튿어짐이있네요.",
	        "스트랩끈 끝부분 수선해야되나 수선가능함.",
	        "똑딱이 하나 빠짐 있어요.",
	        "크로스 끈 분실, 이염 사진 참고.",
	        "어깨끈 부분으로 한땀 올풀림 있습니다.",
	      ]) {
	        const { conditionNotes } = conditionFromTextFashion(text, "bag");
	        assert.ok(conditionNotes.includes("bag_handle_worn"),
	          `bag_handle_worn 없음 (${text}): ${conditionNotes.join(",")}`);
	      }

	      for (const text of [
	        "클러치 바닥이 좀 헤졌어요.",
	        "가죽 뜯김이 있어 확인 필요합니다.",
	        "상부 테두리 데미지와 손상 있으니 사진 확인 바랍니다.",
	      ]) {
	        const { conditionNotes } = conditionFromTextFashion(text, "bag");
	        assert.ok(conditionNotes.includes("bag_leather_damage"),
	          `bag_leather_damage 없음 (${text}): ${conditionNotes.join(",")}`);
	      }
	    });

	    it("가방 보관 냄새는 hygiene chip으로 잡는다", () => {
	      const { conditionNotes } = conditionFromTextFashion("외부 얼룩, 내부 보관 냄새 있습니다.", "bag");
	      assert.ok(conditionNotes.includes("bag_stain_or_discoloration"),
	        `bag_stain_or_discoloration 없음: ${conditionNotes.join(",")}`);
	      assert.ok(conditionNotes.includes("bag_hygiene_warning"),
	        `bag_hygiene_warning 없음: ${conditionNotes.join(",")}`);
	    });

	    it("가방 소재 장점/부자재 하자는 본품 오염으로 과탐지하지 않는다", () => {
	      const durable = conditionFromTextFashion("PVC 코팅 캔버스 소재라 생활오염과 스크래치에 강한 편입니다.", "bag");
	      assert.ok(!durable.conditionNotes.includes("bag_stain_or_discoloration"),
	        `소재 장점을 오염으로 잘못 잡음: ${durable.conditionNotes.join(",")}`);

	      const reflection = conditionFromTextFashion("색바램 아닌 빛 반사입니다.", "bag");
	      assert.ok(!reflection.conditionNotes.includes("bag_stain_or_discoloration"),
	        `빛 반사를 색바램으로 잘못 잡음: ${reflection.conditionNotes.join(",")}`);
	    });
	  });

  describe("worst-of merge — tier vs fashion notes", () => {
    it("tier=clean + fashion=flawed → flawed (lower wins)", () => {
      const result = parseListingOptions({
        title: "아디다스 가젤 270",
        description: "상태 좋아요 근데 하자가 있습니다",
        skuId: "shoe-adidas-gazelle",
        skuName: "Adidas Gazelle",
        category: "shoe",
      });
      assert.equal(result.conditionClass, "flawed",
        `worst-of 실패: ${result.conditionClass} (notes: ${result.conditionNotes.join(",")})`);
    });

    it("tier=mint + fashion=normal → mint 유지 (fashion 미신호 무시)", () => {
      // 'a_grade' tier signal only (description 에 'new_or_open_box' 안 박힘 — '미개봉' 패턴 없음).
      const result = parseListingOptions({
        title: "조던 1 미사용 새거",
        description: "한 번도 안 신었어요 시착만",
        skuId: "shoe-nike-jordan-1",
        skuName: "Jordan 1",
        category: "shoe",
      });
      // tier 가 a_grade → mint. fashion notes 가 'cosmetic_wear' 안 박혀 normal 이라 fashion 무시.
      // tier mint 유지 가능 (resolveConditionClass 결과 의존).
      assert.ok(
        result.conditionClass === "mint" || result.conditionClass === "unopened" || result.conditionClass === "clean",
        `tier=mint 보존 실패: ${result.conditionClass}`,
      );
    });
  });
});
