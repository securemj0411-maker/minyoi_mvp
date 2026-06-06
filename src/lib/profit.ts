import type { CandidateBand, CandidateSignal, CashoutHint, ListingCandidate } from "@/lib/types";
import { summarizeConditionChips } from "@/lib/condition-chip-policy";

export const SELLING_FEE_RATE = 0.035;
export const RESELL_SHIPPING_FEE = 3500;
export const SAFETY_BUFFER = 5000;

function isDaangnSource(source: string | null | undefined) {
  const value = String(source ?? "").trim().toLowerCase();
  return value === "daangn" || value === "daangnmarket" || value === "danggn";
}

export function sellingFeeForMarketPrice(marketPrice: number, marketplaceSource?: string | null) {
  if (!Number.isFinite(marketPrice) || marketPrice <= 0) return 0;
  if (isDaangnSource(marketplaceSource)) return 0;
  return Math.round(marketPrice * SELLING_FEE_RATE);
}

export function resellShippingFeeForSource(marketplaceSource?: string | null) {
  return isDaangnSource(marketplaceSource) ? 0 : RESELL_SHIPPING_FEE;
}

export function safetyBufferForSource(marketplaceSource?: string | null) {
  return isDaangnSource(marketplaceSource) ? 0 : SAFETY_BUFFER;
}

const SOFT_CONDITION_RESALE_ADJUSTMENTS: Record<string, {
  rate: number;
  min: number;
  max: number;
  skipConditionClasses?: readonly string[];
}> = {
  "condition:low_battery_health": { rate: 0.06, min: 8_000, max: 35_000, skipConditionClasses: ["low_batt"] },
  "condition:high_battery_cycles": { rate: 0.05, min: 6_000, max: 25_000, skipConditionClasses: ["low_batt"] },
  "condition:cosmetic_wear": { rate: 0.03, min: 3_000, max: 15_000, skipConditionClasses: ["worn"] },
  "condition:repair_or_defect_signal": { rate: 0.06, min: 8_000, max: 30_000 },
  "condition:earphone_missing_parts": { rate: 0.04, min: 5_000, max: 20_000 },
  "condition:earphone_hygiene_warning": { rate: 0.03, min: 3_000, max: 12_000 },
  "condition:fashion_stain_or_discoloration": { rate: 0.08, min: 5_000, max: 35_000 },
  "condition:fashion_hygiene_warning": { rate: 0.05, min: 4_000, max: 20_000 },
  "condition:bag_handle_worn": { rate: 0.06, min: 5_000, max: 30_000 },
  "condition:bag_corner_worn": { rate: 0.06, min: 5_000, max: 30_000 },
  "condition:shoe_insole_missing": { rate: 0.04, min: 3_000, max: 12_000 },
  "condition:clothing_fading": { rate: 0.06, min: 4_000, max: 25_000 },
  "condition:clothing_stretched": { rate: 0.06, min: 4_000, max: 25_000 },
  "condition:clothing_pilling": { rate: 0.04, min: 3_000, max: 15_000 },
  "damage:minor": { rate: 0.06, min: 5_000, max: 25_000 },
};

export function conditionResaleAdjustmentKrw(input: {
  marketPrice: number | null | undefined;
  conditionChips?: unknown;
  conditionClass?: string | null;
  conditionTier?: string | null;
}) {
  const marketPrice = Number(input.marketPrice ?? 0);
  if (!Number.isFinite(marketPrice) || marketPrice <= 0) return 0;
  const softChips = summarizeConditionChips(input.conditionChips).softAdjustment;
  if (softChips.length === 0) return 0;

  let total = 0;
  for (const chip of softChips) {
    const policy = SOFT_CONDITION_RESALE_ADJUSTMENTS[chip];
    if (!policy) continue;
    if (input.conditionClass && policy.skipConditionClasses?.includes(input.conditionClass)) continue;
    const rateAmount = Math.round(marketPrice * policy.rate);
    total += Math.min(policy.max, Math.max(policy.min, rateAmount));
  }

  const cap = Math.min(50_000, Math.round(marketPrice * 0.2));
  return Math.max(0, Math.min(cap, total));
}

export function expectedProfitFromMarketPrice(input: {
  buyPrice: number;
  marketPrice: number | null | undefined;
  buyShipping: number;
  marketplaceSource?: string | null;
  conditionChips?: unknown;
  conditionClass?: string | null;
  conditionTier?: string | null;
}) {
  const marketPrice = Number(input.marketPrice ?? 0);
  const buyPrice = Number(input.buyPrice ?? 0);
  if (!Number.isFinite(marketPrice) || marketPrice <= 0 || !Number.isFinite(buyPrice) || buyPrice <= 0) return null;
  const conditionAdjustment = conditionResaleAdjustmentKrw({
    marketPrice,
    conditionChips: input.conditionChips,
    conditionClass: input.conditionClass,
    conditionTier: input.conditionTier,
  });
  const adjustedMarketPrice = Math.max(0, marketPrice - conditionAdjustment);
  if (adjustedMarketPrice <= 0) return null;
  const sellFee = sellingFeeForMarketPrice(adjustedMarketPrice, input.marketplaceSource);
  const resellShipping = resellShippingFeeForSource(input.marketplaceSource);
  const safetyBuffer = safetyBufferForSource(input.marketplaceSource);
  return {
    min: Math.max(0, Math.round(adjustedMarketPrice - (buyPrice + input.buyShipping) - sellFee - resellShipping - safetyBuffer)),
    max: Math.max(0, Math.round(adjustedMarketPrice - buyPrice - sellFee - resellShipping - safetyBuffer)),
    sellFee,
    resellShipping,
    safetyBuffer,
    conditionAdjustment,
  };
}
// Wave 811 (2026-05-30): fatal keyword 대폭 보강. 가품 의심 + 파손 + 리퍼 + 병행수입 차단.
//   기존 12개 → 30+. 사용자 신뢰 ↑ + 시세 표본 왜곡 ↓.
const FATAL_LISTING_KEYWORDS = [
  // 가품/짝퉁 (확장)
  "타오바오", "타오바이", "taobao", "tao bao",
  "짭", "짭짤", "짭품",
  "가품", "짝퉁", "짝뚱",
  "레플", "레플리카", "replica", "repl",
  "이미테이션", "imitation",
  "정품아님", "정품 아님", "정품아니", "정품 아니",
  "비정품",
  // 미러/퀄리티/등급 표현 (가품 표현)
  "미러", "mirror",
  "1:1", "1대1 quality", "1:1 퀄리티",
  "퀄리티", "quality", " 퀄 ",
  "디테일급",  // 가품 등급
  "오버런", "overrun",
  "도배",  // 도배품
  // 파손/하자 (시세 왜곡 fatal)
  "벽돌", "벽돌됨", "벽돌화",
  "배터리 부풀음", "배터리부풀음", "배터리 부풀어", "배터리부풀",
  "디스플레이 깨짐", "디스플레이깨짐", "액정 깨짐", "액정깨짐",
  "메인보드 고장", "메인보드고장", "보드 고장",
  "메인보드만", "보드만",
  "기판만", "기판 부품",
  "내부 파손", "내부파손",
  // 리퍼비시 (시세 다름)
  "리퍼비시", "리퍼 비시", "refurbished", "refurb",
  // 매입글
  "삽니다", "구합니다", "구매", "구매합니다", "매입", "매입가",
  // 부품 / 단편
  "부품만", "부품 판매", "부품용",
];

// Wave 811: incomplete airpods/buds 변형 키워드 보강.
const INCOMPLETE_AIRPODS_KEYWORDS = [
  // 기존
  "왼쪽", "오른쪽", "좌측", "우측",
  "한쪽", "한짝", "한 짝", "한짝만",
  "좌 유닛", "우 유닛", "좌유닛", "우유닛",
  "유닛만", "유닛 만",
  // 추가 변형
  "L 유닛", "R 유닛", "l유닛", "r유닛",
  "left only", "right only",
  "왼쪽만", "오른쪽만",
  "좌만", "우만",
  "케이스만", "케이스 만", "충전 케이스만",
  "본체만", "본체 만",  // 케이스 없음
  "배터리만",
];
const PRECISION_REVIEW_FLAGS = [
  "coarse_market_price",
  "extreme_discount_review",
  "market_confidence_low",
  "market_stat_missing",
  "option_parse_review",
  "option_needs_review",
  "ai_review_unavailable",
  "ai_second_opinion_hold",
  "weak_description",
  "condition_review",
];

const FLAG_LABELS: Record<string, string> = {
  coarse_market_price: "정밀 옵션 표본 부족",
  market_confidence_low: "시세 표본 신뢰도 낮음",
  market_stat_missing: "시세 통계 없음",
  option_parse_review: "옵션 파싱 신뢰도 낮음",
  option_needs_review: "용량/칩/사이즈 확인 필요",
  ai_review_unavailable: "AI 검토 실패",
  ai_second_opinion_hold: "AI 보수 검토 보류",
  weak_description: "설명 부족",
  condition_review: "상태/수리 이력 확인 필요",
  deep_discount_review: "비정상 저가 검토 필요",
  extreme_discount_review: "비현실적 초저가 보류",
  risk_keyword_review: "위험 키워드 검토 필요",
  ai_normal: "AI 정상 매물 판정",
  ai_second_opinion_pass: "AI 보수 검토 통과",
};

export function generalShippingFee(item: ListingCandidate) {
  return item.shippingFeeGeneral ?? item.shippingFee;
}

export function estimatedBuyCostGeneral(item: ListingCandidate) {
  return item.price + generalShippingFee(item);
}

export function netGapAfterGeneralShipping(item: ListingCandidate) {
  return Math.max(0, item.skuMedian - estimatedBuyCostGeneral(item));
}

export function hasShippingRange(item: ListingCandidate) {
  return generalShippingFee(item) !== item.shippingFee;
}

export function sellingFee(item: ListingCandidate) {
  return Math.round(item.skuMedian * SELLING_FEE_RATE);
}

export function expectedProfitMin(item: ListingCandidate) {
  return Math.max(
    0,
    item.skuMedian -
      estimatedBuyCostGeneral(item) -
      sellingFee(item) -
      RESELL_SHIPPING_FEE -
      SAFETY_BUFFER,
  );
}

export function expectedProfitMax(item: ListingCandidate) {
  return Math.max(
    0,
    item.skuMedian -
      item.estimatedBuyCost -
      sellingFee(item) -
      RESELL_SHIPPING_FEE -
      SAFETY_BUFFER,
  );
}

export function expectedProfitAverage(item: ListingCandidate) {
  return Math.round((expectedProfitMin(item) + expectedProfitMax(item)) / 2);
}

// Wave 1206→1215 (2026-06-06): pool 진입 최소 순익 (모든 비용 차감 후). owner 조정 가능.
//   Wave 1206: 1원→1000원 (순익 0~수백원 "득템" 무의미 차단).
//   Wave 1215 (owner): 1000→5000. 200원·1천원·3천원 차익은 배송비·수수료 빼면 애매 → 5천 미만 차단.
//   영향(실측): 5천 미만 827개(18.7%) 제외 → 풀 4,430→3,607, 평균 차익 33,816→41,110원(피드 품질↑).
const MIN_MEANINGFUL_PROFIT_KRW = 5_000;

export function bandFromProfit(profitMin: number, profitMax: number, _category?: string | null): 1 | 2 | 3 | null {
  // Wave 885 (2026-05-26 사용자 결정): band 시스템 폐기 — pool 진입 gate.
  //   사용자 코멘트: "band 개념 없앤 지 오래됐는데. 15만/30만/50만 이하 필터링 피드에서 직접 함."
  //   pool-policy.mjs 와 sync (Wave 755 패턴).
  const avg = Math.round((profitMin + profitMax) / 2);
  if (avg >= 70_000) return 3;
  if (avg >= 40_000) return 2;
  // Wave 1206: avg 반올림(0.5→1) 대신 profitMax(최선 순익) 기준 — 최선이 1000원도 안 되면 차단.
  if (profitMax >= MIN_MEANINGFUL_PROFIT_KRW) return 1;
  return null;
}

export function profitBreakdown(item: ListingCandidate) {
  return {
    expectedSalePrice: item.skuMedian,
    buyCostMin: item.estimatedBuyCost,
    buyCostMax: estimatedBuyCostGeneral(item),
    sellingFee: sellingFee(item),
    resellShippingFee: RESELL_SHIPPING_FEE,
    safetyBuffer: SAFETY_BUFFER,
    expectedProfitMin: expectedProfitMin(item),
    expectedProfitMax: expectedProfitMax(item),
    expectedProfitAverage: expectedProfitAverage(item),
  };
}

export function cashoutHint(item: ListingCandidate): CashoutHint {
  if (item.velocity >= 0.9 && item.priceGap >= 0.25) return "빠름";
  if (item.velocity >= 0.65 || item.priceGap >= 0.35) return "보통";
  return "느림";
}

export function cashoutRank(item: ListingCandidate) {
  const hint = cashoutHint(item);
  if (hint === "빠름") return 3;
  if (hint === "보통") return 2;
  return 1;
}

export function scoreLabel(item: ListingCandidate): CandidateBand {
  if (isFatalListing(item)) {
    return "제외";
  }
  if (hasPrecisionRisk(item)) {
    return "검토필요";
  }
  if (item.scoreFlags.length > 0 || item.riskHits > 0) {
    return "검토필요";
  }
  if (expectedProfitAverage(item) >= 30000 && cashoutHint(item) !== "느림") {
    return "고순익 후보";
  }
  if (expectedProfitAverage(item) >= 15000) {
    return "순익 후보";
  }
  return "관찰";
}

export function compareCandidates(a: ListingCandidate, b: ListingCandidate) {
  const fatalDelta = Number(isFatalListing(a)) - Number(isFatalListing(b));
  if (fatalDelta !== 0) return fatalDelta;
  const precisionDelta = Number(hasPrecisionRisk(a)) - Number(hasPrecisionRisk(b));
  if (precisionDelta !== 0) return precisionDelta;

  return (
    expectedProfitAverage(b) - expectedProfitAverage(a) ||
    cashoutRank(b) - cashoutRank(a) ||
    b.safety - a.safety ||
    b.velocity - a.velocity ||
    b.score - a.score
  );
}

function textOf(item: ListingCandidate) {
  return `${item.name}\n${item.descriptionPreview}`.toLowerCase();
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

export function isFatalListing(item: ListingCandidate) {
  return hasAny(textOf(item), FATAL_LISTING_KEYWORDS);
}

export function hasPrecisionRisk(item: ListingCandidate) {
  return item.scoreFlags.some((flag) => PRECISION_REVIEW_FLAGS.includes(flag));
}

export function isHighPrecisionCandidate(item: ListingCandidate) {
  if (!isVisibleResellCandidate(item)) return false;
  if (hasPrecisionRisk(item)) return false;
  if (item.riskHits > 0) return false;
  if (expectedProfitAverage(item) < 10000) return false;
  return item.price < item.skuMedian;
}

export function isVisibleResellCandidate(item: ListingCandidate) {
  if (isFatalListing(item)) return false;
  if (item.skuName.toLowerCase().includes("airpods") && hasAny(textOf(item), INCOMPLETE_AIRPODS_KEYWORDS)) {
    return false;
  }
  if (item.netGapAfterShipping <= 0) return false;
  return expectedProfitMax(item) > 0;
}

export function positiveSignals(item: ListingCandidate): CandidateSignal[] {
  const text = textOf(item);
  const signals: CandidateSignal[] = [];

  if (isFatalListing(item)) return [];

  if (expectedProfitAverage(item) >= 50000) {
    signals.push({ label: "예상 순익 5만원 이상", source: "profit" });
  } else if (expectedProfitAverage(item) >= 30000) {
    signals.push({ label: "예상 순익 3만원 이상", source: "profit" });
  }

  if (cashoutHint(item) === "빠름") {
    signals.push({ label: "관심도와 시세갭 기준 현금화 빠름", source: "demand" });
  } else if (item.velocity >= 0.75) {
    signals.push({ label: "같은 SKU 내 관심도 상위권", source: "demand" });
  }

  if (item.reviewRating !== "" && item.reviewRating >= 4.8 && item.reviewCount >= 20) {
    signals.push({ label: "판매자 리뷰 신뢰도 양호", source: "safety" });
  } else if (item.safety >= 0.9) {
    signals.push({ label: "안전도 점수 양호", source: "safety" });
  }

  if (hasAny(text, ["풀박", "박스", "정품", "보증", "애플케어", "기능 정상", "정상작동", "문제 없습니다", "문제없", "새상품", "s급"])) {
    signals.push({ label: "설명에 정상 본품 신호 있음", source: "description" });
  }

  return signals.slice(0, 4);
}

export function reviewSignals(item: ListingCandidate): CandidateSignal[] {
  const text = textOf(item);
  const signals: CandidateSignal[] = item.scoreFlags.map((flag) => ({
    label: FLAG_LABELS[flag] ?? flag,
    source: "rule" as const,
  }));

  if (item.riskHits > 0) {
    signals.push({ label: `위험 키워드 ${item.riskHits}개`, source: "rule" });
  }

  if (isFatalListing(item)) {
    signals.push({ label: "가품/레플리카/타오바오 의심", source: "rule" });
  }

  if (hasAny(text, ["충전선은 없습니다", "충전선 없음", "케이블 제외", "구성품 제외", "사진에 보이는게 다", "보이는게 다", "박스 없음", "박스없음"])) {
    signals.push({ label: "구성품 누락 가능성", source: "description" });
  }

  if (hasAny(text, ["사용감", "생활기스", "기스", "찍힘", "흠집", "오염", "늘어짐"])) {
    signals.push({ label: "외관 사용감 확인 필요", source: "description" });
  }

  if (hasAny(text, ["노캔 아님", "노캔x", "노캔 x", "노이즈캔슬링 안", "노이즈 캔슬링 안"])) {
    signals.push({ label: "노캔 미지원/모델 확인 필요", source: "description" });
  }

  if (hasAny(text, ["반품/환불", "환불 불가", "반품 불가", "예민하신 분", "예민하신분"])) {
    signals.push({ label: "거래 조건 확인 필요", source: "description" });
  }

  if (item.shippingSource === "not_loaded") {
    signals.push({ label: "배송비 API 미확인", source: "shipping" });
  }

  return signals.slice(0, 5);
}
