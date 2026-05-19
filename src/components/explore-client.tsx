"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PackRevealModal, { type RevealResult } from "@/components/pack-reveal-modal";
import { ZapIcon, ClockIcon, TrophyIcon, CategoryIcon, SearchIcon, GiftIcon, TargetIcon, HourglassIcon } from "@/components/icons";
import { ConditionChip, ConditionPhotoBadge } from "@/components/condition-chip";
import KakaoLogo from "@/components/kakao-logo";
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
  // Wave 382: 사용자 예산이 fallback됐는지 (사용자 안내용).
  appliedBudget?: "150k" | "300k" | "500k" | "unlimited";
};

type StatsResponse = {
  caughtToday: number;
  freshLocked: number;
  freshLagHours: number;
};

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

// Wave 383+385: cooldown 표시 — 초까지 보여서 카운트다운 실시간 가시.
// 매초 setNow 갱신 (line ~213 setInterval) → remainingSec useMemo 재계산 → 표시 매초 변경.
function formatCooldown(sec: number): string {
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}시간 ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  if (sec >= 60) {
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  }
  return `0:${String(sec).padStart(2, "0")}`;
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

// Wave 374: personalization — 예산 + 매물 성향. localStorage에 저장 (디바이스 단위).
// Wave 381: 옵션 10만 → 15만 (10~15만 사이 매물이 가장 많은 가격대).
type Budget = "150k" | "300k" | "500k" | "unlimited";
type Preference = "safe" | "balanced" | "aggressive";
type UserPreferences = { budget: Budget; preference: Preference };
const PREFS_STORAGE_KEY = "minyoi_explore_prefs_v1";

function loadPreferences(): UserPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { budget?: string; preference?: Preference };
    if (!parsed.budget || !parsed.preference) return null;
    // Wave 381: 이전 "100k" 옵션 폐기 → "150k"로 migration. 사용자 다시 답 안 받아도 OK.
    const rawBudget: string = parsed.budget === "100k" ? "150k" : parsed.budget;
    const validBudgets: Budget[] = ["150k", "300k", "500k", "unlimited"];
    if (!(validBudgets as string[]).includes(rawBudget)) return null;
    return { budget: rawBudget as Budget, preference: parsed.preference };
  } catch {
    return null;
  }
}
function savePreferences(prefs: UserPreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

const BUDGET_OPTIONS: { value: Budget; label: string }[] = [
  { value: "150k", label: "15만 이하" },
  { value: "300k", label: "30만 이하" },
  { value: "500k", label: "50만 이하" },
  { value: "unlimited", label: "제한 없음" },
];
const PREFERENCE_OPTIONS: { value: Preference; label: string; sub: string; emoji: string }[] = [
  { value: "safe", label: "안전", sub: "셀러 평점 높음", emoji: "🛡" },
  { value: "balanced", label: "균형", sub: "안정 + 차익", emoji: "⚖" },
  { value: "aggressive", label: "공격", sub: "차익 큰 매물", emoji: "🚀" },
];

export default function ExploreClient() {
  const [items, setItems] = useState<PoolItem[]>([]);
  // Wave 391: loadPool에서 items deps에 박으면 infinite loop. ref로 fresh 접근.
  const itemsRef = useRef<PoolItem[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);
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
  // Wave 374: personalization — localStorage 저장된 선호 + 모달 step.
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [editingPrefs, setEditingPrefs] = useState(false);
  const [draftBudget, setDraftBudget] = useState<Budget>("unlimited");
  const [draftPreference, setDraftPreference] = useState<Preference>("balanced");
  // Wave 376: 가입 직후 (prefs X) → 모달 자동 열림 + 예산만 묻기 (성향은 default balanced).
  // 답 또는 dismiss 전에는 첫 fetch 보류 — 첫 30개부터 personalized 가치 체감.
  const [awaitingInitialPrefs, setAwaitingInitialPrefs] = useState(false);
  // Wave 382: pool API에서 fallback 적용된 예산 (사용자 prefs와 다르면 배너 표시)
  const [appliedBudget, setAppliedBudget] = useState<Budget | null>(null);

  // localStorage 로드 (mount 1회). prefs X면 가입 직후 자동 폼 트리거.
  useEffect(() => {
    const loaded = loadPreferences();
    if (loaded) {
      setPreferences(loaded);
      setDraftBudget(loaded.budget);
      setDraftPreference(loaded.preference);
    } else {
      // Wave 376: 가입 직후 자동 모달 (예산만)
      setAwaitingInitialPrefs(true);
      setRefreshModalOpen(true);
    }
  }, []);

  // 모달 mount 후 다음 frame에 애니메이션 활성화 (slide up / fade in)
  useEffect(() => {
    if (refreshModalOpen) {
      const id = requestAnimationFrame(() => setRefreshModalAnimating(true));
      return () => cancelAnimationFrame(id);
    }
  }, [refreshModalOpen]);

  const closeRefreshModal = useCallback(() => {
    setRefreshModalAnimating(false);
    const t = setTimeout(() => {
      setRefreshModalOpen(false);
      // Wave 376: 모달 닫힘 시 가입 직후 가드 자동 해제 → 보류된 첫 fetch 트리거.
      setAwaitingInitialPrefs(false);
    }, 250);
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
  // Wave 374: preferences (budget/preference) 인자도 전달.
  const loadPool = useCallback(async (refresh: boolean, prefsOverride?: UserPreferences | null) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (refresh) params.set("refresh", "1");
      if (sort !== "profit_desc") params.set("sort", sort);
      const effectivePrefs = prefsOverride !== undefined ? prefsOverride : preferences;
      if (effectivePrefs) {
        if (effectivePrefs.budget !== "unlimited") params.set("budget", effectivePrefs.budget);
        params.set("preference", effectivePrefs.preference);
      }
      // Wave 391: refresh 시 이미 본 pids 전달 → 백엔드가 제외하고 다른 매물 fetch.
      // 안 그러면 같은 풀에서 같은 30개 다양화 결과 → frontend dedupe 후 0개 추가.
      // itemsRef로 fresh 접근 (deps에 items 박으면 infinite loop).
      const currentItems = itemsRef.current;
      if (refresh && currentItems.length > 0) {
        const excludePids = currentItems.map((it) => it.pid).join(",");
        params.set("excludePids", excludePids);
      }
      const url = `/api/packs/pool${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as PoolResponse;
      if (res.ok) {
        if (data.items != null) {
          // Wave 371: refresh = append + pid dedupe (기존 매물 유지하면서 새 매물 추가).
          // 사용자 의도 — 더 둘러보고 싶어서 "다른 매물 찾기" 누르는데 기존이 사라지면 X.
          // 초기 load (refresh=false)는 덮어쓰기 (첫 데이터).
          if (refresh) {
            setItems((prev) => {
              const existingPids = new Set(prev.map((it) => it.pid));
              const fresh = data.items!.filter((it) => !existingPids.has(it.pid));
              return [...prev, ...fresh];
            });
          } else {
            setItems(data.items);
          }
        }
        setCooldown(data.cooldown);
        // Wave 382: 응답의 fallback 적용된 budget 저장 (사용자 prefs와 비교 위해)
        if (data.appliedBudget) setAppliedBudget(data.appliedBudget);
      } else {
        setError(data.message ?? "매물 불러오기 실패");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [sort, preferences]);

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

  // 필터/정렬 변경 시 자동 재로드.
  // Wave 376: 가입 직후 가드 — preferences 답하기 전엔 fetch 보류 (random 30 안 보이게).
  useEffect(() => {
    if (awaitingInitialPrefs) return;
    void loadPool(false);
  }, [loadPool, awaitingInitialPrefs]);

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
    // Wave 366: marketBasis null → minimal로 채워서 시세 표시되도록.
    return ordered.map((it) => ({
      pid: it.pid,
      name: it.name,
      price: it.price,
      thumbnailUrl: it.thumbnailUrl,
      expectedProfitMin: it.expectedProfitMin,
      expectedProfitMax: it.expectedProfitMax,
      marketBasis: it.skuMedian
        ? {
            comparableKey: it.comparableKey,
            label: it.skuName ?? it.name,
            p25Price: null,
            medianPrice: it.skuMedian,
            p75Price: null,
            sampleCount: 0,
            activeSampleCount: 0,
            soldSampleCount: 0,
            disappearedSampleCount: 0,
            confidence: null,
            priceSource: "market" as const,
            computedAt: null,
            excludedExamples: [],
            conditionClass: it.conditionClass,
            conditionLabel: null,
            fallbackUsed: false,
            otherConditions: [],
          }
        : null,
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

  // 2026-05-19: pb-24 → pb-4. 이전 fixed FAB 시절 sticky 영역 확보 padding이었는데
  // sticky 통일 후 의미 없어짐 → button과 footer 사이 큰 빈 공간 제거.
  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-4 pt-2 sm:px-6 sm:pt-4">
      {/* Wave 383+393: 6h lag 제거 + 사이트 핵심 가치 (band-aware 비교) 강조. */}
      <div className="mb-2 rounded-xl border border-[#e7dece] bg-[#fffaf1] px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-800 dark:text-emerald-300">
          <span aria-hidden="true">⚖</span>
          <span>같은 상태 매물끼리만 비교 — 진짜 싼 매물만</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
          <span className="text-zinc-600 dark:text-zinc-400">
            사용감 있는 매물끼리, 미개봉 매물끼리 비교
            {stats && stats.caughtToday > 0 ? (
              <span className="ml-1 text-amber-700 dark:text-amber-300">
                · 오늘 {stats.caughtToday.toLocaleString("ko-KR")}건 잡힘
              </span>
            ) : null}
          </span>
          <Link
            href="/plans"
            className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline dark:text-emerald-300"
          >
            <ZapIcon className="h-3 w-3" />
            대기 없이 즉시 받기 →
          </Link>
        </div>
      </div>

      {/* 필터/정렬 — sticky bar (당근식). Wave 370: 마진/패딩 압축 (모바일 화면 좁음). */}
      <div className="sticky top-0 z-20 -mx-3 mb-2 flex items-center gap-1.5 overflow-x-auto bg-[#f6f1e8]/95 px-3 py-1.5 backdrop-blur dark:bg-zinc-950/95 sm:-mx-6 sm:px-6">
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

      {/* Wave 382: budget fallback 안내 — 사용자 prefs와 응답 appliedBudget 다를 때만 표시 */}
      {preferences && appliedBudget && preferences.budget !== "unlimited" && appliedBudget !== preferences.budget ? (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-xs dark:border-amber-900/60 dark:bg-amber-950/30">
          <span className="text-base leading-none">💡</span>
          <div className="min-w-0 flex-1 leading-5 text-amber-900 dark:text-amber-200">
            <b className="font-bold">{BUDGET_OPTIONS.find((o) => o.value === preferences.budget)?.label}</b> 매물이 부족해서{" "}
            <b className="font-bold">{BUDGET_OPTIONS.find((o) => o.value === appliedBudget)?.label}</b>로 준비했어요.
          </div>
          <button
            type="button"
            onClick={() => {
              setDraftBudget(preferences.budget);
              setDraftPreference(preferences.preference);
              setEditingPrefs(true);
              setRefreshModalOpen(true);
            }}
            className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 transition hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200"
          >
            예산 수정
          </button>
        </div>
      ) : null}

      {/* 로딩 / 에러 / 매물 grid */}
      {loading ? (
        <div className="-mx-3 divide-y divide-zinc-100 dark:divide-zinc-800 sm:mx-0 sm:grid sm:grid-cols-2 sm:divide-y-0 sm:gap-3 lg:grid-cols-3">
          {/* Wave 370: 6 → 3 (모바일 viewport 잔해 줄임, 빠른 fade-in 체감) */}
          {Array.from({ length: 3 }).map((_, i) => (
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
        // Wave 370 + 381: preferences 적용 결과 빈 경우 명확화. 예산 수정 유도.
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-8 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
          <HourglassIcon className="mx-auto h-8 w-8 text-amber-600 dark:text-amber-300" />
          {preferences && preferences.budget !== "unlimited" ? (
            <>
              <p className="mt-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {BUDGET_OPTIONS.find((o) => o.value === preferences.budget)?.label} 매물이 부족해요
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                예산을 조금 늘리거나 잠시 후 다시 와주세요.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDraftBudget(preferences.budget);
                  setDraftPreference(preferences.preference);
                  setEditingPrefs(true);
                  setRefreshModalOpen(true);
                }}
                className="mt-3 rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
              >
                예산 수정하기
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                잠시 후 다시 와주세요
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                매물 분석 중이에요. 곧 새 풀이 풀려요.
              </p>
            </>
          )}
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
              onClick={() => {
                if (canRefresh) {
                  void loadPool(true);
                } else {
                  setRefreshModalOpen(true);
                }
              }}
              className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white"
            >
              <SearchIcon className="mr-1 inline h-3 w-3" />
              더 찾아보기
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
                  : `${formatCooldown(remainingSec)} 후 새 매물 자동으로 풀려요`}
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
      {/* Wave 390: "다른 매물 찾기" → "더 찾아보기".
          canRefresh이면 모달 X, 직접 loadPool(true) — 자연스럽게 append.
          !canRefresh면 cooldown 모달 (카톡/즉시받기/대기). */}
      {!loading && items.length > 0 ? (
        <div className="sticky bottom-4 z-20 mt-4 flex justify-center px-4 sm:mt-6 sm:px-0">
          <button
            type="button"
            onClick={() => {
              if (canRefresh) {
                void loadPool(true);
              } else {
                setRefreshModalOpen(true);
              }
            }}
            disabled={refreshing}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--brand-accent-strong)] px-6 py-3.5 text-base font-bold text-[var(--brand-cream)] shadow-[0_20px_44px_rgba(34,49,39,0.38),0_4px_12px_rgba(34,49,39,0.20)] ring-1 ring-white/10 transition active:scale-[0.97] hover:translate-y-[-1px] hover:shadow-[0_24px_48px_rgba(34,49,39,0.42)] sm:min-h-0 sm:py-3 sm:text-sm sm:shadow-[0_16px_34px_rgba(34,49,39,0.32)]"
          >
            <SearchIcon className="h-4 w-4" />
            {refreshing ? "받는 중..." : "더 찾아보기"}
          </button>
        </div>
      ) : null}

      {/* Wave 348+358: Refresh Modal — bottom sheet slide-up + 위계 강조 + 사이트 톤. */}
      {refreshModalOpen ? (
        <div
          className={`fixed inset-0 z-40 flex transition-opacity duration-200 ${
            awaitingInitialPrefs
              ? "items-stretch justify-stretch bg-[var(--brand-cream)] sm:items-center sm:justify-center sm:bg-black/60 sm:p-6 sm:backdrop-blur-sm dark:bg-zinc-900 sm:dark:bg-black/60"
              : "items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6"
          } ${
            refreshModalAnimating ? "opacity-100" : "opacity-0"
          }`}
          onClick={awaitingInitialPrefs ? undefined : closeRefreshModal}
        >
          <div
            className={`relative w-full transform transition-all duration-300 ease-out ${
              awaitingInitialPrefs
                ? "h-dvh max-w-none border-0 bg-[var(--brand-cream)] shadow-none dark:bg-zinc-900 sm:h-auto sm:max-w-md sm:rounded-3xl sm:border sm:border-zinc-200/50 sm:shadow-[0_-20px_60px_rgba(0,0,0,0.30)] sm:dark:border-zinc-800"
                : "max-w-md border border-zinc-200/50 bg-[var(--brand-cream)] shadow-[0_-20px_60px_rgba(0,0,0,0.30)] dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-3xl rounded-t-3xl"
            } ${
              refreshModalAnimating
                ? "translate-y-0 opacity-100 sm:scale-100"
                : awaitingInitialPrefs
                  ? "opacity-0 sm:translate-y-4 sm:scale-95"
                  : "translate-y-full opacity-0 sm:translate-y-4 sm:scale-95"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모바일 grab handle — lightweight 모드일 땐 숨김 (full-screen이라 sheet 표시 X) */}
            {!awaitingInitialPrefs ? (
              <div className="flex justify-center pt-3 sm:hidden">
                <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              </div>
            ) : null}

            <div className={awaitingInitialPrefs
              ? "flex h-full flex-col justify-center px-6 py-10 sm:h-auto sm:py-8"
              : "px-6 pt-5 pb-6 sm:pt-6"
            }>
              {/* Wave 374+376: personalization 모달.
                  - awaitingInitialPrefs (가입 직후): 예산만 (성향 chips 숨김, default balanced)
                  - editingPrefs / preferences X: 예산 + 성향 풀폼
                  - preferences O & cooldown: ready/cooldown */}
              {(() => {
                const showForm = !preferences || editingPrefs;
                const lightweightMode = awaitingInitialPrefs; // 가입 직후 = 예산만
                const headerTitle = showForm
                  ? (lightweightMode ? "환영해요 👋 예산 알려주세요" : (preferences ? "선호 수정" : "내 매물 취향 알려주세요"))
                  : "더 찾아보기";
                const headerSub = showForm
                  ? (lightweightMode ? "그 예산 안에서 30개 골라드릴게요 (나중에 수정 가능)" : "예산과 매물 성향에 맞춰 30개 골라드려요")
                  : (canRefresh
                      ? "현재 선호로 새 30개 받기"
                      : `${formatCooldown(remainingSec)} 후 자동으로 풀려요`);
                return (
                  <>
                    {/* Wave 380: 노션 톤 — 큰 👋 + "환영해요!" + 본 메시지. */}
                    {lightweightMode ? (
                      <div className="mb-6">
                        <button
                          type="button"
                          onClick={closeRefreshModal}
                          className="absolute right-4 top-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          aria-label="건너뛰기"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                        {/* 큰 손 이모지 — 노션 onboarding 톤 */}
                        <div className="text-5xl leading-none" style={{ animation: "explore-fade-up 360ms ease-out both" }}>
                          👋
                        </div>
                        <div className="mt-3 text-base font-bold text-zinc-900 dark:text-zinc-50" style={{ animation: "explore-fade-up 360ms ease-out 60ms both" }}>
                          환영해요!
                        </div>
                        <div className="mt-3 text-[26px] font-bold leading-[1.25] tracking-tight text-zinc-900 dark:text-zinc-50" style={{ animation: "explore-fade-up 360ms ease-out 120ms both" }}>
                          내가 살 만한 매물만<br />보여드릴게요
                        </div>
                        <div className="mt-3 text-sm font-medium leading-6 text-zinc-500 dark:text-zinc-400" style={{ animation: "explore-fade-up 360ms ease-out 180ms both" }}>
                          예산 알려주시면 그 안에서<br />30개 골라드릴게요. 나중에 수정 가능.
                        </div>
                      </div>
                    ) : (
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{headerTitle}</div>
                          <div className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">{headerSub}</div>
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
                    )}

                    {showForm ? (
                      <>
                        <div className="mb-4" style={lightweightMode ? { animation: "explore-fade-up 360ms ease-out 240ms both" } : undefined}>
                          {!lightweightMode ? (
                            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">예산</div>
                          ) : null}
                          <div className="grid grid-cols-2 gap-2">
                            {BUDGET_OPTIONS.map((opt) => {
                              const active = draftBudget === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setDraftBudget(opt.value)}
                                  className={`rounded-2xl border-2 px-3 ${lightweightMode ? "py-4" : "py-2.5"} text-sm font-bold transition active:scale-[0.98] ${
                                    active
                                      ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-[0_2px_8px_rgba(16,185,129,0.18)] dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200"
                                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Wave 376: lightweight 모드 (가입 직후)일 땐 성향 chips 숨김.
                            성향은 default balanced로 들어가고, 사용자가 나중에 "수정" 클릭 시 추가 가능. */}
                        {!lightweightMode ? (
                          <div className="mb-4">
                            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">매물 성향</div>
                            <div className="grid grid-cols-3 gap-2">
                              {PREFERENCE_OPTIONS.map((opt) => {
                                const active = draftPreference === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setDraftPreference(opt.value)}
                                    className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 transition ${
                                      active
                                        ? "border-emerald-500 bg-emerald-50 shadow-[0_2px_8px_rgba(16,185,129,0.18)] dark:border-emerald-600 dark:bg-emerald-950/40"
                                        : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900/40"
                                    }`}
                                  >
                                    <span className="text-lg leading-none">{opt.emoji}</span>
                                    <span className={`text-sm font-bold ${active ? "text-emerald-800 dark:text-emerald-200" : "text-zinc-800 dark:text-zinc-200"}`}>
                                      {opt.label}
                                    </span>
                                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">{opt.sub}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => {
                            const newPrefs: UserPreferences = { budget: draftBudget, preference: draftPreference };
                            savePreferences(newPrefs);
                            setPreferences(newPrefs);
                            setEditingPrefs(false);
                            // Wave 390: 폼 답 = cooldown 시작 X (가입 보너스). refresh=false로 fetch.
                            // 첫 "더 찾아보기" 클릭에서 cooldown 시작됨.
                            if (canRefresh) {
                              void loadPool(false, newPrefs);
                            }
                            closeRefreshModal();
                          }}
                          className={`w-full rounded-2xl bg-[var(--brand-accent-strong)] px-5 ${lightweightMode ? "py-4 text-base" : "py-3.5 text-base"} font-bold text-[var(--brand-cream)] shadow-[0_12px_28px_rgba(34,49,39,0.28)] transition hover:shadow-[0_16px_34px_rgba(34,49,39,0.34)] active:scale-[0.99]`}
                          style={lightweightMode ? { animation: "explore-fade-up 360ms ease-out 300ms both" } : undefined}
                        >
                          {lightweightMode
                            ? "이 예산으로 30개 받기"
                            : canRefresh
                              ? (preferences ? "수정하고 새 30개 받기" : "내 취향대로 30개 받기")
                              : "수정 저장"}
                        </button>
                        {lightweightMode ? (
                          <button
                            type="button"
                            onClick={closeRefreshModal}
                            className="mt-3 w-full text-center text-sm font-medium text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                            style={{ animation: "explore-fade-up 360ms ease-out 360ms both" }}
                          >
                            건너뛰기
                          </button>
                        ) : null}
                        {editingPrefs ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPrefs(false);
                              if (preferences) {
                                setDraftBudget(preferences.budget);
                                setDraftPreference(preferences.preference);
                              }
                            }}
                            className="mt-2 w-full text-center text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                          >
                            취소
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900/40">
                          <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            <TargetIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="font-bold">{BUDGET_OPTIONS.find((o) => o.value === preferences!.budget)?.label}</span>
                            <span className="text-zinc-300 dark:text-zinc-700">·</span>
                            <span className="font-bold">
                              {PREFERENCE_OPTIONS.find((o) => o.value === preferences!.preference)?.emoji}{" "}
                              {PREFERENCE_OPTIONS.find((o) => o.value === preferences!.preference)?.label}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setDraftBudget(preferences!.budget);
                              setDraftPreference(preferences!.preference);
                              setEditingPrefs(true);
                            }}
                            className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200"
                          >
                            수정
                          </button>
                        </div>

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
                                <span className="text-base font-bold">내 취향대로 30개 받기</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${canRefresh ? "bg-white/20 text-[var(--brand-cream)]" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>
                                  무료
                                </span>
                              </div>
                              <div className={`mt-1.5 text-xs font-medium ${canRefresh ? "text-[var(--brand-cream)]/75" : "text-zinc-500 dark:text-zinc-500"}`}>
                                {canRefresh ? "예산 + 성향 적용해서 새 30개" : `${formatCooldown(remainingSec)} 후 자동으로 풀려요`}
                              </div>
                            </div>
                            {canRefresh ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 transition group-hover:translate-x-0.5">
                                <path d="M5 12h14M13 5l7 7-7 7" />
                              </svg>
                            ) : null}
                          </div>
                        </button>

                        {!canRefresh ? (
                          <>
                            {/* Wave 384 (placeholder): 카카오톡 공유 → 30개 즉시 받기. App Key + DB migration 필요해서 일단 UI만 + "곧 출시". */}
                            {/* Wave 385: 정통 카카오 노란 (#fbe300) 배경 + 갈색 텍스트 (#3b1e1e).
                                Wave 386: 카피 명확화 — 친구 가입 무관, 공유만으로 reward. */}
                            <button
                              type="button"
                              onClick={() => {
                                // TODO Wave 384 phase 2: Kakao.Share.sendDefault + POST /api/packs/pool/share-bonus
                                alert("카카오톡 공유 보너스는 곧 출시예요! 조금만 기다려주세요 🙏");
                              }}
                              className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl bg-[#fbe300] px-5 py-4 text-left shadow-[0_4px_14px_rgba(251,227,0,0.35)] transition hover:bg-[#fae100] active:scale-[0.99]"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <KakaoLogo className="h-7 w-7 shrink-0 rounded-[8px]" />
                                <div className="min-w-0">
                                  <div className="text-base font-bold text-[#3b1e1e]">
                                    공유만 해도 즉시 득템 더 보기
                                  </div>
                                  <div className="mt-0.5 text-[11px] font-medium text-[#3b1e1e]/70">
                                    친구가 가입 안 해도 OK · 공유 클릭 1번
                                  </div>
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full bg-[#3b1e1e] px-2 py-0.5 text-[10px] font-bold text-[#fbe300]">
                                무료
                              </span>
                            </button>

                            {/* Wave 386: amber → 밝은 emerald. 카피 변경. chip "구독" 작게 유지 (paywall 인지) + 클릭 시 plans. */}
                            <Link
                              href="/plans"
                              className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl bg-emerald-500 px-5 py-4 text-left shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition hover:bg-emerald-600 active:scale-[0.99]"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-white/20">
                                  <ZapIcon className="h-4 w-4 text-white" />
                                </span>
                                <div className="min-w-0">
                                  <div className="text-base font-bold text-white">
                                    지금 바로 득템 더 보기
                                  </div>
                                  <div className="mt-0.5 text-[11px] font-medium text-white/85">
                                    대기 없이 즉시 + 신규 매물 알림
                                  </div>
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                                PRO
                              </span>
                            </Link>
                          </>
                        ) : null}
                      </>
                    )}
                  </>
                );
              })()}
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
