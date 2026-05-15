// Wave 106: 페이지 레벨 에러 핸들러 — generic Next.js 에러 화면 대신 친절한 한국어 + retry.

"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 디버깅용 — error.digest 로 vercel/supabase logs 매칭 가능.
    console.error("[error.tsx] page error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="min-h-screen bg-[#f6f1e8] px-4 py-12 dark:bg-zinc-950">
      <div className="mx-auto max-w-xl text-center">
        <div className="text-[80px] font-black leading-none text-red-500">!</div>
        <h1 className="mt-4 text-2xl font-black text-[#223127] dark:text-zinc-100 sm:text-3xl">
          페이지를 불러오지 못했어요
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#5a6658] dark:text-zinc-400">
          잠시 일시적인 문제가 났어요. 새로고침하거나 메인으로 돌아가서 다시 시도해주세요.
        </p>
        {error.digest ? (
          <p className="mt-2 text-[11px] font-mono text-zinc-400 dark:text-zinc-600">
            오류 코드: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center rounded-xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-xl border border-[#ddd4c7] bg-[#fffaf1] px-5 text-sm font-bold text-[#344136] hover:bg-[#f4eee3] dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200"
          >
            메인으로
          </Link>
        </div>
      </div>
    </main>
  );
}
