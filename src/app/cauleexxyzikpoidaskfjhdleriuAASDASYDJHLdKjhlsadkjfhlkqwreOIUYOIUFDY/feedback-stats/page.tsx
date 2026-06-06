// Wave 188 (2026-05-17): 운영자 신고 카테고리 dashboard.
// Wave launch-108 (2026-05-24): layout 위임 + Bloomberg 톤 + 영문화.

import FeedbackStatsClient from "./feedback-stats-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function FeedbackStatsAdminPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6">
      <header className="mb-4 border-b border-zinc-800 pb-3">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-400">▌FEEDBACK STATS</p>
        <h1 className="mt-1 text-xl font-black tracking-tight text-zinc-100">category · trend · systemic offender</h1>
        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500">
          which category dominates · which listings repeatedly flagged
        </p>
      </header>

      <FeedbackStatsClient />
    </main>
  );
}
