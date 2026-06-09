// Wave launch-115 (2026-05-24): SSR 변환 — 비로그인 메인 server-rendered.
//   배경: 기존 PreviewMaskedDashboard 가 client component → 첫 paint 느림 + SEO 약함 +
//   useEffect fetch 후에야 카드 보임 (깜빡임).
//   해결: server component 가 fetch 후 곧장 HTML 박아서 응답. 첫 paint 즉시 + SEO 강함.
//
// Wave 1229 (2026-06-08): 비회원 전환율 — "샘플 다 보여서 봤다고 느끼고 나감" 해결.
//   호기심 갭: 공개 카드 3개(증거)만, 나머지는 블러+페이드+잠금 게이트. payoff=원본 링크.
// Wave 1229b (2026-06-08): CTA 과잉 정리 (owner — "버튼이 너무 많아 혼란"). 광고 5만원 46클릭 0가입.
//   - 상단 선착순 배너 버튼 제거 → 히어로 스카시 칩(비-버튼)으로 통합 (slot prop 으로 받음)
//   - 샘플 카드 클릭 해제(증거 전용) → 유일 행동 = 히어로 "지금 시작하기" + 잠금 게이트
//   - "서비스 소개" 버튼 → 텍스트 링크 강등, 하단 중복 CTA 바 제거

import Link from "next/link";
import { headers } from "next/headers";

import { PackageIcon, UnlockIcon } from "@/components/icons";
import { type SlotSnapshot } from "@/lib/membership-slots";

type PreviewItem = {
  slot: number;
  name?: string;
  thumbnailUrl?: string | null;
  previewTitle?: string;
  profitLabel?: string;
  budgetLabel?: string;
  priceSignalLabel?: string;
  maskedName: string;
  blurredImage: string | null;
  category: string;
  conditionClass: string | null;
  price: number;
  skuMedian: number | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  profitBand: number;
  confidence: "high" | "medium" | "low";
  freeShipping: boolean;
  isFresh: boolean;
  sellerReviewRating: number | null;
  sellerReviewCount: number | null;
  soldSampleCount: number | null;
  medianHoursToSold: number | null;
};

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function marketGapLabel(min: number, max: number): string {
  if (Math.round(min) === Math.round(max)) return `+${Math.round(min).toLocaleString("ko-KR")}원`;
  return `+${Math.round(min).toLocaleString("ko-KR")}~${Math.round(max).toLocaleString("ko-KR")}원`;
}

function marketGapPctLabel(price: number, gapMin: number, gapMax: number): string | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const avg = (gapMin + gapMax) / 2;
  const pct = Math.round((avg / price) * 100);
  if (!Number.isFinite(pct)) return null;
  return `+${pct}%`;
}

function normalizePriceSignalLabel(label: string): string {
  // Wave 1232: "차익"(리셀 수익으로 읽힐 어휘 — 광고 exaggerated-claims 리스크) → "시세 이하".
  //   API 가 "차익 후보"를 직접 보내는 케이스 + "시세보다 N% 낮음" 케이스 둘 다 흡수.
  if (label.includes("차익")) return "시세 이하";
  if (label.includes("시세보다") && label.includes("낮음")) return "시세 이하";
  return label;
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
  if (conditionClass === "worn") return "사용감";
  if (conditionClass === "flawed") return "흠집";
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

function previewSignal(item: PreviewItem): { label: string; tone: string } {
  if (item.medianHoursToSold != null && item.medianHoursToSold > 0) {
    return { label: `평균 ${daysLabel(item.medianHoursToSold)} 내 판매`, tone: "speed" };
  }
  if (item.soldSampleCount != null && item.soldSampleCount >= 20) {
    return { label: `판매 표본 ${compactCount(item.soldSampleCount)}건`, tone: "market" };
  }
  if (item.sellerReviewRating && item.sellerReviewRating >= 4.5) return { label: `평점 ${item.sellerReviewRating}`, tone: "verified" };
  if (item.freeShipping) return { label: "무료배송", tone: "seller" };
  if (item.isFresh) return { label: "방금 등록", tone: "speed" };
  return { label: "시세 비교 완료", tone: "market" };
}

async function fetchPreviewItems(): Promise<PreviewItem[]> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://minyoi-mvp.vercel.app");
  try {
    // Server-side fetch. The route itself reads the DB materialized preview cache.
    const res = await fetch(`${origin}/api/preview-pool`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: PreviewItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

// Wave 1229b: 증거용 카드 — 비클릭(div). 공개/블러 양쪽 공용. 유일 행동은 히어로 CTA + 잠금 게이트.
function PreviewCard({ item }: { item: PreviewItem }) {
  const signal = previewSignal(item);
  const budgetLabel = priceBandLabel(item.price);
  const priceSignalLabel = normalizePriceSignalLabel(item.priceSignalLabel ?? "시세 비교 완료");
  const imageUrl = item.thumbnailUrl ?? item.blurredImage;
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
      <div className="flex items-center gap-3">
        <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 sm:h-[104px] sm:w-[104px]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={item.name ?? item.previewTitle ?? "추천 매물"} className="h-full w-full object-cover" />
          ) : (
            <PackageIcon width={36} height={36} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {conditionLabel(item.conditionClass)}
            </span>
            <span className="truncate text-[11px] font-bold text-zinc-400 dark:text-zinc-500">{signal.label}</span>
          </div>

          <div className="mt-2 line-clamp-2 text-[14px] font-black tracking-tight text-zinc-950 dark:text-zinc-100 sm:text-[16px]">
            {item.name ?? item.previewTitle ?? item.maskedName}
          </div>

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
                <span className="text-[11px] font-black text-zinc-500 dark:text-zinc-400">{pct}</span>
              ) : null;
            })()}
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-200">
              {priceSignalLabel}
            </span>
          </div>

          <div className="mt-2 text-[11px] font-black text-zinc-400 dark:text-zinc-500 sm:hidden">{budgetLabel}</div>
        </div>

        <div className="hidden shrink-0 text-right sm:block">
          <div className="text-[11px] font-black text-zinc-400 dark:text-zinc-500">{budgetLabel}</div>
        </div>
      </div>
    </div>
  );
}

export default async function PreviewMaskedDashboardServer({ slot }: { slot: SlotSnapshot }) {
  const items = await fetchPreviewItems();
  // Wave 1229: 공개(증거) 3개 + 잠금 티저 3개.
  const visible = items.slice(0, 3);
  const locked = items.slice(3, 6);
  const remaining = Math.max(0, slot.capacity - slot.filled);

  // Wave launch-121 (2026-05-24): 옛 베이지 #fbfaf7 → toss 회색 #f5f7fb (root themeColor 와 통일).
  return (
    <main className="min-h-screen bg-[#f5f7fb] dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-4 py-3 sm:gap-6 sm:px-6 sm:py-8 lg:grid lg:grid-cols-[minmax(0,0.88fr)_minmax(420px,1fr)] lg:items-start lg:gap-8">
        <section className="pt-0 lg:sticky lg:top-24 lg:pt-8">
          {/* Wave 1229b: 상단 선착순 배너 버튼 제거 → 히어로 안 스카시 칩(비-버튼). */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            🔥 지금 300명 한정 · <span className="tabular-nums">{remaining}</span>자리 남음
          </div>
          <h1 className="mt-3 break-keep text-[28px] font-black leading-[1.05] tracking-tight text-[var(--rd-ink)] dark:text-zinc-50 sm:mt-4 sm:text-[44px] lg:text-[52px]">
            시세보다 평균{" "}
            <span className="whitespace-nowrap text-emerald-600 dark:text-emerald-400">3만원+</span>
            <br />
            싼 중고만 모아드려요.
          </h1>
          <p className="mt-2 max-w-[460px] break-keep text-[13px] font-semibold leading-5 text-[#5f6a60] dark:text-zinc-300 sm:mt-4 sm:text-[15px] sm:leading-7">
            번개장터·중고나라·당근에서 시세보다 싼 매물만 AI가 골라드려요. 매입가와 시세를 자동으로 비교해드려요.
          </p>
          <p className="mt-1.5 max-w-[460px] break-keep text-[11px] font-bold leading-4 text-zinc-500 dark:text-zinc-400 sm:text-[12px]">
            로그인 후 승인된 멤버만 지금 진행 중인 추천 매물과 원본 링크를 볼 수 있어요.
          </p>

          <div className="mt-4 sm:mt-6">
            <Link
              href="/login?next=/plans"
              className="inline-flex h-12 w-full max-w-[340px] items-center justify-center gap-2 rounded-2xl bg-[#111816] px-5 text-[15px] font-black text-white shadow-[0_16px_36px_rgba(17,24,22,0.16)] transition hover:bg-[#26312c] dark:bg-white dark:text-zinc-950"
            >
              <UnlockIcon width={17} height={17} /> 지금 시작하기
            </Link>
            <div className="mt-2.5">
              <Link
                href="/intro"
                className="text-[12.5px] font-bold text-zinc-500 underline decoration-zinc-300 underline-offset-2 transition hover:text-zinc-800 dark:text-zinc-400 dark:decoration-zinc-600 dark:hover:text-zinc-200"
              >
                어떤 서비스인지 먼저 볼래요 →
              </Link>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="px-3 py-3 sm:px-4">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white/80 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                지금 추천 매물 준비 중. 잠시 후 다시 와 보세요.
              </div>
            ) : (
              <div className="space-y-2">
                {visible.map((item) => (
                  <PreviewCard key={item.slot} item={item} />
                ))}

                {/* Wave 1229: 잠금 티저 — 블러된 실제 카드 + 페이드 + 게이트. "빙산의 일각" 효과. */}
                {locked.length > 0 ? (
                  <div className="relative">
                    <div
                      className="pointer-events-none min-h-[240px] select-none space-y-2 blur-[5px] [filter:blur(5px)]"
                      aria-hidden="true"
                    >
                      {locked.map((item) => (
                        <PreviewCard key={item.slot} item={item} />
                      ))}
                    </div>

                    <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-b from-transparent via-white/75 to-white px-2 dark:via-zinc-900/75 dark:to-zinc-900">
                      <div className="mb-2 w-full max-w-[380px] rounded-2xl border border-zinc-200 bg-white/95 p-4 text-center shadow-[0_12px_34px_rgba(15,23,42,0.12)] backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
                        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="4" y="10" width="16" height="11" rx="2.5" />
                            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                          </svg>
                        </div>
                        <div className="mt-2.5 break-keep text-[15px] font-black leading-snug text-zinc-950 dark:text-zinc-50">
                          시세보다 싼 매물, 지금 수천 개가 더 있어요
                        </div>
                        <div className="mt-1 break-keep text-[12px] font-bold leading-5 text-zinc-500 dark:text-zinc-400">
                          로그인하면 <span className="text-zinc-900 dark:text-zinc-100">전체 매물 + 어디서 사는지(원본 링크)</span>까지 공개돼요.
                        </div>
                        <Link
                          href="/login?next=/plans"
                          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-[#111816] px-4 text-[14px] font-black text-white transition hover:bg-[#26312c] dark:bg-white dark:text-zinc-950"
                        >
                          <UnlockIcon width={15} height={15} /> 잠금 풀고 전체 보기 →
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
