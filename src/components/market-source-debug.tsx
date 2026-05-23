"use client";

// Wave 90 (2026-05-15): 시세 근거 디버그 패널.
// open 시 화면 가운데 큰 modal-style overlay (max-w-3xl).
// 상단: 검토 중인 매물 prominent 카드 / 본문: 시세/comparable / 하단 sticky: 코멘트 입력.
// 코멘트는 mvp_reveal_feedback.note에 watching 타입으로 upsert.

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { DanawaLogo, MarketplaceSourceBadge } from "@/components/market-brand-logo";
import { ConditionTierChip, ConditionChipsList } from "@/components/condition-chip";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { userRefForAuthUser } from "@/lib/user-ref";

type Comparable = {
  pid: number;
  name: string;
  price: number;
  thumbnailUrl: string | null;
  saleStatus: string | null;
  listingState: string | null;
  lastSeenAt: string | null;
  sourceQuery: string | null;
  marketplaceSource: string;
  marketplaceLabel: string;
  listingUrl: string;
  bunjangUrl: string;
  // Wave 714d (2026-05-23): 신발/의류 5-tier grading + chips.
  conditionTier?: string | null;
  conditionCluster?: string | null;
  conditionConfidence?: number | null;
  conditionFlags?: Record<string, unknown> | null;
  conditionChips?: string[] | null;
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
    conditionClass: string | null;
    // Wave 714d (2026-05-23): 신발/의류 5-tier grading + chips.
    conditionTier?: string | null;
    conditionCluster?: string | null;
    conditionConfidence?: number | null;
    conditionFlags?: Record<string, unknown> | null;
    conditionChips?: string[] | null;
    displayMarketPrice: number | null;
    marketPriceSource: "reference" | "market";
    marketPriceLabel: string;
    marketConditionLabel: string | null;
    // Wave 251.4 (2026-05-19): 비교군 product_type 필터 투명성.
    productType?: string | null;
    parseConfidence: number | null;
    needsReview: boolean;
    thumbnailUrl: string | null;
    marketplaceSource: string;
    marketplaceLabel: string;
    listingUrl: string;
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

function MarketSourceDebugSkeleton() {
  const line = (className: string) => <div className={`rounded-full bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
  return (
    <div className="animate-pulse space-y-3" aria-busy="true">
      <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <div className="flex gap-3">
          <div className="h-24 w-24 shrink-0 rounded-lg bg-emerald-100 dark:bg-emerald-900/50" />
          <div className="min-w-0 flex-1 space-y-2">
            {line("h-3 w-32 bg-emerald-100 dark:bg-emerald-900/50")}
            {line("h-4 w-4/5")}
            {line("h-5 w-56")}
            {line("h-3 w-44")}
            {line("h-3 w-64 max-w-full")}
          </div>
        </div>
      </div>
      <div className="rounded-md bg-zinc-50 px-2 py-2 dark:bg-zinc-800/50">
        <div className="flex flex-wrap gap-2">
          {line("h-3 w-20")}
          {line("h-3 w-28")}
          {line("h-3 w-32")}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-white p-3 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          {line("h-3 w-40")}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="h-3 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        </div>
        <div className="rounded-md bg-white p-3 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          {line("h-3 w-36")}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-3 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        {line("h-3 w-72 max-w-full")}
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-10 w-10 shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="min-w-0 flex-1 space-y-1.5">
              {line("h-3 w-4/5")}
              {line("h-3 w-2/3")}
            </div>
            {line("h-4 w-16")}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketSourceDebug({
  pid,
  ourPrice,
  initialNote,
  onCommentSaved,
}: {
  pid: number;
  ourPrice: number;
  initialNote?: string;
  onCommentSaved?: (pid: number, note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MarketSourceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRef, setUserRef] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [note, setNote] = useState(initialNote ?? "");
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);
  // Wave 90: drag select 시 모달 닫히는 버그 방지 — backdrop에서 mousedown 시작한 경우에만 close
  const mouseDownOnBackdropRef = useRef(false);

  // user fetch 한 번 (코멘트 저장에 user_ref 필요)
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
      const user = data.session?.user;
      if (user) setUserRef(userRefForAuthUser(user.id));
    });
  }, []);

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

  // 기존 코멘트 prefetch — 같은 pid에 대해 이미 저장된 메모가 있으면 채워줌
  useEffect(() => {
    if (!open || !userRef) return;
    void fetch(`/api/packs/me?page=1&pageSize=1`, {
      credentials: "include",
      headers: { "x-user-ref": userRef },
    }).catch(() => undefined);
    // 단순화: 별도 endpoint 없어서 prefetch 생략. 사용자가 입력한 후 저장 시 upsert.
  }, [open, userRef]);

  // Wave 104: Esc 닫기 + body scroll lock (다른 모달과 일관성).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleToggle = useCallback(() => {
    if (!open && !data && !loading) void fetchData();
    setOpen((v) => !v);
  }, [open, data, loading, fetchData]);

  const handleSaveNote = useCallback(async () => {
    if (!userRef || !accessToken || !note.trim()) return;
    setNoteLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/packs/reveals/feedback", {
        method: "POST",
        credentials: "include",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          "x-user-ref": userRef,
        },
        body: JSON.stringify({
          pid,
          feedbackType: "watching",
          note: note.trim(),
          userRef,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setNoteSaved(true);
      onCommentSaved?.(pid, note.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "코멘트 저장 실패");
    } finally {
      setNoteLoading(false);
    }
  }, [accessToken, userRef, note, pid, onCommentSaved]);

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
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            mouseDownOnBackdropRef.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            if (mouseDownOnBackdropRef.current && e.target === e.currentTarget) {
              e.stopPropagation();
              setOpen(false);
            }
            mouseDownOnBackdropRef.current = false;
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                📊 시세 근거 — pid {pid}
                {data ? <span className="ml-2 font-normal text-zinc-500">· 비교 매물 {data.comparables.length}개</span> : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                닫기 ✕
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-xs">
              {loading && !data && <MarketSourceDebugSkeleton />}
              {error && <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">에러: {error}</div>}
              {data && (
                <>
                  {/* 🎯 검토 중인 매물 — prominent 카드 */}
                  <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-3 dark:border-emerald-700 dark:bg-emerald-950/30">
                    <div className="flex gap-3">
                      {data.ourListing.thumbnailUrl && (
                        <Image
                          src={data.ourListing.thumbnailUrl.replace("{res}", "400")}
                          alt={data.ourListing.name ?? "매물"}
                          width={96}
                          height={96}
                          unoptimized
                          className="h-24 w-24 shrink-0 rounded-lg object-cover ring-2 ring-emerald-300 dark:ring-emerald-700"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                          🎯 지금 검토 중인 매물
                        </div>
                        <div className="mt-1 line-clamp-2 text-[14px] font-bold leading-5 text-zinc-900 dark:text-zinc-100">
                          {data.ourListing.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-baseline gap-2">
                          <span className="text-base font-black tabular-nums text-zinc-900 dark:text-zinc-100">
                            매입 {krw(data.ourListing.price)}
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-600">·</span>
                          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
                            {data.ourListing.marketPriceSource === "reference" ? (
                              <DanawaLogo className="h-4 w-4 rounded-[4px]" />
                            ) : (
                              <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-zinc-900 text-[8px] font-black text-white dark:bg-zinc-100 dark:text-zinc-900">
                                통
                              </span>
                            )}
                            {data.ourListing.marketPriceLabel}{" "}
                            {krw(data.ourListing.displayMarketPrice ?? data.ourListing.skuMedian)}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                          {data.ourListing.skuName ?? "—"}
                        </div>
                        {data.ourListing.comparableKey && (
                          <div className="mt-1 truncate font-mono text-[10px] text-zinc-500">
                            {data.ourListing.comparableKey}
                          </div>
                        )}
                        <a
                          href={data.ourListing.listingUrl || data.ourListing.bunjangUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          <MarketplaceSourceBadge source={data.ourListing.marketplaceSource} label={data.ourListing.marketplaceLabel} />
                          원본 매물 열기 →
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Wave 714d (2026-05-23): 신발/의류 5-tier 등급 + raw 표현 chips */}
                  {(data.ourListing.conditionTier || data.ourListing.conditionChips?.length) && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md bg-zinc-50 px-2 py-1.5 text-[11px] dark:bg-zinc-800/50">
                      {data.ourListing.conditionTier && (
                        <>
                          <span className="text-zinc-500">등급:</span>
                          <ConditionTierChip tier={data.ourListing.conditionTier} showHelp />
                          {data.ourListing.conditionConfidence != null && (
                            <span className="text-[10px] text-zinc-400">
                              신뢰도 {(data.ourListing.conditionConfidence * 100).toFixed(0)}%
                            </span>
                          )}
                          {data.ourListing.conditionCluster && (
                            <span className="text-[10px] text-zinc-400">{data.ourListing.conditionCluster}</span>
                          )}
                        </>
                      )}
                      {data.ourListing.conditionChips && data.ourListing.conditionChips.length > 0 && (
                        <ConditionChipsList chips={data.ourListing.conditionChips} max={6} />
                      )}
                    </div>
                  )}

                  {/* parser 진단 줄 */}
                  <div className="flex flex-wrap gap-x-3 rounded-md bg-zinc-50 px-2 py-1.5 text-[11px] dark:bg-zinc-800/50">
                    <span>
                      <span className="text-zinc-500">parse:</span>{" "}
                      {data.ourListing.parseConfidence != null
                        ? `${(data.ourListing.parseConfidence * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                    {data.ourListing.needsReview && (
                      <span className="rounded bg-amber-100 px-1 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        needs_review
                      </span>
                    )}
                    <span>
                      <span className="text-zinc-500">SKU:</span>{" "}
                      <span className="font-mono">{data.ourListing.skuId ?? "—"}</span>
                    </span>
                  </div>

                  {/* market_price_daily */}
                  {data.marketDailyStats && (
                    <div className="rounded-md bg-white p-2 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                      <div className="mb-1 font-semibold text-zinc-700 dark:text-zinc-200">
                        📅 market_price_daily (집계 시점)
                      </div>
                      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                        <div>blended med: {krw(data.marketDailyStats.blendedMedian as number | null)}</div>
                        <div>active med: {krw(data.marketDailyStats.activeMedian as number | null)}</div>
                        <div>p25: {krw(data.marketDailyStats.p25 as number | null)}</div>
                        <div>p75: {krw(data.marketDailyStats.p75 as number | null)}</div>
                        <div>active: {data.marketDailyStats.activeCount ?? "—"}건</div>
                        <div>sold: {data.marketDailyStats.soldCount ?? "—"}건</div>
                        <div>disappeared: {data.marketDailyStats.disappearedCount ?? "—"}건</div>
                        <div>confidence: {String(data.marketDailyStats.confidence ?? "—")}</div>
                      </div>
                      {data.marketDailyStats.computedAt && (
                        <div className="mt-1 text-[10px] text-zinc-500">
                          computed: {new Date(data.marketDailyStats.computedAt as string).toLocaleString("ko-KR")}
                        </div>
                      )}
                    </div>
                  )}

                  {/* live stats */}
                  {data.liveStats && (
                    <div className="rounded-md bg-white p-2 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                      <div className="mb-1 font-semibold text-zinc-700 dark:text-zinc-200">
                        ⚡ 실시간 통계 (현재 active {data.liveStats.activeCount}건)
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <div>min: {krw(data.liveStats.min)}</div>
                        <div className="font-bold">median: {krw(data.liveStats.median)}</div>
                        <div>max: {krw(data.liveStats.max)}</div>
                        <div>p25: {krw(data.liveStats.p25)}</div>
                        <div>p75: {krw(data.liveStats.p75)}</div>
                        <div>mean: {krw(data.liveStats.mean)}</div>
                      </div>
                    </div>
                  )}

                  {/* 비교 매물 */}
                  <div>
                    <div className="mb-2 font-semibold text-zinc-700 dark:text-zinc-200">
                      📋 비교 매물 {data.comparables.length}건 · 출처 = {data.comparableSource}
                      <span className="ml-2 font-normal text-zinc-500">(가격 낮은 순 / 우리보다 싼 매물 강조)</span>
                    </div>
                    {/* Wave 251.4 (2026-05-19): clothing product_type 필터 표시 — 사용자 신뢰. */}
                    {data.ourListing.productType && data.ourListing.productType !== "type_unknown" && (
                      <div className="mb-2 rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-700">
                        🧵 product_type 필터 적용 — 본 매물 「{data.ourListing.productType}」 와 같은 type 만 표시 (다른 type 매물 제외)
                      </div>
                    )}
                    <div className="space-y-1">
                      {sorted.map((c) => {
                        const isCheaper = c.price < ourPrice;
                        return (
                          <a
                            key={c.pid}
                            href={c.listingUrl || c.bunjangUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                              c.listingState !== "active"
                                ? "border-zinc-200 bg-zinc-50/50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/30"
                                : isCheaper
                                ? "border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20"
                                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                            }`}
                          >
                            {c.thumbnailUrl && (
                              <Image
                                src={c.thumbnailUrl.replace("{res}", "200")}
                                alt={c.name ?? "비교 매물"}
                                width={40}
                                height={40}
                                unoptimized
                                className="h-10 w-10 shrink-0 rounded object-cover"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium text-zinc-800 dark:text-zinc-100">{c.name}</div>
                              <div className="flex gap-2 text-zinc-500">
                                <span>{saleStatusLabel(c.saleStatus)}</span>
                                <span>· {c.marketplaceLabel}</span>
                                <span>· {relativeAge(c.lastSeenAt)}</span>
                                {c.sourceQuery && <span>· {c.sourceQuery.slice(0, 24)}</span>}
                              </div>
                              {/* Wave 714d: 신발/의류 등급 + chips */}
                              {(c.conditionTier || c.conditionChips?.length) && (
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  {c.conditionTier && <ConditionTierChip tier={c.conditionTier} />}
                                  {c.conditionChips && c.conditionChips.length > 0 && (
                                    <ConditionChipsList chips={c.conditionChips} max={4} />
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className={`font-bold ${isCheaper ? "text-rose-600 dark:text-rose-300" : "text-zinc-800 dark:text-zinc-100"}`}>
                                {krw(c.price)}
                              </div>
                              {isCheaper && <div className="text-[10px] text-rose-500">-{krw(ourPrice - c.price)}</div>}
                            </div>
                          </a>
                        );
                      })}
                      {sorted.length === 0 && (
                        <div className="text-zinc-500">비교 매물 없음. comparable_key 매핑 또는 parser 점검 필요.</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer (sticky) — 코멘트 입력 */}
            <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="mb-1.5 flex items-baseline justify-between text-[10px] font-bold">
                <span className="text-zinc-600 dark:text-zinc-300">💬 검증 메모 — 매물별 자유 기록 (나중에 일괄 검토용)</span>
                {(!userRef || !accessToken) && <span className="text-rose-500">로그인 필요</span>}
                {noteSaved && <span className="text-emerald-600 dark:text-emerald-400">✓ 저장됨</span>}
              </div>
              <textarea
                value={note}
                onChange={(e) => { setNote(e.target.value); setNoteSaved(false); }}
                disabled={!userRef || !accessToken}
                maxLength={5000}
                rows={3}
                placeholder="시세 비교 OK / 단품 의심 / 가격 비교 틀린 듯 / 사진 애매 / 이거 좋은 추천 ..."
                className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs leading-5 text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-emerald-400 dark:focus:ring-emerald-900"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <div className="text-[10px] text-zinc-400">{note.length}/5000</div>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={!userRef || !accessToken || !note.trim() || noteLoading}
                  className="rounded-md bg-emerald-700 px-4 py-1.5 text-[11px] font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                >
                  {noteLoading ? "저장 중..." : "코멘트 저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
