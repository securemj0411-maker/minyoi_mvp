// Wave 106: 404 — generic Next.js 에러 화면 대신 친절한 한국어 안내.

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f6f1e8] px-4 py-12 dark:bg-zinc-950">
      <div className="mx-auto max-w-xl text-center">
        <div className="text-[80px] font-black leading-none text-[#314238] dark:text-emerald-300">404</div>
        <h1 className="mt-4 text-2xl font-black text-[#223127] dark:text-zinc-100 sm:text-3xl">
          페이지를 찾을 수 없어요
        </h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#5a6658] dark:text-zinc-400">
          입력한 주소가 잘못됐거나, 페이지가 옮겨졌을 수 있어요.
          메인으로 돌아가서 다시 시도해주세요.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-xl bg-[#314238] px-5 text-sm font-black text-[#f7f1e6] hover:bg-[#27362e]"
          >
            메인으로
          </Link>
          <Link
            href="/me"
            className="inline-flex h-11 items-center rounded-xl border border-[#ddd4c7] bg-[#fffaf1] px-5 text-sm font-bold text-[#344136] hover:bg-[#f4eee3] dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200"
          >
            내 대시보드
          </Link>
        </div>
      </div>
    </main>
  );
}
