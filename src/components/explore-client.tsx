"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PackRevealModal, { type RevealResult } from "@/components/pack-reveal-modal";
import { ZapIcon, FlameIcon, ClockIcon, TrophyIcon } from "@/components/icons";
import type { RevealCard, RevealListingDetail } from "@/lib/pack-open";

// Wave 338+339 (Phase 1a + 1b — Freemium /explore):
// 무료 사용자 매물 풀 browsing. 6h+ 매물 30개 (ready 25 + 오늘 invalidated 5) + 30min cooldown
// + 통계 배너 + paywall 예고 + sold out 오버레이 + PackRevealModal 통합.

type PoolItem = {
  pid: number;
  name: string;
  price: number;
  skuMedian: number | null;
  thumbnailUrl: string | null;
  skuId: string | null;
  skuName: string | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  profitBand: number;
  confidence: number | null;
  category: string | null;
  conditionClass: string | null;
  comparableKey: string | null;
  lastVerifiedAt: string;
  freeShipping: boolean;
  sellerReviewRating: number | null;
  sellerReviewCount: number;
  descriptionPreview: string;
  soldOut: boolean;
};

type PoolResponse = {
  items: PoolItem[];
  cooldown: { canRefresh: boolean; remainingSec: number; nextAvailableAt: string | null };
  total: number;
  pageSize: number;
  freshLagHours: number;
  message?: string;
};

type StatsResponse = {
  caughtToday: number;
  freshLocked: number;
  freshLagHours: number;
};

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function profitAvg(item: PoolItem) {
  return Math.round((item.expectedProfitMin + item.expectedProfitMax) / 2);
}

function profitPct(item: PoolItem) {
  if (!item.price || item.price <= 0) return null;
  return Math.round((profitAvg(item) / item.price) * 100);
}

function hoursAgoLabel(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

function bunjangUrl(pid: number) {
  return `https://m.bunjang.co.kr/products/${pid}`;
}

// PoolItem → RevealCard 매핑 (PackRevealModal prop용).
// marketBasis는 minimal로 시작, onLoadDetail에서 lazy-fill.
function poolItemToRevealCard(item: PoolItem): RevealCard {
  const verifiedMs = new Date(item.lastVerifiedAt).getTime();
  const freshSeconds = Number.isFinite(verifiedMs)
    ? Math.max(0, Math.floor((Date.now() - verifiedMs) / 1000))
    : 0;
  return {
    pid: item.pid,
    name: item.name,
    url: bunjangUrl(item.pid),
    price: item.price,
    skuId: item.skuId,
    skuName: item.skuName ?? item.name,
    thumbnailUrl: item.thumbnailUrl,
    expectedProfitMin: item.expectedProfitMin,
    expectedProfitMax: item.expectedProfitMax,
    confidence: item.confidence ?? 0,
    band: (item.profitBand as 1 | 2 | 3) ?? null,
    marketBasis: {
      comparableKey: item.comparableKey,
      label: item.skuName ?? item.name,
      p25Price: null,
      medianPrice: item.skuMedian,
      p75Price: null,
      sampleCount: 0,
      activeSampleCount: 0,
      soldSampleCount: 0,
      disappearedSampleCount: 0,
      confidence: null,
      priceSource: "market",
      computedAt: null,
      excludedExamples: [],
      conditionClass: item.conditionClass,
      conditionLabel: null,
      fallbackUsed: false,
      otherConditions: [],
    },
    velocityBasis: null,
    lastVerifiedAt: item.lastVerifiedAt,
    freshSeconds,
    savedDetail: {
      descriptionPreview: item.descriptionPreview,
      favoriteCount: null,
      freeShipping: item.freeShipping,
      sellerName: null,
      sellerReviewRating: item.sellerReviewRating,
      sellerReviewCount: item.sellerReviewCount,
    },
    optionBaseAssumed: null,
  };
}

// Wave 340: 카테고리 필터 옵션 — 6개 위험 카테고리 + 가장 큰 카테고리 위주.
const CATEGORY_OPTIONS = [
  { value: "earphone", label: "이어폰" },
  { value: "smartphone", label: "폰" },
  { value: "tablet", label: "태블릿" },
  { value: "smartwatch", label: "스마트워치" },
  { value: "laptop", label: "노트북" },
  { value: "shoe", label: "신발" },
  { value: "bag", label: "가방" },
  { value: "clothing", label: "옷" },
];

type SortOption = "profit_desc" | "latest";

export default function ExploreClient() {
  const [items, setItems] = useState<PoolItem[]>([]);
  const [cooldown, setCooldown] = useState<PoolResponse["cooldown"] | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [selectedCard, setSelectedCard] = useState<RevealCard | null>(null);
  // Wave 346: refresh modal — 기다리기/충전 옵션
  const [refreshModalOpen, setRefreshModalOpen] = useState(false);

  // Wave 341 + 344: URL state sync — 새로고침/공유 시 카테고리/정렬 유지.
  // Wave 344: /me에 통합되면서 동적 pathname 사용 (이전엔 "/explore" 하드코딩 → /me에서 404 발생).
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 초기값 URL에서 파싱
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => {
    const raw = searchParams.get("categories");
    return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
  });
  const [sort, setSort] = useState<SortOption>(() => {
    const raw = searchParams.get("sort");
    return raw === "latest" ? "latest" : "profit_desc";
  });

  // 필터/정렬 변경 시 URL 갱신
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCategories.size > 0) params.set("categories", Array.from(selectedCategories).join(","));
    if (sort !== "profit_desc") params.set("sort", sort);
    const queryString = params.toString();
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [selectedCategories, sort, router, pathname]);

  // Cooldown tick (매초 갱신)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainingSec = useMemo(() => {
    if (!cooldown?.nextAvailableAt) return 0;
    const ms = new Date(cooldown.nextAvailableAt).getTime() - now;
    return Math.max(0, Math.ceil(ms / 1000));
  }, [cooldown, now]);

  const canRefresh = remainingSec === 0;

  const loadPool = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (refresh) params.set("refresh", "1");
      if (selectedCategories.size > 0) params.set("categories", Array.from(selectedCategories).join(","));
      if (sort !== "profit_desc") params.set("sort", sort);
      const url = `/api/packs/pool${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as PoolResponse;
      if (res.ok) {
        // Wave 340: 필터 적용 시 빈 결과도 반영 (items 빈 배열로 갱신)
        if (data.items != null) setItems(data.items);
        setCooldown(data.cooldown);
      } else {
        setError(data.message ?? "매물 불러오기 실패");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [selectedCategories, sort]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats/pool", { cache: "no-store" });
      if (res.ok) setStats((await res.json()) as StatsResponse);
    } catch {
      // 통계 실패는 무시
    }
  }, []);

  // 초기 1회 통계 fetch
  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  // 필터/정렬 변경 시 자동 재로드
  useEffect(() => {
    void loadPool(false);
  }, [loadPool]);

  // PackRevealModal용 result wrapper (single card)
  const modalResult: RevealResult | null = useMemo(() => {
    if (!selectedCard) return null;
    return {
      result: "success",
      reveals: [selectedCard],
      attemptedCount: 1,
      durationMs: 0,
    };
  }, [selectedCard]);

  // Wave 339b: /api/packs/pool/analysis로 marketBasis/velocityBasis lazy-fill.
  // assertRevealAccess 우회 (pid 기반). 가져온 분석으로 selectedCard 갱신.
  const handleLoadDetail = useCallback(async (pid: number): Promise<RevealListingDetail> => {
    try {
      const res = await fetch(`/api/packs/pool/analysis?pid=${pid}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { analysis?: { marketBasis: RevealCard["marketBasis"] | null; velocityBasis: RevealCard["velocityBasis"]; skuListingFlow: RevealCard["skuListingFlow"]; optionBaseAssumed: RevealCard["optionBaseAssumed"] } };
        if (data.analysis) {
          setSelectedCard((prev) => {
            if (!prev || prev.pid !== pid) return prev;
            return {
              ...prev,
              marketBasis: data.analysis!.marketBasis ?? prev.marketBasis,
              velocityBasis: data.analysis!.velocityBasis ?? prev.velocityBasis,
              skuListingFlow: data.analysis!.skuListingFlow ?? prev.skuListingFlow,
              optionBaseAssumed: data.analysis!.optionBaseAssumed ?? prev.optionBaseAssumed,
            };
          });
        }
      }
    } catch {
      // 분석 fetch 실패는 무시 (minimal로 모달 동작)
    }
    return {
      pid,
      description: "",
      saleStatus: "",
      conditionLabel: null,
    } as RevealListingDetail;
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-24 pt-2 sm:px-6 sm:pt-4">
      {/* Wave 345: 당근 feed 스타일 — 위 단순화. 통계+paywall 한 줄 inline. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-medium">
        {stats && stats.caughtToday > 0 ? (
          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
            <FlameIcon className="h-3 w-3" />
            오늘 {stats.caughtToday.toLocaleString("ko-KR")}건 잡힘
          </span>
        ) : null}
        {stats && stats.freshLocked > 0 ? (
          <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
            <ZapIcon className="h-3 w-3 text-amber-500" />
            즉시 매물 {stats.freshLocked.toLocaleString("ko-KR")}건은 구독자 전용 (곧 출시)
          </span>
        ) : (
          <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
            <ZapIcon className="h-3 w-3 text-amber-500" />
            즉시 매물은 구독자 전용 — 곧 출시
          </span>
        )}
      </div>

      {/* 필터/정렬 — sticky bar (당근식) */}
      <div className="sticky top-0 z-20 -mx-3 mb-3 flex items-center gap-1.5 overflow-x-auto bg-[#f6f1e8]/95 px-3 py-2 backdrop-blur dark:bg-zinc-950/95 sm:-mx-6 sm:px-6">
        {CATEGORY_OPTIONS.map((opt) => {
          const isActive = selectedCategories.has(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setSelectedCategories((prev) => {
                  const next = new Set(prev);
                  if (next.has(opt.value)) next.delete(opt.value);
                  else next.add(opt.value);
                  return next;
                });
              }}
              className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                isActive
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        {selectedCategories.size > 0 ? (
          <button
            type="button"
            onClick={() => setSelectedCategories(new Set())}
            className="shrink-0 px-1.5 py-1 text-[10px] font-medium text-zinc-500 underline dark:text-zinc-400"
          >
            초기화
          </button>
        ) : null}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="ml-auto shrink-0 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300"
        >
          <option value="profit_desc">차익순</option>
          <option value="latest">최신순</option>
        </select>
      </div>

      {/* 로딩 / 에러 / 매물 grid */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              {/* 사진 영역 */}
              <div className="aspect-square animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              {/* 텍스트 영역 */}
              <div className="min-w-0 space-y-2">
                <div className="space-y-1">
                  <div className="h-3 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <div className="h-5 w-20 animate-pulse rounded bg-emerald-100 dark:bg-emerald-950/40" />
                  <div className="h-3 w-8 animate-pulse rounded-full bg-emerald-50 dark:bg-emerald-950/30" />
                </div>
                <div className="h-2.5 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/60" />
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-12 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800/60" />
                  <div className="h-2.5 w-14 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800/60" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            6시간 이상 지난 매물이 아직 없어요. 잠시 후 다시 와주세요.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const pct = profitPct(item);
            const isPremiumSeller = (item.sellerReviewRating ?? 0) >= 4.8 && item.sellerReviewCount >= 30;
            const isSoldOut = item.soldOut;
            return (
              <button
                key={item.pid}
                type="button"
                onClick={() => {
                  if (isSoldOut) return;
                  setSelectedCard(poolItemToRevealCard(item));
                }}
                disabled={isSoldOut}
                className={`group relative grid grid-cols-[100px_minmax(0,1fr)] gap-3 rounded-xl border p-3 text-left transition ${
                  isSoldOut
                    ? "cursor-not-allowed border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/30"
                    : "border-zinc-200 bg-white hover:border-emerald-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-emerald-700"
                }`}
              >
                {/* Sold out 오버레이 */}
                {isSoldOut ? (
                  <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-zinc-900/55 backdrop-blur-[1px]">
                    <div className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
                      🔴 다른 사용자가 잡음
                    </div>
                    <div className="mt-1.5 text-[10px] font-bold text-white/85">
                      즉시 알림 있었으면 잡을 수 있었어요
                    </div>
                  </div>
                ) : null}

                <div className={`relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 ${isSoldOut ? "opacity-50" : ""}`}>
                  {item.thumbnailUrl ? (
                    <Image
                      src={item.thumbnailUrl}
                      alt={item.name}
                      fill
                      sizes="100px"
                      unoptimized
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className={`min-w-0 ${isSoldOut ? "opacity-60" : ""}`}>
                  <div className="line-clamp-2 text-sm font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                    {item.name}
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className={`text-lg font-bold tabular-nums ${isSoldOut ? "text-zinc-500 line-through dark:text-zinc-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                      +{krw(profitAvg(item))}
                    </span>
                    {pct != null ? (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${isSoldOut ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"}`}>
                        +{pct}%
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    <span>매입 <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{krw(item.price)}</span></span>
                    {item.skuMedian ? (
                      <>
                        <span className="text-zinc-300 dark:text-zinc-700">·</span>
                        <span>시세 <span className="font-bold tabular-nums">{krw(item.skuMedian)}</span></span>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
                    <span className="flex items-center gap-0.5 text-zinc-500">
                      <ClockIcon className="h-3 w-3" />
                      {hoursAgoLabel(item.lastVerifiedAt)}
                    </span>
                    {isPremiumSeller && !isSoldOut ? (
                      <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                        <TrophyIcon className="h-3 w-3" />
                        우수 셀러
                      </span>
                    ) : null}
                    {item.freeShipping && !isSoldOut ? (
                      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        무료배송
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Wave 347: 모바일 fixed sticky 하단 — 단순 "다른 매물 찾기". cooldown은 모달 안에서. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 sm:hidden">
        <button
          type="button"
          onClick={() => setRefreshModalOpen(true)}
          disabled={refreshing}
          className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--brand-accent-strong)] px-6 py-3 text-sm font-bold text-[var(--brand-cream)] shadow-[0_16px_34px_rgba(34,49,39,0.28)] transition active:scale-[0.98]"
        >
          {refreshing ? "받는 중..." : "🔍 다른 매물 찾기"}
        </button>
      </div>

      {/* 데스크탑: 목록 아래 */}
      {!loading && items.length > 0 ? (
        <div className="mt-6 hidden justify-center sm:flex">
          <button
            type="button"
            onClick={() => setRefreshModalOpen(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-accent-strong)] px-5 py-2.5 text-sm font-bold text-[var(--brand-cream)] transition hover:opacity-90"
          >
            {refreshing ? "받는 중..." : "🔍 다른 매물 찾기"}
          </button>
        </div>
      ) : null}

      {/* Refresh Modal — 기다리기 / 크레딧 충전 옵션 */}
      {refreshModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-6" onClick={() => setRefreshModalOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  새 30개 매물 받기
                </div>
                <div className="mt-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {canRefresh ? "지금 바로 받을 수 있어요" : `${Math.floor(remainingSec / 60)}분 ${remainingSec % 60}초 후 무료로 받을 수 있어요`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRefreshModalOpen(false)}
                className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {/* 옵션 1: 기다리기 (cooldown 끝나면 즉시 받기) */}
              <button
                type="button"
                onClick={() => {
                  if (canRefresh) {
                    void loadPool(true);
                    setRefreshModalOpen(false);
                  }
                }}
                disabled={!canRefresh}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                  canRefresh
                    ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40"
                    : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
                }`}
              >
                <div className="min-w-0">
                  <div className={`text-sm font-bold ${canRefresh ? "text-emerald-800 dark:text-emerald-200" : "text-zinc-600 dark:text-zinc-400"}`}>
                    {canRefresh ? "✨ 지금 받기 (무료)" : "⏱ 기다리기 (무료)"}
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    {canRefresh ? "쿨다운 끝남 · 즉시 새 30개" : `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, "0")} 후 자동으로 가능`}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${canRefresh ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>
                  무료
                </span>
              </button>

              {/* 옵션 2: 크레딧 충전 (즉시 받기) */}
              <a
                href="/plans"
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-900/50"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-amber-900 dark:text-amber-100">
                    ⚡ 크레딧으로 즉시 받기
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    쿨다운 X · 즉시 매물 알림 (구독자 전용 · 곧 출시)
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  유료
                </span>
              </a>
            </div>

            <div className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-[10px] font-medium leading-4 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
              💡 무료 사용자는 6시간 이상 지난 매물 30개를 30분마다 받을 수 있어요. 즉시 매물은 곧 출시되는 구독으로 받게 됩니다.
            </div>
          </div>
        </div>
      ) : null}

      {/* PackRevealModal — 카드 클릭 시 띄움 */}
      <PackRevealModal
        open={selectedCard != null}
        band={2}
        loading={false}
        result={modalResult}
        onClose={() => setSelectedCard(null)}
        onLinkClicked={() => {}}
        onFeedback={() => {}}
        onLoadDetail={handleLoadDetail}
        onRetry={() => {}}
      />
    </div>
  );
}
