// 2026-05-17: / 가 me-dashboard 와 동일 — 비로그인 마스킹 / 로그인 정상 dashboard.
// 옛 랜딩 페이지 (PackShop) 는 /intro 로 이동 (back 가능).

import MeDashboardClient from "@/components/me-dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return <MeDashboardClient initialInventory={[]} />;
}
