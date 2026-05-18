// Wave 182 (2026-05-17): 운영자 손해 신고 검수 페이지.
// URL obfuscation + admin auth 이중 보호 (같은 디렉토리 패턴 — members-table 옆).

import { notFound } from "next/navigation";
import { OPS_ADMIN_BASE_PATH, OPS_ADMIN_FEEDBACK_STATS_PATH } from "@/lib/admin-routes";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import LossReportsClient from "./loss-reports-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LossReportsAdminPage() {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok || !isAdminUser(auth.user)) notFound();
  return (
    <main className="min-h-screen bg-[#f6f1e8] dark:bg-zinc-950">
      <section className="mx-auto max-w-6xl px-4 py-8">
        {/* Wave 188: 운영자 nav 통일 (3 페이지). */}
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <a
            href={OPS_ADMIN_BASE_PATH}
            className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-black text-amber-800 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
          >
            ⚙ 회원 목록
          </a>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-black text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            🔍 사용자 신고 검수 (현재)
          </span>
          <a
            href={OPS_ADMIN_FEEDBACK_STATS_PATH}
            className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-black text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
          >
            📊 신고 통계
          </a>
        </nav>
        <header className="mb-6 border-b border-[#e2d9cb] pb-4 dark:border-zinc-800">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5d735f] dark:text-emerald-400">
            Admin · feedback_reports
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#223127] dark:text-white">
            🔍 사용자 신고 검수
          </h1>
          <p className="mt-1 text-xs text-[#687366] dark:text-zinc-400">
            🔍 정보 오류 (시세/매물 정보/판매됨/가짜 가격) + 🚨 손해 신고 (보류) 통합 검수.
            승인하면 토큰 +3 지급 — 24시간 안에 검토 + 응답 권장.
          </p>
        </header>
        <LossReportsClient />
      </section>
    </main>
  );
}
