"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type SupportMessage = {
  id: number;
  conversation_id: number;
  sender: "user" | "admin" | "system";
  body: string;
  admin_name: string | null;
  created_at: string;
};

type SupportConversation = {
  id: number;
  user_email: string | null;
  user_display_name: string | null;
  status: "open" | "closed";
  admin_unread_count: number;
  user_unread_count: number;
  last_message_at: string;
  created_at: string;
  messages: SupportMessage[];
};

function dateLabel(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function SupportChatPanel() {
  const [rows, setRows] = useState<SupportConversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [replying, setReplying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null,
    [rows, selectedId],
  );
  const selectedConversationId = selected?.id ?? null;
  const selectedAdminUnreadCount = selected?.admin_unread_count ?? 0;

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/support/list", { cache: "no-store" }).catch(() => null);
    setLoading(false);
    if (!res?.ok) {
      setNotice("고객센터 상담을 불러오지 못했어요.");
      return;
    }
    const data = (await res.json().catch(() => null)) as { conversations?: SupportConversation[] } | null;
    const next = data?.conversations ?? [];
    setRows(next);
    setSelectedId((current) => current ?? next[0]?.id ?? null);
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedConversationId || selectedAdminUnreadCount <= 0) return;
    void fetch("/api/admin/support/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: selectedConversationId }),
    }).then(() => {
      setRows((current) => current.map((row) => row.id === selectedConversationId ? { ...row, admin_unread_count: 0 } : row));
    }).catch(() => undefined);
  }, [selectedConversationId, selectedAdminUnreadCount]);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setReplying(true);
    setNotice(null);
    const body = reply.trim();
    setReply("");
    const res = await fetch("/api/admin/support/reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: selected.id, message: body }),
    }).catch(() => null);
    setReplying(false);
    if (!res?.ok) {
      setReply(body);
      setNotice("답장 전송 실패");
      return;
    }
    setNotice("답장 전송 완료");
    await load();
  }

  async function toggleStatus() {
    if (!selected) return;
    const nextStatus = selected.status === "open" ? "closed" : "open";
    const res = await fetch("/api/admin/support/list", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: selected.id, status: nextStatus }),
    }).catch(() => null);
    if (!res?.ok) {
      setNotice("상태 변경 실패");
      return;
    }
    await load();
  }

  return (
    <section className="mb-4 rounded-sm border border-emerald-800 bg-zinc-950/80 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">▌CUSTOMER CENTER</div>
          <h2 className="mt-1 text-lg font-black text-zinc-50">1대1 고객상담</h2>
          <p className="mt-1 text-[11px] font-bold text-zinc-500">사용자가 우하단 고객센터에서 남긴 채팅입니다.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-sm border border-zinc-700 px-3 py-2 text-[11px] font-black text-zinc-200 hover:bg-zinc-900"
        >
          {loading ? "새로고침 중" : "새로고침"}
        </button>
      </div>

      {notice ? <div className="mb-3 rounded-sm bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-200">{notice}</div> : null}

      <div className="grid min-h-[420px] gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950">
          {rows.length === 0 ? (
            <div className="p-4 text-sm font-bold text-zinc-500">아직 상담이 없습니다.</div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              {rows.map((row) => {
                const active = selected?.id === row.id;
                const last = row.messages[row.messages.length - 1];
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`block w-full border-b border-zinc-900 px-3 py-3 text-left transition ${active ? "bg-emerald-950/35" : "hover:bg-zinc-900/80"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 text-sm font-black text-zinc-100">
                        {row.user_display_name || "이름 없음"}
                      </div>
                      {row.admin_unread_count > 0 ? (
                        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-zinc-950">
                          새 메시지 {row.admin_unread_count}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 truncate text-[11px] font-bold text-zinc-500">{row.user_email || "-"}</div>
                    <div className="mt-2 line-clamp-2 text-[12px] font-semibold leading-5 text-zinc-300">
                      {last?.body ?? "대화 없음"}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-zinc-600">
                      <span>{row.status}</span>
                      <span>{dateLabel(row.last_message_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col rounded-sm border border-zinc-800 bg-zinc-950">
          {selected ? (
            <>
              <div className="border-b border-zinc-800 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-black text-zinc-50">{selected.user_display_name || "이름 없음"}</div>
                    <div className="mt-1 text-[11px] font-bold text-zinc-500">{selected.user_email || "-"}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleStatus()}
                    className="rounded-sm border border-zinc-700 px-3 py-2 text-[11px] font-black text-zinc-200 hover:bg-zinc-900"
                  >
                    {selected.status === "open" ? "상담 종료" : "다시 열기"}
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
                {selected.messages.map((message) => {
                  const fromAdmin = message.sender === "admin";
                  return (
                    <div key={message.id} className={`flex ${fromAdmin ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-[13px] font-semibold leading-5 ${fromAdmin ? "bg-emerald-600 text-white" : "bg-zinc-900 text-zinc-100 ring-1 ring-zinc-800"}`}>
                        <div className="mb-1 text-[10px] font-black opacity-70">{fromAdmin ? (message.admin_name || "상담원") : "사용자"} · {dateLabel(message.created_at)}</div>
                        <div className="whitespace-pre-wrap break-words">{message.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={sendReply} className="border-t border-zinc-800 p-3">
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="상담원 답변 입력"
                  className="min-h-20 w-full resize-none rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-100 outline-none focus:border-emerald-500"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={replying || !reply.trim()}
                    className="rounded-sm bg-emerald-500 px-4 py-2 text-[12px] font-black text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {replying ? "전송 중" : "상담원으로 답장"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm font-bold text-zinc-500">상담을 선택하세요.</div>
          )}
        </div>
      </div>
    </section>
  );
}
