"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PackRevealModal, { type RevealResult } from "@/components/pack-reveal-modal";
import { ZapIcon, FlameIcon, ClockIcon, TrophyIcon, CategoryIcon, SearchIcon, GiftIcon, TargetIcon, HourglassIcon } from "@/components/icons";
import { ConditionChip, ConditionPhotoBadge } from "@/components/condition-chip";
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
  // Wave 358: 슬라이드 업 애니메이션 — open/close 사이 250ms transition.
  const [refreshModalOpen, setRefreshModalOpen] = useState(false);
  const [refreshModalAnimating, setRefreshModalAnimating] = useState(false);

  // 모달 mount 후 다음 frame에 애니메이션 활성화 (slide up / fade in)
  useEffect(() => {
    if (refreshModalOpen) {
      const id = requestAnimationFrame(() => setRefreshModalAnimating(true));
      return () => cancelAnimationFrame(id);
    }
  }, [refreshModalOpen]);

  const closeRefreshModal = useCallback(() => {
    setRefreshModalAnimating(false);
    const t = setTimeout(() => setRefreshModalOpen(false), 250);
    return () => clearTimeout(t);
  }, []);

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

  // Wave 353: 카테고리 필터는 클라이언트 사이드 (서버 → 항상 다양화된 30개 풀, 클라가 필터링).
  // 정렬은 백엔드 유지 — 풀 구성 자체가 달라짐 (latest = 최신 30 vs profit_desc = 차익 상위 30).
  const loadPool = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (refresh) params.set("refresh", "1");
      if (sort !== "profit_desc") params.set("sort", sort);
      const url = `/api/packs/pool${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as PoolResponse;
      if (res.ok) {
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
  }, [sort]);

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

  // Wave 353: 클라이언트 사이드 카테고리 필터. 전체 풀(items)에서 selectedCategories에 속한 매물만.
  // category가 null이면 selectedCategories 활성 시 제외 (안전).
  const displayItems = useMemo(() => {
    if (selectedCategories.size === 0) return items;
    return items.filter((it) => it.category != null && selectedCategories.has(it.category));
  }, [items, selectedCategories]);

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

  // Wave 349: 모달 안 "다른 매물 추천" — 현재 매물 제외 + 같은 카테고리 우선 + 8개.
  // sold out 매물 제외 (클릭 불가).
  const relatedItems = useMemo(() => {
    if (!selectedCard) return [];
    const currentPid = selectedCard.pid;
    const currentCategory = items.find((it) => it.pid === currentPid)?.category ?? null;
    const candidates = items.filter((it) => it.pid !== currentPid && !it.soldOut);
    // 같은 카테고리 우선 정렬
    const sameCategory = candidates.filter((it) => it.category === currentCategory);
    const otherCategory = candidates.filter((it) => it.category !== currentCategory);
    const ordered = [...sameCategory, ...otherCategory].slice(0, 8);
    return ordered.map((it) => ({
      pid: it.pid,
      name: it.name,
      price: it.price,
      thumbnailUrl: it.thumbnailUrl,
      expectedProfitMin: it.expectedProfitMin,
      expectedProfitMax: it.expectedProfitMax,
      marketBasis: null,
      revealedAt: it.lastVerifiedAt,
    }));
  }, [items, selectedCard]);

  // 다른 매물 클릭 시 modal 전환
  const handleOpenRelatedItem = useCallback((pid: number) => {
    const item = items.find((it) => it.pid === pid);
    if (item) setSelectedCard(poolItemToRevealCard(item));
  }, [items]);

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
    {/* 2026-05-19: pb-24 → pb-4. 이전 fixed FAB 시절 sticky 영역 확보 padding이었는데
        sticky 통일 후 의미 없어짐 → button과 footer 사이 큰 빈 공간 제거. */}
    <div className="mx-auto w-full max-w-6xl px-3 pb-4 pt-2 sm:px-6 sm:pt-4">
      {/* 2026-05-19 (사용자 피드백): 광고 톤 줄이고 안내 톤으로 정비.
          "구독자 전용 (곧 출시)" → "따끈한 매물 먼저 보기 →" 으로 사용자 액션 명확화.
          freshLagHours 값을 직접 노출해 무엇을 보고 있는지 즉시 인지. */}
      <div className="mb-3 rounded-xl border border-[#e7dece] bg-[#fffaf1] px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
          <span className="text-zinc-600 dark:text-zinc-400">
            지금{" "}
            <strong className="font-bold text-zinc-800 dark:text-zinc-100">
              올린 지 {stats?.freshLagHours ?? 6}시간 넘은 매물
            </strong>
            을 보고 있어요
          </span>
          <Link
            href="/plans"
            className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline dark:text-emerald-300"
          >
            <ZapIcon className="h-3 w-3" />
            따끈한 매물 먼저 보기 →
          </Link>
        </div>
        {stats && stats.caughtToday > 0 ? (
          <div className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
            <FlameIcon className="h-3 w-3" />
            오늘 {stats.caughtToday.toLocaleString("ko-KR")}건 새로 잡힘
            {stats.freshLocked > 0 ? (
              <span className="text-zinc-500 dark:text-zinc-400">
                · 구독자가 본 신선 매물 {stats.freshLocked.toLocaleString("ko-KR")}건
              </span>
            ) : null}
          </div>
        ) : null}
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
              className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                isActive
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400"
              }`}
            >
              {/* 2026-05-19: SF Symbol 스타일 라인 아이콘 추가. 텍스트만 칩 촌스러움 해소. */}
              <CategoryIcon category={opt.value} className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
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
        <div className="-mx-3 divide-y divide-zinc-100 dark:divide-zinc-800 sm:mx-0 sm:grid sm:grid-cols-2 sm:divide-y-0 sm:gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-4 sm:rounded-xl sm:border sm:border-zinc-200 sm:bg-white sm:p-3 dark:sm:border-zinc-800 dark:sm:bg-zinc-900/40"
            >
              <div className="aspect-square animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
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
      ) : displayItems.length === 0 ? (
        // Wave 353: 클라이언트 필터 결과 빈 경우 — 풀엔 있는데 선택 카테고리에만 없음.
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
            이번 30개 풀에 해당 카테고리 매물이 없어요
          </p>
          <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            필터 초기화하거나, 다른 30개를 받아보세요.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategories(new Set())}
              className="rounded-full border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 dark:border-amber-700 dark:bg-zinc-900 dark:text-amber-200"
            >
              전체 카테고리 보기
            </button>
            <button
              type="button"
              onClick={() => setRefreshModalOpen(true)}
              className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white"
            >
              🔍 다른 매물 찾기
            </button>
          </div>
        </div>
      ) : (
        // Wave 350: 당근 피드 스타일 — 모바일 1열 + 박스 X + divider만.
        // 데스크탑 sm+ 2열 (좁은 화면 1열은 너무 비어보임).
        // Wave 353: items → displayItems (클라이언트 카테고리 필터 적용).
        <div className="-mx-3 divide-y divide-zinc-100 dark:divide-zinc-800 sm:mx-0 sm:grid sm:grid-cols-2 sm:divide-y-0 sm:gap-3 lg:grid-cols-3">
          {displayItems.map((item) => {
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
                className={`relative grid w-full grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-4 text-left transition sm:rounded-xl sm:border sm:p-3 ${
                  isSoldOut
                    ? "cursor-not-allowed sm:border-zinc-200 sm:bg-zinc-50 dark:sm:border-zinc-800 dark:sm:bg-zinc-900/30"
                    : "active:bg-zinc-50 dark:active:bg-zinc-900/40 sm:border-zinc-200 sm:bg-white sm:hover:border-emerald-300 sm:hover:shadow-md dark:sm:border-zinc-800 dark:sm:bg-zinc-900/40 dark:sm:hover:border-emerald-700"
                }`}
              >
                {/* Wave 351: sold out — 사진만 흐리게 + 우상단 칩. 카드 내용 그대로 (FOMO). */}
                <div className={`relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 ${isSoldOut ? "grayscale" : ""}`}>
                  {item.thumbnailUrl ? (
                    <Image
                      src={item.thumbnailUrl}
                      alt={item.name}
                      fill
                      sizes="120px"
                      unoptimized
                      className={`object-cover ${isSoldOut ? "opacity-60" : ""}`}
                    />
                  ) : null}
                  {/* Wave 355: unopened/mint만 사진 위 럭셔리 배지 ("전설템" 느낌). 나머지 등급은 메타 영역 friendly 칩. */}
                  {!isSoldOut && (item.conditionClass === "unopened" || item.conditionClass === "mint") ? (
                    <ConditionPhotoBadge conditionClass={item.conditionClass} compact />
                  ) : null}
                  {isSoldOut ? (
                    // Wave 357: SaaS 친화 톤 — 단순 "잡힘" → sympathy 표현 + emoji.
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-900/35 px-2">
                      <span className="rounded-full bg-rose-600/95 px-2.5 py-1 text-center text-[10px] font-bold leading-tight text-white shadow-lg">
                        다른 분이 잡았어요 ㅠㅠ
                      </span>
                    </div>
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
                    {isSoldOut ? (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                        💡 구독자는 잡을 수 있었어요
                      </span>
                    ) : (
                      <>
                        {/* Wave 354+355: 매물 등급 — 친화 풀어쓴 라벨 ("상태 보통"/"하자 있음"/...).
                            unopened/mint는 사진 위 럭셔리 배지로 따로 표시되므로 여기선 제외. */}
                        {item.conditionClass && item.conditionClass !== "unopened" && item.conditionClass !== "mint" ? (
                          <ConditionChip conditionClass={item.conditionClass} variant="friendly" />
                        ) : null}
                        <span className="flex items-center gap-0.5 text-zinc-500">
                          <ClockIcon className="h-3 w-3" />
                          {hoursAgoLabel(item.lastVerifiedAt)}
                        </span>
                        {isPremiumSeller ? (
                          <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                            <TrophyIcon className="h-3 w-3" />
                            우수 셀러
                          </span>
                        ) : null}
                        {item.freeShipping ? (
                          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            무료배송
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Wave 358: 빈 공간 채우기 — 매물 끝에 다음 라운드 안내 카드. */}
      {!loading && items.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
              <HourglassIcon className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {canRefresh ? "다른 30개 매물 받을 수 있어요" : "다음 라운드 준비 중"}
              </div>
              <div className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {canRefresh
                  ? "새로운 매물 풀로 갱신 · 다양한 카테고리"
                  : `${Math.floor(remainingSec / 60)}분 ${String(remainingSec % 60).padStart(2, "0")}초 후 새 매물 자동으로 풀려요`}
              </div>
              {stats && stats.freshLocked > 0 ? (
                <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <ZapIcon className="h-3 w-3" />
                  <span>지금 즉시 매물 {stats.freshLocked.toLocaleString("ko-KR")}건은 <b className="font-bold">구독자 전용</b> (곧 출시)</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* 2026-05-19: sticky bottom CTA 통일 — 모바일도 PC와 동일 sticky 패턴.
          이전: 모바일=fixed FAB (항상 떠있음), 데스크탑=sticky bottom-4 (카드 끝에 흡수).
          사용자 피드백: "하단에 fixed되다가 제자리 보이면 탁 멈추는 그게 sticky 아니였나?"
          → 모바일도 sticky로 통일. "다른 30개" 카드 도달 시 자연 위치 흡수. */}
      {!loading && items.length > 0 ? (
        <div className="sticky bottom-4 z-20 mt-4 flex justify-center px-4 sm:mt-6 sm:px-0">
          <button
            type="button"
            onClick={() => setRefreshModalOpen(true)}
            disabled={refreshing}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--brand-accent-strong)] px-6 py-3.5 text-base font-bold text-[var(--brand-cream)] shadow-[0_20px_44px_rgba(34,49,39,0.38),0_4px_12px_rgba(34,49,39,0.20)] ring-1 ring-white/10 transition active:scale-[0.97] hover:translate-y-[-1px] hover:shadow-[0_24px_48px_rgba(34,49,39,0.42)] sm:min-h-0 sm:py-3 sm:text-sm sm:shadow-[0_16px_34px_rgba(34,49,39,0.32)]"
          >
            <SearchIcon className="h-4 w-4" />
            {refreshing ? "받는 중..." : "다른 매물 찾기"}
          </button>
        </div>
      ) : null}

      {/* Wave 348+358: Refresh Modal — bottom sheet slide-up + 위계 강조 + 사이트 톤. */}
      {refreshModalOpen ? (
        <div
          className={`fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200 sm:items-center sm:p-6 ${
            refreshModalAnimating ? "opacity-100" : "opacity-0"
          }`}
          onClick={closeRefreshModal}
        >
          <div
            className={`w-full max-w-md transform border border-zinc-200/50 bg-[var(--brand-cream)] shadow-[0_-20px_60px_rgba(0,0,0,0.30)] transition-all duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-3xl rounded-t-3xl ${
              refreshModalAnimating
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-full opacity-0 sm:translate-y-4 sm:scale-95"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모바일 grab handle */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </div>

            <div className="px-6 pt-5 pb-6 sm:pt-6">
              {/* Header */}
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    다른 매물 찾기
                  </div>
                  <div className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    무료로 새 30개, 또는 조건 골라서 받기
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeRefreshModal}
                  className="-mr-2 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  aria-label="닫기"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 메인 CTA — 무료 랜덤 30개 (가장 강조) */}
              <button
                type="button"
                onClick={() => {
                  if (canRefresh) {
                    void loadPool(true);
                    closeRefreshModal();
                  }
                }}
                disabled={!canRefresh}
                className={`group relative w-full overflow-hidden rounded-2xl px-5 py-4 text-left transition ${
                  canRefresh
                    ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-[0_12px_28px_rgba(34,49,39,0.28)] hover:shadow-[0_16px_34px_rgba(34,49,39,0.34)] active:scale-[0.99]"
                    : "cursor-not-allowed bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-500"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <GiftIcon className="h-5 w-5" />
                      <span className="text-base font-bold">
                        랜덤 30개 받기
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${canRefresh ? "bg-white/20 text-[var(--brand-cream)]" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>
                        무료
                      </span>
                    </div>
                    <div className={`mt-1.5 text-xs font-medium ${canRefresh ? "text-[var(--brand-cream)]/75" : "text-zinc-500 dark:text-zinc-500"}`}>
                      {canRefresh
                        ? "다양한 카테고리에서 새 30개"
                        : `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, "0")} 후 자동으로 풀려요`}
                    </div>
                  </div>
                  {canRefresh ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 transition group-hover:translate-x-0.5">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  ) : null}
                </div>
              </button>

              {/* 보조 옵션 — 크레딧 맞춤 검색 (paywall 예고) */}
              <div className="mt-3 rounded-2xl border border-amber-200/60 bg-amber-50/50 px-5 py-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <TargetIcon className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                    <span className="text-base font-bold text-amber-900 dark:text-amber-100">
                      맞춤 검색
                    </span>
                  </div>
                  <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                    크레딧
                  </span>
                </div>
                <div className="mt-1 text-xs font-medium text-amber-800/80 dark:text-amber-200/80">
                  예산 · 성향 골라서 즉시 받기
                </div>

                {/* 옵션 미리보기 */}
                <div className="mt-3 space-y-2.5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900/70 dark:text-amber-100/70">
                      예산
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {["10만 이하", "30만 이하", "50만 이하", "제한 없음"].map((label) => (
                        <span
                          key={label}
                          className="cursor-not-allowed rounded-full border border-amber-200 bg-white/80 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-800/40 dark:bg-zinc-900/60 dark:text-amber-200"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900/70 dark:text-amber-100/70">
                      매물 성향
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {[
                        { label: "공격적", sub: "차익 큰 매물" },
                        { label: "균형", sub: "안정 + 차익" },
                        { label: "안전", sub: "셀러 평점 높음" },
                      ].map((opt) => (
                        <span
                          key={opt.label}
                          className="cursor-not-allowed rounded-full border border-amber-200 bg-white/80 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-800/40 dark:bg-zinc-900/60 dark:text-amber-200"
                          title={opt.sub}
                        >
                          {opt.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <Link
                  href="/plans"
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-amber-700"
                >
                  구독으로 풀기 (곧 출시)
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              {/* Footer hint */}
              <div className="mt-4 text-center text-[11px] font-medium leading-5 text-zinc-500 dark:text-zinc-400">
                무료는 30분마다 새 30개 · 크레딧으로는 예산/성향 골라 즉시 받기
              </div>
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
        relatedItems={relatedItems}
        onOpenRelatedItem={handleOpenRelatedItem}
      />
    </div>
  );
}
