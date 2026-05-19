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
    <div className="mx-auto w-full max-w-6xl px-3 pb-20 pt-4 sm:px-6 sm:pt-6">
      {/* 통계 배너 (FOMO) */}
      {stats && (stats.caughtToday > 0 || stats.freshLocked > 0) ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {stats.caughtToday > 0 ? (
              <span className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-100">
                <FlameIcon className="h-4 w-4" />
                오늘 {stats.caughtToday.toLocaleString("ko-KR")}건 잡힘
              </span>
            ) : null}
            {stats.freshLocked > 0 ? (
              <span className="text-amber-700 dark:text-amber-300">
                · 최근 {stats.freshLagHours}시간 안에 풀린 매물 <span className="font-bold">{stats.freshLocked.toLocaleString("ko-KR")}건</span> (구독자 전용)
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 헤더 */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">탐색</h1>
          <p className="mt-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            6시간 이상 지난 매물 30개 · 30분마다 새로 받기
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadPool(true)}
          disabled={!canRefresh || refreshing}
          className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${
            canRefresh && !refreshing
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
          }`}
        >
          {refreshing ? "받는 중..." : canRefresh ? "새 30개 받기" : `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, "0")} 후 가능`}
        </button>
      </div>

      {/* Paywall 예고 칩 */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
        <ZapIcon className="h-4 w-4 text-amber-500" />
        <span>
          <span className="font-bold text-zinc-900 dark:text-zinc-100">즉시 매물</span>은 구독자 전용 — 곧 출시. 지금은 6시간 전 매물만 무료로 봐요.
        </span>
      </div>

      {/* Wave 340: 카테고리 필터 + 정렬 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
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
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                  isActive
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:border-zinc-600"
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
              className="rounded-full px-2 py-1 text-[11px] font-medium text-zinc-500 underline dark:text-zinc-400"
            >
              초기화
            </button>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[11px]">
          <span className="text-zinc-500 dark:text-zinc-400">정렬</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300"
          >
            <option value="profit_desc">차익 높은순</option>
            <option value="latest">최신순</option>
          </select>
        </div>
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

      {/* 푸터 안내 */}
      {!loading && items.length > 0 ? (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          매물 클릭 → 상세 정보 확인. 시세는 AI 비교 정보일 뿐, 거래 진위는 본인이 판단.
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
