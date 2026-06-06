// Wave 799 (2026-05-30): URL 시세 조회 페이지.
//   회원이 번장/중나/당근 매물 URL 입력 → 미뇨이 DB 시세/매입가/예상수익/비교매물/그래프 표시.

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import { getProStatus, hasMembershipAccess } from "@/lib/user-subscription";
import { userRefForAuthUser } from "@/lib/user-ref";
import LookupClient from "./lookup-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "시세 조회 — 미뇨이/득템잡이",
  description: "번개장터, 중고나라, 당근마켓 URL 을 붙여넣으면 미뇨이 시세·예상 수익·비교 매물을 보여드려요.",
};

export default async function LookupPage() {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok) {
    // Wave 1210 (audit P2): next=/plans면 로그인 후 원래 가려던 /lookup으로 안 돌아옴.
    //   next=/lookup이면 멤버는 로그인 후 시세조회로 복귀, 비멤버는 /lookup이 다시 /plans로 보냄(의미 보존).
    redirect("/login?next=/lookup");
  }
  const membership = await getProStatus(auth.user, userRefForAuthUser(auth.user.id));
  if (!hasMembershipAccess(membership)) {
    redirect("/plans?from=lookup");
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f5f7fb] dark:bg-zinc-950" />}>
      <LookupClient />
    </Suspense>
  );
}
