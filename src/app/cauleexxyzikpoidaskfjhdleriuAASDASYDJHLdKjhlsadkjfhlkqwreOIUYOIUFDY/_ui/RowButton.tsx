"use client";

// 클릭 가능한 테이블 행 — 키보드(Enter/Space) + 포커스 + role=button.
//   기존 <tr onClick>/<td onClick> (키보드 미지원) 대체.

import type { KeyboardEvent, ReactNode } from "react";

import { cn, FOCUS, SURFACE } from "./tokens";

export function RowButton({
  onActivate,
  selected,
  disabled,
  ariaLabel,
  className,
  children,
}: {
  onActivate: () => void;
  selected?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      onActivate();
    }
  }

  return (
    <tr
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected || undefined}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onActivate}
      onKeyDown={handleKeyDown}
      className={cn(
        "border-b transition",
        SURFACE.line,
        disabled ? "opacity-50" : "cursor-pointer hover:bg-zinc-900/60",
        selected && "bg-zinc-900/80",
        FOCUS,
        "focus-visible:ring-inset",
        className,
      )}
    >
      {children}
    </tr>
  );
}
