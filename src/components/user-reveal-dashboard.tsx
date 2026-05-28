"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PackRevealModal, { type RevealResult } from "@/components/pack-reveal-modal";
import { ConditionPhotoBadge, ConditionTierChip, ConditionChipsList } from "@/components/condition-chip";
import { CategoryWatermark } from "@/components/category-watermark";
import { BookmarkIcon } from "@/components/icons";
import { BunjangSourceBadge, DanawaSourceBadge, MarketplaceSourceBadge } from "@/components/market-brand-logo";
import { SkuImageLockBadge } from "@/components/sku-image-lock-badge";
import { PACK_REVEALS_UPDATED_EVENT, type PackRevealsUpdatedDetail } from "@/lib/pack-events";
import type { PackBand, RevealCard, RevealFeedbackType, RevealListingDetail, RevealMarketBasis, RevealVelocityBasis } from "@/lib/pack-open";
import { expectedProfitFromMarketPrice } from "@/lib/profit";
import { buyPriceGuidance, verdictUiLabel } from "@/lib/buy-price-guidance";
import { categoryFromComparableKey } from "@/lib/category-readiness";
import { detectBrandDepth } from "@/lib/category-brand-depth";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type RevealItem = {
  pid: number;
  name: string;
  url: string;
  marketplaceSource: string;
  marketplaceLabel: string;
  price: number;
  favoriteCount: number | null;
  freeShipping: boolean;
  descriptionPreview: string;
  imageCount: number | null;
  sellerUid: string | null;
  sellerName: string | null;
  sellerReviewRating: number | null;
  sellerReviewCount: number;
  joongnaTrustScore?: number | null;
  joongnaSafeOrderSalesCount?: number | null;
  joongnaSafeOrderSalesText?: string | null;
  daangnMannerTemperature?: number | null;
  daangnReviewCount?: number | null;
  productTradeType?: number | null;
  parcelFeeYn?: number | null;
  tradeLabels?: string[];
  transactionMode?: string | null;
  shippingAssumption?: string | null;
  skuId: string | null;
  thumbnailUrl: string | null;
  genericImageUrl: string | null;
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
  transactionFeedbackType: string | null;
  transactionFeedbackNote: string | null;
  reportFeedbackType: string | null;
  reportFeedbackNote: string | null;
  saved: boolean;
  // Wave 216: /me 목록은 marketBasis 중심. velocity/flow는 상품 보기 상세 호출 때 lazy-fill.
  marketBasis: RevealMarketBasis | null;
  velocityBasis: RevealVelocityBasis | null;
  skuListingFlow: { count24h: number; avgPerDay7d: number } | null;
  // 2026-05-20 P0-Upload: 셀러 업로드 시점 (number-friendly first_seen_at).
  firstSeenAt: string | null;
  // Wave 182 Phase 3 (2026-05-17): base option fallback — "기본 옵션 가정" UI badge.
  optionBaseAssumed: string[] | null;
  // Wave 213 (2026-05-18): 실시간 순현재차익 min/max.
  // Wave 224: marketStale=true는 사용자 화면에서 "판매완료" tombstone으로 접는다.
  marketGapKrw: number | null;
  marketGapKrwMax: number | null;
  marketStale: boolean;
  commentCount: number | null;
  // Wave 714d (2026-05-23): 신발/의류 5-tier S/A/B/C/D + chips.
  conditionTier?: string | null;
  conditionCluster?: string | null;
  conditionConfidence?: number | null;
  conditionFlags?: Record<string, unknown> | null;
  conditionChips?: string[] | null;
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
type TransactionFeedbackType = Extract<RevealFeedbackType, "contacted" | "bought" | "passed" | "inspected" | "listed" | "resold">;
type ReportFeedbackType = Extract<RevealFeedbackType, "loss_report" | "inaccurate_report">;

const PAGE_SIZE = 20;
const REVEAL_DETAIL_QUERY_KEY = "reveal";
const REVEAL_DETAIL_MODE_QUERY_KEY = "preview";

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
    // Wave launch-28.b: timeZone 명시 (Asia/Seoul) — SSR/hydration mismatch + UTC 표시 방지.
    return new Date(value).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
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
  if (tone === "active") return "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

const TRANSACTION_FEEDBACK_LABEL: Record<TransactionFeedbackType, string> = {
  contacted: "문의함",
  bought: "매수함",
  passed: "포기함",
  inspected: "검수 완료",
  listed: "판매 등록",
  resold: "판매 완료",
};

const REPORT_FEEDBACK_LABEL: Record<ReportFeedbackType, string> = {
  loss_report: "손해 신고 완료",
  inaccurate_report: "정보 신고 완료",
};

function isTransactionFeedbackType(value: string | null | undefined): value is TransactionFeedbackType {
  return value === "contacted"
    || value === "bought"
    || value === "passed"
    || value === "inspected"
    || value === "listed"
    || value === "resold";
}

function isReportFeedbackType(value: string | null | undefined): value is ReportFeedbackType {
  return value === "loss_report" || value === "inaccurate_report";
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

function recomputeCurrentProfitFromMarketBasis(item: RevealItem, marketBasis: RevealMarketBasis | null | undefined) {
  const market = marketBasis?.medianPrice ?? null;
  if (!market || market <= 0 || !item.price || item.price <= 0) return null;
  const assumedBuyShipping =
    item.transactionMode === "direct_only" ||
    item.shippingAssumption === "included" ||
    item.shippingAssumption === "free_shipping" ||
    item.freeShipping
      ? 0
      : 3500;
  return expectedProfitFromMarketPrice({
    buyPrice: item.price,
    marketPrice: market,
    buyShipping: assumedBuyShipping,
    marketplaceSource: item.marketplaceSource,
  });
}

function profitPercent(item: RevealItem) {
  if (!item.price || item.price <= 0) return null;
  const profit = currentProfitAverage(item);
  const pct = Math.round((profit / item.price) * 100);
  return Number.isFinite(pct) ? pct : null;
}

function isMobileDetailViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
}

function previewModeFromUrl(value: string | null): "listing" | "guide" {
  return value === "guide" ? "guide" : "listing";
}

function applyFeedbackState(item: RevealItem, feedbackType: RevealFeedbackType, note?: string): RevealItem {
  if (feedbackType === "watching") {
    return {
      ...item,
      saved: true,
      feedbackType: item.feedbackType ?? feedbackType,
      feedbackNote: item.feedbackNote ?? note ?? null,
    };
  }
  if (isTransactionFeedbackType(feedbackType)) {
    return {
      ...item,
      feedbackType: item.reportFeedbackType ?? feedbackType,
      feedbackNote: item.reportFeedbackType ? item.feedbackNote : note ?? item.feedbackNote,
      transactionFeedbackType: feedbackType,
      transactionFeedbackNote: note ?? item.transactionFeedbackNote,
    };
  }
  if (isReportFeedbackType(feedbackType)) {
    return {
      ...item,
      feedbackType,
      feedbackNote: note ?? item.feedbackNote,
      reportFeedbackType: feedbackType,
      reportFeedbackNote: note ?? item.reportFeedbackNote,
    };
  }
  return { ...item, feedbackType, feedbackNote: note ?? item.feedbackNote };
}

function applySavedState(item: RevealItem, saved: boolean): RevealItem {
  return {
    ...item,
    saved,
    feedbackType: item.feedbackType === "watching" && !saved ? null : item.feedbackType,
    feedbackNote: item.feedbackType === "watching" && !saved ? null : item.feedbackNote,
  };
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
  const pushedRevealUrlRef = useRef(false);
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
  const [lossReportResult, setLossReportResult] = useState<{ ok: boolean; message: string; compensation?: number; pendingCompensation?: number } | null>(null);

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
        marketplaceSource: card.marketplaceSource ?? "bunjang",
        marketplaceLabel: card.marketplaceLabel ?? "번개장터",
        price: card.price,
        favoriteCount: null,
        freeShipping: card.savedDetail?.freeShipping ?? false,
        descriptionPreview: card.savedDetail?.descriptionPreview ?? "",
        imageCount: card.savedDetail?.imageCount ?? null,
        sellerUid: null,
        sellerName: null,
        sellerReviewRating: card.savedDetail?.sellerReviewRating ?? null,
        sellerReviewCount: card.savedDetail?.sellerReviewCount ?? 0,
        joongnaTrustScore: card.savedDetail?.joongnaTrustScore ?? null,
        joongnaSafeOrderSalesCount: card.savedDetail?.joongnaSafeOrderSalesCount ?? null,
        joongnaSafeOrderSalesText: card.savedDetail?.joongnaSafeOrderSalesText ?? null,
        daangnMannerTemperature: card.savedDetail?.daangnMannerTemperature ?? null,
        daangnReviewCount: card.savedDetail?.daangnReviewCount ?? null,
        productTradeType: card.savedDetail?.productTradeType ?? null,
        parcelFeeYn: card.savedDetail?.parcelFeeYn ?? null,
        tradeLabels: card.savedDetail?.tradeLabels ?? [],
        transactionMode: card.savedDetail?.transactionMode ?? "unknown",
        shippingAssumption: card.savedDetail?.shippingAssumption ?? "unknown",
        skuId: card.skuId ?? null,
        thumbnailUrl: card.thumbnailUrl,
        genericImageUrl: card.genericImageUrl ?? null,
        skuName: card.skuName,
        // Wave 254.7 (2026-05-20): P0-Upload feature — firstSeenAt 필수 type 누락.
        //   reveal 이벤트 detail 에는 firstSeenAt 정보 없음 (시점 미상) → null fallback.
        firstSeenAt: null,
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
        transactionFeedbackType: null,
        transactionFeedbackNote: null,
        reportFeedbackType: null,
        reportFeedbackNote: null,
        saved: false,
        marketBasis: card.marketBasis,
        velocityBasis: card.velocityBasis,
        skuListingFlow: card.skuListingFlow ?? null,
        // Wave 182 Phase 3 (2026-05-17): base option fallback metadata.
        optionBaseAssumed: card.optionBaseAssumed ?? null,
        // Wave 213: optimistic add도 pool의 net expected profit을 사용한다. silent reload 후 server response가 source of truth.
        marketGapKrw: Math.round(card.expectedProfitMin),
        marketGapKrwMax: Math.round(card.expectedProfitMax),
        marketStale: card.expectedProfitMin <= 0,
        commentCount: null,
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
      basisSource: null,
      basisSourceLabel: null,
      sourceFallbackUsed: false,
      sourceSampleCount: null,
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
      marketplaceSource: selectedItem.marketplaceSource,
      marketplaceLabel: selectedItem.marketplaceLabel,
      price: selectedItem.price,
      skuId: selectedItem.skuId,
      skuName: selectedItem.skuName ?? selectedItem.name,
      thumbnailUrl: selectedItem.thumbnailUrl,
      genericImageUrl: selectedItem.genericImageUrl,
      expectedProfitMin: currentProfitMinOrSnapshot(selectedItem),
      expectedProfitMax: currentProfitMaxOrSnapshot(selectedItem),
      confidence: selectedItem.confidence,
      // 2026-05-17: 모달 카드에 band chip 표시 (운영자풀과 동일 UX).
      band: (selectedItem.band ?? null) as 1 | 2 | 3 | null,
      marketBasis,
      velocityBasis: selectedItem.velocityBasis,
      lastVerifiedAt: selectedItem.revealedAt,
      freshSeconds: Number.isFinite(revealedAtMs) && currentTimeMs > 0 ? Math.max(0, Math.floor((currentTimeMs - revealedAtMs) / 1000)) : 0,
      // 2026-05-20 P0-Upload: 셀러 업로드 시점 전달 (모달이 "등록 N시간 전" 표시).
      firstSeenAt: selectedItem.firstSeenAt ?? null,
      savedDetail: {
        descriptionPreview: storedDescriptionPreview(selectedItem.descriptionPreview),
        favoriteCount: selectedItem.favoriteCount,
        freeShipping: selectedItem.freeShipping,
        imageCount: selectedItem.imageCount,
        sellerName: selectedItem.sellerName,
        sellerReviewRating: selectedItem.sellerReviewRating,
        sellerReviewCount: selectedItem.sellerReviewCount,
        joongnaTrustScore: selectedItem.joongnaTrustScore ?? null,
        joongnaSafeOrderSalesCount: selectedItem.joongnaSafeOrderSalesCount ?? null,
        joongnaSafeOrderSalesText: selectedItem.joongnaSafeOrderSalesText ?? null,
        daangnMannerTemperature: selectedItem.daangnMannerTemperature ?? null,
        daangnReviewCount: selectedItem.daangnReviewCount ?? null,
        productTradeType: selectedItem.productTradeType ?? null,
        parcelFeeYn: selectedItem.parcelFeeYn ?? null,
        tradeLabels: selectedItem.tradeLabels ?? [],
        transactionMode: selectedItem.transactionMode === "direct_only" || selectedItem.transactionMode === "shipping_only" || selectedItem.transactionMode === "direct_and_shipping" ? selectedItem.transactionMode : "unknown",
        shippingAssumption: selectedItem.shippingAssumption === "direct_only" || selectedItem.shippingAssumption === "included" || selectedItem.shippingAssumption === "separate" || selectedItem.shippingAssumption === "free_shipping" ? selectedItem.shippingAssumption : "unknown",
      },
      skuListingFlow: selectedItem.skuListingFlow ?? undefined,
      optionBaseAssumed: selectedItem.optionBaseAssumed ?? null,
      // Wave 714g (2026-05-23): /me 매물 클릭 → 모달 변환 시 새 5-tier grading 누락 fix.
      //   packs/me API (Phase 2) 가 RevealItem 에 conditionTier 등 박았는데,
      //   user-reveal-dashboard 의 RevealCard 변환에서 누락 → pack-reveal-modal 의
      //   매물명 아래 ConditionTierChip 표시 X. 이제 정상 전달.
      conditionTier: selectedItem.conditionTier ?? null,
      conditionCluster: selectedItem.conditionCluster ?? null,
      conditionConfidence: selectedItem.conditionConfidence ?? null,
      conditionFlags: selectedItem.conditionFlags ?? null,
      conditionChips: selectedItem.conditionChips ?? null,
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
        const applyAnalysis = (item: RevealItem): RevealItem => {
          const marketBasis = detailData.analysis?.marketBasis ?? item.marketBasis;
          const recomputedProfit = recomputeCurrentProfitFromMarketBasis(item, marketBasis);
          return {
            ...item,
            marketBasis,
            velocityBasis: detailData.analysis?.velocityBasis ?? item.velocityBasis,
            skuListingFlow: detailData.analysis?.skuListingFlow ?? item.skuListingFlow,
            optionBaseAssumed: detailData.analysis?.optionBaseAssumed ?? item.optionBaseAssumed,
            marketGapKrw: recomputedProfit?.min ?? item.marketGapKrw,
            marketGapKrwMax: recomputedProfit?.max ?? item.marketGapKrwMax,
            marketStale: recomputedProfit ? recomputedProfit.max <= 0 : item.marketStale,
          };
        };
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
          commentCount: fallbackItem.commentCount,
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
        shippingOptions: fallbackItem.freeShipping || fallbackItem.shippingAssumption === "included" ? [{ kind: "free", amount: 0 }] : [],
        shippingSummary: fallbackItem.transactionMode === "direct_only"
          ? "0원 · 직거래만"
          : fallbackItem.shippingAssumption === "included"
            ? "0원 · 배송비 포함"
            : fallbackItem.freeShipping ? "무료배송" : "-",
        transactionMode: fallbackItem.transactionMode === "direct_only" || fallbackItem.transactionMode === "shipping_only" || fallbackItem.transactionMode === "direct_and_shipping" ? fallbackItem.transactionMode : "unknown",
        shippingAssumption: fallbackItem.shippingAssumption === "direct_only" || fallbackItem.shippingAssumption === "included" || fallbackItem.shippingAssumption === "separate" || fallbackItem.shippingAssumption === "free_shipping" ? fallbackItem.shippingAssumption : "unknown",
      };
    }
  }

  function handleLinkClicked(pid: number) {
    if (!userRef) return;
    void fetchWithAuth("/api/packs/reveals/click", { pid }).catch(() => undefined);
  }

  function handleFeedback(pid: number, feedbackType: RevealFeedbackType, note?: string) {
    if (!userRef) return;
    setItems((prev) => prev.map((item) => (
      item.pid === pid ? applyFeedbackState(item, feedbackType, note) : item
    )));
    setSelectedItem((prev) => (
      prev?.pid === pid ? applyFeedbackState(prev, feedbackType, note) : prev
    ));
    void fetchWithAuth("/api/packs/reveals/feedback", { pid, feedbackType, note }).catch(() => undefined);
  }

  function handleSaveToggle(pid: number, saved: boolean) {
    if (!userRef) return;
    setItems((prev) => prev.map((item) => (
      item.pid === pid ? applySavedState(item, saved) : item
    )));
    setSelectedItem((prev) => (
      prev?.pid === pid ? applySavedState(prev, saved) : prev
    ));
    void fetchWithAuth("/api/packs/reveals/save", { pid, saved })
      .then((res) => {
        if (!res.ok) throw new Error("save failed");
      })
      .catch((err) => {
        console.error("[user-reveal-dashboard] save toggle failed", err);
        setItems((prev) => prev.map((item) => (
          item.pid === pid ? applySavedState(item, !saved) : item
        )));
        setSelectedItem((prev) => (
          prev?.pid === pid ? applySavedState(prev, !saved) : prev
        ));
        setError("스크랩 저장 상태를 반영하지 못했어요. 잠시 후 다시 시도해주세요.");
      });
  }

  // Wave 182c/Wave 245: 정보 오류 신고 — inaccurate_report endpoint (운영자 승인 시 토큰 +3).
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
      const json = (await res.json()) as { ok?: boolean; message?: string; compensationTokens?: number; pendingCompensationTokens?: number; error?: string };
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
          pendingCompensation: json.pendingCompensationTokens ?? 0,
        });
        const reportNote = lossReportNote.trim() || "정보 오류 신고";
        setItems((prev) => prev.map((item) => (
          item.pid === lossReportItem.pid ? applyFeedbackState(item, "inaccurate_report", reportNote) : item
        )));
        setSelectedItem((prev) => (
          prev?.pid === lossReportItem.pid ? applyFeedbackState(prev, "inaccurate_report", reportNote) : prev
        ));
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

  function clearSelectedDetail() {
    setSelectedItem(null);
    setSelectedPreviewMode("listing");
    setSelectedPreviewSeed(null);
  }

  function removeRevealDetailUrl(replace = true) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete(REVEAL_DETAIL_QUERY_KEY);
    url.searchParams.delete(REVEAL_DETAIL_MODE_QUERY_KEY);
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (replace) window.history.replaceState(window.history.state, "", nextUrl);
    else window.history.pushState({}, "", nextUrl);
  }

  function openItem(item: RevealItem, mode: "listing" | "guide", options?: { pushUrl?: boolean }) {
    if (isUserFacingClosed(item)) return;
    previewSeedCounterRef.current += 1;
    if (options?.pushUrl ?? isMobileDetailViewport()) {
      const url = new URL(window.location.href);
      url.searchParams.set(REVEAL_DETAIL_QUERY_KEY, String(item.pid));
      url.searchParams.set(REVEAL_DETAIL_MODE_QUERY_KEY, mode);
      window.history.pushState({ minyoiRevealPid: item.pid }, "", `${url.pathname}${url.search}${url.hash}`);
      pushedRevealUrlRef.current = true;
    }
    setSelectedItem(item);
    setSelectedPreviewMode(mode);
    setSelectedPreviewSeed(`${item.pid}:${mode}:${previewSeedCounterRef.current}`);
  }

  const openRevealFromUrl = useCallback(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    const pid = Number(params.get(REVEAL_DETAIL_QUERY_KEY));
    if (!Number.isFinite(pid) || pid <= 0) return false;
    const item = items.find((candidate) => candidate.pid === pid);
    if (!item || isUserFacingClosed(item)) return true;
    const mode = previewModeFromUrl(params.get(REVEAL_DETAIL_MODE_QUERY_KEY));
    if (selectedItem?.pid === pid && selectedPreviewMode === mode) return true;
    previewSeedCounterRef.current += 1;
    setSelectedItem(item);
    setSelectedPreviewMode(mode);
    setSelectedPreviewSeed(`${item.pid}:${mode}:url:${previewSeedCounterRef.current}`);
    return true;
  }, [items, selectedItem?.pid, selectedPreviewMode]);

  useEffect(() => {
    void openRevealFromUrl();
  }, [openRevealFromUrl]);

  useEffect(() => {
    function handlePopState() {
      const hasReveal = openRevealFromUrl();
      if (!hasReveal) {
        pushedRevealUrlRef.current = false;
        clearSelectedDetail();
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [openRevealFromUrl]);

  function closeSelectedDetail() {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const urlPid = params?.get(REVEAL_DETAIL_QUERY_KEY);
    if (urlPid && pushedRevealUrlRef.current) {
      window.history.back();
      return;
    }
    if (urlPid) removeRevealDetailUrl(true);
    pushedRevealUrlRef.current = false;
    clearSelectedDetail();
  }

  const firstIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastIndex = Math.min(total, page * PAGE_SIZE);
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  }, [page, totalPages]);
  const visibleItems = hideTerminal ? items.filter((item) => !isUserFacingClosed(item)) : items;
  const relatedModalItems = selectedItem
    ? items
      .filter((item) => item.pid !== selectedItem.pid && !isUserFacingClosed(item))
      .slice(0, 8)
      .map((item) => ({
        pid: item.pid,
        name: item.name,
        price: item.price,
        thumbnailUrl: item.thumbnailUrl,
        genericImageUrl: item.genericImageUrl,
        expectedProfitMin: currentProfitMinOrSnapshot(item),
        expectedProfitMax: currentProfitMaxOrSnapshot(item),
        marketBasis: item.marketBasis,
        revealedAt: item.revealedAt,
      }))
    : [];
  const dashboardSummary = (() => {
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
  })();
  const hasReveals = total > 0 || items.length > 0;
  const shouldShowListTools = hasReveals || query.length > 0;
  useEffect(() => {
    if (!hideTerminal || selectedPids.size === 0) return;
    const visiblePidSet = new Set(items.filter((item) => !isUserFacingClosed(item)).map((item) => item.pid));
    setSelectedPids((prev) => {
      const next = new Set(Array.from(prev).filter((pid) => visiblePidSet.has(pid)));
      return next.size === prev.size ? prev : next;
    });
  }, [hideTerminal, items, selectedPids.size]);

  return (
    <section id="my-reveals-list" className="scroll-mt-4 px-0 sm:rounded-2xl sm:border sm:border-zinc-200 sm:bg-white sm:p-5 sm:shadow-sm sm:dark:border-zinc-800 sm:dark:bg-zinc-900">
      <div className="hidden flex-col gap-2 sm:flex sm:gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-base font-black text-zinc-950 dark:text-zinc-100">
            <span>내 추천 보관함</span>
          </div>
          <div className="mt-1 hidden text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:block">현재 시세와 판매 상태를 다시 맞춘 추천 기록입니다.</div>
        </div>
        <div className="flex items-center gap-2">
          {/* 2026-05-17: 선택 모드 토글 + 전체 삭제. */}
          {!selectMode ? (
            <>
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                disabled={items.length === 0}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold text-zinc-900 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
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

      {hasReveals ? (
        <div className="mx-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-zinc-200 bg-transparent py-2 text-[11px] font-black tabular-nums text-zinc-950 dark:border-zinc-800 dark:text-zinc-100 sm:hidden">
          <span>{loading ? "로딩" : `${total.toLocaleString("ko-KR")}건`}</span>
          <span>판매중 {dashboardSummary.activeCount.toLocaleString("ko-KR")}건</span>
          <span className="text-[#b45d19] dark:text-amber-200">평균 {signedKrw(dashboardSummary.avgProfit)}</span>
          {dashboardSummary.marketClosedCount > 0 ? (
            <span className="text-zinc-500 dark:text-zinc-300">마감 {dashboardSummary.marketClosedCount.toLocaleString("ko-KR")}건</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 hidden gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a8276] dark:text-zinc-500">표시 중</div>
          <div className="mt-1 text-xl font-black tabular-nums text-zinc-950 dark:text-zinc-100">{dashboardSummary.visibleCount.toLocaleString("ko-KR")}건</div>
          {dashboardSummary.terminalCount > 0 ? (
            <div className="mt-0.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
              판매완료 {dashboardSummary.terminalCount.toLocaleString("ko-KR")}건 포함
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 dark:border-blue-900/50 dark:bg-blue-950/20">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">판매중</div>
          <div className="mt-1 text-xl font-black tabular-nums text-blue-800 dark:text-blue-200">{dashboardSummary.activeCount.toLocaleString("ko-KR")}건</div>
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

      {/* Wave 182c: 정보 오류 신고 모달 — 카테고리 chip + optional 사유 + 승인 시 토큰 +3.
          이전 (182): "손해 신고 — 5자 이상 사유 필수". 임계값 높아 신고 어려움.
          현재: 카테고리만 골라도 제출 가능 (사유 optional). 사용자 자연 수집 → algorithm 보정 source. */}
      {lossReportItem && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4" onClick={closeLossReportModal}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            {lossReportResult?.ok ? (
              <>
                <div className="flex items-center gap-2 text-base font-black text-blue-700 dark:text-blue-300">
                  신고 접수됨
                </div>
                <div className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                  {lossReportResult.message}
                </div>
                {lossReportResult.compensation && lossReportResult.compensation > 0 ? (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                    토큰 +{lossReportResult.compensation}개 지급 완료
                  </div>
                ) : lossReportResult.pendingCompensation && lossReportResult.pendingCompensation > 0 ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    승인되면 토큰 +{lossReportResult.pendingCompensation}개 지급
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
                  정보 오류 신고
                </div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  매물: <span className="font-bold">{lossReportItem.name}</span>
                </div>
                <div className="mt-3 text-[12px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  어떤 부정확 정보를 발견했나요? 운영자가 확인 후 적절하면 토큰 <b>3개</b>가 지급됩니다.
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
                    {lossReportSubmitting ? "신고 중..." : "신고하기"}
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

      {shouldShowListTools ? (
        <>
          <details className="mx-3 mt-2 rounded-lg border border-zinc-200 bg-white/75 px-2.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-950/40 sm:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-black text-[#4f6a52] dark:text-blue-200 [&::-webkit-details-marker]:hidden">
              <span>검색/정렬</span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "최신순"} · {viewMode === "grid" ? "카드" : "목록"}</span>
            </summary>
            <div className="mt-2 grid gap-2 border-t border-[#eee6d9] pt-2 dark:border-zinc-800">
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="상품명, PID, 모델명 검색"
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-950 outline-none transition placeholder:text-[#9a9389] focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
                <select
                  value={sort}
                  onChange={(event) => {
                    setPage(1);
                    setSort(event.target.value as RevealSort);
                  }}
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-black text-zinc-900 outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="grid h-10 grid-cols-2 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-950">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`rounded-md text-[11px] font-black transition ${viewMode === "grid" ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)]" : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                  >
                    카드
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`rounded-md text-[11px] font-black transition ${viewMode === "list" ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)]" : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                  >
                    목록
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!selectMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectMode(true)}
                      disabled={items.length === 0}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-bold text-zinc-900 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      선택
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteAllConfirm(true)}
                      disabled={total === 0 || deleting}
                      className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900 dark:bg-zinc-900 dark:text-rose-300"
                    >
                      전체 삭제
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={exitSelectMode}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-[11px] font-bold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    취소
                  </button>
                )}
              </div>
            </div>
          </details>

          <div className="mt-4 hidden gap-2 sm:grid lg:grid-cols-[minmax(220px,1fr)_160px_140px]">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="상품명, PID, 모델명 검색"
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-950 outline-none transition placeholder:text-[#9a9389] focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <select
              value={sort}
              onChange={(event) => {
                setPage(1);
                setSort(event.target.value as RevealSort);
              }}
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-black text-zinc-900 outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="grid h-11 grid-cols-2 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-950">
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
        </>
      ) : null}

      {!loading && total > 0 ? (
        <div className="mx-3 mt-3 flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 sm:mx-0">
          <div>
            {firstIndex.toLocaleString("ko-KR")}~{lastIndex.toLocaleString("ko-KR")} / {total.toLocaleString("ko-KR")}개
          </div>
          <div>20개씩 보기</div>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        // 첫 로딩 스켈레톤 — items 비어있을 때만 표시. 검색/페이지 전환 시에는 기존 items 유지.
        <div className={viewMode === "grid" ? "mt-3 grid gap-0 sm:mt-4 sm:gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "mt-3 grid gap-0 sm:mt-4 sm:gap-2"}>
          {Array.from({ length: 6 }).map((_, i) => (
            <article
              key={`skeleton-${i}`}
              className={
                viewMode === "grid"
                  ? "grid animate-pulse grid-cols-[118px_minmax(0,1fr)] gap-3 border-x-0 border-t-0 border-b border-zinc-200 bg-transparent px-3 py-3 dark:border-zinc-800 sm:grid-cols-[64px_minmax(0,1fr)] sm:rounded-xl sm:border sm:bg-white sm:p-2 dark:sm:bg-zinc-950/40"
                  : "grid animate-pulse grid-cols-[118px_minmax(0,1fr)] gap-3 border-x-0 border-t-0 border-b border-zinc-200 bg-transparent px-3 py-3 dark:border-zinc-800 sm:grid-cols-[56px_minmax(0,1fr)] sm:rounded-xl sm:border sm:bg-white sm:p-2 dark:sm:bg-zinc-950/40"
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

      <div className={viewMode === "grid" ? "mt-3 grid gap-0 sm:mt-4 sm:gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "mt-3 grid gap-0 sm:mt-4 sm:gap-2"}>
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
                    ? "grid grid-cols-[118px_minmax(0,1fr)] gap-3 border-x-0 border-t-0 border-b border-zinc-200 bg-transparent px-3 py-3 transition dark:border-zinc-800 sm:grid-cols-[72px_minmax(0,1fr)] sm:rounded-xl sm:border sm:bg-zinc-50/80 sm:p-2.5 dark:sm:bg-zinc-900/50"
                    : "grid grid-cols-[118px_minmax(0,1fr)] gap-3 border-x-0 border-t-0 border-b border-zinc-200 bg-transparent px-3 py-3 transition dark:border-zinc-800 sm:grid-cols-[60px_minmax(0,1fr)] sm:rounded-xl sm:border sm:bg-zinc-50/80 sm:p-2.5 dark:sm:bg-zinc-900/50 lg:grid-cols-[60px_minmax(0,1fr)]"
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
                ? "grid grid-cols-[118px_minmax(0,1fr)] gap-3 border-x-0 border-t-0 border-b bg-transparent px-3 py-3 transition dark:bg-transparent sm:grid-cols-[76px_minmax(0,1fr)] sm:rounded-xl sm:border sm:bg-white sm:p-2.5 dark:sm:bg-zinc-950/40"
                : "grid grid-cols-[118px_minmax(0,1fr)] gap-3 border-x-0 border-t-0 border-b bg-transparent px-3 py-3 transition dark:bg-transparent sm:grid-cols-[64px_minmax(0,1fr)] sm:rounded-xl sm:border sm:bg-white sm:p-2.5 dark:sm:bg-zinc-950/40"
            } ${
              selectMode && selectedPids.has(item.pid)
                ? "border-rose-400 bg-rose-50 ring-2 ring-rose-300 dark:border-rose-700 dark:bg-rose-950/30"
                : isNewlyRevealed
                  ? "border-rose-400 bg-rose-50/70 shadow-[0_0_0_4px_rgba(244,63,94,0.12),0_18px_38px_rgba(244,63,94,0.18)] ring-2 ring-rose-300 dark:border-rose-700 dark:bg-rose-950/20 dark:ring-rose-700/70"
                : isTerminal
                  ? "border-zinc-200 bg-zinc-50/70 opacity-75 dark:border-zinc-800 dark:bg-zinc-900/40"
                  : "border-zinc-200 hover:border-blue-200 hover:bg-[var(--brand-accent-soft)] focus-visible:border-[#8ca88c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]/30 dark:border-zinc-800 dark:hover:border-blue-900 dark:hover:bg-blue-950/20"
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
            <div className="relative aspect-square overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800 sm:rounded-lg">
              {/* Wave 714d (2026-05-23 fix): 신발/의류는 기존 ConditionPhotoBadge 숨김 (전자기기용 mint/clean 라벨 정확도 낮음).
                  새 ConditionTierChip 이 카드 본문에 표시. */}
              {!(item.comparableKey?.startsWith("shoe|") || item.comparableKey?.startsWith("clothing|")) && (
                <ConditionPhotoBadge conditionClass={item.marketBasis?.conditionClass ?? null} compact />
              )}
              {(item.genericImageUrl ?? item.thumbnailUrl) ? (
                <Image
                  src={item.genericImageUrl ?? item.thumbnailUrl ?? ""}
                  alt={item.name}
                  fill
                  sizes="(max-width: 639px) 118px, 76px"
                  unoptimized
                  className="object-cover"
                />
              ) : (
                // Wave 749 (2026-05-25): 썸네일 없을 때 카테고리 워터마크 placeholder.
                <CategoryWatermark
                  comparableKey={item.comparableKey ?? null}
                  size={56}
                />
              )}
              {/* Wave 886 (2026-05-27): 일반 제품 사진 사용 중 표시 (실매물 잠금). */}
              {item.genericImageUrl ? <SkuImageLockBadge /> : null}
              {/* Wave 751 (2026-05-25): 사진 위 우하단 카테고리 워터마크 배지. */}
              {(item.genericImageUrl ?? item.thumbnailUrl) ? (
                <CategoryWatermark
                  comparableKey={item.comparableKey ?? null}
                  size={22}
                  variant="corner"
                />
              ) : null}
            </div>
            <div className="min-w-0 self-center">
              <div className="flex items-start gap-1.5">
                <div className="line-clamp-2 min-w-0 flex-1 text-[16px] font-black leading-[1.25] text-zinc-950 dark:text-zinc-100 sm:truncate sm:text-[15px] sm:leading-5">{item.name}</div>
                {isNewlyRevealed ? (
                  <span className="shrink-0 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm">
                    방금 추가
                  </span>
                ) : null}
              </div>
              {/* Wave 714d (2026-05-23): 신발/의류 5-tier 등급 + chips (전자기기는 표시 X).
                  Wave 714f (2026-05-23): showHelp 추가 — ? 버튼 클릭 시 분류 기준 popover. */}
              {(item.conditionTier || (item.conditionChips && item.conditionChips.length > 0)) && (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {item.conditionTier && (
                    <ConditionTierChip
                      tier={item.conditionTier}
                      showHelp
                      category={item.comparableKey?.startsWith("clothing|") ? "clothing" : "shoe"}
                    />
                  )}
                  {item.conditionChips && item.conditionChips.length > 0 && (
                    <ConditionChipsList chips={item.conditionChips} max={5} />
                  )}
                </div>
              )}
              {/* 2026-05-17: 매입 · 시세 표시 (대시보드 패턴 통일 — 운영자풀/preview 와 동일). */}
              {/* Wave 200 (2026-05-18): terminal 매물 시 strike-through — 정보 stale 명시. */}
              {/* Wave 246 (2026-05-19): medianPrice 0/null 시 "시세 확인중" 명시 — "번개 S급 시세 0원" 미스리딩 차단.
                 terminal 카드는 별도 tombstone 으로 가서 여기 안 옴. */}
              <div className={`mt-1 flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold ${
                isTerminal ? "text-zinc-400 line-through decoration-zinc-400 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400"
              }`}>
                <span>매입 <span className={`font-black tabular-nums ${isTerminal ? "" : "text-zinc-950 dark:text-zinc-100"}`}>{krw(item.price)}</span></span>
                {item.marketBasis?.medianPrice && item.marketBasis.medianPrice > 0 ? (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-600 no-underline">·</span>
                    <span>시세 <span className={`font-black tabular-nums ${isTerminal ? "" : "text-zinc-950 dark:text-zinc-100"}`}>{krw(item.marketBasis.medianPrice)}</span></span>
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
                ) : !isTerminal ? (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-600">·</span>
                    <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200" title="시세 표본 부족 또는 갱신중 — 차익은 추정치">
                      시세 확인중
                    </span>
                  </>
                ) : null}
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                {!isTerminal ? (
                  <>
                    <MarketplaceSourceBadge source={item.marketplaceSource} label={item.marketplaceLabel} />
                    <span className="text-zinc-300 dark:text-zinc-600">·</span>
                  </>
                ) : null}
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
              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-none border-0 bg-transparent px-0 py-0 shadow-none dark:bg-transparent sm:mt-2 sm:rounded-lg sm:border sm:border-blue-200/80 sm:bg-blue-50/35 sm:px-2.5 sm:py-2 dark:sm:border-blue-900/55 dark:sm:bg-blue-950/20">
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
                      <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 sm:text-[11px] sm:font-semibold">
                        차익
                      </span>
                      <span className="text-[15px] font-black tabular-nums text-[#00a862] dark:text-[#5dffae] sm:text-sm sm:font-bold">
                        {signedProfitRange(displayProfitMin, displayProfitMax)}
                      </span>
                      {pct != null ? (
                        <span className="rounded-full bg-zinc-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 sm:px-2 sm:text-xs">
                          {pct >= 0 ? "+" : ""}{pct}%
                        </span>
                      ) : null}
                      {profitDiverged && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 sm:px-2" title={`추천 당시 ${signedProfitRange(item.expectedProfitMin, item.expectedProfitMax)} → 현재 ${signedProfitRange(displayProfitMin, displayProfitMax)}`}>
                          ↓ 시세 갱신
                        </span>
                      )}
                      {/* Wave 325: 새 verdict 4단계 (great/good/fair/tight). 풀 매물은 다 안전이라 rose 없음. */}
                      {(() => {
                        if (isTerminal) return null;
                        // Wave 329: 카드 헤드라인이 보여주는 displayProfitAvg와 동일한 차익 사용.
                        const guidance = buyPriceGuidance({
                          price: item.price,
                          currentProfit: displayProfitAvg,
                        });
                        if (!guidance) return null;
                        // Wave launch-3: 단일 출처 VERDICT_LABELS 사용 (3 화면 통일).
                        const label = verdictUiLabel(guidance.verdict);
                        if (!label) return null;
                        const cls = label.tone === "em"
                          ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200 dark:bg-blue-950/30 dark:text-blue-200 dark:ring-blue-900/60"
                          : label.tone === "amber"
                            ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/60"
                            : "bg-rose-50 text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-900/60";
                        return (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:px-2 ${cls}`}
                            title={`차익 +${signedProfitRange(guidance.currentProfit, guidance.currentProfit).replace("+", "")} · 협상 시도 ${signedProfitRange(guidance.negotiationTarget, guidance.negotiationTarget).replace("+", "")} 이하 / ${signedProfitRange(guidance.breakEven, guidance.breakEven).replace("+", "")} 이상에 사면 손해`}
                          >
                            {label.card}
                          </span>
                        );
                      })()}
                      {/* Wave launch-17 (3 화면 일관성): 가품 위험 chip — high counterfeit brand 만.
                       * 메모리 룰: 일반인 보호 + 3 화면 (admin / user / modal) 일관. */}
                      {(() => {
                        if (isTerminal) return null;
                        const category = categoryFromComparableKey(item.marketBasis?.comparableKey ?? null);
                        const brandDepth = detectBrandDepth(category, {
                          skuId: item.skuId ?? null,
                          skuName: item.skuName ?? null,
                          name: item.name ?? null,
                        });
                        if (!brandDepth || brandDepth.brand.counterfeitRisk !== "high") return null;
                        return (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60 sm:px-2"
                            title={`${brandDepth.brand.label} = 가품 위험 큰 브랜드. 정품 사진 확인 필수.`}
                          >
                            <span aria-hidden="true">⚠</span>
                            <span>정품 확인</span>
                          </span>
                        );
                      })()}
                    </>
                  );
                })()}
              </div>
              {isTransactionFeedbackType(item.transactionFeedbackType) || isReportFeedbackType(item.reportFeedbackType) ? (
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                  {isTransactionFeedbackType(item.transactionFeedbackType) ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-[#3f5e45] ring-1 ring-[#d8e8d5] dark:bg-blue-950/30 dark:text-blue-200 dark:ring-blue-900/50">
                      거래 상태 · {TRANSACTION_FEEDBACK_LABEL[item.transactionFeedbackType]}
                    </span>
                  ) : null}
                  {isReportFeedbackType(item.reportFeedbackType) ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/50">
                      {REPORT_FEEDBACK_LABEL[item.reportFeedbackType]}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
          );
        })}
      </div>

      {/* Wave 303 (2026-05-19): terminal 기록 안내는 첫 화면 CTA를 밀지 않도록 목록 아래 보조 컨트롤로만 둔다. */}
      {dashboardSummary.terminalCount > 0 ? (
        <div className="mx-3 mt-3 flex items-center justify-between gap-2 border-t border-zinc-200 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 sm:mx-0">
          <span className="min-w-0 truncate">
            {hideTerminal
              ? `판매완료 기록 ${dashboardSummary.terminalCount.toLocaleString("ko-KR")}건 숨김`
              : `판매완료 기록 ${dashboardSummary.terminalCount.toLocaleString("ko-KR")}건 포함`}
            {dashboardSummary.marketClosedCount > 0 ? (
              <span className="hidden sm:inline">
                {" "}· 시세 마감 {dashboardSummary.marketClosedCount.toLocaleString("ko-KR")}건
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => setHideTerminal((v) => !v)}
            className="shrink-0 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-black text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {hideTerminal ? "기록 보기" : "기록 접기"}
          </button>
        </div>
      ) : null}

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
          <div className="mx-3 mt-4 rounded-xl bg-white p-4 text-center text-xs text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400 sm:mx-0">
            검색 결과가 없습니다.
          </div>
        ) : welcomePending ? (
          // 2026-05-17 fix: 작은 1줄 텍스트 → 큰 안내 박스 + 스켈레톤 grid. 사용자 보고
          // "갑자기 스켈레톤 없어지고 작은 글씨 보여서 당황" → 페이지 로딩 스켈레톤과
          // 자연스럽게 이어지게 콘텐츠 영역도 스켈레톤 + 가시적 spinner + 안내.
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-5 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="inline-flex items-center gap-2.5 text-base font-black text-zinc-950 dark:text-zinc-100 sm:text-lg">
                <svg className="h-5 w-5 animate-spin text-[#3182f6] dark:text-blue-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                가입 환영 매물 준비 중
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600 dark:text-zinc-400">
                첫 추천 매물 4개를 골라서 가져오고 있어요. 잠시만 기다려주세요.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/60" />
              ))}
            </div>
          </div>
        ) : (
          // Wave launch-19 (audit HIGH): 빈 상태 CTA 박음. 이전엔 안내 한 줄 + 행동 0 → 사용자 막힘.
          // 신규 사용자가 들어왔을 때 다음 step 명확.
          <div className="mx-3 mt-4 rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950 sm:mx-0">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
              <BookmarkIcon className="h-6 w-6" />
            </div>
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              아직 본 추천 상품이 없어요
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              매물 추천을 받으면 여기에 모아둘게요. 마음에 드는 매물은 보관해두고 나중에 다시 볼 수 있어요.
            </p>
            <Link
              href="/me?view=history"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition active:scale-[0.98] hover:bg-blue-700"
            >
              매물 추천 받으러 가기
            </Link>
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
        onClose={closeSelectedDetail}
        onLinkClicked={handleLinkClicked}
        onFeedback={handleFeedback}
        relatedItems={relatedModalItems}
        onOpenRelatedItem={(pid) => {
          const nextItem = items.find((item) => item.pid === pid);
          if (!nextItem) return;
          openItem(nextItem, "listing", { pushUrl: true });
        }}
        currentFeedbackType={
          selectedItem?.transactionFeedbackType
          ?? (isTransactionFeedbackType(selectedItem?.feedbackType) ? selectedItem.feedbackType : null)
        }
        currentSaved={Boolean(selectedItem?.saved || selectedItem?.feedbackType === "watching")}
        onSaveToggle={handleSaveToggle}
        onLoadDetail={handleLoadDetail}
        onRetry={closeSelectedDetail}
        // Wave 182b: 손해 신고 — 매물 상세 모달 안 1곳에만 박음. 카드 list 에선 빠짐.
        // Wave 182c: 이미 inaccurate_report 박힌 매물은 비활성. (loss_report 보류 → 체크 안 함)
        alreadyReportedLoss={selectedItem?.reportFeedbackType === "inaccurate_report" || selectedItem?.feedbackType === "inaccurate_report"}
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
