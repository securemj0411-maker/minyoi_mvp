"use client";

// 2026-05-17: 매물 등급 chip — 운영자풀 / 사용자 reveal / 나의 상품 카드 공유.
// 사용자 요청: 한국말 등급 표시 + ? 호버 (모바일은 클릭) → 분류 정책 모달.

import { useState } from "react";

type Props = {
  conditionClass: string | null | undefined;
  // showHelp: true = ? 아이콘 + 분류 정책 popover. 운영자풀 만 true.
  showHelp?: boolean;
  // Wave 354: friendly = 일반인 친화 풀어쓴 라벨 ("S급" → "거의 새것", "B급" → "상태 보통").
  // 사용자 피드백: S급/미개봉 외엔 사용자가 등급명 모름.
  variant?: "default" | "friendly";
};

type ChipStyle = {
  label: string;
  // Wave 354: friendlyLabel — variant="friendly" 시 사용. 일반인용 풀어쓴 라벨.
  friendlyLabel: string;
  bg: string;
  text: string;
  desc: string;
};

type PhotoBadgeStyle = {
  label: string;
  compactLabel: string;
  mark: string;
  className: string;
  markClassName: string;
  desc: string;
};

const CHIP_STYLES: Record<string, ChipStyle> = {
  unopened: {
    label: "미개봉/새상품",
    friendlyLabel: "미개봉",
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-200",
    desc: "박스 안 뜯음. 다나와 새상품 시세 기준.",
  },
  mint: {
    label: "S급",
    friendlyLabel: "거의 새것",
    bg: "border border-emerald-300/70 bg-gradient-to-r from-emerald-950 via-emerald-800 to-[#b78a2c] shadow-sm shadow-emerald-950/15 dark:border-emerald-300/30 dark:from-emerald-400/25 dark:via-emerald-900/70 dark:to-amber-500/25",
    text: "text-amber-50 dark:text-emerald-50",
    desc: "실사용 거의 없음 (AI 판정 — 사이클 적음 / 거의 새것).",
  },
  clean: {
    label: "A급",
    friendlyLabel: "깨끗한 편",
    bg: "border border-sky-200/80 bg-gradient-to-r from-white via-sky-50 to-teal-100 shadow-sm shadow-sky-900/10 dark:border-sky-300/20 dark:from-sky-400/20 dark:via-teal-900/50 dark:to-zinc-900",
    text: "text-sky-950 dark:text-sky-50",
    desc: "셀러 명시 프리미엄 — 풀세트 / AppleCare / 배터리 100% / S급 표현. 셀러 인플레 가능성 (보수적 분류).",
  },
  normal: {
    label: "일반",
    friendlyLabel: "상태 보통",
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-700 dark:text-zinc-300",
    desc: "명시적 신호 없음 (default).",
  },
  worn: {
    label: "사용감",
    friendlyLabel: "사용감 있음",
    bg: "bg-orange-100 dark:bg-orange-900/40",
    text: "text-orange-800 dark:text-orange-200",
    desc: "사용감, 잔기스, 미세 흠집 명시.",
  },
  flawed: {
    label: "훼손",
    friendlyLabel: "하자 있음",
    bg: "bg-rose-100 dark:bg-rose-900/40",
    text: "text-rose-800 dark:text-rose-200",
    desc: "액정 깨짐 / 낙상 / 작동 결함 / 부품용. 풀 차단 대상.",
  },
  low_batt: {
    label: "배터리 저하",
    friendlyLabel: "배터리 약함",
    bg: "bg-yellow-100 dark:bg-yellow-900/40",
    text: "text-yellow-800 dark:text-yellow-200",
    desc: "배터리 효율 < 85% 명시. 가격 modifier.",
  },
};

const PHOTO_BADGE_STYLES: Record<string, PhotoBadgeStyle> = {
  unopened: {
    label: "미개봉/새상품",
    compactLabel: "미개봉",
    mark: "N",
    className: "border-[#efd486]/90 bg-[linear-gradient(135deg,#fff8de_0%,#f6cf68_48%,#fffaf0_100%)] text-[#513b0c] shadow-[0_10px_26px_rgba(217,154,28,0.34)] ring-1 ring-white/80 dark:border-amber-500/60 dark:bg-[linear-gradient(135deg,#3a2608_0%,#9a6b13_48%,#21160a_100%)] dark:text-amber-50 dark:ring-amber-100/20",
    markClassName: "bg-[#2f2410] text-[#ffe7a3] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] dark:bg-amber-100 dark:text-[#3a2608]",
    desc: "미개봉/새상품으로 분류된 매물",
  },
  mint: {
    label: "S급",
    compactLabel: "S급",
    mark: "S",
    className: "border-[#ecd37b]/90 bg-[linear-gradient(135deg,#071f19_0%,#104434_47%,#e6c268_100%)] text-[#fff6d1] shadow-[0_12px_30px_rgba(8,48,35,0.40)] ring-1 ring-[#fff0aa]/55 dark:border-[#e7c769]/60 dark:bg-[linear-gradient(135deg,#031812_0%,#0b3529_50%,#b7852c_100%)] dark:text-amber-50 dark:ring-amber-100/18",
    markClassName: "bg-[#fff0ad] text-[#12382b] shadow-[0_2px_8px_rgba(0,0,0,0.18)]",
    desc: "S급으로 분류된 매물",
  },
  clean: {
    label: "A급/풀세트",
    compactLabel: "A급",
    mark: "A",
    className: "border-[#bce9ff]/90 bg-[linear-gradient(135deg,#ffffff_0%,#dbf5ff_48%,#b8efe5_100%)] text-[#093a4d] shadow-[0_10px_24px_rgba(14,116,144,0.22)] ring-1 ring-white/80 dark:border-sky-400/45 dark:bg-[linear-gradient(135deg,#071d2c_0%,#0d5264_52%,#0b766e_100%)] dark:text-sky-50 dark:ring-sky-100/15",
    markClassName: "bg-[#0d5264] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] dark:bg-sky-100 dark:text-[#083548]",
    desc: "A급/풀세트로 분류된 매물",
  },
  normal: {
    label: "일반",
    compactLabel: "B급",
    mark: "B",
    className: "border-zinc-200/90 bg-[linear-gradient(135deg,#ffffff_0%,#f4f4f5_100%)] text-zinc-700 shadow-[0_7px_18px_rgba(39,39,42,0.12)] ring-1 ring-white/65 dark:border-zinc-700/80 dark:bg-[linear-gradient(135deg,#18181b_0%,#27272a_100%)] dark:text-zinc-200 dark:ring-white/10",
    markClassName: "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900",
    desc: "일반 상태로 분류된 매물",
  },
  worn: {
    label: "사용감",
    compactLabel: "사용감",
    mark: "C",
    className: "border-orange-200/90 bg-[linear-gradient(135deg,#fff7ed_0%,#fed7aa_100%)] text-orange-950 shadow-[0_7px_18px_rgba(194,65,12,0.14)] ring-1 ring-white/60 dark:border-orange-800/80 dark:bg-[linear-gradient(135deg,#2b1206_0%,#7c2d12_100%)] dark:text-orange-100 dark:ring-orange-100/10",
    markClassName: "bg-orange-900 text-orange-50 dark:bg-orange-100 dark:text-orange-950",
    desc: "사용감 있는 매물로 분류",
  },
  flawed: {
    label: "훼손",
    compactLabel: "훼손",
    mark: "D",
    className: "border-rose-200/90 bg-[linear-gradient(135deg,#fff1f2_0%,#fecdd3_100%)] text-rose-950 shadow-[0_7px_18px_rgba(190,18,60,0.14)] dark:border-rose-800/80 dark:bg-[linear-gradient(135deg,#2a0710_0%,#881337_100%)] dark:text-rose-100",
    markClassName: "bg-rose-900 text-rose-50 dark:bg-rose-100 dark:text-rose-950",
    desc: "훼손/결함 신호가 있는 매물",
  },
  low_batt: {
    label: "배터리 저하",
    compactLabel: "배터리",
    mark: "B-",
    className: "border-yellow-200/90 bg-[linear-gradient(135deg,#fefce8_0%,#fde68a_100%)] text-yellow-950 shadow-[0_7px_18px_rgba(161,98,7,0.14)] dark:border-yellow-800/80 dark:bg-[linear-gradient(135deg,#2b2105_0%,#854d0e_100%)] dark:text-yellow-100",
    markClassName: "bg-yellow-900 text-yellow-50 dark:bg-yellow-100 dark:text-yellow-950",
    desc: "배터리 저하 신호가 있는 매물",
  },
};

export function ConditionChip({ conditionClass, showHelp = false, variant = "default" }: Props) {
  const [open, setOpen] = useState(false);
  if (!conditionClass) return null;
  const style = CHIP_STYLES[conditionClass];
  if (!style) {
    return (
      <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
        {conditionClass}
      </span>
    );
  }
  const displayLabel = variant === "friendly" ? style.friendlyLabel : style.label;
  return (
    <span className="relative inline-flex items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style.bg} ${style.text}`}>
        {displayLabel}
      </span>
      {showHelp && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-bold text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
            aria-label="등급 분류 정책 보기"
          >
            ?
          </button>
          {open && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
              />
              <div className="absolute left-0 top-5 z-50 w-72 rounded-lg border border-zinc-300 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                <div className="mb-2 text-[11px] font-bold text-zinc-900 dark:text-zinc-100">
                  📋 매물 등급 분류
                </div>
                <div className="space-y-1.5 text-[10px]">
                  {(["unopened", "mint", "clean", "normal", "worn", "flawed", "low_batt"] as const).map((k) => {
                    const s = CHIP_STYLES[k];
                    return (
                      <div key={k} className="flex gap-2">
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400">{s.desc}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 border-t border-zinc-200 pt-2 text-[9px] text-zinc-500 dark:border-zinc-700">
                  분류 정책 (v46): 메타데이터 (셀러 명시) vs 본문 (description) 충돌 시 <b>낮은 등급 우선</b>. 셀러 인플레 ↔ 거짓말 양방향 차단.
                </div>
              </div>
            </>
          )}
        </>
      )}
    </span>
  );
}

export function ConditionPhotoBadge({
  conditionClass,
  compact = false,
  className = "",
}: {
  conditionClass: string | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  if (!conditionClass) return null;
  const style = PHOTO_BADGE_STYLES[conditionClass] ?? {
    label: conditionClass,
    compactLabel: conditionClass,
    mark: "?",
    className: "border-zinc-200/90 bg-white/90 text-zinc-700 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/85 dark:text-zinc-200",
    markClassName: "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900",
    desc: `${conditionClass} 등급으로 분류된 매물`,
  };
  return (
    <span
      title={style.desc}
      className={`pointer-events-none absolute left-1.5 top-1.5 z-10 inline-flex items-center overflow-hidden border text-[9px] font-black tracking-[0.02em] backdrop-blur-md ${
        style.className
      } ${
        compact
          ? "max-w-[calc(100%-10px)] rounded-[10px] px-2 py-1 text-[10px] leading-none sm:px-2 sm:py-1 sm:text-[10px]"
          : "max-w-[calc(100%-10px)] gap-1 rounded-[10px] px-1 py-0.5 sm:left-2 sm:top-2 sm:px-2.5 sm:py-1 sm:text-[10px]"
      } ${className}`}
    >
      <span className="pointer-events-none absolute inset-x-1 top-0 h-px bg-white/70 dark:bg-white/25" />
      {compact ? (
        <span className="relative whitespace-nowrap leading-none">{style.compactLabel}</span>
      ) : (
        <>
          <span
            className={`relative flex h-4 min-w-[16px] items-center justify-center rounded-[7px] px-1 text-[8px] font-black leading-none sm:h-5 sm:min-w-[20px] sm:text-[9px] ${
              style.markClassName
            }`}
          >
            {style.mark}
          </span>
          <span className="relative truncate leading-none">{style.label}</span>
        </>
      )}
    </span>
  );
}

export function UnopenedPhotoBadge(props: Parameters<typeof ConditionPhotoBadge>[0]) {
  return <ConditionPhotoBadge {...props} />;
}
