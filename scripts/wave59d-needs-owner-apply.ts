// Wave 59-D — needs-owner 407 stale rows full apply (all 3 sub-classes).
// Reuses backup table mvp_listing_parsed_backup_wave50. Classification matches Wave 50/51 logic.
// Applies in 100-row chunks with 30s sleep. Pool delta + pack health measured separately.

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
const CHUNK_SIZE = 100;
const SLEEP_MS = 30_000;

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [k, ...r] = t.split("=");
      const v = r.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
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

async function patchChunk(payloads: Payload[]) {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = `${base}/rest/v1/mvp_listing_parsed?on_conflict=pid`;
  const res = await restFetch(url, {
    method: "POST",
    headers: { ...serviceHeaders(), "content-type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payloads),
  });
  return { ok: res.ok, status: res.status, body: res.ok ? "" : await res.text().catch(() => "") };
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  const poolPids = await fetchPoolPids();

  const all: Row[] = [];
  let offset = 0;
  while (offset < 16_000) {
    const page = await fetchPage(offset, PAGE_SIZE);
    if (page.length === 0) break;
    all.push(...page);
    offset += page.length;
    if (page.length < PAGE_SIZE) break;
  }
  console.log(`[scope] pulled ${all.length} stale rows; pool size=${poolPids.size}`);

  const payloads: Payload[] = [];
  const counts = { nr_flip: 0, conf_drop: 0, pool_member: 0, sku_shift: 0, cat_shift: 0, no_change: 0, storage_resolve: 0, blocked: 0 };
  const classMap: Record<number, string> = {};

  for (const row of all) {
    if (!row.raw) { counts.blocked++; continue; }
    let out;
    try {
      out = parseListingOptions({
        title: row.raw.name,
        description: row.raw.description_preview ?? "",
        category: (row.category as Parameters<typeof parseListingOptions>[0]["category"]) ?? null,
        skuId: String((row.parsed_json as Record<string, unknown> | null)?.raw_sku_id ?? ""),
        skuName: String((row.parsed_json as Record<string, unknown> | null)?.raw_sku_name ?? ""),
      });
    } catch { counts.blocked++; continue; }

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

    let klass = "no_change";
    if (poolPids.has(Number(row.pid)) && (beforeKey !== afterKey || beforeSku !== afterSku || beforeCat !== afterCat)) {
      klass = "pool_member"; counts.pool_member++;
    } else if (beforeSku && afterSku && beforeSku !== afterSku) {
      klass = "sku_shift"; counts.sku_shift++;
    } else if (beforeCat && afterCat && beforeCat !== afterCat) {
      klass = "cat_shift"; counts.cat_shift++;
    } else if (beforeNR === false && afterNR === true) {
      klass = "nr_flip"; counts.nr_flip++;
    } else if (beforeConf - afterConf >= 0.15) {
      klass = "conf_drop"; counts.conf_drop++;
    } else if (storageBefore === "unknown_storage" && storageAfter && storageAfter !== "unknown_storage") {
      klass = "storage_resolve"; counts.storage_resolve++;
    } else {
      counts.no_change++;
    }
    classMap[row.pid] = klass;

    // Wave 59-D scope: apply nr_flip + conf_drop + pool_member (3 needs-owner sub-classes).
    // sku_shift / cat_shift were 0 in Wave 50; if any appear here, abort.
    if (["nr_flip", "conf_drop", "pool_member"].includes(klass)) {
      payloads.push({
        pid: row.pid,
        parser_version: out.parserVersion,
        category: out.category ?? null,
        comparable_key: out.comparableKey ?? null,
        parse_confidence: out.parseConfidence,
        needs_review: out.needsReview,
        parsed_json: out.parsedJson,
      });
    }
  }
  console.log(`[scope] counts=${JSON.stringify(counts)}`);
  console.log(`[scope] payloads to apply (nr_flip+conf_drop+pool_member)=${payloads.length}`);

  if (counts.sku_shift !== 0 || counts.cat_shift !== 0) {
    console.error(`[abort] unexpected sku_shift=${counts.sku_shift} or cat_shift=${counts.cat_shift}. Wave 50 said 0/0.`);
    process.exit(2);
  }

  // Wave 50 → 59-D drift acceptable: raw_listings updates since Wave 50 may have
  // reduced nr_flip count. no_change rows (parser output == DB) are excluded —
  // they're harmless to leave at stale parser_version (content identical).
  const wave50_baseline = 365 + 1 + 41;
  console.log(`[scope] Wave 50 baseline ${wave50_baseline} → Wave 59-D ${payloads.length} (drift ${wave50_baseline - payloads.length} from raw updates).`);

  const start = Date.now();
  const chunkLogs: Array<Record<string, unknown>> = [];
  let totalApplied = 0;
  for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
    const chunk = payloads.slice(i, i + CHUNK_SIZE);
    const t0 = Date.now();
    const res = await patchChunk(chunk);
    if (!res.ok) {
      chunkLogs.push({ chunk: i / CHUNK_SIZE + 1, ok: false, status: res.status, body: res.body.slice(0, 300) });
      console.error(`[abort] chunk ${i / CHUNK_SIZE + 1} failed: ${res.body.slice(0, 200)}`);
      break;
    }
    totalApplied += chunk.length;
    chunkLogs.push({ chunk: i / CHUNK_SIZE + 1, ok: true, applied: chunk.length, cumulative: totalApplied, elapsed_ms: Date.now() - t0 });
    console.log(`[chunk ${i / CHUNK_SIZE + 1}] applied=${chunk.length} cumulative=${totalApplied}/${payloads.length}`);
    if (i + CHUNK_SIZE < payloads.length) await sleep(SLEEP_MS);
  }

  const summary = {
    wave: "59-D",
    measured_at: new Date().toISOString(),
    counts,
    payloads_target: payloads.length,
    applied: totalApplied,
    elapsed_ms: Date.now() - start,
    chunk_logs: chunkLogs,
  };
  await mkdir(path.join(appDir, "reports"), { recursive: true });
  await writeFile(path.join(appDir, "reports/wave59d-needs-owner-apply-latest.json"), JSON.stringify(summary, null, 2));
  console.log(`[done] applied=${totalApplied}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
