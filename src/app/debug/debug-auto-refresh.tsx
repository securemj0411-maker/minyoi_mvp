"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

type DebugAutoRefreshProps = {
  intervalSeconds?: number;
};

function nowLabel() {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date());
}

export function DebugAutoRefresh({ intervalSeconds = 10 }: DebugAutoRefreshProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [lastRefreshAt, setLastRefreshAt] = useState(nowLabel());
  const [isPending, startTransition] = useTransition();
  const intervalMs = useMemo(() => Math.max(5, intervalSeconds) * 1000, [intervalSeconds]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
        setLastRefreshAt(nowLabel());
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, router]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          startTransition(() => {
            router.refresh();
            setLastRefreshAt(nowLabel());
          });
        }}
        className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 disabled:opacity-60"
        disabled={isPending}
      >
        {isPending ? "새로고침 중" : "새로고침"}
      </button>
      <button
        type="button"
        onClick={() => setEnabled((value) => !value)}
        className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
          enabled
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
        }`}
      >
        자동 {enabled ? "켜짐" : "꺼짐"}
      </button>
      <div className="text-xs text-zinc-500">
        {intervalSeconds}초마다 갱신 · 마지막 {lastRefreshAt}
      </div>
    </div>
  );
}
