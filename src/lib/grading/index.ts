// Wave 714 (2026-05-23): 신발/의류 condition grading entry point.

export type {
  ConditionTier,
  BrandCluster,
  ConditionGrade,
  ConditionFlags,
  TierEvidence,
  AxisLabels,
  ClothingAxisLabels,
} from "./types";
export { TIER_WEIGHT, TIER_LADDER } from "./types";

// Shoe
export { gradeShoeCondition } from "./shoe-condition";
export type { ShoeGradeInput } from "./shoe-condition";
export { labelShoeAxes, detectShoeBrandCluster } from "./shoe-axes";
export type { LabelInput } from "./shoe-axes";
export { gradeCrocsCondition } from "./shoe-crocs";

// Clothing
export { gradeClothingCondition, applyClusterRelativePricing } from "./clothing-condition";
export type { ClothingGradeInput } from "./clothing-condition";
export { labelClothingAxes, detectClothingBrandCluster } from "./clothing-axes";
export type { ClothingLabelInput } from "./clothing-axes";

// Shared
export { sanitizeForGrading } from "./text-sanitize";
export { weightedNeighborPrice } from "./neighbor-weighted-price";
export type { TierSample, WeightedPriceOptions, WeightedPriceResult } from "./neighbor-weighted-price";

// Chip 정규화 (UI / 필터 / /me 페이지 상세보기)
export {
  CHIP_LABELS,
  chipsFromShoeAxes,
  chipsFromClothingAxes,
  getChipLabel,
} from "./chips";
export type { ChipKey, ChipLabel } from "./chips";
