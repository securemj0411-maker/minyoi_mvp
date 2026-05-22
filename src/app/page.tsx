// 2026-05-17: / 가 me-dashboard 와 동일 — 비로그인 마스킹 / 로그인 정상 dashboard.
// 옛 랜딩 페이지 (PackShop) 는 /intro 로 이동 (back 가능).
//
// Wave launch-15 (audit HIGH): force-dynamic 제거. MeDashboardClient 는 client component 라
// shell 정적이면 됨. 이전 force-dynamic 박았던 거 = 의도 불명 / SSR 매번 = 모바일 첫 paint 느림.

import MeDashboardClient from "@/components/me-dashboard-client";

export default function Home() {
  return <MeDashboardClient initialInventory={[]} />;
}
