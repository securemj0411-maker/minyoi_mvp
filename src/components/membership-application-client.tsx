"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ApplyState = "idle" | "submitting" | "sent" | "error";

export default function MembershipApplicationClient({
  isAuthed,
  isMember,
  loginHref,
}: {
  isAuthed: boolean;
  isMember: boolean;
  loginHref: string;
}) {
  const [state, setState] = useState<ApplyState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (isMember) {
    return (
      <Link
        href="/me"
        className="flex h-11 min-w-[148px] items-center justify-center rounded-xl bg-[var(--brand-accent-strong)] px-4 text-[13px] font-black text-[var(--brand-cream)] shadow-[0_10px_22px_rgba(49,130,246,0.22)] transition hover:opacity-90"
      >
        이미 승인됨
      </Link>
    );
  }

  if (!isAuthed) {
    return (
      <Link
        href={loginHref}
        className="flex h-11 min-w-[172px] items-center justify-center rounded-xl bg-[var(--brand-accent-strong)] px-4 text-[13px] font-black text-[var(--brand-cream)] shadow-[0_10px_22px_rgba(49,130,246,0.22)] transition hover:opacity-90"
      >
        로그인하고 신청하기
      </Link>
    );
  }

  async function submitApplication() {
    if (state === "submitting" || state === "sent") return;
    setState("submitting");
    setMessage(null);

    const supabase = getSupabaseBrowserClient();
    const { data } = supabase ? await supabase.auth.getSession() : { data: null };
    const token = data?.session?.access_token;
    if (!token) {
      setState("error");
      setMessage("로그인 세션을 다시 확인해주세요.");
      return;
    }

    const res = await fetch("/api/membership/apply", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "plans" }),
    }).catch(() => null);

    if (!res?.ok) {
      setState("error");
      setMessage("신청 접수가 실패했어요. 잠시 후 다시 눌러주세요.");
      return;
    }
    const payload = (await res.json().catch(() => null)) as { telegramSent?: boolean } | null;
    setState("sent");
    setMessage(payload?.telegramSent === false
      ? "신청은 접수됐어요. 운영자 알림은 확인 중이라, 필요하면 카톡으로도 알려주세요."
      : "신청이 접수됐어요. 운영자가 확인하고 안내할게요.");
  }

  return (
    <div className="min-w-[172px]">
      <button
        type="button"
        onClick={submitApplication}
        disabled={state === "submitting" || state === "sent"}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-accent-strong)] px-4 text-[13px] font-black text-[var(--brand-cream)] shadow-[0_10px_22px_rgba(49,130,246,0.22)] transition hover:opacity-90 disabled:cursor-default disabled:opacity-70"
      >
        {state === "submitting" ? "신청 접수 중" : state === "sent" ? "신청 완료" : "신청하기"}
      </button>
      {message ? (
        <p className={`mt-2 break-keep text-[11px] font-bold leading-4 ${state === "error" ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
