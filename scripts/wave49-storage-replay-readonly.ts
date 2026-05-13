// Wave 49 read-only replay: pull production iphone needs_review unknown_storage
// rows, run current local parser, compare. No DB writes.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseListingOptions } from "@/lib/option-parser";
import { restFetch, serviceHeaders } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

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
  name: string;
  description_preview: string;
  parser_version: string;
  sku_id: string;
};

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Pull joined rows directly via PostgREST nested select. Cap at 200 for fast read.
  const url = `${base}/rest/v1/mvp_listing_parsed?select=pid,parser_version,parsed_json,raw:mvp_raw_listings!inner(name,description_preview)&needs_review=eq.true&category=eq.smartphone&comparable_key=like.iphone%7C*unknown_storage*&limit=200`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`fetch failed ${res.status}: ${await res.text()}`);
  const rows = await res.json() as Array<{
    pid: number;
    parser_version: string;
    parsed_json: Record<string, unknown>;
    raw: { name: string; description_preview: string };
  }>;

  const tally = {
    total: rows.length,
    by_parser_version: {} as Record<string, number>,
    would_resolve_to_storage: 0,
    would_resolve_breakdown: {} as Record<string, number>,
    still_unknown: 0,
  };

  const reparseExamples: Array<{ pid: number; title: string; before: string; after: number | null }> = [];

  for (const r of rows) {
    const v = String(r.parser_version ?? "unknown");
    tally.by_parser_version[v] = (tally.by_parser_version[v] ?? 0) + 1;
    const skuId = String((r.parsed_json as Record<string, unknown>).raw_sku_id ?? "iphone");
    const skuName = String((r.parsed_json as Record<string, unknown>).raw_sku_name ?? "iPhone");
    const out = parseListingOptions({
      title: r.raw.name,
      description: r.raw.description_preview ?? "",
      category: "smartphone",
      skuId,
      skuName,
    });
    if (out.storageGb != null) {
      tally.would_resolve_to_storage += 1;
      const bucket = `${out.storageGb}gb`;
      tally.would_resolve_breakdown[bucket] = (tally.would_resolve_breakdown[bucket] ?? 0) + 1;
      if (reparseExamples.length < 8) {
        reparseExamples.push({ pid: r.pid, title: r.raw.name, before: "unknown_storage", after: out.storageGb });
      }
    } else {
      tally.still_unknown += 1;
    }
  }

  const summary = {
    wave: 49,
    kind: "iphone_storage_replay_readonly",
    measured_at: new Date().toISOString(),
    db_unknown_storage_iphone_rows_sampled: tally.total,
    db_parser_version_breakdown: tally.by_parser_version,
    current_parser_would_resolve_to_storage: tally.would_resolve_to_storage,
    current_parser_storage_buckets: tally.would_resolve_breakdown,
    current_parser_still_unknown: tally.still_unknown,
    resolution_rate_pct: tally.total === 0 ? 0 : Math.round((tally.would_resolve_to_storage / tally.total) * 1000) / 10,
    examples: reparseExamples,
    note: "Read-only replay. DB writes forbidden in this wave. To realize the lift, a separate signoff'd reparse wave is required.",
  };

  console.log(JSON.stringify(summary, null, 2));
  const outPath = path.join(appDir, "reports/wave49-storage-replay-readonly-latest.json");
  await (await import("node:fs/promises")).writeFile(outPath, JSON.stringify(summary, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
