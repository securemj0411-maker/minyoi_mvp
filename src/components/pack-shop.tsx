"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LandingKpis, LandingShowcase } from "@/lib/landing-showcases";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const trustPoints = [
  "다시 확인 후 추천",
  "검증 실패 시 환불",
  "같은 본품끼리만 비교",
];

function krw(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function LandingCardIcon({ type }: { type: "start" | "filter" | "dashboard" }) {
  if (type === "filter") {
    return (
      <svg viewBox="0 0 88 88" className="h-14 w-14" aria-hidden="true">
        <rect x="12" y="16" width="64" height="56" rx="20" fill="#edf3eb" stroke="#b9c9b9" strokeWidth="3" />
        <path d="M27 32h34M27 48h34M27 64h34" stroke="#314238" strokeWidth="5" strokeLinecap="round" />
        <circle cx="43" cy="32" r="6" fill="#fffbf4" stroke="#314238" strokeWidth="3" />
        <circle cx="54" cy="48" r="6" fill="#fffbf4" stroke="#314238" strokeWidth="3" />
        <circle cx="36" cy="64" r="6" fill="#fffbf4" stroke="#314238" strokeWidth="3" />
      </svg>
    );
  }

  if (type === "dashboard") {
    return (
      <svg viewBox="0 0 88 88" className="h-14 w-14" aria-hidden="true">
        <rect x="12" y="16" width="64" height="56" rx="18" fill="#fffaf1" stroke="#d8decd" strokeWidth="3" />
        <rect x="24" y="28" width="18" height="16" rx="6" fill="#edf3eb" stroke="#9fb49c" strokeWidth="3" />
        <rect x="46" y="28" width="18" height="16" rx="6" fill="#314238" />
        <path d="M25 57h18M49 57h14M25 64h38" stroke="#314238" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 88 88" className="h-14 w-14" aria-hidden="true">
      <circle cx="44" cy="44" r="30" fill="#edf3eb" stroke="#b9c9b9" strokeWidth="3" />
      <path d="M34 52c8-18 16-18 24 0" fill="none" stroke="#314238" strokeWidth="6" strokeLinecap="round" />
      <path d="M44 25v22" stroke="#314238" strokeWidth="6" strokeLinecap="round" />
      <path d="M36 35h16" stroke="#314238" strokeWidth="6" strokeLinecap="round" />
      <circle cx="44" cy="60" r="5" fill="#314238" />
    </svg>
  );
}

function ShowcaseCard({
  activeItem,
  items,
  activeIndex,
  onSelectIndex,
  setPaused,
  previousItem,
  transitionId,
  className = "",
}: {
  activeItem: LandingShowcase | null;
  items: LandingShowcase[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
  setPaused: (paused: boolean) => void;
  previousItem: LandingShowcase | null;
  transitionId: number;
  className?: string;
}) {
  return (
    <div
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={`mx-auto w-full max-w-[460px] rounded-[28px] border border-[#e7dece] bg-[linear-gradient(180deg,#fffaf1_0%,#f7efdf_100%)] p-3 shadow-[0_18px_36px_rgba(34,49,39,0.08)] dark:border-zinc-800 dark:bg-zinc-950/50 ${className}`}
    >
      <div className="overflow-hidden rounded-[24px] border border-[#eadfce] bg-[#fffdf8] dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="relative aspect-[16/9] overflow-hidden bg-[#eee7da]">
          {previousItem ? (
            <div key={`previous-image-${previousItem.pid}-${transitionId}`} className="showcase-swipe-out absolute inset-0">
              <div className="absolute inset-0 scale-[1.03] opacity-82 blur-[2px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previousItem.imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,251,244,0.08),rgba(238,231,218,0.22))]" />
              <div className="absolute inset-0 p-3 sm:p-4">
                <div className="flex h-full w-full items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previousItem.imageUrl}
                    alt=""
                    aria-hidden="true"
                    className="max-h-full max-w-full rounded-[22px] object-contain object-center shadow-[0_12px_24px_rgba(34,49,39,0.12)] ring-1 ring-black/8"
                  />
                </div>
              </div>
            </div>
          ) : null}
          {activeItem ? (
            <div key={`image-${activeItem.pid}-${transitionId}`} className="showcase-swipe-in absolute inset-0">
              <div className="absolute inset-0 scale-[1.03] opacity-82 blur-[2px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeItem.imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover object-center"
                />
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,251,244,0.08),rgba(238,231,218,0.22))]" />
              <div className="absolute inset-0 p-3 sm:p-4">
                <div className="flex h-full w-full items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeItem.imageUrl}
                    alt={activeItem.name}
                    className="max-h-full max-w-full rounded-[22px] object-contain object-center shadow-[0_12px_24px_rgba(34,49,39,0.12)] ring-1 ring-black/8 transition-opacity duration-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.72),rgba(238,231,218,0.95))]" />
          )}
          <div className="absolute left-4 top-4 rounded-full bg-[rgba(49,66,56,0.82)] px-3 py-1.5 text-xs font-black text-[var(--brand-cream)] backdrop-blur">
            최근 판매 예시
          </div>
          <div className="absolute right-4 top-4 rounded-[18px] bg-[#fffaf1]/92 px-4 py-3 text-center shadow-sm backdrop-blur dark:bg-zinc-900/90">
            <div className="text-[11px] font-bold text-zinc-400">신뢰</div>
            <div className="mt-1 text-2xl font-black text-zinc-900 dark:text-zinc-100">
              {activeItem ? `${activeItem.confidencePercent}%` : "-"}
            </div>
          </div>
        </div>

        <div key={`content-${activeItem?.pid ?? "empty"}-${transitionId}`} className="showcase-content-in p-4">
          <div className="truncate text-[20px] font-black leading-tight text-zinc-900 dark:text-zinc-50 sm:text-[22px]">
            {activeItem?.name ?? "실거래 예시 상품"}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
            <div className="text-[40px] font-black leading-none tracking-tight text-emerald-500 sm:text-[46px]">
              {activeItem ? `+${Math.round(activeItem.expectedProfit).toLocaleString("ko-KR")}원` : "-"}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] font-black text-zinc-700 dark:text-zinc-200">
            <span>{activeItem ? `매입 ${krw(activeItem.buyPrice)}` : ""}</span>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <span className="text-zinc-500 dark:text-zinc-300">
              {activeItem ? `시세 ${krw(activeItem.marketPrice)}` : ""}
            </span>
          </div>

          <div className="mt-2 text-[14px] font-bold leading-6 text-zinc-700 dark:text-zinc-200">
            {activeItem?.skuLabel ?? "실거래 기준 상품"}
          </div>

          {items.length > 1 ? (
            <div className="mt-4 flex items-center justify-center gap-2">
              {items.map((item, index) => (
                <button
                  key={item.pid}
                  type="button"
                  onClick={() => onSelectIndex(index)}
                  aria-label={`${index + 1}번째 판매 예시 보기`}
                  className={`h-2.5 rounded-full transition ${
                    index === activeIndex ? "w-7 bg-[var(--brand-accent)]" : "w-2.5 bg-[#d7cdbc]"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PackShop({ showcases, kpis }: { showcases: LandingShowcase[]; kpis: LandingKpis }) {
  const items = useMemo(() => (showcases.length ? showcases : []), [showcases]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [transitionId, setTransitionId] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const id = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % items.length;
        setPreviousIndex(current);
        setTransitionId((value) => value + 1);
        return next;
      });
    }, 3500);
    return () => window.clearInterval(id);
  }, [items.length, paused]);

  useEffect(() => {
    if (previousIndex === null) return;
    const id = window.setTimeout(() => setPreviousIndex(null), 720);
    return () => window.clearTimeout(id);
  }, [previousIndex, transitionId]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setAuthenticated(Boolean(data.user));
    }).catch(() => undefined);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session?.user));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const activeItem = items[activeIndex] ?? null;
  const previousItem = previousIndex === null ? null : items[previousIndex] ?? null;

  function handleSelectIndex(index: number) {
    if (index === activeIndex) return;
    setPreviousIndex(activeIndex);
    setTransitionId((value) => value + 1);
    setActiveIndex(index);
  }

  return (
    <main className="min-h-screen bg-[#f6f1e8] dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[34px] border border-[#ddd4c7] bg-[#fffbf4] shadow-[0_24px_60px_rgba(34,49,39,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-6 px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9 xl:grid-cols-[minmax(0,1fr)_410px] xl:px-10 xl:py-9 2xl:grid-cols-[minmax(0,1.04fr)_430px] 2xl:px-12 2xl:py-10">
            <div className="flex flex-col">
              <div>
                <div className="inline-flex rounded-full border border-[#cfd9c9] bg-[#edf3eb] px-3 py-1.5 text-xs font-black text-[#4f6f58]">
                  AI 검증 추천
                </div>
                <h1 className="mt-4 max-w-[620px] break-keep text-[34px] font-black leading-[1.07] tracking-tight text-[#223127] [text-wrap:balance] sm:text-5xl sm:leading-[1.03] lg:text-[52px] dark:text-zinc-50">
                  <span className="block">검증된 중고 추천을</span>
                  <span className="block text-[#4f6f58] dark:text-emerald-300">먼저 봅니다</span>
                </h1>
                <ShowcaseCard
                  activeItem={activeItem}
                  items={items}
                  activeIndex={activeIndex}
                  onSelectIndex={handleSelectIndex}
                  setPaused={setPaused}
                  previousItem={previousItem}
                  transitionId={transitionId}
                  className="mt-5 xl:hidden"
                />
                <p className="mt-4 max-w-xl break-keep text-sm leading-6 text-[#596558] sm:text-[15px] dark:text-zinc-300">
                  옵션이 맞는 상품만 비교하고, 공개 직전에 판매 상태를 다시 확인합니다. 괜찮은 후보는 대시보드에 모아 관리할 수 있습니다.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={authenticated ? "/me" : "/login"}
                    className="inline-flex items-center justify-center rounded-2xl bg-[#314238] px-6 py-3.5 text-base font-black text-[#f7f1e6] shadow-[0_14px_28px_rgba(49,66,56,0.16)] transition hover:bg-[#27362e]"
                  >
                    추천 시작하기
                  </Link>
                  <Link
                    href="/plans"
                    className="inline-flex items-center justify-center rounded-2xl border border-[#ddd4c7] bg-[#fffaf1] px-5 py-3.5 text-sm font-black text-[#344136] transition hover:bg-[#f4eee3] dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200"
                  >
                    요금제 보기
                  </Link>
                  <Link
                    href="/how-it-works"
                    className="inline-flex items-center justify-center rounded-2xl border border-[#ddd4c7] bg-[#fffaf1] px-5 py-3.5 text-sm font-black text-[#344136] transition hover:bg-[var(--brand-accent-soft)] dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200"
                  >
                    어떻게 작동하나요?
                  </Link>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {trustPoints.map((point) => (
                    <span
                      key={point}
                      className="flex items-center gap-2 rounded-2xl border border-[#ddd4c7] bg-[#fffaf1] px-3 py-2 text-xs font-black text-[#556252] dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300"
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent-strong)] text-[10px] text-[var(--brand-cream)]">✓</span>
                      {point}
                    </span>
                  ))}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-[#e4dacb] bg-[#fffaf1] px-4 py-3">
                    <div className="text-[11px] font-black text-[#6a7267]">추천 평균 차익</div>
                    <div className="mt-1 text-[22px] font-black leading-none text-[#1f2d24]">
                      +{Math.round(kpis.averageProfit).toLocaleString("ko-KR")}원
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-[#5d735f]">
                      조건 통과 상품 기준
                    </div>
                  </div>
                  <div className="rounded-[22px] border-2 border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] px-4 py-3 shadow-[0_10px_20px_rgba(92,116,95,0.10)]">
                    <div className="text-[11px] font-black text-[var(--brand-accent-strong)]">현재 가능 최대 차익</div>
                    <div className="mt-1 text-[22px] font-black leading-none text-[var(--brand-accent-strong)]">
                      +{Math.round(kpis.maxProfit).toLocaleString("ko-KR")}원
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-[rgba(49,66,56,0.72)]">
                      현재 추천 가능 상품 기준
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ShowcaseCard
              activeItem={activeItem}
              items={items}
              activeIndex={activeIndex}
              onSelectIndex={handleSelectIndex}
              setPaused={setPaused}
              previousItem={previousItem}
              transitionId={transitionId}
              className="hidden xl:mx-0 xl:block xl:max-w-none"
            />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[28px] border border-[#ddd4c7] bg-[#fffbf4] px-6 py-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#d8decd] bg-[#fffaf1]">
              <LandingCardIcon type="start" />
            </div>
            <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">이렇게 시작해요</div>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              <li>1. 대시보드에서 수익 구간을 고릅니다.</li>
              <li>2. AI가 다시 확인한 상품만 추려서 보여줍니다.</li>
              <li>3. 괜찮은 상품은 저장하고 다시 관리합니다.</li>
            </ol>
          </div>

          <div className="rounded-[28px] border border-[#ddd4c7] bg-[#fffbf4] px-6 py-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#d8decd] bg-[#fffaf1]">
              <LandingCardIcon type="filter" />
            </div>
            <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">추천에서 빼는 것</div>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              단품 유닛, 케이스만, 본체만처럼 비교가 섞이는 상품은 제외합니다. 옵션이 갈리는
              모델도 같은 조건끼리만 맞춰서 비교합니다.
            </p>
          </div>

          <div className="rounded-[28px] border border-[#ddd4c7] bg-[#fffbf4] px-6 py-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#d8decd] bg-[#fffaf1]">
              <LandingCardIcon type="dashboard" />
            </div>
            <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">대시보드에서 할 수 있는 것</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              <li>수익 구간별 추천 보기</li>
              <li>추천 상품 수 조절하기</li>
              <li>관심 상품 기록 관리하기</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
