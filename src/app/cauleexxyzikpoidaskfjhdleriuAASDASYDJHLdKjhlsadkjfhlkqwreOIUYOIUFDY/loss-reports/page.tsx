// Wave 182 (2026-05-17): 운영자 손해 신고 검수 페이지.
// Wave launch-104 (2026-05-23): Bloomberg 톤 + user_feedback 검수 panel mount.
// Wave launch-104c (2026-05-24): legacy feedback_reports UI 제거 — user_feedback 으로 단일화.
//   URL obfuscation + admin auth 이중 보호 (같은 디렉토리 패턴 — members-table 옆).

import { notFound } from "next/navigation";
import { OPS_ADMIN_BASE_PATH, OPS_ADMIN_DETAIL_EVENTS_PATH, OPS_ADMIN_FEEDBACK_STATS_PATH } from "@/lib/admin-routes";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import FeedbackReviewFull from "./feedback-review-full";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LossReportsAdminPage() {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok || !isAdminUser(auth.user)) notFound();
  return (
    <main className="min-h-screen bg-zinc-950 pt-12 font-mono text-zinc-200">
      <section className="mx-auto max-w-6xl px-4 py-6">
        {/* Bloomberg terminal nav (admin 페이지간 이동) */}
        <nav className="mb-4 flex flex-wrap items-center gap-1">
          <a
            href={OPS_ADMIN_BASE_PATH}
            className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
          >
            ◀ 회원 목록
          </a>
          <span className="rounded-sm border border-amber-700/60 bg-amber-900/40 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-300">
            ▌사용자 신고 검수
          </span>
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

        <header className="mb-5 border-b border-zinc-800 pb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">
            ▌ADMIN · feedback_reports
          </p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-zinc-100">
            사용자 신고 검수
          </h1>
          <p className="mt-1 text-[11px] text-zinc-500">
            🚨 매물 정보 신고 (가품·시세·거래완료·카테고리 오류). 승인 시 +20 크레딧 지급. 24h 내 처리 권장.
          </p>
        </header>

        {/* Wave launch-104: user_feedback 풀 리뷰 — 카테고리/필터/확장. */}
        <FeedbackReviewFull />
      </section>
    </main>
  );
}
