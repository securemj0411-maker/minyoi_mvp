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
        {/* Wave 725 (2026-05-23): error.digest 는 운영자 추적용 anonymous hash.
            이전엔 "오류 코드: <hash>" raw 노출 → 입문자에겐 무서운 텍스트.
            details toggle 로 숨김 — CS 문의 시 사용자가 펼쳐서 복사 가능. */}
        {error.digest ? (
          <details className="mt-3 inline-block text-[11px] text-zinc-400 dark:text-zinc-600">
            <summary className="cursor-pointer font-bold hover:text-zinc-500 dark:hover:text-zinc-400">
              기술 정보 (운영자 문의 시 사용)
            </summary>
            <p className="mt-1 font-mono text-zinc-400 dark:text-zinc-600">
              {error.digest}
            </p>
          </details>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700"
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
