"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";

import { SendIcon } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type SupportConversation = {
  id: number;
  auth_user_id: string;
  user_unread_count: number;
  last_message_at: string;
};

type SupportMessage = {
  id: number;
  conversation_id: number;
  auth_user_id: string;
  sender: "user" | "admin" | "system";
  body: string;
  admin_name: string | null;
  created_at: string;
};

function timeLabel(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export default function SiteHelpFaq() {
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error" | "login">("idle");
  const [sendState, setSendState] = useState<"idle" | "sending" | "error">("idle");
  const titleId = useId();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadChat() {
      setLoadState("loading");
      const res = await fetch("/api/support/chat", { cache: "no-store" }).catch(() => null);
      if (cancelled) return;
      if (!res) {
        setLoadState("error");
        return;
      }
      if (res.status === 401) {
        setLoadState("login");
        return;
      }
      const data = (await res.json().catch(() => null)) as { conversation?: SupportConversation; messages?: SupportMessage[] } | null;
      if (!res.ok || !data?.conversation) {
        setLoadState("error");
        return;
      }
      setConversation(data.conversation);
      setMessages(data.messages ?? []);
      setLoadState("ready");
    }
    void loadChat();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !conversation) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`support-chat:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mvp_support_messages",
          filter: `auth_user_id=eq.${conversation.auth_user_id}`,
        },
        (payload) => {
          const next = payload.new as SupportMessage;
          if (next.conversation_id !== conversation.id) return;
          setMessages((current) => current.some((item) => item.id === next.id) ? current : [...current, next]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, conversation]);

  useEffect(() => {
    if (!open) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [open, messages.length]);

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = message.trim();
    if (!body) return;
    setSendState("sending");
    setMessage("");
    const optimisticId = -Date.now();
    const optimistic: SupportMessage = {
      id: optimisticId,
      conversation_id: conversation?.id ?? 0,
      auth_user_id: conversation?.auth_user_id ?? "",
      sender: "user",
      body,
      admin_name: null,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    const res = await fetch("/api/support/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: body }),
    }).catch(() => null);
    if (!res?.ok) {
      setSendState("error");
      setMessages((current) => current.filter((item) => item.id !== optimisticId));
      setMessage(body);
      return;
    }
    const data = (await res.json().catch(() => null)) as { conversation?: SupportConversation; message?: SupportMessage } | null;
    if (data?.conversation) setConversation(data.conversation);
    if (data?.message) {
      setMessages((current) => [
        ...current.filter((item) => item.id !== optimisticId && item.id !== data.message?.id),
        data.message!,
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    }
    setSendState("idle");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="고객센터 열기"
        className="fixed bottom-4 right-4 z-[70] flex h-[52px] min-h-[52px] items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-[0_16px_42px_rgba(5,150,105,0.34)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 dark:border-emerald-300/20 dark:bg-emerald-500 dark:hover:bg-emerald-400 sm:bottom-5 sm:right-5"
      >
        <SendIcon className="h-5 w-5" />
        <span className="hidden sm:inline">고객센터</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button
            type="button"
            aria-label="고객센터 닫기"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <section className="absolute bottom-0 right-0 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-emerald-100 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)] dark:border-zinc-800 dark:bg-zinc-950 sm:bottom-5 sm:right-5 sm:h-[620px] sm:max-h-[78vh] sm:w-[400px] sm:rounded-[24px]">
            <header className="border-b border-emerald-100 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-xs font-black text-white shadow-[0_10px_24px_rgba(5,150,105,0.24)]">
                    상담
                    <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-300 dark:border-zinc-950" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Customer Center</p>
                    <h2 id={titleId} className="mt-0.5 text-lg font-black text-zinc-950 dark:text-zinc-100">
                      1대1 고객상담
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-black text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  닫기
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12px] font-bold text-zinc-500 dark:text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]" />
                상담원 연결 · 평균 5분 내 회신
              </div>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-4 py-3 dark:bg-zinc-950">
              {loadState === "loading" || loadState === "idle" ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  상담 내역을 불러오는 중...
                </div>
              ) : loadState === "login" ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/20">
                  <div className="text-sm font-black text-zinc-950 dark:text-zinc-100">로그인 후 상담할 수 있어요</div>
                  <p className="mt-1 text-[12px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
                    멤버십, 입금 확인, 매물 이용 내역을 같이 확인해야 해서 로그인 상담으로 운영합니다.
                  </p>
                  <a href="/login" className="mt-3 flex h-10 items-center justify-center rounded-xl bg-zinc-950 text-xs font-black text-white dark:bg-white dark:text-zinc-950">
                    로그인하기
                  </a>
                </div>
              ) : loadState === "error" ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600 dark:border-rose-900/70 dark:bg-rose-950/20 dark:text-rose-300">
                  상담창을 불러오지 못했어요. 잠시 후 다시 열어주세요.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="max-w-[84%] rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                    <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-300">상담원</div>
                    <p className="mt-1 text-[13px] font-semibold leading-5 text-zinc-700 dark:text-zinc-200">
                      안녕하세요. 궁금한 점을 남겨주시면 평균 5분 내로 확인해서 답변드릴게요.
                    </p>
                  </div>
                  {messages.map((item) => {
                    const fromUser = item.sender === "user";
                    return (
                      <div key={item.id} className={`flex ${fromUser ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[84%] rounded-2xl px-3 py-2.5 shadow-sm ${
                          fromUser
                            ? "rounded-tr-sm bg-emerald-600 text-white"
                            : "rounded-tl-sm bg-white text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800"
                        }`}>
                          {!fromUser ? (
                            <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-300">
                              {item.admin_name || "상담원"}
                            </div>
                          ) : null}
                          <p className="whitespace-pre-wrap break-words text-[13px] font-semibold leading-5">{item.body}</p>
                          <div className={`mt-1 text-right text-[10px] font-bold ${fromUser ? "text-emerald-100" : "text-zinc-400"}`}>
                            {timeLabel(item.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <form onSubmit={submitMessage} className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              {sendState === "error" ? (
                <p className="mb-2 text-[11px] font-bold text-rose-500">전송 실패. 네트워크를 확인하고 다시 보내주세요.</p>
              ) : null}
              <div className="flex items-end gap-2">
                <textarea
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    if (sendState === "error") setSendState("idle");
                  }}
                  disabled={loadState !== "ready" || sendState === "sending"}
                  placeholder="문의 내용을 입력하세요"
                  rows={1}
                  className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm font-semibold leading-5 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-950"
                />
                <button
                  type="submit"
                  disabled={loadState !== "ready" || sendState === "sending" || !message.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-[0_10px_22px_rgba(5,150,105,0.22)] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
                  aria-label="상담 메시지 보내기"
                >
                  <SendIcon className="h-4 w-4" />
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
