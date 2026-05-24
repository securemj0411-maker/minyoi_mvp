import { Suspense } from "react";
import AuthForm from "@/components/auth-form";

// useSearchParams (auth-form 내부) 가 client-side hook이라 prerender 시
// Suspense boundary 필요. dynamic = "force-dynamic" 으로 SSR 강제.
// Wave launch-119 (2026-05-24): brand mark + 환영 메시지 — 로그인 화면 focused UX.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f6f1e8] px-4 py-10 dark:bg-zinc-950">
      {/* Brand mark + 환영 메시지 */}
      <div className="mb-6 flex flex-col items-center">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="h-16 w-16 shadow-lg shadow-blue-500/20">
          <rect width="100" height="100" rx="22" fill="#0064FF" />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M52 16 L82 16 Q86 16 86 20 L86 50 Q86 53 84 55 L50 89 Q47 92 44 89 L13 58 Q10 55 13 52 L47 18 Q49 16 52 16 Z M50 60 L55 50 L65 45 L55 40 L50 30 L45 40 L35 45 L45 50 Z M70 32 m-5 0 a5 5 0 1 1 10 0 a5 5 0 1 1 -10 0 Z"
            fill="#FFFFFF"
          />
        </svg>
        <h1 className="mt-4 text-2xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">득템잡이</h1>
        <p className="mt-1 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">AI 중고 시세 비교 서비스</p>
      </div>
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
