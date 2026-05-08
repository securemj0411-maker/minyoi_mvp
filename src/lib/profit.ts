import type { CandidateBand, CandidateSignal, CashoutHint, ListingCandidate } from "@/lib/types";

export const SELLING_FEE_RATE = 0.035;
export const RESELL_SHIPPING_FEE = 3500;
export const SAFETY_BUFFER = 5000;

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
  if (item.scoreFlags.length > 0 || item.riskHits > 0) {
    return "검토필요";
  }
  if (expectedProfitMin(item) >= 30000 && cashoutHint(item) !== "느림") {
    return "고순익 후보";
  }
  if (expectedProfitMin(item) >= 15000) {
    return "순익 후보";
  }
  return "관찰";
}

export function compareCandidates(a: ListingCandidate, b: ListingCandidate) {
  return (
    expectedProfitMin(b) - expectedProfitMin(a) ||
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

export function positiveSignals(item: ListingCandidate): CandidateSignal[] {
  const text = textOf(item);
  const signals: CandidateSignal[] = [];

  if (expectedProfitMin(item) >= 50000) {
    signals.push({ label: "예상 순익 5만원 이상", source: "profit" });
  } else if (expectedProfitMin(item) >= 30000) {
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
    label: flag,
    source: "rule" as const,
  }));

  if (item.riskHits > 0) {
    signals.push({ label: `위험 키워드 ${item.riskHits}개`, source: "rule" });
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
