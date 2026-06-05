// Wave launch-108 (2026-05-24): admin route group shared layout.
//   기존엔 각 page.tsx 가 자체 헤더 + nav + KPI ticker 박았음 (중복 5개 페이지).
//   이제 layout 이 sticky AdminTopBar 마운트 → Next.js soft navigation 시 sticky bar 유지.
//   admin auth 도 layout 1회 (각 page 에선 제거).
// Wave launch-109 (2026-05-24): 세션 없으면 notFound() X → /login 로 redirect.
//   사용자 frustration: cau URL 직접 접속 시 세션 없으면 404 → 운영자 본인도 진입 못 함.
//   세션 없음 → /login?next=<cau path> (로그인 후 자동 복귀).
//   로그인 했는데 admin 아님 → notFound() (URL obfuscation 유지).

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { OPS_ADMIN_BASE_PATH } from "@/lib/admin-routes";
import { isAdminUser } from "@/lib/auth-users";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";

import AdminTopBar from "./admin-top-bar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireSupabaseUserFromCookies();

  // Wave launch-109: 세션 없음 → 로그인 페이지로. next param 에 현재 path (header 에서 추출, 실패 시 cau base).
  if (!auth.ok) {
    const h = await headers();
    const currentPath = h.get("x-invoke-path") ?? h.get("x-next-pathname") ?? h.get("referer") ?? OPS_ADMIN_BASE_PATH;
    // referer 는 full URL — path 만 뽑기.
    let nextPath = currentPath;
    try {
      if (currentPath.startsWith("http")) nextPath = new URL(currentPath).pathname;
    } catch { nextPath = OPS_ADMIN_BASE_PATH; }
    // cau 경로 외 다른 path 흘러들어오면 base 로 fallback (안전망).
    if (!nextPath.startsWith(OPS_ADMIN_BASE_PATH)) nextPath = OPS_ADMIN_BASE_PATH;
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  // 로그인 했는데 admin 아님 → URL obfuscation 유지 (cau 디렉토리 존재 자체 노출 X).
  if (!isAdminUser(auth.user)) notFound();

  return (
    // cau 운영자 페이지는 강제 다크로 고정한다. 운영 화면은 dense 하되 terminal 톤 대신 제품 운영 대시보드 톤으로 유지.
    <div className="dark min-h-screen bg-zinc-950 text-zinc-200">
      <AdminTopBar />
      {children}
    </div>
  );
}
