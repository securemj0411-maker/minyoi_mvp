"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import MarketHistoryChart from "@/components/market-history-chart";
import ModelGuidePanel from "@/components/model-guide-panel";
import { MarketSourceDebug } from "@/components/market-source-debug";
import { ConditionChip } from "@/components/condition-chip";
import { RiskScoreBar } from "@/components/risk-score-bar";
import { LiquidityCurveMini } from "@/components/liquidity-curve-mini";
import { BunjangLogo, BunjangSourceBadge, DanawaLogo, DanawaSourceBadge } from "@/components/market-brand-logo";
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
  onLoadDetail: (pid: number) => Promise<RevealListingDetail>;
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

type PreviewSide = "left" | "right";

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

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`rounded-full bg-zinc-200/80 dark:bg-zinc-800 ${className}`} />;
}

function RevealResultSkeleton() {
  return (
    <div className="grid gap-3 lg:grid-cols-2" aria-hidden="true">
      <div className="grid gap-3 rounded-xl border border-[#e3ddd2] bg-[#fffdf9] p-3 shadow-lg shadow-[rgba(92,116,95,0.08)] dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-[132px_minmax(0,1fr)] lg:grid-cols-[150px_minmax(0,1fr)]">
        <div className="aspect-square rounded-lg bg-zinc-200/80 dark:bg-zinc-800 sm:h-[132px] sm:w-[132px] lg:h-[150px] lg:w-[150px]" />
        <div className="min-w-0 space-y-3">
          <SkeletonLine className="h-4 w-4/5" />
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <SkeletonLine className="h-3 w-20 bg-emerald-200/80 dark:bg-emerald-900/60" />
            <SkeletonLine className="mt-2 h-7 w-36 bg-emerald-200/80 dark:bg-emerald-900/60" />
            <SkeletonLine className="mt-2 h-3 w-52" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <SkeletonLine className="h-5 w-16" />
            <SkeletonLine className="h-5 w-20" />
            <SkeletonLine className="h-5 w-14" />
          </div>
          <div className="rounded-lg border border-[#e2d9cb] bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
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
  if (!market) return null;
  const confidence = market.confidence ?? "low";
  const confidenceLabel = confidence === "high" ? "🟢 높음" : confidence === "medium" ? "🟡 보통" : "🔴 낮음";
  const hasCondition = market.conditionClass && market.conditionClass !== "all";
  return (
    <div className="rounded-lg border border-[#e2d9cb] bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          📊 시세 근거
          {hasCondition && market.conditionLabel && (
            <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {market.conditionLabel}
            </span>
          )}
        </div>
        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
          {confidenceLabel}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
        <span className="font-black text-zinc-800 dark:text-zinc-100">
          {market.label ?? card.skuName}
        </span>
        <span className="text-zinc-300">·</span>
        <span className="font-bold tabular-nums text-zinc-700 dark:text-zinc-300">
          중앙 {market.medianPrice ? krw(market.medianPrice) : "-"}
        </span>
        {market.fallbackUsed && (
          <span className="text-[9px] font-bold uppercase text-zinc-400 dark:text-zinc-500">
            (인접 등급 fallback)
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-bold tabular-nums dark:bg-zinc-800">
          💰 거래완료 {market.soldSampleCount.toLocaleString("ko-KR")}건
        </span>
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-bold tabular-nums dark:bg-zinc-800">
          📋 판매중 {market.activeSampleCount.toLocaleString("ko-KR")}건
        </span>
        {market.disappearedSampleCount > 0 && (
          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 font-bold tabular-nums dark:bg-zinc-800">
            🚫 만료 {market.disappearedSampleCount.toLocaleString("ko-KR")}건
          </span>
        )}
        {/* 2026-05-16 (사용자 코멘트 id 104/107/109): 시세 출처 명시 강화. */}
        {/* 2026-05-16 (N4): unopened (박스 안 뜯음) vs mint (S급 사용감 거의 없음) 분리. */}
        {market.priceSource === "reference" ? (
          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
            <DanawaLogo className="h-4 w-4 rounded-[4px]" />
            다나와 새 가격 기준 (이 매물 미개봉)
          </span>
        ) : market.conditionClass === "mint" ? (
          <span className="inline-flex items-center gap-1 font-bold text-zinc-700 dark:text-zinc-200">
            <BunjangLogo className="h-4 w-4 rounded-[4px]" />
            번개 S급 매물 {market.sampleCount}건 median
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
            <BunjangLogo className="h-4 w-4 rounded-[4px]" />
            번개 중고 매물 {market.sampleCount}건 median
          </span>
        )}
      </div>
      {/* Wave 130: 다른 condition 시세 비교 — "내 매물(worn) 시세 vs 다른 등급" — 사업 보고서 L2 끼리 비교. */}
      {market.otherConditions && market.otherConditions.length > 0 && (
        <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
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
        </div>
      )}
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
  return (
    <div className="flex flex-wrap gap-1">
      {verdicts.map((v) => (
        <span
          key={v.label}
          className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${VERDICT_TONE_CLASS[v.tone]}`}
        >
          {v.label}
        </span>
      ))}
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
      <span className="font-black">📦 매물 유입량</span>
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
  const isFastTurn = hours != null && hours > 0 && hours <= 48; // 2일 안에 팔림
  const isSlowTurn = hours != null && hours > 168; // 7일+ 안 팔림
  const turnLabel = velocityHoursLabel(hours);
  const confidenceLabel = velocity.confidence === "high" ? "신뢰 높음" : velocity.confidence === "medium" ? "신뢰 보통" : "참고용";
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
          📦 비슷한 상품은 보통
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
            ⚡ 빨리 팔리는 편
          </span>
        )}
        {isSlowTurn && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">
            ⚠️ 오래 걸리는 편
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
  const isMarketInvalidated = Math.min(card.expectedProfitMin, card.expectedProfitMax) < 0;
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
      <div className="grid gap-3 rounded-xl border border-[#e3ddd2] bg-[#fffdf9] p-3 shadow-lg shadow-[rgba(92,116,95,0.08)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-zinc-950/40 sm:grid-cols-[132px_minmax(0,1fr)] lg:grid-cols-[150px_minmax(0,1fr)]">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 sm:h-[132px] sm:w-[132px] lg:h-[150px] lg:w-[150px]">
        {card.thumbnailUrl ? (
          <Image
            src={card.thumbnailUrl}
            alt={card.name}
            fill
            sizes="150px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-semibold text-zinc-400">
            이미지 없음
          </div>
        )}
        {/* Wave 80: 사진을 가리던 floating overlay 제거. 액션은 모달 하단 footer로 이동. */}
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="line-clamp-2 text-sm font-black leading-5 text-zinc-900 dark:text-zinc-50">
              {card.name}
            </div>
            <div className={`mt-2 rounded-xl border px-3 py-2 ${
              isMarketInvalidated
                ? "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/25"
                : "border-emerald-100 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20"
            }`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`text-[10px] font-black uppercase tracking-[0.16em] ${
                  isMarketInvalidated ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"
                }`}>
                  현재 차익
                </span>
                <span className={`text-2xl font-black tabular-nums ${
                  isMarketInvalidated ? "text-rose-800 dark:text-rose-200" : "text-emerald-800 dark:text-emerald-200"
                }`}>
                  {displayProfitRange(card)}
                </span>
                {currentPct != null ? (
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-black tabular-nums text-amber-800 ring-1 ring-amber-100 dark:bg-zinc-900/50 dark:text-amber-200 dark:ring-amber-900/50">
                    {currentPct >= 0 ? "+" : ""}{currentPct}%
                  </span>
                ) : null}
                {isMarketInvalidated ? (
                  <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-black text-rose-900 dark:bg-rose-900/60 dark:text-rose-100">
                    추천 무효
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
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
                {card.band != null ? (
                  <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 ring-1 ring-zinc-100 dark:bg-zinc-900/50 dark:text-zinc-300 dark:ring-zinc-800">
                    band {card.band}
                  </span>
                ) : null}
                <span className="text-[11px] font-semibold text-zinc-400">{freshLabel(card.freshSeconds)}</span>
                <ConditionChip conditionClass={card.marketBasis?.conditionClass ?? null} showHelp />
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
          <details className="group hidden shrink-0 rounded-lg bg-zinc-50 px-2 py-1 text-right dark:bg-zinc-800 sm:block sm:min-w-[64px]">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-zinc-400">
                <span>신뢰</span>
                <span className="text-zinc-300 transition group-open:rotate-180 dark:text-zinc-500">▾</span>
              </div>
              <div className="text-sm font-black text-zinc-800 dark:text-zinc-100">
                {Math.round(card.confidence * 100)}%
              </div>
            </summary>
            <ConfidenceBreakdown card={card} />
          </details>
        </div>

        {/* 2026-05-17 Phase 0 L4: RiskScoreBar — 5축 잔여 위험 시각화. pack-reveal = showDetail. */}
        <RiskScoreBar
          descriptionPreview={card.savedDetail?.descriptionPreview ?? null}
          conditionClass={card.marketBasis?.conditionClass ?? null}
          price={card.price}
          skuMedian={card.marketBasis?.medianPrice ?? null}
          confidence={card.confidence}
          sellerReviewRating={card.savedDetail?.sellerReviewRating ?? null}
          sellerReviewCount={card.savedDetail?.sellerReviewCount ?? null}
          showDetail
        />

        <VerdictBadgesMini card={card} />

        {/* 2026-05-16 (사용자 코멘트 #110 후속): 헷갈림 안내 — Lightning vs USB-C 가격 동일 같은 사실. */}
        {/* catalog Sku.confusionNote 그대로 표시. 사용자가 매물 보고 헷갈리면 즉시 답. */}
        {card.confusionNote ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="mr-1">💡</span>
            {card.confusionNote}
          </div>
        ) : null}

        {/* 시세 근거 (요약) — 좌측 카드. 그래프는 우측 카드. */}
        <MarketBasisMini card={card} />
      </div>
      </div>
      {/* 좌측 카드 닫음 — 우측 카드 = 시세 그래프 + 디테일. */}

      {/* 우측 카드 — 시세 그래프 + 회전/유입/디버그 (시각 강조). */}
      <div className="space-y-2 rounded-xl border border-[#e3ddd2] bg-[#fffdf9] p-3 shadow-lg shadow-[rgba(92,116,95,0.08)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-zinc-950/40">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#5d735f] dark:text-emerald-400">
          📊 시세 그래프 · 시장 분석
        </div>

        {/* 2026-05-15: 시세 30일 추이 chart (active/sold median). 사용자 베타테스터 질문 응답 — */}
        {/* "시세 어떤 기준으로 잡나" 시각화. history 부족하면 자동 hide. */}
        {/* 2026-05-16 (코멘트 id 105): conditionClass 전달 → 그래프도 같은 condition 매물 기준. */}
        <MarketHistoryChart
          comparableKey={card.marketBasis?.comparableKey ?? null}
          currentPrice={card.price}
          conditionClass={card.marketBasis?.conditionClass ?? null}
        />

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

        {/* Wave 90 (2026-05-15): 시세 근거 디버그 패널 — 사용자가 검증할 때
            "이 시세가 어떤 매물 기준인지" 즉시 확인 가능. comparable_key + market_price_daily
            + 같은 SKU 매물 N건 list (가격순) + 번장 링크. */}
        <MarketSourceDebug pid={card.pid} ourPrice={card.price} />
      </div>
      {/* 우측 카드 (시세 분석) 닫음. */}

      {/* 노트 + 버튼 영역 — full width (lg:col-span-2). */}
      <div className="space-y-2 lg:col-span-2">
        {/* Wave 80: SavedDetailMini (찜/리뷰/리뷰N개/판매자 설명문) 제거 — 번개장터 데이터 직접 노출 법적 위험. 원본은 "번개장터 열기" 버튼으로 확인. */}

        {/* Wave 80: 개별 피드백 버튼 (관심/매수함/이미 팔림/별로) + quickTags (단품 의심 등) 제거.
            단일 "추천 상품이 이상해요" 신고 버튼 + 코멘트 폼으로 대체. */}
        <details className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-800/50">
          <summary className="cursor-pointer font-bold text-zinc-500 dark:text-zinc-300">
            💬 검증 메모 · 추천 평가 {noteSaved ? "· 저장됨" : ""}
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
  onPreviewGuide,
  onLinkClicked,
  onReportLoss,
  alreadyReportedLoss,
}: {
  card: RevealCard;
  onPreviewGuide: (card: RevealCard, side: PreviewSide) => void;
  onLinkClicked: (pid: number) => void;
  onReportLoss?: (card: RevealCard) => void;
  alreadyReportedLoss?: boolean;
}) {
  return (
    <div className="shrink-0 border-t border-[#e7dece] bg-[#fffdf9]/95 p-3 shadow-[0_-10px_24px_rgba(49,66,56,0.10)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onPreviewGuide(card, "right")}
          className="rounded-xl border border-[#d5dfd2] bg-[var(--brand-accent-soft)] px-3 py-2.5 text-center text-xs font-bold text-[var(--brand-accent-strong)] transition hover:border-[#b9c9b9] hover:bg-[#edf3ea] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          공략 보기
        </button>
        <a
          href={card.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => onLinkClicked(card.pid)}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-accent-strong)] px-3 py-2.5 text-center text-xs font-bold text-[var(--brand-cream)] shadow-lg shadow-[rgba(49,66,56,0.18)] transition hover:bg-[#29382f]"
        >
          <BunjangLogo className="h-[18px] w-[18px] rounded-[5px]" />
          번개장터 열기
        </a>
      </div>

      {onReportLoss && (
        <button
          type="button"
          onClick={() => onReportLoss(card)}
          disabled={alreadyReportedLoss}
          title={alreadyReportedLoss ? "이미 신고됨 — 운영자 검수 진행 중" : "부정확 정보 신고하고 토큰 +3 받기 (24h 검수)"}
          className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-black leading-none transition ${
            alreadyReportedLoss
              ? "cursor-not-allowed border-zinc-300 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
              : "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          }`}
        >
          {alreadyReportedLoss ? "✅ 신고 완료 — 검수 중" : "🎁 토큰 +3 받기 · 부정확 정보 신고"}
        </button>
      )}
    </div>
  );
}

export default function PackRevealModal({
  open,
  band,
  loading,
  result,
  initialPreviewCard,
  initialPreviewMode = "listing",
  initialPreviewSeed,
  onClose,
  onLinkClicked,
  onFeedback,
  onLoadDetail,
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-[rgba(31,40,34,0.48)] p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!loading) handleClose();
      }}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#ddd6ca] bg-[#fffdf9] shadow-2xl shadow-[rgba(49,66,56,0.16)] dark:border-zinc-800 dark:bg-zinc-900"
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
                닫기
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
                <span>최근 검증 시점이 오래된 카드는 상품이 사라졌을 수 있어요. 빠르게 확인해주세요.</span>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-zinc-200 px-3 py-2 font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  돌아가기
                </button>
              </div>
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
          <ModalActionFooter
            card={result.reveals[0]}
            onPreviewGuide={handlePreviewGuide}
            onLinkClicked={onLinkClicked}
            onReportLoss={onReportLoss}
            alreadyReportedLoss={alreadyReportedLoss}
          />
        ) : null}
      </div>
    </div>
  );
}

export type { RevealResult };
