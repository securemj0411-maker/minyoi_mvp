import { redirect } from "next/navigation";
import MeDashboardClient from "@/components/me-dashboard-client";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import { getProStatus, hasMembershipAccess } from "@/lib/user-subscription";
import { loadUserHomeRegion } from "@/lib/user-home-region-loader";
import { userRefForAuthUser } from "@/lib/user-ref";

// Wave 74: server fetch 제거. 이전엔 loadInventory()를 서버에서 await해서
// /me 네비게이션이 ~1~2초 block됐음. 클릭 즉시 페이지 mount + skeleton 표시,
// 매물 풀은 ExploreClient가 즉시 /api/packs/pool로 fetch하고, 예산은 클라이언트 필터로만 적용.
// Wave 886.5 (2026-05-27): / 페이지에서만 enforce 하던 home region 게이트를 /me 에도 적용.
//   원래 로그인 후 /me 로 직접 진입하면 onboarding 우회 → 신규 가입자가 위치 설정 안 하고 진입 가능.
//   당근 매물 거리 필터가 user home region 의존이라 미설정시 효과 없음 + Wave 773 의도 깨짐.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MePage() {
  const auth = await requireSupabaseUserFromCookies();
  if (auth.ok) {
    const membership = await getProStatus(auth.user, userRefForAuthUser(auth.user.id));
    if (!hasMembershipAccess(membership)) {
      redirect("/plans?from=me");
    }
    // Wave 1202 (audit P1): DB 조회 에러면 redirect 보류 (정상 멤버 온보딩 튕김 방지).
    const { region: homeRegion, errored: homeRegionErrored } =
      await loadUserHomeRegion(auth.user.id);
    if (!homeRegion && !homeRegionErrored) {
      redirect("/onboarding/home-region");
    }
  }
  return <MeDashboardClient initialInventory={[]} />;
}
