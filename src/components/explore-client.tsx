"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PackRevealModal, { type RevealResult } from "@/components/pack-reveal-modal";
import { ZapIcon, ClockIcon, TrophyIcon, CategoryIcon, SearchIcon, GiftIcon, HourglassIcon, BookmarkIcon } from "@/components/icons";
import { BrandLogo } from "@/components/brand-logo";
import { ConditionPhotoBadge, ConditionTierPhotoBadge } from "@/components/condition-chip";
import { CategoryWatermark } from "@/components/category-watermark";
import { MarketplaceSourceBadge } from "@/components/market-brand-logo";
import { categoryFromComparableKey } from "@/lib/category-readiness";
import { detectBrandDepth } from "@/lib/category-brand-depth";
import type { DetailEventType } from "@/lib/detail-analytics";
import { isDaangnMarketplaceSource } from "@/lib/marketplace-source";
import { getMembershipPlan, krw as membershipKrw, MEMBERSHIP_PLANS, RENEWAL_UPGRADE_PLANS, type MembershipPlan, type MembershipPlanKey } from "@/lib/membership-plans";
import type { RevealCard, RevealListingDetail } from "@/lib/pack-open";
import { expectedProfitFromMarketPrice } from "@/lib/profit";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

// Wave 338+339 (Phase 1a + 1b — /explore):
// 매물 풀 browsing. 현재 피드는 승인된 멤버십 사용자에게 실제 매입가/시세까지 공개.
// + 통계 배너 + paywall 예고 + sold out 오버레이 + PackRevealModal 통합.
// detail-access.ts FREE_DETAIL_ACCESS_LIMIT 와 동기화.
// 현재 정책은 승인형 멤버십 게이트이므로 기본 free limit 은 0이다.
const DEFAULT_FREE_DETAIL_ACCESS_LIMIT = 0;

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
  genericImageUrl?: string | null;
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
  daangnMannerTemperature?: number | null;
  daangnReviewCount?: number | null;
  productTradeType?: number | null;
  parcelFeeYn?: number | null;
  tradeLabels?: string[];
  transactionMode?: string | null;
  shippingAssumption?: string | null;
  directTradeLocation?: string | null;
  imageCount: number | null;
  descriptionPreview: string;
  soldOut: boolean;
  // Wave 714k (2026-05-23): 신발/의류 5-tier grading + chips — pool API 응답 받아서 모달에 전달.
  conditionTier?: string | null;
  conditionCluster?: string | null;
  conditionConfidence?: number | null;
  conditionFlags?: Record<string, unknown> | null;
  conditionChips?: string[] | null;
  feedPreviewLocked?: boolean;
  productLineLabel?: string | null;
  priceBandLabel?: string | null;
  marketPriceBandLabel?: string | null;
  priceSignalLabel?: string | null;
  sellerSignalLabel?: string | null;
  marketSignalLabel?: string | null;
  velocitySignalLabel?: string | null;
  daangnDistanceKm?: number | null;
  daangnDistanceLabel?: string | null;
  daangnDistanceRank?: number | null;
  marketBasis?: RevealCard["marketBasis"] | null;
  velocityBasis?: RevealCard["velocityBasis"];
  skuListingFlow?: RevealCard["skuListingFlow"];
  optionBaseAssumed?: RevealCard["optionBaseAssumed"];
};

type ScrappedPoolItem = PoolItem & {
  savedAt: string;
};

type PoolResponse = {
  items: PoolItem[];
  cooldown: { canRefresh: boolean; remainingSec: number; nextAvailableAt: string | null };
  feedMode?: "membership" | "free" | "credit";
  creditFeed?: boolean;
  appliedBudget?: "150k" | "300k" | "500k" | "unlimited";
  detailAccess?: {
    creditBalance: number | null;
    freeUsed: number;
    freeLimit: number;
    unlimited?: boolean;
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
  unlimited?: boolean;
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

type DetailAccessResponse = {
  ok?: boolean;
  error?: string;
  // Wave launch-106: server sub-reason ("profit_lost" 등) — variant 결정에 사용.
  reason?: string;
  message?: string;
  accessType?: "admin" | "already_opened" | "free" | "credit";
  alreadyOpened?: boolean;
  creditSpent?: number;
  creditBalance?: number | null;
  freeUsed?: number;
  freeLimit?: number;
  unlimited?: boolean;
  item?: PoolItem | null;
};

type MembershipStatusSnapshot = {
  ok?: boolean;
  isMember?: boolean;
  activePlan?: {
    planKey?: string | null;
    planLabel?: string | null;
    months?: number | null;
    priceKrw?: number | null;
    activatedAt?: string | null;
    memberOfferExpiresAt?: string | null;
  } | null;
  planEndAt?: string | null;
};

type FeedRenewalReservation = {
  applicationId: number | null;
  plan: MembershipPlan;
  scheduledAutoApproveAt: string | null;
};

// Wave launch-14 (사용자 짚음): error 종류 따라 다른 모달 톤.
// paywall = 멤버십 승인 필요, sold = 매물 거래완료/사라짐 (새로고침), verify_fail = 일시 통신 (재시도).
// Wave launch-106 (2026-05-24): profit_lost = active 매물인데 시세 떨어져 차익 -. "판매완료" 라벨 사용 금지.
type DetailAccessLimitVariant = "paywall" | "sold" | "verify_fail" | "profit_lost";
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
  expectedProfitTotal: number;
  cautionCount: number;
};

function createDetailSessionId(pid: number) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `detail:${pid}:${Date.now().toString(36)}:${rand}`;
}

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

const BANK_NAME = "우리은행";
const ACCOUNT_NUMBER = "1002-367-160511";
const ACCOUNT_HOLDER = "이민제";

function regularPlanForMonths(months: number): MembershipPlan | null {
  return MEMBERSHIP_PLANS.find((plan) => plan.months === months) ?? null;
}

function remainingMembershipDays(planEndAt: string | null | undefined) {
  if (!planEndAt) return null;
  const endMs = Date.parse(planEndAt);
  if (!Number.isFinite(endMs)) return null;
  return Math.max(0, Math.ceil((endMs - Date.now()) / 86_400_000));
}

function feedOfferPlansFor(remainingDays: number | null): MembershipPlan[] {
  if (remainingDays === null || remainingDays <= 0) return [];
  if (remainingDays <= 45) {
    return RENEWAL_UPGRADE_PLANS.filter((plan) => ["limited_300_upgrade_to_6mo_50", "limited_300_upgrade_to_12mo_100"].includes(plan.key));
  }
  if (remainingDays <= 140) {
    return RENEWAL_UPGRADE_PLANS.filter((plan) => plan.key === "limited_300_upgrade_to_12mo_70");
  }
  if (remainingDays < 320) {
    return RENEWAL_UPGRADE_PLANS.filter((plan) => plan.key === "limited_300_upgrade_to_12mo_50");
  }
  return [];
}

function FeedMembershipUpsellCard({ remainingSec, planEndAt }: { remainingSec: number; planEndAt: string | null }) {
  const clamped = Math.max(0, remainingSec);
  const expired = clamped <= 0;
  const remainingDays = remainingMembershipDays(planEndAt);
  const offerPlans = useMemo(() => feedOfferPlansFor(remainingDays), [remainingDays]);
  const [selectedKey, setSelectedKey] = useState<MembershipPlanKey | null>(offerPlans[0]?.key ?? null);
  const [reservation, setReservation] = useState<FeedRenewalReservation | null>(null);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [requestState, setRequestState] = useState<"idle" | "submitting" | "reserved" | "depositing" | "deposit_sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const selectedPlan = selectedKey ? getMembershipPlan(selectedKey) : offerPlans[0];

  useEffect(() => {
    if (!offerPlans.length) return;
    if (!selectedKey || !offerPlans.some((plan) => plan.key === selectedKey)) {
      setSelectedKey(offerPlans[0].key);
    }
  }, [offerPlans, selectedKey]);

  if (!offerPlans.length || expired) return null;

  async function getAccessToken() {
    const supabase = getSupabaseBrowserClient();
    const { data } = supabase ? await supabase.auth.getSession() : { data: null };
    return data?.session?.access_token ?? null;
  }

  async function reserveOffer(plan: MembershipPlan) {
    setRequestState("submitting");
    setMessage(null);
    const token = await getAccessToken();
    if (!token) {
      setRequestState("error");
      setMessage("로그인 세션을 다시 확인해주세요.");
      return;
    }
    const res = await fetch("/api/membership/apply", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ productKey: plan.key, intent: "renewal" }),
    }).catch(() => null);
    const payload = (await res?.json().catch(() => null)) as { ok?: boolean; applicationId?: number | null; scheduledAutoApproveAt?: string | null } | null;
    if (!res?.ok || !payload?.ok) {
      setRequestState("error");
      setMessage("제안을 수락하지 못했어요. 잠시 후 다시 눌러주세요.");
      return;
    }
    setReservation({ applicationId: payload.applicationId ?? null, plan, scheduledAutoApproveAt: payload.scheduledAutoApproveAt ?? null });
    setRequestState("reserved");
    setMessage("제안이 수락됐어요. 계좌로 송금 후 입금했어요를 누르면 됩니다.");
  }

  async function notifyDepositDone() {
    setRequestState("depositing");
    setMessage(null);
    const token = await getAccessToken();
    if (!token) {
      setRequestState("error");
      setMessage("로그인 세션을 다시 확인해주세요.");
      return;
    }
    const res = await fetch("/api/membership/deposit-notify", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    const payload = (await res?.json().catch(() => null)) as { ok?: boolean; scheduledAutoApproveAt?: string | null } | null;
    if (!res?.ok || !payload?.ok) {
      setRequestState("error");
      setMessage("입금 확인 요청을 보내지 못했어요. 잠시 후 다시 눌러주세요.");
      return;
    }
    setReservation((current) => current ? { ...current, scheduledAutoApproveAt: payload.scheduledAutoApproveAt ?? current.scheduledAutoApproveAt } : current);
    setRequestState("deposit_sent");
    setMessage("입금 확인 요청 완료. 5분 내 자동 승인까지 같이 걸렸어요.");
  }

  const headline = "남은 기간을 1년권으로 전환";
  const subHeadline = remainingDays !== null && remainingDays <= 45
    ? "1개월 체험권을 고른 사람에게만 열리는 차액 조건이에요. 몇 만원만 더 내고 6개월/12개월권으로 바꿀 수 있어요."
    : `이미 남은 ${remainingDays ?? 0}일은 그대로 살리고, 부족한 기간만 차액으로 채워 1년권에 가깝게 맞춥니다.`;

  return (
    <section className="mb-3 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-[0_16px_45px_rgba(245,158,11,0.13)] dark:border-amber-900/50 dark:bg-zinc-900">
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-zinc-950 px-4 py-3 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-50">Member-only event</div>
            <div className="mt-0.5 break-keep text-[16px] font-black leading-5">{headline}</div>
          </div>
          <div className="shrink-0 rounded-xl bg-white/14 px-3 py-2 text-center ring-1 ring-white/20">
            <div className="text-[10px] font-black text-amber-50">남은 시간</div>
            <div className="mt-0.5 font-mono text-[17px] font-black tabular-nums">{expired ? "마감" : formatCooldown(clamped)}</div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {offerPlans.map((plan) => {
              const active = selectedPlan?.key === plan.key;
              return (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => setSelectedKey(plan.key)}
                  disabled={expired || requestState === "submitting"}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-black transition disabled:opacity-50 ${active ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950" : "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200"}`}
                >
                  {plan.label} · 차액 {membershipKrw(plan.priceKrw)}
                </button>
              );
            })}
          </div>
          <p className="mt-2 break-keep text-[12.5px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
            {subHeadline}
          </p>
        </div>
        {selectedPlan ? (
          <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-3 dark:border-amber-950/70 dark:bg-amber-950/20">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-[11px] font-black text-amber-700 dark:text-amber-300">{selectedPlan.label} 1시간 전환 조건</div>
                <div className="mt-1 text-[20px] font-black text-zinc-950 dark:text-zinc-50">{membershipKrw(selectedPlan.priceKrw)}</div>
                <div className="mt-0.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                  정가 {membershipKrw(regularPlanForMonths(selectedPlan.upgradeTargetMonths ?? selectedPlan.months)?.priceKrw ?? selectedPlan.priceKrw)}까지 다시 내는 게 아니라 차액만 받습니다.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOfferModalOpen(true);
                  setMessage(null);
                }}
                disabled={expired || requestState === "submitting"}
                className="flex h-10 items-center justify-center rounded-xl bg-zinc-950 px-4 text-[12px] font-black text-white transition hover:bg-amber-700 disabled:cursor-default disabled:opacity-50 dark:bg-white dark:text-zinc-950"
              >
                {expired ? "이벤트 마감" : "제안 수락"}
              </button>
            </div>
          </div>
        ) : null}
        {message ? (
          <p className={`break-keep text-[11px] font-bold leading-4 ${requestState === "error" ? "text-red-500" : "text-emerald-700 dark:text-emerald-300"}`}>
            {message}
          </p>
        ) : null}
      </div>
      {offerModalOpen && selectedPlan ? (
        <div className="fixed inset-0 z-[92] flex items-end justify-center bg-black/55 px-3 py-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-[460px] overflow-hidden rounded-[20px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="bg-gradient-to-r from-amber-500 to-zinc-950 px-4 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-50">
                    1시간 전환 제안
                  </div>
                  <div className="mt-1 break-keep text-[20px] font-black leading-tight">
                    {selectedPlan.label}으로 전환
                  </div>
                  <div className="mt-1 text-[12px] font-bold text-white/80">
                    남은 시간 {formatCooldown(clamped)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOfferModalOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 text-[18px] font-black text-white transition hover:bg-white/20"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="grid gap-3 px-4 py-4">
              <div className="rounded-[14px] border border-amber-100 bg-amber-50 px-3 py-3 dark:border-amber-950/70 dark:bg-amber-950/20">
                <div className="text-[11px] font-black text-amber-700 dark:text-amber-300">
                  오늘 차액
                </div>
                <div className="mt-1 text-[26px] font-black text-zinc-950 dark:text-zinc-50">
                  {membershipKrw(selectedPlan.priceKrw)}
                </div>
                <div className="mt-1 break-keep text-[12px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
                  기존 기간은 버리지 않고, 목표 기간까지 부족한 기간만 채우는 전환 조건입니다.
                </div>
              </div>
              {!reservation ? (
                <button
                  type="button"
                  onClick={() => void reserveOffer(selectedPlan)}
                  disabled={requestState === "submitting" || expired}
                  className="flex h-12 items-center justify-center rounded-xl bg-zinc-950 px-4 text-[14px] font-black text-white transition hover:bg-amber-700 disabled:cursor-default disabled:opacity-60 dark:bg-white dark:text-zinc-950"
                >
                  {requestState === "submitting" ? "수락 처리 중" : "제안 수락하고 계좌 보기"}
                </button>
              ) : (
                <div className="grid gap-3 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-3 dark:border-emerald-900/70 dark:bg-emerald-950/20">
                  <div className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                    제안 수락 완료 · 계좌이체 대기
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 text-[12px] font-bold leading-5 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                    {BANK_NAME} <b className="font-black">{ACCOUNT_NUMBER}</b>
                    <br />
                    예금주 {ACCOUNT_HOLDER}
                    <br />
                    입금 금액{" "}
                    <b className="text-emerald-700 dark:text-emerald-300">
                      {membershipKrw(reservation.plan.priceKrw)}
                    </b>
                  </div>
                  <button
                    type="button"
                    onClick={() => void notifyDepositDone()}
                    disabled={requestState === "depositing" || requestState === "deposit_sent"}
                    className="flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-[13px] font-black text-white transition hover:bg-emerald-800 disabled:cursor-default disabled:opacity-60"
                  >
                    {requestState === "depositing" ? "요청 중" : requestState === "deposit_sent" ? "입금 확인 요청 완료" : "입금했어요"}
                  </button>
                </div>
              )}
              {message ? (
                <p className={`break-keep text-[11px] font-bold leading-4 ${requestState === "error" ? "text-red-500" : "text-emerald-700 dark:text-emerald-300"}`}>
                  {message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
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

function recomputePoolProfit(
  price: number,
  marketPrice: number | null | undefined,
  item: Pick<PoolItem, "freeShipping" | "transactionMode" | "shippingAssumption" | "marketplaceSource" | "conditionChips" | "conditionClass" | "conditionTier">,
) {
  if (!marketPrice || marketPrice <= 0 || !price || price <= 0) return null;
  const buyShipping = buyerShippingForPoolItem(item);
  return expectedProfitFromMarketPrice({
    buyPrice: price,
    marketPrice,
    buyShipping,
    marketplaceSource: item.marketplaceSource,
    conditionChips: item.conditionChips,
    conditionClass: item.conditionClass,
    conditionTier: item.conditionTier,
  });
}

function accessValueForItem(item: PoolItem): DetailAccessValueSummary {
  const cautionCount = [
    item.sellerReviewCount < 10,
    (item.imageCount ?? 0) > 0 && (item.imageCount ?? 0) < 3,
    !item.freeShipping,
  ].filter(Boolean).length;

  return {
    openedCount: 1,
    expectedProfitTotal: Math.max(0, profitAvg(item)),
    cautionCount,
  };
}

function mergeAccessValueSummary(
  left: DetailAccessValueSummary | null,
  right: DetailAccessValueSummary,
): DetailAccessValueSummary {
  if (!left) return right;
  return {
    openedCount: left.openedCount + right.openedCount,
    expectedProfitTotal: left.expectedProfitTotal + right.expectedProfitTotal,
    cautionCount: left.cautionCount + right.cautionCount,
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
  const feedBasisSource = item.marketplaceSource === "daangn" ? "daangn" : null;
  const feedBasisSourceLabel = feedBasisSource ? "당근마켓" : null;
  const fallbackMarketBasis: RevealCard["marketBasis"] = {
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
    basisSource: feedBasisSource,
    basisSourceLabel: feedBasisSourceLabel,
    sourceFallbackUsed: false,
    sourceSampleCount: null,
    computedAt: null,
    excludedExamples: [],
    conditionClass: item.conditionClass,
    conditionLabel: null,
    fallbackUsed: false,
    otherConditions: [],
  };
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
    genericImageUrl: item.genericImageUrl ?? null,
    expectedProfitMin: item.expectedProfitMin,
    expectedProfitMax: item.expectedProfitMax,
    confidence: item.confidence ?? 0,
    band: (item.profitBand as 1 | 2 | 3) ?? null,
    marketBasis: item.marketBasis ?? fallbackMarketBasis,
    velocityBasis: item.velocityBasis ?? null,
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
      daangnMannerTemperature: item.daangnMannerTemperature ?? null,
      daangnReviewCount: item.daangnReviewCount ?? null,
      productTradeType: item.productTradeType ?? null,
      parcelFeeYn: item.parcelFeeYn ?? null,
      tradeLabels: item.tradeLabels ?? [],
      transactionMode: item.transactionMode === "direct_only" || item.transactionMode === "shipping_only" || item.transactionMode === "direct_and_shipping" ? item.transactionMode : "unknown",
      shippingAssumption: item.shippingAssumption === "direct_only" || item.shippingAssumption === "included" || item.shippingAssumption === "separate" || item.shippingAssumption === "free_shipping" ? item.shippingAssumption : "unknown",
      directTradeLocation: item.directTradeLocation ?? null,
    },
    skuListingFlow: item.skuListingFlow ?? null,
    optionBaseAssumed: item.optionBaseAssumed ?? null,
    // Wave 714k (2026-05-23): 신발/의류 5-tier grading + chips — 메인 feed 카드 클릭 → 상세 모달 path 전달.
    conditionTier: item.conditionTier ?? null,
    conditionCluster: item.conditionCluster ?? null,
    conditionConfidence: item.conditionConfidence ?? null,
    conditionFlags: item.conditionFlags ?? null,
    conditionChips: item.conditionChips ?? null,
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
  drone: "드론",
  speaker: "스피커",
  appliance: "가전",
  game_console: "게임기",
  sport_golf: "골프",
  desktop: "데스크탑",
  lego: "레고",
  camera: "카메라",
};

type TierBadgeCategory = "shoe" | "clothing" | "game_console" | "sport_golf";

const LATEST_TIER_PREVIEW_CATEGORIES = new Set<string>(["shoe", "clothing", "game_console", "sport_golf"]);

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

function usesLatestTierPreviewCategory(category: string | null | undefined) {
  return LATEST_TIER_PREVIEW_CATEGORIES.has(category ?? "");
}

function tierBadgeCategoryForItem(item: PoolItem): TierBadgeCategory | null {
  if (item.category === "clothing" || item.comparableKey?.startsWith("clothing|")) return "clothing";
  if (item.category === "shoe" || item.comparableKey?.startsWith("shoe|")) return "shoe";
  if (item.category === "game_console" || item.comparableKey?.startsWith("game_console|")) return "game_console";
  if (item.category === "sport_golf" || item.comparableKey?.startsWith("sport_golf|")) return "sport_golf";
  return null;
}

function lockedPreviewTitle(item: PoolItem) {
  if (usesLatestTierPreviewCategory(item.category)) return `${lockedPreviewCategoryLabel(item)} 후보`;
  return `${lockedPreviewCategoryLabel(item)} · ${conditionPreviewLabel(item.conditionClass)} 후보`;
}

function isFeedTeaserLocked(_item: PoolItem) {
  return false;
}

type SortOption = "profit_desc" | "latest" | "price_asc" | "distance";
type SourceOption = "all" | "bunjang" | "joongna" | "daangn";
type BudgetFilterOption = "all" | "150000" | "300000" | "500000";
type LoadPoolOptions = {
  autoScrollNew?: boolean;
  serverSource?: SourceOption | null;
  serverSort?: SortOption | null;
};

const SOURCE_OPTIONS: Array<{ value: SourceOption; label: string }> = [
  { value: "all", label: "출처 전체" },
  { value: "bunjang", label: "번개장터" },
  { value: "joongna", label: "중고나라" },
  { value: "daangn", label: "당근" },
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
  return { creditBalance: null, freeUsed: 0, freeLimit: DEFAULT_FREE_DETAIL_ACCESS_LIMIT, unlimited: false };
}

function normalizeDetailAccessSnapshot(
  value: unknown,
  options: { trustServerLimit?: boolean } = {},
): DetailAccessSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<DetailAccessSnapshot>;
  const rawFreeLimit = Number(record.freeLimit ?? DEFAULT_FREE_DETAIL_ACCESS_LIMIT);
  const normalizedFreeLimit = Math.max(0, Math.floor(rawFreeLimit));
  const freeLimit = options.trustServerLimit
    ? normalizedFreeLimit
    : Math.min(normalizedFreeLimit, DEFAULT_FREE_DETAIL_ACCESS_LIMIT);
  const freeUsed = Number(record.freeUsed ?? 0);
  const creditBalance = record.creditBalance == null ? null : Number(record.creditBalance);
  const unlimited = record.unlimited === true;
  if (!Number.isFinite(rawFreeLimit) || !Number.isFinite(freeLimit) || freeLimit < 0 || !Number.isFinite(freeUsed)) return null;
  return {
    creditBalance: creditBalance != null && Number.isFinite(creditBalance) ? creditBalance : null,
    freeUsed: unlimited ? freeLimit : Math.min(Math.max(0, freeUsed), freeLimit),
    freeLimit,
    unlimited,
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

function sourceOptionLabel(value: SourceOption) {
  return SOURCE_OPTIONS.find((option) => option.value === value)?.label ?? "출처 전체";
}

function poolItemSource(item: PoolItem): SourceOption {
  const source = String(item.marketplaceSource ?? "bunjang").toLowerCase();
  if (source === "joongna" || source === "daangn") return source;
  return "bunjang";
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

// Wave launch-49: DB sync — fetch user scraps from server.
//   localStorage 와 다른 점: device 간 sync, logout 후 복귀해도 유지, 5MB 한도 X.
//   호출 실패 시 caller 가 localStorage fallback.
async function fetchServerScraps(): Promise<ScrappedPoolItem[] | null> {
  try {
    const res = await fetch("/api/packs/scraps", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: Array<{ pid: number; pool_item: unknown; updated_at?: string; created_at?: string }> };
    if (!data.items) return [];
    return data.items
      .map((row) => {
        const item = row.pool_item as Record<string, unknown> | null;
        if (!item || typeof item !== "object") return null;
        const candidate = { ...item, pid: row.pid, savedAt: row.updated_at ?? row.created_at ?? new Date().toISOString() };
        return isScrappedPoolItem(candidate) ? candidate : null;
      })
      .filter((item): item is ScrappedPoolItem => item != null);
  } catch {
    return null;
  }
}

// Wave launch-49: API call wrappers — fail silently (localStorage 가 fallback).
async function postScrapToServer(item: ScrappedPoolItem): Promise<void> {
  try {
    await fetch("/api/packs/scraps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pid: item.pid, pool_item: item }),
    });
  } catch {
    // ignore — localStorage fallback
  }
}

async function deleteScrapFromServer(pid: number): Promise<void> {
  try {
    await fetch(`/api/packs/scraps?pid=${pid}`, { method: "DELETE" });
  } catch {
    // ignore
  }
}

async function importLocalScrapsToServer(items: ScrappedPoolItem[]): Promise<boolean> {
  if (items.length === 0) return true;
  try {
    const res = await fetch("/api/packs/scraps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: items.map((item) => ({ pid: item.pid, pool_item: item })) }),
    });
    return res.ok;
  } catch {
    return false;
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
    genericImageUrl: card.genericImageUrl ?? null,
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
    daangnMannerTemperature: card.savedDetail?.daangnMannerTemperature ?? null,
    daangnReviewCount: card.savedDetail?.daangnReviewCount ?? null,
    productTradeType: card.savedDetail?.productTradeType ?? null,
    parcelFeeYn: card.savedDetail?.parcelFeeYn ?? null,
    tradeLabels: card.savedDetail?.tradeLabels ?? [],
    transactionMode: card.savedDetail?.transactionMode ?? "unknown",
    shippingAssumption: card.savedDetail?.shippingAssumption ?? "unknown",
    directTradeLocation: card.savedDetail?.directTradeLocation ?? null,
    imageCount: card.savedDetail?.imageCount ?? null,
    descriptionPreview: card.savedDetail?.descriptionPreview ?? "",
    soldOut: false,
    marketBasis: card.marketBasis ?? null,
    velocityBasis: card.velocityBasis ?? null,
    skuListingFlow: card.skuListingFlow ?? null,
    optionBaseAssumed: card.optionBaseAssumed ?? null,
  };
}

function DetailAccessPaywallModal({
  state,
  onClose,
  kakaoShareReady,
  kakaoShareLoading,
  kakaoShareCooldownHours,
  onKakaoShare,
}: {
  state: DetailAccessLimitModal | null;
  onClose: () => void;
  // Wave launch-52/53: 카카오 공유 button — cooldown 시 비활성 + "N시간 후" 카피.
  kakaoShareReady: boolean;
  kakaoShareLoading: boolean;
  kakaoShareCooldownHours: number;
  onKakaoShare: () => void;
}) {
  if (!state) return null;
  void kakaoShareReady;
  void kakaoShareLoading;
  void kakaoShareCooldownHours;
  void onKakaoShare;
  const variant = state.variant ?? "paywall";
  const freeLimit = state.freeLimit && state.freeLimit > 0 ? state.freeLimit : DEFAULT_FREE_DETAIL_ACCESS_LIMIT;
  const freeUsed = Math.min(freeLimit, Math.max(0, state.freeUsed ?? freeLimit));
  const segments = Math.min(3, Math.max(1, freeLimit));
  const creditBalance = Math.max(0, Number(state.creditBalance ?? 0));
  void creditBalance;
  const summary = state.valueSummary ?? null;

  // Wave launch-14: variant 별 톤 분기.
  // Wave launch-106 (2026-05-24): profit_lost variant — sold 와 시각적으로 구분 (amber, 차트 아이콘).
  //   "판매완료" 톤 사용 절대 금지 — active 매물이지만 차익이 - 가 된 케이스.
  const isPaywall = variant === "paywall";
  const isSold = variant === "sold";
  const isProfitLost = variant === "profit_lost";
  const isVerifyFail = variant === "verify_fail";
  const iconBg = isPaywall ? "bg-[#eef6ff] text-[#3182f6] dark:bg-blue-950/50 dark:text-blue-300"
    : isSold ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
    : isProfitLost ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
    : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  const eyebrowText = isPaywall ? "멤버십 상세보기"
    : isSold ? "방금 거래된 상품"
    : isProfitLost ? "시세 하락"
    : "잠시 후 다시 시도";
  const eyebrowCls = isPaywall ? "text-[#3182f6] dark:text-blue-300"
    : isSold ? "text-rose-600 dark:text-rose-300"
    : isProfitLost ? "text-amber-700 dark:text-amber-300"
    : "text-amber-700 dark:text-amber-300";

  return (
    <div
      // Wave launch-88 (사용자 정정 — paywall 떠도 뒤 카드 사진/제목 다 보임):
      //   bg-black/45 + blur-[2px] 너무 약함 → 70% + blur-md 로 강화. 뒤 카드 사실상 안 보임.
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 px-3 pb-3 pt-10 backdrop-blur-md sm:items-center sm:p-6"
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
              {/* variant 별 아이콘 — paywall=번개, sold=원 안 X, profit_lost=↓ 화살표, verify_fail=시계 */}
              {isPaywall ? (
                <ZapIcon className="h-6 w-6" />
              ) : isSold ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9 9l6 6M15 9l-6 6" />
                </svg>
              ) : isProfitLost ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M3 7l6 6 4-4 8 8" />
                  <path d="M21 17v-6h-6" />
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

          {/* Wave launch-88 (사용자 정정 — 모바일 화면 안에 다 안 들어옴):
              4 row (header / progress / 설명 / 보유 정보) → 2 row 로 압축.
              설명 텍스트 제거 — 모달 body 와 의미 중복. progress bar h-2.5 → h-1.5 (얇게). */}
          {/* Wave 766 (2026-05-26 사용자 결정): FREE_DETAIL_ACCESS_LIMIT 폐기 후 progress bar 조건부 표시.
                기존: 모든 paywall 모달에 "무료 N/N 사용" + progress bar 박힘.
                신규: freeLimit > 0 일 때만 박힘 (현재 0 — 영구 hidden).
                승인 안내만 우측에 박음 (간결). */}
          {isPaywall ? (
            <div className="mt-4 rounded-[18px] bg-zinc-50 p-3 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                {freeLimit > 0 ? (
                  <span>무료 {freeUsed.toLocaleString("ko-KR")}/{freeLimit.toLocaleString("ko-KR")} 사용</span>
                ) : (
                  <span>지금까지 매물 <b className="text-zinc-700 dark:text-zinc-200">{summary?.openedCount ?? 0}개</b> 자세히 봄</span>
                )}
                <span>승인 후 이용 가능</span>
              </div>
              {freeLimit > 0 ? (
                <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }}>
                  {Array.from({ length: segments }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 rounded-full ${idx < Math.min(freeUsed, segments) ? "bg-[#3182f6]" : "bg-zinc-200 dark:bg-zinc-700"}`}
                    />
                  ))}
                </div>
              ) : null}
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

          {/* Wave launch-129 (2026-05-25): summary 3-col 카드 → 1줄 압축 (모달 세로 길이 줄이기). */}
          {isPaywall && summary && summary.openedCount > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] bg-[#f5f9ff] px-3.5 py-2.5 dark:bg-blue-950/24">
              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">방금 확인한 것</span>
              <span className="text-[12px] font-black text-[#3182f6] dark:text-blue-300">{summary.openedCount.toLocaleString("ko-KR")}건 분석</span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="text-[12px] font-black text-emerald-600 dark:text-emerald-400">예상수익 +{krw(summary.expectedProfitTotal)}</span>
            </div>
          ) : null}

          <div className="mt-5 grid gap-2">
            {isPaywall ? (
                <Link
                  href="/plans"
                  className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#3182f6] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#1c6fe8] active:scale-[0.98]"
                >
                  멤버십 신청하기
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

function FirstFeedOnboardingCard({
  selectedBudget,
  onSelectBudget,
  onDismiss,
}: {
  selectedBudget: BudgetFilterOption;
  onSelectBudget: (value: BudgetFilterOption) => void;
  onDismiss: () => void;
}) {
  const [step, setStep] = useState(0);
  const [pendingBudget, setPendingBudget] = useState<BudgetFilterOption>(selectedBudget);
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
          {/* Wave 905 (2026-05-28): 풀 통계 step 제거. 3 step = 의심 → 비교 예시 → 예산. */}
          <div className="flex gap-1.5" aria-label={`${step + 1}/3`}>
            {[0, 1, 2].map((idx) => (
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
          /* Wave launch-125b (2026-05-25): 의심 mirror — 카드 1개 + 사용자 머릿속 의심 그대로. */
          <div className="flex flex-1 flex-col justify-center pb-24">
            <div className="text-[13px] font-black text-[#3182f6] dark:text-blue-300">의심 한 번 짚고 갈게요</div>

            {/* 예시 매물 카드 1개 (의심 trigger 용). 사진은 public/intro/airpods-pro-2.jpg 박혀야 path 동작. */}
            <div className="mt-4 flex items-center gap-3 rounded-[18px] border border-zinc-200 bg-white px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/airpods-pro-2-used.jpg"
                alt="에어팟 프로 2세대"
                className="h-[80px] w-[80px] shrink-0 rounded-[14px] bg-zinc-100 object-cover dark:bg-zinc-800"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">A급 · 무료배송</div>
                <div className="mt-0.5 truncate text-[15px] font-black text-zinc-950 dark:text-zinc-50">에어팟 프로 2세대</div>
                {/* Wave launch-125c: 중고 시세 폰트 11→13. */}
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-[18px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">5만원</span>
                  <span className="text-[13px] font-bold text-zinc-500">중고 시세 15만</span>
                </div>
              </div>
            </div>

            <h2 className="mt-6 break-keep text-[22px] font-black leading-[1.32] tracking-tight">
              이 매물 중고 시세 15만원인데
              <br />
              <span className="text-[#3182f6] dark:text-blue-300">5만원</span>에 나왔다고…?
            </h2>
            {/* Wave launch-125c: "사람들은 보통 이렇게 생각" 줄 제거 (밑 인용박스로 의도 명확). 인용 폰트 16→22. */}
            <div className="mt-5 rounded-[18px] border-l-4 border-zinc-300 bg-white/60 px-4 py-5 text-[22px] font-black italic leading-[1.4] text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
              &ldquo;싼 데는 다 이유가 있겠지…&rdquo;
            </div>
          </div>
        ) : step === 1 ? (
          /* Wave launch-126 (2026-05-26 사용자 정정 — 맥락 끊김 fix):
               기존 step 1 = 뉴발란스 + 닥마 (다른 SKU) → 1페이지 에어팟 의심과 맥락 단절.
               신규 step 1 = 1페이지 에어팟 5만원 본 매물 + 같은 노캔 고장 상태 비교군 4개 (2열 grid).
               "다 같이 노캔 고장났는데도 다른 매물은 8-12만. 이 매물만 5만 = 진짜 싼 거다" 정면 반박. */
          <div className="flex flex-1 flex-col justify-center pb-24">
            <div className="text-[13px] font-black text-[#3182f6] dark:text-blue-300">근데 좀 이상한 거 잡았어요</div>
            <h2 className="mt-3 break-keep text-[22px] font-black leading-[1.28] tracking-tight">
              <span className="text-[#3182f6] dark:text-blue-300">같은 노캔 고장</span> 매물들인데
              <br />
              이 매물만 유독 싸요.
            </h2>

            {/* 본 매물 (1페이지 에어팟 5만원) 다시 강조. Wave launch-126b: 노캔 고장 chip 가독성 ↑. */}
            <div className="mt-4 rounded-[18px] border-2 border-[#3182f6] bg-blue-50/40 px-3.5 py-3 dark:border-blue-400 dark:bg-blue-950/20">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/airpods-pro-2-used.jpg"
                  alt="에어팟 프로 2세대"
                  className="h-[64px] w-[64px] shrink-0 rounded-[14px] bg-zinc-100 object-cover dark:bg-zinc-800"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="inline-flex items-center gap-0.5 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-600 dark:bg-red-950/40 dark:text-red-400">
                      <span aria-hidden>⚠</span>
                      노캔 고장
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#3182f6] dark:text-blue-300">이 매물</span>
                  </div>
                  <div className="mt-1 truncate text-[14px] font-black text-zinc-950 dark:text-zinc-50">에어팟 프로 2세대</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-[16px] font-black tabular-nums text-emerald-600 dark:text-emerald-400">5만원</span>
                    <span className="text-[10px] font-bold text-zinc-500">매입가 5만 · 시세 11만</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">같은 상태 비교 매물 4개</div>
            {/* Wave launch-126b (2026-05-26 사용자 정정):
                 - 사진 가로 너무 김 → aspect-square 정사각형 비율
                 - "노캔 고장" 라벨 가독성 ↑ — 빨간 chip + 아이콘
                 - public/노캔고장/ 폴더에 실제 비교 매물 사진 4개 박힘 (mock 통일성 ↑) */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { price: "8만원", note: "매입가 8만 · 시세 11만", img: "/%EB%85%B8%EC%BA%94%EA%B3%A0%EC%9E%A5/293736980_1_1728653235_w360.webp" },
                { price: "9만원", note: "매입가 9만 · 시세 11만", img: "/%EB%85%B8%EC%BA%94%EA%B3%A0%EC%9E%A5/338081393_1_1749305909_w360.webp" },
                { price: "11만원", note: "매입가 11만 · 시세 11만", img: "/%EB%85%B8%EC%BA%94%EA%B3%A0%EC%9E%A5/408223471_1_1778837408_w360.webp" },
                { price: "12만원", note: "매입가 12만 · 시세 11만", img: "/%EB%85%B8%EC%BA%94%EA%B3%A0%EC%9E%A5/art_1667266173.jpg" },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-2 rounded-[14px] border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.img}
                    alt=""
                    className="h-[64px] w-[64px] shrink-0 rounded-[10px] bg-zinc-100 object-cover dark:bg-zinc-800"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="inline-flex items-center gap-0.5 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-600 dark:bg-red-950/40 dark:text-red-400">
                      <span aria-hidden>⚠</span>
                      노캔 고장
                    </div>
                    <div className="mt-1 text-[14px] font-black tabular-nums text-zinc-900 dark:text-zinc-100">{item.price}</div>
                    <div className="mt-0.5 text-[10px] font-bold leading-tight text-zinc-500">{item.note}</div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 break-keep text-[13px] font-bold leading-5 text-zinc-600 dark:text-zinc-400">
              <span className="font-black text-[#3182f6] dark:text-blue-300">결함은 다 같음</span> — 그런데 이 매물만 절반 가격. <span className="font-black">진짜 싼 매물이라는 뜻</span>이에요.
            </p>
            <p className="mt-2 text-[11px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
              ※ 예시 매물. 실제 추천은 다음 화면부터.
            </p>
          </div>
        ) : (
          /* step === 2 — 예산. */
          <div className="flex flex-1 flex-col justify-center pb-24">
            {/* Wave launch-104: "감당 가능한" + "후보" 어색 → "예산" + "상품" 친화 카피. */}
            <div className="text-[13px] font-black text-[#3182f6] dark:text-blue-300">예산</div>
            <h2 className="mt-3 break-keep text-[34px] font-black leading-[1.12] tracking-tight sm:text-[42px]">
              중고 상품
              <br />
              금액대는 어떤 게 좋아요?
            </h2>
            <p className="mt-5 break-keep text-[16px] font-bold leading-7 text-zinc-600 dark:text-zinc-300">
              해당 금액대 상품이 적으면 좋은 걸 놓치지 않게 전체 상품도 같이 보여드려요. 예산은 위 필터에서 언제든 바꿀 수 있어요.
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
            {/* Wave 905: 3 step CTA — 의심 → 답/예시 → 예산. */}
            {step === 0 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex min-h-[56px] w-full items-center justify-center rounded-[20px] bg-[#3182f6] text-[16px] font-black text-white shadow-[0_14px_34px_rgba(49,130,246,0.28)] active:scale-[0.99]"
              >
                근데, 진짜 다른가요? →
              </button>
            ) : step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(2)}
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailAccessSnapshot, setDetailAccessSnapshot] = useState<DetailAccessSnapshot>(() => readDetailAccessSnapshot(storageScope));
  const [feedExhausted, setFeedExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailAccessLimit, setDetailAccessLimit] = useState<DetailAccessLimitModal | null>(null);
  // Wave launch-93: paywall 노출 이력은 모달 가치 요약/후속 CTA에만 사용한다.
  const [, setHasSeenPaywall] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(`minyoi:has-seen-paywall:${storageScope}`) === "1"; } catch { return false; }
  });
  const markPaywallSeen = useCallback(() => {
    setHasSeenPaywall(true);
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(`minyoi:has-seen-paywall:${storageScope}`, "1"); } catch {}
  }, [storageScope]);
  const [detailAccessLoadingPid, setDetailAccessLoadingPid] = useState<number | null>(null);
  const openedDetailPidsRef = useRef<Set<number>>(new Set());
  const [openedDetailPids, setOpenedDetailPids] = useState<Set<number>>(() => new Set());
  const detailAccessValueRef = useRef<DetailAccessValueSummary | null>(null);
  const [scrapItems, setScrapItems] = useState<ScrappedPoolItem[]>([]);
  const [legacySavedPids, setLegacySavedPids] = useState<Set<number>>(() => new Set());
  const [now, setNow] = useState(Date.now());
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatusSnapshot | null>(null);
  const [selectedCard, setSelectedCard] = useState<RevealCard | null>(null);
  const detailSessionIdRef = useRef<string | null>(null);
  // Wave 346: refresh modal — 기다리기/충전 옵션
  // Wave 358: 슬라이드 업 애니메이션 — open/close 사이 250ms transition.
  const [refreshModalOpen, setRefreshModalOpen] = useState(false);
  const [refreshModalAnimating, setRefreshModalAnimating] = useState(false);

  // Wave launch-51: Kakao share state.
  const [kakaoShareReady, setKakaoShareReady] = useState(false);
  const [kakaoShareLoading, setKakaoShareLoading] = useState(false);
  // Wave launch-53 (사용자 짚음 "하루 1번이면 button 비활성/알림"):
  //   cooldown 상태 mount 시 fetch. cooldown 안이면 button 비활성 + "N시간 후 다시" 카피.
  const [kakaoShareCooldownHours, setKakaoShareCooldownHours] = useState<number>(0);
  // Wave 738 (2026-05-24): 카톡 공유 → webhook → DB UPDATE → Supabase Realtime → 토스트.
  //   legacy balance toast path. 멤버십 모델에서는 user-facing credit badge 를 노출하지 않는다.
  // Wave 746 (2026-05-24): 카톡 공유 토스트는 BalanceToast (layout.tsx) 가 universal 처리.
  //   여기는 cooldown UI 갱신만 — minyoi:share-bonus-received event listen.

  // mount 시 cooldown 상태 fetch (인증 안 됐으면 fail → 0 으로 가정)
  useEffect(() => {
    if (typeof window === "undefined") return;
    void (async () => {
      try {
        const res = await fetch("/api/packs/pool/share-bonus", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { canShare?: boolean; remainingHours?: number };
        if (data.canShare === false && typeof data.remainingHours === "number") {
          setKakaoShareCooldownHours(data.remainingHours);
        } else {
          setKakaoShareCooldownHours(0);
        }
      } catch {
        // ignore — button 활성 유지
      }
    })();
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: null };
      const token = data?.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/membership/status", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }).catch(() => null);
      if (!res?.ok || !alive) return;
      const payload = (await res.json().catch(() => null)) as MembershipStatusSnapshot | null;
      if (alive) setMembershipStatus(payload);
    })();
    return () => { alive = false; };
  }, []);

  // Wave 746 (2026-05-24): cooldown UI 갱신만 — BalanceToast 가 last_share_bonus_at 변경 감지 시
  //   "minyoi:share-bonus-received" event 발생. 그것 listen 해서 button 비활성 갱신.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setKakaoShareCooldownHours(24);
    window.addEventListener("minyoi:share-bonus-received", handler);
    return () => window.removeEventListener("minyoi:share-bonus-received", handler);
  }, []);

  // SDK init — script tag 로드 끝나면 window.Kakao 사용 가능. polling 으로 확인 (script async).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!jsKey) return;  // env 없으면 button disabled 유지

    let attempts = 0;
    const maxAttempts = 50;  // 5초 timeout (100ms × 50)
    const poll = window.setInterval(() => {
      attempts += 1;
      const kakao = (window as unknown as { Kakao?: { isInitialized: () => boolean; init: (key: string) => void } }).Kakao;
      if (kakao) {
        if (!kakao.isInitialized()) {
          try { kakao.init(jsKey); } catch (err) { console.warn("Kakao init failed", err); }
        }
        setKakaoShareReady(kakao.isInitialized());
        window.clearInterval(poll);
      } else if (attempts >= maxAttempts) {
        window.clearInterval(poll);
      }
    }, 100);
    return () => window.clearInterval(poll);
  }, []);

  // 공유 button click handler
  const handleKakaoShare = useCallback(async () => {
    if (typeof window === "undefined" || kakaoShareLoading) return;
    // Wave launch-53: cooldown 안이면 카카오 다이얼로그 띄우지 X. alert 으로 안내.
    if (kakaoShareCooldownHours > 0) {
      window.alert(`오늘은 이미 받았어요! ${kakaoShareCooldownHours}시간 후 다시 받을 수 있어요`);
      return;
    }
    const kakao = (window as unknown as {
      Kakao?: {
        isInitialized: () => boolean;
        Share?: {
          sendDefault: (config: Record<string, unknown>) => void;
        };
      };
    }).Kakao;
    if (!kakao?.Share?.sendDefault || !kakao.isInitialized()) {
      return;
    }

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://minyoi-mvp.vercel.app";
    const shareUrl = `${baseUrl}?ref=kakao_share`;

    try {
      // Wave 741 (2026-05-24 사용자 정정): sendDefault 복원. 사용자가 정한 카피/CTA 유지.
      //   block URL 원인은 제품 링크 관리 도메인 미등록 (4002). 사용자가 등록 후 sendDefault 정상 작동.
      const imageUrl = `${baseUrl}/new_balance.jpeg`;
      kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: "지금 팔면 바로 돈 되는 중고 상품이 있어요",
          description: "AI 가 매일 찾아주는 차익 상품, 지금 무료로 확인해보세요!",
          imageUrl,
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl,
          },
        },
        buttons: [
          {
            title: "지금 바로가기",
            link: {
              mobileWebUrl: shareUrl,
              webUrl: shareUrl,
            },
          },
        ],
        serverCallbackArgs: {
          user_id: storageScope && storageScope !== "anonymous" ? storageScope : "",
        },
      });

      // Wave 738 (2026-05-24): 다이얼로그 닫힘 → Supabase Realtime 이 webhook→DB UPDATE 감지 시
      //   클라이언트로 즉시 push (useEffect 의 subscription 이 처리). polling 불필요.
      //   app-nav 가 "minyoi:credits-changed" event listen → 자동 refetch + UI 갱신.
    } catch (err) {
      console.error("kakao share failed", err);
    } finally {
      // Wave 739 (2026-05-24): 모달 닫기 + loading 해제를 finally 안으로 이동.
      //   sendDefault throw 시에도 모달이 stuck 안 되게 — 사용자 답답함 차단.
      setRefreshModalOpen(false);
      setKakaoShareLoading(false);
    }
  }, [kakaoShareCooldownHours, kakaoShareLoading, storageScope]);
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
    return raw === "latest" || raw === "price_asc" || raw === "distance" ? raw : "profit_desc";
  });
  const [source, setSource] = useState<SourceOption>(() => {
    const raw = searchParams.get("source");
    return raw === "bunjang" || raw === "joongna" || raw === "daangn" ? raw : "all";
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
  const sortRef = useRef(sort);
  const sourceRef = useRef(source);
  useEffect(() => {
    sortRef.current = sort;
  }, [sort]);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  const updateBudgetFilter = useCallback((value: BudgetFilterOption) => {
    setBudgetFilter(value);
    setFeedExhausted(false);
    writeBudgetFilterOption(storageScope, value);
  }, [storageScope]);

  // Wave launch-49: scrap localStorage → DB hybrid.
  //   1) localStorage 의 기존 scrap 으로 즉시 표시 (빠른 mount, offline)
  //   2) background 에서 DB GET → server source 가 진짜 (device sync)
  //   3) localStorage 에만 있던 매물 (legacy) → DB 로 1회 import + localStorage 유지 (cache)
  useEffect(() => {
    const loadedScraps = loadScrapSnapshots();
    const loadedPids = readLocalSavedPidSet();
    loadedScraps.forEach((item) => openedDetailPidsRef.current.add(item.pid));
    loadedPids.forEach((pid) => openedDetailPidsRef.current.add(pid));
    setOpenedDetailPids(new Set(openedDetailPidsRef.current));
    setScrapItems(loadedScraps);
    setLegacySavedPids(loadedPids);

    // Background DB sync — server source 가 진짜.
    void (async () => {
      const serverScraps = await fetchServerScraps();
      if (serverScraps == null) return;  // auth fail 또는 network — localStorage 유지
      // localStorage 에만 있던 매물 import (server 누락분 backfill)
      const serverPidSet = new Set(serverScraps.map((item) => item.pid));
      const localOnly = loadedScraps.filter((item) => !serverPidSet.has(item.pid));
      if (localOnly.length > 0) {
        await importLocalScrapsToServer(localOnly);
        // import 후 다시 fetch 해서 server 가 진짜 source
        const reFetched = await fetchServerScraps();
        if (reFetched) {
          setScrapItems(reFetched);
          saveScrapSnapshots(reFetched);  // localStorage cache 동기화
          reFetched.forEach((item) => openedDetailPidsRef.current.add(item.pid));
          setOpenedDetailPids(new Set(openedDetailPidsRef.current));
        }
        return;
      }
      // server 매물이 더 많거나 다름 → server 가 진짜
      if (serverScraps.length !== loadedScraps.length || serverScraps.some((it, idx) => loadedScraps[idx]?.pid !== it.pid)) {
        setScrapItems(serverScraps);
        saveScrapSnapshots(serverScraps);
        serverScraps.forEach((item) => openedDetailPidsRef.current.add(item.pid));
        setOpenedDetailPids(new Set(openedDetailPidsRef.current));
      }
    })();
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
  const feedUpsellRemainingSec = useMemo(() => {
    const expiresAt = membershipStatus?.activePlan?.memberOfferExpiresAt;
    if (!expiresAt) return 0;
    const expiresAtMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresAtMs)) return 0;
    return Math.max(0, Math.ceil((expiresAtMs - now) / 1000));
  }, [membershipStatus?.activePlan?.memberOfferExpiresAt, now]);

  const canRefresh = true;

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

  // Wave 894 (2026-05-28): source/sort/category는 현재 로드된 피드 snapshot 안에서만 적용한다.
  // 예산만 서버 재조회 — 사용자가 "지금 보고 있는 매물"을 정렬/출처 필터한다고 느끼기 때문.
  // "더 찾아보기"에서만 serverSource를 받아 현재 출처 조건의 추가 후보를 더 가져올 수 있게 한다.
  const loadPool = useCallback(async (
    refresh: boolean,
    options?: LoadPoolOptions,
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
      const serverSource = options?.serverSource ?? sourceRef.current;
      if (serverSource !== "all") params.set("source", serverSource);
      const serverSort = options?.serverSort ?? (sortRef.current === "distance" ? "distance" : null);
      if (serverSort === "distance") params.set("sort", "distance");
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
        if (data.detailAccess) {
          const nextDetailAccess = normalizeDetailAccessSnapshot(data.detailAccess, { trustServerLimit: true }) ?? defaultDetailAccessSnapshot();
          setDetailAccessSnapshot(nextDetailAccess);
          writeDetailAccessSnapshot(storageScope, nextDetailAccess);
        }
      } else {
        // Wave launch-39 (사용자 짚음): "빨간 위에 뭐 깜빡깜빡". error 가 set 되어도
        // feedExhausted 안 박혀서 IntersectionObserver 가 sentinel 보고 또 loadPool(true)
        // → 또 error → 빨간 box 들였다 사라졌다 반복. error 발생 시도 feedExhausted=true
        // 박아서 자동 retry 자체 차단. 사용자가 직접 새로고침 누르도록.
        setError(data.message ?? "매물을 잠시 못 가져왔어요. 잠시 후 다시 시도해주세요.");
        setFeedExhausted(true);
      }
    } catch (e) {
      // 네트워크 끊김도 동일 — 무한 retry 차단.
      setError(e instanceof Error && e.message ? e.message : "네트워크가 잠시 불안정해요. 잠시 후 다시 시도해주세요.");
      setFeedExhausted(true);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [budgetFilter, storageScope]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats/pool", { cache: "no-store" });
      if (res.ok) setStats((await res.json()) as StatsResponse);
    } catch {
      // 통계 실패는 무시
    }
  }, []);

  // 초기 1회 통계 fetch. 서버 예산/성향 게이트 제거 상태를 유지한다.
  useEffect(() => {
    void loadStats();
  }, [loadStats]);

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

  // 예산 변경 시 자동 재로드. 출처/정렬/카테고리는 현재 피드 snapshot 에서만 적용한다.
  // Wave launch-48 (사용자 짚음 "예산 선택 모달 뒤에 50만 매물 이미 보임"):
  //   onboarding modal 떠 있으면 fetch skip. 사용자 예산 선택 후 first fetch.
  //   selectFirstFeedBudget = setBudgetFilter + dismissFirstFeedOnboarding → 두 state batch update
  //   → useEffect 재실행 (showFirstFeedOnboarding=false + budgetFilter 변경) → loadPool(false) 호출.
  useEffect(() => {
    if (showFirstFeedOnboarding) return;
    void loadPool(false);
  }, [loadPool, showFirstFeedOnboarding]);

  // Feed browsing is manual now. Auto-infinite loading made the feed feel like a free shopping catalog,
  // while the paid value sits in detail access.

  // Wave 353: 클라이언트 사이드 카테고리 필터. 전체 풀(items)에서 selectedCategories에 속한 매물만.
  // category가 null이면 selectedCategories 활성 시 제외 (안전).
  const displayItems = useMemo(() => {
    if (scrapOnly) return scrapItems;
    const categoryFiltered = selectedCategories.size === 0
      ? items
      : items.filter((it) => it.category != null && selectedCategories.has(it.category));
    const sourceFiltered = source === "all"
      ? categoryFiltered
      : categoryFiltered.filter((it) => poolItemSource(it) === source);
    const budgetFiltered = budgetOption.max
      ? sourceFiltered.filter((it) => it.price > 0 && it.price <= budgetOption.max!)
      : sourceFiltered;

    // Wave launch-47 (사용자 짚음 "매입단가순인데 뒤에 더 싼게 나옴"):
    //   backend 가 PAGE_SIZE 30 단위로만 정렬 → frontend append 시 batch 별 정렬 유지되어
    //   전체 순서 깨짐. client-side 에서 전체 items 정렬 박음.
    //   profit_desc 는 backend 가 다양화 + random shuffle 이라 client sort X.
    if (sort === "price_asc") {
      return [...budgetFiltered].sort((a, b) => {
        if (a.price !== b.price) return a.price - b.price;
        return b.expectedProfitMax - a.expectedProfitMax;
      });
    }
    if (sort === "latest") {
      return [...budgetFiltered].sort((a, b) => {
        const aTime = a.lastVerifiedAt ? Date.parse(a.lastVerifiedAt) : 0;
        const bTime = b.lastVerifiedAt ? Date.parse(b.lastVerifiedAt) : 0;
        return bTime - aTime;
      });
    }
    if (sort === "distance") {
      return [...budgetFiltered].sort((a, b) => {
        const aDaangn = poolItemSource(a) === "daangn";
        const bDaangn = poolItemSource(b) === "daangn";
        if (aDaangn !== bDaangn) return aDaangn ? -1 : 1;
        if (aDaangn && bDaangn) {
          const aRank = a.daangnDistanceRank ?? 4;
          const bRank = b.daangnDistanceRank ?? 4;
          if (aRank !== bRank) return aRank - bRank;
          const aDistance = a.daangnDistanceKm ?? Number.POSITIVE_INFINITY;
          const bDistance = b.daangnDistanceKm ?? Number.POSITIVE_INFINITY;
          if (aDistance !== bDistance) return aDistance - bDistance;
        }
        return b.expectedProfitMax - a.expectedProfitMax;
      });
    }
    return budgetFiltered;
  }, [budgetOption.max, items, scrapItems, scrapOnly, selectedCategories, sort, source]);

  const currentServerSourceFilter = source !== "all" ? source : null;
  const currentViewFilterLabel = useMemo(() => {
    if (scrapOnly) return "스크랩";
    const labels: string[] = [];
    if (source !== "all") labels.push(sourceOptionLabel(source));
    if (selectedCategories.size > 0) labels.push("선택 카테고리");
    if (budgetFilter !== "all") labels.push(budgetOption.label);
    return labels.join(" · ");
  }, [budgetFilter, budgetOption.label, scrapOnly, selectedCategories.size, source]);
  const isDaangnFocusedView = source === "daangn" || sort === "distance";
  const loadingCopy = isDaangnFocusedView
    ? {
        title: "근처 당근 매물부터 확인 중",
        description: "내 동네와 가까운 ready 매물을 먼저 고르고 있어요.",
      }
    : {
        title: "오늘 볼 만한 매물을 고르는 중",
        description: "수익성, 상태, 거래 가능성을 같이 확인하고 있어요.",
      };

  // Wave 801 (2026-05-30): 메인 피드 로딩 진행 단계 표시.
  //   당근 거리 정렬 때문에 첫 진입 시 오래 걸리는 경향 — 사용자가 "멈췄나" 걱정하지 않게
  //   단계별 progress UI 제공. timer 기반 (실제 server progress 가 아닌 fake stage).
  const loadingStages = isDaangnFocusedView
    ? [
        "내 동네 좌표 확인",
        "근처 당근 ready 매물 후보 수집",
        "수익·시세·상태 검증 + AI 차익 산정",
        "거리 가까운 순으로 정렬",
      ]
    : [
        "오늘 등록된 매물 후보 수집",
        "수익·시세·상태 검증",
        "AI 차익 산정",
        "추천 순으로 정렬",
      ];
  const [loadingStage, setLoadingStage] = useState(0);
  useEffect(() => {
    if (!loading) {
      setLoadingStage(0);
      return;
    }
    setLoadingStage(1);
    const t1 = setTimeout(() => setLoadingStage(2), isDaangnFocusedView ? 1200 : 700);
    const t2 = setTimeout(() => setLoadingStage(3), isDaangnFocusedView ? 2800 : 1800);
    const t3 = setTimeout(() => setLoadingStage(4), isDaangnFocusedView ? 4500 : 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [loading, isDaangnFocusedView]);

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
  // Wave 752 (2026-05-25): 각 매물별 lockedPreview 계산 → 잠금 매물은 strip 에서도 블러 + 차익/가격 숨김.
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
    return ordered.map((it) => {
      // Wave 752 (2026-05-25): feed 카드 lockedPreview 와 동일 로직.
      const teaserLocked = isFeedTeaserLocked(it);
      const exactUnlocked = !teaserLocked || scrapOnly || savedPidSet.has(it.pid) || openedDetailPids.has(it.pid);
      const locked = !exactUnlocked;
      return {
        pid: it.pid,
        name: it.name,
        price: it.price,
        thumbnailUrl: it.thumbnailUrl,
        genericImageUrl: it.genericImageUrl ?? null,
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
              basisSource: it.marketplaceSource === "daangn" ? "daangn" : null,
              basisSourceLabel: it.marketplaceSource === "daangn" ? "당근마켓" : null,
              sourceFallbackUsed: false,
              sourceSampleCount: null,
              computedAt: null,
              excludedExamples: [],
              conditionClass: it.conditionClass,
              conditionLabel: null,
              fallbackUsed: false,
              otherConditions: [],
            }
          : null,
        revealedAt: it.lastVerifiedAt,
        locked,
        category: it.category,
      };
    });
  }, [items, selectedCard, scrapOnly, savedPidSet, openedDetailPids]);

  const openItemDetail = useCallback(async (item: PoolItem) => {
    if (item.soldOut) return;
    setDetailAccessLoadingPid(item.pid);
    setDetailAccessLimit(null);
    try {
      const res = await fetch("/api/packs/pool/detail-access", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-minyoi-user-action": "1" },
        body: JSON.stringify(item.accessToken ? { accessToken: item.accessToken } : { pid: item.pid }),
        cache: "no-store",
      });
      const data = (await res.json()) as DetailAccessResponse;
      if (!res.ok) {
        const freeLimit = Number.isFinite(Number(data.freeLimit)) ? Number(data.freeLimit) : null;
        const freeUsed = Number.isFinite(Number(data.freeUsed)) ? Number(data.freeUsed) : null;
        const creditBalance = Number.isFinite(Number(data.creditBalance)) ? Number(data.creditBalance) : null;
        if (freeLimit != null && freeUsed != null) {
          const nextDetailAccess = normalizeDetailAccessSnapshot(
            { creditBalance, freeUsed, freeLimit },
            { trustServerLimit: true },
          ) ?? defaultDetailAccessSnapshot();
          setDetailAccessSnapshot(nextDetailAccess);
          writeDetailAccessSnapshot(storageScope, nextDetailAccess);
        }
        // Wave launch-14: error code 따라 다른 variant.
        // - membership_required / insufficient_credits / free_limit_exhausted = membership paywall
        // - not_ready (매물 거래완료/사라짐/검증 실패) = sold variant ("방금 거래된 상품이에요" 톤)
        // - live_verify_unavailable = verify_fail variant ("잠시 통신 불안정" 톤)
        // - detail_access_required (보관함 race) = paywall variant
        // Wave launch-106 (2026-05-24): not_ready + reason="profit_lost" = profit_lost variant
        //   (active 매물인데 시세 갱신으로 차익이 - 가 된 케이스. "판매완료" 라벨 절대 X.)
        const isMembershipRequired = data.error === "membership_required";
        const isCreditShort = data.error === "insufficient_credits";
        const isLiveVerifyFail = data.error === "live_verify_unavailable";
        const isNotReady = data.error === "not_ready";
        const isProfitLost = isNotReady && data.reason === "profit_lost";
        const variant: DetailAccessLimitVariant = isCreditShort
          ? "paywall"
          : isLiveVerifyFail
            ? "verify_fail"
            : isProfitLost
              ? "profit_lost"
              : isNotReady
                ? "sold"
                : "paywall"; // detail_access_required 등 기타 = paywall fallback
        const titleByVariant =
          variant === "paywall"     ? (isMembershipRequired ? "멤버십 승인이 필요해요" : isCreditShort ? "멤버십 신청이 필요해요" : "상세보기를 열 수 없어요") :
          variant === "sold"        ? "방금 거래된 상품이에요" :
          variant === "profit_lost" ? "시세가 떨어져서 차익이 사라졌어요" :
                                      "잠시 통신이 불안정해요";
        // Wave launch-128 (2026-05-25): paywall 메시지 가치 포지셔닝 강화.
        const defaultMessageByVariant =
          variant === "paywall"     ? "선공개 멤버십 승인 후 시세 비교, 비용 계산, 원본 링크까지 볼 수 있어요." :
          variant === "sold"        ? "이 매물은 방금 다른 곳에서 거래되었거나 셀러가 내린 것 같아요. 새로고침하면 다른 매물을 보여드릴게요." :
          variant === "profit_lost" ? "지금 사면 손해예요. 새로고침하면 다른 매물 보여드릴게요." :
                                      "원본 매물 확인이 잠시 실패했어요. 상세 이용에는 영향 없어요. 잠시 후 다시 시도해주세요.";
        setDetailAccessLimit({
          variant,
          title: titleByVariant,
          message: data.message ?? defaultMessageByVariant,
          creditBalance,
          freeUsed,
          freeLimit,
          valueSummary: detailAccessValueRef.current,
        });
        // Wave launch-93: paywall variant 시 잠금 trigger. sold/verify_fail 은 카드 잠금 X (다른 issue).
        if (variant === "paywall") markPaywallSeen();
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
      if (data.freeLimit != null && data.freeUsed != null) {
        const nextDetailAccess = normalizeDetailAccessSnapshot(
          {
            creditBalance: data.creditBalance ?? null,
            freeUsed: data.freeUsed,
            freeLimit: data.freeLimit,
            unlimited: data.unlimited,
          },
          { trustServerLimit: true },
        ) ?? defaultDetailAccessSnapshot();
        setDetailAccessSnapshot(nextDetailAccess);
        writeDetailAccessSnapshot(storageScope, nextDetailAccess);
      }
      const exactItem = data.item ?? item;
      if (data.item) {
        setItems((prev) => prev.map((candidate) => (candidate.pid === item.pid ? data.item! : candidate)));
      }
      // Wave 766 (2026-05-26 사용자 결정): FREE_CREDIT_GRANT=2 통일 후 accessType="free" 가 사라짐.
      //   기존 분기: accessType === "free" → valueSummary 누적 (paywall 첫 도달 design "방금 확인한 것" 박스).
      //   신규 분기: 누적 reveal ≤ 2 (첫 2개 reveal) → valueSummary 누적 (스크린샷 #1 design 보존).
      const cumulativeReveals = openedDetailPidsRef.current.size;
      const isInitialPhase = cumulativeReveals < 2;
      if (!data.alreadyOpened && isInitialPhase) {
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
  }, [beginDetailSession, markPaywallSeen, storageScope, trackDetailEvent]);

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
        // Wave launch-49: DB sync — fire and forget, localStorage 가 fallback
        void deleteScrapFromServer(pid);
        return withoutTarget;
      }

      const sourceItem =
        items.find((item) => item.pid === pid) ??
        prev.find((item) => item.pid === pid) ??
        (selectedCard?.pid === pid ? revealCardToPoolItem(selectedCard) : null);
      if (!sourceItem) return prev;

      openedDetailPidsRef.current.add(pid);
      setOpenedDetailPids(new Set(openedDetailPidsRef.current));
      const newScrap: ScrappedPoolItem = { ...sourceItem, savedAt: new Date().toISOString() };
      const next = [newScrap, ...withoutTarget].slice(0, MAX_LOCAL_SCRAP_SNAPSHOTS);
      saveScrapSnapshots(next);
      // Wave launch-49: DB sync — fire and forget
      void postScrapToServer(newScrap);
      return next;
    });
  }, [items, selectedCard, trackDetailEvent]);

  // Wave 339b: /api/packs/pool/analysis로 marketBasis/velocityBasis lazy-fill.
  // assertRevealAccess 우회 (pid 기반). 가져온 분석으로 selectedCard 갱신.
  const handleLoadDetail = useCallback(async (pid: number): Promise<RevealListingDetail> => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/packs/pool/analysis?pid=${pid}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      });
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
              marketplaceSource: prev.marketplaceSource ?? null,
              conditionChips: prev.conditionChips ?? null,
              conditionClass: prev.marketBasis?.conditionClass ?? null,
              conditionTier: prev.conditionTier ?? null,
            });
            const strictSourceMissing = marketBasis?.sourceFallbackUsed === true && marketBasis.medianPrice == null;
            return {
              ...prev,
              expectedProfitMin: strictSourceMissing ? 0 : (recomputedProfit?.min ?? prev.expectedProfitMin),
              expectedProfitMax: strictSourceMissing ? 0 : (recomputedProfit?.max ?? prev.expectedProfitMax),
              marketBasis: marketBasis ?? prev.marketBasis,
              velocityBasis: data.analysis!.velocityBasis ?? prev.velocityBasis,
              skuListingFlow: data.analysis!.skuListingFlow ?? prev.skuListingFlow,
              optionBaseAssumed: data.analysis!.optionBaseAssumed ?? prev.optionBaseAssumed,
            };
          });
          setItems((prev) => prev.map((item) => {
            if (item.pid !== pid) return item;
            const recomputedProfit = recomputePoolProfit(item.price, marketBasis?.medianPrice, item);
            const strictSourceMissing = marketBasis?.sourceFallbackUsed === true && marketBasis.medianPrice == null;
            return {
              ...item,
              skuMedian: marketBasis?.medianPrice ?? item.skuMedian,
              conditionClass: marketBasis?.conditionClass ?? item.conditionClass,
              comparableKey: marketBasis?.comparableKey ?? item.comparableKey,
              expectedProfitMin: strictSourceMissing ? 0 : (recomputedProfit?.min ?? item.expectedProfitMin),
              expectedProfitMax: strictSourceMissing ? 0 : (recomputedProfit?.max ?? item.expectedProfitMax),
              marketBasis: marketBasis ?? item.marketBasis ?? null,
              velocityBasis: data.analysis!.velocityBasis ?? item.velocityBasis ?? null,
              skuListingFlow: data.analysis!.skuListingFlow ?? item.skuListingFlow ?? null,
              optionBaseAssumed: data.analysis!.optionBaseAssumed ?? item.optionBaseAssumed ?? null,
            };
          }));
        }
      } else {
        console.warn("[explore-client] detail analysis load failed", {
          pid,
          status: res.status,
        });
      }
    } catch (err) {
      console.warn("[explore-client] detail analysis load failed", {
        pid,
        err: err instanceof Error ? err.message : String(err),
      });
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
          selectedBudget={budgetFilter}
          onSelectBudget={selectFirstFeedBudget}
          onDismiss={dismissFirstFeedOnboarding}
        />
      ) : null}

      <FeedMembershipUpsellCard
        planEndAt={membershipStatus?.planEndAt ?? null}
        remainingSec={feedUpsellRemainingSec}
      />

      {/* Wave 383+393: 6h lag 제거 + 사이트 핵심 가치 (band-aware 비교) 강조. */}
      <div className="mb-2 hidden rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40 sm:block">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-blue-800 dark:text-blue-300">
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
            className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline dark:text-blue-300"
          >
            <ZapIcon className="h-3 w-3" />
            대기 없이 즉시 받기 →
          </Link>
        </div>
      </div>

      {/* 필터/정렬 — sticky bar (당근식). Wave 370: 마진/패딩 압축 (모바일 화면 좁음).
          Wave 886.6 (2026-05-27): app-nav (sticky top-0 z-40, ~60px high) 와 겹침 해소 — top-14 로 navbar 아래 부착. */}
      <div className="sticky top-14 z-20 -mx-3 mb-2 flex flex-col items-stretch gap-1.5 bg-[#f5f7fb]/95 px-3 py-1.5 backdrop-blur dark:bg-zinc-950/95 sm:-mx-6 sm:flex-row sm:items-center sm:px-6">
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
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                      : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400"
                  }`}
                >
                  {/* 2026-05-19: SF Symbol 스타일 라인 아이콘 추가. 텍스트만 칩 촌스러움 해소. */}
                  <CategoryIcon category={opt.value} className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  {opt.label}
                </button>
              );
            })}
            {selectedCategories.size > 0 || scrapOnly || budgetFilter !== "all" || source !== "all" || sort !== "profit_desc" ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategories(new Set());
                  setScrapOnly(false);
                  setSource("all");
                  setSort("profit_desc");
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
              const nextSource = e.target.value as SourceOption;
              setSource(nextSource);
              setScrapOnly(false);
              if (nextSource === "daangn") {
                void loadPool(false, {
                  serverSource: "daangn",
                  serverSort: sortRef.current === "distance" ? "distance" : null,
                });
              } else if (source === "daangn") {
                void loadPool(false, {
                  serverSource: nextSource,
                  serverSort: sortRef.current === "distance" ? "distance" : null,
                });
              }
            }}
            className="min-w-0 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-[11px] font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300 sm:w-auto sm:shrink-0 sm:rounded-md sm:py-1 sm:text-[10px] sm:font-medium"
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => {
              const nextSort = e.target.value as SortOption;
              const wasDistance = sortRef.current === "distance";
              setSort(nextSort);
              setScrapOnly(false);
              if (nextSort === "distance") {
                void loadPool(false, { serverSource: source, serverSort: "distance" });
              } else if (wasDistance) {
                void loadPool(false, { serverSource: source, serverSort: null });
              }
            }}
            className="min-w-0 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-[11px] font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300 sm:w-auto sm:shrink-0 sm:rounded-md sm:py-1 sm:text-[10px] sm:font-medium"
          >
            <option value="profit_desc">차익순</option>
            <option value="price_asc">매입단가순</option>
            <option value="distance">가까운 순 (당근)</option>
            <option value="latest">최신순</option>
          </select>
        </div>
      </div>

      {/* 로딩 / 에러 / 매물 grid */}
      {loading ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm dark:border-blue-900/40 dark:bg-zinc-950/70">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                <SearchIcon className="h-4 w-4 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-zinc-950 dark:text-zinc-50">{loadingCopy.title}</p>
                <p className="mt-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">{loadingCopy.description}</p>
              </div>
            </div>
            {/* Wave 801: progress bar + 4 stage 표시 */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950/60">
              <div
                className="h-full rounded-full bg-[#3182f6] transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, loadingStage * 25)}%` }}
              />
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {loadingStages.map((label, idx) => {
                const n = idx + 1;
                const done = loadingStage > n;
                const active = loadingStage === n;
                return (
                  <li key={label} className="flex items-center gap-2">
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
                      {done ? "✓" : n}
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
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
            {isDaangnFocusedView ? (
              <p className="mt-2 break-keep text-[10.5px] font-semibold leading-4 text-zinc-400 dark:text-zinc-500">
                💡 당근 매물은 가까운 동네 순으로 정렬해서 평소보다 시간이 좀 더 걸려요.
              </p>
            ) : null}
          </div>
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
                    <div className="h-5 w-20 animate-pulse rounded bg-blue-100 dark:bg-blue-950/40" />
                    <div className="h-3 w-8 animate-pulse rounded-full bg-blue-50 dark:bg-blue-950/30" />
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
        </div>
      ) : error ? (
        // Wave launch-39 (사용자 짚음): 빨간 rose 톤 → 부드러운 amber 톤. 사용자가 "위협적
        // 빨간색 깜빡임" 으로 받아들였음. 메시지도 informational 이라 톤 일치. 자동 retry 차단
        // 후엔 깜빡임도 없고 사용자가 직접 새로고침 누르는 흐름.
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-6 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {error}
          </p>
          <button
            type="button"
            onClick={() => { setError(null); setFeedExhausted(false); void loadPool(false); }}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-4 text-[13px] font-bold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            다시 시도하기
          </button>
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
        // Wave 894: 클라이언트 필터 결과 빈 경우 — 현재 피드 snapshot 안에만 없음.
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
            {scrapOnly
              ? "아직 스크랩한 매물이 없어요"
              : currentViewFilterLabel
                ? `현재 피드에 ${currentViewFilterLabel} 매물이 없어요`
                : "현재 피드에 맞는 매물이 없어요"}
          </p>
          <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            {scrapOnly ? "상세보기에서 북마크를 누르면 여기에 모여요." : "필터를 초기화하거나, 조건에 맞는 매물을 더 찾아볼게요."}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCategories(new Set());
                setScrapOnly(false);
                setSource("all");
                setSort("profit_desc");
                updateBudgetFilter("all");
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
                    void loadPool(true, { serverSource: currentServerSourceFilter });
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
            const isDaangn = isDaangnMarketplaceSource(item.marketplaceSource);
            const isPremiumSeller = !isJoongna && (item.sellerReviewRating ?? 0) >= 4.8 && item.sellerReviewCount >= 30;
            const shippingChip = isDaangn && item.transactionMode === "direct_only"
              ? null
              : item.transactionMode === "direct_only"
              ? "직거래만"
              : item.shippingAssumption === "included"
                ? "배송비 포함"
                : item.freeShipping ? "무료배송" : null;
            const isSoldOut = item.soldOut;
            const tierBadgeCategory = tierBadgeCategoryForItem(item);
            const legacyBadgeCondition = tierBadgeCategory ? null : item.conditionClass;
            const fullLocked = false;
            const previewImageUrl = item.thumbnailUrl ?? item.genericImageUrl ?? null;
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
                  // Wave launch-94 (사용자 정정 — "잠긴 카드 클릭하면 바로 paywall 떠야지 왜 API 호출하냐"):
                  //   client 가 이미 fullLocked 상태 아는데 서버 verify 요청 X.
                  //   즉시 paywall modal set (cached snapshot 으로) + API skip.
                  if (fullLocked) {
                    setDetailAccessLimit({
                      variant: "paywall",
                      title: "멤버십 승인이 필요해요",
                      message: "선공개 멤버십 승인 후 시세 비교, 비용 계산, 원본 링크까지 볼 수 있어요.",
                      creditBalance: detailAccessSnapshot.creditBalance ?? 0,
                      freeUsed: detailAccessSnapshot.freeUsed ?? 0,
                      freeLimit: detailAccessSnapshot.freeLimit ?? 0,
                      valueSummary: detailAccessValueRef.current,
                    });
                    return;
                  }
                  void openItemDetail(item);
                }}
                disabled={isSoldOut || detailAccessLoadingPid === item.pid}
                className={`relative grid w-full grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-4 text-left transition sm:rounded-xl sm:border sm:p-3 ${
                  isSoldOut
                    ? "cursor-not-allowed sm:border-zinc-200 sm:bg-zinc-50 dark:sm:border-zinc-800 dark:sm:bg-zinc-900/30"
                    : detailAccessLoadingPid === item.pid
                      ? "cursor-wait sm:border-blue-200 sm:bg-blue-50/50 dark:sm:border-blue-900 dark:sm:bg-blue-950/20"
                    : "active:bg-zinc-50 dark:active:bg-zinc-900/40 sm:border-zinc-200 sm:bg-white sm:hover:border-blue-300 sm:hover:shadow-md dark:sm:border-zinc-800 dark:sm:bg-zinc-900/40 dark:sm:hover:border-blue-700"
                }`}
              >
                <div className={`relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 ${isSoldOut ? "grayscale" : ""}`}>
                  {previewImageUrl ? (
                    <Image
                      src={previewImageUrl}
                      alt={item.name}
                      fill
                      sizes="120px"
                      unoptimized
                      className={`object-cover ${isSoldOut ? "opacity-60" : ""}`}
                    />
                  ) : (
                    // Wave 749 (2026-05-25): 썸네일 없을 때 카테고리 워터마크 placeholder.
                    <CategoryWatermark
                      category={item.category}
                      comparableKey={item.comparableKey ?? null}
                      size={60}
                    />
                  )}
                  {/* Wave 1027 (2026-06-03): 고액/고의도 사용자 MVP에서는 피드 사진을 숨기지 않는다.
                      제목/정확가/원문 링크 CTA는 유지하되, 썸네일은 원본 우선으로 보여줘 탐색 후크를 살린다. */}
                  {/* Wave 355 → launch: 구형 condition_class 도 사진 위 배지로 통일.
                      Wave 714p/760d: 최신 5-tier 카테고리는 옛 conditionClass 뱃지 hide.
                      신발/의류/게임기/골프는 새 S/A/B/C/D 뱃지가 단일 표시 기준. */}
                  {!isSoldOut && tierBadgeCategory ? (
                    <ConditionTierPhotoBadge
                      tier={item.conditionTier}
                      compact
                      category={tierBadgeCategory}
                    />
                  ) : !isSoldOut && legacyBadgeCondition ? (
                    <ConditionPhotoBadge conditionClass={legacyBadgeCondition} compact />
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
                  {/* Wave 751 (2026-05-25): 사진 위 우하단 카테고리 워터마크 배지 (HTML 레퍼런스). */}
                  {previewImageUrl ? (
                    <CategoryWatermark
                      category={item.category}
                      comparableKey={item.comparableKey ?? null}
                      size={24}
                      variant="corner"
                    />
                  ) : null}
                </div>
                <div className={`min-w-0 ${isSoldOut ? "opacity-60" : ""}`}>
                  <div className="line-clamp-2 text-sm font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                    {item.name || lockedPreviewTitle(item)}
                  </div>


                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    {/* Wave launch-117b (2026-05-24): 수익 = emerald (사용자 정정, light+dark 둘 다). */}
                    <span className={`text-lg font-bold tabular-nums ${isSoldOut ? "text-zinc-500 line-through dark:text-zinc-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                      +{krw(profitAvg(item))}
                    </span>
                    {pct != null ? (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${isSoldOut ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500" : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"}`}>
                        +{pct}%
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    <span>
                      매입가{" "}
                      <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {krw(item.price)}
                      </span>
                    </span>
                    {item.skuMedian ? (
                      <>
                        <span className="text-zinc-300 dark:text-zinc-700">·</span>
                        <span>
                          시세{" "}
                          <span className="font-bold tabular-nums">
                            {krw(item.skuMedian)}
                          </span>
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
                    {isSoldOut ? (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                        멤버십이면 이런 매물을 더 빨리 확인할 수 있어요
                      </span>
                    ) : (
                      <>
                        {/* 상태 등급은 사진 위 배지로 단일화. 하단에는 시간/출처/배송 같은 거래 신호만 남김. */}
                        <span className="flex items-center gap-0.5 text-zinc-500">
                          <ClockIcon className="h-3 w-3" />
                          {/* 2026-05-20 P0-Upload: 셀러 업로드 시점 우선. 없으면 검증 시점. */}
                          {item.firstSeenAt
                            ? `${hoursAgoLabel(item.firstSeenAt)} 등록`
                            : hoursAgoLabel(item.lastVerifiedAt)}
                        </span>
                        {/* Wave 886.2 (2026-05-27): 잠금 카드도 source 로고 노출 (일반 이미지로 leak 차단된 후). */}
                        <MarketplaceSourceBadge source={item.marketplaceSource} label={item.marketplaceLabel} />
                        {item.marketplaceSource === "daangn" && item.daangnDistanceLabel ? (
                          <span className="rounded-full bg-orange-50 px-1.5 py-0.5 font-bold text-orange-700 dark:bg-orange-950/40 dark:text-orange-200">
                            {item.daangnDistanceLabel}
                          </span>
                        ) : null}
                        {item.priceSignalLabel ? (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                            {item.priceSignalLabel}
                          </span>
                        ) : null}
                        {item.velocitySignalLabel ? (
                          <span className="rounded-full bg-violet-50 px-1.5 py-0.5 font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
                            {item.velocitySignalLabel}
                          </span>
                        ) : null}
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
                          <span className="flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/40">
              <HourglassIcon className="h-5 w-5 text-blue-700 dark:text-blue-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {feedExhausted
                  ? budgetFilter !== "all"
                    ? `${budgetOption.label} 조건은 오늘 여기까지예요`
                    : "오늘 볼 수 있는 추천 매물은 여기까지예요"
                  : "더 찾아보면 새 후보가 이어져요"}
              </div>
              <div className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {feedExhausted
                  ? budgetFilter !== "all"
                    ? `${budgetOption.label}에서 수익, 시세, 상태 조건을 통과한 후보만 남긴 결과예요. 가격대를 넓히면 더 볼 수 있어요.`
                    : "수익, 시세, 상태 조건을 통과한 매물만 남긴 결과예요."
                  : "승인된 멤버에게만 지금 진행 중인 추천 매물과 시세를 보여줘요."}
              </div>
              {feedExhausted && budgetFilter !== "all" ? (
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
              {feedExhausted && stats && (stats.scannedToday || stats.caughtToday) ? (
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
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1.5 text-[11px] font-bold text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                <ZapIcon className="h-3 w-3" />
                <span>상세 분석은 선공개 멤버십 승인 후 열 수 있어요</span>
              </div>
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
      {!loading && !scrapOnly && items.length > 0 ? (
        <div className="sticky bottom-4 z-20 mt-4 flex justify-center px-4 sm:mt-6 sm:px-0">
          <button
            type="button"
            onClick={() => {
              if (canRefresh) {
                void loadPool(true, { serverSource: currentServerSourceFilter });
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
                    void loadPool(true, { serverSource: currentServerSourceFilter });
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
                      {canRefresh ? "필터 없이 더 넓게 골라드려요" : "잠시 후 다음 라운드가 열려요"}
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
                  <div className="mt-3 mb-3 rounded-2xl border border-blue-200 bg-blue-50/90 p-4 shadow-[0_10px_28px_rgba(16,185,129,0.12)] dark:border-blue-900/70 dark:bg-blue-950/30">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-zinc-900/70">
                        <ZapIcon className="h-6 w-6 text-[#3182f6]" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-base font-black tracking-tight text-[#123c2b] dark:text-blue-100">
                          멤버십 승인 후 피드 계속 보기
                        </div>
                        <div className="mt-1 text-[12px] font-bold leading-5 text-blue-800/80 dark:text-blue-200/80">
                          승인된 계정은 추천 피드와 상세 리포트를 계속 볼 수 있어요.
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-white/80 px-2 py-2 text-center dark:bg-zinc-900/50">
                        <div className="text-[11px] font-black text-[#008f5f] dark:text-blue-300">무료</div>
                        <div className="mt-0.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">신청</div>
                      </div>
                      <div className="rounded-xl bg-white/80 px-2 py-2 text-center dark:bg-zinc-900/50">
                        <div className="text-[11px] font-black text-[#008f5f] dark:text-blue-300">검토</div>
                        <div className="mt-0.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">운영자 확인</div>
                      </div>
                      <div className="rounded-xl bg-white/80 px-2 py-2 text-center dark:bg-zinc-900/50">
                        <div className="text-[11px] font-black text-[#008f5f] dark:text-blue-300">승인</div>
                        <div className="mt-0.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">계정 오픈</div>
                      </div>
                    </div>
                            </div>

                            <Link
                              href="/plans"
                              className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl bg-blue-500 px-5 py-4 text-left shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition hover:bg-blue-600 active:scale-[0.99]"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-white/20">
                                  <ZapIcon className="h-4 w-4 text-white" />
                                </span>
                                <div className="min-w-0">
                                  <div className="text-base font-bold text-white">
                                    멤버십 신청하러 가기
                                  </div>
                                  <div className="mt-0.5 text-[11px] font-medium text-white/85">
                                    선공개 300명
                                  </div>
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                                신청하기
                              </span>
                            </Link>

                            <div className="mt-3">
                              <FeedMembershipUpsellCard
                                planEndAt={membershipStatus?.planEndAt ?? null}
                                remainingSec={feedUpsellRemainingSec}
                              />
                            </div>
                          </>
                        ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Wave launch-88 (사용자 정정 — 클릭 시 검증 딜레이 동안 렉걸린 느낌):
          detailAccessLoadingPid 활성 동안 검은 overlay + 가운데 dots loading 표시.
          z-[94] = paywall modal (z-[95]) 보다 한 단계 아래. paywall 응답 받으면 자동 사라짐.
          Wave 730 (2026-05-23): 사용자 보고 — 점이 더 높이 튀어야 / "확인 중" 안내 메시지 / 다크모드 가시성.
            - animate-bounce → animate-bounce-high (custom keyframe, -100% 높이)
            - 점 크기 키움 (h-3 → h-2.5/4 staggered = 더 dynamic)
            - "상품을 확인중입니다" + sub text 추가
            - dots 흰색 + drop-shadow 로 다크 배경에서도 또렷 */}
      {/* Wave 746 (2026-05-24): 카톡 공유 토스트 BalanceToast (layout) 로 이동 — universal 통합. */}

      {detailAccessLoadingPid != null ? (
        <div
          className="fixed inset-0 z-[94] flex items-center justify-center bg-black/55 backdrop-blur-[1px]"
          aria-live="polite"
          aria-busy="true"
        >
          {/* Wave launch-122 (2026-05-24): brand mark 자연스럽게 (subtle pulse — 기존 dots/텍스트 keep). */}
          <div className="flex flex-col items-center gap-5">
            <BrandLogo size={56} className="rounded-[12px] shadow-lg shadow-blue-500/40 animate-pulse" />
            <div className="flex items-end gap-2.5">
              <span className="h-3.5 w-3.5 animate-bounce-high rounded-full bg-[#ffffff] shadow-[0_2px_8px_rgba(255,255,255,0.4)] [animation-delay:-0.32s]" />
              <span className="h-3.5 w-3.5 animate-bounce-high rounded-full bg-[#ffffff] shadow-[0_2px_8px_rgba(255,255,255,0.4)] [animation-delay:-0.16s]" />
              <span className="h-3.5 w-3.5 animate-bounce-high rounded-full bg-[#ffffff] shadow-[0_2px_8px_rgba(255,255,255,0.4)]" />
            </div>
            <div className="text-center">
              <div className="text-[15px] font-black text-white">상품을 확인 중이에요</div>
              <div className="mt-1 text-[12px] font-bold text-white/70">시세·재고·셀러 정보를 가져오는 중...</div>
            </div>
          </div>
        </div>
      ) : null}

      <DetailAccessPaywallModal
        state={detailAccessLimit}
        onClose={() => setDetailAccessLimit(null)}
        kakaoShareReady={kakaoShareReady}
        kakaoShareLoading={kakaoShareLoading}
        kakaoShareCooldownHours={kakaoShareCooldownHours}
        onKakaoShare={handleKakaoShare}
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
