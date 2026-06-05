"use client";

import type { User } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import AdminPoolBrowser from "@/components/admin-pool-browser";
import AdminClassificationBrowser from "@/components/admin-classification-browser";
import HotdealAlertsView from "@/components/hotdeal-alerts-view";
import PlaybookOverview from "@/components/playbook-overview";
// Wave 343: history view = ExploreClient. UserRevealDashboard / RecommendationWorkspace / PackageIcon / SearchIcon / userRefForAuthUser 미사용 제거.
import ExploreClient from "@/components/explore-client";
import PreviewMaskedDashboard from "@/components/preview-masked-dashboard";
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

      <div className="mt-6 rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_18px_36px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-6 lg:rounded-[28px]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#3182f6] dark:text-blue-400">
              Model Guides
            </p>
            <h2 className="mt-1.5 text-xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-2xl lg:text-3xl">
              모델별 공략
            </h2>
            <p className="mt-2 max-w-2xl text-xs font-semibold leading-6 text-zinc-500 dark:text-zinc-400 sm:text-sm">
              추천 상품을 보기 전에 확인할 모델별 옵션 축과 리셀 체크포인트입니다.
              같은 이름처럼 보여도 옵션이 다르면 다른 상품으로 봅니다.
            </p>
          </div>
          <span className="rounded-full border border-blue-100 bg-[var(--brand-accent-soft)] px-3 py-1 text-xs font-black text-[var(--brand-accent-strong)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
            {MODEL_GUIDES.length}개
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MODEL_GUIDES.map((guide) => (
            <article
              key={guide.guideKey}
              className="flex min-h-[190px] flex-col rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-blue-200 hover:bg-[var(--brand-accent-soft)] dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-800"
            >
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
                <span>{guide.category === "earphone" ? "이어폰" : "워치"}</span>
                <span>·</span>
                <span>{guide.family}</span>
              </div>
              <h2 className="mt-2 line-clamp-2 text-base font-black leading-6 text-zinc-950 dark:text-zinc-100">
                {guide.title}
              </h2>
              <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-zinc-500 dark:text-zinc-400">
                {guide.summary}
              </p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                {guide.quickFacts.slice(0, 4).map((fact) => (
                  <span
                    key={`${guide.guideKey}-${fact}`}
                    className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
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
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<DashboardView>(initialViewFromUrl);
  const [shadowMode, setShadowMode] = useState<boolean>(false);
  // Wave 343: welcome flow 폐기 (ExploreClient로 통합). welcomePending state 제거.
  // seekMoreOpen modal 제거 ("더 찾아보기" 버튼 사라짐 — cooldown으로 대체).
  // Wave 343: welcome flow 폐기로 welcomeRequestedRef 제거됨.

  useEffect(() => {
    setShadowMode(hasAdminShadowClient());
    // Wave 199 (2026-05-19): 가입 직후 me 진입 시 localStorage 의 pending consent 를 DB insert.
    //   카카오 OAuth callback 후 클라이언트 진입 시점에만 가능 (server callback 은 access_token X).
    //   best-effort — 실패해도 사용자 진행에 영향 X. 운영자가 추후 검증 가능.
    void import("@/lib/pending-consents").then(({ flushPendingConsents }) => {
      flushPendingConsents().catch((err) => console.warn("[consents] flush failed (non-fatal)", err));
    });
  }, []);

  useEffect(() => {
    const v = searchParams.get("view");
    setActiveView((VALID_VIEWS as string[]).includes(v ?? "") ? (v as DashboardView) : "history");
  }, [searchParams]);

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
  // /api/packs/welcome endpoint는 tombstone(410)으로만 유지. mvp_welcome_grants 테이블은 히스토리 보존.

  // Wave 90: IntersectionObserver(스크롤 추적) 제거 — 각 view 단독 mount라 의미 X

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7fb] dark:bg-zinc-950">
        <div className="min-h-screen">
          {/* Main content skeleton — 추천 카드 grid 자리 */}
          <section className="w-full min-w-0 px-3 py-4 sm:px-4 sm:py-6 lg:px-5 lg:py-8">
            <div className="space-y-4">
              <div className="h-6 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-72 max-w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-44 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/60"
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
    <main className="min-h-screen bg-[#f5f7fb] dark:bg-zinc-950">
      <div className="min-h-screen">
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
          <section className="w-full min-w-0 pb-4">
            <ExploreClient storageScope={user.id} showFirstFeedIntro={!effectiveAdmin} />
          </section>
        )}
      </div>
    </main>
  );
}
