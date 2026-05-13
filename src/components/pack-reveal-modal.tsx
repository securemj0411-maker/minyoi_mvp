"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import ModelGuidePanel from "@/components/model-guide-panel";
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

function SavedDetailMini({ card }: { card: RevealCard }) {
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

function LoadingStage() {
  const [stepIndex, setStepIndex] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, LOADING_STEPS.length - 1));
    }, 700);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 animate-ping rounded-full bg-[var(--brand-accent)]/20" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-[var(--brand-accent)] to-[var(--brand-accent-strong)] shadow-lg shadow-[rgba(92,116,95,0.35)]" />
        <div className="absolute inset-5 rounded-full bg-white dark:bg-zinc-900" />
      </div>
      <div className="text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--brand-accent)] dark:text-zinc-300">
          LIVE ANALYSIS
        </div>
        <div className="mt-2 text-xl font-black text-zinc-900 dark:text-zinc-50">AI가 상품을 분석중입니다</div>
        <div className="mt-2 h-10 text-sm leading-5 text-zinc-500 transition dark:text-zinc-400">{LOADING_STEPS[stepIndex]}</div>
        <div className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          판매 완료, 단품, 조건 불일치 상품은 여기서 바로 걸러냅니다.
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
  const [feedback, setFeedback] = useState<RevealFeedbackType | null>(null);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);

  const feedbackOptions: { type: RevealFeedbackType; label: string }[] = [
    { type: "interested", label: "관심" },
    { type: "bought", label: "매수함" },
    { type: "missed_sold", label: "이미 팔림" },
    { type: "bad_pick", label: "별로" },
  ];
  const quickTags: { label: string; feedbackType: RevealFeedbackType }[] = [
    { label: "단품 의심", feedbackType: "bad_pick" },
    { label: "가격 비교 틀림", feedbackType: "bad_pick" },
    { label: "사진 애매", feedbackType: "bad_pick" },
    { label: "판매자 위험", feedbackType: "bad_pick" },
    { label: "이미 팔림", feedbackType: "missed_sold" },
  ];

  function handleFeedback(type: RevealFeedbackType) {
    setFeedback(type);
    setNoteSaved(false);
    onFeedback(card.pid, type, note);
  }

  function handleSaveNote() {
    const cleanNote = note.trim();
    if (!cleanNote) return;
    setFeedback((current) => current ?? "watching");
    setNoteSaved(true);
    onFeedback(card.pid, feedback ?? "watching", cleanNote);
  }

  function handleQuickTag(label: string, feedbackType: RevealFeedbackType) {
    const tag = `[${label}]`;
    const nextNote = note.includes(tag) ? note : `${tag}${note.trim() ? ` ${note.trim()}` : ""}`.slice(0, 500);
    setNote(nextNote);
    setFeedback(feedbackType);
    setNoteSaved(true);
    onFeedback(card.pid, feedbackType, nextNote);
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
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => onPreviewListing(card, previewSide)}
            className="rounded-lg bg-white px-3 py-2 text-xs font-black text-zinc-900 shadow-lg shadow-black/20 transition hover:bg-emerald-50 hover:text-emerald-700"
          >
            상세 비교
          </button>
          <button
            type="button"
            onClick={() => onPreviewGuide(card, previewSide)}
            className="rounded-lg border border-white/70 bg-[rgba(255,253,249,0.92)] px-3 py-2 text-xs font-black text-[var(--brand-accent-strong)] shadow-lg shadow-black/10 backdrop-blur-sm transition hover:bg-white"
          >
            공략 보기
          </button>
        </div>
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="line-clamp-2 text-sm font-black leading-5 text-zinc-900 dark:text-zinc-50">
              {card.name}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-lg font-black tabular-nums text-[var(--brand-accent)]">
                  {profitRange(card.expectedProfitMin, card.expectedProfitMax)}
                </span>
              <span className="text-sm font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
                매입 {krw(card.price)}
              </span>
              <span className="text-xs font-semibold text-zinc-400">{freshLabel(card.freshSeconds)}</span>
            </div>
          </div>
          <div className="hidden shrink-0 rounded-lg bg-zinc-50 px-2 py-1 text-right dark:bg-zinc-800 sm:block">
            <div className="text-[10px] font-bold text-zinc-400">신뢰</div>
            <div className="text-sm font-black text-zinc-800 dark:text-zinc-100">
              {Math.round(card.confidence * 100)}%
            </div>
          </div>
        </div>

        <MarketBasisMini card={card} />

        <VelocityBasisMini card={card} />

        <SavedDetailMini card={card} />

        <div className="grid grid-cols-4 gap-1.5">
          {feedbackOptions.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => handleFeedback(option.type)}
              className={`rounded-lg border px-2 py-2 text-[11px] font-bold transition ${
                feedback === option.type
                  ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {quickTags.map((tag) => (
            <button
              key={tag.label}
              type="button"
              onClick={() => handleQuickTag(tag.label, tag.feedbackType)}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-bold text-zinc-500 transition hover:border-[#b9c9b9] hover:bg-[var(--brand-accent-soft)] hover:text-[var(--brand-accent-strong)] dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {tag.label}
            </button>
          ))}
        </div>

        <details className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-800/50">
          <summary className="cursor-pointer font-bold text-zinc-500 dark:text-zinc-300">
            코멘트 {noteSaved ? "저장됨" : ""}
          </summary>
          <div className="mt-2 space-y-2">
            <textarea
              id={`reveal-note-${card.pid}`}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setNoteSaved(false);
              }}
              maxLength={500}
              rows={2}
              placeholder="예: 사진상 구성품 애매함 / 단품 의심 / 사고 싶음"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(31,40,34,0.48)] p-3 backdrop-blur-sm sm:p-6"
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
          {loading ? <LoadingStage /> : null}

          {!loading && result?.result === "success" ? (
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

          {!loading && result?.result === "refunded" ? (
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

          {!loading && result?.result === "unavailable" ? (
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
