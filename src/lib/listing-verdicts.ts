// 2026-05-17: 매물 카드 chip 공통 utility.
// 득템잡이 차별화 = "근거 있는 추천" — chip 으로 왜 좋은지 명시.
// 3 화면 통일 (pack-reveal-modal / admin-pool-browser / preview-masked-dashboard) — drift 차단.

import { isJoongnaMarketplaceSource } from "@/lib/marketplace-source";
import {
  inferMarketplaceTransaction,
  joongnaTrustScoreBand,
  joongnaTrustScoreFromFacts,
  type MarketplaceShippingAssumption,
  type MarketplaceTransactionMode,
} from "@/lib/marketplace-safety";

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
  marketplaceSource?: string | null;
  joongnaTrustScore?: number | null;
  joongnaSafeOrderSalesCount?: number | null;
  // source-aware 거래/배송
  tradeLabels?: readonly string[] | null;
  shippingAssumption?: MarketplaceShippingAssumption | string | null;
  transactionMode?: MarketplaceTransactionMode | string | null;
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

// Wave 196 (2026-05-17): 카테고리별 강한 긍정 신호 — description regex 로 추출.
// 사용자: "D verdict chip 더 풍부하게" → 매물 카드 차별화 ↑.
const BATTERY_100_RE = /배터리[^가-힣]{0,4}(?:정품|효율|상태)?[^가-힣]{0,2}100\s*%|배터리[^\d]{0,5}\b100\b\s*%?|효율[^가-힣]{0,2}100\s*%/;
const APPLECARE_RE = /애플\s*케어|AppleCare|apple\s*care/i;
const FULL_BOX_RE = /풀\s*박스|풀\s*구성|박스[^가-힣]{0,3}케이블[^가-힣]{0,3}충전|풀\s*세트/;
const SEALED_RE = /(?:미\s*개봉|봉인|밀봉)(?:\s*상태)?|새\s*상품\s*박스/;
const RECENT_PURCHASE_RE = /([1-9]|1[0-2])\s*개월\s*전\s*구매|이번\s*달\s*구매|지난\s*달\s*구매|최근\s*구매|얼마\s*전\s*구매/;
const SERIAL_PUBLIC_RE = /시리얼[^가-힣]{0,3}(공개|첨부|사진|확인\s*가능)|S\/N[^가-힣]{0,3}공개/i;

// Wave 197 (2026-05-17): 카테고리별 정밀 quality 신호 (B 확장).
// 사용자: "B ㄱㄱ?? 개좋을듯" → 더 풍부하게.
// false positive 차단 위해 "없|안|않|손상|깨|크랙" 부정형 안 박힌 패턴만 매칭.
const NEGATIVE_GUARD_RE = /(?:없|안\s*나|안\s*됨|손상|깨짐|크랙|금\s*감|이상\s*있)/;
const SCREEN_CLEAN_RE = /(?:액정|화면|디스플레이|유리)(?:[^가-힣\n]{0,8})?(?:깨끗|흠집\s*없|기스\s*없|새것\s*같|정상)/;
const CAMERA_CLEAN_RE = /카메라(?:[^가-힣\n]{0,8})?(?:정상|깨끗|흠집\s*없|이상\s*없|작동\s*잘)/;
const FACE_TOUCH_ID_RE = /(?:Face\s*ID|페이스\s*ID|페이스아이디|지문|TouchID|터치\s*ID)(?:[^가-힣\n]{0,8})?(?:정상|작동|잘\s*됨|이상\s*없)/i;
const CHARGE_OK_RE = /충전(?:[^가-힣\n]{0,4})?(?:정상|잘\s*됨|문제\s*없)/;
const EXTRA_ACCESSORY_RE = /(?:케이블|스트랩|밴드|케이스)(?:[^가-힣\n]{0,2})?(?:추가|2\s*개|여러\s*개|3\s*개)|정품\s*케이스\s*포함|추가\s*구성/;
const WARRANTY_LEFT_RE = /(?:보증|애플\s*케어|AppleCare|보장)(?:[^가-힣\n]{0,4})?(?:[1-9]\d?\s*개월\s*(?:남|잔여)|만료\s*[1-9]|남음|잔여)/i;
const MAC_CYCLE_LOW_RE = /(?:사이클|cycle)\s*[1-9]\d{0,2}\s*회/i;  // 1~999회 (1000+는 catch X — 명시적 낮은 사이클만)
const UNLOCKED_PHONE_RE = /자급제|언락|unlocked|공기계|통신사\s*무관/i;
const BATTERY_HIGH_RE = /배터리(?:[^가-힣\n]{0,4})?(?:정품|효율|상태)?(?:[^가-힣\n]{0,2})?(9[5-9])\s*%/;  // 95~99% (100은 위에서)

// 2026-05-17: chip 우선순위 — 강한 부정 > 가격 매력 > 시장 활성 > 카테고리 강한 긍정 > 셀러 > quality
// max 6개 표시 (이전 4 → 6).
const MAX_VERDICTS = 6;

export function buildVerdicts(input: VerdictInput): Verdict[] {
  const out: Verdict[] = [];
  const isJoongna = isJoongnaMarketplaceSource(input.marketplaceSource);
  const trustScore = joongnaTrustScoreFromFacts(input);
  const trustBand = joongnaTrustScoreBand(trustScore);
  const shipping = inferMarketplaceTransaction(input);

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

  // Wave 196: 카테고리 강한 긍정 신호 — description regex (우선순위 ↑ 매력 다음).
  if (input.descriptionPreview) {
    if (BATTERY_100_RE.test(input.descriptionPreview)) {
      out.push({ label: "🔋 배터리 100%", tone: "good" });
    } else if (BATTERY_HIGH_RE.test(input.descriptionPreview)) {
      // Wave 197: 95~99% 도 강한 신호 (100% 만큼은 아니어도)
      const match = BATTERY_HIGH_RE.exec(input.descriptionPreview);
      out.push({ label: `🔋 배터리 ${match?.[1] ?? "95+"}%`, tone: "good" });
    }
    if (APPLECARE_RE.test(input.descriptionPreview)) {
      out.push({ label: "🛡️ AppleCare", tone: "good" });
    } else if (WARRANTY_LEFT_RE.test(input.descriptionPreview)) {
      // Wave 197: AppleCare 외 일반 보증 잔여 (Galaxy / 노트북 등)
      out.push({ label: "🧾 보증 잔여", tone: "good" });
    }
    if (FULL_BOX_RE.test(input.descriptionPreview)) {
      out.push({ label: "📦 풀구성", tone: "good" });
    }
    if (SEALED_RE.test(input.descriptionPreview)) {
      out.push({ label: "🔒 미개봉 봉인", tone: "good" });
    }
    if (RECENT_PURCHASE_RE.test(input.descriptionPreview)) {
      out.push({ label: "🆕 최근 구매", tone: "info" });
    }
    if (SERIAL_PUBLIC_RE.test(input.descriptionPreview)) {
      out.push({ label: "🆔 시리얼 공개", tone: "info" });
    }

    // Wave 197: 카테고리 quality 신호 — false positive 차단 위해 negative guard 박힘.
    // 같은 sentence 에 "없|손상|크랙" 있으면 매칭 skip (예: "액정 깨끗하지 않음").
    // negative guard 는 약식 — full sentence 의 부정형 detection 어렵지만 키워드 인접도 확인.
    const desc = input.descriptionPreview;
    const isNegationContext = (re: RegExp): boolean => {
      // 매칭 부분의 30자 이내 부정 키워드 있으면 skip.
      const m = re.exec(desc);
      if (!m || m.index == null) return true;
      const window = desc.slice(Math.max(0, m.index - 5), m.index + (m[0]?.length ?? 0) + 25);
      return NEGATIVE_GUARD_RE.test(window);
    };
    if (SCREEN_CLEAN_RE.test(desc) && !isNegationContext(SCREEN_CLEAN_RE)) {
      out.push({ label: "🪞 액정 깨끗", tone: "good" });
    }
    if (CAMERA_CLEAN_RE.test(desc) && !isNegationContext(CAMERA_CLEAN_RE)) {
      out.push({ label: "📸 카메라 정상", tone: "good" });
    }
    if (FACE_TOUCH_ID_RE.test(desc) && !isNegationContext(FACE_TOUCH_ID_RE)) {
      out.push({ label: "🎯 Face/TouchID", tone: "info" });
    }
    if (CHARGE_OK_RE.test(desc) && !isNegationContext(CHARGE_OK_RE)) {
      out.push({ label: "🔌 충전 정상", tone: "info" });
    }
    if (EXTRA_ACCESSORY_RE.test(desc)) {
      out.push({ label: "🎁 추가 구성품", tone: "good" });
    }
    if (MAC_CYCLE_LOW_RE.test(desc)) {
      const m = MAC_CYCLE_LOW_RE.exec(desc);
      const cycles = m?.[0]?.replace(/[^\d]/g, "") ?? "";
      const n = Number(cycles);
      if (Number.isFinite(n) && n > 0 && n <= 200) {
        out.push({ label: `📊 사이클 ${n}회`, tone: "good" });
      }
    }
    if (UNLOCKED_PHONE_RE.test(desc)) {
      out.push({ label: "🚫 자급제/언락", tone: "good" });
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
  if (isJoongna && trustBand && (input.sellerReviewCount ?? 0) >= 1) {
    out.push({ label: `신뢰지수 ${trustBand}`, tone: "good" });
  } else if (!isJoongna && input.sellerReviewRating != null && input.sellerReviewRating >= 4.5
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

  // Wave 196: sample 부족 명시 (Wave 183/187 한계 보완 — 사용자 신뢰 ↑).
  // marketConfidenceLabel == 'low' 가 이미 위에서 박혔으면 중복 방지 (above 우선).
  if (input.marketSampleCount != null && input.marketSampleCount > 0 && input.marketSampleCount < 5
      && input.marketConfidenceLabel !== "low" && (input.confidence ?? 1) >= 0.5) {
    out.push({ label: `시세 sample 부족 (${input.marketSampleCount}건)`, tone: "warn" });
  }

  // Wave 196: 우수 셀러 (별점 + 후기 수 둘 다 높음).
  if (isJoongna && (input.joongnaSafeOrderSalesCount ?? 0) > 0) {
    out.push({ label: `안심거래 판매 ${input.joongnaSafeOrderSalesCount}건`, tone: "good" });
  } else if (!isJoongna && input.sellerReviewRating != null && input.sellerReviewRating >= 4.8
      && (input.sellerReviewCount ?? 0) >= 50) {
    out.push({ label: `🏆 우수 셀러 (${input.sellerReviewCount}건)`, tone: "good" });
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
  if (shipping.assumption === "direct_only") {
    out.push({ label: "직거래 전제", tone: "info" });
  } else if (shipping.assumption === "included") {
    out.push({ label: "배송비 포함", tone: "info" });
  } else if (input.freeShipping && !isJoongna) {
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
