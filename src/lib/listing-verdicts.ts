// 2026-05-17: 매물 카드 chip 공통 utility.
// 미뇨이 차별화 = "근거 있는 추천" — chip 으로 왜 좋은지 명시.
// 3 화면 통일 (pack-reveal-modal / admin-pool-browser / preview-masked-dashboard) — drift 차단.

export type VerdictTone = "good" | "warn" | "info";
export type Verdict = { label: string; tone: VerdictTone };

// 입력 — raw 데이터만 받음. chip 라벨 결정은 이 함수가.
export type VerdictInput = {
  // 가격
  price?: number | null;
  skuMedian?: number | null;
  expectedProfitMin?: number | null;
  expectedProfitMax?: number | null;
  // 신뢰 (시세)
  confidence?: number | null;
  marketSampleCount?: number | null;
  marketConfidenceLabel?: "high" | "medium" | "low" | null;
  // 회전 (velocity)
  medianHoursToSold?: number | null;
  soldSampleCount?: number | null;  // SKU sold 30일 누적 (수요 신호)
  // 시장 활성도
  flowCount24h?: number | null;
  flowAvgPerDay7d?: number | null;
  // 셀러
  sellerReviewRating?: number | null;
  sellerReviewCount?: number | null;
  // 매물 메타
  freeShipping?: boolean | null;
  favoriteCount?: number | null;
  numComment?: number | null;
  lastSeenAt?: string | null;
  // description (자연어 신호)
  descriptionPreview?: string | null;
};

const POSITIVE_DESC_RE = /미개봉|미사용|새상품|풀박스|풀구성|거의\s*새것/;
const NEGATIVE_DESC_RE = /하자|기스\s*심|찍힘\s*심|수리이력|충전\s*안됨|배터리\s*효율\s*낮/;

// 2026-05-17: chip 우선순위 — 강한 부정 > 가격 매력 > 시장 활성 > 셀러 > quality
// max 6개 표시 (이전 4 → 6).
const MAX_VERDICTS = 6;

export function buildVerdicts(input: VerdictInput): Verdict[] {
  const out: Verdict[] = [];

  // 1. 강한 부정 (위험 noticeable — 우선)
  if (input.descriptionPreview && NEGATIVE_DESC_RE.test(input.descriptionPreview)) {
    out.push({ label: "사용감 주의", tone: "warn" });
  }
  if (input.sellerReviewCount === 0) {
    out.push({ label: "신규 판매자", tone: "warn" });
  }

  // 2. 가격 매력 (강한 hook — "왜 차익?")
  if (input.skuMedian && input.skuMedian > 0 && input.price && input.price > 0) {
    const discount = (input.skuMedian - input.price) / input.skuMedian;
    if (discount >= 0.3) {
      out.push({ label: `시세보다 -${Math.round(discount * 100)}%`, tone: "good" });
    } else if (discount >= 0.15) {
      out.push({ label: `시세보다 -${Math.round(discount * 100)}%`, tone: "info" });
    }
  }

  // 3. 시장 활성 — 수요 등급화. 2026-05-17: active + sold 합산 기준 (사용자: "번개에 많이 올라오는 = 수요").
  // 이전: sold 만 (detection 안정성 의존 → SKU 절반 누락). 새: total sample (active+sold) — robust.
  // threshold 조정: 30/10/3 → 50/20/8 (active 포함하면 N 커짐).
  if (input.soldSampleCount != null) {
    if (input.soldSampleCount >= 50) {
      out.push({ label: "🔥 수요 매우높음", tone: "good" });
    } else if (input.soldSampleCount >= 20) {
      out.push({ label: "수요 높음", tone: "good" });
    } else if (input.soldSampleCount >= 8) {
      out.push({ label: "수요 보통", tone: "info" });
    }
  }
  // 회전 속도 (medianHoursToSold) — 실제 N일 표시
  if (input.medianHoursToSold != null && input.medianHoursToSold > 0) {
    const hrs = input.medianHoursToSold;
    const tone: VerdictTone = hrs <= 72 ? "good" : hrs >= 336 ? "warn" : "info";
    const label = hrs < 24
      ? `${Math.max(1, Math.round(hrs))}시간 회전`
      : `평균 ${Math.round((hrs / 24) * 10) / 10}일 회전`;
    out.push({ label, tone });
  }
  // 매물 활발 (24h spike)
  if (input.flowCount24h != null && input.flowAvgPerDay7d != null
      && input.flowAvgPerDay7d > 0 && input.flowCount24h >= input.flowAvgPerDay7d * 1.3) {
    out.push({ label: "매물 활발", tone: "info" });
  }

  // 4. 신선도
  if (input.lastSeenAt) {
    const t = new Date(input.lastSeenAt).getTime();
    if (Number.isFinite(t) && Date.now() - t < 60 * 60 * 1000) {
      out.push({ label: "🆕 방금 등록", tone: "good" });
    }
  }

  // 5. 셀러 신뢰
  if (input.sellerReviewRating != null && input.sellerReviewRating >= 4.5
      && (input.sellerReviewCount ?? 0) >= 5) {
    out.push({ label: `★${input.sellerReviewRating.toFixed(1)} 셀러`, tone: "good" });
  }

  // 6. 시세 신뢰
  if (input.marketConfidenceLabel === "high") {
    const samples = input.marketSampleCount != null && input.marketSampleCount > 0
      ? ` (${input.marketSampleCount}건)`
      : "";
    out.push({ label: `시세 신뢰 높음${samples}`, tone: "good" });
  } else if (input.marketConfidenceLabel === "low" || (input.confidence != null && input.confidence < 0.5)) {
    out.push({ label: "시세 신뢰 낮음", tone: "warn" });
  } else if (input.confidence != null && input.confidence >= 0.8) {
    out.push({ label: "시세 신뢰 높음", tone: "good" });
  }

  // 7. 매물 quality (positive description 신호)
  if (input.descriptionPreview && POSITIVE_DESC_RE.test(input.descriptionPreview)) {
    out.push({ label: "상태 좋음", tone: "good" });
  }
  // 댓글 적음 (호가 신뢰)
  if (input.numComment != null && input.numComment === 0) {
    out.push({ label: "댓글 없음", tone: "info" });
  }

  // 8. 무료배송
  if (input.freeShipping) {
    out.push({ label: "무료배송", tone: "info" });
  }

  // 9. 관심도
  if (input.favoriteCount != null && input.favoriteCount >= 10) {
    out.push({ label: `❤️ ${input.favoriteCount}`, tone: "info" });
  }

  return out.slice(0, MAX_VERDICTS);
}

// chip tone → tailwind class (3 화면 공통).
export const VERDICT_TONE_CLASS: Record<VerdictTone, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
  warn: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
  info: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200",
};
