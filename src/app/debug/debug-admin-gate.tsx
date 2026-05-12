"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { isAdminUser } from "@/lib/auth-users";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  children: ReactNode;
};

export function DebugAdminGate({ children }: Props) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      router.replace("/login");
      return;
    }

    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!isAdminUser(data.user)) {
        router.replace(data.user ? "/" : "/login");
        return;
      }
      setAllowed(true);
      setChecked(true);
    }).catch(() => {
      if (!mounted) return;
      router.replace("/login");
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  if (!checked || !allowed) {
    return (
      <main className="min-h-screen bg-[#f6f1e8] dark:bg-zinc-950">
        <div className="mx-auto flex min-h-screen max-w-[720px] items-center justify-center px-6">
          <div className="rounded-3xl border border-[#ddd4c7] bg-[#fffbf4] px-6 py-5 text-sm font-bold text-[#556252] shadow-[0_18px_40px_rgba(34,49,39,0.08)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            운영자 권한 확인 중...
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
