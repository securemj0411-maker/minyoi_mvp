// Wave 257 (2026-05-20): architecture flip — AI default + regex whitelist fast-path.
//   사용자 근원적 지적: "regex 가 100% 확신 못 하는 모든 자연어 → AI"
//   기존 (Wave 141B + 256): regex confident + 일부 AI escalation.
//     문제: "기스 진심 없" 같은 변형 regex 못 잡으면 AI 안 거치고 confident normal 박힘.
//   새: high-confidence whitelist (6 fast-path) 만 AI skip. 그 외 모두 AI default.
//
// 본 test 는 6 fast-path 결정 logic 검증 (실제 AI 호출 X).

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// tick-pipeline.ts:1750 와 동일 fast-path 결정 함수 (test 가 hard-code).
type FastPathInput = {
  text: string;
  bunjangLabelMapped: string | null;
  conditionNotes: string[];
  batteryHealth: number | null;
  batteryCycles: number | null;
  descriptionLength: number;
};

function computeFastPathReasons(input: FastPathInput): string[] {
  const reasons: string[] = [];
  const text = input.text.toLowerCase();

  if (input.bunjangLabelMapped !== null) {
    reasons.push("bunjang_label_explicit");
  }
  const hasExplicitUnopened = /미개봉|단순개봉|박스\s*(?:미개봉|새상품)|포장\s*(?:미개봉|안\s*뜯|안뜯)|개봉\s*(?:안\s*함|안함)|뜯지\s*않은|언박싱\s*전|brand\s*new|미\s*뜯/.test(text);
  const noMeasurement = (input.batteryHealth === null || input.batteryHealth === 0) &&
                         (input.batteryCycles === null || input.batteryCycles === 0);
  if (hasExplicitUnopened && noMeasurement) {
    reasons.push("explicit_unopened_no_measurement");
  }
  if (/(?:공식\s*리퍼|애플\s*리퍼|apple\s*refurbished|factory\s*refurbished|리퍼\s*폰?\s*미개봉|리퍼\s*박스\s*미개봉)/.test(text)) {
    reasons.push("explicit_factory_refurbished");
  }
  const strongFlawedNotes = ["display_defect", "screen_replaced", "faceid_issue", "water_damage",
    "parts_only", "locked_or_lost_signal", "refurbished_or_repaired", "buying_post",
    "single_side_only", "accessory_compatible_for_other_product", "multi_device_bundle"];
  if (input.conditionNotes.some((n) => strongFlawedNotes.includes(n))) {
    reasons.push("strong_flawed_note_regex_confident");
  }
  const hasObjBatteryHigh = input.batteryHealth !== null && input.batteryHealth >= 95;
  const hasObjBatteryLow = input.batteryHealth !== null && input.batteryHealth < 85;
  if (hasObjBatteryHigh || hasObjBatteryLow) {
    reasons.push("objective_battery_signal");
  }
  if (input.descriptionLength < 20) {
    reasons.push("description_too_short");
  }
  return reasons;
}

const baseInput: FastPathInput = {
  text: "",
  bunjangLabelMapped: null,
  conditionNotes: [],
  batteryHealth: null,
  batteryCycles: null,
  descriptionLength: 100,
};

describe("Wave 257 — AI default architecture", () => {
  describe("Fast-path 1: bunjang label 명시 (AI skip)", () => {
    it("bunjang NEW → fast-path", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "아이폰 16 일반 설명", bunjangLabelMapped: "unopened", descriptionLength: 50 });
      assert.ok(r.includes("bunjang_label_explicit"));
    });

    it("bunjang DAMAGED → fast-path (FLAWED 신뢰)", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "아이폰 사용감 좀", bunjangLabelMapped: "flawed", descriptionLength: 50 });
      assert.ok(r.includes("bunjang_label_explicit"));
    });

    it("bunjang null → fast-path X (AI default)", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "아이폰 깨끗", bunjangLabelMapped: null, descriptionLength: 50 });
      assert.ok(!r.includes("bunjang_label_explicit"));
    });
  });

  describe("Fast-path 2: 박스 미개봉 + measurement 모순 없음", () => {
    it("'박스 미개봉' + battery null → fast-path", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "아이폰 16 박스 미개봉 새상품", descriptionLength: 50 });
      assert.ok(r.includes("explicit_unopened_no_measurement"));
    });

    it("'미개봉' + battery 98% → fast-path X (모순 — 진짜 미개봉이면 측정 불가)", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "아이폰 16 미개봉", batteryHealth: 98, descriptionLength: 50 });
      assert.ok(!r.includes("explicit_unopened_no_measurement"));
    });

    it("'박스 미개봉' + cycle 100 → fast-path X (모순)", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "아이폰 박스 미개봉", batteryCycles: 100, descriptionLength: 50 });
      assert.ok(!r.includes("explicit_unopened_no_measurement"));
    });
  });

  describe("Fast-path 3: 공식 리퍼 명시", () => {
    it("'애플 리퍼' → fast-path", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "아이폰 14 애플 리퍼 미개봉", descriptionLength: 50 });
      assert.ok(r.includes("explicit_factory_refurbished"));
    });

    it("'apple refurbished' → fast-path", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "iphone 13 apple refurbished factory", descriptionLength: 50 });
      assert.ok(r.includes("explicit_factory_refurbished"));
    });
  });

  describe("Fast-path 4: strong flawed note (regex 자신감 case)", () => {
    it("display_defect → fast-path", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "액정 깨짐", conditionNotes: ["display_defect"], descriptionLength: 50 });
      assert.ok(r.includes("strong_flawed_note_regex_confident"));
    });

    it("water_damage → fast-path", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "침수", conditionNotes: ["water_damage"], descriptionLength: 50 });
      assert.ok(r.includes("strong_flawed_note_regex_confident"));
    });

    it("buying_post → fast-path", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "구함", conditionNotes: ["buying_post"], descriptionLength: 50 });
      assert.ok(r.includes("strong_flawed_note_regex_confident"));
    });

    it("cosmetic_wear 만 (weak signal) → fast-path X (AI default — 변형 risk)", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "사용감", conditionNotes: ["cosmetic_wear"], descriptionLength: 50 });
      assert.ok(!r.includes("strong_flawed_note_regex_confident"));
    });
  });

  describe("Fast-path 5: 객관적 battery signal", () => {
    it("battery 98% → fast-path (high)", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "일반", batteryHealth: 98, descriptionLength: 50 });
      assert.ok(r.includes("objective_battery_signal"));
    });

    it("battery 78% → fast-path (low)", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "일반", batteryHealth: 78, descriptionLength: 50 });
      assert.ok(r.includes("objective_battery_signal"));
    });

    it("battery 90% (모호 zone) → fast-path X (AI default)", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "일반", batteryHealth: 90, descriptionLength: 50 });
      assert.ok(!r.includes("objective_battery_signal"));
    });
  });

  describe("Fast-path 6: description 너무 짧음", () => {
    it("description 10자 → fast-path (AI 호출 비용 낭비 차단)", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "아이폰 16", descriptionLength: 10 });
      assert.ok(r.includes("description_too_short"));
    });

    it("description 100자 → fast-path X (AI default)", () => {
      const r = computeFastPathReasons({ ...baseInput, text: "긴 description", descriptionLength: 100 });
      assert.ok(!r.includes("description_too_short"));
    });
  });

  describe("사용자 검증 시나리오 — AI default 확인", () => {
    it("pid 405343339 '메인보드 손상이 있어서... 하자 일절 없습니다' → AI default", () => {
      // 자연어 description 길고, bunjang label null, strong flawed note 없음, battery null
      const r = computeFastPathReasons({
        ...baseInput,
        text: "메인보드 손상이 있어서 저렴하게 판매합니다 이외 부분 기능에는 하자 일절 없습니다",
        bunjangLabelMapped: null,
        conditionNotes: [],
        descriptionLength: 200,
      });
      assert.deepEqual(r, [], `예상: AI default. 실제 fast-path 발화: ${r.join(", ")}`);
    });

    it("'기스 진심 없습니다' (변형) → AI default", () => {
      const r = computeFastPathReasons({
        ...baseInput,
        text: "아이폰 16프로 기스 진심 없습니다 깨끗하게 사용했어요",
        descriptionLength: 100,
      });
      assert.deepEqual(r, [], `예상: AI default. 실제: ${r.join(", ")}`);
    });

    it("'떨어뜨려서 충격받은적 전혀없습니다' (변형) → AI default", () => {
      const r = computeFastPathReasons({
        ...baseInput,
        text: "아이폰 16 떨어뜨려서 충격받은적 전혀없습니다 상태 좋아요",
        descriptionLength: 100,
      });
      assert.deepEqual(r, [], `예상: AI default. 실제: ${r.join(", ")}`);
    });

    it("'공식 리퍼 미개봉' → fast-path (AI skip 정당)", () => {
      const r = computeFastPathReasons({
        ...baseInput,
        text: "아이폰 14 애플 리퍼 미개봉 박스 그대로",
        descriptionLength: 50,
      });
      assert.ok(r.includes("explicit_factory_refurbished"));
    });

    it("bunjang NEW + description 자연어 → fast-path (셀러 명시 신뢰)", () => {
      const r = computeFastPathReasons({
        ...baseInput,
        text: "아이폰 깨끗한 상태",
        bunjangLabelMapped: "unopened",
        descriptionLength: 50,
      });
      assert.ok(r.includes("bunjang_label_explicit"));
    });
  });

  describe("비용 추정 시나리오 (sample)", () => {
    // 정확한 prod baseline 측정은 1주 후 실제 logging 후.
    // 본 test 는 카테고리별 fast-path 통과 비율 sanity check.
    const cases = [
      { name: "bunjang label 매물 (37% prod)", input: { ...baseInput, bunjangLabelMapped: "clean", descriptionLength: 100 }, expectFastPath: true },
      { name: "장문 description (자연어) — AI default", input: { ...baseInput, descriptionLength: 500, text: "아이폰 사용하다가 판매" }, expectFastPath: false },
      { name: "battery 100% — AI skip", input: { ...baseInput, batteryHealth: 100, descriptionLength: 50 }, expectFastPath: true },
      { name: "짧은 desc — AI skip", input: { ...baseInput, descriptionLength: 15 }, expectFastPath: true },
    ];
    for (const c of cases) {
      it(c.name, () => {
        const r = computeFastPathReasons(c.input);
        assert.equal(r.length > 0, c.expectFastPath, `fast-path 예상: ${c.expectFastPath}, 실제: ${r.join(", ") || "(AI default)"}`);
      });
    }
  });
});
