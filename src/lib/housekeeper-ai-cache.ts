// Wave 46 — AI cache retention live housekeeper.
// Wave 59 — R3 contentHash 더블체크 path 추가 (prefix-8 raw subset).
// Wave 63 — R3 정밀 hash 정합: production `contentHash()` 재사용으로 PipelineRow
// 전체 재구성 후 비교. raw + parsed 결합으로 name/price/skuName/descriptionPreview
// + parser metadata 전체 재현. `scoreFlags`만 미보존 → [] 대입 (한계: AI 호출 당시
// flags 있던 row는 변경 없어도 mismatch → 보수적으로 보존, false-negative 허용).

import { restFetch, serviceHeaders } from "@/lib/supabase-rest";
import { contentHash, type PipelineRow } from "@/lib/pipeline";

const RETENTION_VIEW = "mvp_listing_ai_cache_retention_v1";
const CACHE_TABLE = "mvp_listing_ai_classifications";
const RAW_TABLE = "mvp_raw_listings";
const PARSED_TABLE = "mvp_listing_parsed";
const DELETE_CHUNK = 100;
const R3_VERIFY_CHUNK = 50;

export type AiCachePruneResult = {
  candidates_r1: number;
  candidates_r2: number;
  candidates_r3: number;
  r3_hash_verified_stale: number; // contentHash mismatch → DELETE 대상
  r3_hash_verified_fresh: number; // contentHash 일치 → DELETE skip (proxy false-positive)
  deleted: number;
  view_available: boolean;
  error?: string;
};

function baseUrl(): string {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

async function selectPidsByFilter(filter: string, limit = 1000): Promise<number[]> {
  const url = `${baseUrl()}/rest/v1/${RETENTION_VIEW}?select=pid&${filter}&limit=${limit}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`select pids failed ${res.status}: ${await res.text().catch(() => "")}`);
  const rows = (await res.json()) as Array<{ pid: number | string }>;
  return rows.map((r) => Number(r.pid)).filter(Number.isFinite);
}

async function countByFilter(filter: string): Promise<number> {
  const url = `${baseUrl()}/rest/v1/${RETENTION_VIEW}?select=pid&${filter}&limit=1`;
  const res = await restFetch(url, { headers: { ...serviceHeaders(), Prefer: "count=exact" } });
  if (!res.ok) return 0;
  const range = res.headers.get("content-range") ?? "0/0";
  return Number(range.split("/")[1] ?? 0);
}

async function deletePids(pids: number[]): Promise<number> {
  if (pids.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < pids.length; i += DELETE_CHUNK) {
    const chunk = pids.slice(i, i + DELETE_CHUNK);
    const url = `${baseUrl()}/rest/v1/${CACHE_TABLE}?pid=in.(${chunk.join(",")})`;
    const res = await restFetch(url, {
      method: "DELETE",
      headers: { ...serviceHeaders(), Prefer: "return=representation,count=exact" },
    });
    if (!res.ok) {
      throw new Error(`delete chunk failed ${res.status}: ${await res.text().catch(() => "")}`);
    }
    const range = res.headers.get("content-range") ?? "";
    const chunkDeleted = Number(range.split("/")[1] ?? chunk.length);
    deleted += Number.isFinite(chunkDeleted) ? chunkDeleted : chunk.length;
  }
  return deleted;
}

type CacheRow = { pid: number; content_hash: string };
type RawSnapshot = {
  pid: number;
  name: string;
  price: number | null;
  description_preview: string;
  sku_name: string | null;
};
type ParsedSnapshot = {
  pid: number;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
  parsed_json: Record<string, unknown> | null;
};

async function fetchCacheRows(pids: number[]): Promise<Map<number, CacheRow>> {
  const out = new Map<number, CacheRow>();
  if (pids.length === 0) return out;
  for (let i = 0; i < pids.length; i += R3_VERIFY_CHUNK) {
    const chunk = pids.slice(i, i + R3_VERIFY_CHUNK);
    const url = `${baseUrl()}/rest/v1/${CACHE_TABLE}?select=pid,content_hash&pid=in.(${chunk.join(",")})`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    if (!res.ok) throw new Error(`r3 cache fetch failed ${res.status}`);
    const rows = (await res.json()) as Array<{ pid: number | string; content_hash: string }>;
    for (const r of rows) out.set(Number(r.pid), { pid: Number(r.pid), content_hash: r.content_hash });
  }
  return out;
}

async function fetchRawSnapshots(pids: number[]): Promise<Map<number, RawSnapshot>> {
  const out = new Map<number, RawSnapshot>();
  if (pids.length === 0) return out;
  for (let i = 0; i < pids.length; i += R3_VERIFY_CHUNK) {
    const chunk = pids.slice(i, i + R3_VERIFY_CHUNK);
    const url = `${baseUrl()}/rest/v1/${RAW_TABLE}?select=pid,name,price,description_preview,sku_name&pid=in.(${chunk.join(",")})`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    if (!res.ok) throw new Error(`r3 raw fetch failed ${res.status}`);
    const rows = (await res.json()) as Array<{ pid: number | string; name: string; price: number | null; description_preview: string; sku_name: string | null }>;
    for (const r of rows) {
      out.set(Number(r.pid), {
        pid: Number(r.pid),
        name: r.name ?? "",
        price: r.price ?? null,
        description_preview: r.description_preview ?? "",
        sku_name: r.sku_name ?? null,
      });
    }
  }
  return out;
}

async function fetchParsedSnapshots(pids: number[]): Promise<Map<number, ParsedSnapshot>> {
  const out = new Map<number, ParsedSnapshot>();
  if (pids.length === 0) return out;
  for (let i = 0; i < pids.length; i += R3_VERIFY_CHUNK) {
    const chunk = pids.slice(i, i + R3_VERIFY_CHUNK);
    const url = `${baseUrl()}/rest/v1/${PARSED_TABLE}?select=pid,comparable_key,parse_confidence,needs_review,parsed_json&pid=in.(${chunk.join(",")})`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    if (!res.ok) throw new Error(`r3 parsed fetch failed ${res.status}`);
    const rows = (await res.json()) as Array<{
      pid: number | string;
      comparable_key: string | null;
      parse_confidence: number | null;
      needs_review: boolean | null;
      parsed_json: Record<string, unknown> | null;
    }>;
    for (const r of rows) {
      out.set(Number(r.pid), {
        pid: Number(r.pid),
        comparable_key: r.comparable_key,
        parse_confidence: r.parse_confidence,
        needs_review: r.needs_review,
        parsed_json: r.parsed_json,
      });
    }
  }
  return out;
}

// Reconstruct PipelineRow subset matching production `contentHash()` inputs.
// `scoreFlags` is not persisted anywhere → defaults to [] (known limitation).
// Other input fields (name, price, skuName, descriptionPreview, parser metadata)
// are fully recoverable from raw + parsed tables.
function reconstructHashRow(raw: RawSnapshot, parsed: ParsedSnapshot | undefined): PipelineRow {
  const parsedJson = parsed?.parsed_json ?? null;
  const unknownParts = Array.isArray(parsedJson?.unknownParts)
    ? (parsedJson!.unknownParts as unknown[]).map(String)
    : [];
  const criticalUnknown = Array.isArray(parsedJson?.criticalUnknown)
    ? (parsedJson!.criticalUnknown as unknown[]).map(String)
    : [];
  const escrowKind = typeof parsedJson?.escrowKind === "string" ? (parsedJson!.escrowKind as string) : null;
  return {
    pid: String(raw.pid),
    url: "",
    name: raw.name,
    price: raw.price ?? 0,
    skuId: "",
    skuName: raw.sku_name ?? "",
    skuMedian: 0,
    descriptionPreview: raw.description_preview,
    priceGap: 0,
    numFaved: 0,
    velocity: 0,
    reviewRating: null,
    reviewCount: 0,
    safety: 0,
    riskHits: 0,
    score: 0,
    scoreFlags: [],
    parseConfidence: parsed?.parse_confidence ?? null,
    parserNeedsReview: parsed?.needs_review ?? null,
    comparableKey: parsed?.comparable_key ?? null,
    parserUnknownParts: unknownParts,
    parserCriticalUnknown: criticalUnknown,
    aiEscrowKind: escrowKind,
    shippingFee: 0,
    shippingFeeGeneral: null,
    shippingSource: "",
    estimatedBuyCost: 0,
    grossResellGap: 0,
    netGapAfterShipping: 0,
  };
}

// R3 precise verify (Wave 63): reconstruct full PipelineRow subset from raw +
// parsed, run identical production `contentHash()`. Exact equality → fresh.
// Mismatch → stale candidate. scoreFlags=[] known limitation; rows with flags
// at AI call time will mismatch and be kept conservatively (false-negative OK,
// false-positive DELETE blocked unless r3DeleteEnabled).
async function verifyR3Stale(pids: number[]): Promise<{ stale: number[]; fresh: number[] }> {
  if (pids.length === 0) return { stale: [], fresh: [] };
  const [cacheMap, rawMap, parsedMap] = await Promise.all([
    fetchCacheRows(pids),
    fetchRawSnapshots(pids),
    fetchParsedSnapshots(pids),
  ]);
  const stale: number[] = [];
  const fresh: number[] = [];
  for (const pid of pids) {
    const cache = cacheMap.get(pid);
    const raw = rawMap.get(pid);
    if (!cache || !raw) {
      fresh.push(pid); // missing data → conservative: treat as fresh
      continue;
    }
    const reconstructed = reconstructHashRow(raw, parsedMap.get(pid));
    const reconstructedHash = contentHash(reconstructed);
    if (reconstructedHash === cache.content_hash) {
      fresh.push(pid); // exact match → raw + parser + sku unchanged → safe to keep
    } else {
      stale.push(pid); // mismatch → either raw/parser/sku changed OR scoreFlags differed
    }
  }
  return { stale, fresh };
}

export async function runAiCachePrune(options?: { r3DeleteEnabled?: boolean }): Promise<AiCachePruneResult> {
  const r3DeleteEnabled = options?.r3DeleteEnabled === true;
  const result: AiCachePruneResult = {
    candidates_r1: 0,
    candidates_r2: 0,
    candidates_r3: 0,
    r3_hash_verified_stale: 0,
    r3_hash_verified_fresh: 0,
    deleted: 0,
    view_available: false,
  };

  try {
    // Probe view existence + R3 candidates count.
    result.candidates_r3 = await countByFilter("r3_raw_updated_after_classify=is.true");
    result.view_available = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }

  try {
    result.candidates_r1 = await countByFilter("r1_stale_by_age=is.true");
    result.candidates_r2 = await countByFilter("r2_raw_row_gone=is.true");

    // R1 + R2 unconditional DELETE (Wave 46 design — safe)
    const r1Pids = result.candidates_r1 > 0 ? await selectPidsByFilter("r1_stale_by_age=is.true") : [];
    const r2Pids = result.candidates_r2 > 0 ? await selectPidsByFilter("r2_raw_row_gone=is.true") : [];

    // R3 verification + conditional DELETE (Wave 59)
    let r3DeletePids: number[] = [];
    if (result.candidates_r3 > 0) {
      const r3Pids = await selectPidsByFilter("r3_raw_updated_after_classify=is.true");
      const verified = await verifyR3Stale(r3Pids);
      result.r3_hash_verified_stale = verified.stale.length;
      result.r3_hash_verified_fresh = verified.fresh.length;
      if (r3DeleteEnabled) {
        r3DeletePids = verified.stale;
      }
    }

    const allPids = Array.from(new Set([...r1Pids, ...r2Pids, ...r3DeletePids]));
    if (allPids.length > 0) {
      result.deleted = await deletePids(allPids);
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}
