"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import MarketHistoryChart from "@/components/market-history-chart";
import ModelGuidePanel from "@/components/model-guide-panel";
import { ConditionPhotoBadge } from "@/components/condition-chip";
import { RiskScoreBar } from "@/components/risk-score-bar";
import { LiquidityCurveMini } from "@/components/liquidity-curve-mini";
import { BunjangLogo, BunjangSourceBadge, DanawaLogo, DanawaSourceBadge } from "@/components/market-brand-logo";
import { CheckCircleIcon, ScaleIcon, ShieldIcon, TargetIcon, WalletIcon } from "@/components/icons";
import { findModelGuide, type ModelGuide } from "@/lib/model-guides";
import type { PackBand, RevealCard, RevealFeedbackType, RevealListingDetail } from "@/lib/pack-open";

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
  thumbnailUrl: string | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
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

function currentProfitPercent(card: RevealCard) {
  if (!card.price || card.price <= 0) return null;
  const profit = Math.round((card.expectedProfitMin + card.expectedProfitMax) / 2);
  const pct = Math.round((profit / card.price) * 100);
  return Number.isFinite(pct) ? pct : null;
}

function displayProfitRange(card: RevealCard) {
  return profitRange(card.expectedProfitMin, card.expectedProfitMax);
}

function marketSourceBadge(card: RevealCard) {
  const market = card.marketBasis;
  if (!market) return null;
  if (market.priceSource === "reference") return { label: "다나와", tone: "reference" as const };
  if (market.conditionClass === "mint") return { label: "번개 S급", tone: "mint" as const };
  return null;
}

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

  const lines: { label: string; value: string; tone?: "good" | "warn" }[] = [
    {
      label: "모델 매칭",
      value: market?.label ? `${market.label} (자동 분류)` : "분류 불완전",
      tone: market?.label ? "good" : "warn",
    },
    {
      label: "시세 표본",
      value: matchedSampleText,
      tone: sampleTone,
    },
    { label: "시세 신뢰", value: marketConfLabel, tone: marketConf === "high" ? "good" : marketConf === "low" ? "warn" : undefined },
  ];

  if (velocity?.medianHoursToSold != null && velocity.medianHoursToSold > 0) {
    const days = Math.round(velocity.medianHoursToSold / 24);
    lines.push({
      label: "판매 속도",
      value: days <= 0 ? "1일 이내" : `약 ${days}일`,
      tone: days <= 3 ? "good" : days >= 14 ? "warn" : undefined,
    });
  }

  return (
    <div className="mt-2 space-y-1.5 rounded-md bg-white p-2 text-left text-[11px] leading-4 dark:bg-zinc-900">
      <div className="text-[10px] font-bold text-zinc-400">신뢰도 산출 근거</div>
      {lines.map((line) => (
        <div key={line.label} className="flex items-center justify-between gap-2">
          <span className="text-zinc-500 dark:text-zinc-400">{line.label}</span>
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
        시세 표본이 많고 같은 모델끼리 정확히 비교됐을 때 점수가 올라가요. 표본 부족 / 분류 불완전 / 새상품·번들 같은 왜곡 매물 비중이 높으면 점수가 내려갑니다.
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
        <span className="rounded-full bg-zinc-50 px-1.5 py-0.5 tabular-nums dark:bg-zinc-800">
          표본 {market.sampleCount.toLocaleString("ko-KR")}건
        </span>
        <span className={`rounded-full px-1.5 py-0.5 ${confidenceClass}`}>
          신뢰 {confidenceLabel}
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

function RevealRiskScoreMini({ card }: { card: RevealCard }) {
  return (
    <RiskScoreBar
      descriptionPreview={card.savedDetail?.descriptionPreview ?? null}
      conditionClass={card.marketBasis?.conditionClass ?? null}
      price={card.price}
      skuMedian={card.marketBasis?.medianPrice ?? null}
      confidence={card.confidence}
      sellerReviewRating={card.savedDetail?.sellerReviewRating ?? null}
      sellerReviewCount={card.savedDetail?.sellerReviewCount ?? null}
      showDetail
      compact
    />
  );
}

function RevealProductImage({ card }: { card: RevealCard }) {
  return (
    <div className="relative h-[145px] w-full overflow-hidden rounded-lg bg-[#eee7da] dark:bg-zinc-800 sm:h-[132px] sm:w-[132px] lg:h-[150px] lg:w-[150px]">
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
          <div className="absolute inset-0 p-2.5 sm:p-2">
            <div className="relative h-full w-full">
              <Image
                src={card.thumbnailUrl}
                alt={card.name}
                fill
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 132px, 150px"
                className="rounded-md object-contain object-center drop-shadow-[0_10px_18px_rgba(34,49,39,0.18)]"
              />
            </div>
          </div>
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

function VelocityBasisMini({ card }: { card: RevealCard }) {
  const velocity = card.velocityBasis;
  if (!velocity) return null;
  // Wave 129 (2026-05-16): 회전 기간 hero 수준 강조 (사업 보고서 L6 — "사용자가 가장 두려워하는 게 안 팔리는 거").
  // 보고서 인용: "회전 기간이 떡상점수보다 더 retention-critical한 지표".
  // 큰 글씨 + 색 + 빠른 회전 시 강조 badge.
  const hours = velocity.medianHoursToSold;
  const hasTurnEstimate = hours != null && Number.isFinite(hours) && hours > 0 && velocity.sold7dCount > 0;
  const isFastTurn = hours != null && hours > 0 && hours <= 48; // 2일 안에 팔림
  const isSlowTurn = hours != null && hours > 168; // 7일+ 안 팔림
  const turnLabel = velocityHoursLabel(hours);
  const confidenceLabel = velocity.confidence === "high" ? "신뢰 높음" : velocity.confidence === "medium" ? "신뢰 보통" : "참고용";
  if (!hasTurnEstimate) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            판매 속도
          </div>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-500 ring-1 ring-zinc-200 dark:bg-zinc-900/50 dark:text-zinc-300 dark:ring-zinc-700">
            참고용
          </span>
        </div>
        <div className="mt-1 text-sm font-bold text-zinc-700 dark:text-zinc-200">
          비슷한 상품 판매 기록이 아직 부족해요.
        </div>
        <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          최근 7일 판매 {velocity.sold7dCount.toLocaleString("ko-KR")}건 · 현재 판매중 {velocity.activeSampleCount.toLocaleString("ko-KR")}건
        </div>
      </div>
    );
  }
  return (
    <div className={`rounded-lg border-2 px-4 py-3 ${
      isFastTurn
        ? "border-emerald-500 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40"
        : isSlowTurn
          ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
          : "border-[#d8e2d7] bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-800/60"
    }`}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-emerald-400">
          비슷한 상품은 보통
        </div>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--brand-accent-strong)] ring-1 ring-[#d8e2d7] dark:bg-zinc-900/50 dark:text-zinc-100 dark:ring-zinc-700">
          {confidenceLabel}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <span className={`text-2xl font-black leading-tight tabular-nums sm:text-3xl ${
          isFastTurn
            ? "text-emerald-700 dark:text-emerald-300"
            : isSlowTurn
              ? "text-amber-700 dark:text-amber-300"
              : "text-[#223127] dark:text-white"
        }`}>
          {turnLabel} 안에 팔렸어요
        </span>
        {isFastTurn && (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
            빨리 팔리는 편
          </span>
        )}
        {isSlowTurn && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">
            오래 걸리는 편
          </span>
        )}
      </div>
      <div className="mt-2 text-[11px] text-[#58705d] dark:text-zinc-300/80">
        최근 7일 동안 비슷한 상품이 <span className="font-bold">{velocity.sold7dCount.toLocaleString("ko-KR")}건</span> 팔렸고,
        현재 판매중인 비슷한 상품은 {velocity.activeSampleCount.toLocaleString("ko-KR")}건이에요.
      </div>
    </div>
  );
}

function RecommendationReasonPanel({ card, className = "" }: { card: RevealCard; className?: string }) {
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

  return (
    <details className={`group rounded-2xl border border-[#d6e2d3] bg-[linear-gradient(180deg,#f8fcf5_0%,#eef7eb_100%)] p-3 shadow-[0_12px_28px_rgba(49,66,56,0.08)] dark:border-emerald-900/40 dark:bg-none dark:bg-emerald-950/20 sm:p-3.5 lg:col-span-2 ${className}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-black text-[#223127] dark:text-zinc-100">
            <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
            왜 이걸 추천했나요?
          </div>
          <div className="mt-1 hidden text-xs font-semibold leading-5 text-[#60705f] dark:text-zinc-300 sm:block">
            {isMarketInvalidated
              ? "지금 기준으로는 차익이 없어 판매완료 상품처럼 정리하는 게 맞아요."
              : featureCards.slice(0, 2).map((feature) => feature.title).join(" · ")}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-[#b9d0b4] bg-white/90 px-2.5 py-1 text-[11px] font-black text-[#4f6a52] shadow-sm transition group-open:bg-[#e4f0e1] dark:border-emerald-900/60 dark:bg-zinc-900 dark:text-emerald-200">
          근거 보기
        </span>
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
          {marketSample > 0 ? `시세 표본 ${marketSample.toLocaleString("ko-KR")}건` : "시세 표본 부족"}
        </span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-zinc-900/60">
          {soldSample > 0 ? `판매완료 ${soldSample.toLocaleString("ko-KR")}건 반영` : "판매완료 표본 누적 중"}
        </span>
        <span className="rounded-full bg-white/80 px-2 py-0.5 dark:bg-zinc-900/60">
          {freshLabel(card.freshSeconds)}
        </span>
      </div>
    </details>
  );
}

function ProductSafetyPanel({ card, className = "" }: { card: RevealCard; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#d6e2d3] bg-[linear-gradient(180deg,#fbfdf8_0%,#f0f8ed_100%)] p-3 shadow-[0_12px_28px_rgba(49,66,56,0.07)] dark:border-emerald-900/40 dark:bg-none dark:bg-emerald-950/20 sm:p-3.5 lg:col-span-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-black text-[#223127] dark:text-zinc-100">
            안전 확인
          </div>
          <div className="mt-1 hidden text-xs font-semibold leading-5 text-[#60705f] dark:text-zinc-300 sm:block">
            추천 풀 통과 후 남은 확인 포인트만 따로 봅니다.
          </div>
        </div>
        <RevealRiskScoreMini card={card} />
      </div>
    </div>
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
  onFeedback,
}: {
  card: RevealCard;
  delay: number;
  onFeedback: (pid: number, feedbackType: RevealFeedbackType, note?: string) => void;
}) {
  const [shown, setShown] = useState(false);
  const [, setFeedback] = useState<RevealFeedbackType | null>(null);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const isMarketInvalidated = Math.min(card.expectedProfitMin, card.expectedProfitMax) <= 0;
  const sourceBadge = marketSourceBadge(card);
  const currentPct = currentProfitPercent(card);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);

  // Wave 80: 신고 코멘트 저장 — bad_pick 피드백 type으로 통합 (서버 schema 그대로)
  function handleSaveNote() {
    const cleanNote = note.trim();
    if (!cleanNote) return;
    setFeedback("bad_pick");
    setNoteSaved(true);
    onFeedback(card.pid, "bad_pick", cleanNote);
  }

  return (
    <div
      className={`grid gap-3 transition-all duration-700 lg:grid-cols-2 ${
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      {/* 좌측 카드 — 매물 정보 (image + 메타 + verdicts + 노트 + 버튼) */}
      <div className="order-1 grid gap-3 overflow-hidden rounded-2xl border border-[#dfd6c9] bg-[linear-gradient(180deg,#fffdf9_0%,#fbf6ee_100%)] p-3 shadow-[0_16px_34px_rgba(49,66,56,0.09)] ring-1 ring-white/70 dark:border-zinc-800 dark:bg-none dark:bg-zinc-900 dark:ring-zinc-800/70 sm:grid-cols-[132px_minmax(0,1fr)] lg:grid-cols-[150px_minmax(0,1fr)]">
        <RevealProductImage card={card} />

        <div className="min-w-0 w-full space-y-2.5">
          <div className="flex w-full items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-[15px] font-black leading-5 text-[#18251c] dark:text-zinc-50">
                {card.name}
              </div>
              <div className={`mt-2 w-full border-l-[3px] px-2.5 py-1.5 ${
                isMarketInvalidated
                  ? "border-rose-400 text-rose-500 dark:border-rose-500 dark:text-rose-400"
                  : "border-[#00c471] text-[#00c471] dark:border-[#5dffae] dark:text-[#5dffae]"
              }`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`text-[11px] font-semibold ${
                    isMarketInvalidated ? "text-rose-600 dark:text-rose-300" : "text-zinc-500 dark:text-zinc-400"
                  }`}>
                    현재 차익
                  </span>
                  <span className={`text-xs font-bold leading-tight tabular-nums sm:text-sm ${
                    isMarketInvalidated ? "text-rose-700 dark:text-rose-200" : "text-[#00a862] dark:text-[#5dffae]"
                  }`}>
                    {displayProfitRange(card)}
                  </span>
                  {currentPct != null ? (
                    <span className="rounded-full bg-[#f7f3ea] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#59665c] ring-1 ring-[#e7dece] dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
                      {currentPct >= 0 ? "+" : ""}{currentPct}%
                    </span>
                  ) : null}
                  {isMarketInvalidated ? (
                    <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-black text-rose-900 dark:bg-rose-900/60 dark:text-rose-100">
                      판매완료 처리
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px] font-bold tabular-nums text-zinc-700 dark:text-zinc-200 sm:text-xs">
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
                  <span className="text-[11px] font-semibold text-zinc-400">{freshLabel(card.freshSeconds)}</span>
                  {card.optionBaseAssumed && card.optionBaseAssumed.length > 0 ? (
                    <span
                      title={`이 매물은 ${card.optionBaseAssumed.join(", ")} 명시 안 됨 → SKU 기본 옵션 가정 시세로 계산. 실제 매물이 고옵션이면 차익이 더 클 수 있어요.`}
                      className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    >
                      기본 옵션 가정
                    </span>
                  ) : null}
                </div>
              </div>
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

        {/* 시세 근거 (요약) — desktop/tablet 카드. mobile은 "왜 이걸 추천했나요?" 안으로 접어 첫 화면 밀도를 낮춤. */}
        <div className="hidden sm:block">
          <MarketBasisMini card={card} />
        </div>
      </div>
      </div>
      {/* 좌측 카드 닫음 — 우측 카드 = 시세 그래프 + 디테일. */}

      <RecommendationReasonPanel card={card} className="order-2 lg:order-3" />
      <ProductSafetyPanel card={card} className="order-3 lg:order-4" />

      {/* 우측 카드 — 시세 그래프 + 회전/유입 (시각 강조). */}
      <div className="order-4 space-y-2 rounded-2xl border border-[#dfd6c9] bg-[linear-gradient(180deg,#fffdf9_0%,#fbf7ef_100%)] p-3 shadow-[0_16px_34px_rgba(49,66,56,0.08)] ring-1 ring-white/70 dark:border-zinc-800 dark:bg-none dark:bg-zinc-900 dark:ring-zinc-800/70 lg:order-2">
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

        <VelocityBasisMini card={card} />

        {/* Wave 183 (2026-05-17): Liquidity 곡선 — 가격대별 회전 추정 (자본 묶임 두려움 해소).
            사업 보고서 L6 — "회전 기간이 떡상점수보다 retention-critical". */}
        <LiquidityCurveMini
          price={card.price}
          p25Price={card.marketBasis?.p25Price ?? null}
          medianPrice={card.marketBasis?.medianPrice ?? null}
          p75Price={card.marketBasis?.p75Price ?? null}
          p25Hours={card.velocityBasis?.p25HoursToSold ?? null}
          medianHours={card.velocityBasis?.medianHoursToSold ?? null}
          p75Hours={card.velocityBasis?.p75HoursToSold ?? null}
          soldSampleCount={card.velocityBasis?.observedSoldSampleCount ?? null}
        />

        <SkuListingFlowMini card={card} />
      </div>
      {/* 우측 카드 (시세 분석) 닫음. */}

      {/* 노트 + 버튼 영역 — full width (lg:col-span-2). */}
      <div className="order-5 space-y-2 lg:col-span-2">
        {/* Wave 80: SavedDetailMini (찜/리뷰/리뷰N개/판매자 설명문) 제거 — 번개장터 데이터 직접 노출 법적 위험. 원본은 "번개장터 열기" 버튼으로 확인. */}

        {/* Wave 80: 개별 피드백 버튼 (관심/매수함/이미 팔림/별로) + quickTags (단품 의심 등) 제거.
            단일 "추천 상품이 이상해요" 신고 버튼 + 코멘트 폼으로 대체. */}
        <details className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-800/50">
          <summary className="cursor-pointer font-bold text-zinc-500 dark:text-zinc-300">
            검증 메모 · 추천 평가 {noteSaved ? "· 저장됨" : ""}
          </summary>
          <div className="mt-2 space-y-2">
            <div className="text-[10.5px] leading-[1.5] text-zinc-500 dark:text-zinc-400">
              매물 검증 결과 / 의심점 / 추천 품질 평가 자유 기록. 나중에 일괄 검토용.
            </div>
            <textarea
              id={`reveal-note-${card.pid}`}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setNoteSaved(false);
              }}
              maxLength={5000}
              rows={3}
              placeholder="예) 시세 비교 OK / 단품 의심 / 가격 비교 틀린 듯 / 사진 애매 / 이거 좋은 추천 / 이미 팔린 것 같음 등 자유"
              className="w-full resize-none rounded-lg border border-[#ddd6ca] bg-white px-3 py-2 text-xs leading-5 text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] text-zinc-400">{note.length}/5000</div>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={!note.trim()}
                className="rounded-lg bg-[var(--brand-accent-strong)] px-3 py-1.5 text-[11px] font-bold text-[var(--brand-cream)] transition hover:bg-[#29382f] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
              >
                저장
              </button>
            </div>
          </div>
        </details>

      </div>
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
  return (
    <div className="shrink-0 border-t border-[#e7dece] bg-[#fffdf9]/95 p-2 shadow-[0_-10px_24px_rgba(49,66,56,0.10)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:p-3">
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
    <section className="rounded-2xl border border-[#e7dece] bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-[#223127] dark:text-zinc-100">내 다른 추천 매물</div>
          <div className="mt-0.5 text-[11px] font-semibold text-[#7a8478] dark:text-zinc-400">
            /me 목록 캐시 기준 · 열면 다시 상태 확인
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[#eef6ec] px-2 py-0.5 text-[10px] font-black text-[var(--brand-accent-strong)] dark:bg-zinc-800 dark:text-zinc-200">
          {visibleItems.length}개
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {visibleItems.map((item) => (
          <button
            key={item.pid}
            type="button"
            onClick={() => {
              onBeforeOpenRelatedItem?.();
              onOpenRelatedItem(item.pid);
            }}
            className="group flex w-full min-w-0 gap-3 rounded-xl border border-[#e5dccf] bg-[#fffdf9] p-2 text-left transition hover:border-[#b8c8b5] hover:bg-[#f4fbf0] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            <div className="relative h-[86px] w-[86px] shrink-0 overflow-hidden rounded-lg bg-[#f2eadf] dark:bg-zinc-800 sm:h-[96px] sm:w-[96px]">
              {item.thumbnailUrl ? (
                <Image
                  src={item.thumbnailUrl}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover transition duration-200 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-2 text-center text-[11px] font-bold text-[#7a8478] dark:text-zinc-400">
                  사진 없음
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <div className="line-clamp-2 text-sm font-black leading-5 text-[#223127] dark:text-zinc-100">
                {item.name}
              </div>
              <div className="mt-1 truncate text-xs font-black tabular-nums text-[#00a862] dark:text-[#5dffae]">
                {profitRange(item.expectedProfitMin, item.expectedProfitMax)}
              </div>
              <div className="mt-2 text-[11px] font-semibold text-[#7a8478] dark:text-zinc-400">
                누르면 현재 상태 다시 확인
              </div>
            </div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] font-semibold leading-5 text-[#7a8478] dark:text-zinc-400">
        오래 머무르는 동안 판매완료될 수 있어요. 다른 매물을 누르면 상세를 열면서 현재 상태를 다시 확인합니다.
      </p>
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
        <div className="sticky top-0 z-10 shrink-0 border-b border-[#e2dbcf] bg-[#fffdf9]/95 px-3 py-2 text-[var(--brand-accent-strong)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:px-4">
          <div className="flex min-h-9 items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h2 className="truncate text-sm font-black tracking-tight sm:text-base">
                  {loading ? "추천 상품 검증 중" : result?.result === "success" ? "추천 리포트" : "검증 결과"}
                </h2>
                {!loading && result?.result === "success" ? (
                  <span className="text-[11px] font-medium text-[#7a8478] dark:text-zinc-400">
                    현재 차익 · 판매 상태 · 시세 근거 확인
                  </span>
                ) : null}
              </div>
            </div>
            {!loading ? (
              <button
                type="button"
                onClick={handleClose}
                className="shrink-0 rounded-lg border border-[#d7d1c5] bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-[var(--brand-accent-strong)] backdrop-blur transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <span className="sm:hidden">뒤로</span>
                <span className="hidden sm:inline">닫기</span>
              </button>
            ) : null}
          </div>
        </div>

        <div
          key={activeRevealPid ?? "empty"}
          ref={scrollAreaRef}
          className="min-h-0 flex-1 overflow-y-auto p-3 pb-24 sm:p-4 sm:pb-28"
        >
          {displayLoading ? (
            <div className="space-y-4">
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
                      onFeedback={onFeedback}
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
              <div className="rounded-xl border border-[#e1dacd] bg-[#fbf7ef] px-3 py-3 text-xs text-[#647064] dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400">
                <div>
                  상품 {result.attemptedCount}건 검증 → {result.reveals.length}건 추천 ·{" "}
                  {(result.durationMs / 1000).toFixed(1)}초
                </div>
                <div className="mt-1">
                  같은 전체 본품 기준으로만 비교. 단품/본체만/케이스만은 제외.
                </div>
                <div className="mt-2 border-t border-[#ebe2cf] pt-2 text-[11px] leading-[1.5] text-[#7a8478] dark:border-zinc-700/60 dark:text-zinc-500">
                  ⓘ AI 기반 시세 추천 — 수익 보장 X. 표시된 차익은 <b>해당 가격에 정상 판매됐을 때 추정 수익</b>이며,
                  실제 거래는 매입가 협상·판매 시점·시세 변동·구성품 차이로 달라질 수 있습니다.
                  최종 판단은 본인.
                </div>
              </div>
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
