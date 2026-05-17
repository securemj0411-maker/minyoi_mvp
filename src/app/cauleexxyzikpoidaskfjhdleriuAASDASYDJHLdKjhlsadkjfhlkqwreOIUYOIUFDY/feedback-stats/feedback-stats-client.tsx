"use client";

// Wave 188: 운영자 신고 통계 client.

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type CategoryRow = {
  key: string;
  label: string;
  total: number;
  pending: number;
  resolved: number;
  dismissed: number;
};

type Stats = {
  total: number;
  totalTokens: number;
  byCategory: CategoryRow[];
  byStatus: { pending: number; resolved: number; dismissed: number };
  responseRate: number;
  resolveRate: number;
};

type TopPid = {
  pid: number;
  count: number;
  latestAt: string;
  categories: string[];
  statuses: string[];
  listing: {
    name: string | null;
    price: number | null;
    thumbnail_url: string | null;
  } | null;
};

type Resp = {
  allTime: Stats;
  thisMonth: Stats;
  thisWeek: Stats;
  topPids: TopPid[];
  sampleSize: number;
  categoryMeta: Array<{ key: string; label: string }>;
};

type Period = "thisWeek" | "thisMonth" | "allTime";

function krw(value: number | null) {
  if (value == null) return "—";
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

function relAge(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const h = (Date.now() - t) / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)}분 전`;
  if (h < 24) return `${h.toFixed(1)}시간 전`;
  return `${(h / 24).toFixed(1)}일 전`;
}

const CATEGORY_COLOR: Record<string, { bg: string; text: string; bar: string }> = {
  price: {
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-800 dark:text-rose-200",
    bar: "bg-rose-500/80 dark:bg-rose-500/70",
  },
  info: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-800 dark:text-amber-200",
    bar: "bg-amber-500/80 dark:bg-amber-500/70",
  },
  sold: {
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-700 dark:text-zinc-200",
    bar: "bg-zinc-400/80 dark:bg-zinc-500/70",
  },
  fake_price: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-800 dark:text-purple-200",
    bar: "bg-purple-500/80 dark:bg-purple-500/70",
  },
  other: {
    bg: "bg-sky-50 dark:bg-sky-950/30",
    text: "text-sky-800 dark:text-sky-200",
    bar: "bg-sky-500/80 dark:bg-sky-500/70",
  },
  unknown: {
    bg: "bg-zinc-50 dark:bg-zinc-900",
    text: "text-zinc-600 dark:text-zinc-300",
    bar: "bg-zinc-300/80 dark:bg-zinc-600/70",
  },
};

export default function FeedbackStatsClient() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("thisMonth");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inaccurate-stats?limit=5000", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`status_${res.status}`);
      const json = (await res.json()) as Resp;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  if (loading) {
    return <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">불러오는 중...</div>;
  }
  if (error || !data) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">에러: {error ?? "데이터 없음"}</div>;
  }

  const stats = period === "thisWeek" ? data.thisWeek : period === "thisMonth" ? data.thisMonth : data.allTime;
  const maxCategory = Math.max(1, ...stats.byCategory.map((c) => c.total));

  return (
    <div className="space-y-6">
      {/* 기간 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        {(["thisWeek", "thisMonth", "allTime"] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
              period === p
                ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)]"
                : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            }`}
          >
            {p === "thisWeek" ? "최근 7일" : p === "thisMonth" ? "이번 달" : "전체"}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-zinc-500 dark:text-zinc-400">
          sample {data.sampleSize}건 (최대 5,000건)
        </span>
      </div>

      {/* 총합 KPI 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="총 신고" value={stats.total} accent="amber" />
        <KpiCard label="✅ 보정 완료" value={stats.byStatus.resolved} accent="emerald" sub={`보정률 ${stats.resolveRate}%`} />
        <KpiCard label="⏳ 검토 대기" value={stats.byStatus.pending} accent="rose" sub={`응답률 ${stats.responseRate}%`} />
        <KpiCard label="🪙 토큰 지급" value={stats.totalTokens} accent="sky" />
      </div>

      {/* 카테고리별 분포 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-black text-zinc-900 dark:text-zinc-100">📊 카테고리별 분포</h2>
        {stats.byCategory.length === 0 ? (
          <div className="py-6 text-center text-sm text-zinc-500">아직 신고가 없어요.</div>
        ) : (
          <div className="space-y-2">
            {stats.byCategory.map((row) => {
              const color = CATEGORY_COLOR[row.key] ?? CATEGORY_COLOR.unknown;
              const width = Math.round((row.total / maxCategory) * 100);
              return (
                <div key={row.key} className={`rounded-lg ${color.bg} p-2.5`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-[12px] font-black ${color.text}`}>{row.label}</span>
                    <span className={`text-sm font-black tabular-nums ${color.text}`}>{row.total}건</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/60 dark:bg-zinc-900/40">
                    <div className={`h-full ${color.bar}`} style={{ width: `${width}%` }} />
                  </div>
                  <div className="mt-1 flex gap-3 text-[10px] text-zinc-600 dark:text-zinc-400">
                    <span>⏳ 대기 <b>{row.pending}</b></span>
                    <span>✅ 보정 <b>{row.resolved}</b></span>
                    <span>❌ 기각 <b>{row.dismissed}</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Top 자주 신고 받는 매물 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 text-sm font-black text-zinc-900 dark:text-zinc-100">🚨 자주 신고 받는 매물 (2회+)</h2>
        <p className="mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">
          여러 사용자가 같은 매물을 신고하면 systemic issue 가능성 — 시세/parser 보정 우선순위.
        </p>
        {data.topPids.length === 0 ? (
          <div className="py-6 text-center text-sm text-zinc-500">2회 이상 신고된 매물 없음.</div>
        ) : (
          <div className="space-y-2">
            {data.topPids.map((row) => (
              <article key={row.pid} className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  {row.listing?.thumbnail_url ? (
                    <Image src={row.listing.thumbnail_url} alt={row.listing.name ?? ""} fill sizes="56px" unoptimized className="object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="line-clamp-1 text-sm font-black text-zinc-900 dark:text-zinc-100">
                        {row.listing?.name ?? `pid ${row.pid}`}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span className="font-mono">pid {row.pid}</span>
                        {row.listing?.price != null && <> · 매입 {krw(row.listing.price)}</>}
                        <> · 최근 신고 {relAge(row.latestAt)}</>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-black text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
                      🚨 {row.count}회
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {row.categories.map((cat) => {
                      const meta = data.categoryMeta.find((c) => c.key === cat);
                      const color = CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.unknown;
                      return (
                        <span key={cat} className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${color.bg} ${color.text}`}>
                          {meta?.label ?? cat}
                        </span>
                      );
                    })}
                  </div>
                  <a
                    href={`https://m.bunjang.co.kr/products/${row.pid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-block text-[10px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    🔗 번장 열기
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="text-[10px] text-zinc-400">
        💡 카테고리는 사용자 신고 시 박힌 note prefix (`[라벨]`) 에서 추출.
        sample 5,000건 이상 누적되면 sliding window 검토 권장.
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent, sub }: { label: string; value: number; accent: "amber" | "emerald" | "rose" | "sky"; sub?: string }) {
  const styles: Record<typeof accent, string> = {
    amber: "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20",
    emerald: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20",
    rose: "border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20",
    sky: "border-sky-200 bg-sky-50/60 dark:border-sky-900/40 dark:bg-sky-950/20",
  };
  return (
    <div className={`rounded-xl border p-3 ${styles[accent]}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-black text-zinc-900 dark:text-zinc-100">{value.toLocaleString()}</div>
      {sub ? <div className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">{sub}</div> : null}
    </div>
  );
}
