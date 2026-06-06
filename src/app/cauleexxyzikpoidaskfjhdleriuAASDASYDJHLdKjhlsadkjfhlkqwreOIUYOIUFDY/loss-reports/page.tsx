// Wave 182 (2026-05-17): 운영자 손해 신고 검수 페이지.
// Wave launch-104c (2026-05-24): legacy feedback_reports UI 제거 — user_feedback 으로 단일화.
// Wave launch-108 (2026-05-24): layout 으로 auth/nav 위임 + 영문화.

import FeedbackReviewFull from "./feedback-review-full";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function LossReportsAdminPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6">
      <header className="mb-4 border-b border-zinc-800 pb-3">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-400">▌FEEDBACK QUEUE</p>
        <h1 className="mt-1 text-xl font-black tracking-tight text-zinc-100">user_feedback · review &amp; reward</h1>
        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-500">
          sold_out / fake / price_wrong / category_wrong — approve grants +20 credits · 24h SLA
        </p>
      </header>

      <FeedbackReviewFull />
    </main>
  );
}
