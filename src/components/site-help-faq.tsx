"use client";

import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { HeadsetIcon, SendIcon } from "@/components/icons";
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

function isMatchingOptimisticMessage(current: SupportMessage, incoming: SupportMessage) {
  if (current.id >= 0) return false;
  if (current.sender !== incoming.sender) return false;
  if (current.sender !== "user") return false;
  if (current.body !== incoming.body) return false;
  if (current.conversation_id !== 0 && current.conversation_id !== incoming.conversation_id) return false;
  const currentTime = new Date(current.created_at).getTime();
  const incomingTime = new Date(incoming.created_at).getTime();
  if (!Number.isFinite(currentTime) || !Number.isFinite(incomingTime)) return true;
  return Math.abs(incomingTime - currentTime) <= 120_000;
}

function mergeSupportMessage(current: SupportMessage[], incoming: SupportMessage) {
  if (current.some((item) => item.id === incoming.id)) return current;
  let replaced = false;
  const next = current.map((item) => {
    if (!replaced && isMatchingOptimisticMessage(item, incoming)) {
      replaced = true;
      return incoming;
    }
    return item;
  });
  if (!replaced) next.push(incoming);
  return next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export default function SiteHelpFaq() {
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error" | "login">("idle");
  const [sendState, setSendState] = useState<"idle" | "sending" | "error">("idle");
  const [unreadCount, setUnreadCount] = useState(0);
  const titleId = useId();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastUnreadCountRef = useRef(0);
  const interactedRef = useRef(false);
  const authUserIdRef = useRef<string | null | undefined>(undefined);

  function resetChatState(nextState: "idle" | "loading" | "ready" | "error" | "login" = "idle") {
    setConversation(null);
    setMessages([]);
    setMessage("");
    setLoadState(nextState);
    setSendState("idle");
  }

  function playReplySound() {
    if (!interactedRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
      window.setTimeout(() => void ctx.close().catch(() => undefined), 260);
    } catch {
      // Browser autoplay policy can block audio. Badge still carries the notification.
    }
  }

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled || authUserIdRef.current !== undefined) return;
      authUserIdRef.current = data.user?.id ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (authUserIdRef.current !== undefined && authUserIdRef.current !== nextUserId) {
        setOpen(false);
        resetChatState("idle");
        setUnreadCount(0);
        lastUnreadCountRef.current = 0;
      }
      authUserIdRef.current = nextUserId;
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    async function loadUnreadStatus() {
      const res = await fetch("/api/support/chat/status", { cache: "no-store" }).catch(() => null);
      if (cancelled) return;
      if (!res?.ok) {
        if (res?.status === 401) setUnreadCount(0);
        return;
      }
      const data = (await res.json().catch(() => null)) as { unreadCount?: number } | null;
      const next = Math.max(0, Number(data?.unreadCount ?? 0));
      if (!open && next > lastUnreadCountRef.current) playReplySound();
      lastUnreadCountRef.current = next;
      setUnreadCount(next);
    }
    void loadUnreadStatus();
    const id = window.setInterval(loadUnreadStatus, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadChat() {
      setConversation(null);
      setMessages([]);
      setLoadState("loading");
      const res = await fetch("/api/support/chat", { cache: "no-store" }).catch(() => null);
      if (cancelled) return;
      if (!res) {
        setConversation(null);
        setMessages([]);
        setLoadState("error");
        return;
      }
      if (res.status === 401) {
        setConversation(null);
        setMessages([]);
        setLoadState("login");
        return;
      }
      const data = (await res.json().catch(() => null)) as { conversation?: SupportConversation; messages?: SupportMessage[] } | null;
      if (!res.ok || !data?.conversation) {
        setConversation(null);
        setMessages([]);
        setLoadState("error");
        return;
      }
      const scopedMessages = (data.messages ?? []).filter(
        (item) =>
          item.conversation_id === data.conversation!.id &&
          item.auth_user_id === data.conversation!.auth_user_id,
      );
      setConversation(data.conversation);
      setMessages(scopedMessages);
      setUnreadCount(0);
      lastUnreadCountRef.current = 0;
      setLoadState("ready");
      void fetch("/api/support/chat/read", { method: "POST" }).catch(() => undefined);
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
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const next = payload.new as SupportMessage;
          if (next.conversation_id !== conversation.id || next.auth_user_id !== conversation.auth_user_id) return;
          setMessages((current) => mergeSupportMessage(current, next));
          if (next.sender === "admin") {
            setUnreadCount(0);
            lastUnreadCountRef.current = 0;
            void fetch("/api/support/chat/read", { method: "POST" }).catch(() => undefined);
          }
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
      setMessages((current) => mergeSupportMessage(current.filter((item) => item.id !== optimisticId), data.message!));
    }
    setSendState("idle");
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (loadState !== "ready" || sendState === "sending" || !message.trim()) return;
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          interactedRef.current = true;
          resetChatState("loading");
          setOpen(true);
          setUnreadCount(0);
          lastUnreadCountRef.current = 0;
        }}
        aria-label="고객센터 열기"
        className="fixed bottom-[88px] right-4 z-[70] flex h-[52px] min-h-[52px] items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-[0_16px_42px_rgba(5,150,105,0.34)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 dark:border-emerald-300/20 dark:bg-emerald-500 dark:hover:bg-emerald-400 sm:bottom-5 sm:right-5"
      >
        <HeadsetIcon className="h-5 w-5" />
        <span className="hidden sm:inline">고객센터</span>
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1.5 text-[11px] font-black text-white shadow-[0_8px_20px_rgba(244,63,94,0.4)] dark:border-zinc-950">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button
            type="button"
            aria-label="고객센터 닫기"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <section className="absolute inset-x-0 bottom-0 flex h-[88dvh] max-h-[calc(100dvh-12px)] w-full flex-col overflow-hidden rounded-t-[28px] border border-emerald-100 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)] dark:border-zinc-800 dark:bg-zinc-950 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[620px] sm:max-h-[78vh] sm:w-[400px] sm:rounded-[24px]">
            <header className="border-b border-emerald-100 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-xs font-black text-white shadow-[0_10px_24px_rgba(5,150,105,0.24)]">
                    <HeadsetIcon className="h-5 w-5" />
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
                  onKeyDown={handleComposerKeyDown}
                  disabled={loadState !== "ready" || sendState === "sending"}
                  placeholder="문의 내용을 입력하세요. Enter 전송 · Shift+Enter 줄바꿈"
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
