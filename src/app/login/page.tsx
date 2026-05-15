import { Suspense } from "react";
import AuthForm from "@/components/auth-form";

// useSearchParams (auth-form 내부) 가 client-side hook이라 prerender 시
// Suspense boundary 필요. dynamic = "force-dynamic" 으로 SSR 강제.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100dvh-72px)] items-center justify-center bg-[#f6f1e8] px-4 py-10 dark:bg-zinc-950">
      <Suspense fallback={null}>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
