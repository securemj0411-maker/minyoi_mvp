// Wave launch-105 (2026-05-24): 운영자 풀 검토 (AdminPoolBrowser) — cau 운영자 페이지로 이전.
//   기존엔 /me 의 사이드 nav "admin-pool" 분기에만 있었음. 사용자 요청:
//   cau 디렉토리 안에서도 동일하게 보고 싶다 → /cau../pool sub-page 신설.

import { notFound } from "next/navigation";

import AdminPoolBrowser from "@/components/admin-pool-browser";
import {
  OPS_ADMIN_BASE_PATH,
  OPS_ADMIN_DETAIL_EVENTS_PATH,
  OPS_ADMIN_FEEDBACK_STATS_PATH,
  OPS_ADMIN_LOSS_REPORTS_PATH,
} from "@/lib/admin-routes";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminPoolPage() {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok || !isAdminUser(auth.user)) notFound();

  return (
    <main className="min-h-screen bg-zinc-950 pt-12 font-mono text-zinc-200">
      <section className="mx-auto max-w-7xl px-4 py-6">
        {/* Bloomberg terminal nav */}
        <nav className="mb-4 flex flex-wrap items-center gap-1">
          <a
            href={OPS_ADMIN_BASE_PATH}
            className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
          >
            ◀ 회원 목록
          </a>
          <span className="rounded-sm border border-amber-700/60 bg-amber-900/40 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-300">
            ▌POOL
          </span>
          <a
            href={OPS_ADMIN_LOSS_REPORTS_PATH}
            className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
          >
            사용자 신고 검수
          </a>
          <a
            href={OPS_ADMIN_FEEDBACK_STATS_PATH}
            className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
          >
            신고 통계
          </a>
          <a
            href={OPS_ADMIN_DETAIL_EVENTS_PATH}
            className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
          >
            상세 행동
          </a>
        </nav>

        <header className="mb-4 border-b border-zinc-800 pb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">
            ▌ADMIN · pool_browser
          </p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-zinc-100">
            운영자 풀 검토
          </h1>
          <p className="mt-1 text-[11px] text-zinc-500">
            /me 운영자 view 와 동일. 매물 카드 클릭 → 시세 산정 근거 / 비교 매물 sample / 검증 메모.
          </p>
        </header>

        {/* AdminPoolBrowser — me-dashboard-client 와 동일 컴포넌트.
            기본 endpoint = /api/admin/pool-listings (admin auth 필요). */}
        <AdminPoolBrowser />
      </section>
    </main>
  );
}
