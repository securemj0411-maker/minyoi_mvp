import { Suspense } from "react";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";

// Wave 180 (2026-05-17): 운영자 테스트용 임시 email auth 토글.
// NEXT_PUBLIC_ENABLE_EMAIL_AUTH=1 일 때만 /signup 살아남고 AuthForm signup mode 노출.
// 안 박혀 있으면 /login 으로 redirect (카카오 only 정책 유지).
// useSearchParams (auth-form 내부) client-side hook 이라 Suspense + force-dynamic 필수.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_EMAIL_AUTH !== "1") {
    redirect("/login");
  }
  return (
    <main className="flex min-h-[calc(100dvh-72px)] items-center justify-center bg-[#f6f1e8] px-4 py-10 dark:bg-zinc-950">
      <Suspense fallback={null}>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
