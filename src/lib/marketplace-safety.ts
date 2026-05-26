import { isDaangnMarketplaceSource, isJoongnaMarketplaceSource, marketplaceSourceLabel } from "@/lib/marketplace-source";

export type MarketplaceTransactionMode =
  | "direct_only"
  | "shipping_only"
  | "direct_and_shipping"
  | "unknown";

export type MarketplaceShippingAssumption =
  | "direct_only"
  | "included"
  | "separate"
  | "free_shipping"
  | "unknown";

export type MarketplaceChecklistTone = "amber" | "blue" | "emerald";

export type MarketplaceSafetyFacts = {
  marketplaceSource?: string | null;
  marketplaceLabel?: string | null;
  freeShipping?: boolean | null;
  sellerReviewRating?: number | null;
  sellerReviewCount?: number | null;
  joongnaTrustScore?: number | null;
  joongnaSafeOrderSalesCount?: number | null;
  joongnaSafeOrderSalesText?: string | null;
  productTradeType?: number | null;
  parcelFeeYn?: number | null;
  tradeLabels?: readonly string[] | null;
};

export type MarketplaceSafetyDisplay = {
  source: string;
  marketplaceLabel: string;
  isJoongna: boolean;
  paymentLabel: string;
  sellerTrust: {
    kind: "joongna_trust_score" | "bunjang_rating";
    metric: string;
    metricLabel: string;
    headline: string;
    body: string;
    note: string;
    valueNote: string;
    tileValue: string;
    tileSub: string;
    badgeLabel: string | null;
    assessment: string;
    assessmentLabel: string;
    trustScore: number | null;
    reviewCount: number;
  };
  shipping: {
    transactionMode: MarketplaceTransactionMode;
    assumption: MarketplaceShippingAssumption;
    buyerShippingLow: number;
    buyerShippingHigh: number;
    label: string;
    valueLabel: string;
    confidenceLabel: string;
    note: string;
    question: string;
    allowFreeShippingBadge: boolean;
  };
  sourceAction: {
    label: string;
    href: string;
    note: string;
  } | null;
};

export type MarketplacePurchaseCheck = {
  id: string;
  title: string;
  body: string;
  ask: string;
  label: string;
  tone: MarketplaceChecklistTone;
};

const DEFAULT_BUYER_SHIPPING_FEE_MAX = 3_500;

function cleanNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanLabels(labels: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(labels)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of labels) {
    const clean = String(label ?? "").trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 80) : null;
}

function textFromUnknown(value: unknown): string | null {
  const direct = cleanText(value);
  if (direct) return direct;
  const record = asRecord(value);
  return (
    cleanText(record.locationName) ??
    cleanText(record.dongName) ??
    cleanText(record.location) ??
    cleanText(record.region) ??
    cleanText(record.regionName) ??
    cleanText(record.areaName) ??
    cleanText(record.address) ??
    cleanText(record.name) ??
    cleanText(record.label)
  );
}

function krw(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function krwRange(low: number, high: number) {
  return low === high ? krw(low) : `${krw(low)} ~ ${krw(high)}`;
}

export function joongnaTrustScoreFromFacts(facts: MarketplaceSafetyFacts): number | null {
  const explicit = cleanNumber(facts.joongnaTrustScore);
  if (explicit != null && explicit > 0) return Math.max(0, Math.round(explicit));
  if (!isJoongnaMarketplaceSource(facts.marketplaceSource)) return null;
  const normalizedRating = cleanNumber(facts.sellerReviewRating);
  if (normalizedRating == null || normalizedRating <= 0) return null;
  return Math.max(0, Math.min(1000, Math.round(normalizedRating * 200)));
}

export function joongnaTrustScoreBand(score: number | null | undefined): string | null {
  const n = cleanNumber(score);
  if (n == null || n <= 0) return null;
  return `${Math.floor(n / 10) * 10}점대`;
}

function joongnaSellerTrustAssessment(input: {
  trustScore: number | null;
  trustBand: string | null;
  reviewCount: number;
  safeSales: number;
}) {
  const reviewLabel = input.reviewCount.toLocaleString("ko-KR");
  const safeSalesLabel = input.safeSales.toLocaleString("ko-KR");
  const scoreText = input.trustBand ? `신뢰지수 ${input.trustBand}` : "신뢰지수 미확인";
  const hasReviews = input.reviewCount > 0;
  const hasSafeSales = input.safeSales > 0;
  const tinyHistory = input.reviewCount > 0 && input.reviewCount < 3;
  const modestHistory = input.reviewCount >= 3 && input.reviewCount < 10;
  const enoughHistory = input.reviewCount >= 10;
  const lowScore = input.trustScore != null && input.trustScore < 500;
  const mediumScore = input.trustScore != null && input.trustScore >= 500 && input.trustScore < 650;
  const highScore = input.trustScore != null && input.trustScore >= 650;
  const strongScore = input.trustScore != null && input.trustScore >= 800;

  if (!hasReviews && input.trustScore == null) {
    return {
      label: "검증 표본 부족",
      summary: "판매자 신호가 거의 없어요. 가격이 좋아도 안심결제 가능 여부, 실사진, 구성품 답변이 확인되기 전에는 보류하는 편이 좋아요.",
      tileSub: "후기 없음 · 원본 확인 필요",
      valueNote: "점수나 후기가 없으면 판매자 신뢰를 판단할 표본이 부족하므로 거래 조건 확인이 먼저입니다.",
    };
  }

  if (tinyHistory || lowScore) {
    const safeText = hasSafeSales ? ` 안심거래 판매 ${safeSalesLabel}건은 보조 신호지만,` : "";
    return {
      label: "표본 적음",
      summary: `${scoreText}와 거래후기 ${reviewLabel}건 기준으로는 강한 신뢰 신호라기보다 거래 이력이 조금 확인된 수준이에요.${safeText} 최근 후기 내용과 응답, 안심결제 가능 여부까지 맞아야 진행할 만해요.`,
      tileSub: `후기 ${reviewLabel}건 · 보수 확인`,
      valueNote: "신뢰지수는 참고값이고, 후기 수가 적으면 점수 하나만으로 믿을 만하다고 보지 않습니다.",
    };
  }

  if (modestHistory || mediumScore) {
    return {
      label: "기본 신호 있음",
      summary: `${scoreText}와 거래후기 ${reviewLabel}건이면 기본 거래 이력은 보여요. 다만 후기 표본이 아주 많은 편은 아니라 최근 후기 내용, 실사진 답변, 안심결제 조건을 같이 확인하세요.`,
      tileSub: `후기 ${reviewLabel}건 · 조건 확인`,
      valueNote: "중간 신뢰 신호는 거래를 바로 확정하는 근거가 아니라, 원본 후기와 결제 조건을 확인할 출발점입니다.",
    };
  }

  if (highScore && enoughHistory) {
    return {
      label: strongScore ? "신뢰 신호 강함" : "신뢰 신호 있음",
      summary: `${scoreText}와 거래후기 ${reviewLabel}건이 같이 있어서 판매자 신뢰 신호는 있는 편이에요. 그래도 중고거래라서 원본 최근 후기와 안심결제 조건, 실사진 답변은 결제 전에 확인하세요.`,
      tileSub: `후기 ${reviewLabel}건 · 신호 있음`,
      valueNote: "후기 수와 신뢰지수가 함께 받쳐줄 때만 판매자 신호가 강해집니다. 그래도 안전을 보장한다는 뜻은 아닙니다.",
    };
  }

  return {
    label: hasReviews ? "조건 확인" : "점수만 확인",
    summary: hasReviews
      ? `${scoreText}와 거래후기 ${reviewLabel}건을 확인했어요. 이 정도 신호는 단독 판단보다 최근 후기 내용, 응답, 결제 방식과 같이 봐야 해요.`
      : `${scoreText}는 확인되지만 거래후기 표본이 없어요. 점수만 보고 진행하지 말고 원본 판매자 정보와 안심결제 가능 여부를 먼저 확인하세요.`,
    tileSub: hasReviews ? `후기 ${reviewLabel}건 · 같이 확인` : "후기 없음 · 점수만 확인",
    valueNote: "중고나라는 별점 평점이 아니라 신뢰지수, 거래후기, 안심거래 이력을 함께 해석해야 합니다.",
  };
}

export function inferMarketplaceTransaction(facts: MarketplaceSafetyFacts): {
  transactionMode: MarketplaceTransactionMode;
  assumption: MarketplaceShippingAssumption;
  labels: string[];
} {
  const labels = cleanLabels(facts.tradeLabels);
  const isDaangn = isDaangnMarketplaceSource(facts.marketplaceSource);
  if (isDaangn && !labels.some((label) => /직거래/.test(label))) {
    labels.push("직거래");
  }
  const joined = labels.join(" ");
  const hasDirect = /직거래/.test(joined);
  const hasShipping = /택배|배송/.test(joined);
  const hasIncluded = /배송비\s*포함|택배비\s*포함|택포|무료\s*배송|무료배송/.test(joined);
  const hasSeparate = /배송비\s*별도|택배비\s*별도|착불|별도\s*배송/.test(joined);
  const parcelFee = cleanNumber(facts.parcelFeeYn);
  const isJoongna = isJoongnaMarketplaceSource(facts.marketplaceSource);

  let transactionMode: MarketplaceTransactionMode = "unknown";
  if (isDaangn) transactionMode = "direct_only";
  else if (hasDirect && hasShipping) transactionMode = "direct_and_shipping";
  else if (hasDirect) transactionMode = "direct_only";
  else if (hasShipping || (isJoongna && parcelFee != null)) transactionMode = "shipping_only";

  let assumption: MarketplaceShippingAssumption = "unknown";
  if (isDaangn || transactionMode === "direct_only") {
    assumption = "direct_only";
  } else if (isJoongna && (hasIncluded || parcelFee === 1 || facts.freeShipping === true)) {
    assumption = "included";
  } else if (!isJoongna && facts.freeShipping === true) {
    assumption = "free_shipping";
  } else if (hasSeparate || parcelFee === 0) {
    assumption = "separate";
  }

  return { transactionMode, assumption, labels };
}

export function buildMarketplaceSafetyDisplay(facts: MarketplaceSafetyFacts): MarketplaceSafetyDisplay {
  const isJoongna = isJoongnaMarketplaceSource(facts.marketplaceSource);
  const marketplaceLabel = facts.marketplaceLabel || marketplaceSourceLabel(facts.marketplaceSource);
  const paymentLabel = isJoongna ? "안심결제" : "안전결제";
  const reviewCount = Math.max(0, Math.round(cleanNumber(facts.sellerReviewCount) ?? 0));
  const reviewLabel = reviewCount.toLocaleString("ko-KR");
  const trustScore = joongnaTrustScoreFromFacts(facts);
  const trustBand = joongnaTrustScoreBand(trustScore);
  const safeSales = Math.max(0, Math.round(cleanNumber(facts.joongnaSafeOrderSalesCount) ?? 0));
  const safeSalesLabel = safeSales > 0
    ? `안심거래 판매 ${safeSales.toLocaleString("ko-KR")}건`
    : null;
  const joongnaTrust = joongnaSellerTrustAssessment({ trustScore, trustBand, reviewCount, safeSales });
  const tx = inferMarketplaceTransaction(facts);
  const isDirectOnly = tx.assumption === "direct_only";
  const isIncluded = tx.assumption === "included";
  const isFreeShipping = tx.assumption === "free_shipping";
  const buyerShippingLow = 0;
  const buyerShippingHigh = isDirectOnly || isIncluded || isFreeShipping ? 0 : DEFAULT_BUYER_SHIPPING_FEE_MAX;

  const sellerTrust = isJoongna
    ? {
        kind: "joongna_trust_score" as const,
        metric: trustBand ? `신뢰지수 ${trustBand}` : reviewCount > 0 ? `거래후기 ${reviewLabel}건` : "신뢰 정보 확인 필요",
        metricLabel: [reviewCount > 0 ? `거래후기 ${reviewLabel}건` : null, safeSalesLabel]
          .filter((part): part is string => Boolean(part))
          .join(" · ") || "중고나라 판매자 정보",
        headline: `판매자 신호: ${joongnaTrust.label}`,
        body: joongnaTrust.summary,
        note: `${marketplaceLabel} 원본 안에서 ${paymentLabel} 가능 여부와 거래후기, 판매자 정보를 확인하고 진행하세요.`,
        valueNote: joongnaTrust.valueNote,
        tileValue: trustBand ? `신뢰지수 ${trustBand}` : reviewCount > 0 ? `거래후기 ${reviewLabel}건` : "확인 필요",
        tileSub: [joongnaTrust.tileSub, safeSalesLabel]
          .filter((part): part is string => Boolean(part))
          .join(" · "),
        badgeLabel: safeSalesLabel,
        assessment: joongnaTrust.summary,
        assessmentLabel: joongnaTrust.label,
        trustScore,
        reviewCount,
      }
    : {
        kind: "bunjang_rating" as const,
        metric: reviewCount > 0 ? `후기 ${reviewLabel}건` : "후기 없음",
        metricLabel: facts.sellerReviewRating == null ? "평점 없음" : `평점 ${Number(facts.sellerReviewRating).toFixed(1)}점`,
        headline: "번개장터 평점과 후기를 같이 봐요",
        body: facts.sellerReviewRating != null && reviewCount > 0
          ? `이 상품 판매자는 후기가 ${reviewLabel}건이고 평점이 ${Number(facts.sellerReviewRating).toFixed(1)}점이에요.`
          : reviewCount > 0
            ? `이 상품 판매자는 후기가 ${reviewLabel}건 있지만 평점 정보는 없어요.`
            : "이 상품 판매자는 아직 거래 후기와 평점이 없어요.",
        note: `${marketplaceLabel} 원본 안에서 ${paymentLabel} 가능 여부를 확인하고, 외부 계좌이체나 외부 링크 결제는 피하세요.`,
        valueNote: "후기 수와 평점을 같이 봐서, 평점만 높고 거래 이력이 적은 계정에 속지 않게 봅니다.",
        tileValue: facts.sellerReviewRating != null && reviewCount >= 10
          ? `평점 ${Number(facts.sellerReviewRating).toFixed(1)} 셀러`
          : reviewCount > 0
            ? `후기 ${reviewLabel}건`
            : "확인 필요",
        tileSub: facts.sellerReviewRating != null && reviewCount > 0
          ? `평점 ${Number(facts.sellerReviewRating).toFixed(1)} · 후기 ${reviewLabel}건`
          : reviewCount > 0 ? `후기 ${reviewLabel}건` : "차단 필터 통과",
        badgeLabel: reviewCount > 0 ? `후기 ${reviewLabel}` : null,
        assessment: facts.sellerReviewRating != null && reviewCount >= 10
          ? "평점과 후기 수가 함께 있어 판매자 신호가 있는 편이에요. 그래도 원본 후기와 안전결제 조건은 확인하세요."
          : reviewCount > 0
            ? "거래후기는 있지만 표본이 적을 수 있어 안전결제와 실제 상태 확인을 더 보수적으로 보면 좋아요."
            : "판매자 후기 표본이 부족해 안전결제 가능 여부와 실사진 답변을 먼저 확인하세요.",
        assessmentLabel: facts.sellerReviewRating != null && reviewCount >= 10
          ? "신뢰 신호 있음"
          : reviewCount > 0 ? "표본 확인" : "검증 표본 부족",
        trustScore: null,
        reviewCount,
      };

  const shipping = (() => {
    if (tx.assumption === "direct_only") {
      return {
        transactionMode: tx.transactionMode,
        assumption: tx.assumption,
        buyerShippingLow,
        buyerShippingHigh,
        label: "0원 · 직거래 전제",
        valueLabel: "0원",
        confidenceLabel: "직거래 전제",
        note: "거래 가능 지역 확인 필요",
        question: "직거래 가능 지역과 시간을 먼저 확인할게요.",
        allowFreeShippingBadge: false,
      };
    }
    if (tx.assumption === "included") {
      return {
        transactionMode: tx.transactionMode,
        assumption: tx.assumption,
        buyerShippingLow,
        buyerShippingHigh,
        label: "0원 · 배송비 포함",
        valueLabel: "배송비 포함",
        confidenceLabel: "배송비 포함 확인",
        note: "원문 배송비 포함 기준",
        question: "표시 가격에 배송비가 포함된 조건이 맞나요?",
        allowFreeShippingBadge: false,
      };
    }
    if (tx.assumption === "free_shipping") {
      return {
        transactionMode: tx.transactionMode,
        assumption: tx.assumption,
        buyerShippingLow,
        buyerShippingHigh,
        label: "0원 · 무료배송 확인",
        valueLabel: "판매자 무료배송",
        confidenceLabel: "배송비 확인됨",
        note: "원문 무료배송 기준",
        question: "표시 가격에 택배비가 포함된 조건이 맞나요?",
        allowFreeShippingBadge: true,
      };
    }
    if (tx.assumption === "separate") {
      return {
        transactionMode: tx.transactionMode,
        assumption: tx.assumption,
        buyerShippingLow,
        buyerShippingHigh,
        label: `${krwRange(buyerShippingLow, buyerShippingHigh)} 보수 반영`,
        valueLabel: krwRange(buyerShippingLow, buyerShippingHigh),
        confidenceLabel: "배송비 별도 가능",
        note: "기본 배송비 보수 반영",
        question: "배송비 별도라면 실제 배송비가 얼마인지 알려주세요.",
        allowFreeShippingBadge: false,
      };
    }
    return {
      transactionMode: tx.transactionMode,
      assumption: tx.assumption,
      buyerShippingLow,
      buyerShippingHigh,
      label: `${krwRange(buyerShippingLow, buyerShippingHigh)} 보수 반영`,
      valueLabel: krwRange(buyerShippingLow, buyerShippingHigh),
      confidenceLabel: "배송비 확인 필요",
      note: "구매 전 배송비 재확인",
      question: "표시 가격에 배송비가 포함돼 있나요?",
      allowFreeShippingBadge: false,
    };
  })();

  return {
    source: isJoongna ? "joongna" : "bunjang",
    marketplaceLabel,
    isJoongna,
    paymentLabel,
    sellerTrust,
    shipping,
    sourceAction: isJoongna
      ? {
          label: "중고나라 사기조회 열기",
          href: "https://web.joongna.com/fraud",
          note: "중고나라 매물은 사기조회에서 판매자 정보도 같이 확인해보세요.",
        }
      : null,
  };
}

export function commonMarketplaceSafetyChecks(facts: MarketplaceSafetyFacts): MarketplacePurchaseCheck[] {
  const display = buildMarketplaceSafetyDisplay(facts);
  const checks: MarketplacePurchaseCheck[] = [
    {
      id: "fraud-stop-signals",
      title: "이런 요청이면 구매를 멈추세요",
      body: "선입금, 외부 결제 링크, 외부 메신저 유도가 나오면 진행하지 마세요.",
      ask: `${display.paymentLabel} 또는 직거래 확인으로만 진행하세요.`,
      label: "멈춤 신호",
      tone: "amber",
    },
    {
      id: "payer-name-id-photo",
      title: "입금자명·신분증 요청을 조심해요",
      body: "입금자명 변경 요청, 신분증 인증 요구, 도용 사진 의심이 있으면 보류하세요.",
      ask: "실제 상품 사진과 원본 플랫폼 안 거래 조건을 다시 확인하세요.",
      label: "거래 안전",
      tone: "amber",
    },
  ];
  if (display.sourceAction) {
    checks.push({
      id: "joongna-fraud-lookup",
      title: "중고나라 사기조회도 확인해요",
      body: display.sourceAction.note,
      ask: "판매자 정보가 맞는지 사기조회에서 한 번 더 확인하세요.",
      label: "사기조회",
      tone: "blue",
    });
  }
  return checks;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

const LOCATION_TOKEN_PATTERN = /[가-힣][가-힣0-9]{0,11}(?:동|시|구|군|읍|면)/;
const LOCATION_SPLIT_PATTERN = /\s*(?:[,\n/|·]+)\s*/;

function pushLocationCandidate(out: string[], value: unknown) {
  const raw = textFromUnknown(value);
  if (!raw) return;
  const cleaned = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || !LOCATION_TOKEN_PATTERN.test(cleaned)) return;
  const parts = cleaned.includes(",") || cleaned.includes("·") || cleaned.includes("\n") || cleaned.includes("/") || cleaned.includes("|")
    ? cleaned.split(LOCATION_SPLIT_PATTERN)
    : [cleaned];
  for (const part of parts) {
    const text = part.trim();
    if (!text || !LOCATION_TOKEN_PATTERN.test(text) || BAD_TOKENS.has(text)) continue;
    if (!out.includes(text)) out.push(text.slice(0, 80));
    if (out.length >= 3) return;
  }
}

function collectLocationCandidates(out: string[], value: unknown, depth = 0) {
  if (out.length >= 3 || value == null || depth > 4) return;
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectLocationCandidates(out, entry, depth + 1);
      if (out.length >= 3) return;
    }
    return;
  }
  pushLocationCandidate(out, value);
  if (out.length >= 3) return;
  const record = asRecord(value);
  if (Object.keys(record).length === 0) return;
  for (const key of [
    "locationName",
    "dongName",
    "location",
    "locations",
    "tradeLocation",
    "tradeLocations",
    "transactionLocations",
    "tradeRegion",
    "region",
    "regionName",
    "areaName",
    "address",
    "text",
    "subContents",
    "tradeDetail",
    "tradeDetails",
  ]) {
    collectLocationCandidates(out, record[key], depth + 1);
    if (out.length >= 3) return;
  }
}

export function marketplaceFactsFromRawJson(input: {
  marketplaceSource?: string | null;
  marketplaceLabel?: string | null;
  freeShipping?: boolean | null;
  sellerReviewRating?: number | null;
  sellerReviewCount?: number | null;
  rawJson?: unknown;
}): MarketplaceSafetyFacts {
  const raw = asRecord(input.rawJson);
  const seller = asRecord(raw.seller);
  const activityScore = cleanNumber(seller.activityScore);
  const reliabilityScore = cleanNumber(seller.reliabilityScore);
  const trustScore = activityScore != null || reliabilityScore != null
    ? Math.max(0, Math.round((activityScore ?? 0) + (reliabilityScore ?? 0)))
    : joongnaTrustScoreFromFacts(input);
  return {
    marketplaceSource: input.marketplaceSource,
    marketplaceLabel: input.marketplaceLabel,
    freeShipping: input.freeShipping,
    sellerReviewRating: input.sellerReviewRating,
    sellerReviewCount: input.sellerReviewCount ?? cleanNumber(seller.reviewCount),
    joongnaTrustScore: trustScore,
    joongnaSafeOrderSalesCount: cleanNumber(seller.safeOrderSalesCount),
    joongnaSafeOrderSalesText: typeof seller.safeOrderSalesText === "string" ? seller.safeOrderSalesText : null,
    productTradeType: cleanNumber(raw.productTradeType),
    parcelFeeYn: cleanNumber(raw.parcelFeeYn),
    tradeLabels: Array.isArray(raw.labels) ? raw.labels.map((label) => String(label)) : [],
  };
}

export function marketplaceLocationFromRawJson(rawJson: unknown): string | null {
  const raw = asRecord(rawJson);
  const searchMeta = asRecord(raw.searchMeta);
  const search = asRecord(raw.search);
  const product = asRecord(raw.product);
  const seller = asRecord(raw.seller);
  const found: string[] = [];
  const candidates = [
    raw.location,
    raw.locations,
    raw.tradeLocation,
    raw.tradeLocations,
    raw.transactionLocations,
    raw.tradeRegion,
    raw.tradeDetail,
    raw.tradeDetails,
    raw.region,
    raw.regionName,
    raw.areaName,
    raw.address,
    searchMeta.location,
    searchMeta.locations,
    searchMeta.tradeLocation,
    searchMeta.tradeLocations,
    searchMeta.region,
    searchMeta.regionName,
    search.location,
    search.locations,
    search.tradeLocation,
    search.tradeLocations,
    search.region,
    search.regionName,
    product.location,
    product.locations,
    product.tradeLocation,
    product.tradeLocations,
    product.tradeDetail,
    product.tradeDetails,
    product.region,
    product.regionName,
    product.areaName,
    seller.location,
    seller.region,
    seller.regionName,
    seller.areaName,
  ];
  for (const candidate of candidates) {
    collectLocationCandidates(found, candidate);
    if (found.length >= 3) break;
  }
  return found.length > 0 ? found.join(" · ") : null;
}

// Wave launch-37 (사용자 짚음): 중고나라 collector 가 list API 만 → raw_json 에 location 없음.
// 단 셀러가 description 에 "직거래는 안동 송하동 입니다" 같이 박는 경우 많음.
// description 에서 시/구/동 패턴 추출.
//
// 룰:
// 1. "직거래" / "만나" / "위치" / "지역" 같은 trigger 키워드 근처 (±60자)에 위치 패턴 찾기
// 2. 패턴 우선순위: "OO시 OO동" > "OO구 OO동" > "OO동" > "OO시" / "OO구"
// 3. 무난한 false positive 차단: "유아동", "신학기 ... 동" 같은 일반어
const LOCATION_TRIGGERS = ["직거래", "만나", "거래 가능", "위치는", "지역은", "동네는"];
const BAD_TOKENS = new Set(["유아동", "남아동", "여아동", "기타운동", "반려동"]);

function extractDongFromText(text: string): string | null {
  if (!text || typeof text !== "string") return null;
  const normalized = text.replace(/\s+/g, " ");
  for (const trigger of LOCATION_TRIGGERS) {
    const idx = normalized.indexOf(trigger);
    if (idx < 0) continue;
    // trigger 뒤 80자 window 안 위치 패턴 검색
    const window = normalized.slice(idx, idx + 100);
    // 1순위: "안동 송하동", "강남구 역삼동" 같은 두 단어 — "[도시] [동]"
    //   도시 단어 = 동/시/구/군/읍/면 으로 끝나는 2~5글자 ("안동", "강남구", "수원시")
    const twoWord = window.match(/([가-힣][가-힣0-9]{1,8}(?:동|시|구|군|읍|면))\s+([가-힣][가-힣0-9]{0,8}동)/);
    if (twoWord && !BAD_TOKENS.has(twoWord[1]) && !BAD_TOKENS.has(twoWord[2])) {
      return `${twoWord[1]} ${twoWord[2]}`;
    }
    // 2순위: 단독 "동" 단어
    const dongOnly = window.match(/([가-힣][가-힣0-9]{0,8}동)\b/);
    if (dongOnly && !BAD_TOKENS.has(dongOnly[1])) return dongOnly[1];
    // 3순위: 단독 시/구/군
    const cityOnly = window.match(/([가-힣]{2,5}(?:시|구|군))/);
    if (cityOnly && !BAD_TOKENS.has(cityOnly[1])) return cityOnly[1];
  }
  return null;
}

export function marketplaceLocationFromDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  return extractDongFromText(description);
}

// raw_json 우선, 없으면 description fallback.
export function marketplaceLocationCombined(rawJson: unknown, description: string | null | undefined): string | null {
  return marketplaceLocationFromRawJson(rawJson) ?? marketplaceLocationFromDescription(description);
}

export function marketplaceLocationCombinedWithRegion(
  rawJson: unknown,
  description: string | null | undefined,
  regionName: string | null | undefined,
): string | null {
  const cleanRegion = cleanText(regionName);
  const enrichedRawJson = cleanRegion
    ? { ...asRecord(rawJson), regionName: cleanRegion }
    : rawJson;
  return marketplaceLocationCombined(enrichedRawJson, description);
}
