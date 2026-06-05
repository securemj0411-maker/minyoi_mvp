// 2026-05-17 Phase 0 L4 가시화 — 매물 카드에 category-aware risk score 박는 utility.
// 득템잡이 차별화 = "보호받음" — 풀 통과 매물의 *잔여 risk*를 사용자에게 시각화.
// (POOL_BLOCK_FLAGS 로 hard block 된 매물은 풀에 없음. 통과해도 약한 신호 남아있을 수 있음.)
//
// 3 화면 통일 (admin-pool-browser / pack-reveal-modal / user-reveal-dashboard) — drift 차단.

import { isDaangnMarketplaceSource, isJoongnaMarketplaceSource } from "@/lib/marketplace-source";
import { joongnaTrustScoreBand, joongnaTrustScoreFromFacts } from "@/lib/marketplace-safety";

export type RiskAxis = "fraud" | "lock" | "battery" | "seller" | "photo";
export type RiskLevel = 0 | 1 | 2; // safe / caution / warn
export type RiskTone = "safe" | "caution" | "danger";

export type RiskAxisResult = {
  axis: RiskAxis;
  level: RiskLevel;
  reason: string | null; // ko, 사용자 노출용
  applicable?: boolean; // false = 이 상품군에는 해당 점검축을 보여주지 않음
};

export type RiskScore = {
  axes: RiskAxisResult[];      // 순서 고정 (fraud → lock → battery → seller → photo), 축별 적용 여부 포함
  total: number;               // 0~10
  hitCount: number;            // level >= 1 인 axis 수
  tone: RiskTone;
  label: string;               // "안전" / "주의 N건" / "위험 N건"
};

export type RiskScoreInput = {
  scoreFlags?: readonly string[] | null;
  descriptionPreview?: string | null;
  conditionClass?: string | null;
  categorySlug?: string | null; // smartphone / earphone / smartwatch / etc.
  price?: number | null;
  skuMedian?: number | null;
  confidence?: number | null;
  sellerReviewRating?: number | null;
  sellerReviewCount?: number | null;
  marketplaceSource?: string | null;
  joongnaTrustScore?: number | null;
  daangnMannerTemperature?: number | null;
  photoCount?: number | null;
};

const FRAUD_KEYWORDS = /타오바오|짝퉁|레플리카|공장\s*직배송|중국발|s급\s*카피|미러급/i;
const LOCK_KEYWORDS = /icloud|아이클라우드|통신사\s*잠금|통신사\s*락|할부\s*남|할부\s*잔여|애플케어\s*활성|렌탈\s*잔여/i;
const BATTERY_RISK_KEYWORDS = /(?:배터리|충전).{0,16}(?:저하|안\s*됨|불량|광탈|방전|빨리\s*닳|오래\s*못|급격)|효율\s*[5-7]\d\s*%?|효율\s*낮/i;
const BATTERY_DISCLOSED_RE = /배터리\s*(효율|성능|상태)\s*[:：]?\s*(\d{2,3})\s*%/;
const PHOTO_REQUEST_HINT_RE = /사진\s*(추가|더|요청|드림)|직거래\s*시\s*보여/;

// 카테고리 — 잠금/할부 확인이 실제 구매 체크리스트인 SKU.
const LOCK_RELEVANT_CATEGORIES = new Set([
  "smartphone",
  "tablet",
  "smartwatch",
  "laptop",
]);

// 카테고리 — 배터리 효율/사이클을 구매자가 직접 확인할 수 있고 가격 핵심 변수인 SKU.
const BATTERY_SENSITIVE_CATEGORIES = new Set([
  "smartphone",
  "smartwatch",
  "tablet",
  "laptop",
  "drone",
  "camera",
]);

function flagsSet(flags: readonly string[] | null | undefined): Set<string> {
  return new Set(Array.isArray(flags) ? flags : []);
}

function normalizedCategorySlug(input: RiskScoreInput): string | null {
  const slug = input.categorySlug?.trim().toLowerCase();
  return slug ? slug : null;
}

function isCategoryRelevant(categorySlug: string | null, relevantCategories: Set<string>): boolean {
  // 카테고리를 모르는 과거/운영자 데이터는 기존처럼 보수적으로 보여준다.
  if (!categorySlug) return true;
  return relevantCategories.has(categorySlug);
}

function scoreFraud(input: RiskScoreInput, flags: Set<string>): RiskAxisResult {
  // L2 escrow held (AI 가 보류) → 강한 신호.
  if (flags.has("ai_escrow_held")) {
    return { axis: "fraud", level: 2, reason: "AI 검수 보류" };
  }
  if (flags.has("ai_escrow_pending") || flags.has("ai_escrow_unavailable")) {
    return { axis: "fraud", level: 1, reason: "AI 검수 대기" };
  }
  // 키워드 매치 — 직접 가품/짝퉁 시사.
  if (input.descriptionPreview && FRAUD_KEYWORDS.test(input.descriptionPreview)) {
    return { axis: "fraud", level: 2, reason: "가품 의심 키워드" };
  }
  // 시세 -50%+ 이면서 신뢰도 낮음 — 가격 anomaly.
  const price = input.price ?? 0;
  const median = input.skuMedian ?? 0;
  if (price > 0 && median > 0) {
    const discount = (median - price) / median;
    const conf = input.confidence ?? 1;
    if (discount >= 0.5 && conf < 0.7) {
      return { axis: "fraud", level: 2, reason: `시세 -${Math.round(discount * 100)}% 이상치` };
    }
    if (discount >= 0.4 && conf < 0.8) {
      return { axis: "fraud", level: 1, reason: `시세 -${Math.round(discount * 100)}% 주의` };
    }
  }
  // deep_discount_review 이지만 ai_normal 로 통과한 경우 — 약한 잔여 신호.
  if (flags.has("deep_discount_review") && flags.has("ai_normal")) {
    return { axis: "fraud", level: 1, reason: "딥할인 (AI 검토 통과)" };
  }
  return { axis: "fraud", level: 0, reason: null };
}

function scoreLock(input: RiskScoreInput, flags: Set<string>): RiskAxisResult {
  const categorySlug = normalizedCategorySlug(input);
  const applicable = isCategoryRelevant(categorySlug, LOCK_RELEVANT_CATEGORIES);
  if (!applicable) {
    return { axis: "lock", level: 0, reason: null, applicable: false };
  }
  if (input.descriptionPreview && LOCK_KEYWORDS.test(input.descriptionPreview)) {
    return { axis: "lock", level: 2, reason: "잠금/할부 키워드" };
  }
  if (flags.has("self_unlocked_ambiguity")) {
    return { axis: "lock", level: 1, reason: "자급제 모호" };
  }
  return { axis: "lock", level: 0, reason: null };
}

function scoreBattery(input: RiskScoreInput, _flags: Set<string>): RiskAxisResult {
  const categorySlug = normalizedCategorySlug(input);
  const applicable = isCategoryRelevant(categorySlug, BATTERY_SENSITIVE_CATEGORIES);
  const hasExplicitBatteryRisk = Boolean(input.descriptionPreview && BATTERY_RISK_KEYWORDS.test(input.descriptionPreview));
  if (!applicable && input.conditionClass !== "low_batt" && !hasExplicitBatteryRisk) {
    return { axis: "battery", level: 0, reason: null, applicable: false };
  }
  if (input.conditionClass === "low_batt") {
    return { axis: "battery", level: 2, reason: "배터리 저하" };
  }
  if (hasExplicitBatteryRisk) {
    return { axis: "battery", level: 2, reason: "배터리 risk 키워드" };
  }
  if (applicable && input.descriptionPreview) {
    const disclosed = BATTERY_DISCLOSED_RE.exec(input.descriptionPreview);
    if (!disclosed) {
      // 미공개 — 일반적인 약한 신호.
      return { axis: "battery", level: 1, reason: "배터리 효율 미공개" };
    }
    const pct = Number(disclosed[2]);
    if (Number.isFinite(pct)) {
      if (pct < 80) return { axis: "battery", level: 2, reason: `효율 ${pct}%` };
      if (pct < 90) return { axis: "battery", level: 1, reason: `효율 ${pct}%` };
    }
  }
  return { axis: "battery", level: 0, reason: null };
}

function scoreSeller(input: RiskScoreInput): RiskAxisResult {
  const count = input.sellerReviewCount ?? null;
  const rating = input.sellerReviewRating ?? null;
  if (isDaangnMarketplaceSource(input.marketplaceSource)) {
    const rawTemp = Number(input.daangnMannerTemperature ?? NaN);
    const temp = Number.isFinite(rawTemp) && rawTemp > 0 ? rawTemp : null;
    if (temp == null) {
      return { axis: "seller", level: 1, reason: "매너온도 미확인" };
    }
    if (temp < 30) {
      return { axis: "seller", level: 2, reason: `매너온도 ${temp.toFixed(1)}°C` };
    }
    if (temp < 36.5) {
      return { axis: "seller", level: 1, reason: `매너온도 ${temp.toFixed(1)}°C` };
    }
    return { axis: "seller", level: 0, reason: null };
  }
  if (isJoongnaMarketplaceSource(input.marketplaceSource)) {
    const trustScore = joongnaTrustScoreFromFacts(input);
    const trustBand = joongnaTrustScoreBand(trustScore);
    if (count === 0) {
      return { axis: "seller", level: 2, reason: "거래후기 0건" };
    }
    if (count != null && count < 3) {
      return { axis: "seller", level: 1, reason: `거래후기 ${count}건` };
    }
    if (trustScore != null) {
      if (trustScore < 500) return { axis: "seller", level: 2, reason: `신뢰지수 ${trustBand ?? `${trustScore}점`}` };
      if (trustScore < 650) return { axis: "seller", level: 1, reason: `신뢰지수 ${trustBand ?? `${trustScore}점`}` };
    }
    return { axis: "seller", level: 0, reason: null };
  }
  if (count === 0) {
    return { axis: "seller", level: 2, reason: "신규 판매자 (후기 0)" };
  }
  if (count != null && count < 3) {
    return { axis: "seller", level: 1, reason: `후기 ${count}건` };
  }
  if (rating != null && count != null && count >= 5) {
    if (rating < 3.5) return { axis: "seller", level: 2, reason: `★${rating.toFixed(1)} (낮음)` };
    if (rating < 4.0) return { axis: "seller", level: 1, reason: `★${rating.toFixed(1)} (보통)` };
  }
  return { axis: "seller", level: 0, reason: null };
}

function scorePhoto(input: RiskScoreInput): RiskAxisResult {
  const n = input.photoCount;
  if (n != null) {
    // 당근은 초기 search row에서 상세 사진 수를 모르면 0으로 저장된 과거 row가 있다.
    // 0장은 "사진 없음"이 아니라 "아직 미확인"으로 보고, detail 수집 후 1~2장일 때만 신호를 낸다.
    if (isDaangnMarketplaceSource(input.marketplaceSource) && n <= 0) {
      return { axis: "photo", level: 0, reason: null };
    }
    if (n <= 1) return { axis: "photo", level: 2, reason: `사진 ${n}장` };
    if (n <= 2) return { axis: "photo", level: 1, reason: `사진 ${n}장` };
  }
  if (input.descriptionPreview && PHOTO_REQUEST_HINT_RE.test(input.descriptionPreview)) {
    return { axis: "photo", level: 1, reason: "사진 별도 요청 안내" };
  }
  return { axis: "photo", level: 0, reason: null };
}

function toneFor(total: number, hitCount: number): RiskTone {
  if (total >= 4 || hitCount >= 3) return "danger";
  if (total >= 2 || hitCount >= 1) return "caution";
  return "safe";
}

function labelFor(tone: RiskTone, hitCount: number): string {
  if (tone === "safe") return "안전";
  if (tone === "caution") return `주의 ${hitCount}건`;
  return `위험 ${hitCount}건`;
}

export function buildRiskScore(input: RiskScoreInput): RiskScore {
  const flags = flagsSet(input.scoreFlags);
  const axes: RiskAxisResult[] = [
    scoreFraud(input, flags),
    scoreLock(input, flags),
    scoreBattery(input, flags),
    scoreSeller(input),
    scorePhoto(input),
  ];
  const total = axes.reduce((sum, a) => sum + a.level, 0);
  const hitCount = axes.filter((a) => a.level >= 1).length;
  const tone = toneFor(total, hitCount);
  return {
    axes,
    total,
    hitCount,
    tone,
    label: labelFor(tone, hitCount),
  };
}

// tone → tailwind class (3 화면 공통).
export const RISK_TONE_CLASS: Record<RiskTone, string> = {
  safe: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200",
  caution: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
  danger: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200",
};

// axis 별 tailwind class — mini-bar 시각화.
export const RISK_AXIS_LEVEL_CLASS: Record<RiskLevel, string> = {
  0: "bg-emerald-400/70 dark:bg-blue-500/60",
  1: "bg-amber-400/80 dark:bg-amber-500/70",
  2: "bg-rose-500/90 dark:bg-rose-500/80",
};

// axis 한국어 라벨 (popover 용).
export const RISK_AXIS_LABEL: Record<RiskAxis, string> = {
  fraud: "가품",
  lock: "잠금/할부",
  battery: "배터리",
  seller: "셀러",
  photo: "사진",
};
