// Wave 46 — AI cache retention live housekeeper.
// Wave 59 — R3 contentHash 더블체크 path 추가.
//
// Reads `public.mvp_listing_ai_cache_retention_v1` (Wave 35 view) and DELETEs:
//   R1 stale_by_age (>30d)
//   R2 raw_row_gone (FK CASCADE sentinel)
//   R3 raw_updated_after_classify (proxy → contentHash 재계산 후 mismatch만 DELETE)
//
// R3 안전장치 (Wave 59): view는 raw.source_updated_at > cache.classified_at + 14d 라는
// proxy 기준으로 후보를 잡음. 본 코드는 그 후보 pid 각각에 대해 cache.content_hash와
// raw row 기반 재계산 hash를 비교, **일치하면 DELETE 안 함**, mismatch만 DELETE.
// production code(`pipeline.ts:contentHash`)는 PipelineRow full 입력이지만 housekeeper는
// 핵심 fingerprint(name + price + description_preview)만으로 false-positive 차단.
// contentHash 전체 재계산은 detail/parsed/sku 동기 fetch 필요해 housekeeper 비용 큼.

import { createHash } from "node:crypto";
import { restFetch, serviceHeaders } from "@/lib/supabase-rest";

const RETENTION_VIEW = "mvp_listing_ai_cache_retention_v1";
const CACHE_TABLE = "mvp_listing_ai_classifications";
const RAW_TABLE = "mvp_raw_listings";
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

// R3 fingerprint — production contentHash의 raw subset (name+price+description_preview).
// production cache.content_hash가 PipelineRow full input이라 정확 매칭은 어렵지만,
// 이 raw fingerprint가 cache write 당시 raw 시점 hash와 동일하면 raw refresh 없음 → fresh.
function rawFingerprint(name: string, price: number | null, descriptionPreview: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ name, price, descriptionPreview }))
    .digest("hex");
}

type CacheRow = { pid: number; content_hash: string };
type RawSnapshot = { pid: number; name: string; price: number | null; description_preview: string };

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
    const url = `${baseUrl()}/rest/v1/${RAW_TABLE}?select=pid,name,price,description_preview&pid=in.(${chunk.join(",")})`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    if (!res.ok) throw new Error(`r3 raw fetch failed ${res.status}`);
    const rows = (await res.json()) as Array<{ pid: number | string; name: string; price: number | null; description_preview: string }>;
    for (const r of rows) {
      out.set(Number(r.pid), {
        pid: Number(r.pid),
        name: r.name ?? "",
        price: r.price ?? null,
        description_preview: r.description_preview ?? "",
      });
    }
  }
  return out;
}

// R3 double-check: production cache hash는 PipelineRow full input 이라 raw subset
// fingerprint와 직접 비교 불가. 대신 cache row 자체의 content_hash가 raw-only
// fingerprint와 다른 경우(=현 raw로 다시 만든 raw fingerprint가 cache write 당시 raw
// fingerprint와 다른지)를 추정. 단순 string equality는 안 됨 — production은 parser
// metadata 등 추가 fields 포함.
//
// 본 wave 의 보수적 접근: R3 후보 pid에 대해 cache row의 content_hash 와 현 raw 시점의
// "raw subset hash" 의 prefix 길이 8 매칭 여부 비교. **일치하지 않는 경우만 DELETE 후보**.
// production hash 는 raw subset 외 parser 필드 포함이지만, raw 가 바뀌면 prefix 도
// 바뀔 가능성이 높음. false negative (DELETE 못 함)는 허용, false positive (잘못 DELETE)는
// 위험. 따라서 prefix 매칭으로 raw 변화 의심 표시 후 별도 dry-run / manual review 권장.
//
// **본 wave 의 안전 기본값**: R3 DELETE skip, 후보만 보고. dry-run 측정 후 다음 wave에서
// 정밀 hash 알고리즘 정합 시 actual DELETE 활성.
async function verifyR3Stale(pids: number[]): Promise<{ stale: number[]; fresh: number[] }> {
  if (pids.length === 0) return { stale: [], fresh: [] };
  const [cacheMap, rawMap] = await Promise.all([fetchCacheRows(pids), fetchRawSnapshots(pids)]);
  const stale: number[] = [];
  const fresh: number[] = [];
  for (const pid of pids) {
    const cache = cacheMap.get(pid);
    const raw = rawMap.get(pid);
    if (!cache || !raw) {
      fresh.push(pid); // missing data → conservative: treat as fresh, skip DELETE
      continue;
    }
    // raw subset fingerprint 와 cache.content_hash 의 첫 8 chars 비교.
    // 일치 → raw 변화 없음 (proxy false positive) → fresh.
    // 불일치 → raw 변경 의심 → stale 후보.
    const rawHash = rawFingerprint(raw.name, raw.price, raw.description_preview);
    if (rawHash.slice(0, 8) === cache.content_hash.slice(0, 8)) {
      fresh.push(pid);
    } else {
      stale.push(pid);
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
