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
  conditionTier: string | null;
  conditionCluster: string | null;
  conditionConfidence: number | null;
  conditionChips: string[];
  conditionFlags: Record<string, unknown> | null;
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
    last_seen_at: string | null;
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
  velocity: {
    confidence: string | null;
    observedSoldSampleCount: number;
    activeSampleCount: number;
    sold24hCount: number;
    sold7dCount: number;
    medianHoursToSold: number | null;
    p25HoursToSold: number | null;
    p75HoursToSold: number | null;
  } | null;
  poolStatus: {
    status: string;
    invalidatedReason: string | null;
    score: number | null;
    registeredJustNow: boolean;
  } | null;
};

type ErrorResponse = {
  error: string;
  message?: string;
  balance?: number | null;
  lookupsUsed?: number;
  step?: string;
  detail?: string;
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

// Wave 802: condition tier 색상 + 라벨
function tierStyle(tier: string | null): { label: string; bg: string; text: string } | null {
  if (!tier) return null;
  const t = tier.toUpperCase();
  const styles: Record<string, { label: string; bg: string; text: string }> = {
    S: { label: "S급 (최상)", bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300" },
    A: { label: "A급 (양호)", bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300" },
    B: { label: "B급 (보통)", bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-700 dark:text-zinc-300" },
    C: { label: "C급 (사용감)", bg: "bg-amber-100 dark:bg-amber-950/40", text: "text-amber-800 dark:text-amber-300" },
    D: { label: "D급 (하자)", bg: "bg-rose-100 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300" },
  };
  return styles[t] ?? { label: tier, bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-700 dark:text-zinc-300" };
}

// Wave 802: condition_class 한글 라벨
function conditionClassLabel(cls: string | null): string {
  if (!cls) return "미분류";
  const map: Record<string, string> = {
    clean: "깨끗",
    mint: "민트",
    unopened: "미개봉",
    used: "사용감",
    damaged: "하자",
    unknown: "미분류",
  };
  return map[cls] ?? cls;
}

// Wave 802: 회전주기 사람 친화적 포맷
function formatHours(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return "—";
  if (hours < 24) return `${Math.round(hours)}시간`;
  const days = hours / 24;
  if (days < 14) return `${days.toFixed(1)}일`;
  return `${Math.round(days)}일`;
}

// Wave 802: pool status 한글 라벨
function poolStatusLabel(status: string): { label: string; tone: "good" | "warn" | "neutral" } {
  if (status === "ready") return { label: "추천 매물로 등록됨", tone: "good" };
  if (status === "invalidated") return { label: "추천 풀에 포함 안 됨", tone: "warn" };
  return { label: status, tone: "neutral" };
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
  const [progressStage, setProgressStage] = useState(0);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<{ balance: number | null; message: string } | null>(null);
  const [authReady, setAuthReady] = useState<"loading" | "authed" | "guest">("loading");

  // Wave 803j (2026-05-30): SSE 실제 step 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게.
  //   기존 가짜 setTimeout progress 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게.
  //   server step 박은 게 박은 게 박은 게 handleSubmit SSE 박은 게 박은 게 setProgressStage 박은 게 박은 게.
  //   loading 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게.
  useEffect(() => {
    if (!loading) {
      setProgressStage(0);
    }
  }, [loading]);

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

  // Wave 803j (2026-05-30): server step → progress percentage 매핑.
  //   가짜 setTimeout 대신 진짜 server step 기준 박음. 100% 도달 후 대기 X.
  function stepToStage(step: string): number {
    // 0=초기, 1-4 박은 게 진행도 박은 게 박은 게 박은 게. progressStage * 25 = % 박은 게.
    switch (step) {
      case "parse_body": return 1; // 25%
      case "daangn_redirect": return 1;
      case "fetch_raw_listing": return 1;
      case "fetch_parsed": return 2; // 50%
      case "fetch_market_stats": return 2;
      case "compute_market_basis": return 3; // 75%
      case "fetch_comparable_listings": return 3;
      case "fetch_price_daily": return 3;
      case "register_to_pool": return 4; // 95% (마지막)
      case "charge_credit": return 4;
      default: return 1;
    }
  }

  async function handleSubmit() {
    if (!url.trim()) {
      setError("URL 을 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setPaywall(null);
    setProgressStage(1);
    try {
      const supabase = getSupabaseBrowserClient();
      const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
      const res = await fetch("/api/lookup/by-url", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      const isStream = contentType.includes("text/event-stream") && res.body != null;

      if (!isStream) {
        // server SSE 미지원 (또는 rate-limit/auth 등 박은 게 JSON 박힘) → 기존 처리.
        const data = (await res.json().catch(() => ({}))) as LookupResponse & ErrorResponse;
        if (!res.ok) {
          if (res.status === 402) {
            setPaywall({ balance: data.balance ?? 0, message: data.message ?? "크레딧이 부족해요." });
            return;
          }
          const baseMsg = data.message ?? "조회에 실패했어요. 잠시 후 다시 시도해주세요.";
          const stepHint = data.step && res.status >= 500 ? ` [단계: ${data.step}]` : "";
          setError(baseMsg + stepHint);
          return;
        }
        setResult(data);
        return;
      }

      // SSE 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게.
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let doneStatus: number | null = null;
      let doneBody: (LookupResponse & ErrorResponse) | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게 \n\n 박은 게 박은 게 박은 게 박은 게 박은 게 박은 게.
        let sepIndex: number;
        while ((sepIndex = buffer.indexOf("\n\n")) >= 0) {
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          if (!rawEvent.trim() || rawEvent.startsWith(":")) continue; // heartbeat / comment 박은 게 박은 게.
          let eventName = "message";
          let dataLine = "";
          for (const line of rawEvent.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
          }
          if (!dataLine) continue;
          let payload: unknown = null;
          try { payload = JSON.parse(dataLine); } catch { continue; }
          if (eventName === "step") {
            const step = (payload as { step?: string }).step ?? "";
            setProgressStage(stepToStage(step));
          } else if (eventName === "done") {
            const done = payload as { status: number; body: LookupResponse & ErrorResponse };
            doneStatus = done.status;
            doneBody = done.body;
            setProgressStage(4);
          }
        }
      }

      if (doneStatus == null || doneBody == null) {
        setError("응답 처리에 실패했어요. 잠시 후 다시 시도해주세요.");
        return;
      }
      if (doneStatus !== 200) {
        if (doneStatus === 402) {
          setPaywall({ balance: doneBody.balance ?? 0, message: doneBody.message ?? "크레딧이 부족해요." });
          return;
        }
        const baseMsg = doneBody.message ?? "조회에 실패했어요. 잠시 후 다시 시도해주세요.";
        const stepHint = doneBody.step && doneStatus >= 500 ? ` [단계: ${doneBody.step}]` : "";
        setError(baseMsg + stepHint);
        return;
      }
      setResult(doneBody);
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
            매물 URL <span className="font-medium text-zinc-400">(공유 문구 그대로 붙여넣어도 OK)</span>
          </label>
          <textarea
            id="lookup-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://m.bunjang.co.kr/products/... · Check out this on Karrot ... https://www.daangn.com/articles/..."
            disabled={loading}
            rows={2}
            className="mt-1.5 block w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] leading-5 text-zinc-950 placeholder:text-zinc-400 focus:border-[#3182f6] focus:outline-none focus:ring-2 focus:ring-[#3182f6]/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || authReady !== "authed"}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#3182f6] text-[14.5px] font-black text-white shadow-[0_10px_22px_rgba(49,130,246,0.28)] transition hover:bg-[#1c6fe8] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? "조회 중..." : "조회하기"}
          </button>

          {/* Wave 799d: 진행 단계 표시 */}
          {loading ? (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/24">
              {/* progress bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950/60">
                <div
                  className="h-full rounded-full bg-[#3182f6] transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(100, progressStage * 25)}%` }}
                />
              </div>
              {/* stage list */}
              <ul className="mt-2.5 space-y-1.5">
                {[
                  { n: 1, label: "URL 분석 + 매물 ID 추출" },
                  { n: 2, label: "미뇨이 DB 에서 매물 검색" },
                  { n: 3, label: "비교 매물 + 14일 시세 그래프 모으는 중" },
                  { n: 4, label: "결과 정리 + 표시" },
                ].map((s) => {
                  const done = progressStage > s.n;
                  const active = progressStage === s.n;
                  return (
                    <li key={s.n} className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                          done
                            ? "bg-emerald-500 text-white"
                            : active
                              ? "bg-[#3182f6] text-white animate-pulse"
                              : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
                        }`}
                      >
                        {done ? "✓" : s.n}
                      </span>
                      <span
                        className={`text-[11.5px] font-bold leading-4 ${
                          done
                            ? "text-zinc-400 line-through"
                            : active
                              ? "text-[#3182f6] dark:text-blue-300"
                              : "text-zinc-500 dark:text-zinc-500"
                        }`}
                      >
                        {s.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
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
                    시세 계산 표본 {result.marketBasis.sampleCount}건
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
            </section>

            {/* Wave 802: 상품 상태 (등급/조건/chip) */}
            <section className="mt-3 rounded-[16px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-[12px] font-black text-zinc-500 dark:text-zinc-400">상품 상태</div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {result.conditionTier ? (
                  (() => {
                    const s = tierStyle(result.conditionTier);
                    return s ? (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${s.bg} ${s.text}`}>
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/70 text-[9px] font-black dark:bg-zinc-900/60">
                          {result.conditionTier.toUpperCase()}
                        </span>
                        {s.label}
                      </span>
                    ) : null;
                  })()
                ) : null}
                {result.conditionClass ? (
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {conditionClassLabel(result.conditionClass)}
                  </span>
                ) : null}
                {result.conditionConfidence != null ? (
                  <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500">
                    상태 분석 신뢰도 {Math.round(result.conditionConfidence * 100)}%
                  </span>
                ) : null}
              </div>
              {result.conditionChips && result.conditionChips.length > 0 ? (
                <div className="mt-2.5">
                  <div className="text-[10.5px] font-bold text-zinc-500 dark:text-zinc-500">분석 시그널</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {result.conditionChips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-md bg-blue-50 px-2 py-0.5 text-[10.5px] font-bold text-[#3182f6] dark:bg-blue-950/30 dark:text-blue-300"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {result.conditionFlags && Object.values(result.conditionFlags).some(Boolean) ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(result.conditionFlags)
                    .filter(([, v]) => Boolean(v))
                    .map(([k]) => (
                      <span key={k} className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                        ⚑ {k}
                      </span>
                    ))}
                </div>
              ) : null}
              <p className="mt-2.5 text-[10.5px] font-medium leading-4 text-zinc-400 dark:text-zinc-500">
                비교 매물은 같은 등급·같은 상태로만 골라요 (가격 비교 정확도 ↑).
              </p>
            </section>

            {/* Wave 802: 시세 회전주기 (얼마 만에 팔리는지) */}
            {result.velocity ? (
              <section className="mt-3 rounded-[16px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-black text-zinc-500 dark:text-zinc-400">시세 회전주기</div>
                  {result.velocity.confidence ? (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {result.velocity.confidence}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-emerald-50 p-2.5 dark:bg-emerald-950/24">
                    <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">24시간 내 판매</div>
                    <div className="mt-0.5 text-[15px] font-black text-emerald-800 dark:text-emerald-200">{result.velocity.sold24hCount}건</div>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-2.5 dark:bg-blue-950/24">
                    <div className="text-[10px] font-bold text-[#3182f6] dark:text-blue-300">7일 내 판매</div>
                    <div className="mt-0.5 text-[15px] font-black text-zinc-900 dark:text-zinc-100">{result.velocity.sold7dCount}건</div>
                  </div>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-950/50">
                    <div className="text-[10px] font-bold text-zinc-500">중앙값</div>
                    <div className="mt-0.5 text-[12px] font-black text-zinc-900 dark:text-zinc-100">{formatHours(result.velocity.medianHoursToSold)}</div>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-950/50">
                    <div className="text-[10px] font-bold text-zinc-500">빠른 25%</div>
                    <div className="mt-0.5 text-[12px] font-black text-zinc-900 dark:text-zinc-100">{formatHours(result.velocity.p25HoursToSold)}</div>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-950/50">
                    <div className="text-[10px] font-bold text-zinc-500">느린 25%</div>
                    <div className="mt-0.5 text-[12px] font-black text-zinc-900 dark:text-zinc-100">{formatHours(result.velocity.p75HoursToSold)}</div>
                  </div>
                </div>
                <p className="mt-2 text-[10.5px] font-medium leading-4 text-zinc-400 dark:text-zinc-500">
                  같은 등급 매물 기준으로 등록 → 판매까지 평균 얼마 걸리는지에요.
                </p>
              </section>
            ) : null}

            {/* Wave 802: pool status (추천 풀 등록 여부) */}
            {result.poolStatus ? (
              (() => {
                const s = poolStatusLabel(result.poolStatus.status);
                const toneClass =
                  s.tone === "good"
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/24"
                    : s.tone === "warn"
                      ? "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/24"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
                const titleClass =
                  s.tone === "good" ? "text-emerald-800 dark:text-emerald-200"
                    : s.tone === "warn" ? "text-amber-800 dark:text-amber-200"
                      : "text-zinc-700 dark:text-zinc-300";
                return (
                  <section className={`mt-3 rounded-[16px] border p-3 ${toneClass}`}>
                    <div className={`text-[12.5px] font-black ${titleClass}`}>
                      {result.poolStatus.registeredJustNow ? "✓ 추천 풀에 방금 등록됐어요" : s.label}
                    </div>
                    {result.poolStatus.invalidatedReason ? (
                      <p className="mt-1 break-keep text-[10.5px] font-bold leading-4 text-amber-700 dark:text-amber-300">
                        사유: <span className="font-mono">{result.poolStatus.invalidatedReason}</span>
                      </p>
                    ) : null}
                    {result.poolStatus.registeredJustNow ? (
                      <p className="mt-1 break-keep text-[10.5px] font-medium leading-4 text-emerald-700 dark:text-emerald-300">
                        다른 회원도 추천 피드에서 이 매물을 볼 수 있어요.
                      </p>
                    ) : null}
                  </section>
                );
              })()
            ) : null}

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
                  비교 매물 {result.comparableListings.length}개{result.conditionClass ? ` · 같은 등급` : ""} · 가격 높은 순
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
                            {/* Wave 806: last_seen 1일 이상이면 stale 경고 (sweep cron 지연 인지) */}
                            {c.last_seen_at && Date.now() - new Date(c.last_seen_at).getTime() > 24 * 60 * 60 * 1000 ? (
                              <span className="rounded bg-amber-50 px-1.5 py-0 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                {Math.floor((Date.now() - new Date(c.last_seen_at).getTime()) / (24 * 60 * 60 * 1000))}일 전 확인
                              </span>
                            ) : null}
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
                  시세 계산에 쓴 표본이 {result.marketBasis.sampleCount}건뿐이라 시세 신뢰도가 낮아요. (비교 매물 12개는 display 만 — 일부는 가격 outlier 라 시세 계산에서 제외됨) 참고용으로만 보세요.
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
