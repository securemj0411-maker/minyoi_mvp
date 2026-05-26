// Wave 886 (2026-05-27): SKU 일반 이미지 폴백 — 매물 식별 anti-leak.
// mvp_sku_images (sku_name PK, image_url) 를 메모리에 캐시하고 thumbnail 해소 시 우선 사용.

import { restFetch, serviceHeaders, tableUrl } from "./supabase-rest";

type Cache = {
  map: Map<string, string>;
  expiresAt: number;
};

let cache: Cache | null = null;

const TTL_MS = 5 * 60 * 1000;

export async function loadSkuImageMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cache && now < cache.expiresAt) return cache.map;
  try {
    const res = await restFetch(
      `${tableUrl("mvp_sku_images")}?select=sku_name,image_url`,
      { headers: serviceHeaders() },
    );
    const rows = (await res.json()) as Array<{ sku_name: string; image_url: string }>;
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.sku_name && r.image_url) map.set(r.sku_name, r.image_url);
    }
    cache = { map, expiresAt: now + TTL_MS };
    return map;
  } catch {
    // 폴백 실패해도 운영 끊지 말 것 — 빈 map 리턴하면 호출부가 원본 thumbnail로 fallback
    return cache?.map ?? new Map();
  }
}

export function resolveGenericImage(
  skuImageMap: Map<string, string>,
  skuName: string | null | undefined,
): string | null {
  if (!skuName) return null;
  return skuImageMap.get(skuName) ?? null;
}
