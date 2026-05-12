"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import RecommendationWorkspace from "@/components/recommendation-workspace";
import UserRevealDashboard from "@/components/user-reveal-dashboard";
import { MODEL_GUIDES } from "@/lib/model-guides";
import type { InventorySnapshot } from "@/lib/pack-open";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { userRefForAuthUser } from "@/lib/user-ref";

type DashboardSection = "dashboard-recommend" | "dashboard-guides" | "dashboard-history";
type DashboardView = "work" | "guides";

function GuideLibraryView() {
  return (
    <section className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="rounded-[28px] border border-[#e2d9cb] bg-[#fffaf6] p-5 shadow-[0_18px_36px_rgba(34,49,39,0.06)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-emerald-400">
              Guide Library
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#223127] dark:text-white sm:text-3xl">
              공략집
            </h1>
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

export default function MeDashboardClient({ initialInventory }: { initialInventory: InventorySnapshot[] }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<DashboardSection>("dashboard-recommend");
  const [activeView, setActiveView] = useState<DashboardView>("work");

  const scrollToSection = useCallback((id: string) => {
    if (typeof document === "undefined") return;
    const section = document.getElementById(id);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const showWorkSection = useCallback((id: DashboardSection) => {
    setActiveView("work");
    setActiveSection(id);
    window.requestAnimationFrame(() => scrollToSection(id));
  }, [scrollToSection]);

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

  useEffect(() => {
    if (activeView !== "work") return;
    if (typeof IntersectionObserver === "undefined") return;
    const sectionIds: DashboardSection[] = ["dashboard-recommend", "dashboard-history"];
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible && sectionIds.includes(visible.target.id as DashboardSection)) {
          setActiveSection(visible.target.id as DashboardSection);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.2, 0.45, 0.7] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [user, activeView]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f1e8] px-4 py-8 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-[#ddd4c7] bg-[#fffbf4] p-6 text-sm font-bold text-[#5a6658] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          계정 확인 중
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
              <button
                type="button"
                onClick={() => showWorkSection("dashboard-recommend")}
                className={`flex min-w-max items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-black transition dark:text-zinc-100 dark:hover:bg-zinc-800 lg:w-full ${
                  activeView === "work" && activeSection === "dashboard-recommend"
                    ? "border-[#c8d8c4] bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)]"
                    : "border-transparent text-[#344136] hover:bg-[var(--brand-accent-soft)]"
                }`}
              >
                <span>추천 상품 받기</span>
                <span className="text-zinc-400">↘</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("guides")}
                className={`flex min-w-max items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-black transition dark:text-zinc-100 dark:hover:bg-zinc-800 lg:w-full ${
                  activeView === "guides"
                    ? "border-[#c8d8c4] bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)]"
                    : "border-transparent text-[#344136] hover:bg-[var(--brand-accent-soft)]"
                }`}
              >
                <span>공략집</span>
                <span className="text-zinc-400">↘</span>
              </button>
              <button
                type="button"
                onClick={() => showWorkSection("dashboard-history")}
                className={`flex min-w-max items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-black transition dark:text-zinc-100 dark:hover:bg-zinc-800 lg:w-full ${
                  activeView === "work" && activeSection === "dashboard-history"
                    ? "border-[#c8d8c4] bg-[var(--brand-accent-soft)] text-[var(--brand-accent-strong)]"
                    : "border-transparent text-[#344136] hover:bg-[var(--brand-accent-soft)]"
                }`}
              >
                <span>나의 상품</span>
                <span className="text-zinc-400">↘</span>
              </button>
            </div>
          </div>
        </aside>

        {activeView === "guides" ? (
          <GuideLibraryView />
        ) : (
          <div className="grid gap-5 px-4 py-6 lg:col-start-2 lg:px-5 lg:py-8 xl:grid-cols-[minmax(360px,440px)_minmax(0,1fr)] xl:items-start">
            <section id="dashboard-recommend" className="xl:sticky xl:top-24 xl:self-start">
              <RecommendationWorkspace initialInventory={initialInventory} />
            </section>

            <section id="dashboard-history" className="min-w-0">
              <UserRevealDashboard userRef={userRefForAuthUser(user.id)} />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
