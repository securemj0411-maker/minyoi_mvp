import MeDashboardClient from "@/components/me-dashboard-client";

// Wave 74: server fetch 제거. 이전엔 loadInventory()를 서버에서 await해서
// /me 네비게이션이 ~1~2초 block됐음. 클릭 즉시 페이지 mount + skeleton 표시,
// 매물 풀은 ExploreClient가 즉시 /api/packs/pool로 fetch하고, 예산은 클라이언트 필터로만 적용.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MePage() {
  return <MeDashboardClient initialInventory={[]} />;
}
