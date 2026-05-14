import AuthForm from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100dvh-72px)] items-center justify-center bg-[#f6f1e8] px-4 py-10 dark:bg-zinc-950">
      <AuthForm mode="login" />
    </main>
  );
}
