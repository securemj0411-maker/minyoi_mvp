"use client";

import { useState } from "react";

export type MemberRow = {
  authUserId: string;
  email: string | null;
  nickname: string;
  createdAt: string;
  lastSignInAt: string | null;
  provider: string | null;
  balance: number | null;
  freeGrantTokens: number | null;
  proUntil: string | null;
  isBetaTester: boolean;
  betaGrantedAt: string | null;
  creditRowExists: boolean;
  planKey: string;
  planStatus: string | null;
  planEndAt: string | null;
  planCancelAtEnd: boolean;
  dailyUsedCount: number | null;
  lastPaymentAt: string | null;
  lastPaymentAmount: number | null;
};

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  free: { label: "Free", cls: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400" },
  starter: { label: "Starter", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
  plus: { label: "Plus", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  pro: { label: "Pro", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
};

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 16).replace("T", " ");
}

export default function MembersTable({ initialRows }: { initialRows: MemberRow[] }) {
  const [rows, setRows] = useState<MemberRow[]>(initialRows);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function toggleBeta(row: MemberRow) {
    if (!row.creditRowExists) {
      setError(`${row.email ?? row.authUserId} — 크레딧 row 없음 (회원이 추천/팩 1회 이상 사용해야 row 생성됨)`);
      return;
    }
    setError(null);
    const next = !row.isBetaTester;
    if (next) {
      const ok = window.confirm(`${row.nickname || row.email} 베타 체험단으로 승격할까요?`);
      if (!ok) return;
    } else {
      const ok = window.confirm(`${row.nickname || row.email} 베타 체험단 해제할까요?`);
      if (!ok) return;
    }
    setPendingIds((prev) => new Set(prev).add(row.authUserId));
    try {
      const res = await fetch("/api/admin/beta-tester", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authUserId: row.authUserId, isBetaTester: next }),
      });
      const data = (await res.json()) as { ok?: boolean; isBetaTester?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "update_failed");
        return;
      }
      setRows((prev) => prev.map((r) =>
        r.authUserId === row.authUserId
          ? { ...r, isBetaTester: Boolean(data.isBetaTester), betaGrantedAt: data.isBetaTester ? new Date().toISOString() : null }
          : r,
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.authUserId);
        return next;
      });
    }
  }

  return (
    <>
      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-900">
            <tr className="border-b border-gray-200 text-left text-xs font-bold text-gray-600 dark:border-zinc-800 dark:text-gray-400">
              <th className="px-3 py-2">닉네임</th>
              <th className="px-3 py-2">이메일</th>
              <th className="px-3 py-2">가입일</th>
              <th className="px-3 py-2">마지막 로그인</th>
              <th className="px-3 py-2 text-right">크레딧</th>
              <th className="px-3 py-2 text-right">무료 토큰</th>
              <th className="px-3 py-2">Pro 만료</th>
              <th className="px-3 py-2">베타 체험단</th>
              <th className="px-3 py-2">provider</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const proActive = row.proUntil && new Date(row.proUntil) > new Date();
              const pending = pendingIds.has(row.authUserId);
              return (
                <tr key={row.authUserId} className="border-b border-gray-100 hover:bg-amber-50/40 dark:border-zinc-900 dark:hover:bg-amber-950/20">
                  <td className="px-3 py-2 font-semibold">{row.nickname || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.email ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{fmt(row.createdAt)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{fmt(row.lastSignInAt)}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.balance ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{row.freeGrantTokens ?? "—"}</td>
                  <td className={`px-3 py-2 font-mono text-xs ${proActive ? "font-bold text-amber-700 dark:text-amber-400" : "text-gray-400"}`}>
                    {fmt(row.proUntil)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleBeta(row)}
                      disabled={pending}
                      className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs font-bold transition disabled:opacity-50 ${
                        row.isBetaTester
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "border border-gray-300 bg-white text-gray-700 hover:border-purple-400 hover:bg-purple-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-300"
                      }`}
                      title={row.creditRowExists ? "" : "크레딧 row 없음 — 회원이 1회 이상 추천/팩 사용해야 row 생성"}
                    >
                      {pending ? "..." : row.isBetaTester ? "✓ 베타" : "승격"}
                    </button>
                    {row.isBetaTester && row.betaGrantedAt ? (
                      <div className="mt-0.5 font-mono text-[10px] text-purple-600 dark:text-purple-400">{fmt(row.betaGrantedAt)}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{row.provider ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
