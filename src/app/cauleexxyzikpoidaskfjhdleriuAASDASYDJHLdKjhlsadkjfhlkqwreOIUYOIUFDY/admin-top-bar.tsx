"use client";

// Wave launch-108 (2026-05-24): sticky admin top bar — Bloomberg terminal feel.
//   기존엔 각 page.tsx 에 nav + KPI ticker 중복 박혀 있어서 페이지 전환 시 풀 reload.
//   이제 layout.tsx 가 이 컴포넌트 마운트 → Next.js soft navigation 시 sticky bar 유지 +
//   client polling 으로 KPI 실시간 갱신 (30s) → 진짜 ticker 느낌.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  OPS_ADMIN_BASE_PATH,
  OPS_ADMIN_DETAIL_EVENTS_PATH,
  OPS_ADMIN_FEEDBACK_STATS_PATH,
  OPS_ADMIN_LOSS_REPORTS_PATH,
  OPS_ADMIN_POOL_PATH,
  OPS_ADMIN_REVEAL_ANALYTICS_PATH,
} from "@/lib/admin-routes";

type Stats = {
  revenueToday: number;
  revenueMonth: number;
  activeSubs: number;
  totalPro: number;
  totalPlus: number;
  totalStarter: number;
  newSignupsToday: number;
  packOpensToday: number;
  revealsToday: number;
  clicksToday: number;
  totalAccounts: number;
  computedAt: string;
};

const NAV_ITEMS: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
  { href: OPS_ADMIN_BASE_PATH, label: "MEMBERS", match: (p) => p === OPS_ADMIN_BASE_PATH },
  { href: OPS_ADMIN_POOL_PATH, label: "POOL", match: (p) => p.startsWith(OPS_ADMIN_POOL_PATH) },
  { href: OPS_ADMIN_LOSS_REPORTS_PATH, label: "REPORTS", match: (p) => p.startsWith(OPS_ADMIN_LOSS_REPORTS_PATH) },
  { href: OPS_ADMIN_FEEDBACK_STATS_PATH, label: "STATS", match: (p) => p.startsWith(OPS_ADMIN_FEEDBACK_STATS_PATH) },
  { href: OPS_ADMIN_REVEAL_ANALYTICS_PATH, label: "REVEALS", match: (p) => p.startsWith(OPS_ADMIN_REVEAL_ANALYTICS_PATH) },
  { href: OPS_ADMIN_DETAIL_EVENTS_PATH, label: "EVENTS", match: (p) => p.startsWith(OPS_ADMIN_DETAIL_EVENTS_PATH) },
];

function formatKstTime(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "2-digit", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(new Date()).replace(",", "");
}

export default function AdminTopBar() {
  const pathname = usePathname() ?? "";
  const [stats, setStats] = useState<Stats | null>(null);
  const [now, setNow] = useState<string>("");
  const [statsLoading, setStatsLoading] = useState(true);

  // Wave launch-108: KPI polling 30s (cron tick 주기와 정합).
  useEffect(() => {
    let stopped = false;
    async function pull() {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        if (!stopped && res.ok) setStats((await res.json()) as Stats);
      } catch {
        // silent — next tick 에서 재시도
      } finally {
        if (!stopped) setStatsLoading(false);
      }
    }
    void pull();
    const t = window.setInterval(pull, 30_000);
    return () => { stopped = true; window.clearInterval(t); };
  }, []);

  // session clock tick 1s.
  useEffect(() => {
    setNow(formatKstTime());
    const t = window.setInterval(() => setNow(formatKstTime()), 1_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 font-mono text-zinc-200 backdrop-blur">
      {/* Row 1 — brand + session + main link */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-900 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em]">
        <div className="flex items-center gap-3">
          <span className="font-black tracking-[0.22em] text-amber-400">▌MINYOI TERM</span>
          <span className="text-zinc-600">v1.0</span>
          <span className="text-zinc-600">·</span>
          <span className="text-blue-400">●LIVE</span>
        </div>
        <div className="flex items-center gap-3 text-zinc-500">
          <span className="tabular-nums">{now} KST</span>
          <Link
            href="/"
            className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-bold text-zinc-400 hover:border-amber-700 hover:text-amber-300"
          >
            ◀ MAIN
          </Link>
        </div>
      </div>

      {/* Row 2 — KPI ticker (polling). 가로 scroll 가능. */}
      <div className="flex items-stretch divide-x divide-zinc-900 overflow-x-auto bg-zinc-950 text-[10px]">
        <TickerCell label="REV TODAY" value={stats ? `₩${stats.revenueToday.toLocaleString("ko-KR")}` : "—"} loading={statsLoading} />
        <TickerCell label="REV MONTH" value={stats ? `₩${stats.revenueMonth.toLocaleString("ko-KR")}` : "—"} loading={statsLoading} />
        <TickerCell
          label="ACTIVE SUB"
          value={stats ? String(stats.activeSubs) : "—"}
          sub={stats ? `P${stats.totalPro}/PL${stats.totalPlus}/ST${stats.totalStarter}` : undefined}
          loading={statsLoading}
        />
        <TickerCell label="ACCOUNTS" value={stats ? String(stats.totalAccounts) : "—"} loading={statsLoading} />
        <TickerCell label="NEW SIGNUP" value={stats ? String(stats.newSignupsToday) : "—"} loading={statsLoading} />
        <TickerCell label="PACK OPEN" value={stats ? String(stats.packOpensToday) : "—"} loading={statsLoading} />
        <TickerCell label="REVEAL" value={stats ? String(stats.revealsToday) : "—"} loading={statsLoading} />
        <TickerCell
          label="CLICK / CTR"
          value={stats ? String(stats.clicksToday) : "—"}
          sub={stats && stats.revealsToday > 0 ? `${Math.round((stats.clicksToday / stats.revealsToday) * 100)}%` : undefined}
          loading={statsLoading}
        />
      </div>

      {/* Row 3 — nav (Link + active highlight). */}
      <nav className="flex items-center gap-1 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em]">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`rounded-sm border px-2 py-1 font-black transition ${
                active
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-amber-700/40 hover:text-amber-300"
              }`}
            >
              {active ? `▶ ${item.label}` : item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function TickerCell({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading?: boolean }) {
  return (
    <div className="min-w-[120px] flex-1 px-3 py-2">
      <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className={`mt-0.5 truncate text-[14px] font-black tabular-nums leading-none ${loading ? "text-zinc-600" : "text-amber-400"}`}>
        {value}
      </div>
      {sub ? <div className="mt-0.5 truncate text-[8px] uppercase tracking-wide text-zinc-600">{sub}</div> : null}
    </div>
  );
}
