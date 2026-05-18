"use client";

// 2026-05-17: 매물 등급 chip — 운영자풀 / 사용자 reveal / 나의 상품 카드 공유.
// 사용자 요청: 한국말 등급 표시 + ? 호버 (모바일은 클릭) → 분류 정책 모달.

import { useState } from "react";

type Props = {
  conditionClass: string | null | undefined;
  // showHelp: true = ? 아이콘 + 분류 정책 popover. 운영자풀 만 true.
  showHelp?: boolean;
};

type ChipStyle = {
  label: string;
  bg: string;
  text: string;
  desc: string;
};

const CHIP_STYLES: Record<string, ChipStyle> = {
  unopened: {
    label: "미개봉/새상품",
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-200",
    desc: "박스 안 뜯음. 다나와 새상품 시세 기준.",
  },
  mint: {
    label: "S급",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-800 dark:text-emerald-200",
    desc: "실사용 거의 없음 (AI 판정 — 사이클 적음 / 거의 새것).",
  },
  clean: {
    label: "A급",
    bg: "bg-teal-100 dark:bg-teal-900/40",
    text: "text-teal-800 dark:text-teal-200",
    desc: "셀러 명시 프리미엄 — 풀세트 / AppleCare / 배터리 100% / S급 표현. 셀러 인플레 가능성 (보수적 분류).",
  },
  normal: {
    label: "일반",
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-700 dark:text-zinc-300",
    desc: "명시적 신호 없음 (default).",
  },
  worn: {
    label: "사용감",
    bg: "bg-orange-100 dark:bg-orange-900/40",
    text: "text-orange-800 dark:text-orange-200",
    desc: "사용감, 잔기스, 미세 흠집 명시.",
  },
  flawed: {
    label: "훼손",
    bg: "bg-rose-100 dark:bg-rose-900/40",
    text: "text-rose-800 dark:text-rose-200",
    desc: "액정 깨짐 / 낙상 / 작동 결함 / 부품용. 풀 차단 대상.",
  },
  low_batt: {
    label: "배터리 저하",
    bg: "bg-yellow-100 dark:bg-yellow-900/40",
    text: "text-yellow-800 dark:text-yellow-200",
    desc: "배터리 효율 < 85% 명시. 가격 modifier.",
  },
};

export function ConditionChip({ conditionClass, showHelp = false }: Props) {
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
  return (
    <span className="relative inline-flex items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style.bg} ${style.text}`}>
        {style.label}
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

export function UnopenedPhotoBadge({
  conditionClass,
  compact = false,
  className = "",
}: {
  conditionClass: string | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  if (conditionClass !== "unopened") return null;
  return (
    <span
      title="미개봉/새상품으로 분류된 매물"
      className={`pointer-events-none absolute left-1.5 top-1.5 z-10 rounded-full border border-amber-200 bg-amber-50/95 px-1.5 py-0.5 text-[9px] font-black text-amber-900 shadow-sm backdrop-blur dark:border-amber-800/70 dark:bg-amber-950/90 dark:text-amber-100 ${
        compact ? "" : "sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[10px]"
      } ${className}`}
    >
      미개봉{compact ? "" : <span className="hidden sm:inline">/새상품</span>}
    </span>
  );
}
