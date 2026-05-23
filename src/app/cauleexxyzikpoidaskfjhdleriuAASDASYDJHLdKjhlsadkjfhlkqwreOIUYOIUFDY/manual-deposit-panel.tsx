"use client";

// Wave launch-97: cau admin page 의 충전 신청 panel.
//   pending list + 승인/거절 buttons. 텔레그램 link 외에 운영자가 직접 이 페이지에서도 처리 가능.
//   5초마다 polling — 새 신청 + 다른 운영자 (또는 텔레그램) 변경 반영.

import { useCallback, useEffect, useState } from "react";

type DepositRequest = {
  id: number;
  user_ref: string;
  auth_user_id: string;
  plan_key: string;
  amount: number;
  price_krw: number;
  depositor_name: string;
  status: string;
  scheduled_auto_approve_at: string;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
};

const KST_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
function fmt(value: string | null): string {
  if (!value) return "—";
  try {
    return KST_FORMATTER.format(new Date(value));
  } catch {
    return value.slice(0, 16);
  }
}

function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}
function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "대기 중", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "운영자 승인", cls: "bg-emerald-100 text-emerald-700" },
  auto_approved: { label: "자동 지급", cls: "bg-sky-100 text-sky-700" },
  rejected: { label: "거절", cls: "bg-rose-100 text-rose-700" },
};

export default function ManualDepositPanel() {
  const [rows, setRows] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [tick, setTick] = useState(0); // countdown re-render
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/manual-deposit/list", { cache: "no-store" });
      if (!res.ok) {
        setError(`목록 조회 실패 (${res.status})`);
        return;
      }
      const data = (await res.json()) as { requests: DepositRequest[] };
      setRows(data.requests ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(refresh, 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  // 카운트다운 재렌더 1초마다.
  useEffect(() => {
    const interval = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);
  void tick;

  async function decide(id: number, decision: "approve" | "reject") {
    if (pendingIds.has(id)) return;
    const action = decision === "approve" ? "승인" : "거절";
    const ok = window.confirm(`신청 #${id} ${action}할까요?`);
    if (!ok) return;
    setPendingIds((prev) => new Set(prev).add(id));
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/manual-deposit/decide?id=${id}&decision=${decision}`, {
        method: "POST",
        cache: "no-store",
      });
      // decide endpoint 는 HTML 응답. status 만 확인.
      if (!res.ok) {
        setError(`${action} 실패 (${res.status})`);
        return;
      }
      setNotice(`신청 #${id} ${action} 완료`);
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const pending = rows.filter((r) => r.status === "pending");
  const recent = rows.filter((r) => r.status !== "pending").slice(0, 10);

  // Wave launch-101: bloomberg 터미널 톤.
  return (
    <section className="mt-6 font-mono">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-400">▌DEPOSIT QUEUE (24H)</h2>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
        >
          REFRESH
        </button>
      </div>

      {notice ? (
        <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-sm border border-zinc-800 bg-zinc-950">
        <table className="w-full min-w-[900px] text-[11px]">
          <thead className="bg-zinc-900/80">
            <tr className="border-b border-zinc-800 text-left text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">입금자명</th>
              <th className="px-3 py-2">패키지</th>
              <th className="px-3 py-2">금액</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">남은 시간</th>
              <th className="px-3 py-2">신청 시각</th>
              <th className="px-3 py-2 text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-500">불러오는 중…</td></tr>
            ) : pending.length === 0 && recent.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-500">최근 24시간 신청 없음</td></tr>
            ) : (
              <>
                {pending.map((r) => {
                  const remaining = secondsUntil(r.scheduled_auto_approve_at);
                  const inProgress = pendingIds.has(r.id);
                  const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
                  return (
                    <tr key={r.id} className="border-b border-amber-900/40 bg-amber-950/15">
                      <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                      <td className="px-3 py-2 font-semibold">{r.depositor_name}</td>
                      <td className="px-3 py-2 text-xs">{r.amount.toLocaleString("ko-KR")} 크레딧</td>
                      <td className="px-3 py-2 font-mono text-xs">₩{r.price_krw.toLocaleString("ko-KR")}</td>
                      <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span></td>
                      <td className="px-3 py-2 font-mono text-xs font-bold text-amber-700 dark:text-amber-300">{formatCountdown(remaining)}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-gray-500">{fmt(r.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => void decide(r.id, "approve")}
                            disabled={inProgress}
                            className="inline-flex h-7 items-center rounded-md bg-emerald-600 px-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {inProgress ? "..." : "✓ 승인"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void decide(r.id, "reject")}
                            disabled={inProgress}
                            className="inline-flex h-7 items-center rounded-md bg-rose-600 px-2.5 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                          >
                            {inProgress ? "..." : "✕ 거절"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {recent.map((r) => {
                  const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
                  return (
                    <tr key={r.id} className="border-b border-zinc-900">
                      <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                      <td className="px-3 py-2 font-semibold text-gray-600 dark:text-gray-400">{r.depositor_name}</td>
                      <td className="px-3 py-2 text-xs">{r.amount.toLocaleString("ko-KR")} 크레딧</td>
                      <td className="px-3 py-2 font-mono text-xs">₩{r.price_krw.toLocaleString("ko-KR")}</td>
                      <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span></td>
                      <td className="px-3 py-2 text-[10px] text-gray-400">—</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-gray-500">{fmt(r.decided_at ?? r.created_at)}</td>
                      <td className="px-3 py-2 text-right text-[10px] text-gray-400">처리됨</td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
