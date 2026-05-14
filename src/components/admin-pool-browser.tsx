"use client";

// Wave 90 (2026-05-15): admin 전용 풀 매물 브라우저.
// 페이지네이션 (1, 2, 3, ...) + 카드 list + 시세 근거 디버그 토글.
// 운영자가 팩 결제 없이 풀 전체 검증 가능.

import { useCallback, useEffect, useState } from "react";
import { MarketSourceDebug } from "@/components/market-source-debug";

type PoolItem = {
  pid: number;
  name: string;
  price: number;
  skuId: string | null;
  skuName: string | null;
  skuMedian: number;
  thumbnailUrl: string | null;
  bunjangUrl: string;
  comparableKey: string | null;
  parseConfidence: number | null;
  needsReview: boolean;
  saleStatus: string | null;
  listingState: string | null;
  lastSeenAt: string | null;
  query: string | null;
  sellerUid: string | null;
  band: number;
  poolStatus: string;
  category: string | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  confidence: number;
  exposureCount: number;
  maxExposure: number;
  lastVerifiedAt: string;
};

type Resp = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: PoolItem[];
};

const krw = (v: number) => `₩${Math.round(v).toLocaleString("ko-KR")}`;

function relAge(iso: string | null) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const h = (Date.now() - t) / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)}분 전`;
  if (h < 24) return `${h.toFixed(1)}시간 전`;
  return `${(h / 24).toFixed(1)}일 전`;
}

const STATUS_OPTIONS = [
  { v: "ready", label: "ready (활성)" },
  { v: "invalidated", label: "invalidated (만료/소진)" },
  { v: "spent", label: "spent (사용자에게 노출됨)" },
];

const SORT_OPTIONS = [
  { v: "profit_high", label: "차익 높은순" },
  { v: "profit_low", label: "차익 낮은순" },
  { v: "confidence_high", label: "신뢰도 높은순" },
  { v: "latest", label: "최신 검증순" },
];

export default function AdminPoolBrowser() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [status, setStatus] = useState("ready");
  const [band, setBand] = useState<string>("");
  const [sort, setSort] = useState("profit_high");

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), status, sort });
      if (band) params.set("band", band);
      const res = await fetch(`/api/admin/pool-listings?${params}`, { credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as Resp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, band, sort]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  const totalPages = data?.totalPages ?? 1;
  const pageNumbers = (() => {
    const max = Math.min(totalPages, 10);
    const start = Math.max(1, Math.min(page - 4, totalPages - max + 1));
    return Array.from({ length: max }, (_, i) => start + i);
  })();

  return (
    <section className="space-y-4 px-4 py-6 lg:px-8 lg:py-8">
      <div className="rounded-2xl border border-[#e2d9cb] bg-[#fffaf6] p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-emerald-400">Admin · candidate_pool</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#223127] dark:text-white">운영자 풀 매물 검증</h1>
            <p className="mt-1 text-xs text-[#687366] dark:text-zinc-400">
              팩 결제 없이 candidate_pool 전체 매물 페이지네이션 조회. 카드별 시세 근거 디버그 가능.
            </p>
          </div>
          {data && (
            <div className="text-right text-xs text-zinc-500">
              총 {data.total.toLocaleString()}건 / {data.totalPages}페이지
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800">
            {STATUS_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <select value={band} onChange={(e) => { setBand(e.target.value); setPage(1); }} className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800">
            <option value="">band 전체</option>
            <option value="1">band 1</option>
            <option value="2">band 2</option>
            <option value="3">band 3</option>
          </select>
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="rounded-md border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800">
            {SORT_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <button onClick={fetchPage} disabled={loading} className="rounded-md border border-zinc-300 bg-white px-3 py-1 font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700">
            {loading ? "..." : "↻ 새로고침"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">에러: {error}</div>}

      {data && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {data.items.map((item) => (
              <article key={item.pid} className="rounded-lg border border-[#e3ddd2] bg-[#fffdf9] p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex gap-3">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnailUrl} alt="" className="h-[100px] w-[100px] shrink-0 rounded object-cover" />
                  ) : (
                    <div className="h-[100px] w-[100px] shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1 text-xs">
                    <div className="line-clamp-2 text-[13px] font-bold text-zinc-900 dark:text-zinc-100">{item.name}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                        +{krw(item.expectedProfitMin)}~{krw(item.expectedProfitMax)}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">band {item.band}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-2 text-zinc-700 dark:text-zinc-300">
                      <span>매입 {krw(item.price)}</span>
                      <span>· 시세 {krw(item.skuMedian)}</span>
                      <span>· 신뢰 {(item.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {item.skuName ?? "—"} · {item.poolStatus} · {relAge(item.lastVerifiedAt)} · 노출 {item.exposureCount}/{item.maxExposure}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      <span className="font-mono">{item.skuId ?? "—"}</span> · query: {item.query ?? "—"}
                    </div>
                    <a href={item.bunjangUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                      🔗 번장 열기
                    </a>
                  </div>
                </div>
                <div className="mt-2">
                  <MarketSourceDebug pid={item.pid} ourPrice={item.price} />
                </div>
              </article>
            ))}
            {data.items.length === 0 && (
              <div className="col-span-full rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                조건에 맞는 매물 없음
              </div>
            )}
          </div>

          {/* 페이지네이션 */}
          <div className="flex flex-wrap items-center justify-center gap-1 py-2">
            <button onClick={() => setPage(1)} disabled={page === 1 || loading} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800">«</button>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1 || loading} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800">‹</button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                disabled={loading}
                className={`rounded-md border px-3 py-1 text-xs font-semibold ${n === page ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"}`}
              >
                {n}
              </button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages || loading} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800">›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages || loading} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800">»</button>
          </div>
        </>
      )}
    </section>
  );
}
