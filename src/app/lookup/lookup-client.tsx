"use client";

// Wave 799 (2026-05-30): URL 시세 조회 client.
//   사용자 URL 입력 → /api/lookup/by-url POST → 결과 표시.
//   매물 정보 / 시세 / 예상 수익 / 비교매물 12개 / 시세그래프 14일.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type LookupResponse = {
  ok: boolean;
  creditInfo?: {
    charged: boolean;
    balance: number | null;
    lookupsUsed: number;
    lookupsPerCredit: number;
  };
  raw: {
    pid: number;
    source: string | null;
    url: string;
    name: string;
    price: number;
    sku_id: string | null;
    sku_name: string | null;
    thumbnail_url: string | null;
    shop_review_rating: number | null;
    shop_review_count: number | null;
    free_shipping: boolean | null;
    listing_state: string;
    sale_status: string;
    first_seen_at: string;
    daangn_region_name: string | null;
    description_preview: string | null;
    image_count: number | null;
  };
  comparableKey: string;
  conditionClass: string | null;
  category: string | null;
  marketBasis: {
    medianPrice: number | null;
    p25Price: number | null;
    p75Price: number | null;
    sampleCount: number;
    priceSource: string;
    confidence: string | null;
    label: string;
  };
  profit: { min: number; max: number; sellFee: number; resellShipping: number } | null;
  comparableListings: Array<{
    pid: number;
    name: string;
    url: string;
    price: number;
    source: string | null;
    thumbnail_url: string | null;
    listing_state: string;
    first_seen_at: string;
  }>;
  priceDaily: Array<{
    date: string;
    active_median_price: number | null;
    sold_median_price: number | null;
    blended_median_price: number | null;
    p25_price: number | null;
    p75_price: number | null;
    active_sample_count: number;
  }>;
};

type ErrorResponse = {
  error: string;
  message?: string;
  balance?: number | null;
  lookupsUsed?: number;
};

function krw(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function sourceLabel(src: string | null | undefined): string {
  if (!src) return "—";
  if (src.toLowerCase().includes("bunjang")) return "번개장터";
  if (src.toLowerCase().includes("joongna")) return "중고나라";
  if (src.toLowerCase().includes("daangn")) return "당근마켓";
  return src;
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const h = Math.floor(diff / 3600_000);
  if (h < 1) return "방금 전";
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function LookupClient() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<{ balance: number | null; message: string } | null>(null);
  const [authReady, setAuthReady] = useState<"loading" | "authed" | "guest">("loading");

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthReady("guest");
      return;
    }
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setAuthReady(data.user ? "authed" : "guest");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit() {
    if (!url.trim()) {
      setError("URL 을 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setPaywall(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
      const res = await fetch("/api/lookup/by-url", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as LookupResponse & ErrorResponse;
      if (!res.ok) {
        if (res.status === 402) {
          setPaywall({
            balance: data.balance ?? 0,
            message: data.message ?? "크레딧이 부족해요.",
          });
          return;
        }
        setError(data.message ?? "조회에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  const profitAvg = useMemo(() => {
    if (!result?.profit) return null;
    return Math.round((result.profit.min + result.profit.max) / 2);
  }, [result]);

  const profitPct = useMemo(() => {
    if (!result?.profit || !result.raw.price) return null;
    const pct = Math.round(((profitAvg ?? 0) / result.raw.price) * 100);
    return Number.isFinite(pct) ? pct : null;
  }, [profitAvg, result]);

  // 그래프 SVG path
  const chartSvg = useMemo(() => {
    if (!result || result.priceDaily.length < 2) return null;
    const points = result.priceDaily
      .map((d) => d.blended_median_price)
      .filter((p): p is number => p != null);
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = Math.max(1, max - min);
    const W = 320;
    const H = 80;
    const step = W / (points.length - 1);
    const path = points
      .map((p, i) => {
        const x = i * step;
        const y = H - ((p - min) / range) * H;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { path, W, H, min, max };
  }, [result]);

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-3 py-3 dark:bg-zinc-950 sm:px-5 sm:py-7">
      <div className="mx-auto w-full max-w-[560px]">
        {/* Header */}
        <section className="rounded-[18px] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[12px] font-bold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← 메인으로
          </Link>
          <h1 className="mt-2 text-[20px] font-black leading-tight tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-[22px]">
            시세 조회
          </h1>
          <p className="mt-1 break-keep text-[12.5px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
            번개장터·중고나라·당근마켓 URL 을 붙여넣으면 미뇨이가 시세 / 예상 수익 / 비교 매물 / 14일 시세 추이를 보여드려요.
          </p>
          <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#f5f9ff] px-3 py-2 text-[11px] font-bold text-[#3182f6] dark:bg-blue-950/24 dark:text-blue-300">
            <span>💎</span>
            <span>조회 1번 = 0.2크레딧 (5번 = 1크레딧 차감)</span>
          </div>
        </section>

        {/* Input */}
        <section className="mt-3 rounded-[16px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <label htmlFor="lookup-url" className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300">
            매물 URL
          </label>
          <input
            id="lookup-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://m.bunjang.co.kr/products/... 또는 www.daangn.com/kr/buy-sell/..."
            disabled={loading}
            className="mt-1.5 flex h-11 w-full items-center rounded-xl border border-zinc-200 bg-white px-3 text-[13px] text-zinc-950 placeholder:text-zinc-400 focus:border-[#3182f6] focus:outline-none focus:ring-2 focus:ring-[#3182f6]/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || authReady !== "authed"}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#3182f6] text-[14.5px] font-black text-white shadow-[0_10px_22px_rgba(49,130,246,0.28)] transition hover:bg-[#1c6fe8] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? "조회 중..." : "조회하기"}
          </button>
          {authReady === "guest" ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              로그인이 필요해요.{" "}
              <Link href="/login" className="underline">
                로그인하기
              </Link>
            </div>
          ) : null}
          {error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : null}
          {paywall ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
              <div className="text-[12.5px] font-black text-amber-900 dark:text-amber-100">
                💎 크레딧이 부족해요
              </div>
              <p className="mt-1 break-keep text-[11.5px] font-bold leading-4 text-amber-800 dark:text-amber-200">
                {paywall.message}
              </p>
              <div className="mt-1 text-[10.5px] font-bold text-amber-700 dark:text-amber-300">
                현재 잔액 {paywall.balance ?? 0}크레딧
              </div>
              <Link
                href="/plans"
                className="mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-amber-600 px-3 text-[11.5px] font-black text-white shadow-sm transition hover:bg-amber-700"
              >
                크레딧 충전하기 →
              </Link>
            </div>
          ) : null}
        </section>

        {/* Result */}
        {result ? (
          <>
            {/* 크레딧 사용 정보 */}
            {result.creditInfo ? (
              <section className="mt-3 rounded-[16px] border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10.5px] font-bold text-zinc-500 dark:text-zinc-400">
                      이번 조회
                    </div>
                    <div className={`mt-0.5 text-[13px] font-black ${result.creditInfo.charged ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {result.creditInfo.charged
                        ? `-1크레딧 차감 (5번 누적 완료)`
                        : `무료 (${result.creditInfo.lookupsUsed}/${result.creditInfo.lookupsPerCredit})`}
                    </div>
                  </div>
                  {result.creditInfo.balance != null ? (
                    <div className="text-right">
                      <div className="text-[10.5px] font-bold text-zinc-500 dark:text-zinc-400">잔액</div>
                      <div className="mt-0.5 text-[13px] font-black text-zinc-900 dark:text-zinc-100">
                        {result.creditInfo.balance}크레딧
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                      운영자 무한
                    </div>
                  )}
                </div>
                {!result.creditInfo.charged && result.creditInfo.lookupsUsed === result.creditInfo.lookupsPerCredit - 1 ? (
                  <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[10.5px] font-bold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    ⚠️ 다음 조회는 5번째 — 1크레딧이 차감돼요
                  </div>
                ) : null}
              </section>
            ) : null}

            {/* 매물 정보 */}
            <section className="mt-3 rounded-[16px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex gap-3">
                {result.raw.thumbnail_url ? (
                  <img
                    src={result.raw.thumbnail_url}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#ebf2ff] px-2 py-0.5 text-[10px] font-black text-[#3182f6] dark:bg-blue-950/40 dark:text-blue-300">
                      {sourceLabel(result.raw.source)}
                    </span>
                    {result.raw.daangn_region_name ? (
                      <span className="text-[10.5px] font-bold text-zinc-500">{result.raw.daangn_region_name}</span>
                    ) : null}
                    <span className="text-[10.5px] font-bold text-zinc-400">{timeAgo(result.raw.first_seen_at)}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 break-all text-[13px] font-bold leading-5 text-zinc-900 dark:text-zinc-100">
                    {result.raw.name}
                  </div>
                  {result.raw.sku_name ? (
                    <div className="mt-0.5 truncate text-[10.5px] font-bold text-zinc-500 dark:text-zinc-400">
                      {result.raw.sku_name}
                    </div>
                  ) : null}
                </div>
              </div>
              <a
                href={result.raw.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-[11.5px] font-black text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                원문 보기 →
              </a>
            </section>

            {/* 매입가 + 시세 + 예상 수익 */}
            <section className="mt-3 rounded-[16px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-[12px] font-black text-zinc-500 dark:text-zinc-400">숫자 요약</div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-950/50">
                  <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">매입가</div>
                  <div className="mt-0.5 text-[14.5px] font-black leading-tight text-zinc-900 dark:text-zinc-100 sm:text-[16px]">
                    {krw(result.raw.price)}
                  </div>
                </div>
                <div className="rounded-xl bg-[#f5f9ff] p-2.5 dark:bg-blue-950/24">
                  <div className="text-[10px] font-bold text-[#3182f6] dark:text-blue-300">중고 시세</div>
                  <div className="mt-0.5 text-[14.5px] font-black leading-tight text-zinc-900 dark:text-zinc-100 sm:text-[16px]">
                    {krw(result.marketBasis.medianPrice)}
                  </div>
                  <div className="mt-0.5 text-[9.5px] font-bold text-zinc-500">
                    표본 {result.marketBasis.sampleCount}건
                  </div>
                </div>
                <div className={`rounded-xl p-2.5 ${profitAvg && profitAvg > 0 ? "bg-emerald-50 dark:bg-emerald-950/24" : "bg-zinc-50 dark:bg-zinc-950/50"}`}>
                  <div className={`text-[10px] font-bold ${profitAvg && profitAvg > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                    예상 수익
                  </div>
                  <div className={`mt-0.5 text-[14.5px] font-black leading-tight sm:text-[16px] ${profitAvg && profitAvg > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-900 dark:text-zinc-100"}`}>
                    {profitAvg != null ? (profitAvg > 0 ? "+" : "") + krw(profitAvg) : "—"}
                  </div>
                  {profitPct != null ? (
                    <div className={`mt-0.5 text-[9.5px] font-bold ${profitPct > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}`}>
                      {profitPct > 0 ? "+" : ""}{profitPct}%
                    </div>
                  ) : null}
                </div>
              </div>
              {result.profit ? (
                <p className="mt-3 break-keep text-[11px] font-medium leading-4 text-zinc-500 dark:text-zinc-400">
                  수수료 {krw(result.profit.sellFee)} + 재배송 {krw(result.profit.resellShipping)} + 안전버퍼 5,000원 차감 후 순익이에요.
                </p>
              ) : null}
              {result.conditionClass ? (
                <p className="mt-1 text-[10.5px] font-bold text-zinc-400">
                  같은 상태 (등급 {result.conditionClass}) 매물끼리만 비교
                </p>
              ) : null}
            </section>

            {/* 시세 그래프 */}
            {chartSvg ? (
              <section className="mt-3 rounded-[16px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-[12px] font-black text-zinc-500 dark:text-zinc-400">14일 시세 추이</div>
                <div className="mt-2 flex items-end justify-between text-[10.5px] font-bold text-zinc-500">
                  <span>최저 {krw(chartSvg.min)}</span>
                  <span>최고 {krw(chartSvg.max)}</span>
                </div>
                <svg viewBox={`0 0 ${chartSvg.W} ${chartSvg.H}`} className="mt-2 w-full">
                  <path d={chartSvg.path} stroke="#3182f6" strokeWidth="2" fill="none" />
                </svg>
              </section>
            ) : null}

            {/* 비교 매물 */}
            {result.comparableListings.length > 0 ? (
              <section className="mt-3 rounded-[16px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-[12px] font-black text-zinc-500 dark:text-zinc-400">
                  비교 매물 {result.comparableListings.length}개{result.conditionClass ? ` · 같은 등급` : ""}
                </div>
                <div className="mt-3 space-y-2">
                  {result.comparableListings.map((c) => {
                    const pct = result.marketBasis.medianPrice
                      ? Math.round((c.price / result.marketBasis.medianPrice) * 100)
                      : null;
                    return (
                      <a
                        key={c.pid}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-white p-2 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-800"
                      >
                        {c.thumbnail_url ? (
                          <img src={c.thumbnail_url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded bg-zinc-100 dark:bg-zinc-800" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <span className="rounded-full bg-zinc-100 px-1.5 py-0 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              {sourceLabel(c.source)}
                            </span>
                            <span className="text-zinc-400">{timeAgo(c.first_seen_at)}</span>
                          </div>
                          <div className="mt-0.5 line-clamp-1 break-all text-[12px] font-bold text-zinc-900 dark:text-zinc-100">
                            {c.name}
                          </div>
                          <div className="mt-0.5 flex items-baseline gap-1.5">
                            <span className="text-[12.5px] font-black text-zinc-900 dark:text-zinc-100">
                              {krw(c.price)}
                            </span>
                            {pct != null ? (
                              <span className={`text-[10px] font-bold ${pct < 100 ? "text-emerald-600" : "text-zinc-500"}`}>
                                시세 {pct}%
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* marketBasis 신뢰도 */}
            {result.marketBasis.sampleCount < 3 ? (
              <section className="mt-3 rounded-[16px] border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <div className="text-[11.5px] font-bold leading-5 text-amber-800 dark:text-amber-200">
                  같은 등급 비교 매물이 {result.marketBasis.sampleCount}건뿐이라 시세 신뢰도가 낮아요. 참고용으로만 보세요.
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
