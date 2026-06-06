"use client";

// 슬림 상단바 — 브랜드 + 모바일 햄버거 + KPI 티커 + 시계 + 사이트로.

import Link from "next/link";

import { cn, FONT, FOCUS, INK, SURFACE } from "../tokens";
import { Clock } from "./Clock";
import { KpiTicker } from "./KpiTicker";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className={cn("shrink-0 border-b", SURFACE.line, SURFACE.cardSolid)}>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="메뉴 열기"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border md:hidden",
              SURFACE.line,
              INK.secondary,
              "hover:text-white",
              FOCUS,
            )}
          >
            ☰
          </button>
          <span className={cn("font-black tracking-tight", FONT.body, INK.primary)}>득템잡이 운영자</span>
          <span className={cn("hidden rounded-full bg-blue-500/12 px-2 py-0.5 text-blue-200 sm:inline", FONT.meta)}>
            멤버십 운영
          </span>
          <span className={cn("hidden items-center gap-1 sm:inline-flex", FONT.meta)}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            <span className="text-emerald-300">실시간</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Clock />
          <Link
            href="/"
            className={cn(
              "rounded-full border px-3 py-1 font-bold",
              FONT.meta,
              SURFACE.line,
              INK.secondary,
              "hover:border-blue-500/60 hover:text-blue-200",
              FOCUS,
            )}
          >
            사이트로
          </Link>
        </div>
      </div>
      <KpiTicker />
    </header>
  );
}
