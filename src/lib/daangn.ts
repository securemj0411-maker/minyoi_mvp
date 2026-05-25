import { createHash } from "node:crypto";

export const DAANGN_SOURCE_ID = "daangn" as const;
export const DAANGN_BASE_URL = "https://www.daangn.com";
export const DAANGN_ROBOTS_URL = `${DAANGN_BASE_URL}/robots.txt`;

// pid namespace (joongna = 7_000_000_000_000+, bunjang = native, daangn = 9_000_000_000_000+).
// String slug ID 를 deterministic 64-bit hash 로 변환해서 bigint pid 로 매핑.
const DAANGN_PID_BASE = 9_000_000_000_000;

export function daangnInternalPid(externalId: string): number {
  if (!externalId) throw new Error("daangnInternalPid: empty externalId");
  const digest = createHash("sha256").update(`${DAANGN_SOURCE_ID}:${externalId}`).digest();
  const hash32 = digest.readUInt32BE(0);
  return DAANGN_PID_BASE + hash32;
}

export function parseDaangnExternalId(href: string): string | null {
  if (!href) return null;
  // /kr/buy-sell/<slug>/
  const m = /\/kr\/buy-sell\/([^/?#]+)\/?/.exec(href);
  if (!m) return null;
  return decodeURIComponent(m[1]);
}

export type DaangnSourceMode = "off" | "probe" | "active";

export type DaangnBlockSignal = {
  blocked: boolean;
  reason: string | null;
  status: number;
};

export type DaangnFetchResult = {
  ok: boolean;
  url: string;
  status: number;
  contentType: string;
  body: string;
  blockSignal: DaangnBlockSignal;
};

export type DaangnRegionSeed = {
  name: string;
  id: string;
};

export type DaangnCategorySeed = {
  name: string;
  id: number;
};

export type DaangnQuerySeed = {
  label: string;
  search: string;
  categoryIds: number[];
};

export type DaangnSearchArticle = {
  id: string;
  href: string;
  title: string | null;
  price: number | null;
  status: string | null;
  content: string | null;
  thumbnail: string | null;
  createdAt: string | null;
  boostedAt: string | null;
  favoriteCount: number | null;
  chatCount: number | null;
  viewCount: number | null;
  region: {
    dbId: string | null;
    name: string | null;
  };
  category: {
    dbId: string | null;
    name: string | null;
  };
  user: {
    dbId: string | null;
    nickname: string | null;
    webCrawlNotAllowed: boolean;
  };
};

export type DaangnDetailArticle = DaangnSearchArticle & {
  user: DaangnSearchArticle["user"] & {
    score: number | null;
    reviewCount: number | null;
    profileImage: string | null;
    regionName: string | null;
  };
  recommendedCount: number | null;
  commentCount: number | null;
};

export type DaangnSearchProbeCombo = {
  region: DaangnRegionSeed;
  query: DaangnQuerySeed;
  category: DaangnCategorySeed;
  url: string;
  ok: boolean;
  status: number;
  blockSignal: DaangnBlockSignal;
  currentFilters: {
    regionId: string | null;
    categoryId: string | null;
    search: string | null;
  };
  result: DaangnSearchSummary;
};

export type DaangnSearchSummary = {
  total: number;
  ongoing: number;
  crawlAllowedOngoing: number;
  reserved: number;
  closed: number;
  freshBoosted24h: number;
  activeBoosted72h: number;
  staleBoostedOverDays: number;
  latestBoostedAt: string | null;
  regionTop: Array<{ name: string; count: number }>;
  samples: Array<{
    title: string | null;
    price: number | null;
    boostedAt: string | null;
    region: string | null;
    href: string;
    sellerNickname: string | null;
  }>;
};

export type DaangnProbeReport = {
  source: typeof DAANGN_SOURCE_ID;
  mode: DaangnSourceMode;
  writable: false;
  robots: {
    ok: boolean;
    status: number;
    disallow: string[];
    sitemaps: string[];
    blockSignal: DaangnBlockSignal;
    note: string;
  };
  searchedAt: string;
  probe: {
    regions: DaangnRegionSeed[];
    queries: DaangnQuerySeed[];
    categories: DaangnCategorySeed[];
    requestedCombos: number;
    executedCombos: number;
    delayMs: number;
    freshWindowHours: number;
    activeWindowHours: number;
    staleBoostedDays: number;
  };
  totals: {
    articles: number;
    ongoing: number;
    crawlAllowedOngoing: number;
    freshBoosted24h: number;
    activeBoosted72h: number;
    uniqueOngoingUrls: number;
    detailSamplesFetched: number;
    blockedCombos: number;
    failedCombos: number;
  };
  combos: DaangnSearchProbeCombo[];
  detailSamples: DaangnDetailArticle[];
  cadenceRecommendation: string[];
  decision: "disabled" | "source_safe_to_continue_probe_only" | "stop_on_block_or_error";
};

export type DaangnProbeOptions = {
  mode?: DaangnSourceMode;
  regions?: DaangnRegionSeed[];
  queries?: DaangnQuerySeed[];
  categories?: DaangnCategorySeed[];
  maxCombos?: number;
  maxDetailSamples?: number;
  delayMs?: number;
  timeoutMs?: number;
  freshWindowHours?: number;
  activeWindowHours?: number;
  staleBoostedDays?: number;
};

type RemixContext = {
  state?: {
    loaderData?: Record<string, unknown>;
  };
};

const TRANSPARENT_USER_AGENT =
  process.env.DAANGN_USER_AGENT ??
  `MinyoiDaangnProbe/0.1 (+${process.env.SOURCE_CONTACT_URL ?? process.env.SOURCE_CONTACT_EMAIL ?? "contact: operator"})`;

const DEFAULT_HEADERS = {
  "User-Agent": TRANSPARENT_USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.6",
};

export const DAANGN_FASHION_CATEGORIES: DaangnCategorySeed[] = [
  { id: 14, name: "남성패션/잡화" },
  { id: 31, name: "여성잡화" },
  { id: 5, name: "여성의류" },
];

export const DEFAULT_DAANGN_REGION_SEEDS: DaangnRegionSeed[] = [
  { id: "366", name: "서초4동" },
  { id: "6091", name: "사당동" },
  { id: "6126", name: "반포동" },
];

export const DEFAULT_DAANGN_FASHION_QUERY_SEEDS: DaangnQuerySeed[] = [
  { label: "shoe", search: "나이키 덩크", categoryIds: [14, 31] },
  { label: "shoe", search: "아디다스 삼바", categoryIds: [14, 31] },
  { label: "shoe", search: "뉴발란스 993", categoryIds: [14, 31] },
  { label: "clothing", search: "아크테릭스 베타", categoryIds: [14, 5] },
  { label: "clothing", search: "슈프림 노스페이스", categoryIds: [14, 5] },
  { label: "clothing", search: "파타고니아 자켓", categoryIds: [14, 5] },
];

type DaangnEnv = Record<string, string | undefined>;

export function getDaangnSourceMode(env: DaangnEnv = process.env): DaangnSourceMode {
  const value = String(env.DAANGN_SOURCE_MODE ?? env.MARKET_SOURCE_DAANGN_MODE ?? "").trim().toLowerCase();
  if (value === "active" || value === "probe") return value;
  return "off";
}

export function isDaangnRuntimeEnabled(env: DaangnEnv = process.env): boolean {
  return getDaangnSourceMode(env) === "active";
}

function statusBlockReason(status: number): string | null {
  if (status === 401 || status === 403 || status === 451) return `http_${status}_access_denied`;
  if (status === 429) return "http_429_rate_limited";
  if (status === 503) return "http_503_source_unavailable";
  return null;
}

export function detectDaangnBlockSignal(input: {
  status: number;
  contentType?: string | null;
  bodyPreview?: string | null;
}): DaangnBlockSignal {
  const statusReason = statusBlockReason(input.status);
  if (statusReason) return { blocked: true, reason: statusReason, status: input.status };

  const body = String(input.bodyPreview ?? "").slice(0, 5000).toLowerCase();
  const challengeHits = [
    "captcha",
    "recaptcha",
    "hcaptcha",
    "access denied",
    "too many requests",
    "unusual traffic",
    "비정상적인 접근",
    "자동화된 접근",
    "접근이 제한",
    "요청이 많",
  ];
  const hit = challengeHits.find((token) => body.includes(token));
  if (hit) return { blocked: true, reason: `challenge_${hit.replace(/\s+/g, "_")}`, status: input.status };

  return { blocked: false, reason: null, status: input.status };
}

export async function fetchDaangnText(url: string, timeoutMs = 10_000): Promise<DaangnFetchResult> {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
  });
  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();
  const blockSignal = detectDaangnBlockSignal({
    status: res.status,
    contentType,
    bodyPreview: body,
  });
  return {
    ok: res.ok && !blockSignal.blocked,
    url: res.url || url,
    status: res.status,
    contentType,
    body,
    blockSignal,
  };
}

export function buildDaangnSearchUrl(input: {
  search: string;
  regionId: string;
  categoryId?: number | string | null;
}): string {
  const params = new URLSearchParams();
  params.set("in", input.regionId);
  if (input.categoryId != null && String(input.categoryId).trim()) {
    params.set("category_id", String(input.categoryId).trim());
  }
  params.set("search", input.search);
  // Keep the query form, not /kr/buy-sell/s/*, because the latter is disallowed
  // in robots.txt for generic crawlers.
  return `${DAANGN_BASE_URL}/kr/buy-sell/?${params.toString()}`;
}

function decodeHtmlEntity(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function parseRobotsTxt(text: string): { disallow: string[]; sitemaps: string[] } {
  const disallow: string[] = [];
  const sitemaps: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const sitemap = /^sitemap:\s*(.+)$/i.exec(trimmed)?.[1]?.trim();
    if (sitemap) {
      sitemaps.push(sitemap);
      continue;
    }
    const disallowed = /^disallow:\s*(.+)$/i.exec(trimmed)?.[1]?.trim();
    if (disallowed) disallow.push(disallowed);
  }
  return { disallow, sitemaps };
}

export function extractDaangnRemixContext(html: string): RemixContext | null {
  const match = html.replace(/\0/g, "").match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(decodeHtmlEntity(match[1])) as RemixContext;
  } catch {
    return null;
  }
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function toDaangnArticle(raw: unknown): DaangnSearchArticle | null {
  const row = objectRecord(raw);
  if (!row) return null;
  const href = stringValue(row.href) ?? stringValue(row.id);
  if (!href) return null;
  const region = objectRecord(row.region) ?? objectRecord(row.regionId);
  const category = objectRecord(row.category);
  const user = objectRecord(row.user);
  return {
    id: stringValue(row.id) ?? href,
    href,
    title: stringValue(row.title),
    price: numberValue(row.price),
    status: stringValue(row.status),
    content: stringValue(row.content),
    thumbnail: stringValue(row.thumbnail),
    createdAt: stringValue(row.createdAt),
    boostedAt: stringValue(row.boostedAt),
    favoriteCount: numberValue(row.favoriteCount),
    chatCount: numberValue(row.chatCount),
    viewCount: numberValue(row.viewCount),
    region: {
      dbId: stringValue(region?.dbId),
      name: stringValue(region?.name),
    },
    category: {
      dbId: stringValue(category?.dbId),
      name: stringValue(category?.name),
    },
    user: {
      dbId: stringValue(user?.dbId),
      nickname: stringValue(user?.nickname),
      webCrawlNotAllowed: booleanValue(user?.webCrawlNotAllowed),
    },
  };
}

function findDaangnSearchLoader(context: RemixContext | null): Record<string, unknown> | null {
  const loaderData = context?.state?.loaderData;
  if (!loaderData) return null;
  return objectRecord(loaderData["routes/kr.buy-sell._index"]);
}

export function parseDaangnSearchHtml(html: string): {
  articles: DaangnSearchArticle[];
  currentFilters: {
    regionId: string | null;
    categoryId: string | null;
    search: string | null;
  };
} {
  const loader = findDaangnSearchLoader(extractDaangnRemixContext(html));
  const allPage = objectRecord(loader?.allPage);
  const rawArticles = Array.isArray(allPage?.fleamarketArticles) ? allPage.fleamarketArticles : [];
  const currentFilters = objectRecord(loader?.currentFilters);
  return {
    articles: rawArticles.map(toDaangnArticle).filter((article): article is DaangnSearchArticle => Boolean(article)),
    currentFilters: {
      regionId: stringValue(currentFilters?.regionId),
      categoryId: stringValue(currentFilters?.categoryId),
      search: stringValue(currentFilters?.search),
    },
  };
}

function findDaangnDetailArticle(context: RemixContext | null): Record<string, unknown> | null {
  const seen = new Set<unknown>();
  const stack: unknown[] = [context];
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const child of value) stack.push(child);
      continue;
    }
    const row = value as Record<string, unknown>;
    if (row.title && row.price && (row.viewCount !== undefined || row.chatCount !== undefined || row.favoriteCount !== undefined)) {
      return row;
    }
    for (const child of Object.values(row)) stack.push(child);
  }
  return null;
}

export function parseDaangnDetailHtml(html: string): DaangnDetailArticle | null {
  const raw = findDaangnDetailArticle(extractDaangnRemixContext(html));
  const base = toDaangnArticle(raw);
  if (!base || !raw) return null;
  const user = objectRecord(raw.user);
  const userRegion = objectRecord(user?.region);
  return {
    ...base,
    user: {
      ...base.user,
      score: numberValue(user?.score),
      reviewCount: numberValue(user?.reviewCount),
      profileImage: stringValue(user?.profileImage),
      regionName: stringValue(userRegion?.name),
    },
    recommendedCount: Array.isArray(raw.recommendedArticles) ? raw.recommendedArticles.length : null,
    commentCount: Array.isArray(raw.comments) ? raw.comments.length : null,
  };
}

function ageHours(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, (nowMs - ms) / 3_600_000);
}

export function shouldFetchDaangnDetailCandidate(
  article: DaangnSearchArticle,
  options: {
    activeWindowHours: number;
    nowMs?: number;
  },
): boolean {
  if (article.status !== "Ongoing") return false;
  if (article.user.webCrawlNotAllowed) return false;
  const hours = ageHours(article.boostedAt ?? article.createdAt, options.nowMs ?? Date.now());
  if (hours == null) return false;
  return hours <= options.activeWindowHours;
}

export function summarizeDaangnArticles(
  articles: DaangnSearchArticle[],
  options: {
    freshWindowHours: number;
    activeWindowHours: number;
    staleBoostedDays: number;
    nowMs?: number;
  },
): DaangnSearchSummary {
  const nowMs = options.nowMs ?? Date.now();
  const ongoing = articles.filter((article) => article.status === "Ongoing");
  const crawlAllowedOngoing = ongoing.filter((article) => !article.user.webCrawlNotAllowed);
  const regionCounts = new Map<string, number>();
  for (const article of articles) {
    const key = article.region.name ?? "(unknown)";
    regionCounts.set(key, (regionCounts.get(key) ?? 0) + 1);
  }
  const freshness = (article: DaangnSearchArticle) => ageHours(article.boostedAt ?? article.createdAt, nowMs);
  const sortedOngoing = [...crawlAllowedOngoing].sort((a, b) => {
    const aMs = Date.parse(a.boostedAt ?? a.createdAt ?? "");
    const bMs = Date.parse(b.boostedAt ?? b.createdAt ?? "");
    return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
  });
  const staleHours = options.staleBoostedDays * 24;
  return {
    total: articles.length,
    ongoing: ongoing.length,
    crawlAllowedOngoing: crawlAllowedOngoing.length,
    reserved: articles.filter((article) => article.status === "Reserved").length,
    closed: articles.filter((article) => article.status === "Closed").length,
    freshBoosted24h: crawlAllowedOngoing.filter((article) => {
      const hours = freshness(article);
      return hours != null && hours <= options.freshWindowHours;
    }).length,
    activeBoosted72h: crawlAllowedOngoing.filter((article) => {
      const hours = freshness(article);
      return hours != null && hours <= options.activeWindowHours;
    }).length,
    staleBoostedOverDays: crawlAllowedOngoing.filter((article) => {
      const hours = freshness(article);
      return hours != null && hours > staleHours;
    }).length,
    latestBoostedAt: sortedOngoing[0]?.boostedAt ?? sortedOngoing[0]?.createdAt ?? null,
    regionTop: [...regionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count })),
    samples: sortedOngoing.slice(0, 5).map((article) => ({
      title: article.title,
      price: article.price,
      boostedAt: article.boostedAt,
      region: article.region.name,
      href: article.href,
      sellerNickname: article.user.nickname,
    })),
  };
}

function sumCombos(combos: DaangnSearchProbeCombo[], key: keyof DaangnSearchSummary): number {
  return combos.reduce((sum, combo) => {
    const value = combo.result[key];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

export async function probeDaangnPublicSource(options: DaangnProbeOptions = {}): Promise<DaangnProbeReport> {
  const mode = options.mode ?? getDaangnSourceMode();
  const nowMs = Date.now();
  const freshWindowHours = options.freshWindowHours ?? 24;
  const activeWindowHours = options.activeWindowHours ?? 72;
  const staleBoostedDays = options.staleBoostedDays ?? 21;
  const delayMs = options.delayMs ?? 650;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const regions = options.regions?.length ? options.regions : DEFAULT_DAANGN_REGION_SEEDS;
  const categories = options.categories?.length ? options.categories : DAANGN_FASHION_CATEGORIES;
  const queries = options.queries?.length ? options.queries : DEFAULT_DAANGN_FASHION_QUERY_SEEDS;
  const maxCombos = Math.max(0, options.maxCombos ?? 18);

  const robotsResult = await fetchDaangnText(DAANGN_ROBOTS_URL, timeoutMs);
  const robotsParsed = robotsResult.ok ? parseRobotsTxt(robotsResult.body) : { disallow: [], sitemaps: [] };

  const combosToRun: Array<{ region: DaangnRegionSeed; query: DaangnQuerySeed; category: DaangnCategorySeed }> = [];
  for (const region of regions) {
    for (const query of queries) {
      for (const categoryId of query.categoryIds) {
        const category = categories.find((entry) => entry.id === categoryId);
        if (!category) continue;
        combosToRun.push({ region, query, category });
      }
    }
  }

  const combos: DaangnSearchProbeCombo[] = [];
  const detailCandidates = new Map<string, DaangnSearchArticle>();
  const uniqueOngoingUrls = new Set<string>();
  for (const combo of combosToRun.slice(0, maxCombos)) {
    if (combos.length > 0 && delayMs > 0) await sleep(delayMs);
    const url = buildDaangnSearchUrl({
      regionId: combo.region.id,
      search: combo.query.search,
      categoryId: combo.category.id,
    });
    const fetched = await fetchDaangnText(url, timeoutMs);
    const parsed = fetched.ok ? parseDaangnSearchHtml(fetched.body) : {
      articles: [],
      currentFilters: { regionId: null, categoryId: null, search: null },
    };
    const result = summarizeDaangnArticles(parsed.articles, {
      freshWindowHours,
      activeWindowHours,
      staleBoostedDays,
      nowMs,
    });
    for (const article of parsed.articles) {
      if (article.status === "Ongoing" && !article.user.webCrawlNotAllowed) {
        uniqueOngoingUrls.add(article.href);
      }
    }
    for (const article of parsed.articles) {
      if (!shouldFetchDaangnDetailCandidate(article, { activeWindowHours, nowMs })) continue;
      detailCandidates.set(article.href, article);
    }
    combos.push({
      ...combo,
      url,
      ok: fetched.ok,
      status: fetched.status,
      blockSignal: fetched.blockSignal,
      currentFilters: parsed.currentFilters,
      result,
    });
  }

  const detailSamples: DaangnDetailArticle[] = [];
  for (const article of [...detailCandidates.values()].slice(0, Math.max(0, options.maxDetailSamples ?? 5))) {
    if (detailSamples.length > 0 && delayMs > 0) await sleep(delayMs);
    const fetched = await fetchDaangnText(article.href, timeoutMs);
    if (!fetched.ok) continue;
    const detail = parseDaangnDetailHtml(fetched.body);
    if (detail) detailSamples.push(detail);
  }

  const blockedCombos = combos.filter((combo) => combo.blockSignal.blocked).length;
  const failedCombos = combos.filter((combo) => !combo.ok).length;
  const shouldStop = robotsResult.blockSignal.blocked || blockedCombos > 0 || (combos.length > 0 && failedCombos === combos.length);

  return {
    source: DAANGN_SOURCE_ID,
    mode,
    writable: false,
    robots: {
      ok: robotsResult.ok,
      status: robotsResult.status,
      disallow: robotsParsed.disallow,
      sitemaps: robotsParsed.sitemaps,
      blockSignal: robotsResult.blockSignal,
      note: "Probe uses /kr/buy-sell/?query form and does not call /kr/buy-sell/s/*.",
    },
    searchedAt: new Date(nowMs).toISOString(),
    probe: {
      regions,
      queries,
      categories,
      requestedCombos: combosToRun.length,
      executedCombos: combos.length,
      delayMs,
      freshWindowHours,
      activeWindowHours,
      staleBoostedDays,
    },
    totals: {
      articles: sumCombos(combos, "total"),
      ongoing: sumCombos(combos, "ongoing"),
      crawlAllowedOngoing: sumCombos(combos, "crawlAllowedOngoing"),
      freshBoosted24h: sumCombos(combos, "freshBoosted24h"),
      activeBoosted72h: sumCombos(combos, "activeBoosted72h"),
      uniqueOngoingUrls: uniqueOngoingUrls.size,
      detailSamplesFetched: detailSamples.length,
      blockedCombos,
      failedCombos,
    },
    combos,
    detailSamples,
    cadenceRecommendation: [
      "Use boostedAt as the primary poll cursor; createdAt is secondary because sellers frequently bump old listings.",
      "Fetch detail only for Ongoing + crawl-allowed + active-window search hits; search pages include many Closed rows.",
      "Poll hot fashion seeds every 15-30 minutes only after low-rate soak; cold seeds can run every 2-4 hours.",
      "Treat Danggeun as direct-trade-first: expose region before credit reveal and do not assume shipping unless text says so.",
    ],
    decision: mode === "off" ? "disabled" : shouldStop ? "stop_on_block_or_error" : "source_safe_to_continue_probe_only",
  };
}
