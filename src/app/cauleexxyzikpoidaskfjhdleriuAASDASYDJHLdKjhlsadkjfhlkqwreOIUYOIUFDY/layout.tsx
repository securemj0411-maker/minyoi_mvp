// Wave launch-108 (2026-05-24): admin route group shared layout.
//   기존엔 각 page.tsx 가 자체 헤더 + nav + KPI ticker 박았음 (중복 5개 페이지).
//   이제 layout 이 sticky AdminTopBar 마운트 → Next.js soft navigation 시 sticky bar 유지.
//   admin auth 도 layout 1회 (각 page 에선 제거) — notFound 가드.

import { notFound } from "next/navigation";

import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";

import AdminTopBar from "./admin-top-bar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok || !isAdminUser(auth.user)) notFound();

  return (
    <div className="min-h-screen bg-zinc-950 font-mono text-zinc-200">
      <AdminTopBar />
      {children}
    </div>
  );
}
