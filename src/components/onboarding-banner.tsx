"use client";

// Wave 104: 신규 가입 사용자에게 "5크레딧 받았어요" + 시작 안내 배너.
// 표시 조건: freeGrantedAt < 24h ago AND localStorage 미dismiss.
// dismiss는 X 버튼 또는 "추천 받기" CTA 클릭 시.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircleIcon } from "@/components/icons";
import { loadClientCredits } from "@/lib/client-credits";

const DISMISS_KEY = "minyoi-onboarding-dismissed-v1";
const FRESH_GRANT_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function OnboardingBanner({ onStart }: { onStart?: () => void }) {
  const [show, setShow] = useState(false);
  const [tokens, setTokens] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1") {
      return;
    }
    loadClientCredits()
      .then((credits) => {
        if (cancelled || !credits) return;
        if (credits.infinite) return; // admin은 안 보여줌
        if (!credits.freeGrantedAt) return;
        const grantedAt = new Date(credits.freeGrantedAt).getTime();
        if (!Number.isFinite(grantedAt)) return;
        if (Date.now() - grantedAt > FRESH_GRANT_WINDOW_MS) return;
        setTokens(credits.tokens);
        setShow(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const dismiss = useCallback(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-[#fffbf4] p-4 shadow-[0_12px_28px_rgba(63,99,67,0.08)] dark:border-emerald-800 dark:from-emerald-950/30 dark:to-zinc-900">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
          <CheckCircleIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
              가입 환영
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
              크레딧 {tokens}개
            </span>
          </div>
          <h3 className="mt-1 text-base font-black text-[#223127] dark:text-zinc-100">
            첫 5크레딧 받았어요
          </h3>
          <p className="mt-1 text-xs font-semibold leading-6 text-[#5a6658] dark:text-zinc-300">
            "추천 상품 받기"에서 <strong>안전</strong> 또는 <strong>균형</strong> 프로필로 시작해보세요.
            매번 크레딧이 줄어들고, 다 쓰면 요금제로 충전할 수 있어요.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href="#recommend"
              onClick={() => { onStart?.(); dismiss(); }}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--brand-accent-strong)] px-4 text-xs font-black text-[var(--brand-cream)] hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-950"
            >
              추천 받기 시작
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#ddd4c7] px-3 text-xs font-bold text-[#556252] hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              나중에
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="닫기"
          className="shrink-0 rounded-md p-1 text-zinc-400 transition hover:bg-white/60 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
