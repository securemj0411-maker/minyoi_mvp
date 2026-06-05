import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

type Headers = Record<string, string>;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type FeedSnapshotContext = {
  regionKey: string | null | undefined;
  source: "bunjang" | "joongna" | "daangn" | null;
  budget: "150k" | "300k" | "500k" | "unlimited";
  sort: "profit_desc" | "latest" | "price_asc" | "distance";
  preference: "safe" | "balanced" | "aggressive";
  extendedMarketplaces: boolean;
  pageSize: number;
};

export type FeedSnapshotHit<T> = {
  items: T[];
  cacheKey: string;
  updatedAt: string | null;
  expiresAt: string | null;
  itemCount: number;
};

type SnapshotRow = {
  payload: unknown;
  item_count: number | null;
  updated_at: string | null;
  expires_at: string | null;
};

const FEED_SNAPSHOT_VERSION = "v1";
const FEED_SNAPSHOT_TTL_MS = intEnv("REGION_FEED_SNAPSHOT_TTL_MS", 90_000, 5_000, 10 * 60_000);

function intEnv(name: string, fallback: number, min: number, max: number) {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(raw)));
}

function normalizeKeyPart(value: string | null | undefined, fallback: string) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  return normalized || fallback;
}

export function feedSnapshotCacheKey(context: FeedSnapshotContext) {
  return [
    FEED_SNAPSHOT_VERSION,
    normalizeKeyPart(context.regionKey, "global"),
    context.source ?? "all",
    context.budget,
    context.sort,
    context.preference,
    context.extendedMarketplaces ? "extended" : "local",
    `limit:${context.pageSize}`,
  ].join("|");
}

function asJsonArray(value: unknown): JsonValue[] | null {
  if (!Array.isArray(value)) return null;
  return JSON.parse(JSON.stringify(value)) as JsonValue[];
}

function extractPids(items: readonly unknown[]) {
  const pids: number[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const pid = Number((item as { pid?: unknown }).pid);
    if (Number.isFinite(pid)) pids.push(pid);
  }
  return pids;
}

export function canUseFeedSnapshot(options: {
  refresh: boolean;
  excludePids: readonly number[];
  regionKey: string | null | undefined;
}) {
  return !options.refresh && options.excludePids.length === 0 && Boolean(normalizeKeyPart(options.regionKey, ""));
}

export async function readFeedSnapshot<T>(
  context: FeedSnapshotContext,
  headers: Headers = serviceHeaders(),
): Promise<FeedSnapshotHit<T> | null> {
  const cacheKey = feedSnapshotCacheKey(context);
  const now = encodeURIComponent(new Date().toISOString());
  const res = await restFetch(
    `${tableUrl("mvp_region_feed_snapshots")}?select=payload,item_count,updated_at,expires_at&cache_key=eq.${encodeURIComponent(cacheKey)}&expires_at=gt.${now}&limit=1`,
    { headers },
  );
  const rows = (await res.json()) as SnapshotRow[];
  const row = rows[0];
  if (!row) return null;
  if (!Array.isArray(row.payload) || row.payload.length === 0) return null;
  return {
    items: row.payload as T[],
    cacheKey,
    updatedAt: row.updated_at ?? null,
    expiresAt: row.expires_at ?? null,
    itemCount: Number(row.item_count ?? row.payload.length),
  };
}

export async function writeFeedSnapshot(
  context: FeedSnapshotContext,
  items: readonly unknown[],
  headers: Headers = serviceHeaders(),
) {
  if (items.length === 0) return { ok: false, reason: "empty_items" as const };
  const payload = asJsonArray(items);
  if (!payload || payload.length === 0) return { ok: false, reason: "invalid_payload" as const };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + FEED_SNAPSHOT_TTL_MS).toISOString();
  const row = {
    cache_key: feedSnapshotCacheKey(context),
    region_key: normalizeKeyPart(context.regionKey, "global"),
    source_filter: context.source ?? "all",
    budget_filter: context.budget,
    sort_key: context.sort,
    preference_key: context.preference,
    extended_marketplaces: context.extendedMarketplaces,
    page_size: context.pageSize,
    payload,
    item_count: payload.length,
    pids: extractPids(items),
    params_snapshot: {
      version: FEED_SNAPSHOT_VERSION,
      source: context.source ?? "all",
      budget: context.budget,
      sort: context.sort,
      preference: context.preference,
      extendedMarketplaces: context.extendedMarketplaces,
      pageSize: context.pageSize,
      ttlMs: FEED_SNAPSHOT_TTL_MS,
    },
    generated_at: now.toISOString(),
    expires_at: expiresAt,
    updated_at: now.toISOString(),
  };

  await restFetch(`${tableUrl("mvp_region_feed_snapshots")}?on_conflict=cache_key`, {
    method: "POST",
    headers: {
      ...headers,
      prefer: "resolution=merge-duplicates",
    },
    body: jsonBody(row),
  });
  return { ok: true, cacheKey: row.cache_key, expiresAt };
}
