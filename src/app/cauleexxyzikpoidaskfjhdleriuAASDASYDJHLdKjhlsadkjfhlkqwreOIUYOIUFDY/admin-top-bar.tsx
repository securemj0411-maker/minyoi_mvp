"use client";

// Wave launch-108 (2026-05-24): sticky admin top bar.
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
  { href: OPS_ADMIN_BASE_PATH, label: "운영 오버뷰", match: (p) => p === OPS_ADMIN_BASE_PATH },
  { href: OPS_ADMIN_POOL_PATH, label: "매물 풀", match: (p) => p.startsWith(OPS_ADMIN_POOL_PATH) },
  { href: OPS_ADMIN_LOSS_REPORTS_PATH, label: "손해 신고", match: (p) => p.startsWith(OPS_ADMIN_LOSS_REPORTS_PATH) },
  { href: OPS_ADMIN_FEEDBACK_STATS_PATH, label: "신고 통계", match: (p) => p.startsWith(OPS_ADMIN_FEEDBACK_STATS_PATH) },
  { href: OPS_ADMIN_REVEAL_ANALYTICS_PATH, label: "열람 통계", match: (p) => p.startsWith(OPS_ADMIN_REVEAL_ANALYTICS_PATH) },
  { href: OPS_ADMIN_DETAIL_EVENTS_PATH, label: "상세 이벤트", match: (p) => p.startsWith(OPS_ADMIN_DETAIL_EVENTS_PATH) },
];

function formatKstTime(): string {
  return new Intl.DateTimeFormat("ko-KR", {
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
    <div className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 text-zinc-200 backdrop-blur">
      {/* Row 1 — brand + session + main link */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-900 px-3 py-2 text-xs font-black">
        <div className="flex items-center gap-3">
          <span className="tracking-tight text-white">득템잡이 운영자</span>
          <span className="rounded-full bg-blue-500/12 px-2 py-0.5 text-[11px] text-blue-200">멤버십 운영</span>
          <span className="text-zinc-600">·</span>
          <span className="text-emerald-300">실시간</span>
        </div>
        <div className="flex items-center gap-3 text-zinc-500">
          <span className="tabular-nums">{now}</span>
          <Link
            href="/"
            className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 font-bold text-zinc-300 hover:border-blue-500/60 hover:text-blue-200"
          >
            사이트로 이동
          </Link>
        </div>
      </div>

      {/* Row 2 — KPI ticker (polling). 가로 scroll 가능. */}
      <div className="flex items-stretch divide-x divide-zinc-900 overflow-x-auto bg-zinc-950 text-[10px]">
        <TickerCell label="오늘 매출" value={stats ? `₩${stats.revenueToday.toLocaleString("ko-KR")}` : "—"} loading={statsLoading} />
        <TickerCell label="이번 달 매출" value={stats ? `₩${stats.revenueMonth.toLocaleString("ko-KR")}` : "—"} loading={statsLoading} />
        <TickerCell
          label="활성 구독"
          value={stats ? String(stats.activeSubs) : "—"}
          sub={stats ? `P${stats.totalPro}/PL${stats.totalPlus}/ST${stats.totalStarter}` : undefined}
          loading={statsLoading}
        />
        <TickerCell label="전체 계정" value={stats ? String(stats.totalAccounts) : "—"} loading={statsLoading} />
        <TickerCell label="오늘 가입" value={stats ? String(stats.newSignupsToday) : "—"} loading={statsLoading} />
        <TickerCell label="상품 열람" value={stats ? String(stats.packOpensToday) : "—"} loading={statsLoading} />
        <TickerCell label="상세 열람" value={stats ? String(stats.revealsToday) : "—"} loading={statsLoading} />
        <TickerCell
          label="원문 클릭"
          value={stats ? String(stats.clicksToday) : "—"}
          sub={stats && stats.revealsToday > 0 ? `${Math.round((stats.clicksToday / stats.revealsToday) * 100)}%` : undefined}
          loading={statsLoading}
        />
      </div>

      {/* Row 3 — nav (Link + active highlight). */}
      <nav className="flex items-center gap-1 overflow-x-auto px-3 py-2 text-xs font-black">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`shrink-0 rounded-full border px-3 py-1.5 transition ${
                active
                  ? "border-blue-400/40 bg-blue-500/14 text-blue-100"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-blue-500/40 hover:text-blue-200"
              }`}
            >
              {item.label}
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
      <div className="text-[11px] font-black text-zinc-500">{label}</div>
      <div className={`mt-0.5 truncate text-[14px] font-black tabular-nums leading-none ${loading ? "text-zinc-600" : "text-blue-200"}`}>
        {value}
      </div>
      {sub ? <div className="mt-0.5 truncate text-[10px] font-bold text-zinc-600">{sub}</div> : null}
    </div>
  );
}
