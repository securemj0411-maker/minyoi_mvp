"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import ModelGuidePanel from "@/components/model-guide-panel";
import { MarketSourceDebug } from "@/components/market-source-debug";
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
  onLoadGuide?: (card: RevealCard) => Promise<ModelGuide | null>;
  renderGuidePanel?: (args: {
    card: RevealCard;
    guide: ModelGuide | null;
    loading: boolean;
    error: string | null;
    onClose: () => void;
    onOpenListingDetail: () => void;
  }) => ReactNode;
  onRetry: () => void;
};

type PreviewSide = "left" | "right";
type PreviewMode = "listing" | "guide";

const LOADING_STEPS = [
  "AI가 추천 상품을 끌어오고 있습니다...",
  "지금 살아있는 상품인지 다시 확인하는 중...",
  "방금 팔면 얼마나 남는지 시세를 계산 중...",
  "리스크 신호와 단품 여부를 마지막으로 걸러내는 중...",
];

const BAND_LABEL: Record<PackBand, string> = {
  1: "+2~3만원 구간",
  2: "+4~6만원 구간",
  3: "+7만원+ 구간",
};

const BAND_THEME: Record<PackBand, string> = {
  1: "from-[#eef4f0] via-[#f7f1e6] to-[#edf3eb]",
  2: "from-[#edf3eb] via-[#f7f1e6] to-[#e7efe5]",
  3: "from-[#f4efe2] via-[#f7f1e6] to-[#eef4f0]",
};

const BAND_PILL_THEME: Record<PackBand, string> = {
  1: "bg-[#e7f0ec] text-[#4f6962] ring-1 ring-[#cad9d0]",
  2: "bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)] ring-1 ring-[#d5dfd2]",
  3: "bg-[#f3ead8] text-[#6c5840] ring-1 ring-[#e3d5ba]",
};

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function profitRange(min: number, max: number) {
  if (min === max) return `+${krw(max)}`;
  return `+${krw(min)} ~ +${krw(max)}`;
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

function saleStatusLabel(value: string) {
  if (value === "SELLING") return "판매중";
  if (value === "SOLD_OUT" || value === "SOLD") return "판매완료";
  if (!value) return "상태 미확인";
  return value;
}

function MarketBasisMini({ card }: { card: RevealCard }) {
  const market = card.marketBasis;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] leading-4 text-[#6c756c] dark:text-zinc-400">
      <span className="font-bold text-zinc-700 dark:text-zinc-200">{market?.label ?? card.skuName}</span>
      <span>·</span>
      <span>{marketSampleLabel(card)}</span>
      <span>·</span>
      <span>시세 {market?.medianPrice ? krw(market.medianPrice) : "-"}</span>
    </div>
  );
}

// Wave 82: 카드 소견 — rule-based 짧은 평가 chip. 기존 데이터(판매자 리뷰/회전/신뢰도/
// 매물 유입/찜/설명 신호) 조건 만족 시 라벨 표시. AI L2 호출 없음.
type Verdict = { label: string; tone: "good" | "warn" | "info" };

function verdictsForCard(card: RevealCard): Verdict[] {
  const out: Verdict[] = [];
  const detail = card.savedDetail;
  const velocity = card.velocityBasis;
  const flow = card.skuListingFlow;

  if (detail?.sellerReviewRating != null && detail.sellerReviewRating >= 4.5 && detail.sellerReviewCount >= 5) {
    out.push({ label: "판매자 리뷰 좋음", tone: "good" });
  } else if (detail && detail.sellerReviewCount === 0) {
    out.push({ label: "신규 판매자", tone: "warn" });
  }

  if (velocity?.medianHoursToSold != null && velocity.medianHoursToSold > 0) {
    if (velocity.medianHoursToSold <= 72) out.push({ label: "회전 빠름 (3일내)", tone: "good" });
    else if (velocity.medianHoursToSold >= 336) out.push({ label: "회전 늦음", tone: "warn" });
  }

  if (card.confidence >= 0.8) out.push({ label: "시세 신뢰 높음", tone: "good" });
  else if (card.confidence < 0.5) out.push({ label: "시세 신뢰 낮음", tone: "warn" });

  if (flow && flow.avgPerDay7d > 0 && flow.count24h >= flow.avgPerDay7d * 1.3) {
    out.push({ label: "매물 활발", tone: "info" });
  }

  if (detail?.favoriteCount != null && detail.favoriteCount >= 10) {
    out.push({ label: "관심도 ↑", tone: "info" });
  }

  const desc = detail?.descriptionPreview ?? "";
  if (/미개봉|미사용|새상품|풀박스|풀구성|거의\s*새것/.test(desc)) {
    out.push({ label: "상태 좋음", tone: "good" });
  } else if (/하자|기스\s*심|찍힘\s*심|수리이력|충전\s*안됨|배터리\s*효율\s*낮/.test(desc)) {
    out.push({ label: "사용감 주의", tone: "warn" });
  }

  if (detail?.freeShipping) out.push({ label: "무료배송", tone: "info" });

  return out.slice(0, 4);
}

function VerdictBadgesMini({ card }: { card: RevealCard }) {
  const verdicts = verdictsForCard(card);
  if (verdicts.length === 0) return null;
  const toneClass: Record<Verdict["tone"], string> = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
    warn: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
    info: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200",
  };
  return (
    <div className="flex flex-wrap gap-1">
      {verdicts.map((v) => (
        <span
          key={v.label}
          className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${toneClass[v.tone]}`}
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
  return (
    <div className="rounded-lg border border-[#d8e2d7] bg-[var(--brand-accent-soft)] px-3 py-2 text-[11px] leading-4 text-[var(--brand-accent-strong)] dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-100">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-black">관측 판매속도</span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--brand-accent-strong)] ring-1 ring-[#d8e2d7] dark:bg-zinc-900/50 dark:text-zinc-100 dark:ring-zinc-700">
          {velocity.confidence}
        </span>
        <span>중앙 {velocityHoursLabel(velocity.medianHoursToSold)}</span>
        <span>7일 {velocity.sold7dCount.toLocaleString("ko-KR")}건</span>
      </div>
      <div className="mt-1 text-[10px] text-[#58705d] dark:text-zinc-300/70">
        판매 관측 {velocity.observedSoldSampleCount.toLocaleString("ko-KR")}건 · 활성 {velocity.activeSampleCount.toLocaleString("ko-KR")}건
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
  previewSide,
  onLinkClicked,
  onFeedback,
  onPreviewListing,
  onPreviewGuide,
}: {
  card: RevealCard;
  delay: number;
  previewSide: PreviewSide;
  onLinkClicked: (pid: number) => void;
  onFeedback: (pid: number, feedbackType: RevealFeedbackType, note?: string) => void;
  onPreviewListing: (card: RevealCard, side: PreviewSide) => void;
  onPreviewGuide: (card: RevealCard, side: PreviewSide) => void;
}) {
  const [shown, setShown] = useState(false);
  const [, setFeedback] = useState<RevealFeedbackType | null>(null);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
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
      className={`grid gap-3 rounded-xl border border-[#e3ddd2] bg-[#fffdf9] p-3 shadow-lg shadow-[rgba(92,116,95,0.08)] transition-all duration-700 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-zinc-950/40 sm:grid-cols-[132px_minmax(0,1fr)] lg:grid-cols-[150px_minmax(0,1fr)] ${
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
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
        {/* Wave 80: 상세 비교 / 공략 보기 floating overlay 제거 — 사진 가림 → 하단 버튼 영역으로 이동 */}
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="line-clamp-2 text-sm font-black leading-5 text-zinc-900 dark:text-zinc-50">
              {card.name}
            </div>
            {/* Wave 80: 가격 정보 그룹화 — 매입/시세 인접 + 차익 강조 */}
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-lg font-black tabular-nums text-[var(--brand-accent)]">
                {profitRange(card.expectedProfitMin, card.expectedProfitMax)}
              </span>
              <span className="text-[11px] font-semibold text-zinc-400">{freshLabel(card.freshSeconds)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
              <span>매입 {krw(card.price)}</span>
              {card.marketBasis?.medianPrice ? (
                <>
                  <span className="text-zinc-300 dark:text-zinc-600">·</span>
                  <span className="text-zinc-500 dark:text-zinc-300">시세 {krw(card.marketBasis.medianPrice)}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="hidden shrink-0 rounded-lg bg-zinc-50 px-2 py-1 text-right dark:bg-zinc-800 sm:block">
            <div className="text-[10px] font-bold text-zinc-400">신뢰</div>
            <div className="text-sm font-black text-zinc-800 dark:text-zinc-100">
              {Math.round(card.confidence * 100)}%
            </div>
          </div>
        </div>

        <VerdictBadgesMini card={card} />

        <MarketBasisMini card={card} />

        <VelocityBasisMini card={card} />

        <SkuListingFlowMini card={card} />

        {/* Wave 90 (2026-05-15): 시세 근거 디버그 패널 — 사용자가 검증할 때
            "이 시세가 어떤 매물 기준인지" 즉시 확인 가능. comparable_key + market_price_daily
            + 같은 SKU 매물 N건 list (가격순) + 번장 링크. */}
        <MarketSourceDebug pid={card.pid} ourPrice={card.price} />

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
              maxLength={500}
              rows={3}
              placeholder="예) 시세 비교 OK / 단품 의심 / 가격 비교 틀린 듯 / 사진 애매 / 이거 좋은 추천 / 이미 팔린 것 같음 등 자유"
              className="w-full resize-none rounded-lg border border-[#ddd6ca] bg-white px-3 py-2 text-xs leading-5 text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] text-zinc-400">{note.length}/500</div>
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

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onPreviewListing(card, previewSide)}
            className="rounded-xl border border-zinc-200 px-3 py-2.5 text-center text-xs font-bold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            상세 비교
          </button>
          <button
            type="button"
            onClick={() => onPreviewGuide(card, previewSide)}
            className="rounded-xl border border-[#d5dfd2] bg-[var(--brand-accent-soft)] px-3 py-2.5 text-center text-xs font-bold text-[var(--brand-accent-strong)] transition hover:border-[#b9c9b9] hover:bg-[#edf3ea] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            공략 보기
          </button>
          <a
            href={card.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => onLinkClicked(card.pid)}
            className="block rounded-xl bg-[var(--brand-accent-strong)] px-3 py-2.5 text-center text-xs font-bold text-[var(--brand-cream)] shadow-lg shadow-[rgba(49,66,56,0.18)] transition hover:bg-[#29382f]"
          >
            번개장터 열기
          </a>
        </div>
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
  onOpenListingDetail,
}: {
  card: RevealCard;
  guide: ModelGuide | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onOpenListingDetail: () => void;
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
              onClick={onOpenListingDetail}
              className="w-full rounded-xl border border-[#d5dfd2] bg-white px-4 py-3 text-center text-sm font-bold text-[var(--brand-accent-strong)] transition hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              상세 비교로 돌아가기
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
      onBackToListing={onOpenListingDetail}
    />
  );
}

function ListingPreviewPanel({
  card,
  detail,
  loading,
  error,
  onClose,
  onLinkClicked,
}: {
  card: RevealCard;
  detail: RevealListingDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onLinkClicked: (pid: number) => void;
}) {
  const imageUrls = detail?.imageUrls.length ? detail.imageUrls : card.thumbnailUrl ? [card.thumbnailUrl] : [];
  const isSold = detail?.saleStatus === "SOLD_OUT" || detail?.saleStatus === "SOLD";

  return (
    <div className="flex max-h-[calc(100vh-24px)] overflow-hidden rounded-2xl border border-[#ddd6ca] bg-[#fffdf9] shadow-2xl shadow-[rgba(49,66,56,0.16)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex min-h-0 w-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 p-3 dark:border-zinc-800">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">상세/판매 상태</div>
          <div className="mt-1 truncate text-sm font-black text-zinc-900 dark:text-zinc-50">{card.name}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-bold text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          닫기
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-sm font-semibold text-zinc-500">
            실제 상품 정보 불러오는 중...
          </div>
        ) : null}

        {!loading && error ? (
          <div className="space-y-3 border-b border-zinc-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 dark:border-zinc-800 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="font-bold">상세 정보를 가져오지 못했어요.</div>
            <p>{error}</p>
            <p>번개장터가 응답을 막았거나 상품 정보가 방금 바뀐 경우라 새 탭 확인이 필요합니다.</p>
          </div>
        ) : null}

        {!loading && !error ? (
          <div>
            <div className="grid grid-cols-3 gap-1 bg-zinc-100 p-1 dark:bg-zinc-950">
              {imageUrls.slice(0, 3).map((src, index) => (
                <div key={`${src}-${index}`} className="relative aspect-square overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
                  <Image
                    src={src}
                    alt={`${card.name} ${index + 1}`}
                    fill
                    sizes="(min-width: 1024px) 140px, 30vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3 p-4">
              <div className={`rounded-xl border p-3 ${isSold ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100" : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100"}`}>
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">현재 상태</div>
                <div className="mt-1 text-lg font-black">{saleStatusLabel(detail?.saleStatus ?? "")}</div>
              </div>

              <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">상세 설명</div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-700 dark:text-zinc-200">
                  {detail?.description || "설명 없음"}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <a
          href={card.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => onLinkClicked(card.pid)}
          className="block rounded-xl bg-[var(--brand-accent-strong)] px-4 py-3 text-center text-sm font-bold text-[var(--brand-cream)] shadow-lg shadow-[rgba(49,66,56,0.18)] transition hover:bg-[#29382f]"
        >
          새 탭에서 번개장터 열기 →
        </a>
      </div>
      </div>
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
  onLoadGuide,
  renderGuidePanel,
  onRetry,
}: Props) {
  const [previewCard, setPreviewCard] = useState<RevealCard | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("listing");
  const [previewDetail, setPreviewDetail] = useState<RevealListingDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
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
    setPreviewMode("listing");
    setPreviewDetail(null);
    setPreviewLoading(false);
    setPreviewError(null);
    setPreviewGuide(null);
    setPreviewGuideLoading(false);
    setPreviewGuideError(null);
  }, []);

  const handleClose = useCallback(() => {
    closePreviewPanel();
    onClose();
  }, [closePreviewPanel, onClose]);

  const handlePreviewListing = useCallback((card: RevealCard, side: PreviewSide) => {
    setPreviewCard(card);
    setPreviewMode("listing");
    setPreviewSide(side);
    setPreviewGuide(null);
    setPreviewGuideLoading(false);
    setPreviewGuideError(null);
    setPreviewDetail(null);
    setPreviewError(null);
    setPreviewLoading(true);
    void onLoadDetail(card.pid)
      .then((detail) => {
        setPreviewDetail(detail);
      })
      .catch((err) => {
        setPreviewError(err instanceof Error ? err.message : "상세 정보 요청 실패");
      })
      .finally(() => setPreviewLoading(false));
  }, [onLoadDetail]);

  const handlePreviewGuide = useCallback((card: RevealCard, side: PreviewSide) => {
    setPreviewCard(card);
    setPreviewMode("guide");
    setPreviewSide(side);
    setPreviewGuide(null);
    setPreviewGuideError(null);
    setPreviewDetail(null);
    setPreviewError(null);

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
        setPreviewGuideError(err instanceof Error ? err.message : "공략 정보 요청 실패");
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
    handlePreviewListing,
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
        className="flex max-h-[84vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#ddd6ca] bg-[#fffdf9] shadow-2xl shadow-[rgba(49,66,56,0.16)] dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`sticky top-0 z-10 shrink-0 overflow-hidden border-b border-[#e2dbcf] bg-gradient-to-br p-4 text-[var(--brand-accent-strong)] ${BAND_THEME[band]}`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.35),transparent_60%)]" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${BAND_PILL_THEME[band]}`}>
                {BAND_LABEL[band]}
              </p>
              <h2 className="mt-1 text-lg font-black tracking-tight">
                {loading ? "추천 상품 검증 중" : result?.result === "success" ? "추천 완료" : "검증 결과"}
              </h2>
            </div>
            {!loading ? (
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-[#d7d1c5] bg-white/80 px-3 py-2 text-sm font-semibold text-[var(--brand-accent-strong)] backdrop-blur transition hover:bg-white"
              >
                닫기
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {displayLoading ? <LoadingStage completing={completing} /> : null}

          {!displayLoading && result?.result === "success" ? (
            <div className="space-y-4">
              <div>
                <div className="grid gap-3 md:grid-cols-2">
                  {result.reveals.map((card, idx) => (
                    <RevealCardItem
                      key={card.pid}
                      card={card}
                      delay={idx * 250}
                      previewSide={idx % 2 === 0 ? "right" : "left"}
                      onLinkClicked={onLinkClicked}
                      onFeedback={onFeedback}
                      onPreviewListing={handlePreviewListing}
                      onPreviewGuide={handlePreviewGuide}
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
                  {previewMode === "listing" ? (
                    <ListingPreviewPanel
                      card={previewCard}
                      detail={previewDetail}
                      loading={previewLoading}
                      error={previewError}
                      onClose={closePreviewPanel}
                      onLinkClicked={onLinkClicked}
                    />
                  ) : renderGuidePanel ? (
                    renderGuidePanel({
                      card: previewCard,
                      guide: previewGuide,
                      loading: previewGuideLoading,
                      error: previewGuideError,
                      onClose: closePreviewPanel,
                      onOpenListingDetail: () => handlePreviewListing(previewCard, previewSide),
                    })
                  ) : (
                    <GuidePreviewPanel
                      card={previewCard}
                      guide={previewGuide}
                      loading={previewGuideLoading}
                      error={previewGuideError}
                      onClose={closePreviewPanel}
                      onOpenListingDetail={() => handlePreviewListing(previewCard, previewSide)}
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
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  닫기
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export type { RevealResult };
