import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { extractConditionClass } from "@/lib/option-parser";

describe("Wave 130 — extractConditionClass", () => {
  it("returns 'normal' for empty notes", () => {
    assert.equal(extractConditionClass([]), "normal");
  });

  it("returns 'flawed' for display_defect (highest priority)", () => {
    assert.equal(extractConditionClass(["display_defect"]), "flawed");
  });

  it("flawed beats mint (worst signal wins)", () => {
    assert.equal(extractConditionClass(["new_or_open_box", "display_defect"]), "flawed");
  });

  it("returns 'flawed' for parts_only/screen_replaced/faceid_issue/water_damage", () => {
    assert.equal(extractConditionClass(["parts_only"]), "flawed");
    assert.equal(extractConditionClass(["screen_replaced"]), "flawed");
    assert.equal(extractConditionClass(["faceid_issue"]), "flawed");
    assert.equal(extractConditionClass(["water_damage"]), "flawed");
    assert.equal(extractConditionClass(["locked_or_lost_signal"]), "flawed");
    assert.equal(extractConditionClass(["multi_device_bundle"]), "flawed");
  });

  it("returns 'unopened' for new_or_open_box (after flawed check)", () => {
    // 2026-05-16 (N4 사용자 코멘트 id 104/109): unopened (박스 안 뜯음) 별도 클래스.
    // 이전: new_or_open_box → mint 합쳐졌으나 사용자 의도 = "민트랑 새상품 미개봉은 다르다".
    assert.equal(extractConditionClass(["new_or_open_box"]), "unopened");
  });

  it("returns 'low_batt' for low_battery_health (3rd priority)", () => {
    assert.equal(extractConditionClass(["low_battery_health"]), "low_batt");
  });

  it("low_batt beats unopened (v46: special — 가격 modifier 우선)", () => {
    // 2026-05-16 v46: low_batt 는 가격 modifier 라 condition ordering 밖에서 항상 우선.
    // 새상품인데 배터리 저하는 비현실적이지만 ordering 검증.
    assert.equal(extractConditionClass(["new_or_open_box", "low_battery_health"]), "low_batt");
  });

  it("returns 'clean' for good_condition/full_set/applecare_premium", () => {
    assert.equal(extractConditionClass(["good_condition"]), "clean");
    assert.equal(extractConditionClass(["full_set"]), "clean");
    assert.equal(extractConditionClass(["applecare_premium"]), "clean");
  });

  it("low_batt beats clean (배터리 저하가 더 강한 신호)", () => {
    assert.equal(extractConditionClass(["good_condition", "low_battery_health"]), "low_batt");
  });

  it("returns 'worn' for cosmetic_wear", () => {
    assert.equal(extractConditionClass(["cosmetic_wear"]), "worn");
  });

  it("worn beats clean (v46: 보수적 — negative 신호 우선)", () => {
    // 2026-05-16 v46 (사용자 정책 변경): negative description signal (cosmetic_wear) 우선.
    // 셀러가 "기스 있어요" 명시 = 정직. positive (good_condition) 는 인플레 가능. 보수적 선택.
    assert.equal(extractConditionClass(["good_condition", "cosmetic_wear"]), "worn");
  });

  it("ignores accessory_bundle (시세 산정에서 별도 차단되지만 condition_class에는 영향 X)", () => {
    // accessory_bundle은 condition이 아니라 본품+액세서리 묶음
    assert.equal(extractConditionClass(["accessory_bundle"]), "normal");
    assert.equal(extractConditionClass(["accessory_bundle", "cosmetic_wear"]), "worn");
  });

  it("handles non-array input gracefully", () => {
    assert.equal(extractConditionClass(undefined as unknown as string[]), "normal");
    assert.equal(extractConditionClass(null as unknown as string[]), "normal");
  });
});
