"use client";

// 2026-05-17: 비로그인 사용자 메인 페이지 — 마스킹된 매물 5개 + 로그인 CTA.
// 사용자 의도: 즉시 가치 인식 ("와 이게 돈 되는 거구나") + curiosity gap → 가입 motivation.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConditionPhotoBadge } from "@/components/condition-chip";
import {
  CheckCircleIcon,
  FlameIcon,
  PackageIcon,
  SearchIcon,
  TrophyIcon,
  UnlockIcon,
} from "@/components/icons";

type PreviewItem = {
  slot: number;
  maskedName: string;
  // 2026-05-17: blurredImage = 서버 sharp 처리된 base64 (원본 URL 노출 X). DevTools 우회 불가.
  blurredImage: string | null;
  category: string;
  conditionClass: string | null;
  price: number;
  skuMedian: number | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  profitBand: number;
  // 2026-05-17: 신뢰 시그널 (dashboard 패턴).
  confidence: "high" | "medium" | "low";
  freeShipping: boolean;
  isFresh: boolean;
  sellerReviewRating: number | null;
  sellerReviewCount: number | null;
  // 2026-05-17 Phase 3: 근거 chip 데이터.
  soldSampleCount: number | null;
  medianHoursToSold: number | null;
};

type PreviewSignalTone = "seller" | "speed" | "market" | "verified";
type PreviewSignal = { label: string; tone: PreviewSignalTone; icon: "trophy" | "check" };

const SIGNAL_TONE_CLASS: Record<PreviewSignalTone, string> = {
  seller: "border-[#cfdcca] bg-[#f8fff5] text-[#1f5f3b] dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
  speed: "border-[#d7e5d0] bg-white text-[#3f6949] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
  market: "border-[#e3d6bf] bg-[#fff8ea] text-[#72521a] dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200",
  verified: "border-[#d7e5d0] bg-[#f7fbf2] text-[#405846] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
};

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

// 2026-05-17: 차익 표시 — min === max 면 단일 (구간 표시 어색 fix).
function profitLabel(min: number, max: number): string {
  if (Math.round(min) === Math.round(max)) return `+${Math.round(min).toLocaleString("ko-KR")}원`;
  return `+${Math.round(min).toLocaleString("ko-KR")}~${Math.round(max).toLocaleString("ko-KR")}원`;
}

// 수익률 % — 매입 대비 차익 비율 (대시보드 통일 패턴).
function profitPctLabel(price: number, profitMin: number, profitMax: number): string | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const avg = (profitMin + profitMax) / 2;
  const pct = Math.round((avg / price) * 100);
  if (!Number.isFinite(pct)) return null;
  return `+${pct}%`;
}

function priceBandLabel(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "예산 확인 중";
  if (price <= 100_000) return "10만원 이하";
  if (price <= 300_000) return "10~30만원";
  if (price <= 500_000) return "30~50만원";
  if (price <= 1_000_000) return "50~100만원";
  return "100만원 이상";
}

function compactCount(value: number): string {
  if (value >= 1000) return `${Math.floor(value / 100) / 10}천+`;
  if (value >= 100) return `${Math.floor(value / 100) * 100}+`;
  return value.toLocaleString("ko-KR");
}

function daysLabel(hours: number): string {
  if (hours < 24) return `${Math.max(1, Math.round(hours))}시간`;
  return `${Math.round((hours / 24) * 10) / 10}일`;
}

function previewSignal(item: PreviewItem): PreviewSignal {
  const reviews = item.sellerReviewCount ?? 0;
  const rating = item.sellerReviewRating;
  if (reviews >= 100) {
    return { label: `후기 ${compactCount(reviews)} 셀러`, tone: "seller", icon: "trophy" };
  }
  if (rating != null && rating >= 4.9 && reviews >= 10) {
    return { label: `평점 ${rating.toFixed(1)} 셀러`, tone: "seller", icon: "trophy" };
  }
  if (reviews >= 30) {
    return { label: `후기 ${reviews.toLocaleString("ko-KR")}건`, tone: "seller", icon: "check" };
  }
  if (item.medianHoursToSold != null && item.medianHoursToSold > 0 && item.medianHoursToSold <= 336) {
    return { label: `평균 ${daysLabel(item.medianHoursToSold)} 회전`, tone: "speed", icon: "check" };
  }
  if (item.soldSampleCount != null && item.soldSampleCount >= 20) {
    return { label: `시장 표본 ${compactCount(item.soldSampleCount)}건`, tone: "market", icon: "check" };
  }
  if (item.confidence === "high") {
    return { label: "시세 신뢰 높음", tone: "verified", icon: "check" };
  }
  return { label: "AI 검증 통과", tone: "verified", icon: "check" };
}

export default function PreviewMaskedDashboard() {
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/preview-pool", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ items?: PreviewItem[] }>)
      .then((data) => {
        if (mounted) setItems(data.items ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <main className="min-h-screen bg-[#f6f1e8] dark:bg-zinc-950">
      {/* SEO hidden — 옛 landing 키워드 보존. */}
      <div className="sr-only">
        <h1>득템잡이 — 중고 매물 AI 차익 분석</h1>
        <p>중고 거래 가격 차이 자동 분석. 시세보다 싼 매물 자동 추천. 일반인도 편하게 돈 벌 수 있는 AI 사이트.</p>
        <p>스마트폰, 태블릿, 노트북, 애플워치, 에어팟, 카메라, 신발, 가방 등 카테고리 매물 시세 비교.</p>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        {/* 상단 hook + 고정 CTA */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-black text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            <FlameIcon width={12} height={12} /> LIVE
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-[#223127] dark:text-zinc-100 sm:text-3xl">
            지금 사면<br />
            <span className="text-[var(--brand-accent-strong)]">차익 나는 상품</span>
          </h1>
          <p className="mt-2 text-sm text-[#5a6658] dark:text-zinc-400">
            AI가 시세와 비교해서 찾았어요. 로그인하면 매물 다 보입니다.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--brand-accent-strong)] px-6 py-3 text-sm font-black text-[var(--brand-cream)] shadow-md transition hover:opacity-90"
          >
            <UnlockIcon width={16} height={16} /> 로그인하고 다 보기
          </Link>
        </div>

        {/* 마스킹 매물 5개 */}
        <div className="mt-8 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-[#fffdf9] dark:bg-zinc-900" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-[#ddd4c7] bg-[#fffdf9] p-6 text-center text-sm text-[#6b7269] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              지금 차익 매물 준비 중. 잠시 후 다시 와 보세요.
            </div>
          ) : (
            items.map((item) => {
              const signal = previewSignal(item);
              const SignalIcon = signal.icon === "trophy" ? TrophyIcon : CheckCircleIcon;
              const budgetLabel = priceBandLabel(item.price);
              return (
                <Link
                  href="/login"
                  key={item.slot}
                  className="block rounded-xl border border-[#e5dccf] bg-[#fffdf9] p-4 transition hover:border-[var(--brand-accent)] hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700"
                >
                  <div className="flex items-start gap-3">
                    {/* 2026-05-17 보안: 서버 sharp blur 된 base64 — 원본 URL 노출 X. DevTools 우회 불가.
                        2026-05-19: 카테고리 힌트 제거 — 비로그인에서는 신발/가전/워치 같은 분류를 노출하지 않음. */}
                    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#f5efe4] to-[#e7ddce] text-[#7a8478] dark:from-zinc-800 dark:to-zinc-700 dark:text-zinc-400">
                      <ConditionPhotoBadge conditionClass={item.conditionClass} compact />
                      {item.blurredImage ? (
                        <img
                          src={item.blurredImage}
                          alt="마스킹된 추천 매물"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <PackageIcon width={36} height={36} />
                      )}
                    </div>
                    {/* 2026-05-19: PC 에서는 info 와 단일 근거 chip 좌우 분리 (모바일은 stack). */}
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                      <div className="min-w-0 flex-1">
                      {/* 매물명 — 서버에서 마스킹 ("갤** S** 울**") + 강한 CSS blur.
                          데이터는 이미 마스킹 (DevTools 안전), blur 는 시각 효과만. */}
                      <div className="mt-1 select-none truncate text-sm font-bold text-[#223127] blur-[3px] dark:text-zinc-100">
                        {item.maskedName}
                      </div>
                      {/* 매입 · 시세 (대시보드 패턴) */}
                      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-[11px] font-semibold text-[#6b7269] dark:text-zinc-400">
                        <span>매입 <span className="font-black tabular-nums text-[#223127] dark:text-zinc-100">{krw(item.price)}</span></span>
                        {item.skuMedian && item.skuMedian > 0 ? (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-600">·</span>
                            <span>시세 <span className="font-black tabular-nums text-[#223127] dark:text-zinc-100">{krw(item.skuMedian)}</span></span>
                          </>
                        ) : null}
                      </div>
                      {/* 차익 (원) + 수익률 (%) */}
                      <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-black tabular-nums text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {profitLabel(item.expectedProfitMin, item.expectedProfitMax)}
                        </span>
                        {(() => {
                          const pct = profitPctLabel(item.price, item.expectedProfitMin, item.expectedProfitMax);
                          return pct ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black tabular-nums text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                              {pct}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5 lg:max-w-[190px] lg:justify-end">
                        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-[#e3d6bf] bg-[#fff8ea] px-2.5 py-1 text-[11px] font-black text-[#72521a] shadow-sm dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200">
                          매입가 {budgetLabel}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-black shadow-sm ${SIGNAL_TONE_CLASS[signal.tone]}`}>
                          <SignalIcon width={13} height={13} />
                          {signal.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* 하단 CTA 강조 */}
        <div className="mt-8 rounded-2xl border-2 border-dashed border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] p-5 text-center dark:border-emerald-700 dark:bg-emerald-950/30">
          <div className="inline-flex items-center gap-2 text-base font-black text-[#223127] dark:text-zinc-100">
            <SearchIcon width={18} height={18} className="text-[var(--brand-accent-strong)]" />
            매물 다 보고 싶나요?
          </div>
          <p className="mt-1 text-xs text-[#5a6658] dark:text-zinc-400">
            로그인하면 매물 이름 / 사진 / 상세 정보 까지 다 보입니다. 무료.
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-accent-strong)] px-5 py-2 text-sm font-black text-[var(--brand-cream)] shadow-sm transition hover:opacity-90"
            >
              <UnlockIcon width={14} height={14} /> 로그인
            </Link>
            <Link
              href="/intro"
              className="rounded-full border border-[#ddd4c7] bg-white px-5 py-2 text-sm font-bold text-[#344136] hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              득템잡이 소개
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
