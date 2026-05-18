"use client";

// Wave 182 (2026-05-17): Saved Money Counter — 대시보드 상단 카운터.
// 사업 보고서 retention #1: loss aversion ×2.5. "안 잃은 돈"이 "번 돈"보다 retention factor 큼.
//
// 표시:
// - 이번 달 번 돈: 본인 'bought' 표시 매물의 차익 (최소값 보수)
// - 안 잃은 돈: 미뇨이가 차단한 위험 매물 × 평균 손해율 (사이트 전체, 보수적 추정)

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type SavedMoneyResponse = {
  earnedThisMonthKrw: number;
  savedThisMonthSiteWideKrw: number;
  blockedCountThisMonth: number;
  boughtCountThisMonth: number;
  compensationGrantedThisMonth: number;
  monthLabel: string;
  hints: {
    hasBought: boolean;
    boughtPrompt: string | null;
  };
};

function krw(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}만`;
  return value.toLocaleString("ko-KR");
}

export function SavedMoneyCounter() {
  const [data, setData] = useState<SavedMoneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) throw new Error("no_supabase");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("no_session");
        const res = await fetch("/api/packs/me/saved-money", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`status_${res.status}`);
        const json = (await res.json()) as SavedMoneyResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError("카운터를 불러오지 못했어요.");
        console.error("[saved-money-counter] failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <div className="h-20 animate-pulse rounded-xl bg-[#efe7d7] dark:bg-zinc-800" />
        <div className="h-20 animate-pulse rounded-xl bg-[#efe7d7] dark:bg-zinc-800" />
      </div>
    );
  }

  if (error || !data) {
    // 조용히 hide (대시보드 메인 UX 차단하지 않음).
    return null;
  }

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-emerald-400">
          💰 {data.monthLabel} 가치
        </span>
        {data.compensationGrantedThisMonth > 0 && (
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            신고 보상 토큰 +{data.compensationGrantedThisMonth}
          </span>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {/* 안 잃은 돈 (loss aversion ×2.5 — 더 sticky한 신호. 왼쪽 hero 위치). */}
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            🛡️ 안 잃은 돈 (추정)
          </div>
          <div className="mt-1 text-2xl font-black tabular-nums text-emerald-900 dark:text-emerald-100">
            ₩{krw(data.savedThisMonthSiteWideKrw)}원
          </div>
          <div className="mt-1 text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
            미뇨이가 차단한 위험 매물 <b>{data.blockedCountThisMonth.toLocaleString()}건</b> 기반 추정 (사이트 전체)
          </div>
        </div>

        {/* 번 돈 (본인 bought 신호). 없으면 안내. */}
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
            💎 이번 달 번 돈
          </div>
          <div className="mt-1 text-2xl font-black tabular-nums text-amber-900 dark:text-amber-100">
            +₩{krw(data.earnedThisMonthKrw)}원
          </div>
          <div className="mt-1 text-[10px] text-amber-700/80 dark:text-amber-300/80">
            {data.hints.hasBought
              ? `매수 표시 ${data.boughtCountThisMonth}건 기준 (예상 차익 최소값)`
              : data.hints.boughtPrompt || "매수 후 카드에 [매수했어요] 표시하면 자동 누적"}
          </div>
        </div>
      </div>
    </div>
  );
}
