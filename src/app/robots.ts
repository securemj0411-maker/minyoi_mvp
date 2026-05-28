// Wave 106: 검색 엔진 indexing 정책.
// public 페이지는 허용 / 사용자 데이터 (api, me, debug, admin) 는 차단.

import type { MetadataRoute } from "next";

import { PUBLIC_SITE_PATHS, SITE_ORIGIN } from "@/lib/public-site-map";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: PUBLIC_SITE_PATHS.map((entry) => entry.path),
        disallow: ["/api/", "/me/", "/debug/", "/admin/", "/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/", "/billing/checkout/", "/peek-pool-7f3kz9"],
      },
    ],
    sitemap: [`${SITE_ORIGIN}/sitemap.xml`, `${SITE_ORIGIN}/sitemap-main.xml`],
  };
}
