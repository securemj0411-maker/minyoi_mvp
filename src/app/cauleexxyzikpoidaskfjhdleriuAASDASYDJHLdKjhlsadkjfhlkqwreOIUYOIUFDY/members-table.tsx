"use client";

// Wave launch-102 (사용자 정정): bloomberg 톤 monochrome + row 클릭 drawer + pagination + 가로 단축.
//   주요 column 만 (닉네임/이메일/크레딧/상태) — 가입일/마지막 로그인 + grant/revoke/block 다 drawer 안.
//   페이지네이션 (50/페이지 기본). 검색 + plan filter 그대로 keep.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

import { OPS_ADMIN_REVEAL_ANALYTICS_PATH } from "@/lib/admin-routes";

import { useDialogA11y } from "./_ui/hooks";

export type MemberRow = {
  authUserId: string;
  userRef: string;
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
  totalPaidKrw: number;
  applicationCount: number;
  lastApplicationId: number | null;
  lastApplicationStatus: string | null;
  lastApplicationKind: "new" | "renewal" | null;
  lastApplicationProductKey: string | null;
  lastApplicationAt: string | null;
  supportConversationId: number | null;
  supportStatus: "open" | "closed" | null;
  supportAdminUnreadCount: number;
  supportUserUnreadCount: number;
  supportLastMessageAt: string | null;
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

function krw(value: number | null | undefined): string {
  return `${Math.round(Number(value ?? 0)).toLocaleString("ko-KR")}원`;
}

function memberPlanLabel(row: MemberRow): string {
  const end = row.planEndAt ?? row.proUntil;
  const isActivePaid = row.planKey !== "free" && (!end || Date.parse(end) > Date.now());
  if (row.blockedAt) return "차단";
  if (isActivePaid) return "프로 멤버";
  if (row.isBetaTester) return "운영 테스트";
  return "무료/미승인";
}

function applicationStatusLabel(value: string | null): string {
  if (value === "approved") return "승인 완료";
  if (value === "pending") return "처리 중";
  if (value === "rejected") return "거절/만료";
  return "기록 없음";
}

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
    return rows.filter((row) => `${row.email ?? ""} ${row.nickname} ${row.authUserId}`.toLowerCase().includes(s));
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
        method: "POST", headers: { "content-type": "application/json", "x-minyoi-admin-action": "1" },
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
        method: "POST", headers: { "content-type": "application/json", "x-minyoi-admin-action": "1" },
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
    <section className="mt-6 overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
      {/* header bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 bg-zinc-900/70 px-5 py-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">회원 관리</div>
          <h2 className="mt-1 text-2xl font-black text-white">회원별 결제·신청·상담 흐름</h2>
        </div>
        <input
          type="search"
          placeholder="이메일 / 닉네임 / auth id 검색"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="ml-auto h-11 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-sm font-bold text-zinc-100 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none sm:w-[360px]"
        />
        {selectedIds.size > 0 ? (
          <button
            type="button"
            onClick={() => void deleteSelected()}
            disabled={deleteInProgress}
            className="inline-flex h-11 items-center gap-1 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 text-sm font-black text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-50"
          >
            {deleteInProgress ? "삭제 중" : `${selectedIds.size}명 삭제`}
          </button>
        ) : null}
      </div>

      {notice ? (
        <div className="mx-5 mt-4 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm font-black text-blue-100">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mx-5 mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-100">
          {error}
        </div>
      ) : null}

      {/* Wave launch-110: 모바일 카드 layout (md 미만). desktop 테이블은 md 이상. */}
      <div className="space-y-2 p-4 md:hidden">
        {pageRows.length === 0 ? (
          <div className="rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-6 text-center text-xs uppercase text-zinc-400">no results</div>
        ) : pageRows.map((row) => {
          const isBlocked = Boolean(row.blockedAt);
          const isSelected = selectedIds.has(row.authUserId);
          return (
            <div
              key={`m-${row.authUserId}`}
              role="button"
              tabIndex={0}
              onClick={() => setDrawerId(row.authUserId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDrawerId(row.authUserId);
                }
              }}
              className={`rounded-sm border p-3 outline-none transition focus-visible:ring-2 focus-visible:ring-blue-400/70 ${isSelected ? "border-amber-700/60 bg-amber-950/20" : "border-zinc-800 bg-zinc-950"} ${isBlocked ? "opacity-70" : ""}`}
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
                    <span className="rounded-sm border border-rose-800/60 bg-rose-950/40 px-1.5 py-0.5 text-xs font-black uppercase tracking-wide text-rose-300">BLOCKED</span>
                  ) : null}
                  <span className="font-bold text-violet-200">{memberPlanLabel(row)}</span>
                </div>
              </div>
              <div className="mt-1 truncate font-mono text-xs text-zinc-400">{row.email ?? "—"}</div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-xs uppercase text-zinc-400">
                <span>{row.provider ?? "—"} · 결제 {krw(row.totalPaidKrw)}</span>
                <Link
                  href={`${OPS_ADMIN_REVEAL_ANALYTICS_PATH}?userRef=${encodeURIComponent(row.userRef)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-sm border border-emerald-800 bg-emerald-950/35 px-2 py-1 font-black tracking-wide text-emerald-300"
                >
                  회원별
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto px-5 py-5 md:block">
        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900/80">
            <tr className="border-b border-zinc-800 text-left text-xs font-black text-zinc-500">
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
              <th className="px-3 py-3">회원</th>
              <th className="px-3 py-3">이메일</th>
              <th className="px-3 py-3 text-right">멤버십</th>
              <th className="px-3 py-3 text-right">누적 결제</th>
              <th className="px-3 py-3">최근 신청</th>
              <th className="px-3 py-3">상담</th>
              <th className="px-3 py-3 text-right">회원별 내역</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm font-bold text-zinc-400">검색 결과가 없습니다.</td></tr>
            ) : pageRows.map((row) => {
              const isBlocked = Boolean(row.blockedAt);
              const isSelected = selectedIds.has(row.authUserId);
              return (
                <tr
                  key={row.authUserId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDrawerId(row.authUserId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDrawerId(row.authUserId);
                    }
                  }}
                  className={`cursor-pointer border-b border-zinc-900 outline-none transition hover:bg-zinc-900/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400/70 ${isSelected ? "bg-amber-950/20" : ""} ${isBlocked ? "opacity-70" : ""}`}
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
                  <td className="px-3 py-2 text-right">
                    <div className="font-black text-violet-200">{memberPlanLabel(row)}</div>
                    <div className="text-xs font-bold text-zinc-400">{fmt(row.planEndAt ?? row.proUntil)}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-black tabular-nums text-zinc-100">
                    {krw(row.totalPaidKrw)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-xs font-black text-zinc-200">{applicationStatusLabel(row.lastApplicationStatus)}</div>
                    <div className="mt-0.5 text-xs font-bold text-zinc-400">
                      {row.lastApplicationId ? `#${row.lastApplicationId} · ${fmt(row.lastApplicationAt)}` : "신청 없음"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {row.supportConversationId ? (
                      <a href="#customer-support" className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-100">
                        {row.supportAdminUnreadCount > 0 ? `새 상담 ${row.supportAdminUnreadCount}` : row.supportStatus === "open" ? "상담 진행" : "상담 기록"}
                      </a>
                    ) : (
                      <span className="text-xs font-bold text-zinc-500">상담 없음</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`${OPS_ADMIN_REVEAL_ANALYTICS_PATH}?userRef=${encodeURIComponent(row.userRef)}`}
                      className="inline-flex rounded-sm border border-emerald-800 bg-emerald-950/35 px-2 py-1 text-xs font-black uppercase tracking-wide text-emerald-300 transition hover:border-emerald-600 hover:bg-emerald-950/60"
                    >
                      보기
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* pagination */}
      {totalPages > 1 ? (
        <div className="px-5 pb-5 pt-0 flex items-center justify-between text-xs font-bold text-zinc-500">
          <span>{currentPage + 1} / {totalPages} 페이지 · {filteredRows.length}명</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => setPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} className="h-9 rounded-full border border-zinc-800 bg-zinc-900 px-3 font-bold text-zinc-300 hover:border-zinc-700 disabled:opacity-30">이전</button>
            <button type="button" onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))} disabled={currentPage >= totalPages - 1} className="h-9 rounded-full border border-zinc-800 bg-zinc-900 px-3 font-bold text-zinc-300 hover:border-zinc-700 disabled:opacity-30">다음</button>
          </div>
        </div>
      ) : null}

      {/* drawer */}
      {drawerRow ? (
        <MemberDrawer
          row={drawerRow}
          onClose={() => setDrawerId(null)}
          pending={actionPending.has(drawerRow.authUserId)}
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
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-xs font-black text-zinc-500"
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
  row, onClose, pending, onToggleBlock, onOpenPhoto,
}: {
  row: MemberRow;
  onClose: () => void;
  pending: boolean;
  onToggleBlock: () => void;
  onOpenPhoto: () => void;
}) {
  const isBlocked = Boolean(row.blockedAt);
  const panelRef = useRef<HTMLElement>(null);
  useDialogA11y(true, onClose, panelRef);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${row.nickname || row.email || "회원"} 상세`}
      onClick={onClose}
      className="fixed inset-0 z-[80] flex justify-end bg-black/55 backdrop-blur-sm"
    >
      <aside
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        className="flex h-full w-full max-w-[460px] flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950 px-5 py-6 shadow-[0_0_0_1px_rgba(0,0,0,0.35)] outline-none"
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
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-xs font-black uppercase tracking-wide text-zinc-100 opacity-0 transition group-hover:opacity-100">
                  VIEW
                </span>
              </button>
            ) : (
              <div className="mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-xl font-black text-zinc-400">
                {profileInitial(row)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">회원 상세</div>
              <div className="mt-1 truncate text-lg font-black text-zinc-50">{row.nickname || "—"}</div>
              <div className="mt-0.5 truncate text-xs text-zinc-500">{row.email ?? "—"}</div>
              {row.profileImageUrl ? (
                <button
                  type="button"
                  onClick={onOpenPhoto}
                  className="mt-2 rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-black uppercase tracking-wide text-blue-300 transition hover:border-blue-700 hover:bg-blue-950/30"
                >
                  프로필 사진
                </button>
              ) : (
                <div className="mt-2 text-xs font-bold text-zinc-500">프로필 사진 없음</div>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-200">닫기</button>
        </div>

        {/* meta */}
        <dl className="mt-6 grid grid-cols-[116px_minmax(0,1fr)] gap-y-3 text-sm">
          <dt className="font-bold text-zinc-500">가입일</dt>
          <dd className="tabular-nums text-zinc-300">{fmt(row.createdAt)}</dd>
          <dt className="font-bold text-zinc-500">마지막 로그인</dt>
          <dd className="tabular-nums text-zinc-300">{fmt(row.lastSignInAt)}</dd>
          <dt className="font-bold text-zinc-500">로그인 방식</dt>
          <dd className="text-zinc-300">{row.provider ?? "—"}</dd>
          <dt className="font-bold text-zinc-500">프로필 사진</dt>
          <dd>
            {row.profileImageUrl ? (
              <button
                type="button"
                onClick={onOpenPhoto}
                className="inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-200 transition hover:bg-blue-500/20"
              >
                사진 보기
              </button>
            ) : (
              <span className="text-zinc-500">없음</span>
            )}
          </dd>
          <dt className="font-bold text-zinc-500">멤버십</dt>
          <dd>
            <div className="font-black text-violet-200">{memberPlanLabel(row)}</div>
            <div className="mt-0.5 text-xs font-bold text-zinc-400">
              {row.planStatus ?? "상태 없음"} · 만료 {fmt(row.planEndAt ?? row.proUntil)}
            </div>
          </dd>
          <dt className="font-bold text-zinc-500">누적 결제</dt>
          <dd>
            <div className="font-black tabular-nums text-zinc-100">{krw(row.totalPaidKrw)}</div>
            <div className="mt-0.5 text-xs font-bold text-zinc-400">멤버십 신청 {row.applicationCount}건</div>
          </dd>
          <dt className="font-bold text-zinc-500">최근 신청</dt>
          <dd>
            <div className="font-black text-zinc-200">{applicationStatusLabel(row.lastApplicationStatus)}</div>
            <div className="mt-0.5 text-xs font-bold text-zinc-400">
              {row.lastApplicationId ? `#${row.lastApplicationId} · ${row.lastApplicationKind === "renewal" ? "연장" : "신규"} · ${fmt(row.lastApplicationAt)}` : "기록 없음"}
            </div>
          </dd>
          <dt className="font-bold text-zinc-500">고객상담</dt>
          <dd>
            {row.supportConversationId ? (
              <a href="#customer-support" className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-100">
                {row.supportAdminUnreadCount > 0 ? `새 메시지 ${row.supportAdminUnreadCount}개` : row.supportStatus === "open" ? "진행 중인 상담 보기" : "상담 기록 보기"}
              </a>
            ) : (
              <span className="text-zinc-500">상담 없음</span>
            )}
          </dd>
          <dt className="font-bold text-zinc-500">계정 상태</dt>
          <dd>
            {isBlocked ? (
              <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-xs font-black text-rose-200">차단됨</span>
            ) : (
              <span className="text-zinc-500">정상</span>
            )}
          </dd>
          {row.blockedReason ? (
            <>
              <dt className="font-bold text-zinc-500">차단 사유</dt>
              <dd className="text-xs text-rose-300/80">{row.blockedReason}</dd>
            </>
          ) : null}
          <dt className="font-bold text-zinc-500">Auth ID</dt>
          <dd className="break-all font-mono text-xs text-zinc-400">{row.authUserId}</dd>
        </dl>

        {/* actions */}
        <div className="mt-6 space-y-3">
          <div>
            <div className="mb-1 text-xs font-black text-emerald-300">회원별 이용 내역</div>
            <Link
              href={`${OPS_ADMIN_REVEAL_ANALYTICS_PATH}?userRef=${encodeURIComponent(row.userRef)}`}
              className="flex w-full items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-500/20"
            >
              <span>상품 열람/원문 클릭 내역</span>
              <span>↗</span>
            </Link>
          </div>

          {/* block toggle */}
          <div>
            <div className="mb-1 text-xs font-black text-zinc-400">계정 처리</div>
            <button
              type="button" disabled={pending} onClick={onToggleBlock}
              className={`w-full rounded-2xl border px-4 py-3 text-sm font-black transition disabled:opacity-40 ${
                isBlocked
                  ? "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  : "border-zinc-700 bg-zinc-900 text-rose-300 hover:bg-rose-950/40"
              }`}
            >{isBlocked ? "차단 해제" : "계정 차단"}</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ProfilePhotoModal({ row, onClose }: { row: MemberRow; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(true, onClose, panelRef);
  if (!row.profileImageUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="프로필 사진"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 font-mono backdrop-blur-sm"
    >
      <div
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
        className="w-full max-w-[520px] overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950 shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-black text-zinc-100">{row.nickname || row.email || "—"}</div>
            <div className="truncate text-xs text-zinc-400">{row.profileImageUrl}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-bold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
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
            className="rounded-sm border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-black uppercase tracking-wide text-blue-300 hover:border-blue-700"
          >
            OPEN ORIGINAL
          </a>
        </div>
      </div>
    </div>
  );
}
