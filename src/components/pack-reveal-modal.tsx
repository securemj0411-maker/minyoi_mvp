"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { PackBand, RevealCard, RevealFeedbackType } from "@/lib/pack-open";

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
  onClose: () => void;
  onLinkClicked: (pid: number) => void;
  onFeedback: (pid: number, feedbackType: RevealFeedbackType) => void;
  onRetry: () => void;
};

const LOADING_STEPS = [
  "후보 매물 추출 중...",
  "매물 살아있는지 확인 중...",
  "시세 정밀 분석 중...",
  "리스크 평가 중...",
];

const BAND_LABEL: Record<PackBand, string> = {
  1: "라이트 후보팩",
  2: "스탠다드 후보팩",
  3: "프리미엄 후보팩",
};

const BAND_THEME: Record<PackBand, string> = {
  1: "from-sky-500 to-sky-700",
  2: "from-emerald-500 to-emerald-700",
  3: "from-amber-400 via-amber-500 to-amber-700",
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

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-sky-500" : "bg-amber-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-medium text-zinc-400">
        <span>신뢰도</span>
        <span className="font-bold tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className={`h-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
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
        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/50" />
        <div className="absolute inset-5 rounded-full bg-white dark:bg-zinc-900" />
      </div>
      <div className="text-center">
        <div className="text-base font-bold text-zinc-900 dark:text-zinc-50">검증 중</div>
        <div className="mt-2 h-5 text-sm text-zinc-500 transition">{LOADING_STEPS[stepIndex]}</div>
      </div>
    </div>
  );
}

function RevealCardItem({
  card,
  delay,
  onLinkClicked,
  onFeedback,
}: {
  card: RevealCard;
  delay: number;
  onLinkClicked: (pid: number) => void;
  onFeedback: (pid: number, feedbackType: RevealFeedbackType) => void;
}) {
  const [shown, setShown] = useState(false);
  const [feedback, setFeedback] = useState<RevealFeedbackType | null>(null);
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

  function handleFeedback(type: RevealFeedbackType) {
    setFeedback(type);
    onFeedback(card.pid, type);
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-emerald-500/10 transition-all duration-700 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-emerald-950/40 ${
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {card.thumbnailUrl ? (
          <Image
            src={card.thumbnailUrl}
            alt={card.name}
            fill
            sizes="(min-width: 768px) 320px, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-semibold text-zinc-400">
            이미지 없음
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-4 pb-3 pt-12">
          <div className="text-[9px] font-bold uppercase tracking-widest text-white/60">예상 순익</div>
          <div className="text-2xl font-black leading-tight text-emerald-300 drop-shadow">
            {profitRange(card.expectedProfitMin, card.expectedProfitMax)}
          </div>
        </div>
        <div className="absolute left-3 top-3">
          <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold text-white/90 backdrop-blur-sm">
            {card.skuName}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="line-clamp-2 min-h-[2.6rem] text-sm font-bold leading-5 text-zinc-900 dark:text-zinc-50">
          {card.name}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">
            <div className="text-[10px] text-zinc-400">매물 가격</div>
            <div className="mt-0.5 font-bold tabular-nums text-zinc-800 dark:text-zinc-200">
              {krw(card.price)}
            </div>
          </div>
          <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">
            <div className="text-[10px] text-zinc-400">검증 시점</div>
            <div className="mt-0.5 font-bold text-zinc-800 dark:text-zinc-200">
              {freshLabel(card.freshSeconds)}
            </div>
          </div>
        </div>

        <ConfidenceBar value={card.confidence} />

        <div className="grid grid-cols-4 gap-1.5">
          {feedbackOptions.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => handleFeedback(option.type)}
              className={`rounded-lg border px-2 py-2 text-[11px] font-bold transition ${
                feedback === option.type
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <a
          href={card.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => onLinkClicked(card.pid)}
          className="mt-auto block rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-700 hover:shadow-emerald-500/40"
        >
          번개장터에서 보기 →
        </a>
      </div>
    </div>
  );
}

export default function PackRevealModal({
  open,
  band,
  loading,
  result,
  onClose,
  onLinkClicked,
  onFeedback,
  onRetry,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`relative overflow-hidden bg-gradient-to-br p-5 text-white ${BAND_THEME[band]}`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                {BAND_LABEL[band]}
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight">
                {loading ? "후보 카드 검증 중" : result?.result === "success" ? "공개 완료" : "검증 결과"}
              </h2>
            </div>
            {!loading ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                닫기
              </button>
            ) : null}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {loading ? <LoadingStage /> : null}

          {!loading && result?.result === "success" ? (
            <div className="space-y-5">
              <div className="text-xs text-zinc-500">
                후보 {result.attemptedCount}건 검증 → {result.reveals.length}장 공개 ·{" "}
                {(result.durationMs / 1000).toFixed(1)}초
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {result.reveals.map((card, idx) => (
                  <RevealCardItem
                    key={card.pid}
                    card={card}
                    delay={idx * 250}
                    onLinkClicked={onLinkClicked}
                    onFeedback={onFeedback}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
                <span>최근 검증 시점이 오래된 카드는 매물이 사라졌을 수 있어요. 빠르게 확인해주세요.</span>
                <button
                  type="button"
                  onClick={onClose}
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
                <div className="text-base font-bold">검증 실패 — 토큰 {result.tokensRefunded}개 환불됨</div>
                <p className="mt-2 text-sm">{result.reason}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
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
                  onClick={onClose}
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
