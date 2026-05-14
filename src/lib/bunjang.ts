// 번개장터 API 호출 — 검색 + 상세.

import { hashSellerUid } from "./compliance-hashing";

const API_BASE = "https://api.bunjang.co.kr";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  Origin: "https://m.bunjang.co.kr",
  Referer: "https://m.bunjang.co.kr/",
};

export type SearchItem = {
  pid: string;
  name: string;
  price: number;
  numFaved: number;
  freeShipping: boolean;
  query: string;
  url: string;
  sellerUid: string | null;
  sellerProshop: boolean;
  sellerBizseller: boolean;
  location: string | null;
  productImage: string | null;
  updateTime: number | null;
  raw: Record<string, unknown>;
};

export type SearchOrder = "score" | "date";

export type SearchPageOptions = {
  order?: SearchOrder;
  limit?: number;
};

export type DetailData = {
  description: string;
  saleStatus: string;
  conditionLabel: string | null;
  viewCount: number | null;
  favoriteCount: number | null;
  commentCount: number | null;
  shopReviewRating: number | null;
  shopReviewCount: number;
  shopUid: string | null;
  shopName: string | null;
  shopFollowerCount: number;
  shopSalesCount: number;
  shopProshop: boolean;
  shopOfficialSeller: boolean;
  shopJoinDate: string | null;
  shopData: Record<string, unknown>;
  tradeData: unknown;
  tradesData: unknown;
  imageUrlTemplate: string | null;
  imageCount: number;
  thumbnailUrl: string | null;
  imageUrls: string[];
  metricsData: Record<string, unknown>;
};

function toInt(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export function buildBunjangImageUrl(template: string | null | undefined, index = 1, res = 856): string | null {
  if (!template) return null;
  return template.replace("{cnt}", String(index)).replace("{res}", String(res));
}

function stringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
}

function boolish(v: unknown): boolean {
  return v === true || v === "1" || v === 1;
}

function numberOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const n = numberOrNull(value);
    if (n != null) return n;
  }
  return null;
}

function labelFromUnknown(value: unknown): string | null {
  if (typeof value === "string") return stringOrNull(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return stringOrNull(record.label) ?? stringOrNull(record.name) ?? stringOrNull(record.value);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function timeoutSignal(ms: number) {
  return AbortSignal.timeout(Math.max(1_000, ms));
}

// Wave 88: query string이 "category:<id>" prefix를 가지면 카테고리 sweep 모드로 전환.
// f_category_id=<id> 파라미터 사용, q는 생략, req_ref=category.
// 검증: 휴대폰/시계/골프/카메라/오디오 등 11개 L2 ID 동작 확인 (2026-05-15).
// 광고/매입글은 catalog mustNotContain + ruleMatch가 자동 reject (사업 신뢰).
export const CATEGORY_QUERY_PREFIX = "category:";

export function isCategoryQuery(query: string): boolean {
  return query.startsWith(CATEGORY_QUERY_PREFIX);
}

export function parseCategoryQuery(query: string): string | null {
  if (!isCategoryQuery(query)) return null;
  return query.slice(CATEGORY_QUERY_PREFIX.length).trim() || null;
}

export async function searchPage(query: string, page: number, options: SearchPageOptions = {}): Promise<SearchItem[]> {
  const order = options.order ?? "score";
  const limit = Math.max(1, Math.min(96, Math.round(options.limit ?? 30)));
  const categoryId = parseCategoryQuery(query);
  const url = new URL(`${API_BASE}/api/1/find_v2.json`);
  if (categoryId) {
    url.searchParams.set("f_category_id", categoryId);
    url.searchParams.set("req_ref", "category");
  } else {
    url.searchParams.set("q", query);
    url.searchParams.set("req_ref", "search");
  }
  url.searchParams.set("order", order);
  url.searchParams.set("page", String(page));
  url.searchParams.set("n", String(limit));
  url.searchParams.set("stat_device", "w");
  url.searchParams.set("stat_category_required", "1");
  url.searchParams.set("version", "4");

  try {
    const res = await fetch(url.toString(), { headers: HEADERS, signal: timeoutSignal(4_000) });
    if (!res.ok) return [];
    const data = await res.json();
    const list: unknown[] = data?.list ?? [];
    return list.map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        pid: String(item.pid ?? ""),
        name: String(item.name ?? ""),
        price: toInt(item.price),
        numFaved: toInt(item.num_faved),
        freeShipping: boolish(item.free_shipping),
        query,
        url: `https://m.bunjang.co.kr/products/${item.pid}`,
        sellerUid: hashSellerUid(stringOrNull(item.uid)),
        sellerProshop: boolish(item.proshop),
        sellerBizseller: boolish(item.bizseller),
        location: stringOrNull(item.location),
        productImage: stringOrNull(item.product_image),
        updateTime: Number.isFinite(Number(item.update_time)) ? Number(item.update_time) : null,
        raw: item,
      };
    }).filter((item) => item.pid);
  } catch {
    return [];
  }
}

export async function collectSearchItems(
  queries: string[],
  pagesPerQuery = 2,
  delayMs = 200,
): Promise<Map<string, SearchItem>> {
  const dedup = new Map<string, SearchItem>();
  for (const query of queries) {
    for (let page = 0; page < pagesPerQuery; page++) {
      const items = await searchPage(query, page);
      for (const item of items) {
        if (!dedup.has(item.pid)) dedup.set(item.pid, item);
      }
      if (delayMs > 0) await sleep(delayMs);
    }
  }
  return dedup;
}

export async function fetchDetail(pid: string): Promise<DetailData | null> {
  const url = `${API_BASE}/api/pms/v1/products/${pid}/detail/web`;
  try {
    const res = await fetch(url, { headers: HEADERS, signal: timeoutSignal(6_000) });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data ?? {};
    const product = data?.product ?? {};
    const shop = data?.shop ?? {};
    const metrics = product?.metrics ?? {};
    const imageUrlTemplate = typeof product?.imageUrl === "string" ? product.imageUrl : null;
    const imageCount = toInt(product?.imageCount);
    const metricsData = metrics && typeof metrics === "object" && !Array.isArray(metrics)
      ? metrics as Record<string, unknown>
      : {};
    const imageUrls = Array.from({ length: Math.min(Math.max(imageCount, 0), 5) }, (_, idx) =>
      buildBunjangImageUrl(imageUrlTemplate, idx + 1, 856),
    ).filter((src): src is string => Boolean(src));
    return {
      description: String(product?.description ?? "").slice(0, 1200),
      saleStatus: String(product?.saleStatus ?? ""),
      conditionLabel:
        labelFromUnknown(product?.condition) ??
        labelFromUnknown(product?.productCondition) ??
        labelFromUnknown(product?.status) ??
        null,
      viewCount: firstNumber(metricsData.viewCount, metricsData.views, metricsData.numViews, product?.viewCount, product?.numViews),
      favoriteCount: firstNumber(metricsData.favoriteCount, metricsData.favorites, metricsData.numFaved, product?.favoriteCount, product?.numFaved),
      commentCount: firstNumber(metricsData.commentCount, metricsData.comments, metricsData.numComments, product?.commentCount, product?.numComments),
      shopReviewRating: product?.inspectionStatus != null || shop?.reviewRating != null
        ? Number(shop?.reviewRating ?? 0) || null
        : null,
      shopReviewCount: toInt(shop?.reviewCount),
      shopUid: hashSellerUid(stringOrNull(shop?.uid == null ? null : String(shop.uid))),
      shopName: null,
      shopFollowerCount: toInt(shop?.followerCount),
      shopSalesCount: toInt(shop?.salesCount),
      shopProshop: boolish(shop?.proshop && typeof shop.proshop === "object" ? (shop.proshop as Record<string, unknown>).isProshop : null),
      shopOfficialSeller: boolish(shop?.isOfficialSeller),
      shopJoinDate: stringOrNull(shop?.joinDate),
      shopData: shop && typeof shop === "object" && !Array.isArray(shop) ? shop as Record<string, unknown> : {},
      tradeData: product?.trade ?? null,
      tradesData: product?.trades ?? null,
      imageUrlTemplate,
      imageCount,
      thumbnailUrl: buildBunjangImageUrl(imageUrlTemplate, 1, 856),
      imageUrls,
      metricsData,
    };
  } catch {
    return null;
  }
}
