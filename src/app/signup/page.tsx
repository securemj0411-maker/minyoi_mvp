import { Suspense } from "react";
import AuthForm from "@/components/auth-form";

// Wave 180 (2026-05-17): 이메일 가입 항상 노출 (env 토글 제거).
// useSearchParams (auth-form 내부) client-side hook 이라 Suspense + force-dynamic 필수.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <main className="flex min-h-[calc(100dvh-72px)] items-center justify-center bg-[#f6f1e8] px-4 py-10 dark:bg-zinc-950">
      <Suspense fallback={null}>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
