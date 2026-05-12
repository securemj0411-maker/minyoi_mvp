"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AuthMode = "login" | "signup";

type Props = {
  mode: AuthMode;
};

function KakaoIcon() {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#191600]" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#fee500]" fill="currentColor">
        <path d="M12 4C6.9 4 2.8 7.2 2.8 11.2c0 2.6 1.8 4.9 4.5 6.1l-.7 2.6c-.1.4.3.7.6.5l3.1-2.1c.5.1 1.1.1 1.7.1 5.1 0 9.2-3.2 9.2-7.2S17.1 4 12 4Z" />
      </svg>
    </span>
  );
}

export default function AuthForm({ mode }: Props) {
  const supabase = getSupabaseBrowserClient();
  const hasSupabasePublicEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const isSignup = mode === "signup";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function signInWithKakao() {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=/me`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo,
        scopes: "profile_nickname profile_image",
      },
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  if (!hasSupabasePublicEnv) {
    return (
      <div className="rounded-[28px] border border-[#ddd4c7] bg-[#fffbf4] p-5 text-sm font-bold text-[#5a6658] shadow-[0_18px_40px_rgba(34,49,39,0.08)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        Supabase 공개 anon key가 필요해요. `.env.local`의 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 확인하세요.
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-[32px] border border-[#ddd4c7] bg-[#fffbf4] p-6 shadow-[0_20px_48px_rgba(34,49,39,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-[#5d735f] dark:text-emerald-400">
          Minyoi Account
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-[#223127] dark:text-white">
          {isSignup ? "카카오로 시작하기" : "로그인"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#5a6658] dark:text-zinc-400">
          {isSignup
            ? "한국 사용자 기준으로 카카오 계정만 받아요. 첫 로그인 때 무료 크레딧이 1회 지급됩니다."
            : "카카오 계정으로 추천 상품과 피드백 기록을 이어서 봅니다."}
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={signInWithKakao}
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#fee500] px-4 text-sm font-black text-[#191600] shadow-sm transition hover:bg-[#f6dc00] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          <KakaoIcon />
          {busy ? "카카오로 이동 중" : "카카오로 시작하기"}
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-xl bg-[var(--brand-accent-soft)] px-3 py-2 text-xs font-bold text-[#445247] dark:bg-zinc-800 dark:text-zinc-300">
          {message}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between text-xs">
        <Link href="/" className="font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
          홈으로 돌아가기
        </Link>
        <span className="font-bold text-zinc-400">이메일 가입 중단</span>
      </div>
    </div>
  );
}
