"use client";

// Wave 182 (2026-05-17): 운영자 손해 신고 검수 client.

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type LossReportItem = {
  id: number;
  userRef: string;
  pid: number;
  // Wave 182c: feedback_type 구분 ('loss_report' 보류 | 'inaccurate_report' 박힘).
  feedbackType: "loss_report" | "inaccurate_report" | string;
  note: string;
  source: string;
  adminStatus: "pending" | "resolved" | "dismissed";
  adminResponseNote: string | null;
  adminRespondedAt: string | null;
  compensationGrantedTokens: number;
  createdAt: string;
  updatedAt: string;
  listing: {
    name: string | null;
    price: number | null;
    thumbnailUrl: string | null;
    bunjangUrl: string;
  } | null;
};

type Resp = {
  items: LossReportItem[];
  counts: { pending: number; resolved: number; dismissed: number; total: number };
};

type StatusFilter = "pending" | "resolved" | "dismissed" | "all";

function krw(value: number | null) {
  if (value == null) return "—";
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

function timeLabel(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function relAge(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const h = (Date.now() - t) / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)}분 전`;
  if (h < 24) return `${h.toFixed(1)}시간 전`;
  if (h >= 24) return `${(h / 24).toFixed(1)}일 전`;
  return "";
}

export default function LossReportsClient() {
  const [data, setData] = useState<Resp | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [responseDraft, setResponseDraft] = useState("");
  const [saving, setSaving] = useState(false);
  // Wave 198 (2026-05-17): keyboard shortcut state.
  const [focusedIdx, setFocusedIdx] = useState<number>(0);  // 현재 focus 신고 index (filter 적용 후)
  const [helpOpen, setHelpOpen] = useState(false);
  const articleRefs = useRef<Map<number, HTMLElement>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Wave 198b (2026-05-18): 첫 진입 자동 도움말 — localStorage 로 1회만 표시.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem("minyoi.admin.lossReports.shortcutSeen");
    if (!seen) {
      setHelpOpen(true);
      window.localStorage.setItem("minyoi.admin.lossReports.shortcutSeen", "1");
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/loss-reports?status=${filter}&limit=200`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`status_${res.status}`);
      const json = (await res.json()) as Resp;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void fetchList(); }, [fetchList]);

  async function updateStatus(item: LossReportItem, newStatus: "resolved" | "dismissed", noteOverride?: string) {
    setSaving(true);
    try {
      const note = noteOverride ?? responseDraft;
      const res = await fetch("/api/admin/loss-reports", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          adminStatus: newStatus,
          adminResponseNote: note,
        }),
      });
      if (!res.ok) throw new Error(`patch_status_${res.status}`);
      setEditingId(null);
      setResponseDraft("");
      await fetchList();
    } catch (err) {
      alert(`업데이트 실패: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setSaving(false);
    }
  }

  // Wave 198 (2026-05-17): keyboard shortcut — 운영자 검수 속도 ↑.
  // j/k navigate, e edit response, r approve+grant, d dismiss, Esc cancel, ? help.
  const filteredItems = data?.items.filter((i) => filter === "all" || i.adminStatus === filter) ?? [];

  useEffect(() => {
    // filter 변경 시 focus reset
    setFocusedIdx(0);
  }, [filter]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // 입력 중 (textarea/input focused) 일 때 Esc 외 무시.
      const target = e.target as HTMLElement | null;
      const inInput = target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT");
      if (inInput && e.key !== "Escape") return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (editingId != null) {
          setEditingId(null);
          setResponseDraft("");
        } else if (helpOpen) {
          setHelpOpen(false);
        }
        return;
      }
      if (filteredItems.length === 0) return;
      const current = filteredItems[focusedIdx] ?? filteredItems[0];

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(filteredItems.length - 1, i + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "e" && current) {
        e.preventDefault();
        setEditingId(current.id);
        setResponseDraft(current.adminResponseNote ?? "");
        // 다음 tick 에 textarea focus
        setTimeout(() => textareaRef.current?.focus(), 0);
      } else if (e.key === "r" && current && !saving) {
        e.preventDefault();
        // 응답 textarea 박혀있고 draft 5자+ → 승인 + 토큰 지급.
        if (editingId === current.id && responseDraft.trim().length >= 5) {
          void updateStatus(current, "resolved");
        } else {
          // 응답 안 박혀있으면 e (edit) 먼저 권장.
          setEditingId(current.id);
          setResponseDraft(current.adminResponseNote ?? "");
          setTimeout(() => textareaRef.current?.focus(), 0);
        }
      } else if (e.key === "d" && current && !saving) {
        e.preventDefault();
        // 기각 — 응답 없어도 OK (운영자가 의도적으로 기각).
        if (window.confirm(`pid ${current.pid} 신고 기각?`)) {
          void updateStatus(current, "dismissed", responseDraft);
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems, focusedIdx, editingId, responseDraft, saving, helpOpen]);

  // focused 신고 scroll into view
  useEffect(() => {
    if (filteredItems.length === 0) return;
    const item = filteredItems[focusedIdx];
    if (!item) return;
    const el = articleRefs.current.get(item.id);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedIdx, filteredItems]);

  return (
    <div className="space-y-4">
      {/* Wave 198b (2026-05-18): 상단 항상 보이는 단축키 hint banner. */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] dark:border-blue-900/40 dark:bg-blue-950/30">
        <div className="flex flex-wrap items-center gap-2 text-blue-900 dark:text-blue-100">
          <span className="font-black">⌨️ 키보드 단축키:</span>
          <kbd className="rounded border border-blue-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold dark:border-blue-800 dark:bg-zinc-900">j</kbd>
          <span>다음</span>
          <kbd className="rounded border border-blue-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold dark:border-blue-800 dark:bg-zinc-900">k</kbd>
          <span>이전</span>
          <kbd className="rounded border border-blue-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold dark:border-blue-800 dark:bg-zinc-900">e</kbd>
          <span>응답</span>
          <kbd className="rounded border border-blue-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold dark:border-blue-800 dark:bg-zinc-900">r</kbd>
          <span>승인/지급</span>
          <kbd className="rounded border border-blue-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold dark:border-blue-800 dark:bg-zinc-900">d</kbd>
          <span>기각</span>
          <kbd className="rounded border border-blue-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold dark:border-blue-800 dark:bg-zinc-900">?</kbd>
          <span>도움말</span>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-black text-white hover:bg-blue-700"
        >
          자세히 보기
        </button>
      </div>

      {/* 상단 stats + filter */}
      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "resolved", "dismissed", "all"] as StatusFilter[]).map((s) => {
          const count = s === "all" ? data?.counts.total : data?.counts[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                filter === s
                  ? "bg-[var(--brand-accent-strong)] text-[var(--brand-cream)]"
                  : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              {s === "pending" ? "⏳ 검토 대기" : s === "resolved" ? "✅ 승인/지급" : s === "dismissed" ? "❌ 기각" : "전체"}
              {count != null && (
                <span className="ml-1.5 rounded-full bg-white/30 px-1.5 py-0.5 text-[10px]">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          불러오는 중...
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          에러: {error}
        </div>
      )}
      {data && !loading && data.items.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          {filter === "pending" ? "검토 대기 중인 신고가 없어요." : "이 필터에 해당하는 신고가 없어요."}
        </div>
      )}

      {filteredItems.map((item, idx) => {
        const isPending = item.adminStatus === "pending";
        const isEditing = editingId === item.id;
        const isFocused = idx === focusedIdx;
        return (
          <article
            key={item.id}
            ref={(el) => {
              if (el) articleRefs.current.set(item.id, el);
              else articleRefs.current.delete(item.id);
            }}
            onClick={() => setFocusedIdx(idx)}
            className={`cursor-pointer rounded-xl border-2 bg-white p-4 shadow-sm transition dark:bg-zinc-900 ${
              isFocused ? "ring-2 ring-blue-400 dark:ring-blue-500" : ""
            } ${
              isPending
                ? "border-rose-300 dark:border-rose-900/60"
                : item.adminStatus === "resolved"
                  ? "border-emerald-200 dark:border-emerald-900/60"
                  : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex gap-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                {item.listing?.thumbnailUrl ? (
                  <Image
                    src={item.listing.thumbnailUrl}
                    alt={item.listing.name ?? ""}
                    fill
                    sizes="80px"
                    unoptimized
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Wave 182c: feedback_type 구분 chip */}
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                        item.feedbackType === "inaccurate_report"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                      }`}>
                        {item.feedbackType === "inaccurate_report" ? "🔍 정보 오류" : "🚨 손해 신고"}
                      </span>
                    </div>
                    <div className="line-clamp-2 mt-1 text-sm font-black text-zinc-900 dark:text-zinc-100">
                      {item.listing?.name ?? `pid ${item.pid}`}
                    </div>
                    <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono">pid {item.pid}</span>
                      {item.listing?.price != null && <> · 매입 {krw(item.listing.price)}</>}
                      <> · 신고 {timeLabel(item.createdAt)} ({relAge(item.createdAt)})</>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${
                        item.adminStatus === "pending"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                          : item.adminStatus === "resolved"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                      }`}
                    >
                      {item.adminStatus === "pending" ? "⏳ 검토 대기" : item.adminStatus === "resolved" ? "✅ 승인/지급" : "❌ 기각"}
                    </span>
                    {item.compensationGrantedTokens > 0 && (
                      <div className="mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        🪙 +{item.compensationGrantedTokens}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-[12px] leading-relaxed text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200">
                  <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    사용자 신고
                  </div>
                  {item.note}
                </div>
                <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                  user: <span className="font-mono">{item.userRef.slice(0, 12)}...</span>
                  {item.listing?.bunjangUrl && (
                    <>
                      {" · "}
                      <a
                        href={item.listing.bunjangUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        🔗 번장 열기
                      </a>
                    </>
                  )}
                </div>

                {/* 운영자 응답 */}
                {item.adminResponseNote && !isEditing && (
                  <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[12px] leading-relaxed text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <div className="mb-1 text-[10px] font-black uppercase tracking-wider">
                      운영자 응답 ({item.adminRespondedAt ? timeLabel(item.adminRespondedAt) : "—"})
                    </div>
                    {item.adminResponseNote}
                  </div>
                )}

                {/* 검수 버튼 / 응답 입력 */}
                {isEditing ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      ref={(el) => { if (isEditing) textareaRef.current = el; }}
                      value={responseDraft}
                      onChange={(e) => setResponseDraft(e.target.value)}
                      placeholder="예: 위험 신호 (배터리 미공개 + 시세 -40%) 시스템이 놓침. 알고리즘 보정 완료. 비슷한 매물 N건 미리 차단됨."
                      rows={4}
                      className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-900 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                      maxLength={2000}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditingId(null); setResponseDraft(""); }}
                        disabled={saving}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(item, "dismissed")}
                        disabled={saving}
                        className="rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      >
                        기각
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(item, "resolved")}
                        disabled={saving || responseDraft.trim().length < 5}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        ✅ 승인하고 토큰 지급
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setResponseDraft(item.adminResponseNote ?? "");
                      }}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
                    >
                      {item.adminResponseNote ? "응답 수정" : "응답 입력"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      })}

      {/* Wave 198: keyboard shortcut floating button + help modal. */}
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-black text-white shadow-lg hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        title="단축키 (?)"
        aria-label="키보드 단축키 보기"
      >
        ?
      </button>
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setHelpOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">⌨️ 키보드 단축키</h3>
              <button type="button" onClick={() => setHelpOpen(false)} className="text-sm text-zinc-500 hover:text-zinc-700">닫기 ✕</button>
            </div>
            <div className="space-y-1.5 text-[12px]">
              {[
                ["j / ↓", "다음 신고로"],
                ["k / ↑", "이전 신고로"],
                ["e", "응답 입력 (textarea focus)"],
                ["r", "✅ 승인 + 토큰 지급 (응답 5자+ 입력 후)"],
                ["d", "❌ 기각 (confirm 박힘)"],
                ["Esc", "응답 입력 취소 / 모달 닫기"],
                ["?", "단축키 도움말 toggle"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-baseline gap-3">
                  <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {key}
                  </kbd>
                  <span className="text-zinc-700 dark:text-zinc-300">{desc}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-zinc-200 pt-2 text-[10px] text-zinc-500 dark:border-zinc-700">
              현재 focus 신고 = 파란 ring. 클릭으로도 focus 변경 가능.
              textarea 입력 중에는 Esc 외 단축키 비활성 (입력 우선).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
