import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

export const JOONGNA_SOURCE_ID = "joongna" as const;
export const JOONGNA_BASE_URL = "https://web.joongna.com";
export const JOONGNA_RECENT_PRODUCT_INDEX_URL = `${JOONGNA_BASE_URL}/sitemap-recent-product-index.xml.gz`;

export type JoongnaSourceMode = "off" | "shadow" | "active";

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
  decision: "disabled" | "shadow_safe_to_continue" | "stop_on_block_or_error";
};

const TRANSPARENT_USER_AGENT =
  process.env.JOONGNA_USER_AGENT ??
  `MinyoiSourceProbe/0.1 (+${process.env.SOURCE_CONTACT_URL ?? process.env.SOURCE_CONTACT_EMAIL ?? "contact: operator"})`;

const DEFAULT_HEADERS = {
  "User-Agent": TRANSPARENT_USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.6",
};

function normalizeMode(raw: string | null | undefined): JoongnaSourceMode {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "shadow" || value === "active") return value;
  return "off";
}

export function getJoongnaSourceMode(env: NodeJS.ProcessEnv = process.env): JoongnaSourceMode {
  return normalizeMode(env.JOONGNA_SOURCE_MODE ?? env.MARKET_SOURCE_JOONGNA_MODE);
}

export function isJoongnaRuntimeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
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
  env?: NodeJS.ProcessEnv;
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
    decision: blockSignals.some((signal) => signal.blocked) ? "stop_on_block_or_error" : "shadow_safe_to_continue",
  };
}
