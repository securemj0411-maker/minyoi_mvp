"use client";

// 사이드 드로어 — Modal 과 동일 a11y(useDialogA11y). members-table 우측 상세 + 모바일 사이드바에 재사용.

import { useId, useRef, type ReactNode } from "react";

import { useDialogA11y } from "./hooks";
import { Button } from "./primitives";
import { cn, FONT, INK, SURFACE } from "./tokens";

export function Drawer({
  open,
  onClose,
  side = "right",
  title,
  children,
  widthClass = "max-w-md",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  side?: "right" | "left";
  title?: ReactNode;
  children: ReactNode;
  widthClass?: string;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogA11y(open, onClose, ref);

  if (!open) return null;

  const sidePos = side === "right" ? "right-0 border-l" : "left-0 border-r";

  return (
    <div className="fixed inset-0 z-[100]" role="presentation">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 flex w-full flex-col p-5",
          widthClass,
          sidePos,
          SURFACE.lineStrong,
          "bg-zinc-900 shadow-[0_18px_60px_rgba(0,0,0,0.45)]",
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? (
            <h2 id={titleId} className={cn(FONT.h2, "font-black", INK.primary)}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="닫기">
            ✕
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="mt-4 flex flex-wrap items-center justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
