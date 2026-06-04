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
    bg: "border border-blue-300/70 bg-gradient-to-r from-blue-950 via-blue-800 to-[#b78a2c] shadow-sm shadow-blue-950/15 dark:border-blue-300/30 dark:from-blue-400/25 dark:via-blue-900/70 dark:to-amber-500/25",
    text: "text-amber-50 dark:text-blue-50",
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
    label: "미개봉",
    compactLabel: "미개봉",
    mark: "N",
    // Wave 356: 미니멀 럭셔리 — zinc-950 단색 배경 + amber 텍스트 + 가는 amber 보더.
    // 이전 6-stop metallic 그라데이션은 촌스러움 (90년대 워드아트 톤). 깔끔 모던 톤으로 재설계.
    className: "border-amber-400/40 bg-zinc-950/95 text-amber-200 shadow-[0_4px_12px_rgba(0,0,0,0.25)] dark:border-amber-300/30 dark:bg-zinc-950 dark:text-amber-100",
    markClassName: "bg-amber-200 text-zinc-950 dark:bg-amber-100 dark:text-zinc-950",
    desc: "미개봉/새상품 — 박스 안 뜯음",
  },
  mint: {
    label: "S급",
    compactLabel: "S급",
    mark: "S",
    // Wave 356: 미니멀 럭셔리 — zinc-950 단색 배경 + emerald 텍스트 + 가는 emerald 보더.
    className: "border-blue-400/40 bg-zinc-950/95 text-blue-200 shadow-[0_4px_12px_rgba(0,0,0,0.25)] dark:border-blue-300/30 dark:bg-zinc-950 dark:text-blue-100",
    markClassName: "bg-blue-200 text-zinc-950 dark:bg-blue-100 dark:text-zinc-950",
    desc: "S급 — 실사용 거의 없음",
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

type NormalizedConditionTier = "S" | "A" | "B" | "C" | "D" | "UNKNOWN";

export function normalizeConditionTier(tier: string | null | undefined): NormalizedConditionTier | null {
  const raw = String(tier ?? "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper === "S" || upper === "A" || upper === "B" || upper === "C" || upper === "D" || upper === "UNKNOWN") {
    return upper;
  }
  const lower = raw.toLowerCase();
  if (lower === "s_grade") return "S";
  if (lower === "a_grade") return "A";
  if (lower === "b_grade") return "B";
  if (lower === "c_grade") return "C";
  if (lower === "d_grade" || lower === "reject") return "D";
  if (lower === "unknown_condition") return "UNKNOWN";
  return null;
}

// Wave 714q (2026-05-23): 신발/의류 5-tier 전용 사진 위 뱃지.
//   기존 ConditionPhotoBadge 는 옛 conditionClass (mint/unopened) 기반.
//   신발/의류는 새 tier (S/A/B/C/D) 사용 — 다른 component 로 분리.
const TIER_PHOTO_BADGE_STYLES: Record<string, { label: string; mark: string; className: string; markClassName: string; desc: string }> = {
  S: {
    label: "S급",
    mark: "S",
    className: "border-blue-400/40 bg-zinc-950/95 text-blue-200 shadow-[0_4px_12px_rgba(0,0,0,0.25)] dark:border-blue-300/30 dark:bg-zinc-950 dark:text-blue-100",
    markClassName: "bg-blue-200 text-zinc-950 dark:bg-blue-100 dark:text-zinc-950",
    desc: "S급 — 박스/풀구성 + kream/매장 + 미시착 2축 이상 동시 (최상급)",
  },
  A: {
    label: "A급",
    mark: "A",
    className: "border-[#bce9ff]/90 bg-[linear-gradient(135deg,#ffffff_0%,#dbf5ff_48%,#b8efe5_100%)] text-[#093a4d] shadow-[0_10px_24px_rgba(14,116,144,0.22)] ring-1 ring-white/80 dark:border-sky-400/45 dark:bg-[linear-gradient(135deg,#071d2c_0%,#0d5264_52%,#0b766e_100%)] dark:text-sky-50 dark:ring-sky-100/15",
    markClassName: "bg-[#0d5264] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] dark:bg-sky-100 dark:text-[#083548]",
    desc: "A급 — 박스 또는 kream 또는 미시착 단일 strong (양호)",
  },
  B: {
    label: "B급",
    mark: "B",
    className: "border-zinc-200/90 bg-[linear-gradient(135deg,#ffffff_0%,#f4f4f5_100%)] text-zinc-700 shadow-[0_7px_18px_rgba(39,39,42,0.12)] ring-1 ring-white/65 dark:border-zinc-700/80 dark:bg-[linear-gradient(135deg,#18181b_0%,#27272a_100%)] dark:text-zinc-200 dark:ring-white/10",
    markClassName: "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900",
    desc: "B급 — 약한 매칭 / 상세 부족 (보통)",
  },
  C: {
    label: "C급",
    mark: "C",
    className: "border-orange-200/90 bg-[linear-gradient(135deg,#fff7ed_0%,#fed7aa_100%)] text-orange-950 shadow-[0_7px_18px_rgba(194,65,12,0.14)] ring-1 ring-white/60 dark:border-orange-800/80 dark:bg-[linear-gradient(135deg,#2b1206_0%,#7c2d12_100%)] dark:text-orange-100 dark:ring-orange-100/10",
    markClassName: "bg-orange-900 text-orange-50 dark:bg-orange-100 dark:text-orange-950",
    desc: "C급 — 경미 하자 또는 사용감",
  },
  D: {
    label: "D급",
    mark: "D",
    className: "border-rose-200/90 bg-[linear-gradient(135deg,#fff1f2_0%,#fecdd3_100%)] text-rose-950 shadow-[0_7px_18px_rgba(190,18,60,0.14)] dark:border-rose-800/80 dark:bg-[linear-gradient(135deg,#2a0710_0%,#881337_100%)] dark:text-rose-100",
    markClassName: "bg-rose-900 text-rose-50 dark:bg-rose-100 dark:text-rose-950",
    desc: "D급 — 빈티지/구제 또는 심각 하자",
  },
};

// Wave 714r: 의류용 짧은 desc (tooltip). 사진 위 hover 시 보임.
const TIER_PHOTO_DESC_CLOTHING: Record<string, string> = {
  S: "S급 — 미사용 + 시즌/콜라보/매장 anchor 중 2축 이상 동시 (최상급)",
  A: "A급 — 미사용 또는 콜라보 또는 자율등급 단일 strong (양호)",
  B: "B급 — 약한 매칭 / 상세 부족 (보통)",
  C: "C급 — 보풀/늘어남 같은 경미 하자 또는 X/10 점수",
  D: "D급 — 빈티지/구제 또는 이염/구멍/황변 심각 하자",
};

export function ConditionTierPhotoBadge({
  tier,
  compact = false,
  className = "",
  category,
}: {
  tier: string | null | undefined;
  compact?: boolean;
  className?: string;
  // Wave 714r/760d: 의류만 desc 분리. 신발/게임기/골프는 공통 tier desc 사용.
  category?: "shoe" | "clothing" | "game_console" | "sport_golf" | null;
}) {
  const normalizedTier = normalizeConditionTier(tier);
  if (!normalizedTier || normalizedTier === "UNKNOWN") return null;
  const style = TIER_PHOTO_BADGE_STYLES[normalizedTier];
  if (!style) return null;
  const desc = category === "clothing" ? (TIER_PHOTO_DESC_CLOTHING[normalizedTier] ?? style.desc) : style.desc;
  return (
    <span
      title={desc}
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
        <span className="relative whitespace-nowrap leading-none">{style.label}</span>
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

// =============================================================================
// Wave 714d (2026-05-23): 신발/의류 5-tier S/A/B/C/D 등급 chip + raw 표현 chips.
//
// 기존 ConditionChip 은 전자기기 condition_class (unopened/mint/clean/normal/worn/...) 전용.
// 신발/의류는 raw 텍스트 기반 grading (Wave 714 cross-tab sweep 결과 — S/A/B/C/D + 박스/하자/실착 chips).
// 같은 컴포넌트에 박지 않고 분리 (axis 의미 다름).
//
// 노출 위치: /me 운영자 시세 근거 / /me 피드 상세 / 쉬운모드.
// =============================================================================

type TierStyle = {
  label: string;
  friendlyLabel: string;
  bg: string;
  text: string;
  desc: string;
};

const TIER_STYLES: Record<string, TierStyle> = {
  S: {
    label: "S급",
    friendlyLabel: "최상급",
    // gold + green — 가장 strong (2축 이상 매칭).
    bg: "border border-blue-300/70 bg-gradient-to-r from-blue-950 via-blue-800 to-[#b78a2c] shadow-sm shadow-blue-950/15 dark:border-blue-300/30 dark:from-blue-400/25 dark:via-blue-900/70 dark:to-amber-500/25",
    text: "text-amber-50 dark:text-blue-50",
    desc: "박스/풀구성 + 미시착/실착 1-2회 + 정품 anchor (kream/매장) 2축 이상 동시. 데이터 1.85~2.3x premium.",
  },
  A: {
    label: "A급",
    friendlyLabel: "양호",
    bg: "border border-sky-200/80 bg-gradient-to-r from-white via-sky-50 to-teal-100 shadow-sm shadow-sky-900/10 dark:border-sky-300/20 dark:from-sky-400/20 dark:via-teal-900/50 dark:to-zinc-900",
    text: "text-sky-950 dark:text-sky-50",
    desc: "박스 또는 kream 또는 미시착 단일 strong signal. 데이터 1.4~1.7x.",
  },
  B: {
    label: "B급",
    friendlyLabel: "보통",
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-700 dark:text-zinc-300",
    desc: "상세 설명 부족 또는 약한 매칭. 대다수 매물 (default).",
  },
  C: {
    label: "C급",
    friendlyLabel: "사용감",
    bg: "bg-orange-100 dark:bg-orange-900/40",
    text: "text-orange-800 dark:text-orange-200",
    desc: "경미 하자 (보풀/먼지/스크래치) 또는 사용감 명시. 데이터 0.5~0.7x.",
  },
  D: {
    label: "D급",
    friendlyLabel: "낡음/하자",
    bg: "bg-rose-100 dark:bg-rose-900/40",
    text: "text-rose-800 dark:text-rose-200",
    desc: "빈티지/구제 또는 심각 하자 (이염/굽 닳음/터짐). 데이터 <0.5x.",
  },
  UNKNOWN: {
    label: "정보 부족",
    friendlyLabel: "확인 필요",
    bg: "bg-zinc-100 dark:bg-zinc-800 italic",
    text: "text-zinc-500 dark:text-zinc-400",
    desc: "셀러가 상세 설명 안 적음. 시세 신뢰도 낮음 (보수적 평가).",
  },
};

// Wave 714r (2026-05-23): 의류는 분류 axis 가 신발과 다름 — popover 설명 분리.
//   의류 specific: 시즌 SS/FW (3.27x), 콜라보, 자율등급 (S/A/B급 셀러 표기), 수선/줄임 (+1.59x positive)
//   의류 D: 구제 (gunje, 0.42x) — 일본 빈티지샵 유통, 신발엔 없는 axis.
const TIER_DESC_CLOTHING: Record<string, string> = {
  S: "택그대로/미사용 + 시즌(SS/FW) 표기 + 정품 (kream/매장) + 콜라보/자율등급 중 2축 이상 동시. 데이터 1.7x+ (cluster-relative).",
  A: "미사용 또는 시즌 표기 또는 콜라보 또는 자율등급 단일 strong signal. 데이터 1.2~1.7x.",
  B: "상세 설명 부족 또는 약한 매칭. 대다수 매물 (default).",
  C: "보풀/늘어남/얼룩 같은 경미 하자 또는 'X/10 점수' 자술. 데이터 0.5~0.85x.",
  D: "빈티지(낡음) 또는 구제(일본 빈티지샵) 또는 이염/구멍/황변 등 심각 하자. 데이터 <0.5x.",
  UNKNOWN: "셀러가 상세 설명 안 적음. 시세 신뢰도 낮음 (보수적 평가).",
};

type ChipBadgeKey = string;

/** Wave 714 chip key → 한국어 라벨 + 색상 mapping. */
const CHIP_BADGES: Record<ChipBadgeKey, { label: string; type: "positive" | "negative" | "neutral" }> = {
  // tech/device condition_notes -> 사용자 언어 chip
  "condition:display_defect": { label: "액정/화면 이상", type: "negative" },
  "condition:device_body_damage": { label: "뒷판/프레임 파손", type: "negative" },
  "condition:foldable_hinge_damage": { label: "힌지/내부액정 이상", type: "negative" },
  "condition:screen_replaced": { label: "액정 교체/수리", type: "negative" },
  "condition:faceid_issue": { label: "Face ID 이상", type: "negative" },
  "condition:camera_issue": { label: "카메라 이상", type: "negative" },
  "condition:camera_lens_damage": { label: "카메라 렌즈 손상", type: "negative" },
  "condition:sim_or_carrier_issue": { label: "유심/통신 이슈", type: "negative" },
  "condition:water_damage": { label: "침수 의심", type: "negative" },
  "condition:locked_or_lost_signal": { label: "잠금/분실 위험", type: "negative" },
  "condition:parts_only": { label: "부품용", type: "negative" },
  "condition:repair_or_defect_signal": { label: "하자/수리 언급", type: "negative" },
  "condition:device_charging_or_sensor_issue": { label: "충전/센서 이상", type: "negative" },
  "condition:refurbished_or_repaired": { label: "사설수리/리퍼", type: "negative" },
  "condition:low_battery_health": { label: "배터리 낮음", type: "negative" },
  "condition:high_battery_cycles": { label: "사이클 많음", type: "negative" },
  "condition:cosmetic_wear": { label: "생활흠집/사용감", type: "neutral" },
  "condition:earphone_single_side_unit": { label: "한쪽 유닛/분실", type: "negative" },
  "condition:earphone_case_only": { label: "케이스/부품 단품", type: "negative" },
  "condition:earphone_audio_issue": { label: "소리 이상", type: "negative" },
  "condition:earphone_anc_issue": { label: "노캔/주변음 이상", type: "negative" },
  "condition:earphone_mic_issue": { label: "마이크 이상", type: "negative" },
  "condition:earphone_pairing_issue": { label: "페어링/연결 이상", type: "negative" },
  "condition:earphone_battery_issue": { label: "충전/배터리 이상", type: "negative" },
  "condition:earphone_physical_damage": { label: "파손/침수", type: "negative" },
  "condition:earphone_missing_parts": { label: "구성품 누락", type: "neutral" },
  "condition:earphone_hygiene_warning": { label: "오염 확인", type: "neutral" },
  "condition:bag_lining_damage": { label: "안감 하자", type: "negative" },
  "condition:bag_leather_damage": { label: "가죽/코팅 손상", type: "negative" },
  "condition:bag_handle_worn": { label: "손잡이/스트랩 마모", type: "negative" },
  "condition:bag_corner_worn": { label: "모서리 마모", type: "negative" },
  "condition:fashion_stain_or_discoloration": { label: "오염/이염", type: "negative" },
  "condition:fashion_hygiene_warning": { label: "냄새/위생 확인", type: "negative" },
  "condition:shoe_upper_damage": { label: "갑피/앞코 하자", type: "negative" },
  "condition:shoe_sole_damage": { label: "밑창/솔 하자", type: "negative" },
  "condition:shoe_insole_missing": { label: "인솔/깔창 누락", type: "neutral" },
  "condition:clothing_fading": { label: "색바램/변색", type: "negative" },
  "condition:clothing_stretched": { label: "늘어남", type: "negative" },
  "condition:clothing_pilling": { label: "보풀", type: "neutral" },
  "condition:clothing_structural_damage": { label: "찢김/봉제 하자", type: "negative" },
  "condition:clothing_print_cracked": { label: "프린팅 갈라짐", type: "negative" },
  // wear
  "wear:unworn": { label: "미시착", type: "positive" },
  "wear:worn_1to2": { label: "실착 1-2회", type: "positive" },
  "wear:worn_3to5": { label: "실착 3-5회", type: "positive" },
  "wear:used": { label: "사용감 있음", type: "neutral" },
  "wear:heavily_used": { label: "많이 신음", type: "negative" },
  "wear:vintage": { label: "빈티지", type: "negative" },
  "wear:gunje": { label: "구제", type: "negative" },
  // box (신발)
  "box:full": { label: "풀구성", type: "positive" },
  "box:box_included": { label: "박스 포함", type: "positive" },
  "box:box_only": { label: "박스만", type: "neutral" },
  "box:no_box": { label: "박스 없음", type: "negative" },
  "box:box_damaged": { label: "박스 손상", type: "negative" },
  // box (의류 - 태그 axis)
  "box:tag_attached": { label: "택 부착", type: "positive" },
  "box:tag_only_cut": { label: "택만 자름", type: "neutral" },
  "box:no_box_no_tag": { label: "구성품 없음", type: "negative" },
  // auth
  "auth:kream": { label: "KREAM 인증", type: "positive" },
  "auth:store": { label: "매장/공홈", type: "positive" },
  "auth:musinsa": { label: "무신사", type: "positive" },
  "auth:season": { label: "시즌 표기 (SS/FW)", type: "positive" },
  // damage
  "damage:minor": { label: "경미 하자", type: "negative" },
  "damage:major": { label: "심각 하자", type: "negative" },
  "damage:repair_pos": { label: "수선/사이즈 맞춤", type: "positive" },
  // shoe extras
  "extra:extra_laces": { label: "여분끈", type: "positive" },
  "extra:insole_changed": { label: "깔창 교체", type: "neutral" },
  "shoe:washed": { label: "세탁 통과", type: "negative" },
  // clothing extras
  "extra:collab": { label: "콜라보/한정", type: "positive" },
  "extra:self_grade": { label: "셀러 등급 표기", type: "positive" },
  "extra:x10_score": { label: "X/10 점수", type: "neutral" },
  "extra:charms": { label: "지비츠 포함", type: "positive" },
};

export function conditionChipDisplayLabel(chip: string): string | null {
  return CHIP_BADGES[chip]?.label ?? null;
}

export function ConditionTierChip({
  tier,
  variant = "default",
  showHelp = false,
  category,
}: {
  tier: string | null | undefined;
  variant?: "default" | "friendly";
  showHelp?: boolean;
  // Wave 714r (2026-05-23): "shoe" | "clothing" — popover desc 분리.
  //   의류는 분류 axis 자체가 신발과 다름 (시즌/콜라보/자율등급/수선/구제).
  category?: "shoe" | "clothing" | null;
}) {
  const [open, setOpen] = useState(false);
  const normalizedTier = normalizeConditionTier(tier);
  if (!normalizedTier) return null;
  const style = TIER_STYLES[normalizedTier];
  if (!style) {
    return (
      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-bold text-zinc-700 ring-1 ring-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:ring-zinc-600">
        상태 확인
      </span>
    );
  }
  const displayLabel = variant === "friendly" ? style.friendlyLabel : style.label;
  return (
    <span className="relative inline-flex items-center gap-1">
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black shadow-sm ring-1 ring-black/5 dark:ring-white/10 ${style.bg} ${style.text}`}>
        {displayLabel}
      </span>
      {showHelp && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-bold text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
            aria-label="신발/의류 등급 분류 정책 보기"
          >
            ?
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute left-0 top-5 z-50 w-72 rounded-lg border border-zinc-300 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                <div className="mb-2 text-[11px] font-bold text-zinc-900 dark:text-zinc-100">
                  {category === "clothing" ? "의류" : "신발"} 등급 (5-tier)
                </div>
                <div className="space-y-1.5 text-[10px]">
                  {(["S", "A", "B", "C", "D", "UNKNOWN"] as const).map((k) => {
                    const s = TIER_STYLES[k];
                    // Wave 714r: category 별 desc 분리 — 신발/의류 axis 다름.
                    const desc = category === "clothing" ? (TIER_DESC_CLOTHING[k] ?? s.desc) : s.desc;
                    return (
                      <div key={k} className="flex items-stretch gap-2">
                        <span className={`flex min-w-[52px] shrink-0 items-center justify-center self-stretch rounded-full px-2 py-1 text-center text-[10px] font-bold leading-none ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                        <span className="min-w-0 leading-5 text-zinc-600 dark:text-zinc-400">{desc}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 border-t border-zinc-200 pt-2 text-[9px] text-zinc-500 dark:border-zinc-700">
                  raw 텍스트 (제목 + 상세설명) 기반 자동 분류 (Wave 714).
                  {category === "clothing"
                    ? " 의류는 시즌/콜라보/자율등급/수선 axis 활용. cluster (premium_archive/volume_vintage/collab_heavy/casual_mass) 별 cluster-relative 시세."
                    : " brand cluster (premium_snk/run_tech/volume_vintage/casual_parts) 별 cluster-relative 시세."}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </span>
  );
}

/** Wave 714d: chip 배열 → 한국어 라벨 chip 들 표시. raw 표현 기반. */
export function ConditionChipsList({
  chips,
  max = 5,
  className = "",
}: {
  chips: string[] | null | undefined;
  max?: number;
  className?: string;
}) {
  if (!chips || chips.length === 0) return null;
  const visible = chips.slice(0, max);
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {visible.map((chip) => {
        const badge = CHIP_BADGES[chip];
        if (!badge) return null;
        const colorClass =
          badge.type === "positive"
            ? "bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-900/35 dark:text-blue-100 dark:ring-blue-800/60"
            : badge.type === "negative"
              ? "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-100 dark:ring-rose-800/70"
              : "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700";
        return (
          <span
            key={chip}
            title={chip}
            className={`rounded-full px-2 py-1 text-[11px] font-bold leading-none shadow-sm ring-1 ${colorClass}`}
          >
            {badge.label}
          </span>
        );
      })}
      {chips.length > max && (
        <span className="text-[10px] text-zinc-400">+{chips.length - max}</span>
      )}
    </div>
  );
}
