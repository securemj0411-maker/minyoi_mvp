"use client";

// Wave launch-104: /loss-reports 페이지의 full 검수 view — launch-103 user_feedback 승인/거절.
//   cau brief panel 과 같은 endpoint 사용. 여기는 filter + full message + bloomberg dense.

import { Fragment, useCallback, useEffect, useState } from "react";

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
  // Wave launch-104b: list endpoint join — auth.users 닉네임/이메일.
  user_email: string | null;
  user_nickname: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  fake: "가품 의심",
  price_wrong: "시세 이상",
  sold_out: "거래 완료",
  category_wrong: "카테고리 오류",
  other: "기타",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "border-amber-700/60 bg-amber-900/30 text-amber-300",
  approved: "border-blue-700/60 bg-blue-900/30 text-blue-300",
  rejected: "border-rose-700/60 bg-rose-900/30 text-rose-300",
};

const KST_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
});
function fmt(value: string | null): string {
  if (!value) return "—";
  try { return KST_FORMATTER.format(new Date(value)); } catch { return value.slice(0, 16); }
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function FeedbackReviewFull() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

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
    if (!window.confirm(`피드백 #${id} ${decision === "approve" ? "승인 및 보정 반영" : "거절"}?`)) return;
    setPendingIds((p) => new Set(p).add(id));
    setError(null); setNotice(null);
    try {
      const res = await fetch(`/api/admin/feedback/decide?id=${id}&decision=${decision}`, {
        method: "POST",
        cache: "no-store",
        headers: { "x-minyoi-admin-action": "1" },
      });
      if (!res.ok) { setError(`${decision === "approve" ? "승인" : "거절"} 실패 (${res.status})`); return; }
      setNotice(`피드백 #${id} ${decision === "approve" ? "승인 + 보상 지급" : "거절"} 완료`);
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setPendingIds((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  }

  function toggleExpand(id: number) {
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const filtered = statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);
  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  return (
    <section className="font-mono">
      {/* header */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-400">▌FEEDBACK REVIEW (7D)</h2>
        <div className="ml-auto flex gap-1">
          {(["pending", "all", "approved", "rejected"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-wide transition ${
                statusFilter === s
                  ? "border-amber-600 bg-amber-900/40 text-amber-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              {s.toUpperCase()} · {counts[s]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
          >REFRESH</button>
        </div>
      </div>

      {notice ? (
        <div className="mb-2 rounded-sm border border-blue-900/50 bg-blue-950/30 px-2.5 py-1.5 text-[10px] font-bold text-blue-300">{notice}</div>
      ) : null}
      {error ? (
        <div className="mb-2 rounded-sm border border-rose-900/50 bg-rose-950/30 px-2.5 py-1.5 text-[10px] font-bold text-rose-300">{error}</div>
      ) : null}

      {/* Wave launch-110: 모바일 카드 layout (md 미만). desktop 테이블은 md 이상. */}
      <div className="space-y-2 md:hidden">
        {loading && rows.length === 0 ? (
          <div className="rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-6 text-center text-[10px] uppercase text-zinc-600">불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-6 text-center text-[10px] uppercase text-zinc-600">결과 없음</div>
        ) : (
          filtered.map((r) => {
            const busy = pendingIds.has(r.id);
            const isPending = r.status === "pending";
            return (
              <div key={`m-${r.id}`} className={`rounded-sm border p-3 ${isPending ? "border-amber-900/40 bg-amber-950/15" : "border-zinc-900 bg-zinc-950 opacity-80"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-zinc-500">#{r.id}</span>
                    <span className="text-[12px] font-bold text-amber-300">{CATEGORY_LABEL[r.category] ?? r.category}</span>
                    {r.category === "sold_out" && isPending ? (
                      <span className="rounded-sm border border-rose-700/60 bg-rose-900/40 px-1 py-0.5 text-[8px] font-black uppercase text-rose-300">⚠ 풀 제외</span>
                    ) : null}
                  </div>
                  <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-black uppercase ${STATUS_BADGE[r.status] ?? STATUS_BADGE.pending}`}>{r.status}</span>
                </div>
                <div className="mt-1.5 text-[11px] text-zinc-300">
                  <div className="font-bold text-zinc-100">{r.user_nickname || "(닉네임 없음)"}</div>
                  <div className="font-mono text-[10px] text-zinc-500">{r.user_email ?? r.user_ref.slice(0, 24) + "…"}</div>
                </div>
                {r.pid ? (
                  <div className="mt-1 text-[10px] text-zinc-500">매물 #{r.pid}</div>
                ) : null}
                <div className="mt-2 max-h-24 overflow-y-auto rounded-sm border border-zinc-800 bg-zinc-900/40 px-2 py-1.5 text-[11px] text-zinc-200 whitespace-pre-wrap">
                  {r.message}
                </div>
                <div className="mt-1.5 font-mono text-[10px] text-zinc-500">{fmt(r.created_at)}</div>
                {isPending ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void decide(r.id, "approve")}
                      disabled={busy}
                      className="flex-1 rounded-sm border border-blue-700/60 bg-blue-900/40 py-2 text-[12px] font-black text-blue-300 hover:bg-blue-900/60 disabled:opacity-40"
                    >{busy ? "..." : "✓ APPROVE +20"}</button>
                    <button
                      type="button"
                      onClick={() => void decide(r.id, "reject")}
                      disabled={busy}
                      className="flex-1 rounded-sm border border-rose-700/60 bg-rose-900/40 py-2 text-[12px] font-black text-rose-300 hover:bg-rose-900/60 disabled:opacity-40"
                    >{busy ? "..." : "✕ REJECT"}</button>
                  </div>
                ) : (
                  <div className="mt-1 text-[10px] uppercase text-zinc-600">처리됨 · {r.decided_by ?? "—"}{r.reward_granted_at ? ` · +${r.reward_amount} @ ${fmt(r.reward_granted_at)}` : ""}</div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-sm border border-zinc-800 bg-zinc-950 md:block">
        <table className="w-full min-w-[1100px] text-[11px]">
          <thead className="bg-zinc-900/80">
            <tr className="border-b border-zinc-800 text-left text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
              <th className="w-12 px-3 py-2">ID</th>
              <th className="px-3 py-2">USER (NICK · EMAIL)</th>
              <th className="px-3 py-2">PID</th>
              <th className="px-3 py-2">CATEGORY</th>
              <th className="px-3 py-2">MESSAGE</th>
              <th className="px-3 py-2">STATUS</th>
              <th className="px-3 py-2">TIME</th>
              <th className="px-3 py-2 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-[10px] uppercase text-zinc-600">불러오는 중…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-[10px] uppercase text-zinc-600">결과 없음</td></tr>
            ) : (
              filtered.map((r) => {
                const busy = pendingIds.has(r.id);
                const isExpanded = expanded.has(r.id);
                const isPending = r.status === "pending";
                const ctx = r.pid_context ?? {};
                const itemName = typeof ctx.name === "string" ? ctx.name : null;
                const itemPrice = typeof ctx.price === "number" ? ctx.price : null;
                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => toggleExpand(r.id)}
                      className={`cursor-pointer border-b border-zinc-900 transition hover:bg-zinc-900/40 ${
                        isPending ? "bg-amber-950/15" : "opacity-75"
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-[10px]">{r.id}</td>
                      <td className="px-3 py-2 text-[10px]">
                        <div className="font-bold text-zinc-200">{r.user_nickname || "(닉네임 없음)"}</div>
                        <div className="font-mono text-[9px] text-zinc-500">{r.user_email ?? r.user_ref.slice(0, 18) + "…"}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-zinc-400">{r.pid ?? "—"}</td>
                      <td className="px-3 py-2 font-bold text-amber-300">
                        {CATEGORY_LABEL[r.category] ?? r.category}
                        {r.category === "sold_out" && isPending ? (
                          <span className="ml-1.5 rounded-sm border border-rose-700/60 bg-rose-900/40 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-rose-300">
                            ⚠ 풀 제외 중
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 max-w-[350px] truncate text-zinc-300" title={r.message}>{r.message}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-black uppercase ${STATUS_BADGE[r.status] ?? STATUS_BADGE.pending}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-zinc-500">{fmt(r.created_at)}</td>
                      <td className="px-3 py-2">
                        {isPending ? (
                          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => void decide(r.id, "approve")}
                              disabled={busy}
                              className="rounded-sm border border-blue-800 bg-blue-900/40 px-2 py-1 text-[9px] font-black uppercase text-blue-300 hover:bg-blue-900/60 disabled:opacity-40"
                            >{busy ? "..." : "APPROVE +20"}</button>
                            <button
                              type="button"
                              onClick={() => void decide(r.id, "reject")}
                              disabled={busy}
                              className="rounded-sm border border-rose-800 bg-rose-900/40 px-2 py-1 text-[9px] font-black uppercase text-rose-300 hover:bg-rose-900/60 disabled:opacity-40"
                            >{busy ? "..." : "REJECT"}</button>
                          </div>
                        ) : (
                          <span className="text-[10px] uppercase text-zinc-600">{r.decided_by ?? "—"}</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-b border-zinc-900 bg-zinc-950/60">
                        <td colSpan={8} className="px-4 py-3">
                          <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-y-1.5 text-[11px]">
                            <dt className="font-bold uppercase tracking-wide text-zinc-500">NICKNAME</dt>
                            <dd className="font-bold text-zinc-100">{r.user_nickname || "(없음)"}</dd>
                            <dt className="font-bold uppercase tracking-wide text-zinc-500">EMAIL</dt>
                            <dd className="font-mono text-[11px] text-zinc-300">{r.user_email ?? "(없음)"}</dd>
                            <dt className="font-bold uppercase tracking-wide text-zinc-500">USER REF</dt>
                            <dd className="break-all font-mono text-[10px] text-zinc-400">{r.user_ref}</dd>
                            <dt className="font-bold uppercase tracking-wide text-zinc-500">AUTH ID</dt>
                            <dd className="break-all font-mono text-[10px] text-zinc-500">{r.auth_user_id}</dd>
                            {itemName ? (<>
                              <dt className="font-bold uppercase tracking-wide text-zinc-500">ITEM</dt>
                              <dd className="text-zinc-300">{itemName}</dd>
                            </>) : null}
                            {itemPrice ? (<>
                              <dt className="font-bold uppercase tracking-wide text-zinc-500">PRICE</dt>
                              <dd className="font-mono tabular-nums text-amber-400">₩{itemPrice.toLocaleString("ko-KR")}</dd>
                            </>) : null}
                            <dt className="font-bold uppercase tracking-wide text-zinc-500">MESSAGE</dt>
                            <dd className="whitespace-pre-wrap text-zinc-200">{r.message}</dd>
                            {r.decided_at ? (<>
                              <dt className="font-bold uppercase tracking-wide text-zinc-500">DECIDED</dt>
                              <dd className="font-mono text-[10px] text-zinc-400">{fmt(r.decided_at)} · by {r.decided_by ?? "—"}</dd>
                            </>) : null}
                            {r.reward_granted_at ? (<>
                              <dt className="font-bold uppercase tracking-wide text-zinc-500">REWARD</dt>
                              <dd className="font-mono text-[10px] text-blue-400">+{r.reward_amount} @ {fmt(r.reward_granted_at)}</dd>
                            </>) : null}
                          </dl>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
