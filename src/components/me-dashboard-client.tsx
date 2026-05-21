"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import AdminPoolBrowser from "@/components/admin-pool-browser";
import AdminClassificationBrowser from "@/components/admin-classification-browser";
import HotdealAlertsView from "@/components/hotdeal-alerts-view";
import PlaybookOverview from "@/components/playbook-overview";
// Wave 343: history view = ExploreClient. UserRevealDashboard / RecommendationWorkspace / PackageIcon / SearchIcon / userRefForAuthUser 미사용 제거.
import ExploreClient from "@/components/explore-client";
import PreviewMaskedDashboard from "@/components/preview-masked-dashboard";
import { MyFeedbackActivity } from "@/components/my-feedback-activity";
import { isAdminUser } from "@/lib/auth-users";
import { hasAdminShadowClient } from "@/lib/admin-shadow-mode";
import { MODEL_GUIDES } from "@/lib/model-guides";
// Wave 343: welcome flow 폐기로 dispatchPackRevealsUpdated/PackBand/PackOpenResult/RevealCard 미사용.
import type { InventorySnapshot } from "@/lib/pack-open";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

// Wave 90 (2026-05-15): view를 단일 활성 view로 분리. 이전엔 "work" view 안에
// recommend + history 섹션이 같이 mount돼서 /me 들어올 때마다 둘 다 fetch.
// 이제 각 view 클릭 시 그것만 mount → DB I/O 절약.
// Wave 93a: hotdeal-alerts (텔레그램 알림) 메뉴 추가.
type DashboardView = "recommend" | "history" | "guides" | "hotdeal-alerts" | "admin-pool" | "admin-classification";

function GuideLibraryView() {
  return (
    <section className="px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
      <PlaybookOverview />

      <div className="mt-6 rounded-[24px] border border-[#e2d9cb] bg-[#fffaf6] p-4 shadow-[0_18px_36px_rgba(34,49,39,0.06)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-6 lg:rounded-[28px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-emerald-400">
              Model Guides
            </p>
            <h2 className="mt-1.5 text-xl font-black tracking-tight text-[#223127] dark:text-white sm:text-2xl lg:text-3xl">
              모델별 공략
            </h2>
            <p className="mt-2 max-w-2xl text-xs font-semibold leading-6 text-[#687366] dark:text-zinc-400 sm:text-sm">
              추천 상품을 보기 전에 확인할 모델별 옵션 축과 리셀 체크포인트입니다.
              같은 이름처럼 보여도 옵션이 다르면 다른 상품으로 봅니다.
            </p>
          </div>
          <span className="rounded-full border border-[#d5dfd2] bg-[var(--brand-accent-soft)] px-3 py-1 text-xs font-black text-[var(--brand-accent-strong)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
            {MODEL_GUIDES.length}개
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

const VALID_VIEWS: DashboardView[] = ["recommend", "history", "guides", "hotdeal-alerts", "admin-pool", "admin-classification"];

// 2026-05-17: default view = "history" (나의 상품). 추천 받기 메뉴 폐기 — "더 찾아보기" 버튼으로 통합.
function initialViewFromUrl(): DashboardView {
  if (typeof window === "undefined") return "history";
  const v = new URLSearchParams(window.location.search).get("view");
  return (VALID_VIEWS as string[]).includes(v ?? "") ? (v as DashboardView) : "history";
}

// Wave 343: initialInventory는 next/server에서 page.tsx prop으로 강제 전달 (서버 prop). 미사용이지만 시그니처 유지.
export default function MeDashboardClient({ initialInventory: _initialInventory }: { initialInventory: InventorySnapshot[] }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<DashboardView>(initialViewFromUrl);
  const [isPro, setIsPro] = useState<boolean>(false);
  const [isBetaTester, setIsBetaTester] = useState<boolean>(false);
  const [shadowMode, setShadowMode] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  // Wave 343: welcome flow 폐기 (ExploreClient로 통합). welcomePending state 제거.
  // seekMoreOpen modal 제거 ("더 찾아보기" 버튼 사라짐 — cooldown으로 대체).
  // Wave 343: welcome flow 폐기로 welcomeRequestedRef 제거됨.

  useEffect(() => {
    setShadowMode(hasAdminShadowClient());
    try {
      setSidebarCollapsed(window.localStorage.getItem("me_sidebar_collapsed") === "1");
    } catch {}
    // Wave 199 (2026-05-19): 가입 직후 me 진입 시 localStorage 의 pending consent 를 DB insert.
    //   카카오 OAuth callback 후 클라이언트 진입 시점에만 가능 (server callback 은 access_token X).
    //   best-effort — 실패해도 사용자 진행에 영향 X. 운영자가 추후 검증 가능.
    void import("@/lib/pending-consents").then(({ flushPendingConsents }) => {
      flushPendingConsents().catch((err) => console.warn("[consents] flush failed (non-fatal)", err));
    });
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        if (next) window.localStorage.setItem("me_sidebar_collapsed", "1");
        else window.localStorage.removeItem("me_sidebar_collapsed");
      } catch {}
      return next;
    });
  };

  const effectiveAdmin = isAdminUser(user) && !shadowMode;

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

  // Wave 93b: Pro 여부 fetch (메뉴 게이팅). 2026-05-15: isBetaTester 같이 가져옴.
  useEffect(() => {
    if (!user) { setIsPro(false); setIsBetaTester(false); return; }
    let cancelled = false;
    fetch("/api/me/subscription", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { isPro?: boolean; isBetaTester?: boolean } | null) => {
        if (!cancelled && data) {
          setIsPro(Boolean(data.isPro));
          setIsBetaTester(Boolean(data.isBetaTester));
        }
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

  // Wave 343: welcome flow 폐기 — /me history view가 ExploreClient (freemium 30개 풀)로 통합.
  // 신규 가입자도 진입 즉시 30개 풀 봄 → welcome 4개 reserve 불필요.
  // /api/packs/welcome endpoint와 mvp_welcome_grants 테이블은 유지 (히스토리). 단 호출 X.

  // Wave 90: IntersectionObserver(스크롤 추적) 제거 — 각 view 단독 mount라 의미 X

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f1e8] dark:bg-zinc-950">
        <div className="grid min-h-screen lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Sidebar skeleton — layout 점프 방지 */}
          <aside className="border-b border-[#e2d9cb] bg-[#f8f4ec] dark:border-zinc-800 dark:bg-zinc-950 lg:border-b-0 lg:border-r">
            <div className="px-3 py-2 lg:px-4 lg:py-5">
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
          <section className="w-full min-w-0 px-3 py-4 sm:px-4 sm:py-6 lg:col-start-2 lg:px-5 lg:py-8">
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

  // 2026-05-17: 비로그인 사용자 = 마스킹 매물 preview (메인 페이지 hook).
  // 옛 "로그인 필요" 페이지 폐기. PreviewMaskedDashboard 가 자체 SEO + CTA 박음.
  if (!user) {
    return <PreviewMaskedDashboard />;
  }

  return (
    <main className="min-h-screen bg-[#f6f1e8] dark:bg-zinc-950">
      {/* mobile = flex stack (sidebar chip bar 위, content 아래).
          lg+ = 2 col grid. 이전에 mobile에서도 `grid` 박혀 있어서 child의
          `lg:col-start-2`가 일부 브라우저 implicit-grid 처리로 빈 column 만들어
          content가 오른쪽으로 치우치는 보고 있었음 → mobile에선 grid 비활성. */}
      <div className={`flex min-h-screen flex-col lg:grid ${sidebarCollapsed ? "lg:grid-cols-[44px_minmax(0,1fr)]" : "lg:grid-cols-[220px_minmax(0,1fr)]"} transition-[grid-template-columns] duration-200`}>
        {/* Mobile: 상품 피드 우선. 탭 바는 숨기고 desktop sidebar 에서만 view 전환. */}
        <aside className="hidden border-b border-[#e2d9cb] bg-[#f8f4ec]/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 lg:sticky lg:top-[60px] lg:z-30 lg:row-span-2 lg:block lg:h-[calc(100dvh-60px)] lg:border-b-0 lg:border-r lg:bg-[#f8f4ec] lg:backdrop-blur-none xl:row-span-1">
          <div className="flex h-full items-center px-3 py-1 lg:block lg:h-auto lg:px-2 lg:py-3">
            {/* desktop only: collapse toggle 버튼 — 우측 정렬 (saas 표준 패턴) */}
            <div className="hidden lg:flex lg:justify-end lg:mb-1.5">
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#5a6658] hover:bg-[var(--brand-accent-soft)] hover:text-[var(--brand-accent-strong)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label={sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
                title={sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
              >
                <span className="text-sm font-black leading-none">{sidebarCollapsed ? "»" : "«"}</span>
              </button>
            </div>
            <div className={`hidden px-2 pb-3 lg:block ${sidebarCollapsed ? "lg:hidden" : ""}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-emerald-400">
                My Dashboard
              </p>
              <div className="mt-1 text-sm font-black text-[#223127] dark:text-zinc-100">작업 메뉴</div>
            </div>
            <div className={`-mx-1 flex w-full items-center gap-1.5 overflow-x-auto px-1 lg:mx-0 lg:block lg:w-auto lg:space-y-1 lg:overflow-visible lg:px-0 ${sidebarCollapsed ? "lg:hidden" : ""}`}>
              {/* 2026-05-17: "recommend" 메뉴 제거 — "나의 상품" 1 페이지 통합 + "더 찾아보기" 버튼으로 흡수. */}
              {(["history", "guides", ...(isPro || effectiveAdmin ? (["hotdeal-alerts"] as const) : []), ...(effectiveAdmin || isBetaTester ? (["admin-pool"] as const) : []), ...(effectiveAdmin ? (["admin-classification"] as const) : [])] as const).map((v) => {
                const label = v === "history" ? "나의 상품"
                  : v === "guides" ? "공략집"
                  : v === "hotdeal-alerts" ? "핫딜 알림"
                  : v === "admin-classification" ? "분류 검증"
                  : "운영자";
                const lgLabel = v === "history" ? "나의 상품"
                  : v === "guides" ? "공략집"
                  : v === "hotdeal-alerts" ? "핫딜 알림"
                  : v === "admin-classification" ? "🔧 운영자: 분류 검증"
                  : "🔧 운영자: 풀 전체";
                const active = activeView === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setActiveView(v)}
                    className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-black transition lg:w-full lg:justify-between lg:rounded-xl lg:border lg:px-3 lg:py-2 lg:text-sm dark:text-zinc-100 dark:hover:bg-zinc-800 ${
                      active
                        ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)] lg:border-[#c8d8c4] lg:bg-[var(--brand-accent-soft)] lg:text-[var(--brand-accent-strong)]"
                        : "bg-transparent text-[#344136] hover:bg-[var(--brand-accent-soft)] lg:border-transparent"
                    }`}
                  >
                    <span className="lg:hidden">{label}</span>
                    <span className="hidden lg:inline">{lgLabel}</span>
                    <span className="hidden text-zinc-400 lg:inline">↘</span>
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
        ) : activeView === "admin-classification" ? (
          <AdminClassificationBrowser />
        ) : (
          // Wave 343: history view = freemium 탐색 (ExploreClient).
          // welcome 4개 + UserRevealDashboard 폐기 → 30개 풀 + cooldown + sold out + 통계 + paywall 예고.
          // Wave 404: 수익/손실 회피 카운터는 PG 심사 톤에 맞지 않아 /me에서 제거.
          // "더 찾아보기" 버튼들 폐기 — ExploreClient의 "새 30개 받기" cooldown으로 대체.
          <section className="w-full min-w-0 pb-4 lg:col-start-2">
            <ExploreClient storageScope={user.id} />
            <MyFeedbackActivity />
          </section>
        )}
      </div>
    </main>
  );
}
