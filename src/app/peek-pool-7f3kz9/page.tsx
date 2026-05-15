// 2026-05-15: 베타 테스터용 공개 풀 페이지. 로그인 X. URL obfuscated.
// 검색엔진 noindex. 운영자가 카톡으로 URL 공유. 누구나 URL 알면 풀 매물 검토 가능.

import type { Metadata } from "next";
import AdminPoolBrowser from "@/components/admin-pool-browser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "베타 풀 검토",
  robots: { index: false, follow: false, nocache: true },
};

export default function BetaPoolPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-3 py-4 dark:bg-zinc-950 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
            Beta · 풀 검토
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            추천 풀 전체 매물
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            베타 테스터 검증용 페이지. 운영자 풀과 동일한 데이터를 보여줍니다. 의심 매물 발견 시 운영자에게 카톡으로 PID + 사유 알려주세요.
          </p>
        </header>
        <AdminPoolBrowser endpoint="/api/public/pool-listings" />
      </div>
    </main>
  );
}
