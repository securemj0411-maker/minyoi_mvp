// Wave 714 (2026-05-23): 의류 5-axis 라벨 → S/A/B/C/D tier + A+ flag.
//
// 등급 정의 (cross-tab agent a2d7c17a34f40235e raw data + 사용자 confirm):
//
//   S = strong 2축 이상 + 하자 없음
//       strong = {wear: unworn|worn_1to2|worn_3to5}
//              ∪ {box: full|tag_attached}
//              ∪ {auth: kream|store|season}     // season 포함 — 의류 3.27x
//              ∪ {extra: collab|self_grade}     // 의류 only strong
//       → ratio 1.7x+ (cluster-relative)
//
//   A = strong 1축 + 하자 없음
//       → ratio 1.2~1.7x
//
//   A+ flag (등급 추가 X, multiplier): damage=repair_pos (수선/줄임 사이즈 맞춤) +10%
//
//   B = default / 약한 매칭
//       → ratio 0.85~1.2x
//
//   C = damage:minor 또는 wear:used 또는 extra:x10_score
//       → ratio 0.5~0.85x
//
//   D = wear:vintage|heavily_used|gunje 또는 damage:major
//       → ratio <0.5x
//
// Cluster-relative ratio 필수 (의류 cluster baseline 5배 차이: premium_archive ₩350K vs casual_mass ₩72K).

import { labelClothingAxes, detectClothingBrandCluster } from "./clothing-axes";
import { chipsFromClothingAxes } from "./chips";
import type { ClothingAxisLabels, ConditionGrade, ConditionTier, BrandCluster } from "./types";

export interface ClothingGradeInput {
  name: string;
  description: string | null | undefined;
  enumLabel: string | null | undefined;
}

export function gradeClothingCondition(input: ClothingGradeInput): ConditionGrade {
  const cluster = detectClothingBrandCluster(input.name ?? "");
  const description = input.description ?? "";
  // Wave 714b (2026-05-23): length = name + description 합산 — 짧지만 명확한 signal 매물 grading 진행.
  const rawTextLength = (input.name?.length ?? 0) + description.length;
  const enumPrior = input.enumLabel ?? null;

  const { labels, positiveMatches, negativeMatches } = labelClothingAxes({
    name: input.name,
    description: input.description,
  });

  // raw text 부족 → UNKNOWN (false positive 차단).
  if (rawTextLength < 50) {
    const fallback = applyEnumPrior(enumPrior);
    return {
      tier: fallback,
      cluster,
      confidence: enumPrior ? 0.4 : 0.2,
      evidence: {
        positive: positiveMatches,
        negative: negativeMatches,
        axes: labels,
        rawTextLength,
        enumPrior,
        reason: `clothing raw_text_length=${rawTextLength} < 50, enum_prior=${enumPrior ?? "none"}`,
      },
      flags: buildFlags(labels),
      chips: chipsFromClothingAxes(labels),
    };
  }

  const { tier, reason } = classifyClothingByAxes(labels);

  let finalTier: ConditionTier = tier;
  let confidence = computeConfidence(positiveMatches.length, negativeMatches.length, rawTextLength);
  if (tier === "B" && positiveMatches.length === 0 && negativeMatches.length === 0 && enumPrior) {
    finalTier = applyEnumPrior(enumPrior);
    confidence = 0.45;
  }

  return {
    tier: finalTier,
    cluster,
    confidence,
    evidence: {
      positive: positiveMatches,
      negative: negativeMatches,
      axes: labels,
      rawTextLength,
      enumPrior,
      reason,
    },
    flags: buildFlags(labels),
    chips: chipsFromClothingAxes(labels),
  };
}

/**
 * 의류 axis → tier 분류.
 *
 * 의류 cross-tab 검증:
 *   미사용+시즌+콜라보 (A1+C4+E1) = 5.70x → S
 *   시즌 단독 = 3.27x → A (cluster-relative 적용 전엔 S 같지만 premium_archive cluster median 자체가 3.27x — cluster-rel 적용 시 1.0x baseline)
 *   미사용+kream alone = 1.73x → A
 *   풀구성+kream = 1.76x → A 경계
 *   구제 (A7) = 0.42x → D
 *   수선 (D4) = 1.59x → A+ flag (별도)
 *   "X/10" 점수 (E3) = 0.75x → C
 */
function classifyClothingByAxes(axes: ClothingAxisLabels): { tier: ConditionTier; reason: string } {
  // D tier — gunje / vintage / heavily_used / damage:major
  if (axes.wear === "gunje") {
    return { tier: "D", reason: "wear=gunje (구제, ~0.42x)" };
  }
  if (axes.wear === "vintage") {
    return { tier: "D", reason: "wear=vintage (~0.61x — 의류 빈티지 = 낡음)" };
  }
  if (axes.wear === "heavily_used") {
    return { tier: "D", reason: "wear=heavily_used (D)" };
  }
  if (axes.damage === "major") {
    return { tier: "D", reason: "damage=major (D)" };
  }

  // C tier — minor damage / used / X/10 점수
  if (axes.damage === "minor") {
    return { tier: "C", reason: "damage=minor (C)" };
  }
  if (axes.wear === "used") {
    return { tier: "C", reason: "wear=used (C)" };
  }
  if (axes.extra === "x10_score") {
    return { tier: "C", reason: "extra=x10_score (셀러 자술용 점수, C)" };
  }

  // S/A tier — strong axis count (damage = none 또는 repair_pos)
  const isUnwornOrLightlyUsed =
    axes.wear === "unworn" || axes.wear === "worn_1to2" || axes.wear === "worn_3to5";
  const hasBoxStrong = axes.box === "full" || axes.box === "tag_attached";
  const hasAuthStrong =
    axes.auth === "kream" || axes.auth === "store" || axes.auth === "season";
  const hasExtraStrong = axes.extra === "collab" || axes.extra === "self_grade";

  const strongCount =
    (isUnwornOrLightlyUsed ? 1 : 0) +
    (hasBoxStrong ? 1 : 0) +
    (hasAuthStrong ? 1 : 0) +
    (hasExtraStrong ? 1 : 0);

  if (strongCount >= 2) {
    return {
      tier: "S",
      reason: `clothing strong_axes=${strongCount} (S) — wear=${axes.wear}, box=${axes.box}, auth=${axes.auth}, extra=${axes.extra}`,
    };
  }

  if (strongCount === 1) {
    return {
      tier: "A",
      reason: `clothing strong_axes=1 (A) — wear=${axes.wear}, box=${axes.box}, auth=${axes.auth}, extra=${axes.extra}`,
    };
  }

  if (axes.auth === "musinsa") {
    return { tier: "A", reason: "border A — auth=musinsa" };
  }

  return { tier: "B", reason: "default baseline (B) — no strong axis matched" };
}

/**
 * A+ flag (의류 only) — 수선/줄임 = positive (1.59x).
 * 등급 추가 X. UI 표시 + 시세 +10% multiplier.
 */
function buildFlags(axes: ClothingAxisLabels): { tailored?: boolean; seasonAnchor?: boolean; collab?: boolean } {
  return {
    tailored: axes.damage === "repair_pos",
    seasonAnchor: axes.auth === "season",
    collab: axes.extra === "collab",
  };
}

function computeConfidence(positiveCount: number, negativeCount: number, rawTextLength: number): number {
  let conf = 0.5;
  if (positiveCount >= 3) conf = 0.92;
  else if (positiveCount === 2) conf = 0.82;
  else if (positiveCount === 1) conf = 0.7;
  if (negativeCount >= 2) conf = Math.min(conf, 0.85);
  if (rawTextLength < 100) conf = Math.max(0.3, conf - 0.15);
  return Math.round(conf * 100) / 100;
}

function applyEnumPrior(label: string | null): ConditionTier {
  switch (label) {
    case "NEW":
      return "A";
    case "LIKE_NEW":
      return "B";
    case "LIGHTLY_USED":
      return "B";
    case "HEAVILY_USED":
      return "C";
    case "DAMAGED":
      return "D";
    default:
      return "UNKNOWN";
  }
}

/**
 * 시세 계산 시 cluster-relative ratio 적용 helper.
 *
 * 의류는 cluster baseline 차이가 5배 (premium_archive ₩350K vs casual_mass ₩72K).
 * 같은 'S' 등급이라도 cluster 별로 표시 가격 다름.
 *
 * @param baseMedian cluster median price
 * @param grade tier + flags
 * @returns 추정 시세
 */
export function applyClusterRelativePricing(
  baseMedian: number,
  grade: ConditionGrade,
  tierWeight: number,
): number {
  let price = baseMedian * tierWeight;
  if (grade.flags?.tailored) price *= 1.1; // A+ flag — 수선
  // seasonAnchor / collab 은 이미 strong axis 로 등급 결정에 들어감 (이중가산 방지).
  return Math.round(price);
}
