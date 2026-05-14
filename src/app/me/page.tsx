import MeDashboardClient from "@/components/me-dashboard-client";

// Wave 74: server fetch 제거. 이전엔 loadInventory()를 서버에서 await해서
// /me 네비게이션이 ~1~2초 block됐음. 클릭 즉시 페이지 mount + skeleton 표시,
// 인벤토리는 클라이언트에서 /api/packs/inventory로 fetch.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MePage() {
  return <MeDashboardClient initialInventory={[]} />;
}
