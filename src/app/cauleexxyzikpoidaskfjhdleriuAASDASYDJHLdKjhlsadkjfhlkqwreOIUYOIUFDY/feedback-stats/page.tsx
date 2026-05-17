// Wave 188 (2026-05-17): 운영자 신고 카테고리 dashboard.
// Wave 182c 박은 inaccurate_report 데이터 활용 — 어떤 카테고리 신고 많은지 + 어떤 매물 systemic.

import { notFound } from "next/navigation";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import FeedbackStatsClient from "./feedback-stats-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FeedbackStatsAdminPage() {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok || !isAdminUser(auth.user)) notFound();
  return (
    <main className="min-h-screen bg-[#f6f1e8] dark:bg-zinc-950">
      <section className="mx-auto max-w-6xl px-4 py-8">
        {/* Wave 188: 운영자 nav 통일 (3 페이지). */}
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <a
            href="../"
            className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-black text-amber-800 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
          >
            ⚙ 회원 목록
          </a>
          <a
            href="../loss-reports"
            className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-black text-amber-900 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
          >
            🔍 사용자 신고 검수
          </a>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-black text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
            📊 신고 통계 (현재)
          </span>
        </nav>
        <header className="mb-6 border-b border-[#e2d9cb] pb-4 dark:border-zinc-800">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-emerald-400">
            Admin · feedback_stats
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#223127] dark:text-white">
            📊 사용자 신고 통계
          </h1>
          <p className="mt-1 text-xs text-[#687366] dark:text-zinc-400">
            정보 오류 신고 (inaccurate_report) 카테고리/상태 분포 + 자주 신고 받는 매물.
            시스템 보정 우선순위 결정에 사용.
          </p>
        </header>
        <FeedbackStatsClient />
      </section>
    </main>
  );
}
