export type ConditionChipPolicyKind =
  | "hard_split"
  | "soft_adjustment"
  | "premium_signal"
  | "neutral";

export type ConditionChipPolicySummary = {
  hardSplit: string[];
  softAdjustment: string[];
  premiumSignal: string[];
  neutral: string[];
};

export const HARD_SPLIT_CONDITION_CHIPS = [
  "condition:display_defect",
  "condition:device_body_damage",
  "condition:foldable_hinge_damage",
  "condition:screen_replaced",
  "condition:faceid_issue",
  "condition:camera_issue",
  "condition:camera_lens_damage",
  "condition:sim_or_carrier_issue",
  "condition:water_damage",
  "condition:locked_or_lost_signal",
  "condition:parts_only",
  "condition:repair_or_defect_signal",
  "condition:device_charging_or_sensor_issue",
  "condition:refurbished_or_repaired",
  "condition:earphone_single_side_unit",
  "condition:earphone_case_only",
  "condition:earphone_audio_issue",
  "condition:earphone_anc_issue",
  "condition:earphone_mic_issue",
  "condition:earphone_pairing_issue",
  "condition:earphone_battery_issue",
  "condition:earphone_physical_damage",
  "condition:shoe_sole_damage",
  "condition:clothing_structural_damage",
  "condition:clothing_print_cracked",
  "damage:major",
] as const;

export const SOFT_ADJUSTMENT_CONDITION_CHIPS = [
  "condition:low_battery_health",
  "condition:high_battery_cycles",
  "condition:cosmetic_wear",
  "condition:earphone_missing_parts",
  "condition:earphone_hygiene_warning",
  "condition:fashion_stain_or_discoloration",
  "condition:shoe_insole_missing",
  "condition:clothing_fading",
  "condition:clothing_stretched",
  "condition:clothing_pilling",
  "damage:minor",
] as const;

export const PREMIUM_SIGNAL_CONDITION_CHIPS = [
  "wear:unworn",
  "wear:worn_1to2",
  "wear:worn_3to5",
  "auth:kream",
  "auth:store",
  "auth:musinsa",
  "auth:season",
  "box:full",
  "box:box_included",
  "box:tag_attached",
  "box:tag_only_cut",
  "extra:extra_laces",
  "extra:insole_changed",
  "extra:charms",
  "damage:repair_pos",
  "extra:collab",
] as const;

const HARD_SPLIT_SET = new Set<string>(HARD_SPLIT_CONDITION_CHIPS);
const SOFT_ADJUSTMENT_SET = new Set<string>(SOFT_ADJUSTMENT_CONDITION_CHIPS);
const PREMIUM_SIGNAL_SET = new Set<string>(PREMIUM_SIGNAL_CONDITION_CHIPS);

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function classifyConditionChip(chip: string): ConditionChipPolicyKind {
  if (HARD_SPLIT_SET.has(chip)) return "hard_split";
  if (SOFT_ADJUSTMENT_SET.has(chip)) return "soft_adjustment";
  if (PREMIUM_SIGNAL_SET.has(chip)) return "premium_signal";
  return "neutral";
}

export function summarizeConditionChips(chips: unknown): ConditionChipPolicySummary {
  const summary: ConditionChipPolicySummary = {
    hardSplit: [],
    softAdjustment: [],
    premiumSignal: [],
    neutral: [],
  };
  for (const chip of stringArray(chips)) {
    const kind = classifyConditionChip(chip);
    if (kind === "hard_split") summary.hardSplit.push(chip);
    else if (kind === "soft_adjustment") summary.softAdjustment.push(chip);
    else if (kind === "premium_signal") summary.premiumSignal.push(chip);
    else summary.neutral.push(chip);
  }
  return {
    hardSplit: uniqueSorted(summary.hardSplit),
    softAdjustment: uniqueSorted(summary.softAdjustment),
    premiumSignal: uniqueSorted(summary.premiumSignal),
    neutral: uniqueSorted(summary.neutral),
  };
}

export function hardSplitChipSignature(chips: unknown): string {
  return summarizeConditionChips(chips).hardSplit.join("|");
}

export function shouldUseExactHardChipComparison(input: {
  sameConditionSamples: number;
  sameHardChipSamples: number;
  minConditionSamples?: number;
  minHardChipSamples?: number;
}): { ok: boolean; reason: "no_condition_density" | "chip_sparse" | "ready" } {
  const minConditionSamples = input.minConditionSamples ?? 8;
  const minHardChipSamples = input.minHardChipSamples ?? 3;
  if (input.sameConditionSamples < minConditionSamples) {
    return { ok: false, reason: "no_condition_density" };
  }
  if (input.sameHardChipSamples < minHardChipSamples) {
    return { ok: false, reason: "chip_sparse" };
  }
  return { ok: true, reason: "ready" };
}
