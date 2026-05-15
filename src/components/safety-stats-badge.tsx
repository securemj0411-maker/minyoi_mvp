"use client";

// Wave 129 (2026-05-16): 위험 매물 차단 카운터 badge — 사업 보고서 L4.
// "이번 주 위험 매물 X건 차단" retention killer ("내 50만원 잃을 뻔한 거 막아줬다" 감정).
// /api/public/safety-stats 데이터 fetch + 추천 페이지 상단에 표시.

import { useEffect, useState } from "react";

type SafetyStats = {
  total_blocked_7d: number;
  price_dummy_7d: number;
  fake_or_lock_7d: number;
  carrier_mismatch_7d: number;
  pool_invalidated_7d: number;
};

export default function SafetyStatsBadge() {
  const [stats, setStats] = useState<SafetyStats | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/public/safety-stats", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { stats: SafetyStats };
        setStats(json.stats);
      } catch {
        // silent — 없으면 표시 X
      }
    })();
  }, []);

  if (!stats || stats.total_blocked_7d === 0) return null;

  const total = stats.total_blocked_7d;
  return (
    <div className="mb-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
      <button
        type="button"
        onClick={() => setShowDetail((s) => !s)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
            🛡️ 회원님 보호
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">
              {total.toLocaleString("ko-KR")}건
            </span>
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300/80">
              위험 매물 이번 주 차단
            </span>
          </div>
        </div>
        <span className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-black text-white">
          {showDetail ? "접기" : "상세"}
        </span>
      </button>
      {showDetail && (
        <div className="mt-3 grid gap-2 border-t border-emerald-200 pt-3 text-[11px] dark:border-emerald-900">
          {stats.fake_or_lock_7d > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-emerald-800 dark:text-emerald-300/90">🚫 가품/잠금/분실폰</span>
              <span className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {stats.fake_or_lock_7d.toLocaleString("ko-KR")}건
              </span>
            </div>
          )}
          {stats.carrier_mismatch_7d > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-emerald-800 dark:text-emerald-300/90">📞 통신사 약정/할부 잔여</span>
              <span className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {stats.carrier_mismatch_7d.toLocaleString("ko-KR")}건
              </span>
            </div>
          )}
          {stats.price_dummy_7d > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-emerald-800 dark:text-emerald-300/90">💰 비현실 가격 (셀러 거부 표시)</span>
              <span className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {stats.price_dummy_7d.toLocaleString("ko-KR")}건
              </span>
            </div>
          )}
          {stats.pool_invalidated_7d > 0 && (
            <div className="flex justify-between gap-2">
              <span className="text-emerald-800 dark:text-emerald-300/90">📉 시세 부적합/만료 매물</span>
              <span className="font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {stats.pool_invalidated_7d.toLocaleString("ko-KR")}건
              </span>
            </div>
          )}
          <div className="mt-1 text-[10px] text-emerald-700/70 dark:text-emerald-400/70">
            가품, 잠금, 통신사 약정, 셀러 거래 거부 매물을 사전 차단했습니다.
          </div>
        </div>
      )}
    </div>
  );
}
