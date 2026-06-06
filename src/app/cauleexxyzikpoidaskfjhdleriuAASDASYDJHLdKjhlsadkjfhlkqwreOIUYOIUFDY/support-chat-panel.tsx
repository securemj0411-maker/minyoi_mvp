"use client";

import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useState } from "react";

import { Button, Notice } from "./_ui/primitives";

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
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function conversationName(row: SupportConversation) {
  return row.user_display_name || row.user_email || `상담 #${row.id}`;
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
  const openCount = rows.filter((row) => row.status === "open").length;
  const unreadCount = rows.reduce((sum, row) => sum + Number(row.admin_unread_count ?? 0), 0);

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
    })
      .then(() => {
        setRows((current) =>
          current.map((row) =>
            row.id === selectedConversationId
              ? { ...row, admin_unread_count: 0 }
              : row,
          ),
        );
      })
      .catch(() => undefined);
  }, [selectedConversationId, selectedAdminUnreadCount]);

  async function sendReply(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
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
    setNotice("답장을 보냈어요. 사용자 고객센터 버튼에 안 읽은 표시가 뜹니다.");
    await load();
  }

  function handleReplyKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (replying || !reply.trim()) return;
    void sendReply();
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
      setNotice("상담 상태 변경 실패");
      return;
    }
    await load();
  }

  return (
    <section className="mb-5 overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
      <div className="border-b border-zinc-800 bg-zinc-900/70 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
              고객상담
            </div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white">1대1 상담 채팅</h2>
            <p className="mt-1 text-sm font-bold leading-6 text-zinc-400">
              사용자가 우하단 고객센터에서 보낸 메시지입니다. 답장하면 사용자 버튼에 안 읽은 표시가 뜹니다.
            </p>
          </div>
          <div className="flex gap-2">
            <StatusBadge label="열린 상담" value={openCount} />
            <StatusBadge label="새 메시지" value={unreadCount} hot={unreadCount > 0} />
            <Button variant="subtle" size="lg" onClick={() => void load()}>
              {loading ? "불러오는 중" : "새로고침"}
            </Button>
          </div>
        </div>
      </div>

      {notice ? (
        <Notice tone="emerald" className="mx-5 mt-4">
          {notice}
        </Notice>
      ) : null}

      <div className="grid min-h-[580px] gap-0 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="border-b border-zinc-800 lg:border-b-0 lg:border-r">
          {rows.length === 0 ? (
            <div className="p-5 text-sm font-bold text-zinc-500">아직 상담이 없습니다.</div>
          ) : (
            <div className="max-h-[580px] overflow-y-auto">
              {rows.map((row) => {
                const active = selected?.id === row.id;
                const last = row.messages[row.messages.length - 1];
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`block w-full border-b border-zinc-900 px-4 py-4 text-left transition ${
                      active ? "bg-emerald-500/10" : "hover:bg-zinc-900/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 truncate text-sm font-black text-zinc-100">
                        {conversationName(row)}
                      </div>
                      {row.admin_unread_count > 0 ? (
                        <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-xs font-black text-zinc-950">
                          {row.admin_unread_count}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 truncate text-xs font-bold text-zinc-500">{row.user_email || "-"}</div>
                    <div className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-zinc-300">
                      {last?.body ?? "대화 없음"}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-bold text-zinc-400">
                      <span>{row.status === "open" ? "진행 중" : "종료"}</span>
                      <span>{dateLabel(row.last_message_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div className="flex min-h-0 flex-col bg-zinc-950">
          {selected ? (
            <>
              <header className="border-b border-zinc-800 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-zinc-50">{conversationName(selected)}</div>
                    <div className="mt-1 text-sm font-bold text-zinc-500">{selected.user_email || "-"}</div>
                  </div>
                  <Button variant="subtle" onClick={() => void toggleStatus()}>
                    {selected.status === "open" ? "상담 종료" : "다시 열기"}
                  </Button>
                </div>
              </header>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-zinc-950 px-5 py-5">
                {selected.messages.map((message) => {
                  const fromAdmin = message.sender === "admin";
                  return (
                    <div key={message.id} className={`flex ${fromAdmin ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[78%] rounded-3xl px-4 py-3 text-sm font-semibold leading-6 shadow-sm ${
                          fromAdmin
                            ? "rounded-tr-md bg-emerald-500 text-white"
                            : "rounded-tl-md bg-zinc-900 text-zinc-100 ring-1 ring-zinc-800"
                        }`}
                      >
                        <div className={`mb-1 text-xs font-black ${fromAdmin ? "text-emerald-50" : "text-zinc-500"}`}>
                          {fromAdmin ? message.admin_name || "상담원" : "사용자"} · {dateLabel(message.created_at)}
                        </div>
                        <div className="whitespace-pre-wrap break-words">{message.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={sendReply} className="border-t border-zinc-800 bg-zinc-900/70 p-4">
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  onKeyDown={handleReplyKeyDown}
                  placeholder="상담원 답변 입력 · Enter 전송 · Shift+Enter 줄바꿈"
                  className="min-h-24 w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10"
                />
                <div className="mt-3 flex justify-end">
                  <Button type="submit" variant="approve" size="lg" disabled={replying || !reply.trim()}>
                    {replying ? "전송 중" : "상담원으로 답장"}
                  </Button>
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

function StatusBadge({ label, value, hot = false }: { label: string; value: number; hot?: boolean }) {
  return (
    <div className={`min-w-[92px] rounded-2xl border px-3 py-2 text-center ${
      hot
        ? "border-emerald-300/30 bg-emerald-400/14 text-emerald-100"
        : "border-zinc-700 bg-zinc-900 text-zinc-100"
    }`}>
      <div className="text-xl font-black tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs font-black text-white/58">{label}</div>
    </div>
  );
}
