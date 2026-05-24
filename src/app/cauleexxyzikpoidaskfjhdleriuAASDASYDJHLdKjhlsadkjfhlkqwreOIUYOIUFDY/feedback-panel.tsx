"use client";

// Wave launch-103: 사용자 피드백 검토 패널 — 승인/거절 + 매물 link.
//   bloomberg 톤 (admin page 전체 톤 일치).

import { useCallback, useEffect, useState } from "react";

type FeedbackRow = {
  id: number;
  auth_user_id: string;
  user_ref: string;
  pid: number | null;
  pid_context: Record<string, unknown> | null;
  category: string;
  message: string;
  status: string;
  reward_amount: number;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  reward_granted_at: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  fake: "가품 의심",
  price_wrong: "시세 이상",
  sold_out: "거래 완료",
  category_wrong: "카테고리 오류",
  other: "기타",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-950/40 text-amber-300 border-amber-800/50",
  approved: "bg-blue-950/40 text-blue-300 border-blue-800/50",
  rejected: "bg-rose-950/40 text-rose-300 border-rose-800/50",
};

const KST_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
});
function fmt(value: string | null): string {
  if (!value) return "—";
  try { return KST_FORMATTER.format(new Date(value)); } catch { return value.slice(0, 16); }
}

export default function FeedbackPanel() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/feedback/list", { cache: "no-store" });
      if (!res.ok) { setError(`목록 조회 실패 (${res.status})`); return; }
      const data = (await res.json()) as { feedback: FeedbackRow[] };
      setRows(data.feedback ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  async function decide(id: number, decision: "approve" | "reject") {
    if (pendingIds.has(id)) return;
    if (!window.confirm(`피드백 #${id} ${decision === "approve" ? "승인 (+20 크레딧 지급)" : "거절"}?`)) return;
    setPendingIds((p) => new Set(p).add(id));
    setError(null); setNotice(null);
    try {
      const res = await fetch(`/api/admin/feedback/decide?id=${id}&decision=${decision}`, { method: "POST", cache: "no-store" });
      if (!res.ok) { setError(`${decision === "approve" ? "승인" : "거절"} 실패 (${res.status})`); return; }
      setNotice(`피드백 #${id} ${decision === "approve" ? "승인 + 보상 지급" : "거절"} 완료`);
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setPendingIds((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  }

  // Wave launch-104 (사용자 정정): brief 화 — pending count + 최근 3건 미리보기 + /loss-reports link.
  const pending = rows.filter((r) => r.status === "pending");
  const approved7d = rows.filter((r) => r.status === "approved").length;
  const rejected7d = rows.filter((r) => r.status === "rejected").length;
  const previewItems = pending.slice(0, 3);

  return (
    <section className="mt-6 font-mono">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-400">▌FEEDBACK BRIEF (7D)</h2>
        <a
          href="/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/loss-reports"
          className="rounded-sm border border-amber-700/50 bg-amber-900/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300 hover:bg-amber-900/50"
        >REVIEW ALL →</a>
      </div>

      {notice ? (
        <div className="mb-2 rounded-sm border border-blue-900/50 bg-blue-950/30 px-2.5 py-1.5 text-[10px] font-bold text-blue-300">{notice}</div>
      ) : null}
      {error ? (
        <div className="mb-2 rounded-sm border border-rose-900/50 bg-rose-950/30 px-2.5 py-1.5 text-[10px] font-bold text-rose-300">{error}</div>
      ) : null}

      {/* counts + preview rows */}
      <div className="grid gap-px overflow-hidden rounded-sm border border-zinc-800 bg-zinc-800 sm:grid-cols-3">
        <div className="bg-zinc-950 px-3 py-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">PENDING</div>
          <div className="mt-1 text-[18px] font-black tabular-nums text-amber-400">{loading ? "…" : pending.length}</div>
        </div>
        <div className="bg-zinc-950 px-3 py-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">APPROVED (7D)</div>
          <div className="mt-1 text-[18px] font-black tabular-nums text-blue-400">{approved7d}</div>
        </div>
        <div className="bg-zinc-950 px-3 py-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">REJECTED (7D)</div>
          <div className="mt-1 text-[18px] font-black tabular-nums text-rose-400">{rejected7d}</div>
        </div>
      </div>

      {previewItems.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {previewItems.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-sm border border-amber-900/40 bg-amber-950/15 px-3 py-2 text-[11px]">
              <span className="font-mono text-[10px] text-zinc-500">#{r.id}</span>
              <span className="font-bold text-amber-300">{CATEGORY_LABEL[r.category] ?? r.category}</span>
              {r.category === "sold_out" ? (
                <span className="rounded-sm border border-rose-700/60 bg-rose-900/40 px-1 py-0.5 text-[8px] font-black uppercase text-rose-300">⚠ 풀 제외</span>
              ) : null}
              <span className="min-w-0 flex-1 truncate text-zinc-300" title={r.message}>{r.message}</span>
              <span className="font-mono text-[10px] text-zinc-500">{fmt(r.created_at)}</span>
            </li>
          ))}
          {pending.length > 3 ? (
            <li className="px-3 py-1 text-[10px] uppercase tracking-wide text-zinc-500">
              +{pending.length - 3} more pending — review-all 페이지에서 처리
            </li>
          ) : null}
        </ul>
      ) : (
        <div className="mt-2 rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-3 text-center text-[10px] uppercase tracking-wide text-zinc-600">
          {loading ? "로딩 중…" : "대기 중인 신고 없음"}
        </div>
      )}
    </section>
  );
}
