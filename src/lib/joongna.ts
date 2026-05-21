import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

export const JOONGNA_SOURCE_ID = "joongna" as const;
export const JOONGNA_BASE_URL = "https://web.joongna.com";
export const JOONGNA_MAIN_API_BASE_URL = "https://main-api.joongna.com";
export const JOONGNA_BOOT_API_BASE_URL = "https://boot.joongna.com";
export const JOONGNA_RECENT_PRODUCT_INDEX_URL = `${JOONGNA_BASE_URL}/sitemap-recent-product-index.xml.gz`;

export type JoongnaSourceMode = "off" | "active";

export type JoongnaBlockSignal = {
  blocked: boolean;
  reason: string | null;
  status: number;
};

export type JoongnaFetchResult = {
  ok: boolean;
  url: string;
  status: number;
  contentType: string;
  body: string;
  blockSignal: JoongnaBlockSignal;
};

export type JoongnaProbeReport = {
  source: typeof JOONGNA_SOURCE_ID;
  mode: JoongnaSourceMode;
  writable: false;
  robots: {
    ok: boolean;
    status: number;
    disallow: string[];
    sitemaps: string[];
    blockSignal: JoongnaBlockSignal;
  };
  recentProductIndex: {
    ok: boolean;
    status: number;
    sitemapCount: number;
    sampledSitemaps: string[];
    blockSignal: JoongnaBlockSignal;
  };
  sampledProducts: {
    requestedSitemaps: number;
    urlCount: number;
    sample: string[];
    blockSignals: JoongnaBlockSignal[];
  };
  decision: "disabled" | "source_safe_to_continue" | "stop_on_block_or_error";
};

export type JoongnaDetail = {
  source: typeof JOONGNA_SOURCE_ID;
  externalId: string;
  internalPid: number;
  url: string;
  ok: boolean;
  status: number;
  blockSignal: JoongnaBlockSignal;
  title: string | null;
  description: string | null;
  price: number | null;
  productStatus: number | null;
  categoryName: string | null;
  categorySeq: string | null;
  parcelFeeYn: number | null;
  productTradeType: number | null;
  storeSeq: number | null;
  nickName: string | null;
  sellerProfileImageUrl: string | null;
  sellerStoreAbout: string | null;
  sellerUserType: number | null;
  sellerActivityScore: number | null;
  sellerReliabilityScore: number | null;
  sellerReviewCount: number | null;
  sellerFollowerCount: number | null;
  sellerSafeOrderSalesCount: number | null;
  sellerSafeOrderPurchasesCount: number | null;
  sellerSafeOrderSalesText: string | null;
  commentCount: number | null;
  viewCount: number | null;
  labels: string[];
  thumbnailUrl: string | null;
  imageCount: number;
  sortDate: string | null;
  updateDate: string | null;
  sourceUpdatedAt: string | null;
};

export type JoongnaSellerStoreInfo = {
  storeSeq: number;
  nickName: string | null;
  userType: number | null;
  profileImageUrl: string | null;
  activityScore: number | null;
  reliabilityScore: number | null;
  reviewCount: number | null;
  followerCount: number | null;
  storeAbout: string | null;
  businessInfo: unknown;
};

export type JoongnaOrderTransactionCount = {
  salesCount: number | null;
  purchasesCount: number | null;
  safeOrderSalesCntText: string | null;
};

const TRANSPARENT_USER_AGENT =
  process.env.JOONGNA_USER_AGENT ??
  `MinyoiSourceProbe/0.1 (+${process.env.SOURCE_CONTACT_URL ?? process.env.SOURCE_CONTACT_EMAIL ?? "contact: operator"})`;

const DEFAULT_HEADERS = {
  "User-Agent": TRANSPARENT_USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.6",
};

const API_HEADERS = {
  ...DEFAULT_HEADERS,
  Accept: "application/json,text/plain,*/*",
  Origin: JOONGNA_BASE_URL,
  Referer: `${JOONGNA_BASE_URL}/`,
  "Os-Type": "2",
};

function normalizeMode(raw: string | null | undefined): JoongnaSourceMode {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "active") return value;
  return "off";
}

type JoongnaEnv = Record<string, string | undefined>;

export function getJoongnaSourceMode(env: JoongnaEnv = process.env): JoongnaSourceMode {
  return normalizeMode(env.JOONGNA_SOURCE_MODE ?? env.MARKET_SOURCE_JOONGNA_MODE);
}

export function isJoongnaRuntimeEnabled(env: JoongnaEnv = process.env): boolean {
  return getJoongnaSourceMode(env) !== "off";
}

function statusBlockReason(status: number): string | null {
  if (status === 401 || status === 403 || status === 451) return `http_${status}_access_denied`;
  if (status === 429) return "http_429_rate_limited";
  if (status === 503) return "http_503_source_unavailable";
  return null;
}

export function detectJoongnaBlockSignal(input: {
  status: number;
  contentType?: string | null;
  bodyPreview?: string | null;
}): JoongnaBlockSignal {
  const statusReason = statusBlockReason(input.status);
  if (statusReason) return { blocked: true, reason: statusReason, status: input.status };

  const body = String(input.bodyPreview ?? "").slice(0, 5000).toLowerCase();
  const contentType = String(input.contentType ?? "").toLowerCase();
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

  if (input.status >= 500 && contentType.includes("text/html") && body.includes("cloudfront")) {
    return { blocked: true, reason: `edge_error_${input.status}`, status: input.status };
  }
  return { blocked: false, reason: null, status: input.status };
}

function decodeMaybeGzip(bytes: ArrayBuffer, url: string, contentType: string): string {
  const buffer = Buffer.from(bytes);
  const shouldGunzip =
    url.endsWith(".gz") ||
    contentType.includes("gzip") ||
    (buffer[0] === 0x1f && buffer[1] === 0x8b);
  const decoded = shouldGunzip ? gunzipSync(buffer) : buffer;
  return decoded.toString("utf8");
}

export async function fetchJoongnaText(url: string, timeoutMs = 10_000): Promise<JoongnaFetchResult> {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
  });
  const contentType = res.headers.get("content-type") ?? "";
  const body = decodeMaybeGzip(await res.arrayBuffer(), url, contentType);
  const blockSignal = detectJoongnaBlockSignal({
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

async function fetchJoongnaApiJson<T>(url: string, timeoutMs = 10_000): Promise<T | null> {
  const res = await fetch(url, {
    headers: API_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
  });
  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();
  const blockSignal = detectJoongnaBlockSignal({ status: res.status, contentType, bodyPreview: body });
  if (!res.ok || blockSignal.blocked || !contentType.includes("json")) return null;

  try {
    const parsed = JSON.parse(body) as { data?: T; meta?: { code?: number; status?: string } };
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function fetchJoongnaSellerStoreInfo(
  storeSeq: number,
  timeoutMs = 10_000,
): Promise<JoongnaSellerStoreInfo | null> {
  if (!Number.isFinite(storeSeq) || storeSeq <= 0) return null;
  const data = await fetchJoongnaApiJson<Record<string, unknown>>(
    `${JOONGNA_MAIN_API_BASE_URL}/user/info/product-detail?storeSeq=${encodeURIComponent(String(storeSeq))}`,
    timeoutMs,
  );
  if (!data) return null;
  return {
    storeSeq,
    nickName: nullableString(data.nickName),
    userType: finiteNumber(data.userType),
    profileImageUrl: nullableString(data.profileImageUrl),
    activityScore: finiteNumber(data.activityScore),
    reliabilityScore: finiteNumber(data.reliabilityScore),
    reviewCount: finiteNumber(data.reviewCount),
    followerCount: finiteNumber(data.followerCount),
    storeAbout: nullableString(data.storeAbout),
    businessInfo: data.businessInfo ?? null,
  };
}

export async function fetchJoongnaOrderTransactionCount(
  storeSeq: number,
  timeoutMs = 10_000,
): Promise<JoongnaOrderTransactionCount | null> {
  if (!Number.isFinite(storeSeq) || storeSeq <= 0) return null;
  const data = await fetchJoongnaApiJson<Record<string, unknown>>(
    `${JOONGNA_BOOT_API_BASE_URL}/api-order/transactions/count?storeSeq=${encodeURIComponent(String(storeSeq))}`,
    timeoutMs,
  );
  if (!data) return null;
  return {
    salesCount: finiteNumber(data.salesCount),
    purchasesCount: finiteNumber(data.purchasesCount),
    safeOrderSalesCntText: nullableString(data.safeOrderSalesCntText),
  };
}

export function extractSitemapLocs(xml: string): string[] {
  const locs = new Set<string>();
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  for (const match of xml.matchAll(re)) {
    const value = match[1]?.trim().replace(/&amp;/g, "&");
    if (value?.startsWith("https://")) locs.add(value);
  }
  return [...locs];
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

export function joongnaInternalPid(externalId: string): number {
  const digest = createHash("sha256").update(`${JOONGNA_SOURCE_ID}:${externalId}`).digest();
  const hash32 = digest.readUInt32BE(0);
  return 7_000_000_000_000 + hash32;
}

export function parseJoongnaProductExternalId(url: string): string | null {
  try {
    const parsed = new URL(url, JOONGNA_BASE_URL);
    const match = /\/product\/([^/?#]+)/.exec(parsed.pathname);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
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

function decodeReactFlightString(value: string | undefined): string | null {
  if (value == null) return null;
  try {
    return (JSON.parse(`"${value}"`) as string)
      .replace(/\\n/g, "\n")
      .replace(/\\u0026/g, "&");
  } catch {
    return value
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, "\"")
      .replace(/\\u0026/g, "&")
      .replace(/\\\\/g, "\\");
  }
}

function escapedStringField(html: string, key: string): string | null {
  const pattern = new RegExp(`\\\\"${key}\\\\"\\s*:\\s*\\\\"((?:\\\\\\\\.|[^\\\\"])*)\\\\"`);
  return decodeReactFlightString(pattern.exec(html)?.[1]);
}

function escapedNumberField(html: string, key: string): number | null {
  const pattern = new RegExp(`\\\\"${key}\\\\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`);
  const raw = pattern.exec(html)?.[1];
  if (raw == null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function metaContent(html: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\s+${escaped}\\s+content="([^"]*)"`, "i");
  const value = pattern.exec(html)?.[1];
  return value ? decodeHtmlEntity(value) : null;
}

function parseKstDateTime(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(" ", "T");
  const ms = Date.parse(`${normalized}+09:00`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function extractJoongnaImageUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(/https:\/\/img\d+\.joongna\.com\/[^"'\\<\s]+/g)) {
    urls.add(decodeHtmlEntity(match[0]).replace(/\\u0026/g, "&"));
  }
  return [...urls];
}

function extractJoongnaLabels(html: string): string[] {
  const labelsBlock = /\\"labels\\"\s*:\s*\[((?:\\.|[^\]])*)\]/.exec(html)?.[1];
  if (!labelsBlock) return [];
  const labels = new Set<string>();
  for (const match of labelsBlock.matchAll(/\\"((?:\\\\.|[^\\"])*)\\"/g)) {
    const label = decodeReactFlightString(match[1]);
    if (label) labels.add(label);
  }
  return [...labels];
}

export function parseJoongnaDetailHtml(url: string, html: string, status = 200): JoongnaDetail {
  const externalId = parseJoongnaProductExternalId(url) ?? "";
  const contentType = "text/html";
  const blockSignal = detectJoongnaBlockSignal({ status, contentType, bodyPreview: html });
  const productStatus = escapedNumberField(html, "productStatus");
  const sortDate = escapedStringField(html, "sortDate");
  const updateDate = escapedStringField(html, "updateDate");
  const images = extractJoongnaImageUrls(html);
  const ogImage = metaContent(html, 'property="og:image"');
  const thumbnailUrl = images[0] ?? ogImage ?? null;
  const title =
    escapedStringField(html, "productTitle") ??
    metaContent(html, 'property="og:title"') ??
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ??
    null;
  const description =
    escapedStringField(html, "productDescription") ??
    metaContent(html, 'property="og:description"') ??
    metaContent(html, 'name="description"');

  return {
    source: JOONGNA_SOURCE_ID,
    externalId,
    internalPid: externalId ? joongnaInternalPid(externalId) : 0,
    url,
    ok: status >= 200 && status < 300 && !blockSignal.blocked,
    status,
    blockSignal,
    title,
    description,
    price: escapedNumberField(html, "productPrice"),
    productStatus,
    categoryName: escapedStringField(html, "categoryName"),
    categorySeq: escapedStringField(html, "categorySeq"),
    parcelFeeYn: escapedNumberField(html, "parcelFeeYn"),
    productTradeType: escapedNumberField(html, "productTradeType"),
    storeSeq: escapedNumberField(html, "storeSeq"),
    nickName: escapedStringField(html, "nickName"),
    sellerProfileImageUrl: null,
    sellerStoreAbout: null,
    sellerUserType: null,
    sellerActivityScore: null,
    sellerReliabilityScore: null,
    sellerReviewCount: null,
    sellerFollowerCount: null,
    sellerSafeOrderSalesCount: null,
    sellerSafeOrderPurchasesCount: null,
    sellerSafeOrderSalesText: null,
    // Joongna product pages do not expose a Bunjang-style public comment count.
    // The chat-count endpoint exists but returned 403 in no-write probing, so
    // we keep this null instead of inventing a popularity gate from unavailable data.
    commentCount: null,
    viewCount: escapedNumberField(html, "viewCount"),
    labels: extractJoongnaLabels(html),
    thumbnailUrl,
    imageCount: images.length,
    sortDate,
    updateDate,
    sourceUpdatedAt: parseKstDateTime(updateDate) ?? parseKstDateTime(sortDate),
  };
}

export async function fetchJoongnaDetail(url: string, timeoutMs = 10_000): Promise<JoongnaDetail> {
  const fetched = await fetchJoongnaText(url, timeoutMs);
  return parseJoongnaDetailHtml(fetched.url || url, fetched.body, fetched.status);
}

export async function fetchJoongnaSearchProductUrls(keyword: string, options: {
  limit?: number;
  timeoutMs?: number;
} = {}): Promise<string[]> {
  const limit = Math.max(1, Math.min(100, Math.round(options.limit ?? 30)));
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? 10_000);
  const url = `${JOONGNA_BASE_URL}/search/${encodeURIComponent(keyword.trim())}`;
  const fetched = await fetchJoongnaText(url, timeoutMs);
  if (!fetched.ok) return [];
  const urls = new Set<string>();
  for (const match of fetched.body.matchAll(/\/product\/(\d+)/g)) {
    urls.add(`${JOONGNA_BASE_URL}/product/${match[1]}`);
    if (urls.size >= limit) break;
  }
  return [...urls];
}

function stopReport(mode: JoongnaSourceMode, robots: JoongnaProbeReport["robots"], recentProductIndex: JoongnaProbeReport["recentProductIndex"]): JoongnaProbeReport {
  return {
    source: JOONGNA_SOURCE_ID,
    mode,
    writable: false,
    robots,
    recentProductIndex,
    sampledProducts: {
      requestedSitemaps: 0,
      urlCount: 0,
      sample: [],
      blockSignals: [],
    },
    decision: mode === "off" ? "disabled" : "stop_on_block_or_error",
  };
}

export async function probeJoongnaPublicSource(options: {
  maxSitemaps?: number;
  maxProductUrls?: number;
  timeoutMs?: number;
  env?: JoongnaEnv;
} = {}): Promise<JoongnaProbeReport> {
  const mode = getJoongnaSourceMode(options.env);
  const maxSitemaps = Math.max(0, Math.min(3, Math.round(options.maxSitemaps ?? 1)));
  const maxProductUrls = Math.max(0, Math.min(100, Math.round(options.maxProductUrls ?? 20)));
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? 10_000);
  const disabledBlock = { blocked: false, reason: null, status: 0 };
  const disabledRobots = { ok: false, status: 0, disallow: [], sitemaps: [], blockSignal: disabledBlock };
  const disabledIndex = { ok: false, status: 0, sitemapCount: 0, sampledSitemaps: [], blockSignal: disabledBlock };
  if (mode === "off") return stopReport(mode, disabledRobots, disabledIndex);

  const robotsFetch = await fetchJoongnaText(`${JOONGNA_BASE_URL}/robots.txt`, timeoutMs);
  const robotsParsed = parseRobotsTxt(robotsFetch.body);
  const robots = {
    ok: robotsFetch.ok,
    status: robotsFetch.status,
    disallow: robotsParsed.disallow,
    sitemaps: robotsParsed.sitemaps,
    blockSignal: robotsFetch.blockSignal,
  };
  if (!robots.ok) return stopReport(mode, robots, disabledIndex);

  const indexFetch = await fetchJoongnaText(JOONGNA_RECENT_PRODUCT_INDEX_URL, timeoutMs);
  const sitemapUrls = extractSitemapLocs(indexFetch.body);
  const sampledSitemaps = sitemapUrls.slice(0, maxSitemaps);
  const recentProductIndex = {
    ok: indexFetch.ok,
    status: indexFetch.status,
    sitemapCount: sitemapUrls.length,
    sampledSitemaps,
    blockSignal: indexFetch.blockSignal,
  };
  if (!recentProductIndex.ok) return stopReport(mode, robots, recentProductIndex);

  const productUrls: string[] = [];
  const blockSignals: JoongnaBlockSignal[] = [];
  for (const sitemapUrl of sampledSitemaps) {
    const sitemapFetch = await fetchJoongnaText(sitemapUrl, timeoutMs);
    if (!sitemapFetch.ok) {
      blockSignals.push(sitemapFetch.blockSignal);
      break;
    }
    productUrls.push(...extractSitemapLocs(sitemapFetch.body));
    if (productUrls.length >= maxProductUrls) break;
  }
  const sample = [...new Set(productUrls)].slice(0, maxProductUrls);
  return {
    source: JOONGNA_SOURCE_ID,
    mode,
    writable: false,
    robots,
    recentProductIndex,
    sampledProducts: {
      requestedSitemaps: sampledSitemaps.length,
      urlCount: sample.length,
      sample,
      blockSignals,
    },
    decision: blockSignals.some((signal) => signal.blocked) ? "stop_on_block_or_error" : "source_safe_to_continue",
  };
}
