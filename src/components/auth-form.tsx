"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

// Wave 93b: 로그인 후 redirect — ?next= 파라미터 안전 처리.
// 외부 URL/오픈 리다이렉트 방지: 반드시 "/"로 시작하고 "//" 또는 "://" 포함 금지.
function safeNextPath(raw: string | null): string {
  if (!raw) return "/me";
  if (!raw.startsWith("/")) return "/me";
  if (raw.startsWith("//")) return "/me";
  if (raw.includes("://")) return "/me";
  return raw;
}

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

// Wave 104: auth callback 실패 메시지 한국어 매핑.
function authErrorMessage(authParam: string | null): string | null {
  if (!authParam) return null;
  switch (authParam) {
    case "missing-code":
      return "카카오 로그인이 취소되었거나 인증 코드를 받지 못했어요. 다시 시도해주세요.";
    case "missing-env":
      return "사이트 설정 문제로 로그인할 수 없어요. 잠시 후 다시 시도해주세요.";
    case "exchange-failed":
      return "로그인 처리 중 오류가 났어요. 한 번 더 시도해주세요.";
    default:
      return null;
  }
}

export default function AuthForm({ mode }: Props) {
  const supabase = getSupabaseBrowserClient();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const hasSupabasePublicEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const isSignup = mode === "signup";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(() => authErrorMessage(searchParams.get("auth")));

  async function signInWithKakao() {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
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

      {/* FAQ: 왜 카카오만 받나 — 본인 인증 + 한정 수량 분배 정책 */}
      <details className="mt-5 rounded-xl border border-[#e7dece] bg-[#fffaf1] px-4 py-3 text-sm font-semibold text-[#5a6658] dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
        <summary className="cursor-pointer text-[13px] font-black text-[#344136] dark:text-zinc-100">
          카카오 외 다른 로그인은 안 되나요?
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-6">
          <p>
            미뇨이는 <strong className="font-black">엄선한 리셀 중고 제품을 하루 정해진 수량만</strong> 추천합니다.
            누구나 만들 수 있는 구글·이메일 계정으로는 한 명이 여러 계정을 만들어 추천 매물을 독점할 수 있어
            다른 사용자에게 돌아가는 기회가 줄어듭니다.
          </p>
          <p>
            그래서 본인 인증이 가능한 카카오 계정만 받고 있습니다. 카카오 이외 가입 수단을 막아야
            <strong className="font-black"> 공정한 분배</strong>가 가능해서 양해 부탁드립니다.
          </p>
        </div>
      </details>
    </div>
  );
}
