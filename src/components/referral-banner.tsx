"use client";

// Wave 805 (2026-05-30): 메인 피드 상단 referral banner.
//   /me 진입 시 한 번 노출. dismiss 후 3일간 안 보임 (localStorage).
//   목적: 사용자가 nav 메뉴 통하지 않고도 친구 초대 인지 + 진입.

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "minyoi:referral-banner-dismissed-until";
const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3일

export default function ReferralBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const until = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0);
      if (!Number.isFinite(until) || until < Date.now()) {
        setShow(true);
      }
    } catch {
      setShow(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now() + DISMISS_COOLDOWN_MS));
    } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <section className="relative mb-3 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-amber-50 p-4 dark:border-blue-900/40 dark:from-blue-950/24 dark:via-zinc-900 dark:to-amber-950/16">
      <button
        type="button"
        onClick={dismiss}
        aria-label="배너 닫기"
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        ✕
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[18px] shadow-[0_8px_18px_rgba(245,158,11,0.32)]">
          🎁
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-black leading-5 text-zinc-950 dark:text-zinc-50">
            친구 초대하면 <span className="text-[#3182f6] dark:text-blue-300">둘 다 +5크레딧</span>
          </div>
          <div className="mt-0.5 break-keep text-[11.5px] font-bold leading-4 text-zinc-500 dark:text-zinc-400">
            친구가 충전까지 하면 추가 +3 ~ +60크레딧
          </div>
        </div>
      </div>
      <Link
        href="/invite"
        className="mt-3 flex h-10 w-full items-center justify-center gap-1 rounded-xl bg-[#3182f6] text-[12.5px] font-black text-white shadow-[0_6px_14px_rgba(49,130,246,0.24)] transition hover:bg-[#1c6fe8] active:scale-[0.99]"
      >
        지금 친구 초대하기 →
      </Link>
    </section>
  );
}
