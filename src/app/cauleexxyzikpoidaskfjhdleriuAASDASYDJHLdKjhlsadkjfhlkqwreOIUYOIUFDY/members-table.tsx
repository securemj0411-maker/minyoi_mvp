"use client";

// Wave launch-102 (사용자 정정): bloomberg 톤 monochrome + row 클릭 drawer + pagination + 가로 단축.
//   주요 column 만 (닉네임/이메일/크레딧/상태) — 가입일/마지막 로그인 + grant/revoke/block 다 drawer 안.
//   페이지네이션 (50/페이지 기본). 검색 + plan filter 그대로 keep.

import { useMemo, useState } from "react";

export type MemberRow = {
  authUserId: string;
  email: string | null;
  nickname: string;
  profileImageUrl: string | null;
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

const KST_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});
function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value.slice(0, 16).replace("T", " ");
  const parts = KST_FORMATTER.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

const PAGE_SIZE = 50;

export default function MembersTable({ initialRows }: { initialRows: MemberRow[] }) {
  const [rows, setRows] = useState<MemberRow[]>(initialRows);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [actionPending, setActionPending] = useState<Set<string>>(new Set());
  const [photoPreview, setPhotoPreview] = useState<MemberRow | null>(null);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.trim().toLowerCase();
    return rows.filter((row) => `${row.email ?? ""} ${row.nickname}`.toLowerCase().includes(s));
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = filteredRows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);
  const drawerRow = drawerId ? rows.find((r) => r.authUserId === drawerId) ?? null : null;

  function toggleSelect(authUserId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(authUserId)) next.delete(authUserId);
      else next.add(authUserId);
      return next;
    });
  }
  function toggleSelectAllOnPage() {
    const pageIds = pageRows.map((r) => r.authUserId);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => { if (allSelected) next.delete(id); else next.add(id); });
      return next;
    });
  }

  function markPending(id: string, on: boolean) {
    setActionPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function grantCredits(row: MemberRow, amount: number) {
    if (amount <= 0) { setError("크레딧 개수를 1 이상으로 입력해주세요."); return; }
    const target = row.nickname || row.email || row.authUserId;
    if (!window.confirm(`${target} 에게 크레딧 ${amount.toLocaleString("ko-KR")}개 지급?`)) return;
    setError(null); setNotice(null); markPending(row.authUserId, true);
    try {
      const res = await fetch("/api/admin/credits/grant", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ authUserId: row.authUserId, amount, note: "operator members drawer" }),
      });
      const data = (await res.json()) as { ok?: boolean; balance?: number; error?: string };
      if (!res.ok || !data.ok) { setError(data.error ?? "credit_grant_failed"); return; }
      setRows((prev) => prev.map((r) => r.authUserId === row.authUserId ? { ...r, balance: Number(data.balance ?? r.balance ?? 0), creditRowExists: true } : r));
      setNotice(`${target} +${amount.toLocaleString("ko-KR")} 지급`);
    } catch (err) { setError(err instanceof Error ? err.message : "network error"); }
    finally { markPending(row.authUserId, false); }
  }

  async function revokeCredits(row: MemberRow, amount: number) {
    if (amount <= 0) { setError("크레딧 개수를 1 이상으로 입력해주세요."); return; }
    const target = row.nickname || row.email || row.authUserId;
    if (!window.confirm(`${target} 회수 ${amount.toLocaleString("ko-KR")}개?`)) return;
    setError(null); setNotice(null); markPending(row.authUserId, true);
    try {
      const res = await fetch("/api/admin/credits/revoke", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ authUserId: row.authUserId, amount, note: "operator members drawer" }),
      });
      const data = (await res.json()) as { ok?: boolean; balance?: number; error?: string };
      if (!res.ok || !data.ok) { setError(data.error ?? "credit_revoke_failed"); return; }
      setRows((prev) => prev.map((r) => r.authUserId === row.authUserId ? { ...r, balance: Number(data.balance ?? r.balance ?? 0) } : r));
      setNotice(`${target} −${amount.toLocaleString("ko-KR")} 회수`);
    } catch (err) { setError(err instanceof Error ? err.message : "network error"); }
    finally { markPending(row.authUserId, false); }
  }

  async function toggleBlock(row: MemberRow) {
    const blocking = !row.blockedAt;
    const target = row.nickname || row.email || row.authUserId;
    let reason: string | null = null;
    if (blocking) {
      const input = window.prompt(`${target} 차단 사유:`, "manual deposit fraud");
      if (input === null) return;
      reason = input.trim() || "blocked by operator";
    } else {
      if (!window.confirm(`${target} 차단 해제?`)) return;
    }
    setError(null); setNotice(null); markPending(row.authUserId, true);
    try {
      const res = await fetch("/api/admin/user/block", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ authUserId: row.authUserId, blocked: blocking, reason }),
      });
      const data = (await res.json()) as { ok?: boolean; blockedAt?: string | null; error?: string };
      if (!res.ok || !data.ok) { setError(data.error ?? "block_toggle_failed"); return; }
      setRows((prev) => prev.map((r) => r.authUserId === row.authUserId ? { ...r, blockedAt: data.blockedAt ?? null, blockedReason: blocking ? reason : null } : r));
      setNotice(`${target} ${blocking ? "차단" : "차단 해제"}`);
    } catch (err) { setError(err instanceof Error ? err.message : "network error"); }
    finally { markPending(row.authUserId, false); }
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`${ids.length}명 계정을 영구 삭제? auth.users + 크레딧 + 결제 이력 다 사라짐.`)) return;
    const phrase = window.prompt(`정말 삭제하려면 "삭제" 입력:`, "");
    if (phrase?.trim() !== "삭제") { setError("삭제 확인 문구 불일치 — 취소됨."); return; }
    setError(null); setNotice(null); setDeleteInProgress(true);
    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ authUserIds: ids }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; deleted?: number; total?: number; error?: string; message?: string };
      if (!res.ok || !data.ok) { setError(data.message ?? data.error ?? `삭제 실패 (${res.status})`); return; }
      setRows((prev) => prev.filter((r) => !selectedIds.has(r.authUserId)));
      setSelectedIds(new Set());
      setNotice(`${data.deleted ?? 0}/${data.total ?? ids.length} 삭제 완료`);
    } catch (err) { setError(err instanceof Error ? err.message : "network error"); }
    finally { setDeleteInProgress(false); }
  }

  return (
    <section className="mt-6 font-mono">
      {/* header bar */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-400">▌MEMBERS</h2>
        <input
          type="search"
          placeholder="SEARCH email / nickname"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="ml-auto h-7 w-[260px] rounded-sm border border-zinc-800 bg-zinc-900 px-2 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
        />
        {selectedIds.size > 0 ? (
          <button
            type="button"
            onClick={() => void deleteSelected()}
            disabled={deleteInProgress}
            className="inline-flex h-7 items-center gap-1 rounded-sm border border-rose-700 bg-rose-900/40 px-2.5 text-[10px] font-black uppercase tracking-wide text-rose-300 transition hover:bg-rose-900/60 disabled:opacity-50"
          >
            {deleteInProgress ? "..." : `DELETE ${selectedIds.size}`}
          </button>
        ) : null}
      </div>

      {notice ? (
        <div className="mb-2 rounded-sm border border-blue-900/50 bg-blue-950/30 px-2.5 py-1.5 text-[10px] font-bold text-blue-300">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mb-2 rounded-sm border border-rose-900/50 bg-rose-950/30 px-2.5 py-1.5 text-[10px] font-bold text-rose-300">
          {error}
        </div>
      ) : null}

      {/* Wave launch-110: 모바일 카드 layout (md 미만). desktop 테이블은 md 이상. */}
      <div className="space-y-1.5 md:hidden">
        {pageRows.length === 0 ? (
          <div className="rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-6 text-center text-[10px] uppercase text-zinc-600">no results</div>
        ) : pageRows.map((row) => {
          const isBlocked = Boolean(row.blockedAt);
          const isSelected = selectedIds.has(row.authUserId);
          return (
            <div
              key={`m-${row.authUserId}`}
              onClick={() => setDrawerId(row.authUserId)}
              className={`rounded-sm border p-3 transition ${isSelected ? "border-amber-700/60 bg-amber-950/20" : "border-zinc-800 bg-zinc-950"} ${isBlocked ? "opacity-70" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                {/* Wave 748 (2026-05-24): 부모 onClick + input onChange 둘 다 toggleSelect 호출하면
                    한 번 클릭에 두 번 toggle 되어 state 그대로 → 체크 안 됨 버그. stopPropagation 만 유지. */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label="row 선택"
                    checked={isSelected}
                    onChange={() => toggleSelect(row.authUserId)}
                    className="h-4 w-4 cursor-pointer accent-amber-500"
                  />
                  <ProfileThumb row={row} onOpen={() => setPhotoPreview(row)} />
                  <span className="text-[13px] font-bold text-zinc-100">{row.nickname || "—"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isBlocked ? (
                    <span className="rounded-sm border border-rose-800/60 bg-rose-950/40 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-rose-300">BLOCKED</span>
                  ) : null}
                  <span className="font-bold tabular-nums text-amber-400">{row.balance?.toLocaleString("ko-KR") ?? "—"}</span>
                </div>
              </div>
              <div className="mt-1 truncate font-mono text-[11px] text-zinc-400">{row.email ?? "—"}</div>
              <div className="mt-0.5 text-[10px] uppercase text-zinc-600">{row.provider ?? "—"} · 탭하여 상세</div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-sm border border-zinc-800 bg-zinc-950 md:block">
        <table className="w-full text-[11px]">
          <thead className="bg-zinc-900/80">
            <tr className="border-b border-zinc-800 text-left text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
              <th className="w-9 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="페이지 전체 선택"
                  checked={pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.authUserId))}
                  ref={(el) => {
                    if (!el) return;
                    const some = pageRows.some((r) => selectedIds.has(r.authUserId));
                    const all = pageRows.every((r) => selectedIds.has(r.authUserId));
                    el.indeterminate = some && !all;
                  }}
                  onChange={toggleSelectAllOnPage}
                  className="h-3.5 w-3.5 cursor-pointer accent-amber-500"
                />
              </th>
              <th className="px-3 py-2">NICK</th>
              <th className="px-3 py-2">EMAIL</th>
              <th className="px-3 py-2 text-right">CREDIT</th>
              <th className="px-3 py-2">STATUS</th>
              <th className="px-3 py-2">PROV</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-[10px] uppercase tracking-wide text-zinc-600">no results</td></tr>
            ) : pageRows.map((row) => {
              const isBlocked = Boolean(row.blockedAt);
              const isSelected = selectedIds.has(row.authUserId);
              return (
                <tr
                  key={row.authUserId}
                  onClick={() => setDrawerId(row.authUserId)}
                  className={`cursor-pointer border-b border-zinc-900 transition hover:bg-zinc-900/40 ${isSelected ? "bg-amber-950/20" : ""} ${isBlocked ? "opacity-70" : ""}`}
                >
                  {/* Wave 748: 부모 td onClick + input onChange 둘 다 toggle → 두 번 = 0 버그 fix. */}
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label="row 선택"
                      checked={isSelected}
                      onChange={() => toggleSelect(row.authUserId)}
                      className="h-3.5 w-3.5 cursor-pointer accent-amber-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <ProfileThumb row={row} onOpen={() => setPhotoPreview(row)} />
                      <span className="font-semibold text-zinc-200">{row.nickname || "—"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{row.email ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-amber-400">{row.balance?.toLocaleString("ko-KR") ?? "—"}</td>
                  <td className="px-3 py-2">
                    {isBlocked ? (
                      <span className="rounded-sm border border-rose-800/60 bg-rose-950/40 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-rose-300">BLOCKED</span>
                    ) : (
                      <span className="text-[9px] uppercase tracking-wide text-zinc-600">active</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[10px] uppercase text-zinc-500">{row.provider ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      {totalPages > 1 ? (
        <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-zinc-500">
          <span>page {currentPage + 1} / {totalPages} · {filteredRows.length} rows</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => setPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="h-7 rounded-sm border border-zinc-800 bg-zinc-900 px-2.5 font-bold text-zinc-300 hover:border-zinc-700 disabled:opacity-30">‹ PREV</button>
            <button type="button" onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))} disabled={currentPage >= totalPages - 1} className="h-7 rounded-sm border border-zinc-800 bg-zinc-900 px-2.5 font-bold text-zinc-300 hover:border-zinc-700 disabled:opacity-30">NEXT ›</button>
          </div>
        </div>
      ) : null}

      {/* drawer */}
      {drawerRow ? (
        <MemberDrawer
          row={drawerRow}
          onClose={() => setDrawerId(null)}
          pending={actionPending.has(drawerRow.authUserId)}
          onGrant={(amount) => void grantCredits(drawerRow, amount)}
          onRevoke={(amount) => void revokeCredits(drawerRow, amount)}
          onToggleBlock={() => void toggleBlock(drawerRow)}
          onOpenPhoto={() => setPhotoPreview(drawerRow)}
        />
      ) : null}

      {photoPreview ? (
        <ProfilePhotoModal row={photoPreview} onClose={() => setPhotoPreview(null)} />
      ) : null}
    </section>
  );
}

function profileInitial(row: MemberRow) {
  return (row.nickname || row.email || "?").trim().slice(0, 1).toUpperCase();
}

function ProfileThumb({ row, onOpen }: { row: MemberRow; onOpen: () => void }) {
  const label = row.profileImageUrl ? `${row.nickname || row.email || "회원"} 프로필 사진 크게 보기` : "프로필 사진 없음";
  if (!row.profileImageUrl) {
    return (
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-[10px] font-black text-zinc-500"
        aria-label={label}
        title={label}
      >
        {profileInitial(row)}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className="group relative inline-flex h-6 w-6 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-900 ring-0 transition hover:border-blue-400 hover:ring-2 hover:ring-blue-500/25"
      aria-label={label}
      title={label}
    >
      <img src={row.profileImageUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
    </button>
  );
}

function MemberDrawer({
  row, onClose, pending, onGrant, onRevoke, onToggleBlock, onOpenPhoto,
}: {
  row: MemberRow;
  onClose: () => void;
  pending: boolean;
  onGrant: (amount: number) => void;
  onRevoke: (amount: number) => void;
  onToggleBlock: () => void;
  onOpenPhoto: () => void;
}) {
  const [grantAmount, setGrantAmount] = useState("");
  const [revokeAmount, setRevokeAmount] = useState("");
  const isBlocked = Boolean(row.blockedAt);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[80] flex justify-end bg-black/55 backdrop-blur-sm font-mono"
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[420px] flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950 px-5 py-6 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            {row.profileImageUrl ? (
              <button
                type="button"
                onClick={onOpenPhoto}
                className="group relative mt-0.5 h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 transition hover:border-blue-400"
                aria-label={`${row.nickname || row.email || "회원"} 프로필 사진 크게 보기`}
                title="프로필 사진 크게 보기"
              >
                <img src={row.profileImageUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[8px] font-black uppercase tracking-wide text-zinc-100 opacity-0 transition group-hover:opacity-100">
                  VIEW
                </span>
              </button>
            ) : (
              <div className="mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-xl font-black text-zinc-600">
                {profileInitial(row)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">MEMBER PROFILE</div>
              <div className="mt-1 truncate text-lg font-black text-zinc-50">{row.nickname || "—"}</div>
              <div className="mt-0.5 truncate text-[11px] text-zinc-500">{row.email ?? "—"}</div>
              {row.profileImageUrl ? (
                <button
                  type="button"
                  onClick={onOpenPhoto}
                  className="mt-2 rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-blue-300 transition hover:border-blue-700 hover:bg-blue-950/30"
                >
                  PROFILE PHOTO
                </button>
              ) : (
                <div className="mt-2 text-[9px] font-bold uppercase tracking-wide text-zinc-700">NO PROFILE PHOTO</div>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:text-zinc-200">CLOSE</button>
        </div>

        {/* meta */}
        <dl className="mt-6 grid grid-cols-[100px_minmax(0,1fr)] gap-y-2.5 text-[11px]">
          <dt className="font-bold uppercase tracking-wide text-zinc-500">CREATED</dt>
          <dd className="tabular-nums text-zinc-300">{fmt(row.createdAt)}</dd>
          <dt className="font-bold uppercase tracking-wide text-zinc-500">LAST LOGIN</dt>
          <dd className="tabular-nums text-zinc-300">{fmt(row.lastSignInAt)}</dd>
          <dt className="font-bold uppercase tracking-wide text-zinc-500">PROVIDER</dt>
          <dd className="text-zinc-300">{row.provider ?? "—"}</dd>
          <dt className="font-bold uppercase tracking-wide text-zinc-500">PROFILE PHOTO</dt>
          <dd>
            {row.profileImageUrl ? (
              <button
                type="button"
                onClick={onOpenPhoto}
                className="inline-flex items-center rounded-sm border border-blue-800 bg-blue-950/30 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-blue-300 transition hover:border-blue-600 hover:bg-blue-950/50"
              >
                VIEW PHOTO
              </button>
            ) : (
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">none</span>
            )}
          </dd>
          <dt className="font-bold uppercase tracking-wide text-zinc-500">CREDIT</dt>
          <dd className="font-bold tabular-nums text-amber-400">{row.balance?.toLocaleString("ko-KR") ?? "—"}</dd>
          <dt className="font-bold uppercase tracking-wide text-zinc-500">STATUS</dt>
          <dd>
            {isBlocked ? (
              <span className="rounded-sm border border-rose-800/60 bg-rose-950/40 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-rose-300">BLOCKED</span>
            ) : (
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">active</span>
            )}
          </dd>
          {row.blockedReason ? (
            <>
              <dt className="font-bold uppercase tracking-wide text-zinc-500">BLOCK REASON</dt>
              <dd className="text-[10px] text-rose-300/80">{row.blockedReason}</dd>
            </>
          ) : null}
          <dt className="font-bold uppercase tracking-wide text-zinc-500">AUTH ID</dt>
          <dd className="break-all font-mono text-[9px] text-zinc-600">{row.authUserId}</dd>
        </dl>

        {/* actions */}
        <div className="mt-6 space-y-3">
          {/* grant */}
          <div>
            <div className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-blue-400">▌GRANT CREDIT</div>
            <div className="flex gap-2">
              <input
                type="number" min={1} step={1} value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                placeholder="amount"
                className="h-8 flex-1 rounded-sm border border-zinc-800 bg-zinc-900 px-2 text-right text-[11px] tabular-nums text-zinc-200 focus:border-blue-700 focus:outline-none"
              />
              <button
                type="button" disabled={pending || !grantAmount} onClick={() => onGrant(Math.round(Number(grantAmount)))}
                className="rounded-sm border border-blue-800 bg-blue-900/40 px-3 text-[10px] font-black uppercase tracking-wide text-blue-300 hover:bg-blue-900/60 disabled:opacity-40"
              >GRANT</button>
            </div>
          </div>

          {/* revoke */}
          <div>
            <div className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-rose-400">▌REVOKE CREDIT</div>
            <div className="flex gap-2">
              <input
                type="number" min={1} step={1} value={revokeAmount}
                onChange={(e) => setRevokeAmount(e.target.value)}
                placeholder="amount"
                className="h-8 flex-1 rounded-sm border border-zinc-800 bg-zinc-900 px-2 text-right text-[11px] tabular-nums text-zinc-200 focus:border-rose-700 focus:outline-none"
              />
              <button
                type="button" disabled={pending || !revokeAmount || !row.creditRowExists} onClick={() => onRevoke(Math.round(Number(revokeAmount)))}
                className="rounded-sm border border-rose-800 bg-rose-900/40 px-3 text-[10px] font-black uppercase tracking-wide text-rose-300 hover:bg-rose-900/60 disabled:opacity-40"
              >REVOKE</button>
            </div>
          </div>

          {/* block toggle */}
          <div>
            <div className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">▌ACCOUNT</div>
            <button
              type="button" disabled={pending || !row.creditRowExists} onClick={onToggleBlock}
              className={`w-full rounded-sm border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition disabled:opacity-40 ${
                isBlocked
                  ? "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  : "border-zinc-700 bg-zinc-900 text-rose-300 hover:bg-rose-950/40"
              }`}
            >{isBlocked ? "UNBLOCK ACCOUNT" : "BLOCK ACCOUNT"}</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ProfilePhotoModal({ row, onClose }: { row: MemberRow; onClose: () => void }) {
  if (!row.profileImageUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 font-mono backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[520px] overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-[11px] font-black text-zinc-100">{row.nickname || row.email || "—"}</div>
            <div className="truncate text-[9px] text-zinc-600">{row.profileImageUrl}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
          >
            CLOSE
          </button>
        </div>
        <div className="bg-black p-3">
          <img
            src={row.profileImageUrl}
            alt={`${row.nickname || row.email || "회원"} 프로필 사진`}
            className="mx-auto max-h-[72vh] w-auto max-w-full rounded-sm object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex justify-end border-t border-zinc-800 px-3 py-2">
          <a
            href={row.profileImageUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-blue-300 hover:border-blue-700"
          >
            OPEN ORIGINAL
          </a>
        </div>
      </div>
    </div>
  );
}
