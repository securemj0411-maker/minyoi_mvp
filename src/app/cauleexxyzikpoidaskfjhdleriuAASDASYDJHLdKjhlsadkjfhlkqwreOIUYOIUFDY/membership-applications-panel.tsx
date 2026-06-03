"use client";

import { useState } from "react";
import { getMembershipPlan } from "@/lib/membership-plans";

export type MembershipApplicationRow = {
  id: number;
  userRef: string;
  authUserId: string;
  email: string | null;
  displayName: string | null;
  productKey: string;
  priceKrw: number;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  decidedAt: string | null;
  createdAt: string;
};

const KST_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function fmt(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value.slice(0, 16).replace("T", " ");
  const parts = KST_FORMATTER.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function krw(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function statusLabel(row: MembershipApplicationRow): string {
  if (row.status === "rejected" && row.adminNote?.includes("user_cancelled_reservation")) {
    return "cancelled";
  }
  return row.status;
}

export default function MembershipApplicationsPanel({ initialRows }: { initialRows: MembershipApplicationRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(row: MembershipApplicationRow, decision: "approve" | "reject") {
    const target = row.displayName || row.email || row.authUserId;
    const plan = getMembershipPlan(row.productKey);
    const verb = decision === "approve" ? `입금 확인 후 ${plan.label} 멤버십 부여` : "거절";
    const adminNote = window.prompt(`${target} 신청을 ${verb}할까요? 메모(선택):`, "");
    if (adminNote === null) return;
    setPendingId(row.id);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/membership-applications/decide", {
        method: "POST",
        headers: { "content-type": "application/json", "x-minyoi-admin-action": "1" },
        body: JSON.stringify({ id: row.id, decision, adminNote }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: "approved" | "rejected";
        planEndAt?: string | null;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.status) {
        setError(data.error ?? `decision_failed_${res.status}`);
        return;
      }
      setRows((prev) => prev.map((item) => item.id === row.id
        ? { ...item, status: data.status!, adminNote: adminNote || null, decidedAt: new Date().toISOString() }
        : item));
      setNotice(decision === "approve"
        ? `${target} 승인 완료 · 만료 ${fmt(data.planEndAt)}`
        : `${target} 거절 완료`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
    } finally {
      setPendingId(null);
    }
  }

  const pendingRows = rows.filter((row) => row.status === "pending");
  const recentRows = rows.filter((row) => row.status !== "pending").slice(0, 10);

  return (
    <section className="mb-4 rounded-sm border border-amber-800 bg-amber-950/20 p-3 font-mono">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">▌MEMBERSHIP APPLICATIONS</div>
          <p className="mt-1 text-[11px] font-bold text-zinc-400">입금 확인 후 승인하면 선택한 기간만큼 pro 멤버십이 열립니다. 크레딧 지급은 하지 않습니다.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tabular-nums text-amber-200">{pendingRows.length}</div>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">payment pending</div>
        </div>
      </div>

      {notice ? <div className="mb-2 rounded-sm border border-blue-900/50 bg-blue-950/30 px-2.5 py-1.5 text-[10px] font-bold text-blue-300">{notice}</div> : null}
      {error ? <div className="mb-2 rounded-sm border border-rose-900/50 bg-rose-950/30 px-2.5 py-1.5 text-[10px] font-bold text-rose-300">{error}</div> : null}

      <div className="overflow-x-auto rounded-sm border border-zinc-800 bg-zinc-950">
        <table className="w-full text-[11px]">
          <thead className="bg-zinc-900/80">
            <tr className="border-b border-zinc-800 text-left text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
              <th className="px-3 py-2">신청</th>
              <th className="px-3 py-2">신청자</th>
              <th className="px-3 py-2">상품</th>
              <th className="px-3 py-2 text-right">처리</th>
            </tr>
          </thead>
          <tbody>
            {pendingRows.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-[10px] uppercase tracking-wide text-zinc-600">no pending applications</td></tr>
            ) : pendingRows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-900">
                <td className="px-3 py-2">
                  <div className="font-black tabular-nums text-zinc-100">#{row.id}</div>
                  <div className="mt-0.5 text-[10px] text-zinc-600">{fmt(row.createdAt)}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="font-bold text-zinc-200">{row.displayName || "-"}</div>
                  <div className="mt-0.5 text-zinc-500">{row.email || "-"}</div>
                  <div className="mt-0.5 max-w-[300px] truncate text-[9px] text-zinc-700">{row.authUserId}</div>
                </td>
                <td className="px-3 py-2">
                  {(() => {
                    const plan = getMembershipPlan(row.productKey);
                    return (
                      <>
                        <div className="font-bold text-amber-200">{plan.label} · {krw(row.priceKrw)}</div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">{plan.monthlyLabel}</div>
                        <div className="mt-0.5 text-[9px] uppercase text-zinc-700">{row.productKey}</div>
                      </>
                    );
                  })()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      disabled={pendingId === row.id}
                      onClick={() => void decide(row, "approve")}
                      className="rounded-sm border border-emerald-700 bg-emerald-950/50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-300 hover:border-emerald-500 disabled:opacity-40"
                    >
                      APPROVE
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === row.id}
                      onClick={() => void decide(row, "reject")}
                      className="rounded-sm border border-rose-800 bg-rose-950/40 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-rose-300 hover:border-rose-600 disabled:opacity-40"
                    >
                      REJECT
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {recentRows.length > 0 ? (
        <div className="mt-3 text-[10px] text-zinc-500">
          최근 처리: {recentRows.map((row) => `#${row.id} ${statusLabel(row)}`).join(" · ")}
        </div>
      ) : null}
    </section>
  );
}
