"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { translateSupabaseAuthError } from "@/lib/auth-error-messages";
import { KAKAO_LOGIN_SCOPES } from "@/lib/kakao";
import { flushPendingConsents, persistPendingConsents } from "@/lib/pending-consents";
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
// Wave 724 (2026-05-23): 카카오/Supabase 가 보내는 OAuth error param 분기 추가.
//   이전엔 "missing-code" 한 case 라 사용자 취소(access_denied)와 DB 에러를 같은 메시지로 묶었음.
function authErrorMessage(authParam: string | null): string | null {
  if (!authParam) return null;
  switch (authParam) {
    case "missing-code":
      return "카카오 로그인이 취소되었거나 인증 코드를 받지 못했어요. 다시 시도해주세요.";
    case "missing-env":
      return "사이트 설정 문제로 로그인할 수 없어요. 잠시 후 다시 시도해주세요.";
    case "exchange-failed":
      return "로그인 처리 중 오류가 났어요. 한 번 더 시도해주세요.";
    case "oauth-denied":
      return "카카오 로그인이 취소됐어요. 다시 시도해주세요.";
    case "oauth-db-error":
      return "가입 처리 중 오류가 났어요. 잠시 후 다시 시도하거나 운영자에게 문의해주세요.";
    case "oauth-rate-limit":
      return "잠시 후 다시 시도해주세요. (보안을 위해 잠깐 차단됐어요)";
    case "oauth-error":
      return "카카오 로그인 중 오류가 났어요. 다시 시도하거나 이메일로 가입해주세요.";
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
  // Wave 180 (2026-05-17): 이메일 가입/로그인 항상 노출 (env 토글 제거).
  // prod (Vercel) 에서도 바로 보임 — 운영자 테스트 편의 우선.
  const isSignup = mode === "signup";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(() => authErrorMessage(searchParams.get("auth")));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  // Wave 198 (2026-05-18): 가입 동의 — 개인정보보호법 + 전자상거래법 + 청소년보호법 필수.
  //   필수 3개 (약관/개인정보/만14세) 동의 안 하면 가입 차단. 선택 1개 (마케팅).
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const allRequiredAgreed = agreeTerms && agreePrivacy && agreeAge;
  function toggleAll(next: boolean) {
    setAgreeTerms(next);
    setAgreePrivacy(next);
    setAgreeAge(next);
    setAgreeMarketing(next);
  }

  async function signInWithKakao() {
    if (!supabase || busy) return;
    // Wave 198 (2026-05-18): 가입 시 필수 동의 검증 (전자상거래법 + 개인정보보호법 + 청소년보호법).
    if (isSignup && !allRequiredAgreed) {
      setMessage("이용약관, 개인정보 수집·이용, 만 14세 이상 확인에 모두 동의해야 가입할 수 있어요.");
      return;
    }
    // Wave 199 (2026-05-19): 가입 시 동의 정보 localStorage 저장 → callback 후 API 호출 → DB 기록.
    if (isSignup) {
      persistPendingConsents({
        terms: agreeTerms,
        privacy: agreePrivacy,
        age_14: agreeAge,
        marketing: agreeMarketing,
      });
    }
    setBusy(true);
    setMessage(null);
    // Wave 733 (2026-05-24): 카카오 OAuth flow 중 쿠키 손실 가능성 fallback.
    //   middleware 쿠키만 의존하면 vercel.app → kakao → supabase → vercel.app redirect 시 손실 risk.
    //   URL ?ref= 또는 쿠키 둘 다에서 읽고 redirectTo 에 명시 전달 → callback 이 확실히 받음.
    let refCode: string | null = null;
    try {
      const urlRef = new URLSearchParams(window.location.search).get("ref");
      if (urlRef && /^[A-HJ-NP-Z2-9]{6}$/.test(urlRef.toUpperCase())) {
        refCode = urlRef.toUpperCase();
      } else {
        // cookie fallback
        const cookieMatch = document.cookie.match(/(?:^|;\s*)minyoi_referral=([A-HJ-NP-Z2-9]{6})/);
        if (cookieMatch) refCode = cookieMatch[1];
      }
    } catch {}
    const refParam = refCode ? `&ref=${refCode}` : "";
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}${refParam}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo,
        scopes: KAKAO_LOGIN_SCOPES,
      },
    });
    if (error) {
      // Wave 724: raw Supabase 영문 메시지 → 한글 mapping.
      console.error("[auth] kakao signInWithOAuth failed", error.message);
      setMessage(translateSupabaseAuthError(error.message));
      setBusy(false);
    }
  }

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || emailBusy) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setMessage("이메일과 비밀번호를 모두 입력하세요.");
      return;
    }
    if (password.length < 6) {
      setMessage("비밀번호는 6자 이상이어야 해요.");
      return;
    }
    // Wave 198 (2026-05-18): 가입 시 필수 동의 검증.
    if (isSignup && !allRequiredAgreed) {
      setMessage("이용약관, 개인정보 수집·이용, 만 14세 이상 확인에 모두 동의해야 가입할 수 있어요.");
      return;
    }
    // Wave 199 (2026-05-19): 가입 시 동의 정보 localStorage 저장.
    if (isSignup) {
      persistPendingConsents({
        terms: agreeTerms,
        privacy: agreePrivacy,
        age_14: agreeAge,
        marketing: agreeMarketing,
      });
    }
    setEmailBusy(true);
    setMessage(null);
    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) {
        // Wave 724: raw Supabase 영문 메시지 → 한글 mapping.
        console.error("[auth] signUp failed", error.message);
        setMessage(translateSupabaseAuthError(error.message));
        setEmailBusy(false);
        return;
      }
      if (data.session) {
        // Wave 199: 즉시 session 있으면 (autoConfirm) consent insert.
        await flushPendingConsents();
        window.location.href = nextPath;
        return;
      }
      // Wave 724: "Supabase 설정에 따라 자동 로그인" 같은 운영 내부 표현 제거. 사용자 행동만 안내.
      setMessage("가입 신청이 접수됐어요. 받은 이메일의 인증 링크를 눌러 로그인을 완료해주세요. 메일이 안 오면 스팸함도 확인해주세요.");
      setEmailBusy(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        // Wave 724: raw Supabase 영문 메시지 → 한글 mapping.
        console.error("[auth] signInWithPassword failed", error.message);
        setMessage(translateSupabaseAuthError(error.message));
        setEmailBusy(false);
        return;
      }
      window.location.href = nextPath;
    }
  }

  if (!hasSupabasePublicEnv) {
    // Wave 724: 운영자만 보는 메시지지만 prod 에서 env 망가지면 사용자도 봄.
    //   ".env.local"/"NEXT_PUBLIC_SUPABASE_ANON_KEY" 같은 내부 표현 제거.
    return (
      <div className="rounded-[28px] border border-[#ddd4c7] bg-[#fffbf4] p-5 text-sm font-bold text-[#5a6658] shadow-[0_18px_40px_rgba(34,49,39,0.08)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        지금은 로그인을 받을 수 없는 상태예요. 잠시 후 다시 시도하거나 운영자에게 문의해주세요.
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-[32px] border border-[#ddd4c7] bg-[#fffbf4] p-6 shadow-[0_20px_48px_rgba(34,49,39,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-[#5d735f] dark:text-emerald-400">
          득템잡이
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-[#223127] dark:text-white">
          {isSignup ? "카카오로 시작하기" : "로그인"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#5a6658] dark:text-zinc-400">
          {isSignup
            ? "카카오 또는 이메일로 가입할 수 있어요. 첫 3개 상품은 무료로 상세보기를 열 수 있습니다."
            : "가입한 계정으로 추천 상품과 피드백 기록을 이어서 봅니다."}
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={signInWithKakao}
          disabled={busy || (isSignup && !allRequiredAgreed)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#fee500] px-4 text-sm font-black text-[#191600] shadow-sm transition hover:bg-[#f6dc00] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
        >
          <KakaoIcon />
          {busy ? "카카오로 이동 중" : "카카오로 시작하기"}
        </button>
      </div>

      <div className="mt-6 flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-[#9aa39d]">
        <span className="h-px flex-1 bg-[#e7dece] dark:bg-zinc-700" />
        <span>또는 이메일</span>
        <span className="h-px flex-1 bg-[#e7dece] dark:bg-zinc-700" />
      </div>
      <form className="mt-4 space-y-3" onSubmit={handleEmailSubmit}>
        <label className="block">
          <span className="text-xs font-black text-[#445247] dark:text-zinc-200">이메일</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={emailBusy}
            required
            className="mt-1 block h-10 w-full rounded-lg border border-[#ddd4c7] bg-white px-3 text-sm font-bold text-[#223127] outline-none focus:border-[#5d735f] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="text-xs font-black text-[#445247] dark:text-zinc-200">비밀번호 (6자 이상)</span>
          <input
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={emailBusy}
            required
            minLength={6}
            className="mt-1 block h-10 w-full rounded-lg border border-[#ddd4c7] bg-white px-3 text-sm font-bold text-[#223127] outline-none focus:border-[#5d735f] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="••••••"
          />
        </label>
        <button
          type="submit"
          disabled={emailBusy || (isSignup && !allRequiredAgreed)}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-[#223127] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#344136] disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {emailBusy ? "처리 중…" : isSignup ? "이메일로 가입" : "이메일로 로그인"}
        </button>
      </form>

      {/* Wave 198 (2026-05-18): 가입 시 필수 동의 (전자상거래법 + 개인정보보호법 + 청소년보호법).
          필수 3개 (약관/개인정보/만14세) 동의 안 하면 가입 버튼 비활성. 선택 1개 (마케팅). */}
      {isSignup && (
        <div className="mt-5 rounded-xl border border-[#e7dece] bg-[#fffaf1] p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/40">
          <label className="flex cursor-pointer items-center gap-2 border-b border-[#e7dece] pb-2 dark:border-zinc-700">
            <input
              type="checkbox"
              checked={agreeTerms && agreePrivacy && agreeAge && agreeMarketing}
              onChange={(e) => toggleAll(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-[#5d735f]"
            />
            <span className="font-black text-[#223127] dark:text-zinc-100">전체 동의 (선택 항목 포함)</span>
          </label>
          <div className="mt-2 space-y-1.5">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#5d735f]"
              />
              <span className="flex-1 text-[#445247] dark:text-zinc-300">
                <span className="font-black text-rose-600 dark:text-rose-400">[필수]</span> <Link href="/terms" target="_blank" className="underline hover:text-[#223127] dark:hover:text-white">이용약관</Link>에 동의합니다
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#5d735f]"
              />
              <span className="flex-1 text-[#445247] dark:text-zinc-300">
                <span className="font-black text-rose-600 dark:text-rose-400">[필수]</span> <Link href="/privacy" target="_blank" className="underline hover:text-[#223127] dark:hover:text-white">개인정보 수집·이용</Link>에 동의합니다
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={agreeAge}
                onChange={(e) => setAgreeAge(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#5d735f]"
              />
              <span className="flex-1 text-[#445247] dark:text-zinc-300">
                <span className="font-black text-rose-600 dark:text-rose-400">[필수]</span> 만 14세 이상입니다
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={agreeMarketing}
                onChange={(e) => setAgreeMarketing(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#5d735f]"
              />
              <span className="flex-1 text-[#445247] dark:text-zinc-300">
                <span className="font-black text-zinc-500 dark:text-zinc-400">[선택]</span> 이벤트·신규 기능 안내 등 마케팅 정보 수신
              </span>
            </label>
          </div>
        </div>
      )}

      {message ? (
        <div className="mt-4 rounded-xl bg-[var(--brand-accent-soft)] px-3 py-2 text-xs font-bold text-[#445247] dark:bg-zinc-800 dark:text-zinc-300">
          {message}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between text-xs">
        <Link href="/" className="font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
          홈으로 돌아가기
        </Link>
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
        >
          {isSignup ? "이미 가입했나요? 로그인" : "처음이세요? 가입하기"}
        </Link>
      </div>

      {/* FAQ: 공정한 분배 정책 */}
      <details className="mt-5 rounded-xl border border-[#e7dece] bg-[#fffaf1] px-4 py-3 text-sm font-semibold text-[#5a6658] dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
        <summary className="cursor-pointer text-[13px] font-black text-[#344136] dark:text-zinc-100">
          왜 계정이 필요한가요?
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-6">
          <p>
            득템잡이는 <strong className="font-black">선별한 중고 매물을 하루 정해진 수량만</strong> 추천합니다.
            같은 사용자가 여러 계정으로 추천 매물을 반복 열람하면 다른 사용자에게 돌아가는 기회가 줄어듭니다.
          </p>
          <p>
            계정은 무료 상세보기 중복 사용을 막고, 열람한 추천 기록과 피드백을 안전하게 이어가기 위해 사용합니다.
            카카오 로그인과 이메일 가입 중 편한 방식을 선택할 수 있습니다.
          </p>
        </div>
      </details>
    </div>
  );
}
