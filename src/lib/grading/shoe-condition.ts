// Wave 714 (2026-05-23): 신발 5-axis 라벨 → S/A/B/C/D tier.
//
// 등급 정의 (cross-tab agent ac955968c16adba21 raw data + 사용자 confirm):
//
//   S = 2축 이상 strong + 하자 없음
//       strong = {wear: unworn|worn_1to2|worn_3to5} ∪ {box: full} ∪ {auth: kream|store}
//       → ratio 1.85~2.31x, n ~150
//
//   A = 단일 strong + 하자 없음
//       → ratio 1.4~1.7x, n ~1,100
//
//   B = default / 약한 매칭 (대다수 매물)
//       → ratio 0.9~1.15x, n ~7,300
//
//   C = damage:minor 또는 wear:used
//       → ratio 0.5~0.7x, n ~280
//
//   D = wear:vintage 또는 wear:heavily_used 또는 damage:major
//       → ratio 0.35~0.5x, n ~700
//
// Crocs (casual_parts) 는 별도 — shoe-crocs.ts.
//
// 사용자 예시 검증: "박스 + 실착 1-2회 + kream" → S (cross-tab n=7, 2.02x ✓)

import { labelShoeAxes, detectShoeBrandCluster } from "./shoe-axes";
import { gradeCrocsCondition } from "./shoe-crocs";
import { chipsFromShoeAxes } from "./chips";
import type { AxisLabels, ConditionGrade, ConditionTier } from "./types";

export interface ShoeGradeInput {
  /** 매물 제목. */
  name: string;
  /** description_preview (raw). */
  description: string | null | undefined;
  /** bunjang_condition_label (prior only). */
  enumLabel: string | null | undefined;
}

/**
 * 신발 매물 → S/A/B/C/D tier 분류.
 *
 * False positive 철학:
 * - description < 50 char + 매칭 0건 → UNKNOWN (confidence 낮음, UI 신뢰도 표시)
 * - bunjang_condition_label 은 prior only (LIKE_NEW 데미지 raw 23% 섞임)
 * - upward fallback 금지 (D 매물에 S 시세 fallback 차단) — 사용자 비싸게 사도록 X
 */
export function gradeShoeCondition(input: ShoeGradeInput): ConditionGrade {
  const cluster = detectShoeBrandCluster(input.name ?? "");
  const description = input.description ?? "";
  // Wave 714b (2026-05-23): length = name + description 합산.
  //   이전: description 만. "노바블라스트5 270 새제품 정품 아식스코리아" (30자) 같이
  //   짧지만 명확한 signal 있는 매물도 UNKNOWN 으로 떨어짐 — false positive 차단 의도가 과도.
  //   개선: name(40자) + description(30자) = 70자 → axis 매칭 진행.
  const rawTextLength = (input.name?.length ?? 0) + description.length;
  const enumPrior = input.enumLabel ?? null;

  // Crocs 는 별도 경로 (박스 axis 무력, 지비츠 핵심).
  if (cluster === "casual_parts") {
    return gradeCrocsCondition(input, cluster, rawTextLength, enumPrior);
  }

  const { labels, positiveMatches, negativeMatches } = labelShoeAxes({
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
        reason: `raw_text_length=${rawTextLength} < 50, enum_prior=${enumPrior ?? "none"}`,
      },
      chips: chipsFromShoeAxes(labels),
    };
  }

  const { tier, reason } = classifyByAxes(labels);

  // 매칭 0건 → enum prior 사용 (보수적).
  let finalTier: ConditionTier = tier;
  let confidence = computeConfidence(positiveMatches.length, negativeMatches.length, rawTextLength);
  let finalReason = reason;
  if (tier === "B" && positiveMatches.length === 0 && negativeMatches.length === 0 && enumPrior) {
    finalTier = applyEnumPrior(enumPrior);
    confidence = 0.45;
  }
  // Wave 721 (2026-05-23): clothing-condition 동일 패턴 — single-signal vintage demote.
  //   신발 D-tier 매물 중 "빈티지" 단독 매칭 151건 (launch-80 발견)도 매장 boilerplate 다수.
  //   text-sanitize Wave 721 strip 이후 잔여 단독 매칭은 B로 demote.
  if (
    tier === "D"
    && labels.wear === "vintage"
    && positiveMatches.length === 1
    && positiveMatches[0] === "빈티지"
    && negativeMatches.length === 0
  ) {
    finalTier = "B";
    confidence = Math.min(confidence, 0.5);
    finalReason = "wear=vintage 단독 매칭 → B로 demote (Wave 721 — 매장 boilerplate 가능성 ↑)";
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
      reason: finalReason,
    },
    chips: chipsFromShoeAxes(labels),
  };
}

/**
 * AxisLabels → tier 분류 (hard rules).
 * 사용자 예시 + cross-tab 검증:
 *   "박스 + 실착 1-2회 + kream" → S (wear=worn_1to2, box=full, auth=kream, damage=none)
 *   "박스 + 미시착" alone → S 경계 (n=55, 1.57x — 보더라인 S 처리)
 *   "kream + 미시착" alone → S (n=61, 2.31x)
 */
function classifyByAxes(axes: AxisLabels): { tier: ConditionTier; reason: string } {
  // D tier — vintage 또는 heavily_used 또는 damage:major
  if (axes.wear === "vintage") {
    return { tier: "D", reason: "wear=vintage (D, ~0.45x)" };
  }
  if (axes.wear === "heavily_used") {
    return { tier: "D", reason: "wear=heavily_used (D, ~0.45x)" };
  }
  if (axes.damage === "major") {
    return { tier: "D", reason: "damage=major (D, ~0.35-0.55x)" };
  }

  // C tier — damage:minor 또는 wear:used
  if (axes.damage === "minor") {
    return { tier: "C", reason: "damage=minor (C, ~0.6-0.7x)" };
  }
  if (axes.wear === "used") {
    return { tier: "C", reason: "wear=used (C, ~0.6-0.7x)" };
  }

  // S/A tier — strong axis 개수 count (damage=none 필수)
  const isUnwornOrLightlyUsed =
    axes.wear === "unworn" || axes.wear === "worn_1to2" || axes.wear === "worn_3to5";
  const hasBoxFull = axes.box === "full";
  const hasAuthAnchor = axes.auth === "kream" || axes.auth === "store";

  const strongCount =
    (isUnwornOrLightlyUsed ? 1 : 0) + (hasBoxFull ? 1 : 0) + (hasAuthAnchor ? 1 : 0);

  if (strongCount >= 2) {
    return {
      tier: "S",
      reason: `strong_axes=${strongCount} (S, ~1.85-2.3x) — wear=${axes.wear}, box=${axes.box}, auth=${axes.auth}`,
    };
  }

  if (strongCount === 1) {
    return {
      tier: "A",
      reason: `strong_axes=1 (A, ~1.4-1.7x) — wear=${axes.wear}, box=${axes.box}, auth=${axes.auth}`,
    };
  }

  // box_included 단독 OR auth=musinsa 단독 → A 경계 (보더라인)
  if (axes.box === "box_included" || axes.auth === "musinsa") {
    return { tier: "A", reason: `border A — box=${axes.box}, auth=${axes.auth}` };
  }

  // 매칭 약함 → B (default)
  return { tier: "B", reason: "default baseline (B, ~1.0x) — no strong axis matched" };
}

/**
 * Raw 표현 매칭 수 + length → confidence (0~1).
 */
function computeConfidence(positiveCount: number, negativeCount: number, rawTextLength: number): number {
  let conf = 0.5;
  if (positiveCount >= 3) conf = 0.92;
  else if (positiveCount === 2) conf = 0.82;
  else if (positiveCount === 1) conf = 0.7;
  if (negativeCount >= 2) conf = Math.min(conf, 0.85);
  if (rawTextLength < 100) conf = Math.max(0.3, conf - 0.15);
  return Math.round(conf * 100) / 100;
}

/**
 * bunjang enum prior → tier (raw 표현 매칭 0건 fallback).
 * Sweep 결과: LIKE_NEW 데미지 raw 15.9%, LIGHTLY_USED 데미지 23.1% — 신뢰도 낮아 보수적.
 */
function applyEnumPrior(label: string | null): ConditionTier {
  switch (label) {
    case "NEW":
      return "A"; // 'S' 직접 매칭 X — 보수적 (raw 새상품 표현 60.3% 확인 필요)
    case "LIKE_NEW":
      return "B"; // 데미지 15.9% 섞임 — 보수적
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
