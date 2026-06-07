// 2026-05-17: / 가 me-dashboard 와 동일 — 비로그인 마스킹 / 로그인 정상 dashboard.
// 옛 랜딩 페이지 (PackShop) 는 /intro 로 이동 (back 가능).
//
// Wave launch-15 (audit HIGH): force-dynamic 제거. MeDashboardClient 는 client component 라
// shell 정적이면 됨. 이전 force-dynamic 박았던 거 = 의도 불명 / SSR 매번 = 모바일 첫 paint 느림.
// Wave launch-114 (2026-05-24): SEO 강화 — server component 로 변환 + 비로그인 SEO header.
//   비로그인 사용자한테 server HTML 에 h1 + description + 카테고리 키워드 박음.
//   구글 크롤러가 JS 실행 전에도 텍스트 읽을 수 있음 (SEO 등급 C → B).
//   화면엔 sr-only (시각적 hidden, screen reader / crawler 만 읽음) — visual duplication 없음.
//   PreviewMaskedDashboard 의 client-side intro 는 그대로 유지.

import { redirect } from "next/navigation";
import { requireSupabaseUserFromCookies } from "@/lib/supabase-server-auth";
import { loadUserHomeRegion } from "@/lib/user-home-region-loader";
import { getProStatus, hasMembershipAccess } from "@/lib/user-subscription";
import { userRefForAuthUser } from "@/lib/user-ref";
import MeDashboardClient from "@/components/me-dashboard-client";
import PreviewMaskedDashboardServer from "@/components/preview-masked-dashboard-server";
import FeedScarcityBanner from "@/components/feed-scarcity-banner";
import { loadSlotSnapshot } from "@/lib/membership-slots";

export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await requireSupabaseUserFromCookies();
  const isLoggedIn = auth.ok;

  // Wave launch-115 (2026-05-24): 비로그인 분기 SSR.
  //   기존엔 MeDashboardClient (client) → 안에서 client side fetch → 첫 paint 깜빡임.
  //   이제 server component 가 직접 fetch + HTML 박아 응답. 첫 paint 즉시 + SEO 강함.
  if (!isLoggedIn) {
    const slot = loadSlotSnapshot();
    return (
      <>
        {/* SEO server-rendered content — 비로그인 한정. sr-only (시각 숨김, 크롤러만 읽음). */}
        <header className="sr-only">
          <h1>득템잡이 — AI 중고 시세 비교 서비스</h1>
          <p>
            같은 모델·같은 상태끼리 가격을 비교해서 시세보다 저렴한 중고 매물 정보를 알려드리는 AI
            서비스입니다. 번개장터·중고나라에 올라온 매물을 카테고리별로 정리하고, 시세 차이와
            배송비·수수료까지 자동 계산해서 알뜰한 득템 정보를 추천해드립니다.
          </p>
          <h2>지원 카테고리</h2>
          <p>
            신발·의류·가방·시계·스마트폰·이어폰·헤드폰·노트북·데스크탑·태블릿·스마트워치·모니터·
            카메라·게임기·스피커·생활가전·향수·레고·골프·드론·자전거·킥보드.
          </p>
          <h2>이런 분께 도움 됩니다</h2>
          <p>
            중고 매물을 자주 찾는 분, 시세 비교가 번거로운 분, 가품·시세 부풀림 같은 위험을
            피하고 싶은 분. AI가 같은 SKU 매물끼리만 묶어서 정확한 시세를 알려드리고, 사용자가
            직접 신고한 매물 정보로 끊임없이 데이터 정확도를 개선합니다.
          </p>
          <p>면책: 본 서비스는 시세 비교 정보를 제공할 뿐, 매물 진위·거래 결과를 보장하지 않습니다. 최종 판단은 이용자가 합니다.</p>
        </header>
        <FeedScarcityBanner slot={slot} />
        <PreviewMaskedDashboardServer />
      </>
    );
  }

  const membership = await getProStatus(auth.user, userRefForAuthUser(auth.user.id));
  if (!hasMembershipAccess(membership)) {
    redirect("/plans?from=feed");
  }

  // Wave 773 (2026-05-27): 로그인 후 첫 진입 — 거주 동네 미설정이면 onboarding 페이지로 redirect.
  //   멤버십이 없는 사용자는 먼저 신청 페이지로 보낸다. 추천 피드는 승인된 계정만 접근 가능.
  // Wave 1202 (audit P1): DB 조회 에러(errored)면 redirect 보류 — 에러를 "미설정"으로 오인해
  //   정상 멤버를 온보딩으로 튕기던 버그 fix. 진짜 미설정(!region && !errored)일 때만 온보딩.
  const { region: homeRegion, errored: homeRegionErrored } =
    await loadUserHomeRegion(auth.user.id);
  if (!homeRegion && !homeRegionErrored) {
    redirect("/onboarding/home-region");
  }

  return <MeDashboardClient initialInventory={[]} />;
}
