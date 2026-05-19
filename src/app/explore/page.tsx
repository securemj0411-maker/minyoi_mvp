import { Suspense } from "react";
import ExploreClient from "@/components/explore-client";

// Wave 338 (Phase 1a — Freemium /explore):
// 무료 사용자 매물 풀 browsing 페이지. 6h 이상 매물 30개 + 30min cooldown.
// Wave 341: useSearchParams를 위해 Suspense boundary 필요.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreClient />
    </Suspense>
  );
}
