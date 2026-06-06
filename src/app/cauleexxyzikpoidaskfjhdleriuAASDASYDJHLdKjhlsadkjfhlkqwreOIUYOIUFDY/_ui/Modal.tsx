"use client";

// 중앙 모달 — role=dialog + aria-modal + Escape 닫기 + focus-trap + 직전 포커스 복원 + scroll lock.
//   손수짠 role=dialog(Escape/trap 없던 members-table 드로어 등) 대체.

import { useId, useRef, type ReactNode } from "react";

import { useDialogA11y } from "./hooks";
import { Button } from "./primitives";
import { cn, FONT, INK, RADIUS, SURFACE } from "./tokens";

const SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogA11y(open, onClose, ref);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[90vh] w-full flex-col",
          SIZE[size],
          RADIUS.card,
          "border p-5",
          SURFACE.lineStrong,
          SURFACE.raised,
          "bg-zinc-900",
        )}
      >
        {title ? (
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id={titleId} className={cn(FONT.h2, "font-black", INK.primary)}>
              {title}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="닫기">
              ✕
            </Button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="mt-4 flex flex-wrap items-center justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
