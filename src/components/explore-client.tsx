"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CreditIcon from "@/components/credit-icon";
import PackRevealModal, { type RevealResult } from "@/components/pack-reveal-modal";
import { ZapIcon, ClockIcon, TrophyIcon, CategoryIcon, SearchIcon, GiftIcon, HourglassIcon, BookmarkIcon } from "@/components/icons";
import { ConditionChip, ConditionPhotoBadge } from "@/components/condition-chip";
import KakaoLogo from "@/components/kakao-logo";
import { MarketplaceSourceBadge } from "@/components/market-brand-logo";
import { categoryFromComparableKey } from "@/lib/category-readiness";
import { detectBrandDepth } from "@/lib/category-brand-depth";
import type { DetailEventType } from "@/lib/detail-analytics";
import type { RevealCard, RevealListingDetail } from "@/lib/pack-open";
import { RESELL_SHIPPING_FEE, SAFETY_BUFFER, SELLING_FEE_RATE } from "@/lib/profit";

// Wave 338+339 (Phase 1a + 1b — Freemium /explore):
// 무료 사용자 매물 풀 browsing. 30개 풀 + 2h cooldown.
// 크레딧 1개 이상 보유자는 피드 탐색 무제한, 크레딧은 상세 분석 열람 때만 차감.
// + 통계 배너 + paywall 예고 + sold out 오버레이 + PackRevealModal 통합.
const DEFAULT_FREE_DETAIL_ACCESS_LIMIT = 3;

type PoolItem = {
  pid: number;
  accessToken?: string | null;
  name: string;
  price: number;
  skuMedian: number | null;
  listingUrl?: string | null;
  marketplaceSource?: string | null;
  marketplaceLabel?: string | null;
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
  // 2026-05-20 P0-Upload: 셀러 업로드 시점.
  firstSeenAt: string | null;
  freeShipping: boolean;
  sellerReviewRating: number | null;
  sellerReviewCount: number;
  joongnaTrustScore?: number | null;
  joongnaSafeOrderSalesCount?: number | null;
  joongnaSafeOrderSalesText?: string | null;
  productTradeType?: number | null;
  parcelFeeYn?: number | null;
  tradeLabels?: string[];
  transactionMode?: string | null;
  shippingAssumption?: string | null;
  directTradeLocation?: string | null;
  imageCount: number | null;
  descriptionPreview: string;
  soldOut: boolean;
};

type ScrappedPoolItem = PoolItem & {
  savedAt: string;
};

type PoolResponse = {
  items: PoolItem[];
  cooldown: { canRefresh: boolean; remainingSec: number; nextAvailableAt: string | null };
  feedMode?: "free" | "credit";
  creditFeed?: boolean;
  appliedBudget?: "150k" | "300k" | "500k" | "unlimited";
  detailAccess?: {
    creditBalance: number | null;
    freeUsed: number;
    freeLimit: number;
  };
  total: number;
  pageSize: number;
  freshLagHours: number;
  message?: string;
};

type DetailAccessSnapshot = {
  creditBalance: number | null;
  freeUsed: number;
  freeLimit: number;
};

type StatsResponse = {
  caughtToday: number;
  freshLocked: number;
  freshLagHours: number;
  // Wave launch-32: 추적/거른/신선 매물 카운트 — 빈 상태 신뢰 메시지용.
  totalTracked?: number;
  scannedToday?: number;
  freshLast24h?: number;
};

type SafetyStatsResponse = {
  stats?: {
    total_reviewed_7d?: number;
    profit_low_7d?: number;
    stat_missing_7d?: number;
    fake_or_lock_7d?: number;
    suspicious_price_7d?: number;
    needs_review_7d?: number;
    listing_parts_7d?: number;
    listing_damaged_7d?: number;
    listing_accessory_7d?: number;
    listing_callout_7d?: number;
    listing_commercial_7d?: number;
    listing_buying_7d?: number;
    listing_multi_7d?: number;
  };
};

type DetailAccessResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  accessType?: "admin" | "already_opened" | "free" | "credit";
  alreadyOpened?: boolean;
  creditSpent?: number;
  creditBalance?: number | null;
  freeUsed?: number;
  freeLimit?: number;
  item?: PoolItem | null;
};

// Wave launch-14 (사용자 짚음): error 종류 따라 다른 모달 톤.
// paywall = 크레딧 부족 (충전 안내), sold = 매물 거래완료/사라짐 (새로고침), verify_fail = 일시 통신 (재시도).
type DetailAccessLimitVariant = "paywall" | "sold" | "verify_fail";
type DetailAccessLimitModal = {
  variant: DetailAccessLimitVariant;
  title: string;
  message: string;
  creditBalance: number | null;
  freeUsed: number | null;
  freeLimit: number | null;
  valueSummary?: DetailAccessValueSummary | null;
};

type DetailAccessValueSummary = {
  openedCount: number;
  comparableCount: number;
  expectedProfitTotal: number;
  cautionCount: number;
  estimatedMinutesSaved: number;
};

type DirectTradeConfirmState = {
  item: PoolItem;
  costLabel: string;
};

function createDetailSessionId(pid: number) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `detail:${pid}:${Date.now().toString(36)}:${rand}`;
}

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function krwTenThousandBand(value: number) {
  const rounded = Math.max(0, Math.floor(value / 10000));
  if (rounded <= 0) return "1만원 미만";
  return `${rounded.toLocaleString("ko-KR")}만원대`;
}

function lockedProfitLabel(item: PoolItem) {
  const avg = profitAvg(item);
  if (avg <= 0) return "수익 후보";
  return `+${krwTenThousandBand(avg)}`;
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

function buyerShippingForPoolItem(item: Pick<PoolItem, "freeShipping" | "transactionMode" | "shippingAssumption">) {
  if (item.transactionMode === "direct_only") return 0;
  if (item.shippingAssumption === "included" || item.shippingAssumption === "free_shipping") return 0;
  return item.freeShipping ? 0 : 3500;
}

function recomputePoolProfit(price: number, marketPrice: number | null | undefined, item: Pick<PoolItem, "freeShipping" | "transactionMode" | "shippingAssumption">) {
  if (!marketPrice || marketPrice <= 0 || !price || price <= 0) return null;
  const buyShipping = buyerShippingForPoolItem(item);
  const sellFee = Math.round(marketPrice * SELLING_FEE_RATE);
  const max = Math.round(marketPrice - price - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
  const min = Math.round(marketPrice - (price + buyShipping) - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
  return { min, max };
}

function isDirectOnlyItem(item: Pick<PoolItem, "transactionMode" | "shippingAssumption">) {
  return item.transactionMode === "direct_only" || item.shippingAssumption === "direct_only";
}

function directTradeCostLabel(snapshot: DetailAccessSnapshot) {
  const freeRemaining = Math.max(0, Number(snapshot.freeLimit) - Number(snapshot.freeUsed));
  if (freeRemaining > 0) return "무료 상세보기 1회";
  return "1크레딧";
}

function accessValueForItem(item: PoolItem): DetailAccessValueSummary {
  const cautionCount = [
    item.sellerReviewCount < 10,
    (item.imageCount ?? 0) > 0 && (item.imageCount ?? 0) < 3,
    !item.freeShipping,
  ].filter(Boolean).length;

  return {
    openedCount: 1,
    comparableCount: 12,
    expectedProfitTotal: Math.max(0, profitAvg(item)),
    cautionCount,
    estimatedMinutesSaved: 15,
  };
}

function mergeAccessValueSummary(
  left: DetailAccessValueSummary | null,
  right: DetailAccessValueSummary,
): DetailAccessValueSummary {
  if (!left) return right;
  return {
    openedCount: left.openedCount + right.openedCount,
    comparableCount: left.comparableCount + right.comparableCount,
    expectedProfitTotal: left.expectedProfitTotal + right.expectedProfitTotal,
    cautionCount: left.cautionCount + right.cautionCount,
    estimatedMinutesSaved: left.estimatedMinutesSaved + right.estimatedMinutesSaved,
  };
}

function hoursAgoLabel(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(ms / (60 * 1000)));
    return `${minutes}분 전`;
  }
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
    url: item.listingUrl || bunjangUrl(item.pid),
    marketplaceSource: item.marketplaceSource ?? "bunjang",
    marketplaceLabel: item.marketplaceLabel ?? "번개장터",
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
    firstSeenAt: item.firstSeenAt ?? null,
    freshSeconds,
    savedDetail: {
      descriptionPreview: item.descriptionPreview,
      favoriteCount: null,
      freeShipping: item.freeShipping,
      imageCount: item.imageCount,
      sellerName: null,
      sellerReviewRating: item.sellerReviewRating,
      sellerReviewCount: item.sellerReviewCount,
      joongnaTrustScore: item.joongnaTrustScore ?? null,
      joongnaSafeOrderSalesCount: item.joongnaSafeOrderSalesCount ?? null,
      joongnaSafeOrderSalesText: item.joongnaSafeOrderSalesText ?? null,
      productTradeType: item.productTradeType ?? null,
      parcelFeeYn: item.parcelFeeYn ?? null,
      tradeLabels: item.tradeLabels ?? [],
      transactionMode: item.transactionMode === "direct_only" || item.transactionMode === "shipping_only" || item.transactionMode === "direct_and_shipping" ? item.transactionMode : "unknown",
      shippingAssumption: item.shippingAssumption === "direct_only" || item.shippingAssumption === "included" || item.shippingAssumption === "separate" || item.shippingAssumption === "free_shipping" ? item.shippingAssumption : "unknown",
      directTradeLocation: item.directTradeLocation ?? null,
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

const LOCKED_CATEGORY_LABELS: Record<string, string> = {
  earphone: "이어폰/헤드셋",
  smartphone: "휴대폰",
  tablet: "태블릿",
  smartwatch: "스마트워치",
  laptop: "노트북",
  shoe: "신발",
  bag: "가방",
  clothing: "의류",
};

const CONDITION_PREVIEW_LABELS: Record<string, string> = {
  unopened: "미개봉",
  mint: "S급",
  clean: "A급",
  normal: "상태 보통",
  worn: "사용감 있음",
  flawed: "하자 있음",
  low_batt: "배터리 약함",
};

function conditionPreviewLabel(conditionClass: string | null) {
  if (!conditionClass) return "상태 확인";
  return CONDITION_PREVIEW_LABELS[conditionClass] ?? "상태 확인";
}

function lockedPreviewCategoryLabel(item: PoolItem) {
  return LOCKED_CATEGORY_LABELS[item.category ?? ""] ?? "추천 매물";
}

function lockedPreviewTitle(item: PoolItem) {
  return `${lockedPreviewCategoryLabel(item)} · ${conditionPreviewLabel(item.conditionClass)} 후보`;
}

type SortOption = "profit_desc" | "latest" | "price_asc";
type SourceOption = "all" | "bunjang" | "joongna";
type BudgetFilterOption = "all" | "150000" | "300000" | "500000";

const SOURCE_OPTIONS: Array<{ value: SourceOption; label: string }> = [
  { value: "all", label: "출처 전체" },
  { value: "bunjang", label: "번개장터" },
  { value: "joongna", label: "중고나라" },
];

const BUDGET_FILTER_OPTIONS: Array<{ value: BudgetFilterOption; label: string; shortLabel: string; max: number | null }> = [
  { value: "all", label: "상관없음", shortLabel: "예산 전체", max: null },
  { value: "150000", label: "15만원 이하", shortLabel: "15만원↓", max: 150000 },
  { value: "300000", label: "30만원 이하", shortLabel: "30만원↓", max: 300000 },
  { value: "500000", label: "50만원 이하", shortLabel: "50만원↓", max: 500000 },
];
const SCRAP_SNAPSHOTS_STORAGE_KEY = "minyoi_scrap_snapshots_v1";
const LEGACY_SAVED_REVEAL_PIDS_STORAGE_KEY = "minyoi_saved_reveal_pids_v1";
const FIRST_FEED_ONBOARDING_STORAGE_KEY = "minyoi_first_feed_value_hook_v1";
const FEED_BUDGET_FILTER_STORAGE_KEY = "minyoi_feed_budget_filter_v1";
const DETAIL_ACCESS_SNAPSHOT_STORAGE_KEY = "minyoi_detail_access_snapshot_v1";
const SAFETY_STATS_FETCH_TIMEOUT_MS = 3500;
const MAX_LOCAL_SCRAP_SNAPSHOTS = 500;

function scopedStorageKey(baseKey: string, storageScope: string) {
  return `${baseKey}:${storageScope || "anonymous"}`;
}

function isBudgetFilterOption(value: string | null): value is BudgetFilterOption {
  return value === "all" || value === "150000" || value === "300000" || value === "500000";
}

function readBudgetFilterOption(storageScope: string): BudgetFilterOption {
  if (typeof window === "undefined") return "all";
  try {
    const raw = window.localStorage.getItem(scopedStorageKey(FEED_BUDGET_FILTER_STORAGE_KEY, storageScope));
    return isBudgetFilterOption(raw) ? raw : "all";
  } catch {
    return "all";
  }
}

function writeBudgetFilterOption(storageScope: string, value: BudgetFilterOption) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scopedStorageKey(FEED_BUDGET_FILTER_STORAGE_KEY, storageScope), value);
  } catch {
    // ignore
  }
}

function defaultDetailAccessSnapshot(): DetailAccessSnapshot {
  return { creditBalance: null, freeUsed: 0, freeLimit: DEFAULT_FREE_DETAIL_ACCESS_LIMIT };
}

function normalizeDetailAccessSnapshot(value: unknown): DetailAccessSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<DetailAccessSnapshot>;
  const freeLimit = Number(record.freeLimit ?? DEFAULT_FREE_DETAIL_ACCESS_LIMIT);
  const freeUsed = Number(record.freeUsed ?? 0);
  const creditBalance = record.creditBalance == null ? null : Number(record.creditBalance);
  if (!Number.isFinite(freeLimit) || freeLimit <= 0 || !Number.isFinite(freeUsed)) return null;
  return {
    creditBalance: creditBalance != null && Number.isFinite(creditBalance) ? creditBalance : null,
    freeUsed: Math.min(Math.max(0, freeUsed), freeLimit),
    freeLimit,
  };
}

function readDetailAccessSnapshot(storageScope: string): DetailAccessSnapshot {
  if (typeof window === "undefined") return defaultDetailAccessSnapshot();
  try {
    const raw = window.localStorage.getItem(scopedStorageKey(DETAIL_ACCESS_SNAPSHOT_STORAGE_KEY, storageScope));
    const parsed = raw ? normalizeDetailAccessSnapshot(JSON.parse(raw)) : null;
    return parsed ?? defaultDetailAccessSnapshot();
  } catch {
    return defaultDetailAccessSnapshot();
  }
}

function writeDetailAccessSnapshot(storageScope: string, value: DetailAccessSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      scopedStorageKey(DETAIL_ACCESS_SNAPSHOT_STORAGE_KEY, storageScope),
      JSON.stringify(value),
    );
  } catch {
    // ignore
  }
}

function budgetFilterOption(value: BudgetFilterOption) {
  return BUDGET_FILTER_OPTIONS.find((option) => option.value === value) ?? BUDGET_FILTER_OPTIONS[0];
}

function nextBudgetFilterOption(value: BudgetFilterOption): BudgetFilterOption | null {
  if (value === "150000") return "300000";
  if (value === "300000") return "500000";
  if (value === "500000") return "all";
  return null;
}

function budgetApiParam(value: BudgetFilterOption) {
  if (value === "150000") return "150k";
  if (value === "300000") return "300k";
  if (value === "500000") return "500k";
  return null;
}

function safetyStatNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function safetyRowsForExplore(stats: SafetyStatsResponse["stats"] | null | undefined) {
  if (!stats) {
    return [
      { label: "돈 안 되는 것", value: null as number | null },
      { label: "거래 주의 신호", value: null as number | null },
      { label: "상품 확인 필요", value: null as number | null },
    ];
  }
  const lowProfit = safetyStatNumber(stats.profit_low_7d) + safetyStatNumber(stats.stat_missing_7d);
  const caution = safetyStatNumber(stats.fake_or_lock_7d) + safetyStatNumber(stats.suspicious_price_7d);
  const unclear =
    safetyStatNumber(stats.needs_review_7d) +
    safetyStatNumber(stats.listing_parts_7d) +
    safetyStatNumber(stats.listing_damaged_7d) +
    safetyStatNumber(stats.listing_accessory_7d) +
    safetyStatNumber(stats.listing_callout_7d) +
    safetyStatNumber(stats.listing_commercial_7d) +
    safetyStatNumber(stats.listing_buying_7d) +
    safetyStatNumber(stats.listing_multi_7d);
  return [
    { label: "돈 안 되는 것", value: lowProfit },
    { label: "거래 주의 신호", value: caution },
    { label: "상품 확인 필요", value: unclear },
  ];
}

function formatStatMaybe(value: number | null, loaded = false) {
  if (value == null) return loaded ? "" : "확인 중";
  return `${value.toLocaleString("ko-KR")}건`;
}

function isScrappedPoolItem(value: unknown): value is ScrappedPoolItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ScrappedPoolItem>;
  return (
    Number.isFinite(Number(item.pid)) &&
    typeof item.name === "string" &&
    Number.isFinite(Number(item.price)) &&
    typeof item.savedAt === "string"
  );
}

function loadScrapSnapshots(): ScrappedPoolItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCRAP_SNAPSHOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isScrappedPoolItem)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
      .slice(0, MAX_LOCAL_SCRAP_SNAPSHOTS);
  } catch {
    return [];
  }
}

function saveScrapSnapshots(items: ScrappedPoolItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SCRAP_SNAPSHOTS_STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_LOCAL_SCRAP_SNAPSHOTS)),
    );
  } catch {
    // ignore
  }
}

function readLocalSavedPidSet() {
  if (typeof window === "undefined") return new Set<number>();
  try {
    const raw = window.localStorage.getItem(LEGACY_SAVED_REVEAL_PIDS_STORAGE_KEY);
    if (!raw) return new Set<number>();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(
        parsed
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value)),
      );
    }
    if (parsed && typeof parsed === "object") {
      return new Set(
        Object.keys(parsed)
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value)),
      );
    }
  } catch {
    // ignore
  }
  return new Set<number>();
}

function writeLocalSavedPid(pid: number, saved: boolean) {
  if (typeof window === "undefined" || !Number.isFinite(pid)) return;
  try {
    const next = readLocalSavedPidSet();
    if (saved) next.add(pid);
    else next.delete(pid);
    window.localStorage.setItem(
      LEGACY_SAVED_REVEAL_PIDS_STORAGE_KEY,
      JSON.stringify(Array.from(next).slice(-MAX_LOCAL_SCRAP_SNAPSHOTS)),
    );
  } catch {
    // ignore
  }
}

function revealCardToPoolItem(card: RevealCard): PoolItem {
  return {
    pid: card.pid,
    name: card.name,
    price: card.price,
    skuMedian: card.marketBasis?.medianPrice ?? null,
    listingUrl: card.url,
    marketplaceSource: card.marketplaceSource ?? "bunjang",
    marketplaceLabel: card.marketplaceLabel ?? "번개장터",
    thumbnailUrl: card.thumbnailUrl,
    skuId: card.skuId ?? null,
    skuName: card.skuName,
    expectedProfitMin: card.expectedProfitMin,
    expectedProfitMax: card.expectedProfitMax,
    profitBand: Number(card.band ?? 2),
    confidence: card.confidence,
    category: null,
    conditionClass: card.marketBasis?.conditionClass ?? null,
    comparableKey: card.marketBasis?.comparableKey ?? null,
    lastVerifiedAt: card.lastVerifiedAt,
    firstSeenAt: card.firstSeenAt ?? null,
    freeShipping: Boolean(card.savedDetail?.freeShipping),
    sellerReviewRating: card.savedDetail?.sellerReviewRating ?? null,
    sellerReviewCount: card.savedDetail?.sellerReviewCount ?? 0,
    joongnaTrustScore: card.savedDetail?.joongnaTrustScore ?? null,
    joongnaSafeOrderSalesCount: card.savedDetail?.joongnaSafeOrderSalesCount ?? null,
    joongnaSafeOrderSalesText: card.savedDetail?.joongnaSafeOrderSalesText ?? null,
    productTradeType: card.savedDetail?.productTradeType ?? null,
    parcelFeeYn: card.savedDetail?.parcelFeeYn ?? null,
    tradeLabels: card.savedDetail?.tradeLabels ?? [],
    transactionMode: card.savedDetail?.transactionMode ?? "unknown",
    shippingAssumption: card.savedDetail?.shippingAssumption ?? "unknown",
    directTradeLocation: card.savedDetail?.directTradeLocation ?? null,
    imageCount: card.savedDetail?.imageCount ?? null,
    descriptionPreview: card.savedDetail?.descriptionPreview ?? "",
    soldOut: false,
  };
}

function DetailAccessPaywallModal({
  state,
  onClose,
}: {
  state: DetailAccessLimitModal | null;
  onClose: () => void;
}) {
  if (!state) return null;
  const variant = state.variant ?? "paywall";
  const freeLimit = state.freeLimit && state.freeLimit > 0 ? state.freeLimit : 3;
  const freeUsed = Math.min(freeLimit, Math.max(0, state.freeUsed ?? freeLimit));
  const segments = Math.min(3, Math.max(1, freeLimit));
  const creditBalance = Math.max(0, Number(state.creditBalance ?? 0));
  const summary = state.valueSummary ?? null;

  // Wave launch-14: variant 별 톤 분기.
  const isPaywall = variant === "paywall";
  const isSold = variant === "sold";
  const isVerifyFail = variant === "verify_fail";
  const iconBg = isPaywall ? "bg-[#eef6ff] text-[#3182f6] dark:bg-blue-950/50 dark:text-blue-300"
    : isSold ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
    : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  const eyebrowText = isPaywall ? "크레딧 상세보기" : isSold ? "방금 거래된 상품" : "잠시 후 다시 시도";
  const eyebrowCls = isPaywall ? "text-[#3182f6] dark:text-blue-300"
    : isSold ? "text-rose-600 dark:text-rose-300"
    : "text-amber-700 dark:text-amber-300";

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/45 px-3 pb-3 pt-10 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] dark:bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] ${iconBg}`}>
              {/* variant 별 아이콘 — paywall=CreditIcon, sold=원 안 X, verify_fail=시계 */}
              {isPaywall ? (
                <CreditIcon size={26} />
              ) : isSold ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9 9l6 6M15 9l-6 6" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-9 rounded-full px-3 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              닫기
            </button>
          </div>

          <div className="mt-5">
            <p className={`text-[13px] font-black ${eyebrowCls}`}>{eyebrowText}</p>
            <h2 className="mt-2 break-keep text-[25px] font-black leading-[1.18] tracking-tight text-zinc-950 dark:text-zinc-50">
              {state.title}
            </h2>
            <p className="mt-3 break-keep text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {state.message}
            </p>
          </div>

          {/* Wave launch-14: paywall variant 만 크레딧 정보 표시.
              sold / verify_fail = 크레딧 무관 — 매물 자체 issue. */}
          {isPaywall ? (
            <div className="mt-5 rounded-[22px] bg-zinc-50 p-4 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400">
                <span>첫 무료 상세보기</span>
                <span>{freeUsed.toLocaleString("ko-KR")} / {freeLimit.toLocaleString("ko-KR")}</span>
              </div>
              <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }}>
                {Array.from({ length: segments }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2.5 rounded-full ${idx < Math.min(freeUsed, segments) ? "bg-[#3182f6]" : "bg-zinc-200 dark:bg-zinc-700"}`}
                  />
                ))}
              </div>
              <p className="mt-3 text-[12px] font-medium leading-5 text-zinc-500 dark:text-zinc-400">
                첫 3개 상품은 무료로 열리고, 이후에는 새 상품을 열 때마다 1크레딧이 차감됩니다.
              </p>
              <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-xs font-black text-zinc-600 ring-1 ring-zinc-100 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800">
                <span>현재 보유 크레딧</span>
                <span>{creditBalance.toLocaleString("ko-KR")}개</span>
              </div>
            </div>
          ) : null}

          {/* sold / verify_fail variant 의 action button — "새로고침해서 다른 매물 보기" */}
          {(isSold || isVerifyFail) ? (
            <button
              type="button"
              onClick={() => { onClose(); if (typeof window !== "undefined") window.location.reload(); }}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-[#3182f6] px-4 text-sm font-black text-white shadow-sm transition active:scale-[0.98] hover:bg-[#1c6fe8]"
            >
              {isSold ? "새로고침해서 다른 매물 보기" : "다시 시도하기"}
            </button>
          ) : null}

          {isPaywall && summary && summary.openedCount > 0 ? (
            <div className="mt-3 rounded-[22px] bg-[#f5f9ff] p-4 ring-1 ring-blue-100 dark:bg-blue-950/24 dark:ring-blue-900/45">
              <div className="text-[13px] font-black text-[#172019] dark:text-zinc-50">
                무료 {summary.openedCount.toLocaleString("ko-KR")}건 동안 이렇게 봤어요
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[16px] bg-white px-3 py-2.5 ring-1 ring-blue-50 dark:bg-zinc-950/65 dark:ring-blue-900/40">
                  <div className="text-[10.5px] font-bold text-zinc-500 dark:text-zinc-400">비교 매물</div>
                  <div className="mt-1 text-[15px] font-black text-[#3182f6] dark:text-blue-300">
                    {summary.comparableCount.toLocaleString("ko-KR")}건
                  </div>
                </div>
                <div className="rounded-[16px] bg-white px-3 py-2.5 ring-1 ring-blue-50 dark:bg-zinc-950/65 dark:ring-blue-900/40">
                  <div className="text-[10.5px] font-bold text-zinc-500 dark:text-zinc-400">예상 기회 수익</div>
                  <div className="mt-1 text-[15px] font-black text-emerald-700 dark:text-emerald-300">
                    +{krw(summary.expectedProfitTotal)}
                  </div>
                </div>
                <div className="rounded-[16px] bg-white px-3 py-2.5 ring-1 ring-blue-50 dark:bg-zinc-950/65 dark:ring-blue-900/40">
                  <div className="text-[10.5px] font-bold text-zinc-500 dark:text-zinc-400">주의 신호</div>
                  <div className="mt-1 text-[15px] font-black text-amber-700 dark:text-amber-300">
                    {summary.cautionCount.toLocaleString("ko-KR")}개
                  </div>
                </div>
                <div className="rounded-[16px] bg-white px-3 py-2.5 ring-1 ring-blue-50 dark:bg-zinc-950/65 dark:ring-blue-900/40">
                  <div className="text-[10.5px] font-bold text-zinc-500 dark:text-zinc-400">판단 시간</div>
                  <div className="mt-1 text-[15px] font-black text-zinc-900 dark:text-zinc-50">
                    약 {summary.estimatedMinutesSaved.toLocaleString("ko-KR")}분 절약
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Wave launch-29 (사용자 짚음): "방금 거래된 상품" 모달에 "크레딧 충전하고 계속 보기"
           * 떴던 거 fix. sold / verify_fail variant 엔 위 (L749-757) 에 이미 적절한 action button
           * 있음. 크레딧 충전은 paywall variant 만 의미 있음. */}
          <div className="mt-5 grid gap-2">
            {isPaywall ? (
              <Link
                href="/plans"
                className="flex min-h-12 items-center justify-center rounded-2xl bg-[#3182f6] px-4 text-base font-black text-white shadow-[0_12px_26px_rgba(49,130,246,0.28)] transition hover:bg-[#1c6fe8]"
              >
                {/* Wave launch-30 (사용자 짚음): "계속 보기" = misleading.
                 * 충전한다고 *이* 매물 계속 보는 게 아니라 *다른* 매물 더 보는 거.
                 * 정직 카피로 변경 — "크레딧 충전하러 가기". */}
                크레딧 충전하러 가기
              </Link>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 rounded-2xl bg-zinc-100 px-4 text-sm font-black text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DirectTradeConfirmModal({
  state,
  onClose,
  onConfirm,
}: {
  state: DirectTradeConfirmState | null;
  onClose: () => void;
  onConfirm: (item: PoolItem) => void;
}) {
  if (!state) return null;
  // Wave launch-36 (사용자 짚음): "원본에서 위치 확인 필요" 카피 정직화.
  // 진단: 중고나라 raw_json 에 location 키 없음 (collector list API 만 사용).
  // 진짜 위치 = 매물 원본 페이지에만. 따라서 카피를 명확히 + "원본에서 위치 보기" 버튼 추가.
  const location = state.item.directTradeLocation?.trim();
  const hasLocation = Boolean(location);
  const listingUrl = state.item.listingUrl ?? null;

  return (
    <div
      className="fixed inset-0 z-[94] flex items-end justify-center bg-black/45 px-3 pb-3 pt-10 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="직거래 전용 매물 확인"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] dark:bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-amber-50 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <path d="M12 21s7-4.7 7-11a7 7 0 0 0-14 0c0 6.3 7 11 7 11Z" />
              <path d="M12 10.5h.01" />
            </svg>
          </div>

          <p className="mt-5 text-[13px] font-black text-[#3182f6] dark:text-blue-300">열기 전 확인</p>
          <h2 className="mt-2 break-keep text-[25px] font-black leading-[1.18] tracking-tight text-zinc-950 dark:text-zinc-50">
            이 상품은 직거래만 가능한 매물이에요
          </h2>
          <p className="mt-3 break-keep text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            택배로 받을 수 있는 조건이 아니라서, 실제로 만날 수 있는 지역인지 먼저 봐야 해요.
            계속 열면 이 상품 상세 분석에 {state.costLabel}가 사용됩니다.
          </p>

          <div className="mt-5 rounded-[22px] bg-zinc-50 p-4 ring-1 ring-zinc-100 dark:bg-zinc-900/70 dark:ring-zinc-800">
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-400">
              거래 가능 지역
            </div>
            {hasLocation ? (
              <div className="mt-1.5 break-keep text-lg font-black text-zinc-950 dark:text-zinc-50">
                {location}
              </div>
            ) : (
              <div className="mt-1.5 break-keep text-[15px] font-bold leading-6 text-zinc-700 dark:text-zinc-200">
                직거래 동네는 매물 원본 페이지에 표시돼요
              </div>
            )}
            <div className="mt-3 text-[12px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
              위치가 멀면 수익이 좋아 보여도 시간비용이 커질 수 있어요. 상세 분석 열기 전 원본에서 동네 확인 권장.
            </div>
            {!hasLocation && listingUrl ? (
              <a
                href={listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-9 items-center justify-center gap-1 rounded-full bg-white px-3.5 text-[12px] font-black text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-900"
              >
                원본에서 위치 확인 →
              </a>
            ) : null}
          </div>

          <div className="mt-5 grid gap-2">
            <button
              type="button"
              onClick={() => onConfirm(state.item)}
              className="flex min-h-12 items-center justify-center rounded-2xl bg-[#3182f6] px-4 text-base font-black text-white shadow-[0_12px_26px_rgba(49,130,246,0.28)] transition hover:bg-[#1c6fe8]"
            >
              그래도 상세 분석 열기
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 rounded-2xl bg-zinc-100 px-4 text-sm font-black text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              다른 매물 볼게요
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FirstFeedOnboardingCard({
  stats,
  statsLoaded,
  selectedBudget,
  onSelectBudget,
  onDismiss,
}: {
  stats: SafetyStatsResponse["stats"] | null;
  statsLoaded: boolean;
  selectedBudget: BudgetFilterOption;
  onSelectBudget: (value: BudgetFilterOption) => void;
  onDismiss: () => void;
}) {
  const [step, setStep] = useState(0);
  const [pendingBudget, setPendingBudget] = useState<BudgetFilterOption>(selectedBudget);
  const totalReviewed = stats ? safetyStatNumber(stats.total_reviewed_7d) : 0;
  const rows = safetyRowsForExplore(stats);
  const showStats = !statsLoaded || stats != null;
  const reviewedLabel = statsLoaded && totalReviewed > 0
    ? `${totalReviewed.toLocaleString("ko-KR")}건`
    : "확인 중";
  const pendingBudgetOption = budgetFilterOption(pendingBudget);

  useEffect(() => {
    setPendingBudget(selectedBudget);
  }, [selectedBudget]);

  return (
    <section
      data-first-feed-onboarding
      className="fixed inset-0 z-[90] flex bg-[#f5f7fb] text-[#172019] dark:bg-zinc-950 dark:text-zinc-50"
    >
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-[calc(env(safe-area-inset-top)+18px)]">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5" aria-label={`${step + 1}/2`}>
            {[0, 1].map((idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${idx === step ? "w-7 bg-[#3182f6]" : "w-1.5 bg-zinc-300 dark:bg-zinc-700"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-9 rounded-full px-3 text-[13px] font-black text-zinc-400 transition hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-100"
          >
            닫기
          </button>
        </div>

        {step === 0 ? (
          <div className="flex flex-1 flex-col justify-center pb-24">
            <div className="text-[13px] font-black text-[#3182f6] dark:text-blue-300">첫 피드 준비</div>
            <h2 className="mt-3 break-keep text-[34px] font-black leading-[1.12] tracking-tight sm:text-[42px]">
              오늘 볼 만한
              <br />
              후보만 남겼어요
            </h2>
            <p className="mt-5 break-keep text-[16px] font-bold leading-7 text-zinc-600 dark:text-zinc-300">
              {statsLoaded && !stats ? (
                <>전체 추천 풀에서 바로 보기 어려운 매물은 먼저 걷어냈어요.</>
              ) : (
                <>
                  전체 추천 풀 <span className="font-black text-[#3182f6] dark:text-blue-300">{reviewedLabel}</span> 중에서
                  바로 보기 어려운 매물은 먼저 걷어냈어요.
                </>
              )}
            </p>

            {showStats ? (
              <div className="mt-9 space-y-5">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-end justify-between border-b border-zinc-200/80 pb-4 dark:border-zinc-800">
                    <div className="text-[16px] font-black text-zinc-700 dark:text-zinc-200">{row.label}</div>
                    <div className="text-[30px] font-black leading-none text-[#0a9f69] dark:text-emerald-300">
                      {formatStatMaybe(row.value, statsLoaded)}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-center pb-24">
            <div className="text-[13px] font-black text-[#3182f6] dark:text-blue-300">처음 보는 기준</div>
            <h2 className="mt-3 break-keep text-[34px] font-black leading-[1.12] tracking-tight sm:text-[42px]">
              감당 가능한
              <br />
              금액부터 볼까요?
            </h2>
            <p className="mt-5 break-keep text-[16px] font-bold leading-7 text-zinc-600 dark:text-zinc-300">
              후보가 적으면 좋은 매물을 놓치지 않게 전체 피드도 같이 보여드려요. 예산은 위 필터에서 언제든 바꿀 수 있어요.
            </p>

            <div className="mt-9 grid gap-2">
              {BUDGET_FILTER_OPTIONS.map((option) => {
                const active = pendingBudget === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPendingBudget(option.value)}
                    aria-pressed={active}
                    className={`flex min-h-[58px] items-center justify-between rounded-[18px] px-4 text-left text-[16px] font-black transition ${
                      active
                        ? "bg-[#3182f6] text-white shadow-[0_14px_32px_rgba(49,130,246,0.25)]"
                        : "bg-white text-zinc-900 ring-1 ring-zinc-200 active:scale-[0.99] dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-800"
                    }`}
                  >
                    <span>{option.label}</span>
                    <span className={active ? "text-white/80" : "text-zinc-300"}>→</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-[91] bg-[linear-gradient(180deg,rgba(245,247,251,0)_0%,#f5f7fb_34%)] px-6 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-8 dark:bg-[linear-gradient(180deg,rgba(9,9,11,0)_0%,#09090b_34%)]">
          <div className="mx-auto max-w-[520px]">
            {step === 0 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex min-h-[56px] w-full items-center justify-center rounded-[20px] bg-[#3182f6] text-[16px] font-black text-white shadow-[0_14px_34px_rgba(49,130,246,0.28)] active:scale-[0.99]"
              >
                내 예산 맞춰보기
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelectBudget(pendingBudget)}
                className="flex min-h-[56px] w-full items-center justify-center rounded-[20px] bg-zinc-950 text-[16px] font-black text-white shadow-[0_14px_34px_rgba(24,24,27,0.18)] active:scale-[0.99] dark:bg-white dark:text-zinc-950"
              >
                {pendingBudgetOption.value === "all" ? "전체 피드로 시작하기" : `${pendingBudgetOption.shortLabel}로 확인하고 보기`}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ExploreClient({
  storageScope = "anonymous",
  showFirstFeedIntro = true,
}: {
  storageScope?: string;
  showFirstFeedIntro?: boolean;
}) {
  const [items, setItems] = useState<PoolItem[]>([]);
  // Wave 391: loadPool에서 items deps에 박으면 infinite loop. ref로 fresh 접근.
  const itemsRef = useRef<PoolItem[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  // Wave 394.7.j (사용자 짚음): 더 찾아보기 append 후 새 매물 시작점으로 자동 스크롤.
  const [scrollTargetPid, setScrollTargetPid] = useState<number | null>(null);
  const cardRefs = useRef<Map<number, HTMLElement>>(new Map());
  const [cooldown, setCooldown] = useState<PoolResponse["cooldown"] | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [safetyStats, setSafetyStats] = useState<SafetyStatsResponse["stats"] | null>(null);
  const [safetyStatsLoaded, setSafetyStatsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creditFeedEnabled, setCreditFeedEnabled] = useState(false);
  const [detailAccessSnapshot, setDetailAccessSnapshot] = useState<DetailAccessSnapshot>(() => readDetailAccessSnapshot(storageScope));
  const [feedExhausted, setFeedExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailAccessLimit, setDetailAccessLimit] = useState<DetailAccessLimitModal | null>(null);
  const [directTradeConfirm, setDirectTradeConfirm] = useState<DirectTradeConfirmState | null>(null);
  const [detailAccessLoadingPid, setDetailAccessLoadingPid] = useState<number | null>(null);
  const openedDetailPidsRef = useRef<Set<number>>(new Set());
  const [openedDetailPids, setOpenedDetailPids] = useState<Set<number>>(() => new Set());
  const detailAccessValueRef = useRef<DetailAccessValueSummary | null>(null);
  const infiniteFeedSentinelRef = useRef<HTMLDivElement | null>(null);
  const [scrapItems, setScrapItems] = useState<ScrappedPoolItem[]>([]);
  const [legacySavedPids, setLegacySavedPids] = useState<Set<number>>(() => new Set());
  const [now, setNow] = useState(Date.now());
  const [selectedCard, setSelectedCard] = useState<RevealCard | null>(null);
  const detailSessionIdRef = useRef<string | null>(null);
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
    const t = setTimeout(() => {
      setRefreshModalOpen(false);
    }, 250);
    return () => clearTimeout(t);
  }, []);

  // Wave launch-17 #3: 모바일 뒤로가기 (swipe-back / 안드로이드 hardware back) → 모달 닫기.
  // pack-reveal-modal 와 동일 패턴. history.pushState 박고 popstate 시 close.
  useEffect(() => {
    if (!refreshModalOpen) return;
    const state = { minyoi_refresh_modal: true };
    window.history.pushState(state, "");
    const handlePopState = () => {
      setRefreshModalAnimating(false);
      setRefreshModalOpen(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [refreshModalOpen]);

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
    return raw === "latest" || raw === "price_asc" ? raw : "profit_desc";
  });
  const [source, setSource] = useState<SourceOption>(() => {
    const raw = searchParams.get("source");
    return raw === "bunjang" || raw === "joongna" ? raw : "all";
  });
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilterOption>(() => readBudgetFilterOption(storageScope));
  const budgetOption = budgetFilterOption(budgetFilter);
  const nextBudgetValue = nextBudgetFilterOption(budgetFilter);
  const nextBudgetOption = nextBudgetValue ? budgetFilterOption(nextBudgetValue) : null;
  const [showFirstFeedOnboarding, setShowFirstFeedOnboarding] = useState(false);
  const [scrapOnly, setScrapOnly] = useState(() => searchParams.get("view") === "scrap");
  const categoryScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollCategoriesPrev, setCanScrollCategoriesPrev] = useState(false);
  const [canScrollCategoriesNext, setCanScrollCategoriesNext] = useState(false);

  const updateBudgetFilter = useCallback((value: BudgetFilterOption) => {
    setBudgetFilter(value);
    setFeedExhausted(false);
    writeBudgetFilterOption(storageScope, value);
  }, [storageScope]);

  useEffect(() => {
    const loadedScraps = loadScrapSnapshots();
    const loadedPids = readLocalSavedPidSet();
    loadedScraps.forEach((item) => openedDetailPidsRef.current.add(item.pid));
    loadedPids.forEach((pid) => openedDetailPidsRef.current.add(pid));
    setOpenedDetailPids(new Set(openedDetailPidsRef.current));
    setScrapItems(loadedScraps);
    setLegacySavedPids(loadedPids);
  }, []);

  const savedPidSet = useMemo(() => {
    const next = new Set(legacySavedPids);
    scrapItems.forEach((item) => next.add(item.pid));
    return next;
  }, [legacySavedPids, scrapItems]);

  const updateCategoryScrollButtons = useCallback(() => {
    const node = categoryScrollRef.current;
    if (!node) return;
    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    setCanScrollCategoriesPrev(node.scrollLeft > 4);
    setCanScrollCategoriesNext(node.scrollLeft < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    const node = categoryScrollRef.current;
    if (!node) return;
    updateCategoryScrollButtons();
    node.addEventListener("scroll", updateCategoryScrollButtons, { passive: true });
    window.addEventListener("resize", updateCategoryScrollButtons);
    return () => {
      node.removeEventListener("scroll", updateCategoryScrollButtons);
      window.removeEventListener("resize", updateCategoryScrollButtons);
    };
  }, [updateCategoryScrollButtons]);

  const scrollCategories = useCallback((direction: "prev" | "next") => {
    const node = categoryScrollRef.current;
    if (!node) return;
    const distance = Math.min(Math.max(node.clientWidth * 0.72, 180), 360);
    node.scrollBy({
      left: direction === "next" ? distance : -distance,
      behavior: "smooth",
    });
    window.setTimeout(updateCategoryScrollButtons, 240);
  }, [updateCategoryScrollButtons]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!showFirstFeedIntro) {
      setShowFirstFeedOnboarding(false);
      return;
    }
    try {
      setBudgetFilter(readBudgetFilterOption(storageScope));
      setDetailAccessSnapshot(readDetailAccessSnapshot(storageScope));
      setShowFirstFeedOnboarding(window.localStorage.getItem(scopedStorageKey(FIRST_FEED_ONBOARDING_STORAGE_KEY, storageScope)) !== "1");
    } catch {
      setShowFirstFeedOnboarding(false);
    }
  }, [showFirstFeedIntro, storageScope]);

  const dismissFirstFeedOnboarding = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(scopedStorageKey(FIRST_FEED_ONBOARDING_STORAGE_KEY, storageScope), "1");
      } catch {
        // ignore
      }
    }
    setShowFirstFeedOnboarding(false);
  }, [storageScope]);

  const selectFirstFeedBudget = useCallback((value: BudgetFilterOption) => {
    updateBudgetFilter(value);
    dismissFirstFeedOnboarding();
  }, [dismissFirstFeedOnboarding, updateBudgetFilter]);

  // 필터/정렬 변경 시 URL 갱신
  useEffect(() => {
    const params = new URLSearchParams();
    if (scrapOnly) params.set("view", "scrap");
    else if (selectedCategories.size > 0) params.set("categories", Array.from(selectedCategories).join(","));
    if (sort !== "profit_desc") params.set("sort", sort);
    if (source !== "all") params.set("source", source);
    const queryString = params.toString();
    router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [selectedCategories, scrapOnly, sort, source, router, pathname]);

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

  const canRefresh = creditFeedEnabled || remainingSec === 0;

  const trackDetailEvent = useCallback((
    pid: number,
    eventType: DetailEventType,
    metadata?: Record<string, unknown>,
    sessionId = detailSessionIdRef.current,
  ) => {
    if (!Number.isFinite(pid)) return;
    const body = {
      pid,
      eventType,
      sessionId,
      metadata: metadata ?? {},
    };
    void fetch("/api/packs/reveals/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      keepalive: JSON.stringify(body).length < 6000,
    }).catch(() => {});
  }, []);

  const beginDetailSession = useCallback((
    item: PoolItem,
    metadata: Record<string, unknown>,
  ) => {
    const sessionId = createDetailSessionId(item.pid);
    detailSessionIdRef.current = sessionId;
    setSelectedCard(poolItemToRevealCard(item));
    trackDetailEvent(item.pid, "detail_opened", {
      source: item.marketplaceSource ?? "bunjang",
      category: item.category,
      conditionClass: item.conditionClass,
      price: item.price,
      expectedProfit: profitAvg(item),
      ...metadata,
    }, sessionId);
  }, [trackDetailEvent]);

  // Wave 353: 카테고리 필터는 클라이언트 사이드 (서버 → 항상 다양화된 30개 풀, 클라가 필터링).
  // 정렬은 백엔드 유지 — 풀 구성 자체가 달라짐 (latest = 최신 30 vs profit_desc = 차익 상위 30).
  // Wave 514: 온보딩 예산은 서버 pool 요청에도 전달한다. 선택 직후 피드 자체가 예산권으로 다시 잡혀야 한다.
  const loadPool = useCallback(async (
    refresh: boolean,
    options?: { autoScrollNew?: boolean },
  ) => {
    if (refresh) setRefreshing(true);
    else {
      setLoading(true);
      setFeedExhausted(false);
    }
    setError(null);
    try {
      const params = new URLSearchParams();
      if (refresh) params.set("refresh", "1");
      if (sort !== "profit_desc") params.set("sort", sort);
      if (source !== "all") params.set("source", source);
      const budgetParam = budgetApiParam(budgetFilter);
      if (budgetParam) params.set("budget", budgetParam);
      // Wave 391: refresh 시 이미 본 pids 전달 → 백엔드가 제외하고 다른 매물 fetch.
      // 안 그러면 같은 풀에서 같은 30개 다양화 결과 → frontend dedupe 후 0개 추가.
      // itemsRef로 fresh 접근 (deps에 items 박으면 infinite loop).
      const currentItems = itemsRef.current;
      if (refresh && currentItems.length > 0) {
        const excludePids = currentItems.filter((it) => !it.accessToken).map((it) => it.pid).join(",");
        const excludeTokens = currentItems.map((it) => it.accessToken).filter((t): t is string => Boolean(t)).join(",");
        if (excludePids) params.set("excludePids", excludePids);
        if (excludeTokens) params.set("excludeTokens", excludeTokens);
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
            const existingPids = new Set(itemsRef.current.map((it) => it.pid));
            const incomingFresh = data.items.filter((it) => !existingPids.has(it.pid));
            setFeedExhausted(incomingFresh.length === 0);
            setItems((prev) => {
              const latestExistingPids = new Set(prev.map((it) => it.pid));
              const fresh = data.items!.filter((it) => !latestExistingPids.has(it.pid));
              // Wave 394.7.j: 새 매물 첫 pid 저장 — useEffect 가 mount 후 scroll.
              if (fresh.length > 0 && options?.autoScrollNew !== false) setScrollTargetPid(fresh[0].pid);
              return [...prev, ...fresh];
            });
          } else {
            setItems(data.items);
            setFeedExhausted(data.items.length === 0);
          }
        }
        setCooldown(data.cooldown);
        setCreditFeedEnabled(data.creditFeed === true || data.feedMode === "credit");
        if (data.detailAccess) {
          const nextDetailAccess = normalizeDetailAccessSnapshot(data.detailAccess) ?? defaultDetailAccessSnapshot();
          setDetailAccessSnapshot(nextDetailAccess);
          writeDetailAccessSnapshot(storageScope, nextDetailAccess);
        }
      } else {
        setError(data.message ?? "매물 불러오기 실패");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [budgetFilter, sort, source, storageScope]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats/pool", { cache: "no-store" });
      if (res.ok) setStats((await res.json()) as StatsResponse);
    } catch {
      // 통계 실패는 무시
    }
  }, []);

  const loadSafetyStats = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), SAFETY_STATS_FETCH_TIMEOUT_MS);
    try {
      // CDN/browser cache를 살린다. 이 숫자는 온보딩 value hook이라 실시간 exact query보다 빠른 표시가 우선.
      const res = await fetch("/api/public/safety-stats", { signal: controller.signal });
      if (res.ok) {
        const data = (await res.json()) as SafetyStatsResponse;
        setSafetyStats(data.stats ?? null);
      }
    } catch {
      // 첫 방문 가치 카드 통계 실패는 피드 로딩을 막지 않는다.
    } finally {
      window.clearTimeout(timeoutId);
      setSafetyStatsLoaded(true);
    }
  }, []);

  // 초기 1회 통계 fetch. 서버 예산/성향 게이트 제거 상태를 유지한다.
  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!showFirstFeedOnboarding || safetyStatsLoaded) return;
    void loadSafetyStats();
  }, [loadSafetyStats, safetyStatsLoaded, showFirstFeedOnboarding]);

  // Wave 394.7.j: 더 찾아보기 후 새 매물 첫 카드로 자동 스크롤.
  useEffect(() => {
    if (scrollTargetPid == null) return;
    // 다음 render 후 ref 잡혀야 — items 의존성으로 mount 후 trigger.
    const el = cardRefs.current.get(scrollTargetPid);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollTargetPid(null);
    }
  }, [scrollTargetPid, items]);

  // 필터/정렬 변경 시 자동 재로드.
  useEffect(() => {
    void loadPool(false);
  }, [loadPool]);

  useEffect(() => {
    if (!creditFeedEnabled || loading || refreshing || feedExhausted || scrapOnly || items.length === 0) return;
    const el = infiniteFeedSentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadPool(true, { autoScrollNew: false });
        }
      },
      { rootMargin: "1800px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [creditFeedEnabled, feedExhausted, items.length, loadPool, loading, refreshing, scrapOnly]);

  // Wave 353: 클라이언트 사이드 카테고리 필터. 전체 풀(items)에서 selectedCategories에 속한 매물만.
  // category가 null이면 selectedCategories 활성 시 제외 (안전).
  const displayItems = useMemo(() => {
    if (scrapOnly) return scrapItems;
    const categoryFiltered = selectedCategories.size === 0
      ? items
      : items.filter((it) => it.category != null && selectedCategories.has(it.category));
    if (!budgetOption.max) return categoryFiltered;
    const budgetFiltered = categoryFiltered.filter((it) => it.price > 0 && it.price <= budgetOption.max!);
    return budgetFiltered;
  }, [budgetOption.max, items, scrapItems, scrapOnly, selectedCategories]);

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

  const freeDetailRemaining = Math.max(
    0,
    Number(detailAccessSnapshot.freeLimit) - Number(detailAccessSnapshot.freeUsed),
  );

  const openItemDetail = useCallback(async (item: PoolItem, options?: { directTradeConfirmed?: boolean }) => {
    if (item.soldOut) return;
    if (openedDetailPidsRef.current.has(item.pid)) {
      setDetailAccessLimit(null);
      beginDetailSession(item, { accessType: "already_opened_local" });
      return;
    }
    const hasDetailEntitlement = creditFeedEnabled || freeDetailRemaining > 0;
    if (!options?.directTradeConfirmed && isDirectOnlyItem(item) && hasDetailEntitlement) {
      setDetailAccessLimit(null);
      setDirectTradeConfirm({
        item,
        costLabel: directTradeCostLabel(detailAccessSnapshot),
      });
      return;
    }

    setDetailAccessLoadingPid(item.pid);
    setDetailAccessLimit(null);
    setDirectTradeConfirm(null);
    try {
      const res = await fetch("/api/packs/pool/detail-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.accessToken ? { accessToken: item.accessToken } : { pid: item.pid }),
        cache: "no-store",
      });
      const data = (await res.json()) as DetailAccessResponse;
      if (!res.ok) {
        const freeLimit = Number.isFinite(Number(data.freeLimit)) ? Number(data.freeLimit) : null;
        const freeUsed = Number.isFinite(Number(data.freeUsed)) ? Number(data.freeUsed) : null;
        const creditBalance = Number.isFinite(Number(data.creditBalance)) ? Number(data.creditBalance) : null;
        if (freeLimit != null && freeUsed != null) {
          const nextDetailAccess = normalizeDetailAccessSnapshot({ creditBalance, freeUsed, freeLimit }) ?? defaultDetailAccessSnapshot();
          setDetailAccessSnapshot(nextDetailAccess);
          writeDetailAccessSnapshot(storageScope, nextDetailAccess);
        }
        // Wave launch-14: error code 따라 다른 variant.
        // - insufficient_credits / free_limit_exhausted = 크레딧 충전 paywall
        // - not_ready (매물 거래완료/사라짐/검증 실패) = sold variant ("방금 거래된 상품이에요" 톤)
        // - live_verify_unavailable = verify_fail variant ("잠시 통신 불안정" 톤)
        // - detail_access_required (보관함 race) = paywall variant
        const isCreditShort = data.error === "insufficient_credits";
        const isLiveVerifyFail = data.error === "live_verify_unavailable";
        const isNotReady = data.error === "not_ready";
        const variant: DetailAccessLimitVariant = isCreditShort
          ? "paywall"
          : isLiveVerifyFail
            ? "verify_fail"
            : isNotReady
              ? "sold"
              : "paywall"; // detail_access_required 등 기타 = paywall fallback
        const titleByVariant =
          variant === "paywall" ? (isCreditShort ? "크레딧이 부족해요" : "상세보기를 열 수 없어요") :
          variant === "sold"    ? "방금 거래된 상품이에요" :
                                  "잠시 통신이 불안정해요";
        const defaultMessageByVariant =
          variant === "paywall" ? "크레딧을 충전하면 이 매물과 다른 매물 더 볼 수 있어요." :
          variant === "sold"    ? "이 매물은 방금 다른 곳에서 거래되었거나 셀러가 내린 것 같아요. 새로고침하면 다른 매물을 보여드릴게요." :
                                  "원본 매물 확인이 잠시 실패했어요. 크레딧은 사용하지 않았어요. 잠시 후 다시 시도해주세요.";
        setDetailAccessLimit({
          variant,
          title: titleByVariant,
          message: data.message ?? defaultMessageByVariant,
          creditBalance,
          freeUsed,
          freeLimit,
          valueSummary: detailAccessValueRef.current,
        });
        trackDetailEvent(item.pid, "free_limit_paywall_shown", {
          reason: data.error ?? "detail_access_failed",
          freeUsed,
          freeLimit,
          creditBalance,
        }, createDetailSessionId(item.pid));
        return;
      }
      if (Number(data.creditSpent ?? 0) > 0 && typeof window !== "undefined") {
        window.dispatchEvent(new Event("minyoi:credits-changed"));
      }
      if (data.creditBalance != null) {
        setCreditFeedEnabled(Number(data.creditBalance) > 0);
      }
      if (data.freeLimit != null && data.freeUsed != null) {
        const nextDetailAccess = normalizeDetailAccessSnapshot({
          creditBalance: data.creditBalance ?? null,
          freeUsed: data.freeUsed,
          freeLimit: data.freeLimit,
        }) ?? defaultDetailAccessSnapshot();
        setDetailAccessSnapshot(nextDetailAccess);
        writeDetailAccessSnapshot(storageScope, nextDetailAccess);
      }
      const exactItem = data.item ?? item;
      if (data.item) {
        setItems((prev) => prev.map((candidate) => (candidate.pid === item.pid ? data.item! : candidate)));
      }
      if (!data.alreadyOpened && data.accessType === "free") {
        detailAccessValueRef.current = mergeAccessValueSummary(
          detailAccessValueRef.current,
          accessValueForItem(exactItem),
        );
      }
      openedDetailPidsRef.current.add(item.pid);
      openedDetailPidsRef.current.add(exactItem.pid);
      setOpenedDetailPids(new Set(openedDetailPidsRef.current));
      beginDetailSession(exactItem, {
        accessType: data.accessType ?? "unknown",
        alreadyOpened: Boolean(data.alreadyOpened),
        creditSpent: Number(data.creditSpent ?? 0),
        creditBalance: data.creditBalance ?? null,
      });
    } catch (err) {
      // Wave launch-14: network 에러 = verify_fail variant.
      setDetailAccessLimit({
        variant: "verify_fail",
        title: "상세보기 요청이 잠시 막혔어요",
        message: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        creditBalance: null,
        freeUsed: null,
        freeLimit: null,
        valueSummary: detailAccessValueRef.current,
      });
    } finally {
      setDetailAccessLoadingPid((prev) => (prev === item.pid ? null : prev));
    }
  }, [beginDetailSession, creditFeedEnabled, detailAccessSnapshot, freeDetailRemaining, storageScope, trackDetailEvent]);

  const confirmDirectTradeDetail = useCallback((item: PoolItem) => {
    setDirectTradeConfirm(null);
    void openItemDetail(item, { directTradeConfirmed: true });
  }, [openItemDetail]);

  // 다른 매물 클릭 시 modal 전환
  const handleOpenRelatedItem = useCallback((pid: number) => {
    if (selectedCard) {
      trackDetailEvent(selectedCard.pid, "related_clicked", { targetPid: pid });
    }
    const item = items.find((it) => it.pid === pid);
    if (item) void openItemDetail(item);
  }, [items, openItemDetail, selectedCard, trackDetailEvent]);

  const handleScrapToggle = useCallback((pid: number, saved: boolean) => {
    trackDetailEvent(pid, saved ? "scrap_saved" : "scrap_removed");
    writeLocalSavedPid(pid, saved);
    setLegacySavedPids((prev) => {
      const next = new Set(prev);
      if (saved) next.add(pid);
      else next.delete(pid);
      return next;
    });
    setScrapItems((prev) => {
      const withoutTarget = prev.filter((item) => item.pid !== pid);
      if (!saved) {
        saveScrapSnapshots(withoutTarget);
        return withoutTarget;
      }

      const sourceItem =
        items.find((item) => item.pid === pid) ??
        prev.find((item) => item.pid === pid) ??
        (selectedCard?.pid === pid ? revealCardToPoolItem(selectedCard) : null);
      if (!sourceItem) return prev;

      openedDetailPidsRef.current.add(pid);
      setOpenedDetailPids(new Set(openedDetailPidsRef.current));
      const next = [
        { ...sourceItem, savedAt: new Date().toISOString() },
        ...withoutTarget,
      ].slice(0, MAX_LOCAL_SCRAP_SNAPSHOTS);
      saveScrapSnapshots(next);
      return next;
    });
  }, [items, selectedCard, trackDetailEvent]);

  // Wave 339b: /api/packs/pool/analysis로 marketBasis/velocityBasis lazy-fill.
  // assertRevealAccess 우회 (pid 기반). 가져온 분석으로 selectedCard 갱신.
  const handleLoadDetail = useCallback(async (pid: number): Promise<RevealListingDetail> => {
    try {
      const res = await fetch(`/api/packs/pool/analysis?pid=${pid}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { analysis?: { marketBasis: RevealCard["marketBasis"] | null; velocityBasis: RevealCard["velocityBasis"]; skuListingFlow: RevealCard["skuListingFlow"]; optionBaseAssumed: RevealCard["optionBaseAssumed"] } };
        if (data.analysis) {
          const marketBasis = data.analysis.marketBasis ?? null;
          setSelectedCard((prev) => {
            if (!prev || prev.pid !== pid) return prev;
            const recomputedProfit = recomputePoolProfit(prev.price, marketBasis?.medianPrice, {
              freeShipping: prev.savedDetail?.freeShipping ?? false,
              transactionMode: prev.savedDetail?.transactionMode ?? null,
              shippingAssumption: prev.savedDetail?.shippingAssumption ?? null,
            });
            return {
              ...prev,
              expectedProfitMin: recomputedProfit?.min ?? prev.expectedProfitMin,
              expectedProfitMax: recomputedProfit?.max ?? prev.expectedProfitMax,
              marketBasis: marketBasis ?? prev.marketBasis,
              velocityBasis: data.analysis!.velocityBasis ?? prev.velocityBasis,
              skuListingFlow: data.analysis!.skuListingFlow ?? prev.skuListingFlow,
              optionBaseAssumed: data.analysis!.optionBaseAssumed ?? prev.optionBaseAssumed,
            };
          });
          setItems((prev) => prev.map((item) => {
            if (item.pid !== pid) return item;
            const recomputedProfit = recomputePoolProfit(item.price, marketBasis?.medianPrice, item);
            return {
              ...item,
              skuMedian: marketBasis?.medianPrice ?? item.skuMedian,
              conditionClass: marketBasis?.conditionClass ?? item.conditionClass,
              comparableKey: marketBasis?.comparableKey ?? item.comparableKey,
              expectedProfitMin: recomputedProfit?.min ?? item.expectedProfitMin,
              expectedProfitMax: recomputedProfit?.max ?? item.expectedProfitMax,
            };
          }));
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
      {showFirstFeedIntro && showFirstFeedOnboarding && !scrapOnly ? (
        <FirstFeedOnboardingCard
          stats={safetyStats}
          statsLoaded={safetyStatsLoaded}
          selectedBudget={budgetFilter}
          onSelectBudget={selectFirstFeedBudget}
          onDismiss={dismissFirstFeedOnboarding}
        />
      ) : null}

      {/* Wave 383+393: 6h lag 제거 + 사이트 핵심 가치 (band-aware 비교) 강조. */}
      <div className="mb-2 hidden rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40 sm:block">
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
      <div className="sticky top-0 z-20 -mx-3 mb-2 flex flex-col items-stretch gap-1.5 bg-[#f5f7fb]/95 px-3 py-1.5 backdrop-blur dark:bg-zinc-950/95 sm:-mx-6 sm:flex-row sm:items-center sm:px-6">
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => scrollCategories("prev")}
            disabled={!canScrollCategoriesPrev}
            aria-label="카테고리 왼쪽으로 보기"
            className="absolute left-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-black/72 text-sm font-black text-white shadow-[0_8px_22px_rgba(0,0,0,0.28)] backdrop-blur transition hover:bg-black/84 disabled:pointer-events-none disabled:opacity-0 dark:border-zinc-700/80"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scrollCategories("next")}
            disabled={!canScrollCategoriesNext}
            aria-label="카테고리 오른쪽으로 보기"
            className="absolute right-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-black/72 text-sm font-black text-white shadow-[0_8px_22px_rgba(0,0,0,0.28)] backdrop-blur transition hover:bg-black/84 disabled:pointer-events-none disabled:opacity-0 dark:border-zinc-700/80"
          >
            →
          </button>
          <div
            ref={categoryScrollRef}
            data-category-filter-scroll
            className={`flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] ${
              canScrollCategoriesPrev ? "pl-8" : "pl-0"
            } ${canScrollCategoriesNext ? "pr-8" : "pr-0"}`}
          >
            <button
              type="button"
              onClick={() => {
                setScrapOnly((prev) => !prev);
                setSelectedCategories(new Set());
              }}
              className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                scrapOnly
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                  : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400"
              }`}
            >
              <BookmarkIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} fill={scrapOnly ? "currentColor" : "none"} />
              스크랩
              {scrapItems.length > 0 ? (
                <span className={scrapOnly ? "text-white/70 dark:text-zinc-950/70" : "text-zinc-400"}>
                  {scrapItems.length.toLocaleString("ko-KR")}
                </span>
              ) : null}
            </button>
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
                    setScrapOnly(false);
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
            {selectedCategories.size > 0 || scrapOnly || budgetFilter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategories(new Set());
                  setScrapOnly(false);
                  updateBudgetFilter("all");
                }}
                className="shrink-0 px-1.5 py-1 text-[10px] font-medium text-zinc-500 underline dark:text-zinc-400"
              >
                초기화
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:items-center">
          <select
            data-budget-filter-select
            value={budgetFilter}
            onChange={(e) => {
              updateBudgetFilter(e.target.value as BudgetFilterOption);
              setScrapOnly(false);
            }}
            className="min-w-0 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-[11px] font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300 sm:w-auto sm:shrink-0 sm:rounded-md sm:py-1 sm:text-[10px] sm:font-medium"
            aria-label="예산 필터"
          >
            {BUDGET_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.shortLabel}</option>
            ))}
          </select>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value as SourceOption);
              setScrapOnly(false);
            }}
            className="min-w-0 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-[11px] font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300 sm:w-auto sm:shrink-0 sm:rounded-md sm:py-1 sm:text-[10px] sm:font-medium"
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="min-w-0 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-[11px] font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300 sm:w-auto sm:shrink-0 sm:rounded-md sm:py-1 sm:text-[10px] sm:font-medium"
          >
            <option value="profit_desc">차익순</option>
            <option value="price_asc">매입단가순</option>
            <option value="latest">최신순</option>
          </select>
        </div>
      </div>

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
      ) : !scrapOnly && items.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-8 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
          <HourglassIcon className="mx-auto h-8 w-8 text-amber-600 dark:text-amber-300" />
          <p className="mt-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {budgetFilter !== "all" ? `${budgetOption.label} 조건은 아직 후보가 적어요` : "잠시 후 다시 와주세요"}
          </p>
          <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {budgetFilter !== "all"
              ? "수익, 시세, 상태 조건을 통과한 매물만 보여주다 보니 오늘은 아직 이 가격대 후보가 부족해요."
              : "오늘 잡은 매물이 충분치 않아요. 잠시 후 새로고침하면 새 매물이 보일 수 있어요."}
          </p>
          {/* Wave launch-32 (사용자 짚음): "왜 이게 전부냐" 신뢰 메시지.
           * 사용자가 가격 필터 끝까지 내려서 매물 부족할 때, 우리가 얼마나 빡세게 거른 후
           * 이렇게 보여주는지 안내. 사회적 증명 + 정직. */}
          {stats && (stats.scannedToday || stats.caughtToday) ? (
            <div className="mt-5 rounded-xl border border-zinc-200 bg-white px-4 py-4 text-left dark:border-zinc-800 dark:bg-zinc-950/60">
              <div className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100">
                지금 살만한 매물만 모은 결과예요
              </div>
              <ul className="mt-3 space-y-2 text-[12.5px] leading-5 text-zinc-600 dark:text-zinc-400">
                {stats.scannedToday ? (
                  <li>
                    오늘 AI 가 <b className="font-bold text-zinc-900 dark:text-zinc-100">{stats.scannedToday.toLocaleString("ko-KR")}건</b>을 살펴봤어요
                  </li>
                ) : null}
                <li>
                  가품·어그로·중복 셀러를 빼고 보여드려요
                </li>
                {stats.caughtToday ? (
                  <li>
                    오늘 <b className="font-bold text-zinc-900 dark:text-zinc-100">{stats.caughtToday.toLocaleString("ko-KR")}건</b>은 이미 거래됐어요
                  </li>
                ) : null}
                <li>
                  잠시 후 다시 와보세요. 매물은 실시간으로 갱신돼요
                </li>
              </ul>
            </div>
          ) : null}
          {budgetFilter !== "all" ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {nextBudgetOption ? (
                <button
                  type="button"
                  onClick={() => updateBudgetFilter(nextBudgetOption.value)}
                  className="rounded-full bg-[#3182f6] px-3 py-1.5 text-xs font-black text-white"
                >
                  {nextBudgetOption.value === "all" ? "가격 제한 풀기" : `${nextBudgetOption.label}로 넓히기`}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => updateBudgetFilter("all")}
                className="rounded-full border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 dark:border-amber-700 dark:bg-zinc-900 dark:text-amber-200"
              >
                전체 가격대 보기
              </button>
            </div>
          ) : null}
        </div>
      ) : displayItems.length === 0 ? (
        // Wave 353: 클라이언트 필터 결과 빈 경우 — 풀엔 있는데 선택 카테고리에만 없음.
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
            {scrapOnly ? "아직 스크랩한 매물이 없어요" : "이번 30개 풀에 해당 카테고리 매물이 없어요"}
          </p>
          <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            {scrapOnly ? "상세보기에서 북마크를 누르면 여기에 모여요." : "필터 초기화하거나, 다른 30개를 받아보세요."}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCategories(new Set());
                setScrapOnly(false);
              }}
              className="rounded-full border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 dark:border-amber-700 dark:bg-zinc-900 dark:text-amber-200"
            >
              전체 매물 보기
            </button>
            {!scrapOnly ? (
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
            ) : null}
          </div>
        </div>
      ) : (
        // Wave 350: 당근 피드 스타일 — 모바일 1열 + 박스 X + divider만.
        // 데스크탑 sm+ 2열 (좁은 화면 1열은 너무 비어보임).
        // Wave 353: items → displayItems (클라이언트 카테고리 필터 적용).
        <div className="-mx-3 divide-y divide-zinc-100 dark:divide-zinc-800 sm:mx-0 sm:grid sm:grid-cols-2 sm:divide-y-0 sm:gap-3 lg:grid-cols-3">
          {displayItems.map((item) => {
            const pct = profitPct(item);
            const isJoongna = item.marketplaceSource === "joongna";
            const isPremiumSeller = !isJoongna && (item.sellerReviewRating ?? 0) >= 4.8 && item.sellerReviewCount >= 30;
            const shippingChip = item.transactionMode === "direct_only"
              ? "직거래 전제"
              : item.shippingAssumption === "included"
                ? "배송비 포함"
                : item.freeShipping ? "무료배송" : null;
            const isSoldOut = item.soldOut;
            const freePreviewUnlocked = !creditFeedEnabled && freeDetailRemaining > 0;
            const exactUnlocked = creditFeedEnabled || freePreviewUnlocked || scrapOnly || savedPidSet.has(item.pid) || openedDetailPids.has(item.pid);
            const lockedPreview = !exactUnlocked;
            const freeDetailAvailable = lockedPreview && !creditFeedEnabled && freeDetailRemaining > 0;
            return (
              <button
                key={item.pid}
                ref={(el) => {
                  if (el) cardRefs.current.set(item.pid, el);
                  else cardRefs.current.delete(item.pid);
                }}
                type="button"
                onClick={() => {
                  if (isSoldOut) return;
                  void openItemDetail(item);
                }}
                disabled={isSoldOut || detailAccessLoadingPid === item.pid}
                className={`relative grid w-full grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-4 text-left transition sm:rounded-xl sm:border sm:p-3 ${
                  isSoldOut
                    ? "cursor-not-allowed sm:border-zinc-200 sm:bg-zinc-50 dark:sm:border-zinc-800 dark:sm:bg-zinc-900/30"
                    : detailAccessLoadingPid === item.pid
                      ? "cursor-wait sm:border-emerald-200 sm:bg-emerald-50/50 dark:sm:border-emerald-900 dark:sm:bg-emerald-950/20"
                    : "active:bg-zinc-50 dark:active:bg-zinc-900/40 sm:border-zinc-200 sm:bg-white sm:hover:border-emerald-300 sm:hover:shadow-md dark:sm:border-zinc-800 dark:sm:bg-zinc-900/40 dark:sm:hover:border-emerald-700"
                }`}
              >
                {/* Wave 351: sold out — 사진만 흐리게 + 우상단 칩. 카드 내용 그대로 (FOMO). */}
                <div className={`relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 ${isSoldOut ? "grayscale" : ""}`}>
                  {lockedPreview ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-[linear-gradient(135deg,#f8faf9_0%,#e9f4ef_100%)] px-3 text-center dark:bg-[linear-gradient(135deg,#18181b_0%,#0f2a21_100%)]">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/85 text-emerald-700 shadow-sm ring-1 ring-emerald-100 dark:bg-zinc-950/70 dark:text-emerald-300 dark:ring-emerald-900/40">
                        <CategoryIcon category={item.category ?? "default"} className="h-5 w-5" strokeWidth={1.9} />
                      </div>
                      <div className="mt-2 text-[10px] font-black leading-tight text-zinc-700 dark:text-zinc-200">
                        {freeDetailAvailable ? "무료 상세에서" : "원본 사진은"}
                        <br />
                        {freeDetailAvailable ? "원본 공개" : "상세에서 공개"}
                      </div>
                    </div>
                  ) : item.thumbnailUrl ? (
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
                    // Wave 357 → launch-5 (사용자 짚음): "다른 분이 잡았어요" = 우리 사이트 사용자가
                    // 잡은 게 아님 (lifecycle cron 의 판매완료/disappeared 마킹). 거짓 정보 가능성.
                    // "방금 거래된 상품" = 정직 (번개 측 판매완료) + FOMO 톤 유지.
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-900/35 px-2">
                      <span className="rounded-full bg-rose-600/95 px-2.5 py-1 text-center text-[10px] font-bold leading-tight text-white shadow-lg">
                        방금 거래된 상품
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className={`min-w-0 ${isSoldOut ? "opacity-60" : ""}`}>
                  <div className="line-clamp-2 text-sm font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                    {lockedPreview ? lockedPreviewTitle(item) : item.name}
                  </div>
                  {lockedPreview ? (
                    <div className="mt-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                      {freeDetailAvailable
                        ? `무료 상세 ${freeDetailRemaining.toLocaleString("ko-KR")}회 남음 · 열면 원제목과 사진이 보여요`
                        : "원제목·원본 사진·판매자 정보는 상세 분석에서 보여드려요"}
                    </div>
                  ) : null}
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className={`text-lg font-bold tabular-nums ${isSoldOut ? "text-zinc-500 line-through dark:text-zinc-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {lockedPreview ? lockedProfitLabel(item) : `+${krw(profitAvg(item))}`}
                    </span>
                    {lockedPreview ? (
                      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {freeDetailAvailable ? "무료 상세 가능" : "정확한 금액 잠김"}
                      </span>
                    ) : pct != null ? (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${isSoldOut ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"}`}>
                        +{pct}%
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    <span>
                      매입{" "}
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {lockedPreview ? krwTenThousandBand(item.price) : krw(item.price)}
                      </span>
                    </span>
                    {item.skuMedian ? (
                      <>
                        <span className="text-zinc-300 dark:text-zinc-700">·</span>
                        <span>
                          시세{" "}
                          <span className="font-bold tabular-nums">
                            {lockedPreview ? krwTenThousandBand(item.skuMedian) : krw(item.skuMedian)}
                          </span>
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
                    {isSoldOut ? (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                        💡 크레딧 충전하면 잡을 수 있었어요
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
                          {/* 2026-05-20 P0-Upload: 셀러 업로드 시점 우선. 없으면 검증 시점. */}
                          {item.firstSeenAt
                            ? `${hoursAgoLabel(item.firstSeenAt)} 등록`
                            : hoursAgoLabel(item.lastVerifiedAt)}
                        </span>
                        <MarketplaceSourceBadge source={item.marketplaceSource} label={item.marketplaceLabel} />
                        {/* Wave launch-17: 가품 위험 chip — 메인 feed 카드에서도 1차 노출 (사용자 보호). */}
                        {(() => {
                          const category = categoryFromComparableKey(item.comparableKey ?? null);
                          const brandDepth = detectBrandDepth(category, {
                            skuId: item.skuId ?? null,
                            skuName: item.skuName ?? null,
                            name: item.name ?? null,
                          });
                          if (!brandDepth || brandDepth.brand.counterfeitRisk !== "high") return null;
                          return (
                            <span
                              className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 font-bold text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60"
                              title={`${brandDepth.brand.label} = 가품 위험 큰 브랜드`}
                            >
                              <span aria-hidden="true">⚠</span>
                              정품 확인
                            </span>
                          );
                        })()}
                        {isPremiumSeller ? (
                          <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                            <TrophyIcon className="h-3 w-3" />
                            우수 셀러
                          </span>
                        ) : null}
                        {/* Wave launch-17 #2: 신규 셀러 chip — shopReviewCount=0 + 가품 위험 큰 카테고리 = 추가 주의. */}
                        {(() => {
                          if (isPremiumSeller) return null;
                          if (item.sellerReviewCount > 0) return null;
                          const category = categoryFromComparableKey(item.comparableKey ?? null);
                          const brandDepth = detectBrandDepth(category, {
                            skuId: item.skuId ?? null,
                            skuName: item.skuName ?? null,
                            name: item.name ?? null,
                          });
                          // 고위험 카테고리 (가품 위험 high) 만 chip — 일반 카테고리는 신규 셀러 OK
                          if (!brandDepth || brandDepth.brand.counterfeitRisk !== "high") return null;
                          return (
                            <span
                              className="flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-0.5 font-bold text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/60"
                              title="이 셀러는 거래 후기가 아직 없어요. 명품/음향처럼 가품 위험 큰 상품은 더 보수적으로 확인하세요."
                            >
                              <span aria-hidden="true">!</span>
                              신규 셀러
                            </span>
                          );
                        })()}
                        {shippingChip ? (
                          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {shippingChip}
                          </span>
                        ) : null}
                        {lockedPreview ? (
                          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                            {freeDetailAvailable ? "무료 상세 열기" : "상세 열면 원본 공개"}
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
      {!loading && !scrapOnly && items.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
              <HourglassIcon className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {creditFeedEnabled
                  ? feedExhausted
                    ? budgetFilter !== "all"
                      ? `${budgetOption.label} 조건은 오늘 여기까지예요`
                      : "오늘 볼 수 있는 추천 매물은 여기까지예요"
                    : "계속 내려보면 새 매물이 이어져요"
                  : canRefresh
                    ? "다른 30개 매물 받을 수 있어요"
                    : "쿨다운 대기 중"}
              </div>
              <div className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {creditFeedEnabled
                  ? feedExhausted
                    ? budgetFilter !== "all"
                      ? `${budgetOption.label}에서 수익, 시세, 상태 조건을 통과한 후보만 남긴 결과예요. 가격대를 넓히면 더 볼 수 있어요.`
                      : "수익, 시세, 상태 조건을 통과한 매물만 남긴 결과예요."
                    : "피드 탐색은 무제한 · 크레딧은 상세 분석을 열 때만 차감"
                  : canRefresh
                  ? "새로운 매물 풀로 갱신 · 다양한 카테고리"
                  : `${formatCooldown(remainingSec)} 후 새 매물 자동으로 풀려요`}
              </div>
              {creditFeedEnabled && feedExhausted && budgetFilter !== "all" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {nextBudgetOption ? (
                    <button
                      type="button"
                      onClick={() => updateBudgetFilter(nextBudgetOption.value)}
                      className="rounded-full bg-[#3182f6] px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-[#1c6fe8]"
                    >
                      {nextBudgetOption.value === "all" ? "가격 제한 풀고 보기" : `${nextBudgetOption.label}로 넓히기`}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => updateBudgetFilter("all")}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-black text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    전체 가격대 보기
                  </button>
                </div>
              ) : null}
              {/* Wave launch-33 (사용자 짚음): feed exhausted 상태에도 신뢰 메시지.
               * 사용자가 끝까지 스크롤하고 "왜 이것밖에 없냐" 의문 → 우리 시스템이 얼마나
               * 빡세게 거른 후 보여주는지 사회적 증명 + 정직. */}
              {creditFeedEnabled && feedExhausted && stats && (stats.scannedToday || stats.caughtToday) ? (
                <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <div className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100">
                    지금 살만한 매물만 모은 결과예요
                  </div>
                  <ul className="mt-2.5 space-y-2 text-[12px] leading-5 text-zinc-600 dark:text-zinc-400">
                    {stats.scannedToday ? (
                      <li>
                        오늘 AI 가 <b className="font-bold text-zinc-900 dark:text-zinc-100">{stats.scannedToday.toLocaleString("ko-KR")}건</b>을 살펴봤어요
                      </li>
                    ) : null}
                    <li>
                      가품·어그로·중복 셀러를 빼고 보여드려요
                    </li>
                    {stats.caughtToday ? (
                      <li>
                        오늘 <b className="font-bold text-zinc-900 dark:text-zinc-100">{stats.caughtToday.toLocaleString("ko-KR")}건</b>은 이미 거래됐어요
                      </li>
                    ) : null}
                    <li>
                      잠시 후 다시 와보세요. 매물은 실시간으로 갱신돼요
                    </li>
                  </ul>
                </div>
              ) : null}
              {!creditFeedEnabled ? (
                <div className="mt-2 flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <ZapIcon className="h-3 w-3" />
                  <span>크레딧 1개 이상이면 대기 없이 피드 계속 보기</span>
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
      {!loading && !scrapOnly && !creditFeedEnabled && items.length > 0 ? (
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
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--brand-accent-strong)] px-6 py-3.5 text-base font-bold text-[var(--brand-cream)] shadow-[0_20px_44px_rgba(15,23,42,0.38),0_4px_12px_rgba(15,23,42,0.20)] ring-1 ring-white/10 transition active:scale-[0.97] hover:translate-y-[-1px] hover:shadow-[0_24px_48px_rgba(15,23,42,0.42)] sm:min-h-0 sm:py-3 sm:text-sm sm:shadow-[0_16px_34px_rgba(15,23,42,0.32)]"
          >
            <SearchIcon className="h-4 w-4" />
            {refreshing ? "받는 중..." : "더 찾아보기"}
          </button>
        </div>
      ) : null}

      {!loading && !scrapOnly && creditFeedEnabled && !feedExhausted && items.length > 0 ? (
        <div
          ref={infiniteFeedSentinelRef}
          data-credit-infinite-feed-sentinel
          className="mt-4 flex min-h-16 items-center justify-center px-4 text-center text-xs font-bold text-zinc-500 dark:text-zinc-400"
        >
          {refreshing ? "조건 맞는 후보를 미리 찾는 중..." : "계속 내려보면 새 매물이 이어져요"}
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
            className={`relative w-full max-w-md transform rounded-t-3xl border border-zinc-200/50 bg-[var(--brand-cream)] shadow-[0_-20px_60px_rgba(0,0,0,0.30)] transition-all duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-3xl ${
              refreshModalAnimating
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-full opacity-0 sm:translate-y-4 sm:scale-95"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </div>

            <div className="px-6 pt-5 pb-6 sm:pt-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {canRefresh ? "새 상품 30개 받기" : "조금만 기다리면 새 상품이 열려요"}
                  </div>
                  <div className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {canRefresh
                      ? "필터 없이 볼 만한 후보를 더 붙여드려요"
                      : `${formatCooldown(remainingSec)} 후 무료로 새 상품을 볼 수 있어요`}
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
                    ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] shadow-[0_12px_28px_rgba(15,23,42,0.28)] hover:shadow-[0_16px_34px_rgba(15,23,42,0.34)] active:scale-[0.99]"
                    : "cursor-not-allowed bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-500"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {canRefresh ? <GiftIcon className="h-5 w-5" /> : <HourglassIcon className="h-5 w-5" />}
                      <span className="text-base font-bold">
                        {canRefresh ? "새 상품 30개 받기" : `${formatCooldown(remainingSec)} 후 새 상품 보기`}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${canRefresh ? "bg-white/20 text-[var(--brand-cream)]" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>
                        무료
                      </span>
                    </div>
                    <div className={`mt-1.5 text-xs font-medium ${canRefresh ? "text-[var(--brand-cream)]/75" : "text-zinc-500 dark:text-zinc-500"}`}>
                      {canRefresh ? "필터 없이 더 넓게 골라드려요" : "기다리면 크레딧 없이 다음 라운드가 열려요"}
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
                  <div className="mt-3 mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 shadow-[0_10px_28px_rgba(16,185,129,0.12)] dark:border-emerald-900/70 dark:bg-emerald-950/30">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-zinc-900/70">
                        <CreditIcon size={26} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-base font-black tracking-tight text-[#123c2b] dark:text-emerald-100">
                          크레딧 보유자는 피드 계속 보기
                        </div>
                        <div className="mt-1 text-[12px] font-bold leading-5 text-emerald-800/80 dark:text-emerald-200/80">
                          1개 이상 있으면 다음 매물이 자동으로 이어지고, 피드는 차감 0개예요.
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-white/80 px-2 py-2 text-center dark:bg-zinc-900/50">
                        <div className="text-[11px] font-black text-[#008f5f] dark:text-emerald-300">0개</div>
                        <div className="mt-0.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">피드 차감</div>
                      </div>
                      <div className="rounded-xl bg-white/80 px-2 py-2 text-center dark:bg-zinc-900/50">
                        <div className="text-[11px] font-black text-[#008f5f] dark:text-emerald-300">1개</div>
                        <div className="mt-0.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">상세 분석</div>
                      </div>
                      <div className="rounded-xl bg-white/80 px-2 py-2 text-center dark:bg-zinc-900/50">
                        <div className="text-[11px] font-black text-[#008f5f] dark:text-emerald-300">1개+</div>
                        <div className="mt-0.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">보유 조건</div>
                      </div>
                    </div>
                            </div>

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
                                    크레딧 충전하러 가기
                                  </div>
                                  <div className="mt-0.5 text-[11px] font-medium text-white/85">
                                    20크레딧 3,900원부터
                                  </div>
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                                피드 무제한
                              </span>
                            </Link>

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
                                    카톡 공유하고 1초만에 더 보기
                                  </div>
                                  <div className="mt-0.5 text-[11px] font-medium text-[#3b1e1e]/70">
                                    친구 가입 X · 공유 클릭 1번이면 끝
                                  </div>
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full bg-[#3b1e1e] px-2 py-0.5 text-[10px] font-bold text-[#fbe300]">
                                무료
                              </span>
                            </button>
                          </>
                        ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <DirectTradeConfirmModal
        state={directTradeConfirm}
        onClose={() => setDirectTradeConfirm(null)}
        onConfirm={confirmDirectTradeDetail}
      />

      <DetailAccessPaywallModal
        state={detailAccessLimit}
        onClose={() => setDetailAccessLimit(null)}
      />

      {/* PackRevealModal — 카드 클릭 시 띄움 */}
      <PackRevealModal
        open={selectedCard != null}
        band={2}
        loading={false}
        result={modalResult}
        onClose={() => {
          if (selectedCard) trackDetailEvent(selectedCard.pid, "detail_closed");
          setSelectedCard(null);
          detailSessionIdRef.current = null;
        }}
        onLinkClicked={() => {}}
        onFeedback={() => {}}
        onTrackEvent={trackDetailEvent}
        onLoadDetail={handleLoadDetail}
        onRetry={() => {}}
        relatedItems={relatedItems}
        onOpenRelatedItem={handleOpenRelatedItem}
        currentSaved={selectedCard ? savedPidSet.has(selectedCard.pid) : undefined}
        onSaveToggle={handleScrapToggle}
      />
    </div>
  );
}
