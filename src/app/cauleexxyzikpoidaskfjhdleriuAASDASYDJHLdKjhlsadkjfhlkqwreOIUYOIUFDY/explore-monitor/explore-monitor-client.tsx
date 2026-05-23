"use client";

import { useCallback, useEffect, useState } from "react";

// Wave 340: /explore 운영자 모니터링 페이지.
// 매물 풀 상태 + 사용자 활동 + 카테고리/profit_band 분포 시각화.

type MonitorData = {
  poolStatus: {
    readyTotal: number;
    readyEligible: number;
    readyFresh: number;
    invalidatedToday: number;
    spentToday: number;
  };
  userActivity: {
    browseUsersToday: number;
  };
  categoryDistribution: { category: string; count: number }[];
  bandDistribution: Record<string, number>;
  freshLagHours: number;
  generatedAt: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  earphone: "이어폰",
  smartwatch: "스마트워치",
  smartphone: "스마트폰",
  tablet: "태블릿",
  laptop: "노트북",
  monitor: "모니터",
  speaker: "스피커",
  camera: "카메라",
  game_console: "게임기",
  desktop: "데스크탑",
  home_appliance: "가전",
  watch: "시계",
  shoe: "신발",
  bag: "가방",
  bike: "자전거",
  drone: "드론",
  perfume: "향수",
  kickboard: "킥보드",
  lego: "레고",
  clothing: "의류",
  sport_golf: "골프",
  unknown: "(분류 없음)",
};

export default function ExploreMonitorClient() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/explore-monitor", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "load failed");
      setData(json as MonitorData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">/explore 운영자 모니터</h1>
          <p className="mt-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            매물 풀 상태 + 사용자 활동 + 카테고리 분포
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "로딩..." : "새로고침"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          {/* 매물 풀 상태 */}
          <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">매물 풀 상태</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Ready 총합" value={data.poolStatus.readyTotal} tone="info" />
              <Stat label={`6h+ (무료)`} value={data.poolStatus.readyEligible} tone="good" sub="무료 사용자가 보는 풀" />
              <Stat label="6h 미만 (구독자)" value={data.poolStatus.readyFresh} tone="info" sub="Phase 2 결제 영역" />
              <Stat label="오늘 잡힘 (invalidated)" value={data.poolStatus.invalidatedToday} tone="rose" />
              <Stat label="오늘 spent" value={data.poolStatus.spentToday} tone="zinc" />
            </div>
            <div className="mt-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
              6h 임계 = 무료/구독자 차등. 6h+ 비율이 너무 낮으면 무료 사용자 체험 약함.
            </div>
          </section>

          {/* 사용자 활동 */}
          <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">사용자 활동 (오늘)</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label="오늘 /explore refresh한 사용자" value={data.userActivity.browseUsersToday} tone="emerald" />
            </div>
          </section>

          {/* 카테고리 분포 */}
          <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">카테고리 분포 (ready 풀)</h2>
            <div className="mt-3 space-y-1.5">
              {data.categoryDistribution.map((row) => {
                const total = data.categoryDistribution.reduce((s, r) => s + r.count, 0);
                const pct = total > 0 ? (row.count / total) * 100 : 0;
                return (
                  <div key={row.category} className="flex items-center gap-3">
                    <div className="w-24 shrink-0 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {CATEGORY_LABEL[row.category] ?? row.category}
                    </div>
                    <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="absolute inset-y-0 left-0 bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-16 shrink-0 text-right text-xs font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {row.count.toLocaleString("ko-KR")}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* profit_band 분포 */}
          <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">차익 등급 (profit_band) 분포</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="3등급 (7만+)" value={data.bandDistribution["3"] ?? 0} tone="emerald" />
              <Stat label="2등급 (4~6만)" value={data.bandDistribution["2"] ?? 0} tone="info" />
              <Stat label="1등급 (2~3만)" value={data.bandDistribution["1"] ?? 0} tone="zinc" />
              <Stat label="등급 없음" value={data.bandDistribution["null"] ?? 0} tone="rose" />
            </div>
          </section>

          <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
            생성: {data.generatedAt}
          </div>
        </>
      ) : null}
    </main>
  );
}

function Stat({ label, value, sub, tone }: {
  label: string;
  value: number;
  sub?: string;
  tone?: "good" | "info" | "emerald" | "rose" | "zinc";
}) {
  const valueColor = tone === "good" || tone === "emerald"
    ? "text-emerald-600 dark:text-blue-300"
    : tone === "rose"
      ? "text-rose-600 dark:text-rose-300"
      : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${valueColor}`}>
        {value.toLocaleString("ko-KR")}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
          {sub}
        </div>
      ) : null}
    </div>
  );
}
