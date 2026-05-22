import type { Metadata, Viewport } from "next";
import AppFooter from "@/components/app-footer";
import AppNav from "@/components/app-nav";
import SiteHelpFaq from "@/components/site-help-faq";
import "./globals.css";

// Wave 106: 모바일 viewport + theme color (브라우저 상단 색).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
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
  },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} — ${TAGLINE}`, description: DESCRIPTION },
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
      </head>
      <body className="min-h-full flex flex-col">
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
