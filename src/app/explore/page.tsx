import ExploreClient from "@/components/explore-client";

// Wave 338 (Phase 1a — Freemium /explore):
// 무료 사용자 매물 풀 browsing 페이지. 6h 이상 매물 30개 + 30min cooldown.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExplorePage() {
  return <ExploreClient />;
}
