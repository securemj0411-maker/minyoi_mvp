// Wave 106: sitemap — 검색 엔진이 public 페이지 발견할 수 있게.

import type { MetadataRoute } from "next";

import { PUBLIC_SITE_PATHS, publicUrl } from "@/lib/public-site-map";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_SITE_PATHS.map((entry) => ({
    url: publicUrl(entry.path),
    lastModified,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
