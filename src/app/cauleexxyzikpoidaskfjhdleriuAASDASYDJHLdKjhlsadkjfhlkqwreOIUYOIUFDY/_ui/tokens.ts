// 관리자 콘솔 디자인 토큰 (admin 전용, 다크 고정).
//   plain className 상수맵 — cva/clsx/tailwind-merge 미사용(레포 관례). globals.css 확장 X.
//   a11y 규약: 폰트 ≥ text-xs(12px), 텍스트 muted floor = zinc-400(검정 대비 ~7:1), 모든 인터랙티브에 FOCUS.

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// 폰트 스케일 — 12px floor. text-[8~11px] 금지.
export const FONT = {
  meta: "text-xs", // 12px — 라벨/메타 최소
  body: "text-sm", // 14px
  h3: "text-base", // 16px
  h2: "text-lg", // 18px
  h1: "text-2xl", // 24px
} as const;

// 텍스트 잉크 — 검정(zinc-950) 위 대비 안전. text-zinc-600/700 금지.
export const INK = {
  primary: "text-zinc-100",
  secondary: "text-zinc-300",
  muted: "text-zinc-400", // 보조 텍스트 floor (~7:1)
  faint: "text-zinc-500", // 큰/볼드 장식 메타만 (~4.6:1, 작은 본문 금지)
  inverse: "text-zinc-950",
} as const;

// 표면
export const SURFACE = {
  page: "bg-zinc-950",
  card: "bg-zinc-900/60",
  cardSolid: "bg-zinc-900",
  raised: "bg-zinc-900/80 shadow-[0_18px_60px_rgba(0,0,0,0.45)]",
  inset: "bg-zinc-950/60",
  line: "border-zinc-800",
  lineStrong: "border-zinc-700",
} as const;

// 액센트 톤 — 이름 → 텍스트/연한배경/보더/채움
export type Tone = "blue" | "emerald" | "amber" | "rose" | "violet" | "slate";

export const TONE: Record<
  Tone,
  { text: string; soft: string; border: string; solid: string; solidText: string }
> = {
  blue: {
    text: "text-blue-300",
    soft: "bg-blue-500/12",
    border: "border-blue-400/30",
    solid: "bg-blue-500 hover:bg-blue-400",
    solidText: "text-white",
  },
  emerald: {
    text: "text-emerald-300",
    soft: "bg-emerald-500/12",
    border: "border-emerald-400/30",
    solid: "bg-emerald-500 hover:bg-emerald-400",
    solidText: "text-zinc-950",
  },
  amber: {
    text: "text-amber-300",
    soft: "bg-amber-500/12",
    border: "border-amber-400/30",
    solid: "bg-amber-500 hover:bg-amber-400",
    solidText: "text-zinc-950",
  },
  rose: {
    text: "text-rose-300",
    soft: "bg-rose-500/12",
    border: "border-rose-400/30",
    solid: "bg-rose-500 hover:bg-rose-400",
    solidText: "text-white",
  },
  violet: {
    text: "text-violet-300",
    soft: "bg-violet-500/12",
    border: "border-violet-400/30",
    solid: "bg-violet-500 hover:bg-violet-400",
    solidText: "text-white",
  },
  slate: {
    text: "text-zinc-300",
    soft: "bg-white/5",
    border: "border-zinc-700",
    solid: "bg-zinc-700 hover:bg-zinc-600",
    solidText: "text-white",
  },
};

// 포커스 링 — 모든 인터랙티브 요소.
export const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";

// 반경
export const RADIUS = {
  card: "rounded-2xl",
  control: "rounded-lg",
  pill: "rounded-full",
} as const;

// status 문자열 → 톤 (배지 공용). 호출부는 이 맵으로 일관 색 사용.
export const STATUS_TONE: Record<string, Tone> = {
  pending: "amber",
  approved: "blue",
  rejected: "rose",
  success: "emerald",
  done: "emerald",
  open: "emerald",
  closed: "slate",
  neutral: "slate",
  auto: "violet",
};
