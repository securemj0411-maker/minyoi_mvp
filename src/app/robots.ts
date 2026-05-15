// Wave 106: 검색 엔진 indexing 정책.
// public 페이지는 허용 / 사용자 데이터 (api, me, debug, admin) 는 차단.

import type { MetadataRoute } from "next";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://minyoi-mvp.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/plans", "/how-it-works", "/login", "/signup", "/privacy", "/terms", "/refund-policy", "/youth-policy"],
        disallow: ["/api/", "/me/", "/debug/", "/admin/", "/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/", "/billing/checkout/"],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
