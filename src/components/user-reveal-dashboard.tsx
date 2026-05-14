"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PackRevealModal, { type RevealResult } from "@/components/pack-reveal-modal";
import { PACK_REVEALS_UPDATED_EVENT, type PackRevealsUpdatedDetail } from "@/lib/pack-events";
import type { PackBand, RevealCard, RevealFeedbackType, RevealListingDetail, RevealMarketBasis, RevealVelocityBasis } from "@/lib/pack-open";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type RevealItem = {
  pid: number;
  name: string;
  url: string;
  price: number;
  favoriteCount: number | null;
  freeShipping: boolean;
  descriptionPreview: string;
  sellerUid: string | null;
  sellerName: string | null;
  sellerReviewRating: number | null;
  sellerReviewCount: number;
  skuId: string | null;
  thumbnailUrl: string | null;
  skuName: string | null;
  comparableKey: string | null;
  listingState: string;
  saleStatus: string;
  expectedProfitMin: number;
  expectedProfitMax: number;
  confidence: number;
  band: PackBand;
  revealedAt: string;
  linkClickedAt: string | null;
  feedbackType: string | null;
  feedbackNote: string | null;
  // Wave 89: 모달에 카드팩과 동일한 시세/velocity/flow 표시
  marketBasis: RevealMarketBasis | null;
  velocityBasis: RevealVelocityBasis | null;
  skuListingFlow: { count24h: number; avgPerDay7d: number } | null;
};

type DashboardResponse = {
  userRef: string;
  reveals: RevealItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type RevealSort = "latest" | "oldest" | "price_low" | "price_high" | "profit_low" | "profit_high";
type RevealViewMode = "grid" | "list";

const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: RevealSort; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
  { value: "price_low", label: "가격 낮은순" },
  { value: "price_high", label: "가격 높은순" },
  { value: "profit_high", label: "수익 높은순" },
  { value: "profit_low", label: "수익 낮은순" },
];

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function timeLabel(value: string) {
  try {
    return new Date(value).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function storedDescriptionPreview(value: string) {
  const clean = value.trim();
  if (!clean) return "저장된 상세 설명이 아직 없습니다.";
  return clean.length >= 180 ? `${clean.replace(/\s+$/g, "")}\n\n...` : clean;
}

export default function UserRevealDashboard({ userRef }: { userRef: string }) {
  const [items, setItems] = useState<RevealItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<RevealViewMode>("grid");
  const [sort, setSort] = useState<RevealSort>("latest");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedItem, setSelectedItem] = useState<RevealItem | null>(null);
  const [selectedPreviewMode, setSelectedPreviewMode] = useState<"listing" | "guide">("listing");
  const [selectedPreviewSeed, setSelectedPreviewSeed] = useState<string | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const previewSeedCounterRef = useRef(0);

  const loadItems = useCallback(async (options?: { silent?: boolean }) => {
    if (!userRef) return;
    const supabase = getSupabaseBrowserClient();
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("로그인이 필요해요.");
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
        sort,
      });
      if (query) params.set("q", query);
      const res = await fetch(`/api/packs/me?${params.toString()}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-user-ref": userRef,
        },
        cache: "no-store",
      });
      const dashboardData = (await res.json()) as DashboardResponse | { error?: string };
      if (!res.ok) throw new Error("error" in dashboardData ? dashboardData.error : "내 후보 로드 실패");
      const nextData = dashboardData as DashboardResponse;
      setItems(nextData.reveals ?? []);
      setTotal(Number(nextData.total ?? 0));
      setTotalPages(Math.max(1, Number(nextData.totalPages ?? 1)));
      if (Number.isFinite(nextData.page) && nextData.page !== page) setPage(nextData.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "내 후보 로드 실패");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [page, query, sort, userRef]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setQuery(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setCurrentTimeMs(Date.now()), 0);
    const interval = window.setInterval(() => setCurrentTimeMs(Date.now()), 60_000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadItems();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadItems]);

  useEffect(() => {
    function handlePackRevealsUpdated(event: Event) {
      const detail = (event as CustomEvent<PackRevealsUpdatedDetail>).detail;
      if (!Array.isArray(detail?.reveals) || detail.reveals.length === 0) return;
      const now = new Date().toISOString();
      const nextItems: RevealItem[] = detail.reveals.map((card) => ({
        pid: card.pid,
        name: card.name,
        url: card.url,
        price: card.price,
        favoriteCount: null,
        freeShipping: false,
        descriptionPreview: "",
        sellerUid: null,
        sellerName: null,
        sellerReviewRating: null,
        sellerReviewCount: 0,
        skuId: card.skuId ?? null,
        thumbnailUrl: card.thumbnailUrl,
        skuName: card.skuName,
        comparableKey: card.marketBasis.comparableKey,
        listingState: "active",
        saleStatus: "",
        expectedProfitMin: card.expectedProfitMin,
        expectedProfitMax: card.expectedProfitMax,
        confidence: card.confidence,
        band: detail.band,
        revealedAt: now,
        linkClickedAt: null,
        feedbackType: null,
        feedbackNote: null,
        marketBasis: card.marketBasis,
        velocityBasis: card.velocityBasis,
        skuListingFlow: card.skuListingFlow ?? null,
      }));
      setItems((prevItems) => {
        if (query || sort !== "latest") return prevItems;
        const incomingPids = new Set(nextItems.map((item) => item.pid));
        return [...nextItems, ...prevItems.filter((item) => !incomingPids.has(item.pid))].slice(0, PAGE_SIZE);
      });
      setPage(1);
      void loadItems({ silent: true });
    }

    window.addEventListener(PACK_REVEALS_UPDATED_EVENT, handlePackRevealsUpdated);
    return () => window.removeEventListener(PACK_REVEALS_UPDATED_EVENT, handlePackRevealsUpdated);
  }, [loadItems, query, sort]);

  const modalResult: RevealResult | null = useMemo(() => {
    if (!selectedItem) return null;
    const revealedAtMs = new Date(selectedItem.revealedAt).getTime();
    // Wave 89: marketBasis/velocityBasis/skuListingFlow는 서버에서 실시간 fetch한 값 사용.
    // 서버 fetch 실패하면 fallback (comparableKey만 있는 빈 marketBasis).
    const marketBasis = selectedItem.marketBasis ?? {
      comparableKey: selectedItem.comparableKey,
      label: selectedItem.skuName ?? selectedItem.name,
      p25Price: null,
      medianPrice: null,
      p75Price: null,
      sampleCount: 0,
      activeSampleCount: 0,
      soldSampleCount: 0,
      disappearedSampleCount: 0,
      confidence: null,
      computedAt: null,
      excludedExamples: [],
    };
    const revealCard: RevealCard = {
      pid: selectedItem.pid,
      name: selectedItem.name,
      url: selectedItem.url,
      price: selectedItem.price,
      skuId: selectedItem.skuId,
      skuName: selectedItem.skuName ?? selectedItem.name,
      thumbnailUrl: selectedItem.thumbnailUrl,
      expectedProfitMin: selectedItem.expectedProfitMin,
      expectedProfitMax: selectedItem.expectedProfitMax,
      confidence: selectedItem.confidence,
      marketBasis,
      velocityBasis: selectedItem.velocityBasis,
      lastVerifiedAt: selectedItem.revealedAt,
      freshSeconds: Number.isFinite(revealedAtMs) && currentTimeMs > 0 ? Math.max(0, Math.floor((currentTimeMs - revealedAtMs) / 1000)) : 0,
      savedDetail: {
        descriptionPreview: storedDescriptionPreview(selectedItem.descriptionPreview),
        favoriteCount: selectedItem.favoriteCount,
        freeShipping: selectedItem.freeShipping,
        sellerName: selectedItem.sellerName,
        sellerReviewRating: selectedItem.sellerReviewRating,
        sellerReviewCount: selectedItem.sellerReviewCount,
      },
      skuListingFlow: selectedItem.skuListingFlow ?? undefined,
    };
    return {
      result: "success",
      reveals: [revealCard],
      attemptedCount: 1,
      durationMs: 0,
    };
  }, [currentTimeMs, selectedItem]);

  async function fetchWithAuth(path: string, body: object) {
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("로그인이 필요해요.");
    return fetch(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-user-ref": userRef,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  }

  async function handleLoadDetail(pid: number): Promise<RevealListingDetail> {
    const fallbackItem = selectedItem?.pid === pid ? selectedItem : items.find((item) => item.pid === pid);
    try {
      const res = await fetchWithAuth("/api/packs/reveals/detail", { pid });
      const detailData = (await res.json()) as { detail?: RevealListingDetail; error?: string };
      if (!res.ok || !detailData.detail) throw new Error(detailData.error ?? "상세 정보 요청 실패");
      return detailData.detail;
    } catch (err) {
      if (!fallbackItem) throw err;
      return {
        pid,
        description: storedDescriptionPreview(fallbackItem.descriptionPreview),
        saleStatus: fallbackItem.saleStatus,
        conditionLabel: null,
        thumbnailUrl: fallbackItem.thumbnailUrl,
        imageUrls: fallbackItem.thumbnailUrl ? [fallbackItem.thumbnailUrl] : [],
        metrics: {
          viewCount: null,
          favoriteCount: fallbackItem.favoriteCount,
          commentCount: null,
        },
        seller: {
          uid: fallbackItem.sellerUid,
          name: fallbackItem.sellerName,
          reviewRating: fallbackItem.sellerReviewRating,
          reviewCount: fallbackItem.sellerReviewCount,
          followerCount: 0,
          salesCount: 0,
          proshop: false,
          officialSeller: false,
          joinDate: null,
        },
        shippingOptions: fallbackItem.freeShipping ? [{ kind: "free", amount: 0 }] : [],
        shippingSummary: fallbackItem.freeShipping ? "무료배송" : "-",
      };
    }
  }

  function handleLinkClicked(pid: number) {
    if (!userRef) return;
    void fetchWithAuth("/api/packs/reveals/click", { pid }).catch(() => undefined);
  }

  function handleFeedback(pid: number, feedbackType: RevealFeedbackType, note?: string) {
    if (!userRef) return;
    void fetchWithAuth("/api/packs/reveals/feedback", { pid, feedbackType, note }).catch(() => undefined);
  }

  function openItem(item: RevealItem, mode: "listing" | "guide") {
    previewSeedCounterRef.current += 1;
    setSelectedItem(item);
    setSelectedPreviewMode(mode);
    setSelectedPreviewSeed(`${item.pid}:${mode}:${previewSeedCounterRef.current}`);
  }

  const firstIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastIndex = Math.min(total, page * PAGE_SIZE);
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  }, [page, totalPages]);

  function ActionButtons({ item }: { item: RevealItem }) {
    const actionBase = "inline-flex h-9 min-w-[76px] items-center justify-center rounded-lg px-3 text-xs font-black leading-none transition";
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openItem(item, "listing")}
          className={`${actionBase} bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] hover:bg-[#29382f]`}
        >
          다시 보기
        </button>
        <button
          type="button"
          onClick={() => openItem(item, "guide")}
          className={`${actionBase} border border-[#d5dfd2] bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)] hover:border-[#b9c9b9] hover:bg-[#edf3ea]`}
        >
          공략 보기
        </button>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className={`${actionBase} border border-[#d5dfd2] bg-[#fffaf1] text-[var(--brand-accent-strong)] hover:border-[#b9c9b9] hover:bg-[#edf3ea] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800`}
        >
          상품 보기
        </a>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-[#ddd4c7] bg-[#fffbf4] p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-black text-[#223127] dark:text-zinc-100">최근 본 추천 상품</div>
          <div className="mt-1 text-xs text-[#6b7269] dark:text-zinc-400">현재 로그인 계정 기준 추천 기록만 검색합니다.</div>
        </div>
        <div className="rounded-full bg-[#eef6ec] px-3 py-1 text-xs font-black text-[var(--brand-accent-strong)] dark:bg-zinc-800 dark:text-zinc-200">
          {loading ? "로딩" : `${total.toLocaleString("ko-KR")}건`}
        </div>
      </div>

      {error ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div> : null}

      <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(180px,1fr)_150px_132px]">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="상품명, PID, 모델명 검색"
          className="h-11 rounded-xl border border-[#ddd4c7] bg-[#fffaf1] px-3 text-sm font-semibold text-[#223127] outline-none transition placeholder:text-[#9a9389] focus:border-[var(--brand-accent)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <select
          value={sort}
          onChange={(event) => {
            setPage(1);
            setSort(event.target.value as RevealSort);
          }}
          className="h-11 rounded-xl border border-[#ddd4c7] bg-[#fffaf1] px-3 text-sm font-black text-[#344136] outline-none transition focus:border-[var(--brand-accent)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="grid h-11 grid-cols-2 rounded-xl border border-[#ddd4c7] bg-[#fffaf1] p-1 dark:border-zinc-700 dark:bg-zinc-950">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`rounded-lg text-xs font-black transition ${viewMode === "grid" ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)]" : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
          >
            카드
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-lg text-xs font-black transition ${viewMode === "list" ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)]" : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
          >
            목록
          </button>
        </div>
      </div>

      {!loading && total > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[#6b7269] dark:text-zinc-400">
          <div>
            {firstIndex.toLocaleString("ko-KR")}~{lastIndex.toLocaleString("ko-KR")} / {total.toLocaleString("ko-KR")}개
          </div>
          <div>20개씩 보기</div>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        // 첫 로딩 스켈레톤 — items 비어있을 때만 표시. 검색/페이지 전환 시에는 기존 items 유지.
        <div className={viewMode === "grid" ? "mt-4 grid gap-3 md:grid-cols-2" : "mt-4 grid gap-2"}>
          {Array.from({ length: 6 }).map((_, i) => (
            <article
              key={`skeleton-${i}`}
              className={
                viewMode === "grid"
                  ? "grid animate-pulse grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-xl border border-[#e5dccf] bg-[#fffdf9] p-2 dark:border-zinc-800 dark:bg-zinc-950/40"
                  : "grid animate-pulse grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-xl border border-[#e5dccf] bg-[#fffdf9] p-2 dark:border-zinc-800 dark:bg-zinc-950/40"
              }
              aria-hidden
            >
              <div className="aspect-square rounded-lg bg-[#ece3d6] dark:bg-zinc-800" />
              <div className="min-w-0 space-y-2 py-1">
                <div className="h-3.5 w-4/5 rounded bg-[#ece3d6] dark:bg-zinc-800" />
                <div className="h-3 w-2/3 rounded bg-[#ece3d6] dark:bg-zinc-800" />
                <div className="h-3 w-1/3 rounded bg-[#ece3d6] dark:bg-zinc-800" />
                {viewMode === "grid" ? (
                  <div className="mt-1 flex gap-2 pt-1">
                    <div className="h-7 w-16 rounded bg-[#ece3d6] dark:bg-zinc-800" />
                    <div className="h-7 w-16 rounded bg-[#ece3d6] dark:bg-zinc-800" />
                    <div className="h-7 w-16 rounded bg-[#ece3d6] dark:bg-zinc-800" />
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className={viewMode === "grid" ? "mt-4 grid gap-3 md:grid-cols-2" : "mt-4 grid gap-2"}>
        {items.map((item) => (
          <article
            key={item.pid}
            className={
              viewMode === "grid"
                ? "grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-xl border border-[#e5dccf] bg-[#fffdf9] p-2 transition hover:border-[#b9c9b9] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/20"
                : "grid grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-xl border border-[#e5dccf] bg-[#fffdf9] p-2 transition hover:border-[#b9c9b9] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/20 lg:grid-cols-[56px_minmax(0,1fr)_auto]"
            }
          >
            <div className="relative aspect-square overflow-hidden rounded-lg bg-[#f1eadf] dark:bg-zinc-800">
              {item.thumbnailUrl ? (
                <Image
                  src={item.thumbnailUrl}
                  alt={item.name}
                  fill
                  sizes="64px"
                  unoptimized
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-[#223127] dark:text-zinc-100">{item.name}</div>
              <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-semibold text-[#6b7269] dark:text-zinc-400">
                <span>{krw(item.price)}</span>
                <span>·</span>
                <span>{timeLabel(item.revealedAt)}</span>
                <span>·</span>
                <span>{item.listingState}</span>
              </div>
              <div className="mt-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                +{item.expectedProfitMin.toLocaleString("ko-KR")}~{item.expectedProfitMax.toLocaleString("ko-KR")}원
              </div>
              {item.feedbackType ? (
                <div className="mt-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                  피드백: {item.feedbackType}{item.feedbackNote ? ` · ${item.feedbackNote}` : ""}
                </div>
              ) : null}
              {viewMode === "grid" ? <ActionButtons item={item} /> : null}
            </div>
            {viewMode === "list" ? <div className="self-center"><ActionButtons item={item} /></div> : null}
          </article>
        ))}
      </div>

      {!loading && totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            이전
          </button>
          {pageNumbers.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              className={`h-9 min-w-9 rounded-xl px-3 text-xs font-black transition ${pageNumber === page ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)]" : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"}`}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            다음
          </button>
        </div>
      ) : null}

      {!loading && total === 0 ? (
        <div className="mt-4 rounded-xl bg-[#fffaf1] p-4 text-center text-xs text-[#6b7269] dark:bg-zinc-950 dark:text-zinc-400">
          {query ? "검색 결과가 없습니다." : "아직 본 추천 상품이 없습니다."}
        </div>
      ) : null}
      <PackRevealModal
        open={Boolean(selectedItem && modalResult)}
        band={selectedItem?.band ?? 2}
        loading={false}
        result={modalResult}
        initialPreviewCard={modalResult?.result === "success" ? modalResult.reveals[0] ?? null : null}
        initialPreviewMode={selectedPreviewMode}
        initialPreviewSeed={selectedPreviewSeed}
        onClose={() => {
          setSelectedItem(null);
          setSelectedPreviewMode("listing");
          setSelectedPreviewSeed(null);
        }}
        onLinkClicked={handleLinkClicked}
        onFeedback={handleFeedback}
        onLoadDetail={handleLoadDetail}
        onRetry={() => {
          setSelectedItem(null);
          setSelectedPreviewMode("listing");
          setSelectedPreviewSeed(null);
        }}
      />
    </section>
  );
}
