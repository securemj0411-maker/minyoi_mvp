// Wave 106: sitemap — 검색 엔진이 public 페이지 발견할 수 있게.

import type { MetadataRoute } from "next";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://minyoi-mvp.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_ORIGIN}/`, lastModified, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_ORIGIN}/how-it-works`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_ORIGIN}/plans`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_ORIGIN}/login`, lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_ORIGIN}/privacy`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_ORIGIN}/terms`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_ORIGIN}/refund-policy`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_ORIGIN}/youth-policy`, lastModified, changeFrequency: "monthly", priority: 0.3 },
  ];
}
