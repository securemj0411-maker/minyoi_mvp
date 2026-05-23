// 2026-05-17: 옛 메인 페이지 (랜딩) 보존 — /intro 로 이동.
// 새 / 페이지 = me-dashboard (비로그인 마스킹 / 로그인 정상). 옛 landing 은 fallback 용.
// Wave launch-114 (2026-05-24): page-level metadata + server-side SEO header.

import type { Metadata } from "next";

import PackShop from "@/components/pack-shop";
import { getLandingKpis, getLandingShowcases } from "@/lib/landing-showcases";

export const metadata: Metadata = {
  title: "서비스 소개 — 득템잡이",
  description:
    "득템잡이는 번개장터·중고나라 중고 매물을 같은 모델·같은 상태끼리 묶어서 시세를 비교해 보여주는 AI 서비스입니다. 신발·의류·가방·시계·스마트폰·이어폰·노트북 등 다양한 카테고리 지원.",
  keywords: ["득템잡이", "중고 시세 비교", "AI 매물 분석", "번개장터 시세", "중고나라 시세", "득템", "알뜰 구매"],
  openGraph: {
    title: "서비스 소개 — 득템잡이",
    description: "AI가 같은 모델·같은 상태끼리 묶어서 시세보다 저렴한 중고 매물을 알려드립니다.",
    url: "https://minyoi-mvp.vercel.app/intro",
    type: "website",
  },
  alternates: { canonical: "https://minyoi-mvp.vercel.app/intro" },
};

export default async function IntroPage() {
  const [showcases, kpis] = await Promise.all([getLandingShowcases(), getLandingKpis()]);
  return (
    <>
      {/* Wave launch-114: server-rendered SEO header (sr-only). PackShop 은 client 라 server HTML 텍스트 0. */}
      <header className="sr-only">
        <h1>득템잡이 서비스 소개 — AI 중고 시세 비교</h1>
        <p>
          득템잡이는 번개장터·중고나라 매물을 같은 모델·같은 상태끼리 묶어서 시세를 비교하고,
          시세보다 저렴한 매물 정보를 자동으로 알려드리는 AI 서비스입니다. 가품 의심 매물 차단,
          배송비·수수료 자동 계산, 거래 완료 매물 실시간 정리까지 한 번에 처리합니다.
        </p>
        <h2>주요 기능</h2>
        <p>
          AI 시세 비교, 같은 SKU·같은 컨디션 매물 자동 그룹핑, 가품·시세 부풀림 매물 차단,
          신발/의류 5-tier 등급(S/A/B/C/D) 자동 판별, 거래 완료 매물 실시간 invalidate.
        </p>
      </header>
      <PackShop showcases={showcases} kpis={kpis} />
    </>
  );
}
