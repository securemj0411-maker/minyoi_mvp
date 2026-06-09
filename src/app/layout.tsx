import type { Metadata, Viewport } from "next";
import AppFooter from "@/components/app-footer";
import AppNav from "@/components/app-nav";
import BalanceToast from "@/components/balance-toast";
import ConsentFlusher from "@/components/consent-flusher";
import GtagSignupTracker from "@/components/gtag-signup-tracker";
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
// Wave 754 (2026-05-25): 검색엔진/SNS 미리보기용 짧은 description (80자 이내 — 네이버 서치어드바이저 권장).
//   면책 ("매물 진위·거래 결과 보장 X, 최종 판단 이용자") 는 /terms 와 footer 에 박혀 있음.
const DESCRIPTION = "AI가 매일 분석한 중고 매물 시세 비교. 시세보다 저렴한 알뜰 득템 정보를 알려드려요.";

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
    // Wave launch-119 (2026-05-24): static jpeg → dynamic OG (app/opengraph-image.tsx).
    //   Next.js 가 /opengraph-image URL 로 자동 serve. brand logo + tagline 박힌 1200×630 PNG.
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} — ${TAGLINE}`, description: DESCRIPTION, images: ["/opengraph-image"] },
  // Wave 804 (2026-05-30): Google 검색결과 favicon 명시. 기존 32px → 미달, 96px 로 bump.
  //   Google 요구: multiple of 48 (48/96/144/192), 1:1 square, crawlable.
  //   sizes="any" 박아서 Google + 모바일/PC 브라우저 다 같은 link 사용.
  //   /favicon.svg 도 박음 — 모던 브라우저 + 일부 검색엔진 SVG 우선.
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon", type: "image/png", sizes: "96x96" },
      { url: "/icon", type: "image/png", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
    shortcut: [{ url: "/icon", type: "image/png" }],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  // Wave 753 (2026-05-25): 네이버 서치어드바이저 사이트 소유 확인 메타.
  //   https://searchadvisor.naver.com/ → 사이트 등록 후 verification → "확인" 클릭하면 활성.
  //   확인 완료 후 sitemap.xml 제출 + URL 직접 수집 요청 필요.
  verification: {
    other: {
      "naver-site-verification": "211bd1e7421b7bd4930d132d2d88c80c4b73481b",
    },
  },
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
        {/* Wave 1231 (2026-06-09): GA4 (G-Z2KRCXE0LK) — 구글애즈 회원가입 전환 측정용. */}
        {/* eslint-disable-next-line @next/next/next-script-for-ga */}
        <script src="https://www.googletagmanager.com/gtag/js?id=G-Z2KRCXE0LK" async />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z2KRCXE0LK');`,
          }}
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
                  // Wave launch-118 (2026-05-24): alternateName — 구글 검색 결과 sitename "Vercel" → "득템잡이" 유도.
                  alternateName: ["득템잡이", "Deuktem Jabi", "minyoi"],
                  description: "중고 매물 시세 비교 — AI가 알려주는 알뜰 득템 정보",
                  inLanguage: "ko-KR",
                  publisher: { "@id": "https://minyoi-mvp.vercel.app/#org" },
                },
                {
                  "@type": "Organization",
                  "@id": "https://minyoi-mvp.vercel.app/#org",
                  name: "득템잡이",
                  alternateName: ["득템잡이", "Deuktem Jabi"],
                  url: "https://minyoi-mvp.vercel.app/",
                  logo: {
                    "@type": "ImageObject",
                    url: "https://minyoi-mvp.vercel.app/opengraph-image",
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
        {/* Wave 743 (2026-05-24): URL ?ref= 잡아서 localStorage 저장 + 인증 후 자동 claim */}
        <ReferralCapture />
        {/* Wave 746 (2026-05-24): balance UPDATE 감지 → universal 토스트 (레퍼럴 / 카톡 / 결제 보너스 모두) */}
        <BalanceToast />
        {/* Wave 800 (2026-05-27): 카카오 OAuth 가입 시 telegram 알림 누락 fix — SIGNED_IN 감지 시 flushPendingConsents 자동 호출 */}
        <ConsentFlusher />
        {/* Wave 1231: 신규 가입 완료 시 GA4 sign_up 이벤트 (광고 전환). */}
        <GtagSignupTracker />
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
