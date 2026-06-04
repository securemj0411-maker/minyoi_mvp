"use client";

import { useEffect, useMemo, useState } from "react";

const ONE_HOUR_MS = 60 * 60 * 1000;

function formatTimer(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function PlansUrgencyCountdown({
  storageKey = "minyoi:plans-offer-expires-at",
}: {
  storageKey?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [expiresAt] = useState(() => {
    const fallback = Date.now() + ONE_HOUR_MS;
    if (typeof window === "undefined") return fallback;
    try {
      const existing = Number(window.localStorage.getItem(storageKey) ?? 0);
      if (Number.isFinite(existing) && existing > Date.now()) return existing;
      window.localStorage.setItem(storageKey, String(fallback));
    } catch {}
    return fallback;
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = Math.max(0, expiresAt - now);
  const progress = useMemo(() => {
    const elapsed = ONE_HOUR_MS - remaining;
    return Math.min(100, Math.max(0, (elapsed / ONE_HOUR_MS) * 100));
  }, [remaining]);

  return (
    <div className="overflow-hidden rounded-[18px] border border-amber-200 bg-white shadow-[0_16px_45px_rgba(245,158,11,0.14)] dark:border-amber-900/60 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            자리 확인 타이머
          </div>
          <div className="mt-1 break-keep text-[13px] font-black text-zinc-950 dark:text-zinc-50">
            지금 신청하면 장기권 특가 조건이 유지돼요
          </div>
        </div>
        <div className="shrink-0 rounded-2xl bg-zinc-950 px-3 py-2 text-center text-white dark:bg-white dark:text-zinc-950">
          <div className="text-[9px] font-black uppercase tracking-[0.12em] opacity-70">
            남은 시간
          </div>
          <div className="mt-0.5 font-mono text-[24px] font-black leading-none tabular-nums">
            {formatTimer(remaining)}
          </div>
        </div>
      </div>
      <div className="h-1.5 bg-amber-100 dark:bg-amber-950/50">
        <div
          className="h-full rounded-r-full bg-amber-500 transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
