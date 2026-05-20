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

type PlanFilter = "all" | "free" | "starter" | "plus" | "pro";
type BetaFilter = "all" | "beta" | "non-beta";

export default function MembersTable({ initialRows }: { initialRows: MemberRow[] }) {
  const [rows, setRows] = useState<MemberRow[]>(initialRows);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [creditPendingIds, setCreditPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [betaFilter, setBetaFilter] = useState<BetaFilter>("all");
  const [creditDrafts, setCreditDrafts] = useState<Record<string, string>>({});

  const filteredRows = rows.filter((row) => {
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      const haystack = `${row.email ?? ""} ${row.nickname}`.toLowerCase();
      if (!haystack.includes(s)) return false;
    }
    if (planFilter !== "all" && row.planKey !== planFilter) return false;
    if (betaFilter === "beta" && !row.isBetaTester) return false;
    if (betaFilter === "non-beta" && row.isBetaTester) return false;
    return true;
  });

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

  async function grantCredits(row: MemberRow) {
    const rawAmount = creditDrafts[row.authUserId] ?? "";
    const amount = Math.round(Number(rawAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("지급할 크레딧 개수를 1 이상으로 입력해주세요.");
      setNotice(null);
      return;
    }
    const target = row.nickname || row.email || row.authUserId;
    const ok = window.confirm(`${target} 회원에게 크레딧 ${amount.toLocaleString("ko-KR")}개를 지급할까요?`);
    if (!ok) return;

    setError(null);
    setNotice(null);
    setCreditPendingIds((prev) => new Set(prev).add(row.authUserId));
    try {
      const res = await fetch("/api/admin/credits/grant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          authUserId: row.authUserId,
          amount,
          note: "operator members table",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; amount?: number; balance?: number; error?: string; maxAmount?: number };
      if (!res.ok || !data.ok) {
        const maxHint = data.maxAmount ? ` (최대 ${data.maxAmount.toLocaleString("ko-KR")}개)` : "";
        setError(`${data.error ?? "credit_grant_failed"}${maxHint}`);
        return;
      }
      setRows((prev) => prev.map((r) =>
        r.authUserId === row.authUserId
          ? { ...r, balance: Number(data.balance ?? r.balance ?? 0), creditRowExists: true }
          : r,
      ));
      setCreditDrafts((prev) => ({ ...prev, [row.authUserId]: "" }));
      setNotice(`${target} 회원에게 크레딧 ${Number(data.amount ?? amount).toLocaleString("ko-KR")}개 지급 완료`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
    } finally {
      setCreditPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.authUserId);
        return next;
      });
    }
  }

  return (
    <>
      {notice ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이메일 / 닉네임 검색..."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-gray-500 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5 text-xs">
          {(["all", "free", "starter", "plus", "pro"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setPlanFilter(v)}
              className={`rounded-md px-2 py-1 font-bold transition ${
                planFilter === v
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                  : "border border-gray-300 bg-white text-gray-600 hover:border-gray-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-400"
              }`}
            >
              {v === "all" ? "플랜 전체" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
          <span className="mx-1 inline-block w-px self-stretch bg-gray-200 dark:bg-zinc-700" />
          {(["all", "beta", "non-beta"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setBetaFilter(v)}
              className={`rounded-md px-2 py-1 font-bold transition ${
                betaFilter === v
                  ? "bg-purple-600 text-white"
                  : "border border-gray-300 bg-white text-gray-600 hover:border-purple-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-400"
              }`}
            >
              {v === "all" ? "베타 전체" : v === "beta" ? "베타 ✓" : "베타 ✗"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {filteredRows.length}건 표시 (전체 {rows.length})
      </div>

      <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
        <table className="w-full min-w-[1500px] text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-900">
            <tr className="border-b border-gray-200 text-left text-xs font-bold text-gray-600 dark:border-zinc-800 dark:text-gray-400">
              <th className="px-3 py-2">닉네임</th>
              <th className="px-3 py-2">이메일</th>
              <th className="px-3 py-2">플랜</th>
              <th className="px-3 py-2">플랜 만료</th>
              <th className="px-3 py-2 text-right">일일 사용</th>
              <th className="px-3 py-2">최근 결제</th>
              <th className="px-3 py-2">가입일</th>
              <th className="px-3 py-2">마지막 로그인</th>
              <th className="px-3 py-2">크레딧</th>
              <th className="px-3 py-2">베타 체험단</th>
              <th className="px-3 py-2">provider</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const planActive = row.planStatus === "active";
              const badge = PLAN_BADGE[row.planKey] ?? PLAN_BADGE.free;
              const pending = pendingIds.has(row.authUserId);
              const creditPending = creditPendingIds.has(row.authUserId);
              return (
                <tr key={row.authUserId} className="border-b border-gray-100 hover:bg-amber-50/40 dark:border-zinc-900 dark:hover:bg-amber-950/20">
                  <td className="px-3 py-2 font-semibold">{row.nickname || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex h-5 items-center rounded px-1.5 text-[11px] font-bold ${badge.cls}`}>
                      {badge.label}
                    </span>
                    {row.planStatus && row.planStatus !== "active" ? (
                      <span className="ml-1 text-[10px] text-gray-500">{row.planStatus}</span>
                    ) : null}
                    {row.planCancelAtEnd ? (
                      <div className="mt-0.5 text-[10px] text-orange-600 dark:text-orange-400">해지 예약</div>
                    ) : null}
                  </td>
                  <td className={`px-3 py-2 font-mono text-xs ${planActive ? "text-gray-700 dark:text-gray-300" : "text-gray-400"}`}>
                    {fmt(row.planEndAt)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{row.dailyUsedCount ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                    {row.lastPaymentAt ? (
                      <div>
                        <div>{fmt(row.lastPaymentAt)}</div>
                        {row.lastPaymentAmount ? (
                          <div className="text-[10px] text-gray-500">₩{row.lastPaymentAmount.toLocaleString("ko-KR")}</div>
                        ) : null}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{fmt(row.createdAt)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{fmt(row.lastSignInAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <span className="min-w-12 text-right font-mono">{row.balance ?? "—"}</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={creditDrafts[row.authUserId] ?? ""}
                        onChange={(e) => setCreditDrafts((prev) => ({ ...prev, [row.authUserId]: e.target.value }))}
                        placeholder="개수"
                        className="h-7 w-20 rounded-md border border-gray-300 bg-white px-2 text-right font-mono text-xs outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-emerald-950"
                      />
                      <button
                        type="button"
                        onClick={() => void grantCredits(row)}
                        disabled={creditPending}
                        className="inline-flex h-7 items-center rounded-md bg-emerald-600 px-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        title="운영자 수동 크레딧 지급"
                      >
                        {creditPending ? "..." : "지급"}
                      </button>
                    </div>
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
