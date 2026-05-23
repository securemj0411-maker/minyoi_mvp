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
  approved: "bg-emerald-950/40 text-emerald-300 border-emerald-800/50",
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

  const pending = rows.filter((r) => r.status === "pending");
  const recent = rows.filter((r) => r.status !== "pending").slice(0, 15);

  return (
    <section className="mt-6 font-mono">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-400">▌FEEDBACK QUEUE (7D)</h2>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
        >REFRESH</button>
      </div>

      {notice ? (
        <div className="mb-2 rounded-sm border border-emerald-900/50 bg-emerald-950/30 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300">{notice}</div>
      ) : null}
      {error ? (
        <div className="mb-2 rounded-sm border border-rose-900/50 bg-rose-950/30 px-2.5 py-1.5 text-[10px] font-bold text-rose-300">{error}</div>
      ) : null}

      <div className="overflow-x-auto rounded-sm border border-zinc-800 bg-zinc-950">
        <table className="w-full min-w-[900px] text-[11px]">
          <thead className="bg-zinc-900/80">
            <tr className="border-b border-zinc-800 text-left text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">CAT</th>
              <th className="px-3 py-2">PID</th>
              <th className="px-3 py-2">MESSAGE</th>
              <th className="px-3 py-2">STATUS</th>
              <th className="px-3 py-2">TIME</th>
              <th className="px-3 py-2 text-right">ACT</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-[10px] uppercase text-zinc-600">불러오는 중…</td></tr>
            ) : pending.length === 0 && recent.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-[10px] uppercase text-zinc-600">최근 7일 신고 없음</td></tr>
            ) : (
              <>
                {pending.map((r) => {
                  const busy = pendingIds.has(r.id);
                  return (
                    <tr key={r.id} className="border-b border-amber-900/40 bg-amber-950/15">
                      <td className="px-3 py-2 font-mono text-[10px]">{r.id}</td>
                      <td className="px-3 py-2 font-bold text-amber-300">{CATEGORY_LABEL[r.category] ?? r.category}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-zinc-400">{r.pid ?? "—"}</td>
                      <td className="px-3 py-2 max-w-[400px] truncate text-zinc-300" title={r.message}>{r.message}</td>
                      <td className="px-3 py-2"><span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-black uppercase ${STATUS_BADGE.pending}`}>PENDING</span></td>
                      <td className="px-3 py-2 font-mono text-[10px] text-zinc-500">{fmt(r.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => void decide(r.id, "approve")} disabled={busy}
                            className="rounded-sm border border-emerald-800 bg-emerald-900/40 px-2 py-1 text-[9px] font-black uppercase text-emerald-300 hover:bg-emerald-900/60 disabled:opacity-40">
                            {busy ? "..." : "+20"}
                          </button>
                          <button type="button" onClick={() => void decide(r.id, "reject")} disabled={busy}
                            className="rounded-sm border border-rose-800 bg-rose-900/40 px-2 py-1 text-[9px] font-black uppercase text-rose-300 hover:bg-rose-900/60 disabled:opacity-40">
                            {busy ? "..." : "REJ"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-900 opacity-70">
                    <td className="px-3 py-2 font-mono text-[10px]">{r.id}</td>
                    <td className="px-3 py-2 text-zinc-400">{CATEGORY_LABEL[r.category] ?? r.category}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-zinc-500">{r.pid ?? "—"}</td>
                    <td className="px-3 py-2 max-w-[400px] truncate text-zinc-500" title={r.message}>{r.message}</td>
                    <td className="px-3 py-2"><span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-black uppercase ${STATUS_BADGE[r.status] ?? STATUS_BADGE.pending}`}>{r.status}</span></td>
                    <td className="px-3 py-2 font-mono text-[10px] text-zinc-500">{fmt(r.decided_at ?? r.created_at)}</td>
                    <td className="px-3 py-2 text-right text-[10px] uppercase text-zinc-600">{r.decided_by ?? "—"}</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
