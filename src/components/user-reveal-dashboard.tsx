"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PackRevealModal, { type RevealResult } from "@/components/pack-reveal-modal";
import { ConditionChip } from "@/components/condition-chip";
import { BunjangSourceBadge, DanawaSourceBadge } from "@/components/market-brand-logo";
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
  // Wave 216: /me 목록은 marketBasis 중심. velocity/flow는 상품 보기 상세 호출 때 lazy-fill.
  marketBasis: RevealMarketBasis | null;
  velocityBasis: RevealVelocityBasis | null;
  skuListingFlow: { count24h: number; avgPerDay7d: number } | null;
  // Wave 182 Phase 3 (2026-05-17): base option fallback — "기본 옵션 가정" UI badge.
  optionBaseAssumed: string[] | null;
  // Wave 213 (2026-05-18): 실시간 순현재차익 min/max.
  // Wave 224: marketStale=true는 사용자 화면에서 "판매완료" tombstone으로 접는다.
  marketGapKrw: number | null;
  marketGapKrwMax: number | null;
  marketStale: boolean;
};

type DashboardResponse = {
  userRef: string;
  reveals: RevealItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type RevealDetailResponse = {
  detail?: RevealListingDetail;
  analysis?: Partial<Pick<RevealItem, "marketBasis" | "velocityBasis" | "skuListingFlow" | "optionBaseAssumed">>;
  error?: string;
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

// 2026-05-18: /me terminal rows are user-facing tombstones. Hidden/deleted/reported-like
// disappearance is displayed as sold completed, without exposing internal removal reasons.
function listingStateLabel(state: string): { label: string; tone: "active" | "sold" | "unknown" } {
  const s = (state ?? "").toLowerCase();
  if (s === "sold" || s === "sold_confirmed" || s === "disappeared") return { label: "판매완료", tone: "sold" };
  if (s === "active") return { label: "판매중", tone: "active" };
  return { label: state || "상태 미확인", tone: "unknown" };
}

function listingStateChipClass(tone: "active" | "sold" | "unknown"): string {
  if (tone === "sold") return "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200";
  if (tone === "active") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

function isUserFacingClosed(item: RevealItem) {
  return listingStateLabel(item.listingState).tone === "sold" || item.marketStale;
}

function closedReasonText(item: RevealItem) {
  if (listingStateLabel(item.listingState).tone === "sold") {
    return "추천 당시 매물이 현재 판매완료되어 더 이상 열람할 수 없어요.";
  }
  return "현재 시세로는 매입 후 남는 차익이 없어 판매완료 상품으로 정리했어요.";
}

function storedDescriptionPreview(value: string) {
  const clean = value.trim();
  if (!clean) return "저장된 상세 설명이 아직 없습니다.";
  return clean.length >= 180 ? `${clean.replace(/\s+$/g, "")}\n\n...` : clean;
}

function signedKrw(value: number) {
  const rounded = Math.round(value);
  const sign = rounded >= 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("ko-KR")}원`;
}

function signedProfitRange(min: number, max: number) {
  const roundedMin = Math.round(min);
  const roundedMax = Math.round(max);
  if (roundedMin === roundedMax) return signedKrw(roundedMax);
  return `${signedKrw(roundedMin)}~${signedKrw(roundedMax)}`;
}

function currentProfitMinOrSnapshot(item: RevealItem) {
  return item.marketGapKrw ?? item.expectedProfitMin;
}

function currentProfitMaxOrSnapshot(item: RevealItem) {
  return item.marketGapKrwMax ?? item.marketGapKrw ?? item.expectedProfitMax;
}

function currentProfitAverage(item: RevealItem) {
  return Math.round((currentProfitMinOrSnapshot(item) + currentProfitMaxOrSnapshot(item)) / 2);
}

function profitPercent(item: RevealItem) {
  if (!item.price || item.price <= 0) return null;
  const profit = currentProfitAverage(item);
  const pct = Math.round((profit / item.price) * 100);
  return Number.isFinite(pct) ? pct : null;
}

export default function UserRevealDashboard({ userRef, welcomePending = false }: { userRef: string; welcomePending?: boolean }) {
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
  const [newlyRevealedPids, setNewlyRevealedPids] = useState<Set<number>>(new Set());
  const highlightClearTimerRef = useRef<number | null>(null);
  // 2026-05-17: 매물 선택 + 삭제 (선택/전체 모드).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  // Wave 205 (2026-05-18): terminal 매물도 개수 유지. 기본은 판매완료 tombstone 표시.
  const [hideTerminal, setHideTerminal] = useState(false);
  // Wave 182c: 정보 오류 신고 모달 state (loss_report 는 보류, inaccurate_report 박힘).
  // state 이름은 호환 위해 lossReport* 유지 — 의미는 inaccurate_report.
  const [lossReportItem, setLossReportItem] = useState<RevealItem | null>(null);
  const [lossReportNote, setLossReportNote] = useState("");
  const [lossReportCategory, setLossReportCategory] = useState<string | null>(null);
  const [lossReportSubmitting, setLossReportSubmitting] = useState(false);
  const [lossReportResult, setLossReportResult] = useState<{ ok: boolean; message: string; compensation?: number } | null>(null);

  const loadItems = useCallback(async (options?: { silent?: boolean; page?: number; query?: string; sort?: RevealSort }) => {
    if (!userRef) return;
    const supabase = getSupabaseBrowserClient();
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("로그인이 필요해요.");
      const requestedPage = options?.page ?? page;
      const requestedQuery = options?.query ?? query;
      const requestedSort = options?.sort ?? sort;
      const params = new URLSearchParams({
        page: requestedPage.toString(),
        pageSize: PAGE_SIZE.toString(),
        sort: requestedSort,
      });
      if (requestedQuery) params.set("q", requestedQuery);
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
      // Wave 106: raw err.message 노출 차단. 서버에서 박힌 sanitized error code도 한국어로 정규화.
      console.error("[user-reveal-dashboard] load failed", err);
      setError("내 후보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [page, query, sort, userRef]);
  const loadItemsRef = useRef(loadItems);

  useEffect(() => {
    loadItemsRef.current = loadItems;
  }, [loadItems]);

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

  // 2026-05-17 fix: welcomePending true → false 전환 시 silent reload.
  // 이유: welcome dispatch event 가 listener 등록 전에 fire 되거나 미스 됐을 때 fallback.
  // pending false 됐는데 화면 비어있으면 사용자가 새로고침해야 됨 → 자동 reload 로 차단.
  const prevWelcomePendingRef = useRef<boolean>(welcomePending);
  useEffect(() => {
    if (prevWelcomePendingRef.current && !welcomePending) {
      void loadItems({ silent: true });
    }
    prevWelcomePendingRef.current = welcomePending;
  }, [welcomePending, loadItems]);

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
        // Wave 182 Phase 3 (2026-05-17): base option fallback metadata.
        optionBaseAssumed: card.optionBaseAssumed ?? null,
        // Wave 213: optimistic add도 pool의 net expected profit을 사용한다. silent reload 후 server response가 source of truth.
        marketGapKrw: Math.round(card.expectedProfitMin),
        marketGapKrwMax: Math.round(card.expectedProfitMax),
        marketStale: card.expectedProfitMin <= 0,
      }));
      const incomingPids = new Set(nextItems.map((item) => item.pid));
      setSearchInput("");
      setQuery("");
      setSort("latest");
      setItems((prevItems) => {
        return [...nextItems, ...prevItems.filter((item) => !incomingPids.has(item.pid))].slice(0, PAGE_SIZE);
      });
      setTotal((prevTotal) => Math.max(nextItems.length, prevTotal + nextItems.length));
      setPage(1);
      setNewlyRevealedPids(incomingPids);
      if (highlightClearTimerRef.current !== null) window.clearTimeout(highlightClearTimerRef.current);
      highlightClearTimerRef.current = window.setTimeout(() => {
        setNewlyRevealedPids(new Set());
        highlightClearTimerRef.current = null;
      }, 12_000);
      window.setTimeout(() => {
        document.getElementById("my-reveals-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      void loadItemsRef.current({ silent: true, page: 1, query: "", sort: "latest" });
    }

    window.addEventListener(PACK_REVEALS_UPDATED_EVENT, handlePackRevealsUpdated);
    return () => {
      window.removeEventListener(PACK_REVEALS_UPDATED_EVENT, handlePackRevealsUpdated);
      if (highlightClearTimerRef.current !== null) window.clearTimeout(highlightClearTimerRef.current);
    };
  }, []);

  const modalResult: RevealResult | null = useMemo(() => {
    if (!selectedItem) return null;
    const revealedAtMs = new Date(selectedItem.revealedAt).getTime();
    // Wave 216: 목록 응답은 가볍게 받고, 상품 보기 상세 호출 후 velocity/flow를 채운다.
    // 상세 분석 fetch 전에는 fallback (comparableKey만 있는 빈 marketBasis).
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
      priceSource: "market" as const,
      computedAt: null,
      excludedExamples: [],
      // Wave 130 (2026-05-16): condition별 시세 분리 — 사업 보고서 L2. fallback marketBasis empty default.
      conditionClass: null,
      conditionLabel: null,
      fallbackUsed: false,
      otherConditions: [],
    };
    const revealCard: RevealCard = {
      pid: selectedItem.pid,
      name: selectedItem.name,
      url: selectedItem.url,
      price: selectedItem.price,
      skuId: selectedItem.skuId,
      skuName: selectedItem.skuName ?? selectedItem.name,
      thumbnailUrl: selectedItem.thumbnailUrl,
      expectedProfitMin: currentProfitMinOrSnapshot(selectedItem),
      expectedProfitMax: currentProfitMaxOrSnapshot(selectedItem),
      confidence: selectedItem.confidence,
      // 2026-05-17: 모달 카드에 band chip 표시 (운영자풀과 동일 UX).
      band: (selectedItem.band ?? null) as 1 | 2 | 3 | null,
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
      optionBaseAssumed: selectedItem.optionBaseAssumed ?? null,
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

  // 2026-05-17: 매물 삭제 handlers.
  function togglePid(pid: number) {
    setSelectedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedPids(new Set(visibleItems.map((i) => i.pid)));
  }

  function clearSelection() {
    setSelectedPids(new Set());
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedPids(new Set());
  }

  async function deleteSelected() {
    if (selectedPids.size === 0 || deleting) return;
    setDeleting(true);
    try {
      const res = await fetchWithAuth("/api/packs/reveals/delete", { pids: Array.from(selectedPids) });
      if (!res.ok) throw new Error("삭제 실패");
      exitSelectMode();
      await loadItems({ silent: true });
    } catch (err) {
      console.error("[user-reveal-dashboard] delete failed", err);
      setError("삭제에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteOne(pid: number) {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetchWithAuth("/api/packs/reveals/delete", { pids: [pid] });
      if (!res.ok) throw new Error("삭제 실패");
      setItems((prev) => prev.filter((item) => item.pid !== pid));
      setSelectedPids((prev) => {
        if (!prev.has(pid)) return prev;
        const next = new Set(prev);
        next.delete(pid);
        return next;
      });
      setTotal((prev) => Math.max(0, prev - 1));
      await loadItems({ silent: true });
    } catch (err) {
      console.error("[user-reveal-dashboard] delete one failed", err);
      setError("숨기기에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteAll() {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetchWithAuth("/api/packs/reveals/delete", { all: true });
      if (!res.ok) throw new Error("전체 삭제 실패");
      setShowDeleteAllConfirm(false);
      exitSelectMode();
      await loadItems({ silent: true });
    } catch (err) {
      console.error("[user-reveal-dashboard] delete all failed", err);
      setError("전체 삭제에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleLoadDetail(pid: number): Promise<RevealListingDetail> {
    const fallbackItem = selectedItem?.pid === pid ? selectedItem : items.find((item) => item.pid === pid);
    try {
      const res = await fetchWithAuth("/api/packs/reveals/detail", { pid });
      const detailData = (await res.json()) as RevealDetailResponse;
      if (!res.ok || !detailData.detail) throw new Error(detailData.error ?? "상세 정보 요청 실패");
      if (detailData.analysis) {
        const applyAnalysis = (item: RevealItem): RevealItem => ({
          ...item,
          marketBasis: detailData.analysis?.marketBasis ?? item.marketBasis,
          velocityBasis: detailData.analysis?.velocityBasis ?? item.velocityBasis,
          skuListingFlow: detailData.analysis?.skuListingFlow ?? item.skuListingFlow,
          optionBaseAssumed: detailData.analysis?.optionBaseAssumed ?? item.optionBaseAssumed,
        });
        setItems((prev) => prev.map((item) => (item.pid === pid ? applyAnalysis(item) : item)));
        setSelectedItem((prev) => (prev?.pid === pid ? applyAnalysis(prev) : prev));
      }
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

  // Wave 182c: 정보 오류 신고 — inaccurate_report endpoint (즉시 토큰 +3 + 운영자 검수 큐).
  async function submitLossReport() {
    if (!lossReportItem || !userRef) return;
    if (!lossReportCategory) {
      setLossReportResult({ ok: false, message: "어떤 오류인지 카테고리를 골라주세요." });
      return;
    }
    setLossReportSubmitting(true);
    setLossReportResult(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("로그인이 필요해요.");
      const res = await fetch("/api/packs/reveals/inaccurate-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-user-ref": userRef,
        },
        body: JSON.stringify({
          pid: lossReportItem.pid,
          category: lossReportCategory,
          note: lossReportNote.trim(),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; compensationTokens?: number; error?: string };
      if (!res.ok || !json.ok) {
        setLossReportResult({
          ok: false,
          message: json.message ?? "신고 접수에 실패했어요. 잠시 후 다시 시도해주세요.",
        });
      } else {
        setLossReportResult({
          ok: true,
          message: json.message ?? "신고 접수됨.",
          compensation: json.compensationTokens ?? 0,
        });
      }
    } catch (err) {
      console.error("[inaccurate-report] submit failed", err);
      setLossReportResult({ ok: false, message: "신고 접수에 실패했어요." });
    } finally {
      setLossReportSubmitting(false);
    }
  }

  function closeLossReportModal() {
    setLossReportItem(null);
    setLossReportNote("");
    setLossReportCategory(null);
    setLossReportResult(null);
    setLossReportSubmitting(false);
  }

  // Wave 182c: 카테고리 옵션 (API VALID_CATEGORIES 와 sync).
  const INACCURATE_CATEGORIES = [
    { value: "price", label: "💰 시세 부정확", hint: "표시된 시세가 실제와 다름" },
    { value: "info", label: "📋 매물 정보 다름", hint: "옵션/색상/용량/모델 다름" },
    { value: "sold", label: "🚫 이미 판매됨", hint: "들어가니 판매완료/사라짐" },
    { value: "fake_price", label: "🎣 가짜 가격 의심", hint: "사진/설명과 가격 매치 안 됨" },
    { value: "other", label: "✏️ 기타", hint: "위 카테고리 외" },
  ];

  function openItem(item: RevealItem, mode: "listing" | "guide") {
    if (isUserFacingClosed(item)) return;
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
  const visibleItems = useMemo(() => items.filter((item) => {
    if (!hideTerminal) return true;
    return !isUserFacingClosed(item);
  }), [hideTerminal, items]);
  const dashboardSummary = useMemo(() => {
    const terminalCount = items.filter((item) => isUserFacingClosed(item)).length;
    const marketClosedCount = items.filter((item) => item.marketStale && listingStateLabel(item.listingState).tone !== "sold").length;
    const activeItems = visibleItems.filter((item) => !isUserFacingClosed(item));
    const avgProfit = activeItems.length > 0
      ? Math.round(activeItems.reduce((sum, item) => sum + currentProfitAverage(item), 0) / activeItems.length)
      : 0;
    return {
      visibleCount: visibleItems.length,
      activeCount: activeItems.length,
      terminalCount,
      marketClosedCount,
      avgProfit,
    };
  }, [items, visibleItems]);
  useEffect(() => {
    if (!hideTerminal || selectedPids.size === 0) return;
    const visiblePidSet = new Set(visibleItems.map((item) => item.pid));
    setSelectedPids((prev) => {
      const next = new Set(Array.from(prev).filter((pid) => visiblePidSet.has(pid)));
      return next.size === prev.size ? prev : next;
    });
  }, [hideTerminal, selectedPids.size, visibleItems]);

  return (
    <section id="my-reveals-list" className="rounded-2xl border border-[#ddd4c7] bg-[#fffbf4] p-4 shadow-sm scroll-mt-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-base font-black text-[#223127] dark:text-zinc-100">내 추천 보관함</div>
          <div className="mt-1 text-xs font-semibold text-[#6b7269] dark:text-zinc-400">현재 시세와 판매 상태를 다시 맞춘 추천 기록입니다.</div>
        </div>
        <div className="flex items-center gap-2">
          {/* 2026-05-17: 선택 모드 토글 + 전체 삭제. */}
          {!selectMode ? (
            <>
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                disabled={items.length === 0}
                className="rounded-full border border-[#ddd4c7] bg-white px-3 py-1 text-xs font-bold text-[#344136] hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                선택
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteAllConfirm(true)}
                disabled={total === 0 || deleting}
                className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900 dark:bg-zinc-900 dark:text-rose-300"
              >
                전체 삭제
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={exitSelectMode}
              className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-bold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              취소
            </button>
          )}
          <div className="rounded-full bg-[#eef6ec] px-3 py-1 text-xs font-black text-[var(--brand-accent-strong)] dark:bg-zinc-800 dark:text-zinc-200">
            {loading ? "로딩" : `${total.toLocaleString("ko-KR")}건`}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#e5dccf] bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a8276] dark:text-zinc-500">표시 중</div>
          <div className="mt-1 text-xl font-black tabular-nums text-[#223127] dark:text-zinc-100">{dashboardSummary.visibleCount.toLocaleString("ko-KR")}건</div>
          {dashboardSummary.terminalCount > 0 ? (
            <div className="mt-0.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
              판매완료 {dashboardSummary.terminalCount.toLocaleString("ko-KR")}건 포함
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">판매중</div>
          <div className="mt-1 text-xl font-black tabular-nums text-emerald-800 dark:text-emerald-200">{dashboardSummary.activeCount.toLocaleString("ko-KR")}건</div>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">평균 차익</div>
          <div className="mt-1 text-xl font-black tabular-nums text-amber-900 dark:text-amber-100">{signedKrw(dashboardSummary.avgProfit)}</div>
        </div>
        <div className={`rounded-xl border px-3 py-2.5 ${
          dashboardSummary.marketClosedCount > 0
            ? "border-zinc-300 bg-zinc-50/90 dark:border-zinc-700 dark:bg-zinc-900/50"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40"
        }`}>
          <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${
            dashboardSummary.marketClosedCount > 0 ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-500 dark:text-zinc-500"
          }`}>시세 마감</div>
          <div className={`mt-1 text-xl font-black tabular-nums ${
            dashboardSummary.marketClosedCount > 0 ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"
          }`}>{dashboardSummary.marketClosedCount.toLocaleString("ko-KR")}건</div>
        </div>
      </div>

      {/* Wave 182c: 정보 오류 신고 모달 — 카테고리 chip + optional 사유 + 즉시 토큰 +3.
          이전 (182): "손해 신고 — 5자 이상 사유 필수". 임계값 높아 신고 어려움.
          현재: 카테고리만 골라도 제출 가능 (사유 optional). 사용자 자연 수집 → algorithm 보정 source. */}
      {lossReportItem && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4" onClick={closeLossReportModal}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            {lossReportResult?.ok ? (
              <>
                <div className="flex items-center gap-2 text-base font-black text-emerald-700 dark:text-emerald-300">
                  신고 접수됨
                </div>
                <div className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                  {lossReportResult.message}
                </div>
                {lossReportResult.compensation && lossReportResult.compensation > 0 ? (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                    토큰 +{lossReportResult.compensation}개 즉시 지급
                  </div>
                ) : null}
                <div className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                  운영자가 24시간 안에 검토하고 알고리즘에 반영합니다. 비슷한 매물의 시세/정보가 자동 보정됩니다.
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={closeLossReportModal}
                    className="rounded-lg bg-[var(--brand-accent-strong)] px-4 py-2 text-sm font-black text-[var(--brand-cream)]"
                  >
                    확인
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-black text-zinc-900 dark:text-zinc-100">
                  토큰 +3 받기 · 정보 오류 신고
                </div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  매물: <span className="font-bold">{lossReportItem.name}</span>
                </div>
                <div className="mt-3 text-[12px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  어떤 부정확 정보를 발견했나요? 카테고리만 골라도 신고 가능 — 즉시 토큰 <b>3개 보상</b>.
                </div>

                {/* 카테고리 chip — 클릭으로 선택 */}
                <div className="mt-3 grid grid-cols-1 gap-1.5">
                  {INACCURATE_CATEGORIES.map((cat) => {
                    const active = lossReportCategory === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setLossReportCategory(cat.value)}
                        className={`flex items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-left text-xs font-bold transition ${
                          active
                            ? "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600"
                        }`}
                      >
                        <span>{cat.label}</span>
                        <span className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">{cat.hint}</span>
                      </button>
                    );
                  })}
                </div>

                {/* optional 사유 */}
                <textarea
                  value={lossReportNote}
                  onChange={(e) => setLossReportNote(e.target.value)}
                  placeholder="자세한 상황 (선택) — 예: 표시 시세 87만인데 실제 매물 60만대"
                  rows={2}
                  className="mt-3 w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  maxLength={1000}
                />

                {lossReportResult?.message && !lossReportResult.ok ? (
                  <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                    {lossReportResult.message}
                  </div>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeLossReportModal}
                    disabled={lossReportSubmitting}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={submitLossReport}
                    disabled={lossReportSubmitting || !lossReportCategory}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {lossReportSubmitting ? "신고 중..." : "신고하고 토큰 +3 받기"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 전체 삭제 confirm 모달 */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDeleteAllConfirm(false)}>
          <div className="m-4 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-black text-zinc-900 dark:text-zinc-100">전체 삭제 하시겠어요?</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              내 모든 추천 상품 기록 {total.toLocaleString("ko-KR")}건이 삭제됩니다. (복구 불가)
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteAllConfirm(false)}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                취소
              </button>
              <button
                type="button"
                onClick={deleteAll}
                disabled={deleting}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? "삭제 중..." : "전체 삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 선택 모드 하단 floating actions bar */}
      {selectMode && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
              {selectedPids.size}개 선택됨
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllVisible}
                disabled={visibleItems.length === 0}
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                현재 페이지 전체
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={selectedPids.size === 0}
                className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                선택 해제
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                disabled={selectedPids.size === 0 || deleting}
                className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? "삭제 중..." : `${selectedPids.size}개 삭제`}
              </button>
            </div>
          </div>
        </div>
      )}

      {error ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div> : null}

      <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(220px,1fr)_160px_140px]">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="상품명, PID, 모델명 검색"
          className="h-11 rounded-xl border border-[#ddd4c7] bg-white px-3 text-sm font-semibold text-[#223127] outline-none transition placeholder:text-[#9a9389] focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <select
          value={sort}
          onChange={(event) => {
            setPage(1);
            setSort(event.target.value as RevealSort);
          }}
          className="h-11 rounded-xl border border-[#ddd4c7] bg-white px-3 text-sm font-black text-[#344136] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="grid h-11 grid-cols-2 rounded-xl border border-[#ddd4c7] bg-white p-1 dark:border-zinc-700 dark:bg-zinc-950">
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

      {/* Wave 205 (2026-05-18): terminal 매물은 기본 표시. 사용자가 원하면 숨길 수만 있다. */}
      {(() => {
        const terminalCount = items.filter((item) => isUserFacingClosed(item)).length;
        if (terminalCount === 0) return null;
        return (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
            <span className="text-zinc-700 dark:text-zinc-300">
              판매완료된 상품 <b>{terminalCount}건</b>을 기록으로 남겨뒀어요.
              {dashboardSummary.marketClosedCount > 0 ? (
                <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                  시세상 차익이 사라진 상품 {dashboardSummary.marketClosedCount}건 포함.
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => setHideTerminal((v) => !v)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-black transition ${
                hideTerminal
                  ? "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              }`}
            >
              {hideTerminal ? `보기 (${terminalCount})` : "숨기기"}
            </button>
          </div>
        );
      })()}

      <div className={viewMode === "grid" ? "mt-4 grid gap-3 md:grid-cols-2" : "mt-4 grid gap-2"}>
        {visibleItems.map((item) => {
          // 2026-05-18: 판매완료/삭제/숨김 계열은 동일한 판매완료 tombstone으로 표시.
          // Wave 224/234: 현재 순차익이 0원 이하이면 사용자 화면에서는 판매완료로 접는다.
          // DB listing_state를 sold로 위조하지는 않는다. marketStale은 시세 재계산 결과이므로
          // 표본이 다시 쌓여 양수로 돌아오면 다음 /me 갱신 때 정상 카드로 복귀할 수 있다.
          const stateInfo = listingStateLabel(item.listingState);
          const isTerminal = isUserFacingClosed(item);
          const isNewlyRevealed = newlyRevealedPids.has(item.pid);
          if (isTerminal) {
            const displayStateInfo = stateInfo.tone === "sold" ? stateInfo : { label: "판매완료", tone: "sold" as const };
            return (
              <article
                key={item.pid}
                onClick={selectMode ? () => togglePid(item.pid) : undefined}
                className={`relative ${
                  viewMode === "grid"
                    ? "grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-2.5 transition dark:border-zinc-800 dark:bg-zinc-900/50"
                    : "grid grid-cols-[60px_minmax(0,1fr)] gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-2.5 transition dark:border-zinc-800 dark:bg-zinc-900/50 lg:grid-cols-[60px_minmax(0,1fr)]"
                } ${
                  selectMode && selectedPids.has(item.pid)
                    ? "border-rose-400 bg-rose-50 ring-2 ring-rose-300 dark:border-rose-700 dark:bg-rose-950/30"
                    : ""
                } ${selectMode ? "cursor-pointer" : ""}`}
              >
                {selectMode && (
                  <div className="absolute left-2 top-2 z-10">
                    <input
                      type="checkbox"
                      checked={selectedPids.has(item.pid)}
                      onChange={() => togglePid(item.pid)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-5 w-5 rounded border-2 border-rose-400 accent-rose-600"
                    />
                  </div>
                )}
                <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="absolute inset-x-3 top-4 h-2 rounded bg-zinc-200 dark:bg-zinc-700" />
                  <div className="absolute inset-x-3 top-8 h-2 rounded bg-zinc-200/80 dark:bg-zinc-700/80" />
                  <div className="absolute bottom-3 left-3 h-5 w-10 rounded bg-zinc-200 dark:bg-zinc-700" />
                </div>
                <div className="min-w-0 self-center">
                  <div className="flex items-start gap-1.5">
                    <div className="min-w-0 flex-1 truncate text-sm font-black text-zinc-700 dark:text-zinc-200">
                      판매완료된 상품
                    </div>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${listingStateChipClass(displayStateInfo.tone)}`}>
                      {displayStateInfo.label}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    {closedReasonText(item)}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                    {timeLabel(item.revealedAt)}
                  </div>
                  {!selectMode ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteOne(item.pid);
                      }}
                      disabled={deleting}
                      className="mt-2 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[10px] font-black text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      숨기기
                    </button>
                  ) : null}
                </div>
              </article>
            );
          }
          return (
          <article
            key={item.pid}
            onClick={selectMode ? () => togglePid(item.pid) : () => openItem(item, "listing")}
            onKeyDown={(event) => {
              if (selectMode) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openItem(item, "listing");
              }
            }}
            role={selectMode ? undefined : "button"}
            tabIndex={selectMode ? undefined : 0}
            aria-label={`${item.name} 상세 보기`}
            className={`relative ${
              viewMode === "grid"
                ? "grid grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-xl border bg-[#fffdf9] p-2.5 transition dark:bg-zinc-950/40"
                : "grid grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-xl border bg-[#fffdf9] p-2.5 transition dark:bg-zinc-950/40"
            } ${
              selectMode && selectedPids.has(item.pid)
                ? "border-rose-400 bg-rose-50 ring-2 ring-rose-300 dark:border-rose-700 dark:bg-rose-950/30"
                : isNewlyRevealed
                  ? "border-rose-400 bg-rose-50/70 shadow-[0_0_0_4px_rgba(244,63,94,0.12),0_18px_38px_rgba(244,63,94,0.18)] ring-2 ring-rose-300 dark:border-rose-700 dark:bg-rose-950/20 dark:ring-rose-700/70"
                : isTerminal
                  ? "border-zinc-200 bg-zinc-50/70 opacity-75 dark:border-zinc-800 dark:bg-zinc-900/40"
                  : "border-[#e5dccf] hover:border-[#b9c9b9] hover:bg-[var(--brand-accent-soft)] focus-visible:border-[#8ca88c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]/30 dark:border-zinc-800 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/20"
            } ${selectMode ? "cursor-pointer" : "cursor-pointer"}`}
          >
            {/* 2026-05-17: 선택 모드 체크박스 */}
            {selectMode && (
              <div className="absolute left-2 top-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedPids.has(item.pid)}
                  onChange={() => togglePid(item.pid)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-5 w-5 rounded border-2 border-rose-400 accent-rose-600"
                />
              </div>
            )}
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
              <div className="flex items-start gap-1.5">
                <div className="min-w-0 flex-1 truncate text-[15px] font-black leading-5 text-[#223127] dark:text-zinc-100">{item.name}</div>
                {isNewlyRevealed ? (
                  <span className="shrink-0 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm">
                    방금 추가
                  </span>
                ) : null}
                {/* 2026-05-17: 매물 등급 chip (S/A/B/C) — 운영자풀/사용자 reveal 통일. */}
                <ConditionChip conditionClass={item.marketBasis?.conditionClass ?? null} />
              </div>
              {/* 2026-05-17: 매입 · 시세 표시 (대시보드 패턴 통일 — 운영자풀/preview 와 동일). */}
              {/* Wave 200 (2026-05-18): terminal 매물 시 strike-through — 정보 stale 명시. */}
              <div className={`mt-1 flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold ${
                isTerminal ? "text-zinc-400 line-through decoration-zinc-400 dark:text-zinc-500" : "text-[#6b7269] dark:text-zinc-400"
              }`}>
                <span>매입 <span className={`font-black tabular-nums ${isTerminal ? "" : "text-[#223127] dark:text-zinc-100"}`}>{krw(item.price)}</span></span>
                {item.marketBasis?.medianPrice && item.marketBasis.medianPrice > 0 ? (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-600 no-underline">·</span>
                    <span>시세 <span className={`font-black tabular-nums ${isTerminal ? "" : "text-[#223127] dark:text-zinc-100"}`}>{krw(item.marketBasis.medianPrice)}</span></span>
                    {/* Wave 207: only show Danawa when the reference anchor was actually used. */}
                    {!isTerminal && item.marketBasis.priceSource === "reference" ? (
                      <span className="ml-1" title="다나와 새 가격 anchor — 이 매물 미개봉">
                        <DanawaSourceBadge />
                      </span>
                    ) : !isTerminal && item.marketBasis.conditionClass === "mint" ? (
                      <span className="ml-1" title="번개 S급 매물 median">
                        <BunjangSourceBadge label="번개 S급" />
                      </span>
                    ) : null}
                  </>
                ) : null}
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span>{timeLabel(item.revealedAt)}</span>
                {/* 2026-05-17 (사용자 요청): listing_state 명시 표시. terminal 매물도 사라지지 않게. */}
                {(() => {
                  const { label, tone } = listingStateLabel(item.listingState);
                  return (
                    <>
                      <span>·</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${listingStateChipClass(tone)}`}>
                        {label}
                      </span>
                    </>
                  );
                })()}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50/70 px-2.5 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                {/* Wave 194 (2026-05-18): current_profit 박혀있으면 그 값 우선 표시. snapshot 과
                    다르면 부가 라벨 ("추천 당시 +57K → 현재 +10K"). marketStale=true는 Wave 224에서
                    이 블록에 오기 전에 판매완료 tombstone으로 접는다. */}
                {(() => {
                  const hasCurrent = item.marketGapKrw != null;
                  const displayProfitMin = currentProfitMinOrSnapshot(item);
                  const displayProfitMax = currentProfitMaxOrSnapshot(item);
                  const displayProfitAvg = Math.round((displayProfitMin + displayProfitMax) / 2);
                  const snapshotProfitAvg = Math.round((item.expectedProfitMin + item.expectedProfitMax) / 2);
                  const profitDiverged = hasCurrent && Math.abs(displayProfitAvg - snapshotProfitAvg) >= 5000;
                  const pct = profitPercent(item);
                  return (
                    <>
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                        현재 차익
                      </span>
                      <span className="text-lg font-black tabular-nums text-emerald-800 dark:text-emerald-200">
                        {signedProfitRange(displayProfitMin, displayProfitMax)}
                      </span>
                      {pct != null ? (
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-black tabular-nums text-amber-800 ring-1 ring-amber-100 dark:bg-zinc-900/50 dark:text-amber-200 dark:ring-amber-900/50">
                          {pct >= 0 ? "+" : ""}{pct}%
                        </span>
                      ) : null}
                      {profitDiverged && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" title={`추천 당시 ${signedProfitRange(item.expectedProfitMin, item.expectedProfitMax)} → 현재 ${signedProfitRange(displayProfitMin, displayProfitMax)}`}>
                          ↓ 시세 갱신
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              {item.feedbackType ? (
                <div className="mt-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                  피드백: {item.feedbackType}{item.feedbackNote ? ` · ${item.feedbackNote}` : ""}
                </div>
              ) : null}
            </div>
          </article>
          );
        })}
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
        query ? (
          <div className="mt-4 rounded-xl bg-[#fffaf1] p-4 text-center text-xs text-[#6b7269] dark:bg-zinc-950 dark:text-zinc-400">
            검색 결과가 없습니다.
          </div>
        ) : welcomePending ? (
          // 2026-05-17 fix: 작은 1줄 텍스트 → 큰 안내 박스 + 스켈레톤 grid. 사용자 보고
          // "갑자기 스켈레톤 없어지고 작은 글씨 보여서 당황" → 페이지 로딩 스켈레톤과
          // 자연스럽게 이어지게 콘텐츠 영역도 스켈레톤 + 가시적 spinner + 안내.
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-[#e2d9cb] bg-[#fffaf1] px-5 py-5 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="inline-flex items-center gap-2.5 text-base font-black text-[#223127] dark:text-zinc-100 sm:text-lg">
                <svg className="h-5 w-5 animate-spin text-[#5d735f] dark:text-emerald-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                가입 환영 매물 준비 중
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#5a6658] dark:text-zinc-400">
                첫 추천 매물 4개를 골라서 가져오고 있어요. 잠시만 기다려주세요.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-[#f1eadf] dark:bg-zinc-800/60" />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-[#fffaf1] p-4 text-center text-xs text-[#6b7269] dark:bg-zinc-950 dark:text-zinc-400">
            아직 본 추천 상품이 없습니다.
          </div>
        )
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
        // Wave 182b: 손해 신고 — 매물 상세 모달 안 1곳에만 박음. 카드 list 에선 빠짐.
        // Wave 182c: 이미 inaccurate_report 박힌 매물은 비활성. (loss_report 보류 → 체크 안 함)
        alreadyReportedLoss={selectedItem?.feedbackType === "inaccurate_report"}
        onReportLoss={() => {
          if (!selectedItem) return;
          const itemRef = selectedItem;
          // Wave 219: 신고는 현재 상품 모달 위에 얹는다. 기존 모달을 닫으면 사용자가
          // 어떤 상품을 신고 중인지 맥락을 잃는다.
          setLossReportItem(itemRef);
          setLossReportNote("");
          setLossReportResult(null);
        }}
      />
    </section>
  );
}
