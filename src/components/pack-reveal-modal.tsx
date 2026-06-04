"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import MarketHistoryChart, { type ChartState as MarketChartState } from "@/components/market-history-chart";
import ModelGuidePanel from "@/components/model-guide-panel";
import { ConditionChip, ConditionPhotoBadge, ConditionTierChip, ConditionChipsList } from "@/components/condition-chip";
import { CategoryWatermark } from "@/components/category-watermark";
import { RiskScoreBar } from "@/components/risk-score-bar";
import { BunjangLogo, DanawaLogo, JoongnaLogo, MarketplaceSourceBadge } from "@/components/market-brand-logo";
import { SkuImageLockBadge } from "@/components/sku-image-lock-badge";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  FlameIcon,
  HourglassIcon,
  PackageIcon,
  ScaleIcon,
  ShieldIcon,
  TargetIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TrophyIcon,
  WalletIcon,
  ZapIcon,
} from "@/components/icons";
import { findModelGuide, type ModelGuide } from "@/lib/model-guides";
import type { PackBand, RevealCard, RevealFeedbackType, RevealListingDetail } from "@/lib/pack-open";
import {
  RESELL_SHIPPING_FEE,
  SAFETY_BUFFER,
  SELLING_FEE_RATE,
  conditionResaleAdjustmentKrw,
  expectedProfitFromMarketPrice,
  resellShippingFeeForSource,
  safetyBufferForSource,
  sellingFeeForMarketPrice,
} from "@/lib/profit";
import { buyPriceGuidance, verdictUiLabel } from "@/lib/buy-price-guidance";
import { computeDealScore, type DealScore } from "@/lib/deal-score";
import { categoryFromComparableKey } from "@/lib/category-readiness";
import {
  counterfeitChecklistFor,
  PRIORITY_LABEL,
  type CounterfeitCheckPriority,
} from "@/lib/counterfeit-checklist";
// Wave A (2026-05-20): 카테고리별 브랜드 깊이 정보 (Nike Jordan, Adidas Yeezy 등).
// CounterfeitChecklistPanel + WhyTrustCollapse 가품 Q 답 둘 다 사용.
import {
  categoryDefaultDepth,
  detectBrandDepth,
  COUNTERFEIT_RISK_LABEL,
  type BrandDepthMatch,
} from "@/lib/category-brand-depth";
import {
  sellHelperFor,
  suggestedAskingPrice,
  buildBodyTemplate,
} from "@/lib/sell-helper";
import { buildRiskScore, type RiskScoreInput, type RiskTone } from "@/lib/risk-score";
import {
  buildMarketplaceSafetyDisplay,
  commonMarketplaceSafetyChecks,
  type MarketplaceSafetyFacts,
} from "@/lib/marketplace-safety";
import type { DetailEventType } from "@/lib/detail-analytics";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type RevealResult =
  | {
      result: "success";
      reveals: RevealCard[];
      attemptedCount: number;
      durationMs: number;
    }
  | {
      result: "refunded";
      reason: string;
      tokensRefunded: number;
      durationMs: number;
    }
  | {
      result: "unavailable";
      reason: string;
      durationMs: number;
    };

type Props = {
  open: boolean;
  band: PackBand;
  loading: boolean;
  result: RevealResult | null;
  initialPreviewCard?: RevealCard | null;
  initialPreviewMode?: "listing" | "guide";
  initialPreviewSeed?: string | number | null;
  onClose: () => void;
  onLinkClicked: (pid: number) => void;
  onFeedback: (pid: number, feedbackType: RevealFeedbackType, note?: string) => void;
  onTrackEvent?: (pid: number, eventType: DetailEventType, metadata?: Record<string, unknown>) => void;
  currentFeedbackType?: string | null;
  currentSaved?: boolean;
  onSaveToggle?: (pid: number, saved: boolean) => void;
  onLoadDetail: (pid: number) => Promise<RevealListingDetail>;
  relatedItems?: RelatedRevealItem[];
  onOpenRelatedItem?: (pid: number) => void;
  // Wave 182b (2026-05-17): 손해 신고 — 카드 list 에서 빼고 모달 안 1곳에만 박음.
  // optional — pack 열기 흐름 (새 매물 받기) 에서는 안 박힘. user-reveal-dashboard "상품 보기" 에서만 전달.
  onReportLoss?: (card: RevealCard) => void;
  // optional: 이 매물 이미 신고됨 — 버튼 비활성화.
  alreadyReportedLoss?: boolean;
  onLoadGuide?: (card: RevealCard) => Promise<ModelGuide | null>;
  renderGuidePanel?: (args: {
    card: RevealCard;
    guide: ModelGuide | null;
    loading: boolean;
    error: string | null;
    onClose: () => void;
  }) => ReactNode;
  onRetry: () => void;
};

type RelatedRevealItem = {
  pid: number;
  name: string;
  price: number;
  thumbnailUrl: string | null;
  genericImageUrl?: string | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  marketBasis: RevealCard["marketBasis"] | null;
  revealedAt: string;
  // Wave 752 (2026-05-25): 잠금 매물 처리 — 사진 블러 + 카테고리 워터마크 + 차익/가격 숨김.
  // 사용자가 결제/언락 안 한 매물이면 true. explore-client 의 lockedPreview 와 동일 논리.
  locked?: boolean;
  category?: string | null;
};

type PreviewSide = "left" | "right";
type TransactionFeedbackType = Extract<RevealFeedbackType, "contacted" | "bought" | "passed" | "inspected" | "listed" | "resold">;
type RecommendationFeatureTone = "profit" | "market" | "speed" | "quality";
type RecommendationFeatureCard = {
  icon: ReactNode;
  title: string;
  body: string;
  tone: RecommendationFeatureTone;
};

// 2026-05-19 P0 fix: 폴백 게이트화. 실데이터 없을 때 거짓 "약 2일 (카테고리 평균)" 노출 문제.
//   - `NEXT_PUBLIC_VELOCITY_UI_TEST==='1'` 인 환경(개발/테스트)에서만 48h 폴백을 보여준다.
//   - 운영(게이트 OFF)에서는 폴백 hours = null → UI 카드는 "회전 데이터 수집 중"으로 표시.
//   - 거짓 "카테고리 평균" 카피 제거 (Wave 297 결정 로그 미반영분 해소).
const UI_TEST_FALLBACK_VELOCITY_HOURS = 48;
const VELOCITY_UI_TEST_ENABLED =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_VELOCITY_UI_TEST === "1";
const DEFAULT_BUYER_SHIPPING_FEE_MAX = 3_500;

const TRANSACTION_STATUS_LABEL: Record<TransactionFeedbackType, string> = {
  contacted: "문의함",
  bought: "매수함",
  passed: "포기함",
  inspected: "검수 완료",
  listed: "판매 등록",
  resold: "판매 완료",
};

const TRANSACTION_ACTIONS: Array<{
  type: TransactionFeedbackType;
  label: string;
  note: string;
}> = [
  { type: "contacted", label: "문의했어요", note: "판매자에게 문의함" },
  { type: "bought", label: "매수했어요", note: "매수 완료" },
  { type: "passed", label: "포기했어요", note: "이 매물은 진행하지 않음" },
];

const POST_BUY_ACTIONS: Array<{
  type: TransactionFeedbackType;
  label: string;
  note: string;
}> = [
  { type: "inspected", label: "검수 완료", note: "매수 후 검수 완료" },
  { type: "listed", label: "판매 등록", note: "재판매 등록 완료" },
  { type: "resold", label: "판매 완료", note: "재판매 완료" },
];

function isTransactionFeedbackType(value: string | null | undefined): value is TransactionFeedbackType {
  return value === "contacted"
    || value === "bought"
    || value === "passed"
    || value === "inspected"
    || value === "listed"
    || value === "resold";
}

function isPostBuyFeedbackType(value: TransactionFeedbackType | null) {
  return value === "bought" || value === "inspected" || value === "listed" || value === "resold";
}

const LOADING_STEPS = [
  "AI가 추천 상품을 끌어오고 있습니다...",
  "지금 살아있는 상품인지 다시 확인하는 중...",
  "방금 팔면 얼마나 남는지 시세를 계산 중...",
  "리스크 신호와 단품 여부를 마지막으로 걸러내는 중...",
];

const SAVED_REVEAL_PIDS_STORAGE_KEY = "minyoi_saved_reveal_pids_v1";
const MAX_LOCAL_SAVED_REVEALS = 500;
const BEGINNER_GUIDE_HANDLED_PIDS_STORAGE_KEY = "minyoi_reveal_beginner_guide_handled_pids_v1";
const BEGINNER_GUIDE_SEEN_COUNT_STORAGE_KEY = "minyoi_reveal_beginner_guide_seen_count_v1";
const BEGINNER_GUIDE_SKIP_COUNT_STORAGE_KEY = "minyoi_reveal_beginner_guide_skip_count_v1";
// Wave launch-76: "앞으로 상세 리포트를 기본으로 보기" 선택 시 영구 저장 키.
// 상품 클릭마다 쉬운모드로 회귀하던 lapse 차단 — shouldAutoShowBeginnerGuide에서 detailed 우선.
const MODAL_MODE_STORAGE_KEY = "minyoi_modal_mode";
// Wave 394.7.y (사용자 피드백): 자동 표시 한도 ↑ + skip 임계 ↑. 신규/일반인 더 자주 노출.
// 3→5: 다른 카드 5장 볼 때까지 자동 표시. 4→6: 6번 skip해야 hide (이전 4번은 너무 빠름).
const BEGINNER_GUIDE_AUTO_SHOW_LIMIT = 5;
const BEGINNER_GUIDE_AUTO_HIDE_SKIP_THRESHOLD = 6;
const JOONGNA_SELLER_SAFE_PAYMENT_FEE_RATE = 0.01;
const JOONGNA_BUYER_SAFE_PAYMENT_FEE_RATE = 0.035;
const JOONGNA_SAFE_PAYMENT_FEE_FREE_UNDER_KRW = 20_000;

function readSavedRevealPidSet() {
  if (typeof window === "undefined") return new Set<number>();
  try {
    const raw = window.localStorage.getItem(SAVED_REVEAL_PIDS_STORAGE_KEY);
    if (!raw) return new Set<number>();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(
        parsed
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value)),
      );
    }
    if (parsed && typeof parsed === "object") {
      return new Set(
        Object.keys(parsed)
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value)),
      );
    }
  } catch {}
  return new Set<number>();
}

function writeSavedRevealPid(pid: number, saved: boolean) {
  if (typeof window === "undefined" || !Number.isFinite(pid)) return;
  try {
    const next = readSavedRevealPidSet();
    if (saved) next.add(pid);
    else next.delete(pid);
    window.localStorage.setItem(
      SAVED_REVEAL_PIDS_STORAGE_KEY,
      JSON.stringify(Array.from(next).slice(-MAX_LOCAL_SAVED_REVEALS)),
    );
  } catch {}
}

function readBeginnerGuideHandledPidSet() {
  if (typeof window === "undefined") return new Set<number>();
  try {
    const raw = window.localStorage.getItem(BEGINNER_GUIDE_HANDLED_PIDS_STORAGE_KEY);
    if (!raw) return new Set<number>();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<number>();
    return new Set(
      parsed
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value)),
    );
  } catch {
    return new Set<number>();
  }
}

function writeBeginnerGuideHandledPid(pid: number) {
  if (typeof window === "undefined" || !Number.isFinite(pid)) return;
  try {
    const next = readBeginnerGuideHandledPidSet();
    next.add(pid);
    window.localStorage.setItem(
      BEGINNER_GUIDE_HANDLED_PIDS_STORAGE_KEY,
      JSON.stringify(Array.from(next).slice(-MAX_LOCAL_SAVED_REVEALS)),
    );
  } catch {}
}

function readBeginnerGuideCounter(key: string) {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(window.localStorage.getItem(key) ?? "0");
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function incrementBeginnerGuideCounter(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(readBeginnerGuideCounter(key) + 1));
  } catch {}
}

function shouldAutoShowBeginnerGuide(pid: number | null) {
  if (typeof window === "undefined") return false;
  if (pid == null || !Number.isFinite(pid)) return false;
  try {
    // Wave launch-76: 사용자가 "앞으로 상세 리포트를 기본으로 보기"를 누른 경우 — 영구적으로 detailed.
    // 이전엔 매 상품마다 minyoi_modal_mode 무시하고 쉬운모드 부활 → 사용자가 매번 다시 skip 눌러야 했음.
    if (window.localStorage.getItem(MODAL_MODE_STORAGE_KEY) === "detailed") return false;
    if (readBeginnerGuideHandledPidSet().has(pid)) return false;
    if (readBeginnerGuideCounter(BEGINNER_GUIDE_SKIP_COUNT_STORAGE_KEY) >= BEGINNER_GUIDE_AUTO_HIDE_SKIP_THRESHOLD) {
      return false;
    }
    return readBeginnerGuideCounter(BEGINNER_GUIDE_SEEN_COUNT_STORAGE_KEY) < BEGINNER_GUIDE_AUTO_SHOW_LIMIT;
  } catch {
    return true;
  }
}

function recordBeginnerGuideCompleted(pid: number | null) {
  if (pid != null) writeBeginnerGuideHandledPid(pid);
  incrementBeginnerGuideCounter(BEGINNER_GUIDE_SEEN_COUNT_STORAGE_KEY);
}

function recordBeginnerGuideSkipped(pid: number | null) {
  if (pid != null) writeBeginnerGuideHandledPid(pid);
  incrementBeginnerGuideCounter(BEGINNER_GUIDE_SKIP_COUNT_STORAGE_KEY);
}

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function signedKrw(value: number) {
  // Wave launch-27 (audit MEDIUM): NaN / Infinity 가드. signedKrw(NaN) → "NaN원" 표시 차단.
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  const sign = rounded >= 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("ko-KR")}원`;
}

function profitRange(min: number, max: number) {
  // Wave launch-27: NaN 가드.
  if (!Number.isFinite(min) && !Number.isFinite(max)) return "—";
  if (!Number.isFinite(min)) return signedKrw(max);
  if (!Number.isFinite(max)) return signedKrw(min);
  if (min === max) return signedKrw(max);
  return `${signedKrw(min)} ~ ${signedKrw(max)}`;
}

function expectedProfitAverage(card: RevealCard) {
  // Wave launch-27: NaN 가드.
  const min = card.expectedProfitMin;
  const max = card.expectedProfitMax;
  if (!Number.isFinite(min) && !Number.isFinite(max)) return 0;
  if (!Number.isFinite(min)) return Math.round(max);
  if (!Number.isFinite(max)) return Math.round(min);
  return Math.round((min + max) / 2);
}

function sourceAwareProfitAverage(card: RevealCard, marketplaceSource?: string | null) {
  const marketPrice = card.marketBasis?.medianPrice ?? null;
  if (!marketPrice || marketPrice <= 0) return expectedProfitAverage(card);
  const safety = marketplaceSafetyForCard(card);
  const profit = expectedProfitFromMarketPrice({
    buyPrice: card.price,
    marketPrice,
    buyShipping: safety.shipping.buyerShippingHigh,
    marketplaceSource: marketplaceSource ?? card.marketplaceSource ?? null,
    conditionChips: card.conditionChips,
    conditionClass: card.marketBasis?.conditionClass ?? null,
    conditionTier: card.conditionTier,
  });
  if (!profit) return expectedProfitAverage(card);
  return Math.round((profit.min + profit.max) / 2);
}

function netProfitPercent(card: RevealCard) {
  if (!card.price || card.price <= 0) return null;
  const profit = expectedProfitAverage(card);
  const pct = Math.round((profit / card.price) * 100);
  return Number.isFinite(pct) ? pct : null;
}

function hasUsableMarketBasis(card: RevealCard) {
  const median = card.marketBasis?.medianPrice ?? null;
  return Boolean(median && median > 0 && (card.marketBasis?.sampleCount ?? 0) >= 3);
}

function holdReasonText(card: RevealCard) {
  if (!hasUsableMarketBasis(card)) return "같은 출처·같은 상태의 시세 근거가 아직 부족해요.";
  return "시세 갱신으로 지금은 순익이 사라졌어요.";
}

function holdChipText(card: RevealCard) {
  return hasUsableMarketBasis(card) ? "보류 처리" : "시세 근거 부족";
}

function marketDiscountPercent(card: RevealCard) {
  const median = card.marketBasis?.medianPrice ?? null;
  if (!median || median <= 0 || !card.price || card.price <= 0) return null;
  const pct = Math.round(((median - card.price) / median) * 100);
  return Number.isFinite(pct) ? pct : null;
}

type BeginnerGuideStep = {
  eyebrow: string;
  title: string;
  metric: string;
  metricLabel: string;
  body: string;
  note: string;
  valueNote?: string;
  tone: "intro" | "trust" | "check" | "market" | "trend" | "buy" | "resell" | "safety" | "channel" | "speed" | "summary";
};

type BeginnerGuideStepContext = {
  analysisLoading?: boolean;
};

// Wave launch-71: title 안 숫자/금액 자동 파란색 강조 (토스 스타일).
//   매칭 패턴: 소수점 포함 일/시간/분 / 원 / % / N건 / N개 등.
function highlightMetricsInText(text: string): React.ReactNode {
  const pattern = /([+-]?\d+(?:\.\d+)?(?:,\d{3})*(?:\.\d+)?\s*(?:일|시간|분|원|%|건|개|배))/g;
  const parts = text.split(pattern);
  return parts.map((part, idx) => {
    if (pattern.test(part)) {
      pattern.lastIndex = 0;  // reset for next match
      return (
        <span key={idx} className="text-[#3182f6] dark:text-blue-300">
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

type BeginnerGuideSafetyStats = {
  total_blocked_7d?: number;
  total_reviewed_7d?: number;
  fake_or_lock_7d?: number;
  profit_low_7d?: number;
  suspicious_price_7d?: number;
  needs_review_7d?: number;
  stat_missing_7d?: number;
  listing_parts_7d?: number;
  listing_accessory_7d?: number;
  listing_multi_7d?: number;
  scope?: {
    level?: "lane" | "sku" | "category" | "global";
    sku_id?: string | null;
    comparable_key?: string | null;
    category?: string | null;
  } | null;
};

const SELLER_TRUST_MIN_REVIEW_COUNT = 10;
const BEGINNER_PURCHASE_CHECK_LIMIT = 3;
const BEGINNER_BATTERY_CHECK_CATEGORIES = new Set(["smartphone", "tablet", "smartwatch", "laptop", "drone", "camera"]);
const BEGINNER_LOCK_CHECK_CATEGORIES = new Set(["smartphone", "tablet", "smartwatch", "laptop"]);
const BEGINNER_AUTH_CHECK_CATEGORIES = new Set(["earphone", "shoe", "bag", "perfume", "watch", "clothing"]);
const BEGINNER_COMPONENT_CHECK_CATEGORIES = new Set([
  "smartphone",
  "tablet",
  "smartwatch",
  "laptop",
  "earphone",
  "drone",
  "camera",
  "game_console",
  "shoe",
  "bag",
  "watch",
  "perfume",
  "clothing",
]);
const BEGINNER_BATTERY_DISCLOSED_RE = /배터리\s*(효율|성능|상태|사이클)|효율\s*[:：]?\s*\d{2,3}\s*%|사이클\s*\d+|battery\s*(health|cycle)/i;
const BEGINNER_COMPONENT_DISCLOSED_RE = /구성품|풀박|풀\s*박스|박스|케이스|영수증|구매\s*내역|보증서|충전기|케이블|스트랩|택\b|더스트백|인보이스/i;

type BeginnerPurchaseCheck = {
  id: string;
  title: string;
  body: string;
  ask: string;
  label: string;
  tone: "amber" | "blue" | "emerald";
};

function marketplaceLabelForCard(card: Pick<RevealCard, "marketplaceLabel" | "marketplaceSource">) {
  if (card.marketplaceLabel) return card.marketplaceLabel;
  return card.marketplaceSource === "joongna" ? "중고나라" : "번개장터";
}

function marketplacePaymentLabel(card: Pick<RevealCard, "marketplaceSource">) {
  return card.marketplaceSource === "joongna" ? "안심결제" : "안전결제";
}

function marketplacePaymentNote(card: Pick<RevealCard, "marketplaceLabel" | "marketplaceSource">) {
  const marketplace = marketplaceLabelForCard(card);
  const payment = marketplacePaymentLabel(card);
  if (card.marketplaceSource === "joongna") {
    return `${marketplace} ${payment} 가능 여부와 거래 조건을 원본에서 확인하세요.`;
  }
  return `${marketplace} ${payment}로 진행하고, 외부 계좌이체나 외부 링크 결제는 피하세요.`;
}

function marketplaceSafetyFactsForCard(card: RevealCard): MarketplaceSafetyFacts {
  const detail = card.savedDetail;
  return {
    marketplaceSource: card.marketplaceSource,
    marketplaceLabel: marketplaceLabelForCard(card),
    freeShipping: detail?.freeShipping ?? null,
    sellerReviewRating: detail?.sellerReviewRating ?? null,
    sellerReviewCount: detail?.sellerReviewCount ?? null,
    joongnaTrustScore: detail?.joongnaTrustScore ?? null,
    joongnaSafeOrderSalesCount: detail?.joongnaSafeOrderSalesCount ?? null,
    joongnaSafeOrderSalesText: detail?.joongnaSafeOrderSalesText ?? null,
    productTradeType: detail?.productTradeType ?? null,
    parcelFeeYn: detail?.parcelFeeYn ?? null,
    tradeLabels: detail?.tradeLabels ?? [],
    // Wave 758 (2026-05-26): 당근 매너온도 — savedDetail 에 박힌 값 전달.
    daangnMannerTemperature: detail?.daangnMannerTemperature ?? null,
    daangnReviewCount: detail?.daangnReviewCount ?? null,
  };
}

function marketplaceSafetyForCard(card: RevealCard) {
  return buildMarketplaceSafetyDisplay(marketplaceSafetyFactsForCard(card));
}

function sellerTrustGuideStep(card: RevealCard): BeginnerGuideStep {
  const safety = marketplaceSafetyForCard(card);
  const rating = card.savedDetail?.sellerReviewRating ?? null;
  const reviewCount = card.savedDetail?.sellerReviewCount ?? 0;
  const payment = safety.paymentLabel;

  // Wave 758 (2026-05-26): 당근 매너온도 우선 — 후기/평점 대신 매너온도 (0~99.9°C) 가 신뢰 신호.
  //   당근은 안전결제 없는 직거래 플랫폼. 후기 수가 의미 없음. 매너온도가 셀러 누적 평가.
  if (safety.isDaangn) {
    return {
      eyebrow: "4. 판매자 신뢰",
      title: "당근 매너온도로 셀러를 봐요",
      metric: safety.sellerTrust.metric,
      metricLabel: safety.sellerTrust.metricLabel,
      body: safety.sellerTrust.body,
      note: safety.sellerTrust.note,
      valueNote: safety.sellerTrust.valueNote,
      tone: "trust",
    };
  }

  if (safety.isJoongna) {
    return {
      eyebrow: "4. 판매자 신뢰",
      title: "상품과 판매자를 같이 봐요",
      metric: safety.sellerTrust.metric,
      metricLabel: safety.sellerTrust.metricLabel,
      body: safety.sellerTrust.body,
      note: `${safety.sellerTrust.note} 외부 결제 링크나 외부 메신저 유도가 나오면 구매를 멈추세요.`,
      valueNote: safety.sellerTrust.valueNote,
      tone: "trust",
    };
  }

  if (rating != null && rating >= 4.8 && reviewCount >= SELLER_TRUST_MIN_REVIEW_COUNT) {
    return {
      eyebrow: "4. 판매자 신뢰",
      title: "상품과 판매자를 같이 봐요",
      metric: safety.sellerTrust.metric,
      metricLabel: `평점 ${rating.toFixed(1)}점`,
      body: safety.sellerTrust.body + " 신뢰 신호가 있는 편이에요.",
      // Wave 394.7.y: 안전결제 step 흡수 — 신뢰 강함이라도 앱 안 결제 룰 한 줄로 강조.
      note: `그래도 거래는 ${safety.marketplaceLabel} 원본 안에서 ${payment} 가능 여부를 확인하고 진행하세요. 물건 받고 상태 확인한 뒤 구매확정하는 흐름으로 진행하세요.`,
      valueNote: safety.sellerTrust.valueNote,
      tone: "trust",
    };
  }

  if (rating != null && reviewCount > 0) {
    return {
      eyebrow: "4. 판매자 신뢰",
      title: "상품과 판매자를 같이 봐요",
      metric: safety.sellerTrust.metric,
      metricLabel: `평점 ${rating.toFixed(1)}점`,
      body: reviewCount < SELLER_TRUST_MIN_REVIEW_COUNT
        ? `평점은 ${rating.toFixed(1)}점이지만 후기가 ${reviewCount.toLocaleString("ko-KR")}건이라 아직 판단 표본이 적어요. 안전결제와 실제 상태 확인을 조금 더 보수적으로 보면 좋아요.`
        : `${safety.sellerTrust.body} 안전결제와 실제 상태 확인을 같이 보면 좋아요.`,
      // Wave 394.7.y: 안전결제 흡수.
      note: `${safety.marketplaceLabel} 원본 안에서 ${payment} 조건을 확인하고, 물건 받아 상태 확인한 뒤 구매확정을 누르세요. 외부 계좌이체나 외부 링크 결제는 피하는 게 좋아요.`,
      valueNote: safety.sellerTrust.valueNote,
      tone: "trust",
    };
  }

  return {
    eyebrow: "4. 판매자 신뢰",
    title: "먼저 상품과 판매자를 같이 봐요",
    metric: safety.sellerTrust.metric,
    metricLabel: rating == null ? "평점 없음" : `평점 ${rating.toFixed(1)}점`,
    body: reviewCount > 0
      ? `${safety.sellerTrust.body} 거래 방식과 상품 상태를 조금 더 보수적으로 확인하는 게 좋아요.`
      : `이 상품 판매자는 아직 거래 후기와 평점이 없어요. ${safety.marketplaceLabel} 신규 판매자이거나 거래 이력이 적은 계정일 수 있어서 더 보수적으로 확인해야 해요.`,
    // Wave 394.7.y: 안전결제 흡수 — 신뢰 약한 셀러일수록 더 중요.
    note: `특히 신뢰 약한 셀러는 ${payment} 가능 여부를 먼저 확인하세요. 외부 결제 유도 시 거절하고, 추가 사진·구성품·택배 조건도 결제 전 확인.`,
    valueNote: safety.sellerTrust.valueNote,
    tone: "trust",
  };
}

function categoryForBeginnerGuide(card: RevealCard) {
  return categoryFromComparableKey(card.marketBasis?.comparableKey ?? null);
}

function batteryCheckAsk(category: string | null) {
  if (category === "smartwatch") return "배터리 성능 화면, 페어링 해제 화면, 충전 상태를 같이 받아보세요.";
  if (category === "laptop") return "배터리 사이클/성능 상태와 충전기 포함 여부를 물어보세요.";
  if (category === "drone" || category === "camera") return "배터리 개수, 충전 상태, 사이클 정보를 물어보세요.";
  return "배터리 효율 화면이 있는 기기면 캡처를 받고, 없으면 실제 사용 시간을 셀러에게 직접 물어보세요.";
}

function brandDepthForCard(card: RevealCard, category: string | null) {
  return detectBrandDepth(category, {
    skuId: card.skuId ?? null,
    skuName: card.skuName ?? null,
    name: card.name ?? null,
  });
}

function hasMeaningfulCounterfeitRisk(card: RevealCard, category: string | null) {
  const brandDepth = brandDepthForCard(card, category);
  if (brandDepth) return brandDepth.brand.counterfeitRisk !== "low";
  const defaultDepth = categoryDefaultDepth(category);
  return defaultDepth ? defaultDepth.brand.counterfeitRisk !== "low" : false;
}

function authenticityCheckAsk(card: RevealCard, category: string | null) {
  const brandDepth = brandDepthForCard(card, category);
  const brandCheck = brandDepth?.brand.counterfeitChecks[0];
  if (brandDepth && brandCheck) return `${brandDepth.brand.label}은 ${brandCheck} 사진을 먼저 받아보세요.`;
  if (category === "earphone") return "시리얼, 정품 인증 화면, 페어링 화면을 받아보세요.";
  if (category === "shoe") return "사이즈 택, 박스 라벨, 안쪽 라벨 사진을 받아보세요.";
  if (category === "bag") return "라벨, 안감, 시리얼, 구성품 사진을 받아보세요.";
  if (category === "watch") return "보증서, 시리얼, 뒷면 각인 사진을 받아보세요.";
  if (category === "perfume") return "박스 라벨, 배치코드, 분사구 사진을 받아보세요.";
  return "라벨, 택, 시리얼처럼 정품 확인에 필요한 사진을 받아보세요.";
}

function componentsCheckAsk(category: string | null) {
  if (category === "shoe") return "박스, 여분 끈, 택 포함 여부를 물어보세요.";
  if (category === "bag") return "더스트백, 보증서, 영수증, 기본 스트랩 포함 여부를 물어보세요.";
  if (category === "watch" || category === "smartwatch") return "충전기, 스트랩, 박스, 보증서 포함 여부를 물어보세요.";
  if (category === "clothing") return "택, 영수증, 하자 부위 사진이 있는지 물어보세요.";
  if (category === "perfume") return "박스, 영수증, 남은 용량 사진을 물어보세요.";
  return "박스, 케이스, 영수증, 충전 케이블 포함 여부를 물어보세요.";
}

function beginnerPurchaseChecks(card: RevealCard): BeginnerPurchaseCheck[] {
  const safety = marketplaceSafetyForCard(card);
  const checks: BeginnerPurchaseCheck[] = commonMarketplaceSafetyChecks(marketplaceSafetyFactsForCard(card));
  const detail = card.savedDetail;
  const category = categoryForBeginnerGuide(card);
  const description = detail?.descriptionPreview ?? "";
  const imageCount = safety.isDaangn && detail?.imageCount === 0 ? null : detail?.imageCount ?? null;
  const reviewCount = detail?.sellerReviewCount ?? 0;

  if (safety.isDaangn) {
    const temp = (safety.sellerTrust as { mannerTemperature?: number | null }).mannerTemperature ?? null;
    if (temp == null || temp < 36.5) {
      checks.push({
        id: "seller",
        title: temp == null ? "매너온도를 확인하세요" : "매너온도가 낮은 편이에요",
        body: temp == null
          ? "당근은 후기/별점보다 셀러 프로필의 매너온도가 핵심 신뢰 신호예요."
          : `매너온도 ${temp.toFixed(1)}°C라 평균 36.5°C보다 낮아요.`,
        ask: "원본에서 셀러 프로필 매너온도와 실물 인증 사진을 먼저 확인하세요.",
        label: "매너온도",
        tone: "amber",
      });
    }
  } else if (reviewCount < SELLER_TRUST_MIN_REVIEW_COUNT) {
    checks.push({
      id: "seller",
      title: reviewCount > 0 ? "후기가 아직 적어요" : "후기 없는 판매자예요",
      body: reviewCount > 0
        ? `후기가 ${reviewCount.toLocaleString("ko-KR")}건이라 평점만으로 판단하기엔 표본이 적어요.`
        : "거래 이력이 없는 계정일 수 있어서 결제 방식부터 보수적으로 잡는 게 좋아요.",
      ask: `${safety.marketplaceLabel} ${safety.paymentLabel}로 진행 가능한지 먼저 물어보세요.`,
      label: safety.paymentLabel,
      tone: "amber",
    });
  }

  if (imageCount != null && imageCount <= 2) {
    checks.push({
      id: "photo",
      title: imageCount <= 1 ? "사진이 적어요" : "사진을 조금 더 보면 좋아요",
      body: `지금 확인된 사진은 ${imageCount.toLocaleString("ko-KR")}장이에요. 사진이 적으면 생활 흠집이나 구성품을 놓치기 쉬워요.`,
      ask: "앞면, 뒷면, 구성품, 하자 부위 사진을 더 받아보세요.",
      label: "사진 확인",
      tone: "blue",
    });
  }

  if (category && BEGINNER_BATTERY_CHECK_CATEGORIES.has(category) && !BEGINNER_BATTERY_DISCLOSED_RE.test(description)) {
    checks.push({
      id: "battery",
      title: "배터리 상태를 물어보세요",
      body: "배터리 제품은 겉상태가 좋아도 사용 시간이나 효율에 따라 되팔 때 가격이 달라질 수 있어요.",
      ask: batteryCheckAsk(category),
      label: "배터리",
      tone: "blue",
    });
  }

  if (category && BEGINNER_LOCK_CHECK_CATEGORIES.has(category)) {
    checks.push({
      id: "lock",
      title: "잠금 해제 상태를 확인해요",
      body: "폰, 태블릿, 워치, 노트북은 계정 잠금이 남아 있으면 정상 사용이나 재판매가 어려울 수 있어요.",
      ask: "계정 로그아웃, 초기화 화면, 잠금 해제 상태를 사진으로 받아보세요.",
      label: "잠금",
      tone: "amber",
    });
  }

  if (category && BEGINNER_AUTH_CHECK_CATEGORIES.has(category) && hasMeaningfulCounterfeitRisk(card, category)) {
    checks.push({
      id: "authenticity",
      title: "정품 확인 포인트를 먼저 봐요",
      body: "정품 여부를 앱이 보장하는 건 아니지만, 구매 전에 받아야 할 사진은 미리 정해둘 수 있어요.",
      ask: authenticityCheckAsk(card, category),
      label: "정품 확인",
      tone: "blue",
    });
  }

  if (category && BEGINNER_COMPONENT_CHECK_CATEGORIES.has(category) && !BEGINNER_COMPONENT_DISCLOSED_RE.test(description)) {
    checks.push({
      id: "components",
      title: "구성품을 확인해요",
      body: "구성품이 빠지면 되팔 때 설명이 약해지고 예상 판매가도 달라질 수 있어요.",
      ask: componentsCheckAsk(category),
      label: "구성품",
      tone: "emerald",
    });
  }

  if (checks.length === 0) {
    checks.push({
      id: "condition",
      title: "상태만 한 번 더 확인하면 돼요",
      body: "큰 체크포인트는 적지만, 구매 전에는 설명과 사진이 같은지 마지막으로 맞춰보는 게 좋아요.",
      ask: `실사용 흠집, 구성품, ${safety.shipping.question}`,
      label: "마지막 확인",
      tone: "emerald",
    });
  }

  return checks.slice(0, BEGINNER_PURCHASE_CHECK_LIMIT);
}

function purchaseCheckGuideStep(card: RevealCard): BeginnerGuideStep {
  const checks = beginnerPurchaseChecks(card);
  const first = checks[0];
  return {
    eyebrow: "6. 구매 전 체크",
    title: "구매 전에 이것만 물어보면 돼요",
    metric: `${checks.length.toLocaleString("ko-KR")}개 체크`,
    metricLabel: first ? first.title : "구매 전 질문",
    body: `외부 결제 유도, 선입금, 입금자명 변경 같은 멈춤 신호와 이 매물에서 먼저 물어볼 것 ${checks.length.toLocaleString("ko-KR")}개만 추렸어요.`,
    note: first?.ask ?? "판매자에게 확인할 질문을 먼저 정리해요.",
    tone: "check",
  };
}

function marketCompareGuideStep(card: RevealCard, context: BeginnerGuideStepContext = {}): BeginnerGuideStep {
  const market = card.marketBasis;
  const median = market?.medianPrice ?? null;
  const sampleCount = market?.sampleCount ?? 0;
  const analysisPending = Boolean(context.analysisLoading);

  if (analysisPending) {
    return {
      eyebrow: "2. 비교 매물",
      title: "비교 기준을 불러오는 중이에요",
      metric: "확인 중",
      metricLabel: market?.label ?? card.skuName,
      body: "같은 모델과 같은 상태의 비교 매물을 가져오는 중이에요. 로딩이 끝난 뒤에도 표본이 부족한 경우에만 부족하다고 표시합니다.",
      note: "잠시 후 시세 기준과 비교 매물이 채워집니다.",
      valueNote: "상세 분석이 끝나면 실제 시세 기준과 비교 매물 수로 다시 판단해요.",
      tone: "market",
    };
  }

  if (median != null && median > 0 && card.price > 0) {
    const diff = median - card.price;
    const diffAbs = Math.abs(diff);
    const metric = diff > 0
      ? `${krw(diffAbs)} 저렴`
      : diff < 0
        ? `${krw(diffAbs)} 높음`
        : "시세와 비슷";
    const groupLabel = conditionComparisonGroupLabel(card);
    const title = diff > 0
      ? `${groupLabel} 중에서도 싸게 나왔어요`
      : diff < 0
        ? `${groupLabel} 중에서는 가격이 높아요`
        : `${groupLabel} 시세와 비슷해요`;
    const body = diff > 0
      ? `${groupLabel} 기준보다 ${krw(diffAbs)} 싸요.`
      : diff < 0
        ? `${groupLabel} 기준보다 ${krw(diffAbs)} 높아요.`
        : `${groupLabel} 기준과 거의 비슷한 가격이에요.`;

    return {
      eyebrow: "2. 비교 매물",
      title,
      metric,
      metricLabel: `비슷한 상태 시세 ${krw(median)} · 이 매물 ${krw(card.price)}`,
      body,
      note: sampleCount > 0
        ? `총 ${sampleCount.toLocaleString("ko-KR")}건 중 비싼 순 일부를 먼저 보여드릴게요.`
        : "상태 분류와 표본 수에 따라 시세 판단은 달라질 수 있어요.",
      valueNote: sampleCount > 0
        ? `상태가 다른 매물은 섞지 않고, 같은 모델·같은 상태 표본 ${sampleCount.toLocaleString("ko-KR")}건에서 기준을 잡았어요.`
        : undefined,
      tone: "market",
    };
  }

  return {
    eyebrow: "2. 비교 매물",
    title: "시세 표본을 더 모으는 중이에요",
    metric: "표본 부족",
    metricLabel: market?.label ?? card.skuName,
    body: "같은 모델과 상태의 비교 매물이 충분하지 않으면 가격 판단을 강하게 단정하지 않아요. 그래도 현재 모인 비교 매물부터 보여드릴게요.",
    note: "이 경우 상세 분석에서 비교 매물과 원본 링크를 직접 확인하는 게 중요합니다.",
    valueNote: "비교 매물이 부족한 모델은 부족하다고 표시하고, 다른 상태 시세를 섞어 수익을 부풀리지 않아요.",
    tone: "market",
  };
}

function velocityGuideStep(card: RevealCard, context: BeginnerGuideStepContext = {}): BeginnerGuideStep {
  const velocity = card.velocityBasis;
  const marketSoldSample = card.marketBasis?.soldSampleCount ?? 0;
  const marketActiveSample = card.marketBasis?.sampleCount ?? 0;
  const analysisPending = Boolean(context.analysisLoading);
  const hasStrongVelocity =
    velocity?.medianHoursToSold != null &&
    velocity.medianHoursToSold > 0 &&
    velocity.sold7dCount > 0 &&
    (velocity.confidence === "high" || velocity.confidence === "medium");
  // Wave 394.7.ab: low confidence 도 통과 — 표본 적어도 "참고용" 톤으로 보여줌.
  // 사용자 "에어팟맥스면 기록이 없을수가 없는데" — confidence low 인 경우 데이터는 있지만 표본 적은 거.
  const hasReferenceVelocity =
    velocity?.confidence === "low" &&
    velocity.sold7dCount > 0;
  const observedVelocitySample = Math.max(
    Number(velocity?.observedSoldSampleCount ?? 0),
    Number(velocity?.sold7dCount ?? 0),
  );

  if (hasStrongVelocity && velocity) {
    const label = velocityHoursLabel(velocity.medianHoursToSold);
    const dailySold = dailySoldCountLabel(velocity.sold7dCount);
    return {
      eyebrow: "5. 판매 속도",
      title: `되팔면 보통 ${label} 안에 팔리는 편이에요`,
      metric: label,
      metricLabel: `동일 모델 하루 평균 판매량 ${dailySold}`,
      body: `같은 모델이 최근 7일 동안 ${velocity.sold7dCount.toLocaleString("ko-KR")}개 거래됐어요. 하루로 나누면 동일 모델이 ${dailySold} 정도 팔려나간 셈이라, 매입 후 돈이 얼마나 오래 묶일지 가늠할 때 보는 정보예요.`,
      note: "과거 거래 기록이라 실제 판매일을 보장하지는 않습니다.",
      tone: "speed",
    };
  }

  // Wave 394.7.ab: low confidence — 데이터는 있지만 표본 적음. "참고용" 톤.
  // Wave launch-70 (사용자 짚음 "위 큰 글씨는 사용자 친화적으로"):
  //   title 통계 톤 → 자연 문장 ("되팔면 보통 N 안에 팔려요"). 표본 부족은 body 에서.
  if (hasReferenceVelocity && velocity) {
    const hasHours = velocity.medianHoursToSold != null && velocity.medianHoursToSold > 0;
    const label = hasHours
      ? velocityHoursLabel(velocity.medianHoursToSold)
      : `${velocity.sold7dCount.toLocaleString("ko-KR")}건`;
    return {
      eyebrow: "5. 판매 속도",
      title: hasHours
        ? `판매 속도는 참고로 ${label} 정도예요`
        : `최근 7일 동안 ${velocity.sold7dCount.toLocaleString("ko-KR")}건 거래됐어요`,
      metric: label,
      metricLabel: `7일 ${velocity.sold7dCount.toLocaleString("ko-KR")}건 — 표본 적음`,
      body: `같은 모델이 최근 7일 동안 ${velocity.sold7dCount.toLocaleString("ko-KR")}건만 거래돼서 추세 단정은 어려워요. 위 숫자는 참고용으로 보고, 매입가는 더 보수적으로 잡는 게 안전해요.`,
      note: "표본이 적은 모델은 판매가 늦어질 수 있어요. 시세와 셀러 신뢰도를 같이 보세요.",
      tone: "speed",
    };
  }

  if (velocity && observedVelocitySample > 0) {
    return {
      eyebrow: "5. 판매 속도",
      title: `같은 모델 거래 기록은 ${observedVelocitySample.toLocaleString("ko-KR")}건 잡혔어요`,
      metric: `${observedVelocitySample.toLocaleString("ko-KR")}건`,
      metricLabel: velocity.conditionSpecific ? "같은 상태 거래 기록" : "동일 모델 거래 기록",
      body: "판매까지 걸린 시간을 안정적으로 말하기엔 부족하지만, 거래 기록 자체는 잡혀 있어요. 이럴 땐 판매 주기를 단정하지 않고 시세와 비교 매물, 판매자 신뢰를 같이 봅니다.",
      note: "피드 진입은 회전 기록을 보지만, 화면에서는 시간이 불안정하면 건수로 낮춰 표시합니다.",
      tone: "speed",
    };
  }

  // Wave 394.7.ab: marketBasis 자체가 안 채워졌으면 lazy-fill 진행 중. 정직 카피.
  if (analysisPending) {
    return {
      eyebrow: "5. 판매 속도",
      title: "거래 기록 데이터를 받는 중이에요",
      metric: "잠시만요",
      metricLabel: "분석 진행 중",
      body: "이 매물의 비교 기록을 가져오는 중이에요. 잠시 후 다시 확인하거나, 상세 분석에서 시세와 비교 매물을 먼저 보면 돼요.",
      note: "데이터가 비어 있을 땐 가격과 판매자 신뢰도를 더 보수적으로 봅니다.",
      tone: "speed",
    };
  }

  // Wave 394.7.ab: 판매 기록 자체 부족 — 정직 카피 ("수집 중" 단어 X).
  return {
    eyebrow: "5. 판매 속도",
    title: marketSoldSample > 0 ? "거래 기록은 있지만 판매까지 걸린 시간은 부족해요" : "이 모델은 거래 기록 표본이 부족해요",
    metric: marketSoldSample > 0 ? `${marketSoldSample.toLocaleString("ko-KR")}건` : (marketActiveSample > 0 ? `${marketActiveSample.toLocaleString("ko-KR")}건` : "—"),
    metricLabel: marketSoldSample > 0 ? "비슷한 거래 기록" : (marketActiveSample > 0 ? "현재 비교 매물" : "표본 부족"),
    body: marketSoldSample > 0
      ? "거래 기록은 잡혔지만 판매까지 걸린 시간을 안정적으로 말할 만큼은 아직 모자라요. 가격과 판매자 신뢰도를 더 보수적으로 보는 게 좋아요."
      : marketActiveSample > 0
        ? `현재 비교 매물은 ${marketActiveSample.toLocaleString("ko-KR")}건 잡혔는데 과거 판매 기록은 부족해요. 매물 자체가 자주 나오는 모델이 아니거나, 거래가 천천히 도는 카테고리일 수 있어요.`
        : "이 모델은 같은 상태로 팔린 기록이 아직 충분히 누적되지 않았어요. 회전 속도 단정 대신 비교 매물 가격과 셀러 신뢰도를 우선 보세요.",
    note: "상세 분석에서 시세 그래프와 비교 매물을 함께 확인하세요.",
    tone: "speed",
  };
}

function finalMoneyGuideStep(card: RevealCard): BeginnerGuideStep {
  const snapshot = costAssuranceSnapshot(card);
  const feeRateLabel = `${Math.round(SELLING_FEE_RATE * 1000) / 10}%`;
  const isDaangn = card.marketplaceSource === "daangn";
  const sellingFeeLabel = isDaangn
    ? "0원"
    : snapshot.sellingFee == null ? feeRateLabel : `${feeRateLabel} (${krw(snapshot.sellingFee)})`;
  // 2026-05-26 (사용자 짚음 "한 줄 문장 가시성 0"):
  //   body 한 줄 문장 → "" (renderer 가 BeginnerGuideBuyMetricGrid grid 카드 박음).
  //   note 만 유지 (수수료/버퍼 설명 보조).
  return {
    eyebrow: "1. 숫자 요약",
    title: "정확한 숫자부터 볼게요",
    metric: displayProfitRange(card),
    metricLabel: isDaangn ? "당근 수수료 0원 · 직거래 기준" : "배송비·수수료·안전버퍼 반영",
    body: "",
    note: isDaangn
      ? "당근 기준 판매 수수료와 재배송비는 0원으로 봐요. 네고·이동·거래 불발 리스크는 구매 전 따로 확인하세요."
      : `순익은 구매 배송비와 되팔 때 수수료 ${sellingFeeLabel}, 재배송비 ${krw(snapshot.resellShippingFee)}, 안전버퍼 ${krw(SAFETY_BUFFER)}까지 감안한 값이에요.`,
    tone: "buy",
  };
}

// Wave 394.7.y (사용자 피드백): 안전결제 → 셀러 신뢰 step 안으로 흡수 (10→9 step).
// safePaymentGuideStep 함수는 sellerTrustGuideStep note 에 합쳐짐 — 이 함수는 더 이상 사용 X.

function channelGuideStep(card: RevealCard): BeginnerGuideStep {
  const daangnProfit = sourceAwareProfitAverage(card, "daangn");
  const marketplaceProfit = sourceAwareProfitAverage(card, card.marketplaceSource ?? "bunjang");
  const betterChannel = daangnProfit > marketplaceProfit ? "당근 직거래가 더 남을 수 있지만" : "중고 마켓 재판매는";

  return {
    eyebrow: "3. 되팔 곳",
    title: "팔 곳에 따라 남는 돈이 달라요",
    metric: displayProfitRange(card),
    metricLabel: "중고 마켓 기준 예상 차익",
    body: `${betterChannel}, 거래 범위와 네고 부담이 달라요. 그래서 번개장터, 중고나라, 당근 직거래를 나눠서 보여드릴게요.`,
    note: "당근은 수수료가 적을 수 있지만 지역/직거래/네고 부담이 있고, 중고 마켓은 전국 거래와 플랫폼 결제 흐름이 장점이에요.",
    tone: "channel",
  };
}

function summaryGuideStep(card: RevealCard): BeginnerGuideStep {
  const guidance = buyPriceGuidance({
    price: card.price,
    currentProfit: expectedProfitAverage(card),
  });
  const recommendation = guidance?.verdict === "great" || guidance?.verdict === "good"
    ? "조건부 매수 가능"
    : guidance?.verdict === "fair"
      ? "협상 후 판단"
      : "보수적으로 판단";

  return {
    eyebrow: "",
    title: "최종 판단만 정리했어요",
    metric: recommendation,
    metricLabel: displayProfitRange(card),
    body: guidance
      ? `${krw(guidance.dangerStart)} 이상이면 차익이 얇아져요. 판매자에게 확인 질문을 보낸 뒤 상세 숫자 리포트에서 근거를 펼쳐보면 됩니다.`
      : "판매자에게 확인 질문을 보낸 뒤 상세 숫자 리포트에서 근거를 펼쳐보면 됩니다.",
    note: "",
    tone: "summary",
  };
}

function beginnerGuideSteps(card: RevealCard, context: BeginnerGuideStepContext = {}): BeginnerGuideStep[] {
  // Wave 394.7.y: 안전결제 step 제거 → 셀러 신뢰 안으로 흡수. 10→9 step.
  // Wave 2026-05-25: 피드에서 정확가/시세를 잠근 뒤 상세에 들어오므로 쉬운모드 첫 장은
  //   돈 숫자 요약으로 시작한다. 그다음 비교 매물 → 채널 → 셀러 → 속도 → 요약.
  // Wave 500: "오늘 걸러낸 매물" 가치는 첫 방문 피드 온보딩으로 이동.
  // 상세 쉬운모드는 반복 피로를 줄이기 위해 바로 이 매물의 판단 근거부터 시작한다.
  // Wave launch-69 (사용자 짚음 "둘러보려고 온 건데 매 상품마다 구매 전 체크 나오면 피로"):
  //   purchaseCheckGuideStep 제거 — "원본 보러가기" 클릭 시 confirm 모달 에서 한 번만 표시.
  //   funnel 상 사용자가 진짜 살 의도 있을 때만 보여주는 게 자연스러움.
  return [
    finalMoneyGuideStep(card),
    marketCompareGuideStep(card, context),
    channelGuideStep(card),
    sellerTrustGuideStep(card),
    velocityGuideStep(card, context),
    summaryGuideStep(card),
  ];
}

function displayProfitRange(card: RevealCard) {
  return profitRange(card.expectedProfitMin, card.expectedProfitMax);
}

// Wave 750 (2026-05-25): 득템 점수 통합 — `src/lib/deal-score.ts` 의 computeDealScore 사용.
// 기존 base 50 + cap 30% 공식 (`pack-reveal-modal::calculateDealScore`) 폐기.
// 사용자 보고: "100점 만점에 100점이 저렇게 많은건지" — 차익 27%+ 면 무조건 +40 cap → 풀 거의 다 100점.
// 새 공식은 base 30 + profit cap 50% + 다단계 confidence/sample/seller. 100 = unicorn 만 도달.

function calculateDealScore(card: RevealCard): DealScore {
  return computeDealScore({
    price: card.price,
    expectedProfitMin: card.expectedProfitMin,
    expectedProfitMax: card.expectedProfitMax,
    confidence: card.confidence ?? null,
    sampleCount: card.marketBasis?.sampleCount ?? null,
    sellerReviewRating: card.savedDetail?.sellerReviewRating ?? null,
    sellerReviewCount: card.savedDetail?.sellerReviewCount ?? null,
  });
}

function krwRange(min: number, max: number) {
  if (Math.round(min) === Math.round(max)) return krw(max);
  return `${krw(min)} ~ ${krw(max)}`;
}

function finiteKrw(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

// Wave 392+393: "왜 이 가격?" — condition은 "비교 그룹"으로 사용 (band-aware).
// 진짜 "왜 싸지" 이유 = description 키워드 (급매/이사 등) 또는 셀러 시세 모름.
// "사용감 있어서 싸요" 같은 카피는 부정확 — 사용감 매물도 사용감끼리 비교한 시세 기준.
function getWhyCheapReasons(card: RevealCard): string[] {
  const reasons: string[] = [];
  const cond = card.marketBasis?.conditionClass ?? null;
  const desc = card.savedDetail?.descriptionPreview ?? "";
  const profitPct = netProfitPercent(card) ?? 0;

  // 상태 라벨 (카피 안 형용사 형식 — "X 매물 중에서도" 자연 어법)
  const condLabel =
    isShoeOrClothingCard(card) && tierShortLabel(card.conditionTier)
      ? tierShortLabel(card.conditionTier)
      : cond === "unopened" ? "미개봉" :
        cond === "mint" ? "S급" :
        cond === "clean" ? "A급" :
        cond === "worn" ? "사용감 있는" :
        cond === "flawed" ? "하자 있는" :
        cond === "low_batt" ? "배터리 약한" :
        cond === "normal" ? "비슷한 상태의" : null;

  // 1. Description 키워드 — 가장 명확한 셀러 의도
  if (/급매|급처|빨리/.test(desc)) {
    reasons.push(condLabel
      ? `${condLabel} 매물 중에서도 셀러가 급하게 팔고 싶어해요`
      : "셀러가 급하게 팔고 싶어해요");
  } else if (/이사|이전|학업|입대|군대|해외/.test(desc)) {
    reasons.push("이사·이전 등 정리하는 매물");
  } else if (/선물|받았|개봉만|쓸 일/.test(desc)) {
    reasons.push("선물받았지만 사용 안 함");
  }

  // 2. 차익률 큰데 (>=30%) → 셀러가 그 상태 시세 모름
  if (reasons.length === 0 && profitPct >= 30 && condLabel) {
    reasons.push(`${condLabel} 매물 중에서도 셀러가 낮게 등록한 듯`);
  }

  if (reasons.length === 0 && !hasUsableMarketBasis(card)) {
    reasons.push("같은 출처·같은 상태 비교 매물이 더 필요해요");
  }

  // Fallback — band-aware 비교 명시 (정직한 일반론)
  if (reasons.length === 0) {
    if (condLabel) {
      reasons.push(`${condLabel} 매물 중에서도 저렴하게 올라왔어요`);
    } else {
      reasons.push("비슷한 상태 매물 중에서도 저렴해요");
    }
  }

  return reasons.slice(0, 2);
}

// Wave 393.2: 위계 ↓ — 큰 amber panel → 작은 inline 한 줄. boilerplate 톤 어울리게.
function WhyCheapPanel({ card }: { card: RevealCard }) {
  const reasons = getWhyCheapReasons(card);
  if (reasons.length === 0) return null;
  return (
    <div className="mt-2 flex items-start gap-1.5 text-[11px] font-medium leading-5 text-zinc-500 dark:text-zinc-400">
      <span className="shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true">💡</span>
      <span className="min-w-0">{reasons.join(" · ")}</span>
    </div>
  );
}

// Wave 392.3: 진입장벽 / 불안감 해소 Q&A. 사용자가 모달 보면서 의문 들면 펼침.
// 셀러 / 가품 / 안전결제 / 사기 신고 4개 — 가장 자주 묻는 거.
function WhyTrustCollapse({ card }: { card: RevealCard }) {
  // Wave 394.6.c (외부 review #8): FAQ → 리스크 카드. 첫 Q (셀러 신뢰) default 펼침.
  // "이건 부가 정보가 아니라 구매 판단의 핵심임. FAQ로 숨기면 안 됨" — 외부 review.
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const safety = marketplaceSafetyForCard(card);
  const sellerRating = card.savedDetail?.sellerReviewRating ?? null;
  const reviewCount = card.savedDetail?.sellerReviewCount ?? 0;
  const isPremiumSeller = sellerRating != null && sellerRating >= 4.8 && reviewCount >= 30;
  const cond = card.marketBasis?.conditionClass ?? null;
  const conditionLabel =
    cond === "unopened" ? "미개봉" :
    cond === "mint" ? "S급" :
    cond === "clean" ? "A급" :
    cond === "worn" ? "사용감 있음" :
    cond === "flawed" ? "하자 있음" :
    cond === "low_batt" ? "배터리 약함" : "일반";

  // Wave 394.6.d (외부 review 가품 답 카테고리별 분기 — Wave 393.8 CounterfeitChecklistPanel 연장):
  // "전자제품이 뭔 가품이냐" 사용자 짚음. 폰/태블릿/노트북 = 가품 거의 X (잠금/부품이 진짜 위험).
  // 신발/명품/에어팟 = 가품 위험 큼. WhyTrust 가품 Q 답을 카테고리별 분기 = 정확한 위험 신호.
  //
  // Wave A (2026-05-20): brand 감지되면 brand-specific 답으로 교체 (Nike Jordan / Adidas Yeezy 등).
  //   외부 review 직접 인용: "라벨/봉제/안감 3축 확인하세요'가 너무 일반적. Bird-aid 라벨,
  //   GORE-TEX 4면 박음질 같은 모델별 가품 체크포인트가 있어야 진짜 가치 있음."
  const category = categoryFromComparableKey(card.marketBasis?.comparableKey ?? null);
  const brandDepth = detectBrandDepth(category, {
    skuId: card.skuId ?? null,
    skuName: card.skuName ?? null,
    name: card.name ?? null,
  });
  const counterfeitAnswer = ((): React.ReactNode => {
    const condBold = <b className="font-bold">{conditionLabel}</b>;
    // Brand 감지된 경우 — brand-specific 답 우선 (shoe Wave A. 후속 wave 에서 다른 카테고리 확장).
    if (brandDepth) {
      const riskLabel = COUNTERFEIT_RISK_LABEL[brandDepth.brand.counterfeitRisk];
      const top2Checks = brandDepth.brand.counterfeitChecks.slice(0, 2);
      return (
        <>
          이 매물은 {condBold}로 분류돼요. <b className="font-bold">{brandDepth.brand.label}</b> — <b className="font-bold">{riskLabel}</b>.
          {top2Checks.length > 0 ? (
            <>
              {" "}변별 포인트: {top2Checks.map((c, i) => (
                <span key={i}>{i > 0 ? " · " : ""}{c}</span>
              ))}
            </>
          ) : null}
          {brandDepth.brand.authentication.length > 0 ? (
            <>
              {" "}인증: <b className="font-bold">{brandDepth.brand.authentication[0]}</b>.
            </>
          ) : null}
        </>
      );
    }
    switch (category) {
      case "shoe":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">신발 가품 위험 큼</b> (특히 명품/한정판).
          {" "}KREAM 검수 권장. 안창 / 박스 / 태그 / 시리얼 확인 필수.</>;
      case "earphone":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">차이팟(가품 에어팟) 흔함</b>.
          {" "}패키지 시리얼 / 케이스 정품 인증 / 무게(정품 50g) 확인.</>;
      case "bag":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">명품 가방 가품 위험 큼</b>.
          {" "}라벨 / 봉제선 / 안감 / 시리얼 확인. 정품 인증 서비스 (KREAM, 트렌비) 권장.</>;
      case "watch":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">명품 시계 가품 위험 매우 큼</b>.
          {" "}정품 보증서 필수 + 시리얼 매칭 + AS 가능 확인.</>;
      case "perfume":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">공병 / 가짜 향료 위험</b>.
          {" "}시리얼 + 박스 인쇄 품질 + 향 패턴 확인.</>;
      case "clothing":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">명품/스트릿웨어 가품 흔함</b> (Supreme/Stussy/BAPE 등).
          {" "}라벨 / 봉제 / 태그 / 시리얼 확인.</>;
      case "smartphone":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">가품 거의 없음</b>.
          {" "}진짜 위험 = <b className="font-bold">iCloud/구글 잠금, IMEI 위변조, 부품 교체</b>. 통신사 등록 확인.</>;
      case "tablet":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">가품 거의 없음</b>.
          {" "}진짜 위험 = <b className="font-bold">iCloud 잠금, 액정, 배터리 상태</b>. 모델 + IMEI 확인.</>;
      case "smartwatch":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">가품 거의 없음</b>.
          {" "}진짜 위험 = <b className="font-bold">iCloud 잠금, 페어링, 배터리 사이클</b>.</>;
      case "laptop":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">가품 거의 없음</b>.
          {" "}진짜 위험 = <b className="font-bold">iCloud (맥북), 부품 교체 (램/SSD), 액정, 키보드</b>.</>;
      case "drone":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">DJI 가품 거의 없음</b>.
          {" "}진짜 위험 = <b className="font-bold">활성화 (DJI 계정), 펌웨어, 배터리 사이클</b>.</>;
      case "camera":
        return <>이 매물은 {condBold}로 분류돼요. <b className="font-bold">가품 거의 없음</b>.
          {" "}진짜 위험 = <b className="font-bold">셔터 카운트, 렌즈 곰팡이, 센서 클리닝, AS 가능</b>.</>;
      default:
        return <>이 매물은 {condBold}로 분류돼요. 미뇨이는 의심 키워드 매물을 사전 차단하고 있어요.
          {" "}그래도 직거래 시 <b className="font-bold">시리얼 번호 / 정품 보증서</b> 확인 권장. 아래 체크리스트 펼쳐서 확인하세요.</>;
    }
  })();

  const qas: { q: string; a: React.ReactNode }[] = [
    {
      q: "셀러 믿을 만한가요?",
      a: safety.isJoongna ? (
        <>
          {safety.sellerTrust.assessment}
          {safety.sellerTrust.badgeLabel ? <> <b className="font-bold">{safety.sellerTrust.badgeLabel}</b>도 같이 확인했어요.</> : null}
          {" "}선입금이나 외부 결제 유도가 나오면 구매를 멈추세요.
        </>
      ) : sellerRating != null ? (
        <>
          이 셀러 평점은 <b className="font-bold">{sellerRating.toFixed(1)}점</b> ({reviewCount.toLocaleString("ko-KR")}건 후기).
          {isPremiumSeller
            ? " 우수 셀러로 분류돼요 (평점 4.8+ & 후기 30건+)."
            : reviewCount >= 10
              ? " 평점과 후기 표본은 확인했지만, 거래 전 원본 후기와 실사진을 다시 확인하세요."
              : " 후기 수가 적어요. 안전결제 + 직거래 검수 권장."}
        </>
      ) : (
        <>이 셀러는 아직 후기가 없어요. <b className="font-bold">{safety.paymentLabel} 가능 여부 또는 직거래 검수</b>를 먼저 확인하세요. 확인이 안 되면 보류하세요.</>
      ),
    },
    {
      q: "가품 위험 없나요?",
      a: counterfeitAnswer,
    },
    {
      q: "안전결제 어떻게 되나요?",
      a: (
        <>
          {marketplacePaymentNote(card)}
          {" "}선입금, 외부 결제 링크, 외부 메신저 유도가 나오면 구매를 멈추세요. 정산·분쟁 조건은 원본 플랫폼에서 마지막으로 확인하세요.
        </>
      ),
    },
    {
      q: "사기 당하면 어떻게 하나요?",
      a: (
        <>
          사기 의심 신호가 나오면 결제 전에 멈추고 <b className="font-bold">원본 플랫폼 신고/고객센터</b>에서 절차를 확인하세요.
          {" "}입금자명 변경, 신분증 인증 요구, 도용 사진 의심은 보류 신호로 봅니다. 미뇨이는 거래 당사자가 아니라 위험 신호를 먼저 정리해드려요.
          {safety.sourceAction ? (
            <>
              {" "}<a href={safety.sourceAction.href} target="_blank" rel="noreferrer" className="font-black text-blue-700 underline decoration-blue-300 underline-offset-2 dark:text-blue-300">
                {safety.sourceAction.label}
              </a>
              {" "}도 같이 확인하세요.
            </>
          ) : null}
        </>
      ),
    },
  ];

  return (
    <div className="mt-[18px] overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Wave 394.7.t: handoff FAQ 정확 — FAQ header + border + shield tone. */}
      <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-zinc-50 px-3.5 pb-2 pt-3 dark:border-zinc-800 dark:bg-zinc-950/55">
        <ShieldIcon className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
        <span className="text-[12.5px] font-extrabold text-zinc-900 dark:text-zinc-100">
          구매 전 확인 — 자주 묻는 4가지
        </span>
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {qas.map((item, idx) => {
          const open = openIdx === idx;
          return (
            <li key={idx}>
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : idx)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              >
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {item.q}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {open ? (
                <div className="px-4 pb-3 text-xs font-medium leading-6 text-zinc-600 dark:text-zinc-400">
                  {item.a}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function costAssuranceSnapshot(card: RevealCard) {
  const safety = marketplaceSafetyForCard(card);
  const buyerShippingLow = 0;
  const buyerShippingHigh = safety.shipping.buyerShippingHigh;
  const buyCostLow = card.price + buyerShippingLow;
  const buyCostHigh = card.price + buyerShippingHigh;
  const buyerCostLabel = krwRange(buyCostLow, buyCostHigh);
  const fallbackSalePrice = finiteKrw(card.marketBasis?.medianPrice);
  const profitBasisSaleLow = fallbackSalePrice == null
    ? resalePriceFromProfit(card.expectedProfitMin, buyCostHigh, card.marketplaceSource)
    : null;
  const profitBasisSaleHigh = fallbackSalePrice == null
    ? resalePriceFromProfit(card.expectedProfitMax, buyCostLow, card.marketplaceSource)
    : null;
  const salePriceLow = fallbackSalePrice ?? profitBasisSaleLow;
  const salePriceHigh = fallbackSalePrice ?? profitBasisSaleHigh ?? salePriceLow;
  const salePrice = salePriceLow == null || salePriceHigh == null
    ? null
    : Math.round((salePriceLow + salePriceHigh) / 2);
  const conditionAdjustment = fallbackSalePrice == null || salePrice == null
    ? 0
    : conditionResaleAdjustmentKrw({
      marketPrice: salePrice,
      conditionChips: card.conditionChips,
      conditionClass: card.marketBasis?.conditionClass ?? null,
      conditionTier: card.conditionTier,
    });
  const adjustedSalePrice = salePrice == null ? null : Math.max(0, salePrice - conditionAdjustment);
  const salePriceLabel = salePriceLow == null || salePriceHigh == null
    ? "시세 확인 중"
    : krwRange(Math.min(salePriceLow, salePriceHigh), Math.max(salePriceLow, salePriceHigh));
  const sellingFee = adjustedSalePrice == null ? null : sellingFeeForMarketPrice(adjustedSalePrice, card.marketplaceSource);
  const resellShippingFee = resellShippingFeeForSource(card.marketplaceSource);
  const safetyBuffer = safetyBufferForSource(card.marketplaceSource);
  const shippingLabel = safety.shipping.label;
  const confidenceLabel = safety.shipping.confidenceLabel;
  const confidenceClass = safety.shipping.buyerShippingHigh === 0
    ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
    : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200";

  return {
    salePrice,
    adjustedSalePrice,
    salePriceLabel,
    sellingFee,
    conditionAdjustment,
    resellShippingFee,
    safetyBuffer,
    buyerCostLabel,
    shippingLabel,
    shippingValueLabel: safety.shipping.valueLabel,
    shippingNote: safety.shipping.note,
    confidenceLabel,
    confidenceClass,
  };
}

function resalePriceFromProfit(profit: number, buyCost: number, marketplaceSource?: string | null) {
  const sellFeeRate = String(marketplaceSource ?? "").toLowerCase() === "daangn" ? 0 : SELLING_FEE_RATE;
  const denominator = 1 - sellFeeRate;
  if (!Number.isFinite(profit) || !Number.isFinite(buyCost) || denominator <= 0) return null;
  return finiteKrw((profit + buyCost + resellShippingFeeForSource(marketplaceSource) + safetyBufferForSource(marketplaceSource)) / denominator);
}

// Wave 2026-05-19 v2 (외부인 #7 권장 매입가 프레임):
// 헬퍼 본체는 src/lib/buy-price-guidance.ts (모달 + 카드 리스트 공유).

function freshLabel(seconds: number) {
  if (seconds < 60) return `${seconds}초 전 검증`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}분 전 검증`;
  return `${Math.round(seconds / 3600)}시간 전 검증`;
}

// 2026-05-20 P0-Upload: 셀러 등록 시점 라벨 (first_seen_at 기반).
//   "등록 N시간 전" — 사용자가 가장 궁금해하는 정보. freshLabel(검증)과 구분.
//   미뇨이 crawler 처음 발견 시점 = 실제 업로드 + 0~30분 lag (collect cadence 기준).
function uploadAgoLabel(firstSeenAtIso: string | null | undefined): string | null {
  if (!firstSeenAtIso) return null;
  const ms = Date.now() - new Date(firstSeenAtIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "방금 등록";
  if (seconds < 3600) return `${Math.round(seconds / 60)}분 전 등록`;
  if (seconds < 24 * 3600) return `${Math.round(seconds / 3600)}시간 전 등록`;
  return `${Math.round(seconds / 86400)}일 전 등록`;
}

function seenAgoLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}분 전 확인`;
  if (seconds < 24 * 3600) return `${Math.round(seconds / 3600)}시간 전 확인`;
  return `${Math.round(seconds / 86400)}일 전 확인`;
}

// Wave 393.7: 신선도 chip + Pro link 제거 (사용자 짚음 — 모달엔 불필요).
// ConditionChip(friendly)만 노출. 신선도는 매입/시세 메타 라인의 freshLabel에 이미 있음.
// Wave 394.2 (외부 review #20): 사진 분석 부재 한계 명시 — "AI가 사진 봤겠지" 오해 차단.
// description (텍스트) 기반 판단이라는 한계 1줄. 사진 직접 확인 권장.
function LastVerifiedAtBadge({ card }: { card: RevealCard }) {
  const cond = card.marketBasis?.conditionClass ?? null;
  const tier = card.conditionTier ?? null;
  const chips = card.conditionChips ?? null;
  // Wave 714d (2026-05-23 fix): 신발/의류는 기존 ConditionChip 숨김 (전자기기용 라벨 정확도 낮음).
  const comparableKey = card.marketBasis?.comparableKey ?? null;
  const isShoeOrClothing = Boolean(
    comparableKey && (comparableKey.startsWith("shoe|") || comparableKey.startsWith("clothing|")),
  );
  if (!cond && !tier && (!chips || chips.length === 0)) return null;
  return (
    <div className="mb-2">
      {/* Wave 394.7.f (외부 review 2라운드 #7): chip 옆에 "판매글 기준" prefix — 사진 분석 X 명확. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          판매글 기준
        </span>
        {cond && !isShoeOrClothing && <ConditionChip conditionClass={cond} variant="friendly" />}
        {/* Wave 714d (2026-05-23): 신발/의류 5-tier 등급 chip — 쉬운모드용 friendly variant.
            Wave 714f (2026-05-23): showHelp 추가 — ? 버튼 클릭 시 분류 기준 popover. */}
        {tier && (
          <ConditionTierChip
            tier={tier}
            showHelp
            category={comparableKey?.startsWith("clothing|") ? "clothing" : "shoe"}
          />
        )}
      </div>
      {/* Wave 714d: raw 표현 chips (박스/하자/실착 등) */}
      {chips && chips.length > 0 && (
        <div className="mt-1.5">
          <ConditionChipsList chips={chips} max={5} />
        </div>
      )}
      <div className="mt-1 text-[10px] font-medium leading-tight text-zinc-400 dark:text-zinc-500">
        사진은 직접 확인 권장
      </div>
    </div>
  );
}

function conditionFriendlyText(conditionClass: string | null | undefined) {
  if (conditionClass === "unopened") return "미개봉";
  if (conditionClass === "mint") return "거의 새것";
  if (conditionClass === "clean") return "깨끗한 편";
  if (conditionClass === "normal") return "상태 보통";
  if (conditionClass === "worn") return "사용감 있음";
  if (conditionClass === "flawed") return "하자 있음";
  if (conditionClass === "low_batt") return "배터리 약함";
  return conditionClass ?? "상태 확인";
}

function velocityHoursLabel(value: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  if (value < 24) return `${Math.round(value * 10) / 10}시간`;
  return `${Math.round((value / 24) * 10) / 10}일`;
}

function dailySoldCountLabel(sold7dCount: number) {
  const avg = Math.max(0, sold7dCount / 7);
  // Wave launch-26: "확인 중" → "기록 없음" 정직 (sold7dCount=0 = 진짜 기록 없는 거).
  if (avg <= 0) return "기록 없음";
  if (avg < 1) return "1개 미만";
  const rounded = avg < 10 ? Math.round(avg * 10) / 10 : Math.round(avg);
  return `약 ${rounded.toLocaleString("ko-KR")}개`;
}

function marketSampleLabel(card: RevealCard) {
  const market = card.marketBasis;
  if (market?.sampleCount > 0) {
    return `표본 ${market.sampleCount.toLocaleString("ko-KR")}건`;
  }
  return "표본 부족";
}

// Wave launch-78 (사용자 정정): 신발/의류 5-tier(S/A/B/C/D)는 옛 conditionClass와 별개 axis (Wave 714).
// 헤더 chip은 tier 보여주는데 비교 패널은 옛 conditionClass "clean"→"A급" 박혀 있어서 mismatch.
// → 신발/의류 카테고리면 tier 기반 라벨 우선, 아니면 기존 conditionClass.
function isShoeOrClothingCard(card: RevealCard): boolean {
  const ck = card.marketBasis?.comparableKey ?? null;
  return Boolean(ck && (ck.startsWith("shoe|") || ck.startsWith("clothing|")));
}

function tierGroupLabel(tier: string | null | undefined): string | null {
  if (!tier) return null;
  if (tier === "S") return "S급 상품";
  if (tier === "A") return "A급 상품";
  if (tier === "B") return "B급 상품";
  if (tier === "C") return "C급 상품";
  if (tier === "D") return "D급 상품";
  if (tier === "UNKNOWN") return "정보 부족 상품";
  return null;
}

function tierShortLabel(tier: string | null | undefined): string | null {
  if (!tier) return null;
  if (tier === "S") return "S급";
  if (tier === "A") return "A급";
  if (tier === "B") return "B급";
  if (tier === "C") return "C급";
  if (tier === "D") return "D급";
  if (tier === "UNKNOWN") return "정보 부족";
  return null;
}

function conditionShortLabel(conditionClass: string | null | undefined): string | null {
  if (conditionClass === "unopened") return "미개봉";
  if (conditionClass === "mint") return "S급";
  if (conditionClass === "clean") return "A급";
  if (conditionClass === "worn") return "사용감 있는";
  if (conditionClass === "flawed") return "하자 있는";
  if (conditionClass === "low_batt") return "배터리 약한";
  if (conditionClass === "normal") return "비슷한 상태";
  return null;
}

// Wave launch-81 (사용자 정정 — 3 화면 비교 매물 통일):
//   운영자풀(market-source-debug.tsx) 패턴 — `같은 등급(X급) > 인접 등급(±1) > 그 외 > 등급 정보 없음`
//   을 상세페이지/쉬운모드에도 적용. 신발/의류 대상 (옛 conditionClass 매물은 grouping 적용 X).
const TIER_ORDER_FOR_DISTANCE = ["S", "A", "B", "C", "D"] as const;
function computeTierDistance(ourTier: string | null | undefined, sampleTier: string | null | undefined): number {
  if (!ourTier || !sampleTier) return 99;
  const ourIdx = TIER_ORDER_FOR_DISTANCE.indexOf(ourTier as typeof TIER_ORDER_FOR_DISTANCE[number]);
  const sampleIdx = TIER_ORDER_FOR_DISTANCE.indexOf(sampleTier as typeof TIER_ORDER_FOR_DISTANCE[number]);
  if (ourIdx < 0 || sampleIdx < 0) return 99;
  return Math.abs(ourIdx - sampleIdx);
}
function tierGroupHeading(ourTier: string | null | undefined, distance: number): string {
  if (!ourTier) return "";
  if (distance === 0) return `같은 등급 (${ourTier}급)`;
  if (distance === 1) return "인접 등급 (±1)";
  if (distance === 99) return "등급 정보 없음";
  return "그 외 등급";
}
// Wave launch-81: 비교 매물 list 를 tier distance group 으로 묶고 같은 group 안에서 가격 오름차순.
function groupListingsByTierDistance<T extends { conditionTier?: string | null; price: number }>(
  ourTier: string | null | undefined,
  listings: T[],
): Array<{ distance: number; heading: string; items: T[] }> {
  if (!ourTier) {
    return [{ distance: 0, heading: "", items: [...listings] }];
  }
  const buckets = new Map<number, T[]>();
  for (const item of listings) {
    const d = computeTierDistance(ourTier, item.conditionTier);
    const arr = buckets.get(d) ?? [];
    arr.push(item);
    buckets.set(d, arr);
  }
  const orderedDistances = [...buckets.keys()].sort((a, b) => a - b);
  return orderedDistances.map((d) => ({
    distance: d,
    heading: tierGroupHeading(ourTier, d),
    // 사용자 요청: 비교 매물 가격 정렬 일관성 — 모든 카테고리 DESC (높은 가격 먼저).
    items: (buckets.get(d) ?? []).sort((a, b) => (b.price ?? 0) - (a.price ?? 0)),
  }));
}

function marketConditionLabel(card: RevealCard) {
  const market = card.marketBasis;
  if (market?.priceSource === "reference") return "미개봉/새상품";
  // Wave launch-78: 신발/의류는 tier 우선.
  if (isShoeOrClothingCard(card)) {
    const tierLabel = tierShortLabel(card.conditionTier);
    if (tierLabel) return tierLabel;
  }
  return market?.conditionLabel ?? "같은 상태";
}

function conditionComparisonGroupLabel(card: RevealCard) {
  const market = card.marketBasis;
  if (market?.priceSource === "reference") return "미개봉품";
  // Wave launch-78: 신발/의류는 5-tier 우선 — 옛 conditionClass "clean"이 같이 박혀 있어도 무시.
  if (isShoeOrClothingCard(card)) {
    const tierLabel = tierGroupLabel(card.conditionTier);
    if (tierLabel) return tierLabel;
  }
  const conditionClass = market?.conditionClass ?? null;
  if (conditionClass === "unopened") return "미개봉품";
  if (conditionClass === "mint") return "S급 상품";
  if (conditionClass === "clean") return "A급 상품";
  if (conditionClass === "normal") return "보통 상태 상품";
  if (conditionClass === "worn") return "사용감 있는 상품";
  if (conditionClass === "flawed") return "하자 있는 상품";
  if (conditionClass === "low_batt") return "배터리 약한 상품";
  return "비슷한 상태 상품";
}

function conditionProductLabel(card: RevealCard) {
  const market = card.marketBasis;
  if (market?.priceSource === "reference") return "미개봉품";
  // Wave launch-78: 신발/의류 tier 우선.
  if (isShoeOrClothingCard(card)) {
    const tierLabel = tierGroupLabel(card.conditionTier);
    if (tierLabel) return tierLabel;
  }
  const conditionClass = market?.conditionClass ?? null;
  if (conditionClass === "unopened") return "미개봉품";
  if (conditionClass === "mint") return "S급 상품";
  if (conditionClass === "clean") return "A급 상품";
  if (conditionClass === "normal") return "상태 보통 상품";
  if (conditionClass === "worn") return "사용감 있는 상품";
  if (conditionClass === "flawed") return "하자가 있는 상품";
  if (conditionClass === "low_batt") return "배터리 약한 상품";
  return `${marketConditionLabel(card)} 상품`;
}

function conditionBasisSentence(card: RevealCard) {
  const market = card.marketBasis;
  const productLabel = conditionProductLabel(card);
  const groupLabel = conditionComparisonGroupLabel(card);
  const model = market?.label ?? card.skuName;
  if (market?.priceSource === "reference") {
    return `이 상품은 ${productLabel}이에요. 득템잡이는 새상품 기준가와 중고 마켓의 ${model} ${groupLabel} 흐름을 같이 보면서 시세를 측정했어요.`;
  }
  return `이 상품은 ${productLabel}이에요. 득템잡이는 중고 마켓에 있는 ${model} ${groupLabel}끼리 시세를 비교했어요.`;
}

function marketPricePositionLine(card: RevealCard) {
  const median = card.marketBasis?.medianPrice ?? null;
  if (median == null || median <= 0 || card.price <= 0) return "가격 판단은 비교 매물과 상태 기준을 같이 보고 있어요.";
  const diff = median - card.price;
  const diffAbs = Math.abs(diff);
  const groupLabel = conditionComparisonGroupLabel(card);
  if (diff > 0) return `${groupLabel} 시세보다 ${krw(diffAbs)} 싸게 나온 편이에요.`;
  if (diff < 0) return `${groupLabel} 시세보다 ${krw(diffAbs)} 높아서 가격은 더 보수적으로 봐야 해요.`;
  return `${groupLabel} 시세와 거의 비슷한 가격이에요.`;
}

function marketBasisPlainSentence(card: RevealCard) {
  const market = card.marketBasis;
  if (!market) return "모델과 상태 분류가 충분하지 않으면 추천 강도를 낮춰요.";
  if (market.priceSource === "reference") {
    return "미개봉/새상품은 새상품 기준가를 먼저 보고, 중고 마켓의 미개봉 거래 추이는 따로 확인해요.";
  }
  const condition = market.conditionLabel ?? "같은 상태";
  return `${condition}로 분류된 매물끼리 먼저 비교해요. 새상품이나 더 깨끗한 상품 시세를 섞어 수익을 부풀리지 않아요.`;
}

function uniqueCompactList(values: Array<string | null | undefined>, limit: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const clean = value?.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function recommendationGoodSignals(card: RevealCard) {
  const detail = card.savedDetail;
  const safety = marketplaceSafetyForCard(card);
  const market = card.marketBasis;
  const velocity = card.velocityBasis;
  const goodVerdicts = verdictsForCard(card).filter((v) => v.tone === "good").map((v) => v.label);
  return uniqueCompactList([
    safety.isJoongna && (safety.sellerTrust.trustScore != null || safety.sellerTrust.reviewCount > 0)
      ? safety.sellerTrust.metric
      : detail?.sellerReviewRating != null && detail.sellerReviewRating >= 4.5
      ? `셀러 후기 ${detail.sellerReviewRating.toFixed(1)}`
      : null,
    velocity?.medianHoursToSold != null && velocity.medianHoursToSold > 0 && velocity.sold7dCount > 0
      ? `비슷한 상품 ${velocityHoursLabel(velocity.medianHoursToSold)} 안에 판매`
      : null,
    market?.priceSource === "reference" ? "다나와 새 가격 확인" : `${marketConditionLabel(card)} 시세로 비교`,
    safety.shipping.allowFreeShippingBadge ? "무료배송" : safety.shipping.assumption === "included" ? "배송비 포함" : null,
    ...goodVerdicts,
  ], 4);
}

function recommendationWatchSignals(card: RevealCard) {
  const market = card.marketBasis;
  return uniqueCompactList([
    market?.confidence === "low" ? "시세 표본은 아직 낮은 편" : null,
    market?.conditionClass === "worn" ? "사용감은 같은 등급 시세에 반영" : null,
  ], 3);
}

function recommendationFeatureCards(card: RevealCard): RecommendationFeatureCard[] {
  const detail = card.savedDetail;
  const safety = marketplaceSafetyForCard(card);
  const market = card.marketBasis;
  const velocity = card.velocityBasis;
  const flow = card.skuListingFlow;
  const cards: RecommendationFeatureCard[] = [];

  const profitMin = Math.min(card.expectedProfitMin, card.expectedProfitMax);
  const profitMax = Math.max(card.expectedProfitMin, card.expectedProfitMax);
  if (profitMin > 0) {
    cards.push({
      icon: <WalletIcon className="h-4 w-4" />,
      title: "비용 차감 통과",
      body: `매입 ${krw(card.price)} 기준, 비용 차감 후 ${profitRange(profitMin, profitMax)} 남는 구간으로 봤어요.`,
      tone: "profit",
    });
  }

  if (market?.medianPrice && market.medianPrice > 0 && card.price > 0) {
    const discount = Math.round(((market.medianPrice - card.price) / market.medianPrice) * 100);
    if (discount >= 8) {
      cards.push({
        icon: <TargetIcon className="h-4 w-4" />,
        title: `시세보다 ${discount}% 낮음`,
        body: `${marketConditionLabel(card)} 기준 시세 ${krw(market.medianPrice)}와 비교했을 때 매입가가 낮아요.`,
        tone: "market",
      });
    }
  }

  if (velocity?.medianHoursToSold != null && velocity.medianHoursToSold > 0 && velocity.sold7dCount > 0) {
    cards.push({
      icon: <ScaleIcon className="h-4 w-4" />,
      title: `${velocityHoursLabel(velocity.medianHoursToSold)} 회전`,
      body: `최근 7일 비슷한 상품 판매 ${velocity.sold7dCount.toLocaleString("ko-KR")}건을 같이 봤어요.`,
      tone: "speed",
    });
  } else if (flow && flow.avgPerDay7d > 0) {
    const ratio = flow.count24h / flow.avgPerDay7d;
    if (ratio >= 1.3) {
      cards.push({
        icon: <ScaleIcon className="h-4 w-4" />,
        title: "오늘 유입 많음",
        body: `최근 24시간 ${flow.count24h}건, 7일 평균 ${flow.avgPerDay7d}건/일보다 매물이 활발해요.`,
        tone: "speed",
      });
    }
  }

  const goodVerdicts = verdictsForCard(card)
    .filter((v) => v.tone === "good")
    .map((v) => v.label)
    .filter((label) => !label.startsWith("시세보다") && !label.includes("회전") && !label.includes("시세 신뢰"));
  if (goodVerdicts.length > 0) {
    cards.push({
      icon: <ShieldIcon className="h-4 w-4" />,
      title: goodVerdicts.slice(0, 2).join(" · "),
      body: "매물 설명과 상태 신호에서 추가로 잡힌 장점이에요.",
      tone: "quality",
    });
  } else if (safety.isJoongna && (safety.sellerTrust.trustScore != null || safety.sellerTrust.reviewCount > 0)) {
    cards.push({
      icon: <ShieldIcon className="h-4 w-4" />,
      title: safety.sellerTrust.assessmentLabel,
      body: safety.sellerTrust.assessment,
      tone: "quality",
    });
  } else if (detail?.sellerReviewRating != null && detail.sellerReviewRating >= 4.5) {
    cards.push({
      icon: <ShieldIcon className="h-4 w-4" />,
      title: `셀러 후기 ${detail.sellerReviewRating.toFixed(1)}`,
      body: `후기 ${detail.sellerReviewCount.toLocaleString("ko-KR")}건의 판매자 신뢰도도 같이 봤어요.`,
      tone: "quality",
    });
  }

  if (cards.length === 0) {
    cards.push({
      icon: <TargetIcon className="h-4 w-4" />,
      title: market?.label ?? card.skuName,
      body: `${marketSampleLabel(card)}과 비용 차감 기준으로 추천 후보에 남겼어요.`,
      tone: "market",
    });
  }

  return cards.slice(0, 4);
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`rounded-full bg-zinc-200/80 dark:bg-zinc-800 ${className}`} />;
}

function RevealResultSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      <div className="grid gap-3 rounded-xl border border-[#e3ddd2] bg-white p-3 shadow-lg shadow-[rgba(49,130,246,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-[118px] w-full rounded-lg bg-zinc-200/80 dark:bg-zinc-800" />
        <div className="min-w-0 space-y-3">
          <SkeletonLine className="h-4 w-4/5" />
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-3 dark:border-blue-900/40 dark:bg-blue-950/20">
            <SkeletonLine className="h-3 w-20 bg-blue-200/80 dark:bg-blue-900/60" />
            <SkeletonLine className="mt-2 h-7 w-36 bg-blue-200/80 dark:bg-blue-900/60" />
            <SkeletonLine className="mt-2 h-3 w-52" />
          </div>
          <div className="hidden flex-wrap gap-1.5">
            <SkeletonLine className="h-5 w-16" />
            <SkeletonLine className="h-5 w-20" />
            <SkeletonLine className="h-5 w-14" />
          </div>
          <div className="hidden rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
            <SkeletonLine className="h-3 w-24" />
            <SkeletonLine className="mt-2 h-4 w-4/5" />
            <SkeletonLine className="mt-2 h-3 w-2/3" />
          </div>
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-[#e3ddd2] bg-white p-3 shadow-lg shadow-[rgba(49,130,246,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
        <SkeletonLine className="h-3 w-36" />
        <div className="h-[190px] rounded-md bg-white p-3 dark:bg-zinc-900">
          <div className="flex h-full items-end gap-2">
            {[56, 82, 48, 68, 92, 74, 60].map((height, idx) => (
              <div
                key={idx}
                className="flex-1 rounded-t bg-zinc-200/80 dark:bg-zinc-800"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-[#d8e2d7] bg-[var(--brand-accent-soft)] px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/60">
          <SkeletonLine className="h-3 w-32 bg-blue-200/80 dark:bg-blue-900/60" />
          <SkeletonLine className="mt-2 h-7 w-48 bg-blue-200/80 dark:bg-blue-900/60" />
          <SkeletonLine className="mt-2 h-3 w-5/6" />
        </div>
      </div>
    </div>
  );
}

// 2026-05-15 (사용자 코멘트 pid 405627929 — "왜 신뢰 100%? 리뷰도 없는데?"):
// 신뢰도 점수가 어떤 근거로 나왔는지 사용자에게 보여줌. 클릭 시 펼침.
// 모델 정확도(파서 매칭) + 시세 표본 + 시세 신뢰 등급 + 회전 속도 + 위험 키워드.
function ConfidenceBreakdown({ card }: { card: RevealCard }) {
  const market = card.marketBasis;
  const velocity = card.velocityBasis;
  const sample = market?.sampleCount ?? 0;
  const sold = market?.soldSampleCount ?? 0;
  const marketConf = market?.confidence ?? null;
  const marketConfLabel =
    marketConf === "high" ? "높음" : marketConf === "medium" ? "보통" : marketConf === "low" ? "낮음" : "—";

  // Wave 134 (2026-05-16): condition별 시세 표본 분리 표시 — 사업 보고서 L2 retention 강화.
  // 같은 SKU+옵션 매물이라도 condition별 시세 spread 15~40% (Wave 130 측정).
  // 사용자가 "내 매물 condition은 N건 vs 다른 등급 N건" 답 받음 = 신뢰 시그널.
  const matchedConditionLabel = market?.conditionLabel ?? null;
  const otherConditions = market?.otherConditions ?? [];
  const sampleTone: "good" | "warn" | undefined = sample >= 8 ? "good" : sample > 0 ? undefined : "warn";
  // 내 매물 condition 표본 — Wave 130 marketBasis는 매칭된 condition row의 표본 수 (fallback chain 후)
  const matchedSampleText = sample > 0
    ? matchedConditionLabel
      ? `내 등급(${matchedConditionLabel}) ${sample}건 (판매 ${sold})`
      : `${sample}건 (판매 ${sold}건)`
    : "표본 부족";

  // Wave 2026-05-19 v3 (사용자 피드백 — 단어 일반인 친화):
  // "모델 매칭/시세 표본/시세 신뢰/판매 속도" → "모델 인식/비슷한 매물/비교 데이터/팔리는 속도"
  const lines: { label: string; value: string; tone?: "good" | "warn"; hint?: string }[] = [
    {
      label: "모델 인식",
      value: market?.label ? `${market.label}` : "분류 흐림",
      tone: market?.label ? "good" : "warn",
      hint: "AI가 매물 제목/설명에서 모델/옵션/상태를 알아본 결과예요. 분류 흐림이면 시세 비교가 부정확할 수 있어요.",
    },
    {
      label: "비슷한 매물",
      value: matchedSampleText,
      tone: sampleTone,
      hint: "같은 모델·같은 상태 매물이 몇 건 있는지. 8건+ 면 비교 신뢰 충분, 그 미만이면 참고용으로만.",
    },
    {
      label: "비교 데이터",
      value: marketConfLabel === "높음" ? "충분" : marketConfLabel === "보통" ? "보통" : marketConfLabel === "낮음" ? "부족" : marketConfLabel,
      tone: marketConf === "high" ? "good" : marketConf === "low" ? "warn" : undefined,
      hint: "비슷한 매물 수 + 거래 완료 건수 + 분류 정확도를 합쳐서 본 점수.",
    },
  ];

  // 2026-05-19 P0-4: sold7dCount>0 가드 추가. 다른 velocity 표시 지점들(saleSpeedDisplay 등)과
  // 일관성. 7일 표본 0건이면 historical median만으로 "약 N일" 출력 X (통계적 오해 방지).
  if (
    velocity?.medianHoursToSold != null &&
    velocity.medianHoursToSold > 0 &&
    (velocity.sold7dCount ?? 0) > 0
  ) {
    const days = Math.round(velocity.medianHoursToSold / 24);
    lines.push({
      label: "팔리는 속도",
      value: days <= 0 ? "1일 이내" : `약 ${days}일`,
      tone: days <= 3 ? "good" : days >= 14 ? "warn" : undefined,
      hint: "비슷한 매물이 평균 며칠 만에 거래되는지. 내가 사서 다시 팔 때 걸리는 시간 추정.",
    });
  }

  return (
    <div className="mt-2 space-y-1.5 rounded-md bg-white p-2 text-left text-[11px] leading-4 dark:bg-zinc-900">
      <div className="text-[10px] font-bold text-zinc-400">왜 이 점수가 나왔나</div>
      {lines.map((line) => (
        <div
          key={line.label}
          className={`flex items-center justify-between gap-2 ${line.hint ? "cursor-help" : ""}`}
          title={line.hint}
        >
          <span className="text-zinc-500 dark:text-zinc-400">
            {line.label}
            {line.hint ? <span className="ml-0.5 text-[8px] font-bold text-zinc-300 dark:text-zinc-600">ⓘ</span> : null}
          </span>
          <span
            className={`font-bold tabular-nums ${
              line.tone === "good"
                ? "text-blue-700 dark:text-blue-300"
                : line.tone === "warn"
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-zinc-700 dark:text-zinc-200"
            }`}
          >
            {line.value}
          </span>
        </div>
      ))}
      {/* Wave 134 (2026-05-16): condition별 표본 분리 — 사용자에게 "다른 등급은 표본 얼마인지" 가시화.
          marketBasis.otherConditions는 Wave 130에서 이미 채워짐. sample ≥ 3 만 표시 (fetchLatestMarketStats 정책). */}
      {otherConditions.length > 0 && (
        <div className="mt-1 border-t border-zinc-100 pt-1.5 dark:border-zinc-800">
          <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            다른 등급 표본
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {otherConditions.slice(0, 4).map((oc) => (
              <span key={oc.conditionClass} className="text-[10px] text-zinc-500 dark:text-zinc-400">
                <span className="font-bold text-zinc-600 dark:text-zinc-300">{oc.label}</span>{" "}
                <span className="tabular-nums">{oc.sampleCount}건</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="pt-1 text-[10px] leading-[1.4] text-zinc-400">
        비슷한 매물이 많고 같은 모델끼리 정확히 비교됐을 때 점수가 올라가요. 비슷한 매물 부족 / 분류 흐림 / 새상품 섞임이 많으면 점수 내려가요.
      </div>
    </div>
  );
}

function MarketBasisMini({ card }: { card: RevealCard }) {
  // Wave 129 (2026-05-16): source breakdown 표시 — 사업 보고서 L3 (multi-source ground truth).
  //   보고서: "시세 자체보다 시세의 출처를 보여주는 게 retention factor".
  // Wave 130 (2026-05-16): condition별 시세 분리 — 사업 보고서 L2 (끼리 비교 retention).
  //   같은 SKU+옵션이라도 condition별 시세 spread 15~40%. 매물 condition에 맞는 시세 우선 표시.
  //   otherConditions로 비교 가능 ("내 매물(worn) vs mint 시세" 등).
  const market = card.marketBasis;
  const [expanded, setExpanded] = useState(false);
  if (!market) return null;
  const confidence = market.confidence ?? "low";
  const confidenceLabel = confidence === "high" ? "높음" : confidence === "medium" ? "보통" : "낮음";
  const confidenceClass = confidence === "high"
    ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
    : confidence === "medium"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
  const hasCondition = market.conditionClass && market.conditionClass !== "all";
  const marketSourceLabel = market.basisSourceLabel ?? "통합 중고";
  const sourceLabel = market.priceSource === "reference"
    ? `새상품 기준가 + ${marketSourceLabel} 흐름`
    : `${market.conditionLabel ?? "같은 상태"} ${marketSourceLabel} 매물 기준`;
  const compactSourceLabel = market.priceSource === "reference"
    ? "새상품 기준"
    : `${marketSourceLabel} ${market.conditionLabel ?? "같은 상태"}`;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
        <span className="font-black text-zinc-700 dark:text-zinc-200">시세 근거</span>
        {hasCondition && market.conditionLabel ? (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {market.conditionLabel}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-1.5 py-0.5 dark:bg-zinc-800">
          {market.priceSource === "reference" ? (
            <DanawaLogo className="h-3.5 w-3.5 rounded-[3px]" />
          ) : (
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-zinc-900 text-[8px] font-black text-white dark:bg-zinc-100 dark:text-zinc-900">
              {market.basisSourceLabel ? market.basisSourceLabel.slice(0, 1) : "통"}
            </span>
          )}
          {compactSourceLabel}
        </span>
        <span
          className="rounded-full bg-zinc-50 px-1.5 py-0.5 tabular-nums dark:bg-zinc-800"
          title={`판매중 ${market.activeSampleCount.toLocaleString("ko-KR")}건 + 거래완료 ${market.soldSampleCount.toLocaleString("ko-KR")}건`}
        >
          비슷한 매물 {market.sampleCount.toLocaleString("ko-KR")}건
        </span>
        {/* Wave 2026-05-19 v3 (사용자 피드백 — 단어 일반인 친화): "신뢰" 칩 → "비교 데이터" */}
        <span
          className={`cursor-help rounded-full px-1.5 py-0.5 ${confidenceClass}`}
          title="비슷한 매물 데이터가 얼마나 충분한지 — 충분 = 비교 매물 8건+. 보통 = 비교 매물 적당. 부족 = 비교 매물 적거나 분류 흐림."
        >
          비교 데이터 {confidenceLabel === "높음" ? "충분" : confidenceLabel === "보통" ? "보통" : "부족"}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="ml-auto rounded-full border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-black text-zinc-500 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {expanded ? "접기" : "자세히"}
        </button>
      </div>
      {expanded ? (
        <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px]">
            <span className="font-black text-zinc-800 dark:text-zinc-100">
              {market.label ?? card.skuName}
            </span>
            {market.fallbackUsed && (
              <span className="text-[9px] font-bold uppercase text-zinc-400 dark:text-zinc-500">
                (가까운 상태 기준)
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1 font-bold text-zinc-600 dark:text-zinc-300">
              {market.priceSource === "reference" ? (
                <DanawaLogo className="h-4 w-4 rounded-[4px]" />
              ) : (
                <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-zinc-900 text-[8px] font-black text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {market.basisSourceLabel ? market.basisSourceLabel.slice(0, 1) : "통"}
                </span>
              )}
              {sourceLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-bold tabular-nums dark:bg-zinc-800">
              거래완료 {market.soldSampleCount.toLocaleString("ko-KR")}건
            </span>
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-bold tabular-nums dark:bg-zinc-800">
              판매중 {market.activeSampleCount.toLocaleString("ko-KR")}건
            </span>
            {market.disappearedSampleCount > 0 && (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-bold tabular-nums dark:bg-zinc-800">
                만료 {market.disappearedSampleCount.toLocaleString("ko-KR")}건
              </span>
            )}
          </div>
          {/* Wave 130: 다른 condition 시세 비교 — "내 매물(worn) 시세 vs 다른 등급" — 사업 보고서 L2 끼리 비교. */}
          {market.otherConditions && market.otherConditions.length > 0 && (
            <>
              <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                동일 모델 다른 등급 시세
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
                {market.otherConditions.slice(0, 4).map((oc) => (
                  <span
                    key={oc.conditionClass}
                    className="rounded-md bg-zinc-50 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400"
                  >
                    <span className="font-bold">{oc.label}</span>
                    <span className="ml-1 tabular-nums">{oc.medianPrice ? krw(oc.medianPrice) : "-"}</span>
                    <span className="ml-1 text-zinc-400 dark:text-zinc-500">({oc.sampleCount}건)</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

// 2026-05-17: 공통 utility (src/lib/listing-verdicts.ts) 호출로 변경.
// chip 라벨 결정 로직 단일 source — 3 화면 통일 (drift 차단).
// 새 chip 4종 추가: 시세보다 -N%, 수요 매우높음/높음/보통, 방금 등록, 시세 sample N건.
// max 4 → 6 으로 확장.
import { buildVerdicts, type Verdict, VERDICT_TONE_CLASS } from "@/lib/listing-verdicts";

function verdictsForCard(card: RevealCard): Verdict[] {
  const detail = card.savedDetail;
  const velocity = card.velocityBasis;
  const flow = card.skuListingFlow;
  const market = card.marketBasis;
  return buildVerdicts({
    price: card.price,
    skuMedian: market?.medianPrice ?? null,
    expectedProfitMin: card.expectedProfitMin,
    expectedProfitMax: card.expectedProfitMax,
    confidence: card.confidence,
    marketSampleCount: market?.sampleCount ?? null,
    marketConfidenceLabel: (market?.confidence as "high" | "medium" | "low" | null) ?? null,
    medianHoursToSold: velocity?.medianHoursToSold ?? null,
    soldSampleCount: market?.soldSampleCount ?? null,
    flowCount24h: flow?.count24h ?? null,
    flowAvgPerDay7d: flow?.avgPerDay7d ?? null,
    sellerReviewRating: detail?.sellerReviewRating ?? null,
    sellerReviewCount: detail?.sellerReviewCount ?? null,
    marketplaceSource: card.marketplaceSource ?? null,
    joongnaTrustScore: detail?.joongnaTrustScore ?? null,
    joongnaSafeOrderSalesCount: detail?.joongnaSafeOrderSalesCount ?? null,
    tradeLabels: detail?.tradeLabels ?? [],
    shippingAssumption: detail?.shippingAssumption ?? null,
    transactionMode: detail?.transactionMode ?? null,
    freeShipping: detail?.freeShipping ?? null,
    favoriteCount: detail?.favoriteCount ?? null,
    lastSeenAt: null, // RevealCard 에 직접 안 박힘 (별도 fetch 필요 — 보류)
    descriptionPreview: detail?.descriptionPreview ?? null,
  });
}

function VerdictBadgesMini({ card }: { card: RevealCard }) {
  const verdicts = verdictsForCard(card);
  if (verdicts.length === 0) return null;
  const hiddenMobileCount = Math.max(0, verdicts.length - 3);
  return (
    <div className="flex flex-wrap gap-1">
      {verdicts.map((v, index) => (
        <span
          key={v.label}
          className={`${index >= 3 ? "hidden sm:inline-flex" : "inline-flex"} rounded-full border px-2 py-0.5 text-[10px] font-black ${VERDICT_TONE_CLASS[v.tone]}`}
        >
          {v.label}
        </span>
      ))}
      {hiddenMobileCount > 0 ? (
        <span
          className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-black text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 sm:hidden"
          title={`화면에 숨긴 추가 신호 ${hiddenMobileCount}개가 더 있어요`}
        >
          추가 신호 {hiddenMobileCount}개
        </span>
      ) : null}
    </div>
  );
}

function RevealRiskScoreMini({
  card,
  containerClassName,
  triggerClassName,
  triggerLabel,
  triggerContent,
  hideChevron,
  portalDetail,
}: {
  card: RevealCard;
  containerClassName?: string;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerContent?: ReactNode;
  hideChevron?: boolean;
  portalDetail?: boolean;
}) {
  const riskInput = revealRiskScoreInput(card);
  return (
    <RiskScoreBar
      {...riskInput}
      showDetail
      compact
      containerClassName={containerClassName}
      triggerClassName={triggerClassName}
      triggerLabel={triggerLabel}
      triggerContent={triggerContent}
      hideChevron={hideChevron}
      portalDetail={portalDetail}
    />
  );
}

function revealRiskScoreInput(card: RevealCard): RiskScoreInput {
  return {
    descriptionPreview: card.savedDetail?.descriptionPreview ?? null,
    conditionClass: card.marketBasis?.conditionClass ?? null,
    categorySlug: categoryForBeginnerGuide(card),
    price: card.price,
    skuMedian: card.marketBasis?.medianPrice ?? null,
    confidence: card.confidence,
    sellerReviewRating: card.savedDetail?.sellerReviewRating ?? null,
    sellerReviewCount: card.savedDetail?.sellerReviewCount ?? null,
    marketplaceSource: card.marketplaceSource ?? null,
    joongnaTrustScore: card.savedDetail?.joongnaTrustScore ?? null,
    daangnMannerTemperature: card.savedDetail?.daangnMannerTemperature ?? null,
    photoCount: card.savedDetail?.imageCount ?? null,
  };
}

// Wave 333: fixedSafetyCtaClass 제거 — FixedBunjangFooter에서 안전도 버튼 빠지면서 미사용.

// Wave 359+361: 득템 점수 — 당근 Manner Meter 영감 (작고 우측).
// 2026-05-21: 점수는 지표로만 사용한다. 확장 요약은 아래 상세 섹션과 중복되어 제거.
function DealMeterButton({ card }: { card: RevealCard }) {
  const { score, toneClass } = calculateDealScore(card);
  return (
    <div className="flex shrink-0 flex-col items-end whitespace-nowrap leading-tight" aria-label={`득템 점수 ${score}점`}>
      <span className="mb-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#1c64dd] dark:text-blue-300">
        득템 점수
      </span>
      <span className="flex items-baseline gap-0.5">
        <span className={`text-[28px] font-black tabular-nums tracking-[-0.03em] ${toneClass}`}>
          {score}
        </span>
        <span className="text-[13px] font-bold text-zinc-400 dark:text-zinc-500">/100</span>
      </span>
      <span className="mt-1 h-[3px] w-[70px] rounded-full bg-gradient-to-r from-blue-500 to-blue-700" />
    </div>
  );
}

function PurchaseDecisionHeader({ card }: { card: RevealCard }) {
  const sampleCount = card.marketBasis?.sampleCount ?? 0;
  const confidencePct = Math.round((card.confidence ?? 0) * 100);
  const profitAvg = expectedProfitAverage(card);
  const discountPct = marketDiscountPercent(card);
  const conditionLabel = marketConditionLabel(card);
  const isMarketInvalidated = Math.min(card.expectedProfitMin, card.expectedProfitMax) <= 0;
  const category = categoryFromComparableKey(card.marketBasis?.comparableKey ?? null);
  const brandDepth = detectBrandDepth(category, {
    skuId: card.skuId ?? null,
    skuName: card.skuName ?? null,
    name: card.name ?? null,
  });
  const hasHighCounterfeitRisk = brandDepth?.brand.counterfeitRisk === "high";

  const sampleText = sampleCount > 0 ? `${sampleCount.toLocaleString("ko-KR")}건` : "부족";
  const discountText = discountPct != null && discountPct > 0
    ? `시세보다 ${discountPct}% 낮게`
    : null;
  const profitText = displayProfitRange(card);

  const tone = isMarketInvalidated
    ? {
        eyebrow: "text-rose-700 dark:text-rose-300",
        badge: "보류",
        badgeClass: "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/60",
        borderClass: "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/25",
        headline: "지금은 보류할 매물",
        body: holdReasonText(card),
      }
    : hasHighCounterfeitRisk
      ? {
          eyebrow: "text-amber-700 dark:text-amber-300",
          badge: "조건부",
          badgeClass: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60",
          borderClass: "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/25",
          headline: "정품 확인 후 매입 후보",
          body: `${conditionLabel} 비교 ${sampleText} 기준 차익은 보이지만, 정품 체크가 먼저예요.`,
        }
      : sampleCount < 3 || confidencePct < 65
        ? {
            eyebrow: "text-amber-700 dark:text-amber-300",
            badge: "확인",
            badgeClass: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60",
            borderClass: "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/25",
            headline: "근거 확인 후 판단",
            body: `${conditionLabel} 비교 표본이 ${sampleText}이라 시세 근거를 먼저 보고 결정하는 게 좋아요.`,
          }
        : profitAvg > 0
          ? {
              eyebrow: "text-blue-700 dark:text-blue-300",
              badge: "후보",
              badgeClass: "bg-blue-100 text-blue-800 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/60",
              borderClass: "border-blue-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
              headline: "근거 있는 매입 후보",
              body: discountText
                ? `${conditionLabel} 비교 ${sampleText} 기준 ${discountText} 잡힌 매물이에요.`
                : `${conditionLabel} 비교 ${sampleText} 기준 예상 순익 ${profitText} 구간이에요.`,
            }
          : {
              eyebrow: "text-zinc-500 dark:text-zinc-400",
              badge: "대기",
              badgeClass: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700",
              borderClass: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
              headline: "추가 확인이 필요한 매물",
              body: "가격 차이가 크지 않아 비교 매물과 리스크를 같이 확인해야 해요.",
            };

  return (
    <section
      aria-label="구매 판단 요약"
      className={`mt-3 rounded-xl border px-3 py-2.5 shadow-sm ${tone.borderClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className={`shrink-0 text-[10px] font-black uppercase tracking-[0.14em] ${tone.eyebrow}`}>
              구매 판단
            </div>
            <div className="min-w-0 truncate text-[14px] font-black leading-tight tracking-tight text-[#172019] dark:text-zinc-50">
              {tone.headline}
            </div>
          </div>
          <p className="mt-1 line-clamp-2 text-[11.5px] font-semibold leading-4 text-[#5f6b5e] dark:text-zinc-300">
            {tone.body}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${tone.badgeClass}`}>
          {tone.badge}
        </span>
      </div>
    </section>
  );
}

function RevealProductImage({ card }: { card: RevealCard }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  // Wave 886 (2026-05-27): 카드 뷰엔 SKU 일반 이미지 우선 (anti-leak),
  // 크게보기 모달은 사용자가 액션해서 연 거니까 원본도 같이 허용 — 일단 displayUrl 일관 사용.
  const displayUrl = card.genericImageUrl ?? card.thumbnailUrl;
  const largePreview = previewOpen && displayUrl ? (
    <>
      <div
        className="fixed inset-0 z-[220] bg-zinc-950/86 backdrop-blur-sm"
        onClick={(e) => {
          e.stopPropagation();
          setPreviewOpen(false);
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="상품 사진 크게 보기"
        className="fixed inset-0 z-[230] flex items-center justify-center p-3"
        onClick={(e) => {
          e.stopPropagation();
          setPreviewOpen(false);
        }}
      >
        <div className="relative h-full max-h-[88dvh] w-full max-w-3xl">
          <Image
            src={displayUrl ?? ""}
            alt={card.name}
            fill
            sizes="100vw"
            unoptimized
            className="object-contain object-center"
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPreviewOpen(false);
          }}
          className="fixed right-4 top-4 rounded-full bg-white px-4 py-2 text-sm font-black text-zinc-900 shadow-lg transition hover:bg-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
        >
          닫기
        </button>
      </div>
    </>
  ) : null;

  return (
    // Wave launch-116 (2026-05-24): 사진 원본 비율 유지 (사용자 정정).
    //   기존: object-cover h-[42dvh] → 사진 위/아래 잘림.
    //   변경: object-contain + min/max-h + 배경색 letterbox. e-comm detail 표준 (무신사/SSF/쿠팡).
    //   <Image fill> 부모 dimension 필요 + 외부 thumbnail dimension 모름 → native <img> 사용.
    //   loading="eager" + decoding="async" 로 첫 paint 보장.
    //   쉬운 모드에서 이미 가치 인지된 상태라 사진 크기 small/big 영향 작음 — 세련된 느낌 우선.
    <div className="relative flex w-full items-center justify-center overflow-hidden bg-[#eee7da] dark:bg-zinc-900"
         style={{ minHeight: 280, maxHeight: "60dvh" }}>
      {/* Wave 393.3: ConditionPhotoBadge 모달에선 nav (좌상 ← 🏠 floating)에 가려서 제거.
          텍스트 영역 LastVerifiedAtBadge 옆에 ConditionChip으로 대체 노출. */}
      {displayUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl}
            alt={card.name}
            className="h-auto w-auto max-h-[60dvh] max-w-full object-contain"
            loading="eager"
            decoding="async"
          />
          {card.genericImageUrl ? <SkuImageLockBadge /> : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/12 to-transparent" />
          {/* Wave 751 (2026-05-25): 사진 위 우하단 카테고리 워터마크 배지. */}
          <CategoryWatermark
            comparableKey={card.marketBasis?.comparableKey ?? null}
            size={44}
            variant="corner"
          />
          {/* Wave 394.7.w (사용자 짚음 + handoff): 좌하 condition pill — nav(top-left)랑 안 겹침.
              Wave 714d (2026-05-23): 신발/의류는 옛 conditionClass pill 숨김 (전자기기용 라벨 정확도 낮음). */}
          {card.marketBasis?.conditionClass
            && !card.marketBasis.comparableKey?.startsWith("shoe|")
            && !card.marketBasis.comparableKey?.startsWith("clothing|") ? (
            <div className="absolute bottom-8 left-3 z-10">
              <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-black text-[#4b5650] shadow-[0_2px_8px_rgba(0,0,0,0.18)] backdrop-blur">
                <span className="mr-1 text-blue-600">●</span>
                {conditionFriendlyText(card.marketBasis.conditionClass)}
              </span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen(true);
            }}
            className="absolute bottom-8 right-3 z-10 rounded-full bg-zinc-950/75 px-3.5 py-2 text-xs font-black text-white shadow-lg backdrop-blur transition hover:bg-zinc-950/86"
          >
            크게 보기
          </button>
          {typeof document !== "undefined" ? createPortal(largePreview, document.body) : largePreview}
        </>
      ) : (
        // Wave 749 (2026-05-25): 카테고리 워터마크 placeholder.
        <div className="relative flex h-full w-full items-center justify-center">
          <CategoryWatermark
            comparableKey={card.marketBasis?.comparableKey ?? null}
            size={120}
          />
          <span className="pointer-events-none absolute bottom-4 text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
            사진 준비 중
          </span>
        </div>
      )}
    </div>
  );
}

function SkuListingFlowMini({ card }: { card: RevealCard }) {
  const flow = card.skuListingFlow;
  if (!flow) return null;
  // 24h count 대비 7d 평균 색상 강조 (오늘 많이 올라옴 = emerald, 평소 같음 = neutral, 적음 = amber)
  const ratio = flow.avgPerDay7d > 0 ? flow.count24h / flow.avgPerDay7d : 1;
  const trendTone =
    ratio >= 1.3
      ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
      : ratio <= 0.6
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
        : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-200";
  const trendLabel = ratio >= 1.3 ? "오늘 많음" : ratio <= 0.6 ? "오늘 적음" : "평소 수준";
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-1.5 text-[11px] leading-4 ${trendTone}`}>
      <span className="font-black">매물 유입량</span>
      <span className="tabular-nums">24h <b>{flow.count24h}</b>건</span>
      <span>·</span>
      <span className="tabular-nums">7일 평균 {flow.avgPerDay7d}건/일</span>
      <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-bold dark:bg-zinc-900/50">
        {trendLabel}
      </span>
    </div>
  );
}

function saleSpeedDisplay(card: RevealCard, options: { analysisLoading?: boolean } = {}) {
  const velocity = card.velocityBasis;
  const hasRealTurnEstimate =
    velocity?.medianHoursToSold != null &&
    Number.isFinite(velocity.medianHoursToSold) &&
    velocity.medianHoursToSold > 0 &&
    velocity.sold7dCount > 0;
  const observedVelocitySample = Math.max(
    Number(velocity?.observedSoldSampleCount ?? 0),
    Number(velocity?.sold7dCount ?? 0),
  );
  const analysisLoading = Boolean(options.analysisLoading) && !hasRealTurnEstimate;
  // 2026-05-19 P0: 운영 게이트 OFF에선 hours=null → "수집 중" 표시. 개발 게이트 ON에선 48h 폴백 유지.
  const hours = hasRealTurnEstimate
    ? velocity.medianHoursToSold
    : (VELOCITY_UI_TEST_ENABLED ? UI_TEST_FALLBACK_VELOCITY_HOURS : null);
  return {
    hours,
    // Wave 394.7.ab: "수집 중" → "표본 부족" — 데이터가 진짜 모이는 중인지 부족한 건지 정직 표시.
    // 사용자 짚음 — "에어팟맥스면 기록이 없을수가 없는데 수집 중만 뜸". "수집 중"은 진행감 주는데
    // 실제로는 confidence low 라서 가드에 막힌 케이스가 대부분. 정직 표시.
    label: analysisLoading
      ? "확인 중"
      : hours == null
        ? observedVelocitySample > 0 ? `${observedVelocitySample.toLocaleString("ko-KR")}건 기록` : "표본 부족"
        : velocityHoursLabel(hours),
    isFallback: !hasRealTurnEstimate && !analysisLoading,
    analysisLoading,
    isFast: hours != null && hours > 0 && hours <= 48,
    isSlow: hours != null && hours > 168,
    // Wave launch-26: "데이터 수집 중" → "표본 부족" 정직.
    confidenceLabel: analysisLoading
      ? "분석 중"
      : !hasRealTurnEstimate
      ? (VELOCITY_UI_TEST_ENABLED ? "UI 테스트" : observedVelocitySample > 0 ? "판매 기록 있음" : "표본 부족")
      : velocity?.confidence === "high"
        ? "신뢰 높음"
        : velocity?.confidence === "medium"
          ? "신뢰 보통"
          : "참고용",
    sold7dCount: velocity?.sold7dCount ?? 0,
  };
}

type UpperFoldTileTone = "good" | "info" | "warn" | RiskTone;

function marketEvidenceSummary(card: RevealCard) {
  const market = card.marketBasis;
  if (!market) return "시세 기준 확인중";
  const sample = market.sampleCount ?? 0;
  const source = market.priceSource === "reference" ? "새상품 기준" : "통합 표본";
  const condition = marketConditionLabel(card);
  if (sample > 0) return `${condition} · ${source} ${sample.toLocaleString("ko-KR")}건`;
  return `${condition} · ${source} 기준`;
}

// Wave 324 (사용자 피드백 + 외부 감사/외부인 #5): 일반인에게 raw 매물 건수는 의미 없음.
// 핵심은 "수요·공급 균형이 어떤가" — 공급(매물 등록)만 보지 말고 수요(거래완료) 같이 본 평가가 헤드라인.
// raw 숫자는 sub로 강등.
function marketActivityDisplay(card: RevealCard) {
  const flow = card.skuListingFlow;
  const market = card.marketBasis;
  const velocity = card.velocityBasis;
  const supply24h = flow?.count24h ?? 0;
  const supplyAvg = flow?.avgPerDay7d ?? 0;
  const soldRecent = velocity?.sold7dCount ?? market?.soldSampleCount ?? 0;
  const active = market?.activeSampleCount ?? 0;

  // 공급 평가
  const supplyRatio = supplyAvg > 0 ? supply24h / supplyAvg : null;
  const supplyLevel: "high" | "normal" | "low" | null = supplyRatio == null
    ? null
    : supplyRatio >= 1.25 ? "high" : supplyRatio <= 0.55 ? "low" : "normal";

  // 수요 평가 — 거래 데이터 있으면 활발도. 판매중 대비 거래완료 비율로.
  // soldRecent = 7일 판매 수, active = 현재 매물 수. ratio 높으면 수요 활발.
  // 2026-05-20 P0-Demand-B: sample-floor 게이트. N=1,2 표본으로 "수요 활발/약함" 단정 위험.
  //   active+sold 합 < 5 면 demand 단정 X (null로 떨어뜨려서 sub에 표본 표시).
  //   velocity P0-1 정직성 원칙 (낮은 신뢰도 데이터는 "수집 중" 표기) 동일 적용.
  const demandSampleSize = active + soldRecent;
  const demandSampleSufficient = demandSampleSize >= 5;
  const demandRatio = active > 0 && soldRecent > 0 && demandSampleSufficient
    ? soldRecent / active
    : null;
  const demandLevel: "active" | "ok" | "weak" | null = demandRatio == null
    ? null
    : demandRatio >= 0.5 ? "active" : demandRatio >= 0.2 ? "ok" : "weak";

  // 복합 평가 — 수요가 우선, 공급은 secondary
  let value: string;
  let tone: "good" | "info" | "warn";

  if (demandLevel == null && supplyLevel == null) {
    value = "데이터 부족";
    tone = "warn";
  } else if (demandLevel === "active") {
    value = supplyLevel === "low" ? "수요 활발 · 공급 부족" : "수요 활발";
    tone = "good";
  } else if (demandLevel === "weak") {
    value = "수요 약함";
    tone = "warn";
  } else if (demandLevel === "ok") {
    value = supplyLevel === "high" ? "수요 보통 · 공급 많음" : "수요 보통";
    tone = "info";
  } else if (supplyLevel === "high") {
    value = "공급 많음 · 거래 데이터 부족";
    tone = "info";
  } else if (supplyLevel === "low") {
    value = "매물 적음";
    tone = "info";
  } else {
    value = "평소 수준";
    tone = "info";
  }

  // sub — raw 숫자 디테일
  const subParts: string[] = [];
  if (supply24h > 0) subParts.push(`오늘 매물 ${supply24h}건`);
  if (supplyAvg > 0) subParts.push(`평균 ${supplyAvg}건/일`);
  if (soldRecent > 0) subParts.push(`최근 거래 ${soldRecent}건`);
  // 2026-05-20 P0-Demand-B: 표본 부족(<5)이면 명시. 사용자가 "왜 데이터 부족인지" 즉시 인지.
  if (demandSampleSize > 0 && !demandSampleSufficient) {
    subParts.push(`표본 ${demandSampleSize}건 — 누적 중`);
  }
  const sub = subParts.length > 0 ? subParts.join(" · ") : marketEvidenceSummary(card);

  return {
    label: "수요 · 공급",
    value,
    sub,
    tone,
  };
}

// Wave 2026-05-19 v3 (사용자 피드백): "현재성" 타일 자체 제거 — 매입/시세 줄에 검증 시점 이미 있음.
// verificationDisplay 함수도 제거됨.

function safetyDisplay(card: RevealCard, risk: ReturnType<typeof buildRiskScore>) {
  const safety = marketplaceSafetyForCard(card);
  const rating = card.savedDetail?.sellerReviewRating ?? null;
  const reviewCount = card.savedDetail?.sellerReviewCount ?? 0;
  const reviewCountLabel = reviewCount.toLocaleString("ko-KR");
  if (safety.isJoongna) {
    const hasSupportedSellerSignal = reviewCount >= 3 && (
      safety.sellerTrust.trustScore == null || safety.sellerTrust.trustScore >= 500
    );
    const badge = safety.sellerTrust.badgeLabel
      ? { label: safety.sellerTrust.badgeLabel, className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200" }
      : reviewCount > 0
        ? { label: `거래후기 ${reviewCountLabel}`, className: "border-[#d6e2d3] bg-white/75 text-[#4d6654] dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300" }
        : null;
    return {
      value: safety.sellerTrust.tileValue,
      sub: safety.sellerTrust.tileSub || "중고나라 판매자 정보 확인",
      Icon: ShieldIcon,
      badge,
      tone: hasSupportedSellerSignal ? "safe" as const : risk.tone,
    };
  }
  const reviewBadge =
    reviewCount >= 100
      ? { label: `후기 ${reviewCountLabel}+`, className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200" }
      : reviewCount >= 30
        ? { label: `후기 ${reviewCountLabel}`, className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200" }
        : reviewCount >= 10
          ? { label: `후기 ${reviewCountLabel}`, className: "border-[#d6e2d3] bg-white/75 text-[#4d6654] dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300" }
          : reviewCount > 0
            ? { label: "후기 적음", className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200" }
            : null;
  // Wave 393.6: "후기 수 확인" 같은 라벨 X — 실제 후기 건수 적기.
  if (rating != null && rating >= 4.8 && reviewCount >= 10) {
    return {
      value: `평점 ${rating.toFixed(1)} 셀러`,
      sub: `후기 ${reviewCountLabel}건${reviewCount >= 30 ? " (충분)" : ""}`,
      Icon: TrophyIcon,
      badge: reviewBadge,
      tone: "good" as const,
    };
  }
  return {
    value: risk.label,
    sub: reviewCount > 0 && rating != null
      ? `평점 ${rating.toFixed(1)} · 후기 ${reviewCountLabel}건`
      : risk.tone === "safe" ? "차단 필터 통과" : "확인 포인트 있음",
    Icon: ShieldIcon,
    badge: reviewBadge,
    tone: risk.tone,
  };
}

function upperFoldTileClass(tone: UpperFoldTileTone) {
  if (tone === "safe" || tone === "good") {
    return {
      card: "border-blue-200/80 bg-white/80 dark:border-blue-900/45 dark:bg-zinc-900/55",
      dot: "bg-blue-500",
      value: "text-blue-700 dark:text-blue-300",
    };
  }
  if (tone === "caution" || tone === "info" || tone === "warn") {
    return {
      card: "border-amber-200/80 bg-white/80 dark:border-amber-900/45 dark:bg-zinc-900/55",
      dot: "bg-amber-400",
      value: "text-amber-700 dark:text-amber-300",
    };
  }
  return {
    card: "border-rose-200/80 bg-white/80 dark:border-rose-900/45 dark:bg-zinc-900/55",
    dot: "bg-rose-500",
    value: "text-rose-700 dark:text-rose-300",
  };
}

// Wave 334: 타일 평가별 아이콘 매핑 — JSX element 직접 반환 (react-hooks 호환).
function renderActivityIcon(value: string, className: string) {
  if (value.includes("활발")) return <FlameIcon className={className} />;
  if (value.includes("약함")) return <TrendingDownIcon className={className} />;
  if (value.includes("매물 적음")) return <PackageIcon className={className} />;
  if (value.includes("공급 많음")) return <TrendingUpIcon className={className} />;
  return <ActivityIcon className={className} />;
}

function renderSpeedIcon(speed: ReturnType<typeof saleSpeedDisplay>, className: string) {
  if (speed.isFast) return <ZapIcon className={className} />;
  if (speed.isSlow) return <HourglassIcon className={className} />;
  return <ClockIcon className={className} />;
}

function renderSafetyIcon(tone: "good" | RiskTone, value: string, className: string) {
  if (value.includes("우수") || (tone === "good" && value.includes("⭐"))) return <TrophyIcon className={className} />;
  if (tone === "safe" || tone === "good") return <ShieldIcon className={className} />;
  return <AlertTriangleIcon className={className} />;
}

// Wave 394.4 (외부 review #3 + 사용자 본인 강조): "어떤 매물 비교했나" — 시세 근거 매물 직접 노출.
// "/me 운영자풀처럼 시세근거 sample 직접 볼수있으면 진짜 좋을듯" — 사용자 인용.
// USP 정면 = band-aware (같은 모델 / 같은 상태 매물끼리 비교). 시세 그래프 옆에 sample 매물 보여줘
// "이 시세는 어떻게 산출됐나" 투명성 + 신뢰도 boost.
//
// Wave 394.4.b 수정 (사용자 짚음 — 첫 fetch endpoint 실패):
// 신규 /api/market/comparable-listings 만들었는데 mvp_listings 에 comparable_key 컬럼 없어 fetch 실패.
// 사용자 reference: "/me운영자풀에 시세 근거보기 눌렀을때 나오는 sample끼리 비교 매물 그거 참고"
// → 이미 /api/listings/[pid]/market-source 가 정확히 그 endpoint. 재사용.
// market-source 의 풍부한 데이터 (saleStatus + listingState + 위험 매물 제외 + condition 정확 매칭) 활용.
type ComparableListing = {
  pid: number;
  name: string;
  price: number;
  thumbnailUrl: string | null;
  saleStatus: string | null;
  listingState: string | null;
  lastSeenAt: string | null;
  sourceQuery: string | null;
  marketplaceSource?: string | null;
  marketplaceLabel?: string | null;
  listingUrl?: string | null;
  bunjangUrl: string;
  // Wave launch-78: 신발/의류는 비교 매물 각자 tier 표시 (옛 conditionClass 일괄 "A급" 표시 차단).
  // API(/api/listings/[pid]/market-source) 가 이미 부여하고 있음.
  conditionTier?: string | null;
  conditionClass?: string | null;
  conditionChips?: string[] | null;
};

async function fetchMarketSourceComparables(pid: number): Promise<{ comparables?: ComparableListing[] }> {
  const supabase = getSupabaseBrowserClient();
  const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const token = sessionData.session?.access_token;
  const res = await fetch(`/api/listings/${pid}/market-source`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { comparables?: ComparableListing[] };
}

function isSameSourceComparableForCard(card: RevealCard, item: ComparableListing) {
  const cardSource = String(card.marketplaceSource ?? "").toLowerCase();
  if (cardSource !== "daangn") return true;
  return String(item.marketplaceSource ?? "").toLowerCase() === cardSource;
}

function finitePositivePrice(value: number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizedComparableStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function isComparableSold(item: Pick<ComparableListing, "listingState" | "saleStatus">) {
  const state = normalizedComparableStatus(item.listingState);
  const status = normalizedComparableStatus(item.saleStatus);
  return (
    state === "sold" ||
    state === "sold_confirmed" ||
    status === "sold" ||
    status === "sold_out" ||
    status === "closed" ||
    status === "joongna_sold_page" ||
    status.startsWith("joongna_status_")
  );
}

function isComparableReserved(item: Pick<ComparableListing, "listingState" | "saleStatus">) {
  const state = normalizedComparableStatus(item.listingState);
  const status = normalizedComparableStatus(item.saleStatus);
  return state === "reserved" || status === "reserved" || status === "예약중";
}

function comparableDisplayBounds(card: RevealCard): { lower: number; upper: number } | null {
  const median = finitePositivePrice(card.marketBasis?.medianPrice);
  if (!median) return null;

  const p25 = finitePositivePrice(card.marketBasis?.p25Price);
  const p75 = finitePositivePrice(card.marketBasis?.p75Price);
  const hardLower = median * 0.35;
  const hardUpper = median * 2.2;

  if (p25 && p75 && p75 > p25) {
    const iqr = p75 - p25;
    const iqrLower = p25 - iqr * 2;
    const iqrUpper = p75 + iqr * 2;
    return {
      lower: Math.max(hardLower, Math.min(median * 0.85, iqrLower)),
      upper: Math.min(hardUpper, Math.max(median * 1.45, iqrUpper)),
    };
  }

  return { lower: hardLower, upper: hardUpper };
}

function filterDisplayComparableListings(card: RevealCard, items: ComparableListing[]) {
  const bounds = comparableDisplayBounds(card);
  if (!bounds) return items.filter((item) => finitePositivePrice(item.price) != null);
  return items.filter((item) => {
    const price = finitePositivePrice(item.price);
    return price != null && price >= bounds.lower && price <= bounds.upper;
  });
}

type ComparableDisplayScope = "strict" | "price_relaxed" | "source_relaxed";

function sortComparableDisplayListings(items: ComparableListing[]) {
  return [...items].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
}

function selectComparableDisplayListings(
  card: RevealCard,
  items: ComparableListing[],
  limit: number,
): { listings: ComparableListing[]; scope: ComparableDisplayScope } {
  const visible = items.filter((item) => item.listingState !== "disappeared");
  const sameSource = visible.filter((item) => isSameSourceComparableForCard(card, item));
  const strict = filterDisplayComparableListings(card, sameSource);
  if (strict.length > 0) {
    return { listings: sortComparableDisplayListings(strict).slice(0, limit), scope: "strict" };
  }

  const priceRelaxed = sameSource.filter((item) => finitePositivePrice(item.price) != null);
  if (priceRelaxed.length > 0) {
    return { listings: sortComparableDisplayListings(priceRelaxed).slice(0, limit), scope: "price_relaxed" };
  }

  const sourceRelaxed = filterDisplayComparableListings(card, visible);
  return {
    listings: sortComparableDisplayListings(
      sourceRelaxed.length > 0
        ? sourceRelaxed
        : visible.filter((item) => finitePositivePrice(item.price) != null),
    ).slice(0, limit),
    scope: "source_relaxed",
  };
}

function comparableScopeCopy(scope: ComparableDisplayScope, baseLabel: string | null) {
  if (scope === "strict") return baseLabel ? `${baseLabel}끼리` : "같은 조건";
  if (scope === "price_relaxed") return baseLabel ? `${baseLabel} 기준 · 범위 완화` : "동일 모델 기준";
  return "동일 모델 전체 기준";
}

function ComparableListingsPanel({ card, mode = "simple" }: { card: RevealCard; mode?: "simple" | "detailed" }) {
  const [listings, setListings] = useState<ComparableListing[] | null>(null);
  const [listingScope, setListingScope] = useState<ComparableDisplayScope>("strict");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Wave 394.7.i (사용자 짚음): 비교 매물 4개 이상이면 처음 3개만 보이고 "자세히 보기" 펼침.
  const [expanded, setExpanded] = useState(false);

  const ck = card.marketBasis?.comparableKey ?? null;
  const cc = card.marketBasis?.conditionClass ?? null;
  // Wave 394.5.b: detailed 모드 시 더 많이 (6 → 12).
  const limit = mode === "detailed" ? 12 : 6;
  const INITIAL_VISIBLE = 3;

  useEffect(() => {
    if (!ck) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Wave 394.4.b: /api/listings/[pid]/market-source 호출 — admin 풀에서 사용하는 동일한 endpoint.
    // condition_class + comparable_key 정확 매칭, COMPARABLE_EXCLUDE_NOTES 적용 (위험 매물 제외).
    fetchMarketSourceComparables(card.pid)
      .then((j: { comparables?: ComparableListing[] }) => {
        if (!cancelled) {
          // disappeared 매물 제외, 가격 높은 순 정렬.
          // Wave 1027 (2026-06-03): market-source 1차 제외에 더해 UI 표시용 outlier guard.
          // 시세 계산은 기존 backend 기준 유지, 사용자에게 보이는 "증거 리스트"에서 극단 고/저가 샘플만 숨긴다.
          // simple = 6, detailed = 12 표시. fetch 한 번에 16 까지 보관해서 mode 변경 시 re-fetch X.
          const selected = selectComparableDisplayListings(card, j.comparables ?? [], 16);
          setListings(selected.listings);
          setListingScope(selected.scope);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "fetch failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ck, card, card.pid, card.marketplaceSource, card.marketBasis?.medianPrice, card.marketBasis?.p25Price, card.marketBasis?.p75Price]);

  if (!ck) return null;

  // Wave launch-78: 신발/의류 tier 우선 — 옛 conditionClass "clean"→"A급" mismatch 차단.
  const ccLabel = (() => {
    if (isShoeOrClothingCard(card)) {
      const tierLabel = tierShortLabel(card.conditionTier);
      if (tierLabel) return tierLabel;
    }
    return conditionShortLabel(cc);
  })();

  const totalListings = listings?.length ?? 0;
  return (
    <div className="mt-3">
      {/* Wave 394.7.v (Claude Design handoff CompareList): SectionH + 흰 카드 + line divider rows + footer 펼침. */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[13px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
          <span aria-hidden="true">🔍</span>
          <span>시세 비교 매물{totalListings ? ` ${totalListings}개` : ""}</span>
        </div>
        {ccLabel ? (
          <span className="whitespace-nowrap text-[10.5px] font-bold text-zinc-500 dark:text-zinc-400">
            {comparableScopeCopy(listingScope, ccLabel)}
          </span>
        ) : null}
      </div>

      {loading ? (
        // Wave 394.7.aa: skeleton 4개 row — 디폴트 visible 갯수와 동일 shape.
        <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className={`flex items-center gap-3 px-3 py-3 ${i === 0 ? "" : "border-t border-zinc-200 dark:border-zinc-800"}`}
            >
              <div className="h-[52px] w-[52px] shrink-0 animate-pulse rounded-[9px] bg-zinc-200 dark:bg-zinc-800" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 w-[82%] animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-2.5 w-[58%] animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-800/70" />
              </div>
              <div className="shrink-0 space-y-1 text-right">
                <div className="ml-auto h-3.5 w-16 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="ml-auto h-2.5 w-10 animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-800/70" />
              </div>
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">비교 매물 불러오기 실패</div>
      ) : !listings || listings.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {ccLabel ? `${ccLabel} 표시 가능 비교 매물이 아직 없어요` : "표시 가능 비교 매물이 아직 없어요"} — 시세는 누적 통계 기준으로 봅니다
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {/* Wave launch-64 (사용자 짚음 "우리 상품 가격 어디있는지 모름, 사진 작게 + 매입가 표시"):
              비교 매물 list 최상단에 "내 매물" row — 같은 format (사진 52px + 이름 + 매입가).
              사용자가 비교 매물 가격과 즉시 비교 가능. */}
          {/* Wave 729 (2026-05-23): 모바일 360px 폭 layout 짤림 fix (스크린샷 보고).
              min-w-0 명시 + pill shrink-0 + 상품명 truncate 로 가로 짤림 보장. 모바일 패딩 축소로 텍스트 영역 폭 확보. */}
          {card.price > 0 ? (
            <li className="flex items-center gap-2.5 bg-[#fffbef] px-2.5 py-3 dark:bg-amber-950/20 sm:gap-3 sm:px-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[9px] bg-zinc-100 ring-2 ring-amber-300 dark:bg-zinc-800 dark:ring-amber-700 sm:h-[52px] sm:w-[52px]">
                {(card.genericImageUrl ?? card.thumbnailUrl) ? (
                  <>
                    <Image src={card.genericImageUrl ?? card.thumbnailUrl ?? ""} alt="" fill sizes="(max-width: 640px) 44px, 52px" unoptimized className="object-cover" />
                    {/* Wave 751 (2026-05-25): 카테고리 워터마크 배지 (corner). */}
                    <CategoryWatermark
                      comparableKey={card.marketBasis?.comparableKey ?? null}
                      size={16}
                      variant="corner"
                    />
                  </>
                ) : (
                  // Wave 749 (2026-05-25): 카테고리 워터마크 placeholder.
                  <CategoryWatermark
                    comparableKey={card.marketBasis?.comparableKey ?? null}
                    size={28}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9.5px] font-black text-white">내 매물</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-100">
                    {card.name || "이 상품"}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[10.5px] font-bold text-amber-700 dark:text-amber-300">
                  매입가 기준
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[14px] font-black tabular-nums text-amber-700 dark:text-amber-300">
                  {card.price.toLocaleString("ko-KR")}원
                </div>
              </div>
            </li>
          ) : null}
          {/* Wave launch-81 (사용자 정정 — 운영자풀 패턴 통일):
              `같은 등급(X급) > 인접 등급(±1) > 그 외 > 등급 정보 없음` group section + 각 매물 자기 tier chip.
              relationLabel ("동일 기준/상태 유사/참고 매물") 은 grouping 과 의미 중복 → 제거.
              신발/의류(ourTier 존재) 만 grouping. 옛 conditionClass 매물은 flat. */}
          {(() => {
            const visibleSlice = listings.slice(0, expanded ? limit : INITIAL_VISIBLE);
            const ourTier = isShoeOrClothingCard(card) ? (card.conditionTier ?? null) : null;
            const groups = groupListingsByTierDistance(ourTier, visibleSlice);
            const hasMyItemRow = card.price > 0;
            let overallIdx = 0;
            return groups.map((group) => (
              <Fragment key={`group-${group.distance}`}>
                {ourTier && group.heading ? (
                  <li className="border-t border-zinc-200 bg-[#f8faf7] px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wide text-[#7b8378] dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                    {group.heading} · {group.items.length}개
                  </li>
                ) : null}
                {group.items.map((item) => {
                  const itemPrice = item.price > 0 ? item.price : 0;
                  const priceDiff = card.price && itemPrice ? itemPrice - card.price : 0;
                  const diffPct = card.price && itemPrice ? Math.round((priceDiff / card.price) * 100) : 0;
                  const isSimilar = Math.abs(diffPct) <= 2;
                  const isMoreExpensive = !isSimilar && priceDiff > 0;
                  const isSold = isComparableSold(item);
                  const isReserved = isComparableReserved(item);
                  const evidenceType = isSold ? "판매완료" : isReserved ? "예약중" : "판매중";
                  const seenLabel = seenAgoLabel(item.lastSeenAt);
                  const statusBadge = isSold
                    ? { label: "판매완료", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200" }
                    : isReserved
                      ? { label: "예약중", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200" }
                      : null;
                  const needsBorder = hasMyItemRow || overallIdx > 0;
                  overallIdx += 1;
                  const itemConditionLabel = ourTier
                    ? (tierShortLabel(item.conditionTier) ?? "등급 정보 부족")
                    : (conditionShortLabel(item.conditionClass) ?? "상태 정보 부족");
                  const sourceUrl = item.listingUrl || item.bunjangUrl;
                  return (
                    <li
                      key={item.pid}
                      className={needsBorder && !group.heading ? "border-t border-zinc-200 dark:border-zinc-800" : ""}
                    >
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex min-h-[74px] items-center gap-3 px-3 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                      >
                        <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[9px] bg-zinc-100 dark:bg-zinc-800">
                          {item.thumbnailUrl ? (
                            <>
                              <Image src={item.thumbnailUrl} alt="" fill sizes="52px" unoptimized className="object-cover" />
                              {/* Wave 751 (2026-05-25): 카테고리 워터마크 배지 (corner). */}
                              <CategoryWatermark
                                comparableKey={card.marketBasis?.comparableKey ?? null}
                                size={18}
                                variant="corner"
                              />
                            </>
                          ) : (
                            // Wave 749 (2026-05-25): 카테고리 워터마크 placeholder — 같은 SKU 비교 매물이므로 card 의 comparableKey 사용.
                            <CategoryWatermark
                              comparableKey={card.marketBasis?.comparableKey ?? null}
                              size={32}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-[12.5px] font-bold leading-tight tracking-tight text-zinc-700 group-hover:text-zinc-950 dark:text-zinc-300 dark:group-hover:text-zinc-100">
                            {item.name || "이름 없음"}
                          </div>
                          {mode === "detailed" ? (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9.5px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                {evidenceType}
                              </span>
                              {itemConditionLabel ? (
                                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9.5px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                  {itemConditionLabel}
                                </span>
                              ) : null}
                              {item.marketplaceLabel ? (
                                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9.5px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                  {item.marketplaceLabel}
                                </span>
                              ) : null}
                              {seenLabel ? (
                                <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9.5px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                  {seenLabel}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          {mode === "detailed" && item.conditionChips && item.conditionChips.length > 0 ? (
                            <ConditionChipsList
                              chips={item.conditionChips}
                              max={2}
                              className="mt-1.5 [&>span]:px-1.5 [&>span]:py-0.5 [&>span]:text-[9.5px]"
                            />
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          {statusBadge ? (
                            <div className="mb-0.5">
                              <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${statusBadge.cls}`}>
                                {statusBadge.label}
                              </span>
                            </div>
                          ) : null}
                          <div className="text-[14px] font-black tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
                            {krw(itemPrice)}
                          </div>
                          {!isSimilar ? (
                            <div className={`mt-px text-[11px] font-extrabold tabular-nums ${isMoreExpensive ? "text-blue-600 dark:text-blue-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {isMoreExpensive ? `+${diffPct}%` : `${diffPct}%`}
                            </div>
                          ) : (
                            <div className="mt-px text-[10px] font-medium text-zinc-400">비슷</div>
                          )}
                          {mode === "detailed" ? (
                            <span className="mt-1 inline-flex rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-black text-zinc-600 transition group-hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:bg-zinc-700">
                              원문 열기
                            </span>
                          ) : null}
                        </div>
                      </a>
                    </li>
                  );
                })}
              </Fragment>
            ));
          })()}
          {/* 펼침 footer — handoff: 카드 바닥 안쪽에 line divider + 중앙 텍스트 버튼 */}
          {totalListings > INITIAL_VISIBLE ? (
            <li className="border-t border-zinc-200 text-center dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full bg-transparent px-3 py-2.5 text-[11.5px] font-bold text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
              >
                {expanded
                  ? "접기 ↑"
                  : `비교 매물 ${Math.min(totalListings, limit) - INITIAL_VISIBLE}개 더 보기 ↓`}
              </button>
            </li>
          ) : null}
        </ul>
      )}

      {/* footnote — 카드 밖 작은 텍스트 (handoff 동일) */}
      <div className="mt-1.5 space-y-0.5 px-1 text-[10px] font-medium leading-snug text-zinc-500 dark:text-zinc-400">
        <div>
          {ccLabel ? (
            <>같은 모델 · {ccLabel} 매물끼리만 비교 (다른 상태는 별도 시세).</>
          ) : (
            <>같은 모델 매물 비교.</>
          )}
        </div>
        {listings && listings.length > 0 ? (
          // Wave 394.6.b.fix3: 사용자 짚음 — "현재 매입가 대비 몇 % 싸거나 비싼지". 비교 매물 기준 표현.
          <div>
            <span className="text-blue-600 dark:text-blue-400">+%</span> 비교 매물 비쌈 (이 매물 더 쌈) ·{" "}
            <span className="text-rose-600 dark:text-rose-400">−%</span> 비교 매물 쌈 (이 매물 더 비쌈)
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UpperFoldFearReducers({ card, analysisLoading = false }: { card: RevealCard; analysisLoading?: boolean }) {
  const speed = saleSpeedDisplay(card, { analysisLoading });
  const risk = buildRiskScore(revealRiskScoreInput(card));
  const activity = marketActivityDisplay(card);
  const safety = safetyDisplay(card, risk);
  const speedTone: "good" | "info" | "warn" = speed.isSlow ? "warn" : speed.isFast ? "good" : "info";
  // Wave 2026-05-19 v2 (사용자 피드백): "현재성" 타일 제거 — 매입/시세 줄에 이미 검증 시점 있어 중복.
  // 4 타일 → 3 타일 (오늘 물량 / 보통 N일 안에 팔림 / 거래 안전).
  const activityIconClass = `mt-1 h-5 w-5 ${upperFoldTileClass(activity.tone).value}`;
  const speedIconClass = `mt-1 h-5 w-5 ${upperFoldTileClass(speedTone).value}`;
  // Wave launch-84 (사용자 정정 — MVP audit): 표본 부족 타일 자체 제외 (일관성).
  //   - speed: speed.isFallback 면 "거래 기록 표본 부족" boilerplate → hide
  //   - activity: value === "데이터 부족" (demandLevel & supplyLevel 모두 null) → hide
  //   사용자 짚음: "수요공급도 없으면 시세 안나오는거처럼? 평점만 나오게 해야되는거 아님?"
  //   2 타일 다 hide 되면 거래 안전 (셀러 평점) 만 단독 표시. grid layout 동적 적응.
  const activityTileAvailable = activity.value !== "데이터 부족";
  const speedTileAvailable = speed.analysisLoading || !speed.isFallback || VELOCITY_UI_TEST_ENABLED;
  const tiles: Array<{
    key: string;
    label: string;
    value: string;
    sub: string;
    tone: UpperFoldTileTone;
    icon: React.ReactNode;
  }> = [];
  if (activityTileAvailable) {
    tiles.push({
      key: "activity",
      label: activity.label,
      value: activity.value,
      sub: activity.sub,
      tone: activity.tone,
      icon: renderActivityIcon(activity.value, activityIconClass),
    });
  }
  if (speedTileAvailable) {
    tiles.push({
      key: "speed",
      label: "팔리는 속도",
      value: speed.analysisLoading ? "확인 중" : speed.isFast ? "빠름" : speed.isSlow ? "느림" : "보통",
      sub: speed.analysisLoading
        ? "비교 기록 불러오는 중"
        : VELOCITY_UI_TEST_ENABLED && speed.isFallback
        ? `약 ${speed.label} · 표본 부족 (UI 테스트 표시)`
        : `약 ${speed.label} · 최근 판매 ${speed.sold7dCount.toLocaleString("ko-KR")}건`,
      tone: speedTone,
      icon: renderSpeedIcon(speed, speedIconClass),
    });
  }
  const safetyTone = upperFoldTileClass(safety.tone);
  // Wave 334: 평가별 아이콘 — renderSafetyIcon이 JSX 반환 (컴포넌트 새로 만들지 않음).
  const safetyIconNode = renderSafetyIcon(safety.tone, safety.value, `mt-1 h-5 w-5 ${safetyTone.value}`);
  // - dot 크기 통일 (h-1.5 w-1.5) — ShieldIcon 대신 dot로 거래 안전도 통일
  // - sub line-clamp-2 + 고정 높이 (정렬 어긋남 방지)
  // - 라벨 한 줄 고정
  // Wave launch-84 (사용자 정정 — MVP audit): 💡 hint box 제거.
  //   "비슷한 상태의 매물끼리만 비교한 결과예요" 는 ComparableListingsPanel 헤더 ("X급 매물끼리만") 와 중복.
  //   "셀러가 낮게 등록" 은 Profit 카드 chip ("+27%") 으로 이미 명시.
  // Wave launch-84b: 표시되는 타일 수에 따라 grid cols 동적. safety + tiles 합산.
  //   3개 (activity + speed + safety) → grid-cols-3
  //   2개 (activity 또는 speed + safety) → grid-cols-2
  //   1개 (safety 단독) → grid-cols-1
  const cellCount = tiles.length + 1; // +1 for safety
  const gridColsClass = cellCount === 3 ? "grid-cols-3" : cellCount === 2 ? "grid-cols-2" : "grid-cols-1";
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className={`mt-3 grid ${gridColsClass} divide-x divide-zinc-200 dark:divide-zinc-800`}>
        {tiles.map((tile) => {
          const tone = upperFoldTileClass(tile.tone);
          return (
            <div key={tile.key} className="flex flex-col items-center px-2 py-2.5 text-center">
              <div className="flex h-3 items-center justify-center text-[9px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span className="truncate">{tile.label}</span>
              </div>
              {tile.icon}
              <div className={`mt-1 line-clamp-1 text-xs font-bold leading-tight tabular-nums ${tone.value}`}>
                {tile.value}
              </div>
              <div className="mt-1 line-clamp-2 min-h-[24px] text-[10px] font-medium leading-3 text-zinc-500 dark:text-zinc-400">
                {tile.sub}
              </div>
            </div>
          );
        })}
        <RevealRiskScoreMini
          card={card}
          containerClassName="contents"
          triggerClassName="flex w-full flex-col items-center justify-start px-2 py-2.5 text-center transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
          triggerContent={(
            <span className="flex w-full flex-col items-center">
              <span className="flex h-3 items-center justify-center text-[9px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span className="truncate">거래 안전</span>
              </span>
              {safetyIconNode}
              <span className={`mt-1 line-clamp-1 text-xs font-bold leading-tight tabular-nums ${safetyTone.value}`}>
                {safety.value}
              </span>
              <span className="mt-1 line-clamp-2 block min-h-[24px] text-[10px] font-medium leading-3 text-zinc-500 dark:text-zinc-400">
                {safety.sub}
              </span>
            </span>
          )}
          hideChevron
          portalDetail
        />
      </div>
    </div>
  );
}

function RecommendationReasonPanel({ card, className = "" }: { card: RevealCard; className?: string }) {
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  // Wave launch-84: market/marketSample/soldSample/condition 사용처 (계산 기준 details + footer chip) 제거됨.
  const isMarketInvalidated = Math.min(card.expectedProfitMin, card.expectedProfitMax) <= 0;
  const goodSignals = recommendationGoodSignals(card);
  const watchSignals = recommendationWatchSignals(card);
  const featureCards = recommendationFeatureCards(card);
  const toneClass = {
    profit: "border-blue-100 bg-blue-50/70 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-100",
    market: "border-sky-100 bg-sky-50/70 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-100",
    speed: "border-amber-100 bg-amber-50/70 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100",
    quality: "border-[#d8e2d7] bg-white/85 text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/45 dark:text-zinc-100",
  } satisfies Record<RecommendationFeatureTone, string>;
  const reasonSummary = isMarketInvalidated
    ? "지금 기준으로는 차익이 없어 판매완료 상품처럼 정리하는 게 맞아요."
    : featureCards.slice(0, 2).map((feature) => feature.title).join(" · ");

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      {/* Wave 394.7.x: 초록 gradient 제거 — handoff WhyRec 흰 카드 + ✓ icon 원. */}
      <section className={`rounded-2xl border border-zinc-200 bg-white p-3.5 dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2 ${className}`}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="group flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-black text-zinc-950 dark:text-zinc-100">
              <CheckCircleIcon className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
              왜 이 상품을 추천했나요?
            </div>
            <div className="mt-1 hidden text-xs font-semibold leading-5 text-[#60705f] dark:text-zinc-300 sm:block">
              {reasonSummary}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-[#b9d0b4] bg-white/90 px-2.5 py-1 text-[11px] font-black text-[#4f6a52] shadow-sm transition group-hover:bg-[#e4f0e1] dark:border-blue-900/60 dark:bg-zinc-900 dark:text-blue-200">
            근거 보기
          </span>
        </button>
      </section>

      {open && portalRoot ? createPortal(
        <>
          <div
            className="fixed inset-0 z-[120] bg-zinc-950/28 backdrop-blur-[1px]"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="추천 이유 자세히 보기"
            onClick={(e) => e.stopPropagation()}
            className="recommendation-reason-dialog fixed left-1/2 top-1/2 z-[130] max-h-[min(82dvh,640px)] w-[calc(100vw-28px)] max-w-[540px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[#d6e2d3] bg-white shadow-2xl shadow-zinc-950/24 dark:border-zinc-700 dark:bg-zinc-900 sm:max-h-[84vh]"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#e8dfd2] bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-black text-zinc-950 dark:text-zinc-100">
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
                  왜 이 상품을 추천했나요?
                </div>
                <div className="mt-0.5 truncate text-xs font-semibold text-[#60705f] dark:text-zinc-300">
                  {reasonSummary}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                닫기
              </button>
            </div>
            <div className="max-h-[calc(min(82dvh,640px)-74px)] overflow-y-auto px-4 py-3 sm:max-h-[calc(84vh-74px)] sm:px-5 sm:py-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {featureCards.map((feature) => (
                  <div key={`${feature.title}-${feature.body}`} className={`rounded-xl border px-3 py-2.5 shadow-sm ${toneClass[feature.tone]}`}>
                    <div className="flex items-center gap-2 text-xs font-black">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/75 text-current shadow-sm dark:bg-zinc-900/55">
                        {feature.icon}
                      </span>
                      <span>{feature.title}</span>
                    </div>
                    <div className="mt-1.5 text-[11px] font-semibold leading-5 opacity-75">
                      {feature.body}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:hidden">
                <MarketBasisMini card={card} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-blue-100 bg-white/85 px-3 py-2.5 shadow-sm dark:border-blue-900/50 dark:bg-zinc-900/45">
                  <div className="text-[11px] font-black text-blue-800 dark:text-blue-200">좋은 점</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {goodSignals.length > 0 ? goodSignals.map((signal) => (
                      <span key={signal} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                        {signal}
                      </span>
                    )) : (
                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">차익과 시세 기준을 함께 확인했어요.</span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-white/85 px-3 py-2.5 shadow-sm dark:border-amber-900/50 dark:bg-zinc-900/45">
                  <div className="text-[11px] font-black text-amber-800 dark:text-amber-200">확인할 점</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {watchSignals.length > 0 ? watchSignals.map((signal) => (
                      <span key={signal} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                        {signal}
                      </span>
                    )) : (
                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">큰 주의 신호는 적어요.</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Wave launch-84 (사용자 정정 — MVP audit): 모달 내부 중복 제거.
                  - "계산 기준 보기" details → CostAssurancePanel 과 100% 중복 (수익 계산 근거 보기 버튼이 같은 데로 scroll)
                  - footer "비슷한 매물 N건 · 최근 거래 N건 · N시간 전" → Profit 카드 eyebrow "{age} · 비교 N개" 와 중복
                  좋은 점/확인할 점 + featureCards 만 keep — 모달 진입 가치 있음. */}
            </div>
          </div>
          <style jsx global>{`
            @keyframes recommendationReasonSettle {
              from {
                opacity: 0;
                transform: translate(-50%, calc(-50% + 10px));
              }
              to {
                opacity: 1;
                transform: translate(-50%, -50%);
              }
            }

            .recommendation-reason-dialog {
              animation: recommendationReasonSettle 130ms ease-out;
            }
          `}</style>
        </>,
        portalRoot,
      ) : null}
    </>
  );
}

// Wave launch-83 (사용자 결정): 데이터 부족 시 "수집 중" placeholder 보이지 않게.
//   MarketHistoryChart 가 onState 로 data 상태 알림 → "available" / "reference_only" 외엔 섹션 자체 hide.
//   첫 mount default = "loading" — fetch 동안엔 wrapper + skeleton 표시. 빈 상태 확인되면 wrapper 사라짐.
// Wave launch-103 (사용자 결정 — 매물 신고/피드백): 매물 잘못됐을 때 사용자가 신고 → 운영자 검토 → +20 크레딧.
//   인라인 카드 (수익 계산 근거 / 채널 비교 / 추천 이유 다음). 보상 명시 → conversion ↑.
function FeedbackReportPanel({
  card,
  openSignal = 0,
  panelRef,
}: {
  card: RevealCard;
  openSignal?: number;
  panelRef?: RefObject<HTMLDivElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("fake");
  const [message, setMessage] = useState("");
  const [stage, setStage] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const categories: Array<{ value: string; label: string }> = [
    { value: "fake", label: "가품 의심" },
    { value: "price_wrong", label: "시세 / 차익 이상" },
    { value: "sold_out", label: "이미 거래 완료된 매물" },
    { value: "category_wrong", label: "카테고리 / 모델 오분류" },
    { value: "other", label: "기타" },
  ];

  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  async function submit() {
    setErrorMessage(null);
    const clean = message.trim();
    if (clean.length < 5) {
      setErrorMessage("5자 이상 적어주세요.");
      return;
    }
    setStage("submitting");
    try {
      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid: card.pid,
          pidContext: {
            name: card.name,
            skuName: card.skuName,
            price: card.price,
            comparableKey: card.marketBasis?.comparableKey ?? null,
          },
          category,
          message: clean,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !data.ok) {
        setErrorMessage(data.message ?? "처리에 실패했어요. 잠시 후 다시 시도해주세요.");
        setStage("error");
        return;
      }
      setStage("done");
      setMessage("");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "네트워크 오류");
      setStage("error");
    }
  }

  if (stage === "done") {
    return (
      <section ref={panelRef} className="mt-3 scroll-mt-16 rounded-[20px] border border-blue-100 bg-blue-50/70 px-4 py-4 dark:border-blue-900/50 dark:bg-blue-950/20">
        <div className="flex items-center gap-2 text-[13px] font-black text-blue-700 dark:text-blue-200">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          제보 접수됐어요
        </div>
        <p className="mt-1.5 text-[12px] font-bold leading-5 text-blue-700/80 dark:text-blue-300/90">
          운영자가 검토 후 정당하면 +20 크레딧 지급해드릴게요.
        </p>
      </section>
    );
  }

  return (
    <section ref={panelRef} className="mt-3 scroll-mt-16 rounded-[20px] border border-zinc-200 bg-white px-4 py-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-950/35 dark:text-blue-300 dark:ring-blue-900/60">
            <AlertTriangleIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-black text-zinc-950 dark:text-zinc-100">
              이 매물 정보가 이상한가요?
            </div>
            <div className="mt-1 text-[11.5px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
              시세, 상태, 모델 분류가 틀린 것 같으면 알려주세요. 운영자 확인 후 적절하면 +20크레딧을 드려요.
            </div>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60">
          {open ? "닫기" : "제보"}
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">문제 유형</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-black transition ${
                    category === c.value
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                      : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-100 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-800 dark:hover:bg-blue-950/20 dark:hover:text-blue-300"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="feedback-message" className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
              어떻게 잘못됐는지 알려주세요 (5자 이상)
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              placeholder="예) 가품 같아요. 박음질이 조잡하고 사진의 폰트가 다름..."
              rows={3}
              disabled={stage === "submitting"}
              className="mt-1 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[12.5px] font-semibold leading-5 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-700 dark:focus:ring-blue-950/40"
            />
          </div>

          {errorMessage ? (
            <p className="text-[11.5px] font-bold text-rose-700 dark:text-rose-400">{errorMessage}</p>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={stage === "submitting" || message.trim().length < 5}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-[13px] font-black text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {stage === "submitting" ? (
              <>
                <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.32s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-white [animation-delay:-0.16s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-white" />
              </>
            ) : (
              <>제보 보내기</>
            )}
          </button>
          <p className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500">
            매물 정보가 함께 전달돼요. 검토 후 정당한 제보만 보상됩니다.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function DetailMarketGraphSection({ card }: { card: RevealCard }) {
  const [chartState, setChartState] = useState<MarketChartState>("loading");
  // 데이터 충분 / reference 매물 안내만 — 그 외 (empty / error / no_key) 는 wrapper 전체 hide.
  const showWrapper = chartState === "loading" || chartState === "available" || chartState === "reference_only";
  if (!showWrapper) return null;
  return (
    <div className="mt-3 space-y-2" data-detail-market-graph-before-comparables>
      {/* Wave launch-84 (사용자 정정 — MVP audit): "최신 수집 기준" chip 제거 —
          Profit 카드 eyebrow "{age} · 비교 N개" 와 중복 meta. h3 만 깔끔하게 유지. */}
      <h3 className="m-0 text-[16px] font-extrabold tracking-tight text-[#1a2620] dark:text-zinc-100">
        시세 그래프 · 시장 분석
      </h3>
      <div className="overflow-hidden rounded-2xl border border-[#ece3d2] bg-white p-3 space-y-2 dark:border-zinc-800 dark:bg-zinc-900">
        <MarketHistoryChart
          comparableKey={card.marketBasis?.comparableKey ?? null}
          currentPrice={card.price}
          conditionClass={card.marketBasis?.conditionClass ?? null}
          conditionTier={card.conditionTier ?? null}
          priceSource={card.marketBasis?.priceSource ?? null}
          basisSource={card.marketBasis?.basisSource ?? null}
          basisSourceLabel={card.marketBasis?.basisSourceLabel ?? null}
          referencePrice={card.marketBasis?.priceSource === "reference" ? card.marketBasis?.medianPrice ?? null : null}
          nullOnEmpty
          onState={setChartState}
        />
        <MarketGraphTrustLine card={card} />
        <SkuListingFlowMini card={card} />
      </div>
    </div>
  );
}

function MarketGraphTrustLine({ card }: { card: RevealCard }) {
  const market = card.marketBasis;
  if (!market) return null;
  const condition = marketConditionLabel(card);
  const sourceLabel = market.basisSourceLabel ?? "통합 중고";
  const source = market.priceSource === "reference" ? `새상품 기준선 + ${sourceLabel} 미개봉 추이` : `${sourceLabel} ${condition} 매물 추이`;
  return (
    <details className="rounded-lg border border-zinc-200 bg-white/70 px-3 py-2 text-[11px] font-semibold leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/45 dark:text-zinc-300">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
        <span className="font-black text-[#4f6a52] dark:text-blue-200">그래프 기준 보기</span>
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
          {condition} · {source}
        </span>
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-[#e7f2e4] px-2 py-0.5 text-[10px] font-black text-[#4f6a52] dark:bg-blue-950/50 dark:text-blue-300">
          {condition} 기준
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">{source}</span>
      </div>
      <div className="mt-1">
        이 그래프는 같은 모델 중 비슷한 상태로 분류된 매물을 우선 사용해요. 상태가 다른 매물을 섞어 시세를 부풀리지 않아요.
      </div>
    </details>
  );
}

function savedRatingLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(1);
}

// Wave 80: SavedDetailMini 미사용 (찜/리뷰/판매자 설명 직접 노출 법적 위험으로 제거).
// _SavedDetailMini로 명시 — 차후 필요 시 재활용.
function _SavedDetailMini({ card }: { card: RevealCard }) {
  const detail = card.savedDetail;
  if (!detail) return null;
  const safety = marketplaceSafetyForCard(card);
  const description = detail.descriptionPreview.trim();
  const rating = savedRatingLabel(detail.sellerReviewRating);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300">
      <div className="flex flex-wrap gap-1.5">
        {detail.favoriteCount != null ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-black text-zinc-900 dark:bg-zinc-900 dark:text-zinc-200">
            찜 {detail.favoriteCount.toLocaleString("ko-KR")}
          </span>
        ) : null}
        {safety.isJoongna && safety.sellerTrust.trustScore != null ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-black text-zinc-900 dark:bg-zinc-900 dark:text-zinc-200">
            신뢰지수 {safety.sellerTrust.metric.replace("신뢰지수 ", "")}
          </span>
        ) : rating ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-black text-zinc-900 dark:bg-zinc-900 dark:text-zinc-200">
            리뷰 {rating}
          </span>
        ) : null}
        {detail.sellerReviewCount > 0 ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-black text-zinc-900 dark:bg-zinc-900 dark:text-zinc-200">
            {safety.isJoongna ? "거래후기" : "리뷰"} {detail.sellerReviewCount.toLocaleString("ko-KR")}개
          </span>
        ) : null}
        {safety.shipping.allowFreeShippingBadge || safety.shipping.assumption === "included" || safety.shipping.assumption === "direct_only" ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-black text-zinc-900 dark:bg-zinc-900 dark:text-zinc-200">
            {safety.shipping.assumption === "direct_only" ? "직거래만" : safety.shipping.assumption === "included" ? "배송비 포함" : "무료배송"}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="mt-2 line-clamp-3 whitespace-pre-line font-semibold text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}

// Wave 2026-05-19 v3 (사용자 피드백 — 셀러 신뢰도 별도 카드):
// 거래 안전 타일 + RecommendationReason 안 셀러 후기가 분산 → 별도 카드로 통합.
// savedDetail에 있는 데이터만 활용 (sellerReviewRating/sellerReviewCount/freeShipping).
// is_proshop / last_seen_at 은 prop 부재 → 다음 wave (API 확장 필요).
// Wave 393.6: 호출처 제거됨 (UpperFold tile + WhyTrust Q&A에 정보 있음).
// 함수는 보존 — 추후 재활용 가능. ESLint _ prefix로 unused 허용.
function _SellerTrustPanel({ card }: { card: RevealCard }) {
  const detail = card.savedDetail;
  const safety = marketplaceSafetyForCard(card);
  const rating = detail?.sellerReviewRating ?? null;
  const reviewCount = detail?.sellerReviewCount ?? 0;
  const freeShipping = safety.shipping.allowFreeShippingBadge;

  // 등급 판단 — 일반인 친화 4단계
  let trustLevel: "good" | "ok" | "caution" | "danger";
  let trustHeadline: string;
  let trustSub: string;
  // Wave 393.5: sub 단순화 — WhyTrustCollapse Q&A에 자세한 답 이미 있음.
  // 헤드라인은 등급 + 별점, sub은 "후기 N건 (수 충분/적음)" 단순 정보만.
  if (safety.isJoongna) {
    trustLevel = safety.sellerTrust.trustScore != null || reviewCount > 0 ? "ok" : "caution";
    trustHeadline = safety.sellerTrust.metric;
    trustSub = safety.sellerTrust.metricLabel || "중고나라 판매자 정보 확인";
  } else if (rating != null && rating >= 4.8 && reviewCount >= 30) {
    trustLevel = "good";
    trustHeadline = `우수 셀러 ⭐ ${rating.toFixed(1)}`;
    trustSub = `후기 ${reviewCount.toLocaleString("ko-KR")}건 (수 충분)`;
  } else if (rating != null && rating >= 4.5 && reviewCount >= 10) {
    trustLevel = "ok";
    trustHeadline = `평점 ${rating.toFixed(1)} 셀러`;
    trustSub = `후기 ${reviewCount.toLocaleString("ko-KR")}건`;
  } else if (reviewCount > 0 && rating != null) {
    trustLevel = "caution";
    trustHeadline = `평점 ${rating.toFixed(1)} · 후기 ${reviewCount.toLocaleString("ko-KR")}건`;
    trustSub = reviewCount < 10 ? "후기 적음 — 안전결제 권장" : "후기 보통 — 안전결제 권장";
  } else {
    trustLevel = "danger";
    trustHeadline = "신규/익명 셀러";
    trustSub = "후기 없음 — 안전결제 + 직거래 검수";
  }

  // Wave 323 (디자인 통일): 모든 패널 같은 base — 흰 카드 + 색 accent strip (좌측 보더).
  // 등급별 좌측 4px 보더 색만 변경. 박스 안 박스 없음.
  const accentBorderClass = trustLevel === "good"
    ? "border-l-blue-500"
    : trustLevel === "ok"
      ? "border-l-blue-300"
      : trustLevel === "caution"
        ? "border-l-amber-400"
        : "border-l-rose-500";
  const valueColor = trustLevel === "good" || trustLevel === "ok"
    ? "text-blue-700 dark:text-blue-300"
    : trustLevel === "caution"
      ? "text-amber-700 dark:text-amber-300"
      : "text-rose-700 dark:text-rose-300";

  // Wave 334: 등급별 아이콘 시각화.
  const TrustIcon = trustLevel === "good"
    ? TrophyIcon
    : trustLevel === "ok"
      ? ShieldIcon
      : AlertTriangleIcon;

  return (
    <section className={`mt-3 border-t border-zinc-200 border-l-4 ${accentBorderClass} bg-white/0 py-3 pl-3 dark:border-zinc-800 sm:rounded-xl sm:border sm:bg-white sm:p-3 sm:dark:bg-zinc-900/40`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <TrustIcon className={`mt-3 h-6 w-6 shrink-0 ${valueColor}`} />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              셀러 정보
            </div>
            <div className={`mt-1 text-sm font-bold ${valueColor}`}>
              {trustHeadline}
            </div>
            <div className="mt-0.5 text-xs font-medium leading-4 text-zinc-600 dark:text-zinc-400">
              {trustSub}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {freeShipping ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
              무료배송
            </span>
          ) : null}
          <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {safety.paymentLabel} 확인
          </span>
        </div>
      </div>
      {(trustLevel === "caution" || trustLevel === "danger") ? (
        <div className="mt-2 border-t border-zinc-100 pt-2 text-[11px] font-medium leading-4 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          후기 적은 셀러는 원본 플랫폼 {safety.paymentLabel} 가능 여부 또는 직거래 검수를 먼저 확인하세요.
        </div>
      ) : null}
    </section>
  );
}

// Wave 2026-05-19 (외부인 #2 B3 가품 체크리스트):
// 카테고리별 정적 체크리스트 (counterfeit-checklist.ts). 12개 위험 카테고리만 노출.
// 안전 카테고리(monitor/desktop/lego/speaker/kickboard/game_console/home_appliance/sport_golf)는
// counterfeitChecklistFor() null 반환 → 미표시 (노이즈 안 박음).
function CounterfeitChecklistPanel({ card }: { card: RevealCard }) {
  const [expanded, setExpanded] = useState(false);
  const category = categoryFromComparableKey(card.marketBasis?.comparableKey ?? null);
  const checklist = counterfeitChecklistFor(category);
  if (!checklist) return null;

  // Wave A (2026-05-20): brand 감지 시 brand-specific 변별 포인트 + 시장 위험 + 인증 박스 노출.
  //   외부 review — "Bird-aid 라벨, GORE-TEX 4면 박음질 같은 모델별 가품 체크포인트가 진짜 가치 있음."
  const brandDepth: BrandDepthMatch | null = detectBrandDepth(category, {
    skuId: card.skuId ?? null,
    skuName: card.skuName ?? null,
    name: card.name ?? null,
  });

  const mustChecks = checklist.checks.filter((c) => c.priority === "must");
  const recommendedChecks = checklist.checks.filter((c) => c.priority === "recommended");
  const extraChecks = checklist.checks.filter((c) => c.priority === "extra");
  const totalCount = checklist.checks.length;

  // Wave 393.8: 카테고리별 헤드라인 — "전자제품이 뭔 가품이냐" (사용자 짚음).
  // 가품 위험 카테고리 vs 정품 거래 카테고리 분기. 헤드라인 의미 정확.
  // Wave 394.7.f (외부 review 2라운드 #6): "명품 정품 점검" → 일반화. 스트릿/한정판 콜라보 (Supreme/BAPE) 도 cover.
  const headlineByCategory: Record<string, string> = {
    shoe: `가품 + 사이즈 점검 ${totalCount}개`,
    earphone: `차이팟 가품 + 정품 점검 ${totalCount}개`,
    bag: `브랜드 정품 점검 ${totalCount}개`,
    perfume: `정품 진위 점검 ${totalCount}개`,
    watch: `브랜드 정품 점검 ${totalCount}개`,
    clothing: `브랜드 정품 점검 ${totalCount}개`,
    smartphone: `잠금 + 기기 상태 점검 ${totalCount}개`,
    tablet: `iCloud 잠금 + 상태 점검 ${totalCount}개`,
    smartwatch: `잠금 + 배터리 점검 ${totalCount}개`,
    laptop: `잠금 + 부품 점검 ${totalCount}개`,
    drone: `활성화 + 펌웨어 점검 ${totalCount}개`,
    camera: `셔터 + 렌즈 점검 ${totalCount}개`,
  };
  // Wave C+E.fix (사용자 짚음 — "에어팟맥스가 차이팟이랑 뭔 관련이길래"):
  // brand 감지된 매물은 brand label 헤드라인 우선. AirPods Max (헤드폰) ≠ 차이팟 (인이어 가품).
  // brand 미감지 시 카테고리 default fallback.
  const lowCounterfeitRiskBrand = brandDepth?.brand.counterfeitRisk === "low";
  const headlineText = brandDepth?.brand.label
    ? `${brandDepth.brand.label} ${lowCounterfeitRiskBrand ? "상태 점검" : "정품 점검"} ${totalCount}개`
    : headlineByCategory[checklist.category] ?? `구매 전 점검 ${totalCount}개`;
  const riskSummary = lowCounterfeitRiskBrand
    ? `${brandDepth.brand.label}은 기능, 구성품, 보증 상태를 먼저 확인하는 게 중요해요.`
    : checklist.riskHeadline;

  // 카테고리별 uppercase 헤더도 자연어
  // Wave 394.1 (외부 review #9): 정품 단정형 ("정품 확인") → 방어적 ("정품 확인 필요").
  // "사용자가 '앱이 정품 판정해줬다'고 오해할 수 있음. 특히 명품 정품 판단 민감.
  // 앱이 보장하는 듯한 문구는 위험" — 외부 review. 능동형 ("구매 전 점검", "기기 점검") 그대로 OK.
  const upperHeaderByCategory: Record<string, string> = {
    shoe: "구매 전 점검",
    earphone: "구매 전 점검",
    bag: "정품 확인 필요",
    perfume: "정품 확인 필요",
    watch: "정품 확인 필요",
    clothing: "정품 확인 필요",
    smartphone: "기기 점검",
    tablet: "기기 점검",
    smartwatch: "기기 점검",
    laptop: "기기 점검",
    drone: "기기 점검",
    camera: "기기 점검",
  };
  const upperHeader = upperHeaderByCategory[checklist.category] ?? "구매 전 점검";

  // Wave 323 (디자인 통일): 흰 카드 + rose 좌측 보더 + 본문은 색 강도 줄임.
  const priorityDotClass: Record<CounterfeitCheckPriority, string> = {
    must: "bg-rose-500",
    recommended: "bg-amber-400",
    extra: "bg-zinc-300 dark:bg-zinc-600",
  };

  // Wave 393.5: rose → amber (사용자 짚음 — rose는 "이 매물 가품"으로 헷갈림.
  // 실제 의미 = 구매 전 정품 점검 체크리스트).
  return (
    <section className="mt-[18px]">
      {/* Wave 394.7.s: handoff AuthenticityCheck 정확 — bg #fffbef + border 1px #fde68a + border-left 3px #f59e0b + radius 16. */}
      <div className="rounded-2xl border border-amber-200 border-l-[3px] border-l-amber-500 bg-[#fffbef] p-4 dark:border-amber-900/55 dark:border-l-amber-400 dark:bg-amber-950/18">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-1.5">
            <ShieldIcon className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">
              {upperHeader} · {checklist.label}
            </span>
          </div>
          <h4 className="mb-1.5 text-[15px] font-extrabold tracking-tight text-[#1a2620] dark:text-zinc-50">
            {headlineText}
          </h4>
          <div className="mt-0.5 line-clamp-2 text-xs font-medium leading-4 text-zinc-600 dark:text-zinc-400 sm:line-clamp-none">
            {riskSummary}
          </div>
          {brandDepth ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium leading-4">
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {brandDepth.brand.label}
              </span>
              <span
                className={
                  brandDepth.brand.counterfeitRisk === "high"
                    ? "rounded-full bg-rose-50 px-2 py-0.5 font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                    : brandDepth.brand.counterfeitRisk === "moderate"
                      ? "rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                      : "rounded-full bg-blue-50 px-2 py-0.5 font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                }
              >
                {COUNTERFEIT_RISK_LABEL[brandDepth.brand.counterfeitRisk]}
              </span>
            </div>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {expanded ? "접기" : `필수 ${mustChecks.length}개`}
        </span>
      </button>
      {expanded ? (
        <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {brandDepth ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                <span aria-hidden="true">🎯</span>
                <span>{brandDepth.brand.label} — {lowCounterfeitRiskBrand ? "모델별 상태 포인트" : "모델별 변별 포인트"}</span>
              </div>
              {brandDepth.brand.counterfeitChecks.length > 0 ? (
                <div>
                  <div className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100">
                    {lowCounterfeitRiskBrand ? "상태 확인 (구체 항목)" : "가품 변별 (구체 항목)"}
                  </div>
                  <ul className="mt-1 space-y-1">
                    {brandDepth.brand.counterfeitChecks.map((c, i) => (
                      <li
                        key={i}
                        className="flex gap-1.5 text-[11px] font-medium leading-4 text-zinc-700 dark:text-zinc-200"
                      >
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-rose-500" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {brandDepth.brand.marketRisks.length > 0 ? (
                <div>
                  <div className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100">시장 위험 (가품 외)</div>
                  <ul className="mt-1 space-y-1">
                    {brandDepth.brand.marketRisks.map((c, i) => (
                      <li
                        key={i}
                        className="flex gap-1.5 text-[11px] font-medium leading-4 text-zinc-700 dark:text-zinc-200"
                      >
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {brandDepth.brand.authentication.length > 0 ? (
                <div>
                  <div className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100">인증/검수 가능 채널</div>
                  <ul className="mt-1 space-y-1">
                    {brandDepth.brand.authentication.map((c, i) => (
                      <li
                        key={i}
                        className="flex gap-1.5 text-[11px] font-medium leading-4 text-zinc-700 dark:text-zinc-200"
                      >
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-blue-500" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="text-[10px] font-medium leading-4 text-zinc-600 dark:text-zinc-400">
                {lowCounterfeitRiskBrand
                  ? "※ 미뇨이는 기능 상태를 보장하지 않아요. 직접 거래 전 셀러에게 사진/영상 요청을 권장합니다."
                  : "※ 미뇨이는 정품 판정 X. 직접 거래 시 셀러에게 사진/영상 요청해 본인 판단 권장."}
              </div>
            </div>
          ) : null}
          {[...mustChecks, ...recommendedChecks, ...extraChecks].map((check) => (
            <div
              key={check.title}
              className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60"
            >
              <div className="flex items-start gap-2">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${priorityDotClass[check.priority]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                      {check.title}
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                      {PRIORITY_LABEL[check.priority]}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-medium leading-4 text-zinc-600 dark:text-zinc-400">
                    {check.detail}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="text-[10px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
            필수 항목 거절 시 거래 보류 권장. 원본 플랫폼 결제 조건과 반품/분쟁 절차는 구매 전 확인.
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1">
          {mustChecks.slice(0, 4).map((check) => (
            <span
              key={check.title}
              className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
              title={check.detail}
            >
              {check.title}
            </span>
          ))}
          {mustChecks.length > 4 ? (
            <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              +{mustChecks.length - 4}
            </span>
          ) : null}
        </div>
      )}
      </div>
    </section>
  );
}

// Wave 2026-05-19 (외부인 #A1 판매 단계 도우미):
// 카테고리별 정적 템플릿 (sell-helper.ts). 매수 후(bought/inspected feedback) 자동 펼침.
// LLM 호출 없음 — 비용/모더레이션 책임 제거. 정적 룰만으로 일반인 친화 판매 가이드 제공.
function SellHelperPanel({
  card,
  currentFeedbackType,
}: {
  card: RevealCard;
  currentFeedbackType?: string | null;
}) {
  const category = categoryFromComparableKey(card.marketBasis?.comparableKey ?? null);
  const helper = sellHelperFor(category);
  // Wave 2026-05-19 v2 (사용자 피드백): 매수 전엔 아예 숨김.
  // bought/inspected/listed/resold feedback 받은 매물에만 노출 — 매수 흐름 후 자연스럽게 등장.
  const hasPurchased = currentFeedbackType === "bought"
    || currentFeedbackType === "inspected"
    || currentFeedbackType === "listed"
    || currentFeedbackType === "resold";
  const [expanded, setExpanded] = useState(true);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);

  if (!helper) return null;
  if (!hasPurchased) return null;

  const medianPrice = card.marketBasis?.medianPrice ?? null;
  const pricing = medianPrice != null && medianPrice > 0
    ? suggestedAskingPrice(category, medianPrice)
    : null;

  const recommendedTitle = `[${helper.label.split(" ")[0]} 매물] ${card.name}`;
  const bodyTemplate = buildBodyTemplate(category, card.name) ?? "";

  async function copyText(text: string, setter: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      window.setTimeout(() => setter(false), 1600);
    } catch {
      setter(false);
    }
  }

  const requiredPhotos = helper.photos.filter((p) => p.required);
  const optionalPhotos = helper.photos.filter((p) => !p.required);

  return (
    <section className="mt-3 border-t border-zinc-200 border-l-4 border-l-blue-500 bg-white/0 py-3 pl-3 dark:border-zinc-800 sm:rounded-xl sm:border sm:bg-white sm:p-3 sm:dark:bg-zinc-900/40">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            판매 도우미 — {helper.label}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300">
            <WalletIcon className="h-4 w-4 shrink-0" />
            {currentFeedbackType === "bought" ? "매수 완료 — 이제 팔아보자"
              : currentFeedbackType === "inspected" ? "검수 완료 — 등록 단계"
              : currentFeedbackType === "listed" ? "판매 등록 완료"
              : "판매 완료"}
          </div>
          <div className="mt-0.5 line-clamp-2 text-xs font-medium leading-4 text-zinc-600 dark:text-zinc-400 sm:line-clamp-none">
            제목 / 본문 / 사진 / 호가 가이드 — 복붙 가능.
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {expanded ? "접기" : "펼치기"}
        </span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {/* 호가 가이드 — 평탄 */}
          {pricing ? (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                추천 호가 / 거래가
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">호가 (등록)</div>
                  <div className="text-base font-bold tabular-nums text-blue-600 dark:text-blue-300">
                    {krw(pricing.askingPrice)}
                  </div>
                  <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    시세 +{pricing.markupPct}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">거래가 (목표)</div>
                  <div className="text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {krw(pricing.targetClosePrice)}
                  </div>
                  <div className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                    시세 기준
                  </div>
                </div>
              </div>
              <div className="mt-1.5 text-[10px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
                {helper.priceNote}
              </div>
            </div>
          ) : null}

          {/* 추천 제목 */}
          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                추천 제목
              </div>
              <button
                type="button"
                onClick={() => copyText(recommendedTitle, setCopiedTitle)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {copiedTitle ? "복사됨" : "복사"}
              </button>
            </div>
            <div className="mt-1.5 rounded-md bg-zinc-50 px-2.5 py-2 text-xs font-medium leading-5 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {recommendedTitle}
            </div>
            <div className="mt-1 text-[10px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
              패턴: <span className="font-mono">{helper.titlePattern}</span>
            </div>
          </div>

          {/* 본문 템플릿 */}
          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                본문 템플릿
              </div>
              <button
                type="button"
                onClick={() => copyText(bodyTemplate, setCopiedBody)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {copiedBody ? "복사됨" : "복사"}
              </button>
            </div>
            <pre className="mt-1.5 max-h-[200px] overflow-auto whitespace-pre-wrap rounded-md bg-zinc-50 px-2.5 py-2 text-[11px] font-medium leading-5 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {bodyTemplate}
            </pre>
          </div>

          {/* 사진 가이드 */}
          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              필수 사진 {requiredPhotos.length}장
              {optionalPhotos.length > 0 ? (
                <span className="ml-1 font-medium normal-case text-zinc-400">+ 선택 {optionalPhotos.length}</span>
              ) : null}
            </div>
            <ol className="mt-2 space-y-1.5">
              {requiredPhotos.map((photo, idx) => (
                <li key={photo.title} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {photo.title}
                    </div>
                    <div className="text-[11px] font-medium leading-4 text-zinc-600 dark:text-zinc-400">
                      {photo.detail}
                    </div>
                  </div>
                </li>
              ))}
              {optionalPhotos.map((photo, idx) => (
                <li key={photo.title} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-[10px] font-bold text-white dark:bg-zinc-600">
                    +{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      {photo.title}
                    </div>
                    <div className="text-[11px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
                      {photo.detail}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* 카테고리 팁 */}
          <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              💡 팁
            </div>
            <div className="mt-1 text-xs font-medium leading-5 text-zinc-700 dark:text-zinc-300">
              {helper.proTip}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// Wave 331 (사용자 + 메모리 정책 박혀있던 거):
// 번개장터 안전결제 의무화 → 셀러 3.5% 수수료. 당근마켓 직거래는 수수료 0.
// 사용자가 어디 팔지 선택지 보고 결정.
function joongnaSellerSafePaymentFee(salePrice: number | null | undefined) {
  const price = Number(salePrice ?? 0);
  if (!Number.isFinite(price) || price <= JOONGNA_SAFE_PAYMENT_FEE_FREE_UNDER_KRW) return 0;
  return Math.round(price * JOONGNA_SELLER_SAFE_PAYMENT_FEE_RATE);
}

function DaangnLogo({ className = "h-4 w-4" }: { className?: string }) {
  // 당근마켓 로고 — 녹색 잎 + 주황 핀 본체 + 흰 원 (정식 형태 근사).
  // 사용자가 정식 SVG/PNG 주면 교체.
  return (
    <svg className={className} viewBox="0 0 50 55" xmlns="http://www.w3.org/2000/svg" aria-label="당근마켓">
      <path d="M15 6 Q18 1 22 3 Q25 0.5 28 3 Q32 1 35 6 Q30 11 25 9 Q20 11 15 6 Z" fill="#5DBA5E" />
      <path d="M25 10 C12 10 6 22 11 36 L25 52 L39 36 C44 22 38 10 25 10 Z" fill="#FF7A36" />
      <circle cx="25" cy="27" r="6" fill="white" />
    </svg>
  );
}

function PlatformProfitCompare({ card }: { card: RevealCard }) {
  const market = card.marketBasis;
  if (!market?.medianPrice || market.medianPrice <= 0) return null;

  const bunjangProfit = sourceAwareProfitAverage(card, "bunjang");
  const joongnaProfit = sourceAwareProfitAverage(card, "joongna");
  const daangnProfit = sourceAwareProfitAverage(card, "daangn");
  if (bunjangProfit <= 0 && joongnaProfit <= 0 && daangnProfit <= 0) return null;
  const bonusFromDaangn = Math.max(0, daangnProfit - Math.max(bunjangProfit, joongnaProfit));
  const currentSource = card.marketplaceSource === "daangn" ? "daangn" : card.marketplaceSource === "joongna" ? "joongna" : "bunjang";
  // Wave launch-66/67 (사용자 짚음 "셀러/판매자 통일 + chip 위계"):
  //   chip = 결제 시스템 (위계 1). joongna chip = "안심결제" 단독.
  //   note = 수수료 (판매자 + 구매자 둘 다 표시 — joongna 가 사실 더 부담).
  const marketplaceCards = [
    {
      source: "bunjang",
      label: "번개장터",
      profit: bunjangProfit,
      note: `판매자 ${Math.round(SELLING_FEE_RATE * 1000) / 10}% 수수료 차감`,
      chips: ["번개페이", "앱 결제"],
    },
    {
      source: "joongna",
      label: "중고나라",
      profit: joongnaProfit,
      note: `판매자 ${Math.round(JOONGNA_SELLER_SAFE_PAYMENT_FEE_RATE * 100)}% · 구매자 ${Math.round(JOONGNA_BUYER_SAFE_PAYMENT_FEE_RATE * 1000) / 10}% 별도`,
      chips: ["안심결제", "전국 거래"],
    },
  ];

  return (
    <section className="mt-[18px]">
      {/* Wave 394.7.r: handoff SellWhere JSX 1:1. */}
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-[16px] font-extrabold tracking-tight text-[#1a2620] dark:text-zinc-50">어디에 팔지?</h3>
        <span className="whitespace-nowrap text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">채널별 예상 차익</span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {marketplaceCards.map((channel) => (
          <div
            key={channel.source}
            className="relative rounded-[14px] border border-zinc-200 bg-white px-3 pb-3 pt-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {channel.source === currentSource ? (
              <div className="absolute -top-2 right-2.5 rounded-full bg-blue-700 px-2 py-1 text-[9px] font-extrabold tracking-wide text-white dark:bg-blue-500 dark:text-zinc-950">
                원본 출처
              </div>
            ) : null}
            <div className="mb-2 flex items-center gap-1.5">
              {channel.source === "bunjang" ? (
                <BunjangLogo className="h-[22px] w-[22px] rounded-full" />
              ) : (
                <JoongnaLogo className="h-[22px] w-[22px] rounded-full" />
              )}
              <span className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100">{channel.label}</span>
            </div>
            {/* Wave launch-117b (2026-05-24): 수익 = emerald (light+dark). */}
            <div className="text-[19px] font-black tracking-tight text-emerald-700 tabular-nums dark:text-emerald-300">
              +{krw(channel.profit)}
            </div>
            <div className="mt-1 text-[10.5px] font-semibold text-zinc-500 dark:text-zinc-400">{channel.note}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {channel.chips.map((chip) => (
                <span key={chip} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/45 dark:text-blue-200">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        ))}
        <div className="relative rounded-[14px] border-[1.5px] border-amber-400 bg-gradient-to-br from-[#fffaf0] to-[#fff5dc] px-3 pb-3 pt-3 dark:border-amber-800 dark:from-amber-950/35 dark:to-zinc-950">
          {currentSource === "daangn" ? (
            <div className="absolute -top-2 right-2.5 rounded-full bg-blue-700 px-2 py-1 text-[9px] font-extrabold tracking-wide text-white dark:bg-blue-500 dark:text-zinc-950">
              원본 출처
            </div>
          ) : bonusFromDaangn > 0 ? (
            <div className="absolute -top-2 right-2.5 rounded-full bg-amber-700 px-2 py-1 text-[9px] font-extrabold tracking-wide text-amber-100 dark:bg-amber-500 dark:text-zinc-950">
              +{krw(bonusFromDaangn)} 더
            </div>
          ) : null}
          <div className="mb-2 flex items-center gap-1.5">
            <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#ff6f0f]">
              <DaangnLogo className="h-3.5 w-3.5" />
            </span>
            <span className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100">당근 직거래</span>
          </div>
          <div className="text-[19px] font-black tracking-tight text-amber-700 tabular-nums dark:text-amber-300">
            +{krw(daangnProfit)}
          </div>
          <div className="mt-1 text-[10.5px] font-semibold text-zinc-500 dark:text-zinc-400">수수료 0원</div>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">지역 제한</span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">네고 부담</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function sellerQuestionText(card: RevealCard) {
  const safety = marketplaceSafetyForCard(card);
  const marketplace = safety.marketplaceLabel;
  const payment = safety.paymentLabel;
  return [
    `${card.name} 보고 문의드립니다.`,
    `1. ${safety.shipping.question}`,
    `2. ${marketplace} ${payment}로 진행 가능하고, 수수료는 누가 부담하나요?`,
    "3. 구성품은 사진과 설명에 보이는 것 전부 포함인가요?",
    "4. 외부 결제 링크나 외부 메신저가 아닌 원본 플랫폼 안에서만 진행 가능할까요?",
  ].join("\n");
}

function CostAssurancePanel({ card }: { card: RevealCard }) {
  const [copied, setCopied] = useState(false);
  const snapshot = costAssuranceSnapshot(card);
  const feeRateLabel = `${Math.round(SELLING_FEE_RATE * 1000) / 10}%`;
  const isDaangn = card.marketplaceSource === "daangn";
  const questions = sellerQuestionText(card);
  // Wave 337 (사용자 + 메모리 정책 bunjang_safe_payment_mandate):
  // 번개장터 안전결제 의무화 → 셀러가 3.5% 부담. 구매자(우리 사용자가 살 때)는 0원.
  // Wave 394.7.h (외부 review 2라운드 #8): 비용 그룹 분리 — 구매 / 재판매. 초보자 헷갈림 차단.
  // Wave 803d (2026-05-30): 사용자 보고 "상세페이지 위치 안 나옴" fix.
  //   directTradeLocation 박혀있지만 (pack-open.ts:2235 박는 코드 + RevealCard.savedDetail 통해 도달) UI 활용 0 hits.
  //   당근 매물 (direct_only) 일 때 "거래 가능 지역 확인 필요" placeholder 만 박혀서 사용자 frustration.
  //   Fix: directTradeLocation 박혀있으면 별도 row 박음 ("거래 가능 지역" label) + 배송비 note 도 region 박음.
  const directTradeLocationLabel = isDaangn ? (card.savedDetail?.directTradeLocation ?? null) : null;
  const purchaseRows = [
    { label: "상품가", value: krw(card.price), note: "현재 매입 기준" },
    ...(directTradeLocationLabel
      ? [{ label: "거래 가능 지역", value: directTradeLocationLabel, note: "당근 동네 인증 기준" }]
      : []),
    {
      label: "내가 낼 배송비",
      value: snapshot.shippingValueLabel,
      note: directTradeLocationLabel ? `${directTradeLocationLabel} 직거래` : snapshot.shippingNote,
    },
    {
      label: "결제 수수료",
      value: "0원",
      note: `${marketplaceLabelForCard(card)} ${marketplacePaymentLabel(card)} 조건은 구매 전 재확인`,
    },
  ];
  const resellRows = [
    {
      label: isDaangn ? "재판매 수수료" : "안전결제 수수료",
      value: isDaangn ? "0원" : snapshot.sellingFee == null ? feeRateLabel : `${feeRateLabel} · ${krw(snapshot.sellingFee)}`,
      note: isDaangn ? "당근 직거래 재판매 기준" : "셀러가 부담 (시세 대비 차감)",
    },
    ...(snapshot.conditionAdjustment > 0
      ? [{
        label: "상태 보정",
        value: `-${krw(snapshot.conditionAdjustment)}`,
        note: "하자/누락/위생 chip 반영",
      }]
      : []),
    { label: "재배송비", value: krw(snapshot.resellShippingFee), note: isDaangn ? "직거래 재판매 가정" : "재판매 발송 시" },
    isDaangn
      ? { label: "직거래 리스크", value: "별도 확인", note: "네고·이동·거래 불발 가능성" }
      : { label: "안전버퍼", value: krw(snapshot.safetyBuffer), note: "분쟁/반품 등 예비비" },
  ];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(questions);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  // Wave 329: 헤드라인 expected_profit_average와 동일한 차익 사용 (배송비 등 모두 포함된 정확한 값).
  const guidance = buyPriceGuidance({
    price: card.price,
    currentProfit: expectedProfitAverage(card),
  });
  // Wave 325: verdict 4단계 (great/good/fair/tight). rose 제거 — 풀 매물은 다 안전 통과.
  const verdictClass = !guidance ? "" : (guidance.verdict === "great" || guidance.verdict === "good")
    ? "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
    : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  const profitFormula = snapshot.salePrice != null
    ? isDaangn
      ? `수익 기준 시세 ${snapshot.salePriceLabel}${snapshot.conditionAdjustment > 0 ? ` − 상태 보정 ${krw(snapshot.conditionAdjustment)}` : ""} − 매입 ${snapshot.buyerCostLabel}`
      : `수익 기준 시세 ${snapshot.salePriceLabel}${snapshot.conditionAdjustment > 0 ? ` − 상태 보정 ${krw(snapshot.conditionAdjustment)}` : ""} − 매입 ${snapshot.buyerCostLabel} − 비용`
    : `매입 ${snapshot.buyerCostLabel} − 비용 확인`;

  return (
    <section className="mt-3">
      {/* Wave 395.3: 최종 매입가도 PDF handoff처럼 독립 비용 카드로 재구성. */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_10px_26px_rgba(45,51,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="px-4 pb-3 pt-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold tracking-tight text-zinc-500 dark:text-zinc-400">
                최종 매입가 체크
              </div>
              <div className="mt-1 text-[22px] font-black leading-tight tracking-[-0.03em] text-[#17221d] dark:text-zinc-50">
                {snapshot.buyerCostLabel}
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${snapshot.confidenceClass}`}>
              {snapshot.confidenceLabel}
            </span>
          </div>
        </div>

        {/* Wave 394.7.h: 비용 분해 — 구매 / 재판매 그룹 분리. */}
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="mb-2 text-[10px] font-black tracking-wide text-[#1c64dd] dark:text-blue-300">
            구매 비용
          </div>
          <div className="space-y-3">
            {purchaseRows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[12px] font-extrabold leading-tight text-[#17221d] dark:text-zinc-100">
                    {row.label}
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium leading-tight text-[#aaa391] dark:text-zinc-500">
                    {row.note}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[12.5px] font-black tabular-nums tracking-tight text-[#17221d] dark:text-zinc-100">
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="mb-2 text-[10px] font-black tracking-wide text-[#9a9384] dark:text-zinc-400">
            리셀 비용
          </div>
          <div className="space-y-3">
            {resellRows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[12px] font-extrabold leading-tight text-[#17221d] dark:text-zinc-100">
                    {row.label}
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium leading-tight text-[#aaa391] dark:text-zinc-500">
                    {row.note}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[12.5px] font-black tabular-nums tracking-tight text-[#17221d] dark:text-zinc-100">
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-dashed border-[#e2d8c4] px-4 pb-4 pt-3 dark:border-zinc-700">
          <div className="text-[10.5px] font-semibold leading-4 text-zinc-500 dark:text-zinc-400">
            {profitFormula}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-[#b8e5ce] bg-[#effbf4] px-3 py-2.5 dark:border-blue-900/60 dark:bg-blue-950/30">
            <span className="text-[12px] font-black text-[#1c64dd] dark:text-blue-300">
              = 예상 차익
            </span>
            <span className="text-[14px] font-black tabular-nums tracking-tight text-[#1c64dd] dark:text-blue-300">
              {displayProfitRange(card)}
            </span>
          </div>
        </div>
      </div>

      <details className="group mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <span>문의 전 확인 3가지 (복붙)</span>
          <span className="text-zinc-400 transition group-open:rotate-45">+</span>
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs font-medium leading-5 text-zinc-700 dark:text-zinc-300">
          <li>{snapshot.shippingNote}</li>
          <li>플랫폼 결제 수수료를 누가 부담하는지</li>
          <li>구성품이 사진과 설명에 보이는 것 전부인지</li>
        </ol>
        <button
          type="button"
          onClick={handleCopy}
          className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {copied ? "복사됨" : "문장 복사"}
        </button>
      </details>

      {/* Wave 326: 협상 가이드 — 가격대별 의미 명시. "이 이상에 사면" 동사 명시 + 위험 구간(차익 1만 미만) 별도. */}
      {/* Wave 394.7.e: caps 단어 토막 → 친절 문장. */}
      {guidance ? (
        <div className="mt-4">
          {/* Wave 394.7.w (사용자 짚음): handoff 패턴 — 섹션 제목 카드 밖 + 우측 chip + 흰 카드 안에 rows */}
          <div className="mb-2 flex items-center justify-between gap-2 px-0">
            <h3 className="m-0 text-[16px] font-extrabold tracking-tight text-[#1a2620] dark:text-zinc-100">
              협상 가이드
            </h3>
            <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${verdictClass}`}>
              {guidance.verdictLabel}
            </span>
          </div>

          {/* 흰 카드 wrapper — rows 안에 */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="space-y-1.5">
            {/* 현재 매입가 — em row */}
            <div className="flex items-center gap-2.5 rounded-xl bg-blue-50 px-3 py-3 dark:bg-blue-950/30">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-blue-500 dark:bg-zinc-900">●</div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold leading-tight tracking-tight text-zinc-800 dark:text-zinc-100">
                  현재 매입가 <span className="ml-1 tabular-nums text-blue-700 dark:text-blue-300">{krw(card.price)}</span>
                </div>
              </div>
              <div className="text-[12px] font-bold tabular-nums tracking-tight text-blue-700 dark:text-blue-300">
                차익 +{krw(guidance.currentProfit)}
              </div>
            </div>


            {/* 협상 시도 — em row */}
            <div className="flex items-center gap-2.5 rounded-xl bg-blue-50 px-3 py-3 dark:bg-blue-950/30">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-blue-500 dark:bg-zinc-900">↓</div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold leading-tight tracking-tight text-zinc-800 dark:text-zinc-100">
                  협상 시도 <span className="ml-1 tabular-nums text-blue-700 dark:text-blue-300">{krw(guidance.negotiationTarget)}</span>
                </div>
              </div>
              <div className="text-[12px] font-bold tabular-nums tracking-tight text-blue-700 dark:text-blue-300">
                차익 +{krw(guidance.negotiationProfit)}
              </div>
            </div>
            <div className="pl-9 text-[10px] font-medium leading-tight text-zinc-500 dark:text-zinc-400">
              현재가 −{krw(guidance.negotiationRoom)} 깎기 (차익의 30% 또는 최대 2만원)
            </div>

            {/* 위험 구간 — amber row */}
            <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 px-3 py-3 dark:bg-amber-950/30">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-amber-600 dark:bg-zinc-900">!</div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold leading-tight tracking-tight text-zinc-800 dark:text-zinc-100">
                  약 <span className="tabular-nums">{(guidance.dangerStart / 10000).toFixed(1)}만원</span>~ 사면
                </div>
              </div>
              <div className="text-[12px] font-bold tabular-nums tracking-tight text-amber-700 dark:text-amber-300">
                차익 1만원 미만
              </div>
            </div>

            {/* 손해 구간 — rose row */}
            <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 px-3 py-3 dark:bg-rose-950/30">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-rose-600 dark:bg-zinc-900">×</div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold leading-tight tracking-tight text-zinc-800 dark:text-zinc-100">
                  약 <span className="tabular-nums">{(guidance.breakEven / 10000).toFixed(1)}만원</span>~ 사면
                </div>
              </div>
              <div className="text-[12px] font-bold tabular-nums tracking-tight text-rose-700 dark:text-rose-300">
                손해
              </div>
            </div>
          </div>
          </div>
          {/* verdict chip moved to header — handoff "차익 충분" 위치. */}
        </div>
      ) : null}

    </section>
  );
}

function LoadingStage({ completing = false }: { completing?: boolean }) {
  // Wave 76: 게이지/% 동기화 + 완료 시 100% 도달. 이전엔 transition-[width] lag로
  // 바와 텍스트 desync, server 응답 시 중간 % 상태에서 갑자기 카드 reveal 됐음.
  // completing=true면 현재 pct에서 100%로 ~350ms 사이 ease-in.
  const [pct, setPct] = useState(5);
  useEffect(() => {
    let rafId = 0;
    if (completing) {
      const startPct = pct;
      const FINISH_MS = 350;
      const startedAt = performance.now();
      const tick = () => {
        const elapsed = performance.now() - startedAt;
        const t = Math.min(1, elapsed / FINISH_MS);
        const eased = 1 - Math.pow(1 - t, 2);
        setPct(startPct + (100 - startPct) * eased);
        if (t < 1) rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
      return () => window.cancelAnimationFrame(rafId);
    }
    const startedAt = performance.now();
    const TARGET_MS = 4000;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      if (elapsed < TARGET_MS) {
        const t = elapsed / TARGET_MS;
        // ease-out cubic: 빠르게 시작, 천천히 도착
        const eased = 1 - Math.pow(1 - t, 3);
        setPct(5 + eased * 85);
      } else {
        // 4s 이후엔 90~95% 천천히 증가
        const overshoot = (elapsed - TARGET_MS) / 1000;
        setPct(Math.min(95, 90 + overshoot * 0.5));
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completing]);

  // 단계 라벨은 게이지 % 임계값 기반 (시간 기반 X → 게이지와 항상 일치)
  const stepIndex = pct < 25 ? 0 : pct < 50 ? 1 : pct < 75 ? 2 : 3;

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 animate-ping rounded-full bg-[var(--brand-accent)]/20" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-[var(--brand-accent)] to-[var(--brand-accent-strong)] shadow-lg shadow-[rgba(49,130,246,0.35)]" />
        <div className="absolute inset-5 flex items-center justify-center rounded-full bg-white text-[11px] font-black tabular-nums text-[var(--brand-accent-strong)] dark:bg-zinc-900 dark:text-zinc-100">
          {Math.round(pct)}%
        </div>
      </div>
      <div className="w-full max-w-xs">
        <div className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--brand-accent)] dark:text-zinc-300">
          LIVE ANALYSIS
        </div>
        <div className="mt-2 text-center text-xl font-black text-zinc-900 dark:text-zinc-50">AI가 상품을 분석중입니다</div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--brand-accent)] to-[var(--brand-accent-strong)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 min-h-[40px] text-center text-sm leading-5 text-zinc-500 transition dark:text-zinc-400">
          {LOADING_STEPS[stepIndex]}
        </div>
        <div className="mt-1 text-center text-xs text-zinc-400 dark:text-zinc-500">
          {/* Wave 394.1 (외부 review #19): "실시간 검증" → "최신 호가" — 호가는 추정 가능, 검증은 단정형. */}
          중고 마켓 최신 호가 · 시세 재계산 · 리스크 필터
        </div>
      </div>
    </div>
  );
}

function BookmarkGlyph({ saved, className }: { saved: boolean; className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={saved ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function RevealSaveButton({
  saved,
  visible,
  variant,
  onToggle,
}: {
  saved: boolean;
  visible: boolean;
  variant: "floating" | "sticky";
  onToggle: () => void;
}) {
  const label = saved ? "스크랩 저장됨" : "스크랩 저장";
  const floating = variant === "floating";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={saved}
      title={label}
      tabIndex={visible ? 0 : -1}
      data-scrap-save-button
      className={
        floating
          ? "pointer-events-auto inline-flex h-9 w-9 items-center justify-center text-white transition active:scale-90"
          : `pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90 ${
              saved
                ? "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/50"
                : "text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
            }`
      }
      style={floating ? { filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))" } : undefined}
    >
      <BookmarkGlyph saved={saved} className={floating ? "h-6 w-6" : "h-5 w-5"} />
    </button>
  );
}

function RevealReportShortcutButton({
  visible,
  variant,
  onClick,
}: {
  visible: boolean;
  variant: "floating" | "sticky";
  onClick: () => void;
}) {
  const floating = variant === "floating";
  const label = "매물 정보 제보";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      tabIndex={visible ? 0 : -1}
      data-report-shortcut-button
      className={
        floating
          ? "pointer-events-auto inline-flex h-9 w-9 items-center justify-center text-white transition active:scale-90"
          : "pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-900 transition hover:bg-zinc-100 active:scale-90 dark:text-zinc-100 dark:hover:bg-zinc-800"
      }
      style={floating ? { filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))" } : undefined}
    >
      <AlertTriangleIcon className="h-5 w-5" />
    </button>
  );
}

function BeginnerGuideProductVisual({ card }: { card: RevealCard }) {
  const condition = card.marketBasis?.conditionClass
    ? conditionFriendlyText(card.marketBasis.conditionClass)
    : marketConditionLabel(card);
  const comparableKey = card.marketBasis?.comparableKey ?? null;
  const conditionCategory = comparableKey?.startsWith("clothing|") ? "clothing" : "shoe";

  // 2026-05-26 (사용자 짚음 "사진 카드 두 겹 + 사진 작음"):
  //   기존: 외부 베이지 wrapper(#f3ede3) + 내부 흰 카드(rounded shadow) 두 겹.
  //   수정: 단일 사진 영역 (wrapper 통합) + 사이즈 키움 (h-166 → h-240).
  //   padding p-2.5 → p-1 로 사진 letterbox 줄임.
  return (
    <div
      data-beginner-guide-product-image
      className="relative -mx-5 mb-2 mt-[calc(env(safe-area-inset-top)+14px)] h-[240px] overflow-hidden bg-white shadow-[0_18px_36px_rgba(15,23,42,0.10)] ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800 sm:mx-0 sm:h-[280px] sm:rounded-[26px]"
    >
      {card.thumbnailUrl ? (
        <>
          <Image
            src={card.thumbnailUrl}
            alt={card.name}
            fill
            sizes="(max-width: 639px) 100vw, 640px"
            unoptimized
            className="object-contain object-center p-1"
            priority={false}
          />
          {/* Wave 751 (2026-05-25): 사진 위 우하단 카테고리 워터마크 배지. */}
          <CategoryWatermark
            comparableKey={card.marketBasis?.comparableKey ?? null}
            size={40}
            variant="corner"
          />
        </>
      ) : (
        // Wave 749 (2026-05-25): 카테고리 워터마크 placeholder.
        <div className="relative flex h-full w-full items-center justify-center">
          <CategoryWatermark
            comparableKey={card.marketBasis?.comparableKey ?? null}
            size={110}
          />
          <span className="pointer-events-none absolute bottom-5 text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
            사진 준비 중
          </span>
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-24px)] flex-col items-start gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-white/96 px-3 py-1 text-[11px] font-black tabular-nums text-zinc-950 shadow-sm backdrop-blur dark:bg-zinc-900/95 dark:text-zinc-100">
            매입 {krw(card.price)}
          </span>
          <span className="rounded-full bg-white/96 px-3 py-1 text-[11px] font-black text-[#4d6654] shadow-sm backdrop-blur dark:bg-zinc-900/95 dark:text-zinc-300">
            {condition}
          </span>
          {card.conditionTier ? (
            <ConditionTierChip
              tier={card.conditionTier}
              category={conditionCategory}
            />
          ) : null}
        </div>
        {card.conditionChips && card.conditionChips.length > 0 ? (
          <ConditionChipsList
            chips={card.conditionChips}
            max={3}
            className="rounded-full bg-white/90 px-1.5 py-1 shadow-sm backdrop-blur dark:bg-zinc-950/80"
          />
        ) : null}
      </div>
    </div>
  );
}

function BeginnerGuideConditionChipRow({ card }: { card: RevealCard }) {
  if (!card.conditionTier && (!card.conditionChips || card.conditionChips.length === 0)) return null;
  const comparableKey = card.marketBasis?.comparableKey ?? null;
  const conditionCategory = comparableKey?.startsWith("clothing|") ? "clothing" : "shoe";
  return (
    <div className="mt-3 rounded-[18px] bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-100 dark:bg-zinc-950/50 dark:ring-zinc-800">
      <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.10em] text-zinc-400">
        판매글 기준
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {card.conditionTier ? (
          <ConditionTierChip
            tier={card.conditionTier}
            showHelp
            category={conditionCategory}
          />
        ) : null}
        {card.conditionChips && card.conditionChips.length > 0 ? (
          <ConditionChipsList chips={card.conditionChips} max={5} />
        ) : null}
      </div>
    </div>
  );
}

// 2026-05-26 (사용자 짚음 "수익/매입가 가시성 0 — 한 줄 문장"):
//   tone="buy" step body 를 plain `<p>` 대신 3-grid 큰 숫자 카드로.
//   매입가 / 시세 / 예상순익 — 토스 스타일 굵은 숫자.
function BeginnerGuideBuyMetricGrid({ card }: { card: RevealCard }) {
  const marketPrice = card.marketBasis?.medianPrice && card.marketBasis.medianPrice > 0
    ? krw(card.marketBasis.medianPrice)
    : "—";
  return (
    <div className="mt-5 grid grid-cols-3 gap-2 rounded-[18px] bg-zinc-50 p-3 ring-1 ring-zinc-100 dark:bg-zinc-900/70 dark:ring-zinc-800">
      <div className="text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.10em] text-zinc-400">매입가</div>
        <div className="mt-1 break-keep text-[15px] font-black leading-[1.15] tabular-nums text-zinc-950 dark:text-zinc-50 sm:text-[17px]">
          {krw(card.price)}
        </div>
      </div>
      <div className="text-center border-x border-zinc-200 dark:border-zinc-800">
        <div className="text-[10px] font-black uppercase tracking-[0.10em] text-zinc-400">시세</div>
        <div className="mt-1 break-keep text-[15px] font-black leading-[1.15] tabular-nums text-zinc-700 dark:text-zinc-200 sm:text-[17px]">
          {marketPrice}
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.10em] text-[#3182f6]">예상 순익</div>
        <div className="mt-1 break-keep text-[15px] font-black leading-[1.15] tabular-nums text-[#3182f6] dark:text-blue-300 sm:text-[17px]">
          {displayProfitRange(card)}
        </div>
      </div>
    </div>
  );
}

function BeginnerGuideStarGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="m12 2.7 2.76 5.6 6.18.9-4.47 4.36 1.05 6.15L12 16.8l-5.52 2.9 1.05-6.14L3.06 9.2l6.18-.9L12 2.7Z"
      />
    </svg>
  );
}

function BeginnerGuideTrustBody({ card, fallback }: { card: RevealCard; fallback: string }) {
  const safety = marketplaceSafetyForCard(card);
  const rating = card.savedDetail?.sellerReviewRating ?? null;
  const reviewCount = card.savedDetail?.sellerReviewCount ?? 0;
  const reviewLabel = reviewCount.toLocaleString("ko-KR");
  const hasEnoughReviews = reviewCount >= SELLER_TRUST_MIN_REVIEW_COUNT;

  if (safety.isJoongna) {
    return (
      <p data-beginner-guide-trust-highlight className="mt-4 break-keep text-[16px] font-semibold leading-7 text-zinc-600 dark:text-zinc-300">
        {safety.sellerTrust.assessment}
      </p>
    );
  }

  if (rating == null || reviewCount <= 0) {
    return (
      <p className="mt-4 break-keep text-[16px] font-semibold leading-7 text-zinc-600 dark:text-zinc-300">
        {fallback}
      </p>
    );
  }

  if (!hasEnoughReviews) {
    return (
      <p data-beginner-guide-trust-highlight className="mt-4 break-keep text-[16px] font-semibold leading-7 text-zinc-600 dark:text-zinc-300">
        <span className="font-black text-[#172019] dark:text-zinc-50">
          평점은 <strong className="ml-1 text-[17px]">{rating.toFixed(1)}점</strong>
        </span>
        이지만{" "}
        <span className="font-black text-[#172019] dark:text-zinc-50">
          후기가 <strong className="ml-1 text-[17px]">{reviewLabel}건</strong>
        </span>
        이라 아직 판단 표본이 적어요. 안전결제와 실제 상태 확인을 더 보수적으로 보면 좋아요.
      </p>
    );
  }

  return (
    <p data-beginner-guide-trust-highlight className="mt-4 break-keep text-[16px] font-semibold leading-7 text-zinc-600 dark:text-zinc-300">
      이 상품 판매자는{" "}
      <span className="font-black text-[#172019] dark:text-zinc-50">
        후기가 <strong className="ml-1 text-[17px]">{reviewLabel}건</strong>
      </span>
      이고{" "}
      <span className="font-black text-[#172019] dark:text-zinc-50">
        평점이 <strong className="ml-1 text-[17px]">{rating.toFixed(1)}점</strong>
      </span>
      이라 신뢰 신호가 있는 편이에요.
    </p>
  );
}

function BeginnerGuideTrustMetric({ card }: { card: RevealCard }) {
  const safety = marketplaceSafetyForCard(card);
  const rating = card.savedDetail?.sellerReviewRating ?? null;
  const reviewCount = card.savedDetail?.sellerReviewCount ?? 0;
  const reviewLabel = reviewCount.toLocaleString("ko-KR");
  const hasRating = rating != null && Number.isFinite(rating);
  const starCount = hasRating ? Math.max(0, Math.min(5, Math.round(rating))) : 0;

  if (safety.isJoongna) {
    return (
      <div data-beginner-guide-trust-metric className="my-5 grid gap-0 divide-x divide-zinc-200 border-y border-zinc-200 py-4 dark:divide-zinc-800 dark:border-zinc-800 grid-cols-2">
        <div className="px-3">
          <div className="flex items-center gap-2 text-[12px] font-black text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#eefbf3] text-blue-700 dark:bg-blue-950/45 dark:text-blue-200">
              <ShieldIcon className="h-4 w-4" />
            </span>
            <span>신뢰지수</span>
          </div>
          <div className="mt-3 text-[26px] font-black leading-none tabular-nums text-[#172019] dark:text-zinc-50">
            {safety.sellerTrust.trustScore != null ? safety.sellerTrust.metric.replace("신뢰지수 ", "") : "확인 필요"}
          </div>
        </div>
        <div className="px-3">
          <div className="text-[12px] font-black text-zinc-500 dark:text-zinc-400">거래후기</div>
          <div className="mt-3 text-[26px] font-black leading-none tabular-nums text-[#172019] dark:text-zinc-50">
            {reviewLabel}건
          </div>
          {safety.sellerTrust.badgeLabel ? (
            <div className="mt-1 text-[11px] font-bold text-blue-700 dark:text-blue-300">
              {safety.sellerTrust.badgeLabel}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Wave 758 (2026-05-26): 당근 매너온도 metric — 후기/평점 대신 큰 °C 숫자로 표시.
  // Wave 759 (2026-05-26): 0.0°C 는 당근에서 실질적으로 안 나오는 값 (가입 즉시 36.5°C 시작).
  //   0 으로 박힌 건 스크래핑 실패 default → "정보 없음" 으로 fallback.
  if (safety.isDaangn) {
    const rawMannerTemp = safety.sellerTrust.mannerTemperature ?? null;
    const mannerTemp = rawMannerTemp != null && rawMannerTemp > 0 ? rawMannerTemp : null;
    if (mannerTemp != null) {
      const tier = mannerTemp >= 40 ? "high" : mannerTemp >= 36.5 ? "neutral" : mannerTemp >= 30 ? "low_avg" : "below_avg";
      const tierLabel = tier === "high" ? "신뢰 강함" : tier === "neutral" ? "평균 이상" : tier === "low_avg" ? "평균 미만" : "거래 보수적";
      const tierBg = tier === "high"
        ? "bg-[#eefbf3] text-blue-700 dark:bg-blue-950/45 dark:text-blue-200"
        : tier === "neutral"
          ? "bg-[#eefbf3] text-blue-700 dark:bg-blue-950/45 dark:text-blue-200"
          : tier === "low_avg"
            ? "bg-[#fff7e6] text-[#b7791f] dark:bg-amber-950/45 dark:text-amber-200"
            : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300";
      return (
        <div data-beginner-guide-trust-metric className="my-5 border-y border-zinc-200 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ${tierBg}`}>
              <ShieldIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-black text-zinc-500 dark:text-zinc-400">당근 매너온도</div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-[28px] font-black leading-none tabular-nums text-[#172019] dark:text-zinc-50">
                  {mannerTemp.toFixed(1)}°C
                </span>
                <span className="text-[12px] font-black text-zinc-600 dark:text-zinc-400">{tierLabel}</span>
              </div>
              <div className="mt-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                36.5°C 평균 · 위조 어려운 누적 평가
              </div>
            </div>
          </div>
        </div>
      );
    }
    // 매너온도 backfill 미완 — 안내 메시지
    return (
      <div data-beginner-guide-trust-metric className="my-5 border-y border-zinc-200 py-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff7e6] text-[#b7791f] ring-1 ring-[#f2dfbd] dark:bg-amber-950/35 dark:text-amber-200 dark:ring-amber-900/50">
            <AlertTriangleIcon className="h-6 w-6" />
          </span>
          <div>
            <div className="text-[15px] font-black text-[#172019] dark:text-zinc-50">당근 매너온도 정보 없음</div>
            <div className="mt-1 break-keep text-[12px] font-bold leading-5 text-[#7b8378] dark:text-zinc-400">
              당근 앱에서 셀러 프로필을 누르면 매너온도(0~99.9°C, 36.5°C 평균)를 직접 확인할 수 있어요.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasRating && reviewCount <= 0) {
    return (
      <div data-beginner-guide-trust-metric className="my-5 border-y border-zinc-200 py-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff7e6] text-[#b7791f] ring-1 ring-[#f2dfbd] dark:bg-amber-950/35 dark:text-amber-200 dark:ring-amber-900/50">
            <AlertTriangleIcon className="h-6 w-6" />
          </span>
          <div>
            <div className="text-[15px] font-black text-[#172019] dark:text-zinc-50">후기와 평점이 없어요</div>
            <div className="mt-1 break-keep text-[12px] font-bold leading-5 text-[#7b8378] dark:text-zinc-400">
              신규 판매자이거나 거래 이력이 적은 계정일 수 있어요.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-beginner-guide-trust-metric className={`my-5 grid gap-0 divide-x divide-zinc-200 border-y border-zinc-200 py-4 dark:divide-zinc-800 dark:border-zinc-800 ${hasRating ? "grid-cols-2" : "grid-cols-1"}`}>
      {hasRating ? (
        <div className="px-3">
          <div className="flex items-center gap-2 text-[12px] font-black text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#fff7e6] text-[#d5961d] dark:bg-amber-950/45 dark:text-amber-200">
              <BeginnerGuideStarGlyph className="h-4 w-4" />
            </span>
            <span>평점</span>
          </div>
          <div className="mt-3 flex items-end gap-1.5">
            <span className="text-[30px] font-black leading-none text-[#172019] dark:text-zinc-50">
              {rating.toFixed(1)}
            </span>
            <span className="pb-1 text-[13px] font-black text-[#7b8378] dark:text-zinc-400">/ 5.0</span>
          </div>
          <div aria-label={`평점 ${rating.toFixed(1)}점`} className="mt-2 flex gap-0.5 text-amber-400">
            {Array.from({ length: 5 }).map((_, index) => (
              <BeginnerGuideStarGlyph
                key={index}
                className={`h-3.5 w-3.5 ${index < starCount ? "opacity-100" : "opacity-18"}`}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="px-3">
        <div className="flex items-center gap-2 text-[12px] font-black text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#edf8f2] text-[#0f9f6e] dark:bg-blue-950/45 dark:text-blue-200">
            <TrophyIcon className="h-4 w-4" />
          </span>
          <span>후기</span>
        </div>
        <div className="mt-3 flex items-end gap-1.5">
          <span className="text-[30px] font-black leading-none text-[#172019] dark:text-zinc-50">
            {reviewLabel}
          </span>
          <span className="pb-1 text-[13px] font-black text-[#7b8378] dark:text-zinc-400">건</span>
        </div>
        <div className="mt-2 text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
          실제 거래 이력 기준
        </div>
      </div>
    </div>
  );
}

function BeginnerGuideMarketBody({ card, fallback }: { card: RevealCard; fallback: string }) {
  const market = card.marketBasis;
  const median = market?.medianPrice ?? null;
  const groupLabel = conditionComparisonGroupLabel(card);
  const productLabel = conditionProductLabel(card);

  if (median == null || median <= 0 || card.price <= 0) {
    return (
      <p className="mt-3 break-keep text-[15px] font-semibold leading-6 text-zinc-600 dark:text-zinc-300">
        {fallback}
      </p>
    );
  }

  const diff = median - card.price;
  const amount = krw(Math.abs(diff));
  const sourceLine = market?.priceSource === "reference"
    ? `새상품 기준가와 중고 마켓 ${groupLabel} 흐름을 같이 봤어요.`
    : `중고 마켓 ${groupLabel}끼리만 비교했어요.`;
  const verdict = diff > 0
    ? "싸요"
    : diff < 0
      ? "높아요"
      : "비슷해요";
  const toneClass = diff > 0
    ? "text-[#3182f6] dark:text-blue-300"
    : diff < 0
      ? "text-amber-700 dark:text-amber-200"
      : "text-[#172019] dark:text-zinc-50";

  return (
    <div data-beginner-guide-market-body className="mt-3 break-keep">
      <p className="text-[15px] font-semibold leading-6 text-zinc-600 dark:text-zinc-300">
        이 상품은 {productLabel}이에요. {sourceLine}
      </p>
      <p className="mt-2 text-[16px] font-black leading-6 text-[#172019] dark:text-zinc-50">
        기준보다 <strong className={`text-[19px] ${toneClass}`}>{amount}</strong> {verdict}.
      </p>
      <p className="mt-1.5 text-[12.5px] font-bold leading-5 text-[#7b8378] dark:text-zinc-400">
        아래는 비싼 순 비교 매물이에요.
      </p>
    </div>
  );
}

function BeginnerGuidePurchaseCheckVisual({ card }: { card: RevealCard }) {
  const [copied, setCopied] = useState(false);
  const checks = beginnerPurchaseChecks(card);
  const questions = sellerQuestionText(card);
  const toneClasses: Record<BeginnerPurchaseCheck["tone"], { icon: string; badge: string; card: string }> = {
    amber: {
      icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/55 dark:text-amber-200",
      badge: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/35 dark:text-amber-200 dark:ring-amber-900/55",
      card: "ring-amber-100 dark:ring-amber-900/45",
    },
    blue: {
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-950/55 dark:text-blue-200",
      badge: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/35 dark:text-blue-200 dark:ring-blue-900/55",
      card: "ring-blue-100 dark:ring-blue-900/45",
    },
    emerald: {
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-950/55 dark:text-blue-200",
      badge: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/35 dark:text-blue-200 dark:ring-blue-900/55",
      card: "ring-blue-100 dark:ring-blue-900/45",
    },
  };

  async function handleCopyQuestions() {
    try {
      await navigator.clipboard.writeText(questions);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div data-beginner-guide-purchase-check className="mt-4 space-y-2.5">
      {checks.map((check, index) => {
        const tone = toneClasses[check.tone];
        const Icon =
          check.id === "seller" || check.id === "lock" || check.id === "authenticity"
            ? ShieldIcon
            : check.id === "battery"
              ? ZapIcon
              : check.id === "photo" || check.id === "components"
                ? PackageIcon
                : CheckCircleIcon;

        return (
          <div key={check.id} className={`rounded-[20px] bg-white/86 p-3.5 ring-1 ${tone.card} dark:bg-zinc-950/60`}>
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.icon}`}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${tone.badge}`}>
                    {index + 1}. {check.label}
                  </span>
                  <h3 className="break-keep text-[14px] font-black leading-5 text-[#172019] dark:text-zinc-50">
                    {check.title}
                  </h3>
                </div>
                <p className="mt-1.5 break-keep text-[12px] font-semibold leading-5 text-[#657064] dark:text-zinc-400">
                  {check.body}
                </p>
                <div className="mt-2 break-keep rounded-[14px] bg-[#f5f7fb] px-3 py-2 text-[12px] font-black leading-5 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-200">
                  {check.ask}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="rounded-[20px] bg-[#172019] p-3.5 text-white shadow-[0_14px_30px_rgba(23,32,25,0.18)] dark:bg-zinc-100 dark:text-zinc-950">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/12 text-white dark:bg-zinc-950/10 dark:text-zinc-950">
            <CheckCircleIcon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="break-keep text-[14px] font-black leading-5">판매자에게 바로 물어볼 문구</div>
            <p className="mt-1 break-keep text-[12px] font-semibold leading-5 text-white/72 dark:text-zinc-700">
              사진, 구성품, 안전결제를 피하면 구매 보류로 보면 돼요.
            </p>
            <button
              type="button"
              onClick={handleCopyQuestions}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-[14px] bg-white px-3 text-[13px] font-black text-[#172019] transition active:scale-[0.99] dark:bg-zinc-950 dark:text-zinc-50"
            >
              {copied ? "복사됨" : "문의 문구 복사"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BeginnerGuideSpeedVisual({ card, analysisLoading = false }: { card: RevealCard; analysisLoading?: boolean }) {
  const speed = saleSpeedDisplay(card, { analysisLoading });
  const velocity = card.velocityBasis;
  const market = card.marketBasis;
  const sampleCount = Math.max(
    Number(velocity?.observedSoldSampleCount ?? 0),
    Number(velocity?.sold7dCount ?? 0),
    Number(market?.soldSampleCount ?? 0),
  );
  const dailySoldValue = velocity?.sold7dCount ? dailySoldCountLabel(velocity.sold7dCount) : null;
  const basisLabel = velocity?.conditionSpecific ? "같은 상태" : "같은 모델 전체";
  // Wave 394.7.ab: "확인 중" → "표본 부족" — 정직 카피.
  const speedValue = analysisLoading ? "확인 중" : speed.label;
  const sampleLabel = analysisLoading
    ? "분석 진행 중"
    : dailySoldValue ? "동일 모델 하루 판매량" : sampleCount > 0 ? "비슷한 거래 기록" : "거래 기록";
  const sampleValue = analysisLoading
    ? "잠시만요"
    : dailySoldValue ?? (sampleCount > 0 ? `${sampleCount.toLocaleString("ko-KR")}건` : "표본 부족");
  return (
    <div className="rounded-[22px] bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.07)] ring-1 ring-zinc-200 dark:bg-zinc-950/70 dark:ring-zinc-800">
      {/* Wave launch-72 (사용자 짚음 "약 8.7개 파란색이면 위계 흔들림"):
          title 의 숫자만 강조 (파란색). sub metric (visual) 은 default 색으로 — 위계 일관. */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[18px] bg-[#f5f9ff] px-3 py-3 ring-1 ring-blue-100 dark:bg-blue-950/24 dark:ring-blue-900/45">
          <div className="break-keep text-[11px] font-bold text-[#6f7b73] dark:text-zinc-400">되팔 때 판매 주기</div>
          <div className="mt-1 text-[20px] font-black leading-tight text-[#172019] dark:text-zinc-50">
            {speedValue}
          </div>
        </div>
        <div className="rounded-[18px] bg-[#f5f9ff] px-3 py-3 ring-1 ring-blue-100 dark:bg-blue-950/24 dark:ring-blue-900/45">
          <div className="break-keep text-[11px] font-bold text-[#6f7b73] dark:text-zinc-400">{sampleLabel}</div>
          <div className="mt-1 text-[20px] font-black leading-tight text-[#172019] dark:text-zinc-50">{sampleValue}</div>
        </div>
      </div>
      <p className="mt-2 break-keep text-[10.5px] font-semibold leading-4 text-zinc-500 dark:text-zinc-400">
        {analysisLoading
          ? "비교 기록을 가져오는 중이에요. 로딩이 끝난 뒤에도 표본이 부족한 경우에만 부족하다고 표시합니다."
          : `판매 주기는 ${basisLabel} 기준의 참고값이에요. 표본이 부족하면 모델 전체 기록으로 보수적으로 봅니다.`}
      </p>
    </div>
  );
}

function BeginnerGuideSummaryVisual({ card }: { card: RevealCard }) {
  const guidance = buyPriceGuidance({
    price: card.price,
    currentProfit: expectedProfitAverage(card),
  });
  const sampleCount = card.marketBasis?.sampleCount ?? 0;
  const checkCount = beginnerPurchaseChecks(card).length;
  const verdict =
    guidance?.verdict === "great" || guidance?.verdict === "good"
      ? "조건부 매수 가능"
      : guidance?.verdict === "fair"
        ? "협상 후 판단"
        : "보수적으로 판단";
  const items = [
    ["예상 순익", displayProfitRange(card)],
    ["최대 매입가", guidance ? krw(guidance.dangerStart) : "상세에서 확인"],
    ["비교 매물", sampleCount > 0 ? `${sampleCount.toLocaleString("ko-KR")}건` : "근거 확인"],
    ["확인 질문", `${checkCount}개`],
  ] as const;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/55 dark:text-blue-200 dark:ring-blue-900/60">
          <CheckCircleIcon className="h-11 w-11" />
        </div>
      </div>
      <div className="rounded-[22px] bg-white p-4 shadow-[0_16px_34px_rgba(15,23,42,0.07)] ring-1 ring-zinc-200 dark:bg-zinc-950/70 dark:ring-zinc-800">
        <div className="text-center text-[15px] font-black text-[#172019] dark:text-zinc-50">{verdict}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {items.map(([label, value]) => (
            <div key={label} className="rounded-[16px] bg-[#f5f7fb] px-3 py-2.5 dark:bg-zinc-900">
              <div className="text-[10.5px] font-bold text-[#7b8378] dark:text-zinc-400">{label}</div>
              <div className="mt-1 break-keep text-[14px] font-black leading-5 text-[#172019] dark:text-zinc-50">{value}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 break-keep text-center text-[12px] font-bold leading-5 text-[#667164] dark:text-zinc-400">
          이번에 정리한 근거는 상세 숫자 리포트에서 원본 매물과 계산값까지 이어서 볼 수 있어요.
        </p>
      </div>
    </div>
  );
}

function BeginnerGuideComparablePreview({ card }: { card: RevealCard }) {
  const [listings, setListings] = useState<ComparableListing[] | null>(null);
  const [listingScope, setListingScope] = useState<ComparableDisplayScope>("strict");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const ck = card.marketBasis?.comparableKey ?? null;
  const cc = card.marketBasis?.conditionClass ?? null;
  const INITIAL_VISIBLE = 4;
  const EXPANDED_VISIBLE = 8;
  // Wave launch-78 + launch-81: 신발/의류는 tier 우선, 아니면 옛 conditionClass.
  const ccLabel = (() => {
    if (isShoeOrClothingCard(card)) {
      const tierLabel = tierShortLabel(card.conditionTier);
      if (tierLabel) return tierLabel;
    }
    return conditionShortLabel(cc) ?? "비슷한 상태";
  })();

  useEffect(() => {
    if (!ck) return;
    let cancelled = false;
    setLoading(true);
    setExpanded(false);
    fetchMarketSourceComparables(card.pid)
      .then((j: { comparables?: ComparableListing[] }) => {
        if (cancelled) return;
        const selected = selectComparableDisplayListings(card, j.comparables ?? [], 16);
        setListings(selected.listings);
        setListingScope(selected.scope);
      })
      .catch(() => {
        if (!cancelled) setListings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ck, card, card.pid, card.marketplaceSource, card.marketBasis?.medianPrice, card.marketBasis?.p25Price, card.marketBasis?.p75Price]);

  if (!ck) {
    return (
      <div data-beginner-guide-comparables className="mt-4 rounded-[20px] bg-white/84 px-4 py-4 text-[13px] font-bold text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-950/60 dark:text-zinc-400 dark:ring-zinc-800">
        비교 매물은 아직 누적 중이에요.
      </div>
    );
  }

  const visibleListings = listings?.slice(0, expanded ? EXPANDED_VISIBLE : INITIAL_VISIBLE) ?? [];
  const moreCount = listings ? Math.max(0, Math.min(listings.length, EXPANDED_VISIBLE) - INITIAL_VISIBLE) : 0;

  return (
    <div data-beginner-guide-comparables className="mt-4 overflow-hidden rounded-[22px] bg-white/86 ring-1 ring-zinc-200 dark:bg-zinc-950/60 dark:ring-zinc-800">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="text-[13px] font-black text-[#172019] dark:text-zinc-50">비교 매물</div>
        <div className="text-[11px] font-bold text-[#7b8378] dark:text-zinc-400">{comparableScopeCopy(listingScope, ccLabel)}</div>
      </div>
      {loading ? (
        // Wave 394.7.aa (사용자 짚음): skeleton row 4개 — 디폴트 4개 보이는 것과 동일 shape.
        // 텍스트만 깜빡이면 layout shift 큼 + "비교 매물이 진짜 있나?" 의심. shape preview 가 신뢰 ↑.
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-12 w-12 shrink-0 animate-pulse rounded-[12px] bg-zinc-200 dark:bg-zinc-800" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 w-[80%] animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-2.5 w-[55%] animate-pulse rounded-full bg-zinc-200/70 dark:bg-zinc-800/70" />
              </div>
              <div className="h-4 w-14 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : !listings || listings.length === 0 ? (
        <div className="px-4 pb-4 text-[12px] font-bold text-[#7b8378] dark:text-zinc-400">표시 가능 비교 매물이 아직 없어요</div>
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {/* Wave launch-65 (사용자 정정 — 진짜 위치): 쉬운모드 1페이지 비교 매물 상단에
              "내 매물" row 박음. 사용자가 비교 매물 가격 vs 내 매물 매입가 즉시 비교 가능. */}
          {/* Wave 729 (2026-05-23): 모바일 360px 폭 layout 짤림 fix (스크린샷 보고). 상세 모드 (line 2672) 와 동일 패턴.
              min-w-0 + pill shrink-0 + truncate + 모바일 패딩 축소. */}
          {card.price > 0 ? (
            <div className="flex items-center gap-2.5 bg-[#fffbef] px-3 py-3 dark:bg-amber-950/20 sm:gap-3 sm:px-4">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[12px] bg-zinc-100 ring-2 ring-amber-300 dark:bg-zinc-800 dark:ring-amber-700 sm:h-12 sm:w-12">
                {card.thumbnailUrl ? (
                  <>
                    <Image src={card.thumbnailUrl} alt="" fill sizes="(max-width: 640px) 44px, 48px" unoptimized className="object-cover" />
                    {/* Wave 751 (2026-05-25): 카테고리 워터마크 배지. */}
                    <CategoryWatermark
                      comparableKey={card.marketBasis?.comparableKey ?? null}
                      size={16}
                      variant="corner"
                    />
                  </>
                ) : (
                  // Wave 749 (2026-05-25): 카테고리 워터마크 placeholder.
                  <CategoryWatermark
                    comparableKey={card.marketBasis?.comparableKey ?? null}
                    size={28}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9.5px] font-black text-white">내 매물</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-black text-[#172019] dark:text-zinc-100">
                    {card.name || "이 상품"}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] font-bold text-amber-700 dark:text-amber-300">매입가 기준</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[14px] font-black tabular-nums text-amber-700 dark:text-amber-300">{krw(card.price)}</div>
              </div>
            </div>
          ) : null}
          {/* Wave launch-81: 운영자풀 패턴 — `같은 등급(X급) > 인접 등급(±1) > 그 외 > 등급 정보 없음`.
              신발/의류 (ourTier 존재) 만 grouping. 옛 conditionClass 매물은 flat list. */}
          {(() => {
            const ourTier = isShoeOrClothingCard(card) ? (card.conditionTier ?? null) : null;
            const groups = groupListingsByTierDistance(ourTier, visibleListings);
            return groups.map((group) => (
              <div key={`g${group.distance}`}>
                {ourTier && group.heading ? (
                  <div className="bg-[#f8faf7] px-4 py-1.5 text-[10.5px] font-black uppercase tracking-wide text-[#7b8378] dark:bg-zinc-900/50 dark:text-zinc-400">
                    {group.heading} · {group.items.length}개
                  </div>
                ) : null}
                {group.items.map((item) => {
                  const diff = item.price - card.price;
                  const diffLabel = diff > 0 ? `이 매물보다 ${krw(diff)} 비쌈` : diff < 0 ? `이 매물보다 ${krw(Math.abs(diff))} 쌈` : "비슷한 가격";
                  const isSold = isComparableSold(item);
                  const itemConditionLabel = ourTier
                    ? tierShortLabel(item.conditionTier)
                    : conditionShortLabel(item.conditionClass);
                  const seenLabel = seenAgoLabel(item.lastSeenAt);
                  const sourceLabel = item.marketplaceLabel ?? null;
                  return (
                    <div key={item.pid} className="flex items-center gap-3 px-4 py-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-zinc-100 dark:bg-zinc-800">
                        {item.thumbnailUrl ? (
                          <>
                            <Image src={item.thumbnailUrl} alt="" fill sizes="48px" unoptimized className="object-cover" />
                            {/* Wave 751 (2026-05-25): 카테고리 워터마크 배지. */}
                            <CategoryWatermark
                              comparableKey={card.marketBasis?.comparableKey ?? null}
                              size={18}
                              variant="corner"
                            />
                          </>
                        ) : (
                          // Wave 749 (2026-05-25): 카테고리 워터마크 placeholder — 같은 SKU 비교 매물이므로 card 의 comparableKey 사용.
                          <CategoryWatermark
                            comparableKey={card.marketBasis?.comparableKey ?? null}
                            size={32}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="line-clamp-1 text-[12px] font-black text-[#172019] dark:text-zinc-100">{item.name || "비교 매물"}</span>
                          {itemConditionLabel ? (
                            <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9.5px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {itemConditionLabel}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-[11px] font-bold text-[#7b8378] dark:text-zinc-400">{diffLabel}</div>
                        {(sourceLabel || seenLabel) ? (
                          <div className="mt-0.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                            {sourceLabel ?? ""}{sourceLabel && seenLabel ? " · " : ""}{seenLabel ?? ""}
                          </div>
                        ) : null}
                        {item.conditionChips && item.conditionChips.length > 0 ? (
                          <ConditionChipsList
                            chips={item.conditionChips}
                            max={2}
                            className="mt-1 [&>span]:px-1.5 [&>span]:py-0.5 [&>span]:text-[9.5px]"
                          />
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        {isSold ? <div className="mb-0.5 text-[9px] font-black text-blue-600 dark:text-blue-300">판매완료</div> : null}
                        <div className="text-[14px] font-black tabular-nums text-[#172019] dark:text-zinc-100">{krw(item.price)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ));
          })()}
          {listings.length > INITIAL_VISIBLE ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="w-full px-4 py-2.5 text-center text-[11.5px] font-black text-[#3182f6] transition hover:bg-[#f5f9ff] dark:text-blue-300 dark:hover:bg-blue-950/20"
            >
              {expanded ? "접기 ↑" : `비교 매물 ${moreCount.toLocaleString("ko-KR")}개 더 보기 ↓`}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function BeginnerGuideMarketVisual({ card }: { card: RevealCard }) {
  return (
    <div data-beginner-guide-market-evidence>
      <BeginnerGuideComparablePreview card={card} />
    </div>
  );
}

function BeginnerGuideTrendVisual({ card }: { card: RevealCard }) {
  const groupLabel = conditionComparisonGroupLabel(card);
  // Wave launch-83: 데이터 부족 시 wrapper 자체 hide. 쉬운모드도 동일 정책.
  const [chartState, setChartState] = useState<MarketChartState>("loading");
  const showWrapper = chartState === "loading" || chartState === "available" || chartState === "reference_only";
  if (!showWrapper) return null;
  return (
    <div data-beginner-guide-market-trend className="mt-4 overflow-hidden rounded-[22px] bg-white/84 p-3 ring-1 ring-zinc-200 dark:bg-zinc-950/60 dark:ring-zinc-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[13px] font-black text-[#172019] dark:text-zinc-50">시세 그래프</div>
        <div className="text-[11px] font-bold text-[#7b8378] dark:text-zinc-400">{groupLabel} 30일 추이</div>
      </div>
      <MarketHistoryChart
        comparableKey={card.marketBasis?.comparableKey ?? null}
        currentPrice={card.price}
        conditionClass={card.marketBasis?.conditionClass ?? null}
        conditionTier={card.conditionTier ?? null}
        priceSource={card.marketBasis?.priceSource ?? null}
        basisSource={card.marketBasis?.basisSource ?? null}
        basisSourceLabel={card.marketBasis?.basisSourceLabel ?? null}
        referencePrice={card.marketBasis?.priceSource === "reference" ? card.marketBasis?.medianPrice ?? null : null}
        nullOnEmpty
        onState={setChartState}
      />
    </div>
  );
}

function BeginnerGuideBuyCostVisual({ card }: { card: RevealCard }) {
  const snapshot = costAssuranceSnapshot(card);
  const feeRateLabel = `${Math.round(SELLING_FEE_RATE * 1000) / 10}%`;
  const isDaangn = card.marketplaceSource === "daangn";
  const sellingFeeLabel = isDaangn ? "0원" : snapshot.sellingFee == null ? feeRateLabel : `${feeRateLabel} · ${krw(snapshot.sellingFee)}`;
  const marketPriceLabel = card.marketBasis?.medianPrice && card.marketBasis.medianPrice > 0
    ? krw(card.marketBasis.medianPrice)
    : snapshot.salePriceLabel;

  return (
    /* Wave launch-126 (2026-05-25): 토스식 정정 — "수익 계산 흐름" 큰 섹션 제거 (피로도). 단순 큰 숫자 + 2-col grid. */
    <div data-beginner-guide-final-money data-beginner-guide-buy-cost className="mt-5">
      <div
        data-beginner-guide-money-summary
        className="overflow-hidden rounded-[24px] bg-[#f5f9ff] p-5 dark:bg-blue-950/18"
      >
        <div className="text-[11px] font-black tracking-[0.04em] text-[#3182f6] dark:text-blue-300">예상 순익</div>
        {/* 큰 metric 숫자 — 토스 자산 표시 톤 */}
        <div className="mt-1.5 text-[36px] font-black leading-[1.02] tracking-tight text-emerald-700 tabular-nums dark:text-emerald-300">
          {displayProfitRange(card)}
        </div>
        <div className="mt-2 break-keep text-[12.5px] font-semibold leading-5 text-[#667164] dark:text-zinc-400">
          {isDaangn
            ? "당근 수수료 0원, 재배송비 0원 직거래 기준이에요. 네고·이동 리스크는 별도 확인하세요."
            : "구매 배송비, 판매 수수료, 재배송비, 안전버퍼 다 빼고 본 값이에요."}
        </div>

        {/* 매입가 + 시세 2-col grid — 단순 */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-[16px] bg-white px-3.5 py-3 dark:bg-zinc-950/60">
            <div className="text-[10.5px] font-black text-[#7b8378] dark:text-zinc-500">매입가</div>
            <div className="mt-1.5 break-all text-[16px] font-black leading-tight tabular-nums text-[#172019] dark:text-zinc-50">{krw(card.price)}</div>
          </div>
          <div className="rounded-[16px] bg-white px-3.5 py-3 dark:bg-zinc-950/60">
            <div className="text-[10.5px] font-black text-[#7b8378] dark:text-zinc-500">시세</div>
            <div className="mt-1.5 break-all text-[16px] font-black leading-tight tabular-nums text-[#172019] dark:text-zinc-50">{marketPriceLabel}</div>
          </div>
        </div>

        {/* 신뢰도 + 수수료 정보 — 작은 footnote */}
        <div className="mt-4 flex items-center justify-between gap-3 text-[11px] font-semibold text-[#7b8378] dark:text-zinc-500">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${snapshot.confidenceClass}`}>
            {snapshot.confidenceLabel}
          </span>
          <span className="text-right tabular-nums">
            {snapshot.conditionAdjustment > 0
              ? `상태 보정 -${krw(snapshot.conditionAdjustment)} 포함`
              : isDaangn
                ? `당근 수수료 ${sellingFeeLabel} · 직거래 기준`
                : `수수료 ${sellingFeeLabel} · 재배송·버퍼 +${krw(snapshot.resellShippingFee + snapshot.safetyBuffer)}`}
          </span>
        </div>
      </div>
    </div>
  );
}

function BeginnerGuideSafetyVisual({ card }: { card: RevealCard }) {
  const marketplace = marketplaceLabelForCard(card);
  const payment = marketplacePaymentLabel(card);
  const rows = [
    ["원본 앱 안 결제", `외부 계좌이체 대신 ${marketplace} ${payment} 조건 확인`],
    ["멈춰야 할 요청", "선입금, 외부 링크, 외부 메신저, 입금자명 변경 요청이면 보류"],
  ];

  return (
    <div data-beginner-guide-safe-payment className="mt-5 rounded-[22px] bg-white/84 p-4 ring-1 ring-[#d7e6d5] dark:bg-zinc-950/60 dark:ring-blue-900/40">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">
          <ShieldIcon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-[14px] font-black text-[#172019] dark:text-zinc-50">플랫폼 결제 조건 확인</div>
          <div className="mt-0.5 text-[11px] font-bold text-[#7b8378] dark:text-zinc-400">보장으로 단정하지 않고 원본 조건을 마지막 확인</div>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {rows.map(([title, body], index) => (
          <div key={title} className="flex gap-3 rounded-[16px] bg-zinc-50 px-3 py-3 dark:bg-zinc-900">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-blue-700 ring-1 ring-blue-100 dark:bg-zinc-950 dark:text-blue-200 dark:ring-blue-900/50">
              {index + 1}
            </span>
            <div>
              <div className="text-[13px] font-black text-[#172019] dark:text-zinc-50">{title}</div>
              <div className="mt-0.5 break-keep text-[12px] font-semibold leading-5 text-[#667164] dark:text-zinc-400">{body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BeginnerGuideChannelVisual({ card }: { card: RevealCard }) {
  const market = card.marketBasis;
  // Wave launch-67 (사용자 짚음 "차익 다 같음 무슨 버그"):
  //   marketBasis 가 lazy-fill (별도 API /api/packs/pool/analysis) — 처음엔 null.
  //   null 이면 marketplaceFee=0 → 모든 채널 같은 값 (=base) 표시. 버그.
  //   가드: medianPrice 없으면 채널 비교 X (시세 확보 후 표시).
  if (!market?.medianPrice || market.medianPrice <= 0) return null;

  const bunjangProfit = sourceAwareProfitAverage(card, "bunjang");
  const joongnaProfit = sourceAwareProfitAverage(card, "joongna");
  const daangnProfit = sourceAwareProfitAverage(card, "daangn");
  const preferDaangn = daangnProfit > Math.max(bunjangProfit, joongnaProfit);
  const currentSource = card.marketplaceSource === "daangn" ? "daangn" : card.marketplaceSource === "joongna" ? "joongna" : "bunjang";
  // Wave launch-67 (사용자 짚음 "chip 위계 + 구매자 수수료 중고나라 더 부담인데"):
  //   chip = 결제 시스템 (위계 1). note = 수수료 정보 (위계 2).
  //   joongna note 에 구매자 fee 도 같이 표시 — 매물 가격 인상 effect (구매자가 위에 얹어서).
  const marketChannels = [
    { source: "bunjang", label: "번개장터", profit: bunjangProfit, note: `판매자 ${Math.round(SELLING_FEE_RATE * 1000) / 10}% 수수료`, chip: "번개페이" },
    { source: "joongna", label: "중고나라", profit: joongnaProfit, note: `판매자 ${Math.round(JOONGNA_SELLER_SAFE_PAYMENT_FEE_RATE * 100)}% · 구매자 ${Math.round(JOONGNA_BUYER_SAFE_PAYMENT_FEE_RATE * 1000) / 10}% 별도`, chip: "안심결제" },
  ];

  return (
    <div data-beginner-guide-channel-profit className="mt-4 space-y-3">
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        {marketChannels.map((channel) => (
          <div key={channel.source} className="relative min-w-0 rounded-[16px] bg-white/84 px-2 py-2.5 ring-1 ring-zinc-200 dark:bg-zinc-950/60 dark:ring-zinc-800 sm:rounded-[22px] sm:p-4">
            {channel.source === currentSource ? (
              <div className="absolute right-1.5 top-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[8px] font-black text-blue-700 dark:bg-blue-950/45 dark:text-blue-200 sm:right-3 sm:top-3 sm:px-2 sm:text-[9px]">
                원본 출처
              </div>
            ) : null}
            <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              {channel.source === "bunjang" ? (
                <BunjangLogo className="h-6 w-6 rounded-full sm:h-7 sm:w-7" />
              ) : (
                <JoongnaLogo className="h-6 w-6 rounded-full sm:h-7 sm:w-7" />
              )}
              <div className="text-[10.5px] font-black leading-tight text-[#172019] dark:text-zinc-50 sm:text-[13px]">{channel.label}</div>
            </div>
            <div className="mt-2 text-[15px] font-black leading-tight tabular-nums text-blue-700 dark:text-blue-300 sm:mt-3 sm:text-[22px]">+{krw(channel.profit)}</div>
            {/* Wave launch-68 (사용자 짚음 "chip 수직 위치 다 다름"):
                joongna note 2줄 → chip 아래로 밀림. note 영역 mobile/desktop 둘 다 fixed height. */}
            <div className="mt-1 flex min-h-[28px] items-start break-keep text-[9px] font-bold leading-[1.35] text-[#7b8378] dark:text-zinc-400 sm:min-h-[34px] sm:text-[11px]">{channel.note}</div>
            <div className="mt-2 rounded-full bg-blue-50 px-1.5 py-1 text-center text-[9px] font-black text-blue-700 dark:bg-blue-950/35 dark:text-blue-200 sm:mt-3 sm:px-2.5 sm:text-[11px]">{channel.chip}</div>
          </div>
        ))}
        <div className="relative min-w-0 rounded-[16px] bg-amber-50/80 px-2 py-2.5 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:ring-amber-900/55 sm:rounded-[22px] sm:p-4">
          {currentSource === "daangn" ? (
            <div className="absolute right-1.5 top-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[8px] font-black text-blue-700 dark:bg-blue-950/45 dark:text-blue-200 sm:right-3 sm:top-3 sm:px-2 sm:text-[9px]">
              원본 출처
            </div>
          ) : null}
          <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <DaangnLogo className="h-6 w-6 rounded-full sm:h-7 sm:w-7" />
            <div className="text-[10.5px] font-black leading-tight text-[#172019] dark:text-zinc-50 sm:text-[13px]">당근 직거래</div>
          </div>
          <div className="mt-2 text-[15px] font-black leading-tight tabular-nums text-amber-700 dark:text-amber-200 sm:mt-3 sm:text-[22px]">+{krw(daangnProfit)}</div>
          <div className="mt-1 flex min-h-[28px] items-start break-keep text-[9px] font-bold leading-[1.35] text-[#7b8378] dark:text-zinc-400 sm:min-h-[34px] sm:text-[11px]">수수료 0원 가정</div>
          <div className="mt-2 rounded-full bg-white/80 px-1.5 py-1 text-center text-[9px] font-black text-amber-700 ring-1 ring-amber-100 dark:bg-zinc-950/60 dark:text-amber-200 dark:ring-amber-900/50 sm:mt-3 sm:px-2.5 sm:text-[11px]">지역/네고 부담</div>
        </div>
      </div>
      <div className="rounded-[18px] bg-[#f5f9ff] px-3.5 py-3 ring-1 ring-blue-100 dark:bg-blue-950/24 dark:ring-blue-900/45">
        <div className="text-[13px] font-black text-[#172019] dark:text-zinc-50">
          추천: {preferDaangn ? "당근 먼저 등록" : "중고 마켓 먼저 등록"}
        </div>
        <p className="mt-1 break-keep text-[12px] font-semibold leading-5 text-[#667164] dark:text-zinc-400">
          {preferDaangn
            ? "수익은 더 높지만 지역 제한과 네고 부담이 있어요. 안 팔리면 번개장터·중고나라로 넓히면 됩니다."
            : "전국 거래가 더 맞는 매물이에요. 안전결제 수수료까지 뺀 숫자로 봅니다."}
        </p>
      </div>
    </div>
  );
}

function BeginnerGuideStepVisual({ card, tone, analysisLoading = false }: { card: RevealCard; tone: BeginnerGuideStep["tone"]; analysisLoading?: boolean }) {
  if (tone === "intro") return null;
  if (tone === "trust") return <BeginnerGuideProductVisual card={card} />;
  if (tone === "check") return <BeginnerGuidePurchaseCheckVisual card={card} />;
  if (tone === "market") return <BeginnerGuideMarketVisual card={card} />;
  if (tone === "trend") return <BeginnerGuideTrendVisual card={card} />;
  if (tone === "buy") return <BeginnerGuideBuyCostVisual card={card} />;
  if (tone === "safety") return <BeginnerGuideSafetyVisual card={card} />;
  if (tone === "channel") return <BeginnerGuideChannelVisual card={card} />;
  if (tone === "speed") return <BeginnerGuideSpeedVisual card={card} analysisLoading={analysisLoading} />;
  return <BeginnerGuideSummaryVisual card={card} />;
}

function BeginnerGuideContextNote({ note, tone }: { note?: string; tone: BeginnerGuideStep["tone"] }) {
  if (!note) return null;
  return (
    <p
      data-beginner-guide-context-note
      className={`${tone === "summary" ? "mx-auto mt-5 max-w-[340px] text-center" : "mt-3"} break-keep text-[13px] font-semibold leading-5 text-[#667064] dark:text-zinc-400`}
    >
      {note}
    </p>
  );
}

function formatBeginnerStatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

const BEGINNER_CATEGORY_LABELS: Record<string, string> = {
  earphone: "이어폰/헤드폰 제품",
  smartphone: "폰",
  tablet: "태블릿",
  smartwatch: "스마트워치",
  laptop: "노트북",
  shoe: "신발",
  bag: "가방",
  clothing: "의류",
};

function compactBeginnerSkuLabel(card: RevealCard) {
  if (/airpods\s*max/i.test(card.skuName) || /에어팟\s*맥스|에어팟맥스/i.test(card.name)) return "에어팟 맥스";
  const withoutParen = card.skuName.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (withoutParen && withoutParen.length <= 18) return withoutParen;
  const category = categoryForBeginnerGuide(card);
  return category ? BEGINNER_CATEGORY_LABELS[category] ?? "비슷한 상품" : "비슷한 상품";
}

function beginnerSafetyStatsUrl(card: RevealCard, scope: "category" | "precise" = "precise") {
  const params = new URLSearchParams();
  const category = categoryForBeginnerGuide(card);
  if (scope === "precise") {
    if (card.skuId) params.set("skuId", card.skuId);
    if (card.marketBasis?.comparableKey) params.set("comparableKey", card.marketBasis.comparableKey);
  }
  if (category) params.set("category", category);
  const query = params.toString();
  return query ? `/api/public/safety-stats?${query}` : "/api/public/safety-stats";
}

function beginnerSafetyStatRows(stats: BeginnerGuideSafetyStats) {
  const rows = [
    { label: "돈 안 되는 것", value: (stats.profit_low_7d ?? 0) + (stats.stat_missing_7d ?? 0) },
    { label: "사기 의심", value: (stats.fake_or_lock_7d ?? 0) + (stats.suspicious_price_7d ?? 0) },
    { label: "무슨 상품인지 애매", value: stats.needs_review_7d ?? 0 },
    { label: "단품·구성품 애매", value: (stats.listing_parts_7d ?? 0) + (stats.listing_accessory_7d ?? 0) + (stats.listing_multi_7d ?? 0) },
  ];

  return rows.filter((row) => row.value > 0).slice(0, 3);
}

function BeginnerGuideSafetyFilterNote({ card, variant = "inline" }: { card: RevealCard; variant?: "intro" | "inline" }) {
  const [stats, setStats] = useState<BeginnerGuideSafetyStats | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [introLoadingHold, setIntroLoadingHold] = useState(variant === "intro");
  const statsUrl = beginnerSafetyStatsUrl(card, variant === "intro" ? "category" : "precise");

  useEffect(() => {
    if (stats || loadFailed) return;

    const controller = new AbortController();

    const loadStats = async () => {
      const fetchStats = async (url: string) => {
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error("safety stats failed");
        const payload = await res.json() as { stats?: BeginnerGuideSafetyStats };
        return payload.stats ?? null;
      };

      const scopedStats = await fetchStats(statsUrl);
      if ((scopedStats?.total_blocked_7d ?? 0) > 0 || statsUrl === "/api/public/safety-stats") {
        return scopedStats;
      }
      return fetchStats("/api/public/safety-stats");
    };

    void loadStats()
      .then((nextStats) => {
        if (!controller.signal.aborted) setStats(nextStats);
      }).catch((err) => {
        if (controller.signal.aborted) return;
        console.warn("[beginner-guide] safety stats unavailable", err instanceof Error ? err.message : err);
        setLoadFailed(true);
      });

    return () => controller.abort();
  }, [loadFailed, stats, statsUrl]);

  useEffect(() => {
    if (variant !== "intro" || stats || loadFailed) {
      setIntroLoadingHold(false);
      return;
    }
    setIntroLoadingHold(true);
    const timer = window.setTimeout(() => setIntroLoadingHold(false), 760);
    return () => window.clearTimeout(timer);
  }, [loadFailed, stats, variant]);

  const totalBlocked = stats?.total_blocked_7d ?? 0;
  const totalReviewed = stats?.total_reviewed_7d ?? 0;
  const rows = stats ? beginnerSafetyStatRows(stats) : [];
  const scopedSubject = variant !== "intro" && (stats?.scope?.level === "lane" || stats?.scope?.level === "sku")
    ? `${compactBeginnerSkuLabel(card)} 매물 중`
    : stats?.scope?.level === "category" && stats.scope.category
      ? `${BEGINNER_CATEGORY_LABELS[stats.scope.category] ?? "비슷한 상품"} 중`
      : null;
  const subjectLabel = scopedSubject ?? "전체 추천 풀에서";

  if (variant === "intro") {
    if (introLoadingHold && !stats && !loadFailed) {
      return (
        <div
          data-beginner-guide-safety-filter-note
          data-beginner-guide-safety-loading
          className="mt-6 overflow-hidden rounded-[28px] bg-white px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#ece4d7] dark:bg-zinc-950/70 dark:ring-zinc-800"
        >
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f2f7ff] text-[#3182f6] ring-1 ring-blue-100 dark:bg-blue-950/35 dark:text-blue-300 dark:ring-blue-900/45">
              <span className="absolute h-11 w-11 animate-ping rounded-full bg-[#3182f6]/10" />
              <ShieldIcon className="relative h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="break-keep text-[14px] font-black leading-5 text-[#172019] dark:text-zinc-50">
                오늘 추천 풀을 먼저 훑고 있어요
              </div>
              <div className="mt-1 text-[12px] font-bold text-[#7b8378] dark:text-zinc-400">
                돈 안 되는 매물을 거르는 중
              </div>
            </div>
          </div>
          <div className="mt-5 space-y-2.5">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-center justify-between gap-4 rounded-[16px] bg-[#faf7f1] px-3.5 py-3 dark:bg-zinc-900/70">
                <span className="h-3.5 w-28 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <span className="h-4 w-14 animate-pulse rounded-full bg-[#dce9ff] dark:bg-blue-950/50" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    const showFallbackTotal = !stats || totalBlocked <= 0;
    const displayRows = rows.length > 0 ? rows : [
      { label: "돈 안 되는 것", value: null },
      { label: "사기 의심", value: null },
      { label: "무슨 상품인지 애매", value: null },
    ];

    return (
      <div
        data-beginner-guide-safety-filter-note
        className="mt-6 rounded-[28px] bg-white px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#ece4d7] dark:bg-zinc-950/70 dark:ring-zinc-800"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f2f7ff] text-[#3182f6] ring-1 ring-blue-100 dark:bg-blue-950/35 dark:text-blue-300 dark:ring-blue-900/45">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="break-keep text-[14px] font-black leading-5 text-[#172019] dark:text-zinc-50">
              득템잡이가 오늘 {subjectLabel}
            </div>
            <div className="mt-1 text-[12px] font-bold text-[#7b8378] dark:text-zinc-400">
              {totalReviewed > 0 ? `후보 ${formatBeginnerStatCount(totalReviewed)}건 중 먼저 걸러낸 매물` : "먼저 걸러낸 매물"}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {showFallbackTotal ? null : displayRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 rounded-[16px] bg-[#faf7f1] px-3.5 py-3 dark:bg-zinc-900/70">
              <span className="break-keep text-[14px] font-bold text-zinc-600 dark:text-zinc-300">{row.label}</span>
              <span className="shrink-0 text-[18px] font-black tabular-nums text-[#172019] dark:text-zinc-50">
                {row.value == null ? "확인 중" : `${formatBeginnerStatCount(row.value)}건`}
              </span>
            </div>
          ))}
          {showFallbackTotal ? (
            <div className="rounded-[16px] bg-[#f5f9ff] px-3.5 py-3 ring-1 ring-blue-100 dark:bg-blue-950/24 dark:ring-blue-900/45">
              <div className="text-[12px] font-bold text-[#6f7b73] dark:text-zinc-400">오늘 걸러낸 매물 수</div>
              <div className="mt-1 text-[22px] font-black tabular-nums text-[#3182f6] dark:text-blue-300">확인 중</div>
            </div>
          ) : null}
        </div>

        <p className="mt-4 break-keep text-[13px] font-semibold leading-5 text-zinc-500 dark:text-zinc-400">
          그래서 이제 이 매물만 차례대로 보면 돼요.
        </p>
      </div>
    );
  }

  if (!stats || totalBlocked <= 0) return null;

  const leadingCopy = scopedSubject
    ? `오늘 ${scopedSubject} 돈 안 되는 것`
    : "오늘 돈 안 되는 매물";

  return (
    <div
      data-beginner-guide-safety-filter-note
      className="mt-4 rounded-[24px] bg-[#f7fafe] px-4 py-4 ring-1 ring-blue-100 dark:bg-blue-950/18 dark:ring-blue-900/45"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#3182f6] ring-1 ring-blue-100 dark:bg-zinc-950/60 dark:text-blue-300 dark:ring-blue-900/45">
          <ShieldIcon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="break-keep text-[14px] font-bold leading-6 text-[#38443d] dark:text-zinc-200">
            {leadingCopy}{" "}
            <strong className="font-black text-[#172019] dark:text-zinc-50">{formatBeginnerStatCount(totalBlocked)}건</strong>
            을 먼저 걸렀어요.
          </p>
          <p className="mt-1 break-keep text-[12.5px] font-semibold leading-5 text-[#6a756b] dark:text-zinc-400">
            이제 이 매물만 보면 돼요.
          </p>
        </div>
      </div>
    </div>
  );
}

function BeginnerGuideWalkthrough({
  card,
  stepIndex,
  analysisLoading = false,
  onNext,
  onPrev,
  onSkip,
  onClose,
}: {
  card: RevealCard;
  stepIndex: number;
  analysisLoading?: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const steps = beginnerGuideSteps(card, { analysisLoading });
  const safeIndex = Math.max(0, Math.min(stepIndex, steps.length - 1));
  const step = steps[safeIndex];
  const isLast = safeIndex === steps.length - 1;
  const canGoPrev = safeIndex > 0;

  // Wave 394.7.y (사용자 피드백): 좌우 swipe gesture — 토스 톤. threshold 50px, vertical scroll 차단 X.
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    // 가로 ↑↑ 세로보다 + 빠른 swipe + 최소 거리 50px
    if (Math.abs(dx) < 50) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return; // 수직 스크롤 우선
    if (dt > 600) return;
    if (dx < 0 && !isLast) onNext();
    else if (dx > 0 && canGoPrev) onPrev();
  };
  const isSummary = step.tone === "summary";
  const guidePrimaryButtonClass = "bg-[#3182f6] hover:bg-[#1c6fe8]";
  const toneClasses: Record<BeginnerGuideStep["tone"], { bg: string; text: string; ring: string }> = {
    intro: {
      bg: "bg-[#f2f7ff]",
      text: "text-[#3182f6]",
      ring: "ring-blue-100",
    },
    trust: {
      bg: "bg-[#eef6ec]",
      text: "text-[#2f6440]",
      ring: "ring-[#cfe3ca]",
    },
    check: {
      bg: "bg-amber-50",
      text: "text-amber-800",
      ring: "ring-amber-100",
    },
    market: {
      bg: "bg-sky-50",
      text: "text-sky-700",
      ring: "ring-sky-100",
    },
    trend: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      ring: "ring-blue-100",
    },
    buy: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      ring: "ring-blue-100",
    },
    resell: {
      bg: "bg-amber-50",
      text: "text-amber-800",
      ring: "ring-amber-100",
    },
    safety: {
      bg: "bg-[#eef6ec]",
      text: "text-[#2f6440]",
      ring: "ring-[#cfe3ca]",
    },
    channel: {
      bg: "bg-orange-50",
      text: "text-orange-700",
      ring: "ring-orange-100",
    },
    speed: {
      bg: "bg-amber-50",
      text: "text-amber-800",
      ring: "ring-amber-100",
    },
    summary: {
      bg: "bg-zinc-50",
      text: "text-zinc-900",
      ring: "ring-zinc-200",
    },
  };
  const toneClass = toneClasses[step.tone];
  // Wave launch-71 (사용자 짚음 "똑같은말 반복하지 말라고"):
  //   speed tone 도 default metric block 표시 X — BeginnerGuideSpeedVisual 이 이미 sub metric 2개
  //   표시 (되팔 때 판매 주기 / 동일 모델 하루 판매량). default metric 까지 박으면 "7.1일" 3번 표시.
  //   title 의 자연 문장 + visual 의 sub metric = 2 layer 로 충분.
  const showDefaultMetric = false;
  const showNote = step.tone === "safety";

  return (
    <section
      data-beginner-guide-fullscreen
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      /* Wave launch-29: BeginnerGuide 풀스크린도 PC 에서 더 크게 (부모 모달 100% 차지). */
      className="relative h-[100dvh] overflow-hidden bg-white px-5 pt-0 dark:bg-zinc-900 sm:h-full sm:rounded-[22px] sm:px-6"
    >
      <style>{`
        @keyframes minyoiGuideStepIn {
          from { opacity: 0; transform: translateY(12px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-beginner-guide-step] { animation: none !important; }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto flex w-full max-w-[640px] items-start justify-between px-3 pt-[calc(env(safe-area-inset-top)+10px)] sm:px-0 sm:pt-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="pointer-events-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/88 text-zinc-950 shadow-[0_6px_18px_rgba(15,23,42,0.12)] ring-1 ring-zinc-200 backdrop-blur transition active:scale-95 dark:bg-zinc-950/84 dark:text-zinc-100 dark:ring-zinc-800"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        {/* Wave 394.7.y (사용자 피드백): dot indicator + N/N 텍스트 hybrid — 토스 톤. */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/82 px-2.5 py-1 shadow-[0_5px_16px_rgba(15,23,42,0.08)] ring-1 ring-zinc-200 backdrop-blur dark:bg-zinc-950/80 dark:ring-zinc-800">
          <div className="flex items-center gap-[3px]">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-[5px] rounded-full transition-all duration-200 ${
                  i === safeIndex
                    ? "w-3 bg-[#3182f6] dark:bg-[#5a9cff]"
                    : i < safeIndex
                      ? "w-[5px] bg-blue-300 dark:bg-zinc-500"
                      : "w-[5px] bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] font-black tabular-nums text-zinc-500 dark:text-zinc-300">
            {safeIndex + 1}/{steps.length}
          </span>
        </div>
      </div>

      <div className="mx-auto flex h-full w-full max-w-[640px] flex-col">
        <div
          key={safeIndex}
          data-beginner-guide-step
          /* Wave launch-126 (2026-05-25): buy step 매물 사진 위로 (4페이지 trust 사진 이동). pt-0 적용. */
          className={`flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+126px)] animate-[minyoiGuideStepIn_240ms_ease-out] ${step.tone === "buy" ? "pt-0" : "pt-[calc(env(safe-area-inset-top)+52px)] sm:pt-16"}`}
        >
          {/* Wave launch-126: buy step 위에 매물 사진 (구 trust 의 ProductVisual). trust 는 사진 제거. */}
          {step.tone === "buy" ? <BeginnerGuideProductVisual card={card} /> : null}

          <div className={step.tone === "buy" ? "mt-4" : isSummary ? "flex flex-1 flex-col items-center justify-center text-center" : ""}>
            {isSummary ? <BeginnerGuideStepVisual card={card} tone={step.tone} analysisLoading={analysisLoading} /> : null}
            {!isSummary ? (
              <div className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${toneClass.bg} ${toneClass.text} ring-1 ${toneClass.ring}`}>
                {step.eyebrow}
              </div>
            ) : null}
            {/* Wave launch-71 (사용자 짚음 "토스식 가시적 강조"):
                title 안 숫자/금액 부분 자동 파란색 강조. 패턴: "N일", "N시간", "₩N", "N원", "+N%", "N%".
                토스 스타일 — 핵심 metric 만 색으로 띄움. 다른 단어는 그대로. */}
            <h2 className={`${isSummary ? "mt-7 max-w-[280px]" : "mt-3"} break-keep text-[24px] font-black leading-[1.16] text-[#172019] dark:text-zinc-50 sm:text-[28px]`}>
              {highlightMetricsInText(step.title)}
            </h2>
            {step.tone === "trust" ? <BeginnerGuideConditionChipRow card={card} /> : null}
            {step.tone === "trust" ? (
              <BeginnerGuideTrustBody card={card} fallback={step.body} />
            ) : step.tone === "market" ? (
              <BeginnerGuideMarketBody card={card} fallback={step.body} />
            ) : step.tone === "buy" ? (
              // 2026-05-26: tone="buy" 1페이지 — 매입가/시세/순익 grid 카드 (한 줄 문장 대체).
              <BeginnerGuideBuyMetricGrid card={card} />
            ) : step.body ? (
              <p className="mt-3 break-keep text-[15px] font-semibold leading-6 text-zinc-600 dark:text-zinc-300">
                {step.body}
              </p>
            ) : null}

            <BeginnerGuideContextNote note={step.valueNote} tone={step.tone} />

            {step.tone === "trust" ? (
              <BeginnerGuideTrustMetric card={card} />
            ) : showDefaultMetric ? (
              <div className="my-4 border-y border-zinc-200 py-4 dark:border-zinc-800">
                <div className={`text-[30px] font-black leading-none ${toneClass.text}`}>
                  {step.metric}
                </div>
                <div className="mt-2 break-keep text-[13px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
                  {step.metricLabel}
                </div>
              </div>
            ) : null}

            {showNote ? (
              <p className="mt-3 break-keep rounded-[16px] bg-zinc-50 px-3.5 py-2.5 text-[12px] font-semibold leading-5 text-zinc-500 dark:bg-zinc-950/50 dark:text-zinc-400">
                {step.note}
              </p>
            ) : null}
          </div>

          {/* Wave launch-126: buy step 사진 이미 위에 박혔으니 아래 visual skip. trust 도 사진 제거 (위로 이동). */}
          {step.tone !== "trust" && step.tone !== "buy" && !isSummary ? <BeginnerGuideStepVisual card={card} tone={step.tone} analysisLoading={analysisLoading} /> : null}

        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 bg-[linear-gradient(180deg,rgba(255,255,255,0),#ffffff_26%)] pb-[calc(env(safe-area-inset-bottom)+8px)] pt-6 dark:bg-[linear-gradient(180deg,rgba(24,24,27,0),#18181b_26%)]">
        <div className="mx-auto w-full max-w-[640px] px-5 sm:px-6">
          <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={!canGoPrev}
              className="flex min-h-[50px] items-center justify-center rounded-[17px] bg-white/92 px-3 text-[15px] font-black text-zinc-950 ring-1 ring-zinc-200 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35 dark:bg-zinc-950/70 dark:text-zinc-100 dark:ring-zinc-800"
            >
              이전
            </button>
            <button
              type="button"
              onClick={onNext}
              className={`flex min-h-[50px] items-center justify-center rounded-[17px] px-4 text-[16px] font-black text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] transition active:scale-[0.99] ${guidePrimaryButtonClass}`}
            >
              {/* Wave 394.7.y: 마지막 step CTA 행동 지시 — "이 매물 자세히 보기" */}
              {isLast ? "이 매물 자세히 보기" : "다음"}
            </button>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="mx-auto mt-2 flex min-h-9 items-center justify-center px-3 text-[12px] font-black text-[#7b8378] underline-offset-4 hover:text-zinc-950 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            상세 숫자 리포트 보기
          </button>
        </div>
      </div>
    </section>
  );
}

function RevealCardItem({
  card,
  delay,
  analysisLoading = false,
  currentFeedbackType,
  photoRef,
  onBeginnerGuideClick,
  reportPanelRef,
  reportShortcutSignal,
}: {
  card: RevealCard;
  delay: number;
  analysisLoading?: boolean;
  currentFeedbackType?: string | null;
  photoRef?: React.RefObject<HTMLDivElement | null>;
  onBeginnerGuideClick?: () => void;
  reportPanelRef?: RefObject<HTMLDivElement | null>;
  reportShortcutSignal?: number;
}) {
  const [shown, setShown] = useState(false);
  // Wave 394.5.a (외부 review #23 — 사용자 명시 채택): 초보/상세 모드 토글.
  // 디폴트 = simple (메모리 룰 일반인 친화). detailed = "디테일 펼침" (이미 있는 정보 더 자세히).
  // localStorage 기억 — 한 번 선택하면 다음 모달도 자동.
  // 본질 = 일반인 친화 단일 톤 유지 + "더 자세히 보고 싶은 사용자" 옵션. 전문가 통계 도구 X (별 wave).
  const [mode, setMode] = useState<"simple" | "detailed">("simple");
  const profitCalculationRef = useRef<HTMLDivElement | null>(null);
  const isMarketInvalidated = Math.min(card.expectedProfitMin, card.expectedProfitMax) <= 0;
  const isDaangn = card.marketplaceSource === "daangn";
  const netPct = netProfitPercent(card);
  // Wave 394.7.f (외부 review 2라운드 #3): brand 가품 위험 큰 카테고리는 "조건부 매입 OK".
  // 사용자 짚음 — "매입 OK + 가품 위험 큼" 충돌. 정품 확인 필요 명시.
  const verdictCategory = categoryFromComparableKey(card.marketBasis?.comparableKey ?? null);
  const verdictBrandDepth = detectBrandDepth(verdictCategory, {
    skuId: card.skuId ?? null,
    skuName: card.skuName ?? null,
    name: card.name ?? null,
  });
  const hasHighCounterfeitRisk = verdictBrandDepth?.brand.counterfeitRisk === "high";
  // Wave 394.6.a (외부 review #1): 차익 헤드라인 옆 verdict chip — "3초 안에 사라/말아라/협상" 답.
  // buyPriceGuidance.verdict 4-tier (great/good/fair/tight) → 3-tier 단순화 (사용자 일반인 친화).
  const verdictGuidance = !isMarketInvalidated
    ? buyPriceGuidance({ price: card.price, currentProfit: expectedProfitAverage(card) })
    : null;
  // Wave launch-3: 단일 출처 VERDICT_LABELS 사용 (admin/user/modal 3 화면 통일).
  const verdictUi = verdictGuidance ? verdictUiLabel(verdictGuidance.verdict) : null;
  const verdictTier = !verdictUi
    ? null
    : {
        // counterfeit 위험 시 "조건부" 접두 (em verdict 한정)
        label: hasHighCounterfeitRisk && verdictUi.tone === "em" ? `조건부 ${verdictUi.card}` : verdictUi.card,
        cls: verdictUi.tone === "em"
          ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
          : verdictUi.tone === "amber"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
      };
  const profitCardClass = isMarketInvalidated
    ? "border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100 shadow-[0_10px_28px_rgba(45,51,42,0.08)] dark:border-rose-900/50 dark:from-rose-950/30 dark:to-zinc-950 dark:shadow-none"
    : "border-blue-200 bg-gradient-to-br from-[#f3faf5] to-[#e6f4ec] shadow-[0_10px_28px_rgba(45,51,42,0.08)] dark:border-blue-900/50 dark:from-blue-950/22 dark:to-zinc-950 dark:shadow-none";
  // Wave launch-117b (2026-05-24): 수익 = emerald (light+dark, 사용자 정정).
  const profitToneClass = isMarketInvalidated ? "text-rose-800 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300";
  const profitChipClass = isMarketInvalidated
    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
    : "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200";
  const profitMutedClass = "text-zinc-500 dark:text-zinc-400";
  const profitStrongClass = "text-zinc-900 dark:text-zinc-100";
  // Wave 2026-05-19 v2: grossGap, dailyProfit 표시 제거 (일반인 헷갈림 / 노이즈 큼).
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);
  // Wave 394.5.a: localStorage 기억 mount sync.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MODAL_MODE_STORAGE_KEY);
      if (stored === "detailed") setMode("detailed");
    } catch {}
  }, []);
  useEffect(() => {
    const handleModeChanged = (event: Event) => {
      const nextMode = (event as CustomEvent<{ mode?: "simple" | "detailed" }>).detail?.mode;
      if (nextMode === "simple" || nextMode === "detailed") setMode(nextMode);
    };
    window.addEventListener("minyoi:modal-mode-changed", handleModeChanged);
    return () => window.removeEventListener("minyoi:modal-mode-changed", handleModeChanged);
  }, []);
  const showProfitCalculationBasis = useCallback(() => {
    setMode("detailed");
    try { localStorage.setItem(MODAL_MODE_STORAGE_KEY, "detailed"); } catch {}
    window.requestAnimationFrame(() => {
      profitCalculationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  return (
    <div
      className={`grid gap-3 transition-all duration-700 ${
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      {/* 좌측 영역 — 매물 정보 (image + 메타 + verdicts + 노트 + 버튼) */}
      {/* Wave 394.7.x (사용자 짚음): 큰 wrapper 카드 제거 — handoff 처럼 각 섹션 평평하게.
       * 이전엔 cream gradient + border + shadow 로 ProfitHero ~ SellHelper 다 묶었는데
       * 그 안 ProfitHero 초록이 크게 보여 "전체 초록 박스" 처럼 보였음. wrapper 자체를 없애고
       * 각 panel 이 페이지 배경 위 평평하게 배치. */}
      <div className="order-1 grid gap-0 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none ring-0 dark:bg-transparent">
        <div ref={photoRef}>
          <RevealProductImage card={card} />
        </div>

        <div className="relative z-10 -mt-4 min-w-0 w-full space-y-3 rounded-t-[22px] bg-[#f5f7fb] px-4 pb-2 pt-7 dark:bg-zinc-900">
          <div className="absolute left-1/2 top-2 h-1 w-9 -translate-x-1/2 rounded-full bg-[#d0c6b1]" />
          <div className="space-y-1.5">
            <div className="relative">
              <div className="pr-[92px] text-[10.5px] font-semibold leading-4 text-zinc-500 dark:text-zinc-400">
                <span className="mr-1.5 inline-flex align-middle">
                  <MarketplaceSourceBadge source={card.marketplaceSource} label={card.marketplaceLabel} />
                </span>
                {/* Wave 886.13 (2026-05-27): 당근 매물은 source badge 옆 동네 inline 표시 (거리 제약 핵심 정보). */}
                {isDaangn && card.savedDetail?.directTradeLocation ? (
                  <span className="mr-1.5 inline-flex items-center gap-0.5 align-middle text-orange-700 dark:text-orange-300">
                    <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5" aria-hidden="true">
                      <path d="M6 1a3.5 3.5 0 0 0-3.5 3.5c0 2.625 3.5 6.5 3.5 6.5s3.5-3.875 3.5-6.5A3.5 3.5 0 0 0 6 1zm0 4.7a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4z" />
                    </svg>
                    {card.savedDetail.directTradeLocation}
                  </span>
                ) : null}
                AI 판단 · 매물 설명(텍스트) 기준 · 사진은 직접 확인 권장
              </div>
              <div className="absolute right-0 top-[-2px]">
                <DealMeterButton card={card} />
              </div>
            </div>
            <div className="flex w-full items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {/* Wave 392.2: 신선도 강조 — 매우 신선 매물 즉시 인지 + Pro USP hint. */}
                <div className="hidden">
                  <LastVerifiedAtBadge card={card} />
                </div>
                {/* Wave 714s (2026-05-23): 상세보기 매물명 위 등급 chip + chips. 데이터 없으면 hide. */}
                {(card.conditionTier || (card.conditionChips && card.conditionChips.length > 0)) && (
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {card.conditionTier && (
                      <ConditionTierChip
                        tier={card.conditionTier}
                        showHelp
                        category={card.marketBasis?.comparableKey?.startsWith("clothing|") ? "clothing" : "shoe"}
                      />
                    )}
                    {card.conditionChips && card.conditionChips.length > 0 && (
                      <ConditionChipsList chips={card.conditionChips} max={6} />
                    )}
                  </div>
                )}
                {/* Wave 359+361: 득템 점수 — 제목과 같은 행 우측 작게 (당근 36.8°C 톤). */}
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 line-clamp-2 pr-[92px] text-[20px] font-black leading-[1.25] tracking-[-0.01em] text-[#111915] dark:text-zinc-50">
                    {card.name}
                  </div>
                  <div className="hidden">
                    <DealMeterButton card={card} />
                  </div>
                </div>
                {/* Wave 886.13 (2026-05-27): 당근 매물 거래 가능 동네 강조 chip — 거리 제약 핵심 정보. */}
                {isDaangn && card.savedDetail?.directTradeLocation ? (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11.5px] font-bold text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300">
                    <svg viewBox="0 0 14 14" fill="currentColor" className="h-3 w-3 shrink-0" aria-hidden="true">
                      <path d="M7 1a4 4 0 0 0-4 4c0 3 4 7.5 4 7.5s4-4.5 4-7.5a4 4 0 0 0-4-4zm0 5.4a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8z" />
                    </svg>
                    <span>거래 가능 동네: {card.savedDetail.directTradeLocation}</span>
                  </div>
                ) : null}
                {onBeginnerGuideClick ? (
                  <button
                    type="button"
                    onClick={onBeginnerGuideClick}
                    data-beginner-guide-reopen
                    className="mx-auto mt-3 flex min-h-10 w-full max-w-[180px] items-center justify-center gap-1.5 rounded-full border border-[#d7e6d5] bg-white/86 px-4 text-[12px] font-black text-[#1c64dd] shadow-sm transition hover:bg-[#f3faf5] active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-950/70 dark:text-blue-300 dark:hover:bg-zinc-900"
                  >
                    <ShieldIcon className="h-3.5 w-3.5" />
                    <span>쉽게 보기</span>
                  </button>
                ) : null}
                <PurchaseDecisionHeader card={card} />
              {/* Wave 395.1: PDF처럼 "예상 순익 + 계산식/비교매물 보기"만 독립 카드로 분리. */}
              <div
                className={`relative mt-3.5 overflow-hidden rounded-[18px] border px-3.5 pb-3 pt-3.5 ${profitCardClass}`}
              >
                <div className={`pointer-events-none absolute -right-3 -top-3 text-[76px] font-black leading-none opacity-[0.05] ${profitToneClass}`}>
                  ₩
                </div>

                {/* Eyebrow — left "예상 순익" + right "{age} · 비교 N개". launch-60: 사용자 메모리 룰 (이모지 치워라). */}
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className={`whitespace-nowrap text-[10px] font-extrabold uppercase tracking-[0.16em] ${profitToneClass}`}>예상 순익</span>
                  <span className={`whitespace-nowrap text-[11px] font-semibold ${profitMutedClass}`}>
                    {uploadAgoLabel(card.firstSeenAt) ?? freshLabel(card.freshSeconds)}
                    {(card.marketBasis?.sampleCount ?? 0) > 0 ? ` · 비교 ${card.marketBasis?.sampleCount}개` : ""}
                  </span>
                </div>

                {/* 큰 차익 */}
                <div className={`mb-2 text-[22px] font-black leading-[1.12] tracking-[-0.02em] tabular-nums ${profitToneClass}`}>
                  {displayProfitRange(card)}
                </div>

                {/* Chips — handoff Chip tone em (#e6f4ec / #1c64dd) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {netPct != null ? (
                    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${profitChipClass}`}>
                      {netPct >= 0 ? "+" : ""}{netPct}%
                    </span>
                  ) : null}
                  {verdictTier ? (
                    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${profitChipClass}`}>
                      {verdictTier.label}
                    </span>
                  ) : null}
                  {isMarketInvalidated ? (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                      {holdChipText(card)}
                    </span>
                  ) : null}
                </div>

                {/* 매입 · 시세 line */}
                <div className={`mt-2 whitespace-nowrap text-[11px] font-semibold tabular-nums ${profitMutedClass}`}>
                  매입 <span className={`font-extrabold ${profitStrongClass}`}>{krw(card.price)}</span>
                  {card.marketBasis?.medianPrice && card.marketBasis.medianPrice > 0 ? (
                    <> · 시세 <span className={`font-extrabold ${profitStrongClass}`}>{krw(card.marketBasis.medianPrice)}</span></>
                  ) : (
                    <> · <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">시세 확인중</span></>
                  )}
                  {card.optionBaseAssumed && card.optionBaseAssumed.length > 0 ? (
                    <> · <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">기본 옵션 가정</span></>
                  ) : null}
                </div>
                {isDaangn && card.marketBasis?.medianPrice && card.marketBasis.medianPrice > 0 ? (
                  <div className={`mt-1 text-[10.5px] font-bold leading-4 ${profitMutedClass}`}>
                    당근 수수료 0원 · 직거래 기준
                  </div>
                ) : null}

                {/* 큰 흰 버튼 — 계산 근거 토글. 비교 매물은 바로 아래 독립 섹션에서 전담. */}
                <button
                  type="button"
                  onClick={showProfitCalculationBasis}
                  className={`mt-3.5 flex w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2.5 text-[13px] font-extrabold transition active:scale-[0.99] ${
                    isMarketInvalidated
                      ? "border-rose-200 bg-white text-rose-800 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-zinc-950/70 dark:text-rose-200 dark:hover:bg-rose-950/20"
                      : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:bg-zinc-950/70 dark:text-blue-200 dark:hover:bg-blue-950/20"
                  }`}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  <span>수익 계산 근거 보기</span>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-90 transition">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>

              </div>

              {/* Wave launch-83 (사용자 결정): 데이터 부족 placeholder 안내 박스 보이는 게
                  미완성 사이트 인상 → 빈 상태면 섹션 전체 hide. DetailMarketGraphSection 내부에서
                  MarketHistoryChart 의 onState 콜백으로 데이터 여부 추적 + wrapper 가시성 제어. */}
              <DetailMarketGraphSection card={card} />

              {/* Wave 395.2: 비교 매물은 Profit 카드 안이 아니라 PDF처럼 별도 섹션/리스트 카드로 분리. */}
              <ComparableListingsPanel card={card} mode={mode} />
              {/* Wave 392+393.2: "왜 싸지" 작은 inline note — 보조 정보 톤. */}
              <WhyCheapPanel card={card} />
              <UpperFoldFearReducers card={card} analysisLoading={analysisLoading} />
              {/* Wave 394.6.b (외부 review #7): 정보 순서 재정렬 — 사용자 판단 흐름 따름.
                  "1. 사도 되나 → 2. 얼마 남나 → 3. 데이터 믿을 만? → 4. 위험? → 5. 깎기 → 6. 어디 팔까".
                  가품/리스크 위로 (구매 결정 핵심), 채널 비교 아래로 (판매 결정). */}
              <CounterfeitChecklistPanel card={card} />
              <div ref={profitCalculationRef} data-profit-calculation-basis className="scroll-mt-14">
                <CostAssurancePanel card={card} />
              </div>
              {/* Wave launch-84 (사용자 정정 — MVP audit): WhyTrustCollapse 4 Q&A 제거.
                  - 셀러 신뢰 Q → UpperFoldFearReducers 거래 안전 타일과 중복
                  - 가품 Q → CounterfeitChecklistPanel 과 100% 중복
                  - 안전결제 Q → PlatformProfitCompare 안심결제 chip 과 중복
                  - 사기 신고 Q → 의사결정 무관 (일반 FAQ)
                  컴포넌트 정의는 두고 호출만 제거 (rollback 쉽도록). */}
              {/* Wave 394.6.b: 채널 비교 → SellHelper 위 (둘 다 "판매" 관련 단위). */}
              <PlatformProfitCompare card={card} />
              {/* Wave 393.6: SellerTrustPanel 제거 — UpperFoldFearReducers 셀러 tile +
                  WhyTrustCollapse Q&A에 셀러 정보 이미 있음. 3중 중복 해소. */}
              <SellHelperPanel card={card} currentFeedbackType={currentFeedbackType} />
              <RecommendationReasonPanel
                card={card}
                className="mt-2 border-t border-[#e1dacd] pt-2"
              />
              {/* Wave launch-103+현재: 매물 잘못 신고 → 운영자 검토 → +20 크레딧.
                  하단 prominent section 유지 + 상단 신고 shortcut 은 이 섹션을 자동으로 연다.
                  매물 ID 자동 부착 (운영자가 어떤 매물 issue 인지 즉시 확인). */}
              <FeedbackReportPanel card={card} openSignal={reportShortcutSignal} panelRef={reportPanelRef} />
            </div>
            {/* Wave 394.5.c: detailed 모드 시 신뢰도 분해 자동 펼침 (사용자 재닫음 가능). */}
            <details
              open={mode === "detailed"}
              className="hidden"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-zinc-400">
                  <span>신뢰</span>
                  <span className="text-zinc-300 transition group-open:rotate-180 dark:text-zinc-500">▾</span>
                </div>
                <div className="text-sm font-black text-[#314238] dark:text-zinc-100">
                  {Math.round(card.confidence * 100)}%
                </div>
              </summary>
              <ConfidenceBreakdown card={card} />
            </details>
          </div>
          </div>

        <div className="hidden">
          <VerdictBadgesMini card={card} />
        </div>

        {/* 2026-05-16 (사용자 코멘트 #110 후속): 헷갈림 안내 — Lightning vs USB-C 가격 동일 같은 사실. */}
        {/* catalog Sku.confusionNote 그대로 표시. 사용자가 매물 보고 헷갈리면 즉시 답. */}
        {card.confusionNote ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            {card.confusionNote}
          </div>
        ) : null}

        {/* 시세 근거 (요약) — desktop/tablet 카드. mobile은 "왜 이 상품을 추천했나요?" 안으로 접어 첫 화면 밀도를 낮춤. */}
        <div className="hidden">
          <MarketBasisMini card={card} />
        </div>
      </div>
      </div>
      {/* 좌측 카드 닫음 — 우측 카드 = 시세 그래프 + 디테일. */}

    </div>
  );
}

function GuidePreviewPanel({
  card,
  guide,
  loading,
  error,
  onClose,
}: {
  card: RevealCard;
  guide: ModelGuide | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="flex max-h-[calc(100vh-24px)] items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl shadow-[rgba(49,130,246,0.16)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-sm font-semibold text-zinc-500 dark:text-zinc-300">공략 정보를 정리하는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex max-h-[calc(100vh-24px)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-[rgba(49,130,246,0.16)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex min-h-0 w-full flex-col">
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-sm font-black text-[var(--brand-accent-strong)] dark:text-zinc-100">공략 정보를 아직 불러오지 못했어요</div>
            <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{error}</p>
          </div>
          <div className="p-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-center text-sm font-bold text-[var(--brand-accent-strong)] transition hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ModelGuidePanel
      guide={guide}
      cardName={card.name}
      onClose={onClose}
    />
  );
}

function ModalActionFooter({
  card,
  onFeedback,
  currentFeedbackType,
  onReportLoss,
  alreadyReportedLoss,
}: {
  card: RevealCard;
  onFeedback: (pid: number, feedbackType: RevealFeedbackType, note?: string) => void;
  currentFeedbackType?: string | null;
  onReportLoss?: (card: RevealCard) => void;
  alreadyReportedLoss?: boolean;
}) {
  const [localStatus, setLocalStatus] = useState<TransactionFeedbackType | null>(
    isTransactionFeedbackType(currentFeedbackType) ? currentFeedbackType : null,
  );

  useEffect(() => {
    setLocalStatus(isTransactionFeedbackType(currentFeedbackType) ? currentFeedbackType : null);
  }, [currentFeedbackType, card.pid]);

  function handleTransactionFeedback(type: TransactionFeedbackType, note: string) {
    setLocalStatus(type);
    onFeedback(card.pid, type, note);
  }

  const statusLabel = localStatus ? TRANSACTION_STATUS_LABEL[localStatus] : "진행 전";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <div className="flex items-center gap-1.5">
          <details className="group relative min-w-0 flex-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-[#d8d2c6] bg-white/85 px-2.5 py-1.5 text-[11px] font-bold text-[#425247] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
              <span>거래 상태</span>
              <span className="truncate text-[var(--brand-accent-strong)] dark:text-zinc-200">{statusLabel}</span>
            </summary>
            <div className="absolute inset-x-0 bottom-[calc(100%+8px)] z-20 rounded-xl border border-[#e1dacd] bg-white p-2 shadow-2xl shadow-[rgba(49,130,246,0.18)] dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#758174] dark:text-zinc-400">
                  거래 상태
                </span>
                <span className="text-[11px] font-bold text-[var(--brand-accent-strong)] dark:text-zinc-200">
                  {statusLabel}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {TRANSACTION_ACTIONS.map((action) => {
                  const active = localStatus === action.type;
                  return (
                    <button
                      key={action.type}
                      type="button"
                      onClick={() => handleTransactionFeedback(action.type, action.note)}
                      className={`rounded-lg border px-2 py-2 text-[11px] font-black transition ${
                        active
                          ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-sm shadow-[rgba(49,130,246,0.18)]"
                          : "border-[#d8d2c6] bg-white text-[#425247] hover:border-blue-200 hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {action.label}
                    </button>
                  );
                })}
              </div>
              {isPostBuyFeedbackType(localStatus) && (
                <div className="mt-2 border-t border-[#ebe4d8] pt-2 dark:border-zinc-800">
                  <div className="mb-1.5 text-[10px] font-bold text-[#758174] dark:text-zinc-400">
                    매수 후 진행
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {POST_BUY_ACTIONS.map((action) => {
                      const active = localStatus === action.type;
                      return (
                        <button
                          key={action.type}
                          type="button"
                          onClick={() => handleTransactionFeedback(action.type, action.note)}
                          className={`rounded-lg border px-2 py-2 text-[11px] font-black transition ${
                            active
                              ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-sm shadow-[rgba(49,130,246,0.18)]"
                              : "border-[#d8d2c6] bg-white text-[#425247] hover:border-blue-200 hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </details>
          {onReportLoss && (
            <button
              type="button"
              onClick={() => onReportLoss(card)}
              disabled={alreadyReportedLoss}
              title={alreadyReportedLoss ? "이미 신고됨 — 운영자 검수 진행 중" : "부정확 정보 신고하기 — 승인 시 토큰 +3"}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
                alreadyReportedLoss
                  ? "cursor-not-allowed border-zinc-300 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                  : "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
              }`}
            >
              {alreadyReportedLoss ? "신고됨" : "오류 신고"}
            </button>
          )}
        </div>
      </div>

      <div className="hidden">
        <div className="mb-2 rounded-xl border border-[#e1dacd] bg-white/85 p-2 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#758174] dark:text-zinc-400">
              거래 상태
            </span>
            <span className="text-[11px] font-bold text-[var(--brand-accent-strong)] dark:text-zinc-200">
              {localStatus ? TRANSACTION_STATUS_LABEL[localStatus] : "아직 진행 전"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {TRANSACTION_ACTIONS.map((action) => {
              const active = localStatus === action.type;
              return (
                <button
                  key={action.type}
                  type="button"
                  onClick={() => handleTransactionFeedback(action.type, action.note)}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-black transition ${
                    active
                      ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-sm shadow-[rgba(49,130,246,0.18)]"
                      : "border-[#d8d2c6] bg-white text-[#425247] hover:border-blue-200 hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
          {isPostBuyFeedbackType(localStatus) && (
            <div className="mt-2 border-t border-[#ebe4d8] pt-2 dark:border-zinc-800">
              <div className="mb-1.5 text-[10px] font-bold text-[#758174] dark:text-zinc-400">
                매수 후 진행
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {POST_BUY_ACTIONS.map((action) => {
                  const active = localStatus === action.type;
                  return (
                    <button
                      key={action.type}
                      type="button"
                      onClick={() => handleTransactionFeedback(action.type, action.note)}
                      className={`rounded-lg border px-2 py-2 text-[11px] font-black transition ${
                        active
                          ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-sm shadow-[rgba(49,130,246,0.18)]"
                          : "border-[#d8d2c6] bg-white text-[#425247] hover:border-blue-200 hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {onReportLoss && (
          <button
            type="button"
            onClick={() => onReportLoss(card)}
            disabled={alreadyReportedLoss}
            title={alreadyReportedLoss ? "이미 신고됨 — 운영자 검수 진행 중" : "부정확 정보 신고하기 — 승인 시 토큰 +3"}
            className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-black leading-none transition ${
              alreadyReportedLoss
                ? "cursor-not-allowed border-zinc-300 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                : "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
            }`}
          >
            {alreadyReportedLoss ? "신고 완료 — 검수 중" : "정보 오류 신고 · 승인 시 +3"}
          </button>
        )}
      </div>
    </div>
  );
}

// Wave launch-69 (사용자 짚음): 원본 보러가기 confirm modal 의 "다시 안내 안 받기" 옵션.
//   체크하면 다음부터 confirm modal 자체 skip — 바로 원본 URL 이동.
//   localStorage flag 영구. 사용자 가 명시적 dismiss 한 경우에만.
const SKIP_SOURCE_CONFIRM_STORAGE_KEY = "minyoi:skip-source-confirm-v1";

function readSkipSourceConfirm(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(SKIP_SOURCE_CONFIRM_STORAGE_KEY) === "1"; }
  catch { return false; }
}

function writeSkipSourceConfirm(skip: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (skip) window.localStorage.setItem(SKIP_SOURCE_CONFIRM_STORAGE_KEY, "1");
    else window.localStorage.removeItem(SKIP_SOURCE_CONFIRM_STORAGE_KEY);
  } catch { /* ignore */ }
}

function FixedBunjangFooter({
  card,
  onLinkClicked,
  onTrackEvent,
}: {
  card: RevealCard;
  onLinkClicked: (pid: number) => void;
  onTrackEvent?: (pid: number, eventType: DetailEventType, metadata?: Record<string, unknown>) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [skipNextTime, setSkipNextTime] = useState(false);
  const safety = marketplaceSafetyForCard(card);
  const checks = beginnerPurchaseChecks(card).slice(0, 3);
  const marketplaceLabel = safety.marketplaceLabel;
  const handleConfirmClick = () => {
    onTrackEvent?.(card.pid, "original_clicked", { marketplace: marketplaceLabel });
    onLinkClicked(card.pid);
    if (skipNextTime) writeSkipSourceConfirm(true);
    setConfirmOpen(false);
  };
  // 2026-05-26 (사용자 짚음 "당근 매물인데 로고가 번개장터"): daangn 분기 추가.
  const SourceLogo = safety.isJoongna ? JoongnaLogo : safety.isDaangn ? DaangnLogo : BunjangLogo;

  // Wave 333 (사용자 피드백): 안전도("주의 1건") 버튼 제거 — 모달 안 셀러 카드/거래 안전 타일에 이미 있음.
  // 하단 fixed는 번개장터 이동 버튼만 풀 너비로.
  // Wave 394.1 (외부 review #6): CTA 문구 "번개장터에서 확인하기" 의미 불명확
  // (구매? 판매? 채널 추천?) → "번개장터 원본 매물 보기" 액션 명확화.
  // Wave 394.7 (외부 review #5): "정보 앱인데 광고 랜딩페이지 같음. 모바일 분석 내용 읽는 공간 줄어듦".
  // 사이즈 ↓ — py-3 → py-2.5, text-sm → text-[13px], shadow-lg → shadow-md, ring-1 제거.
  // min-h-11 (iOS 44px tap target) 유지. brand color 유지 (핵심 액션 색은 강조).
  // Wave 537: source-aware logo + Toss-style blue CTA. Bolt decoration removed
  // so Bunjang/Joongna logos are the primary source signal.
  return (
    <div
      className="shrink-0 bg-[linear-gradient(180deg,rgba(235,230,220,0)_0%,rgba(235,230,220,0.95)_28%)] px-[14px] pb-[calc(env(safe-area-inset-bottom)+14px)] pt-[14px] dark:bg-[linear-gradient(180deg,rgba(24,24,27,0)_0%,#18181b_28%)]"
    >
      <button
        type="button"
        onClick={() => {
          // Wave launch-69: 사용자가 "다시 안내 안 받기" 체크했으면 confirm modal skip — 바로 이동.
          if (readSkipSourceConfirm()) {
            onTrackEvent?.(card.pid, "original_clicked", { marketplace: marketplaceLabel, skipped_confirm: true });
            onLinkClicked(card.pid);
            if (typeof window !== "undefined") window.open(card.url, "_blank", "noopener,noreferrer");
            return;
          }
          onTrackEvent?.(card.pid, "original_confirm_opened", { marketplace: marketplaceLabel });
          setConfirmOpen(true);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: "#3182f6",
          borderRadius: 999,
          minHeight: 54,
          padding: "4px 46px",
          boxShadow: "0 12px 28px rgba(49,130,246,0.28), 0 4px 10px rgba(49,130,246,0.18)",
          color: "#fff",
          textDecoration: "none",
          border: "none",
          width: "100%",
          cursor: "pointer",
        }}
      >
        <span style={{ position: "absolute", left: 7, top: "50%", transform: "translateY(-50%)", width: 38, height: 38, borderRadius: 999, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 1px 4px rgba(15,23,42,0.12)" }}>
          <SourceLogo className="h-7 w-7 rounded-full" />
        </span>
        <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.3, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" }}>
          <span>{marketplaceLabel} 원본 매물 보기</span>
        </span>
      </button>
      {confirmOpen ? (
        <div
          data-bunjang-exit-confirm
          role="dialog"
          aria-modal="true"
          aria-label={`${marketplaceLabel} 이동 전 확인`}
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/38 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] backdrop-blur-[2px] sm:items-center sm:pb-4"
        >
          <button
            type="button"
            aria-label="확인창 닫기"
            onClick={() => setConfirmOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative w-full max-w-[430px] overflow-hidden rounded-[26px] bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/55 dark:text-blue-200 dark:ring-blue-900/60">
                <ShieldIcon className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-black text-blue-700 dark:text-blue-200">원본 매물로 이동하기 전</div>
                <h3 className="mt-1 break-keep text-[21px] font-black leading-[1.18] text-[#172019] dark:text-zinc-50">
                  이 세 가지만 기억하세요
                </h3>
              </div>
            </div>
            {/* Wave launch-69 (사용자 짚음 "중복 안내 제거"):
                시세 기준 + 판매자 확인 카드 제거 — 이미 쉬운모드에서 본 내용.
                구매 전 멈춤 신호 만 유지 (쉬운모드 step 제거됐으니 여기 한 곳만). */}
            <div className="mt-4 space-y-2.5">
              {checks.length > 0 ? (
                <div className="rounded-[18px] bg-white/86 px-3.5 py-3 ring-1 ring-zinc-200 dark:bg-zinc-950/55 dark:ring-zinc-800">
                  <div className="text-[11px] font-black text-[#7b8378] dark:text-zinc-400">구매 전 멈춤 신호</div>
                  <ul className="mt-2 space-y-1.5">
                    {checks.map((check) => (
                      <li key={check.id} className="break-keep text-[12.5px] font-bold leading-5 text-zinc-900 dark:text-zinc-200">
                        {check.ask}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {safety.sourceAction ? (
                <div className="rounded-[18px] bg-blue-50/80 px-3.5 py-3 ring-1 ring-blue-100 dark:bg-blue-950/25 dark:ring-blue-900/60">
                  <div className="text-[11px] font-black text-blue-800 dark:text-blue-200">중고나라 추가 확인</div>
                  <p className="mt-1 break-keep text-[12.5px] font-bold leading-5 text-blue-900 dark:text-blue-100">
                    {safety.sourceAction.note}
                  </p>
                  <a
                    href={safety.sourceAction.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex rounded-full bg-white px-3 py-1.5 text-[12px] font-black text-blue-700 ring-1 ring-blue-200 dark:bg-zinc-950/50 dark:text-blue-200 dark:ring-blue-900/70"
                  >
                    {safety.sourceAction.label}
                  </a>
                </div>
              ) : null}
            </div>
            <div className="mt-4 grid gap-2">
              <a
                href={card.url}
                target="_blank"
                rel="noreferrer"
                onClick={handleConfirmClick}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] bg-[#3182f6] px-4 text-[15px] font-black text-white shadow-[0_14px_30px_rgba(49,130,246,0.24)] transition active:scale-[0.99]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                  <SourceLogo className="h-5 w-5 rounded-full" />
                </span>
                확인하고 {marketplaceLabel} 보기
              </a>
              <button
                type="button"
                onClick={() => {
                  onTrackEvent?.(card.pid, "original_cancelled", { marketplace: marketplaceLabel });
                  setConfirmOpen(false);
                }}
                className="flex min-h-[46px] items-center justify-center rounded-[16px] bg-white/86 px-4 text-[14px] font-black text-zinc-900 ring-1 ring-zinc-200 transition active:scale-[0.99] dark:bg-zinc-950/60 dark:text-zinc-100 dark:ring-zinc-800"
              >
                더 살펴볼래요
              </button>
              {/* Wave launch-69: 사용자 짚음 "매번 안내 나오면 부담 — 이제부터 안 보기". */}
              <label className="mt-1 flex cursor-pointer items-center gap-2 px-1 text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={skipNextTime}
                  onChange={(e) => setSkipNextTime(e.target.checked)}
                  className="h-4 w-4 accent-[#3182f6]"
                />
                <span>다음부터 이 안내 안 받기 (바로 원본으로 이동)</span>
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RelatedRevealStrip({
  items,
  onOpenRelatedItem,
}: {
  items: RelatedRevealItem[];
  onOpenRelatedItem?: (pid: number) => void;
}) {
  const visibleItems = items.slice(0, 8);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const node = stripRef.current;
    if (!node) return;
    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    setCanScrollPrev(node.scrollLeft > 4);
    setCanScrollNext(node.scrollLeft < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    const node = stripRef.current;
    if (!node) return;
    updateScrollButtons();
    node.addEventListener("scroll", updateScrollButtons, { passive: true });
    window.addEventListener("resize", updateScrollButtons);
    return () => {
      node.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [updateScrollButtons, visibleItems.length]);

  const scrollRelatedItems = useCallback((direction: "prev" | "next") => {
    const node = stripRef.current;
    if (!node) return;
    const cardStep = 150 * 3;
    const distance = Math.min(Math.max(node.clientWidth * 0.85, 300), cardStep);
    node.scrollBy({
      left: direction === "next" ? distance : -distance,
      behavior: "smooth",
    });
    window.setTimeout(updateScrollButtons, 240);
  }, [updateScrollButtons]);

  if (visibleItems.length === 0 || !onOpenRelatedItem) return null;

  // Wave 394.7.p (reference OtherRecs): horizontal scroll + 140px 카드 + rounded border.
  return (
    <section className="mt-4 px-3 sm:px-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          다른 수익 매물
        </div>
        <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
          {visibleItems.length}개
        </span>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => scrollRelatedItems("prev")}
          disabled={!canScrollPrev}
          aria-label="다른 수익 매물 왼쪽으로 보기"
          className="absolute left-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-black/72 text-lg font-black text-white shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-black/84 disabled:pointer-events-none disabled:opacity-0 dark:border-zinc-700/80 sm:left-2"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => scrollRelatedItems("next")}
          disabled={!canScrollNext}
          aria-label="다른 수익 매물 오른쪽으로 보기"
          className="absolute right-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-black/72 text-lg font-black text-white shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-black/84 disabled:pointer-events-none disabled:opacity-0 dark:border-zinc-700/80 sm:right-2"
        >
          →
        </button>
        <div
          ref={stripRef}
          data-related-reveal-scroll
          className="-mx-3 flex scroll-px-3 gap-2.5 overflow-x-auto px-3 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        >
          {visibleItems.map((item) => {
            const profitPct = item.price > 0 ? Math.round((item.expectedProfitMax / item.price) * 100) : 0;
            return (
              <button
                key={item.pid}
                type="button"
                onClick={() => onOpenRelatedItem(item.pid)}
                className="flex w-[140px] shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left transition hover:border-blue-300 hover:shadow-sm active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  {/* Wave 714d (2026-05-23 fix): 신발/의류는 기존 ConditionPhotoBadge 숨김. */}
                  {!(item.marketBasis?.comparableKey?.startsWith("shoe|") || item.marketBasis?.comparableKey?.startsWith("clothing|")) && (
                    <ConditionPhotoBadge conditionClass={item.marketBasis?.conditionClass ?? null} compact />
                  )}
                  {item.thumbnailUrl ? (
                    <>
                      <Image
                        src={item.thumbnailUrl}
                        alt=""
                        fill
                        sizes="140px"
                        unoptimized
                        className="object-cover"
                      />
                      {/* Wave 751 (2026-05-25): 우하단 카테고리 워터마크 배지. */}
                      <CategoryWatermark
                        comparableKey={item.marketBasis?.comparableKey ?? null}
                        size={28}
                        variant="corner"
                      />
                    </>
                  ) : (
                    // Wave 749 (2026-05-25): 카테고리 워터마크 placeholder.
                    <CategoryWatermark
                      category={item.category}
                      comparableKey={item.marketBasis?.comparableKey ?? null}
                      size={72}
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col px-2.5 py-2.5">
                  <div className="line-clamp-2 min-h-[32px] text-[11px] font-bold leading-tight text-zinc-700 dark:text-zinc-300">
                    {item.name}
                  </div>
                  <div className="mt-1.5 text-[13px] font-black leading-none tabular-nums tracking-tight text-blue-700 dark:text-blue-300">
                    {profitRange(item.expectedProfitMin, item.expectedProfitMax)}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold tabular-nums text-zinc-500 dark:text-zinc-400">
                    매입 {krw(item.price)} · +{profitPct}%
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DetailReportModeChoiceSheet({
  open,
  onThisItem,
  onAlwaysDetailed,
  onCancel,
}: {
  open: boolean;
  onThisItem: () => void;
  onAlwaysDetailed: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-8 backdrop-blur-sm sm:items-center sm:px-6 sm:pb-8">
      <div className="w-full max-w-[420px] rounded-[28px] bg-white p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] ring-1 ring-black/10 dark:bg-zinc-950 dark:ring-white/10">
        <div className="rounded-[22px] bg-white px-4 py-4 ring-1 ring-[#ebe3d4] dark:bg-zinc-900 dark:ring-zinc-800">
          <div className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-800 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/60">
            보기 방식 선택
          </div>
          <h3 className="mt-3 break-keep text-[21px] font-black leading-[1.2] text-[#172019] dark:text-zinc-50">
            상세 숫자 리포트를 어떻게 볼까요?
          </h3>
          <p className="mt-2 break-keep text-[13px] font-semibold leading-5 text-[#667164] dark:text-zinc-400">
            이번 매물만 숫자로 보거나, 앞으로 기본 화면을 상세 리포트로 바꿀 수 있어요.
          </p>
          <p className="mt-3 break-keep rounded-[16px] bg-zinc-50 px-3 py-2 text-[12px] font-bold leading-5 text-zinc-500 dark:bg-zinc-950/70 dark:text-zinc-400">
            기본을 바꿔도 나중에 상단의 <span className="text-zinc-950 dark:text-zinc-100">쉽게 보기</span> 버튼으로 언제든 다시 볼 수 있어요.
          </p>
        </div>

        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={onThisItem}
            className="flex min-h-[54px] items-center justify-center rounded-[18px] bg-[#172019] px-4 text-[15px] font-black text-white shadow-[0_14px_30px_rgba(23,32,25,0.22)] transition active:scale-[0.99] dark:bg-zinc-100 dark:text-zinc-950"
          >
            이번만 상세 리포트 보기
          </button>
          <button
            type="button"
            onClick={onAlwaysDetailed}
            className="flex min-h-[52px] items-center justify-center rounded-[18px] bg-white px-4 text-[14px] font-black text-zinc-950 ring-1 ring-zinc-200 transition active:scale-[0.99] dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800"
          >
            앞으로 상세 리포트를 기본으로 보기
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="mx-auto flex min-h-9 items-center justify-center px-3 text-[12px] font-black text-[#7b8378] underline-offset-4 hover:text-zinc-950 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            계속 쉬운모드 볼래요
          </button>
        </div>
      </div>
    </div>
  );
}

type DetailReportModeChoiceSource = "easy_mode_skip" | "easy_mode_complete";

export default function PackRevealModal({
  open,
  band: _band,
  loading,
  result,
  initialPreviewCard,
  initialPreviewMode = "listing",
  initialPreviewSeed,
  onClose,
  onLinkClicked,
  onFeedback,
  onTrackEvent,
  currentFeedbackType,
  currentSaved,
  onSaveToggle,
  onLoadDetail,
  relatedItems = [],
  onOpenRelatedItem,
  onReportLoss,
  alreadyReportedLoss,
  onLoadGuide,
  renderGuidePanel,
  onRetry,
}: Props) {
  const [previewCard, setPreviewCard] = useState<RevealCard | null>(null);
  const [previewGuide, setPreviewGuide] = useState<ModelGuide | null>(null);
  const [previewGuideLoading, setPreviewGuideLoading] = useState(false);
  const [previewGuideError, setPreviewGuideError] = useState<string | null>(null);
  const [previewSide, setPreviewSide] = useState<PreviewSide>("right");
  const consumedInitialPreviewSeedRef = useRef<string | number | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const photoRef = useRef<HTMLDivElement | null>(null);
  const reportPanelRef = useRef<HTMLDivElement | null>(null);
  // Wave 364: 사진이 viewport에 보이면 floating nav (icon-only), 안 보이면 sticky nav bar.
  const [photoVisible, setPhotoVisible] = useState(true);
  const activeRevealCard = result?.result === "success" ? result.reveals[0] ?? null : null;
  const activeRevealPid = activeRevealCard?.pid ?? null;
  const [savedPids, setSavedPids] = useState<Set<number>>(() => new Set());
  const activeRevealSaved = activeRevealPid != null && savedPids.has(activeRevealPid);
  const [beginnerGuideVisible, setBeginnerGuideVisible] = useState(false);
  const [beginnerGuideStep, setBeginnerGuideStep] = useState(0);
  const [reportShortcutSignal, setReportShortcutSignal] = useState(0);
  const [detailModeChoice, setDetailModeChoice] = useState<{
    source: DetailReportModeChoiceSource;
    stepIndex: number;
    stepTotal: number;
  } | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const saveToastTimerRef = useRef<number | null>(null);
  const requestedAnalysisPidsRef = useRef<Set<number>>(new Set());
  const [analysisLoadingPids, setAnalysisLoadingPids] = useState<Set<number>>(() => new Set());
  const activeAnalysisHasLoaded =
    Boolean(activeRevealCard?.velocityBasis) ||
    Boolean(activeRevealCard?.marketBasis?.computedAt) ||
    Boolean(activeRevealCard?.skuListingFlow);
  const activeAnalysisLoading =
    activeRevealPid != null &&
    analysisLoadingPids.has(activeRevealPid) &&
    !activeAnalysisHasLoaded;
  const guideModeActive = result?.result === "success" && activeRevealCard != null && beginnerGuideVisible;

  useEffect(() => {
    setDetailModeChoice(null);
  }, [activeRevealPid]);

  useEffect(() => {
    if (!open || activeRevealPid == null) return;
    const locallySaved = readSavedRevealPidSet().has(activeRevealPid);
    setSavedPids((prev) => {
      const next = new Set(prev);
      if ((currentSaved ?? locallySaved)) next.add(activeRevealPid);
      else next.delete(activeRevealPid);
      return next;
    });
  }, [open, activeRevealPid, currentSaved]);

  const handleToggleSave = useCallback(() => {
    if (!activeRevealCard) return;
    const nextSaved = !activeRevealSaved;
    setSavedPids((prev) => {
      const next = new Set(prev);
      if (nextSaved) next.add(activeRevealCard.pid);
      else next.delete(activeRevealCard.pid);
      return next;
    });
    if (currentSaved == null) writeSavedRevealPid(activeRevealCard.pid, nextSaved);
    onSaveToggle?.(activeRevealCard.pid, nextSaved);
    setSaveToast(nextSaved ? "스크랩에 저장했어요" : "스크랩에서 해제했어요");
    if (saveToastTimerRef.current != null) {
      window.clearTimeout(saveToastTimerRef.current);
    }
    saveToastTimerRef.current = window.setTimeout(() => {
      setSaveToast(null);
      saveToastTimerRef.current = null;
    }, 1600);
  }, [activeRevealCard, activeRevealSaved, currentSaved, onSaveToggle]);

  const handleOpenReportShortcut = useCallback(() => {
    setReportShortcutSignal((value) => value + 1);
    window.setTimeout(() => {
      reportPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, []);

  useEffect(() => {
    if (open) return;
    setSaveToast(null);
    if (saveToastTimerRef.current != null) {
      window.clearTimeout(saveToastTimerRef.current);
      saveToastTimerRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (saveToastTimerRef.current != null) {
        window.clearTimeout(saveToastTimerRef.current);
      }
    };
  }, []);

  // 사진 영역 IntersectionObserver — scrollAreaRef 안에서 사진 visibility 추적.
  // Wave 803 (2026-05-30): hysteresis 도입. 기존 threshold 0.1 단일 → 사진 10% 경계 자주
  //   넘나들면 photoVisible 토글 빈번 → 7864 line modal 전체 re-render → opacity transition
  //   여러 element 동시 박힘 → PC 모드 스크롤 깜빡임. fix: enter 0.2 / exit 0.05 hysteresis.
  useEffect(() => {
    if (!open || activeRevealPid == null || guideModeActive) return;
    const photoEl = photoRef.current;
    const scrollEl = scrollAreaRef.current;
    if (!photoEl || !scrollEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const ratio = entry.intersectionRatio;
        setPhotoVisible((prev) => {
          // hysteresis — visible→hidden 은 5% 미만, hidden→visible 은 20% 이상.
          // 경계 근방에서 photoVisible 토글 자주 X → re-render 줄임.
          if (prev && ratio < 0.05) return false;
          if (!prev && ratio > 0.2) return true;
          return prev;
        });
      },
      { root: scrollEl, threshold: [0, 0.05, 0.2, 0.5] },
    );
    observer.observe(photoEl);
    return () => observer.disconnect();
  }, [open, activeRevealPid, guideModeActive]);

  const resetDetailScroll = useCallback((behavior: ScrollBehavior = "auto") => {
    const node = scrollAreaRef.current;
    if (!node) return;
    node.scrollTop = 0;
    node.scrollTo({ top: 0, behavior });
  }, []);

  const requestRevealAnalysis = useCallback((pid: number) => {
    if (!Number.isFinite(pid)) return;
    if (requestedAnalysisPidsRef.current.has(pid)) return;
    requestedAnalysisPidsRef.current.add(pid);
    setAnalysisLoadingPids((prev) => {
      const next = new Set(prev);
      next.add(pid);
      return next;
    });
    void onLoadDetail(pid)
      .catch((err) => {
        requestedAnalysisPidsRef.current.delete(pid);
        console.error("[pack-reveal-modal] lazy detail analysis load failed", err);
      })
      .finally(() => {
        setAnalysisLoadingPids((prev) => {
          const next = new Set(prev);
          next.delete(pid);
          return next;
        });
      });
  }, [onLoadDetail]);

  useEffect(() => {
    if (!open || loading || result?.result !== "success" || activeRevealPid == null) {
      setBeginnerGuideVisible(false);
      setBeginnerGuideStep(0);
      return;
    }
    requestRevealAnalysis(activeRevealPid);
    setBeginnerGuideStep(0);
    const shouldShow = shouldAutoShowBeginnerGuide(activeRevealPid);
    setBeginnerGuideVisible(shouldShow);
    if (shouldShow) {
      onTrackEvent?.(activeRevealPid, "easy_mode_started", { trigger: "auto" });
    }
  }, [open, loading, result?.result, activeRevealPid, onTrackEvent, requestRevealAnalysis]);

  useEffect(() => {
    if (!guideModeActive || !activeRevealCard || activeRevealPid == null) return;
    const steps = beginnerGuideSteps(activeRevealCard, { analysisLoading: activeAnalysisLoading });
    const step = steps[Math.max(0, Math.min(beginnerGuideStep, steps.length - 1))];
    onTrackEvent?.(activeRevealPid, "easy_mode_step_view", {
      stepIndex: beginnerGuideStep,
      stepTotal: steps.length,
      tone: step?.tone ?? "",
      title: step?.title ?? "",
    });
  }, [activeAnalysisLoading, activeRevealCard, activeRevealPid, beginnerGuideStep, guideModeActive, onTrackEvent]);

  const requestDetailReportModeChoice = useCallback((source: DetailReportModeChoiceSource) => {
    if (!activeRevealCard) return;
    const stepTotal = beginnerGuideSteps(activeRevealCard).length;
    setDetailModeChoice({
      source,
      stepIndex: beginnerGuideStep,
      stepTotal,
    });
  }, [activeRevealCard, beginnerGuideStep]);

  const cancelDetailReportModeChoice = useCallback(() => {
    setDetailModeChoice(null);
  }, []);

  const openDetailedReportFromGuide = useCallback((makeDefault: boolean) => {
    if (!detailModeChoice) return;
    const source = detailModeChoice.source;
    if (makeDefault) {
      try { localStorage.setItem(MODAL_MODE_STORAGE_KEY, "detailed"); } catch {}
    }
    window.dispatchEvent(new CustomEvent("minyoi:modal-mode-changed", { detail: { mode: "detailed" } }));
    if (source === "easy_mode_skip") {
      recordBeginnerGuideSkipped(activeRevealPid);
      if (activeRevealPid != null) {
        onTrackEvent?.(activeRevealPid, "easy_mode_skipped", {
          stepIndex: detailModeChoice.stepIndex,
          defaultDetailed: makeDefault,
        });
      }
    } else {
      recordBeginnerGuideCompleted(activeRevealPid);
      if (activeRevealPid != null) {
        onTrackEvent?.(activeRevealPid, "easy_mode_completed", {
          stepTotal: detailModeChoice.stepTotal,
          defaultDetailed: makeDefault,
        });
      }
    }
    if (activeRevealPid != null) {
      onTrackEvent?.(activeRevealPid, "detail_report_opened", {
        source,
        defaultDetailed: makeDefault,
      });
    }
    setDetailModeChoice(null);
    setBeginnerGuideVisible(false);
    setBeginnerGuideStep(0);
    window.requestAnimationFrame(() => resetDetailScroll("auto"));
  }, [activeRevealPid, detailModeChoice, onTrackEvent, resetDetailScroll]);

  const skipBeginnerGuide = useCallback(() => {
    requestDetailReportModeChoice("easy_mode_skip");
  }, [requestDetailReportModeChoice]);

  const advanceBeginnerGuide = useCallback(() => {
    if (!activeRevealCard) return;
    const maxIndex = beginnerGuideSteps(activeRevealCard).length - 1;
    if (beginnerGuideStep >= maxIndex) {
      // Wave launch-22 (사용자 짚음): 끝까지 본 사용자는 "이번만 vs 앞으로 기본" 선택 모달 안 띄움.
      // 이미 9 step 다 봤는데 또 안내 묻는 건 짜증. 바로 detailed mode 로 진입.
      // skip 사용자만 모달 (정보 못 본 상태에서 detail 진입 시 가이드).
      recordBeginnerGuideCompleted(activeRevealPid);
      if (activeRevealPid != null) {
        onTrackEvent?.(activeRevealPid, "easy_mode_completed", {
          stepTotal: maxIndex + 1,
          defaultDetailed: false,
        });
        onTrackEvent?.(activeRevealPid, "detail_report_opened", {
          source: "easy_mode_complete",
          defaultDetailed: false,
        });
      }
      window.dispatchEvent(new CustomEvent("minyoi:modal-mode-changed", { detail: { mode: "detailed" } }));
      setBeginnerGuideVisible(false);
      setBeginnerGuideStep(0);
      window.requestAnimationFrame(() => resetDetailScroll("auto"));
      return;
    }
    if (activeRevealPid != null) {
      onTrackEvent?.(activeRevealPid, "easy_mode_next", { from: beginnerGuideStep, to: Math.min(beginnerGuideStep + 1, maxIndex) });
    }
    setBeginnerGuideStep((prev) => Math.min(prev + 1, maxIndex));
    window.requestAnimationFrame(() => resetDetailScroll("auto"));
  }, [activeRevealCard, activeRevealPid, beginnerGuideStep, onTrackEvent, resetDetailScroll]);

  const retreatBeginnerGuide = useCallback(() => {
    if (activeRevealPid != null) {
      onTrackEvent?.(activeRevealPid, "easy_mode_prev", { from: beginnerGuideStep, to: Math.max(0, beginnerGuideStep - 1) });
    }
    setBeginnerGuideStep((prev) => Math.max(0, prev - 1));
    window.requestAnimationFrame(() => resetDetailScroll("auto"));
  }, [activeRevealPid, beginnerGuideStep, onTrackEvent, resetDetailScroll]);

  // Wave 76: loading 종료 후 LoadingStage를 잠깐 더 보여줘서 100% 도달 + smooth
  // 카드 reveal. 이전엔 응답 도착 시 중간 % 상태에서 갑자기 카드 노출됐음.
  const [displayLoading, setDisplayLoading] = useState(loading);
  const [completing, setCompleting] = useState(false);
  useEffect(() => {
    if (loading) {
      setDisplayLoading(true);
      setCompleting(false);
      return;
    }
    if (!displayLoading) return;
    setCompleting(true);
    const id = window.setTimeout(() => {
      setDisplayLoading(false);
      setCompleting(false);
    }, 500);
    return () => window.clearTimeout(id);
  }, [loading, displayLoading]);

  const closePreviewPanel = useCallback(() => {
    setPreviewCard(null);
    setPreviewGuide(null);
    setPreviewGuideLoading(false);
    setPreviewGuideError(null);
  }, []);

  const openBeginnerGuide = useCallback(() => {
    if (!activeRevealCard) return;
    closePreviewPanel();
    requestRevealAnalysis(activeRevealCard.pid);
    setBeginnerGuideStep(0);
    setBeginnerGuideVisible(true);
    onTrackEvent?.(activeRevealCard.pid, "easy_mode_reopened", { trigger: "easy_button" });
    onTrackEvent?.(activeRevealCard.pid, "easy_mode_started", { trigger: "manual" });
    window.requestAnimationFrame(() => resetDetailScroll("auto"));
  }, [activeRevealCard, closePreviewPanel, onTrackEvent, requestRevealAnalysis, resetDetailScroll]);

  const handleClose = useCallback(() => {
    closePreviewPanel();
    onClose();
  }, [closePreviewPanel, onClose]);

  // Wave 394.7.k (사용자 짚음 — 모바일 브라우저 뒤로가기):
  // modal open 시 history.pushState — 사용자 브라우저 뒤로가기 (iOS swipe back / Android 뒤로) 시
  // 페이지 이동 X, modal 만 닫힘 (인스타/카카오 동일 패턴).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;

    const stateToken = { minyoiModalOpen: Date.now() };
    window.history.pushState(stateToken, "");

    let triggeredByPopState = false;
    const handlePopState = () => {
      triggeredByPopState = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // X 버튼/outside click 로 닫힌 경우 (popstate 안 거침) — 우리가 push 한 state 정리.
      if (!triggeredByPopState && window.history.state?.minyoiModalOpen) {
        window.history.back();
      }
    };
  }, [open]);

  const handlePreviewGuide = useCallback((card: RevealCard, side: PreviewSide) => {
    setPreviewCard(card);
    setPreviewSide(side);
    setPreviewGuide(null);
    setPreviewGuideError(null);

    if (!onLoadGuide) {
      setPreviewGuide(findModelGuide({
        skuId: card.skuId,
        comparableKey: card.marketBasis.comparableKey,
        skuName: card.skuName,
        name: card.name,
      }));
      setPreviewGuideLoading(false);
      return;
    }

    setPreviewGuideLoading(true);
    void onLoadGuide(card)
      .then((guide) => {
        setPreviewGuide(guide);
      })
      .catch((err) => {
        console.error("[pack-reveal-modal] preview guide load failed", err);
        setPreviewGuideError("공략 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      })
      .finally(() => setPreviewGuideLoading(false));
  }, [onLoadGuide]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, handleClose]);

  // Wave 81: 모달 열림 시 body scroll lock. 모바일에서 백드롭 너머 스크롤 +
  // 터치 click-through 방지. iOS Safari 호환 위해 position fixed + 복원 패턴.
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open || loading || !result || result.result !== "success") return;
    if (!initialPreviewCard || initialPreviewSeed == null) return;
    if (consumedInitialPreviewSeedRef.current === initialPreviewSeed) return;

    consumedInitialPreviewSeedRef.current = initialPreviewSeed;
    // Wave 218: 상품 보기에서는 개발자용 상세 패널을 열지 않는다. 단, /me lazy
    // market analysis는 onLoadDetail 응답에 같이 오므로 백그라운드로만 호출한다.
    requestRevealAnalysis(initialPreviewCard.pid);
    queueMicrotask(() => {
      if (initialPreviewMode === "guide") {
        handlePreviewGuide(initialPreviewCard, "right");
      }
    });
  }, [
    open,
    loading,
    result,
    initialPreviewCard,
    initialPreviewMode,
    initialPreviewSeed,
    handlePreviewGuide,
    requestRevealAnalysis,
  ]);

  useLayoutEffect(() => {
    if (!open || activeRevealPid == null) return;
    resetDetailScroll("auto");
    const frame = window.requestAnimationFrame(() => resetDetailScroll("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [open, activeRevealPid, initialPreviewSeed, resetDetailScroll]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-stretch justify-stretch overscroll-contain bg-[#f5f7fb] p-0 dark:bg-zinc-950 sm:items-center sm:justify-center sm:bg-[rgba(31,40,34,0.48)] sm:p-4 sm:dark:bg-[rgba(9,9,11,0.62)]"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!loading) handleClose();
      }}
    >
      {/* Wave launch-29 (사용자 짚음 PC 빈 공간): 폭 480 → 560, 높이 92dvh → 95dvh.
       * PC 에서 모달 꽉 채워도 OK (모바일 톤은 별개). */}
      <div
        data-mobile-detail-shell
        className="relative flex h-dvh max-h-dvh w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-[#f5f7fb] shadow-none dark:bg-zinc-900 sm:h-[min(95dvh,960px)] sm:max-h-[95dvh] sm:w-[min(560px,calc(100vw-32px))] sm:max-w-[560px] sm:rounded-[28px] sm:border sm:border-zinc-200 sm:shadow-2xl sm:shadow-[rgba(49,130,246,0.20)] sm:dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {saveToast ? (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute left-1/2 top-14 z-40 -translate-x-1/2 rounded-full bg-zinc-950/90 px-3.5 py-2 text-xs font-black text-white shadow-[0_12px_28px_rgba(0,0,0,0.22)] backdrop-blur dark:bg-white/95 dark:text-zinc-950 sm:top-5"
          >
            {saveToast}
          </div>
        ) : null}
        {/* Wave 360+361+362+364: 당근식 nav 유기적 전환.
            사진 보일 때 → floating icon (drop-shadow on photo).
            사진 사라지면 → sticky nav bar (cream 배경 + border + zinc icon). */}
        {!loading && !guideModeActive ? (
          <>
            {/* (A) Floating icon nav — 사진 위 */}
            <div
              className={`pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1 transition-opacity duration-200 sm:left-4 sm:top-4 ${
                photoVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <button
                type="button"
                onClick={handleClose}
                aria-label="뒤로가기"
                tabIndex={photoVisible ? 0 : -1}
                className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center text-white transition active:scale-90"
                style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleClose}
                aria-label="대시보드로"
                tabIndex={photoVisible ? 0 : -1}
                className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center text-white transition active:scale-90"
                style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <path d="M9 22V12h6v10" />
                </svg>
              </button>
            </div>
            {activeRevealCard ? (
              <div
                className={`pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1 transition-opacity duration-200 sm:right-4 sm:top-4 ${
                  photoVisible ? "opacity-100" : "opacity-0"
                }`}
              >
                <RevealReportShortcutButton
                  visible={photoVisible}
                  variant="floating"
                  onClick={handleOpenReportShortcut}
                />
                <RevealSaveButton
                  saved={activeRevealSaved}
                  visible={photoVisible}
                  variant="floating"
                  onToggle={handleToggleSave}
                />
              </div>
            ) : null}

            {/* (B) Sticky nav bar — 사진 사라지면 등장.
             * Wave launch-25 (사용자 짚음): 매물 이름 + 차익 추가. 스크롤 내려도
             * "어떤 매물 보고 있더라 / 차익 얼마였더라" 잊지 않게 (토스 결제 흐름 톤). */}
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 z-30 border-b border-zinc-200 bg-[#f5f7fb]/95 backdrop-blur transition-opacity duration-200 dark:border-zinc-800 dark:bg-zinc-900/95 ${
                photoVisible ? "opacity-0" : "opacity-100"
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-2 py-2 sm:px-3">
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="뒤로가기"
                    tabIndex={photoVisible ? -1 : 0}
                    className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-900 transition hover:bg-zinc-100 active:scale-90 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="대시보드로"
                    tabIndex={photoVisible ? -1 : 0}
                    className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-900 transition hover:bg-zinc-100 active:scale-90 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <path d="M9 22V12h6v10" />
                    </svg>
                  </button>
                </div>
                {/* Wave launch-25: 매물 이름 + 차익 — sticky bar 중앙. */}
                {activeRevealCard ? (
                  <div className="min-w-0 flex-1 px-1">
                    <div className="truncate text-[11.5px] font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                      {activeRevealCard.name}
                    </div>
                    <div className="mt-0.5 truncate text-[12.5px] font-black leading-none tabular-nums text-blue-600 dark:text-blue-400">
                      {Math.min(activeRevealCard.expectedProfitMin, activeRevealCard.expectedProfitMax) <= 0
                        ? <span className="text-rose-600 dark:text-rose-400">{holdChipText(activeRevealCard)}</span>
                        : displayProfitRange(activeRevealCard)}
                    </div>
                  </div>
                ) : null}
                {activeRevealCard ? (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <RevealReportShortcutButton
                      visible={!photoVisible}
                      variant="sticky"
                      onClick={handleOpenReportShortcut}
                    />
                    <RevealSaveButton
                      saved={activeRevealSaved}
                      visible={!photoVisible}
                      variant="sticky"
                      onToggle={handleToggleSave}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        <div
          key={activeRevealPid ?? "empty"}
          ref={scrollAreaRef}
          className="min-h-0 flex-1 overflow-y-auto px-0 pb-3 pt-0"
        >
          {displayLoading ? (
            <div className="space-y-4 px-3">
              <LoadingStage completing={completing} />
              <div className="animate-pulse">
                <RevealResultSkeleton />
              </div>
            </div>
          ) : null}

          {!displayLoading && result?.result === "success" ? (
            guideModeActive && activeRevealCard ? (
              <>
                <BeginnerGuideWalkthrough
                  card={activeRevealCard}
                  stepIndex={beginnerGuideStep}
                  analysisLoading={activeAnalysisLoading}
                  onNext={advanceBeginnerGuide}
                  onPrev={retreatBeginnerGuide}
                  onSkip={skipBeginnerGuide}
                  onClose={handleClose}
                />
                <DetailReportModeChoiceSheet
                  open={detailModeChoice != null}
                  onThisItem={() => openDetailedReportFromGuide(false)}
                  onAlwaysDetailed={() => openDetailedReportFromGuide(true)}
                  onCancel={cancelDetailReportModeChoice}
                />
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  {/* 2026-05-21: PC에서도 모바일 상세 셸을 그대로 사용한다.
                      데스크톱 2단 레이아웃은 좁은 모달 안에서 깨져서 제거했다. */}
                  <div className="grid gap-4">
                    {result.reveals.map((card, idx) => (
                      <RevealCardItem
                        key={card.pid}
                        card={card}
                        delay={idx * 250}
                        analysisLoading={idx === 0 ? activeAnalysisLoading : false}
                        currentFeedbackType={currentFeedbackType}
                        photoRef={idx === 0 ? photoRef : undefined}
                        onBeginnerGuideClick={idx === 0 ? openBeginnerGuide : undefined}
                        reportPanelRef={idx === 0 ? reportPanelRef : undefined}
                        reportShortcutSignal={idx === 0 ? reportShortcutSignal : 0}
                      />
                    ))}
                  </div>
                </div>
              {previewCard ? (
                <div
                  className={`fixed inset-x-3 bottom-3 top-12 z-[70] sm:inset-x-auto sm:bottom-4 sm:top-4 sm:w-[min(460px,calc(100vw-32px))] ${
                    previewSide === "left" ? "sm:left-4" : "sm:right-4"
                  }`}
                >
                  {renderGuidePanel ? (
                    renderGuidePanel({
                      card: previewCard,
                      guide: previewGuide,
                      loading: previewGuideLoading,
                      error: previewGuideError,
                      onClose: closePreviewPanel,
                    })
                  ) : (
                    <GuidePreviewPanel
                      card={previewCard}
                      guide={previewGuide}
                      loading={previewGuideLoading}
                      error={previewGuideError}
                      onClose={closePreviewPanel}
                    />
                  )}
                </div>
              ) : null}
              <RelatedRevealStrip
                items={relatedItems}
                onOpenRelatedItem={onOpenRelatedItem}
              />
              {result.reveals[0] ? (
                <ModalActionFooter
                  card={result.reveals[0]}
                  onFeedback={onFeedback}
                  currentFeedbackType={currentFeedbackType}
                  onReportLoss={onReportLoss}
                  alreadyReportedLoss={alreadyReportedLoss}
                />
              ) : null}
              <details className="border-t border-zinc-200 pt-3 text-[11px] font-semibold leading-5 text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
                <summary className="cursor-pointer list-none font-black text-[#647064] dark:text-zinc-400">
                  시세 추천 유의사항
                </summary>
                <div className="mt-1.5 space-y-1">
                  <div>
                    상품 {result.attemptedCount}건 검증 → {result.reveals.length}건 추천 · {(result.durationMs / 1000).toFixed(1)}초
                  </div>
                  <div>같은 전체 본품 기준으로만 비교하고, 단품/본체만/케이스만은 제외합니다.</div>
                  <div>
                    AI 기반 시세 추천이며 수익을 보장하지 않습니다. 표시된 차익은 <b>해당 가격에 정상 판매됐을 때 추정 수익</b>이고,
                    실제 거래는 매입가 협상·판매 시점·시세 변동·구성품 차이로 달라질 수 있습니다.
                  </div>
                </div>
              </details>
            </div>
            )
          ) : null}

          {!displayLoading && result?.result === "refunded" ? (
            <div className="space-y-4 py-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="text-base font-bold">검증 실패 — 크레딧 {result.tokensRefunded}개 환불됨</div>
                <p className="mt-2 text-sm">{result.reason}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/30 hover:bg-blue-700"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : null}

          {!displayLoading && result?.result === "unavailable" ? (
            <div className="space-y-4 py-6">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
                <div className="text-base font-bold">현재 재고 부족</div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{result.reason}</p>
                {/* Wave 106: dead-end 방지. unavailable은 토큰 차감 X (atomic RPC amount=0)이라
                    재시도 안전. 새 매물이 풀에 들어왔을 가능성 + 다른 등급도 시도 가능. */}
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  잠시 후 새 매물이 풀에 들어올 수 있어요. 다시 시도하거나 다른 등급을 열어보세요.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/30 hover:bg-blue-700"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {!displayLoading && result?.result === "success" && result.reveals[0] && !guideModeActive ? (
          <FixedBunjangFooter
            card={result.reveals[0]}
            onLinkClicked={onLinkClicked}
            onTrackEvent={onTrackEvent}
          />
        ) : null}
      </div>
    </div>
  );
}

export type { RevealResult };
