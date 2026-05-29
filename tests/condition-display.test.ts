import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { conditionNoteDisplayChips, mergeConditionDisplayChips } from "@/lib/condition-display";

describe("condition display chips", () => {
  it("휴대폰 구조 손상 condition_notes를 사용자 노출 chip key로 변환한다", () => {
    assert.deepEqual(
      conditionNoteDisplayChips(["device_body_damage", "foldable_hinge_damage", "display_defect"]),
      [
        "condition:device_body_damage",
        "condition:foldable_hinge_damage",
        "condition:display_defect",
      ],
    );
  });

  it("기존 신발/의류 grade chip과 전자기기 condition note chip을 중복 없이 합친다", () => {
    assert.deepEqual(
      mergeConditionDisplayChips(["wear:unworn", "condition:display_defect"], ["display_defect", "cosmetic_wear"]),
      ["condition:display_defect", "condition:cosmetic_wear", "wear:unworn"],
    );
  });

  it("이어폰 하드 신호 condition_notes를 사용자 언어 chip key로 변환한다", () => {
    assert.deepEqual(
      conditionNoteDisplayChips([
        "repair_or_defect_signal",
        "earphone_audio_issue",
        "earphone_anc_issue",
        "single_side_only",
        "earphone_single_side_unit",
      ]),
      [
        "condition:repair_or_defect_signal",
        "condition:earphone_audio_issue",
        "condition:earphone_anc_issue",
        "condition:earphone_single_side_unit",
      ],
    );
  });

  it("태블릿/워치 충전·센서 condition_notes를 사용자 노출 chip key로 변환한다", () => {
    assert.deepEqual(
      conditionNoteDisplayChips(["device_charging_or_sensor_issue"]),
      ["condition:device_charging_or_sensor_issue"],
    );
  });

  it("휴대폰 카메라 렌즈 손상 condition_notes를 사용자 노출 chip key로 변환한다", () => {
    assert.deepEqual(
      conditionNoteDisplayChips(["camera_lens_damage"]),
      ["condition:camera_lens_damage"],
    );
  });

  it("fashion historical sweep condition_notes를 사용자 노출 chip key로 변환한다", () => {
    assert.deepEqual(
      conditionNoteDisplayChips([
        "shoe_upper_structural_damage",
        "shoe_hygiene_warning",
        "bag_stain_or_discoloration",
        "bag_lining_damage",
        "bag_leather_damage",
        "bag_handle_worn",
        "bag_corner_worn",
      ]),
      [
        "condition:shoe_upper_damage",
        "condition:fashion_hygiene_warning",
        "condition:fashion_stain_or_discoloration",
        "condition:bag_lining_damage",
        "condition:bag_leather_damage",
        "condition:bag_handle_worn",
        "condition:bag_corner_worn",
      ],
    );
  });
});
