// Wave 46 — AI cache retention live housekeeper.
//
// Reads `public.mvp_listing_ai_cache_retention_v1` (Wave 35 view) and DELETEs
// rows that match R1 (stale_by_age, age >30d) or R2 (raw_row_gone, FK CASCADE
// 누수 sentinel). R3 (raw_updated_after_classify) candidates는 *제외* — view
// 자체가 proxy이므로 false-positive 방지 위해 contentHash 재확인 path가 별도
// merge될 때까지 본 wave에서는 관찰만 한다. 다음 wave에서 contentHash 더블체크 추가.
//
// 본 wave 기준 baseline R1/R2/R3 = 0/0/0 (Wave 45 측정).

import { restFetch, serviceHeaders } from "@/lib/supabase-rest";

const RETENTION_VIEW = "mvp_listing_ai_cache_retention_v1";
const CACHE_TABLE = "mvp_listing_ai_classifications";
const DELETE_CHUNK = 100;

export type AiCachePruneResult = {
  candidates_r1: number;
  candidates_r2: number;
  observed_r3: number; // 관찰만, 본 wave에서 DELETE 안 함
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

export async function runAiCachePrune(): Promise<AiCachePruneResult> {
  const result: AiCachePruneResult = {
    candidates_r1: 0,
    candidates_r2: 0,
    observed_r3: 0,
    deleted: 0,
    view_available: false,
  };

  try {
    // Probe view existence cheaply: count R3 (proxy probe; failure indicates view absent).
    result.observed_r3 = await countByFilter("r3_raw_updated_after_classify=is.true");
    result.view_available = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }

  try {
    result.candidates_r1 = await countByFilter("r1_stale_by_age=is.true");
    result.candidates_r2 = await countByFilter("r2_raw_row_gone=is.true");

    if (result.candidates_r1 === 0 && result.candidates_r2 === 0) {
      return result; // nothing to do; common during low-age baseline.
    }

    const r1Pids = await selectPidsByFilter("r1_stale_by_age=is.true");
    const r2Pids = await selectPidsByFilter("r2_raw_row_gone=is.true");
    const allPids = Array.from(new Set([...r1Pids, ...r2Pids]));
    result.deleted = await deletePids(allPids);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}
