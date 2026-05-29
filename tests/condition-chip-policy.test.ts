import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyConditionChip,
  hardSplitChipSignature,
  shouldUseExactHardChipComparison,
  summarizeConditionChips,
} from "@/lib/condition-chip-policy";

describe("condition chip policy taxonomy", () => {
  it("hard/soft/premium chip을 비교 정책용으로 분류한다", () => {
    assert.equal(classifyConditionChip("condition:display_defect"), "hard_split");
    assert.equal(classifyConditionChip("condition:fashion_stain_or_discoloration"), "soft_adjustment");
    assert.equal(classifyConditionChip("wear:unworn"), "premium_signal");
    assert.equal(classifyConditionChip("unknown:future_chip"), "neutral");
  });

  it("hard split signature는 premium/soft chip에 흔들리지 않는다", () => {
    assert.equal(
      hardSplitChipSignature([
        "wear:unworn",
        "condition:camera_lens_damage",
        "condition:cosmetic_wear",
        "condition:display_defect",
      ]),
      "condition:camera_lens_damage|condition:display_defect",
    );
  });

  it("exact hard chip 비교는 condition 표본과 chip 표본이 모두 충분할 때만 켠다", () => {
    assert.deepEqual(
      shouldUseExactHardChipComparison({ sameConditionSamples: 4, sameHardChipSamples: 4 }),
      { ok: false, reason: "no_condition_density" },
    );
    assert.deepEqual(
      shouldUseExactHardChipComparison({ sameConditionSamples: 12, sameHardChipSamples: 1 }),
      { ok: false, reason: "chip_sparse" },
    );
    assert.deepEqual(
      shouldUseExactHardChipComparison({ sameConditionSamples: 12, sameHardChipSamples: 3 }),
      { ok: true, reason: "ready" },
    );
  });

  it("summary는 중복 chip을 제거하고 정책 bucket 별로 정렬한다", () => {
    assert.deepEqual(
      summarizeConditionChips([
        "condition:cosmetic_wear",
        "condition:display_defect",
        "condition:display_defect",
        "auth:kream",
      ]),
      {
        hardSplit: ["condition:display_defect"],
        softAdjustment: ["condition:cosmetic_wear"],
        premiumSignal: ["auth:kream"],
        neutral: [],
      },
    );
  });
});
