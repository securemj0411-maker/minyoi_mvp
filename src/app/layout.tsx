import type { Metadata, Viewport } from "next";
import AppFooter from "@/components/app-footer";
import AppNav from "@/components/app-nav";
import SafetyStatsMarquee from "@/components/safety-stats-marquee";
import "./globals.css";

// Wave 106: 모바일 viewport + theme color (브라우저 상단 색).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Wave 106: SEO 보강. 한국어 자연어 + 키워드 (중고 / 리셀 / AI / 번개장터 / 시세 / 가격 차익).
// 정직 톤 — "보장" 어휘 X, "추천" 위주.
const SITE_NAME = "차익잡이";
const TAGLINE = "중고 리셀 추천 — AI가 시세 비교해주는 가격 차익 매물";
const DESCRIPTION = "번개장터 매물의 시세를 AI가 비교해서, 가격 차익이 큰 상품만 추천해드립니다. 옵션 같은 본품끼리만 비교하고, 공개 직전 판매 상태를 다시 확인합니다.";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  description: DESCRIPTION,
  keywords: ["중고", "리셀", "리셀러", "번개장터", "시세", "가격 차익", "AI 추천", "중고 거래", "에어팟", "애플워치", "아이패드"],
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
      </head>
      <body className="min-h-full flex flex-col">
        <AppNav />
        {/* Wave 139d (2026-05-16): 네비 바 아래 marquee — "오늘 차익잡이 AI가 차단한 의심 매물 X건" 우→좌 흐름. */}
        <SafetyStatsMarquee />
        <div className="flex-1">{children}</div>
        <AppFooter />
      </body>
    </html>
  );
}
