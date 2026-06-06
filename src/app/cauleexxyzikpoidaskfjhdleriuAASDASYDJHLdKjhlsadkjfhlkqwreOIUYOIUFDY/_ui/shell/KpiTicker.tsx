"use client";

// KPI 티커 — 상단바의 실시간 지표 띠. /api/admin/stats 30초 폴링(기존 admin-top-bar 로직 이전).
//   usePolling(숨김탭 pause) 사용. 가로 스크롤. 폰트 ≥12px.

import { usePolling } from "../hooks";
import { cn, FONT, INK, SURFACE } from "../tokens";
import { fmtKrwSign, fmtNum } from "../format";
import { useState } from "react";

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

export function KpiTicker() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  usePolling(
    async () => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        if (res.ok) setStats((await res.json()) as Stats);
      } catch {
        // silent — 다음 tick 재시도
      } finally {
        setLoading(false);
      }
    },
    30_000,
  );

  const ctr = stats && stats.revealsToday > 0 ? Math.round((stats.clicksToday / stats.revealsToday) * 100) : null;

  return (
    <div className={cn("flex items-stretch divide-x divide-zinc-900 overflow-x-auto", SURFACE.page)}>
      <Cell label="오늘 매출" value={stats ? fmtKrwSign(stats.revenueToday) : "—"} loading={loading} />
      <Cell label="이번 달 매출" value={stats ? fmtKrwSign(stats.revenueMonth) : "—"} loading={loading} />
      <Cell
        label="활성 구독"
        value={stats ? fmtNum(stats.activeSubs) : "—"}
        sub={stats ? `P${stats.totalPro}/PL${stats.totalPlus}/ST${stats.totalStarter}` : undefined}
        loading={loading}
      />
      <Cell label="전체 계정" value={stats ? fmtNum(stats.totalAccounts) : "—"} loading={loading} />
      <Cell label="오늘 가입" value={stats ? fmtNum(stats.newSignupsToday) : "—"} loading={loading} />
      <Cell label="상품 열람" value={stats ? fmtNum(stats.packOpensToday) : "—"} loading={loading} />
      <Cell label="상세 열람" value={stats ? fmtNum(stats.revealsToday) : "—"} loading={loading} />
      <Cell
        label="원문 클릭"
        value={stats ? fmtNum(stats.clicksToday) : "—"}
        sub={ctr != null ? `${ctr}%` : undefined}
        loading={loading}
      />
    </div>
  );
}

function Cell({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div className="min-w-[116px] flex-1 px-3 py-1.5">
      <div className={cn(FONT.meta, "font-bold", INK.muted)}>{label}</div>
      <div className={cn("mt-0.5 truncate font-black tabular-nums leading-tight", FONT.body, loading ? INK.faint : "text-blue-200")}>
        {value}
      </div>
      {sub ? <div className={cn("mt-0.5 truncate", FONT.meta, INK.faint)}>{sub}</div> : null}
    </div>
  );
}
