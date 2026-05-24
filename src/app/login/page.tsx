import { Suspense } from "react";
import AuthForm from "@/components/auth-form";
import { BrandLogo } from "@/components/brand-logo";

// useSearchParams (auth-form 내부) 가 client-side hook이라 prerender 시
// Suspense boundary 필요. dynamic = "force-dynamic" 으로 SSR 강제.
// Wave launch-119 (2026-05-24): brand mark + 환영 메시지 — 로그인 화면 focused UX.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f6f1e8] px-4 py-10 dark:bg-zinc-950">
      {/* Brand mark + 환영 메시지 */}
      <div className="mb-6 flex flex-col items-center">
        <BrandLogo size={64} className="rounded-[14px] shadow-lg shadow-blue-500/20" />
        <h1 className="mt-4 text-2xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">득템잡이</h1>
        <p className="mt-1 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">AI 중고 시세 비교 서비스</p>
      </div>
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
