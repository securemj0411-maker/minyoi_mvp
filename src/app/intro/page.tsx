// 2026-05-17: 옛 메인 페이지 (랜딩) 보존 — /intro 로 이동.
// 새 / 페이지 = me-dashboard (비로그인 마스킹 / 로그인 정상). 옛 landing 은 fallback 용.

import PackShop from "@/components/pack-shop";
import { getLandingKpis, getLandingShowcases } from "@/lib/landing-showcases";

export default async function IntroPage() {
  const [showcases, kpis] = await Promise.all([getLandingShowcases(), getLandingKpis()]);
  return <PackShop showcases={showcases} kpis={kpis} />;
}
