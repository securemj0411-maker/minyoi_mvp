"use client";

// 2026-05-17: 비로그인 사용자 메인 페이지 — 마스킹된 매물 5개 + 로그인 CTA.
// 사용자 의도: 즉시 가치 인식 + curiosity gap → 가입 motivation.

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  PackageIcon,
  SearchIcon,
  UnlockIcon,
} from "@/components/icons";

type PreviewItem = {
  slot: number;
  // Wave launch-113 (2026-05-24): sold 매물 실제 노출 — name/thumbnailUrl/soldAt.
  name?: string;
  thumbnailUrl?: string | null;
  soldAt?: string | null;
  // (legacy) launch-111 호환 fallback.
  maskedName: string;
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
type PreviewSignal = { label: string; tone: PreviewSignalTone };

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

// Wave launch-111b (2026-05-24): 비로그인 매물 가격은 정확값 X — "만원대" band 로 노출.
//   사용자 정정: "매입이랑 시세를 몇만원대 이런 식으로 하자고 했는데 정확값 박혀 있음 = 구라".
//   원 단위 정확값 노출 시 비로그인이 sku/가격 매핑 가능 → 카탈로그 leak 위험.
function krwTenThousandBand(value: number): string {
  const v = Math.round(value);
  if (v <= 0) return "0원";
  if (v < 10_000) return `${(Math.floor(v / 1_000) || 1) * 1_000}원대`;
  const tenK = Math.floor(v / 10_000);
  return `${tenK}만원대`;
}

// 2026-05-17: 시세 차이 표시 — min === max 면 단일 (구간 표시 어색 fix).
// Wave launch-113 (2026-05-24): 정확값 다시 (sold 매물이라 leak 없음).
function marketGapLabel(min: number, max: number): string {
  if (Math.round(min) === Math.round(max)) return `${Math.round(min).toLocaleString("ko-KR")}원 낮음`;
  return `${Math.round(min).toLocaleString("ko-KR")}~${Math.round(max).toLocaleString("ko-KR")}원 낮음`;
}

// Wave launch-113: "N일 전 거래" / "N시간 전 거래" 표시.
function soldAgoLabel(soldAt: string | null | undefined): string {
  if (!soldAt) return "최근 거래";
  const ms = Date.now() - new Date(soldAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "최근 거래";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "방금 거래";
  if (hours < 24) return `${hours}시간 전 거래`;
  const days = Math.floor(hours / 24);
  return `${days}일 전 거래`;
}

// 시세 차이 % — 매입가 대비 차이 비율 (대시보드 통일 패턴).
function marketGapPctLabel(price: number, gapMin: number, gapMax: number): string | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const avg = (gapMin + gapMax) / 2;
  const pct = Math.round((avg / price) * 100);
  if (!Number.isFinite(pct)) return null;
  return `${pct}% 낮음`;
}

function priceBandLabel(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "예산 확인 중";
  if (price <= 100_000) return "10만원 이하";
  if (price <= 300_000) return "10~30만원";
  if (price <= 500_000) return "30~50만원";
  if (price <= 1_000_000) return "50~100만원";
  return "100만원 이상";
}

function conditionLabel(conditionClass: string | null) {
  if (conditionClass === "unopened") return "미개봉";
  if (conditionClass === "mint") return "S급";
  if (conditionClass === "clean") return "A급";
  if (conditionClass === "normal") return "상태 보통";
  if (conditionClass === "worn") return "사용감 있음";
  if (conditionClass === "flawed") return "하자 확인";
  return "상태 확인";
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
    return { label: `후기 ${compactCount(reviews)} 셀러`, tone: "seller" };
  }
  if (rating != null && rating >= 4.9 && reviews >= 10) {
    return { label: `평점 ${rating.toFixed(1)} 셀러`, tone: "seller" };
  }
  if (reviews >= 30) {
    return { label: `후기 ${reviews.toLocaleString("ko-KR")}건`, tone: "seller" };
  }
  if (item.medianHoursToSold != null && item.medianHoursToSold > 0 && item.medianHoursToSold <= 336) {
    return { label: `평균 ${daysLabel(item.medianHoursToSold)} 회전`, tone: "speed" };
  }
  if (item.soldSampleCount != null && item.soldSampleCount >= 20) {
    return { label: `시장 표본 ${compactCount(item.soldSampleCount)}건`, tone: "market" };
  }
  if (item.confidence === "high") {
    return { label: "시세 신뢰 높음", tone: "verified" };
  }
  return { label: "AI 검증 통과", tone: "verified" };
}

function previewStatusLabel(item: PreviewItem) {
  if (item.freeShipping) return "배송비 확인 완료";
  if (item.isFresh) return "최근 등록";
  return "상세 분석 대기";
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
    <main className="min-h-screen bg-[var(--rd-bg)] dark:bg-zinc-950">
      {/* SEO hidden — 옛 landing 키워드 보존.
          2026-05-19: PG 심사 대비 톤 정비. "차익/돈 벌기"로 읽힐 표현 제거, 정보 제공·면책 톤으로 교체.
          면책은 /terms 제6·11조 참고. */}
      <div className="sr-only">
        <h1>득템잡이 — 시세보다 저렴한 중고 매물 AI 분석</h1>
        <p>공개된 중고 매물의 시세를 AI가 비교해, 시세 대비 저렴한 매물 정보를 알려드립니다. 매물의 진위·거래 결과는 보장하지 않으며, 최종 구매 판단은 이용자가 합니다.</p>
        <p>스마트폰, 태블릿, 노트북, 애플워치, 에어팟, 카메라, 신발, 가방 등 카테고리 매물 시세 비교.</p>
      </div>

      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-4 py-3 sm:gap-6 sm:px-6 sm:py-8 lg:grid lg:grid-cols-[minmax(0,0.88fr)_minmax(420px,1fr)] lg:items-start lg:gap-8">
        <section className="pt-0 lg:sticky lg:top-24 lg:pt-8">
          <div className="hidden items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11px] font-black text-rose-700 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 sm:inline-flex">
            최근 거래된 실제 매물
          </div>
          <h1 className="mt-1 break-keep text-[28px] font-black leading-[1.05] tracking-tight text-[var(--rd-ink)] dark:text-zinc-50 sm:mt-5 sm:text-[44px] lg:text-[52px]">
            볼 만한 중고만
            <br />
            조용히 남겨둘게요.
          </h1>
          <p className="mt-2 max-w-[460px] break-keep text-[13px] font-semibold leading-5 text-[#5f6a60] dark:text-zinc-300 sm:mt-4 sm:text-[15px] sm:leading-7">
            같은 상태끼리 가격을 맞춰보고, 배송비와 수수료까지 계산한 추천 매물만 보여줘요.
          </p>
          {/* Wave launch-113 (2026-05-24): 정직 fine print — 우측 카드가 이미 거래된 매물임. */}
          <p className="mt-1.5 max-w-[460px] break-keep text-[11px] font-bold leading-4 text-rose-600 dark:text-rose-400 sm:text-[12px]">
            ※ 우측 카드는 <strong>이미 거래 완료된 매물</strong>입니다. 로그인하면 지금 진행 중인 매물을 볼 수 있어요.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:flex sm:flex-row sm:gap-2.5">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-[#111816] px-4 text-[13px] font-black text-white shadow-[0_16px_36px_rgba(17,24,22,0.16)] transition hover:bg-[#26312c] dark:bg-white dark:text-zinc-950 sm:h-12 sm:gap-2 sm:px-5 sm:text-[15px]"
            >
              <UnlockIcon width={16} height={16} /> 로그인하고 보기
            </Link>
            <Link
              href="/intro"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white/80 px-4 text-[13px] font-black text-zinc-900 transition hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:h-12 sm:px-5 sm:text-[15px]"
            >
              서비스 소개
            </Link>
          </div>

          <div className="mt-7 hidden max-w-[520px] grid-cols-3 gap-2.5 sm:grid">
            {[
              ["무료", "첫 3개 상세"],
              ["1년", "충전 크레딧"],
              ["0원", "피드 차감"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-zinc-200 bg-white/65 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className="text-[18px] font-black leading-none text-[var(--rd-ink)] dark:text-zinc-50">{value}</div>
                <div className="mt-1.5 break-keep text-[11px] font-bold text-zinc-500 dark:text-zinc-400">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-zinc-200 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:px-5">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">Preview feed</div>
              <div className="mt-0.5 text-[16px] font-black text-[var(--rd-ink)] dark:text-zinc-50">오늘의 추천 매물</div>
            </div>
            <div className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black text-[#3182f6] dark:bg-emerald-950/40 dark:text-emerald-200">
              로그인 후 공개
            </div>
          </div>

          <div className="px-3 py-3 sm:px-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-[116px] animate-pulse rounded-2xl bg-white/80 dark:bg-zinc-950/50" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
              지금 추천 매물 준비 중. 잠시 후 다시 와 보세요.
            </div>
          ) : (
            <div className="space-y-2">
            {items.map((item) => {
              const signal = previewSignal(item);
              const budgetLabel = priceBandLabel(item.price);
              return (
                <Link
                  href="/login"
                  key={item.slot}
                  className="group block rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 transition hover:border-blue-200 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-emerald-900"
                >
                  <div className="flex items-center gap-3">
                    {/* Wave launch-113 (2026-05-24): sold 매물 실제 사진 노출 (이미 거래된 매물이라 leak 없음).
                        thumbnailUrl 우선, 없으면 blurredImage fallback, 그것도 없으면 PackageIcon. */}
                    <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 sm:h-[104px] sm:w-[104px]">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.name ?? "거래 완료 매물"}
                          className="h-full w-full object-cover grayscale opacity-90"
                        />
                      ) : item.blurredImage ? (
                        <img
                          src={item.blurredImage}
                          alt={item.name ?? "거래 완료 매물"}
                          className="h-full w-full scale-105 object-cover blur-[7px]"
                        />
                      ) : (
                        <PackageIcon width={36} height={36} />
                      )}
                      {/* 거래 완료 overlay 배지 */}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-900/40">
                        <span className="rounded-full bg-rose-600/95 px-2 py-0.5 text-[9px] font-black text-white shadow">거래 완료</span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {conditionLabel(item.conditionClass)}
                        </span>
                        <span className="truncate text-[11px] font-bold text-rose-600 dark:text-rose-400">{soldAgoLabel(item.soldAt)}</span>
                      </div>

                      {/* Wave launch-113 (2026-05-24): 실제 매물명 그대로 노출 (sold 매물 = 카탈로그 leak X). */}
                      <div className="mt-2 line-clamp-2 text-[14px] font-black tracking-tight text-zinc-950 dark:text-zinc-100 sm:text-[16px]">
                        {item.name ?? item.maskedName}
                      </div>

                      {/* Wave launch-113 (2026-05-24): 매입/시세 정확값 (sold 매물). */}
                      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
                        <span>매입 <span className="tabular-nums text-zinc-950 dark:text-zinc-100">{krw(item.price)}</span></span>
                        {item.skuMedian && item.skuMedian > 0 ? (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-700">·</span>
                            <span>시세 <span className="tabular-nums text-zinc-950 dark:text-zinc-100">{krw(item.skuMedian)}</span></span>
                          </>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[18px] font-black leading-none tabular-nums text-[#059669] dark:text-emerald-300">
                          {marketGapLabel(item.expectedProfitMin, item.expectedProfitMax)}
                        </span>
                        {(() => {
                          const pct = marketGapPctLabel(item.price, item.expectedProfitMin, item.expectedProfitMax);
                          return pct ? (
                            <span className="text-[11px] font-black text-zinc-500 dark:text-zinc-400">
                              {pct}
                            </span>
                          ) : null;
                        })()}
                      </div>

                      <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-black text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300 sm:hidden">
                        <CheckCircleIcon width={13} height={13} className={signal.tone === "seller" ? "text-[#059669]" : "text-zinc-500"} />
                        <span className="truncate">{signal.label}</span>
                      </div>
                    </div>

                    <div className="hidden shrink-0 text-right sm:block">
                      <div className="text-[11px] font-black text-zinc-400 dark:text-zinc-500">{budgetLabel}</div>
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-black text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                        <CheckCircleIcon width={13} height={13} className={signal.tone === "seller" ? "text-[#059669]" : "text-zinc-500"} />
                        {signal.label}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            </div>
          )}
          </div>

          <div className="border-t border-zinc-200 bg-white/55 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/30 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <SearchIcon width={18} height={18} className="text-[#059669]" />
                <div>
                  <div className="text-[14px] font-black text-[var(--rd-ink)] dark:text-zinc-50">이름과 원본 링크까지 열어볼까요?</div>
                  <div className="mt-0.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-500">첫 3개 상세 리포트는 무료로 확인할 수 있어요.</div>
                </div>
              </div>
            <Link
              href="/login"
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-[#059669] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#047857]"
            >
                무료로 시작
            </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
