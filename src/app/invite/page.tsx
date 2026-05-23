// Wave 731 (2026-05-24): 친구 초대 페이지.
// 사용자 추천 코드 + 카카오 공유 버튼 + 추천 현황.

import { Suspense } from "react";
import InviteClient from "@/components/invite-client";

export const dynamic = "force-dynamic";

export default function InvitePage() {
  return (
    <main className="min-h-[calc(100dvh-72px)] bg-[var(--background)] px-4 py-8">
      <Suspense fallback={null}>
        <InviteClient />
      </Suspense>
    </main>
  );
}
