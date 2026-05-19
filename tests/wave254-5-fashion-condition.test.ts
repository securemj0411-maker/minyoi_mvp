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

    it("parser_version shoe = wave92-shoe-v8 (v7 → v8 bump)", () => {
      const result = parseListingOptions({
        title: "나이키 덩크 로우",
        description: "270",
        skuId: "shoe-nike-dunk-low",
        skuName: "Nike Dunk Low",
        category: "shoe",
      });
      assert.equal(result.parserVersion, "wave92-shoe-v8",
        `parser_version mismatch: ${result.parserVersion}`);
    });

    it("parser_version bag = wave92-fashion-mobility-v7 (변경 없음 — step 2 대기)", () => {
      const result = parseListingOptions({
        title: "구찌 마몬트 토트백",
        description: "정품",
        skuId: "bag-gucci-marmont",
        skuName: "Gucci Marmont",
        category: "bag",
      });
      assert.equal(result.parserVersion, "wave92-fashion-mobility-v7",
        `bag parser_version 잘못 변경: ${result.parserVersion}`);
      // bag conditionNotes 는 빈 배열 유지 (step 2 까지).
      assert.deepEqual(result.conditionNotes, []);
    });

    it("parser_version clothing = wave216-clothing-v7 (변경 없음 — step 3 대기)", () => {
      const result = parseListingOptions({
        title: "스투시 후드",
        description: "L 사이즈",
        skuId: "clothing-stussy-hoodie",
        skuName: "Stussy Hoodie",
        category: "clothing",
      });
      assert.equal(result.parserVersion, "wave216-clothing-v7",
        `clothing parser_version 잘못 변경: ${result.parserVersion}`);
      // clothing conditionNotes 는 빈 배열 유지 (step 3 까지).
      assert.deepEqual(result.conditionNotes, []);
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
