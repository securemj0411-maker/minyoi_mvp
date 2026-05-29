// 2026-05-29: condition_notes -> 사용자 노출 chip key.
// 신발/의류 condition_grade.chips 와 전자기기 condition_notes 가 UI에서 갈라져
// "뒷판 깨짐" 같은 하자 근거가 안 보이던 drift 차단.

const CONDITION_NOTE_CHIP_BY_NOTE: Record<string, string> = {
  display_defect: "condition:display_defect",
  device_body_damage: "condition:device_body_damage",
  foldable_hinge_damage: "condition:foldable_hinge_damage",
  screen_replaced: "condition:screen_replaced",
  faceid_issue: "condition:faceid_issue",
  camera_issue: "condition:camera_issue",
  sim_or_carrier_issue: "condition:sim_or_carrier_issue",
  water_damage: "condition:water_damage",
  locked_or_lost_signal: "condition:locked_or_lost_signal",
  parts_only: "condition:parts_only",
  repair_or_defect_signal: "condition:repair_or_defect_signal",
  refurbished_or_repaired: "condition:refurbished_or_repaired",
  low_battery_health: "condition:low_battery_health",
  high_battery_cycles: "condition:high_battery_cycles",
  cosmetic_wear: "condition:cosmetic_wear",
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function conditionNoteDisplayChips(notes: unknown): string[] {
  const out: string[] = [];
  for (const note of asStringArray(notes)) {
    const chip = CONDITION_NOTE_CHIP_BY_NOTE[note];
    if (chip && !out.includes(chip)) out.push(chip);
  }
  return out;
}

export function mergeConditionDisplayChips(
  gradeChips: unknown,
  conditionNotes: unknown,
): string[] | null {
  const out = [
    ...conditionNoteDisplayChips(conditionNotes),
    ...asStringArray(gradeChips),
  ].filter((chip, index, arr) => arr.indexOf(chip) === index);
  return out.length > 0 ? out : null;
}
