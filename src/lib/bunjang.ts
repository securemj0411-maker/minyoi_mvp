// 번개장터 API 호출 — 검색 + 상세.

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
};

export type DetailData = {
  description: string;
  saleStatus: string;
  shopReviewRating: number | null;
  shopReviewCount: number;
  tradeData: unknown;
  tradesData: unknown;
  imageUrlTemplate: string | null;
  imageCount: number;
  thumbnailUrl: string | null;
};

function toInt(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export function buildBunjangImageUrl(template: string | null | undefined, index = 1, res = 856): string | null {
  if (!template) return null;
  return template.replace("{cnt}", String(index)).replace("{res}", String(res));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function searchPage(query: string, page: number): Promise<SearchItem[]> {
  const url = new URL(`${API_BASE}/api/1/find_v2.json`);
  url.searchParams.set("q", query);
  url.searchParams.set("order", "score");
  url.searchParams.set("page", String(page));
  url.searchParams.set("n", "30");
  url.searchParams.set("stat_device", "w");

  try {
    const res = await fetch(url.toString(), { headers: HEADERS });
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
        freeShipping: item.free_shipping === true || item.free_shipping === "1",
        query,
        url: `https://m.bunjang.co.kr/products/${item.pid}`,
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
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data ?? {};
    const product = data?.product ?? {};
    const shop = data?.shop ?? {};
    const metrics = product?.metrics ?? {};
    const imageUrlTemplate = typeof product?.imageUrl === "string" ? product.imageUrl : null;
    const imageCount = toInt(product?.imageCount);
    return {
      description: String(product?.description ?? "").slice(0, 500),
      saleStatus: String(product?.saleStatus ?? ""),
      shopReviewRating: product?.inspectionStatus != null || shop?.reviewRating != null
        ? Number(shop?.reviewRating ?? 0) || null
        : null,
      shopReviewCount: toInt(shop?.reviewCount),
      tradeData: product?.trade ?? null,
      tradesData: product?.trades ?? null,
      imageUrlTemplate,
      imageCount,
      thumbnailUrl: buildBunjangImageUrl(imageUrlTemplate, 1, 856),
    };
    void metrics;
  } catch {
    return null;
  }
}
