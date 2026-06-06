"use client";

// 운영자 세션 시계 (KST, 1초 tick).

import { useKstClock } from "../hooks";
import { cn, FONT, INK } from "../tokens";

export function Clock() {
  const now = useKstClock({ seconds: true });
  return (
    <span className={cn("tabular-nums", FONT.meta, INK.faint)} suppressHydrationWarning>
      {now || "—"}
    </span>
  );
}
