import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminCaughtPage } from "@/components/admin-caught-page";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok) redirect("/login?next=/admin");
  if (!isAdminUser(auth.user)) return <AdminCaughtPage />;

  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs dark:border-amber-900/60 dark:bg-amber-950/30 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
          <span className="font-bold text-amber-800 dark:text-amber-300">
            ⚙ 운영자 화면 (검수용)
          </span>
          <Link href="/" className="font-semibold text-amber-700 underline dark:text-amber-300">
            사용자 화면으로
          </Link>
        </div>
      </div>
      {children}
    </>
  );
}
