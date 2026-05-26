// Wave 773 (2026-05-27): 가입 후 첫 진입 — 사용자 거주 동네 설정 (강제, skip 불가).
//   당근 매물 거리 제약 (자기 인증 동네 인근만 채팅) 때문에 사용자 거주지 필수.

import { HomeRegionOnboarding } from "@/components/home-region-onboarding";

export const metadata = {
  title: "동네 설정 — 득템잡이",
};

export default function HomeRegionOnboardingPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <HomeRegionOnboarding />
    </main>
  );
}
