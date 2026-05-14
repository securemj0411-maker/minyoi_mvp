"use client";

// Wave 90 (2026-05-15): 시세 근거 디버그 패널.
// pack-reveal-modal 안에 토글 가능한 인라인 섹션. 사용자가 매물 검증 시
// "이 시세가 어떤 매물 기준인지" 확인 가능하게 한다.

import { useCallback, useState } from "react";

type Comparable = {
  pid: number;
  name: string;
  price: number;
  thumbnailUrl: string | null;
  saleStatus: string | null;
  listingState: string | null;
  lastSeenAt: string | null;
  sourceQuery: string | null;
  bunjangUrl: string;
};

type MarketSourceResponse = {
  ourListing: {
    pid: number;
    name: string;
    price: number;
    skuId: string | null;
    skuName: string | null;
    skuMedian: number;
    comparableKey: string | null;
    parseConfidence: number | null;
    needsReview: boolean;
    thumbnailUrl: string | null;
    bunjangUrl: string;
  };
  marketDailyStats: {
    blendedMedian: number | null;
    activeMedian: number | null;
    p25: number | null;
    p75: number | null;
    activeCount: number | null;
    soldCount: number | null;
    disappearedCount: number | null;
    confidence: string | null;
    computedAt: string | null;
  } | null;
  comparableSource: "comparable_key" | "sku_id" | "none";
  comparables: Comparable[];
  liveStats: {
    activeCount: number;
    min: number;
    p25: number;
    median: number;
    p75: number;
    max: number;
    mean: number;
  } | null;
};

const krw = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `₩${Math.round(v).toLocaleString("ko-KR")}`;

function relativeAge(iso: string | null) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const h = (Date.now() - t) / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)}분 전`;
  if (h < 24) return `${h.toFixed(1)}시간 전`;
  return `${(h / 24).toFixed(1)}일 전`;
}

function saleStatusLabel(s: string | null) {
  if (!s) return "—";
  const u = s.toUpperCase();
  if (["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE", "0"].includes(u)) return "판매중";
  if (u === "SOLD" || u === "1") return "판매완료";
  if (u === "RESERVED") return "예약중";
  return s;
}

export function MarketSourceDebug({ pid, ourPrice }: { pid: number; ourPrice: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MarketSourceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${pid}/market-source`, {
        method: "GET",
        credentials: "include",
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        const errPayload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errPayload?.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as MarketSourceResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch 실패");
    } finally {
      setLoading(false);
    }
  }, [pid]);

  const handleToggle = useCallback(() => {
    if (!open && !data && !loading) void fetchData();
    setOpen((v) => !v);
  }, [open, data, loading, fetchData]);

  const sorted = data?.comparables ? [...data.comparables].sort((a, b) => a.price - b.price) : [];

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-200"
      >
        <span>📊 시세 근거 보기 (디버그){data ? ` · ${data.comparables.length}개` : ""}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-zinc-200 px-3 py-3 text-xs dark:border-zinc-800">
          {loading && <div className="text-zinc-500">불러오는 중...</div>}
          {error && <div className="text-rose-600 dark:text-rose-400">에러: {error}</div>}
          {data && (
            <>
              {/* SKU + comparable_key */}
              <div className="space-y-1 rounded-md bg-white p-2 dark:bg-zinc-900">
                <div>
                  <span className="text-zinc-500">SKU:</span>{" "}
                  <span className="font-mono">{data.ourListing.skuId ?? "—"}</span>{" "}
                  <span className="text-zinc-500">({data.ourListing.skuName ?? "—"})</span>
                </div>
                <div>
                  <span className="text-zinc-500">comparable_key:</span>{" "}
                  <span className="font-mono break-all">{data.ourListing.comparableKey ?? "—"}</span>
                </div>
                <div>
                  <span className="text-zinc-500">parse confidence:</span>{" "}
                  {data.ourListing.parseConfidence != null
                    ? `${(data.ourListing.parseConfidence * 100).toFixed(0)}%`
                    : "—"}{" "}
                  {data.ourListing.needsReview && (
                    <span className="ml-1 rounded bg-amber-100 px-1 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      needs_review
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-zinc-500">기록된 시세 (sku_median):</span> {krw(data.ourListing.skuMedian)}
                </div>
              </div>

              {/* daily stats */}
              {data.marketDailyStats && (
                <div className="rounded-md bg-white p-2 dark:bg-zinc-900">
                  <div className="mb-1 font-semibold text-zinc-700 dark:text-zinc-200">
                    📅 market_price_daily (집계 시점)
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div>blended median: {krw(data.marketDailyStats.blendedMedian as number | null)}</div>
                    <div>active median: {krw(data.marketDailyStats.activeMedian as number | null)}</div>
                    <div>p25: {krw(data.marketDailyStats.p25 as number | null)}</div>
                    <div>p75: {krw(data.marketDailyStats.p75 as number | null)}</div>
                    <div>active: {data.marketDailyStats.activeCount ?? "—"}건</div>
                    <div>sold: {data.marketDailyStats.soldCount ?? "—"}건</div>
                    <div>disappeared: {data.marketDailyStats.disappearedCount ?? "—"}건</div>
                    <div>confidence: {String(data.marketDailyStats.confidence ?? "—")}</div>
                  </div>
                  {data.marketDailyStats.computedAt && (
                    <div className="mt-1 text-zinc-500">
                      computed: {new Date(data.marketDailyStats.computedAt as string).toLocaleString("ko-KR")}
                    </div>
                  )}
                </div>
              )}

              {/* live stats (실시간 fetch 매물 기준) */}
              {data.liveStats && (
                <div className="rounded-md bg-white p-2 dark:bg-zinc-900">
                  <div className="mb-1 font-semibold text-zinc-700 dark:text-zinc-200">
                    ⚡ 실시간 통계 (현재 DB active {data.liveStats.activeCount}건)
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div>min: {krw(data.liveStats.min)}</div>
                    <div>max: {krw(data.liveStats.max)}</div>
                    <div>p25: {krw(data.liveStats.p25)}</div>
                    <div>p75: {krw(data.liveStats.p75)}</div>
                    <div className="font-semibold">median: {krw(data.liveStats.median)}</div>
                    <div>mean: {krw(data.liveStats.mean)}</div>
                  </div>
                </div>
              )}

              {/* comparable list */}
              <div>
                <div className="mb-2 font-semibold text-zinc-700 dark:text-zinc-200">
                  📋 비교 매물 {data.comparables.length}건 · 출처 = {data.comparableSource}
                  <span className="ml-2 font-normal text-zinc-500">(가격 낮은 순)</span>
                </div>
                <div className="space-y-1">
                  {sorted.map((c) => {
                    const isCheaper = c.price < ourPrice;
                    return (
                      <a
                        key={c.pid}
                        href={c.bunjangUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                          c.listingState !== "active"
                            ? "border-zinc-200 bg-zinc-50/50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/30"
                            : isCheaper
                            ? "border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20"
                            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                        }`}
                      >
                        {c.thumbnailUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.thumbnailUrl.replace("{res}", "200")}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-zinc-800 dark:text-zinc-100">{c.name}</div>
                          <div className="flex gap-2 text-zinc-500">
                            <span>{saleStatusLabel(c.saleStatus)}</span>
                            <span>· {relativeAge(c.lastSeenAt)}</span>
                            {c.sourceQuery && <span>· {c.sourceQuery.slice(0, 24)}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${isCheaper ? "text-rose-600 dark:text-rose-300" : "text-zinc-800 dark:text-zinc-100"}`}>
                            {krw(c.price)}
                          </div>
                          {isCheaper && <div className="text-[10px] text-rose-500">우리보다 -{krw(ourPrice - c.price)}</div>}
                        </div>
                      </a>
                    );
                  })}
                  {sorted.length === 0 && (
                    <div className="text-zinc-500">비교 매물 없음. comparable_key 매핑 또는 parser 점검 필요.</div>
                  )}
                </div>
              </div>

              {/* 우리 매물 직접 링크 */}
              <a
                href={data.ourListing.bunjangUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-center text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
              >
                🔗 우리 매물 번장에서 열기 (pid {data.ourListing.pid})
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
