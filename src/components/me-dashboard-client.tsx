"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useState } from "react";
import AdminPoolBrowser from "@/components/admin-pool-browser";
import HotdealAlertsView from "@/components/hotdeal-alerts-view";
import PlaybookOverview from "@/components/playbook-overview";
import RecommendationWorkspace from "@/components/recommendation-workspace";
import UserRevealDashboard from "@/components/user-reveal-dashboard";
import { isAdminUser } from "@/lib/auth-users";
import { MODEL_GUIDES } from "@/lib/model-guides";
import type { InventorySnapshot } from "@/lib/pack-open";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { userRefForAuthUser } from "@/lib/user-ref";

// Wave 90 (2026-05-15): view를 단일 활성 view로 분리. 이전엔 "work" view 안에
// recommend + history 섹션이 같이 mount돼서 /me 들어올 때마다 둘 다 fetch.
// 이제 각 view 클릭 시 그것만 mount → DB I/O 절약.
// Wave 93a: hotdeal-alerts (텔레그램 알림) 메뉴 추가.
type DashboardView = "recommend" | "history" | "guides" | "hotdeal-alerts" | "admin-pool";

function GuideLibraryView() {
  return (
    <section className="px-4 py-6 lg:px-8 lg:py-8">
      <PlaybookOverview />

      <div className="mt-8 rounded-[28px] border border-[#e2d9cb] bg-[#fffaf6] p-5 shadow-[0_18px_36px_rgba(34,49,39,0.06)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-emerald-400">
              Model Guides
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#223127] dark:text-white sm:text-3xl">
              모델별 공략
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#687366] dark:text-zinc-400">
              추천 상품을 보기 전에 확인할 모델별 옵션 축과 리셀 체크포인트입니다.
              같은 이름처럼 보여도 옵션이 다르면 다른 상품으로 봅니다.
            </p>
          </div>
          <span className="rounded-full border border-[#d5dfd2] bg-[var(--brand-accent-soft)] px-3 py-1 text-xs font-black text-[var(--brand-accent-strong)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
            {MODEL_GUIDES.length}개
          </span>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {MODEL_GUIDES.map((guide) => (
            <article
              key={guide.guideKey}
              className="flex min-h-[190px] flex-col rounded-2xl border border-[#e7dece] bg-[#fffbf4] p-4 transition hover:border-[#c8d8c4] hover:bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-800"
            >
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#7a8577] dark:text-zinc-500">
                <span>{guide.category === "earphone" ? "이어폰" : "워치"}</span>
                <span>·</span>
                <span>{guide.family}</span>
              </div>
              <h2 className="mt-2 line-clamp-2 text-base font-black leading-6 text-[#223127] dark:text-zinc-100">
                {guide.title}
              </h2>
              <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-[#626d61] dark:text-zinc-400">
                {guide.summary}
              </p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                {guide.quickFacts.slice(0, 4).map((fact) => (
                  <span
                    key={`${guide.guideKey}-${fact}`}
                    className="rounded-full bg-[#f3eee5] px-2 py-1 text-[10px] font-bold text-[#657060] dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {fact}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const VALID_VIEWS: DashboardView[] = ["recommend", "history", "guides", "hotdeal-alerts", "admin-pool"];

function initialViewFromUrl(): DashboardView {
  if (typeof window === "undefined") return "recommend";
  const v = new URLSearchParams(window.location.search).get("view");
  return (VALID_VIEWS as string[]).includes(v ?? "") ? (v as DashboardView) : "recommend";
}

export default function MeDashboardClient({ initialInventory }: { initialInventory: InventorySnapshot[] }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<DashboardView>(initialViewFromUrl);
  const [isPro, setIsPro] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    async function loadUser() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (mounted) setLoading(false);
        return;
      }
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(data.user ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  // Wave 93b: Pro 여부 fetch (메뉴 게이팅).
  useEffect(() => {
    if (!user) { setIsPro(false); return; }
    let cancelled = false;
    fetch("/api/me/subscription", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { isPro?: boolean } | null) => {
        if (!cancelled && data) setIsPro(Boolean(data.isPro));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Wave 90: IntersectionObserver(스크롤 추적) 제거 — 각 view 단독 mount라 의미 X

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f1e8] dark:bg-zinc-950">
        <div className="grid min-h-screen lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Sidebar skeleton — layout 점프 방지 */}
          <aside className="border-b border-[#e2d9cb] bg-[#f8f4ec] dark:border-zinc-800 dark:bg-zinc-950 lg:border-b-0 lg:border-r">
            <div className="px-4 py-4 lg:px-4 lg:py-5">
              <div className="space-y-2 px-2 pb-3">
                <div className="h-2.5 w-24 animate-pulse rounded bg-[#e7dece] dark:bg-zinc-800" />
                <div className="h-4 w-32 animate-pulse rounded bg-[#e7dece] dark:bg-zinc-800" />
              </div>
              <div className="flex gap-1 overflow-hidden pb-1 lg:block lg:space-y-2 lg:pb-0">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-10 w-32 shrink-0 animate-pulse rounded-xl bg-[#e7dece] dark:bg-zinc-800 lg:w-full"
                  />
                ))}
              </div>
            </div>
          </aside>
          {/* Main content skeleton — 추천 카드 grid 자리 */}
          <section className="px-4 py-6 lg:col-start-2 lg:px-5 lg:py-8">
            <div className="space-y-4">
              <div className="h-6 w-48 animate-pulse rounded bg-[#e7dece] dark:bg-zinc-800" />
              <div className="h-4 w-72 max-w-full animate-pulse rounded bg-[#e7dece] dark:bg-zinc-800" />
              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-44 animate-pulse rounded-2xl bg-[#f1eadf] dark:bg-zinc-800/60"
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f6f1e8] px-4 py-8 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl rounded-[32px] border border-[#ddd4c7] bg-[#fffbf4] p-8 shadow-[0_20px_48px_rgba(34,49,39,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-black uppercase tracking-widest text-[#5d735f] dark:text-emerald-400">
            My Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-[#223127] dark:text-white">로그인이 필요해요</h1>
          <p className="mt-3 text-sm text-[#5a6658] dark:text-zinc-400">
            추천 상품 기록과 피드백은 로그인 계정 기준으로 모아봅니다.
          </p>
          <div className="mt-6 flex gap-2">
            <Link href="/login" className="rounded-xl bg-[var(--brand-accent-strong)] px-4 py-2 text-sm font-black text-[var(--brand-cream)] dark:bg-zinc-100 dark:text-zinc-950">
              로그인
            </Link>
            <Link href="/" className="rounded-xl border border-[#ddd4c7] px-4 py-2 text-sm font-bold text-[#556252] dark:border-zinc-700 dark:text-zinc-300">
              홈으로
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f1e8] dark:bg-zinc-950">
      <div className="grid min-h-screen lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-[#e2d9cb] bg-[#f8f4ec] dark:border-zinc-800 dark:bg-zinc-950 lg:sticky lg:top-[65px] lg:row-span-2 lg:h-[calc(100dvh-65px)] lg:border-b-0 lg:border-r xl:row-span-1">
          <div className="px-4 py-4 lg:px-4 lg:py-5">
            <div className="px-2 pb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-emerald-400">
                My Dashboard
              </p>
              <div className="mt-1 text-sm font-black text-[#223127] dark:text-zinc-100">작업 메뉴</div>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
              {(["recommend", "history", "guides", ...(isPro ? (["hotdeal-alerts"] as const) : []), ...(isAdminUser(user) ? (["admin-pool"] as const) : [])] as const).map((v) => {
                const label = v === "recommend" ? "추천 상품 받기"
                  : v === "history" ? "나의 상품"
                  : v === "guides" ? "공략집"
                  : v === "hotdeal-alerts" ? "핫딜 알림"
                  : "🔧 운영자: 풀 전체";
                const active = activeView === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setActiveView(v)}
                    className={`flex min-w-max items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-black transition dark:text-zinc-100 dark:hover:bg-zinc-800 lg:w-full ${
                      active
                        ? "border-[#c8d8c4] bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)]"
                        : "border-transparent text-[#344136] hover:bg-[var(--brand-accent-soft)]"
                    }`}
                  >
                    <span>{label}</span>
                    <span className="text-zinc-400">↘</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {activeView === "guides" ? (
          <GuideLibraryView />
        ) : activeView === "hotdeal-alerts" ? (
          <HotdealAlertsView />
        ) : activeView === "admin-pool" ? (
          <AdminPoolBrowser />
        ) : activeView === "recommend" ? (
          <section className="px-4 py-6 lg:col-start-2 lg:px-5 lg:py-8">
            <RecommendationWorkspace initialInventory={initialInventory} />
          </section>
        ) : (
          // history
          <section className="min-w-0 px-4 py-6 lg:col-start-2 lg:px-5 lg:py-8">
            <UserRevealDashboard userRef={userRefForAuthUser(user.id)} />
          </section>
        )}
      </div>
    </main>
  );
}
