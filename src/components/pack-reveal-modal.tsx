"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import MarketHistoryChart from "@/components/market-history-chart";
import ModelGuidePanel from "@/components/model-guide-panel";
import { ConditionPhotoBadge } from "@/components/condition-chip";
import { RiskScoreBar } from "@/components/risk-score-bar";
import { BunjangLogo, BunjangSourceBadge, DanawaLogo, DanawaSourceBadge } from "@/components/market-brand-logo";
import { CheckCircleIcon, ScaleIcon, ShieldIcon, TargetIcon, TrophyIcon, WalletIcon } from "@/components/icons";
import { findModelGuide, type ModelGuide } from "@/lib/model-guides";
import type { PackBand, RevealCard, RevealFeedbackType, RevealListingDetail } from "@/lib/pack-open";
import { RESELL_SHIPPING_FEE, SAFETY_BUFFER, SELLING_FEE_RATE } from "@/lib/profit";
import { buyPriceGuidance } from "@/lib/buy-price-guidance";
import { categoryFromComparableKey } from "@/lib/category-readiness";
import {
  counterfeitChecklistFor,
  PRIORITY_LABEL,
  type CounterfeitCheckPriority,
} from "@/lib/counterfeit-checklist";
import {
  sellHelperFor,
  suggestedAskingPrice,
  buildBodyTemplate,
} from "@/lib/sell-helper";
import { buildRiskScore, type RiskScoreInput, type RiskTone } from "@/lib/risk-score";

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
  currentFeedbackType?: string | null;
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
  expectedProfitMin: number;
  expectedProfitMax: number;
  marketBasis: RevealCard["marketBasis"] | null;
  revealedAt: string;
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

const UI_TEST_FALLBACK_VELOCITY_HOURS = 48;

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

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function signedKrw(value: number) {
  const rounded = Math.round(value);
  const sign = rounded >= 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("ko-KR")}원`;
}

function profitRange(min: number, max: number) {
  if (min === max) return signedKrw(max);
  return `${signedKrw(min)} ~ ${signedKrw(max)}`;
}

function expectedProfitAverage(card: RevealCard) {
  return Math.round((card.expectedProfitMin + card.expectedProfitMax) / 2);
}

function netProfitPercent(card: RevealCard) {
  if (!card.price || card.price <= 0) return null;
  const profit = expectedProfitAverage(card);
  const pct = Math.round((profit / card.price) * 100);
  return Number.isFinite(pct) ? pct : null;
}

function displayProfitRange(card: RevealCard) {
  return profitRange(card.expectedProfitMin, card.expectedProfitMax);
}

function krwRange(min: number, max: number) {
  if (Math.round(min) === Math.round(max)) return krw(max);
  return `${krw(min)} ~ ${krw(max)}`;
}

function finiteKrw(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function costAssuranceSnapshot(card: RevealCard) {
  const salePrice = finiteKrw(card.marketBasis?.medianPrice);
  const sellingFee = salePrice == null ? null : Math.round(salePrice * SELLING_FEE_RATE);
  const freeShipping = Boolean(card.savedDetail?.freeShipping);
  const inferredBuyCostMin = salePrice == null || sellingFee == null
    ? null
    : finiteKrw(salePrice - card.expectedProfitMax - sellingFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
  const inferredBuyCostMax = salePrice == null || sellingFee == null
    ? null
    : finiteKrw(salePrice - card.expectedProfitMin - sellingFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
  const buyCostLow = freeShipping
    ? card.price
    : inferredBuyCostMin == null
      ? null
      : Math.max(card.price, Math.min(inferredBuyCostMin, inferredBuyCostMax ?? inferredBuyCostMin));
  const buyCostHigh = freeShipping
    ? card.price
    : inferredBuyCostMax == null
      ? null
      : Math.max(buyCostLow ?? card.price, Math.max(inferredBuyCostMax, inferredBuyCostMin ?? inferredBuyCostMax));
  const shippingLow = buyCostLow == null ? null : Math.max(0, buyCostLow - card.price);
  const shippingHigh = buyCostHigh == null ? null : Math.max(shippingLow ?? 0, buyCostHigh - card.price);
  const shippingKnown = freeShipping || shippingLow != null;
  const buyerCostLabel = buyCostLow == null || buyCostHigh == null
    ? `${krw(card.price)} + 배송비 확인`
    : krwRange(buyCostLow, buyCostHigh);
  const shippingLabel = freeShipping
    ? "0원 · 무료배송 확인"
    : shippingLow == null || shippingHigh == null
      ? "확인 필요"
      : `${krwRange(shippingLow, shippingHigh)} 계산 반영`;
  const confidenceLabel = freeShipping
    ? "배송비 확인됨"
    : shippingKnown
      ? "배송비 계산 반영"
      : "비용 확인 필요";
  const confidenceClass = freeShipping
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
    : shippingKnown
      ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200"
      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200";

  return {
    salePrice,
    sellingFee,
    buyerCostLabel,
    shippingLabel,
    confidenceLabel,
    confidenceClass,
  };
}

function marketSourceBadge(card: RevealCard) {
  const market = card.marketBasis;
  if (!market) return null;
  if (market.priceSource === "reference") return { label: "다나와", tone: "reference" as const };
  if (market.conditionClass === "mint") return { label: "번개 S급", tone: "mint" as const };
  return null;
}

// Wave 2026-05-19 v2 (외부인 #7 권장 매입가 프레임):
// 헬퍼 본체는 src/lib/buy-price-guidance.ts (모달 + 카드 리스트 공유).

function freshLabel(seconds: number) {
  if (seconds < 60) return `${seconds}초 전 검증`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}분 전 검증`;
  return `${Math.round(seconds / 3600)}시간 전 검증`;
}

function velocityHoursLabel(value: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  if (value < 24) return `${Math.round(value * 10) / 10}시간`;
  return `${Math.round((value / 24) * 10) / 10}일`;
}

function marketSampleLabel(card: RevealCard) {
  const market = card.marketBasis;
  if (market?.sampleCount > 0) {
    return `표본 ${market.sampleCount.toLocaleString("ko-KR")}건`;
  }
  return "표본 부족";
}

function marketConditionLabel(card: RevealCard) {
  const market = card.marketBasis;
  if (market?.priceSource === "reference") return "미개봉/새상품";
  return market?.conditionLabel ?? "같은 상태";
}

function marketBasisPlainSentence(card: RevealCard) {
  const market = card.marketBasis;
  if (!market) return "모델과 상태 분류가 충분하지 않으면 추천 강도를 낮춰요.";
  if (market.priceSource === "reference") {
    return "미개봉/새상품은 다나와 새 가격을 기준으로 보고, 번개 미개봉 거래 추이는 따로 확인해요.";
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
  const market = card.marketBasis;
  const velocity = card.velocityBasis;
  const goodVerdicts = verdictsForCard(card).filter((v) => v.tone === "good").map((v) => v.label);
  return uniqueCompactList([
    detail?.sellerReviewRating != null && detail.sellerReviewRating >= 4.5
      ? `셀러 후기 ${detail.sellerReviewRating.toFixed(1)}`
      : null,
    velocity?.medianHoursToSold != null && velocity.medianHoursToSold > 0 && velocity.sold7dCount > 0
      ? `비슷한 상품 ${velocityHoursLabel(velocity.medianHoursToSold)} 안에 판매`
      : null,
    market?.priceSource === "reference" ? "다나와 새 가격 확인" : `${marketConditionLabel(card)} 시세로 비교`,
    detail?.freeShipping ? "무료배송" : null,
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
    <div className="grid gap-3 lg:grid-cols-2" aria-hidden="true">
      <div className="grid gap-3 rounded-xl border border-[#e3ddd2] bg-[#fffdf9] p-3 shadow-lg shadow-[rgba(92,116,95,0.08)] dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-[132px_minmax(0,1fr)] lg:grid-cols-[150px_minmax(0,1fr)]">
        <div className="h-[118px] w-full rounded-lg bg-zinc-200/80 dark:bg-zinc-800 sm:h-[132px] sm:w-[132px] lg:h-[150px] lg:w-[150px]" />
        <div className="min-w-0 space-y-3">
          <SkeletonLine className="h-4 w-4/5" />
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <SkeletonLine className="h-3 w-20 bg-emerald-200/80 dark:bg-emerald-900/60" />
            <SkeletonLine className="mt-2 h-7 w-36 bg-emerald-200/80 dark:bg-emerald-900/60" />
            <SkeletonLine className="mt-2 h-3 w-52" />
          </div>
          <div className="hidden flex-wrap gap-1.5 sm:flex">
            <SkeletonLine className="h-5 w-16" />
            <SkeletonLine className="h-5 w-20" />
            <SkeletonLine className="h-5 w-14" />
          </div>
          <div className="hidden rounded-lg border border-[#e2d9cb] bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40 sm:block">
            <SkeletonLine className="h-3 w-24" />
            <SkeletonLine className="mt-2 h-4 w-4/5" />
            <SkeletonLine className="mt-2 h-3 w-2/3" />
          </div>
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-[#e3ddd2] bg-[#fffdf9] p-3 shadow-lg shadow-[rgba(92,116,95,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
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
          <SkeletonLine className="h-3 w-32 bg-emerald-200/80 dark:bg-emerald-900/60" />
          <SkeletonLine className="mt-2 h-7 w-48 bg-emerald-200/80 dark:bg-emerald-900/60" />
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

  if (velocity?.medianHoursToSold != null && velocity.medianHoursToSold > 0) {
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
                ? "text-emerald-700 dark:text-emerald-300"
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
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
    : confidence === "medium"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
  const hasCondition = market.conditionClass && market.conditionClass !== "all";
  const sourceLabel = market.priceSource === "reference"
    ? "다나와 새 가격 기준"
    : market.conditionClass === "mint"
      ? "번개 S급 매물 기준"
      : `번개 ${market.conditionLabel ?? "같은 상태"} 매물 기준`;
  const compactSourceLabel = market.priceSource === "reference"
    ? "다나와"
    : `번개 ${market.conditionLabel ?? "같은 상태"}`;
  return (
    <div className="rounded-lg border border-[#e2d9cb] bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
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
            <BunjangLogo className="h-3.5 w-3.5 rounded-[3px]" />
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
                <BunjangLogo className="h-4 w-4 rounded-[4px]" />
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
    price: card.price,
    skuMedian: card.marketBasis?.medianPrice ?? null,
    confidence: card.confidence,
    sellerReviewRating: card.savedDetail?.sellerReviewRating ?? null,
    sellerReviewCount: card.savedDetail?.sellerReviewCount ?? null,
  };
}

function fixedSafetyCtaClass(tone: RiskTone) {
  if (tone === "danger") {
    return "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-3 text-center text-sm font-black text-rose-800 shadow-sm ring-1 ring-white/70 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100 dark:ring-rose-900/25";
  }
  if (tone === "caution") {
    return "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-center text-sm font-black text-amber-800 shadow-sm ring-1 ring-white/70 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-900/25";
  }
  return "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#c9dbc8] bg-[#f1f8ef] px-3 py-3 text-center text-sm font-black text-[#274633] shadow-sm ring-1 ring-white/70 transition hover:bg-[#e7f3e4] dark:border-emerald-900/55 dark:bg-emerald-950/25 dark:text-emerald-100 dark:ring-emerald-900/25";
}

function RevealProductImage({ card }: { card: RevealCard }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const largePreview = previewOpen && card.thumbnailUrl ? (
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
            src={card.thumbnailUrl}
            alt={card.name}
            fill
            sizes="100vw"
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
    <div className="relative left-1/2 h-[145px] w-screen -translate-x-1/2 overflow-hidden rounded-none bg-[#eee7da] dark:bg-zinc-800 sm:left-auto sm:mx-0 sm:h-[132px] sm:w-[132px] sm:translate-x-0 sm:rounded-lg lg:h-[150px] lg:w-[150px]">
      <ConditionPhotoBadge conditionClass={card.marketBasis?.conditionClass ?? null} />
      {card.thumbnailUrl ? (
        <>
          <Image
            src={card.thumbnailUrl}
            alt=""
            aria-hidden="true"
            fill
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 132px, 150px"
            className="scale-[1.08] object-cover object-center opacity-55 blur-sm"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,249,0.22),rgba(238,231,218,0.30))] dark:bg-none dark:bg-zinc-950/20" />
          <div className="absolute inset-0 p-0 sm:p-2">
            <div className="relative h-full w-full">
              <Image
                src={card.thumbnailUrl}
                alt={card.name}
                fill
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 132px, 150px"
                className="scale-[1.08] rounded-none object-contain object-center drop-shadow-[0_10px_18px_rgba(34,49,39,0.18)] sm:scale-100 sm:rounded-md"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewOpen(true);
            }}
            className="absolute bottom-2 right-2 z-10 rounded-full bg-zinc-950/72 px-3 py-1.5 text-xs font-black text-white shadow-lg backdrop-blur transition hover:bg-zinc-950/86"
          >
            크게 보기
          </button>
          {typeof document !== "undefined" ? createPortal(largePreview, document.body) : largePreview}
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-xs font-semibold text-zinc-400">
          이미지 없음
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
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
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

function saleSpeedDisplay(card: RevealCard) {
  const velocity = card.velocityBasis;
  const hasRealTurnEstimate =
    velocity?.medianHoursToSold != null &&
    Number.isFinite(velocity.medianHoursToSold) &&
    velocity.medianHoursToSold > 0 &&
    velocity.sold7dCount > 0;
  const hours = hasRealTurnEstimate ? velocity.medianHoursToSold : UI_TEST_FALLBACK_VELOCITY_HOURS;
  return {
    hours,
    label: velocityHoursLabel(hours),
    isFallback: !hasRealTurnEstimate,
    isFast: hours != null && hours > 0 && hours <= 48,
    isSlow: hours != null && hours > 168,
    confidenceLabel: !hasRealTurnEstimate
      ? "UI 테스트"
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
  const source = market.priceSource === "reference" ? "다나와" : "번개";
  const condition = marketConditionLabel(card);
  if (sample > 0) return `${condition} · ${source} ${sample.toLocaleString("ko-KR")}건`;
  return `${condition} · ${source} 기준`;
}

function marketActivityDisplay(card: RevealCard) {
  const flow = card.skuListingFlow;
  if (flow && flow.avgPerDay7d > 0) {
    const ratio = flow.count24h / flow.avgPerDay7d;
    const tone: "good" | "info" | "warn" =
      ratio >= 1.25 ? "good" : ratio <= 0.55 ? "warn" : "info";
    const trend = ratio >= 1.25 ? "평소보다 많음" : ratio <= 0.55 ? "오늘은 조용함" : "평소 수준";
    return {
      label: "오늘 물량",
      value: `${flow.count24h.toLocaleString("ko-KR")}건`,
      sub: `7일 평균 ${flow.avgPerDay7d.toLocaleString("ko-KR")}건/일 · ${trend}`,
      tone,
    };
  }

  const market = card.marketBasis;
  const sample = market?.sampleCount ?? 0;
  const active = market?.activeSampleCount ?? 0;
  const sold = market?.soldSampleCount ?? 0;
  if (sample > 0) {
    const tone: "good" | "info" | "warn" = sample >= 30 ? "good" : sample >= 8 ? "info" : "warn";
    return {
      label: "시장 표본",
      value: `${sample.toLocaleString("ko-KR")}건`,
      sub: `판매중 ${active.toLocaleString("ko-KR")} · 거래완료 ${sold.toLocaleString("ko-KR")}`,
      tone,
    };
  }

  return {
    label: "시장 표본",
    value: "수집중",
    sub: marketEvidenceSummary(card),
    tone: "warn" as const,
  };
}

// Wave 2026-05-19 v3 (사용자 피드백): "현재성" 타일 자체 제거 — 매입/시세 줄에 검증 시점 이미 있음.
// verificationDisplay 함수도 제거됨.

function safetyDisplay(card: RevealCard, risk: ReturnType<typeof buildRiskScore>) {
  const rating = card.savedDetail?.sellerReviewRating ?? null;
  const reviewCount = card.savedDetail?.sellerReviewCount ?? 0;
  const reviewCountLabel = reviewCount.toLocaleString("ko-KR");
  const reviewBadge =
    reviewCount >= 100
      ? { label: `후기 ${reviewCountLabel}+`, className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200" }
      : reviewCount >= 30
        ? { label: `후기 ${reviewCountLabel}`, className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200" }
        : reviewCount >= 10
          ? { label: `후기 ${reviewCountLabel}`, className: "border-[#d6e2d3] bg-white/75 text-[#4d6654] dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-300" }
          : reviewCount > 0
            ? { label: "후기 적음", className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200" }
            : null;
  if (rating != null && rating >= 4.8 && reviewCount >= 10) {
    return {
      value: `평점 ${rating.toFixed(1)} 셀러`,
      sub: reviewCount >= 30 ? "후기 수 충분" : "후기 수 확인",
      Icon: TrophyIcon,
      badge: reviewBadge,
      tone: "good" as const,
    };
  }
  return {
    value: risk.label,
    sub: reviewCount > 0 && rating != null
      ? `평점 ${rating.toFixed(1)} · 후기 ${reviewCountLabel}건은 참고만`
      : risk.tone === "safe" ? "차단 필터 통과" : "확인 포인트 있음",
    Icon: ShieldIcon,
    badge: reviewBadge,
    tone: risk.tone,
  };
}

function upperFoldTileClass(tone: UpperFoldTileTone) {
  if (tone === "safe" || tone === "good") {
    return {
      card: "border-emerald-200/80 bg-white/80 dark:border-emerald-900/45 dark:bg-zinc-900/55",
      dot: "bg-emerald-500",
      value: "text-emerald-700 dark:text-emerald-300",
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

function UpperFoldFearReducers({ card }: { card: RevealCard }) {
  const speed = saleSpeedDisplay(card);
  const risk = buildRiskScore(revealRiskScoreInput(card));
  const activity = marketActivityDisplay(card);
  const safety = safetyDisplay(card, risk);
  const speedTone: "good" | "info" | "warn" = speed.isSlow ? "warn" : speed.isFast ? "good" : "info";
  // Wave 2026-05-19 v2 (사용자 피드백): "현재성" 타일 제거 — 매입/시세 줄에 이미 검증 시점 있어 중복.
  // 4 타일 → 3 타일 (오늘 물량 / 보통 N일 안에 팔림 / 거래 안전).
  const tiles: Array<{
    key: string;
    label: string;
    value: string;
    sub: string;
    tone: UpperFoldTileTone;
  }> = [
    {
      key: "activity",
      label: activity.label,
      value: activity.value,
      sub: activity.sub,
      tone: activity.tone,
    },
    {
      key: "speed",
      label: "보통 며칠에 팔림",
      value: speed.label,
      sub: speed.isFallback
        ? `표본 적음 · 카테고리 평균 기준`
        : `최근 판매 ${speed.sold7dCount.toLocaleString("ko-KR")}건`,
      tone: speedTone,
    },
  ];
  const safetyTone = upperFoldTileClass(safety.tone);
  const SafetyIcon = safety.Icon;
  return (
    <div className="-mx-[10px] mt-1 grid grid-cols-1 overflow-hidden bg-[#d9e1d6] dark:bg-zinc-800 sm:mx-0 sm:mt-2 sm:grid-cols-3 sm:gap-1.5 sm:overflow-visible sm:bg-transparent sm:dark:bg-transparent">
      {tiles.map((tile) => {
        const tone = upperFoldTileClass(tile.tone);
        return (
          <div
            key={tile.key}
            className={`min-h-[62px] border-0 px-3 py-2 shadow-none sm:min-h-[62px] sm:rounded-lg sm:border sm:px-2.5 sm:py-2 sm:shadow-sm ${tone.card}`}
          >
            <div className="flex items-center gap-1.5 text-xs font-black text-zinc-500 dark:text-zinc-400">
              <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
              {tile.label}
            </div>
            <div className={`mt-0.5 line-clamp-2 text-[17px] font-black leading-5 tracking-normal tabular-nums sm:text-sm ${tone.value}`}>
              {tile.value}
            </div>
            <div className="mt-0.5 line-clamp-1 text-xs font-bold text-zinc-500 dark:text-zinc-400">
              {tile.sub}
            </div>
          </div>
        );
      })}
      <RevealRiskScoreMini
        card={card}
        containerClassName="contents"
        triggerClassName={`min-h-[62px] w-full border-0 px-3 py-2 text-left shadow-none transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-[62px] sm:rounded-lg sm:border sm:px-2.5 sm:py-2 sm:shadow-sm ${safetyTone.card}`}
        triggerContent={(
          <span className="block w-full">
            <span className="flex items-center text-xs font-black text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
                <SafetyIcon className={`h-4 w-4 ${safetyTone.value}`} />
                거래 안전
              </span>
            </span>
            <span className={`mt-0.5 block line-clamp-2 text-[17px] font-black leading-5 tracking-normal tabular-nums sm:text-sm ${safetyTone.value}`}>
              {safety.value}
            </span>
            <span className="mt-0.5 flex min-w-0 items-center justify-between gap-1 text-xs font-bold text-zinc-500 dark:text-zinc-400">
              <span className="min-w-0 truncate">
                {safety.sub}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1">
                {safety.badge ? (
                  <span className={`shrink-0 rounded-full border px-1 py-0.5 text-[9px] font-black leading-none ${safety.badge.className}`}>
                    {safety.badge.label}
                  </span>
                ) : null}
                <span className="shrink-0 text-[10px] font-black text-zinc-400 underline decoration-zinc-300 underline-offset-2 dark:text-zinc-500 dark:decoration-zinc-600">
                  근거 보기
                </span>
              </span>
            </span>
          </span>
        )}
        hideChevron
        portalDetail
      />
    </div>
  );
}

function RecommendationReasonPanel({ card, className = "" }: { card: RevealCard; className?: string }) {
  const [open, setOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const market = card.marketBasis;
  const isMarketInvalidated = Math.min(card.expectedProfitMin, card.expectedProfitMax) <= 0;
  const marketSample = market?.sampleCount ?? 0;
  const soldSample = market?.soldSampleCount ?? 0;
  const condition = marketConditionLabel(card);
  const goodSignals = recommendationGoodSignals(card);
  const watchSignals = recommendationWatchSignals(card);
  const featureCards = recommendationFeatureCards(card);
  const toneClass = {
    profit: "border-emerald-100 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100",
    market: "border-sky-100 bg-sky-50/70 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-100",
    speed: "border-amber-100 bg-amber-50/70 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100",
    quality: "border-[#d8e2d7] bg-white/85 text-[#223127] dark:border-zinc-800 dark:bg-zinc-900/45 dark:text-zinc-100",
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
      <section className={`rounded-none border-0 bg-transparent p-0 shadow-none dark:bg-transparent sm:rounded-2xl sm:border sm:border-[#d6e2d3] sm:bg-[linear-gradient(180deg,#f8fcf5_0%,#eef7eb_100%)] sm:p-3.5 sm:shadow-[0_12px_28px_rgba(49,66,56,0.08)] sm:dark:border-emerald-900/40 sm:dark:bg-none sm:dark:bg-emerald-950/20 lg:col-span-2 ${className}`}>
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
            <div className="flex items-center gap-2 text-sm font-black text-[#223127] dark:text-zinc-100">
              <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
              왜 이 상품을 추천했나요?
            </div>
            <div className="mt-1 hidden text-xs font-semibold leading-5 text-[#60705f] dark:text-zinc-300 sm:block">
              {reasonSummary}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-[#b9d0b4] bg-white/90 px-2.5 py-1 text-[11px] font-black text-[#4f6a52] shadow-sm transition group-hover:bg-[#e4f0e1] dark:border-emerald-900/60 dark:bg-zinc-900 dark:text-emerald-200">
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
            className="recommendation-reason-dialog fixed left-1/2 top-1/2 z-[130] max-h-[min(82dvh,640px)] w-[calc(100vw-28px)] max-w-[540px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[#d6e2d3] bg-[#fffdf9] shadow-2xl shadow-zinc-950/24 dark:border-zinc-700 dark:bg-zinc-900 sm:max-h-[84vh]"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#e8dfd2] bg-[#fffdf9]/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-black text-[#223127] dark:text-zinc-100">
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
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
                <div className="rounded-xl border border-emerald-100 bg-white/85 px-3 py-2.5 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900/45">
                  <div className="text-[11px] font-black text-emerald-800 dark:text-emerald-200">좋은 점</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {goodSignals.length > 0 ? goodSignals.map((signal) => (
                      <span key={signal} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
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
              <details className="mt-2 rounded-xl border border-white/80 bg-white/75 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                <summary className="cursor-pointer text-[11px] font-black text-[#4f6a52] dark:text-emerald-200">
                  계산 기준 보기
                </summary>
                <div className="mt-2 grid gap-2 text-[11px] font-semibold leading-5 text-[#647064] dark:text-zinc-400 sm:grid-cols-2">
                  <div>
                    <b className="text-[#223127] dark:text-zinc-100">비교군</b>
                    <br />
                    {market?.label ? `${market.label} · ${condition} 기준으로 비교했어요.` : "모델 분류가 약하면 추천 강도를 낮춰요."}
                  </div>
                  <div>
                    <b className="text-[#223127] dark:text-zinc-100">비용/상태</b>
                    <br />
                    판매수수료, 재배송비, 안전버퍼를 차감하고 상품 보기 전후로 판매완료 여부를 다시 봐요.
                  </div>
                  <div className="sm:col-span-2">
                    {marketBasisPlainSentence(card)}
                  </div>
                </div>
              </details>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[#697768] dark:text-zinc-400">
                <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-zinc-900/60">
                  {marketSample > 0 ? `비슷한 매물 ${marketSample.toLocaleString("ko-KR")}건` : "비슷한 매물 부족"}
                </span>
                <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-zinc-900/60">
                  {soldSample > 0 ? `최근 거래 ${soldSample.toLocaleString("ko-KR")}건` : "거래 데이터 누적 중"}
                </span>
                <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-zinc-900/60">
                  {freshLabel(card.freshSeconds)}
                </span>
              </div>
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

function MarketGraphTrustLine({ card }: { card: RevealCard }) {
  const market = card.marketBasis;
  if (!market) return null;
  const condition = marketConditionLabel(card);
  const source = market.priceSource === "reference" ? "다나와 기준선 + 번개 미개봉 추이" : `번개 ${condition} 매물 추이`;
  return (
    <details className="rounded-lg border border-[#e2d9cb] bg-white/70 px-3 py-2 text-[11px] font-semibold leading-5 text-[#5f6d5f] dark:border-zinc-800 dark:bg-zinc-900/45 dark:text-zinc-300">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
        <span className="font-black text-[#4f6a52] dark:text-emerald-200">그래프 기준 보기</span>
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
          {condition} · {source}
        </span>
      </summary>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-[#e7f2e4] px-2 py-0.5 text-[10px] font-black text-[#4f6a52] dark:bg-emerald-950/50 dark:text-emerald-300">
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
  const description = detail.descriptionPreview.trim();
  const rating = savedRatingLabel(detail.sellerReviewRating);

  return (
    <div className="rounded-lg border border-[#e7dece] bg-[#fffaf1] px-3 py-2 text-[11px] leading-5 text-[#5f675e] dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300">
      <div className="flex flex-wrap gap-1.5">
        {detail.favoriteCount != null ? (
          <span className="rounded-full bg-[#f3eee5] px-2 py-0.5 font-black text-[#344136] dark:bg-zinc-900 dark:text-zinc-200">
            찜 {detail.favoriteCount.toLocaleString("ko-KR")}
          </span>
        ) : null}
        {rating ? (
          <span className="rounded-full bg-[#f3eee5] px-2 py-0.5 font-black text-[#344136] dark:bg-zinc-900 dark:text-zinc-200">
            리뷰 {rating}
          </span>
        ) : null}
        {detail.sellerReviewCount > 0 ? (
          <span className="rounded-full bg-[#f3eee5] px-2 py-0.5 font-black text-[#344136] dark:bg-zinc-900 dark:text-zinc-200">
            리뷰 {detail.sellerReviewCount.toLocaleString("ko-KR")}개
          </span>
        ) : null}
        {detail.freeShipping ? (
          <span className="rounded-full bg-[#f3eee5] px-2 py-0.5 font-black text-[#344136] dark:bg-zinc-900 dark:text-zinc-200">
            무료배송
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="mt-2 line-clamp-3 whitespace-pre-line font-semibold text-[#6b7269] dark:text-zinc-400">
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
function SellerTrustPanel({ card }: { card: RevealCard }) {
  const detail = card.savedDetail;
  const rating = detail?.sellerReviewRating ?? null;
  const reviewCount = detail?.sellerReviewCount ?? 0;
  const freeShipping = Boolean(detail?.freeShipping);

  // 등급 판단 — 일반인 친화 4단계
  let trustLevel: "good" | "ok" | "caution" | "danger";
  let trustHeadline: string;
  let trustSub: string;
  if (rating != null && rating >= 4.8 && reviewCount >= 30) {
    trustLevel = "good";
    trustHeadline = `우수 셀러 ⭐ ${rating.toFixed(1)}`;
    trustSub = `후기 ${reviewCount.toLocaleString("ko-KR")}건 · 거래 신뢰 매우 높음`;
  } else if (rating != null && rating >= 4.5 && reviewCount >= 10) {
    trustLevel = "ok";
    trustHeadline = `평점 ${rating.toFixed(1)} 셀러`;
    trustSub = `후기 ${reviewCount.toLocaleString("ko-KR")}건 · 거래 신뢰 양호`;
  } else if (reviewCount > 0 && rating != null) {
    trustLevel = "caution";
    trustHeadline = `평점 ${rating.toFixed(1)} · 후기 ${reviewCount.toLocaleString("ko-KR")}건`;
    trustSub = reviewCount < 10 ? "후기 적음 — 안전결제 필수" : "후기 평점 보통 — 안전결제 권장";
  } else {
    trustLevel = "danger";
    trustHeadline = "신규/익명 셀러";
    trustSub = "후기 없음 — 안전결제 + 직거래 검수 권장";
  }

  const trustClass = trustLevel === "good"
    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
    : trustLevel === "ok"
      ? "border-[#cfe0d2] bg-[#f4faf3] dark:border-emerald-900/40 dark:bg-emerald-950/15"
      : trustLevel === "caution"
        ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
        : "border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30";
  const trustTextClass = trustLevel === "good" || trustLevel === "ok"
    ? "text-emerald-900 dark:text-emerald-100"
    : trustLevel === "caution"
      ? "text-amber-900 dark:text-amber-100"
      : "text-rose-900 dark:text-rose-100";
  const trustSubClass = trustLevel === "good" || trustLevel === "ok"
    ? "text-emerald-700/85 dark:text-emerald-200/85"
    : trustLevel === "caution"
      ? "text-amber-700/85 dark:text-amber-200/85"
      : "text-rose-700/85 dark:text-rose-200/85";

  return (
    <section className={`mt-2 rounded-2xl border p-3 shadow-[0_8px_20px_rgba(49,66,56,0.05)] ${trustClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-[11px] font-black ${trustTextClass}`}>셀러 정보</div>
          <div className={`mt-0.5 text-[14px] font-black ${trustTextClass}`}>
            {trustHeadline}
          </div>
          <div className={`mt-0.5 text-[11px] font-semibold leading-4 ${trustSubClass}`}>
            {trustSub}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {freeShipping ? (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
              무료배송
            </span>
          ) : null}
          <span className="rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-[10px] font-black text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
            안전결제 권장
          </span>
        </div>
      </div>
      {(trustLevel === "caution" || trustLevel === "danger") ? (
        <div className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-[10px] font-bold leading-4 text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
          ⚠ 후기 적은 셀러는 번개페이 안전결제 + 직거래 검수로 위험 최소화.
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

  const mustChecks = checklist.checks.filter((c) => c.priority === "must");
  const recommendedChecks = checklist.checks.filter((c) => c.priority === "recommended");
  const extraChecks = checklist.checks.filter((c) => c.priority === "extra");
  const totalCount = checklist.checks.length;

  const priorityClass: Record<CounterfeitCheckPriority, string> = {
    must: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100",
    recommended: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
    extra: "border-zinc-200 bg-white/85 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/45 dark:text-zinc-200",
  };
  const priorityBadgeClass: Record<CounterfeitCheckPriority, string> = {
    must: "bg-rose-600 text-white",
    recommended: "bg-amber-500 text-white",
    extra: "bg-zinc-400 text-white dark:bg-zinc-600",
  };

  return (
    <section className="mt-2 rounded-2xl border border-[#e6c9c9] bg-[#fff5f5] p-3 shadow-[0_10px_24px_rgba(180,40,60,0.06)] dark:border-rose-900/40 dark:bg-rose-950/15">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-black text-rose-800 dark:text-rose-200">
            <ShieldIcon className="h-4 w-4 shrink-0" />
            정품 확인 체크리스트 — {checklist.label}
            <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white">
              {totalCount}개
            </span>
          </div>
          <div className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-rose-700/85 dark:text-rose-200/85 sm:line-clamp-none">
            {checklist.riskHeadline}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-rose-300 bg-white/90 px-2 py-0.5 text-[10px] font-black text-rose-700 transition dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
          {expanded ? "접기" : `필수 ${mustChecks.length}개 보기`}
        </span>
      </button>
      {expanded ? (
        <div className="mt-3 space-y-2">
          {[...mustChecks, ...recommendedChecks, ...extraChecks].map((check) => (
            <div
              key={check.title}
              className={`rounded-xl border px-3 py-2.5 shadow-sm ${priorityClass[check.priority]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[12px] font-black leading-tight">
                  {check.title}
                </div>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${priorityBadgeClass[check.priority]}`}
                >
                  {PRIORITY_LABEL[check.priority]}
                </span>
              </div>
              <div className="mt-1.5 text-[11px] font-semibold leading-5 opacity-85">
                {check.detail}
              </div>
            </div>
          ))}
          <div className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-[10px] font-bold leading-4 text-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200/70">
            ⚠ &lsquo;필수&rsquo; 항목 중 하나라도 셀러가 거절하면 거래 보류 권장. 안전결제 + 반품 보호 필수.
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {mustChecks.slice(0, 4).map((check) => (
            <span
              key={check.title}
              className="rounded-full border border-rose-300 bg-white/85 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
              title={check.detail}
            >
              {check.title}
            </span>
          ))}
          {mustChecks.length > 4 ? (
            <span className="rounded-full border border-rose-200 bg-white/60 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
              +{mustChecks.length - 4}개 더
            </span>
          ) : null}
        </div>
      )}
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
    <section className="mt-2 rounded-2xl border border-[#cfe0d2] bg-[#f4faf3] p-3 shadow-[0_10px_24px_rgba(49,98,66,0.07)] dark:border-emerald-900/40 dark:bg-emerald-950/15">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-black text-emerald-800 dark:text-emerald-200">
            <WalletIcon className="h-4 w-4 shrink-0" />
            판매 도우미 — {helper.label}
            <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-black text-white">
              {currentFeedbackType === "bought" ? "매수 완료"
                : currentFeedbackType === "inspected" ? "검수 완료"
                : currentFeedbackType === "listed" ? "판매 등록"
                : "판매 완료"}
            </span>
          </div>
          <div className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-emerald-700/85 dark:text-emerald-200/85 sm:line-clamp-none">
            이제 어떻게 올릴지 — 제목 / 본문 / 사진 / 호가 가이드. 복붙 가능.
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-300 bg-white/90 px-2 py-0.5 text-[10px] font-black text-emerald-700 transition dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
          {expanded ? "접기" : "펼치기"}
        </span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3">
          {/* 호가 가이드 */}
          {pricing ? (
            <div className="rounded-xl border border-emerald-200 bg-white/85 p-3 dark:border-emerald-900/60 dark:bg-zinc-900/55">
              <div className="text-[11px] font-black text-emerald-800 dark:text-emerald-200">추천 호가 / 거래가</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-lg bg-emerald-50 px-2.5 py-2 dark:bg-emerald-950/30">
                  <div className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300">호가 (등록 가격)</div>
                  <div className="mt-0.5 font-black tabular-nums text-emerald-900 dark:text-emerald-100">
                    {krw(pricing.askingPrice)}
                  </div>
                  <div className="mt-0.5 text-[9px] font-bold text-emerald-600/80 dark:text-emerald-300/80">
                    시세 +{pricing.markupPct}% (협상 여지)
                  </div>
                </div>
                <div className="rounded-lg bg-white px-2.5 py-2 dark:bg-zinc-900/60">
                  <div className="text-[9px] font-bold text-zinc-600 dark:text-zinc-400">거래가 (목표)</div>
                  <div className="mt-0.5 font-black tabular-nums text-zinc-800 dark:text-zinc-100">
                    {krw(pricing.targetClosePrice)}
                  </div>
                  <div className="mt-0.5 text-[9px] font-bold text-zinc-500 dark:text-zinc-400">
                    시세 기준 (협상 후 최저)
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[10px] font-bold leading-4 text-emerald-700/80 dark:text-emerald-200/80">
                {helper.priceNote}
              </div>
            </div>
          ) : null}

          {/* 추천 제목 */}
          <div className="rounded-xl border border-emerald-200 bg-white/85 p-3 dark:border-emerald-900/60 dark:bg-zinc-900/55">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-black text-emerald-800 dark:text-emerald-200">추천 제목</div>
              <button
                type="button"
                onClick={() => copyText(recommendedTitle, setCopiedTitle)}
                className="rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-black text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
              >
                {copiedTitle ? "복사됨" : "복사"}
              </button>
            </div>
            <div className="mt-1.5 break-keep rounded-md bg-zinc-50 px-2.5 py-2 text-[11px] font-bold leading-5 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {recommendedTitle}
            </div>
            <div className="mt-1.5 text-[10px] font-semibold leading-4 text-zinc-500 dark:text-zinc-400">
              제목 패턴: <span className="font-mono">{helper.titlePattern}</span>
              <br />
              상태/구성품 정보로 빈 자리를 채우세요.
            </div>
          </div>

          {/* 본문 템플릿 */}
          <div className="rounded-xl border border-emerald-200 bg-white/85 p-3 dark:border-emerald-900/60 dark:bg-zinc-900/55">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-black text-emerald-800 dark:text-emerald-200">본문 템플릿 (복붙)</div>
              <button
                type="button"
                onClick={() => copyText(bodyTemplate, setCopiedBody)}
                className="rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-black text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
              >
                {copiedBody ? "복사됨" : "복사"}
              </button>
            </div>
            <pre className="mt-1.5 max-h-[200px] overflow-auto whitespace-pre-wrap break-keep rounded-md bg-zinc-50 px-2.5 py-2 text-[11px] font-semibold leading-5 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {bodyTemplate}
            </pre>
          </div>

          {/* 사진 가이드 */}
          <div className="rounded-xl border border-emerald-200 bg-white/85 p-3 dark:border-emerald-900/60 dark:bg-zinc-900/55">
            <div className="text-[11px] font-black text-emerald-800 dark:text-emerald-200">
              필수 사진 {requiredPhotos.length}장
              {optionalPhotos.length > 0 ? (
                <span className="ml-1 font-bold text-emerald-600/80 dark:text-emerald-300/80">
                  + 선택 {optionalPhotos.length}장
                </span>
              ) : null}
            </div>
            <ol className="mt-2 space-y-1.5">
              {requiredPhotos.map((photo, idx) => (
                <li
                  key={photo.title}
                  className="rounded-md border border-emerald-100 bg-emerald-50/70 px-2.5 py-1.5 dark:border-emerald-900/40 dark:bg-emerald-950/25"
                >
                  <div className="flex items-start gap-2 text-[11px]">
                    <span className="shrink-0 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-black text-emerald-900 dark:text-emerald-100">
                        {photo.title}
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold leading-4 text-emerald-700/85 dark:text-emerald-200/85">
                        {photo.detail}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              {optionalPhotos.map((photo, idx) => (
                <li
                  key={photo.title}
                  className="rounded-md border border-zinc-200 bg-white/60 px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/40"
                >
                  <div className="flex items-start gap-2 text-[11px]">
                    <span className="shrink-0 rounded-full bg-zinc-400 px-1.5 py-0.5 text-[9px] font-black text-white">
                      +{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-black text-zinc-800 dark:text-zinc-100">
                        {photo.title}
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold leading-4 text-zinc-600 dark:text-zinc-400">
                        {photo.detail}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* 카테고리별 팁 */}
          <div className="rounded-xl bg-emerald-100 px-3 py-2 dark:bg-emerald-950/35">
            <div className="text-[10px] font-black text-emerald-800 dark:text-emerald-200">💡 카테고리 팁</div>
            <div className="mt-1 text-[11px] font-semibold leading-5 text-emerald-900 dark:text-emerald-100">
              {helper.proTip}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function sellerQuestionText(card: RevealCard) {
  return [
    `${card.name} 보고 문의드립니다.`,
    "1. 표시 가격에 택배비가 포함돼 있나요?",
    "2. 번개페이/안전결제 수수료는 누가 부담하나요?",
    "3. 구성품은 사진과 설명에 보이는 것 전부 포함인가요?",
  ].join("\n");
}

function CostAssurancePanel({ card }: { card: RevealCard }) {
  const [copied, setCopied] = useState(false);
  const snapshot = costAssuranceSnapshot(card);
  const feeRateLabel = `${Math.round(SELLING_FEE_RATE * 1000) / 10}%`;
  const questions = sellerQuestionText(card);
  const rows = [
    { label: "상품가", value: krw(card.price), note: "현재 매입 기준" },
    { label: "구매자 배송비", value: snapshot.shippingLabel, note: "택포/별도 문구는 구매 전 재확인" },
    { label: "거래/안전결제 수수료", value: "문의 필요", note: "판매자 부담/구매자 부담 문구 확인" },
    {
      label: "순익 차감",
      value: `판매 ${feeRateLabel}${snapshot.sellingFee == null ? "" : ` ${krw(snapshot.sellingFee)}`} · 재배송 ${krw(RESELL_SHIPPING_FEE)} · 버퍼 ${krw(SAFETY_BUFFER)}`,
      note: "미확인 비용을 보수적으로 흡수",
    },
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

  return (
    <section className="mt-2 rounded-2xl border border-[#ded7ca] bg-[#fffaf2] p-3 shadow-[0_10px_24px_rgba(49,66,56,0.07)] dark:border-zinc-800 dark:bg-zinc-900/55">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-black text-[#5d735f] dark:text-emerald-300">
            최종 매입가 체크
          </div>
          <div className="mt-0.5 text-lg font-black leading-tight tabular-nums text-[#223127] dark:text-zinc-50 sm:text-base">
            {snapshot.buyerCostLabel}
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${snapshot.confidenceClass}`}>
          {snapshot.confidenceLabel}
        </span>
      </div>
      <div className="mt-2 divide-y divide-[#ece2d4] rounded-xl border border-[#eee5d8] bg-white/72 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/35">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[86px_minmax(0,1fr)] gap-2 px-2.5 py-2 text-[11px] leading-5 sm:grid-cols-[104px_minmax(0,1fr)]">
            <div className="font-black text-[#667263] dark:text-zinc-400">{row.label}</div>
            <div className="min-w-0">
              <div className="break-keep font-black tabular-nums text-[#26352a] dark:text-zinc-100">
                {row.value}
              </div>
              <div className="text-[10px] font-semibold text-[#7c8779] dark:text-zinc-500">
                {row.note}
              </div>
            </div>
          </div>
        ))}
      </div>
      {snapshot.salePrice != null ? (
        <div className="mt-2 rounded-xl bg-[#f5efe4] px-3 py-2 text-[11px] font-bold leading-5 text-[#657060] dark:bg-zinc-950/40 dark:text-zinc-300">
          시세 {krw(snapshot.salePrice)} - 매입 {snapshot.buyerCostLabel} - 재판매 비용 = 예상 순익 {displayProfitRange(card)}
        </div>
      ) : null}
      {(() => {
        const guidance = buyPriceGuidance({
          price: card.price,
          medianPrice: card.marketBasis?.medianPrice ?? null,
        });
        if (!guidance) return null;
        const verdictClass = guidance.verdict === "good"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
          : guidance.verdict === "warn"
            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
            : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200";
        return (
          <div className="mt-2 rounded-xl border border-[#d8e2d7] bg-white/85 p-3 dark:border-zinc-800 dark:bg-zinc-900/55">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-black text-[#5d735f] dark:text-emerald-300">
                매입가 판단 가이드
              </div>
              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500">
                손익분기 {krw(guidance.breakEven)}
              </span>
            </div>
            <div className="mt-1.5 grid gap-1 rounded-lg border border-[#eee5d8] bg-white/72 px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-950/35">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-zinc-500 dark:text-zinc-400">추천 매입가</span>
                <span className="font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                  ~{krw(guidance.targetBuy)}
                  <span className="ml-1 text-[9px] font-bold text-zinc-500 dark:text-zinc-500">+18% 확보</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-zinc-500 dark:text-zinc-400">패스 기준</span>
                <span className="font-black tabular-nums text-rose-700 dark:text-rose-300">
                  {krw(guidance.passBuy)} 이상
                  <span className="ml-1 text-[9px] font-bold text-zinc-500 dark:text-zinc-500">손 떼기</span>
                </span>
              </div>
            </div>
            <div className={`mt-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-black ${verdictClass}`}>
              현재 {guidance.verdictLabel}
              <span className="ml-1 font-bold opacity-80">· {guidance.verdictSub}</span>
            </div>
            <div className="mt-1.5 text-[9px] font-bold leading-4 text-zinc-400 dark:text-zinc-500">
              협상 천장이 아니라 &lsquo;여기서 손 떼기&rsquo; 기준이에요. 패스 기준 이상이면 다른 매물 보세요.
            </div>
          </div>
        );
      })()}
      <details className="mt-2 rounded-xl border border-[#d8e2d7] bg-[#f6fbf2] px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-black text-[#4f6a52] dark:text-emerald-200">
          <span>문의 전에 확인할 3개</span>
          <span className="text-[10px] font-bold text-[#748071] dark:text-zinc-400">복붙 가능</span>
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] font-semibold leading-5 text-[#5f6d5f] dark:text-zinc-300">
          <li>표시 가격에 택배비가 포함돼 있는지</li>
          <li>번개페이/안전결제 수수료를 누가 부담하는지</li>
          <li>구성품이 사진과 설명에 보이는 것 전부인지</li>
        </ol>
        <button
          type="button"
          onClick={handleCopy}
          className="mt-2 w-full rounded-lg border border-[#b9d0b4] bg-white px-3 py-2 text-[11px] font-black text-[#3f5e45] shadow-sm transition hover:bg-[#eef7eb] dark:border-emerald-900/60 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-zinc-800"
        >
          {copied ? "복사됨" : "문의 문장 복사"}
        </button>
      </details>
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
        <div className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-[var(--brand-accent)] to-[var(--brand-accent-strong)] shadow-lg shadow-[rgba(92,116,95,0.35)]" />
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
          번개장터 실시간 검증 · 시세 재계산 · 리스크 필터
        </div>
      </div>
    </div>
  );
}

function RevealCardItem({
  card,
  delay,
  currentFeedbackType,
}: {
  card: RevealCard;
  delay: number;
  currentFeedbackType?: string | null;
}) {
  const [shown, setShown] = useState(false);
  const isMarketInvalidated = Math.min(card.expectedProfitMin, card.expectedProfitMax) <= 0;
  const sourceBadge = marketSourceBadge(card);
  const netPct = netProfitPercent(card);
  // Wave 2026-05-19 v2: grossGap, dailyProfit 표시 제거 (일반인 헷갈림 / 노이즈 큼).
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);

  return (
    <div
      className={`grid gap-3 transition-all duration-700 lg:grid-cols-2 ${
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      {/* 좌측 카드 — 매물 정보 (image + 메타 + verdicts + 노트 + 버튼) */}
      <div className="order-1 grid gap-3 overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none ring-0 dark:bg-transparent sm:rounded-2xl sm:border sm:border-[#dfd6c9] sm:bg-[linear-gradient(180deg,#fffdf9_0%,#fbf6ee_100%)] sm:p-3 sm:shadow-[0_16px_34px_rgba(49,66,56,0.09)] sm:ring-1 sm:ring-white/70 sm:dark:border-zinc-800 sm:dark:bg-none sm:dark:bg-zinc-900 sm:dark:ring-zinc-800/70 sm:grid-cols-[132px_minmax(0,1fr)] lg:grid-cols-[150px_minmax(0,1fr)]">
        <RevealProductImage card={card} />

        <div className="min-w-0 w-full space-y-2.5 px-3 sm:px-0">
          <div className="flex w-full items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-[17px] font-black leading-6 text-[#18251c] dark:text-zinc-50">
                {card.name}
              </div>
              <div className={`mt-1.5 w-full px-0 py-0 ${
                isMarketInvalidated
                  ? "text-rose-500 dark:text-rose-400"
                  : "text-[#00a862] dark:text-[#5dffae]"
              }`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`text-[13px] font-bold ${
                    isMarketInvalidated ? "text-rose-600 dark:text-rose-300" : "text-zinc-500 dark:text-zinc-400"
                  }`}>
                    예상 순익
                  </span>
                  <span className={`text-lg font-black leading-tight tabular-nums sm:text-sm sm:font-bold ${
                    isMarketInvalidated ? "text-rose-700 dark:text-rose-200" : "text-[#00a862] dark:text-[#5dffae]"
                  }`}>
                    {displayProfitRange(card)}
                  </span>
                  {netPct != null ? (
                    <span className="rounded-full bg-[#f7f3ea] px-1.5 py-0.5 text-[13px] font-black tabular-nums text-[#59665c] ring-1 ring-[#e7dece] dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
                      {netPct >= 0 ? "+" : ""}{netPct}%
                    </span>
                  ) : null}
                  {/* Wave 2026-05-19 v2 (사용자 피드백): "총차익" 칩 제거 — 일반인이 "예상 순익"과 헷갈림.
                      "최악 시 -X원" 배지도 제거 — 시세 -10% 가정이 임의적이고 일반인 망설임만 키움. */}
                  {isMarketInvalidated ? (
                    <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-black text-rose-900 dark:bg-rose-900/60 dark:text-rose-100">
                      판매완료 처리
                    </span>
                  ) : null}
                </div>
                {/* Wave 2026-05-19 v2 (사용자 피드백): "일수익 표본 부족 · 참고용" 거의 모든 매물에 떠서 가치 없음 → 제거.
                    회수 속도 정보는 UpperFold 회수 속도 타일에서 보임. */}
                <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[13px] font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
                  <span>매입 {krw(card.price)}</span>
                  {card.marketBasis?.medianPrice ? (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-600">·</span>
                      <span className="text-zinc-500 dark:text-zinc-300">시세 {krw(card.marketBasis.medianPrice)}</span>
                      {sourceBadge ? (
                        sourceBadge.tone === "reference"
                          ? <DanawaSourceBadge label={sourceBadge.label} />
                          : <BunjangSourceBadge label={sourceBadge.label} />
                      ) : null}
                    </>
                  ) : null}
                  <span className="text-xs font-semibold text-zinc-400">{freshLabel(card.freshSeconds)}</span>
                  {card.optionBaseAssumed && card.optionBaseAssumed.length > 0 ? (
                    <span
                      title={`이 매물은 ${card.optionBaseAssumed.join(", ")} 명시 안 됨 → SKU 기본 옵션 가정 시세로 계산. 실제 매물이 고옵션이면 차익이 더 클 수 있어요.`}
                      className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    >
                      기본 옵션 가정
                    </span>
                  ) : null}
                </div>
                <UpperFoldFearReducers card={card} />
                <CostAssurancePanel card={card} />
                <SellerTrustPanel card={card} />
                <CounterfeitChecklistPanel card={card} />
                <SellHelperPanel card={card} currentFeedbackType={currentFeedbackType} />
              </div>
              <RecommendationReasonPanel
                card={card}
                className="mt-2 border-t border-[#e1dacd] pt-2 sm:rounded-xl sm:border sm:p-3 sm:shadow-none sm:ring-0"
              />
            </div>
            <details className="group hidden shrink-0 rounded-full border border-[#d9e5d7] bg-[#f4faf1] px-3 py-1 text-right shadow-sm dark:border-zinc-700 dark:bg-zinc-800 sm:block sm:min-w-[72px]">
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

        <div className="hidden sm:block">
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
        <div className="hidden sm:block">
          <MarketBasisMini card={card} />
        </div>
      </div>
      </div>
      {/* 좌측 카드 닫음 — 우측 카드 = 시세 그래프 + 디테일. */}

      {/* 우측 카드 — 시세 그래프 + 회전/유입 (시각 강조). */}
      <div className="order-2 mx-3 space-y-2 rounded-2xl border border-[#dfd6c9] bg-[linear-gradient(180deg,#fffdf9_0%,#fbf7ef_100%)] p-3 shadow-[0_16px_34px_rgba(49,66,56,0.08)] ring-1 ring-white/70 dark:border-zinc-800 dark:bg-none dark:bg-zinc-900 dark:ring-zinc-800/70 sm:mx-0 lg:order-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-black uppercase tracking-widest text-[#5d735f] dark:text-emerald-400">
            시세 그래프 · 시장 분석
          </div>
          <span className="rounded-full bg-[#eef6ec] px-2 py-0.5 text-[10px] font-black text-[#4f6a52] ring-1 ring-[#d8e2d7] dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
            실시간 근거
          </span>
        </div>

        {/* 2026-05-15: 시세 30일 추이 chart (active/sold median). 사용자 베타테스터 질문 응답 — */}
        {/* "시세 어떤 기준으로 잡나" 시각화. history 부족하면 자동 hide. */}
        {/* 2026-05-16 (코멘트 id 105): conditionClass 전달 → 그래프도 같은 condition 매물 기준. */}
        <MarketHistoryChart
          comparableKey={card.marketBasis?.comparableKey ?? null}
          currentPrice={card.price}
          conditionClass={card.marketBasis?.conditionClass ?? null}
          priceSource={card.marketBasis?.priceSource ?? null}
          referencePrice={card.marketBasis?.priceSource === "reference" ? card.marketBasis?.medianPrice ?? null : null}
        />
        <MarketGraphTrustLine card={card} />

        <SkuListingFlowMini card={card} />
      </div>
      {/* 우측 카드 (시세 분석) 닫음. */}

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
      <div className="flex max-h-[calc(100vh-24px)] items-center justify-center overflow-hidden rounded-2xl border border-[#ddd6ca] bg-[#fffdf9] p-6 shadow-2xl shadow-[rgba(49,66,56,0.16)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-sm font-semibold text-zinc-500 dark:text-zinc-300">공략 정보를 정리하는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex max-h-[calc(100vh-24px)] overflow-hidden rounded-2xl border border-[#ddd6ca] bg-[#fffdf9] shadow-2xl shadow-[rgba(49,66,56,0.16)] dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex min-h-0 w-full flex-col">
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-sm font-black text-[var(--brand-accent-strong)] dark:text-zinc-100">공략 정보를 아직 불러오지 못했어요</div>
            <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{error}</p>
          </div>
          <div className="p-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-[#d5dfd2] bg-white px-4 py-3 text-center text-sm font-bold text-[var(--brand-accent-strong)] transition hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
    <div className="rounded-2xl border border-[#e7dece] bg-[#fffdf9] p-2 dark:border-zinc-800 dark:bg-zinc-900 sm:p-3">
      <div className="sm:hidden">
        <div className="flex items-center gap-1.5">
          <details className="group relative min-w-0 flex-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-[#d8d2c6] bg-white/85 px-2.5 py-1.5 text-[11px] font-bold text-[#425247] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
              <span>거래 상태</span>
              <span className="truncate text-[var(--brand-accent-strong)] dark:text-zinc-200">{statusLabel}</span>
            </summary>
            <div className="absolute inset-x-0 bottom-[calc(100%+8px)] z-20 rounded-xl border border-[#e1dacd] bg-[#fffdf9] p-2 shadow-2xl shadow-[rgba(49,66,56,0.18)] dark:border-zinc-800 dark:bg-zinc-950">
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
                          ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-sm shadow-[rgba(49,66,56,0.18)]"
                          : "border-[#d8d2c6] bg-[#fffdf9] text-[#425247] hover:border-[#b9c9b9] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
                              ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-sm shadow-[rgba(49,66,56,0.18)]"
                              : "border-[#d8d2c6] bg-[#fffdf9] text-[#425247] hover:border-[#b9c9b9] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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

      <div className="hidden sm:block">
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
                      ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-sm shadow-[rgba(49,66,56,0.18)]"
                      : "border-[#d8d2c6] bg-[#fffdf9] text-[#425247] hover:border-[#b9c9b9] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
                          ? "border-[var(--brand-accent-strong)] bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-sm shadow-[rgba(49,66,56,0.18)]"
                          : "border-[#d8d2c6] bg-[#fffdf9] text-[#425247] hover:border-[#b9c9b9] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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

function FixedBunjangFooter({
  card,
  onLinkClicked,
}: {
  card: RevealCard;
  onLinkClicked: (pid: number) => void;
}) {
  const safetyScore = buildRiskScore(revealRiskScoreInput(card));
  return (
    <div className="shrink-0 border-t border-[#e7dece] bg-[#fffdf9]/95 p-2 shadow-[0_-10px_24px_rgba(49,66,56,0.10)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:p-3">
      <div className="grid grid-cols-[minmax(0,0.86fr)_minmax(0,1.18fr)] gap-2">
        <RevealRiskScoreMini
          card={card}
          containerClassName="flex w-full min-w-0"
          triggerLabel={safetyScore.label}
          hideChevron
          portalDetail
          triggerClassName={fixedSafetyCtaClass(safetyScore.tone)}
        />
        <a
          href={card.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => onLinkClicked(card.pid)}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#00a862] bg-[#00c471] px-3 py-3 text-center text-sm font-black text-white shadow-lg shadow-[rgba(0,196,113,0.28)] ring-1 ring-[#80e8bd]/70 transition hover:bg-[#00b267]"
        >
          <BunjangLogo className="h-[18px] w-[18px] rounded-[5px]" />
          번개장터에서 확인하기
        </a>
      </div>
    </div>
  );
}

function RelatedRevealStrip({
  items,
  onBeforeOpenRelatedItem,
  onOpenRelatedItem,
}: {
  items: RelatedRevealItem[];
  onBeforeOpenRelatedItem?: () => void;
  onOpenRelatedItem?: (pid: number) => void;
}) {
  const visibleItems = items.slice(0, 8);
  if (visibleItems.length === 0 || !onOpenRelatedItem) return null;

  return (
    <section className="mx-3 rounded-2xl border border-[#e7dece] bg-[#fffdf9] px-3 py-3 shadow-[0_8px_22px_rgba(49,66,56,0.08)] dark:border-zinc-800 dark:bg-zinc-900 sm:mx-0 sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-[#223127] dark:text-zinc-100">내 다른 추천 매물</div>
          <div className="mt-0.5 text-[11px] font-semibold text-[#7a8478] dark:text-zinc-400">
            매입가 · 시세 · 상태를 같이 보고, 열면 현재 상태를 다시 확인해요.
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-black text-[var(--brand-accent-strong)] dark:text-zinc-200">
          {visibleItems.length}개
        </span>
      </div>
      <div className="mt-2 divide-y divide-[#eee5d8] dark:divide-zinc-800">
        {visibleItems.map((item) => {
          const sourceBadge = item.marketBasis
            ? item.marketBasis.priceSource === "reference"
              ? { tone: "reference" as const, label: "다나와" }
              : item.marketBasis.conditionClass === "mint"
                ? { tone: "mint" as const, label: "번개 S급" }
                : null
            : null;
          return (
            <button
              key={item.pid}
              type="button"
              onClick={() => {
                onBeforeOpenRelatedItem?.();
                onOpenRelatedItem(item.pid);
              }}
              className="group grid w-full min-w-0 grid-cols-[92px_minmax(0,1fr)] gap-3 rounded-xl px-1.5 py-3 text-left transition hover:bg-[#f6fbf2] dark:hover:bg-zinc-800/70 sm:grid-cols-[104px_minmax(0,1fr)]"
            >
              <div className="relative aspect-square shrink-0 overflow-hidden rounded-lg bg-[#f2eadf] dark:bg-zinc-800">
                <ConditionPhotoBadge conditionClass={item.marketBasis?.conditionClass ?? null} compact />
                {item.thumbnailUrl ? (
                  <Image
                    src={item.thumbnailUrl}
                    alt=""
                    fill
                    sizes="104px"
                    className="object-cover transition duration-200 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-2 text-center text-[11px] font-bold text-[#7a8478] dark:text-zinc-400">
                    사진 없음
                  </div>
                )}
              </div>
              <div className="min-w-0 self-center">
                <div className="line-clamp-2 text-[15px] font-black leading-5 text-[#223127] dark:text-zinc-100">
                  {item.name}
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px] font-semibold text-[#6b7269] dark:text-zinc-400">
                  <span>매입 <b className="font-black tabular-nums text-[#223127] dark:text-zinc-100">{krw(item.price)}</b></span>
                  {item.marketBasis?.medianPrice ? (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-600">·</span>
                      <span>시세 <b className="font-black tabular-nums text-[#223127] dark:text-zinc-100">{krw(item.marketBasis.medianPrice)}</b></span>
                      {sourceBadge ? (
                        sourceBadge.tone === "reference"
                          ? <DanawaSourceBadge label={sourceBadge.label} />
                          : <BunjangSourceBadge label={sourceBadge.label} />
                      ) : null}
                    </>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-black tabular-nums text-[#00a862] dark:text-[#5dffae]">
                    {profitRange(item.expectedProfitMin, item.expectedProfitMax)}
                  </span>
                  {item.marketBasis?.conditionLabel ? (
                    <span className="rounded-full bg-[#f7f3ea] px-1.5 py-0.5 text-[10px] font-black text-[#59665c] ring-1 ring-[#e7dece] dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
                      {item.marketBasis.conditionLabel}
                    </span>
                  ) : null}
                  <span className="text-[10px] font-bold text-[#8a9388] dark:text-zinc-500">상태 재확인</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

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
  currentFeedbackType,
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
  const activeRevealPid = result?.result === "success" ? result.reveals[0]?.pid ?? null : null;

  const resetDetailScroll = useCallback((behavior: ScrollBehavior = "auto") => {
    const node = scrollAreaRef.current;
    if (!node) return;
    node.scrollTop = 0;
    node.scrollTo({ top: 0, behavior });
  }, []);

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

  const handleClose = useCallback(() => {
    closePreviewPanel();
    onClose();
  }, [closePreviewPanel, onClose]);

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
    void onLoadDetail(initialPreviewCard.pid).catch((err) => {
      console.error("[pack-reveal-modal] lazy detail analysis load failed", err);
    });
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
    onLoadDetail,
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
      className="fixed inset-0 z-[90] flex items-stretch justify-stretch overscroll-contain bg-[#fffdf9] p-0 dark:bg-zinc-950 sm:items-center sm:justify-center sm:bg-[rgba(31,40,34,0.48)] sm:p-6 sm:backdrop-blur-sm sm:dark:bg-[rgba(9,9,11,0.62)]"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!loading) handleClose();
      }}
    >
      <div
        className="flex h-dvh max-h-dvh w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-[#fffdf9] shadow-none dark:bg-zinc-900 sm:h-auto sm:max-h-[88vh] sm:max-w-6xl sm:rounded-2xl sm:border sm:border-[#ddd6ca] sm:shadow-2xl sm:shadow-[rgba(49,66,56,0.16)] sm:dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 shrink-0 border-b border-[#e2dbcf] bg-[#fffdf9]/95 px-2.5 py-1.5 text-[var(--brand-accent-strong)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:px-3">
          <div className="flex min-h-8 items-center justify-between gap-3">
            {!loading ? (
              <button
                type="button"
                onClick={handleClose}
                aria-label="상세 닫기"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d7d1c5] bg-white/80 text-lg font-black leading-none text-[var(--brand-accent-strong)] shadow-sm backdrop-blur transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <span aria-hidden="true">←</span>
              </button>
            ) : (
              <span className="h-8 w-8" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1" aria-hidden="true" />
            {!loading ? (
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-9 shrink-0 items-center rounded-xl bg-[var(--brand-accent-strong)] px-3 text-xs font-black text-[var(--brand-cream)] shadow-[0_8px_14px_rgba(92,116,95,0.18)] transition hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-950"
              >
                대시보드
              </button>
            ) : (
              <span className="h-8 w-[72px]" aria-hidden="true" />
            )}
          </div>
        </div>

        <div
          key={activeRevealPid ?? "empty"}
          ref={scrollAreaRef}
          className="min-h-0 flex-1 overflow-y-auto px-0 pb-3 pt-0 sm:p-4"
        >
          {displayLoading ? (
            <div className="space-y-4 px-3 sm:px-0">
              <LoadingStage completing={completing} />
              <div className="animate-pulse">
                <RevealResultSkeleton />
              </div>
            </div>
          ) : null}

          {!displayLoading && result?.result === "success" ? (
            <div className="space-y-4">
              <div>
                {/* 2026-05-17: 각 RevealCardItem 자체가 lg:grid-cols-2 (listing card + market card).
                    outer grid 는 1 column — 한 줄에 1 매물 (= 2 카드 옆에). */}
                <div className="grid gap-4">
                  {result.reveals.map((card, idx) => (
                    <RevealCardItem
                      key={card.pid}
                      card={card}
                      delay={idx * 250}
                      currentFeedbackType={currentFeedbackType}
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
                onBeforeOpenRelatedItem={() => resetDetailScroll("auto")}
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
              <details className="border-t border-[#e5dccf] pt-3 text-[11px] font-semibold leading-5 text-[#7a8478] dark:border-zinc-800 dark:text-zinc-500">
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
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-700"
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
                  className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-700"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {!displayLoading && result?.result === "success" && result.reveals[0] ? (
          <FixedBunjangFooter
            card={result.reveals[0]}
            onLinkClicked={onLinkClicked}
          />
        ) : null}
      </div>
    </div>
  );
}

export type { RevealResult };
