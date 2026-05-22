// Wave 714 (2026-05-23): Crocs 전용 grading — 박스 axis 무력, 지비츠 핵심.
//
// 신발 cross-tab 발견 (n=179 casual_parts):
//   - B1_full (풀구성) 1%만 — 박스 axis 무력
//   - 지비츠/스트랩 22.2% — Crocs 의 "박스 자리"
//   - C1_kream 3%만 — 정품 anchor 약함 (Vans/Converse 와 유사)
//   - A1_unworn alone n=9, 3.67x (sample 작아 outlier 가능)
//
// 별도 axis: wear / charms (지비츠) / auth / damage / shoe (E)
// Crocs S 정의: wear ∈ {unworn, worn_1to2} + charms_present + damage=none

import { labelShoeAxes } from "./shoe-axes";
import { chipsFromShoeAxes } from "./chips";
import type { BrandCluster, ConditionGrade, ConditionTier } from "./types";

interface CrocsInput {
  name: string;
  description: string | null | undefined;
}

const CHARMS_KEYWORDS = ["지비츠", "지비스", "jibbitz", "스트랩", "참 (charms)", "charms", "참여러개", "참 다수"];

function detectCrocsCharms(name: string, description: string | null): boolean {
  const text = `${name}\n${description ?? ""}`.toLowerCase();
  for (const kw of CHARMS_KEYWORDS) {
    if (text.includes(kw)) return true;
  }
  return false;
}

export function gradeCrocsCondition(
  input: CrocsInput,
  cluster: BrandCluster,
  rawTextLength: number,
  enumPrior: string | null,
): ConditionGrade {
  const { labels, positiveMatches, negativeMatches } = labelShoeAxes(input);
  const hasCharms = detectCrocsCharms(input.name, input.description ?? null);
  if (hasCharms) positiveMatches.push("지비츠");

  const chips = chipsFromShoeAxes(labels);
  if (hasCharms) chips.push("extra:charms");

  const baseEvidence = {
    positive: positiveMatches,
    negative: negativeMatches,
    axes: labels,
    rawTextLength,
    enumPrior,
  };

  const build = (
    tier: ConditionTier,
    confidence: number,
    reason: string,
  ): ConditionGrade => ({
    tier,
    cluster,
    confidence,
    evidence: { ...baseEvidence, reason },
    chips,
  });

  if (rawTextLength < 50) {
    const fallbackTier: ConditionTier = enumPrior === "NEW" ? "A" : "UNKNOWN";
    return build(fallbackTier, enumPrior ? 0.4 : 0.2, `crocs raw_text_length=${rawTextLength} < 50`);
  }

  // D — vintage / heavily_used / damage:major
  if (labels.wear === "vintage" || labels.wear === "heavily_used") {
    return build("D", 0.7, `crocs wear=${labels.wear} → D`);
  }
  if (labels.damage === "major") {
    return build("D", 0.75, "crocs damage=major → D");
  }

  // C — damage:minor / wear:used
  if (labels.damage === "minor" || labels.wear === "used") {
    const cause = labels.damage === "minor" ? "damage=minor" : "wear=used";
    return build("C", 0.7, `crocs ${cause} → C`);
  }

  // S/A — Crocs strong axis count (charms 가 box 자리)
  const isUnwornOrLightlyUsed =
    labels.wear === "unworn" || labels.wear === "worn_1to2" || labels.wear === "worn_3to5";
  const hasAuthAnchor = labels.auth === "kream" || labels.auth === "store";
  const strongCount = (isUnwornOrLightlyUsed ? 1 : 0) + (hasCharms ? 1 : 0) + (hasAuthAnchor ? 1 : 0);

  if (strongCount >= 2) {
    return build(
      "S",
      0.85,
      `crocs strong_axes=${strongCount} (S) — wear=${labels.wear}, charms=${hasCharms}, auth=${labels.auth}`,
    );
  }
  if (strongCount === 1) {
    return build(
      "A",
      0.7,
      `crocs strong_axes=1 (A) — wear=${labels.wear}, charms=${hasCharms}, auth=${labels.auth}`,
    );
  }

  return build("B", 0.5, "crocs baseline (B) — no strong axis");
}
