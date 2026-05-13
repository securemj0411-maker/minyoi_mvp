// Wave 51 Phase A — reparse 14,887 auto-safe stale parser_version rows.
// 500-row chunks, 30s sleep between. Per-chunk metrics. needs-owner rows excluded.
// Stop conditions checked.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { parseListingOptions } from "@/lib/option-parser";
import { restFetch, serviceHeaders } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const STALE_VERSIONS = ["option-parser-v24","option-parser-v26","option-parser-v27","option-parser-v28","option-parser-v29","option-parser-v30"];
const PAGE_SIZE = 1000;
const HARD_LIMIT = 16_000;
const CHUNK_SIZE = 500;
const SLEEP_MS = 30_000;

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

type Row = {
  pid: number;
  parser_version: string;
  category: string | null;
  comparable_key: string | null;
  parse_confidence: number | string | null;
  needs_review: boolean | null;
  parsed_json: Record<string, unknown> | null;
  raw: { name: string; description_preview: string } | null;
};

function parseConf(v: number | string | null): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

async function fetchPage(offset: number, limit: number): Promise<Row[]> {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const versions = STALE_VERSIONS.map((v) => `"${v}"`).join(",");
  const url = `${base}/rest/v1/mvp_listing_parsed?select=pid,parser_version,category,comparable_key,parse_confidence,needs_review,parsed_json,raw:mvp_raw_listings!inner(name,description_preview)&parser_version=in.(${versions})&order=pid.asc&offset=${offset}&limit=${limit}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`page failed ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchPoolPids(): Promise<Set<number>> {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const res = await restFetch(`${base}/rest/v1/mvp_candidate_pool?select=pid&limit=5000`, { headers: serviceHeaders() });
  if (!res.ok) return new Set();
  const rows = (await res.json()) as Array<{ pid: number | string }>;
  return new Set(rows.map((r) => Number(r.pid)));
}

type Payload = {
  pid: number;
  parser_version: string;
  category: string | null;
  comparable_key: string | null;
  parse_confidence: number;
  needs_review: boolean;
  parsed_json: Record<string, unknown>;
};

async function patchChunk(payloads: Payload[]): Promise<{ ok: boolean; status: number; bodySnippet: string }> {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = `${base}/rest/v1/mvp_listing_parsed?on_conflict=pid`;
  const res = await restFetch(url, {
    method: "POST",
    headers: {
      ...serviceHeaders(),
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(payloads),
  });
  const ok = res.ok;
  const bodySnippet = ok ? "" : (await res.text().catch(() => "")).slice(0, 400);
  return { ok, status: res.status, bodySnippet };
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));

  // 1. Pull pool pids and all stale rows.
  const poolPids = await fetchPoolPids();
  const all: Row[] = [];
  let offset = 0;
  while (offset < HARD_LIMIT) {
    const page = await fetchPage(offset, PAGE_SIZE);
    if (page.length === 0) break;
    all.push(...page);
    offset += page.length;
    if (page.length < PAGE_SIZE) break;
  }
  console.log(`[scope] pulled ${all.length} stale rows, pool pids=${poolPids.size}`);

  // 2. Classify + build auto-safe payloads.
  const autoSafePayloads: Payload[] = [];
  const storageResolvePids: number[] = [];
  const counts = {
    auto_safe_no_change: 0,
    auto_safe_storage_resolve: 0,
    excluded_needs_owner_pool_member: 0,
    excluded_needs_owner_nr_flip: 0,
    excluded_needs_owner_confidence_drop: 0,
    excluded_needs_owner_sku_shift: 0,
    excluded_needs_owner_category_shift: 0,
    excluded_blocked: 0,
  };

  for (const row of all) {
    if (!row.raw) { counts.excluded_blocked += 1; continue; }
    let out;
    try {
      out = parseListingOptions({
        title: row.raw.name,
        description: row.raw.description_preview ?? "",
        category: (row.category as Parameters<typeof parseListingOptions>[0]["category"]) ?? null,
        skuId: String((row.parsed_json as Record<string, unknown> | null)?.raw_sku_id ?? ""),
        skuName: String((row.parsed_json as Record<string, unknown> | null)?.raw_sku_name ?? ""),
      });
    } catch {
      counts.excluded_blocked += 1; continue;
    }
    const beforeKey = row.comparable_key;
    const afterKey = out.comparableKey ?? null;
    const beforeSku = String((row.parsed_json as Record<string, unknown> | null)?.raw_sku_id ?? "");
    const afterSku = String(((out.parsedJson ?? {}) as Record<string, unknown>).raw_sku_id ?? "");
    const beforeCat = row.category;
    const afterCat = out.category ?? null;
    const beforeConf = parseConf(row.parse_confidence);
    const afterConf = out.parseConfidence ?? 0;
    const beforeNR = row.needs_review ?? null;
    const afterNR = out.needsReview ?? false;
    const storageBefore = beforeKey?.match(/(\d+gb|unknown_storage)/)?.[1] ?? null;
    const storageAfter = afterKey?.match(/(\d+gb|unknown_storage)/)?.[1] ?? null;

    // Exclusion order matches Wave 50 classifier priorities.
    if (poolPids.has(Number(row.pid)) && (beforeKey !== afterKey || beforeSku !== afterSku || beforeCat !== afterCat)) {
      counts.excluded_needs_owner_pool_member += 1; continue;
    }
    if (beforeSku && afterSku && beforeSku !== afterSku) {
      counts.excluded_needs_owner_sku_shift += 1; continue;
    }
    if (beforeCat && afterCat && beforeCat !== afterCat) {
      counts.excluded_needs_owner_category_shift += 1; continue;
    }
    if (beforeNR === false && afterNR === true) {
      counts.excluded_needs_owner_nr_flip += 1; continue;
    }
    if (beforeConf - afterConf >= 0.15) {
      counts.excluded_needs_owner_confidence_drop += 1; continue;
    }

    // Classify auto-safe variant
    if (storageBefore === "unknown_storage" && storageAfter && storageAfter !== "unknown_storage") {
      counts.auto_safe_storage_resolve += 1;
      storageResolvePids.push(row.pid);
    } else {
      counts.auto_safe_no_change += 1;
    }
    autoSafePayloads.push({
      pid: row.pid,
      parser_version: out.parserVersion,
      category: out.category ?? null,
      comparable_key: out.comparableKey ?? null,
      parse_confidence: out.parseConfidence,
      needs_review: out.needsReview,
      parsed_json: out.parsedJson,
    });
  }

  const expected = 14_887;
  console.log(`[scope] auto-safe count=${autoSafePayloads.length} (expected ${expected})`);
  console.log(`[scope] counts=${JSON.stringify(counts)}`);

  if (autoSafePayloads.length !== expected) {
    console.error(`[abort] expected ${expected} auto-safe rows but got ${autoSafePayloads.length}. count drift — investigate before apply.`);
    process.exit(2);
  }

  // 3. Chunked apply.
  const chunkLogs: Array<Record<string, unknown>> = [];
  const start = Date.now();
  let totalApplied = 0;
  let totalErrors = 0;

  for (let i = 0; i < autoSafePayloads.length; i += CHUNK_SIZE) {
    const chunk = autoSafePayloads.slice(i, i + CHUNK_SIZE);
    const chunkIdx = Math.floor(i / CHUNK_SIZE) + 1;
    const t0 = Date.now();
    const res = await patchChunk(chunk);
    const elapsed = Date.now() - t0;
    if (!res.ok) {
      totalErrors += 1;
      chunkLogs.push({ chunk: chunkIdx, ok: false, status: res.status, body: res.bodySnippet, elapsed_ms: elapsed, applied: 0 });
      console.error(`[abort] chunk ${chunkIdx} failed status=${res.status} body=${res.bodySnippet}`);
      break; // stop condition: update error
    }
    totalApplied += chunk.length;
    chunkLogs.push({ chunk: chunkIdx, ok: true, status: res.status, elapsed_ms: elapsed, applied: chunk.length, cumulative: totalApplied });
    console.log(`[chunk ${chunkIdx}] applied=${chunk.length} cumulative=${totalApplied}/${autoSafePayloads.length} elapsed=${elapsed}ms`);
    if (i + CHUNK_SIZE < autoSafePayloads.length) {
      await sleep(SLEEP_MS);
    }
  }
  const totalElapsed = Date.now() - start;

  const summary = {
    wave: 51,
    phase: "A",
    measured_at: new Date().toISOString(),
    target_count: expected,
    pulled_stale_count: all.length,
    classifier_counts: counts,
    apply_results: {
      total_applied: totalApplied,
      total_errors: totalErrors,
      chunks: chunkLogs.length,
      total_elapsed_ms: totalElapsed,
      storage_resolve_pids_count: storageResolvePids.length,
      storage_resolve_pids_sample: storageResolvePids.slice(0, 10),
    },
    chunk_logs: chunkLogs,
  };
  await mkdir(path.join(appDir, "reports"), { recursive: true });
  await writeFile(path.join(appDir, "reports/wave51-phase-a-apply-latest.json"), JSON.stringify(summary, null, 2));
  console.log(`[done] applied=${totalApplied} errors=${totalErrors} elapsed=${totalElapsed}ms`);
}

main().catch((e) => { console.error(e); process.exit(1); });
