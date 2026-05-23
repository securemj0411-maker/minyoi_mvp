import type { Metadata, Viewport } from "next";
import AppFooter from "@/components/app-footer";
import AppNav from "@/components/app-nav";
import ReferralCapture from "@/components/referral-capture";
import SiteHelpFaq from "@/components/site-help-faq";
import "./globals.css";

// Wave 106: 모바일 viewport + theme color (브라우저 상단 색).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Wave launch-19 (audit MEDIUM): viewport-fit=cover — 노치/홈바 영역까지 페이지가 그려지게.
  // safe-area-inset-* CSS (pack-reveal-modal 의 sticky CTA + BeginnerGuide 풀스크린) 가 정확히 동작.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Wave 106: SEO 보강. 한국어 자연어 + 키워드.
// 2026-05-19: PG 심사 대비 톤 정비. "리셀/가격 차익"처럼 투자·수익 보장으로 읽힐 어휘 제거.
// "시세 비교 정보 제공" 톤. 면책은 /terms 제6·11조에 박혀 있음.
const SITE_NAME = "득템잡이";
const TAGLINE = "중고 매물 시세 비교 — AI가 알려주는 알뜰 득템 정보";
const DESCRIPTION = "공개된 중고 매물의 시세를 AI가 비교해서, 시세보다 저렴한 매물 정보를 알려드립니다. 옵션 같은 본품끼리만 비교하고, 공개 직전 판매 상태를 다시 확인합니다. 매물 진위·거래 결과는 보장하지 않으며, 최종 판단은 이용자가 합니다.";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  description: DESCRIPTION,
  keywords: ["중고", "중고거래", "번개장터", "시세 비교", "AI 매물 분석", "득템", "알뜰 구매", "에어팟", "애플워치", "아이패드"],
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
    // Wave 740 (2026-05-24): og:image 박음 — 카카오 sendScrap 이 자동 fetch.
    //   없으면 카카오가 카드 못 만들어 apps.kakao.com/talk/message/block URL 로 fallback.
    images: [{ url: "/new_balance.jpeg", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} — ${TAGLINE}`, description: DESCRIPTION, images: ["/new_balance.jpeg"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
        {/* Wave launch-10 (audit CRITICAL #9): Dark mode FOUC fix.
         * React mount 전에 즉시 .dark class 적용 — 시스템 dark 사용자가 흰 화면 깜빡 안 보게.
         * inline script (blocking) — paint 전에 실행. minified.
         * localStorage 키 = `minyoi-theme-v1` (app-nav.tsx 와 동일 source). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("minyoi-theme-v1");var d=s==="dark"||((s==="system"||!s)&&matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark");document.documentElement.dataset.theme="dark";}else{document.documentElement.dataset.theme="light";}}catch(e){}})();`,
          }}
        />
        {/* Wave launch-51: Kakao JS SDK — Share.sendDefault 카톡 공유.
            init 은 explore-client mount 시 (NEXT_PUBLIC_KAKAO_JS_KEY 사용).
            async 로드 — 페이지 다른 작업 안 막음. integrity hash = Kakao 공식. */}
        <script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          integrity="sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4yyC7wy6K1Hs90nka"
          crossOrigin="anonymous"
          async
        />
        {/* Wave launch-114 (2026-05-24): SEO 강화 — WebSite + Organization JSON-LD.
            구글 rich snippet (사이트 검색 박스 + 브랜드 카드) 노출 가능. CTR +10~30%. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": "https://minyoi-mvp.vercel.app/#website",
                  url: "https://minyoi-mvp.vercel.app/",
                  name: "득템잡이",
                  description: "중고 매물 시세 비교 — AI가 알려주는 알뜰 득템 정보",
                  inLanguage: "ko-KR",
                  publisher: { "@id": "https://minyoi-mvp.vercel.app/#org" },
                },
                {
                  "@type": "Organization",
                  "@id": "https://minyoi-mvp.vercel.app/#org",
                  name: "득템잡이",
                  url: "https://minyoi-mvp.vercel.app/",
                  logo: {
                    "@type": "ImageObject",
                    url: "https://minyoi-mvp.vercel.app/new_balance.jpeg",
                    width: 1200,
                    height: 630,
                  },
                  sameAs: [],
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Wave 743 (2026-05-24): URL ?ref= 잡아서 sessionStorage 저장 — middleware fallback */}
        <ReferralCapture />
        <AppNav />
        {/* 2026-05-19: SafetyStatsMarquee 글로벌 제거 — /me 모바일 fold 잡아먹는 문제 해소.
            비로그인 메인(PreviewMaskedDashboard) + "더 찾아보기" 모달(seekMore)에만 노출.
            사용자가 "다른 매물 찾을 때" 시점에 보이는 게 신뢰 신호로 더 자연스러움. */}
        <div className="flex-1">{children}</div>
        <AppFooter />
        <SiteHelpFaq />
      </body>
    </html>
  );
}
