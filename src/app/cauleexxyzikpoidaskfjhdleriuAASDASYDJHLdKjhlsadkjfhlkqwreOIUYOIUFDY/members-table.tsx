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
  blockedAt: string | null;
  blockedReason: string | null;
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

// Wave launch-28 (사용자 짚음): 가입일 / 마지막 로그인 = UTC 그대로 표시되던 거. KST 변환.
// 이전 `value.slice(0,16).replace("T"," ")` = ISO UTC 문자열 그냥 자름 → KST 사용자 -9시간 보임.
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
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value.slice(0, 16).replace("T", " ");
  // ko-KR + Asia/Seoul → "2026. 05. 22. 17:08" 식. "." 를 "-" 로 변환 후 공백 정리.
  const parts = KST_FORMATTER.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
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
  // Wave launch-95: 회수 input + 차단/해제 toggle.
  const [revokeDrafts, setRevokeDrafts] = useState<Record<string, string>>({});
  const [revokePendingIds, setRevokePendingIds] = useState<Set<string>>(new Set());
  const [blockPendingIds, setBlockPendingIds] = useState<Set<string>>(new Set());
  // Wave launch-100: 회원 일괄 삭제용 체크박스 + 진행 상태.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteInProgress, setDeleteInProgress] = useState(false);

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

  // Wave launch-95: 크레딧 회수. 양심 신뢰 충전 후 입금 안 한 사용자 처리.
  async function revokeCredits(row: MemberRow) {
    const rawAmount = revokeDrafts[row.authUserId] ?? "";
    const amount = Math.round(Number(rawAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("회수할 크레딧 개수를 1 이상으로 입력해주세요.");
      setNotice(null);
      return;
    }
    const target = row.nickname || row.email || row.authUserId;
    const ok = window.confirm(`${target} 회원의 크레딧 ${amount.toLocaleString("ko-KR")}개를 회수할까요?\n(입금 안 했거나 의심스러운 경우)`);
    if (!ok) return;

    setError(null);
    setNotice(null);
    setRevokePendingIds((prev) => new Set(prev).add(row.authUserId));
    try {
      const res = await fetch("/api/admin/credits/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authUserId: row.authUserId, amount, note: "operator manual deposit revoke" }),
      });
      const data = (await res.json()) as { ok?: boolean; balance?: number; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "credit_revoke_failed");
        return;
      }
      setRows((prev) => prev.map((r) =>
        r.authUserId === row.authUserId
          ? { ...r, balance: Number(data.balance ?? r.balance ?? 0) }
          : r,
      ));
      setRevokeDrafts((prev) => ({ ...prev, [row.authUserId]: "" }));
      setNotice(`${target} 회원의 크레딧 ${amount.toLocaleString("ko-KR")}개 회수 완료`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
    } finally {
      setRevokePendingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.authUserId);
        return next;
      });
    }
  }

  // Wave launch-95: 계정 차단/해제 toggle.
  async function toggleBlock(row: MemberRow) {
    const blocking = !row.blockedAt;
    const target = row.nickname || row.email || row.authUserId;
    let reason: string | null = null;
    if (blocking) {
      const input = window.prompt(`${target} 회원 차단 사유 (선택):`, "manual deposit fraud");
      if (input === null) return;
      reason = input.trim() || "blocked by operator";
    } else {
      const ok = window.confirm(`${target} 회원 차단을 해제할까요?`);
      if (!ok) return;
    }

    setError(null);
    setNotice(null);
    setBlockPendingIds((prev) => new Set(prev).add(row.authUserId));
    try {
      const res = await fetch("/api/admin/user/block", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authUserId: row.authUserId, blocked: blocking, reason }),
      });
      const data = (await res.json()) as { ok?: boolean; blockedAt?: string | null; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "block_toggle_failed");
        return;
      }
      setRows((prev) => prev.map((r) =>
        r.authUserId === row.authUserId
          ? { ...r, blockedAt: data.blockedAt ?? null, blockedReason: blocking ? reason : null }
          : r,
      ));
      setNotice(blocking ? `${target} 회원 차단됨` : `${target} 회원 차단 해제됨`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
    } finally {
      setBlockPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.authUserId);
        return next;
      });
    }
  }

  // Wave launch-100: 체크박스 toggle + 일괄 삭제.
  function toggleSelect(authUserId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(authUserId)) next.delete(authUserId);
      else next.add(authUserId);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selectedIds.size === filteredRows.length && filteredRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.authUserId)));
    }
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const summary = ids.length === 1
      ? `${rows.find((r) => r.authUserId === ids[0])?.email ?? ids[0]} 계정`
      : `${ids.length}명 계정`;
    const confirm1 = window.confirm(`${summary}을 영구 삭제할까요?\n\n삭제 시 auth.users + 크레딧 + 결제 이력 등 모든 데이터가 사라져요.`);
    if (!confirm1) return;
    const phrase = window.prompt(`정말 삭제하려면 "삭제" 를 입력하세요:`, "");
    if (phrase?.trim() !== "삭제") {
      setError("삭제 확인 문구가 일치하지 않아 취소됐어요.");
      return;
    }

    setError(null);
    setNotice(null);
    setDeleteInProgress(true);
    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authUserIds: ids }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; deleted?: number; total?: number; error?: string; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? `삭제 실패 (${res.status})`);
        return;
      }
      setRows((prev) => prev.filter((r) => !selectedIds.has(r.authUserId)));
      setSelectedIds(new Set());
      setNotice(`${data.deleted ?? 0}/${data.total ?? ids.length}명 삭제 완료`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
    } finally {
      setDeleteInProgress(false);
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

      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{filteredRows.length}건 표시 (전체 {rows.length})</span>
        {/* Wave launch-100: 선택된 row 일괄 삭제 button. */}
        {selectedIds.size > 0 ? (
          <button
            type="button"
            onClick={() => void deleteSelected()}
            disabled={deleteInProgress}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
          >
            {deleteInProgress ? "..." : `🗑 ${selectedIds.size}명 삭제`}
          </button>
        ) : null}
      </div>

      {/* Wave launch-101: bloomberg 터미널 톤 — bg zinc-950 + mono + 작은 글자 + amber accent. */}
      <div className="mt-2 overflow-x-auto rounded-sm border border-zinc-800 bg-zinc-950">
        <table className="w-full min-w-[1500px] font-mono text-[11px]">
          <thead className="bg-zinc-900/80">
            <tr className="border-b border-zinc-800 text-left text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
              {/* Wave launch-100: 헤더 전체 선택 체크박스. */}
              <th className="w-9 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="전체 선택"
                  checked={selectedIds.size > 0 && selectedIds.size === filteredRows.length}
                  ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredRows.length; }}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 cursor-pointer accent-rose-600"
                />
              </th>
              <th className="px-3 py-2">닉네임</th>
              {/* Wave launch-96 (사용자 정정 — 구독제 무 / 베타 체험단 무): 플랜/플랜만료/일일 사용/최근 결제/베타 column 제거.
                  현재 시스템 = 크레딧 패키지만. 단순화. */}
              <th className="px-3 py-2">이메일</th>
              <th className="px-3 py-2">가입일</th>
              <th className="px-3 py-2">마지막 로그인</th>
              <th className="px-3 py-2">크레딧</th>
              <th className="px-3 py-2">회수</th>
              <th className="px-3 py-2">차단</th>
              <th className="px-3 py-2">provider</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const planActive = row.planStatus === "active";
              const badge = PLAN_BADGE[row.planKey] ?? PLAN_BADGE.free;
              const pending = pendingIds.has(row.authUserId);
              const creditPending = creditPendingIds.has(row.authUserId);
              const revokePending = revokePendingIds.has(row.authUserId);
              const blockPending = blockPendingIds.has(row.authUserId);
              const isBlocked = Boolean(row.blockedAt);
              return (
                <tr key={row.authUserId} className={`border-b border-zinc-900 transition hover:bg-zinc-900/40 ${selectedIds.has(row.authUserId) ? "bg-rose-950/25" : ""}`}>
                  {/* Wave launch-100: row 체크박스 */}
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`${row.email ?? row.authUserId} 선택`}
                      checked={selectedIds.has(row.authUserId)}
                      onChange={() => toggleSelect(row.authUserId)}
                      className="h-4 w-4 cursor-pointer accent-rose-600"
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold">{row.nickname || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.email ?? "—"}</td>
                  {/* Wave launch-96: 플랜/플랜만료/일일사용/최근결제 td 제거 (구독제 무). */}
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
                  {/* Wave launch-95: 회수 input + button. 양심 신뢰 충전 후 입금 안 한 사용자 회수 용도. */}
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={revokeDrafts[row.authUserId] ?? ""}
                        onChange={(e) => setRevokeDrafts((prev) => ({ ...prev, [row.authUserId]: e.target.value }))}
                        placeholder="개수"
                        className="h-7 w-20 rounded-md border border-gray-300 bg-white px-2 text-right font-mono text-xs outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-rose-950"
                      />
                      <button
                        type="button"
                        onClick={() => void revokeCredits(row)}
                        disabled={revokePending || !row.creditRowExists}
                        className="inline-flex h-7 items-center rounded-md bg-rose-600 px-2.5 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
                        title="입금 안 한 사용자 크레딧 회수"
                      >
                        {revokePending ? "..." : "회수"}
                      </button>
                    </div>
                  </td>
                  {/* Wave launch-95: 차단/해제 toggle. */}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => void toggleBlock(row)}
                      disabled={blockPending || !row.creditRowExists}
                      className={`inline-flex h-7 items-center rounded-md px-2.5 text-xs font-bold transition disabled:opacity-50 ${
                        isBlocked
                          ? "bg-zinc-800 text-white hover:bg-zinc-900"
                          : "border border-gray-300 bg-white text-gray-700 hover:border-rose-400 hover:bg-rose-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-300"
                      }`}
                      title={isBlocked ? `차단됨: ${row.blockedReason ?? "-"} — 클릭하면 해제` : "결제 차단"}
                    >
                      {blockPending ? "..." : isBlocked ? "✕ 차단" : "차단"}
                    </button>
                    {isBlocked && row.blockedAt ? (
                      <div className="mt-0.5 font-mono text-[10px] text-rose-600 dark:text-rose-400">{fmt(row.blockedAt)}</div>
                    ) : null}
                  </td>
                  {/* Wave launch-96: 베타 체험단 td 제거 (현재 시스템 무관). */}
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
