// 디스플레이 프리미티브 (서버-ok: hooks/state 없음 → 서버페이지에서도 사용 가능).
//   Button/Panel/SectionHeader/StatCard/StatusBadge/Badge/Notice/EmptyState/Spinner.

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn, FONT, FOCUS, INK, RADIUS, SURFACE, TONE, type Tone } from "./tokens";

/* ── Button ─────────────────────────────────────────────── */
type ButtonVariant = "primary" | "approve" | "danger" | "ghost" | "subtle";
type ButtonSize = "sm" | "md" | "lg";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: cn(TONE.blue.solid, TONE.blue.solidText, "border border-transparent"),
  approve: cn(TONE.emerald.solid, TONE.emerald.solidText, "border border-transparent"),
  danger: cn("border", TONE.rose.border, TONE.rose.soft, TONE.rose.text, "hover:bg-rose-500/20"),
  ghost: "border border-transparent bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white",
  subtle: cn("border", SURFACE.line, SURFACE.cardSolid, INK.secondary, "hover:border-zinc-700 hover:text-white"),
};
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export function Button({
  variant = "subtle",
  size = "md",
  type = "button",
  className,
  children,
  ...rest
}: { variant?: ButtonVariant; size?: ButtonSize } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-bold transition",
        RADIUS.control,
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        FOCUS,
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── Panel (카드 컨테이너) ───────────────────────────────── */
export function Panel({
  raised,
  className,
  children,
}: {
  raised?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(RADIUS.card, "border", SURFACE.line, raised ? SURFACE.raised : SURFACE.card, className)}>
      {children}
    </div>
  );
}

/* ── SectionHeader ──────────────────────────────────────── */
export function SectionHeader({
  eyebrow,
  title,
  caption,
  tone = "blue",
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  caption?: ReactNode;
  tone?: Tone;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <div aria-hidden className={cn("mb-1 font-black uppercase tracking-[0.16em]", FONT.meta, TONE[tone].text)}>
            {eyebrow}
          </div>
        ) : null}
        <h2 className={cn(FONT.h2, "font-black tracking-tight", INK.primary)}>{title}</h2>
        {caption ? <p className={cn("mt-1 break-keep leading-5", FONT.meta, INK.muted)}>{caption}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ── StatCard (KPI 타일) ────────────────────────────────── */
export function StatCard({
  label,
  value,
  sub,
  tone = "slate",
  loading,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(RADIUS.card, "border p-4", SURFACE.line, TONE[tone].soft, className)}>
      <div className={cn(FONT.meta, "font-bold", INK.muted)}>{label}</div>
      <div className={cn("mt-1.5 text-2xl font-black tabular-nums", loading ? INK.faint : INK.primary)}>
        {loading ? "—" : value}
      </div>
      {sub ? <div className={cn("mt-1 break-keep font-medium leading-4", FONT.meta, INK.muted)}>{sub}</div> : null}
    </div>
  );
}

/* ── StatusBadge / Badge ────────────────────────────────── */
export function StatusBadge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-bold",
        FONT.meta,
        t.border,
        t.soft,
        t.text,
      )}
    >
      {children}
    </span>
  );
}

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 font-bold tabular-nums",
        FONT.meta,
        t.soft,
        t.text,
      )}
    >
      {children}
    </span>
  );
}

/* ── Notice (인라인 알림) ───────────────────────────────── */
export function Notice({
  tone = "blue",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  const isAlert = tone === "rose" || tone === "amber";
  return (
    <div
      role={isAlert ? "alert" : "status"}
      className={cn(RADIUS.control, "border px-3 py-2 font-medium", FONT.body, t.border, t.soft, t.text, className)}
    >
      {children}
    </div>
  );
}

/* ── EmptyState ─────────────────────────────────────────── */
export function EmptyState({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-center",
        FONT.body,
        INK.muted,
      )}
    >
      {icon ? (
        <div className="text-2xl opacity-70" aria-hidden>
          {icon}
        </div>
      ) : null}
      <div>{children}</div>
    </div>
  );
}

/* ── Spinner ────────────────────────────────────────────── */
export function Spinner({ label = "불러오는 중…", size = "md" }: { label?: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span role="status" className={cn("inline-flex items-center gap-2", FONT.meta, INK.muted)}>
      <span className={cn(dim, "animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400")} aria-hidden />
      {label ? <span>{label}</span> : <span className="sr-only">불러오는 중</span>}
    </span>
  );
}
