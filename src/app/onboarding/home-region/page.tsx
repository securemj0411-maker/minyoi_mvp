// Wave 773 (2026-05-27): 가입 후 첫 진입 — 사용자 거주 동네 설정 (강제, skip 불가).
//   당근 매물 거리 제약 (자기 인증 동네 인근만 채팅) 때문에 사용자 거주지 필수.
// Wave 886.7 (2026-05-27): server-side auth gate 추가.
//   기존엔 비로그인 사용자도 페이지 직접 접근 가능 → 위치 prompt 노출 (사용자 짚음).
//   로그인 안 됐으면 /login?next=/onboarding/home-region 으로 redirect.
//   이미 home_region 박혀있으면 /me 로 redirect (재방문 차단).
//   단, ?edit=1 은 기존 잘못 설정된 동네를 다시 덮어쓰기 위해 허용.

import { redirect } from "next/navigation";
import { HomeRegionOnboarding } from "@/components/home-region-onboarding";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import { loadUserHomeRegion } from "@/lib/user-home-region-loader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "동네 설정 — 득템잡이",
};

export default async function HomeRegionOnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ edit?: string }>;
}) {
  const auth = await requireSupabaseUserFromCookies();
  if (!auth.ok) {
    redirect("/login?next=/onboarding/home-region");
  }
  const params = await searchParams;
  const editMode = params?.edit === "1";
  // Wave 1202 (audit P1): region만 추출. 에러면 region=null이라 온보딩 유지(사용자가 설정 시도 가능, 무한루프 없음).
  const { region: existing } = await loadUserHomeRegion(auth.user.id);
  if (existing && !editMode) {
    redirect("/me");
  }
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <HomeRegionOnboarding />
    </main>
  );
}
