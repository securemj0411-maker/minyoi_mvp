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

  it("unopened beats low_batt", () => {
    // 새상품인데 배터리 저하는 비현실적이지만 우선순위 검증
    assert.equal(extractConditionClass(["new_or_open_box", "low_battery_health"]), "unopened");
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

  it("clean beats worn", () => {
    // S급 + 사용감 동시 마킹은 잘 안되지만 우선순위는 clean
    assert.equal(extractConditionClass(["good_condition", "cosmetic_wear"]), "clean");
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
